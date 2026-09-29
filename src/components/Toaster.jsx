import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { subscribeToast } from '../lib/toast';

const STYLE = {
  success: { cls: 'bg-emerald-600 text-white', Icon: CheckCircle2 },
  error: { cls: 'bg-rose-600 text-white', Icon: AlertTriangle },
  info: { cls: 'bg-slate-800 text-white', Icon: Info }
};

/** 화면 아래(탭 바 위)에 잠깐 떴다 사라지는 안내 */
export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(
    () =>
      subscribeToast((item) => {
        setItems((cur) => [...cur.slice(-2), item]);
        const ms = item.type === 'error' ? 6000 : 3500;
        setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== item.id)), ms);
      }),
    []
  );

  if (!items.length) return null;
  return (
    <div
      className="fixed left-0 right-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ bottom: 'calc(5.5rem + var(--safe-bottom))' }}
      role="status"
      aria-live="polite"
    >
      {items.map(({ id, message, type }) => {
        const { cls, Icon } = STYLE[type] || STYLE.info;
        return (
          <div
            key={id}
            className={`pointer-events-auto w-full max-w-sm rounded-2xl px-3.5 py-2.5 shadow-lg flex items-start gap-2 text-xs font-bold whitespace-pre-line ${cls}`}
          >
            <Icon size={15} className="shrink-0 mt-px" />
            <span className="flex-1">{message}</span>
            <button
              type="button"
              aria-label="안내 닫기"
              onClick={() => setItems((cur) => cur.filter((x) => x.id !== id))}
              className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
