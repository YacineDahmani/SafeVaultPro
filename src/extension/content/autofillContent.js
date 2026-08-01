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

	function getFieldLabelText(input) {
		let text = '';
		try {
			if (input.id) {
				const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
				if (label) text += label.textContent + ' ';
			}
			const parentLabel = input.closest('label');
			if (parentLabel) text += parentLabel.textContent + ' ';

			// Table Row / Cell inspection (Handles ECCP, SATIM, CIB, BaridiMob payment tables)
			const tr = input.closest('tr');
			if (tr) {
				text += tr.textContent + ' ';
			}
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
				if (prev) text += prev.textContent + ' ';
			}
		} catch (e) {}
		return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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

		// 1. Credit Card CVV / CVC / CVP / CVW / Cryptogramme
		if (
			combined.includes('cvv') ||
			combined.includes('cvc') ||
			combined.includes('cvw') ||
			combined.includes('cvp') ||
			combined.includes('security-code') ||
			combined.includes('cvv2') ||
			combined.includes('cvc2') ||
			combined.includes('cvw2') ||
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

		// 4. Cardholder Name (Nom et Prenom / Titulaire)
		const labelText = getFieldLabelText(input);
		if (
			combined.includes('holder') ||
			combined.includes('cardholder') ||
			combined.includes('name_on_card') ||
			combined.includes('cc-name') ||
			combined.includes('nom_porteur') ||
			combined.includes('nom_prenom') ||
			combined.includes('nomprenom') ||
			combined.includes('nom_p') ||
			combined.includes('titulaire') ||
			combined.includes('nom_carte') ||
			combined.includes('porteur') ||
			combined.includes('owner_name') ||
			combined.includes('nom') ||
			combined.includes('prenom') ||
			combined.includes('اسم صاحب البطاقة') ||
			combined.includes('اسم حامل البطاقة') ||
			labelText.includes('nom et prenom') ||
			labelText.includes('nom & prenom') ||
			labelText.includes('nom prenom') ||
			labelText.includes('titulaire') ||
			labelText.includes('porteur') ||
			labelText.includes('cardholder') ||
			labelText.includes('name on card')
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
		badge.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`;

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
				badge.style.margin = '0';
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

		if (input.type === 'password') {
			itemsHtml += `
				<div class="safevault-dropdown-item safevault-gen-action" data-action="generate">
					<div class="safevault-item-icon">⚡</div>
					<div class="safevault-item-details">
						<div class="safevault-item-title" style="color:#34d399;">Generate Strong Password</div>
						<div class="safevault-item-sub">Create & fill secure 20-char password</div>
					</div>
					<span class="safevault-fill-btn">Generate</span>
				</div>
			`;
		}

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

			if (itemElem.dataset.action === 'generate') {
				closeDropdown();
				chrome.runtime.sendMessage({ action: "GENERATE_PASSWORD", length: 20, uppercase: true, numbers: true, symbols: true }, (res) => {
					if (res && res.success && res.password) {
						setNativeFieldValue(input, res.password);
						const form = input.form || input.closest('form');
						if (form) {
							const passFields = Array.from(form.querySelectorAll('input[type="password"]'));
							passFields.forEach((pField) => setNativeFieldValue(pField, res.password));
						}
						showToastBanner(`⚡ Generated & filled strong password!`);
					}
				});
				return;
			}

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
			const holderVal = item.cardholderName || item.fullName || item.title || '';
			const numVal = item.number || '';
			const expVal = item.expirationDate || '';

			const container = targetInput.form || targetInput.closest('form') || document;
			const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select'));

			// 1. Fill Card Number field
			const cardNumInput = inputs.find(i => classifyField(i) === 'card_number') || targetInput;
			if (cardNumInput && numVal) {
				setNativeFieldValue(cardNumInput, numVal);
			}

			// 2. Fill CVV / CVC / CVW field (guarded to NEVER put card number into CVV)
			const cvvInput = inputs.find(i => i !== cardNumInput && (classifyField(i) === 'card_cvv' || (i.name || i.id || i.placeholder || '').toLowerCase().match(/cvv|cvc|cvw|crypto|secu/)));
			if (cvvInput && cvvVal && cvvInput !== cardNumInput) {
				setNativeFieldValue(cvvInput, cvvVal);
			}

			// 3. Fill Cardholder Name field ("Nom et Prenom" / "Titulaire")
			let holderInput = inputs.find(i => {
				if (i === cardNumInput || i === cvvInput) return false;
				if (i.tagName !== 'INPUT') return false;
				const iType = (i.type || '').toLowerCase();
				if (iType && iType !== 'text' && iType !== 'string' && iType !== 'search') return false;

				const labelText = getFieldLabelText(i);
				const attr = `${i.name || ''} ${i.id || ''} ${i.placeholder || ''} ${i.className || ''}`.toLowerCase();
				const norm = (attr + ' ' + labelText).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

				return (
					classifyField(i) === 'card_holder' ||
					norm.includes('nom') ||
					norm.includes('prenom') ||
					norm.includes('holder') ||
					norm.includes('titulaire') ||
					norm.includes('porteur') ||
					norm.includes('owner') ||
					norm.includes('name')
				);
			});

			// Fallback for Cardholder Name: First remaining text input in the form container that is not cardNumInput, not cvvInput
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

			// 4. Fill Expiration Date (Single input vs separate Month/Year dropdowns)
			if (expVal) {
				const parts = expVal.split('/');
				const monthVal = parts[0] ? parts[0].padStart(2, '0') : '';
				let yearVal = parts[1] || '';
				const fullYearVal = yearVal.length === 2 ? `20${yearVal}` : yearVal;
				const shortYearVal = yearVal.length === 4 ? yearVal.slice(-2) : yearVal;

				// Single Expiration Date input
				const expInput = inputs.find(i => classifyField(i) === 'card_exp' && i.tagName === 'INPUT');
				if (expInput) {
					setNativeFieldValue(expInput, expVal);
				}

				// Separate Month Select or Input
				const monthInput = inputs.find(i => i !== cardNumInput && i !== holderInput && i !== cvvInput && ((i.name || i.id || '').toLowerCase().match(/month|mois|expm/) || (i.tagName === 'SELECT')));
				if (monthInput) {
					if (monthInput.tagName === 'SELECT') {
						const options = Array.from(monthInput.options);
						const matchedOpt = options.find(opt => {
							const val = (opt.value || '').trim();
							const txt = (opt.text || '').trim();
							return val === monthVal || val === String(parseInt(monthVal, 10)) || txt.startsWith(monthVal) || txt.startsWith(String(parseInt(monthVal, 10)));
						});
						if (matchedOpt) {
							monthInput.value = matchedOpt.value;
							monthInput.dispatchEvent(new Event('change', { bubbles: true }));
						}
					} else {
						setNativeFieldValue(monthInput, monthVal);
					}
				}

				// Separate Year Select or Input
				const yearInput = inputs.find(i => i !== cardNumInput && i !== holderInput && i !== cvvInput && i !== monthInput && ((i.name || i.id || '').toLowerCase().match(/year|annee|expy/) || (i.tagName === 'SELECT')));
				if (yearInput) {
					if (yearInput.tagName === 'SELECT') {
						const options = Array.from(yearInput.options);
						const matchedOpt = options.find(opt => {
							const val = (opt.value || '').trim();
							const txt = (opt.text || '').trim();
							return val === fullYearVal || val === shortYearVal || txt.includes(fullYearVal) || txt.includes(shortYearVal);
						});
						if (matchedOpt) {
							yearInput.value = matchedOpt.value;
							yearInput.dispatchEvent(new Event('change', { bubbles: true }));
						}
					} else {
						setNativeFieldValue(yearInput, fullYearVal);
					}
				}
			}
		} else if (item.type === 'personal_info') {
			const container = targetInput.form || targetInput.closest('form') || document;
			const inputs = Array.from(container.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select'));

			const getVal = (f) => (f || '').trim();

			inputs.forEach((field) => {
				const attr = `${field.name || ''} ${field.id || ''} ${field.placeholder || ''} ${field.getAttribute('aria-label') || ''} ${field.autocomplete || ''} ${field.type || ''}`.toLowerCase();

				if (attr.includes('first-name') || attr.includes('firstname') || attr.includes('first_name') || attr.includes('prenom') || attr.includes('fname')) {
					if (item.firstName) setNativeFieldValue(field, item.firstName);
				} else if (attr.includes('last-name') || attr.includes('lastname') || attr.includes('last_name') || attr.includes('lname') || attr.includes('family_name')) {
					if (item.lastName) setNativeFieldValue(field, item.lastName);
				} else if (attr.includes('full-name') || attr.includes('fullname') || attr.includes('full_name') || attr.includes('nom_prenom') || (attr.includes('name') && !attr.includes('user') && !attr.includes('card'))) {
					if (item.fullName || (item.firstName && item.lastName)) setNativeFieldValue(field, item.fullName || `${item.firstName} ${item.lastName}`);
				} else if (attr.includes('birth') || attr.includes('dob') || attr.includes('birthdate') || attr.includes('date_naissance')) {
					if (item.birthDate) setNativeFieldValue(field, item.birthDate);
				} else if (attr.includes('gender') || attr.includes('sexe')) {
					if (item.gender) setNativeFieldValue(field, item.gender);
				} else if (attr.includes('age')) {
					if (item.age) setNativeFieldValue(field, String(item.age));
				} else if (attr.includes('passport') || attr.includes('nin') || attr.includes('national_id') || attr.includes('carte_identite') || attr.includes('identity')) {
					if (item.nationalId) setNativeFieldValue(field, item.nationalId);
				} else if (attr.includes('email') || attr.includes('courriel') || field.type === 'email') {
					if (item.email) setNativeFieldValue(field, item.email);
				} else if (attr.includes('phone') || attr.includes('tele') || attr.includes('mobile') || field.type === 'tel') {
					if (item.phone) setNativeFieldValue(field, item.phone);
				} else if (attr.includes('address') || attr.includes('adresse') || attr.includes('street')) {
					if (item.addressLine1) setNativeFieldValue(field, item.addressLine1);
				} else if (attr.includes('city') || attr.includes('ville')) {
					if (item.city) setNativeFieldValue(field, item.city);
				} else if (attr.includes('state') || attr.includes('province') || attr.includes('wilaya')) {
					if (item.stateProvince) setNativeFieldValue(field, item.stateProvince);
				} else if (attr.includes('zip') || attr.includes('postal') || attr.includes('code_postal')) {
					if (item.postalCode) setNativeFieldValue(field, item.postalCode);
				} else if (attr.includes('country') || attr.includes('pays')) {
					if (item.country) setNativeFieldValue(field, item.country);
				}
			});
		}
	}

	function escapeHtml(str) {
		if (!str) return '';
		return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	// Helper to display on-page notification toast for extension events
	function showToastBanner(message) {
		const existing = document.querySelector('.safevault-toast-banner');
		if (existing) existing.remove();

		const toast = document.createElement('div');
		toast.className = 'safevault-toast-banner';
		toast.innerHTML = `
			<div class="safevault-toast-icon">✓</div>
			<div style="color:#f4f4f5; font-size:11px; font-weight:500; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(message)}</div>
		`;
		document.body.appendChild(toast);
		setTimeout(() => {
			toast.style.opacity = '0';
			toast.style.transform = 'translateY(8px)';
			toast.style.transition = 'all 0.25s ease';
			setTimeout(() => toast.remove(), 250);
		}, 3000);
	}

	// Smart Multilingual Registration / Sign Up Form Classifier
	function isRegistrationForm(input, form) {
		if (!input) return false;
		if (input.type !== 'password') return false;

		const inputAutoComplete = (input.autocomplete || '').toLowerCase();
		const inputAttr = `${input.name || ''} ${input.id || ''} ${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`.toLowerCase();

		// 1. Explicit negative check: Login / current password fields are NEVER registration fields
		if (
			inputAutoComplete === 'current-password' ||
			inputAttr.includes('current-password') ||
			inputAttr.includes('current_password') ||
			inputAttr.includes('old_password') ||
			inputAttr.includes('old-password') ||
			inputAttr.includes('login_password') ||
			inputAttr.includes('login-password') ||
			inputAttr.includes('user_password') ||
			inputAttr.includes('auth_password') ||
			inputAttr.includes('signin')
		) {
			return false;
		}

		const formElem = form || input.form || input.closest('form');

		// 2. Explicit positive checks: New password or confirmation attributes
		if (
			inputAutoComplete === 'new-password' ||
			inputAttr.includes('new-password') ||
			inputAttr.includes('new_password') ||
			inputAttr.includes('newpassword') ||
			inputAttr.includes('create_password') ||
			inputAttr.includes('create-password') ||
			inputAttr.includes('signup_password') ||
			inputAttr.includes('register_password') ||
			inputAttr.includes('confirm') ||
			inputAttr.includes('verify') ||
			inputAttr.includes('repeat')
		) {
			return true;
		}

		// 3. Form-level inspection
		if (formElem) {
			const passInputs = Array.from(formElem.querySelectorAll('input[type="password"]'));
			
			// If form has 2 or more password fields (Password + Confirm Password)
			if (passInputs.length >= 2) {
				return true;
			}

			// Check submit button or form action explicitly
			const submitBtn = formElem.querySelector('button[type="submit"], input[type="submit"], button');
			const submitText = submitBtn ? (submitBtn.textContent || submitBtn.value || '').toLowerCase() : '';
			const formAction = (formElem.action || '').toLowerCase();
			const formId = (formElem.id || formElem.name || '').toLowerCase();

			const isRegisterSubmit = [
				'register', 'signup', 'sign-up', 'create account', 'create_account',
				's\'inscrire', 'creer compte', 'إنشاء حساب', 'تسجيل حساب'
			].some(kw => submitText.includes(kw) || formAction.includes(kw) || formId.includes(kw));

			const isLoginSubmit = [
				'login', 'log in', 'sign in', 'signin', 'connexion', 'تسجيل الدخول'
			].some(kw => submitText.includes(kw) || formAction.includes(kw) || formId.includes(kw));

			if (isRegisterSubmit && !isLoginSubmit) {
				return true;
			}
		}

		return false;
	}

	// Attach Password Suggestion Badge for Registration Forms
	function attachRegistrationSuggestionBadge(input) {
		if (input.dataset.safevaultSuggestAttached) return;
		input.dataset.safevaultSuggestAttached = "true";

		const form = input.form || input.closest('form') || input.parentElement;
		if (!form) return;

		const btn = document.createElement('div');
		btn.className = 'safevault-register-badge';
		btn.title = 'SafeVaultPro: Click to generate, fill, and save strong password directly to app';
		btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> <span>Suggest Strong Password</span>`;

		btn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();

			chrome.runtime.sendMessage({ action: "GENERATE_PASSWORD", length: 20, uppercase: true, numbers: true, symbols: true }, (res) => {
				if (res && res.success && res.password) {
					const generatedPass = res.password;

					// 1. Fill primary password field
					setNativeFieldValue(input, generatedPass);

					// 2. Find and fill confirmation password field if present
					if (form) {
						const passFields = Array.from(form.querySelectorAll('input[type="password"]'));
						passFields.forEach((pField) => {
							setNativeFieldValue(pField, generatedPass);
						});
					}

					// 3. Find username / email field value
					const userField = form
						? form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="email"], input[id*="user"], input[id*="email"]')
						: null;
					const usernameVal = userField ? userField.value : '';

					// Store draft for submission
					if (form) {
						form.dataset.safevaultCapturedPass = generatedPass;
						if (usernameVal) form.dataset.safevaultCapturedUser = usernameVal;
					}

					// 4. DIRECT AUTO-SAVE TO SAFEVAULTPRO DESKTOP APP IMMEDIATELY
					const title = `${currentDomain} Account`;
					chrome.runtime.sendMessage(
						{
							action: "SAVE_PASSWORD",
							id: form?.dataset.safevaultItemId,
							title,
							username: usernameVal,
							password: generatedPass,
							url: window.location.href,
							notes: `Automatically generated & saved from registration form on ${currentDomain}.`,
						},
						(saveRes) => {
							if (saveRes && saveRes.success && saveRes.item) {
								if (form) form.dataset.safevaultItemId = saveRes.item.id;
								showToastBanner(`🔒 Strong password saved to SafeVaultPro!`);
							} else {
								showToastBanner(`✨ Filled strong password! Submit form to save.`);
							}
						}
					);

					// 5. Watch username field changes to automatically update saved item in SafeVaultPro
					if (userField && !userField.dataset.safevaultUserWatchAttached) {
						userField.dataset.safevaultUserWatchAttached = "true";
						const updateSavedUsername = () => {
							const currentPass = form ? (form.dataset.safevaultCapturedPass || input.value) : input.value;
							const updatedUser = userField.value;
							if (currentPass && updatedUser) {
								chrome.runtime.sendMessage({
									action: "SAVE_PASSWORD",
									id: form?.dataset.safevaultItemId,
									title,
									username: updatedUser,
									password: currentPass,
									url: window.location.href,
									notes: `Automatically generated & saved from registration form on ${currentDomain}.`,
								}, (upRes) => {
									if (upRes && upRes.success && upRes.item && form) {
										form.dataset.safevaultItemId = upRes.item.id;
									}
								});
							}
						};

						userField.addEventListener('blur', updateSavedUsername);
						userField.addEventListener('change', updateSavedUsername);
					}
				}
			});
		});

		// Attach after input field
		const parent = input.parentElement || form;
		if (parent) {
			parent.appendChild(btn);
		}
	}

	// Auto-Save Form Submit Handler & Click Interceptor
	function setupAutoSaveSubmitListener() {
		const triggerSaveFromForm = (form) => {
			if (!form) return;

			// Extract captured or entered credentials from form
			const passInputs = Array.from(form.querySelectorAll('input[type="password"]'));
			const userInput = form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="email"]');

			const passVal = form.dataset.safevaultCapturedPass || (passInputs.length > 0 ? passInputs[0].value : '');
			const userVal = form.dataset.safevaultCapturedUser || (userInput ? userInput.value : '');

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
						notes: `Automatically captured from registration/login form on ${currentDomain}.`,
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

		// Listener 1: Standard form submit
		document.addEventListener('submit', (e) => {
			const form = e.target;
			if (form && form instanceof HTMLFormElement) {
				triggerSaveFromForm(form);
			}
		}, true);

		// Listener 2: Click on submit/register buttons (for SPAs & AJAX forms)
		document.addEventListener('click', (e) => {
			const target = e.target.closest('button, input[type="submit"], input[type="button"], .btn');
			if (!target) return;

			const btnText = (target.textContent || target.value || '').toLowerCase();
			const isRegisterBtn = target.type === 'submit' || [
				'register', 'signup', 'sign-up', 'join', 'create', 'submit', 's\'inscrire', 'إنشاء'
			].some(kw => btnText.includes(kw));

			if (isRegisterBtn) {
				const form = target.form || target.closest('form') || target.closest('div');
				if (form) {
					setTimeout(() => triggerSaveFromForm(form), 100);
				}
			}
		}, true);
	}

	// Document event listeners for field scan
	function scanAndAttach() {
		const inputs = document.querySelectorAll(
			'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'
		);
		inputs.forEach((input) => {
			const classification = classifyField(input);
			// For payment card fields, ONLY attach badge to card_number field
			if (classification === 'card_cvv' || classification === 'card_holder' || classification === 'card_exp') {
				return;
			}
			if (classification !== 'generic') {
				attachBadge(input);
			}

			// Check registration form for password suggestion badge (only attach to primary password field in registration form)
			if (input.type === 'password' && isRegistrationForm(input)) {
				const form = input.form || input.closest('form');
				if (form) {
					const passInputs = Array.from(form.querySelectorAll('input[type="password"]'));
					if (passInputs.length === 0 || passInputs[0] === input) {
						attachRegistrationSuggestionBadge(input);
					}
				} else {
					attachRegistrationSuggestionBadge(input);
				}
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

	// Initialize auto-save submit listener & initial scan
	setupAutoSaveSubmitListener();
	setTimeout(scanAndAttach, 800);
})();
