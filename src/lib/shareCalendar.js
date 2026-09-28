// src/lib/shareCalendar.js
// 이번 달 근무표를 이미지(PNG)로 만들어 공유/저장 (카톡 등으로 보내기)
import { Capacitor } from '@capacitor/core';
import { findShiftType } from './shiftTypes';
import { getHoliday } from '../utils/holidays';

const pad = (n) => String(n).padStart(2, '0');
const FONT = "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 월간 근무 달력 → canvas */
export function renderMonthCanvas({ year, month, myShifts = {}, shiftTypes = [], userName = '' }) {
  const W = 1080;
  const PAD = 48;
  const cellW = (W - PAD * 2) / 7;
  const cellH = 150;
  const first = new Date(year, month - 1, 1).getDay();
  const last = new Date(year, month, 0).getDate();
  const weeks = Math.ceil((first + last) / 7);
  const top = 214;
  const H = top + weeks * cellH + 200;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, W, H);

  // 제목
  ctx.fillStyle = '#0F172A';
  ctx.font = `900 52px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${year}년 ${month}월 근무표`, PAD, 92);
  if (userName) {
    ctx.fillStyle = '#6366F1';
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(userName, PAD, 138);
  }

  // 요일
  const dows = ['일', '월', '화', '수', '목', '금', '토'];
  ctx.font = `800 26px ${FONT}`;
  ctx.textAlign = 'center';
  dows.forEach((d, i) => {
    ctx.fillStyle = i === 0 ? '#F43F5E' : i === 6 ? '#0EA5E9' : '#94A3B8';
    ctx.fillText(d, PAD + cellW * i + cellW / 2, top - 14);
  });

  // 날짜 칸
  const counts = {};
  for (let d = 1; d <= last; d++) {
    const idx = first + d - 1;
    const x = PAD + (idx % 7) * cellW;
    const y = top + Math.floor(idx / 7) * cellH;
    const key = `${year}-${pad(month)}-${pad(d)}`;
    const code = myShifts[key];
    const holiday = getHoliday(key);
    const dow = idx % 7;

    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, x + 4, y + 4, cellW - 8, cellH - 8, 22);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillStyle = holiday || dow === 0 ? '#F43F5E' : dow === 6 ? '#0EA5E9' : '#334155';
    ctx.fillText(String(d), x + 18, y + 40);
    if (holiday) {
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(holiday.length > 6 ? `${holiday.slice(0, 6)}…` : holiday, x + 50, y + 38);
    }

    if (code) {
      counts[code] = (counts[code] || 0) + 1;
      const t = findShiftType(shiftTypes, code) || { bg: '#F1F5F9', fg: '#475569' };
      ctx.fillStyle = t.bg;
      roundRect(ctx, x + 14, y + 62, cellW - 28, 64, 18);
      ctx.fill();
      ctx.fillStyle = t.fg;
      ctx.textAlign = 'center';
      ctx.font = `900 ${code.length > 3 ? 24 : 32}px ${FONT}`;
      ctx.fillText(code, x + cellW / 2, y + 106);
    }
  }

  // 근무 요약
  let cx = PAD;
  const cy = top + weeks * cellH + 40;
  ctx.textAlign = 'left';
  ctx.font = `900 28px ${FONT}`;
  shiftTypes
    .filter((t) => counts[t.code])
    .forEach((t) => {
      const label = `${t.code} ${counts[t.code]}`;
      const w = ctx.measureText(label).width + 40;
      if (cx + w > W - PAD) return;
      ctx.fillStyle = t.bg;
      roundRect(ctx, cx, cy, w, 56, 28);
      ctx.fill();
      ctx.fillStyle = t.fg;
      ctx.fillText(label, cx + 20, cy + 38);
      cx += w + 12;
    });

  ctx.fillStyle = '#CBD5E1';
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('근무표 앱', W - PAD, H - 40);
  return canvas;
}

/**
 * 파일 공유/저장: 앱 → 공유 시트(카톡·드라이브·파일 저장), 웹 → 공유 지원 시 공유, 아니면 다운로드
 * @param data  base64 문자열(binary) 또는 일반 텍스트
 */
export async function shareFile({ fileName, mimeType, data, isBase64 = false, title }) {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share')
    ]);
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data,
      directory: Directory.Cache,
      ...(isBase64 ? {} : { encoding: Encoding.UTF8 })
    });
    await Share.share({ title: title || fileName, files: [uri], dialogTitle: title || fileName });
    return 'shared';
  }

  const blob = isBase64
    ? new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type: mimeType })
    : new Blob([data], { type: `${mimeType};charset=utf-8` });
  const file = new File([blob], fileName, { type: mimeType });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || fileName });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}

/** 이번 달 근무표 이미지 공유/저장 */
export async function shareMonthImage(opts) {
  const canvas = renderMonthCanvas(opts);
  return shareFile({
    fileName: `shift-${opts.year}-${pad(opts.month)}.png`,
    mimeType: 'image/png',
    data: canvas.toDataURL('image/png').split(',')[1],
    isBase64: true,
    title: `${opts.year}년 ${opts.month}월 근무표`
  });
}
