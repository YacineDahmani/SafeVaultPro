import fs from "node:fs";
import path from "node:path";
import Electrobun, { Tray, type MenuItemConfig } from "electrobun/bun";
import { restoreFromTray, forceQuitApp } from "./windowManager";
import { vaultBackend } from "../vaultBackendApi";
import { broadcastSSE } from "./extensionServer";

let trayInstance: Tray | null = null;
let currentWindow: any = null;

function resolveTrayIconPath(): string {
	const candidates = [
		path.resolve(process.cwd(), "src", "mainview", "assets", "SafeVault.ico"),
		path.resolve(process.cwd(), "src", "mainview", "assets", "SafeVault.png"),
		path.resolve(process.cwd(), "views", "mainview", "SafeVault.ico"),
		path.resolve(process.cwd(), "views", "mainview", "SafeVault.png"),
		path.resolve(process.cwd(), "src", "extension", "icon-32.png"),
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return "views://mainview/SafeVault.ico";
}

function buildTrayMenu(isUnlocked: boolean): MenuItemConfig[] {
	return [
		{
			type: "normal",
			label: `SafeVaultPro (${isUnlocked ? "Unlocked" : "Locked"})`,
			enabled: false,
		},
		{
			type: "divider",
		},
		{
			type: "normal",
			label: "Open SafeVaultPro",
			action: "open-app",
		},
		{
			type: "normal",
			label: "Lock Vault",
			action: "lock-vault",
			enabled: isUnlocked,
		},
		{
			type: "divider",
		},
		{
			type: "normal",
			label: "Quit SafeVaultPro",
			action: "quit-app",
		},
	];
}

export function updateTrayStatus(isUnlocked: boolean): void {
	if (!trayInstance) return;
	try {
		trayInstance.setMenu(buildTrayMenu(isUnlocked));
		trayInstance.setTitle(isUnlocked ? "SafeVaultPro (Unlocked)" : "SafeVaultPro");
	} catch (e) {
		console.warn("[TrayService] Failed to update tray menu:", e);
	}
}

export function initTray(window: any): Tray | null {
	if (trayInstance) {
		return trayInstance;
	}

	currentWindow = window;
	const iconPath = resolveTrayIconPath();

	try {
		const isUnlocked = vaultBackend.getUnlockStatus();
		trayInstance = new Tray({
			title: "SafeVaultPro",
			image: iconPath,
			template: false,
			width: 16,
			height: 16,
		});

		trayInstance.setMenu(buildTrayMenu(isUnlocked));

		// Handle clicks originating specifically from this tray
		trayInstance.on("tray-clicked", (event: any) => {
			handleTrayAction(event?.data?.action);
		});

		// Also listen on the global event emitter for fallback
		try {
			Electrobun.events.on("tray-clicked", (event: any) => {
				handleTrayAction(event?.data?.action);
			});
		} catch {}

		console.log("[TrayService] System tray initialized with icon:", iconPath);
		return trayInstance;
	} catch (error) {
		console.warn("[TrayService] Failed to initialize system tray:", error);
		return null;
	}
}

function handleTrayAction(action?: string): void {
	console.log("[TrayService] Tray action triggered:", action);

	if (!action || action === "open-app") {
		restoreFromTray(currentWindow);
		return;
	}

	if (action === "lock-vault") {
		vaultBackend.lockVault();
		updateTrayStatus(false);
		broadcastSSE({
			type: "VAULT_LOCKED",
		});
		return;
	}

	if (action === "quit-app") {
		forceQuitApp(currentWindow);
		return;
	}
}

export function getTrayInstance(): Tray | null {
	return trayInstance;
}
