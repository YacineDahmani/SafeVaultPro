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
			"SafeVault.ico": "views/mainview/SafeVault.ico",
			"icon.png": "views/mainview/icon.png",
		},
		// Ignore Vite output in watch mode — HMR handles view rebuilds separately
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
			icon: "icon.png",
		},
		linux: {
			bundleCEF: false,
			icon: "icon.png",
		},
		win: {
			bundleCEF: false,
			icon: "SafeVault.ico",
		},
	},
} satisfies ElectrobunConfig;
