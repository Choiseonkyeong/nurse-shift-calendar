// 실제 병동 근무표 양식(26일~다음 달 25일, 날짜 아래 요일 줄, 공휴일 이름, 합계 열, 직급·N-keep 표기)으로 가져오기 검증
//  - 사진: e2e/rosterImage.js 로 그린 가짜 이름 근무표(정답을 앎). 실제 동료 이름이 든 사진은 저장소에 두지 않음
//  - 엑셀: 실제 파일과 같은 구조(A열 메모, 줄바꿈 이름, '25\r\n추석' 날짜 칸, 합계 열)를 코드로 만들어 사용
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import XLSX from 'xlsx';
import { openApp, readLocal, tab } from './helpers.js';
import { makeRoster, rosterDates, keyOf } from './rosterImage.js';

const fixture = (name) => path.join(import.meta.dirname, 'fixtures', name);
const photoInput = (page) => page.locator('input[type=file][accept="image/*"]:not([capture])');
const viewMonth = async (page, back) => {
  for (let i = 0; i < back; i++) await page.getByRole('button', { name: '이전 달' }).click();
};

test('병동 양식 사진(10월 = 9/26~10/25): 5월을 보고 있어도 10월로, 한 사람 30칸 모두 정답 · 이름 한 글자 오인식도 자동 선택', async ({ page }) => {
  test.setTimeout(240000);
  // 그린 설정: renderRosterImage(…, { photo: true }) — 0.6° 기울기·흐림·JPEG
  const roster = makeRoster({ year: 2026, month: 10, seed: 3 });
  const me = roster.people.find((p) => p.name === '한소희'); // 사진에선 '한소회'로 읽힘 → 한 글자 차이로 자동 선택
  await openApp(page, { name: '한소희' });
  await viewMonth(page, 4); // 5월
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(fixture('roster-oct-photo.jpg'));
  await expect(page.getByText('사진에서 9월 26일~10월 25일 근무 30일을 등록했어요')).toBeVisible({ timeout: 200000 });
  const saved = await readLocal(page, 'my_shift_data');
  expect(saved).toEqual(me.codes);
});

test('기울고 흐린 사진(-1.2°)도 표를 바로 세워 읽음: 8/26~9/25, 칸 대부분 정답이고 틀린 칸은 없음(못 읽은 칸만)', async ({ page }) => {
  test.setTimeout(240000);
  // 그린 설정: renderRosterImage(…, { photo: { rotate: -1.2, blur: 0.6, quality: 60 } })
  const roster = makeRoster({ year: 2026, month: 9, seed: 11 });
  const me = roster.people.find((p) => p.name === '박지우');
  await openApp(page, { name: '박지우' });
  await viewMonth(page, 4);
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(fixture('roster-sep-tilt.jpg'));
  await expect(page.getByText(/사진에서 8월 26일~9월 25일 근무 \d+일을 등록했어요/)).toBeVisible({ timeout: 200000 });
  const saved = await readLocal(page, 'my_shift_data');
  const right = Object.entries(me.codes).filter(([k, v]) => saved[k] === v).length;
  const wrong = Object.entries(me.codes).filter(([k, v]) => saved[k] && saved[k] !== v);
  expect(right).toBeGreaterThanOrEqual(29);
  expect(wrong).toEqual([]);
  expect(Object.keys(saved).every((k) => k in me.codes)).toBe(true);
});

/** 실제 병동 엑셀과 같은 구조 (가짜 이름) */
function wardWorkbook(year, month) {
  const roster = makeRoster({ year, month, seed: 21 });
  const dates = rosterDates(year, month, true);
  const WD = '일월화수목금토';
  const sums = ['OFF', 'D', 'E', 'M', 'N', '연차'];
  const rows = [
    [],
    ['', '', `<분당 5병동 ${year}년 ${month}월 근무표 OFF 10>`],
    ['', '', '분당\r\n5병동', ...dates.map((d, i) => (i === dates.length - 1 ? `${d.getDate()}\r\n추석` : String(d.getDate()))), ...sums],
    ['', '', '', ...dates.map((d) => WD[d.getDay()])],
    ...roster.people.map((p, i) => [
      ['', 'DD', 'DDEE', 'DE', 'N', '/', 'N/'][i] || '', // 실제 파일 A열의 메모 (이름으로 읽으면 안 됨)
      p.rank,
      p.note ? `${p.name}\r\n${p.note}\r\n` : p.name,
      ...dates.map((d) => p.codes[keyOf(d)]),
      ...sums.map((s) => String(Object.values(p.codes).filter((c) => c === s).length))
    ])
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Sheet2');
  const file = path.join(os.tmpdir(), `ward-${year}-${month}-${Date.now()}.xlsx`);
  XLSX.writeFile(wb, file);
  return { file, roster };
}

test('병동 양식 엑셀: 이름 목록에 메모 열(DD·N/)이 섞이지 않고, N-keep 줄바꿈 이름도 인식, 모든 사람 31칸 정답', async ({ page }) => {
  const { file, roster } = wardWorkbook(2026, 9);
  await openApp(page, { name: '최간호' }); // 근무표에 없는 이름 → 이름 선택 창
  const picker = page.getByRole('dialog', { name: '본인 이름 선택' });
  const upload = async () => {
    await tab(page, '등록').click();
    await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(file);
  };

  for (const [i, p] of roster.people.entries()) {
    await upload();
    // 처음엔 선택 창, 그다음부터는 기억한 이름(앞 사람)으로 자동 등록 → '내 이름이 아니에요'로 다시 고르기
    if (i > 0) await page.getByRole('button', { name: '내 이름이 아니에요' }).click();
    await expect(picker).toBeVisible();
    if (i === 0) {
      const names = await picker.locator('.grid button').allInnerTexts();
      expect(names.map((t) => t.trim())).toEqual(roster.people.map((q) => q.name));
    }
    await picker.getByRole('button', { name: p.name, exact: true }).click();
    await expect(page.getByText('엑셀에서 8월 26일~9월 25일 근무 31일을 등록했어요')).toBeVisible();
    expect(await readLocal(page, 'my_shift_data')).toEqual(p.codes);
    await page.getByRole('button', { name: '되돌리기' }).click();
  }
  fs.rmSync(file, { force: true });
});

test("이름이 예전 기본 이름('최수민')과 같아도 직접 입력했으면 다시 확인 창이 뜨지 않음", async ({ page }) => {
  await openApp(page, { name: null });
  await page.getByPlaceholder('예: 김간호 (선택)').fill('최수민');
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('heading', { name: /최수민/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /최수민/ })).toBeVisible();
  await expect(page.getByText('이름을 확인해 주세요')).toHaveCount(0);
});

test('작은 사진(가로 약 900px): 이름 확인 진행률이 보이고, 확인할 칸이 많으면 다시 찍기 안내', async ({ page }) => {
  test.setTimeout(240000);
  // 그린 설정: makeRoster({ year: 2027, month: 3, seed: 10 }), renderRosterImage(…, { scale: 0.7, photo: { rotate: 0.4, blur: 0.3, quality: 75 } })
  await openApp(page, { name: '김하늘' });
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(fixture('roster-small.jpg'));
  await expect(page.getByText(/이름 확인 중\.\.\. \d+\/\d+/)).toBeVisible({ timeout: 120000 }); // 멈춘 것처럼 보이지 않게
  await expect(page.getByText(/사진에서 2월 26일~3월 25일 근무 \d+일을 등록했어요/)).toBeVisible({ timeout: 200000 });
  await expect(page.getByRole('note')).toContainText('다시 찍으면 더 정확해요');
});

test('옆으로 누운 사진(폰을 돌려 찍었는데 자동 회전 꺼짐)도 돌려서 읽음: 30칸 모두 정답', async ({ page }) => {
  test.setTimeout(240000);
  // roster-oct-photo.jpg 를 시계 방향 90° 돌린 것
  const roster = makeRoster({ year: 2026, month: 10, seed: 3 });
  const me = roster.people.find((p) => p.name === '한소희');
  await openApp(page, { name: '한소희' });
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(fixture('roster-oct-sideways.jpg'));
  await expect(page.getByText(/사진 방향 바꿔 읽는 중/)).toBeVisible({ timeout: 120000 });
  await expect(page.getByText('사진에서 9월 26일~10월 25일 근무 30일을 등록했어요')).toBeVisible({ timeout: 200000 });
  expect(await readLocal(page, 'my_shift_data')).toEqual(me.codes);
});

test('아주 큰 사진(약 4800만 화소): 아이폰 캔버스 한도(1670만 화소)를 넘는 캔버스를 만들지 않고 인식', async ({ page, browser }) => {
  test.setTimeout(240000);
  // 표가 가운데 있는 6000×8000 세로 사진 + 1.5° 기울기 (기울기 보정 캔버스까지 확인)
  const maker = await browser.newPage();
  const src = fs.readFileSync(fixture('roster-oct-photo.jpg')).toString('base64');
  const b64 = await maker.evaluate(async (src) => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 6000;
    c.height = 8000;
    const x = c.getContext('2d');
    x.fillStyle = '#d9d4c8';
    x.fillRect(0, 0, c.width, c.height);
    x.translate(3000, 4000);
    x.rotate((1.5 * Math.PI) / 180);
    const w = 5600;
    const h = (img.height / img.width) * w;
    x.drawImage(img, -w / 2, -h / 2, w, h);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  }, src);
  await maker.close();
  const file = path.join(os.tmpdir(), `huge-${Date.now()}.jpg`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));

  // 앱이 만드는 캔버스 중 가장 큰 넓이 기록
  await page.addInitScript(() => {
    window.__maxCanvas = 0;
    const desc = (k) => Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, k);
    const W = desc('width');
    const H = desc('height');
    const note = (el) => (window.__maxCanvas = Math.max(window.__maxCanvas, W.get.call(el) * H.get.call(el)));
    Object.defineProperty(HTMLCanvasElement.prototype, 'width', { get: W.get, set(v) { W.set.call(this, v); note(this); } });
    Object.defineProperty(HTMLCanvasElement.prototype, 'height', { get: H.get, set(v) { H.set.call(this, v); note(this); } });
  });
  const roster = makeRoster({ year: 2026, month: 10, seed: 3 });
  const me = roster.people.find((p) => p.name === '한소희');
  await openApp(page, { name: '한소희' });
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(file);
  await expect(page.getByText(/사진에서 9월 26일~10월 25일 근무 \d+일을 등록했어요/)).toBeVisible({ timeout: 200000 });
  const saved = await readLocal(page, 'my_shift_data');
  const wrong = Object.entries(me.codes).filter(([k, v]) => saved[k] && saved[k] !== v);
  expect(Object.keys(saved).length).toBeGreaterThanOrEqual(28);
  expect(wrong).toEqual([]);
  expect(await page.evaluate(() => window.__maxCanvas)).toBeLessThanOrEqual(16777216);
  fs.rmSync(file, { force: true });
});

test('인식 엔진이 어떤 칸에서 죽어도(Tesseract Assert → Aborted) 등록 전체가 실패하지 않고 이어서 읽음', async ({ page }) => {
  test.setTimeout(240000);
  // roster-oct-photo.jpg 를 -1.5° 돌린 사진: 칸별 인식 중 엔진 내부 오류(pageres.cpp Assert)가 나는 사진
  const roster = makeRoster({ year: 2026, month: 10, seed: 3 });
  const me = roster.people.find((p) => p.name === '한소희');
  await openApp(page, { name: '한소희' });
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(fixture('roster-oct-crash.jpg'));
  await expect(page.getByText(/사진에서 9월 26일~10월 25일 근무 \d+일을 등록했어요/)).toBeVisible({ timeout: 200000 });
  const saved = await readLocal(page, 'my_shift_data');
  expect(Object.keys(saved).length).toBeGreaterThanOrEqual(27);
  expect(Object.keys(saved).every((k) => k in me.codes)).toBe(true);
});

test('아주 흐리고 작은 사진: 엉뚱한 근무를 넣지 않고 다시 찍기 안내', async ({ page }) => {
  test.setTimeout(240000);
  // 그린 설정: makeRoster({ year: 2027, month: 1, seed: 24 }), renderRosterImage(…, { photo: { rotate: -0.8, blur: 0.8, quality: 45 } })
  await openApp(page, { name: '김하늘', local: { my_shift_data: { '2027-01-10': 'E' } } });
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(fixture('roster-blurry.jpg'));
  await expect(page.getByText(/사진이 흐려서 근무를 거의 읽지 못했어요/)).toBeVisible({ timeout: 200000 });
  await expect(page.getByRole('alert')).toContainText('사진이 흐려서'); // 실패는 체크 표시가 아닌 경고로
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2027-01-10': 'E' }); // 기존 근무 그대로
  await expect(page.getByRole('dialog', { name: '본인 이름 선택' })).toHaveCount(0);
});

test('엑셀 화면 캡처(브라우저·옆 목록이 함께 찍힘, 표가 화면 일부): 표만 잘라 크게 다시 읽어 이름·근무 인식', async ({ page }) => {
  test.setTimeout(240000);
  // 그린 설정: makeRoster({ year: 2026, month: 11, seed: 31 }), renderSpreadsheetScreenshot(…, { dpr: 1 }) — 1440×900
  // 이전에는 옆 목록 글자가 이름 칸에 섞여 '정민서'를 다른 글자로 읽어 이름 선택 창이 떴음
  const roster = makeRoster({ year: 2026, month: 11, seed: 31 });
  const me = roster.people.find((p) => p.name === '정민서');
  await openApp(page, { name: '정민서' });
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(fixture('roster-screenshot.png'));
  await expect(page.getByText(/사진에서 10월 26일~11월 25일 근무 \d+일을 등록했어요/)).toBeVisible({ timeout: 200000 });
  await expect(page.getByRole('dialog', { name: '본인 이름 선택' })).toHaveCount(0);
  const saved = await readLocal(page, 'my_shift_data');
  const right = Object.entries(me.codes).filter(([k, v]) => saved[k] === v).length;
  expect(right).toBeGreaterThanOrEqual(29);
});

test('모니터 화면을 폰으로 찍은 사진(어두운 테두리·1.5° 기울기·흐림): 기울기 보정·표 확대로 내 줄 등록', async ({ page }) => {
  test.setTimeout(240000);
  // 그린 설정: renderSpreadsheetScreenshot(makeRoster({ year: 2026, month: 11, seed: 31 }), { dpr: 2 }) 를
  // 4032×3024 검은 배경에 폭 90%, -1.5° 회전, blur 1.2px, 밝기 0.9, JPEG 85% 로 찍은 것처럼
  // 이전에는 어두운 테두리 때문에 기울기를 못 잡고 앞쪽 날짜(10/26~31) 칸을 놓쳐 많은 칸이 비었음
  const roster = makeRoster({ year: 2026, month: 11, seed: 31 });
  const me = roster.people.find((p) => p.name === '박지우');
  await openApp(page, { name: '박지우' });
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(fixture('roster-monitor-photo.jpg'));
  // 흐린 사진이라 맨 앞·뒤 날짜 칸 하나는 놓칠 수 있음 (그 칸은 비워 둠, 틀린 날짜로 넣지 않음)
  await expect(page.getByText(/사진에서 10월 2\d일~11월 2\d일 근무 \d+일을 등록했어요/)).toBeVisible({ timeout: 200000 });
  const saved = await readLocal(page, 'my_shift_data');
  const right = Object.entries(me.codes).filter(([k, v]) => saved[k] === v).length;
  expect(right).toBeGreaterThanOrEqual(28);
  expect(Object.keys(saved).every((k) => k >= '2026-10-26' && k <= '2026-11-26')).toBe(true);
});

test('사진 인식 중 [취소]: 바로 멈추고 근무는 그대로, 다시 올리면 정상 등록', async ({ page }) => {
  test.setTimeout(240000);
  const before = { '2026-10-01': 'N' };
  await openApp(page, { name: '한소희', local: { my_shift_data: before } });
  await tab(page, '등록').click();
  await photoInput(page).setInputFiles(fixture('roster-oct-photo.jpg'));
  await expect(page.getByText(/표 구조 분석 중|인식 엔진 준비 중/)).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByText('사진 인식을 취소했어요. 근무는 바뀌지 않았어요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '취소', exact: true })).toHaveCount(0);
  expect(await readLocal(page, 'my_shift_data')).toEqual(before);

  // 취소 뒤에도 다시 올리면 정상 동작 (엔진이 멈춘 상태로 남지 않음)
  await photoInput(page).setInputFiles(fixture('roster-oct-photo.jpg'));
  await expect(page.getByText('사진에서 9월 26일~10월 25일 근무 30일을 등록했어요')).toBeVisible({ timeout: 200000 });
});

/** 여러 탭 엑셀: [표지, 10월, 11월] (가짜 이름) */
function multiSheetWorkbook({ withCover = true, months = [10, 11], activeTab } = {}) {
  const wb = XLSX.utils.book_new();
  if (withCover) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['2026년 하반기 근무표'], ['작성: 수간호사']]), '표지');
  const rosters = {};
  months.forEach((month) => {
    const roster = makeRoster({ year: 2026, month, seed: 40 + month });
    const dates = rosterDates(2026, month, true);
    rosters[month] = roster;
    const rows = [
      ['', '', `<분당 5병동 2026년 ${month}월 근무표>`],
      ['', '', '분당\r\n5병동', ...dates.map((d) => String(d.getDate()))],
      ['', '', '', ...dates.map((d) => '일월화수목금토'[d.getDay()])],
      ...roster.people.map((p) => [p.rank, '', p.name, ...dates.map((d) => p.codes[keyOf(d)])])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `${month}월`);
  });
  const file = path.join(os.tmpdir(), `multi-${Date.now()}-${Math.random()}.xlsx`);
  XLSX.writeFile(wb, file);
  if (activeTab !== undefined) {
    // 엑셀이 저장하는 '마지막으로 보던 탭'(workbookView activeTab) — 라이브러리가 써 주지 않아 직접 넣음
    const zip = XLSX.CFB.read(fs.readFileSync(file), { type: 'buffer' });
    const entry = XLSX.CFB.find(zip, '/xl/workbook.xml');
    let xml = Buffer.from(entry.content).toString();
    xml = xml.includes('<bookViews>')
      ? xml.replace(/<workbookView/, `<workbookView activeTab="${activeTab}"`)
      : xml.replace('<sheets>', `<bookViews><workbookView activeTab="${activeTab}"/></bookViews><sheets>`);
    entry.content = Buffer.from(xml);
    entry.size = entry.content.length;
    fs.writeFileSync(file, XLSX.CFB.write(zip, { fileType: 'zip', type: 'buffer' }));
  }
  return { file, rosters };
}

test('엑셀 탭이 여러 개: 근무표 탭을 고르는 창(마지막으로 본 탭이 위), 고른 달로 등록 / 표지+근무표 1개면 바로 등록', async ({ page }) => {
  const { file, rosters } = multiSheetWorkbook({ activeTab: 2 }); // 11월 탭을 보던 파일
  await openApp(page, { name: '김하늘' });
  await tab(page, '등록').click();
  await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(file);
  const dialog = page.getByRole('dialog', { name: '엑셀 탭 선택' });
  await expect(dialog.getByText('근무표 탭이 2개')).toBeVisible();
  const names = await dialog.locator('button.w-full > span:first-child').allInnerTexts();
  expect(names).toEqual(['11월', '10월']); // 표지 제외, 보던 탭 먼저
  await expect(dialog.getByText('마지막으로 본 탭')).toBeVisible();
  await dialog.getByRole('button', { name: /^10월/ }).click();
  await expect(page.getByText('엑셀에서 9월 26일~10월 25일 근무 30일을 등록했어요')).toBeVisible();
  const me10 = rosters[10].people.find((p) => p.name === '김하늘');
  expect(await readLocal(page, 'my_shift_data')).toEqual(me10.codes);
  fs.rmSync(file, { force: true });

  // 표지 + 근무표 1개: 묻지 않고 근무표 탭으로 (예전에는 첫 탭(표지)만 읽어 '날짜 행을 찾지 못했습니다')
  const one = multiSheetWorkbook({ months: [11] });
  await page.getByRole('button', { name: '되돌리기' }).click();
  await tab(page, '등록').click();
  await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(one.file);
  await expect(page.getByText('엑셀에서 10월 26일~11월 25일 근무 31일을 등록했어요')).toBeVisible();
  await expect(page.getByRole('dialog', { name: '엑셀 탭 선택' })).toHaveCount(0);
  fs.rmSync(one.file, { force: true });
});
