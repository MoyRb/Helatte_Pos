/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
        primary: '#DF9FC3',
        primaryHover: '#D58BB4',
        primarySoft: '#F4E6EE',
        secondarySoft: '#F3EFDF',
        accentDark: '#2F3133',
        textPrimary: '#2F3133',
        textMuted: '#6F7470',
        borderSoft: '#D9DDD6',
        surface: '#FFFCF8',
        background: '#F9F7F0',
        cream: '#F9F7F0',
        coffee: '#2F3133',
        accent: '#6F8FA6',
        danger: '#C889A8',
      },
      boxShadow: {
        card: '0 16px 36px rgba(167, 204, 229, 0.16)',
        soft: '0 10px 24px rgba(47, 49, 51, 0.06)',
      },
    },
  },
  plugins: [],
};
