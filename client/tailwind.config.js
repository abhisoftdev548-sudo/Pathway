/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Primary — purple (buttons, active nav, links, selected filters)
        brand: {
          50: '#F0EBFF',
          100: '#E4DAFF',
          200: '#C9B8FC',
          300: '#A78BF5',
          400: '#8B67EF',
          500: '#7C4FF0',
          600: '#6938EF',
          700: '#5925DC',
          800: '#4A1DB8',
          900: '#3D1A94',
        },
        // Surfaces
        background: '#F6F8FC',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F1F4F9',
        },
        // Text — dark navy headings, muted blue-grey body (AA contrast on white)
        heading: '#182238',
        body: '#65748B',
        muted: '#94A3B8',
        // Borders
        line: {
          DEFAULT: '#E5EAF2',
          strong: '#D5DEEB',
        },
        // Meaningful statuses only — refined for accessible text contrast
        success: {
          DEFAULT: '#0D7C5E',
          soft: '#E8FAF3',
        },
        warning: {
          DEFAULT: '#B45309',
          soft: '#FFF7E6',
        },
        danger: {
          DEFAULT: '#CE3B3B',
          soft: '#FFF0F0',
        },
        info: {
          DEFAULT: '#1573C4',
          soft: '#EAF6FF',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(24 34 56 / 0.04), 0 1px 4px -1px rgb(24 34 56 / 0.05)',
        pop: '0 12px 28px -8px rgb(24 34 56 / 0.12), 0 4px 12px -4px rgb(24 34 56 / 0.06)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
