import React, { useState, useEffect, useCallback } from "react";
import { X, Copy, RefreshCw, Check, ShieldCheck, Zap } from "lucide-react";
import { calculatePasswordEntropy, generatePassword } from "../../bun/crypto/vaultCrypto";

interface GeneratorPaneProps {
	isOpen: boolean;
	onClose: () => void;
	onCopySecret: (text: string, label?: string) => void;
}

export const GeneratorPane: React.FC<GeneratorPaneProps> = ({
	isOpen,
	onClose,
	onCopySecret,
}) => {
	const [length, setLength] = useState(20);
	const [uppercase, setUppercase] = useState(true);
	const [lowercase, setLowercase] = useState(true);
	const [numbers, setNumbers] = useState(true);
	const [symbols, setSymbols] = useState(true);
	const [generatedPassword, setGeneratedPassword] = useState("");
	const [copied, setCopied] = useState(false);

	const handleGenerate = useCallback(() => {
		const pass = generatePassword({
			length,
			uppercase,
			lowercase,
			numbers,
			symbols,
		});
		setGeneratedPassword(pass);
	}, [length, uppercase, lowercase, numbers, symbols]);

	useEffect(() => {
		if (isOpen) {
			handleGenerate();
		}
	}, [isOpen, handleGenerate]);

	if (!isOpen) return null;

	const entropy = calculatePasswordEntropy(generatedPassword);
	const getEntropyDetails = (bits: number) => {
		if (bits < 40) return { text: "Weak", color: "text-red-400", bg: "bg-red-500", level: 1 };
		if (bits < 60) return { text: "Fair", color: "text-amber-400", bg: "bg-amber-500", level: 2 };
		if (bits < 80) return { text: "Strong", color: "text-emerald-400", bg: "bg-emerald-400", level: 3 };
		return { text: "Very Strong", color: "text-emerald-300", bg: "bg-emerald-500", level: 4 };
	};

	const strength = getEntropyDetails(entropy);

	const handleCopy = () => {
		onCopySecret(generatedPassword, "Password");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
			<div className="w-full max-w-lg bg-[#131315] border border-slate-800/80 rounded-xl flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200">
				{/* Header */}
				<div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-[#101012]">
					<div className="flex items-center gap-2.5">
						<div className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
							<Zap className="w-3.5 h-3.5" />
						</div>
						<h2 className="text-xs font-bold text-white tracking-wider uppercase font-mono">Password Generator</h2>
					</div>

					<button
						onClick={onClose}
						className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#1c1b1d] transition-colors"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="p-5 space-y-5">
					{/* Display Surface */}
					<div className="space-y-2">
						<div className="p-4 bg-[#09090b] border border-slate-800/90 rounded-lg relative group flex items-center justify-between shadow-inner">
							<span className="font-mono text-base text-emerald-400 font-bold tracking-widest select-all break-all pr-16 leading-relaxed tnum selection:bg-emerald-500/30 selection:text-emerald-200">
								{generatedPassword}
							</span>

							<div className="flex items-center gap-1 absolute right-2.5 top-2.5">
								<button
									onClick={handleGenerate}
									className="p-1.5 rounded-md hover:bg-[#1c1b1d] text-slate-400 hover:text-white transition-colors"
									title="Regenerate"
								>
									<RefreshCw className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={handleCopy}
									className="p-1.5 rounded-md hover:bg-[#1c1b1d] text-slate-400 hover:text-emerald-400 transition-colors"
									title="Copy"
								>
									{copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
								</button>
							</div>
						</div>

						{/* Entropy Bar */}
						<div className="space-y-1">
							<div className="flex justify-between text-[11px] font-mono">
								<span className="text-slate-500 tnum">{entropy} bits entropy</span>
								<span className={`font-semibold ${strength.color}`}>{strength.text}</span>
							</div>
							<div className="grid grid-cols-4 gap-1 h-1.5">
								{[1, 2, 3, 4].map((seg) => (
									<div
										key={seg}
										className={`h-full rounded-full transition-all duration-300 ${
											seg <= strength.level ? strength.bg : "bg-slate-800/80"
										}`}
									/>
								))}
							</div>
						</div>
					</div>

					{/* Settings */}
					<div className="space-y-4">
						{/* Length with Quick Presets */}
						<div className="space-y-2">
							<div className="flex justify-between items-center text-xs">
								<span className="text-slate-400 font-mono text-[11px] uppercase tracking-wider">Length</span>
								<div className="flex items-center gap-2">
									<div className="flex items-center gap-1 bg-[#09090b] p-0.5 rounded border border-slate-800 text-[10px] font-mono">
										{[16, 20, 24, 32].map((len) => (
											<button
												key={len}
												type="button"
												onClick={() => setLength(len)}
												className={`px-1.5 py-0.5 rounded transition-colors ${
													length === len ? "bg-[#1c1b1d] text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
												}`}
											>
												{len}
											</button>
										))}
									</div>
									<span className="font-mono text-emerald-400 font-bold text-xs tnum w-12 text-right">{length} ch</span>
								</div>
							</div>
							<input
								type="range"
								min={8}
								max={64}
								value={length}
								onChange={(e) => setLength(Number(e.target.value))}
								className="w-full h-1.5 bg-[#09090b] border border-slate-800/80 rounded-lg appearance-none cursor-pointer accent-emerald-500"
							/>
						</div>

						{/* Character Types Grid */}
						<div className="space-y-2">
							<span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
								Characters
							</span>

							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setUppercase(!uppercase)}
									className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
										uppercase
											? "bg-[#1c1b1d] border-emerald-500/50 text-white"
											: "bg-[#09090b] border-slate-800/80 text-slate-400 hover:border-slate-700"
									}`}
								>
									<span className="font-mono text-xs">Uppercase (A-Z)</span>
									<span className={`w-2 h-2 rounded-full ${uppercase ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-slate-700"}`} />
								</button>

								<button
									type="button"
									onClick={() => setLowercase(!lowercase)}
									className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
										lowercase
											? "bg-[#1c1b1d] border-emerald-500/50 text-white"
											: "bg-[#09090b] border-slate-800/80 text-slate-400 hover:border-slate-700"
									}`}
								>
									<span className="font-mono text-xs">Lowercase (a-z)</span>
									<span className={`w-2 h-2 rounded-full ${lowercase ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-slate-700"}`} />
								</button>

								<button
									type="button"
									onClick={() => setNumbers(!numbers)}
									className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
										numbers
											? "bg-[#1c1b1d] border-emerald-500/50 text-white"
											: "bg-[#09090b] border-slate-800/80 text-slate-400 hover:border-slate-700"
									}`}
								>
									<span className="font-mono text-xs">Numbers (0-9)</span>
									<span className={`w-2 h-2 rounded-full ${numbers ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-slate-700"}`} />
								</button>

								<button
									type="button"
									onClick={() => setSymbols(!symbols)}
									className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
										symbols
											? "bg-[#1c1b1d] border-emerald-500/50 text-white"
											: "bg-[#09090b] border-slate-800/80 text-slate-400 hover:border-slate-700"
									}`}
								>
									<span className="font-mono text-xs">Symbols (!@#$)</span>
									<span className={`w-2 h-2 rounded-full ${symbols ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-slate-700"}`} />
								</button>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="pt-2 flex items-center gap-3">
						<button
							onClick={handleGenerate}
							className="flex-1 py-2 px-3 bg-[#18181b] hover:bg-slate-800 active:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
						>
							<RefreshCw className="w-3.5 h-3.5 text-slate-400" />
							<span>Regenerate</span>
						</button>

						<button
							onClick={handleCopy}
							className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] flex items-center justify-center gap-1.5"
						>
							{copied ? (
								<>
									<Check className="w-3.5 h-3.5" />
									<span>Copied</span>
								</>
							) : (
								<>
									<Copy className="w-3.5 h-3.5" />
									<span>Copy Password</span>
								</>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
