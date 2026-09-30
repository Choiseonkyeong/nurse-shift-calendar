// src/lib/installHint.js
// 웹에서 '홈 화면에 추가' 안내
//  - 카카오톡 등 앱 안 브라우저에는 홈 화면 추가 메뉴가 없음 → 크롬·사파리로 열도록 안내
//  - 안드로이드 크롬·삼성 인터넷: 설치 창(beforeinstallprompt)을 버튼으로 바로 띄움
//  - 아이폰 사파리: 공유 버튼 → 홈 화면에 추가 안내
export const INSTALL_HINT_KEY = 'install_hint_dismissed';

/**
 * 지금 어떤 환경에서 열렸는지 (순수 함수: 테스트용)
 * @returns 'installed' | 'kakao-android' | 'kakao-ios' | 'ios' | 'web'
 *   installed: 설치 앱(APK/iOS) 또는 이미 홈 화면 앱으로 실행 → 안내 필요 없음
 */
export function detectInstallEnv({ ua = '', standalone = false, native = false } = {}) {
  if (native || standalone) return 'installed';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  if (/KAKAOTALK/i.test(ua)) return ios ? 'kakao-ios' : 'kakao-android';
  if (ios) return 'ios';
  return 'web';
}

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
