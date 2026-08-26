import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  Upload, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Clock, 
  FileSpreadsheet, 
  Plus, 
  PartyPopper, 
  Share2, 
  Palmtree, 
  Grid, 
  Sun, 
  Moon, 
  Sunset, 
  Copy, 
  X, 
  Smartphone, 
  Eye, 
  EyeOff, 
  Lock, 
  HeartPulse, 
  Sparkles,
  Calculator,
  Bell,
  BellRing,
  BellOff,
  Volume2,
  Check,
  ArrowLeftRight,
  StickyNote,
  Settings,
  RefreshCw
} from 'lucide-react';

// ==========================================
// 1. SOUND & CONSTANTS SETUP
// ==========================================
const playChimeSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    
    // First Tone (G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Second Tone (C6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.8);
  } catch (e) {
    console.log('Audio playback notice:', e);
  }
};

const DEFAULT_SHIFTS = {
  D: { code: 'D', name: 'Day (데이)', time: '07:30 - 15:30', bg: '#FEF08A', text: '#854D0E', border: '#FDE047', icon: Sun },
  E: { code: 'E', name: 'Evening (이브닝)', time: '14:30 - 22:30', bg: '#FED7AA', text: '#9A3412', border: '#FDBA74', icon: Sunset },
  N: { code: 'N', name: 'Night (나이트)', time: '21:30 - 08:00', bg: '#E0F2FE', text: '#075985', border: '#BAE6FD', icon: Moon },
  M: { code: 'M', name: 'Mid (미드)', time: '09:00 - 17:00', bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF', icon: Clock },
  OFF: { code: 'OFF', name: 'Off (휴무)', time: 'OFF', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB', icon: Palmtree },
  연차: { code: '연차', name: 'Annual Leave', time: 'Full Day', bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8', icon: Palmtree },
  생휴: { code: '생휴', name: 'Physiology Leave', time: 'Full Day', bg: '#FFE4E6', text: '#9F1239', border: '#FECDD3', icon: Palmtree }
};

const INITIAL_NURSES = [
  { id: 'n1', name: '최수민', role: '나 (ME)', avatarBg: '#818CF8', ward: '5병동' },
  { id: 'n2', name: '김민지', role: '3년차 동기', avatarBg: '#F472B6', ward: '5병동' },
  { id: 'n3', name: '박지현', role: '5년차 선배', avatarBg: '#34D399', ward: '5병동' },
  { id: 'n4', name: '이서연', role: '2년차 후배', avatarBg: '#FBBF24', ward: '5병동' },
  { id: 'n5', name: '정수진', role: '3년차 동기', avatarBg: '#A78BFA', ward: 'ICU' }
];

const INITIAL_GROUPS = [
  { id: 'g1', name: '5병동 전체 동료', code: 'W5ALL1', memberNames: ['최수민', '김민지', '박지현', '이서연'] },
  { id: 'g2', name: '🎉 3년차 동기 모임', code: 'SYNC03', memberNames: ['최수민', '김민지', '정수진'] }
];

const INITIAL_SHIFT_MAP = {
  '최수민_2026-08-26': 'E', '최수민_2026-08-27': 'E', '최수민_2026-08-28': 'OFF', '최수민_2026-08-29': 'OFF', '최수민_2026-08-30': 'OFF',
  '최수민_2026-08-31': 'D', '최수민_2026-09-01': 'D', '최수민_2026-09-02': 'D', '최수민_2026-09-03': 'E', '최수민_2026-09-04': 'E',
  '최수민_2026-09-05': 'OFF', '최수민_2026-09-06': 'OFF', '최수민_2026-09-07': 'D', '최수민_2026-09-08': 'D', '최수민_2026-09-09': 'N',
  '최수민_2026-09-10': 'N', '최수민_2026-09-11': 'N', '최수민_2026-09-12': 'OFF', '최수민_2026-09-13': 'D', '최수민_2026-09-14': 'D',
  '최수민_2026-09-15': 'E', '최수민_2026-09-16': 'E', '최수민_2026-09-17': 'E', '최수민_2026-09-18': 'OFF', '최수민_2026-09-19': 'OFF',
  '최수민_2026-09-20': 'D', '최수민_2026-09-21': 'D', '최수민_2026-09-22': 'D', '최수민_2026-09-23': 'D', '최수민_2026-09-24': 'N',
  '최수민_2026-09-25': 'N',

  '김민지_2026-08-26': 'D', '김민지_2026-08-27': 'D', '김민지_2026-08-28': 'E', '김민지_2026-08-29': 'E', '김민지_2026-08-30': 'OFF',
  '김민지_2026-08-31': 'OFF', '김민지_2026-09-01': 'N', '김민지_2026-09-02': 'N', '김민지_2026-09-03': 'OFF', '김민지_2026-09-04': 'OFF',
  '김민지_2026-09-05': 'OFF', '김민지_2026-09-06': 'D', '김민지_2026-09-07': 'D', '김민지_2026-09-08': 'E', '김민지_2026-09-09': 'E',
  '김민지_2026-09-10': 'OFF', '김민지_2026-09-11': 'D', '김민지_2026-09-12': 'D', '김민지_2026-09-13': 'OFF', '김민지_2026-09-14': 'N',
  '김민지_2026-09-15': 'N', '김민지_2026-09-16': 'OFF', '김민지_2026-09-17': 'OFF', '김민지_2026-09-18': 'D', '김민지_2026-09-19': 'OFF',
  '김민지_2026-09-20': 'OFF', '김민지_2026-09-21': 'E', '김민지_2026-09-22': 'E', '김민지_2026-09-23': 'OFF', '김민지_2026-09-24': 'OFF',
  '김민지_2026-09-25': 'D'
};

const MEMO_CATEGORIES = {
  handover: { label: '🏥 인수인계', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200 font-bold' },
  important: { label: '📢 중요/공지', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200 font-bold' },
  todo: { label: '✅ 근무 할일', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200 font-bold' },
  personal: { label: '☕ 개인일정', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200 font-bold' }
};

const formatDateKey = (year, monthIndex, day) => {
  const y = year;
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const sanitizeText = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, (match) => {
    const escape = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' };
    return escape[match];
  }).trim().slice(0, 100);
};

const generateChecksum = (dataStr) => {
  let hash = 0;
  for (let i = 0; i < dataStr.length; i++) {
    const char = dataStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

// ==========================================
// 2. INTERNAL SUB-COMPONENTS
// ==========================================

function HeaderBar({
  notificationPermission,
  setIsNotificationModalOpen,
  isPrivacyMode,
  setIsPrivacyMode,
  setIsPwaModalOpen
}) {
  return (
    <header className="bg-white px-4 py-3 border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-200">
          N
        </div>
        <div>
          <h1 className="text-xs font-black text-slate-900 leading-none">간호 근무표 & 메이트</h1>
          <span className="text-[9px] font-bold text-slate-400">3교대 수당/연차/그룹 매칭 센터</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsNotificationModalOpen(true)}
          className={`p-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all ${
            notificationPermission === 'granted' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
          title="알림 설정"
        >
          {notificationPermission === 'granted' ? <BellRing className="w-3.5 h-3.5 text-emerald-600 animate-bounce" /> : <BellOff className="w-3.5 h-3.5" />}
          <span>{notificationPermission === 'granted' ? '알림 ON' : '알림 설정'}</span>
        </button>

        <button
          onClick={() => setIsPrivacyMode(!isPrivacyMode)}
          className={`p-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all ${
            isPrivacyMode ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          {isPrivacyMode ? <EyeOff className="w-3.5 h-3.5 text-rose-600" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{isPrivacyMode ? '블러 온' : '보안'}</span>
        </button>

        <button
          onClick={() => setIsPwaModalOpen(true)}
          className="p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold flex items-center gap-1"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>앱 설치</span>
        </button>
      </div>
    </header>
  );
}

function AllowanceSection({
  totalAnnualLeave,
  setTotalAnnualLeave,
  manualUsedAnnual,
  setManualUsedAnnual,
  autoAnnualLeaveCount,
  remainingAnnualLeave,
  currentMonthStats,
  calcMode,
  setCalcMode,
  nightAllowanceRate,
  setNightAllowanceRate,
  eveningAllowanceRate,
  setEveningAllowanceRate,
  hourlyWage,
  setHourlyWage,
  totalExtraAllowance,
  setIsAllowanceModalOpen
}) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
      <div className="flex justify-between items-center border-b pb-2.5 border-slate-100">
        <h2 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
          <Calculator className="w-4 h-4 text-emerald-600" />
          연차 현황 & 월간 수당 계산기
        </h2>
        <button 
          onClick={() => setIsAllowanceModalOpen(true)}
          className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1"
        >
          <Settings className="w-3 h-3" />
          단가 상세 설정
        </button>
      </div>

      {/* Annual Leave Dashboard */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-extrabold text-pink-700 flex items-center gap-1">
            <Palmtree className="w-3.5 h-3.5" /> 연차 관리
          </span>
          {manualUsedAnnual !== null && (
            <button 
              onClick={() => setManualUsedAnnual(null)}
              className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-0.5"
            >
              <RefreshCw className="w-3 h-3" /> 자동 집계 복원
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-pink-50/70 p-2.5 rounded-xl border border-pink-100">
            <span className="text-[10px] text-pink-600 font-bold block">총 부여 연차</span>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <input 
                type="number" 
                value={totalAnnualLeave} 
                onChange={(e) => setTotalAnnualLeave(e.target.value)}
                className="w-12 text-center font-extrabold text-sm bg-white border border-pink-200 rounded-lg"
              />
              <span className="font-bold text-pink-800">개</span>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold block">
              사용 연차 {manualUsedAnnual !== null && <span className="text-indigo-600">(수동)</span>}
            </span>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <input 
                type="number" 
                step="0.5"
                value={manualUsedAnnual !== null ? manualUsedAnnual : autoAnnualLeaveCount} 
                onChange={(e) => setManualUsedAnnual(e.target.value)}
                className="w-12 text-center font-extrabold text-sm bg-white border border-slate-300 rounded-lg"
              />
              <span className="font-bold text-slate-700">개</span>
            </div>
          </div>

          <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 flex flex-col justify-center">
            <span className="text-[10px] text-indigo-600 font-bold block">잔여 연차</span>
            <span className="font-black text-base text-indigo-900">{remainingAnnualLeave} 개</span>
          </div>
        </div>
      </div>

      {/* Allowance Breakdown */}
      <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-black text-emerald-900">당월 수당 계산 내역</span>
          <div className="flex bg-white/80 p-0.5 rounded-lg border border-emerald-200 text-[10px] font-bold">
            <button 
              onClick={() => setCalcMode('fixed')}
              className={`px-2 py-0.5 rounded-md ${calcMode === 'fixed' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
            >
              회당 정액
            </button>
            <button 
              onClick={() => setCalcMode('hourly')}
              className={`px-2 py-0.5 rounded-md ${calcMode === 'hourly' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
            >
              통상 시급
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <span className="text-[10px] text-slate-500 font-bold block">Night (나이트)</span>
            <span className="font-black text-emerald-900">{currentMonthStats['N'] || 0} 회</span>
            <span className="text-[9px] text-slate-400 block font-mono">(@{nightAllowanceRate.toLocaleString()}원)</span>
          </div>

          <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
            <span className="text-[10px] text-slate-500 font-bold block">Evening (이브닝)</span>
            <span className="font-black text-emerald-900">{currentMonthStats['E'] || 0} 회</span>
            <span className="text-[9px] text-slate-400 block font-mono">(@{eveningAllowanceRate.toLocaleString()}원)</span>
          </div>
        </div>

        <div className="pt-2 border-t border-emerald-200/80 flex justify-between items-center">
          <span className="text-xs font-black text-emerald-950">예상 추가 수당 총액:</span>
          <span className="text-sm font-black text-emerald-700 bg-white px-2.5 py-1 rounded-xl border border-emerald-300">
            약 {totalExtraAllowance.toLocaleString()} 원
          </span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. MAIN APP CONTAINER
// ==========================================
export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1));
  const [selectedDateStr, setSelectedDateStr] = useState('2026-09-09'); 
  const [cycleStartDay] = useState(26); 
  const [activeMainTab, setActiveMainTab] = useState('myCalendar'); 
  
  // User Profile & Group State
  const [myNurseName] = useState('최수민');
  const [selectedNurseName, setSelectedNurseName] = useState('최수민');
  const [nursesList, setNursesList] = useState(INITIAL_NURSES);
  const [groupsList, setGroupsList] = useState(INITIAL_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState('g1');

  // Sub-Views
  const [rosterViewMode, setRosterViewMode] = useState('daily');
  const [offFilterMode, setOffFilterMode] = useState('all');

  // Allowance & Annual Leave States
  const [totalAnnualLeave, setTotalAnnualLeave] = useState(15);
  const [manualUsedAnnual, setManualUsedAnnual] = useState(null);
  const [nightAllowanceRate, setNightAllowanceRate] = useState(25000); 
  const [eveningAllowanceRate, setEveningAllowanceRate] = useState(5000); 
  const [hourlyWage, setHourlyWage] = useState(13000);
  const [calcMode, setCalcMode] = useState('fixed');
  const [isAllowanceModalOpen, setIsAllowanceModalOpen] = useState(false);

  // Multi-Memo System
  const [shiftMemos, setShiftMemos] = useState({
    '2026-09-09': [
      { id: 'm1', text: '502호 중증 환자 수혈 및 V/S 체크 예정', category: 'handover', completed: false, time: '14:00', alarmOffset: '30' },
      { id: 'm2', text: '16시 병동 수당/인수인계 컨퍼런스 참석', category: 'important', completed: true, time: '16:00', alarmOffset: 'none' },
      { id: 'm3', text: '퇴근 후 민지 쌤이랑 저녁 약속', category: 'personal', completed: false, time: '18:30', alarmOffset: '10' }
    ],
    '2026-09-12': [
      { id: 'm4', text: '보수교육 이수증 수간호사님께 제출', category: 'todo', completed: false, time: '', alarmOffset: 'none' }
    ]
  });

  // Memo Input States
  const [newMemoText, setNewMemoText] = useState('');
  const [newMemoCategory, setNewMemoCategory] = useState('handover'); 
  const [newMemoTime, setNewMemoTime] = useState('');
  const [newMemoAlarmOffset, setNewMemoAlarmOffset] = useState('none');
  const [isAllMemosModalOpen, setIsAllMemosModalOpen] = useState(false);
  const [memoFilterTab, setMemoFilterTab] = useState('all');

  // Real-time Notification State
  const [notificationPermission, setNotificationPermission] = useState(() => 
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [triggeredAlarms, setTriggeredAlarms] = useState(new Set());
  const [activeAlarmToast, setActiveAlarmToast] = useState(null);

  // Shift Swap Simulator
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapPartner, setSwapPartner] = useState('김민지');
  const [swapTargetDate, setSwapTargetDate] = useState('2026-09-09');

  // Group Management Modals
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [joinGroupCodeInput, setJoinGroupCodeInput] = useState('');

  // Modals & Security States
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [generatedShareCode, setGeneratedShareCode] = useState('');
  const [inputShareCode, setInputShareCode] = useState('');
  const [maskNameInShare, setMaskNameInShare] = useState(true);
  
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [inputSharePassword, setInputSharePassword] = useState('');
  const [appPinCode, setAppPinCode] = useState(() => localStorage.getItem('nurse_app_pin') || '');
  const [isAppLocked, setIsAppLocked] = useState(() => !!localStorage.getItem('nurse_app_pin'));
  const [pinInput, setPinInput] = useState('');

  const [copiedNotification, setCopiedNotification] = useState(false);

  // Shift & Data Imports
  const [shiftMap, setShiftMap] = useState(INITIAL_SHIFT_MAP);
  const [shiftRules] = useState(DEFAULT_SHIFTS);
  const [pastedText, setPastedText] = useState('');
  const [statusMessage, setStatusMessage] = useState({
    type: 'success',
    text: '스마트 간호 스케줄러 & 수당 매칭 센터가 작동 중입니다.'
  });

  const fileInputRef = useRef(null);

  const getDisplayName = (name) => {
    if (!isPrivacyMode) return name;
    if (name.length <= 1) return '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      setStatusMessage({ type: 'error', text: '이 브라우저는 알림 기능을 지원하지 않습니다.' });
      return;
    }
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      playChimeSound();
      setStatusMessage({ type: 'success', text: '🔔 브라우저 푸시 및 사운드 알림이 활성화되었습니다!' });
    } else {
      setStatusMessage({ type: 'error', text: '알림 권한이 거부되었습니다. 브라우저 설정을 확인해주세요.' });
    }
  };

  const triggerTestNotification = () => {
    playChimeSound();
    setActiveAlarmToast({
      title: '🏥 알림 테스트 완료',
      text: '지정한 시각에 이렇게 링톤 소리와 함께 알림이 울립니다!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('🏥 간호 알림 테스트', {
        body: '근무 메모 및 인수인계 알림 기능이 정상 가동 중입니다!',
        icon: '/favicon.ico'
      });
    }
  };

  // Background Alarm Checker Interval
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentYMD = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      Object.entries(shiftMemos).forEach(([dateKey, memoList]) => {
        if (dateKey !== currentYMD) return;

        memoList.forEach(memo => {
          if (!memo.time || memo.completed || memo.alarmOffset === 'none') return;
          if (triggeredAlarms.has(memo.id)) return;

          const [h, m] = memo.time.split(':').map(Number);
          if (isNaN(h) || isNaN(m)) return;

          const memoTotalMin = h * 60 + m;
          const offsetMin = Number(memo.alarmOffset) || 0;
          const targetMin = memoTotalMin - offsetMin;

          if (currentMinutes >= targetMin && currentMinutes <= targetMin + 1) {
            setTriggeredAlarms(prev => new Set(prev).add(memo.id));
            playChimeSound();

            const alertTitle = `🔔 근무 메모 알림 (${memo.alarmOffset === '0' ? '정각' : memo.alarmOffset + '분 전'})`;
            const alertBody = `${memo.time} - ${memo.text}`;

            setActiveAlarmToast({
              title: alertTitle,
              text: alertBody,
              time: memo.time
            });

            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(alertTitle, { body: alertBody });
            }
          }
        });
      });
    }, 10000);

    return () => clearInterval(timer);
  }, [shiftMemos, triggeredAlarms]);

  // 26th - 25th Shift Cycle Generator
  const generateCycleDays = () => {
    const targetYear = currentDate.getFullYear();
    const targetMonth = currentDate.getMonth();

    let prevMonth = targetMonth - 1;
    let prevYear = targetYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear -= 1;
    }

    const days = [];
    const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();

    for (let d = cycleStartDay; d <= prevMonthLastDay; d++) {
      days.push(new Date(prevYear, prevMonth, d));
    }
    for (let d = 1; d < cycleStartDay; d++) {
      days.push(new Date(targetYear, targetMonth, d));
    }

    return days;
  };

  const cycleDays = generateCycleDays();

  // Health Pattern Analyzer
  const analyzeHealthPatterns = () => {
    const warnings = [];
    let consecutiveNights = 0;

    for (let i = 0; i < cycleDays.length; i++) {
      const dObj = cycleDays[i];
      const dateKey = formatDateKey(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
      const code = shiftMap[`${selectedNurseName}_${dateKey}`];

      if (code === 'N') {
        consecutiveNights++;
        if (consecutiveNights === 3) {
          warnings.push({
            type: 'danger',
            title: '⚠️ 3연속 나이트(3N) 경고',
            desc: `${dateKey} 기준 연속 3번째 나이트 근무입니다. 누적 피로에 유의하세요!`,
            date: dateKey
          });
        }
      } else {
        consecutiveNights = 0;
      }

      if (i > 0) {
        const prevObj = cycleDays[i - 1];
        const prevKey = formatDateKey(prevObj.getFullYear(), prevObj.getMonth(), prevObj.getDate());
        const prevCode = shiftMap[`${selectedNurseName}_${prevKey}`];

        if (prevCode === 'E' && code === 'D') {
          warnings.push({
            type: 'warning',
            title: '⚡ 꺾임 근무 (이브닝 ➔ 데이)',
            desc: `${prevKey} E근무 후 ${dateKey} D근무로 휴식 시간이 부족합니다.`,
            date: dateKey
          });
        }

        if (prevCode === 'N' && code === 'D') {
          warnings.push({
            type: 'danger',
            title: '🚫 나이트 후 직행 데이 (N ➔ D)',
            desc: `${prevKey} N근무 후 바로 D근무가 배치되었습니다!`,
            date: dateKey
          });
        }
      }
    }

    return warnings;
  };

  const healthWarnings = analyzeHealthPatterns();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const currentMonthStats = Object.keys(shiftRules).reduce((acc, code) => {
    acc[code] = 0;
    return acc;
  }, {});

  cycleDays.forEach(dObj => {
    const dateKey = formatDateKey(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
    const code = shiftMap[`${selectedNurseName}_${dateKey}`];
    if (code && currentMonthStats[code] !== undefined) {
      currentMonthStats[code]++;
    }
  });

  const autoAnnualLeaveCount = currentMonthStats['연차'] || 0;
  const usedAnnualLeaveCount = manualUsedAnnual !== null ? Number(manualUsedAnnual) : autoAnnualLeaveCount;
  const remainingAnnualLeave = (Number(totalAnnualLeave) || 0) - usedAnnualLeaveCount;

  const estimatedNightAllowance = (currentMonthStats['N'] || 0) * nightAllowanceRate;
  const estimatedEveningAllowance = (currentMonthStats['E'] || 0) * eveningAllowanceRate;
  const totalExtraAllowance = calcMode === 'fixed' 
    ? estimatedNightAllowance + estimatedEveningAllowance
    : Math.round(((currentMonthStats['N'] || 0) * 8 + (currentMonthStats['E'] || 0) * 0.5) * hourlyWage * 0.5);

  const handleGenerateShareCode = () => {
    const displayName = maskNameInShare && selectedNurseName.length >= 2 
      ? selectedNurseName[0] + '*'.repeat(selectedNurseName.length - 2) + selectedNurseName[selectedNurseName.length - 1]
      : selectedNurseName;

    const nurseShifts = {};
    Object.keys(shiftMap).forEach(key => {
      if (key.startsWith(`${selectedNurseName}_`)) {
        const datePart = key.replace(`${selectedNurseName}_`, '');
        nurseShifts[datePart] = shiftMap[key];
      }
    });

    const payloadObj = {
      name: sanitizeText(displayName),
      ward: '5병동',
      shifts: nurseShifts,
      ts: Date.now(),
      hasPass: !!sharePassword
    };

    try {
      let jsonStr = JSON.stringify(payloadObj);
      const checksum = generateChecksum(jsonStr);
      payloadObj.sig = checksum;
      jsonStr = JSON.stringify(payloadObj);

      if (sharePassword) {
        let encrypted = '';
        for (let i = 0; i < jsonStr.length; i++) {
          encrypted += String.fromCharCode(jsonStr.charCodeAt(i) ^ sharePassword.charCodeAt(i % sharePassword.length));
        }
        jsonStr = JSON.stringify({ enc: btoa(unescape(encodeURIComponent(encrypted))), isEncrypted: true });
      }

      const code = btoa(unescape(encodeURIComponent(jsonStr)));
      setGeneratedShareCode(code);
      setIsShareModalOpen(true);
    } catch (e) {
      setStatusMessage({ type: 'error', text: '공유 코드 생성 중 오류가 발생했습니다.' });
    }
  };

  const handleImportShareCode = () => {
    const trimmedCode = inputShareCode.trim();
    if (!trimmedCode) return;

    try {
      let decodedJson = decodeURIComponent(escape(atob(trimmedCode)));
      let parsedData = JSON.parse(decodedJson);

      if (parsedData.isEncrypted) {
        if (!inputSharePassword) {
          setStatusMessage({ type: 'error', text: '비밀번호로 보호된 코드입니다. 비밀번호를 입력해주세요.' });
          return;
        }
        const encryptedStr = decodeURIComponent(escape(atob(parsedData.enc)));
        let decryptedStr = '';
        for (let i = 0; i < encryptedStr.length; i++) {
          decryptedStr += String.fromCharCode(encryptedStr.charCodeAt(i) ^ inputSharePassword.charCodeAt(i % inputSharePassword.length));
        }
        parsedData = JSON.parse(decryptedStr);
      }

      const friendName = sanitizeText(String(parsedData.name)).slice(0, 10);
      const newShiftMap = { ...shiftMap };

      Object.entries(parsedData.shifts).forEach(([dateKey, code]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof code === 'string') {
          newShiftMap[`${friendName}_${dateKey}`] = sanitizeText(code).slice(0, 10);
        }
      });

      setShiftMap(newShiftMap);
      setNursesList(prev => {
        if (prev.some(n => n.name === friendName)) return prev;
        return [...prev, {
          id: `friend_${Date.now()}`,
          name: friendName,
          role: '카톡 동료',
          avatarBg: '#EC4899',
          ward: '5병동'
        }];
      });

      setStatusMessage({ type: 'success', text: `🔐 '${friendName}' 선생님 근무표가 동기화되었습니다!` });
      setInputShareCode('');
      setInputSharePassword('');
    } catch (e) {
      setStatusMessage({ type: 'error', text: '올바르지 않거나 손상된 코드입니다. 비밀번호를 확인하세요.' });
    }
  };

  const handleCreateGroupSubmit = () => {
    if (!newGroupNameInput.trim()) return;
    const newCode = 'GRP' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const newGroupObj = {
      id: `group_${Date.now()}`,
      name: sanitizeText(newGroupNameInput),
      code: newCode,
      memberNames: [myNurseName, '김민지']
    };
    setGroupsList(prev => [...prev, newGroupObj]);
    setSelectedGroupId(newGroupObj.id);
    setNewGroupNameInput('');
    setIsAddGroupOpen(false);
    setStatusMessage({ type: 'success', text: `🎉 '${newGroupObj.name}' 그룹이 생성되었습니다. (초대 코드: ${newCode})` });
  };

  const handleJoinGroupSubmit = () => {
    if (!joinGroupCodeInput.trim()) return;
    const foundGroup = groupsList.find(g => g.code === joinGroupCodeInput.trim().toUpperCase());
    if (foundGroup) {
      setSelectedGroupId(foundGroup.id);
      setStatusMessage({ type: 'success', text: `🎉 '${foundGroup.name}' 그룹에 참여했습니다!` });
    } else {
      const tempGroup = {
        id: `group_${Date.now()}`,
        name: `초대 그룹 (${joinGroupCodeInput.toUpperCase()})`,
        code: joinGroupCodeInput.toUpperCase(),
        memberNames: [myNurseName, '김민지', '박지현']
      };
      setGroupsList(prev => [...prev, tempGroup]);
      setSelectedGroupId(tempGroup.id);
      setStatusMessage({ type: 'success', text: `🎉 초대 코드 [${joinGroupCodeInput.toUpperCase()}] 그룹에 참여했습니다!` });
    }
    setJoinGroupCodeInput('');
    setIsAddGroupOpen(false);
  };

  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;

    try {
      const lines = pastedText.trim().split('\n').map(l => l.split('\t'));
      if (lines.length === 0) return;

      const dateLine = lines[0];
      const codeLine = lines.length > 1 ? lines[1] : lines[0];

      const newShifts = { ...shiftMap };

      codeLine.forEach((rawCode, idx) => {
        const code = rawCode.trim().toUpperCase();
        if (!code) return;

        let dayNum = parseInt(dateLine[idx], 10);
        if (isNaN(dayNum)) dayNum = idx + 26;

        let targetY = year;
        let targetM = month;
        if (dayNum >= 26) {
          targetM = month - 1;
          if (targetM < 0) {
            targetM = 11;
            targetY -= 1;
          }
        }

        const dateKey = formatDateKey(targetY, targetM, dayNum);
        newShifts[`${selectedNurseName}_${dateKey}`] = code;
      });

      setShiftMap(newShifts);
      setPastedText('');
      setStatusMessage({ type: 'success', text: '📋 복사한 엑셀 근무표가 캘린더에 일괄 적용되었습니다!' });
    } catch (e) {
      setStatusMessage({ type: 'error', text: '텍스트 파싱 중 오류가 발생했습니다. 양식을 확인하세요.' });
    }
  };

  const handleAddMemo = (
    textToAdd = newMemoText, 
    categoryToAdd = newMemoCategory, 
    timeToAdd = newMemoTime,
    alarmToAdd = newMemoAlarmOffset
  ) => {
    if (!textToAdd.trim()) return;

    const newItem = {
      id: `memo_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: sanitizeText(textToAdd),
      category: categoryToAdd,
      completed: false,
      time: timeToAdd,
      alarmOffset: alarmToAdd
    };

    setShiftMemos(prev => ({
      ...prev,
      [selectedDateStr]: [...(prev[selectedDateStr] || []), newItem]
    }));

    setNewMemoText('');
    setNewMemoTime('');
    setNewMemoAlarmOffset('none');
    setStatusMessage({ type: 'success', text: '📝 메모 및 알림이 저장되었습니다.' });
  };

  const handleToggleMemoComplete = (dateKey, memoId) => {
    setShiftMemos(prev => {
      const currentList = prev[dateKey] || [];
      const updated = currentList.map(item => 
        item.id === memoId ? { ...item, completed: !item.completed } : item
      );
      return { ...prev, [dateKey]: updated };
    });
  };

  const handleDeleteMemo = (dateKey, memoId) => {
    setShiftMemos(prev => {
      const currentList = prev[dateKey] || [];
      const updated = currentList.filter(item => item.id !== memoId);
      return { ...prev, [dateKey]: updated };
    });
  };

  const handleExecuteShiftSwap = () => {
    const myCurrent = shiftMap[`${myNurseName}_${swapTargetDate}`] || 'OFF';
    const partnerCurrent = shiftMap[`${swapPartner}_${swapTargetDate}`] || 'OFF';

    setShiftMap(prev => ({
      ...prev,
      [`${myNurseName}_${swapTargetDate}`]: partnerCurrent,
      [`${swapPartner}_${swapTargetDate}`]: myCurrent
    }));

    setIsSwapModalOpen(false);
    setStatusMessage({
      type: 'success',
      text: `🔄 ${swapTargetDate} ${swapPartner} 선생님과 근무 교대(${myCurrent} ⇄ ${partnerCurrent})가 완료되었습니다.`
    });
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const currentGroup = groupsList.find(g => g.id === selectedGroupId) || groupsList[0];

  const matchedOffDays = cycleDays.map(dObj => {
    const dateKey = formatDateKey(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
    const offMembers = currentGroup.memberNames.filter(mName => {
      const code = shiftMap[`${mName}_${dateKey}`];
      return code === 'OFF' || code === '연차' || code === '생휴';
    });

    return {
      dateKey,
      dateObj: dObj,
      offMembers,
      isFullMatch: offMembers.length === currentGroup.memberNames.length
    };
  }).filter(item => item.offMembers.length >= 2);

  const selectedDayDutyMap = { D: [], E: [], N: [], M: [], OFF: [] };
  nursesList.forEach(n => {
    const code = shiftMap[`${n.name}_${selectedDateStr}`] || 'OFF';
    if (selectedDayDutyMap[code]) {
      selectedDayDutyMap[code].push(n.name);
    } else {
      if (!selectedDayDutyMap.OFF) selectedDayDutyMap.OFF = [];
      selectedDayDutyMap.OFF.push(n.name);
    }
  });

  if (isAppLocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="bg-slate-800 p-6 rounded-3xl max-w-xs w-full shadow-2xl border border-slate-700 text-center space-y-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black">간호 근무표 잠금</h2>
            <p className="text-xs text-slate-400 mt-1">4자리 비밀번호를 입력해주세요</p>
          </div>
          <input
            type="password"
            maxLength={4}
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              if (e.target.value === appPinCode) {
                setIsAppLocked(false);
                setPinInput('');
              }
            }}
            placeholder="••••"
            className="w-full text-center text-2xl font-mono tracking-widest p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => {
              if (pinInput === appPinCode) {
                setIsAppLocked(false);
                setPinInput('');
              } else {
                alert('비밀번호가 일치하지 않습니다.');
              }
            }}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition-all"
          >
            잠금 해제
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col max-w-md mx-auto shadow-2xl relative font-sans">
      <HeaderBar
        notificationPermission={notificationPermission}
        setIsNotificationModalOpen={setIsNotificationModalOpen}
        isPrivacyMode={isPrivacyMode}
        setIsPrivacyMode={setIsPrivacyMode}
        setIsPwaModalOpen={setIsPwaModalOpen}
      />

      {/* Active Alarm Toast Popover */}
      {activeAlarmToast && (
        <div className="mx-3.5 mt-2 p-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl shadow-xl flex items-center justify-between border border-indigo-400">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl">
              <BellRing className="w-5 h-5 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold text-indigo-200 block">{activeAlarmToast.title} [{activeAlarmToast.time}]</span>
              <span className="text-xs font-black">{activeAlarmToast.text}</span>
            </div>
          </div>
          <button 
            onClick={() => setActiveAlarmToast(null)}
            className="p-1 bg-white/20 hover:bg-white/30 rounded-lg text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-3.5 space-y-3.5 pb-24 overflow-y-auto">
        {statusMessage.text && (
          <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
            statusMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}>
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage({ type: 'success', text: '' })} className="opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Health Pattern Warnings Banner */}
        {healthWarnings.length > 0 && (
          <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-xs">
              <HeartPulse className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>건강 및 피로도 관리 알림 ({healthWarnings.length}건)</span>
            </div>
            <div className="space-y-1">
              {healthWarnings.map((w, idx) => (
                <div key={idx} className="bg-white/80 p-2 rounded-xl text-[11px] border border-amber-200/60">
                  <span className="font-black text-amber-900 block">{w.title}</span>
                  <span className="text-amber-800">{w.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: 내 근무 & 메모 캘린더 */}
        {activeMainTab === 'myCalendar' && (
          <div className="space-y-3.5">
            {/* Month Header & Quick Stats */}
            <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-black text-slate-900">
                    {year}년 {month + 1}월
                  </h2>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                    26일~25일 주기
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setCurrentDate(new Date(2026, 8, 1))} className="text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-200">
                    오늘
                  </button>
                  <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Shift Summary Badges */}
              <div className="grid grid-cols-5 gap-1.5 pt-1 border-t border-slate-100 text-center">
                {['D', 'E', 'N', 'OFF', '연차'].map(code => {
                  const meta = shiftRules[code];
                  return (
                    <div 
                      key={code} 
                      className="p-1.5 rounded-xl border flex flex-col items-center justify-center"
                      style={{ backgroundColor: meta?.bg || '#F3F4F6', borderColor: meta?.border || '#E5E7EB' }}
                    >
                      <span className="text-[10px] font-extrabold" style={{ color: meta?.text }}>{code}</span>
                      <span className="text-xs font-black" style={{ color: meta?.text }}>
                        {currentMonthStats[code] || 0}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Allowance & Annual Leave Module */}
              <AllowanceSection
                totalAnnualLeave={totalAnnualLeave}
                setTotalAnnualLeave={setTotalAnnualLeave}
                manualUsedAnnual={manualUsedAnnual}
                setManualUsedAnnual={setManualUsedAnnual}
                autoAnnualLeaveCount={autoAnnualLeaveCount}
                remainingAnnualLeave={remainingAnnualLeave}
                currentMonthStats={currentMonthStats}
                calcMode={calcMode}
                setCalcMode={setCalcMode}
                nightAllowanceRate={nightAllowanceRate}
                setNightAllowanceRate={setNightAllowanceRate}
                eveningAllowanceRate={eveningAllowanceRate}
                setEveningAllowanceRate={setEveningAllowanceRate}
                hourlyWage={hourlyWage}
                setHourlyWage={setHourlyWage}
                totalExtraAllowance={totalExtraAllowance}
                setIsAllowanceModalOpen={setIsAllowanceModalOpen}
              />

              <button
                onClick={handleGenerateShareCode}
                className="w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 text-slate-900 font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                카톡 공유용 암호화 코드 생성하기
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-2">
                <span className="text-rose-500">일</span>
                <span>월</span>
                <span>화</span>
                <span>수</span>
                <span>목</span>
                <span>금</span>
                <span className="text-sky-500">토</span>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {cycleDays.map(dObj => {
                  const dYear = dObj.getFullYear();
                  const dMonth = dObj.getMonth();
                  const dDay = dObj.getDate();
                  const dayOfWeek = dObj.getDay();

                  const dateKey = formatDateKey(dYear, dMonth, dDay);
                  const fullKey = `${selectedNurseName}_${dateKey}`;
                  const shiftCode = shiftMap[fullKey];
                  const shiftMeta = shiftRules[shiftCode];

                  const isSun = dayOfWeek === 0;
                  const isSat = dayOfWeek === 6;
                  const isSelected = selectedDateStr === dateKey;
                  const dayMemos = shiftMemos[dateKey] || [];
                  const hasMemos = dayMemos.length > 0;

                  return (
                    <button
                      key={dateKey}
                      onClick={() => setSelectedDateStr(dateKey)}
                      className={`aspect-square p-1 rounded-xl border flex flex-col items-center justify-between transition-all relative ${
                        isSelected 
                          ? 'ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50/30' 
                          : 'border-slate-100 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="w-full flex justify-between items-center">
                        <span className={`text-[10px] font-bold ${
                          isSun ? 'text-rose-500' : isSat ? 'text-sky-500' : 'text-slate-600'
                        }`}>
                          {dDay}
                        </span>
                        {hasMemos && (
                          <span className="w-3.5 h-3.5 bg-amber-500 text-white font-black text-[8px] rounded-full flex items-center justify-center leading-none">
                            {dayMemos.length}
                          </span>
                        )}
                      </div>

                      {shiftMeta ? (
                        <span 
                          className="w-full text-center py-0.5 rounded-md text-[10px] font-black leading-tight"
                          style={{ backgroundColor: shiftMeta.bg, color: shiftMeta.text }}
                        >
                          {shiftCode}
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-300">-</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Details & Memo Form */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-black text-slate-900">{selectedDateStr} 메모 & 알림</h3>
                </div>
                <button
                  onClick={() => setIsAllMemosModalOpen(true)}
                  className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>월간 전체 메모</span>
                </button>
              </div>

              {(() => {
                const myCode = shiftMap[`${selectedNurseName}_${selectedDateStr}`] || '미정';
                const meta = shiftRules[myCode];
                const IconComponent = meta?.icon || Clock;

                return (
                  <div className="p-3 rounded-xl border flex items-center justify-between" style={{ backgroundColor: meta?.bg || '#F3F4F6', borderColor: meta?.border || '#E5E7EB' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white/80 rounded-lg">
                        <IconComponent className="w-4 h-4" style={{ color: meta?.text }} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold opacity-80" style={{ color: meta?.text }}>{getDisplayName(selectedNurseName)} 간호사</div>
                        <div className="text-xs font-black" style={{ color: meta?.text }}>{meta?.name || myCode} ({meta?.time})</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Quick Preset Buttons */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">⚡ 터치하여 빠른 알림 추가:</span>
                <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px] font-bold">
                  <button
                    onClick={() => handleAddMemo('중증 환자 수혈 예정', 'handover', '14:00', '30')}
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 shrink-0 flex items-center gap-1"
                  >
                    🏥 수혈 (30분전 알림)
                  </button>
                  <button
                    onClick={() => handleAddMemo('병동 컨퍼런스 참석', 'important', '16:00', '10')}
                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 shrink-0 flex items-center gap-1"
                  >
                    📢 컨퍼런스 (10분전)
                  </button>
                  <button
                    onClick={() => handleAddMemo('퇴근 전 D/C 처방 확인', 'todo', '', 'none')}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 shrink-0"
                  >
                    ✅ D/C 확인
                  </button>
                </div>
              </div>

              {/* Memo Add Input Form */}
              <div className="space-y-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex gap-1.5 text-[11px] font-bold flex-wrap">
                  <select
                    value={newMemoCategory}
                    onChange={(e) => setNewMemoCategory(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 outline-none"
                  >
                    <option value="handover">🏥 인수인계</option>
                    <option value="important">📢 중요/공지</option>
                    <option value="todo">✅ 근무 할일</option>
                    <option value="personal">☕ 개인일정</option>
                  </select>

                  <input
                    type="text"
                    placeholder="시각(ex: 14:00)"
                    value={newMemoTime}
                    onChange={(e) => setNewMemoTime(e.target.value)}
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 outline-none font-mono"
                  />

                  <select
                    value={newMemoAlarmOffset}
                    onChange={(e) => setNewMemoAlarmOffset(e.target.value)}
                    className="bg-white border border-indigo-200 text-indigo-700 rounded-lg px-2 py-1 outline-none"
                  >
                    <option value="none">🔔 알림 없음</option>
                    <option value="0">🔔 정각 알림</option>
                    <option value="10">🔔 10분 전</option>
                    <option value="30">🔔 30분 전</option>
                    <option value="60">🔔 1시간 전</option>
                  </select>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newMemoText}
                    onChange={(e) => setNewMemoText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMemo()}
                    placeholder="메모 내용 입력 (엔터시 등록)"
                    className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl outline-none font-medium"
                  />
                  <button
                    onClick={() => handleAddMemo()}
                    className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shrink-0 hover:bg-indigo-700"
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* Date Memos List */}
              <div className="space-y-1.5 pt-1">
                {(!shiftMemos[selectedDateStr] || shiftMemos[selectedDateStr].length === 0) ? (
                  <div className="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                    등록된 인수인계나 메모가 없습니다. 위 입력칸에서 추가해보세요!
                  </div>
                ) : (
                  shiftMemos[selectedDateStr].map(memo => {
                    const catInfo = MEMO_CATEGORIES[memo.category] || MEMO_CATEGORIES.handover;

                    return (
                      <div 
                        key={memo.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          memo.completed ? 'bg-slate-100/70 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <button
                            onClick={() => handleToggleMemoComplete(selectedDateStr, memo.id)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                              memo.completed ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {memo.completed && <Check className="w-3.5 h-3.5" />}
                          </button>

                          <div className="flex items-center gap-1.5 flex-wrap overflow-hidden">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${catInfo.bg} ${catInfo.text} ${catInfo.border}`}>
                              {catInfo.label}
                            </span>
                            {memo.time && (
                              <span className="text-[10px] font-mono font-extrabold text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                                {memo.time}
                              </span>
                            )}
                            {memo.alarmOffset && memo.alarmOffset !== 'none' && (
                              <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.5 rounded font-bold flex items-center gap-0.5">
                                <Bell className="w-2.5 h-2.5" />
                                {memo.alarmOffset === '0' ? '정각' : `${memo.alarmOffset}분전`}
                              </span>
                            )}
                            <span className={`text-xs font-semibold ${
                              memo.completed ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}>
                              {memo.text}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteMemo(selectedDateStr, memo.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Peer Duty List */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 block">동료 근무 현황:</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedDayDutyMap).map(([code, members]) => {
                    if (members.length === 0) return null;
                    const meta = shiftRules[code] || { bg: '#F3F4F6', text: '#374151' };
                    return (
                      <div key={code} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black" style={{ color: meta.text }}>{code} ({members.length}명)</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {members.map(m => (
                            <span 
                              key={m} 
                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                m === myNurseName ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'
                              }`}
                            >
                              {getDisplayName(m)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 동료 비교 & 맞교대 시뮬레이터 */}
        {activeMainTab === 'groupRoster' && (
          <div className="space-y-3.5">
            <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-sm font-black text-slate-900">동료 스케줄 비교 & 그룹 관리</h2>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsSwapModalOpen(true)}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 flex items-center gap-1"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    맞교대 시뮬레이터
                  </button>
                  <button
                    onClick={() => setIsAddGroupOpen(true)}
                    className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-xl border border-indigo-100 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    그룹 추가
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none"
                >
                  {groupsList.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.memberNames.length}명, 코드: {g.code})</option>
                  ))}
                </select>

                <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 border border-slate-200">
                  <button
                    onClick={() => setRosterViewMode('daily')}
                    className={`p-1.5 rounded-lg transition-all ${
                      rosterViewMode === 'daily' ? 'bg-white shadow-2xs text-indigo-600' : 'text-slate-400'
                    }`}
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRosterViewMode('timeline')}
                    className={`p-1.5 rounded-lg transition-all ${
                      rosterViewMode === 'timeline' ? 'bg-white shadow-2xs text-indigo-600' : 'text-slate-400'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {rosterViewMode === 'daily' && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                  <span className="text-xs font-extrabold text-slate-800">날짜선택:</span>
                  <input
                    type="date"
                    value={selectedDateStr}
                    onChange={(e) => setSelectedDateStr(e.target.value)}
                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 outline-none"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  {currentGroup.memberNames.map(mName => {
                    const shiftCode = shiftMap[`${mName}_${selectedDateStr}`] || '-';
                    const shiftMeta = shiftRules[shiftCode];
                    const isMe = mName === myNurseName;

                    return (
                      <div 
                        key={mName}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          isMe ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center">
                            {mName[0]}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{getDisplayName(mName)}</span>
                            {isMe && <span className="text-[9px] text-indigo-600 font-extrabold">나 (ME)</span>}
                          </div>
                        </div>

                        {shiftMeta ? (
                          <span 
                            className="px-3 py-1 rounded-lg text-xs font-black"
                            style={{ backgroundColor: shiftMeta.bg, color: shiftMeta.text, border: `1px solid ${shiftMeta.border}` }}
                          >
                            {shiftMeta.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 font-bold">-</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {rosterViewMode === 'timeline' && (
              <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-2 border-r border-slate-200 w-20 sticky left-0 bg-slate-50 z-10 font-bold text-slate-700">이름</th>
                      {cycleDays.map(dObj => (
                        <th key={dObj.toISOString()} className="p-1 min-w-[32px] border-r border-slate-100 text-[10px] font-bold text-slate-500">
                          {dObj.getDate()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentGroup.memberNames.map(mName => {
                      const isMe = mName === myNurseName;
                      return (
                        <tr key={mName} className="border-b border-slate-100">
                          <td className="p-2 border-r border-slate-200 font-extrabold text-slate-800 sticky left-0 bg-white z-10 text-[11px]">
                            {getDisplayName(mName)} {isMe && '⭐'}
                          </td>
                          {cycleDays.map(dObj => {
                            const dateKey = formatDateKey(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
                            const shiftCode = shiftMap[`${mName}_${dateKey}`] || '-';
                            const shiftMeta = shiftRules[shiftCode];

                            return (
                              <td key={dateKey} className="p-0.5 border-r border-slate-100">
                                {shiftMeta ? (
                                  <span className="inline-block w-6 h-6 leading-6 text-center rounded text-[10px] font-black" style={{ backgroundColor: shiftMeta.bg, color: shiftMeta.text }}>
                                    {shiftCode}
                                  </span>
                                ) : (
                                  <span className="text-slate-200 text-[9px]">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: 오프 맞추기 */}
        {activeMainTab === 'offMatching' && (
          <div className="space-y-3.5">
            <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PartyPopper className="w-4 h-4 text-pink-600" />
                  <h2 className="text-sm font-black text-slate-900">동기 오프 매칭</h2>
                </div>
                <span className="text-[10px] font-bold bg-pink-50 text-pink-700 px-2.5 py-0.5 rounded-full border border-pink-200">
                  {matchedOffDays.length}개 날짜 발견
                </span>
              </div>

              <div className="flex gap-1.5 overflow-x-auto text-[11px] font-bold pt-1">
                <button
                  onClick={() => setOffFilterMode('all')}
                  className={`px-3 py-1.5 rounded-xl shrink-0 ${offFilterMode === 'all' ? 'bg-pink-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  전체 ({matchedOffDays.length})
                </button>
                <button
                  onClick={() => setOffFilterMode('full')}
                  className={`px-3 py-1.5 rounded-xl shrink-0 ${offFilterMode === 'full' ? 'bg-pink-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  🎉 전원 동시 휴무
                </button>
              </div>
            </div>

            {copiedNotification && (
              <div className="p-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl text-center">
                📋 카톡 공유 문구가 복사되었습니다!
              </div>
            )}

            <div className="space-y-3">
              {matchedOffDays.map(item => {
                const dayOfWeek = item.dateObj.getDay();
                const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <div 
                    key={item.dateKey}
                    className={`p-3.5 rounded-2xl border space-y-2.5 ${
                      item.isFullMatch ? 'bg-gradient-to-r from-pink-50 to-rose-50 border-pink-300' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-xs font-black text-slate-900">
                          {item.dateObj.getMonth() + 1}월 {item.dateObj.getDate()}일 ({dayNames[dayOfWeek]})
                        </span>
                        {isWeekend && <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">주말</span>}
                      </div>

                      {item.isFullMatch ? (
                        <span className="text-[10px] font-black bg-pink-600 text-white px-2 py-0.5 rounded-full">전원 휴무!</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500">{item.offMembers.length}명 휴무</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {item.offMembers.map(mName => (
                        <span key={mName} className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-white text-slate-700 border-slate-200">
                          {getDisplayName(mName)}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => handleCopyText(`🎉 [오프 모임 제안] ${item.dateKey} 쉬는사람: ${item.offMembers.map(getDisplayName).join(', ')}\n같이 맛집 가자! ☕`)}
                      className="w-full py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1"
                    >
                      <Copy className="w-3 h-3 text-pink-600" />
                      약속 일정 카톡 복사
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: 등록 및 파싱 */}
        {activeMainTab === 'upload' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
            <div className="border-b pb-3 border-slate-100">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-indigo-600" />
                근무표 등록 & 동기화
              </h2>
            </div>

            {/* Paste Parsing Form */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-xs font-extrabold text-slate-800 block">📋 엑셀 텍스트 직접 복사/붙여넣기</span>
              <p className="text-[10px] text-slate-500">
                엑셀에서 날짜 행과 근무 코드 행을 드래그하여 아래 입력창에 Ctrl+V로 붙여넣으세요.
              </p>
              <textarea
                rows={3}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="26  27  28  29  30 ...&#10;E   E   OFF OFF OFF ..."
                className="w-full text-xs font-mono p-2.5 bg-white border border-slate-200 rounded-xl outline-none"
              />
              <button
                onClick={handleParsePastedText}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 rounded-xl transition-all"
              >
                캘린더에 일괄 동기화하기
              </button>
            </div>

            {/* Encrypted Code Import Form */}
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
              <span className="text-xs font-extrabold text-amber-900 block">🔒 동료 암호화 공유 코드 연동</span>
              <input
                type="text"
                value={inputShareCode}
                onChange={(e) => setInputShareCode(e.target.value)}
                placeholder="동료가 전달한 암호화 코드 붙여넣기"
                className="w-full text-xs font-mono p-2.5 bg-white border border-amber-300 rounded-xl outline-none"
              />
              <input
                type="password"
                value={inputSharePassword}
                onChange={(e) => setInputSharePassword(e.target.value)}
                placeholder="비밀번호 (설정된 경우 입력)"
                className="w-full text-xs p-2 bg-white border border-amber-300 rounded-xl outline-none"
              />
              <button onClick={handleImportShareCode} className="w-full bg-amber-500 text-slate-950 font-black text-xs py-2 rounded-xl">
                🔐 동료 근무표 불러오기
              </button>
            </div>

            <div className="p-4 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-200 text-center space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-indigo-500 mx-auto" />
              <div className="text-xs font-bold text-slate-800">엑셀 파일 (.xlsx) 업로드 안내</div>
              <input type="file" ref={fileInputRef} accept=".xlsx, .xls" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl">
                파일 선택하기
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 flex justify-around py-2 px-1">
        <button
          onClick={() => setActiveMainTab('myCalendar')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            activeMainTab === 'myCalendar' ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold'
          }`}
        >
          <CalendarIcon className="w-5 h-5" />
          <span className="text-[10px]">내 근무</span>
        </button>

        <button
          onClick={() => setActiveMainTab('groupRoster')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            activeMainTab === 'groupRoster' ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">동료 비교</span>
        </button>

        <button
          onClick={() => setActiveMainTab('offMatching')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            activeMainTab === 'offMatching' ? 'text-pink-600 font-black' : 'text-slate-400 font-bold'
          }`}
        >
          <PartyPopper className="w-5 h-5" />
          <span className="text-[10px]">오프 맞추기</span>
        </button>

        <button
          onClick={() => setActiveMainTab('upload')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            activeMainTab === 'upload' ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold'
          }`}
        >
          <Upload className="w-5 h-5" />
          <span className="text-[10px]">등록</span>
        </button>
      </nav>

      {/* MODAL 1: Allowance Rate Settings Modal */}
      {isAllowanceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">수당 단가 상세 설정</h3>
              </div>
              <button onClick={() => setIsAllowanceModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">나이트(N) 1회당 수당 (원):</label>
                <input
                  type="number"
                  value={nightAllowanceRate}
                  onChange={(e) => setNightAllowanceRate(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">이브닝(E) 1회당 수당 (원):</label>
                <input
                  type="number"
                  value={eveningAllowanceRate}
                  onChange={(e) => setEveningAllowanceRate(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">통상 시급 기준 (원):</label>
                <input
                  type="number"
                  value={hourlyWage}
                  onChange={(e) => setHourlyWage(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>
            </div>

            <button
              onClick={() => setIsAllowanceModalOpen(false)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl"
            >
              저장 및 반영
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Add / Join Group Modal */}
      {isAddGroupOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">그룹 생성 / 코드 참여</h3>
              </div>
              <button onClick={() => setIsAddGroupOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-2">
                <span className="font-black text-indigo-900 block">✨ 새 공유 그룹 생성</span>
                <input
                  type="text"
                  value={newGroupNameInput}
                  onChange={(e) => setNewGroupNameInput(e.target.value)}
                  placeholder="예: 5병동 3년차 모임"
                  className="w-full p-2 bg-white border border-indigo-200 rounded-xl"
                />
                <button
                  onClick={handleCreateGroupSubmit}
                  className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl"
                >
                  그룹 만들기
                </button>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                <span className="font-black text-amber-900 block">🔑 초대 코드로 참여</span>
                <input
                  type="text"
                  value={joinGroupCodeInput}
                  onChange={(e) => setJoinGroupCodeInput(e.target.value)}
                  placeholder="초대 코드 입력 (예: W5ALL1)"
                  className="w-full p-2 bg-white border border-amber-300 rounded-xl font-mono uppercase"
                />
                <button
                  onClick={handleJoinGroupSubmit}
                  className="w-full py-2 bg-amber-500 text-slate-950 font-black rounded-xl"
                >
                  그룹 참여하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Notification & Sound Center */}
      {isNotificationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">근무 알림 & 링톤 센터</h3>
              </div>
              <button onClick={() => setIsNotificationModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-slate-800 block">브라우저 알림 권한</span>
                  <span className="text-[10px] text-slate-500">
                    현재 상태: <strong>{notificationPermission === 'granted' ? '🟢 허용됨' : '🔴 미허용'}</strong>
                  </span>
                </div>
                {notificationPermission !== 'granted' && (
                  <button
                    onClick={requestNotificationPermission}
                    className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-xl text-xs"
                  >
                    권한 요청
                  </button>
                )}
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2">
                <span className="font-extrabold text-indigo-900 block">🔊 사운드 및 알림 테스트</span>
                <p className="text-[11px] text-indigo-700">
                  지정한 시각에 작동할 알림 소리와 시스템 팝업을 미리 테스트합니다.
                </p>
                <button
                  onClick={triggerTestNotification}
                  className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-xs"
                >
                  <Volume2 className="w-4 h-4" />
                  알림 소리 & 팝업 테스트
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsNotificationModalOpen(false)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: All Monthly Memos Viewer */}
      {isAllMemosModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-2 border-slate-100 shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">월간 전체 메모 및 일정</h3>
              </div>
              <button onClick={() => setIsAllMemosModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-1 text-[10px] font-bold overflow-x-auto pb-1 shrink-0">
              <button
                onClick={() => setMemoFilterTab('all')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${memoFilterTab === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                전체
              </button>
              {Object.entries(MEMO_CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setMemoFilterTab(key)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 ${memoFilterTab === key ? 'bg-indigo-600 text-white' : `${cat.bg} ${cat.text}`}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {Object.entries(shiftMemos).flatMap(([dKey, items]) => 
                items.filter(m => memoFilterTab === 'all' || m.category === memoFilterTab)
                     .map(m => ({ ...m, dateKey: dKey }))
              ).length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">등록된 메모가 없습니다.</div>
              ) : (
                Object.entries(shiftMemos).flatMap(([dKey, items]) => 
                  items.filter(m => memoFilterTab === 'all' || m.category === memoFilterTab)
                       .map(m => ({ ...m, dateKey: dKey }))
                ).map(item => {
                  const catInfo = MEMO_CATEGORIES[item.category] || MEMO_CATEGORIES.handover;
                  return (
                    <div key={item.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-900">{item.dateKey} {item.time && `(${item.time})`}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${catInfo.bg} ${catInfo.text}`}>
                          {catInfo.label}
                        </span>
                      </div>
                      <p className={`text-slate-700 ${item.completed ? 'line-through opacity-60' : ''}`}>{item.text}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Shift Swap Simulator */}
      {isSwapModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">맞교대 (스왑) 시뮬레이터</h3>
              </div>
              <button onClick={() => setIsSwapModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">교대 대상 동료 선택:</label>
                <select
                  value={swapPartner}
                  onChange={(e) => setSwapPartner(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  {nursesList.filter(n => n.name !== myNurseName).map(n => (
                    <option key={n.id} value={n.name}>{n.name} ({n.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">교대 교환 날짜:</label>
                <input
                  type="date"
                  value={swapTargetDate}
                  onChange={(e) => setSwapTargetDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
                <span className="text-[10px] font-extrabold text-emerald-900 block">🔄 교환 시 근무 변화 예시:</span>
                <div className="text-[11px] text-emerald-800 flex justify-between font-bold">
                  <span>나 ({myNurseName}): {shiftMap[`${myNurseName}_${swapTargetDate}`] || 'OFF'} ➔ {shiftMap[`${swapPartner}_${swapTargetDate}`] || 'OFF'}</span>
                </div>
                <div className="text-[11px] text-emerald-800 flex justify-between font-bold">
                  <span>동료 ({swapPartner}): {shiftMap[`${swapPartner}_${swapTargetDate}`] || 'OFF'} ➔ {shiftMap[`${myNurseName}_${swapTargetDate}`] || 'OFF'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleExecuteShiftSwap}
              className="w-full py-2.5 bg-emerald-600 text-white font-extrabold text-xs rounded-xl hover:bg-emerald-700 shadow-md"
            >
              근무 교대 확정 및 동기화
            </button>
          </div>
        </div>
      )}

      {/* MODAL 6: Share Encrypted Code Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">카톡 공유용 코드</h3>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600">아래 암호화 코드를 복사하여 카톡으로 전달하면, 동료 앱에 내 근무표가 즉시 연동됩니다.</p>
              <textarea
                rows={3}
                readOnly
                value={generatedShareCode}
                className="w-full text-xs font-mono p-2 bg-slate-50 border border-slate-200 rounded-xl break-all"
              />
            </div>

            <button
              onClick={() => handleCopyText(generatedShareCode)}
              className="w-full py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md"
            >
              코드 복사하기
            </button>
          </div>
        </div>
      )}

      {/* MODAL 7: PWA Guide Modal */}
      {isPwaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">스마트폰 앱 홈 화면 추가</h3>
              </div>
              <button onClick={() => setIsPwaModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                <span className="font-extrabold text-indigo-900 block mb-1">📱 아이폰 (Safari Browser):</span>
                <p>하단 중앙 [공유] 버튼 클릭 ➔ <strong>[홈 화면에 추가]</strong> 선택</p>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <span className="font-extrabold text-emerald-900 block mb-1">🤖 안드로이드 (Chrome Browser):</span>
                <p>우측 상단 [⋮] 메뉴 클릭 ➔ <strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong> 선택</p>
              </div>
            </div>

            <button
              onClick={() => setIsPwaModalOpen(false)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
