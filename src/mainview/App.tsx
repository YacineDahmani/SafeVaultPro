import React from "react";
import { UnlockView } from "./views/UnlockView";
import { MainWorkspace } from "./views/MainWorkspace";
import { useVault } from "./hooks/useVault";

function App() {
	const vault = useVault();

	return (
		<div className="h-full w-full bg-[#09090b] overflow-hidden select-none flex flex-col">
			{!vault.isUnlocked ? (
				<UnlockView
					isConfigured={vault.isConfigured}
					onUnlock={vault.unlock}
				/>
			) : (
				<MainWorkspace />
			)}
		</div>
	);
}

export default App;
