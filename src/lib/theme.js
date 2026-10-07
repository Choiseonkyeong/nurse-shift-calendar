// src/lib/theme.js
// 화면 테마: system(기기 설정 따름) | dark | light — <html class="dark"> 로 전환
const KEY = 'theme_pref';
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : 'system';
  } catch (e) {
    return 'system';
  }
}

export function applyTheme(pref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && Boolean(media()?.matches));
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#ffffff');
  return dark;
}

export function setThemePref(pref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch (e) {
    /* 무시 */
  }
  applyTheme(pref);
}

/** 기기 다크 모드 설정이 바뀌면 (system 일 때) 따라감 */
export function watchSystemTheme() {
  const m = media();
  if (!m) return () => {};
  const onChange = () => getThemePref() === 'system' && applyTheme('system');
  m.addEventListener?.('change', onChange);
  return () => m.removeEventListener?.('change', onChange);
}
