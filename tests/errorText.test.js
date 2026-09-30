import { describe, it, expect } from 'vitest';
import { errorText } from '../src/lib/errorText';

describe('errorText', () => {
  it('네트워크 오류는 연결 확인 안내', () => {
    expect(errorText(new TypeError('Failed to fetch'))).toMatch(/인터넷/);
    expect(errorText(new TypeError('Load failed'))).toMatch(/인터넷/);
  });
  it('서버 영어 오류는 한국어로', () => {
    expect(errorText({ message: 'not a member of this group' })).toMatch(/권한/);
    expect(errorText({ message: 'Could not find the function public.create_shift_swap' })).toMatch(/서버 업데이트/);
    expect(errorText({ message: 'invalid invite code', code: 'P0002' })).toMatch(/초대 코드/);
  });
  it('서버가 보낸 한국어 안내는 그대로, 알 수 없는 영어는 기본 안내', () => {
    expect(errorText({ message: '이미 처리된 요청입니다' })).toBe('이미 처리된 요청입니다');
    expect(errorText({ message: 'duplicate key value violates unique constraint' })).toMatch(/문제가 생겼어요/);
    expect(errorText(null, '저장하지 못했어요.')).toBe('저장하지 못했어요.');
  });
});
