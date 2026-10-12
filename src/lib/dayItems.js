// src/lib/dayItems.js
// 날짜 메모 = 일정 목록. 서버·백업에는 지금처럼 글 하나로 두고, 한 줄이 일정 하나
export const MAX_NOTE = 500;

/** '교육\n회식' → ['교육', '회식'] (빈 줄 빼고) */
export const noteItems = (note) =>
  String(note || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

/** ['교육', '회식'] → '교육\n회식' (빈 일정 빼고, 최대 500자) */
export const joinItems = (items) =>
  items
    .map((s) => String(s || '').replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_NOTE);

/** 순서 바꾸기: from 번째를 to 자리로 */
export function moveItem(items, from, to) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}
