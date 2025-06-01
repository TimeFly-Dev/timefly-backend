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
	if (!userAgent || userAgent.trim() === '') {
		return {
			deviceName: 'Unknown device',
			deviceType: 'Desktop',
			browser: 'Unknown',
			os: 'Unknown'
		}
	}

	// Normalize user agent string
	const ua = userAgent.toLowerCase();

	// Default values
	let deviceName = 'Unknown device'
	let deviceType = 'Desktop'
	let browser = 'Unknown'
	let os = 'Unknown'

	// Detect OS - Order matters for detection accuracy
	if (ua.includes('windows')) {
		os = 'Windows'
		// Try to detect Windows version
		if (ua.includes('windows nt 10')) {
			os = 'Windows 10/11'
		} else if (ua.includes('windows nt 6.3')) {
			os = 'Windows 8.1'
		} else if (ua.includes('windows nt 6.2')) {
			os = 'Windows 8'
		} else if (ua.includes('windows nt 6.1')) {
			os = 'Windows 7'
		}
	} else if (ua.includes('macintosh') || ua.includes('mac os x')) {
		os = 'macOS'
	} else if (ua.includes('linux') && !ua.includes('android')) {
		os = 'Linux'
	} else if (ua.includes('android')) {
		os = 'Android'
		deviceType = 'Mobile'
		// Try to detect Android version
		const androidVersionMatch = ua.match(/android\s([0-9.]+)/i)
		if (androidVersionMatch?.[1]) {
			os = `Android ${androidVersionMatch[1]}`
		}
	} else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
		os = 'iOS'
		deviceType = ua.includes('ipad') ? 'Tablet' : 'Mobile'
		// Try to detect iOS version
		const iosVersionMatch = ua.match(/os\s([0-9_]+)/i)
		if (iosVersionMatch?.[1]) {
			os = `iOS ${iosVersionMatch[1].replace(/_/g, '.')}`
		}
	}

	// Detect browser - Order matters for detection accuracy
	// Many browsers include "Chrome" or "Safari" in their UA, so check specific ones first
	if (ua.includes('firefox/') && !ua.includes('seamonkey')) {
		browser = 'Firefox'
		const versionMatch = ua.match(/firefox\/([0-9.]+)/i)
		if (versionMatch?.[1]) {
			browser = `Firefox ${versionMatch[1]}`
		}
	} else if (ua.includes('edg/') || ua.includes('edge/')) {
		browser = 'Edge'
		const versionMatch = ua.match(/edg(?:e)?\/([0-9.]+)/i)
		if (versionMatch?.[1]) {
			browser = `Edge ${versionMatch[1]}`
		}
	} else if (ua.includes('opr/') || ua.includes('opera/')) {
		browser = 'Opera'
		const versionMatch = ua.match(/(?:opr|opera)\/([0-9.]+)/i)
		if (versionMatch?.[1]) {
			browser = `Opera ${versionMatch[1]}`
		}
	} else if (ua.includes('chrome/') && !ua.includes('chromium')) {
		browser = 'Chrome'
		const versionMatch = ua.match(/chrome\/([0-9.]+)/i)
		if (versionMatch?.[1]) {
			browser = `Chrome ${versionMatch[1]}`
		}
	} else if (ua.includes('safari/') && !ua.includes('chrome/') && !ua.includes('chromium')) {
		browser = 'Safari'
		const versionMatch = ua.match(/version\/([0-9.]+)/i)
		if (versionMatch?.[1]) {
			browser = `Safari ${versionMatch[1]}`
		}
	} else if (ua.includes('msie ') || ua.includes('trident/')) {
		browser = 'Internet Explorer'
		const versionMatch = ua.match(/(?:msie |rv:)([0-9.]+)/i)
		if (versionMatch?.[1]) {
			browser = `Internet Explorer ${versionMatch[1]}`
		}
	} else if (ua.includes('chromium')) {
		browser = 'Chromium'
		const versionMatch = ua.match(/chromium\/([0-9.]+)/i)
		if (versionMatch?.[1]) {
			browser = `Chromium ${versionMatch[1]}`
		}
	}

	// Create device name
	if (deviceType === 'Mobile') {
		if (ua.includes('iphone')) {
			deviceName = 'iPhone'
			// Try to detect iPhone model
			if (os.includes('iOS')) {
				deviceName = `iPhone (${os})`
			}
		} else if (ua.includes('ipad')) {
			deviceName = 'iPad'
			if (os.includes('iOS')) {
				deviceName = `iPad (${os})`
			}
		} else if (ua.includes('android')) {
			// Default device name for Android
			deviceName = 'Android device'
			
			// Try to extract device model for Android
			const modelMatchResult = ua.match(/android [0-9.]+;\s*([^;)]+)(?:[;)])/i)
			if (modelMatchResult?.[1] !== undefined) {
				const modelText = modelMatchResult[1].trim()
				if (modelText !== '') {
					// Clean up common model name issues
					deviceName = modelText
						.replace(/build\/.+$/i, '')
						.replace(/android/i, '')
						.trim()
					
					// If after cleanup we have an empty string, use the default
					if (!deviceName || deviceName === '') {
						deviceName = 'Android device'
					}
				}
			}
		} else {
			deviceName = 'Mobile device'
		}
	} else {
		// For desktop, combine OS and browser
		deviceName = `${os} ${browser}`.trim()
		if (deviceName === 'Unknown Unknown') {
			deviceName = 'Desktop device'
		}
	}

	return {
		deviceName,
		deviceType,
		browser,
		os
	}
}
