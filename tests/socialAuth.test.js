import { describe, it, expect, beforeEach } from 'vitest';
import { isOAuthReturn, oauthErrorText, oauthDisplayName, linkedProviders, consumeOAuthNotice, OAUTH_NOTICE_KEY } from '../src/lib/socialAuth';

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

describe('소셜 로그인 복귀 판별', () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
  });

  it('시작한 적 없으면 토큰이 있어도 아님', () => {
    expect(isOAuthReturn('https://a.app/#access_token=x&refresh_token=y')).toBe(false);
  });

  it('시작 후 토큰·오류와 함께 돌아오면 소셜 복귀', () => {
    localStorage.setItem('oauth_pending', JSON.stringify({ provider: 'kakao', mode: 'link' }));
    expect(isOAuthReturn('https://a.app/#access_token=x&refresh_token=y')).toBe(true);
    expect(isOAuthReturn('https://a.app/?error=access_denied')).toBe(true);
    expect(isOAuthReturn('com.nurseshift.app://auth-callback#access_token=x')).toBe(true);
    expect(isOAuthReturn('https://a.app/')).toBe(false);
  });

  it('이메일 인증 링크(type=...)는 소셜 복귀가 아님', () => {
    localStorage.setItem('oauth_pending', JSON.stringify({ provider: 'kakao', mode: 'link' }));
    expect(isOAuthReturn('https://a.app/#access_token=x&type=email_change')).toBe(false);
  });

  it('안내는 한 번만', () => {
    localStorage.setItem(OAUTH_NOTICE_KEY, JSON.stringify({ type: 'ok', text: 'hi' }));
    expect(consumeOAuthNotice()).toEqual({ type: 'ok', text: 'hi' });
    expect(consumeOAuthNotice()).toBe(null);
  });
});

describe('소셜 계정 정보', () => {
  it('오류 안내 문구', () => {
    expect(oauthErrorText('kakao', 'identity_already_exists')).toMatch(/이 카카오 계정은 이미 다른/);
    expect(oauthErrorText('google', 'access_denied')).toBe('Google 로그인을 취소했어요.');
  });

  it('표시 이름·연결된 제공자', () => {
    expect(oauthDisplayName({ user_metadata: { nickname: ' 간호사 ' } })).toBe('간호사');
    expect(oauthDisplayName({})).toBe('');
    expect(linkedProviders({ identities: [{ provider: 'email' }, { provider: 'kakao' }] })).toEqual(['kakao']);
  });
});
