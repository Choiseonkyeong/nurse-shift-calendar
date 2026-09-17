import React, { useState } from 'react';
import { DollarSign, Settings, Save, Calendar } from 'lucide-react';

export default function AllowanceTab({
  myShifts = {},
  shiftConfigs = {},
  setShiftConfigs,
  selectedDate
}) {
  const [activeSubTab, setActiveSubTab] = useState('allowance');
  const [tempConfigs, setTempConfigs] = useState(shiftConfigs || {});

  const [year, month] = selectedDate ? selectedDate.split('-').map(Number) : [2026, 9];
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const shiftCounts = { D: 0, E: 0, N: 0, M: 0, OFF: 0, 연차: 0 };
  let totalAllowance = 0;

  Object.entries(myShifts || {}).forEach(([dateKey, code]) => {
    if (dateKey.startsWith(monthPrefix) && code) {
      if (shiftCounts[code] !== undefined) {
        shiftCounts[code] += 1;
      }
      const pay = shiftConfigs[code]?.pay || 0;
      totalAllowance += Number(pay);
    }
  });

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

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
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
            setTempConfigs(shiftConfigs);
            setActiveSubTab('config');
          }}
          className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
            activeSubTab === 'config' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500'
          }`}
        >
          수당 단가 설정
        </button>
      </div>

      {activeSubTab === 'allowance' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 rounded-3xl shadow-md space-y-2">
            <span className="text-xs font-extrabold opacity-80 flex items-center gap-1">
              <DollarSign size={16} /> {year}년 {month}월 예상 근무 수당
            </span>
            <div className="text-3xl font-black">
              {formatMoney(totalAllowance)} <span className="text-base font-bold">원</span>
            </div>
            <p className="text-[11px] opacity-70">* 설정된 근무 단가 기준 집계 금액입니다.</p>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1">
              <Calendar size={14} className="text-indigo-600" /> {month}월 근무 집계
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-2xl">
                <span className="text-[10px] font-bold text-amber-600 block">Day</span>
                <span className="text-base font-black text-amber-900">{shiftCounts.D}회</span>
              </div>
              <div className="p-2.5 bg-orange-50 border border-orange-100 rounded-2xl">
                <span className="text-[10px] font-bold text-orange-600 block">Evening</span>
                <span className="text-base font-black text-orange-900">{shiftCounts.E}회</span>
              </div>
              <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-2xl">
                <span className="text-[10px] font-bold text-sky-600 block">Night</span>
                <span className="text-base font-black text-sky-900">{shiftCounts.N}회</span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-500 block">OFF</span>
                <span className="text-base font-black text-slate-700">{shiftCounts.OFF}회</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'config' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5 border-b pb-2">
            <Settings size={16} className="text-indigo-600" /> 근무별 수당 단가 설정
          </h3>
          <div className="space-y-3">
            {['D', 'E', 'N'].map((code) => (
              <div key={code} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="font-extrabold text-xs text-slate-700">{code} 근무 단가</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={tempConfigs[code]?.pay ?? 0}
                    onChange={(e) => setTempConfigs({
                      ...tempConfigs,
                      [code]: { ...(tempConfigs[code] || {}), pay: Number(e.target.value) || 0 }
                    })}
                    className="w-28 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-right outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-500">원</span>
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
