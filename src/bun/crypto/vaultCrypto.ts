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
		// Enforce Argon2id key derivation
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
		console.error("Argon2id key derivation error:", e);
		throw new Error("Failed to derive master cryptographic key using Argon2id.");
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

function getRandomChar(charset: string): string {
	const len = charset.length;
	const maxValid = 256 - (256 % len);
	const buf = new Uint8Array(1);
	while (true) {
		crypto.getRandomValues(buf);
		if (buf[0] < maxValid) {
			return charset[buf[0] % len];
		}
	}
}

export function generatePassword(options?: {
	length?: number;
	uppercase?: boolean;
	lowercase?: boolean;
	numbers?: boolean;
	symbols?: boolean;
}): string {
	const length = Math.max(options?.length ?? 20, 8);
	const uppercase = options?.uppercase ?? true;
	const lowercase = options?.lowercase ?? true;
	const numbers = options?.numbers ?? true;
	const symbols = options?.symbols ?? true;

	const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
	const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const NUMBERS = "0123456789";
	const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

	let charset = "";
	const requiredChars: string[] = [];

	if (lowercase) {
		charset += LOWERCASE;
		requiredChars.push(getRandomChar(LOWERCASE));
	}
	if (uppercase) {
		charset += UPPERCASE;
		requiredChars.push(getRandomChar(UPPERCASE));
	}
	if (numbers) {
		charset += NUMBERS;
		requiredChars.push(getRandomChar(NUMBERS));
	}
	if (symbols) {
		charset += SYMBOLS;
		requiredChars.push(getRandomChar(SYMBOLS));
	}

	if (!charset) {
		charset = LOWERCASE + UPPERCASE + NUMBERS;
		requiredChars.push(getRandomChar(LOWERCASE));
	}

	const resultChars: string[] = [...requiredChars];
	const remaining = length - resultChars.length;
	for (let i = 0; i < remaining; i++) {
		resultChars.push(getRandomChar(charset));
	}

	// Cryptographic Fisher-Yates shuffle with unbiased sampling
	const randIndexBuf = new Uint8Array(1);
	for (let i = resultChars.length - 1; i > 0; i--) {
		const range = i + 1;
		const maxValid = 256 - (256 % range);
		let j: number;
		while (true) {
			crypto.getRandomValues(randIndexBuf);
			if (randIndexBuf[0] < maxValid) {
				j = randIndexBuf[0] % range;
				break;
			}
		}
		const temp = resultChars[i];
		resultChars[i] = resultChars[j];
		resultChars[j] = temp;
	}

	return resultChars.join("");
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
