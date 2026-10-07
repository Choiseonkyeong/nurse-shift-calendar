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

const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * 근무 달력 → canvas (흰 바탕, 근무 코드는 색 글자)
 * start~end 기간을 주 단위로 그림. 달이 바뀌는 날·첫날은 '10/1' 처럼 월을 함께 표시
 */
export function renderShiftCanvas({ start, end, title, subtitle = '', myShifts = {}, shiftTypes = [] }) {
  const W = 1080;
  const PAD = 48;
  const cellW = (W - PAD * 2) / 7;
  const cellH = 140;
  const first = parseKey(start);
  const days = Math.round((parseKey(end) - first) / 86400000) + 1;
  const offset = first.getDay();
  const weeks = Math.ceil((offset + days) / 7);
  const top = 236;
  const H = top + weeks * cellH + 190;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // 제목
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText(title, PAD, 96);
  if (subtitle) {
    ctx.fillStyle = '#64748B';
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(subtitle, PAD, 146);
  }

  // 요일
  const dows = ['일', '월', '화', '수', '목', '금', '토'];
  ctx.font = `600 26px ${FONT}`;
  ctx.textAlign = 'center';
  dows.forEach((d, i) => {
    ctx.fillStyle = i === 0 ? '#EF4444' : i === 6 ? '#2563EB' : '#94A3B8';
    ctx.fillText(d, PAD + cellW * i + cellW / 2, top - 22);
  });

  // 주마다 위쪽에 얇은 선
  ctx.fillStyle = '#F1F5F9';
  for (let w = 0; w < weeks; w++) ctx.fillRect(PAD, top + w * cellH, W - PAD * 2, 2);

  // 날짜 칸
  const counts = {};
  for (let i = 0; i < days; i++) {
    const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
    const key = toKey(date);
    const idx = offset + i;
    const dow = idx % 7;
    const x = PAD + dow * cellW;
    const y = top + Math.floor(idx / 7) * cellH;
    const code = myShifts[key];
    const holiday = getHoliday(key);
    const d = date.getDate();

    ctx.textAlign = 'center';
    ctx.font = `500 26px ${FONT}`;
    ctx.fillStyle = holiday || dow === 0 ? '#EF4444' : dow === 6 ? '#2563EB' : '#334155';
    ctx.fillText(i === 0 || d === 1 ? `${date.getMonth() + 1}/${d}` : String(d), x + cellW / 2, y + 40);
    if (holiday) {
      ctx.font = `500 17px ${FONT}`;
      ctx.fillText(holiday.length > 5 ? `${holiday.slice(0, 5)}…` : holiday, x + cellW / 2, y + 128);
    }

    if (code) {
      counts[code] = (counts[code] || 0) + 1;
      const t = findShiftType(shiftTypes, code) || { fg: '#475569' };
      ctx.fillStyle = t.fg;
      ctx.font = `700 ${code.length > 3 ? 26 : code.length > 1 ? 34 : 44}px ${FONT}`;
      ctx.fillText(code, x + cellW / 2, y + 98);
    }
  }

  // 근무 요약: 'D 8' 처럼 코드(색) + 횟수
  let cx = PAD;
  const cy = top + weeks * cellH + 36;
  ctx.textAlign = 'left';
  shiftTypes
    .filter((t) => counts[t.code])
    .forEach((t) => {
      ctx.font = `700 28px ${FONT}`;
      const cw = ctx.measureText(t.code).width;
      ctx.font = `500 28px ${FONT}`;
      const nw = ctx.measureText(String(counts[t.code])).width;
      const w = cw + nw + 50;
      if (cx + w > W - PAD) return;
      ctx.fillStyle = '#F8FAFC';
      roundRect(ctx, cx, cy, w, 56, 28);
      ctx.fill();
      ctx.font = `700 28px ${FONT}`;
      ctx.fillStyle = t.fg;
      ctx.fillText(t.code, cx + 20, cy + 38);
      ctx.font = `500 28px ${FONT}`;
      ctx.fillStyle = '#475569';
      ctx.fillText(String(counts[t.code]), cx + 30 + cw, cy + 38);
      cx += w + 10;
    });

  ctx.fillStyle = '#CBD5E1';
  ctx.font = `500 22px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('근무표 앱', W - PAD, H - 36);
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

/** 웹 주소 (앱에서 보낸 초대 링크도 웹으로 열림) */
export const WEB_ORIGIN = 'https://nurse-shift-calendar.vercel.app';
export const webOrigin = () =>
  Capacitor.isNativePlatform() || !/^https?:$/.test(window.location.protocol) ? WEB_ORIGIN : window.location.origin;

/**
 * 글 공유: 앱·모바일 → 공유 시트(카톡 등), 지원 안 하면 클립보드 복사
 * @returns 'shared' | 'cancelled' | 'copied' | 'failed'
 */
export async function shareText({ title, text, url }) {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ title, text, url, dialogTitle: title });
      return 'shared';
    } catch (err) {
      return /cancel/i.test(err?.message || '') ? 'cancelled' : 'failed';
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return 'copied';
  } catch (err) {
    return 'failed';
  }
}

/**
 * 근무표 이미지 공유/저장
 * period 가 있으면 정산 기간(예: 9/26~10/25), 없으면 그 달 1일~말일
 */
export async function shareMonthImage({ year, month, period, userName = '', ...rest }) {
  const name = userName ? ` · ${userName}` : '';
  const opts = period
    ? {
        start: period.start,
        end: period.end,
        title: `${Number(period.start.slice(5, 7))}.${Number(period.start.slice(8))} ~ ${Number(period.end.slice(5, 7))}.${Number(period.end.slice(8))} 근무표`,
        subtitle: `${year}년 ${month}월 정산${name}`
      }
    : {
        start: `${year}-${pad(month)}-01`,
        end: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
        title: `${month}월 근무표`,
        subtitle: `${year}년${name}`
      };
  const canvas = renderShiftCanvas({ ...rest, ...opts });
  return shareFile({
    fileName: `shift-${year}-${pad(month)}${period ? '-period' : ''}.png`,
    mimeType: 'image/png',
    data: canvas.toDataURL('image/png').split(',')[1],
    isBase64: true,
    title: opts.title
  });
}
