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
