import React, { useState } from 'react';
import { useShiftTypes, shiftTextVars } from '../lib/shiftTypes';
import { getHoliday } from '../utils/holidays';
import { getTodayDateObj, addMonthsKey } from '../utils/dateUtils';
import { leaveYearRange, nightHoursFromTime, payPeriod } from '../lib/allowance';
import ShiftStats from './ShiftStats';
import { Moon, PartyPopper, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronDown, X, Minus, Plus, Pencil } from 'lucide-react';
import MonthPicker, { monthPickKey } from './MonthPicker';
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

// 아래 창 제목 + 닫기
const SheetHeader = ({ title, onClose }) => (
  <div className="flex justify-between items-center">
    <h3 className="text-[20px] font-bold text-slate-900">{title}</h3>
    <button type="button" onClick={onClose} aria-label="닫기" className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-100 cursor-pointer">
      <X size={20} />
    </button>
  </div>
);

// 켜기/끄기 스위치
const Switch = ({ label, on, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${on ? 'bg-blue-600' : 'bg-slate-300'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
);

// − 숫자 + (손가락으로 누르기 쉽게, 숫자는 직접 입력도 가능)
const Stepper = ({ label, value, step = 1, onChange }) => {
  const set = (v) => onChange(Math.max(0, Math.round(v * 2) / 2));
  const btn = 'w-9 h-9 flex items-center justify-center rounded-full bg-white text-slate-600 active:bg-slate-100 cursor-pointer';
  return (
    <span className="flex items-center gap-1">
      <button type="button" aria-label={`${label} 줄이기`} onClick={() => set(value - step)} className={btn}>
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={value}
        onChange={(e) => set(Number(e.target.value) || 0)}
        className="w-12 h-9 bg-transparent text-center text-[17px] font-semibold text-slate-900 outline-none"
      />
      <button type="button" aria-label={`${label} 늘리기`} onClick={() => set(value + step)} className={btn}>
        <Plus size={16} />
      </button>
    </span>
  );
};

// 시각 입력: 누르면 바로 시계 선택창
const TimeInput = ({ label, value, onChange }) => (
  <input
    type="time"
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onClick={(e) => {
      try {
        e.currentTarget.showPicker?.();
      } catch (err) {
        /* 선택창을 열 수 없는 브라우저는 직접 입력 */
      }
    }}
    className="time-compact flex-1 min-w-0 bg-transparent text-[13px] text-center outline-none"
  />
);

export default function AllowanceTab({
  myShifts = {},
  selectedDate,
  setSelectedDate,
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

  // 정산 기간 (예: 26일 → 전달 26일 ~ 이번 달 25일)
  const { start: startDateStr, end: endDateStr } = payPeriod(year, month, startDay);

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
  const [pickerOpen, setPickerOpen] = useState(false); // 년·월 선택 창
  const [openLeave, setOpenLeave] = useState(false); // 연차 설정 창

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

  // 야간 가산수당 계산: 근무 시간이 있으면 22시~6시에 걸친 시간을 자동 계산, 없으면 예전에 입력한 값
  const nightHoursOf = (code) => nightHoursFromTime(shiftTimes[code]?.time) ?? (Number(shiftTimes[code]?.nightHours) || 0);
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
        {/* 달 바꾸기: ‹ › 또는 제목을 눌러 년·월 선택 */}
        <div className="flex items-center justify-between -mt-1 -mx-2">
          <button type="button" aria-label="이전 달" onClick={() => setSelectedDate?.(addMonthsKey(selectedDate, -1))} className="w-9 h-9 flex items-center justify-center rounded-full text-blue-100 active:bg-white/15 cursor-pointer">
            <ChevronLeft size={20} />
          </button>
          <button type="button" aria-label="년·월 선택" onClick={() => setPickerOpen(true)} className="flex items-center gap-0.5 text-[13px] text-blue-100 cursor-pointer">
            {year !== getTodayDateObj().year && `${year}년 `}
            {month}월 가산수당 · {startDateStr.slice(5).replace('-', '.')}~{endDateStr.slice(5).replace('-', '.')}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button type="button" aria-label="다음 달" onClick={() => setSelectedDate?.(addMonthsKey(selectedDate, 1))} className="w-9 h-9 flex items-center justify-center rounded-full text-blue-100 active:bg-white/15 cursor-pointer">
            <ChevronRight size={20} />
          </button>
        </div>
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
            <p className="flex items-center gap-1 text-[13px] text-slate-500">
              남은 연차
              <button type="button" aria-label="연차 설정" onClick={() => setOpenLeave(true)} className="w-7 h-7 -my-1 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-200 cursor-pointer">
                <Pencil size={14} />
              </button>
            </p>
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

      {pickerOpen && (
        <MonthPicker
          year={year}
          month={month}
          onClose={() => setPickerOpen(false)}
          onPick={(y, m) => {
            setSelectedDate?.(monthPickKey(y, m));
            setPickerOpen(false);
          }}
        />
      )}

      {openSettings && (
        <Modal onClose={() => setOpenSettings(false)} label="계산 설정">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-5 shadow-xl max-h-[85dvh] overflow-y-auto">
            <SheetHeader title="계산 설정" onClose={() => setOpenSettings(false)} />

            {/* 시급: 가장 중요한 값 하나만 크게 */}
            <label className="block rounded-2xl bg-slate-50 px-4 py-3">
              <span className="block text-[13px] text-slate-500">통상 시급</span>
              <span className="flex items-baseline gap-1">
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
                  className={`w-full min-w-0 bg-transparent text-[28px] font-bold text-slate-900 outline-none placeholder:text-slate-300 placeholder:font-semibold ${blurCls}`}
                />
                <span className="text-[17px] font-semibold text-slate-500">원</span>
              </span>
            </label>

            <div className="rounded-2xl bg-slate-50 px-4 divide-y divide-slate-200/60">
              <Row label="정산 기간">
                <select aria-label="정산 시작일" value={startDay} onChange={(e) => handleStartDayChange(e.target.value)} className={`${fieldCls} cursor-pointer`}>
                  {/* 병원마다 정산일이 달라 1~28일 모두 선택 가능 (29일 이후는 2월에 날짜가 없어 제외) */}
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d === 1 ? '1일 ~ 말일' : `${d}일 ~ 다음 달 ${d - 1}일`}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="일요일도 휴일로">
                <Switch label="일요일도 휴일로" on={Boolean(holidayPay.includeSunday)} onChange={(v) => setHolidayPay({ includeSunday: v })} />
              </Row>
            </div>

            <section>
              <div className="flex items-center justify-between px-1 mb-1">
                <h4 className="text-[13px] font-medium text-slate-400">근무 시간</h4>
                <span className="text-[12px] text-slate-400">야간(22~6시)은 자동</span>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 divide-y divide-slate-200/60">
                {workTypes.map((t) => {
                  const [start, end] = splitTime(shiftTimes[t.code]?.time);
                  const night = nightHoursOf(t.code);
                  return (
                    <div key={t.code} className="flex items-center gap-2 py-2.5">
                      <span className="shift-text w-9 text-[15px] font-bold truncate" style={shiftTextVars(t)}>
                        {t.code}
                      </span>
                      <div className="flex-1 min-w-0 flex items-center gap-1 bg-white rounded-lg px-2 h-9">
                        <TimeInput label={`${t.code} 시작 시각`} value={start} onChange={(v) => updateTimePart(t.code, 0, v)} />
                        <span className="text-slate-300 text-xs">~</span>
                        <TimeInput label={`${t.code} 종료 시각`} value={end} onChange={(v) => updateTimePart(t.code, 1, v)} />
                      </div>
                      <span className={`shrink-0 w-14 text-right text-[13px] ${night ? 'text-blue-600 font-medium' : 'text-slate-300'}`}>
                        {night ? `야간 ${night}h` : '야간 0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              야간 시간 × 시급 × 50%, 휴일 근무 1회 {Number(holidayPay.hours) || 0}시간 × 시급 × 50%로 계산한 예상 금액이에요.
            </p>
          </div>
        </Modal>
      )}

      {openLeave && (
        <Modal onClose={() => setOpenLeave(false)} label="연차 설정">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-5 shadow-xl max-h-[85dvh] overflow-y-auto">
            <SheetHeader title="연차 설정" onClose={() => setOpenLeave(false)} />
            <div className="rounded-2xl bg-slate-50 px-4 divide-y divide-slate-200/60">
              <Row label="올해 받은 연차">
                <Stepper label="총 부여 연차" value={Number(vacation.total) || 0} onChange={(v) => saveVacation({ total: v })} />
              </Row>
              <Row label="앱 쓰기 전 사용" sub="달력에 적은 연차는 자동으로 빠져요">
                <Stepper label="앱 사용 전 이미 쓴 연차" value={Number(vacation.used) || 0} step={0.5} onChange={(v) => saveVacation({ used: v })} />
              </Row>
            </div>
            <section>
              <h4 className="px-1 mb-1 text-[13px] font-medium text-slate-400">연차 기간</h4>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100">
                {[
                  ['calendar', '1월 1일부터'],
                  ['hire', '입사일 기준']
                ].map(([v, name]) => {
                  const on = (vacation.basis || 'calendar') === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => saveVacation({ basis: v })}
                      className={`h-10 rounded-lg text-[14px] font-medium cursor-pointer ${on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              {vacation.basis === 'hire' && (
                <label className="mt-2 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5">
                  <span className="text-[15px] text-slate-800">입사일</span>
                  <input type="date" aria-label="입사일" value={vacation.hireDate || ''} onChange={(e) => saveVacation({ hireDate: e.target.value })} className={fieldCls} />
                </label>
              )}
              <p className="mt-2 px-1 text-[13px] text-slate-500">
                {leaveRange.start.replaceAll('-', '.')} ~ {leaveRange.end.replaceAll('-', '.')}
              </p>
            </section>
          </div>
        </Modal>
      )}

      <ShiftStats myShifts={myShifts} initialYear={year} />
    </div>
  );
}
