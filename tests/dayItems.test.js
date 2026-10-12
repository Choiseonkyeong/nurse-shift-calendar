import { describe, it, expect } from 'vitest';
import { noteItems, joinItems, moveItem, MAX_NOTE } from '../src/lib/dayItems';

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
});
