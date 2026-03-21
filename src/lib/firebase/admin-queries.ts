/**
 * Firestore Admin SDK queries for the admin panel.
 * Server-only — never import in 'use client' components.
 *
 * NOTE: Admin SDK DocumentSnapshot uses `.exists` as a boolean PROPERTY (not a method).
 * Client SDK uses `.exists()` as a METHOD. Do not mix patterns across SDK boundaries.
 */
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'

function db() { return getFirestore() }

// ── User queries ──────────────────────────────────────────────────────────

export interface AdminUser {
  uid:          string
  name:         string
  email:        string | null
  phone:        string | null
  plan:         string
  trialUsed:    boolean
  createdAt:    string  // ISO string
  proSince:     string | null
  proRenewsAt:  string | null
  deletionRequested: boolean
}

/** List the 50 most-recently-signed-up users. */
export async function listUsers(): Promise<AdminUser[]> {
  const snap = await db()
    .collection('users')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  return snap.docs.map((d) => {
    const data = d.data()
    return {
      uid:               d.id,
      name:              data.name ?? '',
      email:             data.email ?? null,
      phone:             data.phone ?? null,
      plan:              data.plan ?? 'free',
      trialUsed:         data.trialUsed ?? false,
      createdAt:         (data.createdAt as Timestamp)?.toDate().toISOString() ?? '',
      proSince:          (data.proSince as Timestamp | null)?.toDate().toISOString() ?? null,
      proRenewsAt:       (data.proRenewsAt as Timestamp | null)?.toDate().toISOString() ?? null,
      deletionRequested: data.deletionRequested ?? false,
    }
  })
}

/** Manually override a user's plan (admin support action). */
export async function setUserPlan(uid: string, plan: 'free' | 'pro'): Promise<void> {
  const updates: Record<string, unknown> = { plan }
  if (plan === 'pro') {
    // Manual Pro grant: set proSince and clear any pending downgrade
    updates.proSince               = FieldValue.serverTimestamp()
    updates.scheduledDowngradeAt   = null
  } else {
    // Manual downgrade to free: clear paid subscription state
    updates.proSince               = null
    updates.proRenewsAt            = null
    updates.scheduledDowngradeAt   = null
    updates.razorpaySubscriptionId = null
  }
  await db().doc(`users/${uid}`).update(updates)
}

/** Delete a user's Firestore document and Firebase Auth account. */
export async function deleteUserData(uid: string): Promise<void> {
  await db().doc(`users/${uid}`).delete()
  try {
    await getAuth().deleteUser(uid)
  } catch {
    // User may not exist in Auth — ignore
  }
}

// ── Stats queries ─────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers:    number
  proUsers:      number
  freeUsers:     number
  signupsToday:  number
  signupsWeek:   number
  signupsMonth:  number
  deletionRequests: number
}

export async function getAdminStats(): Promise<AdminStats> {
  const now     = new Date()
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today.getTime() - 7  * 24 * 60 * 60 * 1000)
  const monAgo  = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const results = await Promise.allSettled([
    db().collection('users').count().get(),
    db().collection('users').where('plan', '==', 'pro').count().get(),
    db().collection('users').where('createdAt', '>=', Timestamp.fromDate(today)).count().get(),
    db().collection('users').where('createdAt', '>=', Timestamp.fromDate(weekAgo)).count().get(),
    db().collection('users').where('createdAt', '>=', Timestamp.fromDate(monAgo)).count().get(),
    db().collection('users').where('deletionRequested', '==', true).count().get(),
  ])

  const count = (i: number) =>
    results[i].status === 'fulfilled' ? results[i].value.data().count : 0

  const total = count(0)
  const pro   = count(1)

  return {
    totalUsers:      total,
    proUsers:        pro,
    freeUsers:       total - pro,
    signupsToday:    count(2),
    signupsWeek:     count(3),
    signupsMonth:    count(4),
    deletionRequests: count(5),
  }
}

// ── Article queries ───────────────────────────────────────────────────────

export interface AdminArticle {
  id:         string
  category:   string
  readMinutes: number
  youtubeId:  string | null
  titleEn:    string
  titleHi:    string
  summaryEn:  string
  summaryHi:  string
  bodyEn:     string    // \n-separated paragraphs (stored as joined string for CMS textarea)
  bodyHi:     string
  published:  boolean
  createdAt:  string
}

export async function listAdminArticles(): Promise<AdminArticle[]> {
  const snap = await db().collection('articles').orderBy('createdAt', 'desc').get()
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id:          d.id,
      category:    data.category ?? 'getting_started',
      readMinutes: data.readMinutes ?? 1,
      youtubeId:   data.youtubeId ?? null,
      titleEn:     data.titleEn ?? '',
      titleHi:     data.titleHi ?? '',
      summaryEn:   data.summaryEn ?? '',
      summaryHi:   data.summaryHi ?? '',
      bodyEn:      Array.isArray(data.bodyEn) ? data.bodyEn.join('\n') : (data.bodyEn ?? ''),
      bodyHi:      Array.isArray(data.bodyHi) ? data.bodyHi.join('\n') : (data.bodyHi ?? ''),
      published:   data.published ?? true,
      createdAt:   (data.createdAt as Timestamp)?.toDate().toISOString() ?? '',
    }
  })
}

export interface ArticleInput {
  id:          string
  category:    string
  readMinutes: number
  youtubeId:   string | null
  titleEn:     string
  titleHi:     string
  summaryEn:   string
  summaryHi:   string
  bodyEn:      string   // \n-separated paragraphs
  bodyHi:      string
  published:   boolean
}

export async function createAdminArticle(input: ArticleInput): Promise<void> {
  const ref = db().doc(`articles/${input.id}`)
  const { id: _id, ...fields } = input
  await ref.set({
    ...fields,
    bodyEn:    input.bodyEn.split('\n').filter(Boolean),
    bodyHi:    input.bodyHi.split('\n').filter(Boolean),
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function updateAdminArticle(id: string, input: Partial<Omit<ArticleInput, 'id'>>): Promise<void> {
  const data: Record<string, unknown> = { ...input, updatedAt: FieldValue.serverTimestamp() }
  if (typeof input.bodyEn === 'string') data.bodyEn = input.bodyEn.split('\n').filter(Boolean)
  if (typeof input.bodyHi === 'string') data.bodyHi = input.bodyHi.split('\n').filter(Boolean)
  await db().doc(`articles/${id}`).update(data)
}

export async function deleteAdminArticle(id: string): Promise<void> {
  await db().doc(`articles/${id}`).delete()
}
