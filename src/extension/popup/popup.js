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

	const SVG_ICONS = {
		password: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
		totp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
		card: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
		personal_info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
		note: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
		check: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
	};

	function renderItems(container, items, isMatched) {
		if (!items || items.length === 0) {
			container.innerHTML = '<div class="empty-state">No matching items found.</div>';
			return;
		}

		container.innerHTML = items
			.map((item) => {
				let title = item.title || 'Untitled';
				let sub = '';
				let iconSvg = SVG_ICONS.password;
				let iconType = 'type-password';
				let copyVal = '';

				if (item.type === 'password') {
					sub = item.username || item.url || 'Password';
					copyVal = item.password || '';
				} else if (item.type === 'totp') {
					iconSvg = SVG_ICONS.totp;
					iconType = 'type-totp';
					sub = `2FA Code (${item.accountName || ''})`;
				} else if (item.type === 'card') {
					iconSvg = SVG_ICONS.card;
					iconType = 'type-card';
					sub = `Card ending in ${(item.number || '').slice(-4)}`;
					copyVal = item.number || '';
				} else if (item.type === 'personal_info') {
					iconSvg = SVG_ICONS.personal_info;
					iconType = 'type-personal_info';
					sub = item.email || item.fullName || '';
					copyVal = item.email || item.fullName || '';
				} else if (item.type === 'note') {
					iconSvg = SVG_ICONS.note;
					iconType = 'type-note';
					sub = 'Secure Note';
					copyVal = item.notes || item.content || '';
				}

				return `
				<div class="item-card" data-id="${item.id}">
					<div class="item-icon ${iconType}">${iconSvg}</div>
					<div class="item-info">
						<div class="item-title">${escapeHtml(title)}</div>
						<div class="item-sub">${escapeHtml(sub)}</div>
					</div>
					<div class="item-actions">
						${
							item.type === 'password'
								? `<button class="action-btn copy-pass" data-val="${escapeHtml(item.password)}">Copy</button>`
								: item.type === 'totp'
								? `<button class="action-btn copy-totp" data-secret="${escapeHtml(item.secret)}">Copy Code</button>`
								: `<button class="action-btn copy-info" data-val="${escapeHtml(copyVal)}">Copy</button>`
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
				showToast(btn, 'Password copied');
			});
		});

		container.querySelectorAll('.copy-totp').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const secret = btn.dataset.secret;
				chrome.runtime.sendMessage({ action: "GET_TOTP", secret }, (res) => {
					if (res && res.success && res.code) {
						navigator.clipboard.writeText(res.code);
						showToast(btn, `Code: ${res.code}`);
					}
				});
			});
		});

		container.querySelectorAll('.copy-info').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const val = btn.dataset.val;
				if (val) {
					navigator.clipboard.writeText(val);
					showToast(btn, 'Copied');
				}
			});
		});
	}

	let toastTimer = null;
	function showToast(btn, text) {
		let message = text;
		let targetBtn = btn;
		if (typeof btn === 'string') {
			message = btn;
			targetBtn = text;
		}
		if (!message) message = 'Copied';

		if (targetBtn && targetBtn.nodeType) {
			const orig = targetBtn.textContent;
			targetBtn.textContent = 'Copied';
			targetBtn.style.borderColor = '#10b981';
			targetBtn.style.color = '#10b981';
			setTimeout(() => {
				targetBtn.textContent = orig;
				targetBtn.style.borderColor = '';
				targetBtn.style.color = '';
			}, 1400);
		}

		const toastEl = document.getElementById('popupToast');
		if (toastEl) {
			toastEl.innerHTML = `<span class="popup-toast-icon">${SVG_ICONS.check}</span><span>${escapeHtml(message)}</span>`;
			toastEl.classList.add('visible');
			clearTimeout(toastTimer);
			toastTimer = setTimeout(() => {
				toastEl.classList.remove('visible');
			}, 1500);
		}
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
			showToast(copyGenBtn, 'Password copied');
		}
	});

	function escapeHtml(str) {
		if (!str) return '';
		return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	checkStatus();
	runGenerator();
});
