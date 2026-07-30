import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import rcedit from "rcedit";

const ROOT_DIR = process.cwd();
const RELEASE_DIR = path.join(ROOT_DIR, "release");
const VERSION = "1.0.0";
const PKG_NAME = `SafeVaultPro-v${VERSION}-win-x64`;
const DIST_PKG_DIR = path.join(RELEASE_DIR, PKG_NAME);

console.log("==========================================");
console.log(`Building SafeVaultPro v${VERSION} Portable Release`);
console.log("==========================================");

// Step 1: Clean build target & release folders
console.log("\n[1/6] Cleaning dist/ and release/ directories...");
if (fs.existsSync(RELEASE_DIR)) {
	fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_PKG_DIR, { recursive: true });

// Step 2: Build Vite Frontend Assets
console.log("\n[2/6] Compiling optimized Vite frontend assets...");
execSync("npx vite build", { stdio: "inherit", cwd: ROOT_DIR });

// Step 3: Run Electrobun Executable Build (Production env disables debug console)
console.log("\n[3/6] Compiling Electrobun native desktop executable...");
execSync("node node_modules/electrobun/bin/electrobun.cjs build --env=canary", { stdio: "inherit", cwd: ROOT_DIR });

// Extract the production app files using the built installer
console.log("\nExtracting official production binaries via installer...");
const installerPath = path.join(ROOT_DIR, "build", "canary-win-x64", "SafeVaultPro-Setup-canary.exe");
const installTargetDir = path.join(process.env.USERPROFILE || "C:\\", "AppData", "Local", "com.safevaultpro.app", "canary", "app");

if (!fs.existsSync(installerPath)) {
	console.error(`Error: Could not locate installer at ${installerPath}`);
	process.exit(1);
}

// Clean local target to guarantee fresh extraction
if (fs.existsSync(installTargetDir)) {
	fs.rmSync(installTargetDir, { recursive: true, force: true });
}

// Run the installer synchronously to extract files
execSync(`"${installerPath}"`, { stdio: "inherit", cwd: path.dirname(installerPath) });

// Wait a brief moment to ensure filesystem sync
execSync("powershell -Command \"Start-Sleep -Seconds 2\"");

// Verify extracted app files
if (!fs.existsSync(installTargetDir) || !fs.existsSync(path.join(installTargetDir, "bin", "launcher.exe"))) {
	console.error(`Error: Installer extraction failed at ${installTargetDir}`);
	process.exit(1);
}

console.log(`Using extracted production source: ${installTargetDir}`);

// Step 4: Assemble Standalone Release Bundle
console.log("\n[4/6] Assembling standalone release directory structure...");

// Copy bin, Resources, Info.plist, lib from extracted production app
fs.cpSync(path.join(installTargetDir, "bin"), path.join(DIST_PKG_DIR, "bin"), { recursive: true });
if (fs.existsSync(path.join(installTargetDir, "Resources"))) {
	fs.cpSync(path.join(installTargetDir, "Resources"), path.join(DIST_PKG_DIR, "Resources"), { recursive: true });
}
if (fs.existsSync(path.join(installTargetDir, "lib"))) {
	fs.cpSync(path.join(installTargetDir, "lib"), path.join(DIST_PKG_DIR, "lib"), { recursive: true });
}
if (fs.existsSync(path.join(installTargetDir, "Info.plist"))) {
	fs.copyFileSync(path.join(installTargetDir, "Info.plist"), path.join(DIST_PKG_DIR, "Info.plist"));
}

const icoPath = path.join(ROOT_DIR, "src", "mainview", "assets", "SafeVault.ico");
const rootExe = path.join(DIST_PKG_DIR, "SafeVaultPro.exe");
const csLauncherPath = path.join(ROOT_DIR, "scripts", "SafeVaultProLauncher.cs");

// Compile native Windows C# GUI wrapper with embedded icon
if (process.platform === "win32" && fs.existsSync(csLauncherPath)) {
	try {
		const cscPath = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
		if (fs.existsSync(cscPath)) {
			execSync(`"${cscPath}" /target:winexe /win32icon:"${icoPath}" /out:"${rootExe}" "${csLauncherPath}"`, { stdio: "inherit" });
			console.log(`✓ Compiled native Windows GUI executable with embedded icon: SafeVaultPro.exe`);
		}
	} catch (e) {
		console.warn("Failed to compile native C# launcher, falling back to copy:", e.message);
	}
}

if (!fs.existsSync(rootExe)) {
	const launcherBin = path.join(DIST_PKG_DIR, "bin", "launcher.exe");
	if (fs.existsSync(launcherBin)) {
		fs.copyFileSync(launcherBin, rootExe);
	}
}

// Step 5: Embed Icon into Internal Executables (.exe & Taskbar Icon)
console.log("\n[5/6] Embedding SafeVaultPro icon into internal binaries for taskbar icon support...");

if (fs.existsSync(icoPath) && process.platform === "win32") {
	const exesToIcon = [
		path.join(DIST_PKG_DIR, "bin", "launcher.exe"),
		path.join(DIST_PKG_DIR, "bin", "bun.exe"),
	];

	for (const targetExe of exesToIcon) {
		if (fs.existsSync(targetExe)) {
			try {
				await rcedit(targetExe, {
					icon: icoPath,
					"version-string": {
						CompanyName: "SafeVaultPro",
						FileDescription: "SafeVaultPro Local Credentials Manager",
						ProductName: "SafeVaultPro",
						LegalCopyright: "Copyright SafeVaultPro",
						OriginalFilename: "SafeVaultPro.exe",
					},
				});
				console.log(`✓ Embedded icon into ${path.relative(ROOT_DIR, targetExe)}`);
			} catch (err) {
				console.warn(`! Warning: Failed to embed icon into ${targetExe}:`, err.message);
			}
		}
	}
}

// Copy Browser Extension files into package
const extensionSrc = path.join(ROOT_DIR, "src", "extension");
const extensionDist = path.join(DIST_PKG_DIR, "browser-extension");
if (fs.existsSync(extensionSrc)) {
	fs.cpSync(extensionSrc, extensionDist, { recursive: true });
	console.log(`Bundled browser extension in: browser-extension/`);
}

// Create Quickstart Readme for Release
const readmeContent = `SafeVaultPro v${VERSION} - Native Desktop & Browser Extension

GETTING STARTED
===============
1. Launch Desktop Application:
   - Double-click 'SafeVaultPro.exe' in this directory.

2. Load Browser Extension (Chrome / Edge / Brave / Firefox):
   - Open your browser extensions page:
     * Chrome: chrome://extensions
     * Edge:   edge://extensions
     * Brave:  brave://extensions
   - Turn ON 'Developer mode' in top-right corner.
   - Click 'Load unpacked' button.
   - Select the 'browser-extension' folder located in this directory.

SECURITY & POWER SAVING
=======================
- SafeVaultPro stores all secrets locally in SQLCipher encrypted storage using AES-256-GCM.
- When minimized to background, SafeVaultPro enters low-power idle mode to consume minimal RAM and CPU, while remaining 100% active for instant extension autofill queries on localhost:48920.
`;

fs.writeFileSync(path.join(DIST_PKG_DIR, "README.txt"), readmeContent, "utf-8");

// Step 6: Compress into ZIP for GitHub Release
console.log("\n[6/6] Packaging ZIP archive for GitHub Release...");
const zipFile = path.join(RELEASE_DIR, `${PKG_NAME}.zip`);

try {
	if (process.platform === "win32") {
		const powershellCmd = `Compress-Archive -Path '${DIST_PKG_DIR}\\*' -DestinationPath '${zipFile}' -Force`;
		execSync(`powershell -NoProfile -Command "${powershellCmd}"`, { stdio: "inherit" });
	} else {
		execSync(`cd "${RELEASE_DIR}" && zip -r "${PKG_NAME}.zip" "${PKG_NAME}"`, { stdio: "inherit" });
	}
	console.log(`Successfully created ZIP archive: ${zipFile}`);
} catch (err) {
	console.warn("Zip creation note:", err.message);
}

console.log("\n==========================================");
console.log("BUILD & RELEASE PACKAGING COMPLETED!");
console.log("Release Folder: " + DIST_PKG_DIR);
console.log("Release ZIP:    " + zipFile);
console.log("Executable:     " + path.join(DIST_PKG_DIR, "SafeVaultPro.exe"));
console.log("==========================================");
