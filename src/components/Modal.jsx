import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// 열린 팝업 순서 (안드로이드 뒤로가기: 맨 위 팝업부터 닫기)
const openModals = [];

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
 * @param align   'center' | 'bottom' (작은 화면에서 아래쪽 시트)
 */
export default function Modal({ onClose, label, children, align = 'center', zIndex = 100, className = '' }) {
  const overlayRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    openModals.push(onCloseRef);
    return () => {
      const i = openModals.lastIndexOf(onCloseRef);
      if (i !== -1) openModals.splice(i, 1);
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    const previous = document.activeElement;
    const focusables = () => [...overlay.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);

    // 자동 포커스 지정(autoFocus)이 없으면 첫 입력칸, 없으면 첫 버튼
    if (!overlay.contains(document.activeElement)) {
      const list = focusables();
      (list.find((el) => /INPUT|TEXTAREA|SELECT/.test(el.tagName)) || list[0] || overlay).focus({ preventScroll: true });
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

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      style={{ zIndex }}
      className={`fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-center p-4 outline-none ${
        align === 'bottom' ? 'items-end sm:items-center' : 'items-center'
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
