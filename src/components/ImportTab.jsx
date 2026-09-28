import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Trash2, X, Camera, Smartphone, CheckCircle2, Loader2 } from 'lucide-react';
import { unregisterDevice } from '../lib/pushNotifications';

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
  const [detectedYearMonth, setDetectedYearMonth] = useState('2026-09');

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

  // 1. 엑셀 파서 (7명 전원 정밀 추출 및 줄바꿈/특수문자 정제)
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('⏳ 엑셀 근무표 연도/월 및 데이터 분석 중...');

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

          // 엑셀 상단 타이틀에서 YYYY년 MM월 자동 감지
          let parsedYear = 2026;
          let parsedMonth = 9;
          let foundHeaderYearMonth = false;

          for (let r = 0; r < Math.min(5, matrix.length); r++) {
            const rowStr = matrix[r].join(' ');
            const match = rowStr.match(/(\20\d{2}|\d{4})\s*년\s*(\d{1,2})\s*월/);
            if (match) {
              parsedYear = parseInt(match[1], 10);
              parsedMonth = parseInt(match[2], 10);
              foundHeaderYearMonth = true;
              break;
            }
          }

          if (!foundHeaderYearMonth && selectedDate) {
            const [sYear, sMonth] = selectedDate.split('-').map(Number);
            parsedYear = sYear;
            parsedMonth = sMonth;
          }

          const targetYM = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}`;
          setDetectedYearMonth(targetYM);

          const prevDateObj = new Date(parsedYear, parsedMonth - 2, 1);
          const prevYear = prevDateObj.getFullYear();
          const prevMonth = prevDateObj.getMonth() + 1;

          // 날짜 행(1~31) 탐색
          let dateRowIdx = -1;
          const colToDateMap = {};

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

                if (!isCurrentMonthPart) {
                  const formattedMonth = String(prevMonth).padStart(2, '0');
                  const formattedDay = String(day).padStart(2, '0');
                  colToDateMap[col] = `${prevYear}-${formattedMonth}-${formattedDay}`;
                } else {
                  const formattedMonth = String(parsedMonth).padStart(2, '0');
                  const formattedDay = String(day).padStart(2, '0');
                  colToDateMap[col] = `${parsedYear}-${formattedMonth}-${formattedDay}`;
                }
              });
              break;
            }
          }

          if (dateRowIdx === -1) {
            alert('엑셀 파일에서 날짜 행을 찾지 못했습니다.');
            setIsProcessing(false);
            return;
          }

          const nameMap = {};
          
          // 시스템 및 직급 제외 키워드
          const excludeKeywords = [
            '날짜', '이름', '성명', '구분', '직급', '근무', '토', '일', '월', '화', '수', '목', '금', 
            '비고', '합계', '부서', '팀', 'HN', 'CN', 'RN', 'OFF', '오프', '휴무', '연차', '분당', '병동', '보고', '사항'
          ];

          for (let r = dateRowIdx + 1; r < matrix.length; r++) {
            const row = matrix[r];
            if (!row || row.length === 0) continue;

            let foundName = '';
            
            // 앞쪽 4개 열(A~D열) 순회하며 정확한 이름 정제
            for (let c = 0; c < Math.min(4, row.length); c++) {
              let val = String(row[c] || '').trim();
              if (!val) continue;

              // 1. 줄바꿈(`\n`)이 있으면 첫 줄 텍스트만 취득 (예: '남영주\n(N-keep)' -> '남영주')
              val = val.split('\n')[0].split('(')[0].trim();

              // 2. 근무 코드 매칭용 단어 제외
              const isShiftCodeOnly = /^(D|E|N|M|OFF|DD|DDEE|DE|N\/|\/)$/i.test(val);
              
              // 3. 순수 한글 2~4자 이름 추출
              const isKoreanName = /^[가-힣]{2,4}$/.test(val);

              if (
                val && 
                isKoreanName && 
                !isShiftCodeOnly && 
                !excludeKeywords.includes(val)
              ) {
                foundName = val;
                break;
              }
            }

            if (foundName) {
              const personShifts = {};

              Object.entries(colToDateMap).forEach(([colStr, dateKey]) => {
                const c = parseInt(colStr, 10);
                let rawShift = String(row[c] || '').trim().toUpperCase();

                // 표기 통일: 주(주간)→D, 야(야간)→N, 휴/오프/휴무→OFF (앱 근무 코드로 저장·집계되도록)
                const ALIASES = { '주': 'D', '야': 'N', '휴': 'OFF' };
                let finalShift = '';
                if (['D', 'E', 'N', 'M', 'OFF', '연차'].includes(rawShift)) {
                  finalShift = rawShift;
                } else if (ALIASES[rawShift]) {
                  finalShift = ALIASES[rawShift];
                } else if (rawShift.includes('OFF') || rawShift === '오프' || rawShift === '휴무') {
                  finalShift = 'OFF';
                }

                if (finalShift) {
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
            alert('엑셀 파일에서 근무자 이름 목록을 읽지 못했습니다.');
            setStatusMessage('❌ 파싱 실패');
            setIsProcessing(false);
            return;
          }

          setParsedDataByName(nameMap);
          setExtractedNames(foundNames);
          setShowNameModal(true);
          setStatusMessage(`✅ [${parsedYear}년 ${parsedMonth}월] 총 ${foundNames.length}명의 근무자 추출 완료!`);

        } catch (err) {
          console.error(err);
          setStatusMessage('❌ 엑셀 분석 오류가 발생했습니다.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error(err);
      setStatusMessage('❌ 파서 로드 실패');
      setIsProcessing(false);
    }
  };

  // 3. 본인 이름 선택 시 저장 및 자동 달력 연/월 이동
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

    if (setSelectedDate && detectedYearMonth) {
      setSelectedDate(`${detectedYearMonth}-01`);
    }

    setShowNameModal(false);
    setStatusMessage(`🎉 [${selectedName}] 님의 근무표가 내 달력(${detectedYearMonth})에 완벽히 저장되었습니다!`);
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

        {/* 2~3. 사진 인식 / 폰 캘린더(.ics) — 실제 분석 기능 개발 전까지 비활성화 */}
        {[
          { icon: <Camera size={20} />, title: '근무표 사진 / 카메라 촬영 인식', bg: '#F5F3FF', fg: '#7C3AED', chip: '#EDE9FE' },
          { icon: <Smartphone size={20} />, title: '휴대폰 기본 캘린더(.ics) 가져오기', bg: '#F0F9FF', fg: '#0284C7', chip: '#E0F2FE' }
        ].map((item) => (
          <div
            key={item.title}
            style={{ backgroundColor: item.bg }}
            className="p-4 rounded-3xl flex items-center gap-3 opacity-70"
          >
            <div style={{ backgroundColor: item.chip, color: item.fg }} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-black text-sm text-slate-800">{item.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">곧 지원 예정입니다. 지금은 엑셀 파일로 가져와 주세요.</p>
            </div>
            <span className="px-2 py-1 rounded-lg bg-white text-[10px] font-black text-slate-400 shrink-0">준비 중</span>
          </div>
        ))}

        {/* 상태 메시지 */}
        {statusMessage && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-center text-xs font-bold text-indigo-900 flex items-center justify-center gap-2">
            <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 text-center">
          <button
            onClick={async () => {
              if (window.confirm('저장된 근무표 및 그룹 데이터를 모두 초기화하시겠습니까?')) {
                await unregisterDevice(); // 초기화 후 이전 계정 알림이 오지 않도록 토큰 해제
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
              분석된 근무자 목록입니다. 본인 이름을 선택하시면 근무표가 달력에 즉시 저장됩니다.
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
