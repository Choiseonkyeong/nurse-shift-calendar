// 근무 시작 알림 발송 핸들러 (의존성 주입으로 테스트 가능하게 분리)
import { getAccessToken, sendToToken, type PushMessage, type SendResult, type ServiceAccount } from '../_shared/fcm.ts';

export interface DueReminder {
  profile_id: string;
  display_name: string;
  work_date: string;
  code: string;
  label: string;
  start_time: string; // 'HH:MM:SS'
  reminder_minutes: number;
  tokens: string[] | null;
}

export interface Deps {
  cronSecret: string;
  serviceAccount: ServiceAccount;
  claimDueReminders: () => Promise<DueReminder[]>;
  deleteTokens: (tokens: string[]) => Promise<void>;
  fetchFn?: typeof fetch;
}

const CONCURRENCY = 20;

export function formatLeadTime(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  return `${minutes}분`;
}

export function buildReminderMessage(r: DueReminder): PushMessage {
  const start = r.start_time.slice(0, 5);
  return {
    title: `⏰ ${formatLeadTime(r.reminder_minutes)} 뒤 ${r.code} 근무 시작`,
    // 이름 없이 시작한 사용자(기본 이름 '나')는 호칭 없이
    body: `${r.display_name && r.display_name !== '나' ? `${r.display_name} 님, ` : ''}${start}에 ${r.label} 근무가 시작됩니다. 준비해 주세요!`,
    data: { type: 'shift_start', work_date: r.work_date, code: r.code },
    androidChannelId: 'shift-reminders'
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!deps.cronSecret || req.headers.get('x-cron-secret') !== deps.cronSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const reminders = await deps.claimDueReminders();
  const jobs = reminders.flatMap((r) =>
    (r.tokens ?? []).map((token) => ({ token, msg: buildReminderMessage(r) }))
  );
  if (jobs.length === 0) return json({ reminders: reminders.length, sent: 0, failed: 0, removedTokens: 0 });

  const fetchFn = deps.fetchFn ?? fetch;
  const accessToken = await getAccessToken(deps.serviceAccount, fetchFn);

  const results: SendResult[] = [];
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    results.push(...await Promise.all(batch.map(({ token, msg }) =>
      sendToToken(deps.serviceAccount.project_id, accessToken, token, msg, fetchFn)
    )));
  }

  const invalid = results.filter((r) => !r.ok && r.invalidToken).map((r) => r.token);
  if (invalid.length > 0) await deps.deleteTokens(invalid);

  const failures = results.filter((r) => !r.ok);
  failures.forEach((f) => console.error('FCM send failed', f));

  return json({
    reminders: reminders.length,
    sent: results.length - failures.length,
    failed: failures.length,
    removedTokens: invalid.length
  });
}
