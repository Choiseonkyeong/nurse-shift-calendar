import { test, expect } from '@playwright/test';
import { createFakeState, seedSocialAccount } from './fakeSupabase.js';
import { openApp, readLocal, waitSaved } from './helpers.js';

test('서버에서 켜지 않은 소셜 로그인은 버튼이 안 보임', async ({ page }) => {
  await openApp(page, { state: createFakeState({ providers: { google: true } }), name: null });
  await expect(page.getByRole('button', { name: 'Google로 시작' })).toBeVisible();
  await expect(page.getByRole('button', { name: '카카오로 시작' })).toHaveCount(0);
});

test('카카오 계정 연결: 지금 쓰던 근무 그대로, 계정 상태 연결됨', async ({ page }) => {
  const state = createFakeState({ providers: { kakao: true, google: true } });
  await openApp(page, { state, local: { my_shift_data: { '2026-09-10': 'E' } } });
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];

  await page.getByRole('button', { name: '계정 (연결 필요)' }).click();
  await page.getByRole('button', { name: '카카오로 계정 연결' }).click();

  // 카카오 로그인 → 앱으로 복귀 → 연결 안내
  await expect(page.getByText(/카카오 계정이 연결됐어요/)).toBeVisible();
  expect(page.url()).not.toContain('access_token');
  await expect(page.getByText(/카카오.*계정에 연결되어 있어요/)).toBeVisible();
  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('button', { name: '계정', exact: true })).toBeVisible();

  // 같은 계정·프로필 유지
  await waitSaved(page);
  expect(Object.keys(state.profiles)).toEqual([pid]);
  expect(state.shifts[pid]).toEqual({ '2026-09-10': 'E' });
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2026-09-10': 'E' });
});

test('이미 다른 계정에 연결된 카카오면 안내하고 데이터는 그대로', async ({ page }) => {
  const state = createFakeState({ providers: { kakao: true } });
  seedSocialAccount(state, { provider: 'kakao', sub: 'social-1', name: '다른사람' });
  await openApp(page, { state, local: { my_shift_data: { '2026-09-10': 'E' } } });
  await waitSaved(page);

  await page.getByRole('button', { name: '계정 (연결 필요)' }).click();
  await page.getByRole('button', { name: '카카오로 계정 연결' }).click();
  await expect(page.getByText(/이미 다른 근무표 계정에 연결되어 있어요/)).toBeVisible();
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2026-09-10': 'E' });
});

test('새 폰 첫 화면: 카카오로 시작 → 기존 계정의 이름·근무로', async ({ page }) => {
  const state = createFakeState({ providers: { kakao: true } });
  seedSocialAccount(state, { provider: 'kakao', sub: 'social-1', name: '최간호', shifts: { '2026-09-15': 'N' } });
  await openApp(page, { state, name: null });

  await page.getByRole('button', { name: '카카오로 시작' }).click();
  await expect(page.getByRole('heading', { name: '최간호 님의 근무표' })).toBeVisible();
  await waitSaved(page);
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2026-09-15': 'N' });
  await expect(page.getByRole('button', { name: '계정', exact: true })).toBeVisible();
});

test('처음 쓰는 카카오 계정으로 시작 → 카카오 이름으로 새 계정', async ({ page }) => {
  const state = createFakeState({ providers: { kakao: true } });
  await openApp(page, { state, name: null });

  await page.getByRole('button', { name: '카카오로 시작' }).click();
  await expect(page.getByRole('heading', { name: '카카오간호 님의 근무표' })).toBeVisible();
  await waitSaved(page);
  expect(Object.values(state.profiles).map((p) => p.display_name)).toEqual(['카카오간호']);
});

test('쓰던 기기에서 기존 카카오 계정으로 로그인: 확인 후 계정 데이터로 교체', async ({ page }) => {
  const state = createFakeState({ providers: { kakao: true } });
  seedSocialAccount(state, { provider: 'kakao', sub: 'social-1', name: '최간호', shifts: { '2026-09-15': 'N' } });
  await openApp(page, { state, local: { my_shift_data: { '2026-09-01': 'D' } } });
  await waitSaved(page);

  await page.getByRole('button', { name: '계정 (연결 필요)' }).click();
  await page.getByRole('button', { name: '기존 계정으로 로그인' }).click();
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '카카오로 로그인' }).click();

  await expect(page.getByRole('heading', { name: '최간호 님의 근무표' })).toBeVisible();
  await waitSaved(page);
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2026-09-15': 'N' });
});
