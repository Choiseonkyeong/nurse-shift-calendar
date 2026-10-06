// src/lib/swipe.js
// 손가락 동작: 달력 좌우로 밀어 달 넘기기, 아래 창 끌어내려 닫기
import { useRef } from 'react';

export const SWIPE_MIN = 50; // 이만큼(px) 이상 밀어야 넘김

/** 가로로 충분히, 세로보다 확실히 많이 밀었을 때만 'left' | 'right' (스크롤과 구분) */
export function swipeDirection(dx, dy) {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'left' : 'right';
}

/**
 * 달력 등에 붙이는 터치 핸들러: 왼쪽으로 밀면 onLeft(다음 달), 오른쪽으로 밀면 onRight(이전 달)
 * 두 손가락(확대) 동작은 무시
 */
export function useSwipe({ onLeft, onRight }) {
  const start = useRef(null);
  const swipedAt = useRef(0);
  return {
    onTouchStart: (e) => {
      start.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    },
    onTouchEnd: (e) => {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dir = swipeDirection(t.clientX - s.x, t.clientY - s.y);
      if (dir) swipedAt.current = Date.now();
      if (dir === 'left') onLeft?.();
      if (dir === 'right') onRight?.();
    },
    // 민 뒤 손을 뗀 자리의 날짜가 눌린 것으로 처리되면 넘긴 달이 다시 돌아오므로, 직후 클릭은 무시
    onClickCapture: (e) => {
      if (Date.now() - swipedAt.current < 500) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    onTouchCancel: () => {
      start.current = null;
    }
  };
}

/** 아래 창을 끌어내린 거리·속도로 닫을지 결정 (120px 이상, 또는 빠르게 튕기듯 60px 이상) */
export function shouldDismissSheet(dy, ms) {
  if (dy >= 120) return true;
  return dy >= 60 && dy / Math.max(ms, 1) > 0.5;
}
