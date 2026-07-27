import { useCallback, useEffect, useState } from "react";
import { vaultBackend } from "../../bun/vaultBackendApi";
import type { VaultItem, VaultItemType } from "../../bun/types";

export type NavCategory =
	| "dashboard"
	| "all"
	| "passwords"
	| "notes"
	| "personal_info"
	| "cards"
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
	const [toast, setToast] = useState<{ message: string; type?: "success" | "info" | "warning" } | null>(null);

	// Modals & Panels
	const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
	const [defaultEditType, setDefaultEditType] = useState<VaultItemType>("password");
	const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

	// Toast helper
	const showToast = useCallback((message: string, type: "success" | "info" | "warning" = "success") => {
		setToast({ message, type });
		setTimeout(() => {
			setToast(null);
		}, 4000);
	}, []);

	// Initial check on mount
	useEffect(() => {
		const configured = vaultBackend.isConfigured();
		setIsConfigured(configured);
		setIsUnlocked(vaultBackend.getUnlockStatus());
	}, []);

	// Refresh items list from backend
	const refreshItems = useCallback(() => {
		if (!vaultBackend.getUnlockStatus()) {
			setItems([]);
			return;
		}

		let filterType: "all" | VaultItemType | "favorites" = "all";
		if (activeCategory === "favorites") {
			filterType = "favorites";
		} else if (
			activeCategory === "passwords" ||
			activeCategory === "notes" ||
			activeCategory === "personal_info" ||
			activeCategory === "cards" ||
			activeCategory === "totp"
		) {
			const typeMap: Record<string, VaultItemType> = {
				passwords: "password",
				notes: "note",
				personal_info: "personal_info",
				cards: "card",
				totp: "totp",
			};
			filterType = typeMap[activeCategory];
		}

		try {
			const fetched = vaultBackend.getItems(searchQuery, filterType);
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
	}, [activeCategory, searchQuery, selectedItemId]);

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
				refreshItems();
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
		showToast("Vault locked", "info");
	};

	const saveItem = async (item: VaultItem) => {
		try {
			const saved = await vaultBackend.saveItem(item);
			refreshItems();
			setSelectedItemId(saved.id);
			showToast(`Saved "${saved.title}" to vault`, "success");
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
			showToast(`Deleted "${itemToDelete?.title || "Item"}"`, "info");
		} catch (err: any) {
			showToast(`Error deleting item: ${err.message}`, "warning");
		}
	};

	const toggleFavorite = async (id: string) => {
		const target = items.find((i) => i.id === id);
		if (!target) return;

		const updated = { ...target, favorite: !target.favorite };
		await saveItem(updated);
	};

	const copySecret = async (text: string, label = "Secret") => {
		if (!text) return;
		await vaultBackend.copySecret(text, 30);
		showToast(`Copied ${label}! Auto-clears in 30 seconds`, "success");
	};

	const openCreateModal = (type: VaultItemType = "password") => {
		setEditingItem(null);
		setDefaultEditType(type);
		setIsEditModalOpen(true);
	};

	const openEditModal = (item: VaultItem) => {
		setEditingItem(item);
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
