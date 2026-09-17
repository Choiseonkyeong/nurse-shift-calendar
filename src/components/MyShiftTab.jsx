import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, MessageSquare, Plus, Check } from 'lucide-react';
import { toDateKey } from '../utils/dateUtils';

export default function MyShiftTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  shiftConfigs = {}
}) {
  const safeShifts = myShifts || {};
  const safeConfigs = shiftConfigs || {};

  const [currentDate, setCurrentDate] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  const [memos, setMemos] = useState(() => {
    const saved = localStorage.getItem('shift_memos');
    return saved ? JSON.parse(saved) : {};
  });

  const [newMemoText, setNewMemoText] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, currentDate.getMonth() + 1, 1));
  };

  const handleShiftSelect = (code) => {
    if (!selectedDate) return;
    const stdKey = toDateKey(selectedDate);
    
    setMyShifts((prev) => {
      const updated = { ...(prev || {}) };
      if (!code || code === 'OFF') {
        delete updated[stdKey];
      } else {
        updated[stdKey] = code;
      }
      return updated;
    });
  };

  const handleAddMemo = () => {
    if (!newMemoText.trim() || !selectedDate) return;
    const stdKey = toDateKey(selectedDate);
    const updated = {
      ...memos,
      [stdKey]: [...(memos[stdKey] || []), newMemoText.trim()]
    };
    setMemos(updated);
    localStorage.setItem('shift_memos', JSON.stringify(updated));
    setNewMemoText('');
  };

  // 달력 일수 계산
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const days = [];

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dayNum: d, dateStr });
  }

  // 월별 근무 통계
  const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const shiftCounts = { D: 0, E: 0, N: 0, M: 0, OFF: 0, 연차: 0 };

  Object.entries(safeShifts).forEach(([dateKey, code]) => {
    if (dateKey.startsWith(currentMonthPrefix) && code) {
      if (shiftCounts[code] !== undefined) {
        shiftCounts[code] += 1;
      }
    }
  });

  const stdSelectedDate = toDateKey(selectedDate || new Date());
  const currentSelectedShift = safeShifts[stdSelectedDate] || 'OFF';
  const dayMemos = memos[stdSelectedDate] || [];

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      {/* 1. 상단 월 선택 & 근무 통계 파스텔 카드 */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between items-center px-2">
          <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 transition">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-black text-slate-800">
            {year}년 {month}월
          </h2>
          <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 transition">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 6종 파스텔 배지 */}
        <div className="grid grid-cols-6 gap-1 text-center">
          <div className="bg-amber-100/80 p-2 rounded-2xl">
            <span className="text-[11px] font-bold text-amber-800 block">D</span>
            <span className="text-sm font-black text-amber-950">{shiftCounts.D}</span>
          </div>
          <div className="bg-orange-100/80 p-2 rounded-2xl">
            <span className="text-[11px] font-bold text-orange-800 block">E</span>
            <span className="text-sm font-black text-orange-950">{shiftCounts.E}</span>
          </div>
          <div className="bg-sky-100/80 p-2 rounded-2xl">
            <span className="text-[11px] font-bold text-sky-800 block">N</span>
            <span className="text-sm font-black text-sky-950">{shiftCounts.N}</span>
          </div>
          <div className="bg-purple-100/80 p-2 rounded-2xl">
            <span className="text-[11px] font-bold text-purple-800 block">M</span>
            <span className="text-sm font-black text-purple-950">{shiftCounts.M}</span>
          </div>
          <div className="bg-slate-100 p-2 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-600 block">OFF</span>
            <span className="text-sm font-black text-slate-800">{shiftCounts.OFF}</span>
          </div>
          <div className="bg-pink-100/80 p-2 rounded-2xl">
            <span className="text-[11px] font-bold text-pink-700 block">연차</span>
            <span className="text-sm font-black text-pink-950">{shiftCounts.연차}</span>
          </div>
        </div>
      </div>

      {/* 2. 메인 캘린더 */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-3">
        <div className="grid grid-cols-7 text-center text-xs font-black border-b pb-2">
          <span className="text-rose-500">일</span>
          <span className="text-slate-400">월</span>
          <span className="text-slate-400">화</span>
          <span className="text-slate-400">수</span>
          <span className="text-slate-400">목</span>
          <span className="text-slate-400">금</span>
          <span className="text-sky-500">토</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((item, idx) => {
            if (!item) return <div key={idx} className="h-14 bg-slate-50/40 rounded-2xl"></div>;

            const isSelected = stdSelectedDate === item.dateStr;
            const shiftCode = safeShifts[item.dateStr] || 'OFF';

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate && setSelectedDate(item.dateStr)}
                className={`h-14 p-1 rounded-2xl transition cursor-pointer flex flex-col items-center justify-between border ${
                  isSelected ? 'border-indigo-600 bg-indigo-50/30' : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <span className="text-[11px] font-extrabold text-slate-700">{item.dayNum}</span>
                <span
                  className={`text-[10px] font-black w-7 h-7 rounded-full flex items-center justify-center ${
                    shiftCode === 'D' ? 'bg-amber-100 text-amber-900' :
                    shiftCode === 'E' ? 'bg-orange-200 text-orange-950 font-black' :
                    shiftCode === 'N' ? 'bg-sky-100 text-sky-900' :
                    shiftCode === 'M' ? 'bg-purple-200 text-purple-950 font-black' :
                    shiftCode === '연차' ? 'bg-pink-100 text-pink-900' : 'text-slate-500 bg-slate-100'
                  }`}
                >
                  {shiftCode}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 선택 날짜 근무 지정 & 메모 */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex justify-between items-center text-xs border-b pb-2">
          <span className="font-extrabold text-slate-800">
            📌 {stdSelectedDate} 근무 지정
          </span>
          <span className="font-bold text-indigo-600">{currentSelectedShift}</span>
        </div>

        {/* 원형 근무 선택 버튼 6종 */}
        <div className="flex justify-between items-center gap-1">
          {['D', 'E', 'N', 'M', 'OFF', '연차'].map((code) => {
            const isSel = currentSelectedShift === code;
            return (
              <button
                key={code}
                onClick={() => handleShiftSelect(code)}
                className={`w-10 h-10 rounded-full font-black text-xs transition border flex items-center justify-center cursor-pointer ${
                  isSel
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm scale-105'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {code}
              </button>
            );
          })}
        </div>

        {/* 메모 등록 영역 */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <MessageSquare size={14} className="text-indigo-600" />
            <span>일정 및 메모 등록</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="메모를 입력하세요..."
              value={newMemoText}
              onChange={(e) => setNewMemoText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMemo()}
              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAddMemo}
              className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition"
            >
              <Plus size={16} />
            </button>
          </div>

          {dayMemos.length > 0 && (
            <div className="space-y-1 pt-1">
              {dayMemos.map((memo, idx) => (
                <div key={idx} className="text-xs bg-slate-50 p-2 rounded-xl text-slate-700 border border-slate-100 flex items-center gap-1">
                  <Check size={12} className="text-indigo-600" />
                  <span>{memo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
