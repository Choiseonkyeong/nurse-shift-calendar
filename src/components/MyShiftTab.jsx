import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Bell, BellOff, Edit3, Check, X, Shield } from 'lucide-react';

export default function MyShiftTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  shiftConfigs = {},
  userName = '최수민'
}) {
  const [year, month] = (selectedDate || '2026-09-01').split('-').map(Number);
  
  // 근무 직접 수정 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDateKey, setEditingDateKey] = useState('');

  // 알람 설정 상태 (localStorage 저장)
  const [alarmSettings, setAlarmSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('shift_alarm_settings');
      return saved ? JSON.parse(saved) : { enabled: false, minutesBefore: 60 };
    } catch (e) {
      return { enabled: false, minutesBefore: 60 };
    }
  });

  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('shift_alarm_settings', JSON.stringify(alarmSettings));
  }, [alarmSettings]);

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

  // 알림 설정 토글/변경
  const handleToggleAlarm = async (minutes) => {
    if (!alarmSettings.enabled || minutes !== undefined) {
      const granted = await requestNotificationPermission();
      if (!granted) return;

      const newSettings = { enabled: true, minutesBefore: minutes || alarmSettings.minutesBefore };
      setAlarmSettings(newSettings);
      scheduleShiftNotifications(newSettings.minutesBefore);
      alert(`🔔 근무 시작 ${newSettings.minutesBefore >= 60 ? `${newSettings.minutesBefore / 60}시간` : `${newSettings.minutesBefore}분`} 전 알림이 설정되었습니다.`);
    } else {
      setAlarmSettings({ ...alarmSettings, enabled: false });
      alert('🔕 알림이 해제되었습니다.');
    }
    setIsAlarmModalOpen(false);
  };

  // 근무 시작 알림 예약 로직
  const scheduleShiftNotifications = (minutesBefore) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // 오늘 및 내일 근무 체크 후 알림 예약
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysShift = myShifts[todayStr];

    if (todaysShift && todaysShift !== 'OFF' && todaysShift !== '연차') {
      const shiftTimes = shiftConfigs.shiftTimes || {
        D: { time: '07:30 - 15:30' },
        E: { time: '14:30 - 22:30' },
        N: { time: '21:30 - 08:00' },
        M: { time: '09:00 - 17:00' }
      };

      const startTimeStr = shiftTimes[todaysShift]?.time?.split('-')[0]?.trim();
      if (startTimeStr) {
        const [hours, mins] = startTimeStr.split(':').map(Number);
        const shiftDate = new Date();
        shiftDate.setHours(hours, mins, 0, 0);

        const alarmTime = new Date(shiftDate.getTime() - minutesBefore * 60 * 1000);
        const now = new Date();

        const timeToAlarm = alarmTime.getTime() - now.getTime();
        if (timeToAlarm > 0) {
          setTimeout(() => {
            new Notification(`⏰ [근무 알림] ${userName} 님!`, {
              body: `잠시 후 (${startTimeStr}) ${todaysShift} 근무가 시작됩니다. 준비해 주세요!`,
              icon: '/favicon.ico'
            });
          }, timeToAlarm);
        }
      }
    }
  };

  // 날짜 클릭 시 수정 모달 오픈
  const handleDayClick = (dateKey) => {
    setSelectedDate(dateKey);
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
  const shiftCounts = { D: 0, E: 0, N: 0, M: 0, OFF: 0, 연차: 0 };
  Object.entries(myShifts || {}).forEach(([key, val]) => {
    if (key.startsWith(`${year}-${String(month).padStart(2, '0')}`) && val) {
      if (shiftCounts[val] !== undefined) shiftCounts[val]++;
    }
  });

  const getBadgeStyle = (shift) => {
    switch (shift) {
      case 'D': return { backgroundColor: '#FEF08A', color: '#854D0E' };
      case 'E': return { backgroundColor: '#FFEDD5', color: '#9A3412' };
      case 'N': return { backgroundColor: '#E0F2FE', color: '#0369A1' };
      case 'M': return { backgroundColor: '#F3E8FF', color: '#6B21A8' };
      case '연차': return { backgroundColor: '#FFE4E6', color: '#E11D48' };
      default: return { backgroundColor: '#F1F5F9', color: '#475569' };
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-12 text-slate-800">
      
      {/* 1. 월간 요약 카드 & 알림 버튼 */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900">{year}년 {month}월</h2>
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
        <div className="grid grid-cols-6 gap-1.5 pt-1 text-center">
          {Object.entries(shiftCounts).map(([code, count]) => (
            <div key={code} className="p-2 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 block">{code}</span>
              <span className="text-sm font-black text-slate-800">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 메인 근무 달력 */}
      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-3">
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
                <span className="text-[11px] font-black text-slate-700 px-0.5">{item.day}</span>

                {shift ? (
                  <div
                    style={badgeStyle}
                    className="w-full py-1 text-center rounded-xl font-black text-xs shadow-2xs mt-1"
                  >
                    {shift}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-300 font-bold text-center pb-1">+ 수정</div>
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
              {[
                { code: 'D', label: 'Day (데이)', color: '#FEF08A', textColor: '#854D0E' },
                { code: 'E', label: 'Evening (이브닝)', color: '#FFEDD5', textColor: '#9A3412' },
                { code: 'N', label: 'Night (나이트)', color: '#E0F2FE', textColor: '#0369A1' },
                { code: 'M', label: 'Mid (미드)', color: '#F3E8FF', textColor: '#6B21A8' },
                { code: 'OFF', label: 'OFF (휴무)', color: '#F1F5F9', textColor: '#475569' },
                { code: '연차', label: '연차 (휴가)', color: '#FFE4E6', textColor: '#E11D48' }
              ].map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleSelectShiftCode(item.code)}
                  style={{ backgroundColor: item.color, color: item.textColor }}
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
          </div>
        </div>
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
