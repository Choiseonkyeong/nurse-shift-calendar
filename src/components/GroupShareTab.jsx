import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Users, PlusCircle, UserCheck, RefreshCw, Copy } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { toDateKey, cleanDisplayName, isSamePerson } from '../utils/dateUtils';

export default function GroupShareTab({
  newGroupName,
  setNewGroupName,
  joinCodeInput,
  setJoinCodeInput,
  groups = [],
  setGroups,
  activeGroupId,
  setActiveGroupId,
  currentGroup,
  selectedDate,
  setSelectedDate,
  shiftConfigs,
  userName,
  myShifts = {},
  privacyBlur
}) {
  const [loading, setLoading] = useState(false);

  const normalizedSelectedDate = useMemo(() => toDateKey(selectedDate || new Date()), [selectedDate]);
  const safeGroups = groups || [];
  const safeMyShifts = myShifts || {};

  const currentCode = currentGroup?.code || '';
  const currentName = currentGroup?.name || '';

  const checkIsMe = useCallback((targetName) => isSamePerson(targetName, userName), [userName]);

  // 방어 코드가 강화된 멤버 근무 조회 (undefined 터짐 원천 차단)
  const getShiftCodeForMember = useCallback((member, rawDateKey) => {
    if (!member) return 'OFF';
    const stdKey = toDateKey(rawDateKey);
    const isMe = checkIsMe(member.name) || member.isMe;

    if (isMe) {
      if (safeMyShifts[stdKey] !== undefined) return safeMyShifts[stdKey] || 'OFF';
      return 'OFF';
    }

    const mShifts = member.shifts || {};
    if (mShifts[stdKey] !== undefined) return mShifts[stdKey] || 'OFF';
    
    const foundKey = Object.keys(mShifts).find(k => toDateKey(k) === stdKey);
    if (foundKey && mShifts[foundKey] !== undefined) {
      return mShifts[foundKey] || 'OFF';
    }

    return 'OFF';
  }, [checkIsMe, safeMyShifts]);

  // [Pull] DB 그룹 가져오기
  const pullGroupData = useCallback(async (targetCode, targetName = '공유 그룹', isJoining = false) => {
    const cleanCode = targetCode?.trim().toUpperCase();
    if (!cleanCode || !supabase) return false;

    setLoading(true);

    try {
      const { data, error: selectErr } = await supabase
        .from('group_shifts')
        .select('*')
        .eq('group_code', cleanCode);

      if (selectErr) return false;

      if (data && data.length > 0) {
        const dbGroupName = data[0].group_name || targetName;
        const dbMembers = data.map(item => ({
          name: item.user_name,
          shifts: item.shifts || {},
          isMe: isSamePerson(item.user_name, userName)
        }));

        let resolvedGroupId = null;

        setGroups(prevGroups => {
          const prevList = prevGroups || [];
          const existingGroup = prevList.find(g => g.code === cleanCode);
          if (existingGroup) {
            resolvedGroupId = existingGroup.id;
            return prevList.map(g => 
              g.code === cleanCode 
                ? { ...g, name: existingGroup.name || dbGroupName, members: dbMembers } 
                : g
            );
          } else {
            const newG = {
              id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              name: dbGroupName,
              code: cleanCode,
              members: dbMembers
            };
            resolvedGroupId = newG.id;
            return [...prevList, newG];
          }
        });

        if (resolvedGroupId) setActiveGroupId(resolvedGroupId);
        return true;
      } else {
        if (isJoining) alert(`⚠️ 초대 코드 [ ${cleanCode} ] 에 해당하는 그룹을 찾을 수 없습니다.`);
        return false;
      }
    } catch (err) {
      console.error('Group pull error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userName, setGroups, setActiveGroupId]);

  // [Push] 내 근무 DB 전송
  const pushMyShiftsToSupabase = useCallback(async (targetCode, targetName = '공유 그룹') => {
    const cleanCode = targetCode?.trim().toUpperCase();
    const myCleanName = cleanDisplayName(userName);

    if (!cleanCode || !myCleanName || !supabase) return false;

    try {
      const { error: upsertErr } = await supabase
        .from('group_shifts')
        .upsert(
          {
            group_code: cleanCode,
            group_name: targetName,
            user_name: userName.trim(),
            shifts: safeMyShifts,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'group_code, user_name' }
        );

      return !upsertErr;
    } catch (err) {
      console.error('Group push error:', err);
      return false;
    }
  }, [userName, safeMyShifts]);

  const syncWithSupabase = useCallback(async (targetCode, targetName = '공유 그룹', isJoining = false) => {
    await pushMyShiftsToSupabase(targetCode, targetName);
    return pullGroupData(targetCode, targetName, isJoining);
  }, [pushMyShiftsToSupabase, pullGroupData]);

  useEffect(() => {
    if (currentCode && userName) {
      syncWithSupabase(currentCode, currentName, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCode, userName]);

  // Realtime 구독 (Push 없이 Pull만 수신하여 자가발화 방지)
  useEffect(() => {
    if (currentCode && userName && supabase) {
      const channel = supabase
        .channel(`group-${currentCode}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_shifts', filter: `group_code=eq.${currentCode}` },
          () => pullGroupData(currentCode, currentName, false)
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCode, userName]);

  // 800ms 디바운스 Push
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!currentCode || !userName) return;

    const timer = setTimeout(() => {
      pushMyShiftsToSupabase(currentCode, currentName);
    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myShifts]);

  const handleCreateGroupAction = async () => {
    if (!newGroupName.trim()) return alert('생성할 그룹 이름을 입력해 주세요.');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const name = newGroupName.trim();
    setNewGroupName('');
    if (await syncWithSupabase(code, name, false)) {
      alert(`🎉 그룹 '${name}' 생성 완료!\n코드: [ ${code} ]`);
    }
  };

  const handleJoinGroupAction = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return alert('초대 코드를 입력해 주세요.');
    setJoinCodeInput('');
    if (await syncWithSupabase(code, '공유 그룹', true)) {
      alert(`🎉 초대 코드 [ ${code} ] 그룹에 연결되었습니다!`);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`초대 코드 [ ${code} ]가 복사되었습니다!`);
  };

  const activeGroup = currentGroup || safeGroups[0] || null;
  const memberList = activeGroup?.members || [];

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      {/* 1. 어플 내 공유 그룹 관리 섹션 (원본 디자인) */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-950">
          <Users size={18} className="text-indigo-600" /> 어플 내 공유 그룹 관리
        </h2>

        {/* 새 그룹 생성 / 코드 입장 2열 카드 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* 새 그룹 생성 */}
          <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
            <p className="font-bold text-indigo-950 flex items-center gap-1">
              <PlusCircle size={14} className="text-indigo-600" /> 새 그룹 생성
            </p>
            <input 
              type="text" 
              placeholder="예: 81병동 동기" 
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroupAction()}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400"
            />
            <button 
              onClick={handleCreateGroupAction} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 rounded-xl transition cursor-pointer shadow-2xs"
            >
              그룹 만들기
            </button>
          </div>

          {/* 코드 입장 */}
          <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-2">
            <p className="font-bold text-amber-950 flex items-center gap-1">
              <UserCheck size={14} className="text-amber-600" /> 코드 입장
            </p>
            <input 
              type="text" 
              placeholder="6자리 코드 입력" 
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinGroupAction()}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase text-center outline-none focus:border-amber-400"
            />
            <button 
              onClick={handleJoinGroupAction} 
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 rounded-xl transition cursor-pointer shadow-2xs"
            >
              참여하기
            </button>
          </div>
        </div>

        {/* 참여 중인 그룹 목록 둥근 탭 배지 */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <span className="text-xs font-bold text-slate-400 block">참여 중인 그룹 목록</span>
          <div className="flex flex-wrap gap-2">
            {safeGroups.map((g) => {
              const isActive = activeGroup?.id === g.id;
              const mCount = g.members?.length || 1;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    setActiveGroupId(g.id);
                    syncWithSupabase(g.code, g.name, false);
                  }}
                  className={`px-4 py-2 rounded-full font-extrabold text-xs transition border cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white border-transparent shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {g.name} ({mCount}명)
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. 선택된 그룹 상세 현황 카드 (원본 디자인) */}
      {activeGroup && (
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
          {/* 그룹 타이틀 및 초대 코드 복사 배지 */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-black text-slate-900">{activeGroup.name}</h3>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                초대 코드를 동료에게 전달해 그룹에 참여시키세요!
              </p>
            </div>
            <button
              onClick={() => handleCopyCode(activeGroup.code)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-2xl transition border border-indigo-100 cursor-pointer"
            >
              <Copy size={13} />
              <span>코드: {activeGroup.code}</span>
            </button>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-3">
            {/* 서브 헤더 (선택된 날짜 및 동기화) */}
            <div className="flex justify-between items-center text-xs">
              <span className="font-extrabold text-slate-800 flex items-center gap-1">
                📅 {normalizedSelectedDate} 그룹 멤버 근무 상황
              </span>
              <button
                onClick={() => syncWithSupabase(activeGroup.code, activeGroup.name, false)}
                className="text-indigo-600 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                <span>총 {memberList.length}명 참여 중</span>
              </button>
            </div>

            {/* 그룹 멤버별 근무 상태 박스 뷰 */}
            <div className="space-y-2">
              {memberList.map((m, idx) => {
                const shiftCode = getShiftCodeForMember(m, normalizedSelectedDate);
                const isMe = checkIsMe(m.name) || m.isMe;

                return (
                  <div
                    key={idx}
                    className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-2xl flex justify-between items-center"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">
                        {privacyBlur ? (isMe ? '나' : `동료 ${idx + 1}`) : `${m.name} 쌤`}
                      </span>
                      {isMe && (
                        <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] font-black flex items-center justify-center">
                          나
                        </span>
                      )}
                    </div>

                    <span className="px-4 py-1.5 bg-white text-slate-800 font-black text-xs rounded-xl shadow-2xs border border-slate-200">
                      {shiftCode}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
