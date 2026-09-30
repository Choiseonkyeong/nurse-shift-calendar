import { describe, it, expect } from 'vitest';
import { shiftDateKey, moveImportedMonth } from '../src/lib/importMonth';
import { fixSurname, extractName, checkDayRowMonth, datesForDayRow } from '../src/lib/rosterParse';

describe('가져온 근무표 달 옮기기', () => {
  it('날짜 키 옮기기, 없는 날짜는 제외', () => {
    expect(shiftDateKey('2026-04-26', 5)).toBe('2026-09-26');
    expect(shiftDateKey('2026-05-25', 5)).toBe('2026-10-25');
    expect(shiftDateKey('2026-08-31', 1)).toBeNull(); // 9월 31일 없음
    expect(shiftDateKey('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('등록 전 근무는 되살리고 옮긴 달에 다시 등록, 다시 고르기용 인식 결과도 함께', () => {
    const current = { '2026-04-26': 'D', '2026-05-01': 'N', '2026-05-02': 'OFF', '2026-06-01': 'E' };
    const banner = {
      yearMonth: '2026-05',
      keys: ['2026-04-26', '2026-05-01'],
      previous: { '2026-04-26': null, '2026-05-01': 'M' }, // 5/1 에는 원래 M
      uncertain: ['2026-05-01'],
      imp: { source: '사진', yearMonth: '2026-05', byName: { 최수민: { shifts: { '2026-05-01': 'N' }, uncertain: [] } } }
    };
    const { shifts, banner: b } = moveImportedMonth(current, banner, 5);
    expect(shifts).toEqual({ '2026-05-01': 'M', '2026-05-02': 'OFF', '2026-06-01': 'E', '2026-09-26': 'D', '2026-10-01': 'N' });
    expect(b.yearMonth).toBe('2026-10');
    expect(b.keys).toEqual(['2026-09-26', '2026-10-01']);
    expect(b.previous).toEqual({ '2026-09-26': null, '2026-10-01': null });
    expect(b.uncertain).toEqual(['2026-10-01']);
    expect(b.imp.byName['최수민'].shifts).toEqual({ '2026-10-01': 'N' });
    // 되돌아가기(-5)하면 처음 상태
    expect(moveImportedMonth(shifts, b, -5).shifts).toEqual(current);
  });
});

describe('사진 인식 이름: 성씨 오인식 보정', () => {
  it('성씨가 아닌 첫 글자 → 모양이 비슷한 성씨', () => {
    expect(fixSurname('죄수민')).toBe('최수민');
    expect(fixSurname('긴비나')).toBe('김비나');
    expect(fixSurname('욘다은')).toBe('윤다은');
    expect(extractName('CN 죄수민')).toBe('최수민');
  });
  it('이미 성씨이거나, 두 글자(성이 빠졌을 수 있음)면 그대로', () => {
    expect(fixSurname('최수민')).toBe('최수민');
    expect(fixSurname('홍숙언')).toBe('홍숙언');
    expect(fixSurname('다은')).toBe('다은');
    expect(extractName('남명')).toBe('남명');
  });
});

describe('엑셀 날짜 줄의 달 확인', () => {
  // 9/26 ~ 10/25 (2026년 10월 근무표)
  const dayNums = [26, 27, 28, 29, 30, ...Array.from({ length: 25 }, (_, i) => i + 1)];
  const days = dayNums.map((day, i) => ({ col: i + 2, day }));
  const weekdays = Object.fromEntries(days.map(({ col }, i) => [col, new Date(2026, i < 5 ? 8 : 9, dayNums[i]).getDay()]));
  const holidays = { [days[7].col]: [10, 3], [days[13].col]: [10, 9] }; // 3일 개천절, 9일 한글날
  const today = new Date(2026, 8, 30);

  it('제목이 없어 보고 있던 5월로 시작해도 → 요일·공휴일로 10월', () => {
    const r = checkDayRowMonth({ days, weekdays, holidays, ym: { year: 2026, month: 5 }, found: false, today });
    expect(r).toEqual({ year: 2026, month: 10 });
    const keys = datesForDayRow(days, r.year, r.month).map((d) => d.key);
    expect([keys[0], keys[keys.length - 1]]).toEqual(['2026-09-26', '2026-10-25']);
  });

  it('제목을 1월로 잘못 읽어도 공휴일 칸으로 10월, 제목이 맞으면 그대로', () => {
    expect(checkDayRowMonth({ days, weekdays, holidays, ym: { year: 2026, month: 1 }, found: true, today })).toEqual({ year: 2026, month: 10 });
    expect(checkDayRowMonth({ days, weekdays, holidays, ym: { year: 2026, month: 10 }, found: true, today })).toEqual({ year: 2026, month: 10 });
    // 요일·공휴일이 없으면 제목대로
    expect(checkDayRowMonth({ days, ym: { year: 2026, month: 5 }, found: false, today })).toEqual({ year: 2026, month: 5 });
  });

  it('30일까지인 달에 31이 있으면 그 칸은 빼고 (다음 달 1일로 겹치지 않게)', () => {
    const keys = datesForDayRow([{ col: 0, day: 30 }, { col: 1, day: 31 }, { col: 2, day: 1 }], 2026, 10).map((d) => d.key);
    expect(keys).toEqual(['2026-09-30', '2026-10-01']);
  });
});
