// deno test supabase/functions/send-shift-reminders/handler.test.ts
import { assertEquals } from 'jsr:@std/assert@1';
import { handleRequest, buildReminderMessage, formatLeadTime, type DueReminder } from './handler.ts';
import { createSignedJwt } from '../_shared/fcm.ts';

async function makeServiceAccount() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const b64 = btoa(String.fromCharCode(...der)).match(/.{1,64}/g)!.join('\n');
  return {
    sa: { project_id: 'demo-proj', client_email: 'svc@demo.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n` },
    publicKey: pair.publicKey
  };
}

const reminder = (tokens: string[]): DueReminder => ({
  profile_id: 'p1', display_name: '최수민', work_date: '2026-10-01', code: 'D', label: 'Day (데이)',
  start_time: '07:30:00', reminder_minutes: 60, tokens
});

const post = (secret?: string) =>
  new Request('http://x/', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} });

Deno.test('JWT is RS256-signed and verifiable', async () => {
  const { sa, publicKey } = await makeServiceAccount();
  const jwt = await createSignedJwt(sa, 1_800_000_000);
  const [h, c, s] = jwt.split('.');
  const dec = (x: string) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((x.length + 3) % 4)), (ch) => ch.charCodeAt(0));
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, dec(s), new TextEncoder().encode(`${h}.${c}`));
  assertEquals(ok, true);
  const claims = JSON.parse(new TextDecoder().decode(dec(c)));
  assertEquals(claims.iss, sa.client_email);
  assertEquals(claims.exp - claims.iat, 3600);
});

Deno.test('message text', () => {
  assertEquals(formatLeadTime(30), '30분');
  assertEquals(formatLeadTime(120), '2시간');
  assertEquals(formatLeadTime(90), '1시간 30분');
  const m = buildReminderMessage(reminder([]));
  assertEquals(m.title, '⏰ 1시간 뒤 D 근무 시작');
  assertEquals(m.body, '최수민 님, 07:30에 Day (데이) 근무가 시작됩니다. 준비해 주세요!');
});

Deno.test('rejects missing/wrong secret without claiming', async () => {
  let claimed = 0;
  const deps = {
    cronSecret: 's3cret', serviceAccount: (await makeServiceAccount()).sa,
    claimDueReminders: async () => { claimed++; return []; }, deleteTokens: async () => {}
  };
  assertEquals((await handleRequest(post(), deps)).status, 401);
  assertEquals((await handleRequest(post('nope'), deps)).status, 401);
  assertEquals((await handleRequest(new Request('http://x/'), deps)).status, 405);
  assertEquals(claimed, 0);
});

Deno.test('sends to all tokens and removes only unregistered ones', async () => {
  const { sa } = await makeServiceAccount();
  const sentBodies: any[] = [];
  const fetchFn = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'at-123' }));
    }
    assertEquals(u, 'https://fcm.googleapis.com/v1/projects/demo-proj/messages:send');
    assertEquals((init!.headers as Record<string, string>).Authorization, 'Bearer at-123');
    const body = JSON.parse(String(init!.body));
    sentBodies.push(body);
    const token = body.message.token;
    if (token === 'dead') {
      return new Response(JSON.stringify({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 });
    }
    if (token === 'badpayload') {
      return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', details: [{ errorCode: 'INVALID_ARGUMENT' }] } }), { status: 400 });
    }
    return new Response('{}');
  }) as typeof fetch;

  let deleted: string[] = [];
  const res = await handleRequest(post('s3cret'), {
    cronSecret: 's3cret', serviceAccount: sa, fetchFn,
    claimDueReminders: async () => [reminder(['good', 'dead']), reminder(['badpayload']), reminder(null as any)],
    deleteTokens: async (t) => { deleted = t; }
  });
  assertEquals(await res.json(), { reminders: 3, sent: 1, failed: 2, removedTokens: 1 });
  assertEquals(deleted, ['dead']);
  assertEquals(sentBodies.length, 3);
  assertEquals(sentBodies[0].message.android.notification.channel_id, 'shift-reminders');
  assertEquals(sentBodies[0].message.data, { type: 'shift_start', work_date: '2026-10-01', code: 'D' });
});

Deno.test('no due reminders → no OAuth call', async () => {
  const fetchFn = (() => { throw new Error('should not fetch'); }) as unknown as typeof fetch;
  const res = await handleRequest(post('s3cret'), {
    cronSecret: 's3cret', serviceAccount: (await makeServiceAccount()).sa, fetchFn,
    claimDueReminders: async () => [], deleteTokens: async () => {}
  });
  assertEquals((await res.json()).sent, 0);
});
