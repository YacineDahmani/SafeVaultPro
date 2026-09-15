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
		if (!masterPassword || masterPassword.length < 10) {
			throw new Error("Master password must be at least 10 characters long.");
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

	public async openExtensionDirectory(): Promise<boolean> {
		try {
			const res = await fetch("http://localhost:48920/api/open-folder", {
				method: "POST",
				headers: {
					Authorization: "Bearer sv_tok_7c9e1b4f2a8d3e6a0b5c9d8e7f2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01",
				},
			});
			if (res.ok) {
				const data = await res.json();
				return Boolean(data.success);
			}
			return false;
		} catch {
			return false;
		}
	}

	public async openExternalUrl(url: string): Promise<boolean> {
		try {
			if (!url || typeof url !== "string") return false;
			let cleanUrl = url.trim();
			if (!cleanUrl) return false;
			if (!/^https?:\/\//i.test(cleanUrl)) {
				cleanUrl = "https://" + cleanUrl;
			}
			new URL(cleanUrl);

			const res = await fetch("http://localhost:48920/api/open-url", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer sv_tok_7c9e1b4f2a8d3e6a0b5c9d8e7f2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01",
				},
				body: JSON.stringify({ url: cleanUrl }),
			});
			if (res.ok) {
				const data = await res.json();
				return Boolean(data.success);
			}
			return false;
		} catch {
			return false;
		}
	}

	public saveBackupToDisk(_fileName: string, _jsonStr: string): string | null {
		// In browser/webview contexts, disk saving is handled via File System Access API
		// or standard client download anchor.
		return null;
	}
}

export const vaultBackend = new VaultBackendAPI();
