import fs from "node:fs";
import path from "node:path";
import {
	calculatePasswordEntropy,
	deriveMasterKey,
	generatePassword,
	generateSaltHex,
} from "./crypto/vaultCrypto";
import {
	filterVaultItems,
	getVaultMetadata,
	loadEncryptedVault,
	saveEncryptedVault,
	saveVaultMetadata,
} from "./db/vaultStorage";
import { getInitialSeedItems } from "./db/seedVault";
import { copySecretToClipboard } from "./services/clipboardService";
import { generateTotpStatus, parseOtpauthUrl } from "./totp/totpEngine";
import type { VaultItem, VaultItemType, VaultMetadata } from "./types";
import { scanQrCodeFromBlob } from "./ocr/qrScanner";

export class VaultBackendAPI {
	private activeMasterKey: CryptoKey | null = null;
	private cachedItems: VaultItem[] = [];
	private isUnlocked = false;

	public isConfigured(): boolean {
		return getVaultMetadata() !== null;
	}

	public getUnlockStatus(): boolean {
		return this.isUnlocked;
	}

	public lockVault(): void {
		this.activeMasterKey = null;
		this.cachedItems = [];
		this.isUnlocked = false;
	}

	public async setupVault(masterPassword: string): Promise<boolean> {
		if (!masterPassword || masterPassword.length < 6) {
			throw new Error("Master password must be at least 6 characters long.");
		}

		const saltHex = generateSaltHex();
		const metadata: VaultMetadata = {
			vaultId: `vault-${Date.now()}`,
			version: 1,
			saltHex,
			params: {
				algorithm: "AES-256-GCM",
				kdf: "Argon2id",
				iterations: 3,
			},
		};

		const key = await deriveMasterKey(masterPassword, saltHex);
		const initialItems = getInitialSeedItems();

		saveVaultMetadata(metadata);
		await saveEncryptedVault(initialItems, key);

		this.activeMasterKey = key;
		this.cachedItems = initialItems;
		this.isUnlocked = true;
		return true;
	}

	public async unlockVault(masterPassword: string): Promise<boolean> {
		const metadata = getVaultMetadata();
		if (!metadata) {
			// If not set up yet, initialize with master password
			return await this.setupVault(masterPassword);
		}

		const key = await deriveMasterKey(masterPassword, metadata.saltHex);
		try {
			const items = await loadEncryptedVault(key);
			this.activeMasterKey = key;
			this.cachedItems = items;
			this.isUnlocked = true;
			return true;
		} catch (e) {
			this.isUnlocked = false;
			throw new Error("Incorrect master password");
		}
	}

	public async resetToInitialSeed(): Promise<VaultItem[]> {
		if (!this.isUnlocked || !this.activeMasterKey) throw new Error("Vault is locked.");
		const newSeedItems = getInitialSeedItems();
		this.cachedItems = newSeedItems;
		await saveEncryptedVault(newSeedItems, this.activeMasterKey);
		return newSeedItems;
	}

	public getItems(query = "", filterType: "all" | VaultItemType | "favorites" = "all"): VaultItem[] {
		if (!this.isUnlocked) throw new Error("Vault is locked.");
		return filterVaultItems(this.cachedItems, query, filterType);
	}

	public async saveItem(item: VaultItem): Promise<VaultItem> {
		if (!this.isUnlocked || !this.activeMasterKey) throw new Error("Vault is locked.");

		const existingIndex = this.cachedItems.findIndex((i) => i.id === item.id);
		const updatedItem = {
			...item,
			updatedAt: Date.now(),
		};

		if (existingIndex >= 0) {
			this.cachedItems[existingIndex] = updatedItem;
		} else {
			this.cachedItems.unshift(updatedItem);
		}

		await saveEncryptedVault(this.cachedItems, this.activeMasterKey);
		return updatedItem;
	}

	public async deleteItem(id: string): Promise<boolean> {
		if (!this.isUnlocked || !this.activeMasterKey) throw new Error("Vault is locked.");

		this.cachedItems = this.cachedItems.filter((i) => i.id !== id);
		await saveEncryptedVault(this.cachedItems, this.activeMasterKey);
		return true;
	}

	// Utility proxy methods
	public generateNewPassword(options?: Parameters<typeof generatePassword>[0]): string {
		return generatePassword(options);
	}

	public getPasswordEntropy(password: string): number {
		return calculatePasswordEntropy(password);
	}

	public getTotp(secret: string, period = 30) {
		return generateTotpStatus(secret, period);
	}

	public parseOtpauth(url: string) {
		return parseOtpauthUrl(url);
	}

	public async copySecret(text: string, durationSeconds = 30) {
		return await copySecretToClipboard(text, durationSeconds);
	}

	public async scanQrBlob(blob: Blob) {
		return await scanQrCodeFromBlob(blob);
	}

	public openExtensionDirectory(): boolean {
		try {
			const candidatePaths = [
				path.resolve(process.cwd(), "src", "extension"),
				"d:\\repos\\SafeVaultPro\\src\\extension",
				path.resolve(__dirname, "..", "extension"),
				path.resolve(__dirname, "..", "..", "src", "extension"),
			];

			let validPath = candidatePaths.find((p) => fs.existsSync(p));
			if (!validPath) {
				validPath = "d:\\repos\\SafeVaultPro\\src\\extension";
			}

			console.log("[SafeVaultPro] Opening verified extension directory:", validPath);

			if (process.platform === "win32") {
				Bun.spawn(["explorer.exe", validPath]);
			} else if (process.platform === "darwin") {
				Bun.spawn(["open", validPath]);
			} else {
				Bun.spawn(["xdg-open", validPath]);
			}
			return true;
		} catch (e) {
			console.error("Failed to open extension directory:", e);
			return false;
		}
	}
}

export const vaultBackend = new VaultBackendAPI();
