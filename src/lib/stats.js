// src/lib/stats.js
// 연간 근무 통계: 월별 근무 종류별 횟수, 최장 연속 근무/나이트

const pad = (n) => String(n).padStart(2, '0');

/** 나이트 근무 판별: 코드 N 또는 이름에 나이트/night/야간 */
export const isNightType = (t) => t.code === 'N' || /나이트|night|야간/i.test(t.label || '');

export function computeYearStats(myShifts = {}, year, shiftTypes = []) {
  const byCode = new Map(shiftTypes.map((t) => [t.code, t]));
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, counts: {}, total: 0 }));
  const totals = {};
  let workStreak = 0;
  let nightStreak = 0;
  let longestWork = 0;
  let longestNight = 0;
  let workDays = 0;

  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    const key = `${year}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const code = myShifts[key];
    const type = code ? byCode.get(code) : null;
    if (code) {
      const m = months[d.getMonth()];
      m.counts[code] = (m.counts[code] || 0) + 1;
      m.total += 1;
      totals[code] = (totals[code] || 0) + 1;
    }
    const isWork = type?.kind === 'work';
    workStreak = isWork ? workStreak + 1 : 0;
    nightStreak = isWork && isNightType(type) ? nightStreak + 1 : 0;
    if (isWork) workDays += 1;
    longestWork = Math.max(longestWork, workStreak);
    longestNight = Math.max(longestNight, nightStreak);
  }

  return { months, totals, workDays, longestWork, longestNight };
}
