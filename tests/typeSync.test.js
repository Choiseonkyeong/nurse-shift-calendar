import { describe, it, expect } from 'vitest';
import { queueTypeOp, readTypeQueue, flushTypeQueue, applyTypeQueue } from '../src/lib/typeSync';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

describe('근무 종류 오프라인 대기열', () => {
  it('같은 코드는 마지막 작업만 남김', () => {
    const st = new MemoryStorage();
    queueTypeOp({ type: 'upsert', value: { code: '교', label: '교육' } }, st);
    queueTypeOp({ type: 'remove', code: '교' }, st);
    expect(readTypeQueue(st)).toEqual({ upsert: {}, remove: ['교'] });
    queueTypeOp({ type: 'upsert', value: { code: '교', label: '교육2' } }, st);
    expect(readTypeQueue(st)).toEqual({ upsert: { 교: { code: '교', label: '교육2' } }, remove: [] });
  });

  it('서버 목록 위에 대기 중인 변경을 얹어 표시', () => {
    const st = new MemoryStorage();
    queueTypeOp({ type: 'upsert', value: { code: '교', label: '교육' } }, st);
    queueTypeOp({ type: 'remove', code: 'M' }, st);
    const shown = applyTypeQueue([{ code: 'D' }, { code: 'M' }], st);
    expect(shown.map((t) => t.code)).toEqual(['D', '교']);
  });

  it('전송 성공분만 빠지고 실패분은 남음', async () => {
    const st = new MemoryStorage();
    queueTypeOp({ type: 'upsert', value: { code: 'A' } }, st);
    queueTypeOp({ type: 'upsert', value: { code: 'B' } }, st);
    queueTypeOp({ type: 'remove', code: 'C' }, st);
    const sent = [];
    const left = await flushTypeQueue(
      {
        upsert: async (t) => {
          if (t.code === 'B') throw new Error('Failed to fetch');
          sent.push(`+${t.code}`);
        },
        remove: async (c) => sent.push(`-${c}`)
      },
      st
    );
    expect(sent).toEqual(['+A', '-C']);
    expect(left).toBe(1);
    expect(readTypeQueue(st)).toEqual({ upsert: { B: { code: 'B' } }, remove: [] });
    await flushTypeQueue({ upsert: async () => {}, remove: async () => {} }, st);
    expect(st.getItem('pending_type_ops')).toBeNull();
  });
});
