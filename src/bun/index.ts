import Electrobun, { BrowserWindow, Updater } from "electrobun/bun";
import { startExtensionServer } from "./services/extensionServer";
import { getInitialFrame, recordUserFrame, setMainWindow } from "./services/windowManager";
import { initTray } from "./services/trayService";

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

// Calculate dynamic initial window dimensions matching user's display work area
const url = await getMainViewUrl();
const initialFrame = getInitialFrame();

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

setMainWindow(mainWindow);
initTray(mainWindow);

// Track window resizing to preserve custom dimensions for restoration
try {
	Electrobun.events.on("resize", () => {
		recordUserFrame(mainWindow);
	});
} catch (e) {
	console.warn("[Main] Could not register window resize listener:", e);
}

console.log("SafeVaultPro desktop application started with frame:", initialFrame);
