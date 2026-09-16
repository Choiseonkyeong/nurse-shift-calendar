import React, { useState } from 'react';
import { DollarSign, CalendarCheck, Settings, Save, Award } from 'lucide-react';
import { splitDateKey, getTodayDateObj } from '../utils/dateUtils';

export default function AllowanceTab({
  myShifts = {},
  shiftConfigs = {},
  setShiftConfigs,
  selectedDate
}) {
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [tempConfigs, setTempConfigs] = useState(shiftConfigs || {});

  const safeShifts = myShifts || {};
  const safeConfigs = shiftConfigs || {};

  const { year, month } = selectedDate ? splitDateKey(selectedDate) : getTodayDateObj();
  const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const shiftCounts = { D: 0, E: 0, N: 0, OFF: 0 };
  let totalAllowance = 0;

  Object.entries(safeShifts).forEach(([dateKey, code]) => {
    if (dateKey.startsWith(currentMonthPrefix) && code) {
      if (shiftCounts[code] !== undefined) {
        shiftCounts[code] += 1;
      }
      const pay = safeConfigs[code]?.pay;
      totalAllowance += Number(pay || 0);
    }
  });

  // 에러 방지용 안전 포맷팅 함수
  const formatMoney = (val) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const handleConfigChange = (code, field, val) => {
    setTempConfigs(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] || {}),
        [field]: field === 'pay' ? Number(val) || 0 : val
      }
    }));
  };

  const handleSaveConfigs = () => {
    if (setShiftConfigs) {
      setShiftConfigs(tempConfigs);
    }
    setIsEditingConfig(false);
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 1. 상단 수당 요약 카드 */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-xs font-semibold opacity-80 block">
              {year}년 {month}월 예상 수당
            </span>
            <h2 className="text-2xl font-black mt-1">
              {formatMoney(totalAllowance)} 원
            </h2>
          </div>
          <button
            onClick={() => {
              setTempConfigs(safeConfigs);
              setIsEditingConfig(!isEditingConfig);
            }}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-md transition cursor-pointer"
            title="수당 단가 설정"
          >
            <Settings size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/20 text-center text-xs">
          <div className="bg-white/10 backdrop-blur-xs p-2 rounded-xl">
            <span className="block text-[10px] opacity-75">Day ({shiftCounts.D}회)</span>
            <span className="font-bold">{formatMoney((safeConfigs.D?.pay || 0) * shiftCounts.D)}원</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-2 rounded-xl">
            <span className="block text-[10px] opacity-75">Evening ({shiftCounts.E}회)</span>
            <span className="font-bold">{formatMoney((safeConfigs.E?.pay || 0) * shiftCounts.E)}원</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs p-2 rounded-xl">
            <span className="block text-[10px] opacity-75">Night ({shiftCounts.N}회)</span>
            <span className="font-bold">{formatMoney((safeConfigs.N?.pay || 0) * shiftCounts.N)}원</span>
          </div>
        </div>
      </div>

      {/* 2. 단가 설정 모달/영역 */}
      {isEditingConfig && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5 border-b pb-2">
            <Settings size={16} className="text-indigo-600" /> 근무별 수당 단가 수정
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {['D', 'E', 'N'].map((code) => (
              <div key={code} className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">{code} 근무 (원)</label>
                <input
                  type="number"
                  value={tempConfigs[code]?.pay ?? 0}
                  onChange={(e) => handleConfigChange(code, 'pay', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveConfigs}
            className="w-full py-2 bg-indigo-600 text-white font-extrabold text-xs rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <Save size={14} /> 저장하기
          </button>
        </div>
      )}

      {/* 3. 근무 카운트 상세 카드 */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
          <CalendarCheck size={16} className="text-indigo-600" /> 이번 달 근무 집계
        </h3>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <span className="text-[10px] font-bold text-amber-600 block">Day</span>
            <span className="text-lg font-black text-amber-900">{shiftCounts.D}</span>
          </div>
          <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl">
            <span className="text-[10px] font-bold text-orange-600 block">Evening</span>
            <span className="text-lg font-black text-orange-900">{shiftCounts.E}</span>
          </div>
          <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl">
            <span className="text-[10px] font-bold text-sky-600 block">Night</span>
            <span className="text-lg font-black text-sky-900">{shiftCounts.N}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 block">휴무</span>
            <span className="text-lg font-black text-slate-700">{shiftCounts.OFF}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
