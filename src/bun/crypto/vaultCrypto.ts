import { argon2id } from "hash-wasm";
import type { EncryptedVaultPayload } from "../types";

const SALT_SIZE = 16;
const IV_SIZE = 12;

function bufToHex(buffer: Uint8Array): string {
	return Array.from(buffer)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function hexToBuf(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

export function generateSaltHex(): string {
	const salt = new Uint8Array(SALT_SIZE);
	crypto.getRandomValues(salt);
	return bufToHex(salt);
}

export async function deriveMasterKey(
	password: string,
	saltHex: string,
): Promise<CryptoKey> {
	const salt = hexToBuf(saltHex);

	let rawKey: Uint8Array;
	try {
		// Use Argon2id via hash-wasm for high security key derivation
		const hashHex = await argon2id({
			password,
			salt,
			parallelism: 1,
			memorySize: 65536, // 64 MB
			iterations: 3,
			hashLength: 32, // 256 bits
			outputType: "hex",
		});
		rawKey = hexToBuf(hashHex);
	} catch (e) {
		console.warn("Argon2id fallback to PBKDF2:", e);
		const enc = new TextEncoder();
		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			enc.encode(password),
			"PBKDF2",
			false,
			["deriveBits"],
		);
		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: "PBKDF2",
				salt: salt as BufferSource,
				iterations: 100000,
				hash: "SHA-256",
			},
			keyMaterial,
			256,
		);
		rawKey = new Uint8Array(derivedBits);
	}

	return await crypto.subtle.importKey(
		"raw",
		rawKey as BufferSource,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

export async function encryptVaultData(
	data: unknown,
	key: CryptoKey,
): Promise<EncryptedVaultPayload> {
	const enc = new TextEncoder();
	const plaintext = enc.encode(JSON.stringify(data));
	const iv = new Uint8Array(IV_SIZE);
	crypto.getRandomValues(iv);

	const ciphertextWithTag = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: iv as BufferSource },
		key,
		plaintext,
	);

	const cipherArray = new Uint8Array(ciphertextWithTag);
	// AES-GCM tag is the last 16 bytes in WebCrypto output
	const ciphertext = cipherArray.slice(0, cipherArray.length - 16);
	const tag = cipherArray.slice(cipherArray.length - 16);

	return {
		ivHex: bufToHex(iv),
		ciphertextHex: bufToHex(ciphertext),
		tagHex: bufToHex(tag),
	};
}

export async function decryptVaultData<T = unknown>(
	payload: EncryptedVaultPayload,
	key: CryptoKey,
): Promise<T> {
	const iv = hexToBuf(payload.ivHex);
	const ciphertext = hexToBuf(payload.ciphertextHex);
	const tag = hexToBuf(payload.tagHex);

	// Reconstruct WebCrypto payload (ciphertext + tag)
	const combined = new Uint8Array(ciphertext.length + tag.length);
	combined.set(ciphertext, 0);
	combined.set(tag, ciphertext.length);

	const decryptedBuffer = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: iv as BufferSource },
		key,
		combined as BufferSource,
	);

	const dec = new TextDecoder();
	const plaintext = dec.decode(decryptedBuffer);
	return JSON.parse(plaintext) as T;
}

export function generatePassword(options?: {
	length?: number;
	uppercase?: boolean;
	lowercase?: boolean;
	numbers?: boolean;
	symbols?: boolean;
}): string {
	const length = options?.length ?? 20;
	const uppercase = options?.uppercase ?? true;
	const lowercase = options?.lowercase ?? true;
	const numbers = options?.numbers ?? true;
	const symbols = options?.symbols ?? true;

	let charset = "";
	if (lowercase) charset += "abcdefghijklmnopqrstuvwxyz";
	if (uppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	if (numbers) charset += "0123456789";
	if (symbols) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";

	if (!charset) charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let result = "";
	for (let i = 0; i < length; i++) {
		result += charset[bytes[i] % charset.length];
	}
	return result;
}

export function calculatePasswordEntropy(password: string): number {
	if (!password) return 0;
	let poolSize = 0;
	if (/[a-z]/.test(password)) poolSize += 26;
	if (/[A-Z]/.test(password)) poolSize += 26;
	if (/[0-9]/.test(password)) poolSize += 10;
	if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

	if (poolSize === 0) return 0;
	return Math.round(password.length * Math.log2(poolSize));
}
