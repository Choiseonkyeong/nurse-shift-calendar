// 웹(브라우저·홈 화면 앱) 폰 뒤로가기: 팝업 닫기 → 내 근무 탭 → 앱 나가기 (안드로이드 앱과 같은 순서)
import { test, expect } from '@playwright/test';
import { openApp, tab } from './helpers.js';

test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
const day = (page, label) => page.getByRole('button', { name: new RegExp(`^${label} (?!\\()`) });
const back = async (page) => {
  await page.goBack({ waitUntil: 'commit' }).catch(() => {});
  await page.waitForTimeout(300);
};
const inApp = (page) => expect(page).toHaveURL(/localhost/);
const leftApp = (page) => expect(page).toHaveURL('about:blank');

test('날짜 창을 연 채 뒤로가기 → 창만 닫힘, 한 번 더 누르면 앱을 나감', async ({ page }) => {
  await page.goto('about:blank'); // 홈 화면 앱처럼 앱 앞에 다른 기록
  await openApp(page);
  await day(page, '9월 10일').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await back(page);
  await inApp(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /김간호/ })).toBeVisible();
  await back(page);
  await leftApp(page);
});

test('X로 창을 닫은 뒤에는 뒤로가기 한 번에 나감 (두 번 누를 필요 없음)', async ({ page }) => {
  await page.goto('about:blank');
  await openApp(page);
  await day(page, '9월 10일').click();
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await back(page);
  await leftApp(page);
});

test('다른 탭에서 뒤로가기 → 내 근무 탭, 등록 탭의 계정 창 → 창 닫기 → 내 근무 → 나감', async ({ page }) => {
  await page.goto('about:blank');
  await openApp(page);
  await tab(page, '그룹').click();
  await back(page);
  await inApp(page);
  await expect(page.getByRole('heading', { name: /김간호/ })).toBeVisible();
  await expect(page.getByText('내 그룹')).toHaveCount(0);

  await tab(page, '설정').click();
  await page.getByText('계정 연결하기').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await back(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('근무표 가져오기')).toBeVisible(); // 창만 닫히고 등록 탭 유지
  await back(page);
  await expect(page.getByRole('heading', { name: /김간호/ })).toBeVisible();
  await back(page);
  await leftApp(page);
});

test('꼭 답해야 하는 창(이름 확인)은 뒤로가기로 앱이 꺼지지 않음', async ({ page }) => {
  await page.goto('about:blank');
  await openApp(page, { name: '최수민' });
  await expect(page.getByText('이름을 확인해 주세요')).toBeVisible();
  await back(page);
  await inApp(page);
  await expect(page.getByText('이름을 확인해 주세요')).toBeVisible();
  await back(page);
  await inApp(page);
});
