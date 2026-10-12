import React, { useRef, useState } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { joinItems, moveItem, MAX_NOTE } from '../lib/dayItems';

/**
 * 날짜 일정·메모 목록 편집: 추가 · 고치기 · 지우기 · 손잡이를 끌어 순서 바꾸기
 * items 는 이 창 안에서만 들고 있다가 바뀔 때마다 onChange(글 하나) 로 저장
 */
export default function DayItemsEditor({ initial = [], onChange }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const update = (next) => {
    setItems(next);
    onChange(joinItems(next));
  };
  const used = joinItems(items).length;
  const room = MAX_NOTE - used - (items.length ? 1 : 0);

  const add = () => {
    const text = draft.trim();
    if (!text || text.length > room) return;
    update([...items, text]);
    setDraft('');
    inputRef.current?.focus();
  };

  // 끌어서 순서 바꾸기: 손가락이 다른 줄의 가운데를 넘으면 그 자리로
  const onGripDown = (e, idx) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragIdx(idx);
  };
  const onGripMove = (e) => {
    if (dragIdx === null || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll('[data-item-row]')];
    let to = dragIdx;
    rows.forEach((row, i) => {
      const r = row.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (i < dragIdx && e.clientY < mid) to = Math.min(to, i);
      if (i > dragIdx && e.clientY > mid) to = Math.max(to, i);
    });
    if (to !== dragIdx) {
      update(moveItem(items, dragIdx, to));
      setDragIdx(to);
    }
  };
  const onGripUp = () => setDragIdx(null);
  const onGripKey = (e, idx) => {
    const to = e.key === 'ArrowUp' ? idx - 1 : e.key === 'ArrowDown' ? idx + 1 : null;
    if (to === null || to < 0 || to >= items.length) return;
    e.preventDefault();
    update(moveItem(items, idx, to));
    requestAnimationFrame(() => listRef.current?.querySelectorAll('[data-grip]')[to]?.focus());
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-slate-400">일정·메모 (나만 보기)</span>
        {items.length > 1 && <span className="text-[12px] text-slate-400">⠿ 를 끌어 순서 바꾸기</span>}
      </div>

      {items.length > 0 && (
        <ul ref={listRef} className="rounded-xl bg-slate-100 divide-y divide-slate-200/70 overflow-hidden">
          {items.map((text, i) => (
            <li
              key={i}
              data-item-row
              className={`flex items-center gap-1 pr-1 transition-colors ${dragIdx === i ? 'bg-blue-50 shadow-inner' : ''}`}
            >
              <button
                type="button"
                data-grip
                aria-label={`${i + 1}번째 일정 순서 바꾸기 (위·아래 화살표)`}
                onPointerDown={(e) => onGripDown(e, i)}
                onPointerMove={onGripMove}
                onPointerUp={onGripUp}
                onPointerCancel={onGripUp}
                onKeyDown={(e) => onGripKey(e, i)}
                className="shrink-0 w-10 h-11 flex items-center justify-center text-slate-400 touch-none cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={18} />
              </button>
              <input
                value={text}
                aria-label={`${i + 1}번째 일정`}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  setItems(next);
                  onChange(joinItems(next));
                }}
                onBlur={() => !text.trim() && update(items.filter((_, j) => j !== i))}
                className="flex-1 min-w-0 h-11 bg-transparent text-[15px] text-slate-800 outline-none"
              />
              <button
                type="button"
                aria-label={`${text} 지우기`}
                onClick={() => update(items.filter((_, j) => j !== i))}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          maxLength={Math.max(room, 0)}
          aria-label="일정·메모 추가"
          placeholder={items.length ? '일정 더 넣기' : '예: 교육, 회식, 인계 사항'}
          className="flex-1 min-w-0 h-11 px-3 bg-slate-100 rounded-xl text-[15px] text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || room <= 0}
          aria-label="추가"
          className="shrink-0 w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer"
        >
          <Plus size={20} />
        </button>
      </div>
      {room < 60 && <p className="text-[12px] text-amber-700">{room > 0 ? `${room}자 더 쓸 수 있어요.` : '이 날짜는 더 넣을 수 없어요. (최대 500자)'}</p>}
    </div>
  );
}
