import { describe, it, expect } from 'vitest';
import { sureRatio } from '../src/lib/rosterOcr.js';

const cells = (n, conf) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, { code: 'D', confidence: conf }]));

describe('sureRatio (사진 결과를 믿을 만한지)', () => {
  const grid = { cols: Array.from({ length: 30 }) };
  it('대부분 확실히 읽었으면 1에 가까움', () => {
    expect(sureRatio({ names: ['가', '나'], grid, people: { 가: cells(30, 90), 나: { ...cells(28, 90), ...{ '2026-10-29': { code: 'D', confidence: 40 } } } } })).toBeCloseTo(58 / 60);
  });
  it('표 구조를 잘못 잡아 거의 못 읽었으면(빈 칸·노란 칸뿐) 0.4 미만', () => {
    expect(sureRatio({ names: ['가', '나', '다', '라'], grid, people: { 가: cells(5, 90), 나: cells(20, 50) } })).toBeLessThan(0.4);
  });
  it('줄이나 열이 없으면 0', () => {
    expect(sureRatio({ names: [], grid, people: {} })).toBe(0);
    expect(sureRatio({})).toBe(0);
  });
});
