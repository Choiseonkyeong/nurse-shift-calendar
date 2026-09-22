import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  Object.entries(myShifts || {}).forEach(([dateStr, shift]) => {
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

  // 3. 원본 이미지 컬러 패밀리 맵 (파스텔 톤)
  const getTileStyle = (shift) => {
    switch (shift) {
      case 'D':
        return { backgroundColor: '#FEF08A', color: '#854D0E', label: 'D' }; // 소프트 옐로우
      case 'E':
        return { backgroundColor: '#FFEDD5', color: '#9A3412', label: 'E' }; // 소프트 피치/주황
      case 'N':
        return { backgroundColor: '#E0F2FE', color: '#0369A1', label: 'N' }; // 소프트 스카이
      case 'M':
        return { backgroundColor: '#F3E8FF', color: '#6B21A8', label: 'M' }; // 소프트 퍼플
      case 'OFF':
        return { backgroundColor: '#F1F5F9', color: '#475569', label: 'OFF' }; // 소프트 회색
      case '연차':
        return { backgroundColor: '#FCE7F3', color: '#9D174D', label: '연차' }; // 소프트 분홍
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      
      {/* 1. 상단 월 이동 및 요약 통계 카드 */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        {/* 연/월 타이틀 */}
        <div className="flex items-center justify-center gap-4 py-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <ChevronLeft size={22} />
          </button>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {currentYear}년 {currentMonth}월
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* 원본 요약 카운터 칩 (D, E, N, M, OFF, 연차) */}
        <div className="grid grid-cols-6 gap-1.5 pt-1">
          <div style={{ backgroundColor: '#FEF08A' }} className="p-2.5 rounded-2xl text-center space-y-0.5">
            <span style={{ color: '#854D0E' }} className="block text-xs font-black">D</span>
            <span style={{ color: '#854D0E' }} className="text-sm font-black">{shiftCounts.D}</span>
          </div>
          <div style={{ backgroundColor: '#FFEDD5' }} className="p-2.5 rounded-2xl text-center space-y-0.5">
            <span style={{ color: '#9A3412' }} className="block text-xs font-black">E</span>
            <span style={{ color: '#9A3412' }} className="text-sm font-black">{shiftCounts.E}</span>
          </div>
          <div style={{ backgroundColor: '#E0F2FE' }} className="p-2.5 rounded-2xl text-center space-y-0.5">
            <span style={{ color: '#0369A1' }} className="block text-xs font-black">N</span>
            <span style={{ color: '#0369A1' }} className="text-sm font-black">{shiftCounts.N}</span>
          </div>
          <div style={{ backgroundColor: '#F3E8FF' }} className="p-2.5 rounded-2xl text-center space-y-0.5">
            <span style={{ color: '#6B21A8' }} className="block text-xs font-black">M</span>
            <span style={{ color: '#6B21A8' }} className="text-sm font-black">{shiftCounts.M}</span>
          </div>
          <div style={{ backgroundColor: '#F1F5F9' }} className="p-2.5 rounded-2xl text-center space-y-0.5">
            <span style={{ color: '#475569' }} className="block text-xs font-black">OFF</span>
            <span style={{ color: '#475569' }} className="text-sm font-black">{shiftCounts.OFF}</span>
          </div>
          <div style={{ backgroundColor: '#FCE7F3' }} className="p-2.5 rounded-2xl text-center space-y-0.5">
            <span style={{ color: '#9D174D' }} className="block text-xs font-black">연차</span>
            <span style={{ color: '#9D174D' }} className="text-sm font-black">{shiftCounts.연차}</span>
          </div>
        </div>
      </div>

      {/* 2. 메인 달력 그리드 카드 */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center font-bold text-xs py-1">
          <span className="text-rose-500">일</span>
          <span className="text-slate-400">월</span>
          <span className="text-slate-400">화</span>
          <span className="text-slate-400">수</span>
          <span className="text-slate-400">목</span>
          <span className="text-slate-400">금</span>
          <span className="text-sky-500">토</span>
        </div>

        {/* 달력 날짜 셀 타일 */}
        <div className="grid grid-cols-7 gap-1.5 pt-1">
          {calendarDays.map((item, index) => {
            const shift = item.dateKey ? myShifts[item.dateKey] : null;
            const tileStyle = shift ? getTileStyle(shift) : null;

            return (
              <div
                key={index}
                style={item.isCurrentMonth && tileStyle ? { backgroundColor: tileStyle.backgroundColor } : {}}
                className={`min-h-[58px] p-2 rounded-2xl flex flex-col justify-between transition ${
                  item.isCurrentMonth
                    ? shift
                      ? 'shadow-2xs'
                      : 'bg-slate-50/50'
                    : 'opacity-20'
                }`}
              >
                {/* 상단 날짜 숫자 */}
                <span
                  style={item.isCurrentMonth && tileStyle ? { color: tileStyle.color } : {}}
                  className={`text-[11px] font-black leading-none ${
                    !tileStyle
                      ? index % 7 === 0
                        ? 'text-rose-500'
                        : index % 7 === 6
                        ? 'text-sky-500'
                        : 'text-slate-400'
                      : ''
                  }`}
                >
                  {item.day}
                </span>

                {/* 중앙 근무 텍스트 */}
                {item.isCurrentMonth && shift && tileStyle ? (
                  <span
                    style={{ color: tileStyle.color }}
                    className="text-center font-black text-xs block pt-1"
                  >
                    {tileStyle.label}
                  </span>
                ) : (
                  <div className="h-4"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
