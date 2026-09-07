import React, { useState } from "react";
import {
	ShieldCheck,
	KeyRound,
	CheckCircle2,
	AlertTriangle,
	ArrowRight,
	ExternalLink,
	ShieldAlert,
	Smartphone,
	Zap,
	Plus,
	Filter,
	Sparkles,
} from "lucide-react";
import type { VaultItem, PasswordVaultItem } from "../../bun/types";
import { calculatePasswordEntropy, generatePassword } from "../../bun/crypto/vaultCrypto";

interface DashboardOverviewProps {
	items: VaultItem[];
	onSelectItem: (id: string) => void;
	onOpenGenerator: () => void;
	onAdd2fa?: (issuer: string, accountName: string) => void;
	onFixPassword?: (item: PasswordVaultItem, newPassword: string) => void;
}

type IssueFilter = "all" | "weak" | "reused" | "no2fa";

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
	items,
	onSelectItem,
	onOpenGenerator,
	onAdd2fa,
	onFixPassword,
}) => {
	const [activeFilter, setActiveFilter] = useState<IssueFilter>("all");

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

	// Filtered issues based on user selection
	const filteredAccounts = vulnerableAccounts.filter((acc) => {
		if (activeFilter === "weak") return acc.isWeak;
		if (activeFilter === "reused") return acc.reuseCount > 1;
		if (activeFilter === "no2fa") return !acc.has2fa;
		return true;
	});

	// Direct resolution handlers
	const handleResolve2fa = (item: PasswordVaultItem) => {
		if (onAdd2fa) {
			const domain = (item.url || "")
				.toLowerCase()
				.replace(/^(https?:\/\/)?(www\.)?/, "")
				.split("/")[0];
			const issuer = domain || item.title;
			onAdd2fa(issuer, item.username || "Account");
		} else {
			onSelectItem(item.id);
		}
	};

	const handleResolvePassword = (item: PasswordVaultItem) => {
		if (onFixPassword) {
			const newPass = generatePassword({ length: 20 });
			onFixPassword(item, newPass);
		} else {
			onSelectItem(item.id);
		}
	};

	// Direct, accurate status description based on actual vulnerabilities
	const getStatusDescription = () => {
		if (totalPasswords === 0) return "No passwords stored in vault.";
		if (weakCount === 0 && reusedCount === 0 && missing2faCount === 0) {
			return "All passwords strong with 2FA enabled. No reuse.";
		}
		if (weakCount === 0 && reusedCount === 0) {
			return `${missing2faCount} ${missing2faCount === 1 ? "account lacks" : "accounts lack"} 2FA.`;
		}
		if (weakCount > 0 && reusedCount > 0) {
			return `${weakCount} weak and ${reusedCount} reused passwords found.`;
		}
		if (reusedCount > 0) {
			return `${reusedCount} reused ${reusedCount === 1 ? "password" : "passwords"} detected.`;
		}
		return `${weakCount} weak ${weakCount === 1 ? "password" : "passwords"} detected.`;
	};

	// Proportional breakdown based directly on total passwords (summing to 100%)
	const safePct = totalPasswords > 0 ? (safeCount / totalPasswords) * 100 : 0;
	const weakPct = totalPasswords > 0 ? (weakCount / totalPasswords) * 100 : 0;
	const reusedPct = totalPasswords > 0 ? (reusedCount / totalPasswords) * 100 : 0;

	return (
		<div className="flex-1 min-h-0 min-w-0 bg-[#09090b] flex flex-col xl:flex-row h-full overflow-y-auto select-text text-slate-200 p-5 md:p-6 gap-6 font-sans">
			{/* Left Column: Health Overview */}
			<div className="flex-1 min-w-0 space-y-6">
				<div>
					<h1 className="text-base font-bold text-white tracking-tight">Password Health</h1>
					<p className="text-xs text-slate-400 mt-0.5">
						Audit password strength, reuse, and 2FA.
					</p>
				</div>

				{/* Health Status Dashboard Card */}
				<div className="bg-[#131315] border border-slate-800/80 rounded-xl p-5 shadow-2xl space-y-5">
					{/* Top Row: Score & Diagnostic Posture */}
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/70">
						<div className="flex items-center gap-4">
							{/* Sleek Minimalist Shield Badge */}
							<div className="relative w-14 h-16 flex items-center justify-center shrink-0">
								<svg
									viewBox="0 0 100 120"
									className={`w-full h-full transition-all drop-shadow-[0_0_10px_rgba(16,185,129,0.2)] ${
										score >= 80 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500"
									}`}
								>
									<path
										d="M 50 8 L 90 26 V 68 C 90 94 50 112 50 112 C 50 112 10 94 10 68 V 26 Z"
										fill="none"
										stroke="currentColor"
										strokeWidth="4"
										strokeLinejoin="round"
									/>
								</svg>
								<span className="absolute text-xl font-bold text-white font-mono tnum tracking-tight">{score}</span>
							</div>

							<div>
								<div className="flex items-center gap-2">
									<h2 className="text-sm font-bold text-white tracking-tight">Vault Health</h2>
									<span
										className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${
											score >= 85
												? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
												: score >= 60
												? "bg-amber-950/60 text-amber-400 border-amber-800/60"
												: "bg-red-950/60 text-red-400 border-red-800/60"
										}`}
									>
										{score >= 85 ? "Good" : score >= 60 ? "Warning" : "Critical"}
									</span>
								</div>
								<p className="text-xs text-slate-400 mt-1">
									{getStatusDescription()}
								</p>
							</div>
						</div>

						<button
							onClick={onOpenGenerator}
							className="self-start sm:self-center py-2 px-3.5 bg-[#18181b] hover:bg-slate-800 active:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 hover:border-emerald-500/50 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 group shrink-0"
						>
							<Zap className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
							<span>Password Generator</span>
						</button>
					</div>

					{/* Middle: 4 Diagnostic Metrics Strip */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
						<button
							onClick={() => setActiveFilter("all")}
							className={`p-3 rounded-lg border text-left transition-all ${
								activeFilter === "all"
									? "bg-[#1c1b1d] border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.12)]"
									: "bg-[#0e0e10] border-slate-800/80 hover:border-slate-700"
							}`}
						>
							<span className="text-[10px] text-slate-400 uppercase font-mono font-medium tracking-wider block mb-1">Safe</span>
							<span className="text-xl font-bold text-emerald-400 font-mono tnum block leading-tight">{safeCount}</span>
						</button>

						<button
							onClick={() => setActiveFilter("weak")}
							className={`p-3 rounded-lg border text-left transition-all ${
								activeFilter === "weak"
									? "bg-[#1c1b1d] border-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.12)]"
									: "bg-[#0e0e10] border-slate-800/80 hover:border-orange-500/30"
							}`}
						>
							<span className="text-[10px] text-slate-400 uppercase font-mono font-medium tracking-wider block mb-1">Weak</span>
							<span className="text-xl font-bold text-orange-400 font-mono tnum block leading-tight">{weakCount}</span>
						</button>

						<button
							onClick={() => setActiveFilter("reused")}
							className={`p-3 rounded-lg border text-left transition-all ${
								activeFilter === "reused"
									? "bg-[#1c1b1d] border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.12)]"
									: "bg-[#0e0e10] border-slate-800/80 hover:border-amber-500/30"
							}`}
						>
							<span className="text-[10px] text-slate-400 uppercase font-mono font-medium tracking-wider block mb-1">Reused</span>
							<span className="text-xl font-bold text-amber-400 font-mono tnum block leading-tight">{reusedCount}</span>
						</button>

						<button
							onClick={() => setActiveFilter("no2fa")}
							className={`p-3 rounded-lg border text-left transition-all ${
								activeFilter === "no2fa"
									? "bg-[#1c1b1d] border-blue-500/60 shadow-[0_0_12px_rgba(59,130,246,0.12)]"
									: "bg-[#0e0e10] border-slate-800/80 hover:border-blue-500/30"
							}`}
						>
							<span className="text-[10px] text-slate-400 uppercase font-mono font-medium tracking-wider block mb-1">No 2FA</span>
							<span className="text-xl font-bold text-blue-400 font-mono tnum block leading-tight">{missing2faCount}</span>
						</button>
					</div>

					{/* Bottom: Password Distribution Bar */}
					{totalPasswords > 0 && (
						<div className="pt-3 border-t border-slate-800/70 space-y-2">
							<div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
								<span className="text-slate-400">Password Distribution</span>
								<span className="tnum text-slate-300">{totalPasswords} passwords</span>
							</div>
							<div className="h-1.5 w-full bg-[#09090b] rounded-full overflow-hidden flex gap-1 p-0.5 border border-slate-800/80">
								{safeCount > 0 && (
									<div
										style={{ width: `${safePct}%` }}
										className="h-full bg-emerald-500 rounded-full transition-all duration-500"
										title={`Safe: ${safeCount}`}
									/>
								)}
								{reusedCount > 0 && (
									<div
										style={{ width: `${reusedPct}%` }}
										className="h-full bg-amber-400 rounded-full transition-all duration-500"
										title={`Reused: ${reusedCount}`}
									/>
								)}
								{weakCount > 0 && (
									<div
										style={{ width: `${weakPct}%` }}
										className="h-full bg-orange-400 rounded-full transition-all duration-500"
										title={`Weak: ${weakCount}`}
									/>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Right Column: Direct Resolution Feed */}
			<div className="w-full xl:w-[420px] shrink-0 space-y-4">
				{/* Filter Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h2 className="text-sm font-bold text-white">Issues</h2>
						<span className={`px-2 py-0.5 rounded text-xs font-mono border ${
							vulnerableAccounts.length > 0
								? 'bg-amber-950/50 text-amber-400 border-amber-800/50 font-bold'
								: 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50'
						}`}>
							{vulnerableAccounts.length}
						</span>
					</div>

					{/* Interactive Filter Pills */}
					<div className="flex items-center gap-1 bg-[#131315] p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
						<button
							onClick={() => setActiveFilter("all")}
							className={`px-2 py-1 rounded transition-colors ${
								activeFilter === "all" ? "bg-[#1c1b1d] text-white font-bold" : "text-slate-400 hover:text-slate-200"
							}`}
						>
							All
						</button>
						<button
							onClick={() => setActiveFilter("weak")}
							className={`px-2 py-1 rounded transition-colors ${
								activeFilter === "weak" ? "bg-orange-950/60 text-orange-300 font-bold" : "text-slate-400 hover:text-slate-200"
							}`}
						>
							Weak
						</button>
						<button
							onClick={() => setActiveFilter("reused")}
							className={`px-2 py-1 rounded transition-colors ${
								activeFilter === "reused" ? "bg-amber-950/60 text-amber-300 font-bold" : "text-slate-400 hover:text-slate-200"
							}`}
						>
							Reused
						</button>
						<button
							onClick={() => setActiveFilter("no2fa")}
							className={`px-2 py-1 rounded transition-colors ${
								activeFilter === "no2fa" ? "bg-blue-950/60 text-blue-300 font-bold" : "text-slate-400 hover:text-slate-200"
							}`}
						>
							2FA
						</button>
					</div>
				</div>

				{/* Issue Cards */}
				<div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
					{filteredAccounts.length === 0 ? (
						<div className="p-6 bg-[#131315] border border-slate-800/80 rounded-xl text-center space-y-2">
							<div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
								<CheckCircle2 className="w-5 h-5" />
							</div>
							<div>
								<h4 className="text-sm font-bold text-white">
									{activeFilter === "all" ? "No Issues" : `No ${activeFilter} issues`}
								</h4>
								<p className="text-xs text-slate-400 mt-0.5">
									{activeFilter === "all"
										? "All passwords are strong with no reuse."
										: "No items match this filter."}
								</p>
							</div>
						</div>
					) : (
						filteredAccounts.map(({ item, isWeak, entropy, reuseCount, has2fa }) => {
							const needsPasswordFix = isWeak || reuseCount > 1;

							return (
								<div
									key={item.id}
									className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-3 shadow-lg hover:border-slate-700 transition-all"
								>
									{/* Item Header */}
									<div className="flex items-start justify-between gap-2">
										<div className="flex items-center gap-2.5 min-w-0">
											<div className="w-8 h-8 rounded-lg bg-[#18181b] border border-slate-800 text-slate-200 flex items-center justify-center shrink-0">
												<KeyRound className="w-4 h-4 text-emerald-400" />
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
											title="Open item"
										>
											<ExternalLink className="w-4 h-4" />
										</button>
									</div>

									{/* Badges */}
									<div className="flex flex-wrap gap-1.5 pt-0.5">
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
											<span className="px-2 py-0.5 bg-blue-950/60 text-blue-300 border border-blue-800/60 rounded text-[10px] font-mono font-medium flex items-center gap-1">
												<Smartphone className="w-3 h-3" />
												Needs 2FA
											</span>
										)}
									</div>

									{/* Direct Problem Resolution Action Buttons */}
									<div className="grid grid-cols-2 gap-2 pt-1">
										{/* Action 1: Fix Password if weak/reused, or Edit */}
										{needsPasswordFix ? (
											<button
												onClick={() => handleResolvePassword(item)}
												className="py-1.5 px-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
												title="Generate and apply replacement password"
											>
												<Zap className="w-3.5 h-3.5 text-emerald-400" />
												<span>Fix Password</span>
											</button>
										) : (
											<button
												onClick={() => onSelectItem(item.id)}
												className="py-1.5 px-3 bg-[#18181b] hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
											>
												<span>View</span>
											</button>
										)}

										{/* Action 2: Direct Add 2FA if missing 2FA */}
										{!has2fa ? (
											<button
												onClick={() => handleResolve2fa(item)}
												className="py-1.5 px-3 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
												title="Create 2FA item"
											>
												<Plus className="w-3.5 h-3.5 text-blue-400" />
												<span>Add 2FA</span>
											</button>
										) : (
											<button
												onClick={() => onSelectItem(item.id)}
												className="py-1.5 px-3 bg-[#18181b] hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
											>
												<span>Edit</span>
												<ArrowRight className="w-3.5 h-3.5" />
											</button>
										)}
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
};

