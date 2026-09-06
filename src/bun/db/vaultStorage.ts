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

const VAULT_BACKUP_KEY = "safevault_encrypted_store_backup";

export async function saveEncryptedVault(
	items: VaultItem[],
	key: CryptoKey,
): Promise<void> {
	const encryptedPayload = await encryptVaultData(items, key);
	if (typeof localStorage !== "undefined") {
		// Atomic safety: preserve previous state as backup snapshot before overwriting
		const previousState = localStorage.getItem(VAULT_STORAGE_KEY);
		if (previousState) {
			try {
				localStorage.setItem(VAULT_BACKUP_KEY, previousState);
			} catch {}
		}
		localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(encryptedPayload));
	}
}

export async function loadEncryptedVault(
	key: CryptoKey,
): Promise<VaultItem[]> {
	if (typeof localStorage === "undefined") return [];
	let raw = localStorage.getItem(VAULT_STORAGE_KEY);

	if (!raw && typeof localStorage !== "undefined") {
		// Fallback to backup snapshot if primary key was wiped or missing
		raw = localStorage.getItem(VAULT_BACKUP_KEY);
	}

	if (!raw) return [];

	try {
		const payload = JSON.parse(raw) as EncryptedVaultPayload;
		const items = await decryptVaultData<VaultItem[]>(payload, key);
		return items || [];
	} catch (primaryErr) {
		// If primary state is corrupted, attempt emergency recovery from backup snapshot
		if (typeof localStorage !== "undefined") {
			const backupRaw = localStorage.getItem(VAULT_BACKUP_KEY);
			if (backupRaw && backupRaw !== raw) {
				try {
					console.warn("[VaultStorage] Primary vault corrupted, attempting recovery from backup snapshot...");
					const backupPayload = JSON.parse(backupRaw) as EncryptedVaultPayload;
					const recoveredItems = await decryptVaultData<VaultItem[]>(backupPayload, key);
					if (recoveredItems) {
						console.log("[VaultStorage] Successfully recovered vault from backup snapshot.");
						// Restore recovered state to primary store
						localStorage.setItem(VAULT_STORAGE_KEY, backupRaw);
						return recoveredItems;
					}
				} catch (backupErr) {
					console.error("Backup recovery also failed:", backupErr);
				}
			}
		}

		console.error("Failed to decrypt vault with master key:", primaryErr);
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
		} else if (item.type === "personal_info") {
			specificMatch =
				(item.fullName?.toLowerCase().includes(cleanQuery) ?? false) ||
				(item.city?.toLowerCase().includes(cleanQuery) ?? false) ||
				(item.country?.toLowerCase().includes(cleanQuery) ?? false) ||
				(item.email?.toLowerCase().includes(cleanQuery) ?? false);
		}

		return titleMatch || notesMatch || tagMatch || specificMatch;
	});
}
