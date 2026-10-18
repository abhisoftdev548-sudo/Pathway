/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f6f7f9',
        surface: '#ffffff',
        line: '#e4e6ec',
        'line-strong': '#d3d6e0',
        ink: {
          DEFAULT: '#16181d',
          soft: '#4a4f5c',
          muted: '#767c8a',
          faint: '#9aa0ad',
        },
        brand: {
          50: '#f2f1fe',
          100: '#e7e5fd',
          200: '#d3cffa',
          300: '#b4abf5',
          400: '#9182ec',
          500: '#7359df',
          600: '#6139cd',
          700: '#522ca8',
          800: '#442787',
          900: '#39226c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.625rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 18 27 / 0.04)',
        pop: '0 8px 24px -6px rgb(16 18 27 / 0.16), 0 2px 6px -2px rgb(16 18 27 / 0.08)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'slide-up': 'slide-up 140ms ease-out',
      },
    },
  },
  plugins: [],
};
