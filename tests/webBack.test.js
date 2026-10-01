import { describe, it, expect, vi } from 'vitest';
import { installWebBack } from '../src/lib/webBack.js';

// 방문 기록 흉내: back() 은 다음 틱에 popstate
function fakeWindow() {
  const entries = [{ state: null }];
  let i = 0;
  const handlers = new Set();
  const win = {
    history: {
      get state() {
        return entries[i].state;
      },
      get length() {
        return i + 1;
      },
      pushState(state) {
        entries.splice(i + 1);
        entries.push({ state });
        i++;
      },
      back() {
        if (i === 0) {
          win.left = true; // 앱을 나감
          return;
        }
        i--;
        queueMicrotask(() => handlers.forEach((h) => h()));
      }
    },
    left: false,
    addEventListener: (_, h) => handlers.add(h),
    removeEventListener: (_, h) => handlers.delete(h),
    setTimeout: (fn) => queueMicrotask(fn)
  };
  return win;
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('installWebBack', () => {
  it('팝업이 열리면 기록 한 칸 → 뒤로가기는 팝업만 닫고 앱에 머무름, 다음 뒤로가기는 나감', async () => {
    const win = fakeWindow();
    let modals = 0;
    const onBack = vi.fn(() => {
      modals--;
      web.sync();
    });
    const web = installWebBack({ needGuard: () => modals > 0, onBack, win });
    web.sync();
    expect(win.history.length).toBe(1); // 처음 화면엔 칸 없음
    modals = 1;
    web.sync();
    expect(win.history.length).toBe(2);
    win.history.back();
    await tick();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(win.left).toBe(false);
    expect(win.history.length).toBe(1);
    win.history.back();
    expect(win.left).toBe(true);
  });

  it('X로 팝업을 닫으면 넣어 둔 칸을 빼서, 뒤로가기 한 번에 나감 (두 번 누를 필요 없음)', async () => {
    const win = fakeWindow();
    let modals = 1;
    const onBack = vi.fn();
    const web = installWebBack({ needGuard: () => modals > 0, onBack, win });
    web.sync();
    modals = 0;
    web.sync();
    await tick();
    expect(onBack).not.toHaveBeenCalled();
    expect(win.history.length).toBe(1);
    win.history.back();
    expect(win.left).toBe(true);
  });

  it('닫을 수 없는 필수 창: 뒤로가기를 눌러도 칸을 다시 넣어 앱이 꺼지지 않음', async () => {
    const win = fakeWindow();
    const web = installWebBack({ needGuard: () => true, onBack: () => {}, win });
    web.sync();
    win.history.back();
    await tick();
    await tick();
    expect(win.history.length).toBe(2);
    expect(win.left).toBe(false);
  });

  it('칸을 빼는 사이 다른 팝업이 열리면 다시 넣음', async () => {
    const win = fakeWindow();
    let modals = 1;
    const web = installWebBack({ needGuard: () => modals > 0, onBack: () => {}, win });
    web.sync();
    modals = 0;
    web.sync(); // back() 진행 중
    modals = 1;
    web.sync(); // 빼는 중이라 무시
    await tick();
    await tick();
    expect(win.history.state?.__back).toBe(true);
  });
});
