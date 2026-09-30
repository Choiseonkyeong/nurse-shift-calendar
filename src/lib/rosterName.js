// src/lib/rosterName.js
// 근무표(사진·엑셀)에서 읽은 이름 목록 중 "내 줄" 고르기
//  - 근무표 속 내 이름(설정) → 앱 이름(닉네임일 수 있음) 순서로 비교
//  - 사진 인식 오타 대비: 3글자 이상 이름은 한 글자만 달라도 같은 사람으로 봄 (예: 홍숙언 ↔ 롱숙언)
//  - 비슷한 후보가 둘 이상이면 고르지 않음 → 이름 선택 창

export const ROSTER_NAME_KEY = 'roster_name';

// 공백·괄호 제거, 영문은 대소문자 구분 없이 (Kim Minji = kim minji)
const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/\(.*?\)/g, '').toLowerCase();

/** 글자 하나 바꾸기/넣기/빼기 횟수 (편집 거리) */
export function nameDistance(a, b) {
  const x = [...norm(a)];
  const y = [...norm(b)];
  const dp = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) dp[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
  }
  return dp[x.length][y.length];
}

/** 후보가 딱 하나일 때만 그 이름 */
const only = (list) => (list.length === 1 ? list[0] : '');

/**
 * @param names       근무표에서 읽은 이름들
 * @param rosterName  설정의 '근무표 속 내 이름' (없으면 '')
 * @param userName    앱 이름 (닉네임일 수 있음)
 * @returns { name, how } how: 'exact' | 'partial' | 'similar' | 'single' | '' (못 찾음)
 */
export function pickRosterName(names, { rosterName = '', userName = '' } = {}) {
  const list = (names || []).filter(Boolean);
  const targets = [rosterName, userName].map(norm).filter((t) => t.length >= 2);

  // 설정한 '근무표 속 내 이름'을 먼저 끝까지 비교하고, 그다음 앱 이름
  for (const t of targets) {
    const exact = only(list.filter((n) => norm(n) === t));
    if (exact) return { name: exact, how: 'exact' };
    // "수민" ↔ "최수민" 처럼 한쪽이 다른 쪽을 포함 (2글자 이상, 후보 하나일 때만)
    const partial = only(list.filter((n) => norm(n).length >= 2 && (norm(n).includes(t) || t.includes(norm(n)))));
    if (partial) return { name: partial, how: 'partial' };
    // 두 글자 이름은 한 글자 차이면 다른 사람일 가능성이 큼 → 3글자 이상만
    if (t.length >= 3) {
      const similar = only(list.filter((n) => norm(n).length === t.length && nameDistance(n, t) === 1));
      if (similar) return { name: similar, how: 'similar' };
    }
  }
  if (list.length === 1) return { name: list[0], how: 'single' };
  return { name: '', how: '' };
}
