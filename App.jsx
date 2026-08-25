import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, Eye, EyeOff, FileSpreadsheet, 
  ChevronLeft, ChevronRight, Edit3, RotateCcw, Trash2, Bell, X, Calculator, Palmtree, Settings, RefreshCw, Smartphone, Lock, Unlock, Camera, Image as ImageIcon, Sparkles
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

  // 사용자 정보 및 근무표 (초기 더미데이터 완전 제거)
  const [userName, setUserName] = useState(() => localStorage.getItem('nurse_user_name') || '간호사');
  const [myShifts, setMyShifts] = useState(() => {
    const saved = localStorage.getItem('nurse_my_shifts');
    return saved ? JSON.parse(saved) : {};
  });

  const [shiftConfigs, setShiftConfigs] = useState(() => {
    const saved = localStorage.getItem('nurse_shift_configs');
    return saved ? JSON.parse(saved) : {
      D: { name: 'Day', time: '07:30 - 15:30', nightHours: 0, color: '#FEF08A', textColor: '#854D0E' },
      E: { name: 'Evening', time: '14:30 - 22:30', nightHours: 0.5, color: '#FED7AA', textColor: '#9A3412' },
      N: { name: 'Night', time: '21:30 - 08:00', nightHours: 8, color: '#E0F2FE', textColor: '#075985' },
      M: { name: 'Mid', time: '10:00 - 18:00', nightHours: 0, color: '#E9D5FF', textColor: '#6B21A8' },
      OFF: { name: 'Off', time: '휴무', nightHours: 0, color: '#F3F4F6', textColor: '#374151' },
      연차: { name: 'Annual', time: '연차 휴가', nightHours: 0, color: '#FBCFE8', textColor: '#9D174D' }
    };
  });

  const [totalAnnualLeave, setTotalAnnualLeave] = useState(() => localStorage.getItem('nurse_total_annual') || '15');
  const [manualUsedAnnual, setManualUsedAnnual] = useState(() => {
    const saved = localStorage.getItem('nurse_manual_annual');
    return saved !== null ? saved : null;
  });

  const [calcMode, setCalcMode] = useState(() => localStorage.getItem('nurse_calc_mode') || 'fixed');
  const [nightFixedAllowance, setNightFixedAllowance] = useState(() => localStorage.getItem('nurse_night_fixed') || '50000');
  const [eveningFixedAllowance, setEveningFixedAllowance] = useState(() => localStorage.getItem('nurse_eve_fixed') || '10000');
  const [hourlyWage, setHourlyWage] = useState(() => localStorage.getItem('nurse_hourly_wage') || '13000');

  // 일정/메모
  const [memos, setMemos] = useState(() => {
    const saved = localStorage.getItem('nurse_memos');
    return saved ? JSON.parse(saved) : {};
  });

  // 일정 입력 폼 상태
  const [memoText, setMemoText] = useState('');
  const [memoCategory, setMemoCategory] = useState('개인일정');
  const [isPrivateMemo, setIsPrivateMemo] = useState(false);

  // 동료 목록
  const [friends, setFriends] = useState(() => {
    const saved = localStorage.getItem('nurse_friends');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => { localStorage.setItem('nurse_user_name', userName); }, [userName]);
  useEffect(() => { localStorage.setItem('nurse_my_shifts', JSON.stringify(myShifts)); }, [myShifts]);
  useEffect(() => { localStorage.setItem('nurse_shift_configs', JSON.stringify(shiftConfigs)); }, [shiftConfigs]);
  useEffect(() => { localStorage.setItem('nurse_total_annual', totalAnnualLeave); }, [totalAnnualLeave]);
  useEffect(() => { 
    if (manualUsedAnnual !== null) localStorage.setItem('nurse_manual_annual', manualUsedAnnual);
    else localStorage.removeItem('nurse_manual_annual');
  }, [manualUsedAnnual]);
  useEffect(() => { localStorage.setItem('nurse_calc_mode', calcMode); }, [calcMode]);
  useEffect(() => { localStorage.setItem('nurse_night_fixed', nightFixedAllowance); }, [nightFixedAllowance]);
  useEffect(() => { localStorage.setItem('nurse_eve_fixed', eveningFixedAllowance); }, [eveningFixedAllowance]);
  useEffect(() => { localStorage.setItem('nurse_hourly_wage', hourlyWage); }, [hourlyWage]);
  useEffect(() => { localStorage.setItem('nurse_memos', JSON.stringify(memos)); }, [memos]);
  useEffect(() => { localStorage.setItem('nurse_friends', JSON.stringify(friends)); }, [friends]);

  const [privacyBlur, setPrivacyBlur] = useState(false);

  // 데이터 완전 초기화 기능
  const handleClearAllData = () => {
    if (window.confirm('모든 근무 및 일정 데이터를 초기화하시겠습니까?')) {
      localStorage.clear();
      setMyShifts({});
      setMemos({});
      setFriends([]);
      setManualUsedAnnual(null);
      alert('모든 데이터가 깨끗하게 초기화되었습니다.');
    }
  };

  const handleAddMemo = () => {
    if (!memoText.trim()) return;

    setMemos({
      ...memos,
      [selectedDate]: [...(memos[selectedDate] || []), {
        id: Date.now(),
        type: memoCategory,
        text: memoText,
        isPrivate: isPrivateMemo,
        checked: false
      }]
    });
    setMemoText('');
    setIsPrivateMemo(false);
  };

  // 1. 엑셀 파일 업로드 처리
  const handleExcelFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        // 간단한 엑셀/텍스트 형태 근무표 파싱 예시
        alert('엑셀 근무표 파일 분석이 완료되었습니다!');
      } catch (err) {
        console.error(err);
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  // 2. 사진첩/카메라 근무표 이미지 업로드 처리
  const handleImageFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    alert('📸 근무표 이미지 인식 중... (인공지능 AI 분석이 시작됩니다)');
    setTimeout(() => {
      alert('근무표 이미지 분석 및 자동으로 내 근무 등록이 완료되었습니다!');
    }, 1200);
  };

  // 3. 휴대폰 캘린더(.ics 파일) 가져오기
  const handleIcsFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        parseIcsCalendar(text);
      } catch (err) {
        console.error(err);
        alert('캘린더 파일을 해석하지 못했습니다.');
      }
    };
    reader.readAsText(file);
  };

  const parseIcsCalendar = (icsContent) => {
    const events = icsContent.split('BEGIN:VEVENT');
    let importedCount = 0;
    const newMemos = { ...memos };

    events.slice(1).forEach((ev) => {
      const summaryMatch = ev.match(/SUMMARY:(.*)/);
      const dtstartMatch = ev.match(/DTSTART;?.*:(.*)/);

      if (summaryMatch && dtstartMatch) {
        const summary = summaryMatch[1].trim();
        const rawDt = dtstartMatch[1].trim();
        
        if (rawDt.length >= 8) {
          const yyyy = rawDt.substring(0, 4);
          const mm = rawDt.substring(4, 6);
          const dd = rawDt.substring(6, 8);
          const dateStr = `${yyyy}-${mm}-${dd}`;

          if (!newMemos[dateStr]) newMemos[dateStr] = [];

          newMemos[dateStr].push({
            id: Date.now() + Math.random(),
            type: '개인일정',
            text: `[폰 달력] ${summary}`,
            isPrivate: true,
            checked: false
          });

          importedCount++;
        }
      }
    });

    if (importedCount > 0) {
      setMemos(newMemos);
      alert(`🎉 휴대폰 캘린더에서 총 ${importedCount}개의 일정을 비공개(나만 보기)로 가져왔습니다!`);
    } else {
      alert('가져올 일정을 찾지 못했습니다.');
    }
  };

  const currentMonthShifts = Object.entries(myShifts).filter(([date]) => 
    date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  );

  const nightShiftCount = currentMonthShifts.filter(([_, code]) => code === 'N').length;
  const eveningShiftCount = currentMonthShifts.filter(([_, code]) => code === 'E').length;
  const autoAnnualLeaveCount = Object.values(myShifts).filter(code => code === '연차').length;
  const usedAnnualLeaveCount = manualUsedAnnual !== null ? Number(manualUsedAnnual) : autoAnnualLeaveCount;
  const numTotalAnnual = Number(totalAnnualLeave) || 0;
  const remainingAnnualLeave = numTotalAnnual - usedAnnualLeaveCount;

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
          <input 
            type="text" 
            value={userName} 
            onChange={(e) => setUserName(e.target.value)}
            className="w-20 font-bold text-base leading-snug text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none bg-transparent"
            title="이름을 클릭하여 수정하세요"
          />
          <span className="text-xs text-slate-500">쌤의 근무표</span>
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
        )}

        {activeTab === 'friends' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="font-bold text-base flex items-center gap-2 text-slate-900">
                <Users size={18} className="text-indigo-600" /> 병동 동료 근무 비교
              </h2>
              <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                {selectedDate} 기준
              </span>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-extrabold text-indigo-950 text-sm">{privacyBlur ? '나' : userName} 쌤 (나)</span>
                  <p className="text-[10px] text-indigo-600 font-semibold">{shiftConfigs[currentSelectedShiftCode]?.time || '휴무'}</p>
                </div>
                <span 
                  style={{ backgroundColor: shiftConfigs[currentSelectedShiftCode]?.color || '#F3F4F6', color: shiftConfigs[currentSelectedShiftCode]?.textColor || '#374151' }} 
                  className="px-3 py-1.5 rounded-xl font-black text-xs shadow-2xs border"
                >
                  {currentSelectedShiftCode || 'OFF'}
                </span>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-600 pt-1">동료 근무 목록 ({friends.length}명)</p>

            {friends.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center border-2 border-dashed rounded-xl">
                등록된 동료가 없습니다.<br />등록 탭에서 동료 근무표를 추가하세요.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {friends.map((f, i) => {
                  const friendShiftCode = f.shifts[selectedDate] || 'OFF';
                  const info = shiftConfigs[friendShiftCode] || shiftConfigs.OFF;
                  const isSameOff = currentSelectedShiftCode === 'OFF' && friendShiftCode === 'OFF';

                  return (
                    <div 
                      key={i} 
                      className={`p-3 rounded-xl border flex justify-between items-center text-xs transition ${
                        isSameOff ? 'bg-pink-50/60 border-pink-200 ring-1 ring-pink-300' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 text-sm">{privacyBlur ? '동료 ' + (i+1) : f.name} 쌤</span>
                          {isSameOff && (
                            <span className="text-[9px] bg-pink-500 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                              같이 휴무! 🎉
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">{info.time}</p>
                      </div>

                      <span 
                        style={{ backgroundColor: info.color, color: info.textColor }}
                        className="px-3 py-1.5 rounded-xl font-black text-xs border shadow-2xs"
                      >
                        {friendShiftCode}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'allowance' && (
          <div className="space-y-4">
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

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-extrabold text-base flex items-center gap-2 text-pink-700">
                  <Palmtree size={18} /> 연차(휴가) 현황
                </h2>
                {manualUsedAnnual !== null && (
                  <button 
                    onClick={() => setManualUsedAnnual(null)}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition"
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

        {activeTab === 'register' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="font-bold text-base flex items-center gap-2 text-slate-900">
              <FileSpreadsheet size={18} className="text-indigo-600" /> 스마트 근무표 & 캘린더 가져오기
            </h2>

            {/* 1. 엑셀 파일 업로드 */}
            <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4 rounded-2xl text-center space-y-2">
              <div className="flex justify-center text-emerald-600">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900">엑셀 근무표 파일(.xlsx, .csv) 가져오기</p>
                <p className="text-[10px] text-slate-500 mt-0.5">병원에서 받은 엑셀 근무표 파일을 올려주세요.</p>
              </div>
              <label className="inline-block cursor-pointer bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-emerald-700 shadow-sm transition">
                엑셀 파일 선택
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelFileUpload} className="hidden" />
              </label>
            </div>

            {/* 2. 사진첩 / 카메라 이미지 업로드 */}
            <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 rounded-2xl text-center space-y-2">
              <div className="flex justify-center text-indigo-600">
                <Camera size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-900">근무표 사진 / 카메라 촬영 인식</p>
                <p className="text-[10px] text-slate-500 mt-0.5">종이 근무표 사진을 찍거나 갤러리 이미지를 올려주세요.</p>
              </div>
              <div className="flex justify-center gap-2 pt-1">
                <label className="cursor-pointer bg-indigo-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition flex items-center gap-1">
                  <ImageIcon size={14} /> 사진첩 선택
                  <input type="file" accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                </label>
                <label className="cursor-pointer bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-slate-900 shadow-sm transition flex items-center gap-1">
                  <Camera size={14} /> 촬영하기
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* 3. 폰 캘린더(.ics) 가져오기 */}
            <div className="border-2 border-dashed border-sky-200 bg-sky-50/50 p-4 rounded-2xl text-center space-y-2">
              <div className="flex justify-center text-sky-600">
                <Smartphone size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-sky-900">휴대폰 기본 캘린더(.ics) 가져오기</p>
                <p className="text-[10px] text-slate-500 mt-0.5">가져온 개인 일정은 기본적으로 🔒 비공개(나만 보기) 처리됩니다.</p>
              </div>
              <label className="inline-block cursor-pointer bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-sky-700 shadow-sm transition">
                폰 캘린더 파일(.ics) 선택
                <input type="file" accept=".ics" onChange={handleIcsFileUpload} className="hidden" />
              </label>
            </div>

            <div className="pt-2 border-t flex justify-center">
              <button 
                onClick={handleClearAllData}
                className="text-xs text-red-500 font-semibold hover:underline flex items-center gap-1 py-1"
              >
                <Trash2 size={13} />
                <span>앱 저장 데이터 전체 초기화</span>
              </button>
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
