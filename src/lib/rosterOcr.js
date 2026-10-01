// src/lib/rosterOcr.js
// 근무표 사진 → 단어 좌표 (Tesseract.js, 기기 안에서 처리 / 무료 / 서버 전송 없음)
// 인식률을 위해: 해상도 정규화 → 흑백 → 조명 보정(적응형 이진화) → 표 선 제거 후 OCR
import { parseRosterWords, cellToCode, extractName, nameQuality } from './rosterParse';

const TARGET_WIDTH = 2400;

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
  const xs = [];
  const ys = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 150) {
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

/** 적응형 이진화 + 긴 가로/세로 선 제거 → canvas */
export function preprocess(img) {
  const scale = Math.min(3, TARGET_WIDTH / widthOf(img));
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
  const minH = Math.round(w / 12);
  const minV = Math.round(h / 12);
  const erase = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && bin[y * w + x]) run++;
      else {
        if (run >= minH) for (let k = x - run; k < x; k++) erase[y * w + k] = 1;
        run = 0;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y <= h; y++) {
      if (y < h && bin[y * w + x]) run++;
      else {
        if (run >= minV) for (let k = y - run; k < y; k++) erase[k * w + x] = 1;
        run = 0;
      }
    }
  }

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
      if (m.status === 'recognizing text') onProgress(m.progress);
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
function scaledCanvas(img) {
  const scale = Math.min(3, TARGET_WIDTH / widthOf(img));
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
      if (ink >= 0.004) cells.push({ name: renamed.get(row), key: col.key, cell, box, prev: result.people[row.name]?.[col.key] });
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
    if (c.word.code && c.word.confidence >= 70) continue;
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
    if (best) people[c.name][c.key] = { code: best.code, raw: best.raw, confidence: best.confidence };
    // 글자는 있는데 근무로 못 읽은 칸 → 확인 화면에서 '?' 로 표시
    else unread[c.name] = [...(unread[c.name] || []), c.key];
  });

  Object.keys(people).forEach((n) => {
    if (!Object.keys(people[n]).length) delete people[n];
  });
  const names = grid.rows.map((r) => renamed.get(r)).filter((n) => people[n]);
  return { ...result, people, names, unread };
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
export async function recognizeRoster(file, { year, month, shiftTypes = [], onProgress = () => {} } = {}) {
  onProgress(0.02, '사진 보정 중...');
  // 기울어진 사진은 먼저 바로 세움 (이후 모든 단계가 회전한 이미지 기준)
  const img = deskew(await loadImage(file));
  const canvas = preprocess(img);

  onProgress(0.06, '인식 엔진 준비 중... (처음 한 번은 조금 걸려요)');
  let stage = (p) => onProgress(0.1 + p * 0.3, `표 구조 분석 중... ${Math.round(p * 100)}%`);
  const worker = await createOcrWorker((p) => stage(p));

  try {
    let source = canvas;
    let result = parseRosterWords(await ocrWords(worker, canvas), { year, month, shiftTypes });
    // 보정 이미지에서 표를 못 찾으면 원본으로 한 번 더
    if (result.error) {
      const raw = scaledCanvas(img);
      const retry = parseRosterWords(await ocrWords(worker, raw), { year, month, shiftTypes });
      if (retry.error) return result;
      result = retry;
      source = raw;
    }
    // 제목(2026년 9월)을 못 읽었으면 날짜 줄 위쪽만 잘라 한 번 더 (표 전체를 읽을 때는 제목이 빠지기도 함)
    if (!result.found && result.grid) {
      const titleText = await readTitle(worker, scaledCanvas(img), result.grid.headerTop);
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
      source === canvas ? scaledCanvas(img) : null,
      // 이름 다시 읽기 단계도 진행률 표시 (멈춘 것처럼 보이지 않게)
      (i, n) => onProgress(0.4 + (i / n) * 0.1, `이름 확인 중... ${i + 1}/${n}`)
    );
    onProgress(1, '완료');
    return result;
  } finally {
    await worker.terminate();
  }
}
