import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, Trash2, RotateCcw } from 'lucide-react';
import { fetchGroupPosts, createGroupPost, deleteGroupPost } from '../lib/shiftApi';

const formatTime = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 그룹 멤버 전용 비공개 게시판 */
export default function GroupBoard({ group, profile, themeColor, privacyBlur }) {
  const [posts, setPosts] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const names = Object.fromEntries((group.members || []).map((m) => [m.id, m.name]));
  const blurCls = privacyBlur ? 'blur-[3px] select-none' : '';

  const load = async () => {
    if (!profile) return;
    try {
      setError('');
      setPosts(await fetchGroupPosts(group.id));
    } catch (err) {
      setError(`게시글을 불러오지 못했습니다: ${err.message}`);
    }
  };

  useEffect(() => {
    load();
  }, [group.id, profile?.id]);

  const handleSubmit = async () => {
    if (!draft.trim() || loading) return;
    try {
      setLoading(true);
      await createGroupPost(group.id, profile.id, draft);
      setDraft('');
      await load();
    } catch (err) {
      setError(`등록하지 못했습니다: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 글을 삭제할까요?')) return;
    try {
      await deleteGroupPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(`삭제하지 못했습니다: ${err.message}`);
    }
  };

  return (
    <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
          <MessageSquare size={15} style={{ color: themeColor }} /> 그룹 게시판
          <span className="text-[10px] font-bold text-slate-400">멤버만 볼 수 있어요</span>
        </h4>
        <button onClick={load} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="새로고침">
          <RotateCcw size={13} />
        </button>
      </div>

      {!profile ? (
        <p className="text-xs font-bold text-slate-400">서버에 연결되면 게시판을 사용할 수 있습니다.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="근무 교환, 공지, 회식 일정 등을 남겨 보세요"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none resize-none focus:border-indigo-300"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!draft.trim() || loading}
              style={{ backgroundColor: themeColor }}
              className="self-stretch px-3 rounded-2xl text-white disabled:opacity-40 cursor-pointer"
              aria-label="등록"
            >
              <Send size={15} />
            </button>
          </div>

          {error && <p className="text-xs font-bold text-rose-500">{error}</p>}

          <div className="space-y-2">
            {posts.length === 0 && (
              <p className="text-xs font-bold text-slate-300 text-center py-3">아직 글이 없습니다.</p>
            )}
            {posts.map((p) => (
              <div key={p.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black text-slate-700 ${blurCls}`}>
                    {names[p.author_id] || '알 수 없음'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">{formatTime(p.created_at)}</span>
                    {p.author_id === profile.id && (
                      <button onClick={() => handleDelete(p.id)} className="text-slate-300 hover:text-rose-500 cursor-pointer" aria-label="삭제">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-700 whitespace-pre-wrap break-words">{p.body}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
