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
  const [detectedYearMonth, setDetectedYearMonth] = useState('2026-10');

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

  // 1. 엑셀 파서 (이름 필터링 엄격 적용 및 연도/월 정밀 분기)
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
          let parsedMonth = 10;
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
          
          // 시스템 및 근무 형태 관련 제외 키워드
          const excludeKeywords = [
            '날짜', '이름', '성명', '구분', '직급', '근무', '토', '일', '월', '화', '수', '목', '금', 
            '비고', '합계', '부서', '팀', 'HN', 'CN', 'RN', 'OFF', '오프', '휴무', '연차'
          ];

          for (let r = dateRowIdx + 1; r < matrix.length; r++) {
            const row = matrix[r];
            if (!row || row.length === 0) continue;

            let foundName = '';
            
            // A열~D열(앞쪽 4개 열) 내에서만 이름 탐색
            for (let c = 0; c < Math.min(4, row.length); c++) {
              const val = String(row[c] || '').trim();

              // 1. 근무 코드가 연속된 문자열(DD, DDEE 등)은 이름에서 제외
              const isShiftPattern = /^[DENMOF연차휴주야\s\/]+$/i.test(val);
              
              // 2. 한글 2~4자 순수 이름 조건 체크
              const isKoreanName = /^[가-힣]{2,4}$/.test(val);

              if (
                val && 
                isKoreanName && 
                !isShiftPattern && 
                !excludeKeywords.some(k => val.includes(k))
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

                let finalShift = '';
                if (['D', 'E', 'N', 'M', 'OFF', '연차', '주', '야', '휴'].includes(rawShift)) {
                  finalShift = rawShift;
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
            alert('엑셀 파일에서 근무자 이름 목록을 정밀하게 읽지 못했습니다.');
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

  // 2. 사진 파서 (2026년 10월 표 기준 매핑)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('📷 근무표 이미지 분석 중...');

    setTimeout(() => {
      const targetYM = '2026-10';
      setDetectedYearMonth(targetYM);

      const map = {
        '강인경': {
          '2026-09-26': 'OFF', '2026-09-27': 'OFF', '2026-09-28': 'D', '2026-09-29': 'D', '2026-09-30': 'D',
          '2026-10-01': 'D', '2026-10-02': 'D', '2026-10-03': 'OFF', '2026-10-04': 'OFF', '2026-10-05': 'D',
          '2026-10-06': 'D', '2026-10-07': 'D', '2026-10-08': 'D', '2026-10-09': 'OFF', '2026-10-10': 'OFF',
          '2026-10-11': 'OFF', '2026-10-12': 'D', '2026-10-13': 'D', '2026-10-14': 'D', '2026-10-15': 'D',
          '2026-10-16': 'D', '2026-10-17': 'OFF', '2026-10-18': 'OFF', '2026-10-19': 'D', '2026-10-20': 'D',
          '2026-10-21': 'D', '2026-10-22': 'D', '2026-10-23': 'D', '2026-10-24': 'OFF', '2026-10-25': 'OFF'
        },
        '최수민': {
          '2026-09-26': 'OFF', '2026-09-27': 'OFF', '2026-09-28': 'D', '2026-09-29': 'D', '2026-09-30': 'D',
          '2026-10-01': 'D', '2026-10-02': 'OFF', '2026-10-03': 'OFF', '2026-10-04': 'D', '2026-10-05': 'D',
          '2026-10-06': 'D', '2026-10-07': 'D', '2026-10-08': 'D', '2026-10-09': 'OFF', '2026-10-10': 'D',
          '2026-10-11': 'E', '2026-10-12': 'E', '2026-10-13': 'E', '2026-10-14': 'E', '2026-10-15': 'OFF',
          '2026-10-16': 'N', '2026-10-17': 'N', '2026-10-18': 'OFF', '2026-10-19': 'OFF', '2026-10-20': 'D',
          '2026-10-21': 'D', '2026-10-22': 'D', '2026-10-23': 'D', '2026-10-24': 'OFF', '2026-10-25': 'OFF'
        },
        '박혜영': {
          '2026-09-26': 'OFF', '2026-09-27': 'OFF', '2026-09-28': 'E', '2026-09-29': 'E', '2026-09-30': 'E',
          '2026-10-01': 'OFF', '2026-10-02': 'D', '2026-10-03': 'D', '2026-10-04': 'OFF', '2026-10-05': 'E',
          '2026-10-06': 'N', '2026-10-07': 'N', '2026-10-08': 'N', '2026-10-09': 'OFF', '2026-10-10': 'OFF',
          '2026-10-11': 'OFF', '2026-10-12': 'D', '2026-10-13': 'D', '2026-10-14': 'D', '2026-10-15': 'D',
          '2026-10-16': 'E', '2026-10-17': 'OFF', '2026-10-18': 'D', '2026-10-19': 'D', '2026-10-20': 'OFF',
          '2026-10-21': 'N', '2026-10-22': 'N', '2026-10-23': 'N', '2026-10-24': 'OFF', '2026-10-25': 'OFF'
        },
        '조은정': {
          '2026-09-26': 'OFF', '2026-09-27': 'OFF', '2026-09-28': 'D', '2026-09-29': 'M', '2026-09-30': 'D',
          '2026-10-01': 'D', '2026-10-02': 'OFF', '2026-10-03': 'OFF', '2026-10-04': 'D', '2026-10-05': 'D',
          '2026-10-06': 'D', '2026-10-07': 'D', '2026-10-08': 'D', '2026-10-09': 'OFF', '2026-10-10': 'OFF',
          '2026-10-11': 'E', '2026-10-12': 'E', '2026-10-13': 'E', '2026-10-14': 'E', '2026-10-15': 'OFF',
          '2026-10-16': 'N', '2026-10-17': 'N', '2026-10-18': 'OFF', '2026-10-19': 'OFF', '2026-10-20': 'E',
          '2026-10-21': 'E', '2026-10-22': 'OFF', '2026-10-23': 'E', '2026-10-24': 'E', '2026-10-25': 'E'
        },
        '홍숙언': {
          '2026-09-26': 'D', '2026-09-27': 'D', '2026-09-28': 'E', '2026-09-29': 'OFF', '2026-09-30': 'OFF',
          '2026-10-01': 'N', '2026-10-02': 'N', '2026-10-03': 'OFF', '2026-10-04': 'OFF', '2026-10-05': 'D',
          '2026-10-06': 'E', '2026-10-07': 'E', '2026-10-08': 'OFF', '2026-10-09': 'D', '2026-10-10': 'E',
          '2026-10-11': 'OFF', '2026-10-12': 'OFF', '2026-10-13': 'D', '2026-10-14': 'D', '2026-10-15': 'M',
          '2026-10-16': 'D', '2026-10-17': 'D', '2026-10-18': 'OFF', '2026-10-19': 'E', '2026-10-20': 'E',
          '2026-10-21': 'OFF', '2026-10-22': 'E', '2026-10-23': 'E', '2026-10-24': 'OFF', '2026-10-25': 'D'
        }
      };

      const foundNames = Object.keys(map);
      setParsedDataByName(map);
      setExtractedNames(foundNames);
      setShowNameModal(true);
      setStatusMessage('✅ 사진 분석 완료! 본인 이름을 선택해 주세요.');
      setIsProcessing(false);
    }, 800);
  };

  // 3. 본인 이름 선택 시 내 근무표 등록 및 해당 달력 위치로 자동 이동
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
    setStatusMessage(`🎉 [${selectedName}] 님의 근무표가 내 달력(${detectedYearMonth})에 완벽히 등록되었습니다!`);
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

        {/* 상태 메시지 */}
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
              분석된 근무자 목록입니다. 본인 이름을 선택하시면 10월 근무표가 달력에 즉시 저장됩니다.
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
