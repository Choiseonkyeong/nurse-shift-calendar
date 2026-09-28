// src/lib/icsImport.js
// 휴대폰 캘린더 내보내기(.ics) 파서
//  - 일정 제목이 근무 이름(D, 데이, 나이트, 오프, 연차 ...)이면 근무로, 그 외는 날짜별 메모로 변환
//  - 종일 일정은 종료일 전날까지 날짜별로 펼침 (최대 60일)

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 흔히 쓰는 근무 표기 → 기본 근무 코드
const SHIFT_ALIASES = {
  d: 'D', day: 'D', 데이: 'D', 주간: 'D', 주: 'D',
  e: 'E', eve: 'E', evening: 'E', 이브닝: 'E', 이브: 'E',
  n: 'N', night: 'N', 나이트: 'N', 야간: 'N', 야: 'N',
  m: 'M', mid: 'M', 미드: 'M',
  off: 'OFF', o: 'OFF', 오프: 'OFF', 휴무: 'OFF', 휴: 'OFF', 비번: 'OFF',
  연차: '연차', 휴가: '연차', 월차: '연차'
};

/** 줄 접기(RFC 5545 line folding) 해제 후 { name, params, value } 목록 */
function unfold(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx < 0) return null;
      const [name, ...params] = line.slice(0, idx).split(';');
      return { name: name.toUpperCase(), params: params.join(';').toUpperCase(), value: line.slice(idx + 1) };
    })
    .filter(Boolean);
}

const unescapeText = (s) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

/** DTSTART/DTEND 값 → 로컬 Date (종일 여부 포함) */
function parseIcsDate(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, z] = m;
  const allDay = params.includes('VALUE=DATE') || !hh;
  if (allDay) return { date: new Date(+y, +mo - 1, +d), allDay: true };
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss))
    : new Date(+y, +mo - 1, +d, +hh, +mm, +ss); // TZID 지정은 기기 시간대로 간주
  return { date, allDay: false };
}

/** 일정 제목 → 근무 코드 (없으면 null). shiftTypes 의 코드/이름도 인식 */
export function matchShiftCode(summary, shiftTypes = []) {
  const raw = summary.replace(/[()[\]\s·:-]/g, '').toLowerCase();
  if (!raw) return null;
  const custom = shiftTypes.find(
    (t) => t.code.toLowerCase() === raw || (t.label || '').replace(/[()[\]\s]/g, '').toLowerCase() === raw
  );
  if (custom) return custom.code;
  // "D근무", "나이트근무", "오프day" 등 접미어 허용
  const stripped = raw.replace(/(근무|번|day|duty|shift)$/i, '');
  return SHIFT_ALIASES[raw] || SHIFT_ALIASES[stripped] || null;
}

/**
 * .ics 텍스트 → { shifts: {날짜: 코드}, notes: {날짜: 메모}, eventCount }
 * 같은 날 여러 근무 일정이 있으면 마지막 일정을 사용
 */
export function parseIcs(text, shiftTypes = []) {
  const lines = unfold(text);
  const shifts = {};
  const notes = {};
  let eventCount = 0;
  let ev = null;

  const addNote = (dateKey, str) => {
    notes[dateKey] = notes[dateKey] ? `${notes[dateKey]} / ${str}` : str;
  };

  for (const { name, params, value } of lines) {
    if (name === 'BEGIN' && value.toUpperCase() === 'VEVENT') ev = {};
    else if (name === 'END' && value.toUpperCase() === 'VEVENT' && ev) {
      eventCount += 1;
      const start = ev.start;
      const summary = unescapeText(ev.summary || '');
      if (start && summary) {
        const code = matchShiftCode(summary, shiftTypes);
        const days = [];
        if (start.allDay) {
          const end = ev.end?.allDay ? ev.end.date : null;
          const last = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1) : start.date;
          for (let d = new Date(start.date), i = 0; d <= last && i < 60; d.setDate(d.getDate() + 1), i++) {
            days.push(keyOf(d));
          }
        } else {
          days.push(keyOf(start.date));
        }
        const time = start.allDay ? '' : `${pad(start.date.getHours())}:${pad(start.date.getMinutes())} `;
        days.forEach((k) => {
          if (code) shifts[k] = code;
          else addNote(k, `${time}${summary}`.slice(0, 200));
        });
      }
      ev = null;
    } else if (ev) {
      if (name === 'DTSTART') ev.start = parseIcsDate(value, params);
      else if (name === 'DTEND') ev.end = parseIcsDate(value, params);
      else if (name === 'SUMMARY') ev.summary = value;
    }
  }
  return { shifts, notes, eventCount };
}
