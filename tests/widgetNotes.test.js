import { describe, it, expect, vi, beforeEach } from 'vitest';

const update = vi.fn(async () => {});
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
  registerPlugin: () => ({ update })
}));
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => (store[k] = String(v)),
  removeItem: (k) => delete store[k]
};

const { syncWidget, setWidgetNotesPref, getWidgetNotesPref } = await import('../src/lib/widgetSync');
const today = new Date();
const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const sent = () => JSON.parse(update.mock.calls.at(-1)[0].data).days[key];

describe('위젯에 일정 보이기 설정', () => {
  beforeEach(() => update.mockClear());
  it('기본은 보이고, 끄면 바로 근무만 다시 보냄 (켜면 다시 일정)', async () => {
    expect(getWidgetNotesPref()).toBe(true);
    await syncWidget({ [key]: 'D' }, [{ code: 'D', label: 'Day' }], { [key]: '교육' });
    expect(sent()).toMatchObject({ code: 'D', notes: '교육' });
    setWidgetNotesPref(false);
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(sent()).not.toHaveProperty('notes');
    expect(getWidgetNotesPref()).toBe(false);
    setWidgetNotesPref(true);
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(3));
    expect(sent()).toMatchObject({ notes: '교육' });
  });
});
