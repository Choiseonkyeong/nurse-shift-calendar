import React, { useState, useEffect } from 'react';
import { Users, Plus, LogIn, ChevronLeft, Copy, LogOut, Trash2, RotateCcw } from 'lucide-react';
import { supabase } from '../supabaseClient';

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
  userName,
  myShifts = {}
}) {
  const [selectedDayKey, setSelectedDayKey] = useState(selectedDate || '2026-09-07');
  const [year, month] = (selectedDate || '2026-09-01').split('-').map(Number);
  const [loading, setLoading] = useState(false);

  const currentGroup = (groups || []).find((g) => g.id === activeGroupId) || null;

  // DB에서 그룹 목록 불러오기
  const fetchGroupsFromDB = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('groups').select('*');
      if (error) throw error;
      if (data) {
        setGroups(data);
      }
    } catch (err) {
      console.error('Supabase fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupsFromDB();
  }, []);

  // 1. 새 그룹 생성 (Supabase DB 연결)
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      alert('그룹 이름을 입력해 주세요.');
      return;
    }
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newGroup = {
      id: `group_${Date.now()}`,
      name: newGroupName.trim(),
      code: randomCode,
      members: [
        {
          id: `user_${Date.now()}`,
          name: userName || '홍숙언',
          shifts: myShifts || {}
        }
      ]
    };

    try {
      setLoading(true);
      const { error } = await supabase.from('groups').insert([newGroup]);
      if (error) throw error;

      await fetchGroupsFromDB();
      setActiveGroupId(newGroup.id);
      setNewGroupName('');
      alert(`🎉 '${newGroup.name}' 그룹이 생성되었습니다!`);
    } catch (err) {
      alert(`그룹 생성 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. 코드로 그룹 입장 (Supabase DB 연결)
  const handleJoinGroup = async () => {
    if (!joinCodeInput.trim()) {
      alert('초대 코드를 입력해 주세요.');
      return;
    }
    const code = joinCodeInput.trim().toUpperCase();

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (error || !data) {
        alert('해당 초대 코드와 일치하는 그룹이 없습니다.');
        return;
      }

      const existingMembers = data.members || [];
      const isMember = existingMembers.some((m) => m.name === userName);

      let updatedMembers = existingMembers;
      if (!isMember) {
        updatedMembers = [
          ...existingMembers,
          {
            id: `user_${Date.now()}`,
            name: userName || '최수민',
            shifts: myShifts || {}
          }
        ];

        const { error: updateError } = await supabase
          .from('groups')
          .update({ members: updatedMembers })
          .eq('id', data.id);

        if (updateError) throw updateError;
      }

      await fetchGroupsFromDB();
      setActiveGroupId(data.id);
      setJoinCodeInput('');
      alert(`🎉 '${data.name}' 그룹에 참여했습니다!`);
    } catch (err) {
      alert(`그룹 참여 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. 코드 복사
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`초대 코드 [ ${code} ] 가 클립보드에 복사되었습니다!`);
  };

  // 4. 그룹 나가기 (Supabase DB 연결)
  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('정말 이 그룹에서 나가시겠습니까?')) return;
    try {
      const target = groups.find((g) => g.id === groupId);
      if (!target) return;

      const updatedMembers = (target.members || []).filter((m) => m.name !== userName);
      const { error } = await supabase
        .from('groups')
        .update({ members: updatedMembers })
        .eq('id', groupId);

      if (error) throw error;
      await fetchGroupsFromDB();
      setActiveGroupId(null);
    } catch (err) {
      alert(`그룹 나가기 실패: ${err.message}`);
    }
  };

  // 5. 그룹 삭제 (Supabase DB 연결)
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('정말 이 그룹을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('groups').delete().eq('id', groupId);
      if (error) throw error;
      await fetchGroupsFromDB();
      setActiveGroupId(null);
    } catch (err) {
      alert(`그룹 삭제 실패: ${err.message}`);
    }
  };

  // 달력 날짜 생성
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const lastDateOfMonth = new Date(year, month, 0).getDate();
  const calendarDays = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= lastDateOfMonth; d++) {
    const formattedDay = String(d).padStart(2, '0');
    const formattedMonth = String(month).padStart(2, '0');
    calendarDays.push({
      day: d,
      dateKey: `${year}-${formattedMonth}-${formattedDay}`
    });
  }

  // 원본 알약 칩 스타일
  const getBadgeStyle = (shift) => {
    switch (shift) {
      case 'D': return { backgroundColor: '#FEF08A', color: '#854D0E' };
      case 'E': return { backgroundColor: '#FFEDD5', color: '#9A3412' };
      case 'N': return { backgroundColor: '#E0F2FE', color: '#0369A1' };
      case 'M': return { backgroundColor: '#F3E8FF', color: '#6B21A8' };
      default: return { backgroundColor: '#F1F5F9', color: '#475569' };
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-12 text-slate-800">
      
      {/* 1. 메인 공유 그룹 목록 / 등록 화면 (이미지 1 UI) */}
      {!currentGroup && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
            
            {/* 타이틀 */}
            <div className="flex justify-between items-center">
              <h2 className="text-base font-black text-indigo-950 flex items-center gap-2">
                <Users size={18} className="text-indigo-600" /> 어플 내 공유 그룹 관리
              </h2>
              <button
                onClick={fetchGroupsFromDB}
                className="text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} /> 동기화
              </button>
            </div>

            {/* 카드 2개 레이아웃 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 새 그룹 생성 */}
              <div className="p-4 border border-indigo-100 bg-white rounded-3xl space-y-3 flex flex-col justify-between shadow-xs">
                <div className="space-y-2">
                  <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1">
                    <Plus size={14} className="text-indigo-600" /> 새 그룹 생성
                  </span>
                  <input
                    type="text"
                    placeholder="예: 81병동 동기"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-bold outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCreateGroup}
                  style={{ backgroundColor: '#6366F1' }}
                  className="w-full py-2.5 text-white font-black text-xs rounded-2xl hover:bg-indigo-600 transition cursor-pointer shadow-xs"
                >
                  {loading ? '처리 중...' : '그룹 만들기'}
                </button>
              </div>

              {/* 코드 입장 */}
              <div className="p-4 border border-slate-100 bg-white rounded-3xl space-y-3 flex flex-col justify-between shadow-xs">
                <div className="space-y-2">
                  <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1">
                    <LogIn size={14} className="text-slate-600" /> 코드 입장
                  </span>
                  <input
                    type="text"
                    placeholder="6자리 코드 입력"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-bold text-center uppercase outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleJoinGroup}
                  style={{ backgroundColor: '#4F46E5' }}
                  className="w-full py-2.5 text-white font-black text-xs rounded-2xl hover:bg-indigo-700 transition cursor-pointer shadow-xs"
                >
                  {loading ? '조회 중...' : '그룹 참여하기'}
                </button>
              </div>
            </div>

            {/* 참여 중인 그룹 목록 */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <h3 className="font-black text-xs text-slate-700">참여 중인 그룹 목록</h3>
              {groups && groups.length > 0 ? (
                <div className="space-y-2">
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => setActiveGroupId(g.id)}
                      style={{ backgroundColor: '#6366F1' }}
                      className="p-3.5 text-white rounded-2xl flex items-center justify-between cursor-pointer shadow-xs transition hover:opacity-95"
                    >
                      <span className="font-black text-sm">{g.name} ({g.members?.length || 1}명)</span>
                      <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-xl">입장하기 &gt;</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 text-center rounded-2xl text-xs font-bold text-slate-400">
                  아직 참여 중인 공유 그룹이 없습니다.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 2. 그룹 상세 스케줄 비교 화면 (이미지 2 UI) */}
      {currentGroup && (
        <div className="space-y-4">
          
          {/* 전체 그룹 목록으로 돌아가기 버튼 */}
          <button
            onClick={() => setActiveGroupId(null)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200/80 rounded-2xl text-xs font-black text-indigo-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <ChevronLeft size={16} /> 전체 그룹 목록으로 돌아가기
          </button>

          {/* 그룹 타이틀 & 코드 & 관리 버튼 카드 */}
          <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-slate-900">{currentGroup.name}</h2>
                <p className="text-xs font-bold text-slate-400 mt-0.5">초대 코드: {currentGroup.code}</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleLeaveGroup(currentGroup.id)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-extrabold border border-slate-200 cursor-pointer"
                >
                  나가기
                </button>
                <button
                  onClick={() => handleDeleteGroup(currentGroup.id)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-extrabold border border-rose-200 cursor-pointer"
                >
                  삭제
                </button>
              </div>
            </div>

            <button
              onClick={() => handleCopyCode(currentGroup.code)}
              className="w-full py-2.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-extrabold text-indigo-600 cursor-pointer"
            >
              <Copy size={13} /> 코드: {currentGroup.code} 복사하기
            </button>
          </div>

          {/* 캘린더 메인 카드 */}
          <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-black text-base text-slate-900">
                {year}년 {month}월 그룹 근무표
              </h3>
              <button onClick={fetchGroupsFromDB} className="text-slate-400 hover:text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer">
                <RotateCcw size={12} /> 동기화
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 text-center font-bold text-xs border-b border-slate-100 pb-2">
              <span className="text-rose-500">일</span>
              <span className="text-slate-400">월</span>
              <span className="text-slate-400">화</span>
              <span className="text-slate-400">수</span>
              <span className="text-slate-400">목</span>
              <span className="text-slate-400">금</span>
              <span className="text-sky-500">토</span>
            </div>

            {/* 그룹 타일 그리드 */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((item, idx) => {
                if (!item) {
                  return <div key={`empty_${idx}`} className="min-h-[70px]"></div>;
                }

                const isSelected = selectedDayKey === item.dateKey;

                return (
                  <div
                    key={item.dateKey}
                    onClick={() => setSelectedDayKey(item.dateKey)}
                    className={`min-h-[70px] p-1 rounded-2xl border transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-200 bg-indigo-50/20'
                        : 'border-slate-100 bg-slate-50/30 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] font-black text-slate-700 px-1">{item.day}</span>

                    {/* 멤버 알약 근무 칩 */}
                    <div className="space-y-0.5 mt-1">
                      {currentGroup.members?.map((member) => {
                        const shift = member.shifts?.[item.dateKey] || 'OFF';
                        const badgeStyle = getBadgeStyle(shift);
                        const displayName = member.name.length > 2 ? member.name.substring(0, 2) : member.name;

                        return (
                          <div
                            key={member.id}
                            style={badgeStyle}
                            className="flex justify-between items-center px-1.5 py-0.5 rounded-lg text-[9px] font-black"
                          >
                            <span className="truncate">{displayName}</span>
                            <span className="ml-0.5 font-bold">{shift}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선택 날짜 멤버별 상세 근무 카드 (이미지 2 하단) */}
          <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <h4 className="font-black text-xs text-slate-800 flex items-center gap-1">
              📌 <span className="text-indigo-600">{selectedDayKey}</span> 선택 일자 상세 근무
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {currentGroup.members?.map((member) => {
                const shift = member.shifts?.[selectedDayKey] || 'OFF';
                const badgeStyle = getBadgeStyle(shift);

                return (
                  <div
                    key={member.id}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center"
                  >
                    <span className="font-extrabold text-xs text-slate-800">{member.name} 쌤</span>
                    <span
                      style={badgeStyle}
                      className="px-3 py-1 rounded-xl font-black text-xs"
                    >
                      {shift}
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
