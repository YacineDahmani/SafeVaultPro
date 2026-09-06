import React, { useState, useEffect } from "react";
import { TitleBar } from "./components/TitleBar";
import { UnlockView } from "./views/UnlockView";
import { MainWorkspace } from "./views/MainWorkspace";
import { useVault } from "./hooks/useVault";

const BRIDGE_AUTH_TOKEN = "sv_tok_7c9e1b4f2a8d3e6a0b5c9d8e7f2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01";

function App() {
	const vault = useVault();
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		const updateWindowState = async () => {
			try {
				const res = await fetch("http://localhost:48920/api/window-state", {
					headers: {
						"Authorization": `Bearer ${BRIDGE_AUTH_TOKEN}`,
					},
				});
				if (res.ok) {
					const data = await res.json();
					if (typeof data.isMaximized === "boolean") {
						setIsMaximized(data.isMaximized);
					}
				}
			} catch {}
		};

		const handleResize = () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(updateWindowState, 60);
		};

		updateWindowState();
		window.addEventListener("resize", handleResize);
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	return (
		<div className="h-full w-full bg-[#09090b] overflow-hidden select-none flex flex-col">
			<TitleBar isMaximized={isMaximized} onMaximizedChange={setIsMaximized} />
			<div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
				{!vault.isUnlocked ? (
					<UnlockView
						isConfigured={vault.isConfigured}
						onUnlock={vault.unlock}
					/>
				) : (
					<MainWorkspace vault={vault} />
				)}
			</div>
		</div>
	);
}

export default App;
