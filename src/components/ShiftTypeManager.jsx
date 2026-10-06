import React, { useState } from 'react';
import { errorText } from '../lib/errorText';
import { confirmDialog } from '../lib/confirm';
import Modal from './Modal';
import { X, Plus, ChevronLeft, Trash2, Check } from 'lucide-react';
import { useShiftTypes, DEFAULT_CODES, shiftTextVars } from '../lib/shiftTypes';

// 파스텔 색상 팔레트 (배경 / 글자)
export const PALETTE = [
  ['#FEF08A', '#854D0E'], ['#FFEDD5', '#9A3412'], ['#E0F2FE', '#0369A1'], ['#F3E8FF', '#6B21A8'],
  ['#F1F5F9', '#475569'], ['#FFE4E6', '#E11D48'], ['#DCFCE7', '#166534'], ['#CCFBF1', '#115E59'],
  ['#E0E7FF', '#3730A3'], ['#FEF3C7', '#92400E'], ['#ECFCCB', '#3F6212'], ['#FCE7F3', '#9D174D']
];

const KINDS = [
  { value: 'work', label: '근무' },
  { value: 'off', label: '휴무' },
  { value: 'leave', label: '휴가' }
];

const EMPTY = { code: '', label: '', kind: 'work', bg: PALETTE[6][0], fg: PALETTE[6][1], start: '', end: '', leaveDays: 1 };

/**
 * 근무 종류 관리 (추가 / 이름·색상·시간 수정 / 삭제)
 * - 기본 근무(D/E/N/M/OFF/연차)는 코드 변경·삭제 불가
 */
export default function ShiftTypeManager({ onClose, onSave, onDelete, usedDays = () => 0 }) {
  const shiftTypes = useShiftTypes();
  const [editing, setEditing] = useState(null); // null = 목록, 객체 = 편집 폼
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');

  const openEdit = (t) => {
    setError('');
    setIsNew(!t);
    setEditing(t ? { ...EMPTY, ...t } : { ...EMPTY });
  };

  const set = (field, value) => setEditing((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const code = editing.code.trim();
    if (!code) return setError('근무 코드를 입력해 주세요.');
    if (code.length > 4) return setError('근무 코드는 4자 이내로 입력해 주세요.');
    if (isNew && shiftTypes.some((t) => t.code === code)) return setError('이미 있는 근무 코드입니다.');
    if (editing.kind === 'work' && (!!editing.start !== !!editing.end)) {
      return setError('시작·종료 시각을 모두 입력하거나 모두 비워 주세요.');
    }
    try {
      await onSave({
        ...editing,
        code,
        label: editing.label.trim() || code,
        start: editing.kind === 'work' ? editing.start : '',
        end: editing.kind === 'work' ? editing.end : '',
        leaveDays: editing.kind === 'leave' ? Number(editing.leaveDays) || 1 : undefined
      });
      setEditing(null);
    } catch (err) {
      setError(errorText(err, '저장하지 못했어요.'));
    }
  };

  const handleDelete = async () => {
    // 달력에 입력된 날짜가 있으면 그 날짜들을 빈칸으로 만들고 함께 삭제 (하나씩 지우지 않아도 되게)
    const days = usedDays(editing.code);
    const ok = await confirmDialog({
      title: `'${editing.code}' 근무를 삭제할까요?`,
      message: days ? `달력에 입력된 ${days}일의 '${editing.code}' 근무도 함께 지워져요.` : '',
      confirmText: '삭제',
      danger: true
    });
    if (!ok) return;
    try {
      await onDelete(editing.code, { clear: days > 0 });
      setEditing(null);
    } catch (err) {
      setError(errorText(err, '삭제하지 못했어요.'));
    }
  };

  // 하단 탭바보다 위에 뜨도록 body 에 렌더링
  return (
    // 추가·수정 화면에서 Esc·뒤로가기 → 목록으로, 목록에서 → 닫기
    <Modal onClose={editing ? () => setEditing(null) : onClose} label="근무 종류 관리">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl max-h-[85dvh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            {editing && (
              <button onClick={() => setEditing(null)} className="p-1 -ml-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="목록으로">
                <ChevronLeft size={22} />
              </button>
            )}
            <h3 className="text-[20px] font-bold text-slate-900">
              {editing ? (isNew ? '새 근무 추가' : `'${editing.code}' 수정`) : '근무 종류 관리'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        {!editing && (
          <>
            <div className="rounded-2xl bg-slate-50 px-4 divide-y divide-slate-200/60">
              {shiftTypes.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => openEdit(t)}
                  className="w-full flex items-center gap-3 py-3 cursor-pointer text-left"
                >
                  <span style={shiftTextVars(t)} className="shift-text w-12 shrink-0 text-[17px] font-bold truncate">
                    {t.code}
                  </span>
                  <span className="flex-1 text-[15px] text-slate-800 truncate">{t.label}</span>
                  <span className="text-[12px] text-slate-400 whitespace-nowrap">
                    {KINDS.find((k) => k.value === t.kind)?.label}
                    {t.kind === 'work' && t.start ? ` · ${t.start}~${t.end}` : ''}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openEdit(null)}
              className="w-full h-12 rounded-xl bg-blue-600 text-white text-[15px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus size={18} /> 새 근무 추가 (교육, 반차, 당직 등)
            </button>
          </>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <span style={{ backgroundColor: editing.bg, color: editing.fg }} className="min-w-[4rem] text-center px-6 py-2.5 rounded-2xl text-[20px] font-bold">
                {editing.code || '코드'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className="text-[13px] text-slate-400">코드</span>
                <input
                  value={editing.code}
                  disabled={!isNew}
                  maxLength={4}
                  onChange={(e) => set('code', e.target.value)}
                  placeholder="예: 교"
                  className="w-full px-3 h-11 bg-slate-100 rounded-xl text-[15px] font-bold text-center outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
                />
              </label>
              <label className="space-y-1 col-span-2">
                <span className="text-[13px] text-slate-400">이름</span>
                <input
                  value={editing.label}
                  onChange={(e) => set('label', e.target.value)}
                  placeholder="예: 교육"
                  className="w-full px-3 h-11 bg-slate-100 rounded-xl text-[15px] outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
            </div>

            <div className="space-y-1">
              <span className="text-[13px] text-slate-400">분류</span>
              <div className="grid grid-cols-3 gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    disabled={!isNew && DEFAULT_CODES.has(editing.code)}
                    onClick={() => set('kind', k.value)}
                    className={`h-10 rounded-xl text-[14px] font-medium cursor-pointer disabled:cursor-not-allowed ${
                      editing.kind === k.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            {editing.kind === 'work' && (
              <div className="space-y-1">
                <span className="text-[13px] text-slate-400">근무 시간 (알림·수당 계산에 사용)</span>
                <div className="flex items-center gap-2">
                  <input type="time" value={editing.start || ''} onChange={(e) => set('start', e.target.value)}
                    className="flex-1 min-w-0 px-2 h-11 bg-slate-100 rounded-xl text-[14px] text-center outline-none" />
                  <span className="text-slate-300">~</span>
                  <input type="time" value={editing.end || ''} onChange={(e) => set('end', e.target.value)}
                    className="flex-1 min-w-0 px-2 h-11 bg-slate-100 rounded-xl text-[14px] text-center outline-none" />
                </div>
              </div>
            )}

            {editing.kind === 'leave' && (
              <label className="flex items-center justify-between">
                <span className="text-[13px] text-slate-400">연차 차감 (일)</span>
                <select
                  value={editing.leaveDays ?? 1}
                  onChange={(e) => set('leaveDays', Number(e.target.value))}
                  className="px-3 h-10 bg-slate-100 rounded-xl text-[14px] outline-none"
                >
                  <option value={1}>1일 (연차)</option>
                  <option value={0.5}>0.5일 (반차)</option>
                  <option value={0.25}>0.25일 (반반차)</option>
                  <option value={0}>차감 안 함 (병가·경조 등)</option>
                </select>
              </label>
            )}

            <div className="space-y-1">
              <span className="text-[13px] text-slate-400">색상</span>
              <div className="grid grid-cols-6 gap-2">
                {PALETTE.map(([bg, fg]) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setEditing((prev) => ({ ...prev, bg, fg }))}
                    style={{ backgroundColor: bg, color: fg }}
                    className={`h-10 rounded-full text-[11px] font-bold flex items-center justify-center cursor-pointer ${
                      editing.bg === bg ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                    }`}
                    aria-label={`색상 ${bg}`}
                  >
                    {editing.bg === bg ? <Check size={14} /> : 'A'}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-[13px] text-rose-500">{error}</p>}

            <div className="flex gap-2 pt-1">
              {!isNew && !DEFAULT_CODES.has(editing.code) && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 h-12 rounded-xl bg-rose-50 text-rose-600 text-[15px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={13} /> 삭제
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 h-12 rounded-xl bg-blue-600 text-white text-[15px] font-semibold cursor-pointer"
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
