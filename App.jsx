import React, { useState } from 'react';
import { 
  Calendar, Users, Heart, AlertTriangle, 
  DollarSign, Eye, EyeOff, FileSpreadsheet, Sparkles, Upload, ChevronLeft, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

const SHIFT_TYPES = {
  D: { name: 'Day', time: '07:30 - 15:30', color: '#FEF08A', textColor: '#854D0E' },
  E: { name: 'Evening', time: '14:30 - 22:30', color: '#FED7AA', textColor: '#9A3412' },
  N: { name: 'Night', time: '21:30 - 08:00', color: '#E0F2FE', textColor: '#075985' },
  OFF: { name: 'Off', time: '휴무', color: '#F3F4F6', textColor: '#374151' },
  연차: { name: 'Annual', time: '연차 휴가', color: '#FBCFE8', textColor: '#9D174D' }
};

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function App() {
  const todayStr = getTodayString();

  const [activeTab, setActiveTab] = useState('my-shift');
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(9); // 기본 9월 선택
  const [userName] = useState('최수민');
  const [selectedDate, setSelectedDate] = useState('2026-09-01');

  // 스와이프 터치 이벤트 상태
  const [touchStartX, setTouchStartX] = useState(null);

  const [myShifts, setMyShifts] = useState({
    // 8월 데이터
    '2026-08-24': 'D', '2026-08-25': 'D', '2026-08-26': 'E', '2026-08-27': 'E', '2026-08-28': 'OFF', 
    '2026-08-29': 'OFF', '2026-08-30': 'OFF', '2026-08-31': 'D',
    // 9월 데이터
    '2026-09-01': 'D', '2026-09-02': 'D', '2026-09-03': 'E', '2026-09-04': 'E', '2026-09-05': 'OFF',
    '2026-09-06': 'OFF', '2026-09-07': 'D', '2026-09-08': 'D', '2026-09-09': 'N', '2026-09-10': 'N',
    '2026-09-11': 'N', '2026-09-12': 'OFF', '2026-09-13': 'OFF', '2026-09-14': 'D', '2026-09-15': 'E',
    '2026-09-16': 'E', '2026-09-17': 'N', '2026-09-18': 'OFF', '2026-09-19': 'OFF', '2026-09-20': 'D',
    '2026-09-21': 'D', '2026-09-22': 'D', '2026-09-23': 'D', '2026-09-24': 'N', '2026-09-25': 'N',
    '2026-09-26': 'E', '2026-09-27': 'E', '2026-09-28': 'N', '2026-09-29': 'OFF', '2026-09-30': 'OFF'
  });

  const [memos, setMemos] = useState({
    '2026-09-01': [
      { id: 1, type: '개인일정', time: '09:00', text: '9월 첫날 병동 일정 확인', checked: false }
    ],
    '2026-09-11': [
      { id: 2, type: '인수인계', time: '21:30', text: '3연나이트 시작 환자 인수인계 주의', checked: false }
    ]
  });

  const [memoText, setMemoText] = useState('');
  const [memoCategory, setMemoCategory] = useState('인수인계');
  const [memoTime, setMemoTime] = useState('');
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const friends = [
    { name: '김민지', shifts: { '2026-09-05': 'OFF', '2026-09-12': 'OFF', '2026-09-11': 'E' } },
    { name: '정수진', shifts: { '2026-09-05': 'OFF', '2026-09-12': 'OFF', '2026-09-11': 'N' } }
  ];

  // 이전 달 이동
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  // 다음 달 이동
  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 터치 스와이프 제스처 핸들러
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    if (diffX > 50) {
      handleNextMonth(); // 왼쪽으로 밀면 다음달
    } else if (diffX < -50) {
      handlePrevMonth(); // 오른쪽으로 밀면 저번달
    }
    setTouchStartX(null);
  };

  // 표준 월별 그리드 생성 함수 (안드로이드 캘린더 동일 방식)
  const generateCalendarDays = () => {
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0);
    
    const startDayOfWeek = firstDayOfMonth.getDay(); // 시작 요일 (0:일 ~ 6:토)
    const daysInMonth = lastDayOfMonth.getDate();

    const days = [];

    // 1. 이전 달 이월 날짜 채우기
    const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDay = prevMonthLastDay - i;
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: prevDay, isCurrentMonth: false });
    }

    // 2. 현재 선택된 달 날짜 채우기 (1일 ~ 말일)
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: true });
    }

    // 3. 다음 달 이월 날짜 채우기 (7열 그리드 맞춤)
    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: false });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
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
  };

  const handleAddMemo = () => {
    if (!memoText.trim()) return;
    setMemos({
      ...memos,
      [selectedDate]: [...(memos[selectedDate] || []), {
        id: Date.now(), type: memoCategory, time: memoTime || '자율', text: memoText, checked: false
      }]
    });
    setMemoText('');
    setMemoTime('');
  };

  // 현재 선택된 달(1일~말일) 근무 통계
  const getShiftCount = (code) => {
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    return Object.entries(myShifts).filter(([d, c]) => c === code && d.startsWith(monthPrefix)).length;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 font-sans">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-inner">
            {privacyBlur ? '*' : userName[0]}
          </div>
          <div>
            <h1 className="font-bold text-base leading-snug text-slate-900">간호 근무표 & 메이트</h1>
            <p className="text-xs text-slate-500">병동 스마트 일정 관리자</p>
          </div>
        </div>
        <button 
          onClick={() => setPrivacyBlur(!privacyBlur)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
        >
          {privacyBlur ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>보안</span>
        </button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {activeTab === 'my-shift' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-start gap-3 text-amber-900 shadow-sm">
              <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold block text-amber-900">3연속 나이트(3N) 피로도 경고</span>
                <p className="text-amber-700 leading-relaxed">2026-09-11 기준 연속 3번째 나이트 근무입니다. 누적 피로에 유의하세요!</p>
              </div>
            </div>

            {/* Shift Summary & Year-Month Navigation */}
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
                <input 
                  type="month" 
                  value={`${currentYear}-${String(currentMonth).padStart(2, '0')}`} 
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m] = e.target.value.split('-').map(Number);
                      setCurrentYear(y);
                      setCurrentMonth(m);
                      setSelectedDate(`${y}-${String(m).padStart(2, '0')}-01`);
                    }
                  }}
                  className="text-xs border rounded-lg p-1.5 text-slate-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                {Object.entries(SHIFT_TYPES).map(([code, info]) => (
                  <div key={code} style={{ backgroundColor: info.color, color: info.textColor }} className="p-2.5 rounded-xl font-bold flex flex-col justify-between shadow-xs">
                    <span className="text-xs">{code}</span>
                    <span className="text-sm mt-1">{getShiftCount(code)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-medium">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-600" />
                  <span>예상 야간/추가 수당</span>
                </div>
                <span className="font-bold text-emerald-700 text-sm">약 160,000 원</span>
              </div>
            </div>

            {/* Standard Calendar Grid (Supports Swipe Gesture) */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2 select-none"
            >
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 pb-2">
                <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
                  const code = myShifts[dateStr] || 'OFF';
                  const info = SHIFT_TYPES[code] || SHIFT_TYPES.OFF;
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === todayStr;

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
                      style={{ backgroundColor: info.color }}
                    >
                      <div className="flex justify-between items-center w-full px-0.5">
                        <span className="text-[10px] font-bold opacity-80" style={{ color: info.textColor }}>
                          {dayNum}
                        </span>
                        {isToday && (
                          <span className="text-[8px] bg-amber-500 text-white font-extrabold px-1 rounded-xs">
                            오늘
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-extrabold pb-0.5 text-center" style={{ color: info.textColor }}>
                        {code}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Memo Section */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-bold text-slate-800 text-sm">
                  📅 {selectedDate} {selectedDate === todayStr ? '(오늘)' : ''} 메모 & 알림
                </span>
                <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-1 rounded-lg">
                  {SHIFT_TYPES[myShifts[selectedDate]]?.name || '근무'} ({SHIFT_TYPES[myShifts[selectedDate]]?.time})
                </span>
              </div>

              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
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
                <div className="flex gap-2">
                  <input 
                    type="time" 
                    value={memoTime} 
                    onChange={(e) => setMemoTime(e.target.value)}
                    className="text-xs border rounded-lg px-2 py-1.5 bg-white"
                  />
                  <input 
                    type="text" 
                    placeholder="메모 내용 입력" 
                    value={memoText} 
                    onChange={(e) => setMemoText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMemo()}
                    className="text-xs border rounded-lg px-2.5 py-1.5 flex-1 bg-white"
                  />
                  <button 
                    onClick={handleAddMemo}
                    className="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-700"
                  >
                    추가
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {(memos[selectedDate] || []).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">등록된 메모나 인수인계 사항이 없습니다.</p>
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
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">{m.type}</span>
                            <span className="font-medium text-slate-500">{m.time}</span>
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
        )}

        {activeTab === 'friends' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2"><Users size={18} className="text-indigo-600" /> 동료 근무 현황</h2>
            <div className="space-y-2">
              {friends.map((f, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">{privacyBlur ? '동료 ' + (i+1) : f.name}</span>
                  <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-lg">동기화 완료</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'off' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2 text-pink-600"><Heart size={18} /> 같이 쉬는 날 (OFF Match)</h2>
            <div className="p-3.5 bg-pink-50 border border-pink-100 text-pink-800 rounded-xl text-xs space-y-1">
              <p className="font-bold text-sm">🎉 9월 5일(토) 동시 휴무!</p>
              <p>{privacyBlur ? '사용자' : userName}, 김민지, 정수진 쌤이 같이 쉬는 날입니다.</p>
            </div>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="font-bold text-base flex items-center gap-2 text-slate-900"><FileSpreadsheet size={18} className="text-indigo-600" /> 근무표 파일/텍스트 등록</h2>

            <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-6 rounded-2xl text-center space-y-2">
              <Upload size={28} className="mx-auto text-indigo-600" />
              <div>
                <p className="text-xs font-bold text-indigo-900">엑셀(.xlsx, .xls) 파일 직접 선택</p>
                <p className="text-[10px] text-slate-500 mt-0.5">병원 근무표 파일을 그대로 올려주세요.</p>
              </div>
              <label className="inline-block cursor-pointer bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition">
                파일 찾기
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-slate-400 text-[11px] font-semibold">또는 엑셀 데이터 복사/붙여넣기</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="space-y-2">
              <textarea
                rows={4}
                placeholder="엑셀 표의 영역을 복사해서 붙여넣으세요."
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
                className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-slate-900 transition"
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
