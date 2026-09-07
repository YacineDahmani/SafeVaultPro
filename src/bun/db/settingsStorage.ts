export interface VaultSettings {
	autoLockTimeout: "never" | "1" | "5" | "15" | "30" | "60";
	lockOnSleep: boolean;
	lockOnWindowBlur: boolean;
	clipboardTimeout: number; // in seconds (e.g. 5, 10, 15, 30, 60, 120)
	wipeClipboardOnLock: boolean;
	argon2Memory: number; // in KB (e.g. 32768, 65536, 131072, 262144)
	argon2Iterations: number; // passes (e.g. 2, 3, 4, 5, 8)
	argon2Parallelism: number; // threads
	defaultLandingView: "all" | "dashboard" | "favorites";
	autoBackupEnabled: boolean;
	lastBackupTimestamp: number | null;
	minimizeToTray: boolean;
}

const SETTINGS_STORAGE_KEY = "safevault_user_settings";

export const DEFAULT_SETTINGS: VaultSettings = {
	autoLockTimeout: "15",
	lockOnSleep: true,
	lockOnWindowBlur: false,
	clipboardTimeout: 30,
	wipeClipboardOnLock: true,
	argon2Memory: 65536,
	argon2Iterations: 3,
	argon2Parallelism: 1,
	defaultLandingView: "all",
	autoBackupEnabled: true,
	lastBackupTimestamp: null,
	minimizeToTray: false,
};

let memorySettings: VaultSettings = { ...DEFAULT_SETTINGS };

export function getVaultSettings(): VaultSettings {
	if (typeof localStorage === "undefined") {
		return { ...memorySettings };
	}
	const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
	if (!raw) return { ...DEFAULT_SETTINGS };
	try {
		const parsed = JSON.parse(raw);
		return {
			...DEFAULT_SETTINGS,
			...parsed,
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

export function saveVaultSettings(settings: Partial<VaultSettings>): VaultSettings {
	const current = getVaultSettings();
	const updated: VaultSettings = {
		...current,
		...settings,
	};
	memorySettings = { ...updated };
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
	}
	return updated;
}

export function resetVaultSettings(): VaultSettings {
	memorySettings = { ...DEFAULT_SETTINGS };
	if (typeof localStorage !== "undefined") {
		localStorage.removeItem(SETTINGS_STORAGE_KEY);
	}
	return { ...DEFAULT_SETTINGS };
}
