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

// Instantaneous calculation of centered window dimensions for ultra-fast startup
function getCenteredFrame() {
	// Standard high-DPI desktop proportions (1160x750) centered for desktop readability
	const width = 1160;
	const height = 750;
	const x = 100;
	const y = 60;

	return { width, height, x, y };
}

// Create the main application window with native resizable frame matching Windows desktop standard
const url = await getMainViewUrl();
const initialFrame = getCenteredFrame();

export const mainWindow = new BrowserWindow({
	title: "SafeVaultPro",
	url,
	titleBarStyle: "hiddenInset",
	styleMask: {
		Titled: true,
		Closable: true,
		Miniaturizable: true,
		Resizable: true,
		FullSizeContentView: true,
		FullScreen: false,
	},
	frame: initialFrame,
});

console.log("SafeVaultPro desktop application started!");
