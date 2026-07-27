import React, { useState } from "react";
import { X, Settings, Shield, Download, Upload, Cpu, Clock, KeyRound, Check } from "lucide-react";
import { getVaultMetadata } from "../../bun/db/vaultStorage";

interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
	onShowToast: (msg: string, type?: "success" | "info" | "warning") => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
	isOpen,
	onClose,
	onShowToast,
}) => {
	const metadata = getVaultMetadata();
	const [autoClearSeconds, setAutoClearSeconds] = useState(30);

	if (!isOpen) return null;

	const handleExportBackup = () => {
		const store = localStorage.getItem("safevault_encrypted_store");
		const meta = localStorage.getItem("safevault_metadata");
		if (!store || !meta) {
			onShowToast("No vault data available for export.", "warning");
			return;
		}

		const backupPayload = {
			metadata: JSON.parse(meta),
			encryptedStore: JSON.parse(store),
			exportedAt: new Date().toISOString(),
		};

		const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `SafeVaultPro_Backup_${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);

		onShowToast("Encrypted vault backup downloaded successfully!", "success");
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
			<div className="bg-[#131315] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-slate-200 space-y-6">
				<div className="flex items-center justify-between pb-3 border-b border-slate-800">
					<div className="flex items-center gap-2">
						<Settings className="w-5 h-5 text-emerald-400" />
						<h2 className="text-base font-bold text-white tracking-wide">Vault & Cryptographic Settings</h2>
					</div>
					<button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Encryption specs */}
				<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
					<div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
						<Shield className="w-4 h-4 text-emerald-400" />
						<span>Cryptographic Architecture</span>
					</div>
					<div className="flex justify-between"><span className="text-slate-500">Cipher Algorithm:</span> <span className="text-emerald-400 font-bold">AES-256-GCM</span></div>
					<div className="flex justify-between"><span className="text-slate-500">Key Derivation (KDF):</span> <span className="text-emerald-400 font-bold">Argon2id (64MB)</span></div>
					<div className="flex justify-between"><span className="text-slate-500">Vault Version:</span> <span className="text-white">{metadata?.version || 1}</span></div>
					<div className="flex justify-between"><span className="text-slate-500">Storage Layer:</span> <span className="text-white">Local Encrypted Store</span></div>
				</div>

				{/* Clipboard Auto Clear */}
				<div className="space-y-2">
					<div className="flex justify-between text-xs font-medium">
						<span className="text-slate-300 flex items-center gap-1.5">
							<Clock className="w-4 h-4 text-blue-400" />
							<span>Clipboard Auto-Clear Delay</span>
						</span>
						<span className="font-mono text-emerald-400 font-bold tnum">{autoClearSeconds}s</span>
					</div>
					<input
						type="range"
						min={10}
						max={60}
						step={5}
						value={autoClearSeconds}
						onChange={(e) => setAutoClearSeconds(Number(e.target.value))}
						className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
					/>
				</div>

				{/* Backup & Portability */}
				<div className="space-y-3 pt-2">
					<h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
						Backup & Data Portability
					</h4>
					<button
						onClick={handleExportBackup}
						className="w-full py-2.5 bg-[#1c1b1d] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
					>
						<Download className="w-4 h-4 text-emerald-400" />
						<span>Export Encrypted JSON Backup</span>
					</button>
				</div>
			</div>
		</div>
	);
};
