import React from "react";
import {
	ShieldCheck,
	KeyRound,
	CheckCircle2,
	AlertTriangle,
	ArrowRight,
	ExternalLink,
	ShieldAlert,
	Smartphone,
} from "lucide-react";
import type { VaultItem, PasswordVaultItem } from "../../bun/types";
import { calculatePasswordEntropy } from "../../bun/crypto/vaultCrypto";

interface DashboardOverviewProps {
	items: VaultItem[];
	onSelectItem: (id: string) => void;
	onOpenGenerator: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
	items,
	onSelectItem,
	onOpenGenerator,
}) => {
	// Filter passwords and 2FA secrets from actual vault items
	const passwordItems = items.filter((i): i is PasswordVaultItem => i.type === "password");
	const totpItems = items.filter((i) => i.type === "totp");

	let safeCount = 0;
	let weakCount = 0;
	let reusedCount = 0;
	let missing2faCount = 0;

	// Track password frequency for reuse calculation
	const passFrequency = new Map<string, number>();
	passwordItems.forEach((item) => {
		const count = passFrequency.get(item.password) || 0;
		passFrequency.set(item.password, count + 1);
	});

	// Audit each password item
	interface VulnerableAccount {
		item: PasswordVaultItem;
		isWeak: boolean;
		entropy: number;
		reuseCount: number;
		has2fa: boolean;
	}

	const vulnerableAccounts: VulnerableAccount[] = [];

	passwordItems.forEach((item) => {
		const entropy = calculatePasswordEntropy(item.password);
		const isWeak = entropy < 45;
		const reuseCount = passFrequency.get(item.password) || 1;
		const isReused = reuseCount > 1;

		// Check if domain or title has a matching 2FA secret
		const itemDomain = (item.url || "").toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
		const itemTitle = item.title.toLowerCase();
		const has2fa = totpItems.some((totpItem: any) => {
			const issuer = (totpItem.issuer || totpItem.title || "").toLowerCase();
			const account = (totpItem.accountName || "").toLowerCase();
			return (
				(itemDomain && (issuer.includes(itemDomain) || account.includes(itemDomain))) ||
				(itemTitle && (issuer.includes(itemTitle) || itemTitle.includes(issuer)))
			);
		});

		if (isWeak) weakCount++;
		if (isReused) reusedCount++;
		if (!has2fa) missing2faCount++;
		if (!isWeak && !isReused) safeCount++;

		if (isWeak || isReused || !has2fa) {
			vulnerableAccounts.push({
				item,
				isWeak,
				entropy,
				reuseCount,
				has2fa,
			});
		}
	});

	// Calculate overall score (0 to 100) dynamically
	const totalPasswords = passwordItems.length;
	let score = 100;
	if (totalPasswords > 0) {
		const weakPenalty = weakCount * 25;
		const reusedPenalty = reusedCount * 20;
		const missing2faPenalty = missing2faCount * 5;
		const totalPenalty = (weakPenalty + reusedPenalty + missing2faPenalty) / totalPasswords;
		score = Math.max(15, Math.min(100, Math.round(100 - totalPenalty)));
	}

	return (
		<div className="flex-1 min-h-0 min-w-0 bg-[#09090b] flex flex-col xl:flex-row h-full overflow-y-auto select-text text-slate-200 p-4 md:p-6 gap-6">
			{/* Main Pane */}
			<div className="flex-1 space-y-6">
				<h1 className="text-xl font-bold text-white tracking-wide">Password Health Center</h1>

				{/* Top Card: Score & Breakdown */}
				<div className="bg-[#131315] border border-slate-800/80 rounded-2xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
					{/* Shield Score */}
					<div className="flex items-center gap-6 border-r border-slate-800/60 pr-6">
						<div className="relative w-28 h-32 flex items-center justify-center">
							<svg viewBox="0 0 100 120" className={`w-full h-full drop-shadow-md ${score > 80 ? 'text-emerald-400' : score > 50 ? 'text-amber-400' : 'text-red-400'}`}>
								<path
									d="M 50 10 L 90 30 V 70 C 90 95 50 110 50 110 C 50 110 10 95 10 70 V 30 Z"
									fill="none"
									stroke="currentColor"
									strokeWidth="4"
									strokeLinejoin="round"
								/>
							</svg>
							<span className="absolute text-3xl font-bold text-white font-mono tnum">{score}</span>
						</div>

						<div>
							<h3 className="text-sm font-bold text-white">Security Rating</h3>
							<p className="text-xs text-slate-400 mt-1">
								{score >= 90
									? "Excellent! Your passwords demonstrate strong entropy and zero unsafe reuses."
									: score >= 70
									? "Good protection. Strengthen weak passwords to achieve a perfect 100% score."
									: "Security risks detected. Please replace weak or reused credentials immediately."}
							</p>
						</div>
					</div>

					{/* Real Breakdown Stats */}
					<div className="space-y-4">
						<h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
							Vault Password Audit
						</h4>
						<div className="grid grid-cols-2 gap-3">
							<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800/60">
								<span className="text-2xl font-bold text-emerald-400 font-mono tnum">{safeCount}</span>
								<span className="block text-[10px] text-slate-400 uppercase font-mono mt-0.5">SAFE PASSWORDS</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800/60">
								<span className="text-2xl font-bold text-orange-400 font-mono tnum">{weakCount}</span>
								<span className="block text-[10px] text-slate-400 uppercase font-mono mt-0.5">WEAK PASSWORDS</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800/60">
								<span className="text-2xl font-bold text-amber-400 font-mono tnum">{reusedCount}</span>
								<span className="block text-[10px] text-slate-400 uppercase font-mono mt-0.5">REUSED PASSWORDS</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800/60">
								<span className="text-2xl font-bold text-blue-400 font-mono tnum">{missing2faCount}</span>
								<span className="block text-[10px] text-slate-400 uppercase font-mono mt-0.5">NO 2FA SECRET</span>
							</div>
						</div>

						<button
							onClick={onOpenGenerator}
							className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-2"
						>
							<span>Generate Strong Password</span>
							<ArrowRight className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Vault Hygiene Overview Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-2">
						<div className="flex items-center gap-2 text-emerald-400">
							<ShieldCheck className="w-5 h-5" />
							<span className="text-xs font-bold text-white">Local Zero-Knowledge</span>
						</div>
						<p className="text-xs text-slate-400">
							All credentials remain encrypted strictly on device. No unencrypted data ever leaves your computer.
						</p>
					</div>

					<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-2">
						<div className="flex items-center gap-2 text-blue-400">
							<KeyRound className="w-5 h-5" />
							<span className="text-xs font-bold text-white">Entropy Analysis</span>
						</div>
						<p className="text-xs text-slate-400">
							Calculates character set diversity and bit entropy to ensure resilience against brute-force attacks.
						</p>
					</div>

					<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-2">
						<div className="flex items-center gap-2 text-purple-400">
							<Smartphone className="w-5 h-5" />
							<span className="text-xs font-bold text-white">Integrated 2FA Engine</span>
						</div>
						<p className="text-xs text-slate-400">
							Clock-synced local TOTP generator eliminates SMS vulnerability and streamlines login verification.
						</p>
					</div>
				</div>
			</div>

			{/* Right Pane: Live Actionable Vulnerable Credentials Audit Feed */}
			<div className="w-full xl:w-96 shrink-0 space-y-4">
				<h2 className="text-base font-bold text-white flex items-center justify-between">
					<span>Actionable Vault Audit</span>
					<span className={`px-2 py-0.5 rounded text-xs font-mono border ${vulnerableAccounts.length > 0 ? 'bg-amber-950/50 text-amber-400 border-amber-800/50' : 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50'}`}>
						{vulnerableAccounts.length} {vulnerableAccounts.length === 1 ? 'Notice' : 'Notices'}
					</span>
				</h2>

				<div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
					{vulnerableAccounts.length === 0 ? (
						<div className="p-6 bg-[#131315] border border-emerald-500/30 rounded-2xl text-center space-y-3">
							<div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
								<CheckCircle2 className="w-6 h-6" />
							</div>
							<div>
								<h4 className="text-sm font-bold text-white">All Passwords Secure</h4>
								<p className="text-xs text-slate-400 mt-1">
									No weak, reused, or un-backed 2FA passwords were found in your vault.
								</p>
							</div>
						</div>
					) : (
						vulnerableAccounts.map(({ item, isWeak, entropy, reuseCount, has2fa }) => (
							<div
								key={item.id}
								className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-3 shadow-lg hover:border-slate-700 transition-all"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="flex items-center gap-2.5 min-w-0">
										<div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center shrink-0">
											<KeyRound className="w-4 h-4" />
										</div>
										<div className="min-w-0">
											<h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
											<span className="text-[11px] text-slate-400 font-mono truncate block">
												{item.username || "No username"}
											</span>
										</div>
									</div>

									<button
										onClick={() => onSelectItem(item.id)}
										className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
										title="Open Item in Workspace"
									>
										<ExternalLink className="w-4 h-4" />
									</button>
								</div>

								{/* Risk Badges */}
								<div className="flex flex-wrap gap-1.5 pt-1">
									{isWeak && (
										<span className="px-2 py-0.5 bg-red-950/60 text-red-300 border border-red-800/60 rounded text-[10px] font-mono font-medium flex items-center gap-1">
											<AlertTriangle className="w-3 h-3" />
											Weak ({entropy} bits)
										</span>
									)}
									{reuseCount > 1 && (
										<span className="px-2 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-800/60 rounded text-[10px] font-mono font-medium flex items-center gap-1">
											<ShieldAlert className="w-3 h-3" />
											Reused ({reuseCount}x)
										</span>
									)}
									{!has2fa && (
										<span className="px-2 py-0.5 bg-blue-950/60 text-blue-300 border border-blue-800/60 rounded text-[10px] font-mono font-medium">
											Needs 2FA
										</span>
									)}
								</div>

								<button
									onClick={() => onSelectItem(item.id)}
									className="w-full py-1.5 bg-[#18181b] hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
								>
									<span>Edit & Fix Account</span>
									<ArrowRight className="w-3.5 h-3.5" />
								</button>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
};
