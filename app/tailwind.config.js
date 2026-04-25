/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui'],
        mono: ['Geist Mono', 'ui-monospace', 'Menlo'],
      },
      borderRadius: {
        card: '18px',
        hero: '22px',
        btn: '10px',
      },
    },
  },
  plugins: [],
};
