import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import Modal from './Modal';
import { FONTS, FONT_SIZES, fontStack, getFontPref, getFontSizePref, setFontPref, setFontSizePref } from '../lib/fontPref';
import { ACCENTS, getAccentPref, setAccentPref } from '../lib/accentPref';
import Mascot from './Mascot';

/** 설정 › 꾸미기: 앱 색 + 글꼴 고르기(각 이름을 그 글꼴로 보여 줌) + 글자 크기 4단계 */
export default function FontSheet({ onClose }) {
  const [font, setFont] = useState(getFontPref);
  const [size, setSize] = useState(getFontSizePref);
  const [accent, setAccent] = useState(getAccentPref);
  const pickAccent = (key) => {
    setAccentPref(key);
    setAccent(key);
  };
  const pickFont = (key) => {
    setFontPref(key);
    setFont(key);
  };
  const pickSize = (key) => {
    setFontSizePref(key);
    setSize(key);
  };
  // 미리 보기용으로 고르지 않은 글꼴도 내려받아 둠 (창을 열 때 한 번)
  useEffect(() => FONTS.forEach((f) => f.load?.().catch(() => {})), []);

  return (
    <Modal onClose={onClose} label="꾸미기">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-[20px] font-bold text-slate-900">꾸미기</h3>
          <button onClick={onClose} className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-100 cursor-pointer" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] text-slate-500 px-1">앱 색</p>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <Mascot size={52} />
            <div role="radiogroup" aria-label="앱 색" className="flex-1 flex flex-wrap gap-2.5">
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  role="radio"
                  aria-checked={accent === a.key}
                  aria-label={a.label}
                  title={a.label}
                  onClick={() => pickAccent(a.key)}
                  className={`w-9 h-9 rounded-full cursor-pointer flex items-center justify-center ${accent === a.key ? 'ring-[3px] ring-offset-2 ring-slate-300' : ''}`}
                  style={{ backgroundColor: a.hex }}
                >
                  {accent === a.key && <Check size={18} className="text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[13px] text-slate-500 px-1 -mb-2">글꼴</p>
        <div role="radiogroup" aria-label="글꼴" className="rounded-2xl bg-slate-50 divide-y divide-slate-200/70 overflow-hidden">
          {FONTS.map((f) => {
            const on = font === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickFont(f.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer ${on ? 'bg-blue-50' : 'active:bg-slate-100'}`}
              >
                <span className="flex-1 min-w-0" style={{ fontFamily: fontStack(f.key) }}>
                  <span className="block text-[17px] font-semibold text-slate-900">{f.label}</span>
                  <span className="block text-[13px] text-slate-500">{f.desc} · 데이 07:00 근무</span>
                </span>
                {on && <Check size={20} className="shrink-0 text-blue-600" />}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-[13px] text-slate-500 px-1">글자 크기</p>
          <div role="radiogroup" aria-label="글자 크기" className="grid grid-cols-4 p-1 rounded-full bg-slate-100">
            {FONT_SIZES.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={size === s.key}
                onClick={() => pickSize(s.key)}
                className={`h-10 rounded-full font-semibold whitespace-nowrap cursor-pointer transition-colors ${size === s.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                style={{ fontSize: `${Math.round(14 * s.scale)}px` }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-slate-400 leading-relaxed">이 폰에만 저장돼요. 근무표 그림 공유에도 고른 글꼴이 쓰여요.</p>
      </div>
    </Modal>
  );
}
