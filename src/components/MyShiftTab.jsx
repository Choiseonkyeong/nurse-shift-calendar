import React from 'react';
import { ChevronLeft, ChevronRight, SecurityHandshake } from 'lucide-react';

export default function MyShiftTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  userName = '내'
}) {
  const [currentYear, currentMonth] = (selectedDate || '2026-10-01')
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

  // 이전 달 마감 날짜
  const prevMonthLastDate = new Date(currentYear, currentMonth - 1, 0).getDate();

  const calendarDays = [];

  // 이전 달 날짜 채우기 (연하게 표시)
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

  // 3. 근무 코드별 둥근 파스텔 뱃지 스타일 헬퍼
  const getShiftBadgeStyle = (shift) => {
    switch (shift) {
      case 'D':
        return 'bg-amber-100 text-amber-900 border-amber-200 font-black';
      case 'E':
        return 'bg-orange-100 text-orange-900 border-orange-200 font-black';
      case 'N':
        return 'bg-sky-100 text-sky-900 border-sky-200 font-black';
      case 'M':
        return 'bg-purple-100 text-purple-900 border-purple-200 font-black';
      case 'OFF':
        return 'bg-slate-100 text-slate-700 border-slate-200 font-bold';
      case '연차':
        return 'bg-rose-100 text-rose-900 border-rose-200 font-black';
      default:
        return 'bg-indigo-50 text-indigo-800 border-indigo-200 font-bold';
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      {/* 프로필 헤더 */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-xs border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-xs">
            {userName ? userName.slice(-2) : '근무'}
          </div>
          <div>
            <h1 className="font-black text-base text-slate-900">
              {userName || '사용자'} 님의 근무표
            </h1>
            <p className="text-xs text-slate-500 font-medium">스마트 일정 관리자</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const today = new Date();
              const y = today.getFullYear();
              const m = String(today.getMonth() + 1).padStart(2, '0');
              setSelectedDate(`${y}-${m}-01`);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            오늘
          </button>
        </div>
      </div>

      {/* 달력 카드 영역 */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-5">
        {/* 월 이동 컨트롤 */}
        <div className="flex items-center justify-between px-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-2xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-black text-slate-900">
            {currentYear}년 {currentMonth}월
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-2xl hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 상단 근무 통계 요약 카운터 */}
        <div className="grid grid-cols-6 gap-1.5">
          <div className="bg-amber-100/70 border border-amber-200 p-2 rounded-2xl text-center">
            <span className="block text-[11px] font-black text-amber-900">D</span>
            <span className="text-xs font-extrabold text-amber-950">{shiftCounts.D}</span>
          </div>
          <div className="bg-orange-100/70 border border-orange-200 p-2 rounded-2xl text-center">
            <span className="block text-[11px] font-black text-orange-900">E</span>
            <span className="text-xs font-extrabold text-orange-950">{shiftCounts.E}</span>
          </div>
          <div className="bg-sky-100/70 border border-sky-200 p-2 rounded-2xl text-center">
            <span className="block text-[11px] font-black text-sky-900">N</span>
            <span className="text-xs font-extrabold text-sky-950">{shiftCounts.N}</span>
          </div>
          <div className="bg-purple-100/70 border border-purple-200 p-2 rounded-2xl text-center">
            <span className="block text-[11px] font-black text-purple-900">M</span>
            <span className="text-xs font-extrabold text-purple-950">{shiftCounts.M}</span>
          </div>
          <div className="bg-slate-100 border border-slate-200 p-2 rounded-2xl text-center">
            <span className="block text-[11px] font-black text-slate-700">OFF</span>
            <span className="text-xs font-extrabold text-slate-900">{shiftCounts.OFF}</span>
          </div>
          <div className="bg-rose-100/70 border border-rose-200 p-2 rounded-2xl text-center">
            <span className="block text-[11px] font-black text-rose-900">연차</span>
            <span className="text-xs font-extrabold text-rose-950">{shiftCounts.연차}</span>
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
                  className={`min-h-[64px] p-1 border rounded-2xl flex flex-col justify-between items-center transition ${
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

                  {/* 근무 뱃지 (파스텔 색상 배경 적용) */}
                  {item.isCurrentMonth && shift ? (
                    <span
                      className={`w-full py-1 text-center text-[11px] rounded-xl border shadow-2xs ${getShiftBadgeStyle(
                        shift
                      )}`}
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
