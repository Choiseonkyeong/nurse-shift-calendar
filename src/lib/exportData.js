// src/lib/exportData.js
// 근무·메모 내보내기: CSV(엑셀) / iCalendar(.ics, 구글·애플 캘린더) — .ics 는 앱의 가져오기와 호환

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const sortedDates = (myShifts, dayNotes) =>
  [...new Set([...Object.keys(myShifts || {}), ...Object.keys(dayNotes || {})])]
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && (myShifts?.[k] || dayNotes?.[k]))
    .sort();

const csvCell = (v) => {
  let s = String(v ?? '');
  // '-BLS 교육', '=면담' 처럼 = + - @ 로 시작하면 엑셀이 계산식으로 읽어 #NAME? 이 됨 → 앞에 탭을 붙여 글자로
  if (/^[=+\-@\t\r]/.test(s)) s = `\t${s}`;
  return /[",\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 엑셀에서 한글이 깨지지 않도록 BOM 포함 */
export function toCsv(myShifts = {}, dayNotes = {}, shiftTypes = []) {
  const label = (code) => shiftTypes.find((t) => t.code === code)?.label || '';
  const rows = [['날짜', '요일', '근무', '근무 이름', '메모']];
  sortedDates(myShifts, dayNotes).forEach((k) => {
    const [y, m, d] = k.split('-').map(Number);
    const code = myShifts[k] || '';
    rows.push([k, DOW[new Date(y, m - 1, d).getDay()], code, code ? label(code) : '', dayNotes[k] || '']);
  });
  return `\uFEFF${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545: 한 줄 75바이트 이하로 접기 */
function fold(line) {
  const bytes = new TextEncoder();
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const nextDay = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  const n = new Date(y, m - 1, d + 1);
  return `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}`;
};

export function toIcs(myShifts = {}, dayNotes = {}, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NurseShift//KO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:근무표'];
  const event = (k, uid, summary) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@nurseshift.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${k.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${nextDay(k)}`,
      fold(`SUMMARY:${icsText(summary)}`),
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  };
  sortedDates(myShifts, dayNotes).forEach((k) => {
    if (myShifts[k]) event(k, `shift-${k}`, myShifts[k]);
    if (dayNotes[k]) event(k, `note-${k}`, dayNotes[k]);
  });
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
