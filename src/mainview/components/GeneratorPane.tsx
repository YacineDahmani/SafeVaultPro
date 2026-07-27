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
		if (bits < 60) return { text: "Moderate", color: "text-amber-400", bg: "bg-amber-500", level: 2 };
		if (bits < 80) return { text: "Strong", color: "text-emerald-400", bg: "bg-emerald-400", level: 3 };
		return { text: "Very Strong", color: "text-emerald-300", bg: "bg-emerald-500", level: 4 };
	};

	const strength = getEntropyDetails(entropy);

	const handleCopy = () => {
		onCopySecret(generatedPassword, "Generated Password");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
			<div className="w-full max-w-md bg-[#131315] border-l border-slate-800 h-full flex flex-col shadow-2xl p-6 select-none text-slate-200">
				{/* Header */}
				<div className="flex items-center justify-between pb-4 border-b border-slate-800">
					<div className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
							<Zap className="w-4 h-4" />
						</div>
						<h2 className="text-base font-bold text-white tracking-wide">Password Generator</h2>
					</div>

					<button
						onClick={onClose}
						className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1c1b1d] transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Main Output Box */}
				<div className="my-6 space-y-3">
					<div className="p-4 bg-[#09090b] border border-slate-800 rounded-xl relative group flex items-center justify-between">
						<span className="font-mono text-base text-emerald-400 font-bold tracking-wider select-all break-all pr-12">
							{generatedPassword}
						</span>

						<div className="flex items-center gap-1 absolute right-3 top-3">
							<button
								onClick={handleGenerate}
								className="p-1.5 rounded hover:bg-[#1c1b1d] text-slate-400 hover:text-white transition-colors"
								title="Regenerate"
							>
								<RefreshCw className="w-4 h-4" />
							</button>
							<button
								onClick={handleCopy}
								className="p-1.5 rounded hover:bg-[#1c1b1d] text-slate-400 hover:text-emerald-400 transition-colors"
								title="Copy"
							>
								{copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
							</button>
						</div>
					</div>

					{/* Realtime Strength Gauge */}
					<div className="space-y-1.5">
						<div className="flex justify-between text-xs font-mono">
							<span className="text-slate-400">Entropy Rating: {entropy} bits</span>
							<span className={`font-bold ${strength.color}`}>{strength.text}</span>
						</div>
						<div className="grid grid-cols-4 gap-1.5 h-2">
							{[1, 2, 3, 4].map((seg) => (
								<div
									key={seg}
									className={`h-full rounded-full transition-all duration-300 ${
										seg <= strength.level ? strength.bg : "bg-slate-800"
									}`}
								/>
							))}
						</div>
					</div>
				</div>

				{/* Controls */}
				<div className="space-y-6 flex-1 overflow-y-auto">
					{/* Length Slider */}
					<div className="space-y-2">
						<div className="flex justify-between text-xs font-medium">
							<span className="text-slate-300">Password Length</span>
							<span className="font-mono text-emerald-400 font-bold text-sm tnum">{length} chars</span>
						</div>
						<input
							type="range"
							min={6}
							max={64}
							value={length}
							onChange={(e) => setLength(Number(e.target.value))}
							className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
						/>
					</div>

					{/* Character Toggles */}
					<div className="space-y-3 pt-2">
						<span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
							Character Sets
						</span>

						<label className="flex items-center justify-between p-3 bg-[#09090b] rounded-xl border border-slate-800 cursor-pointer">
							<span className="text-xs text-slate-200">Uppercase Letters (A-Z)</span>
							<input
								type="checkbox"
								checked={uppercase}
								onChange={(e) => setUppercase(e.target.checked)}
								className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
							/>
						</label>

						<label className="flex items-center justify-between p-3 bg-[#09090b] rounded-xl border border-slate-800 cursor-pointer">
							<span className="text-xs text-slate-200">Lowercase Letters (a-z)</span>
							<input
								type="checkbox"
								checked={lowercase}
								onChange={(e) => setLowercase(e.target.checked)}
								className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
							/>
						</label>

						<label className="flex items-center justify-between p-3 bg-[#09090b] rounded-xl border border-slate-800 cursor-pointer">
							<span className="text-xs text-slate-200">Numeric Digits (0-9)</span>
							<input
								type="checkbox"
								checked={numbers}
								onChange={(e) => setNumbers(e.target.checked)}
								className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
							/>
						</label>

						<label className="flex items-center justify-between p-3 bg-[#09090b] rounded-xl border border-slate-800 cursor-pointer">
							<span className="text-xs text-slate-200">Special Symbols (@#$%^&*)</span>
							<input
								type="checkbox"
								checked={symbols}
								onChange={(e) => setSymbols(e.target.checked)}
								className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
							/>
						</label>
					</div>
				</div>

				{/* Copy Action */}
				<div className="pt-4 border-t border-slate-800">
					<button
						onClick={handleCopy}
						className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#003824] font-bold rounded-lg text-sm transition-all shadow-lg flex items-center justify-center gap-2"
					>
						<Copy className="w-4 h-4" />
						<span>Copy Generated Password</span>
					</button>
				</div>
			</div>
		</div>
	);
};
