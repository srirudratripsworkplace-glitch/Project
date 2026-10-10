import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        ocean: {
          50: '#edfafa',
          100: '#d4f2f0',
          200: '#a9e4df',
          500: '#148b8d',
          600: '#0d7077',
          700: '#0b5960',
          800: '#09484f',
          900: '#08353a',
          950: '#05292d',
        },
        pine: '#123f35',
        sunrise: '#f7b267',
      },
      boxShadow: {
        soft: '0 20px 60px rgba(8, 53, 58, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config;
