import React, { useState } from 'react';
import { DollarSign, Settings, Save, Calendar, Clock, Calculator } from 'lucide-react';

export default function AllowanceTab({
  myShifts = {},
  shiftConfigs = {},
  setShiftConfigs,
  selectedDate
}) {
  const [activeSubTab, setActiveSubTab] = useState('allowance');

  // 기본 단가 및 근무시간 초기값
  const defaultConfigs = {
    D: { pay: 0, nightHours: 0, startTime: '07:30', endTime: '15:30' },
    E: { pay: 10000, nightHours: 0.5, startTime: '14:30', endTime: '22:30' },
    N: { pay: 60000, nightHours: 8, startTime: '21:30', endTime: '08:00' },
    M: { pay: 0, nightHours: 0, startTime: '09:00', endTime: '17:00' },
    hourlyWage: 13000, ...shiftConfigs
  };

  const [tempConfigs, setTempConfigs] = useState(defaultConfigs);

  const [year, month] = selectedDate ? selectedDate.split('-').map(Number) : [2026, 9];
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  // 근무 횟수 집계 및 총 수당 정산
  const shiftCounts = { D: 0, E: 0, N: 0, M: 0, OFF: 0, 연차: 0 };
  let totalAllowance = 0;
  let totalNightHours = 0;

  const currentConfigs = { ...defaultConfigs, ...shiftConfigs };

  Object.entries(myShifts || {}).forEach(([dateKey, code]) => {
    if (dateKey.startsWith(monthPrefix) && code) {
      if (shiftCounts[code] !== undefined) {
        shiftCounts[code] += 1;
      }
      const pay = currentConfigs[code]?.pay || 0;
      const nightH = currentConfigs[code]?.nightHours || 0;

      totalAllowance += Number(pay);
      totalNightHours += Number(nightH);
    }
  });

  // 법정 야간 가산 수당 (시급 × 50% × 총 야간시간)
  const hourlyWage = Number(currentConfigs.hourlyWage || 13000);
  const nightExtraPay = Math.round(totalNightHours * hourlyWage * 0.5);
  const grandTotalPay = totalAllowance + nightExtraPay;

  const formatMoney = (val) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const handleSaveConfigs = () => {
    if (setShiftConfigs) {
      setShiftConfigs(tempConfigs);
    }
    setActiveSubTab('allowance');
  };

  // 야간 가산수당 자동 계산 헬퍼 (시급 * 0.5 * 야간시간)
  const autoCalculateNightPay = (code) => {
    const nightH = Number(tempConfigs[code]?.nightHours || 0);
    const wage = Number(tempConfigs.hourlyWage || 13000);
    const calculatedPay = Math.round(nightH * wage * 0.5);

    setTempConfigs({
      ...tempConfigs,
      [code]: { ...(tempConfigs[code] || {}), pay: calculatedPay }
    });
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      {/* 서브 탭 이동 바 */}
      <div className="flex bg-slate-200/70 p-1 rounded-2xl text-xs font-extrabold">
        <button
          onClick={() => setActiveSubTab('allowance')}
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            activeSubTab === 'allowance' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
          }`}
        >
          수당 / 연차 현황
        </button>
        <button
          onClick={() => {
            setTempConfigs({ ...defaultConfigs, ...shiftConfigs });
            setActiveSubTab('config');
          }}
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            activeSubTab === 'config' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
          }`}
        >
          수당 단가 설정
        </button>
      </div>

      {/* 1. 수당 현황 탭 */}
      {activeSubTab === 'allowance' && (
        <div className="space-y-4">
          {/* 총 수당 카드 */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 rounded-3xl shadow-md space-y-2">
            <span className="text-xs font-extrabold opacity-80 flex items-center gap-1">
              <DollarSign size={16} /> {year}년 {month}월 예상 근무 수당
            </span>
            <div className="text-3xl font-black">
              {formatMoney(grandTotalPay)} <span className="text-base font-bold">원</span>
            </div>
            <div className="pt-1 text-[11px] opacity-80 space-y-0.5 border-t border-white/20">
              <div className="flex justify-between">
                <span>• 건당 고정 수당 합계:</span>
                <span className="font-bold">{formatMoney(totalAllowance)}원</span>
              </div>
              <div className="flex justify-between">
                <span>• 법정 야간 가산수당 ({totalNightHours}시간):</span>
                <span className="font-bold">+{formatMoney(nightExtraPay)}원</span>
              </div>
            </div>
          </div>

          {/* 월 근무 집계 (D, E, N, M, OFF) */}
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1">
              <Calendar size={14} className="text-indigo-600" /> {month}월 근무 집계
            </h3>
            <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
              <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <span className="text-[10px] font-bold text-indigo-600 block">Day</span>
                <span className="text-sm font-black text-indigo-900">{shiftCounts.D}회</span>
              </div>
              <div className="p-2 bg-purple-50 border border-purple-100 rounded-2xl">
                <span className="text-[10px] font-bold text-purple-600 block">Evening</span>
                <span className="text-sm font-black text-purple-900">{shiftCounts.E}회</span>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-600 block">Night</span>
                <span className="text-sm font-black text-emerald-900">{shiftCounts.N}회</span>
              </div>
              <div className="p-2 bg-amber-50 border border-amber-100 rounded-2xl">
                <span className="text-[10px] font-bold text-amber-600 block">Mid</span>
                <span className="text-sm font-black text-amber-900">{shiftCounts.M}회</span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 block">OFF</span>
                <span className="text-sm font-black text-slate-700">{shiftCounts.OFF}회</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. 단가 설정 탭 */}
      {activeSubTab === 'config' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5 border-b pb-2">
            <Settings size={16} className="text-indigo-600" /> 근무별 수당 및 시급 설정
          </h3>

          <div className="space-y-3">
            {/* 시급 설정 */}
            <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between">
              <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1">
                <Clock size={14} className="text-indigo-600" /> 통상 시급
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={tempConfigs.hourlyWage ?? 13000}
                  onChange={(e) =>
                    setTempConfigs({ ...tempConfigs, hourlyWage: Number(e.target.value) || 0 })
                  }
                  className="w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-right outline-none focus:border-indigo-500"
                />
                <span className="text-xs font-bold text-slate-500">원</span>
              </div>
            </div>

            {/* D / E / N / M 근무별 수당 및 야간시간 */}
            {['D', 'E', 'N', 'M'].map((code) => (
              <div key={code} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-800">{code} 근무 설정</span>
                  <button
                    type="button"
                    onClick={() => autoCalculateNightPay(code)}
                    className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-0.5"
                  >
                    <Calculator size={10} /> 야간수당 자동계산
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">야간시간(22시~06시)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        value={tempConfigs[code]?.nightHours ?? 0}
                        onChange={(e) =>
                          setTempConfigs({
                            ...tempConfigs,
                            [code]: { ...(tempConfigs[code] || {}), nightHours: Number(e.target.value) || 0 }
                          })
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-xl font-bold text-right outline-none"
                      />
                      <span className="text-[11px] font-bold text-slate-500">시간</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">건당 고정수당</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={tempConfigs[code]?.pay ?? 0}
                        onChange={(e) =>
                          setTempConfigs({
                            ...tempConfigs,
                            [code]: { ...(tempConfigs[code] || {}), pay: Number(e.target.value) || 0 }
                          })
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-xl font-bold text-right outline-none"
                      />
                      <span className="text-[11px] font-bold text-slate-500">원</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveConfigs}
            className="w-full py-3 bg-indigo-600 text-white font-extrabold text-xs rounded-2xl hover:bg-indigo-700 transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
          >
            <Save size={14} /> 설정 저장하기
          </button>
        </div>
      )}
    </div>
  );
}
