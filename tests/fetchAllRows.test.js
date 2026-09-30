import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/supabaseClient', () => ({ getSupabase: async () => ({}) }));
const { fetchAllRows, PAGE_SIZE } = await import('../src/lib/shiftApi');

/** 서버처럼 한 번에 최대 PAGE_SIZE 행만 돌려주는 가짜 쿼리 */
const fakeQuery = (total) => {
  const rows = Array.from({ length: total }, (_, i) => ({ i }));
  const calls = [];
  const make = () => ({
    range: async (from, to) => {
      calls.push([from, to]);
      return { data: rows.slice(from, Math.min(to + 1, from + PAGE_SIZE)), error: null };
    }
  });
  return { make, calls };
};

describe('fetchAllRows (서버 1000행 제한 대응)', () => {
  it('1000행 넘는 결과를 빠짐없이 순서대로', async () => {
    const { make, calls } = fakeQuery(2500);
    const rows = await fetchAllRows(make);
    expect(rows).toHaveLength(2500);
    expect(rows[2499]).toEqual({ i: 2499 });
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('딱 1000행이면 다음 페이지(빈 결과)까지 확인', async () => {
    const { make, calls } = fakeQuery(1000);
    expect(await fetchAllRows(make)).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });
  it('적으면 한 번만 요청, 오류는 그대로 전달', async () => {
    const { make, calls } = fakeQuery(3);
    expect(await fetchAllRows(make)).toHaveLength(3);
    expect(calls).toHaveLength(1);
    await expect(fetchAllRows(() => ({ range: async () => ({ data: null, error: new Error('boom') }) }))).rejects.toThrow('boom');
  });
});
