import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight } from 'lucide-react';
import IntroBackground from './IntroBackground';
import { getIntroBg, getIntroPhoto } from '../lib/introPref';

/** 첫 화면(시작 화면): 큰 배경 + '나의 근무표 / 일하는 날도, 쉬는 날도 나답게' + [시작하기] */
export default function IntroScreen({ onStart, bg = getIntroBg(), photo = getIntroPhoto() }) {
  // 아래 창(움직이는 창) 안에서 열어도 화면 전체를 덮도록 body 에 바로 붙임
  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-center bg-black" role="dialog" aria-modal="true" aria-label="시작 화면">
      <div className="relative w-full max-w-md h-full overflow-hidden text-white">
        <IntroBackground bg={bg} photo={photo} />
        <div
          className="relative h-full flex flex-col px-7"
          style={{ paddingTop: 'calc(var(--safe-top) + 12vh)', paddingBottom: 'calc(var(--safe-bottom) + 28px)' }}
        >
          <p className="text-[12px] font-medium tracking-[0.18em] text-white/80">MY SCHEDULE</p>
          <h1 className="mt-2 text-[44px] font-bold leading-[1.12] tracking-tight drop-shadow-sm">
            나의
            <br />
            근무표
          </h1>
          <p className="mt-4 text-[18px] leading-relaxed text-white/90 drop-shadow-sm">
            일하는 날도,
            <br />
            쉬는 날도
            <br />
            나답게
          </p>
          <span className="mt-6 block w-10 h-px bg-white/70" />
          <div className="flex-1" />
          <p className="mb-6 font-serif italic text-[17px] leading-snug text-white/90 drop-shadow-sm">
            Better Workdays
            <br />
            Brighter Me
          </p>
          <button
            type="button"
            onClick={onStart}
            className="w-full h-14 rounded-full bg-white/95 text-slate-900 text-[16px] font-semibold flex items-center justify-center gap-2 shadow-lg cursor-pointer active:bg-white"
          >
            시작하기 <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
