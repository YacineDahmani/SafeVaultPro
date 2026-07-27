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
			"assets/icons/SafeVault.ico": "views/mainview/assets/icons/SafeVault.ico",
			"assets/icons/icon.png": "views/mainview/assets/icons/icon.png",
		},
		// Ignore Vite output in watch mode — HMR handles view rebuilds separately
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
			icon: "assets/icons/icon.png",
		},
		linux: {
			bundleCEF: false,
			icon: "assets/icons/icon.png",
		},
		win: {
			bundleCEF: false,
			icon: "assets/icons/SafeVault.ico",
		},
	},
} satisfies ElectrobunConfig;
