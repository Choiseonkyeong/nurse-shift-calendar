import { test, expect } from '@playwright/test';
import { createFakeState, seedGroupWithMate, installFakeSupabase } from './fakeSupabase.js';
import { openApp, readLocal, tab, waitSaved } from './helpers.js';

async function setup(page, { myShifts = {}, mateShifts = {} } = {}) {
  const state = createFakeState();
  await openApp(page, { state, local: { my_shift_data: myShifts } });
  await waitSaved(page);
  const me = Object.values(state.profiles)[0];
  const { mate, group } = seedGroupWithMate(state, me.id, { mateShifts });
  return { state, me, mate, group };
}

test('교환 요청을 보내면 대기 중으로 표시, 취소 가능', async ({ page }) => {
  const { state, mate } = await setup(page, { myShifts: { '2026-09-29': 'D' }, mateShifts: { '2026-09-29': 'N' } });
  await tab(page, '그룹').click();
  await page.getByText('7병동 (2명)').click();
  await page.getByRole('button', { name: '근무 교환 요청하기' }).click();
  await page.locator('input[type=date]').first().fill('2026-09-29');
  await page.getByPlaceholder(/메시지/).fill('가족 행사');
  await page.getByRole('button', { name: '교환 요청 보내기' }).click();

  await expect(page.getByText('대기 중')).toBeVisible();
  expect(state.swaps[0]).toMatchObject({ target_id: mate.id, dates: ['2026-09-29'], snapshot: { '2026-09-29': { requester: 'D', target: 'N' } } });

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '요청 취소' }).click();
  await expect(page.getByText('취소됨')).toBeVisible();
});

test('받은 교환 요청 수락 → 두 사람 근무가 바뀌고 내 달력에도 반영', async ({ page }) => {
  const { state, me, mate, group } = await setup(page, { myShifts: { '2026-09-29': 'N' }, mateShifts: { '2026-09-29': 'D' } });
  state.swaps.push({
    id: 'swap-x',
    group_id: group.id,
    requester_id: mate.id,
    target_id: me.id,
    dates: ['2026-09-29'],
    snapshot: { '2026-09-29': { requester: 'D', target: 'N' } },
    message: '부탁해요',
    status: 'pending',
    created_at: new Date().toISOString(),
    decided_at: null
  });
  state.posts.push({ id: 'p1', group_id: group.id, author_id: mate.id, body: '공지', created_at: new Date().toISOString() });

  await tab(page, '그룹').click();
  // 목록: 교환 요청 · 새 글 표시
  await expect(page.getByText('교환 요청 1')).toBeVisible();
  await expect(page.getByText('새 글')).toBeVisible();

  await page.getByText('7병동 (2명)').click();
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '수락' }).click();
  await expect(page.getByText('교환 완료')).toBeVisible();

  expect(state.shifts[me.id]['2026-09-29']).toBe('D');
  expect(state.shifts[mate.id]['2026-09-29']).toBe('N');
  await expect.poll(async () => (await readLocal(page, 'my_shift_data'))['2026-09-29']).toBe('D');

  // 게시판을 봤으므로 목록의 새 글 표시는 사라짐
  await page.getByRole('button', { name: /전체 그룹 목록/ }).click();
  await expect(page.getByText('새 글')).toHaveCount(0);
});

test('다른 탭에서 바꾼 날짜가 그룹 탭 선택 날짜에 반영', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: '다음 달' }).first().click();
  await tab(page, '그룹').click();
  await page.getByText('7병동 (2명)').click();
  await expect(page.getByRole('heading', { name: '2026년 10월' })).toBeVisible();
  await expect(page.getByText('10월 1일 (목) 근무')).toBeVisible();
});

test('그룹 만들기 → 초대 링크 공유 → 동료가 링크로 열어 참여 → 게시판 → 나가기', async ({ page, browser }) => {
  const state = createFakeState();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page, { state, name: '김간호' });
  await waitSaved(page);
  await tab(page, '그룹').click();
  await page.getByPlaceholder('예: 81병동 동기').fill('7병동 동기');
  await page.getByRole('button', { name: '그룹 만들기' }).click();
  await expect(page.getByText(/'7병동 동기' 그룹이 생성되었습니다/)).toBeVisible();

  // 초대하기: 공유 시트가 없는 환경이면 링크 복사
  await page.getByRole('button', { name: /동료 초대하기/ }).click();
  await expect(page.getByText(/초대 링크를 복사했어요/)).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const link = copied.match(/https?:\/\/\S+\?join=(\w+)/);
  expect(link).toBeTruthy();
  const code = link[1];
  expect(state.groups[0].code).toBe(code);

  // 동료: 초대 링크로 열면 그룹 탭 + 코드 자동 입력
  const mate = await browser.newPage();
  await installFakeSupabase(mate.context(), state);
  await mate.clock.setFixedTime(new Date('2026-09-28T09:00:00+09:00'));
  await mate.addInitScript(() => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('shift_user_name', '박동료');
    }
  });
  await mate.goto(`/?join=${code}`);
  await expect(mate.getByPlaceholder('6자리 코드 입력')).toHaveValue(code);
  expect(mate.url()).not.toContain('join=');
  await waitSaved(mate);
  await mate.getByRole('button', { name: '그룹 참여하기' }).click();
  await expect(mate.getByText(/'7병동 동기' 그룹에 참여했습니다/)).toBeVisible();
  await expect.poll(() => state.groups[0].members.length).toBe(2);

  // 게시판 글 → 만든 사람에게 보임
  await mate.getByLabel('게시글 내용').fill('이번 주 회식 금요일 7시!');
  await mate.getByRole('button', { name: '등록', exact: true }).first().click();
  await expect.poll(() => state.posts.length).toBe(1);
  await page.getByRole('button', { name: '새로고침' }).first().click();
  await expect(page.getByText('이번 주 회식 금요일 7시!')).toBeVisible();

  // 동료가 나가기
  mate.on('dialog', (d) => d.accept());
  await mate.getByRole('button', { name: '나가기', exact: true }).click();
  await expect.poll(() => state.groups[0].members.length).toBe(1);
  await mate.close();
});
