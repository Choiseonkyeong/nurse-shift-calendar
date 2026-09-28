// Supabase Edge Function: send-shift-reminders
// pg_cron 이 5분마다 호출 → 발송 대상 선점 → FCM 발송 → 만료 토큰 정리
// 필요한 시크릿: CRON_SECRET, FIREBASE_SERVICE_ACCOUNT (서비스 계정 JSON 전체)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 런타임이 자동 주입
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleRequest, type DueReminder } from './handler.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

Deno.serve(async (req) => {
  try {
    return await handleRequest(req, {
      cronSecret: Deno.env.get('CRON_SECRET') ?? '',
      serviceAccount: JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}'),
      claimDueReminders: async () => {
        const { data, error } = await supabase.rpc('claim_due_shift_reminders');
        if (error) throw error;
        return (data ?? []) as DueReminder[];
      },
      deleteTokens: async (tokens) => {
        const { error } = await supabase.from('device_tokens').delete().in('token', tokens);
        if (error) throw error;
      }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
