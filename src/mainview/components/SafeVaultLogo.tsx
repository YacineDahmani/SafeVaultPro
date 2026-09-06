import React from "react";
import safeVaultLogo from "../assets/SafeVault.png";

interface SafeVaultLogoProps {
	className?: string;
	style?: React.CSSProperties;
	alt?: string;
}

export const SafeVaultLogo: React.FC<SafeVaultLogoProps> = ({
	className = "w-7 h-7",
	style,
	alt = "SafeVaultPro Logo",
}) => {
	return (
		<img
			src={safeVaultLogo}
			alt={alt}
			className={`shrink-0 select-none object-contain ${className || ""}`}
			style={{
				mixBlendMode: "screen",
				...style,
			}}
			draggable={false}
		/>
	);
};
