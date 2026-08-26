import React, { useState, useEffect } from 'react';
import { 
  Calendar, Users, Eye, EyeOff, FileSpreadsheet, 
  ChevronLeft, ChevronRight, Edit3, RotateCcw, Trash2, Bell, X, Calculator, Palmtree, Settings, RefreshCw, Smartphone, Lock, Unlock, Camera, Image as ImageIcon, LogIn, UserPlus, LogOut, Loader2, UserCheck, PlusCircle, Copy, Check, Share2
} from 'lucide-react';

const getTodayDateObj = () => {
  const d = new Date();
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  };
};

export default function App() {
  const today = getTodayDateObj();

  // 인증 상태
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('nurse_is_logged_in') === 'true');
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

  const [activeTab, setActiveTab] = useState('my-shift');
  const [currentYear, setCurrentYear] = useState(today.year);
  const [currentMonth, setCurrentMonth] = useState(today.month);
  const [selectedDate, setSelectedDate] = useState(today.dateStr);

  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isParsingExcel, setIsParsingExcel] = useState(false);

  // 사용자 정보 및 근무표
  const [userName, setUserName] = useState(() => localStorage.getItem('nurse_user_name') || '간호사');
  const [myShifts, setMyShifts] = useState(() => {
    const saved = localStorage.getItem('nurse_my_shifts');
    return saved ? JSON.parse(saved) : {};
  });

  const [shiftConfigs, setShiftConfigs] = useState(() => {
    const saved = localStorage.getItem('nurse_shift_configs');
    return saved ? JSON.parse(saved) : {
      D: { name: 'Day', time: '07:30 - 15:30', nightHours: 0, color: '#FEF08A', textColor: '#854D0E' },
      E: { name: 'Evening', time: '14:30 - 22:30', nightHours: 0.5, color: '#FED7AA', textColor: '#9A3412' },
      N: { name: 'Night', time: '21:30 - 08:00', nightHours: 8, color: '#E0F2FE', textColor: '#075985' },
      M: { name: 'Mid', time: '10:00 - 18:00', nightHours: 0, color: '#E9D5FF', textColor: '#6B21A8' },
      OFF: { name: 'Off', time: '휴무', nightHours: 0, color: '#F3F4F6', textColor: '#374151' },
      연차: { name: 'Annual', time: '연차 휴가', nightHours: 0, color: '#FBCFE8', textColor: '#9D174D' }
    };
  });

  const [totalAnnualLeave, setTotalAnnualLeave] = useState(() => localStorage.getItem('nurse_total_annual') || '15');
  const [manualUsedAnnual, setManualUsedAnnual] = useState(() => {
    const saved = localStorage.getItem('nurse_manual_annual');
    return saved !== null ? saved : null;
  });

  const [calcMode, setCalcMode] = useState(() => localStorage.getItem('nurse_calc_mode') || 'fixed');
  const [nightFixedAllowance, setNightFixedAllowance] = useState(() => localStorage.getItem('nurse_night_fixed') || '50000');
  const [eveningFixedAllowance, setEveningFixedAllowance] = useState(() => localStorage.getItem('nurse_eve_fixed') || '10000');
  const [hourlyWage, setHourlyWage] = useState(() => localStorage.getItem('nurse_hourly_wage') || '13000');

  // 일정/메모
  const [memos, setMemos] = useState(() => {
    const saved = localStorage.getItem('nurse_memos');
    return saved ? JSON.parse(saved) : {};
  });

  const [memoText, setMemoText] = useState('');
  const [isPrivateMemo, setIsPrivateMemo] = useState(false);

  // 👥 그룹 공유 상태
  const [groups, setGroups] = useState(() => {
    const saved = localStorage.getItem('nurse_groups');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeGroupId, setActiveGroupId] = useState(() => localStorage.getItem('nurse_active_group_id') || '');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => { localStorage.setItem('nurse_is_logged_in', isLoggedIn); }, [isLoggedIn]);
  useEffect(() => { localStorage.setItem('nurse_user_name', userName); }, [userName]);
  useEffect(() => { localStorage.setItem('nurse_my_shifts', JSON.stringify(myShifts)); }, [myShifts]);
  useEffect(() => { localStorage.setItem('nurse_shift_configs', JSON.stringify(shiftConfigs)); }, [shiftConfigs]);
  useEffect(() => { localStorage.setItem('nurse_total_annual', totalAnnualLeave); }, [totalAnnualLeave]);
  useEffect(() => { 
    if (manualUsedAnnual !== null) localStorage.setItem('nurse_manual_annual', manualUsedAnnual);
    else localStorage.removeItem('nurse_manual_annual');
  }, [manualUsedAnnual]);
  useEffect(() => { localStorage.setItem('nurse_calc_mode', calcMode); }, [calcMode]);
  useEffect(() => { localStorage.setItem('nurse_night_fixed', nightFixedAllowance); }, [nightFixedAllowance]);
  useEffect(() => { localStorage.setItem('nurse_eve_fixed', eveningFixedAllowance); }, [eveningFixedAllowance]);
  useEffect(() => { localStorage.setItem('nurse_hourly_wage', hourlyWage); }, [hourlyWage]);
  useEffect(() => { localStorage.setItem('nurse_memos', JSON.stringify(memos)); }, [memos]);
  useEffect(() => { localStorage.setItem('nurse_groups', JSON.stringify(groups)); }, [groups]);
  useEffect(() => { localStorage.setItem('nurse_active_group_id', activeGroupId); }, [activeGroupId]);

  const [privacyBlur, setPrivacyBlur] = useState(false);

  // 그룹 데이터 자동 동기화
  useEffect(() => {
    if (!activeGroupId || groups.length === 0) return;
    setGroups(prevGroups => prevGroups.map(g => {
      if (g.id === activeGroupId) {
        const updatedMembers = g.members.map(m => {
          if (m.name === userName || m.isMe) {
            return { ...m, name: userName, shifts: myShifts, memos: memos, isMe: true };
          }
          return m;
        });
        const meExists = updatedMembers.some(m => m.isMe || m.name === userName);
        if (!meExists) {
          updatedMembers.push({ name: userName, shifts: myShifts, memos: memos, isMe: true });
        }
        return { ...g, members: updatedMembers };
      }
      return g;
    }));
  }, [myShifts, memos, userName, activeGroupId]);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      alert('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setIsLoggedIn(true);
    if (!userName || userName === '간호사') {
      setUserName(authEmail.split('@')[0]);
    }
  };

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    if (!authEmail || !authPassword || !authName) {
      alert('필수 정보를 모두 입력해주세요.');
      return;
    }
    setUserName(authName);
    setIsLoggedIn(true);
    alert('회원가입이 완료되었습니다!');
  };

  const handleSocialLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      setIsLoggedIn(false);
    }
  };

  const handleClearAllData = () => {
    if (window.confirm('모든 근무 및 일정 데이터를 초기화하시겠습니까?')) {
      localStorage.clear();
      setMyShifts({});
      setMemos({});
      setGroups([]);
      setActiveGroupId('');
      setManualUsedAnnual(null);
      setIsLoggedIn(false);
      alert('모든 데이터가 초기화되었습니다.');
    }
  };

  // 🛠 개선된 엑셀 파싱 로직
  const handleExcelFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
      alert('엑셀 라이브러리가 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsParsingExcel(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let dayToColMap = {};
        let dateHeaderIdx = -1;

        // 1. 날짜 행 찾기 (1~31 숫자가 포함된 행 탐색)
        for (let r = 0; r < Math.min(rows.length, 15); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          let tempMap = {};
          let matches = 0;

          row.forEach((cell, colIdx) => {
            if (cell === null || cell === undefined) return;
            // 셀 텍스트에서 숫자만 추출
            const strVal = String(cell).trim();
            const match = strVal.match(/\b([1-9]|[12][0-9]|3[01])\b/);
            if (match) {
              const dayNum = parseInt(match[1], 10);
              matches++;
              tempMap[dayNum] = colIdx;
            }
          });

          if (matches >= 7) { // 7일 이상 매칭되면 날짜 행으로 인정
            dateHeaderIdx = r;
            dayToColMap = tempMap;
            break;
          }
        }

        if (dateHeaderIdx === -1) {
          alert('엑셀 파일에서 1~31일 날짜 행을 찾지 못했습니다. 올바른 근무표 양식인지 확인해 주세요.');
          setIsParsingExcel(false);
          return;
        }

        // 2. 내 이름이 들어간 행 또는 데이터 행 찾기
        let targetRow = null;
        for (let r = dateHeaderIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!Array.isArray(row) || row.length === 0) continue;
          const rowStr = row.join(' ').replace(/\s+/g, '');
          if (userName && rowStr.includes(userName.replace(/\s+/g, ''))) {
            targetRow = row;
            break;
          }
        }

        // 이름이 일치하는 행을 못 찾으면 첫번째 데이터 행 사용
        if (!targetRow) {
          for (let r = dateHeaderIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (Array.isArray(row) && row.some(cell => ['D','E','N','OFF','O','주','야','휴'].includes(String(cell).trim().toUpperCase()))) {
              targetRow = row;
              break;
            }
          }
        }

        if (!targetRow) {
          alert('엑셀 시트에서 근무 데이터(D, E, N, OFF 등)가 입력된 행을 찾지 못했습니다.');
          setIsParsingExcel(false);
          return;
        }

        // 3. 근무 추출 및 반영
        const newShifts = { ...myShifts };
        let count = 0;

        Object.entries(dayToColMap).forEach(([dayNum, colIdx]) => {
          const rawVal = String(targetRow[colIdx] || '').trim().toUpperCase();
          if (!rawVal) return;

          let code = '';
          if (['D', 'DAY', '주', '낮', '데이'].includes(rawVal)) code = 'D';
          else if (['E', 'EVE', 'EVENING', '이브', '저녁'].includes(rawVal)) code = 'E';
          else if (['N', 'NIGHT', '나이트', '야', '나'].includes(rawVal)) code = 'N';
          else if (['M', 'MID', '미드'].includes(rawVal)) code = 'M';
          else if (['OFF', 'O', '휴', '휴무', '오프'].includes(rawVal)) code = 'OFF';
          else if (['연차', '연', '휴가', 'ANNUAL'].includes(rawVal)) code = '연차';

          if (code) {
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            newShifts[dateStr] = code;
            count++;
          }
        });

        setMyShifts(newShifts);
        alert(`🎉 엑셀 근무표에서 한 달 치 총 ${count}일의 근무를 정상적으로 불러왔습니다!`);
      } catch (err) {
        alert('엑셀 읽기 중 오류가 발생했습니다. 다른 엑셀 파일 형태로 시도해 보세요.');
      } finally {
        setIsParsingExcel(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 🛠 개선된 이미지 OCR 분석 로직 (전체 일수 완전 분석)
  const handleImageFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.Tesseract) {
      alert('글자 인식(OCR) 엔진이 준비 중입니다. 잠시 후 시도해 주세요.');
      return;
    }

    setIsAnalyzingImage(true);
    try {
      const { data: { text } } = await window.Tesseract.recognize(file, 'kor+eng', {
        logger: m => console.log(m)
      });

      // 전체 단어 및 기호 스캔 (제한 없이 전체 스캔)
      const rawTokens = text.replace(/[^a-zA-Z0-9가-힣\s]/g, ' ').split(/\s+/);
      const extractedCodes = [];

      rawTokens.forEach(token => {
        const t = token.toUpperCase().trim();
        if (!t) return;

        if (['D', 'DAY', '주', '낮', '데이'].includes(t)) extractedCodes.push('D');
        else if (['E', 'EVE', 'EVENING', '이브', '저녁'].includes(t)) extractedCodes.push('E');
        else if (['N', 'NIGHT', '나이트', '야'].includes(t)) extractedCodes.push('N');
        else if (['M', 'MID', '미드'].includes(t)) extractedCodes.push('M');
        else if (['OFF', 'O', '휴', '휴무', '오프'].includes(t)) extractedCodes.push('OFF');
        else if (['연차', '연', '휴가'].includes(t)) extractedCodes.push('연차');
      });

      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const newShifts = { ...myShifts };
      let count = 0;

      // 해당 월의 1일부터 말일까지 순서대로 매핑
      const limit = Math.min(extractedCodes.length, daysInMonth);
      for (let i = 0; i < limit; i++) {
        const dayNum = i + 1;
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        newShifts[dateStr] = extractedCodes[i];
        count++;
      }

      if (count > 0) {
        setMyShifts(newShifts);
        alert(`📸 사진에서 한 달 치 총 ${count}일 분량의 근무를 인식해 반영했습니다!`);
      } else {
        alert('사진에서 D, E, N, OFF 등의 근무 기호를 인식하지 못했습니다. 글자가 더 선명한 사진으로 시도해 주세요.');
      }
    } catch (err) {
      alert('사진 인식 처리 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleIcsFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        parseIcsCalendar(evt.target.result);
      } catch (err) {
        alert('캘린더 파일을 해석하지 못했습니다.');
      }
    };
    reader.readAsText(file);
  };

  const parseIcsCalendar = (icsContent) => {
    const events = icsContent.split('BEGIN:VEVENT');
    let importedCount = 0;
    const newMemos = { ...memos };

    events.slice(1).forEach((ev) => {
      const summaryMatch = ev.match(/SUMMARY:(.*)/);
      const dtstartMatch = ev.match(/DTSTART;?.*:(.*)/);

      if (summaryMatch && dtstartMatch) {
        const summary = summaryMatch[1].trim();
        const rawDt = dtstartMatch[1].trim();
        
        if (rawDt.length >= 8) {
          const yyyy = rawDt.substring(0, 4);
          const mm = rawDt.substring(4, 6);
          const dd = rawDt.substring(6, 8);
          const dateStr = `${yyyy}-${mm}-${dd}`;

          if (!newMemos[dateStr]) newMemos[dateStr] = [];

          newMemos[dateStr].push({
            id: Date.now() + Math.random(),
            type: '개인일정',
            text: `[폰 달력] ${summary}`,
            isPrivate: true,
            checked: false
          });

          importedCount++;
        }
      }
    });

    if (importedCount > 0) {
      setMemos(newMemos);
      alert(`🎉 휴대폰 캘린더에서 총 ${importedCount}개의 일정을 비공개로 가져왔습니다!`);
    } else {
      alert('가져올 일정을 찾지 못했습니다.');
    }
  };

  const currentMonthShifts = Object.entries(myShifts).filter(([date]) => 
    date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  );

  const nightShiftCount = currentMonthShifts.filter(([_, code]) => code === 'N').length;
  const eveningShiftCount = currentMonthShifts.filter(([_, code]) => code === 'E').length;
  const autoAnnualLeaveCount = Object.values(myShifts).filter(code => code === '연차').length;
  const usedAnnualLeaveCount = manualUsedAnnual !== null ? Number(manualUsedAnnual) : autoAnnualLeaveCount;
  const numTotalAnnual = Number(totalAnnualLeave) || 0;
  const remainingAnnualLeave = numTotalAnnual - usedAnnualLeaveCount;

  const numNightFixed = Number(String(nightFixedAllowance).replace(/[^0-9]/g, '')) || 0;
  const numEveFixed = Number(String(eveningFixedAllowance).replace(/[^0-9]/g, '')) || 0;
  const numHourlyWage = Number(String(hourlyWage).replace(/[^0-9]/g, '')) || 0;

  const totalNightHours = (nightShiftCount * (Number(shiftConfigs.N.nightHours) || 0)) + (eveningShiftCount * (Number(shiftConfigs.E.nightHours) || 0));

  const estimatedAllowance = calcMode === 'fixed'
    ? (nightShiftCount * numNightFixed) + (eveningShiftCount * numEveFixed)
    : Math.round(totalNightHours * numHourlyWage * 0.5);

  const handlePrevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1); } 
    else { setCurrentMonth(currentMonth - 1); }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1); } 
    else { setCurrentMonth(currentMonth + 1); }
  };

  const handleGoToToday = () => {
    setCurrentYear(today.year);
    setCurrentMonth(today.month);
    setSelectedDate(today.dateStr);
  };

  const handleShiftChange = (dateStr, newCode) => {
    setMyShifts(prev => {
      const updated = { ...prev };
      if (!newCode) delete updated[dateStr];
      else updated[dateStr] = newCode;
      return updated;
    });
  };

  const handleConfigChange = (code, key, value) => {
    setShiftConfigs(prev => ({
      ...prev,
      [code]: { ...prev[code], [key]: value }
    }));
  };

  const generateCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const days = [];

    const prevMonthLastDay = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDay = prevMonthLastDay - i;
      const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
      days.push({ dateStr: `${prevY}-${String(prevM).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`, dayNum: prevDay, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ dateStr: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`, dayNum: i, isCurrentMonth: true });
    }

    const remainingSlots = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
      days.push({ dateStr: `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`, dayNum: i, isCurrentMonth: false });
    }
    return days;
  };

  const currentSelectedShiftCode = myShifts[selectedDate] || '';

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-1">
              <Calendar size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900">간호 근무표 & 메이트</h1>
            <p className="text-xs text-slate-500">동료와 어플 내에서 함께 쓰는 3교대 근무 공유</p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button 
              onClick={() => setAuthMode('login')} 
              className={`flex-1 py-2.5 rounded-xl transition ${authMode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
            >
              로그인
            </button>
            <button 
              onClick={() => setAuthMode('signup')} 
              className={`flex-1 py-2.5 rounded-xl transition ${authMode === 'signup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
            >
              회원가입
            </button>
          </div>

          <div className="space-y-3">
            <button 
              onClick={handleSocialLogin}
              className="w-full bg-[#FEE500] hover:bg-[#fdd800] text-[#191919] font-extrabold text-xs py-3.5 rounded-2xl flex items-center justify-center gap-2 transition shadow-xs"
            >
              <span className="font-black text-sm">💬</span>
              <span>카카오 1초 간편 로그인</span>
            </button>
            <button 
              onClick={handleSocialLogin}
              className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-extrabold text-xs py-3.5 rounded-2xl flex items-center justify-center gap-2 transition shadow-xs"
            >
              <span className="font-bold text-sm">G</span>
              <span>Google 계정으로 로그인</span>
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-400 font-semibold">또는 이메일 로그인</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">이메일 주소</label>
                <input 
                  type="email" 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="nurse@hospital.com" 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">비밀번호</label>
                <input 
                  type="password" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3.5 rounded-2xl transition shadow-md flex items-center justify-center gap-1.5"
              >
                <LogIn size={16} />
                <span>로그인하기</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">이름 (선생님 성함)</label>
                <input 
                  type="text" 
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="홍길동" 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">이메일 주소</label>
                <input 
                  type="email" 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="nurse@hospital.com" 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">비밀번호</label>
                <input 
                  type="password" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="6자리 이상 입력" 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3.5 rounded-2xl transition shadow-md flex items-center justify-center gap-1.5"
              >
                <UserPlus size={16} />
                <span>회원가입 완료</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 font-sans">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            value={userName} 
            onChange={(e) => setUserName(e.target.value)}
            className="w-20 font-bold text-base leading-snug text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none bg-transparent"
            title="이름을 클릭하여 수정하세요"
          />
          <span className="text-xs text-slate-500">쌤의 근무표</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleGoToToday}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-100 transition"
          >
            <RotateCcw size={13} />
            <span>오늘</span>
          </button>
          <button 
            onClick={() => setPrivacyBlur(!privacyBlur)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            {privacyBlur ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>보안</span>
          </button>
          <button 
            onClick={handleLogout}
            className="p-1.5 bg-slate-100 rounded-xl text-slate-500 hover:text-red-600 transition"
            title="로그아웃"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {activeTab === 'my-shift' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600">
                    <ChevronLeft size={20} />
                  </button>
                  <h2 className="font-extrabold text-xl text-slate-900">{currentYear}년 {currentMonth}월</h2>
                  <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-6 gap-1 text-center text-xs">
                {Object.entries(shiftConfigs).map(([code, info]) => (
                  <div key={code} style={{ backgroundColor: info.color, color: info.textColor }} className="p-2 rounded-xl font-bold flex flex-col justify-between shadow-xs">
                    <span className="text-[11px]">{code}</span>
                    <span className="text-xs mt-0.5">
                      {currentMonthShifts.filter(([_, c]) => c === code).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-2 select-none">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 pb-2">
                <span className="text-red-500">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span className="text-blue-500">토</span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {generateCalendarDays().map(({ dateStr, dayNum, isCurrentMonth }) => {
                  const code = myShifts[dateStr] || '';
                  const info = shiftConfigs[code];
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === today.dateStr;
                  const dayMemos = memos[dateStr] || [];

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`relative aspect-square rounded-2xl p-1 flex flex-col justify-between transition-all border-2 ${
                        !isCurrentMonth ? 'opacity-20 grayscale-[50%]' : 'opacity-100'
                      } ${
                        isSelected 
                          ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100 z-10' 
                          : isToday 
                            ? 'border-amber-500 ring-2 ring-amber-100' 
                            : 'border-transparent'
                      }`}
                      style={{ backgroundColor: info ? info.color : '#FFFFFF' }}
                    >
                      <div className="flex justify-between items-center w-full px-0.5">
                        <span className="text-[10px] font-bold opacity-80" style={{ color: info ? info.textColor : '#64748B' }}>
                          {dayNum}
                        </span>
                        {dayMemos.length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                        )}
                      </div>
                      <span className="text-xs font-extrabold pb-0.5 text-center" style={{ color: info ? info.textColor : '#94A3B8' }}>
                        {code || ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Edit3 size={14} className="text-indigo-600" />
                  <span>{selectedDate} 근무 지정</span>
                </span>
                <span className="text-[11px] font-semibold text-indigo-600">
                  {currentSelectedShiftCode ? `${shiftConfigs[currentSelectedShiftCode]?.name}` : '미등록'}
                </span>
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {Object.entries(shiftConfigs).map(([typeKey, typeInfo]) => (
                  <button
                    key={typeKey}
                    onClick={() => handleShiftChange(selectedDate, typeKey)}
                    style={{ 
                      backgroundColor: currentSelectedShiftCode === typeKey ? typeInfo.color : '#FFFFFF',
                      borderColor: currentSelectedShiftCode === typeKey ? typeInfo.textColor : '#E2E8F0',
                      color: typeInfo.textColor
                    }}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition ${
                      currentSelectedShiftCode === typeKey ? 'ring-2 ring-indigo-200 font-extrabold scale-105' : ''
                    }`}
                  >
                    {typeKey}
                  </button>
                ))}
                <button
                  onClick={() => handleShiftChange(selectedDate, '')}
                  className="py-2 rounded-xl text-[11px] font-bold border bg-white border-slate-200 text-slate-400 hover:bg-slate-100 flex items-center justify-center"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="font-bold text-base flex items-center gap-2 text-slate-900">
              <FileSpreadsheet size={18} className="text-indigo-600" /> 스마트 근무표 & 캘린더 가져오기
            </h2>

            {/* 1. 엑셀 파일 업로드 */}
            <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4 rounded-2xl text-center space-y-2">
              <div className="flex justify-center text-emerald-600">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900">엑셀 근무표 파일(.xlsx, .csv) 가져오기</p>
                <p className="text-[10px] text-slate-500 mt-0.5">병원에서 받은 엑셀 근무표 파일을 올려주세요.</p>
              </div>
              <label className="inline-flex items-center gap-1.5 cursor-pointer bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-emerald-700 shadow-sm transition">
                {isParsingExcel ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>{isParsingExcel ? '엑셀 분석 중...' : '엑셀 파일 선택'}</span>
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelFileUpload} disabled={isParsingExcel} className="hidden" />
              </label>
            </div>

            {/* 2. 사진첩 / 카메라 이미지 업로드 */}
            <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 rounded-2xl text-center space-y-2">
              <div className="flex justify-center text-indigo-600">
                <Camera size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-900">근무표 사진 / 카메라 촬영 인식</p>
                <p className="text-[10px] text-slate-500 mt-0.5">종이 근무표 사진을 찍거나 갤러리 이미지를 올려주세요.</p>
              </div>
              <div className="flex justify-center gap-2 pt-1">
                <label className="cursor-pointer bg-indigo-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition flex items-center gap-1">
                  {isAnalyzingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  <span>{isAnalyzingImage ? '글자 분석 중...' : '사진첩 선택'}</span>
                  <input type="file" accept="image/*" onChange={handleImageFileUpload} disabled={isAnalyzingImage} className="hidden" />
                </label>
                <label className="cursor-pointer bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-slate-900 shadow-sm transition flex items-center gap-1">
                  {isAnalyzingImage ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  <span>{isAnalyzingImage ? '촬영 분석 중...' : '촬영하기'}</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageFileUpload} disabled={isAnalyzingImage} className="hidden" />
                </label>
              </div>
            </div>

            {/* 3. 폰 캘린더(.ics) 가져오기 */}
            <div className="border-2 border-dashed border-sky-200 bg-sky-50/50 p-4 rounded-2xl text-center space-y-2">
              <div className="flex justify-center text-sky-600">
                <Smartphone size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-sky-900">휴대폰 기본 캘린더(.ics) 가져오기</p>
                <p className="text-[10px] text-slate-500 mt-0.5">가져온 개인 일정은 기본적으로 🔒 비공개(나만 보기) 처리됩니다.</p>
              </div>
              <label className="inline-block cursor-pointer bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-sky-700 shadow-sm transition">
                폰 캘린더 파일(.ics) 선택
                <input type="file" accept=".ics" onChange={handleIcsFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 px-4 py-2 pb-7 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1 text-center">
          <button 
            onClick={() => setActiveTab('my-shift')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'my-shift' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Calendar size={18} className="mb-0.5" />
            <span>내 근무</span>
          </button>
          <button 
            onClick={() => setActiveTab('allowance')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'allowance' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Calculator size={18} className="mb-0.5" />
            <span>연차/수당</span>
          </button>
          <button 
            onClick={() => setActiveTab('friends')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'friends' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users size={18} className="mb-0.5" />
            <span>그룹 공유</span>
          </button>
          <button 
            onClick={() => setActiveTab('register')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-bold transition ${activeTab === 'register' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <FileSpreadsheet size={18} className="mb-0.5" />
            <span>등록</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
