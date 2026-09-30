import { describe, it, expect } from 'vitest';
import { detectInstallEnv, kakaoExternalUrl } from '../src/lib/installHint';

const UA = {
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 KAKAOTALK 10.8.3',
  kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.3',
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36'
};

describe('홈 화면 추가 안내 환경 판별', () => {
  it('카카오톡 안 브라우저 (안드로이드·아이폰)', () => {
    expect(detectInstallEnv({ ua: UA.kakaoAndroid })).toBe('kakao-android');
    expect(detectInstallEnv({ ua: UA.kakaoIos })).toBe('kakao-ios');
  });

  it('아이폰 사파리 / 안드로이드 일반 브라우저', () => {
    expect(detectInstallEnv({ ua: UA.iosSafari })).toBe('ios');
    expect(detectInstallEnv({ ua: UA.samsung })).toBe('web');
  });

  it('설치 앱 또는 이미 홈 화면 앱으로 실행 중이면 안내 없음', () => {
    expect(detectInstallEnv({ ua: UA.kakaoAndroid, native: true })).toBe('installed');
    expect(detectInstallEnv({ ua: UA.iosSafari, standalone: true })).toBe('installed');
  });

  it('카카오톡 → 기본 브라우저로 열기 주소 (주소 인코딩)', () => {
    expect(kakaoExternalUrl('https://nurse-shift-calendar.vercel.app/?invite=AB12#x')).toBe(
      'kakaotalk://web/openExternal?url=https%3A%2F%2Fnurse-shift-calendar.vercel.app%2F%3Finvite%3DAB12%23x'
    );
  });
});
