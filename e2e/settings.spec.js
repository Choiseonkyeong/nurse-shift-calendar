import { test, expect } from '@playwright/test';
import { createFakeState, seedAccount } from './fakeSupabase.js';
import { openApp, readLocal, tab, waitSaved } from './helpers.js';

const day = (page, label) => page.getByRole('button', { name: new RegExp(`^${label} (?!\\()`) }); // 메모 버튼 "9월 5일 (토) 메모" 제외

test('오프라인에서 만든 근무 종류와 그 근무가 연결 후 서버에 저장되고 사라지지 않음', async ({ page }) => {
  const state = createFakeState();
  await openApp(page, { state });
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];

  state.offline = true;
  await page.reload();
  await expect(page.getByText('오프라인 · 기기 저장')).toBeVisible();
  await page.getByRole('button', { name: /종류/ }).click();
  await page.getByRole('button', { name: /새 근무 추가/ }).click();
  await page.getByPlaceholder('예: 교', { exact: true }).fill('교');
  await page.getByPlaceholder('예: 교육', { exact: true }).fill('교육');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.getByRole('button', { name: '닫기' }).click();
  await day(page, '9월 8일').click();
  await page.getByRole('button', { name: /^교육/ }).click();

  state.offline = false;
  await page.reload();
  await waitSaved(page);
  await expect.poll(() => state.types[pid]?.['교']?.label).toBe('교육');
  await expect.poll(() => state.shifts[pid]?.['2026-09-08']).toBe('교');
  // 서버 목록으로 다시 불러와도 그대로
  await page.reload();
  await waitSaved(page);
  await expect(page.getByRole('button', { name: '9월 8일 교 근무' })).toBeVisible();
  expect(await readLocal(page, 'pending_type_ops')).toBeNull();
});

test('오프라인에서 지운 근무 종류는 연결 후에도 되살아나지 않음', async ({ page }) => {
  const state = createFakeState();
  await openApp(page, { state });
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];
  state.types[pid] = {
    야: { code: '야', label: '야간당직', kind: 'work', bg_color: '#E0E7FF', text_color: '#3730A3', night_hours: 0 }
  };
  await page.reload();
  await waitSaved(page);

  state.offline = true;
  await page.reload();
  await page.getByRole('button', { name: /종류/ }).click();
  await page.getByRole('button', { name: /야간당직/ }).click();
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '삭제' }).click();

  state.offline = false;
  await page.reload();
  await waitSaved(page);
  await expect.poll(() => Object.keys(state.types[pid] || {})).toEqual([]);
  await page.getByRole('button', { name: /종류/ }).click();
  await expect(page.getByRole('button', { name: /야간당직/ })).toHaveCount(0);
});

test('설정(시급·연차)이 서버에 저장되고 새 폰 로그인 시 복원', async ({ page, browser }) => {
  const state = createFakeState();
  const { profile } = seedAccount(state, { email: 'me@example.com', password: 'secret12', name: '최간호' });

  // 기존 폰: 계정으로 로그인 후 시급·연차 입력
  await openApp(page, { state, name: null });
  await page.getByRole('button', { name: /이미 계정이 있어요/ }).click();
  await page.getByPlaceholder('이메일 주소').fill('me@example.com');
  await page.getByPlaceholder('비밀번호').fill('secret12');
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await waitSaved(page);
  await tab(page, '연차/수당').click();
  await page.getByPlaceholder('시급 입력').fill('15000');
  await expect.poll(() => state.settings[profile.id]?.settings?.shift_configs?.hourlyWage).toBe(15000);

  // 새 폰
  const other = await browser.newPage();
  await openApp(other, { state, name: null });
  await other.getByRole('button', { name: /이미 계정이 있어요/ }).click();
  await other.getByPlaceholder('이메일 주소').fill('me@example.com');
  await other.getByPlaceholder('비밀번호').fill('secret12');
  other.on('dialog', (d) => d.accept());
  await other.getByRole('button', { name: '로그인', exact: true }).click();
  await waitSaved(other);
  await tab(other, '연차/수당').click();
  await expect(other.getByPlaceholder('시급 입력')).toHaveValue('15000');
  await other.close();
});

test('팝업: Esc·바깥 누르면 닫힘, 포커스는 팝업 안에서만 이동', async ({ page }) => {
  await openApp(page);
  const dialog = page.getByRole('dialog', { name: '근무 직접 수정' });

  await day(page, '9월 5일').click();
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 15; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await day(page, '9월 5일').click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5); // 어두운 바깥
  await expect(dialog).toHaveCount(0);

  // 첫 실행 이름 입력 창은 필수라 Esc 로 닫히지 않음
  const fresh = await page.context().newPage();
  await fresh.addInitScript(() => localStorage.clear());
  await fresh.goto('/');
  await fresh.keyboard.press('Escape');
  await expect(fresh.getByText('환영합니다!')).toBeVisible();
  await fresh.close();
});

test('웹 푸시 설정이 없으면 알림 창에 웹 알림 한계 안내', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /^알림$/ }).click();
  await expect(page.getByText(/웹에서는 이 화면이 열려 있을 때만/)).toBeVisible();
});

test('근무 종류: 새 근무 추가 화면에서 Esc → 목록으로, 한 번 더 → 닫힘 (내용이 바뀐 창도 Esc 동작)', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /종류/ }).first().click();
  await page.getByRole('button', { name: /새 근무 추가/ }).click();
  await expect(page.getByRole('heading', { name: '새 근무 추가' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: '근무 종류 관리' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '근무 종류 관리' })).toHaveCount(0);
});
