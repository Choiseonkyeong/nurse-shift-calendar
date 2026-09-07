import React, { useState, useEffect } from 'react';
import { 
  Users, PlusCircle, UserCheck, Check, Copy, RefreshCw, LogOut, Trash2, Edit3, Palette, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '../supabaseClient';

const DEFAULT_PALETTE = [
  '#4F46E5', '#7C3AED', '#2563EB', '#0284C7', '#0D9488', '#16A34A', 
  '#CA8A04', '#EA580C', '#E11D48', '#DB2777', '#475569', '#000000'
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
  setSelectedDate,
  shiftConfigs,
  userName,
  myShifts,
  privacyBlur
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');

  // 커스텀 RGB/HEX 색상 상태 (기본값: 인디고 계열 #4F46E5)
  const groupColor = currentGroup?.color || '#4F46E5';

  const [groupYear, setGroupYear] = useState(() => Number(selectedDate.split('-')[0]) || 2026);
  const [groupMonth, setGroupMonth] = useState(() => Number(selectedDate.split('-')[1]) || 9);

  const currentCode = currentGroup?.code || '';
  const currentName = currentGroup?.name || '공유 그룹';

  // 1. Supabase DB 데이터 동기화
  const syncWithSupabase = async (targetCode, targetName = '공유 그룹', isJoining = false) => {
    const cleanCode = targetCode?.trim().toUpperCase();
    if (!cleanCode || !userName || userName.trim() === '') return false;
    if (!supabase) return false;

    setLoading(true);

    try {
      const { error: upsertErr } = await supabase
        .from('group_shifts')
        .upsert(
          {
            group_code: cleanCode,
            group_name: targetName,
            user_name: userName.trim(),
            shifts: myShifts || {},
            updated_at: new Date().toISOString()
          },
          { onConflict: 'group_code, user_name' }
        );

      if (upsertErr) console.warn('UPSERT Warning:', upsertErr.message);

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
          isMe: item.user_name === userName
        }));

        let resolvedGroupId = null;

        setGroups(prevGroups => {
          const existingGroup = prevGroups.find(g => g.code === cleanCode);
          if (existingGroup) {
            resolvedGroupId = existingGroup.id;
            return prevGroups.map(g => 
              g.code === cleanCode 
                ? { ...g, name: existingGroup.name || dbGroupName, members: dbMembers } 
                : g
            );
          } else {
            const newG = {
              id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              name: dbGroupName,
              code: cleanCode,
              color: '#4F46E5',
              members: dbMembers
            };
            resolvedGroupId = newG.id;
            return [...prevGroups, newG];
          }
        });

        if (resolvedGroupId) setActiveGroupId(resolvedGroupId);
        return true;
      } else {
        if (isJoining) alert(`⚠️ 초대 코드 [ ${cleanCode} ] 에 해당하는 그룹을 찾을 수 없습니다.`);
        return false;
      }
    } catch (err) {
      console.error('Group sync error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentCode && userName) {
      syncWithSupabase(currentCode, currentName, false);

      if (supabase) {
        const channel = supabase
          .channel(`group-${currentCode}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'group_shifts', filter: `group_code=eq.${currentCode}` },
            () => syncWithSupabase(currentCode, currentName, false)
          )
          .subscribe();

        return () => supabase.removeChannel(channel);
      }
    }
  }, [currentCode, userName, myShifts]);

  // 달력 날짜 계산
  const generateMonthCalendar = (year, month) => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const lastDate = new Date(year, month, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNum: d, dateStr });
    }
    return days;
  };

  const calendarDays = generateMonthCalendar(groupYear, groupMonth);

  const handlePrevGroupMonth = () => {
    if (groupMonth === 1) { setGroupMonth(12); setGroupYear(groupYear - 1); }
    else setGroupMonth(groupMonth - 1);
  };

  const handleNextGroupMonth = () => {
    if (groupMonth === 12) { setGroupMonth(1); setGroupYear(groupYear + 1); }
    else setGroupMonth(groupMonth + 1);
  };

  // 커스텀 색상 변경 핸들러
  const handleColorChange = (newColor) => {
    setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, color: newColor } : g));
  };

  const handleCreateGroupAction = async () => {
    if (!newGroupName.trim()) return alert('생성할 그룹 이름을 입력해 주세요.');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const name = newGroupName.trim();
    setNewGroupName('');
    if (await syncWithSupabase(code, name, false)) alert(`🎉 그룹 '${name}' 생성 완료!\n코드: [ ${code} ]`);
  };

  const handleJoinGroupAction = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return alert('초대 코드를 입력해 주세요.');
    setJoinCodeInput('');
    if (await syncWithSupabase(code, '공유 그룹', true)) alert(`🎉 초대 코드 [ ${code} ] 그룹에 연결되었습니다!`);
  };

  const handleLeaveGroup = async () => {
    if (!currentGroup) return;
    if (window.confirm(`'${currentGroup.name}' 그룹에서 나가시겠습니까?`)) {
      if (supabase && userName) {
        await supabase.from('group_shifts').delete().eq('group_code', currentGroup.code).eq('user_name', userName);
      }
      const updated = groups.filter(g => g.id !== currentGroup.id);
      setGroups(updated);
      setActiveGroupId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!currentGroup) return;
    if (window.confirm(`⚠️ '${currentGroup.name}' 그룹을 완전히 삭제하시겠습니까?`)) {
      if (supabase) await supabase.from('group_shifts').delete().eq('group_code', currentGroup.code);
      const updated = groups.filter(g => g.id !== currentGroup.id);
      setGroups(updated);
      setActiveGroupId(updated.length > 0 ? updated[0].id : null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. 그룹 관리 영역 */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 space-y-3">
        <h2 className="font-extrabold text-base flex items-center gap-2 text-indigo-900">
          <Users size={18} className="text-indigo-600" /> 어플 내 공유 그룹 관리
        </h2>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
            <p className="font-bold text-indigo-950 flex items-center gap-1">
              <PlusCircle size={14} className="text-indigo-600" /> 새 그룹 생성
            </p>
            <input 
              type="text" 
              placeholder="예: 5병동 동기들" 
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroupAction()}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none"
            />
            <button onClick={handleCreateGroupAction} className="w-full bg-indigo-600 text-white font-extrabold py-1.5 rounded-lg hover:bg-indigo-700 transition cursor-pointer">
              그룹 만들기
            </button>
          </div>

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
            <button onClick={handleJoinGroupAction} className="w-full bg-amber-600 text-white font-extrabold py-1.5 rounded-lg hover:bg-amber-700 transition cursor-pointer">
              참여하기
            </button>
          </div>
        </div>

        {groups.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[11px] font-bold text-slate-500">참여 중인 그룹 목록</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {groups.map(g => {
                const isSelected = activeGroupId === g.id;
                const gColor = g.color || '#4F46E5';
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setActiveGroupId(g.id);
                      syncWithSupabase(g.code, g.name, false);
                    }}
                    style={{
                      backgroundColor: isSelected ? gColor : '#F8FAFC',
                      color: isSelected ? '#FFFFFF' : '#334155',
                      borderColor: isSelected ? gColor : '#E2E8F0'
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold border shrink-0 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
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

      {/* 2. 그룹 1달 캘린더 영역 */}
      {currentGroup ? (
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 space-y-4">
          <div className="border-b pb-3 space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg text-slate-900">{currentGroup.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">초대 코드: {currentGroup.code}</p>
              </div>

              {/* 커스텀 RGB 스펙트럼 피커 및 팔레트 */}
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <Palette size={14} className="text-slate-500" />
                <div className="flex items-center gap-1">
                  {DEFAULT_PALETTE.slice(0, 5).map((hex) => (
                    <button
                      key={hex}
                      onClick={() => handleColorChange(hex)}
                      style={{ backgroundColor: hex }}
                      className={`w-4 h-4 rounded-full transition ${groupColor === hex ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'opacity-70'}`}
                    />
                  ))}

                  {/* HTML5 RGB 피커 (이미지 스펙트럼 방식) */}
                  <div className="relative flex items-center cursor-pointer ml-1">
                    <input
                      type="color"
                      value={groupColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                      title="자유 RGB 스펙트럼 색상 선택"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-1">
              <button onClick={handleLeaveGroup} className="text-[11px] font-bold text-slate-500 border border-slate-200 px-2 py-1 rounded-lg">나가기</button>
              <button onClick={handleDeleteGroup} className="text-[11px] font-bold text-rose-600 border border-rose-200 px-2 py-1 rounded-lg">삭제</button>
            </div>
          </div>

          {/* 동적 RGB 적용 1달 근무 달력 */}
          <div 
            style={{ backgroundColor: `${groupColor}0D`, borderColor: `${groupColor}33` }} 
            className="p-3 rounded-2xl border space-y-3"
          >
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <button onClick={handlePrevGroupMonth} className="p-1 hover:bg-white rounded-lg transition"><ChevronLeft size={16} /></button>
                <span className="font-black text-sm text-slate-900">{groupYear}년 {groupMonth}월 그룹 근무표</span>
                <button onClick={handleNextGroupMonth} className="p-1 hover:bg-white rounded-lg transition"><ChevronRight size={16} /></button>
              </div>

              <button 
                onClick={() => syncWithSupabase(currentCode, currentName, false)}
                className="text-[11px] font-bold text-slate-600 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                <span>동기화</span>
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-extrabold text-slate-500 border-b pb-1">
              <span className="text-rose-500">일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span className="text-sky-500">토</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs">
              {calendarDays.map((item, idx) => {
                if (!item) return <div key={idx} className="min-h-16 bg-slate-50/50 rounded-xl"></div>;

                const isSelected = selectedDate === item.dateStr;
                const isToday = item.dateStr === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate && setSelectedDate(item.dateStr)}
                    style={{
                      borderColor: isSelected ? groupColor : isToday ? '#FCD34D' : '#E2E8F0',
                      borderWidth: isSelected ? '2px' : '1px'
                    }}
                    className={`min-h-20 p-1 rounded-xl transition cursor-pointer flex flex-col justify-between ${
                      isSelected ? 'bg-white shadow-sm' : isToday ? 'bg-amber-50/80' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-black px-1 rounded ${isToday ? 'bg-amber-500 text-white' : 'text-slate-700'}`}>
                        {item.dayNum}
                      </span>
                    </div>

                    <div className="space-y-0.5 my-0.5">
                      {(currentGroup.members || []).map((m, mIdx) => {
                        const shiftCode = (m.shifts && m.shifts[item.dateStr]) || 'OFF';
                        const isMe = m.name === userName || m.isMe;

                        return (
                          <div
                            key={mIdx}
                            className={`flex justify-between items-center px-1 py-0.5 rounded text-[8px] font-black leading-none ${
                              shiftCode === 'D' ? 'bg-amber-100 text-amber-900' :
                              shiftCode === 'E' ? 'bg-orange-100 text-orange-900' :
                              shiftCode === 'N' ? 'bg-sky-100 text-sky-900' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <span className="truncate max-w-[28px]">
                              {privacyBlur ? (isMe ? '나' : `동 ${mIdx}`) : m.name.substring(0, 2)}
                            </span>
                            <span>{shiftCode}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="text-xs font-black text-slate-800 block">
              📌 {selectedDate} 선택 일자 상세 근무
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(currentGroup.members || []).map((m, idx) => {
                const shiftCode = (m.shifts && m.shifts[selectedDate]) || 'OFF';
                const isMe = m.name === userName || m.isMe;

                return (
                  <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 text-xs font-bold flex justify-between items-center">
                    <span>{privacyBlur ? (isMe ? '나' : `동료 ${idx}`) : m.name} 쌤</span>
                    <span 
                      style={{ backgroundColor: `${groupColor}1A`, color: groupColor }}
                      className="px-2 py-0.5 rounded-md font-black"
                    >
                      {shiftCode}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-2">
          <Users size={32} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">참여 중인 공유 그룹이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
