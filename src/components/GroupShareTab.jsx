import React, { useState, useEffect } from 'react';
import { 
  Users, PlusCircle, UserCheck, Check, Copy, RefreshCw, LogOut, Trash2, Edit3, Palette, Calendar
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const THEME_COLORS = [
  { id: 'indigo', name: '보라', bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-200', lightBg: 'bg-indigo-50' },
  { id: 'emerald', name: '초록', bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-200', lightBg: 'bg-emerald-50' },
  { id: 'amber', name: '주황', bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-200', lightBg: 'bg-amber-50' },
  { id: 'rose', name: '분홍', bg: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-200', lightBg: 'bg-rose-50' },
  { id: 'sky', name: '파랑', bg: 'bg-sky-600', text: 'text-sky-600', border: 'border-sky-200', lightBg: 'bg-sky-50' }
];

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
  const [isEditingName, setIsEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');

  const currentCode = currentGroup?.code || '';
  const currentName = currentGroup?.name || '공유 그룹';
  const currentTheme = currentGroup?.color || 'indigo';

  const activeThemeObj = THEME_COLORS.find(t => t.id === currentTheme) || THEME_COLORS[0];

  // 1. Supabase DB 동기화 및 그룹 선택 보장
  const syncWithSupabase = async (targetCode, targetName = '공유 그룹') => {
    const cleanCode = targetCode?.trim().toUpperCase();
    if (!cleanCode || !userName) return;
    setLoading(true);

    try {
      if (supabase) {
        // [A] 내 근무 데이터 업서트
        await supabase
          .from('group_shifts')
          .upsert(
            {
              group_code: cleanCode,
              group_name: targetName,
              user_name: userName,
              shifts: myShifts,
              updated_at: new Date()
            },
            { onConflict: 'group_code, user_name' }
          );

        // [B] 해당 그룹 코드의 전체 멤버 조회
        const { data, error: selectErr } = await supabase
          .from('group_shifts')
          .select('*')
          .eq('group_code', cleanCode);

        if (!selectErr && data && data.length > 0) {
          const dbGroupName = data[0].group_name || targetName;

          const dbMembers = data.map(item => ({
            name: item.user_name,
            shifts: item.shifts || {},
            memos: {},
            isMe: item.user_name === userName
          }));

          // 로컬 groups State에 저장하고 해당 ID로 activeGroupId 고정
          let targetGroupId = null;

          setGroups(prevGroups => {
            const existingGroup = prevGroups.find(g => g.code === cleanCode);
            if (existingGroup) {
              targetGroupId = existingGroup.id;
              return prevGroups.map(g => 
                g.code === cleanCode 
                  ? { ...g, members: dbMembers } 
                  : g
              );
            } else {
              const newG = {
                id: `group_${Date.now()}`,
                name: dbGroupName,
                code: cleanCode,
                color: 'indigo',
                members: dbMembers
              };
              targetGroupId = newG.id;
              return [...prevGroups, newG];
            }
          });

          // activeGroupId를 활성화하여 "가입된 그룹이 없습니다" 방지
          if (targetGroupId) {
            setActiveGroupId(targetGroupId);
          }
        }
      }
    } catch (err) {
      console.error('Group sync error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 그룹 변경 시 실시간 동기화
  useEffect(() => {
    if (currentCode) {
      syncWithSupabase(currentCode, currentName);

      if (supabase) {
        const channel = supabase
          .channel(`group-${currentCode}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'group_shifts', filter: `group_code=eq.${currentCode}` },
            () => {
              syncWithSupabase(currentCode, currentName);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    }
  }, [currentCode, myShifts, userName]);

  // 2. 새 그룹 생성
  const handleCreateGroupAction = async () => {
    if (!newGroupName.trim()) {
      alert('생성할 그룹 이름을 입력해 주세요.');
      return;
    }

    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const groupNameText = newGroupName.trim();
    const newId = `group_${Date.now()}`;

    const newGroup = {
      id: newId,
      name: groupNameText,
      code: generatedCode,
      color: 'indigo',
      members: [{ name: userName, shifts: myShifts, memos: memos || {}, isMe: true }]
    };

    setGroups(prev => [...prev, newGroup]);
    setActiveGroupId(newId);
    setNewGroupName('');

    await syncWithSupabase(generatedCode, groupNameText);
    alert(`🎉 그룹 '${groupNameText}' 생성 완료!\n초대 코드: [ ${generatedCode} ]`);
  };

  // 3. 초대 코드로 참여 (가입 후 해당 그룹 ID로 선택 강제 고정)
  const handleJoinGroupAction = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      alert('초대 코드를 입력해 주세요.');
      return;
    }

    setJoinCodeInput('');

    // 기존에 참여했던 그룹이면 바로 선택
    const existing = groups.find(g => g.code === code);
    if (existing) {
      setActiveGroupId(existing.id);
    }

    // DB 동기화 및 새 그룹 ID로 활성화
    await syncWithSupabase(code, '공유 그룹');
    alert(`🎉 초대 코드 [ ${code} ] 그룹에 연결되었습니다!`);
  };

  // 4. 그룹 나가기
  const handleLeaveGroup = async () => {
    if (!currentGroup) return;
    if (window.confirm(`'${currentGroup.name}' 그룹에서 나가시겠습니까?`)) {
      if (supabase) {
        await supabase
          .from('group_shifts')
          .delete()
          .eq('group_code', currentGroup.code)
          .eq('user_name', userName);
      }

      const updatedGroups = groups.filter(g => g.id !== currentGroup.id);
      setGroups(updatedGroups);
      setActiveGroupId(updatedGroups.length > 0 ? updatedGroups[0].id : null);
      alert('그룹에서 나왔습니다.');
    }
  };

  // 5. 그룹 삭제
  const handleDeleteGroup = async () => {
    if (!currentGroup) return;
    if (window.confirm(`⚠️ '${currentGroup.name}' 그룹을 완전히 삭제하시겠습니까?`)) {
      if (supabase) {
        await supabase
          .from('group_shifts')
          .delete()
          .eq('group_code', currentGroup.code);
      }

      const updatedGroups = groups.filter(g => g.id !== currentGroup.id);
      setGroups(updatedGroups);
      setActiveGroupId(updatedGroups.length > 0 ? updatedGroups[0].id : null);
      alert('그룹이 삭제되었습니다.');
    }
  };

  const handleSaveCustomGroupName = () => {
    if (!customNameInput.trim()) return;
    setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, name: customNameInput.trim() } : g));
    setIsEditingName(false);
  };

  const handleChangeGroupColor = (colorId) => {
    setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, color: colorId } : g));
  };

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
              {groups.map(g => {
                const theme = THEME_COLORS.find(t => t.id === g.color) || THEME_COLORS[0];
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setActiveGroupId(g.id);
                      syncWithSupabase(g.code, g.name);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border shrink-0 transition flex items-center gap-1.5 ${
                      activeGroupId === g.id 
                        ? `${theme.bg} text-white ${theme.border} shadow-xs` 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{g.name}</span>
                    <span className="text-[10px] opacity-80">({g.members ? g.members.length : 1}명)</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 선택된 그룹 세부 정보 */}
      {currentGroup ? (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <div className="border-b pb-3 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      defaultValue={currentGroup.name}
                      onChange={(e) => setCustomNameInput(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold outline-none"
                    />
                    <button onClick={handleSaveCustomGroupName} className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-lg font-bold">저장</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg text-slate-900">{currentGroup.name}</h3>
                    <button onClick={() => { setCustomNameInput(currentGroup.name); setIsEditingName(true); }} className="text-slate-400 hover:text-indigo-600">
                      <Edit3 size={14} />
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">초대 코드를 동료에게 전달해 그룹에 참여시키세요!</p>
              </div>

              <button 
                onClick={() => handleCopyCodeAction(currentGroup.code)}
                className={`flex items-center gap-1.5 ${activeThemeObj.lightBg} border ${activeThemeObj.border} px-3 py-1.5 rounded-xl ${activeThemeObj.text} text-xs font-bold hover:opacity-80 transition`}
              >
                {copiedCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copiedCode ? '복사됨!' : `코드: ${currentGroup.code}`}</span>
              </button>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-1.5">
                <Palette size={13} className="text-slate-400" />
                <div className="flex gap-1">
                  {THEME_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleChangeGroupColor(c.id)}
                      className={`w-4 h-4 rounded-full ${c.bg} ${currentTheme === c.id ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'opacity-60'} transition`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={handleLeaveGroup} className="text-[11px] font-bold text-slate-500 hover:text-amber-600 border border-slate-200 px-2 py-1 rounded-lg flex items-center gap-1">
                  <LogOut size={12} /> 나가기
                </button>
                <button onClick={handleDeleteGroup} className="text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Trash2 size={12} /> 그룹 삭제
                </button>
              </div>
            </div>
          </div>

          {/* 일별 그룹 근무 현황판 */}
          <div className={`${activeThemeObj.lightBg} p-3 rounded-xl border ${activeThemeObj.border} space-y-2`}>
            <div className="flex justify-between items-center text-xs">
              <span className={`font-extrabold ${activeThemeObj.text} flex items-center gap-1`}>
                <Calendar size={14} /> 📅 {selectedDate} 그룹 근무 현황판
              </span>
              <button 
                onClick={() => syncWithSupabase(currentCode, currentName)}
                className="text-[11px] font-bold text-slate-500 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                <span>동기화 ({currentGroup.members ? currentGroup.members.length : 1}명)</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {(currentGroup.members || []).map((m, idx) => {
                const shiftCode = (m.shifts && m.shifts[selectedDate]) || 'OFF';
                const isMe = m.name === userName || m.isMe;
                return (
                  <div key={idx} className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs text-xs font-bold flex items-center gap-1.5">
                    <span className="text-slate-800">{privacyBlur ? (isMe ? '나' : `동료 ${idx}`) : m.name}쌤</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                      shiftCode === 'D' ? 'bg-amber-100 text-amber-800' :
                      shiftCode === 'E' ? 'bg-orange-100 text-orange-800' :
                      shiftCode === 'N' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {shiftCode}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 멤버별 근무 상세 리스트 */}
          <div className="space-y-2">
            {(currentGroup.members || []).map((member, idx) => {
              const memberShiftCode = (member.shifts && member.shifts[selectedDate]) || 'OFF';
              const info = shiftConfigs[memberShiftCode] || shiftConfigs.OFF || { name: 'Off', color: '#F3F4F6', textColor: '#374151' };
              const isMe = member.name === userName || member.isMe;

              return (
                <div key={idx} className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${isMe ? `${activeThemeObj.lightBg} ${activeThemeObj.border}` : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-sm">
                        {privacyBlur ? (isMe ? '나' : `동료 ${idx}`) : member.name} 쌤
                      </span>
                      {isMe && <span className={`${activeThemeObj.bg} text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full`}>나</span>}
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
