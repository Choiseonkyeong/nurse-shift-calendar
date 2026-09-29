import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { Calendar, DollarSign, Users, Upload, Shield, RotateCcw, Pencil, Cloud, CloudOff, Loader2, Sun, Moon, SunMoon } from 'lucide-react';
import MyShiftTab from './components/MyShiftTab';
import { lazyImport, consumeResume, setResumeTab } from './lib/appUpdate';
// 첫 화면(내 근무) 외 탭은 누를 때 불러옴 → 첫 실행 속도 개선
// (새 배포 후 오래 열린 탭에서 파일을 못 찾으면 새 버전으로 새로고침 — lib/appUpdate)
const AllowanceTab = lazy(lazyImport(() => import('./components/AllowanceTab')));
const GroupShareTab = lazy(lazyImport(() => import('./components/GroupShareTab')));
const ImportTab = lazy(lazyImport(() => import('./components/ImportTab')));
import NameSetup from './components/NameSetup';
import AccountModal from './components/AccountModal';
import AuthLanding from './components/AuthLanding';
import { authRedirectType, getAccountInfo } from './lib/account';
import { consumeOAuthNotice } from './lib/socialAuth';
import { getThemePref, setThemePref } from './lib/theme';
import { getTodayDateObj, toDateKey } from './utils/dateUtils';
import { ensureSession, ensureProfile, updateDisplayName, fetchMyShifts, saveShiftChanges, diffShifts, fetchMyShiftTypes, upsertShiftType, deleteShiftType, fetchMyNotes, saveNoteChanges } from './lib/shiftApi';
import { usesServerPush, registerDevice, saveReminderSettings } from './lib/pushNotifications';
import { ShiftTypesContext, mergeShiftTypes } from './lib/shiftTypes';
import { syncWidget } from './lib/widgetSync';
import { applyChanges, mergeWithRemote } from './lib/syncMerge';
import { queueTypeOp, flushTypeQueue, applyTypeQueue } from './lib/typeSync';
import { SETTINGS_TS_KEY, decideSettingsSync, fetchMySettings, saveMySettings } from './lib/settingsSync';
import { ROSTER_NAME_KEY } from './lib/rosterName';

const SYNCED_SHIFTS_KEY = 'synced_shift_data';
const LEGACY_DEFAULT_NAME = '최수민';
const NAME_CONFIRMED_KEY = 'name_confirmed';
const SYNCED_NOTES_KEY = 'synced_day_notes';
const readJson = (key) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
};
export default function App() {
  const today = getTodayDateObj();
  // 새 버전으로 새로고침된 직후면 보던 탭으로 돌아가고 안내 표시
  const [resume] = useState(consumeResume);
  const [activeTab, setActiveTab] = useState(() => resume?.tab || 'myShift');
  useEffect(() => setResumeTab(activeTab), [activeTab]);
  
  const [selectedDate, _setSelectedDate] = useState(today.dateStr);
  const setSelectedDate = (raw) => _setSelectedDate(toDateKey(raw));

  // 기존 사용자 여부 (레거시 group_shifts 데이터 연결 판단용) — 저장 effect 실행 전에 판정
  const [hadStoredName] = useState(() => localStorage.getItem('shift_user_name') !== null);
  // 첫 실행이면 빈 이름 → 이름 입력 화면 표시 후 서버 연결
  const [userName, setUserName] = useState(() => localStorage.getItem('shift_user_name') || '');
  // 예전 버전 기본 이름('최수민')이 그대로 저장된 사용자: 한 번 이름 확인
  const [needsNameConfirm, setNeedsNameConfirm] = useState(
    () => localStorage.getItem('shift_user_name') === LEGACY_DEFAULT_NAME && !localStorage.getItem(NAME_CONFIRMED_KEY)
  );
  // 서버 동기화 상태: connecting | saved | saving | offline
  const [syncStatus, setSyncStatus] = useState('connecting');
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
  const [syncRetry, setSyncRetry] = useState(0);

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
  const customShiftTypesRef = useRef(customShiftTypes);
  customShiftTypesRef.current = customShiftTypes;
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

  // 인증 메일 링크로 열린 웹 페이지 (이메일 인증 완료 / 비밀번호 재설정)
  const [authLanding, setAuthLanding] = useState(() => authRedirectType());
  // 계정 창: 'link' | 'login' | null, 계정 상태: anonymous | pending | needs_password | linked
  // 카카오·구글 로그인에서 돌아온 결과 안내 (한 번만). 로그인 성공은 화면 전환으로 충분해서 창을 띄우지 않음
  const [oauthNotice, setOauthNotice] = useState(() => {
    const n = consumeOAuthNotice();
    return n && !n.silent ? n : null;
  });
  const [accountModal, setAccountModal] = useState(() => (oauthNotice ? (userName ? 'link' : 'login') : null));
  const [accountStatus, setAccountStatus] = useState(null);
  // 화면 테마: system → dark → light 순으로 전환
  const [themePref, setThemePrefState] = useState(getThemePref);
  const cycleTheme = () => {
    const next = { system: 'dark', dark: 'light', light: 'system' }[themePref];
    setThemePref(next);
    setThemePrefState(next);
  };

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
    if (userName) localStorage.setItem('shift_user_name', userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('shift_alarm_settings', JSON.stringify(alarmSettings));
  }, [alarmSettings]);

  // 근무표(사진·엑셀) 속 내 이름: 앱 이름이 닉네임이어도 자동으로 내 줄을 찾도록 (서버 설정과 함께 동기화)
  const [rosterName, setRosterName] = useState(() => localStorage.getItem(ROSTER_NAME_KEY) || '');
  useEffect(() => {
    if (rosterName) localStorage.setItem(ROSTER_NAME_KEY, rosterName);
    else localStorage.removeItem(ROSTER_NAME_KEY);
  }, [rosterName]);

  useEffect(() => {
    localStorage.setItem('custom_shift_types', JSON.stringify(customShiftTypes || []));
  }, [customShiftTypes]);

  useEffect(() => {
    localStorage.setItem('day_notes', JSON.stringify(dayNotes || {}));
  }, [dayNotes]);

  // Android 홈 화면 위젯 (오늘/내일 근무)
  useEffect(() => {
    syncWidget(myShifts || {}, shiftTypes);
  }, [myShifts, shiftTypes]);

  // ---------------- 설정 동기화 (시급·연차·수당 기준·근무 시간·알림) ----------------
  const [settingsVersion, setSettingsVersion] = useState(0);
  const settingsReadyRef = useRef(false); // 서버와 첫 비교가 끝나기 전에는 올리지 않음
  const applyingServerSettingsRef = useRef(false); // 서버 값 반영 중에는 다시 올리지 않음
  const settingsPayload = () => ({
    shift_configs: shiftConfigsRef.current || {},
    shift_alarm_settings: alarmSettingsRef.current,
    roster_name: rosterNameRef.current || ''
  });

  const syncSettings = async () => {
    const server = await fetchMySettings().catch(() => null);
    if (!server) return; // 서버에 설정 저장 기능이 아직 없음(마이그레이션 전) → 기기에만 저장
    const localTs = localStorage.getItem(SETTINGS_TS_KEY);
    const action = decideSettingsSync(localTs, server);
    if (action === 'pull') {
      const { shift_configs: configs, shift_alarm_settings: alarm, roster_name: serverRoster } = server.settings || {};
      const rosterChanged = typeof serverRoster === 'string' && serverRoster !== rosterNameRef.current;
      // 실제로 값을 바꿀 때만 "서버에서 온 변경" 표시 (안 그러면 다음 기기 변경이 저장되지 않음)
      if (configs || alarm || rosterChanged) applyingServerSettingsRef.current = true;
      if (configs) setShiftConfigs(configs);
      if (alarm) setAlarmSettings(alarm);
      if (rosterChanged) setRosterName(serverRoster);
      if (configs) setSettingsVersion((v) => v + 1); // 수당 탭 입력칸을 서버 값으로 다시 그림
      localStorage.setItem(SETTINGS_TS_KEY, server.updated_at);
    } else if (action === 'push') {
      const ts = localTs || new Date().toISOString();
      localStorage.setItem(SETTINGS_TS_KEY, ts);
      await saveMySettings(settingsPayload(), ts).catch(() => {});
    }
    settingsReadyRef.current = true;
  };
  const syncSettingsRef = useRef(syncSettings);
  syncSettingsRef.current = syncSettings;
  const shiftConfigsRef = useRef(shiftConfigs);
  shiftConfigsRef.current = shiftConfigs;
  const alarmSettingsRef = useRef(alarmSettings);
  alarmSettingsRef.current = alarmSettings;
  const rosterNameRef = useRef(rosterName);
  rosterNameRef.current = rosterName;

  // 이 기기에서 설정을 바꾸면 변경 시각 기록 후 서버에 저장 (디바운스)
  useEffect(() => {
    if (!profile || !settingsReadyRef.current) return;
    if (applyingServerSettingsRef.current) {
      applyingServerSettingsRef.current = false;
      return;
    }
    const ts = new Date().toISOString();
    localStorage.setItem(SETTINGS_TS_KEY, ts);
    const timer = setTimeout(() => {
      saveMySettings({ shift_configs: shiftConfigs || {}, shift_alarm_settings: alarmSettings, roster_name: rosterName || '' }, ts).catch((err) =>
        console.error('설정 저장 실패 (다음 연결 때 다시 저장):', err.message)
      );
    }, 1500);
    return () => clearTimeout(timer);
  }, [shiftConfigs, alarmSettings, rosterName, profile]);

  // 앱 실행 시 FCM 토큰 재등록 (토큰 갱신/재설치 대비, 권한 팝업 없이)
  useEffect(() => {
    if (!profile || !usesServerPush() || !alarmSettings.enabled) return;
    registerDevice({ prompt: false }).catch((err) => console.error('푸시 기기 등록 실패:', err.message));
    // 프로필 연결 시 + 다른 기기 설정으로 알림이 켜졌을 때 (권한이 이미 있으면 조용히 등록)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, alarmSettings.enabled]);

  // 알림 켜진 상태에서 근무 시간/시간대 변경 → 서버 알림 설정 동기화 (디바운스)
  useEffect(() => {
    if (!profile || !usesServerPush() || !alarmSettings.enabled) return;
    const timer = setTimeout(() => {
      saveReminderSettings({
        enabled: true,
        minutesBefore: alarmSettings.minutesBefore,
        shiftTimes: shiftConfigs?.shiftTimes
      }).catch((err) => console.error('알림 설정 동기화 실패:', err.message));
    }, 1000);
    return () => clearTimeout(timer);
    // 근무 시간이 바뀔 때만 서버에 반영 (알림 켜기/끄기는 알림 설정 화면에서 직접 저장)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, shiftConfigs?.shiftTimes]);

  // ---------------- 서버 동기화 ----------------
  // 마지막으로 서버와 일치했던 스냅샷을 기기에 저장해 두고, 그 이후 "이 기기에서 바뀐 것"만 서버에 반영한다.
  // (예전처럼 기기 값 전체가 이기면 다른 기기에서 바꾼 근무나 오프라인에서 지운 근무가 되살아남)
  const myShiftsRef = useRef(myShifts);
  myShiftsRef.current = myShifts;
  const dayNotesRef = useRef(dayNotes);
  dayNotesRef.current = dayNotes;
  const bootstrappedRef = useRef(false);
  const pullingRef = useRef(false);

  const markSyncedShifts = (snapshot) => {
    syncedShiftsRef.current = snapshot;
    localStorage.setItem(SYNCED_SHIFTS_KEY, JSON.stringify(snapshot));
  };
  const markSyncedNotes = (snapshot) => {
    syncedNotesRef.current = snapshot;
    localStorage.setItem(SYNCED_NOTES_KEY, JSON.stringify(snapshot));
  };

  /** 서버 값 + 이 기기에서 바뀐 값 병합 → 서버 저장 → 화면 반영 */
  const pullAndMerge = async (me) => {
    if (pullingRef.current) return;
    pullingRef.current = true;
    try {
      // 오프라인에서 바꾼 근무 종류를 먼저 보냄 (그 코드의 근무가 서버에 저장되도록)
      await flushTypeQueue({ upsert: upsertShiftType, remove: deleteShiftType });
      const remote = await fetchMyShifts();
      const local = myShiftsRef.current || {};
      // 기준 스냅샷이 없으면 이전 버전 사용자 → 기기 값 전체 우선 (기존 동작 유지)
      const merged = mergeWithRemote(remote, local, syncedShiftsRef.current || readJson(SYNCED_SHIFTS_KEY));
      const result = await saveShiftChanges(diffShifts(remote, merged));
      if (result?.skipped?.length) console.warn('저장되지 않은 근무(알 수 없는 코드):', result.skipped);
      markSyncedShifts(merged);
      // 조회하는 동안 사용자가 바꾼 값은 유지 (다음 저장 때 반영)
      setMyShifts((cur) => applyChanges(merged, diffShifts(local, cur || {})));

      try {
        const remoteNotes = await fetchMyNotes();
        const localNotes = dayNotesRef.current || {};
        const mergedNotes = mergeWithRemote(remoteNotes, localNotes, syncedNotesRef.current || readJson(SYNCED_NOTES_KEY));
        const upload = diffShifts(remoteNotes, mergedNotes);
        if (Object.keys(upload).length) await saveNoteChanges(me.id, upload);
        markSyncedNotes(mergedNotes);
        setDayNotes((cur) => applyChanges(mergedNotes, diffShifts(localNotes, cur || {})));
      } catch (err) {
        console.error('메모 동기화 실패 (기기에만 저장):', err.message);
      }
      setSyncStatus('saved');
    } finally {
      pullingRef.current = false;
    }
  };

  // effect 에서 항상 최신 함수를 쓰도록 ref 로 보관
  const pullAndMergeRef = useRef(pullAndMerge);
  pullAndMergeRef.current = pullAndMerge;

  // 그룹에서 근무 교환이 수락되는 등 서버에서 내 근무가 바뀌었을 때
  const resyncFromServer = useCallback(() => {
    if (profile) pullAndMergeRef.current(profile).catch(() => setSyncStatus('offline'));
  }, [profile]);

  // 서버 부트스트랩: 이름이 정해지면 익명 세션 → 프로필 → 병합
  useEffect(() => {
    if (!userName || authLanding || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    (async () => {
      try {
        await ensureSession();
        const me = await ensureProfile(userName, hadStoredName);
        await pullAndMergeRef.current(me);
        setProfile(me);
        getAccountInfo().then((a) => setAccountStatus(a.status)).catch(() => {});

        // 서버에 저장된 내 근무 종류(이름·색상·시간) 반영
        // (아직 못 보낸 기기 변경은 서버 목록 위에 유지)
        const serverTypes = await fetchMyShiftTypes().catch(() => null);
        if (serverTypes?.length) setCustomShiftTypes(applyTypeQueue(serverTypes));

        await syncSettingsRef.current();
      } catch (err) {
        bootstrappedRef.current = false; // 다시 연결되면 재시도
        setSyncStatus('offline');
        console.error('서버 동기화 실패 (오프라인 모드로 동작):', err.message);
      }
    })();
  }, [userName, syncRetry, hadStoredName, authLanding]);

  // 앱으로 돌아오거나(다른 기기 변경 반영) 네트워크가 다시 연결되면 재동기화
  useEffect(() => {
    let last = Date.now();
    const resync = () => {
      if (document.visibilityState !== 'visible') return;
      if (!profile) {
        setSyncRetry((n) => n + 1);
        return;
      }
      if (Date.now() - last < 30000) return;
      last = Date.now();
      pullAndMergeRef.current(profile).catch(() => setSyncStatus('offline'));
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
    };
  }, [profile]);

  // 근무 변경 → 서버 반영 (디바운스)
  useEffect(() => {
    if (!profile || !syncedShiftsRef.current) return;
    const changes = diffShifts(syncedShiftsRef.current, myShifts || {});
    if (Object.keys(changes).length === 0) return;
    setSyncStatus('saving');

    const timer = setTimeout(async () => {
      try {
        await saveShiftChanges(changes);
        markSyncedShifts(applyChanges(syncedShiftsRef.current, changes));
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('offline');
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
    setSyncStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveNoteChanges(profile.id, changes);
        markSyncedNotes(applyChanges(syncedNotesRef.current, changes));
        setSyncStatus('saved');
      } catch (err) {
        setSyncStatus('offline');
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

  // 근무 종류 서버 반영: 오프라인·네트워크 오류면 기기에 쌓아 두고 다음 연결 때 전송(typeSync),
  // 서버가 거부한 경우(형식 오류 등)는 오류를 그대로 알려 줌
  const saveTypeToServer = async (op, send) => {
    if (!profile) {
      queueTypeOp(op);
      return;
    }
    try {
      await send();
    } catch (err) {
      if (!navigator.onLine || /fetch|network|load failed/i.test(err?.message || '')) queueTypeOp(op);
      else throw err;
    }
  };

  // 근무 종류 저장: 로컬 즉시 반영 → 근무 시간은 알림/수당 설정에도 반영 → 서버 저장
  const handleSaveShiftType = async (type) => {
    await saveTypeToServer({ type: 'upsert', value: type }, () => upsertShiftType(type));
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
    await saveTypeToServer({ type: 'remove', code }, () => deleteShiftType(code));
    setCustomShiftTypes((prev) => (prev || []).filter((t) => t.code !== code));
  };

  // 사진/엑셀 가져오기 → 내 근무표에 바로 등록하고 달력으로 이동 (되돌리기 가능)
  const [importBanner, setImportBanner] = useState(null);
  const handleImported = ({ name, source, yearMonth, shifts, uncertain = [] }) => {
    const current = myShiftsRef.current || {};
    const previous = Object.fromEntries(Object.keys(shifts).map((k) => [k, current[k] || null]));
    setMyShifts((prev) => ({ ...(prev || {}), ...shifts }));
    setSelectedDate(`${yearMonth}-01`);
    setActiveTab('myShift');
    // 종류별 개수 (근무표 오른쪽 합계와 비교용)
    const tally = {};
    Object.values(shifts).forEach((c) => {
      tally[c] = (tally[c] || 0) + 1;
    });
    const counts = Object.entries(tally).sort((x, y) => y[1] - x[1]);
    setImportBanner({ name, source, yearMonth, count: Object.keys(shifts).length, counts, uncertain, previous, keys: Object.keys(shifts) });
  };
  const handleUndoImport = () => {
    if (!importBanner) return;
    setMyShifts((prev) => applyChanges(prev || {}, importBanner.previous));
    setImportBanner(null);
  };

  const handleSaveName = () => {
    if (tempUserName.trim()) {
      setUserName(tempUserName.trim().slice(0, 30));
      setIsEditingName(false);
    }
  };

  const handleGoToday = () => {
    setSelectedDate(today.dateStr);
  };

  const currentGroup = (groups || []).find(g => g.id === activeGroupId) || (groups || [])[0] || null;

  if (authLanding) {
    return (
      <AuthLanding
        type={authLanding}
        onDone={() => {
          window.history.replaceState(null, '', window.location.pathname);
          setAuthLanding(null);
        }}
      />
    );
  }

  return (
    <ShiftTypesContext.Provider value={shiftTypes}>
    {!userName && !accountModal && (
      <NameSetup
        onSubmit={(name) => { setUserName(name); setTempUserName(name); }}
        onLogin={() => setAccountModal('login')}
      />
    )}
    {accountModal && (
      <AccountModal
        online={Boolean(profile)}
        userName={userName}
        initialMode={accountModal}
        initialMessage={oauthNotice}
        onClose={() => {
          setAccountModal(null);
          setOauthNotice(null);
        }}
        onStatusChange={setAccountStatus}
      />
    )}
    {userName && needsNameConfirm && (
      <NameSetup
        confirmMode
        initialName={userName}
        onSubmit={(name) => {
          localStorage.setItem(NAME_CONFIRMED_KEY, '1');
          setNeedsNameConfirm(false);
          setUserName(name);
          setTempUserName(name);
        }}
      />
    )}
    <div className="min-h-screen bg-page flex justify-center items-start sm:py-6 font-sans">
      <div className="w-full max-w-md bg-white h-[100dvh] sm:h-[min(840px,calc(100dvh-3rem))] sm:rounded-3xl sm:shadow-2xl flex flex-col justify-between overflow-hidden relative border border-slate-200/80">
        
        {/* 1. 상단 프로필 헤더 */}
        <div
          className="bg-white px-5 py-4 border-b border-slate-100 flex justify-between items-center z-10 shrink-0"
          style={{ paddingTop: 'calc(1rem + var(--safe-top))' }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setAccountModal('link')}
              aria-label={accountStatus === 'linked' ? '계정' : '계정 (연결 필요)'}
              className="relative w-10 h-10 shrink-0 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-sm shadow-2xs cursor-pointer"
            >
              {userName.substring(0, 1)}
              {accountStatus && accountStatus !== 'linked' && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white" />
              )}
            </button>
            <div className="min-w-0">
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
                <button
                  type="button"
                  className="flex items-center gap-1 cursor-pointer group max-w-full"
                  onClick={() => {
                    setTempUserName(userName);
                    setIsEditingName(true);
                  }}
                  aria-label="이름 수정"
                >
                  <h1 className="font-black text-base text-slate-900 leading-tight truncate">{userName} 님의 근무표</h1>
                  <Pencil size={12} className="shrink-0 text-slate-300 group-hover:text-indigo-500" />
                </button>
              )}
              <SyncBadge status={syncStatus} />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              onClick={handleGoToday}
              className="flex items-center gap-1 px-2.5 py-1.5 whitespace-nowrap bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl text-xs font-black hover:bg-amber-100 transition cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>오늘</span>
            </button>
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`화면 테마: ${{ system: '기기 설정', dark: '다크', light: '라이트' }[themePref]} (눌러서 변경)`}
              className="p-1.5 rounded-2xl border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition cursor-pointer"
            >
              {themePref === 'dark' ? <Moon size={14} /> : themePref === 'light' ? <Sun size={14} /> : <SunMoon size={14} />}
            </button>
            <button
              onClick={() => setPrivacyBlur(!privacyBlur)}
              className={`text-xs px-2.5 py-1.5 whitespace-nowrap rounded-2xl font-black flex items-center gap-1 border transition cursor-pointer ${
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
          <Suspense
            fallback={
              <div className="flex justify-center py-16 text-slate-300">
                <Loader2 size={22} className="animate-spin" />
              </div>
            }
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
              importBanner={importBanner}
              onUndoImport={handleUndoImport}
              onCloseImportBanner={() => setImportBanner(null)}
              onResolveUncertain={(dateKey) =>
                setImportBanner((b) => (b && b.uncertain.includes(dateKey) ? { ...b, uncertain: b.uncertain.filter((k) => k !== dateKey) } : b))
              }
            />
          )}

          {activeTab === 'allowance' && (
            <AllowanceTab
              key={settingsVersion}
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
              onServerShiftsChanged={resyncFromServer}
            />
          )}

          {activeTab === 'import' && (
            <ImportTab
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              myShifts={myShifts || {}}
              setMyShifts={setMyShifts}
              userName={userName}
              rosterName={rosterName}
              setRosterName={setRosterName}
              dayNotes={dayNotes || {}}
              setDayNotes={setDayNotes}
              onImported={handleImported}
              initialNotice={resume?.notice || ''}
              accountStatus={accountStatus}
              onOpenAccount={() => setAccountModal('link')}
            />
          )}
          </Suspense>
        </div>

        {/* 3. 프레임 바닥에 완벽 밀착시킨 하단 네비게이션 탭 */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-3 py-2 flex justify-around items-center z-50"
          style={{ paddingBottom: 'calc(0.5rem + var(--safe-bottom))' }}
        >
          <button
            onClick={() => setActiveTab('myShift')}
            aria-current={activeTab === 'myShift' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'myShift' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
            }`}
          >
            <Calendar size={18} className={activeTab === 'myShift' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[11px] font-black mt-0.5">내 근무</span>
          </button>

          <button
            onClick={() => setActiveTab('allowance')}
            aria-current={activeTab === 'allowance' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'allowance' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
            }`}
          >
            <DollarSign size={18} className={activeTab === 'allowance' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[11px] font-black mt-0.5">연차/수당</span>
          </button>

          <button
            onClick={() => setActiveTab('groupShare')}
            aria-current={activeTab === 'groupShare' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'groupShare' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
            }`}
          >
            <Users size={18} className={activeTab === 'groupShare' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[11px] font-black mt-0.5">그룹</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            aria-current={activeTab === 'import' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'import' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'
            }`}
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

/** 헤더 아래 서버 저장 상태 */
function SyncBadge({ status }) {
  const map = {
    connecting: { icon: <Loader2 size={11} className="animate-spin" />, text: '서버 연결 중', cls: 'text-slate-400' },
    saving: { icon: <Loader2 size={11} className="animate-spin" />, text: '저장 중', cls: 'text-slate-400' },
    saved: { icon: <Cloud size={11} />, text: '서버에 저장됨', cls: 'text-emerald-500' },
    offline: { icon: <CloudOff size={11} />, text: '오프라인 · 기기 저장', cls: 'text-amber-500' }
  };
  const { icon, text, cls } = map[status] || map.connecting;
  return (
    <p className={`text-[11px] font-bold flex items-center gap-1 whitespace-nowrap ${cls}`}>
      {icon} {text}
    </p>
  );
}
