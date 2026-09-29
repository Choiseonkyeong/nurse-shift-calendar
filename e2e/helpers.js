// e2e/helpers.js
import { createFakeState, installFakeSupabase } from './fakeSupabase.js';

export const TODAY = new Date('2026-09-28T09:00:00+09:00');

/**
 * 앱 열기: 가짜 서버 + 고정 날짜 + (처음 한 번만) 기기 저장값 주입
 * @param local  localStorage 초기값 { key: value(객체면 JSON) }
 */
export async function openApp(page, { state = createFakeState(), local = {}, name = '김간호' } = {}) {
  await installFakeSupabase(page.context(), state);
  await page.clock.setFixedTime(TODAY);
  const init = { ...(name ? { shift_user_name: name } : {}), ...local };
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    Object.entries(values).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
  }, init);
  await page.goto('/');
  return state;
}

export const readLocal = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);

export const tab = (page, label) => page.getByRole('button', { name: label, exact: true }).last();

/** 서버 동기화 완료 표시까지 대기 */
export const waitSaved = (page) => page.getByText('서버에 저장됨').waitFor();

/** 앱 확인 창에서 확인 버튼 누르기 */
export const confirmOk = (page) => page.locator('[data-confirm-ok]').click();
