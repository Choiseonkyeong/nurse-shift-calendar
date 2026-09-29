import React, { useEffect, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Modal from './Modal';
import { setConfirmHost } from '../lib/confirm';

/** confirmDialog() 요청을 앱 디자인 확인 창으로 표시 (다른 팝업 위에 뜸) */
export default function ConfirmHost() {
  const [req, setReq] = useState(null);

  useEffect(
    () =>
      setConfirmHost((next) =>
        setReq((cur) => {
          cur?.resolve(false); // 이전 요청이 남아 있으면 취소로 처리
          return next;
        })
      ),
    []
  );

  if (!req) return null;
  const done = (ok) => {
    req.resolve(ok);
    setReq(null);
  };
  const Icon = req.danger ? AlertTriangle : HelpCircle;

  return (
    <Modal onClose={() => done(false)} label={req.title || '확인'} zIndex={300}>
      <div data-confirm-dialog className="bg-white w-full max-w-xs rounded-3xl p-5 space-y-4 shadow-xl border border-slate-100 text-center">
        <div
          className={`w-11 h-11 mx-auto rounded-2xl flex items-center justify-center ${
            req.danger ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600'
          }`}
        >
          <Icon size={22} />
        </div>
        <div className="space-y-1.5">
          {req.title && <h3 className="font-black text-base text-slate-900">{req.title}</h3>}
          {req.message && <p className="text-xs font-bold text-slate-500 whitespace-pre-line leading-relaxed">{req.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => done(false)}
            className="py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-black cursor-pointer hover:bg-slate-200"
          >
            {req.cancelText}
          </button>
          <button
            type="button"
            data-confirm-ok
            onClick={() => done(true)}
            className={`py-3 rounded-2xl text-white text-sm font-black cursor-pointer hover:opacity-90 ${req.danger ? 'bg-rose-600' : 'bg-indigo-600'}`}
          >
            {req.confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
