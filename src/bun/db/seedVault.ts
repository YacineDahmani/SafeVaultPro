import type { VaultItem } from "../types";

export function getInitialSeedItems(): VaultItem[] {
	const now = Date.now();

	return [
		{
			id: "seed-password-1",
			type: "password",
			title: "GitHub Developer Portal",
			username: "dev.user@safevault.internal",
			password: "ghp_xK92mQz84vLpWn731Yt90BvXc1928374",
			url: "https://github.com/settings/tokens",
			favorite: true,
			tags: ["Development", "Cloud"],
			notes: "Personal access token with repo and workflow permissions.",
			createdAt: now - 86400000 * 15,
			updatedAt: now - 86400000 * 2,
		},
		{
			id: "seed-card-passport",
			type: "card",
			subtype: "passport",
			title: "Primary International Passport",
			cardholderName: "full name",
			number: "P892104928",
			country: "United States",
			issueDate: "2022-05-14",
			expirationDate: "2032-05-13",
			issuingAuthority: "Department of State",
			favorite: true,
			tags: ["Identity", "Travel"],
			notes: "Primary 10-year passport. Keep digital copy secure.",
			createdAt: now - 86400000 * 30,
			updatedAt: now - 86400000 * 5,
		},
		{
			id: "seed-card-id",
			type: "card",
			subtype: "id_card",
			title: "National Identity Card",
			cardholderName: "full name",
			number: "ID-90812-441-A",
			country: "United States",
			issueDate: "2023-01-10",
			expirationDate: "2028-01-09",
			issuingAuthority: "National Reg Authority",
			pin: "8841",
			favorite: false,
			tags: ["Identity", "Official"],
			notes: "Official biometric identity card.",
			createdAt: now - 86400000 * 20,
			updatedAt: now - 86400000 * 10,
		},
		{
			id: "seed-card-credit",
			type: "card",
			subtype: "credit_card",
			title: "Corporate Emerald Visa",
			cardholderName: "full name",
			number: "4532 9012 8841 0092",
			expirationDate: "2028-05-15",
			cvv: "884",
			favorite: true,
			tags: ["Payment", "Finance", "Corporate"],
			notes: "Primary business expense corporate card.",
			createdAt: now - 86400000 * 18,
			updatedAt: now - 86400000 * 4,
		},
		{
			id: "seed-totp-1",
			type: "totp",
			title: "AWS Root Console 2FA",
			issuer: "Amazon Web Services",
			accountName: "admin@cloud-infrastructure.io",
			secret: "JBSWY3DPEHPK3PXP",
			favorite: true,
			tags: ["Cloud", "Infrastructure"],
			notes: "Primary root MFA token for cloud production infrastructure.",
			createdAt: now - 86400000 * 45,
			updatedAt: now - 86400000 * 1,
		},
		{
			id: "seed-note-1",
			type: "note",
			title: "Infrastructure Master Emergency Recovery Keys",
			content: `SAFEVAULT HIGH-SECURITY EMERGENCY ACCESS CODES
=============================================
1. 8839-1029-4412-9018
2. 7712-0091-2234-8871
3. 9912-3341-6672-1109
4. 4410-5591-8823-7761

Store in an offsite physical safe. Requires dual authorization to rotate.`,
			favorite: false,
			tags: ["Security", "Emergency"],
			notes: "Encrypted recovery payload.",
			createdAt: now - 86400000 * 60,
			updatedAt: now - 86400000 * 12,
		},
		{
			id: "seed-personal-info-1",
			type: "personal_info",
			title: "Personal Primary Identity Profile",
			fullName: "name Vance Vault",
			birthDate: "1994-08-22",
			age: 31,
			gender: "Male",
			addressLine1: "742 Evergreen Terr, Suite 400",
			city: "San Francisco",
			stateProvince: "California",
			postalCode: "94107",
			country: "United States",
			phone: "+1 (555) 019-2834",
			email: "name.vault@proton.me",
			favorite: true,
			tags: ["Personal", "Identity"],
			notes: "Primary personal profile for official identity reference.",
			createdAt: now - 86400000 * 25,
			updatedAt: now - 86400000 * 3,
		},
		{
			id: "seed-env-1",
			type: "env",
			title: "Production Core API Server .env",
			project: "SafeVaultPro Backend",
			environment: "Production",
			content: `PORT=48920
NODE_ENV=production
DATABASE_URL=sqlite://data/vault.db
SQLCIPHER_KEY_KDF=argon2id
JWT_SECRET=super_secret_argon2id_jwt_key_982341
REDIS_HOST=127.0.0.1
REDIS_PORT=6379`,
			favorite: true,
			tags: ["Development", "Production", "Backend"],
			notes: "Core production environment variables for local backend services.",
			createdAt: now - 86400000 * 10,
			updatedAt: now - 86400000 * 1,
		},
	];
}
