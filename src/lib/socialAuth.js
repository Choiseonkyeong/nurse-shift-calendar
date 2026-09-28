// src/lib/socialAuth.js
// 카카오 / 구글 로그인 (Supabase Auth OAuth)
//  - 계정 연결(link): 지금 쓰던 익명 계정에 소셜 계정을 붙임 → 근무·그룹 데이터 그대로
//  - 로그인(login): 다른 폰에서 쓰던 소셜 계정으로 로그인 → 이 기기 데이터를 비우고 계정 데이터로
//  - 웹: 로그인 페이지로 이동했다가 주소 # 뒤 토큰과 함께 돌아옴 (Supabase 가 자동 처리)
//  - 앱: 인앱 브라우저 → 딥링크(com.nurseshift.app://auth-callback#토큰)로 복귀 → 세션 설정
import { Capacitor } from '@capacitor/core';
import { getSupabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient';
import { clearLocalAccountData } from './account';
import { ensureProfile } from './shiftApi';

export const NATIVE_REDIRECT = 'com.nurseshift.app://auth-callback';
export const PROVIDERS = [
  { id: 'kakao', label: '카카오', bg: '#FEE500', fg: '#191600' },
  { id: 'google', label: 'Google', bg: '#FFFFFF', fg: '#1F1F1F', border: true }
];

const PENDING_KEY = 'oauth_pending'; // { mode: 'link'|'login', provider }
export const OAUTH_NOTICE_KEY = 'oauth_notice'; // 돌아온 뒤 보여줄 안내/오류 { type, text }

const isNative = () => Capacitor.isNativePlatform();

/** Supabase 에서 켜 둔 소셜 로그인 목록 (콘솔 설정 전이면 빈 목록 → 버튼 숨김) */
export async function fetchEnabledProviders() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    if (!res.ok) return [];
    const { external = {} } = await res.json();
    return PROVIDERS.filter((p) => external[p.id]);
  } catch (e) {
    return [];
  }
}

/** 소셜 계정 표시 이름 (카카오 닉네임 / 구글 이름) */
export function oauthDisplayName(user) {
  const m = user?.user_metadata || {};
  return String(m.full_name || m.name || m.nickname || m.preferred_username || '').trim().slice(0, 30);
}

/** 이 계정에 연결된 소셜 로그인 목록 (예: ['kakao']) */
export const linkedProviders = (user) =>
  (user?.identities || []).map((i) => i.provider).filter((p) => PROVIDERS.some((x) => x.id === p));

const redirectTo = () => (isNative() ? NATIVE_REDIRECT : `${window.location.origin}${window.location.pathname}`);

async function openUrl(url) {
  if (isNative()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } else {
    window.location.assign(url);
  }
}

/**
 * 소셜 로그인 시작
 * @param mode 'link' = 지금 계정에 연결(데이터 유지) | 'login' = 그 소셜 계정으로 로그인(이 기기 데이터 교체)
 */
export async function startSocialAuth(provider, mode) {
  const supabase = await getSupabase();
  localStorage.setItem(PENDING_KEY, JSON.stringify({ provider, mode }));
  const options = { redirectTo: redirectTo(), skipBrowserRedirect: true };
  const { data, error } =
    mode === 'link'
      ? await supabase.auth.linkIdentity({ provider, options })
      : await supabase.auth.signInWithOAuth({ provider, options });
  if (error) {
    localStorage.removeItem(PENDING_KEY);
    if (/manual linking/i.test(error.message)) {
      throw new Error('서버에서 계정 연결이 꺼져 있어요. (Supabase: Allow manual linking 켜기)');
    }
    throw error;
  }
  await openUrl(data.url);
}

const parseFragment = (url) => {
  const u = new URL(url);
  const params = new URLSearchParams(u.search);
  new URLSearchParams(u.hash.replace(/^#/, '')).forEach((v, k) => params.set(k, v));
  return params;
};

const readPending = () => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
  } catch (e) {
    return null;
  }
};

/** 이메일 인증 링크(type=...)가 아니라 소셜 로그인에서 돌아온 주소인지 */
export function isOAuthReturn(url = window.location.href) {
  const p = parseFragment(url);
  if (p.get('type')) return false; // 이메일 인증/비밀번호 재설정
  return Boolean(readPending()) && (p.has('access_token') || p.has('error') || p.has('error_code'));
}

/** 오류 코드 → 안내 문구 */
export function oauthErrorText(provider, code, description = '') {
  const label = PROVIDERS.find((x) => x.id === provider)?.label || '소셜';
  if (code === 'identity_already_exists') {
    return `이 ${label} 계정은 이미 다른 근무표 계정에 연결되어 있어요. [기존 계정으로 로그인]에서 ${label}로 로그인해 주세요.`;
  }
  if (code === 'access_denied') return `${label} 로그인을 취소했어요.`;
  return `${label} 로그인에 실패했어요. (${description || code})`;
}

/**
 * 소셜 로그인에서 돌아온 뒤 처리 (화면을 그리기 전에 호출)
 *  - 세션 확정 (웹: Supabase 가 주소의 토큰을 읽음 / 앱: 딥링크 토큰으로 setSession)
 *  - login 모드: 이 기기 데이터를 비우고 계정의 이름·데이터를 쓰도록 설정
 *  - 결과 안내는 OAUTH_NOTICE_KEY 에 저장 → 앱이 계정 창으로 보여줌
 * @returns 처리했으면 true
 */
export async function completeOAuthReturn(url = window.location.href, { fallbackName = '' } = {}) {
  if (!isOAuthReturn(url)) return false;
  const pending = readPending() || {};
  localStorage.removeItem(PENDING_KEY);
  const p = parseFragment(url);
  const label = PROVIDERS.find((x) => x.id === pending.provider)?.label || '소셜';

  const code = p.get('error_code') || p.get('error');
  if (code) {
    localStorage.setItem(OAUTH_NOTICE_KEY, JSON.stringify({ type: 'error', text: oauthErrorText(pending.provider, code, p.get('error_description')) }));
    return true;
  }

  try {
    const supabase = await getSupabase();
    if (isNative()) {
      const { error } = await supabase.auth.setSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token') });
      if (error) throw error;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) throw error || new Error('no user');

    if (pending.mode === 'login') {
      const profile = await ensureProfile(oauthDisplayName(data.user) || fallbackName || '사용자', false);
      clearLocalAccountData();
      localStorage.setItem('name_confirmed', '1');
      localStorage.setItem('shift_user_name', profile.display_name);
      localStorage.setItem(OAUTH_NOTICE_KEY, JSON.stringify({ type: 'ok', text: `${label} 계정으로 로그인했어요.`, silent: true }));
    } else {
      localStorage.setItem(
        OAUTH_NOTICE_KEY,
        JSON.stringify({ type: 'ok', text: `${label} 계정이 연결됐어요. 새 폰에서는 [기존 계정으로 로그인 → ${label}로 로그인]을 누르면 돼요.` })
      );
    }
  } catch (err) {
    localStorage.setItem(OAUTH_NOTICE_KEY, JSON.stringify({ type: 'error', text: oauthErrorText(pending.provider, 'unknown', err?.message) }));
  }
  return true;
}

/** 돌아온 뒤 보여줄 안내 (한 번만) */
export function consumeOAuthNotice() {
  const raw = localStorage.getItem(OAUTH_NOTICE_KEY);
  localStorage.removeItem(OAUTH_NOTICE_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/** 웹: 주소에 소셜 로그인 결과가 있으면 처리 후 주소에서 토큰 제거 */
export async function handleWebOAuthReturn() {
  if (isNative() || !isOAuthReturn()) return;
  try {
    await completeOAuthReturn(window.location.href, { fallbackName: localStorage.getItem('shift_user_name') || '' });
  } finally {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

/** 앱: 딥링크(com.nurseshift.app://auth-callback#토큰)로 돌아오면 처리 후 새로고침 */
export async function listenNativeOAuth() {
  if (!isNative()) return;
  const [{ App }, { Browser }] = await Promise.all([import('@capacitor/app'), import('@capacitor/browser')]);
  App.addListener('appUrlOpen', async ({ url }) => {
    if (!url?.startsWith(NATIVE_REDIRECT)) return;
    await Browser.close().catch(() => {});
    const done = await completeOAuthReturn(url, { fallbackName: localStorage.getItem('shift_user_name') || '' });
    if (done) window.location.reload();
  });
}
