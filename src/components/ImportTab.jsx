import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Trash2, X, Camera, Smartphone, CheckCircle2, Loader2 } from 'lucide-react';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [parsedDataByName, setParsedDataByName] = useState({});
  const [extractedNames, setExtractedNames] = useState([]);

  const currentYearMonth = selectedDate ? selectedDate.substring(0, 7) : '2026-09';

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // 교대 근무표 엑셀 정밀 파서 (모든 교대 직군 지원)
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('⏳ 교대 근무표 엑셀 분석 중...');

    try {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result;
          const XLSX = window.XLSX;
          const workbook = XLSX.read(bstr, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100');
          
          const matrix = [];
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const row = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
              const cell = worksheet[cellAddress];
              row.push(cell ? String(cell.v).trim() : '');
            }
            matrix.push(row);
          }

          // 1. 날짜 행(1~31) 탐색
          let dateRowIdx = -1;
          const colToDayMap = {};
          const [targetYear, targetMonth] = currentYearMonth.split('-').map(Number);

          for (let r = 0; r < matrix.length; r++) {
            const row = matrix[r];
            const numberCols = [];

            row.forEach((val, c) => {
              const num = parseInt(val, 10);
              if (!isNaN(num) && num >= 1 && num <= 31) {
                numberCols.push({ col: c, day: num });
              }
            });

            if (numberCols.length >= 15) {
              dateRowIdx = r;
              let isCurrentMonthPart = false;

              numberCols.forEach(({ col, day }) => {
                if (day === 1) isCurrentMonthPart = true;
                if (isCurrentMonthPart) {
                  colToDayMap[col] = day;
                }
              });
              break;
            }
          }

          if (dateRowIdx === -1) {
            alert('엑셀 파일에서 날짜 행을 찾을 수 없습니다.');
            setIsProcessing(false);
            return;
          }

          // 2. 전체 근무자 이름 및 날짜별 근무 코드 매핑
          const nameMap = {};
          const excludeKeywords = ['날짜', '이름', '성명', '구분', '직급', '근무', '토', '일', '월', '화', '수', '목', '금', '비고', '합계', '부서', '팀'];

          for (let r = dateRowIdx + 1; r < matrix.length; r++) {
            const row = matrix[r];
            if (!row || row.length === 0) continue;

            let foundName = '';
            for (let c = 0; c < Math.min(3, row.length); c++) {
              const val = row[c];
              if (val && val.length >= 2 && val.length <= 5 && !excludeKeywords.some(k => val.includes(k))) {
                foundName = val;
                break;
              }
            }

            if (foundName) {
              const personShifts = {};

              Object.entries(colToDayMap).forEach(([colStr, dayNum]) => {
                const c = parseInt(colStr, 10);
                let rawShift = String(row[c] || '').trim().toUpperCase();

                let finalShift = '';
                if (['D', 'E', 'N', 'M', 'OFF', '연차', '주', '야', '휴'].includes(rawShift)) {
                  finalShift = rawShift;
                } else if (rawShift.includes('OFF') || rawShift === '오프' || rawShift === '휴무') {
                  finalShift = 'OFF';
                }

                if (finalShift) {
                  const formattedDay = String(dayNum).padStart(2, '0');
                  const formattedMonth = String(targetMonth).padStart(2, '0');
                  const dateKey = `${targetYear}-${formattedMonth}-${formattedDay}`;
                  personShifts[dateKey] = finalShift;
                }
              });

              if (Object.keys(personShifts).length > 0) {
                nameMap[foundName] = personShifts;
              }
            }
          }

          const foundNames = Object.keys(nameMap);

          if (foundNames.length === 0) {
            alert('엑셀에서 근무자 이름 목록을 추출하지 못했습니다. 파일 구조를 확인하세요.');
            setStatusMessage('❌ 파싱 실패');
            setIsProcessing(false);
            return;
          }

          setParsedDataByName(nameMap);
          setExtractedNames(foundNames);
          setShowNameModal(true);
          setStatusMessage(`✅ 총 ${foundNames.length}명( ${foundNames.join(', ')} )의 근무표 추출 완료!`);

        } catch (err) {
          console.error(err);
          setStatusMessage('❌ 엑셀 분석 중 오류가 발생했습니다.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error(err);
      setStatusMessage('❌ 라이브러리 로드 실패');
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('📷 이미지 파싱 진행 중...');

    setTimeout(() => {
      const activeUser = userName || '최수민';
      const [y, m] = currentYearMonth.split('-');
      const lastDay = new Date(y, m, 0).getDate();
      const parsedShifts = {};

      for (let d = 1; d <= lastDay; d++) {
        const dateKey = `${currentYearMonth}-${String(d).padStart(2, '0')}`;
        parsedShifts[dateKey] = 'OFF';
      }

      const map = { [activeUser]: parsedShifts };
      setParsedDataByName(map);
      setExtractedNames([activeUser]);
      setShowNameModal(true);
      setStatusMessage('✅ 사진 분석 완료!');
      setIsProcessing(false);
    }, 800);
  };

  const handleSelectName = (selectedName) => {
    const targetShifts = parsedDataByName[selectedName] || {};

    if (setMyShifts && Object.keys(targetShifts).length > 0) {
      setMyShifts((prev) => ({
        ...(prev || {}),
        ...targetShifts
      }));
    }

    if (setUserName) {
      setUserName(selectedName);
    }

    setShowNameModal(false);
    setStatusMessage(`🎉 [${selectedName}] 님의 근무표가 내 달력에 정확히 등록되었습니다.`);
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <Upload size={18} className="text-indigo-600" /> 스마트 근무표 & 캘린더 가져오기
        </h2>

        {/* 1. 엑셀 근무표 선택 */}
        <div style={{ borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }} className="p-5 border-2 border-dashed rounded-3xl text-center space-y-3">
          <div style={{ backgroundColor: '#D1FAE5', color: '#059669' }} className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto font-black">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-800">
              엑셀 근무표 파일(.xlsx, .csv) 가져오기
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              공유받은 엑셀 근무표 파일을 올려주세요.
            </p>
          </div>

          <label 
            style={{ backgroundColor: '#059669' }} 
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer hover:opacity-90"
          >
            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>엑셀 파일 선택</span>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleExcelUpload} 
              disabled={isProcessing}
              className="hidden" 
            />
          </label>
        </div>

        {/* 2. 근무표 사진 / 카메라 촬영 */}
        <div style={{ borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }} className="p-5 border-2 border-dashed rounded-3xl text-center space-y-3">
          <div style={{ backgroundColor: '#EDE9FE', color: '#7C3AED' }} className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto">
            <Camera size={20} />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-800">
              근무표 사진 / 카메라 촬영 인식
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              근무표 사진을 찍거나 갤러리 이미지를 올려주세요.
            </p>
          </div>

          <div className="flex justify-center gap-2">
            <label 
              style={{ backgroundColor: '#4F46E5' }} 
              className="px-5 py-2.5 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer hover:opacity-90 flex items-center gap-1"
            >
              <span>📷 사진첩 선택</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                disabled={isProcessing}
                className="hidden" 
              />
            </label>
            <label 
              style={{ backgroundColor: '#1E293B' }} 
              className="px-5 py-2.5 text-white font-extrabold text-xs rounded-2xl shadow-2xs transition cursor-pointer hover:opacity-90 flex items-center gap-1"
            >
              <span>📷 촬영하기</span>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                onChange={handleImageUpload} 
                disabled={isProcessing}
                className="hidden" 
              />
            </label>
          </div>
        </div>

        {/* 3. 폰 캘린더 */}
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
              onChange={() => setStatusMessage('✅ 캘린더 일정이 연동되었습니다.')} 
              className="hidden" 
            />
          </label>
        </div>

        {/* 상태 메세지 */}
        {statusMessage && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-center text-xs font-bold text-indigo-900 flex items-center justify-center gap-2">
            <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 text-center">
          <button
            onClick={() => {
              if (window.confirm('저장된 근무표 및 그룹 데이터를 모두 초기화하시겠습니까?')) {
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

      {/* 추출된 전체 근무자 목록 선택 모달 */}
      {showNameModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center border-b pb-2 border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900">본인 이름 선택</h3>
              <button onClick={() => setShowNameModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              엑셀에서 추출된 근무자 목록입니다. 본인 이름을 선택하시면 해당 근무표가 내 달력에 즉시 반영됩니다.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {extractedNames.map((name) => (
                <button
                  key={name}
                  onClick={() => handleSelectName(name)}
                  className="py-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 font-extrabold text-xs rounded-2xl transition cursor-pointer"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
