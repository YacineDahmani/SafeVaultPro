export type VaultItemType = "password" | "card" | "totp" | "note" | "personal_info" | "env";

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
	nin?: string;
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

export interface EnvVaultItem extends BaseVaultItem {
	type: "env";
	content: string;
	environment?: string;
	project?: string;
	notes?: string;
}

export interface PersonalInfoVaultItem extends BaseVaultItem {
	type: "personal_info";
	firstName?: string;
	lastName?: string;
	fullName: string;
	firstNameArabic?: string;
	lastNameArabic?: string;
	fullNameArabic?: string;
	birthDate?: string;
	age?: number | string;
	gender?: string;
	nationalId?: string;
	nin?: string;
	addressLine1?: string;
	addressLine2?: string;
	city?: string;
	stateProvince?: string;
	postalCode?: string;
	country?: string;
	phone?: string;
	email?: string;
	extraPhones?: { label?: string; phone: string }[];
	extraEmails?: { label?: string; email: string }[];
	notes?: string;
}

export type VaultItem =
	| PasswordVaultItem
	| CardVaultItem
	| TotpVaultItem
	| NoteVaultItem
	| PersonalInfoVaultItem
	| EnvVaultItem;

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
