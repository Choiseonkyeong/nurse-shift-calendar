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
  // '연차' 두 글자가 영문으로 읽히는 경우가 잦음 (연→H·A·E, 차→X·K)
  if (/^[haeo4][xk]$/i.test(key)) return '연차';
  // '차'가 흐려 '연체·연자·연치'로 읽힌 경우 (근무표에 '연'으로 시작하는 다른 두 글자 근무는 없음)
  if (/^연[가-힣]$/.test(key)) return '연차';
  return null;
}

/** "2026년 9월", "2026.09", "9월 근무표" 등에서 연/월 추출 */
export function detectYearMonth(text, fallback) {
  const full = /(20\d{2})\s*(?:년|[./-])\s*(\d{1,2})\s*월?/.exec(text);
  if (full && +full[2] >= 1 && +full[2] <= 12) return { year: +full[1], month: +full[2], found: true };
  // 월만 있는 경우: '10월'처럼 붙어 있거나 '10 월 근무표'일 때만.
  // (날짜 칸 '5' 바로 아래 요일 '월'이 이어 읽혀 '5 월'이 되는 경우를 제목으로 보지 않음)
  const onlyMonth = /(\d{1,2})월|(\d{1,2})\s+월\s*(?:근무|듀티|duty)/i.exec(text);
  const om = onlyMonth && +(onlyMonth[1] || onlyMonth[2]);
  if (om >= 1 && om <= 12) {
    return { year: fallback.year, month: om, found: true };
  }
  return { ...fallback, found: false };
}

// 흔한 성씨 (많은 순). 사진 인식이 성을 비슷한 글자로 잘못 읽은 경우(죄수민 → 최수민) 보정용
const SURNAMES = '김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민류나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부';
// 모양이 비슷해서 잘 헷갈리는 자모 묶음 (초성·중성·종성 번호)
const LOOKALIKE = [
  [[12, 13, 14], [0, 1, 15], [7, 8, 17], [3, 4, 16], [5, 11, 18], [9, 10]],
  [[0, 2], [1, 3, 5, 7], [4, 6], [8, 12, 13, 17, 18], [9, 10, 11], [14, 15, 16], [19, 20]],
  [[4, 16, 17, 21], [1, 2, 24], [7, 25], [19, 20], [8]]
];
const jamo = (ch) => {
  const c = ch.charCodeAt(0) - 0xac00;
  return [Math.floor(c / 588), Math.floor((c % 588) / 28), c % 28];
};
const looksAlike = (kind, a, b) => a === b || LOOKALIKE[kind].some((g) => g.includes(a) && g.includes(b));

/** 세 글자 이상 이름의 첫 글자가 성씨가 아니면, 모양이 비슷한 성씨로 (죄→최, 긴→김). 확실하지 않으면 그대로 */
export function fixSurname(name) {
  const first = name[0];
  if (name.length < 3 || !/[가-힣]/.test(first) || SURNAMES.includes(first)) return name;
  const [l, v, t] = jamo(first);
  const fix = [...SURNAMES].find((s) => {
    const [l2, v2, t2] = jamo(s);
    const diff = (l !== l2) + (v !== v2) + (t !== t2);
    return diff === 1 && looksAlike(0, l, l2) && looksAlike(1, v, v2) && looksAlike(2, t, t2);
  });
  return fix ? fix + name.slice(1) : name;
}

/** 사람 이름다운 정도 (여러 번 읽은 결과 중 고르기용). 0 = 이름 아님 */
export function nameQuality(name) {
  if (!name || /번째 줄/.test(name) || !/^[가-힣]{2,5}$/.test(name)) return 0;
  // 두 글자는 성이 빠졌거나 잡티('(N-keep)'이 '대내'로)일 수 있어 낮게
  return Math.max(1, (SURNAMES.includes(name[0]) ? 50 : 0) + (name.length === 3 ? 30 : name.length === 2 ? -35 : 15));
}

/** "홍길동(N-keep)", "RN 홍길동", "홍 길 동" → 한글 이름 */
export function extractName(text) {
  const joined = String(text || '');
  const candidates = joined.replace(/\(.*?\)/g, ' ').match(/[가-힣]{2,4}/g) || [];
  const merged = joined.replace(/\(.*?\)/g, '').replace(/[^가-힣]/g, '');
  const name = candidates.find((c) => !NAME_EXCLUDE.has(c)) || (merged.length >= 2 && merged.length <= 4 ? merged : '');
  return name && !NAME_EXCLUDE.has(name) ? fixSurname(name) : '';
}

const center = (w) => ({ x: (w.x0 + w.x1) / 2, y: (w.y0 + w.y1) / 2 });

/**
 * 가장 날짜 헤더다운 숫자 묶음 찾기
 * 기울어진 사진은 날짜 줄이 한쪽으로 내려가므로(1.2° 면 표 끝에서 수십 px) 기울기 후보를 바꿔 가며 같은 줄로 묶음
 */
function findHeader(words) {
  const nums = words
    .filter((w) => /^\d{1,2}$/.test(w.text) && +w.text >= 1 && +w.text <= 31)
    .map((w) => ({ ...w, day: +w.text, ...center(w), h: w.y1 - w.y0 }));
  let best = null;
  const slopes = [0, -0.01, 0.01, -0.02, 0.02, -0.03, 0.03, -0.04, 0.04];
  for (const seed of nums) {
    const band = Math.max(seed.h, 8) * 0.8;
    for (const k of slopes) {
      const row = nums.filter((n) => Math.abs(n.y - (seed.y + k * (n.x - seed.x))) <= band);
      const distinct = new Set(row.map((n) => n.day)).size;
      // 큰 기울기(1.1° 넘음)는 확실히 더 많이 맞을 때만: 사진은 먼저 바로 세우므로(0.9° 이상 회전) 남은 기울기는 작음.
      // 흐린 사진에서 날짜 몇 개를 못 읽으면 큰 기울기 띠가 여러 줄 숫자(합계 열 등)를 대각선으로 엮어 더 많아 보임
      const score = distinct - (Math.abs(k) > 0.02 ? 3 : 0);
      if (!best || score > best.score) best = { row, distinct, score, y: median(row.map((n) => n.y)), h: median(row.map((n) => n.h)) };
    }
  }
  return best && best.distinct >= 7 ? best : null;
}

/**
 * 헤더 숫자 → 열 모델 { idxToX(i), xToIdx(x), minIdx, maxIdx, colW }
 * index 는 이번 달 날짜(1~말일). 앞쪽에 붙은 지난달 날짜(예: 29 30 31 1 2 ...)는 0 이하 index.
 */
function fitColumns(header, year, month, headerWords = [], allWords = []) {
  const pts = [...header.row].sort((a, b) => a.x - b.x);
  const prevDays = new Date(year, month - 1, 0).getDate();
  const lastDay = new Date(year, month, 0).getDate();

  const fit = (s) => {
    const n = s.length;
    const mi = s.reduce((a, p) => a + p.idx, 0) / n;
    const mx = s.reduce((a, p) => a + p.x, 0) / n;
    const cov = s.reduce((a, p) => a + (p.idx - mi) * (p.x - mx), 0);
    const vi = s.reduce((a, p) => a + (p.idx - mi) ** 2, 0) || 1;
    const b = cov / vi;
    return { a: mx - b * mi, b };
  };

  // 날짜 → 이번 달 기준 index. 한 달에 걸친 근무표(예: 26 27 … 31 1 2 … 25)는
  // 앞쪽이 지난달(0 이하), 뒤쪽이 다음 달(말일 초과)일 수 있음 → 후보 중 한 직선에 가장 많이 맞는 조합 선택
  // (중간 날짜 숫자를 못 읽어도, 오인식 숫자가 섞여도 동작)
  const candidates = (day) => [day, day - prevDays, day + lastDay];
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[j].x - pts[i].x < 1) continue;
      for (const ci of candidates(pts[i].day)) {
        for (const cj of candidates(pts[j].day)) {
          if (cj <= ci || cj - ci > 40) continue;
          const b = (pts[j].x - pts[i].x) / (cj - ci);
          const a = pts[i].x - b * ci;
          const tol = b * 0.3;
          const inl = [];
          pts.forEach((p) => {
            const c = candidates(p.day).find((k) => Math.abs(a + b * k - p.x) <= tol);
            if (c !== undefined) inl.push({ idx: c, x: p.x });
          });
          // 같은 index 가 두 번 나오면 하나만
          const uniq = [...new Map(inl.map((q) => [q.idx, q])).values()];
          // 동점이면 이번 달 날짜가 많은 쪽 (제목 월 기준)
          const inMonth = uniq.filter((q) => q.idx >= 1 && q.idx <= lastDay).length;
          if (!best || uniq.length > best.n || (uniq.length === best.n && inMonth > best.inMonth)) {
            best = { n: uniq.length, inMonth, samples: uniq };
          }
        }
      }
    }
  }
  let samples = best && best.n >= 5 ? best.samples.sort((p, q) => p.x - q.x) : pts.map((p) => ({ idx: p.day, x: p.x }));
  // 지난달/다음 달 날짜가 하나뿐이면 우연히 맞은 잡음(이름 열 머리글 숫자 등)으로 보고 제외
  if (samples.filter((q) => q.idx < 1).length < 2) samples = samples.filter((q) => q.idx >= 1);
  if (samples.filter((q) => q.idx > lastDay).length < 2) samples = samples.filter((q) => q.idx <= lastDay);
  // 제목 월보다 다른 달 날짜가 더 많으면(제목을 못 읽고 선택한 달이 다를 때) 그 달 기준으로 옮김
  const before = samples.filter((q) => q.idx < 1).length;
  const after = samples.filter((q) => q.idx > lastDay).length;
  const inside = samples.length - before - after;
  let shiftMonth = 0;
  if (before > inside) shiftMonth = -1;
  else if (after > inside) shiftMonth = 1;
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
  // 칸 범위: 읽힌 날짜 범위 + 끝쪽에서 못 읽은 날짜(최대 3일, 제목 월 안에서만).
  // 단, 그 자리 헤더에 글자(합계 열의 OFF·D·E 등)가 있으면 표 밖이므로 넓히지 않음
  const step0 = Math.abs(model.b);
  const near = (w, x) => Math.abs((w.x0 + w.x1) / 2 - x) < step0 * 0.45;
  // 헤더에 글자가 있거나(합계 OFF·D 등, 성명) 그 열에 한글 이름이 있으면 날짜 칸이 아님
  const headerHasLabel = (x) =>
    headerWords.some((w) => near(w, x) && /[A-Za-z가-힣]/.test(w.text) && !/^\d+$/.test(w.text)) ||
    allWords.some((w) => w.x1 > x - step0 * 0.5 && w.x0 < x + step0 * 0.5 && /[가-힣]{2,}/.test(w.text) && !cellToCode(w.text));
  let minIdx = Math.min(...samples.map((p) => p.idx));
  let maxIdx = Math.max(...samples.map((p) => p.idx));
  // 한 달에 걸친 근무표(26일~다음 달 25일 등)는 기간이 딱 한 달
  // 왼쪽: 다음 달까지 이어진 표면 한 달 전부터, 지난달 날짜가 붙은 표면 못 읽은 앞 칸 몇 개까지(머리글 글자에서 멈춤)
  const monthMin = maxIdx > lastDay ? maxIdx - lastDay + 1 : minIdx < 1 ? minIdx - 3 : 1;
  const monthMax = maxIdx > lastDay ? maxIdx : minIdx < 1 ? minIdx + prevDays - 1 : lastDay;
  while (maxIdx < monthMax && maxIdx - Math.max(...samples.map((p) => p.idx)) < 3 && !headerHasLabel(model.a + model.b * (maxIdx + 1))) maxIdx++;
  while (minIdx > monthMin && Math.min(...samples.map((p) => p.idx)) - minIdx < 3 && !headerHasLabel(model.a + model.b * (minIdx - 1))) minIdx--;

  // 칸 너비가 제각각인 표도 맞추도록: 인식된 헤더 위치는 그대로, 빠진 날짜만 직선 보간
  const known = new Map(samples.map((p) => [p.idx, p.x]));
  const centers = [];
  for (let i = minIdx; i <= maxIdx; i++) {
    if (known.has(i)) {
      centers.push({ idx: i, x: known.get(i) });
      continue;
    }
    let lo = i - 1;
    while (lo >= minIdx && !known.has(lo)) lo--;
    let hi = i + 1;
    while (hi <= maxIdx && !known.has(hi)) hi++;
    // 양쪽 끝 바깥은 가까운 칸 간격으로 연장 (전체 평균 직선은 칸 너비가 제각각일 때 어긋남)
    const nearStep = (from, dir) => {
      let k = from - dir;
      while (k >= minIdx && k <= maxIdx && !known.has(k)) k -= dir;
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
    const r = i < maxIdx ? Math.abs(at(i + 1) - at(i)) : 0;
    // 헤더 숫자 위치가 조금 틀려도 칸이 너무 좁아지지 않게 평균 너비의 70% 이상
    return Math.max((l && r ? (l + r) / 2 : l || r) || 0, Math.abs(model.b) * 0.7);
  };

  return {
    colW: Math.abs(model.b),
    minIdx,
    maxIdx,
    shiftMonth,
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

// 날짜가 정해진 공휴일 (표에 적힌 공휴일 이름의 칸 → 몇 월 근무표인지 확인)
const FIXED_HOLIDAYS = [
  [/신정/, 1, 1],
  [/삼일절|3\.?1절/, 3, 1],
  [/어린이/, 5, 5],
  [/현충/, 6, 6],
  [/광복/, 8, 15],
  [/개천/, 10, 3],
  [/한글날/, 10, 9],
  [/성탄|크리스마스/, 12, 25]
];
const WEEKDAY_CHARS = '일월화수목금토';

/**
 * 제목에서 읽은 연/월이 표와 맞는지 확인하고, 틀렸으면 바로잡음
 *  - 요일 줄(토 일 월 …)과 날짜가 맞는 달, 공휴일 이름(개천절 등)이 그 날짜 칸에 있는 달
 *  - 사진에서 제목 숫자를 잘못 읽거나(10월 → 1, 5월) 제목이 없어도 올바른 달로
 */
function verifyYearMonth(ym, header, clean, headerWords, today) {
  const dy = (w) => center(w).y - header.yAt(center(w).x); // 기울어진 날짜 줄 기준 높이 차
  const near = clean.filter((w) => Math.abs(dy(w)) <= header.h * 4);
  const weekdays = near
    .filter((w) => w.text.length === 1 && WEEKDAY_CHARS.includes(w.text) && Math.abs(dy(w)) > header.h * 0.5)
    .map((w) => ({ x: center(w).x, wd: WEEKDAY_CHARS.indexOf(w.text) }));
  const holidays = near
    .map((w) => ({ x: center(w).x, h: FIXED_HOLIDAYS.find(([re]) => re.test(w.text)) }))
    .filter((q) => q.h);
  if (weekdays.length < 5 && !holidays.length) return ym;

  const score = (y, m) => {
    const cols = fitColumns(header, y, m, headerWords, clean);
    const dateAt = (x) => {
      const idx = cols.xToIdx(x);
      return idx === -999 ? null : new Date(y, m - 1, idx);
    };
    // 같은 날짜들을 9월/10월 어느 쪽으로도 볼 수 있을 때(9/26~10/25)는 날짜가 더 많이 들어가는 달 (10월)
    const lastDay = new Date(y, m, 0).getDate();
    let s = cols.centers.filter((c) => c.idx >= 1 && c.idx <= lastDay).length * 0.01;
    weekdays.forEach((q) => {
      const d = dateAt(q.x);
      if (d && d.getDay() === q.wd) s += 1;
    });
    holidays.forEach((q) => {
      const d = dateAt(q.x);
      if (d && d.getMonth() + 1 === q.h[1] && d.getDate() === q.h[2]) s += 3;
    });
    return s;
  };

  const cands = monthCandidates(ym, today);
  const dist = (c) => Math.abs((c.year - today.getFullYear()) * 12 + c.month - 1 - today.getMonth());
  const scored = cands.map((c) => ({ ...c, s: score(c.year, c.month) }));
  const current = scored.find((c) => c.year === ym.year && c.month === ym.month);
  const best = scored.sort((a, b) => b.s - a.s || dist(a) - dist(b))[0];
  // 요일은 여러 개가 맞아야(오인식 대비) 바꿈. 제목에서 읽은 달이 같은 점수면 그대로
  // 흐린 사진은 요일이 몇 개만 읽히므로 3개 이상 & 읽힌 요일의 60% 이상이 맞으면 인정
  const enough = holidays.length ? best.s >= 3 : Math.floor(best.s) >= Math.max(3, weekdays.length * 0.6);
  // 제목에서 읽은 달은 날짜가 실제로 더 맞을 때만 바꿈 (같은 날짜를 9월/10월로 부르는 차이는 제목대로)
  const better = ym.found ? Math.floor(best.s) > Math.floor(current.s) : best.s > current.s;
  if (!enough || !better) return ym;
  return { year: best.year, month: best.month, found: true, corrected: true };
}

/**
 * @param words  [{ text, x0, y0, x1, y1, confidence }]
 * @param opts   { year, month (fallback), shiftTypes, today, titleText(제목 줄만 따로 다시 읽은 글자) }
 * @returns { year, month, people: { 이름: { 'YYYY-MM-DD': { code, raw, confidence } } }, names, error? }
 */
export function parseRosterWords(words, { year, month, shiftTypes = [], today = new Date(), titleText = '' } = {}) {
  const clean = words
    .map((w) => ({ ...w, text: String(w.text || '').trim() }))
    .filter((w) => w.text && w.x1 > w.x0 && w.y1 > w.y0);

  const allText = `${titleText} ${clean.map((w) => w.text).join(' ')}`;
  const ym = detectYearMonth(allText, { year, month });

  const header = findHeader(clean);
  if (!header) {
    return { ...ym, people: {}, names: [], error: '날짜(1~31) 줄을 찾지 못했습니다. 표 전체가 보이도록 반듯하게 다시 찍어 주세요.' };
  }
  // 기울어진 사진 보정: 헤더 숫자들의 x-y 기울기 (날짜 줄 높이 = headerYAt(x))
  const hp = header.row.map((w) => ({ x: (w.x0 + w.x1) / 2, y: (w.y0 + w.y1) / 2 }));
  const mx = hp.reduce((a, q) => a + q.x, 0) / hp.length;
  const my = hp.reduce((a, q) => a + q.y, 0) / hp.length;
  const vx = hp.reduce((a, q) => a + (q.x - mx) ** 2, 0) || 1;
  const slope = Math.max(-0.2, Math.min(0.2, hp.reduce((a, q) => a + (q.x - mx) * (q.y - my), 0) / vx));
  const headerYAt = (x) => my + slope * (x - mx);
  header.yAt = headerYAt;
  const headerWords = clean.filter((w) => Math.abs(center(w).y - headerYAt(center(w).x)) <= header.h * 0.8);
  let cols = fitColumns(header, ym.year, ym.month, headerWords, clean);
  if (cols.shiftMonth && !ym.found) {
    // 제목에서 월을 못 읽었고 날짜 대부분이 다른 달 → 그 달 근무표로
    const d = new Date(ym.year, ym.month - 1 + cols.shiftMonth, 1);
    ym.year = d.getFullYear();
    ym.month = d.getMonth() + 1;
    cols = fitColumns(header, ym.year, ym.month, headerWords, clean);
  }
  // 요일 줄·공휴일 칸으로 확인해서 제목을 잘못 읽은 경우 바로잡음
  const checked = verifyYearMonth(ym, header, clean, headerWords, today);
  if (checked !== ym) {
    Object.assign(ym, checked);
    cols = fitColumns(header, ym.year, ym.month, headerWords, clean);
  }
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
  let rowYs = clusters.filter((c) => c.ys.length >= minCount).map((c) => median(c.ys));
  // 날짜 아래 요일 줄(토 일 월 …)이 흐린 사진에서 근무 글자로 잘못 읽혀 사람 줄로 잡히면 모든 이름이 한 줄씩 밀림 → 제외
  // (날짜 칸 범위 안에서 요일 글자가 든 짧은 단어('월', '화우', '일!')가 3개 이상인 줄)
  const weekdayWords = clean
    .filter((w) => w.text.length <= 3 && /[월화수목금토일]/.test(w.text) && center(w).x > firstColLeft && center(w).x < lastColRight)
    .map((w) => deskewY(center(w).x, center(w).y));
  rowYs = rowYs.filter((y) => weekdayWords.filter((wy) => Math.abs(wy - y) < wordH * 0.9).length < 3);
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
    const korean = parts.filter((q) => /[가-힣]{2,}/.test(q.text));
    return { name, y0, nameX0, nameX1, nameStart: korean.length ? Math.min(...korean.map((q) => q.x0)) : null };
  });
  // 이름 칸 왼쪽 끝: 이름 앞의 직급 열(HN·CN·RN 등)이 섞여 들어가지 않게 읽힌 이름들의 왼쪽 끝 기준
  const starts = rows.map((r) => r.nameStart).filter((x) => x !== null);
  if (starts.length >= Math.max(2, rows.length / 3)) {
    const left = Math.max(0, Math.min(...starts) - cols.colW * 0.2);
    rows.forEach((r) => {
      if (left < r.nameX1 - cols.colW * 0.8) r.nameX0 = left;
    });
  }

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
    headerTop: Math.min(...header.row.map((w) => w.y0)), // 이 위쪽이 제목 영역
    rows: rows.map((r) => ({ name: r.name, y0: r.y0, nameX0: r.nameX0, nameX1: r.nameX1 })),
    cols: cols.centers
      .filter((c) => c.idx >= 1 || cols.centers.some((k) => k.idx === 1))
      .map((c) => ({ idx: c.idx, x: c.x, w: cols.widthAt(c.idx), key: dateKeyOf(c.idx) }))
  };
  return { ...ym, people, names, grid, colsDetected: cols.inliers };
}

/** 오늘 기준 6개월 전 ~ 12개월 뒤 (+ 제목에서 읽은 달) */
function monthCandidates(ym, today) {
  const cands = [];
  for (let k = -6; k <= 12; k++) {
    const d = new Date(today.getFullYear(), today.getMonth() + k, 1);
    cands.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  if (!cands.some((c) => c.year === ym.year && c.month === ym.month)) cands.push({ year: ym.year, month: ym.month });
  return cands;
}

/**
 * 엑셀 날짜 줄(26 27 … 31 1 2 … 25)의 각 칸 날짜. '1' 앞쪽은 지난달
 * @returns [{ col, key: 'YYYY-MM-DD', date }] — 그 달에 없는 날짜(30일까지인 달의 31 등)는 빠짐
 */
export function datesForDayRow(days, year, month) {
  const firstIdx = days.findIndex((d) => d.day === 1);
  return days
    .map(({ col, day }, i) => {
      const m = firstIdx > 0 && i < firstIdx ? month - 1 : month;
      const date = new Date(year, m - 1, day);
      if (date.getDate() !== day) return null;
      return { col, date, key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` };
    })
    .filter(Boolean);
}

/** 칸 글자 → 요일 번호(0=일) 또는 공휴일 [월, 일] */
export const weekdayOf = (text) => {
  const t = String(text || '').trim();
  return t.length === 1 && WEEKDAY_CHARS.includes(t) ? WEEKDAY_CHARS.indexOf(t) : -1;
};
export const holidayOf = (text) => FIXED_HOLIDAYS.find(([re]) => re.test(String(text || '')))?.slice(1) || null;

/**
 * 엑셀: 요일 줄·공휴일 칸으로 제목의 연/월 확인 (사진의 verifyYearMonth 와 같은 기준)
 * @param days      [{ col, day }] 날짜 줄
 * @param weekdays  { col: 요일 번호 }
 * @param holidays  { col: [월, 일] }
 */
export function checkDayRowMonth({ days, weekdays = {}, holidays = {}, ym, found, today = new Date() }) {
  const wdCount = Object.keys(weekdays).length;
  const holCount = Object.keys(holidays).length;
  if (wdCount < 5 && !holCount) return ym;
  const score = (y, m) =>
    datesForDayRow(days, y, m).reduce((s, { col, date }) => {
      let add = weekdays[col] === date.getDay() ? 1 : 0;
      const h = holidays[col];
      if (h && date.getMonth() + 1 === h[0] && date.getDate() === h[1]) add += 3;
      return s + add;
    }, 0);
  const dist = (c) => Math.abs((c.year - today.getFullYear()) * 12 + c.month - 1 - today.getMonth());
  const scored = monthCandidates(ym, today).map((c) => ({ ...c, s: score(c.year, c.month) }));
  const current = scored.find((c) => c.year === ym.year && c.month === ym.month);
  const best = scored.sort((a, b) => b.s - a.s || dist(a) - dist(b))[0];
  const enough = holCount ? best.s >= 3 : best.s >= Math.max(5, wdCount * 0.6);
  const better = found ? best.s > current.s : best.s > current.s || (best.s === current.s && dist(best) < dist(current));
  return enough && better ? { year: best.year, month: best.month } : ym;
}
