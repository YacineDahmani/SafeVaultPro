import React, { useState } from "react";
import {
	KeyRound,
	CreditCard,
	Smartphone,
	FileText,
	User,
	Code2,
	BadgeCheck,
} from "lucide-react";
import {
	SiGithub,
	SiGitlab,
	SiBitbucket,
	SiDocker,
	SiStackoverflow,
	SiNpm,
	SiPnpm,
	SiVercel,
	SiNetlify,
	SiDigitalocean,
	SiCloudflare,
	SiSupabase,
	SiFirebase,
	SiAnthropic,
	SiHuggingface,
	SiGoogle,
	SiGmail,
	SiYoutube,
	SiApple,
	SiIcloud,
	SiFacebook,
	SiInstagram,
	SiDiscord,
	SiTelegram,
	SiWhatsapp,
	SiReddit,
	SiTiktok,
	SiPinterest,
	SiSnapchat,
	SiTwitch,
	SiMastodon,
	SiSignal,
	SiNotion,
	SiFigma,
	SiLinear,
	SiJira,
	SiConfluence,
	SiTrello,
	SiAsana,
	SiZoom,
	SiMiro,
	SiAirtable,
	SiDropbox,
	SiSpotify,
	SiNetflix,
	SiSoundcloud,
	SiSteam,
	SiEpicgames,
	SiPlaystation,
	SiPaypal,
	SiStripe,
	SiWise,
	SiRevolut,
	SiCoinbase,
	SiBinance,
	SiShopify,
	SiEbay,
	SiAliexpress,
	SiPatreon,
	SiKickstarter,
	SiBitwarden,
	SiDashlane,
	SiProton,
	SiNordvpn,
} from "@icons-pack/react-simple-icons";
import type { VaultItem } from "../../bun/types";

// Extract clean, normalized hostname from item URL or title
export function extractDomain(url?: string, title?: string): string | null {
	if (url && typeof url === "string" && url.trim()) {
		try {
			const cleaned = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
			const parsed = new URL(cleaned);
			const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
			if (host && host.includes(".")) {
				return host;
			}
		} catch {
			const match = url.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9.]+)/i);
			if (match && match[1]) {
				return match[1].toLowerCase();
			}
		}
	}

	if (title && typeof title === "string") {
		const trimmed = title.trim().toLowerCase();
		if (trimmed.includes(".") && !trimmed.includes(" ")) {
			return trimmed.replace(/^www\./, "");
		}
	}

	return null;
}

// Brand mapping: Map domains and brand names directly to open-source SimpleIcons components
const BRAND_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
	// Developer & Engineering
	github: SiGithub,
	gitlab: SiGitlab,
	bitbucket: SiBitbucket,
	docker: SiDocker,
	stackoverflow: SiStackoverflow,
	npm: SiNpm,
	pnpm: SiPnpm,
	vercel: SiVercel,
	netlify: SiNetlify,
	digitalocean: SiDigitalocean,
	cloudflare: SiCloudflare,
	supabase: SiSupabase,
	firebase: SiFirebase,
	anthropic: SiAnthropic,
	claude: SiAnthropic,
	huggingface: SiHuggingface,

	// Big Tech & Cloud
	google: SiGoogle,
	gmail: SiGmail,
	youtube: SiYoutube,
	apple: SiApple,
	icloud: SiIcloud,

	// Social & Messaging
	facebook: SiFacebook,
	instagram: SiInstagram,
	discord: SiDiscord,
	telegram: SiTelegram,
	whatsapp: SiWhatsapp,
	reddit: SiReddit,
	tiktok: SiTiktok,
	pinterest: SiPinterest,
	snapchat: SiSnapchat,
	twitch: SiTwitch,
	mastodon: SiMastodon,
	signal: SiSignal,

	// Productivity & Collaboration
	notion: SiNotion,
	figma: SiFigma,
	linear: SiLinear,
	jira: SiJira,
	confluence: SiConfluence,
	trello: SiTrello,
	asana: SiAsana,
	zoom: SiZoom,
	miro: SiMiro,
	airtable: SiAirtable,
	dropbox: SiDropbox,

	// Entertainment
	spotify: SiSpotify,
	netflix: SiNetflix,
	soundcloud: SiSoundcloud,
	steam: SiSteam,
	epicgames: SiEpicgames,
	playstation: SiPlaystation,

	// Finance & Commerce
	paypal: SiPaypal,
	stripe: SiStripe,
	wise: SiWise,
	revolut: SiRevolut,
	coinbase: SiCoinbase,
	binance: SiBinance,
	shopify: SiShopify,
	ebay: SiEbay,
	aliexpress: SiAliexpress,
	patreon: SiPatreon,
	kickstarter: SiKickstarter,

	// Security
	bitwarden: SiBitwarden,
	dashlane: SiDashlane,
	proton: SiProton,
	protonmail: SiProton,
	nordvpn: SiNordvpn,
};

function getOpenSourceBrandIcon(domain: string | null, title?: string): React.ComponentType<{ size?: number; className?: string }> | null {
	const candidates: string[] = [];

	if (domain) {
		const parts = domain.toLowerCase().split(".");
		if (parts.length >= 2) {
			candidates.push(parts[parts.length - 2]);
		}
		candidates.push(domain.toLowerCase());
	}

	if (title) {
		const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
		candidates.push(cleanTitle);
		title.toLowerCase().split(/\s+/).forEach((w) => {
			if (w.length > 2) candidates.push(w);
		});
	}

	for (const cand of candidates) {
		if (BRAND_ICON_MAP[cand]) {
			return BRAND_ICON_MAP[cand];
		}
	}

	return null;
}

interface VaultItemIconProps {
	item: VaultItem;
	className?: string;
	size?: "sm" | "md" | "lg";
}

export const VaultItemIcon: React.FC<VaultItemIconProps> = ({
	item,
	className = "",
	size = "sm",
}) => {
	const [imageFailed, setImageFailed] = useState(false);

	const pxSize = size === "lg" ? 20 : size === "md" ? 17 : 14;
	const containerClasses = size === "lg" ? "w-6 h-6" : size === "md" ? "w-5 h-5" : "w-4 h-4";

	// Non-password items return semantic contextual icons
	if (item.type !== "password") {
		switch (item.type) {
			case "card":
				if (item.subtype === "credit_card") {
					return <CreditCard className={`${containerClasses} text-blue-400 ${className}`} />;
				}
				return <BadgeCheck className={`${containerClasses} text-amber-400 ${className}`} />;
			case "totp":
				return <Smartphone className={`${containerClasses} text-purple-400 ${className}`} />;
			case "note":
				return <FileText className={`${containerClasses} text-amber-400 ${className}`} />;
			case "personal_info":
				return <User className={`${containerClasses} text-cyan-400 ${className}`} />;
			case "env":
				return <Code2 className={`${containerClasses} text-sky-400 ${className}`} />;
			default:
				return <KeyRound className={`${containerClasses} text-emerald-400 ${className}`} />;
		}
	}

	const domain = extractDomain(item.url, item.title);

	// 1. Instant Open-Source SVG Match from SimpleIcons (Zero Network)
	const BrandComponent = getOpenSourceBrandIcon(domain, item.title);
	if (BrandComponent) {
		return (
			<div className={`${containerClasses} flex items-center justify-center shrink-0 ${className}`}>
				<BrandComponent size={pxSize} />
			</div>
		);
	}

	// 2. High-resolution Favicon for every other website & domain
	if (domain && !imageFailed) {
		const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
		return (
			<img
				src={faviconUrl}
				alt={item.title}
				onError={() => setImageFailed(true)}
				className={`${containerClasses} object-contain rounded-sm shrink-0 ${className}`}
				loading="lazy"
			/>
		);
	}

	// 3. Fallback: Crisp default password key
	return <KeyRound className={`${containerClasses} text-emerald-400 ${className}`} />;
};
