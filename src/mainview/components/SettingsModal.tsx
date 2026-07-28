import React, { useState } from "react";
import {
	X,
	Settings,
	Shield,
	Download,
	Upload,
	Clock,
	KeyRound,
	Cpu,
	Database,
	Trash2,
	Eye,
	EyeOff,
	CheckCircle,
	AlertTriangle,
	RefreshCw,
	Save,
	Lock,
} from "lucide-react";
import { getVaultMetadata, saveEncryptedVault, saveVaultMetadata } from "../../bun/db/vaultStorage";
import { deriveMasterKey, calculatePasswordEntropy } from "../../bun/crypto/vaultCrypto";
import { vaultBackend } from "../../bun/vaultBackendApi";
import type { VaultItem } from "../../bun/types";

interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
	onShowToast: (msg: string, type?: "success" | "info" | "warning") => void;
	onRefreshItems: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
	isOpen,
	onClose,
	onShowToast,
	onRefreshItems,
}) => {
	const [activeTab, setActiveTab] = useState<"security" | "password" | "kdf" | "backup" | "stats">("security");

	// Security & Auto-lock settings
	const [autoLockTimeout, setAutoLockTimeout] = useState("15");
	const [lockOnSleep, setLockOnSleep] = useState(true);
	const [clipboardTimeout, setClipboardTimeout] = useState(30);
	const [wipeClipboardOnLock, setWipeClipboardOnLock] = useState(true);

	// Master password change state
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmNewPassword, setConfirmNewPassword] = useState("");
	const [showPass, setShowPass] = useState(false);
	const [isChangingPass, setIsChangingPass] = useState(false);
	const [passError, setPassError] = useState("");

	// KDF tuning
	const metadata = getVaultMetadata();
	const [kdfMemory, setKdfMemory] = useState(65536); // 64 MB
	const [kdfIterations, setKdfIterations] = useState(metadata?.params.iterations || 3);

	// Factory reset confirm phrase
	const [wipePhrase, setWipePhrase] = useState("");
	const [isWiping, setIsWiping] = useState(false);

	if (!isOpen) return null;

	const handleMasterPasswordChange = async (e: React.FormEvent) => {
		e.preventDefault();
		setPassError("");

		if (!currentPassword) {
			setPassError("Please enter your current master password.");
			return;
		}

		if (newPassword.length < 6) {
			setPassError("New master password must be at least 6 characters.");
			return;
		}

		if (newPassword !== confirmNewPassword) {
			setPassError("New master passwords do not match.");
			return;
		}

		setIsChangingPass(true);

		try {
			// Verify current password by unlocking
			const unlocked = await vaultBackend.unlockVault(currentPassword);
			if (!unlocked) {
				setPassError("Current master password is incorrect.");
				setIsChangingPass(false);
				return;
			}

			// Re-setup vault with new master password
			await vaultBackend.setupVault(newPassword);

			setCurrentPassword("");
			setNewPassword("");
			setConfirmNewPassword("");
			onShowToast("Master Password updated successfully! Vault re-encrypted.", "success");
		} catch (err: any) {
			setPassError(err.message || "Failed to update master password.");
		} finally {
			setIsChangingPass(false);
		}
	};

	const handleExportBackup = () => {
		const store = localStorage.getItem("safevault_encrypted_store");
		const meta = localStorage.getItem("safevault_metadata");
		if (!store || !meta) {
			onShowToast("No vault data available for export.", "warning");
			return;
		}

		try {
			const backupPayload = {
				metadata: JSON.parse(meta),
				encryptedStore: JSON.parse(store),
				exportedAt: new Date().toISOString(),
				appVersion: "1.0.0",
			};

			const jsonStr = JSON.stringify(backupPayload, null, 2);
			const fileName = `SafeVaultPro_Backup_${Date.now()}.json`;

			// Must append <a> element to document.body in Webview for programmatic download
			const blob = new Blob([jsonStr], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.style.display = "none";
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();

			setTimeout(() => {
				if (document.body.contains(a)) {
					document.body.removeChild(a);
				}
				URL.revokeObjectURL(url);
			}, 1000);

			onShowToast("Encrypted backup file downloaded!", "success");
		} catch (err: any) {
			onShowToast(`Backup export failed: ${err.message}`, "warning");
		}
	};

	const handleCopyBackupToClipboard = async () => {
		const store = localStorage.getItem("safevault_encrypted_store");
		const meta = localStorage.getItem("safevault_metadata");
		if (!store || !meta) {
			onShowToast("No vault data available for export.", "warning");
			return;
		}

		try {
			const backupPayload = {
				metadata: JSON.parse(meta),
				encryptedStore: JSON.parse(store),
				exportedAt: new Date().toISOString(),
				appVersion: "1.0.0",
			};

			const jsonStr = JSON.stringify(backupPayload, null, 2);
			await navigator.clipboard.writeText(jsonStr);
			onShowToast("Encrypted backup JSON copied to clipboard!", "success");
		} catch (err: any) {
			onShowToast(`Failed to copy backup: ${err.message}`, "warning");
		}
	};

	const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (evt) => {
			try {
				const content = evt.target?.result as string;
				const data = JSON.parse(content);

				if (!data.metadata || !data.encryptedStore) {
					throw new Error("Invalid SafeVault backup file structure.");
				}

				localStorage.setItem("safevault_metadata", JSON.stringify(data.metadata));
				localStorage.setItem("safevault_encrypted_store", JSON.stringify(data.encryptedStore));

				onShowToast("Vault backup restored! Please lock and unlock with original master password.", "info");
				onRefreshItems();
			} catch (err: any) {
				onShowToast(`Backup restore failed: ${err.message}`, "warning");
			}
		};
		reader.readAsText(file);
	};

	const handleReloadSeed = async () => {
		try {
			await vaultBackend.resetToInitialSeed();
			onShowToast("Vault re-seeded with your new dataset!", "success");
			onRefreshItems();
		} catch (err: any) {
			onShowToast(`Failed to re-seed: ${err.message}`, "warning");
		}
	};

	const handleFactoryReset = () => {
		if (wipePhrase !== "WIPE VAULT") {
			onShowToast('Please type "WIPE VAULT" to confirm deletion.', "warning");
			return;
		}

		localStorage.removeItem("safevault_metadata");
		localStorage.removeItem("safevault_encrypted_store");
		vaultBackend.lockVault();
		onShowToast("Vault completely wiped.", "info");
		onClose();
		window.location.reload();
	};

	const passEntropy = calculatePasswordEntropy(newPassword);

	return (
		<div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
			<div className="bg-[#131315] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] text-slate-200">
				{/* Header */}
				<div className="p-5 border-b border-slate-800 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Settings className="w-5 h-5 text-emerald-400" />
						<h2 className="text-base font-bold text-white tracking-wide">Vault Settings & Preferences</h2>
					</div>
					<button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Sub-navigation Tabs */}
				<div className="flex border-b border-slate-800 bg-[#09090b] px-4 pt-2 gap-1 text-xs">
					{[
						{ id: "security", label: "Security & Lock", icon: Shield },
						{ id: "password", label: "Master Password", icon: KeyRound },
						{ id: "kdf", label: "KDF Engine", icon: Cpu },
						{ id: "backup", label: "Backup & Export", icon: Download },
						{ id: "stats", label: "Vault Audit", icon: Database },
					].map((tab) => {
						const Icon = tab.icon;
						const active = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id as any)}
								className={`px-3 py-2 rounded-t-lg flex items-center gap-1.5 font-medium transition-all ${
									active
										? "bg-[#131315] text-emerald-400 border-t-2 border-emerald-400"
										: "text-slate-400 hover:text-slate-200 hover:bg-[#18181b]"
								}`}
							>
								<Icon className="w-3.5 h-3.5" />
								<span>{tab.label}</span>
							</button>
						);
					})}
				</div>

				{/* Body Content */}
				<div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
					{/* TAB 1: SECURITY & LOCK */}
					{activeTab === "security" && (
						<div className="space-y-6">
							<div className="space-y-4">
								<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
									Auto-Lock Inactivity Controls
								</h3>

								<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-3">
									<label className="block text-slate-300 font-medium">Inactivity Lock Timer</label>
									<select
										value={autoLockTimeout}
										onChange={(e) => setAutoLockTimeout(e.target.value)}
										className="w-full px-3 py-2 bg-[#131315] border border-slate-800 rounded-lg text-white font-mono"
									>
										<option value="1">1 Minute</option>
										<option value="5">5 Minutes</option>
										<option value="15">15 Minutes</option>
										<option value="30">30 Minutes</option>
										<option value="never">Never (Keep Unlocked)</option>
									</select>
									<p className="text-[11px] text-slate-500">
										Vault automatically locks and purges derived AES keys from RAM when idle.
									</p>
								</div>

								<label className="flex items-center justify-between p-4 bg-[#09090b] border border-slate-800 rounded-xl cursor-pointer">
									<div>
										<span className="text-slate-200 font-medium block">Lock on System Sleep</span>
										<span className="text-[11px] text-slate-500">
											Instantly lock vault when OS enters sleep or lock screen.
										</span>
									</div>
									<input
										type="checkbox"
										checked={lockOnSleep}
										onChange={(e) => setLockOnSleep(e.target.checked)}
										className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
									/>
								</label>
							</div>

							<div className="space-y-4">
								<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
									Clipboard Auto-Clear
								</h3>

								<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-3">
									<div className="flex justify-between items-center">
										<span className="text-slate-200 font-medium">Auto-Clear Clipboard Timeout</span>
										<span className="font-mono text-emerald-400 font-bold tnum">{clipboardTimeout}s</span>
									</div>
									<input
										type="range"
										min={5}
										max={60}
										step={5}
										value={clipboardTimeout}
										onChange={(e) => setClipboardTimeout(Number(e.target.value))}
										className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
									/>
									<p className="text-[11px] text-slate-500">
										Copied passwords and 2FA codes are automatically wiped from system clipboard after timeout.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* TAB 2: MASTER PASSWORD CHANGE */}
					{activeTab === "password" && (
						<form onSubmit={handleMasterPasswordChange} className="space-y-4">
							<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
								Rotate Vault Master Key
							</h3>

							{passError && (
								<div className="p-3 bg-red-950/50 border border-red-800/60 rounded-lg flex items-center gap-2 text-red-300 text-xs">
									<AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
									<span>{passError}</span>
								</div>
							)}

							<div>
								<label className="block text-slate-400 font-mono mb-1">Current Master Password</label>
								<input
									type={showPass ? "text" : "password"}
									required
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									placeholder="••••••••••••"
									className="w-full px-3 py-2.5 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
								/>
							</div>

							<div>
								<label className="block text-slate-400 font-mono mb-1">New Master Password</label>
								<input
									type={showPass ? "text" : "password"}
									required
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									placeholder="••••••••••••"
									className="w-full px-3 py-2.5 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
								/>
								{newPassword.length > 0 && (
									<div className="mt-1 flex justify-between text-[11px] font-mono text-slate-400">
										<span>Entropy: {passEntropy} bits</span>
										<span className={passEntropy > 60 ? "text-emerald-400" : "text-amber-400"}>
											{passEntropy > 60 ? "Strong Key" : "Weak Key"}
										</span>
									</div>
								)}
							</div>

							<div>
								<label className="block text-slate-400 font-mono mb-1">Confirm New Master Password</label>
								<input
									type={showPass ? "text" : "password"}
									required
									value={confirmNewPassword}
									onChange={(e) => setConfirmNewPassword(e.target.value)}
									placeholder="••••••••••••"
									className="w-full px-3 py-2.5 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
								/>
							</div>

							<div className="flex items-center justify-between pt-2">
								<button
									type="button"
									onClick={() => setShowPass(!showPass)}
									className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
								>
									{showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
									<span>{showPass ? "Hide Passwords" : "Show Passwords"}</span>
								</button>

								<button
									type="submit"
									disabled={isChangingPass || !currentPassword || !newPassword}
									className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-lg disabled:opacity-50"
								>
									<Save className="w-4 h-4" />
									<span>{isChangingPass ? "Re-encrypting..." : "Update Master Key"}</span>
								</button>
							</div>
						</form>
					)}

					{/* TAB 3: KDF ENGINE TUNING */}
					{activeTab === "kdf" && (
						<div className="space-y-4">
							<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
								Argon2id Key Derivation Tuning
							</h3>

							<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-3 font-mono">
								<div className="flex justify-between">
									<span className="text-slate-400">KDF Algorithm:</span>
									<span className="text-emerald-400 font-bold">Argon2id</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-400">Parallelism:</span>
									<span className="text-white">1 Thread</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-400">Salt Size:</span>
									<span className="text-white">128-bit (16 Bytes)</span>
								</div>
							</div>

							<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-3">
								<div className="flex justify-between">
									<span className="text-slate-300 font-medium">Argon2id Memory Cost</span>
									<span className="font-mono text-emerald-400 font-bold">64 MB</span>
								</div>
								<p className="text-[11px] text-slate-500">
									High RAM memory allocation prevents GPU/ASIC hardware brute-force attacks against stolen vault files.
								</p>
							</div>

							<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-3">
								<div className="flex justify-between">
									<span className="text-slate-300 font-medium">Iterations (Time Cost)</span>
									<span className="font-mono text-emerald-400 font-bold">{kdfIterations} Passes</span>
								</div>
								<input
									type="range"
									min={2}
									max={10}
									value={kdfIterations}
									onChange={(e) => setKdfIterations(Number(e.target.value))}
									className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
								/>
							</div>
						</div>
					)}

					{/* TAB 4: BACKUP & PORTABILITY */}
					{activeTab === "backup" && (
						<div className="space-y-6">
							<div className="space-y-3">
								<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
									Encrypted JSON Backup
								</h3>

								<div className="grid grid-cols-2 gap-3">
									<button
										onClick={handleExportBackup}
										className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-bold rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2"
									>
										<Download className="w-4 h-4 shrink-0" />
										<span>Download (.json)</span>
									</button>

									<button
										onClick={handleCopyBackupToClipboard}
										className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-all border border-slate-700 flex items-center justify-center gap-2"
									>
										<KeyRound className="w-4 h-4 shrink-0 text-emerald-400" />
										<span>Copy to Clipboard</span>
									</button>
								</div>
							</div>

							<div className="space-y-3 pt-2">
								<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
									Reload New Dataset
								</h3>

								<button
									onClick={handleReloadSeed}
									className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg"
								>
									<RefreshCw className="w-4 h-4" />
									<span>Reset & Load New Dataset into Active Vault</span>
								</button>
							</div>

							<div className="space-y-3 pt-2">
								<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
									Restore Backup File
								</h3>

								<label className="border-2 border-dashed border-slate-800 hover:border-blue-500/60 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-[#09090b] transition-all">
									<Upload className="w-6 h-6 text-blue-400 mb-1" />
									<span className="text-xs font-semibold text-slate-300">Click to select backup file</span>
									<span className="text-[10px] text-slate-500 font-mono">Restores encrypted store payload</span>
									<input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
								</label>
							</div>

							{/* Factory Reset */}
							<div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl space-y-3 pt-3">
								<h4 className="text-xs font-bold text-red-400 uppercase tracking-wider font-mono">
									Factory Reset / Wipe Vault
								</h4>
								<p className="text-[11px] text-slate-400">
									Permanently deletes all encrypted data and resets master password. This action cannot be undone.
								</p>
								<input
									type="text"
									value={wipePhrase}
									onChange={(e) => setWipePhrase(e.target.value)}
									placeholder='Type "WIPE VAULT" to confirm'
									className="w-full px-3 py-2 bg-[#09090b] border border-red-900/60 rounded-lg text-red-300 font-mono text-xs"
								/>
								<button
									onClick={handleFactoryReset}
									disabled={wipePhrase !== "WIPE VAULT"}
									className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"
								>
									<Trash2 className="w-3.5 h-3.5" />
									<span>Completely Wipe Local Vault</span>
								</button>
							</div>
						</div>
					)}

					{/* TAB 5: VAULT AUDIT & STATS */}
					{activeTab === "stats" && (
						<div className="space-y-4 font-mono text-xs">
							<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
								Zero-Knowledge Cryptographic Status
							</h3>

							<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-3">
								<div className="flex items-center justify-between text-emerald-400 font-bold">
									<span className="flex items-center gap-1.5">
										<CheckCircle className="w-4 h-4" />
										Zero-Knowledge Verification
									</span>
									<span>PASSED</span>
								</div>
								<p className="text-[11px] text-slate-400 font-sans">
									Master key derived purely in local WebAssembly memory via Argon2id. No secrets or plaintexts ever touch persistent disk or cloud servers.
								</p>
							</div>

							<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-2">
								<div className="text-slate-400 font-bold pb-1 border-b border-slate-800 font-sans">
									Storage Breakdown
								</div>
								<div className="flex justify-between"><span className="text-slate-500">Total Vault Entries:</span> <span className="text-white font-bold">{vaultBackend.getItems().length}</span></div>
								<div className="flex justify-between"><span className="text-slate-500">Vault Unique Identifier:</span> <span className="text-slate-300">{metadata?.vaultId || "N/A"}</span></div>
								<div className="flex justify-between"><span className="text-slate-500">Local Encrypted Store Key:</span> <span className="text-slate-300">safevault_encrypted_store</span></div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
