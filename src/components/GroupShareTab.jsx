import React, { useState } from 'react';
import { Users, Plus, LogIn, ChevronLeft, Copy, LogOut, Trash2, RefreshCw } from 'lucide-react';

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
  const currentGroup = (groups || []).find((g) => g.id === activeGroupId) || null;

  // 1. 새 그룹 생성
  const handleCreateGroup = () => {
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
          name: userName || '나',
          shifts: myShifts || {}
        }
      ]
    };

    const updated = [...(groups || []), newGroup];
    setGroups(updated);
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
    alert(`🎉 '${newGroup.name}' 그룹이 생성되었습니다!`);
  };

  // 2. 코드로 그룹 입장
  const handleJoinGroup = () => {
    if (!joinCodeInput.trim()) {
      alert('초대 코드를 입력해 주세요.');
      return;
    }

    const code = joinCodeInput.trim().toUpperCase();
    const targetGroup = (groups || []).find((g) => g.code === code);

    if (!targetGroup) {
      alert('해당 초대 코드와 일치하는 그룹이 없습니다.');
      return;
    }

    const isMember = targetGroup.members?.some((m) => m.name === userName);
    if (!isMember) {
      targetGroup.members.push({
        id: `user_${Date.now()}`,
        name: userName || '사용자',
        shifts: myShifts || {}
      });
      setGroups([...groups]);
    }

    setActiveGroupId(targetGroup.id);
    setJoinCodeInput('');
    alert(`🎉 '${targetGroup.name}' 그룹에 참여했습니다!`);
  };

  // 3. 코드 복사
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`초대 코드 [ ${code} ] 가 클립보드에 복사되었습니다!`);
  };

  // 4. 그룹 나가기
  const handleLeaveGroup = (groupId) => {
    if (!window.confirm('정말 이 그룹에서 나가시겠습니까?')) return;
    const updated = (groups || []).map((g) => {
      if (g.id === groupId) {
        return { ...g, members: g.members.filter((m) => m.name !== userName) };
      }
      return g;
    });
    setGroups(updated);
    setActiveGroupId(null);
  };

  // 5. 그룹 삭제
  const handleDeleteGroup = (groupId) => {
    if (!window.confirm('정말 이 그룹을 삭제하시겠습니까?')) return;
    const updated = (groups || []).filter((g) => g.id !== groupId);
    setGroups(updated);
    setActiveGroupId(null);
  };

  // 달력 렌더링 계산
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

  // 근무 코드별 알약 스타일
  const getBadgeStyle = (shift) => {
    switch (shift) {
      case 'D': return 'bg-amber-100 text-amber-800';
      case 'E': return 'bg-orange-100 text-orange-800';
      case 'N': return 'bg-sky-100 text-sky-800';
      case 'M': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-12 text-slate-800">
      
      {/* CASE A: 선택된 그룹이 없는 경우 (그룹 관리/목록 뷰) */}
      {!currentGroup && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users size={18} className="text-indigo-600" /> 어플 내 공유 그룹 관리
            </h2>

            <div className="grid grid-cols-2 gap-3 items-stretch">
              {/* 새 그룹 생성 */}
              <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-3xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="font-extrabold text-xs text-indigo-950 flex items-center gap-1">
                    <Plus size={14} className="text-indigo-600" /> 새 그룹 생성
                  </span>
                  <input
                    type="text"
                    placeholder="예: 81병동 동기"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  style={{ backgroundColor: '#4F46E5', color: '#FFFFFF' }}
                  className="w-full py-2.5 font-extrabold text-xs rounded-2xl transition cursor-pointer shadow-xs block text-center"
                >
                  그룹 만들기
                </button>
              </div>

              {/* 코드 입장 */}
              <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-3xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1">
                    <LogIn size={14} className="text-slate-600" /> 코드 입장
                  </span>
                  <input
                    type="text"
                    placeholder="6자리 코드 입력"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-black tracking-wider text-center uppercase outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleJoinGroup}
                  style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}
                  className="w-full py-2.5 font-extrabold text-xs rounded-2xl transition cursor-pointer shadow-xs block text-center"
                >
                  그룹 참여하기
                </button>
              </div>
            </div>

            {/* 참여 중인 그룹 목록 */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <h3 className="font-black text-xs text-slate-700">참여 중인 그룹 목록</h3>
              {groups && groups.length > 0 ? (
                <div className="space-y-2">
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => setActiveGroupId(g.id)}
                      className="p-3.5 bg-indigo-600 text-white rounded-2xl flex items-center justify-between cursor-pointer shadow-xs"
                    >
                      <span className="font-black text-sm">{g.name} ({g.members?.length || 1}명)</span>
                      <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-xl">입장하기 &gt;</span>
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

      {/* CASE B: 선택된 그룹 상세 (캘린더 및 동료 근무 비교 뷰) */}
      {currentGroup && (
        <div className="space-y-4">
          
          {/* 상단 목록으로 돌아가기 버튼 */}
          <button
            onClick={() => setActiveGroupId(null)}
            className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-black text-indigo-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <ChevronLeft size={16} /> 전체 그룹 목록으로 돌아가기
          </button>

          {/* 그룹 헤더 카드 (복사 / 나가기 / 삭제 기능) */}
          <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-slate-900">{currentGroup.name}</h2>
                <p className="text-xs font-bold text-slate-400 mt-0.5">초대 코드: {currentGroup.code}</p>
              </div>

              {/* 나가기 & 삭제 버튼 */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleLeaveGroup(currentGroup.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-extrabold border border-slate-200 cursor-pointer"
                >
                  <LogOut size={12} /> 나가기
                </button>
                <button
                  onClick={() => handleDeleteGroup(currentGroup.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-extrabold border border-rose-200 cursor-pointer"
                >
                  <Trash2 size={12} /> 삭제
                </button>
              </div>
            </div>

            {/* 초대 코드 복사 바 */}
            <button
              onClick={() => handleCopyCode(currentGroup.code)}
              className="w-full py-2 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-extrabold text-indigo-600 cursor-pointer"
            >
              <Copy size={13} /> 코드: {currentGroup.code} 복사하기
            </button>
          </div>

          {/* 메인 그룹 캘린더 */}
          <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <div className="flex justify-between items-center px-1 py-1">
              <h3 className="font-black text-base text-slate-900">
                {year}년 {month}월 그룹 근무표
              </h3>
              <button className="text-slate-400 hover:text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer">
                <RefreshCw size={12} /> 동기화
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 text-center font-extrabold text-xs text-slate-400 border-b pb-2">
              <span className="text-rose-500">일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span className="text-sky-500">토</span>
            </div>

            {/* 캘린더 타일 그리드 */}
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
                    className={`min-h-[72px] p-1 rounded-2xl border transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-200 bg-indigo-50/20'
                        : 'border-slate-100 bg-slate-50/40 hover:bg-slate-100/60'
                    }`}
                  >
                    <span className="text-[11px] font-black text-slate-700 px-1">{item.day}</span>

                    {/* 멤버별 근무 알약 칩 */}
                    <div className="space-y-0.5 mt-1">
                      {currentGroup.members?.map((member) => {
                        const shift = member.shifts?.[item.dateKey] || 'OFF';
                        const displayName = member.name.length > 2 ? member.name.substring(0, 2) : member.name;

                        return (
                          <div
                            key={member.id}
                            className={`flex justify-between items-center px-1 py-0.5 rounded-md text-[9px] font-black ${getBadgeStyle(shift)}`}
                          >
                            <span className="truncate">{displayName}</span>
                            <span className="ml-0.5">{shift}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선택한 일자 상세 멤버 근무 목록 */}
          <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <h4 className="font-black text-xs text-slate-800 flex items-center gap-1.5">
              📌 <span className="text-indigo-600">{selectedDayKey}</span> 선택 일자 상세 근무
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {currentGroup.members?.map((member) => {
                const shift = member.shifts?.[selectedDayKey] || 'OFF';
                return (
                  <div
                    key={member.id}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center"
                  >
                    <span className="font-extrabold text-xs text-slate-800">{member.name} 쌤</span>
                    <span className={`px-2.5 py-1 rounded-xl font-black text-xs ${getBadgeStyle(shift)}`}>
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
