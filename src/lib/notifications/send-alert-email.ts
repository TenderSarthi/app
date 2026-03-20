import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface AlertEmailPayload {
  to: string
  subject: string
  tenderTitle: string
  tenderLink: string
  message: string
}

/**
 * Send an alert email via Resend.
 * Returns true on success, false if config missing or API error.
 */
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping')
    return false
  }

  const from = process.env.RESEND_FROM_EMAIL ?? 'TenderSarthi <alerts@tendersarthi.com>'

  try {
    const { error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A3766;">
          <h2 style="color: #1A3766;">नया Tender मिला! 🎯</h2>
          <p style="font-size: 18px; font-weight: bold;">${payload.tenderTitle}</p>
          <p>${payload.message}</p>
          <a href="${payload.tenderLink}"
             style="display: inline-block; background: #F97316; color: white; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
            Tender देखें →
          </a>
          <hr style="border: 1px solid #e5e7eb; margin: 24px 0;"/>
          <p style="font-size: 12px; color: #9ca3af;">
            TenderSarthi | AI-powered GeM tender assistant<br/>
            Alert settings: <a href="https://tendersarthi.com/en/alerts">Manage alerts</a>
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('[Email] Resend error:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[Email] Network error:', err)
    return false
  }
}
