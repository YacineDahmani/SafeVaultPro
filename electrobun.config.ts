import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "SafeVaultPro",
		identifier: "com.safevaultpro.app",
		version: "1.0.0",
	},
	build: {
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			"src/mainview/assets/SafeVault.ico": "views/mainview/SafeVault.ico",
			"src/mainview/assets/SafeVault.png": "views/mainview/SafeVault.png",
		},
		// Ignore Vite output in watch mode — HMR handles view rebuilds separately
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
			icon: "src/mainview/assets/SafeVault.png",
		},
		linux: {
			bundleCEF: false,
			icon: "src/mainview/assets/SafeVault.png",
		},
		win: {
			bundleCEF: false,
			icon: "src/mainview/assets/SafeVault.ico",
		},
	},
} satisfies ElectrobunConfig;
