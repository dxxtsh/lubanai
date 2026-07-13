/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // LubanAI 品牌深色主题
        luban: {
          bg: '#0f1117',
          surface: '#1a1d27',
          border: '#2a2d3a',
          primary: '#6c5ce7',
          accent: '#00cec9',
          text: '#e2e8f0',
          muted: '#64748b',
        },
      },
    },
  },
  plugins: [],
};
