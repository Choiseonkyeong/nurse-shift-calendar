import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { toDateKey, splitDateKey } from '../utils/dateUtils';

export default function MyShiftTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  shiftConfigs = {}
}) {
  // 안전한 객체 보장
  const safeShifts = myShifts || {};
  const safeConfigs = shiftConfigs || {};

  const normalizedSelectedDate = toDateKey(selectedDate || new Date());
  const { year: initYear, month: initMonth } = splitDateKey(normalizedSelectedDate);

  const [currentYear, setCurrentYear] = useState(initYear || 2026);
  const [currentMonth, setCurrentMonth] = useState(initMonth || 9);

  // 달력 날짜 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNum: d, dateStr });
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

  // 근무 변경 클릭 핸들러 (방어 코드 적용)
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

  // 선택된 날짜의 현재 근무 코드 (안전 접근)
  const currentSelectedShiftCode = safeShifts[normalizedSelectedDate] || 'OFF';

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto">
      {/* 1. 달력 헤더 및 메타 */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 space-y-3">
        <div className="flex justify-between items-center px-1">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-lg transition">
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-extrabold text-base text-slate-900">
            {currentYear}년 {currentMonth}월 내 근무
          </h2>
          <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-lg transition">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 border-b pb-1">
          <span className="text-rose-500">일</span>
          <span>월</span>
          <span>화</span>
          <span>수</span>
          <span>목</span>
          <span>금</span>
          <span className="text-sky-500">토</span>
        </div>

        {/* 달력 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1 text-xs">
          {calendarDays.map((item, idx) => {
            if (!item) return <div key={idx} className="h-12 bg-slate-50/50 rounded-xl"></div>;

            const isSelected = normalizedSelectedDate === item.dateStr;
            const shiftCode = safeShifts[item.dateStr] || 'OFF';
            const config = safeConfigs[shiftCode] || { color: '#94A3B8', name: '휴무' };

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate && setSelectedDate(item.dateStr)}
                style={{
                  borderColor: isSelected ? '#4F46E5' : '#E2E8F0',
                  borderWidth: isSelected ? '2px' : '1px'
                }}
                className={`h-12 p-1 rounded-xl transition cursor-pointer flex flex-col justify-between ${
                  isSelected ? 'bg-indigo-50/50 shadow-2xs' : 'bg-white hover:bg-slate-50'
                }`}
              >
                <span className="text-[10px] font-extrabold text-slate-700">{item.dayNum}</span>
                {shiftCode !== 'OFF' && (
                  <span
                    style={{ backgroundColor: config.color || '#4F46E5' }}
                    className="text-[9px] font-black text-white text-center rounded py-0.5 leading-none"
                  >
                    {shiftCode}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 선택한 날짜 근무 입력 패널 */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 space-y-3">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1">
            <Edit3 size={14} className="text-indigo-600" /> {normalizedSelectedDate} 근무 변경
          </span>
          <span className="text-xs font-extrabold text-indigo-600">
            현재: {currentSelectedShiftCode}
          </span>
        </div>

        {/* 근무 선택 버튼 4종 */}
        <div className="grid grid-cols-4 gap-2">
          {['D', 'E', 'N', 'OFF'].map((code) => {
            const conf = safeConfigs[code] || { name: code };
            const isCurrent = currentSelectedShiftCode === code;

            return (
              <button
                key={code}
                onClick={() => handleShiftSelect(code)}
                style={{
                  backgroundColor: isCurrent ? (conf.color || '#4F46E5') : '#F8FAFC',
                  color: isCurrent ? '#FFFFFF' : '#334155'
                }}
                className={`py-2.5 rounded-xl font-black text-xs transition border cursor-pointer ${
                  isCurrent ? 'border-transparent shadow-xs scale-105' : 'border-slate-200 hover:bg-slate-100'
                }`}
              >
                {code} ({conf.name})
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
