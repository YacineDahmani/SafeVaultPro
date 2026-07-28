(function () {
	let activeDropdown = null;
	let currentDomain = window.location.hostname;

	// Helper to send native event triggers so React/Vue/Angular state updates
	function setNativeFieldValue(field, val) {
		if (!field) return;
		try {
			if (field.tagName === 'SELECT') {
				field.value = val;
				field.dispatchEvent(new Event('change', { bubbles: true }));
				return;
			}
			const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
			if (valueSetter) {
				valueSetter.call(field, val);
			} else {
				field.value = val;
			}
			field.dispatchEvent(new Event('input', { bubbles: true }));
			field.dispatchEvent(new Event('change', { bubbles: true }));
			field.dispatchEvent(new Event('blur', { bubbles: true }));
		} catch (e) {
			field.value = val;
		}
	}

	// Comprehensive Multilingual (English + French + Arabic) Form Field Classifier
	function classifyField(input) {
		const name = (input.name || '').toLowerCase();
		const id = (input.id || '').toLowerCase();
		const placeholder = (input.placeholder || '').toLowerCase();
		const autocomplete = (input.autocomplete || '').toLowerCase();
		const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
		const type = (input.type || '').toLowerCase();

		const combined = `${name} ${id} ${placeholder} ${ariaLabel} ${autocomplete} ${type}`;

		// 1. Credit Card CVV / CVC / CVP / Cryptogramme (EVALUATED FIRST to catch <input type="password" name="cvv">)
		if (
			combined.includes('cvv') ||
			combined.includes('cvc') ||
			combined.includes('cvp') ||
			combined.includes('security-code') ||
			combined.includes('cvv2') ||
			combined.includes('cvc2') ||
			combined.includes('cvp2') ||
			combined.includes('crypto') ||
			combined.includes('cryptogramme') ||
			combined.includes('code_securite') ||
			combined.includes('code_secu') ||
			combined.includes('code_verification') ||
			combined.includes('cc-csc') ||
			combined.includes('رمز الأمان') ||
			combined.includes('رمز الحماية') ||
			combined.includes('رمز التحقق')
		) {
			return 'card_cvv';
		}

		// 2. Credit Card Number (Algerian CIB, Edahabia, Baridi, Satim, ECCP, Postel, Visa, MasterCard)
		if (
			combined.includes('cardnumber') ||
			combined.includes('card-number') ||
			combined.includes('cc-number') ||
			combined.includes('creditcard') ||
			combined.includes('card_number') ||
			combined.includes('cardnum') ||
			combined.includes('ccnum') ||
			combined.includes('pan') ||
			combined.includes('num_carte') ||
			combined.includes('numero_carte') ||
			combined.includes('n_carte') ||
			combined.includes('numcarte') ||
			combined.includes('numerocarte') ||
			combined.includes('num_cib') ||
			combined.includes('num_edahabia') ||
			combined.includes('carte_cib') ||
			combined.includes('carte_edahabia') ||
			combined.includes('baridi') ||
			combined.includes('cib') ||
			combined.includes('edahabia') ||
			combined.includes('بطاقة') ||
			combined.includes('رقم البطاقة') ||
			combined.includes('الذهبية') ||
			combined.includes('بطاقة الائتمان')
		) {
			return 'card_number';
		}

		// 3. Credit Card Expiry Date / Month / Year
		if (
			combined.includes('exp_date') ||
			combined.includes('exp_month') ||
			combined.includes('exp_year') ||
			combined.includes('expiry') ||
			combined.includes('expiration') ||
			combined.includes('mm/yy') ||
			combined.includes('cc-exp') ||
			combined.includes('expm') ||
			combined.includes('expy') ||
			combined.includes('date_exp') ||
			combined.includes('date_expiration') ||
			combined.includes('mois_exp') ||
			combined.includes('annee_exp') ||
			combined.includes('expir') ||
			combined.includes('تاريخ الانتهاء') ||
			combined.includes('تاريخ إنتهاء') ||
			combined.includes('انقضاء')
		) {
			return 'card_exp';
		}

		// 4. Cardholder Name
		if (
			combined.includes('holder') ||
			combined.includes('cardholder') ||
			combined.includes('name_on_card') ||
			combined.includes('cc-name') ||
			combined.includes('nom_porteur') ||
			combined.includes('nom_prenom') ||
			combined.includes('titulaire') ||
			combined.includes('nom_carte') ||
			combined.includes('porteur') ||
			combined.includes('owner_name') ||
			combined.includes('اسم صاحب البطاقة') ||
			combined.includes('اسم حامل البطاقة')
		) {
			return 'card_holder';
		}

		// 5. TOTP / 2FA / Verification code
		if (
			combined.includes('one-time') ||
			combined.includes('totp') ||
			combined.includes('2fa') ||
			combined.includes('mfa') ||
			combined.includes('otp') ||
			combined.includes('verification') ||
			combined.includes('validation') ||
			combined.includes('confirmation') ||
			combined.includes('رمز') ||
			combined.includes('تأكيد') ||
			combined.includes('تفعيل')
		) {
			return 'totp';
		}

		// 6. Password fields
		if (
			type === 'password' ||
			combined.includes('password') ||
			combined.includes('mot_de_passe') ||
			combined.includes('mdp') ||
			combined.includes('code_secret') ||
			combined.includes('كلمة السر') ||
			combined.includes('كلمة المرور') ||
			combined.includes('الرمز السري')
		) {
			return 'password';
		}

		// 7. Username / Email / Login / Account / CCP ID
		if (
			combined.includes('user') ||
			combined.includes('email') ||
			combined.includes('login') ||
			combined.includes('username') ||
			combined.includes('account') ||
			combined.includes('compte') ||
			combined.includes('identifiant') ||
			combined.includes('courriel') ||
			combined.includes('adresse_email') ||
			combined.includes('num_compte') ||
			combined.includes('num_ccp') ||
			combined.includes('rip') ||
			combined.includes('اسم المستخدم') ||
			combined.includes('البريد') ||
			combined.includes('الحساب') ||
			combined.includes('المعرف')
		) {
			return 'username';
		}

		// 8. Personal Information Profile (Address, Phone, Name, City, Identity)
		if (
			combined.includes('address') ||
			combined.includes('city') ||
			combined.includes('zip') ||
			combined.includes('phone') ||
			combined.includes('first-name') ||
			combined.includes('last-name') ||
			combined.includes('passport') ||
			combined.includes('nin') ||
			combined.includes('identity') ||
			combined.includes('adresse') ||
			combined.includes('ville') ||
			combined.includes('code_postal') ||
			combined.includes('telephone') ||
			combined.includes('mobile') ||
			combined.includes('prenom') ||
			combined.includes('nom') ||
			combined.includes('passeport') ||
			combined.includes('n_national') ||
			combined.includes('carte_identite') ||
			combined.includes('العنوان') ||
			combined.includes('المدينة') ||
			combined.includes('الهاتف') ||
			combined.includes('الاسم') ||
			combined.includes('اللقب') ||
			combined.includes('جواز السفر') ||
			combined.includes('رقم التعريف')
		) {
			return 'personal';
		}

		return 'generic';
	}

	// Inject Draggable SafeVault icon badge into input container
	function attachBadge(input) {
		if (input.dataset.safevaultAttached) return;
		input.dataset.safevaultAttached = "true";

		const container = input.parentElement || input.form || document.body;
		if (!container) return;

		// Ensure position scope
		const computedStyle = window.getComputedStyle(container);
		if (computedStyle.position === 'static') {
			container.style.position = 'relative';
		}

		const badge = document.createElement('div');
		badge.className = 'safevault-input-badge';
		badge.title = 'SafeVaultPro Autofill (Click to open, Drag to move)';
		const iconUrl = chrome.runtime.getURL('icon.png');
		badge.innerHTML = `<img src="${iconUrl}" width="16" height="16" alt="SafeVaultPro" style="object-fit: contain; pointer-events: none;">`;

		// Drag state management
		let isDragging = false;
		let startX = 0;
		let startY = 0;
		let initialLeft = 0;
		let initialTop = 0;

		function onPointerDown(e) {
			if (e.button !== 0 && e.pointerType === 'mouse') return; // only left click
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

			setTimeout(() => {
				badge.classList.remove('safevault-dragging');
			}, 50);

			if (!isDragging) {
				e.preventDefault();
				e.stopPropagation();
				toggleDropdown(input, badge);
			}
		}

		badge.addEventListener('pointerdown', onPointerDown);
		container.appendChild(badge);
	}

	// Toggle autofill dropdown menu
	async function toggleDropdown(input, badge) {
		if (activeDropdown) {
			closeDropdown();
			return;
		}

		const fieldType = classifyField(input);

		// Request matched items from service worker
		chrome.runtime.sendMessage(
			{ action: "QUERY_ITEMS", domain: currentDomain, fieldType },
			(response) => {
				if (!response || !response.success) {
					showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro desktop app.", true);
					return;
				}
				if (!response.items || response.items.length === 0) {
					showEmptyDropdown(badge, "No matching vault items for this field/domain.", false);
					return;
				}
				renderDropdownMenu(input, badge, response.items);
			}
		);
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
					<button class="safevault-close-btn" title="Close overlay">&times;</button>
				</div>
			</div>
			<div class="safevault-dropdown-empty">
				<div>${escapeHtml(message)}</div>
				<div class="safevault-dropdown-actions">
					<button class="safevault-action-btn safevault-dismiss-btn">Dismiss</button>
					${isError ? `<button class="safevault-action-btn safevault-retry-btn">Retry</button>` : ''}
				</div>
			</div>
		`;

		dropdown.querySelector('.safevault-close-btn').addEventListener('click', closeDropdown);
		dropdown.querySelector('.safevault-dismiss-btn').addEventListener('click', closeDropdown);
		if (isError) {
			dropdown.querySelector('.safevault-retry-btn')?.addEventListener('click', () => {
				closeDropdown();
			});
		}

		positionDropdown(badge, dropdown);
		document.body.appendChild(dropdown);
		activeDropdown = dropdown;
	}

	function renderDropdownMenu(input, badge, items) {
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
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}" data-type="personal">
						<div class="safevault-item-icon">👤</div>
						<div class="safevault-item-details">
							<div class="safevault-item-title">${escapeHtml(item.fullName)}</div>
							<div class="safevault-item-sub">${escapeHtml(item.email || item.city || 'Personal Identity')}</div>
						</div>
						<span class="safevault-fill-btn">Fill Info</span>
					</div>
				`;
			}
		});

		dropdown.innerHTML = `
			<div class="safevault-dropdown-header">
				<span class="safevault-brand">SafeVaultPro</span>
				<div class="safevault-header-right">
					<span class="safevault-badge-count">${items.length} item${items.length === 1 ? '' : 's'}</span>
					<button class="safevault-close-btn" title="Close overlay">&times;</button>
				</div>
			</div>
			<div class="safevault-dropdown-list">${itemsHtml}</div>
		`;

		dropdown.querySelector('.safevault-close-btn').addEventListener('click', closeDropdown);

		dropdown.addEventListener('click', (e) => {
			const itemElem = e.target.closest('.safevault-dropdown-item');
			if (!itemElem) return;
			const id = itemElem.dataset.id;
			const targetItem = items.find((i) => i.id === id);
			if (!targetItem) return;

			autofillItem(input, targetItem);
			closeDropdown();
		});

		positionDropdown(badge, dropdown);
		document.body.appendChild(dropdown);
		activeDropdown = dropdown;
	}

	function positionDropdown(badge, dropdown) {
		const rect = badge.getBoundingClientRect();
		dropdown.style.position = 'fixed';
		dropdown.style.top = `${Math.min(window.innerHeight - 300, rect.bottom + 6)}px`;
		dropdown.style.left = `${Math.max(10, Math.min(window.innerWidth - 310, rect.left - 180))}px`;
		dropdown.style.zIndex = '999999';
	}

	// Smart Multilingual Form Autofill Engine
	function autofillItem(targetInput, item) {
		const form = targetInput.form || targetInput.closest('form') || document.body;

		if (item.type === 'password') {
			// Find password and username fields
			const passFields = form.querySelectorAll('input[type="password"]');
			const userFields = form.querySelectorAll('input[type="text"], input[type="email"]');

			if (passFields.length > 0) setNativeFieldValue(passFields[0], item.password);
			if (userFields.length > 0 && item.username) setNativeFieldValue(userFields[0], item.username);
		} else if (item.type === 'totp') {
			// Request live TOTP code from service worker
			chrome.runtime.sendMessage({ action: "GET_TOTP", secret: item.secret }, (res) => {
				if (res && res.success && res.code) {
					setNativeFieldValue(targetInput, res.code);
				}
			});
		} else if (item.type === 'card') {
			const cvvVal = item.cvv || item.pin || '';
			const holderVal = item.cardholderName || '';
			const numVal = item.number || '';
			const expVal = item.expirationDate || '';

			// 1. Direct assignment to focused input if targetInput is a specific field
			const fieldType = classifyField(targetInput);
			if (fieldType === 'card_cvv' && cvvVal) {
				setNativeFieldValue(targetInput, cvvVal);
			} else if (fieldType === 'card_holder' && holderVal) {
				setNativeFieldValue(targetInput, holderVal);
			} else if (fieldType === 'card_number' && numVal) {
				setNativeFieldValue(targetInput, numVal);
			} else if (fieldType === 'card_exp' && expVal) {
				setNativeFieldValue(targetInput, expVal);
			}

			// 2. Broad form assignment for all credit card inputs
			// Find Card Number field
			const cardNumField = form.querySelector(
				'input[name*="carte"], input[id*="carte"], input[name*="card"], input[id*="card"], input[name*="pan"], input[id*="pan"], input[name*="cib"], input[name*="edahabia"], input[name*="num"], input[autocomplete="cc-number"]'
			) || targetInput;

			// Find CVV / CVC / CVP / Cryptogramme field
			const cvvField = form.querySelector(
				'input[name*="cvv"], input[name*="cvc"], input[name*="cvp"], input[name*="crypto"], input[name*="secu"], input[name*="verification"], input[id*="cvv"], input[id*="cvc"], input[id*="cvp"], input[id*="crypto"], input[id*="secu"], input[placeholder*="cvv" i], input[placeholder*="cvc" i], input[placeholder*="crypto" i], input[autocomplete="cc-csc"]'
			);

			// Find Cardholder Name field
			const holderField = form.querySelector(
				'input[name*="holder"], input[name*="titulaire"], input[name*="porteur"], input[name*="owner"], input[name*="nom"], input[id*="holder"], input[id*="titulaire"], input[id*="porteur"], input[id*="nom"], input[autocomplete="cc-name"]'
			);

			if (cardNumField && numVal) setNativeFieldValue(cardNumField, numVal);
			if (cvvField && cvvVal) setNativeFieldValue(cvvField, cvvVal);
			if (holderField && holderVal) setNativeFieldValue(holderField, holderVal);

			// Handle Expiration Date (Single input vs separate Month/Year dropdowns)
			if (expVal) {
				const expField = form.querySelector(
					'input[name*="exp"], input[name*="date"], input[id*="exp"], input[id*="date"], input[autocomplete="cc-exp"]'
				);
				if (expField) {
					setNativeFieldValue(expField, expVal);
				}

				// Separate Month / Year fields
				const parts = expVal.split('/');
				if (parts.length === 2) {
					const monthStr = parts[0].padStart(2, '0');
					const yearStr = parts[1].length === 2 ? `20${parts[1]}` : parts[1];

					const monthField = form.querySelector('select[name*="month"], select[name*="mois"], select[id*="month"], select[id*="mois"], input[name*="month"], input[name*="mois"], input[autocomplete="cc-exp-month"]');
					const yearField = form.querySelector('select[name*="year"], select[name*="annee"], select[id*="year"], select[id*="annee"], input[name*="year"], input[name*="annee"], input[autocomplete="cc-exp-year"]');

					if (monthField) setNativeFieldValue(monthField, monthStr);
					if (yearField) setNativeFieldValue(yearField, yearStr);
				}
			}
		} else if (item.type === 'personal_info') {
			const nameField = form.querySelector('input[name*="name"], input[name*="nom"], input[name*="prenom"], input[autocomplete="name"]');
			const emailField = form.querySelector('input[name*="email"], input[name*="courriel"], input[type="email"]');
			const phoneField = form.querySelector('input[name*="phone"], input[name*="tele"], input[name*="mobile"], input[type="tel"]');

			if (nameField && item.fullName) setNativeFieldValue(nameField, item.fullName);
			if (emailField && item.email) setNativeFieldValue(emailField, item.email);
			if (phoneField && item.phone) setNativeFieldValue(phoneField, item.phone);
		}
	}

	function escapeHtml(str) {
		if (!str) return '';
		return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	// Document event listeners for field scan
	function scanAndAttach() {
		const inputs = document.querySelectorAll(
			'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'
		);
		inputs.forEach((input) => {
			const classification = classifyField(input);
			if (classification !== 'generic') {
				attachBadge(input);
			}
		});
	}

	document.addEventListener('focusin', (e) => {
		if (e.target && e.target.tagName === 'INPUT') {
			scanAndAttach();
		}
	});

	// Global event listener to dismiss dropdown on click outside or Escape key
	document.addEventListener('click', (e) => {
		if (
			activeDropdown &&
			!e.target.closest('.safevault-dropdown-menu') &&
			!e.target.closest('.safevault-input-badge')
		) {
			closeDropdown();
		}
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && activeDropdown) {
			closeDropdown();
		}
	});

	// Initial scan
	setTimeout(scanAndAttach, 800);
})();
