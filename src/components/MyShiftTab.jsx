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

  // 달 이동 핸들러
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

  // 1. 해당 월 근무 통계 계산
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

  // 이전 달 날짜 채우기
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthLastDate - i,
      isCurrentMonth: false,
      dateKey: null
    });
  }

  // 당월 날짜 채우기
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

  // 3. 근무 코드별 인라인 배지 스타일 (Tailwind 빌드 유실 방지)
  const getBadgeStyle = (shift) => {
    switch (shift) {
      case 'D':
        return { backgroundColor: '#FEF3C7', color: '#78350F', borderColor: '#FDE68A' };
      case 'E':
        return { backgroundColor: '#FFEDD5', color: '#7C2D12', borderColor: '#FED7AA' };
      case 'N':
        return { backgroundColor: '#E0F2FE', color: '#075985', borderColor: '#BAE6FD' };
      case 'M':
        return { backgroundColor: '#F3E8FF', color: '#581C87', borderColor: '#E9D5FF' };
      case 'OFF':
        return { backgroundColor: '#F1F5F9', color: '#334155', borderColor: '#E2E8F0' };
      case '연차':
        return { backgroundColor: '#FFE4E6', color: '#881337', borderColor: '#FECDD3' };
      default:
        return { backgroundColor: '#EEF2FF', color: '#3730A3', borderColor: '#C7D2FE' };
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      {/* 달력 메인 카드 (중복 헤더 제거) */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-5">
        
        {/* 월 이동 컨트롤 & 오늘 버튼 */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-2xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900">
              {currentYear}년 {currentMonth}월
            </h2>
            <button
              onClick={() => {
                const today = new Date();
                const y = today.getFullYear();
                const m = String(today.getMonth() + 1).padStart(2, '0');
                setSelectedDate(`${y}-${m}-01`);
              }}
              className="px-2.5 py-1 bg-slate-100 text-slate-600 font-extrabold text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
            >
              오늘
            </button>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-2xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 상단 근무 통계 요약 카운터 */}
        <div className="grid grid-cols-6 gap-1.5">
          <div style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }} className="border p-2 rounded-2xl text-center">
            <span style={{ color: '#78350F' }} className="block text-[11px] font-black">D</span>
            <span style={{ color: '#451A03' }} className="text-xs font-extrabold">{shiftCounts.D}</span>
          </div>
          <div style={{ backgroundColor: '#FFEDD5', borderColor: '#FED7AA' }} className="border p-2 rounded-2xl text-center">
            <span style={{ color: '#7C2D12' }} className="block text-[11px] font-black">E</span>
            <span style={{ color: '#431407' }} className="text-xs font-extrabold">{shiftCounts.E}</span>
          </div>
          <div style={{ backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }} className="border p-2 rounded-2xl text-center">
            <span style={{ color: '#075985' }} className="block text-[11px] font-black">N</span>
            <span style={{ color: '#0C4A6E' }} className="text-xs font-extrabold">{shiftCounts.N}</span>
          </div>
          <div style={{ backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }} className="border p-2 rounded-2xl text-center">
            <span style={{ color: '#581C87' }} className="block text-[11px] font-black">M</span>
            <span style={{ color: '#3B0764' }} className="text-xs font-extrabold">{shiftCounts.M}</span>
          </div>
          <div style={{ backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }} className="border p-2 rounded-2xl text-center">
            <span style={{ color: '#334155' }} className="block text-[11px] font-black">OFF</span>
            <span style={{ color: '#0F172A' }} className="text-xs font-extrabold">{shiftCounts.OFF}</span>
          </div>
          <div style={{ backgroundColor: '#FFE4E6', borderColor: '#FECDD3' }} className="border p-2 rounded-2xl text-center">
            <span style={{ color: '#881337' }} className="block text-[11px] font-black">연차</span>
            <span style={{ color: '#4C0519' }} className="text-xs font-extrabold">{shiftCounts.연차}</span>
          </div>
        </div>

        {/* 캘린더 그리드 */}
        <div className="space-y-2">
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

          {/* 날짜 셀 그리드 */}
          <div className="grid grid-cols-7 gap-1 pt-1">
            {calendarDays.map((item, index) => {
              const shift = item.dateKey ? myShifts[item.dateKey] : null;
              const isToday =
                item.dateKey ===
                `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

              return (
                <div
                  key={index}
                  className={`min-h-[60px] p-1 border rounded-2xl flex flex-col justify-between items-center transition ${
                    isToday
                      ? 'border-indigo-600 bg-indigo-50/30'
                      : 'border-slate-100 bg-white'
                  } ${!item.isCurrentMonth ? 'opacity-30' : ''}`}
                >
                  {/* 날짜 숫자 */}
                  <span
                    className={`text-xs font-black ${
                      index % 7 === 0
                        ? 'text-rose-500'
                        : index % 7 === 6
                        ? 'text-sky-500'
                        : 'text-slate-700'
                    }`}
                  >
                    {item.day}
                  </span>

                  {/* 근무 뱃지 (파스텔 색상 인라인 스타일 적용) */}
                  {item.isCurrentMonth && shift ? (
                    <span
                      style={getBadgeStyle(shift)}
                      className="w-full py-1 text-center text-[11px] font-black rounded-xl border shadow-2xs block"
                    >
                      {shift}
                    </span>
                  ) : (
                    <div className="h-5"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
