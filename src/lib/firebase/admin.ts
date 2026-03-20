import { getApps, initializeApp, cert, App } from 'firebase-admin/app'

let adminApp: App

if (getApps().length === 0) {
  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
} else {
  adminApp = getApps()[0]!
}

export { adminApp }
