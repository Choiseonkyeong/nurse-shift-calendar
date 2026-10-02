// src/lib/toast.js
// 앱 안 짧은 안내 (브라우저 기본 alert 대신: 화면을 막지 않고 몇 초 뒤 사라짐)
const listeners = new Set();
let seq = 0;

/**
 * @param message 안내 문구 (줄바꿈 가능)
 * @param type 'info' | 'success' | 'error'
 * @param opts { action: { label, onClick } } 안내 옆 버튼 (예: 되돌리기). 버튼이 있으면 조금 더 오래 보임
 */
export function toast(message, type = 'info', { action } = {}) {
  const item = { id: ++seq, message: String(message), type, action };
  listeners.forEach((fn) => fn(item));
}

export function subscribeToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** '2026-09-30' → '9월 30일 (수)' */
export function formatDateKo(key) {
  const [y, m, d] = String(key || '').split('-').map(Number);
  if (!y || !m || !d) return key || '';
  const w = '일월화수목금토'[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${w})`;
}
