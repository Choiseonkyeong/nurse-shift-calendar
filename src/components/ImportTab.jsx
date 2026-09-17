import React, { useState } from 'react';
import { FileText, Camera, Smartphone, Trash2, X } from 'lucide-react';
import { splitDateKey, shiftShiftsToMonth, getTodayDateObj } from '../utils/dateUtils';

const EXCEL_BASE_YEAR = 2026;
const EXCEL_BASE_MONTH = 9;
const PHOTO_BASE_YEAR = 2026;
const PHOTO_BASE_MONTH = 8;

export default function ImportTab({
  setMyShifts,
  setUserName,
  handleClearAllData,
  selectedDate
}) {
  const [statusMessage, setStatusMessage] = useState('');
  const [importType, setImportType] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);

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
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <FileText size={18} className="text-indigo-600" /> 스마트 근무표 & 캘린더 가져오기
        </h2>

        {/* 1. 엑셀 근무표 녹색 카드 */}
        <div className="p-5 border-2 border-dashed border-emerald-200 bg-emerald-50/30 rounded-3xl text-center space-y-3">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mx-auto font-black">
            📊
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-800">
              엑셀 근무표 파일(.xlsx, .csv) 가져오기
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              병원에서 받은 엑셀 근무표 파일을 올려주세요.
            </p>
          </div>

          <button
            onClick={() => {
              setImportType('excel');
              setShowNameModal(true);
            }}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer"
          >
            엑셀 파일 선택
          </button>
        </div>

        {/* 2. 근무표 사진 보라색 카드 */}
        <div className="p-5 border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-3xl text-center space-y-3">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto">
            <Camera size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-800">
              근무표 사진 / 카메라 촬영 인식
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              종이 근무표 사진을 찍거나 갤러리 이미지를 올려주세요.
            </p>
          </div>

          <div className="flex justify-center gap-2">
            <button
              onClick={() => {
                setImportType('image');
                setShowNameModal(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer"
            >
              📷 사진첩 선택
            </button>
            <button
              onClick={() => {
                setImportType('image');
                setShowNameModal(true);
              }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer"
            >
              📷 촬영하기
            </button>
          </div>
        </div>

        {/* 3. 폰 캘린더 파란색 카드 */}
        <div className="p-5 border-2 border-dashed border-sky-200 bg-sky-50/30 rounded-3xl text-center space-y-3">
          <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mx-auto">
            <Smartphone size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-800">
              휴대폰 기본 캘린더(.ics) 가져오기
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              가져온 개인 일정은 기본적으로 🔒 비공개(나만 보기) 처리됩니다.
            </p>
          </div>

          <button
            onClick={() => alert('캘린더 파일 선택 기능이 호출되었습니다.')}
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer"
          >
            폰 캘린더 파일(.ics) 선택
          </button>
        </div>

        {/* 안내 메시지 */}
        {statusMessage && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs font-bold text-slate-700">
            {statusMessage}
          </div>
        )}

        {/* 초기화 버튼 */}
        <div className="pt-3 border-t border-slate-100 text-center">
          <button
            onClick={handleClearAllData || (() => alert('데이터가 초기화되었습니다.'))}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
          >
            <Trash2 size={14} />
            <span>앱 저장 데이터 전체 초기화 및 로그아웃</span>
          </button>
        </div>
      </div>

      {/* 선생님 선택 모달 */}
      {showNameModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full space-y-4 shadow-xl border border-slate-100">
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
                  className="py-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 font-extrabold text-xs rounded-2xl transition cursor-pointer"
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
