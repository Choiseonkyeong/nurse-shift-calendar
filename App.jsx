import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, Heart, PlusCircle, AlertTriangle, 
  DollarSign, RefreshCw, Bell, Lock, Shield, Eye, EyeOff, 
  Share2, FileSpreadsheet, Check, CheckSquare, Square, Trash2
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
    '2026-09-10': 'N', '2026-09-11': 'N', '2026-09-12': 'OFF', '2026-09-13': 'OFF', '2026-09-14': 'D'
  });
  const [friends, setFriends] = useState([
    { name: '김민지', shifts: { '2026-09-05': 'OFF', '2026-09-06': 'OFF', '2026-09-09': 'E' } },
    { name: '정수진', shifts: { '2026-09-05': 'OFF', '2026-09-12': 'OFF', '2026-09-09': 'N' } }
  ]);
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [pastedText, setPastedText] = useState('');

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
    alert('근무표가 등록되었습니다!');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28">
      {/* Top Header */}
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">
            {privacyBlur ? '*' : userName[0]}
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">간호 근무표 & 메이트</h1>
            <p className="text-xs text-slate-500">병동 스마트 일정 관리자</p>
          </div>
        </div>
        <button 
          onClick={() => setPrivacyBlur(!privacyBlur)}
          className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200"
        >
          {privacyBlur ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </header>

      {/* Main Container */}
      <main className="p-4 max-w-md mx-auto space-y-4">
        {/* Tab 1: My Shift */}
        {activeTab === 'my-shift' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg">{baseMonth} 근무표</span>
                <input 
                  type="month" 
                  value={baseMonth} 
                  onChange={(e) => setBaseMonth(e.target.value)}
                  className="text-sm border rounded-lg p-1"
                />
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {Object.entries(SHIFT_TYPES).map(([code, info]) => (
                  <div key={code} style={{ backgroundColor: info.color, color: info.textColor }} className="p-2 rounded-xl font-bold">
                    <div>{code}</div>
                    <div className="text-[10px] opacity-80">
                      {Object.values(myShifts).filter(c => c === code).length}건
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Simple Grid Calendar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 mb-2">
                <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Object.entries(myShifts).map(([dateStr, code]) => {
                  const dayNum = dateStr.split('-')[2];
                  const info = SHIFT_TYPES[code] || SHIFT_TYPES.OFF;
                  return (
                    <div 
                      key={dateStr} 
                      style={{ backgroundColor: info.color, color: info.textColor }}
                      className="aspect-square rounded-xl flex flex-col items-center justify-center p-1 text-xs font-bold"
                    >
                      <span className="text-[10px] opacity-70">{parseInt(dayNum, 10)}</span>
                      <span>{code}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Friends */}
        {activeTab === 'friends' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2"><Users size={18} /> 동료 근무 현황</h2>
            {friends.map((f, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center">
                <span className="font-bold">{privacyBlur ? '동료 ' + (i+1) : f.name}</span>
                <span className="text-xs text-slate-500">동기화 완료</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Off Match */}
        {activeTab === 'off' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2 text-pink-600"><Heart size={18} /> 같이 쉬는 날 (OFF)</h2>
            <div className="p-3 bg-pink-50 text-pink-700 rounded-xl text-sm font-medium">
              🎉 <strong>9월 5일(토)</strong>: {privacyBlur ? '사용자' : userName}, 김민지, 정수진 동시 오프!
            </div>
          </div>
        )}

        {/* Tab 4: Register */}
        {activeTab === 'register' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2"><FileSpreadsheet size={18} /> 엑셀 복사/붙여넣기</h2>
            <textarea
              rows={4}
              placeholder="엑셀에서 날짜 행과 근무 코드 행을 복사해 붙여넣으세요."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className="w-full text-xs p-2 border rounded-xl"
            />
            <button 
              onClick={handleParsePaste}
              className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm"
            >
              근무표 파싱 등록
            </button>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation (Made in Bolt 등에 가리지 않도록 충분한 높이 확보) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t z-50 px-4 py-2 pb-6 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1 text-center">
          <button 
            onClick={() => setActiveTab('my-shift')}
            className={`flex flex-col items-center py-1 rounded-xl text-xs font-semibold ${activeTab === 'my-shift' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
          >
            <Calendar size={20} />
            <span>내 근무</span>
          </button>
          <button 
            onClick={() => setActiveTab('friends')}
            className={`flex flex-col items-center py-1 rounded-xl text-xs font-semibold ${activeTab === 'friends' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
          >
            <Users size={20} />
            <span>동료 비교</span>
          </button>
          <button 
            onClick={() => setActiveTab('off')}
            className={`flex flex-col items-center py-1 rounded-xl text-xs font-semibold ${activeTab === 'off' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
          >
            <Heart size={20} />
            <span>오프 맞추기</span>
          </button>
          <button 
            onClick={() => setActiveTab('register')}
            className={`flex flex-col items-center py-1 rounded-xl text-xs font-semibold ${activeTab === 'register' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
          >
            <PlusCircle size={20} />
            <span>등록</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
