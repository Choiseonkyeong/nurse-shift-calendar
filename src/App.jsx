import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Users, Upload, Shield } from 'lucide-react';
import MyShiftTab from './components/MyShiftTab';
import AllowanceTab from './components/AllowanceTab';
import GroupShareTab from './components/GroupShareTab';
import ImportTab from './components/ImportTab';
import { getTodayDateObj, toDateKey } from './utils/dateUtils';

export default function App() {
  const today = getTodayDateObj();
  const [activeTab, setActiveTab] = useState('myShift');
  
  // selectedDate는 어떤 값이 넘어와도 무조건 'YYYY-MM-DD' 10자리 표준 키로 정규화
  const [selectedDate, _setSelectedDate] = useState(today.dateStr);
  const setSelectedDate = (raw) => _setSelectedDate(toDateKey(raw));

  const [userName, setUserName] = useState(() => localStorage.getItem('shift_user_name') || '홍숙언');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);

  const [myShifts, setMyShifts] = useState(() => {
    const saved = localStorage.getItem('my_shift_data');
    return saved ? JSON.parse(saved) : {};
  });

  const [shiftConfigs, setShiftConfigs] = useState(() => {
    const saved = localStorage.getItem('shift_configs');
    return saved ? JSON.parse(saved) : {
      D: { name: 'Day', start: '07:00', end: '15:30', pay: 100000, color: '#F59E0B' },
      E: { name: 'Evening', start: '15:00', end: '23:00', pay: 110000, color: '#F97316' },
      N: { name: 'Night', start: '22:30', end: '07:30', pay: 150000, color: '#0284C7' },
      OFF: { name: '휴무', start: '', end: '', pay: 0, color: '#94A3B8' }
    };
  });

  const [groups, setGroups] = useState(() => {
    const saved = localStorage.getItem('my_group_list');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeGroupId, setActiveGroupId] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [privacyBlur, setPrivacyBlur] = useState(false);

  useEffect(() => {
    localStorage.setItem('my_shift_data', JSON.stringify(myShifts));
  }, [myShifts]);

  useEffect(() => {
    localStorage.setItem('shift_configs', JSON.stringify(shiftConfigs));
  }, [shiftConfigs]);

  useEffect(() => {
    localStorage.setItem('my_group_list', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('shift_user_name', userName);
  }, [userName]);

  const handleSaveName = () => {
    if (tempUserName.trim()) {
      setUserName(tempUserName.trim());
      setIsEditingName(false);
    }
  };

  const currentGroup = groups.find(g => g.id === activeGroupId) || groups[0] || null;

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start sm:py-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-0 sm:rounded-3xl sm:shadow-2xl flex flex-col justify-between overflow-hidden relative">
        
        {/* 상단 프로필 헤더 */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 pt-6 rounded-b-3xl shadow-md">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center font-bold text-lg border border-white/30">
                {userName.substring(0, 1)}
              </div>
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempUserName}
                      onChange={(e) => setTempUserName(e.target.value)}
                      className="px-2 py-0.5 text-xs text-slate-800 font-bold rounded bg-white outline-none w-24"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    />
                    <button onClick={handleSaveName} className="text-[10px] bg-white/30 px-2 py-1 rounded font-bold hover:bg-white/40">저장</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 cursor-pointer" onClick={() => setIsEditingName(true)}>
                    <h1 className="font-extrabold text-base leading-tight">{userName} 님의 근무표</h1>
                    <span className="text-[10px] opacity-70">✏️</span>
                  </div>
                )}
                <p className="text-[11px] opacity-80 font-medium">3교대 수당/병동그룹 공유</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setPrivacyBlur(!privacyBlur)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border transition ${
                  privacyBlur ? 'bg-amber-400 text-slate-900 border-amber-300' : 'bg-white/10 text-white border-white/20'
                }`}
              >
                <Shield size={12} />
                <span>{privacyBlur ? '보안 ON' : '보안'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 메인 탭 뷰 영역 */}
        <div className="p-4 flex-1 pb-20 overflow-y-auto">
          {activeTab === 'myShift' && (
            <MyShiftTab
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              myShifts={myShifts}
              setMyShifts={setMyShifts}
              shiftConfigs={shiftConfigs}
            />
          )}

          {activeTab === 'allowance' && (
            <AllowanceTab
              myShifts={myShifts}
              shiftConfigs={shiftConfigs}
              setShiftConfigs={setShiftConfigs}
              selectedDate={selectedDate}
            />
          )}

          {activeTab === 'groupShare' && (
            <GroupShareTab
              newGroupName={newGroupName}
              setNewGroupName={setNewGroupName}
              joinCodeInput={joinCodeInput}
              setJoinCodeInput={setJoinCodeInput}
              groups={groups}
              setGroups={setGroups}
              activeGroupId={activeGroupId}
              setActiveGroupId={setActiveGroupId}
              currentGroup={currentGroup}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              shiftConfigs={shiftConfigs}
              userName={userName}
              myShifts={myShifts}
              privacyBlur={privacyBlur}
            />
          )}

          {activeTab === 'import' && (
            <ImportTab
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              myShifts={myShifts}
              setMyShifts={setMyShifts}
              userName={userName}
            />
          )}
        </div>

        {/* 하단 네비게이션 바 */}
        <div className="fixed bottom-0 max-w-md w-full bg-white border-t border-slate-200 px-6 py-2.5 flex justify-between items-center shadow-lg rounded-t-2xl z-50">
          <button
            onClick={() => setActiveTab('myShift')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'myShift' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-semibold'}`}
          >
            <Calendar size={20} />
            <span className="text-[11px]">내 근무</span>
          </button>

          <button
            onClick={() => setActiveTab('allowance')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'allowance' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-semibold'}`}
          >
            <DollarSign size={20} />
            <span className="text-[11px]">연차/수당</span>
          </button>

          <button
            onClick={() => setActiveTab('groupShare')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'groupShare' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-semibold'}`}
          >
            <Users size={20} />
            <span className="text-[11px]">그룹 공유</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`flex flex-col items-center gap-1 transition ${activeTab === 'import' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-semibold'}`}
          >
            <Upload size={20} />
            <span className="text-[11px]">등록</span>
          </button>
        </div>

      </div>
    </div>
  );
}
