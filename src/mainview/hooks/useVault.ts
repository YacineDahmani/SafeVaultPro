import { useCallback, useEffect, useState } from "react";
import { vaultBackend } from "../../bun/vaultBackendApi";
import { getVaultSettings, saveVaultSettings, type VaultSettings } from "../../bun/db/settingsStorage";
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

	// Settings state & persistence
	const [settings, setSettings] = useState<VaultSettings>(() => getVaultSettings());

	const updateSettings = useCallback((partial: Partial<VaultSettings>) => {
		const updated = saveVaultSettings(partial);
		setSettings(updated);

		// Immediately sync to Bun backend bridge so tray and close handlers reflect changes
		fetch("http://localhost:48920/api/settings", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${BRIDGE_AUTH_TOKEN}`,
			},
			body: JSON.stringify(updated),
		}).catch(() => {});
	}, []);

	// Sync initial settings from backend if available
	useEffect(() => {
		fetch("http://localhost:48920/api/settings", {
			headers: {
				"Authorization": `Bearer ${BRIDGE_AUTH_TOKEN}`,
			},
		})
			.then((res) => res.json())
			.then((data) => {
				if (data?.success && data?.settings) {
					const merged = saveVaultSettings(data.settings);
					setSettings(merged);
				}
			})
			.catch(() => {});
	}, []);

	// Modals & Panels
	const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
	const [defaultEditType, setDefaultEditType] = useState<VaultItemType>("password");
	const [defaultEditSubtype, setDefaultEditSubtype] = useState<CardSubtype | undefined>(undefined);
	const [isCategoryLocked, setIsCategoryLocked] = useState(false);
	const [initialEditValues, setInitialEditValues] = useState<Partial<VaultItem> | undefined>(undefined);

	const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

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

const BRIDGE_AUTH_TOKEN = "sv_tok_7c9e1b4f2a8d3e6a0b5c9d8e7f2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01";

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
					headers: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${BRIDGE_AUTH_TOKEN}`,
					},
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
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${BRIDGE_AUTH_TOKEN}`,
				},
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

	// Actions
	const lock = useCallback(() => {
		vaultBackend.lockVault();
		setIsUnlocked(false);
		setItems([]);
		setAllItems([]);
		setSelectedItemId(null);
		syncExtension(false, []);

		if (settings.wipeClipboardOnLock && typeof navigator !== "undefined" && navigator.clipboard) {
			try {
				navigator.clipboard.writeText("").catch(() => {});
			} catch {}
		}

		showToast("Vault locked", "lock");
	}, [settings.wipeClipboardOnLock, showToast, syncExtension]);

	// Live SSE connection to ingest items saved by browser extension in real time & handle remote lock
	useEffect(() => {
		if (!isUnlocked) return;

		let eventSource: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

		function connectSSE() {
			try {
				eventSource = new EventSource("http://localhost:48920/api/events");
				eventSource.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);
						if (data && data.type === "ITEM_SAVED" && data.item) {
							ingestPendingItems([data.item]);
						} else if (data && data.type === "VAULT_LOCKED") {
							lock();
						}
					} catch (err) {
						console.error("Failed to parse SSE event:", err);
					}
				};
				eventSource.onerror = () => {
					if (eventSource) {
						eventSource.close();
						eventSource = null;
					}
					// Reconnect with backoff rather than aggressive polling
					if (!reconnectTimer) {
						reconnectTimer = setTimeout(() => {
							reconnectTimer = null;
							if (vaultBackend.getUnlockStatus()) {
								connectSSE();
							}
						}, 5000);
					}
				};
			} catch (e) {
				console.error("SSE connection failed:", e);
			}
		}

		connectSSE();

		return () => {
			if (eventSource) {
				eventSource.close();
			}
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}
		};
	}, [isUnlocked, ingestPendingItems, lock]);

	// Inactivity-based auto-lock tracking
	useEffect(() => {
		if (!isUnlocked || settings.autoLockTimeout === "never") return;

		const timeoutMinutes = parseInt(settings.autoLockTimeout, 10);
		if (isNaN(timeoutMinutes) || timeoutMinutes <= 0) return;

		const timeoutMs = timeoutMinutes * 60 * 1000;
		let lastActivityTime = Date.now();

		const recordActivity = () => {
			lastActivityTime = Date.now();
		};

		const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
		events.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));

		const intervalId = setInterval(() => {
			if (Date.now() - lastActivityTime >= timeoutMs) {
				lock();
			}
		}, 10000);

		return () => {
			clearInterval(intervalId);
			events.forEach((evt) => window.removeEventListener(evt, recordActivity));
		};
	}, [isUnlocked, settings.autoLockTimeout, lock]);

	// Lock on Window Blur and System Sleep
	useEffect(() => {
		if (!isUnlocked) return;

		const handleBlur = () => {
			if (settings.lockOnWindowBlur) {
				lock();
			}
		};

		const handleVisibilityChange = () => {
			if (document.hidden && settings.lockOnSleep) {
				lock();
			} else if (document.visibilityState === "visible") {
				refreshItems();
			}
		};

		window.addEventListener("blur", handleBlur);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("blur", handleBlur);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [isUnlocked, settings.lockOnWindowBlur, settings.lockOnSleep, lock, refreshItems]);

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

				// Navigate to user's configured landing view if starting up
				if (settings.defaultLandingView && settings.defaultLandingView !== "all") {
					setActiveCategory(settings.defaultLandingView as NavCategory);
				}

				showToast("Vault unlocked", "success");

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
				showToast(`Saved "${saved.title}"`, "success");
			} else {
				showToast(`Added "${saved.title}"`, "success");
			}

			setIsEditModalOpen(false);
			setEditingItem(null);
			return saved;
		} catch (err: any) {
			showToast(`Error: ${err.message}`, "warning");
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
			showToast(`Error: ${err.message}`, "warning");
		}
	};

	const toggleFavorite = async (id: string) => {
		const target = items.find((i) => i.id === id);
		if (!target) return;

		const nextFav = !target.favorite;
		const updated = { ...target, favorite: nextFav };

		const msg = nextFav
			? `Added to favorites`
			: `Removed from favorites`;
		const tType: ToastType = nextFav ? "favorite" : "unfavorite";

		await saveItem(updated, msg, tType);
	};

	const copySecret = async (text: string, label = "Secret") => {
		if (!text) return;
		const timeout = settings.clipboardTimeout || 30;
		await vaultBackend.copySecret(text, timeout);
		showToast(`Copied ${label}`, "copy");
	};

	// Open create modal contextualized to active category if specific
	const openCreateModal = () => {
		setEditingItem(null);
		setInitialEditValues(undefined);

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

	const openCreateWithDefaults = (type: VaultItemType, initialValues?: Partial<VaultItem>) => {
		setEditingItem(null);
		setDefaultEditType(type);
		setDefaultEditSubtype(initialValues && (initialValues as any).subtype ? (initialValues as any).subtype : undefined);
		setIsCategoryLocked(true);
		setInitialEditValues(initialValues);
		setIsEditModalOpen(true);
	};

	const openEditModal = (item: VaultItem) => {
		setEditingItem(item);
		setInitialEditValues(undefined);
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
		defaultSubtype: defaultEditSubtype,
		defaultEditSubtype,
		isCategoryLocked,
		initialEditValues,
		isOcrModalOpen,
		setIsOcrModalOpen,
		isSettingsModalOpen: activeCategory === "settings",
		setIsSettingsModalOpen: (open: boolean) => setActiveCategory(open ? "settings" : "all"),
		// Settings state & actions
		settings,
		updateSettings,
		openSettings: () => setActiveCategory("settings"),
		// Operations
		unlock,
		lock,
		saveItem,
		deleteItem,
		toggleFavorite,
		copySecret,
		openCreateModal,
		openCreateWithDefaults,
		openEditModal,
		refreshItems,
	};
}
