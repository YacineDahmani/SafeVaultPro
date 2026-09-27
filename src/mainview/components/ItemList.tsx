import React, { useState, useMemo } from "react";
import {
	Plus,
	Star,
	Lock,
	Search,
	Copy,
	Check,
	Tag,
	X,
	ArrowUpDown,
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
	onCopySecret?: (text: string, label?: string) => void;
}

type SortOrder = "recent" | "alpha" | "strength";

export const ItemList: React.FC<ItemListProps> = ({
	items,
	selectedItemId,
	onSelectItem,
	activeCategory,
	searchQuery,
	onClearSearch,
	onNewItem,
	onToggleFavorite,
	onCopySecret,
}) => {
	const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
	const [activeTag, setActiveTag] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState<SortOrder>("recent");

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

	// 1-Click Copy Primary Secret on Hover
	const handleQuickCopy = (e: React.MouseEvent, item: VaultItem) => {
		e.stopPropagation();
		let textToCopy = "";
		let label = "Secret";

		if (item.type === "password") {
			textToCopy = item.password;
			label = "Password";
		} else if (item.type === "card") {
			textToCopy = item.number;
			label = "Card Number";
		} else if (item.type === "note") {
			textToCopy = item.content;
			label = "Note Content";
		} else if (item.type === "personal_info") {
			textToCopy = item.fullName;
			label = "Full Name";
		} else if (item.type === "env") {
			textToCopy = item.content;
			label = ".env Content";
		}

		if (textToCopy) {
			if (onCopySecret) {
				onCopySecret(textToCopy, label);
			} else if (navigator.clipboard) {
				navigator.clipboard.writeText(textToCopy);
			}
			setCopiedItemId(item.id);
			setTimeout(() => {
				setCopiedItemId((curr) => (curr === item.id ? null : curr));
			}, 1800);
		}
	};

	// Extract unique tags present in the current category items
	const availableTags = useMemo(() => {
		const tagSet = new Set<string>();
		items.forEach((item) => {
			if (Array.isArray(item.tags)) {
				item.tags.forEach((t) => {
					if (t && t.trim()) tagSet.add(t.trim());
				});
			}
		});
		return Array.from(tagSet).sort();
	}, [items]);

	// Filter and sort items
	const processedItems = useMemo(() => {
		let result = items;

		// Tag filter
		if (activeTag) {
			result = result.filter((item) =>
				Array.isArray(item.tags) && item.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase())
			);
		}

		// Sort
		return [...result].sort((a, b) => {
			if (sortBy === "alpha") {
				return a.title.localeCompare(b.title);
			}
			if (sortBy === "strength") {
				const aBits = a.type === "password" ? calculatePasswordEntropy(a.password) : 100;
				const bBits = b.type === "password" ? calculatePasswordEntropy(b.password) : 100;
				return aBits - bBits; // Weakest first
			}
			// Default "recent": newest updated first
			return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
		});
	}, [items, activeTag, sortBy]);

	return (
		<div className="w-full md:w-72 lg:w-80 h-full min-h-0 bg-[#131315] border-r border-slate-800/60 flex flex-col select-none transition-all">
			{/* Header */}
			<div className="p-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
				<div>
					<h2 className="text-sm font-bold text-white tracking-wide">{getCategoryTitle()}</h2>
					<span className="text-[11px] font-mono text-slate-500">
						{processedItems.length} {processedItems.length === 1 ? "item" : "items"}
					</span>
				</div>

				<div className="flex items-center gap-1.5">
					{/* Sort dropdown */}
					<button
						type="button"
						onClick={() => {
							setSortBy((prev) => (prev === "recent" ? "alpha" : prev === "alpha" ? "strength" : "recent"));
						}}
						title={`Sort: ${sortBy} (click to toggle)`}
						className="p-1.5 rounded-md bg-[#1c1b1d] border border-slate-800 text-slate-400 hover:text-white transition-colors"
					>
						<ArrowUpDown className="w-3.5 h-3.5" />
					</button>

					<button
						onClick={() => onNewItem()}
						className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-semibold rounded-md text-xs transition-all shadow-md hover:shadow-emerald-500/20 active:scale-[0.98]"
					>
						<Plus className="w-3.5 h-3.5" />
						<span>New</span>
					</button>
				</div>
			</div>

			{/* Tag Quick Filter Chips Strip (Shown if tags exist) */}
			{availableTags.length > 0 && (
				<div className="px-3 py-2 border-b border-slate-800/40 bg-[#0e0e10]/60 shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
					<Tag className="w-3 h-3 text-slate-500 shrink-0 mr-0.5" />
					<button
						onClick={() => setActiveTag(null)}
						className={`px-2 py-0.5 rounded-full shrink-0 font-medium transition-all ${
							activeTag === null
								? "bg-slate-700 text-white font-semibold"
								: "text-slate-400 hover:text-slate-200 bg-[#18181b]"
						}`}
					>
						All
					</button>
					{availableTags.map((tag) => (
						<button
							key={tag}
							onClick={() => setActiveTag(activeTag === tag ? null : tag)}
							className={`px-2 py-0.5 rounded-full shrink-0 font-medium transition-all flex items-center gap-1 ${
								activeTag === tag
									? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
									: "text-slate-400 hover:text-slate-200 bg-[#18181b] border border-slate-800"
							}`}
						>
							<span>{tag}</span>
							{activeTag === tag && <X className="w-2.5 h-2.5" />}
						</button>
					))}
				</div>
			)}

			{/* Items List Scrollable */}
			<div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
				{processedItems.length === 0 ? (
					searchQuery || activeTag ? (
						<div className="text-center py-12 px-4 text-slate-500 space-y-3">
							<Search className="w-7 h-7 mx-auto text-slate-600" />
							<div>
								<p className="text-xs text-slate-300 font-medium">
									{searchQuery ? `No matches for "${searchQuery}"` : `No items tagged with "${activeTag}"`}
								</p>
								<p className="text-[11px] text-slate-500 mt-0.5">
									Check your spelling or reset filters.
								</p>
							</div>
							<div className="flex items-center justify-center gap-2">
								{searchQuery && onClearSearch && (
									<button
										type="button"
										onClick={onClearSearch}
										className="px-3 py-1.5 bg-[#1c1b1d] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-md text-xs font-medium transition-colors"
									>
										Clear Search
									</button>
								)}
								{activeTag && (
									<button
										type="button"
										onClick={() => setActiveTag(null)}
										className="px-3 py-1.5 bg-[#1c1b1d] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-md text-xs font-medium transition-colors"
									>
										Reset Tag
									</button>
								)}
							</div>
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
					processedItems.map((item) => {
						const isSelected = selectedItemId === item.id;
						const isCopied = copiedItemId === item.id;

						return (
							<div
								key={item.id}
								onClick={() => onSelectItem(item.id)}
								className={`group w-full p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-all border relative ${
									isSelected
										? "bg-[#1c1b1d] border-slate-700 text-white shadow-lg"
										: "bg-[#09090b]/40 border-slate-800/40 hover:bg-[#18181b] hover:border-slate-800 text-slate-300"
								}`}
							>
								{isSelected && (
									<div className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-500 rounded-r" />
								)}

								<div className="flex items-center gap-3 min-w-0 flex-1">
									<div className="w-8 h-8 rounded-lg bg-[#09090b] border border-slate-800/80 flex items-center justify-center shrink-0">
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

								{/* Hover Action Strip: 1-Click Copy & Favorite Toggle */}
								<div className="flex items-center gap-0.5 shrink-0 ml-1">
									<button
										type="button"
										onClick={(e) => handleQuickCopy(e, item)}
										title={
											isCopied
												? "Copied!"
												: item.type === "password"
												? "1-Click Copy Password"
												: "1-Click Copy Secret"
										}
										className={`p-1.5 rounded transition-all ${
											isCopied
												? "text-emerald-400 bg-emerald-500/10"
												: "text-slate-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 hover:bg-[#27272a]"
										}`}
									>
										{isCopied ? (
											<Check className="w-3.5 h-3.5 text-emerald-400" />
										) : (
											<Copy className="w-3.5 h-3.5" />
										)}
									</button>

									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onToggleFavorite(item.id);
										}}
										className="p-1.5 rounded text-slate-600 hover:text-amber-400 transition-colors"
										title="Toggle Favorite"
									>
										<Star
											className={`w-3.5 h-3.5 ${
												item.favorite
													? "fill-amber-400 text-amber-400"
													: "opacity-0 group-hover:opacity-100"
											}`}
										/>
									</button>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
};
