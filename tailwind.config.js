/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        banking: {
          navy: '#0A2540',
          dark: '#0F172A',
          surface: '#1E293B',
          border: '#334155',
          accent: '#0066FF',
          gold: '#D97706',
          green: '#059669',
        }
      }
    },
  },
  plugins: [],
};
