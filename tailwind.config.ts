import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ui-text)',
        accent: 'var(--ui-accent)',
        border: 'var(--ui-line)',
      },
      boxShadow: {
        card: 'var(--ui-shadow)',
      },
      fontFamily: {
        sans: ['var(--ui-font-family)'],
        mono: ['var(--ui-code-font-family)'],
      },
    },
  },
  plugins: [],
} satisfies Config;
