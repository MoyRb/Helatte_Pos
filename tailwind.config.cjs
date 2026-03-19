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
        butter: '#E7E7AE',
        butterDeep: '#8C8457',
        sky: '#A7CCE5',
        skyDeep: '#6F8FA6',
        blush: '#DF9FC3',
        blushDeep: '#946784',
        mint: '#B6D8B8',
        mintDeep: '#628165',
        ivory: '#F9F7F0',
        text: '#2F3133',
        borderSoft: '#D9DDD6',
        primary: '#DF9FC3',
        secondary: '#A7CCE5',
        highlight: '#E7E7AE',
        surface: '#F9F7F0',
        background: '#F9F7F0',
        texto: '#2F3133',
        accent: '#2F3133',
        secondarySoft: '#EEF4F7',
        primarySoft: '#F5E7EF'
      },
      boxShadow: {
        soft: '0 12px 34px rgba(47, 49, 51, 0.06)',
        card: '0 14px 34px rgba(47, 49, 51, 0.07)'
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
