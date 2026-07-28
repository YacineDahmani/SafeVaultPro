import React, { useState, useEffect } from "react";
import appIcon from "../assets/icon.png";
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";
import { calculatePasswordEntropy } from "../../bun/crypto/vaultCrypto";

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

	// Calculate entropy for setup mode
	const entropy = calculatePasswordEntropy(password);
	const getEntropyLabel = (e: number) => {
		if (e < 40) return { text: "Weak Master Password", color: "text-red-400", bg: "bg-red-500" };
		if (e < 70) return { text: "Moderate Strength", color: "text-amber-400", bg: "bg-amber-500" };
		return { text: "Strong Master Key", color: "text-emerald-400", bg: "bg-emerald-500" };
	};

	// Cooldown timer
	useEffect(() => {
		if (cooldown <= 0) return;
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
	}, [cooldown]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (cooldown > 0 || isSubmitting) return;

		setErrorMsg("");

		if (!isConfigured) {
			if (password.length < 6) {
				setErrorMsg("Master password must be at least 6 characters.");
				triggerShake();
				return;
			}
			if (password !== confirmPassword) {
				setErrorMsg("Master passwords do not match.");
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
			handleFailedAttempt(err.message || "Invalid Master Password");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleFailedAttempt = (msg = "Invalid Master Password") => {
		const newAttempts = failedAttempts + 1;
		setFailedAttempts(newAttempts);
		setErrorMsg(msg);
		triggerShake();

		if (newAttempts >= 3) {
			const penaltySeconds = Math.pow(2, newAttempts - 3) * 10;
			setCooldown(penaltySeconds);
			setErrorMsg(`Too many failed attempts. Vault locked for ${penaltySeconds} seconds.`);
		}
	};

	const triggerShake = () => {
		setIsShaking(true);
		setTimeout(() => setIsShaking(false), 400);
	};

	const strength = getEntropyLabel(entropy);

	return (
		<div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 text-[#e5e1e4] relative overflow-hidden">
			{/* Dynamic Background Glow */}
			<div
				className={`absolute inset-0 transition-opacity duration-1000 ${
					isSubmitting
						? "bg-blue-500/10 backdrop-blur-3xl animate-pulse-glow"
						: errorMsg
						? "bg-red-500/5 backdrop-blur-3xl"
						: "bg-emerald-500/5 backdrop-blur-3xl"
				}`}
			/>

			{/* Smooth Glass Background Glow */}
			<div className="absolute inset-0 bg-gradient-to-b from-[#131315]/40 via-transparent to-[#09090b] pointer-events-none" />

			<div className="w-full max-w-md relative z-10">
				{/* Top Identity Shield Badge */}
				<div className="text-center mb-8 flex flex-col items-center">
					<div
						className={`w-16 h-16 rounded-2xl flex items-center justify-center border border-slate-800/80 mb-4 transition-all duration-500 overflow-hidden ${
							isSubmitting
								? "bg-blue-950/40 border-blue-500/50 glow-blue text-blue-400"
								: errorMsg
								? "bg-red-950/40 border-red-500/50 glow-red text-red-400"
								: "bg-[#141417] border-emerald-500/30 glow-emerald text-emerald-400"
						}`}
					>
						<img src={appIcon} alt="SafeVaultPro Icon" className="w-10 h-10 rounded-xl object-cover" />
					</div>

					<h1 className="text-2xl font-bold tracking-tight text-white mb-1">
						{isConfigured ? "SafeVaultPro" : "Initialize Master Vault"}
					</h1>
					<p className="text-xs text-slate-400">
						{isConfigured
							? "Enter your master password to decrypt local AES-256 vault"
							: "Create a strong master key to secure your encrypted vault store"}
					</p>
				</div>

				{/* Card Form */}
				<div
					className={`bg-[#131315] border border-slate-800/60 rounded-xl p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
						isShaking ? "animate-shake border-red-500/50" : ""
					}`}
				>
					<form onSubmit={handleSubmit} className="space-y-4">
						{/* Error / Cooldown Banner */}
						{errorMsg && (
							<div className="p-3 bg-red-950/50 border border-red-800/60 rounded-lg flex items-center gap-2.5 text-red-300 text-xs">
								<AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
								<span>{errorMsg}</span>
							</div>
						)}

						{/* Cooldown Display */}
						{cooldown > 0 && (
							<div className="text-center py-2 text-amber-400 font-mono text-sm">
								Vault locked. Retry in <span className="font-bold text-lg tnum">{cooldown}s</span>
							</div>
						)}

						{/* Password Field */}
						<div>
							<label className="block text-xs font-medium text-slate-400 mb-1.5">
								{isConfigured ? "Master Password" : "Create Master Password"}
							</label>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
									<KeyRound className="w-4 h-4" />
								</div>
								<input
									type={showPassword ? "text" : "password"}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									disabled={cooldown > 0 || isSubmitting}
									placeholder="••••••••••••••••"
									autoFocus
									className="w-full pl-9 pr-10 py-2.5 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all disabled:opacity-50"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
								>
									{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
								</button>
							</div>
						</div>

						{/* Password strength bar for setup mode */}
						{!isConfigured && password.length > 0 && (
							<div className="space-y-1.5 pt-1">
								<div className="flex justify-between text-[11px]">
									<span className="text-slate-400">Key Entropy: {entropy} bits</span>
									<span className={`font-medium ${strength.color}`}>{strength.text}</span>
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
								<label className="block text-xs font-medium text-slate-400 mb-1.5">
									Confirm Master Password
								</label>
								<input
									type={showPassword ? "text" : "password"}
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="••••••••••••••••"
									className="w-full px-3 py-2.5 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
								/>
							</div>
						)}

						{/* Action Button */}
						<button
							type="submit"
							disabled={cooldown > 0 || isSubmitting || !password}
							className="w-full mt-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-[#003824] font-semibold rounded-lg text-sm transition-all shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isSubmitting ? (
								<span className="flex items-center gap-2">
									<div className="w-4 h-4 border-2 border-[#003824] border-t-transparent rounded-full animate-spin" />
									Deriving Key (Argon2id)...
								</span>
							) : isConfigured ? (
								<>
									<span>Unlock Vault</span>
									<ArrowRight className="w-4 h-4" />
								</>
							) : (
								<>
									<span>Create Encrypted Vault</span>
									<ShieldCheck className="w-4 h-4" />
								</>
							)}
						</button>
					</form>
				</div>

				{/* Footer Metadata */}
				<div className="mt-6 text-center text-slate-500 text-[11px] font-mono flex flex-col items-center justify-center gap-2">
					<div className="flex items-center justify-center gap-4">
						<span>AES-256-GCM</span>
						<span>•</span>
						<span>Argon2id (64MB)</span>
						<span>•</span>
						<span>Zero-Knowledge</span>
					</div>
					<button
						type="button"
						onClick={() => {
							localStorage.clear();
							window.location.reload();
						}}
						className="text-slate-500 hover:text-red-400 underline text-[11px] font-sans cursor-pointer transition-colors mt-1"
					>
						Wipe Old Storage & Load New Seed Dataset
					</button>
				</div>
			</div>
		</div>
	);
};
