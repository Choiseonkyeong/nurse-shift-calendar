// src/lib/allowance.js
// 연차/수당 계산 보조 함수

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * 연차 집계 기간
 *  - calendar: 선택 날짜가 속한 해의 1/1 ~ 12/31
 *  - hire: 선택 날짜 기준 가장 최근 입사 기념일 ~ 다음 기념일 전날 (2/29 입사는 평년에 2/28)
 */
export function leaveYearRange(selectedDate, basis = 'calendar', hireDate = '') {
  const [y, m, d] = String(selectedDate || '').split('-').map(Number);
  const sel = new Date(y || new Date().getFullYear(), (m || 1) - 1, d || 1);
  const hire = /^\d{4}-\d{2}-\d{2}$/.test(hireDate || '') ? hireDate.split('-').map(Number) : null;

  if (basis !== 'hire' || !hire) {
    const yy = sel.getFullYear();
    return { start: `${yy}-01-01`, end: `${yy}-12-31` };
  }
  const [, hm, hd] = hire;
  const anniversary = (year) => {
    const last = new Date(year, hm, 0).getDate();
    return new Date(year, hm - 1, Math.min(hd, last));
  };
  let start = anniversary(sel.getFullYear());
  if (start > sel) start = anniversary(sel.getFullYear() - 1);
  const next = anniversary(start.getFullYear() + 1);
  const end = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
  return { start: key(start), end: key(end) };
}
