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

	// Toggle autofill dropdown menu - Context Aware (Login vs Register)
	async function toggleDropdown(input, badge) {
		if (activeDropdown) {
			closeDropdown();
			return;
		}

		const isRegister = isRegistrationForm(input);
		const fieldType = classifyField(input);

		if (isRegister) {
			// =========================================================================
			// 1. REGISTRATION PAGE CONTEXT
			// =========================================================================
			if (input.type === 'password' || fieldType === 'password') {
				// Password field on Register page: Offer ONLY password generation
				renderRegisterPasswordDropdown(input, badge);
			} else {
				// Email / Username / Identity field on Register page: Fetch Personal Information
				chrome.runtime.sendMessage(
					{ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "personal" },
					(response) => {
						const items = (response && response.success && Array.isArray(response.items)) ? response.items : [];
						if (items.length === 0) {
							// Query overall items if specific personal query yields empty
							chrome.runtime.sendMessage(
								{ action: "QUERY_ITEMS", domain: currentDomain },
								(resp) => {
									const allPersonal = (resp?.items || []).filter(i => i.type === 'personal_info' || i.type === 'identity');
									renderRegisterIdentityDropdown(input, badge, allPersonal);
								}
							);
						} else {
							renderRegisterIdentityDropdown(input, badge, items);
						}
					}
				);
			}
		} else {
			// =========================================================================
			// 2. LOGIN PAGE CONTEXT
			// =========================================================================
			// DO NOT suggest generating passwords on login pages! Only fetch saved credentials matching domain
			chrome.runtime.sendMessage(
				{ action: "QUERY_ITEMS", domain: currentDomain, fieldType: "password", type: "password" },
				(response) => {
					if (!response || !response.success) {
						showEmptyDropdown(badge, response?.error || "Disconnected from SafeVaultPro app.", true);
						return;
					}

					// Filter items strictly to saved logins for this domain
					const matchedLogins = (response.items || []).filter(i => i.type === 'password');

					if (matchedLogins.length === 0) {
						showEmptyDropdown(badge, `No saved credentials for ${currentDomain}`, false);
						return;
					}

					renderLoginDropdownMenu(input, badge, matchedLogins);
				}
			);
		}
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

	// Dropdown Renderer: Registration Password Field (Generate Only)
	function renderRegisterPasswordDropdown(input, badge) {
		closeDropdown();
		const dropdown = document.createElement('div');
		dropdown.className = 'safevault-dropdown-menu';
		dropdown.innerHTML = `
			<div class="safevault-dropdown-header">
				<span class="safevault-brand">SafeVaultPro • New Password</span>
				<div class="safevault-header-right">
					<button class="safevault-close-btn" title="Close overlay">&times;</button>
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
							passFields.forEach((pField) => setNativeFieldValue(pField, generatedPass));
						}

						const userField = form
							? form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="email"]')
							: null;
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

	// Dropdown Renderer: Registration Identity / Email Field (Fetch Personal Info)
	function renderRegisterIdentityDropdown(input, badge, items) {
		closeDropdown();
		const dropdown = document.createElement('div');
		dropdown.className = 'safevault-dropdown-menu';

		let itemsHtml = '';
		if (items.length === 0) {
			itemsHtml = `
				<div class="safevault-dropdown-empty">
					<div>No personal profile saved in SafeVaultPro.</div>
				</div>
			`;
		} else {
			items.forEach((item) => {
				const emailVal = item.email || item.username || '';
				const nameVal = item.fullName || item.title || 'Personal Profile';
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}">
						<div class="safevault-item-icon">👤</div>
						<div class="safevault-item-details">
							<div class="safevault-item-title">${escapeHtml(nameVal)}</div>
							<div class="safevault-item-sub">${escapeHtml(emailVal || 'Select to fill identity')}</div>
						</div>
						<span class="safevault-fill-btn">Fill Info</span>
					</div>
				`;
			});
		}

		dropdown.innerHTML = `
			<div class="safevault-dropdown-header">
				<span class="safevault-brand">SafeVaultPro • Identity</span>
				<div class="safevault-header-right">
					<button class="safevault-close-btn" title="Close overlay">&times;</button>
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
				showToastBanner(`👤 Filled personal details!`);
			}
			closeDropdown();
		});

		positionDropdown(badge, dropdown);
		document.body.appendChild(dropdown);
		activeDropdown = dropdown;
	}

	// Dropdown Renderer: Login Page Saved Logins (Domain Matched Only)
	function renderLoginDropdownMenu(input, badge, items) {
		closeDropdown();
		const dropdown = document.createElement('div');
		dropdown.className = 'safevault-dropdown-menu';

		let itemsHtml = '';
		items.forEach((item) => {
			itemsHtml += `
				<div class="safevault-dropdown-item" data-id="${item.id}">
					<div class="safevault-item-icon">🔑</div>
					<div class="safevault-item-details">
						<div class="safevault-item-title">${escapeHtml(item.title)}</div>
						<div class="safevault-item-sub">${escapeHtml(item.username || 'No username')}</div>
					</div>
					<span class="safevault-fill-btn">Autofill</span>
				</div>
			`;
		});

		dropdown.innerHTML = `
			<div class="safevault-dropdown-header">
				<span class="safevault-brand">SafeVaultPro • Saved Logins</span>
				<div class="safevault-header-right">
					<span class="safevault-badge-count">${items.length}</span>
					<button class="safevault-close-btn" title="Close overlay">&times;</button>
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
				showToastBanner(`🔑 Credentials filled!`);
			}
			closeDropdown();
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
					if (item.email || item.username) setNativeFieldValue(field, item.email || item.username);
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

			// If target input was not populated by attribute match, set its value to email/fullName
			if (!targetInput.value) {
				if (item.email) setNativeFieldValue(targetInput, item.email);
				else if (item.fullName) setNativeFieldValue(targetInput, item.fullName);
			}
		}
	}

	function escapeHtml(str) {
		if (!str) return '';
		return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	// Helper to display ultra-compact micro notification toast
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

	// Smart Multilingual Registration / Sign Up Form Classifier
	function isRegistrationForm(input, form) {
		if (!input) return false;

		const formElem = form || input.form || input.closest('form');
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
			inputAttr.includes('verify_password') ||
			inputAttr.includes('repeat')
		) {
			return true;
		}

		// 3. Form & Page Context Inspection
		const pageUrl = window.location.href.toLowerCase();
		const pageTitle = document.title.toLowerCase();
		const formHtml = formElem ? (formElem.action + ' ' + (formElem.id || '') + ' ' + (formElem.name || '') + ' ' + (formElem.className || '')).toLowerCase() : '';
		const submitBtn = formElem ? formElem.querySelector('button[type="submit"], input[type="submit"], button') : null;
		const submitText = submitBtn ? (submitBtn.textContent || submitBtn.value || '').toLowerCase() : '';

		const isRegisterContext = [
			'register', 'signup', 'sign-up', 'create account', 'create_account',
			's\'inscrire', 'creer compte', 'إنشاء حساب', 'تسجيل حساب'
		].some(kw => pageUrl.includes(kw) || pageTitle.includes(kw) || formHtml.includes(kw) || submitText.includes(kw));

		const isLoginContext = [
			'login', 'log in', 'log-in', 'sign in', 'signin', 'connexion', 'تسجيل الدخول'
		].some(kw => pageUrl.includes(kw) || pageTitle.includes(kw) || formHtml.includes(kw) || submitText.includes(kw));

		if (isRegisterContext && !isLoginContext) {
			return true;
		}

		// 4. Form-level multi password check (Password + Confirm Password)
		if (formElem) {
			const passInputs = Array.from(formElem.querySelectorAll('input[type="password"]'));
			if (passInputs.length >= 2) {
				return true;
			}
		}

		return false;
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
