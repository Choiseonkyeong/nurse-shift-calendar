// e2e/rosterImage.js
// 병동 근무표 양식(제목 · 날짜 줄 + 공휴일 · 요일 줄 · 직급/이름/근무 · 합계 열)을 그대로 그려서
// 정답을 아는 근무표 이미지를 만든다. 실제 동료 이름이 든 사진은 저장소에 올리지 않고 이걸로 테스트
//  - 26일~다음 달 25일(wrap) 또는 1일~말일
//  - 주말·공휴일 칸 색, 주말 OFF 빨간 글씨, N 파란 칸, M 노란 칸 등 실제 표와 비슷하게

const WD = '일월화수목금토';
const FIXED_HOLIDAYS = { '1-1': '신정', '3-1': '삼일절', '5-5': '어린이날', '6-6': '현충일', '8-15': '광복절', '10-3': '개천절', '10-9': '한글날', '12-25': '성탄절' };
const pad = (n) => String(n).padStart(2, '0');
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 근무표 날짜 목록: wrap 이면 지난달 26일 ~ 이번 달 25일, 아니면 1일 ~ 말일 */
export function rosterDates(year, month, wrap = true) {
  const start = wrap ? new Date(year, month - 2, 26) : new Date(year, month - 1, 1);
  const end = wrap ? new Date(year, month - 1, 25) : new Date(year, month, 0);
  const out = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(new Date(d));
  return out;
}

// 결정적 난수 (같은 seed → 같은 근무표)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const FAKE_NAMES = ['김하늘', '이서연', '박지우', '정민서', '윤채원', '한소희', '오유진', '서다인', '신예린', '권나윤'];
const RANKS = ['HN', 'CN', 'R', 'R', 'A', 'A', 'A', 'A', 'A', 'A'];

/**
 * 가짜 근무표 데이터 (정답)
 * @returns { title, dates, people: [{ rank, name, note, codes: { 'YYYY-MM-DD': 코드 } }] }
 */
export function makeRoster({ year, month, wrap = true, count = 7, seed = 1, ward = '분당 5병동', names = FAKE_NAMES }) {
  const rand = rng(seed + year * 13 + month);
  const dates = rosterDates(year, month, wrap);
  const people = names.slice(0, count).map((name, i) => {
    const codes = {};
    const nightKeep = i === count - 1; // 마지막 사람은 N-keep (N/OFF 만)
    dates.forEach((d) => {
      const r = rand();
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      let c;
      if (nightKeep) c = r < 0.5 ? 'N' : 'OFF';
      else if (i === 0) c = weekend || r < 0.05 ? 'OFF' : 'D';
      else c = r < 0.28 ? 'OFF' : r < 0.52 ? 'D' : r < 0.76 ? 'E' : r < 0.9 ? 'N' : r < 0.96 ? 'M' : '연차';
      codes[keyOf(d)] = c;
    });
    return { rank: RANKS[i], name, note: nightKeep ? '(N-keep)' : '', codes };
  });
  const offTarget = Math.round(dates.filter((d) => d.getDay() === 0 || d.getDay() === 6).length);
  return { title: `<${ward} ${year}년 ${month}월 근무표 OFF ${offTarget}>`, dates, people, ward };
}

/** 근무표 HTML (스크린샷용) */
export function rosterHtml({ title, dates, people, ward }, { fontSize = 13, cellW = 34 } = {}) {
  const hol = (d) => FIXED_HOLIDAYS[`${d.getMonth() + 1}-${d.getDate()}`];
  const weekend = (d) => d.getDay() === 0 || d.getDay() === 6;
  const colBg = (d) => (hol(d) ? '#f8cbad' : weekend(d) ? '#fff2cc' : '#fff');
  const cellBg = (c, d) => ({ N: '#dde8f5', M: '#ffff99', 연차: '#e2efda' })[c] || colBg(d);
  const sumCodes = ['OFF', 'D', 'E', 'M', 'N', '연차'];
  const head1 = dates
    .map((d) => `<td style="background:${colBg(d)}">${d.getDate()}${hol(d) ? `<div class="hol">${hol(d)}</div>` : ''}</td>`)
    .join('');
  const head2 = dates.map((d) => `<td style="background:${colBg(d)}">${WD[d.getDay()]}</td>`).join('');
  const rows = people
    .map((p) => {
      const cells = dates
        .map((d) => {
          const c = p.codes[keyOf(d)];
          const red = c === 'OFF' && (weekend(d) || hol(d));
          return `<td style="background:${cellBg(c, d)};${red ? 'color:#e00' : ''}">${c}</td>`;
        })
        .join('');
      const sums = sumCodes.map((s) => `<td>${Object.values(p.codes).filter((c) => c === s).length}</td>`).join('');
      return `<tr><td class="rank">${p.rank}</td><td class="name">${p.name}${p.note ? `<div class="note">${p.note}</div>` : ''}</td>${cells}${sums}</tr>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 12px; font-family: 'WenQuanYi Zen Hei', 'Malgun Gothic', sans-serif; font-size: ${fontSize}px; background: #fff; color: #000; }
    .title { font-weight: bold; margin: 0 0 6px 60px; }
    table { border-collapse: collapse; }
    td { border: 1px solid #bbb; width: ${cellW}px; height: 34px; text-align: center; padding: 0; }
    .rank { width: 26px; } .name { width: 64px; }
    .hol { font-size: 8px; line-height: 1; } .note { font-size: 9px; }
    .ward { background: #f4b183; font-weight: bold; }
  </style></head><body>
    <div class="title">${title}</div>
    <table>
      <tr><td rowspan="2" colspan="2" class="ward">${ward.replace(' ', '<br>')}</td>${head1}${sumCodes.map((s) => `<td rowspan="2">${s}</td>`).join('')}</tr>
      <tr>${head2}</tr>
      ${rows}
    </table>
  </body></html>`;
}

/**
 * 근무표 이미지 파일 만들기 (Playwright page 로 그려서 저장)
 * @param photo  사진처럼: true 또는 { rotate(도), blur(px), quality(JPEG) } — 기울이고 흐리게 + JPEG
 */
export async function renderRosterImage(browser, roster, file, { photo = false, scale = 1, width = 1300 } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 400 }, deviceScaleFactor: scale });
  await page.setContent(rosterHtml(roster));
  const ph = photo === true ? { rotate: 0.6, blur: 0.4, quality: 70 } : photo;
  if (ph) {
    await page.addStyleTag({
      content: `table, .title { transform: rotate(${ph.rotate}deg); transform-origin: 0 0; filter: blur(${ph.blur}px) contrast(0.9); } body { background: #f3f1ea; }`
    });
  }
  await page.screenshot({ path: file, fullPage: true, type: ph ? 'jpeg' : 'png', ...(ph ? { quality: ph.quality } : {}) });
  await page.close();
  return file;
}
