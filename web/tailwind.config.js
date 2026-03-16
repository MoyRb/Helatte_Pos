/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF6FA',
        mint: '#F72585',
        blush: '#FFD6E7',
        coffee: '#111111',
        accent: '#FF5FA2',
      },
      boxShadow: {
        card: '0 10px 25px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
