/**
 * Server-only admin authentication helper.
 * Verifies Firebase ID token AND checks email matches ADMIN_EMAIL env var.
 * Never import in 'use client' components.
 */
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'

export interface AdminClaims {
  uid:   string
  email: string
}

/**
 * Verifies the Authorization: Bearer <token> header and confirms the
 * token belongs to the configured admin email.
 * Returns null if token is missing, invalid, or email doesn't match.
 */
export async function verifyAdminToken(req: Request): Promise<AdminClaims | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return null

  try {
    const decoded = await getAuth().verifyIdToken(token)
    const email = decoded.email
    if (!email || email !== adminEmail) return null
    return { uid: decoded.uid, email }
  } catch {
    return null
  }
}

/** Returns a 401 JSON response for unauthorized requests. */
export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
