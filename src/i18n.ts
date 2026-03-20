import { getRequestConfig } from 'next-intl/server'
import { LOCALE_CODES } from './lib/constants'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = (LOCALE_CODES as readonly string[]).includes(requested as string)
    ? (requested as string)
    : 'en'

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
