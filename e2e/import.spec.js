import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openApp, readLocal, tab, waitSaved, confirmOk } from './helpers.js';
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

  // 고른 이름은 기억 → 다음 사진은 묻지 않고 바로 등록 (가져오기 화면엔 이름 설정 줄 없음)
  await tab(page, '등록').click();
  await expect(page.getByText('근무표에서 찾을 내 이름')).toHaveCount(0);
  await page.locator('input[type=file][accept="image/*"]:not([capture])').setInputFiles(fixture('photo2.png'));
  await expect(page.getByText(/근무표 이름: 오세훈/)).toBeVisible({ timeout: 200000 });
  await expect(page.getByText('본인 이름 선택')).toHaveCount(0);
});

test('닉네임 사용자: 이름을 따로 입력하지 않아도 한 번 고르면 기억, 새 폰 로그인 시에도 유지', async ({ page, browser }) => {
  test.setTimeout(240000);
  const state = createFakeState();
  const { profile } = seedAccount(state, { email: 'me@example.com', password: 'secret12', name: '뽀송이' });
  const login = async (p) => {
    await openApp(p, { state, name: null });
    await p.getByRole('button', { name: /이미 계정이 있어요/ }).click();
    await p.getByPlaceholder('이메일 주소').fill('me@example.com');
    await p.getByPlaceholder('비밀번호').fill('secret12');
    await p.getByRole('button', { name: '로그인', exact: true }).click();
    await waitSaved(p);
  };

  await login(page);
  await tab(page, '등록').click();
  // 이름 입력칸·설정 줄 없이 시작
  await expect(page.getByLabel('근무표 속 내 이름')).toHaveCount(0);
  await page.locator('input[type=file][accept="image/*"]:not([capture])').setInputFiles(fixture('photo2.png'));
  await expect(page.getByText('본인 이름 선택')).toBeVisible({ timeout: 200000 });
  await page.getByRole('button', { name: '서지수', exact: true }).click();
  await expect.poll(() => state.settings[profile.id]?.settings?.roster_name).toBe('서지수');

  // 새 폰: 로그인하면 근무표 속 이름이 돌아오고, 사진은 바로 내 줄로 등록
  const other = await browser.newPage();
  await login(other);
  await tab(other, '등록').click();
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

test('다른 사람 줄로 들어갔으면 "내 이름이 아니에요" → 되돌리고 같은 근무표에서 다시 고르기, 고른 이름은 기억', async ({ page }) => {
  await openApp(page, { name: '김간호', local: { my_shift_data: { '2026-10-02': 'M', '2026-09-30': 'D' } } });
  const upload = async () => {
    await tab(page, '등록').click();
    await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(fixture('roster.xlsx'));
  };
  await upload();
  await expect(page.getByText(/근무표 이름: 김간호/)).toBeVisible();

  await page.getByRole('button', { name: '내 이름이 아니에요' }).click();
  const picker = page.getByRole('dialog', { name: '본인 이름 선택' });
  await expect(picker).toBeVisible(); // 파일을 다시 고르지 않아도 이름 목록이 바로
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2026-10-02': 'M', '2026-09-30': 'D' }); // 잘못 들어간 근무는 되돌림
  await picker.getByRole('button', { name: /^이간호/ }).click();
  await expect(page.getByText(/근무표 이름: 이간호/)).toBeVisible();
  let saved = await readLocal(page, 'my_shift_data');
  expect([1, 2, 3, 4].map((d) => saved[`2026-10-0${d}`])).toEqual(['N', 'N', 'OFF', 'E']);
  expect(saved['2026-09-30']).toBe('D');

  // 다음 가져오기부터는 앱 이름(김간호)보다 고른 이름을 먼저
  await upload();
  await expect(page.getByText(/근무표 이름: 이간호/)).toBeVisible();
  await expect(picker).toHaveCount(0);
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
  await other.locator('input[accept=".json,application/json"]').setInputFiles(backupPath);
  await expect(other.getByRole('dialog', { name: '백업을 복원할까요?' })).toContainText('근무 2일 · 메모 1건');
  await confirmOk(other);
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
  await expect(page.getByText('앨범에서 선택')).toBeVisible();
});

test('한국어 엑셀에서 저장한 CSV(EUC-KR) → 한글 이름이 깨지지 않고 등록', async ({ page }) => {
  await openApp(page, { name: '김간호' });
  await tab(page, '등록').click();
  await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(fixture('roster-euckr.csv'));
  await expect(page.getByText('엑셀에서 11월 근무 30일을 등록했어요')).toBeVisible();
  const saved = await readLocal(page, 'my_shift_data');
  expect([1, 2, 3, 4, 6].map((d) => saved[`2026-11-0${d}`])).toEqual(['D', 'E', 'N', 'OFF', '연차']);
});

test('엑셀 날짜 행이 날짜 서식(2026-12-01)이어도 인식, 제목에 연월이 없어도 12월로', async ({ page }) => {
  await openApp(page, { name: '김간호' });
  await tab(page, '등록').click();
  await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(fixture('roster-dates.xlsx'));
  await expect(page.getByText('엑셀에서 12월 근무 31일을 등록했어요')).toBeVisible();
  const saved = await readLocal(page, 'my_shift_data');
  expect([1, 2, 3, 4, 5].map((d) => saved[`2026-12-0${d}`])).toEqual(['N', 'N', 'OFF', 'D', 'E']);
  expect(saved['2026-12-31']).toBe('N');
});

test('계정에 예전 설정이 있어도 백업 복원한 시급·연차가 유지되고 서버에도 반영', async ({ page, browser }) => {
  // 백업 파일 만들기 (시급 12345)
  const src = await browser.newPage();
  await openApp(src, { local: { shift_configs: { hourlyWage: 12345, vacation: { total: 20, used: 1 } } } });
  await tab(src, '등록').click();
  const [backup] = await Promise.all([src.waitForEvent('download'), src.getByRole('button', { name: /백업 저장/ }).click()]);
  const backupPath = path.join(os.tmpdir(), `backup-${Date.now()}.json`);
  await backup.saveAs(backupPath);
  await src.close();

  // 이 기기 계정의 서버에는 예전 설정(시급 9000)이 있음
  const state = createFakeState();
  await openApp(page, { state, name: '최간호' });
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];
  // 이 기기가 설정을 저장한 뒤(09:00) 다른 폰에서 바꾼 서버 설정(10:00) → 11:00 에 이 기기에서 백업 복원
  state.settings[pid] = { settings: { shift_configs: { hourlyWage: 9000 } }, updated_at: '2026-09-28T01:00:00.000Z' };
  await page.clock.setFixedTime(new Date('2026-09-28T11:00:00+09:00'));

  await tab(page, '등록').click();
  await page.locator('input[accept=".json,application/json"]').setInputFiles(backupPath);
  await confirmOk(page);
  await page.waitForLoadState('load');
  await waitSaved(page);
  await expect.poll(() => state.settings[pid]?.settings?.shift_configs?.hourlyWage).toBe(12345);
  expect((await readLocal(page, 'shift_configs')).hourlyWage).toBe(12345);
});

test('백업 복원은 서버 근무·메모도 백업 내용으로 완전히 교체 (백업에 없는 날짜는 삭제)', async ({ page, browser }) => {
  const src = await browser.newPage();
  await openApp(src, { local: { my_shift_data: { '2026-10-01': 'D', '2026-10-02': 'N' }, day_notes: { '2026-10-02': '회식' } } });
  await tab(src, '등록').click();
  const [backup] = await Promise.all([src.waitForEvent('download'), src.getByRole('button', { name: /백업 저장/ }).click()]);
  const backupPath = path.join(os.tmpdir(), `backup-replace-${Date.now()}.json`);
  await backup.saveAs(backupPath);
  await src.close();

  // 이 기기 계정에는 백업에 없는 근무·메모가 있음
  const state = createFakeState();
  await openApp(page, { state, local: { my_shift_data: { '2026-09-20': 'E', '2026-10-01': 'N' }, day_notes: { '2026-09-20': '교육' } } });
  await waitSaved(page);
  const pid = Object.keys(state.profiles)[0];
  await expect.poll(() => state.shifts[pid]?.['2026-09-20']).toBe('E');

  await tab(page, '등록').click();
  await page.locator('input[accept=".json,application/json"]').setInputFiles(backupPath);
  await confirmOk(page);
  await page.waitForLoadState('load');
  await waitSaved(page);
  await expect.poll(() => state.shifts[pid]).toEqual({ '2026-10-01': 'D', '2026-10-02': 'N' });
  expect(state.notes[pid]).toEqual({ '2026-10-02': '회식' });
  expect(await readLocal(page, 'my_shift_data')).toEqual({ '2026-10-01': 'D', '2026-10-02': 'N' });
  // 교체는 한 번만: 이후 다른 기기 변경은 평소처럼 반영
  expect(await page.evaluate(() => localStorage.getItem('restore_replace_pending'))).toBeNull();
});

test('엑셀 근무표의 영문 이름(Kim Minji)도 인식, 대소문자 달라도 내 줄 자동 선택', async ({ page }) => {
  await openApp(page, { name: 'kim minji' });
  await tab(page, '등록').click();
  await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(fixture('roster-english.xlsx'));
  await expect(page.getByText('엑셀에서 11월 근무 30일을 등록했어요')).toBeVisible();
  await expect(page.getByText(/근무표 이름: Kim Minji/)).toBeVisible();
  const saved = await readLocal(page, 'my_shift_data');
  expect([1, 2, 3, 4].map((d) => saved[`2026-11-0${d}`])).toEqual(['D', 'E', 'N', 'OFF']);
});

test('새 배포 후 오래 열린 탭: 엑셀 읽기 파일(워커)을 못 찾으면 새로고침 → 다시 시도 안내', async ({ page, context }) => {
  let failed = false;
  await context.route(/\/assets\/xlsxWorker-.*\.js$/, (route) => {
    if (failed) return route.continue();
    failed = true;
    return route.fulfill({ status: 404, body: 'not found' });
  });
  await openApp(page, { name: '김간호' });
  await tab(page, '등록').click();
  await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(fixture('roster.xlsx'));
  await expect(page.getByText(/앱이 최신 버전으로 업데이트됐어요/)).toBeVisible({ timeout: 30000 });
  expect(failed).toBe(true);
  // 새로고침 후 다시 올리면 정상 등록
  await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(fixture('roster.xlsx'));
  await expect(page.getByText('엑셀에서 10월 근무 31일을 등록했어요')).toBeVisible();
});

test('엑셀 제목에 연도가 없고 5월을 보고 있어도 → 요일·공휴일 칸으로 10월(9/26~10/25), 달이 틀리면 결과 알림에서 옮기기', async ({ page }) => {
  const XLSX = await import('xlsx');
  // 2026년 10월 근무표 (9/26 ~ 10/25), 제목은 '분당 5병동 근무표'(연월 없음), 날짜 아래 요일, 3일 개천절
  const days = [26, 27, 28, 29, 30, ...Array.from({ length: 25 }, (_, i) => i + 1)];
  const dates = days.map((d, i) => new Date(2026, i < 5 ? 8 : 9, d));
  const codes = ['D', 'E', 'N', 'OFF'];
  const rows = [
    ['분당 5병동 근무표'],
    ['직급', '이름', ...days.map((d) => (d === 3 ? '3\n개천절' : String(d)))],
    ['', '', ...dates.map((d) => '일월화수목금토'[d.getDay()])],
    ['RN', '김간호', ...days.map((_, i) => codes[i % 4])]
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'S');
  const file = path.join(os.tmpdir(), `roster-noyear-${Date.now()}.xlsx`);
  XLSX.writeFile(wb, file);

  await openApp(page, { name: '김간호', local: { my_shift_data: { '2026-09-01': 'M' } } });
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: '이전 달' }).click(); // 5월 보기
  await expect(page.getByText('2026년 5월')).toBeVisible();
  await tab(page, '등록').click();
  await page.locator('input[accept=".xlsx, .xls, .csv"]').setInputFiles(file);
  await expect(page.getByText('엑셀에서 9월 26일~10월 25일 근무 30일을 등록했어요')).toBeVisible();
  let saved = await readLocal(page, 'my_shift_data');
  expect(saved['2026-09-26']).toBe('D');
  expect(saved['2026-10-25']).toBe('E');
  expect(Object.keys(saved).some((k) => k.startsWith('2026-05'))).toBe(false);

  // 결과 알림에서 한 달 옮기기 → 다시 원래대로
  await page.getByRole('button', { name: '이전 달로' }).click();
  await expect(page.getByText('엑셀에서 8월 26일~9월 25일 근무 30일을 등록했어요')).toBeVisible();
  saved = await readLocal(page, 'my_shift_data');
  expect(saved['2026-08-26']).toBe('D');
  expect(saved['2026-10-25']).toBeUndefined();
  expect(saved['2026-09-01']).toBe('E'); // 옮긴 근무 (원래 9/1 의 M 자리)
  await page.getByRole('button', { name: '다음 달로' }).click();
  await expect(page.getByText('엑셀에서 9월 26일~10월 25일 근무 30일을 등록했어요')).toBeVisible();
  saved = await readLocal(page, 'my_shift_data');
  expect(saved['2026-09-01']).toBe('M'); // 원래 근무 복원
  expect(saved['2026-08-26']).toBeUndefined();

  // 근무·메모 전체 삭제 → 지난 가져오기 결과 알림도 닫힘
  await tab(page, '등록').click();
  await page.getByRole('button', { name: '근무·메모 전체 삭제' }).click();
  await confirmOk(page);
  await tab(page, '내 근무').click();
  await expect(page.getByText(/근무 30일을 등록했어요/)).toHaveCount(0);
});
