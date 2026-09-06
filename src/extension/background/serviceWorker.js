const API_BASE = "http://localhost:48920/api";
let cachedAuthToken = "";

async function getAuthToken() {
	if (cachedAuthToken) return cachedAuthToken;
	try {
		const res = await fetch(chrome.runtime.getURL("bridge-token.json"));
		if (res.ok) {
			const data = await res.json();
			if (data && data.token) {
				cachedAuthToken = data.token;
				return cachedAuthToken;
			}
		}
	} catch (e) {
		console.warn("Failed to read bridge-token.json:", e);
	}
	return "sv_tok_7c9e1b4f2a8d3e6a0b5c9d8e7f2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f01";
}

async function authFetch(url, options = {}) {
	const token = await getAuthToken();
	const headers = new Headers(options.headers || {});
	headers.set("Authorization", `Bearer ${token}`);
	return fetch(url, {
		...options,
		headers,
		cache: "no-store",
	});
}

// Fetch state from local desktop server
async function fetchServerStatus() {
	try {
		const res = await authFetch(`${API_BASE}/status`);
		if (!res.ok) return { success: false, unlocked: false, connected: false };
		const data = await res.json();
		return { ...data, connected: true };
	} catch (e) {
		return { success: false, unlocked: false, connected: false };
	}
}

// Update action badge state based on desktop app connection
async function updateBadgeState() {
	const status = await fetchServerStatus();
	if (!status.connected) {
		chrome.action.setBadgeText({ text: "OFF" });
		chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
	} else if (!status.unlocked) {
		chrome.action.setBadgeText({ text: "LOCK" });
		chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
	} else {
		chrome.action.setBadgeText({ text: "ON" });
		chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
	}
}

// Check status every 15 seconds
chrome.alarms?.create("statusCheck", { periodInMinutes: 0.25 });
chrome.alarms?.onAlarm.addListener((alarm) => {
	if (alarm.name === "statusCheck") {
		updateBadgeState();
	}
});

// Update badge on extension load
updateBadgeState();

// Message listener from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "GET_STATUS") {
		fetchServerStatus().then((status) => sendResponse(status));
		return true;
	}

	if (message.action === "QUERY_ITEMS") {
		const domain = message.domain || "";
		const q = message.q || "";
		const type = message.type || "all";
		const fieldType = message.fieldType || "";
		const url = `${API_BASE}/query?domain=${encodeURIComponent(domain)}&q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&fieldType=${encodeURIComponent(fieldType)}`;

		authFetch(url)
			.then((res) => res.json())
			.then((data) => sendResponse(data))
			.catch((err) => sendResponse({ success: false, error: err.message || "Failed to reach desktop application." }));
		return true;
	}

	if (message.action === "GET_TOTP") {
		const secret = message.secret || "";
		authFetch(`${API_BASE}/totp?secret=${encodeURIComponent(secret)}`)
			.then((res) => res.json())
			.then((data) => sendResponse(data))
			.catch((err) => sendResponse({ success: false, error: err.message }));
		return true;
	}

	if (message.action === "GENERATE_PASSWORD") {
		const { length, uppercase, numbers, symbols } = message;
		const url = `${API_BASE}/generate?length=${length || 16}&uppercase=${uppercase !== false}&numbers=${numbers !== false}&symbols=${symbols !== false}`;
		authFetch(url)
			.then((res) => res.json())
			.then((data) => sendResponse(data))
			.catch((err) => sendResponse({ success: false, error: err.message }));
		return true;
	}

	if (message.action === "SAVE_PASSWORD") {
		const { id, title, username, password, url, notes } = message;
		authFetch(`${API_BASE}/save-password`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, title, username, password, url, notes }),
		})
			.then((res) => res.json())
			.then((data) => sendResponse(data))
			.catch((err) => sendResponse({ success: false, error: err.message }));
		return true;
	}
});
