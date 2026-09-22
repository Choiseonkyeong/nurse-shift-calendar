import React from 'react';
import { Users, Plus, LogIn } from 'lucide-react';

export default function GroupShareTab({
  newGroupName,
  setNewGroupName,
  joinCodeInput,
  setJoinCodeInput,
  groups = [],
  setGroups,
  activeGroupId,
  setActiveGroupId,
  userName,
  myShifts = {}
}) {
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
          name: userName || '사용자',
          shifts: myShifts || {}
        }
      ]
    };

    const updatedGroups = [...(groups || []), newGroup];
    setGroups(updatedGroups);
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
    alert(`🎉 '${newGroup.name}' 그룹이 생성되었습니다! (공유코드: ${randomCode})`);
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
      alert('해당 초대 코드와 일치하는 그룹을 찾을 수 없습니다.');
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
    alert(`🎉 '${targetGroup.name}' 그룹에 성공적으로 참여했습니다!`);
  };

  return (
    <div className="space-y-4 font-sans max-w-md mx-auto pb-12 text-slate-800">
      
      {/* 어플 내 공유 그룹 관리 카드 */}
      <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <Users size={18} className="text-indigo-600" /> 어플 내 공유 그룹 관리
        </h2>

        {/* 그룹 생성 & 코드 입장 Grid (높이 자동 균등 정렬) */}
        <div className="grid grid-cols-2 gap-3 items-stretch">
          
          {/* 1. 새 그룹 생성 카드 */}
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
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={handleCreateGroup}
              style={{ backgroundColor: '#4F46E5', color: '#FFFFFF' }}
              className="w-full py-2.5 font-extrabold text-xs rounded-2xl transition cursor-pointer shadow-xs block text-center mt-2"
            >
              그룹 만들기
            </button>
          </div>

          {/* 2. 코드 입장 카드 */}
          <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-3xl space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1">
                <LogIn size={14} className="text-slate-600" /> 코드 입장
              </span>
              <input
                type="text"
                placeholder="초대코드 입력"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinGroup()}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-black tracking-wider text-center uppercase outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={handleJoinGroup}
              style={{ backgroundColor: '#1E293B', color: '#FFFFFF' }}
              className="w-full py-2.5 font-extrabold text-xs rounded-2xl transition cursor-pointer shadow-xs block text-center mt-2"
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
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => setActiveGroupId(group.id)}
                  className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                    activeGroupId === group.id
                      ? 'bg-indigo-50 border-indigo-300'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <span className="font-black text-xs text-slate-900 block">{group.name}</span>
                    <span className="text-[10px] font-bold text-slate-400">초대코드: {group.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-indigo-600 bg-white px-2 py-1 rounded-xl border border-indigo-100">
                      {group.members?.length || 1}명
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 text-center rounded-2xl text-xs font-bold text-slate-400 border border-slate-100">
              아직 참여 중인 공유 그룹이 없습니다.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
