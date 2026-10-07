import React, { useEffect, useRef, useState } from 'react';
import { getTodayDateObj } from '../utils/dateUtils';
import { errorText } from '../lib/errorText';
import { readSheet } from '../lib/readSheet';
import { rosterSheets } from '../lib/sheetPick';
import { toast } from '../lib/toast';
import Modal from './Modal';
import { confirmDialog } from '../lib/confirm';
import { Upload, FileSpreadsheet, Trash2, X, Camera, Smartphone, CheckCircle2, AlertTriangle, Loader2, Image as ImageIcon, Download, Archive, ChevronRight, CalendarDays, Shield, Sun, Moon, SunMoon } from 'lucide-react';
import { useShiftTypes } from '../lib/shiftTypes';
import { parseIcs } from '../lib/icsImport';
import { cellToCode } from '../lib/rosterParse';
import { toCsv, toIcs } from '../lib/exportData';
import { createBackup, parseBackup, restoreBackup } from '../lib/backup';
import { shareFile } from '../lib/shareCalendar';
import { pickRosterName } from '../lib/rosterName';
import { detectYearMonth, fixSurname, checkDayRowMonth, datesForDayRow, weekdayOf, holidayOf } from '../lib/rosterParse';
import { isChunkLoadError, reloadForUpdate, UPDATE_NOTICE } from '../lib/appUpdate';

/** 배포 전 화면에서 새 파일을 못 불러온 경우 → 새 버전으로 새로고침하고 다시 시도 안내 */
const recoverIfStale = (err) => isChunkLoadError(err) && reloadForUpdate(UPDATE_NOTICE);

// 엑셀 표의 영문 머리글·직급 (이름으로 보지 않음)
const ENGLISH_HEADER_WORDS = new Set([
  'name', 'names', 'no', 'num', 'number', 'total', 'sum', 'rank', 'grade', 'date', 'day', 'days', 'remark', 'remarks',
  'note', 'notes', 'team', 'ward', 'dept', 'department', 'off', 'rn', 'hn', 'cn', 'an', 'pn', 'uhn', 'head', 'charge',
  'staff', 'nurse', 'nurses', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'duty', 'shift', 'schedule', 'id'
]);

// 설정 화면 아이콘 칸 (아이콘 + 짧은 이름)
const tileCls = 'h-24 rounded-2xl flex flex-col items-center justify-center gap-2 px-1 text-center cursor-pointer active:bg-white hover:bg-white';
const tileLabel = 'text-[12px] font-medium text-slate-700 leading-tight';

// OCR 코드는 사진 인식을 쓸 때만 불러옴
const recognizeRosterLazy = async (...args) => (await import('../lib/rosterOcr')).recognizeRoster(...args);

export default function ImportTab({
  selectedDate,
  setSelectedDate,
  myShifts = {},
  setMyShifts,
  userName,
  rosterName = '',
  setRosterName,
  dayNotes = {},
  setDayNotes,
  onImported,
  initialNotice = '',
  repickImport = null,
  onRepickShown,
  onClearedAll,
  accountStatus,
  onOpenAccount,
  themePref = 'system',
  onCycleTheme,
  privacyBlur = false,
  onTogglePrivacy
}) {
  const shiftTypes = useShiftTypes();
  const [ocrProgress, setOcrProgress] = useState(null); // { p, msg }
  const [sheetChoice, setSheetChoice] = useState(null); // 엑셀 근무표 탭이 여러 개일 때 고를 탭 목록
  const ocrAbortRef = useRef(null); // 사진 인식 취소용 (다른 탭에 갔다 와도 인식은 계속)
  const [icsPreview, setIcsPreview] = useState(null); // { shifts, notes, eventCount, fileName }
  const [icsOverwrite, setIcsOverwrite] = useState(true);
  const [icsWithNotes, setIcsWithNotes] = useState(true);
  const [statusMessage, setStatusMessage] = useState(initialNotice);
  const [isProcessing, setIsProcessing] = useState(false);
  // 인식 결과(사진/엑셀): 본인 이름을 자동으로 못 찾았을 때만 이름 선택 창 표시
  // { source: '사진' | '엑셀', yearMonth: 'YYYY-MM', byName: { 이름: { shifts, uncertain } } }
  const [pendingImport, setPendingImport] = useState(null);
  // 가져온 뒤 '내 이름이 아니에요' → 같은 근무표의 이름 선택 창을 다시 띄움 (파일을 다시 고를 필요 없이)
  useEffect(() => {
    if (!repickImport) return;
    setPendingImport(repickImport);
    onRepickShown?.();
  }, [repickImport, onRepickShown]);

  /** 근무표에 바로 등록 → 내 근무 달력으로 이동 (App 이 되돌리기 배너 표시) */
  /** @param remember 이름 선택 창에서 직접 고른 경우 → '근무표 속 내 이름'으로 저장(서버 동기화) */
  const registerImport = (imp, name, remember = false) => {
    const data = imp.byName[name];
    if (!data) return;
    if (remember && name !== rosterName) setRosterName?.(name);
    setPendingImport(null);
    onImported?.({ imp, name, source: imp.source, yearMonth: imp.yearMonth, shifts: data.shifts, uncertain: data.uncertain });
  };

  /** 내 줄 자동 선택: 근무표 속 내 이름(설정) → 앱 이름, 사진 오타(한 글자 차이)까지. 못 찾으면 이름 선택 창 */
  const autoRegister = (imp) => {
    const { name, how } = pickRosterName(Object.keys(imp.byName), { rosterName, userName });
    // 기억한 이름이 인식 오류로 저장돼 있었으면(죄수민) 이번에 제대로 읽힌 이름(최수민)으로 바꿔 둠
    if (name && how === 'similar' && rosterName && fixSurname(rosterName) === name) setRosterName?.(name);
    if (name) registerImport(imp, name);
    else setPendingImport(imp);
  };

  // 엑셀 한 장(탭) → 근무 등록
  const importMatrix = (matrix, dateCells) => {
    try {
      // 엑셀 상단 제목에서 연/월 (2026년 10월 · 10월 · 2026.10). 없으면 보고 있던 달 → 아래에서 요일·공휴일로 확인
      const now = new Date();
      const [sYear, sMonth] = (selectedDate || '').split('-').map(Number);
      const title = detectYearMonth(matrix.slice(0, 5).map((row) => row.join(' ')).join(' '), {
        year: sYear || now.getFullYear(),
        month: sMonth || now.getMonth() + 1
      });
      let parsedYear = title.year;
      let parsedMonth = title.month;
      const foundHeaderYearMonth = title.found;

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
          // 날짜 서식 칸이면 적힌 날짜 그대로 (제목에 연월이 없어도 정확)
          const exact = numberCols.map(({ col }) => [col, dateCells[`${r}:${col}`]]).filter(([, k]) => k);
          if (exact.length >= 15) {
            exact.forEach(([col, key]) => (colToDateMap[col] = key));
            if (!foundHeaderYearMonth) {
              const ym = exact[Math.floor(exact.length / 2)][1];
              parsedYear = Number(ym.slice(0, 4));
              parsedMonth = Number(ym.slice(5, 7));
            }
            break;
          }
          // 날짜 줄 위아래의 요일(토 일 월 …)·공휴일(3 개천절 …)로 달 확인 → 제목을 못 읽었거나 틀려도 올바른 달로
          const weekdays = {};
          const holidays = {};
          numberCols.forEach(({ col }) => {
            [r - 1, r + 1, r + 2].forEach((rr) => {
              const wd = weekdayOf(matrix[rr]?.[col]);
              if (wd >= 0 && weekdays[col] === undefined) weekdays[col] = wd;
            });
            [r - 1, r, r + 1, r + 2].forEach((rr) => {
              const h = holidayOf(matrix[rr]?.[col]);
              if (h && !holidays[col]) holidays[col] = h;
            });
          });
          const checked = checkDayRowMonth({
            days: numberCols,
            weekdays,
            holidays,
            ym: { year: parsedYear, month: parsedMonth },
            found: foundHeaderYearMonth
          });
          parsedYear = checked.year;
          parsedMonth = checked.month;
          // '1' 앞쪽 날짜는 지난달 (26 27 … 31 1 2 … 25)
          datesForDayRow(numberCols, parsedYear, parsedMonth).forEach(({ col, key }) => (colToDateMap[col] = key));
          break;
        }
      }

      const targetYM = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}`;

      if (dateRowIdx === -1) {
        toast('엑셀 파일에서 날짜 행을 찾지 못했습니다.', 'error');
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
        
        // 앞쪽 6개 열(A~F열: 번호·직급·사번 다음에 이름이 있는 표까지) 순회하며 이름 정제
        for (let c = 0; c < Math.min(6, row.length); c++) {
          let val = String(row[c] || '').trim();
          if (!val) continue;

          // 1. 줄바꿈(`\n`)이 있으면 첫 줄 텍스트만 취득 (예: '남영주\n(N-keep)' -> '남영주')
          val = val.split('\n')[0].split('(')[0].trim();

          // 2. 근무 코드 매칭용 단어 제외
          const isShiftCodeOnly = /^(D|E|N|M|OFF|DD|DDEE|DE|N\/|\/)$/i.test(val);
          
          // 3. 이름: 한글 2~5자 (띄어쓴 이름 '남 궁민' 도 붙여서) 또는 영문 이름 (Kim Minji)
          const korean = val.replace(/\s+/g, '');
          const isKoreanName = /^[가-힣]{2,5}$/.test(korean) && !excludeKeywords.includes(korean);
          const isEnglishName =
            /^[A-Za-z][A-Za-z .'-]{1,29}$/.test(val) &&
            (val.match(/[A-Za-z]/g) || []).length >= 3 &&
            !ENGLISH_HEADER_WORDS.has(val.toLowerCase().replace(/[^a-z]/g, '')) &&
            !cellToCode(val, shiftTypes);

          if (!isShiftCodeOnly && (isKoreanName || isEnglishName)) {
            foundName = isKoreanName ? korean : val.replace(/\s+/g, ' ');
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
        toast('엑셀 파일에서 근무자 이름 목록을 읽지 못했습니다.', 'error');
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
      if (!recoverIfStale(err)) setStatusMessage('❌ 엑셀 분석 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. 엑셀 파서 (7명 전원 정밀 추출 및 줄바꿈/특수문자 정제)
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('⏳ 엑셀 근무표 연도/월 및 데이터 분석 중...');

    try {
      // 앱에 포함된 xlsx 를 별도 워커에서 사용 (CDN 불필요, 조작된 파일로부터 앱 화면 격리 — lib/readSheet)
      const book = await readSheet(file);
      // 탭이 여러 개인 파일: 근무표처럼 생긴 탭(날짜 1~31 줄)만. 여러 개면 어느 달인지 고르게 (엑셀에서 마지막으로 본 탭이 맨 위)
      const rosters = rosterSheets(book);
      if (rosters.length > 1) {
        setStatusMessage('');
        setSheetChoice(rosters);
        setIsProcessing(false);
        return;
      }
      const chosen = rosters[0] || book.sheets[0];
      importMatrix(chosen.matrix, chosen.dateCells);
    } catch (err) {
      console.error(err);
      if (recoverIfStale(err)) setStatusMessage('앱이 새 버전으로 업데이트되어 새로고침하는 중이에요...');
      else setStatusMessage(`❌ ${errorText(err, '엑셀 파일을 열 수 없습니다.')}`);
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
      const ctrl = new AbortController();
      ocrAbortRef.current = ctrl;
      // 취소하면 엔진이 멈추길 기다리지 않고 바로 끝냄
      const cancelled = new Promise((_, reject) =>
        ctrl.signal.addEventListener('abort', () => reject(new DOMException('사진 인식을 취소했어요.', 'AbortError')), { once: true })
      );
      const result = await Promise.race([
        recognizeRosterLazy(file, {
          year: y || now.getFullYear(),
          month: m || now.getMonth() + 1,
          shiftTypes,
          signal: ctrl.signal,
          onProgress: (p, msg) => setOcrProgress({ p, msg })
        }),
        cancelled
      ]);
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
      if (err?.name === 'AbortError') {
        setStatusMessage('사진 인식을 취소했어요. 근무는 바뀌지 않았어요.');
        return;
      }
      console.error(err);
      if (recoverIfStale(err)) setStatusMessage('앱이 새 버전으로 업데이트되어 새로고침하는 중이에요...');
      else setStatusMessage(`❌ 사진 인식 실패: ${errorText(err)}`);
    } finally {
      ocrAbortRef.current = null;
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
      setStatusMessage(`❌ ${errorText(err)}`);
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

  // 0. 전체 백업 파일 저장 / 복원
  const handleBackupSave = async () => {
    try {
      const stamp = getTodayDateObj().dateStr; // 기기 날짜 (UTC 면 한국 오전 9시 전엔 어제 날짜)
      const result = await shareFile({
        fileName: `nurse-shift-backup-${stamp}.json`,
        mimeType: 'application/json',
        data: JSON.stringify(createBackup(), null, 2),
        title: '근무표 전체 백업'
      });
      if (result !== 'cancelled') setStatusMessage('✅ 백업 파일을 저장했습니다. 카톡 나에게 보내기·드라이브 등에 보관해 두세요.');
    } catch (err) {
      setStatusMessage(`❌ 백업 실패: ${errorText(err)}`);
    }
  };

  const handleBackupRestore = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { data, summary } = parseBackup(await file.text());
      const when = summary.exportedAt ? new Date(summary.exportedAt).toLocaleString('ko-KR') : '알 수 없음';
      if (
        !(await confirmDialog({
          title: '백업을 복원할까요?',
          message:
            `${when} 백업\n근무 ${summary.shifts}일 · 메모 ${summary.notes}건 · 근무 종류 ${summary.types}개\n\n` +
            '이 기기의 근무·메모·설정을 백업 내용으로 바꾸고, 서버에도 반영해요.',
          confirmText: '복원'
        }))
      )
        return;
      restoreBackup(data);
      window.location.reload();
    } catch (err) {
      setStatusMessage(`❌ ${errorText(err)}`);
    }
  };

  // 4. 내보내기 (백업 / 다른 캘린더로 옮기기)
  const handleExport = async (kind) => {
    const hasData = Object.values(myShifts || {}).some(Boolean) || Object.values(dayNotes || {}).some(Boolean);
    if (!hasData) {
      setStatusMessage('❌ 내보낼 근무·메모가 없습니다.');
      return;
    }
    const stamp = getTodayDateObj().dateStr; // 기기 날짜 (UTC 면 한국 오전 9시 전엔 어제 날짜)
    try {
      const result = await shareFile(
        kind === 'csv'
          ? { fileName: `nurse-shift-${stamp}.csv`, mimeType: 'text/csv', data: toCsv(myShifts, dayNotes, shiftTypes), title: '근무표 (엑셀)' }
          : { fileName: `nurse-shift-${stamp}.ics`, mimeType: 'text/calendar', data: toIcs(myShifts, dayNotes), title: '근무표 (캘린더)' }
      );
      if (result !== 'cancelled') setStatusMessage(kind === 'csv' ? '✅ 엑셀(CSV) 파일로 내보냈습니다.' : '✅ 캘린더(.ics) 파일로 내보냈습니다.');
    } catch (err) {
      setStatusMessage(`❌ 내보내기 실패: ${errorText(err)}`);
    }
  };

  return (
    <div className="max-w-md mx-auto pb-10">
      {/* 상태 메시지 */}
      {statusMessage &&
        (statusMessage.startsWith('❌') ? (
          // 실패: 체크 표시 대신 경고 (성공처럼 보이지 않게)
          <div role="alert" className="mb-3 p-3 bg-rose-50 rounded-xl text-[13px] text-rose-800 flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{statusMessage.replace(/^❌\s*/, '')}</span>
          </div>
        ) : (
          <div className="mb-3 p-3 bg-blue-50 rounded-xl text-[13px] text-blue-900 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        ))}

      {/* 계정 */}
      <button type="button" onClick={onOpenAccount} className="w-full flex items-center gap-3 py-3 text-left cursor-pointer">
        <span className="relative w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-lg font-semibold shrink-0">
          {(userName || '나').substring(0, 1)}
          {accountStatus !== 'linked' && <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-white" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] font-semibold text-slate-900 truncate">{userName || '나'}</span>
          <span className={`block text-[13px] mt-0.5 ${accountStatus === 'linked' ? 'text-slate-400' : 'text-amber-600'}`}>
            {accountStatus === 'linked' ? '계정 연결됨' : '계정 연결하기 (폰 바꿀 때 필요)'}
          </span>
        </span>
        <ChevronRight size={18} className="text-slate-300 shrink-0" />
      </button>

      {/* 근무표 사진으로 등록 (가장 많이 쓰는 것) */}
      <section className="mt-2 rounded-3xl bg-blue-600 text-white p-5">
        <div className="flex items-center gap-2">
          <Camera size={22} />
          <h3 className="text-[17px] font-semibold">근무표 사진으로 등록</h3>
        </div>
        {ocrProgress ? (
          <div className="space-y-2 mt-4">
            <div className="h-2 bg-white/25 rounded-full overflow-hidden">
              <div style={{ width: `${Math.round(ocrProgress.p * 100)}%` }} className="h-full transition-all bg-white" />
            </div>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[13px] text-blue-100 flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin shrink-0" /> {ocrProgress.msg}
              </p>
              <button type="button" onClick={() => ocrAbortRef.current?.abort()} className="shrink-0 px-3 py-1.5 rounded-lg bg-white/20 text-[13px] font-medium cursor-pointer">
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <label className="flex items-center justify-center gap-1.5 h-12 bg-[#ffffff] text-[#1d4ed8] font-semibold text-[15px] rounded-xl cursor-pointer">
              <Camera size={17} /> 촬영하기
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} disabled={isProcessing} className="hidden" />
            </label>
            <label className="flex items-center justify-center gap-1.5 h-12 bg-white/20 text-white font-semibold text-[15px] rounded-xl cursor-pointer">
              <ImageIcon size={17} /> 앨범에서 선택
              <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={isProcessing} className="hidden" />
            </label>
          </div>
        )}
      </section>

      {/* 나머지 기능: 아이콘 격자 */}
      <section className="mt-3 rounded-3xl bg-slate-50 p-2 grid grid-cols-3 gap-1">
        <label className={tileCls}>
          {isProcessing ? <Loader2 size={24} className="animate-spin text-blue-600" /> : <FileSpreadsheet size={24} className="text-blue-600" />}
          <span className={tileLabel}>엑셀 근무표</span>
          <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} disabled={isProcessing} className="hidden" />
        </label>
        <label className={tileCls}>
          <Smartphone size={24} className="text-blue-600" />
          <span className={tileLabel}>캘린더 파일</span>
          <input type="file" accept=".ics,text/calendar" onChange={handleIcsUpload} disabled={isProcessing} className="hidden" />
        </label>
        <button
          type="button"
          onClick={onCycleTheme}
          aria-label={`화면 테마: ${{ system: '기기 설정', dark: '다크', light: '라이트' }[themePref]} (눌러서 변경)`}
          className={tileCls}
        >
          {themePref === 'dark' ? <Moon size={24} className="text-blue-600" /> : themePref === 'light' ? <Sun size={24} className="text-blue-600" /> : <SunMoon size={24} className="text-blue-600" />}
          <span className={tileLabel}>{{ system: '테마: 자동', dark: '테마: 다크', light: '테마: 밝게' }[themePref]}</span>
        </button>
        <button
          type="button"
          onClick={onTogglePrivacy}
          aria-label={privacyBlur ? '보안 모드 끄기 (근무 보이기)' : '보안 모드 (남에게 근무 가리기)'}
          aria-pressed={privacyBlur}
          className={`${tileCls} ${privacyBlur ? '!bg-blue-50' : ''}`}
        >
          <Shield size={24} className="text-blue-600" />
          <span className={tileLabel}>보안 모드 {privacyBlur ? 'ON' : ''}</span>
        </button>
        <button type="button" onClick={handleBackupSave} className={tileCls}>
          <Archive size={24} className="text-blue-600" />
          <span className={tileLabel}>백업 저장</span>
        </button>
        <label className={tileCls}>
          <Upload size={24} className="text-blue-600" />
          <span className={tileLabel}>백업 복원</span>
          <input type="file" accept=".json,application/json" onChange={handleBackupRestore} className="hidden" />
        </label>
        <button type="button" onClick={() => handleExport('csv')} className={tileCls}>
          <Download size={24} className="text-blue-600" />
          <span className={tileLabel}>엑셀(CSV) 내보내기</span>
        </button>
        <button type="button" onClick={() => handleExport('ics')} className={tileCls}>
          <CalendarDays size={24} className="text-blue-600" />
          <span className={tileLabel}>캘린더(.ics) 내보내기</span>
        </button>
      </section>

      <div>
        <div className="pt-6 text-center">
          {/* 근무·메모만 지움 (이 폰 + 서버). 이름·계정·그룹·근무 종류·설정은 그대로, 첫 화면으로 가지 않음 */}
          <button
            onClick={async () => {
              const count = Object.keys(myShifts || {}).length + Object.keys(dayNotes || {}).length;
              if (!count) {
                toast('지울 근무·메모가 없어요.');
                return;
              }
              if (
                await confirmDialog({
                  title: '근무·메모를 모두 지울까요?',
                  message:
                    '달력의 근무와 날짜별 메모를 이 폰과 서버에서 모두 지워요. 다른 폰에서 로그인해도 돌아오지 않아요.\n\n' +
                    '이름·계정·그룹·근무 종류·시급·연차 설정은 그대로예요.\n' +
                    "되돌리고 싶을 수 있으면 먼저 위의 '백업 저장'을 해 두세요.",
                  confirmText: '모두 지우기',
                  danger: true
                })
              ) {
                setMyShifts({});
                setDayNotes({});
                onClearedAll?.(); // 지난 가져오기 결과 알림(되돌리기)도 닫음
                toast('근무·메모를 모두 지웠어요.', 'success');
              }
            }}
            className="inline-flex items-center gap-1.5 text-[13px] text-rose-500 cursor-pointer"
          >
            <Trash2 size={14} />
            <span>근무·메모 전체 삭제</span>
          </button>
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener"
            className="block mt-3 text-[12px] text-slate-400 underline"
          >
            개인정보처리방침
          </a>
        </div>
      </div>


      {icsPreview && (
        <Modal onClose={() => setIcsPreview(null)} label="캘린더 가져오기">
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
        </Modal>
      )}

      {/* 추출된 전체 근무자 목록 선택 모달 */}
      {sheetChoice && (
        <Modal onClose={() => setSheetChoice(null)} label="엑셀 탭 선택">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-slate-900">어느 달을 가져올까요?</h3>
              <button onClick={() => setSheetChoice(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="닫기">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500">엑셀 파일에 근무표 탭이 {sheetChoice.length}개 있어요. 가져올 탭을 골라 주세요.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {sheetChoice.map((sheet) => (
                <button
                  key={sheet.index}
                  onClick={() => {
                    setSheetChoice(null);
                    setIsProcessing(true);
                    importMatrix(sheet.matrix, sheet.dateCells);
                  }}
                  className="w-full py-2.5 px-3 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-xs rounded-2xl transition cursor-pointer text-left flex items-center justify-between"
                >
                  <span>{sheet.name || `${sheet.index + 1}번째 탭`}</span>
                  {sheet.active && <span className="text-[10px] font-bold text-indigo-500">마지막으로 본 탭</span>}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {pendingImport && (
        <Modal onClose={() => setPendingImport(null)} label="본인 이름 선택">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-slate-900">본인 이름 선택</h3>
              <button onClick={() => setPendingImport(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="닫기">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {pendingImport.source} 근무표에서 {Object.keys(pendingImport.byName).length}명을 찾았어요. 본인 이름을 누르면 바로 내 근무표에 등록돼요.
            </p>
            <p className="text-[11px] font-bold text-indigo-600 bg-indigo-50 rounded-xl px-2.5 py-1.5">
              고른 이름은 기억해서 다음부터는 묻지 않고 자동으로 등록돼요.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {Object.keys(pendingImport.byName).map((name) => (
                <button
                  key={name}
                  onClick={() => registerImport(pendingImport, name, true)}
                  className="py-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
