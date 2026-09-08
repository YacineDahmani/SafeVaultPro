/**
 * SafeVaultPro Smart Autofill Content Script
 * Highly accurate field detection, multi-step authentication (Google / Gmail, Microsoft, etc.),
 * comprehensive personal profile autofill (birthdays, gender, names, address, IDs),
 * credit card payment filling, and password generation.
 */
(function () {
	'use strict';

	let activeDropdown = null;
	let currentDomain = window.location.hostname;
	const attachedBadges = new WeakMap();

	const SVG_ICONS = {
		password: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
		totp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
		card: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
		personal_info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
		generate: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
		check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
	};

	// Helper to send native event triggers so React/Vue/Angular/Svelte state updates cleanly
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
			field.dispatchEvent(new Event('change', { bubbles: true }));
			field.dispatchEvent(new Event('blur', { bubbles: true }));
		} catch (e) {
			field.value = String(val);
		}
	}

	// Extract normalized text from label, aria, or parent context
	function getFieldLabelText(input) {
		let text = '';
		try {
			if (input.id) {
				const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
				if (label) text += label.textContent + ' ';
			}
			const parentLabel = input.closest('label');
			if (parentLabel) text += parentLabel.textContent + ' ';

			// Table Row / Cell inspection (Handles banking & payment tables)
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

			const container = input.closest('div, p, li, section');
			if (container) {
				const prev = container.previousElementSibling;
				if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'P')) {
					text += prev.textContent + ' ';
				}
			}
		} catch (e) {}
		return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
	}

	// Strict filter to completely ignore unrelated or non-interactive fields
	function shouldIgnoreField(input) {
		if (!input || !input.tagName) return true;
		const tag = input.tagName.toLowerCase();
		if (tag !== 'input' && tag !== 'select') return true;

		const type = (input.type || 'text').toLowerCase();
		const ignoredTypes = ['hidden', 'submit', 'button', 'reset', 'image', 'file', 'checkbox', 'radio', 'range', 'color'];
		if (ignoredTypes.includes(type)) return true;

		if (input.disabled || input.readOnly) return true;
		if (input.getAttribute('aria-hidden') === 'true') return true;

		// Dimension & Visibility Check
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
		const aria = (input.getAttribute('aria-label') || '').toLowerCase();
		const role = (input.getAttribute('role') || '').toLowerCase();
		const className = (input.className || '').toLowerCase();

		// Check for Search inputs (EXCEPT when on clear login forms or Gmail identifier)
		const isSearchType = type === 'search' || role === 'search' || role === 'searchbox';
		const searchNameRegex = /^(_?q|query|search|search_query|keyword|s|find|terms?)$/i;
		if (isSearchType || searchNameRegex.test(name) || searchNameRegex.test(id)) {
			// Don't ignore if it has login/username hints
			if (!name.includes('user') && !id.includes('user') && !id.includes('identifier') && !name.includes('email')) {
				return true;
			}
		}
		if ((placeholder.includes('search') || placeholder.includes('rechercher') || placeholder.includes('بحث')) && !name.includes('email') && !name.includes('user')) {
			return true;
		}

		// Bot Protection / Captcha
		const botKeywords = ['captcha', 'recaptcha', 'hcaptcha', 'cf-turnstile', 'turnstile', 'security-check', 'g-recaptcha-response', 'cf-challenge'];
		if (botKeywords.some(kw => name.includes(kw) || id.includes(kw) || className.includes(kw))) {
			return true;
		}

		// Quantity / Cart / Filter / Chat / Message / Coupon
		const ignorePatterns = [
			/\b(qty|quantity|amount|coupon|promo|discount|voucher|filter|page|pagination)\b/i,
			/\b(message|chat|comment|reply|feedback|review_text)\b/i,
		];
		const combined = `${name} ${id} ${className}`;
		if (ignorePatterns.some(p => p.test(combined))) {
			return true;
		}

		return false;
	}

	// Regex Helper for exact token matching
	function matchToken(text, regex) {
		return regex.test(text);
	}

	// Month select dropdown detector
	function isMonthSelect(el) {
		if (!el || el.tagName !== 'SELECT') return false;
		const options = Array.from(el.options);
		if (options.length < 12 || options.length > 15) return false;
		const norm = `${el.name || ''} ${el.id || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
		if (norm.includes('bday') || norm.includes('birth') || norm.includes('naissance') || norm.includes('dob')) return false;
		return options.some(o => {
			const v = (o.value || '').trim();
			const t = (o.text || '').trim().toLowerCase();
			return v === '01' || v === '1' || t === 'jan' || t === 'january' || t === 'janvier' || t === '01' || t === '1';
		}) && options.some(o => {
			const v = (o.value || '').trim();
			const t = (o.text || '').trim().toLowerCase();
			return v === '12' || t === 'dec' || t === 'december' || t === 'decembre' || t === '12';
		});
	}

	// Year select dropdown detector
	function isYearSelect(el) {
		if (!el || el.tagName !== 'SELECT') return false;
		const options = Array.from(el.options);
		if (options.length < 3 || options.length > 30) return false;
		const norm = `${el.name || ''} ${el.id || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
		if (norm.includes('bday') || norm.includes('birth') || norm.includes('naissance') || norm.includes('dob')) return false;
		const currentYear = new Date().getFullYear();
		const currentShort = currentYear % 100;
		return options.some(o => {
			const v = parseInt((o.value || '').trim(), 10);
			const t = parseInt((o.text || '').trim(), 10);
			return (v >= currentYear && v <= currentYear + 25) || (t >= currentYear && t <= currentYear + 25) ||
				(v >= currentShort && v <= currentShort + 25) || (t >= currentShort && t <= currentShort + 25);
		});
	}

	// Context Helper: Determine if field is inside a dedicated credit card payment container
	function isPaymentContext(input) {
		if (!input) return false;
		const ac = (input.autocomplete || '').toLowerCase();
		if (ac.startsWith('cc-')) return true;

		// Check the form if available, or entire document
		const root = (input.form && input.form.querySelectorAll('input, select').length >= 3) ? input.form : document;
		const inputs = Array.from(root.querySelectorAll('input:not([type="hidden"]), select'));
		return inputs.some(el => {
			const label = getFieldLabelText(el);
			const a = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''} ${el.autocomplete || ''} ${label}`.toLowerCase();
			return a.includes('cc-') ||
				a.includes('cvv') ||
				a.includes('cvc') ||
				a.includes('cvw') ||
				a.includes('carte') ||
				a.includes('credit card') ||
				a.includes('card number') ||
				a.includes('card_number') ||
				a.includes('cardnumber') ||
				a.includes('pan') ||
				a.includes('edahabia') ||
				a.includes('cib') ||
				a.includes('baridi') ||
				a.includes('satim') ||
				a.includes('expiration') ||
				a.includes('validite') ||
				a.includes('cvv2') ||
				a.includes('cvc2');
		});
	}

	// Robust Field Classification Engine
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

		// Replace underscores, dashes, dots, slashes with spaces so word boundary \b matches compound names (e.g. billing_first_name)
		const norm = raw.replace(/[-_./:]+/g, ' ');

		// 0. Select-specific immediate check for Month & Year dropdowns
		if (input.tagName === 'SELECT') {
			if (isMonthSelect(input)) return 'card_exp_month';
			if (isYearSelect(input)) return 'card_exp_year';
		}

		// 1. Google Accounts / Gmail Login Specific Detection
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

		// 2. 2FA / TOTP / Verification code
		if (
			autocomplete === 'one-time-code' ||
			matchToken(norm, /\b(totp|2fa|mfa|otp|one\s*time\s*code|verification\s*code|validation\s*code|security\s*token)\b/i) ||
			matchToken(raw, /(رمز[-_]?(التحقق|التأكيد|التفعيل|الأمان))/i)
		) {
			return 'totp';
		}

		// 3. Password Fields (Categorize between Login & New/Registration Password)
		if (type === 'password' || matchToken(norm, /\b(password|mot\s*de\s*passe|mdp|code\s*secret)\b/i) || matchToken(raw, /(كلمة[-_]?(السر|المرور)|الرمز[-_]?السري)/i)) {
			if (autocomplete === 'new-password' || matchToken(norm, /\b(new\s*pass(word)?|create\s*pass(word)?|signup\s*pass|confirm\s*pass(word)?|verify\s*pass)\b/i)) {
				return 'new_password';
			}
			return 'password';
		}

		// 4. Credit Card CVV / CVC
		if (
			autocomplete === 'cc-csc' ||
			matchToken(norm, /\b(cvv|cvc|cvw|cvp|cvv2|cvc2|cid|cvn|security\s*code|card\s*security|code\s*(securite|secu|verification)|cryptogramme|crypto)\b/i) ||
			matchToken(raw, /(رمز[-_]?(الأمان|الحماية|التحقق|الامان))/i)
		) {
			return 'card_cvv';
		}

		// 5. Credit Card Number (Algerian CIB, Edahabia, BaridiMob, SATIM, Visa, MC, Amex)
		if (
			autocomplete === 'cc-number' ||
			matchToken(norm, /\b(card\s*num(ber)?|cc\s*num(ber)?|credit\s*card|num\s*carte|numero\s*carte|n\s*carte|pan|carte\s*(cib|edahabia|bancaire)|edahabia|baridi|satim|cardno|card_no)\b/i) ||
			matchToken(raw, /(رقم[-_]?(البطاقة|الائتمان)|الذهبية|البطاقة)/i)
		) {
			return 'card_number';
		}

		// 6. Credit Card Expiry Month
		if (
			autocomplete === 'cc-exp-month' ||
			(matchToken(norm, /\b(exp\s*m(onth)?|cc\s*m(onth)?|card\s*exp\s*month|expiry\s*month|mois\s*exp|card\s*month)\b/i) && !matchToken(norm, /\b(dob|birth|bday|naissance)\b/i))
		) {
			return 'card_exp_month';
		}

		// 7. Credit Card Expiry Year
		if (
			autocomplete === 'cc-exp-year' ||
			(matchToken(norm, /\b(exp\s*y(ear)?|cc\s*y(ear)?|card\s*exp\s*year|expiry\s*year|annee\s*exp|card\s*year)\b/i) && !matchToken(norm, /\b(dob|birth|bday|naissance)\b/i))
		) {
			return 'card_exp_year';
		}

		// 8. Credit Card Expiry Date (Combined Date)
		if (
			autocomplete === 'cc-exp' ||
			(matchToken(norm, /\b(exp\s*(date)?|expiry|expiration|mm\s*yy|mm\s*yyyy|date\s*exp(iration)?|validite|valid\s*thru|validthru)\b/i) && !matchToken(norm, /\b(dob|birth|bday|naissance|month|mois|year|annee)\b/i)) ||
			matchToken(raw, /(تاريخ[-_]?(الانتهاء|إنتهاء|الصلاحية|انقضاء))/i)
		) {
			return 'card_exp';
		}

		// 9. Cardholder Name (Strictly distinct from personal profile names)
		const inPayment = isPaymentContext(input);
		if (
			autocomplete === 'cc-name' ||
			autocomplete === 'cc-given-name' ||
			autocomplete === 'cc-family-name' ||
			matchToken(norm, /\b(card\s*holder|cardholder|name\s*on\s*card|name\s*on\s*the\s*card|card\s*name|cc\s*name|titulaire|porteur|nom\s*porteur|nom\s*titulaire|nom\s*carte|nom\s*sur\s*carte|titulaire\s*carte|karteninhaber|titular|nombre\s*titular|nombre\s*tarjeta|card\s*owner|cardowner)\b/i) ||
			(inPayment && matchToken(norm, /\b(my\s*name|your\s*name|mon\s*nom|nom\s*prenom|nom\s*et\s*prenom|nom|name|owner|client\s*name|nom\s*client)\b/i) && !matchToken(norm, /\b(billing[-_]?address|shipping[-_]?address|street|city|zip|state|country|email|phone)\b/i)) ||
			matchToken(raw, /(اسم[-_]?(صاحب|حامل)[-_]?البطاقة|صاحب[-_]?البطاقة|حامل[-_]?البطاقة)/i) ||
			(inPayment && matchToken(raw, /(اسمي|الاسم[-_]?واللقب|اسم[-_]?الزبون|اسم[-_]?العميل)/i))
		) {
			return 'card_holder';
		}

		// If inside a payment form context, NEVER classify remaining fields as personal profile info
		if (inPayment) {
			return 'generic';
		}

		// 10a. Personal Info: Arabic Names (First, Last, Full)
		if (
			matchToken(norm, /\b(first\s*name\s*ar(abic)?|prenom\s*ar(abe)?|nom\s*arabe|arabic\s*first\s*name|fname\s*ar|prenom\s*en\s*arabe|ar\s*first\s*name|ar\s*fname)\b/i) ||
			matchToken(raw, /(الاسم[-_]?(الشخصي|الأول|الاول)?[-_]?(بالعربية|باللغة[-_]?العربية|عربي)|الاسم[-_]?(الشخصي|الأول|الاول))/i)
		) {
			return 'personal_firstNameArabic';
		}

		if (
			matchToken(norm, /\b(last\s*name\s*ar(abic)?|family\s*name\s*ar|nom\s*ar(abe)?|arabic\s*last\s*name|lname\s*ar|nom\s*de\s*famille\s*ar|nom\s*en\s*arabe|ar\s*last\s*name|ar\s*lname)\b/i) ||
			matchToken(raw, /(اللقب[-_]?(العائلي|بالعربية|عربي)|اسم[-_]?العائلة[-_]?بالعربية|اللقب)/i)
		) {
			return 'personal_lastNameArabic';
		}

		if (
			matchToken(norm, /\b(full\s*name\s*ar(abic)?|nom\s*prenom\s*ar|arabic\s*full\s*name|ar\s*full\s*name)\b/i) ||
			matchToken(raw, /(الاسم[-_]?الكامل[-_]?بالعربية|الاسم[-_]?واللقب[-_]?بالعربية|الاسم[-_]?الكامل)/i)
		) {
			return 'personal_fullNameArabic';
		}

		// 10. Personal Info: First Name
		if (
			autocomplete === 'given-name' ||
			(matchToken(norm, /\b(first\s*name|given\s*name|forename|fname|prenom)\b/i) && !matchToken(norm, /\b(card|holder|titulaire|porteur|cc)\b/i)) ||
			matchToken(raw, /(الاسم)/i)
		) {
			return 'personal_firstName';
		}

		// 11. Personal Info: Last Name
		if (
			autocomplete === 'family-name' ||
			(matchToken(norm, /\b(last\s*name|family\s*name|surname|lname|nom\s*de\s*famille)\b/i) && !matchToken(norm, /\b(card|holder|titulaire|porteur|cc)\b/i)) ||
			(matchToken(norm, /\bnom\b/i) && !matchToken(norm, /\b(prenom|full|user|card|holder|titulaire|porteur|cc)\b/i))
		) {
			return 'personal_lastName';
		}

		// 12. Personal Info: Full Name
		if (
			autocomplete === 'name' ||
			(matchToken(norm, /\b(full\s*name|your\s*name|nom\s*prenom|nom\s*et\s*prenom|billing\s*name|shipping\s*name|contact\s*name|recipient\s*name)\b/i) && !matchToken(norm, /\b(card|holder|titulaire|porteur|cc)\b/i))
		) {
			return 'personal_fullName';
		}

		// 13. Personal Info: Birth Date (Universal / Specific)
		if (
			type === 'date' ||
			autocomplete === 'bday' ||
			matchToken(norm, /\b(birth\s*date|dob|date\s*of\s*birth|date\s*naissance|bday)\b/i) ||
			matchToken(raw, /(تاريخ[-_]?(الميلاد|الولادة))/i)
		) {
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

		// 14. Personal Info: Gender
		if (
			autocomplete === 'sex' ||
			matchToken(norm, /\b(gender|sex|sexe)\b/i) ||
			matchToken(raw, /(الجنس|النوع)/i)
		) {
			return 'personal_gender';
		}

		// 15. Personal Info: Age
		if (
			matchToken(norm, /\b(age|âge)\b/i) ||
			matchToken(raw, /(العمر|السن)/i)
		) {
			return 'personal_age';
		}

		// 16a. Personal Info: 18-Digit NIN (National Identification Number)
		if (
			matchToken(norm, /\b(nin|national\s*identification\s*num(ber)?|numero\s*d?\s*identification\s*nationale|num\s*identite\s*nationale|identifiant\s*national|matricule\s*national|nin\s*num(ber)?)\b/i) ||
			matchToken(raw, /(رقم[-_]?(التعريف[-_]?الوطني|الهوية[-_]?الوطنية)|الرقم[-_]?الوطني[-_]?(التعريفي|البيومتري)?)/i)
		) {
			return 'personal_nin';
		}

		// 16b. General National ID / Passport
		if (
			matchToken(norm, /\b(national\s*id|ssn|social\s*security|passport|passeport|carte\s*identite|n\s*national|cin|cni|identity\s*card)\b/i) ||
			matchToken(raw, /(رقم[-_]?(التعريف|الهوية|الوطني)|بطاقة[-_]?التعريف|جواز[-_]?السفر)/i)
		) {
			return 'personal_nationalId';
		}

		// 17. Personal Info: Address
		if (
			autocomplete === 'address-line2' ||
			matchToken(norm, /\b(address\s*line2|address\s*line\s*2|address2|address\s*2|apt|suite|complement\s*adresse|batiment|etage)\b/i) ||
			matchToken(raw, /(شقة|عمارة|رقم[-_]?الشقة)/i)
		) {
			return 'personal_address2';
		}
		if (
			autocomplete === 'address-line1' ||
			autocomplete === 'street-address' ||
			matchToken(norm, /\b(address\s*line1|address\s*line\s*1|address1|address\s*1|street\s*address|street|adresse|rue)\b/i) ||
			matchToken(raw, /(العنوان|الشارع|عنوان[-_]?الاقامة)/i)
		) {
			return 'personal_address1';
		}

		// 18. Personal Info: City & State/Wilaya & Postal Code & Country
		if (
			autocomplete === 'address-level2' ||
			matchToken(norm, /\b(city|ville|town|commune|municipality)\b/i) ||
			matchToken(raw, /(المدينة|البلدية)/i)
		) {
			return 'personal_city';
		}
		if (
			autocomplete === 'address-level1' ||
			matchToken(norm, /\b(state|province|wilaya|region|departement|county)\b/i) ||
			matchToken(raw, /(الولاية|المحافظة|الاقليم|المنطقة)/i)
		) {
			return 'personal_state';
		}
		if (
			autocomplete === 'postal-code' ||
			matchToken(norm, /\b(zip|zip\s*code|postal\s*code|postcode|code\s*postal)\b/i) ||
			matchToken(raw, /(الرمز[-_]?البريدي)/i)
		) {
			return 'personal_zip';
		}
		if (
			autocomplete === 'country' ||
			autocomplete === 'country-name' ||
			matchToken(norm, /\b(country|pays|nation)\b/i) ||
			matchToken(raw, /(الدولة|البلد)/i)
		) {
			return 'personal_country';
		}

		// Check if this input is within a Login context (has password or login URL)
		const isLogin = isLoginForm(input);
		if (isLogin) {
			if (
				type === 'email' ||
				type === 'tel' ||
				autocomplete === 'username' ||
				autocomplete === 'email' ||
				matchToken(norm, /\b(username|user\s*name|login|email|e\s*mail|mail|phone|telephone|mobile|identifiant|account|identifier|auth\s*user|session|ident)\b/i) ||
				matchToken(raw, /(اسم[-_]?المستخدم|المعرف|البريد|الهاتف)/i)
			) {
				return 'login_username';
			}
		}

		// 19. Contact: Phone (Only when not in a login context)
		if (
			type === 'tel' ||
			autocomplete.includes('tel') ||
			matchToken(norm, /\b(phone|telephone|mobile|cell|cellphone|num\s*tel)\b/i) ||
			matchToken(raw, /(الهاتف|المحمول|الجوال|رقم[-_]?الهاتف)/i)
		) {
			return 'personal_phone';
		}

		// 20. Contact: Email / Username / Login
		if (
			type === 'email' ||
			autocomplete === 'email' ||
			matchToken(norm, /\b(email|e\s*mail|mail|courriel|adresse\s*email)\b/i) ||
			matchToken(raw, /(البريد[-_]?(الإلكتروني|الالكتروني|البريد)?)/i)
		) {
			if (isRegistrationForm(input)) {
				return 'personal_email';
			}
			return 'login_username';
		}

		if (
			autocomplete === 'username' ||
			matchToken(norm, /\b(username|user\s*name|login|identifiant|num\s*ccp|rip|user\s*id|auth\s*user)\b/i) ||
			matchToken(raw, /(اسم[-_]?المستخدم|المعرف|رقم[-_]?الحساب)/i)
		) {
			return 'login_username';
		}

		return 'generic';
	}

	// Determine if field belongs to a Login context
	function isLoginForm(input) {
		if (!input) return false;
		if (isRegistrationForm(input)) return false;
		const form = input.form || input.closest('form, [class*="login" i], [class*="signin" i], [id*="login" i], [id*="signin" i], main') || document;
		const hasPassword = form.querySelector('input[type="password"]') !== null;
		if (hasPassword) return true;

		const autocomplete = (input.autocomplete || '').toLowerCase();
		if (autocomplete === 'username' || autocomplete === 'current-password') return true;

		const pageUrl = window.location.href.toLowerCase();
		const pageTitle = document.title.toLowerCase();
		const isLoginSite = ['login', 'signin', 'sign-in', 'log-in', 'connexion', 'auth', 'sessions/new', 'identifier', 'accounts.google.com', 'login.live.com', 'login.microsoftonline.com', 'تسجيل الدخول'].some(
			kw => pageUrl.includes(kw) || pageTitle.includes(kw)
		);
		return isLoginSite;
	}

	// Determine if field belongs to a Registration / Signup context
	function isRegistrationForm(input) {
		if (!input) return false;
		const form = input.form || input.closest('form');
		const autocomplete = (input.autocomplete || '').toLowerCase();
		const attr = `${input.name || ''} ${input.id || ''} ${input.placeholder || ''}`.toLowerCase();

		// Explicit login check
		if (autocomplete === 'current-password' || attr.includes('current-password') || attr.includes('login_password')) {
			return false;
		}

		// Explicit signup checks
		if (autocomplete === 'new-password' || attr.includes('new-password') || attr.includes('create_password') || attr.includes('signup')) {
			return true;
		}

		const pageUrl = window.location.href.toLowerCase();
		const pageTitle = document.title.toLowerCase();
		const formHtml = form ? (form.action + ' ' + (form.id || '') + ' ' + (form.name || '') + ' ' + (form.className || '')).toLowerCase() : '';
		const submitBtn = form ? form.querySelector('button[type="submit"], input[type="submit"], button') : null;
		const submitText = submitBtn ? (submitBtn.textContent || submitBtn.value || '').toLowerCase() : '';

		const isRegister = ['register', 'signup', 'sign-up', 'create account', 'create-account', "s'inscrire", 'creer compte', 'إنشاء حساب', 'تسجيل حساب'].some(
			kw => pageUrl.includes(kw) || pageTitle.includes(kw) || formHtml.includes(kw) || submitText.includes(kw)
		);
		const isLogin = ['login', 'log in', 'log-in', 'sign in', 'signin', 'connexion', 'تسجيل الدخول'].some(
			kw => pageUrl.includes(kw) || pageTitle.includes(kw) || formHtml.includes(kw) || submitText.includes(kw)
		);

		if (isRegister && !isLogin) return true;
		if (form && form.querySelectorAll('input[type="password"]').length >= 2) return true;

		return false;
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

	function getProfileScope(input) {
		if (input && input.form) return input.form;
		return (input && input.closest && input.closest('form, fieldset, [role="form"], [class*="form"], [id*="form"], [class*="modal"], [id*="modal"], section, main')) || document;
	}

	function getPrimaryProfileField(input) {
		const scope = getProfileScope(input);
		const allElements = Array.from(scope.querySelectorAll('input:not([type="hidden"]), select'));
		const profileFields = allElements.filter(el => {
			if (shouldIgnoreField(el)) return false;
			if (!isElementVisible(el)) return false;
			const cl = classifyField(el);
			return cl.startsWith('personal_');
		});
		if (profileFields.length === 0) return null;

		// Preferred order if present: Latin/Arabic first name or full name, else the very first visible profile field
		const preferred = profileFields.find(f => {
			const c = classifyField(f);
			return c === 'personal_firstName' || c === 'personal_fullName' || c === 'personal_firstNameArabic' || c === 'personal_fullNameArabic';
		});

		return preferred || profileFields[0];
	}

	// Bulletproof Badge Injection and Positioning
	function attachBadge(input) {
		if (attachedBadges.has(input)) return;

		const classification = classifyField(input);
		// In payment contexts, only attach a badge to the card number field — one badge is enough
		if (isPaymentContext(input) && classification !== 'card_number') {
			return;
		}
		// Do not attach badges to secondary card fields (CVV, Expiry, Month, Year, Holder) -> Only to Card Number
		if (classification === 'card_cvv' || classification === 'card_exp' || classification === 'card_exp_month' || classification === 'card_exp_year' || classification === 'card_holder') {
			return;
		}
		// For personal profile fields, ONLY attach a single badge to the primary field in the form/container
		if (classification.startsWith('personal_')) {
			const primaryField = getPrimaryProfileField(input);
			if (primaryField !== input) {
				return;
			}
		}
		if (classification === 'generic') {
			return;
		}

		const badge = document.createElement('div');
		badge.className = 'safevault-input-badge';
		badge.title = classification.startsWith('personal_') ? 'Autofill Form' : 'Autofill';
		const badgeLogoUrl = chrome.runtime.getURL('icon-32.png');
		badge.innerHTML = `<img src="${badgeLogoUrl}" width="26" height="26" alt="SafeVault" style="pointer-events:none;object-fit:contain;display:block;" />`;

		const rightOffset = calculateBadgeRightOffset(input);
		badge.style.right = `${rightOffset}px`;

		// Check if parent container clips overflow (e.g. Google Material inputs)
		let container = input.parentElement;
		let parentStyle = container ? window.getComputedStyle(container) : null;
		const isClipped = parentStyle && (parentStyle.overflow === 'hidden' || parentStyle.overflowX === 'hidden' || parentStyle.overflowY === 'hidden');

		// If clipped, we position fixed/absolute attached to viewport or body overlay anchor
		if (isClipped || !container) {
			badge.style.position = 'fixed';
			updateBadgeFixedPosition(input, badge);
			document.body.appendChild(badge);
		} else {
			if (parentStyle.position === 'static') {
				container.style.position = 'relative';
			}
			container.appendChild(badge);
		}

		attachedBadges.set(input, badge);

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
				toggleDropdown(input, badge);
			}
		}

		badge.addEventListener('pointerdown', onPointerDown);
	}

	// Calculate smart right offset to avoid covering password eye / reveal toggle buttons
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

	// Dropdown Controller: Dispatches correct view based on field classification
	function toggleDropdown(input, badge) {
		if (activeDropdown) {
			closeDropdown();
			return;
		}

		const classification = classifyField(input);
		const isRegister = isRegistrationForm(input);

		// 1. Credit Card Number Field or Payment Context
		if (classification === 'card_number' || classification === 'card_holder' || classification === 'card_exp' || classification === 'card_exp_month' || classification === 'card_exp_year' || classification === 'card_cvv' || isPaymentContext(input)) {
			chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "card_number" }, (response) => {
				if (!response || !response.success) {
					showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro app.", true);
					return;
				}
				const cardItems = (response.items || []).filter(i => i.type === 'card');
				if (cardItems.length === 0) {
					showEmptyDropdown(badge, "No payment cards saved in SafeVaultPro.", false);
					return;
				}
				renderGenericDropdownMenu(input, badge, cardItems);
			});
			return;
		}

		// 2. 2FA / TOTP Field
		if (classification === 'totp') {
			chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "totp" }, (response) => {
				if (!response || !response.success) {
					showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro app.", true);
					return;
				}
				const totpItems = (response.items || []).filter(i => i.type === 'totp');
				if (totpItems.length === 0) {
					showEmptyDropdown(badge, "No 2FA items saved in SafeVaultPro.", false);
					return;
				}
				renderGenericDropdownMenu(input, badge, totpItems);
			});
			return;
		}

		// 3. Personal Info / Identity Profile Fields
		if (classification.startsWith('personal_')) {
			chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "personal" }, (response) => {
				if (!response || !response.success) {
					showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro app.", true);
					return;
				}
				const personalItems = (response.items || []).filter(i => i.type === 'personal_info');
				if (personalItems.length === 0) {
					showEmptyDropdown(badge, "No personal identity profiles saved in SafeVaultPro.", false);
					return;
				}
				renderGenericDropdownMenu(input, badge, personalItems);
			});
			return;
		}

		// 4. Registration Password Field (Generate Strong Password)
		if (classification === 'new_password' || (isRegister && classification === 'password')) {
			renderRegisterPasswordDropdown(input, badge);
			return;
		}

		// 5. Standard Login & Domain-Matched Credentials (e.g. Gmail / Google Accounts / Microsoft / Web logins)
		chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "password", type: "password" }, (response) => {
			if (!response || !response.success) {
				showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro app.", true);
				return;
			}
			const matchedLogins = (response.items || []).filter(i => i.type === 'password');
			if (matchedLogins.length === 0) {
				showEmptyDropdown(badge, `No saved credentials for ${currentDomain}`, false);
				return;
			}
			renderGenericDropdownMenu(input, badge, matchedLogins);
		});
	}

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

	function showEmptyDropdown(badge, message, isError) {
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

	function renderGenericDropdownMenu(input, badge, items) {
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
			} else if (item.type === 'totp') {
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}" data-type="totp">
						<div class="safevault-item-icon type-totp">${SVG_ICONS.totp}</div>
						<div class="safevault-item-details">
							<div class="safevault-item-title">${escapeHtml(item.title || item.issuer)}</div>
							<div class="safevault-item-sub">2FA Code (${escapeHtml(item.accountName || '')})</div>
						</div>
						<span class="safevault-fill-btn">Insert 2FA</span>
					</div>
				`;
			} else if (item.type === 'card') {
				const cardNum = item.number ? `•••• ${item.number.slice(-4)}` : 'Card';
				const cardHolder = item.cardholderName ? escapeHtml(item.cardholderName) : '';
				// Security: Never render plaintext CVV/PIN into the DOM tree
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
				autofillItem(input, targetItem);
				if (targetItem.type === 'card') showToastBanner('Card filled');
				else if (targetItem.type === 'personal_info') showToastBanner('Profile & form filled');
				else if (targetItem.type === 'totp') showToastBanner('2FA code inserted');
				else showToastBanner('Credentials filled');
			}
			closeDropdown();
		});

		positionDropdown(badge, dropdown);
		getSafeVaultShadowRoot().appendChild(dropdown);
		activeDropdown = dropdown;
	}

	function renderRegisterPasswordDropdown(input, badge) {
		closeDropdown();
		const dropdown = document.createElement('div');
		dropdown.className = 'safevault-dropdown-menu';
		dropdown.innerHTML = `
			<div class="safevault-dropdown-header">
				<span class="safevault-brand">SafeVaultPro • New Password</span>
				<div class="safevault-header-right">
					<button class="safevault-close-btn" title="Close">&times;</button>
				</div>
			</div>
			<div class="safevault-dropdown-list">
				<div class="safevault-dropdown-item" data-action="generate">
					<div class="safevault-item-icon type-generate">${SVG_ICONS.generate}</div>
					<div class="safevault-item-details">
						<div class="safevault-item-title" style="color:#34d399;">Generate Strong Password</div>
						<div class="safevault-item-sub">Create & fill secure 20-char password</div>
					</div>
					<span class="safevault-fill-btn">Generate</span>
				</div>
			</div>
		`;
		dropdown.querySelector('.safevault-close-btn').addEventListener('click', closeDropdown);
		dropdown.addEventListener('click', (e) => {
			const itemElem = e.target.closest('.safevault-dropdown-item');
			if (!itemElem) return;
			if (itemElem.dataset.action === 'generate') {
				closeDropdown();
				chrome.runtime.sendMessage({ action: "GENERATE_PASSWORD", length: 20, uppercase: true, numbers: true, symbols: true }, (res) => {
					if (res && res.success && res.password) {
						const generatedPass = res.password;
						setNativeFieldValue(input, generatedPass);

						let form = input.form || input.closest('form');
						if (!form) {
							let parent = input.parentElement;
							while (parent && parent !== document.body) {
								if (parent.querySelectorAll('input[type="password"]').length > 0) {
									form = parent;
									break;
								}
								parent = parent.parentElement;
							}
						}
						if (form) {
							const passFields = Array.from(form.querySelectorAll('input[type="password"]'));
							passFields.forEach(pField => setNativeFieldValue(pField, generatedPass));
						}

						const userField = form
							? form.querySelector('input[type="email"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[id*="user" i], input[id*="email" i], input[id*="login" i], input[type="text"]')
							: null;
						const usernameVal = userField ? userField.value : '';
						const title = `${currentDomain} Account`;

						chrome.runtime.sendMessage(
							{
								action: "SAVE_PASSWORD",
								id: form?.dataset?.safevaultItemId,
								title,
								username: usernameVal,
								password: generatedPass,
								url: window.location.href,
								notes: `Generated & saved on ${currentDomain}.`,
							},
							(saveRes) => {
								if (saveRes && saveRes.success && saveRes.item && form && form.dataset) {
									form.dataset.safevaultItemId = saveRes.item.id;
								}
								if (saveRes && saveRes.queued) {
									showToastBanner('Password queued (vault locked)');
								} else {
									showToastBanner('Password saved');
								}
							}
						);
					}
				});
			}
		});

		positionDropdown(badge, dropdown);
		getSafeVaultShadowRoot().appendChild(dropdown);
		activeDropdown = dropdown;
	}

	function positionDropdown(badge, dropdown) {
		const rect = badge.getBoundingClientRect();
		dropdown.style.position = 'fixed';
		dropdown.style.top = `${Math.min(window.innerHeight - 260, rect.bottom + 4)}px`;
		dropdown.style.left = `${Math.max(10, Math.min(window.innerWidth - 270, rect.left - 160))}px`;
		dropdown.style.zIndex = '999999';
	}

	// Universal Date Parser (Supports YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY)
	function parseBirthDate(dateStr) {
		if (!dateStr) return null;
		const clean = String(dateStr).trim();

		// Check ISO YYYY-MM-DD
		let m = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
		if (m) {
			return { year: m[1], month: m[2].padStart(2, '0'), day: m[3].padStart(2, '0') };
		}

		// Check DD/MM/YYYY or MM/DD/YYYY
		m = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
		if (m) {
			const p1 = parseInt(m[1], 10);
			const p2 = parseInt(m[2], 10);
			if (p1 > 12) {
				// p1 is day, p2 is month (DD/MM/YYYY)
				return { year: m[3], month: String(p2).padStart(2, '0'), day: String(p1).padStart(2, '0') };
			}
			if (p2 > 12) {
				// p1 is month, p2 is day (MM/DD/YYYY)
				return { year: m[3], month: String(p1).padStart(2, '0'), day: String(p2).padStart(2, '0') };
			}
			// Default to DD/MM/YYYY
			return { year: m[3], month: String(p2).padStart(2, '0'), day: String(p1).padStart(2, '0') };
		}

		return null;
	}

	// Multilingual Month Names Table for Smart Select Options
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
		12: ['dec', 'december', 'decembre', 'décembre', 'ديسمبر', '12'],
	};

	// High-Accuracy Autofill Engine for Personal Information Profiles
	function fillPersonalInfo(targetInput, item) {
		const form = targetInput.form || targetInput.closest('form') || document.body;
		const allInputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select'));
		// Filter out fields that are inside a payment context to prevent personal data leaking into cardholder / card fields
		const inputs = allInputs.filter(field => {
			const cl = classifyField(field);
			if (cl === 'card_number' || cl === 'card_cvv' || cl === 'card_exp' || cl === 'card_exp_month' || cl === 'card_exp_year' || cl === 'card_holder') return false;
			// Also skip any text input inside a payment form that looks like a cardholder name
			if (isPaymentContext(field)) {
				const attr = `${field.name || ''} ${field.id || ''} ${field.placeholder || ''} ${field.autocomplete || ''}`.toLowerCase();
				if (attr.includes('cc-') || attr.includes('card') || attr.includes('holder') || attr.includes('titulaire') || attr.includes('porteur')) return false;
			}
			return true;
		});

		// 1. First & Last Names vs Full Name Decomposition
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
		if (!fullAr && (firstAr || lastAr)) {
			fullAr = `${firstAr} ${lastAr}`.trim();
		}

		// Helper to detect if a field context is in Arabic
		const isFieldContextArabic = (f) => {
			if (!f) return false;
			if (f.dir === 'rtl' || (f.getAttribute && f.getAttribute('dir') === 'rtl')) return true;
			const text = `${f.name || ''} ${f.id || ''} ${f.placeholder || ''} ${getFieldLabelText(f)}`;
			return /[\u0600-\u06FF]/.test(text);
		};

		// 2. Birthday Parsing
		const parsedDob = parseBirthDate(item.birthDate);

		inputs.forEach((field) => {
			const classification = classifyField(field);

			// Arabic First Name
			if (classification === 'personal_firstNameArabic') {
				const val = firstAr || first;
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// Arabic Last Name
			if (classification === 'personal_lastNameArabic') {
				const val = lastAr || last;
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// Arabic Full Name
			if (classification === 'personal_fullNameArabic') {
				const val = fullAr || full;
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// First Name (check if field is in Arabic context)
			if (classification === 'personal_firstName') {
				const isAr = isFieldContextArabic(field);
				const val = isAr ? (firstAr || first) : (first || firstAr);
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// Last Name (check if field is in Arabic context)
			if (classification === 'personal_lastName') {
				const isAr = isFieldContextArabic(field);
				const val = isAr ? (lastAr || last) : (last || lastAr);
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// Full Name (check if field is in Arabic context)
			if (classification === 'personal_fullName') {
				const isAr = isFieldContextArabic(field);
				const val = isAr ? (fullAr || full) : (full || fullAr);
				if (val) setNativeFieldValue(field, val);
				return;
			}

			// Birthday: Single input vs Split Day/Month/Year
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
					if (field.tagName === 'SELECT') {
						selectMatchingOption(field, [parsedDob.day, String(parseInt(parsedDob.day, 10))]);
					} else {
						setNativeFieldValue(field, parsedDob.day);
					}
					return;
				}

				if (classification === 'personal_birthMonth') {
					const monthNum = parseInt(parsedDob.month, 10);
					const monthAliases = MONTH_NAMES[monthNum] || [parsedDob.month];
					if (field.tagName === 'SELECT') {
						selectMatchingOption(field, monthAliases);
					} else {
						setNativeFieldValue(field, parsedDob.month);
					}
					return;
				}

				if (classification === 'personal_birthYear') {
					if (field.tagName === 'SELECT') {
						selectMatchingOption(field, [parsedDob.year, parsedDob.year.slice(-2)]);
					} else {
						setNativeFieldValue(field, parsedDob.year);
					}
					return;
				}
			}

			// Gender Handling (Select dropdown, radio buttons, or text input)
			if (classification === 'personal_gender' && item.gender) {
				const g = item.gender.toLowerCase().trim();
				const isMale = g.startsWith('m') || g.includes('homme') || g.includes('ذكر') || g === '1';
				const isFemale = g.startsWith('f') || g.includes('femme') || g.includes('أنثى') || g.includes('انثى') || g === '2';

				if (field.tagName === 'SELECT') {
					const maleKeywords = ['m', 'male', 'homme', 'ذكر', '1', 'man'];
					const femaleKeywords = ['f', 'female', 'femme', 'أنثى', 'انثى', '2', 'woman'];
					selectMatchingOption(field, isMale ? maleKeywords : isFemale ? femaleKeywords : [g]);
				} else {
					setNativeFieldValue(field, item.gender);
				}
				return;
			}

			// Age
			if (classification === 'personal_age' && (item.age || item.birthDate)) {
				const ageVal = item.age || (item.birthDate ? parseBirthDate(item.birthDate) : '');
				setNativeFieldValue(field, String(item.age || ''));
				return;
			}

			// 18-Digit NIN
			if (classification === 'personal_nin') {
				const ninVal = item.nin || item.nationalId || '';
				if (ninVal) setNativeFieldValue(field, ninVal);
				return;
			}

			// National ID / Passport
			if (classification === 'personal_nationalId') {
				const idVal = item.nationalId || item.nin || '';
				if (idVal) setNativeFieldValue(field, idVal);
				return;
			}

			// Address 1
			if (classification === 'personal_address1' && item.addressLine1) {
				setNativeFieldValue(field, item.addressLine1);
				return;
			}

			// Address 2
			if (classification === 'personal_address2' && item.addressLine2) {
				setNativeFieldValue(field, item.addressLine2);
				return;
			}

			// City / Commune
			if (classification === 'personal_city' && item.city) {
				if (field.tagName === 'SELECT') {
					selectMatchingOption(field, [item.city.toLowerCase()]);
				} else {
					setNativeFieldValue(field, item.city);
				}
				return;
			}

			// State / Wilaya / Province
			if (classification === 'personal_state' && item.stateProvince) {
				if (field.tagName === 'SELECT') {
					const s = item.stateProvince.toLowerCase();
					const aliases = [s];
					const m = s.match(/^(\d{1,2})\s*-\s*(.+)$/);
					if (m) {
						aliases.push(m[1], m[2].trim(), `${m[1]} - ${m[2].trim()}`, `wilaya de ${m[2].trim()}`);
					}
					selectMatchingOption(field, aliases);
				} else {
					setNativeFieldValue(field, item.stateProvince);
				}
				return;
			}

			// Postal Code
			if (classification === 'personal_zip' && item.postalCode) {
				setNativeFieldValue(field, item.postalCode);
				return;
			}

			// Country
			if (classification === 'personal_country' && item.country) {
				if (field.tagName === 'SELECT') {
					const c = item.country.toLowerCase();
					const aliases = [c];
					if (c.includes('algeria') || c.includes('algerie') || c.includes('الجزائر')) aliases.push('dz', 'dza', 'algeria', 'algerie', 'الجزائر');
					if (c.includes('united states') || c.includes('usa') || c.includes('america')) aliases.push('us', 'usa', 'united states', 'etats-unis');
					if (c.includes('france')) aliases.push('fr', 'fra', 'france');
					selectMatchingOption(field, aliases);
				} else {
					setNativeFieldValue(field, item.country);
				}
				return;
			}

			// Phone
			if (classification === 'personal_phone') {
				const phoneVal = item.phone || (item.extraPhones && item.extraPhones[0]?.phone) || '';
				if (phoneVal) setNativeFieldValue(field, phoneVal);
				return;
			}

			// Email
			if (classification === 'personal_email' || (field.type === 'email' && !field.value)) {
				const emailVal = item.email || (item.extraEmails && item.extraEmails[0]?.email) || '';
				if (emailVal) setNativeFieldValue(field, emailVal);
				return;
			}
		});

		// Follow-up pass for dynamic cascading dropdowns (e.g. Country select triggers State options, or State triggers City)
		setTimeout(() => {
			const remainingInputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), select'));
			remainingInputs.forEach(field => {
				const cl = classifyField(field);
				if (cl === 'personal_state' && item.stateProvince && (!field.value || field.value === '')) {
					if (field.tagName === 'SELECT') {
						const s = item.stateProvince.toLowerCase();
						const aliases = [s];
						const m = s.match(/^(\d{1,2})\s*-\s*(.+)$/);
						if (m) {
							aliases.push(m[1], m[2].trim(), `${m[1]} - ${m[2].trim()}`);
						}
						selectMatchingOption(field, aliases);
					} else {
						setNativeFieldValue(field, item.stateProvince);
					}
				} else if (cl === 'personal_city' && item.city && (!field.value || field.value === '')) {
					if (field.tagName === 'SELECT') {
						selectMatchingOption(field, [item.city.toLowerCase()]);
					} else {
						setNativeFieldValue(field, item.city);
					}
				}
			});
		}, 150);

		// Check for radio buttons for gender if select wasn't present
		if (item.gender) {
			const g = item.gender.toLowerCase().trim();
			const isMale = g.startsWith('m') || g.includes('homme') || g.includes('ذكر') || g === '1';
			const isFemale = g.startsWith('f') || g.includes('femme') || g.includes('أنثى') || g.includes('انثى') || g === '2';
			const genderRadios = Array.from(form.querySelectorAll('input[type="radio"]')).filter(r => {
				const rName = (r.name || '').toLowerCase();
				return rName.includes('gender') || rName.includes('sex') || rName.includes('sexe');
			});
			genderRadios.forEach(radio => {
				const val = (radio.value || '').toLowerCase();
				if (isMale && (val === 'm' || val === 'male' || val === 'homme' || val === '1')) {
					radio.checked = true;
					radio.dispatchEvent(new Event('change', { bubbles: true }));
				} else if (isFemale && (val === 'f' || val === 'female' || val === 'femme' || val === '2')) {
					radio.checked = true;
					radio.dispatchEvent(new Event('change', { bubbles: true }));
				}
			});
		}

		// Fallback for target input if not filled
		if (!targetInput.value) {
			const targetCl = classifyField(targetInput);
			if (targetCl === 'personal_email' && item.email) {
				setNativeFieldValue(targetInput, item.email);
			} else if ((targetCl === 'personal_fullName' || targetCl === 'personal_firstName') && full) {
				setNativeFieldValue(targetInput, full);
			}
		}
	}

	// Dedicated Expiration Date Parser (Supports YYYY-MM-DD, YYYY-MM, MM/YY, MM/YYYY, DD/MM/YYYY, MMYY, MM-YY, MM-YYYY, M/YY)
	function parseCardExpiry(expStr) {
		if (!expStr) return null;
		const clean = String(expStr).trim();

		// 1. YYYY-MM-DD or YYYY/MM/DD or YYYY-MM or YYYY/MM
		let m = clean.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?$/);
		if (m) {
			const fullYear = m[1];
			const month = m[2].padStart(2, '0');
			const monthNum = parseInt(month, 10);
			const shortYear = fullYear.slice(-2);
			return {
				month,
				year: fullYear,
				fullYear,
				shortYear,
				monthNum,
				formatted: `${month}/${shortYear}`
			};
		}

		// 2. DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
		m = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
		if (m) {
			const p1 = parseInt(m[1], 10);
			const p2 = parseInt(m[2], 10);
			const fullYear = m[3];
			let monthNum;
			if (p1 > 12) {
				monthNum = p2;
			} else if (p2 > 12) {
				monthNum = p1;
			} else {
				monthNum = p2; // Default DD/MM/YYYY
			}
			const month = String(monthNum).padStart(2, '0');
			const shortYear = fullYear.slice(-2);
			return {
				month,
				year: fullYear,
				fullYear,
				shortYear,
				monthNum,
				formatted: `${month}/${shortYear}`
			};
		}

		// 3. MM/YY or MM/YYYY or MM-YY or MM-YYYY or M/YY or M/YYYY
		m = clean.match(/^(\d{1,2})[-/.](\d{2,4})$/);
		if (m) {
			const monthNum = parseInt(m[1], 10);
			const month = String(monthNum).padStart(2, '0');
			const y = m[2];
			const fullYear = y.length === 2 ? `20${y}` : y;
			const shortYear = y.length === 4 ? y.slice(-2) : y;
			return {
				month,
				year: fullYear,
				fullYear,
				shortYear,
				monthNum,
				formatted: `${month}/${shortYear}`
			};
		}

		// 4. MMYY (4 digits)
		m = clean.match(/^(\d{2})(\d{2})$/);
		if (m) {
			const monthNum = parseInt(m[1], 10);
			if (monthNum >= 1 && monthNum <= 12) {
				const month = m[1];
				const shortYear = m[2];
				const fullYear = `20${shortYear}`;
				return {
					month,
					year: fullYear,
					fullYear,
					shortYear,
					monthNum,
					formatted: `${month}/${shortYear}`
				};
			}
		}

		return null;
	}

	function selectMatchingOption(selectElement, candidateValues) {
		if (!selectElement || selectElement.tagName !== 'SELECT') return false;
		const options = Array.from(selectElement.options);
		const candidates = Array.isArray(candidateValues) ? candidateValues : [candidateValues];
		const cleanCandidates = candidates.flat().map(c => String(c).toLowerCase().trim()).filter(Boolean);

		// 1. Exact value or text match
		let matched = options.find(opt => {
			const val = (opt.value || '').toLowerCase().trim();
			const txt = (opt.text || '').toLowerCase().trim();
			return cleanCandidates.some(c => val === c || txt === c);
		});

		// 2. Prefix / StartsWith match
		if (!matched) {
			matched = options.find(opt => {
				const val = (opt.value || '').toLowerCase().trim();
				const txt = (opt.text || '').toLowerCase().trim();
				return cleanCandidates.some(c => 
					(c.length >= 2 && (val.startsWith(c) || txt.startsWith(c))) ||
					(c.length >= 3 && (val.includes(c) || txt.includes(c)))
				);
			});
		}

		if (matched) {
			selectElement.value = matched.value;
			selectElement.selectedIndex = matched.index;
			selectElement.dispatchEvent(new Event('change', { bubbles: true }));
			selectElement.dispatchEvent(new Event('input', { bubbles: true }));
			return true;
		}
		return false;
	}

	// Smart Autofill Engine dispatcher
	function autofillItem(targetInput, item) {
		const root = (targetInput.form && targetInput.form.querySelectorAll('input, select').length >= 3) ? targetInput.form : document;

		// 1. Password credentials (fills both username and password in one click)
		if (item.type === 'password') {
			const passInput = root.querySelector('input[type="password"]') || (targetInput && targetInput.type === 'password' ? targetInput : null);
			let userInput = null;

			if (targetInput && targetInput.type !== 'password' && targetInput.tagName === 'INPUT') {
				userInput = targetInput;
			} else {
				const allInputs = Array.from(root.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'));
				const passIdx = passInput ? allInputs.indexOf(passInput) : -1;
				if (passIdx > 0) {
					userInput = allInputs.slice(0, passIdx).reverse().find(i => 
						classifyField(i) === 'login_username' || i.type === 'email' || i.type === 'text' || i.type === 'tel'
					);
				}
				if (!userInput) {
					userInput = allInputs.find(i => i !== passInput && (classifyField(i) === 'login_username' || i.type === 'email' || i.type === 'text' || i.type === 'tel'));
				}
			}

			if (userInput && item.username) {
				setNativeFieldValue(userInput, item.username);
			}
			if (passInput && item.password) {
				setNativeFieldValue(passInput, item.password);
			}
		}

		// 2. TOTP Code
		else if (item.type === 'totp') {
			chrome.runtime.sendMessage({ action: "GET_TOTP", secret: item.secret }, (res) => {
				if (res && res.success && res.code) {
					setNativeFieldValue(targetInput, res.code);
				}
			});
		}

		// 3. Credit Card Payment Details
		else if (item.type === 'card') {
			const cvvVal = item.cvv || item.pin || '';
			const holderVal = item.cardholderName || item.fullName || item.title || (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : '');
			const numVal = (item.number || '').replace(/\s+/g, '');
			const parsedExp = parseCardExpiry(item.expirationDate);

			const root = (targetInput.form && targetInput.form.querySelectorAll('input, select').length >= 3) ? targetInput.form : document;
			const inputs = Array.from(root.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), select'));

			// 1. Card Number
			const cardNumInput = inputs.find(i => classifyField(i) === 'card_number') || (classifyField(targetInput) === 'card_number' ? targetInput : null) || targetInput;
			if (cardNumInput && numVal) {
				setNativeFieldValue(cardNumInput, numVal);
			}

			// 2. CVV / CVC
			const cvvInput = inputs.find(i => i !== cardNumInput && (classifyField(i) === 'card_cvv' || (i.name || i.id || i.placeholder || '').toLowerCase().match(/cvv|cvc|cvw|crypto|secu|security/)));
			if (cvvInput && cvvVal) {
				setNativeFieldValue(cvvInput, cvvVal);
			}

			// 3. Cardholder Name (My name / Nom et prénom / Titulaire / Porteur / Name on card)
			// Priority 1: classifyField matches 'card_holder'
			let holderInput = inputs.find(i => i !== cardNumInput && i !== cvvInput && classifyField(i) === 'card_holder');

			// Priority 2: Direct attribute/label scan for cardholder-specific markers
			if (!holderInput) {
				holderInput = inputs.find(i => {
					if (i === cardNumInput || i === cvvInput) return false;
					if (i.tagName !== 'INPUT') return false;
					const iType = (i.type || '').toLowerCase();
					if (iType && iType !== 'text' && iType !== 'string' && iType !== 'search') return false;

					const ac = (i.autocomplete || '').toLowerCase();
					if (ac === 'cc-name' || ac === 'cc-given-name' || ac === 'cc-family-name') return true;

					const labelText = getFieldLabelText(i);
					const attr = `${i.name || ''} ${i.id || ''} ${i.placeholder || ''} ${i.className || ''}`.toLowerCase();
					const norm = (attr + ' ' + labelText).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

					return (
						norm.includes('holder') ||
						norm.includes('cardholder') ||
						norm.includes('titulaire') ||
						norm.includes('porteur') ||
						norm.includes('card name') ||
						norm.includes('name on card') ||
						norm.includes('name on the card') ||
						norm.includes('nom sur carte') ||
						norm.includes('nom carte') ||
						norm.includes('cc name') ||
						norm.includes('card owner') ||
						norm.includes('cardowner') ||
						norm.includes('صاحب') ||
						norm.includes('حامل')
					);
				});
			}

			// Priority 3: In a payment context, find a name/nom field that isn't address/email/phone
			if (!holderInput) {
				holderInput = inputs.find(i => {
					if (i === cardNumInput || i === cvvInput) return false;
					if (i.tagName !== 'INPUT') return false;
					const iType = (i.type || '').toLowerCase();
					if (iType && iType !== 'text' && iType !== 'string') return false;

					const labelText = getFieldLabelText(i);
					const attr = `${i.name || ''} ${i.id || ''} ${i.placeholder || ''}`.toLowerCase();
					const norm = (attr + ' ' + labelText).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

					// Must have a name-related keyword
					const hasNameHint = norm.includes('name') || norm.includes('nom') || norm.includes('prenom') || norm.includes('اسم');
					if (!hasNameHint) return false;

					// Must NOT be an address / billing address / email / phone / city / state / zip field
					const isOtherField = norm.includes('email') || norm.includes('phone') || norm.includes('address') ||
						norm.includes('street') || norm.includes('city') || norm.includes('state') ||
						norm.includes('zip') || norm.includes('postal') || norm.includes('country') ||
						norm.includes('user') || norm.includes('login');
					return !isOtherField;
				});
			}

			// Priority 4: Fallback — first remaining text input in the form that isn't card number or CVV
			if (!holderInput) {
				holderInput = inputs.find(i => 
					i !== cardNumInput && 
					i !== cvvInput && 
					i.tagName === 'INPUT' && 
					((i.type || '').toLowerCase() === 'text' || !(i.type))
				);
			}

			if (holderInput && holderVal && holderInput !== cardNumInput && holderInput !== cvvInput) {
				setNativeFieldValue(holderInput, holderVal);
			}

			// 4. Expiration Date (Single input vs separate Month/Year dropdowns)
			if (parsedExp) {
				const { month, fullYear, shortYear, monthNum, formatted } = parsedExp;
				const monthName = MONTH_NAMES[monthNum] ? MONTH_NAMES[monthNum][0] : '';
				const monthAliases = MONTH_NAMES[monthNum] || [month];

				// Helper: check if field looks like a combined expiry input via attributes/label
				function looksLikeExpiryInput(el) {
					if (el.tagName !== 'INPUT') return false;
					const a = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.autocomplete || ''} ${el.getAttribute('aria-label') || ''} ${getFieldLabelText(el)}`.toLowerCase();
					return a.includes('expir') || a.includes('exp date') || a.includes('exp_date') || a.includes('expdate') ||
						a.includes('cc-exp') || a.includes('validite') || a.includes('valid thru') || a.includes('validthru') ||
						a.includes('mm/yy') || a.includes('mm / yy') || a.includes('mm/aa') || a.includes('mm-yy') ||
						a.includes('انتهاء') || a.includes('صلاحية') ||
						(a.includes('date') && (a.includes('card') || a.includes('carte') || a.includes('cc')));
				}

				// Helper: check if field looks like a separate month field via attributes/label
				function looksLikeMonthField(el) {
					const a = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.autocomplete || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
					if (a.includes('bday') || a.includes('birth') || a.includes('naissance') || a.includes('dob')) return false;
					return a.includes('cc-exp-month') || a.includes('exp_month') || a.includes('exp-month') || a.includes('expmonth') ||
						a.includes('card_month') || a.includes('card-month') || a.includes('cardmonth') ||
						a.includes('expm') || (a.includes('month') && (a.includes('exp') || a.includes('card') || a.includes('cc'))) ||
						(el.tagName === 'SELECT' && isMonthSelect(el));
				}

				// Helper: check if field looks like a separate year field via attributes/label
				function looksLikeYearField(el) {
					const a = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.autocomplete || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
					if (a.includes('bday') || a.includes('birth') || a.includes('naissance') || a.includes('dob')) return false;
					return a.includes('cc-exp-year') || a.includes('exp_year') || a.includes('exp-year') || a.includes('expyear') ||
						a.includes('card_year') || a.includes('card-year') || a.includes('cardyear') ||
						a.includes('expy') || (a.includes('year') && (a.includes('exp') || a.includes('card') || a.includes('cc'))) ||
						(el.tagName === 'SELECT' && isYearSelect(el));
				}

				const usedFields = [cardNumInput, cvvInput, holderInput].filter(Boolean);
				const remaining = inputs.filter(i => !usedFields.includes(i));

				// Single Expiration Date Input (e.g. MM/YY)
				let expInput = remaining.find(i => classifyField(i) === 'card_exp' && i.tagName === 'INPUT');
				// Fallback: attribute-based search for combined expiry input
				if (!expInput) {
					expInput = remaining.find(i => looksLikeExpiryInput(i));
				}
				if (expInput) {
					const placeholder = (expInput.placeholder || '').toLowerCase();
					if (expInput.type === 'month') {
						setNativeFieldValue(expInput, `${fullYear}-${month}`);
					} else if (expInput.type === 'date') {
						setNativeFieldValue(expInput, `${fullYear}-${month}-01`);
					} else if (expInput.maxLength === 4 || placeholder.includes('mmyy')) {
						setNativeFieldValue(expInput, `${month}${shortYear}`);
					} else if (placeholder.includes('mm / yy')) {
						setNativeFieldValue(expInput, `${month} / ${shortYear}`);
					} else if (placeholder.includes('mm/yyyy') || expInput.maxLength === 7) {
						setNativeFieldValue(expInput, `${month}/${fullYear}`);
					} else {
						setNativeFieldValue(expInput, formatted);
					}
				}

				const remainingAfterExp = remaining.filter(i => i !== expInput);

				// Separate Month Select or Input
				let monthInput = remainingAfterExp.find(i =>
					classifyField(i) === 'card_exp_month' || looksLikeMonthField(i)
				);
				// Fallback: any remaining SELECT that has month-like options (1-12) and isn't a year select
				if (!monthInput) {
					monthInput = remainingAfterExp.find(i =>
						i.tagName === 'SELECT' && isMonthSelect(i) && !isYearSelect(i)
					);
				}

				if (monthInput) {
					if (monthInput.tagName === 'SELECT') {
						const options = Array.from(monthInput.options);
						const matchedOpt = options.find(opt => {
							const val = (opt.value || '').trim().toLowerCase();
							const txt = (opt.text || '').trim().toLowerCase();
							return val === month || 
								val === String(monthNum) || 
								txt === month || 
								txt === String(monthNum) ||
								txt.startsWith(month) || 
								txt.startsWith(String(monthNum)) ||
								(monthName && txt.includes(monthName)) ||
								monthAliases.some(a => val === a || txt === a || txt.includes(a));
						});
						if (matchedOpt) {
							monthInput.value = matchedOpt.value;
							monthInput.dispatchEvent(new Event('change', { bubbles: true }));
							monthInput.dispatchEvent(new Event('input', { bubbles: true }));
						}
					} else {
						setNativeFieldValue(monthInput, month);
					}
				}

				// Separate Year Select or Input
				const remainingAfterMonth = remainingAfterExp.filter(i => i !== monthInput);
				let yearInput = remainingAfterMonth.find(i =>
					classifyField(i) === 'card_exp_year' || looksLikeYearField(i)
				);
				// Fallback: any remaining SELECT that has year-like options and isn't a month select
				if (!yearInput) {
					yearInput = remainingAfterMonth.find(i =>
						i.tagName === 'SELECT' && isYearSelect(i) && !isMonthSelect(i)
					);
				}

				if (yearInput) {
					if (yearInput.tagName === 'SELECT') {
						const options = Array.from(yearInput.options);
						const matchedOpt = options.find(opt => {
							const val = (opt.value || '').trim().toLowerCase();
							const txt = (opt.text || '').trim().toLowerCase();
							return val === fullYear || 
								val === shortYear || 
								txt === fullYear || 
								txt === shortYear ||
								txt.includes(fullYear) || 
								txt.includes(shortYear);
						});
						if (matchedOpt) {
							yearInput.value = matchedOpt.value;
							yearInput.dispatchEvent(new Event('change', { bubbles: true }));
							yearInput.dispatchEvent(new Event('input', { bubbles: true }));
						}
					} else {
						setNativeFieldValue(yearInput, yearInput.maxLength === 2 ? shortYear : fullYear);
					}
				}
			}

			// 5. NIN if available on ID card or passport
			if (item.nin) {
				const ninInput = inputs.find(i => classifyField(i) === 'personal_nin' || (i.name || i.id || i.placeholder || '').toLowerCase().includes('nin'));
				if (ninInput) {
					setNativeFieldValue(ninInput, item.nin);
				}
			}
		}

		// 4. Personal Info Profiles
		else if (item.type === 'personal_info') {
			fillPersonalInfo(targetInput, item);
		}
	}

	function escapeHtml(str) {
		if (!str) return '';
		return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

	// Auto-Save Form Submit Handler
	function setupAutoSaveSubmitListener() {
		const triggerSaveFromForm = (form) => {
			if (!form) return;
			const passInputs = Array.from(form.querySelectorAll('input[type="password"]'));
			if (passInputs.length === 0) return;
			// Security: Ignore hidden / zero-dimension honeypots
			const primaryPass = passInputs[0];
			if (primaryPass.offsetWidth === 0 || primaryPass.offsetHeight === 0) return;

			const userInput = form.querySelector(
				'input[type="email"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[id*="user" i], input[id*="email" i], input[id*="login" i], input[type="text"]'
			);
			const passVal = primaryPass.value;
			const userVal = userInput ? userInput.value : '';

			if (passVal && passVal.length >= 4) {
				const title = `${currentDomain} Account`;
				chrome.runtime.sendMessage(
					{
						action: "SAVE_PASSWORD",
						id: form.dataset ? form.dataset.safevaultItemId : undefined,
						title,
						username: userVal,
						password: passVal,
						url: window.location.href,
						notes: `Captured from form on ${currentDomain}.`,
					},
					(res) => {
						if (res && res.success) {
							if (res.item && form.dataset) form.dataset.safevaultItemId = res.item.id;
							if (res.queued) {
								showToastBanner('Credentials queued (vault locked)');
							} else {
								showToastBanner('Credentials saved');
							}
						}
					}
				);
			}
		};

		document.addEventListener('submit', (e) => {
			// Security: Ignore untrusted synthetic JavaScript events
			if (!e.isTrusted) return;
			if (e.target && e.target instanceof HTMLFormElement) {
				triggerSaveFromForm(e.target);
			}
		}, true);

		document.addEventListener('click', (e) => {
			// Security: Ignore untrusted synthetic JavaScript events
			if (!e.isTrusted) return;
			const target = e.target.closest('button, input[type="submit"], input[type="button"], .btn');
			if (!target) return;
			const btnText = (target.textContent || target.value || '').toLowerCase();
			const isRegisterBtn = target.type === 'submit' || ['register', 'signup', 'sign-up', 'join', 'create', 'submit', "s'inscrire", 'إنشاء'].some(kw => btnText.includes(kw));
			if (isRegisterBtn) {
				let form = target.form || target.closest('form');
				if (!form) {
					// Search upwards for container with password input (supports SPAs / React divs)
					let parent = target.parentElement;
					while (parent && parent !== document.body) {
						if (parent.querySelector('input[type="password"]')) {
							form = parent;
							break;
						}
						parent = parent.parentElement;
					}
				}
				if (!form) form = document;
				setTimeout(() => triggerSaveFromForm(form), 120);
			}
		}, true);
	}

	// Scan DOM and attach badges to relevant candidate fields
	function scanAndAttach() {
		const inputs = document.querySelectorAll('input:not([type="hidden"]), select');
		inputs.forEach((input) => {
			if (!shouldIgnoreField(input)) {
				const cl = classifyField(input);
				if (cl.startsWith('personal_')) {
					const primary = getPrimaryProfileField(input);
					if (primary && primary !== input && attachedBadges.has(input)) {
						const oldBadge = attachedBadges.get(input);
						if (oldBadge) {
							oldBadge.remove();
							attachedBadges.delete(input);
						}
					}
				}
				attachBadge(input);
			}
		});
	}

	// Optimized MutationObserver targeting only relevant inputs/forms
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
			// Find corresponding input
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
	setTimeout(scanAndAttach, 400);
})();
