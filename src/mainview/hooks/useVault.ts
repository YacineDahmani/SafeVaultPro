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
	| "env_files"
	| "favorites"
	| "settings";

export function useVault() {
	const [isConfigured, setIsConfigured] = useState<boolean>(false);
	const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
	const [items, setItems] = useState<VaultItem[]>([]);
	const [allItems, setAllItems] = useState<VaultItem[]>([]);
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

	// Ingest items captured/saved by the browser extension into the local encrypted vault
	const ingestPendingItems = useCallback(async (pendingItems: VaultItem[]) => {
		if (!vaultBackend.getUnlockStatus() || !Array.isArray(pendingItems) || pendingItems.length === 0) {
			return;
		}

		try {
			const ackIds: string[] = [];
			for (const item of pendingItems) {
				await vaultBackend.saveItem(item);
				ackIds.push(item.id);
			}

			if (ackIds.length > 0) {
				await fetch("http://localhost:48920/api/ack-pending", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ids: ackIds }),
				}).catch(() => {});

				// Refresh view with newly saved secrets
				const fetchedAll = vaultBackend.getItems("", "all");
				setAllItems(fetchedAll);

				let fetched = vaultBackend.getItems(searchQuery, "all");
				if (activeCategory === "favorites") fetched = fetched.filter((i) => i.favorite);
				else if (activeCategory === "passwords") fetched = fetched.filter((i) => i.type === "password");
				else if (activeCategory === "notes") fetched = fetched.filter((i) => i.type === "note");
				else if (activeCategory === "personal_info") fetched = fetched.filter((i) => i.type === "personal_info");
				else if (activeCategory === "credit_cards") fetched = fetched.filter((i) => i.type === "card" && i.subtype === "credit_card");
				else if (activeCategory === "ids") fetched = fetched.filter((i) => i.type === "card" && i.subtype !== "credit_card");
				else if (activeCategory === "totp") fetched = fetched.filter((i) => i.type === "totp");
				else if (activeCategory === "env_files") fetched = fetched.filter((i) => i.type === "env");
				setItems(fetched);

				if (ackIds.length === 1) {
					const first = pendingItems[0];
					showToast(`Saved "${first.title || (first as any).username || "Login"}" from browser`, "success");
				} else {
					showToast(`Imported ${ackIds.length} logins captured from browser`, "success");
				}
			}
		} catch (err) {
			console.error("Failed to ingest pending items:", err);
		}
	}, [activeCategory, searchQuery, showToast]);

	// Extension syncing helper
	const syncExtension = useCallback((unlocked: boolean, vaultItems: VaultItem[] = []) => {
		try {
			fetch("http://localhost:48920/api/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ unlocked, items: vaultItems }),
			})
				.then((res) => res.json())
				.then((data) => {
					if (data && Array.isArray(data.pendingItems) && data.pendingItems.length > 0 && vaultBackend.getUnlockStatus()) {
						ingestPendingItems(data.pendingItems);
					}
				})
				.catch(() => {});
		} catch {}
	}, [ingestPendingItems]);

	// Refresh items list from backend
	const refreshItems = useCallback(() => {
		if (!vaultBackend.getUnlockStatus()) {
			setItems([]);
			setAllItems([]);
			syncExtension(false, []);
			return;
		}

		try {
			// Fetch all items without category filter for global counts
			const fetchedAll = vaultBackend.getItems("", "all");
			setAllItems(fetchedAll);
			syncExtension(true, fetchedAll);

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
			} else if (activeCategory === "env_files") {
				fetched = fetched.filter((i) => i.type === "env");
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

	// Live SSE connection & polling to ingest items saved by browser extension in real time
	useEffect(() => {
		if (!isUnlocked) return;

		let eventSource: EventSource | null = null;
		try {
			eventSource = new EventSource("http://localhost:48920/api/events");
			eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data && data.type === "ITEM_SAVED" && data.item) {
						ingestPendingItems([data.item]);
					}
				} catch (err) {
					console.error("Failed to parse SSE event:", err);
				}
			};
		} catch (e) {
			console.error("SSE connection failed:", e);
		}

		// Background safety poll every 3 seconds
		const pollTimer = setInterval(() => {
			if (vaultBackend.getUnlockStatus()) {
				fetch("http://localhost:48920/api/pending-items")
					.then((r) => r.json())
					.then((data) => {
						if (data && data.success && Array.isArray(data.items) && data.items.length > 0) {
							ingestPendingItems(data.items);
						}
					})
					.catch(() => {});
			}
		}, 3000);

		return () => {
			if (eventSource) {
				eventSource.close();
			}
			clearInterval(pollTimer);
		};
	}, [isUnlocked, ingestPendingItems]);

	// Auto-refresh when restoring window from minimized/hidden state
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible" && isUnlocked) {
				refreshItems();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, [isUnlocked, refreshItems]);

	// Actions
	const unlock = async (masterPassword: string): Promise<boolean> => {
		try {
			const success = await vaultBackend.unlockVault(masterPassword);
			if (success) {
				setIsConfigured(true);
				setIsUnlocked(true);
				const fetchedAll = vaultBackend.getItems("", "all");
				setAllItems(fetchedAll);
				setItems(fetchedAll);
				syncExtension(true, fetchedAll);
				showToast("Vault unlocked successfully", "success");

				// Ingest any credentials queued while vault was locked
				fetch("http://localhost:48920/api/pending-items")
					.then((r) => r.json())
					.then((data) => {
						if (data && data.success && Array.isArray(data.items) && data.items.length > 0) {
							ingestPendingItems(data.items);
						}
					})
					.catch(() => {});

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
		setAllItems([]);
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
		} else if (activeCategory === "env_files") {
			setDefaultEditType("env");
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
		allItems,
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
