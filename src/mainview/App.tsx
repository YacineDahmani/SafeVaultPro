import React from "react";
import { UnlockView } from "./views/UnlockView";
import { MainWorkspace } from "./views/MainWorkspace";
import { useVault } from "./hooks/useVault";

function App() {
	const vault = useVault();

	if (!vault.isUnlocked) {
		return (
			<UnlockView
				isConfigured={vault.isConfigured}
				onUnlock={vault.unlock}
			/>
		);
	}

	return <MainWorkspace />;
}

export default App;
