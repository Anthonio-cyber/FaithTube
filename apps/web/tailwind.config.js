/** @type {import('tailwindcss').Config} */
export default {
  // The theme is chosen by the person, not by their OS, so `dark:` variants must
  // follow the .dark class the ThemeProvider sets — not prefers-color-scheme.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The FaithTube palette. Deliberately unlike any existing video platform:
        // deep navy ground, warm gold accent, cream surfaces.
        navy: {
          DEFAULT: '#0B1730',
          deep: '#060D1D',
          soft: '#152444',
          muted: '#1E3054',
          line: '#26385E',
        },
        gold: {
          DEFAULT: '#D8A24A',
          soft: '#F0CE8E',
          deep: '#B07F2E',
        },
        cream: {
          DEFAULT: '#FBF7EF',
          dim: '#F2EBDD',
        },
        plum: '#3A2A5C',
        mist: '#E4E9F2',
        verified: '#3FA37A',
        warn: '#C8792F',
        danger: '#B4453C',
      },
      fontFamily: {
        // Fraunces carries the brand voice; Outfit does the interface work.
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Outfit', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        card: '0 1px 2px rgba(6,13,29,0.06), 0 8px 24px -12px rgba(6,13,29,0.28)',
        lift: '0 2px 4px rgba(6,13,29,0.08), 0 18px 40px -18px rgba(6,13,29,0.45)',
        glow: '0 0 0 1px rgba(216,162,74,0.35), 0 12px 40px -16px rgba(216,162,74,0.55)',
      },
      backgroundImage: {
        'ray': 'radial-gradient(120% 100% at 50% 0%, rgba(240,206,142,0.16) 0%, rgba(240,206,142,0) 62%)',
        'dawn': 'linear-gradient(165deg, #152444 0%, #0B1730 48%, #060D1D 100%)',
        'gilt': 'linear-gradient(120deg, #F0CE8E 0%, #D8A24A 45%, #B07F2E 100%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-480px 0' }, '100%': { backgroundPosition: '480px 0' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
      },
      animation: {
        'fade-up': 'fade-up 320ms cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
