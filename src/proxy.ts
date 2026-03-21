import createMiddleware from 'next-intl/middleware'
import { LOCALE_CODES } from './lib/constants'

export default createMiddleware({
  locales: [...LOCALE_CODES],
  defaultLocale: 'hi',
  localePrefix: 'always',
})

export const config = {
  // Match all routes EXCEPT:
  // - /api/* (backend routes — must NOT have locale prefix)
  // - /_next/* (Next.js internals)
  // - /_vercel/* (Vercel internals)
  // - files with extensions (images, fonts, etc.)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)', '/'],
}
