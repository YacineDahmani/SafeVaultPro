import React from "react";
import { SafeVaultLogo } from "./SafeVaultLogo";
import {
	Shield,
	KeyRound,
	FileText,
	User,
	CreditCard,
	BadgeCheck,
	LogOut,
	Smartphone,
	Activity,
	Settings,
	Search,
	Star,
	Zap,
	QrCode,
	Database,
	Puzzle,
	Code2,
	ExternalLink,
} from "lucide-react";
import type { NavCategory } from "../hooks/useVault";
import { openExternalUrl } from "../utils/browserOpener";

interface SidebarProps {
	activeCategory: NavCategory;
	setActiveCategory: (cat: NavCategory) => void;
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	onLock: () => void;
	onOpenGenerator: () => void;
	onOpenOcr: () => void;
	onOpenSettings: () => void;
	onOpenExtensionModal: () => void;
	itemCounts: {
		all: number;
		passwords: number;
		notes: number;
		personal_info: number;
		credit_cards: number;
		ids: number;
		totp: number;
		env_files: number;
		favorites: number;
	};
}

export const Sidebar: React.FC<SidebarProps> = ({
	activeCategory,
	setActiveCategory,
	searchQuery,
	setSearchQuery,
	onLock,
	onOpenGenerator,
	onOpenOcr,
	onOpenSettings,
	onOpenExtensionModal,
	itemCounts,
}) => {
	const navItems = [
		{ id: "all" as NavCategory, label: "All Items", icon: Database, count: itemCounts.all },
		{ id: "favorites" as NavCategory, label: "Favorites", icon: Star, count: itemCounts.favorites },
	];

	const vaultItems = [
		{ id: "passwords" as NavCategory, label: "Passwords", icon: KeyRound, count: itemCounts.passwords },
		{ id: "notes" as NavCategory, label: "Notes", icon: FileText, count: itemCounts.notes },
		{ id: "personal_info" as NavCategory, label: "Identity", icon: User, count: itemCounts.personal_info },
		{ id: "credit_cards" as NavCategory, label: "Cards", icon: CreditCard, count: itemCounts.credit_cards },
		{ id: "ids" as NavCategory, label: "IDs", icon: BadgeCheck, count: itemCounts.ids },
		{ id: "totp" as NavCategory, label: "2FA", icon: Smartphone, count: itemCounts.totp },
		{ id: "env_files" as NavCategory, label: ".env", icon: Code2, count: itemCounts.env_files },
	];

	const securityItems = [
		{ id: "dashboard" as NavCategory, label: "Health", icon: Activity },
		{ id: "settings" as NavCategory, label: "Settings", icon: Settings },
	];

	return (
		<aside className="w-52 md:w-56 lg:w-64 shrink-0 bg-[#131315] border-r border-slate-800/60 flex flex-col h-full min-h-0 select-none text-slate-300 transition-all">
			{/* Top Branding & App Header */}
			<div className="p-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
				<div className="flex items-center gap-2.5">
					<SafeVaultLogo className="w-8 h-8" />
					<div>
						<h1 className="text-sm font-bold text-white tracking-wide leading-none">
							SafeVault<span className="text-emerald-400">Pro</span>
						</h1>
					</div>
				</div>

				<div className="flex items-center gap-1">
					<button
						onClick={onOpenExtensionModal}
						title="Browser Extension Setup"
						className="p-1.5 rounded-lg text-purple-400 hover:text-white hover:bg-[#1c1b1d] transition-colors relative"
					>
						<Puzzle className="w-4 h-4" />
						<span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
					</button>
					<button
						onClick={() => setActiveCategory("settings")}
						title="Settings"
						className={`p-1.5 rounded-lg transition-all ${
							activeCategory === "settings"
								? "bg-[#1c1b1d] text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
								: "text-slate-400 hover:text-white hover:bg-[#1c1b1d]"
						}`}
					>
						<Settings className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Quick Search Input */}
			<div className="p-3 shrink-0">
				<div className="relative">
					<Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search vault..."
						className="w-full pl-8 pr-3 py-1.5 bg-[#09090b] border border-slate-800/80 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-all font-sans"
					/>
				</div>
			</div>

			{/* Navigation Categories */}
			<div className="flex-1 min-h-0 overflow-y-auto px-2 space-y-4 py-2 text-xs">
				{/* Overview section */}
				<div>
					<div className="space-y-0.5">
						{navItems.map((item) => {
							const Icon = item.icon;
							const isActive = activeCategory === item.id;
							return (
								<button
									key={item.id}
									onClick={() => setActiveCategory(item.id)}
									className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium transition-all relative ${
										isActive
											? "bg-[#1c1b1d] text-white"
											: "hover:bg-[#18181b] text-slate-400 hover:text-slate-200"
									}`}
								>
									{isActive && (
										<div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-500 rounded-r" />
									)}
									<div className="flex items-center gap-2.5">
										<Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
										<span>{item.label}</span>
									</div>
									<span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 bg-[#09090b] rounded">
										{item.count}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* VAULT section */}
				<div>
					<div className="px-3 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
						Vault
					</div>
					<div className="space-y-0.5">
						{vaultItems.map((item) => {
							const Icon = item.icon;
							const isActive = activeCategory === item.id;
							return (
								<button
									key={item.id}
									onClick={() => setActiveCategory(item.id)}
									className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium transition-all relative ${
										isActive
											? "bg-[#1c1b1d] text-white"
											: "hover:bg-[#18181b] text-slate-400 hover:text-slate-200"
									}`}
								>
									{isActive && (
										<div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-500 rounded-r" />
									)}
									<div className="flex items-center gap-2.5">
										<Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
										<span>{item.label}</span>
									</div>
									<span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 bg-[#09090b] rounded">
										{item.count}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* SECURITY section */}
				<div>
					<div className="px-3 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
						Security
					</div>
					<div className="space-y-0.5">
						{securityItems.map((item) => {
							const Icon = item.icon;
							const isActive = activeCategory === item.id;
							return (
								<button
									key={item.id}
									onClick={() => setActiveCategory(item.id)}
									className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium transition-all relative ${
										isActive
											? "bg-[#1c1b1d] text-white"
											: "hover:bg-[#18181b] text-slate-400 hover:text-slate-200"
									}`}
								>
									{isActive && (
										<div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-emerald-500 rounded-r" />
									)}
									<div className="flex items-center gap-2.5">
										<Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
										<span>{item.label}</span>
									</div>
								</button>
							);
						})}
					</div>
				</div>

				{/* QUICK TOOLS section */}
				<div>
					<div className="px-3 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
						Tools
					</div>
					<div className="space-y-0.5">
						<button
							onClick={onOpenGenerator}
							className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium text-slate-400 hover:text-white hover:bg-[#18181b] transition-all text-left"
						>
							<Zap className="w-4 h-4 text-emerald-400" />
							<span>Generator</span>
						</button>
						<button
							onClick={onOpenOcr}
							className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium text-slate-400 hover:text-white hover:bg-[#18181b] transition-all text-left"
						>
							<QrCode className="w-4 h-4 text-blue-400" />
							<span>Scan QR</span>
						</button>
						<button
							onClick={onOpenExtensionModal}
							className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md font-medium text-slate-400 hover:text-white hover:bg-[#18181b] transition-all text-left"
						>
							<Puzzle className="w-4 h-4 text-purple-400" />
							<span>Extension</span>
						</button>
					</div>
				</div>
			</div>

			{/* Footer Status & Lock Button */}
			<div className="p-3 border-t border-slate-800/60 bg-[#09090b]/50 flex items-center justify-between">
				<a
					href="https://github.com/YacineDahmani"
					onClick={(e) => {
						e.preventDefault();
						openExternalUrl("https://github.com/YacineDahmani");
					}}
					className="text-[11px] font-mono text-slate-400 hover:text-emerald-400 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
					title="Open YacineDahmani GitHub Profile in browser"
				>
					<span>YacineDahmani © 2026</span>
					<ExternalLink className="w-3 h-3 text-slate-500" />
				</a>
				<button
					onClick={onLock}
					className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1c1b1d] hover:bg-red-950/40 text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-800/50 rounded-md text-xs font-medium transition-all"
				>
					<LogOut className="w-3.5 h-3.5" />
					<span>Lock</span>
				</button>
			</div>
		</aside>
	);
};
