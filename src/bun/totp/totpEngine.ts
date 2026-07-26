import * as OTPAuth from "otpauth";

export interface TotpStatus {
	code: string;
	formattedCode: string;
	period: number;
	remainingSeconds: number;
	progressPercent: number;
}

export function generateTotpStatus(
	secret: string,
	period = 30,
	digits = 6,
	algorithm: "SHA1" | "SHA256" | "SHA512" = "SHA1",
): TotpStatus {
	try {
		const cleanSecret = secret.replace(/\s+/g, "").toUpperCase();
		const totp = new OTPAuth.TOTP({
			secret: OTPAuth.Secret.fromBase32(cleanSecret),
			algorithm,
			digits,
			period,
		});

		const code = totp.generate();
		const nowSeconds = Math.floor(Date.now() / 1000);
		const remainingSeconds = period - (nowSeconds % period);
		const progressPercent = Math.round((remainingSeconds / period) * 100);

		// Format code into 3-digit groups (e.g. 482 901)
		const mid = Math.ceil(code.length / 2);
		const formattedCode = `${code.slice(0, mid)} ${code.slice(mid)}`;

		return {
			code,
			formattedCode,
			period,
			remainingSeconds,
			progressPercent,
		};
	} catch (e) {
		console.error("TOTP generation error:", e);
		return {
			code: "000000",
			formattedCode: "000 000",
			period,
			remainingSeconds: 0,
			progressPercent: 0,
		};
	}
}

export function parseOtpauthUrl(url: string): {
	issuer: string;
	accountName: string;
	secret: string;
	digits?: number;
	period?: number;
} | null {
	try {
		const parsed = OTPAuth.URI.parse(url);
		if (parsed instanceof OTPAuth.TOTP) {
			return {
				issuer: parsed.issuer || "Unknown Provider",
				accountName: parsed.label || "Account",
				secret: parsed.secret.base32,
				digits: parsed.digits,
				period: parsed.period,
			};
		}
		return null;
	} catch (e) {
		console.error("Failed to parse OTPAuth URL:", e);
		return null;
	}
}
