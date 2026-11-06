// src/lib/codeAliases.js
// 근무지마다 다른 근무표 표기(D1·H2·T5·주·A조 …) → 내 근무 종류.
// 사진·엑셀에서 처음 본 표기는 가져올 때 한 번 묻고 이 기기에 기억 → 다음 달부터는 묻지 않고 바꿔 넣음
const KEY = 'shift_code_aliases';

/** 'd1 ', '(H2)' → 'D1', 'H2' (비교용) */
export const normalizeToken = (raw) =>
  String(raw || '')
    .replace(/[^0-9A-Za-z가-힣/]/g, '')
    .toUpperCase();

/** 근무 표기처럼 보이는 글자: 1~4자, 영문·한글 하나 이상 (숫자만·표 선 잡티 'I'·'L' 은 제외) */
export const looksLikeCode = (raw) => {
  const t = normalizeToken(raw);
  return t.length >= 1 && t.length <= 4 && /[A-Z가-힣]/.test(t) && !/^[IL]$/.test(t);
};

/** { 'D1': 'D', 'T5': '' } — '' 은 '근무 아님(건너뜀)'으로 정한 표기 */
export function loadAliases() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function saveAliases(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next || {}));
  } catch {
    /* 저장 공간 부족·비공개 모드: 이번 가져오기에는 적용되고 다음에 다시 물음 */
  }
}

/**
 * 근무 인식(cellToCode)에 넘길 근무 종류 목록: 기억한 표기를 그 근무의 '이름'으로 덧붙임
 * → 'D1' 칸이 기존 매칭 규칙 그대로 D 로 읽힘. 지금 없는 근무 종류로 정한 표기는 빼고
 */
export const withAliases = (shiftTypes = [], aliases = {}) => [
  ...shiftTypes,
  ...Object.entries(aliases)
    .filter(([, code]) => code && shiftTypes.some((t) => t.code === code))
    .map(([token, code]) => ({ code, label: token }))
];

/**
 * 가져온 근무표에서 아직 정하지 않은 표기 목록 (내 줄 기준, 표 전체에서 세 번 이상 나온 것만 — 잘못 읽은 잡티 제외)
 * @param mine    { 'YYYY-MM-DD': 'D1' } 내 줄에서 근무로 못 읽은 칸
 * @param counts  { 'D1': 표 전체 등장 횟수 }
 * @returns [{ token, days: ['YYYY-MM-DD', …] }]
 */
export function pendingTokens(mine = {}, counts = {}, aliases = {}) {
  const byToken = new Map();
  Object.entries(mine).forEach(([day, token]) => {
    if (token in aliases || (counts[token] || 0) < 3) return;
    byToken.set(token, [...(byToken.get(token) || []), day]);
  });
  return [...byToken.entries()].map(([token, days]) => ({ token, days: days.sort() }));
}

/** 정한 표기대로 근무 채우기 ('' 이거나 정하지 않은 표기는 그대로 비움) */
export function applyAliases(shifts = {}, mine = {}, aliases = {}) {
  const out = { ...shifts };
  Object.entries(mine).forEach(([day, token]) => {
    if (aliases[token] && !out[day]) out[day] = aliases[token];
  });
  return out;
}
