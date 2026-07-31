import React from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { SafeVaultLogo } from "./SafeVaultLogo";

interface TitleBarProps {
	isMaximized?: boolean;
	onMaximizedChange?: (isMax: boolean) => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ isMaximized = false, onMaximizedChange }) => {
	const handleWindowAction = async (action: "minimize" | "maximize" | "close", e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation();
		}
		try {
			const body: Record<string, unknown> = { action };
			if (action === "maximize") {
				const dpr = window.devicePixelRatio || 1;
				const s = window.screen;
				const availLeft = (s as any).availLeft || 0;
				const availTop = (s as any).availTop || 0;
				const availWidth = s.availWidth || s.width;
				const availHeight = s.availHeight || s.height;

				body.workArea = {
					x: Math.round(availLeft * dpr),
					y: Math.round(availTop * dpr),
					width: Math.round(availWidth * dpr),
					height: Math.round(availHeight * dpr),
				};
			}

			const res = await fetch("http://localhost:48920/api/window-action", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
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
			<div className="h-0.5 w-full bg-transparent" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} />
			<div
				onDoubleClick={(e) => handleWindowAction("maximize", e)}
				className="h-9 bg-[#09090b] border-b border-slate-800/80 flex items-center justify-between px-3.5 select-none shrink-0 cursor-default"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				{/* Left App Logo & Title Branding with Deep Obsidian Aesthetics */}
				<div className="flex items-center gap-2.5 pointer-events-none">
					<SafeVaultLogo className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
					<span className="text-xs font-semibold text-slate-200 tracking-wide font-sans">SafeVaultPro</span>
					<span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 rounded-sm shadow-[0_0_10px_rgba(16,185,129,0.2)] tracking-wider">
						LOCAL VAULT
					</span>
				</div>

				{/* Center Drag Region Spacer */}
				<div className="flex-1 h-full" />

				{/* Right High-Tech Dark Window Control Buttons */}
				<div className="flex items-center gap-0.5" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
					{/* Minimize Button */}
					<button
						type="button"
						onClick={(e) => handleWindowAction("minimize", e)}
						title="Minimize Window"
						className="w-8 h-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 active:scale-95 transition-all"
					>
						<Minus className="w-3.5 h-3.5" />
					</button>

					{/* Maximize / Restore Down Button */}
					<button
						type="button"
						onClick={(e) => handleWindowAction("maximize", e)}
						title={isMaximized ? "Restore Down" : "Maximize Window"}
						className="w-8 h-7 flex items-center justify-center rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/50 hover:border hover:border-emerald-800/50 active:scale-95 transition-all"
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
						className="w-8 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-red-600/90 active:scale-95 transition-all"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
};
