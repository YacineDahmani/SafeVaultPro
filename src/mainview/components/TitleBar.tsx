import React, { useState } from "react";
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
		<div className="relative shrink-0 z-50">
			{/* Top 2px edge left for OS native window resize handles */}
			<div className="h-0.5 w-full bg-transparent" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} />
			<div
				onDoubleClick={() => handleWindowAction("maximize")}
				className="h-9 bg-[#09090b] border-b border-slate-800/80 flex items-center justify-between px-3 select-none shrink-0 cursor-default"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
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
		</div>
	);
};
