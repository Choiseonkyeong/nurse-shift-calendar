import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, FileSpreadsheet, Trash2, X, Camera, Smartphone, CheckCircle2, Loader2, Image as ImageIcon, Download } from 'lucide-react';
import { unregisterDevice } from '../lib/pushNotifications';
import { useShiftTypes } from '../lib/shiftTypes';
import { parseIcs } from '../lib/icsImport';
import { cellToCode } from '../lib/rosterParse';
import { toCsv, toIcs } from '../lib/exportData';
import { shareFile } from '../lib/shareCalendar';

const ROSTER_NAME_KEY = 'roster_name'; // 근무표 속 내 이름 (앱 이름과 다를 때 기억)

// OCR 코드는 사진 인식을 쓸 때만 불러옴
const recognizeRosterLazy = async (...args) => (await import('../lib/rosterOcr')).recognizeRoster(...args);

export default function ImportTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  userName,
  setUserName,
  dayNotes = {},
  setDayNotes,
  onImported
}) {
  const shiftTypes = useShiftTypes();
  const [ocrProgress, setOcrProgress] = useState(null); // { p, msg }
  const [icsPreview, setIcsPreview] = useState(null); // { shifts, notes, eventCount, fileName }
  const [icsOverwrite, setIcsOverwrite] = useState(true);
  const [icsWithNotes, setIcsWithNotes] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // 인식 결과(사진/엑셀): 본인 이름을 자동으로 못 찾았을 때만 이름 선택 창 표시
  // { source: '사진' | '엑셀', yearMonth: 'YYYY-MM', byName: { 이름: { shifts, uncertain } } }
  const [pendingImport, setPendingImport] = useState(null);

  /** 근무표에 바로 등록 → 내 근무 달력으로 이동 (App 이 되돌리기 배너 표시) */
  const registerImport = (imp, name) => {
    const data = imp.byName[name];
    if (!data) return;
    try {
      localStorage.setItem(ROSTER_NAME_KEY, name);
    } catch (e) {
      /* 저장 실패는 무시 */
    }
    setPendingImport(null);
    onImported?.({ name, source: imp.source, yearMonth: imp.yearMonth, shifts: data.shifts, uncertain: data.uncertain });
  };

  /** 본인 이름 자동 선택: 앱 이름 → 지난번 선택한 이름 → 한 명뿐이면 그 사람 */
  const autoRegister = (imp) => {
    const names = Object.keys(imp.byName);
    let saved = '';
    try {
      saved = localStorage.getItem(ROSTER_NAME_KEY) || '';
    } catch (e) {
      /* 무시 */
    }
    const pick =
      names.find((n) => n === userName) ||
      names.find((n) => n === saved) ||
      names.find((n) => userName && (n.includes(userName) || userName.includes(n))) ||
      (names.length === 1 ? names[0] : '');
    if (pick) registerImport(imp, pick);
    else setPendingImport(imp);
  };

  // 1. 엑셀 파서 (7명 전원 정밀 추출 및 줄바꿈/특수문자 정제)
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('⏳ 엑셀 근무표 연도/월 및 데이터 분석 중...');

    try {
      // 앱에 포함된 xlsx 사용 (CDN 불필요 → 오프라인/앱에서도 동작)
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      {
        try {
          const workbook = XLSX.read(buffer, { type: 'array' });
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
                const rawShift = String(row[c] || '').trim();

                // 표기 통일: 사용자 근무 종류 + 데이/나이트/오프/주/야/휴//, O 등 (사진 인식과 같은 규칙)
                const finalShift = cellToCode(rawShift.split('\n')[0], shiftTypes) || '';

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

          setStatusMessage('');
          autoRegister({
            source: '엑셀',
            yearMonth: targetYM,
            byName: Object.fromEntries(foundNames.map((n) => [n, { shifts: nameMap[n], uncertain: [] }]))
          });

        } catch (err) {
          console.error(err);
          setStatusMessage('❌ 엑셀 분석 오류가 발생했습니다.');
        } finally {
          setIsProcessing(false);
        }
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('❌ 엑셀 파일을 열 수 없습니다.');
      setIsProcessing(false);
    }
  };


  // 2. 근무표 사진 인식 (Tesseract.js, 기기 내 처리)
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const [y, m] = (selectedDate || '').split('-').map(Number);
    const now = new Date();
    try {
      setIsProcessing(true);
      setStatusMessage('');
      setOcrProgress({ p: 0, msg: '준비 중...' });
      const result = await recognizeRosterLazy(file, {
        year: y || now.getFullYear(),
        month: m || now.getMonth() + 1,
        shiftTypes,
        onProgress: (p, msg) => setOcrProgress({ p, msg })
      });
      if (result.error) {
        setStatusMessage(`❌ ${result.error}`);
      } else {
        // 인식 결과 → 이름별 { 근무, 확인 필요 날짜(신뢰도 낮음·못 읽음) }
        const byName = {};
        result.names.forEach((n) => {
          const cells = result.people[n] || {};
          byName[n] = {
            shifts: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, v.code])),
            uncertain: [
              ...Object.entries(cells).filter(([, v]) => v.confidence < 60).map(([k]) => k),
              ...(result.unread?.[n] || [])
            ]
          };
        });
        autoRegister({ source: '사진', yearMonth: `${result.year}-${String(result.month).padStart(2, '0')}`, byName });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(`❌ 사진 인식 실패: ${err.message}`);
    } finally {
      setOcrProgress(null);
      setIsProcessing(false);
    }
  };

  // 3. 휴대폰 캘린더(.ics) 가져오기
  const handleIcsUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('캘린더(.ics) 파일이 아닙니다.');
      const parsed = parseIcs(text, shiftTypes);
      if (!Object.keys(parsed.shifts).length && !Object.keys(parsed.notes).length) {
        throw new Error('가져올 일정이 없습니다.');
      }
      setIcsPreview({ ...parsed, fileName: file.name });
    } catch (err) {
      setStatusMessage(`❌ ${err.message}`);
    }
  };

  const handleApplyIcs = () => {
    const { shifts, notes } = icsPreview;
    setMyShifts?.((prev) => {
      const next = { ...(prev || {}) };
      Object.entries(shifts).forEach(([k, v]) => {
        if (icsOverwrite || !next[k]) next[k] = v;
      });
      return next;
    });
    if (icsWithNotes && setDayNotes) {
      setDayNotes((prev) => {
        const next = { ...(prev || {}) };
        Object.entries(notes).forEach(([k, v]) => {
          if (!next[k]) next[k] = v.slice(0, 500);
          else if (!next[k].includes(v)) next[k] = `${next[k]} / ${v}`.slice(0, 500);
        });
        return next;
      });
    }
    const first = Object.keys({ ...shifts, ...(icsWithNotes ? notes : {}) }).sort()[0];
    if (first) setSelectedDate?.(first);
    setIcsPreview(null);
    setStatusMessage(
      `🎉 캘린더에서 근무 ${Object.keys(shifts).length}일${icsWithNotes ? `, 메모 ${Object.keys(notes).length}건` : ''}을 가져왔습니다.`
    );
  };

  // 4. 내보내기 (백업 / 다른 캘린더로 옮기기)
  const handleExport = async (kind) => {
    const hasData = Object.values(myShifts || {}).some(Boolean) || Object.values(dayNotes || {}).some(Boolean);
    if (!hasData) {
      setStatusMessage('❌ 내보낼 근무·메모가 없습니다.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      const result = await shareFile(
        kind === 'csv'
          ? { fileName: `nurse-shift-${stamp}.csv`, mimeType: 'text/csv', data: toCsv(myShifts, dayNotes, shiftTypes), title: '근무표 (엑셀)' }
          : { fileName: `nurse-shift-${stamp}.ics`, mimeType: 'text/calendar', data: toIcs(myShifts, dayNotes), title: '근무표 (캘린더)' }
      );
      if (result !== 'cancelled') setStatusMessage(kind === 'csv' ? '✅ 엑셀(CSV) 파일로 내보냈습니다.' : '✅ 캘린더(.ics) 파일로 내보냈습니다.');
    } catch (err) {
      setStatusMessage(`❌ 내보내기 실패: ${err.message}`);
    }
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

        {/* 2. 근무표 사진 인식 */}
        <div style={{ backgroundColor: '#F5F3FF' }} className="p-4 rounded-3xl space-y-3">
          <div className="flex items-center gap-3">
            <div style={{ backgroundColor: '#EDE9FE', color: '#7C3AED' }} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
              <Camera size={20} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-black text-sm text-slate-800">근무표 사진 / 카메라 촬영 인식</h3>
              <p className="text-xs text-slate-500 mt-0.5">표 전체가 반듯하게 나오도록 밝은 곳에서 찍어 주세요. 사진은 기기 밖으로 전송되지 않아요.</p>
            </div>
          </div>
          {ocrProgress ? (
            <div className="space-y-1.5">
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div style={{ width: `${Math.round(ocrProgress.p * 100)}%`, backgroundColor: '#7C3AED' }} className="h-full transition-all" />
              </div>
              <p className="text-[11px] font-bold text-violet-700 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> {ocrProgress.msg}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label style={{ backgroundColor: '#7C3AED' }} className="flex items-center justify-center gap-1.5 py-2.5 text-white font-extrabold text-xs rounded-2xl cursor-pointer hover:opacity-90">
                <Camera size={14} /> 촬영하기
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} disabled={isProcessing} className="hidden" />
              </label>
              <label className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-violet-700 border border-violet-200 font-extrabold text-xs rounded-2xl cursor-pointer hover:bg-violet-50">
                <ImageIcon size={14} /> 앨범에서 선택
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={isProcessing} className="hidden" />
              </label>
            </div>
          )}
        </div>

        {/* 3. 휴대폰 캘린더(.ics) */}
        <div style={{ backgroundColor: '#F0F9FF' }} className="p-4 rounded-3xl space-y-3">
          <div className="flex items-center gap-3">
            <div style={{ backgroundColor: '#E0F2FE', color: '#0284C7' }} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
              <Smartphone size={20} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-black text-sm text-slate-800">휴대폰 캘린더(.ics) 가져오기</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                구글 캘린더: 설정 → 가져오기/내보내기 → 내보내기. 일정 제목이 D·데이·나이트·오프·연차 등이면 근무로, 나머지는 메모로 저장돼요.
              </p>
            </div>
          </div>
          <label style={{ backgroundColor: '#0284C7' }} className="flex items-center justify-center gap-1.5 py-2.5 text-white font-extrabold text-xs rounded-2xl cursor-pointer hover:opacity-90">
            <Upload size={14} /> .ics 파일 선택
            <input type="file" accept=".ics,text/calendar" onChange={handleIcsUpload} disabled={isProcessing} className="hidden" />
          </label>
        </div>

        {/* 4. 내보내기 */}
        <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
              <Download size={20} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-black text-sm text-slate-800">내 근무표 내보내기 (백업)</h3>
              <p className="text-xs text-slate-500 mt-0.5">엑셀로 보관하거나, 구글·아이폰 캘린더로 옮길 수 있어요. .ics 는 이 앱으로 다시 가져올 수 있어요.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-extrabold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
            >
              엑셀(CSV)
            </button>
            <button
              type="button"
              onClick={() => handleExport('ics')}
              className="py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-extrabold text-sky-700 hover:bg-sky-50 cursor-pointer"
            >
              캘린더(.ics)
            </button>
          </div>
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
            onClick={async () => {
              if (
                window.confirm(
                  '⚠️ 이 기기의 근무표·메모·설정을 모두 지우고 처음 상태로 돌아갑니다.\n\n' +
                    '아직 로그인 기능이 없어 초기화하면 서버에 저장된 근무와 참여 중인 그룹에도 다시 접근할 수 없습니다. (복구 불가)\n\n' +
                    '정말 초기화할까요?'
                )
              ) {
                await unregisterDevice(); // 초기화 후 이전 계정 알림이 오지 않도록 토큰 해제
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
          >
            <Trash2 size={14} />
            <span>전체 초기화 (복구 불가)</span>
          </button>
        </div>
      </div>


      {icsPreview && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full space-y-3 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-slate-900">캘린더 가져오기</h3>
              <button onClick={() => setIcsPreview(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="닫기">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs font-bold text-slate-500 break-all">{icsPreview.fileName} · 일정 {icsPreview.eventCount}개</p>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 bg-indigo-50 rounded-2xl">
                <p className="text-lg font-black text-indigo-700">{Object.keys(icsPreview.shifts).length}</p>
                <p className="text-[11px] font-bold text-indigo-500">근무일</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <p className="text-lg font-black text-slate-700">{Object.keys(icsPreview.notes).length}</p>
                <p className="text-[11px] font-bold text-slate-500">메모(일반 일정)</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={icsOverwrite} onChange={(e) => setIcsOverwrite(e.target.checked)} />
              이미 입력된 근무도 덮어쓰기
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={icsWithNotes} onChange={(e) => setIcsWithNotes(e.target.checked)} />
              일반 일정은 날짜 메모로 가져오기
            </label>
            <button
              onClick={handleApplyIcs}
              disabled={!Object.keys(icsPreview.shifts).length && !icsWithNotes}
              className="w-full py-3 rounded-2xl bg-sky-600 text-white text-sm font-black disabled:opacity-40 cursor-pointer"
            >
              가져오기
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 추출된 전체 근무자 목록 선택 모달 */}
      {pendingImport && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center border-b pb-2 border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900">본인 이름 선택</h3>
              <button onClick={() => setPendingImport(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="닫기">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {pendingImport.source} 근무표에서 {Object.keys(pendingImport.byName).length}명을 찾았어요. 본인 이름을 누르면 바로 내 근무표에 등록돼요.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {Object.keys(pendingImport.byName).map((name) => (
                <button
                  key={name}
                  onClick={() => registerImport(pendingImport, name)}
                  className="py-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 font-extrabold text-xs rounded-2xl transition cursor-pointer"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
