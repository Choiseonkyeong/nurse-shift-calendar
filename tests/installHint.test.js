import { describe, it, expect } from 'vitest';
import { detectInstallEnv, kakaoExternalUrl, chromeIntentUrl, externalOpenUrl, inAppName, isInAppEnv } from '../src/lib/installHint';

const UA = {
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 KAKAOTALK 10.8.3',
  kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.3',
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36',
  bandAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 BAND/16.1.0',
  naverIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.6.1)',
  instaIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.22.109',
  otherWebView: 'Mozilla/5.0 (Linux; Android 13; SM-A536N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
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

  it('밴드·네이버 앱·인스타그램 등 앱 안 브라우저도 구분 (홈 화면에 추가 불가)', () => {
    expect(detectInstallEnv({ ua: UA.bandAndroid })).toBe('inapp-android');
    expect(detectInstallEnv({ ua: UA.otherWebView })).toBe('inapp-android');
    expect(detectInstallEnv({ ua: UA.naverIos })).toBe('inapp-ios');
    expect(detectInstallEnv({ ua: UA.instaIos })).toBe('inapp-ios');
    expect(detectInstallEnv({ ua: UA.chromeAndroid })).toBe('web');
    expect([UA.bandAndroid, UA.naverIos, UA.instaIos, UA.kakaoIos, UA.otherWebView, UA.iosSafari].map(inAppName)).toEqual(['밴드', '네이버 앱', '인스타그램', '카카오톡', '이 앱', '']);
    expect(['kakao-ios', 'inapp-android', 'inapp-ios', 'ios', 'web', 'installed'].map(isInAppEnv)).toEqual([true, true, true, false, false, false]);
  });

  it('안드로이드 앱 안 브라우저 → 크롬으로 열기(intent), 아이폰 앱 안 브라우저 → 바로 여는 방법 없음(주소 복사)', () => {
    const href = 'https://nurse-shift-calendar.vercel.app/?join=AB12';
    expect(chromeIntentUrl(href)).toBe(
      'intent://nurse-shift-calendar.vercel.app/?join=AB12#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fnurse-shift-calendar.vercel.app%2F%3Fjoin%3DAB12;end'
    );
    expect(externalOpenUrl('inapp-android', href)).toBe(chromeIntentUrl(href));
    expect(externalOpenUrl('kakao-ios', href)).toBe(kakaoExternalUrl(href));
    expect(externalOpenUrl('inapp-ios', href)).toBeNull();
  });

  it('카카오톡 → 기본 브라우저로 열기 주소 (주소 인코딩)', () => {
    expect(kakaoExternalUrl('https://nurse-shift-calendar.vercel.app/?invite=AB12#x')).toBe(
      'kakaotalk://web/openExternal?url=https%3A%2F%2Fnurse-shift-calendar.vercel.app%2F%3Finvite%3DAB12%23x'
    );
  });
});
