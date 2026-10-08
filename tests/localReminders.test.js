import { describe, it, expect, vi, beforeEach } from 'vitest';

const native = { value: true, platform: 'android' };
const AL = {
  result: { supported: true, authorized: true, count: 0 },
  schedule: vi.fn(async () => AL.result),
  cancelAll: vi.fn(async () => {}),
  status: vi.fn(async () => ({ supported: true })),
  openSettings: vi.fn(async () => {})
};
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.value, getPlatform: () => native.platform },
  registerPlugin: () => AL
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

const { buildReminders, syncLocalReminders, syncShiftAlarms, wakeAlarmOf, buildWakeAlarms, shiftTime, enableLocalReminders, getAlarmPermission, MAX_REMINDERS, REMINDER_DAYS } = await import(
  '../src/lib/localReminders'
);

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

  it('근무 알람은 알림과 따로 예약·취소, 알림 예약은 건드리지 않음', async () => {
    AL.schedule.mockClear();
    AL.cancelAll.mockClear();
    const res = await syncShiftAlarms({ enabled: true, myShifts: { '2026-09-29': 'N' }, byShift: { N: ['18:00'] }, startTimes: START, shiftTypes: TYPES, now: NOW });
    expect(res.supported).toBe(true);
    const sent = AL.schedule.mock.calls[0][0].alarms[0];
    expect(sent).toMatchObject({ id: 202609290, at: new Date(2026, 8, 29, 18, 0).getTime(), title: '⏰ N 근무 날 알람' });
    expect(LN.schedule).not.toHaveBeenCalled();
    expect(LN.cancel).not.toHaveBeenCalled();

    await syncShiftAlarms({ enabled: false });
    expect(AL.cancelAll).toHaveBeenCalled();

    native.value = false;
    expect(await syncShiftAlarms({ enabled: true })).toEqual({ supported: false, count: 0 });
  });

  it('알람 설정: 근무별 시각 / 예전 "N분 전" 형식은 근무별 시각으로 바꿈 / 없음', () => {
    const byShift = { D: ['05:30', '05:40'] };
    expect(wakeAlarmOf({ alarm: { enabled: true, byShift } }, START)).toEqual({ enabled: true, byShift });
    expect(wakeAlarmOf({ alarm: { enabled: true, minutesBefore: 90 } }, START)).toEqual({ enabled: true, byShift: { D: ['06:00'], N: ['20:00'] } });
    expect(wakeAlarmOf({ enabled: true, minutesBefore: 60, ring: true }, START)).toEqual({ enabled: true, byShift: { D: ['06:30'], N: ['20:30'] } });
    expect(wakeAlarmOf({ enabled: true, minutesBefore: 60 }, START)).toEqual({ enabled: false, byShift: {} });
  });

  it('시각 계산: 분 더하기·빼기, 자정 넘김, 틀린 형식', () => {
    expect(shiftTime('07:30', -90)).toBe('06:00');
    expect(shiftTime('00:30', -60)).toBe('23:30');
    expect(shiftTime('23:55', 10)).toBe('00:05');
    expect(shiftTime('', 10)).toBeNull();
    expect(shiftTime(undefined)).toBeNull();
  });

  it('모닝콜: 근무마다 여러 시각, 시각 없는 근무 날은 없음, 쉬는 날도 시각을 넣으면 울림, 지난 시각 제외', () => {
    const list = buildWakeAlarms({
      myShifts: { '2026-09-28': 'D', '2026-09-29': 'D', '2026-09-30': 'N', '2026-10-01': 'OFF', '2026-10-02': 'E' },
      byShift: { D: ['05:40', '05:30', '05:30'], OFF: ['09:00'] },
      startTimes: START,
      shiftTypes: TYPES,
      now: NOW,
      days: 10
    });
    expect(list.map((a) => [a.dateKey, a.at.getHours(), a.at.getMinutes()])).toEqual([
      ['2026-09-29', 5, 30],
      ['2026-09-29', 5, 40],
      ['2026-10-01', 9, 0]
    ]);
    expect(list[0]).toMatchObject({ id: 202609290, title: '⏰ D 근무 날 알람', body: '오늘 Day (데이) · 07:30 근무 시작' });
    expect(list[1].id).toBe(202609291);
    expect(list[2].body).toBe('오늘 휴무');
  });

  it('앱을 오래 안 열어도 알림이 이어지도록 90일치(최대 60개)까지 예약', () => {
    expect(REMINDER_DAYS).toBe(90);
    const shifts = {};
    for (let i = 1; i <= 80; i += 3) shifts[new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10)] = 'D';
    const list = buildReminders({ myShifts: shifts, startTimes: START, shiftTypes: TYPES, now: NOW });
    expect(list.length).toBe(Object.keys(shifts).length); // 80일 뒤 근무까지 모두
  });

  it('이 기기 알림 권한 상태 (앱: 플러그인, 웹: 브라우저, 미지원)', async () => {
    expect(await getAlarmPermission()).toBe('granted');
    LN.checkPermissions.mockResolvedValueOnce({ display: 'denied' });
    expect(await getAlarmPermission()).toBe('missing');
    native.value = false;
    expect(await getAlarmPermission()).toBe('unsupported'); // 테스트 환경엔 Notification 없음
    globalThis.window = { Notification: { permission: 'default' } };
    expect(await getAlarmPermission()).toBe('missing');
    globalThis.window.Notification.permission = 'granted';
    expect(await getAlarmPermission()).toBe('granted');
    delete globalThis.window;
  });

  it('켤 때 권한 요청 + 안드로이드 알림 채널 생성', async () => {
    LN.checkPermissions.mockResolvedValueOnce({ display: 'prompt' });
    expect(await enableLocalReminders()).toBe(true);
    expect(LN.requestPermissions).toHaveBeenCalled();
    expect(LN.createChannel).toHaveBeenCalledWith(expect.objectContaining({ id: 'shift-reminders' }));
  });
});
