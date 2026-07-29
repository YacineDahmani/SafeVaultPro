import React, { useState, useEffect } from "react";
import { X, Puzzle, FolderOpen, Copy, Check, ExternalLink, ShieldCheck, Zap, AlertCircle } from "lucide-react";

interface ExtensionModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({ isOpen, onClose }) => {
	const [copiedPath, setCopiedPath] = useState(false);
	const [status, setStatus] = useState<{ connected: boolean; unlocked: boolean } | null>(null);
	const [isOpeningFolder, setIsOpeningFolder] = useState(false);

	const extPath = "d:\\repos\\SafeVaultPro\\src\\extension";

	useEffect(() => {
		if (!isOpen) return;
		checkBridgeStatus();
		const timer = setInterval(checkBridgeStatus, 3000);
		return () => clearInterval(timer);
	}, [isOpen]);

	const checkBridgeStatus = async () => {
		try {
			const res = await fetch("http://localhost:48920/api/status");
			if (res.ok) {
				const data = await res.json();
				setStatus({ connected: true, unlocked: data.unlocked });
			} else {
				setStatus({ connected: false, unlocked: false });
			}
		} catch {
			setStatus({ connected: false, unlocked: false });
		}
	};

	const handleCopyPath = () => {
		navigator.clipboard.writeText(extPath);
		setCopiedPath(true);
		setTimeout(() => setCopiedPath(false), 2000);
	};

	const handleOpenFolder = async () => {
		setIsOpeningFolder(true);
		try {
			await fetch("http://localhost:48920/api/open-folder", { method: "POST" });
		} catch (e) {
			console.error("Failed to trigger open folder:", e);
		} finally {
			setTimeout(() => setIsOpeningFolder(false), 1000);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
			<div className="relative w-full max-w-lg bg-[#131315] border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-200">
				{/* Modal Header */}
				<div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#18181b]">
					<div className="flex items-center gap-2.5">
						<div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
							<Puzzle className="w-4 h-4 text-emerald-400" />
						</div>
						<div>
							<h2 className="text-base font-bold text-white tracking-wide">
								Browser Extension Setup
							</h2>
							<p className="text-xs text-slate-400">Chrome • Edge • Brave • Firefox</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Body Content */}
				<div className="p-6 space-y-5 text-sm max-h-[75vh] overflow-y-auto">
					{/* Status Card */}
					<div className="p-3.5 rounded-lg bg-[#09090b] border border-slate-800/80 flex items-center justify-between">
						<div className="flex items-center gap-2.5">
							<span
								className={`w-2.5 h-2.5 rounded-full ${
									status?.connected ? "bg-emerald-500" : "bg-amber-500"
								}`}
							/>
							<div>
								<div className="text-xs font-semibold text-white">
									Local IPC Bridge: {status?.connected ? "Active (port 48920)" : "Connecting..."}
								</div>
								<div className="text-[11px] text-slate-400">
									{status?.unlocked
										? "Vault unlocked and ready for extension requests"
										: "Unlock vault to allow extension autofill"}
								</div>
							</div>
						</div>
						{status?.connected && (
							<span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
								READY
							</span>
						)}
					</div>

					{/* 1-Click Action Buttons */}
					<div className="grid grid-cols-2 gap-3">
						<button
							onClick={handleOpenFolder}
							disabled={isOpeningFolder}
							className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/10 text-xs"
						>
							<FolderOpen className="w-4 h-4" />
							<span>{isOpeningFolder ? "Opening..." : "Open Extension Folder"}</span>
						</button>

						<button
							onClick={handleCopyPath}
							className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#18181b] hover:bg-[#222126] text-white font-medium border border-slate-700/80 rounded-lg transition-all text-xs"
						>
							{copiedPath ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
							<span>{copiedPath ? "Path Copied!" : "Copy Folder Path"}</span>
						</button>
					</div>

					{/* Quick Installation Instructions */}
					<div className="space-y-3 pt-1 border-t border-slate-800/60">
						<h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
							How to Load Unpacked Extension (30 Seconds)
						</h3>

						<ol className="space-y-2.5 text-xs text-slate-300">
							<li className="flex items-start gap-2.5 bg-[#18181b]/50 p-2.5 rounded-lg border border-slate-800/40">
								<span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
									1
								</span>
								<div>
									Click <strong className="text-emerald-400">Open Extension Folder</strong> above to reveal the unpacked files in File Explorer.
								</div>
							</li>

							<li className="flex items-start gap-2.5 bg-[#18181b]/50 p-2.5 rounded-lg border border-slate-800/40">
								<span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
									2
								</span>
								<div>
									Open your browser extensions page (<code className="px-1.5 py-0.5 bg-[#09090b] text-emerald-400 rounded font-mono">chrome://extensions</code> or <code className="px-1.5 py-0.5 bg-[#09090b] text-emerald-400 rounded font-mono">edge://extensions</code>).
								</div>
							</li>

							<li className="flex items-start gap-2.5 bg-[#18181b]/50 p-2.5 rounded-lg border border-slate-800/40">
								<span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
									3
								</span>
								<div>
									Enable <strong className="text-white">Developer Mode</strong> toggle in the top-right corner of the extensions page.
								</div>
							</li>

							<li className="flex items-start gap-2.5 bg-[#18181b]/50 p-2.5 rounded-lg border border-slate-800/40">
								<span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
									4
								</span>
								<div>
									Click <strong className="text-white">Load unpacked</strong> and select the opened extension directory!
								</div>
							</li>
						</ol>
					</div>

					<div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 flex items-start gap-2">
						<ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
						<div>
							Once loaded, the extension icon will display live <strong>ON</strong> status and automatically inject smart autofill buttons into web login & payment forms!
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="px-6 py-3 border-t border-slate-800 bg-[#18181b] flex items-center justify-between text-xs text-slate-400">
					<span>SafeVaultPro Extension</span>
					<button
						onClick={onClose}
						className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-md transition-colors"
					>
						Done
					</button>
				</div>
			</div>
		</div>
	);
};
