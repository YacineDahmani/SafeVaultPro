import { vaultBackend } from "../vaultBackendApi";
import type { VaultItem } from "../types";

const PORT = 48920;

let syncedUnlocked = false;
let syncedItems: VaultItem[] = [];

function matchDomain(itemUrl: string | undefined, domain: string): boolean {
	if (!itemUrl || !domain) return false;
	const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
	const cleanUrl = itemUrl.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
	return cleanUrl.includes(cleanDomain) || cleanDomain.includes(cleanUrl);
}

function handleCors(_req?: Request): Headers {
	const headers = new Headers();
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	return headers;
}

export function startExtensionServer() {
	try {
		const server = Bun.serve({
			port: PORT,
			async fetch(req) {
				const url = new URL(req.url);
				const headers = handleCors(req);
				headers.set("Content-Type", "application/json");

				if (req.method === "OPTIONS") {
					return new Response(null, { headers, status: 204 });
				}

				// Sync endpoint called by UI when locking/unlocking/updating secrets
				if (url.pathname === "/api/sync" && req.method === "POST") {
					try {
						const body = (await req.json()) as { unlocked?: boolean; items?: VaultItem[] };
						if (typeof body.unlocked === "boolean") {
							syncedUnlocked = body.unlocked;
							if (body.unlocked && Array.isArray(body.items)) {
								syncedItems = body.items;
							} else if (!body.unlocked) {
								syncedItems = [];
							}
						}
						return new Response(JSON.stringify({ success: true, unlocked: syncedUnlocked }), { headers });
					} catch (e) {
						return new Response(JSON.stringify({ success: false, error: "Invalid payload" }), { headers, status: 400 });
					}
				}

				// Window action endpoint (minimize, maximize, close) from custom TitleBar
				if (url.pathname === "/api/window-action" && req.method === "POST") {
					try {
						const body = (await req.json()) as { action?: string };
						const { mainWindow } = await import("../index");
						let isMax = false;
						if (body.action === "minimize") {
							mainWindow?.minimize();
						} else if (body.action === "maximize") {
							try { isMax = Boolean(mainWindow?.isMaximized()); } catch {}
							if (isMax) {
								mainWindow?.unmaximize();
								isMax = false;
							} else {
								mainWindow?.maximize();
								isMax = true;
							}
						} else if (body.action === "unmaximize") {
							mainWindow?.unmaximize();
							isMax = false;
						} else if (body.action === "close") {
							mainWindow?.close();
						}
						return new Response(JSON.stringify({ success: true, isMaximized: isMax }), { headers });
					} catch (e) {
						return new Response(JSON.stringify({ success: false }), { headers, status: 400 });
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
					const opened = vaultBackend.openExtensionDirectory();
					return new Response(
						JSON.stringify({ success: opened }),
						{ headers }
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
							const searchTarget = `${item.title} ${(item as any).username || ""} ${(item as any).url || ""} ${(item as any).notes || ""} ${(item as any).cardholderName || ""} ${(item as any).number || ""}`.toLowerCase();
							return searchTarget.includes(cleanQ);
						});
					} else if (fieldType && fieldType.startsWith("card_")) {
						// Focused on a credit card payment field -> ONLY return payment cards (exclude ID/Passport)
						const cards = allItems.filter((i) => i.type === "card" && ((i as any).subtype === "credit_card" || !(i as any).subtype));
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
