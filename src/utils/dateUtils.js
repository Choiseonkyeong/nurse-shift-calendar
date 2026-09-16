// src/utils/dateUtils.js
// 앱 전역 날짜 및 이름 정규화 유틸리티 (Single Source of Truth)

/**
 * 어떤 형태의 날짜값이 와도 'YYYY-MM-DD' 10자리 표준 키로 변환.
 * (지원: Date 객체, '2026-09-07', '2026. 9. 7.', '2026.09.07', ISO 문자열 등)
 */
export function toDateKey(rawDate) {
  if (!rawDate) return '';
  if (typeof rawDate === 'string') {
    const cleaned = rawDate.replace(/\./g, '-').replace(/\s/g, '').split('T')[0];
    const parts = cleaned.split('-').filter(Boolean);
    if (parts.length >= 3) {
      const y = parts[0];
      const m = String(parts[1]).padStart(2, '0');
      const d = String(parts[2]).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  try {
    const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayVal = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayVal}`;
    }
  } catch (e) {
    /* noop */
  }
  return String(rawDate);
}

/** 오늘 날짜를 { year, month, day, dateStr } 형태로 반환 */
export function getTodayDateObj() {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    dateStr: toDateKey(d)
  };
}

/** 'YYYY-MM-DD' 키를 { year, month, day } 숫자로 분해 */
export function splitDateKey(dateKey) {
  const [y, m, d] = toDateKey(dateKey).split('-').map(Number);
  return { year: y, month: m, day: d };
}

/**
 * 기준 연월(baseYear-baseMonth) 데이터 객체를 targetYear-targetMonth로 이동
 */
export function shiftShiftsToMonth(shiftsObj, baseYear, baseMonth, targetYear, targetMonth) {
  const baseYM = baseYear * 12 + (baseMonth - 1);
  const targetYM = targetYear * 12 + (targetMonth - 1);
  const monthDiff = targetYM - baseYM;
  const result = {};

  Object.entries(shiftsObj || {}).forEach(([key, val]) => {
    const { year, month, day } = splitDateKey(key);
    const totalMonths = (year * 12 + (month - 1)) + monthDiff;
    const newYear = Math.floor(totalMonths / 12);
    const newMonth = (totalMonths % 12) + 1;
    const newKey = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    result[newKey] = val;
  });
  return result;
}

/** 이름 정규화: 공백/호칭(쌤/님) 제거 */
export function cleanDisplayName(name) {
  return (name || '').replace(/쌤|님|\s/g, '').trim();
}

/** 두 이름이 같은 사람인지 비교 */
export function isSamePerson(nameA, nameB) {
  return cleanDisplayName(nameA) === cleanDisplayName(nameB) && cleanDisplayName(nameA) !== '';
}
