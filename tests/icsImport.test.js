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

const cal = (...events) =>
  ['BEGIN:VCALENDAR', ...events.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');

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

  it('기기 시간대는 한국으로 고정 (npx vitest 로 바로 실행해도 같게)', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-540);
  });

  it('일정의 시간대(TZID)를 한국 시각으로 바꿔서 가져옴', () => {
    const r = parseIcs(cal(
      ['DTSTART;TZID=America/New_York:20261005T090000', 'SUMMARY:미국 회의'], // EDT 09:00 = 한국 22:00
      ['DTSTART;TZID=America/New_York:20261006T120000', 'SUMMARY:자정 넘김'], // 한국 다음 날 01:00
      ['DTSTART;TZID=America/New_York:20261102T090000', 'SUMMARY:서머타임 끝'], // EST 09:00 = 한국 23:00
      ['DTSTART;TZID="Europe/London":20261010T090000', 'SUMMARY:따옴표'], // BST 09:00 = 한국 17:00
      ['DTSTART;TZID=Korea Standard Time:20261011T100000', 'SUMMARY:윈도우 이름'],
      ['DTSTART;TZID=Asia/Seoul:20261012T100000', 'SUMMARY:서울'],
      ['DTSTART;TZID=Unknown/Zone:20261013T100000', 'SUMMARY:모르는 시간대'], // 기기 시간대로
      ['DTSTART;VALUE=DATE-TIME:20261014T100000', 'SUMMARY:종일 아님']
    ));
    expect(r.notes).toEqual({
      '2026-10-05': '22:00 미국 회의',
      '2026-10-07': '01:00 자정 넘김',
      '2026-11-02': '23:00 서머타임 끝',
      '2026-10-10': '17:00 따옴표',
      '2026-10-11': '10:00 윈도우 이름',
      '2026-10-12': '10:00 서울',
      '2026-10-13': '10:00 모르는 시간대',
      '2026-10-14': '10:00 종일 아님'
    });
  });

  it('시간대가 있는 반복 일정·제외 날짜', () => {
    const r = parseIcs(cal([
      'UID:tz', 'DTSTART;TZID=Asia/Seoul:20261005T070000', 'SUMMARY:D',
      'RRULE:FREQ=DAILY;COUNT=3', 'EXDATE;TZID=Asia/Seoul:20261006T070000'
    ]));
    expect(r.shifts).toEqual({ '2026-10-05': 'D', '2026-10-07': 'D' });
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

  it('CSV: = + - @ 로 시작하는 메모는 엑셀이 계산식(#NAME?)으로 읽지 않게 탭을 붙여 글자로', () => {
    const csv = toCsv({}, { '2026-10-05': '-BLS 교육', '2026-10-06': '=면담', '2026-10-07': '+1시간 연장', '2026-10-08': '@수간호사', '2026-10-09': '교육 - 2시' });
    expect(csv).toContain('2026-10-05,월,,,"\t-BLS 교육"');
    expect(csv).toContain('2026-10-06,화,,,"\t=면담"');
    expect(csv).toContain('2026-10-07,수,,,"\t+1시간 연장"');
    expect(csv).toContain('2026-10-08,목,,,"\t@수간호사"');
    expect(csv).toContain('2026-10-09,금,,,교육 - 2시'); // 가운데 '-' 는 그대로
  });
});

describe('반복 일정 (RRULE)', () => {
  it('매주 월·수 나이트, 4회, 하루 제외(EXDATE)', () => {
    const r = parseIcs(cal([
      'UID:a', 'DTSTART;VALUE=DATE:20261005', 'DTEND;VALUE=DATE:20261006', 'SUMMARY:N',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4', 'EXDATE;VALUE=DATE:20261007'
    ]));
    // 10/5(월) 10/7(수, 제외) 10/12(월) 10/14(수) → COUNT 는 제외 회차도 포함
    expect(Object.keys(r.shifts)).toEqual(['2026-10-05', '2026-10-12', '2026-10-14']);
  });

  it('격주(INTERVAL=2) + UNTIL', () => {
    const r = parseIcs(cal([
      'UID:b', 'DTSTART;VALUE=DATE:20261001', 'DTEND;VALUE=DATE:20261002', 'SUMMARY:오프',
      'RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261031'
    ]));
    expect(Object.keys(r.shifts)).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']);
  });

  it('매일 2일짜리 종일 일정은 펼침 없이 회차마다 2일', () => {
    const r = parseIcs(cal([
      'UID:c', 'DTSTART;VALUE=DATE:20261001', 'DTEND;VALUE=DATE:20261003', 'SUMMARY:D',
      'RRULE:FREQ=DAILY;INTERVAL=4;COUNT=2'
    ]));
    expect(Object.keys(r.shifts)).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06']);
  });

  it('매월 둘째 화요일 / 매월 말일', () => {
    const r = parseIcs(cal(
      ['UID:d', 'DTSTART;VALUE=DATE:20261013', 'SUMMARY:교육 참석', 'RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=3'],
      ['UID:e', 'DTSTART;VALUE=DATE:20261031', 'SUMMARY:연차', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3']
    ));
    expect(Object.keys(r.notes)).toEqual(['2026-10-13', '2026-11-10', '2026-12-08']);
    expect(Object.keys(r.shifts)).toEqual(['2026-10-31', '2026-11-30', '2026-12-31']);
  });

  it('특정 회차 수정(RECURRENCE-ID)·취소 일정', () => {
    const r = parseIcs(cal(
      ['UID:f', 'DTSTART;VALUE=DATE:20261001', 'SUMMARY:D', 'RRULE:FREQ=DAILY;COUNT=3'],
      ['UID:f', 'RECURRENCE-ID;VALUE=DATE:20261002', 'DTSTART;VALUE=DATE:20261002', 'SUMMARY:E'],
      ['UID:g', 'DTSTART;VALUE=DATE:20261010', 'SUMMARY:N', 'STATUS:CANCELLED']
    ));
    expect(r.shifts).toEqual({ '2026-10-01': 'D', '2026-10-02': 'E', '2026-10-03': 'D' });
  });

  it('끝이 없는 반복은 최대 2년까지만', () => {
    const r = parseIcs(cal(['UID:h', 'DTSTART;VALUE=DATE:20261001', 'SUMMARY:D', 'RRULE:FREQ=DAILY']));
    const keys = Object.keys(r.shifts);
    expect(keys.length).toBeLessThanOrEqual(800);
    expect(keys[keys.length - 1] < '2028-10-03').toBe(true);
  });
});
