// src/lib/widgetSync.js
// Android·iOS 홈 화면 위젯에 앞으로 WIDGET_DAYS 일 근무를 전달 (웹에서는 아무것도 하지 않음)
import { Capacitor, registerPlugin } from '@capacitor/core';
import { findShiftType } from './shiftTypes';
import { noteTexts } from './dayItems';

const ShiftWidget = registerPlugin('ShiftWidget');
const pad = (n) => String(n).padStart(2, '0');
// 위젯은 자정마다 스스로 바뀌므로, 앱을 한동안 안 열어도 '근무 미입력'이 뜨지 않게 넉넉히
export const WIDGET_DAYS = 62;

/**
 * 위젯용 데이터: { days: { 'YYYY-MM-DD': { code, label, bg, fg, time, notes } } }
 * notes = 그날 일정 '교육, 회식' (근무가 없는 날도 일정이 있으면 넣음, code 는 '')
 */
export function buildWidgetData(myShifts = {}, shiftTypes = [], today = new Date(), dayNotes = {}) {
  const days = {};
  for (let i = -1; i < WIDGET_DAYS; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const code = myShifts[key] || '';
    let notes = noteTexts(dayNotes[key]).join(', ');
    if (notes.length > 60) notes = `${notes.slice(0, 58)}…`;
    if (!code && !notes) continue;
    const t = code ? findShiftType(shiftTypes, code) || {} : {};
    days[key] = {
      code,
      label: t.label || code,
      bg: t.bg || '#F1F5F9',
      fg: t.fg || '#475569',
      time: t.start && t.end ? `${t.start}-${t.end}` : '',
      ...(notes ? { notes } : {})
    };
  }
  return { days, updatedAt: new Date().toISOString() };
}

let lastPayload = '';

export async function syncWidget(myShifts, shiftTypes, dayNotes = {}) {
  if (!['android', 'ios'].includes(Capacitor.getPlatform())) return;
  const payload = JSON.stringify(buildWidgetData(myShifts, shiftTypes, new Date(), dayNotes));
  // updatedAt 을 제외한 내용이 같으면 생략
  const body = payload.replace(/"updatedAt":"[^"]*"/, '');
  if (body === lastPayload) return;
  lastPayload = body;
  try {
    await ShiftWidget.update({ data: payload });
  } catch (err) {
    console.warn('위젯 갱신 실패', err);
  }
}
