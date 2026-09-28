import { describe, it, expect } from 'vitest';
import { cellToCode, detectYearMonth, extractName, parseRosterWords } from '../src/lib/rosterParse';

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
});
