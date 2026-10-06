import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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
