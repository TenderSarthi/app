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

export default withNextIntl(pwaConfig({} as NextConfig))
