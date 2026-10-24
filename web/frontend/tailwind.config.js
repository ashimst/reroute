/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c2d3ff',
          300: '#94b4fd',
          400: '#6089f8',
          500: '#3b63f1',
          600: '#2645e6',
          700: '#1e35d1',
          800: '#1e2ea9',
          900: '#1e2c86',
          950: '#161d57',
        },
        surface: {
          DEFAULT: '#0f1117',
          50:  '#f8f9ff',
          100: '#f0f1f9',
          200: '#dddff0',
          700: '#1c1f2e',
          800: '#141624',
          900: '#0f1117',
          950: '#090b10',
        },
      },
      animation: {
        'spin-slow':   'spin 3s linear infinite',
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':     'fadeIn 0.3s ease-out',
        'slide-up':    'slideUp 0.35s cubic-bezier(0.22,1,0.36,1)',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
