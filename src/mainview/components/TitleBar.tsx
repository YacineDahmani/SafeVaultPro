import React, { useState } from "react";
import appIcon from "../assets/icon.png";
import { Minus, Square, Copy, X } from "lucide-react";

export const TitleBar: React.FC = () => {
	const [isMaximized, setIsMaximized] = useState(false);

	const handleWindowAction = async (action: "minimize" | "maximize" | "close") => {
		try {
			const res = await fetch("http://localhost:48920/api/window-action", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
			});
			if (res.ok) {
				const data = await res.json();
				if (typeof data.isMaximized === "boolean") {
					setIsMaximized(data.isMaximized);
				}
			}
		} catch {}
	};

	return (
		<div
			onDoubleClick={() => handleWindowAction("maximize")}
			className="h-9 bg-[#09090b] border-b border-slate-800/80 flex items-center justify-between px-3 select-none z-50 shrink-0 cursor-default"
			style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
		>
			{/* Left App Identity */}
			<div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
				<img src={appIcon} alt="SafeVaultPro Icon" className="w-4 h-4 rounded object-cover" />
				<span className="text-xs font-bold text-slate-200 tracking-wide font-mono">SafeVaultPro</span>
			</div>

			{/* Center Title (Draggable region) */}
			<div className="text-[11px] font-mono text-slate-500 pointer-events-none hidden md:block">
				SafeVaultPro — Secure Password Manager
			</div>

			{/* Right Custom Dark Window Controls */}
			<div className="flex items-center" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
				{/* Minimize Button */}
				<button
					type="button"
					onClick={() => handleWindowAction("minimize")}
					title="Minimize"
					className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
				>
					<Minus className="w-3.5 h-3.5" />
				</button>

				{/* Maximize / Restore Button */}
				<button
					type="button"
					onClick={() => handleWindowAction("maximize")}
					title={isMaximized ? "Restore Down" : "Maximize"}
					className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
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
					onClick={() => handleWindowAction("close")}
					title="Close"
					className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-colors"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	);
};
