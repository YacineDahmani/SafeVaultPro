/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				obsidian: {
					950: "#09090b",
					900: "#131315",
					850: "#18181b",
					800: "#1c1b1d",
					750: "#201f22",
					700: "#2a2a2c",
					600: "#353437",
				},
				emerald: {
					primary: "#10b981",
					tint: "#4edea3",
					dark: "#003824",
				},
			},
			fontFamily: {
				sans: ["Geist Sans", "Inter", "system-ui", "-apple-system", "sans-serif"],
				mono: ["JetBrains Mono", "Consolas", "Monaco", "monospace"],
			},
		},
	},
	plugins: [],
};
