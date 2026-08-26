import React from 'react';
import { ChevronLeft, ChevronRight, Edit3, Bell, Lock, Unlock, X, Trash2 } from 'lucide-react';

export default function MyShiftTab({
  currentYear,
  currentMonth,
  selectedDate,
  setSelectedDate,
  handlePrevMonth,
  handleNextMonth,
  shiftConfigs,
  myShifts,
  memos,
  today,
  handleShiftChange,
  memoText,
  setMemoText,
  isPrivateMemo,
  setIsPrivateMemo,
  handleAddMemo,
  setMemos
}) {
  const currentMonthShifts = Object.entries(myShifts).filter(([date]) =>
    date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  );

  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const days = [];

    const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDay = prevMonthLastDay - i;
      const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
      days.push({ dateStr: `${prevY}-${String(prevM).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`, dayNum: prevDay, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ dateStr: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`, dayNum: i, isCurrentMonth: true });
    }

    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
      days.push({ dateStr: `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`, dayNum: i, isCurrentMonth: false });
    }
    return days;
  };

  const currentSelectedShiftCode = myShifts[selectedDate] || '';

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600">
              <ChevronLeft size={20} />
            </button>
            <h2 className="font-extrabold text-xl text-slate-900">{currentYear}년 {currentMonth}월</h2>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1 text-center text-xs">
          {Object.entries(shiftConfigs).map(([code, info]) => (
            <div key={code} style={{ backgroundColor: info.color, color: info.textColor }} className="p-2 rounded-xl font-bold flex flex-col justify-between shadow-xs">
              <span className="text-[11px]">{code}</span>
              <span className="text-xs mt-0.5">
                {currentMonthShifts.filter(([_, c]) => c === code).length}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2 select-none">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 pb-2">
          <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {generateCalendarDays().map(({ dateStr, dayNum, isCurrentMonth }) => {
            const code = myShifts[dateStr] || '';
            const info = shiftConfigs[code];
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today.dateStr;
            const dayMemos = memos[dateStr] || [];

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`relative aspect-square rounded-2xl p-1 flex flex-col justify-between transition-all border-2 ${
                  !isCurrentMonth ? 'opacity-20 grayscale-[50%]' : 'opacity-100'
                } ${
                  isSelected 
                    ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100 z-10' 
                    : isToday 
                      ? 'border-amber-500 ring-2 ring-amber-100' 
                      : 'border-transparent'
                }`}
                style={{ backgroundColor: info ? info.color : '#FFFFFF' }}
              >
                <div className="flex justify-between items-center w-full px-0.5">
                  <span className="text-[10px] font-bold opacity-80" style={{ color: info ? info.textColor : '#64748B' }}>
                    {dayNum}
                  </span>
                  {dayMemos.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  )}
                </div>
                <span className="text-xs font-extrabold pb-0.5 text-center" style={{ color: info ? info.textColor : '#94A3B8' }}>
                  {code || ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Edit3 size={14} className="text-indigo-600" />
            <span>{selectedDate} 근무 지정</span>
          </span>
          <span className="text-[11px] font-semibold text-indigo-600">
            {currentSelectedShiftCode ? `${shiftConfigs[currentSelectedShiftCode]?.name}` : '미등록'}
          </span>
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {Object.entries(shiftConfigs).map(([typeKey, typeInfo]) => (
            <button
              key={typeKey}
              onClick={() => handleShiftChange(selectedDate, typeKey)}
              style={{ 
                backgroundColor: currentSelectedShiftCode === typeKey ? typeInfo.color : '#FFFFFF',
                borderColor: currentSelectedShiftCode === typeKey ? typeInfo.textColor : '#E2E8F0',
                color: typeInfo.textColor
              }}
              className={`py-2 rounded-xl text-[11px] font-bold border transition ${
                currentSelectedShiftCode === typeKey ? 'ring-2 ring-indigo-200 font-extrabold scale-105' : ''
              }`}
            >
              {typeKey}
            </button>
          ))}
          <button
            onClick={() => handleShiftChange(selectedDate, '')}
            className="py-2 rounded-xl text-[11px] font-bold border bg-white border-slate-200 text-slate-400 hover:bg-slate-100 flex items-center justify-center"
          >
            <Trash2 size={12} />
          </button>
        </div>

        <div className="pt-3 border-t space-y-2">
          <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
            <Bell size={14} className="text-indigo-600" />
            <span>일정 및 메모 등록</span>
          </p>

          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="예: 종합검진, 개인 약속" 
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMemo()}
              className="flex-1 text-xs border rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={handleAddMemo}
              className="bg-indigo-600 text-white font-bold px-3 py-2 rounded-xl text-xs hover:bg-indigo-700 transition"
            >
              등록
            </button>
          </div>

          <div className="flex items-center justify-between text-xs px-1 pt-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 font-semibold">
              <input 
                type="checkbox" 
                checked={isPrivateMemo} 
                onChange={(e) => setIsPrivateMemo(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="flex items-center gap-1">
                {isPrivateMemo ? <Lock size={13} className="text-red-500" /> : <Unlock size={13} className="text-slate-400" />}
                🔒 비공개 일정 (나만 보기)
              </span>
            </label>
          </div>

          <div className="space-y-1.5 pt-2">
            {(memos[selectedDate] || []).length === 0 ? (
              <p className="text-[11px] text-slate-400 py-1 text-center">등록된 일정이 없습니다.</p>
            ) : (
              memos[selectedDate].map((m) => (
                <div key={m.id} className="p-2.5 bg-slate-50 border rounded-xl text-xs flex justify-between items-center shadow-2xs">
                  <div className="flex items-center gap-2">
                    {m.isPrivate ? (
                      <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-0.5">
                        <Lock size={10} /> 나만 보기
                      </span>
                    ) : (
                      <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-extrabold">
                        공개
                      </span>
                    )}
                    <span className="font-semibold text-slate-800">{m.text}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setMemos({
                        ...memos,
                        [selectedDate]: memos[selectedDate].filter(item => item.id !== m.id)
                      });
                    }}
                    className="text-slate-400 hover:text-red-500 p-1"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
