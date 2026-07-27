import React from "react";
import { CheckCircle, Info, AlertTriangle } from "lucide-react";

interface ToastProps {
	message: string;
	type?: "success" | "info" | "warning";
}

export const Toast: React.FC<ToastProps> = ({ message, type = "success" }) => {
	return (
		<div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[#18181b] text-white border border-emerald-500/30 rounded-lg shadow-2xl backdrop-blur-md glow-emerald transition-all duration-300 animate-slide-up">
			{type === "success" && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
			{type === "info" && <Info className="w-5 h-5 text-blue-400 shrink-0" />}
			{type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
			<span className="text-sm font-medium text-slate-200">{message}</span>
		</div>
	);
};
