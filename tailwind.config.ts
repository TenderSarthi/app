import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#1A3766',
        orange:  '#F97316',
        gold:    '#D97706',
        success: '#16A34A',
        danger:  '#DC2626',
        muted:   '#6B7280',
        lightbg: '#F0F4FB',
      },
      fontFamily: {
        heading: ['var(--font-poppins)', 'sans-serif'],
        body:    ['var(--font-inter)', 'sans-serif'],
      },
      screens: {
        tablet: '768px',
        desktop: '1024px',
      },
    },
  },
}
export default config
