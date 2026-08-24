import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, Heart, AlertTriangle, 
  DollarSign, Eye, EyeOff, FileSpreadsheet, Sparkles, Upload, ChevronLeft, ChevronRight, Camera, Image as ImageIcon, Edit3, RotateCcw, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';

const SHIFT_TYPES = {
  D: { name: 'Day', time: '07:30 - 15:30', color: '#FEF08A', textColor: '#854D0E' },
  E: { name: 'Evening', time: '14:30 - 22:30', color: '#FED7AA', textColor: '#9A3412' },
  N: { name: 'Night', time: '21:30 - 08:00', color: '#E0F2FE', textColor: '#075985' },
  OFF: { name: 'Off', time: '휴무', color: '#F3F4F6', textColor: '#374151' },
  연차: { name: 'Annual', time: '연차 휴가', color: '#FBCFE8', textColor: '#9D174D' }
};

// 현재 실시간 오늘 날짜 정보 계산
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
  
  // 무조건 오늘 년/월로 첫 화면 기준 설정
  const [currentYear, setCurrentYear] = useState(today.year);
  const [currentMonth, setCurrentMonth] = useState(today.month);
  const [selectedDate, setSelectedDate] = useState(today.dateStr);

  const [userName] = useState('최수민');
  const [touchStartX, setTouchStartX] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // 기본 스케줄 세팅
  const [myShifts, setMyShifts] = useState({
    '2026-08-24': 'D', '2026-08-25': 'D', '2026-08-26': 'E', '2026-08-27': 'E', '2026-08-28': 'OFF', 
    '2026-08-29': 'OFF', '2026-08-30': 'OFF', '2026-08-31': 'D',
    '2026-09-01': 'D', '2026-09-02': 'D', '2026-09-03': 'E', '2026-09-04': 'E', '2026-09-05': 'OFF',
    '2026-09-06': 'OFF', '2026-09-07': 'D', '2026-09-08': 'D', '2026-09-09': 'N', '2026-09-10': 'N'
  });

  const [memos, setMemos] = useState({
    [today.dateStr]: [
      { id: 1, type: '인수인계', time: '08:00', text: '오늘 스케줄 및 병동 상태 확인', checked: false }
    ]
  });

  const [memoText, setMemoText] = useState('');
  const [memoCategory, setMemoCategory] = useState('인수인계');
  const [memoTime, setMemoTime] = useState('');
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const friends = [
    { name: '김민지', shifts: { '2026-08-24': 'D', '2026-08-25': 'OFF' } },
    { name: '정수진', shifts: { '2026-08-24': 'E', '2026-08-25': 'N' } }
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1); } 
    else { setCurrentMonth(currentMonth - 1); }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1); } 
    else { setCurrentMonth(currentMonth + 1); }
  };

  // 오늘 날짜로 즉시 이동하는 버튼 처리
  const handleGoToToday = () => {
    setCurrentYear(today.year);
    setCurrentMonth(today.month);
    setSelectedDate(today.dateStr);
  };

  const handleTouchStart = (e) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (!touchStartX) return;
    const diffX = touchStartX - e.changedTouches[0].clientX;
    if (diffX > 50) handleNextMonth();
    else if (diffX < -50) handlePrevMonth();
    setTouchStartX(null);
  };

  // 터치한 날짜의 근무 변경 및 삭제 처리
  const handleShiftChange = (dateStr, newCode) => {
    setMyShifts(prev => {
      const updated = { ...prev };
      if (newCode === '' || newCode === null) {
        delete updated[dateStr]; // 아무것도 없는 빈칸(삭제)으로 처리
      } else {
        updated[dateStr] = newCode;
      }
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.Tesseract) {
      alert('이미지 분석 엔진을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setOcrLoading(true);
    setOcrProgress(10);

    try {
      const worker = await window.Tesseract.createWorker('eng');
      setOcrProgress(40);
      const ret = await worker.recognize(file);
      setOcrProgress(80);
      await worker.terminate();

      parseImageText(ret.data.text);
    } catch (err) {
      console.error(err);
      alert('사진을 읽는 도중 오류가 발생했습니다.');
    } finally {
      setOcrLoading(false);
      setOcrProgress(0);
    }
  };

  const parseImageText = (rawText) => {
    const tokens = rawText.toUpperCase().match(/\b(D|E|N|OFF|O|O\/F)\b/g);
    if (!tokens || tokens.length === 0) {
      alert('사진에서 근무 코드를 인식하지 못했습니다.');
      return;
    }

    const updatedShifts = { ...myShifts };
    let dayCounter = 1;

    tokens.forEach((token) => {
      let code = token;
      if (code === 'O' || code === 'O/F') code = 'OFF';
      
      if (SHIFT_TYPES[code] && dayCounter <= 31) {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayCounter).padStart(2, '0')}`;
        updatedShifts[dateStr] = code;
        dayCounter++;
      }
    });

    setMyShifts(updatedShifts);
    alert(`사진 분석 완료! 총 ${dayCounter - 1}일 치의 근무가 등록되었습니다.`);
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

  const getShiftCount = (code) => {
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    return Object.entries(myShifts).filter(([d, c]) => c === code && d.startsWith(monthPrefix)).length;
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
            <h1 className="font-bold text-base leading-snug text-slate-900">간호 근무표 & 메이트</h1>
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

            {/* Calendar View */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2 select-none"
            >
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

            {/* Shift Quick Editor (Including Clear/Delete Option) */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Edit3 size={14} className="text-indigo-600" />
                    <span>{selectedDate} 근무 등록 및 수정</span>
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600">
                    상태: {currentSelectedShiftCode ? SHIFT_TYPES[currentSelectedShiftCode]?.name : '미등록 (빈칸)'}
                  </span>
                </div>
                
                {/* D, E, N, OFF, 연차 + 삭제(빈칸) 버튼 배열 */}
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
                      className={`py-2 rounded-xl text-xs font-bold border transition shadow-xs ${
                        currentSelectedShiftCode === typeKey ? 'ring-2 ring-indigo-200 font-extrabold scale-105' : 'hover:bg-slate-100'
                      }`}
                    >
                      {typeKey}
                    </button>
                  ))}

                  {/* 미등록(삭제) 전용 버튼 */}
                  <button
                    onClick={() => handleShiftChange(selectedDate, '')}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition flex items-center justify-center gap-0.5 ${
                      !currentSelectedShiftCode 
                        ? 'bg-rose-50 border-rose-300 text-rose-600 ring-2 ring-rose-200 font-extrabold' 
                        : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <Trash2 size={12} />
                    <span>삭제</span>
                  </button>
                </div>
              </div>

              {/* Memo Section */}
              <div className="flex justify-between items-center border-b pb-2 pt-1">
                <span className="font-bold text-slate-800 text-sm">
                  📅 메모 & 알림
                </span>
                <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-1 rounded-lg">
                  {currentSelectedShiftCode ? `${SHIFT_TYPES[currentSelectedShiftCode]?.name} (${SHIFT_TYPES[currentSelectedShiftCode]?.time})` : '근무 없음'}
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
              <p className="font-bold text-sm">🎉 8월 25일(화) 동시 휴무!</p>
              <p>{privacyBlur ? '사용자' : userName}, 김민지 쌤이 같이 쉬는 날입니다.</p>
            </div>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="font-bold text-base flex items-center gap-2 text-slate-900"><FileSpreadsheet size={18} className="text-indigo-600" /> 스마트 근무표 등록</h2>

            <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-5 rounded-2xl text-center space-y-3">
              <div className="flex justify-center gap-2 text-indigo-600">
                <Camera size={26} />
                <ImageIcon size={26} />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-900">근무표 사진으로 자동 스캔 등록</p>
                <p className="text-[10px] text-slate-500 mt-0.5">갤러리 사진이나 촬영한 사진을 올리면 AI가 글자를 분석합니다.</p>
              </div>

              {ocrLoading ? (
                <div className="space-y-1.5 py-2">
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${ocrProgress}%` }}></div>
                  </div>
                  <p className="text-[11px] font-bold text-indigo-600 animate-pulse">이미지 글자 분석 중... ({ocrProgress}%)</p>
                </div>
              ) : (
                <label className="inline-block cursor-pointer bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition">
                  사진 선택 / 촬영하기
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>

            <div className="border border-slate-200 bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">엑셀(.xlsx) 파일 업로드</p>
                <p className="text-[10px] text-slate-500">엑셀 파일 그대로 등록</p>
              </div>
              <label className="cursor-pointer bg-slate-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg hover:bg-slate-900 transition">
                파일 선택
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="space-y-2">
              <textarea
                rows={3}
                placeholder="엑셀 표 텍스트 복사/붙여넣기"
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
                className="w-full bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs hover:bg-slate-300 transition"
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
