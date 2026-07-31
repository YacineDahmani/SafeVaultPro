import React, { useState, useEffect, useRef } from "react";
import { X, Save, KeyRound, CreditCard, Smartphone, FileText, User, RefreshCw, BadgeCheck, Code2, Plus, Trash2, Upload, FileUp } from "lucide-react";
import type { VaultItem, VaultItemType, CardSubtype } from "../../bun/types";
import { generatePassword } from "../../bun/crypto/vaultCrypto";

interface ItemEditModalProps {
	isOpen: boolean;
	item: VaultItem | null;
	defaultType?: VaultItemType;
	defaultSubtype?: CardSubtype;
	isCategoryLocked?: boolean;
	onClose: () => void;
	onSave: (item: VaultItem) => Promise<void>;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({
	isOpen,
	item,
	defaultType = "password",
	defaultSubtype,
	isCategoryLocked = false,
	onClose,
	onSave,
}) => {
	const [type, setType] = useState<VaultItemType>(defaultType);
	const [title, setTitle] = useState("");
	const [tagsStr, setTagsStr] = useState("");
	const [favorite, setFavorite] = useState(false);
	const [notes, setNotes] = useState("");

	// Password fields
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [url, setUrl] = useState("");

	// Card fields
	const [subtype, setSubtype] = useState<CardSubtype>(defaultSubtype || "passport");
	const [cardholderName, setCardholderName] = useState("");
	const [cardNumber, setCardNumber] = useState("");
	const [expirationDate, setExpirationDate] = useState("");
	const [issueDate, setIssueDate] = useState("");
	const [country, setCountry] = useState("");
	const [pin, setPin] = useState("");
	const [cvv, setCvv] = useState("");
	const [nin, setNin] = useState("");

	// TOTP fields
	const [issuer, setIssuer] = useState("");
	const [accountName, setAccountName] = useState("");
	const [secret, setSecret] = useState("");

	// Note field
	const [content, setContent] = useState("");

	// Env File fields
	const [project, setProject] = useState("");
	const [environment, setEnvironment] = useState("Development");
	const [envContent, setEnvContent] = useState("");
	const [isDraggingEnvFile, setIsDraggingEnvFile] = useState(false);
	const envFileInputRef = useRef<HTMLInputElement | null>(null);

	const handleEnvFileRead = (file: File) => {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result;
			if (typeof text === "string") {
				setEnvContent(text);
				if (!title.trim()) {
					setTitle(file.name === ".env" ? "Environment Variables (.env)" : file.name);
				}
				if (!project.trim() && file.name !== ".env") {
					setProject(file.name.replace(/\.[^/.]+$/, ""));
				}
			}
		};
		reader.readAsText(file);
	};

	// Personal Info fields
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [fullName, setFullName] = useState("");
	const [birthDate, setBirthDate] = useState("");
	const [gender, setGender] = useState("");
	const [age, setAge] = useState("");
	const [nationalId, setNationalId] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [extraPhones, setExtraPhones] = useState<{ label?: string; phone: string }[]>([]);
	const [extraEmails, setExtraEmails] = useState<{ label?: string; email: string }[]>([]);
	const [addressLine1, setAddressLine1] = useState("");
	const [addressLine2, setAddressLine2] = useState("");
	const [city, setCity] = useState("");
	const [stateProvince, setStateProvince] = useState("");
	const [postalCode, setPostalCode] = useState("");

	useEffect(() => {
		if (item) {
			setType(item.type);
			setTitle(item.title);
			setTagsStr(item.tags.join(", "));
			setFavorite(item.favorite);
			setNotes(item.notes || "");

			if (item.type === "password") {
				setUsername(item.username || "");
				setPassword(item.password || "");
				setUrl(item.url || "");
			} else if (item.type === "card") {
				setSubtype(item.subtype || "passport");
				setCardholderName(item.cardholderName || "");
				setCardNumber(item.number || "");
				setExpirationDate(item.expirationDate || "");
				setIssueDate(item.issueDate || "");
				setCountry(item.country || "");
				setPin(item.pin || "");
				setCvv(item.cvv || (item.subtype === "credit_card" ? item.pin || "" : ""));
				setNin(item.nin || (item.subtype !== "credit_card" ? item.pin || "" : ""));
			} else if (item.type === "totp") {
				setIssuer(item.issuer || "");
				setAccountName(item.accountName || "");
				setSecret(item.secret || "");
			} else if (item.type === "note") {
				setContent(item.content || "");
			} else if (item.type === "env") {
				setProject(item.project || "");
				setEnvironment(item.environment || "Development");
				setEnvContent(item.content || "");
			} else if (item.type === "personal_info") {
				setFirstName(item.firstName || "");
				setLastName(item.lastName || "");
				setFullName(item.fullName || "");
				setBirthDate(item.birthDate || "");
				setGender(item.gender || "");
				setAge(item.age ? String(item.age) : "");
				setNationalId(item.nationalId || "");
				setPhone(item.phone || "");
				setEmail(item.email || "");
				setExtraPhones(item.extraPhones ? [...item.extraPhones] : []);
				setExtraEmails(item.extraEmails ? [...item.extraEmails] : []);
				setAddressLine1(item.addressLine1 || "");
				setAddressLine2(item.addressLine2 || "");
				setCity(item.city || "");
				setStateProvince(item.stateProvince || "");
				setPostalCode(item.postalCode || "");
				setCountry(item.country || "");
			}
		} else {
			setType(defaultType);
			setTitle("");
			setTagsStr("");
			setFavorite(false);
			setNotes("");

			setUsername("");
			setPassword(generatePassword({ length: 20 }));
			setUrl("");

			setSubtype(defaultSubtype || (defaultType === "card" ? "credit_card" : "passport"));
			setCardholderName("");
			setCardNumber("");
			setExpirationDate("");
			setIssueDate("");
			setCountry("");
			setPin("");
			setCvv("");
			setNin("");

			setIssuer("");
			setAccountName("");
			setSecret("");

			setContent("");

			setProject("");
			setEnvironment("Development");
			setEnvContent("PORT=8080\nNODE_ENV=development\nAPI_URL=http://localhost:8080/api");

			setFirstName("");
			setLastName("");
			setFullName("");
			setBirthDate("");
			setGender("");
			setAge("");
			setNationalId("");
			setPhone("");
			setEmail("");
			setExtraPhones([]);
			setExtraEmails([]);
			setAddressLine1("");
			setAddressLine2("");
			setCity("");
			setStateProvince("");
			setPostalCode("");
		}
	}, [item, defaultType, defaultSubtype, isOpen]);

	if (!isOpen) return null;

	const handleFormSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;

		const tags = tagsStr
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);

		const now = Date.now();
		const baseItem = {
			id: item?.id || `item-${Date.now()}`,
			title,
			favorite,
			tags,
			notes,
			createdAt: item?.createdAt || now,
			updatedAt: now,
		};

		let payload: VaultItem;

		if (type === "password") {
			payload = {
				...baseItem,
				type: "password",
				username,
				password,
				url,
			};
		} else if (type === "card") {
			payload = {
				...baseItem,
				type: "card",
				subtype,
				cardholderName,
				number: cardNumber,
				expirationDate,
				issueDate,
				country,
				nin: subtype !== "credit_card" ? nin : undefined,
				pin: subtype !== "credit_card" ? nin : (pin || cvv),
				cvv: subtype === "credit_card" ? (cvv || pin) : undefined,
			};
		} else if (type === "totp") {
			payload = {
				...baseItem,
				type: "totp",
				issuer,
				accountName,
				secret,
				period: 30,
				digits: 6,
			};
		} else if (type === "note") {
			payload = {
				...baseItem,
				type: "note",
				content,
			};
		} else if (type === "env") {
			payload = {
				...baseItem,
				type: "env",
				project,
				environment,
				content: envContent,
			};
		} else {
			payload = {
				...baseItem,
				type: "personal_info",
				firstName,
				lastName,
				fullName: fullName || `${firstName} ${lastName}`.trim(),
				birthDate,
				gender,
				age: age ? parseInt(String(age), 10) || age : undefined,
				nationalId,
				phone,
				email,
				extraPhones: extraPhones.filter((p) => p.phone.trim().length > 0),
				extraEmails: extraEmails.filter((e) => e.email.trim().length > 0),
				addressLine1,
				addressLine2,
				city,
				stateProvince,
				postalCode,
				country,
			};
		}

		await onSave(payload);
	};

	const getModalBadgeTitle = () => {
		if (type === "password") return "Adding Password Secret";
		if (type === "note") return "Adding Secure Note";
		if (type === "personal_info") return "Adding Personal Identity Profile";
		if (type === "totp") return "Adding 2FA Code";
		if (type === "env") return "Adding Environment Variables (.env)";
		if (type === "card") {
			if (subtype === "credit_card") return "Adding Payment Credit Card";
			return "Adding Identity Document / Passport";
		}
		return "New Vault Entry";
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
			<div className="bg-[#131315] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] text-slate-200">
				{/* Header */}
				<div className="p-5 border-b border-slate-800 flex items-center justify-between">
					<div>
						<h2 className="text-base font-bold text-white tracking-wide">
							{item ? "Edit Secret" : getModalBadgeTitle()}
						</h2>
						{isCategoryLocked && (
							<span className="text-[10px] text-emerald-400 font-mono">
								Category locked to current view
							</span>
						)}
					</div>
					<button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Body */}
				<form onSubmit={handleFormSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
					{/* Type Selector (only shown if not locked to a specific category) */}
					{!item && !isCategoryLocked && (
						<div>
							<label className="block text-slate-400 font-mono mb-1">Item Category</label>
							<div className="grid grid-cols-6 gap-1 p-1 bg-[#09090b] rounded-lg border border-slate-800">
								{[
									{ id: "password", label: "Password", icon: KeyRound },
									{ id: "card", label: "Card/ID", icon: CreditCard },
									{ id: "totp", label: "2FA Code", icon: Smartphone },
									{ id: "note", label: "Note", icon: FileText },
									{ id: "personal_info", label: "Profile", icon: User },
									{ id: "env", label: ".env File", icon: Code2 },
								].map((cat) => {
									const Icon = cat.icon;
									const active = type === cat.id;
									return (
										<button
											key={cat.id}
											type="button"
											onClick={() => setType(cat.id as VaultItemType)}
											className={`py-2 px-1 rounded flex flex-col items-center gap-1 font-medium transition-all ${
												active
													? "bg-[#1c1b1d] text-emerald-400 border border-slate-700 shadow"
													: "text-slate-500 hover:text-slate-300"
											}`}
										>
											<Icon className="w-3.5 h-3.5" />
											<span className="text-[9px] truncate">{cat.label}</span>
										</button>
									);
								})}
							</div>
						</div>
					)}

					{/* Title */}
					<div>
						<label className="block text-slate-400 font-mono mb-1">Item Title *</label>
						<input
							type="text"
							required
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={
								type === "password"
									? "e.g. GitHub Developer Account"
									: type === "card"
									? subtype === "credit_card"
										? "e.g. Corporate Platinum Visa"
										: "e.g. Primary International Passport"
									: type === "note"
									? "e.g. Emergency Recovery Seed Codes"
									: type === "env"
									? "e.g. Production Backend .env"
									: "e.g. Personal Profile"
							}
							className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium focus:outline-none focus:border-emerald-500"
						/>
					</div>

					{/* TYPE 1: PASSWORD */}
					{type === "password" && (
						<>
							<div>
								<label className="block text-slate-400 font-mono mb-1">Username / Email</label>
								<input
									type="text"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									placeholder="user@example.com"
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
								/>
							</div>

							<div>
								<div className="flex justify-between items-center mb-1">
									<label className="text-slate-400 font-mono">Password</label>
									<button
										type="button"
										onClick={() => setPassword(generatePassword({ length: 20 }))}
										className="text-emerald-400 hover:underline text-[11px] flex items-center gap-1"
									>
										<RefreshCw className="w-3 h-3" />
										<span>Generate Random</span>
									</button>
								</div>
								<input
									type="text"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
								/>
							</div>

							<div>
								<label className="block text-slate-400 font-mono mb-1">Website URL</label>
								<input
									type="url"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									placeholder="https://..."
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
								/>
							</div>
						</>
					)}

					{/* TYPE 2: CARD / ID */}
					{type === "card" && (
						<>
							{/* Subtype Selector */}
							<div>
								<label className="block text-slate-400 font-mono mb-1">Document / Card Type</label>
								{isCategoryLocked && defaultSubtype === "credit_card" ? (
									<div className="px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-emerald-400 font-mono font-semibold">
										Credit / Debit Payment Card
									</div>
								) : (
									<select
										value={subtype}
										onChange={(e) => setSubtype(e.target.value as CardSubtype)}
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
									>
										{defaultSubtype === "credit_card" ? (
											<option value="credit_card">Credit / Debit Card</option>
										) : (
											<>
												<option value="passport">Passport</option>
												<option value="id_card">National ID Card</option>
												<option value="drivers_license">Driver's License</option>
												<option value="credit_card">Credit / Debit Card</option>
												<option value="custom">Custom Identity Badge</option>
											</>
										)}
									</select>
								)}
							</div>

							<div>
								<label className="block text-slate-400 font-mono mb-1">
									{subtype === "credit_card" ? "Cardholder Name" : "Name on Document"}
								</label>
								<input
									type="text"
									value={cardholderName}
									onChange={(e) => setCardholderName(e.target.value)}
									placeholder="ALEXANDER VAULT"
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
								/>
							</div>

							<div>
								<label className="block text-slate-400 font-mono mb-1">
									{subtype === "credit_card" ? "Card Number (16 digits)" : "Document Number"}
								</label>
								<input
									type="text"
									value={cardNumber}
									onChange={(e) => setCardNumber(e.target.value)}
									placeholder={subtype === "credit_card" ? "4532 9012 8841 0092" : "P892104928"}
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-slate-400 font-mono mb-1">Expiration Date</label>
									<input
										type="text"
										value={expirationDate}
										onChange={(e) => setExpirationDate(e.target.value)}
										placeholder="2032-05-13"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
									/>
								</div>
								{subtype === "credit_card" ? (
									<div>
										<label className="block text-slate-400 font-mono mb-1">
											CVV / CVC
										</label>
										<input
											type="text"
											value={cvv || pin}
											onChange={(e) => {
												setCvv(e.target.value);
												setPin(e.target.value);
											}}
											placeholder="884"
											className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
										/>
									</div>
								) : (
									<div>
										<label className="block text-slate-400 font-mono mb-1">
											NIN 
										</label>
										<input
											type="text"
											value={nin}
											onChange={(e) => setNin(e.target.value)}
											placeholder="NIN982104928"
											className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
										/>
									</div>
								)}
							</div>
						</>
					)}

					{/* TYPE 3: 2FA TOTP */}
					{type === "totp" && (
						<>
							<div>
								<label className="block text-slate-400 font-mono mb-1">Service Issuer</label>
								<input
									type="text"
									value={issuer}
									onChange={(e) => setIssuer(e.target.value)}
									placeholder="Amazon Web Services"
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium focus:outline-none focus:border-emerald-500"
								/>
							</div>
							<div>
								<label className="block text-slate-400 font-mono mb-1">Account Label</label>
								<input
									type="text"
									value={accountName}
									onChange={(e) => setAccountName(e.target.value)}
									placeholder="admin@cloud.io"
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium focus:outline-none focus:border-emerald-500"
								/>
							</div>
							<div>
								<label className="block text-slate-400 font-mono mb-1">Base32 Secret Key</label>
								<input
									type="text"
									value={secret}
									onChange={(e) => setSecret(e.target.value)}
									placeholder="JBSWY3DPEHPK3PXP"
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500 uppercase"
								/>
							</div>
						</>
					)}

					{/* TYPE 4: NOTE */}
					{type === "note" && (
						<div>
							<label className="block text-slate-400 font-mono mb-1">Encrypted Note Content</label>
							<textarea
								rows={6}
								value={content}
								onChange={(e) => setContent(e.target.value)}
								placeholder="Enter secure emergency recovery keys..."
								className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
							/>
						</div>
					)}

					{/* TYPE 5: .ENV FILE */}
					{type === "env" && (
						<>
							{/* Hidden File Input */}
							<input
								type="file"
								ref={envFileInputRef}
								style={{ display: "none" }}
								accept=".env,text/plain,.txt"
								onChange={(e) => {
									if (e.target.files && e.target.files[0]) {
										handleEnvFileRead(e.target.files[0]);
									}
								}}
							/>

							{/* Drag & Drop File Zone */}
							<div
								onDragOver={(e) => {
									e.preventDefault();
									setIsDraggingEnvFile(true);
								}}
								onDragLeave={() => setIsDraggingEnvFile(false)}
								onDrop={(e) => {
									e.preventDefault();
									setIsDraggingEnvFile(false);
									if (e.dataTransfer.files && e.dataTransfer.files[0]) {
										handleEnvFileRead(e.dataTransfer.files[0]);
									}
								}}
								onClick={() => envFileInputRef.current?.click()}
								className={`p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
									isDraggingEnvFile
										? "border-emerald-400 bg-emerald-950/30 text-emerald-300 shadow-lg"
										: "border-slate-800 hover:border-slate-700 bg-[#09090b]/50 text-slate-400 hover:text-slate-200"
								}`}
							>
								<FileUp className={`w-6 h-6 mb-1.5 ${isDraggingEnvFile ? "text-emerald-400 animate-bounce" : "text-slate-500"}`} />
								<p className="text-xs font-semibold text-white">
									Drag & drop your <span className="text-emerald-400 font-mono">.env</span> file here
								</p>
								<p className="text-[10px] text-slate-500 font-mono mt-0.5">
									or <span className="text-emerald-400 hover:underline">click to browse files</span> on your computer
								</p>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-slate-400 font-mono mb-1">Project Name</label>
									<input
										type="text"
										value={project}
										onChange={(e) => setProject(e.target.value)}
										placeholder="e.g. SafeVaultPro API"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium focus:outline-none focus:border-emerald-500"
									/>
								</div>
								<div>
									<label className="block text-slate-400 font-mono mb-1">Environment Target</label>
									<select
										value={environment}
										onChange={(e) => setEnvironment(e.target.value)}
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
									>
										<option value="Development">Development</option>
										<option value="Staging">Staging</option>
										<option value="Production">Production</option>
										<option value="Testing">Testing</option>
										<option value="Custom">Custom</option>
									</select>
								</div>
							</div>

							<div>
								<div className="flex justify-between items-center mb-1">
									<label className="text-slate-400 font-mono">.env File Content (KEY=VALUE)</label>
									<button
										type="button"
										onClick={() => envFileInputRef.current?.click()}
										className="text-emerald-400 hover:underline text-[11px] font-mono flex items-center gap-1"
									>
										<Upload className="w-3 h-3" />
										<span>Import File</span>
									</button>
								</div>
								<textarea
									rows={8}
									value={envContent}
									onChange={(e) => setEnvContent(e.target.value)}
									placeholder={`PORT=8080\nNODE_ENV=production\nDATABASE_URL=sqlite://data.db\nSECRET_KEY=982347102983`}
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-emerald-400 font-mono text-xs leading-relaxed focus:outline-none focus:border-emerald-500 whitespace-pre"
								/>
							</div>
						</>
					)}

					{/* TYPE 6: PERSONAL INFO */}
					{type === "personal_info" && (
						<>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-slate-400 font-mono mb-1">First Name</label>
									<input
										type="text"
										value={firstName}
										onChange={(e) => {
											setFirstName(e.target.value);
											if (!fullName || fullName === `${firstName} ${lastName}`.trim()) {
												setFullName(`${e.target.value} ${lastName}`.trim());
											}
										}}
										placeholder="Alexander"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium"
									/>
								</div>
								<div>
									<label className="block text-slate-400 font-mono mb-1">Last Name</label>
									<input
										type="text"
										value={lastName}
										onChange={(e) => {
											setLastName(e.target.value);
											if (!fullName || fullName === `${firstName} ${lastName}`.trim()) {
												setFullName(`${firstName} ${e.target.value}`.trim());
											}
										}}
										placeholder="Vault"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium"
									/>
								</div>
							</div>

							<div>
								<label className="block text-slate-400 font-mono mb-1">Full Name</label>
								<input
									type="text"
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									placeholder="Alexander Vault"
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium"
								/>
							</div>

							<div className="grid grid-cols-3 gap-3">
								<div>
									<label className="block text-slate-400 font-mono mb-1">Birth Date</label>
									<input
										type="text"
										value={birthDate}
										onChange={(e) => setBirthDate(e.target.value)}
										placeholder="YYYY-MM-DD"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
									/>
								</div>
								<div>
									<label className="block text-slate-400 font-mono mb-1">Gender</label>
									<select
										value={gender}
										onChange={(e) => setGender(e.target.value)}
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
									>
										<option value="">Unspecified</option>
										<option value="Male">Male</option>
										<option value="Female">Female</option>
										<option value="Other">Other</option>
									</select>
								</div>
								<div>
									<label className="block text-slate-400 font-mono mb-1">Age</label>
									<input
										type="text"
										value={age}
										onChange={(e) => setAge(e.target.value)}
										placeholder="30"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
									/>
								</div>
							</div>

							{/* Primary Phone & Email */}
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-slate-400 font-mono mb-1">Primary Phone Number</label>
									<input
										type="text"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
										placeholder="+1 (555) 019-2834"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
									/>
								</div>
								<div>
									<label className="block text-slate-400 font-mono mb-1">Primary Email Address</label>
									<input
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										placeholder="user@proton.me"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
									/>
								</div>
							</div>

							{/* Extra Phone Numbers */}
							<div className="space-y-2 border-t border-slate-800/60 pt-2">
								<div className="flex justify-between items-center">
									<label className="text-[11px] font-mono text-slate-400 uppercase">Additional Phone Numbers</label>
									<button
										type="button"
										onClick={() => setExtraPhones([...extraPhones, { label: "Work", phone: "" }])}
										className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
									>
										<Plus className="w-3 h-3" />
										<span>Add Phone</span>
									</button>
								</div>
								{extraPhones.map((entry, idx) => (
									<div key={idx} className="flex items-center gap-2">
										<input
											type="text"
											value={entry.label || ""}
											onChange={(e) => {
												const next = [...extraPhones];
												next[idx].label = e.target.value;
												setExtraPhones(next);
											}}
											placeholder="Label (e.g. Work)"
											className="w-28 px-2.5 py-1.5 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono text-xs"
										/>
										<input
											type="text"
											value={entry.phone}
											onChange={(e) => {
												const next = [...extraPhones];
												next[idx].phone = e.target.value;
												setExtraPhones(next);
											}}
											placeholder="+1 (555) 998-1029"
											className="flex-1 px-2.5 py-1.5 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono text-xs"
										/>
										<button
											type="button"
											onClick={() => setExtraPhones(extraPhones.filter((_, i) => i !== idx))}
											className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg"
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									</div>
								))}
							</div>

							{/* Extra Email Addresses */}
							<div className="space-y-2 border-t border-slate-800/60 pt-2">
								<div className="flex justify-between items-center">
									<label className="text-[11px] font-mono text-slate-400 uppercase">Additional Email Addresses</label>
									<button
										type="button"
										onClick={() => setExtraEmails([...extraEmails, { label: "Work", email: "" }])}
										className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
									>
										<Plus className="w-3 h-3" />
										<span>Add Email</span>
									</button>
								</div>
								{extraEmails.map((entry, idx) => (
									<div key={idx} className="flex items-center gap-2">
										<input
											type="text"
											value={entry.label || ""}
											onChange={(e) => {
												const next = [...extraEmails];
												next[idx].label = e.target.value;
												setExtraEmails(next);
											}}
											placeholder="Label (e.g. Backup)"
											className="w-28 px-2.5 py-1.5 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono text-xs"
										/>
										<input
											type="email"
											value={entry.email}
											onChange={(e) => {
												const next = [...extraEmails];
												next[idx].email = e.target.value;
												setExtraEmails(next);
											}}
											placeholder="work@company.com"
											className="flex-1 px-2.5 py-1.5 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono text-xs"
										/>
										<button
											type="button"
											onClick={() => setExtraEmails(extraEmails.filter((_, i) => i !== idx))}
											className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg"
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									</div>
								))}
							</div>

							<div>
								<label className="block text-slate-400 font-mono mb-1">National ID / Passport / NIN</label>
								<input
									type="text"
									value={nationalId}
									onChange={(e) => setNationalId(e.target.value)}
									placeholder="NIN982104928"
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-slate-400 font-mono mb-1">Address Line 1</label>
									<input
										type="text"
										value={addressLine1}
										onChange={(e) => setAddressLine1(e.target.value)}
										placeholder="742 Evergreen Terr"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium"
									/>
								</div>
								<div>
									<label className="block text-slate-400 font-mono mb-1">Address Line 2</label>
									<input
										type="text"
										value={addressLine2}
										onChange={(e) => setAddressLine2(e.target.value)}
										placeholder="Suite 400"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium"
									/>
								</div>
							</div>

							<div className="grid grid-cols-3 gap-3">
								<div>
									<label className="block text-slate-400 font-mono mb-1">City</label>
									<input
										type="text"
										value={city}
										onChange={(e) => setCity(e.target.value)}
										placeholder="Springfield"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium"
									/>
								</div>
								<div>
									<label className="block text-slate-400 font-mono mb-1">State / Wilaya</label>
									<input
										type="text"
										value={stateProvince}
										onChange={(e) => setStateProvince(e.target.value)}
										placeholder="Oregon"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium"
									/>
								</div>
								<div>
									<label className="block text-slate-400 font-mono mb-1">Postal Code</label>
									<input
										type="text"
										value={postalCode}
										onChange={(e) => setPostalCode(e.target.value)}
										placeholder="97477"
										className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
									/>
								</div>
							</div>

							<div>
								<label className="block text-slate-400 font-mono mb-1">Country</label>
								<input
									type="text"
									value={country}
									onChange={(e) => setCountry(e.target.value)}
									placeholder="Algeria / United States"
									className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-medium"
								/>
							</div>
						</>
					)}

					{/* Tags & Notes */}
					<div>
						<label className="block text-slate-400 font-mono mb-1">Tags (Comma-separated)</label>
						<input
							type="text"
							value={tagsStr}
							onChange={(e) => setTagsStr(e.target.value)}
							placeholder="Development, Cloud, Identity"
							className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-mono"
						/>
					</div>

					<div>
						<label className="block text-slate-400 font-mono mb-1">Additional Notes</label>
						<input
							type="text"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Optional context..."
							className="w-full px-3 py-2 bg-[#09090b] border border-slate-800 rounded-lg text-white font-sans"
						/>
					</div>

					{/* Action Buttons */}
					<div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 bg-[#1c1b1d] hover:bg-slate-800 text-slate-300 font-semibold rounded-lg"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-bold rounded-lg flex items-center gap-1.5 shadow-lg"
						>
							<Save className="w-4 h-4" />
							<span>Save Secret</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
