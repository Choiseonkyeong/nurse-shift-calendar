// src/lib/localReminders.js
// 앱(Android/iOS) 근무 시작 알림: 폰 안에서 미리 예약 (서버·Firebase 설정 없이, 앱을 꺼 둬도 도착)
//  - 앞으로 REMINDER_DAYS 일의 근무를 예약하고, 근무·근무 시간·알림 설정이 바뀌면 다시 예약
//  - iOS 는 예약 가능한 알림이 64개까지라 최대 MAX_REMINDERS 개만
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const REMINDER_DAYS = 30;
export const MAX_REMINDERS = 60;
const CHANNEL_ID = 'shift-reminders';
const KIND = 'shift-start';

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const isNativeApp = () => Capacitor.isNativePlatform();

/** 30 → '30분', 120 → '2시간', 90 → '1시간 30분' (서버 푸시 문구와 같게) */
export function formatLead(minutes) {
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  return `${minutes}분`;
}

/**
 * 예약할 알림 목록 (순수 함수: 테스트용)
 * @param myShifts     { 'YYYY-MM-DD': 코드 }
 * @param startTimes   { 코드: 'HH:MM' } 근무 시작 시각
 * @param shiftTypes   [{ code, label, kind }] — 근무(work)만 알림
 * @returns [{ id, at: Date, title, body, dateKey, code }]
 */
export function buildReminders({ myShifts = {}, startTimes = {}, shiftTypes = [], minutesBefore = 60, userName = '', now = new Date(), days = REMINDER_DAYS }) {
  const types = new Map(shiftTypes.map((t) => [t.code, t]));
  const out = [];
  for (let i = 0; i <= days && out.length < MAX_REMINDERS; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dateKey = keyOf(day);
    const code = myShifts[dateKey];
    const type = code && types.get(code);
    const match = /^(\d{1,2}):(\d{2})$/.exec(startTimes[code] || '');
    if (!type || type.kind !== 'work' || !match) continue;
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(match[1]), Number(match[2]));
    const at = new Date(start.getTime() - minutesBefore * 60000);
    if (at <= now) continue;
    const hhmm = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    out.push({
      id: Number(dateKey.replace(/-/g, '')), // 날짜마다 하나 (예: 20261005)
      at,
      title: `⏰ ${formatLead(minutesBefore)} 뒤 ${code} 근무 시작`,
      body: `${userName ? `${userName} 님, ` : ''}${hhmm}에 ${type.label || code} 근무가 시작됩니다. 준비해 주세요!`,
      dateKey,
      code
    });
  }
  return out;
}

/** 알림 권한 요청 (알림을 켤 때). 허용되면 true */
export async function enableLocalReminders() {
  if (!isNativeApp()) return false;
  let { display } = await LocalNotifications.checkPermissions();
  if (display !== 'granted') ({ display } = await LocalNotifications.requestPermissions());
  if (display !== 'granted') return false;
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: '근무 시작 알림',
      description: '근무 시작 전 미리 알려 드립니다.',
      importance: 5,
      visibility: 1,
      vibration: true
    });
  }
  return true;
}

/**
 * 예약된 근무 알림을 지금 설정에 맞게 다시 예약 (끄면 모두 취소)
 * @param askExact 알림을 켤 때만 true: 안드로이드 '정확한 알람' 허용 화면을 한 번 보여줌 (평소 재예약 때는 묻지 않음)
 */
export async function syncLocalReminders({ enabled, askExact = false, ...opts }) {
  if (!isNativeApp()) return 0;
  const { notifications = [] } = await LocalNotifications.getPending();
  const mine = notifications.filter((n) => n.extra?.kind === KIND);
  if (mine.length) await LocalNotifications.cancel({ notifications: mine.map((n) => ({ id: n.id })) });
  if (!enabled) return 0;

  const { display } = await LocalNotifications.checkPermissions();
  if (display !== 'granted') return 0;
  let exact = askExact;
  if (!askExact && Capacitor.getPlatform() === 'android') {
    exact = (await LocalNotifications.checkExactNotificationSetting().catch(() => ({ exact_alarm: 'denied' }))).exact_alarm === 'granted';
  }
  const list = buildReminders(opts);
  if (!list.length) return 0;
  await LocalNotifications.schedule({
    notifications: list.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      channelId: CHANNEL_ID,
      schedule: { at: r.at, allowWhileIdle: true },
      isExactNotification: exact, // 허용 안 했으면 몇 분 오차가 있을 수 있는 일반 알람으로
      extra: { kind: KIND, dateKey: r.dateKey, code: r.code }
    }))
  });
  return list.length;
}
