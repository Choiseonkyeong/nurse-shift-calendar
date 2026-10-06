import React, { useState, useEffect, useCallback, useRef } from 'react';
import { errorText } from '../lib/errorText';
import { confirmDialog } from '../lib/confirm';
import { toast, formatDateKo } from '../lib/toast';
import { Users, Plus, LogIn, ChevronLeft, ChevronRight, Share2, RotateCcw, Palette } from 'lucide-react';
import { useSwipe } from '../lib/swipe';
import { shareText, webOrigin } from '../lib/shareCalendar';
import { addMonthsKey, getTodayDateObj } from '../utils/dateUtils';
import { hasUnread } from '../lib/groupActivity';
import { useShiftTypes, badgeStyle } from '../lib/shiftTypes';
import { dayNumberClass, getHoliday } from '../utils/holidays';
import GroupBoard from './GroupBoard';
import { readGroupColors, saveGroupColor } from '../lib/groupColors';
import {
  fetchMyGroups,
  createGroup,
  joinGroup,
  leaveGroup,
  deleteGroup,
  fetchGroupSchedule,
  fetchGroupActivity
} from '../lib/shiftApi';

export default function GroupShareTab({
  newGroupName,
  setNewGroupName,
  joinCodeInput,
  setJoinCodeInput,
  groups = [],
  setGroups,
  activeGroupId,
  setActiveGroupId,
  selectedDate,
  setSelectedDate,
  profile,
  myShifts = {},
  privacyBlur = false,
  onServerShiftsChanged,
  requireName
}) {
  // 보안 모드: 화면 공유/캡처 시 동료 이름 가리기
  const blurCls = privacyBlur ? 'blur-[3px] select-none' : '';
  const todayKey = getTodayDateObj().dateStr;
  const [selectedDayKey, setSelectedDayKey] = useState(selectedDate || todayKey);
  const [year, month] = (selectedDate || todayKey).split('-').map(Number);
  // 다른 탭에서 날짜를 바꾸면 그룹 탭 선택 날짜도 따라감
  useEffect(() => {
    if (selectedDate) setSelectedDayKey(selectedDate);
  }, [selectedDate]);
  const [loading, setLoading] = useState(false);

  // 기본 추천 색상 5종 + 무한 커스텀 컬러 선택
  const DEFAULT_COLORS = ['#6366F1', '#A855F7', '#10B981', '#F43F5E', '#F59E0B', '#0284C7', '#EC4899'];
  
  // 새 그룹 생성 시 기본선택 커스텀 색상
  const [selectedColor, setSelectedColor] = useState('#6366F1');

  const currentGroup = (groups || []).find((g) => g.id === activeGroupId) || null;
  // 그룹 색상: 내 폰에서 고른 색 → 없으면 그룹을 만든 사람이 정한 기본 색
  const [myColors, setMyColors] = useState(readGroupColors);
  const colorOf = (g) => myColors[g?.id] || g?.color || '#6366F1';
  const currentThemeBg = colorOf(currentGroup);

  // 이전/다음 달 이동 (앱 전체 선택 날짜와 공유)
  const goMonth = (delta) => {
    const next = addMonthsKey(selectedDate, delta);
    setSelectedDate(next);
    setSelectedDayKey(next);
  };
  // 달력을 왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달
  const monthSwipe = useSwipe({ onLeft: () => goMonth(1), onRight: () => goMonth(-1) });

  // 현재 그룹의 해당 월 근무표 { [profileId]: { 'YYYY-MM-DD': code } }
  const [groupSchedule, setGroupSchedule] = useState({ shifts: {}, styles: {} });
  const shiftTypes = useShiftTypes();

  const withLoading = useCallback(async (fn, failLabel) => {
    try {
      setLoading(true);
      return await fn();
    } catch (err) {
      console.error(err);
      if (failLabel) toast(`${failLabel}\n${errorText(err)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // 그룹 목록의 '새 글'·'교환 요청' 표시 { groupId: { lastPostAt, pendingSwaps } }
  const [activity, setActivity] = useState({});

  // 내가 참여 중인 그룹 목록 + 멤버 조회
  // 조회는 버튼 잠금(loading)과 따로: 1분마다 도는 새로고침이 '그룹 만들기' 중에 잠금을 풀면 두 번 눌림
  const fetchMyGroupsFromDB = useCallback(async () => {
    if (!profile) return;
    try {
      const list = await fetchMyGroups();
      setGroups(list);
      fetchGroupActivity(list.map((g) => g.id), profile.id).then(setActivity).catch(() => {});
    } catch (err) {
      console.error(err);
    }
  }, [profile, setGroups]);

  // 현재 그룹의 선택 월 근무표 조회
  const currentGroupId = currentGroup?.id;
  // 그룹·달을 빠르게 바꾸면 늦게 온 예전 응답이 지금 화면을 덮지 않도록 마지막 요청만 반영
  const scheduleReqRef = useRef(0);
  const fetchScheduleFromDB = useCallback(async () => {
    const req = ++scheduleReqRef.current;
    if (!profile || !currentGroupId) return;
    try {
      const mm = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      const data = await fetchGroupSchedule(currentGroupId, `${year}-${mm}-01`, `${year}-${mm}-${lastDay}`);
      if (req === scheduleReqRef.current) setGroupSchedule(data);
    } catch (err) {
      console.error(err);
    }
  }, [profile, currentGroupId, year, month]);

  const refreshAll = async () => {
    await fetchMyGroupsFromDB();
    await fetchScheduleFromDB();
  };

  useEffect(() => {
    fetchMyGroupsFromDB();
  }, [fetchMyGroupsFromDB]);

  useEffect(() => {
    setGroupSchedule({ shifts: {}, styles: {} });
    fetchScheduleFromDB();
  }, [fetchScheduleFromDB]);

  // 그룹 근무표 자동 새로고침: 1분마다(화면이 보일 때) + 앱으로 돌아올 때
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (currentGroupId) fetchScheduleFromDB();
      else fetchMyGroupsFromDB();
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [currentGroupId, fetchScheduleFromDB, fetchMyGroupsFromDB]);

  // 교환 수락 등으로 서버 근무가 바뀜 → 그룹 근무표 + 내 달력 다시 불러오기
  const handleSwapApplied = useCallback(() => {
    fetchScheduleFromDB();
    onServerShiftsChanged?.();
  }, [fetchScheduleFromDB, onServerShiftsChanged]);

  const getCode = useCallback(
    (profileId, dateKey) => (profileId === profile?.id ? myShifts[dateKey] : groupSchedule.shifts[profileId]?.[dateKey]) || '',
    [profile?.id, myShifts, groupSchedule]
  );

  // 교환 요청에서 고른 날짜의 멤버별 근무 (보고 있는 달 밖의 날짜도 정확히) → { profileId: code }
  const loadDayCodes = useCallback(
    async (dateKey) => {
      const { shifts } = await fetchGroupSchedule(currentGroupId, dateKey, dateKey);
      return Object.fromEntries(Object.entries(shifts).map(([pid, byDate]) => [pid, byDate[dateKey] || '']));
    },
    [currentGroupId]
  );

  // 본인 근무는 로컬 최신값, 동료 근무는 서버 조회값
  const getMemberShifts = (member) =>
    member.id === profile?.id ? myShifts : groupSchedule.shifts[member.id] || {};

  // 동료가 직접 만든 근무 코드는 서버에 저장된 그 사람의 색상 사용
  const getMemberBadgeStyle = (member, code) => {
    const own = member.id !== profile?.id && groupSchedule.styles[member.id]?.[code];
    return own ? { backgroundColor: own.bg, color: own.fg } : badgeStyle(shiftTypes, code);
  };

  const ensureOnline = () => {
    if (profile) return true;
    toast('서버에 연결되지 않았습니다. 네트워크 확인 후 다시 시도해 주세요.', 'error');
    return false;
  };

  // 1. 새 그룹 생성
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast('그룹 이름을 입력해 주세요.', 'info');
      return;
    }
    if (!ensureOnline()) return;
    // 이름 없이 시작한 경우: 그룹에서 보일 이름을 먼저 정하고 이어서 진행
    if (requireName?.(() => handleCreateGroup())) return;

    await withLoading(async () => {
      const group = await createGroup(newGroupName.trim(), selectedColor);
      setMyColors(saveGroupColor(group.id, selectedColor));
      await fetchMyGroupsFromDB();
      setActiveGroupId(group.id);
      setNewGroupName('');
      toast(`🎉 '${group.name}' 그룹이 생성되었습니다!`, 'success');
    }, '그룹 생성 실패');
  };

  // 2. 코드로 그룹 입장
  const handleJoinGroup = async () => {
    if (!joinCodeInput.trim()) {
      toast('6자리 초대 코드를 입력해 주세요.', 'info');
      return;
    }
    if (!ensureOnline()) return;
    if (requireName?.(() => handleJoinGroup())) return;

    await withLoading(async () => {
      let group;
      try {
        group = await joinGroup(joinCodeInput.trim().toUpperCase());
      } catch (err) {
        toast(errorText(err), 'error');
        return;
      }
      await fetchMyGroupsFromDB();
      setActiveGroupId(group.id);
      setJoinCodeInput('');
      toast(`🎉 '${group.name}' 그룹에 참여했습니다!`, 'success');
    }, '그룹 참여 실패');
  };

  // 3. 그룹 색상 변경: 내 폰에서만 적용 (서버에 올리지 않음 → 다른 멤버 화면의 색은 그대로)
  const handleChangeGroupColor = (groupId, hexColor) => setMyColors(saveGroupColor(groupId, hexColor));

  // 4. 초대하기: 공유 시트(카톡 등)로 초대 링크 보내기, 안 되면 복사
  const handleInvite = async (group) => {
    const url = `${webOrigin()}/?join=${encodeURIComponent(group.code)}`;
    const text = `근무표 앱에서 '${group.name}' 그룹에 들어와요! 초대 코드: ${group.code}`;
    const result = await shareText({ title: `${group.name} 그룹 초대`, text, url });
    if (result === 'copied') toast('초대 링크를 복사했어요. 카톡 등에 붙여넣어 보내 주세요.', 'success');
    else if (result === 'failed') toast(`초대 코드: ${group.code}\n(자동 복사가 안 돼요. 코드를 직접 알려 주세요)`, 'info');
  };

  // 5. 그룹 나가기
  const handleLeaveGroup = async (groupId) => {
    if (!(await confirmDialog({ title: '이 그룹에서 나갈까요?', message: '다시 들어오려면 초대 코드가 필요해요.', confirmText: '나가기', danger: true }))) return;
    await withLoading(async () => {
      await leaveGroup(groupId, profile.id);
      await fetchMyGroupsFromDB();
      setActiveGroupId(null);
    }, '그룹 나가기 실패');
  };

  // 6. 그룹 삭제
  const handleDeleteGroup = async (groupId) => {
    if (!(await confirmDialog({ title: '그룹을 삭제할까요?', message: '모든 멤버에게서 그룹과 게시판이 사라지고 되돌릴 수 없어요.', confirmText: '삭제', danger: true }))) return;
    await withLoading(async () => {
      await deleteGroup(groupId);
      await fetchMyGroupsFromDB();
      setActiveGroupId(null);
    }, '그룹 삭제 실패');
  };

  // 달력 날짜 계산
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const lastDateOfMonth = new Date(year, month, 0).getDate();
  const calendarDays = [];

  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let d = 1; d <= lastDateOfMonth; d++) {
    const formattedDay = String(d).padStart(2, '0');
    const formattedMonth = String(month).padStart(2, '0');
    calendarDays.push({
      day: d,
      dateKey: `${year}-${formattedMonth}-${formattedDay}`
    });
  }

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-12 text-slate-800">
      
      {/* 1. 공유 그룹 목록 관리 화면 */}
      {!currentGroup && (
        <div className="space-y-5">
          {/* 참여 중인 그룹 (자주 쓰는 것을 맨 위에) */}
          <section className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-[13px] font-medium text-slate-500">내 그룹</h2>
              <button
                onClick={fetchMyGroupsFromDB}
                className="text-xs font-medium text-slate-500 flex items-center gap-1 h-8 px-2 rounded-full cursor-pointer active:bg-slate-100"
              >
                <RotateCcw size={12} /> 새로고침
              </button>
            </div>
            {groups && groups.length > 0 ? (
              <div className="card divide-y divide-slate-100 overflow-hidden">
                {groups.map((g) => (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => setActiveGroupId(g.id)}
                    className="w-full px-4 py-3.5 flex items-center gap-3 text-left cursor-pointer active:bg-slate-50"
                  >
                    <span
                      style={{ backgroundColor: colorOf(g) }}
                      className="w-10 h-10 shrink-0 rounded-2xl text-white flex items-center justify-center font-extrabold"
                      aria-hidden="true"
                    >
                      {[...(g.name || '?')][0]}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-[15px] text-slate-900 truncate">{g.name} ({g.members?.length || 1}명)</span>
                      {(activity[g.id]?.pendingSwaps > 0 || hasUnread(g.id, activity[g.id]?.lastPostAt)) && (
                        <span className="flex items-center gap-1.5 mt-0.5">
                          {activity[g.id]?.pendingSwaps > 0 && (
                            <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                              교환 요청 {activity[g.id].pendingSwaps}
                            </span>
                          )}
                          {hasUnread(g.id, activity[g.id]?.lastPostAt) && (
                            <span className="text-[11px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-md">새 글</span>
                          )}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="card p-6 text-center space-y-1">
                <Users size={28} className="mx-auto text-indigo-300" />
                <p className="text-sm font-bold text-slate-700">아직 참여 중인 공유 그룹이 없습니다.</p>
                <p className="text-xs font-medium text-slate-400">새 그룹을 만들거나, 동료에게 받은 코드로 참여하세요.</p>
              </div>
            )}
          </section>

          {/* 새 그룹 만들기 */}
          <section className="card p-5 space-y-3">
            <h3 className="font-bold text-[15px] text-slate-900 flex items-center gap-1.5">
              <Plus size={16} className="text-indigo-600" /> 새 그룹 생성
            </h3>
            <input
              type="text"
              placeholder="예: 81병동 동기"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-100 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-400 mr-1">색상</span>
              {DEFAULT_COLORS.slice(0, 5).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  style={{ backgroundColor: c }}
                  aria-label={`그룹 색 ${c}`}
                  aria-pressed={selectedColor === c}
                  className={`w-7 h-7 rounded-full cursor-pointer ${selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-800' : ''}`}
                />
              ))}
              {/* 원하는 색 직접 고르기 */}
              <label
                className="relative flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 cursor-pointer"
                aria-label="다른 색 고르기"
              >
                <Palette size={14} className="text-slate-500" />
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleCreateGroup}
              style={{ backgroundColor: selectedColor }}
              className="w-full py-3.5 text-white font-bold text-sm rounded-2xl cursor-pointer disabled:opacity-60"
            >
              {loading ? '처리 중...' : '그룹 만들기'}
            </button>
          </section>

          {/* 코드로 참여 */}
          <section className="card p-5 space-y-3">
            <h3 className="font-bold text-[15px] text-slate-900 flex items-center gap-1.5">
              <LogIn size={16} className="text-slate-600" /> 코드 입장
            </h3>
            <input
              type="text"
              placeholder="6자리 코드 입력"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-100 rounded-2xl text-sm font-bold text-center uppercase tracking-[0.2em] placeholder:tracking-normal outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="button"
              disabled={loading}
              onClick={handleJoinGroup}
              className="w-full py-3.5 bg-indigo-600 text-white font-bold text-sm rounded-2xl cursor-pointer disabled:opacity-60"
            >
              {loading ? '조회 중...' : '그룹 참여하기'}
            </button>
          </section>
        </div>
      )}

      {/* 2. 그룹 상세 스케줄 비교 화면 */}
      {currentGroup && (
        <div className="space-y-4">
          
          <button
            onClick={() => setActiveGroupId(null)}
            aria-label="전체 그룹 목록으로 돌아가기"
            className="-ml-1 flex items-center gap-0.5 h-9 pr-3 text-[15px] font-bold text-slate-600 cursor-pointer"
          >
            <ChevronLeft size={22} /> 그룹 목록
          </button>

          {/* 그룹 상세 헤더 (무한 팔레트 색상 동적 스위치) */}
          <div className="card p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">{currentGroup.name}</h2>
                  
                  {/* 무한 팔레트 커스텀 스위치 */}
                  <label className="relative flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 shadow-2xs cursor-pointer hover:scale-110 transition" style={{ backgroundColor: currentThemeBg }}>
                    <Palette size={11} className="text-white drop-shadow-md" />
                    <input
                      type="color"
                      aria-label="그룹 색상 (내 폰에서만 적용)"
                      title="그룹 색상 (내 폰에서만 적용)"
                      value={currentThemeBg}
                      onChange={(e) => handleChangeGroupColor(currentGroup.id, e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                </div>
                <p className="text-xs font-bold text-slate-400 mt-0.5">초대 코드: {currentGroup.code}</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleLeaveGroup(currentGroup.id)}
                  className="h-8 px-3 bg-slate-100 text-slate-600 rounded-full text-xs font-bold cursor-pointer"
                >
                  나가기
                </button>
                {currentGroup.can_delete && (
                <button
                  onClick={() => handleDeleteGroup(currentGroup.id)}
                  className="h-8 px-3 bg-rose-50 text-rose-600 rounded-full text-xs font-bold cursor-pointer"
                >
                  삭제
                </button>
                )}
              </div>
            </div>

            <button
              onClick={() => handleInvite(currentGroup)}
              style={{ backgroundColor: currentThemeBg }}
              className="w-full py-3 text-white rounded-2xl flex items-center justify-center gap-1.5 text-sm font-bold cursor-pointer"
            >
              <Share2 size={13} /> 동료 초대하기 · 코드 {currentGroup.code}
            </button>
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="이전 달"
                  onClick={() => goMonth(-1)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <ChevronLeft size={18} />
                </button>
                <h3 className="font-black text-base text-slate-900 text-center whitespace-nowrap">
                  {year}년 {month}월
                </h3>
                <button
                  type="button"
                  aria-label="다음 달"
                  onClick={() => goMonth(1)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <button onClick={refreshAll} className="text-slate-400 hover:text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <RotateCcw size={12} /> 동기화
              </button>
            </div>

            <div className="grid grid-cols-7 text-center font-bold text-xs border-b border-slate-100 pb-2">
              <span className="text-rose-500">일</span>
              <span className="text-slate-400">월</span>
              <span className="text-slate-400">화</span>
              <span className="text-slate-400">수</span>
              <span className="text-slate-400">목</span>
              <span className="text-slate-400">금</span>
              <span className="text-sky-500">토</span>
            </div>

            <div className="grid grid-cols-7 gap-1" {...monthSwipe}>
              {calendarDays.map((item, idx) => {
                if (!item) return <div key={`empty_${idx}`} className="min-h-[70px]"></div>;
                const isSelected = selectedDayKey === item.dateKey;

                return (
                  <button
                    type="button"
                    key={item.dateKey}
                    onClick={() => setSelectedDayKey(item.dateKey)}
                    aria-label={`${item.dateKey}${getHoliday(item.dateKey) ? ` ${getHoliday(item.dateKey)}` : ''}`}
                    aria-pressed={isSelected}
                    style={isSelected ? { backgroundColor: `${currentThemeBg}1A`, boxShadow: `inset 0 0 0 1.5px ${currentThemeBg}` } : {}}
                    className="min-h-[70px] w-full min-w-0 text-left p-1 rounded-2xl transition-colors flex flex-col justify-start cursor-pointer active:bg-slate-100"
                  >
                    <span
                      title={getHoliday(item.dateKey) || undefined}
                      className={`text-[12px] font-bold px-1 ${dayNumberClass(item.dateKey)}`}
                    >
                      {item.day}
                    </span>

                    <div className="space-y-0.5 mt-1">
                      {currentGroup.members?.map((member) => {
                        const shift = getMemberShifts(member)[item.dateKey] || '';
                        if (!shift) return null; // 미입력 날짜는 표시하지 않음 (OFF 와 구분)
                        const memberStyle = getMemberBadgeStyle(member, shift);
                        const displayName = member.name?.length > 2 ? member.name.substring(0, 2) : member.name;

                        return (
                          <div
                            key={member.id}
                            style={memberStyle}
                            className="flex justify-between items-center gap-px overflow-hidden whitespace-nowrap tracking-tighter px-0.5 min-[380px]:px-1.5 py-0.5 rounded-lg text-[9px] font-black"
                          >
                            {/* 좁은 화면: 이름 첫 글자만 (칸이 좁아 근무 코드가 잘리지 않게) */}
                            <span className={`min-w-0 truncate ${blurCls}`}>
                              <span className="min-[380px]:hidden">{[...(member.name || '')][0]}</span>
                              <span className="hidden min-[380px]:inline">{displayName}</span>
                            </span>
                            <span className="shrink-0 font-bold">{shift}</span>
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h4 className="font-bold text-[15px] text-slate-900 flex items-center gap-1">
              <span style={{ color: currentThemeBg }}>{formatDateKo(selectedDayKey)}</span> 근무
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {currentGroup.members?.map((member) => {
                const shift = getMemberShifts(member)[selectedDayKey] || '';
                const memberStyle = shift ? getMemberBadgeStyle(member, shift) : undefined;

                return (
                  <div
                    key={member.id}
                    className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center gap-1 min-w-0"
                  >
                    <span className={`min-w-0 truncate font-extrabold text-xs text-slate-800 ${blurCls}`}>{member.name} 쌤</span>
                    <span
                      style={memberStyle}
                      className={`shrink-0 whitespace-nowrap px-2 min-[380px]:px-3 py-1 rounded-xl font-black text-xs ${shift ? '' : 'bg-slate-100 text-slate-400'}`}
                    >
                      {shift || '없음'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <GroupBoard
            group={currentGroup}
            profile={profile}
            themeColor={currentThemeBg}
            privacyBlur={privacyBlur}
            defaultDate={selectedDayKey}
            getCode={getCode}
            loadDayCodes={loadDayCodes}
            onSwapApplied={handleSwapApplied}
          />

        </div>
      )}

    </div>
  );
}
