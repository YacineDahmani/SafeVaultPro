import React, { useState, useEffect } from "react";
import { TitleBar } from "./components/TitleBar";
import { UnlockView } from "./views/UnlockView";
import { MainWorkspace } from "./views/MainWorkspace";
import { useVault } from "./hooks/useVault";

function App() {
	const vault = useVault();
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		const updateWindowState = async () => {
			try {
				const res = await fetch("http://localhost:48920/api/window-state");
				if (res.ok) {
					const data = await res.json();
					if (typeof data.isMaximized === "boolean") {
						setIsMaximized(data.isMaximized);
					}
				}
			} catch {}
		};

		updateWindowState();
		window.addEventListener("resize", updateWindowState);
		return () => window.removeEventListener("resize", updateWindowState);
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
