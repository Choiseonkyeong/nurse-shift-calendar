import React, { useState } from 'react';
import { useShiftTypes, shiftTextVars } from '../lib/shiftTypes';
import { getHoliday } from '../utils/holidays';
import { getTodayDateObj } from '../utils/dateUtils';
import { leaveYearRange } from '../lib/allowance';
import ShiftStats from './ShiftStats';
import { Moon, PartyPopper, SlidersHorizontal, ChevronRight, X } from 'lucide-react';
import Modal from './Modal';

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

// 설정 창의 묶음: 작은 회색 제목 + 흰 칸 안의 줄들
const SettingGroup = ({ title, right, children }) => (
  <section>
    <div className="flex items-center justify-between px-1 mb-1">
      <h4 className="text-[13px] font-medium text-slate-400">{title}</h4>
      {right && <span className="text-[12px] text-slate-400">{right}</span>}
    </div>
    <div className="rounded-2xl bg-slate-50 px-4 divide-y divide-slate-200/60">{children}</div>
  </section>
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
  const [openSettings, setOpenSettings] = useState(false); // 계산 설정 창

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

  const fieldCls = 'h-9 px-3 bg-white rounded-lg text-[15px] text-slate-900 outline-none focus:ring-2 focus:ring-blue-200';
  const saveVacation = (patch) => {
    const val = { ...vacation, ...patch };
    setVacation(val);
    if (setShiftConfigs) setShiftConfigs({ ...shiftConfigs, vacation: val });
  };

  const leaveTotal = Number(vacation.total) || 0;
  const usedPct = leaveTotal ? Math.min(100, Math.round((totalUsed / leaveTotal) * 100)) : 0;
  const nightCount = workTypes.filter((t) => nightHoursOf(t.code) > 0).reduce((n, t) => n + (shiftCounts[t.code] || 0), 0);

  return (
    <div className="max-w-md mx-auto pb-12 text-slate-800 space-y-3">
      {/* 1. 이번 달 가산수당: 숫자만 크게 */}
      <section className="rounded-3xl bg-blue-600 text-white p-5">
        <p className="text-[13px] text-blue-100">
          {month}월 가산수당 · {startDateStr.slice(5).replace('-', '.')}~{endDateStr.slice(5).replace('-', '.')}
        </p>
        <p className={`mt-1 text-[36px] font-bold tracking-tight leading-tight ${blurCls}`}>
          {(totalNightPay + totalHolidayPay).toLocaleString()}
          <span className="text-[22px] font-semibold ml-0.5">원</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/15 p-3">
            <p className="flex items-center gap-1 text-[12px] text-blue-100">
              <Moon size={14} /> 야간 가산수당
            </p>
            <p className={`text-[17px] font-semibold mt-0.5 ${blurCls}`}>{totalNightPay.toLocaleString()} 원</p>
            <p className="text-[11px] text-blue-100 mt-0.5">야간 근무 {nightCount}회</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3">
            <p className="flex items-center gap-1 text-[12px] text-blue-100">
              <PartyPopper size={14} /> 휴일 가산수당
            </p>
            <p className={`text-[17px] font-semibold mt-0.5 ${blurCls}`}>{totalHolidayPay.toLocaleString()} 원</p>
            <p className="text-[11px] text-blue-100 mt-0.5">휴일 근무 {holidayWorkDays.length}회</p>
          </div>
        </div>
      </section>

      {/* 2. 연차: 남은 개수 + 막대 */}
      <section className="rounded-3xl bg-slate-50 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] text-slate-500">남은 연차</p>
            <p className="text-[32px] font-bold tracking-tight text-slate-900 leading-tight">
              {remainingVacation}
              <span className="text-[18px] font-semibold ml-0.5">일</span>
            </p>
          </div>
          <p className="text-[13px] text-slate-500 pb-1.5">
            {leaveTotal}일 중 <b className="font-semibold text-slate-800">{totalUsed}일</b> 사용
          </p>
        </div>
        <div className="mt-3 h-2.5 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="연차 사용률">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${usedPct}%` }} />
        </div>
        {leaveTypes.length > 1 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[13px] text-slate-500">
            {leaveTypes.map((t) => (
              <span key={t.code} className={leaveUsage[t.code] ? '' : 'opacity-40'}>
                <b style={shiftTextVars(t)} className="shift-text font-bold">{t.code}</b> {leaveUsage[t.code]}회
                {(t.leaveDays ?? 1) !== 1 && ` · ${leaveUsage[t.code] * (t.leaveDays ?? 1)}일`}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 3. 설정: 한 줄 버튼 → 아래 창 */}
      <button
        type="button"
        onClick={() => setOpenSettings(true)}
        className="w-full flex items-center gap-3 rounded-3xl bg-slate-50 px-5 py-4 text-left cursor-pointer active:bg-slate-100"
      >
        <SlidersHorizontal size={20} className="text-slate-500 shrink-0" />
        <span className="flex-1 text-[15px] font-medium text-slate-900">계산 설정</span>
        <span className={`text-[13px] text-slate-400 ${blurCls}`}>시급 {hourlyWage ? hourlyWage.toLocaleString() : '-'}원</span>
        <ChevronRight size={18} className="text-slate-300" />
      </button>

      {openSettings && (
        <Modal onClose={() => setOpenSettings(false)} label="계산 설정">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-5 shadow-xl max-h-[85dvh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-[20px] font-bold text-slate-900">계산 설정</h3>
              <button onClick={() => setOpenSettings(false)} aria-label="닫기" className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-100 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <SettingGroup title="수당">
              <Row label="통상 시급">
                <input
                  type="number"
                  inputMode="numeric"
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
                <select value={startDay} onChange={(e) => handleStartDayChange(e.target.value)} className={`${fieldCls} cursor-pointer`}>
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
            </SettingGroup>

            <SettingGroup title="연차">
              <Row label="총 부여 연차">
                <input type="number" aria-label="총 부여 연차" value={vacation.total} onChange={(e) => saveVacation({ total: Number(e.target.value) || 0 })} className={`${fieldCls} w-16 text-center`} />
                일
              </Row>
              <Row label="앱 쓰기 전 사용">
                <input type="number" aria-label="앱 사용 전 이미 쓴 연차" value={vacation.used} onChange={(e) => saveVacation({ used: Number(e.target.value) || 0 })} className={`${fieldCls} w-16 text-center`} />
                일
              </Row>
              <Row label="연차 기준" sub={`${leaveRange.start.replaceAll('-', '.')} ~ ${leaveRange.end.replaceAll('-', '.')}`}>
                <select value={vacation.basis || 'calendar'} onChange={(e) => saveVacation({ basis: e.target.value })} className={`${fieldCls} cursor-pointer`}>
                  <option value="calendar">회계연도</option>
                  <option value="hire">입사일 기준</option>
                </select>
              </Row>
              {vacation.basis === 'hire' && (
                <Row label="입사일">
                  <input type="date" aria-label="입사일" value={vacation.hireDate || ''} onChange={(e) => saveVacation({ hireDate: e.target.value })} className={fieldCls} />
                </Row>
              )}
            </SettingGroup>

            <SettingGroup title="근무 시간" right="야간 인정(시간)">
              <div className="divide-y divide-slate-100">
          {workTypes.map(({ code }) => (
            <div key={code} className="flex items-center gap-2 py-2.5">
              <span className="shift-text w-9 text-[15px] font-bold truncate" style={shiftTextVars(workTypes.find((t) => t.code === code))}>
                {code}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-1 bg-white rounded-lg px-2 h-9">
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
                className="shrink-0 w-14 h-9 text-center text-[15px] bg-white rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          ))}
        </div>
            </SettingGroup>
            <p className="text-[12px] text-slate-400">통상시급 × 50% 가산분만 계산한 예상 금액이에요.</p>
          </div>
        </Modal>
      )}

      <ShiftStats myShifts={myShifts} initialYear={year} />
    </div>
  );
}
