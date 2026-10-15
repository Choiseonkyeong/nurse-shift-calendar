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

/**
 * 근무 수당: 근무 종류마다 1회 수당 × 정산 기간 안 근무 횟수 (예: 나이트 1회 130,000원 × 5회)
 * @param amounts { 근무코드: 1회 수당(원) } — 0·빈 값인 근무는 빼고
 * @returns { items: [{ code, count, amount, total }], total }
 */
export function shiftAllowance(myShifts = {}, start, end, amounts = {}) {
  const counts = {};
  Object.entries(myShifts || {}).forEach(([k, code]) => {
    if (code && k >= start && k <= end) counts[code] = (counts[code] || 0) + 1;
  });
  const items = Object.entries(amounts || {})
    .map(([code, amount]) => ({ code, amount: Number(amount) || 0, count: counts[code] || 0 }))
    .filter((it) => it.amount > 0)
    .map((it) => ({ ...it, total: it.amount * it.count }));
  return { items, total: items.reduce((sum, it) => sum + it.total, 0) };
}

/**
 * 정산 기간: 시작일이 1일이면 그 달 1일~말일, 아니면 전달 시작일~이번 달 (시작일-1)일
 * 예) 2026년 10월, 26일 → 2026-09-26 ~ 2026-10-25
 */
export function payPeriod(year, month, startDay = 1) {
  const day = Number(startDay) || 1;
  if (day === 1) return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}` };
  return { start: key(new Date(year, month - 2, day)), end: `${year}-${pad(month)}-${pad(day - 1)}` };
}
