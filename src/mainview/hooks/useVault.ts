import { useCallback, useEffect, useState } from "react";
import { vaultBackend } from "../../bun/vaultBackendApi";
import type { VaultItem, VaultItemType, CardSubtype } from "../../bun/types";
import type { ToastType } from "../components/Toast";

export type NavCategory =
	| "dashboard"
	| "all"
	| "passwords"
	| "notes"
	| "personal_info"
	| "credit_cards"
	| "ids"
	| "totp"
	| "favorites"
	| "settings";

export function useVault() {
	const [isConfigured, setIsConfigured] = useState<boolean>(false);
	const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
	const [items, setItems] = useState<VaultItem[]>([]);
	const [activeCategory, setActiveCategory] = useState<NavCategory>("all");
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null);

	// Modals & Panels
	const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
	const [defaultEditType, setDefaultEditType] = useState<VaultItemType>("password");
	const [defaultEditSubtype, setDefaultEditSubtype] = useState<CardSubtype | undefined>(undefined);
	const [isCategoryLocked, setIsCategoryLocked] = useState(false);

	const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

	// Toast helper
	const showToast = useCallback((message: string, type: ToastType = "success") => {
		setToast({ message, type });
		setTimeout(() => {
			setToast(null);
		}, 3500);
	}, []);

	// Initial check on mount
	useEffect(() => {
		const configured = vaultBackend.isConfigured();
		setIsConfigured(configured);
		setIsUnlocked(vaultBackend.getUnlockStatus());
	}, []);

	// Extension syncing helper
	const syncExtension = useCallback((unlocked: boolean, vaultItems: VaultItem[] = []) => {
		try {
			fetch("http://localhost:48920/api/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ unlocked, items: vaultItems }),
			}).catch(() => {});
		} catch {}
	}, []);

	// Refresh items list from backend
	const refreshItems = useCallback(() => {
		if (!vaultBackend.getUnlockStatus()) {
			setItems([]);
			syncExtension(false, []);
			return;
		}

		try {
			// Fetch all items
			const allItems = vaultBackend.getItems("", "all");
			syncExtension(true, allItems);

			// Fetch filtered items matching searchQuery & activeCategory
			let fetched = vaultBackend.getItems(searchQuery, "all");

			// Category filter logic
			if (activeCategory === "favorites") {
				fetched = fetched.filter((i) => i.favorite);
			} else if (activeCategory === "passwords") {
				fetched = fetched.filter((i) => i.type === "password");
			} else if (activeCategory === "notes") {
				fetched = fetched.filter((i) => i.type === "note");
			} else if (activeCategory === "personal_info") {
				fetched = fetched.filter((i) => i.type === "personal_info");
			} else if (activeCategory === "credit_cards") {
				fetched = fetched.filter((i) => i.type === "card" && i.subtype === "credit_card");
			} else if (activeCategory === "ids") {
				fetched = fetched.filter((i) => i.type === "card" && i.subtype !== "credit_card");
			} else if (activeCategory === "totp") {
				fetched = fetched.filter((i) => i.type === "totp");
			}

			setItems(fetched);

			// Auto-select first item if current selection is invalid or none selected
			if (fetched.length > 0) {
				if (!selectedItemId || !fetched.some((i) => i.id === selectedItemId)) {
					setSelectedItemId(fetched[0].id);
				}
			} else {
				setSelectedItemId(null);
			}
		} catch (err) {
			console.error("Failed to fetch items:", err);
		}
	}, [activeCategory, searchQuery, selectedItemId, syncExtension]);

	useEffect(() => {
		if (isUnlocked) {
			refreshItems();
		}
	}, [isUnlocked, activeCategory, searchQuery, refreshItems]);

	// Actions
	const unlock = async (masterPassword: string): Promise<boolean> => {
		try {
			const success = await vaultBackend.unlockVault(masterPassword);
			if (success) {
				setIsConfigured(true);
				setIsUnlocked(true);
				const allItems = vaultBackend.getItems("", "all");
				setItems(allItems);
				syncExtension(true, allItems);
				showToast("Vault unlocked successfully", "success");
				return true;
			}
			return false;
		} catch (err: any) {
			throw new Error(err.message || "Failed to unlock vault");
		}
	};

	const lock = () => {
		vaultBackend.lockVault();
		setIsUnlocked(false);
		setItems([]);
		setSelectedItemId(null);
		syncExtension(false, []);
		showToast("Vault locked & memory purged", "lock");
	};

	const saveItem = async (
		item: VaultItem,
		customToastMsg?: string,
		customToastType?: ToastType
	) => {
		try {
			const isExisting = items.some((i) => i.id === item.id);
			const saved = await vaultBackend.saveItem(item);
			refreshItems();
			setSelectedItemId(saved.id);

			if (customToastMsg) {
				showToast(customToastMsg, customToastType || "success");
			} else if (isExisting) {
				showToast(`Updated "${saved.title}"`, "success");
			} else {
				showToast(`Created new secret "${saved.title}"`, "success");
			}

			setIsEditModalOpen(false);
			setEditingItem(null);
			return saved;
		} catch (err: any) {
			showToast(`Error saving item: ${err.message}`, "warning");
			throw err;
		}
	};

	const deleteItem = async (id: string) => {
		try {
			const itemToDelete = items.find((i) => i.id === id);
			await vaultBackend.deleteItem(id);
			if (selectedItemId === id) {
				setSelectedItemId(null);
			}
			refreshItems();
			showToast(`Deleted "${itemToDelete?.title || "Item"}"`, "delete");
		} catch (err: any) {
			showToast(`Error deleting item: ${err.message}`, "warning");
		}
	};

	const toggleFavorite = async (id: string) => {
		const target = items.find((i) => i.id === id);
		if (!target) return;

		const nextFav = !target.favorite;
		const updated = { ...target, favorite: nextFav };

		const msg = nextFav
			? `Added "${target.title}" to Favorites`
			: `Removed "${target.title}" from Favorites`;
		const tType: ToastType = nextFav ? "favorite" : "unfavorite";

		await saveItem(updated, msg, tType);
	};

	const copySecret = async (text: string, label = "Secret") => {
		if (!text) return;
		await vaultBackend.copySecret(text, 30);
		showToast(`Copied ${label}! Auto-clears in 30 seconds`, "copy");
	};

	// Open create modal contextualized to active category if specific
	const openCreateModal = () => {
		setEditingItem(null);

		if (activeCategory === "passwords") {
			setDefaultEditType("password");
			setDefaultEditSubtype(undefined);
			setIsCategoryLocked(true);
		} else if (activeCategory === "notes") {
			setDefaultEditType("note");
			setDefaultEditSubtype(undefined);
			setIsCategoryLocked(true);
		} else if (activeCategory === "personal_info") {
			setDefaultEditType("personal_info");
			setDefaultEditSubtype(undefined);
			setIsCategoryLocked(true);
		} else if (activeCategory === "credit_cards") {
			setDefaultEditType("card");
			setDefaultEditSubtype("credit_card");
			setIsCategoryLocked(true);
		} else if (activeCategory === "ids") {
			setDefaultEditType("card");
			setDefaultEditSubtype("passport");
			setIsCategoryLocked(true);
		} else if (activeCategory === "totp") {
			setDefaultEditType("totp");
			setDefaultEditSubtype(undefined);
			setIsCategoryLocked(true);
		} else {
			// All Items or Favorites or Dashboard -> full picker allowed
			setDefaultEditType("password");
			setDefaultEditSubtype(undefined);
			setIsCategoryLocked(false);
		}

		setIsEditModalOpen(true);
	};

	const openEditModal = (item: VaultItem) => {
		setEditingItem(item);
		setIsCategoryLocked(false);
		setIsEditModalOpen(true);
	};

	const selectedItem = items.find((i) => i.id === selectedItemId) || null;

	return {
		isConfigured,
		isUnlocked,
		items,
		activeCategory,
		setActiveCategory,
		selectedItemId,
		setSelectedItemId,
		selectedItem,
		searchQuery,
		setSearchQuery,
		toast,
		showToast,
		// Modals state
		isGeneratorOpen,
		setIsGeneratorOpen,
		isEditModalOpen,
		setIsEditModalOpen,
		editingItem,
		defaultEditType,
		defaultEditSubtype,
		isCategoryLocked,
		isOcrModalOpen,
		setIsOcrModalOpen,
		isSettingsModalOpen,
		setIsSettingsModalOpen,
		// Operations
		unlock,
		lock,
		saveItem,
		deleteItem,
		toggleFavorite,
		copySecret,
		openCreateModal,
		openEditModal,
		refreshItems,
	};
}
