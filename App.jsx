import React, { useState } from 'react';
import { 
  Calendar, Users, Heart, PlusCircle, AlertTriangle, 
  DollarSign, Bell, Shield, Eye, EyeOff, Share2, FileSpreadsheet, Lock, Sparkles, Smartphone
} from 'lucide-react';

const SHIFT_TYPES = {
  D: { name: 'Day', time: '07:30 - 15:30', color: '#FEF08A', textColor: '#854D0E' },
  E: { name: 'Evening', time: '14:30 - 22:30', color: '#FED7AA', textColor: '#9A3412' },
  N: { name: 'Night', time: '21:30 - 08:00', color: '#E0F2FE', textColor: '#075985' },
  OFF: { name: 'Off', time: '휴무', color: '#F3F4F6', textColor: '#374151' },
  연차: { name: 'Annual', time: '연차 휴가', color: '#FBCFE8', textColor: '#9D174D' }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('my-shift');
  const [baseMonth, setBaseMonth] = useState('2026-09');
  const [userName, setUserName] = useState('최수민');
  const [myShifts, setMyShifts] = useState({
    '2026-08-26': 'E', '2026-08-27': 'E', '2026-08-28': 'OFF', '2026-08-29': 'OFF', '2026-08-30': 'OFF',
    '2026-08-31': 'D', '2026-09-01': 'D', '2026-09-02': 'D', '2026-09-03': 'E', '2026-09-04': 'E',
    '2026-09-05': 'OFF', '2026-09-06': 'OFF', '2026-09-07': 'D', '2026-09-08': 'D', '2026-09-09': 'N',
    '2026-09-10': 'N', '2026-09-11': 'N', '2026-09-12': 'OFF', '2026-09-13': 'OFF', '2026-09-14': 'D',
    '2026-09-15': 'E', '2026-09-16': 'E', '2026-09-17': 'E', '2026-09-18': 'OFF', '2026-09-19': 'OFF',
    '2026-09-20': 'D', '2026-09-21': 'D', '2026-09-22': 'D', '2026-09-23': 'D', '2026-09-24': 'N', '2026-09-25': 'N'
  });

  const [selectedDate, setSelectedDate] = useState('2026-09-09');
  const [memos, setMemos] = useState({
    '2026-09-09': [
      { id: 1, type: '인수인계', time: '14:00', text: '502호 중증 환자 수혈 및 V/S 체크 예정', alert: '30분전', checked: false },
      { id: 2, type: '중요/공지', time: '16:00', text: '16시 병동 수당/인수인계 컨퍼런스 참석', alert: '알림 없음', checked: true },
      { id: 3, type: '개인일정', time: '18:30', text: '퇴근 후 민지 쌤이랑 저녁 약속', alert: '10분전', checked: false }
    ]
  });

  const [memoText, setMemoText] = useState('');
  const [memoCategory, setMemoCategory] = useState('인수인계');
  const [memoTime, setMemoTime] = useState('');
  const [memoAlert, setMemoAlert] = useState('알림 없음');
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const friends = [
    { name: '김민지', shifts: { '2026-09-05': 'OFF', '2026-09-06': 'OFF', '2026-09-09': 'E' } },
    { name: '정수진', shifts: { '2026-09-05': 'OFF', '2026-09-12': 'OFF', '2026-09-09': 'N' } },
    { name: '박지현', shifts: { '2026-09-05': 'OFF' } },
    { name: '이서연', shifts: { '2026-09-05': 'OFF' } }
  ];

  const handleAddMemo = () => {
    if (!memoText.trim()) return;
    const newEntry = {
      id: Date.now(),
      type: memoCategory,
      time: memoTime || '자율',
      text: memoText,
      alert: memoAlert,
      checked: false
    };
    setMemos({
      ...memos,
      [selectedDate]: [...(memos[selectedDate] || []), newEntry]
    });
    setMemoText('');
    setMemoTime('');
  };

  const handleToggleMemo = (date, id) => {
    setMemos({
      ...memos,
      [date]: memos[date].map(m => m.id === id ? { ...m, checked: !m.checked } : m)
    });
  };

  const handleDeleteMemo = (date, id) => {
    setMemos({
      ...memos,
      [date]: memos[date].filter(m => m.id !== id)
    });
  };

  const handleParsePaste = () => {
    if (!pastedText.trim()) return;
    const lines = pastedText.trim().split('\n').map(l => l.split('\t'));
    let dateRow = lines[0];
    let codeRow = lines[1] || lines[0];
    const [year, month] = baseMonth.split('-').map(Number);
    const updatedShifts = { ...myShifts };
    let currMonth = month - 1;
    let currYear = year;
    let prevDay = 0;

    codeRow.forEach((rawCode, idx) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;
      let dayNum = parseInt(dateRow[idx], 10);
      if (isNaN(dayNum)) dayNum = idx + 1;
      if (dayNum < prevDay) { currMonth += 1; if (currMonth > 12) { currMonth = 1; currYear += 1; } }
      prevDay = dayNum;
      const dateStr = `${currYear}-${String(currMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      if (SHIFT_TYPES[code]) updatedShifts[dateStr] = code;
    });

    setMyShifts(updatedShifts);
    setPastedText('');
    alert('근무표 등록이 완료되었습니다!');
  };

  const getShiftCount = (code) => Object.values(myShifts).filter(c => c === code).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 font-sans">
      {/* Header */}
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
            onClick={() => setPrivacyBlur(!privacyBlur)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            {privacyBlur ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>보안</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 max-w-md mx-auto space-y-4">
        {activeTab === 'my-shift' && (
          <div className="space-y-4">
            {/* Health Alert Notice */}
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-start gap-3 text-amber-900 shadow-sm">
              <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold block text-amber-900">3연속 나이트(3N) 피로도 경고</span>
                <p className="text-amber-700 leading-relaxed">2026-09-11 기준 연속 3번째 나이트 근무입니다. 누적 피로에 유의하세요!</p>
              </div>
            </div>

            {/* Shift Summary Card */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="font-extrabold text-xl text-slate-900">2026년 9월</h2>
                  <span className="inline-block bg-indigo-50 text-indigo-600 text-[11px] px-2 py-0.5 rounded-md font-semibold mt-0.5">26일~25일 주기</span>
                </div>
                <input 
                  type="month" 
                  value={baseMonth} 
                  onChange={(e) => setBaseMonth(e.target.value)}
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

            {/* Main Calendar View */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 pb-2">
                <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {Object.entries(myShifts).map(([dateStr, code]) => {
                  const dayNum = dateStr.split('-')[2];
                  const info = SHIFT_TYPES[code] || SHIFT_TYPES.OFF;
                  const isSelected = dateStr === selectedDate;
                  const dayMemos = memos[dateStr] || [];

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`relative aspect-square rounded-2xl p-1 flex flex-col justify-between transition-all border-2 ${
                        isSelected ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: info.color }}
                    >
                      <div className="flex justify-between items-center w-full px-1">
                        <span className="text-[11px] font-bold opacity-80" style={{ color: info.textColor }}>
                          {parseInt(dayNum, 10)}
                        </span>
                        {dayMemos.length > 0 && (
                          <span className="w-3.5 h-3.5 bg-indigo-600 text-white rounded-full text-[9px] flex items-center justify-center font-extrabold">
                            {dayMemos.length}
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

            {/* Selected Day Memo & Schedule Section */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span>📅 {selectedDate} 메모 & 알림</span>
                </span>
                <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-1 rounded-lg">
                  {SHIFT_TYPES[myShifts[selectedDate]]?.name || '근무'} ({SHIFT_TYPES[myShifts[selectedDate]]?.time})
                </span>
              </div>

              {/* Add Memo Form */}
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

              {/* Memo List */}
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
                          onChange={() => handleToggleMemo(selectedDate, m.id)}
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
                        onClick={() => handleDeleteMemo(selectedDate, m.id)}
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

        {/* Tab 2: Friends */}
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

        {/* Tab 3: Off Match */}
        {activeTab === 'off' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2 text-pink-600"><Heart size={18} /> 같이 쉬는 날 (OFF Match)</h2>
            <div className="p-3.5 bg-pink-50 border border-pink-100 text-pink-800 rounded-xl text-xs space-y-1">
              <p className="font-bold text-sm">🎉 9월 5일(토) 동시 휴무!</p>
              <p>{privacyBlur ? '사용자' : userName}, 김민지, 정수진, 박지현 쌤이 같이 쉬는 날입니다.</p>
            </div>
          </div>
        )}

        {/* Tab 4: Register */}
        {activeTab === 'register' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2 text-slate-900"><FileSpreadsheet size={18} className="text-indigo-600" /> 엑셀 복사/붙여넣기 등록</h2>
            <p className="text-xs text-slate-500">엑셀 표의 날짜 행과 근무 코드 행을 선택해 복사 후 아래 붙여넣으세요.</p>
            <textarea
              rows={5}
              placeholder="엑셀 데이터를 이곳에 붙여넣으세요."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className="w-full text-xs p-3 border rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onClick={handleParsePaste}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl text-xs shadow-md hover:bg-indigo-700 transition"
            >
              근무표 자동 인식 및 등록
            </button>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation */}
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
            <PlusCircle size={18} className="mb-0.5" />
            <span>등록</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
