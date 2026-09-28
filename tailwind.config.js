/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // 코드에서 사용 중인 Tailwind v4 명칭 호환
      boxShadow: {
        '2xs': '0 1px rgb(0 0 0 / 0.05)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
      },
      backdropBlur: {
        xs: '4px'
      }
    }
  },
  plugins: []
};
