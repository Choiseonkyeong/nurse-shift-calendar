import { describe, it, expect, beforeEach } from 'vitest';
import { createBackup, parseBackup, restoreBackup } from '../src/lib/backup';
import { markGroupSeen, hasUnread } from '../src/lib/groupActivity';
import { friendlyAuthError } from '../src/lib/account';
import { toIcs } from '../src/lib/exportData';

/** localStorage 대용 */
class MemoryStorage {
  constructor(init = {}) {
    this.map = new Map(Object.entries(init));
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

describe('전체 백업/복원', () => {
  it('백업 → 검증 → 복원 왕복, 동기화 기준점 삭제·근무 종류 업로드 표시', () => {
    const src = new MemoryStorage({
      shift_user_name: '김간호',
      my_shift_data: JSON.stringify({ '2026-10-01': 'D', '2026-10-02': '' }),
      day_notes: JSON.stringify({ '2026-10-01': '교육' }),
      custom_shift_types: JSON.stringify([{ code: '교', label: '교육', kind: 'work' }]),
      shift_configs: JSON.stringify({ hourlyWage: 12000 }),
      roster_name: '김간호사',
      unrelated: 'x'
    });
    const backup = createBackup(src, new Date('2026-09-28T00:00:00Z'));
    expect(backup.data.unrelated).toBeUndefined();

    const { data, summary } = parseBackup(JSON.stringify(backup));
    expect(summary).toMatchObject({ shifts: 1, notes: 1, types: 1, name: '김간호' });

    const dst = new MemoryStorage({ my_shift_data: '{"2026-01-01":"N"}', synced_shift_data: '{}', synced_day_notes: '{}' });
    restoreBackup(data, dst);
    expect(JSON.parse(dst.getItem('my_shift_data'))).toEqual({ '2026-10-01': 'D', '2026-10-02': '' });
    expect(dst.getItem('shift_user_name')).toBe('김간호');
    expect(dst.getItem('roster_name')).toBe('김간호사');
    expect(JSON.parse(dst.getItem('shift_configs'))).toEqual({ hourlyWage: 12000 });
    expect(dst.getItem('synced_shift_data')).toBeNull();
    expect(dst.getItem('synced_day_notes')).toBeNull();
    expect(JSON.parse(dst.getItem('pending_type_ops')).upsert['교']).toMatchObject({ label: '교육' });
    // 복원한 설정이 서버의 예전 설정보다 최신으로 취급됨
    expect(Date.parse(dst.getItem('settings_updated_at'))).toBeGreaterThan(Date.now() - 5000);
  });

  it('잘못된 파일 거부', () => {
    expect(() => parseBackup('not json')).toThrow(/읽을 수 없/);
    expect(() => parseBackup('{"app":"other","data":{}}')).toThrow(/백업 파일이 아닙니다/);
    expect(() => parseBackup('{"app":"nurse-shift-calendar","data":{"my_shift_data":{"bad":"D"}}}')).toThrow(/손상/);
  });
});

describe('그룹 새 글 표시', () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });
  it('본 뒤 더 새 글만 새 글', () => {
    expect(hasUnread('g1', '2026-10-01T00:00:00Z')).toBe(true);
    markGroupSeen('g1', '2026-10-01T00:00:00Z');
    expect(hasUnread('g1', '2026-10-01T00:00:00Z')).toBe(false);
    expect(hasUnread('g1', '2026-10-02T00:00:00Z')).toBe(true);
    markGroupSeen('g1', '2026-09-01T00:00:00Z'); // 과거 값으로 되돌리지 않음
    expect(hasUnread('g1', '2026-10-01T00:00:00Z')).toBe(false);
    expect(hasUnread('g2', null)).toBe(false);
  });
});

describe('계정 오류 안내', () => {
  it.each([
    ['Invalid login credentials', /비밀번호가 올바르지/],
    ['Email rate limit exceeded', /한도/],
    ['A user with this email address has already been registered', /이미 다른 계정/],
    ['Password should be at least 6 characters', /6자 이상/],
    ['Email not confirmed', /인증이 아직/],
    ['Failed to fetch', /네트워크/]
  ])('%s', (msg, re) => {
    expect(friendlyAuthError(new Error(msg))).toMatch(re);
  });
});

describe('.ics 특수문자 이스케이프', () => {
  it('세미콜론·쉼표·역슬래시·줄바꿈', () => {
    const ics = toIcs({}, { '2026-10-01': 'a;b,c\\d\ne' });
    const bs = '\\';
    expect(ics).toContain(`SUMMARY:a${bs};b${bs},c${bs}${bs}d${bs}ne`);
  });
});
