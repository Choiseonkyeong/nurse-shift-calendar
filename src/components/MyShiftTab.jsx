import React, { useState, useEffect } from 'react';
import { errorText } from '../lib/errorText';
import { toast, formatDateKo } from '../lib/toast';
import Modal from './Modal';
import { needsRetakeHint } from '../lib/importQuality';
import { Bell, BellOff, Camera, Check, ChevronDown, X, ChevronLeft, ChevronRight, Zap, Eraser, Palette, Repeat, Share2, Loader2, Undo2, AlertTriangle, UserX } from 'lucide-react';
import { useSwipe } from '../lib/swipe';
import { useShiftTypes, shiftTextVars, findShiftType } from '../lib/shiftTypes';
import ShiftTypeManager from './ShiftTypeManager';
import PatternFill from './PatternFill';
import MonthPicker, { monthPickKey } from './MonthPicker';
import { getHoliday, getHolidayShort, dayNumberClass } from '../utils/holidays';
import { addMonthsKey, toDateKey, getTodayDateObj } from '../utils/dateUtils';
import { usesServerPush, enablePushReminders, disablePushReminders, toStartTimes } from '../lib/pushNotifications';
import {
  isNativeApp,
  enableLocalReminders,
  syncLocalReminders,
  getAlarmPermission,
  webNotificationState,
  REMINDER_DAYS,
  MAX_REMINDERS
} from '../lib/localReminders';
import { shareMonthImage } from '../lib/shareCalendar';
import { payPeriod } from '../lib/allowance';

/** 근무 하나 바꾸기 (빈 코드 = 그 날짜 삭제, 빈 값을 남기지 않음) */
const withShift = (prev, dateKey, code) => {
  const next = { ...(prev || {}) };
  if (code) next[dateKey] = code;
  else delete next[dateKey];
  return next;
};

/** 등록한 날짜 범위 → "8월" 또는 "7월 26일~8월 25일" */
const importPeriod = ({ keys = [], yearMonth }) => {
  const sorted = [...keys].sort();
  if (!sorted.length) return `${Number(yearMonth.slice(5))}월`;
  const [first, last] = [sorted[0], sorted[sorted.length - 1]];
  if (first.slice(0, 7) === last.slice(0, 7)) return `${Number(first.slice(5, 7))}월`;
  const md = (k) => `${Number(k.slice(5, 7))}월 ${Number(k.slice(8))}일`;
  return `${md(first)}~${md(last)}`;
};

export default function MyShiftTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  shiftConfigs = {},
  userName = '',
  profile,
  alarmSettings,
  setAlarmSettings,
  onSaveShiftType,
  onDeleteShiftType,
  dayNotes = {},
  setDayNotes,
  importBanner,
  onUndoImport,
  onRepickImport,
  onMoveImportMonth,
  onCloseImportBanner,
  onResolveUncertain,
  onOpenImport,
  loadingFromServer = false
}) {
  // 방금 가져온 근무 중 인식이 불확실한 날짜 (달력에 노란 테두리)
  const uncertainSet = new Set(importBanner?.uncertain || []);
  // 메모 수정: 빈 값이면 삭제
  const setNote = (dateKey, text) => {
    setDayNotes((prev) => {
      const next = { ...(prev || {}) };
      if (text.trim()) next[dateKey] = text.slice(0, 500);
      else delete next[dateKey];
      return next;
    });
  };
  const [year, month] = (selectedDate || toDateKey(new Date())).split('-').map(Number);
  
  // 근무 직접 수정 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDateKey, setEditingDateKey] = useState('');

  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);

  // 이 기기의 알림 권한 (설정은 다른 기기에서 켜져 동기화됐는데 이 기기엔 권한이 없는 경우 알려 주기 위해)
  const [alarmPerm, setAlarmPerm] = useState('granted');
  useEffect(() => {
    let alive = true;
    const check = () => getAlarmPermission().then((p) => alive && setAlarmPerm(p)).catch(() => {});
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [alarmSettings.enabled, isAlarmModalOpen]);
  const alarmBlocked = Boolean(alarmSettings.enabled) && alarmPerm !== 'granted';

  const shiftTypes = useShiftTypes();
  // 빠른 입력: null = 꺼짐, '' = 지우기, 그 외 = 선택한 근무 코드
  const [quickCode, setQuickCode] = useState(null);
  const quickMode = quickCode !== null;
  const [isTypeManagerOpen, setIsTypeManagerOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isPatternOpen, setIsPatternOpen] = useState(false); // false | true | 'first'(처음 사용자 안내에서 열림)

  // 알림 권한 요청 및 타이머 등록
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast('이 브라우저는 알림 기능을 지원하지 않습니다.', 'error');
      return false;
    }

    let permission = await webNotificationState();
    if (permission !== 'granted' && permission !== 'denied') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      toast('알림 권한이 거부되었습니다. 브라우저 설정에서 알림 권한을 허용해 주세요.', 'error');
      return false;
    }
    return true;
  };

  const formatLead = (m) => (m >= 60 ? `${m / 60}시간` : `${m}분`);

  // 앱(Android/iOS): 폰 안에서 알림 예약 — 서버·Firebase 없이, 앱을 꺼 둬도 도착
  const handleToggleLocalAlarm = async (minutes) => {
    const turningOn = !alarmSettings.enabled || minutes !== undefined;
    const minutesBefore = minutes || alarmSettings.minutesBefore;
    try {
      if (turningOn) {
        if (!(await enableLocalReminders())) {
          toast('알림 권한이 꺼져 있어요. 휴대폰 설정 > 앱 > 근무표 > 알림에서 허용해 주세요.', 'error');
          return;
        }
        setAlarmSettings({ enabled: true, minutesBefore });
        // 켤 때 바로 예약 (안드로이드는 이때만 '정확한 알람' 허용 화면을 보여 줌)
        await syncLocalReminders({
          enabled: true,
          askExact: true,
          myShifts,
          startTimes: toStartTimes(shiftConfigs.shiftTimes),
          shiftTypes,
          minutesBefore,
          userName
        });
        toast(`🔔 근무 시작 ${formatLead(minutesBefore)} 전 알림이 설정되었습니다.\n앱을 꺼 둬도 알림이 도착합니다.`, 'success');
      } else {
        setAlarmSettings({ ...alarmSettings, enabled: false });
        toast('🔕 알림이 해제되었습니다.', 'info');
      }
    } catch (err) {
      toast(`알림 설정 실패\n${errorText(err)}`, 'error');
    } finally {
      setIsAlarmModalOpen(false);
    }
  };

  // 웹 푸시(설정된 경우): 서버가 발송 — 브라우저를 닫아도 알림 도착
  const handleToggleServerAlarm = async (minutes) => {
    if (!profile) {
      toast('서버에 연결되지 않았습니다. 네트워크 확인 후 다시 시도해 주세요.', 'error');
      return;
    }
    const turningOn = !alarmSettings.enabled || minutes !== undefined;
    const minutesBefore = minutes || alarmSettings.minutesBefore;
    try {
      if (turningOn) {
        const granted = await enablePushReminders({ minutesBefore, shiftTimes: shiftConfigs.shiftTimes });
        if (!granted) {
          toast('알림 권한이 거부되었습니다. 브라우저 주소창의 자물쇠 아이콘 > 알림에서 허용해 주세요.', 'error');
          return;
        }
        setAlarmSettings({ enabled: true, minutesBefore });
        toast(`🔔 근무 시작 ${formatLead(minutesBefore)} 전 알림이 설정되었습니다.\n브라우저를 닫아도 알림이 도착합니다.`, 'success');
      } else {
        await disablePushReminders({ minutesBefore });
        setAlarmSettings({ ...alarmSettings, enabled: false });
        toast('🔕 알림이 해제되었습니다.', 'info');
      }
    } catch (err) {
      toast(`알림 설정 실패\n${errorText(err)}`, 'error');
    } finally {
      setIsAlarmModalOpen(false);
    }
  };

  // 알림 설정 토글/변경
  const handleToggleAlarm = async (minutes) => {
    if (isNativeApp()) return handleToggleLocalAlarm(minutes);
    if (usesServerPush()) return handleToggleServerAlarm(minutes);

    if (!alarmSettings.enabled || minutes !== undefined) {
      const granted = await requestNotificationPermission();
      if (!granted) return;

      const newSettings = { enabled: true, minutesBefore: minutes || alarmSettings.minutesBefore };
      setAlarmSettings(newSettings); // 실제 예약은 아래 useEffect 가 담당
      toast(`🔔 근무 시작 ${newSettings.minutesBefore >= 60 ? `${newSettings.minutesBefore / 60}시간` : `${newSettings.minutesBefore}분`} 전 알림이 설정되었습니다.`, 'success');
    } else {
      setAlarmSettings({ ...alarmSettings, enabled: false });
      toast('🔕 알림이 해제되었습니다.', 'info');
    }
    setIsAlarmModalOpen(false);
  };

  // 웹 근무 시작 알림 예약: 오늘·내일(로컬 날짜 기준) 근무를 브라우저가 열려 있는 동안 예약
  // 자정마다 다시 예약해 장시간 열어 둬도 다음 날 알림이 이어지도록 함 (앱은 서버 푸시 사용)
  const [dayTick, setDayTick] = useState(0);
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const timer = setTimeout(() => setDayTick((t) => t + 1), nextMidnight - now);
    return () => clearTimeout(timer);
  }, [dayTick]);

  useEffect(() => {
    if (isNativeApp() || usesServerPush() || !alarmSettings?.enabled) return;
    if (!('Notification' in window) || alarmPerm !== 'granted') return;

    const shiftTimes = shiftConfigs.shiftTimes || {};
    const timers = [];
    const now = new Date();

    [0, 1].forEach((offset) => {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const code = myShifts[toDateKey(day)];
      if (!code || shiftTypes.find((t) => t.code === code)?.kind !== 'work') return;

      const startTimeStr = shiftTimes[code]?.time?.split('-')[0]?.trim();
      const match = /^(\d{1,2}):(\d{2})$/.exec(startTimeStr || '');
      if (!match) return;

      const start = new Date(day);
      start.setHours(Number(match[1]), Number(match[2]), 0, 0);
      const delay = start.getTime() - alarmSettings.minutesBefore * 60 * 1000 - now.getTime();
      if (delay <= 0) return;

      timers.push(setTimeout(() => {
        new Notification(userName ? `⏰ [근무 알림] ${userName} 님!` : '⏰ 근무 알림', {
          body: `잠시 후 (${startTimeStr}) ${code} 근무가 시작됩니다. 준비해 주세요!`,
          icon: '/icon-192.png'
        });
      }, delay));
    });

    return () => timers.forEach(clearTimeout);
  }, [alarmSettings?.enabled, alarmSettings?.minutesBefore, myShifts, shiftConfigs.shiftTimes, shiftTypes, userName, dayTick, alarmPerm]);

  // 이번 달 근무표 이미지 공유/저장
  // 정산 시작일이 1일이 아니면 '이번 달 / 정산 기간' 중 고르는 창을 먼저 보여 줌
  const [isSharing, setIsSharing] = useState(false);
  const [isSharePickOpen, setIsSharePickOpen] = useState(false);
  const payStartDay = Number(shiftConfigs.startDay || 26);
  const sharePeriod = payStartDay === 1 ? null : payPeriod(year, month, payStartDay);
  const shortDate = (k) => `${Number(k.slice(5, 7))}.${Number(k.slice(8))}`;
  const handleShareImage = async (period = null) => {
    setIsSharePickOpen(false);
    try {
      setIsSharing(true);
      await shareMonthImage({ year, month, period, myShifts, shiftTypes, userName });
    } catch (err) {
      toast(`이미지 공유 실패\n${errorText(err)}`, 'error');
    } finally {
      setIsSharing(false);
    }
  };

  // 이전/다음 달 이동
  const goMonth = (delta) => setSelectedDate(addMonthsKey(selectedDate, delta));
  // 달력을 왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달
  const monthSwipe = useSwipe({ onLeft: () => goMonth(1), onRight: () => goMonth(-1) });

  // 날짜 클릭 시 수정 모달 오픈
  const handleDayClick = (dateKey) => {
    setSelectedDate(dateKey);
    if (quickMode) {
      // 빠른 입력: 팝업 없이 선택한 근무를 바로 적용
      setMyShifts((prev) => withShift(prev, dateKey, quickCode));
      onResolveUncertain?.(dateKey);
      return;
    }
    setEditingDateKey(dateKey);
    setIsEditModalOpen(true);
  };

  // 근무 코드 변경 처리
  const handleSelectShiftCode = (code) => {
    if (!editingDateKey) return;
    setMyShifts((prev) => withShift(prev, editingDateKey, code));
    onResolveUncertain?.(editingDateKey);
    setIsEditModalOpen(false);
  };

  // 캘린더 날짜 계산
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const lastDateOfMonth = new Date(year, month, 0).getDate();
  const todayKey = getTodayDateObj().dateStr;
  const calendarDays = [];

  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let d = 1; d <= lastDateOfMonth; d++) {
    const formattedDay = String(d).padStart(2, '0');
    const formattedMonth = String(month).padStart(2, '0');
    calendarDays.push({
      day: d,
      dateKey: `${year}-${formattedMonth}-${formattedDay}`
    });
  }

  // 근무 카운트 산출
  const shiftCounts = Object.fromEntries(shiftTypes.map((t) => [t.code, 0]));
  Object.entries(myShifts || {}).forEach(([key, val]) => {
    if (key.startsWith(`${year}-${String(month).padStart(2, '0')}`) && val) {
      if (shiftCounts[val] !== undefined) shiftCounts[val]++;
    }
  });

  const findType = (code) => findShiftType(shiftTypes, code);

  return (
    <div className="space-y-4 max-w-md mx-auto pb-12 text-slate-800">
      
      {/* 사진/엑셀 가져오기 결과 */}
      {importBanner && (
        <div className="bg-blue-50 text-slate-800 p-4 rounded-2xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-semibold text-slate-900 leading-snug">
              {importBanner.source}에서 {importPeriod(importBanner)} 근무 {importBanner.count}일을 등록했어요
              <span className="block text-[12px] font-normal text-slate-500 mt-1">근무표 이름: {importBanner.name}</span>
              {importBanner.counts && (
                <span className="block text-[12px] font-normal text-slate-500 mt-0.5">
                  {importBanner.counts.map(([code, n]) => `${code} ${n}`).join(' · ')} — 근무표 합계와 같은지 확인해 보세요
                </span>
              )}
            </p>
            <button onClick={onCloseImportBanner} className="w-8 h-8 -mr-1 -mt-1 flex items-center justify-center rounded-full text-slate-400 active:bg-blue-100 cursor-pointer shrink-0" aria-label="닫기">
              <X size={18} />
            </button>
          </div>
          {importBanner.uncertain.length > 0 && (
            <p className="text-[13px] text-amber-800 bg-amber-100/70 rounded-xl px-3 py-2 flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0" /> 노란 테두리 {importBanner.uncertain.length}일은 사진과 비교해 확인해 주세요 (눌러서 수정)
            </p>
          )}
          {/* 확인할 칸이 많으면(10% 이상) 대개 사진이 작거나 흐린 경우 → 다시 찍는 방법 안내 */}
          {needsRetakeHint(importBanner) && (
              <p className="text-[12px] text-slate-500" role="note">
                사진이 작거나 흐려서 확인할 칸이 많아요. 근무표를 화면에 크게 띄우거나 가까이서 반듯하게 다시 찍으면 더 정확해요.
              </p>
            )}
          {/* 사진·엑셀에서 달을 잘못 인식했으면 한 달씩 옮기기 */}
          {importBanner.imp && (
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <span>달이 틀렸나요?</span>
              <button
                onClick={() => onMoveImportMonth(-1)}
                className="flex items-center gap-0.5 bg-white text-slate-700 h-7 px-2.5 rounded-full font-medium cursor-pointer"
              >
                <ChevronLeft size={12} /> 이전 달로
              </button>
              <button
                onClick={() => onMoveImportMonth(1)}
                className="flex items-center gap-0.5 bg-white text-slate-700 h-7 px-2.5 rounded-full font-medium cursor-pointer"
              >
                다음 달로 <ChevronRight size={12} />
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onUndoImport}
              className="flex items-center gap-1 text-[13px] font-semibold bg-blue-600 text-white h-9 px-4 rounded-full cursor-pointer"
            >
              <Undo2 size={15} /> 되돌리기
            </button>
            {/* 다른 사람 줄로 들어갔으면 바로 다시 고르기 (가져오기 화면에 따로 이름 설정을 두지 않음) */}
            {Object.keys(importBanner.imp?.byName || {}).length > 1 && (
              <button
                onClick={onRepickImport}
                className="flex items-center gap-1 text-[13px] font-semibold bg-white text-slate-700 h-9 px-4 rounded-full cursor-pointer"
              >
                <UserX size={15} /> 내 이름이 아니에요
              </button>
            )}
          </div>
        </div>
      )}

      {/* 처음 쓰는 사용자: 근무 등록 방법 안내 (근무가 하나라도 생기면 사라짐)
          서버에서 근무를 불러오는 동안은 숨김 → 새 폰 로그인 직후 안내가 잠깐 떴다 사라지지 않게 */}
      {!importBanner && !loadingFromServer && Object.keys(myShifts || {}).length === 0 && (
        <section className="flex items-center gap-2 rounded-2xl bg-blue-50 pl-4 pr-2 py-2">
          <p className="flex-1 min-w-0 text-[14px] text-slate-700">아직 등록된 근무가 없어요</p>
          <button
            type="button"
            onClick={onOpenImport}
            aria-label="근무표 사진·엑셀로 등록"
            className="shrink-0 h-9 px-3 rounded-full bg-blue-600 text-white text-[13px] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Camera size={15} /> 사진
          </button>
          <button
            type="button"
            onClick={() => setIsPatternOpen('first')}
            aria-label="반복 패턴으로 입력"
            className="shrink-0 h-9 px-3 rounded-full bg-white text-blue-700 text-[13px] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Repeat size={15} /> 패턴
          </button>
        </section>
      )}

      {/* 1. 달 제목 · 이번 달 요약 */}
      <section className="pt-1">
        <div className="flex items-end justify-between">
          {/* 누르면 년·월 바로 고르기 */}
          <button type="button" onClick={() => setIsMonthPickerOpen(true)} aria-label="년·월 선택" className="text-left cursor-pointer">
            <h2 className="text-slate-900 leading-none">
              <span className="block text-[13px] font-medium text-slate-400 mb-1.5">{year}년 </span>
              <span className="text-[34px] font-bold tracking-tight">{month}월</span>
              <ChevronDown size={22} className="inline-block ml-1 -mt-1 text-slate-400" aria-hidden="true" />
            </h2>
          </button>
          <div className="flex items-center -mr-2 text-slate-700">
            <button type="button" aria-label="이전 달" onClick={() => goMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer active:bg-slate-100">
              <ChevronLeft size={24} />
            </button>
            <button type="button" aria-label="다음 달" onClick={() => goMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer active:bg-slate-100">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
        {/* 이번 달 근무 수: 근무 색 글자 + 숫자 (0건은 흐리게) */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[13px] text-slate-500">
          {Object.entries(shiftCounts).map(([code, count]) => (
            <span key={code} className={count === 0 ? 'opacity-40' : ''}>
              <b style={shiftTextVars(findType(code))} className="shift-text font-bold">{code}</b> {count}
            </span>
          ))}
        </div>
      </section>

      {/* 2. 달력 */}
      <section className="border-t border-slate-100 pt-3 space-y-2">
        {quickMode && (
          <div className="space-y-2 pb-1">
            <p className="text-[13px] text-blue-600 font-medium">
              {quickCode === '' ? '지울 날짜를 누르세요' : `날짜를 누르면 ${quickCode} 입력`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shiftTypes.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setQuickCode(t.code)}
                  style={quickCode === t.code ? { backgroundColor: t.fg, color: '#fff' } : shiftTextVars(t)}
                  className={`shrink-0 min-w-[44px] px-3 h-9 rounded-full text-sm font-bold cursor-pointer ${quickCode === t.code ? '' : 'bg-slate-100 shift-text'}`}
                >
                  {t.code}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuickCode('')}
                className={`shrink-0 px-3 h-9 rounded-full text-sm font-medium flex items-center gap-1 cursor-pointer ${
                  quickCode === '' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Eraser size={14} /> 지우기
              </button>
            </div>
          </div>
        )}

        {/* 요일 */}
        <div className="grid grid-cols-7 text-center text-[12px] font-medium">
          <span className="text-rose-500">일</span>
          <span className="text-slate-400">월</span>
          <span className="text-slate-400">화</span>
          <span className="text-slate-400">수</span>
          <span className="text-slate-400">목</span>
          <span className="text-slate-400">금</span>
          <span className="text-blue-500">토</span>
        </div>

        {/* 날짜: 숫자 + 근무 코드(근무 색 글자) */}
        <div className="grid grid-cols-7 gap-y-0.5" {...monthSwipe}>
          {calendarDays.map((item, idx) => {
            if (!item) return <div key={`empty_${idx}`} className="h-[58px]"></div>;

            const shift = myShifts[item.dateKey] || '';
            const isSelected = selectedDate === item.dateKey;
            const isToday = item.dateKey === todayKey;
            const holidayShort = getHoliday(item.dateKey) ? getHolidayShort(item.dateKey) : '';

            return (
              <button
                type="button"
                key={item.dateKey}
                onClick={() => handleDayClick(item.dateKey)}
                aria-label={`${month}월 ${item.day}일 ${shift ? `${shift} 근무` : '근무 없음'}${getHoliday(item.dateKey) ? ` ${getHoliday(item.dateKey)}` : ''}${dayNotes[item.dateKey] ? ' 메모 있음' : ''}`}
                aria-pressed={isSelected}
                className={`relative h-[58px] w-full min-w-0 pt-1 rounded-xl flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                  isSelected ? 'bg-slate-100' : uncertainSet.has(item.dateKey) ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : 'active:bg-slate-50'
                }`}
              >
                <span
                  className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[14px] leading-none ${
                    isToday ? 'bg-blue-600 !text-white font-semibold' : `font-medium ${dayNumberClass(item.dateKey)}`
                  }`}
                >
                  {item.day}
                </span>
                {shift ? (
                  <span
                    style={shiftTextVars(findType(shift))}
                    className={`shift-text max-w-full px-0.5 font-bold leading-none whitespace-nowrap overflow-hidden tracking-tight ${
                      [...shift].length >= 3 ? 'text-[10px]' : 'text-[13px]'
                    }`}
                  >
                    {shift}
                  </span>
                ) : (
                  holidayShort && <span className="text-[9px] text-rose-400 leading-none whitespace-nowrap overflow-hidden max-w-full">{holidayShort}</span>
                )}
                {dayNotes[item.dateKey] && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-amber-400" title="메모 있음" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. 고른 날짜: 근무 · 시간 · 메모 */}
      {!quickMode && (() => {
        const code = myShifts[selectedDate] || '';
        const t = code ? shiftTypes.find((x) => x.code === code) : null;
        const note = dayNotes[selectedDate];
        return (
          <button
            type="button"
            onClick={() => { setEditingDateKey(selectedDate); setIsEditModalOpen(true); }}
            className="w-full text-left border-t border-slate-100 pt-4 flex items-start justify-between gap-3 cursor-pointer"
          >
            <div className="min-w-0">
              <p className="text-[13px] text-slate-400">
                {formatDateKo(selectedDate)} 메모
                {getHoliday(selectedDate) && <span className="ml-1.5 text-rose-400">· {getHoliday(selectedDate)}</span>}
              </p>
              <p className="text-[17px] font-semibold text-slate-900 mt-1">
                {code ? (
                  <>
                    <span style={shiftTextVars(findType(code))} className="shift-text">{code}</span>
                    {t?.label && t.label !== code && <span> {t.label}</span>}
                    {t?.start && t?.end && <span className="font-normal text-slate-500"> · {t.start}–{t.end}</span>}
                  </>
                ) : (
                  <span className="text-slate-400 font-normal">근무 없음</span>
                )}
              </p>
              <p className={`text-sm mt-1 whitespace-pre-wrap break-words ${note ? 'text-slate-600' : 'text-slate-300'}`}>
                {note || '메모가 없습니다. 눌러서 추가하세요.'}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-blue-600 pt-0.5">{note ? '수정' : '메모 추가'}</span>
          </button>
        );
      })()}

      {/* 4. 도구: 아이콘 + 이름 */}
      <section className="border-t border-slate-100 pt-3 grid grid-cols-5 text-slate-600">
        {[
          { key: 'type', icon: <Palette size={22} />, label: '근무 종류', onClick: () => setIsTypeManagerOpen(true) },
          { key: 'pattern', icon: <Repeat size={22} />, label: '반복 패턴', onClick: () => setIsPatternOpen(true) },
          {
            key: 'quick',
            icon: <Zap size={22} className={quickMode ? 'text-blue-600' : ''} />,
            label: quickMode ? '입력 끝' : '빠른 입력',
            onClick: () => setQuickCode(quickMode ? null : (shiftTypes[0]?.code || '')),
            active: quickMode
          }
        ].map((b) => (
          <button key={b.key} type="button" onClick={b.onClick} className={`flex flex-col items-center gap-1 py-2 rounded-xl cursor-pointer active:bg-slate-50 ${b.active ? 'text-blue-600' : ''}`}>
            {b.icon}
            <span className="text-[11px] font-medium">{b.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => (sharePeriod ? setIsSharePickOpen(true) : handleShareImage())}
          disabled={isSharing}
          aria-label="근무표 이미지 공유"
          className="flex flex-col items-center gap-1 py-2 rounded-xl cursor-pointer active:bg-slate-50"
        >
          {isSharing ? <Loader2 size={22} className="animate-spin" /> : <Share2 size={22} />}
          <span className="text-[11px] font-medium">공유</span>
        </button>
        {/* 알림 (켜져 있어도 이 기기에 알림 권한이 없으면 '권한 필요') */}
        <button
          onClick={() => setIsAlarmModalOpen(true)}
          className={`flex flex-col items-center gap-1 py-2 rounded-xl cursor-pointer active:bg-slate-50 ${
            alarmBlocked ? 'text-rose-600' : alarmSettings.enabled ? 'text-blue-600' : ''
          }`}
        >
          {alarmBlocked ? <AlertTriangle size={22} /> : alarmSettings.enabled ? <Bell size={22} /> : <BellOff size={22} />}
          <span className="text-[11px] font-medium whitespace-nowrap">{alarmBlocked ? '권한 필요' : alarmSettings.enabled ? `${formatLead(alarmSettings.minutesBefore)} 전` : '알림'}</span>
        </button>
      </section>

      {isEditModalOpen && (
        <Modal onClose={() => setIsEditModalOpen(false)} label="근무 직접 수정">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[13px] text-slate-400">근무 직접 수정</p>
                <h3 className="text-[20px] font-bold text-slate-900 mt-0.5">{formatDateKo(editingDateKey)}</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-100 cursor-pointer"
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </div>

            {/* 근무 고르기: 근무 색 글자 + 이름 */}
            <div className="grid grid-cols-3 gap-2">
              {shiftTypes.map((item) => {
                const on = myShifts[editingDateKey] === item.code;
                return (
                  <button
                    key={item.code}
                    onClick={() => handleSelectShiftCode(item.code)}
                    className={`relative h-[68px] px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      on ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : 'bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <span aria-hidden="true" style={shiftTextVars(item)} className="shift-text text-[18px] font-bold leading-none truncate max-w-full">
                      {item.code}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-tight truncate max-w-full">{item.label}</span>
                    {on && <Check size={14} className="absolute top-1.5 right-1.5 text-blue-600" />}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handleSelectShiftCode('')}
              className="w-full h-11 text-slate-500 text-[14px] rounded-xl bg-slate-50 active:bg-slate-100 cursor-pointer"
            >
              근무 삭제 (빈 칸으로 설정)
            </button>

            <label className="block space-y-1.5">
              <span className="text-[13px] text-slate-400">메모 (나만 보기)</span>
              <textarea
                value={dayNotes[editingDateKey] || ''}
                onChange={(e) => setNote(editingDateKey, e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="예: 교육 준비물, 인계 사항, 약속"
                className="w-full px-3 py-2.5 bg-slate-100 rounded-xl text-[15px] text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              />
            </label>
          </div>
        </Modal>
      )}

      {isMonthPickerOpen && (
        <MonthPicker
          year={year}
          month={month}
          onClose={() => setIsMonthPickerOpen(false)}
          onPick={(y, m) => {
            setSelectedDate(monthPickKey(y, m));
            setIsMonthPickerOpen(false);
          }}
        />
      )}

      {isTypeManagerOpen && (
        <ShiftTypeManager
          onClose={() => setIsTypeManagerOpen(false)}
          onSave={onSaveShiftType}
          onDelete={onDeleteShiftType}
          usedDays={(code) => Object.values(myShifts || {}).filter((c) => c === code).length}
        />
      )}

      {isPatternOpen && (
        <PatternFill
          startDate={selectedDate}
          // 처음 등록할 때는 넉넉히 3개월 (이번 달 끝까지면 며칠만 채워질 수 있음)
          defaultPeriod={isPatternOpen === 'first' ? '3' : 'month'}
          myShifts={myShifts || {}}
          onClose={() => setIsPatternOpen(false)}
          onApply={(filled) => {
            // 되돌리기용: 적용 전 그 날짜들의 근무 (빈칸이었으면 null)
            const before = Object.fromEntries(Object.keys(filled).map((k) => [k, myShifts?.[k] || null]));
            setMyShifts((prev) => ({ ...(prev || {}), ...filled }));
            setIsPatternOpen(false);
            const count = Object.keys(filled).length;
            if (!count) return;
            toast(`${count}일에 반복 패턴을 입력했어요.`, 'success', {
              action: {
                label: '되돌리기',
                onClick: () => {
                  setMyShifts((prev) => {
                    const next = { ...(prev || {}) };
                    Object.entries(before).forEach(([k, v]) => {
                      if (v) next[k] = v;
                      else delete next[k];
                    });
                    return next;
                  });
                  toast('반복 패턴 입력을 되돌렸어요.');
                }
              }
            });
          }}
        />
      )}

      {/* 4. 알람 시간 설정 모달 */}
      {isSharePickOpen && (
        <Modal onClose={() => setIsSharePickOpen(false)} label="근무표 공유">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-[20px] font-bold text-slate-900">어느 기간을 보낼까요?</h3>
              <button type="button" onClick={() => setIsSharePickOpen(false)} aria-label="닫기" className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-100 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'month', name: `${month}월 전체`, range: `${month}.1 ~ ${month}.${new Date(year, month, 0).getDate()}`, period: null },
                { key: 'period', name: '정산 기간', range: `${shortDate(sharePeriod?.start || '')} ~ ${shortDate(sharePeriod?.end || '')}`, period: sharePeriod }
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => handleShareImage(o.period)}
                  className="flex flex-col items-start gap-1 rounded-2xl bg-slate-50 p-4 text-left cursor-pointer active:bg-slate-100"
                >
                  <span className="text-[16px] font-semibold text-slate-900">{o.name}</span>
                  <span className="text-[14px] text-blue-600 font-medium">{o.range}</span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {isAlarmModalOpen && (
        <Modal onClose={() => setIsAlarmModalOpen(false)} label="근무 시작 알림 설정">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[20px] font-bold text-slate-900">근무 시작 알림</h3>
                <p className="text-[13px] text-slate-400 mt-0.5">근무 시작 얼마 전에 알려 드릴까요?</p>
              </div>
              <button
                onClick={() => setIsAlarmModalOpen(false)}
                className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-100 cursor-pointer"
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </div>

            {alarmBlocked && (
              <div className="p-3 rounded-2xl bg-rose-50 space-y-2">
                <p className="text-[13px] text-rose-700">
                  {alarmPerm === 'unsupported'
                    ? '이 브라우저는 알림을 지원하지 않아요. 앱을 설치하면 알림을 받을 수 있어요.'
                    : '알림이 켜져 있지만 이 기기에서는 알림 권한이 없어서 알림이 오지 않아요.'}
                </p>
                {alarmPerm !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={() => handleToggleAlarm(alarmSettings.minutesBefore)}
                    className="w-full h-11 rounded-xl bg-rose-600 text-white text-[14px] font-semibold cursor-pointer"
                  >
                    이 기기에서 알림 허용하기
                  </button>
                )}
              </div>
            )}

            {/* 몇 분 전: 큰 칸 4개 */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { min: 30, big: '30분', label: '30분 전 알림' },
                { min: 60, big: '1시간', label: '1시간 전 알림' },
                { min: 120, big: '2시간', label: '2시간 전 알림' },
                { min: 180, big: '3시간', label: '3시간 전 알림' }
              ].map((opt) => {
                const on = alarmSettings.enabled && alarmSettings.minutesBefore === opt.min;
                return (
                  <button
                    key={opt.min}
                    onClick={() => handleToggleAlarm(opt.min)}
                    aria-label={opt.label}
                    aria-pressed={on}
                    className={`relative h-20 rounded-2xl flex flex-col items-center justify-center cursor-pointer ${
                      on ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-800 active:bg-slate-100'
                    }`}
                  >
                    <span className="text-[20px] font-bold leading-none">{opt.big}</span>
                    <span className={`text-[12px] mt-1 ${on ? 'text-blue-100' : 'text-slate-400'}`}>전에 알림</span>
                    {on && <Check size={16} className="absolute top-2 right-2" />}
                  </button>
                );
              })}
            </div>

            {isNativeApp() ? (
              <p className="text-[12px] text-slate-400">앱을 꺼 둬도 알림이 와요. 앞으로 {REMINDER_DAYS}일(최대 {MAX_REMINDERS}개)을 미리 예약해요.</p>
            ) : !usesServerPush() && (
              <p className="text-[12px] text-slate-400">웹에서는 이 화면이 열려 있을 때만 알림이 와요. 앱을 설치하면 꺼 둬도 받을 수 있어요.</p>
            )}

            {alarmSettings.enabled && (
              <button
                onClick={() => handleToggleAlarm()}
                className="w-full h-11 text-rose-600 text-[14px] font-medium rounded-xl bg-rose-50 cursor-pointer"
              >
                알림 끄기 (해제)
              </button>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
}
