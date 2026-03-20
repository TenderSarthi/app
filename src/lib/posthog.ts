import posthog from 'posthog-js'

let initialized = false

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: false,
    persistence: 'localStorage',
  })
  initialized = true
}

export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(event, props)
}

export function identifyUser(uid: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.identify(uid, props)
}

export function resetAnalytics() {
  if (typeof window === 'undefined') return
  posthog.reset()
}
