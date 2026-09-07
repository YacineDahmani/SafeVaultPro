import React, { StrictMode, Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { openExternalUrl } from "./utils/browserOpener";

interface Props {
	children: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("[SafeVault Fatal Error Boundary]", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="min-h-screen w-full bg-[#09090b] text-red-400 p-8 flex flex-col items-center justify-center font-mono">
					<div className="max-w-xl w-full p-6 bg-[#131315] border border-red-900/60 rounded-2xl space-y-4 shadow-2xl">
						<h2 className="text-base font-bold text-white uppercase tracking-wider">
							SafeVaultPro Diagnostic Intercept
						</h2>
						<p className="text-xs text-slate-300">
							A rendering error occurred in the application view:
						</p>
						<pre className="p-3 bg-[#09090b] border border-slate-800 rounded-lg text-xs text-red-300 overflow-x-auto whitespace-pre-wrap">
							{this.state.error?.stack || this.state.error?.message || "Unknown error"}
						</pre>
						<button
							onClick={() => window.location.reload()}
							className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-colors"
						>
							Reload Application
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

// Global interceptor: Catch any external web links clicked in the UI and redirect to the default system browser
if (typeof window !== "undefined") {
	window.addEventListener(
		"click",
		(e: MouseEvent) => {
			const target = (e.target as HTMLElement)?.closest("a");
			if (target && target.href) {
				const href = target.href;
				if (href.startsWith("http://") || href.startsWith("https://")) {
					e.preventDefault();
					e.stopPropagation();
					openExternalUrl(href);
				}
			}
		},
		{ capture: true },
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</StrictMode>,
);

