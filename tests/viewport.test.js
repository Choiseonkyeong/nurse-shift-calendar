import { describe, it, expect } from 'vitest';
import { keyboardInset, isIos, preventIosInputZoom, installKeyboardInset } from '../src/lib/viewport.js';
import { swipeDirection, shouldDismissSheet } from '../src/lib/swipe.js';

describe('키보드 높이', () => {
  it('키보드가 화면 아래를 가린 만큼', () => {
    expect(keyboardInset(800, { height: 480, offsetTop: 0 })).toBe(320);
    expect(keyboardInset(800, { height: 480, offsetTop: 20 })).toBe(300); // 화면이 위로 밀린 만큼 뺌
  });
  it('주소창 접힘 같은 작은 변화·키보드 없음은 0', () => {
    expect(keyboardInset(800, { height: 800, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(800, { height: 750, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(800, null)).toBe(0);
  });
  it('visualViewport 바뀔 때마다 --kb 갱신', () => {
    const handlers = {};
    const props = {};
    const vv = { height: 800, offsetTop: 0, addEventListener: (t, f) => (handlers[t] = f), removeEventListener: () => {} };
    const win = { innerHeight: 800, visualViewport: vv, document: { documentElement: { style: { setProperty: (k, v) => (props[k] = v) } } } };
    installKeyboardInset(win);
    expect(props['--kb']).toBe('0px');
    vv.height = 450;
    handlers.resize();
    expect(props['--kb']).toBe('350px');
  });
});

describe('아이폰 입력칸 자동 확대 방지', () => {
  const doc = () => {
    const meta = { content: 'width=device-width, initial-scale=1.0' };
    return { meta, querySelector: () => meta };
  };
  it('아이폰·아이패드만 maximum-scale 추가', () => {
    const d = doc();
    expect(preventIosInputZoom(d, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(true);
    expect(d.meta.content).toBe('width=device-width, initial-scale=1.0, maximum-scale=1');
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true); // 아이패드 데스크톱 모드
  });
  it('안드로이드·PC 는 그대로 (두 손가락 확대가 막히지 않게)', () => {
    const d = doc();
    expect(preventIosInputZoom(d, { userAgent: 'Mozilla/5.0 (Linux; Android 15)' })).toBe(false);
    expect(preventIosInputZoom(d, { userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(d.meta.content).toBe('width=device-width, initial-scale=1.0');
  });
});

describe('손가락 동작', () => {
  it('가로로 충분히 밀 때만 달 넘김 (세로 스크롤과 구분)', () => {
    expect(swipeDirection(-80, 10)).toBe('left');
    expect(swipeDirection(80, -10)).toBe('right');
    expect(swipeDirection(-30, 0)).toBe(null); // 너무 짧음
    expect(swipeDirection(-80, 70)).toBe(null); // 대각선(스크롤)
  });
  it('아래 창: 충분히 또는 빠르게 끌어내리면 닫힘', () => {
    expect(shouldDismissSheet(130, 600)).toBe(true);
    expect(shouldDismissSheet(70, 100)).toBe(true); // 튕기듯
    expect(shouldDismissSheet(70, 400)).toBe(false);
    expect(shouldDismissSheet(30, 50)).toBe(false);
  });
});
