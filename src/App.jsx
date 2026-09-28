import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, DollarSign, Users, Upload, Shield, RotateCcw } from 'lucide-react';
import MyShiftTab from './components/MyShiftTab';
import AllowanceTab from './components/AllowanceTab';
import GroupShareTab from './components/GroupShareTab';
import ImportTab from './components/ImportTab';
import { getTodayDateObj, toDateKey } from './utils/dateUtils';
import { ensureSession, ensureProfile, updateDisplayName, fetchMyShifts, saveShiftChanges, diffShifts, fetchMyShiftTypes, upsertShiftType, deleteShiftType, fetchMyNotes, saveNoteChanges } from './lib/shiftApi';
import { isNativePush, registerDevice, saveReminderSettings } from './lib/pushNotifications';
import { ShiftTypesContext, mergeShiftTypes } from './lib/shiftTypes';

export default function App() {
  const today = getTodayDateObj();
  const [activeTab, setActiveTab] = useState('myShift');
  
  const [selectedDate, _setSelectedDate] = useState(today.dateStr);
  const setSelectedDate = (raw) => _setSelectedDate(toDateKey(raw));

  // 기존 사용자 여부 (레거시 group_shifts 데이터 연결 판단용) — 저장 effect 실행 전에 판정
  const [hadStoredName] = useState(() => localStorage.getItem('shift_user_name') !== null);
  const [userName, setUserName] = useState(() => localStorage.getItem('shift_user_name') || '최수민');
  const [profile, setProfile] = useState(null);
  const syncedShiftsRef = useRef(null); // 서버에 반영된 마지막 근무 스냅샷 (null = 아직 동기화 전)
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

  // 날짜별 개인 메모 { 'YYYY-MM-DD': '메모' }
  const [dayNotes, setDayNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('day_notes') || '{}') || {};
    } catch (e) {
      return {};
    }
  });
  const syncedNotesRef = useRef(null);

  const [groups, setGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('my_group_list');
      return saved ? JSON.parse(saved) || [] : [];
    } catch (e) {
      return [];
    }
  });

  // 근무 시작 알림 설정 (웹: 브라우저 알림, 앱: 서버 푸시)
  const [alarmSettings, setAlarmSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('shift_alarm_settings');
      return saved ? JSON.parse(saved) : { enabled: false, minutesBefore: 60 };
    } catch (e) {
      return { enabled: false, minutesBefore: 60 };
    }
  });

  // 사용자 정의 근무 종류 (기본 D/E/N/M/OFF/연차 외 추가·색상 변경)
  const [customShiftTypes, setCustomShiftTypes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('custom_shift_types') || '[]') || [];
    } catch (e) {
      return [];
    }
  });
  const shiftTypes = useMemo(() => {
    // 근무 시간이 비어 있으면 수당 탭의 시간 설정으로 채움 (기존 사용자 설정 유지)
    const times = shiftConfigs?.shiftTimes || {};
    return mergeShiftTypes(customShiftTypes).map((t) => {
      if (t.kind !== 'work' || (t.start && t.end)) return t;
      const [start = '', end = ''] = String(times[t.code]?.time || '').split('-').map((x) => x.trim());
      return { ...t, start, end };
    });
  }, [customShiftTypes, shiftConfigs?.shiftTimes]);

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

  useEffect(() => {
    localStorage.setItem('shift_alarm_settings', JSON.stringify(alarmSettings));
  }, [alarmSettings]);

  useEffect(() => {
    localStorage.setItem('custom_shift_types', JSON.stringify(customShiftTypes || []));
  }, [customShiftTypes]);

  useEffect(() => {
    localStorage.setItem('day_notes', JSON.stringify(dayNotes || {}));
  }, [dayNotes]);

  // 앱 실행 시 FCM 토큰 재등록 (토큰 갱신/재설치 대비, 권한 팝업 없이)
  useEffect(() => {
    if (!profile || !isNativePush() || !alarmSettings.enabled) return;
    registerDevice({ prompt: false }).catch((err) => console.error('푸시 기기 등록 실패:', err.message));
  }, [profile?.id]);

  // 알림 켜진 상태에서 근무 시간/시간대 변경 → 서버 알림 설정 동기화 (디바운스)
  useEffect(() => {
    if (!profile || !isNativePush() || !alarmSettings.enabled) return;
    const timer = setTimeout(() => {
      saveReminderSettings({
        enabled: true,
        minutesBefore: alarmSettings.minutesBefore,
        shiftTimes: shiftConfigs?.shiftTimes
      }).catch((err) => console.error('알림 설정 동기화 실패:', err.message));
    }, 1000);
    return () => clearTimeout(timer);
  }, [profile?.id, shiftConfigs?.shiftTimes]);

  // 서버 부트스트랩: 익명 세션 → 프로필 → 서버/로컬 근무 병합 (로컬 우선) 후 차이분 업로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const me = await ensureProfile(userName, hadStoredName);
        const remote = await fetchMyShifts();
        if (cancelled) return;

        const local = Object.fromEntries(Object.entries(myShifts || {}).filter(([, v]) => v));
        const merged = { ...remote, ...local };
        const result = await saveShiftChanges(diffShifts(remote, merged));
        if (result?.skipped?.length) console.warn('저장되지 않은 근무(알 수 없는 코드):', result.skipped);

        if (cancelled) return;
        syncedShiftsRef.current = merged;
        setProfile(me);
        setMyShifts(merged);

        // 서버에 저장된 내 근무 종류(이름·색상·시간) 반영
        const serverTypes = await fetchMyShiftTypes().catch(() => null);
        if (!cancelled && serverTypes?.length) setCustomShiftTypes(serverTypes);

        // 메모: 서버 + 로컬 병합 (로컬 우선) 후 차이분 업로드
        const remoteNotes = await fetchMyNotes();
        if (cancelled) return;
        const localNotes = Object.fromEntries(Object.entries(dayNotes || {}).filter(([, v]) => v));
        const mergedNotes = { ...remoteNotes, ...localNotes };
        const noteChanges = diffShifts(remoteNotes, mergedNotes);
        if (Object.keys(noteChanges).length) await saveNoteChanges(me.id, noteChanges);
        syncedNotesRef.current = mergedNotes;
        setDayNotes(mergedNotes);
      } catch (err) {
        console.error('서버 동기화 실패 (오프라인 모드로 동작):', err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 근무 변경 → 서버 반영 (디바운스)
  useEffect(() => {
    if (!profile || !syncedShiftsRef.current) return;
    const changes = diffShifts(syncedShiftsRef.current, myShifts || {});
    if (Object.keys(changes).length === 0) return;

    const snapshot = { ...(myShifts || {}) };
    const timer = setTimeout(async () => {
      try {
        await saveShiftChanges(changes);
        syncedShiftsRef.current = snapshot;
      } catch (err) {
        console.error('근무 저장 실패:', err.message);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [myShifts, profile]);

  // 메모 변경 → 서버 반영 (디바운스)
  useEffect(() => {
    if (!profile || !syncedNotesRef.current) return;
    const changes = diffShifts(syncedNotesRef.current, dayNotes || {});
    if (Object.keys(changes).length === 0) return;
    const snapshot = { ...(dayNotes || {}) };
    const timer = setTimeout(async () => {
      try {
        await saveNoteChanges(profile.id, changes);
        syncedNotesRef.current = snapshot;
      } catch (err) {
        console.error('메모 저장 실패:', err.message);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dayNotes, profile]);

  // 이름 변경 → 프로필 반영
  useEffect(() => {
    if (!profile || profile.display_name === userName) return;
    updateDisplayName(profile.id, userName)
      .then(() => setProfile((p) => ({ ...p, display_name: userName })))
      .catch((err) => console.error('이름 저장 실패:', err.message));
  }, [userName, profile]);

  // 근무 종류 저장: 로컬 즉시 반영 → 근무 시간은 알림/수당 설정에도 반영 → 서버 저장
  const handleSaveShiftType = async (type) => {
    if (profile) await upsertShiftType(type);
    setCustomShiftTypes((prev) => [...(prev || []).filter((t) => t.code !== type.code), type]);
    if (type.kind === 'work' && type.start && type.end) {
      setShiftConfigs((prev) => ({
        ...prev,
        shiftTimes: {
          ...(prev?.shiftTimes || {}),
          [type.code]: { ...(prev?.shiftTimes?.[type.code] || {}), time: `${type.start} - ${type.end}` }
        }
      }));
    }
  };

  const handleDeleteShiftType = async (code) => {
    if (profile) await deleteShiftType(code);
    setCustomShiftTypes((prev) => (prev || []).filter((t) => t.code !== code));
  };

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
    <ShiftTypesContext.Provider value={shiftTypes}>
    <div className="min-h-screen bg-slate-100 flex justify-center items-start sm:py-6 font-sans">
      <div className="w-full max-w-md bg-white h-[100dvh] sm:h-[min(840px,calc(100dvh-3rem))] sm:rounded-3xl sm:shadow-2xl flex flex-col justify-between overflow-hidden relative border border-slate-200/80">
        
        {/* 1. 상단 프로필 헤더 */}
        <div
          className="bg-white px-5 py-4 border-b border-slate-100 flex justify-between items-center z-10 shrink-0"
          style={{ paddingTop: 'calc(1rem + var(--safe-top))' }}
        >
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
        <div
          className="p-4 flex-1 overflow-y-auto bg-slate-50/50"
          style={{ paddingBottom: 'calc(5rem + var(--safe-bottom))' }}
        >
          {activeTab === 'myShift' && (
            <MyShiftTab
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              myShifts={myShifts || {}}
              setMyShifts={setMyShifts}
              shiftConfigs={shiftConfigs}
              userName={userName}
              profile={profile}
              alarmSettings={alarmSettings}
              setAlarmSettings={setAlarmSettings}
              onSaveShiftType={handleSaveShiftType}
              dayNotes={dayNotes || {}}
              setDayNotes={setDayNotes}
              onDeleteShiftType={handleDeleteShiftType}
            />
          )}

          {activeTab === 'allowance' && (
            <AllowanceTab
              myShifts={myShifts || {}}
              shiftConfigs={shiftConfigs}
              setShiftConfigs={setShiftConfigs}
              selectedDate={selectedDate}
              privacyBlur={privacyBlur}
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
              profile={profile}
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
        <div
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-3 py-2 flex justify-around items-center z-50"
          style={{ paddingBottom: 'calc(0.5rem + var(--safe-bottom))' }}
        >
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
    </ShiftTypesContext.Provider>
  );
}
