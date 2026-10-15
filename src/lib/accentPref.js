// src/lib/accentPref.js
// 앱 포인트 색 (이 기기에만 저장). 코드 전체가 쓰는 blue·indigo 색 변수를 고른 색으로 바꿔 끼움
// 다크 모드는 tailwind.config.js 와 같은 규칙(옅은 바탕 ↔ 진한 글자 교환)으로 계산
const KEY = 'accent_pref';
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const ACCENT_DARK = { 50: 950, 100: 900, 200: 800, 300: 300, 400: 400, 500: 500, 600: 600, 700: 300, 800: 200, 900: 100, 950: 50 };

// Tailwind 색 (50~950)
const PALETTES = {
  pink: ['#fdf2f8', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d', '#831843', '#500724'],
  violet: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#2e1065'],
  teal: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#042f2e'],
  sky: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e', '#082f49'],
  blue: null // tailwind.config.js 기본값 그대로
};

export const ACCENTS = [
  { key: 'pink', label: '벚꽃 핑크', hex: '#ec4899' },
  { key: 'violet', label: '라벤더', hex: '#8b5cf6' },
  { key: 'teal', label: '민트', hex: '#14b8a6' },
  { key: 'sky', label: '하늘', hex: '#0ea5e9' },
  { key: 'blue', label: '블루', hex: '#3b82f6' }
];
export const DEFAULT_ACCENT = 'pink';

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

/** 고른 색의 CSS 변수 (blue·indigo 둘 다) — 기본 블루면 '' */
export function accentCss(key = getAccentPref()) {
  const pal = PALETTES[key];
  if (!pal) return '';
  const at = (s) => pal[SHADES.indexOf(s)];
  const darkAt = (s) => (DARK_TINT[s] ? mix(at(500), DARK_BASE, DARK_TINT[s]) : at(ACCENT_DARK[s]));
  const vars = (get) => SHADES.map((s) => ['blue', 'indigo'].map((p) => `--c-${p}-${s}:${rgb(get(s))};`).join('')).join('');
  return `:root{${vars(at)}}.dark{${vars(darkAt)}}`;
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
