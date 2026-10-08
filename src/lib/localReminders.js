// src/lib/localReminders.js
// 앱(Android/iOS) 근무 시작 알림: 폰 안에서 미리 예약 (서버·Firebase 설정 없이, 앱을 꺼 둬도 도착)
//  - 앞으로 REMINDER_DAYS 일의 근무를 예약하고, 근무·근무 시간·알림 설정이 바뀌면 다시 예약
//  - iOS 는 예약 가능한 알림이 64개까지라 최대 MAX_REMINDERS 개만
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { scheduleAlarms, cancelAlarms } from './shiftAlarm';

export const REMINDER_DAYS = 90; // 앱을 오래 안 열어도 알림이 이어지도록 (개수는 MAX_REMINDERS 까지)
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

/**
 * 이 기기의 알림 권한 상태 (알림 설정은 계정을 따라 다른 기기로 동기화되므로, 켜져 있어도 이 기기엔 권한이 없을 수 있음)
 * @returns 'granted' | 'missing' | 'unsupported'
 */
export async function getAlarmPermission() {
  if (isNativeApp()) {
    const { display } = await LocalNotifications.checkPermissions().catch(() => ({ display: 'denied' }));
    return display === 'granted' ? 'granted' : 'missing';
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return (await webNotificationState()) === 'granted' ? 'granted' : 'missing';
}

/** 웹 알림 권한: 권한 API(설정 변경이 바로 반영됨) → 없으면 Notification.permission */
export async function webNotificationState() {
  try {
    const status = await window.navigator?.permissions?.query({ name: 'notifications' });
    if (status?.state) return status.state; // 'granted' | 'denied' | 'prompt'
  } catch (e) {
    /* 권한 API 가 없는 브라우저 */
  }
  return window.Notification.permission;
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

/**
 * 근무 알람(모닝콜) 설정: { enabled, byShift: { 근무코드: ['HH:MM', ...] } }
 * 예전 형식(근무 시작 N분 전 / '알람처럼 울리기' 스위치)은 근무 시작 시각에서 빼서 근무별 시각으로 바꿔 줌
 */
export function wakeAlarmOf(alarmSettings = {}, startTimes = {}) {
  const a = alarmSettings.alarm;
  if (a?.byShift) return { enabled: Boolean(a.enabled), byShift: a.byShift };
  const legacy = a ? { enabled: a.enabled, minutes: a.minutesBefore } : alarmSettings.ring ? { enabled: alarmSettings.enabled, minutes: alarmSettings.minutesBefore } : null;
  if (!legacy) return { enabled: false, byShift: {} };
  const byShift = {};
  Object.entries(startTimes).forEach(([code, hhmm]) => {
    const t = shiftTime(hhmm, -(legacy.minutes || 120));
    if (t) byShift[code] = [t];
  });
  return { enabled: Boolean(legacy.enabled), byShift };
}

/** 'HH:MM' 에 분을 더한 시각 (하루를 넘으면 그날 안에서 돌림). 형식이 틀리면 null */
export function shiftTime(hhmm, deltaMin = 0) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const total = (((Number(m[1]) * 60 + Number(m[2]) + deltaMin) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/**
 * 근무별 모닝콜 알람 목록 (순수 함수: 테스트용)
 * 그날 근무가 byShift 에 시각이 있는 근무면 그 시각마다 알람 (쉬는 날도 시각을 넣으면 울림)
 * @returns [{ id, at, title, body, dateKey, code }] 시간순, 최대 MAX_REMINDERS 개
 */
export function buildWakeAlarms({ myShifts = {}, byShift = {}, startTimes = {}, shiftTypes = [], now = new Date(), days = REMINDER_DAYS }) {
  const types = new Map(shiftTypes.map((t) => [t.code, t]));
  const out = [];
  for (let i = 0; i <= days && out.length < MAX_REMINDERS; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dateKey = keyOf(day);
    const code = myShifts[dateKey];
    const times = (code && byShift[code]) || [];
    [...new Set(times)].sort().forEach((hhmm, idx) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
      if (!m || out.length >= MAX_REMINDERS) return;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(m[1]), Number(m[2]));
      if (at <= now) return;
      const label = types.get(code)?.label || code;
      const start = startTimes[code];
      out.push({
        id: Number(dateKey.replace(/-/g, '')) * 10 + idx, // 날짜·순서마다 하나 (예: 202610050)
        at,
        title: `⏰ ${code} 근무 날 알람`,
        body: start ? `오늘 ${label} · ${start} 근무 시작` : `오늘 ${label}`,
        dateKey,
        code
      });
    });
  }
  return out;
}

/**
 * 근무 알람(모닝콜, 알람시계처럼 울림)을 지금 설정에 맞게 다시 예약 — 알림과는 따로
 * @returns { supported, count, authorized } (웹·미지원 폰은 supported: false)
 */
export async function syncShiftAlarms({ enabled, ...opts }) {
  if (!isNativeApp()) return { supported: false, count: 0 };
  if (!enabled) {
    await cancelAlarms();
    return { supported: true, count: 0 };
  }
  return scheduleAlarms(buildWakeAlarms(opts));
}
