import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

// 서비스 워커(웹 오프라인 캐시)를 실제로 켜고 확인
test.use({ serviceWorkers: 'allow' });

/** 오프라인 캐시에 저장된 페이지의 제목 */
const cachedTitle = (page, path) =>
  page.evaluate(async (p) => {
    const res = await caches.match(p);
    return res ? ((await res.text()).match(/<title>([^<]*)/) || [])[1] || '' : null;
  }, path);

test('개인정보처리방침을 열어도 오프라인용 앱 첫 화면 캐시가 바뀌지 않음', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('heading', { name: '김간호 님의 근무표' })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 });
  await expect.poll(() => cachedTitle(page, '/')).toBe('근무표');

  await page.goto('/privacy.html');
  await expect(page.getByRole('heading', { name: '개인정보처리방침' })).toBeVisible();
  // 방침 페이지는 자기 주소로 저장되고, 앱 첫 화면('/')은 그대로
  await expect.poll(() => cachedTitle(page, '/privacy.html')).toBe('개인정보처리방침 · 근무표');
  expect(await cachedTitle(page, '/')).toBe('근무표');
});
