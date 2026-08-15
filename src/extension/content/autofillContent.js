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

	// Context Helper: Determine if field is inside a payment or checkout context
	function isPaymentContext(input) {
		if (!input) return false;
		const ac = (input.autocomplete || '').toLowerCase();
		if (ac.startsWith('cc-')) return true;

		const container = input.form || input.closest('form') || input.closest('table') || input.closest('.payment, .checkout, .paiement, #payment, #checkout') || document;
		if (container) {
			const inputs = Array.from(container.querySelectorAll('input, select'));
			const hasCardSignals = inputs.some(el => {
				const a = `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.getAttribute('aria-label') || ''} ${el.autocomplete || ''}`.toLowerCase();
				return a.includes('cc-') ||
					a.includes('cvv') ||
					a.includes('cvc') ||
					a.includes('cvw') ||
					a.includes('cardnumber') ||
					a.includes('card-number') ||
					a.includes('card_number') ||
					a.includes('pan') ||
					a.includes('num_carte') ||
					a.includes('numero_carte') ||
					a.includes('n_carte') ||
					a.includes('edahabia') ||
					a.includes('cib') ||
					a.includes('baridi') ||
					a.includes('satim');
			});
			if (hasCardSignals) return true;
		}

		const pageUrl = window.location.href.toLowerCase();
		if (
			pageUrl.includes('payment') ||
			pageUrl.includes('paiement') ||
			pageUrl.includes('checkout') ||
			pageUrl.includes('satim') ||
			pageUrl.includes('eccp.poste.dz/payment') ||
			pageUrl.includes('epay.poste.dz') ||
			pageUrl.includes('baridimob')
		) {
			return true;
		}

		return false;
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

		const norm = `${name} ${id} ${placeholder} ${aria} ${autocomplete} ${type} ${labelText}`
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();

		const inPayment = isPaymentContext(input);

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

		// 2. Credit Card CVV / CVC (Algerian SATIM, ECCP, CIB, Edahabia, International)
		if (
			autocomplete === 'cc-csc' ||
			matchToken(norm, /\b(cvv|cvc|cvw|cvp|cvv2|cvc2|security[-_]?code|code[-_]?(securite|secu|verification)|cryptogramme)\b/i) ||
			matchToken(norm, /(رمز[-_]?(الأمان|الحماية|التحقق|الامان))/i)
		) {
			return 'card_cvv';
		}

		// 3. Credit Card Number (Algerian CIB, Edahabia, BaridiMob, SATIM, Visa, MC, Amex)
		if (
			autocomplete === 'cc-number' ||
			matchToken(norm, /\b(card[-_]?num(ber)?|cc[-_]?num(ber)?|creditcard|num[-_]?carte|numero[-_]?carte|n[-_]?carte|pan|carte[-_]?(cib|edahabia|bancaire)|edahabia|baridi|satim)\b/i) ||
			matchToken(norm, /(رقم[-_]?(البطاقة|الائتمان)|الذهبية|البطاقة)/i)
		) {
			return 'card_number';
		}

		// 4. Credit Card Expiry Date
		if (
			autocomplete.includes('cc-exp') ||
			matchToken(norm, /\b(exp[-_]?(date|month|year)|expiry|expiration|mm\/yy|date[-_]?exp(iration)?|mois[-_]?exp|annee[-_]?exp)\b/i) ||
			matchToken(norm, /(تاريخ[-_]?(الانتهاء|إنتهاء|الصلاحية|انقضاء))/i)
		) {
			return 'card_exp';
		}

		// 5. Cardholder Name (Nom et prénom / Titulaire / Porteur on Payment pages)
		if (
			autocomplete === 'cc-name' ||
			matchToken(norm, /\b(card[-_]?holder|name[-_]?on[-_]?card|cc[-_]?name|titulaire|porteur|nom[-_]?porteur)\b/i) ||
			matchToken(norm, /(اسم[-_]?(صاحب|حامل)[-_]?البطاقة)/i) ||
			(inPayment && (matchToken(norm, /\b(nom|prenom|holder|owner|name)\b/i) || matchToken(norm, /(الاسم|اللقب)/i)))
		) {
			return 'card_holder';
		}

		// IF IN PAYMENT CONTEXT: Disallow any further classification as personal_* or login_username
		if (inPayment) {
			return 'generic';
		}

		// 6. 2FA / TOTP / Verification code
		if (
			autocomplete === 'one-time-code' ||
			matchToken(norm, /\b(totp|2fa|mfa|otp|one[-_]?time[-_]?code|verification[-_]?code|validation[-_]?code|security[-_]?token)\b/i) ||
			matchToken(norm, /(رمز[-_]?(التحقق|التأكيد|التفعيل|الأمان))/i)
		) {
			return 'totp';
		}

		// 7. Password Fields (Categorize between Login & New/Registration Password)
		if (type === 'password' || matchToken(norm, /\b(password|mot[-_]?de[-_]?passe|mdp|code[-_]?secret)\b/i) || matchToken(norm, /(كلمة[-_]?(السر|المرور)|الرمز[-_]?السري)/i)) {
			if (autocomplete === 'new-password' || matchToken(norm, /\b(new[-_]?pass(word)?|create[-_]?pass(word)?|signup[-_]?pass|confirm[-_]?pass(word)?|verify[-_]?pass)\b/i)) {
				return 'new_password';
			}
			return 'password';
		}

		// 8. Personal Info: First Name
		if (
			autocomplete === 'given-name' ||
			matchToken(norm, /\b(first[-_]?name|given[-_]?name|forename|fname|prenom)\b/i) ||
			matchToken(norm, /(الاسم[-_]?الأول|الاسم[-_]?الاول|الاسم[-_]?الشخصي)/i)
		) {
			return 'personal_firstName';
		}

		// 9. Personal Info: Last Name
		if (
			autocomplete === 'family-name' ||
			matchToken(norm, /\b(last[-_]?name|family[-_]?name|surname|lname|nom[-_]?de[-_]?famille)\b/i) ||
			(matchToken(norm, /\bnom\b/i) && !matchToken(norm, /\b(prenom|full|user|card|holder)\b/i)) ||
			matchToken(norm, /(اللقب|اسم[-_]?العائلة|اسم[-_]?النسب)/i)
		) {
			return 'personal_lastName';
		}

		// 10. Personal Info: Full Name
		if (
			autocomplete === 'name' ||
			matchToken(norm, /\b(full[-_]?name|your[-_]?name|nom[-_]?prenom|nom[-_]?et[-_]?prenom)\b/i) ||
			matchToken(norm, /(الاسم[-_]?الكامل|الاسم[-_]?الثلاثي|الاسم[-_]?واللقب)/i)
		) {
			return 'personal_fullName';
		}

		// 11. Personal Info: Birth Date (Universal / Specific)
		if (
			type === 'date' ||
			autocomplete === 'bday' ||
			matchToken(norm, /\b(birth[-_]?date|dob|date[-_]?of[-_]?birth|date[-_]?naissance|bday)\b/i) ||
			matchToken(norm, /(تاريخ[-_]?(الميلاد|الولادة))/i)
		) {
			return 'personal_birthDate';
		}
		if (autocomplete === 'bday-day' || matchToken(norm, /\b(birth[-_]?day|dob[-_]?day|jour[-_]?naissance)\b/i) || matchToken(norm, /(يوم[-_]?الميلاد)/i)) {
			return 'personal_birthDay';
		}
		if (autocomplete === 'bday-month' || matchToken(norm, /\b(birth[-_]?month|dob[-_]?month|mois[-_]?naissance)\b/i) || matchToken(norm, /(شهر[-_]?الميلاد)/i)) {
			return 'personal_birthMonth';
		}
		if (autocomplete === 'bday-year' || matchToken(norm, /\b(birth[-_]?year|dob[-_]?year|annee[-_]?naissance)\b/i) || matchToken(norm, /(سنة[-_]?الميلاد|عام[-_]?الميلاد)/i)) {
			return 'personal_birthYear';
		}

		// 12. Personal Info: Gender
		if (
			autocomplete === 'sex' ||
			matchToken(norm, /\b(gender|sex|sexe)\b/i) ||
			matchToken(norm, /(الجنس|النوع)/i)
		) {
			return 'personal_gender';
		}

		// 13. Personal Info: Age
		if (
			matchToken(norm, /\b(age|âge)\b/i) ||
			matchToken(norm, /(العمر|السن)/i)
		) {
			return 'personal_age';
		}

		// 14. Personal Info: National ID / Passport / NIN
		if (
			matchToken(norm, /\b(national[-_]?id|nin|ssn|social[-_]?security|passport|passeport|carte[-_]?identite|n[-_]?national|cin|cni|identity[-_]?card)\b/i) ||
			matchToken(norm, /(رقم[-_]?(التعريف|الهوية|الوطني)|بطاقة[-_]?التعريف|جواز[-_]?السفر)/i)
		) {
			return 'personal_nationalId';
		}

		// 15. Personal Info: Address
		if (
			autocomplete === 'address-line2' ||
			matchToken(norm, /\b(address[-_]?line2|address2|apt|suite|complement[-_]?adresse|batiment|etage)\b/i) ||
			matchToken(norm, /(شقة|عمارة|رقم[-_]?الشقة)/i)
		) {
			return 'personal_address2';
		}
		if (
			autocomplete === 'address-line1' ||
			autocomplete === 'street-address' ||
			matchToken(norm, /\b(address[-_]?line1|address1|street[-_]?address|street|adresse|rue)\b/i) ||
			matchToken(norm, /(العنوان|الشارع|عنوان[-_]?الاقامة)/i)
		) {
			return 'personal_address1';
		}

		// 16. Personal Info: City & State/Wilaya & Postal Code & Country
		if (
			autocomplete === 'address-level2' ||
			matchToken(norm, /\b(city|ville|town|commune|municipality)\b/i) ||
			matchToken(norm, /(المدينة|البلدية)/i)
		) {
			return 'personal_city';
		}
		if (
			autocomplete === 'address-level1' ||
			matchToken(norm, /\b(state|province|wilaya|region|departement|county)\b/i) ||
			matchToken(norm, /(الولاية|المحافظة|الاقليم|المنطقة)/i)
		) {
			return 'personal_state';
		}
		if (
			autocomplete === 'postal-code' ||
			matchToken(norm, /\b(zip|zip[-_]?code|postal[-_]?code|postcode|code[-_]?postal)\b/i) ||
			matchToken(norm, /(الرمز[-_]?البريدي)/i)
		) {
			return 'personal_zip';
		}
		if (
			autocomplete === 'country' ||
			autocomplete === 'country-name' ||
			matchToken(norm, /\b(country|pays|nation)\b/i) ||
			matchToken(norm, /(الدولة|البلد)/i)
		) {
			return 'personal_country';
		}

		// 17. Contact: Phone
		if (
			type === 'tel' ||
			autocomplete.includes('tel') ||
			matchToken(norm, /\b(phone|telephone|mobile|cell|cellphone|num[-_]?tel)\b/i) ||
			matchToken(norm, /(الهاتف|المحمول|الجوال|رقم[-_]?الهاتف)/i)
		) {
			return 'personal_phone';
		}

		// 18. Contact: Email / Username / Login
		if (
			type === 'email' ||
			autocomplete === 'email' ||
			matchToken(norm, /\b(email|e-mail|mail|courriel|adresse[-_]?email)\b/i) ||
			matchToken(norm, /(البريد[-_]?(الإلكتروني|الالكتروني|البريد)?)/i)
		) {
			if (isRegistrationForm(input)) {
				return 'personal_email';
			}
			return 'login_username';
		}

		if (
			autocomplete === 'username' ||
			matchToken(norm, /\b(username|user[-_]?name|login|identifiant|num[-_]?ccp|rip|user[-_]?id|auth[-_]?user)\b/i) ||
			matchToken(norm, /(اسم[-_]?المستخدم|المعرف|رقم[-_]?الحساب)/i)
		) {
			return 'login_username';
		}

		return 'generic';
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

	// Bulletproof Badge Injection and Positioning
	function attachBadge(input) {
		if (attachedBadges.has(input)) return;

		const classification = classifyField(input);
		// Do not attach badges to secondary card fields (CVV, Expiry, Holder) -> Only to Card Number
		if (classification === 'card_cvv' || classification === 'card_exp' || classification === 'card_holder') {
			return;
		}
		if (classification === 'generic') {
			return;
		}

		const badge = document.createElement('div');
		badge.className = 'safevault-input-badge';
		badge.title = 'SafeVaultPro (Click to autofill, Drag to move)';
		badge.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`;

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

	function updateBadgeFixedPosition(input, badge) {
		if (!input || !badge || badge.classList.contains('safevault-dragging')) return;
		const rect = input.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) {
			badge.style.display = 'none';
			return;
		}
		badge.style.display = 'flex';
		badge.style.position = 'fixed';
		badge.style.left = `${rect.right - 28}px`;
		badge.style.top = `${rect.top + (rect.height / 2) - 10}px`;
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

		// 1. Credit Card Number Field
		if (classification === 'card_number') {
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
		document.body.appendChild(dropdown);
		activeDropdown = dropdown;
	}

	function renderGenericDropdownMenu(input, badge, items) {
		closeDropdown();
		const dropdown = document.createElement('div');
		dropdown.className = 'safevault-dropdown-menu';

		let itemsHtml = '';
		items.forEach((item) => {
			if (item.type === 'password') {
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}" data-type="password">
						<div class="safevault-item-icon">🔑</div>
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
						<div class="safevault-item-icon">⚡</div>
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
				const cvvCode = (item.cvv || item.pin) ? ` | CVV: ${escapeHtml(item.cvv || item.pin)}` : '';
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}" data-type="card">
						<div class="safevault-item-icon">💳</div>
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
						<div class="safevault-item-icon">👤</div>
						<div class="safevault-item-details">
							<div class="safevault-item-title">${escapeHtml(item.fullName || item.title)}</div>
							<div class="safevault-item-sub">${escapeHtml(sub)}</div>
						</div>
						<span class="safevault-fill-btn">Fill Profile</span>
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
				if (targetItem.type === 'card') showToastBanner(`💳 Payment card filled!`);
				else if (targetItem.type === 'personal_info') showToastBanner(`👤 Identity profile filled!`);
				else if (targetItem.type === 'totp') showToastBanner(`⚡ 2FA code inserted!`);
				else showToastBanner(`🔑 Credentials filled!`);
			}
			closeDropdown();
		});

		positionDropdown(badge, dropdown);
		document.body.appendChild(dropdown);
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
					<div class="safevault-item-icon">⚡</div>
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

						const form = input.form || input.closest('form');
						if (form) {
							const passFields = Array.from(form.querySelectorAll('input[type="password"]'));
							passFields.forEach(pField => setNativeFieldValue(pField, generatedPass));
						}

						const userField = form ? form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="email"]') : null;
						const usernameVal = userField ? userField.value : '';
						const title = `${currentDomain} Account`;

						chrome.runtime.sendMessage(
							{
								action: "SAVE_PASSWORD",
								id: form?.dataset.safevaultItemId,
								title,
								username: usernameVal,
								password: generatedPass,
								url: window.location.href,
								notes: `Generated & saved on ${currentDomain}.`,
							},
							(saveRes) => {
								if (saveRes && saveRes.success && saveRes.item && form) {
									form.dataset.safevaultItemId = saveRes.item.id;
								}
								showToastBanner(`🔒 Password saved to SafeVaultPro!`);
							}
						);
					}
				});
			}
		});

		positionDropdown(badge, dropdown);
		document.body.appendChild(dropdown);
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
		const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select'));

		// 1. First & Last Names vs Full Name Decomposition
		let first = item.firstName || '';
		let last = item.lastName || '';
		let full = item.fullName || '';

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

		// 2. Birthday Parsing
		const parsedDob = parseBirthDate(item.birthDate);

		inputs.forEach((field) => {
			const classification = classifyField(field);

			// First Name
			if (classification === 'personal_firstName' && first) {
				setNativeFieldValue(field, first);
				return;
			}

			// Last Name
			if (classification === 'personal_lastName' && last) {
				setNativeFieldValue(field, last);
				return;
			}

			// Full Name
			if (classification === 'personal_fullName' && full) {
				setNativeFieldValue(field, full);
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
			if (classification === 'personal_age' && item.age) {
				setNativeFieldValue(field, String(item.age));
				return;
			}

			// National ID / Passport
			if (classification === 'personal_nationalId' && item.nationalId) {
				setNativeFieldValue(field, item.nationalId);
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

			// City
			if (classification === 'personal_city' && item.city) {
				setNativeFieldValue(field, item.city);
				return;
			}

			// State / Wilaya / Province
			if (classification === 'personal_state' && item.stateProvince) {
				if (field.tagName === 'SELECT') {
					selectMatchingOption(field, [item.stateProvince.toLowerCase()]);
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
					if (c.includes('algeria') || c.includes('algerie') || c.includes('الجزائر')) aliases.push('dz', 'dza', 'algeria', 'algerie');
					if (c.includes('united states') || c.includes('usa') || c.includes('america')) aliases.push('us', 'usa', 'united states');
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
			if (item.email) setNativeFieldValue(targetInput, item.email);
			else if (full) setNativeFieldValue(targetInput, full);
		}
	}

	function selectMatchingOption(selectElement, candidateValues) {
		if (!selectElement || selectElement.tagName !== 'SELECT') return;
		const options = Array.from(selectElement.options);
		const cleanCandidates = candidateValues.map(c => String(c).toLowerCase().trim());

		const matched = options.find(opt => {
			const val = (opt.value || '').toLowerCase().trim();
			const txt = (opt.text || '').toLowerCase().trim();
			return cleanCandidates.some(c => val === c || txt === c || txt.startsWith(c) || val.startsWith(c));
		});

		if (matched) {
			selectElement.value = matched.value;
			selectElement.dispatchEvent(new Event('change', { bubbles: true }));
			selectElement.dispatchEvent(new Event('input', { bubbles: true }));
		}
	}

	// Smart Autofill Engine dispatcher
	function autofillItem(targetInput, item) {
		const form = targetInput.form || targetInput.closest('form') || document.body;

		// 1. Password credentials
		if (item.type === 'password') {
			const passFields = Array.from(form.querySelectorAll('input[type="password"]'));
			const userFields = Array.from(form.querySelectorAll('input[type="text"], input[type="email"]')).filter(i => {
				const cl = classifyField(i);
				return cl === 'login_username' || cl === 'personal_email' || i.type === 'email';
			});

			if (passFields.length > 0 && item.password) {
				setNativeFieldValue(passFields[0], item.password);
			}
			if (userFields.length > 0 && item.username) {
				setNativeFieldValue(userFields[0], item.username);
			} else if (item.username && (targetInput.type === 'text' || targetInput.type === 'email')) {
				setNativeFieldValue(targetInput, item.username);
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
			const holderVal = item.cardholderName || item.fullName || item.title || '';
			const numVal = (item.number || '').replace(/\s+/g, '');
			const expVal = item.expirationDate || '';

			const container = targetInput.form || targetInput.closest('form') || targetInput.closest('table') || document;
			const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select'));

			// 1. Card Number
			const cardNumInput = inputs.find(i => classifyField(i) === 'card_number') || targetInput;
			if (cardNumInput && numVal) {
				setNativeFieldValue(cardNumInput, numVal);
			}

			// 2. CVV / CVC
			const cvvInput = inputs.find(i => i !== cardNumInput && (classifyField(i) === 'card_cvv' || (i.name || i.id || i.placeholder || '').toLowerCase().match(/cvv|cvc|cvw|crypto|secu/)));
			if (cvvInput && cvvVal) {
				setNativeFieldValue(cvvInput, cvvVal);
			}

			// 3. Cardholder Name
			let holderInput = inputs.find(i => i !== cardNumInput && i !== cvvInput && classifyField(i) === 'card_holder');
			if (!holderInput) {
				holderInput = inputs.find(i => {
					if (i === cardNumInput || i === cvvInput || i.tagName !== 'INPUT') return false;
					const attr = `${i.name || ''} ${i.id || ''} ${i.placeholder || ''} ${getFieldLabelText(i)}`.toLowerCase();
					return attr.includes('nom') || attr.includes('prenom') || attr.includes('holder') || attr.includes('titulaire') || attr.includes('porteur') || attr.includes('name') || attr.includes('اسم');
				});
			}
			if (holderInput && holderVal) {
				setNativeFieldValue(holderInput, holderVal);
			}

			// 4. Expiration Date (Single input vs Month / Year Selects)
			if (expVal) {
				const parts = expVal.split(/[/.-]/);
				const monthVal = parts[0] ? parts[0].padStart(2, '0') : '';
				let yearVal = parts[1] || '';
				const fullYear = yearVal.length === 2 ? `20${yearVal}` : yearVal;
				const shortYear = yearVal.length === 4 ? yearVal.slice(-2) : yearVal;

				// Single Expiration Date Input
				const expInput = inputs.find(i => i !== cardNumInput && i !== cvvInput && i !== holderInput && classifyField(i) === 'card_exp' && i.tagName === 'INPUT' && !i.name?.toLowerCase().match(/month|mois|year|annee|mm|yy/));
				if (expInput) {
					setNativeFieldValue(expInput, expVal);
				}

				// Separate Month Select or Input
				const monthField = inputs.find(i => i !== cardNumInput && i !== cvvInput && i !== holderInput && (
					(classifyField(i) === 'card_exp' && i !== expInput) ||
					(i.name || i.id || '').toLowerCase().match(/^(mm|month|mois|exp_?m(onth)?)$/i) ||
					(i.tagName === 'SELECT' && Array.from(i.options).some(o => o.value === '01' || o.value === '1' || o.text === '01' || o.text === '1'))
				));
				if (monthField) {
					if (monthField.tagName === 'SELECT') {
						selectMatchingOption(monthField, [monthVal, String(parseInt(monthVal, 10))]);
					} else {
						setNativeFieldValue(monthField, monthVal);
					}
				}

				// Separate Year Select or Input
				const yearField = inputs.find(i => i !== cardNumInput && i !== cvvInput && i !== holderInput && i !== monthField && (
					(classifyField(i) === 'card_exp' && i !== expInput) ||
					(i.name || i.id || '').toLowerCase().match(/^(yy|year|annee|exp_?y(ear)?)$/i) ||
					(i.tagName === 'SELECT' && Array.from(i.options).some(o => o.value === fullYear || o.value === shortYear || o.text === fullYear || o.text === shortYear))
				));
				if (yearField) {
					if (yearField.tagName === 'SELECT') {
						selectMatchingOption(yearField, [fullYear, shortYear]);
					} else {
						setNativeFieldValue(yearField, fullYear);
					}
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
		const existing = document.querySelector('.safevault-toast-banner');
		if (existing) existing.remove();

		const toast = document.createElement('div');
		toast.className = 'safevault-toast-banner';
		toast.innerHTML = `
			<div class="safevault-toast-icon">✓</div>
			<div>${escapeHtml(message)}</div>
		`;
		document.body.appendChild(toast);
		setTimeout(() => {
			toast.style.opacity = '0';
			toast.style.transform = 'translateY(6px)';
			toast.style.transition = 'all 0.2s ease';
			setTimeout(() => toast.remove(), 200);
		}, 1800);
	}

	// Auto-Save Form Submit Handler
	function setupAutoSaveSubmitListener() {
		const triggerSaveFromForm = (form) => {
			if (!form) return;
			const passInputs = Array.from(form.querySelectorAll('input[type="password"]'));
			const userInput = form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="email"]');
			const passVal = passInputs.length > 0 ? passInputs[0].value : '';
			const userVal = userInput ? userInput.value : '';

			if (passVal && passVal.length >= 4) {
				const title = `${currentDomain} Account`;
				chrome.runtime.sendMessage(
					{
						action: "SAVE_PASSWORD",
						id: form.dataset.safevaultItemId,
						title,
						username: userVal,
						password: passVal,
						url: window.location.href,
						notes: `Captured from form on ${currentDomain}.`,
					},
					(res) => {
						if (res && res.success) {
							if (res.item) form.dataset.safevaultItemId = res.item.id;
							showToastBanner(`🔒 Credentials for ${currentDomain} saved!`);
						}
					}
				);
			}
		};

		document.addEventListener('submit', (e) => {
			if (e.target && e.target instanceof HTMLFormElement) {
				triggerSaveFromForm(e.target);
			}
		}, true);

		document.addEventListener('click', (e) => {
			const target = e.target.closest('button, input[type="submit"], input[type="button"], .btn');
			if (!target) return;
			const btnText = (target.textContent || target.value || '').toLowerCase();
			const isRegisterBtn = target.type === 'submit' || ['register', 'signup', 'sign-up', 'join', 'create', 'submit', "s'inscrire", 'إنشاء'].some(kw => btnText.includes(kw));
			if (isRegisterBtn) {
				const form = target.form || target.closest('form') || target.closest('div');
				if (form) setTimeout(() => triggerSaveFromForm(form), 120);
			}
		}, true);
	}

	// Scan DOM and attach badges to relevant candidate fields
	function scanAndAttach() {
		const inputs = document.querySelectorAll('input:not([type="hidden"]), select');
		inputs.forEach((input) => {
			if (!shouldIgnoreField(input)) {
				attachBadge(input);
			}
		});
	}

	// MutationObserver to capture dynamically created fields and multi-step logins (Google, Microsoft, SPAs)
	let scanDebounceTimer = null;
	const observer = new MutationObserver(() => {
		if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
		scanDebounceTimer = setTimeout(scanAndAttach, 60);
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
		if (activeDropdown && !e.target.closest('.safevault-dropdown-menu') && !e.target.closest('.safevault-input-badge')) {
			closeDropdown();
		}
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && activeDropdown) {
			closeDropdown();
		}
	});

	setupAutoSaveSubmitListener();
	setTimeout(scanAndAttach, 400);
})();
