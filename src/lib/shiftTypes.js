// src/lib/shiftTypes.js
// 근무 종류(코드·이름·색상·분류) 단일 출처. 기본 근무 + 사용자 정의 근무를 합쳐 앱 전체에서 사용
import { createContext, useContext } from 'react';

// kind: work(근무) | off(휴무) | leave(휴가, leaveDays 만큼 연차 차감)
export const DEFAULT_SHIFT_TYPES = [
  { code: 'D', label: 'Day (데이)', kind: 'work', bg: '#FFEDD5', fg: '#C2410C' },
  { code: 'E', label: 'Evening (이브닝)', kind: 'work', bg: '#FCE7F3', fg: '#BE185D' },
  { code: 'N', label: 'Night (나이트)', kind: 'work', bg: '#E0F2FE', fg: '#0369A1' },
  { code: 'M', label: 'Mid (미드)', kind: 'work', bg: '#F3E8FF', fg: '#7E22CE' },
  { code: 'OFF', label: 'OFF (휴무)', kind: 'off', bg: '#F1F5F9', fg: '#64748B' },
  { code: '연차', label: '연차 (휴가)', kind: 'leave', bg: '#D1FAE5', fg: '#047857', leaveDays: 1 }
];

// 예전 기본 색 (D·E 가 둘 다 갈색이라 구분이 어려웠음). 서버 프리셋·저장된 설정에 이 색이 그대로 있으면 새 기본 색으로 보여 줌
const LEGACY_COLORS = new Set(
  ['#FEF08A/#854D0E', '#FFEDD5/#9A3412', '#F3E8FF/#6B21A8', '#F1F5F9/#475569', '#FFE4E6/#E11D48'].map((c) => c.toUpperCase())
);
const isLegacyColor = (t) => LEGACY_COLORS.has(`${t.bg}/${t.fg}`.toUpperCase());

export const DEFAULT_CODES = new Set(DEFAULT_SHIFT_TYPES.map((t) => t.code));
const FALLBACK = { bg: '#F1F5F9', fg: '#475569' };

/** 기본 근무 + 사용자 정의 근무 (같은 코드는 사용자 설정이 우선, 기본 근무는 삭제 불가) */
export function mergeShiftTypes(custom = []) {
  const byCode = new Map(DEFAULT_SHIFT_TYPES.map((t) => [t.code, t]));
  (custom || []).forEach((t) => {
    if (!t?.code) return;
    const base = byCode.get(t.code) || {};
    // 직접 고른 색은 그대로, 예전 기본 색이면 새 기본 색 (기본 근무가 아니면 이 근무의 기본 색으로)
    const { bg, fg, ...rest } = t;
    const keepColor = !isLegacyColor(t) || !base.bg;
    byCode.set(t.code, { ...base, ...rest, ...(keepColor ? { bg, fg } : {}) });
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

/** 근무 색 글자: 밝은 화면은 글자색(fg), 다크 모드는 fg 를 밝게 섞은 색 (.shift-text 와 함께) */
export const shiftTextVars = (t) => ({ '--fg': t?.fg || FALLBACK.fg, '--bg': t?.bg || FALLBACK.bg });

export const ShiftTypesContext = createContext(DEFAULT_SHIFT_TYPES);
export const useShiftTypes = () => useContext(ShiftTypesContext);
