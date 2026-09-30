// src/lib/importMonth.js
// 가져온 근무표의 달을 잘못 인식했을 때 한 달씩 옮기기 (가져오기 결과 알림의 ◀ ▶)
const pad = (n) => String(n).padStart(2, '0');

/** '2026-04-26' + 5 → '2026-09-26'. 옮긴 달에 없는 날짜(4/31 등)는 null */
export function shiftDateKey(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, d);
  if (date.getDate() !== d) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(d)}`;
}

export function shiftYearMonth(yearMonth, delta) {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

const shiftObject = (obj, delta) =>
  Object.fromEntries(
    Object.entries(obj || {})
      .map(([k, v]) => [shiftDateKey(k, delta), v])
      .filter(([k]) => k)
  );
const shiftList = (list, delta) => (list || []).map((k) => shiftDateKey(k, delta)).filter(Boolean);

/** 인식 결과 전체(모든 사람)를 한 달씩 옮김 → '내 이름이 아니에요'로 다시 골라도 옮긴 달로 */
export function shiftImportMonth(imp, delta) {
  if (!imp) return imp;
  return {
    ...imp,
    yearMonth: shiftYearMonth(imp.yearMonth, delta),
    byName: Object.fromEntries(
      Object.entries(imp.byName || {}).map(([name, d]) => [name, { ...d, shifts: shiftObject(d.shifts, delta), uncertain: shiftList(d.uncertain, delta) }])
    )
  };
}

/**
 * 방금 등록한 근무를 한 달 옮기기
 * @param current   지금 내 근무 { 날짜: 코드 }
 * @param banner    { keys, previous, uncertain, yearMonth, imp } 가져오기 결과
 * @returns { shifts: 새 내 근무, banner: 새 결과 }
 */
export function moveImportedMonth(current, banner, delta) {
  // 등록 전 상태로 되돌린 뒤 (지금 값 = 사용자가 고친 값 포함) 옮긴 날짜에 다시 넣음
  const restored = { ...current };
  Object.entries(banner.previous || {}).forEach(([k, v]) => {
    if (v) restored[k] = v;
    else delete restored[k];
  });
  const moved = {};
  (banner.keys || []).forEach((k) => {
    const nk = shiftDateKey(k, delta);
    if (nk && current[k]) moved[nk] = current[k];
  });
  const previous = Object.fromEntries(Object.keys(moved).map((k) => [k, restored[k] || null]));
  return {
    shifts: { ...restored, ...moved },
    banner: {
      ...banner,
      imp: shiftImportMonth(banner.imp, delta),
      yearMonth: shiftYearMonth(banner.yearMonth, delta),
      keys: Object.keys(moved),
      count: Object.keys(moved).length,
      previous,
      uncertain: shiftList(banner.uncertain, delta)
    }
  };
}
