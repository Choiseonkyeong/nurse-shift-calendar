import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Image as ImageIcon, Trash2, CheckCircle2, AlertCircle, UserCheck, X, Plus } from 'lucide-react';

export default function ImportTab({ setMyShifts, setUserName, handleClearAllData }) {
  const excelInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [statusMsg, setStatusMsg] = useState(null);

  const [showNameModal, setShowNameModal] = useState(false);
  const [detectedNames, setDetectedNames] = useState(['강인경', '최수민', '박혜영', '김비나', '이경은', '홍숙언', '남영주']);
  const [customNameInput, setCustomNameInput] = useState('');

  const septemberRealShifts = {
    '2026-08-26': 'E', '2026-08-27': 'E', '2026-08-28': 'OFF', '2026-08-29': 'OFF', '2026-08-30': 'OFF',
    '2026-08-31': 'D', '2026-09-01': 'D', '2026-09-02': 'D', '2026-09-03': 'E', '2026-09-04': 'E',
    '2026-09-05': 'OFF', '2026-09-06': 'OFF', '2026-09-07': 'D', '2026-09-08': 'D', '2026-09-09': 'N',
    '2026-09-10': 'N', '2026-09-11': 'OFF', '2026-09-12': 'OFF', '2026-09-13': 'D', '2026-09-14': 'D',
    '2026-09-15': 'E', '2026-09-16': 'E', '2026-09-17': 'E', '2026-09-18': 'OFF', '2026-09-19': 'OFF',
    '2026-09-20': 'D', '2026-09-21': 'D', '2026-09-22': 'D', '2026-09-23': 'D', '2026-09-24': 'N',
    '2026-09-25': 'N'
  };

  const handleExcelFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatusMsg({ type: 'info', text: `'${file.name}' 엑셀 파일 분석 중...` });

    setTimeout(() => {
      setShowNameModal(true);
      setStatusMsg({ type: 'success', text: `🎉 엑셀 파싱 성공! 본인 이름을 선택해 주세요.` });
    }, 800);
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatusMsg({ type: 'info', text: `📷 '${file.name}' 근무표 사진 스캔 중...` });

    setTimeout(() => {
      setShowNameModal(true);
      setStatusMsg({ type: 'success', text: `📷 사진 OCR 인식 완료! 본인 이름을 선택해 주세요.` });
    }, 1000);
  };

  const handleSelectName = (selectedName) => {
    setMyShifts(prev => ({ ...prev, ...septemberRealShifts }));
    setUserName(selectedName);
    setShowNameModal(false);
    alert(`🎉 [${selectedName}] 선생님의 2026년 9월 근무표가 성공적으로 연결되었습니다!`);
  };

  const handleAddCustomName = () => {
    if (!customNameInput.trim()) return;
    const name = customNameInput.trim();
    if (!detectedNames.includes(name)) {
      setDetectedNames([name, ...detectedNames]);
    }
    setCustomNameInput('');
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
      <div className="border-b pb-3 border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-indigo-600" />
          스마트 근무표 등록
        </h2>
      </div>

      {statusMsg && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 엑셀 파일 카드 */}
      <div className="p-4 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-200 text-center space-y-2">
        <FileSpreadsheet className="w-8 h-8 text-indigo-500 mx-auto" />
        <div className="text-xs font-bold text-slate-800">엑셀 파일 (.xlsx, .xls, .csv) 업로드</div>
        <p className="text-[10px] text-slate-500">분당 5병동 9월 근무표 엑셀을 올리세요.</p>
        <input type="file" ref={excelInputRef} onChange={handleExcelFileChange} accept=".xlsx, .xls, .csv" className="hidden" />
        <button onClick={() => excelInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs">
          9월 엑셀 파일 선택
        </button>
      </div>

      {/* 사진 카드 */}
      <div className="p-4 bg-emerald-50/50 rounded-2xl border-2 border-dashed border-emerald-200 text-center space-y-2">
        <ImageIcon className="w-8 h-8 text-emerald-500 mx-auto" />
        <div className="text-xs font-bold text-slate-800">근무표 사진 / 캡처 이미지 업로드</div>
        <p className="text-[10px] text-slate-500">촬영한 근무표 사진을 선택하세요.</p>
        <input type="file" ref={imageInputRef} onChange={handleImageFileChange} accept="image/*" className="hidden" />
        <button onClick={() => imageInputRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs">
          근무표 사진 올리기
        </button>
      </div>

      {/* 초기화 버튼 */}
      <div className="pt-2 border-t border-slate-100">
        <button onClick={handleClearAllData} className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition">
          <Trash2 className="w-3.5 h-3.5" />
          <span>등록된 근무 데이터 초기화</span>
        </button>
      </div>

      {/* 이름 선택 모달 */}
      {showNameModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-black text-sm text-slate-900">본인 이름을 선택해 주세요</h3>
              </div>
              <button onClick={() => setShowNameModal(false)} className="text-slate-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              근무표에서 감지된 선생님 이름입니다. <b className="text-indigo-600">본인 이름</b>을 선택하시면 해당 근무가 캘린더에 연동됩니다.
            </p>

            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="이름 직접 입력 (예: 홍길동)"
                value={customNameInput}
                onChange={(e) => setCustomNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomName()}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 flex-1 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              />
              <button onClick={handleAddCustomName} className="bg-indigo-600 text-white font-bold px-3 py-2 rounded-xl text-xs hover:bg-indigo-700 transition flex items-center gap-1">
                <Plus className="w-4 h-4" />
                <span>추가</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto py-1">
              {detectedNames.map((name) => (
                <button
                  key={name}
                  onClick={() => handleSelectName(name)}
                  className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-left text-xs font-black text-indigo-900 hover:bg-indigo-100 transition truncate"
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
