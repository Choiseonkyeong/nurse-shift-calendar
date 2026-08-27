import React, { useState, useEffect } from 'react';
import { Users, PlusCircle, UserCheck, Check, Copy, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function GroupShareTab({
  newGroupName,
  setNewGroupName,
  joinCodeInput,
  setJoinCodeInput,
  groups,
  setGroups,
  activeGroupId,
  setActiveGroupId,
  currentGroup,
  selectedDate,
  shiftConfigs,
  userName,
  myShifts,
  memos,
  privacyBlur
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentCode = currentGroup?.code || 'W5ALL1';

  // Supabase DB 동기화
  const syncWithSupabase = async (targetCode = currentCode) => {
    if (!targetCode || !userName) return;
    setLoading(true);

    try {
      if (supabase) {
        // 1. 내 근무 데이터를 DB에 저장
        await supabase
          .from('group_shifts')
          .upsert(
            {
              group_code: targetCode,
              user_name: userName,
              shifts: myShifts,
              updated_at: new Date()
            },
            { onConflict: 'group_code, user_name' }
          );

        // 2. DB에서 그룹 멤버 전체 데이터 조회
        const { data, error } = await supabase
          .from('group_shifts')
          .select('*')
          .eq('group_code', targetCode);

        if (!error && data && data.length > 0) {
          const dbMembers = data.map(item => ({
            name: item.user_name,
            shifts: item.shifts || {},
            memos: {},
            isMe: item.user_name === userName
          }));

          setGroups(prevGroups => {
            const exists = prevGroups.some(g => g.code === targetCode);
            if (exists) {
              return prevGroups.map(g => g.code === targetCode ? { ...g, members: dbMembers } : g);
            } else {
              return [
                ...prevGroups,
                { id: `group_${Date.now()}`, name: `공유 그룹 (${targetCode})`, code: targetCode, members: dbMembers }
              ];
            }
          });
        }
      }
    } catch (err) {
      console.error('Group sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 그룹 변경 및 실시간 수신
  useEffect(() => {
    syncWithSupabase(currentCode);

    if (supabase) {
      const channel = supabase
        .channel(`group-${currentCode}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_shifts', filter: `group_code=eq.${currentCode}` },
          () => {
            syncWithSupabase(currentCode);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentCode, myShifts, userName]);

  // 새 그룹 생성
  const handleCreateGroupAction = async () => {
    if (!newGroupName.trim()) {
      alert('생성할 그룹 이름을 입력해 주세요.');
      return;
    }

    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newGroup = {
      id: `group_${Date.now()}`,
      name: newGroupName.trim(),
      code: generatedCode,
      members: [{ name: userName, shifts: myShifts, memos: memos || {}, isMe: true }]
    };

    setGroups(prev => [...prev, newGroup]);
    setActiveGroupId(newGroup.id);
    setNewGroupName('');

    await syncWithSupabase(generatedCode);
    alert(`🎉 그룹 '${newGroup.name}' 생성 완료!\n초대 코드: [ ${generatedCode} ]`);
  };

  // 초대 코드 입장
  const handleJoinGroupAction = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      alert('초대 코드를 입력해 주세요.');
      return;
    }

    const existingGroup = groups.find(g => g.code === code);
    if (existingGroup) {
      setActiveGroupId(existingGroup.id);
    } else {
      const joinedGroup = {
        id: `group_${Date.now()}`,
        name: `공유 그룹 (${code})`,
        code: code,
        members: [{ name: userName, shifts: myShifts, memos: memos || {}, isMe: true }]
      };
      setGroups(prev => [...prev, joinedGroup]);
      setActiveGroupId(joinedGroup.id);
    }

    setJoinCodeInput('');
    await syncWithSupabase(code);
    alert(`🎉 초대 코드 [ ${code} ] 그룹에 연결되었습니다!`);
  };

  // 코드 복사
  const handleCopyCodeAction = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* 어플 내 공유 그룹 관리 카테고리 */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-900">
          <Users size={18} className="text-indigo-600" /> 어플 내 공유 그룹 관리
        </h2>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* 새 그룹 생성 */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
            <p className="font-bold text-indigo-950 flex items-center gap-1">
              <PlusCircle size={14} className="text-indigo-600" /> 새 그룹 생성
            </p>
            <input 
              type="text" 
              placeholder="예: 81병동 동기" 
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroupAction()}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none"
            />
            <button 
              onClick={handleCreateGroupAction}
              className="w-full bg-indigo-600 text-white font-extrabold py-1.5 rounded-lg hover:bg-indigo-700 transition cursor-pointer"
            >
              그룹 만들기
            </button>
          </div>

          {/* 코드 입장 */}
          <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-2">
            <p className="font-bold text-amber-950 flex items-center gap-1">
              <UserCheck size={14} className="text-amber-600" /> 코드 입장
            </p>
            <input 
              type="text" 
              placeholder="6자리 코드 입력" 
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinGroupAction()}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase text-center outline-none"
            />
            <button 
              onClick={handleJoinGroupAction}
              className="w-full bg-amber-600 text-white font-extrabold py-1.5 rounded-lg hover:bg-amber-700 transition cursor-pointer"
            >
              참여하기
            </button>
          </div>
        </div>

        {/* 참여 중인 그룹 목록 탭 */}
        {groups.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[11px] font-bold text-slate-500">참여 중인 그룹 목록</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => {
                    setActiveGroupId(g.id);
                    syncWithSupabase(g.code);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border shrink-0 transition flex items-center gap-1.5 ${
                    activeGroupId === g.id 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{g.name}</span>
                  <span className="text-[10px] opacity-80">({g.members ? g.members.length : 1}명)</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 선택된 그룹 멤버 리스트 */}
      {currentGroup ? (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <h3 className="font-black text-lg text-slate-900">{currentGroup.name}</h3>
              <p className="text-[10px] text-slate-400 font-semibold">초대 코드를 동료에게 전달해 그룹에 참여시키세요!</p>
            </div>
            <button 
              onClick={() => handleCopyCodeAction(currentGroup.code)}
              className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition"
            >
              {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copiedCode ? '복사됨!' : `코드: ${currentGroup.code}`}</span>
            </button>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="font-extrabold text-slate-800">📅 {selectedDate} 그룹 멤버 근무 상황</span>
            <button 
              onClick={() => syncWithSupabase(currentCode)}
              className="text-[11px] font-bold text-indigo-600 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>총 {currentGroup.members ? currentGroup.members.length : 1}명 참여 중</span>
            </button>
          </div>

          <div className="space-y-2">
            {(currentGroup.members || []).map((member, idx) => {
              const memberShiftCode = (member.shifts && member.shifts[selectedDate]) || 'OFF';
              const info = shiftConfigs[memberShiftCode] || shiftConfigs.OFF || { name: 'Off', color: '#F3F4F6', textColor: '#374151' };
              const isMe = member.name === userName || member.isMe;

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
  );
}
