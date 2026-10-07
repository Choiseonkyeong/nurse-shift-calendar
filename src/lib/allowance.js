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
 * 근무 시간('HH:MM - HH:MM')에서 야간(22시~다음날 6시)에 걸친 시간 수
 * 시간이 없거나 형식이 틀리면 null → 예전에 직접 입력한 값 사용
 */
export function nightHoursFromTime(time) {
  const m = String(time || '').match(/^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/);
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  let end = Number(m[3]) * 60 + Number(m[4]);
  if (end <= start) end += 24 * 60; // 밤을 넘기는 근무
  // 전날 22시~6시, 당일 22시~다음날 6시 두 구간과 겹치는 분
  const overlap = (a, b) => Math.max(0, Math.min(end, b) - Math.max(start, a));
  const mins = overlap(-120, 360) + overlap(1320, 1800);
  return Math.round((mins / 60) * 100) / 100;
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
