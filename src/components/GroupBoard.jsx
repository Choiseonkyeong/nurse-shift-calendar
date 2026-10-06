import React, { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '../lib/errorText';
import { confirmDialog } from '../lib/confirm';
import { MessageSquare, Send, Trash2, RotateCcw, Repeat, Check, X } from 'lucide-react';
import {
  fetchGroupPosts,
  createGroupPost,
  deleteGroupPost,
  fetchShiftSwaps,
  createShiftSwap,
  respondShiftSwap
} from '../lib/shiftApi';
import { useShiftTypes, shiftTextVars, findShiftType } from '../lib/shiftTypes';
import { markGroupSeen } from '../lib/groupActivity';

const formatTime = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const shortDate = (key) => {
  const [, m, d] = key.split('-').map(Number);
  return `${m}/${d}`;
};
const STATUS_LABEL = { pending: '대기 중', accepted: '교환 완료', declined: '거절됨', cancelled: '취소됨' };
const STATUS_CLS = {
  pending: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-100 text-slate-400'
};
const REFRESH_MS = 60000;

/**
 * 그룹 멤버 전용 게시판 + 근무 교환 요청
 * @param getCode (profileId, dateKey) => 현재 보이는 근무 코드 (교환 미리보기용)
 * @param onSwapApplied 내 근무가 서버에서 바뀌었을 때 (교환 수락) → 내 달력 재동기화
 */
export default function GroupBoard({ group, profile, themeColor, privacyBlur, defaultDate, getCode, loadDayCodes, onSwapApplied }) {
  const shiftTypes = useShiftTypes();
  const [posts, setPosts] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [swapsAvailable, setSwapsAvailable] = useState(true);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [swapFormOpen, setSwapFormOpen] = useState(false);
  const knownAcceptedRef = useRef(null);

  const names = Object.fromEntries((group.members || []).map((m) => [m.id, m.name]));
  const blurCls = privacyBlur ? 'blur-[3px] select-none' : '';

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError('');
      const [p, s] = await Promise.all([
        fetchGroupPosts(group.id),
        fetchShiftSwaps(group.id).catch(() => null) // 서버에 교환 기능이 아직 없으면 null
      ]);
      setPosts(p);
      markGroupSeen(group.id, p[0]?.created_at);
      setSwapsAvailable(s !== null);
      const list = s || [];
      setSwaps(list);

      // 나와 관련된 교환이 새로 수락됐으면 내 근무 다시 불러오기
      const accepted = list
        .filter((x) => x.status === 'accepted' && (x.requester_id === profile.id || x.target_id === profile.id))
        .map((x) => x.id);
      if (knownAcceptedRef.current && accepted.some((id) => !knownAcceptedRef.current.has(id))) onSwapApplied?.();
      knownAcceptedRef.current = new Set(accepted);
    } catch (err) {
      setError(`게시판을 불러오지 못했어요. ${errorText(err)}`);
    }
  }, [group.id, profile, onSwapApplied]);

  // 처음 + 1분마다 + 앱으로 돌아올 때 새로고침
  useEffect(() => {
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const handleSubmit = async () => {
    if (!draft.trim() || loading) return;
    try {
      setLoading(true);
      await createGroupPost(group.id, profile.id, draft);
      setDraft('');
      await load();
    } catch (err) {
      setError(`등록하지 못했어요. ${errorText(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog({ title: '이 글을 삭제할까요?', confirmText: '삭제', danger: true }))) return;
    try {
      await deleteGroupPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(`삭제하지 못했어요. ${errorText(err)}`);
    }
  };

  const handleRespond = async (swap, action) => {
    const ask = {
      accept: { title: '교환을 수락할까요?', message: '두 사람의 근무가 바로 바뀌어요.', confirmText: '수락' },
      decline: { title: '교환 요청을 거절할까요?', confirmText: '거절', danger: true },
      cancel: { title: '교환 요청을 취소할까요?', confirmText: '요청 취소', cancelText: '그대로 두기', danger: true }
    };
    if (!(await confirmDialog(ask[action]))) return;
    try {
      setLoading(true);
      await respondShiftSwap(swap.id, action);
      if (action === 'accept') onSwapApplied?.();
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const chip = (code) =>
    code ? (
      <span style={shiftTextVars(findShiftType(shiftTypes, code))} className="shift-text font-bold">
        {code}
      </span>
    ) : (
      <span className="text-slate-300">없음</span>
    );

  const visibleSwaps = swaps.filter(
    (s) => s.status === 'pending' || Date.now() - new Date(s.decided_at || s.created_at).getTime() < 7 * 86400000
  );

  return (
    <div className="card p-5 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-[15px] text-slate-900 flex items-center gap-1.5">
          <MessageSquare size={15} style={{ color: themeColor }} /> 그룹 게시판
          <span className="text-[12px] font-normal text-slate-400">멤버만 볼 수 있어요</span>
        </h4>
        <button onClick={load} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="새로고침">
          <RotateCcw size={13} />
        </button>
      </div>

      {!profile ? (
        <p className="text-xs font-bold text-slate-400">서버에 연결되면 게시판을 사용할 수 있습니다.</p>
      ) : (
        <>
          {/* 근무 교환 */}
          {swapsAvailable && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSwapFormOpen((v) => !v)}
                style={{ color: themeColor, backgroundColor: `${themeColor}1A` }}
                className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Repeat size={13} /> {swapFormOpen ? '교환 요청 닫기' : '근무 교환 요청하기'}
              </button>

              {swapFormOpen && (
                <SwapForm
                  group={group}
                  profile={profile}
                  defaultDate={defaultDate}
                  getCode={getCode}
                  loadDayCodes={loadDayCodes}
                  chip={chip}
                  blurCls={blurCls}
                  onDone={async () => {
                    setSwapFormOpen(false);
                    await load();
                  }}
                  onError={setError}
                />
              )}

              {visibleSwaps.map((s) => {
                const mine = s.requester_id === profile.id;
                const toMe = s.target_id === profile.id;
                return (
                  <div key={s.id} className="p-3 rounded-2xl bg-slate-50 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] font-semibold text-slate-700 ${blurCls}`}>
                        {names[s.requester_id] || '알 수 없음'} → {names[s.target_id] || '알 수 없음'}
                      </span>
                      <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-lg ${STATUS_CLS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    </div>
                    {s.dates.map((d) => (
                      <div key={d} className="flex items-center gap-1.5 text-[13px] text-slate-600">
                        <span className="w-10">{shortDate(d)}</span>
                        {chip(s.snapshot?.[d]?.requester)} <span className="text-slate-300">⇄</span> {chip(s.snapshot?.[d]?.target)}
                      </div>
                    ))}
                    {s.message && <p className="text-[13px] text-slate-500 break-words">“{s.message}”</p>}
                    {s.status === 'pending' && (toMe || mine) && (
                      <div className="flex gap-1.5 pt-0.5">
                        {toMe && (
                          <>
                            <button
                              onClick={() => handleRespond(s, 'accept')}
                              disabled={loading}
                              className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Check size={12} /> 수락
                            </button>
                            <button
                              onClick={() => handleRespond(s, 'decline')}
                              disabled={loading}
                              className="flex-1 h-10 rounded-xl bg-white text-slate-600 text-[13px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <X size={12} /> 거절
                            </button>
                          </>
                        )}
                        {mine && (
                          <button
                            onClick={() => handleRespond(s, 'cancel')}
                            disabled={loading}
                            className="flex-1 h-10 rounded-xl bg-white text-slate-500 text-[13px] font-semibold cursor-pointer"
                          >
                            요청 취소
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="공지, 회식 일정 등을 남겨 보세요"
              aria-label="게시글 내용"
              className="flex-1 px-3 py-2 bg-slate-100 rounded-2xl text-xs font-bold outline-none resize-none focus:border-indigo-300"
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
            {posts.length === 0 && <p className="text-xs font-bold text-slate-300 text-center py-3">아직 글이 없습니다.</p>}
            {posts.map((p) => (
              <div key={p.id} className="p-3 bg-slate-50 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[13px] font-semibold text-slate-700 ${blurCls}`}>{names[p.author_id] || '알 수 없음'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-400">{formatTime(p.created_at)}</span>
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

/** 교환 요청 입력: 상대 + 날짜 1~2개 (+ 메시지) */
function SwapForm({ group, profile, defaultDate, getCode, loadDayCodes, chip, blurCls, onDone, onError }) {
  const others = (group.members || []).filter((m) => m.id !== profile.id);
  const [targetId, setTargetId] = useState(others[0]?.id || '');
  const [date1, setDate1] = useState(defaultDate || '');
  const [date2, setDate2] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // 고른 날짜의 동료 근무는 서버에서 직접 확인 (그룹 달력에 보이는 달이 아니어도 정확한 미리보기)
  const [dayCodes, setDayCodes] = useState({}); // { 'YYYY-MM-DD': { profileId: code } }
  useEffect(() => {
    if (!loadDayCodes) return undefined;
    let alive = true;
    [date1, date2]
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !dayCodes[d])
      .forEach((d) =>
        loadDayCodes(d)
          .then((codes) => alive && setDayCodes((prev) => ({ ...prev, [d]: codes })))
          .catch(() => {})
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date1, date2, loadDayCodes]);
  const codeOf = (pid, d) => (pid !== profile.id && dayCodes[d] ? dayCodes[d][pid] || '' : getCode(pid, d));

  if (!others.length) {
    return <p className="text-xs font-bold text-slate-400 px-1">교환할 다른 멤버가 없습니다. 초대 코드를 공유해 보세요.</p>;
  }

  const dates = [...new Set([date1, date2].filter(Boolean))].sort();
  const submit = async () => {
    try {
      setBusy(true);
      await createShiftSwap(group.id, targetId, dates, message);
      await onDone();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 rounded-2xl bg-slate-50 space-y-2 text-xs font-bold text-slate-600">
      <label className="flex items-center justify-between gap-2">
        <span className="shrink-0">교환할 사람</span>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className={`min-w-0 flex-1 bg-slate-100 rounded-xl px-3 h-10 font-semibold ${blurCls}`}
        >
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {[
        [date1, setDate1, '날짜'],
        [date2, setDate2, '추가 날짜']
      ].map(([value, setter, label]) => (
        <div key={label} className="space-y-1">
          <label className="flex items-center gap-2">
            <span className="shrink-0 w-16">{label}</span>
            <input
              type="date"
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="min-w-0 flex-1 bg-slate-100 rounded-xl px-2 py-1 font-bold"
            />
          </label>
          {value ? (
            <span className="flex items-center gap-1 pl-[72px]">
              나 {chip(codeOf(profile.id, value))} ⇄ {chip(codeOf(targetId, value))}
            </span>
          ) : (
            label !== '날짜' && <span className="block pl-[72px] text-[10px] text-slate-400">하루 더 바꿀 때만 (선택)</span>
          )}
        </div>
      ))}
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={200}
        placeholder="메시지 (선택) 예: 가족 행사가 있어서요 🙏"
        className="w-full bg-slate-100 rounded-xl px-3 py-2 font-bold outline-none"
      />
      <p className="text-[10px] text-slate-400">상대가 수락하면 두 사람의 해당 날짜 근무가 서로 바뀌어요.</p>
      <button
        type="button"
        onClick={submit}
        disabled={busy || !targetId || !dates.length}
        className="w-full h-11 rounded-xl bg-blue-600 text-white text-[14px] font-semibold disabled:opacity-40 cursor-pointer"
      >
        교환 요청 보내기
      </button>
    </div>
  );
}
