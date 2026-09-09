import React, { useState, useEffect } from "react";
import {
	Shield,
	KeyRound,
	Cpu,
	Download,
	Upload,
	Trash2,
	Eye,
	EyeOff,
	CheckCircle2,
	AlertTriangle,
	RefreshCw,
	Save,
	Lock,
	ArrowLeft,
	Clock,
	Zap,
	Puzzle,
	Terminal,
	HardDrive,
	FolderOpen,
	Copy,
	Check,
	Activity,
	Radio,
	AlertOctagon,
	Sparkles,
} from "lucide-react";
import { getVaultMetadata, saveEncryptedVault, saveVaultMetadata } from "../../bun/db/vaultStorage";
import { deriveMasterKey, calculatePasswordEntropy, generateSaltHex } from "../../bun/crypto/vaultCrypto";
import { vaultBackend } from "../../bun/vaultBackendApi";
import type { VaultItem } from "../../bun/types";
import type { useVault } from "../hooks/useVault";

const BRIDGE_AUTH_TOKEN = "sv_tok_7c9e1b4f2a8d3e6a0b5c9d8e7f2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01";

interface SettingsViewProps {
	vault: ReturnType<typeof useVault>;
	onBack: () => void;
}

type SettingsSection = "security" | "password" | "kdf" | "backup" | "extension" | "diagnostics";

export const SettingsView: React.FC<SettingsViewProps> = ({ vault, onBack }) => {
	const [activeSection, setActiveSection] = useState<SettingsSection>("security");
	const { settings, updateSettings, showToast, refreshItems, allItems } = vault;

	// Master password rotation state
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmNewPassword, setConfirmNewPassword] = useState("");
	const [showPass, setShowPass] = useState(false);
	const [isChangingPass, setIsChangingPass] = useState(false);
	const [passError, setPassError] = useState("");

	// KDF live benchmark state
	const [isBenchmarking, setIsBenchmarking] = useState(false);
	const [benchmarkResult, setBenchmarkResult] = useState<{
		latencyMs: number;
		memoryMB: number;
		iterations: number;
		throughputMBs: number;
		securityGrade: string;
	} | null>(null);

	// Reload seed confirm modal state
	const [showReloadConfirmModal, setShowReloadConfirmModal] = useState(false);

	// Factory reset confirm phrase state
	const [wipePhrase, setWipePhrase] = useState("");
	const [isWiping, setIsWiping] = useState(false);

	// Bridge connection ping state
	const [isPingingBridge, setIsPingingBridge] = useState(false);
	const [bridgeStatus, setBridgeStatus] = useState<"unknown" | "online" | "offline">("unknown");
	const [bridgeLatency, setBridgeLatency] = useState<number | null>(null);
	const [copiedToken, setCopiedToken] = useState(false);

	// Handle Esc key to return to vault
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !showReloadConfirmModal) {
				onBack();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onBack, showReloadConfirmModal]);

	// Auto-test bridge connection on mount
	useEffect(() => {
		testBridgeConnection();
	}, []);

	const testBridgeConnection = async () => {
		setIsPingingBridge(true);
		const start = performance.now();
		try {
			const res = await fetch("http://localhost:48920/api/status", {
				headers: {
					Authorization: `Bearer ${BRIDGE_AUTH_TOKEN}`,
				},
			});
			const latency = Math.round(performance.now() - start);
			if (res.ok) {
				setBridgeStatus("online");
				setBridgeLatency(latency);
			} else {
				setBridgeStatus("offline");
			}
		} catch {
			setBridgeStatus("offline");
		} finally {
			setIsPingingBridge(false);
		}
	};

	const copyBridgeToken = async () => {
		await navigator.clipboard.writeText(BRIDGE_AUTH_TOKEN);
		setCopiedToken(true);
		showToast("Bridge auth token copied to clipboard", "success");
		setTimeout(() => setCopiedToken(false), 2000);
	};

	// 1. Master Password Rotation
	const handleMasterPasswordChange = async (e: React.FormEvent) => {
		e.preventDefault();
		setPassError("");

		if (!currentPassword) {
			setPassError("Please enter your current master password.");
			return;
		}

		if (newPassword.length < 10) {
			setPassError("New master password must be at least 10 characters long.");
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

			// Derive new key using Argon2id with active tuning
			const saltHex = generateSaltHex();
			const newKey = await deriveMasterKey(newPassword, saltHex);

			const metadata = {
				vaultId: getVaultMetadata()?.vaultId || `vault-${Date.now()}`,
				version: 1,
				saltHex,
				params: {
					algorithm: "AES-256-GCM" as const,
					kdf: "Argon2id" as const,
					iterations: settings.argon2Iterations,
				},
			};

			saveVaultMetadata(metadata);
			await saveEncryptedVault(allItems, newKey);

			// Keep backend unlocked with new key
			await vaultBackend.unlockVault(newPassword);

			setCurrentPassword("");
			setNewPassword("");
			setConfirmNewPassword("");
			showToast("Master Password updated! Vault re-encrypted with new Argon2id key.", "success");
		} catch (err: any) {
			setPassError(err.message || "Failed to update master password.");
		} finally {
			setIsChangingPass(false);
		}
	};

	// 2. Live Argon2id Hardware Benchmark
	const runKdfBenchmark = async () => {
		setIsBenchmarking(true);
		setBenchmarkResult(null);

		// Yield briefly to let UI render loading state
		await new Promise((resolve) => setTimeout(resolve, 50));

		const testPassword = "BenchmarkPasswordSample123!@#";
		const testSalt = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
		const memMB = settings.argon2Memory / 1024;
		const iters = settings.argon2Iterations;

		const start = performance.now();
		try {
			await deriveMasterKey(testPassword, testSalt);
			const durationMs = Math.round(performance.now() - start);
			const throughput = Math.round((memMB * iters * 1000) / (durationMs || 1));

			let grade = "A+ (Enterprise Defense)";
			if (durationMs < 100) grade = "A (Balanced Desktop)";
			else if (durationMs > 1000) grade = "Extreme Hardening";

			setBenchmarkResult({
				latencyMs: durationMs,
				memoryMB: memMB,
				iterations: iters,
				throughputMBs: throughput,
				securityGrade: grade,
			});
			showToast(`KDF benchmark completed: ${durationMs}ms`, "success");
		} catch (err: any) {
			showToast(`Benchmark error: ${err.message}`, "warning");
		} finally {
			setIsBenchmarking(false);
		}
	};

	// 3. Encrypted JSON Backup Export
	const handleExportEncryptedBackup = async () => {
		const store = localStorage.getItem("safevault_encrypted_store");
		const meta = localStorage.getItem("safevault_metadata");
		if (!store || !meta) {
			showToast("No vault data available for export.", "warning");
			return;
		}

		try {
			const backupPayload = {
				safevault: true,
				formatVersion: "2.0",
				exportedAt: new Date().toISOString(),
				metadata: JSON.parse(meta),
				encryptedStore: JSON.parse(store),
				entryCount: allItems.length,
			};

			const jsonStr = JSON.stringify(backupPayload, null, 2);
			const fileName = `SafeVaultPro_Backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

			// 1. Try modern File System Access API
			if ("showSaveFilePicker" in window) {
				try {
					const handle = await (window as any).showSaveFilePicker({
						suggestedName: fileName,
						types: [
							{
								description: "SafeVault Encrypted Backup (.json)",
								accept: { "application/json": [".json"] },
							},
						],
					});
					const writable = await handle.createWritable();
					await writable.write(jsonStr);
					await writable.close();
					updateSettings({ lastBackupTimestamp: Date.now() });
					showToast(`Backup saved: ${handle.name}`, "success");
					return;
				} catch (pickerErr: any) {
					if (pickerErr.name === "AbortError") return;
				}
			}

			// 2. Try native Bun backend disk save to user's Downloads folder
			try {
				const savedPath = vaultBackend.saveBackupToDisk(fileName, jsonStr);
				if (savedPath) {
					updateSettings({ lastBackupTimestamp: Date.now() });
					showToast(`Backup saved to: ${savedPath}`, "success");
					return;
				}
			} catch {}

			// 3. Browser download fallback
			const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(jsonStr);
			const a = document.createElement("a");
			a.style.display = "none";
			a.href = dataUri;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			setTimeout(() => {
				if (document.body.contains(a)) document.body.removeChild(a);
			}, 1000);

			updateSettings({ lastBackupTimestamp: Date.now() });
			showToast("Encrypted backup downloaded successfully", "success");
		} catch (err: any) {
			showToast(`Backup export failed: ${err.message}`, "warning");
		}
	};

	// 4. Copy Encrypted JSON Backup to Clipboard
	const handleCopyEncryptedBackup = async () => {
		const store = localStorage.getItem("safevault_encrypted_store");
		const meta = localStorage.getItem("safevault_metadata");
		if (!store || !meta) {
			showToast("No vault data available for export.", "warning");
			return;
		}

		try {
			const backupPayload = {
				safevault: true,
				formatVersion: "2.0",
				exportedAt: new Date().toISOString(),
				metadata: JSON.parse(meta),
				encryptedStore: JSON.parse(store),
			};
			await navigator.clipboard.writeText(JSON.stringify(backupPayload, null, 2));
			showToast("Encrypted backup payload copied to clipboard", "success");
		} catch (err: any) {
			showToast(`Copy failed: ${err.message}`, "warning");
		}
	};



	// 6. Restore Encrypted Backup File
	const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (evt) => {
			try {
				const content = evt.target?.result as string;
				const data = JSON.parse(content);

				if (!data.metadata || !data.encryptedStore) {
					throw new Error("Invalid SafeVault backup structure. Missing metadata or encrypted store payload.");
				}

				localStorage.setItem("safevault_metadata", JSON.stringify(data.metadata));
				localStorage.setItem("safevault_encrypted_store", JSON.stringify(data.encryptedStore));

				showToast("Vault restored from backup! Please lock and re-enter master password.", "success");
				refreshItems();
			} catch (err: any) {
				showToast(`Restore failed: ${err.message}`, "warning");
			}
		};
		reader.readAsText(file);
	};

	// 7. Reset & Reload Initial Dataset
	const executeReloadSeed = async () => {
		setShowReloadConfirmModal(false);
		try {
			await vaultBackend.resetToInitialSeed();
			showToast("Vault re-seeded with initial sample dataset!", "success");
			refreshItems();
		} catch (err: any) {
			showToast(`Failed to reload seed: ${err.message}`, "warning");
		}
	};

	// 8. Factory Reset / Wipe Vault
	const handleFactoryReset = () => {
		if (wipePhrase !== "WIPE VAULT") {
			showToast('Please type "WIPE VAULT" to confirm wipe', "warning");
			return;
		}

		localStorage.removeItem("safevault_metadata");
		localStorage.removeItem("safevault_encrypted_store");
		localStorage.removeItem("safevault_encrypted_store_backup");
		localStorage.removeItem("safevault_user_settings");
		vaultBackend.lockVault();
		showToast("Vault destroyed and cryptographic keys wiped.", "info");
		window.location.reload();
	};

	const passEntropy = calculatePasswordEntropy(newPassword);
	const metadata = getVaultMetadata();

	// Calculate storage statistics
	const rawEncryptedStore = typeof localStorage !== "undefined" ? localStorage.getItem("safevault_encrypted_store") : null;
	const payloadSizeBytes = rawEncryptedStore ? new Blob([rawEncryptedStore]).size : 0;
	const payloadSizeKB = (payloadSizeBytes / 1024).toFixed(2);

	const sections = [
		{ id: "security" as const, label: "Security", icon: Shield, desc: "Auto-lock & clipboard" },
		{ id: "password" as const, label: "Master Password", icon: KeyRound, desc: "Change password" },
		{ id: "kdf" as const, label: "Key Derivation", icon: Cpu, desc: "Argon2id settings" },
		{ id: "backup" as const, label: "Backup & Export", icon: Download, desc: "JSON & CSV exports" },
		{ id: "extension" as const, label: "Browser Extension", icon: Puzzle, desc: "Bridge connection" },
		{ id: "diagnostics" as const, label: "Data & Reset", icon: Terminal, desc: "Storage info & reset" },
	];

	return (
		<div className="flex-1 flex flex-col h-full min-h-0 bg-[#09090b] text-slate-200 select-none overflow-hidden font-sans">
			{/* Header Bar */}
			<div className="h-14 px-6 border-b border-slate-800/80 bg-[#131315] flex items-center justify-between shrink-0">
				<div className="flex items-center gap-4">
					<button
						onClick={onBack}
						title="Back (Esc)"
						className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1c1b1d] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-medium transition-all group"
					>
						<ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-emerald-400" />
						<span>Back</span>
						<kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[#09090b] text-slate-400 rounded border border-slate-800">
							ESC
						</kbd>
					</button>

					<div className="h-4 w-px bg-slate-800" />

					<h1 className="text-xs font-bold text-white font-mono tracking-wide uppercase">
						Settings
					</h1>
				</div>
			</div>

			{/* Main Workspace: 2-Column Split Pane */}
			<div className="flex-1 min-h-0 flex overflow-hidden">
				{/* Column 1: Settings Navigation Sidebar */}
				<div className="w-64 lg:w-72 bg-[#131315]/80 border-r border-slate-800/80 flex flex-col shrink-0 p-3 space-y-1">
					<div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
						Control Sections
					</div>

					{sections.map((sec) => {
						const Icon = sec.icon;
						const isActive = activeSection === sec.id;
						return (
							<button
								key={sec.id}
								onClick={() => setActiveSection(sec.id)}
								className={`w-full text-left p-3 rounded-xl transition-all relative flex items-start gap-3 ${
									isActive
										? "bg-[#1c1b1d] border border-slate-700/80 text-white shadow-lg"
										: "hover:bg-[#18181b] text-slate-400 hover:text-slate-200 border border-transparent"
								}`}
							>
								{isActive && (
									<div className="absolute left-0 top-3 bottom-3 w-1 bg-emerald-500 rounded-r shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
								)}
								<div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-[#09090b] text-slate-400"}`}>
									<Icon className="w-4 h-4" />
								</div>
								<div className="min-w-0">
									<div className={`text-xs font-semibold ${isActive ? "text-white" : "text-slate-300"}`}>
										{sec.label}
									</div>
									<div className="text-[11px] text-slate-500 truncate mt-0.5">
										{sec.desc}
									</div>
								</div>
							</button>
						);
					})}

					{/* Quick Vault Status Card in Sidebar bottom */}
					<div className="mt-auto p-3.5 bg-[#09090b] border border-slate-800/80 rounded-xl space-y-2 font-mono text-[11px]">
						<div className="flex items-center justify-between text-slate-400">
							<span>Active Secrets:</span>
							<span className="text-white font-bold">{allItems.length}</span>
						</div>
						<div className="flex items-center justify-between text-slate-400">
							<span>Payload Size:</span>
							<span className="text-slate-300 font-bold">{payloadSizeKB} KB</span>
						</div>
						<div className="flex items-center justify-between text-slate-400">
							<span>Inactivity Lock:</span>
							<span className="text-emerald-400 font-bold">{settings.autoLockTimeout === "never" ? "Disabled" : `${settings.autoLockTimeout}m`}</span>
						</div>
					</div>
				</div>

				{/* Column 2: Active Section Configuration Workspace */}
				<div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 space-y-6 max-w-4xl">
					{/* SECTION 1: SECURITY & AUTO-LOCK POLICY */}
					{activeSection === "security" && (
						<div className="space-y-6 animate-fade-in">
							<div>
								<h2 className="text-sm font-bold font-mono tracking-wide uppercase text-white flex items-center gap-2">
									<Shield className="w-4 h-4 text-emerald-400" />
									<span>Security & Lock Settings</span>
								</h2>
								<p className="text-xs text-slate-400 mt-1">
									Manage auto-lock timers and clipboard clearing.
								</p>
							</div>

							{/* Inactivity Auto-Lock */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-4">
								<div className="flex items-start justify-between">
									<div>
										<h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
											Auto-Lock
										</h3>
										<p className="text-xs text-slate-400 mt-0.5">
											Lock vault automatically after inactivity.
										</p>
									</div>
									<div className="px-2.5 py-1 bg-[#09090b] border border-slate-800 rounded-lg text-emerald-400 font-mono text-xs font-bold">
										{settings.autoLockTimeout === "never" ? "NEVER" : `${settings.autoLockTimeout} MIN`}
									</div>
								</div>

								<div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
									{(["1", "5", "15", "30", "60", "never"] as const).map((option) => {
										const active = settings.autoLockTimeout === option;
										return (
											<button
												key={option}
												onClick={() => updateSettings({ autoLockTimeout: option })}
												className={`py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all text-center border ${
													active
														? "bg-emerald-500/15 border-emerald-500/60 text-emerald-400 font-bold shadow-[0_0_10px_rgba(16,185,129,0.15)]"
														: "bg-[#09090b] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
												}`}
											>
												{option === "never" ? "Never" : `${option}m`}
											</button>
										);
									})}
								</div>
							</div>

							{/* Event Triggers: Sleep & Blur */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<label className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl flex items-start justify-between cursor-pointer hover:border-slate-700 transition-colors">
									<div className="space-y-1 pr-4">
										<span className="text-xs font-bold text-white block">Lock on system sleep</span>
										<p className="text-xs text-slate-400">
											Lock when the computer goes to sleep.
										</p>
									</div>
									<input
										type="checkbox"
										checked={settings.lockOnSleep}
										onChange={(e) => updateSettings({ lockOnSleep: e.target.checked })}
										className="w-4 h-4 mt-0.5 accent-emerald-500 rounded cursor-pointer shrink-0"
									/>
								</label>

								<label className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl flex items-start justify-between cursor-pointer hover:border-slate-700 transition-colors">
									<div className="space-y-1 pr-4">
										<span className="text-xs font-bold text-white block">Lock when switching apps</span>
										<p className="text-xs text-slate-400">
											Lock when window loses focus.
										</p>
									</div>
									<input
										type="checkbox"
										checked={settings.lockOnWindowBlur}
										onChange={(e) => updateSettings({ lockOnWindowBlur: e.target.checked })}
										className="w-4 h-4 mt-0.5 accent-emerald-500 rounded cursor-pointer shrink-0"
									/>
								</label>
							</div>

							{/* Minimize Button & System Tray Behavior */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-4">
								<div className="flex items-start justify-between">
									<div>
										<h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
											<span>Minimize & System Tray Behavior</span>
											{settings.minimizeToTray ? (
												<span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-[10px] rounded font-mono font-bold">
													MINIMIZE TO TRAY
												</span>
											) : (
												<span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 text-[10px] rounded font-mono font-bold">
													NORMAL MINIMIZE (DEFAULT)
												</span>
											)}
										</h3>
										<p className="text-xs text-slate-400 mt-1">
											Choose whether minimizing the window sends SafeVaultPro to the system tray or keeps it in the taskbar. Closing the window always exits the application.
										</p>
									</div>
								</div>

								<label className="p-4 bg-[#09090b] border border-slate-800/80 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-700/80 transition-colors">
									<div className="space-y-1 pr-4">
										<div className="flex items-center gap-2">
											<span className="text-xs font-bold text-white">Minimize to system tray</span>
										</div>
										<p className="text-[11px] text-slate-400 leading-relaxed">
											When minimizing the window, keep SafeVaultPro running in the Windows system tray instead of the taskbar. The browser extension stays continuously connected for live autofill and credential capturing.
										</p>
									</div>
									<input
										type="checkbox"
										checked={Boolean(settings.minimizeToTray)}
										onChange={(e) => {
											const val = e.target.checked;
											updateSettings({ minimizeToTray: val });
											showToast(
												val
													? "Minimize button will now minimize to system tray"
													: "Minimize button will now minimize to taskbar",
												"info"
											);
										}}
										className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0"
									/>
								</label>
							</div>

							{/* Clipboard Defense */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
											Clear Clipboard
										</h3>
										<p className="text-xs text-slate-400 mt-0.5">
											Time before copied items are cleared from clipboard.
										</p>
									</div>
									<span className="font-mono text-emerald-400 font-bold text-sm tnum px-3 py-1 bg-[#09090b] border border-slate-800 rounded-lg">
										{settings.clipboardTimeout}s
									</span>
								</div>

								<div className="space-y-2">
									<input
										type="range"
										min={5}
										max={120}
										step={5}
										value={settings.clipboardTimeout}
										onChange={(e) => updateSettings({ clipboardTimeout: Number(e.target.value) })}
										className="w-full h-2 bg-[#09090b] border border-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
									/>
									<div className="flex justify-between text-[10px] font-mono text-slate-500">
										<span>5s</span>
										<span>30s (Default)</span>
										<span>120s</span>
									</div>
								</div>

								<label className="flex items-center justify-between pt-3 border-t border-slate-800/80 cursor-pointer">
									<div className="pr-4">
										<span className="text-xs font-medium text-slate-300 block">Clear clipboard on lock</span>
										<span className="text-[11px] text-slate-500">
											Wipe clipboard when vault locks.
										</span>
									</div>
									<input
										type="checkbox"
										checked={settings.wipeClipboardOnLock}
										onChange={(e) => updateSettings({ wipeClipboardOnLock: e.target.checked })}
										className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
									/>
								</label>
							</div>

							{/* Landing View Preference */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-3">
								<h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
									Default Screen
								</h3>
								<div className="grid grid-cols-3 gap-3">
									{[
										{ id: "all", label: "All Items" },
										{ id: "dashboard", label: "Health" },
										{ id: "favorites", label: "Favorites" },
									].map((view) => {
										const active = settings.defaultLandingView === view.id;
										return (
											<button
												key={view.id}
												onClick={() => updateSettings({ defaultLandingView: view.id as any })}
												className={`p-3 rounded-xl text-xs font-medium border text-center transition-all ${
													active
														? "bg-emerald-500/10 border-emerald-500/50 text-white font-bold"
														: "bg-[#09090b] border-slate-800 text-slate-400 hover:text-white"
												}`}
											>
												{view.label}
											</button>
										);
									})}
								</div>
							</div>

							{/* Immediate Memory Purge Button */}
							<div className="p-4 bg-[#18181b]/50 border border-slate-800 rounded-xl flex items-center justify-between">
								<div className="flex items-center gap-3">
									<Lock className="w-4 h-4 text-amber-400" />
									<div>
										<span className="text-xs font-bold text-slate-200 block">Lock vault now</span>
										<span className="text-[11px] text-slate-500">Lock current session.</span>
									</div>
								</div>
								<button
									onClick={vault.lock}
									className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 rounded-lg text-xs font-mono font-bold transition-all"
								>
									Lock
								</button>
							</div>
						</div>
					)}

					{/* SECTION 2: MASTER CRYPTOGRAPHIC KEY ROTATION */}
					{activeSection === "password" && (
						<div className="space-y-6 animate-fade-in">
							<div>
								<h2 className="text-sm font-bold font-mono tracking-wide uppercase text-white flex items-center gap-2">
									<KeyRound className="w-4 h-4 text-emerald-400" />
									<span>Master Password</span>
								</h2>
								<p className="text-xs text-slate-400 mt-1">
									Change your master password. All items will be re-encrypted.
								</p>
							</div>

							<form onSubmit={handleMasterPasswordChange} className="p-6 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-4">
								{passError && (
									<div className="p-3.5 bg-red-950/50 border border-red-800/60 rounded-xl flex items-center gap-2.5 text-red-300 text-xs">
										<AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
										<span>{passError}</span>
									</div>
								)}

								<div>
									<label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
										Current Password
									</label>
									<input
										type={showPass ? "text" : "password"}
										required
										value={currentPassword}
										onChange={(e) => setCurrentPassword(e.target.value)}
										placeholder="Enter current password"
										className="w-full px-4 py-2.5 bg-[#09090b] border border-slate-800 focus:border-emerald-500/60 rounded-xl text-white font-mono text-xs focus:outline-none transition-colors"
									/>
								</div>

								<div>
									<label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
										New Password (Min 10 characters)
									</label>
									<input
										type={showPass ? "text" : "password"}
										required
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										placeholder="Enter new password"
										className="w-full px-4 py-2.5 bg-[#09090b] border border-slate-800 focus:border-emerald-500/60 rounded-xl text-white font-mono text-xs focus:outline-none transition-colors"
									/>

									{newPassword.length > 0 && (
										<div className="mt-2 space-y-1.5">
											<div className="flex justify-between text-[11px] font-mono">
												<span className="text-slate-400">Entropy: {passEntropy} bits</span>
												<span className={passEntropy >= 60 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
													{passEntropy >= 80 ? "Very Strong" : passEntropy >= 60 ? "Strong" : "Weak"}
												</span>
											</div>
											<div className="w-full h-1.5 bg-[#09090b] rounded-full overflow-hidden flex gap-1">
												<div className={`h-full rounded-full transition-all duration-300 ${passEntropy > 0 ? (passEntropy >= 60 ? "bg-emerald-500" : "bg-amber-500") : "bg-slate-800"}`} style={{ width: `${Math.min(100, (passEntropy / 90) * 100)}%` }} />
											</div>
										</div>
									)}
								</div>

								<div>
									<label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
										Confirm New Password
									</label>
									<input
										type={showPass ? "text" : "password"}
										required
										value={confirmNewPassword}
										onChange={(e) => setConfirmNewPassword(e.target.value)}
										placeholder="Re-enter new password"
										className="w-full px-4 py-2.5 bg-[#09090b] border border-slate-800 focus:border-emerald-500/60 rounded-xl text-white font-mono text-xs focus:outline-none transition-colors"
									/>
								</div>

								<div className="flex items-center justify-between pt-3 border-t border-slate-800">
									<button
										type="button"
										onClick={() => setShowPass(!showPass)}
										className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors font-mono"
									>
										{showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
										<span>{showPass ? "Hide" : "Show"}</span>
									</button>

									<button
										type="submit"
										disabled={isChangingPass || !currentPassword || !newPassword}
										className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
									>
										<Save className="w-4 h-4" />
										<span>{isChangingPass ? "Updating..." : "Update Password"}</span>
									</button>
								</div>
							</form>
						</div>
					)}

					{/* SECTION 3: ARGON2ID & HARDWARE BENCHMARK */}
					{activeSection === "kdf" && (
						<div className="space-y-6 animate-fade-in">
							<div>
								<h2 className="text-sm font-bold font-mono tracking-wide uppercase text-white flex items-center gap-2">
									<Cpu className="w-4 h-4 text-emerald-400" />
									<span>Key Derivation</span>
								</h2>
								<p className="text-xs text-slate-400 mt-1">
									Configure memory and iteration settings for Argon2id.
								</p>
							</div>

							{/* Parameters Config */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-5">
								<div>
									<div className="flex justify-between items-center mb-2">
										<label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
											Memory
										</label>
										<span className="font-mono text-xs font-bold text-emerald-400">
											{settings.argon2Memory / 1024} MB
										</span>
									</div>
									<div className="grid grid-cols-4 gap-2">
										{[
											{ val: 32768, label: "32 MB", desc: "Lightweight" },
											{ val: 65536, label: "64 MB", desc: "Default" },
											{ val: 131072, label: "128 MB", desc: "Higher" },
											{ val: 262144, label: "256 MB", desc: "Maximum" },
										].map((opt) => {
											const active = settings.argon2Memory === opt.val;
											return (
												<button
													key={opt.val}
													onClick={() => updateSettings({ argon2Memory: opt.val })}
													className={`p-3 rounded-xl border text-left transition-all ${
														active
															? "bg-emerald-500/15 border-emerald-500/60 text-white shadow-lg"
															: "bg-[#09090b] border-slate-800 text-slate-400 hover:text-white"
													}`}
												>
													<div className="font-mono font-bold text-xs">{opt.label}</div>
													<div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
												</button>
											);
										})}
									</div>
								</div>

								<div className="pt-4 border-t border-slate-800">
									<div className="flex justify-between items-center mb-2">
										<label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
											Iterations
										</label>
										<span className="font-mono text-xs font-bold text-emerald-400">
											{settings.argon2Iterations}
										</span>
									</div>
									<input
										type="range"
										min={2}
										max={8}
										value={settings.argon2Iterations}
										onChange={(e) => updateSettings({ argon2Iterations: Number(e.target.value) })}
										className="w-full h-2 bg-[#09090b] border border-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
									/>
									<div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
										<span>2 (Fast)</span>
										<span>3 (Default)</span>
										<span>8 (High)</span>
									</div>
								</div>
							</div>

							{/* Interactive Benchmark Box */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
											<Sparkles className="w-3.5 h-3.5 text-indigo-400" />
											<span>Benchmark</span>
										</h3>
										<p className="text-xs text-slate-400 mt-0.5">
											Test key derivation speed on this device.
										</p>
									</div>
									<button
										onClick={runKdfBenchmark}
										disabled={isBenchmarking}
										className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg"
									>
										{isBenchmarking ? (
											<>
												<RefreshCw className="w-3.5 h-3.5 animate-spin" />
												<span>Testing...</span>
											</>
										) : (
											<>
												<Zap className="w-3.5 h-3.5" />
												<span>Run Benchmark</span>
											</>
										)}
									</button>
								</div>

								{benchmarkResult && (
									<div className="p-4 bg-[#09090b] border border-indigo-900/50 rounded-xl space-y-3 font-mono text-xs animate-fade-in">
										<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
											<div className="p-2.5 bg-[#131315] rounded-lg border border-slate-800">
												<div className="text-[10px] text-slate-500 uppercase">Duration</div>
												<div className="text-base font-bold text-emerald-400 mt-0.5 tnum">{benchmarkResult.latencyMs} ms</div>
											</div>
											<div className="p-2.5 bg-[#131315] rounded-lg border border-slate-800">
												<div className="text-[10px] text-slate-500 uppercase">Memory</div>
												<div className="text-base font-bold text-white mt-0.5">{benchmarkResult.memoryMB} MB</div>
											</div>
											<div className="p-2.5 bg-[#131315] rounded-lg border border-slate-800">
												<div className="text-[10px] text-slate-500 uppercase">Throughput</div>
												<div className="text-base font-bold text-indigo-400 mt-0.5 tnum">~{benchmarkResult.throughputMBs} MB/s</div>
											</div>
											<div className="p-2.5 bg-[#131315] rounded-lg border border-slate-800">
												<div className="text-[10px] text-slate-500 uppercase">Rating</div>
												<div className="text-xs font-bold text-emerald-400 mt-1">{benchmarkResult.securityGrade}</div>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					)}

					{/* SECTION 4: DATA PORTABILITY & BACKUP */}
					{activeSection === "backup" && (
						<div className="space-y-6 animate-fade-in">
							<div>
								<h2 className="text-sm font-bold font-mono tracking-wide uppercase text-white flex items-center gap-2">
									<Download className="w-4 h-4 text-emerald-400" />
									<span>Backup & Export</span>
								</h2>
								<p className="text-xs text-slate-400 mt-1">
									Save encrypted backups or restore your vault.
								</p>
							</div>

							{/* Encrypted Backups */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
											Encrypted Backup
										</h3>
										<p className="text-xs text-slate-400 mt-0.5">
											Encrypted file protected by your master password.
										</p>
									</div>
									{settings.lastBackupTimestamp && (
										<span className="text-[11px] font-mono text-slate-500">
											Last: {new Date(settings.lastBackupTimestamp).toLocaleDateString()}
										</span>
									)}
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<button
										onClick={handleExportEncryptedBackup}
										className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg"
									>
										<Download className="w-4 h-4 shrink-0" />
										<span>Save Backup (.json)</span>
									</button>

									<button
										onClick={handleCopyEncryptedBackup}
										className="py-3 px-4 bg-[#1c1b1d] hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
									>
										<Copy className="w-4 h-4 text-emerald-400" />
										<span>Copy Backup</span>
									</button>
								</div>
							</div>

							{/* Restore Backup */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-3">
								<h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
									Restore Backup
								</h3>
								<label className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-[#09090b] transition-all group">
									<Upload className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 mb-2 transition-colors" />
									<span className="text-xs font-semibold text-slate-300">Select backup file (.json) to restore</span>
									<span className="text-[10px] text-slate-500 font-mono mt-1">Replaces current vault</span>
									<input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
								</label>
							</div>
						</div>
					)}

					{/* SECTION 5: BROWSER EXTENSION BRIDGE */}
					{activeSection === "extension" && (
						<div className="space-y-6 animate-fade-in">
							<div>
								<h2 className="text-sm font-bold font-mono tracking-wide uppercase text-white flex items-center gap-2">
									<Puzzle className="w-4 h-4 text-purple-400" />
									<span>Browser Extension</span>
								</h2>
								<p className="text-xs text-slate-400 mt-1">
									Connect the desktop app to Chrome, Edge, Brave, and Firefox via local bridge (<code className="text-purple-300 font-mono">localhost:48920</code>).
								</p>
							</div>

							{/* Bridge Status Card */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className={`w-3 h-3 rounded-full ${bridgeStatus === "online" ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"}`} />
										<div>
											<div className="text-xs font-bold text-white font-mono">
												Status: {bridgeStatus === "online" ? "Online" : "Offline"}
											</div>
											<div className="text-[11px] text-slate-500 font-mono">
												http://localhost:48920
											</div>
										</div>
									</div>

									<button
										onClick={testBridgeConnection}
										disabled={isPingingBridge}
										className="px-3 py-1.5 bg-[#1c1b1d] hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 transition-all flex items-center gap-1.5"
									>
										<RefreshCw className={`w-3.5 h-3.5 ${isPingingBridge ? "animate-spin text-purple-400" : ""}`} />
										<span>{bridgeLatency !== null ? `${bridgeLatency}ms` : "Test"}</span>
									</button>
								</div>

								{/* Authentication Token Box */}
								<div className="p-3 bg-[#09090b] border border-slate-800 rounded-xl space-y-1.5">
									<div className="flex justify-between text-[11px] font-mono text-slate-400">
										<span>AUTH TOKEN</span>
									</div>
									<div className="flex items-center justify-between gap-2">
										<code className="text-[11px] font-mono text-purple-300 truncate">
											{BRIDGE_AUTH_TOKEN}
										</code>
										<button
											onClick={copyBridgeToken}
											className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors shrink-0"
											title="Copy Token"
										>
											{copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
										</button>
									</div>
								</div>

								<div className="flex items-center justify-between pt-2">
									<div className="text-xs text-slate-400">
										Extension folder: <span className="font-mono text-slate-300">src/extension</span>
									</div>
									<button
										onClick={() => vaultBackend.openExtensionDirectory()}
										className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold rounded-xl text-xs transition-all flex items-center gap-2"
									>
										<FolderOpen className="w-3.5 h-3.5" />
										<span>Open Folder</span>
									</button>
								</div>
							</div>
						</div>
					)}

					{/* SECTION 6: DIAGNOSTICS & DANGER ZONE */}
					{activeSection === "diagnostics" && (
						<div className="space-y-6 animate-fade-in">
							<div>
								<h2 className="text-sm font-bold font-mono tracking-wide uppercase text-white flex items-center gap-2">
									<Terminal className="w-4 h-4 text-emerald-400" />
									<span>Data & Reset</span>
								</h2>
								<p className="text-xs text-slate-400 mt-1">
									Storage statistics and vault reset options.
								</p>
							</div>

							{/* Storage Breakdown */}
							<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-3 font-mono text-xs">
								<h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
									Storage
								</h3>
								<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl space-y-2">
									<div className="flex justify-between"><span className="text-slate-500">Vault ID:</span> <span className="text-slate-300">{metadata?.vaultId || "N/A"}</span></div>
									<div className="flex justify-between"><span className="text-slate-500">Total Items:</span> <span className="text-white font-bold">{allItems.length}</span></div>
									<div className="flex justify-between"><span className="text-slate-500">Encrypted Size:</span> <span className="text-emerald-400 font-bold">{payloadSizeKB} KB</span></div>
								</div>
							</div>

							{/* Reset to Initial Dataset */}
							<div className="p-5 bg-[#131315] border border-indigo-900/40 rounded-2xl space-y-3">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-mono">
											Reload Sample Data
										</h3>
										<p className="text-xs text-slate-400 mt-0.5">
											Replace current items with the sample dataset.
										</p>
									</div>
									<button
										onClick={() => setShowReloadConfirmModal(true)}
										className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg"
									>
										<RefreshCw className="w-3.5 h-3.5" />
										<span>Reload</span>
									</button>
								</div>
							</div>

							{/* Danger Zone: Factory Reset */}
							<div className="p-5 bg-red-950/20 border border-red-900/60 rounded-2xl space-y-4">
								<div className="flex items-start gap-3">
									<AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
									<div>
										<h3 className="text-xs font-bold text-red-400 uppercase tracking-wider font-mono">
											Reset All Data
										</h3>
										<p className="text-xs text-slate-400 mt-0.5">
											Deletes all stored credentials and settings on this device.
										</p>
									</div>
								</div>

								<div className="space-y-3 pt-2">
									<input
										type="text"
										value={wipePhrase}
										onChange={(e) => setWipePhrase(e.target.value)}
										placeholder='Type "WIPE VAULT" to confirm'
										className="w-full px-4 py-2.5 bg-[#09090b] border border-red-900/60 focus:border-red-500 rounded-xl text-red-300 font-mono text-xs focus:outline-none"
									/>

									<button
										onClick={handleFactoryReset}
										disabled={wipePhrase !== "WIPE VAULT"}
										className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-mono font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-950/50"
									>
										<Trash2 className="w-4 h-4" />
										<span>Wipe Vault</span>
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>



			{/* Modal 2: Reload Dataset Confirmation Modal */}
			{showReloadConfirmModal && (
				<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
					<div className="bg-[#131315] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 text-slate-200">
						<div className="flex items-center gap-3 text-indigo-400">
							<RefreshCw className="w-5 h-5 shrink-0" />
							<h3 className="text-sm font-bold text-white font-mono">Confirm Sample Dataset Reload</h3>
						</div>

						<p className="text-xs text-slate-300 leading-relaxed">
							Are you sure you want to reset and reload the sample dataset into your active vault? Current entries will be replaced with the default demonstration dataset.
						</p>

						<div className="flex items-center justify-end gap-3 pt-2">
							<button
								onClick={() => setShowReloadConfirmModal(false)}
								className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
							>
								Cancel
							</button>

							<button
								onClick={executeReloadSeed}
								className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg"
							>
								<RefreshCw className="w-3.5 h-3.5" />
								<span>Reload Dataset</span>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
