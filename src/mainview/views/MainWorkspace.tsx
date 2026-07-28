import React, { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { ItemList } from "../components/ItemList";
import { ItemDetailPane } from "../components/ItemDetailPane";
import { DashboardOverview } from "./DashboardOverview";
import { GeneratorPane } from "../components/GeneratorPane";
import { ItemEditModal } from "../components/ItemEditModal";
import { OcrModal } from "../components/OcrModal";
import { SettingsModal } from "../components/SettingsModal";
import { ExtensionModal } from "../components/ExtensionModal";
import { Toast } from "../components/Toast";
import { useVault } from "../hooks/useVault";

export const MainWorkspace: React.FC = () => {
	const vault = useVault();
	const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

	// Calculate counts for categories (separating credit_cards vs ids) using complete allItems array
	const itemCounts = {
		all: vault.allItems.length,
		passwords: vault.allItems.filter((i) => i.type === "password").length,
		notes: vault.allItems.filter((i) => i.type === "note").length,
		personal_info: vault.allItems.filter((i) => i.type === "personal_info").length,
		credit_cards: vault.allItems.filter((i) => i.type === "card" && i.subtype === "credit_card").length,
		ids: vault.allItems.filter((i) => i.type === "card" && i.subtype !== "credit_card").length,
		totp: vault.allItems.filter((i) => i.type === "totp").length,
		favorites: vault.allItems.filter((i) => i.favorite).length,
	};

	return (
		<div className="flex-1 min-h-0 h-full w-full bg-[#09090b] flex flex-col overflow-hidden select-none">
			{/* Main 3-Column Grid */}
			<div className="flex-1 min-h-0 flex overflow-hidden">
				{/* 1. Left Sidebar Navigation */}
				<Sidebar
					activeCategory={vault.activeCategory}
					setActiveCategory={vault.setActiveCategory}
					searchQuery={vault.searchQuery}
					setSearchQuery={vault.setSearchQuery}
					onLock={vault.lock}
					onOpenGenerator={() => vault.setIsGeneratorOpen(true)}
					onOpenOcr={() => vault.setIsOcrModalOpen(true)}
					onOpenSettings={() => vault.setIsSettingsModalOpen(true)}
					onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
					itemCounts={itemCounts}
				/>

				{/* 2. Middle Pane & 3. Right Pane workspace */}
				{vault.activeCategory === "dashboard" ? (
					<DashboardOverview
						items={vault.items}
						onSelectItem={(id) => {
							vault.setSelectedItemId(id);
							vault.setActiveCategory("all");
						}}
						onOpenGenerator={() => vault.setIsGeneratorOpen(true)}
					/>
				) : (
					<div className="flex-1 flex min-w-0 h-full min-h-0 overflow-hidden">
						{/* Middle Column Item List (Shown always on md+, or on small screens when no item is selected) */}
						<div className={`h-full min-h-0 ${vault.selectedItemId ? "hidden md:flex" : "flex w-full md:w-auto"}`}>
							<ItemList
								items={vault.items}
								selectedItemId={vault.selectedItemId}
								onSelectItem={vault.setSelectedItemId}
								activeCategory={vault.activeCategory}
								onNewItem={() => vault.openCreateModal()}
								onToggleFavorite={vault.toggleFavorite}
							/>
						</div>

						{/* Right Column Details Pane (Shown always on md+, or on small screens when an item is selected) */}
						<div className={`flex-1 h-full min-h-0 min-w-0 ${!vault.selectedItemId ? "hidden md:flex" : "flex w-full"}`}>
							<ItemDetailPane
								item={vault.selectedItem}
								onEdit={vault.openEditModal}
								onDelete={vault.deleteItem}
								onToggleFavorite={vault.toggleFavorite}
								onCopySecret={vault.copySecret}
								onBack={() => vault.setSelectedItemId(null)}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Slide-over Password Generator */}
			<GeneratorPane
				isOpen={vault.isGeneratorOpen}
				onClose={() => vault.setIsGeneratorOpen(false)}
				onCopySecret={vault.copySecret}
			/>

			{/* Edit/Create Item Modal (Contextually locked to active category) */}
			<ItemEditModal
				isOpen={vault.isEditModalOpen}
				item={vault.editingItem}
				defaultType={vault.defaultEditType}
				defaultSubtype={vault.defaultEditSubtype}
				isCategoryLocked={vault.isCategoryLocked}
				onClose={() => vault.setIsEditModalOpen(false)}
				onSave={async (item) => {
					await vault.saveItem(item);
				}}
			/>

			{/* OCR 2FA QR Scanner Modal */}
			<OcrModal
				isOpen={vault.isOcrModalOpen}
				onClose={() => vault.setIsOcrModalOpen(false)}
				onSaveItem={async (item) => {
					await vault.saveItem(item);
				}}
			/>

			{/* Advanced Settings & Cryptographic Configuration Modal */}
			<SettingsModal
				isOpen={vault.isSettingsModalOpen}
				onClose={() => vault.setIsSettingsModalOpen(false)}
				onShowToast={vault.showToast}
				onRefreshItems={vault.refreshItems}
			/>

			{/* Browser Extension Management & Setup Modal */}
			<ExtensionModal
				isOpen={isExtensionModalOpen}
				onClose={() => setIsExtensionModalOpen(false)}
			/>

			{/* Clipboard Toast Banner */}
			{vault.toast && <Toast message={vault.toast.message} type={vault.toast.type} />}
		</div>
	);
};
