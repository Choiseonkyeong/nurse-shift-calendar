// src/lib/rosterOcr.js
// 근무표 사진 → 단어 좌표 (Tesseract.js, 기기 안에서 처리 / 무료 / 서버 전송 없음)
// 인식률을 위해: 해상도 정규화 → 흑백 → 조명 보정(적응형 이진화) → 표 선 제거 후 OCR
import { parseRosterWords, cellToCode, extractName } from './rosterParse';

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

/** 적응형 이진화 + 긴 가로/세로 선 제거 → canvas */
export function preprocess(img) {
  const scale = Math.min(3, TARGET_WIDTH / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
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
  const scale = Math.min(3, TARGET_WIDTH / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export { loadImage, scaledCanvas, createOcrWorker };

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
  for (let i = 0; i < W * H; i++) if (black(i)) ink++;
  return { canvas: c, ink: ink / (c.width * c.height) };
}

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
async function refineCells(result, canvas, worker, shiftTypes, onProgress) {
  const { grid } = result;

  // 이름 칸만 잘라 한 줄 모드로 다시 읽기 (1차에서 '윤다은'→'다은', 누락 등 보정)
  await worker.setParameters({ tessedit_pageseg_mode: '7' });
  const renamed = new Map();
  const taken = new Set();
  for (const row of grid.rows) {
    const cy = row.y0 + grid.slope * ((row.nameX0 + row.nameX1) / 2);
    const { canvas: cell, ink } = cropCell(canvas, row.nameX0, cy - grid.pitch * 0.45, row.nameX1, cy + grid.pitch * 0.45, { filter: false });
    let name = row.name;
    if (ink >= 0.004) {
      const { data } = await worker.recognize(cell);
      const reread = extractName(data.text);
      if (reread && data.confidence >= 60 && (reread.length >= name.length || /번째 줄/.test(name))) name = reread;
    }
    if (taken.has(name)) name = `${name}(${renamed.size + 1})`;
    taken.add(name);
    renamed.set(row, name);
  }

  const cells = [];
  grid.rows.forEach((row) =>
    grid.cols.forEach((col) => {
      const cy = row.y0 + grid.slope * col.x;
      const half = grid.pitch * 0.45;
      const { canvas: cell, ink } = cropCell(canvas, col.x - col.w * 0.58, cy - half, col.x + col.w * 0.58, cy + half);
      if (ink >= 0.004) cells.push({ name: renamed.get(row), key: col.key, cell, prev: result.people[row.name]?.[col.key] });
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

  const total = cells.length * 1.3 || 1;
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

  const people = {};
  const unread = {};
  grid.rows.forEach((r) => {
    people[renamed.get(r)] = {};
  });
  cells.forEach((c) => {
    const options = [c.word, c.line, c.prev].filter((o) => o && o.code);
    // 한글이 섞인 결과(연차 등)는 한 줄 모드 우선, 그 외에는 신뢰도 높은 쪽
    const korean = options.find((o) => /[가-힣]/.test(o.raw) && o.confidence >= 50);
    const best = korean || options.sort((x, y) => y.confidence - x.confidence)[0];
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

/**
 * @param file        이미지 파일
 * @param opts        { year, month, shiftTypes, onProgress(0~1, 메시지) }
 */
export async function recognizeRoster(file, { year, month, shiftTypes = [], onProgress = () => {} } = {}) {
  onProgress(0.02, '사진 보정 중...');
  const img = await loadImage(file);
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
    stage = () => {};
    onProgress(0.4, '칸별 정밀 인식 중...');
    result = await refineCells(result, source, worker, shiftTypes, (p) =>
      onProgress(0.4 + p * 0.58, `칸별 정밀 인식 중... ${Math.round(p * 100)}%`)
    );
    onProgress(1, '완료');
    return result;
  } finally {
    await worker.terminate();
  }
}
