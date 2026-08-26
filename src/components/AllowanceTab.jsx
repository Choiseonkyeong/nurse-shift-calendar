import React from 'react';
import { Settings, Palmtree, RefreshCw, Calculator } from 'lucide-react';

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
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-700">
          <Settings size={18} /> 내 병원 3교대 근무시간 설정
        </h2>
        <p className="text-[11px] text-slate-500">병원에 맞는 근무시간 및 야간 인정시간을 설정하세요.</p>

        <div className="space-y-2">
          {['D', 'E', 'N', 'M'].map((code) => (
            <div key={code} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border text-xs gap-2">
              <span className="font-extrabold w-6 text-center" style={{ color: shiftConfigs[code].textColor }}>{code}</span>
              <input 
                type="text" 
                value={shiftConfigs[code].time} 
                onChange={(e) => handleConfigChange(code, 'time', e.target.value)}
                placeholder="예: 07:30 - 15:30"
                className="flex-1 px-2 py-1 bg-white border rounded-lg text-slate-800 font-semibold text-center"
              />
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 font-bold">야간인정:</span>
                <input 
                  type="number" 
                  step="0.5"
                  value={shiftConfigs[code].nightHours} 
                  onChange={(e) => handleConfigChange(code, 'nightHours', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-12 text-center py-1 bg-white border rounded-lg font-bold text-indigo-600"
                />
                <span className="text-[10px]">시간</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-extrabold text-base flex items-center gap-2 text-pink-700">
            <Palmtree size={18} /> 연차(휴가) 현황
          </h2>
          {manualUsedAnnual !== null && (
            <button 
              onClick={() => setManualUsedAnnual(null)}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition"
            >
              <RefreshCw size={11} />
              <span>자동 집계 복원</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-pink-50/60 p-3 rounded-xl border border-pink-100">
            <p className="text-[10px] text-pink-600 font-bold">총 부여 연차</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <input 
                type="number" 
                value={totalAnnualLeave} 
                onChange={(e) => setTotalAnnualLeave(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-12 text-center font-extrabold text-lg bg-white border rounded-lg text-pink-900"
              />
              <span className="text-xs font-bold text-pink-700">개</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p className="text-[10px] text-slate-500 font-bold flex items-center justify-center gap-0.5">
              <span>사용 연차</span>
              {manualUsedAnnual !== null && <span className="text-[9px] text-indigo-600 font-extrabold">(수동)</span>}
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <input 
                type="number" 
                step="0.5"
                value={manualUsedAnnual !== null ? manualUsedAnnual : autoAnnualLeaveCount} 
                onChange={(e) => setManualUsedAnnual(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-12 text-center font-extrabold text-lg bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-xs font-bold text-slate-600">개</span>
            </div>
          </div>

          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
            <p className="text-[10px] text-indigo-600 font-bold">잔여 연차</p>
            <p className="font-extrabold text-lg text-indigo-900 mt-1.5">{remainingAnnualLeave}개</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-700">
            <Calculator size={18} /> {currentMonth}월 수당 계산기
          </h2>
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
            <button 
              onClick={() => setCalcMode('fixed')} 
              className={`px-2 py-1 rounded-md transition ${calcMode === 'fixed' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'}`}
            >
              회당 수당
            </button>
            <button 
              onClick={() => setCalcMode('hourly')} 
              className={`px-2 py-1 rounded-md transition ${calcMode === 'hourly' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'}`}
            >
              통상 시급
            </button>
          </div>
        </div>

        <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-600 font-semibold">Night(N) 근무:</span>
            <span className="font-extrabold text-indigo-900">{nightShiftCount} 회</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-600 font-semibold">Evening(E) 근무:</span>
            <span className="font-extrabold text-orange-900">{eveningShiftCount} 회</span>
          </div>

          {calcMode === 'fixed' ? (
            <>
              <div className="flex justify-between items-center pt-2 border-t border-indigo-100">
                <span className="text-slate-600 font-semibold">Night 1회당 수당:</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="text" 
                    value={numNightFixed > 0 ? numNightFixed.toLocaleString() : ''} 
                    onChange={(e) => setNightFixedAllowance(e.target.value.replace(/[^0-9]/g, ''))}
                    onFocus={(e) => e.target.select()}
                    placeholder="예: 50,000"
                    className="w-24 text-right font-bold px-2 py-1 bg-white border rounded-lg text-slate-800"
                  />
                  <span>원</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-semibold">Evening 1회당 수당:</span>
                <div className="flex items-center gap-1">
                  <input 
                    type="text" 
                    value={numEveFixed > 0 ? numEveFixed.toLocaleString() : ''} 
                    onChange={(e) => setEveningFixedAllowance(e.target.value.replace(/[^0-9]/g, ''))}
                    onFocus={(e) => e.target.select()}
                    placeholder="예: 10,000"
                    className="w-24 text-right font-bold px-2 py-1 bg-white border rounded-lg text-slate-800"
                  />
                  <span>원</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center pt-2 border-t border-indigo-100">
              <span className="text-slate-600 font-semibold">통상 시급 (원):</span>
              <div className="flex items-center gap-1">
                <input 
                  type="text" 
                  value={numHourlyWage > 0 ? numHourlyWage.toLocaleString() : ''} 
                  onChange={(e) => setHourlyWage(e.target.value.replace(/[^0-9]/g, ''))}
                  onFocus={(e) => e.target.select()}
                  placeholder="예: 13,000"
                  className="w-24 text-right font-bold px-2 py-1 bg-white border rounded-lg text-slate-800"
                />
                <span>원</span>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-indigo-200 flex justify-between items-center">
            <span className="font-extrabold text-slate-900 text-sm">{currentMonth}월 예상 수당:</span>
            <span className="font-black text-indigo-600 text-lg">
              {estimatedAllowance.toLocaleString()} 원
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
