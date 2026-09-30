import { test, expect } from '@playwright/test';
import { createFakeState } from './fakeSupabase.js';
import { openApp, readLocal, tab, waitSaved } from './helpers.js';

const day = (page, label) => page.getByRole('button', { name: new RegExp(`^${label} (?!\\()`) }); // 메모 버튼 "9월 5일 (토) 메모" 제외

test('첫 실행: 이름 입력 → 서버 연결 → 근무 입력이 서버에 저장', async ({ page }) => {
  const state = await openApp(page, { name: null });
  await expect(page.getByText('환영합니다!')).toBeVisible();
  await page.getByPlaceholder('예: 김간호').fill('이간호');
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByRole('heading', { name: '이간호 님의 근무표' })).toBeVisible();
  await waitSaved(page);

  await day(page, '9월 10일').click();
  await page.getByRole('button', { name: /Night \(나이트\)/ }).click();
  await expect.poll(() => Object.values(state.shifts)[0]?.['2026-09-10']).toBe('N');
});

test('예전 기본 이름 사용자는 한 번 이름 확인', async ({ page }) => {
  await openApp(page, { name: '최수민' });
  await expect(page.getByText('이름을 확인해 주세요')).toBeVisible();
  await page.getByPlaceholder('예: 김간호').fill('박간호');
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await expect(page.getByRole('heading', { name: '박간호 님의 근무표' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('이름을 확인해 주세요')).toHaveCount(0);
});

test('동기화: 다른 기기 변경은 반영, 오프라인에서 지운 근무는 되살아나지 않음', async ({ page }) => {
  const state = createFakeState();
  await openApp(page, { state });
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];

  // 이 기기에서 입력 → 서버 반영
  await day(page, '9월 1일').click();
  await page.getByRole('button', { name: /Day \(데이\)/ }).click();
  await day(page, '9월 2일').click();
  await page.getByRole('button', { name: /Evening/ }).click();
  await expect.poll(() => state.shifts[pid]).toEqual({ '2026-09-01': 'D', '2026-09-02': 'E' });

  // 다른 기기에서 9/2 변경 + 9/3 추가 → 앱 다시 열면 반영
  state.shifts[pid]['2026-09-02'] = 'M';
  state.shifts[pid]['2026-09-03'] = 'N';
  await page.reload();
  await waitSaved(page);
  await expect.poll(() => readLocal(page, 'my_shift_data')).toEqual({ '2026-09-01': 'D', '2026-09-02': 'M', '2026-09-03': 'N' });

  // 오프라인에서 9/3 삭제 → 온라인으로 다시 열어도 삭제 유지
  state.offline = true;
  await page.reload();
  await expect(page.getByText('오프라인 · 기기 저장')).toBeVisible();
  await day(page, '9월 3일').click();
  await page.getByRole('button', { name: '근무 삭제 (빈 칸으로 설정)' }).click();
  state.offline = false;
  await page.reload();
  await waitSaved(page);
  await expect.poll(() => state.shifts[pid]).toEqual({ '2026-09-01': 'D', '2026-09-02': 'M' });
});

test('잠깐 끊겼다가 다시 연결되면 새로고침 없이 바로 서버에 저장', async ({ page, context }) => {
  const state = await openApp(page);
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];

  // 앱을 연 직후(30초 이내) 연결이 끊김 → 근무 입력
  state.offline = true;
  await context.setOffline(true);
  await day(page, '9월 10일').click();
  await page.getByRole('button', { name: /Day \(데이\)/ }).click();
  await expect(page.getByText('오프라인 · 기기 저장')).toBeVisible();

  // 다시 연결 → 바로 저장
  state.offline = false;
  await context.setOffline(false);
  await expect(page.getByText('서버에 저장됨')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => state.shifts[pid]?.['2026-09-10']).toBe('D');
});

test('모든 팝업이 하단 탭바 위에 표시', async ({ page }) => {
  await openApp(page);
  const navCovers = () =>
    page.evaluate(() => {
      const nav = [...document.querySelectorAll('div')].find((d) => d.className.includes('absolute bottom-0'));
      const r = nav.getBoundingClientRect();
      return nav.contains(document.elementFromPoint(r.left + r.width / 2, r.top + 10));
    });
  for (const open of [
    () => page.getByRole('button', { name: /종류/ }).click(),
    () => page.getByRole('button', { name: '패턴', exact: true }).click(),
    () => day(page, '9월 5일').click(),
    () => page.getByRole('button', { name: /^알림$/ }).click()
  ]) {
    await open();
    await expect.poll(navCovers).toBe(false);
    await page.reload();
  }
});

test('폰(터치 화면): 날짜를 눌러도 메모칸에 자동 포커스하지 않음 (키보드가 근무 버튼을 가리지 않게)', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 720 } });
  const page = await context.newPage();
  await openApp(page);
  await page.getByRole('button', { name: /^9월 10일 (?!\()/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('근무 직접 수정')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toMatch(/INPUT|TEXTAREA/);
  await context.close();
});

test('달력 날짜는 버튼(스크린리더로 날짜·근무를 읽음)', async ({ page }) => {
  await openApp(page, { local: { my_shift_data: { '2026-09-24': 'D' } } });
  await expect(page.getByRole('button', { name: '9월 24일 D 근무 추석' })).toBeVisible();
  await page.getByRole('button', { name: '9월 24일 D 근무 추석' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('근무 직접 수정')).toBeVisible();
});

test('다크 모드 전환', async ({ page }) => {
  await openApp(page);
  const theme = page.getByRole('button', { name: /화면 테마/ });
  await theme.click(); // 기기 설정 → 다크
  await expect(page.locator('html')).toHaveClass(/dark/);
  const cardBg = await page.locator('.bg-white').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(cardBg).toBe('rgb(15, 23, 42)');
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/); // 설정 유지
  await theme.click(); // 다크 → 라이트
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('수당 탭: 휴일·야간 가산, 입사일 기준 연차, 통계', async ({ page }) => {
  await openApp(page, {
    local: {
      my_shift_data: { '2026-10-03': 'D', '2026-10-09': 'N', '2026-10-11': 'E', '2026-10-12': 'N', '2026-10-13': 'N', '2026-10-14': '연차' },
      shift_configs: {
        hourlyWage: 10000,
        startDay: 1,
        shiftTimes: { D: { time: '07:00 - 15:00' }, N: { time: '22:00 - 07:00', nightHours: 8 }, E: { time: '14:00 - 22:00' } },
        vacation: { total: 15, used: 2 }
      }
    }
  });
  await page.getByRole('button', { name: '다음 달' }).first().click();
  await tab(page, '연차/수당').click();
  await expect(page.getByText(/휴일 근무:/).locator('..')).toContainText('2 회 (16시간)');
  await expect(page.getByText('휴일 가산수당').locator('..')).toContainText('80,000 원');
  await expect(page.getByText('야간 가산수당').locator('..')).toContainText('120,000 원');
  await page.getByLabel('일요일도 휴일로').check();
  await expect(page.getByText(/휴일 근무:/).locator('..')).toContainText('3 회');

  await page.locator('select:has(option[value=hire])').selectOption('hire');
  await page.getByLabel('입사일').fill('2021-11-01');
  await expect(page.getByText('집계 기간: 2025.11.01 ~ 2026.10.31')).toBeVisible();

  await expect(page.getByText('최장 연속N').locator('..')).toContainText('2일');
});

test('처음 사용자 안내에서 반복 패턴을 열면 기본 3개월 → 오늘부터 3개월치가 한 번에 채워짐', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /반복 패턴으로/ }).click();
  const dialog = page.getByRole('dialog', { name: '반복 패턴 입력' });
  await expect(dialog.getByRole('combobox')).toHaveValue('3');
  await dialog.getByRole('button', { name: /일에 적용하기/ }).click();
  const saved = await readLocal(page, 'my_shift_data');
  expect(Object.keys(saved).length).toBeGreaterThanOrEqual(90);
  expect(saved['2026-12-27']).toBeTruthy();
});
