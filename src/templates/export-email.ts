import type { TimeEntry } from '../types/sync'

export function getExportEmailTemplate({
	allEntries,
	downloadUrl,
	startDate,
	endDate,
	expirationDate,
	fileSize
}: {
	allEntries: TimeEntry[]
	downloadUrl: string
	startDate?: string
	endDate?: string
	expirationDate: Date
	fileSize: number
}) {
	return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TimeFly Data Export</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color: #E5E5E5;
          margin: 0;
          padding: 0;
          background-color: #1E1E1E;
        }

        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 32px 24px;
        }

        .logo-container {
          text-align: center;
          margin-bottom: 32px;
        }

        .logo {
          width: 48px;
          height: 48px;
          margin-bottom: 16px;
          background: #D9D9D9;
          padding: 12px;
          border-radius: 12px;
        }

        .card {
          background-color: #2A2A2A;
          border-radius: 16px;
          padding: 32px;
          margin-bottom: 32px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        h1 {
          color: #FFFFFF;
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 32px 0;
          text-align: center;
        }

        .data-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .data-row:last-child {
          border-bottom: none;
        }

        .label {
          color: #999999;
          font-size: 14px;
          margin-right: 16px;
        }

        .value {
          color: #E87C58;
          font-weight: 500;
          font-size: 14px;
        }

        .download-button {
          display: block;
          background-color: #E87C58;
          color: #FFFFFF;
          text-decoration: none;
          padding: 16px 24px;
          border-radius: 8px;
          text-align: center;
          font-weight: 500;
          margin: 32px 0;
          font-size: 16px;
        }

        .expiration-notice {
          display: flex;
          align-items: center;
          gap: 12px;
          background-color: rgba(232, 124, 88, 0.1);
          border: 1px solid #E87C58;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 24px;
        }

        .warning-icon {
          background-color: #E87C58;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFFFFF;
          font-weight: bold;
          font-size: 14px;
          flex-shrink: 0;
        }

        .expiration-text {
          color: #E87C58;
          font-size: 14px;
          line-height: 1.5;
        }

        .footer {
          text-align: center;
          color: #999999;
          font-size: 14px;
          line-height: 1.6;
          margin-top: 32px;
        }

        .footer p {
          margin: 0 0 8px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-container">
          <img src="data:image/svg+xml;base64,${Buffer.from(`
            <svg width="300" height="300" viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clip-path="url(#clip0_3_414)">
                <rect width="300" height="300" rx="101" fill="#D9D9D9"/>
                <path d="M106.949 128.633L128.291 107.291C140.077 95.5039 159.188 95.5039 170.974 107.291L192.316 128.633L149.633 171.316L106.949 128.633Z" fill="#1F1F1F"/>
                <path d="M106.949 128.633L128.291 107.291C140.077 95.5039 159.188 95.5039 170.974 107.291L213.658 149.974C225.445 161.761 225.445 180.871 213.658 192.658V192.658C201.871 204.445 182.761 204.445 170.974 192.658L106.949 128.633Z" stroke="#1F1F1F" stroke-width="25.8968"/>
                <path d="M128.291 107.291C140.078 95.5043 159.188 95.5043 170.975 107.291L192.316 128.633L128.291 192.659C116.504 204.445 97.3938 204.445 85.6071 192.659V192.659C73.8203 180.872 73.8203 161.762 85.607 149.975L128.291 107.291Z" stroke="#1F1F1F" stroke-width="25.8968"/>
              </g>
              <defs>
                <clipPath id="clip0_3_414">
                  <rect width="300" height="300" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          `).toString('base64')}" alt="TimeFly" class="logo">
        </div>

        <div class="card">
          <h1>Your Data Export is Ready</h1>

          <div class="data-row">
            <span class="label">Total entries</span>
            <span class="value">${allEntries.length.toLocaleString()}</span>
          </div>
          <div class="data-row">
            <span class="label">Export date</span>
            <span class="value">${new Date().toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			})}</span>
          </div>
          <div class="data-row">
            <span class="label">Date range</span>
            <span class="value">${startDate || 'All time'} to ${endDate || 'Present'}</span>
          </div>
          <div class="data-row">
            <span class="label">File size</span>
            <span class="value">${(fileSize / (1024 * 1024)).toFixed(2)} MB</span>
          </div>

          <a href="${downloadUrl}" class="download-button">
            Download Export
          </a>

          <div class="expiration-notice">
            <div class="warning-icon">!</div>
            <span class="expiration-text">
              This export will expire on ${expirationDate.toLocaleDateString('en-US', {
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				})}
            </span>
          </div>
        </div>

        <div class="footer">
          <p>If you have any questions or need assistance,</p>
          <p>our support team is here to help.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
