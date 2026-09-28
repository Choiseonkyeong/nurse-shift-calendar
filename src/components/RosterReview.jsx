import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { useShiftTypes, badgeStyle } from '../lib/shiftTypes';

const pad = (n) => String(n).padStart(2, '0');

/**
 * 사진 인식 결과 확인/수정 화면
 * result: { year, month, people: { 이름: { 날짜: { code, confidence } } }, names }
 */
export default function RosterReview({ result, defaultName, onApply, onClose }) {
  const shiftTypes = useShiftTypes();
  const [name, setName] = useState(
    result.names.includes(defaultName) ? defaultName : result.names.length === 1 ? result.names[0] : ''
  );
  const [ym, setYm] = useState(`${result.year}-${pad(result.month)}`);
  const [edits, setEdits] = useState({}); // { 이름: { day: code|'' } }

  const [year, month] = ym.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();

  // 인식 결과는 인식된 연/월 기준 날짜 → 일(day) 로 변환해 연/월을 바꿔도 따라가게
  const recognized = useMemo(() => {
    const byDay = {};
    Object.entries(result.people[name] || {}).forEach(([key, v]) => {
      const [, m, d] = key.split('-').map(Number);
      if (m === result.month) byDay[d] = v;
    });
    return byDay;
  }, [result, name]);

  const cellCode = (d) => {
    const e = edits[name]?.[d];
    if (e !== undefined) return e;
    return recognized[d]?.code || '';
  };
  const unreadDays = useMemo(
    () =>
      new Set(
        (result.unread?.[name] || [])
          .map((key) => key.split('-').map(Number))
          .filter(([, m]) => m === result.month)
          .map(([, , d]) => d)
      ),
    [result, name]
  );
  const isUnread = (d) => edits[name]?.[d] === undefined && unreadDays.has(d);
  const isUnsure = (d) =>
    isUnread(d) || (edits[name]?.[d] === undefined && recognized[d] && recognized[d].confidence < 60);

  const setCell = (d, code) => setEdits((prev) => ({ ...prev, [name]: { ...(prev[name] || {}), [d]: code } }));

  const filled = Array.from({ length: lastDay }, (_, i) => cellCode(i + 1)).filter(Boolean).length;
  const unsure = Array.from({ length: lastDay }, (_, i) => isUnsure(i + 1)).filter(Boolean).length;

  const handleApply = () => {
    const shifts = {};
    for (let d = 1; d <= lastDay; d++) {
      const code = cellCode(d);
      if (code) shifts[`${year}-${pad(month)}-${pad(d)}`] = code;
    }
    onApply({ name, shifts, yearMonth: ym });
  };

  // 하단 탭바보다 위에 뜨도록 body 에 렌더링
  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 z-[100]"
      style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom, 0px))' }}
    >
      <div className="bg-white rounded-3xl p-4 max-w-md w-full space-y-3 shadow-xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-extrabold text-sm text-slate-900">인식 결과 확인</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="닫기">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="month"
            value={ym}
            onChange={(e) => e.target.value && setYm(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none"
          />
          <span className="text-[11px] font-bold text-slate-400">연/월이 다르면 바꿔 주세요</span>
        </div>

        <div>
          <p className="text-[11px] font-black text-slate-500 mb-1.5">본인 이름 선택 ({result.names.length}명 인식)</p>
          <div className="flex flex-wrap gap-1.5">
            {result.names.map((n) => (
              <button
                key={n}
                onClick={() => setName(n)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  n === name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {name && (
          <>
            {unsure > 0 && (
              <p className="text-[11px] font-bold text-amber-700 bg-amber-50 rounded-xl px-3 py-2 flex items-center gap-1.5">
                <AlertTriangle size={13} /> 노란 칸 {unsure}개는 인식이 불확실하거나(?) 읽지 못했어요. 사진과 비교해 확인해 주세요.
              </p>
            )}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
                <div key={w} className={`text-[10px] font-black ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : 'text-slate-400'}`}>
                  {w}
                </div>
              ))}
              {Array.from({ length: firstDow }, (_, i) => (
                <div key={`b${i}`} />
              ))}
              {Array.from({ length: lastDay }, (_, i) => {
                const d = i + 1;
                const code = cellCode(d);
                return (
                  <label
                    key={d}
                    className={`relative rounded-xl border p-0.5 ${isUnsure(d) ? 'border-amber-400 bg-amber-50' : 'border-slate-100'}`}
                  >
                    <span className="block text-[9px] font-bold text-slate-400 leading-tight">{d}</span>
                    <span
                      style={code ? badgeStyle(shiftTypes, code) : undefined}
                      className="block text-[11px] font-black rounded-lg py-0.5 min-h-[20px]"
                    >
                      {code || (isUnread(d) ? '?' : '·')}
                    </span>
                    <select
                      value={code}
                      onChange={(e) => setCell(d, e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      aria-label={`${d}일 근무`}
                    >
                      <option value="">없음</option>
                      {shiftTypes.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.code}
                          {t.label && t.label !== t.code ? ` (${t.label})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] font-bold text-slate-400">칸을 누르면 근무를 고칠 수 있어요.</p>
          </>
        )}

        <button
          onClick={handleApply}
          disabled={!name || filled === 0}
          className="w-full py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40 cursor-pointer"
        >
          {name ? `${month}월 근무 ${filled}일 내 달력에 저장` : '이름을 선택해 주세요'}
        </button>
      </div>
    </div>,
    document.body
  );
}
