import React, { useState } from 'react';
import { DollarSign, Clock, CalendarCheck, Settings, Save } from 'lucide-react';
import { splitDateKey, getTodayDateObj } from '../utils/dateUtils';

export default function AllowanceTab({
  myShifts = {},
  shiftConfigs = {},
  setShiftConfigs,
  selectedDate
}) {
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [tempConfigs, setTempConfigs] = useState(shiftConfigs || {});

  // 안전한 객체 접근 보장
  const safeShifts = myShifts || {};
  const safeConfigs = shiftConfigs || {};

  // 선택 날짜 기준 연/월 파싱
  const { year, month } = selectedDate ? splitDateKey(selectedDate) : getTodayDateObj();

  // 이번 달 근무 카운트 및 수당 계산 (방어 로직 강화)
  const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  
  const shiftCounts = { D: 0, E: 0, N: 0, OFF: 0 };
  let totalAllowance = 0;

  Object.entries(safeShifts).forEach(([dateKey, code]) => {
    if (dateKey.startsWith(currentMonthPrefix) && code) {
      if (shiftCounts[code] !== undefined) {
        shiftCounts[code] += 1;
      }
      const pay = safeConfigs[code]?.pay || 0;
      totalAllowance += Number(pay) || 0;
    }
  });

  // 숫자를 안전하게 콤마 포맷팅하는 유틸 (undefined 방지)
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
    <div className="space-y-4 font-sans max-w-md mx-auto">
      {/* 1. 당월 예상 수당 총액 카드리포트 */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-5 rounded-2xl shadow-md space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold opacity-80 flex items-center gap-1">
            <DollarSign size={16} /> {year}년 {month}월 예상 근무 수당
          </span>
          <button
            onClick={() => {
              setTempConfigs(safeConfigs);
              setIsEditingConfig(!isEditingConfig);
            }}
            className="text-[11px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg border border-white/20 transition flex items-center gap-1 cursor-pointer"
          >
            <Settings size={12} />
            <span>{isEditingConfig ? '닫기' : '수당 단가 설정'}</span>
          </button>
        </div>

        <div className="space-y-1">
          <div className="text-3xl font-black tracking-tight">
            {formatMoney(totalAllowance)} 원
          </div>
          <p className="text-[11px] opacity-75">
            * 설정된 근무별 단가 기준 집계 금액입니다.
          </p>
        </div>
      </div>

      {/* 2. 단가 설정 폼 (편집 모드 시) */}
      {isEditingConfig && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-black text-slate-800 flex items-center gap-1 border-b pb-2">
            <Settings size={14} className="text-indigo-600" /> 근무별 단가 설정 (원)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {['D', 'E', 'N'].map((code) => (
              <div key={code} className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-extrabold text-slate-700">{code} 근무 단가</span>
                <input
                  type="number"
                  value={tempConfigs[code]?.pay ?? 0}
                  onChange={(e) => handleConfigChange(code, 'pay', e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveConfigs}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <Save size={14} /> 단가 저장하기
          </button>
        </div>
      )}

      {/* 3. 근무 현황 통계 (D / E / N / OFF) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <h3 className="text-xs font-black text-slate-800 flex items-center gap-1">
          <CalendarCheck size={14} className="text-indigo-600" /> {month}월 근무 통계
        </h3>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-amber-700 block">Day</span>
            <span className="text-base font-black text-amber-900">{shiftCounts.D}회</span>
            <span className="text-[9px] text-amber-600 block">{formatMoney((safeConfigs.D?.pay || 0) * shiftCounts.D)}원</span>
          </div>

          <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-orange-700 block">Evening</span>
            <span className="text-base font-black text-orange-900">{shiftCounts.E}회</span>
            <span className="text-[9px] text-orange-600 block">{formatMoney((safeConfigs.E?.pay || 0) * shiftCounts.E)}원</span>
          </div>

          <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-sky-700 block">Night</span>
            <span className="text-base font-black text-sky-900">{shiftCounts.N}회</span>
            <span className="text-[9px] text-sky-600 block">{formatMoney((safeConfigs.N?.pay || 0) * shiftCounts.N)}원</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-slate-500 block">휴무</span>
            <span className="text-base font-black text-slate-700">{shiftCounts.OFF}회</span>
            <span className="text-[9px] text-slate-400 block">-</span>
          </div>
        </div>
      </div>
    </div>
  );
}
