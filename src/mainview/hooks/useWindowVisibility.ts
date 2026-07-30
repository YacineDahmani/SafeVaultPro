import { useState, useEffect } from "react";

/**
 * Custom hook that tracks window visibility and focus state.
 * Returns `isVisible` (true when window is visible/focused) and `isIdle` (true when minimized/hidden).
 */
export function useWindowVisibility() {
	const [isVisible, setIsVisible] = useState<boolean>(!document.hidden);

	useEffect(() => {
		const handleVisibilityChange = () => {
			setIsVisible(!document.hidden);
		};

		const handleBlur = () => {
			// Window lost focus or minimized
			if (document.hidden) {
				setIsVisible(false);
			}
		};

		const handleFocus = () => {
			setIsVisible(true);
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("blur", handleBlur);
		window.addEventListener("focus", handleFocus);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("blur", handleBlur);
			window.removeEventListener("focus", handleFocus);
		};
	}, []);

	return {
		isVisible,
		isIdle: !isVisible,
	};
}
