import React from "react";
import {
	Plus,
	Star,
	Lock,
	Search,
} from "lucide-react";
import type { VaultItem, VaultItemType } from "../../bun/types";
import type { NavCategory } from "../hooks/useVault";
import { calculatePasswordEntropy } from "../../bun/crypto/vaultCrypto";
import { VaultItemIcon } from "./VaultItemIcon";

interface ItemListProps {
	items: VaultItem[];
	selectedItemId: string | null;
	onSelectItem: (id: string) => void;
	activeCategory: NavCategory;
	searchQuery?: string;
	onClearSearch?: () => void;
	onNewItem: (type?: VaultItemType) => void;
	onToggleFavorite: (id: string) => void;
}

export const ItemList: React.FC<ItemListProps> = ({
	items,
	selectedItemId,
	onSelectItem,
	activeCategory,
	searchQuery,
	onClearSearch,
	onNewItem,
	onToggleFavorite,
}) => {
	const getCategoryTitle = () => {
		switch (activeCategory) {
			case "passwords":
				return "Passwords";
			case "notes":
				return "Notes";
			case "personal_info":
				return "Identity";
			case "credit_cards":
				return "Cards";
			case "ids":
				return "IDs";
			case "totp":
				return "2FA";
			case "env_files":
				return ".env Files";
			case "favorites":
				return "Favorites";
			default:
				return "All Items";
		}
	};

	const getItemSubtitle = (item: VaultItem) => {
		switch (item.type) {
			case "password":
				return item.username || item.url || "Password";
			case "card":
				return `${item.subtype.replace("_", " ").toUpperCase()} • ${item.cardholderName || "Card"}`;
			case "totp":
				return `${item.issuer} (${item.accountName})`;
			case "note":
				return item.content.slice(0, 40) + "...";
			case "personal_info":
				return `${item.fullName} • ${item.email || item.city || "Profile"}`;
			case "env":
				return `${item.environment || "ENV"} • ${item.project || "Project"}`;
		}
	};

	const renderEntropyDot = (item: VaultItem) => {
		if (item.type !== "password") return null;
		const bits = calculatePasswordEntropy(item.password);
		let color = "bg-emerald-500";
		if (bits < 40) color = "bg-red-500";
		else if (bits < 70) color = "bg-amber-500";

		return <span className={`w-1.5 h-1.5 rounded-full ${color}`} title={`Entropy: ${bits} bits`} />;
	};

	return (
		<div className="w-full md:w-72 lg:w-80 h-full min-h-0 bg-[#131315] border-r border-slate-800/60 flex flex-col select-none transition-all">
			{/* Header */}
			<div className="p-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
				<div>
					<h2 className="text-sm font-bold text-white tracking-wide">{getCategoryTitle()}</h2>
					<span className="text-[11px] font-mono text-slate-500">{items.length} {items.length === 1 ? "item" : "items"}</span>
				</div>

				<button
					onClick={() => onNewItem()}
					className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-semibold rounded-md text-xs transition-all shadow-md hover:shadow-emerald-500/20 active:scale-[0.98]"
				>
					<Plus className="w-3.5 h-3.5" />
					<span>New</span>
				</button>
			</div>

			{/* Items List Scrollable */}
			<div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
				{items.length === 0 ? (
					searchQuery ? (
						<div className="text-center py-12 px-4 text-slate-500 space-y-3">
							<Search className="w-7 h-7 mx-auto text-slate-600" />
							<div>
								<p className="text-xs text-slate-300 font-medium">
									No matches for "{searchQuery}"
								</p>
								<p className="text-[11px] text-slate-500 mt-0.5">
									Check your spelling or reset the filter.
								</p>
							</div>
							{onClearSearch && (
								<button
									type="button"
									onClick={onClearSearch}
									className="px-3 py-1.5 bg-[#1c1b1d] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-md text-xs font-medium transition-colors"
								>
									Clear Search
								</button>
							)}
						</div>
					) : (
						<div className="text-center py-12 px-4 text-slate-500 space-y-2">
							<Lock className="w-8 h-8 mx-auto text-slate-600" />
							<p className="text-xs">No items in this category.</p>
							<button
								type="button"
								onClick={() => onNewItem()}
								className="text-xs text-emerald-400 hover:underline font-medium"
							>
								Add Item
							</button>
						</div>
					)
				) : (
					items.map((item) => {
						const isSelected = selectedItemId === item.id;
						return (
							<div
								key={item.id}
								onClick={() => onSelectItem(item.id)}
								className={`group w-full p-3 rounded-lg flex items-start justify-between cursor-pointer transition-all border relative ${
									isSelected
										? "bg-[#1c1b1d] border-slate-700 text-white shadow-lg"
										: "bg-[#09090b]/40 border-slate-800/40 hover:bg-[#18181b] hover:border-slate-800 text-slate-300"
								}`}
							>
								{isSelected && (
									<div className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-500 rounded-r" />
								)}

								<div className="flex items-start gap-3 min-w-0 flex-1">
									<div className="w-8 h-8 rounded-lg bg-[#09090b] border border-slate-800/80 flex items-center justify-center shrink-0 mt-0.5">
										<VaultItemIcon item={item} size="sm" />
									</div>

									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-1.5">
											<span className="text-xs font-semibold text-white truncate">
												{item.title}
											</span>
											{renderEntropyDot(item)}
										</div>
										<p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
											{getItemSubtitle(item)}
										</p>
									</div>
								</div>

								{/* Favorite Toggle Star */}
								<button
									onClick={(e) => {
										e.stopPropagation();
										onToggleFavorite(item.id);
									}}
									className="p-1 text-slate-600 hover:text-amber-400 transition-colors shrink-0 ml-1"
								>
									<Star
										className={`w-3.5 h-3.5 ${
											item.favorite ? "fill-amber-400 text-amber-400" : "opacity-0 group-hover:opacity-100"
										}`}
									/>
								</button>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
};
