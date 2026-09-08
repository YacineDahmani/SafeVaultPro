import fs from "node:fs";
import path from "node:path";
import { vaultBackend } from "../vaultBackendApi";
import type { VaultItem } from "../types";
import {
	isWindowMaximized,
	maximizeWindow,
	unmaximizeWindow,
	toggleMaximize,
	minimizeWindow,
	closeWindow,
	hideToTray,
	restoreFromTray,
	handleCloseOrMinimize,
} from "./windowManager";
import { DEFAULT_SETTINGS, type VaultSettings } from "../db/settingsStorage";
import { updateTrayStatus } from "./trayService";

const PORT = 48920;

let bridgeAuthToken = "sv_tok_7c9e1b4f2a8d3e6a0b5c9d8e7f2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01";

try {
	const tokenPath = path.resolve(process.cwd(), "src", "extension", "bridge-token.json");
	if (fs.existsSync(tokenPath)) {
		const raw = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
		if (raw?.token) bridgeAuthToken = raw.token;
	}
} catch (e) {
	console.warn("[Bridge] Using default token fallback:", e);
}

const SETTINGS_FILE_PATH = path.resolve(process.cwd(), "src", "bun", "db", "user-settings.json");

let currentSettings: VaultSettings = { ...DEFAULT_SETTINGS };

try {
	if (fs.existsSync(SETTINGS_FILE_PATH)) {
		const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, "utf-8"));
		currentSettings = { ...DEFAULT_SETTINGS, ...raw };
	}
} catch (e) {
	console.warn("[Bridge] Using default settings:", e);
}

function saveSettingsToDisk(settings: Partial<VaultSettings>): VaultSettings {
	currentSettings = { ...currentSettings, ...settings };
	try {
		fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(currentSettings, null, 2), "utf-8");
	} catch (e) {
		console.warn("[Bridge] Could not save settings to disk:", e);
	}
	return currentSettings;
}

let syncedUnlocked = false;
let syncedItems: VaultItem[] = [];
let pendingAppItems: VaultItem[] = [];
const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>();

export function broadcastSSE(data: any) {
	const encoder = new TextEncoder();
	const payload = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
	for (const client of sseClients) {
		try {
			client.enqueue(payload);
		} catch {
			sseClients.delete(client);
		}
	}
}

function extractBaseDomain(rawUrlOrHost: string): string {
	if (!rawUrlOrHost) return "";
	const clean = rawUrlOrHost
		.toLowerCase()
		.trim()
		.replace(/^(https?:\/\/)?(www\.)?/, "")
		.split("/")[0]
		.split(":")[0];
	const parts = clean.split(".");
	if (parts.length <= 2) return clean;
	// Handle standard second-level domains like co.uk, com.au, com.dz
	const sldList = ["co.uk", "org.uk", "gov.uk", "ac.uk", "com.dz", "edu.dz", "gov.dz", "com.au", "net.au", "co.nz", "co.jp"];
	const lastTwo = parts.slice(-2).join(".");
	if (sldList.includes(lastTwo) && parts.length >= 3) {
		return parts.slice(-3).join(".");
	}
	return parts.slice(-2).join(".");
}

// Known authentication alias clusters (e.g. Google services share credentials)
const AUTH_ALIAS_CLUSTERS: string[][] = [
	["google.com", "accounts.google.com", "mail.google.com", "myaccount.google.com", "youtube.com", "gmail.com"],
	["microsoft.com", "login.microsoftonline.com", "live.com", "login.live.com", "outlook.com", "office.com", "microsoftonline.com"],
	["apple.com", "appleid.apple.com", "icloud.com"],
	["amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.ca", "amazon.es", "amazon.it"],
	["yahoo.com", "login.yahoo.com", "mail.yahoo.com"],
	["github.com", "gist.github.com"],
];

function matchDomain(itemUrl: string | undefined, domain: string): boolean {
	if (!itemUrl || !domain) return false;
	const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].split(":")[0];
	const cleanItemUrl = itemUrl.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].split(":")[0];

	if (cleanItemUrl === cleanDomain) return true;
	if (cleanItemUrl.endsWith("." + cleanDomain) || cleanDomain.endsWith("." + cleanItemUrl)) return true;

	const base1 = extractBaseDomain(cleanDomain);
	const base2 = extractBaseDomain(cleanItemUrl);
	if (base1 && base2 && base1 === base2) return true;

	// Check auth clusters
	for (const cluster of AUTH_ALIAS_CLUSTERS) {
		const inCluster1 = cluster.some((c) => cleanDomain === c || cleanDomain.endsWith("." + c) || base1 === c);
		const inCluster2 = cluster.some((c) => cleanItemUrl === c || cleanItemUrl.endsWith("." + c) || base2 === c);
		if (inCluster1 && inCluster2) return true;
	}

	return false;
}

function isAllowedOrigin(origin: string | null): boolean {
	if (!origin) return true; // Direct non-browser callers (e.g. extension background service worker or local process)
	if (
		origin.startsWith("chrome-extension://") ||
		origin.startsWith("moz-extension://") ||
		origin.startsWith("views://") ||
		origin === "http://localhost:5173" ||
		origin === "http://127.0.0.1:5173"
	) {
		return true;
	}
	return false;
}

function handleCors(req?: Request): Headers {
	const headers = new Headers();
	const origin = req?.headers.get("Origin");
	if (origin && isAllowedOrigin(origin)) {
		headers.set("Access-Control-Allow-Origin", origin);
		headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-SafeVault-Token");
	}
	return headers;
}

function isAuthorized(req: Request): boolean {
	const origin = req.headers.get("Origin");
	// Internal desktop webview origins
	if (origin && (origin.startsWith("views://") || origin === "http://localhost:5173" || origin === "http://127.0.0.1:5173")) {
		return true;
	}
	const authHeader = req.headers.get("Authorization") || req.headers.get("X-SafeVault-Token") || "";
	const token = authHeader.replace(/^Bearer\s+/i, "").trim();
	return Boolean(token && token === bridgeAuthToken);
}

export function startExtensionServer() {
	try {
		const server = Bun.serve({
			port: PORT,
			hostname: "127.0.0.1",
			async fetch(req) {
				const url = new URL(req.url);
				const origin = req.headers.get("Origin");

				// Block cross-origin requests from arbitrary web pages
				if (origin && !isAllowedOrigin(origin)) {
					return new Response(
						JSON.stringify({ success: false, error: "Cross-origin access forbidden" }),
						{ status: 403, headers: { "Content-Type": "application/json" } }
					);
				}

				const headers = handleCors(req);
				headers.set("Content-Type", "application/json");

				if (req.method === "OPTIONS") {
					return new Response(null, { headers, status: 204 });
				}

				// Sync endpoint called by UI when locking/unlocking/updating secrets
				if (url.pathname === "/api/sync" && req.method === "POST") {
					if (!isAuthorized(req)) {
						return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { headers, status: 401 });
					}
					try {
						const body = (await req.json()) as { unlocked?: boolean; items?: VaultItem[] };
						if (typeof body.unlocked === "boolean") {
							syncedUnlocked = body.unlocked;
							updateTrayStatus(body.unlocked);
							if (body.unlocked && Array.isArray(body.items)) {
								// Preserve any pending extension items that haven't been persisted to body.items yet
								const pendingIds = new Set(pendingAppItems.map((p) => p.id));
								const unpersisted = syncedItems.filter(
									(i) => pendingIds.has(i.id) && !body.items!.some((bi) => bi.id === i.id)
								);
								syncedItems = [...unpersisted, ...body.items];
							} else if (!body.unlocked) {
								syncedItems = [];
							}
						}
						return new Response(
							JSON.stringify({
								success: true,
								unlocked: syncedUnlocked,
								pendingItems: pendingAppItems,
							}),
							{ headers }
						);
					} catch (e) {
						return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), { headers, status: 400 });
					}
				}

				// SSE event stream for live real-time sync with SafeVaultPro desktop app
				if (url.pathname === "/api/events" && req.method === "GET") {
					if (!isAuthorized(req)) {
						return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { headers, status: 401 });
					}
					let clientController: ReadableStreamDefaultController<Uint8Array>;
					const stream = new ReadableStream<Uint8Array>({
						start(controller) {
							clientController = controller;
							sseClients.add(controller);
							const encoder = new TextEncoder();
							controller.enqueue(encoder.encode(": connected\n\n"));
						},
						cancel() {
							sseClients.delete(clientController);
						},
					});

					const sseHeaders = handleCors(req);
					sseHeaders.set("Content-Type", "text/event-stream");
					sseHeaders.set("Cache-Control", "no-cache");
					sseHeaders.set("Connection", "keep-alive");

					return new Response(stream, { headers: sseHeaders });
				}

				// Pending items endpoint for desktop app to query queued credentials
				if (url.pathname === "/api/pending-items" && req.method === "GET") {
					if (!isAuthorized(req)) {
						return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { headers, status: 401 });
					}
					const isUnlockedNow = vaultBackend.getUnlockStatus() || syncedUnlocked;
					if (!isUnlockedNow) {
						return new Response(
							JSON.stringify({ success: false, error: "Vault is locked. Cannot access pending items.", items: [] }),
							{ headers, status: 401 }
						);
					}
					return new Response(
						JSON.stringify({ success: true, items: pendingAppItems }),
						{ headers }
					);
				}

				// Acknowledge that desktop app has encrypted and saved pending items
				if (url.pathname === "/api/ack-pending" && req.method === "POST") {
					if (!isAuthorized(req)) {
						return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { headers, status: 401 });
					}
					try {
						const body = (await req.json()) as { ids?: string[] };
						if (Array.isArray(body.ids)) {
							const ackSet = new Set(body.ids);
							pendingAppItems = pendingAppItems.filter((i) => !ackSet.has(i.id));
						}
						return new Response(
							JSON.stringify({ success: true, remaining: pendingAppItems.length }),
							{ headers }
						);
					} catch (e) {
						return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), { headers, status: 400 });
					}
				}

				// Window action endpoint (minimize, maximize, unmaximize, close, hideToTray, restoreFromTray) from TitleBar & Tray
				if (url.pathname === "/api/window-action" && req.method === "POST") {
					try {
						const body = (await req.json()) as { action?: string; minimizeToTray?: boolean };
						let isMax = false;

						if (body.action === "minimize") {
							minimizeWindow();
							isMax = isWindowMaximized();
						} else if (body.action === "maximize" || body.action === "toggleMaximize") {
							isMax = toggleMaximize();
						} else if (body.action === "unmaximize") {
							isMax = unmaximizeWindow();
						} else if (body.action === "forceMaximize") {
							isMax = maximizeWindow();
						} else if (body.action === "hideToTray") {
							hideToTray();
						} else if (body.action === "restoreFromTray") {
							restoreFromTray();
						} else if (body.action === "close") {
							const shouldMinimize = typeof body.minimizeToTray === "boolean"
								? body.minimizeToTray
								: Boolean(currentSettings.minimizeToTray);
							const closeResult = handleCloseOrMinimize(undefined, shouldMinimize);
							return new Response(
								JSON.stringify({
									success: true,
									isMaximized: false,
									action: closeResult.action,
									minimizedToTray: closeResult.action === "hidden",
								}),
								{ headers }
							);
						} else {
							isMax = isWindowMaximized();
						}

						return new Response(JSON.stringify({ success: true, isMaximized: isMax }), { headers });
					} catch (e) {
						console.error("[WindowAction] Error:", e);
						return new Response(JSON.stringify({ success: false, error: String(e) }), { headers, status: 400 });
					}
				}

				// Settings management endpoints (syncs user preferences including minimizeToTray)
				if (url.pathname === "/api/settings") {
					if (req.method === "GET") {
						return new Response(JSON.stringify({ success: true, settings: currentSettings }), { headers });
					}
					if (req.method === "POST") {
						try {
							const body = (await req.json()) as Partial<VaultSettings>;
							const updated = saveSettingsToDisk(body);
							return new Response(JSON.stringify({ success: true, settings: updated }), { headers });
						} catch (e) {
							return new Response(JSON.stringify({ success: false, error: "Invalid settings payload" }), { headers, status: 400 });
						}
					}
				}

				// Query window state endpoint (returns real-time computed isMaximized state)
				if (url.pathname === "/api/window-state") {
					try {
						const isMax = isWindowMaximized();
						return new Response(JSON.stringify({ success: true, isMaximized: isMax }), { headers });
					} catch (e) {
						return new Response(JSON.stringify({ success: true, isMaximized: false }), { headers });
					}
				}

				// Status endpoint
				if (url.pathname === "/api/status") {
					const isUnlocked = vaultBackend.getUnlockStatus() || syncedUnlocked;
					const isConfigured = vaultBackend.isConfigured() || syncedUnlocked;
					return new Response(
						JSON.stringify({
							success: true,
							unlocked: isUnlocked,
							isConfigured,
						}),
						{ headers }
					);
				}

				// Open extension directory in OS file manager endpoint
				if (url.pathname === "/api/open-folder") {
					if (!isAuthorized(req)) {
						return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { headers, status: 401 });
					}
					const opened = vaultBackend.openExtensionDirectory();
					return new Response(
						JSON.stringify({ success: opened }),
						{ headers }
					);
				}

				// Open URL in system default browser endpoint
				if (url.pathname === "/api/open-url" && (req.method === "POST" || req.method === "GET")) {
					if (!isAuthorized(req)) {
						return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { headers, status: 401 });
					}
					let targetUrl = "";
					if (req.method === "POST") {
						try {
							const body = (await req.json()) as { url?: string };
							targetUrl = body.url || "";
						} catch {}
					}
					if (!targetUrl) {
						targetUrl = url.searchParams.get("url") || "";
					}
					const opened = vaultBackend.openExternalUrl(targetUrl);
					return new Response(
						JSON.stringify({ success: opened }),
						{ headers }
					);
				}

				// Auto-save password endpoint called by browser extension on registration/submit
				if (url.pathname === "/api/save-password" && req.method === "POST") {
					if (!isAuthorized(req)) {
						return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { headers, status: 401 });
					}
					try {
						const body = (await req.json()) as {
							id?: string;
							title?: string;
							username?: string;
							password?: string;
							url?: string;
							notes?: string;
						};

						if (!body.password) {
							return new Response(
								JSON.stringify({ success: false, error: "Password is required" }),
								{ headers, status: 400 }
							);
						}

						const cleanDomain = (body.url || "")
							.toLowerCase()
							.replace(/^(https?:\/\/)?(www\.)?/, "")
							.split("/")[0];

						const itemTitle = body.title || (cleanDomain ? `${cleanDomain} Account` : "Saved Login");

						// Check if an existing item for this domain + username or id already exists
						const allItems = syncedItems.length > 0 ? syncedItems : (vaultBackend.getUnlockStatus() ? vaultBackend.getItems() : []);
						const existingItem = body.id
							? allItems.find((i) => i.id === body.id)
							: allItems.find(
									(i) =>
										i.type === "password" &&
										((i as any).username || "").toLowerCase() === (body.username || "").toLowerCase() &&
										((i as any).url || "").toLowerCase().includes(cleanDomain)
								);

						const itemId = body.id || (existingItem ? existingItem.id : `ext-item-${Date.now()}`);

						const itemToSave = {
							id: itemId,
							type: "password" as const,
							title: existingItem ? existingItem.title : itemTitle,
							username: body.username || (existingItem ? (existingItem as any).username : ""),
							password: body.password,
							url: body.url || (existingItem ? (existingItem as any).url : ""),
							favorite: existingItem ? existingItem.favorite : false,
							tags: existingItem ? existingItem.tags : ["Extension", "Auto-Saved"],
							notes: body.notes || `Automatically captured & saved from browser extension on ${new Date().toLocaleDateString()}.`,
							createdAt: existingItem ? existingItem.createdAt : Date.now(),
							updatedAt: Date.now(),
						};

						const isCurrentlyUnlocked = vaultBackend.getUnlockStatus() || syncedUnlocked;

						let savedItem = itemToSave;
						if (vaultBackend.getUnlockStatus()) {
							savedItem = await vaultBackend.saveItem(itemToSave);
						}

						// Update synced items cache
						const idx = syncedItems.findIndex((i) => i.id === itemId);
						if (idx >= 0) {
							syncedItems[idx] = savedItem;
						} else {
							syncedItems.unshift(savedItem);
						}

						// Add to pending queue so the desktop app encrypts and persists it
						const pIdx = pendingAppItems.findIndex((i) => i.id === itemId);
						if (pIdx >= 0) {
							pendingAppItems[pIdx] = savedItem;
						} else {
							pendingAppItems.push(savedItem);
						}

						// Broadcast live event to connected desktop app
						broadcastSSE({
							type: "ITEM_SAVED",
							item: savedItem,
						});

						return new Response(
							JSON.stringify({
								success: true,
								queued: !isCurrentlyUnlocked,
								item: savedItem,
							}),
							{ headers }
						);
					} catch (err: any) {
						console.error("[SavePassword] Error saving item:", err);
						return new Response(
							JSON.stringify({ success: false, error: err.message || "Failed to save item" }),
							{ headers, status: 500 }
						);
					}
				}

				if (!isAuthorized(req)) {
					return new Response(
						JSON.stringify({ success: false, error: "Unauthorized" }),
						{ headers, status: 401 }
					);
				}

				const isUnlocked = vaultBackend.getUnlockStatus() || syncedUnlocked;

				// All other endpoints require unlock
				if (!isUnlocked) {
					return new Response(
						JSON.stringify({
							success: false,
							error: "Vault is locked. Please unlock SafeVaultPro application.",
							unlocked: false,
						}),
						{ headers, status: 401 }
					);
				}

				// Query endpoint (matches items for domain, query term, or field type)
				if (url.pathname === "/api/query") {
					const domain = url.searchParams.get("domain") || "";
					const query = url.searchParams.get("q") || "";
					const typeFilter = url.searchParams.get("type") || "all";
					const fieldType = url.searchParams.get("fieldType") || "";

					const allItems = syncedItems.length > 0 ? syncedItems : vaultBackend.getItems();
					let matches: VaultItem[] = [];

					if (query) {
						const cleanQ = query.toLowerCase();
						matches = allItems.filter((item) => {
							const searchTarget = `${item.title} ${(item as any).username || ""} ${(item as any).url || ""} ${(item as any).notes || ""} ${(item as any).cardholderName || ""} ${(item as any).number || ""} ${(item as any).firstName || ""} ${(item as any).lastName || ""} ${(item as any).fullName || ""} ${(item as any).firstNameArabic || ""} ${(item as any).lastNameArabic || ""} ${(item as any).fullNameArabic || ""} ${(item as any).nin || ""} ${(item as any).nationalId || ""} ${(item as any).city || ""} ${(item as any).stateProvince || ""} ${(item as any).country || ""}`.toLowerCase();
							return searchTarget.includes(cleanQ);
						});
					} else if (fieldType && (fieldType.startsWith("card_") || fieldType === "card")) {
						// Focused on a credit card payment field -> ONLY return payment cards (exclude ID/Passport/Driver license)
						const cards = allItems.filter(
							(i) =>
								i.type === "card" &&
								(i as any).subtype !== "passport" &&
								(i as any).subtype !== "id_card" &&
								(i as any).subtype !== "drivers_license"
						);
						const domainCards = cards.filter((i) => (i as any).url && matchDomain((i as any).url, domain));
						matches = domainCards.length > 0 ? domainCards : cards;
					} else if (fieldType === "totp") {
						// Focused on 2FA code field
						matches = allItems.filter((i) => i.type === "totp");
					} else if (fieldType === "personal") {
						// Focused on identity / personal info field
						matches = allItems.filter((i) => i.type === "personal_info");
					} else if (domain) {
						// Standard domain match for logins/passwords
						matches = allItems.filter((item) => {
							if (item.type === "password" && matchDomain(item.url, domain)) {
								return true;
							}
							if ((item as any).url && matchDomain((item as any).url, domain)) {
								return true;
							}
							if (typeFilter !== "password" && typeFilter !== "all") {
								return item.type === typeFilter;
							}
							const searchTarget = `${item.title} ${(item as any).username || ""} ${(item as any).issuer || ""}`.toLowerCase();
							return searchTarget.includes(domain.toLowerCase());
						});
					} else {
						matches = allItems;
					}

					return new Response(
						JSON.stringify({
							success: true,
							domain,
							count: matches.length,
							items: matches,
						}),
						{ headers }
					);
				}

				// Live TOTP endpoint
				if (url.pathname === "/api/totp") {
					const secret = url.searchParams.get("secret");
					if (!secret) {
						return new Response(
							JSON.stringify({ success: false, error: "Missing secret parameter" }),
							{ headers, status: 400 }
						);
					}
					const totpInfo = vaultBackend.getTotp(secret);
					return new Response(JSON.stringify({ success: true, ...totpInfo }), { headers });
				}

				// Password generator endpoint
				if (url.pathname === "/api/generate") {
					const length = parseInt(url.searchParams.get("length") || "16", 10);
					const useUppercase = url.searchParams.get("uppercase") !== "false";
					const useNumbers = url.searchParams.get("numbers") !== "false";
					const useSymbols = url.searchParams.get("symbols") !== "false";

					const password = vaultBackend.generateNewPassword({
						length,
						uppercase: useUppercase,
						numbers: useNumbers,
						symbols: useSymbols,
					});
					const entropy = vaultBackend.getPasswordEntropy(password);

					return new Response(
						JSON.stringify({ success: true, password, entropy }),
						{ headers }
					);
				}

				return new Response(
					JSON.stringify({ success: false, error: "Endpoint not found" }),
					{ headers, status: 404 }
				);
			},
		});

		console.log(`[SafeVaultPro Extension Bridge] Listening on http://localhost:${PORT}`);
		return server;
	} catch (error) {
		console.error("[SafeVaultPro Extension Bridge] Failed to start server:", error);
		return null;
	}
}
