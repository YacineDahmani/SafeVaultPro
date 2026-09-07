import { vaultBackend } from "../../bun/vaultBackendApi";

const BRIDGE_AUTH_TOKEN = "sv_tok_7c9e1b4f2a8d3e6a0b5c9d8e7f2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01";

/**
 * Normalizes and safely opens any website URL in the user's default system browser
 * (e.g. Chrome, Edge, Brave, Firefox) rather than rendering inside an embedded Electrobun webview.
 */
export async function openExternalUrl(rawUrl: string): Promise<boolean> {
	if (!rawUrl || typeof rawUrl !== "string") return false;
	let url = rawUrl.trim();
	if (!url) return false;

	// Ensure protocol is present
	if (!/^https?:\/\//i.test(url)) {
		url = "https://" + url;
	}

	try {
		new URL(url);
	} catch {
		console.warn("[BrowserOpener] Invalid URL format:", rawUrl);
		return false;
	}

	// 1. Direct call to vaultBackend if running in the unified Bun environment
	try {
		if (vaultBackend && typeof vaultBackend.openExternalUrl === "function") {
			const success = vaultBackend.openExternalUrl(url);
			if (success) return true;
		}
	} catch (e) {
		console.warn("[BrowserOpener] Direct vaultBackend call failed, trying HTTP bridge:", e);
	}

	// 2. Call the background bridge server at localhost:48920
	try {
		const res = await fetch("http://localhost:48920/api/open-url", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${BRIDGE_AUTH_TOKEN}`,
			},
			body: JSON.stringify({ url }),
		});
		if (res.ok) {
			const data = await res.json();
			if (data.success) return true;
		}
	} catch (err) {
		console.error("[BrowserOpener] Bridge API call failed:", err);
	}

	return false;
}
