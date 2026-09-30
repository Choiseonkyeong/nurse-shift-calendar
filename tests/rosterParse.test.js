import { describe, it, expect } from 'vitest';
import { cellToCode, detectYearMonth, extractName, parseRosterWords, nameQuality, fixSurname } from '../src/lib/rosterParse';

const w = (text, x0, y0, x1, y1, confidence = 90) => ({ text, x0, y0, x1, y1, confidence });

/** 합성 근무표: 헤더 1~30, 2명, 살짝 기울어짐(slope) */
function syntheticRoster({ slope = 0 } = {}) {
  const words = [w('2026년', 300, 10, 380, 40), w('10월', 390, 10, 440, 40), w('근무표', 450, 10, 520, 40)];
  const colX = (d) => 120 + (d - 1) * 40;
  const y = (base, x) => base + slope * x;
  for (let d = 1; d <= 30; d++) words.push(w(String(d), colX(d) - 8, y(80, colX(d)), colX(d) + 8, y(100, colX(d))));
  words.push(w('이름', 20, 80, 60, 100));
  const rows = { 김간호: 'DENO', 이간호: 'NNOE' };
  Object.entries(rows).forEach(([name, pattern], r) => {
    const base = 130 + r * 40;
    words.push(w(name, 20, y(base, 40), 80, y(base + 20, 40)));
    for (let d = 1; d <= 30; d++) {
      const ch = pattern[(d - 1) % pattern.length];
      words.push(w(ch, colX(d) - 7, y(base, colX(d)), colX(d) + 7, y(base + 20, colX(d))));
    }
  });
  return { words, rows };
}

describe('rosterParse', () => {
  it('셀 표기 → 근무 코드', () => {
    expect(cellToCode('D')).toBe('D');
    expect(cellToCode('0')).toBe('OFF');
    expect(cellToCode('[O]')).toBe('OFF');
    expect(cellToCode('/')).toBe('OFF');
    expect(cellToCode('6')).toBe('E');
    expect(cellToCode('연 차')).toBe('연차');
    expect(cellToCode('화')).toBeNull();
    expect(cellToCode('교', [{ code: '교', label: '교육' }])).toBe('교');
  });

  it('연/월 감지', () => {
    expect(detectYearMonth('2026년 10월 근무표', { year: 2025, month: 1 })).toMatchObject({ year: 2026, month: 10, found: true });
    expect(detectYearMonth('7병동 2026.09', { year: 2025, month: 1 })).toMatchObject({ year: 2026, month: 9 });
    expect(detectYearMonth('3월 근무', { year: 2027, month: 1 })).toMatchObject({ year: 2027, month: 3 });
  });

  it('이름 추출', () => {
    expect(extractName('홍길동(N-keep)')).toBe('홍길동');
    expect(extractName('RN 홍길동')).toBe('홍길동');
    expect(extractName('홍 길 동')).toBe('홍길동');
    expect(extractName('비고')).toBe('');
  });

  it.each([0, 0.02])('표 복원 (기울기 %s)', (slope) => {
    const { words, rows } = syntheticRoster({ slope });
    const r = parseRosterWords(words, { year: 2026, month: 1 });
    expect(r.error).toBeUndefined();
    expect(r.year).toBe(2026);
    expect(r.month).toBe(10);
    expect(r.names).toEqual(Object.keys(rows));
    const map = { D: 'D', E: 'E', N: 'N', O: 'OFF' };
    Object.entries(rows).forEach(([name, pattern]) => {
      for (let d = 1; d <= 30; d++) {
        expect(r.people[name][`2026-10-${String(d).padStart(2, '0')}`]?.code).toBe(map[pattern[(d - 1) % pattern.length]]);
      }
    });
  });

  it('헤더가 없으면 오류 메시지', () => {
    expect(parseRosterWords([w('안녕', 0, 0, 10, 10)], { year: 2026, month: 10 }).error).toMatch(/날짜/);
  });

  it('한 달에 걸친 근무표(7/26~8/25): 앞쪽은 지난달, 합계 열은 날짜로 읽지 않음', () => {
    // 헤더: 26 27 … 31 | 1 … 25 | OFF D E 합계. 색칠된 칸의 날짜(1~7, 15, 17, 20)는 못 읽은 상황
    const days = [26, 27, 28, 29, 30, 31, ...Array.from({ length: 25 }, (_, i) => i + 1)];
    const colX = (i) => 120 + i * 40;
    const missed = new Set([1, 2, 3, 4, 5, 6, 7, 15, 17, 20]);
    const words = [w('2026년', 300, 10, 380, 40), w('8월', 390, 10, 430, 40), w('근무표', 440, 10, 510, 40)];
    days.forEach((d, i) => {
      if (!missed.has(d)) words.push(w(String(d), colX(i) - 8, 80, colX(i) + 8, 100));
    });
    ['OFF', 'D', 'E'].forEach((t, k) => words.push(w(t, colX(31 + k) - 10, 80, colX(31 + k) + 10, 100)));
    const codes = ['D', 'E', 'N', 'OFF'];
    const expected = {};
    days.forEach((d, i) => {
      const code = codes[i % 4];
      words.push(w(code, colX(i) - 7, 130, colX(i) + 7, 150));
      expected[i < 6 ? `2026-07-${d}` : `2026-08-${String(d).padStart(2, '0')}`] = code;
    });
    // 합계 열 숫자·글자 (날짜로 읽으면 안 됨)
    ['8', 'D', '9'].forEach((t, k) => words.push(w(t, colX(31 + k) - 7, 130, colX(31 + k) + 7, 150)));
    words.push(w('최간호', 20, 130, 80, 150));

    const r = parseRosterWords(words, { year: 2026, month: 9 });
    expect(r.error).toBeUndefined();
    expect(r.month).toBe(8);
    const got = Object.fromEntries(Object.entries(r.people['최간호']).map(([k, v]) => [k, v.code]));
    expect(got).toEqual(expected);
  });

  // 실제 사용 사례: '2026년 10월 근무표'(9/26~10/25), 날짜 아래 요일 줄, 3일 개천절·9일 한글날
  // 사진에서 제목 월을 못 읽거나 잘못 읽어도 요일·공휴일 칸으로 10월을 찾아야 함
  function wrappedRoster(title, { weekdays = true, holidays = true } = {}) {
    const days = [26, 27, 28, 29, 30, ...Array.from({ length: 25 }, (_, i) => i + 1)];
    const dates = days.map((d, i) => new Date(2026, i < 5 ? 8 : 9, d));
    const colX = (i) => 120 + i * 40;
    const words = title.map((t, k) => w(t, 200 + k * 90, 10, 280 + k * 90, 40));
    days.forEach((d, i) => {
      words.push(w(String(d), colX(i) - 8, 80, colX(i) + 8, 100));
      // 날짜 바로 뒤에 요일이 읽힌 순서 (예: '5' '월' → '5 월')
      if (weekdays) words.push(w('일월화수목금토'[dates[i].getDay()], colX(i) - 7, 104, colX(i) + 7, 120));
    });
    if (holidays) {
      words.push(w('개천절', colX(7) - 15, 122, colX(7) + 15, 132));
      words.push(w('한글날', colX(13) - 15, 122, colX(13) + 15, 132));
    }
    const codes = ['D', 'E', 'N', 'OFF'];
    days.forEach((d, i) => words.push(w(codes[i % 4], colX(i) - 7, 150, colX(i) + 7, 170)));
    words.push(w('최간호', 20, 150, 80, 170));
    return words;
  }
  const TODAY = new Date(2026, 8, 30);
  const range = (r) => {
    const keys = Object.keys(r.people['최간호']).sort();
    return [keys[0], keys[keys.length - 1]];
  };

  it("'5 월'(5일 칸 + 요일 '월')을 제목 월로 읽지 않음", () => {
    expect(detectYearMonth('26 토 27 일 28 월 1 목 5 월 6 화', { year: 2026, month: 9 })).toMatchObject({ found: false });
    expect(detectYearMonth('10 월 근무표', { year: 2026, month: 1 })).toMatchObject({ month: 10, found: true });
  });

  it('제목 월을 못 읽었고 다른 달(5월)을 보고 있었어도 → 요일·공휴일로 10월(9/26~10/25)', () => {
    const r = parseRosterWords(wrappedRoster(['분당', '5병동', '근무표']), { year: 2026, month: 5, today: TODAY });
    expect(r.error).toBeUndefined();
    expect([r.year, r.month]).toEqual([2026, 10]);
    expect(range(r)).toEqual(['2026-09-26', '2026-10-25']);
  });

  it("제목 '10월'을 '1'로 잘못 읽어도 → 공휴일 칸(개천절 3일)으로 10월", () => {
    // 2026년 1월과 10월은 1일 요일이 같아서 요일만으로는 구분 불가 → 공휴일로 구분
    const r = parseRosterWords(wrappedRoster(['2026년', '1O', '근무표']), { year: 2026, month: 9, today: TODAY });
    expect([r.year, r.month]).toEqual([2026, 10]);
    expect(range(r)).toEqual(['2026-09-26', '2026-10-25']);
  });

  it('요일만 있어도 오늘과 가까운 맞는 달, 제목이 맞으면 그대로', () => {
    const noHoliday = parseRosterWords(wrappedRoster(['근무표'], { holidays: false }), { year: 2026, month: 5, today: TODAY });
    expect([noHoliday.year, noHoliday.month]).toEqual([2026, 10]);
    const ok = parseRosterWords(wrappedRoster(['2026년', '10월', '근무표']), { year: 2026, month: 5, today: TODAY });
    expect([ok.year, ok.month]).toEqual([2026, 10]);
    // 요일·공휴일 줄이 없으면 예전처럼 제목(없으면 보고 있던 달) 기준
    const plain = parseRosterWords(wrappedRoster(['2026년', '10월'], { weekdays: false, holidays: false }), { year: 2026, month: 5, today: TODAY });
    expect(plain.month).toBe(10);
  });

  it('기울어진 사진: 날짜 줄이 오른쪽으로 갈수록 내려가도(1.5°) 한 줄로 찾고, 칸이 밀리지 않음', () => {
    const slope = 0.026; // tan(1.5°)
    const days = [26, 27, 28, 29, 30, ...Array.from({ length: 25 }, (_, i) => i + 1)];
    const colX = (i) => 200 + i * 60;
    const words = [w('2026년', 300, 10, 380, 40), w('10월', 390, 10, 440, 40)];
    const codes = ['D', 'E', 'N', 'OFF'];
    days.forEach((d, i) => {
      const x = colX(i);
      words.push(w(String(d), x - 10, 80 + slope * x, x + 10, 96 + slope * x));
      words.push(w(codes[i % 4], x - 10, 160 + slope * x, x + 10, 176 + slope * x));
    });
    words.push(w('최간호', 60, 160 + slope * 90, 130, 176 + slope * 90));
    const r = parseRosterWords(words, { year: 2026, month: 10, today: TODAY });
    expect(r.error).toBeUndefined();
    const got = r.people['최간호'];
    expect(Object.keys(got).length).toBe(30);
    expect(got['2026-09-26'].code).toBe('D');
    expect(got['2026-10-25'].code).toBe(codes[29 % 4]);
  });

  it('흐린 사진에서 요일 줄(토 일 월 …)이 근무 글자로 읽혀도 사람 줄로 잡지 않음 (이름이 한 줄씩 밀리지 않게)', () => {
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const colX = (i) => 200 + i * 40;
    const words = [w('2026년', 300, 10, 380, 40), w('12월', 390, 10, 440, 40)];
    days.forEach((d, i) => {
      words.push(w(String(d), colX(i) - 8, 80, colX(i) + 8, 96));
      // 요일 줄: 일부는 요일로, 일부는 근무처럼(D·N·야) 잘못 읽힘
      const wd = '일월화수목금토'[new Date(2026, 11, d).getDay()];
      words.push(w(i % 3 === 0 ? ['D', 'N', '야'][i % 3 === 0 ? (i / 3) % 3 : 0] : wd, colX(i) - 7, 104, colX(i) + 7, 120));
      words.push(w(['D', 'E', 'N', 'OFF'][i % 4], colX(i) - 7, 150, colX(i) + 7, 166));
    });
    words.push(w('분당', 40, 104, 90, 120), w('김간호', 40, 150, 100, 166));
    const r = parseRosterWords(words, { year: 2026, month: 12, today: TODAY });
    expect(r.names).toEqual(['김간호']);
  });

  it('제목 줄만 따로 다시 읽은 글자(titleText)로 연/월', () => {
    const r = parseRosterWords(wrappedRoster(['분당', '5병동'], { weekdays: false, holidays: false }), {
      year: 2026, month: 5, today: TODAY, titleText: '<분당 5병동 2026년 10월 근무표 OFF 11>'
    });
    expect([r.year, r.month, r.found]).toEqual([2026, 10, true]);
  });

  it("'연차'가 흐려 '연체·연자·4X'로 읽힌 경우, 이름다운 정도", () => {
    expect(cellToCode('연체')).toBe('연차');
    expect(cellToCode('연자')).toBe('연차');
    expect(cellToCode('4X')).toBe('연차');
    expect(nameQuality('남영주')).toBeGreaterThan(nameQuality('대내')); // '(N-keep)' 이 잡티로 읽힌 두 글자
    expect(nameQuality('김비나')).toBeGreaterThan(nameQuality('비나'));
    expect(nameQuality('3번째 줄')).toBe(0);
    expect(fixSurname('롱숙언')).toBe('홍숙언');
  });

  it("'연차'가 영문으로 읽힌 경우", () => {
    expect(cellToCode('HX')).toBe('연차');
    expect(cellToCode('AX')).toBe('연차');
  });
});

