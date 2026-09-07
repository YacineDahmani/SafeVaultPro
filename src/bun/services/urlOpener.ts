import { Utils } from "electrobun/bun";

/**
 * Validates and normalizes an external HTTP or HTTPS URL.
 */
export function sanitizeUrl(rawUrl: string): string | null {
	if (!rawUrl || typeof rawUrl !== "string") return null;
	let trimmed = rawUrl.trim();
	if (!trimmed) return null;

	// Automatically prepend https:// if protocol was omitted (e.g. "github.com")
	if (!/^https?:\/\//i.test(trimmed)) {
		trimmed = "https://" + trimmed;
	}

	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol === "http:" || parsed.protocol === "https:") {
			return parsed.href;
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Opens a given URL in the user's default external browser.
 * Uses Electrobun's native Utils.openExternal with OS command fallbacks.
 */
export function openInDefaultBrowser(rawUrl: string): boolean {
	const validUrl = sanitizeUrl(rawUrl);
	if (!validUrl) {
		console.warn("[UrlOpener] Refusing to open invalid or non-HTTP(S) URL:", rawUrl);
		return false;
	}

	console.log("[UrlOpener] Opening in default browser:", validUrl);

	// 1. Try Electrobun native Utils.openExternal
	try {
		if (typeof Utils !== "undefined" && typeof Utils.openExternal === "function") {
			const success = Utils.openExternal(validUrl);
			if (success) {
				return true;
			}
		}
	} catch (e) {
		console.warn("[UrlOpener] Electrobun Utils.openExternal error, falling back to OS launcher:", e);
	}

	// 2. Cross-platform OS spawn fallbacks
	try {
		if (process.platform === "win32") {
			// On Windows, 'cmd.exe /c start "" "<url>"' triggers the shell's registered default web browser
			Bun.spawn(["cmd.exe", "/c", "start", "", validUrl]);
			return true;
		} else if (process.platform === "darwin") {
			Bun.spawn(["open", validUrl]);
			return true;
		} else {
			Bun.spawn(["xdg-open", validUrl]);
			return true;
		}
	} catch (err) {
		console.error("[UrlOpener] Failed to open external URL:", validUrl, err);
		return false;
	}
}
