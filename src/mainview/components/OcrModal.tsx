import React, { useState } from "react";
import { X, QrCode, Upload, Check, AlertCircle } from "lucide-react";
import { vaultBackend } from "../../bun/vaultBackendApi";
import type { VaultItem } from "../../bun/types";

interface OcrModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSaveItem: (item: VaultItem) => Promise<VaultItem>;
}

export const OcrModal: React.FC<OcrModalProps> = ({ isOpen, onClose, onSaveItem }) => {
	const [statusMsg, setStatusMsg] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [parsedResult, setParsedResult] = useState<{
		issuer: string;
		accountName: string;
		secret: string;
	} | null>(null);

	if (!isOpen) return null;

	const handleFileSelect = async (file: File) => {
		setIsProcessing(true);
		setStatusMsg("Parsing QR code image...");
		setParsedResult(null);

		try {
			const res = await vaultBackend.scanQrBlob(file);
			if (res && res.secret) {
				setParsedResult({
					issuer: res.issuer || "Scanned Service",
					accountName: res.accountName || "Account",
					secret: res.secret,
				});
				setStatusMsg("QR Code parsed successfully!");
			} else {
				setStatusMsg("No valid 2FA QR code (otpauth://) found in image.");
			}
		} catch (err: any) {
			setStatusMsg(`Error parsing QR code: ${err.message}`);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleSaveImported = async () => {
		if (!parsedResult) return;
		const newItem: VaultItem = {
			id: `totp-ocr-${Date.now()}`,
			type: "totp",
			title: `${parsedResult.issuer} (${parsedResult.accountName})`,
			issuer: parsedResult.issuer,
			accountName: parsedResult.accountName,
			secret: parsedResult.secret,
			favorite: true,
			tags: ["2FA", "Scanned"],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		await onSaveItem(newItem);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
			<div className="bg-[#131315] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-slate-200 space-y-4">
				<div className="flex items-center justify-between pb-3 border-b border-slate-800">
					<div className="flex items-center gap-2">
						<QrCode className="w-5 h-5 text-blue-400" />
						<h2 className="text-base font-bold text-white tracking-wide">Scan 2FA QR Code</h2>
					</div>
					<button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Upload box */}
				<label className="border-2 border-dashed border-slate-800 hover:border-blue-500/60 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-[#09090b] transition-all">
					<Upload className="w-8 h-8 text-blue-400 mb-2 animate-bounce" />
					<span className="text-xs font-semibold text-slate-300">Select QR code image</span>
					<span className="text-[10px] text-slate-500 font-mono mt-1">PNG, JPG, WEBP</span>
					<input
						type="file"
						accept="image/*"
						onChange={(e) => {
							if (e.target.files && e.target.files[0]) {
								handleFileSelect(e.target.files[0]);
							}
						}}
						className="hidden"
					/>
				</label>

				{statusMsg && (
					<p className="text-xs text-center font-mono text-slate-400">{statusMsg}</p>
				)}

				{/* Parsed Result Display */}
				{parsedResult && (
					<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
						<div className="text-emerald-400 font-bold flex items-center gap-1.5">
							<Check className="w-4 h-4" />
							<span>Secret Found</span>
						</div>
						<div><span className="text-slate-500">Issuer:</span> {parsedResult.issuer}</div>
						<div><span className="text-slate-500">Account:</span> {parsedResult.accountName}</div>
						<div><span className="text-slate-500">Secret:</span> {parsedResult.secret}</div>

						<button
							onClick={handleSaveImported}
							className="w-full mt-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-bold rounded-lg transition-all"
						>
							Save 2FA Code
						</button>
					</div>
				)}
			</div>
		</div>
	);
};
