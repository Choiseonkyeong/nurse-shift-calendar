// src/lib/accentPref.js
// 앱 포인트 색 (이 기기에만 저장). 코드 전체가 쓰는 blue·indigo 색 변수를 고른 색으로 바꿔 끼움
// 다크 모드는 tailwind.config.js 와 같은 규칙(옅은 바탕 ↔ 진한 글자 교환)으로 계산
const KEY = 'accent_pref';
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const ACCENT_DARK = { 50: 950, 100: 900, 200: 800, 300: 300, 400: 400, 500: 500, 600: 600, 700: 300, 800: 200, 900: 100, 950: 50 };

// Tailwind 색 (50~950)
const PALETTES = {
  blue: ['#f4f6fc', '#e8edf9', '#d7e0f4', '#c3cef5', '#a5b5e1', '#7e94c6', '#586da3', '#465886', '#37466d', '#2b3756', '#1a2238'],
  pink: ['#fff5f8', '#fce8ef', '#f7d6e2', '#f2bfd0', '#e39fb7', '#c67594', '#a15473', '#85435f', '#6e374f', '#582d40', '#361a27'],
  violet: ['#faf6fd', '#f1eafa', '#e8dcf5', '#dbcaf0', '#c5ace2', '#a786c8', '#8061aa', '#6a4c91', '#573e77', '#46325f', '#2c1e3e'],
  teal: ['#f1faf6', '#e1f2e9', '#d1ebdf', '#bce2d4', '#96ccba', '#65a58f', '#357567', '#285e53', '#204e45', '#1a3f38', '#102922'],
  sky: ['#f2f9fd', '#e4f2fa', '#d2eaf6', '#badff2', '#96c8e1', '#69a7c8', '#397ba3', '#2c6387', '#24516f', '#1d425a', '#122a3c'],
  black: ['#fafafa', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#27272a', '#18181b', '#121214', '#09090b', '#000000']
};

export const ACCENTS = [
  { key: 'blue', label: '파스텔 블루', hex: '#c3cef5' },
  { key: 'pink', label: '연분홍', hex: '#f2bfd0' },
  { key: 'violet', label: '라벤더', hex: '#dbcaf0' },
  { key: 'teal', label: '민트', hex: '#bce2d4' },
  { key: 'sky', label: '하늘색', hex: '#badff2' },
  { key: 'black', label: '검정', hex: '#27272a' }
];
export const DEFAULT_ACCENT = 'blue';

export function getAccentPref() {
  try {
    const v = localStorage.getItem(KEY);
    return ACCENTS.some((a) => a.key === v) ? v : DEFAULT_ACCENT;
  } catch (e) {
    return DEFAULT_ACCENT;
  }
}

const rgb = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return `${(v >> 16) & 255} ${(v >> 8) & 255} ${v & 255}`;
};

// 다크 모드의 옅은 바탕(50~200): 아주 진한 색(950 등) 대신 어두운 바탕(#0f172a)에 포인트 색을 살짝 섞음
// (핑크 950 은 와인색처럼 무거워 보여서)
const DARK_BASE = '#0f172a';
const mix = (hex, base, t) => {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(base.slice(1), 16);
  const ch = (v, sh) => (v >> sh) & 255;
  const c = (sh) => Math.round(ch(a, sh) * t + ch(b, sh) * (1 - t));
  return `#${[16, 8, 0].map((sh) => c(sh).toString(16).padStart(2, '0')).join('')}`;
};
const DARK_TINT = { 50: 0.14, 100: 0.22, 200: 0.32 };

/** 고른 색의 CSS 변수 (blue·indigo 둘 다) — 없는 키면 '' */
export function accentCss(key = getAccentPref()) {
  const pal = PALETTES[key];
  if (!pal) return '';
  const at = (s) => pal[SHADES.indexOf(s)];
  const darkAt = (s) => (DARK_TINT[s] ? mix(at(500), DARK_BASE, DARK_TINT[s]) : at(ACCENT_DARK[s]));
  const vars = (get) => SHADES.map((s) => ['blue', 'indigo'].map((p) => `--c-${p}-${s}:${rgb(get(s))};`).join('')).join('');
  // 배경 버튼의 진한 색은 유지하고, 다크 모드 강조 글자만 밝게 (검정 선택 시에도 읽히게).
  const darkText = ['blue', 'indigo'].flatMap((p) => [500, 600].map((shade) => `.dark .text-${p}-${shade}`)).join(',');
  return `:root{${vars(at)}}.dark{${vars(darkAt)}}${darkText}{color:rgb(${rgb(at(300))});}`;
}

export function applyAccent(key = getAccentPref()) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('accent-vars');
  if (!el) {
    el = document.createElement('style');
    el.id = 'accent-vars';
    document.head.appendChild(el); // 앱 CSS 보다 뒤라서 같은 변수를 덮어씀
  }
  el.textContent = accentCss(key);
}

export function setAccentPref(key) {
  try {
    if (key === DEFAULT_ACCENT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, key);
  } catch (e) {
    /* 무시 */
  }
  applyAccent(key);
}
