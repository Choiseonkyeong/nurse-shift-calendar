import { test, expect } from '@playwright/test';
import { openApp, waitSaved } from './helpers.js';

test.use({ hasTouch: true });

// 손가락으로 (x0,y0) → (x1,y1) 끌기
async function drag(page, [x0, y0], [x1, y1], steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', x0, y0);
  for (let i = 1; i <= steps; i++) await touch('touchMove', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
  await touch('touchEnd', x1, y1);
}

test('달력을 좌우로 밀면 다음·이전 달', async ({ page }) => {
  await openApp(page);
  await waitSaved(page); // 서버 연결 후 안내 배너 등으로 달력 위치가 바뀌기 전에 좌표를 재지 않게
  await expect(page.getByRole('heading', { name: '2026년 9월' })).toBeVisible();
  const day = page.getByRole('button', { name: /^9월 9일/ });
  await day.evaluate((el) => el.scrollIntoView({ block: 'center' })); // 하단 탭바에 가리지 않게
  const box = await day.boundingBox();
  const y = box.y + box.height / 2;
  await drag(page, [300, y], [80, y + 10]);
  await expect(page.getByRole('heading', { name: '2026년 10월' })).toBeVisible();
  await drag(page, [80, y], [300, y]);
  await expect(page.getByRole('heading', { name: '2026년 9월' })).toBeVisible();
  // 세로로 민 것은 달이 넘어가지 않음 (스크롤)
  await drag(page, [200, y], [150, y - 120]);
  await expect(page.getByRole('heading', { name: '2026년 9월' })).toBeVisible();
});

test('아래 창 손잡이를 끌어내리면 닫히고, 조금만 끌면 제자리로', async ({ page }) => {
  await openApp(page);
  await waitSaved(page);
  await page.getByRole('button', { name: /^9월 16일/ }).click();
  const sheet = page.getByRole('dialog', { name: '근무 직접 수정' });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400); // 올라오는 애니메이션
  const box = await sheet.locator('> div').boundingBox();
  await drag(page, [180, box.y + 12], [180, box.y + 40], 4);
  await page.waitForTimeout(300);
  await expect(sheet).toBeVisible();
  await drag(page, [180, box.y + 12], [180, box.y + 260]);
  await expect(sheet).toBeHidden();
  // 근무는 바뀌지 않음
  await expect(page.getByRole('button', { name: /^9월 16일 근무 없음/ })).toBeVisible();
});

test('아이폰: 입력칸 자동 확대 방지 (maximum-scale), 안드로이드는 그대로', async ({ browser }) => {
  const meta = async (userAgent) => {
    const ctx = await browser.newContext({ userAgent, hasTouch: true });
    const page = await ctx.newPage();
    await openApp(page);
    const content = await page.locator('meta[name=viewport]').getAttribute('content');
    await ctx.close();
    return content;
  };
  expect(await meta('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')).toContain('maximum-scale=1');
  expect(await meta('Mozilla/5.0 (Linux; Android 15; SM-S921N) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36')).not.toContain('maximum-scale');
});

test('키보드가 올라오면(--kb) 아래 창이 그만큼 위로 올라가 입력칸이 가려지지 않음', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /^9월 16일/ }).click();
  const panel = page.getByRole('dialog', { name: '근무 직접 수정' }).locator('> div');
  await page.waitForTimeout(400);
  const vh = page.viewportSize().height;
  expect(Math.round((await panel.boundingBox()).y + (await panel.boundingBox()).height)).toBe(vh);
  await page.evaluate(() => document.documentElement.style.setProperty('--kb', '300px'));
  await expect.poll(async () => Math.round((await panel.boundingBox()).y + (await panel.boundingBox()).height)).toBe(vh - 300);
  const memo = page.getByPlaceholder(/교육 준비물/);
  await memo.evaluate((el) => el.blur());
  await memo.focus(); // 입력칸을 누르면 창 안에서 보이는 곳까지 스크롤
  await expect.poll(async () => {
    const box = await memo.boundingBox();
    return box.y + box.height <= vh - 300 - 8; // 창 아래 여백 위에
  }).toBe(true);
});
