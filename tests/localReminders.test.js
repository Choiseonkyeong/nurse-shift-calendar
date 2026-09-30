import { describe, it, expect, vi, beforeEach } from 'vitest';

const native = { value: true, platform: 'android' };
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.value, getPlatform: () => native.platform }
}));
const LN = {
  pending: [],
  checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  requestPermissions: vi.fn(async () => ({ display: 'granted' })),
  createChannel: vi.fn(async () => {}),
  getPending: vi.fn(async () => ({ notifications: LN.pending })),
  cancel: vi.fn(async () => {}),
  schedule: vi.fn(async () => ({})),
  checkExactNotificationSetting: vi.fn(async () => ({ exact_alarm: 'denied' }))
};
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: LN }));

const { buildReminders, syncLocalReminders, enableLocalReminders, MAX_REMINDERS } = await import('../src/lib/localReminders');

const TYPES = [
  { code: 'D', label: 'Day (데이)', kind: 'work' },
  { code: 'N', label: 'Night (나이트)', kind: 'work' },
  { code: 'OFF', label: '휴무', kind: 'off' },
  { code: '연차', label: '연차', kind: 'leave' }
];
const START = { D: '07:30', N: '21:30' };
const NOW = new Date(2026, 8, 28, 9, 0); // 9/28 09:00

describe('buildReminders (폰 안에서 예약할 근무 알림)', () => {
  it('근무만, 시작 N분 전 시각으로, 이미 지난 알림은 빼고', () => {
    const list = buildReminders({
      myShifts: { '2026-09-28': 'D', '2026-09-29': 'N', '2026-09-30': 'OFF', '2026-10-01': '연차', '2026-10-02': 'D' },
      startTimes: START,
      shiftTypes: TYPES,
      minutesBefore: 60,
      userName: '김간호',
      now: NOW
    });
    // 9/28 D 07:30 은 이미 지남, OFF·연차는 알림 없음
    expect(list.map((r) => r.dateKey)).toEqual(['2026-09-29', '2026-10-02']);
    expect(list[0]).toMatchObject({ id: 20260929, title: '⏰ 1시간 뒤 N 근무 시작', body: '김간호 님, 21:30에 Night (나이트) 근무가 시작됩니다. 준비해 주세요!' });
    expect(list[0].at).toEqual(new Date(2026, 8, 29, 20, 30));
    expect(list[1].at).toEqual(new Date(2026, 9, 2, 6, 30));
  });

  it('이름이 없으면 호칭 없이, 시작 시각이 없는 근무는 건너뜀, 개수 제한', () => {
    const many = {};
    for (let i = 0; i < 90; i++) many[new Date(Date.UTC(2026, 8, 29 + i)).toISOString().slice(0, 10)] = 'N';
    const list = buildReminders({ myShifts: many, startTimes: START, shiftTypes: TYPES, minutesBefore: 30, now: NOW, days: 120 });
    expect(list.length).toBe(MAX_REMINDERS);
    expect(list[0].body.startsWith('21:30에')).toBe(true);
    expect(buildReminders({ myShifts: { '2026-09-29': 'D' }, startTimes: {}, shiftTypes: TYPES, now: NOW })).toEqual([]);
  });
});

describe('syncLocalReminders', () => {
  beforeEach(() => {
    Object.values(LN).forEach((f) => typeof f === 'function' && f.mockClear?.());
    LN.pending = [{ id: 20260929, extra: { kind: 'shift-start' } }, { id: 7, extra: { kind: 'other' } }];
    native.value = true;
  });

  it('이전 근무 알림만 지우고 새로 예약 (평소엔 정확한 알람 허용을 묻지 않음)', async () => {
    const n = await syncLocalReminders({ enabled: true, myShifts: { '2026-09-29': 'N' }, startTimes: START, shiftTypes: TYPES, minutesBefore: 60, now: NOW });
    expect(n).toBe(1);
    expect(LN.cancel).toHaveBeenCalledWith({ notifications: [{ id: 20260929 }] });
    const sent = LN.schedule.mock.calls[0][0].notifications[0];
    expect(sent).toMatchObject({ id: 20260929, channelId: 'shift-reminders', isExactNotification: false, extra: { kind: 'shift-start' } });
    expect(sent.schedule).toMatchObject({ allowWhileIdle: true });
  });

  it('알림을 켤 때는 정확한 알람으로 예약, 끄면 취소만', async () => {
    await syncLocalReminders({ enabled: true, askExact: true, myShifts: { '2026-09-29': 'N' }, startTimes: START, shiftTypes: TYPES, now: NOW });
    expect(LN.schedule.mock.calls[0][0].notifications[0].isExactNotification).toBe(true);
    LN.schedule.mockClear();
    expect(await syncLocalReminders({ enabled: false })).toBe(0);
    expect(LN.cancel).toHaveBeenCalled();
    expect(LN.schedule).not.toHaveBeenCalled();
  });

  it('권한이 없으면 예약하지 않고, 웹에서는 아무것도 안 함', async () => {
    LN.checkPermissions.mockResolvedValueOnce({ display: 'denied' });
    expect(await syncLocalReminders({ enabled: true, myShifts: { '2026-09-29': 'N' }, startTimes: START, shiftTypes: TYPES, now: NOW })).toBe(0);
    expect(LN.schedule).not.toHaveBeenCalled();
    native.value = false;
    expect(await syncLocalReminders({ enabled: true })).toBe(0);
    expect(await enableLocalReminders()).toBe(false);
  });

  it('켤 때 권한 요청 + 안드로이드 알림 채널 생성', async () => {
    LN.checkPermissions.mockResolvedValueOnce({ display: 'prompt' });
    expect(await enableLocalReminders()).toBe(true);
    expect(LN.requestPermissions).toHaveBeenCalled();
    expect(LN.createChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'shift-reminders' }));
  });
});
