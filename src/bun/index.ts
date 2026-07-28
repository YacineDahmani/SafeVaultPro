import { BrowserWindow, Updater } from "electrobun/bun";
import { startExtensionServer } from "./services/extensionServer";

// Start the local extension IPC bridge
startExtensionServer();

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'npm run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
}

// Create the main application window with native resizable frame matching Windows desktop standard
const url = await getMainViewUrl();

export const mainWindow = new BrowserWindow({
	title: "SafeVaultPro",
	url,
	titleBarStyle: "default",
	styleMask: {
		Titled: true,
		Closable: true,
		Miniaturizable: true,
		Resizable: true,
		FullSizeContentView: false,
		FullScreen: false,
	},
	frame: {
		width: 1280,
		height: 820,
		x: 120,
		y: 60,
	},
});

console.log("SafeVaultPro desktop application started!");
