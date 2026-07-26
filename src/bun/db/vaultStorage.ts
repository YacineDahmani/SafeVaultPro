import type { EncryptedVaultPayload, VaultItem, VaultItemType, VaultMetadata } from "../types";
import { decryptVaultData, encryptVaultData } from "../crypto/vaultCrypto";

const VAULT_STORAGE_KEY = "safevault_encrypted_store";
const METADATA_STORAGE_KEY = "safevault_metadata";

export interface VaultState {
	metadata: VaultMetadata;
	items: VaultItem[];
}

export function saveVaultMetadata(metadata: VaultMetadata): void {
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(metadata));
	}
}

export function getVaultMetadata(): VaultMetadata | null {
	if (typeof localStorage === "undefined") return null;
	const raw = localStorage.getItem(METADATA_STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as VaultMetadata;
	} catch {
		return null;
	}
}

export async function saveEncryptedVault(
	items: VaultItem[],
	key: CryptoKey,
): Promise<void> {
	const encryptedPayload = await encryptVaultData(items, key);
	if (typeof localStorage !== "undefined") {
		localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(encryptedPayload));
	}
}

export async function loadEncryptedVault(
	key: CryptoKey,
): Promise<VaultItem[]> {
	if (typeof localStorage === "undefined") return [];
	const raw = localStorage.getItem(VAULT_STORAGE_KEY);
	if (!raw) return [];

	try {
		const payload = JSON.parse(raw) as EncryptedVaultPayload;
		const items = await decryptVaultData<VaultItem[]>(payload, key);
		return items || [];
	} catch (e) {
		console.error("Failed to decrypt vault with master key:", e);
		throw new Error("Invalid master password or corrupted vault data.");
	}
}

export function filterVaultItems(
	items: VaultItem[],
	query: string,
	typeFilter: "all" | VaultItemType | "favorites" = "all",
): VaultItem[] {
	const cleanQuery = query.trim().toLowerCase();

	return items.filter((item) => {
		// Type filtering
		if (typeFilter === "favorites" && !item.favorite) return false;
		if (typeFilter !== "all" && typeFilter !== "favorites" && item.type !== typeFilter) return false;

		// Text query search across title, notes, username, card number, issuer, etc.
		if (!cleanQuery) return true;

		const titleMatch = item.title.toLowerCase().includes(cleanQuery);
		const notesMatch = item.notes?.toLowerCase().includes(cleanQuery) ?? false;
		const tagMatch = item.tags.some((t) => t.toLowerCase().includes(cleanQuery));

		let specificMatch = false;
		if (item.type === "password") {
			specificMatch = (item.username?.toLowerCase().includes(cleanQuery) ?? false) || (item.url?.toLowerCase().includes(cleanQuery) ?? false);
		} else if (item.type === "card") {
			specificMatch = (item.cardholderName?.toLowerCase().includes(cleanQuery) ?? false) || (item.number?.toLowerCase().includes(cleanQuery) ?? false) || (item.subtype?.toLowerCase().includes(cleanQuery) ?? false);
		} else if (item.type === "totp") {
			specificMatch = (item.issuer?.toLowerCase().includes(cleanQuery) ?? false) || (item.accountName?.toLowerCase().includes(cleanQuery) ?? false);
		} else if (item.type === "note") {
			specificMatch = item.content?.toLowerCase().includes(cleanQuery) ?? false;
		}

		return titleMatch || notesMatch || tagMatch || specificMatch;
	});
}
