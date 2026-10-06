import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useShiftTypes } from '../lib/shiftTypes';
import { computeYearStats } from '../lib/stats';

/** 연간 근무 통계 (월별 횟수 표 + 요약) */
export default function ShiftStats({ myShifts = {}, initialYear }) {
  const shiftTypes = useShiftTypes();
  const [year, setYear] = useState(initialYear || new Date().getFullYear());
  const stats = useMemo(() => computeYearStats(myShifts, year, shiftTypes), [myShifts, year, shiftTypes]);
  const usedTypes = shiftTypes.filter((t) => stats.totals[t.code]);

  return (
    <div className="card p-5 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
          <span>📊</span> 근무 통계
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear((y) => y - 1)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="이전 해">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-black text-slate-700">{year}년</span>
          <button onClick={() => setYear((y) => y + 1)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="다음 해">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['근무일', `${stats.workDays}일`],
          ['최장 연속근무', `${stats.longestWork}일`],
          ['최장 연속N', `${stats.longestNight}일`]
        ].map(([label, value]) => (
          <div key={label} className="p-2.5 bg-slate-50 rounded-2xl">
            <p className="text-[10px] font-extrabold text-slate-400">{label}</p>
            <p className="text-base font-black text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      {usedTypes.length === 0 ? (
        <p className="text-xs font-bold text-slate-300 text-center py-3">{year}년에 입력된 근무가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-center text-[11px] font-bold border-separate border-spacing-y-0.5">
            <thead>
              <tr className="text-slate-400">
                <th className="px-1 text-left">월</th>
                {usedTypes.map((t) => (
                  <th key={t.code} className="px-1">
                    <span style={{ backgroundColor: t.bg, color: t.fg }} className="inline-block px-1.5 py-0.5 rounded-md font-black">
                      {t.code}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.months
                .filter((m) => m.total > 0)
                .map((m) => (
                  <tr key={m.month} className="text-slate-700">
                    <td className="px-1 text-left text-slate-500">{m.month}월</td>
                    {usedTypes.map((t) => (
                      <td key={t.code} className={`px-1 ${m.counts[t.code] ? '' : 'text-slate-200'}`}>
                        {m.counts[t.code] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              <tr className="font-black text-indigo-700">
                <td className="px-1 text-left">합계</td>
                {usedTypes.map((t) => (
                  <td key={t.code} className="px-1">
                    {stats.totals[t.code]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
