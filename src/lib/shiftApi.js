// src/lib/shiftApi.js
// v2 관계형 스키마 데이터 접근 계층 (Supabase RPC 래퍼)
import { supabase } from '../supabaseClient';

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

/** 세션 확보: 없으면 익명 로그인 (Supabase Auth > Anonymous Sign-ins 활성화 필요) */
export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  return unwrap(await supabase.auth.signInAnonymously()).session;
}

/** 내 프로필 조회/생성. claimLegacy=true 이면 같은 이름의 레거시(group_shifts) 데이터 연결 */
export async function ensureProfile(displayName, claimLegacy = false) {
  return unwrap(await supabase.rpc('ensure_profile', {
    p_display_name: displayName,
    p_claim_legacy: claimLegacy
  }));
}

export async function updateDisplayName(profileId, displayName) {
  unwrap(await supabase.from('profiles').update({ display_name: displayName }).eq('id', profileId));
}

/** 내 근무 전체 → { 'YYYY-MM-DD': 'D', ... } */
export async function fetchMyShifts(from = null, to = null) {
  const rows = unwrap(await supabase.rpc('get_my_shifts', { p_from: from, p_to: to })) || [];
  return Object.fromEntries(rows.map((r) => [r.work_date, r.code]));
}

/** 근무 일괄 저장. changes: { 'YYYY-MM-DD': 'D' | null(삭제) } */
export async function saveShiftChanges(changes) {
  if (!changes || Object.keys(changes).length === 0) return null;
  return unwrap(await supabase.rpc('set_my_shifts', { p_changes: changes }));
}

/** 이전/다음 스냅샷 비교 → 저장할 변경분 */
export function diffShifts(prev = {}, next = {}) {
  const changes = {};
  new Set([...Object.keys(prev), ...Object.keys(next)]).forEach((key) => {
    const a = prev[key] || null;
    const b = next[key] || null;
    if (a !== b) changes[key] = b;
  });
  return changes;
}

// ---------------- 그룹 ----------------

/** [{ id, code, name, color, is_owner, can_delete, members: [{ id, name }] }] */
export async function fetchMyGroups() {
  return unwrap(await supabase.rpc('get_my_groups')) || [];
}

export async function createGroup(name, color) {
  return unwrap(await supabase.rpc('create_group', { p_name: name, p_color: color }));
}

export async function joinGroup(inviteCode) {
  return unwrap(await supabase.rpc('join_group', { p_invite_code: inviteCode }));
}

export async function updateGroupColor(groupId, color) {
  unwrap(await supabase.from('groups').update({ color }).eq('id', groupId));
}

export async function leaveGroup(groupId, profileId) {
  unwrap(await supabase.from('group_members').delete().eq('group_id', groupId).eq('profile_id', profileId));
}

export async function deleteGroup(groupId) {
  const rows = unwrap(await supabase.from('groups').delete().eq('id', groupId).select('id'));
  if (!rows || rows.length === 0) throw new Error('그룹을 만든 사람만 삭제할 수 있습니다.');
}

/** 그룹 근무표 → { [profileId]: { 'YYYY-MM-DD': 'D' } } */
export async function fetchGroupSchedule(groupId, from, to) {
  const rows = unwrap(await supabase.rpc('get_group_schedule', {
    p_group_id: groupId,
    p_from: from,
    p_to: to
  })) || [];
  const byMember = {};
  rows.forEach((r) => {
    (byMember[r.profile_id] ||= {})[r.work_date] = r.code;
  });
  return byMember;
}
