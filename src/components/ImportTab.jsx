import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Trash2, X, Camera, Smartphone } from 'lucide-react';

export default function ImportTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  userName,
  setUserName,
  handleClearAllData
}) {
  const [statusMessage, setStatusMessage] = useState('');
  const [importType, setImportType] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);

  // 샘플 데이터 반영 로직
  const handleSelectName = (selectedName) => {
    const sampleShifts = {
      '2026-09-01': 'D', '2026-09-02': 'E', '2026-09-03': 'N', '2026-09-04': 'OFF', '2026-09-05': 'D',
      '2026-09-06': 'D', '2026-09-07': 'E', '2026-09-08': 'N', '2026-09-09': 'OFF', '2026-09-10': 'D'
    };

    if (setMyShifts) {
      setMyShifts(prev => ({ ...(prev || {}), ...sampleShifts }));
    }
    if (setUserName) setUserName(selectedName);
    setShowNameModal(false);
    setStatusMessage(`🎉 [${selectedName}] 선생님의 근무표가 정상 등록되었습니다.`);
  };

  const handleFileUpload = (type) => {
    setImportType(type);
    setShowNameModal(true);
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <Upload size={18} className="text-indigo-600" /> 스마트 근무표 & 캘린더 가져오기
        </h2>

        {/* 1. 엑셀 근무표 (초록색 테두리 & 버튼) */}
        <div style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }} className="p-5 border-2 border-dashed rounded-3xl text-center space-y-3">
          <div style={{ backgroundColor: '#D1FAE5', color: '#059669' }} className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto font-black">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-800">
              엑셀 근무표 파일(.xlsx, .csv) 가져오기
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              병원에서 받은 엑셀 근무표 파일을 올려주세요.
            </p>
          </div>

          <label 
            onClick={() => handleFileUpload('excel')}
            style={{ backgroundColor: '#059669' }} 
            className="inline-block px-6 py-2.5 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer hover:opacity-90"
          >
            엑셀 파일 선택
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" />
          </label>
        </div>

        {/* 2. 근무표 사진 / 카메라 (보라색 테두리 & 버튼) */}
        <div style={{ borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }} className="p-5 border-2 border-dashed rounded-3xl text-center space-y-3">
          <div style={{ backgroundColor: '#EDE9FE', color: '#7C3AED' }} className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto">
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
            <label 
              onClick={() => handleFileUpload('image')}
              style={{ backgroundColor: '#4F46E5' }} 
              className="px-5 py-2.5 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer hover:opacity-90"
            >
              📷 사진첩 선택
              <input type="file" accept="image/*" className="hidden" />
            </label>
            <label 
              onClick={() => handleFileUpload('image')}
              style={{ backgroundColor: '#1E293B' }} 
              className="px-5 py-2.5 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer hover:opacity-90"
            >
              📷 촬영하기
              <input type="file" accept="image/*" capture="environment" className="hidden" />
            </label>
          </div>
        </div>

        {/* 3. 휴대폰 캘린더 (하늘색 테두리 & 버튼) */}
        <div style={{ borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' }} className="p-5 border-2 border-dashed rounded-3xl text-center space-y-3">
          <div style={{ backgroundColor: '#E0F2FE', color: '#0284C7' }} className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto">
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

          <label 
            style={{ backgroundColor: '#0284C7' }} 
            className="inline-block px-6 py-2.5 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer hover:opacity-90"
          >
            폰 캘린더 파일(.ics) 선택
            <input 
              type="file" 
              accept=".ics" 
              onChange={() => alert('캘린더 파일이 선택되었습니다.')} 
              className="hidden" 
            />
          </label>
        </div>

        {/* 상태 메시지 */}
        {statusMessage && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs font-bold text-slate-700">
            {statusMessage}
          </div>
        )}

        {/* 초기화 버튼 */}
        <div className="pt-3 border-t border-slate-100 text-center">
          <button
            onClick={() => {
              if (window.confirm('저장된 데이터를 모두 초기화하시겠습니까?')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
          >
            <Trash2 size={14} />
            <span>앱 저장 데이터 전체 초기화 및 로그아웃</span>
          </button>
        </div>
      </div>

      {/* 이름 선택 모달 */}
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
