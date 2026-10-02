// src/lib/installHint.js
// 웹에서 '홈 화면에 추가' 안내
//  - 카카오톡·밴드·네이버 앱 등 앱 안 브라우저에는 홈 화면 추가 메뉴가 없음 → 크롬·사파리로 열도록 안내
//  - 안드로이드 크롬·삼성 인터넷: 설치 창(beforeinstallprompt)을 버튼으로 바로 띄움
//  - 아이폰 사파리: 공유 버튼 → 홈 화면에 추가 안내
export const INSTALL_HINT_KEY = 'install_hint_dismissed';

// 카카오톡 외 앱 안 브라우저 (병동 공지를 밴드로 돌리는 경우가 많음). 이 안에서는 홈 화면에 추가할 수 없음
const IN_APPS = [
  [/NAVER\(inapp/i, '네이버 앱'],
  [/\bBAND\//i, '밴드'],
  [/Instagram/i, '인스타그램'],
  [/FBAN|FBAV|FB_IAB/i, '페이스북'],
  [/\bLine\//i, '라인'],
  [/DaumApps/i, '다음 앱'],
  [/KAKAOSTORY/i, '카카오스토리']
];

/** 앱 안 브라우저 이름 ('밴드' 등). 일반 브라우저면 '' */
export function inAppName(ua = '') {
  if (/KAKAOTALK/i.test(ua)) return '카카오톡';
  const hit = IN_APPS.find(([re]) => re.test(ua));
  if (hit) return hit[1];
  // 그 밖의 안드로이드 앱 안 화면(WebView: '; wv)')
  return /Android/i.test(ua) && /;\s*wv\)/i.test(ua) ? '이 앱' : '';
}

/**
 * 지금 어떤 환경에서 열렸는지 (순수 함수: 테스트용)
 * @returns 'installed' | 'kakao-android' | 'kakao-ios' | 'inapp-android' | 'inapp-ios' | 'ios' | 'web'
 *   installed: 설치 앱(APK/iOS) 또는 이미 홈 화면 앱으로 실행 → 안내 필요 없음
 */
export function detectInstallEnv({ ua = '', standalone = false, native = false } = {}) {
  if (native || standalone) return 'installed';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  if (/KAKAOTALK/i.test(ua)) return ios ? 'kakao-ios' : 'kakao-android';
  if (inAppName(ua)) return ios ? 'inapp-ios' : 'inapp-android';
  if (ios) return 'ios';
  return 'web';
}

/** 홈 화면에 추가할 수 없는 앱 안 브라우저인지 */
export const isInAppEnv = (env) => /^(kakao|inapp)-/.test(env);

export function currentInstallEnv() {
  if (typeof window === 'undefined') return 'installed';
  return detectInstallEnv({
    ua: navigator.userAgent || '',
    standalone: window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
    native: !!window.Capacitor?.isNativePlatform?.()
  });
}

/** 카카오톡 앱 안 브라우저 → 기본 브라우저(크롬·사파리)로 이 주소 열기 */
export const kakaoExternalUrl = (href) => `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;

/** 안드로이드 앱 안 브라우저 → 크롬으로 이 주소 열기 (크롬이 없으면 지금 화면에서 그대로) */
export function chromeIntentUrl(href) {
  const u = new URL(href);
  const scheme = u.protocol.replace(':', '');
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}

/** 바깥 브라우저로 여는 주소 (아이폰 앱 안 브라우저는 방법이 없어 null → 주소 복사 안내) */
export function externalOpenUrl(env, href) {
  if (env === 'kakao-android' || env === 'kakao-ios') return kakaoExternalUrl(href);
  if (env === 'inapp-android') return chromeIntentUrl(href);
  return null;
}

// 설치 창 이벤트는 화면이 그려지기 전에 올 수 있어서 앱 시작 때부터 받아 둠
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(!!deferredPrompt));

export function captureInstallPrompt() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // 브라우저 기본 작은 배너 대신 앱 안 버튼으로
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function subscribeInstallPrompt(fn) {
  listeners.add(fn);
  fn(!!deferredPrompt);
  return () => listeners.delete(fn);
}

/** 설치 창 띄우기. 설치했으면 true */
export async function promptInstall() {
  const e = deferredPrompt;
  if (!e) return false;
  deferredPrompt = null;
  notify();
  await e.prompt();
  const choice = await e.userChoice.catch(() => null);
  return choice?.outcome === 'accepted';
}
