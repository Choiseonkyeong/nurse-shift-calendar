import React, { useState } from 'react';
import { useShiftTypes, findShiftType } from '../lib/shiftTypes';

export default function AllowanceTab({
  myShifts = {},
  selectedDate,
  shiftConfigs = {},
  setShiftConfigs,
  privacyBlur = false
}) {
  // 보안 모드: 시급·수당 금액 가리기
  const blurCls = privacyBlur ? 'blur-[5px] select-none' : '';
  const shiftTypes = useShiftTypes();
  const workTypes = shiftTypes.filter((t) => t.kind === 'work');
  const leaveTypes = shiftTypes.filter((t) => t.kind === 'leave');
  const [year, month] = selectedDate ? selectedDate.split('-').map(Number) : [2026, 9];

  // 1. 커스텀 정산 시작일 설정 (기본값: 26일)
  const [startDay, setStartDay] = useState(shiftConfigs.startDay || 26);

  // 선택한 시작일에 따라 동적으로 정산 날짜 범위(시작일 ~ 종료일) 계산
  const getCycleRange = (y, m, day) => {
    const curM = String(m).padStart(2, '0');

    if (day === 1) {
      // 1일 선택 시: 당월 1일 ~ 당월 말일
      const lastDay = new Date(y, m, 0).getDate();
      return {
        startDateStr: `${y}-${curM}-01`,
        endDateStr: `${y}-${curM}-${String(lastDay).padStart(2, '0')}`
      };
    } else {
      // 2일 이상 선택 시: 전월 startDay일 ~ 당월 (startDay - 1)일
      const prevDateObj = new Date(y, m - 2, day);
      const prevY = prevDateObj.getFullYear();
      const prevM = String(prevDateObj.getMonth() + 1).padStart(2, '0');
      const startD = String(day).padStart(2, '0');
      const endD = String(day - 1).padStart(2, '0');

      return {
        startDateStr: `${prevY}-${prevM}-${startD}`,
        endDateStr: `${y}-${curM}-${endD}`
      };
    }
  };

  const { startDateStr, endDateStr } = getCycleRange(year, month, Number(startDay));

  // 2. 근무별 시간 및 야간 인정시간 (D -> M -> E -> N)
  const [shiftTimes, setShiftTimes] = useState(
    shiftConfigs.shiftTimes || {
      D: { time: '' },
      M: { time: '', nightHours: 0 },
      E: { time: '', nightHours: 0 },
      N: { time: '', nightHours: 0 }
    }
  );

  // 3. 연차 현황 상태
  const [vacation, setVacation] = useState(
    shiftConfigs.vacation || {
      total: 15,
      used: 0
    }
  );

  // 4. 통상 시급 상태
  const [hourlyWage, setHourlyWage] = useState(shiftConfigs.hourlyWage || 0);

  // 시작일 변경 및 상위 상태 저장 헬퍼
  const handleStartDayChange = (day) => {
    const newDay = Number(day);
    setStartDay(newDay);
    if (setShiftConfigs) {
      setShiftConfigs({ ...shiftConfigs, startDay: newDay });
    }
  };

  // 'HH:MM - HH:MM' ↔ [시작, 종료] (기존 저장 형식 유지: 알림/서버 동기화가 이 형식을 사용)
  const splitTime = (time) => {
    const [start = '', end = ''] = String(time || '').split('-').map((t) => t.trim());
    const norm = (t) => (/^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, '0') : '');
    return [norm(start), norm(end)];
  };
  const updateTimePart = (code, index, value) => {
    const parts = splitTime(shiftTimes[code]?.time);
    parts[index] = value;
    updateShiftTimes(code, 'time', parts[0] || parts[1] ? `${parts[0]} - ${parts[1]}` : '');
  };

  const updateShiftTimes = (code, field, value) => {
    const updated = {
      ...shiftTimes,
      [code]: { ...shiftTimes[code], [field]: value }
    };
    setShiftTimes(updated);
    if (setShiftConfigs) {
      setShiftConfigs({ ...shiftConfigs, shiftTimes: updated, vacation, hourlyWage, startDay });
    }
  };

  // 5. 계산된 정산 범위 내 근무 횟수 정밀 집계
  const shiftCounts = Object.fromEntries(shiftTypes.map((t) => [t.code, 0]));

  Object.entries(myShifts || {}).forEach(([dateKey, code]) => {
    if (dateKey >= startDateStr && dateKey <= endDateStr && code) {
      if (shiftCounts[code] !== undefined) {
        shiftCounts[code] += 1;
      }
    }
  });

  // 야간 가산수당 계산
  const nightHoursOf = (code) => Number(shiftTimes[code]?.nightHours) || 0;
  const totalNightHours = workTypes.reduce((sum, t) => sum + (shiftCounts[t.code] || 0) * nightHoursOf(t.code), 0);

  const totalNightPay = Math.round(totalNightHours * Number(hourlyWage || 0) * 0.5);
  // 연차 사용: 달력에 기록한 올해 연차를 자동 집계 + 앱 사용 전 이미 쓴 연차(수동 입력)
  // 휴가 종류별 차감 일수 적용 (연차 1, 반차 0.5, 병가 0 ...)
  const leaveUsage = Object.fromEntries(leaveTypes.map((t) => [t.code, 0]));
  Object.entries(myShifts || {}).forEach(([dateKey, code]) => {
    if (dateKey.startsWith(`${year}-`) && leaveUsage[code] !== undefined) leaveUsage[code] += 1;
  });
  const calendarLeaveDays = leaveTypes.reduce(
    (sum, t) => sum + leaveUsage[t.code] * (t.leaveDays ?? 1),
    0
  );
  const priorUsed = Number(vacation.used || 0);
  const totalUsed = calendarLeaveDays + priorUsed;
  const remainingVacation = Number(vacation.total || 0) - totalUsed;

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-12 text-slate-800">
      
      {/* 1. 상단 근무시간 입력 세션 */}
      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-2">
        <div className="flex items-center gap-2 px-1 text-[10px] font-bold text-slate-400">
          <span className="w-8" />
          <span className="flex-1 text-center">근무 시간</span>
          <span className="w-12 text-center">야간(h)</span>
        </div>
        {workTypes.map(({ code }) => {
          const hasNightHours = true;

          return (
            <div key={code} className="flex items-center gap-2">
              <span className="font-black text-xs text-indigo-950 w-8 text-center truncate">{code}</span>
              <div className="flex-1 min-w-0 flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-2xl px-2 py-1">
                <input
                  type="time"
                  aria-label={`${code} 시작 시각`}
                  value={splitTime(shiftTimes[code]?.time)[0]}
                  onChange={(e) => updateTimePart(code, 0, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-[11px] font-bold text-center outline-none"
                />
                <span className="text-slate-300 text-xs">~</span>
                <input
                  type="time"
                  aria-label={`${code} 종료 시각`}
                  value={splitTime(shiftTimes[code]?.time)[1]}
                  onChange={(e) => updateTimePart(code, 1, e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-[11px] font-bold text-center outline-none"
                />
              </div>
              {hasNightHours ? (
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  aria-label={`${code} 야간 인정 시간`}
                  value={shiftTimes[code]?.nightHours ?? 0}
                  onChange={(e) => updateShiftTimes(code, 'nightHours', Number(e.target.value) || 0)}
                  className="shrink-0 w-12 py-2 text-center font-black text-xs bg-slate-50 border border-slate-200/60 rounded-2xl outline-none text-indigo-600 focus:border-indigo-400"
                />
              ) : (
                <span className="shrink-0 w-12 text-center text-xs font-bold text-slate-300">-</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. 연차(휴가) 현황 세션 */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
        <h3 className="font-black text-sm text-rose-500 flex items-center gap-1.5">
          <span>🌴</span> 연차(휴가) 현황
        </h3>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-2xl flex flex-col items-center justify-center">
            <span className="text-[10px] font-extrabold text-rose-400 block mb-1">총 부여 연차</span>
            <div className="flex items-center justify-center gap-0.5 w-full">
              <input
                type="number"
                value={vacation.total}
                onChange={(e) => {
                  const val = { ...vacation, total: Number(e.target.value) || 0 };
                  setVacation(val);
                  if (setShiftConfigs) setShiftConfigs({ ...shiftConfigs, vacation: val });
                }}
                className="w-12 text-center text-lg font-black text-rose-950 bg-transparent outline-none p-0"
              />
              <span className="text-xs font-bold text-rose-900 shrink-0">개</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center">
            <span className="text-[10px] font-extrabold text-slate-400 block mb-1">사용 연차</span>
            <div className="text-lg font-black text-slate-800">
              {totalUsed} <span className="text-xs font-bold text-slate-700">개</span>
            </div>
            <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">달력 {calendarLeaveDays}일 포함</span>
          </div>

          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col items-center justify-center">
            <span className="text-[10px] font-extrabold text-indigo-400 block mb-1">잔여 연차</span>
            <div className="text-lg font-black text-indigo-950">
              {remainingVacation} <span className="text-xs font-bold">개</span>
            </div>
          </div>
        </div>

        {/* 휴가 종류별 올해 사용 내역 */}
        <div className="flex flex-wrap gap-1.5">
          {leaveTypes.map((t) => (
            <span
              key={t.code}
              style={{ backgroundColor: t.bg, color: t.fg }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-black ${leaveUsage[t.code] ? '' : 'opacity-40'}`}
            >
              {t.code} {leaveUsage[t.code]}회
              {(t.leaveDays ?? 1) !== 1 && ` · ${leaveUsage[t.code] * (t.leaveDays ?? 1)}일`}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100">
          <span className="text-[11px] font-bold text-slate-500">앱 사용 전 올해 이미 쓴 연차</span>
          <div className="flex items-center gap-1">
              <input
                type="number"
                value={vacation.used}
                onChange={(e) => {
                  const val = { ...vacation, used: Number(e.target.value) || 0 };
                  setVacation(val);
                  if (setShiftConfigs) setShiftConfigs({ ...shiftConfigs, vacation: val });
                }}
                className="w-12 py-1 text-center text-sm font-black text-slate-800 bg-white border border-slate-200 rounded-lg outline-none"
              />
              <span className="text-xs font-bold text-slate-500 shrink-0">개</span>
          </div>
        </div>
      </div>

      {/* 3. 월 야간근로수당 계산기 세션 (자유 정산 시작일 설정 기능) */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        
        {/* 헤더 및 정산 기준일 선택 드롭다운 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-sm text-indigo-900 flex items-center gap-1.5">
              <span>🧮</span> {month}월 야간근로수당 계산기
            </h3>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
              {startDateStr.slice(5)} ~ {endDateStr.slice(5)}
            </span>
          </div>

          {/* 정산 시작일 선택 옵션 바 */}
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs font-bold">
            <span className="text-slate-600">월 정산 시작일 기준</span>
            <div className="flex items-center gap-1">
              <select
                value={startDay}
                onChange={(e) => handleStartDayChange(e.target.value)}
                className="bg-white border border-slate-200 px-2.5 py-1 rounded-xl font-black text-indigo-600 text-xs outline-none focus:border-indigo-400 cursor-pointer shadow-2xs"
              >
                <option value={1}>1일 (1일 ~ 말일)</option>
                <option value={16}>16일 (전월16일 ~ 당월15일)</option>
                <option value={21}>21일 (전월21일 ~ 당월20일)</option>
                <option value={26}>26일 (전월26일 ~ 당월25일)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 수당 산출 내역 */}
        <div className="p-4 bg-indigo-50/30 rounded-3xl border border-indigo-100 space-y-3 text-xs">
          {/* 야간 인정 시간이 있는 근무만 표시 (기본 E/N + 사용자 정의 근무) */}
          {workTypes.filter((t) => nightHoursOf(t.code) > 0 || t.code === 'N' || t.code === 'E').map((t) => (
            <div key={t.code} className="flex justify-between items-center font-bold text-slate-600">
              <span>{t.label} 근무:</span>
              <span className="font-black text-indigo-950 text-sm">
                {shiftCounts[t.code] || 0} 회 ({(shiftCounts[t.code] || 0) * nightHoursOf(t.code)}시간)
              </span>
            </div>
          ))}

          <div className="pt-2 border-t border-indigo-100/60 flex justify-between items-center">
            <span className="font-extrabold text-slate-700">통상 시급 (원):</span>
            <input
              type="number"
              placeholder="시급 입력"
              value={hourlyWage || ''}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                setHourlyWage(val);
                if (setShiftConfigs) setShiftConfigs({ ...shiftConfigs, hourlyWage: val, startDay });
              }}
              className={`w-28 py-1.5 px-3 bg-white border border-slate-200 rounded-xl font-black text-right text-slate-900 outline-none focus:border-indigo-500 ${blurCls}`}
            />
          </div>

          <div className="pt-3 border-t border-indigo-100/80 flex justify-between items-center">
            <span className="font-black text-slate-900 text-sm">{month}월 총 야간수당:</span>
            <span className={`text-2xl font-black text-indigo-600 ${blurCls}`}>
              {totalNightPay.toLocaleString()} <span className="text-base">원</span>
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
