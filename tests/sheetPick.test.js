import { describe, it, expect } from 'vitest';
import { looksLikeRoster, rosterSheets } from '../src/lib/sheetPick';

const roster = (start = 26) => [
  ['', '', '<분당 5병동 근무표>'],
  ['', '', '분당\r\n5병동', ...Array.from({ length: 31 }, (_, i) => String(((start - 1 + i) % 31) + 1)), 'OFF'],
  ['', 'HN', '김하늘', 'D', 'E', 'N']
];
const cover = [['2026년 하반기 근무표'], ['작성: 수간호사'], ['1', '2', '3']];

describe('엑셀 탭 고르기', () => {
  it('날짜 줄(1~31 숫자 7개 이상)이 있는 탭만 근무표', () => {
    expect(looksLikeRoster(roster())).toBe(true);
    expect(looksLikeRoster(cover)).toBe(false);
    expect(looksLikeRoster([['25\r\n추석', '26', '27', '28', '29', '30', '1']])).toBe(true); // 공휴일 이름 붙은 칸
    expect(looksLikeRoster([['x']], Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`0:${i}`, '2026-12-0' + (i + 1)])))).toBe(true); // 날짜 서식
  });

  it('표지 탭은 빼고, 엑셀에서 마지막으로 보던 탭을 맨 앞에', () => {
    const book = { sheets: [{ name: '표지', matrix: cover }, { name: '10월', matrix: roster() }, { name: '11월', matrix: roster() }, { name: '메모', matrix: [] }], active: 2 };
    expect(rosterSheets(book).map((s) => [s.name, s.active])).toEqual([['11월', true], ['10월', false]]);
    expect(rosterSheets({ sheets: [{ name: '표지', matrix: cover }, { name: '11월', matrix: roster() }], active: 0 }).map((s) => s.name)).toEqual(['11월']);
  });
});
