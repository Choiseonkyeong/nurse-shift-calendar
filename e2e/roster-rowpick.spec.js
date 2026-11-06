// 사람이 많은 근무표 · 표기가 X·V·♡·빈칸인 근무표: 내 줄만 골라 읽기 → 확인 화면에서 같은 표시를 한 번에 고름
//  - 사진: e2e/rosterImage.js 의 makeMarkRoster({ year: 2026, month: 11, seed: 7 }) · markRosterHtml 을
//    1200px 화면 · 1.5배로 찍은 JPEG 80 (가짜 이름). 실제 동료 이름이 든 사진은 저장소에 두지 않음
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { openApp, readLocal, tab } from './helpers.js';
import { makeMarkRoster } from './rosterImage.js';

const fixture = path.join(import.meta.dirname, 'fixtures', 'roster-marks.jpg');
// 사진 높이 대비 날짜 줄 · 6번째 사람(강서연) 줄 가운데 (그릴 때 잰 위치)
const DATE_Y = 0.0844;
const ROW_Y = 0.3299;
const me = makeMarkRoster({ year: 2026, month: 11, seed: 7 }).people[5];
// 이 병동 표기 뜻 (사용자가 고르는 값)
const MEANING = { X: 'OFF', V: '연차', '♡': 'OFF', '': '' };
const expected = Object.fromEntries(
  Object.entries(me.raw).map(([k, v]) => [k, MEANING[v] ?? v]).filter(([, v]) => v)
);

async function pickRows(page) {
  const img = page.getByRole('img', { name: '근무표 사진' });
  await expect(img).toBeVisible({ timeout: 60000 });
  // 사진이 다 그려진 뒤 (덜 그려졌을 때 누르면 높이가 달라 다른 줄이 눌림)
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalHeight > 0 && el.clientHeight > 100)).toBe(true);
  for (const frac of [DATE_Y, ROW_Y]) {
    const box = await img.boundingBox();
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * frac);
  }
  await expect(page.getByText('2026년 11월 내 근무 확인')).toBeVisible({ timeout: 120000 });
}

test('내 줄만 골라 읽기: 날짜 줄·내 줄을 누르면 사진 속 칸과 함께 확인 → 같은 표시는 한 번에, 다음엔 기억', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, { name: '강서연' });
  await tab(page, '설정').click();
  await page.locator('label', { hasText: '내 줄만 골라 읽기' }).locator('input[type=file]').setInputFiles(fixture);
  await pickRows(page);

  // '?' 칸은 같은 표시끼리 한 번에 정해짐 → 몇 번만 누르면 끝
  let taps = 0;
  while (taps < 12) {
    const sel = page.getByRole('button', { pressed: true, name: /^11월 \d+일 확인 필요/ });
    if (!(await sel.count())) break;
    const day = Number((await sel.getAttribute('aria-label')).match(/11월 (\d+)일/)[1]);
    const truth = me.raw[`2026-11-${String(day).padStart(2, '0')}`];
    const want = MEANING[truth] ?? truth;
    await page.getByRole('dialog').getByRole('button', { name: want || '비우기', exact: true }).last().click();
    taps += 1;
  }
  expect(taps).toBeLessThanOrEqual(8);
  await page.getByRole('button', { name: /^등록하기/ }).click();
  await expect(page.getByText(/사진에서 11월 근무 \d+일을 등록했어요/)).toBeVisible();

  const saved = await readLocal(page, 'my_shift_data');
  const wrong = Object.entries(expected).filter(([k, v]) => saved[k] !== v);
  expect(wrong.length).toBeLessThanOrEqual(1);
  // 글자로 읽힌 표시(X)·♡·빈칸은 기억 (글자로 못 읽은 '기호'는 다음 사진에서 같은 모양이라는 보장이 없어 기억하지 않음)
  expect(await readLocal(page, 'shift_code_aliases')).toMatchObject({ X: 'OFF', '♡': 'OFF', 빈칸: '' });

  // 다음 사진: 기억한 표기로 바로 채워져 물을 칸이 거의 없음 (글자로 못 읽는 V 칸 정도)
  await tab(page, '설정').click();
  await page.locator('label', { hasText: '내 줄만 골라 읽기' }).locator('input[type=file]').setInputFiles(fixture);
  await pickRows(page);
  const vDays = Object.values(me.raw).filter((v) => v === 'V').length;
  expect(await page.getByRole('button', { name: /확인 필요/ }).count()).toBeLessThanOrEqual(vDays);
});
