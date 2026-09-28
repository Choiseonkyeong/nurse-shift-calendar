// src/lib/settingsSync.js
// 사용자 설정(시급·연차·정산 기준·휴일수당·근무 시간·알림)을 서버와 동기화
// 여러 기기 중 "마지막으로 바꾼 기기"의 설정이 이김 (기기별 변경 시각 비교)
import { getSupabase } from '../supabaseClient';

export const SETTINGS_TS_KEY = 'settings_updated_at';

/**
 * 서버·기기 중 어느 쪽 설정을 쓸지
 * @returns 'pull'(서버 → 기기) | 'push'(기기 → 서버) | 'none'
 */
export function decideSettingsSync(localUpdatedAt, server) {
  const serverTs = server?.updated_at ? Date.parse(server.updated_at) : null;
  const localTs = localUpdatedAt ? Date.parse(localUpdatedAt) : null;
  if (serverTs && (!localTs || serverTs > localTs)) return 'pull';
  if (!serverTs || (localTs && localTs > serverTs)) return 'push';
  return 'none';
}

/** 서버 설정 조회 (서버에 기능이 없으면 null → 동기화 생략) */
export async function fetchMySettings() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_my_settings');
  if (error) return null;
  return data;
}

export async function saveMySettings(settings, updatedAt) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('set_my_settings', { p_settings: settings, p_updated_at: updatedAt });
  if (error) throw error;
  return data;
}
