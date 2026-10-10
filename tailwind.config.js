/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        navy: {
          50: '#f1f5fb', 100: '#e1e9f6', 200: '#c3d3ec', 300: '#93afd9', 400: '#5c85c0',
          500: '#3a64a3', 600: '#264c85', 700: '#1c3b6b', 800: '#142c55', 900: '#0d2145', 950: '#081530',
        },
        gold: {
          50: '#fdf9ec', 100: '#faf0cd', 200: '#f5e09b', 300: '#efcb62', 400: '#e8b73a',
          500: '#d4a02a', 600: '#b57f1f', 700: '#8f5f1d', 800: '#744c1e', 900: '#613f1d',
        },
        mtn: '#ffcc00',
        orange: { om: '#ff6600' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(13,33,69,.06), 0 8px 24px -8px rgba(13,33,69,.12)',
        pop: '0 20px 50px -12px rgba(13,33,69,.35)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: 0 }, '70%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        draw: { to: { strokeDashoffset: 0 } },
      },
      animation: { rise: 'rise .35s ease-out both', pop: 'pop .45s cubic-bezier(.2,.9,.3,1.2) both', draw: 'draw .5s .2s ease-out forwards' },
    },
  },
  plugins: [],
}
