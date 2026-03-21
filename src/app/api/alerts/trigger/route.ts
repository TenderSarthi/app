import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import Parser from 'rss-parser'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import '@/lib/firebase/admin'
import { parseRSSItem, matchesAlertConfig, formatAlertMessage } from '@/lib/alert-utils'
import { sendFCMAlert } from '@/lib/notifications/send-fcm'
import { sendWhatsAppAlert } from '@/lib/notifications/send-whatsapp'
import { sendAlertEmail } from '@/lib/notifications/send-alert-email'
import type { AlertConfig } from '@/lib/alert-utils'
import type { UserProfile } from '@/lib/types'

const parser = new Parser({ timeout: 10_000 })

// --- Helpers ---

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  if (token.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
}

/** Fetch and parse a single RSS feed URL. Returns [] on any error. */
async function fetchFeedItems(url: string) {
  try {
    const feed = await parser.parseURL(url)
    return feed.items ?? []
  } catch (err) {
    console.warn(`[Alerts] RSS fetch failed for ${url}:`, err)
    return []
  }
}

// --- Main route ---

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getFirestore()
  const now = new Date()
  const sevenHoursAgo = new Date(now.getTime() - 7 * 60 * 60 * 1000)

  // ── Step 1: Fetch RSS items ──────────────────────────────────────────────
  const rssUrls = (process.env.ALERT_RSS_URLS ?? 'https://eprocure.gov.in/eprocure/app/rssxml')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean)

  const allItems = (
    await Promise.all(rssUrls.map(fetchFeedItems))
  ).flat()

  // Deduplicate by link
  const seenLinks = new Set<string>()
  const uniqueItems = allItems.filter(item => {
    if (!item.link || seenLinks.has(item.link)) return false
    seenLinks.add(item.link)
    return true
  })

  // Filter to last 7 hours (avoids re-alerting old tenders on retry runs)
  const recentItems = uniqueItems.filter(item => {
    if (!item.pubDate) return true // include if no date (conservative)
    return new Date(item.pubDate) >= sevenHoursAgo
  })

  const parsedTenders = recentItems.map(item => parseRSSItem({
    title: item.title,
    link: item.link,
    contentSnippet: item.contentSnippet,
    pubDate: item.pubDate,
  }))

  // ── Step 2: Load active alert configs ────────────────────────────────────
  const configsSnap = await db.collection('alertConfigs')
    .where('active', '==', true)
    .get()

  let alertsSent = 0

  // ── Step 3: Match and notify ─────────────────────────────────────────────
  for (const configDoc of configsSnap.docs) {
    const config = configDoc.data() as AlertConfig
    const uid = configDoc.id

    // Load user profile for notification contact info
    let userProfile: UserProfile | null = null
    try {
      const userSnap = await db.collection('users').doc(uid).get()
      if (!userSnap.exists) continue  // Admin SDK: .exists is a boolean property, not a method
      userProfile = userSnap.data() as UserProfile
    } catch {
      continue
    }

    // Only send alerts to Pro users
    if (userProfile.plan !== 'pro') continue

    // Find matching tenders
    const matches = parsedTenders.filter(t => matchesAlertConfig(t, config))
    if (matches.length === 0) continue

    // Send for the first match only (avoid notification spam — max 1 per run per user)
    const tender = matches[0]!
    const message = formatAlertMessage(tender)

    const promises: Promise<boolean>[] = []

    if (config.channels.push && userProfile.fcmToken) {
      promises.push(
        sendFCMAlert(userProfile.fcmToken, {
          title: 'नया Tender मिला! 🎯',
          body: tender.title,
          link: tender.link,
        })
      )
    }

    if (config.channels.whatsapp && userProfile.phone) {
      promises.push(sendWhatsAppAlert(userProfile.phone, message))
    }

    if (config.channels.email && userProfile.email) {
      promises.push(
        sendAlertEmail({
          to: userProfile.email,
          subject: `नया Tender: ${tender.title}`,
          tenderTitle: tender.title,
          tenderLink: tender.link,
          message,
        })
      )
    }

    const results = await Promise.allSettled(promises)
    const anySent = results.some(r => r.status === 'fulfilled' && r.value === true)
    if (anySent) alertsSent++
  }

  // ── Step 4: Document expiry alerts ───────────────────────────────────────
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  let expirySent = 0

  try {
    const expiringDocs = await db.collection('documents')
      .where('expiresAt', '>=', Timestamp.fromDate(now))
      .where('expiresAt', '<=', Timestamp.fromDate(thirtyDaysFromNow))
      .get()

    for (const docSnap of expiringDocs.docs) {
      const data = docSnap.data()
      if (data.expiryAlertSent === true) continue

      // Load user profile
      const userSnap = await db.collection('users').doc(data.userId).get()
      if (!userSnap.exists) continue  // Admin SDK: boolean property, not method
      const user = userSnap.data() as UserProfile
      if (user.plan !== 'pro') continue

      const daysLeft = Math.round((data.expiresAt.toDate().getTime() - now.getTime()) / 86_400_000)
      const expiryMsg = `⚠️ ${data.type?.toUpperCase() ?? 'Document'} ${daysLeft} दिन में expire होगी। Renew करें।`

      const expiryPromises: Promise<boolean>[] = []

      // Load user alert config for channels
      const alertConfigSnap = await db.collection('alertConfigs').doc(data.userId).get()
      const channels = alertConfigSnap.exists  // Admin SDK: boolean property, not method
        ? (alertConfigSnap.data() as AlertConfig).channels
        : { push: true, whatsapp: false, email: false }

      if (channels.push && user.fcmToken) {
        expiryPromises.push(
          sendFCMAlert(user.fcmToken, {
            title: '⚠️ Document Expiry Alert',
            body: expiryMsg,
          })
        )
      }

      if (channels.whatsapp && user.phone) {
        expiryPromises.push(sendWhatsAppAlert(user.phone, expiryMsg))
      }

      if (channels.email && user.email) {
        expiryPromises.push(
          sendAlertEmail({
            to: user.email,
            subject: `Document Expiry: ${daysLeft} दिन बाकी`,
            tenderTitle: `${data.type?.toUpperCase() ?? 'Document'} expiry`,
            tenderLink: 'https://tendersarthi.com/en/documents',
            message: expiryMsg,
          })
        )
      }

      await Promise.allSettled(expiryPromises)
      await docSnap.ref.update({ expiryAlertSent: true })
      expirySent++
    }
  } catch (err) {
    console.error('[Alerts] Expiry check error:', err)
  }

  return NextResponse.json({
    ok: true,
    parsed: parsedTenders.length,
    alertsSent,
    expirySent,
    timestamp: now.toISOString(),
  })
}
