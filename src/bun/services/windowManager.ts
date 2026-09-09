import { dlopen, FFIType, ptr } from "bun:ffi";

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

// User32 FFI for native Windows display and work area querying
let user32: any = null;
const isWindows = process.platform === "win32";

if (isWindows) {
	try {
		user32 = dlopen("user32.dll", {
			SystemParametersInfoW: {
				args: [FFIType.u32, FFIType.u32, FFIType.ptr, FFIType.u32],
				returns: FFIType.bool,
			},
			MonitorFromPoint: {
				args: [FFIType.u64, FFIType.u32],
				returns: FFIType.ptr,
			},
			GetMonitorInfoW: {
				args: [FFIType.ptr, FFIType.ptr],
				returns: FFIType.bool,
			},
			GetSystemMetrics: {
				args: [FFIType.u32],
				returns: FFIType.i32,
			},
		});
	} catch (e) {
		console.warn("[WindowManager] Failed to load user32.dll FFI:", e);
	}
}

/**
 * Retrieves the desktop work area (which completely excludes the taskbar)
 * for the monitor containing the specified coordinates (or the primary monitor).
 */
export function getWorkArea(pointX?: number, pointY?: number): Rect {
	if (isWindows && user32) {
		try {
			if (typeof pointX === "number" && typeof pointY === "number") {
				// Win32 POINT { LONG x; LONG y; } passed as a 64-bit integer
				const x = BigInt(Math.round(pointX));
				const y = BigInt(Math.round(pointY));
				const pt = (x & 0xffffffffn) | ((y & 0xffffffffn) << 32n);

				// MONITOR_DEFAULTTONEAREST = 2
				const hMon = user32.symbols.MonitorFromPoint(pt, 2);
				if (hMon) {
					// MONITORINFO struct:
					// cbSize (4 bytes), rcMonitor (16 bytes: l, t, r, b), rcWork (16 bytes: l, t, r, b), dwFlags (4 bytes)
					const mi = new Int32Array(10);
					mi[0] = 40; // sizeof(MONITORINFO)
					if (user32.symbols.GetMonitorInfoW(hMon, ptr(mi))) {
						const left = mi[5]!;
						const top = mi[6]!;
						const right = mi[7]!;
						const bottom = mi[8]!;
						return {
							x: left,
							y: top,
							width: Math.max(right - left, 600),
							height: Math.max(bottom - top, 400),
						};
					}
				}
			}

			// Fallback: Primary monitor work area (SPI_GETWORKAREA = 48)
			const rect = new Int32Array(4);
			if (user32.symbols.SystemParametersInfoW(48, 0, ptr(rect), 0)) {
				const left = rect[0]!;
				const top = rect[1]!;
				const right = rect[2]!;
				const bottom = rect[3]!;
				return {
					x: left,
					y: top,
					width: Math.max(right - left, 600),
					height: Math.max(bottom - top, 400),
				};
			}
		} catch (err) {
			console.error("[WindowManager] Error querying Win32 work area:", err);
		}
	}

	// Graceful fallback for non-Windows or if API unavailable
	return { x: 0, y: 0, width: 1280, height: 720 };
}

/**
 * Calculates a comfortable, centered initial frame that fits safely within the user's display
 * and never overlaps the taskbar regardless of resolution (720p, 1080p, 1440p, 4K).
 */
export function getInitialFrame(): Rect {
	const workArea = getWorkArea();

	// Target comfortable default dimensions (1160x750), but clamp so window never exceeds screen
	const marginX = Math.min(40, Math.floor(workArea.width * 0.05));
	const marginY = Math.min(40, Math.floor(workArea.height * 0.05));

	const width = Math.min(1160, Math.max(workArea.width - marginX * 2, 700));
	const height = Math.min(750, Math.max(workArea.height - marginY * 2, 500));

	const x = workArea.x + Math.round((workArea.width - width) / 2);
	const y = workArea.y + Math.round((workArea.height - height) / 2);

	return { x, y, width, height };
}

// Stores the last unmaximized window position/size so restore returns exactly there
let savedRestoreFrame: Rect | null = null;

/**
 * On Windows 10/11, resizable windows (WS_THICKFRAME) have an invisible 7-8px resize border padding
 * (SM_CXSIZEFRAME + SM_CXPADDEDBORDER). Maximizing must expand the outer frame by this padding
 * so the visible content area fills the monitor's work area edge-to-edge without margins or gaps.
 */
export function getWindowBorderPadding(): { x: number; y: number } {
	if (isWindows && user32) {
		try {
			const cxSizeFrame = user32.symbols.GetSystemMetrics(32); // SM_CXSIZEFRAME
			const cySizeFrame = user32.symbols.GetSystemMetrics(33); // SM_CYSIZEFRAME
			const cxPaddedBorder = user32.symbols.GetSystemMetrics(92); // SM_CXPADDEDBORDER

			const borderX = (cxSizeFrame || 4) + (cxPaddedBorder || 4);
			const borderY = (cySizeFrame || 4) + (cxPaddedBorder || 4);
			return { x: borderX, y: borderY };
		} catch (e) {
			return { x: 8, y: 8 };
		}
	}
	return { x: 0, y: 0 };
}

/**
 * Returns the exact outer frame coordinates needed to fill the monitor's work area
 * completely edge-to-edge, taking the OS invisible border into account.
 */
export function getMaximizedFrame(pointX?: number, pointY?: number): Rect {
	const workArea = getWorkArea(pointX, pointY);
	const border = getWindowBorderPadding();

	return {
		x: workArea.x - border.x,
		y: workArea.y - border.y,
		width: workArea.width + border.x * 2,
		height: workArea.height + border.y * 2,
	};
}

let mainWinRef: any = null;

export function setMainWindow(win: any): void {
	mainWinRef = win;
}

export function getMainWindow(): any {
	return mainWinRef;
}

/**
 * Evaluates whether the window is currently maximized by comparing its actual native frame
 * against the monitor's maximized frame (with a small margin of tolerance).
 */
export function isWindowMaximized(win?: any): boolean {
	const target = win || mainWinRef;
	if (!target) return false;
	try {
		const frame = target.getFrame();
		if (!frame || frame.width < 100 || frame.height < 100) return false;

		const centerX = frame.x + frame.width / 2;
		const centerY = frame.y + frame.height / 2;
		const maxFrame = getMaximizedFrame(centerX, centerY);

		const isMatch =
			Math.abs(frame.x - maxFrame.x) <= 6 &&
			Math.abs(frame.y - maxFrame.y) <= 6 &&
			Math.abs(frame.width - maxFrame.width) <= 12 &&
			Math.abs(frame.height - maxFrame.height) <= 12;

		return isMatch;
	} catch (e) {
		console.warn("[WindowManager] Error checking isWindowMaximized:", e);
		return false;
	}
}

/**
 * Maximizes the window within the exact taskbar-aware work area of its current monitor,
 * eliminating any gap around the window edges.
 */
export function maximizeWindow(win?: any): boolean {
	const target = win || mainWinRef;
	if (!target) return false;
	try {
		const frame = target.getFrame();
		if (frame && frame.width > 400 && frame.height > 300) {
			const centerX = frame.x + frame.width / 2;
			const centerY = frame.y + frame.height / 2;
			const maxFrame = getMaximizedFrame(centerX, centerY);

			const isAlreadyMax =
				Math.abs(frame.x - maxFrame.x) <= 6 &&
				Math.abs(frame.y - maxFrame.y) <= 6 &&
				Math.abs(frame.width - maxFrame.width) <= 12 &&
				Math.abs(frame.height - maxFrame.height) <= 12;

			if (!isAlreadyMax) {
				savedRestoreFrame = { ...frame };
			}
		}

		const centerX = (frame?.x ?? 0) + (frame?.width ?? 1000) / 2;
		const centerY = (frame?.y ?? 0) + (frame?.height ?? 600) / 2;
		const targetFrame = getMaximizedFrame(centerX, centerY);

		target.setFrame(
			targetFrame.x,
			targetFrame.y,
			targetFrame.width,
			targetFrame.height,
		);

		return true;
	} catch (e) {
		console.error("[WindowManager] Failed to maximize window:", e);
		return false;
	}
}

/**
 * Restores the window to its previous unmaximized dimensions.
 */
export function unmaximizeWindow(win?: any): boolean {
	const target = win || mainWinRef;
	if (!target) return false;
	try {
		const restore = savedRestoreFrame || getInitialFrame();
		target.setFrame(restore.x, restore.y, restore.width, restore.height);
		return false;
	} catch (e) {
		console.error("[WindowManager] Failed to unmaximize window:", e);
		return false;
	}
}

/**
 * Toggles maximize / restore based on real-time window geometry.
 */
export function toggleMaximize(win?: any): boolean {
	const target = win || mainWinRef;
	if (!target) return false;
	if (isWindowMaximized(target)) {
		return unmaximizeWindow(target);
	} else {
		return maximizeWindow(target);
	}
}

/**
 * Minimizes the window to the taskbar.
 */
export function minimizeWindow(win?: any): void {
	const target = win || mainWinRef;
	try {
		target?.minimize();
	} catch (e) {
		console.error("[WindowManager] Failed to minimize window:", e);
	}
}

/**
 * Closes the window / application.
 */
export function closeWindow(win?: any): void {
	const target = win || mainWinRef;
	try {
		target?.close();
	} catch (e) {
		console.error("[WindowManager] Failed to close window:", e);
	}
}

let isHiddenInTray = false;

/**
 * Hides the window to the system tray (removes from taskbar, keeps background process running).
 */
export function hideToTray(win?: any): void {
	const target = win || mainWinRef;
	try {
		target?.hide();
		isHiddenInTray = true;
		console.log("[WindowManager] Application window hidden to system tray");
	} catch (e) {
		console.error("[WindowManager] Failed to hide window to tray:", e);
	}
}

/**
 * Restores and activates the window from the system tray.
 */
export function restoreFromTray(win?: any): void {
	const target = win || mainWinRef;
	try {
		target?.show();
		target?.activate();
		isHiddenInTray = false;
		console.log("[WindowManager] Application window restored from system tray");
	} catch (e) {
		console.error("[WindowManager] Failed to restore window from tray:", e);
	}
}

/**
 * Returns whether the window is currently hidden in the tray.
 */
export function isWindowHidden(): boolean {
	return isHiddenInTray;
}

/**
 * Handles window minimize according to user's minimizeToTray preference.
 */
export function handleMinimize(win?: any, minimizeToTray = false): { action: "hidden" | "minimized" } {
	const target = win || mainWinRef;
	if (minimizeToTray) {
		hideToTray(target);
		return { action: "hidden" };
	} else {
		minimizeWindow(target);
		return { action: "minimized" };
	}
}

/**
 * Handles window close - always exits application cleanly.
 */
export function handleCloseOrMinimize(win?: any, minimizeToTray = false): { action: "hidden" | "closed" } {
	const target = win || mainWinRef;
	forceQuitApp(target);
	return { action: "closed" };
}

/**
 * Completely terminates the application and background runtime.
 */
export function forceQuitApp(win?: any): void {
	const target = win || mainWinRef;
	try {
		target?.close();
	} catch {}
	setTimeout(() => {
		try {
			process.exit(0);
		} catch {}
	}, 150);
}

/**
 * Records the window frame when resized by the user manually,
 * preserving it for subsequent unmaximize / restore operations.
 */
export function recordUserFrame(win?: any): void {
	const target = win || mainWinRef;
	if (!target) return;
	try {
		if (!isWindowMaximized(target)) {
			const frame = target.getFrame();
			if (frame && frame.width > 400 && frame.height > 300) {
				savedRestoreFrame = { ...frame };
			}
		}
	} catch {}
}
