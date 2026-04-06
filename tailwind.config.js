/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0D1F35',
          50: '#E8ECF1',
          100: '#C5D0DC',
          200: '#9AAFC4',
          300: '#6F8EAC',
          400: '#4A6F94',
          500: '#2B517C',
          600: '#1A3A5C',
          700: '#0D1F35',
          800: '#091629',
          900: '#050D1A',
        },
        gold: {
          DEFAULT: '#C9A96E',
          50: '#FAF6EE',
          100: '#F3E9D4',
          200: '#E8D4A9',
          300: '#DCBE7E',
          400: '#C9A96E',
          500: '#B8924F',
          600: '#9A7840',
          700: '#7C5F32',
          800: '#5E4724',
          900: '#3F2F17',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
