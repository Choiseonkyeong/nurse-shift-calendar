// src/lib/ads.js
// 하단 배너 광고 (설치한 앱에서만, Google AdMob)
// 켜고 끄기·광고 단위 ID 는 웹의 /app-config.json 에서 받아옴 → 앱을 다시 심사받지 않고도 켜고 끌 수 있음
// 기본은 꺼짐 (enabled: false)
import { Capacitor } from '@capacitor/core';

const CONFIG_URL = 'https://nurse-shift-calendar.vercel.app/app-config.json';
const BANNER_ID = /^ca-app-pub-\d+\/\d+$/;

/** 이 기기에서 보여 줄 배너 광고 단위 ID (꺼져 있거나 형식이 틀리면 null) */
export function pickBannerId(config, platform) {
  const ads = config?.ads;
  if (!ads?.enabled) return null;
  const id = platform === 'android' ? ads.androidBannerId : platform === 'ios' ? ads.iosBannerId : '';
  return BANNER_ID.test(id || '') ? id : null;
}

let admob = null; // 배너를 띄운 뒤에만 채워짐
let hiddenBy = 0; // 배너를 가리는 아래 창 개수

const setAdHeight = (px) => document.documentElement.style.setProperty('--ad-h', `${Math.round(px) || 0}px`);

/**
 * 앱 시작 시 한 번: 설정에서 켜져 있으면 탭바 바로 위에 배너 표시
 * @param bottomOffset 탭바 높이(px) — 배너를 그만큼 위로 띄움
 */
export async function startAds(bottomOffset = 0) {
  if (!Capacitor.isNativePlatform()) return; // 웹은 광고 없음
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(CONFIG_URL, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    const adId = pickBannerId(await res.json(), Capacitor.getPlatform());
    if (!adId) return;

    const { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents } = await import('@capacitor-community/admob');
    await AdMob.initialize();
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => setAdHeight(size?.height));
    await AdMob.showBanner({
      adId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: Math.round(bottomOffset),
      npa: true // 맞춤형 광고 안 씀 (광고 ID 기반 추적 없음)
    });
    admob = AdMob;
    if (hiddenBy > 0) AdMob.hideBanner().catch(() => {});
  } catch (err) {
    // 광고는 부가 기능: 실패해도 앱 사용에는 영향 없음
    console.warn('광고 표시 안 함:', err?.message || err);
  }
}

/** 아래 창이 열려 있는 동안 배너 숨김 (배너가 창의 버튼을 가리지 않게) */
export function hideAdsWhileOpen() {
  hiddenBy += 1;
  if (hiddenBy === 1 && admob) admob.hideBanner().catch(() => {});
  return () => {
    hiddenBy = Math.max(0, hiddenBy - 1);
    if (hiddenBy === 0 && admob) admob.resumeBanner().catch(() => {});
  };
}
