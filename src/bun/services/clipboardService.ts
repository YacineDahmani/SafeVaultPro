let activeTimer: ReturnType<typeof setTimeout> | null = null;
let lastCopiedSecret: string | null = null;

export async function copySecretToClipboard(
	secret: string,
	autoClearSeconds = 30,
	onCleared?: () => void,
): Promise<boolean> {
	try {
		if (typeof navigator !== "undefined" && navigator.clipboard) {
			await navigator.clipboard.writeText(secret);
		} else {
			// Fallback if needed
			console.warn("Clipboard API not available in current environment");
		}

		lastCopiedSecret = secret;

		if (activeTimer) {
			clearTimeout(activeTimer);
			activeTimer = null;
		}

		if (autoClearSeconds > 0) {
			activeTimer = setTimeout(async () => {
				try {
					if (typeof navigator !== "undefined" && navigator.clipboard) {
						const currentText = await navigator.clipboard.readText().catch(() => null);
						if (currentText === lastCopiedSecret) {
							await navigator.clipboard.writeText("");
							console.log("SafeVault clipboard cleared automatically after timeout.");
							if (onCleared) onCleared();
						}
					}
				} catch (e) {
					console.error("Failed to clear clipboard:", e);
				} finally {
					lastCopiedSecret = null;
					activeTimer = null;
				}
			}, autoClearSeconds * 1000);
		}

		return true;
	} catch (e) {
		console.error("Failed to copy to clipboard:", e);
		return false;
	}
}

export function cancelClipboardAutoClear(): void {
	if (activeTimer) {
		clearTimeout(activeTimer);
		activeTimer = null;
	}
	lastCopiedSecret = null;
}
