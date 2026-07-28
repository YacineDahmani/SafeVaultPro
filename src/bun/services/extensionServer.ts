import { vaultBackend } from "../vaultBackendApi";
import type { VaultItem } from "../types";

const PORT = 48920;

function matchDomain(itemUrl: string | undefined, domain: string): boolean {
	if (!itemUrl || !domain) return false;
	const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
	const cleanUrl = itemUrl.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
	return cleanUrl.includes(cleanDomain) || cleanDomain.includes(cleanUrl);
}

function handleCors(req: Request): Headers {
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

				// Status endpoint
				if (url.pathname === "/api/status") {
					const isUnlocked = vaultBackend.getUnlockStatus();
					const isConfigured = vaultBackend.isConfigured();
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

				// All other endpoints require unlock
				if (!vaultBackend.getUnlockStatus()) {
					return new Response(
						JSON.stringify({
							success: false,
							error: "Vault is locked. Please unlock SafeVaultPro application.",
							unlocked: false,
						}),
						{ headers, status: 401 }
					);
				}

				// Query endpoint (matches items for domain or search term)
				if (url.pathname === "/api/query") {
					const domain = url.searchParams.get("domain") || "";
					const query = url.searchParams.get("q") || "";
					const typeFilter = url.searchParams.get("type") || "all";

					const allItems = vaultBackend.getItems();
					let matches: VaultItem[] = [];

					if (domain) {
						matches = allItems.filter((item) => {
							if (item.type === "password" && matchDomain(item.url, domain)) {
								return true;
							}
							if (typeFilter !== "password" && typeFilter !== "all") {
								return item.type === typeFilter;
							}
							const searchTarget = `${item.title} ${(item as any).username || ""} ${(item as any).issuer || ""}`.toLowerCase();
							return searchTarget.includes(domain.toLowerCase());
						});
					} else if (query) {
						matches = vaultBackend.getItems(query, typeFilter as any);
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
