import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { shouldDismissSheet } from '../lib/swipe';

// 열린 팝업 순서 (안드로이드 뒤로가기: 맨 위 팝업부터 닫기)
const openModals = [];
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

/** 열린 팝업 수 */
export const openModalCount = () => openModals.length;

/** 팝업이 열리고 닫힐 때마다 호출 (웹 뒤로가기 처리용). 해제 함수 반환 */
export function onModalsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 맨 위 팝업 닫기. 팝업이 열려 있었으면 true (닫을 수 없는 필수 창이어도 true → 뒤로가기로 앱이 꺼지지 않게) */
export function closeTopModal() {
  const top = openModals[openModals.length - 1];
  if (!top) return false;
  top.current?.();
  return true;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 공통 팝업 (하단 탭바 위, body 에 렌더링)
 *  - Esc·바깥 누르면 닫힘 (onClose 가 없으면 닫을 수 없는 필수 창)
 *  - 열리면 창 안 첫 입력칸/버튼으로 포커스, Tab 은 창 안에서만 이동, 닫히면 원래 위치로 복귀
 * @param label   스크린리더용 창 이름
 * @param align   'sheet'(기본: 폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 가운데) | 'center'(확인 창처럼 항상 가운데)
 */
export default function Modal({ onClose, label, children, align = 'sheet', zIndex = 100, className = '' }) {
  const overlayRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    openModals.push(onCloseRef);
    notify();
    return () => {
      const i = openModals.lastIndexOf(onCloseRef);
      if (i !== -1) openModals.splice(i, 1);
      notify();
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    const previous = document.activeElement;
    const focusables = () => [...overlay.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);

    // 자동 포커스 지정(autoFocus)이 없으면 첫 입력칸, 없으면 첫 버튼
    // 터치 화면(폰)에서는 입력칸에 포커스하면 키보드가 올라와 창을 가리므로 창 자체에만 포커스
    if (!overlay.contains(document.activeElement)) {
      const touch = window.matchMedia?.('(pointer: coarse)').matches;
      const list = focusables();
      (touch ? overlay : list.find((el) => /INPUT|TEXTAREA|SELECT/.test(el.tagName)) || list[0] || overlay).focus({ preventScroll: true });
    }

    // 문서 전체에서 받음: 창 안 내용이 바뀌어 포커스가 창 밖(body)으로 빠져도 Esc·Tab 이 동작하도록
    // (여러 창이 겹치면 맨 위 창만 처리)
    const onKey = (e) => {
      if (openModals[openModals.length - 1] !== onCloseRef) return;
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      if (!overlay.contains(document.activeElement)) {
        e.preventDefault();
        list[0].focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  // 폰의 아래 시트: 손잡이·제목 부분을 아래로 끌어내리면 닫힘
  useEffect(() => {
    if (align !== 'sheet') return undefined;
    const overlay = overlayRef.current;
    let drag = null;
    const panel = () => overlay.firstElementChild;
    const onStart = (e) => {
      const el = panel();
      if (!el || !onCloseRef.current || e.touches.length !== 1) return;
      if (!window.matchMedia?.('(max-width: 639px)').matches) return;
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const t = e.touches[0];
      // 위쪽 손잡이·제목 영역에서만 (창 안 내용 스크롤과 겹치지 않게)
      if (t.clientY - el.getBoundingClientRect().top > 64) return;
      drag = { y: t.clientY, at: Date.now(), dy: 0 };
    };
    const onMove = (e) => {
      if (!drag) return;
      drag.dy = Math.max(0, e.touches[0].clientY - drag.y);
      if (drag.dy > 0) {
        e.preventDefault();
        const el = panel();
        el.style.transition = 'none';
        el.style.transform = `translateY(${drag.dy}px)`;
      }
    };
    const onEnd = () => {
      if (!drag) return;
      const { dy, at } = drag;
      drag = null;
      const el = panel();
      if (!el) return;
      el.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
      if (shouldDismissSheet(dy, Date.now() - at)) {
        el.style.transform = 'translateY(100%)';
        setTimeout(() => onCloseRef.current?.(), 180);
      } else {
        el.style.transform = '';
      }
    };
    // 입력칸을 누르면 키보드가 올라온 뒤(창이 줄어든 뒤) 그 칸이 보이도록 창 안에서 스크롤
    let focusTimer;
    const onFocusIn = (e) => {
      if (!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => e.target.scrollIntoView?.({ block: 'center' }), 300);
    };
    overlay.addEventListener('focusin', onFocusIn);
    overlay.addEventListener('touchstart', onStart, { passive: true });
    overlay.addEventListener('touchmove', onMove, { passive: false });
    overlay.addEventListener('touchend', onEnd);
    overlay.addEventListener('touchcancel', onEnd);
    return () => {
      clearTimeout(focusTimer);
      overlay.removeEventListener('focusin', onFocusIn);
      overlay.removeEventListener('touchstart', onStart);
      overlay.removeEventListener('touchmove', onMove);
      overlay.removeEventListener('touchend', onEnd);
      overlay.removeEventListener('touchcancel', onEnd);
    };
  }, [align]);

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      style={{ zIndex }}
      className={`modal-overlay fixed inset-0 bg-slate-900/40 flex justify-center items-center p-4 outline-none ${
        align === 'sheet' ? 'modal-sheet' : 'modal-center'
      } ${className}`}
      onMouseDown={(e) => {
        // 창 바깥(어두운 배경)을 눌렀을 때만 닫기
        if (e.target === e.currentTarget && onCloseRef.current) onCloseRef.current();
      }}
    >
      {children}
    </div>,
    document.body
  );
}
