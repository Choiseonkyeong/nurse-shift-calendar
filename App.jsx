import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, Heart, Eye, EyeOff, FileSpreadsheet, Sparkles, 
  ChevronLeft, ChevronRight, Camera, Image as ImageIcon, Edit3, RotateCcw, Trash2, Bell, Clock, Volume2, UserCheck, X, Plus, FileCode, Calculator, Palmtree, Settings, RefreshCw
} from 'lucide-react';

const INVALID_NAMES = [
  '근무시간', '근무사', '근무', '보고사항', '보고', '사항', '연차', '연채', '분당', '병동', 
  '근무표', '합계', '구분', '직급', '성명', '이름', '월', '화', '수', '목', '금', '토', '일', 'OFF', 'D', 'E', 'N', 'M'
];

const getTodayDateObj = () => {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  };
};

export default function App() {
  const today = getTodayDateObj();

  const [activeTab, setActiveTab] = useState('my-shift');
  const [currentYear, setCurrentYear] = useState(today.year);
  const [currentMonth, setCurrentMonth] = useState(today.month);
  const [selectedDate, setSelectedDate] = useState(today.dateStr);

  const [userName, setUserName] = useState('최수민');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const [parsedWardData, setParsedWardData] = useState(null);
  const [detectedNames, setDetectedNames] = useState([]);
  const [customNameInput, setCustomNameInput] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);

  // 병원별 근무시간 설정
  const [shiftConfigs, setShiftConfigs] = useState({
    D: { name: 'Day', time: '07:30 - 15:30', nightHours: 0, color: '#FEF08A', textColor: '#854D0E' },
    E: { name: 'Evening', time: '14:30 - 22:30', nightHours: 0.5, color: '#FED7AA', textColor: '#9A3412' },
    N: { name: 'Night', time: '21:30 - 08:00', nightHours: 8, color: '#E0F2FE', textColor: '#075985' },
    M: { name: 'Mid', time: '10:00 - 18:00', nightHours: 0, color: '#E9D5FF', textColor: '#6B21A8' },
    OFF: { name: 'Off', time: '휴무', nightHours: 0, color: '#F3F4F6', textColor: '#374151' },
    연차: { name: 'Annual', time: '연차 휴가', nightHours: 0, color: '#FBCFE8', textColor: '#9D174D' }
  });

  // 1. 총 부여 연차
  const [totalAnnualLeave, setTotalAnnualLeave] = useState('15');
  // 2. 수동 수정용 사용 연차 (null이면 캘린더 자동 집계)
  const [manualUsedAnnual, setManualUsedAnnual] = useState(null);

  // 수당 계산 방식 선택 ('fixed': 회당 고정수당, 'hourly': 통상시급 기준)
  const [calcMode, setCalcMode] = useState('fixed');
  
  // 고정 수당 입력값 (회당 원)
  const [nightFixedAllowance, setNightFixedAllowance] = useState('50000');
  const [eveningFixedAllowance, setEveningFixedAllowance] = useState('10000');

  // 시급 입력값
  const [hourlyWage, setHourlyWage] = useState('13000');

  const [myShifts, setMyShifts] = useState({
    '2026-07-26': 'OFF', '2026-07-27': 'D', '2026-07-28': 'D', '2026-07-29': 'E', '2026-07-30': 'E', '2026-07-31': 'E',
    '2026-08-01': 'E', '2026-08-02': 'OFF', '2026-08-03': 'E', '2026-08-04': 'N', '2026-08-05': 'N',
    '2026-08-06': 'OFF', '2026-08-07': 'D', '2026-08-08': 'OFF', '2026-08-09': 'OFF', '2026-08-10': 'D',
    '2026-08-11': 'D', '2026-08-12': 'D', '2026-08-13': 'D', '2026-08-14': 'E', '2026-08-15': 'E',
    '2026-08-16': 'OFF', '2026-08-17': 'N', '2026-08-18': 'N', '2026-08-19': 'OFF', '2026-08-20': 'E',
    '2026-08-21': 'E', '2026-08-22': 'OFF', '2026-08-23': 'OFF', '2026-08-24': 'D', '2026-08-25': 'D'
  });

  const [friends, setFriends] = useState([]);

  const [memos, setMemos] = useState({
    [today.dateStr]: [
      { id: 1, type: '인수인계', time: '오전 08:00', text: '오늘 스케줄 및 병동 상태 확인', alertOffset: '0', alertText: '정시 알림', alertType: 'both', checked: false }
    ]
  });

  const [memoText, setMemoText] = useState('');
  const [memoCategory, setMemoCategory] = useState('인수인계');
  const [ampm, setAmpm] = useState('오전');
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [alertOffset, setAlertOffset] = useState('10');
  const [alertType, setAlertType] = useState('both');

  const [privacyBlur, setPrivacyBlur] = useState(false);

  // 선택 달의 근무 집계
  const currentMonthShifts = Object.entries(myShifts).filter(([date]) => 
    date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  );

  const nightShiftCount = currentMonthShifts.filter(([_, code]) => code === 'N').length;
  const eveningShiftCount = currentMonthShifts.filter(([_, code]) => code === 'E').length;
  
  // 캘린더 상의 자동 집계 연차
  const autoAnnualLeaveCount = Object.values(myShifts).filter(code => code === '연차').length;
  
  // 수동 수정값 적용 (수정값 존재 시 수동값, 없으면 자동 집계)
  const usedAnnualLeaveCount = manualUsedAnnual !== null ? Number(manualUsedAnnual) : autoAnnualLeaveCount;
  
  const numTotalAnnual = Number(totalAnnualLeave) || 0;
  const remainingAnnualLeave = numTotalAnnual - usedAnnualLeaveCount;

  // 수당 계산 분기
  const numNightFixed = Number(String(nightFixedAllowance).replace(/[^0-9]/g, '')) || 0;
  const numEveFixed = Number(String(eveningFixedAllowance).replace(/[^0-9]/g, '')) || 0;
  const numHourlyWage = Number(String(hourlyWage).replace(/[^0-9]/g, '')) || 0;

  const totalNightHours = (nightShiftCount * (Number(shiftConfigs.N.nightHours) || 0)) + (eveningShiftCount * (Number(shiftConfigs.E.nightHours) || 0));

  const estimatedAllowance = calcMode === 'fixed'
    ? (nightShiftCount * numNightFixed) + (eveningShiftCount * numEveFixed)
    : Math.round(totalNightHours * numHourlyWage * 0.5);

  const handlePrevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1); } 
    else { setCurrentMonth(currentMonth - 1); }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1); } 
    else { setCurrentMonth(currentMonth + 1); }
  };

  const handleGoToToday = () => {
    setCurrentYear(today.year);
    setCurrentMonth(today.month);
    setSelectedDate(today.dateStr);
  };

  const handleShiftChange = (dateStr, newCode) => {
    setMyShifts(prev => {
      const updated = { ...prev };
      if (!newCode) delete updated[dateStr];
      else updated[dateStr] = newCode;
      return updated;
    });
  };

  const handleConfigChange = (code, key, value) => {
    setShiftConfigs(prev => ({
      ...prev,
      [code]: { ...prev[code], [key]: value }
    }));
  };

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
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 font-sans">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-inner">
            {privacyBlur ? '*' : userName[0]}
          </div>
          <div>
            <h1 className="font-bold text-base leading-snug text-slate-900">{userName} 님의 근무표</h1>
            <p className="text-xs text-slate-500">스마트 일정 & 수당 관리자</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleGoToToday}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-100 transition"
          >
            <RotateCcw size={13} />
            <span>오늘</span>
          </button>
          <button 
            onClick={() => setPrivacyBlur(!privacyBlur)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            {privacyBlur ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>보안</span>
          </button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {activeTab === 'my-shift' && (
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
                        {isToday && (
                          <span className="text-[8px] bg-amber-500 text-white font-extrabold px-1 rounded-xs">
                            오늘
                          </span>
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
                  <span>{selectedDate} 근무 등록</span>
                </span>
                <span className="text-[11px] font-semibold text-indigo-600">
                  {currentSelectedShiftCode ? `${shiftConfigs[currentSelectedShiftCode]?.name} (${shiftConfigs[currentSelectedShiftCode]?.time})` : '미등록'}
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
            </div>
          </div>
        )}

        {activeTab === 'allowance' && (
          <div className="space-y-4">
            {/* 1. 병원 근무시간 설정 */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-700">
                <Settings size={18} /> 내 병원 3교대 근무시간 설정
              </h2>
              <p className="text-[11px] text-slate-500">병원에 맞는 근무시간 및 야간 인정시간을 설정하세요.</p>

              <div className="space-y-2">
                {['D', 'E', 'N', 'M'].map((code) => (
                  <div key={code} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border text-xs gap-2">
                    <span className="font-extrabold w-6 text-center" style={{ color: shiftConfigs[code].textColor }}>{code}</span>
                    <input 
                      type="text" 
                      value={shiftConfigs[code].time} 
                      onChange={(e) => handleConfigChange(code, 'time', e.target.value)}
                      placeholder="예: 07:30 - 15:30"
                      className="flex-1 px-2 py-1 bg-white border rounded-lg text-slate-800 font-semibold text-center"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-bold">야간인정:</span>
                      <input 
                        type="number" 
                        step="0.5"
                        value={shiftConfigs[code].nightHours} 
                        onChange={(e) => handleConfigChange(code, 'nightHours', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-12 text-center py-1 bg-white border rounded-lg font-bold text-indigo-600"
                      />
                      <span className="text-[10px]">시간</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. 연차 현황 (사용연차 직접 수정 가능) */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-extrabold text-base flex items-center gap-2 text-pink-700">
                  <Palmtree size={18} /> 연차(휴가) 현황
                </h2>
                {manualUsedAnnual !== null && (
                  <button 
                    onClick={() => setManualUsedAnnual(null)}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition"
                    title="캘린더 자동 집계로 복원"
                  >
                    <RefreshCw size={11} />
                    <span>자동 집계 복원</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-pink-50/60 p-3 rounded-xl border border-pink-100">
                  <p className="text-[10px] text-pink-600 font-bold">총 부여 연차</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <input 
                      type="number" 
                      value={totalAnnualLeave} 
                      onChange={(e) => setTotalAnnualLeave(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-12 text-center font-extrabold text-lg bg-white border rounded-lg text-pink-900"
                    />
                    <span className="text-xs font-bold text-pink-700">개</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-500 font-bold flex items-center justify-center gap-0.5">
                    <span>사용 연차</span>
                    {manualUsedAnnual !== null && <span className="text-[9px] text-indigo-600 font-extrabold">(수동)</span>}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <input 
                      type="number" 
                      step="0.5"
                      value={manualUsedAnnual !== null ? manualUsedAnnual : autoAnnualLeaveCount} 
                      onChange={(e) => setManualUsedAnnual(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-12 text-center font-extrabold text-lg bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-xs font-bold text-slate-600">개</span>
                  </div>
                </div>

                <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                  <p className="text-[10px] text-indigo-600 font-bold">잔여 연차</p>
                  <p className="font-extrabold text-lg text-indigo-900 mt-1.5">{remainingAnnualLeave}개</p>
                </div>
              </div>
            </div>

            {/* 3. 근무 수당 계산기 */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-700">
                  <Calculator size={18} /> {currentMonth}월 수당 계산기
                </h2>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button 
                    onClick={() => setCalcMode('fixed')} 
                    className={`px-2 py-1 rounded-md transition ${calcMode === 'fixed' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'}`}
                  >
                    회당 수당
                  </button>
                  <button 
                    onClick={() => setCalcMode('hourly')} 
                    className={`px-2 py-1 rounded-md transition ${calcMode === 'hourly' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'}`}
                  >
                    통상 시급
                  </button>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Night(N) 근무:</span>
                  <span className="font-extrabold text-indigo-900">{nightShiftCount} 회</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Evening(E) 근무:</span>
                  <span className="font-extrabold text-orange-900">{eveningShiftCount} 회</span>
                </div>

                {calcMode === 'fixed' ? (
                  <>
                    <div className="flex justify-between items-center pt-2 border-t border-indigo-100">
                      <span className="text-slate-600 font-semibold">Night 1회당 수당:</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="text" 
                          value={numNightFixed > 0 ? numNightFixed.toLocaleString() : ''} 
                          onChange={(e) => setNightFixedAllowance(e.target.value.replace(/[^0-9]/g, ''))}
                          onFocus={(e) => e.target.select()}
                          placeholder="예: 50,000"
                          className="w-24 text-right font-bold px-2 py-1 bg-white border rounded-lg text-slate-800"
                        />
                        <span>원</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-semibold">Evening 1회당 수당:</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="text" 
                          value={numEveFixed > 0 ? numEveFixed.toLocaleString() : ''} 
                          onChange={(e) => setEveningFixedAllowance(e.target.value.replace(/[^0-9]/g, ''))}
                          onFocus={(e) => e.target.select()}
                          placeholder="예: 10,000"
                          className="w-24 text-right font-bold px-2 py-1 bg-white border rounded-lg text-slate-800"
                        />
                        <span>원</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center pt-2 border-t border-indigo-100">
                    <span className="text-slate-600 font-semibold">통상 시급 (원):</span>
                    <div className="flex items-center gap-1">
                      <input 
                        type="text" 
                        value={numHourlyWage > 0 ? numHourlyWage.toLocaleString() : ''} 
                        onChange={(e) => setHourlyWage(e.target.value.replace(/[^0-9]/g, ''))}
                        onFocus={(e) => e.target.select()}
                        placeholder="예: 13,000"
                        className="w-24 text-right font-bold px-2 py-1 bg-white border rounded-lg text-slate-800"
                      />
                      <span>원</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-indigo-200 flex justify-between items-center">
                  <span className="font-extrabold text-slate-900 text-sm">{currentMonth}월 예상 수당:</span>
                  <span className="font-black text-indigo-600 text-lg">
                    {estimatedAllowance.toLocaleString()} 원
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 px-4 py-2 pb-7 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1 text-center">
          <button 
            onClick={() => setActiveTab('my-shift')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'my-shift' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Calendar size={18} className="mb-0.5" />
            <span>내 근무</span>
          </button>
          <button 
            onClick={() => setActiveTab('allowance')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'allowance' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Calculator size={18} className="mb-0.5" />
            <span>연차/수당</span>
          </button>
          <button 
            onClick={() => setActiveTab('friends')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'friends' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users size={18} className="mb-0.5" />
            <span>동료 비교</span>
          </button>
          <button 
            onClick={() => setActiveTab('register')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'register' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <FileSpreadsheet size={18} className="mb-0.5" />
            <span>등록</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
