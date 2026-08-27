import React from 'react';
import { Settings, Calculator, CalendarCheck } from 'lucide-react';

export default function AllowanceTab({
  shiftConfigs,
  handleConfigChange,
  manualUsedAnnual,
  setManualUsedAnnual,
  totalAnnualLeave,
  setTotalAnnualLeave,
  autoAnnualLeaveCount,
  remainingAnnualLeave,
  currentMonth,
  calcMode,
  setCalcMode,
  nightShiftCount,
  eveningShiftCount,
  numNightFixed,
  setNightFixedAllowance,
  numEveFixed,
  setEveningFixedAllowance,
  numHourlyWage,
  setHourlyWage,
  estimatedAllowance
}) {
  return (
    <div className="space-y-3.5">
      {/* 1. 병원 3교대 근무시간 및 야간인정 설정 (UI 개선 영역) */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-3">
        <div className="border-b pb-2 border-slate-100">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-indigo-600" />
            내 병원 3교대 근무시간 설정
          </h2>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">
            병원에 맞는 근무시간 및 야간 인정시간을 설정하세요.
          </p>
        </div>

        <div className="space-y-2">
          {Object.entries(shiftConfigs).map(([code, config]) => {
            if (code === 'OFF' || code === '연차') return null;

            return (
              <div 
                key={code} 
                className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2"
              >
                {/* 근무 코드 배지 */}
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 shadow-2xs"
                  style={{ backgroundColor: config.color, color: config.textColor }}
                >
                  {code}
                </div>

                {/* 시간 입력 필드 (너비 슬림하게 조정) */}
                <div className="flex-1 flex items-center justify-center">
                  <input
                    type="text"
                    value={config.time}
                    onChange={(e) => handleConfigChange(code, 'time', e.target.value)}
                    className="w-36 text-center font-black text-xs py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                </div>

                {/* 야간인정 입력 필드 */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] font-extrabold text-slate-500">야간인정:</span>
                  <input
                    type="number"
                    step="0.5"
                    value={config.nightHours}
                    onChange={(e) => handleConfigChange(code, 'nightHours', parseFloat(e.target.value) || 0)}
                    className="w-12 text-center font-black text-xs py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-indigo-600 focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                  <span className="text-[11px] font-extrabold text-slate-500">시간</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. 연차 관리 카드 */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-3">
        <div className="border-b pb-2 border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <CalendarCheck className="w-4 h-4 text-pink-600" />
            연차 잔여일수 관리
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[10px] font-extrabold text-slate-400 block">총 부여 연차</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={totalAnnualLeave}
                onChange={(e) => setTotalAnnualLeave(e.target.value)}
                className="w-14 font-black text-sm p-1 bg-white border border-slate-200 rounded-lg text-center outline-none"
              />
              <span className="font-extrabold text-slate-600">일</span>
            </div>
          </div>

          <div className="p-3 bg-pink-50/60 rounded-xl border border-pink-100 space-y-1">
            <span className="text-[10px] font-extrabold text-pink-500 block">남은 잔여 연차</span>
            <div className="text-base font-black text-pink-600">
              {remainingAnnualLeave} <span className="text-xs">일</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 야간/이브닝 수당 시뮬레이션 카드 */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-3">
        <div className="border-b pb-2 border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-emerald-600" />
            {currentMonth}월 야간/이브닝 수당 계산기
          </h2>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-black">
          <button
            onClick={() => setCalcMode('fixed')}
            className={`flex-1 py-1.5 rounded-lg transition ${calcMode === 'fixed' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-400'}`}
          >
            정액 수당 방식
          </button>
          <button
            onClick={() => setCalcMode('hourly')}
            className={`flex-1 py-1.5 rounded-lg transition ${calcMode === 'hourly' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-400'}`}
          >
            시급 연동 방식 (1.5배)
          </button>
        </div>

        {calcMode === 'fixed' ? (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center p-2 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-extrabold text-slate-700">나이트 회당 수당:</span>
              <input
                type="text"
                value={numNightFixed.toLocaleString()}
                onChange={(e) => setNightFixedAllowance(e.target.value)}
                className="w-20 font-black text-right p-1 bg-white border border-slate-200 rounded-lg outline-none"
              />
              <span className="font-extrabold text-slate-600 ml-1">원</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-extrabold text-slate-700">이브닝 회당 수당:</span>
              <input
                type="text"
                value={numEveFixed.toLocaleString()}
                onChange={(e) => setEveningFixedAllowance(e.target.value)}
                className="w-20 font-black text-right p-1 bg-white border border-slate-200 rounded-lg outline-none"
              />
              <span className="font-extrabold text-slate-600 ml-1">원</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="font-extrabold text-slate-700">통상 통상시급 기준:</span>
            <input
              type="text"
              value={numHourlyWage.toLocaleString()}
              onChange={(e) => setHourlyWage(e.target.value)}
              className="w-24 font-black text-right p-1 bg-white border border-slate-200 rounded-lg outline-none"
            />
            <span className="font-extrabold text-slate-600 ml-1">원</span>
          </div>
        )}

        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-extrabold text-emerald-800 block">예상 야간/이브닝 수당</span>
            <span className="text-[10px] font-bold text-emerald-600">
              Night {nightShiftCount}회 / Evening {eveningShiftCount}회 기준
            </span>
          </div>
          <div className="text-lg font-black text-emerald-700">
            {estimatedAllowance.toLocaleString()} <span className="text-xs">원</span>
          </div>
        </div>
      </div>
    </div>
  );
}
