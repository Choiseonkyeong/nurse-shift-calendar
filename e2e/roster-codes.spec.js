// 근무지마다 다른 표기(OF·D1·MD·T5 …)를 쓰는 근무표 사진: 처음 보는 표기는 한 번 묻고 기억
//  - 사진: e2e/rosterImage.js 의 makeCodesRoster·codesRosterHtml 로 그린 가짜 이름 근무표(정답을 앎)
//    그린 설정: makeCodesRoster({ year: 2026, month: 11, seed: 5 }) → 2배 확대, 세로선이 1~2px 출렁이게(휜 종이), 흐림 0.8px, JPEG 72
//  - 실제 동료 이름이 든 사진은 저장소에 두지 않음
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { openApp, readLocal, tab } from './helpers.js';
import { makeCodesRoster } from './rosterImage.js';

const fixture = path.join(import.meta.dirname, 'fixtures', 'roster-codes-photo.jpg');
const photoInput = (page) => page.locator('input[type=file][accept="image/*"]:not([capture])');
const roster = makeCodesRoster({ year: 2026, month: 11, seed: 5 });
const me = roster.people.find((p) => p.name === '박지우');
// 정답: OF → OFF, MD → 새 근무 'MD', T5 → 근무 아님(빈칸)
const expected = Object.fromEntries(
  Object.entries(me.raw).filter(([, c]) => c !== 'T5').map(([k, c]) => [k, c === 'OF' ? 'OFF' : c])
);

test('처음 보는 표기(MD·T5)는 무슨 근무인지 묻고 기억 → 다음 사진은 묻지 않고 바로 등록', async ({ page }) => {
  test.setTimeout(420000);
  await openApp(page, { name: '박지우' });
  await page.clock.setFixedTime(new Date('2026-11-05T09:00:00+09:00'));
  await tab(page, '설정').click();
  await photoInput(page).setInputFiles(fixture);

  await expect(page.getByText('처음 보는 근무 표기')).toBeVisible({ timeout: 200000 });
  await page.getByRole('group', { name: '표기 MD' }).getByRole('button', { name: "새 근무 'MD'" }).click();
  await page.getByRole('group', { name: '표기 T5' }).getByRole('button', { name: '근무 아님' }).click();
  await page.getByRole('button', { name: '등록하기' }).click();
  await expect(page.getByText(/사진에서 11월 1일~11월 30일 근무 \d+일을 등록했어요/)).toBeVisible();

  const saved = await readLocal(page, 'my_shift_data');
  const right = Object.entries(expected).filter(([k, v]) => saved[k] === v).length;
  const wrong = Object.entries(saved).filter(([k, v]) => expected[k] !== v);
  expect(right).toBeGreaterThanOrEqual(Object.keys(expected).length - 1);
  expect(wrong).toEqual([]);
  expect(await readLocal(page, 'shift_code_aliases')).toMatchObject({ MD: 'MD', T5: '' });
  expect((await readLocal(page, 'custom_shift_types')).map((t) => t.code)).toContain('MD');

  // 같은 근무표를 다시 올리면 묻지 않고 기억한 표기대로 바로 등록
  await page.getByRole('button', { name: '되돌리기' }).click();
  await tab(page, '설정').click();
  await photoInput(page).setInputFiles(fixture);
  await expect(page.getByText(/사진에서 11월 1일~11월 30일 근무 \d+일을 등록했어요/)).toBeVisible({ timeout: 200000 });
  await expect(page.getByText('처음 보는 근무 표기')).toHaveCount(0);
  const again = await readLocal(page, 'my_shift_data');
  expect(Object.entries(again).filter(([k, v]) => expected[k] !== v)).toEqual([]);
});
