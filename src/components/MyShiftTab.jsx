import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Bell } from 'lucide-react';
import { toDateKey, splitDateKey } from '../utils/dateUtils';

export default function MyShiftTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  shiftConfigs = {}
}) {
  const safeShifts = myShifts || {};
  const normalizedSelectedDate = toDateKey(selectedDate || new Date());
  const { year: initYear, month: initMonth } = splitDateKey(normalizedSelectedDate);

  const [currentYear, setCurrentYear] = useState(initYear || 2026);
  const [currentMonth, setCurrentMonth] = useState(initMonth || 9);

  // 이번 달 근무 카운트 (D, E, N, M, OFF, 연차 6종)
  const currentMonthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const shiftCounts = { D: 0, E: 0, N: 0, M: 0, OFF: 0, 연차: 0 };

  Object.entries(safeShifts).forEach(([dateKey, code]) => {
    if (dateKey.startsWith(currentMonthPrefix) && code) {
      if (shiftCounts[code] !== undefined) {
        shiftCounts[code] += 1;
      }
    }
  });

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth, 0).getDate();
    const days = [];

    const prevLastDate = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ dayNum: prevLastDate - i, isCurrentMonth: false });
    }

    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNum: d, dateStr, isCurrentMonth: true });
    }

    return days;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const handleShiftSelect = (code) => {
    if (!setSelectedDate || !normalizedSelectedDate) return;
    setMyShifts((prev) => {
      const updated = { ...(prev || {}) };
      if (!code || code === 'OFF') {
        delete updated[normalizedSelectedDate];
      } else {
        updated[normalizedSelectedDate] = code;
      }
      return updated;
    });
  };

  const currentShiftCode = safeShifts[normalizedSelectedDate] || 'OFF';

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      {/* 1. 상단 월 선택 & 6종 카운트 배지 카드 */}
      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        <div className="flex justify-center items-center gap-3">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-black text-slate-900">
            {currentYear}년 {currentMonth}월
          </h2>
          <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-6 gap-1.5 text-center">
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

      {/* 2. 메인 달력 */}
      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-3">
        <div className="grid grid-cols-7 text-center text-xs font-black border-b pb-2">
          <span className="text-rose-500">일</span>
          <span className="text-slate-400">월</span>
          <span className="text-slate-400">화</span>
          <span className="text-slate-400">수</span>
          <span className="text-slate-400">목</span>
          <span className="text-slate-400">금</span>
          <span className="text-sky-500">토</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {calendarDays.map((item, idx) => {
            if (!item.isCurrentMonth) {
              return (
                <div key={idx} className="p-1 text-slate-300 opacity-40">
                  <span className="text-[11px] block font-semibold">{item.dayNum}</span>
                </div>
              );
            }

            const isSelected = normalizedSelectedDate === item.dateStr;
            const shiftCode = safeShifts[item.dateStr] || 'OFF';

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate && setSelectedDate(item.dateStr)}
                className={`p-1.5 rounded-2xl transition cursor-pointer flex flex-col items-center justify-between min-h-[56px] ${
                  isSelected ? 'ring-2 ring-indigo-600 bg-indigo-50/20' : 'hover:bg-slate-50'
                }`}
              >
                <span className="text-[11px] font-extrabold text-slate-700 block mb-0.5">{item.dayNum}</span>
                <span
                  className={`text-[10px] font-black w-8 h-8 rounded-full flex items-center justify-center ${
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

      {/* 3. 선택일 근무 지정 패널 */}
      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-extrabold text-slate-800 flex items-center gap-1">
            <Edit2 size={14} className="text-indigo-600" /> {normalizedSelectedDate} 근무 지정
          </span>
          <span className="font-bold text-indigo-600">{currentShiftCode}</span>
        </div>

        <div className="flex justify-between items-center gap-1">
          {['D', 'E', 'N', 'M', 'OFF', '연차'].map((code) => {
            const isSel = currentShiftCode === code;
            return (
              <button
                key={code}
                onClick={() => handleShiftSelect(code)}
                className={`flex-1 py-2 rounded-full font-black text-xs transition border cursor-pointer ${
                  isSel
                    ? 'border-indigo-600 bg-orange-100 text-orange-950 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {code}
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-slate-700">
          <Bell size={14} className="text-indigo-600" />
          <span>일정 및 메모 등록</span>
        </div>
      </div>
    </div>
  );
}
