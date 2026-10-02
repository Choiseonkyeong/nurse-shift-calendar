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

/**
 * 엑셀 뷰어 화면 캡처처럼 (브라우저 메뉴 + 왼쪽 목록 + 열 문자·행 번호 + 회색 격자 안에 근무표)
 * 표가 화면 일부만 차지하고 옆 목록 글자가 표의 줄과 나란히 있어 이름에 섞이기 쉬운 경우
 */
export async function renderSpreadsheetScreenshot(browser, roster, file, { dpr = 1 } = {}) {
  const page = rosterHtml(roster, { cellW: 26 });
  const style = page.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/body \{[^}]*\}/, '');
  const inner = page.replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '');
  const letters = Array.from({ length: 44 }, (_, i) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26)));
  const side = ['새로 생성', '프로젝트', 'Artifacts', '예약됨', '사용자 지정', '더보기', '오늘', '질문 개인', '11월 12월 근무일정', '개인9질문', '이사진 수정', '어제', '고향사랑기부제 연말정산 혜택', '9월 30일', '초보자 헬스 운동 커리큘럼', 'ASCII art drawing', '9월 28일', 'AI 개발 도구 선택 및 추천', '이전', '객체 간 관계 표시 방법', '코딩을 위한 개인 학습 로드맵'];
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:'WenQuanYi Zen Hei',sans-serif;background:#1e1e1e;color:#ddd;width:1440px;height:900px;overflow:hidden}
    .top{height:70px;background:#2b2b2b;font-size:13px;padding:8px 16px}
    .side{position:absolute;left:0;top:70px;width:180px;bottom:0;background:#1f1f1f;font-size:12px;padding:10px}
    .side div{height:26px}
    .main{position:absolute;left:180px;top:70px;right:0;bottom:0;background:#fff;color:#000}
    .cols{display:flex;margin-left:28px;font-size:10px;color:#666;border-bottom:1px solid #ddd}
    .cols span{width:26px;text-align:center}
    .rown{position:absolute;left:0;top:40px;width:26px;font-size:10px;color:#666}
    .rown div{height:24px;text-align:right}
    .sheet{font-size:10px;position:absolute;left:40px;top:40px;right:0;bottom:30px;padding:20px 0 0 30px;
      background-image:linear-gradient(#e6e6e6 1px,transparent 1px),linear-gradient(90deg,#e6e6e6 1px,transparent 1px);background-size:26px 24px}
    ${style}
  </style></head><body>
    <div class="top">Chrome 파일 수정 보기 방문 기록 북마크 프로필 탭 창 도움말<br>${roster.title} · XLSX</div>
    <div class="side">${side.map((s) => `<div>${s}</div>`).join('')}</div>
    <div class="main"><div class="cols">${letters.map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="rown">${Array.from({ length: 30 }, (_, i) => `<div>${i + 1}</div>`).join('')}</div>
      <div class="sheet">${inner}</div></div>
  </body></html>`;
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
  await p.setContent(html);
  await p.screenshot({ path: file });
  await p.close();
  return file;
}
