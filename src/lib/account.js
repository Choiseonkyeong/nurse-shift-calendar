// src/lib/account.js
// 이메일 계정 연결: 익명 계정 → 이메일 + 비밀번호 계정으로 전환해 폰을 바꿔도 같은 데이터로 로그인
//  1) linkEmail: 인증 메일 발송 (메일의 링크를 누르면 이메일이 계정에 연결됨)
//  2) setPassword: 인증 후 비밀번호 설정
//  3) 새 기기: signInWithEmail → 이 기기 데이터를 비우고 계정 데이터로 다시 불러옴
import { Capacitor } from '@capacitor/core';
import { getSupabase } from '../supabaseClient';
import { ensureProfile } from './shiftApi';

const PASSWORD_SET_KEY = 'account_password_set';

// 계정을 바꿀 때 지우는 이 기기 데이터 (근무·메모·근무 종류·그룹 캐시·동기화 기준점)
export const ACCOUNT_DATA_KEYS = [
  'my_shift_data',
  'day_notes',
  'synced_shift_data',
  'synced_day_notes',
  'custom_shift_types',
  'my_group_list',
  'group_last_seen',
  'roster_name',
  'name_confirmed',
  PASSWORD_SET_KEY
];

/** 인증 메일 링크가 돌아올 주소: 웹은 현재 사이트, 앱은 Supabase 기본 Site URL */
const redirectTo = () =>
  !Capacitor.isNativePlatform() && window.location.protocol === 'https:' ? window.location.origin : undefined;

/** Supabase 오류 → 한국어 안내 */
export function friendlyAuthError(err) {
  const msg = String(err?.message || err || '');
  if (/rate limit|too many/i.test(msg)) return '메일 발송 한도를 넘었어요. 잠시 후(최대 1시간) 다시 시도해 주세요.';
  if (/invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/already (been )?registered|already exists|email_exists/i.test(msg))
    return '이미 다른 계정에 연결된 이메일입니다. 아래 "기존 계정으로 로그인"을 이용하거나 다른 이메일을 입력해 주세요.';
  if (/password.*(at least|short)|weak_password/i.test(msg)) return '비밀번호는 6자 이상으로 입력해 주세요.';
  if (/invalid.*email|unable to validate email/i.test(msg)) return '이메일 주소 형식을 확인해 주세요.';
  if (/email not confirmed/i.test(msg)) return '이메일 인증이 아직 완료되지 않았어요. 메일함의 인증 링크를 먼저 눌러 주세요.';
  if (/failed to fetch|network/i.test(msg)) return '네트워크에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.';
  return msg || '알 수 없는 오류가 발생했습니다.';
}

/**
 * 현재 계정 상태
 * @returns {{ status: 'anonymous'|'pending'|'needs_password'|'linked', email: string, pendingEmail: string }}
 */
export async function getAccountInfo({ refresh = false } = {}) {
  const supabase = await getSupabase();
  if (refresh) await supabase.auth.refreshSession().catch(() => {});
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data.user;
  const email = user?.email || '';
  const pendingEmail = user?.new_email || '';
  let passwordSet = false;
  try {
    passwordSet = localStorage.getItem(PASSWORD_SET_KEY) === '1';
  } catch (e) {
    /* 무시 */
  }
  let status = 'anonymous';
  if (email && !user?.is_anonymous) status = passwordSet ? 'linked' : 'needs_password';
  else if (pendingEmail) status = 'pending';
  return { status, email, pendingEmail };
}

/** 1단계: 이메일 연결 (인증 메일 발송) */
export async function linkEmail(email) {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: redirectTo() });
  if (error) throw error;
}

/** 2단계(또는 변경): 비밀번호 설정 */
export async function setPassword(password) {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  localStorage.setItem(PASSWORD_SET_KEY, '1');
}

/** 이 기기 데이터 비우기 (계정 전환·복구 전) */
export function clearLocalAccountData() {
  ACCOUNT_DATA_KEYS.forEach((k) => localStorage.removeItem(k));
}

/**
 * 새 기기에서 기존 계정 로그인 → 이 기기 데이터를 비우고 계정 이름으로 설정. 호출 후 새로고침 필요
 * @param fallbackName 계정에 프로필이 없을 때 만들 이름
 */
export async function signInWithEmail(email, password, fallbackName = '') {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  const profile = await ensureProfile(fallbackName || email.split('@')[0].slice(0, 30), false);
  clearLocalAccountData();
  localStorage.setItem(PASSWORD_SET_KEY, '1');
  localStorage.setItem('name_confirmed', '1');
  localStorage.setItem('shift_user_name', profile.display_name);
  return profile;
}

/** 비밀번호 재설정 메일 */
export async function sendPasswordReset(email) {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
  if (error) throw error;
}

/**
 * 인증 메일 링크로 돌아온 경우(주소 # 뒤 type=...) 종류 반환: 'email_change' | 'signup' | 'recovery' | null
 * 웹 주소에서만 발생
 */
export function authRedirectType() {
  const hash = window.location.hash || '';
  if (!/access_token=|error_description=/.test(hash)) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('error_description')) return 'error';
  return params.get('type') || 'signup';
}
