import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeToken, looksLikeCode, withAliases, pendingTokens, applyAliases, loadAliases, saveAliases } from '../src/lib/codeAliases';
import { cellToCode, parseRosterWords } from '../src/lib/rosterParse';
import { DEFAULT_SHIFT_TYPES } from '../src/lib/shiftTypes';

/** localStorage 대용 */
const memoryStorage = () => {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};

describe('근무표 표기 기억 (codeAliases)', () => {
  beforeEach(() => {
    globalThis.localStorage = memoryStorage();
  });

  it('표기 정리·근무 표기처럼 보이는 글자', () => {
    expect(normalizeToken(' d1 ')).toBe('D1');
    expect(normalizeToken('(H2)')).toBe('H2');
    expect(looksLikeCode('D1')).toBe(true);
    expect(looksLikeCode('A조')).toBe(true);
    expect(looksLikeCode('12')).toBe(false); // 숫자만
    expect(looksLikeCode('I')).toBe(false); // 표 선 잡티
    expect(looksLikeCode('보수교육')).toBe(true);
    expect(looksLikeCode('신규오름교육')).toBe(false); // 5자 이상은 문장
  });

  it('기억한 표기는 근무로 읽고, 없는 근무 종류로 정한 표기는 무시', () => {
    const types = withAliases(DEFAULT_SHIFT_TYPES, { D1: 'D', T5: '', X9: '없는근무' });
    expect(cellToCode('D1', types)).toBe('D');
    expect(cellToCode('d1', types)).toBe('D');
    expect(cellToCode('T5', types)).toBe(null);
    expect(cellToCode('X9', types)).toBe(null);
    expect(cellToCode('D1', DEFAULT_SHIFT_TYPES)).toBe(null);
  });

  it('물어볼 표기: 정하지 않았고 표 전체에서 세 번 이상 나온 것만, 날짜 순', () => {
    const mine = { '2026-11-03': 'D1', '2026-11-02': 'D1', '2026-11-11': 'H2', '2026-11-12': 'LJ', '2026-11-13': 'T5' };
    const counts = { D1: 18, H2: 3, LJ: 1, T5: 5 };
    expect(pendingTokens(mine, counts, { T5: '' })).toEqual([
      { token: 'D1', days: ['2026-11-02', '2026-11-03'] },
      { token: 'H2', days: ['2026-11-11'] }
    ]);
  });

  it('정한 표기로 빈 칸만 채움 (근무 아님 · 정하지 않은 표기는 비움)', () => {
    const out = applyAliases({ '2026-11-01': 'OFF' }, { '2026-11-01': 'D1', '2026-11-02': 'D1', '2026-11-03': 'T5', '2026-11-04': 'Q' }, { D1: 'D', T5: '' });
    expect(out).toEqual({ '2026-11-01': 'OFF', '2026-11-02': 'D' });
  });

  it('저장·불러오기 (손상된 값은 빈 표기)', () => {
    saveAliases({ D1: 'D' });
    expect(loadAliases()).toEqual({ D1: 'D' });
    localStorage.setItem('shift_code_aliases', '[1,2]');
    expect(loadAliases()).toEqual({});
    localStorage.setItem('shift_code_aliases', '{oops');
    expect(loadAliases()).toEqual({});
  });
});

describe('날짜 칸 찾기: 앞쪽 날짜 숫자가 표 선과 붙어 못 읽혀도', () => {
  const w = (text, x0, y0, x1, y1, confidence = 90) => ({ text, x0, y0, x1, y1, confidence });
  it("'|1|2|3|4|5|' 로 읽힌 날짜 칸을 아래 근무 글자 열로 찾고, 표 아래 안내 문장은 무시", () => {
    const colX = (d) => 200 + (d - 1) * 70;
    const words = [w('11월', 900, 10, 960, 40), w('근무표', 970, 10, 1060, 40), w('|1|2|3|4|5|', 160, 80, 560, 110, 28)];
    for (let d = 6; d <= 30; d++) words.push(w(String(d), colX(d) - 10, 80, colX(d) + 10, 110));
    const names = ['김하늘', '이서연', '박지우', '정민서'];
    names.forEach((name, r) => {
      const y = 170 + r * 50;
      words.push(w(name, 40, y, 120, y + 25));
      for (let d = 1; d <= 30; d++) words.push(w(d % 7 === 1 ? 'OF' : 'D', colX(d) - 12, y, colX(d) + 12, y + 25));
    });
    // 표 아래 안내 문장 (한글 단어가 날짜 칸 위치에 있음)
    words.push(w('보수교육', 300, 500, 380, 525), w('김은지', 402, 500, 488, 525));
    const r = parseRosterWords(words, { year: 2026, month: 11, today: new Date(2026, 10, 5) });
    expect(r.error).toBeUndefined();
    expect(r.grid.cols.map((c) => c.idx)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(r.people['김하늘']['2026-11-01'].code).toBe('OFF');
    expect(r.people['김하늘']['2026-11-02'].code).toBe('D');
  });
});
