// src/lib/rosterParse.js
// OCR 단어 목록(좌표 포함) → 근무표 표 구조 복원
//  1) 1~31 숫자가 가장 많이 나란한 줄을 날짜 헤더로 보고, 날짜→x좌표 직선을 적합(누락/오인식 보정)
//  2) 헤더 아래, 첫 날짜 칸 왼쪽의 한글 2~4자를 근무자 이름(행 기준점)으로 사용
//  3) 나머지 단어는 가장 가까운 행/열에 배치. 여러 칸이 붙어 한 단어로 읽힌 경우 글자 단위로 분배
import { matchShiftCode } from './icsImport.js';

const pad = (n) => String(n).padStart(2, '0');
const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// 표 안에서 자주 보이는 한 글자 표기 및 OCR 오인식 보정
const CELL_ALIASES = {
  d: 'D', e: 'E', n: 'N', m: 'M',
  '6': 'E', '/': 'OFF', o: 'OFF', '0': 'OFF', of: 'OFF', '0ff': 'OFF', '0f': 'OFF',
  데: 'D', 나: 'N', 오: 'OFF', 휴: 'OFF', 연: '연차', 주: 'D', 야: 'N'
};

const NAME_EXCLUDE = new Set([
  '날짜', '이름', '성명', '구분', '직급', '근무', '비고', '합계', '부서', '병동', '근무표', '간호사',
  '오프', '휴무', '연차', '데이', '이브닝', '나이트', '수간호사', '책임', '일반', '요일', '월', '년'
]);

/** 셀 문자열 → 근무 코드 */
export function cellToCode(text, shiftTypes = []) {
  const t = String(text || '').trim();
  if (!t) return null;
  const byName = matchShiftCode(t, shiftTypes);
  if (byName) return byName;
  const key = t.replace(/[.,'"`|:;_~\-[\](){}!]/g, '').replace(/\s+/g, '').toLowerCase();
  if (key !== t.toLowerCase()) {
    const inner = matchShiftCode(key, shiftTypes);
    if (inner) return inner;
  }
  if (CELL_ALIASES[key]) return CELL_ALIASES[key];
  if (/^[o0]ff?$/i.test(key)) return 'OFF';
  return null;
}

/** "2026년 9월", "2026.09", "9월 근무표" 등에서 연/월 추출 */
export function detectYearMonth(text, fallback) {
  const full = /(20\d{2})\s*(?:년|[./-])\s*(\d{1,2})\s*월?/.exec(text);
  if (full && +full[2] >= 1 && +full[2] <= 12) return { year: +full[1], month: +full[2], found: true };
  const onlyMonth = /(\d{1,2})\s*월/.exec(text);
  if (onlyMonth && +onlyMonth[1] >= 1 && +onlyMonth[1] <= 12) {
    return { year: fallback.year, month: +onlyMonth[1], found: true };
  }
  return { ...fallback, found: false };
}

/** "홍길동(N-keep)", "RN 홍길동", "홍 길 동" → 한글 이름 */
export function extractName(text) {
  const joined = String(text || '');
  const candidates = joined.replace(/\(.*?\)/g, ' ').match(/[가-힣]{2,4}/g) || [];
  const merged = joined.replace(/\(.*?\)/g, '').replace(/[^가-힣]/g, '');
  const name = candidates.find((c) => !NAME_EXCLUDE.has(c)) || (merged.length >= 2 && merged.length <= 4 ? merged : '');
  return name && !NAME_EXCLUDE.has(name) ? name : '';
}

const center = (w) => ({ x: (w.x0 + w.x1) / 2, y: (w.y0 + w.y1) / 2 });

/** 가장 날짜 헤더다운 숫자 묶음 찾기 */
function findHeader(words) {
  const nums = words
    .filter((w) => /^\d{1,2}$/.test(w.text) && +w.text >= 1 && +w.text <= 31)
    .map((w) => ({ ...w, day: +w.text, ...center(w), h: w.y1 - w.y0 }));
  let best = null;
  for (const seed of nums) {
    const band = Math.max(seed.h, 8) * 0.8;
    const row = nums.filter((n) => Math.abs(n.y - seed.y) <= band);
    const distinct = new Set(row.map((n) => n.day)).size;
    if (!best || distinct > best.distinct) best = { row, distinct, y: median(row.map((n) => n.y)), h: median(row.map((n) => n.h)) };
  }
  return best && best.distinct >= 7 ? best : null;
}

/**
 * 헤더 숫자 → 열 모델 { idxToX(i), xToIdx(x), minIdx, maxIdx, colW }
 * index 는 이번 달 날짜(1~말일). 앞쪽에 붙은 지난달 날짜(예: 29 30 31 1 2 ...)는 0 이하 index.
 */
function fitColumns(header, year, month) {
  const pts = [...header.row].sort((a, b) => a.x - b.x);
  const prevDays = new Date(year, month - 1, 0).getDate();
  const firstOne = pts.findIndex((p) => p.day === 1);
  let samples = pts.map((p, i) => ({
    idx: firstOne > 0 && i < firstOne && p.day > 20 ? p.day - prevDays : p.day,
    x: p.x
  }));

  const fit = (s) => {
    const n = s.length;
    const mi = s.reduce((a, p) => a + p.idx, 0) / n;
    const mx = s.reduce((a, p) => a + p.x, 0) / n;
    const cov = s.reduce((a, p) => a + (p.idx - mi) * (p.x - mx), 0);
    const vi = s.reduce((a, p) => a + (p.idx - mi) ** 2, 0) || 1;
    const b = cov / vi;
    return { a: mx - b * mi, b };
  };

  // 오인식 숫자(예: 18→10, 중복) 제거: 왼쪽→오른쪽으로 날짜가 증가하는 가장 긴 수열만 사용
  // (칸 너비가 제각각인 표에서도 정상 헤더를 버리지 않음)
  const n = samples.length;
  const len = new Array(n).fill(1);
  const prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const di = samples[i].idx - samples[j].idx;
      if (di > 0 && samples[i].x - samples[j].x > 0 && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
    }
  }
  let end = len.indexOf(Math.max(...len));
  const chain = [];
  while (end !== -1) {
    chain.unshift(samples[end]);
    end = prev[end];
  }
  if (chain.length >= 5) samples = chain;
  let model = fit(samples);
  // 간격이 평균의 절반도 안 되거나 두 배를 넘는 점은 추가로 제외
  const step = Math.abs(model.b);
  const consistent = samples.filter((p, i) => {
    const nb = samples[i + 1] || samples[i - 1];
    if (!nb) return true;
    const perDay = Math.abs(nb.x - p.x) / Math.abs(nb.idx - p.idx);
    return perDay > step * 0.5 && perDay < step * 2;
  });
  if (consistent.length >= 5 && consistent.length < samples.length) {
    samples = consistent;
    model = fit(samples);
  }
  const lastDay = new Date(year, month, 0).getDate();
  const minIdx = Math.min(Math.max(Math.min(...samples.map((p) => p.idx)), -6), 1);

  // 칸 너비가 제각각인 표도 맞추도록: 인식된 헤더 위치는 그대로, 빠진 날짜만 직선 보간
  const known = new Map(samples.map((p) => [p.idx, p.x]));
  const centers = [];
  for (let i = minIdx; i <= lastDay; i++) {
    if (known.has(i)) {
      centers.push({ idx: i, x: known.get(i) });
      continue;
    }
    let lo = i - 1;
    while (lo >= minIdx && !known.has(lo)) lo--;
    let hi = i + 1;
    while (hi <= lastDay && !known.has(hi)) hi++;
    // 양쪽 끝 바깥은 가까운 칸 간격으로 연장 (전체 평균 직선은 칸 너비가 제각각일 때 어긋남)
    const nearStep = (from, dir) => {
      let k = from - dir;
      while (k >= minIdx && k <= lastDay && !known.has(k)) k -= dir;
      return known.has(k) ? (known.get(from) - known.get(k)) / (from - k) : model.b;
    };
    let x;
    if (known.has(lo) && known.has(hi)) x = known.get(lo) + ((known.get(hi) - known.get(lo)) * (i - lo)) / (hi - lo);
    else if (known.has(lo)) x = known.get(lo) + nearStep(lo, 1) * (i - lo);
    else if (known.has(hi)) x = known.get(hi) - nearStep(hi, -1) * (hi - i);
    else x = model.a + model.b * i;
    centers.push({ idx: i, x });
  }
  const at = (i) => centers[Math.min(Math.max(i - minIdx, 0), centers.length - 1)].x;
  const widthAt = (i) => {
    const l = i > minIdx ? Math.abs(at(i) - at(i - 1)) : 0;
    const r = i < lastDay ? Math.abs(at(i + 1) - at(i)) : 0;
    // 헤더 숫자 위치가 조금 틀려도 칸이 너무 좁아지지 않게 평균 너비의 70% 이상
    return Math.max((l && r ? (l + r) / 2 : l || r) || 0, Math.abs(model.b) * 0.7);
  };

  return {
    colW: Math.abs(model.b),
    minIdx,
    maxIdx: lastDay,
    idxToX: at,
    widthAt,
    // 가장 가까운 칸. 양 끝 칸 밖으로 한 칸 이상 벗어나면 표 밖(합계 열 등)으로 봄
    xToIdx: (x) => {
      let best = centers[0];
      centers.forEach((c) => {
        if (Math.abs(c.x - x) < Math.abs(best.x - x)) best = c;
      });
      return Math.abs(best.x - x) > widthAt(best.idx) * 0.75 ? -999 : best.idx;
    },
    centers,
    inliers: samples.length
  };
}

/**
 * @param words  [{ text, x0, y0, x1, y1, confidence }]
 * @param opts   { year, month (fallback), shiftTypes }
 * @returns { year, month, people: { 이름: { 'YYYY-MM-DD': { code, raw, confidence } } }, names, error? }
 */
export function parseRosterWords(words, { year, month, shiftTypes = [] } = {}) {
  const clean = words
    .map((w) => ({ ...w, text: String(w.text || '').trim() }))
    .filter((w) => w.text && w.x1 > w.x0 && w.y1 > w.y0);

  const allText = clean.map((w) => w.text).join(' ');
  const ym = detectYearMonth(allText, { year, month });

  const header = findHeader(clean);
  if (!header) {
    return { ...ym, people: {}, names: [], error: '날짜(1~31) 줄을 찾지 못했습니다. 표 전체가 보이도록 반듯하게 다시 찍어 주세요.' };
  }
  const cols = fitColumns(header, ym.year, ym.month);
  // 기울어진 사진 보정: 헤더 숫자들의 x-y 기울기
  const hp = header.row.map((w) => ({ x: (w.x0 + w.x1) / 2, y: (w.y0 + w.y1) / 2 }));
  const mx = hp.reduce((a, q) => a + q.x, 0) / hp.length;
  const my = hp.reduce((a, q) => a + q.y, 0) / hp.length;
  const vx = hp.reduce((a, q) => a + (q.x - mx) ** 2, 0) || 1;
  const slope = Math.max(-0.2, Math.min(0.2, hp.reduce((a, q) => a + (q.x - mx) * (q.y - my), 0) / vx));
  const headerYAt = (x) => my + slope * (x - mx);
  const firstColLeft = cols.idxToX(cols.minIdx) - cols.widthAt(cols.minIdx) * 0.6;
  const belowHeader = (w) => center(w).y > headerYAt(center(w).x) + header.h * 0.8;

  const lastColRight = cols.idxToX(cols.maxIdx) + cols.widthAt(cols.maxIdx) * 0.6;
  const deskewY = (x, y) => y - slope * x;

  // 행: 날짜 칸 안에서 근무 코드로 읽힌 단어들을 (기울기 보정한) y 로 묶음 → 이름을 못 읽어도 행은 살아남음
  const dataWords = clean
    .filter((w) => {
      const c = center(w);
      return belowHeader(w) && c.x > firstColLeft && c.x < lastColRight && cellToCode(w.text, shiftTypes);
    })
    .map((w) => ({ y0: deskewY(center(w).x, center(w).y), h: w.y1 - w.y0 }))
    .sort((p, q) => p.y0 - q.y0);
  const wordH = median(dataWords.map((w) => w.h)) || header.h;
  const clusters = [];
  dataWords.forEach((w) => {
    const last = clusters[clusters.length - 1];
    if (last && w.y0 - last.ys[last.ys.length - 1] < wordH * 0.6) last.ys.push(w.y0);
    else clusters.push({ ys: [w.y0] });
  });
  const minCount = Math.max(3, Math.round(cols.centers.length * 0.15));
  const rowYs = clusters.filter((c) => c.ys.length >= minCount).map((c) => median(c.ys));
  if (!rowYs.length) {
    return { ...ym, people: {}, names: [], error: '근무 칸을 찾지 못했습니다. 표 전체가 보이도록 밝은 곳에서 다시 찍어 주세요.' };
  }
  const pitch = rowYs.length > 1 ? median(rowYs.slice(1).map((y, i) => y - rowYs[i])) : wordH * 2.5;

  // 이름: 각 행 높이에서 첫 칸 왼쪽에 있는 한글
  const leftWords = clean
    .filter((w) => belowHeader(w) && w.x1 <= firstColLeft + cols.colW * 0.3 && /[가-힣]/.test(w.text))
    .map((w) => ({ ...w, ...center(w), y0: deskewY(center(w).x, center(w).y) }));
  const nameX0 = Math.max(0, Math.min(firstColLeft - cols.colW * 4, ...leftWords.map((w) => w.x0)));
  const used = new Set();
  const rows = rowYs.map((y0, i) => {
    const parts = leftWords.filter((w) => Math.abs(w.y0 - y0) < pitch * 0.45).sort((p, q) => p.x - q.x);
    let name = extractName(parts.map((p) => p.text).join(' ')) || `${i + 1}번째 줄`;
    if (used.has(name)) name = `${name}(${i + 1})`;
    used.add(name);
    // 이름 칸 오른쪽 끝: 1차에서 읽힌 이름 끝 + 여유, 단 첫 날짜 글자는 넘지 않게
    const col1 = cols.idxToX(cols.minIdx) - cols.widthAt(cols.minIdx) * 0.25;
    const nameX1 = Math.min(col1, Math.max(col1 - cols.widthAt(cols.minIdx) * 0.3, ...parts.map((q) => q.x1 + cols.colW * 0.15)));
    return { name, y0, nameX0, nameX1 };
  });

  const dateKeyOf = (idx) => {
    const d = new Date(ym.year, ym.month - 1, idx);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const people = {};
  rows.forEach((r) => {
    people[r.name] = people[r.name] || {};
  });

  const place = (row, idx, raw, confidence) => {
    if (idx < cols.minIdx || idx > cols.maxIdx) return;
    const code = cellToCode(raw, shiftTypes);
    if (!code) return;
    const key = dateKeyOf(idx);
    const prev = people[row.name][key];
    if (!prev || prev.confidence < confidence) people[row.name][key] = { code, raw, confidence };
  };

  clean.forEach((w) => {
    const c = center(w);
    if (!belowHeader(w) || c.x < firstColLeft + cols.colW * 0.3) return;
    let row = null;
    let bestDy = Infinity;
    rows.forEach((r) => {
      const dy = Math.abs(r.y0 + slope * c.x - c.y);
      if (dy < bestDy) {
        bestDy = dy;
        row = r;
      }
    });
    if (!row || bestDy > pitch * 0.5) return;
    const conf = w.confidence ?? 50;

    const span = (w.x1 - w.x0) / cols.widthAt(cols.xToIdx(c.x) === -999 ? cols.minIdx : cols.xToIdx(c.x));
    const whole = cellToCode(w.text, shiftTypes);
    if (span < 1.5 || (whole && w.text.length > 1 && span < 2.5 && !/^[DENM/]+$/i.test(w.text))) {
      place(row, cols.xToIdx(c.x), w.text, conf);
      return;
    }
    // 여러 칸이 붙어 한 단어로 인식됨 → 칸 수만큼 균등 분할 ("OFF" 같은 단어 우선)
    const tokens = w.text.match(/[o0]ff|off|[가-힣]|[a-z0-9/]/gi) || [];
    if (!tokens.length) return;
    const step = (w.x1 - w.x0) / tokens.length;
    tokens.forEach((t, i) => place(row, cols.xToIdx(w.x0 + step * (i + 0.5)), t, conf * 0.9));
  });

  // 값이 하나도 없는 사람은 제외(표 아래 서명/비고 등)
  Object.keys(people).forEach((n) => {
    if (!Object.keys(people[n]).length) delete people[n];
  });
  const names = rows.map((r) => r.name).filter((n, i, arr) => people[n] && arr.indexOf(n) === i);
  const grid = {
    slope,
    pitch,
    rows: rows.map((r) => ({ name: r.name, y0: r.y0, nameX0: r.nameX0, nameX1: r.nameX1 })),
    cols: cols.centers
      .filter((c) => c.idx >= 1 || cols.centers.some((k) => k.idx === 1))
      .map((c) => ({ idx: c.idx, x: c.x, w: cols.widthAt(c.idx), key: dateKeyOf(c.idx) }))
  };
  return { ...ym, people, names, grid, colsDetected: cols.inliers };
}
