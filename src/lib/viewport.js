// src/lib/viewport.js
// 폰 화면 보정: 키보드 높이(--kb), 아이폰 입력칸 자동 확대 막기

/** 키보드가 가린 높이(px): 레이아웃 높이 - 실제 보이는 높이 */
export function keyboardInset(innerHeight, vv) {
  if (!vv) return 0;
  const hidden = Math.round(innerHeight - vv.height - vv.offsetTop);
  return hidden > 80 ? hidden : 0; // 주소창 접힘 같은 작은 변화는 무시
}

/**
 * 키보드가 올라오면 <html> 에 --kb 를 설정 (아래에서 올라오는 창을 그만큼 위로 올림)
 * 안드로이드 크롬·아이폰은 키보드가 떠도 화면 크기를 줄이지 않아, 바닥에 붙은 창이 키보드 뒤로 숨음
 * @returns 해제 함수
 */
export function installKeyboardInset(win = window) {
  const vv = win.visualViewport;
  if (!vv) return () => {};
  const root = win.document.documentElement;
  const update = () => root.style.setProperty('--kb', `${keyboardInset(win.innerHeight, vv)}px`);
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
  };
}

export const isIos = (nav) => /iPad|iPhone|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);

/**
 * 아이폰: 글자가 16px 보다 작은 입력칸을 누르면 화면이 확대된 채 남음 → 입력 시 자동 확대만 막음
 * (아이폰은 maximum-scale 이 있어도 두 손가락 확대는 계속 허용)
 */
export function preventIosInputZoom(doc = document, nav = navigator) {
  if (!isIos(nav)) return false;
  const meta = doc.querySelector('meta[name=viewport]');
  if (!meta || /maximum-scale/.test(meta.content)) return false;
  meta.content = `${meta.content}, maximum-scale=1`;
  return true;
}
