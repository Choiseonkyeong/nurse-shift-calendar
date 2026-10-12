// src/lib/dayItems.js
// 날짜 메모 = 일정 목록. 서버·백업에는 지금처럼 글 하나로 두고, 한 줄이 일정 하나
// 일정 색은 줄 맨 앞 표시로 저장: '{{r}}교육' = 빨간 '교육' (내보내기에서는 빼고 글자만)
export const MAX_NOTE = 500;

export const ITEM_COLORS = [
  { key: 'r', hex: '#E11D48', name: '빨강' },
  { key: 'o', hex: '#EA580C', name: '주황' },
  { key: 'y', hex: '#CA8A04', name: '노랑' },
  { key: 'g', hex: '#16A34A', name: '초록' },
  { key: 'b', hex: '#2563EB', name: '파랑' },
  { key: 'p', hex: '#9333EA', name: '보라' }
];
const MARK = /^\{\{([a-z])\}\}/;

/** '{{r}}교육' → { text: '교육', color: 'r', hex: '#E11D48' } (색 없으면 color·hex 는 '') */
export function parseItem(line = '') {
  const m = MARK.exec(line);
  const c = m ? ITEM_COLORS.find((x) => x.key === m[1]) : null;
  return { text: m ? line.slice(m[0].length) : line, color: c?.key || '', hex: c?.hex || '' };
}
export const formatItem = (text, color = '') => (color ? `{{${color}}}${text}` : text);
export const itemText = (line) => parseItem(line).text;

/** '교육\n회식' → ['교육', '회식'] (빈 줄 빼고) */
export const noteItems = (note) =>
  String(note || '')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => itemText(s).trim());

/** ['교육', '회식'] → '교육\n회식' (빈 일정 빼고, 최대 500자) */
export const joinItems = (items) =>
  items
    .map((s) => String(s || '').replace(/\s*\n\s*/g, ' ').trim())
    .filter((s) => itemText(s).trim())
    .join('\n')
    .slice(0, MAX_NOTE);

/** 내보내기용 글자만: '{{r}}교육\n회식' → ['교육', '회식'] */
export const noteTexts = (note) => noteItems(note).map((s) => itemText(s).trim());

/** 순서 바꾸기: from 번째를 to 자리로 */
export function moveItem(items, from, to) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}
