import React, { useState, useEffect } from 'react';
import { Users, Plus, LogIn, ChevronLeft, Copy, LogOut, Trash2, RotateCcw, Palette } from 'lucide-react';
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
  userName,
  myShifts = {}
}) {
  const [selectedDayKey, setSelectedDayKey] = useState(selectedDate || '2026-09-07');
  const [year, month] = (selectedDate || '2026-09-01').split('-').map(Number);
  const [loading, setLoading] = useState(false);

  // 기본 추천 색상 5종 + 무한 커스텀 컬러 선택
  const DEFAULT_COLORS = ['#6366F1', '#A855F7', '#10B981', '#F43F5E', '#F59E0B', '#0284C7', '#EC4899'];
  
  // 새 그룹 생성 시 기본선택 커스텀 색상
  const [selectedColor, setSelectedColor] = useState('#6366F1');

  const currentGroup = (groups || []).find((g) => g.id === activeGroupId) || null;
  const currentThemeBg = currentGroup?.color || '#6366F1';

  // 내가 참여 중인 그룹 목록 DB 조회
  const fetchMyGroupsFromDB = async () => {
    if (!userName) return;
    try {
      setLoading(true);

      const { data: myRows, error: myError } = await supabase
        .from('group_shifts')
        .select('group_code')
        .eq('user_name', userName);

      if (myError) throw myError;

      if (!myRows || myRows.length === 0) {
        setGroups([]);
        return;
      }

      const myGroupCodes = [...new Set(myRows.map((r) => r.group_code))];

      const { data: groupData, error: groupError } = await supabase
        .from('group_shifts')
        .select('*')
        .in('group_code', myGroupCodes);

      if (groupError) throw groupError;

      if (groupData) {
        const groupMap = {};
        groupData.forEach((row) => {
          const code = row.group_code;
          if (!groupMap[code]) {
            groupMap[code] = {
              id: code,
              name: row.group_name,
              code: code,
              color: row.color || '#6366F1', // 자유 HEX 코드 연동
              members: []
            };
          }
          groupMap[code].members.push({
            id: row.id,
            name: row.user_name,
            shifts: typeof row.shifts === 'string' ? JSON.parse(row.shifts || '{}') : (row.shifts || {})
          });
        });

        setGroups(Object.values(groupMap));
      }
    } catch (err) {
      console.error('Supabase fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyGroupsFromDB();
  }, [userName]);

  // 1. 새 그룹 생성
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      alert('그룹 이름을 입력해 주세요.');
      return;
    }

    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRow = {
      group_code: randomCode,
      group_name: newGroupName.trim(),
      user_name: userName || '홍숙언',
      shifts: myShifts || {},
      color: selectedColor
    };

    try {
      setLoading(true);
      const { error } = await supabase.from('group_shifts').insert([newRow]);
      if (error) throw error;

      await fetchMyGroupsFromDB();
      setActiveGroupId(randomCode);
      setNewGroupName('');
      alert(`🎉 '${newRow.group_name}' 그룹이 생성되었습니다!`);
    } catch (err) {
      alert(`그룹 생성 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. 코드로 그룹 입장
  const handleJoinGroup = async () => {
    if (!joinCodeInput.trim()) {
      alert('6자리 초대 코드를 입력해 주세요.');
      return;
    }

    const code = joinCodeInput.trim().toUpperCase();

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('group_shifts')
        .select('*')
        .eq('group_code', code);

      if (error || !data || data.length === 0) {
        alert('해당 초대 코드와 일치하는 그룹이 없습니다.');
        return;
      }

      const groupName = data[0].group_name;
      const groupColor = data[0].color || '#6366F1';
      const isAlreadyMember = data.some((m) => m.user_name === userName);

      if (!isAlreadyMember) {
        const newRow = {
          group_code: code,
          group_name: groupName,
          user_name: userName || '최수민',
          shifts: myShifts || {},
          color: groupColor
        };

        const { error: insertError } = await supabase.from('group_shifts').insert([newRow]);
        if (insertError) throw insertError;
      }

      await fetchMyGroupsFromDB();
      setActiveGroupId(code);
      setJoinCodeInput('');
      alert(`🎉 '${groupName}' 그룹에 참여했습니다!`);
    } catch (err) {
      alert(`그룹 참여 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. 기존 그룹 색상 커스텀 변경
  const handleChangeGroupColor = async (groupCode, hexColor) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('group_shifts')
        .update({ color: hexColor })
        .eq('group_code', groupCode);

      if (error) throw error;
      await fetchMyGroupsFromDB();
    } catch (err) {
      alert(`색상 변경 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. 코드 복사
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`초대 코드 [ ${code} ] 가 클립보드에 복사되었습니다!`);
  };

  // 5. 그룹 나가기
  const handleLeaveGroup = async (groupCode) => {
    if (!window.confirm('정말 이 그룹에서 나가시겠습니까?')) return;
    try {
      const { error } = await supabase
        .from('group_shifts')
        .delete()
        .eq('group_code', groupCode)
        .eq('user_name', userName);

      if (error) throw error;
      await fetchMyGroupsFromDB();
      setActiveGroupId(null);
    } catch (err) {
      alert(`그룹 나가기 실패: ${err.message}`);
    }
  };

  // 6. 그룹 삭제
  const handleDeleteGroup = async (groupCode) => {
    if (!window.confirm('정말 이 그룹 전체를 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase
        .from('group_shifts')
        .delete()
        .eq('group_code', groupCode);

      if (error) throw error;
      await fetchMyGroupsFromDB();
      setActiveGroupId(null);
    } catch (err) {
      alert(`그룹 삭제 실패: ${err.message}`);
    }
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
      
      {/* 1. 공유 그룹 목록 관리 화면 */}
      {!currentGroup && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-4">
            
            <div className="flex justify-between items-center">
              <h2 className="text-base font-black text-indigo-950 flex items-center gap-2">
                <Users size={18} className="text-indigo-600" /> 어플 내 공유 그룹 관리
              </h2>
              <button
                onClick={fetchMyGroupsFromDB}
                className="text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} /> 새로고침
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 items-stretch">
              
              {/* 새 그룹 생성 (무한 커스텀 컬러 선택기) */}
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

                  {/* 추천 색상 + 무한 팔레트 (컬러 피커) */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      {DEFAULT_COLORS.slice(0, 4).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-4 h-4 rounded-full transition cursor-pointer ${
                            selectedColor === c ? 'ring-2 ring-offset-1 ring-slate-800 scale-110' : 'opacity-70'
                          }`}
                        />
                      ))}
                    </div>

                    {/* 무한 커스텀 컬러 피커 버튼 */}
                    <label className="relative flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 shadow-2xs cursor-pointer hover:scale-105 transition" style={{ backgroundColor: selectedColor }}>
                      <Palette size={11} className="text-white drop-shadow-md" />
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCreateGroup}
                  style={{ backgroundColor: selectedColor }}
                  className="w-full py-2.5 text-white font-black text-xs rounded-2xl transition cursor-pointer shadow-xs"
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
                      style={{ backgroundColor: g.color || '#6366F1' }}
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

      {/* 2. 그룹 상세 스케줄 비교 화면 */}
      {currentGroup && (
        <div className="space-y-4">
          
          <button
            onClick={() => setActiveGroupId(null)}
            style={{ color: currentThemeBg }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200/80 rounded-2xl text-xs font-black hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <ChevronLeft size={16} /> 전체 그룹 목록으로 돌아가기
          </button>

          {/* 그룹 상세 헤더 (무한 팔레트 색상 동적 스위치) */}
          <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">{currentGroup.name}</h2>
                  
                  {/* 무한 팔레트 커스텀 스위치 */}
                  <label className="relative flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 shadow-2xs cursor-pointer hover:scale-110 transition" style={{ backgroundColor: currentThemeBg }}>
                    <Palette size={11} className="text-white drop-shadow-md" />
                    <input
                      type="color"
                      value={currentThemeBg}
                      onChange={(e) => handleChangeGroupColor(currentGroup.code, e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                </div>
                <p className="text-xs font-bold text-slate-400 mt-0.5">초대 코드: {currentGroup.code}</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleLeaveGroup(currentGroup.code)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-extrabold border border-slate-200 cursor-pointer"
                >
                  나가기
                </button>
                <button
                  onClick={() => handleDeleteGroup(currentGroup.code)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-extrabold border border-rose-200 cursor-pointer"
                >
                  삭제
                </button>
              </div>
            </div>

            <button
              onClick={() => handleCopyCode(currentGroup.code)}
              style={{ backgroundColor: `${currentThemeBg}15`, color: currentThemeBg, borderColor: `${currentThemeBg}30` }}
              className="w-full py-2.5 border rounded-2xl flex items-center justify-center gap-1.5 text-xs font-extrabold cursor-pointer"
            >
              <Copy size={13} /> 코드: {currentGroup.code} 복사하기
            </button>
          </div>

          <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-black text-base text-slate-900">
                {year}년 {month}월 그룹 근무표
              </h3>
              <button onClick={fetchMyGroupsFromDB} className="text-slate-400 hover:text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer">
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

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((item, idx) => {
                if (!item) return <div key={`empty_${idx}`} className="min-h-[70px]"></div>;
                const isSelected = selectedDayKey === item.dateKey;

                return (
                  <div
                    key={item.dateKey}
                    onClick={() => setSelectedDayKey(item.dateKey)}
                    style={
                      isSelected
                        ? { borderColor: currentThemeBg, backgroundColor: `${currentThemeBg}15` }
                        : {}
                    }
                    className={`min-h-[70px] p-1 rounded-2xl border transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-offset-1'
                        : 'border-slate-100 bg-slate-50/30 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[11px] font-black text-slate-700 px-1">{item.day}</span>

                    <div className="space-y-0.5 mt-1">
                      {currentGroup.members?.map((member) => {
                        const shift = member.shifts?.[item.dateKey] || 'OFF';
                        const badgeStyle = getBadgeStyle(shift);
                        const displayName = member.name?.length > 2 ? member.name.substring(0, 2) : member.name;

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

          <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <h4 className="font-black text-xs text-slate-800 flex items-center gap-1">
              📌 <span style={{ color: currentThemeBg }}>{selectedDayKey}</span> 선택 일자 상세 근무
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
                    <span style={badgeStyle} className="px-3 py-1 rounded-xl font-black text-xs">
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
