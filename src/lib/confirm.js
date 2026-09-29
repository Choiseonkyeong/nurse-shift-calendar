// src/lib/confirm.js
// 앱 디자인의 확인 창 (브라우저 기본 confirm 대신 — 창 위에 사이트 주소가 뜨지 않음)
// 사용: if (!(await confirmDialog({ title, message, confirmText, danger }))) return;
let host = null;

/** ConfirmHost 가 화면에 붙을 때 등록 */
export function setConfirmHost(fn) {
  host = fn;
  return () => {
    if (host === fn) host = null;
  };
}

/**
 * @param title        굵은 제목 (예: '그룹에서 나갈까요?')
 * @param message      설명 (줄바꿈 가능)
 * @param confirmText  확인 버튼 글자 (기본 '확인')
 * @param cancelText   취소 버튼 글자 (기본 '취소')
 * @param danger       되돌릴 수 없는 작업이면 빨간 버튼
 * @returns Promise<boolean> 확인 누르면 true
 */
export function confirmDialog({ title = '', message = '', confirmText = '확인', cancelText = '취소', danger = false } = {}) {
  // 화면이 아직 없으면(테스트 등) 브라우저 기본 창으로
  if (!host) return Promise.resolve(window.confirm([title, message].filter(Boolean).join('\n\n')));
  return new Promise((resolve) => host({ title, message, confirmText, cancelText, danger, resolve }));
}
