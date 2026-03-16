/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#F72585',
        secondary: '#FFD6E7',
        accent: '#111111',
        highlight: '#FF5FA2',
        surface: '#FFF6FA',
        background: '#F3EFF2',
        texto: '#111111'
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
