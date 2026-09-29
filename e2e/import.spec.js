import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, readLocal, tab, waitSaved } from './helpers.js';
import { createFakeState, seedAccount } from './fakeSupabase.js';

const fixture = (name) => path.join(import.meta.dirname, 'fixtures', name);

test('근무표 사진 → 확인 화면 없이 내 근무표에 바로 등록 + 되돌리기', async ({ page }) => {
  test.setTimeout(240000);
  await openApp(page, { name: '서지수', local: { my_shift_data: { '2026-09-01': 'M' } } });
  await tab(page, '등록').click();
  await page.locator('input[type=file][accept="image/*"]:not([capture])').setInputFiles(fixture('photo2.png'));

  // 표 앞쪽에 지난달 29~31일 칸이 있는 근무표 → 그 날짜도 함께 등록
  await expect(page.getByText('사진에서 8월 29일~9월 30일 근무 33일을 등록했어요')).toBeVisible({ timeout: 200000 });
  const saved = await readLocal(page, 'my_shift_data');
  // 합성 근무표 정답(서지수): 8/29 N, 8/30 N, 8/31 OFF, 9/1 OFF, 9/2 D ... 9/30 E
  expect(saved['2026-08-29']).toBe('N');
  expect(saved['2026-08-31']).toBe('OFF');
  expect(saved['2026-09-01']).toBe('OFF');
  expect(saved['2026-09-02']).toBe('D');
  expect(saved['2026-09-30']).toBe('E');
  await expect(page.getByRole('button', { name: /^9월 2일 D 근무/ })).toBeVisible();

  await page.getByRole('button', { name: '되돌리기' }).click();
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2026-09-01': 'M' });
});

test('근무표 사진: 내 이름이 없으면 이름만 고르면 등록', async ({ page }) => {
  test.setTimeout(240000);
  await openApp(page, { name: '홍길동' });
  await tab(page, '등록').click();
  await page.locator('input[type=file][accept="image/*"]:not([capture])').setInputFiles(fixture('photo2.png'));
  await expect(page.getByText('본인 이름 선택')).toBeVisible({ timeout: 200000 });
  await page.getByRole('button', { name: '오세훈', exact: true }).click();
  await expect(page.getByText(/근무표 이름: 오세훈/)).toBeVisible();

  // 고른 이름은 '근무표 속 내 이름'으로 저장 → 다음 사진은 묻지 않고 바로 등록
  await tab(page, '등록').click();
  await expect(page.getByLabel('근무표 속 내 이름')).toHaveValue('오세훈');
  await page.locator('input[type=file][accept="image/*"]:not([capture])').setInputFiles(fixture('photo2.png'));
  await expect(page.getByText(/근무표 이름: 오세훈/)).toBeVisible({ timeout: 200000 });
  await expect(page.getByText('본인 이름 선택')).toHaveCount(0);
});

test('닉네임 사용자: 근무표 속 내 이름 입력 → 사진 자동 등록, 새 폰 로그인 시에도 유지', async ({ page, browser }) => {
  test.setTimeout(240000);
  const state = createFakeState();
  const { profile } = seedAccount(state, { email: 'me@example.com', password: 'secret12', name: '뽀송이' });
  const login = async (p) => {
    await openApp(p, { state, name: null });
    await p.getByRole('button', { name: /이미 계정이 있어요/ }).click();
    await p.getByPlaceholder('이메일 주소').fill('me@example.com');
    await p.getByPlaceholder('비밀번호').fill('secret12');
    p.on('dialog', (d) => d.accept());
    await p.getByRole('button', { name: '로그인', exact: true }).click();
    await waitSaved(p);
  };

  await login(page);
  await tab(page, '등록').click();
  await page.getByLabel('근무표 속 내 이름').fill('서지수');
  await page.getByLabel('근무표 속 내 이름').press('Enter');
  await expect.poll(() => state.settings[profile.id]?.settings?.roster_name).toBe('서지수');

  // 새 폰: 로그인하면 근무표 속 이름이 돌아오고, 사진은 바로 내 줄로 등록
  const other = await browser.newPage();
  await login(other);
  await tab(other, '등록').click();
  await expect(other.getByLabel('근무표 속 내 이름')).toHaveValue('서지수');
  await other.locator('input[type=file][accept="image/*"]:not([capture])').setInputFiles(fixture('photo2.png'));
  await expect(other.getByText(/근무표 이름: 서지수/)).toBeVisible({ timeout: 200000 });
  expect((await readLocal(other, 'my_shift_data'))['2026-09-01']).toBe('OFF');
  await other.close();
});

test('엑셀 근무표 → 내 이름 자동 선택 후 바로 등록 (인터넷 CDN 없이)', async ({ page, context }) => {
  await context.route(/cdn\.jsdelivr\.net/, (r) => r.abort());
  await openApp(page, { name: '김간호' });
  await tab(page, '등록').click();
  await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(fixture('roster.xlsx'));
  await expect(page.getByText('엑셀에서 10월 근무 31일을 등록했어요')).toBeVisible();
  const saved = await readLocal(page, 'my_shift_data');
  // 김간호 행: D, 데이, E, /, N, O, 연차, OFF 반복
  expect([1, 2, 3, 4, 5, 6, 7, 8].map((d) => saved[`2026-10-0${d}`])).toEqual(['D', 'D', 'E', 'OFF', 'N', 'OFF', '연차', 'OFF']);
});

test('.ics 가져오기: 반복 일정·메모', async ({ page }) => {
  await openApp(page);
  await tab(page, '등록').click();
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT', 'UID:w', 'DTSTART;VALUE=DATE:20261005', 'DTEND;VALUE=DATE:20261006', 'SUMMARY:나이트', 'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=3', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:m', 'DTSTART:20261007T010000Z', 'DTEND:20261007T020000Z', 'SUMMARY:치과', 'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  await page.locator('input[accept=".ics,text/calendar"]').setInputFiles({ name: 'cal.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) });
  await expect(page.getByRole('heading', { name: '캘린더 가져오기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '가져오기', exact: true }).last().click();
  const shifts = await readLocal(page, 'my_shift_data');
  expect(shifts).toMatchObject({ '2026-10-05': 'N', '2026-10-12': 'N', '2026-10-19': 'N' });
  expect((await readLocal(page, 'day_notes'))['2026-10-07']).toBe('10:00 치과');
});

test('내보내기(CSV·.ics) + 전체 백업 저장 → 다른 기기에서 복원', async ({ page, browser }) => {
  await openApp(page, {
    local: {
      my_shift_data: { '2026-10-01': 'D', '2026-10-02': 'N' },
      day_notes: { '2026-10-02': '회식; 7시' },
      shift_configs: { hourlyWage: 12345 }
    }
  });
  await tab(page, '등록').click();

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '엑셀(CSV)' }).click()]);
  const csvText = fs.readFileSync(await csv.path(), 'utf8');
  expect(csvText).toContain('2026-10-02,금,N,Night (나이트),회식; 7시');

  const [ics] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '캘린더(.ics)' }).click()]);
  expect(fs.readFileSync(await ics.path(), 'utf8')).toContain('SUMMARY:회식\\; 7시');

  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /백업 저장/ }).click()]);
  const backupPath = await backup.path();

  // 새 기기: 빈 상태에서 복원
  const other = await browser.newPage();
  await openApp(other, { name: '새폰' });
  await tab(other, '등록').click();
  other.on('dialog', (d) => d.accept());
  await other.locator('input[accept=".json,application/json"]').setInputFiles(backupPath);
  await other.waitForLoadState('load');
  await expect(other.getByRole('heading', { name: '김간호 님의 근무표' })).toBeVisible();
  expect(await readLocal(other, 'my_shift_data')).toMatchObject({ '2026-10-01': 'D', '2026-10-02': 'N' });
  expect((await readLocal(other, 'shift_configs')).hourlyWage).toBe(12345);
  await other.close();
});

test('근무표 이미지 공유(웹: 파일 저장)', async ({ page }) => {
  await openApp(page, { local: { my_shift_data: { '2026-09-01': 'D' } } });
  const [img] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '근무표 이미지 공유' }).click()]);
  expect(img.suggestedFilename()).toBe('shift-2026-09.png');
  expect(fs.statSync(await img.path()).size).toBeGreaterThan(20000);
});

test('새 배포 후 오래 열린 탭: 사진 인식 파일을 못 찾으면 새로고침 → 등록 탭으로 돌아와 다시 시도 안내', async ({ page }) => {
  let failed = false;
  // 배포 전 화면이 이미 지워진 빌드 파일을 부르는 상황 재현 (첫 요청만 404)
  await page.route(/\/assets\/rosterOcr-.*\.js$/, (route) => {
    if (failed) return route.continue();
    failed = true;
    return route.fulfill({ status: 404, body: 'not found' });
  });
  await openApp(page);
  await tab(page, '등록').click();
  await page.locator('input[type=file][accept="image/*"]:not([capture])').setInputFiles(fixture('photo2.png'));
  await expect(page.getByText(/앱이 최신 버전으로 업데이트됐어요/)).toBeVisible({ timeout: 30000 });
  expect(failed).toBe(true);
  // 새로고침 후에도 등록 탭 (사진 올리는 버튼이 보임)
  await expect(page.getByLabel('근무표 속 내 이름')).toBeVisible();
});
