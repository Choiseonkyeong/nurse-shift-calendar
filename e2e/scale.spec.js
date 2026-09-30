// 오래 쓴 사용자·큰 그룹: 서버가 한 번에 1000행만 돌려줘도 빠짐없이 받아오는지
import { test, expect } from '@playwright/test';
import { createFakeState, seedAccount, seedGroupWithMate, MAX_ROWS } from './fakeSupabase.js';
import { openApp, readLocal, tab, waitSaved } from './helpers.js';

const CODES = ['D', 'E', 'N', 'OFF'];
/** start 부터 n일 연속 근무 { 'YYYY-MM-DD': code } */
function days(start, n, codeOf = (i) => CODES[i % 4]) {
  const out = {};
  const [y, m, d] = start.split('-').map(Number);
  for (let i = 0; i < n; i++) {
    const t = new Date(Date.UTC(y, m - 1, d + i));
    out[t.toISOString().slice(0, 10)] = codeOf(i);
  }
  return out;
}

test('근무·메모가 1000일을 넘어도 새 폰 로그인 시 최근 날짜까지 모두 받아옴', async ({ page }) => {
  // 2023-06-01 부터 1200일 (마지막 날 2026-09-12)
  const shifts = days('2023-06-01', 1200);
  expect(Object.keys(shifts).length).toBeGreaterThan(MAX_ROWS);
  const state = createFakeState();
  const { profile } = seedAccount(state, { email: 'me@example.com', password: 'secret12', name: '최간호', shifts });
  state.notes[profile.id] = Object.fromEntries(Object.keys(days('2023-06-01', 1100)).map((k) => [k, `메모 ${k}`]));

  await openApp(page, { state, name: null });
  await page.getByRole('button', { name: /이미 계정이 있어요/ }).click();
  await page.getByPlaceholder('이메일 주소').fill('me@example.com');
  await page.getByPlaceholder('비밀번호').fill('secret12');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await waitSaved(page);

  const local = await readLocal(page, 'my_shift_data');
  expect(Object.keys(local).length).toBe(1200);
  expect(local['2026-09-12']).toBe(shifts['2026-09-12']);
  const notes = await readLocal(page, 'day_notes');
  expect(Object.keys(notes).length).toBe(1100);
  // 서버의 근무가 사라지지 않음
  expect(Object.keys(state.shifts[profile.id]).length).toBe(1200);
  await expect(page.getByRole('button', { name: /^9월 12일 [A-Z]+ 근무/ })).toBeVisible();
});

test('이미 쓰던 기기: 다시 동기화해도 1000일 이후 최근 근무가 달력에서 사라지지 않음', async ({ page }) => {
  const shifts = days('2023-06-01', 1200);
  const state = createFakeState();
  await openApp(page, { state, local: { my_shift_data: shifts } });
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];
  await expect.poll(() => Object.keys(state.shifts[pid] || {}).length).toBe(1200);
  // 앱으로 다시 돌아와 동기화 (새로고침)
  await page.reload();
  await waitSaved(page);
  expect(Object.keys(await readLocal(page, 'my_shift_data')).length).toBe(1200);
  await expect(page.getByRole('button', { name: /^9월 12일 [A-Z]+ 근무/ })).toBeVisible();
});

test('멤버가 많은 그룹(40명 × 한 달)도 월말 근무까지 모두 보임', async ({ page }) => {
  const state = createFakeState();
  await openApp(page, { state });
  await waitSaved(page);
  const me = Object.values(state.profiles)[0];
  const { group } = seedGroupWithMate(state, me.id, { mateName: '멤버01', mateShifts: days('2026-09-01', 30) });
  for (let i = 2; i <= 40; i++) {
    const p = { id: `profile-big-${String(i).padStart(2, '0')}`, auth_user_id: null, display_name: `멤버${String(i).padStart(2, '0')}` };
    state.profiles[p.id] = p;
    state.shifts[p.id] = days('2026-09-01', 30, () => (i === 40 ? 'N' : 'D'));
    group.members.push(p.id);
  }
  await tab(page, '그룹').click();
  await page.getByText(/7병동 \(41명\)/).click();
  await page.getByRole('button', { name: '2026-09-30' }).click();
  await expect(page.getByText('9월 30일 (수) 근무')).toBeVisible();
  const card = page.locator('div', { hasText: /^멤버40 쌤/ }).last();
  await expect(card).toContainText('N');
});
