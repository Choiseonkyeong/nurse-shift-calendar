import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarHeart } from 'lucide-react';

/** 첫 실행: 이름 입력 (그룹 멤버에게 보이는 이름) */
export default function NameSetup({ onSubmit, onLogin, initialName = '', confirmMode = false }) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  const submit = (e) => {
    e.preventDefault();
    if (trimmed) onSubmit(trimmed.slice(0, 30));
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-5 z-[110]">
      <form onSubmit={submit} className="bg-white w-full max-w-xs rounded-3xl p-6 space-y-4 shadow-xl text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <CalendarHeart size={24} />
        </div>
        <div className="space-y-1">
          <h2 className="font-black text-lg text-slate-900">{confirmMode ? '이름을 확인해 주세요' : '환영합니다!'}</h2>
          <p className="text-xs font-bold text-slate-500">
            {confirmMode
              ? '예전 버전의 기본 이름이 설정되어 있어요. 본인 이름이 맞는지 확인해 주세요.'
              : '이름을 알려 주세요. 그룹 동료에게 이 이름으로 보여요.'}
          </p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="예: 김간호"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-center outline-none focus:border-indigo-400"
        />
        <button
          type="submit"
          disabled={!trimmed}
          className="w-full py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40 cursor-pointer"
        >
          {confirmMode ? '확인' : '시작하기'}
        </button>
        {!confirmMode && onLogin && (
          <button type="button" onClick={onLogin} className="w-full text-xs font-bold text-slate-400 underline cursor-pointer">
            이미 계정이 있어요 (다른 폰에서 쓰던 데이터 불러오기)
          </button>
        )}
      </form>
    </div>,
    document.body
  );
}
