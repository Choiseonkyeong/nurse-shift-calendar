// src/lib/rosterOcr.js
// 근무표 사진 → 단어 좌표 (Tesseract.js, 기기 안에서 처리 / 무료 / 서버 전송 없음)
// 인식률을 위해: 해상도 정규화 → 흑백 → 조명 보정(적응형 이진화) → 표 선 제거 후 OCR
import { parseRosterWords, cellToCode, extractName, nameQuality, checkDayRowMonth, datesForDayRow } from './rosterParse';
import { resilientWorker } from './resilientWorker';
import { looksLikeCode, normalizeToken } from './codeAliases';

const TARGET_WIDTH = 2400;
const BIG_WIDTH = 3600; // 표를 못 찾았을 때 크게 다시 볼 폭
/** preprocess·scaledCanvas 가 만드는 canvas 폭 */
const preprocessWidth = (img, targetWidth = TARGET_WIDTH) => Math.round(widthOf(img) * Math.min(3, targetWidth / widthOf(img)));

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 열 수 없습니다.'));
    };
    img.src = url;
  });
}

const widthOf = (img) => img.naturalWidth || img.width;
const heightOf = (img) => img.naturalHeight || img.height;

// 아이폰 브라우저는 캔버스 한 장이 약 1670만 화소를 넘으면 빈 이미지가 됨 (아이폰 15 Pro 이후 기본 사진 2400만 화소)
// 인식은 폭 2400px 로 하므로 처음에 긴 변 4000px 로 줄여도 정확도는 같고 메모리·시간만 줄어듦
const MAX_SIDE = 4000;
export function fitSize(img) {
  const W0 = widthOf(img);
  const H0 = heightOf(img);
  const s = MAX_SIDE / Math.max(W0, H0);
  if (s >= 1) return img;
  const c = document.createElement('canvas');
  c.width = Math.round(W0 * s);
  c.height = Math.round(H0 * s);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** 90°·180°·270° 회전 (폰을 돌려 찍었는데 화면 자동 회전이 꺼져 옆으로 누운 사진) */
export function rotateQuarter(img, deg) {
  const W0 = widthOf(img);
  const H0 = heightOf(img);
  const side = deg % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = side ? H0 : W0;
  c.height = side ? W0 : H0;
  const ctx = c.getContext('2d');
  // 정수 픽셀 위치로 옮긴 뒤 돌림 (가운데 기준이면 홀수 크기에서 반 픽셀 밀려 글자가 흐려짐)
  if (deg === 90) ctx.translate(H0, 0);
  else if (deg === 270) ctx.translate(0, W0);
  else ctx.translate(W0, H0);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, 0, 0);
  return c;
}

/**
 * 기울어진 사진 바로 세우기 (-4°~4°)
 * 표의 가로선·글자 줄이 가장 수평이 되는 각도 = 어두운 픽셀을 그 각도로 가로줄에 모았을 때 가장 뾰족한 각도.
 * 1° 만 기울어도 오른쪽 끝 날짜 줄이 수십 px 내려가고, 표 선이 사선이라 지워지지 않아 날짜 숫자와 붙어 못 읽음
 * @returns 회전한 canvas (거의 수평이면 원본 그대로)
 */
export function deskew(img) {
  const W0 = widthOf(img);
  const H0 = heightOf(img);
  const s = Math.min(1, 900 / W0);
  const w = Math.max(1, Math.round(W0 * s));
  const h = Math.max(1, Math.round(H0 * s));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0, w, h);
  const d = sctx.getImageData(0, 0, w, h).data;
  // 주변보다 어두운 점(글자·표 선)만: 모니터 테두리·어두운 책상처럼 넓게 어두운 곳은 빼야 기울기를 잡음
  const lum = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) lum[k] = 0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2];
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += lum[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const R = 8;
  const xs = [];
  const ys = [];
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - R);
    const y1 = Math.min(h, y + R + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R);
      const x1 = Math.min(w, x + R + 1);
      const mean = (integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      const v = lum[y * w + x];
      if (v < 170 && v < mean * 0.8) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < 200) return img;
  const pad = Math.ceil(w * 0.08);
  const score = (deg) => {
    const t = Math.tan((deg * Math.PI) / 180);
    const hist = new Float64Array(h + pad * 2);
    for (let k = 0; k < xs.length; k++) {
      const r = Math.round(ys[k] - xs[k] * t) + pad;
      if (r >= 0 && r < hist.length) hist[r] += 1;
    }
    let sum = 0;
    for (let r = 0; r < hist.length; r++) sum += hist[r] * hist[r];
    return sum;
  };
  let best = 0;
  let bestScore = score(0);
  for (let deg = -4; deg <= 4.001; deg += 0.25) {
    const sc = score(deg);
    if (sc > bestScore) {
      bestScore = sc;
      best = deg;
    }
  }
  const coarse = best;
  for (let deg = coarse - 0.25; deg <= coarse + 0.25; deg += 0.05) {
    const sc = score(deg);
    if (sc > bestScore) {
      bestScore = sc;
      best = deg;
    }
  }
  // 1° 미만은 그대로: 회전하면 글자가 다시 그려지며 흐려져 D 가 OFF 로 읽히는 등 오히려 나빠짐 (실험 결과)
  // 작은 기울기는 날짜 줄 기울기 보정(findHeader·slope)으로 충분
  if (Math.abs(best) < 0.9) return img;
  const a = (-best * Math.PI) / 180;
  const cw = Math.round(W0 * Math.abs(Math.cos(a)) + H0 * Math.abs(Math.sin(a)));
  const ch = Math.round(H0 * Math.abs(Math.cos(a)) + W0 * Math.abs(Math.sin(a)));
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(a);
  ctx.drawImage(img, -W0 / 2, -H0 / 2);
  out.deskewAngle = best;
  return out;
}

/**
 * 적응형 이진화 + 긴 가로/세로 선 제거 → canvas
 * @param strongLines  끊기고 1px씩 비켜 간 선까지 지움 (휜 종이·회색 칸 경계). 글자 획을 지울 수 있어 다시 읽을 때만
 */
export function preprocess(img, targetWidth = TARGET_WIDTH, { strongLines = false, lineFrac = 0 } = {}) {
  const scale = Math.min(3, targetWidth / widthOf(img));
  const w = Math.round(widthOf(img) * scale);
  const h = Math.round(heightOf(img) * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;

  // 흑백 + 적분 영상
  const gray = new Float32Array(w * h);
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      gray[y * w + x] = g;
      rowSum += g;
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + rowSum;
    }
  }

  // 지역 평균 대비 어두운 픽셀만 글자로 (그림자·조명 불균일 보정)
  const r = Math.max(8, Math.round(w / 80));
  const bin = new Uint8Array(w * h); // 1 = 검정
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * (w + 1) + x1 + 1] -
        integral[y0 * (w + 1) + x1 + 1] -
        integral[(y1 + 1) * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0];
      bin[y * w + x] = gray[y * w + x] < (sum / area) * 0.85 ? 1 : 0;
    }
  }

  // 표 선 제거: 칸 너비보다 훨씬 긴 가로/세로 연속 픽셀
  // strongLines: 종이가 휘거나 회색 칸 경계에서 선이 끊기고 1px씩 비켜 가므로, 옆 1px 까지 보고 짧은 틈(GAP px)은 이어서 셈
  // (끊긴 세로선이 날짜 숫자에 붙어 '1|2|3' 으로 읽히면 날짜 칸을 못 찾음)
  const minH = Math.round(w / 12);
  // lineFrac: 줄 몇 개만 잘라 낸 이미지(내 줄 고르기)는 세로선이 그 높이만큼만 이어짐 → 높이의 비율로
  const minV = lineFrac ? Math.round(h * lineFrac) : Math.round(h / 12);
  const GAP = strongLines ? 3 : 0;
  const SIDE = strongLines ? 1 : 0;
  const erase = new Uint8Array(w * h);
  const eraseRuns = (len, cross, at, min) => {
    for (let c = 0; c < cross; c++) {
      const dark = (k) => {
        for (let d = -SIDE; d <= SIDE; d++) {
          const cc = c + d;
          if (cc >= 0 && cc < cross && bin[at(k, cc)]) return true;
        }
        return false;
      };
      let start = -1;
      let lastDark = -1;
      let filled = 0;
      // 선은 거의 빈틈없이 이어짐. 글자 줄(제목 등)은 틈을 이어 붙여도 채워진 비율이 낮아 지우지 않음
      const flush = () => {
        const n = lastDark - start + 1;
        if (start >= 0 && n >= min && (!strongLines || filled >= n * 0.85)) for (let q = start; q <= lastDark; q++) erase[at(q, c)] = 1;
      };
      for (let k = 0; k <= len; k++) {
        if (k < len && dark(k)) {
          if (start < 0 || k - lastDark > GAP + 1) {
            flush();
            start = k;
            filled = 0;
          }
          lastDark = k;
          filled++;
        } else if (k === len) flush();
      }
    }
  };
  eraseRuns(w, h, (x, y) => y * w + x, minH);
  eraseRuns(h, w, (y, x) => y * w + x, minV);

  for (let i = 0; i < w * h; i++) {
    const v = bin[i] && !erase[i] ? 0 : 255;
    px[i * 4] = v;
    px[i * 4 + 1] = v;
    px[i * 4 + 2] = v;
    px[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const assetUrl = (p) => new URL(p, document.baseURI).href;

function collectWords(data) {
  const words = [];
  (data.blocks || []).forEach((b) =>
    (b.paragraphs || []).forEach((p) =>
      (p.lines || []).forEach((l) =>
        (l.words || []).forEach((wd) => words.push({ text: wd.text, confidence: wd.confidence, ...wd.bbox }))
      )
    )
  );
  return words;
}

async function createOcrWorker(onProgress) {
  const { createWorker } = await import('tesseract.js');
  return createWorker(['kor', 'eng'], 1, {
    workerPath: assetUrl('ocr/worker.min.js'),
    corePath: assetUrl('ocr/core'),
    langPath: assetUrl('ocr/lang'),
    gzip: true,
    logger: (m) => {
      try {
        if (m.status === 'recognizing text') onProgress(m.progress);
      } catch {
        /* 취소 중: 진행 표시만 건너뜀 (엔진 콜백 안에서 오류를 던지지 않게) */
      }
    }
  });
}

/** 이미지(canvas) → 단어 좌표 목록. 표처럼 흩어진 글자는 sparse text(11) 모드가 누락이 가장 적음 */
export async function ocrWords(worker, canvas, psm = '11') {
  await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  return collectWords(data);
}

/** 보정 없이 해상도만 맞춘 canvas */
function scaledCanvas(img, targetWidth = TARGET_WIDTH) {
  const scale = Math.min(3, targetWidth / widthOf(img));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(widthOf(img) * scale);
  canvas.height = Math.round(heightOf(img) * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export { loadImage, scaledCanvas, createOcrWorker };

/**
 * 이름 칸을 원본 사진에서 크게 잘라냄 → [회색조, 이진화] (표 선·직급 칸 제거)
 *  - 전체 이진화 이미지에서 자르면 흐린 사진의 작은 이름 글자(받침·획)가 사라짐 → 원본에서 따로
 *  - 왼쪽 직급 칸(HN·CN·A)과 칸 테두리가 같이 읽히면 '[A] 이경은', '내정민서' 처럼 섞임 → 세로선 기준으로 잘라냄
 * @param targetH 잘라낸 줄 높이를 이 높이로 확대
 */
function cropNameVariants(src, x0, y0, x1, y1, targetH = 110) {
  const w = Math.max(1, Math.round(x1 - x0));
  const h = Math.max(1, Math.round(y1 - y0));
  const scale = Math.min(6, Math.max(1, targetH / h));
  const W = Math.round(w * scale);
  const H = Math.round(h * scale);
  const tmp = document.createElement('canvas');
  tmp.width = W;
  tmp.height = H;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(src, x0, y0, w, h, 0, 0, W, H);
  const d = tctx.getImageData(0, 0, W, H).data;
  const lum = new Float32Array(W * H);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < W * H; i++) {
    lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    hist[Math.round(lum[i])]++;
  }
  // Otsu 임계값 (칸 배경색이 있어도 글자·선만 남도록)
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = W * H - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  const dark = (x, y) => lum[y * W + x] <= thr;
  // 세로선: 높이의 70% 이상이 어두운 열. 왼쪽 60% 안의 가장 오른쪽 선 = 직급 칸과 이름 칸 경계
  const vline = [];
  for (let x = 0; x < W; x++) {
    let n = 0;
    for (let y = 0; y < H; y++) if (dark(x, y)) n++;
    vline.push(n >= H * 0.7);
  }
  let left = 0;
  for (let x = Math.floor(W * 0.6); x >= 0; x--) {
    if (vline[x]) {
      left = x + 1;
      break;
    }
  }
  let right = W;
  for (let x = Math.ceil(W * 0.75); x < W; x++) {
    if (vline[x]) {
      right = x;
      break;
    }
  }
  // 가로선: 너비의 70% 이상이 어두운 줄은 지움
  const hline = [];
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = left; x < right; x++) if (dark(x, y)) n++;
    hline.push(n >= (right - left) * 0.7);
  }
  const padPx = 24;
  const make = (binary) => {
    const c = document.createElement('canvas');
    c.width = right - left + padPx * 2;
    c.height = H + padPx * 2;
    const ctx = c.getContext('2d');
    const out = ctx.createImageData(c.width, c.height);
    out.data.fill(255);
    for (let y = 0; y < H; y++) {
      for (let x = left; x < right; x++) {
        const v = vline[x] || hline[y] ? 255 : binary ? (dark(x, y) ? 0 : 255) : Math.min(255, Math.round(lum[y * W + x]));
        const o = ((y + padPx) * c.width + (x - left + padPx)) * 4;
        out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
      }
    }
    ctx.putImageData(out, 0, 0);
    return c;
  };
  return [make(false), make(true)];
}

/** canvas 의 사각형 영역을 여백을 둔 새 canvas 로 (Tesseract 는 글자 주변 여백이 있어야 잘 읽음) */
export function cropCell(src, x0, y0, x1, y1, { filter = true } = {}) {
  const w = Math.max(1, Math.round(x1 - x0));
  const h = Math.max(1, Math.round(y1 - y0));
  const scale = Math.max(1, 48 / h);
  const padPx = Math.round(12 * scale);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale) + padPx * 2;
  c.height = Math.round(h * scale) + padPx * 2;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, x0, y0, w, h, padPx, padPx, w * scale, h * scale);
  // 칸 테두리에 닿은 잉크 덩어리(기울어져 남은 표 선 조각) 제거 + 잉크 비율 계산(빈 칸은 OCR 생략)
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const W = c.width;
  const H = c.height;
  const black = (i) => d[i * 4] < 128;
  const seen = new Uint8Array(W * H);
  const stack = [];
  const inner = (x, y) => x >= padPx && x < W - padPx && y >= padPx && y < H - padPx;
  for (let x = padPx; x < W - padPx; x++) {
    stack.push(padPx * W + x, (H - padPx - 1) * W + x);
  }
  for (let y = padPx; y < H - padPx; y++) {
    stack.push(y * W + padPx, y * W + W - padPx - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !black(i)) continue;
    seen[i] = 1;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255;
    const x = i % W;
    const y = (i - x) / W;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      if (inner(x + dx, y + dy)) stack.push((y + dy) * W + x + dx);
    });
  }
  // 남은 잉크 덩어리 중 점선 조각·옆 칸에서 넘어온 획 제거:
  // 가장 큰 덩어리의 12% 미만이거나, 칸 가운데 영역(좌우 25~75%)에 전혀 걸치지 않는 덩어리
  const label = new Int32Array(W * H).fill(-1);
  const comps = [];
  for (let i = 0; i < W * H; i++) {
    if (label[i] !== -1 || !black(i)) continue;
    const comp = { pixels: [], x0: W, x1: 0 };
    label[i] = comps.length;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop();
      comp.pixels.push(j);
      const x = j % W;
      const y = (j - x) / W;
      if (x < comp.x0) comp.x0 = x;
      if (x > comp.x1) comp.x1 = x;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const k = ny * W + nx;
          if (label[k] === -1 && black(k)) {
            label[k] = comps.length;
            stack.push(k);
          }
        }
      }
    }
    comps.push(comp);
  }
  const maxArea = Math.max(0, ...comps.map((q) => q.pixels.length));
  const bandL = padPx + (W - 2 * padPx) * 0.25;
  const bandR = padPx + (W - 2 * padPx) * 0.75;
  comps.forEach((q) => {
    if (!filter) return;
    if (q.pixels.length < maxArea * 0.12 || q.x1 < bandL || q.x0 > bandR) {
      q.pixels.forEach((j) => {
        d[j * 4] = d[j * 4 + 1] = d[j * 4 + 2] = 255;
      });
    }
  });

  ctx.putImageData(img, 0, 0);
  let ink = 0;
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  for (let i = 0; i < W * H; i++) {
    if (!black(i)) continue;
    ink++;
    const x = i % W;
    const y = (i - x) / W;
    if (x < bx0) bx0 = x;
    if (x > bx1) bx1 = x;
    if (y < by0) by0 = y;
    if (y > by1) by1 = y;
  }
  const ratio = ink / (c.width * c.height);
  if (bx1 < 0) return { canvas: c, ink: ratio };
  // 글자 높이를 일정하게(약 40px) 맞춰 다시 그림: 작은 글씨(해상도 낮은 캡처)도 잘 읽힘
  const gw = bx1 - bx0 + 1;
  const gh = by1 - by0 + 1;
  const k = Math.min(6, Math.max(0.5, GLYPH_H / gh));
  const out = document.createElement('canvas');
  out.width = Math.round(gw * k) + GLYPH_PAD * 2;
  out.height = Math.round(gh * k) + GLYPH_PAD * 2;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, out.width, out.height);
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(c, bx0, by0, gw, gh, GLYPH_PAD, GLYPH_PAD, gw * k, gh * k);
  return { canvas: out, ink: ratio };
}

const GLYPH_H = 40;
const GLYPH_PAD = 20;

/** 글자 영역 왼쪽 위/아래 모서리의 잉크 비율로 D(직각) vs O(둥근) 구분 */
function looksLikeD(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: W, height: H } = canvas;
  const d = ctx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4] < 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return false;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const corner = (cx0, cy0) => {
    const cw = Math.max(1, Math.round(bw * 0.12));
    const ch = Math.max(1, Math.round(bh * 0.12));
    let ink = 0;
    for (let y = cy0; y < cy0 + ch; y++) for (let x = cx0; x < cx0 + cw; x++) if (d[(y * W + x) * 4] < 128) ink++;
    return ink / (cw * ch);
  };
  const ch = Math.max(1, Math.round(bh * 0.12));
  return corner(x0, y0) > 0.5 && corner(x0, y1 - ch + 1) > 0.5;
}

/**
 * 표가 있는 영역 (canvas 좌표): 날짜 열 기준으로 왼쪽 직급·이름 칸, 위쪽 제목 줄, 아래 마지막 사람 줄까지
 * (이름 칸 왼쪽 끝은 같은 줄의 가장 왼쪽 글자로 잡혀 화면 캡처의 옆 메뉴 글자까지 들어갈 수 있어 쓰지 않음)
 */
export function tableBox(grid, W, H) {
  const cols = grid?.cols || [];
  if (!cols.length || !grid.rows?.length) return null;
  const colW = median(cols.map((c) => c.w)) || 20;
  // 날짜를 일부만 읽었으면(흐린 사진) 한 달(31일) 폭이 되도록 양쪽으로 넓힘
  const missing = Math.max(0, 31 - cols.length) * colW;
  // 왼쪽은 직급·이름 칸 + 앞쪽 지난달 날짜(26~31)를 못 읽었을 수 있어 넉넉히
  const x0 = Math.max(0, cols[0].x - colW * 11 - missing);
  const x1 = Math.min(W, cols[cols.length - 1].x + colW * 1.5 + missing);
  const ys = grid.rows.flatMap((r) => [r.y0 + grid.slope * x0, r.y0 + grid.slope * x1]);
  const tops = [grid.headerTop + grid.slope * x0, grid.headerTop + grid.slope * x1];
  const y0 = Math.max(0, Math.min(...tops) - grid.pitch * 2);
  const y1 = Math.min(H, Math.max(...ys) + grid.pitch * 1.2);
  // 표 자체 폭(이름 칸 ~ 마지막 날짜): 사진에서 표가 차지하는 비율 판단용 (여유 폭 제외)
  const core = Math.min(W, cols[cols.length - 1].x + colW) - Math.max(0, cols[0].x - colW * 5);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, core };
}

const median = (a) => {
  const s = [...a].sort((p, q) => p - q);
  return s.length ? s[s.length >> 1] : 0;
};

/** 원본 이미지에서 canvas 좌표 영역 잘라내기 (scale: canvas 폭 / 원본 폭) */
function cropImage(img, box, scale) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(box.w / scale));
  c.height = Math.max(1, Math.round(box.h / scale));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, box.x0 / scale, box.y0 / scale, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/** 표 전체(줄 × 날짜 열) 중 확신 있게 읽은 칸 비율 */
export function sureRatio(result) {
  const total = (result.names || []).length * (result.grid?.cols || []).length;
  if (!total) return 0;
  let sure = 0;
  Object.values(result.people || {}).forEach((cells) => {
    sure += Object.values(cells).filter((v) => v.confidence >= 60).length;
  });
  return sure / total;
}

/** 방향·명암을 바꿔 읽은 표 중 날짜 열과 사람 행이 더 온전한 결과를 선택. */
export function rosterStructureScore(result) {
  if (result?.error || !result?.grid) return 0;
  const { rows = [], cols = [], weekdays } = result.grid;
  if (cols.length < 8 || !rows.length) return 0;
  const weekdayFit = weekdays?.total >= 8 ? weekdays.match / weekdays.total : 1;
  return rows.length * Math.min(cols.length, 31) * (weekdayFit < 0.7 ? 0.25 : 1)
    + (result.names || []).filter((n) => nameQuality(n) >= 65).length;
}

/** 칸 글자 덩어리의 가로/세로 비율 (D·E·N·M 한 글자 ≈ 1, OFF 세 글자 ≈ 2.5) */
function inkAspect(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: W, height: H } = canvas;
  const d = ctx.getImageData(0, 0, W, H).data;
  // 잉크가 있는 열·행 (점 같은 작은 잡티는 무시: 한 열에 2픽셀 이상)
  const cols = new Uint16Array(W);
  const rows = new Uint16Array(H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4] < 128) {
        cols[x]++;
        rows[y]++;
      }
    }
  }
  const span = (arr) => {
    let a = -1;
    let b = -1;
    arr.forEach((v, i) => {
      if (v >= 2) {
        if (a < 0) a = i;
        b = i;
      }
    });
    return a < 0 ? 0 : b - a + 1;
  };
  const h = span(rows);
  return h ? span(cols) / h : 0;
}

/**
 * 2차 인식: 표 구조(행=이름, 열=날짜)를 알고 난 뒤 칸마다 잘라서 다시 읽는다.
 *  - 1회차: 단어 모드(PSM 8) — 영문 한두 글자(D/E/N/O/OFF) 정확도가 가장 높음
 *  - 2회차: 1회차에서 확신이 없는 칸만 한 줄 모드(PSM 7) — 한글(연차 등) 인식이 좋음
 */
async function refineCells(result, canvas, worker, shiftTypes, onProgress, rawCanvas = null, onNameProgress = () => {}) {
  const { grid } = result;

  // 이름 칸 다시 읽기: 원본에서 크게 잘라 (회색조·이진화) × (한 줄·여러 줄: 'N-keep' 같은 둘째 줄) 로 읽고
  // 가장 이름다운 결과 (성씨로 시작하는 2~4자, 인식 확신도) 선택. 1차에서 읽은 이름도 후보
  const nameSrc = rawCanvas || canvas;
  // 이름은 한글만: 흐린 한글이 'WEF' 같은 영문으로 읽히지 않게 영문·숫자·괄호 제외 (끝나면 해제)
  await worker.setParameters({ tessedit_char_blacklist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789[]{}|' });
  const renamed = new Map();
  const taken = new Set();
  for (const [rowIdx, row] of grid.rows.entries()) {
    onNameProgress(rowIdx, grid.rows.length);
    const cy = row.y0 + grid.slope * ((row.nameX0 + row.nameX1) / 2);
    const { ink } = cropCell(canvas, row.nameX0, cy - grid.pitch * 0.45, row.nameX1, cy + grid.pitch * 0.45, { filter: false });
    let name = row.name;
    let bestScore = nameQuality(name) ? nameQuality(name) + 6 : 0;
    if (ink >= 0.004) {
      // 여러 번 읽은 결과를 이름별로 점수 합산 (같은 이름이 여러 번 나오면 그 이름)
      const votes = new Map();
      const counts = new Map(); // 같은 이름이 몇 번 읽혔는지 → 성씨로 시작하는 세 글자 이름이 세 번 나오면 그만 읽음 (폰에서 시간 단축)
      if (nameQuality(name)) votes.set(name, nameQuality(name) + 6);
      let sure = false;
      // 줄 전체(80·120px) + 위쪽 60%('남영주 / (N-keep)'처럼 둘째 줄이 있는 칸의 이름 줄만)
      const crops = [
        [cy - grid.pitch * 0.48, cy + grid.pitch * 0.48, 80],
        [cy - grid.pitch * 0.48, cy + grid.pitch * 0.48, 120],
        [cy - grid.pitch * 0.48, cy + grid.pitch * 0.1, 80]
      ];
      for (const [top, bottom, targetH] of crops) {
        if (sure) break;
        const variants = cropNameVariants(nameSrc, row.nameX0, top, row.nameX1, bottom, targetH);
        for (const psm of ['7', '6']) {
          if (sure) break;
          await worker.setParameters({ tessedit_pageseg_mode: psm });
          for (const v of variants) {
            const { data } = await worker.recognize(v);
            const reread = extractName(data.text);
            const q = nameQuality(reread);
            if (!q) continue;
            votes.set(reread, (votes.get(reread) || 0) + q + data.confidence / 10);
            counts.set(reread, (counts.get(reread) || 0) + 1);
            if (q >= 80 && counts.get(reread) >= 3) {
              sure = true;
              break;
            }
          }
        }
      }
      [...votes.entries()].forEach(([n, score]) => {
        if (score > bestScore) {
          bestScore = score;
          name = n;
        }
      });
    }
    if (taken.has(name)) name = `${name}(${renamed.size + 1})`;
    taken.add(name);
    renamed.set(row, name);
  }
  await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_blacklist: '' });

  const cells = [];
  grid.rows.forEach((row) =>
    grid.cols.forEach((col) => {
      const cy = row.y0 + grid.slope * col.x;
      const half = grid.pitch * 0.45;
      const { canvas: cell, ink } = cropCell(canvas, col.x - col.w * 0.58, cy - half, col.x + col.w * 0.58, cy + half);
      const box = [col.x - col.w * 0.58, cy - half, col.x + col.w * 0.58, cy + half];
      if (ink >= 0.004) cells.push({ name: renamed.get(row), key: col.key, cell, box, aspect: inkAspect(cell), prev: result.people[row.name]?.[col.key] });
    })
  );

  const read = async (c) => {
    const { data } = await worker.recognize(c.cell);
    const raw = data.text.trim();
    let code = cellToCode(raw, shiftTypes);
    // 'D' 가 '0/O' 로 읽히는 경우가 잦음 → 모양으로 판별 (D 는 왼쪽 위 모서리가 채워져 있음)
    if (/^[0oOD]$/.test(raw.replace(/[^0-9a-z]/gi, '')) && looksLikeD(c.cell)) code = 'D';
    return { code, raw, confidence: data.confidence };
  };
  // 한 글자 근무(D·E·N·M)로 읽혔는데 글자 덩어리가 넓으면(OFF 처럼 여러 글자) 의심
  // (실험: 한 글자 칸 비율 ≤ 1.2, OFF 칸 ≥ 1.9. 흐린 사진에서 'OFF' 를 'D' 72% 로 읽은 경우)
  const tooWide = (c, o) => /^[A-Za-z]$/.test(o.code) && c.aspect >= 1.6;

  const total = cells.length * 1.4 || 1;
  let done = 0;
  const tick = () => {
    done += 1;
    if (done % 8 === 0) onProgress(Math.min(1, done / total));
  };

  await worker.setParameters({ tessedit_pageseg_mode: '8' });
  for (const c of cells) {
    c.word = await read(c);
    tick();
  }
  await worker.setParameters({ tessedit_pageseg_mode: '7' });
  for (const c of cells) {
    if (c.word.code && c.word.confidence >= 70 && !tooWide(c, c.word)) continue;
    c.line = await read(c);
    tick();
  }

  // 3회차: 그래도 못 읽은 칸은 흑백 보정 전 원본에서 다시 (색 배경 위 굵은 글씨는 보정하면 뭉개짐)
  if (rawCanvas && rawCanvas !== canvas) {
    const ok = (o) => o && o.code && o.confidence >= 60;
    for (const c of cells) {
      if (ok(c.word) || ok(c.line)) continue;
      const { canvas: cell, ink } = cropCell(rawCanvas, ...c.box);
      if (ink < 0.002) continue;
      await worker.setParameters({ tessedit_pageseg_mode: '8' });
      c.raw = await read({ cell });
      if (!ok(c.raw)) {
        await worker.setParameters({ tessedit_pageseg_mode: '7' });
        const line = await read({ cell });
        if (line.code && (!c.raw.code || line.confidence > c.raw.confidence)) c.raw = line;
      }
      tick();
    }
  }

  // 4회차: 원시 줄 모드(PSM 13)로 한 번 더 — ① 아무것도 못 읽은 칸 ② 읽은 결과끼리 다른 칸(투표용)
  //  - 글자 하나뿐인 'N' 칸을 단어·한 줄 모드가 빈 결과로 주는 경우 (실험: PSM 8·7·10 은 빈 결과, 13 은 N 92%)
  //  - 'OFF' 가 한 줄 모드에서 '야'(→N)로 읽히는 경우 → 여러 결과 투표로 바로잡음
  const readsOf = (c) => [c.word, c.line, c.raw].filter((o) => o && o.code);
  const needsVote = (c) => new Set(readsOf(c).map((o) => o.code)).size !== 1;
  if (cells.some(needsVote)) {
    await worker.setParameters({ tessedit_pageseg_mode: '13' });
    for (const c of cells) {
      if (!needsVote(c)) continue;
      const r13 = await read(c);
      if (!r13.code) continue;
      // 아무것도 못 읽었던 칸은 확신이 높을 때만 그대로, 아니면 '확인 필요'(노란 테두리)
      if (!readsOf(c).length) c.r13 = r13.confidence >= 85 ? r13 : { ...r13, confidence: Math.min(r13.confidence, 59) };
      else c.r13 = r13;
    }
  }

  const people = {};
  const unread = {};
  const unknown = {};
  grid.rows.forEach((r) => {
    people[renamed.get(r)] = {};
  });
  cells.forEach((c) => {
    // 칸만 잘라 읽은 결과가 우선. 1차(표 전체) 결과는 칸 인식이 모두 실패했을 때만 사용
    // (1차는 옆 줄 글자가 섞여 들어오는 경우가 있음)
    const options = [c.word, c.line, c.raw, c.r13].filter((o) => o && o.code);
    if (!options.length && c.prev?.code) options.push({ ...c.prev, confidence: Math.min(c.prev.confidence, 55) });
    // 두 글자 이상 한글(연차 등)은 한 줄 모드가 정확 → 우선. 한 글자 한글('야' 등)은 오인식이 잦아 우선하지 않음
    const korean = options.find((o) => /[가-힣]{2,}/.test(o.raw) && o.confidence >= 50);
    // 그 외: 같은 근무로 읽힌 결과들의 신뢰도 합이 가장 큰 근무 (그 근무 중 신뢰도 높은 결과를 대표로)
    let best = korean;
    if (!best && options.length) {
      const votes = new Map();
      options.forEach((o) => votes.set(o.code, (votes.get(o.code) || 0) + Math.max(o.confidence, 1)));
      const [code, weight] = [...votes.entries()].sort((x, y) => y[1] - x[1])[0];
      best = options.filter((o) => o.code === code).sort((x, y) => y.confidence - x.confidence)[0];
      // 결과가 갈렸고 압도적이지 않으면 '확인 필요'(노란 테두리)
      const share = weight / [...votes.values()].reduce((a, b) => a + b, 0);
      if (votes.size > 1 && share < 0.7) best = { ...best, confidence: Math.min(best.confidence, 59) };
    }
    // 'OFF' 근거가 글자 하나('O'·'0')뿐이면 작은 사진의 'D' 일 수 있음 → '확인 필요'
    const oneLetterOff = (o) => o.code === 'OFF' && /^[0oO]$/.test(String(o.raw || '').replace(/[^0-9a-z]/gi, ''));
    if (best && best.code === 'OFF' && options.filter((o) => o.code === 'OFF').every(oneLetterOff)) {
      best = { ...best, confidence: Math.min(best.confidence, 59) };
    }
    if (best && tooWide(c, best)) best = { ...best, confidence: Math.min(best.confidence, 59) };
    // 근거가 한글 한 글자('야' → N 등)뿐이면 오인식일 수 있음 → '확인 필요' (OFF 를 '야' 77% 로 읽은 경우)
    if (best && /^[가-힣]$/.test(String(best.raw || '').trim()) && options.every((o) => o.code !== best.code || /^[가-힣]$/.test(String(o.raw || '').trim()))) {
      best = { ...best, confidence: Math.min(best.confidence, 59) };
    }
    if (best) people[c.name][c.key] = { code: best.code, raw: best.raw, confidence: best.confidence };
    else {
      // 글자는 있는데 근무로 못 읽은 칸 → 확인 화면에서 '?' 로 표시
      unread[c.name] = [...(unread[c.name] || []), c.key];
      // 앱이 모르는 표기(D1·H2·T5 …)로 보이면 그 글자를 남겨 둠 → 가져올 때 무슨 근무인지 물음
      const token = unknownToken([c.word, c.line, c.raw, c.r13]);
      if (token) unknown[c.name] = { ...(unknown[c.name] || {}), [c.key]: token };
    }
  });

  Object.keys(people).forEach((n) => {
    if (!Object.keys(people[n]).length) delete people[n];
  });
  const names = grid.rows.map((r) => renamed.get(r)).filter((n) => people[n]);
  return { ...result, people, names, unread, unknown };
}

/** 여러 번 읽은 결과 중 근무 표기처럼 보이는 글자 (같은 글자로 읽힌 확신도 합이 가장 큰 것, 확신도 70 이상: 흐린 칸의 잡티 'LJ'·'ORR' 제외) */
function unknownToken(reads) {
  const votes = new Map();
  reads.forEach((o) => {
    if (!o || o.code || !looksLikeCode(o.raw) || o.confidence < 70) return;
    const t = normalizeToken(o.raw);
    votes.set(t, (votes.get(t) || 0) + o.confidence);
  });
  return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

/** 날짜 줄 위(제목이 있는 곳)만 잘라 읽기 */
async function readTitle(worker, src, headerTop) {
  const h = Math.max(20, Math.round(headerTop));
  if (!(h > 0)) return '';
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = h;
  c.getContext('2d').drawImage(src, 0, 0, src.width, h, 0, 0, src.width, h);
  await worker.setParameters({ tessedit_pageseg_mode: '6' });
  const { data } = await worker.recognize(c);
  await worker.setParameters({ tessedit_pageseg_mode: '11' });
  return data.text || '';
}

/**
 * @param file        이미지 파일
 * @param opts        { year, month, shiftTypes, onProgress(0~1, 메시지) }
 */
export async function recognizeRoster(file, { year, month, shiftTypes = [], onProgress = () => {}, signal } = {}) {
  // 취소(signal): 인식 엔진을 바로 멈추고 AbortError 로 끝냄
  const aborted = () => !!signal?.aborted;
  const abortError = () => new DOMException('사진 인식을 취소했어요.', 'AbortError');
  if (aborted()) throw abortError();
  onProgress(0.02, '사진 보정 중...');
  // 기울어진 사진은 먼저 바로 세움 (이후 모든 단계가 회전한 이미지 기준)
  const base = fitSize(await loadImage(file));
  let img = deskew(base);
  let canvas = preprocess(img);

  onProgress(0.06, '인식 엔진 준비 중... (처음 한 번은 조금 걸려요)');
  let stage = (p) => onProgress(0.1 + p * 0.3, `표 구조 분석 중... ${Math.round(p * 100)}%`);
  // 특정 칸에서 엔진이 죽으면 새로 만들어 이어서 (그 칸만 못 읽은 칸으로)
  const worker = await resilientWorker(() => createOcrWorker((p) => stage(p)), { isAborted: aborted });
  const stop = () => worker.terminate().catch(() => {});
  signal?.addEventListener('abort', stop, { once: true });
  // 진행 표시를 바꿀 때마다 취소 확인 (엔진을 멈춰도 다음 단계로 넘어가지 않게)
  const report = onProgress;
  onProgress = (p, msg) => {
    if (aborted()) throw abortError();
    report(p, msg);
  };

  try {
    let source = canvas;
    let result = parseRosterWords(await ocrWords(worker, canvas), { year, month, shiftTypes });
    let rawStructure = null;
    let rawResult = null;
    // 가로 사진의 연한 글자는 원본 명암으로 먼저 재시도. 정상 사진에서 불필요하게 세 방향을 더 읽지 않음.
    if (result.error && widthOf(base) >= heightOf(base)) {
      rawStructure = scaledCanvas(img);
      rawResult = parseRosterWords(await ocrWords(worker, rawStructure), { year, month, shiftTypes });
      if (!rawResult.error) { result = rawResult; source = rawStructure; }
    }
    // 세로로 누운 사진은 일부 숫자·이름만 읽혀도 성공으로 보일 수 있으므로 네 방향을 비교.
    // 첫 번째로 표가 보인 방향에서 멈추지 않고, 사람 행·날짜 열이 가장 온전한 방향을 고름.
    if (result.error || heightOf(base) > widthOf(base)) {
      const turns = [90, 270, 180];
      let best = { turned: img, c: canvas, source, r: result };
      for (const [i, deg] of turns.entries()) {
        stage = (p) => onProgress(0.1 + p * 0.3, `사진 방향 확인 중... (${i + 1}/${turns.length})`);
        const turned = deskew(rotateQuarter(base, deg));
        const c = preprocess(turned);
        const r = parseRosterWords(await ocrWords(worker, c), { year, month, shiftTypes });
        if (rosterStructureScore(r) > rosterStructureScore(best.r)) best = { turned, c, source: c, r };
      }

      if (best.turned !== img) { rawStructure = null; rawResult = null; }
      img = best.turned;
      canvas = best.c;
      source = best.source;
      result = best.r;
    }
    // 보정 이미지에서 표를 못 찾으면 원본으로 한 번 더
    if (result.error) {
      const raw = rawStructure || scaledCanvas(img);
      const retry = rawResult || parseRosterWords(await ocrWords(worker, raw), { year, month, shiftTypes });
      rawStructure = raw;
      rawResult = retry;
      if (!retry.error) {
        result = retry;
        source = raw;
      }
    }
    // 그래도 못 찾으면 더 크게(폭 3600px) 한 번 더: 화면 캡처·멀리서 찍은 사진은 표가 작아 날짜 숫자를 못 읽음
    if (result.error) {
      stage = (p) => onProgress(0.1 + p * 0.3, `표 찾는 중 (크게 보기)... ${Math.round(p * 100)}%`);
      const big = preprocess(img, BIG_WIDTH);
      const r = parseRosterWords(await ocrWords(worker, big), { year, month, shiftTypes });
      if (!r.error) {
        result = r;
        source = big;
      }
    }
    if (result.error) return result;
    // 날짜 숫자를 여러 개 못 읽었으면(끊긴 표 선이 숫자에 붙어 '|1|2|3|' 으로 읽힘) 끊긴 선까지 지운 이미지로 다시 읽어
    // 날짜 숫자를 더 많이 읽고 사람 줄이 줄지 않으면 그쪽으로 (짐작한 칸보다 읽은 칸이 정확)
    let strongLines = false;
    if (source === canvas && result.colsDetected < result.grid.cols.length - 3) {
      stage = (p) => onProgress(0.1 + p * 0.3, `표 선 지우고 다시 보는 중... ${Math.round(p * 100)}%`);
      const strong = preprocess(img, TARGET_WIDTH, { strongLines: true });
      const r = parseRosterWords(await ocrWords(worker, strong), { year, month, shiftTypes });
      if (!r.error && r.colsDetected > result.colsDetected && r.grid.cols.length >= result.grid.cols.length && r.grid.rows.length >= result.grid.rows.length) {
        canvas = strong;
        source = strong;
        result = r;
        strongLines = true;
      }
    }
    // 이진화가 연한 글자·색 바탕 위 근무를 지울 수 있음. 원본 명암으로도 읽어 빠진 행을 복구.
    rawStructure ||= scaledCanvas(img);
    rawResult ||= parseRosterWords(await ocrWords(worker, rawStructure), { year, month, shiftTypes });
    if (!rawResult.error && rawResult.year === result.year && rawResult.month === result.month
      && rawResult.grid.rows.length > result.grid.rows.length
      && rawResult.grid.cols.map((c) => c.key).join() === result.grid.cols.map((c) => c.key).join()
      && rosterStructureScore(rawResult) > rosterStructureScore(result)) {
      // 원본은 빠진 행의 좌표만 보완. 칸별 인식은 표 선을 제거한 보정 이미지를 유지.
      source = canvas.width === rawStructure.width && canvas.height === rawStructure.height ? canvas : rawStructure;
      result = rawResult;
    }
    // 표가 사진 일부만 차지하면(브라우저·엑셀 화면 캡처, 멀리서 찍은 사진) 글자가 작고 옆 메뉴 글자가 이름에 섞임
    // → 표 부분만 잘라 크게 다시 읽음 (같은 달·같은 줄 수로 읽힐 때만 바꿈)
    let srcTarget = TARGET_WIDTH; // source(보정 이미지)를 만든 폭
    let cropWidth = TARGET_WIDTH;
    const box = tableBox(result.grid, source.width, source.height);
    if (box && box.core < source.width * 0.75) {
      stage = (p) => onProgress(0.1 + p * 0.3, `표 부분 확대해서 읽는 중... ${Math.round(p * 100)}%`);
      const srcScale = source.width / widthOf(img);
      const cropped = cropImage(img, box, srcScale);
      // 글자 크기 기준으로 확대: 날짜 숫자 높이가 약 30px 이 되게 (고정 폭으로 키우면 글자가 너무 커져 오히려 못 읽음)
      const digitH = (result.grid.textH || 12) / srcScale;
      cropWidth = Math.round(Math.min(3000, Math.max(1200, (widthOf(cropped) * 30) / digitH)));
      const c2 = preprocess(cropped, cropWidth, { strongLines });
      const r2 = parseRosterWords(await ocrWords(worker, c2), { year, month, shiftTypes });
      // 확대해서 제목(2026년 11월)을 읽었거나, 날짜 아래 요일 줄과 더 잘 맞으면(칸 날짜가 맞음) 그 결과를 믿음
      const sameMonth = (r2.year === result.year && r2.month === result.month) || (r2.found && !result.found);
      const wd = (r) => (r.grid?.weekdays?.total >= 8 ? r.grid.weekdays.match / r.grid.weekdays.total : null);
      const betterDays = !r2.error && wd(r2) !== null && wd(r2) >= 0.8 && (wd(result) === null || wd(r2) > wd(result));
      const bigEnough = !r2.error && r2.grid.cols.length >= result.grid.cols.length - 2 && r2.grid.rows.length >= result.grid.rows.length;
      if (!r2.error && ((sameMonth && bigEnough) || (betterDays && r2.grid.rows.length >= result.grid.rows.length))) {
        img = cropped;
        canvas = c2;
        source = c2;
        result = r2;
        srcTarget = cropWidth;
      }
    }
    // 원본(보정 전) 이미지를 source 와 같은 배율로 (크게 보기로 찾았으면 배율이 달라 source 그대로)
    const rawAtSource = () => (source.width === preprocessWidth(img, srcTarget) ? scaledCanvas(img, srcTarget) : source);
    // 제목(2026년 9월)을 못 읽었으면 날짜 줄 위쪽만 잘라 한 번 더 (표 전체를 읽을 때는 제목이 빠지기도 함)
    if (!result.found && result.grid) {
      const titleText = await readTitle(worker, rawAtSource(), result.grid.headerTop);
      if (titleText) {
        const again = parseRosterWords(await ocrWords(worker, source), { year, month, shiftTypes, titleText });
        if (!again.error && again.found) result = again;
      }
    }
    stage = () => {};
    onProgress(0.4, '이름 확인 중...');
    result = await refineCells(
      result,
      source,
      worker,
      shiftTypes,
      (p) => onProgress(0.5 + p * 0.48, `칸별 정밀 인식 중... ${Math.round(p * 100)}%`),
      source === canvas ? rawAtSource() : null,
      // 이름 다시 읽기 단계도 진행률 표시 (멈춘 것처럼 보이지 않게)
      (i, n) => onProgress(0.4 + (i / n) * 0.1, `이름 확인 중... ${i + 1}/${n}`)
    );
    // 확실히 읽은 칸이 표의 40% 도 안 되면 표 구조를 잘못 잡은 것 → 엉뚱한 근무를 넣지 않고 다시 찍기 안내
    // (실험: 정상 사진 0.68~1.0, 아주 흐린 작은 사진 0.09)
    if (sureRatio(result) < 0.4) return { error: '사진이 흐려서 근무를 거의 읽지 못했어요. 표에 가까이, 밝은 곳에서 초점을 맞춰 다시 찍어 주세요.' };
    onProgress(1, '완료');
    return result;
  } catch (e) {
    if (aborted()) throw abortError();
    throw e;
  } finally {
    signal?.removeEventListener('abort', stop);
    await worker.terminate().catch(() => {});
  }
}

// ── 내 줄만 골라 읽기 ─────────────────────────────────────────────
// 사람이 많아 글씨가 작거나, 표가 둘로 나뉘거나, 손글씨·그림(♡) 표기라 표 전체 인식이 안 되는 근무표:
// 사진에서 날짜 줄과 내 줄을 누르면 그 두 줄만 크게 잘라 읽음

export const BLANK_TOKEN = '빈칸';
export const HEART_TOKEN = '♡';

/** 내 줄 고르기 화면에 보여 줄 사진 (기울기 바로 세움). 누른 위치는 이 canvas 좌표 */
export async function rowPickImage(file) {
  const img = deskew(fitSize(await loadImage(file)));
  if (img instanceof HTMLCanvasElement) return img;
  const c = document.createElement('canvas');
  c.width = widthOf(img);
  c.height = heightOf(img);
  c.getContext('2d').drawImage(img, 0, 0);
  return c;
}

/**
 * 누른 높이 y 를 감싸는 표 줄의 위·아래 (가로선 사이). 선을 못 찾으면 사진 높이의 1.2% 높이로
 * 사진이 비스듬하면 가로선이 폭 전체로는 번져 보여서, 폭의 일부 구간(from~to, 0~1)에서만 찾음
 * @returns [top, bottom]
 */
export function rowBandAt(canvas, y, from = 0.35, to = 0.65) {
  const W = canvas.width;
  const H = canvas.height;
  const reach = Math.max(30, Math.round(H * 0.025));
  const top = Math.max(0, Math.round(y - reach));
  const bottom = Math.min(H, Math.round(y + reach));
  const x0 = Math.round(W * from);
  const x1 = Math.round(W * to);
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(x0, top, x1 - x0, Math.max(1, bottom - top)).data;
  const w = x1 - x0;
  // 가로선: 구간 폭의 상당 부분을 끊김 없이 이어지는 어두운 줄 (글자 가로 획은 칸마다 끊김)
  // 사진이 살짝 비스듬해도 이어지게 위아래 1px 까지 보고, 3px 이하 틈은 이음
  const rows = bottom - top;
  const dark = new Uint8Array(rows * w);
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < w; x++) {
      const i = (r * w + x) * 4;
      dark[r * w + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 150 ? 1 : 0;
    }
  }
  const run = [];
  for (let r = 0; r < rows; r++) {
    let best = 0;
    let start = -1;
    let last = -10;
    for (let x = 0; x < w; x++) {
      const on = dark[r * w + x] || (r > 0 && dark[(r - 1) * w + x]) || (r < rows - 1 && dark[(r + 1) * w + x]);
      if (!on) continue;
      if (x - last > 4) start = x;
      last = x;
      best = Math.max(best, x - start + 1);
    }
    run.push(best / w);
  }
  const at = (r) => run[Math.min(rows - 1, Math.max(0, r))];
  const isLine = (r) => run[r] >= 0.25 && run[r] >= Math.max(at(r - 1), at(r + 1));
  const rel = Math.round(y - top);
  let up = rel;
  while (up > 0 && !isLine(up)) up--;
  let down = rel;
  while (down < rows - 1 && !isLine(down)) down++;
  const fallback = Math.round(H * 0.006);
  const t = up > 0 ? top + up + 2 : y - fallback;
  const b = down < rows - 1 ? top + down - 2 : y + fallback;
  return b - t > 8 ? [Math.round(t), Math.round(b)] : [Math.round(y - fallback), Math.round(y + fallback)];
}

/**
 * 누른 줄의 위·아래를 왼쪽·오른쪽 구간에서 따로 찾아 x 에 따라 이어 줌 (비스듬한 사진)
 * @returns { top(x), bottom(x), at: [가운데 위, 가운데 아래] }
 */
export function slantedBand(canvas, y, typicalH = 0) {
  let mid = rowBandAt(canvas, y);
  // 흐린 가로선을 못 찾아 두세 줄이 한 줄로 잡히면: 누른 곳을 가운데로 보통 줄 높이만큼 (보통 줄 높이 = 날짜 줄 높이)
  // 가로선을 아예 못 찾은 경우(기본 높이)도 보통 줄 높이로
  const guessed = mid[1] - mid[0] === 2 * Math.round(canvas.height * 0.006);
  if (typicalH && (mid[1] - mid[0] > typicalH * 1.5 || guessed)) mid = [Math.round(y - typicalH / 2), Math.round(y + typicalH / 2)];
  const c = (mid[0] + mid[1]) / 2;
  const h = mid[1] - mid[0];
  const side = (from, to) => {
    const b = rowBandAt(canvas, c, from, to);
    // 줄 높이가 많이 다르거나 이웃 줄을 잡았으면(가운데가 반 줄 넘게 어긋남) 그 구간은 못 찾은 것
    return Math.abs(b[1] - b[0] - h) < h * 0.35 && Math.abs((b[0] + b[1]) / 2 - c) < h * 0.4 ? b : mid;
  };
  const L = side(0.15, 0.35);
  const R = side(0.65, 0.85);
  const xl = canvas.width * 0.25;
  const xr = canvas.width * 0.75;
  const lerp = (a, b) => (x) => a + ((b - a) * (x - xl)) / (xr - xl);
  return { top: lerp(L[0], R[0]), bottom: lerp(L[1], R[1]), at: mid };
}

/** 띠 [y0, y1] 안의 세로선 x 위치들 (띠 높이 대부분이 어두운 세로 줄) */
function verticalLines(canvas, y0, y1) {
  const W = canvas.width;
  const h = Math.max(1, Math.round(y1 - y0));
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, Math.round(y0), W, h).data;
  const lum = (x, y) => {
    const i = (y * W + x) * 4;
    return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  };
  // 칸 배경(회색 주말 칸 등)보다 확실히 어두운 픽셀: 그 줄 양옆 6px 평균보다 어두움
  const xs = [];
  for (let x = 3; x < W - 3; x++) {
    let dark = 0;
    for (let y = 0; y < h; y++) {
      const v = lum(x, y);
      if (v < 170 && v < (lum(x - 3, y) + lum(x + 3, y)) / 2 - 12) dark++;
    }
    if (dark >= h * 0.6) xs.push(x);
  }
  const lines = [];
  xs.forEach((x) => {
    const last = lines[lines.length - 1];
    if (last && x - last[last.length - 1] <= 2) last.push(x);
    else lines.push([x]);
  });
  return lines.map((g) => (g[0] + g[g.length - 1]) / 2);
}

/**
 * 세로선 사이 칸들 중 날짜 칸 너비(가장 흔한 너비)와 비슷한 칸 → [{ x0, x1, x }]
 * 흐려서 세로선 몇 개를 못 찾은 자리(칸 2~4개 너비)는 같은 너비로 나눔. 이름·사번처럼 넓은 칸은 앞쪽에서만 나타나 제외
 */
function dateCells(lines) {
  const gaps = lines.slice(1).map((x, i) => ({ x0: lines[i], x1: x, w: x - lines[i] }));
  const ws = gaps.map((g) => g.w).filter((w) => w > 8).sort((a, b) => a - b);
  const typical = ws[Math.floor(ws.length / 2)] || 0;
  const cells = [];
  gaps.forEach((g) => {
    const n = Math.round(g.w / typical);
    if (g.w < typical * 0.6) return;
    if (n <= 1 && g.w <= typical * 1.5) cells.push({ x0: g.x0, x1: g.x1 });
    else if (n >= 2 && n <= 4 && cells.length && Math.abs(g.w / n - typical) < typical * 0.25) {
      for (let k = 0; k < n; k++) cells.push({ x0: g.x0 + (g.w * k) / n, x1: g.x0 + (g.w * (k + 1)) / n });
    }
  });
  return cells.map((c) => ({ ...c, x: (c.x0 + c.x1) / 2 }));
}

/** 칸 안쪽을 키워 흰 여백을 둔 새 canvas (Tesseract 용) */
function cellImage(canvas, x0, y0, x1, y1, targetH = 64) {
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const k = targetH / h;
  const pad = Math.round(targetH * 0.3);
  const c = document.createElement('canvas');
  c.width = Math.round(w * k) + pad * 2;
  c.height = Math.round(h * k) + pad * 2;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, x0, y0, w, h, pad, pad, w * k, h * k);
  return c;
}

/** 칸 안 글자만 검정, 나머지(회색·색 바탕, 연한 선)는 흰색으로 키운 canvas (손글씨 인식용) */
function cellInkImage(canvas, x0, y0, x1, y1, targetH = 96) {
  const c = cellImage(canvas, x0, y0, x1, y1, targetH);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const lum = [];
  for (let i = 0; i < d.length; i += 4) lum.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  const inside = lum.filter((v, i) => v < 250 || i % 7 === 0);
  const bg = [...inside].sort((a, b) => a - b)[Math.floor(inside.length * 0.7)];
  for (let i = 0; i < lum.length; i++) {
    const v = lum[i] < bg * 0.72 ? 0 : 255;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** 칸 안 글자 잉크 비율 (칸 배경보다 확실히 어두운 픽셀) */
function inkRatio(canvas, x0, y0, x1, y1) {
  const w = Math.max(1, Math.round(x1 - x0));
  const h = Math.max(1, Math.round(y1 - y0));
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(Math.round(x0), Math.round(y0), w, h).data;
  const lum = [];
  for (let i = 0; i < d.length; i += 4) lum.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  const bg = [...lum].sort((a, b) => a - b)[Math.floor(lum.length * 0.7)]; // 바탕 밝기
  return lum.filter((v) => v < bg * 0.7).length / lum.length;
}

/** 칸 안 글자(잉크)가 분홍 펜인지: 잉크 픽셀의 평균 (빨강 - 초록), 파랑이 초록 이상 (검정 글씨 ≈ 0, 연한 분홍 ♡ ≈ 25~40) */
function inkPinkness(canvas, x0, y0, x1, y1) {
  const w = Math.max(1, Math.round(x1 - x0));
  const h = Math.max(1, Math.round(y1 - y0));
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(Math.round(x0), Math.round(y0), w, h).data;
  const px = [];
  for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2], 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]]);
  const bg = [...px].sort((a, b) => a[3] - b[3])[Math.floor(px.length * 0.7)][3];
  const ink = px.filter((p) => p[3] < bg * 0.7);
  if (!ink.length) return 0;
  const rg = ink.reduce((a, p) => a + p[0] - p[1], 0) / ink.length;
  const bgDiff = ink.reduce((a, p) => a + p[2] - p[1], 0) / ink.length;
  return bgDiff >= 0 ? rg : 0;
}

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const WD_CHARS = '일월화수목금토';
/** 손글씨 한 글자가 두 번 읽힌 경우 ('VV' → 'V') */
const collapseRepeat = (t) => (/^(.)\1$/.test(t) ? t[0] : t);

/** 칸 안 글자 모양: 잉크가 있는 범위만 16×16 회색 격자로 (모양 비교용) */
function inkShape(canvas, x0, y0, x1, y1) {
  const w = Math.max(1, Math.round(x1 - x0));
  const h = Math.max(1, Math.round(y1 - y0));
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(Math.round(x0), Math.round(y0), w, h).data;
  const lum = [];
  for (let i = 0; i < d.length; i += 4) lum.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  const bg = [...lum].sort((a, b) => a - b)[Math.floor(lum.length * 0.7)];
  const ink = (x, y) => lum[y * w + x] < bg * 0.7;
  let [l, t, r, b] = [w, h, -1, -1];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink(x, y)) [l, t, r, b] = [Math.min(l, x), Math.min(t, y), Math.max(r, x), Math.max(b, y)];
  const N = 16;
  const grid = new Float32Array(N * N);
  if (r < l) return grid;
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const sx0 = l + Math.floor(((r - l + 1) * gx) / N);
      const sx1 = Math.max(sx0 + 1, l + Math.floor(((r - l + 1) * (gx + 1)) / N));
      const sy0 = t + Math.floor(((b - t + 1) * gy) / N);
      const sy1 = Math.max(sy0 + 1, t + Math.floor(((b - t + 1) * (gy + 1)) / N));
      let n = 0;
      let k = 0;
      for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++, k++) if (ink(x, y)) n++;
      grid[gy * N + gx] = n / Math.max(1, k);
    }
  }
  return grid;
}

/** 두 글자 모양의 차이 0~1 */
const shapeDistance = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

/**
 * 날짜 줄·내 줄만 읽기
 *  - 날짜 칸: 날짜 줄의 세로선으로 칸을 나누고 칸마다 숫자 하나씩 (표 선이 숫자에 붙어도 됨)
 *  - 연/월: 바로 아래 요일 줄로 확인 (보고 있던 달 기준)
 *  - 내 줄: 같은 칸 위치(내 줄 세로선에 맞춰 보정)마다 빈칸 · ♡(분홍 펜) · 글자
 * @param canvas  rowPickImage 로 만든 사진
 * @param dateY   날짜 줄(1 2 3 …)을 누른 높이 · rowY 내 줄을 누른 높이 (canvas 좌표)
 * @returns recognizeRoster 와 같은 모양 { year, month, names: ['내 줄'], people, unread, unknown } 또는 { error }
 */
export async function readMyRow(canvas, { dateY, rowY, year, month, shiftTypes = [], today = new Date(), onProgress = () => {}, signal } = {}) {
  const abortError = () => new DOMException('사진 인식을 취소했어요.', 'AbortError');
  if (signal?.aborted) throw abortError();
  onProgress(0.05, '인식 엔진 준비 중... (처음 한 번은 조금 걸려요)');
  const worker = await resilientWorker(() => createOcrWorker(() => {}), { isAborted: () => !!signal?.aborted });
  const stop = () => worker.terminate().catch(() => {});
  signal?.addEventListener('abort', stop, { once: true });
  const check = () => {
    if (signal?.aborted) throw abortError();
  };
  try {
    // 1) 날짜 칸
    const hb = slantedBand(canvas, dateY);
    const [h0, h1] = hb.at;
    const head = dateCells(verticalLines(canvas, h0, h1));
    if (head.length < 7) return { error: '날짜 줄(1 2 3 …)의 칸을 찾지 못했어요. 날짜 숫자가 있는 줄을 다시 눌러 주세요.' };
    await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789' });
    const days = [];
    for (const [i, c] of head.entries()) {
      check();
      onProgress(0.1 + (i / head.length) * 0.25, `날짜 읽는 중... ${i + 1}/${head.length}`);
      const m = (c.x1 - c.x0) * 0.12; // 칸 양옆 선 조각 제외
      const img = cellImage(canvas, c.x0 + m, hb.top(c.x), c.x1 - m, hb.bottom(c.x));
      for (const psm of ['7', '8']) {
        await worker.setParameters({ tessedit_pageseg_mode: psm });
        const { data } = await worker.recognize(img);
        const n = parseInt(data.text.replace(/\D/g, ''), 10);
        if (n >= 1 && n <= 31 && data.confidence >= 30) {
          days.push({ col: i, day: n });
          break;
        }
      }
    }
    // 읽은 숫자들과 가장 많이 맞는 '연속한 날짜' (못 읽거나 잘못 읽은 칸은 앞뒤 날짜로)
    // 26 27 … 31 1 2 … 처럼 달이 넘어가는 표는 넘어간 뒤 숫자가 (지난달 날 수)만큼 작음
    const fits = (start, q) => [0, 28, 29, 30, 31].includes(start + q.col - q.day);
    let best = null;
    days.forEach(({ col, day }) => {
      const start = day - col; // 첫 칸 날짜
      const hits = days.filter((q) => fits(start, q)).length;
      if (!best || hits > best.hits) best = { start, hits };
    });
    if (!best || best.hits < Math.max(4, head.length * 0.25)) return { error: '날짜 숫자를 읽지 못했어요. 날짜 숫자가 있는 줄을 다시 눌러 주세요.' };
    const wraps = days.map((q) => best.start + q.col - q.day).filter((v) => v >= 28);
    const len = wraps.length >= 2 ? wraps.sort((a, b) => a - b)[Math.floor(wraps.length / 2)] : 0; // 지난달 날 수 (넘어가지 않으면 0)
    const dayOf = (col) => {
      const v = best.start + col;
      return len && v > len ? v - len : v;
    };
    const dayRow = head.map((_, col) => ({ col, day: dayOf(col) })).filter((q) => q.day >= 1 && q.day <= 31);

    // 2) 요일 줄로 연/월 확인 (요일 글자만 흑백으로 키워 한 글자씩)
    await worker.setParameters({ tessedit_pageseg_mode: '10', tessedit_char_whitelist: '' });
    const wb = slantedBand(canvas, h1 + (h1 - h0) * 0.7);
    const weekdays = {};
    for (const [i, c] of head.entries()) {
      check();
      onProgress(0.35 + (i / head.length) * 0.15, '요일 확인 중...');
      const m = (c.x1 - c.x0) * 0.12;
      const { data } = await worker.recognize(cellInkImage(canvas, c.x0 + m, hb.bottom(c.x) + 2, c.x1 - m, wb.bottom(c.x) - 1, 80));
      const ch = [...data.text].find((t) => WD_CHARS.includes(t));
      if (ch) weekdays[i] = WD_CHARS.indexOf(ch);
    }
    const ym = checkDayRowMonth({ days: dayRow, weekdays, ym: { year, month }, found: false, today });
    // 1일부터 시작하는 표인데 오른쪽 끝 칸(30·31일)의 세로선을 못 찾아 빠졌으면, 그 자리에 세로선이 있을 때 이어 붙임
    const monthLen = new Date(ym.year, ym.month, 0).getDate();
    if (!len && dayRow[0]?.day === 1) {
      // 날짜 줄 안쪽 높이에서만 찾음 (줄을 조금 넓게 잡아 표 바깥 모서리가 섞이면 끝 선이 약하게 보임)
      const lines = verticalLines(canvas, h0 + (h1 - h0) * 0.3, h1 - (h1 - h0) * 0.1);
      while (dayRow[dayRow.length - 1].day < monthLen) {
        const last = head[head.length - 1];
        const w = last.x1 - last.x0;
        const next = lines.find((l) => Math.abs(l - (last.x1 + w)) < w * 0.3);
        if (next === undefined) break;
        head.push({ x0: last.x1, x1: next, x: (last.x1 + next) / 2 });
        dayRow.push({ col: head.length - 1, day: dayRow[dayRow.length - 1].day + 1 });
      }
    }
    const keyOfCol = Object.fromEntries(datesForDayRow(dayRow, ym.year, ym.month).map(({ col, key }) => [col, key]));

    // 3) 내 줄: 같은 칸 위치(내 줄 세로선에 맞춰 보정)마다 빈칸 · ♡ · 글자
    const rb = slantedBand(canvas, rowY, h1 - h0);
    const [r0, r1] = rb.at;
    const rowLines = verticalLines(canvas, r0, r1);
    const people = {};
    const unknown = {};
    const unread = [];
    // 날짜 줄 칸 경계를 표 세로선을 따라 내 줄까지 내려가며 맞춤
    // (사진 원근으로 아래 줄일수록 칸이 조금씩 밀리고 좁아짐 → 줄마다 가까운 세로선에 직선으로 맞춤)
    const cw = (head[head.length - 1].x1 - head[0].x0) / head.length;
    const fitLine = (pairs) => {
      const n = pairs.length;
      const mh = pairs.reduce((a, p) => a + p[0], 0) / n;
      const mr = pairs.reduce((a, p) => a + p[1], 0) / n;
      const v = pairs.reduce((a, p) => a + (p[0] - mh) ** 2, 0) || 1;
      const b = pairs.reduce((a, p) => a + (p[0] - mh) * (p[1] - mr), 0) / v;
      return (x) => mr + b * (x - mh);
    };
    const follow = (xs, lines) => {
      const pairs = xs
        .map((x) => [x, lines.reduce((b, l) => (Math.abs(l - x) < Math.abs(b - x) ? l : b), Infinity)])
        .filter(([x, l]) => Math.abs(l - x) < cw * 0.3);
      if (pairs.length < Math.max(5, xs.length * 0.3)) return xs;
      const f = fitLine(pairs);
      const next = xs.map(f);
      // 한 줄 내려가며 칸 폭이 3% 넘게 바뀌면 잘못 짝지은 것 (원근 변화는 줄마다 아주 작음)
      const span = (a) => a[a.length - 1] - a[0];
      return Math.abs(span(next) / span(xs) - 1) > 0.03 ? xs : next;
    };
    let bounds = [...head.map((c) => c.x0), head[head.length - 1].x1];
    const stepH = Math.max(12, r1 - r0);
    const down = r0 > h1;
    for (let y = down ? h1 : h0 - stepH; down ? y < r0 : y > r1; y += down ? stepH : -stepH) {
      bounds = follow(bounds, verticalLines(canvas, y, y + stepH));
    }
    bounds = follow(bounds, rowLines);
    const cells = head.map((c, i) => ({ i, x0: bounds[i], x1: bounds[i + 1] }));
    // 칸마다: 빈칸 · ♡(분홍 펜) · 글자 모양. 손글씨는 글자 인식이 칸마다 흔들리므로('X' → 'XE', 'XI')
    // 모양이 같은 칸끼리 묶고, 묶음 안에서 가장 많이 읽힌 글자를 그 표기로
    const marks = [];
    const cellImages = {}; // 확인 화면에 날짜마다 보여 줄 사진 속 칸
    for (const c of cells) {
      const key = keyOfCol[c.i];
      if (!key) continue;
      const cx = (c.x0 + c.x1) / 2;
      const [t, b] = [rb.top(cx), rb.bottom(cx)];
      cellImages[key] = cellImage(canvas, c.x0, t, c.x1, b, 44).toDataURL('image/jpeg', 0.85);
      const w = c.x1 - c.x0;
      const box = [c.x0 + w * 0.1, t + (b - t) * 0.08, c.x1 - w * 0.1, b - (b - t) * 0.08];
      // 빈칸: 칸 테두리 선 조각(잉크 약 3%)보다 적은 잉크
      if (inkRatio(canvas, ...box) < 0.06) unknown[key] = BLANK_TOKEN;
      else marks.push({ key, box, pink: inkPinkness(canvas, ...box) >= 15, shape: inkShape(canvas, ...box) });
    }
    const groups = [];
    marks.forEach((m) => {
      const g = groups.find((q) => q[0].pink === m.pink && shapeDistance(q[0].shape, m.shape) < 0.17);
      if (g) g.push(m);
      else groups.push([m]);
    });
    const samples = {};
    let done = 0;
    // 묶음마다 글자 인식 투표
    for (const g of groups) {
      // 영문·숫자 표기 먼저(손글씨가 한글 글자로 읽히지 않게), 안 되면 한글 근무 표기('주'·'야' 등)까지
      const votes = new Map();
      for (const m of g.slice(0, 5)) {
        check();
        onProgress(0.5 + (done++ / marks.length) * 0.48, `내 줄 읽는 중... ${done}/${marks.length}`);
        // 흑백으로 또렷하게 → 안 되면 원래 명암 (가는 글씨는 흑백으로 바꾸면 획이 끊김)
        const ink = cellInkImage(canvas, ...m.box);
        const gray = cellImage(canvas, ...m.box, 96);
        for (const [img, psm, list] of [[ink, '10', LATIN], [gray, '10', LATIN], [ink, '8', LATIN], [ink, '8', '']]) {
          await worker.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: list });
          const { data } = await worker.recognize(img);
          const t = collapseRepeat(normalizeToken(data.text));
          // 한글은 근무로 아는 글자('주'·'야' 등)만 (손글씨가 '미'·'기' 같은 엉뚱한 한글로 읽힘)
          const ok = cellToCode(t, shiftTypes) || (list && looksLikeCode(t));
          if (data.confidence >= 40 && ok) {
            votes.set(t, (votes.get(t) || 0) + data.confidence);
            break;
          }
        }
      }
      await worker.setParameters({ tessedit_char_whitelist: '' });
      const [text, weight = 0] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0] || [];
      // 분홍 펜(♡ 등 그림)은 확실히 근무 글자로 읽힐 때만 그 글자 (빨간 'OF' 등)
      g.text = text && (!g[0].pink || (cellToCode(text, shiftTypes) && weight >= 70 * Math.min(g.length, 5) * 0.6)) ? text : '';
    }
    groups.forEach((g) => {
      // 'O'·'0' 한 글자는 흐린 'D' 일 때가 많아 자동으로 넣지 않고 그림과 함께 물음
      const code = g.text && !/^[O0]$/.test(g.text) && cellToCode(g.text, shiftTypes);
      // 글자로 못 읽은 표시는 '♡' 또는 '기호1'처럼 이름 붙이고 칸 그림을 보여 주고 물음
      const token = code ? null : g.text || (g[0].pink ? HEART_TOKEN : `기호${Object.keys(samples).filter((k) => k.startsWith('기호')).length + 1}`);
      if (token && !samples[token]) samples[token] = cellImage(canvas, ...g[0].box, 48).toDataURL('image/png');
      g.forEach((m) => {
        if (code) people[m.key] = { code, raw: g.text, confidence: 80 };
        else unknown[m.key] = token;
      });
    });
    onProgress(1, '완료');
    const name = '내 줄';
    return { year: ym.year, month: ym.month, found: true, names: [name], people: { [name]: people }, unknown: { [name]: unknown }, unread: { [name]: unread }, samples, cellImages };
  } catch (e) {
    if (signal?.aborted) throw abortError();
    throw e;
  } finally {
    signal?.removeEventListener('abort', stop);
    await worker.terminate().catch(() => {});
  }
}
