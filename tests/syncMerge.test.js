import { describe, it, expect } from 'vitest';
import { diffShifts, applyChanges, mergeWithRemote, syncedExceptSkipped } from '../src/lib/syncMerge';

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
  it('서버가 건너뛴 날짜는 동기화 기준에서 빼서 다음에 다시 올라가게', () => {
    const remote = { a: 'D' };
    const merged = { a: 'D', b: '교', c: 'N' };
    const base = syncedExceptSkipped(merged, remote, ['b']);
    expect(base).toEqual({ a: 'D', c: 'N' });
    expect(diffShifts(base, merged)).toEqual({ b: '교' }); // 다음 저장 때 다시 보냄
    expect(syncedExceptSkipped(merged, remote, [])).toBe(merged);
  });
});
