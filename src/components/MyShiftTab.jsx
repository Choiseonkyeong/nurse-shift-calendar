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

  // 1. 근무 통계
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

  // 3. 참고 이미지 스타일 타일 맵
  const getTileConfig = (shift) => {
    switch (shift) {
      case 'D':
        return { style: { backgroundColor: '#7088D6', color: '#FFFFFF' }, label: 'D' };
      case 'E':
        return { style: { backgroundColor: '#A671D6', color: '#FFFFFF' }, label: 'E' };
      case 'N':
        return { style: { backgroundColor: '#32D4A4', color: '#0C2D23' }, label: 'N' };
      case 'M':
        return { style: { backgroundColor: '#F0B429', color: '#3D2500' }, label: 'M' };
      case 'OFF':
        return { style: { backgroundColor: '#E68A5C', color: '#FFFFFF' }, isOff: true, label: 'OFF' };
      case '연차':
        return { style: { backgroundColor: '#E15B8C', color: '#FFFFFF' }, label: '연차' };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10 text-slate-100">
      {/* 프리미엄 다크 컨테이너 */}
      <div style={{ backgroundColor: '#12131C' }} className="p-5 rounded-3xl shadow-2xl border border-slate-800/80 space-y-4">
        
        {/* 월 이동 컨트롤 */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-white tracking-tight">
              {currentYear}년 {String(currentMonth).padStart(2, '0')}월
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const today = new Date();
                const y = today.getFullYear();
                const m = String(today.getMonth() + 1).padStart(2, '0');
                setSelectedDate(`${y}-${m}-01`);
              }}
              style={{ backgroundColor: '#1E202E' }}
              className="px-3 py-1.5 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-700/50"
            >
              오늘
            </button>
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 transition cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 transition cursor-pointer"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* 상단 미니멀 레전드 */}
        <div style={{ backgroundColor: '#181A26' }} className="flex items-center gap-3.5 px-3.5 py-2 rounded-2xl border border-slate-800/80 text-xs font-bold text-slate-300 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#32D4A4' }}></span>
            <span>N {shiftCounts.N}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#7088D6' }}></span>
            <span>D {shiftCounts.D}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#A671D6' }}></span>
            <span>E {shiftCounts.E}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#E68A5C' }}></span>
            <span>OFF {shiftCounts.OFF}</span>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center font-black text-xs text-slate-500 py-1.5 border-b border-slate-800/80">
          <span className="text-rose-400">일</span>
          <span>월</span>
          <span>화</span>
          <span>수</span>
          <span>목</span>
          <span>금</span>
          <span className="text-sky-400">토</span>
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
                style={{ backgroundColor: '#181A26' }}
                className={`min-h-[70px] rounded-2xl flex flex-col justify-between p-1 transition border ${
                  isToday ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-800/50'
                } ${!item.isCurrentMonth ? 'opacity-20' : ''}`}
              >
                {/* 날짜 숫자 */}
                <div className="flex justify-between items-center px-1 pt-0.5">
                  <span
                    className={`text-[11px] font-black ${
                      index % 7 === 0
                        ? 'text-rose-400'
                        : index % 7 === 6
                        ? 'text-sky-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {item.day}
                  </span>
                </div>

                {/* 둥근 직사각형 근무 타일 */}
                {item.isCurrentMonth && shift && tileConfig ? (
                  <div
                    style={tileConfig.style}
                    className="w-full h-8 rounded-xl flex items-center justify-center font-black text-sm shadow-xs transition"
                  >
                    {tileConfig.isOff ? (
                      <Heart size={16} className="fill-current text-white" />
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
