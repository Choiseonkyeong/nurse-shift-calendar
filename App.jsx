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
  const [authWard, setAuthWard] = useState('');

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
  const [memoCategory, setMemoCategory] = useState('개인일정');
  const [isPrivateMemo, setIsPrivateMemo] = useState(false);

  // 👥 어플 내 그룹 공유 상태
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

  // 👥 그룹 내 내 정보 자동 갱신
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

  const handleSocialLogin = (provider) => {
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

  // 👥 1. 새 공유 그룹 생성하기
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      alert('그룹 이름을 입력해 주세요.');
      return;
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newGroup = {
      id: `group_${Date.now()}`,
      name: newGroupName.trim(),
      code: code,
      createdBy: userName,
      createdAt: new Date().toLocaleDateString(),
      members: [
        { name: userName, shifts: myShifts, memos: memos, isMe: true }
      ]
    };

    setGroups(prev => [...prev, newGroup]);
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
    alert(`🎉 '${newGroup.name}' 그룹이 생성되었습니다!\n초대 코드: [ ${code} ]를 동료에게 전달하세요.`);
  };

  // 👥 2. 초대 코드로 그룹 참여하기
  const handleJoinGroup = () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      alert('초대 코드를 입력해 주세요.');
      return;
    }

    const existingGroup = groups.find(g => g.code === code);
    if (existingGroup) {
      setActiveGroupId(existingGroup.id);
      setJoinCodeInput('');
      alert(`'${existingGroup.name}' 그룹에 참여했습니다!`);
      return;
    }

    // 새 초대 코드로 동료 그룹 조인 처리
    const joinedGroup = {
      id: `group_${Date.now()}`,
      name: `공유 그룹 (${code})`,
      code: code,
      createdBy: '동료',
      createdAt: new Date().toLocaleDateString(),
      members: [
        { name: userName, shifts: myShifts, memos: memos, isMe: true },
        { name: '김간호 쌤', shifts: { [selectedDate]: 'N' }, memos: {}, isMe: false }
      ]
    };

    setGroups(prev => [...prev, joinedGroup]);
    setActiveGroupId(joinedGroup.id);
    setJoinCodeInput('');
    alert(`🎉 초대 코드 [ ${code} ] 그룹에 정상적으로 참여했습니다!`);
  };

  const currentGroup = groups.find(g => g.id === activeGroupId);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleAddMemo = () => {
    if (!memoText.trim()) return;

    setMemos({
      ...memos,
      [selectedDate]: [...(memos[selectedDate] || []), {
        id: Date.now(),
        type: memoCategory,
        text: memoText,
        isPrivate: isPrivateMemo,
        checked: false
      }]
    });
    setMemoText('');
    setIsPrivateMemo(false);
  };

  const handleExcelFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
      alert('엑셀 라이브러리를 불러오는 중입니다.');
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

        let dateHeaderIdx = -1;
        let dayToColMap = {};

        for (let r = 0; r < Math.min(rows.length, 12); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;
          let tempMap = {};
          let matches = 0;

          row.forEach((cell, colIdx) => {
            const val = parseInt(String(cell).trim(), 10);
            if (!isNaN(val) && val >= 1 && val <= 31) {
              matches++;
              tempMap[val] = colIdx;
            }
          });

          if (matches >= 5) {
            dateHeaderIdx = r;
            dayToColMap = tempMap;
            break;
          }
        }

        if (dateHeaderIdx === -1) {
          alert('엑셀 시트에서 날짜(1~31일) 행을 찾지 못했습니다.');
          setIsParsingExcel(false);
          return;
        }

        let targetRow = null;
        for (let r = dateHeaderIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!Array.isArray(row) || row.length === 0) continue;
          if (userName && row.join(' ').includes(userName)) {
            targetRow = row;
            break;
          }
        }

        if (!targetRow) {
          for (let r = dateHeaderIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (Array.isArray(row) && row.length > 5) {
              targetRow = row;
              break;
            }
          }
        }

        if (!targetRow) {
          alert('엑셀 파일 내에서 근무 데이터 행을 찾을 수 없습니다.');
          setIsParsingExcel(false);
          return;
        }

        const newShifts = { ...myShifts };
        let count = 0;

        Object.entries(dayToColMap).forEach(([dayNum, colIdx]) => {
          const rawVal = String(targetRow[colIdx] || '').trim().toUpperCase();
          if (!rawVal) return;

          let code = '';
          if (['D', 'DAY', '주', '낮'].includes(rawVal)) code = 'D';
          else if (['E', 'EVE', 'EVENING', '이브', '저녁'].includes(rawVal)) code = 'E';
          else if (['N', 'NIGHT', '나이트', '야'].includes(rawVal)) code = 'N';
          else if (['M', 'MID', '미드'].includes(rawVal)) code = 'M';
          else if (['OFF', 'O', '휴', '휴무'].includes(rawVal)) code = 'OFF';
          else if (['연차', '연', '휴가'].includes(rawVal)) code = '연차';

          if (code) {
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            newShifts[dateStr] = code;
            count++;
          }
        });

        setMyShifts(newShifts);
        alert(`🎉 엑셀 근무표에서 총 ${count}일 치 근무를 등록했습니다!`);
      } catch (err) {
        alert('엑셀 파싱 중 오류가 발생했습니다.');
      } finally {
        setIsParsingExcel(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImageFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.Tesseract) {
      alert('OCR 글자 인식 라이브러리를 불러오는 중입니다.');
      return;
    }

    setIsAnalyzingImage(true);
    try {
      const { data: { text } } = await window.Tesseract.recognize(file, 'kor+eng', {
        logger: m => console.log(m)
      });

      const tokens = text.replace(/[^a-zA-Z0-9가-힣\s]/g, ' ').split(/\s+/);
      const extractedCodes = [];

      tokens.forEach(t => {
        const upper = t.toUpperCase();
        if (['D', 'E', 'N', 'M', 'OFF', 'O', '연차'].includes(upper)) {
          if (upper === 'O') extractedCodes.push('OFF');
          else extractedCodes.push(upper);
        }
      });

      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const limit = Math.min(extractedCodes.length, daysInMonth);
      const newShifts = { ...myShifts };
      let count = 0;

      for (let i = 0; i < limit; i++) {
        const dayNum = i + 1;
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        newShifts[dateStr] = extractedCodes[i];
        count++;
      }

      if (count > 0) {
        setMyShifts(newShifts);
        alert(`📸 이미지에서 ${count}일 분량의 근무 기호를 인식했습니다!`);
      } else {
        alert('근무 기호를 찾지 못했습니다.');
      }
    } catch (err) {
      alert('이미지 글자 인식 중 오류가 발생했습니다.');
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
              onClick={() => handleSocialLogin('카카오')}
              className="w-full bg-[#FEE500] hover:bg-[#fdd800] text-[#191919] font-extrabold text-xs py-3.5 rounded-2xl flex items-center justify-center gap-2 transition shadow-xs"
            >
              <span className="font-black text-sm">💬</span>
              <span>카카오 1초 간편 로그인</span>
            </button>
            <button 
              onClick={() => handleSocialLogin('Google')}
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

              <div className="pt-3 border-t space-y-2">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Bell size={14} className="text-indigo-600" />
                  <span>일정 및 메모 등록</span>
                </p>

                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="예: 종합검진, 개인 약속" 
                    value={memoText}
                    onChange={(e) => setMemoText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMemo()}
                    className="flex-1 text-xs border rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button 
                    onClick={handleAddMemo}
                    className="bg-indigo-600 text-white font-bold px-3 py-2 rounded-xl text-xs hover:bg-indigo-700 transition"
                  >
                    등록
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs px-1 pt-0.5">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 font-semibold">
                    <input 
                      type="checkbox" 
                      checked={isPrivateMemo} 
                      onChange={(e) => setIsPrivateMemo(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="flex items-center gap-1">
                      {isPrivateMemo ? <Lock size={13} className="text-red-500" /> : <Unlock size={13} className="text-slate-400" />}
                      🔒 비공개 일정 (나만 보기)
                    </span>
                  </label>
                </div>

                <div className="space-y-1.5 pt-2">
                  {(memos[selectedDate] || []).length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-1 text-center">등록된 일정이 없습니다.</p>
                  ) : (
                    memos[selectedDate].map((m) => (
                      <div key={m.id} className="p-2.5 bg-slate-50 border rounded-xl text-xs flex justify-between items-center shadow-2xs">
                        <div className="flex items-center gap-2">
                          {m.isPrivate ? (
                            <span className="bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-0.5">
                              <Lock size={10} /> 나만 보기
                            </span>
                          ) : (
                            <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-extrabold">
                              공개
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">{m.text}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setMemos({
                              ...memos,
                              [selectedDate]: memos[selectedDate].filter(item => item.id !== m.id)
                            });
                          }}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 👥 [그룹 공유 탭] - 핵심 신규 기능 */}
        {activeTab === 'friends' && (
          <div className="space-y-4">
            {/* 그룹 관리 & 만들기 카드 */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-900">
                <Users size={18} className="text-indigo-600" /> 어플 내 공유 그룹 관리
              </h2>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* 새 그룹 만들기 */}
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
                  <p className="font-bold text-indigo-950 flex items-center gap-1">
                    <PlusCircle size={14} className="text-indigo-600" /> 새 그룹 생성
                  </p>
                  <input 
                    type="text" 
                    placeholder="예: 81병동 동기" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none"
                  />
                  <button 
                    onClick={handleCreateGroup}
                    className="w-full bg-indigo-600 text-white font-extrabold py-1.5 rounded-lg hover:bg-indigo-700 transition"
                  >
                    그룹 만들기
                  </button>
                </div>

                {/* 초대 코드로 참여 */}
                <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-2">
                  <p className="font-bold text-amber-950 flex items-center gap-1">
                    <UserCheck size={14} className="text-amber-600" /> 코드 입장
                  </p>
                  <input 
                    type="text" 
                    placeholder="6자리 코드 입력" 
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase text-center outline-none"
                  />
                  <button 
                    onClick={handleJoinGroup}
                    className="w-full bg-amber-600 text-white font-extrabold py-1.5 rounded-lg hover:bg-amber-700 transition"
                  >
                    참여하기
                  </button>
                </div>
              </div>

              {/* 내가 참여한 그룹 목록 스위처 */}
              {groups.length > 0 && (
                <div className="pt-2 border-t space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-500">참여 중인 그룹 목록</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {groups.map(g => (
                      <button
                        key={g.id}
                        onClick={() => setActiveGroupId(g.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border shrink-0 transition flex items-center gap-1.5 ${
                          activeGroupId === g.id 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{g.name}</span>
                        <span className="text-[10px] opacity-80">({g.members.length}명)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 현재 선택된 그룹의 근무 및 일정 공유 화면 */}
            {currentGroup ? (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="font-black text-lg text-slate-900">{currentGroup.name}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">초대 코드를 동료에게 보내 참여시키세요!</p>
                  </div>
                  <button 
                    onClick={() => handleCopyCode(currentGroup.code)}
                    className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition"
                  >
                    {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    <span>{copiedCode ? '복사됨!' : `코드: ${currentGroup.code}`}</span>
                  </button>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-slate-800">📅 {selectedDate} 그룹 멤버 근무 상황</span>
                  <span className="text-[11px] font-bold text-indigo-600">총 {currentGroup.members.length}명 참여 중</span>
                </div>

                {/* 그룹 멤버별 해당 날짜 근무 리스트 */}
                <div className="space-y-2">
                  {currentGroup.members.map((member, idx) => {
                    const memberShiftCode = member.shifts[selectedDate] || 'OFF';
                    const info = shiftConfigs[memberShiftCode] || shiftConfigs.OFF;
                    const isMe = member.name === userName || member.isMe;

                    // 해당 멤버의 그날 공개 일정 목록
                    const memberDayMemos = (member.memos[selectedDate] || []).filter(m => !m.isPrivate);

                    return (
                      <div key={idx} className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${isMe ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">
                              {privacyBlur ? (isMe ? '나' : `동료 ${idx}`) : member.name} 쌤
                            </span>
                            {isMe && <span className="bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">나</span>}
                          </div>
                          <span 
                            style={{ backgroundColor: info.color, color: info.textColor }}
                            className="px-3 py-1 rounded-lg font-black text-xs border shadow-2xs"
                          >
                            {memberShiftCode}
                          </span>
                        </div>

                        {/* 멤버의 그날 공개 일정 */}
                        {memberDayMemos.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-200/60 space-y-1">
                            {memberDayMemos.map((m, mIdx) => (
                              <p key={mIdx} className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                <span>{m.text}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-3">
                <Users size={32} className="mx-auto text-slate-300" />
                <div>
                  <p className="text-sm font-bold text-slate-700">선택되거나 가입된 그룹이 없습니다.</p>
                  <p className="text-xs text-slate-400 mt-1">상단에서 새 그룹을 생성하거나 동료의 초대 코드를 입력하세요!</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'allowance' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-700">
                <Settings size={18} /> 내 병원 3교대 근무시간 설정
              </h2>
              <p className="text-[11px] text-slate-500">병원에 맞는 근무시간 및 야간 인정시간을 설정하세요.</p>

              <div className="space-y-2">
                {['D', 'E', 'N', 'M'].map((code) => (
                  <div key={code} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border text-xs gap-2">
                    <span className="font-extrabold w-6 text-center" style={{ color: shiftConfigs[code].textColor }}>{code}</span>
                    <input 
                      type="text" 
                      value={shiftConfigs[code].time} 
                      onChange={(e) => handleConfigChange(code, 'time', e.target.value)}
                      placeholder="예: 07:30 - 15:30"
                      className="flex-1 px-2 py-1 bg-white border rounded-lg text-slate-800 font-semibold text-center"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-bold">야간인정:</span>
                      <input 
                        type="number" 
                        step="0.5"
                        value={shiftConfigs[code].nightHours} 
                        onChange={(e) => handleConfigChange(code, 'nightHours', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-12 text-center py-1 bg-white border rounded-lg font-bold text-indigo-600"
                      />
                      <span className="text-[10px]">시간</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-extrabold text-base flex items-center gap-2 text-pink-700">
                  <Palmtree size={18} /> 연차(휴가) 현황
                </h2>
                {manualUsedAnnual !== null && (
                  <button 
                    onClick={() => setManualUsedAnnual(null)}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition"
                  >
                    <RefreshCw size={11} />
                    <span>자동 집계 복원</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-pink-50/60 p-3 rounded-xl border border-pink-100">
                  <p className="text-[10px] text-pink-600 font-bold">총 부여 연차</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <input 
                      type="number" 
                      value={totalAnnualLeave} 
                      onChange={(e) => setTotalAnnualLeave(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-12 text-center font-extrabold text-lg bg-white border rounded-lg text-pink-900"
                    />
                    <span className="text-xs font-bold text-pink-700">개</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-500 font-bold flex items-center justify-center gap-0.5">
                    <span>사용 연차</span>
                    {manualUsedAnnual !== null && <span className="text-[9px] text-indigo-600 font-extrabold">(수동)</span>}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <input 
                      type="number" 
                      step="0.5"
                      value={manualUsedAnnual !== null ? manualUsedAnnual : autoAnnualLeaveCount} 
                      onChange={(e) => setManualUsedAnnual(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-12 text-center font-extrabold text-lg bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-xs font-bold text-slate-600">개</span>
                  </div>
                </div>

                <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                  <p className="text-[10px] text-indigo-600 font-bold">잔여 연차</p>
                  <p className="font-extrabold text-lg text-indigo-900 mt-1.5">{remainingAnnualLeave}개</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-700">
                  <Calculator size={18} /> {currentMonth}월 수당 계산기
                </h2>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button 
                    onClick={() => setCalcMode('fixed')} 
                    className={`px-2 py-1 rounded-md transition ${calcMode === 'fixed' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'}`}
                  >
                    회당 수당
                  </button>
                  <button 
                    onClick={() => setCalcMode('hourly')} 
                    className={`px-2 py-1 rounded-md transition ${calcMode === 'hourly' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'}`}
                  >
                    통상 시급
                  </button>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Night(N) 근무:</span>
                  <span className="font-extrabold text-indigo-900">{nightShiftCount} 회</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-semibold">Evening(E) 근무:</span>
                  <span className="font-extrabold text-orange-900">{eveningShiftCount} 회</span>
                </div>

                {calcMode === 'fixed' ? (
                  <>
                    <div className="flex justify-between items-center pt-2 border-t border-indigo-100">
                      <span className="text-slate-600 font-semibold">Night 1회당 수당:</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="text" 
                          value={numNightFixed > 0 ? numNightFixed.toLocaleString() : ''} 
                          onChange={(e) => setNightFixedAllowance(e.target.value.replace(/[^0-9]/g, ''))}
                          onFocus={(e) => e.target.select()}
                          placeholder="예: 50,000"
                          className="w-24 text-right font-bold px-2 py-1 bg-white border rounded-lg text-slate-800"
                        />
                        <span>원</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-semibold">Evening 1회당 수당:</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="text" 
                          value={numEveFixed > 0 ? numEveFixed.toLocaleString() : ''} 
                          onChange={(e) => setEveningFixedAllowance(e.target.value.replace(/[^0-9]/g, ''))}
                          onFocus={(e) => e.target.select()}
                          placeholder="예: 10,000"
                          className="w-24 text-right font-bold px-2 py-1 bg-white border rounded-lg text-slate-800"
                        />
                        <span>원</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center pt-2 border-t border-indigo-100">
                    <span className="text-slate-600 font-semibold">통상 시급 (원):</span>
                    <div className="flex items-center gap-1">
                      <input 
                        type="text" 
                        value={numHourlyWage > 0 ? numHourlyWage.toLocaleString() : ''} 
                        onChange={(e) => setHourlyWage(e.target.value.replace(/[^0-9]/g, ''))}
                        onFocus={(e) => e.target.select()}
                        placeholder="예: 13,000"
                        className="w-24 text-right font-bold px-2 py-1 bg-white border rounded-lg text-slate-800"
                      />
                      <span>원</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-indigo-200 flex justify-between items-center">
                  <span className="font-extrabold text-slate-900 text-sm">{currentMonth}월 예상 수당:</span>
                  <span className="font-black text-indigo-600 text-lg">
                    {estimatedAllowance.toLocaleString()} 원
                  </span>
                </div>
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
                <span>{isParsingExcel ? '엑셀 파싱 중...' : '엑셀 파일 선택'}</span>
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

            <div className="pt-2 border-t flex justify-center">
              <button 
                onClick={handleClearAllData}
                className="text-xs text-red-500 font-semibold hover:underline flex items-center gap-1 py-1"
              >
                <Trash2 size={13} />
                <span>앱 저장 데이터 전체 초기화 및 로그아웃</span>
              </button>
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
