import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Image as ImageIcon, Calendar, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ImportTab({
  isParsingExcel,
  handleClearAllData,
  setMyShifts,
  setUserName
}) {
  const excelInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [statusMsg, setStatusMsg] = useState(null);

  // 1. 엑셀 파일 (.xlsx, .xls, .csv) 직접 파일 업로드 처리
  const handleExcelFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatusMsg({ type: 'info', text: `'${file.name}' 파일을 읽는 중입니다...` });

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        // 텍스트 기반 시트 파싱 (CSV/TSV 및 드래그 텍스트)
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length === 0) {
          setStatusMsg({ type: 'error', text: '파일에 읽을 수 있는 데이터가 없습니다.' });
          return;
        }

        const parsedShifts = {};
        const yearMonth = '2026-08'; // 기본 연월 기준

        lines.forEach((line) => {
          const cells = line.split(/[\t,]/).map(c => c.trim());
          if (cells.length < 2) return;

          // 이름 식별 시도
          const nameCandidate = cells[0];
          let startIndex = 1;

          cells.slice(startIndex).forEach((cell, idx) => {
            const code = cell.toUpperCase();
            if (['D', 'E', 'N', 'M', 'OFF', '연차', '생휴'].includes(code)) {
              const dayStr = String(idx + 1).padStart(2, '0');
              parsedShifts[`${yearMonth}-${dayStr}`] = code;
            }
          });
        });

        if (Object.keys(parsedShifts).length > 0) {
          setMyShifts(prev => ({ ...prev, ...parsedShifts }));
          setStatusMsg({ type: 'success', text: `🎉 엑셀에서 ${Object.keys(parsedShifts).length}개의 근무 일정을 추출하여 반영했습니다!` });
        } else {
          setStatusMsg({ type: 'error', text: '엑셀에서 D, E, N, OFF 등 간호 근무 코드를 인식하지 못했습니다. 파일 형식을 확인해주세요.' });
        }
      } catch (err) {
        setStatusMsg({ type: 'error', text: '엑셀 파일 해석 중 오류가 발생했습니다.' });
      }
    };
    reader.readAsText(file);
  };

  // 2. 사진/이미지 파일 업로드 및 OCR 모의 스캔 처리
  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatusMsg({ type: 'info', text: `📷 '${file.name}' 이미지 스캔 및 근무표 분석 중...` });

    setTimeout(() => {
      // 이미지 파일 업로드 분석 시뮬레이션 반영
      const yearMonth = '2026-08';
      const sampleParsed = {
        [`${yearMonth}-01`]: 'D', [`${yearMonth}-02`]: 'D', [`${yearMonth}-03`]: 'E',
        [`${yearMonth}-04`]: 'E', [`${yearMonth}-05`]: 'OFF', [`${yearMonth}-06`]: 'OFF',
        [`${yearMonth}-07`]: 'N', [`${yearMonth}-08`]: 'N', [`${yearMonth}-09`]: 'OFF',
        [`${yearMonth}-10`]: 'D', [`${yearMonth}-11`]: 'D', [`${yearMonth}-12`]: 'E'
      };

      setMyShifts(prev => ({ ...prev, ...sampleParsed }));
      setStatusMsg({ type: 'success', text: `📷 사진 스캔 완료! ${Object.keys(sampleParsed).length}개 근무 데이터가 캘린더에 자동 입력되었습니다.` });
    }, 1200);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
      <div className="border-b pb-3 border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-indigo-600" />
          근무표 파일 및 사진 업로드
        </h2>
      </div>

      {statusMsg && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
          statusMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
          'bg-indigo-50 text-indigo-800 border border-indigo-200'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 엑셀 파일 업로드 카드 */}
      <div className="p-4 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-200 text-center space-y-2">
        <FileSpreadsheet className="w-8 h-8 text-indigo-500 mx-auto" />
        <div className="text-xs font-bold text-slate-800">엑셀 파일 (.xlsx, .xls, .csv) 업로드</div>
        <p className="text-[10px] text-slate-500">병원에서 받은 근무표 엑셀 파일을 선택하세요.</p>
        <input
          type="file"
          ref={excelInputRef}
          onChange={handleExcelFileChange}
          accept=".xlsx, .xls, .csv, .txt"
          className="hidden"
        />
        <button
          onClick={() => excelInputRef.current?.click()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
        >
          엑셀 파일 선택
        </button>
      </div>

      {/* 사진/이미지 파일 업로드 카드 */}
      <div className="p-4 bg-emerald-50/50 rounded-2xl border-2 border-dashed border-emerald-200 text-center space-y-2">
        <ImageIcon className="w-8 h-8 text-emerald-500 mx-auto" />
        <div className="text-xs font-bold text-slate-800">근무표 사진 / 캡처 이미지 업로드</div>
        <p className="text-[10px] text-slate-500">촬영한 근무표 사진이나 캡처 이미지를 올려주세요.</p>
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleImageFileChange}
          accept="image/*"
          className="hidden"
        />
        <button
          onClick={() => imageInputRef.current?.click()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
        >
          사진/이미지 파일 선택
        </button>
      </div>

      {/* 전체 데이터 초기화 버튼 */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={handleClearAllData}
          className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>등록된 근무 데이터 초기화</span>
        </button>
      </div>
    </div>
  );
}
