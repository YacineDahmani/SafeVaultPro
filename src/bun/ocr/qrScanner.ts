import jsQR from "jsqr";
import { parseOtpauthUrl } from "../totp/totpEngine";

export interface QrScanResult {
	rawText: string;
	totpConfig: ReturnType<typeof parseOtpauthUrl>;
}

export function scanQrCodeImageData(
	imageData: Uint8ClampedArray,
	width: number,
	height: number,
): QrScanResult | null {
	try {
		const code = jsQR(imageData, width, height);
		if (code && code.data) {
			const totpConfig = parseOtpauthUrl(code.data);
			return {
				rawText: code.data,
				totpConfig,
			};
		}
		return null;
	} catch (e) {
		console.error("QR Code scan error:", e);
		return null;
	}
}

export async function scanQrCodeFromBlob(blob: Blob): Promise<QrScanResult | null> {
	return new Promise((resolve) => {
		if (typeof Image === "undefined" || typeof document === "undefined") {
			resolve(null);
			return;
		}

		const img = new Image();
		const url = URL.createObjectURL(blob);

		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext("2d");

			if (!ctx) {
				URL.revokeObjectURL(url);
				resolve(null);
				return;
			}

			ctx.drawImage(img, 0, 0);
			const imageData = ctx.getImageData(0, 0, img.width, img.height);
			URL.revokeObjectURL(url);

			const result = scanQrCodeImageData(imageData.data, img.width, img.height);
			resolve(result);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};

		img.src = url;
	});
}
