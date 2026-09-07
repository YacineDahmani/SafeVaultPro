import React from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { SafeVaultLogo } from "./SafeVaultLogo";

interface TitleBarProps {
	isMaximized?: boolean;
	onMaximizedChange?: (isMax: boolean) => void;
}

const BRIDGE_AUTH_TOKEN = "sv_tok_7c9e1b4f2a8d3e6a0b5c9d8e7f2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01";

export const TitleBar: React.FC<TitleBarProps> = ({ isMaximized = false, onMaximizedChange }) => {
	const handleWindowAction = async (action: "minimize" | "maximize" | "close", e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation();
		}
		try {
			const res = await fetch("http://localhost:48920/api/window-action", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${BRIDGE_AUTH_TOKEN}`,
				},
				body: JSON.stringify({ action }),
			});
			if (res.ok) {
				const data = await res.json();
				if (typeof data.isMaximized === "boolean" && onMaximizedChange) {
					onMaximizedChange(data.isMaximized);
				}
			}
		} catch (err) {
			console.error("[TitleBar] Window action failed:", err);
		}
	};

	return (
		<div className="relative shrink-0 z-50">
			{/* Top edge left transparent for OS resize handle catching */}
			<div
				className="h-0.5 w-full bg-transparent electrobun-webkit-app-region-no-drag"
				style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
			/>
			<div
				onDoubleClick={(e) => handleWindowAction("maximize", e)}
				className="h-9 bg-[#09090b] border-b border-slate-800/80 flex items-center justify-between px-3.5 select-none shrink-0 cursor-default electrobun-webkit-app-region-drag"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				{/* Left Drag Region */}
				<div className="flex items-center gap-2 pointer-events-none opacity-90 select-none">
					<SafeVaultLogo className="w-4 h-4" />
				</div>

				{/* Center Drag Region Spacer */}
				<div className="flex-1 h-full" />

				{/* Right High-Tech Dark Window Control Buttons */}
				<div
					className="flex items-center gap-0.5 electrobun-webkit-app-region-no-drag"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{/* Minimize Button */}
					<button
						type="button"
						onClick={(e) => handleWindowAction("minimize", e)}
						title="Minimize Window"
						className="w-8 h-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 active:scale-95 transition-all electrobun-webkit-app-region-no-drag cursor-pointer"
					>
						<Minus className="w-3.5 h-3.5" />
					</button>

					{/* Maximize / Restore Down Button */}
					<button
						type="button"
						onClick={(e) => handleWindowAction("maximize", e)}
						title={isMaximized ? "Restore Down" : "Maximize Window"}
						className="w-8 h-7 flex items-center justify-center rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/50 hover:border hover:border-emerald-800/50 active:scale-95 transition-all electrobun-webkit-app-region-no-drag cursor-pointer"
					>
						{isMaximized ? (
							<Copy className="w-3 h-3 rotate-180" />
						) : (
							<Square className="w-3 h-3" />
						)}
					</button>

					{/* Close Button */}
					<button
						type="button"
						onClick={(e) => handleWindowAction("close", e)}
						title="Close Application"
						className="w-8 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-red-600/90 active:scale-95 transition-all electrobun-webkit-app-region-no-drag cursor-pointer"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
};
