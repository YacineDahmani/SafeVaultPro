import React from "react";
import { Sidebar } from "../components/Sidebar";
import { ItemList } from "../components/ItemList";
import { ItemDetailPane } from "../components/ItemDetailPane";
import { DashboardOverview } from "./DashboardOverview";
import { GeneratorPane } from "../components/GeneratorPane";
import { ItemEditModal } from "../components/ItemEditModal";
import { OcrModal } from "../components/OcrModal";
import { SettingsModal } from "../components/SettingsModal";
import { Toast } from "../components/Toast";
import { useVault } from "../hooks/useVault";
import { Shield, Zap, QrCode, Lock, Settings, RefreshCw } from "lucide-react";

export const MainWorkspace: React.FC = () => {
	const vault = useVault();

	// Calculate counts for categories
	const itemCounts = {
		all: vault.items.length,
		passwords: vault.items.filter((i) => i.type === "password").length,
		notes: vault.items.filter((i) => i.type === "note").length,
		personal_info: vault.items.filter((i) => i.type === "personal_info").length,
		cards: vault.items.filter((i) => i.type === "card").length,
		totp: vault.items.filter((i) => i.type === "totp").length,
		favorites: vault.items.filter((i) => i.favorite).length,
	};

	return (
		<div className="h-screen w-screen bg-[#09090b] flex flex-col overflow-hidden select-none">
			{/* Main 3-Column Grid */}
			<div className="flex-1 flex overflow-hidden">
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
					<>
						{/* Middle Column Item List */}
						<ItemList
							items={vault.items}
							selectedItemId={vault.selectedItemId}
							onSelectItem={vault.setSelectedItemId}
							activeCategory={vault.activeCategory}
							onNewItem={(type) => vault.openCreateModal(type)}
							onToggleFavorite={vault.toggleFavorite}
						/>

						{/* Right Column Details Pane */}
						<ItemDetailPane
							item={vault.selectedItem}
							onEdit={vault.openEditModal}
							onDelete={vault.deleteItem}
							onToggleFavorite={vault.toggleFavorite}
							onCopySecret={vault.copySecret}
						/>
					</>
				)}
			</div>

			{/* Slide-over Password Generator */}
			<GeneratorPane
				isOpen={vault.isGeneratorOpen}
				onClose={() => vault.setIsGeneratorOpen(false)}
				onCopySecret={vault.copySecret}
			/>

			{/* Edit/Create Item Modal */}
			<ItemEditModal
				isOpen={vault.isEditModalOpen}
				item={vault.editingItem}
				defaultType={vault.defaultEditType}
				onClose={() => vault.setIsEditModalOpen(false)}
				onSave={vault.saveItem}
			/>

			{/* OCR 2FA QR Scanner Modal */}
			<OcrModal
				isOpen={vault.isOcrModalOpen}
				onClose={() => vault.setIsOcrModalOpen(false)}
				onSaveItem={vault.saveItem}
			/>

			{/* Settings & Cryptographic Configuration Modal */}
			<SettingsModal
				isOpen={vault.isSettingsModalOpen}
				onClose={() => vault.setIsSettingsModalOpen(false)}
				onShowToast={vault.showToast}
			/>

			{/* Clipboard Toast Banner */}
			{vault.toast && <Toast message={vault.toast.message} type={vault.toast.type} />}
		</div>
	);
};
