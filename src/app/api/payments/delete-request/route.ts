import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from 'firebase-admin/auth'
import '@/lib/firebase/admin'
import { requestAccountDeletion } from '@/lib/firebase/admin-firestore'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let uid: string
  try {
    const decoded = await getAuth().verifyIdToken(auth.slice(7))
    uid = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requestAccountDeletion(uid)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[delete-request] Failed to mark deletion for uid:', uid, err)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
