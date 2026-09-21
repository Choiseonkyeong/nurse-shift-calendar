import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Users, PlusCircle, UserCheck, RefreshCw, Copy, LogOut, Trash2 } from 'lucide-react';
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

  // DB 그룹 데이터 가져오기 (DB에 저장된 실제 방 이름 유지)
  const pullGroupData = useCallback(async (targetCode, targetName, isJoining = false) => {
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
        const dbGroupName = data[0].group_name && data[0].group_name !== '공유 그룹' 
          ? data[0].group_name 
          : (targetName || '공유 그룹');

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
                ? { ...g, name: (existingGroup.name && existingGroup.name !== '공유 그룹') ? existingGroup.name : dbGroupName, members: dbMembers } 
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

  // 내 근무 DB 전송
  const pushMyShiftsToSupabase = useCallback(async (targetCode, targetName) => {
    const cleanCode = targetCode?.trim().toUpperCase();
    const myCleanName = cleanDisplayName(userName);

    if (!cleanCode || !myCleanName || !supabase) return false;

    const finalGroupName = (targetName && targetName !== '공유 그룹')
      ? targetName
      : (currentName || '공유 그룹');

    try {
      const { error: upsertErr } = await supabase
        .from('group_shifts')
        .upsert(
          {
            group_code: cleanCode,
            group_name: finalGroupName,
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
  }, [userName, safeMyShifts, currentName]);

  const syncWithSupabase = useCallback(async (targetCode, targetName, isJoining = false) => {
    await pushMyShiftsToSupabase(targetCode, targetName);
    return pullGroupData(targetCode, targetName, isJoining);
  }, [pushMyShiftsToSupabase, pullGroupData]);

  useEffect(() => {
    if (currentCode && userName) {
      syncWithSupabase(currentCode, currentName, false);
    }
  }, [currentCode, userName]);

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
  }, [currentCode, userName]);

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
    if (await syncWithSupabase(code, null, true)) {
      alert(`🎉 초대 코드 [ ${code} ] 그룹에 연결되었습니다!`);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`초대 코드 [ ${code} ]가 복사되었습니다!`);
  };

  // 그룹 나가기
  const handleLeaveGroup = async () => {
    if (!activeGroup) return;
    if (window.confirm(`'${activeGroup.name}' 그룹에서 나가시겠습니까?`)) {
      if (supabase && userName) {
        await supabase
          .from('group_shifts')
          .delete()
          .eq('group_code', activeGroup.code)
          .eq('user_name', userName.trim());
      }
      const updated = safeGroups.filter(g => g.id !== activeGroup.id);
      setGroups(updated);
      setActiveGroupId(updated.length > 0 ? updated[0].id : null);
    }
  };

  // 그룹 삭제
  const handleDeleteGroup = async () => {
    if (!activeGroup) return;
    if (window.confirm(`⚠️ '${activeGroup.name}' 그룹을 완전히 삭제하시겠습니까?`)) {
      if (supabase) {
        await supabase
          .from('group_shifts')
          .delete()
          .eq('group_code', activeGroup.code);
      }
      const updated = safeGroups.filter(g => g.id !== activeGroup.id);
      setGroups(updated);
      setActiveGroupId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const activeGroup = currentGroup || safeGroups[0] || null;
  const memberList = activeGroup?.members || [];

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-10">
      {/* 1. 어플 내 공유 그룹 관리 카드 */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-950">
          <Users size={18} className="text-indigo-600" /> 어플 내 공유 그룹 관리
        </h2>

        <div className="grid grid-cols-2 gap-2 text-xs">
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

      {/* 2. 상세 그룹 현황 카드 (우측 상단 3개 버튼 한 줄 배치 수정을 적용한 부분) */}
      {activeGroup && (
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
          <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-slate-900 truncate">{activeGroup.name}</h3>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                초대 코드를 동료에게 전달해 그룹에 참여시키세요!
              </p>
            </div>

            {/* 초대코드, 나가기, 삭제 버튼을 가로 한 줄로 배치 및 줄바꿈 방지 */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
              <button
                onClick={() => handleCopyCode(activeGroup.code)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl transition border border-indigo-100 cursor-pointer whitespace-nowrap"
              >
                <Copy size={13} />
                <span>코드: {activeGroup.code}</span>
              </button>

              <button
                onClick={handleLeaveGroup}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-xs rounded-xl transition border border-slate-200 cursor-pointer whitespace-nowrap"
              >
                <LogOut size={13} />
                <span>나가기</span>
              </button>

              <button
                onClick={handleDeleteGroup}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs rounded-xl transition border border-rose-200 cursor-pointer whitespace-nowrap"
              >
                <Trash2 size={13} />
                <span>삭제</span>
              </button>
            </div>
          </div>

          <div className="pt-1 space-y-3">
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
