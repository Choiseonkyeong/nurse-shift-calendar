import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, RotateCcw } from 'lucide-react';
import Modal from './Modal';
import { useShiftTypes, shiftTextVars, displayCode, findShiftType } from '../lib/shiftTypes';
import { loadAliases, saveAliases, withAliases } from '../lib/codeAliases';
import { errorText } from '../lib/errorText';

// 사진 인식 코드는 이 창을 열 때만 불러옴
const ocr = () => import('../lib/rosterOcr');
const WD = '일월화수목금토';
const pad = (n) => String(n).padStart(2, '0');
const dateOf = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8)));
// '기호1'처럼 이번 사진에서만 붙인 이름은 다음 달에 같은 모양이라는 보장이 없어 기억하지 않음
const rememberable = (token) => token && !/^기호\d+$/.test(token);

/**
 * 내 줄만 골라 읽기 → 확인·수정 → 등록
 *  1) 사진에서 날짜 줄(1 2 3 …)과 내 줄을 차례로 누름
 *  2) 날짜마다 사진 속 칸과 읽은 근무를 나란히 보여 줌. 칸을 눌러 근무를 고르면 같은 표시 칸이 한꺼번에 바뀜
 *  3) 고른 표기(X → OFF 등)는 기억 → 다음 달부터 자동
 * @param file     근무표 사진
 * @param notice   열 때 보여 줄 안내 (표 전체를 못 읽은 이유 등)
 * @param onDone   ({ yearMonth, shifts }) 등록
 */
export default function RowPickSheet({ file, notice = '', year, month, onDone, onClose }) {
  const shiftTypes = useShiftTypes();
  const [photo, setPhoto] = useState(null); // { url, w, h }
  const canvasRef = useRef(null);
  const [dateBand, setDateBand] = useState(null); // [top, bottom] (사진 좌표)
  const [rowBand, setRowBand] = useState(null);
  const [reading, setReading] = useState(null); // { p, msg }
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // readMyRow 결과
  const [values, setValues] = useState({}); // 날짜: 근무 코드 ('' = 비움)
  const [picked, setPicked] = useState({}); // 날짜: 사용자가 직접 고른 칸
  const [selected, setSelected] = useState(null);
  const abortRef = useRef(null);
  const dateRef = useRef(null); // 날짜 줄 (연달아 빨리 눌러도 두 번째가 내 줄이 되게 바로 기억)

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { rowPickImage } = await ocr();
        const c = await rowPickImage(file);
        if (!alive) return;
        canvasRef.current = c;
        setPhoto({ url: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height });
      } catch (err) {
        if (alive) setError(errorText(err, '사진을 열 수 없어요.'));
      }
    })();
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [file]);

  const read = async (dBand, rBand) => {
    setError('');
    setReading({ p: 0, msg: '준비 중...' });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { readMyRow } = await ocr();
      const aliases = loadAliases();
      const r = await readMyRow(canvasRef.current, {
        dateY: (dBand[0] + dBand[1]) / 2,
        rowY: (rBand[0] + rBand[1]) / 2,
        year,
        month,
        shiftTypes: withAliases(shiftTypes, aliases),
        signal: ctrl.signal,
        onProgress: (p, msg) => setReading({ p, msg })
      });
      if (r.error) {
        setError(r.error);
        dateRef.current = null;
        setDateBand(null);
        setRowBand(null);
        return;
      }
      // 처음 값: 읽은 근무 → 기억한 표기 → 비움(물음표)
      const name = r.names[0];
      const init = {};
      Object.keys(r.cellImages).forEach((k) => {
        const code = r.people[name][k]?.code;
        const token = r.unknown[name][k];
        const known = token && aliases[token] !== undefined && (aliases[token] === '' || shiftTypes.some((t) => t.code === aliases[token]));
        init[k] = code || (known ? aliases[token] : null);
      });
      setValues(init);
      setResult({ ...r, tokens: r.unknown[name] });
      setSelected(Object.keys(init).sort().find((k) => init[k] === null) || null);
    } catch (err) {
      if (err?.name !== 'AbortError') setError(errorText(err, '사진을 읽지 못했어요.'));
    } finally {
      setReading(null);
      abortRef.current = null;
    }
  };

  // 사진을 누른 높이 → 그 표 줄
  const onPhotoTap = async (e) => {
    if (!photo || reading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * photo.h;
    const isDate = !dateRef.current;
    if (isDate) dateRef.current = 'pending';
    const { slantedBand } = await ocr();
    if (isDate) {
      const band = slantedBand(canvasRef.current, y).at;
      dateRef.current = band;
      setDateBand(band);
      return;
    }
    // 날짜 줄 계산이 아직 안 끝났으면 기다림
    while (dateRef.current === 'pending') await new Promise((r) => setTimeout(r, 30));
    const dBand = dateRef.current;
    if (!dBand) return;
    const band = slantedBand(canvasRef.current, y, dBand[1] - dBand[0]).at;
    setRowBand(band);
    read(dBand, band);
  };

  const restart = () => {
    dateRef.current = null;
    setResult(null);
    setDateBand(null);
    setRowBand(null);
    setSelected(null);
    setPicked({});
    setError('');
  };

  const keys = useMemo(() => Object.keys(result?.cellImages || {}).sort(), [result]);
  const pending = keys.filter((k) => values[k] === null);

  // 근무 고르기: 같은 표시(X·♡·빈칸 …)의 칸 중 아직 직접 고르지 않은 칸은 한꺼번에 → 다음 물음표 칸으로
  const choose = (code) => {
    if (!selected) return;
    const token = result.tokens[selected];
    const same = token ? keys.filter((k) => result.tokens[k] === token && (k === selected || !picked[k])) : [selected];
    const next = { ...values };
    same.forEach((k) => {
      next[k] = code;
    });
    setValues(next);
    setPicked((p) => ({ ...p, [selected]: true }));
    setSelected(keys.find((k) => next[k] === null && k > selected) || keys.find((k) => next[k] === null) || null);
  };

  const finish = () => {
    // 같은 표시에 고른 근무를 기억 (그 표시 칸들이 모두 같은 근무일 때만)
    const aliases = loadAliases();
    const byToken = {};
    keys.forEach((k) => {
      const t = result.tokens[k];
      if (!rememberable(t) || values[k] === null) return;
      (byToken[t] ||= new Set()).add(values[k]);
    });
    Object.entries(byToken).forEach(([t, set]) => {
      if (set.size === 1) aliases[t] = [...set][0];
    });
    saveAliases(aliases);
    const shifts = Object.fromEntries(keys.filter((k) => values[k]).map((k) => [k, values[k]]));
    onDone({ yearMonth: `${result.year}-${pad(result.month)}`, shifts });
  };

  const step = result ? 3 : dateBand ? 2 : 1;
  const bandStyle = (band) => ({ top: `${(band[0] / photo.h) * 100}%`, height: `${((band[1] - band[0]) / photo.h) * 100}%` });
  const firstWd = keys.length ? dateOf(keys[0]).getDay() : 0;

  return (
    <Modal onClose={onClose} label="내 줄만 골라 읽기">
      <div className="bg-white w-full max-w-md h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="font-bold text-[16px] text-slate-900">{step === 3 ? `${result.year}년 ${result.month}월 내 근무 확인` : '내 줄만 골라 읽기'}</h3>
          <div className="flex items-center gap-1">
            {step > 1 && !reading && (
              <button type="button" onClick={restart} aria-label="처음부터 다시 고르기" className="p-2 text-slate-400 cursor-pointer">
                <RotateCcw size={17} />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="닫기" className="p-2 text-slate-400 cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {step < 3 ? (
          <>
            <div className="px-5 pb-3 space-y-1.5">
              {notice && step === 1 && <p className="text-[12px] text-slate-500">{notice}</p>}
              <p role="status" className="text-[14px] font-semibold text-blue-700 bg-blue-50 rounded-xl px-3 py-2">
                {reading
                  ? reading.msg
                  : step === 1
                    ? '① 날짜 숫자(1 2 3 …) 줄을 눌러 주세요 (내 줄과 가까운 날짜 줄)'
                    : '② 내 이름이 있는 줄을 눌러 주세요'}
              </p>
              {error && <p className="text-[13px] text-rose-600">{error}</p>}
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {photo ? (
                <div className="relative" onClick={onPhotoTap} role="button" aria-label="근무표 사진 (줄을 눌러 고르기)" tabIndex={-1}>
                  <img src={photo.url} alt="근무표 사진" className="w-full select-none" draggable={false} />
                  {dateBand && <div className="absolute left-0 right-0 bg-blue-500/25 ring-2 ring-blue-500 pointer-events-none" style={bandStyle(dateBand)} />}
                  {rowBand && <div className="absolute left-0 right-0 bg-amber-400/30 ring-2 ring-amber-500 pointer-events-none" style={bandStyle(rowBand)} />}
                  {reading && (
                    <div className="absolute inset-0 bg-white/40 flex items-start justify-center pt-24">
                      <Loader2 size={28} className="animate-spin text-blue-600" />
                    </div>
                  )}
                </div>
              ) : (
                !error && (
                  <div className="flex justify-center pt-16">
                    <Loader2 size={24} className="animate-spin text-blue-600" />
                  </div>
                )
              )}
            </div>
          </>
        ) : (
          <>
            <p className="px-5 pb-2 text-[12px] text-slate-500">
              사진 속 칸과 비교해 다른 날은 눌러서 고쳐 주세요. 같은 표시는 한 번에 바뀌고, 고른 표시는 다음 달부터 자동으로 채워요.
            </p>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400 mb-1">
                {[...WD].map((d, i) => (
                  <span key={d} className={i === 0 ? 'text-rose-500' : ''}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstWd }, (_, i) => <span key={`e${i}`} />)}
                {keys.map((k) => {
                  const v = values[k];
                  const t = v ? findShiftType(shiftTypes, v) : null;
                  const d = dateOf(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelected(k)}
                      aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일 ${v === null ? '확인 필요' : v || '비움'}`}
                      aria-pressed={selected === k}
                      className={`rounded-lg p-0.5 flex flex-col items-center gap-0.5 cursor-pointer ${selected === k ? 'ring-2 ring-blue-600 bg-blue-50' : v === null ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-slate-50'}`}
                    >
                      <span className={`text-[11px] leading-none pt-0.5 ${d.getDay() === 0 ? 'text-rose-500' : 'text-slate-600'}`}>{d.getDate()}</span>
                      <img src={result.cellImages[k]} alt="" className="h-7 w-full object-contain bg-white rounded" />
                      {v ? (
                        <span style={shiftTextVars(t)} className="shift-cell shift-text w-full h-5 rounded text-[11px] font-semibold flex items-center justify-center leading-none">
                          {displayCode(t, v)}
                        </span>
                      ) : (
                        <span className={`w-full h-5 rounded text-[11px] flex items-center justify-center ${v === null ? 'text-amber-600 font-bold' : 'text-slate-300'}`}>{v === null ? '?' : '–'}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-slate-100 px-4 pt-3 pb-4 space-y-3">
              {selected && (
                <div>
                  <p className="text-[12px] text-slate-500 mb-1.5">
                    {Number(selected.slice(5, 7))}월 {Number(selected.slice(8))}일은 무슨 근무예요?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {shiftTypes.map((t) => (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => choose(t.code)}
                        style={shiftTextVars(t)}
                        className="shift-cell shift-text min-w-[2.75rem] h-10 px-2.5 rounded-xl text-[14px] font-semibold cursor-pointer"
                      >
                        {displayCode(t, t.code)}
                      </button>
                    ))}
                    <button type="button" onClick={() => choose('')} className="h-10 px-3 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-semibold cursor-pointer">
                      비우기
                    </button>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={finish}
                className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[15px] font-bold cursor-pointer active:bg-blue-700"
              >
                {pending.length ? `등록하기 (확인 안 한 ${pending.length}일은 비워 둠)` : `등록하기 (${keys.filter((k) => values[k]).length}일)`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
