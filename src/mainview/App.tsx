import React from "react";
import { TitleBar } from "./components/TitleBar";
import { UnlockView } from "./views/UnlockView";
import { MainWorkspace } from "./views/MainWorkspace";
import { useVault } from "./hooks/useVault";

function App() {
	const vault = useVault();

	return (
		<div className="h-screen w-screen max-h-screen max-w-screen bg-[#09090b] overflow-hidden select-none flex flex-col">
			<TitleBar />
			<div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
				{!vault.isUnlocked ? (
					<UnlockView
						isConfigured={vault.isConfigured}
						onUnlock={vault.unlock}
					/>
				) : (
					<MainWorkspace />
				)}
			</div>
		</div>
	);
}

export default App;
