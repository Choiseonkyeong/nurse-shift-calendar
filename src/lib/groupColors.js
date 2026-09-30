// src/lib/groupColors.js
// 그룹 색상은 내 폰에서만 적용 (다른 멤버 화면의 색은 바뀌지 않음) — 기기에 { 그룹ID: '#RRGGBB' } 로 저장
export const GROUP_COLORS_KEY = 'my_group_colors';

export function readGroupColors(storage = localStorage) {
  try {
    const v = JSON.parse(storage.getItem(GROUP_COLORS_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (e) {
    return {};
  }
}

export function saveGroupColor(groupId, color, storage = localStorage) {
  const next = { ...readGroupColors(storage), [groupId]: color };
  try {
    storage.setItem(GROUP_COLORS_KEY, JSON.stringify(next));
  } catch (e) {
    /* 저장 공간 부족 등: 이번 화면에서만 적용 */
  }
  return next;
}
