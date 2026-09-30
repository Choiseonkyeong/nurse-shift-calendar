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
      return { name: name.toUpperCase(), params: params.join(';'), value: line.slice(idx + 1) }; // 매개변수는 TZID 이름 때문에 원래 대소문자 유지
    })
    .filter(Boolean);
}

const unescapeText = (s) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

/** 매개변수 값 (예: TZID="Asia/Seoul" → Asia/Seoul) */
function paramOf(params, key) {
  const m = new RegExp(`(?:^|;)${key}=("[^"]*"|[^;]*)`, 'i').exec(params || '');
  return m ? m[1].replace(/^"|"$/g, '').trim() : '';
}

// Outlook 등이 쓰는 Windows 시간대 이름 중 흔한 것
const WINDOWS_ZONES = {
  'korea standard time': 'Asia/Seoul',
  'tokyo standard time': 'Asia/Tokyo',
  'china standard time': 'Asia/Shanghai',
  utc: 'UTC',
  'pacific standard time': 'America/Los_Angeles',
  'eastern standard time': 'America/New_York',
  'central standard time': 'America/Chicago',
  'gmt standard time': 'Europe/London'
};

/** 그 시간대 기준 시각(벽시계) → 실제 시각. 모르는 시간대면 null (기기 시간대로 간주) */
function zonedTime(tzid, y, mo, d, hh, mm, ss) {
  const zone = WINDOWS_ZONES[tzid.toLowerCase()] || tzid.replace(/^\/+/, '');
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
    });
  } catch (e) {
    return null;
  }
  const wall = Date.UTC(y, mo - 1, d, hh, mm, ss);
  const offsetAt = (t) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
  };
  let t = wall - offsetAt(wall);
  t = wall - offsetAt(t); // 서머타임 경계 보정
  return new Date(t);
}

/** DTSTART/DTEND 값 → 로컬 Date (종일 여부 포함) */
function parseIcsDate(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, z] = m;
  const allDay = /(^|;)VALUE=DATE(;|$)/i.test(params) || !hh;
  if (allDay) return { date: new Date(+y, +mo - 1, +d), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss)), allDay: false };
  const tzid = paramOf(params, 'TZID');
  const date = (tzid && zonedTime(tzid, +y, +mo, +d, +hh, +mm, +ss)) || new Date(+y, +mo - 1, +d, +hh, +mm, +ss); // 시간대 없음 = 기기 시간대
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

const WEEKDAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const DAY_MS = 86400000;
const MAX_OCCURRENCES = 800;
const MAX_SPAN_DAYS = 366 * 2; // 반복 일정은 시작일부터 최대 2년까지만 펼침

const dayIndex = (d) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);

function parseRrule(value) {
  const rule = {};
  value.split(';').forEach((part) => {
    const [k, v] = part.split('=');
    if (k && v) rule[k.toUpperCase()] = v.toUpperCase();
  });
  return {
    freq: rule.FREQ,
    interval: Math.max(1, Number(rule.INTERVAL) || 1),
    count: rule.COUNT ? Number(rule.COUNT) : null,
    until: rule.UNTIL ? parseIcsDate(rule.UNTIL, '')?.date : null,
    byDay: rule.BYDAY
      ? rule.BYDAY.split(',').map((x) => {
          const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(x);
          return m ? { n: m[1] ? Number(m[1]) : null, wd: WEEKDAYS[m[2]] } : null;
        }).filter(Boolean)
      : null,
    byMonthDay: rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number) : null
  };
}

/** 그 달의 n번째(음수면 뒤에서) 요일인지 */
function isNthWeekday(d, n, wd) {
  if (d.getDay() !== wd) return false;
  if (n == null) return true;
  if (n > 0) return Math.ceil(d.getDate() / 7) === n;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.ceil((last - d.getDate() + 1) / 7) === -n;
}

/** RRULE 반복 → 시작 날짜(로컬 자정) 목록. DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY 지원 */
export function expandRrule(start, rruleText, exdates = new Set()) {
  const r = parseRrule(rruleText);
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(r.freq)) return [start];
  const s0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const startIdx = dayIndex(s0);
  // 주 단위 계산은 월요일 시작 주(WKST=MO 기본)
  const weekOf = (d) => Math.floor((dayIndex(d) - ((d.getDay() + 6) % 7) - (startIdx - ((s0.getDay() + 6) % 7))) / 7);
  const out = [];
  let matched = 0;
  for (let i = 0; i <= MAX_SPAN_DAYS; i++) {
    const d = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() + i);
    if (r.until && d > r.until) break;
    let ok = false;
    if (r.freq === 'DAILY') ok = i % r.interval === 0;
    else if (r.freq === 'WEEKLY') {
      const days = r.byDay ? r.byDay.map((b) => b.wd) : [s0.getDay()];
      ok = weekOf(d) % r.interval === 0 && days.includes(d.getDay());
    } else if (r.freq === 'MONTHLY') {
      const months = (d.getFullYear() - s0.getFullYear()) * 12 + d.getMonth() - s0.getMonth();
      if (months % r.interval === 0) {
        if (r.byMonthDay) {
          const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          ok = r.byMonthDay.some((md) => (md > 0 ? md : last + md + 1) === d.getDate());
        } else if (r.byDay) ok = r.byDay.some((b) => isNthWeekday(d, b.n, b.wd));
        else ok = d.getDate() === s0.getDate();
      }
    } else if (r.freq === 'YEARLY') {
      ok = (d.getFullYear() - s0.getFullYear()) % r.interval === 0 && d.getMonth() === s0.getMonth() && d.getDate() === s0.getDate();
    }
    if (!ok) continue;
    matched += 1; // COUNT 는 제외(EXDATE) 여부와 무관하게 셈
    if (!exdates.has(keyOf(d))) out.push(d);
    if (r.count && matched >= r.count) break;
    if (out.length >= MAX_OCCURRENCES) break;
  }
  return out;
}

/**
 * .ics 텍스트 → { shifts: {날짜: 코드}, notes: {날짜: 메모}, eventCount }
 * 같은 날 여러 근무 일정이 있으면 마지막 일정을 사용. 반복 일정(RRULE)은 펼쳐서 가져옴
 */
export function parseIcs(text, shiftTypes = []) {
  const lines = unfold(text);
  const events = [];
  let ev = null;

  for (const { name, params, value } of lines) {
    if (name === 'BEGIN' && value.toUpperCase() === 'VEVENT') ev = { exdates: new Set() };
    else if (name === 'END' && value.toUpperCase() === 'VEVENT' && ev) {
      events.push(ev);
      ev = null;
    } else if (ev) {
      if (name === 'DTSTART') ev.start = parseIcsDate(value, params);
      else if (name === 'DTEND') ev.end = parseIcsDate(value, params);
      else if (name === 'SUMMARY') ev.summary = value;
      else if (name === 'UID') ev.uid = value.trim();
      else if (name === 'RRULE') ev.rrule = value;
      else if (name === 'STATUS') ev.status = value.trim().toUpperCase();
      else if (name === 'RECURRENCE-ID') ev.recurrenceId = parseIcsDate(value, params);
      else if (name === 'EXDATE') {
        value.split(',').forEach((v) => {
          const d = parseIcsDate(v, params);
          if (d) ev.exdates.add(keyOf(d.date));
        });
      }
    }
  }

  // 반복 일정의 특정 회차를 따로 수정한 일정(RECURRENCE-ID) → 원래 회차는 빼고 수정본 사용
  const overridden = new Map();
  events.forEach((e) => {
    if (e.uid && e.recurrenceId) {
      if (!overridden.has(e.uid)) overridden.set(e.uid, new Set());
      overridden.get(e.uid).add(keyOf(e.recurrenceId.date));
    }
  });

  const shifts = {};
  const notes = {};
  const addNote = (dateKey, str) => {
    notes[dateKey] = notes[dateKey] ? `${notes[dateKey]} / ${str}` : str;
  };

  events.forEach((e) => {
    const start = e.start;
    const summary = unescapeText(e.summary || '');
    if (!start || !summary || e.status === 'CANCELLED') return;
    const code = matchShiftCode(summary, shiftTypes);

    // 종일 일정 길이(일): DTEND 는 다음 날 0시(미포함)
    const spanDays =
      start.allDay && e.end?.allDay ? Math.max(1, Math.min(60, dayIndex(e.end.date) - dayIndex(start.date))) : 1;
    const skip = new Set([...e.exdates, ...(e.rrule && e.uid && overridden.get(e.uid) ? overridden.get(e.uid) : [])]);
    const occurrences = e.rrule && !e.recurrenceId ? expandRrule(start.date, e.rrule, skip) : [start.date];
    const time = start.allDay ? '' : `${pad(start.date.getHours())}:${pad(start.date.getMinutes())} `;

    occurrences.forEach((occ) => {
      for (let i = 0; i < spanDays; i++) {
        const k = keyOf(new Date(occ.getFullYear(), occ.getMonth(), occ.getDate() + i));
        if (code) shifts[k] = code;
        else addNote(k, `${time}${summary}`.slice(0, 200));
      }
    });
  });

  return { shifts, notes, eventCount: events.length };
}
