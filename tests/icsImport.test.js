import { describe, it, expect } from 'vitest';
import { parseIcs, matchShiftCode } from '../src/lib/icsImport';
import { toIcs, toCsv } from '../src/lib/exportData';

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261001',
  'DTEND;VALUE=DATE:20261002',
  'SUMMARY:나이트',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261002',
  'DTEND;VALUE=DATE:20261004',
  'SUMMARY:오프',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20261005T010000Z',
  'DTEND:20261005T020000Z',
  'SUMMARY:치과 ',
  ' 예약',
  'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

describe('icsImport', () => {
  it('근무 이름 인식', () => {
    expect(matchShiftCode('D')).toBe('D');
    expect(matchShiftCode('데이 근무')).toBe('D');
    expect(matchShiftCode('Night')).toBe('N');
    expect(matchShiftCode('휴무')).toBe('OFF');
    expect(matchShiftCode('교육', [{ code: '교', label: '교육' }])).toBe('교');
    expect(matchShiftCode('치과 예약')).toBeNull();
  });

  it('종일 일정 펼치기, 시간 일정은 메모, 줄 접기 해제', () => {
    const r = parseIcs(ICS);
    expect(r.shifts).toEqual({ '2026-10-01': 'N', '2026-10-02': 'OFF', '2026-10-03': 'OFF' });
    expect(r.notes).toEqual({ '2026-10-05': '10:00 치과 예약' }); // TZ=Asia/Seoul
    expect(r.eventCount).toBe(3);
  });
});

describe('exportData', () => {
  const shifts = { '2026-10-01': 'D', '2026-10-02': 'OFF' };
  const notes = { '2026-10-02': '회식, 7시; "준비"' };

  it('.ics 내보내기 → 가져오기 왕복', () => {
    const r = parseIcs(toIcs(shifts, notes, new Date('2026-09-28T00:00:00Z')));
    expect(r.shifts).toEqual(shifts);
    expect(r.notes).toEqual(notes);
  });

  it('CSV: BOM·요일·따옴표 이스케이프', () => {
    const csv = toCsv(shifts, notes, [{ code: 'D', label: 'Day (데이)' }]);
    expect(csv.startsWith('﻿날짜,요일,근무,근무 이름,메모')).toBe(true);
    expect(csv).toContain('2026-10-01,목,D,Day (데이),');
    expect(csv).toContain('2026-10-02,금,OFF,,"회식, 7시; ""준비"""');
  });
});
