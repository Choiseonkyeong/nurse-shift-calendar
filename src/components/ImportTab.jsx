import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Image as ImageIcon, Trash2, CheckCircle2, AlertCircle, UserCheck, X, Plus } from 'lucide-react';
import { splitDateKey, shiftShiftsToMonth, getTodayDateObj } from '../utils/dateUtils';

// 목업 데이터의 기준월 설정
const EXCEL_BASE_YEAR = 2026;
const EXCEL_BASE_MONTH = 9;
const PHOTO_BASE_YEAR = 2026;
const PHOTO_BASE_MONTH = 8; // 목업 데이터 원본 기준월

export default function ImportTab({
  setMyShifts,
  setUserName,
  handleClearAllData,
  selectedDate
}) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [importType, setImportType] = useState(null); // 'image' | 'excel'
  const [showNameModal, setShowNameModal] = useState(false);

  // 현재 선택된 날짜 기준 연도 및 월 추출
  const getTargetYearMonth = () => {
    const base = selectedDate ? splitDateKey(selectedDate) : getTodayDateObj();
    return { year: base.year, month: base.month };
  };

  const { year: targetYear, month: targetMonth } = getTargetYearMonth();

  const augustRealShifts = {
    '2026-08-01': 'D', '2026-08-02': 'D', '2026-08-03': 'OFF', '2026-08-04': 'E', '2026-08-05': 'E',
    '2026-08-06': 'OFF', '2026-08-07': 'N', '2026-08-08': 'N', '2026-08-09': 'OFF', '2026-08-10': 'D'
  };

  const nurseShiftsDatabase = {
    '최수민': {
      '2026-09-01': 'D', '2026-09-02': 'E', '2026-09-03': 'N', '2026-09-04': 'OFF', '2026-09-05': 'D'
    },
    '홍숙언': {
      '2026-09-01': 'E', '2026-09-02': 'N', '2026-09-03': 'OFF', '2026-09-04': 'D', '2026-09-05': 'E'
    }
  };

  const handleSelectName = (selectedName) => {
    let targetShifts = {};
    const { year: tYear, month: tMonth } = getTargetYearMonth();

    if (importType === 'image') {
      // 사진(OCR) 데이터도 선택된 연/월(tYear, tMonth)로 정확하게 변환되어 등록됨
      targetShifts = shiftShiftsToMonth(augustRealShifts, PHOTO_BASE_YEAR, PHOTO_BASE_MONTH, tYear, tMonth);
    } else {
      const raw = nurseShiftsDatabase[selectedName] || nurseShiftsDatabase['최수민'];
      targetShifts = shiftShiftsToMonth(raw, EXCEL_BASE_YEAR, EXCEL_BASE_MONTH, tYear, tMonth);
    }

    setMyShifts(prevShifts => ({ ...prevShifts, ...targetShifts }));
    if (setUserName) setUserName(selectedName);
    setShowNameModal(false);
    setStatusMessage(`🎉 [${selectedName}] 선생님의 ${tMonth}월 근무표가 반영되었습니다.`);
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto">
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100 space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-base font-extrabold text-slate-800 flex items-center justify-center gap-1.5">
            <Upload size={18} className="text-indigo-600" /> 스마트 근무표 누적 등록
          </h2>
          <p className="text-xs font-semibold text-slate-500">
            현재 선택월: <span className="text-indigo-600 font-extrabold">{targetYear}년 {targetMonth}월</span>
          </p>
        </div>

        {/* 1. 사진 업로드 영역 */}
        <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mx-auto">
            <ImageIcon size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-emerald-950">
              1. 근무표 사진 업로드
            </h3>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              촬영한 근무표 사진을 올려 {targetMonth}월 근무에 누적시킵니다.
            </p>
          </div>

          <button
            onClick={() => {
              setImportType('image');
              setShowNameModal(true);
            }}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition"
          >
            {targetMonth}월 근무표 사진 등록하기
          </button>
        </div>

        {/* 2. 엑셀 업로드 영역 */}
        <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-indigo-950">
              2. 엑셀 파일 (.xlsx) 업로드
            </h3>
            <p className="text-[11px] text-indigo-700 mt-0.5">
              병원 엑셀 파일을 가져와 {targetMonth}월 근무로 자동 등록합니다.
            </p>
          </div>

          <button
            onClick={() => {
              setImportType('excel');
              setShowNameModal(true);
            }}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition"
          >
            {targetMonth}월 엑셀 파일 선택하기
          </button>
        </div>

        {/* 안내 메시지 */}
        {statusMessage && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold text-slate-700">
            {statusMessage}
          </div>
        )}

        {/* 데이터 초기화 */}
        {handleClearAllData && (
          <div className="pt-2 border-t text-center">
            <button
              onClick={handleClearAllData}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
            >
              <Trash2 size={13} />
              <span>전체 근무 데이터 초기화</span>
            </button>
          </div>
        )}
      </div>

      {/* 간호사 선택 모달 */}
      {showNameModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-sm text-slate-900">본인 이름 선택</h3>
              <button onClick={() => setShowNameModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500">등록할 선생님의 이름을 선택하세요.</p>
            <div className="grid grid-cols-2 gap-2">
              {['홍숙언', '최수민'].map((name) => (
                <button
                  key={name}
                  onClick={() => handleSelectName(name)}
                  className="py-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 font-extrabold text-xs rounded-xl transition"
                >
                  {name} 쌤
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
