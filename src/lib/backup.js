// src/lib/backup.js
import { queueTypeOp } from './typeSync';

// 전체 백업/복원 파일(.json): 근무·메모·근무 종류·수당/연차 설정·알림 설정·이름
// (서버에 없는 설정까지 포함 → 폰을 바꿀 때 그대로 옮길 수 있음)

export const BACKUP_KEYS = [
  'shift_user_name',
  'my_shift_data',
  'day_notes',
  'custom_shift_types',
  'shift_configs',
  'shift_alarm_settings',
  'roster_name' // 근무표(사진·엑셀) 속 내 이름
];
const TEXT_KEYS = new Set(['shift_user_name', 'roster_name']); // JSON 이 아닌 문자열로 저장하는 값
const APP_ID = 'nurse-shift-calendar';

export function createBackup(storage = localStorage, now = new Date()) {
  const data = {};
  BACKUP_KEYS.forEach((k) => {
    const raw = storage.getItem(k);
    if (raw == null) return;
    try {
      data[k] = TEXT_KEYS.has(k) ? raw : JSON.parse(raw);
    } catch (e) {
      /* 손상된 값은 제외 */
    }
  });
  return { app: APP_ID, version: 1, exportedAt: now.toISOString(), data };
}

const isDateMap = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));

/** 백업 파일 검증 → { data, summary } (형식이 틀리면 오류) */
export function parseBackup(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error('백업 파일을 읽을 수 없습니다. (.json 형식이 아님)');
  }
  if (json?.app !== APP_ID || typeof json.data !== 'object') throw new Error('이 앱의 백업 파일이 아닙니다.');
  const d = json.data;
  if (d.my_shift_data && !isDateMap(d.my_shift_data)) throw new Error('백업 파일의 근무 데이터가 손상되었습니다.');
  if (d.day_notes && !isDateMap(d.day_notes)) throw new Error('백업 파일의 메모 데이터가 손상되었습니다.');
  if (d.custom_shift_types && !Array.isArray(d.custom_shift_types)) throw new Error('백업 파일의 근무 종류가 손상되었습니다.');
  return {
    data: d,
    summary: {
      exportedAt: json.exportedAt,
      shifts: Object.values(d.my_shift_data || {}).filter(Boolean).length,
      notes: Object.values(d.day_notes || {}).filter(Boolean).length,
      types: (d.custom_shift_types || []).length,
      name: d.shift_user_name || ''
    }
  };
}

/**
 * 복원: 기기 값을 백업으로 교체. 동기화 기준점을 지워 다음 서버 연결 때 백업 내용이 서버에 반영되게 함
 */
export function restoreBackup(data, storage = localStorage) {
  BACKUP_KEYS.forEach((k) => {
    if (data[k] === undefined) return;
    storage.setItem(k, TEXT_KEYS.has(k) ? String(data[k]) : JSON.stringify(data[k]));
  });
  storage.removeItem('synced_shift_data');
  storage.removeItem('synced_day_notes');
  storage.setItem('name_confirmed', '1');
  // 백업의 근무 종류를 다음 서버 연결 때 먼저 올리도록 전송 대기열에 넣음 (lib/typeSync)
  (Array.isArray(data.custom_shift_types) ? data.custom_shift_types : []).forEach((t) => {
    if (t?.code) queueTypeOp({ type: 'upsert', value: t }, storage);
  });
}
