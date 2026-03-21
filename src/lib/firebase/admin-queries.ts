/**
 * Firestore Admin SDK queries for the admin panel.
 * Server-only — never import in 'use client' components.
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
  await db().doc(`users/${uid}`).update({ plan })
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

  const [allSnap, proSnap, todaySnap, weekSnap, monthSnap, deleteSnap] = await Promise.all([
    db().collection('users').count().get(),
    db().collection('users').where('plan', '==', 'pro').count().get(),
    db().collection('users').where('createdAt', '>=', Timestamp.fromDate(today)).count().get(),
    db().collection('users').where('createdAt', '>=', Timestamp.fromDate(weekAgo)).count().get(),
    db().collection('users').where('createdAt', '>=', Timestamp.fromDate(monAgo)).count().get(),
    db().collection('users').where('deletionRequested', '==', true).count().get(),
  ])

  const total = allSnap.data().count
  const pro   = proSnap.data().count

  return {
    totalUsers:      total,
    proUsers:        pro,
    freeUsers:       total - pro,
    signupsToday:    todaySnap.data().count,
    signupsWeek:     weekSnap.data().count,
    signupsMonth:    monthSnap.data().count,
    deletionRequests: deleteSnap.data().count,
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
  await ref.set({
    ...input,
    bodyEn:    input.bodyEn.split('\n').filter(Boolean),
    bodyHi:    input.bodyHi.split('\n').filter(Boolean),
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function updateAdminArticle(id: string, input: Partial<ArticleInput>): Promise<void> {
  const data: Record<string, unknown> = { ...input }
  if (typeof input.bodyEn === 'string') data.bodyEn = input.bodyEn.split('\n').filter(Boolean)
  if (typeof input.bodyHi === 'string') data.bodyHi = input.bodyHi.split('\n').filter(Boolean)
  await db().doc(`articles/${id}`).update(data)
}

export async function deleteAdminArticle(id: string): Promise<void> {
  await db().doc(`articles/${id}`).delete()
}
