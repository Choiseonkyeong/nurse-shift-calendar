// src/lib/syncMerge.js
// 서버 ↔ 기기 병합 규칙 (근무·메모 공통, { 'YYYY-MM-DD': 값 } 형태)

/** 이전/다음 스냅샷 비교 → 변경분 { 날짜: 새 값 | null(삭제) } */
export function diffShifts(prev = {}, next = {}) {
  const changes = {};
  new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]).forEach((key) => {
    const a = prev?.[key] || null;
    const b = next?.[key] || null;
    if (a !== b) changes[key] = b;
  });
  return changes;
}

/** 변경분 적용 (null/빈 값 = 삭제) */
export function applyChanges(base = {}, changes = {}) {
  const next = { ...(base || {}) };
  Object.entries(changes || {}).forEach(([k, v]) => {
    if (v) next[k] = v;
    else delete next[k];
  });
  return next;
}

/**
 * 서버 값에 "이 기기에서 바뀐 것"만 얹는다.
 * @param remote 서버 현재 값
 * @param local  기기 현재 값
 * @param base   마지막으로 서버와 일치했던 기기 스냅샷 (없으면 이전 버전 → 기기 값 전체가 우선)
 */
export function mergeWithRemote(remote = {}, local = {}, base = null) {
  const localChanges = base
    ? diffShifts(base, local)
    : Object.fromEntries(Object.entries(local || {}).filter(([, v]) => v));
  return applyChanges(remote, localChanges);
}
