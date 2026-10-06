/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// 다크 모드: 앱에서 쓰는 색 팔레트를 CSS 변수로 바꿔 <html class="dark"> 일 때 한 번에 전환
// (컴포넌트마다 dark: 클래스를 달지 않아도 전체 화면이 따라감)
const PALETTES = ['slate', 'indigo', 'blue', 'amber', 'rose', 'emerald', 'sky', 'violet'];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// slate: 밝기 반전 / 강조색: 옅은 배경(50~200) ↔ 진한 글자(700~950) 교환, 중간(300~600)은 유지
const SLATE_DARK = { 50: 800, 100: 800, 200: 700, 300: 600, 400: 400, 500: 400, 600: 300, 700: 200, 800: 100, 900: 50, 950: 50 };
const ACCENT_DARK = { 50: 950, 100: 900, 200: 800, 300: 300, 400: 400, 500: 500, 600: 600, 700: 300, 800: 200, 900: 100, 950: 50 };

const rgb = (hex) => {
  const v = parseInt(hex.replace('#', ''), 16);
  return `${(v >> 16) & 255} ${(v >> 8) & 255} ${v & 255}`;
};
const varColor = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

// 바탕: 흰 화면 하나에 얇은 구분선 (카드를 회색 위에 띄우지 않음)
const lightVars = {
  '--c-surface': rgb('#ffffff'),
  '--c-page': rgb('#ffffff')
};
const darkVars = {
  '--c-surface': rgb(colors.slate[900]),
  '--c-page': rgb(colors.slate[900])
};
// 포인트 색은 블루 한 가지: 코드에서 쓰던 indigo 도 블루로 (화면 전체 색 통일)
const source = (p) => (p === 'indigo' ? colors.blue : colors[p]);
PALETTES.forEach((p) => {
  const map = p === 'slate' ? SLATE_DARK : ACCENT_DARK;
  SHADES.forEach((s) => {
    lightVars[`--c-${p}-${s}`] = rgb(source(p)[s]);
    darkVars[`--c-${p}-${s}`] = rgb(source(p)[map[s]]);
  });
});

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    // 글씨 굵기를 한 단계씩 가볍게 (굵은 글씨가 너무 많아 복잡해 보이던 것)
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '500',
      extrabold: '600',
      black: '700'
    },
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif']
      },
      colors: {
        page: varColor('page'),
        ...Object.fromEntries(PALETTES.map((p) => [p, Object.fromEntries(SHADES.map((s) => [s, varColor(`${p}-${s}`)]))]))
      },
      // 카드 배경(bg-white)만 다크에서 어둡게. 색 버튼 위 흰 글자(text-white)는 그대로 흰색
      backgroundColor: { white: varColor('surface') },
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
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ':root': lightVars, '.dark': { ...darkVars, colorScheme: 'dark' } });
    })
  ]
};
