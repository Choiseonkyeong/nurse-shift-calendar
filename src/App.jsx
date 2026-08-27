import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, Calculator, Upload, Eye, EyeOff, ArrowLeftRight, X 
} from 'lucide-react';

import MyShiftTab from './components/MyShiftTab';
import AllowanceTab from './components/AllowanceTab';
import GroupShareTab from './components/GroupShareTab';
import ImportTab from './components/ImportTab';

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

  const [activeTab, setActiveTab] = useState('myShift');
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(9);
  const [selectedDate, setSelectedDate] = useState('2026-09-01');

  const [userName, setUserName] = useState(() => localStorage.getItem('nurse_user_name') || '최수민');
  const [myShifts, setMyShifts] = useState(() => {
    const saved = localStorage.getItem('nurse_my_shifts');
    return saved ? JSON.parse(saved) : {
      '2026-08-26': 'E', '2026-08-27': 'E', '2026-08-28': 'OFF', '2026-08-29': 'OFF', '2026-08-30': 'OFF',
      '2026-08-31': 'D', '2026-09-01': 'D', '2026-09-02': 'D', '2026-09-03': 'E', '2026-09-04': 'E',
      '2026-09-05': 'OFF', '2026-09-06': 'OFF', '2026-09-07': 'D', '2026-09-08': 'D', '2026-09-09': 'N',
      '2026-09-10': 'N', '2026-09-11': 'OFF', '2026-09-12': 'OFF', '2026-09-13': 'D', '2026-09-14': 'D',
      '2026-09-15': 'E', '2026-09-16': 'E', '2026-09-17': 'E', '2026-09-18': 'OFF', '2026-09-19': 'OFF',
      '2026-09-20': 'D', '2026-09-21': 'D', '2026-09-22': 'D', '2026-09-23': 'D', '2026-09-24': 'N',
      '2026-09-25': 'N'
    };
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
  const [nightFixedAllowance, setNightFixedAllowance] = useState(() => localStorage.getItem('nurse_night_fixed') || '25000');
  const [eveningFixedAllowance, setEveningFixedAllowance] = useState(() => localStorage.getItem('nurse_eve_fixed') || '5000');
  const [hourlyWage, setHourlyWage] = useState(() => localStorage.getItem('nurse_hourly_wage') || '13000');

  const [memos, setMemos] = useState(() => {
    const saved = localStorage.getItem('nurse_memos');
    return saved ? JSON.parse(saved) : {};
  });
  const [memoText, setMemoText] = useState('');
  const [isPrivateMemo, setIsPrivateMemo] = useState(false);

  onst [groups, setGroups] = useState(() => {
  const saved = localStorage.getItem('nurse_groups');
  return saved ? JSON.parse(saved) : [
    { 
      id: 'g1', 
      name: '5병동 동기들', 
      code: 'W5ALL1', 
      members: [
        { name: userName, shifts: myShifts, memos: memos, isMe: true }
        
      ] 
    }
  ];
});
  const [activeGroupId, setActiveGroupId] = useState(() => localStorage.getItem('nurse_active_group_id') || 'g1');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [privacyBlur, setPrivacyBlur] = useState(false);

  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapPartner, setSwapPartner] = useState('김민지');
  const [swapTargetDate, setSwapTargetDate] = useState(selectedDate);

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
  useEffect(() => { localStorage.setItem('nurse_groups', JSON.stringify(groups)); }, [groups]);
  useEffect(() => { localStorage.setItem('nurse_active_group_id', activeGroupId); }, [activeGroupId]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
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
    setShiftConfigs(prev => ({ ...prev, [code]: { ...prev[code], [key]: value } }));
  };

  const handleAddMemo = () => {
    if (!memoText.trim()) return;
    setMemos({
      ...memos,
      [selectedDate]: [...(memos[selectedDate] || []), { id: Date.now(), type: '개인일정', text: memoText, isPrivate: isPrivateMemo }]
    });
    setMemoText('');
    setIsPrivateMemo(false);
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) { alert('그룹 이름을 입력해 주세요.'); return; }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newGroup = {
      id: `group_${Date.now()}`,
      name: newGroupName.trim(),
      code: code,
      members: [{ name: userName, shifts: myShifts, memos: memos, isMe: true }]
    };
    setGroups(prev => [...prev, newGroup]);
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
    alert(`🎉 그룹 '${newGroup.name}' 생성 완료!\n초대 코드: [ ${code} ]`);
  };

  const handleJoinGroup = () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) { alert('초대 코드를 입력해 주세요.'); return; }
    const existing = groups.find(g => g.code === code);
    if (existing) {
      setActiveGroupId(existing.id);
      setJoinCodeInput('');
      alert(`'${existing.name}' 그룹에 참여했습니다.`);
    } else {
      const joined = {
        id: `group_${Date.now()}`,
        name: `공유 그룹 (${code})`,
        code: code,
        members: [
          { name: userName, shifts: myShifts, memos: memos, isMe: true },
          { name: '동료 쌤', shifts: { [selectedDate]: 'N' }, memos: {}, isMe: false }
        ]
      };
      setGroups(prev => [...prev, joined]);
      setActiveGroupId(joined.id);
      setJoinCodeInput('');
      alert(`🎉 초대 코드 [ ${code} ] 그룹에 정상적으로 참여했습니다!`);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleExecuteShiftSwap = () => {
    const myCode = myShifts[swapTargetDate] || 'OFF';
    const partnerCode = 'E';
    setMyShifts(prev => ({ ...prev, [swapTargetDate]: partnerCode }));
    setIsSwapModalOpen(false);
    alert(`🔄 ${swapTargetDate} ${swapPartner} 선생님과의 근무 교대(${myCode} ⇄ ${partnerCode})가 완료되었습니다.`);
  };

  const currentMonthShifts = Object.entries(myShifts).filter(([date]) => date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`));
  const nightShiftCount = currentMonthShifts.filter(([_, code]) => code === 'N').length;
  const eveningShiftCount = currentMonthShifts.filter(([_, code]) => code === 'E').length;
  const autoAnnualLeaveCount = Object.values(myShifts).filter(code => code === '연차').length;
  const usedAnnualLeaveCount = manualUsedAnnual !== null ? Number(manualUsedAnnual) : autoAnnualLeaveCount;
  const remainingAnnualLeave = (Number(totalAnnualLeave) || 0) - usedAnnualLeaveCount;

  const numNightFixed = Number(String(nightFixedAllowance).replace(/[^0-9]/g, '')) || 0;
  const numEveFixed = Number(String(eveningFixedAllowance).replace(/[^0-9]/g, '')) || 0;
  const numHourlyWage = Number(String(hourlyWage).replace(/[^0-9]/g, '')) || 0;
  const totalNightHours = (nightShiftCount * (Number(shiftConfigs.N?.nightHours) || 0)) + (eveningShiftCount * (Number(shiftConfigs.E?.nightHours) || 0));

  const estimatedAllowance = calcMode === 'fixed'
    ? (nightShiftCount * numNightFixed) + (eveningShiftCount * numEveFixed)
    : Math.round(totalNightHours * numHourlyWage * 0.5);

  const currentGroup = groups.find(g => g.id === activeGroupId);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col max-w-md mx-auto shadow-2xl relative font-sans text-slate-800 pb-20">
      <header className="bg-white px-4 py-3 border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
            N
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-900 leading-none">{privacyBlur ? '***' : userName} 님의 근무표</h1>
            <span className="text-[9px] font-bold text-slate-400">3교대 수당/연차/그룹 공유</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsSwapModalOpen(true)}
            className="p-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-100 transition"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>맞교대</span>
          </button>

          <button
            onClick={() => setPrivacyBlur(!privacyBlur)}
            className={`p-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all ${
              privacyBlur ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            {privacyBlur ? <EyeOff className="w-3.5 h-3.5 text-rose-600" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{privacyBlur ? '보안 ON' : '보안'}</span>
          </button>
        </div>
      </header>

      <main className="p-3.5 space-y-3.5 flex-1 overflow-y-auto">
        {activeTab === 'myShift' && (
          <MyShiftTab
            currentYear={currentYear}
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            handlePrevMonth={handlePrevMonth}
            handleNextMonth={handleNextMonth}
            shiftConfigs={shiftConfigs}
            myShifts={myShifts}
            memos={memos}
            today={today}
            handleShiftChange={handleShiftChange}
            memoText={memoText}
            setMemoText={setMemoText}
            isPrivateMemo={isPrivateMemo}
            setIsPrivateMemo={setIsPrivateMemo}
            handleAddMemo={handleAddMemo}
            setMemos={setMemos}
          />
        )}

        {activeTab === 'allowance' && (
          <AllowanceTab
            shiftConfigs={shiftConfigs}
            handleConfigChange={handleConfigChange}
            manualUsedAnnual={manualUsedAnnual}
            setManualUsedAnnual={setManualUsedAnnual}
            totalAnnualLeave={totalAnnualLeave}
            setTotalAnnualLeave={setTotalAnnualLeave}
            autoAnnualLeaveCount={autoAnnualLeaveCount}
            remainingAnnualLeave={remainingAnnualLeave}
            currentMonth={currentMonth}
            calcMode={calcMode}
            setCalcMode={setCalcMode}
            nightShiftCount={nightShiftCount}
            eveningShiftCount={eveningShiftCount}
            numNightFixed={numNightFixed}
            setNightFixedAllowance={setNightFixedAllowance}
            numEveFixed={numEveFixed}
            setEveningFixedAllowance={setEveningFixedAllowance}
            numHourlyWage={numHourlyWage}
            setHourlyWage={setHourlyWage}
            estimatedAllowance={estimatedAllowance}
          />
        )}

        {activeTab === 'groupShare' && (
          <GroupShareTab
            newGroupName={newGroupName}
            setNewGroupName={setNewGroupName}
            handleCreateGroup={handleCreateGroup}
            joinCodeInput={joinCodeInput}
            setJoinCodeInput={setJoinCodeInput}
            handleJoinGroup={handleJoinGroup}
            groups={groups}
            activeGroupId={activeGroupId}
            setActiveGroupId={setActiveGroupId}
            currentGroup={currentGroup}
            handleCopyCode={handleCopyCode}
            copiedCode={copiedCode}
            selectedDate={selectedDate}
            shiftConfigs={shiftConfigs}
            userName={userName}
            privacyBlur={privacyBlur}
          />
        )}

        {activeTab === 'import' && (
          <ImportTab
            setMyShifts={setMyShifts}
            setUserName={setUserName}
            handleClearAllData={() => {
              if (window.confirm('모든 근무 및 일정 데이터를 초기화하시겠습니까?')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
          />
        )}
      </main>

      {isSwapModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">맞교대 (스왑) 시뮬레이터</h3>
              </div>
              <button onClick={() => setIsSwapModalOpen(false)} className="text-slate-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">교대 대상 동료 선택:</label>
                <select
                  value={swapPartner}
                  onChange={(e) => setSwapPartner(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="김민지">김민지 (3년차 동기)</option>
                  <option value="박지현">박지현 (5년차 선배)</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">교대 교환 날짜:</label>
                <input
                  type="date"
                  value={swapTargetDate}
                  onChange={(e) => setSwapTargetDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
                <span className="text-[10px] font-extrabold text-emerald-900 block">🔄 교환 시 근무 변화 예시:</span>
                <div className="text-[11px] text-emerald-800 flex justify-between font-bold">
                  <span>나 ({userName}): {myShifts[swapTargetDate] || 'OFF'} ➔ E</span>
                </div>
                <div className="text-[11px] text-emerald-800 flex justify-between font-bold">
                  <span>동료 ({swapPartner}): E ➔ {myShifts[swapTargetDate] || 'OFF'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleExecuteShiftSwap}
              className="w-full py-2.5 bg-emerald-600 text-white font-extrabold text-xs rounded-xl hover:bg-emerald-700 shadow-md"
            >
              근무 교대 확정 및 적용
            </button>
          </div>
        </div>
      )}

      <nav className="bg-white/95 backdrop-blur-md border-t border-slate-200 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 flex justify-around py-2 px-1">
        <button
          onClick={() => setActiveTab('myShift')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            activeTab === 'myShift' ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">내 근무</span>
        </button>

        <button
          onClick={() => setActiveTab('allowance')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            activeTab === 'allowance' ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold'
          }`}
        >
          <Calculator className="w-5 h-5" />
          <span className="text-[10px]">연차/수당</span>
        </button>

        <button
          onClick={() => setActiveTab('groupShare')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            activeTab === 'groupShare' ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">그룹 공유</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            activeTab === 'import' ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold'
          }`}
        >
          <Upload className="w-5 h-5" />
          <span className="text-[10px]">등록</span>
        </button>
      </nav>
    </div>
  );
}
