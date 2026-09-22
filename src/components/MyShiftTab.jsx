import React from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';

export default function MyShiftTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  userName = ''
}) {
  const [currentYear, currentMonth] = (selectedDate || '2026-09-01')
    .split('-')
    .map(Number);

  const handlePrevMonth = () => {
    const prevDate = new Date(currentYear, currentMonth - 2, 1);
    const y = prevDate.getFullYear();
    const m = String(prevDate.getMonth() + 1).padStart(2, '0');
    setSelectedDate(`${y}-${m}-01`);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(currentYear, currentMonth, 1);
    const y = nextDate.getFullYear();
    const m = String(nextDate.getMonth() + 1).padStart(2, '0');
    setSelectedDate(`${y}-${m}-01`);
  };

  // 1. 근무 통계 집계
  const shiftCounts = { D: 0, E: 0, N: 0, M: 0, OFF: 0, 연차: 0 };
  Object.entries(myShifts).forEach(([dateStr, shift]) => {
    if (dateStr.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)) {
      if (shiftCounts[shift] !== undefined) {
        shiftCounts[shift] += 1;
      }
    }
  });

  // 2. 달력 일자 계산
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
  const lastDateOfMonth = new Date(currentYear, currentMonth, 0).getDate();
  const prevMonthLastDate = new Date(currentYear, currentMonth - 1, 0).getDate();

  const calendarDays = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDate - i;
    const prevMonthNum = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYearNum = currentMonth === 1 ? currentYear - 1 : currentYear;
    calendarDays.push({
      day: dayNum,
      isCurrentMonth: false,
      dateKey: `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    });
  }

  for (let d = 1; d <= lastDateOfMonth; d++) {
    const formattedDay = String(d).padStart(2, '0');
    const formattedMonth = String(currentMonth).padStart(2, '0');
    calendarDays.push({
      day: d,
      isCurrentMonth: true,
      dateKey: `${currentYear}-${formattedMonth}-${formattedDay}`
    });
  }

  // 3. 근무 코드별 타일 컬러
  const getTileConfig = (shift) => {
    switch (shift) {
      case 'D':
        return { style: { backgroundColor: '#818CF8', color: '#FFFFFF' }, label: 'D' }; // 인디고
      case 'E':
        return { style: { backgroundColor: '#C084FC', color: '#FFFFFF' }, label: 'E' }; // 퍼플
      case 'N':
        return { style: { backgroundColor: '#34D399', color: '#064E3B' }, label: 'N' }; // 민트
      case 'M':
        return { style: { backgroundColor: '#FBBF24', color: '#78350F' }, label: 'M' }; // 옐로우
      case 'OFF':
        return { style: { backgroundColor: '#FB7185', color: '#FFFFFF' }, isOff: true, label: 'OFF' }; // 코랄
      case '연차':
        return { style: { backgroundColor: '#F472B6', color: '#FFFFFF' }, label: '연차' };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      {/* 캘린더 메인 카드 */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        
        {/* 상단 연/월 헤더 및 컨트롤 */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {currentYear}년 {String(currentMonth).padStart(2, '0')}월
          </h2>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const today = new Date();
                const y = today.getFullYear();
                const m = String(today.getMonth() + 1).padStart(2, '0');
                setSelectedDate(`${y}-${m}-01`);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
            >
              오늘
            </button>
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* 상단 미니멀 레전드 카운터 (D -> E -> N -> M -> OFF 순서 적용) */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs font-black text-slate-600 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#818CF8' }}></span>
            <span>D {shiftCounts.D}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#C084FC' }}></span>
            <span>E {shiftCounts.E}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#34D399' }}></span>
            <span>N {shiftCounts.N}</span>
          </div>
          {shiftCounts.M > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#FBBF24' }}></span>
              <span>M {shiftCounts.M}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#FB7185' }}></span>
            <span>OFF {shiftCounts.OFF}</span>
          </div>
          {shiftCounts.연차 > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#F472B6' }}></span>
              <span>연차 {shiftCounts.연차}</span>
            </div>
          )}
        </div>

        {/* 요일 구분선 */}
        <div className="grid grid-cols-7 text-center font-black text-xs text-slate-400 py-1.5 border-b border-slate-100">
          <span className="text-rose-500">일</span>
          <span>월</span>
          <span>화</span>
          <span>수</span>
          <span>목</span>
          <span>금</span>
          <span className="text-sky-500">토</span>
        </div>

        {/* 타일 그리드 */}
        <div className="grid grid-cols-7 gap-1 pt-1">
          {calendarDays.map((item, index) => {
            const shift = item.dateKey ? myShifts[item.dateKey] : null;
            const tileConfig = shift ? getTileConfig(shift) : null;
            const isToday =
              item.dateKey ===
              `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

            return (
              <div
                key={index}
                className={`min-h-[66px] rounded-2xl flex flex-col justify-between p-1 transition border ${
                  isToday
                    ? 'border-indigo-500 bg-indigo-50/20'
                    : 'border-slate-50 bg-slate-50/40'
                } ${!item.isCurrentMonth ? 'opacity-25' : ''}`}
              >
                {/* 날짜 숫자 */}
                <div className="flex justify-between items-center px-1 pt-0.5">
                  <span
                    className={`text-[11px] font-black ${
                      index % 7 === 0
                        ? 'text-rose-500'
                        : index % 7 === 6
                        ? 'text-sky-500'
                        : 'text-slate-700'
                    }`}
                  >
                    {item.day}
                  </span>
                </div>

                {/* 둥근 직사각형 근무 타일 */}
                {item.isCurrentMonth && shift && tileConfig ? (
                  <div
                    style={tileConfig.style}
                    className="w-full h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-2xs transition"
                  >
                    {tileConfig.isOff ? (
                      <Heart size={14} className="fill-current text-white" />
                    ) : (
                      <span>{tileConfig.label}</span>
                    )}
                  </div>
                ) : (
                  <div className="h-8"></div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
