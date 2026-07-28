import { execSync } from "node:child_process";
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

// Dynamically calculate centered window dimensions based on primary screen resolution
function getCenteredFrame() {
	let screenWidth = 1280;
	let screenHeight = 720;

	try {
		if (process.platform === "win32") {
			const out = execSync(
				'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height"',
				{ encoding: "utf8", timeout: 2000 }
			);
			const parts = out.trim().split(/\s+/).map(Number);
			if (parts.length >= 2 && parts[0] > 0 && parts[1] > 0) {
				screenWidth = parts[0];
				screenHeight = parts[1];
			}
		}
	} catch {
		// Fallback to standard 1280x720 centered dimensions if PowerShell query times out
	}

	// Calculate proportional window size (approx 78% width, 85% height) capped for readability
	const width = Math.min(Math.max(Math.floor(screenWidth * 0.78), 960), 1280);
	const height = Math.min(Math.max(Math.floor(screenHeight * 0.84), 600), 820);

	// Calculate exact centered coordinates on screen
	const x = Math.max(0, Math.floor((screenWidth - width) / 2));
	const y = Math.max(0, Math.floor((screenHeight - height) / 2) - 15);

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
