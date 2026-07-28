(function () {
	let activeDropdown = null;
	let currentDomain = window.location.hostname;

	// Helper to send native event triggers so React/Vue state updates
	function setNativeFieldValue(field, val) {
		if (!field) return;
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
		if (valueSetter) {
			valueSetter.call(field, val);
		} else {
			field.value = val;
		}
		field.dispatchEvent(new Event('input', { bubbles: true }));
		field.dispatchEvent(new Event('change', { bubbles: true }));
		field.dispatchEvent(new Event('blur', { bubbles: true }));
	}

	// Detect form fields on the page
	function classifyField(input) {
		const name = (input.name || '').toLowerCase();
		const id = (input.id || '').toLowerCase();
		const placeholder = (input.placeholder || '').toLowerCase();
		const autocomplete = (input.autocomplete || '').toLowerCase();
		const type = (input.type || '').toLowerCase();

		const combined = `${name} ${id} ${placeholder} ${autocomplete} ${type}`;

		if (type === 'password') return 'password';
		if (combined.includes('one-time') || combined.includes('totp') || combined.includes('2fa') || combined.includes('code') || combined.includes('otp')) return 'totp';
		if (combined.includes('cardnumber') || combined.includes('card-number') || combined.includes('cc-number') || combined.includes('creditcard')) return 'card_number';
		if (combined.includes('cvv') || combined.includes('cvc') || combined.includes('security-code')) return 'card_cvv';
		if (combined.includes('user') || combined.includes('email') || combined.includes('login') || combined.includes('username')) return 'username';
		if (combined.includes('address') || combined.includes('city') || combined.includes('zip') || combined.includes('phone') || combined.includes('first-name') || combined.includes('last-name')) return 'personal';

		return 'generic';
	}

	// Inject SafeVault icon badge into input field
	function attachBadge(input) {
		if (input.dataset.safevaultAttached) return;
		input.dataset.safevaultAttached = "true";

		const container = input.parentElement;
		if (!container) return;

		// Ensure container positioning
		const computedStyle = window.getComputedStyle(container);
		if (computedStyle.position === 'static') {
			container.style.position = 'relative';
		}

		const badge = document.createElement('div');
		badge.className = 'safevault-input-badge';
		badge.title = 'SafeVaultPro Autofill';
		badge.innerHTML = `
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
			</svg>
		`;

		badge.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			toggleDropdown(input, badge);
		});

		container.appendChild(badge);
	}

	// Toggle autofill dropdown menu
	async function toggleDropdown(input, badge) {
		closeDropdown();

		// Request matched items from service worker
		chrome.runtime.sendMessage(
			{ action: "QUERY_ITEMS", domain: currentDomain },
			(response) => {
				if (!response || !response.success || !response.items || response.items.length === 0) {
					showEmptyDropdown(badge, response?.error || "No matching vault items for this site.");
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

	function showEmptyDropdown(badge, message) {
		const dropdown = document.createElement('div');
		dropdown.className = 'safevault-dropdown-menu';
		dropdown.innerHTML = `
			<div class="safevault-dropdown-header">
				<span class="safevault-brand">SafeVaultPro</span>
			</div>
			<div class="safevault-dropdown-empty">${message}</div>
		`;
		positionDropdown(badge, dropdown);
		document.body.appendChild(dropdown);
		activeDropdown = dropdown;
	}

	function renderDropdownMenu(input, badge, items) {
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
				itemsHtml += `
					<div class="safevault-dropdown-item" data-id="${item.id}" data-type="card">
						<div class="safevault-item-icon">💳</div>
						<div class="safevault-item-details">
							<div class="safevault-item-title">${escapeHtml(item.title)}</div>
							<div class="safevault-item-sub">•••• ${escapeHtml((item.number || '').slice(-4))}</div>
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
				<span class="safevault-badge-count">${items.length} vault items</span>
			</div>
			<div class="safevault-dropdown-list">${itemsHtml}</div>
		`;

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
		dropdown.style.position = 'absolute';
		dropdown.style.top = `${window.scrollY + rect.bottom + 6}px`;
		dropdown.style.left = `${window.scrollX + rect.left - 180}px`;
		dropdown.style.zIndex = '999999';
	}

	function autofillItem(targetInput, item) {
		const form = targetInput.form || targetInput.closest('form') || document.body;

		if (item.type === 'password') {
			// Find password and username fields
			const passFields = form.querySelectorAll('input[type="password"]');
			const userFields = form.querySelectorAll('input[type="text"], input[type="email"]');

			if (passFields.length > 0) setNativeFieldValue(passFields[0], item.password);
			if (userFields.length > 0 && item.username) setNativeFieldValue(userFields[0], item.username);
		} else if (item.type === 'totp') {
			// Request live TOTP
			chrome.runtime.sendMessage({ action: "GET_TOTP", secret: item.secret }, (res) => {
				if (res && res.success && res.code) {
					setNativeFieldValue(targetInput, res.code);
				}
			});
		} else if (item.type === 'card') {
			const cardNumField = form.querySelector('input[name*="card"], input[id*="card"], input[autocomplete="cc-number"]');
			const cvvField = form.querySelector('input[name*="cvv"], input[name*="cvc"], input[id*="cvv"]');
			const holderField = form.querySelector('input[name*="holder"], input[name*="name"], input[autocomplete="cc-name"]');

			if (cardNumField && item.number) setNativeFieldValue(cardNumField, item.number);
			if (cvvField && item.cvv) setNativeFieldValue(cvvField, item.cvv);
			if (holderField && item.cardholderName) setNativeFieldValue(holderField, item.cardholderName);
		} else if (item.type === 'personal_info') {
			const nameField = form.querySelector('input[name*="name"], input[autocomplete="name"]');
			const emailField = form.querySelector('input[name*="email"], input[type="email"]');
			const phoneField = form.querySelector('input[name*="phone"], input[type="tel"]');

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
		const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])');
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

	document.addEventListener('click', (e) => {
		if (activeDropdown && !e.target.closest('.safevault-dropdown-menu') && !e.target.closest('.safevault-input-badge')) {
			closeDropdown();
		}
	});

	// Initial scan
	setTimeout(scanAndAttach, 1000);
})();
