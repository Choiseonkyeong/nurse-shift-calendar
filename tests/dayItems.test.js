import { describe, it, expect } from 'vitest';
import { noteItems, joinItems, moveItem, parseItem, formatItem, noteTexts, MAX_NOTE } from '../src/lib/dayItems';

describe('날짜 일정 목록 (메모 한 줄 = 일정 하나)', () => {
  it('나누기·합치기: 빈 줄·앞뒤 공백 빼고, 일정 안 줄바꿈은 한 줄로', () => {
    expect(noteItems(' 교육 \n\n회식 7시\n')).toEqual(['교육', '회식 7시']);
    expect(noteItems(undefined)).toEqual([]);
    expect(joinItems(['교육', '  ', '회식\n7시'])).toBe('교육\n회식 7시');
    expect(joinItems(['가'.repeat(600)]).length).toBe(MAX_NOTE);
  });

  it('순서 바꾸기 (범위 밖이면 그대로)', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 1, 9)).toBe(list);
  });

  it('일정 색: 줄 앞 표시로 저장, 글자만 꺼내기, 색만 있고 글자가 없으면 빈 일정', () => {
    expect(parseItem('{{r}}교육')).toEqual({ text: '교육', color: 'r', hex: '#E11D48' });
    expect(parseItem('교육')).toEqual({ text: '교육', color: '', hex: '' });
    expect(parseItem('{{z}}교육').color).toBe('');
    expect(formatItem('회식', 'b')).toBe('{{b}}회식');
    expect(noteItems('{{r}}\n{{b}}회식')).toEqual(['{{b}}회식']);
    expect(noteTexts('{{g}}교육\n회식')).toEqual(['교육', '회식']);
  });
});
