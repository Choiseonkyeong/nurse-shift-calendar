// 글자 크기 설정: CSS 의 font-size·line-height(px/rem) 에 --font-scale 을 곱함 (src/lib/fontPref.js)
const UNIT = /^(-?\d*\.?\d+)(px|rem)$/;
const fontScale = () => ({
  postcssPlugin: 'font-scale',
  Declaration(decl) {
    if (decl.prop !== 'font-size' && decl.prop !== 'line-height') return;
    const value = decl.value.trim();
    if (!UNIT.test(value)) return;
    decl.value = `calc(${value} * var(--font-scale, 1))`;
  }
});
fontScale.postcss = true;
export default fontScale;
