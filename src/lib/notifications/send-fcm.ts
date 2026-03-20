import { getMessaging } from 'firebase-admin/messaging'
import '@/lib/firebase/admin'

export interface FCMPayload {
  title: string
  body: string
  link?: string
}

/**
 * Send a Firebase Cloud Messaging push notification to a single device token.
 * Returns true on success, false on failure (stale token, etc.).
 */
export async function sendFCMAlert(fcmToken: string, payload: FCMPayload): Promise<boolean> {
  try {
    await getMessaging().send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
        },
        fcmOptions: payload.link ? { link: payload.link } : undefined,
      },
    })
    return true
  } catch (err) {
    console.error('[FCM] Failed to send notification:', err)
    return false
  }
}
