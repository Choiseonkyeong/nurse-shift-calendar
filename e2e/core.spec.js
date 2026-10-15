import { test, expect } from '@playwright/test';
import { createFakeState } from './fakeSupabase.js';
import { openApp, readLocal, tab, waitSaved } from './helpers.js';

const day = (page, label) => page.getByRole('button', { name: new RegExp(`^${label} (?!\\()`) }); // 아래 일정 목록 버튼 "9월 5일 (토) 일정·메모" 제외

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
  await page.getByRole('button', { name: '근무 비우기' }).click();
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
    () => page.getByRole('button', { name: '반복 패턴', exact: true }).click(),
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
  await tab(page, '설정').click(); // 테마는 설정 탭에
  const theme = page.getByRole('button', { name: /화면 테마/ });
  await theme.click(); // 기기 설정 → 다크
  await expect(page.locator('html')).toHaveClass(/dark/);
  // 바탕 (버튼은 색이 부드럽게 바뀌므로 전환이 끝날 때까지 기다림)
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(15, 23, 42)');
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/); // 설정 유지
  await tab(page, '설정').click();
  await theme.click(); // 다크 → 라이트
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('수당 탭: 근무 1회 수당 × 횟수 (나이트·이브닝), 입사일 기준 연차, 통계', async ({ page }) => {
  await openApp(page, {
    local: {
      my_shift_data: { '2026-10-03': 'D', '2026-10-09': 'N', '2026-10-11': 'E', '2026-10-12': 'N', '2026-10-13': 'N', '2026-10-14': '연차' },
      shift_configs: {
        startDay: 1,
        shiftTimes: { D: { time: '07:00 - 15:00' }, N: { time: '22:00 - 07:00' }, E: { time: '14:00 - 22:00' } },
        vacation: { total: 15, used: 2 }
      }
    }
  });
  await page.getByRole('button', { name: '다음 달' }).first().click();
  await tab(page, '수당').click();
  // 수당을 아직 안 넣었으면 넣으라는 안내
  await page.getByRole('button', { name: /1회 수당을 넣으면/ }).click();
  const calc = page.getByRole('dialog', { name: '계산 설정' });
  await calc.getByLabel('N 1회 수당').fill('130000');
  await expect(calc.getByLabel('N 1회 수당')).toHaveValue('130,000'); // 쉼표 자동
  await calc.getByLabel('E 1회 수당').fill('10,000');
  await calc.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByText('나이트 수당').locator('..')).toContainText('390,000 원');
  await expect(page.getByText('나이트 수당').locator('..')).toContainText('N 3회 × 130,000원');
  await expect(page.getByText('이브닝 수당').locator('..')).toContainText('10,000 원');
  await expect(page.getByText('400,000원', { exact: true })).toBeVisible(); // 합계
  await expect(page.getByRole('button', { name: /계산 설정/ })).toContainText('E 10,000 · N 130,000') // 근무 종류 순서;
  await expect.poll(async () => (await readLocal(page, 'shift_configs')).allowance).toEqual({ N: 130000, E: 10000 });

  // 0 으로 지우면 계산에서 빠짐
  await page.getByRole('button', { name: /계산 설정/ }).click();
  await calc.getByLabel('E 1회 수당').fill('');
  await calc.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByText('이브닝 수당')).toHaveCount(0);
  await expect(page.getByText('390,000원', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '연차 설정' }).click();
  const leave = page.getByRole('dialog', { name: '연차 설정' });
  await leave.getByRole('button', { name: '총 부여 연차 늘리기' }).click();
  await leave.getByRole('button', { name: '입사일 기준' }).click();
  await leave.getByLabel('입사일').fill('2021-11-01');
  await expect(leave.getByText('2025.11.01 ~ 2026.10.31')).toBeVisible();
  await leave.getByRole('button', { name: '닫기' }).click();
  await expect(page.getByText('16일 중')).toBeVisible();

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

test('앱을 켜 둔 채 날짜가 바뀌면 다시 볼 때 오늘(다음 달)로, 다른 날짜를 보고 있었으면 그대로', async ({ page }) => {
  await openApp(page);
  await page.clock.setFixedTime(new Date('2026-09-30T23:50:00+09:00'));
  await page.reload();
  await expect(page.getByText('9월 30일 (수) 일정·메모')).toBeVisible();
  // 밤 근무 후 아침에 다시 열기
  await page.clock.setFixedTime(new Date('2026-10-01T07:30:00+09:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('2026년 10월')).toBeVisible();
  await expect(page.getByText('10월 1일 (목) 일정·메모')).toBeVisible();

  // 다른 날짜(10/15)를 보고 있었으면 날짜가 바뀌어도 그대로
  await page.getByRole('button', { name: /^10월 15일 (?!\()/ }).click();
  await page.keyboard.press('Escape');
  await page.clock.setFixedTime(new Date('2026-10-02T07:30:00+09:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(300);
  await expect(page.getByText('10월 15일 (목) 일정·메모')).toBeVisible();
});

test('반복 패턴으로 기존 근무를 덮어써도 알림의 되돌리기로 적용 전 그대로 (빈칸이던 날은 다시 빈칸)', async ({ page }) => {
  // 사진·엑셀로 등록해 둔 근무가 있는 상태
  const before = { '2026-09-10': 'E', '2026-09-28': 'N', '2026-09-30': '연차' };
  await openApp(page, { local: { my_shift_data: before } });
  await page.getByRole('button', { name: '반복 패턴', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '반복 패턴 입력' });
  await expect(dialog.getByText(/일 겹침/)).toBeVisible(); // 덮어쓰기 기본 체크
  await dialog.getByRole('button', { name: /일에 적용하기/ }).click();
  await expect(page.getByText(/일에 반복 패턴을 입력했어요/)).toBeVisible();
  const applied = await readLocal(page, 'my_shift_data');
  expect(applied).not.toEqual(before);
  expect(applied['2026-09-10']).toBe('E'); // 적용 범위 밖은 그대로

  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByText('반복 패턴 입력을 되돌렸어요.')).toBeVisible();
  expect(await readLocal(page, 'my_shift_data')).toEqual(before);
});

test('위쪽 제목: 내 근무는 이름, 다른 화면은 화면 이름', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('heading', { level: 1, name: '김간호 님의 근무표' })).toBeVisible();
  for (const [t, title] of [['수당', '연차 · 수당'], ['그룹', '그룹'], ['설정', '설정']]) {
    await tab(page, t).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }
  // 글꼴: 프리텐다드 (설정 › 꾸미기에서 바꿀 수 있음)
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"Pretendard Variable"/);
});

test('다크 모드에서도 달력 근무 글자가 잘 보임 (밝은 색으로 바뀜)', async ({ page }) => {
  await openApp(page, { local: { my_shift_data: { '2026-09-10': 'D' } } });
  const code = page.getByRole('button', { name: /^9월 10일 D 근무/ }).locator('.shift-text');
  const light = await code.evaluate((el) => getComputedStyle(el).color);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  const dark = await code.evaluate((el) => getComputedStyle(el).color);
  expect(dark).not.toBe(light);
  // 어두운 바탕(slate-900) 위에서 밝기 차이가 충분한지: 글자 밝기 > 0.5
  const lum = (rgb) => {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  expect(lum(dark)).toBeGreaterThan(0.5);
  expect(lum(light)).toBeLessThan(0.5);
});

test('년·월 바로 고르기: 제목을 눌러 다른 해·달로 한 번에 이동, 이번 달로 돌아오기', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: '년·월 선택' }).click();
  const picker = page.getByRole('dialog', { name: '년·월 선택' });
  await expect(picker.getByRole('button', { name: '2026년 9월' })).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: '이전 해' }).click();
  await picker.getByRole('button', { name: '2025년 3월' }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByRole('heading', { name: '2025년 3월' })).toBeVisible();
  await page.getByRole('button', { name: '년·월 선택' }).click();
  await page.getByRole('button', { name: '이번 달로' }).click();
  await expect(page.getByRole('heading', { name: '2026년 9월' })).toBeVisible();
  // 이번 달로 오면 오늘 날짜가 선택됨
  await expect(page.getByRole('button', { name: /^9월 28일 근무/ })).toHaveAttribute('aria-pressed', 'true');
});

test('수당 화면에서도 달 바꾸기: ‹ › 와 년·월 선택', async ({ page }) => {
  await openApp(page);
  await tab(page, '수당').click();
  await expect(page.getByText(/^9월 근무 수당/)).toBeVisible();
  await page.getByRole('button', { name: '다음 달' }).click();
  await expect(page.getByText(/^10월 근무 수당/)).toBeVisible();
  await page.getByRole('button', { name: '년·월 선택' }).click();
  const picker = page.getByRole('dialog', { name: '년·월 선택' });
  await picker.getByRole('button', { name: '이전 해' }).click();
  await picker.getByRole('button', { name: '2025년 12월' }).click();
  await expect(page.getByText(/^2025년 12월 근무 수당/)).toBeVisible();
  // 내 근무 화면도 같은 달로
  await tab(page, '내 근무').click();
  await expect(page.getByRole('heading', { name: '2025년 12월' })).toBeVisible();
});

test('일정·메모: 한 날짜에 여러 개 넣으면 달력 칸에 모두 보이고, 손잡이를 끌어 순서를 바꿈', async ({ page }) => {
  await openApp(page, { local: { day_notes: { '2026-09-10': '교육\n회식\n은행\n택배' } } });
  const cell = page.getByRole('button', { name: /^9월 10일 (?!\()/ });
  await expect(cell).toHaveAttribute('aria-label', /일정 4개: 교육, 회식, 은행, 택배/);

  await cell.click();
  const dialog = page.getByRole('dialog', { name: '근무 직접 수정' });
  await dialog.getByRole('textbox', { name: '일정·메모 추가' }).fill('운동');
  await dialog.getByRole('textbox', { name: '일정·메모 추가' }).press('Enter');
  await expect(dialog.getByRole('textbox', { name: '5번째 일정' })).toHaveValue('운동');

  // 4번째(택배)를 맨 위로 끌기
  const grips = dialog.getByRole('button', { name: /순서 바꾸기/ });
  // 입력칸을 누르면 창이 잠시 뒤 스크롤되므로, 위치가 멈춘 뒤에 잼 (느린 CI 에서 엉뚱한 곳을 끌던 것)
  let last = null;
  await expect
    .poll(async () => {
      const y = (await grips.nth(3).boundingBox())?.y;
      const still = y === last;
      last = y;
      return still;
    }, { intervals: [250] })
    .toBe(true);
  const from = await grips.nth(3).boundingBox();
  const to = await grips.nth(0).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 8 });
  await page.mouse.up();
  // 키보드로도: 2번째(교육)를 아래로 한 칸
  await grips.nth(1).focus();
  await page.keyboard.press('ArrowDown');
  // 지우기
  await dialog.getByRole('button', { name: '은행 지우기' }).click();
  await page.keyboard.press('Escape');

  await expect.poll(async () => (await readLocal(page, 'day_notes'))['2026-09-10']).toBe('택배\n회식\n교육\n운동');
  await expect(cell).toHaveAttribute('aria-label', /일정 4개: 택배, 회식, 교육, 운동/);
});

test('설정 › 꾸미기: 앱 색(기본 블루)·글꼴·글자 크기를 바꾸면 바로 바뀌고 다시 열어도 유지', async ({ page }) => {
  await openApp(page);
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-blue-600').trim());
  expect(await accent()).toBe('37 99 235'); // 기본: 블루(#2563eb)
  await tab(page, '설정').click();
  await page.getByRole('button', { name: /꾸미기/ }).click();
  const sheet = page.getByRole('dialog', { name: '꾸미기' });
  await sheet.getByRole('radio', { name: '라벤더' }).click();
  await expect.poll(accent).toBe('124 58 237'); // violet-600
  await sheet.getByRole('radio', { name: /고운바탕/ }).click();
  await sheet.getByRole('radio', { name: '크게', exact: true }).click();
  const bodyFont = () => page.evaluate(() => getComputedStyle(document.body).fontFamily);
  const bodySize = () => page.evaluate(() => getComputedStyle(document.body).fontSize);
  await expect.poll(bodyFont).toMatch(/^"Gowun Batang"/);
  await expect.poll(bodySize).toBe('17.28px'); // 16px × 1.08
  await page.reload();
  await expect.poll(bodyFont).toMatch(/^"Gowun Batang"/);
  await expect.poll(bodySize).toBe('17.28px');
  expect(await accent()).toBe('124 58 237');
});

test('일정 색 고르기, 보안 모드에서는 달력 칸·목록의 일정을 가림', async ({ page }) => {
  await openApp(page, { local: { day_notes: { '2026-09-28': '교육\n회식' } } });
  await page.getByRole('button', { name: /^9월 28일 \(/ }).click();
  const dialog = page.getByRole('dialog', { name: '근무 직접 수정' });
  await dialog.getByRole('button', { name: '교육 색 고르기' }).click();
  await dialog.getByRole('radio', { name: '빨강' }).click();
  await expect(dialog.getByRole('textbox', { name: '1번째 일정' })).toHaveValue('교육'); // 색 표시는 글자에 안 보임
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await readLocal(page, 'day_notes'))['2026-09-28']).toBe('{{r}}교육\n회식');
  const cell = page.getByRole('button', { name: /^9월 28일 (?!\()/ });
  await expect(cell).toHaveAttribute('aria-label', /일정 2개: 교육, 회식/);

  await tab(page, '설정').click();
  await page.getByRole('button', { name: /보안 모드/ }).click();
  await tab(page, '내 근무').click();
  await expect(cell).toHaveAttribute('aria-label', /일정 2개$/); // 내용은 읽어 주지 않음
  await expect(page.locator('ul.blur-\\[5px\\]')).toContainText('교육');
});
