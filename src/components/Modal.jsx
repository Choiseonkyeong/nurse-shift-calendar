import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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
    const overlay = overlayRef.current;
    const previous = document.activeElement;
    const focusables = () => [...overlay.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);

    // 자동 포커스 지정(autoFocus)이 없으면 첫 입력칸, 없으면 첫 버튼
    if (!overlay.contains(document.activeElement)) {
      const list = focusables();
      (list.find((el) => /INPUT|TEXTAREA|SELECT/.test(el.tagName)) || list[0] || overlay).focus({ preventScroll: true });
    }

    const onKey = (e) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
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
    overlay.addEventListener('keydown', onKey);
    return () => {
      overlay.removeEventListener('keydown', onKey);
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
