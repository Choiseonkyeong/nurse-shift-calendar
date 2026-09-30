import { test, expect } from '@playwright/test';
import { openApp, readLocal, tab, waitSaved, confirmOk } from './helpers.js';
import { createFakeState, seedAccount } from './fakeSupabase.js';

const KAKAO_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 KAKAOTALK 10.8.3';
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

test('근무·메모 전체 삭제: 첫 화면으로 가지 않고, 서버에서도 지워지고, 이름·근무 종류는 그대로', async ({ page }) => {
  const state = createFakeState();
  await openApp(page, {
    state,
    name: '최간호',
    local: { my_shift_data: { '2026-09-10': 'D', '2026-09-11': 'N' }, day_notes: { '2026-09-10': '회식' } }
  });
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];
  await expect.poll(() => Object.keys(state.shifts[pid] || {}).length).toBe(2);
  await expect.poll(() => Object.keys(state.notes[pid] || {}).length).toBe(1);

  await tab(page, '등록').click();
  await page.getByRole('button', { name: '근무·메모 전체 삭제' }).click();
  await expect(page.getByRole('dialog', { name: '근무·메모를 모두 지울까요?' })).toContainText('이름·계정·그룹');
  await confirmOk(page);

  await expect(page.getByText('근무·메모를 모두 지웠어요.')).toBeVisible();
  await expect(page.getByText('환영합니다!')).toHaveCount(0);
  expect(await readLocal(page, 'my_shift_data')).toEqual({});
  await expect.poll(() => Object.keys(state.shifts[pid] || {})).toEqual([]);
  await expect.poll(() => Object.keys(state.notes[pid] || {})).toEqual([]);

  // 새로고침(=다른 폰 로그인과 같이 서버에서 다시 받기)해도 돌아오지 않음, 이름 그대로
  await page.reload();
  await waitSaved(page);
  await expect(page.getByText('환영합니다!')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /최간호/ })).toBeVisible();
  expect(await readLocal(page, 'my_shift_data')).toEqual({});
});

test('계정 창: 이 폰에서 로그아웃 → 처음 화면, 다시 로그인하면 근무가 돌아옴', async ({ page }) => {
  const state = createFakeState();
  const { profile } = seedAccount(state, { email: 'me@example.com', password: 'secret12', name: '최간호' });
  state.shifts[profile.id] = { '2026-09-10': 'D' };
  const login = async () => {
    await page.getByRole('button', { name: /이미 계정이 있어요/ }).click();
    await page.getByPlaceholder('이메일 주소').fill('me@example.com');
    await page.getByPlaceholder('비밀번호').fill('secret12');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await waitSaved(page);
  };
  await openApp(page, { state, name: null });
  await login();
  await expect(page.getByRole('button', { name: '9월 10일 D 근무' })).toBeVisible();

  await page.getByRole('button', { name: '계정', exact: true }).click();
  await page.getByRole('button', { name: '이 폰에서 로그아웃' }).click();
  await confirmOk(page);
  await expect(page.getByText('환영합니다!')).toBeVisible();
  expect(state.shifts[profile.id]).toEqual({ '2026-09-10': 'D' }); // 서버는 그대로

  await login();
  await expect(page.getByRole('button', { name: '9월 10일 D 근무' })).toBeVisible();
});

test('카카오톡 안 브라우저: 첫 화면·달력에 크롬으로 열기 안내, 쓰던 근무가 있으면 계정 연결 안내, 닫으면 다시 안 뜸', async ({ browser }) => {
  const context = await browser.newContext({ userAgent: KAKAO_UA });
  const page = await context.newPage();
  await openApp(page, { name: null });
  const open = page.getByRole('link', { name: '크롬으로 열기' });
  await expect(open).toHaveAttribute('href', /^kakaotalk:\/\/web\/openExternal\?url=http%3A%2F%2F/);
  await page.getByRole('button', { name: '이름 없이 시작하기' }).click();

  const hint = page.getByRole('region', { name: '홈 화면에 추가 안내' });
  await expect(hint).toContainText('카카오톡 안에서 열렸어요');
  await expect(hint.getByRole('link', { name: '크롬으로 열기' })).toBeVisible();
  await expect(hint).not.toContainText('계정을 연결'); // 아직 근무 없음

  await page.getByRole('button', { name: /^9월 10일/ }).first().click();
  await page.getByRole('button', { name: /^Day/ }).click();
  await expect(hint).toContainText('계정을 연결');

  await hint.getByRole('button', { name: '안내 닫기' }).click();
  await expect(hint).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('서버에 저장됨')).toBeVisible();
  await expect(page.getByRole('region', { name: '홈 화면에 추가 안내' })).toHaveCount(0);
  await context.close();
});

test('아이폰 사파리: 공유 → 홈 화면에 추가 안내 / 안드로이드: 설치 창 버튼', async ({ browser, page }) => {
  const ios = await browser.newContext({ userAgent: IOS_UA });
  const p = await ios.newPage();
  await openApp(p);
  await expect(p.getByRole('region', { name: '홈 화면에 추가 안내' })).toContainText("'홈 화면에 추가'");
  await ios.close();

  await openApp(page);
  const hint = page.getByRole('region', { name: '홈 화면에 추가 안내' });
  await expect(page.getByText('서버에 저장됨')).toBeVisible();
  await expect(hint).toHaveCount(0); // 설치 창을 띄울 수 없는 브라우저는 안내 없음
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => {
      window.__prompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await hint.getByRole('button', { name: '홈 화면에 설치' }).click();
  await expect.poll(() => page.evaluate(() => window.__prompted)).toBe(true);
  await expect(hint).toHaveCount(0);
});
