import type { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'

const TREMOR_COLOR_NAMES =
  '(blue|emerald|violet|amber|gray|cyan|pink|lime|fuchsia|red|orange|yellow|green|teal|indigo|purple|rose|sky)'
const TREMOR_COLOR_STEPS = '(50|100|200|300|400|500|600|700|800|900|950)'

const config: Config = {
  content: [
    './src/**/*.{html,js,ts,jsx,tsx,mdx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    transparent: 'transparent',
    current: 'currentColor',
    extend: {
      colors: {
        tremor: {
          brand: {
            faint: colors.orange[50],
            muted: colors.orange[200],
            subtle: colors.orange[400],
            DEFAULT: colors.orange[600],
            emphasis: colors.orange[700],
            inverted: colors.white,
          },
          background: {
            muted: colors.zinc[50],
            subtle: colors.zinc[100],
            DEFAULT: colors.white,
            emphasis: colors.zinc[700],
          },
          border: {
            DEFAULT: colors.zinc[200],
          },
          ring: {
            DEFAULT: colors.zinc[200],
          },
          content: {
            subtle: colors.zinc[400],
            DEFAULT: colors.zinc[500],
            emphasis: colors.zinc[700],
            strong: colors.zinc[900],
            inverted: colors.white,
          },
        },
        'dark-tremor': {
          brand: {
            faint: '#2A1306',
            muted: colors.orange[950],
            subtle: colors.orange[800],
            DEFAULT: colors.orange[500],
            emphasis: colors.orange[400],
            inverted: colors.white,
          },
          background: {
            muted: '#1A1A1E',
            subtle: colors.zinc[800],
            DEFAULT: colors.zinc[900],
            emphasis: colors.zinc[300],
          },
          border: {
            DEFAULT: colors.zinc[800],
          },
          ring: {
            DEFAULT: colors.zinc[800],
          },
          content: {
            subtle: colors.zinc[600],
            DEFAULT: colors.zinc[500],
            emphasis: colors.zinc[200],
            strong: colors.zinc[50],
            inverted: colors.zinc[950],
          },
        },
      },
      boxShadow: {
        'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'dark-tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card':
          '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'dark-tremor-card':
          '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'tremor-dropdown':
          '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'dark-tremor-dropdown':
          '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      borderRadius: {
        'tremor-small': '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full': '9999px',
      },
      fontSize: {
        'tremor-label': ['0.75rem', { lineHeight: '1rem' }],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }],
      },
    },
  },
  safelist: [
    {
      pattern:
        new RegExp(
          `^(bg-${TREMOR_COLOR_NAMES}-${TREMOR_COLOR_STEPS}|bg-opacity-[0-9]{1,3}|border-${TREMOR_COLOR_NAMES}-${TREMOR_COLOR_STEPS}|border-opacity-[0-9]{1,3}|text-${TREMOR_COLOR_NAMES}-${TREMOR_COLOR_STEPS}|text-opacity-[0-9]{1,3}|ring-${TREMOR_COLOR_NAMES}-${TREMOR_COLOR_STEPS}|ring-opacity-[0-9]{1,3})$`,
        ),
      variants: ['hover', 'ui-selected'],
    },
    {
      pattern:
        new RegExp(`^(stroke|fill)-${TREMOR_COLOR_NAMES}-${TREMOR_COLOR_STEPS}$`),
    },
  ],
  plugins: [require('@tailwindcss/forms')],
}
export default config
