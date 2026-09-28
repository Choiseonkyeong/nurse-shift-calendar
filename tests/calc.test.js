import { describe, it, expect } from 'vitest';
import { leaveYearRange } from '../src/lib/allowance';
import { computeYearStats } from '../src/lib/stats';
import { expandPattern } from '../src/components/PatternFill';
import { HOLIDAYS, getHoliday } from '../src/utils/holidays';
import { buildWidgetData } from '../src/lib/widgetSync';
import { DEFAULT_SHIFT_TYPES } from '../src/lib/shiftTypes';

describe('연차 기준 기간', () => {
  it('회계연도', () => {
    expect(leaveYearRange('2026-10-05')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
  it('입사일 기준', () => {
    expect(leaveYearRange('2026-10-05', 'hire', '2021-03-15')).toEqual({ start: '2026-03-15', end: '2027-03-14' });
    expect(leaveYearRange('2026-02-01', 'hire', '2021-03-15')).toEqual({ start: '2025-03-15', end: '2026-03-14' });
    expect(leaveYearRange('2027-03-01', 'hire', '2020-02-29')).toEqual({ start: '2027-02-28', end: '2028-02-28' });
  });
  it('입사일 미입력 시 회계연도', () => {
    expect(leaveYearRange('2026-10-05', 'hire', '')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('근무 통계', () => {
  it('월별 횟수·연속 근무·연속 나이트', () => {
    const shifts = {
      '2026-01-01': 'D', '2026-01-02': 'N', '2026-01-03': 'N', '2026-01-04': 'N', '2026-01-05': 'OFF',
      '2026-02-01': 'E', '2026-02-02': 'E'
    };
    const s = computeYearStats(shifts, 2026, DEFAULT_SHIFT_TYPES);
    expect(s.months[0].counts).toEqual({ D: 1, N: 3, OFF: 1 });
    expect(s.totals).toEqual({ D: 1, N: 3, OFF: 1, E: 2 });
    expect(s.workDays).toBe(6);
    expect(s.longestWork).toBe(4);
    expect(s.longestNight).toBe(3);
  });
});

describe('반복 패턴', () => {
  it('이번 달 끝까지', () => {
    const r = expandPattern(['D', 'N', 'OFF'], '2026-09-28', 'month');
    expect(r).toEqual({ '2026-09-28': 'D', '2026-09-29': 'N', '2026-09-30': 'OFF' });
  });
  it('주5일은 월요일 기준 정렬', () => {
    const r = expandPattern(['D', 'D', 'D', 'D', 'D', 'OFF', 'OFF'], '2026-10-03', '1', { weekdayAligned: true }); // 토요일
    expect(r['2026-10-03']).toBe('OFF');
    expect(r['2026-10-05']).toBe('D');
  });
});

describe('공휴일', () => {
  it('대체휴일은 모두 평일', () => {
    Object.entries(HOLIDAYS)
      .filter(([, name]) => name === '대체휴일')
      .forEach(([k]) => {
        const [y, m, d] = k.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        expect(dow, k).not.toBe(0);
        expect(dow, k).not.toBe(6);
      });
  });
  it('연도별 핵심 공휴일 존재 (2025~2030)', () => {
    for (let y = 2025; y <= 2030; y++) {
      ['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25'].forEach((md) =>
        expect(getHoliday(`${y}-${md}`), `${y}-${md}`).toBeTruthy()
      );
      expect(Object.entries(HOLIDAYS).filter(([k, n]) => k.startsWith(`${y}-`) && n.includes('설날')).length).toBe(3);
      expect(Object.entries(HOLIDAYS).filter(([k, n]) => k.startsWith(`${y}-`) && n.includes('추석')).length).toBe(3);
    }
  });
});

describe('위젯 데이터', () => {
  it('오늘 기준 어제~13일 뒤 근무와 색·시간', () => {
    const types = DEFAULT_SHIFT_TYPES.map((t) => (t.code === 'D' ? { ...t, start: '07:00', end: '15:00' } : t));
    const data = buildWidgetData({ '2026-09-28': 'D', '2026-09-29': 'N', '2026-12-01': 'E' }, types, new Date(2026, 8, 28));
    expect(Object.keys(data.days)).toEqual(['2026-09-28', '2026-09-29']);
    expect(data.days['2026-09-28']).toMatchObject({ code: 'D', time: '07:00-15:00', bg: '#FEF08A' });
  });
});
