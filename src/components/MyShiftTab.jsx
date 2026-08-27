import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Trash2, Bell, Clock, Volume2, Check, Lock } from 'lucide-react';

export default function MyShiftTab({
  currentYear,
  currentMonth,
  selectedDate,
  setSelectedDate,
  handlePrevMonth,
  handleNextMonth,
  shiftConfigs,
  myShifts,
  memos,
  today,
  handleShiftChange,
  memoText,
  setMemoText,
  isPrivateMemo,
  setIsPrivateMemo,
  setMemos
}) {
  const [memoCategory, setMemoCategory] = useState('인수인계');
  const [ampm, setAmpm] = useState('오전');
  const [hour, setHour] = useState('11');
  const [minute, setMinute] = useState('00');
  const [alertOffset, setAlertOffset] = useState('5'); // 5분 전
  const [alertType, setAlertType] = useState('both'); // 소리+진동

  // Web Audio API를 이용한 오디오 생성 (외부 파일 로드 에러 방지)
  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 톤
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio playback prevented:', e);
    }
  };

  // 진동 및 소리 실행 함수
  const triggerAlarmAlert = (type) => {
    if (type === 'both' || type === 'sound') {
      playBeepSound();
    }
    if ((type === 'both' || type === 'vibrate') && 'vibrate' in navigator) {
      navigator.vibrate([300, 150, 300, 150, 300]);
    }
  };

  // 브라우저 알림 권한 요청 및 타이머 주기적 체크 (1분 간격)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      checkAndTriggerMemos();
    }, 30000); // 30초마다 확인

    return () => clearInterval(interval);
  }, [memos]);

  // 알림 시간 매칭 정밀 계산 로직
  const checkAndTriggerMemos = () => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curDay = String(now.getDate()).padStart(2, '0');
    const dateKey = `${curYear}-${curMonth}-${curDay}`;

    const todayMemos = memos[dateKey] || [];

    todayMemos.forEach((m) => {
      if (!m.alertOffset || m.alertOffset === 'none' || m.triggered) return;

      // 시간 파싱 (오전/오후 11:00 -> Date 객체)
      let [ap, timeStr] = m.time.split(' ');
      let [h, min] = timeStr.split(':').map(Number);
      if (ap === '오후' && h < 12) h += 12;
      if (ap === '오전' && h === 12) h = 0;

      const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0);
      const alertTime = new Date(targetTime.getTime() - parseInt(m.alertOffset, 10) * 60000);

      // 현재 시간이 사전 알림 시각 범위 내에 들어왔을 때 실행
      if (now >= alertTime && now < new Date(targetTime.getTime() + 60000)) {
        // 알림 중복 트리거 방지 플래그
        setMemos(prev => ({
          ...prev,
          [dateKey]: prev[dateKey].map(item => item.id === m.id ? { ...item, triggered: true } : item)
        }));

        triggerAlarmAlert(m.alertType || 'both');

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`⏰ [간호 근무 알림] ${m.type}`, {
            body: `${m.text}\n시간: ${m.time} (${m.alertText})`,
            icon: '/favicon.ico'
          });
        } else {
          alert(`⏰ [알림] ${m.type}\n내용: ${m.text}\n시간: ${m.time} (${m.alertText})`);
        }
      }
    });
  };

  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const days = [];

    const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDay = prevMonthLastDay - i;
      const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
      days.push({ dateStr: `${prevY}-${String(prevM).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`, dayNum: prevDay, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ dateStr: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`, dayNum: i, isCurrentMonth: true });
    }

    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
      days.push({ dateStr: `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`, dayNum: i, isCurrentMonth: false });
    }
    return days;
  };

  const handleAddMemoInternal = () => {
    if (!memoText.trim()) return;

    // 사용자 알림 권한 미리 승인 유도
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const alertTextMap = {
      'none': '알림 없음',
      '0': '정시 알림',
      '5': '5분 전 알림',
      '10': '10분 전 알림',
      '15': '15분 전 알림',
      '30': '30분 전 알림',
      '60': '1시간 전 알림'
    };

    const formattedTime = `${ampm} ${hour}:${minute}`;

    const newMemo = {
      id: Date.now(),
      type: memoCategory,
      time: formattedTime,
      alertOffset: alertOffset,
      alertText: alertTextMap[alertOffset] || '정시 알림',
      alertType: alertType,
      text: memoText,
      isPrivate: isPrivateMemo,
      checked: false,
      triggered: false
    };

    setMemos(prev => ({
      ...prev,
      [selectedDate]: [...(prev[selectedDate] || []), newMemo]
    }));

    setMemoText('');
    if (setIsPrivateMemo) setIsPrivateMemo(false);
  };

  const currentSelectedShiftCode = myShifts[selectedDate] || '';

  return (
    <div className="space-y-3.5">
      {/* 1. 상단 달 변경 및 근무 요약 배지 */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="font-black text-lg text-slate-900">{currentYear}년 {currentMonth}월</h2>
            <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1 text-center text-xs">
          {Object.entries(shiftConfigs).map(([code, info]) => (
            <div key={code} style={{ backgroundColor: info.color, color: info.textColor }} className="p-1.5 rounded-xl font-extrabold flex flex-col justify-between shadow-xs">
              <span className="text-[10px] opacity-80">{code}</span>
              <span className="text-xs font-black mt-0.5">
                {Object.entries(myShifts).filter(([d, c]) => c === code && d.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)).length}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 캘린더 그리드 */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200 space-y-2 select-none">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-slate-400 pb-1">
          <span className="text-rose-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-sky-500">토</span>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {generateCalendarDays().map(({ dateStr, dayNum, isCurrentMonth }) => {
            const code = myShifts[dateStr] || '';
            const info = shiftConfigs[code];
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today.dateStr;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`relative aspect-square rounded-2xl p-1 flex flex-col justify-between transition-all border-2 ${
                  !isCurrentMonth ? 'opacity-20 grayscale-[50%]' : 'opacity-100'
                } ${
                  isSelected 
                    ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100 z-10 scale-105' 
                    : isToday 
                      ? 'border-amber-500 ring-2 ring-amber-100' 
                      : 'border-transparent'
                }`}
                style={{ backgroundColor: info ? info.color : '#FFFFFF' }}
              >
                <div className="flex justify-between items-center w-full px-0.5">
                  <span className="text-[10px] font-black opacity-80" style={{ color: info ? info.textColor : '#64748B' }}>
                    {dayNum}
                  </span>
                  {isToday && (
                    <span className="text-[7px] bg-amber-500 text-white font-black px-1 rounded-xs">
                      오늘
                    </span>
                  )}
                </div>
                <span className="text-xs font-black pb-0.5 text-center" style={{ color: info ? info.textColor : '#94A3B8' }}>
                  {code || ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 근무 빠른 등록 및 상세 사전 알림 설정 */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200 space-y-3">
        {/* 근무 수동 선택 */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center text-xs font-extrabold text-slate-800">
            <span className="flex items-center gap-1">
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>{selectedDate} 근무 등록</span>
            </span>
            <span className="text-indigo-600 font-bold">{currentSelectedShiftCode ? shiftConfigs[currentSelectedShiftCode]?.name : '미등록'}</span>
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {Object.entries(shiftConfigs).map(([typeKey, typeInfo]) => (
              <button
                key={typeKey}
                onClick={() => handleShiftChange(selectedDate, typeKey)}
                style={{ 
                  backgroundColor: currentSelectedShiftCode === typeKey ? typeInfo.color : '#FFFFFF',
                  borderColor: currentSelectedShiftCode === typeKey ? typeInfo.textColor : '#E2E8F0',
                  color: typeInfo.textColor
                }}
                className={`py-1.5 rounded-xl text-[11px] font-black border transition ${
                  currentSelectedShiftCode === typeKey ? 'ring-2 ring-indigo-200 scale-105' : ''
                }`}
              >
                {typeKey}
              </button>
            ))}
            <button
              onClick={() => handleShiftChange(selectedDate, '')}
              className="py-1.5 rounded-xl text-[11px] font-black border bg-white border-slate-200 text-slate-400 hover:bg-slate-100 flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 일정, 시간, 사전 알림 및 비공개 설정 */}
        <div className="space-y-2.5 pt-1">
          <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-indigo-600" />
            <span>상세 시간 및 사전 알림 설정</span>
          </span>

          <div className="space-y-2 bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100">
            {/* 카테고리 태그 */}
            <div className="flex gap-1.5 text-xs">
              {['인수인계', '중요/공지', '개인일정'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setMemoCategory(cat)}
                  className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition ${
                    memoCategory === cat ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 오전/오후 시간 + 사전 알림 선택 */}
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded-xl border border-slate-200">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select value={ampm} onChange={(e) => setAmpm(e.target.value)} className="bg-transparent font-black outline-none cursor-pointer">
                  <option value="오전">오전</option>
                  <option value="오후">오후</option>
                </select>
                <select value={hour} onChange={(e) => setHour(e.target.value)} className="bg-transparent font-black outline-none cursor-pointer">
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                    <option key={h} value={h}>{h}시</option>
                  ))}
                </select>
                <select value={minute} onChange={(e) => setMinute(e.target.value)} className="bg-transparent font-black outline-none cursor-pointer">
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                    <option key={m} value={m}>{m}분</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-white px-2 py-1.5 rounded-xl border border-slate-200">
                <Bell className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select value={alertOffset} onChange={(e) => setAlertOffset(e.target.value)} className="bg-transparent font-black text-indigo-600 outline-none cursor-pointer flex-1">
                  <option value="none">알림 없음</option>
                  <option value="0">정시 알림</option>
                  <option value="5">5분 전 알림</option>
                  <option value="10">10분 전 알림</option>
                  <option value="15">15분 전 알림</option>
                  <option value="30">30분 전 알림</option>
                  <option value="60">1시간 전 알림</option>
                </select>
              </div>
            </div>

            {/* 소리 / 진동 옵션 */}
            <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                <span>알림 방식:</span>
              </span>
              <select value={alertType} onChange={(e) => setAlertType(e.target.value)} className="bg-transparent font-black text-indigo-600 outline-none cursor-pointer">
                <option value="both">🔊 소리 + 📳 진동</option>
                <option value="sound">🔊 소리만</option>
                <option value="vibrate">📳 진동만</option>
                <option value="silent">🔇 무음 (화면 팝업)</option>
              </select>
            </div>

            {/* 일정 내용 입력 */}
            <div className="flex items-center gap-2 pt-0.5">
              <input 
                type="text" 
                placeholder="예: 인수인계 준비 및 병동 상태 확인" 
                value={memoText} 
                onChange={(e) => setMemoText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMemoInternal()}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 flex-1 bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
              <button 
                onClick={handleAddMemoInternal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs transition shadow-xs"
              >
                등록
              </button>
            </div>

            {/* 비공개 옵션 */}
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 pt-1">
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={isPrivateMemo || false} 
                  onChange={(e) => setIsPrivateMemo && setIsPrivateMemo(e.target.checked)} 
                  className="w-3.5 h-3.5 rounded text-indigo-600"
                />
                <Lock className="w-3 h-3 text-slate-400" />
                <span>비공개 일정 (그룹에 공유 안 함)</span>
              </label>
            </div>
          </div>

          {/* 등록된 알림 일정 목록 */}
          <div className="space-y-1.5 pt-1">
            {(memos[selectedDate] || []).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2 font-bold">등록된 알림 일정이 없습니다.</p>
            ) : (
              memos[selectedDate].map((m) => (
                <div 
                  key={m.id} 
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                    m.checked ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <button 
                      onClick={() => {
                        setMemos(prev => ({
                          ...prev,
                          [selectedDate]: prev[selectedDate].map(item => item.id === m.id ? { ...item, checked: !item.checked } : item)
                        }));
                      }}
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                        m.checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {m.checked && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">{m.type}</span>
                        <span className="font-black text-slate-800">{m.time}</span>
                        {m.alertText && m.alertText !== '알림 없음' && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 font-black px-1.5 py-0.5 rounded border border-amber-200">
                            🔔 {m.alertText}
                          </span>
                        )}
                        {m.isPrivate && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> 비공개
                          </span>
                        )}
                      </div>
                      <p className={`font-bold text-slate-800 ${m.checked ? 'line-through text-slate-400' : ''}`}>{m.text}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setMemos(prev => ({
                        ...prev,
                        [selectedDate]: prev[selectedDate].filter(item => item.id !== m.id)
                      }));
                    }}
                    className="text-slate-300 hover:text-rose-500 p-1 transition"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
