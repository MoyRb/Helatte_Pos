/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#E85A9B',
        primaryHover: '#D94A8B',
        primarySoft: '#F9DCE8',
        secondarySoft: '#FDF4F8',
        accentDark: '#2B2B2B',
        textPrimary: '#2F2A2D',
        textMuted: '#6F6870',
        borderSoft: '#E9D8E1',
        surface: '#FFFDFE',
        background: '#F8F3F6',
        cream: '#FDF4F8',
        mint: '#E85A9B',
        blush: '#F9DCE8',
        coffee: '#2F2A2D',
        accent: '#D94A8B',
      },
      boxShadow: {
        card: '0 14px 32px rgba(232, 90, 155, 0.10)',
      },
    },
  },
  plugins: [],
};
