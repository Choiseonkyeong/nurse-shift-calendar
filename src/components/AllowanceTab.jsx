import React, { useState } from 'react';
import { useShiftTypes } from '../lib/shiftTypes';
import { getHoliday } from '../utils/holidays';
import { getTodayDateObj } from '../utils/dateUtils';
import { leaveYearRange } from '../lib/allowance';
import ShiftStats from './ShiftStats';

// 설정 목록 한 줄 (왼쪽 이름, 오른쪽 값/입력). 화면 함수 밖에 둬야 입력 중 칸이 다시 만들어지지 않음
const Row = ({ label, sub, children }) => (
  <div className="flex items-center justify-between gap-3 py-3">
    <span className="min-w-0">
      <span className="block text-[15px] text-slate-800">{label}</span>
      {sub && <span className="block text-[12px] text-slate-400 mt-0.5">{sub}</span>}
    </span>
    <span className="shrink-0 flex items-center gap-1.5 text-[15px] text-slate-600">{children}</span>
  </div>
);

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
  const [year, month] = (selectedDate || getTodayDateObj().dateStr).split('-').map(Number);

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

  // 휴일근무 가산수당: 공휴일(선택 시 일요일 포함)에 근무한 횟수 × 인정 시간 × 시급 × 50%
  const holidayPay = shiftConfigs.holidayPay || { hours: 8, includeSunday: false };
  const workCodes = new Set(workTypes.map((t) => t.code));
  const holidayWorkDays = Object.entries(myShifts || {}).filter(([dateKey, code]) => {
    if (dateKey < startDateStr || dateKey > endDateStr || !workCodes.has(code)) return false;
    const [y, m, d] = dateKey.split('-').map(Number);
    return Boolean(getHoliday(dateKey)) || (holidayPay.includeSunday && new Date(y, m - 1, d).getDay() === 0);
  });
  const holidayHours = holidayWorkDays.length * (Number(holidayPay.hours) || 0);
  const totalHolidayPay = Math.round(holidayHours * Number(hourlyWage || 0) * 0.5);
  const setHolidayPay = (patch) => setShiftConfigs?.({ ...shiftConfigs, holidayPay: { ...holidayPay, ...patch } });
  // 연차 사용: 달력에 기록한 올해 연차를 자동 집계 + 앱 사용 전 이미 쓴 연차(수동 입력)
  // 휴가 종류별 차감 일수 적용 (연차 1, 반차 0.5, 병가 0 ...)
  // 연차 기준: 회계연도(1/1~12/31) 또는 입사일 기준(입사 기념일~다음 기념일 전날)
  const leaveRange = leaveYearRange(selectedDate, vacation.basis, vacation.hireDate);
  const leaveUsage = Object.fromEntries(leaveTypes.map((t) => [t.code, 0]));
  Object.entries(myShifts || {}).forEach(([dateKey, code]) => {
    if (dateKey >= leaveRange.start && dateKey <= leaveRange.end && leaveUsage[code] !== undefined) leaveUsage[code] += 1;
  });
  const calendarLeaveDays = leaveTypes.reduce(
    (sum, t) => sum + leaveUsage[t.code] * (t.leaveDays ?? 1),
    0
  );
  const priorUsed = Number(vacation.used || 0);
  const totalUsed = calendarLeaveDays + priorUsed;
  const remainingVacation = Number(vacation.total || 0) - totalUsed;

  const fieldCls = 'h-9 px-3 bg-slate-100 rounded-lg text-[15px] text-slate-900 outline-none focus:ring-2 focus:ring-blue-200';
  const saveVacation = (patch) => {
    const val = { ...vacation, ...patch };
    setVacation(val);
    if (setShiftConfigs) setShiftConfigs({ ...shiftConfigs, vacation: val });
  };

  return (
    <div className="max-w-md mx-auto pb-12 text-slate-800">
      {/* 1. 이번 달 가산수당 */}
      <section className="pt-1 pb-4">
        <p className="text-[13px] text-slate-400">
          {month}월 가산수당 · {startDateStr.slice(5).replace('-', '.')} ~ {endDateStr.slice(5).replace('-', '.')}
        </p>
        <p className={`mt-1 text-[34px] font-bold tracking-tight text-slate-900 leading-tight ${blurCls}`}>
          {(totalNightPay + totalHolidayPay).toLocaleString()}
          <span className="text-[22px] font-semibold ml-0.5">원</span>
        </p>
        <span className="sr-only">{month}월 가산수당 합계</span>
        <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          <div className="flex justify-between items-center py-3 text-[15px]">
            <span className="text-slate-500">야간 가산수당</span>
            <span className={`text-slate-900 ${blurCls}`}>{totalNightPay.toLocaleString()} 원</span>
          </div>
          <div className="flex justify-between items-center py-3 text-[15px]">
            <span className="text-slate-500">휴일 가산수당</span>
            <span className={`text-slate-900 ${blurCls}`}>{totalHolidayPay.toLocaleString()} 원</span>
          </div>
        </div>
        <p className="text-[12px] text-slate-400 mt-1">통상시급 × 50% 가산분만 계산한 예상 금액입니다. 병원 규정에 따라 다를 수 있어요.</p>
      </section>

      {/* 계산에 들어간 근무 */}
      <section className="border-t border-slate-100 pt-3">
        <h3 className="text-[13px] font-medium text-slate-400">계산 근거</h3>
        <div className="divide-y divide-slate-100">
          {/* 야간 인정 시간이 있는 근무만 표시 (기본 E/N + 사용자 정의 근무) */}
          {workTypes.filter((t) => nightHoursOf(t.code) > 0 || t.code === 'N' || t.code === 'E').map((t) => (
            <div key={t.code} className="flex justify-between items-center py-3 text-[15px]">
              <span className="text-slate-800">{t.label} 근무</span>
              <span className="text-slate-600">
                {shiftCounts[t.code] || 0} 회 ({(shiftCounts[t.code] || 0) * nightHoursOf(t.code)}시간)
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center py-3 text-[15px]">
            <span className="text-slate-800">휴일 근무</span>
            <span className="text-slate-600">
              {holidayWorkDays.length} 회 ({holidayHours}시간)
            </span>
          </div>
          <Row label="통상 시급">
            <input
              type="number"
              placeholder="시급 입력"
              value={hourlyWage || ''}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                setHourlyWage(val);
                if (setShiftConfigs) setShiftConfigs({ ...shiftConfigs, hourlyWage: val, startDay });
              }}
              className={`${fieldCls} w-28 text-right ${blurCls}`}
            />
            원
          </Row>
          <Row label="정산 시작일" sub={Number(startDay) === 1 ? '1일 ~ 말일' : `전월 ${startDay}일 ~ 당월 ${startDay - 1}일`}>
            <select value={startDay} onChange={(e) => handleStartDayChange(e.target.value)} className={`${fieldCls} max-w-[11rem] cursor-pointer`}>
              {/* 병원마다 정산일이 달라 1~28일 모두 선택 가능 (29일 이후는 2월에 날짜가 없어 제외) */}
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </Row>
          <label className="flex items-center justify-between gap-3 py-3 cursor-pointer">
            <span className="text-[15px] text-slate-800">일요일도 휴일로</span>
            <input
              type="checkbox"
              checked={Boolean(holidayPay.includeSunday)}
              onChange={(e) => setHolidayPay({ includeSunday: e.target.checked })}
              className="w-5 h-5 accent-blue-600"
            />
          </label>
          <Row label="휴일근무 1회 인정">
            <input
              type="number"
              min="0"
              step="0.5"
              aria-label="휴일근무 1회 인정 시간"
              value={holidayPay.hours ?? 8}
              onChange={(e) => setHolidayPay({ hours: Number(e.target.value) || 0 })}
              className={`${fieldCls} w-16 text-center`}
            />
            시간
          </Row>
        </div>
      </section>

      {/* 2. 연차 */}
      <section className="border-t border-slate-100 pt-4 mt-2">
        <p className="text-[13px] text-slate-400">남은 연차</p>
        <p className="mt-1 text-[34px] font-bold tracking-tight text-slate-900 leading-tight">
          {remainingVacation}
          <span className="text-[22px] font-semibold ml-0.5">개</span>
        </p>
        <p className="text-[13px] text-slate-500 mt-1">
          사용 {totalUsed}개 · 달력 {calendarLeaveDays}일 포함
        </p>

        {/* 휴가 종류별 사용 내역 (연차 기준 기간) — 종류가 여럿일 때만 (하나면 '사용 연차'와 같은 내용) */}
        {leaveTypes.length > 1 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[13px] text-slate-500">
            {leaveTypes.map((t) => (
              <span key={t.code} className={leaveUsage[t.code] ? '' : 'opacity-40'}>
                <b style={{ color: t.fg }} className="font-bold">{t.code}</b> {leaveUsage[t.code]}회
                {(t.leaveDays ?? 1) !== 1 && ` · ${leaveUsage[t.code] * (t.leaveDays ?? 1)}일`}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          <Row label="총 부여 연차">
            <input
              type="number"
              aria-label="총 부여 연차"
              value={vacation.total}
              onChange={(e) => saveVacation({ total: Number(e.target.value) || 0 })}
              className={`${fieldCls} w-16 text-center`}
            />
            개
          </Row>
          <Row label="앱 사용 전 이미 쓴 연차">
            <input
              type="number"
              aria-label="앱 사용 전 이미 쓴 연차"
              value={vacation.used}
              onChange={(e) => saveVacation({ used: Number(e.target.value) || 0 })}
              className={`${fieldCls} w-16 text-center`}
            />
            개
          </Row>
          <Row label="연차 기준" sub={`집계 기간: ${leaveRange.start.replaceAll('-', '.')} ~ ${leaveRange.end.replaceAll('-', '.')}`}>
            <select value={vacation.basis || 'calendar'} onChange={(e) => saveVacation({ basis: e.target.value })} className={`${fieldCls} cursor-pointer`}>
              <option value="calendar">회계연도 (1/1)</option>
              <option value="hire">입사일 기준</option>
            </select>
          </Row>
          {vacation.basis === 'hire' && (
            <Row label="입사일">
              <input
                type="date"
                aria-label="입사일"
                value={vacation.hireDate || ''}
                onChange={(e) => saveVacation({ hireDate: e.target.value })}
                className={fieldCls}
              />
            </Row>
          )}
        </div>
      </section>

      {/* 3. 근무 시간 설정 */}
      <section className="border-t border-slate-100 pt-4 mt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-medium text-slate-400">근무 시간 설정</h3>
          <span className="text-[12px] text-slate-400">야간 인정(시간)</span>
        </div>
        <div className="divide-y divide-slate-100">
          {workTypes.map(({ code }) => (
            <div key={code} className="flex items-center gap-2 py-2.5">
              <span className="w-9 text-[15px] font-bold truncate" style={{ color: workTypes.find((t) => t.code === code)?.fg }}>
                {code}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-1 bg-slate-100 rounded-lg px-2 h-9">
                <input
                  type="time"
                  aria-label={`${code} 시작 시각`}
                  value={splitTime(shiftTimes[code]?.time)[0]}
                  onChange={(e) => updateTimePart(code, 0, e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch (err) {
                      /* 선택창을 열 수 없는 브라우저는 직접 입력 */
                    }
                  }}
                  className="time-compact flex-1 min-w-0 bg-transparent text-[13px] text-center outline-none"
                />
                <span className="text-slate-300 text-xs">~</span>
                <input
                  type="time"
                  aria-label={`${code} 종료 시각`}
                  value={splitTime(shiftTimes[code]?.time)[1]}
                  onChange={(e) => updateTimePart(code, 1, e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch (err) {
                      /* 선택창을 열 수 없는 브라우저는 직접 입력 */
                    }
                  }}
                  className="time-compact flex-1 min-w-0 bg-transparent text-[13px] text-center outline-none"
                />
              </div>
              <input
                type="number"
                min="0"
                step="0.5"
                aria-label={`${code} 야간 인정 시간`}
                value={shiftTimes[code]?.nightHours ?? 0}
                onChange={(e) => updateShiftTimes(code, 'nightHours', Number(e.target.value) || 0)}
                className="shrink-0 w-14 h-9 text-center text-[15px] bg-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-slate-100 mt-2" />
      <ShiftStats myShifts={myShifts} initialYear={year} />
    </div>
  );
}
