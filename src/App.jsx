import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Users, Upload, Shield, RotateCcw } from 'lucide-react';
import MyShiftTab from './components/MyShiftTab';
import AllowanceTab from './components/AllowanceTab';
import GroupShareTab from './components/GroupShareTab';
import ImportTab from './components/ImportTab';
import { getTodayDateObj, toDateKey } from './utils/dateUtils';

export default function App() {
  const today = getTodayDateObj();
  const [activeTab, setActiveTab] = useState('myShift');
  
  const [selectedDate, _setSelectedDate] = useState(today.dateStr);
  const setSelectedDate = (raw) => _setSelectedDate(toDateKey(raw));

  const [userName, setUserName] = useState(() => localStorage.getItem('shift_user_name') || '최수민');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);

  const [myShifts, setMyShifts] = useState(() => {
    try {
      const saved = localStorage.getItem('my_shift_data');
      return saved ? JSON.parse(saved) || {} : {};
    } catch (e) {
      return {};
    }
  });

  const [shiftConfigs, setShiftConfigs] = useState(() => {
    try {
      const saved = localStorage.getItem('shift_configs');
      return saved ? JSON.parse(saved) || {} : {
        hourlyWage: 13000,
        vacation: { total: 15, used: 0 },
        shiftTimes: {
          D: { time: '07:30 - 15:30' },
          M: { time: '09:00 - 17:00', nightHours: 0 },
          E: { time: '14:30 - 22:30', nightHours: 0.5 },
          N: { time: '21:30 - 08:00', nightHours: 8 }
        }
      };
    } catch (e) {
      return {};
    }
  });

  const [groups, setGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('my_group_list');
      return saved ? JSON.parse(saved) || [] : [];
    } catch (e) {
      return [];
    }
  });

  const [activeGroupId, setActiveGroupId] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [privacyBlur, setPrivacyBlur] = useState(false);

  useEffect(() => {
    localStorage.setItem('my_shift_data', JSON.stringify(myShifts || {}));
  }, [myShifts]);

  useEffect(() => {
    localStorage.setItem('shift_configs', JSON.stringify(shiftConfigs || {}));
  }, [shiftConfigs]);

  useEffect(() => {
    localStorage.setItem('my_group_list', JSON.stringify(groups || []));
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

  const handleGoToday = () => {
    setSelectedDate(today.dateStr);
  };

  const currentGroup = (groups || []).find(g => g.id === activeGroupId) || (groups || [])[0] || null;

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start sm:py-6 font-sans">
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[840px] sm:rounded-3xl sm:shadow-2xl flex flex-col justify-between overflow-hidden relative border border-slate-200/80">
        
        {/* 1. 상단 프로필 헤더 */}
        <div className="bg-white px-5 py-4 border-b border-slate-100 flex justify-between items-center z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-sm shadow-2xs">
              {userName.substring(0, 1)}
            </div>
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={tempUserName}
                    onChange={(e) => setTempUserName(e.target.value)}
                    className="px-2 py-0.5 text-xs text-slate-800 font-bold rounded border border-slate-300 outline-none w-24"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  />
                  <button onClick={handleSaveName} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded font-bold cursor-pointer">저장</button>
                </div>
              ) : (
                <div className="flex items-center gap-1 cursor-pointer" onClick={() => setIsEditingName(true)}>
                  <h1 className="font-black text-base text-slate-900 leading-tight">{userName} 님의 근무표</h1>
                </div>
              )}
              <p className="text-[11px] font-bold text-slate-400">스마트 일정 & 수당 관리자</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleGoToday}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl text-xs font-black hover:bg-amber-100 transition cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>오늘</span>
            </button>
            <button 
              onClick={() => setPrivacyBlur(!privacyBlur)}
              className={`text-xs px-3 py-1.5 rounded-2xl font-black flex items-center gap-1 border transition cursor-pointer ${
                privacyBlur ? 'bg-amber-400 text-slate-900 border-amber-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Shield size={13} />
              <span>{privacyBlur ? '보안 ON' : '보안'}</span>
            </button>
          </div>
        </div>

        {/* 2. 탭 메인 컨텐츠 영역 (하단 패딩 확보) */}
        <div className="p-4 flex-1 overflow-y-auto bg-slate-50/50 pb-20">
          {activeTab === 'myShift' && (
            <MyShiftTab
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              myShifts={myShifts || {}}
              setMyShifts={setMyShifts}
              shiftConfigs={shiftConfigs}
              userName={userName}
            />
          )}

          {activeTab === 'allowance' && (
            <AllowanceTab
              myShifts={myShifts || {}}
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
              groups={groups || []}
              setGroups={setGroups}
              activeGroupId={activeGroupId}
              setActiveGroupId={setActiveGroupId}
              currentGroup={currentGroup}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              shiftConfigs={shiftConfigs}
              userName={userName}
              myShifts={myShifts || {}}
              privacyBlur={privacyBlur}
            />
          )}

          {activeTab === 'import' && (
            <ImportTab
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              myShifts={myShifts || {}}
              setMyShifts={setMyShifts}
              userName={userName}
              setUserName={setUserName}
            />
          )}
        </div>

        {/* 3. 프레임 바닥에 완벽 밀착시킨 하단 네비게이션 탭 */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-3 py-2 flex justify-around items-center z-50">
          <button
            onClick={() => setActiveTab('myShift')}
            style={
              activeTab === 'myShift'
                ? { backgroundColor: '#EEF2FF', color: '#4F46E5', borderRadius: '16px' }
                : { color: '#94A3B8' }
            }
            className="flex flex-col items-center justify-center py-1.5 px-4 transition-all cursor-pointer"
          >
            <Calendar size={18} className={activeTab === 'myShift' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[11px] font-black mt-0.5">내 근무</span>
          </button>

          <button
            onClick={() => setActiveTab('allowance')}
            style={
              activeTab === 'allowance'
                ? { backgroundColor: '#EEF2FF', color: '#4F46E5', borderRadius: '16px' }
                : { color: '#94A3B8' }
            }
            className="flex flex-col items-center justify-center py-1.5 px-4 transition-all cursor-pointer"
          >
            <DollarSign size={18} className={activeTab === 'allowance' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[11px] font-black mt-0.5">연차/수당</span>
          </button>

          <button
            onClick={() => setActiveTab('groupShare')}
            style={
              activeTab === 'groupShare'
                ? { backgroundColor: '#EEF2FF', color: '#4F46E5', borderRadius: '16px' }
                : { color: '#94A3B8' }
            }
            className="flex flex-col items-center justify-center py-1.5 px-4 transition-all cursor-pointer"
          >
            <Users size={18} className={activeTab === 'groupShare' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[11px] font-black mt-0.5">동료 비교</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            style={
              activeTab === 'import'
                ? { backgroundColor: '#EEF2FF', color: '#4F46E5', borderRadius: '16px' }
                : { color: '#94A3B8' }
            }
            className="flex flex-col items-center justify-center py-1.5 px-4 transition-all cursor-pointer"
          >
            <Upload size={18} className={activeTab === 'import' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[11px] font-black mt-0.5">등록</span>
          </button>
        </div>

      </div>
    </div>
  );
}
