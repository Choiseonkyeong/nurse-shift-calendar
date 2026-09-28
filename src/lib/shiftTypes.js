// src/lib/shiftTypes.js
// 근무 종류(코드·이름·색상·분류) 단일 출처. 기본 근무 + 사용자 정의 근무를 합쳐 앱 전체에서 사용
import { createContext, useContext } from 'react';

// kind: work(근무) | off(휴무) | leave(휴가, leaveDays 만큼 연차 차감)
export const DEFAULT_SHIFT_TYPES = [
  { code: 'D', label: 'Day (데이)', kind: 'work', bg: '#FEF08A', fg: '#854D0E' },
  { code: 'E', label: 'Evening (이브닝)', kind: 'work', bg: '#FFEDD5', fg: '#9A3412' },
  { code: 'N', label: 'Night (나이트)', kind: 'work', bg: '#E0F2FE', fg: '#0369A1' },
  { code: 'M', label: 'Mid (미드)', kind: 'work', bg: '#F3E8FF', fg: '#6B21A8' },
  { code: 'OFF', label: 'OFF (휴무)', kind: 'off', bg: '#F1F5F9', fg: '#475569' },
  { code: '연차', label: '연차 (휴가)', kind: 'leave', bg: '#FFE4E6', fg: '#E11D48', leaveDays: 1 }
];

export const DEFAULT_CODES = new Set(DEFAULT_SHIFT_TYPES.map((t) => t.code));
const FALLBACK = { bg: '#F1F5F9', fg: '#475569' };

/** 기본 근무 + 사용자 정의 근무 (같은 코드는 사용자 설정이 우선, 기본 근무는 삭제 불가) */
export function mergeShiftTypes(custom = []) {
  const byCode = new Map(DEFAULT_SHIFT_TYPES.map((t) => [t.code, t]));
  (custom || []).forEach((t) => {
    if (!t?.code) return;
    byCode.set(t.code, { ...(byCode.get(t.code) || {}), ...t });
  });
  return [...byCode.values()];
}

export function findShiftType(types, code) {
  return (types || []).find((t) => t.code === code);
}

/** 근무 칩 인라인 스타일 */
export function badgeStyle(types, code) {
  const t = findShiftType(types, code) || FALLBACK;
  return { backgroundColor: t.bg, color: t.fg };
}

export const ShiftTypesContext = createContext(DEFAULT_SHIFT_TYPES);
export const useShiftTypes = () => useContext(ShiftTypesContext);
