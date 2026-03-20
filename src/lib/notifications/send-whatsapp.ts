/**
 * Send a WhatsApp message via MSG91's API.
 * Requires approved WhatsApp Business template.
 * Returns true on success, false if config missing or API error.
 */
export async function sendWhatsAppAlert(phone: string, message: string): Promise<boolean> {
  const authKey    = process.env.MSG91_AUTH_KEY
  const templateId = process.env.MSG91_TEMPLATE_ID

  // Silently skip if WhatsApp is not configured
  if (!authKey || !templateId) {
    console.warn('[WhatsApp] MSG91_AUTH_KEY or MSG91_TEMPLATE_ID not set — skipping')
    return false
  }

  // MSG91 requires Indian numbers without leading 0 or +91
  const normalised = phone.replace(/^\+?91/, '').replace(/^0/, '').replace(/\D/g, '')
  if (normalised.length !== 10) {
    console.warn('[WhatsApp] Invalid phone number:', phone)
    return false
  }

  try {
    const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: {
        'authkey': authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        integrated_number: `91${normalised}`,
        content_type: 'template',
        payload: {
          to: `91${normalised}`,
          type: 'template',
          template: {
            name: templateId,
            language: { code: 'hi' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: message }],
              },
            ],
          },
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[WhatsApp] MSG91 API error:', res.status, text)
      return false
    }

    return true
  } catch (err) {
    console.error('[WhatsApp] Network error:', err)
    return false
  }
}
