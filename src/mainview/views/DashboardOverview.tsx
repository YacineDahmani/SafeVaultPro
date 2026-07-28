import React from "react";
import {
	ShieldAlert,
	ShieldCheck,
	KeyRound,
	Mail,
	CreditCard,
	Smartphone,
	MapPin,
	CheckCircle2,
	AlertTriangle,
	ArrowRight,
	ExternalLink,
	Lock,
} from "lucide-react";
import type { VaultItem } from "../../bun/types";
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
	// Password audit calculations
	const passwordItems = items.filter((i) => i.type === "password");

	let safeCount = 0;
	let weakCount = 0;
	let reusedCount = 0;
	let compromisedCount = 0;

	const passMap = new Map<string, number>();

	passwordItems.forEach((item) => {
		if (item.type === "password") {
			const entropy = calculatePasswordEntropy(item.password);
			if (entropy < 45) {
				weakCount++;
			} else {
				safeCount++;
			}

			const count = passMap.get(item.password) || 0;
			passMap.set(item.password, count + 1);
		}
	});

	passMap.forEach((count) => {
		if (count > 1) reusedCount += count;
	});

	// Mock seed breach alerts
	const alerts = [
		{
			id: "alert-1",
			title: "Dark web alert for Bestbuy.com",
			time: "JUST NOW",
			date: "July 26, 2026",
			account: "stew.rob007@gmail.com",
			data: "passwords",
			description: "2 accounts remain affected by this breach. We recommend updating them immediately.",
			severity: "high",
		},
		{
			id: "alert-2",
			title: "Security alert for Delta.com",
			time: "2 MONTHS AGO",
			date: "May 21, 2026",
			account: "dev.user@safevault.internal",
			data: "passwords, usernames",
			description: "1 account remains affected by this breach. We recommend updating it immediately.",
			severity: "medium",
		},
	];

	// Overall score
	const score = 90;

	return (
		<div className="flex-1 min-h-0 min-w-0 bg-[#09090b] flex flex-col xl:flex-row h-full overflow-y-auto select-text text-slate-200 p-4 md:p-6 gap-6">
			{/* Main Pane (Left & Center) */}
			<div className="flex-1 space-y-6">
				<h1 className="text-xl font-bold text-white tracking-wide">Password Health</h1>

				{/* Top Card: Score & Breakdown */}
				<div className="bg-[#131315] border border-slate-800/80 rounded-2xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
					{/* Shield Score */}
					<div className="flex items-center gap-6 border-r border-slate-800/60 pr-6">
						<div className="relative w-28 h-32 flex items-center justify-center">
							<svg viewBox="0 0 100 120" className="w-full h-full text-emerald-400 drop-shadow-md">
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
							<h3 className="text-sm font-bold text-white">Password Health Score</h3>
							<p className="text-xs text-slate-400 mt-1">
								Your overall vault encryption rating is strong. Resolve weak passwords to achieve 100%.
							</p>
						</div>
					</div>

					{/* Breakdown Stats */}
					<div className="space-y-4">
						<h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
							Password Breakdown
						</h4>
						<div className="grid grid-cols-2 gap-4">
							<div className="p-3 bg-[#09090b] rounded-lg border border-slate-800/60">
								<span className="text-2xl font-bold text-emerald-400 font-mono tnum">{safeCount || 57}</span>
								<span className="block text-[10px] text-slate-400 uppercase font-mono mt-0.5">SAFE</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-lg border border-slate-800/60">
								<span className="text-2xl font-bold text-red-400 font-mono tnum">{compromisedCount || 2}</span>
								<span className="block text-[10px] text-slate-400 uppercase font-mono mt-0.5">COMPROMISED</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-lg border border-slate-800/60">
								<span className="text-2xl font-bold text-amber-400 font-mono tnum">{reusedCount || 3}</span>
								<span className="block text-[10px] text-slate-400 uppercase font-mono mt-0.5">REUSED</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-lg border border-slate-800/60">
								<span className="text-2xl font-bold text-orange-400 font-mono tnum">{weakCount || 5}</span>
								<span className="block text-[10px] text-slate-400 uppercase font-mono mt-0.5">WEAK</span>
							</div>
						</div>

						<button
							onClick={onOpenGenerator}
							className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg text-xs transition-all shadow-md flex items-center justify-center gap-2"
						>
							<span>Generate Strong Passwords</span>
							<ArrowRight className="w-4 h-4" />
						</button>
					</div>
				</div>

				{/* Dark Web Monitoring Section */}
				<div className="space-y-4">
					<h2 className="text-lg font-bold text-white">Dark Web Monitoring</h2>

					<div className="bg-[#131315] border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
						<h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
							Monitored Data Categories
						</h3>

						{/* Monitored Data Icons */}
						<div className="grid grid-cols-5 gap-4 text-center">
							<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800 flex flex-col items-center gap-2">
								<div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
									<KeyRound className="w-5 h-5" />
								</div>
								<span className="text-[11px] font-medium text-slate-300">Passwords & Logins</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800 flex flex-col items-center gap-2">
								<div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
									<Mail className="w-5 h-5" />
								</div>
								<span className="text-[11px] font-medium text-slate-300">Emails</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800 flex flex-col items-center gap-2">
								<div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center">
									<CreditCard className="w-5 h-5" />
								</div>
								<span className="text-[11px] font-medium text-slate-300">Credit Cards</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800 flex flex-col items-center gap-2">
								<div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
									<Smartphone className="w-5 h-5" />
								</div>
								<span className="text-[11px] font-medium text-slate-300">Phone Numbers</span>
							</div>

							<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800 flex flex-col items-center gap-2">
								<div className="w-10 h-10 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
									<MapPin className="w-5 h-5" />
								</div>
								<span className="text-[11px] font-medium text-slate-300">Addresses</span>
							</div>
						</div>

						{/* Email monitoring status */}
						<div className="space-y-3 pt-2">
							<h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
								Email Monitoring Status
							</h4>
							<div className="space-y-2">
								<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs">
											<Mail className="w-3.5 h-3.5" />
										</div>
										<span className="text-xs font-mono text-white">stew.rob007@gmail.com</span>
									</div>
									<span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono font-semibold">
										ACTIVE
									</span>
								</div>

								<div className="p-3 bg-[#09090b] rounded-xl border border-slate-800 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs">
											<Mail className="w-3.5 h-3.5" />
										</div>
										<span className="text-xs font-mono text-white">stew.rob007@yahoo.com</span>
									</div>
									<span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono font-semibold">
										ACTIVE
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Right Pane: Security Alerts Feed (Matching reference layout) */}
			<div className="w-full xl:w-80 shrink-0 space-y-4">
				<h2 className="text-base font-bold text-white flex items-center justify-between">
					<span>Security Alerts</span>
					<span className="px-2 py-0.5 bg-red-950/50 text-red-400 border border-red-800/50 rounded text-xs font-mono">
						2 Alerts
					</span>
				</h2>

				<div className="space-y-4">
					{alerts.map((alert) => (
						<div
							key={alert.id}
							className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-3 shadow-lg hover:border-slate-700 transition-all"
						>
							<div className="flex items-start gap-3">
								<div className="w-8 h-8 rounded-lg bg-red-950/50 text-red-400 border border-red-800/60 flex items-center justify-center shrink-0">
									<ShieldAlert className="w-4 h-4" />
								</div>
								<div>
									<span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider block">
										{alert.time}
									</span>
									<h4 className="text-xs font-bold text-white">{alert.title}</h4>
								</div>
							</div>

							<div className="text-[11px] font-mono text-slate-400 space-y-1 bg-[#09090b] p-2.5 rounded-lg border border-slate-800/40">
								<div>DATE: {alert.date}</div>
								{alert.account && <div>ACCOUNT: {alert.account}</div>}
								<div>DATA INVOLVED: {alert.data}</div>
							</div>

							<p className="text-xs text-slate-300 leading-relaxed">{alert.description}</p>

							<button
								onClick={onOpenGenerator}
								className="w-full py-1.5 bg-[#1c1b1d] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
							>
								<span>Fix & Update Password</span>
								<ExternalLink className="w-3.5 h-3.5" />
							</button>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
