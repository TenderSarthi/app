import createMiddleware from 'next-intl/middleware'
import { LOCALE_CODES } from './lib/constants'

export default createMiddleware({
  locales: [...LOCALE_CODES],
  defaultLocale: 'hi',
  localePrefix: 'always',
})

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)', '/'],
}
