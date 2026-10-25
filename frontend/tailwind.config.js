/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF5500', // Noesis Electric Burnt Orange
          600: '#EA4B00',
          700: '#C23E00',
          800: '#9A3412',
          900: '#7C2D12',
          DEFAULT: '#FF5500',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
