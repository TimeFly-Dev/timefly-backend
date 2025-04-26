/**
 * Parses user agent string to extract device information
 * @param {string} userAgent - The user agent string
 * @returns {object} Device information
 */
export const parseUserAgent = (
	userAgent: string
): {
	deviceName: string
	deviceType: string
	browser: string
	os: string
} => {
	if (!userAgent) {
		return {
			deviceName: 'Unknown device',
			deviceType: 'Unknown',
			browser: 'Unknown',
			os: 'Unknown'
		}
	}

	// Default values
	let deviceName = 'Unknown device'
	let deviceType = 'Desktop'
	let browser = 'Unknown'
	let os = 'Unknown'

	// Detect OS
	if (userAgent.includes('Windows')) {
		os = 'Windows'
	} else if (userAgent.includes('Mac OS')) {
		os = 'macOS'
	} else if (userAgent.includes('Linux')) {
		os = 'Linux'
	} else if (userAgent.includes('Android')) {
		os = 'Android'
		deviceType = 'Mobile'
	} else if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod')) {
		os = 'iOS'
		deviceType = userAgent.includes('iPad') ? 'Tablet' : 'Mobile'
	}

	// Detect browser
	if (userAgent.includes('Firefox/')) {
		browser = 'Firefox'
	} else if (userAgent.includes('Edge/') || userAgent.includes('Edg/')) {
		browser = 'Edge'
	} else if (userAgent.includes('Chrome/')) {
		browser = 'Chrome'
	} else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
		browser = 'Safari'
	} else if (userAgent.includes('MSIE ') || userAgent.includes('Trident/')) {
		browser = 'Internet Explorer'
	} else if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) {
		browser = 'Opera'
	}

	// Create device name
	if (deviceType === 'Mobile') {
		if (userAgent.includes('iPhone')) {
			deviceName = 'iPhone'
		} else if (userAgent.includes('iPad')) {
			deviceName = 'iPad'
		} else if (userAgent.includes('Android')) {
			// Try to extract device model for Android
			const match = userAgent.match(/Android [0-9.]+; ([^;]+)/)
			deviceName = match ? match[1].trim() : 'Android device'
		} else {
			deviceName = 'Mobile device'
		}
	} else {
		deviceName = `${os} ${browser}`
	}

	return {
		deviceName,
		deviceType,
		browser,
		os
	}
}
