// FCM HTTP v1 발송 유틸 (Deno / Supabase Edge Functions)
// 서비스 계정 JSON(Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 새 비공개 키)으로 OAuth 토큰 발급 후 발송

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
  androidChannelId?: string;
}

export type SendResult =
  | { token: string; ok: true }
  | { token: string; ok: false; invalidToken: boolean; status: number; error: string };

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const base64url = (input: ArrayBuffer | string): string => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const pemToDer = (pem: string): ArrayBuffer => {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '');
  const raw = atob(b64);
  const der = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) der[i] = raw.charCodeAt(i);
  return der.buffer;
};

/** 서비스 계정으로 서명한 OAuth JWT assertion 생성 (RS256) */
export async function createSignedJwt(sa: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = { iss: sa.client_email, scope: FCM_SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

export async function getAccessToken(sa: ServiceAccount, fetchFn: typeof fetch = fetch): Promise<string> {
  const res = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: await createSignedJwt(sa)
    })
  });
  if (!res.ok) throw new Error(`OAuth token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

export function buildFcmPayload(token: string, msg: PushMessage) {
  return {
    message: {
      token,
      notification: { title: msg.title, body: msg.body },
      data: msg.data ?? {},
      android: {
        priority: 'HIGH',
        notification: { channel_id: msg.androidChannelId ?? 'shift-reminders', sound: 'default' }
      },
      apns: {
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
        payload: { aps: { sound: 'default' } }
      }
    }
  };
}

// 삭제해야 할 토큰 오류 (INVALID_ARGUMENT 는 페이로드 오류일 수도 있어 제외 → 토큰 일괄 삭제 방지)
const INVALID_TOKEN_CODES = new Set(['UNREGISTERED', 'SENDER_ID_MISMATCH']);

export async function sendToToken(
  projectId: string,
  accessToken: string,
  token: string,
  msg: PushMessage,
  fetchFn: typeof fetch = fetch
): Promise<SendResult> {
  const res = await fetchFn(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildFcmPayload(token, msg))
  });
  if (res.ok) return { token, ok: true };

  const text = await res.text();
  let errorCode = '';
  try {
    const details = JSON.parse(text)?.error?.details ?? [];
    errorCode = details.find((d: { errorCode?: string }) => d.errorCode)?.errorCode ?? '';
  } catch {
    /* 비JSON 응답 */
  }
  return {
    token,
    ok: false,
    invalidToken: res.status === 404 || INVALID_TOKEN_CODES.has(errorCode),
    status: res.status,
    error: errorCode || text.slice(0, 200)
  };
}
