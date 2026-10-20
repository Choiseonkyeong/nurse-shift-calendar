// e2e/helpers.js
import { expect } from '@playwright/test';
import { createFakeState, installFakeSupabase } from './fakeSupabase.js';

export const TODAY = new Date('2026-09-28T09:00:00+09:00');

/**
 * 앱 열기: 가짜 서버 + 고정 날짜 + (처음 한 번만) 기기 저장값 주입
 * @param local  localStorage 초기값 { key: value(객체면 JSON) }
 */
export async function openApp(page, { state = createFakeState(), local = {}, name = '김간호', intro = false } = {}) {
  await installFakeSupabase(page.context(), state);
  await page.clock.setFixedTime(TODAY);
  // 첫 화면(시작 화면)은 이미 본 것으로 (intro: true 면 처음 사용자처럼 보여 줌)
  const init = { ...(intro ? {} : { intro_seen: '1', intro_every_launch: '0' }), ...(name ? { shift_user_name: name } : {}), ...local };
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    Object.entries(values).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
  }, init);
  await page.goto('/');
  return state;
}

export const readLocal = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);

export const tab = (page, label) => {
  // 그룹은 아래 탭바가 아니라 마이 탭 안에서 들어감
  if (label === '그룹') {
    return {
      click: async () => {
        await tab(page, '마이').click();
        await page.getByRole('button', { name: '그룹', exact: true }).click();
      }
    };
  }
  return page.getByRole('button', { name: label, exact: true }).last();
};

/** 이름(계정 버튼 제목) 확인: 계정 버튼은 근무표 외 화면 머리글에 있음 → 마이 탭에서 보고 근무표로 돌아옴 */
export async function expectUserName(page, name) {
  await tab(page, '마이').click();
  await expect(page.getByTitle(name, { exact: true })).toBeVisible();
  await tab(page, '근무표').click();
}

/** 서버 동기화 완료 표시까지 대기 */
export const waitSaved = (page) => page.getByText('서버에 저장됨').waitFor();

/** 앱 확인 창에서 확인 버튼 누르기 */
export const confirmOk = (page) => page.locator('[data-confirm-ok]').click();
