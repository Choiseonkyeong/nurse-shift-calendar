// src/lib/sheetPick.js
// 엑셀 파일의 여러 탭 중 근무표처럼 생긴 탭 고르기 (날짜 1~31 줄이 있는 탭)

/** 탭 표에 날짜 줄(1~31 중 서로 다른 숫자 7개 이상이 한 줄에)이 있는지 */
export function looksLikeRoster(matrix = [], dateCells = {}) {
  if (Object.keys(dateCells || {}).length >= 7) return true;
  return matrix.slice(0, 40).some((row) => {
    const days = new Set();
    (row || []).forEach((cell) => {
      // '25\r\n추석' 처럼 날짜 아래 공휴일 이름이 붙은 칸도 날짜로
      const m = /^(\d{1,2})(?:\s|$)/.exec(String(cell ?? '').trim());
      if (m && +m[1] >= 1 && +m[1] <= 31) days.add(+m[1]);
    });
    return days.size >= 7;
  });
}

/**
 * 근무표 탭 목록 (엑셀에서 마지막으로 보던 탭을 맨 앞에)
 * @param book { sheets: [{ name, matrix, dateCells }], active }
 */
export function rosterSheets({ sheets = [], active = 0 } = {}) {
  const list = sheets.map((s, i) => ({ ...s, index: i, active: i === active })).filter((s) => looksLikeRoster(s.matrix, s.dateCells));
  return [...list.filter((s) => s.active), ...list.filter((s) => !s.active)];
}
