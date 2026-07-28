document.addEventListener('DOMContentLoaded', () => {
	let currentDomain = '';

	// Elements
	const statusPill = document.getElementById('statusPill');
	const statusText = document.getElementById('statusText');
	const currentDomainText = document.getElementById('currentDomainText');
	const matchedList = document.getElementById('matchedList');
	const searchInput = document.getElementById('searchInput');
	const searchList = document.getElementById('searchList');
	const genPasswordText = document.getElementById('genPasswordText');
	const copyGenBtn = document.getElementById('copyGenBtn');
	const entropyBar = document.getElementById('entropyBar');
	const lengthSlider = document.getElementById('lengthSlider');
	const lenValue = document.getElementById('lenValue');
	const chkUpper = document.getElementById('chkUpper');
	const chkNumbers = document.getElementById('chkNumbers');
	const chkSymbols = document.getElementById('chkSymbols');
	const generateBtn = document.getElementById('generateBtn');

	// Tab switching
	document.querySelectorAll('.tab-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
			document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
			btn.classList.add('active');
			document.getElementById(btn.dataset.tab).classList.add('active');
		});
	});

	// Get active tab domain
	chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
		if (tabs && tabs[0] && tabs[0].url) {
			try {
				const url = new URL(tabs[0].url);
				currentDomain = url.hostname;
				currentDomainText.textContent = currentDomain;
				loadMatchedItems();
			} catch (e) {
				currentDomainText.textContent = "N/A";
				matchedList.innerHTML = '<div class="empty-state">System page or invalid tab.</div>';
			}
		}
	});

	// Status check
	function checkStatus() {
		chrome.runtime.sendMessage({ action: "GET_STATUS" }, (res) => {
			if (!res || !res.connected) {
				statusPill.className = 'status-indicator offline';
				statusText.textContent = 'Disconnected';
				matchedList.innerHTML = '<div class="empty-state">Start SafeVaultPro desktop app to connect.</div>';
			} else if (!res.unlocked) {
				statusPill.className = 'status-indicator locked';
				statusText.textContent = 'Vault Locked';
				matchedList.innerHTML = '<div class="empty-state">Unlock SafeVaultPro desktop app to access items.</div>';
			} else {
				statusPill.className = 'status-indicator online';
				statusText.textContent = 'Unlocked';
				if (currentDomain) loadMatchedItems();
			}
		});
	}

	function loadMatchedItems() {
		if (!currentDomain) return;
		chrome.runtime.sendMessage({ action: "QUERY_ITEMS", domain: currentDomain }, (res) => {
			if (!res || !res.success) {
				matchedList.innerHTML = `<div class="empty-state">${res?.error || 'Failed to fetch items'}</div>`;
				return;
			}
			renderItems(matchedList, res.items, true);
		});
	}

	// Search handler
	searchInput.addEventListener('input', () => {
		const q = searchInput.value.trim();
		if (!q) {
			searchList.innerHTML = '<div class="empty-state">Type to search items...</div>';
			return;
		}
		chrome.runtime.sendMessage({ action: "QUERY_ITEMS", q }, (res) => {
			if (!res || !res.success) {
				searchList.innerHTML = `<div class="empty-state">${res?.error || 'No results'}</div>`;
				return;
			}
			renderItems(searchList, res.items, false);
		});
	});

	function renderItems(container, items, isMatched) {
		if (!items || items.length === 0) {
			container.innerHTML = '<div class="empty-state">No matching items found.</div>';
			return;
		}

		container.innerHTML = items
			.map((item) => {
				let title = item.title || 'Untitled';
				let sub = '';
				let icon = '🔑';

				if (item.type === 'password') {
					sub = item.username || item.url || 'Password';
				} else if (item.type === 'totp') {
					icon = '⚡';
					sub = `2FA Code (${item.accountName || ''})`;
				} else if (item.type === 'card') {
					icon = '💳';
					sub = `Card ending in ${(item.number || '').slice(-4)}`;
				} else if (item.type === 'personal_info') {
					icon = '👤';
					sub = item.email || item.fullName;
				} else if (item.type === 'note') {
					icon = '📝';
					sub = 'Secure Note';
				}

				return `
				<div class="item-card" data-id="${item.id}">
					<div class="item-icon">${icon}</div>
					<div class="item-info">
						<div class="item-title">${escapeHtml(title)}</div>
						<div class="item-sub">${escapeHtml(sub)}</div>
					</div>
					<div class="item-actions">
						${
							item.type === 'password'
								? `<button class="action-btn copy-pass" data-val="${escapeHtml(item.password)}">Copy Pass</button>`
								: item.type === 'totp'
								? `<button class="action-btn copy-totp" data-secret="${escapeHtml(item.secret)}">Copy Code</button>`
								: `<button class="action-btn copy-info" data-id="${item.id}">Copy</button>`
						}
					</div>
				</div>
			`;
			})
			.join('');

		// Add copy listeners
		container.querySelectorAll('.copy-pass').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				navigator.clipboard.writeText(btn.dataset.val);
				showToast(btn, 'Copied!');
			});
		});

		container.querySelectorAll('.copy-totp').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const secret = btn.dataset.secret;
				chrome.runtime.sendMessage({ action: "GET_TOTP", secret }, (res) => {
					if (res && res.success && res.code) {
						navigator.clipboard.writeText(res.code);
						showToast(btn, res.code);
					}
				});
			});
		});
	}

	function showToast(btn, text) {
		const orig = btn.textContent;
		btn.textContent = text;
		btn.style.borderColor = '#10b981';
		btn.style.color = '#10b981';
		setTimeout(() => {
			btn.textContent = orig;
			btn.style.borderColor = '';
			btn.style.color = '';
		}, 1500);
	}

	// Generator tab handlers
	lengthSlider.addEventListener('input', () => {
		lenValue.textContent = lengthSlider.value;
		runGenerator();
	});

	chkUpper.addEventListener('change', runGenerator);
	chkNumbers.addEventListener('change', runGenerator);
	chkSymbols.addEventListener('change', runGenerator);
	generateBtn.addEventListener('click', runGenerator);

	function runGenerator() {
		const length = parseInt(lengthSlider.value, 10);
		chrome.runtime.sendMessage(
			{
				action: "GENERATE_PASSWORD",
				length,
				uppercase: chkUpper.checked,
				numbers: chkNumbers.checked,
				symbols: chkSymbols.checked,
			},
			(res) => {
				if (res && res.success) {
					genPasswordText.textContent = res.password;
					const entropy = res.entropy || 60;
					const pct = Math.min(100, Math.round((entropy / 120) * 100));
					entropyBar.style.width = `${pct}%`;
					if (pct < 40) entropyBar.style.background = '#ef4444';
					else if (pct < 70) entropyBar.style.background = '#f59e0b';
					else entropyBar.style.background = '#10b981';
				}
			}
		);
	}

	copyGenBtn.addEventListener('click', () => {
		const pwd = genPasswordText.textContent;
		if (pwd && pwd !== 'Click Generate') {
			navigator.clipboard.writeText(pwd);
			showToast(copyGenBtn, 'Copied!');
		}
	});

	function escapeHtml(str) {
		if (!str) return '';
		return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	checkStatus();
	runGenerator();
});
