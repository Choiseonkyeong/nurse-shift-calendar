// src/lib/shiftAlarm.js
// 근무 알람: 알람시계처럼 울림 (무음·진동 모드에서도 알람 볼륨으로, 끄기 / 5분 뒤 다시)
//  - 안드로이드: 앱 안의 알람 기능 (ShiftAlarmPlugin.java)
//  - 아이폰: iOS 26 이상 AlarmKit (ShiftAlarmPlugin.swift) — 그보다 낮으면 supported: false → 일반 알림으로 대신
import { Capacitor, registerPlugin } from '@capacitor/core';

const ShiftAlarm = registerPlugin('ShiftAlarm');

const native = () => Capacitor.isNativePlatform();

/** { supported, exact, fullScreen, authorized } — 웹은 supported: false */
export async function alarmStatus() {
  if (!native()) return { supported: false };
  try {
    return await ShiftAlarm.status();
  } catch (err) {
    return { supported: false }; // 이전 버전 앱(플러그인 없음)
  }
}

/** buildReminders 목록 → 알람 예약 (이전 알람은 모두 지움). 반환: { supported, count, authorized, exact } */
export async function scheduleAlarms(reminders) {
  if (!native()) return { supported: false, count: 0 };
  const alarms = reminders.map((r) => ({ id: r.id, at: r.at.getTime(), title: r.title, body: r.body }));
  try {
    return await ShiftAlarm.schedule({ alarms });
  } catch (err) {
    if (/not implemented/i.test(err?.message || '')) return { supported: false, count: 0 };
    throw err;
  }
}

export async function cancelAlarms() {
  if (!native()) return;
  await ShiftAlarm.cancelAll().catch(() => {});
}

/** 정확한 시각 알람·잠금 화면 알람 허용 화면 (안드로이드) / 앱 설정 (아이폰) */
export async function openAlarmSettings() {
  if (native()) await ShiftAlarm.openSettings().catch(() => {});
}
