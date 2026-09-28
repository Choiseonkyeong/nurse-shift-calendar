// src/lib/auth.js
// 소셜 로그인 (카카오 / 구글) — Supabase Auth OAuth + PKCE
//  - 기존 익명 사용자: linkIdentity 로 같은 계정에 소셜 계정을 연결 (근무/그룹 데이터 유지)
//  - 소셜 계정이 이미 다른 사용자에 연결돼 있으면 해당 계정으로 로그인 (로컬 근무는 부트스트랩에서 병합)
//  - 네이티브 앱: 인앱 브라우저로 인증 → 딥링크(com.nurseshift.app://auth-callback)로 복귀 → code 교환
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '../supabaseClient';

export const NATIVE_REDIRECT = 'com.nurseshift.app://auth-callback';
const PENDING_PROVIDER_KEY = 'auth_pending_provider';

const isNative = () => Capacitor.isNativePlatform();

const oauthOptions = () => ({
  redirectTo: isNative() ? NATIVE_REDIRECT : window.location.origin,
  skipBrowserRedirect: isNative()
});

/** 소셜 계정으로 로그인한 사용자인지 (익명 제외) */
export const isSocialUser = (user) => !!user && !user.is_anonymous;

/** 로그인 사용자 표시 이름 후보 (카카오: 닉네임, 구글: 이름) */
export function getOAuthDisplayName(user) {
  const m = user?.user_metadata || {};
  const name = m.full_name || m.name || m.nickname || m.preferred_username || m.user_name || '';
  return String(name).trim().slice(0, 30);
}

async function openAuthUrl(url) {
  if (isNative()) await Browser.open({ url, presentationStyle: 'popover' });
}

async function signInWithProvider(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: oauthOptions() });
  if (error) throw error;
  await openAuthUrl(data.url);
}

/** provider: 'kakao' | 'google' */
export async function startSocialLogin(provider) {
  localStorage.setItem(PENDING_PROVIDER_KEY, provider);
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user?.is_anonymous) {
    const { data, error } = await supabase.auth.linkIdentity({ provider, options: oauthOptions() });
    if (!error) {
      await openAuthUrl(data.url);
      return;
    }
    // 수동 연결 비활성 등 → 일반 로그인으로 진행
    console.warn('계정 연결 불가, 일반 로그인으로 진행:', error.message);
  }
  await signInWithProvider(provider);
}

/**
 * OAuth 콜백 파라미터 처리 (웹: 현재 URL, 앱: 딥링크 URL)
 * - code 가 있으면 세션 교환 (웹은 supabase-js 가 자동 교환하므로 앱에서만)
 * - identity_already_exists 면 같은 소셜 계정으로 다시 로그인
 * @returns {Promise<string|null>} 사용자에게 보여줄 오류 메시지
 */
async function handleCallbackUrl(rawUrl, { exchangeCode }) {
  const url = new URL(rawUrl);
  const params = new URLSearchParams(url.search);
  new URLSearchParams(url.hash.replace(/^#/, '')).forEach((v, k) => params.set(k, v));

  const errorCode = params.get('error_code');
  const errorDesc = params.get('error_description');
  const pendingProvider = localStorage.getItem(PENDING_PROVIDER_KEY);

  if (errorCode === 'identity_already_exists' && pendingProvider) {
    await signInWithProvider(pendingProvider);
    return null;
  }
  if (params.get('error')) {
    localStorage.removeItem(PENDING_PROVIDER_KEY);
    return errorDesc || params.get('error');
  }

  const code = params.get('code');
  if (code && exchangeCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return error.message;
  }
  if (code) localStorage.removeItem(PENDING_PROVIDER_KEY);
  return null;
}

/** 웹: 로그인 후 돌아온 URL 의 오류 파라미터 처리 + 주소창 정리 */
export async function handleWebCallback() {
  if (isNative()) return null;
  const { href, search, hash } = window.location;
  if (!/[?&#](code|error)=/.test(search + hash)) return null;
  await supabase.auth.getSession(); // supabase-js 의 자동 code 교환(초기화)이 끝난 뒤 URL 정리
  const message = await handleCallbackUrl(href, { exchangeCode: false });
  window.history.replaceState(null, '', window.location.pathname);
  return message;
}

/** 앱: 딥링크 수신 리스너 등록. 반환값으로 해제 */
export function listenNativeCallback(onError) {
  if (!isNative()) return () => {};
  const handle = CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (!url?.startsWith(NATIVE_REDIRECT)) return;
    await Browser.close().catch(() => {});
    const message = await handleCallbackUrl(url, { exchangeCode: true });
    if (message) onError?.(message);
  });
  return () => { handle.then((h) => h.remove()); };
}

export async function signOut() {
  localStorage.removeItem(PENDING_PROVIDER_KEY);
  await supabase.auth.signOut().catch(() => {});
}
