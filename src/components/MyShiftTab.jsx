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

  // 이전 달 날짜
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDate - i;
    const prevMonthNum = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYearNum = currentMonth === 1 ? currentYear - 1 : currentYear;
    const dateKey = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    calendarDays.push({
      day: dayNum,
      isCurrentMonth: false,
      dateKey
    });
  }

  // 당월 날짜
  for (let d = 1; d <= lastDateOfMonth; d++) {
    const formattedDay = String(d).padStart(2, '0');
    const formattedMonth = String(currentMonth).padStart(2, '0');
    const dateKey = `${currentYear}-${formattedMonth}-${formattedDay}`;
    calendarDays.push({
      day: d,
      isCurrentMonth: true,
      dateKey
    });
  }

  // 3. 네모 라운드 타일 컬러 (마이시프트 톤앤매너)
  const getTileConfig = (shift) => {
    switch (shift) {
      case 'D':
        return {
          style: { backgroundColor: '#818CF8', color: '#FFFFFF' }, // 인디고 파랑
          label: 'D'
        };
      case 'E':
        return {
          style: { backgroundColor: '#C084FC', color: '#FFFFFF' }, // 퍼플 보라
          label: 'E'
        };
      case 'N':
        return {
          style: { backgroundColor: '#34D399', color: '#064E3B' }, // 에메랄드 민트
          label: 'N'
        };
      case 'M':
        return {
          style: { backgroundColor: '#FBBF24', color: '#78350F' }, // 앰버 노랑
          label: 'M'
        };
      case 'OFF':
        return {
          style: { backgroundColor: '#FB7185', color: '#FFFFFF' }, // 살구 오프
          isOff: true,
          label: 'OFF'
        };
      case '연차':
        return {
          style: { backgroundColor: '#F472B6', color: '#FFFFFF' }, // 핑크 연차
          label: '연차'
        };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      {/* 메인 캘린더 카드 */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        
        {/* 상단 타이틀 & 컨트롤 */}
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

        {/* 미니멀 레전드 바 */}
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-2xl text-xs font-black text-slate-600 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#34D399' }}></span>
            <span>N {shiftCounts.N}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#818CF8' }}></span>
            <span>D {shiftCounts.D}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#C084FC' }}></span>
            <span>E {shiftCounts.E}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#FB7185' }}></span>
            <span>OFF {shiftCounts.OFF}</span>
          </div>
          {shiftCounts.M > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#FBBF24' }}></span>
              <span>M {shiftCounts.M}</span>
            </div>
          )}
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center font-black text-xs text-slate-400 py-1 border-b border-slate-100">
          <span className="text-rose-500">일</span>
          <span>월</span>
          <span>화</span>
          <span>수</span>
          <span>목</span>
          <span>금</span>
          <span className="text-sky-500">토</span>
        </div>

        {/* 라운드 타일 그리드 */}
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
                className={`min-h-[64px] rounded-2xl flex flex-col justify-between p-1 transition border ${
                  isToday
                    ? 'border-indigo-500 bg-indigo-50/20'
                    : 'border-slate-50 bg-slate-50/30'
                } ${!item.isCurrentMonth ? 'opacity-25' : ''}`}
              >
                {/* 날짜 숫자 */}
                <div className="flex justify-between items-center px-1">
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

                {/* 네모 라운드 타일 근무 블록 */}
                {item.isCurrentMonth && shift && tileConfig ? (
                  <div
                    style={tileConfig.style}
                    className="w-full h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-xs transition"
                  >
                    {tileConfig.isOff ? (
                      <Heart size={14} className="fill-current text-white/90" />
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
