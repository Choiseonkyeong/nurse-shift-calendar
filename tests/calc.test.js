import { describe, it, expect } from 'vitest';
import { leaveYearRange, shiftAllowance, payPeriod } from '../src/lib/allowance';
import { computeYearStats } from '../src/lib/stats';
import { expandPattern } from '../src/components/PatternFill';
import { HOLIDAYS, getHoliday, getHolidayShort } from '../src/utils/holidays';
import { buildWidgetData } from '../src/lib/widgetSync';
import { pickBannerId } from '../src/lib/ads';
import { DEFAULT_SHIFT_TYPES, mergeShiftTypes } from '../src/lib/shiftTypes';

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
  it('달력 칸용 짧은 이름은 모두 3글자 이하', () => {
    Object.keys(HOLIDAYS).forEach((k) => expect([...getHolidayShort(k)].length, `${k} ${HOLIDAYS[k]}`).toBeLessThanOrEqual(3));
    expect(getHolidayShort('2026-09-01')).toBeUndefined();
  });
});

describe('위젯 데이터', () => {
  it('오늘 기준 어제~13일 뒤 근무와 색·시간', () => {
    const types = DEFAULT_SHIFT_TYPES.map((t) => (t.code === 'D' ? { ...t, start: '07:00', end: '15:00' } : t));
    const data = buildWidgetData({ '2026-09-28': 'D', '2026-09-29': 'N', '2026-12-01': 'E' }, types, new Date(2026, 8, 28));
    expect(Object.keys(data.days)).toEqual(['2026-09-28', '2026-09-29']);
    expect(data.days['2026-09-28']).toMatchObject({ code: 'D', time: '07:00-15:00', bg: '#DBEAFE' });
  });
  it('앱을 몇 주 안 열어도 위젯이 비지 않게 두 달치를 넘김', () => {
    const data = buildWidgetData({ '2026-10-20': 'D', '2026-11-27': 'N' }, DEFAULT_SHIFT_TYPES, new Date(2026, 8, 28));
    expect(Object.keys(data.days)).toEqual(['2026-10-20', '2026-11-27']);
  });
  it('그날 일정도 함께 (색 표시 빼고), 근무가 없는 날도 일정이 있으면 넣음', () => {
    const data = buildWidgetData({ '2026-09-28': 'D' }, DEFAULT_SHIFT_TYPES, new Date(2026, 8, 28), { '2026-09-28': '{{r}}교육\n회식', '2026-09-29': '병원' });
    expect(data.days['2026-09-28']).toMatchObject({ code: 'D', notes: '교육, 회식' });
    expect(data.days['2026-09-29']).toMatchObject({ code: '', notes: '병원' });
    expect(data.days['2026-09-28']).not.toHaveProperty('notes', '');
  });
});

import { decideSettingsSync } from '../src/lib/settingsSync';

describe('설정 동기화 방향', () => {
  it.each([
    [null, { updated_at: null }, 'push'], // 서버에 아직 없음 → 기기 값 올림
    [null, { updated_at: '2026-09-28T10:00:00Z' }, 'pull'], // 새 폰 → 서버 값
    ['2026-09-28T09:00:00Z', { updated_at: '2026-09-28T10:00:00Z' }, 'pull'], // 다른 기기가 더 최근
    ['2026-09-28T11:00:00Z', { updated_at: '2026-09-28T10:00:00Z' }, 'push'], // 이 기기가 더 최근
    ['2026-09-28T10:00:00Z', { updated_at: '2026-09-28T10:00:00+00:00' }, 'none']
  ])('기기 %s / 서버 %j → %s', (local, server, expected) => {
    expect(decideSettingsSync(local, server)).toBe(expected);
  });
});

describe('근무 수당 (1회 수당 × 근무 횟수)', () => {
  it('정산 기간 안 근무만, 수당을 넣은 근무만, 합계', () => {
    const shifts = { '2026-09-25': 'N', '2026-09-26': 'N', '2026-10-01': 'N', '2026-10-02': 'E', '2026-10-03': 'D', '2026-10-26': 'N' };
    const r = shiftAllowance(shifts, '2026-09-26', '2026-10-25', { N: 130000, E: 10000, D: 0, M: '' });
    expect(r.items).toEqual([
      { code: 'N', amount: 130000, count: 2, total: 260000 },
      { code: 'E', amount: 10000, count: 1, total: 10000 }
    ]);
    expect(r.total).toBe(270000);
    expect(shiftAllowance(shifts, '2026-09-26', '2026-10-25', undefined)).toEqual({ items: [], total: 0 });
  });
});

describe('정산 기간', () => {
  it('1일 시작은 그 달 전체, 그 외는 전달~이번 달', () => {
    expect(payPeriod(2026, 2, 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(payPeriod(2026, 10, 26)).toEqual({ start: '2026-09-26', end: '2026-10-25' });
    expect(payPeriod(2026, 1, 26)).toEqual({ start: '2025-12-26', end: '2026-01-25' });
  });
});

describe('근무 기본 색', () => {
  it('예전 기본 색(서버 프리셋)은 새 기본 색으로, 직접 고른 색은 그대로', () => {
    const t = mergeShiftTypes([
      { code: 'D', label: 'Day (데이)', bg: '#FEF08A', fg: '#854D0E', start: '07:00' },
      { code: 'E', label: 'Evening (이브닝)', bg: '#000000', fg: '#FFFFFF' },
      { code: '수술', label: '수술', kind: 'work', bg: '#FEF08A', fg: '#854D0E' }
    ]);
    expect(t.find((x) => x.code === 'D')).toMatchObject({ bg: '#DBEAFE', fg: '#1D4ED8', start: '07:00' });
    expect(t.find((x) => x.code === 'E')).toMatchObject({ bg: '#000000', fg: '#FFFFFF' });
    expect(t.find((x) => x.code === '수술')).toMatchObject({ bg: '#FEF08A', fg: '#854D0E' });
  });
});

describe('광고 설정', () => {
  const on = { ads: { enabled: true, androidBannerId: 'ca-app-pub-1234567890123456/1234567890', iosBannerId: 'bad' } };
  it('꺼져 있거나 웹·형식 오류면 표시 안 함', () => {
    expect(pickBannerId({ ads: { ...on.ads, enabled: false } }, 'android')).toBe(null);
    expect(pickBannerId(on, 'web')).toBe(null);
    expect(pickBannerId(on, 'ios')).toBe(null);
    expect(pickBannerId(null, 'android')).toBe(null);
  });
  it('켜져 있으면 플랫폼별 광고 단위 ID', () => {
    expect(pickBannerId(on, 'android')).toBe('ca-app-pub-1234567890123456/1234567890');
  });
});
