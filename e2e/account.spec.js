import { test, expect } from '@playwright/test';
import { createFakeState, seedAccount, confirmPendingEmail } from './fakeSupabase.js';
import { openApp, readLocal, tab, waitSaved } from './helpers.js';

test('이메일 계정 연결: 인증 메일 → 인증 확인 → 비밀번호 설정', async ({ page }) => {
  const state = createFakeState();
  await openApp(page, { state });
  await waitSaved(page);

  // 연결 전: 프로필 버튼에 경고 표시
  await page.getByRole('button', { name: '계정 (연결 필요)' }).click();
  await expect(page.getByText(/임시 계정이에요/)).toBeVisible();
  await page.getByPlaceholder('이메일 주소').fill('nurse@example.com');
  await page.getByRole('button', { name: '인증 메일 보내기' }).click();
  await expect(page.getByText(/인증 메일을 보냈어요/)).toBeVisible();

  // 인증 전에 확인 → 아직
  await page.getByRole('button', { name: '인증 확인' }).click();
  await expect(page.getByText(/아직 인증 전이에요/)).toBeVisible();

  confirmPendingEmail(state); // 메일 링크 클릭
  await page.getByRole('button', { name: '인증 확인' }).click();
  await expect(page.getByText(/nurse@example.com.*연결되어 있어요/)).toBeVisible();

  await page.getByPlaceholder('비밀번호 (6자 이상)').fill('secret12');
  await page.getByRole('button', { name: '비밀번호 설정' }).click();
  await expect(page.getByText(/계정 연결이 끝났어요/)).toBeVisible();
  expect(Object.values(state.users).find((u) => u.email === 'nurse@example.com').password).toBe('secret12');

  await page.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('button', { name: '계정', exact: true })).toBeVisible();
});

test('이미 다른 계정의 이메일이면 안내', async ({ page }) => {
  const state = createFakeState();
  seedAccount(state, { email: 'taken@example.com', password: 'secret12', name: '누군가' });
  await openApp(page, { state });
  await waitSaved(page);
  await page.getByRole('button', { name: '계정 (연결 필요)' }).click();
  await page.getByPlaceholder('이메일 주소').fill('taken@example.com');
  await page.getByRole('button', { name: '인증 메일 보내기' }).click();
  await expect(page.getByText(/이미 다른 계정에 연결된 이메일/)).toBeVisible();
});

test('새 폰: 첫 화면에서 기존 계정으로 로그인 → 계정 데이터로 바뀜', async ({ page }) => {
  const state = createFakeState();
  seedAccount(state, { email: 'me@example.com', password: 'secret12', name: '최간호', shifts: { '2026-09-15': 'N' } });
  await openApp(page, { state, name: null });

  await page.getByRole('button', { name: /이미 계정이 있어요/ }).click();
  await page.getByPlaceholder('이메일 주소').fill('me@example.com');
  await page.getByPlaceholder('비밀번호').fill('wrong-pw');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText(/비밀번호가 올바르지 않습니다/)).toBeVisible();

  await page.getByPlaceholder('비밀번호').fill('secret12');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '최간호 님의 근무표' })).toBeVisible();
  await waitSaved(page);
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2026-09-15': 'N' });
});

test('인증 메일 링크로 열린 웹 페이지: 완료 안내 후 앱 데이터는 그대로', async ({ page }) => {
  await openApp(page, { local: { my_shift_data: { '2026-09-01': 'D' } } });
  // 메일 앱에서 링크를 누르면 새 페이지로 열림
  await page.goto('/?from=mail#access_token=abc&type=email_change&refresh_token=r');
  await expect(page.getByText('이메일 인증 완료')).toBeVisible();
  await page.getByRole('button', { name: '웹에서 근무표 열기' }).click();
  await expect(page.getByRole('heading', { name: '김간호 님의 근무표' })).toBeVisible();
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2026-09-01': 'D' });
  expect(page.url()).not.toContain('access_token');
});

test('계정 삭제: 확인 문구 입력 후 서버·기기 데이터 모두 삭제, 첫 화면으로', async ({ page }) => {
  const state = createFakeState();
  await openApp(page, { state, local: { my_shift_data: { '2026-09-01': 'D' } } });
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];
  await expect.poll(() => state.shifts[pid]).toEqual({ '2026-09-01': 'D' });

  await page.getByRole('button', { name: /^계정/ }).click();
  await page.getByRole('button', { name: '계정 삭제' }).click();
  const confirmBtn = page.getByRole('button', { name: '영구 삭제' });
  await expect(confirmBtn).toBeDisabled();
  await page.getByLabel('계정 삭제 확인').fill('삭제');
  await confirmBtn.click();

  await expect(page.getByText('환영합니다!')).toBeVisible();
  expect(state.profiles[pid]).toBeUndefined();
  expect(state.shifts[pid]).toBeUndefined();
  expect(await readLocal(page, 'my_shift_data')).toEqual({}); // 앱이 빈 저장소로 다시 시작
});

test('개인정보처리방침 페이지', async ({ page }) => {
  await openApp(page);
  await tab(page, '등록').click();
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: '개인정보처리방침' }).click()]);
  await expect(popup.getByRole('heading', { name: '개인정보처리방침' })).toBeVisible();
  await expect(popup.getByText(/기기 안에서만/)).toBeVisible();
  await expect(popup.getByText(/계정 삭제/).first()).toBeVisible();
});

test('새 폰 로그인 직후 서버에서 근무를 불러오는 동안 "근무를 등록해 볼까요?" 안내가 뜨지 않음', async ({ page }) => {
  const state = createFakeState();
  seedAccount(state, { email: 'me@example.com', password: 'secret12', name: '최간호', shifts: { '2026-09-15': 'N' } });
  await openApp(page, { state, name: null });
  await page.getByRole('button', { name: /이미 계정이 있어요/ }).click();
  await page.getByPlaceholder('이메일 주소').fill('me@example.com');
  await page.getByPlaceholder('비밀번호').fill('secret12');
  state.delay = { get_my_shifts: 2500 };
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('서버 연결 중')).toBeVisible();
  // 불러오는 동안(자동 재시도 없이 그 순간) 안내가 없어야 함
  await page.waitForTimeout(500);
  expect(await page.getByText('근무를 등록해 볼까요?').count()).toBe(0);
  await waitSaved(page);
  await expect(page.getByRole('button', { name: /^9월 15일 N 근무/ })).toBeVisible();
  await expect(page.getByText('근무를 등록해 볼까요?')).toHaveCount(0);
});
