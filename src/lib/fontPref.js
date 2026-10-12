// src/lib/fontPref.js
// 글꼴·글자 크기 (이 기기에만 저장). <html> 의 --font-sans / --font-scale 로 바꿈
// 글자 크기는 postcss.fontScale.js 가 CSS 의 모든 font-size·line-height 에 --font-scale 을 곱해 둠
const FONT_KEY = 'font_pref';
const SIZE_KEY = 'font_size_pref';
const FALLBACK = '-apple-system, BlinkMacSystemFont, system-ui, Roboto, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

// 기본 글꼴(원티드 산스)은 main.jsx 에서 바로 불러오고, 나머지는 고를 때만 내려받음
export const FONTS = [
  { key: 'wanted', label: '원티드 산스', desc: '기본 · 깔끔하고 단정한', family: '"Wanted Sans Variable", "Wanted Sans"' },
  { key: 'pretendard', label: '프리텐다드', desc: '예전 기본 글꼴', family: '"Pretendard Variable", Pretendard', load: () => import('pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css') },
  { key: 'suit', label: '수트', desc: '반듯하고 또렷한', family: '"SUIT Variable"', load: () => import('@sun-typeface/suit/fonts/variable/woff2/SUIT-Variable.css') },
  {
    key: 'batang',
    label: '고운바탕',
    desc: '우아한 명조',
    family: '"Gowun Batang"',
    load: () => Promise.all([import('@fontsource/gowun-batang/400.css'), import('@fontsource/gowun-batang/700.css')])
  },
  { key: 'dodum', label: '고운돋움', desc: '부드럽고 따뜻한', family: '"Gowun Dodum"', load: () => import('@fontsource/gowun-dodum/400.css') },
  { key: 'system', label: '기기 기본', desc: '휴대폰 글꼴 그대로', family: '' }
];

export const FONT_SIZES = [
  { key: 'sm', label: '작게', scale: 0.92 },
  { key: 'md', label: '보통', scale: 1 },
  { key: 'lg', label: '크게', scale: 1.08 },
  { key: 'xl', label: '아주 크게', scale: 1.16 }
];

const read = (key, list, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return list.some((x) => x.key === v) ? v : fallback;
  } catch (e) {
    return fallback;
  }
};
const write = (key, value, fallback) => {
  try {
    if (value === fallback) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    /* 무시 */
  }
};

export const getFontPref = () => read(FONT_KEY, FONTS, 'wanted');
export const getFontSizePref = () => read(SIZE_KEY, FONT_SIZES, 'md');

/** 글꼴 CSS 문자열 (그림 공유 등 캔버스에서도 씀) */
export const fontStack = (key = getFontPref()) => {
  const f = FONTS.find((x) => x.key === key);
  return f?.family ? `${f.family}, ${FALLBACK}` : FALLBACK;
};

export function applyFont(key = getFontPref(), sizeKey = getFontSizePref()) {
  const f = FONTS.find((x) => x.key === key);
  f?.load?.().catch(() => {}); // 못 내려받으면(오프라인) 기기 글꼴로 보임
  const root = document.documentElement.style;
  root.setProperty('--font-sans', fontStack(key));
  root.setProperty('--font-scale', String(FONT_SIZES.find((s) => s.key === sizeKey)?.scale || 1));
}

export function setFontPref(key) {
  write(FONT_KEY, key, 'wanted');
  applyFont(key);
}

export function setFontSizePref(key) {
  write(SIZE_KEY, key, 'md');
  applyFont(undefined, key);
}
