export type VaultItemType = "password" | "card" | "totp" | "note" | "personal_info";

export type CardSubtype = "passport" | "id_card" | "drivers_license" | "credit_card" | "custom";

export interface BaseVaultItem {
	id: string;
	type: VaultItemType;
	title: string;
	favorite: boolean;
	tags: string[];
	createdAt: number;
	updatedAt: number;
}

export interface PasswordVaultItem extends BaseVaultItem {
	type: "password";
	username: string;
	password: string;
	url?: string;
	notes?: string;
}

export interface CardVaultItem extends BaseVaultItem {
	type: "card";
	subtype: CardSubtype;
	cardholderName: string;
	number: string;
	expirationDate?: string;
	issueDate?: string;
	country?: string;
	issuingAuthority?: string;
	pin?: string;
	cvv?: string;
	notes?: string;
}

export interface TotpVaultItem extends BaseVaultItem {
	type: "totp";
	issuer: string;
	accountName: string;
	secret: string;
	algorithm?: "SHA1" | "SHA256" | "SHA512";
	digits?: number;
	period?: number;
	notes?: string;
}

export interface NoteVaultItem extends BaseVaultItem {
	type: "note";
	content: string;
	notes?: string;
}

export interface PersonalInfoVaultItem extends BaseVaultItem {
	type: "personal_info";
	fullName: string;
	birthDate?: string;
	age?: number;
	gender?: string;
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	stateProvince?: string;
	postalCode?: string;
	country?: string;
	phone?: string;
	email?: string;
	notes?: string;
}

export type VaultItem = PasswordVaultItem | CardVaultItem | TotpVaultItem | NoteVaultItem | PersonalInfoVaultItem;

export interface VaultMetadata {
	vaultId: string;
	version: number;
	saltHex: string;
	params: {
		algorithm: "AES-256-GCM";
		kdf: "Argon2id" | "PBKDF2";
		iterations: number;
	};
}

export interface EncryptedVaultPayload {
	ivHex: string;
	ciphertextHex: string;
	tagHex: string;
}
