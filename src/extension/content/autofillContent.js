/**
 * SafeVaultPro Smart Autofill Content Script
 * Refactored Architecture adhering to /refactor-clean and /logic principles.
 * 
 * Invariants & Architecture:
 * 1. Single Badge Per Form: Exactly one badge is attached per form instance.
 * 2. Form Allowlist: Badges inject exclusively on login, register, profile/checkout, and identity verification.
 * 3. Identity Priority Queue: Active Primary Email -> Phone Number -> Full Name for registration identifiers.
 * 4. Multi-Step Authentication: Handles sequential single-field view flows (e.g. Gmail / Microsoft).
 * 5. Isolation: Identity documents (NIN / Passport) are strictly isolated from payment card pipelines.
 */
(function () {
	'use strict';

	let activeDropdown = null;
	const currentDomain = window.location.hostname;
	const attachedBadges = new WeakMap();
	const formBadgeMap = new WeakMap();

	const SVG_ICONS = {
		password: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
		totp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
		card: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
		personal_info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
		document: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>',
		generate: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
		check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
	};

	const MONTH_NAMES = {
		1: ['jan', 'january', 'janvier', 'جانفي', 'يناير', '1', '01'],
		2: ['feb', 'february', 'fevrier', 'février', 'فيفري', 'فبراير', '2', '02'],
		3: ['mar', 'march', 'mars', 'مارس', '3', '03'],
		4: ['apr', 'april', 'avril', 'أفريل', 'ابريل', 'أبريل', '4', '04'],
		5: ['may', 'mai', 'ماي', 'مايو', '5', '05'],
		6: ['jun', 'june', 'juin', 'جوان', 'يونيو', '6', '06'],
		7: ['jul', 'july', 'juillet', 'جويلية', 'يوليو', '7', '07'],
		8: ['aug', 'august', 'aout', 'août', 'أوت', 'اوت', 'أغسطس', '8', '08'],
		9: ['sep', 'september', 'septembre', 'سبتمبر', '9', '09'],
		10: ['oct', 'october', 'octobre', 'أكتوبر', 'اكتوبر', '10'],
		11: ['nov', 'november', 'novembre', 'نوفمبر', '11'],
		12: ['dec', 'december', 'decembre', 'دسمبر', '12']
	};

	// --------------------------------------------------------------------------
	// 1. DOM Helper Utilities & Value Setters
	// --------------------------------------------------------------------------

	function setNativeFieldValue(field, val) {
		if (!field || val === undefined || val === null) return;
		try {
			if (field.tagName === 'SELECT') {
				field.value = String(val);
				field.dispatchEvent(new Event('change', { bubbles: true }));
				field.dispatchEvent(new Event('input', { bubbles: true }));
				return;
			}

			if (field.type === 'radio' || field.type === 'checkbox') {
				field.checked = Boolean(val);
				field.dispatchEvent(new Event('change', { bubbles: true }));
				field.dispatchEvent(new Event('input', { bubbles: true }));
				return;
			}

			const proto = window.HTMLInputElement.prototype;
			const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
			if (valueSetter) {
				valueSetter.call(field, String(val));
			} else {
				field.value = String(val);
			}

			field.dispatchEvent(new Event('input', { bubbles: true }));
			try {
				field.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: String(val) }));
			} catch (_) {}
			field.dispatchEvent(new Event('change', { bubbles: true }));
			field.dispatchEvent(new Event('blur', { bubbles: true }));
		} catch (e) {
			field.value = String(val);
		}
	}

	function getFieldLabelText(input) {
		if (!input) return '';
		let text = '';
		try {
			if (input.id) {
				const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
				if (label) text += label.textContent + ' ';
			}
			const parentLabel = input.closest('label');
			if (parentLabel) text += parentLabel.textContent + ' ';

			const tr = input.closest('tr');
			if (tr) text += tr.textContent + ' ';
			const td = input.closest('td');
			if (td) {
				const prevTd = td.previousElementSibling;
				if (prevTd) text += prevTd.textContent + ' ';
				if (td.parentElement && td.parentElement.children[0]) {
					text += td.parentElement.children[0].textContent + ' ';
				}
			}

			const container = input.closest('div, p, li, section, .form-group, .form-item, mat-form-field');
			if (container) {
				const siblingLabel = container.querySelector('label, mat-label, [class*="label" i]');
				if (siblingLabel && siblingLabel !== parentLabel) {
					text += siblingLabel.textContent + ' ';
				}
				const prev = container.previousElementSibling;
				if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'P')) {
					text += prev.textContent + ' ';
				}
			}
		} catch (e) {}
		return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
	}

	function isElementVisible(el) {
		if (!el) return false;
		try {
			const style = window.getComputedStyle(el);
			if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
			return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
		} catch (e) {
			return true;
		}
	}

	function matchToken(text, regex) {
		return regex.test(text);
	}

	function escapeHtml(str) {
		if (!str) return '';
		return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	// --------------------------------------------------------------------------
	// 2. Field Classification & Form Scoping
	// --------------------------------------------------------------------------

	function shouldIgnoreField(input) {
		if (!input || !input.tagName) return true;
		const tag = input.tagName.toLowerCase();
		if (tag !== 'input' && tag !== 'select') return true;

		const type = (input.type || 'text').toLowerCase();
		const ignoredTypes = ['hidden', 'submit', 'button', 'reset', 'image', 'file', 'checkbox', 'radio', 'range', 'color'];
		if (ignoredTypes.includes(type)) return true;

		if (input.disabled || input.readOnly) return true;
		if (input.getAttribute('aria-hidden') === 'true') return true;

		const style = window.getComputedStyle(input);
		if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.05) {
			return true;
		}
		if (input.offsetWidth < 35 || input.offsetHeight < 12) {
			return true;
		}

		const name = (input.name || '').toLowerCase();
		const id = (input.id || '').toLowerCase();
		const placeholder = (input.placeholder || '').toLowerCase();
		const role = (input.getAttribute('role') || '').toLowerCase();
		const className = (input.className || '').toLowerCase();

		// Exclusion Target: Search bars & command palettes
		const isSearchType = type === 'search' || role === 'search' || role === 'searchbox' || role === 'combobox';
		const searchNameRegex = /^(_?q|query|search|search_query|keyword|s|find|terms?)$/i;
		if (isSearchType || searchNameRegex.test(name) || searchNameRegex.test(id)) {
			if (!name.includes('user') && !id.includes('user') && !id.includes('identifier') && !name.includes('email')) {
				return true;
			}
		}
		if ((placeholder.includes('search') || placeholder.includes('rechercher') || placeholder.includes('بحث')) && !name.includes('email') && !name.includes('user')) {
			return true;
		}

		// Exclusion Target: Segmented multi-digit OTP / verification code inputs (length = 1)
		const maxLen = input.maxLength || parseInt(input.getAttribute('maxlength') || '0', 10);
		const isSingleDigitBox = maxLen === 1 || input.getAttribute('size') === '1' || (input.offsetWidth > 0 && input.offsetWidth <= 55 && input.offsetHeight >= 28);
		if (isSingleDigitBox) {
			const parentContainer = input.parentElement || input.closest('div, section, fieldset, form');
			if (parentContainer) {
				const siblings = Array.from(parentContainer.querySelectorAll('input')).filter(el => {
					const ml = el.maxLength || parseInt(el.getAttribute('maxlength') || '0', 10);
					return ml === 1 || el.getAttribute('size') === '1' || (el.offsetWidth > 0 && el.offsetWidth <= 55);
				});
				if (siblings.length >= 2) {
					return true;
				}
			}
		}

		// Bot Protection / Captchas
		const botKeywords = ['captcha', 'recaptcha', 'hcaptcha', 'cf-turnstile', 'turnstile', 'security-check', 'g-recaptcha-response', 'cf-challenge'];
		if (botKeywords.some(kw => name.includes(kw) || id.includes(kw) || className.includes(kw))) {
			return true;
		}

		// Exclusion Target: Quantity, Filters, Comments, Chat
		const ignorePatterns = [
			/\b(qty|quantity|amount|coupon|promo|discount|voucher|filter|page|pagination)\b/i,
			/\b(message|chat|comment|reply|feedback|review_text)\b/i,
		];
		const combined = `${name} ${id} ${className}`;
		return ignorePatterns.some(p => p.test(combined));
	}

	function isMonthSelect(el) {
		if (!el || el.tagName !== 'SELECT') return false;
		const options = Array.from(el.options);
		if (options.length < 12 || options.length > 15) return false;
		const norm = `${el.name || ''} ${el.id || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
		if (norm.includes('bday') || norm.includes('birth') || norm.includes('naissance') || norm.includes('dob')) return false;
		return options.some(o => {
			const v = (o.value || '').trim();
			const t = (o.text || '').trim().toLowerCase();
			return v === '01' || v === '1' || t === 'jan' || t === 'january' || t === 'janvier';
		}) && options.some(o => {
			const v = (o.value || '').trim();
			const t = (o.text || '').trim().toLowerCase();
			return v === '12' || t === 'dec' || t === 'december' || t === 'decembre';
		});
	}

	function isYearSelect(el) {
		if (!el || el.tagName !== 'SELECT') return false;
		const options = Array.from(el.options);
		if (options.length < 2 || options.length > 60) return false;
		const norm = `${el.name || ''} ${el.id || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
		if (norm.includes('bday') || norm.includes('birth') || norm.includes('naissance') || norm.includes('dob')) return false;
		const currentYear = new Date().getFullYear();
		const currentShort = currentYear % 100;
		return options.some(o => {
			const v = parseInt((o.value || '').trim(), 10);
			const t = parseInt((o.text || '').trim(), 10);
			return (v >= currentYear - 2 && v <= currentYear + 30) || (t >= currentYear - 2 && t <= currentYear + 30) ||
				(v >= currentShort - 2 && v <= currentShort + 30) || (t >= currentShort - 2 && t <= currentShort + 30);
		});
	}

	function isPaymentContext(input) {
		if (!input) return false;
		const ac = (input.autocomplete || '').toLowerCase();
		if (ac.startsWith('cc-')) return true;

		const root = (input.form && input.form.querySelectorAll('input, select').length >= 3) ? input.form : (input.closest('form, [class*="payment" i], [id*="payment" i], [class*="checkout" i], [id*="checkout" i]') || document);
		const inputs = Array.from(root.querySelectorAll('input:not([type="hidden"]), select'));
		return inputs.some(el => {
			const label = getFieldLabelText(el);
			const a = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''} ${el.autocomplete || ''} ${label}`.toLowerCase();
			if (
				a.includes('identite') || a.includes('identité') || a.includes('national') ||
				a.includes('cni') || a.includes('cin') || a.includes('nin') ||
				a.includes('passeport') || a.includes('passport') ||
				a.includes('التعريف') || a.includes('الهوية') || a.includes('الوطني') || a.includes('جواز')
			) {
				return false;
			}
			return a.includes('cc-') ||
				a.includes('cvv') ||
				a.includes('cvc') ||
				a.includes('cvw') ||
				a.includes('carte bancaire') ||
				a.includes('carte de credit') ||
				a.includes('credit card') ||
				a.includes('card number') ||
				a.includes('card_number') ||
				a.includes('pan') ||
				a.includes('edahabia') ||
				a.includes('cib') ||
				a.includes('baridi') ||
				a.includes('satim') ||
				((a.includes('expiration') || a.includes('validite')) && !a.includes('naissance') && !a.includes('birth'));
		});
	}

	function classifyField(input) {
		if (shouldIgnoreField(input)) return 'generic';

		const name = (input.name || '').toLowerCase();
		const id = (input.id || '').toLowerCase();
		const placeholder = (input.placeholder || '').toLowerCase();
		const autocomplete = (input.autocomplete || '').toLowerCase();
		const aria = (input.getAttribute('aria-label') || '').toLowerCase();
		const type = (input.type || '').toLowerCase();
		const labelText = getFieldLabelText(input);

		const raw = `${name} ${id} ${placeholder} ${aria} ${autocomplete} ${type} ${labelText}`
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
		const norm = raw.replace(/[-_./:]+/g, ' ');

		if (input.tagName === 'SELECT') {
			if (isMonthSelect(input)) return 'card_exp_month';
			if (isYearSelect(input)) return 'card_exp_year';
		}

		// Google Accounts / Multi-Step Identifier Specific Detection
		if (
			id === 'identifierid' ||
			name === 'identifier' ||
			(norm.includes('identifier') && norm.includes('whsond')) ||
			(window.location.hostname.includes('accounts.google.com') && (id === 'identifierid' || name === 'identifier' || autocomplete === 'username' || type === 'email'))
		) {
			return 'login_username';
		}
		if (
			(window.location.hostname.includes('accounts.google.com') || window.location.hostname.includes('google.com')) &&
			(name === 'passwd' || name === 'password' || type === 'password')
		) {
			return 'password';
		}

		// Identity Documents: Algerian National NIN (18 digits) - Checked BEFORE cards to avoid false positives
		if (
			matchToken(norm, /\b(nin|national\s*identification\s*num(ber)?|numero\s*d?\s*identification\s*nationale|num\s*identite\s*nationale|identifiant\s*national|matricule\s*national|nin\s*num(ber)?)\b/i) ||
			matchToken(raw, /(رقم[-_]?(التعريف[-_]?الوطني|الهوية[-_]?الوطنية)|الرقم[-_]?الوطني[-_]?(التعريفي|البيومتري)?)/i)
		) {
			return 'doc_nin';
		}

		// Identity Documents: Passport & General National ID / CNI
		if (
			matchToken(norm, /\b(passport|passeport|num\s*passeport|passport\s*number|passport\s*no)\b/i) ||
			matchToken(raw, /(جواز[-_]?السفر|رقم[-_]?جواز[-_]?السفر)/i)
		) {
			return 'doc_passport';
		}
		if (
			matchToken(norm, /\b(national\s*id|ssn|social\s*security|carte\s*identite|carte\s*nationale|num\s*carte\s*identite|cni|cnib|cin|identity\s*card|id\s*card|id\s*number)\b/i) ||
			matchToken(raw, /(رقم[-_]?(التعريف|الهوية|الوطني|بطاقة[-_]?التعريف)|بطاقة[-_]?التعريف|بطاقة[-_]?الهوية)/i)
		) {
			return 'doc_nationalId';
		}

		// Credit Card CVV / CVC (Check BEFORE generic password check since CVV is frequently input type="password")
		if (
			autocomplete === 'cc-csc' ||
			matchToken(norm, /\b(cvv|cvc|cvw|cvp|cvv2|cvc2|cid|cvn|security\s*code|card\s*security|code\s*(securite|secu|verification)|cryptogramme|crypto)\b/i) ||
			matchToken(raw, /(رمز[-_]?(الأمان|الحماية|التحقق|الامان))/i)
		) {
			return 'card_cvv';
		}

		// 2FA / TOTP / Verification code
		if (
			autocomplete === 'one-time-code' ||
			matchToken(norm, /\b(totp|2fa|mfa|otp|one\s*time\s*code|verification\s*code|validation\s*code|security\s*token)\b/i) ||
			matchToken(raw, /(رمز[-_]?(التحقق|التأكيد|التفعيل|الأمان))/i)
		) {
			return 'totp';
		}

		// Passwords (Login & New Password)
		if (type === 'password' || matchToken(norm, /\b(password|mot\s*de\s*passe|mdp|code\s*secret)\b/i) || matchToken(raw, /(كلمة[-_]?(السر|المرور)|الرمز[-_]?السري)/i)) {
			if (
				autocomplete === 'new-password' ||
				matchToken(norm, /\b(new\s*pass(word)?|create\s*pass(word)?|signup\s*pass|confirm\s*pass(word)?|verify\s*pass|repeat\s*pass(word)?)\b/i)
			) {
				return 'new_password';
			}
			return 'password';
		}

		// Credit Card Number (Algerian Edahabia, CIB, BaridiMob, SATIM, Visa, MC, Amex)
		if (
			autocomplete === 'cc-number' ||
			matchToken(norm, /\b(card\s*num(ber)?|cc\s*num(ber)?|credit\s*card|num\s*carte\s*(bancaire|cib|edahabia)|carte\s*(cib|edahabia|bancaire|credit|paiement)|edahabia|baridi|satim|cardno|card_no)\b/i) ||
			matchToken(raw, /(رقم[-_]?(البطاقة[-_]?(الذهبية|البنكية|المصرفية|الائتمانية)|الائتمان)|الذهبية)/i)
		) {
			return 'card_number';
		}

		// Card Expiry Month / Year / Date
		const isIdentityContext = matchToken(norm, /\b(identite|national|cni|cin|nin|passport|passeport)\b/i) || matchToken(raw, /(التعريف|الهوية|الوطني|جواز)/i);
		if (!isIdentityContext) {
			if (autocomplete === 'cc-exp-month' || (matchToken(norm, /\b(exp\s*m(onth)?|cc\s*m(onth)?|card\s*exp\s*month|expiry\s*month|mois\s*exp|card\s*month)\b/i) && !matchToken(norm, /\b(dob|birth|bday|naissance)\b/i))) {
				return 'card_exp_month';
			}
			if (autocomplete === 'cc-exp-year' || (matchToken(norm, /\b(exp\s*y(ear)?|cc\s*y(ear)?|card\s*exp\s*year|expiry\s*year|annee\s*exp|card\s*year|year|annee|année|ano|yy|yyyy|aa|aaaa|ccexpyr|expyear|expy|cardyear)\b/i) && !matchToken(norm, /\b(dob|birth|bday|naissance)\b/i)) || matchToken(norm, /(سنة|عام)/i)) {
				return 'card_exp_year';
			}
			if (
				input.tagName !== 'SELECT' && (
					autocomplete === 'cc-exp' ||
					(matchToken(norm, /\b(exp\s*(date)?|expiry|expiration|mm\s*yy|mm\s*yyyy|date\s*exp(iration)?|validite|valid\s*thru|validthru)\b/i) && !matchToken(norm, /\b(dob|birth|bday|naissance|month|mois|year|annee|yy|yyyy|aa|aaaa)\b/i)) ||
					matchToken(raw, /(تاريخ[-_]?(الانتهاء|إنتهاء|الصلاحية|انقضاء))/i)
				)
			) {
				return 'card_exp';
			}
		}

		// Cardholder Name
		const inPayment = isPaymentContext(input);
		if (
			autocomplete === 'cc-name' ||
			autocomplete === 'cc-given-name' ||
			autocomplete === 'cc-family-name' ||
			matchToken(norm, /\b(card\s*holder|cardholder|name\s*on\s*card|name\s*on\s*the\s*card|card\s*name|cc\s*name|titulaire\s*(carte|compte)|porteur\s*carte|nom\s*porteur|nom\s*titulaire|nom\s*sur\s*carte|titulaire\s*carte|karteninhaber|titular|nombre\s*titular|nombre\s*tarjeta|card\s*owner|cardowner)\b/i) ||
			(inPayment && matchToken(norm, /\b(my\s*name|your\s*name|mon\s*nom|nom\s*prenom|nom\s*et\s*prenom|nom|name|owner|client\s*name|nom\s*client)\b/i) && !matchToken(norm, /\b(billing[-_]?address|shipping[-_]?address|street|city|zip|state|country|email|phone)\b/i)) ||
			matchToken(raw, /(اسم[-_]?(صاحب|حامل)[-_]?البطاقة|صاحب[-_]?البطاقة|حامل[-_]?البطاقة)/i) ||
			(inPayment && matchToken(raw, /(اسمي|الاسم[-_]?واللقب|اسم[-_]?الزبون|اسم[-_]?العميل)/i))
		) {
			return 'card_holder';
		}

		if (inPayment) {
			return 'generic';
		}

		// Check for explicit Latin / Foreign Name indicator in bilingual forms (e.g. "الإسم باللاتينية", "اللقب باللاتينية", "nom en latin")
		const isLatinNameRequested = /\b(latin|latine|french|francais|français|english|en\s*latin|_fr|_en|_lat)\b/i.test(raw) ||
			/(باللاتينية|باللاتينيه|لاتيني|لاتينيه|بالفرنسية|بالفرنسيه|بالانجليزية|بالانكليزية|بالأحرف[-_\s]?اللاتينية|بالاحرف[-_\s]?اللاتينية|بالحروف[-_\s]?اللاتينية|بالحروف[-_\s]?الفرنسية)/i.test(raw);

		// Personal Info: Explicit Arabic Names (First, Last, Full)
		if (!isLatinNameRequested) {
			if (
				matchToken(norm, /\b(first\s*name\s*ar(abic)?|prenom\s*ar(abe)?|nom\s*arabe|arabic\s*first\s*name|fname\s*ar|prenom\s*en\s*arabe|ar\s*first\s*name|ar\s*fname|ar_first|prenom_ar)\b/i) ||
				matchToken(raw, /(الاسم[-_]?(الشخصي|الأول|الاول)?[-_]?(بالعربية|باللغة[-_]?العربية|عربي)|الاسم[-_]?(الشخصي|الأول|الاول)|الإسم[-_]?(الشخصي|الأول|الاول)?[-_]?(بالعربية|باللغة[-_]?العربية|عربي)|الإسم[-_]?(الشخصي|الأول|الاول))/i)
			) {
				return 'personal_firstNameArabic';
			}
			if (
				matchToken(norm, /\b(last\s*name\s*ar(abic)?|family\s*name\s*ar|nom\s*ar(abe)?|arabic\s*last\s*name|lname\s*ar|nom\s*de\s*famille\s*ar|nom\s*en\s*arabe|ar\s*last\s*name|ar\s*lname|ar_last|nom_ar)\b/i) ||
				matchToken(raw, /(اللقب[-_]?(العائلي|بالعربية|عربي)|اسم[-_]?العائلة[-_]?بالعربية|اللقب)/i)
			) {
				return 'personal_lastNameArabic';
			}
			if (
				matchToken(norm, /\b(full\s*name\s*ar(abic)?|nom\s*prenom\s*ar|arabic\s*full\s*name|ar\s*full\s*name|nom_prenom_ar|ar_fullname)\b/i) ||
				matchToken(raw, /(الاسم[-_]?الكامل[-_]?بالعربية|الاسم[-_]?واللقب[-_]?بالعربية|الاسم[-_]?الكامل|الإسم[-_]?الكامل[-_]?بالعربية|الإسم[-_]?واللقب[-_]?بالعربية|الإسم[-_]?الكامل)/i)
			) {
				return 'personal_fullNameArabic';
			}
		}

		// Personal Info: First Name (English, French: prénom, Latin Arabic transliteration)
		if (
			autocomplete === 'given-name' ||
			((matchToken(norm, /\b(first\s*name|given\s*name|forename|fname|prenom|prénom|first_name|firstname)\b/i)) && !matchToken(norm, /\b(card|holder|titulaire|porteur|cc)\b/i)) ||
			(isLatinNameRequested && (matchToken(raw, /(الاسم|الإسم|اسم|first|prenom)/i) && !matchToken(raw, /(اللقب|عائلة|عائله|last|family|nom)/i)))
		) {
			return 'personal_firstName';
		}

		// Personal Info: Last Name (English: surname/last name, French: nom/nom de famille)
		if (
			autocomplete === 'family-name' ||
			((matchToken(norm, /\b(last\s*name|family\s*name|surname|lname|nom\s*de\s*famille|last_name|lastname)\b/i)) && !matchToken(norm, /\b(card|holder|titulaire|porteur|cc)\b/i)) ||
			(matchToken(norm, /\bnom\b/i) && !matchToken(norm, /\b(prenom|prénom|full|user|card|holder|titulaire|porteur|cc)\b/i)) ||
			(isLatinNameRequested && (matchToken(raw, /(اللقب|عائلة|عائله|nom|last|family)/i) && !matchToken(raw, /(الاسم|الإسم|اسم|first|prenom)/i)))
		) {
			return 'personal_lastName';
		}

		// Personal Info: Full Name (English: full name, French: nom complet, nom et prénom)
		if (
			autocomplete === 'name' ||
			((matchToken(norm, /\b(full\s*name|your\s*name|nom\s*prenom|nom\s*et\s*prenom|nom\s*complet|fullname|full_name|billing\s*name|shipping\s*name|contact\s*name|recipient\s*name)\b/i)) && !matchToken(norm, /\b(card|holder|titulaire|porteur|cc)\b/i)) ||
			(isLatinNameRequested && matchToken(raw, /(كامل|full)/i))
		) {
			return 'personal_fullName';
		}

		// Personal Info: Birth Date
		if (type === 'date' || autocomplete === 'bday' || matchToken(norm, /\b(birth\s*date|dob|date\s*of\s*birth|date\s*naissance|bday)\b/i) || matchToken(raw, /(تاريخ[-_]?(الميلاد|الولادة))/i)) {
			return 'personal_birthDate';
		}
		if (autocomplete === 'bday-day' || matchToken(norm, /\b(birth\s*day|dob\s*day|jour\s*naissance)\b/i) || matchToken(raw, /(يوم[-_]?الميلاد)/i)) {
			return 'personal_birthDay';
		}
		if (autocomplete === 'bday-month' || matchToken(norm, /\b(birth\s*month|dob\s*month|mois\s*naissance)\b/i) || matchToken(raw, /(شهر[-_]?الميلاد)/i)) {
			return 'personal_birthMonth';
		}
		if (autocomplete === 'bday-year' || matchToken(norm, /\b(birth\s*year|dob\s*year|annee\s*naissance)\b/i) || matchToken(raw, /(سنة[-_]?الميلاد|عام[-_]?الميلاد)/i)) {
			return 'personal_birthYear';
		}

		// Personal Info: Gender & Age
		if (autocomplete === 'sex' || matchToken(norm, /\b(gender|sex|sexe)\b/i) || matchToken(raw, /(الجنس|النوع)/i)) {
			return 'personal_gender';
		}
		if (matchToken(norm, /\b(age|âge)\b/i) || matchToken(raw, /(العمر|السن)/i)) {
			return 'personal_age';
		}

		// Personal Info: Address & Geo
		if (autocomplete === 'address-line2' || matchToken(norm, /\b(address\s*line2|address\s*line\s*2|address2|address\s*2|apt|suite|complement\s*adresse|batiment|etage)\b/i) || matchToken(raw, /(شقة|عمارة|رقم[-_]?الشقة)/i)) {
			return 'personal_address2';
		}
		if (autocomplete === 'address-line1' || autocomplete === 'street-address' || matchToken(norm, /\b(address\s*line1|address\s*line\s*1|address1|address\s*1|street\s*address|street|adresse|rue)\b/i) || matchToken(raw, /(العنوان|الشارع|عنوان[-_]?الاقامة)/i)) {
			return 'personal_address1';
		}
		if (autocomplete === 'address-level2' || matchToken(norm, /\b(city|ville|town|commune|municipality)\b/i) || matchToken(raw, /(المدينة|البلدية|مكان[-_]?الميلاد|بلدية[-_]?الميلاد)/i)) {
			return 'personal_city';
		}
		if (autocomplete === 'address-level1' || matchToken(norm, /\b(state|province|wilaya|region|departement|county)\b/i) || matchToken(raw, /(الولاية|المحافظة|الاقليم|المنطقة)/i)) {
			return 'personal_state';
		}
		if (autocomplete === 'postal-code' || matchToken(norm, /\b(zip|zip\s*code|postal\s*code|postcode|code\s*postal)\b/i) || matchToken(raw, /(الرمز[-_]?البريدي)/i)) {
			return 'personal_zip';
		}
		if (autocomplete === 'country' || autocomplete === 'country-name' || matchToken(norm, /\b(country|pays|nation)\b/i) || matchToken(raw, /(الدولة|البلد)/i)) {
			return 'personal_country';
		}

		// Contact: Phone
		if (type === 'tel' || autocomplete.includes('tel') || matchToken(norm, /\b(phone|telephone|mobile|cell|cellphone|num\s*tel)\b/i) || matchToken(raw, /(الهاتف|المحمول|الجوال|رقم[-_]?الهاتف)/i)) {
			return 'personal_phone';
		}

		// Login & Identifiers
		const isLogin = isLoginForm(input);
		if (isLogin) {
			if (
				type === 'email' ||
				type === 'tel' ||
				type === 'text' ||
				autocomplete === 'username' ||
				autocomplete === 'email' ||
				matchToken(norm, /\b(username|user\s*name|login|email|e\s*mail|mail|phone|telephone|mobile|identifiant|account|identifier|auth\s*user|session|ident|nin|national\s*id)\b/i) ||
				matchToken(raw, /(اسم[-_]?المستخدم|المعرف|البريد|الهاتف|رقم[-_]?(التعريف|الهوية|الوطني))/i)
			) {
				return 'login_username';
			}
		}

		if (type === 'email' || autocomplete === 'email' || matchToken(norm, /\b(email|e\s*mail|mail|courriel|adresse\s*email)\b/i) || matchToken(raw, /(البريد[-_]?(الإلكتروني|الالكتروني|البريد)?)/i)) {
			if (isRegistrationForm(input)) {
				return 'personal_email';
			}
			return 'login_username';
		}

		if (autocomplete === 'username' || matchToken(norm, /\b(username|user\s*name|login|identifiant|num\s*ccp|rip|user\s*id|auth\s*user)\b/i) || matchToken(raw, /(اسم[-_]?المستخدم|المعرف|رقم[-_]?الحساب)/i)) {
			return 'login_username';
		}

		return 'generic';
	}

	function isLoginUrl() {
		const hash = (window.location.hash || '').split('?')[0].toLowerCase();
		const path = (window.location.pathname || '').toLowerCase();
		return ['login', 'signin', 'sign-in', 'log-in', 'connexion', 'auth'].some(
			kw => hash.includes(kw) || path.includes(kw)
		);
	}

	function isRegistrationUrl() {
		if (isLoginUrl()) return false;
		const hash = (window.location.hash || '').split('?')[0].toLowerCase();
		const path = (window.location.pathname || '').toLowerCase();
		return ['register', 'signup', 'sign-up', 'inscription', "s'inscrire", 'create-account', 'creer-compte'].some(
			kw => hash.includes(kw) || path.includes(kw)
		);
	}

	function isLoginForm(input) {
		if (!input) return false;
		if (isLoginUrl()) return true;
		if (isRegistrationUrl()) return false;
		const form = input.form || input.closest('form, [class*="login" i], [class*="signin" i], [id*="login" i], [id*="signin" i], main') || document;
		const hasPassword = form.querySelector('input[type="password"]') !== null;
		if (hasPassword) return true;

		const autocomplete = (input.autocomplete || '').toLowerCase();
		if (autocomplete === 'username' || autocomplete === 'current-password') return true;

		const pagePath = window.location.pathname.toLowerCase();
		const pageTitle = document.title.toLowerCase();
		return ['login', 'signin', 'sign-in', 'log-in', 'connexion', 'auth', 'sessions/new', 'identifier', 'accounts.google.com', 'login.live.com', 'login.microsoftonline.com', 'تسجيل الدخول'].some(
			kw => pagePath.includes(kw) || pageTitle.includes(kw)
		);
	}

	function isRegistrationForm(input) {
		if (!input) return false;
		if (isLoginUrl()) return false;
		if (isRegistrationUrl()) return true;
		const form = input.form || input.closest('form');
		const autocomplete = (input.autocomplete || '').toLowerCase();
		const attr = `${input.name || ''} ${input.id || ''} ${input.placeholder || ''}`.toLowerCase();

		if (autocomplete === 'current-password' || attr.includes('current-password') || attr.includes('login_password')) {
			return false;
		}

		if (autocomplete === 'new-password' || attr.includes('new-password') || attr.includes('create_password') || attr.includes('signup') || attr.includes('register')) {
			return true;
		}

		if (form && form.querySelectorAll('input[type="password"]').length >= 2) return true;

		const pagePath = window.location.pathname.toLowerCase();
		const pageTitle = document.title.toLowerCase();
		const formHtml = form ? (form.action + ' ' + (form.id || '') + ' ' + (form.name || '') + ' ' + (form.className || '')).toLowerCase() : '';
		const submitBtn = form ? form.querySelector('button[type="submit"], input[type="submit"]') : null;
		const submitText = submitBtn ? (submitBtn.textContent || submitBtn.value || '').toLowerCase() : '';

		const isRegister = ['register', 'signup', 'sign-up', 'create account', 'create-account', "s'inscrire", 'creer compte', 'إنشاء حساب', 'تسجيل حساب'].some(
			kw => pagePath.includes(kw) || pageTitle.includes(kw) || formHtml.includes(kw) || submitText.includes(kw)
		);
		const isLogin = ['login', 'log in', 'log-in', 'sign in', 'signin', 'connexion', 'تسجيل الدخول'].some(
			kw => pagePath.includes(kw) || pageTitle.includes(kw) || formHtml.includes(kw) || submitText.includes(kw)
		);

		return isRegister && !isLogin;
	}

	function getFormScope(input) {
		if (input && input.form) return input.form;
		if (!input || !input.closest) return document.body;

		// If on a dedicated registration flow, treat the main content as the registration container
		if (isRegistrationUrl()) {
			return document.querySelector('form, [role="main"], main, article, .main-content') || document.body;
		}
		if (isLoginUrl()) {
			return document.querySelector('form, [role="main"], main, article, .main-content') || document.body;
		}

		const major = input.closest('form, fieldset, [role="form"], [class*="modal" i], [id*="modal" i], main, article');
		if (major) return major;

		let parent = input.parentElement;
		while (parent && parent !== document.body) {
			const tag = parent.tagName.toLowerCase();
			if (tag === 'form' || tag === 'fieldset' || tag === 'main' || tag === 'section') {
				return parent;
			}
			const count = parent.querySelectorAll('input:not([type="hidden"]), select').length;
			if (count >= 2) {
				const className = (parent.className || '').toLowerCase();
				if (!className.includes('form-item') && !className.includes('form-group') && !className.includes('form-control') && !className.includes('form-row') && !className.includes('input-group')) {
					return parent;
				}
			}
			parent = parent.parentElement;
		}
		return document.body;
	}

	/**
	 * Classify the form instance to enforce allowlist:
	 * Returns: 'login' | 'register' | 'payment' | 'profile' | 'identity_verification' | 'disallowed'
	 */
	function classifyForm(formRoot) {
		if (!formRoot) return 'disallowed';
		const inputs = Array.from(formRoot.querySelectorAll('input:not([type="hidden"]), select')).filter(el => !shouldIgnoreField(el) && isElementVisible(el));
		if (inputs.length === 0) return 'disallowed';

		const classifications = inputs.map(classifyField);

		// 1. Payment Form (must have payment card fields)
		if (classifications.some(c => c === 'card_number' || c === 'card_cvv' || c === 'card_exp')) {
			return 'payment';
		}

		// 2. Explicit Login Page or Form with Single Password & Identifier
		if (isLoginUrl()) {
			return 'login';
		}

		// 3. Explicit Registration Page
		if (isRegistrationUrl()) {
			return 'register';
		}

		// 4. Form-level detection
		const passCount = inputs.filter(i => i.type === 'password' || classifyField(i) === 'password' || classifyField(i) === 'new_password').length;
		if (passCount >= 2 || classifications.some(c => c === 'new_password') || inputs.some(isRegistrationForm)) {
			return 'register';
		}

		if (inputs.some(isLoginForm) || classifications.some(c => c === 'login_username' || c === 'password')) {
			return 'login';
		}

		// 5. Standalone Identity Documents (Only if NOT registration or login)
		if (classifications.some(c => c === 'doc_nin' || c === 'doc_passport' || c === 'doc_nationalId')) {
			return 'identity_verification';
		}

		// 6. Standalone Profile Form
		if (classifications.some(c => c.startsWith('personal_'))) {
			return 'profile';
		}

		return 'disallowed';
	}

	/**
	 * Determine the single primary anchor input for a given form instance
	 * Invariant: Exactly one primary input field receives the badge per form.
	 */
	function getPrimaryAnchorField(formRoot, formType) {
		const inputs = Array.from(formRoot.querySelectorAll('input:not([type="hidden"]), select')).filter(el => !shouldIgnoreField(el) && isElementVisible(el));
		if (inputs.length === 0) return null;

		if (formType === 'payment') {
			return inputs.find(i => classifyField(i) === 'card_number') || inputs[0];
		}

		if (formType === 'identity_verification') {
			return inputs.find(i => {
				const c = classifyField(i);
				return c === 'doc_nin' || c === 'doc_passport' || c === 'doc_nationalId';
			}) || inputs[0];
		}

		if (formType === 'register') {
			// Prefer the very first name / identifier input so the badge anchors at the top of the form
			const anchor = inputs.find(i => {
				const c = classifyField(i);
				return c === 'personal_lastNameArabic' || c === 'personal_firstNameArabic' || c === 'personal_fullNameArabic' ||
					c === 'personal_firstName' || c === 'personal_lastName' || c === 'personal_fullName' ||
					c === 'personal_email' || c === 'login_username' || c === 'doc_nin' || c === 'doc_nationalId';
			});
			if (anchor) return anchor;
			return inputs.find(i => classifyField(i) === 'new_password') || inputs.find(i => i.type === 'password') || inputs[0];
		}

		if (formType === 'login') {
			// Multi-Step view support: if username field exists, choose it; if only password exists (Step 2), choose password
			const userField = inputs.find(i => classifyField(i) === 'login_username' || (i.type !== 'password' && (i.type === 'email' || i.type === 'text')));
			if (userField) return userField;
			return inputs.find(i => classifyField(i) === 'password') || inputs[0];
		}

		if (formType === 'profile') {
			// Profile: first name or full name, or the first personal field
			const preferred = inputs.find(i => {
				const c = classifyField(i);
				return c === 'personal_firstName' || c === 'personal_fullName' || c === 'personal_firstNameArabic' || c === 'personal_fullNameArabic';
			});
			return preferred || inputs.find(i => classifyField(i).startsWith('personal_')) || inputs[0];
		}

		return inputs[0];
	}

	// --------------------------------------------------------------------------
	// 3. Collision Avoidance & Badge Injection
	// --------------------------------------------------------------------------

	function calculateBadgeRightOffset(inp) {
		const isPassword = (inp.type || '').toLowerCase() === 'password';
		let offset = 8;
		if (isPassword) {
			offset = 38; // Safe default clearance for view password eye icons
		}

		try {
			const compStyle = window.getComputedStyle(inp);
			const pr = parseFloat(compStyle.paddingRight) || 0;
			if (pr >= 28) {
				offset = Math.max(offset, pr + 4);
			}

			const parentEl = inp.parentElement;
			if (parentEl) {
				const toggles = parentEl.querySelectorAll('button, [role="button"], [class*="eye" i], [class*="toggle" i], [class*="reveal" i], [aria-label*="password" i], [title*="password" i], svg');
				const inputRect = inp.getBoundingClientRect();
				for (const btn of toggles) {
					if (btn.contains(inp)) continue;
					const btnRect = btn.getBoundingClientRect();
					if (btnRect.width > 8 && btnRect.right >= inputRect.right - 44) {
						offset = Math.max(offset, Math.round(inputRect.right - btnRect.left) + 6);
						break;
					}
				}
			}
		} catch (e) {}

		return Math.min(offset, 84);
	}

	function updateBadgeFixedPosition(input, badge) {
		if (!input || !badge || badge.classList.contains('safevault-dragging')) return;
		const rect = input.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) {
			badge.style.display = 'none';
			return;
		}
		const rightOffset = calculateBadgeRightOffset(input);
		badge.style.display = 'flex';
		badge.style.position = 'fixed';
		badge.style.left = `${rect.right - rightOffset - 26}px`;
		badge.style.top = `${rect.top + (rect.height / 2) - 13}px`;
		badge.style.zIndex = '99999';
	}

	function attachFormBadge(formRoot, primaryInput, formType) {
		if (formBadgeMap.has(formRoot)) {
			const existing = formBadgeMap.get(formRoot);
			if (existing.input === primaryInput && existing.badge.isConnected) {
				if (existing.formType !== formType) {
					existing.formType = formType;
					existing.badge.dataset.formType = formType;
					existing.badge.title = formType === 'register' ? 'SafeVaultPro Registration & Credentials' : (formType === 'payment' ? 'Fill Payment Card' : 'SafeVaultPro Autofill');
				}
				return;
			}
			// Remove old badge if form anchor shifted dynamically
			if (existing.badge) existing.badge.remove();
			formBadgeMap.delete(formRoot);
		}

		const badge = document.createElement('div');
		badge.className = 'safevault-input-badge';
		badge.dataset.formType = formType;
		badge.title = formType === 'register' ? 'SafeVaultPro Registration & Credentials' : (formType === 'payment' ? 'Fill Payment Card' : 'SafeVaultPro Autofill');
		const badgeLogoUrl = chrome.runtime.getURL('icon-32.png');
		badge.innerHTML = `<img src="${badgeLogoUrl}" width="26" height="26" alt="SafeVault" style="pointer-events:none;object-fit:contain;display:block;" />`;

		const rightOffset = calculateBadgeRightOffset(primaryInput);
		badge.style.right = `${rightOffset}px`;

		let container = primaryInput.parentElement || document.body;
		let parentStyle = window.getComputedStyle(container);
		if (parentStyle.position === 'static') {
			container.style.position = 'relative';
		}
		badge.style.position = 'absolute';
		badge.style.top = '50%';
		badge.style.transform = 'translateY(-50%)';
		badge.style.zIndex = '99999';
		container.appendChild(badge);

		formBadgeMap.set(formRoot, { badge, input: primaryInput, formType });
		attachedBadges.set(primaryInput, badge);

		// Drag & Click handlers
		let isDragging = false;
		let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

		function onPointerDown(e) {
			if (e.button !== 0 && e.pointerType === 'mouse') return;
			isDragging = false;
			startX = e.clientX;
			startY = e.clientY;
			const rect = badge.getBoundingClientRect();
			initialLeft = rect.left;
			initialTop = rect.top;

			document.addEventListener('pointermove', onPointerMove);
			document.addEventListener('pointerup', onPointerUp);
		}

		function onPointerMove(e) {
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
				isDragging = true;
				badge.classList.add('safevault-dragging');
				badge.style.position = 'fixed';
				badge.style.right = 'auto';
				badge.style.transform = 'none';
				const newLeft = Math.max(0, Math.min(window.innerWidth - 30, initialLeft + dx));
				const newTop = Math.max(0, Math.min(window.innerHeight - 30, initialTop + dy));
				badge.style.left = `${newLeft}px`;
				badge.style.top = `${newTop}px`;
			}
		}

		function onPointerUp(e) {
			document.removeEventListener('pointermove', onPointerMove);
			document.removeEventListener('pointerup', onPointerUp);
			setTimeout(() => badge.classList.remove('safevault-dragging'), 50);

			if (!isDragging) {
				e.preventDefault();
				e.stopPropagation();
				toggleDropdown(primaryInput, badge, formRoot, formType);
			}
		}

		badge.addEventListener('pointerdown', onPointerDown);
	}

	// --------------------------------------------------------------------------
	// 4. Shadow DOM Dropdown UI & Management
	// --------------------------------------------------------------------------

	let shadowHost = null;
	let shadowRoot = null;

	function getSafeVaultShadowRoot() {
		if (shadowRoot && shadowHost && shadowHost.isConnected) {
			return shadowRoot;
		}
		if (!shadowHost) {
			shadowHost = document.createElement('div');
			shadowHost.id = 'safevault-overlay-host';
			shadowHost.style.cssText = 'all: initial !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; z-index: 2147483647 !important; pointer-events: none !important;';
		}
		if (!shadowHost.isConnected) {
			(document.body || document.documentElement).appendChild(shadowHost);
		}
		if (!shadowRoot) {
			shadowRoot = shadowHost.attachShadow({ mode: 'closed' });
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = chrome.runtime.getURL('content/autofillContent.css');
			shadowRoot.appendChild(link);
		}
		return shadowRoot;
	}

	function closeDropdown() {
		if (activeDropdown) {
			activeDropdown.remove();
			activeDropdown = null;
		}
	}

	function positionDropdown(badge, dropdown) {
		const rect = badge.getBoundingClientRect();
		dropdown.style.position = 'fixed';
		dropdown.style.top = `${Math.min(window.innerHeight - 280, rect.bottom + 4)}px`;
		dropdown.style.left = `${Math.max(10, Math.min(window.innerWidth - 270, rect.left - 160))}px`;
		dropdown.style.zIndex = '999999';
	}

	function showEmptyDropdown(badge, message) {
		closeDropdown();
		const dropdown = document.createElement('div');
		dropdown.className = 'safevault-dropdown-menu';
		dropdown.style.pointerEvents = 'auto';
		dropdown.innerHTML = `
			<div class="safevault-dropdown-header">
				<span class="safevault-brand">SafeVaultPro</span>
				<div class="safevault-header-right">
					<button class="safevault-close-btn" title="Close">&times;</button>
				</div>
			</div>
			<div class="safevault-dropdown-empty">
				<div>${escapeHtml(message)}</div>
				<div class="safevault-dropdown-actions">
					<button class="safevault-action-btn safevault-dismiss-btn">Dismiss</button>
				</div>
			</div>
		`;
		dropdown.querySelector('.safevault-close-btn').addEventListener('click', closeDropdown);
		dropdown.querySelector('.safevault-dismiss-btn').addEventListener('click', closeDropdown);
		positionDropdown(badge, dropdown);
		getSafeVaultShadowRoot().appendChild(dropdown);
		activeDropdown = dropdown;
	}

	function showToastBanner(message) {
		const root = getSafeVaultShadowRoot();
		const existing = root.querySelector('.safevault-toast-banner');
		if (existing) existing.remove();

		const toast = document.createElement('div');
		toast.className = 'safevault-toast-banner';
		toast.style.pointerEvents = 'none';
		toast.innerHTML = `
			<span class="safevault-toast-icon">${SVG_ICONS.check}</span>
			<span class="safevault-toast-text">${escapeHtml(message)}</span>
		`;
		root.appendChild(toast);
		setTimeout(() => {
			toast.style.opacity = '0';
			toast.style.transform = 'translateY(6px)';
			toast.style.transition = 'all 0.18s ease';
			setTimeout(() => toast.remove(), 180);
		}, 1600);
	}

	// --------------------------------------------------------------------------
	// 5. Dropdown Controller & Action Dispatching
	// --------------------------------------------------------------------------

	function toggleDropdown(input, badge, formRoot, formType) {
		if (activeDropdown) {
			closeDropdown();
			return;
		}

		// 1. Payment Form Handler
		if (formType === 'payment') {
			chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "card_number" }, (response) => {
				if (!response || !response.success) {
					showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro app.");
					return;
				}
				// Strictly exclude identity documents (passports, national IDs) from payment pipeline
				const cardItems = (response.items || []).filter(i => i.type === 'card' && i.subtype !== 'passport' && i.subtype !== 'id_card' && i.subtype !== 'drivers_license');
				if (cardItems.length === 0) {
					showEmptyDropdown(badge, "No payment cards saved in SafeVaultPro.");
					return;
				}
				renderDropdownMenu(input, badge, formRoot, cardItems, 'payment');
			});
			return;
		}

		// 2. Identity Document Verification Handler (Strictly Isolated Schema - NO personal profiles)
		if (formType === 'identity_verification') {
			chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "identity_docs" }, (response) => {
				if (!response || !response.success) {
					showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro app.");
					return;
				}
				// Strictly ONLY id_card and passport card items; NEVER personal_info profiles
				const docItems = (response.items || []).filter(i => 
					i.type === 'card' && (i.subtype === 'id_card' || i.subtype === 'passport')
				);
				if (docItems.length === 0) {
					showEmptyDropdown(badge, "No national ID or passport documents in SafeVaultPro.");
					return;
				}
				renderDropdownMenu(input, badge, formRoot, docItems, 'identity_verification');
			});
			return;
		}

		// 3. Hybrid / Complex Registration Forms: Unified Trigger
		if (formType === 'register') {
			// Query both credentials and personal profiles
			chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain, type: "all" }, (response) => {
				const allItems = response?.items || [];
				let profileItems = allItems.filter(i => i.type === 'personal_info');
				if (profileItems.length === 0) {
					// Direct query fallback for personal profiles without domain filter
					chrome.runtime.sendMessage({ action: "QUERY_ITEMS", fieldType: "personal" }, (res2) => {
						profileItems = (res2?.items || []).filter(i => i.type === 'personal_info');
						renderRegistrationDropdownMenu(input, badge, formRoot, profileItems);
					});
					return;
				}
				renderRegistrationDropdownMenu(input, badge, formRoot, profileItems);
			});
			return;
		}

		// 4. Standard Profile Form
		if (formType === 'profile') {
			chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "personal" }, (response) => {
				if (!response || !response.success) {
					showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro app.");
					return;
				}
				const profileItems = (response.items || []).filter(i => i.type === 'personal_info');
				if (profileItems.length === 0) {
					showEmptyDropdown(badge, "No personal identity profiles saved.");
					return;
				}
				renderDropdownMenu(input, badge, formRoot, profileItems, 'profile');
			});
			return;
		}

		// 5. Login Authentication & Multi-Step Views
		chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "password", type: "password" }, (response) => {
			if (!response || !response.success) {
				showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro app.");
				return;
			}
			const matchedLogins = (response.items || []).filter(i => i.type === 'password');
			if (matchedLogins.length === 0) {
				showEmptyDropdown(badge, `No saved credentials for ${currentDomain}`);
				return;
			}
			renderDropdownMenu(input, badge, formRoot, matchedLogins, 'login');
		});
	}

	function renderDropdownMenu(input, badge, formRoot, items, contextType) {
		closeDropdown();
		const dropdown = document.createElement('div');
		dropdown.className = 'safevault-dropdown-menu';
		dropdown.style.pointerEvents = 'auto';

		let itemsHtml = '';
		items.forEach((item) => {
			if (item.type === 'password') {
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}" data-type="password">
						<div class="safevault-item-icon type-password">${SVG_ICONS.password}</div>
						<div class="safevault-item-details">
							<div class="safevault-item-title">${escapeHtml(item.title)}</div>
							<div class="safevault-item-sub">${escapeHtml(item.username || 'No username')}</div>
						</div>
						<span class="safevault-fill-btn">Autofill</span>
					</div>
				`;
			} else if (item.type === 'card' && item.subtype !== 'passport' && item.subtype !== 'id_card') {
				const cardNum = item.number ? `•••• ${item.number.slice(-4)}` : 'Card';
				const cardHolder = item.cardholderName ? escapeHtml(item.cardholderName) : '';
				const cvvCode = (item.cvv || item.pin) ? ` | CVV: •••` : '';
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}" data-type="card">
						<div class="safevault-item-icon type-card">${SVG_ICONS.card}</div>
						<div class="safevault-item-details">
							<div class="safevault-item-title">${escapeHtml(item.title)} ${cardHolder ? `(${cardHolder})` : ''}</div>
							<div class="safevault-item-sub">${escapeHtml(item.subtype ? item.subtype.toUpperCase().replace('_', ' ') : 'CARD')} ${cardNum}${cvvCode}</div>
						</div>
						<span class="safevault-fill-btn">Fill Card</span>
					</div>
				`;
			} else if (item.type === 'personal_info') {
				const sub = item.email || item.phone || item.city || 'Identity Profile';
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}" data-type="personal">
						<div class="safevault-item-icon type-personal">${SVG_ICONS.personal_info}</div>
						<div class="safevault-item-details">
							<div class="safevault-item-title">${escapeHtml(item.fullName || item.title)}</div>
							<div class="safevault-item-sub">${escapeHtml(sub)}</div>
						</div>
						<span class="safevault-fill-btn">Fill Form</span>
					</div>
				`;
			} else if (item.subtype === 'passport' || item.subtype === 'id_card') {
				// Dedicated Identity Document Schema Item
				const docType = item.subtype === 'passport' ? 'Passport' : 'National ID';
				const docId = item.number || item.nin || '';
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}" data-type="doc">
						<div class="safevault-item-icon type-personal">${SVG_ICONS.document}</div>
						<div class="safevault-item-details">
							<div class="safevault-item-title">${escapeHtml(item.title || docType)}</div>
							<div class="safevault-item-sub">${docType} ${docId ? `(${escapeHtml(docId)})` : ''}</div>
						</div>
						<span class="safevault-fill-btn">Fill ID</span>
					</div>
				`;
			}
		});

		dropdown.innerHTML = `
			<div class="safevault-dropdown-header">
				<span class="safevault-brand">SafeVaultPro</span>
				<div class="safevault-header-right">
					<span class="safevault-badge-count">${items.length} item${items.length === 1 ? '' : 's'}</span>
					<button class="safevault-close-btn" title="Close">&times;</button>
				</div>
			</div>
			<div class="safevault-dropdown-list">${itemsHtml}</div>
		`;

		dropdown.querySelector('.safevault-close-btn').addEventListener('click', closeDropdown);
		dropdown.addEventListener('click', (e) => {
			const itemElem = e.target.closest('.safevault-dropdown-item');
			if (!itemElem || !itemElem.dataset.id) return;
			const targetItem = items.find((i) => i.id === itemElem.dataset.id);
			if (targetItem) {
				if (contextType === 'identity_verification' || itemElem.dataset.type === 'doc') {
					fillIdentityDocument(formRoot, targetItem);
					showToastBanner('Identity document filled');
				} else if (contextType === 'payment') {
					fillPaymentCard(formRoot, targetItem);
					showToastBanner('Payment details filled');
				} else if (contextType === 'profile') {
					fillProfileForm(formRoot, input, targetItem);
					showToastBanner('Profile filled');
				} else {
					fillLoginCredentials(formRoot, input, targetItem);
					showToastBanner('Credentials filled');
				}
			}
			closeDropdown();
		});

		positionDropdown(badge, dropdown);
		getSafeVaultShadowRoot().appendChild(dropdown);
		activeDropdown = dropdown;
	}

	function renderRegistrationDropdownMenu(input, badge, formRoot, profileItems) {
		closeDropdown();
		const dropdown = document.createElement('div');
		dropdown.className = 'safevault-dropdown-menu';
		dropdown.style.pointerEvents = 'auto';

		let profileHtml = '';
		profileItems.forEach(p => {
			profileHtml += `
				<div class="safevault-dropdown-item" data-action="fill-profile" data-profile-id="${p.id}">
					<div class="safevault-item-icon type-personal">${SVG_ICONS.personal_info}</div>
					<div class="safevault-item-details">
						<div class="safevault-item-title">${escapeHtml(p.fullName || p.title)}</div>
						<div class="safevault-item-sub">Fill personal details (${escapeHtml(p.email || p.phone || '')})</div>
					</div>
					<span class="safevault-fill-btn">Fill</span>
				</div>
			`;
		});

		dropdown.innerHTML = `
			<div class="safevault-dropdown-header">
				<span class="safevault-brand">SafeVaultPro • Account Creation</span>
				<div class="safevault-header-right">
					<button class="safevault-close-btn" title="Close">&times;</button>
				</div>
			</div>
			<div class="safevault-dropdown-list">
				<div class="safevault-dropdown-item" data-action="generate-and-fill">
					<div class="safevault-item-icon type-generate">${SVG_ICONS.generate}</div>
					<div class="safevault-item-details">
						<div class="safevault-item-title" style="color:#34d399;">Generate Strong Password</div>
						<div class="safevault-item-sub">Fill both password & confirm fields</div>
					</div>
					<span class="safevault-fill-btn">Generate</span>
				</div>
				${profileItems.length > 0 ? profileHtml : ''}
			</div>
		`;

		dropdown.querySelector('.safevault-close-btn').addEventListener('click', closeDropdown);
		dropdown.addEventListener('click', (e) => {
			const itemElem = e.target.closest('.safevault-dropdown-item');
			if (!itemElem) return;

			if (itemElem.dataset.action === 'generate-and-fill') {
				closeDropdown();
				handleRegistrationPasswordGeneration(formRoot, profileItems[0] || null);
			} else if (itemElem.dataset.action === 'fill-profile') {
				const prof = profileItems.find(p => p.id === itemElem.dataset.profileId);
				if (prof) {
					fillProfileForm(formRoot, input, prof);
					showToastBanner('Identity profile populated');
				}
				closeDropdown();
			}
		});

		positionDropdown(badge, dropdown);
		getSafeVaultShadowRoot().appendChild(dropdown);
		activeDropdown = dropdown;
	}

	// --------------------------------------------------------------------------
	// 6. Autofill Action Implementations
	// --------------------------------------------------------------------------

	/**
	 * 1. Authentication & Multi-Step Login Autofill
	 */
	function fillLoginCredentials(formRoot, targetInput, item) {
		const searchRoot = (formRoot && formRoot.querySelectorAll('input:not([type="hidden"]), select').length >= 2) ? formRoot : document;
		const allInputs = Array.from(searchRoot.querySelectorAll('input:not([type="hidden"]), select')).filter(el => !shouldIgnoreField(el) && isElementVisible(el));
		const passInput = allInputs.find(i => i.type === 'password');
		const userInput = allInputs.find(i => classifyField(i) === 'login_username' || (i.type !== 'password' && (i.type === 'email' || i.type === 'text' || i.type === 'tel')));

		if (userInput && item.username) {
			setNativeFieldValue(userInput, item.username);
		}
		if (passInput && item.password) {
			setNativeFieldValue(passInput, item.password);
		}
		if (!userInput && !passInput && targetInput) {
			setNativeFieldValue(targetInput, item.username || item.password);
		}
	}

	/**
	 * 2. Registration: Password Generation & Priority Identity Queue
	 */
	function handleRegistrationPasswordGeneration(formRoot, defaultProfile) {
		chrome.runtime.sendMessage({ action: "GENERATE_PASSWORD", length: 20, uppercase: true, numbers: true, symbols: true }, (res) => {
			if (!res || !res.success || !res.password) return;
			const generatedPass = res.password;

			// Populate both password and confirm_password fields simultaneously
			const searchRoot = (formRoot && formRoot.querySelectorAll('input[type="password"]').length >= 1) ? formRoot : document;
			const passFields = Array.from(searchRoot.querySelectorAll('input[type="password"]')).filter(isElementVisible);
			passFields.forEach(pField => setNativeFieldValue(pField, generatedPass));

			// Identity Priority Queue: Active Primary Email -> Phone Number -> Full Name
			const userField = searchRoot.querySelector('input[type="email"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[id*="user" i], input[id*="email" i], input[id*="login" i], input[type="text"]');
			let identifierVal = '';
			if (defaultProfile) {
				identifierVal = defaultProfile.email || defaultProfile.phone || defaultProfile.fullName || '';
			}
			if (userField && !userField.value && identifierVal) {
				setNativeFieldValue(userField, identifierVal);
			}

			const finalUsername = (userField ? userField.value : '') || identifierVal;
			const title = `${currentDomain} Account`;

			chrome.runtime.sendMessage(
				{
					action: "SAVE_PASSWORD",
					id: formRoot?.dataset?.safevaultItemId,
					title,
					username: finalUsername,
					password: generatedPass,
					url: window.location.href,
					notes: `Generated on registration at ${currentDomain}.`,
				},
				(saveRes) => {
					if (saveRes?.success && saveRes?.item && formRoot?.dataset) {
						formRoot.dataset.safevaultItemId = saveRes.item.id;
					}
					showToastBanner(saveRes?.queued ? 'Password queued (vault locked)' : 'Password generated & saved');
				}
			);
		});
	}

	/**
	 * 3. Identity & Profile Autofill (Simultaneous Form-Root Level Population)
	 */
	function fillProfileForm(formRoot, targetInput, item) {
		const inputs = Array.from(formRoot.querySelectorAll('input:not([type="hidden"]), select')).filter(f => !shouldIgnoreField(f));

		// Contextual Partial Profiling: if form is just a standalone email or phone prompt
		const visibleInputs = inputs.filter(isElementVisible);
		if (visibleInputs.length === 1) {
			const single = visibleInputs[0];
			const cl = classifyField(single);
			if (cl === 'personal_phone' || single.type === 'tel') {
				if (item.phone) setNativeFieldValue(single, item.phone);
				return;
			}
			if (cl === 'personal_email' || single.type === 'email') {
				if (item.email) setNativeFieldValue(single, item.email);
				return;
			}
		}

		let first = item.firstName || '';
		let last = item.lastName || '';
		let full = item.fullName || '';
		let firstAr = item.firstNameArabic || '';
		let lastAr = item.lastNameArabic || '';
		let fullAr = item.fullNameArabic || '';

		if ((!first || !last) && full) {
			const parts = full.trim().split(/\s+/);
			if (parts.length >= 2) {
				if (!first) first = parts[0];
				if (!last) last = parts.slice(1).join(' ');
			} else if (!first) {
				first = full;
			}
		}
		if (!full && (first || last)) {
			full = `${first} ${last}`.trim();
		}

		if ((!firstAr || !lastAr) && fullAr) {
			const arParts = fullAr.trim().split(/\s+/);
			if (arParts.length >= 2) {
				if (!firstAr) firstAr = arParts[0];
				if (!lastAr) lastAr = arParts.slice(1).join(' ');
			} else if (!firstAr) {
				firstAr = fullAr;
			}
		}

		const parsedDob = parseBirthDate(item.birthDate);

		const isFieldLatinRequested = (f) => {
			if (!f) return false;
			const text = `${f.name || ''} ${f.id || ''} ${f.placeholder || ''} ${getFieldLabelText(f)}`.toLowerCase();
			return /\b(latin|latine|french|francais|français|english|en\s*latin|_fr|_en|_lat)\b/i.test(text) ||
				/(باللاتينية|باللاتينيه|لاتيني|لاتينيه|بالفرنسية|بالفرنسيه|بالانجليزية|بالانكليزية|بالأحرف[-_\s]?اللاتينية|بالاحرف[-_\s]?اللاتينية|بالحروف[-_\s]?اللاتينية|بالحروف[-_\s]?الفرنسية)/.test(text);
		};

		const isFieldContextArabic = (f) => {
			if (!f) return false;
			if (isFieldLatinRequested(f)) return false;
			if (f.dir === 'rtl' || (f.getAttribute && f.getAttribute('dir') === 'rtl')) return true;
			const text = `${f.name || ''} ${f.id || ''} ${f.placeholder || ''} ${getFieldLabelText(f)}`;
			return /[\u0600-\u06FF]/.test(text);
		};

		inputs.forEach((field) => {
			const classification = classifyField(field);

			// Explicit Arabic Names
			if (classification === 'personal_firstNameArabic') {
				const val = firstAr || first;
				if (val) setNativeFieldValue(field, val);
				return;
			}
			if (classification === 'personal_lastNameArabic') {
				const val = lastAr || last;
				if (val) setNativeFieldValue(field, val);
				return;
			}
			if (classification === 'personal_fullNameArabic') {
				const val = fullAr || full;
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// First Name (English / French, or Arabic if field context is Arabic)
			if (classification === 'personal_firstName') {
				const isAr = isFieldContextArabic(field);
				const val = isAr ? (firstAr || first) : (first || firstAr);
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// Last Name (English / French, or Arabic if field context is Arabic)
			if (classification === 'personal_lastName') {
				const isAr = isFieldContextArabic(field);
				const val = isAr ? (lastAr || last) : (last || lastAr);
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// Full Name (English / French, or Arabic if field context is Arabic)
			if (classification === 'personal_fullName') {
				const isAr = isFieldContextArabic(field);
				const val = isAr ? (fullAr || full) : (full || fullAr);
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// Birthday
			if (classification === 'personal_birthDate' && item.birthDate) {
				if (field.type === 'date' && parsedDob) {
					setNativeFieldValue(field, `${parsedDob.year}-${parsedDob.month}-${parsedDob.day}`);
				} else {
					setNativeFieldValue(field, item.birthDate);
				}
				return;
			}
			if (parsedDob) {
				if (classification === 'personal_birthDay') {
					if (field.tagName === 'SELECT') selectMatchingOption(field, [parsedDob.day, String(parseInt(parsedDob.day, 10))]);
					else setNativeFieldValue(field, parsedDob.day);
					return;
				}
				if (classification === 'personal_birthMonth') {
					const monthNum = parseInt(parsedDob.month, 10);
					const monthAliases = MONTH_NAMES[monthNum] || [parsedDob.month];
					if (field.tagName === 'SELECT') selectMatchingOption(field, monthAliases);
					else setNativeFieldValue(field, parsedDob.month);
					return;
				}
				if (classification === 'personal_birthYear') {
					if (field.tagName === 'SELECT') selectMatchingOption(field, [parsedDob.year, parsedDob.year.slice(-2)]);
					else setNativeFieldValue(field, parsedDob.year);
					return;
				}
			}

			// Gender
			if (classification === 'personal_gender' && item.gender) {
				const g = item.gender.toLowerCase().trim();
				const isMale = g.startsWith('m') || g.includes('homme') || g.includes('ذكر') || g === '1';
				const isFemale = g.startsWith('f') || g.includes('femme') || g.includes('أنثى') || g.includes('انثى') || g === '2';
				if (field.tagName === 'SELECT') {
					selectMatchingOption(field, isMale ? ['m', 'male', 'homme', 'ذكر', '1'] : isFemale ? ['f', 'female', 'femme', 'أنثى', '2'] : [g]);
				} else {
					setNativeFieldValue(field, item.gender);
				}
				return;
			}

			// Address & Contact
			if (classification === 'personal_address1' && item.addressLine1) setNativeFieldValue(field, item.addressLine1);
			else if (classification === 'personal_address2' && item.addressLine2) setNativeFieldValue(field, item.addressLine2);
			else if (classification === 'personal_city' && item.city) setNativeFieldValue(field, item.city);
			else if (classification === 'personal_state' && item.stateProvince) setNativeFieldValue(field, item.stateProvince);
			else if (classification === 'personal_zip' && item.postalCode) setNativeFieldValue(field, item.postalCode);
			else if (classification === 'personal_country' && item.country) setNativeFieldValue(field, item.country);
			else if (classification === 'personal_phone' && (item.phone || item.extraPhones?.[0]?.phone)) {
				setNativeFieldValue(field, item.phone || item.extraPhones[0].phone);
			} else if (classification === 'personal_email' || (field.type === 'email' && !field.value)) {
				const emailVal = item.email || item.extraEmails?.[0]?.email;
				if (emailVal) setNativeFieldValue(field, emailVal);
			} else if (classification === 'doc_nin' && (item.nin || item.nationalId)) {
				setNativeFieldValue(field, item.nin || item.nationalId);
			} else if (classification === 'doc_nationalId' && (item.nationalId || item.nin)) {
				setNativeFieldValue(field, item.nationalId || item.nin);
			} else if (classification === 'doc_passport' && item.passportNumber) {
				setNativeFieldValue(field, item.passportNumber);
			}
		});
	}

	/**
	 * 4. Payment Methods Autofill (Simultaneous Fill + Algerian Edahabia / CIB Optimizations)
	 */
	function fillPaymentCard(formRoot, item) {
		const inputs = Array.from(formRoot.querySelectorAll('input:not([type="hidden"]), select')).filter(f => !shouldIgnoreField(f));
		const cvvVal = item.cvv || item.pin || '';
		const holderVal = item.cardholderName || item.fullName || item.title || '';
		const numVal = (item.number || '').replace(/\s+/g, '');
		const parsedExp = parseCardExpiry(item.expirationDate);

		// 1. Card Number
		const cardNumInput = inputs.find(i => classifyField(i) === 'card_number') || inputs[0];
		if (cardNumInput && numVal) {
			setNativeFieldValue(cardNumInput, numVal);
		}

		// 2. CVV / CVC
		let cvvInput = inputs.find(i => i !== cardNumInput && classifyField(i) === 'card_cvv');
		if (!cvvInput) {
			cvvInput = inputs.find(i => {
				if (i === cardNumInput) return false;
				const attr = `${i.name || ''} ${i.id || ''} ${i.placeholder || ''} ${i.autocomplete || ''} ${i.getAttribute('aria-label') || ''} ${getFieldLabelText(i)}`.toLowerCase();
				return attr.includes('cvv') || attr.includes('cvc') || attr.includes('cvw') || attr.includes('csc') || attr.includes('security') || attr.includes('securite');
			});
		}
		if (cvvInput && cvvVal) {
			setNativeFieldValue(cvvInput, cvvVal);
		}

		// 3. Cardholder Name
		const holderInput = inputs.find(i => i !== cardNumInput && i !== cvvInput && classifyField(i) === 'card_holder');
		if (holderInput && holderVal) {
			setNativeFieldValue(holderInput, holderVal);
		}

		// 4. Expiration Date
		if (parsedExp) {
			const { month, fullYear, shortYear, monthNum, formatted } = parsedExp;

			// Single Expiration Date Input (Must be INPUT, never SELECT)
			const expInput = inputs.find(i => i.tagName === 'INPUT' && i !== cardNumInput && i !== cvvInput && i !== holderInput && classifyField(i) === 'card_exp');
			if (expInput) {
				setNativeFieldValue(expInput, formatted);
			}

			// Month Select or Input
			let monthInput = inputs.find(i => i !== cardNumInput && classifyField(i) === 'card_exp_month');
			if (!monthInput) {
				monthInput = inputs.find(i => i !== cardNumInput && i.tagName === 'SELECT' && isMonthSelect(i) && !isYearSelect(i));
			}
			if (monthInput) {
				if (monthInput.tagName === 'SELECT') {
					selectMatchingOption(monthInput, MONTH_NAMES[monthNum] || [month, String(monthNum)]);
				} else {
					setNativeFieldValue(monthInput, month);
				}
			}

			// Year Select or Input
			let yearInput = inputs.find(i => i !== cardNumInput && i !== monthInput && i !== expInput && classifyField(i) === 'card_exp_year');
			// Fallback 1: Any remaining SELECT with year options
			if (!yearInput) {
				yearInput = inputs.find(i => i !== cardNumInput && i !== monthInput && i !== expInput && i.tagName === 'SELECT' && isYearSelect(i));
			}
			// Fallback 2: Any remaining SELECT containing candidate years (e.g. 2026 or 26)
			if (!yearInput) {
				yearInput = inputs.find(i => i !== cardNumInput && i !== monthInput && i !== expInput && i.tagName === 'SELECT' &&
					Array.from(i.options).some(o => {
						const val = (o.value || '').trim();
						const txt = (o.text || '').trim();
						return val === fullYear || val === shortYear || txt === fullYear || txt === shortYear || txt.includes(fullYear);
					})
				);
			}
			// Fallback 3: Sibling select right next to month select in the same container
			if (!yearInput && monthInput && monthInput.tagName === 'SELECT') {
				const parent = monthInput.parentElement || monthInput.closest('div, td, tr, p, .form-group') || formRoot;
				const siblingSelects = Array.from(parent.querySelectorAll('select')).filter(s => s !== monthInput && !shouldIgnoreField(s));
				if (siblingSelects.length === 1) {
					yearInput = siblingSelects[0];
				}
			}

			if (yearInput) {
				if (yearInput.tagName === 'SELECT') {
					const yearCandidates = [
						fullYear,
						shortYear,
						String(parseInt(shortYear, 10)),
						String(parseInt(fullYear, 10))
					];
					selectMatchingOption(yearInput, yearCandidates);
				} else {
					setNativeFieldValue(yearInput, yearInput.maxLength === 2 ? shortYear : fullYear);
				}
			}
		}
	}

	/**
	 * 5. Identity Documents Autofill (Dedicated Isolated Handler: NIN & Passport)
	 */
	function fillIdentityDocument(formRoot, item) {
		const inputs = Array.from(formRoot.querySelectorAll('input:not([type="hidden"]), select')).filter(f => !shouldIgnoreField(f));
		const ninVal = item.nin || item.nationalId || (item.subtype === 'id_card' ? item.number : '');
		const passVal = item.subtype === 'passport' ? item.number : (item.passportNumber || '');

		inputs.forEach(input => {
			const cl = classifyField(input);
			if (cl === 'doc_nin' && ninVal) {
				setNativeFieldValue(input, ninVal);
			} else if (cl === 'doc_passport' && passVal) {
				setNativeFieldValue(input, passVal);
			} else if (cl === 'doc_nationalId' && (ninVal || item.nationalId)) {
				setNativeFieldValue(input, ninVal || item.nationalId);
			}
		});
	}

	// --------------------------------------------------------------------------
	// 7. Parsing Utilities (Birth Dates & Expiration Dates)
	// --------------------------------------------------------------------------

	function parseBirthDate(dateStr) {
		if (!dateStr) return null;
		const clean = String(dateStr).trim();
		let m = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
		if (m) return { year: m[1], month: m[2].padStart(2, '0'), day: m[3].padStart(2, '0') };

		m = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
		if (m) {
			const p1 = parseInt(m[1], 10);
			const p2 = parseInt(m[2], 10);
			if (p1 > 12) return { year: m[3], month: String(p2).padStart(2, '0'), day: String(p1).padStart(2, '0') };
			return { year: m[3], month: String(p2).padStart(2, '0'), day: String(p1).padStart(2, '0') };
		}
		return null;
	}

	function parseCardExpiry(expStr) {
		if (!expStr) return null;
		const clean = String(expStr).trim().replace(/\s+/g, '');

		let m = clean.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/);
		if (m) {
			const fullYear = m[1];
			const month = m[2].padStart(2, '0');
			return { month, fullYear, shortYear: fullYear.slice(-2), monthNum: parseInt(month, 10), formatted: `${month}/${fullYear.slice(-2)}` };
		}

		m = clean.match(/^(\d{1,2})[-/.](\d{2,4})$/);
		if (m) {
			const monthNum = parseInt(m[1], 10);
			const month = String(monthNum).padStart(2, '0');
			const y = m[2];
			const fullYear = y.length === 2 ? `20${y}` : y;
			const shortYear = fullYear.slice(-2);
			return { month, fullYear, shortYear, monthNum, formatted: `${month}/${shortYear}` };
		}

		m = clean.match(/^(\d{2})(\d{2})$/);
		if (m) {
			const monthNum = parseInt(m[1], 10);
			if (monthNum >= 1 && monthNum <= 12) {
				return { month: m[1], fullYear: `20${m[2]}`, shortYear: m[2], monthNum, formatted: `${m[1]}/${m[2]}` };
			}
		}

		return null;
	}

	function selectMatchingOption(selectElement, candidateValues) {
		if (!selectElement || selectElement.tagName !== 'SELECT') return false;
		const options = Array.from(selectElement.options);
		const candidates = (Array.isArray(candidateValues) ? candidateValues : [candidateValues]).flat().map(c => String(c).toLowerCase().trim()).filter(Boolean);

		let matched = options.find(opt => {
			const val = (opt.value || '').toLowerCase().trim();
			const txt = (opt.text || '').toLowerCase().trim();
			return candidates.some(c => val === c || txt === c);
		});

		if (!matched) {
			matched = options.find(opt => {
				const val = (opt.value || '').toLowerCase().trim();
				const txt = (opt.text || '').toLowerCase().trim();
				return candidates.some(c => (c.length >= 2 && (val.startsWith(c) || txt.startsWith(c))) || (c.length >= 3 && (val.includes(c) || txt.includes(c))));
			});
		}

		if (matched) {
			try {
				const proto = window.HTMLSelectElement.prototype;
				const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
				if (setter) {
					setter.call(selectElement, matched.value);
				} else {
					selectElement.value = matched.value;
				}
			} catch (_) {
				selectElement.value = matched.value;
			}
			selectElement.selectedIndex = matched.index;
			matched.selected = true;
			selectElement.dispatchEvent(new Event('change', { bubbles: true }));
			selectElement.dispatchEvent(new Event('input', { bubbles: true }));
			return true;
		}
		return false;
	}

	// --------------------------------------------------------------------------
	// 8. Vault Form Submission Interception
	// --------------------------------------------------------------------------

	function setupAutoSaveSubmitListener() {
		const triggerSaveFromForm = (form) => {
			if (!form) return;
			const passInputs = Array.from(form.querySelectorAll('input[type="password"]')).filter(isElementVisible);
			if (passInputs.length === 0) return;

			const primaryPass = passInputs[0];
			const userInput = form.querySelector('input[type="email"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[id*="user" i], input[id*="email" i], input[id*="login" i], input[type="text"]');
			const passVal = primaryPass.value;
			const userVal = userInput ? userInput.value : '';

			if (passVal && passVal.length >= 4) {
				const title = `${currentDomain} Account`;
				chrome.runtime.sendMessage(
					{
						action: "SAVE_PASSWORD",
						id: form.dataset?.safevaultItemId,
						title,
						username: userVal,
						password: passVal,
						url: window.location.href,
						notes: `Captured from form on ${currentDomain}.`,
					},
					(res) => {
						if (res?.success) {
							if (res.item && form.dataset) form.dataset.safevaultItemId = res.item.id;
							showToastBanner(res.queued ? 'Credentials queued (vault locked)' : 'Credentials saved to vault');
						}
					}
				);
			}
		};

		document.addEventListener('submit', (e) => {
			if (!e.isTrusted) return;
			if (e.target && e.target instanceof HTMLFormElement) {
				triggerSaveFromForm(e.target);
			}
		}, true);

		document.addEventListener('click', (e) => {
			if (!e.isTrusted) return;
			const target = e.target.closest('button, input[type="submit"], input[type="button"], .btn');
			if (!target) return;
			const btnText = (target.textContent || target.value || '').toLowerCase();
			const isSubmitAction = target.type === 'submit' || ['register', 'signup', 'sign-up', 'join', 'create', 'submit', "s'inscrire", 'إنشاء', 'login', 'connexion'].some(kw => btnText.includes(kw));
			if (isSubmitAction) {
				const form = target.form || target.closest('form') || getFormScope(target);
				setTimeout(() => triggerSaveFromForm(form), 120);
			}
		}, true);
	}

	// --------------------------------------------------------------------------
	// 9. Scan, Lifecycle & Observer Engine
	// --------------------------------------------------------------------------

	function scanAndAttach() {
		// 1. If on a dedicated registration flow or URL, enforce STRICTLY ONE UNIFIED BADGE for the page
		if (isRegistrationUrl()) {
			const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select')).filter(i => !shouldIgnoreField(i) && isElementVisible(i));
			if (allInputs.length > 0) {
				const rootScope = document.querySelector('form, [role="main"], main, article, .main-content') || document.body;
				const primaryInput = getPrimaryAnchorField(rootScope, 'register') || allInputs[0];
				if (primaryInput) {
					// Remove any other duplicate badges attached anywhere else on the document
					document.querySelectorAll('.safevault-input-badge').forEach(b => {
						if (b.parentElement !== primaryInput.parentElement) {
							b.remove();
						}
					});
					attachFormBadge(rootScope, primaryInput, 'register');
				}
				return;
			}
		}

		const forms = Array.from(document.querySelectorAll('form'));
		const standaloneInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select')).filter(i => !i.form && !shouldIgnoreField(i) && isElementVisible(i));

		// Process standard forms
		forms.forEach(form => {
			const formType = classifyForm(form);
			if (formType === 'disallowed') {
				// Clean up any stale badges
				if (formBadgeMap.has(form)) {
					formBadgeMap.get(form).badge.remove();
					formBadgeMap.delete(form);
				}
				return;
			}

			const primaryInput = getPrimaryAnchorField(form, formType);
			if (primaryInput) {
				attachFormBadge(form, primaryInput, formType);
			}
		});

		// Process standalone inputs (e.g. SPAs, multi-step views without standard <form> tag)
		if (standaloneInputs.length > 0) {
			const containerGroups = new Set();
			standaloneInputs.forEach(i => containerGroups.add(getFormScope(i)));
			containerGroups.forEach(scope => {
				if (scope.tagName === 'FORM') return; // Already handled above
				const formType = classifyForm(scope);
				if (formType !== 'disallowed') {
					const primaryInput = getPrimaryAnchorField(scope, formType);
					if (primaryInput) {
						attachFormBadge(scope, primaryInput, formType);
					}
				}
			});
		}
	}

	let scanDebounceTimer = null;
	const observer = new MutationObserver((mutations) => {
		let relevant = false;
		for (const m of mutations) {
			if (m.type === 'childList') {
				for (const node of m.addedNodes) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						if (node.tagName === 'INPUT' || node.tagName === 'SELECT' || node.tagName === 'FORM' || (node.querySelector && node.querySelector('input, select'))) {
							relevant = true;
							break;
						}
					}
				}
			} else if (m.type === 'attributes') {
				const tag = m.target?.tagName;
				if (tag === 'INPUT' || tag === 'SELECT' || tag === 'FORM') {
					relevant = true;
				}
			}
			if (relevant) break;
		}

		if (relevant) {
			if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
			scanDebounceTimer = setTimeout(scanAndAttach, 100);
		}
	});

	observer.observe(document.documentElement || document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['type', 'style', 'class', 'hidden'],
	});

	// Synchronize fixed badges on scroll & resize
	window.addEventListener('scroll', () => {
		document.querySelectorAll('.safevault-input-badge').forEach((badge) => {
			for (const input of document.querySelectorAll('input, select')) {
				if (attachedBadges.get(input) === badge && badge.style.position === 'fixed') {
					updateBadgeFixedPosition(input, badge);
					break;
				}
			}
		});
	}, { passive: true });

	window.addEventListener('resize', () => {
		document.querySelectorAll('.safevault-input-badge').forEach((badge) => {
			for (const input of document.querySelectorAll('input, select')) {
				if (attachedBadges.get(input) === badge && badge.style.position === 'fixed') {
					updateBadgeFixedPosition(input, badge);
					break;
				}
			}
		});
	}, { passive: true });

	document.addEventListener('focusin', (e) => {
		if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
			scanAndAttach();
		}
	});

	document.addEventListener('click', (e) => {
		if (activeDropdown) {
			const path = e.composedPath ? e.composedPath() : [];
			const inDropdown = path.some((el) => el.classList && el.classList.contains('safevault-dropdown-menu'));
			const inBadge = path.some((el) => el.classList && el.classList.contains('safevault-input-badge'));
			if (!inDropdown && !inBadge) {
				closeDropdown();
			}
		}
	}, true);

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && activeDropdown) {
			closeDropdown();
		}
	});

	setupAutoSaveSubmitListener();
	window.addEventListener('hashchange', () => {
		// Clean up existing badges on SPA route change
		document.querySelectorAll('.safevault-input-badge').forEach(b => b.remove());
		formBadgeMap.clear();
		attachedBadges = new WeakMap();
		closeDropdown();
		setTimeout(scanAndAttach, 150);
	});
	window.addEventListener('popstate', () => {
		document.querySelectorAll('.safevault-input-badge').forEach(b => b.remove());
		formBadgeMap.clear();
		attachedBadges = new WeakMap();
		closeDropdown();
		setTimeout(scanAndAttach, 150);
	});

	setTimeout(scanAndAttach, 300);
})();
