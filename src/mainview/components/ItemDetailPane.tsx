import React, { useState, useEffect } from "react";
import {
	Eye,
	EyeOff,
	Copy,
	Check,
	Edit,
	Trash2,
	Star,
	ExternalLink,
	KeyRound,
	CreditCard,
	Smartphone,
	FileText,
	User,
	Lock,
	ArrowLeft,
	AlertTriangle,
	X,
} from "lucide-react";
import type { VaultItem } from "../../bun/types";
import { calculatePasswordEntropy } from "../../bun/crypto/vaultCrypto";
import { vaultBackend } from "../../bun/vaultBackendApi";

interface ItemDetailPaneProps {
	item: VaultItem | null;
	onEdit: (item: VaultItem) => void;
	onDelete: (id: string) => void;
	onToggleFavorite: (id: string) => void;
	onCopySecret: (text: string, label?: string) => void;
	onBack?: () => void;
}

export const ItemDetailPane: React.FC<ItemDetailPaneProps> = ({
	item,
	onEdit,
	onDelete,
	onToggleFavorite,
	onCopySecret,
	onBack,
}) => {
	const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
	const [copiedField, setCopiedField] = useState<string | null>(null);
	const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

	// TOTP Live status state
	const [totpStatus, setTotpStatus] = useState({
		code: "000000",
		formattedCode: "000 000",
		remainingSeconds: 30,
		progressPercent: 100,
	});

	// TOTP clock tick
	useEffect(() => {
		if (item?.type !== "totp") return;

		const updateTotp = () => {
			const status = vaultBackend.getTotp(item.secret, item.period || 30);
			setTotpStatus(status);
		};

		updateTotp();
		const interval = setInterval(updateTotp, 1000);
		return () => clearInterval(interval);
	}, [item]);

	if (!item) {
		return (
			<div className="flex-1 bg-[#09090b] flex flex-col items-center justify-center p-8 text-center text-slate-500">
				<div className="w-16 h-16 rounded-2xl bg-[#131315] border border-slate-800 flex items-center justify-center text-slate-600 mb-4">
					<Lock className="w-8 h-8" />
				</div>
				<h3 className="text-sm font-semibold text-slate-400 mb-1">No Secret Selected</h3>
				<p className="text-xs max-w-xs text-slate-600">
					Select an item from the center list to view details, reveal credentials, or modify parameters.
				</p>
			</div>
		);
	}

	const toggleReveal = (fieldName: string) => {
		setRevealedFields((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
	};

	const handleCopy = (text: string, label: string) => {
		onCopySecret(text, label);
		setCopiedField(label);
		setTimeout(() => setCopiedField(null), 2000);
	};

	// Password entropy calculation
	const renderEntropyBar = (password: string) => {
		const bits = calculatePasswordEntropy(password);
		let level = 1;
		let color = "bg-red-500";
		let label = "Weak";

		if (bits >= 75) {
			level = 4;
			color = "bg-emerald-500";
			label = "Very Strong";
		} else if (bits >= 55) {
			level = 3;
			color = "bg-emerald-400";
			label = "Strong";
		} else if (bits >= 35) {
			level = 2;
			color = "bg-amber-500";
			label = "Moderate";
		}

		return (
			<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-2">
				<div className="flex justify-between items-center text-xs">
					<span className="text-slate-400 font-medium">Password Security Score</span>
					<span className={`font-semibold ${level >= 3 ? "text-emerald-400" : level === 2 ? "text-amber-400" : "text-red-400"}`}>
						{bits} bits • {label}
					</span>
				</div>
				<div className="grid grid-cols-4 gap-1.5 h-2">
					{[1, 2, 3, 4].map((seg) => (
						<div
							key={seg}
							className={`h-full rounded-full transition-all duration-300 ${
								seg <= level ? color : "bg-slate-800"
							}`}
						/>
					))}
				</div>
			</div>
		);
	};

	return (
		<div className="flex-1 min-w-0 bg-[#09090b] flex flex-col h-full overflow-hidden select-text text-slate-200">
			{/* Top Header Controls (Fixed) */}
			<div className="shrink-0 p-4 sm:p-6 border-b border-slate-800/60 flex items-center justify-between bg-[#131315]/80 backdrop-blur-md z-10">
				<div className="flex items-center gap-3">
					{onBack && (
						<button
							onClick={onBack}
							className="md:hidden p-2 rounded-lg bg-[#1c1b1d] border border-slate-800 text-slate-400 hover:text-white transition-all shrink-0"
							title="Back to list"
						>
							<ArrowLeft className="w-4 h-4" />
						</button>
					)}
					<div className="w-10 h-10 rounded-xl bg-[#1c1b1d] border border-slate-700/60 flex items-center justify-center text-emerald-400 shrink-0 shadow-md">
						{item.type === "password" && <KeyRound className="w-5 h-5" />}
						{item.type === "card" && <CreditCard className="w-5 h-5 text-blue-400" />}
						{item.type === "totp" && <Smartphone className="w-5 h-5 text-purple-400" />}
						{item.type === "note" && <FileText className="w-5 h-5 text-amber-400" />}
						{item.type === "personal_info" && <User className="w-5 h-5 text-cyan-400" />}
					</div>

					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<h1 className="text-base font-bold text-white tracking-wide truncate">{item.title}</h1>
							<span className="px-2 py-0.5 bg-[#1c1b1d] text-slate-400 border border-slate-800 rounded text-[10px] font-mono uppercase shrink-0">
								{item.type}
							</span>
						</div>
						<p className="text-xs text-slate-500 font-mono mt-0.5">
							Created: {new Date(item.createdAt).toLocaleDateString()}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<button
						onClick={() => onToggleFavorite(item.id)}
						className={`p-2 rounded-lg border transition-all ${
							item.favorite
								? "bg-amber-950/30 border-amber-500/50 text-amber-400"
								: "bg-[#1c1b1d] border-slate-800 text-slate-400 hover:text-white"
						}`}
						title="Toggle Favorite"
					>
						<Star className={`w-4 h-4 ${item.favorite ? "fill-amber-400" : ""}`} />
					</button>

					<button
						onClick={() => onEdit(item)}
						className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c1b1d] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all"
					>
						<Edit className="w-3.5 h-3.5" />
						<span className="hidden sm:inline">Edit</span>
					</button>

					<button
						onClick={() => setShowDeleteConfirmModal(true)}
						className="p-2 rounded-lg bg-[#1c1b1d] hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-800 transition-all"
						title="Delete Secret"
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Main Content Body (Dedicated Scroll Container) */}
			<div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-4xl">
				{/* 1. PASSWORD TYPE */}
				{item.type === "password" && (
					<div className="space-y-4">
						{/* Username field */}
						<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
							<label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-mono">
								Username / Email
							</label>
							<div className="flex items-center justify-between">
								<span className="font-mono text-sm text-white select-all">
									{item.username || "—"}
								</span>
								{item.username && (
									<button
										onClick={() => handleCopy(item.username, "Username")}
										className="p-1.5 rounded hover:bg-[#1c1b1d] text-slate-400 hover:text-emerald-400 transition-colors"
									>
										{copiedField === "Username" ? (
											<Check className="w-4 h-4 text-emerald-400" />
										) : (
											<Copy className="w-4 h-4" />
										)}
									</button>
								)}
							</div>
						</div>

						{/* Password field with reveal toggle */}
						<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
							<label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-mono">
								Password Secret
							</label>
							<div className="flex items-center justify-between gap-4">
								<span className="font-mono text-base text-emerald-400 tracking-wider select-all">
									{revealedFields["password"] ? item.password : "••••••••••••••••"}
								</span>
								<div className="flex items-center gap-1">
									<button
										onClick={() => toggleReveal("password")}
										className="p-1.5 rounded hover:bg-[#1c1b1d] text-slate-400 hover:text-white transition-colors"
									>
										{revealedFields["password"] ? (
											<EyeOff className="w-4 h-4" />
										) : (
											<Eye className="w-4 h-4" />
										)}
									</button>
									<button
										onClick={() => handleCopy(item.password, "Password")}
										className="p-1.5 rounded hover:bg-[#1c1b1d] text-slate-400 hover:text-emerald-400 transition-colors"
									>
										{copiedField === "Password" ? (
											<Check className="w-4 h-4 text-emerald-400" />
										) : (
											<Copy className="w-4 h-4" />
										)}
									</button>
								</div>
							</div>
						</div>

						{/* Website URL */}
						{item.url && (
							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-mono">
									Website Address
								</label>
								<div className="flex items-center justify-between">
									<a
										href={item.url}
										target="_blank"
										rel="noreferrer"
										className="text-xs text-blue-400 hover:underline font-mono flex items-center gap-1.5"
									>
										<span>{item.url}</span>
										<ExternalLink className="w-3.5 h-3.5" />
									</a>
									<button
										onClick={() => handleCopy(item.url || "", "URL")}
										className="p-1.5 rounded hover:bg-[#1c1b1d] text-slate-400 hover:text-emerald-400 transition-colors"
									>
										<Copy className="w-4 h-4" />
									</button>
								</div>
							</div>
						)}

						{/* Security Entropy Audit */}
						{renderEntropyBar(item.password)}
					</div>
				)}

				{/* 2. CARD / IDENTITY DOCUMENT TYPE */}
				{item.type === "card" && (
					<div className="space-y-6">
						{/* Metallic Visual Card Display */}
						<div className="w-full h-52 rounded-2xl p-6 bg-gradient-to-br from-slate-900 via-[#1c1b1d] to-[#09090b] border border-slate-700/80 shadow-2xl relative overflow-hidden flex flex-col justify-between text-white glow-blue">
							<div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

							<div className="flex justify-between items-start relative z-10">
								<div>
									<span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
										{item.country || "OFFICIAL IDENTIFICATION"}
									</span>
									<h2 className="text-base font-bold tracking-wide">{item.title}</h2>
								</div>
								<span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-mono font-bold uppercase">
									{item.subtype.replace("_", " ")}
								</span>
							</div>

							<div className="space-y-1 relative z-10 my-auto">
								<span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
									Document Number
								</span>
								<div className="text-xl font-mono tracking-widest text-emerald-400 font-bold select-all">
									{revealedFields["cardNumber"]
										? item.number
										: item.number.replace(/\d(?=\d{4})/g, "•")}
								</div>
							</div>

							<div className="flex justify-between items-end relative z-10 text-xs font-mono">
								<div>
									<span className="text-[9px] text-slate-400 block uppercase">Cardholder Name</span>
									<span className="font-semibold uppercase tracking-wider">{item.cardholderName}</span>
								</div>
								{item.expirationDate && (
									<div>
										<span className="text-[9px] text-slate-400 block uppercase">Expires</span>
										<span className="font-semibold text-emerald-300">{item.expirationDate}</span>
									</div>
								)}
							</div>
						</div>

						{/* Field details */}
						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-mono">
									Full Card Number / ID
								</label>
								<div className="flex items-center justify-between">
									<span className="font-mono text-sm text-white select-all">
										{revealedFields["cardNumber"] ? item.number : item.number.replace(/\d(?=\d{4})/g, "•")}
									</span>
									<div className="flex items-center gap-1">
										<button
											onClick={() => toggleReveal("cardNumber")}
											className="p-1 text-slate-400 hover:text-white"
										>
											{revealedFields["cardNumber"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
										</button>
										<button
											onClick={() => handleCopy(item.number, "Document Number")}
											className="p-1 text-slate-400 hover:text-emerald-400"
										>
											<Copy className="w-4 h-4" />
										</button>
									</div>
								</div>
							</div>

							{/* Credit card: Show CVV / CVC (copyable) */}
							{item.subtype === "credit_card" ? (
								(item.cvv || item.pin) && (
									<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
										<label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-mono">
											CVV / CVC
										</label>
										<div className="flex items-center justify-between">
											<span className="font-mono text-sm text-emerald-400 select-all">
												{revealedFields["cvv"] ? (item.cvv || item.pin) : "•••"}
											</span>
											<div className="flex items-center gap-1">
												<button onClick={() => toggleReveal("cvv")} className="p-1 text-slate-400 hover:text-white">
													{revealedFields["cvv"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
												</button>
												<button
													onClick={() => handleCopy(item.cvv || item.pin || "", "CVV")}
													className="p-1 text-slate-400 hover:text-emerald-400"
													title="Copy CVV"
												>
													{copiedField === "CVV" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
												</button>
											</div>
										</div>
									</div>
								)
							) : (
								/* Non-credit card ID/Passport: Show PIN if available */
								item.pin && (
									<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
										<label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-mono">
											PIN / Security Code
										</label>
										<div className="flex items-center justify-between">
											<span className="font-mono text-sm text-emerald-400 select-all">
												{revealedFields["pin"] ? item.pin : "••••"}
											</span>
											<div className="flex items-center gap-1">
												<button onClick={() => toggleReveal("pin")} className="p-1 text-slate-400 hover:text-white">
													{revealedFields["pin"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
												</button>
												<button
													onClick={() => handleCopy(item.pin || "", "PIN")}
													className="p-1 text-slate-400 hover:text-emerald-400"
													title="Copy PIN"
												>
													{copiedField === "PIN" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
												</button>
											</div>
										</div>
									</div>
								)
							)}
						</div>
					</div>
				)}

				{/* 3. 2FA AUTHENTICATOR ("THE KEYMASTER") */}
				{item.type === "totp" && (
					<div className="space-y-6">
						<div className="p-6 bg-[#131315] border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 shadow-xl glow-emerald">
							<span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
								{item.issuer} • {item.accountName}
							</span>

							{/* Large Split 6-digit Code */}
							<div className="text-4xl font-mono font-bold tracking-widest text-emerald-400 tnum select-all">
								{totpStatus.formattedCode}
							</div>

							{/* Progress ring countdown */}
							<div className="flex items-center gap-3 pt-2">
								<div className="relative w-8 h-8 flex items-center justify-center">
									<svg className="w-full h-full -rotate-90">
										<circle
											cx="16"
											cy="16"
											r="13"
											stroke="currentColor"
											strokeWidth="3"
											className="text-slate-800"
											fill="transparent"
										/>
										<circle
											cx="16"
											cy="16"
											r="13"
											stroke="currentColor"
											strokeWidth="3"
											className={totpStatus.remainingSeconds <= 5 ? "text-red-500" : "text-emerald-400"}
											strokeDasharray={81.6}
											strokeDashoffset={81.6 - (81.6 * totpStatus.progressPercent) / 100}
											fill="transparent"
											strokeLinecap="round"
										/>
									</svg>
								</div>
								<span className="text-xs font-mono text-slate-400 tnum">
									Refreshes in <strong className="text-white">{totpStatus.remainingSeconds}s</strong>
								</span>
							</div>

							<button
								onClick={() => handleCopy(totpStatus.code, "2FA Code")}
								className="mt-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-bold rounded-lg text-xs transition-all shadow-lg flex items-center gap-2"
							>
								<Copy className="w-4 h-4" />
								<span>Copy 6-Digit Code</span>
							</button>
						</div>

						{/* Secret Key Raw View */}
						<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
							<label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-mono">
								Base32 Secret Key
							</label>
							<div className="flex items-center justify-between">
								<span className="font-mono text-xs text-slate-300 select-all">
									{revealedFields["totpSecret"] ? item.secret : "••••••••••••••••••••"}
								</span>
								<div className="flex items-center gap-1">
									<button onClick={() => toggleReveal("totpSecret")} className="p-1 text-slate-400 hover:text-white">
										{revealedFields["totpSecret"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
									</button>
									<button
										onClick={() => handleCopy(item.secret, "TOTP Secret")}
										className="p-1 text-slate-400 hover:text-emerald-400"
									>
										<Copy className="w-4 h-4" />
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* 4. PERSONAL INFO PROFILE */}
				{item.type === "personal_info" && (
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] text-slate-400 font-mono uppercase">First Name</label>
								<div className="flex justify-between items-center text-sm font-semibold text-white">
									<span>{item.firstName || "—"}</span>
									{item.firstName && (
										<button onClick={() => handleCopy(item.firstName || "", "First Name")} className="p-1 text-slate-400 hover:text-emerald-400">
											<Copy className="w-4 h-4" />
										</button>
									)}
								</div>
							</div>

							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] text-slate-400 font-mono uppercase">Last Name</label>
								<div className="flex justify-between items-center text-sm font-semibold text-white">
									<span>{item.lastName || "—"}</span>
									{item.lastName && (
										<button onClick={() => handleCopy(item.lastName || "", "Last Name")} className="p-1 text-slate-400 hover:text-emerald-400">
											<Copy className="w-4 h-4" />
										</button>
									)}
								</div>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] text-slate-400 font-mono uppercase">Full Name</label>
								<div className="flex justify-between items-center text-sm font-semibold text-white">
									<span>{item.fullName || "—"}</span>
									{item.fullName && (
										<button onClick={() => handleCopy(item.fullName, "Full Name")} className="p-1 text-slate-400 hover:text-emerald-400">
											<Copy className="w-4 h-4" />
										</button>
									)}
								</div>
							</div>

							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] text-slate-400 font-mono uppercase">National ID / Passport</label>
								<div className="flex justify-between items-center text-sm font-semibold text-white">
									<span className="font-mono">{item.nationalId || "—"}</span>
									{item.nationalId && (
										<button onClick={() => handleCopy(item.nationalId || "", "National ID")} className="p-1 text-slate-400 hover:text-emerald-400">
											<Copy className="w-4 h-4" />
										</button>
									)}
								</div>
							</div>
						</div>

						<div className="grid grid-cols-3 gap-4">
							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] text-slate-400 font-mono uppercase">Birth Date</label>
								<div className="flex justify-between items-center text-xs font-semibold text-white font-mono">
									<span>{item.birthDate || "—"}</span>
									{item.birthDate && (
										<button onClick={() => handleCopy(item.birthDate || "", "Birth Date")} className="p-1 text-slate-400 hover:text-emerald-400">
											<Copy className="w-3.5 h-3.5" />
										</button>
									)}
								</div>
							</div>

							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] text-slate-400 font-mono uppercase">Gender</label>
								<div className="flex justify-between items-center text-xs font-semibold text-white font-mono">
									<span>{item.gender || "—"}</span>
								</div>
							</div>

							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] text-slate-400 font-mono uppercase">Age</label>
								<div className="flex justify-between items-center text-xs font-semibold text-white font-mono">
									<span>{item.age ? String(item.age) : "—"}</span>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] text-slate-400 font-mono uppercase">Phone Number</label>
								<div className="flex justify-between items-center text-sm font-semibold text-white">
									<span>{item.phone || "—"}</span>
									{item.phone && (
										<button onClick={() => handleCopy(item.phone || "", "Phone")} className="p-1 text-slate-400 hover:text-emerald-400">
											<Copy className="w-4 h-4" />
										</button>
									)}
								</div>
							</div>

							<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
								<label className="text-[11px] text-slate-400 font-mono uppercase">Email Address</label>
								<div className="flex justify-between items-center text-sm font-semibold text-white">
									<span className="truncate">{item.email || "—"}</span>
									{item.email && (
										<button onClick={() => handleCopy(item.email || "", "Email")} className="p-1 text-slate-400 hover:text-emerald-400">
											<Copy className="w-4 h-4" />
										</button>
									)}
								</div>
							</div>
						</div>

						<div className="p-4 bg-[#131315] border border-slate-800/80 rounded-xl space-y-1">
							<label className="text-[11px] text-slate-400 font-mono uppercase">Full Address</label>
							<div className="flex justify-between items-center text-sm font-semibold text-white">
								<span>
									{[item.addressLine1, item.addressLine2, item.city, item.stateProvince, item.postalCode, item.country].filter(Boolean).join(", ") || "—"}
								</span>
								{item.addressLine1 && (
									<button
										onClick={() =>
											handleCopy(
												[item.addressLine1, item.addressLine2, item.city, item.stateProvince, item.postalCode, item.country].filter(Boolean).join(", "),
												"Address"
											)
										}
										className="p-1 text-slate-400 hover:text-emerald-400"
									>
										<Copy className="w-4 h-4" />
									</button>
								)}
							</div>
						</div>
					</div>
				)}

				{/* 5. SECURE NOTE TYPE */}
				{item.type === "note" && (
					<div className="p-5 bg-[#131315] border border-slate-800/80 rounded-2xl space-y-4">
						<div className="flex justify-between items-center pb-2 border-b border-slate-800">
							<div className="flex items-center gap-2">
								<span className="text-xs font-mono text-slate-400 uppercase font-semibold">Encrypted Content</span>
								<span className="text-[10px] font-mono px-2 py-0.5 bg-[#1c1b1d] text-slate-500 rounded border border-slate-800">
									{item.content.split("\n").length} {item.content.split("\n").length === 1 ? "line" : "lines"}
								</span>
							</div>
							<button
								onClick={() => handleCopy(item.content, "Full Note")}
								className="px-3 py-1 bg-[#1c1b1d] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs flex items-center gap-1.5 transition-colors"
							>
								{copiedField === "Full Note" ? (
									<Check className="w-3.5 h-3.5 text-emerald-400" />
								) : (
									<Copy className="w-3.5 h-3.5 text-emerald-400" />
								)}
								<span>{copiedField === "Full Note" ? "Copied All!" : "Copy Full Note"}</span>
							</button>
						</div>

						{/* Line by line display with individual copy buttons */}
						<div className="bg-[#09090b] rounded-xl border border-slate-800/80 divide-y divide-slate-800/40 overflow-hidden">
							{item.content.split("\n").map((line, idx) => {
								const lineLabel = `Line ${idx + 1}`;
								const isCopied = copiedField === lineLabel;
								const trimmed = line.trim();

								return (
									<div
										key={idx}
										className="group flex items-center justify-between px-3.5 py-2 hover:bg-[#131315]/80 transition-colors gap-3"
									>
										<div className="flex items-start gap-3 min-w-0 flex-1">
											<span className="text-[10px] font-mono text-slate-600 select-none w-6 text-right shrink-0 pt-0.5">
												{idx + 1}
											</span>
											<span className="font-mono text-xs text-slate-200 whitespace-pre-wrap break-all leading-relaxed select-all">
												{line || "\u00A0"}
											</span>
										</div>
										{trimmed.length > 0 && (
											<button
												onClick={() => handleCopy(line, lineLabel)}
												className="opacity-70 group-hover:opacity-100 p-1.5 rounded hover:bg-[#1c1b1d] text-slate-400 hover:text-emerald-400 transition-all shrink-0"
												title={`Copy line ${idx + 1}`}
											>
												{isCopied ? (
													<Check className="w-3.5 h-3.5 text-emerald-400" />
												) : (
													<Copy className="w-3.5 h-3.5" />
												)}
											</button>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* Notes / Tags Section Footer */}
				{item.notes && (
					<div className="p-4 bg-[#131315]/60 border border-slate-800/60 rounded-xl space-y-1">
						<span className="text-[11px] font-mono text-slate-400 uppercase">Additional Notes</span>
						<p className="text-xs text-slate-300 leading-relaxed">{item.notes}</p>
					</div>
				)}

				{item.tags.length > 0 && (
					<div className="flex items-center gap-2 pt-2">
						<span className="text-[11px] font-mono text-slate-500 uppercase">Tags:</span>
						{item.tags.map((tag) => (
							<span
								key={tag}
								className="px-2 py-0.5 bg-[#1c1b1d] border border-slate-800 rounded text-[11px] font-mono text-slate-400"
							>
								#{tag}
							</span>
						))}
					</div>
				)}
			</div>

			{/* Custom Dark Confirmation Modal */}
			{showDeleteConfirmModal && (
				<div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
					<div className="bg-[#131315] border border-red-900/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-200">
						{/* Header */}
						<div className="p-4 border-b border-slate-800 flex items-center justify-between bg-red-950/20">
							<div className="flex items-center gap-2 text-red-400">
								<AlertTriangle className="w-5 h-5 shrink-0" />
								<h3 className="text-sm font-bold text-white">Delete Secret Confirmation</h3>
							</div>
							<button
								onClick={() => setShowDeleteConfirmModal(false)}
								className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
							>
								<X className="w-4 h-4" />
							</button>
						</div>

						{/* Content */}
						<div className="p-6 space-y-3 text-xs">
							<p className="text-slate-200 font-medium text-sm">
								Are you sure you want to delete <strong className="text-white font-mono">{item.title}</strong>?
							</p>
							<div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 space-y-1">
								<span className="font-semibold block text-red-200 font-mono text-[11px]">WARNING: PERMANENT DELETION</span>
								<span>This item will be permanently purged from your encrypted local storage and cannot be recovered.</span>
							</div>
						</div>

						{/* Footer Actions */}
						<div className="p-4 bg-[#09090b] border-t border-slate-800 flex items-center justify-end gap-3">
							<button
								type="button"
								onClick={() => setShowDeleteConfirmModal(false)}
								className="px-4 py-2 bg-[#1c1b1d] hover:bg-slate-800 text-slate-300 font-semibold rounded-lg text-xs transition-colors"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => {
									setShowDeleteConfirmModal(false);
									onDelete(item.id);
								}}
								className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-lg"
							>
								<Trash2 className="w-3.5 h-3.5" />
								<span>Delete Item</span>
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
