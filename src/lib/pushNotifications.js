// src/lib/pushNotifications.js
// 네이티브 앱(Android/iOS) 백그라운드 푸시: FCM 토큰 등록 + 서버 알림 설정 동기화
// 실제 발송은 서버(pg_cron → Edge Function send-shift-reminders)가 담당하므로 앱이 종료돼 있어도 도착한다.
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { getSupabase } from '../supabaseClient';

const TOKEN_KEY = 'push_fcm_token';
const CHANNEL_ID = 'shift-reminders';

export const isNativePush = () => Capacitor.isNativePlatform();

// 웹 푸시(브라우저를 닫아도 알림): Vercel 환경 변수에 Firebase 웹 설정이 있을 때만 사용
//   VITE_FIREBASE_WEB_CONFIG = Firebase 콘솔 > 프로젝트 설정 > 웹 앱의 firebaseConfig (JSON)
//   VITE_FIREBASE_VAPID_KEY  = 클라우드 메시징 > 웹 푸시 인증서의 키 쌍
// (둘 다 공개 값. 없으면 웹은 '화면이 열려 있을 때만' 알림)
const WEB_CONFIG = (() => {
  try {
    return JSON.parse(import.meta.env.VITE_FIREBASE_WEB_CONFIG || 'null');
  } catch (e) {
    return null;
  }
})();
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export const isWebPushAvailable = () =>
  !isNativePush() &&
  Boolean(WEB_CONFIG?.projectId && VAPID_KEY) &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** 서버가 보내는 알림(앱: FCM, 웹: 웹 푸시)을 쓰는지 */
export const usesServerPush = () => isNativePush() || isWebPushAvailable();

/** 웹: Firebase 초기화 + 알림용 서비스 워커 등록 */
async function prepareWebPush() {
  const { initializeApp, getApps } = await import('firebase/app');
  if (!getApps().length) initializeApp(WEB_CONFIG);
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return registration;
}

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const getTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';

/** shiftConfigs.shiftTimes { D: { time: '07:30 - 15:30' } } → { D: '07:30' } */
export function toStartTimes(shiftTimes = {}) {
  const result = {};
  Object.entries(shiftTimes || {}).forEach(([code, cfg]) => {
    const start = String(cfg?.time || '').split('-')[0].trim();
    if (/^\d{1,2}:\d{2}$/.test(start)) result[code] = start.padStart(5, '0');
  });
  return result;
}

async function registerToken(token) {
  const supabase = await getSupabase();
  if (!token) return;
  unwrap(await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: Capacitor.getPlatform()
  }));
  localStorage.setItem(TOKEN_KEY, token);
}

let listenerAdded = false;

/** 권한 요청 → 채널 생성 → FCM 토큰 발급/등록. 성공 시 true */
export async function registerDevice({ prompt = true } = {}) {
  if (!usesServerPush()) return false;
  // 웹은 Firebase 앱을 먼저 초기화해야 메시징 플러그인을 쓸 수 있음
  const webRegistration = isNativePush() ? null : await prepareWebPush();

  let { receive } = await FirebaseMessaging.checkPermissions();
  if (receive !== 'granted' && prompt) {
    ({ receive } = await FirebaseMessaging.requestPermissions());
  }
  if (receive !== 'granted') return false;

  if (Capacitor.getPlatform() === 'android') {
    await FirebaseMessaging.createChannel({
      id: CHANNEL_ID,
      name: '근무 시작 알림',
      description: '근무 시작 전 미리 알려 드립니다.',
      importance: 5,
      visibility: 1,
      vibration: true
    });
  }

  if (!listenerAdded && isNativePush()) {
    listenerAdded = true;
    // 토큰 갱신(재설치/만료) 시 서버에 재등록
    await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
      registerToken(token).catch((err) => console.error('푸시 토큰 갱신 실패:', err.message));
    });
  }

  const { token } = await FirebaseMessaging.getToken(
    webRegistration ? { vapidKey: VAPID_KEY, serviceWorkerRegistration: webRegistration } : undefined
  );
  await registerToken(token);
  return true;
}

/** 서버 알림 설정 저장 (근무 시작 시각 포함) */
export async function saveReminderSettings({ enabled, minutesBefore, shiftTimes }) {
  const supabase = await getSupabase();
  return unwrap(await supabase.rpc('set_notification_settings', {
    p_enabled: enabled,
    p_minutes: minutesBefore,
    p_timezone: getTimezone(),
    p_start_times: shiftTimes ? toStartTimes(shiftTimes) : null
  }));
}

/** 알림 켜기: 기기 등록 + 서버 설정. 권한 거부 시 false */
export async function enablePushReminders({ minutesBefore, shiftTimes }) {
  const granted = await registerDevice({ prompt: true });
  if (!granted) return false;
  await saveReminderSettings({ enabled: true, minutesBefore, shiftTimes });
  return true;
}

export async function disablePushReminders({ minutesBefore }) {
  await saveReminderSettings({ enabled: false, minutesBefore, shiftTimes: null });
}

/** 로그아웃/초기화 전: 이 기기 토큰을 서버에서 제거 (실패해도 진행) */
export async function unregisterDevice() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!usesServerPush() || !token) return;
  try {
    const supabase = await getSupabase();
    unwrap(await supabase.rpc('unregister_device_token', { p_token: token }));
    await FirebaseMessaging.deleteToken();
  } catch (err) {
    console.error('푸시 토큰 해제 실패:', err.message);
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}
