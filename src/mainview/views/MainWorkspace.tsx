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
			{/* Top Window Menu Bar matching reference layout */}
			<div className="h-9 bg-[#131315] border-b border-slate-800/80 px-4 flex items-center justify-between text-xs text-slate-400 select-none z-20">
				<div className="flex items-center gap-4">
					<span className="font-semibold text-white tracking-wide flex items-center gap-1.5">
						<Shield className="w-3.5 h-3.5 text-emerald-400" />
						SafeVaultPro
					</span>
					<div className="flex items-center gap-3">
						<button
							onClick={() => vault.openCreateModal("password")}
							className="hover:text-white transition-colors"
						>
							File
						</button>
						<button
							onClick={() => vault.setIsGeneratorOpen(true)}
							className="hover:text-white transition-colors flex items-center gap-1"
						>
							<Zap className="w-3 h-3 text-emerald-400" />
							<span>Tools</span>
						</button>
						<button
							onClick={() => vault.setIsOcrModalOpen(true)}
							className="hover:text-white transition-colors flex items-center gap-1"
						>
							<QrCode className="w-3 h-3 text-blue-400" />
							<span>Sync</span>
						</button>
						<button
							onClick={() => vault.setIsSettingsModalOpen(true)}
							className="hover:text-white transition-colors flex items-center gap-1"
						>
							<Settings className="w-3 h-3" />
							<span>Extensions</span>
						</button>
					</div>
				</div>

				<div className="flex items-center gap-3 text-[11px] font-mono">
					<span className="text-emerald-400 flex items-center gap-1">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
						Encrypted
					</span>
					<button
						onClick={vault.lock}
						className="hover:text-red-400 transition-colors flex items-center gap-1"
					>
						<Lock className="w-3 h-3 text-slate-500" />
						<span>Lock</span>
					</button>
				</div>
			</div>

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
