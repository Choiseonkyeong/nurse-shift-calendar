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

  // 달력 날짜 계산
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
      {/* 1. 상단 월 이동 & 요약 배지 카드 */}
      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        {/* 화살표와 월 표시 */}
        <div className="flex justify-center items-center gap-3">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-black text-slate-900">
            {currentYear}년 {currentMonth}월
          </h2>
          <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 원본 파스텔 요약 배지 (D E N M OFF 연차) */}
        <div className="grid grid-cols-6 gap-1 text-center">
          <div>
            <span className="text-xs font-bold text-amber-600 block">D</span>
            <span className="text-sm font-black text-slate-800">{shiftCounts.D}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-orange-600 block">E</span>
            <span className="text-sm font-black text-slate-800">{shiftCounts.E}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-sky-600 block">N</span>
            <span className="text-sm font-black text-slate-800">{shiftCounts.N}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-purple-600 block">M</span>
            <span className="text-sm font-black text-slate-800">{shiftCounts.M}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 block">OFF</span>
            <span className="text-sm font-black text-slate-800">{shiftCounts.OFF}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-pink-500 block">연차</span>
            <span className="text-sm font-black text-slate-800">{shiftCounts.연차}</span>
          </div>
        </div>
      </div>

      {/* 2. 캘린더 (원본 폰트/간격) */}
      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-3">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center text-xs font-black border-b pb-2">
          <span className="text-rose-500">일</span>
          <span className="text-slate-400">월</span>
          <span className="text-slate-400">화</span>
          <span className="text-slate-400">수</span>
          <span className="text-slate-400">목</span>
          <span className="text-slate-400">금</span>
          <span className="text-sky-500">토</span>
        </div>

        {/* 날짜 그리드 (숫자 + 아래 텍스트 근무 코드) */}
        <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center">
          {calendarDays.map((item, idx) => {
            if (!item.isCurrentMonth) {
              return (
                <div key={idx} className="p-1 text-slate-300 opacity-40">
                  <span className="text-xs block font-semibold">{item.dayNum}</span>
                </div>
              );
            }

            const isSelected = normalizedSelectedDate === item.dateStr;
            const shiftCode = safeShifts[item.dateStr] || 'OFF';

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate && setSelectedDate(item.dateStr)}
                className={`py-1 rounded-2xl transition cursor-pointer flex flex-col items-center justify-center min-h-[50px] ${
                  isSelected ? 'border-2 border-indigo-600 font-extrabold' : 'hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-extrabold text-slate-800 block">{item.dayNum}</span>
                <span
                  className={`text-[11px] font-black mt-0.5 block ${
                    shiftCode === 'D' ? 'text-amber-600' :
                    shiftCode === 'E' ? 'text-orange-600' :
                    shiftCode === 'N' ? 'text-sky-600' :
                    shiftCode === 'M' ? 'text-purple-600' :
                    shiftCode === '연차' ? 'text-pink-600' : 'text-slate-800'
                  }`}
                >
                  {shiftCode}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
