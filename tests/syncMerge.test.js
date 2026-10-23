import { describe, it, expect } from 'vitest';
import { diffShifts, applyChanges, mergeWithRemote, excludeSkipped } from '../src/lib/syncMerge';

describe('syncMerge', () => {
  it('diffShifts: 추가·변경·삭제', () => {
    expect(diffShifts({ a: 'D', b: 'E' }, { a: 'N', c: 'OFF' })).toEqual({ a: 'N', b: null, c: 'OFF' });
    expect(diffShifts({ a: 'D' }, { a: 'D', b: '' })).toEqual({});
  });

  it('applyChanges: null/빈 값은 삭제', () => {
    expect(applyChanges({ a: 'D', b: 'E' }, { a: null, b: '', c: 'N' })).toEqual({ c: 'N' });
  });

  it('다른 기기 변경은 유지하고 이 기기 변경만 반영', () => {
    const base = { '09-01': 'D', '09-02': 'E' };
    const local = { '09-01': 'D', '09-02': 'E', '09-05': 'N' }; // 이 기기: 9/5 추가
    const remote = { '09-01': 'D', '09-02': 'M', '09-03': 'N' }; // 다른 기기: 9/2 변경, 9/3 추가
    expect(mergeWithRemote(remote, local, base)).toEqual({ '09-01': 'D', '09-02': 'M', '09-03': 'N', '09-05': 'N' });
  });

  it('오프라인에서 지운 근무는 되살아나지 않음', () => {
    const base = { '09-01': 'D', '09-02': 'E' };
    const local = { '09-02': 'E' };
    const remote = { '09-01': 'D', '09-02': 'E' };
    expect(mergeWithRemote(remote, local, base)).toEqual({ '09-02': 'E' });
  });

  it('기준 스냅샷이 없으면(이전 버전) 기기 값 우선', () => {
    expect(mergeWithRemote({ a: 'D', b: 'E' }, { a: 'N', c: '' }, null)).toEqual({ a: 'N', b: 'E' });
  });

  it('excludeSkipped: 건너뛴 날짜는 서버 값으로 되돌리고 나머지는 그대로', () => {
    expect(excludeSkipped({ a: 'X', b: 'D', c: 'Y' }, { a: 'N' }, ['a', 'c'])).toEqual({ a: 'N', b: 'D' });
    expect(excludeSkipped({ a: 'D' }, {}, undefined)).toEqual({ a: 'D' });
  });

  // pullAndMerge 흐름 재현: 서버가 모르는 코드(X)를 건너뛰어도 기기 값이 두 번째 동기화에서 지워지지 않음
  it('서버가 건너뛴 근무는 다음 동기화에서 다시 보내고, 기기에서 지워지지 않음', () => {
    const server = { '09-01': 'D' };
    const save = (changes) => {
      const skipped = Object.keys(changes).filter((k) => changes[k] === 'X');
      Object.entries(changes).forEach(([k, v]) => {
        if (skipped.includes(k)) return;
        if (v) server[k] = v;
        else delete server[k];
      });
      return skipped;
    };
    let base = { '09-01': 'D' };
    let local = { '09-01': 'D', '09-02': 'X', '09-03': 'E' };
    for (let round = 0; round < 2; round += 1) {
      const remote = { ...server };
      const merged = mergeWithRemote(remote, local, base);
      const skipped = save(diffShifts(remote, merged));
      base = excludeSkipped(merged, remote, skipped);
      local = merged;
    }
    expect(local).toEqual({ '09-01': 'D', '09-02': 'X', '09-03': 'E' });
    expect(server).toEqual({ '09-01': 'D', '09-03': 'E' });
    expect(diffShifts(base, local)).toEqual({ '09-02': 'X' }); // 아직 저장 안 된 변경으로 남음
  });
});
