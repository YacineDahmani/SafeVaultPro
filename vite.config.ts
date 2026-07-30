import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	base: "./",
	plugins: [react()],
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
		target: "esnext",
		minify: "esbuild",
		cssCodeSplit: true,
		chunkSizeWarningLimit: 1000,
		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-react": ["react", "react-dom"],
					"vendor-icons": ["lucide-react"],
					"vendor-crypto": ["hash-wasm", "otpauth", "jsqr"],
				},
			},
		},
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
