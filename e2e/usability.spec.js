import { test, expect } from '@playwright/test';
import { openApp, readLocal, confirmOk, tab, openTools } from './helpers.js';

test('월 리셋: 취소는 유지, 선택 월 근무만 삭제, 메모·다른 달 유지, 되돌리기', async ({ page }) => {
  const shifts = { '2026-08-31': 'N', '2026-09-01': 'D', '2026-09-28': 'E', '2026-10-01': 'N' };
  const notes = { '2026-09-28': '생일 약속' };
  await openApp(page, { local: { my_shift_data: shifts, day_notes: notes } });
  await openTools(page);
  await page.getByRole('button', { name: '9월 근무 리셋', exact: true }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  expect(await readLocal(page, 'my_shift_data')).toEqual(shifts);
  await openTools(page);
  await page.getByRole('button', { name: '9월 근무 리셋', exact: true }).click();
  await confirmOk(page);
  await expect.poll(() => readLocal(page, 'my_shift_data')).toEqual({ '2026-08-31': 'N', '2026-10-01': 'N' });
  expect(await readLocal(page, 'day_notes')).toEqual(notes);
  await page.getByRole('button', { name: '되돌리기', exact: true }).click();
  await expect.poll(() => readLocal(page, 'my_shift_data')).toEqual(shifts);
});

test('연속 입력: 안내를 보고 날짜를 누르면 즉시 저장, 종료 후에는 날짜 편집창', async ({ page }) => {
  await openApp(page);
  await openTools(page);
  await page.getByRole('button', { name: '연속 입력', exact: true }).click();
  const help = page.getByRole('region', { name: '연속 입력 안내' });
  await expect(help).toContainText('누르는 즉시 저장돼요.');
  await page.getByRole('button', { name: /^9월 10일 근무 없음/ }).click();
  await expect.poll(async () => (await readLocal(page, 'my_shift_data'))['2026-09-10']).toBe('D');
  await expect(page.getByRole('dialog', { name: '근무 직접 수정' })).toHaveCount(0);
  await help.getByRole('button', { name: '연속 입력 종료', exact: true }).click();
  await page.getByRole('button', { name: /^9월 10일 D 근무/ }).click();
  await expect(page.getByRole('dialog', { name: '근무 직접 수정' })).toBeVisible();
});

test('꾸미기: 파스텔 다섯 가지·검정 선택 후 새로고침에도 유지', async ({ page }) => {
  await openApp(page);
  await tab(page, '설정').click();
  await page.getByRole('button', { name: /꾸미기/ }).click();
  const colors = page.getByRole('radiogroup', { name: '앱 색', exact: true });
  await expect(colors.getByRole('radio')).toHaveCount(6);
  await expect(colors.getByRole('radio', { name: '연분홍', exact: true })).toBeVisible();
  await expect(colors.getByRole('radio', { name: '하늘색', exact: true })).toBeVisible();
  await colors.getByRole('radio', { name: '검정', exact: true }).click();
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('accent_pref'))).toBe('black');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-blue-600').trim())).toBe('39 39 42');
  // 검정 테마 + 다크 모드에서도 선택한 탭이 검은 바탕에 묻히지 않아야 함.
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  // 버튼 색에 0.12초 전환 효과가 있어 바로 읽으면 중간 색이 잡힘 → 색이 다 바뀔 때까지 다시 잼
  const contrast = () => tab(page, '내 근무').evaluate((el) => {
    const luminance = (color) => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map((v) => {
        const n = Number(v) / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const a = luminance(getComputedStyle(el).color);
    const b = luminance(getComputedStyle(document.body).backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  await expect.poll(contrast).toBeGreaterThanOrEqual(4.5);
});
