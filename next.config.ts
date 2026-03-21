import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa') as (config: object) => (next: NextConfig) => NextConfig

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Allow Firebase signInWithPopup to detect when the auth popup closes
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ]
  },
}

export default withNextIntl(pwaConfig(nextConfig))
