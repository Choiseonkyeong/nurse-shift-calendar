// src/lib/shiftApi.js
// v2 관계형 스키마 데이터 접근 계층 (Supabase RPC 래퍼)
import { getSupabase } from '../supabaseClient';

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

/** 세션 확보: 없으면 익명 로그인 (Supabase Auth > Anonymous Sign-ins 활성화 필요) */
export async function ensureSession() {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  return unwrap(await supabase.auth.signInAnonymously()).session;
}

/** 내 프로필 조회/생성. claimLegacy=true 이면 같은 이름의 레거시(group_shifts) 데이터 연결 */
export async function ensureProfile(displayName, claimLegacy = false) {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('ensure_profile', {
    p_display_name: displayName,
    p_claim_legacy: claimLegacy
  }));
}

export async function updateDisplayName(profileId, displayName) {
  const supabase = await getSupabase();
  unwrap(await supabase.from('profiles').update({ display_name: displayName }).eq('id', profileId));
}

/** 내 근무 전체 → { 'YYYY-MM-DD': 'D', ... } */
export async function fetchMyShifts(from = null, to = null) {
  const supabase = await getSupabase();
  const rows = unwrap(await supabase.rpc('get_my_shifts', { p_from: from, p_to: to })) || [];
  return Object.fromEntries(rows.map((r) => [r.work_date, r.code]));
}

/** 근무 일괄 저장. changes: { 'YYYY-MM-DD': 'D' | null(삭제) } */
export async function saveShiftChanges(changes) {
  const supabase = await getSupabase();
  if (!changes || Object.keys(changes).length === 0) return null;
  return unwrap(await supabase.rpc('set_my_shifts', { p_changes: changes }));
}

export { diffShifts } from './syncMerge';

// ---------------- 그룹 ----------------

/** [{ id, code, name, color, is_owner, can_delete, members: [{ id, name }] }] */
export async function fetchMyGroups() {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('get_my_groups')) || [];
}

export async function createGroup(name, color) {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('create_group', { p_name: name, p_color: color }));
}

export async function joinGroup(inviteCode) {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('join_group', { p_invite_code: inviteCode }));
}

export async function updateGroupColor(groupId, color) {
  const supabase = await getSupabase();
  unwrap(await supabase.from('groups').update({ color }).eq('id', groupId));
}

export async function leaveGroup(groupId, profileId) {
  const supabase = await getSupabase();
  unwrap(await supabase.from('group_members').delete().eq('group_id', groupId).eq('profile_id', profileId));
}

export async function deleteGroup(groupId) {
  const supabase = await getSupabase();
  const rows = unwrap(await supabase.from('groups').delete().eq('id', groupId).select('id'));
  if (!rows || rows.length === 0) throw new Error('그룹을 만든 사람만 삭제할 수 있습니다.');
}

/** 그룹 근무표 → { shifts: { [profileId]: { 'YYYY-MM-DD': 'D' } }, styles: { [profileId]: { D: { bg, fg } } } } */
export async function fetchGroupSchedule(groupId, from, to) {
  const supabase = await getSupabase();
  const rows = unwrap(await supabase.rpc('get_group_schedule', {
    p_group_id: groupId,
    p_from: from,
    p_to: to
  })) || [];
  const shifts = {};
  const styles = {};
  rows.forEach((r) => {
    (shifts[r.profile_id] ||= {})[r.work_date] = r.code;
    (styles[r.profile_id] ||= {})[r.code] = { bg: r.bg_color, fg: r.text_color };
  });
  return { shifts, styles };
}

// ---------------- 근무 종류 (사용자 정의) ----------------

const toClientType = (r) => ({
  code: r.code,
  label: r.label,
  kind: r.kind,
  bg: r.bg_color,
  fg: r.text_color,
  start: r.start_time ? r.start_time.slice(0, 5) : '',
  end: r.end_time ? r.end_time.slice(0, 5) : '',
  nightHours: Number(r.night_hours) || 0,
  ...(r.kind === 'leave' ? { leaveDays: r.leave_days == null ? 1 : Number(r.leave_days) } : {})
});

/** 내 근무 종류 목록 (프리셋 또는 내 설정) */
export async function fetchMyShiftTypes() {
  const supabase = await getSupabase();
  return (unwrap(await supabase.rpc('get_my_shift_types')) || []).map(toClientType);
}

export async function upsertShiftType(t) {
  const supabase = await getSupabase();
  unwrap(await supabase.rpc('upsert_my_shift_type', {
    p_code: t.code,
    p_label: t.label,
    p_kind: t.kind,
    p_bg: t.bg,
    p_fg: t.fg,
    p_start: t.start || null,
    p_end: t.end || null,
    p_night_hours: Number(t.nightHours) || 0,
    p_leave_days: t.kind === 'leave' ? (t.leaveDays ?? 1) : null
  }));
}

export async function deleteShiftType(code) {
  const supabase = await getSupabase();
  unwrap(await supabase.rpc('delete_my_shift_type', { p_code: code }));
}

// ---------------- 날짜별 메모 (본인 전용) ----------------

/** { 'YYYY-MM-DD': '메모' } */
export async function fetchMyNotes() {
  const supabase = await getSupabase();
  const rows = unwrap(await supabase.from('day_notes').select('note_date, body')) || [];
  return Object.fromEntries(rows.map((r) => [r.note_date, r.body]));
}

/** changes: { 'YYYY-MM-DD': '메모' | null(삭제) } */
export async function saveNoteChanges(profileId, changes) {
  const supabase = await getSupabase();
  const upserts = Object.entries(changes)
    .filter(([, body]) => body)
    .map(([note_date, body]) => ({ profile_id: profileId, note_date, body: body.slice(0, 500) }));
  const deletes = Object.entries(changes).filter(([, body]) => !body).map(([d]) => d);
  if (upserts.length) unwrap(await supabase.from('day_notes').upsert(upserts));
  if (deletes.length) unwrap(await supabase.from('day_notes').delete().eq('profile_id', profileId).in('note_date', deletes));
}

// ---------------- 그룹 게시판 ----------------

/** 최신 글 50개 [{ id, author_id, body, created_at }] */
export async function fetchGroupPosts(groupId) {
  return unwrap(await supabase
    .from('group_posts')
    .select('id, author_id, body, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(50)) || [];
}

export async function createGroupPost(groupId, authorId, body) {
  const supabase = await getSupabase();
  unwrap(await supabase.from('group_posts').insert({ group_id: groupId, author_id: authorId, body: body.trim() }));
}

export async function deleteGroupPost(postId) {
  const supabase = await getSupabase();
  unwrap(await supabase.from('group_posts').delete().eq('id', postId));
}
