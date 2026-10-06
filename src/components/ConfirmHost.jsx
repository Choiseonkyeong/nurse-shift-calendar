import React, { useEffect, useState } from 'react';
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

  return (
    <Modal onClose={() => done(false)} label={req.title || '확인'} align="center" zIndex={300}>
      <div data-confirm-dialog className="bg-white w-full max-w-[19rem] rounded-2xl pt-6 px-5 pb-4 space-y-5 shadow-xl text-left">
        <div className="space-y-1.5">
          {req.title && <h3 className="text-[18px] font-bold text-slate-900">{req.title}</h3>}
          {req.message && <p className="text-[14px] text-slate-500 whitespace-pre-line leading-relaxed">{req.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => done(false)}
            className="h-12 rounded-xl bg-slate-100 text-slate-700 text-[15px] font-semibold cursor-pointer"
          >
            {req.cancelText}
          </button>
          <button
            type="button"
            data-confirm-ok
            onClick={() => done(true)}
            className={`h-12 rounded-xl text-white text-[15px] font-semibold cursor-pointer ${req.danger ? 'bg-rose-600' : 'bg-blue-600'}`}
          >
            {req.confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
