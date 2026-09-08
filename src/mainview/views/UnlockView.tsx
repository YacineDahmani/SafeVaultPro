import React, { useState, useEffect } from "react";
import { SafeVaultLogo } from "../components/SafeVaultLogo";
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, AlertTriangle, ArrowRight, Trash2, X } from "lucide-react";
import { calculatePasswordEntropy } from "../../bun/crypto/vaultCrypto";
import { useWindowVisibility } from "../hooks/useWindowVisibility";

interface UnlockViewProps {
	isConfigured: boolean;
	onUnlock: (password: string) => Promise<boolean>;
}

export const UnlockView: React.FC<UnlockViewProps> = ({ isConfigured, onUnlock }) => {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [failedAttempts, setFailedAttempts] = useState(0);
	const [cooldown, setCooldown] = useState(0);
	const [isShaking, setIsShaking] = useState(false);
	const [showWipeConfirmModal, setShowWipeConfirmModal] = useState(false);

	// Calculate entropy for setup mode
	const entropy = calculatePasswordEntropy(password);
	const getEntropyLabel = (e: number) => {
		if (e < 40) return { text: "Weak", color: "text-red-400", bg: "bg-red-500" };
		if (e < 70) return { text: "Fair", color: "text-amber-400", bg: "bg-amber-500" };
		return { text: "Strong", color: "text-emerald-400", bg: "bg-emerald-500" };
	};

	const { isVisible } = useWindowVisibility();

	// Cooldown timer (pauses when minimized / hidden)
	useEffect(() => {
		if (cooldown <= 0 || !isVisible) return;
		const timer = setInterval(() => {
			setCooldown((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, [cooldown, isVisible]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (cooldown > 0 || isSubmitting) return;

		setErrorMsg("");

		if (!isConfigured) {
			if (password.length < 10) {
				setErrorMsg("Password must be at least 10 characters.");
				triggerShake();
				return;
			}
			if (password !== confirmPassword) {
				setErrorMsg("Passwords do not match.");
				triggerShake();
				return;
			}
		}

		setIsSubmitting(true);
		try {
			const success = await onUnlock(password);
			if (!success) {
				handleFailedAttempt();
			}
		} catch (err: any) {
			handleFailedAttempt(err.message || "Incorrect password");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleFailedAttempt = (msg = "Incorrect password") => {
		const newAttempts = failedAttempts + 1;
		setFailedAttempts(newAttempts);
		setErrorMsg(msg);
		triggerShake();

		if (newAttempts >= 3) {
			const penaltySeconds = Math.pow(2, newAttempts - 3) * 10;
			setCooldown(penaltySeconds);
			setErrorMsg(`Too many failed attempts. Try again in ${penaltySeconds} seconds.`);
		}
	};

	const triggerShake = () => {
		setIsShaking(true);
		setTimeout(() => setIsShaking(false), 400);
	};

	const strength = getEntropyLabel(entropy);

	return (
		<div className="h-full w-full bg-[#09090b] flex items-center justify-center p-6 text-[#e5e1e4] relative overflow-hidden flex-1">
			{/* Dynamic Background Glow */}
			<div
				className={`absolute inset-0 transition-opacity duration-1000 ${
					isSubmitting
						? "bg-blue-500/10 animate-pulse-glow"
						: errorMsg
						? "bg-red-500/10"
						: "bg-emerald-500/10"
				}`}
			/>

			{/* Smooth Glass Background Glow */}
			<div className="absolute inset-0 bg-gradient-to-b from-[#131315]/40 via-transparent to-[#09090b] pointer-events-none" />

			<div className="w-full max-w-md relative z-10">
				{/* Top Identity Hero Logo */}
				<div className="text-center mb-6 flex flex-col items-center">
					<div className="relative mb-4 flex items-center justify-center">
						<div
							className={`absolute -inset-4 rounded-full blur-2xl opacity-60 transition-all duration-700 pointer-events-none ${
								isSubmitting
									? "bg-blue-500/40 animate-pulse"
									: errorMsg
									? "bg-red-500/40 animate-pulse"
									: "bg-emerald-500/35 hover:bg-emerald-500/50"
							}`}
						/>

						<div className="relative transition-transform duration-500 hover:scale-105 select-none">
							<SafeVaultLogo
								className={`w-24 h-24 drop-shadow-2xl transition-all duration-500 ${
									isSubmitting
										? "filter drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]"
										: errorMsg
										? "filter drop-shadow-[0_0_25px_rgba(239,68,68,0.6)]"
										: "filter drop-shadow-[0_10px_30px_rgba(16,185,129,0.45)]"
								}`}
								alt="SafeVaultPro"
							/>
						</div>
					</div>

					<h1 className="text-2xl font-bold tracking-tight text-white mb-1.5 flex items-center gap-1 justify-center">
						<span>SafeVault</span>
						<span className="text-emerald-400">Pro</span>
					</h1>
					<p className="text-xs text-slate-400 max-w-sm">
						{isConfigured
							? "Enter master password to unlock"
							: "Set a master password to protect your vault"}
					</p>
				</div>

				{/* Card Form */}
				<div
					className={`bg-[#131315] border border-slate-700/80 rounded-2xl p-6 shadow-2xl transition-all duration-300 ${
						isShaking ? "animate-shake border-red-500/80" : ""
					}`}
				>
					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Error / Cooldown Banner */}
						{errorMsg && (
							<div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg flex items-center gap-2.5 text-red-200 text-xs font-medium">
								<AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
								<span>{errorMsg}</span>
							</div>
						)}

						{/* Cooldown Display */}
						{cooldown > 0 && (
							<div className="text-center py-2 text-amber-400 font-mono text-sm">
								Locked. Try again in <span className="font-bold text-lg tnum">{cooldown}s</span>
							</div>
						)}

						{/* Password Field */}
						<div>
							<label className="block text-xs font-semibold text-slate-300 mb-1.5">
								{isConfigured ? "Master Password" : "Create Master Password"}
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
									<KeyRound className="w-4 h-4" />
								</div>
								<input
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									disabled={cooldown > 0 || isSubmitting}
									placeholder="••••••••••••••••"
									autoFocus
									className="w-full pl-9 pr-10 py-2.5 bg-[#09090b] border border-slate-700 rounded-lg text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
								>
									{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
								</button>
							</div>
						</div>

						{/* Password strength bar for setup mode */}
						{!isConfigured && password.length > 0 && (
							<div className="space-y-1.5 pt-1">
								<div className="flex justify-between text-xs font-mono">
									<span className="text-slate-400">{entropy} bits</span>
									<span className={`font-semibold ${strength.color}`}>{strength.text}</span>
								</div>
								<div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1 p-0.5">
									<div
										className={`h-full rounded-full transition-all duration-300 ${
											entropy > 15 ? strength.bg : "bg-slate-700"
										} w-1/3`}
									/>
									<div
										className={`h-full rounded-full transition-all duration-300 ${
											entropy > 45 ? strength.bg : "bg-slate-700"
										} w-1/3`}
									/>
									<div
										className={`h-full rounded-full transition-all duration-300 ${
											entropy > 75 ? strength.bg : "bg-slate-700"
										} w-1/3`}
									/>
								</div>
							</div>
						)}

						{/* Confirm Password Field for setup mode */}
						{!isConfigured && (
							<div>
								<label className="block text-xs font-semibold text-slate-300 mb-1.5">
									Confirm Password
								</label>
								<input
									type={showPassword ? "text" : "password"}
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="••••••••••••••••"
									className="w-full px-3 py-2.5 bg-[#09090b] border border-slate-700 rounded-lg text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
								/>
							</div>
						)}

						{/* Action Button */}
						<button
							type="submit"
							disabled={cooldown > 0 || isSubmitting || !password}
							className="w-full mt-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#003824] font-bold rounded-lg text-sm transition-all shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isSubmitting ? (
								<span className="flex items-center gap-2">
									<div className="w-4 h-4 border-2 border-[#003824] border-t-transparent rounded-full animate-spin" />
									Unlocking...
								</span>
							) : isConfigured ? (
								<>
									<span>Unlock</span>
									<ArrowRight className="w-4 h-4" />
								</>
							) : (
								<>
									<span>Create Vault</span>
									<ShieldCheck className="w-4 h-4" />
								</>
							)}
						</button>
					</form>
				</div>
			</div>

			{/* Wipe Confirmation Modal */}
			{showWipeConfirmModal && (
				<div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 animate-fade-in select-none">
					<div className="bg-[#131315] border border-red-900/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-200">
						<div className="p-5 border-b border-slate-800 flex items-center justify-between bg-red-950/20">
							<div className="flex items-center gap-2.5 text-red-400">
								<AlertTriangle className="w-5 h-5 shrink-0" />
								<h3 className="text-sm font-bold text-white">Reset Vault</h3>
							</div>
							<button
								type="button"
								onClick={() => setShowWipeConfirmModal(false)}
								className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						<div className="p-6 space-y-4 text-xs">
							<p className="text-slate-300 leading-relaxed">
								Reset local vault storage? All saved credentials will be replaced with sample data.
							</p>
						</div>

						<div className="p-4 bg-[#09090b] border-t border-slate-800 flex items-center justify-end gap-3">
							<button
								type="button"
								onClick={() => setShowWipeConfirmModal(false)}
								className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs transition-colors"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => {
									localStorage.clear();
									window.location.reload();
								}}
								className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-lg"
							>
								<Trash2 className="w-3.5 h-3.5" />
								<span>Reset Vault</span>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
