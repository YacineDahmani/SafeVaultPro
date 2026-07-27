import React from "react";
import { CheckCircle, Info, AlertTriangle, Star, Trash2, Copy, Lock, KeyRound } from "lucide-react";

export type ToastType =
	| "success"
	| "info"
	| "warning"
	| "favorite"
	| "unfavorite"
	| "delete"
	| "copy"
	| "lock";

interface ToastProps {
	message: string;
	type?: ToastType;
}

export const Toast: React.FC<ToastProps> = ({ message, type = "success" }) => {
	const getIconAndStyle = () => {
		switch (type) {
			case "favorite":
				return {
					icon: <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />,
					border: "border-amber-500/40",
					glow: "shadow-[0_0_15px_rgba(245,158,11,0.2)]",
				};
			case "unfavorite":
				return {
					icon: <Star className="w-4 h-4 text-slate-400 shrink-0" />,
					border: "border-slate-700",
					glow: "shadow-lg",
				};
			case "delete":
				return {
					icon: <Trash2 className="w-4 h-4 text-red-400 shrink-0" />,
					border: "border-red-500/40",
					glow: "shadow-[0_0_15px_rgba(239,68,68,0.2)]",
				};
			case "copy":
				return {
					icon: <Copy className="w-4 h-4 text-emerald-400 shrink-0" />,
					border: "border-emerald-500/40",
					glow: "glow-emerald",
				};
			case "lock":
				return {
					icon: <Lock className="w-4 h-4 text-slate-400 shrink-0" />,
					border: "border-slate-800",
					glow: "shadow-lg",
				};
			case "info":
				return {
					icon: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
					border: "border-blue-500/40",
					glow: "glow-blue",
				};
			case "warning":
				return {
					icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
					border: "border-amber-500/40",
					glow: "shadow-lg",
				};
			case "success":
			default:
				return {
					icon: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />,
					border: "border-emerald-500/40",
					glow: "glow-emerald",
				};
		}
	};

	const style = getIconAndStyle();

	return (
		<div
			className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[#18181b] text-white border ${style.border} ${style.glow} rounded-xl shadow-2xl backdrop-blur-md transition-all duration-300 animate-slide-up select-none`}
		>
			{style.icon}
			<span className="text-xs font-semibold text-slate-200">{message}</span>
		</div>
	);
};
