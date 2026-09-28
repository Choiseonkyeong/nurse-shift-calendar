import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Bell, BellOff, Edit3, Check, X, Shield, ChevronLeft, ChevronRight, Zap, Eraser, Palette, Repeat, StickyNote } from 'lucide-react';
import { useShiftTypes, badgeStyle } from '../lib/shiftTypes';
import ShiftTypeManager from './ShiftTypeManager';
import PatternFill from './PatternFill';
import { getHoliday, dayNumberClass } from '../utils/holidays';
import { addMonthsKey, toDateKey } from '../utils/dateUtils';
import { isNativePush, enablePushReminders, disablePushReminders } from '../lib/pushNotifications';

export default function MyShiftTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  shiftConfigs = {},
  userName = '최수민',
  profile,
  alarmSettings,
  setAlarmSettings,
  onSaveShiftType,
  onDeleteShiftType,
  dayNotes = {},
  setDayNotes
}) {
  // 메모 수정: 빈 값이면 삭제
  const setNote = (dateKey, text) => {
    setDayNotes((prev) => {
      const next = { ...(prev || {}) };
      if (text.trim()) next[dateKey] = text.slice(0, 500);
      else delete next[dateKey];
      return next;
    });
  };
  const [year, month] = (selectedDate || '2026-09-01').split('-').map(Number);
  
  // 근무 직접 수정 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDateKey, setEditingDateKey] = useState('');

  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);

  const shiftTypes = useShiftTypes();
  // 빠른 입력: null = 꺼짐, '' = 지우기, 그 외 = 선택한 근무 코드
  const [quickCode, setQuickCode] = useState(null);
  const quickMode = quickCode !== null;
  const [isTypeManagerOpen, setIsTypeManagerOpen] = useState(false);
  const [isPatternOpen, setIsPatternOpen] = useState(false);

  // 알림 권한 요청 및 타이머 등록
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('이 브라우저는 알림 기능을 지원하지 않습니다.');
      return false;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      alert('알림 권한이 거부되었습니다. 브라우저 설정에서 알림 권한을 허용해 주세요.');
      return false;
    }
    return true;
  };

  const formatLead = (m) => (m >= 60 ? `${m / 60}시간` : `${m}분`);

  // 네이티브 앱: 서버 푸시(FCM) — 앱이 종료돼 있어도 알림 도착
  const handleToggleNativeAlarm = async (minutes) => {
    if (!profile) {
      alert('서버에 연결되지 않았습니다. 네트워크 확인 후 다시 시도해 주세요.');
      return;
    }
    const turningOn = !alarmSettings.enabled || minutes !== undefined;
    const minutesBefore = minutes || alarmSettings.minutesBefore;
    try {
      if (turningOn) {
        const granted = await enablePushReminders({ minutesBefore, shiftTimes: shiftConfigs.shiftTimes });
        if (!granted) {
          alert('알림 권한이 거부되었습니다. 휴대폰 설정 > 앱 > 알림에서 허용해 주세요.');
          return;
        }
        setAlarmSettings({ enabled: true, minutesBefore });
        alert(`🔔 근무 시작 ${formatLead(minutesBefore)} 전 알림이 설정되었습니다.\n앱을 종료해도 알림이 도착합니다.`);
      } else {
        await disablePushReminders({ minutesBefore });
        setAlarmSettings({ ...alarmSettings, enabled: false });
        alert('🔕 알림이 해제되었습니다.');
      }
    } catch (err) {
      alert(`알림 설정 실패: ${err.message}`);
    } finally {
      setIsAlarmModalOpen(false);
    }
  };

  // 알림 설정 토글/변경
  const handleToggleAlarm = async (minutes) => {
    if (isNativePush()) return handleToggleNativeAlarm(minutes);

    if (!alarmSettings.enabled || minutes !== undefined) {
      const granted = await requestNotificationPermission();
      if (!granted) return;

      const newSettings = { enabled: true, minutesBefore: minutes || alarmSettings.minutesBefore };
      setAlarmSettings(newSettings); // 실제 예약은 아래 useEffect 가 담당
      alert(`🔔 근무 시작 ${newSettings.minutesBefore >= 60 ? `${newSettings.minutesBefore / 60}시간` : `${newSettings.minutesBefore}분`} 전 알림이 설정되었습니다.`);
    } else {
      setAlarmSettings({ ...alarmSettings, enabled: false });
      alert('🔕 알림이 해제되었습니다.');
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
    if (isNativePush() || !alarmSettings?.enabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

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
        new Notification(`⏰ [근무 알림] ${userName} 님!`, {
          body: `잠시 후 (${startTimeStr}) ${code} 근무가 시작됩니다. 준비해 주세요!`,
          icon: '/favicon.ico'
        });
      }, delay));
    });

    return () => timers.forEach(clearTimeout);
  }, [alarmSettings?.enabled, alarmSettings?.minutesBefore, myShifts, shiftConfigs.shiftTimes, shiftTypes, userName, dayTick]);

  // 이전/다음 달 이동
  const goMonth = (delta) => setSelectedDate(addMonthsKey(selectedDate, delta));

  // 날짜 클릭 시 수정 모달 오픈
  const handleDayClick = (dateKey) => {
    setSelectedDate(dateKey);
    if (quickMode) {
      // 빠른 입력: 팝업 없이 선택한 근무를 바로 적용
      setMyShifts((prev) => ({ ...(prev || {}), [dateKey]: quickCode }));
      return;
    }
    setEditingDateKey(dateKey);
    setIsEditModalOpen(true);
  };

  // 근무 코드 변경 처리
  const handleSelectShiftCode = (code) => {
    if (!editingDateKey) return;
    const updated = { ...myShifts, [editingDateKey]: code };
    setMyShifts(updated);
    setIsEditModalOpen(false);
  };

  // 캘린더 날짜 계산
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const lastDateOfMonth = new Date(year, month, 0).getDate();
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

  const getBadgeStyle = (code) => badgeStyle(shiftTypes, code);

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-12 text-slate-800">
      
      {/* 1. 월간 요약 카드 & 알림 버튼 */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => goMonth(-1)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-lg font-black text-slate-900 min-w-[7rem] text-center">{year}년 {month}월</h2>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => goMonth(1)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 알람 설정 버튼 */}
          <button
            onClick={() => setIsAlarmModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black transition border cursor-pointer ${
              alarmSettings.enabled
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
            }`}
          >
            {alarmSettings.enabled ? <Bell size={13} className="fill-amber-500" /> : <BellOff size={13} />}
            <span>{alarmSettings.enabled ? `${alarmSettings.minutesBefore >= 60 ? `${alarmSettings.minutesBefore / 60}시간` : `${alarmSettings.minutesBefore}분`} 전 알림` : '알림 설정'}</span>
          </button>
        </div>

        {/* 근무 요약 칩 */}
        {/* 달력 근무 칩과 동일한 색상 사용, 0건은 흐리게 */}
        <div
          className="grid gap-1.5 pt-1 text-center"
          style={{ gridTemplateColumns: `repeat(${Math.min(Object.keys(shiftCounts).length, 6)}, minmax(0, 1fr))` }}
        >
          {Object.entries(shiftCounts).map(([code, count]) => (
            <div
              key={code}
              style={getBadgeStyle(code)}
              className={`py-2 rounded-2xl flex flex-col items-center gap-0.5 transition ${count === 0 ? 'opacity-40' : ''}`}
            >
              <span className="text-[11px] font-black leading-none truncate max-w-full px-0.5">{code}</span>
              <span className="text-base font-black leading-tight">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 메인 근무 달력 */}
      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-3">
        {/* 빠른 입력: 근무를 고르고 날짜를 연속으로 터치 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 min-w-0 truncate">
              {quickMode ? (quickCode === '' ? '지울 날짜 터치' : `터치 → ${quickCode}`) : ''}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsTypeManagerOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-2xl text-xs font-black border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition cursor-pointer whitespace-nowrap"
            >
              <Palette size={13} /> 종류
            </button>
            <button
              type="button"
              onClick={() => setIsPatternOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-2xl text-xs font-black border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition cursor-pointer whitespace-nowrap"
            >
              <Repeat size={13} /> 패턴
            </button>
            <button
              type="button"
              onClick={() => setQuickCode(quickMode ? null : (shiftTypes[0]?.code || ''))}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-2xl text-xs font-black border transition cursor-pointer whitespace-nowrap ${
                quickMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Zap size={13} className={quickMode ? 'fill-white' : ''} />
              {quickMode ? '입력 끝' : '빠른 입력'}
            </button>
            </div>
          </div>

          {quickMode && (
            <div className="flex flex-wrap gap-1.5 p-0.5">
              {shiftTypes.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setQuickCode(t.code)}
                  style={{ backgroundColor: t.bg, color: t.fg }}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-black transition cursor-pointer ${
                    quickCode === t.code ? 'ring-2 ring-offset-1 ring-indigo-500 scale-105' : 'opacity-80'
                  }`}
                >
                  {t.code}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuickCode('')}
                className={`shrink-0 px-3 py-2 rounded-full text-xs font-black bg-white border border-slate-200 text-slate-500 flex items-center gap-1 transition cursor-pointer ${
                  quickCode === '' ? 'ring-2 ring-offset-1 ring-indigo-500' : ''
                }`}
              >
                <Eraser size={12} /> 지우기
              </button>
            </div>
          )}
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center font-bold text-xs border-b border-slate-100 pb-2">
          <span className="text-rose-500">일</span>
          <span className="text-slate-400">월</span>
          <span className="text-slate-400">화</span>
          <span className="text-slate-400">수</span>
          <span className="text-slate-400">목</span>
          <span className="text-slate-400">금</span>
          <span className="text-sky-500">토</span>
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((item, idx) => {
            if (!item) return <div key={`empty_${idx}`} className="min-h-[64px]"></div>;

            const shift = myShifts[item.dateKey] || '';
            const isSelected = selectedDate === item.dateKey;
            const badgeStyle = getBadgeStyle(shift);

            return (
              <div
                key={item.dateKey}
                onClick={() => handleDayClick(item.dateKey)}
                className={`min-h-[64px] p-1.5 rounded-2xl border transition flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-200 bg-indigo-50/20'
                    : 'border-slate-100 bg-slate-50/30 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className={`text-[11px] font-black px-0.5 ${dayNumberClass(item.dateKey)}`}>{item.day}</span>
                  {dayNotes[item.dateKey] && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400" title="메모 있음" />}
                </div>
                {getHoliday(item.dateKey) && (
                  <span className="text-[8px] font-bold text-rose-400 leading-none truncate px-0.5">{getHoliday(item.dateKey)}</span>
                )}

                {shift ? (
                  <div
                    style={badgeStyle}
                    className="w-full py-1 text-center rounded-xl font-black text-xs shadow-2xs mt-1"
                  >
                    {shift}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-300 font-bold text-center pb-1 whitespace-nowrap">{quickMode ? '' : '+ 수정'}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 근무 직접 수정 모달 (팝업) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl p-5 space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900 flex items-center gap-1.5">
                  <Edit3 size={16} className="text-indigo-600" /> 근무 직접 수정
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5">{editingDateKey}</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* 근무 선택 버튼 그리드 */}
            <div className="grid grid-cols-2 gap-2">
              {shiftTypes.map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleSelectShiftCode(item.code)}
                  style={{ backgroundColor: item.bg, color: item.fg }}
                  className="py-3 px-3 rounded-2xl font-black text-xs flex items-center justify-between shadow-2xs hover:scale-[1.02] transition cursor-pointer"
                >
                  <span>{item.label}</span>
                  {myShifts[editingDateKey] === item.code && <Check size={14} />}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleSelectShiftCode('')}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs rounded-2xl transition cursor-pointer"
            >
              근무 삭제 (빈 칸으로 설정)
            </button>

            <label className="block space-y-1 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <StickyNote size={12} className="text-amber-500" /> 메모 (나만 보기)
              </span>
              <textarea
                value={dayNotes[editingDateKey] || ''}
                onChange={(e) => setNote(editingDateKey, e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="예: 교육 준비물, 인계 사항, 약속"
                className="w-full px-3 py-2 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-amber-300 resize-none"
              />
            </label>
          </div>
        </div>
      )}

      {/* 선택한 날짜 메모 */}
      {!quickMode && (
        <button
          type="button"
          onClick={() => { setEditingDateKey(selectedDate); setIsEditModalOpen(true); }}
          className="w-full text-left bg-white p-4 rounded-3xl shadow-xs border border-slate-100 flex items-start gap-2 cursor-pointer hover:bg-slate-50 transition"
        >
          <StickyNote size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-black text-slate-400">
              {selectedDate} 메모
              {getHoliday(selectedDate) && <span className="ml-1.5 text-rose-400">· {getHoliday(selectedDate)}</span>}
            </p>
            <p className={`text-xs font-bold whitespace-pre-wrap break-words ${dayNotes[selectedDate] ? 'text-slate-700' : 'text-slate-300'}`}>
              {dayNotes[selectedDate] || '메모가 없습니다. 눌러서 추가하세요.'}
            </p>
          </div>
        </button>
      )}

      {isTypeManagerOpen && (
        <ShiftTypeManager
          onClose={() => setIsTypeManagerOpen(false)}
          onSave={onSaveShiftType}
          onDelete={onDeleteShiftType}
          isCodeInUse={(code) => Object.values(myShifts || {}).includes(code)}
        />
      )}

      {isPatternOpen && (
        <PatternFill
          startDate={selectedDate}
          myShifts={myShifts || {}}
          onClose={() => setIsPatternOpen(false)}
          onApply={(filled) => {
            setMyShifts((prev) => ({ ...(prev || {}), ...filled }));
            setIsPatternOpen(false);
          }}
        />
      )}

      {/* 4. 알람 시간 설정 모달 */}
      {isAlarmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl p-5 space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-1.5">
                <Bell size={16} className="text-amber-500" /> 근무 시작 알림 설정
              </h3>
              <button
                onClick={() => setIsAlarmModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { min: 30, label: '30분 전 알림' },
                { min: 60, label: '1시간 전 알림' },
                { min: 120, label: '2시간 전 알림' },
                { min: 180, label: '3시간 전 알림' }
              ].map((opt) => (
                <button
                  key={opt.min}
                  onClick={() => handleToggleAlarm(opt.min)}
                  className={`w-full py-2.5 px-4 rounded-2xl font-black text-xs flex justify-between items-center transition cursor-pointer ${
                    alarmSettings.enabled && alarmSettings.minutesBefore === opt.min
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{opt.label}</span>
                  {alarmSettings.enabled && alarmSettings.minutesBefore === opt.min && <Check size={14} />}
                </button>
              ))}
            </div>

            {alarmSettings.enabled && (
              <button
                onClick={() => handleToggleAlarm()}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs rounded-2xl transition cursor-pointer"
              >
                알림 끄기 (해제)
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
