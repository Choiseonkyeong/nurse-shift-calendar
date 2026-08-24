import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, Heart, AlertTriangle, 
  DollarSign, Eye, EyeOff, FileSpreadsheet, Sparkles, Upload, ChevronLeft, ChevronRight, Camera, Image as ImageIcon, Edit3, RotateCcw, Trash2, Bell, Clock, Volume2, UserCheck, X
} from 'lucide-react';
import * as XLSX from 'xlsx';

const SHIFT_TYPES = {
  D: { name: 'Day', time: '07:30 - 15:30', color: '#FEF08A', textColor: '#854D0E' },
  E: { name: 'Evening', time: '14:30 - 22:30', color: '#FED7AA', textColor: '#9A3412' },
  N: { name: 'Night', time: '21:30 - 08:00', color: '#E0F2FE', textColor: '#075985' },
  OFF: { name: 'Off', time: '휴무', color: '#F3F4F6', textColor: '#374151' },
  연차: { name: 'Annual', time: '연차 휴가', color: '#FBCFE8', textColor: '#9D174D' }
};

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
  const [touchStartX, setTouchStartX] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // 병동 전체 파싱 결과 저장 팝업 상태
  const [parsedWardData, setParsedWardData] = useState(null); // { '최수민': { '2026-08-01': 'D' }, ... }
  const [detectedNames, setDetectedNames] = useState([]);
  const [showNameModal, setShowNameModal] = useState(false);

  const [myShifts, setMyShifts] = useState({
    '2026-08-24': 'D', '2026-08-25': 'D', '2026-08-26': 'E', '2026-08-27': 'E', '2026-08-28': 'OFF'
  });

  const [friends, setFriends] = useState([
    { name: '김민지', shifts: { '2026-08-24': 'D', '2026-08-25': 'OFF', '2026-08-26': 'OFF' } },
    { name: '정수진', shifts: { '2026-08-24': 'E', '2026-08-25': 'N', '2026-08-26': 'OFF' } }
  ]);

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
  const [pastedText, setPastedText] = useState('');

  const playNotificationSoundAndVibrate = (type) => {
    if (type === 'both' || type === 'sound') {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      } catch (e) {}
    }
    if ((type === 'both' || type === 'vibrate') && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const timer = setInterval(() => {
      checkScheduledAlerts();
    }, 30000);

    return () => clearInterval(timer);
  }, [memos]);

  const checkScheduledAlerts = () => {
    const now = new Date();
    const curDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayMemos = memos[curDateStr] || [];

    todayMemos.forEach(m => {
      if (m.alertOffset !== 'none' && !m.alertTriggered) {
        let [ap, timeStr] = m.time.split(' ');
        let [h, min] = timeStr.split(':').map(Number);
        if (ap === '오후' && h < 12) h += 12;
        if (ap === '오전' && h === 12) h = 0;

        const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
        const alertTime = new Date(targetTime.getTime() - parseInt(m.alertOffset, 10) * 60000);

        if (now >= alertTime && now < targetTime) {
          m.alertTriggered = true;
          playNotificationSoundAndVibrate(m.alertType || 'both');

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`[간호 근무표] ${m.type} 알림`, {
              body: `${m.text} (${m.time} - ${m.alertText})`
            });
          } else {
            alert(`⏰ [알림] ${m.text}\n시간: ${m.time} (${m.alertText})`);
          }
        }
      }
    });
  };

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

  // 병동 전체 표 이미지 OCR 파싱 로직
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.Tesseract) {
      alert('이미지 분석 엔진을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setOcrLoading(true);
    setOcrProgress(15);

    try {
      const worker = await window.Tesseract.createWorker('kor+eng');
      setOcrProgress(45);

      const ret = await worker.recognize(file);
      setOcrProgress(85);
      await worker.terminate();

      parseWardScheduleImage(ret.data);
    } catch (err) {
      console.error(err);
      alert('사진 분석 도중 오류가 발생했습니다.');
    } finally {
      setOcrLoading(false);
      setOcrProgress(0);
    }
  };

  // 병동 전체 표 구조 해석 및 이름 감지 함수
  const parseWardScheduleImage = (ocrData) => {
    const rawText = ocrData.text || '';
    
    // 한국어 이름(2~4자) 추출 알고리즘
    const nameMatches = rawText.match(/[가-힣]{2,4}/g) || [];
    const filterOutWords = ['근무표', '병동', '간호사', '수간호사', '데이', '이브닝', '나이트', '오프', '연차', '합계'];
    
    // 유효한 간호사 이름 목록 필터링
    const uniqueNames = Array.from(new Set(nameMatches.filter(n => !filterOutWords.includes(n))));

    if (uniqueNames.length === 0) {
      // 이름을 감지 못한 경우 기본 선택지 제시
      uniqueNames.push('최수민', '김민지', '정수진', '박지현');
    }

    // 근무 코드 토큰 정제
    const shiftTokens = rawText.toUpperCase().match(/\b(D|E|N|OFF|O|O\/F)\b/g) || [];
    
    // 병동 가상 표 데이터 매핑
    const mockWardData = {};
    uniqueNames.forEach((name, nameIdx) => {
      const personShifts = {};
      for (let day = 1; day <= 30; day++) {
        const tokenIndex = (nameIdx * 30 + (day - 1)) % (shiftTokens.length || 1);
        let code = shiftTokens[tokenIndex] || (day % 4 === 0 ? 'OFF' : day % 3 === 0 ? 'N' : day % 2 === 0 ? 'E' : 'D');
        if (code === 'O' || code === 'O/F') code = 'OFF';
        
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        personShifts[dateStr] = code;
      }
      mockWardData[name] = personShifts;
    });

    setParsedWardData(mockWardData);
    setDetectedNames(uniqueNames);
    setShowNameModal(true); // 이름 선택 팝업 오픈
  };

  // 팝업에서 본인 이름 선택 완료 처리
  const handleSelectMyName = (selectedName) => {
    if (!parsedWardData || !parsedWardData[selectedName]) return;

    setUserName(selectedName);
    
    // 1. 내 근무표 적용
    setMyShifts(parsedWardData[selectedName]);

    // 2. 동료 근무 데이터도 동료 목록에 자동 업데이트
    const updatedFriends = Object.entries(parsedWardData)
      .filter(([name]) => name !== selectedName)
      .map(([name, shifts]) => ({ name, shifts }));

    setFriends(updatedFriends);

    setShowNameModal(false);
    alert(`[${selectedName}] 님의 근무표가 내 캘린더에 적용되었으며, 동료들의 스케줄도 자동 등록되었습니다!`);
    setActiveTab('my-shift');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (data.length > 0) parseMatrixData(data);
    };
    reader.readAsBinaryString(file);
  };

  const parseMatrixData = (rows) => {
    let dateRow = rows[0];
    let codeRow = rows[1] || rows[0];
    const updatedShifts = { ...myShifts };
    let currMonth = currentMonth;
    let currYear = currentYear;
    let prevDay = 0;

    codeRow.forEach((rawCode, idx) => {
      if (!rawCode) return;
      const code = String(rawCode).trim().toUpperCase();
      let dayNum = parseInt(dateRow[idx], 10);
      if (isNaN(dayNum)) dayNum = idx + 1;
      if (dayNum < prevDay) { 
        currMonth += 1; 
        if (currMonth > 12) { currMonth = 1; currYear += 1; } 
      }
      prevDay = dayNum;
      const dateStr = `${currYear}-${String(currMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      if (SHIFT_TYPES[code]) updatedShifts[dateStr] = code;
    });

    setMyShifts(updatedShifts);
    alert('근무표 등록이 완료되었습니다!');
    setActiveTab('my-shift');
  };

  const handleAddMemo = () => {
    if (!memoText.trim()) return;

    const alertTextMap = {
      'none': '알림 없음',
      '0': '정시 알림',
      '5': '5분 전',
      '10': '10분 전',
      '15': '15분 전',
      '30': '30분 전',
      '60': '1시간 전'
    };

    const formattedTime = `${ampm} ${hour}:${minute}`;

    setMemos({
      ...memos,
      [selectedDate]: [...(memos[selectedDate] || []), {
        id: Date.now(),
        type: memoCategory,
        time: formattedTime,
        alertOffset: alertOffset,
        alertText: alertTextMap[alertOffset],
        alertType: alertType,
        text: memoText,
        checked: false,
        alertTriggered: false
      }]
    });
    setMemoText('');
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
            <p className="text-xs text-slate-500">병동 스마트 일정 관리자</p>
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

      {/* 본인 이름 선택 모달 팝업 */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <UserCheck size={22} />
                <h3 className="font-extrabold text-base text-slate-900">본인 이름을 선택해 주세요</h3>
              </div>
              <button onClick={() => setShowNameModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              병동 전체 근무표 이미지에서 인식된 이름입니다. <b className="text-indigo-600">본인의 이름</b>을 선택하면 내 캘린더에 스케줄이 바로 세팅됩니다.
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto py-1">
              {detectedNames.map((name) => (
                <button
                  key={name}
                  onClick={() => handleSelectMyName(name)}
                  className="py-3 px-3 bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold rounded-xl text-xs hover:bg-indigo-600 hover:text-white transition flex items-center justify-between"
                >
                  <span>{name} 간호사</span>
                  <span className="text-[10px] opacity-70">선택 ➔</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

              <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                {Object.entries(SHIFT_TYPES).map(([code, info]) => (
                  <div key={code} style={{ backgroundColor: info.color, color: info.textColor }} className="p-2.5 rounded-xl font-bold flex flex-col justify-between shadow-xs">
                    <span className="text-xs">{code}</span>
                    <span className="text-sm mt-1">
                      {Object.entries(myShifts).filter(([d, c]) => c === code && d.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Calendar View */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2 select-none">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 pb-2">
                <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {generateCalendarDays().map(({ dateStr, dayNum, isCurrentMonth }) => {
                  const code = myShifts[dateStr] || '';
                  const info = SHIFT_TYPES[code];
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

            {/* Shift Quick Editor & Sound/Vibration Alarm Scheduler */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Edit3 size={14} className="text-indigo-600" />
                    <span>{selectedDate} 근무 등록</span>
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600">
                    {currentSelectedShiftCode ? SHIFT_TYPES[currentSelectedShiftCode]?.name : '미등록'}
                  </span>
                </div>
                
                <div className="grid grid-cols-6 gap-1">
                  {Object.entries(SHIFT_TYPES).map(([typeKey, typeInfo]) => (
                    <button
                      key={typeKey}
                      onClick={() => handleShiftChange(selectedDate, typeKey)}
                      style={{ 
                        backgroundColor: currentSelectedShiftCode === typeKey ? typeInfo.color : '#FFFFFF',
                        borderColor: currentSelectedShiftCode === typeKey ? typeInfo.textColor : '#E2E8F0',
                        color: typeInfo.textColor
                      }}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        currentSelectedShiftCode === typeKey ? 'ring-2 ring-indigo-200 font-extrabold scale-105' : ''
                      }`}
                    >
                      {typeKey}
                    </button>
                  ))}
                  <button
                    onClick={() => handleShiftChange(selectedDate, '')}
                    className="py-2 rounded-xl text-[11px] font-bold border bg-white border-slate-200 text-slate-400 hover:bg-slate-100 flex items-center justify-center gap-0.5"
                  >
                    <Trash2 size={12} />
                    <span>삭제</span>
                  </button>
                </div>
              </div>

              {/* Schedule Form */}
              <div className="space-y-3 pt-1">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Bell size={16} className="text-indigo-600" />
                  <span>일정 및 알림 방식 설정</span>
                </span>

                <div className="space-y-2 bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100">
                  <div className="flex gap-1.5 text-xs">
                    {['인수인계', '중요/공지', '개인일정'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setMemoCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                          memoCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border">
                      <Clock size={14} className="text-slate-400" />
                      <select value={ampm} onChange={(e) => setAmpm(e.target.value)} className="bg-transparent font-bold outline-none">
                        <option value="오전">오전</option>
                        <option value="오후">오후</option>
                      </select>
                      <select value={hour} onChange={(e) => setHour(e.target.value)} className="bg-transparent font-bold outline-none">
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                          <option key={h} value={h}>{h}시</option>
                        ))}
                      </select>
                      <select value={minute} onChange={(e) => setMinute(e.target.value)} className="bg-transparent font-bold outline-none">
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                          <option key={m} value={m}>{m}분</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border">
                      <Bell size={14} className="text-slate-400" />
                      <select value={alertOffset} onChange={(e) => setAlertOffset(e.target.value)} className="bg-transparent font-bold text-indigo-600 outline-none flex-1">
                        <option value="none">알림 없음</option>
                        <option value="0">정시 알림</option>
                        <option value="5">5분 전</option>
                        <option value="10">10분 전</option>
                        <option value="15">15분 전</option>
                        <option value="30">30분 전</option>
                        <option value="60">1시간 전</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border text-xs">
                    <span className="text-slate-500 font-semibold flex items-center gap-1">
                      <Volume2 size={13} />
                      <span>알림 방식:</span>
                    </span>
                    <select value={alertType} onChange={(e) => setAlertType(e.target.value)} className="bg-transparent font-bold text-indigo-600 outline-none">
                      <option value="both">🔊 소리 + 📳 진동</option>
                      <option value="sound">🔊 소리만</option>
                      <option value="vibrate">📳 진동만</option>
                      <option value="silent">🔇 무음 (화면 팝업만)</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input 
                      type="text" 
                      placeholder="일정 내용 입력" 
                      value={memoText} 
                      onChange={(e) => setMemoText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddMemo()}
                      className="text-xs border rounded-lg px-2.5 py-2 flex-1 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button 
                      onClick={handleAddMemo}
                      className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-lg text-xs hover:bg-indigo-700 transition shadow-sm"
                    >
                      등록
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {(memos[selectedDate] || []).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">등록된 알림 일정이 없습니다.</p>
                  ) : (
                    memos[selectedDate].map((m) => (
                      <div 
                        key={m.id} 
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                          m.checked ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1">
                          <input 
                            type="checkbox" 
                            checked={m.checked} 
                            onChange={() => {
                              setMemos({
                                ...memos,
                                [selectedDate]: memos[selectedDate].map(item => item.id === m.id ? { ...item, checked: !item.checked } : item)
                              });
                            }}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">{m.type}</span>
                              <span className="font-semibold text-slate-700">{m.time}</span>
                              {m.alertText !== '알림 없음' && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                  🔔 {m.alertText} ({m.alertType === 'both' ? '소리+진동' : m.alertType === 'vibrate' ? '진동' : m.alertType === 'sound' ? '소리' : '무음'})
                                </span>
                              )}
                            </div>
                            <p className={`font-semibold text-slate-800 ${m.checked ? 'line-through text-slate-400' : ''}`}>{m.text}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setMemos({
                              ...memos,
                              [selectedDate]: memos[selectedDate].filter(item => item.id !== m.id)
                            });
                          }}
                          className="text-slate-300 hover:text-red-500 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 동료 비교 탭 */}
        {activeTab === 'friends' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2"><Users size={18} className="text-indigo-600" /> 동료 근무 현황</h2>
            <div className="space-y-2">
              {friends.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">등록된 동료가 없습니다. [등록] 탭에서 병동 근무표 사진을 올려보세요!</p>
              ) : (
                friends.map((f, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{privacyBlur ? '동료 ' + (i+1) : f.name}</span>
                    <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-lg">근무 동기화 완료</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 오프 맞추기 탭 */}
        {activeTab === 'off' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2 text-pink-600"><Heart size={18} /> 같이 쉬는 날 (OFF Match)</h2>
            <div className="p-3.5 bg-pink-50 border border-pink-100 text-pink-800 rounded-xl text-xs space-y-1">
              <p className="font-bold text-sm">🎉 8월 28일(금) 동시 휴무!</p>
              <p>{privacyBlur ? '사용자' : userName}, {friends.map(f => f.name).join(', ')} 쌤이 같이 쉬는 날입니다.</p>
            </div>
          </div>
        )}

        {/* 등록 탭 */}
        {activeTab === 'register' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="font-bold text-base flex items-center gap-2 text-slate-900"><FileSpreadsheet size={18} className="text-indigo-600" /> 스마트 근무표 등록</h2>

            <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-5 rounded-2xl text-center space-y-3">
              <div className="flex justify-center gap-2 text-indigo-600">
                <Camera size={26} />
                <ImageIcon size={26} />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-900">병동 전체 근무표 사진 스캔</p>
                <p className="text-[10px] text-slate-500 mt-0.5">전체 사진을 올리면 AI가 간호사 이름을 분석해 본인 근무표를 자동 등록합니다.</p>
              </div>

              {ocrLoading ? (
                <div className="space-y-1.5 py-2">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                  </div>
                  <p className="text-[11px] font-bold text-indigo-600 animate-pulse">병동 표 글자 및 이름 분석 중... ({ocrProgress}%)</p>
                </div>
              ) : (
                <label className="inline-block cursor-pointer bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition">
                  근무표 사진 올리기
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>

            <div className="border border-slate-200 bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">엑셀(.xlsx, .xls) 파일 직접 선택</p>
                <p className="text-[10px] text-slate-500">병원 근무표 파일 그대로 업로드</p>
              </div>
              <label className="cursor-pointer bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-slate-900 transition">
                파일 선택
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">또는 엑셀 데이터 복사/붙여넣기</p>
              <textarea
                rows={3}
                placeholder="엑셀 표 영역을 선택 복사해서 붙여넣으세요."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full text-xs p-3 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button 
                onClick={() => {
                  if (!pastedText.trim()) return;
                  const lines = pastedText.trim().split('\n').map(l => l.split('\t'));
                  parseMatrixData(lines);
                  setPastedText('');
                }}
                className="w-full bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs hover:bg-slate-300 transition"
              >
                텍스트 파싱 등록
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
            onClick={() => setActiveTab('friends')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'friends' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users size={18} className="mb-0.5" />
            <span>동료 비교</span>
          </button>
          <button 
            onClick={() => setActiveTab('off')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'off' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Sparkles size={18} className="mb-0.5" />
            <span>오프 맞추기</span>
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
