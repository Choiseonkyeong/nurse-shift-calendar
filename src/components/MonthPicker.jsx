import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Modal from './Modal';
import { getTodayDateObj } from '../utils/dateUtils';

/** 고른 년·월의 날짜 키: 이번 달이면 오늘, 아니면 1일 */
export function monthPickKey(year, month, today = getTodayDateObj()) {
  if (year === today.year && month === today.month) return today.dateStr;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * 년·월 바로 고르기 (아래에서 올라오는 창)
 * 위: ‹ 2026년 ›, 아래: 1~12월 칸. 지금 보는 달은 파란 칸, 이번 달은 파란 점
 */
export default function MonthPicker({ year, month, onPick, onClose }) {
  const today = getTodayDateObj();
  const [y, setY] = useState(year);
  return (
    <Modal onClose={onClose} label="년·월 선택">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <button type="button" aria-label="이전 해" onClick={() => setY((v) => v - 1)} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-600 active:bg-slate-100 cursor-pointer">
            <ChevronLeft size={22} />
          </button>
          <h3 className="text-[20px] font-bold text-slate-900">{y}년</h3>
          <div className="flex items-center">
            <button type="button" aria-label="다음 해" onClick={() => setY((v) => v + 1)} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-600 active:bg-slate-100 cursor-pointer">
              <ChevronRight size={22} />
            </button>
            <button type="button" aria-label="닫기" onClick={onClose} className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-100 cursor-pointer">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const on = y === year && m === month;
            const isNow = y === today.year && m === today.month;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                aria-label={`${y}년 ${m}월`}
                onClick={() => onPick(y, m)}
                className={`relative h-14 rounded-2xl text-[16px] font-semibold cursor-pointer ${
                  on ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-800 active:bg-slate-100'
                }`}
              >
                {m}월
                {isNow && !on && <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPick(today.year, today.month)}
          className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-[14px] font-medium cursor-pointer"
        >
          이번 달로
        </button>
      </div>
    </Modal>
  );
}
