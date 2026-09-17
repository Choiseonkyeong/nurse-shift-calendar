import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Trash2, Bell } from 'lucide-react';

export default function MyShiftTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  shiftConfigs = {}
}) {
  const [memos, setMemos] = useState(() => {
    const saved = localStorage.getItem('my_shift_memos');
    return saved ? JSON.parse(saved) : {};
  });
  const [memoInput, setMemoInput] = useState('');

  // 선택된 날짜 기반 연/월 파싱 (로직 보존)
  const [year, month, day] = selectedDate.split('-').map(Number);

  // 이전 달 / 다음 달 이동 (로직 보존)
  const handlePrevMonth = () => {
    const prevDate = new Date(year, month - 2, 1);
    const newY = prevDate.getFullYear();
    const newM = String(prevDate.getMonth() + 1).padStart(2, '0');
    setSelectedDate(`${newY}-${newM}-01`);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(year, month, 1);
    const newY = nextDate.getFullYear();
    const newM = String(nextDate.getMonth() + 1).padStart(2, '0');
    setSelectedDate(`${newY}-${newM}-01`);
  };

  // 근무 변경 (로직 보존)
  const handleShiftChange = (code) => {
    setMyShifts((prev) => {
      const updated = { ...prev };
      if (code === 'OFF' || !code) {
        delete updated[selectedDate];
      } else {
        updated[selectedDate] = code;
      }
      return updated;
    });
  };

  // 메모 추가/삭제 (로직 보존)
  const handleAddMemo = () => {
    if (!memoInput.trim()) return;
    const currentMemos = memos[selectedDate] || [];
    const updated = {
      ...memos,
      [selectedDate]: [...currentMemos, memoInput.trim()]
    };
    setMemos(updated);
    localStorage.setItem('my_shift_memos', JSON.stringify(updated));
    setMemoInput('');
  };

  const handleDeleteMemo = (index) => {
    const currentMemos = memos[selectedDate] || [];
    const updatedMemos = currentMemos.filter((_, i) => i !== index);
    const updated = { ...memos, [selectedDate]: updatedMemos };
    setMemos(updated);
    localStorage.setItem('my_shift_memos', JSON.stringify(updated));
  };

  // 달력 날짜 매트릭스 계산 (로직 보존)
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const prevLastDate = new Date(year, month - 1, 0).getDate();

  const calendarDays = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({
      dayNum: prevLastDate - i,
      isCurrentMonth: false
    });
  }

  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({
      dayNum: d,
      dateStr,
      isCurrentMonth: true
    });
  }

  const remainingCells = 42 - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarDays.push({
      dayNum: i,
      isCurrentMonth: false
    });
  }

  // 월별 근무 집계 (로직 보존)
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const shiftCounts = { D: 0, E: 0, N: 0, M: 0, OFF: 0, 연차: 0 };

  Object.entries(myShifts || {}).forEach(([dateKey, code]) => {
    if (dateKey.startsWith(monthPrefix) && code) {
      if (shiftCounts[code] !== undefined) {
        shiftCounts[code] += 1;
      }
    }
  });

  const currentShift = myShifts[selectedDate] || 'OFF';
  const currentMemos = memos[selectedDate] || [];

  return (
    <div className="space-y-4 font-sans">
      {/* 1. 상단 월 선택 & 파스텔 둥근 캡슐 배지 카드 (원본 CSS 복원) */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        <div className="flex justify-center items-center gap-3">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-full transition text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-black text-slate-900">
            {year}년 {month}월
          </h2>
          <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-full transition text-slate-600">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 원본 파스텔 둥근 캡슐 박스 6종 */}
        <div className="grid grid-cols-6 gap-1.5 text-center">
          <div className="bg-amber-100/90 py-2 rounded-2xl">
            <span className="text-[11px] font-bold text-amber-900 block">D</span>
            <span className="text-xs font-black text-amber-950">{shiftCounts.D}</span>
          </div>
          <div className="bg-orange-100/90 py-2 rounded-2xl">
            <span className="text-[11px] font-bold text-orange-900 block">E</span>
            <span className="text-xs font-black text-orange-950">{shiftCounts.E}</span>
          </div>
          <div className="bg-sky-100/90 py-2 rounded-2xl">
            <span className="text-[11px] font-bold text-sky-900 block">N</span>
            <span className="text-xs font-black text-sky-950">{shiftCounts.N}</span>
          </div>
          <div className="bg-purple-100/90 py-2 rounded-2xl">
            <span className="text-[11px] font-bold text-purple-900 block">M</span>
            <span className="text-xs font-black text-purple-950">{shiftCounts.M}</span>
          </div>
          <div className="bg-slate-100 py-2 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-600 block">OFF</span>
            <span className="text-xs font-black text-slate-800">{shiftCounts.OFF}</span>
          </div>
          <div className="bg-pink-100/90 py-2 rounded-2xl">
            <span className="text-[11px] font-bold text-pink-800 block">연차</span>
            <span className="text-xs font-black text-pink-950">{shiftCounts.연차}</span>
          </div>
        </div>
      </div>

      {/* 2. 메인 달력 (스크린샷 원본 CSS 복원: 숫자 위 + 알약 배지 아래) */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
        <div className="grid grid-cols-7 text-center text-xs font-black pb-2 border-b border-slate-100">
          <span className="text-rose-500">일</span>
          <span className="text-slate-400">월</span>
          <span className="text-slate-400">화</span>
          <span className="text-slate-400">수</span>
          <span className="text-slate-400">목</span>
          <span className="text-slate-400">금</span>
          <span className="text-sky-500">토</span>
        </div>

        <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
          {calendarDays.map((item, idx) => {
            if (!item.isCurrentMonth) {
              return (
                <div key={idx} className="p-1 text-slate-300 opacity-40 min-h-[58px]">
                  <span className="text-[11px] font-semibold">{item.dayNum}</span>
                </div>
              );
            }

            const isSelected = selectedDate === item.dateStr;
            const shiftCode = myShifts[item.dateStr] || 'OFF';

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(item.dateStr)}
                className={`py-1 rounded-2xl transition cursor-pointer flex flex-col items-center justify-between min-h-[58px] ${
                  isSelected ? 'ring-2 ring-indigo-600 bg-indigo-50/20' : 'hover:bg-slate-50'
                }`}
              >
                <span className="text-[11px] font-bold text-slate-700">{item.dayNum}</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full min-w-[28px] ${
                    shiftCode === 'D' ? 'bg-amber-100 text-amber-900' :
                    shiftCode === 'E' ? 'bg-orange-200 text-orange-950 font-black' :
                    shiftCode === 'N' ? 'bg-sky-100 text-sky-900' :
                    shiftCode === 'M' ? 'bg-purple-200 text-purple-950 font-black' :
                    shiftCode === '연차' ? 'bg-pink-100 text-pink-900' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {shiftCode}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 선택 날짜 근무 지정 및 메모 (원본 스타일 복원) */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        <div className="flex justify-between items-center text-xs">
          <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
            <Edit3 size={15} className="text-indigo-600" /> {selectedDate} 근무 지정
          </span>
          <span className="font-black text-indigo-600">{currentShift}</span>
        </div>

        {/* 원형 선택 버튼 6종 */}
        <div className="flex justify-between items-center gap-1">
          {['D', 'E', 'N', 'M', 'OFF', '연차'].map((code) => {
            const isSel = currentShift === code;
            return (
              <button
                key={code}
                onClick={() => handleShiftChange(code)}
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

        {/* 메모 영역 */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
            <Bell size={14} className="text-indigo-600" />
            <span>일정 및 메모 등록</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="메모를 입력하세요"
              value={memoInput}
              onChange={(e) => setMemoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMemo()}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAddMemo}
              className="px-4 py-2 bg-indigo-600 text-white font-extrabold text-xs rounded-xl hover:bg-indigo-700 transition"
            >
              등록
            </button>
          </div>

          {currentMemos.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {currentMemos.map((memo, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs font-semibold text-slate-700">
                  <span>• {memo}</span>
                  <button onClick={() => handleDeleteMemo(idx)} className="text-slate-400 hover:text-rose-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
