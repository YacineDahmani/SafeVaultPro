import React from "react";

interface SafeVaultLogoProps {
	className?: string;
	style?: React.CSSProperties;
}

export const SafeVaultLogo: React.FC<SafeVaultLogoProps> = ({
	className = "w-7 h-7",
	style,
}) => {
	return (
		<svg
			viewBox="0 0 100 100"
			className={`shrink-0 select-none ${className}`}
			style={style}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<defs>
				<linearGradient id="svEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#34d399" />
					<stop offset="50%" stopColor="#10b981" />
					<stop offset="100%" stopColor="#059669" />
				</linearGradient>
				<linearGradient id="svShieldBg" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#0d1f19" />
					<stop offset="100%" stopColor="#06120e" />
				</linearGradient>
				<filter id="svGlow" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="2.5" result="blur" />
					<feComposite in="SourceGraphic" in2="blur" operator="over" />
				</filter>
			</defs>

			{/* Outer Rounded Container Frame */}
			<rect
				x="4"
				y="4"
				width="92"
				height="92"
				rx="24"
				fill="url(#svShieldBg)"
				stroke="url(#svEmeraldGrad)"
				strokeWidth="4"
			/>

			{/* Subtle Inner Hairline Grid Border */}
			<rect
				x="10"
				y="10"
				width="80"
				height="80"
				rx="18"
				fill="none"
				stroke="#10b981"
				strokeOpacity="0.25"
				strokeWidth="1.5"
			/>

			{/* Center Metallic Vault Shield Emblem */}
			<path
				d="M50 22 L74 33 V54 C74 70 50 82 50 82 C50 82 26 70 26 54 V33 L50 22 Z"
				fill="none"
				stroke="url(#svEmeraldGrad)"
				strokeWidth="4.5"
				strokeLinejoin="round"
				strokeLinecap="round"
				filter="url(#svGlow)"
			/>

			{/* Center Lock Nucleus */}
			<circle cx="50" cy="46" r="6" fill="url(#svEmeraldGrad)" />
			<path
				d="M47 50 L53 50 L54 62 L46 62 Z"
				fill="url(#svEmeraldGrad)"
			/>
		</svg>
	);
};
