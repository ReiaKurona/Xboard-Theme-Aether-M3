/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      transitionTimingFunction: {
        // Android 17 标准弹性物理曲线 (Spring Physics)
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'expressive': 'cubic-bezier(0.2, 0, 0, 1)'
      }
    },
  },
  plugins: [],
}