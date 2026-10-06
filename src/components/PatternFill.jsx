import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import { X, Delete } from 'lucide-react';
import { useShiftTypes, shiftTextVars, findShiftType } from '../lib/shiftTypes';
import { toDateKey } from '../utils/dateUtils';

const PRESETS = [
  { name: '3조 2교대 (주-야-비)', cycle: ['D', 'N', 'OFF'] },
  { name: '4조 2교대 (주주야야비비)', cycle: ['D', 'D', 'N', 'N', 'OFF', 'OFF'] },
  { name: '3교대 순환 (DDEENNOO)', cycle: ['D', 'D', 'E', 'E', 'N', 'N', 'OFF', 'OFF'] },
  { name: '주5일 (평일 D, 주말 OFF)', cycle: ['D', 'D', 'D', 'D', 'D', 'OFF', 'OFF'], weekdayAligned: true }
];

const PERIODS = [
  { value: 'month', label: '이번 달 끝까지' },
  { value: '1', label: '1개월' },
  { value: '3', label: '3개월' },
  { value: '6', label: '6개월' }
];

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** 순환 패턴을 시작일부터 기간만큼 펼쳐 { 'YYYY-MM-DD': code } 생성 */
export function expandPattern(cycle, startKey, period, { weekdayAligned = false } = {}) {
  if (!cycle.length || !startKey) return {};
  const start = parseKey(startKey);
  const end = period === 'month'
    ? new Date(start.getFullYear(), start.getMonth() + 1, 0)
    : addDays(new Date(start.getFullYear(), start.getMonth() + Number(period), start.getDate()), -1);
  // 주5일처럼 요일 고정 패턴은 월요일=0 기준으로 맞춤
  const offset = weekdayAligned ? (start.getDay() + 6) % 7 : 0;
  const result = {};
  for (let i = 0, d = start; d <= end; i++, d = addDays(d, 1)) {
    result[toDateKey(d)] = cycle[(i + offset) % cycle.length];
  }
  return result;
}

export default function PatternFill({ startDate, myShifts, onApply, onClose, defaultPeriod = 'month' }) {
  const shiftTypes = useShiftTypes();
  const [cycle, setCycle] = useState(PRESETS[1].cycle);
  const [weekdayAligned, setWeekdayAligned] = useState(false);
  const [start, setStart] = useState(startDate);
  const [period, setPeriod] = useState(defaultPeriod);
  const [overwrite, setOverwrite] = useState(true);

  const generated = useMemo(
    () => expandPattern(cycle, start, period, { weekdayAligned }),
    [cycle, start, period, weekdayAligned]
  );
  const entries = Object.entries(generated);
  const conflicts = entries.filter(([k]) => myShifts[k]).length;

  const handleApply = () => {
    const toApply = overwrite ? generated : Object.fromEntries(entries.filter(([k]) => !myShifts[k]));
    onApply(toApply);
  };

  // 하단 탭바보다 위에 뜨도록 body 에 렌더링
  return (
    <Modal onClose={onClose} label="반복 패턴 입력">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-5 shadow-xl max-h-[85dvh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-[20px] font-bold text-slate-900">
            반복 패턴 입력
          </h3>
          <button onClick={onClose} className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-100 cursor-pointer" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="text-[13px] text-slate-400">자주 쓰는 패턴</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => { setCycle(p.cycle); setWeekdayAligned(!!p.weekdayAligned); }}
                className={`h-9 px-3 rounded-full text-[13px] font-medium cursor-pointer ${
                  cycle.join() === p.cycle.join() ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-slate-400">순서 ({cycle.length}일 반복)</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setCycle((c) => c.slice(0, -1))} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="마지막 삭제">
                <Delete size={15} />
              </button>
              <button type="button" onClick={() => setCycle([])} className="px-2 py-0.5 rounded-lg text-[13px] text-slate-500 cursor-pointer">
                비우기
              </button>
            </div>
          </div>
          <div className="min-h-[3rem] px-3 py-2.5 rounded-2xl bg-slate-50 flex flex-wrap items-center gap-x-2 gap-y-1">
            {cycle.length === 0 && <span className="text-[13px] text-slate-400">아래 근무를 순서대로 눌러 패턴을 만드세요</span>}
            {cycle.map((code, i) => (
              <span key={i} style={shiftTextVars(findShiftType(shiftTypes, code))} className="shift-text text-[17px] font-bold">
                {code}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {shiftTypes.map((t) => (
              <button
                key={t.code}
                type="button"
                onClick={() => { setCycle((c) => [...c, t.code]); setWeekdayAligned(false); }}
                style={shiftTextVars(t)}
                className="shift-text h-10 min-w-[48px] px-3 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-[15px] font-bold cursor-pointer active:bg-slate-50"
              >
                + {t.code}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[13px] text-slate-400">시작일</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full px-3 h-11 bg-slate-100 rounded-xl text-[14px] outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[13px] text-slate-400">기간</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 h-11 bg-slate-100 rounded-xl text-[14px] outline-none"
            >
              {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-[14px] text-slate-700">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="w-5 h-5 accent-blue-600" />
          이미 입력된 근무 덮어쓰기 {conflicts > 0 && <span className="text-rose-500">({conflicts}일 겹침)</span>}
        </label>

        {entries.length > 0 && (
          <div className="space-y-1">
            <span className="text-[13px] text-slate-400">미리보기 (처음 14일)</span>
            <div className="grid grid-cols-7 gap-1">
              {entries.slice(0, 14).map(([k, code]) => (
                <div key={k} className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] text-slate-400">{Number(k.slice(8))}</span>
                  <span style={shiftTextVars(findShiftType(shiftTypes, code))} className="shift-text w-full text-[13px] font-bold text-center truncate">
                    {code}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={entries.length === 0}
          onClick={handleApply}
          className="w-full h-12 rounded-xl bg-blue-600 text-white text-[15px] font-semibold cursor-pointer disabled:opacity-50"
        >
          {overwrite ? entries.length : entries.length - conflicts}일에 적용하기
        </button>
      </div>
    </Modal>
  );
}
