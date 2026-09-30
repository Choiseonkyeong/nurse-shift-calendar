// src/lib/errorText.js
// 서버·네트워크 오류를 사용자가 읽을 수 있는 한국어 안내로 (영어 원문·코드가 그대로 보이지 않게)

const RULES = [
  [/failed to fetch|load failed|networkerror|network request failed|fetch failed/i, '인터넷에 연결할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요.'],
  [/timeout|timed out/i, '서버 응답이 늦어요. 잠시 후 다시 시도해 주세요.'],
  [/jwt|not authenticated|profile not found|refresh token/i, '로그인 정보가 만료됐어요. 앱을 다시 열어 주세요.'],
  [/not a member of this group|row-level security|permission denied/i, '이 작업을 할 권한이 없어요. 그룹 목록을 새로고침해 주세요.'],
  [/could not find the function|pgrst202|schema cache|does not exist/i, '서버 업데이트가 아직 안 된 기능이에요. 잠시 후 다시 시도해 주세요.'],
  [/invalid invite code/i, '해당 초대 코드와 일치하는 그룹이 없어요. 코드를 다시 확인해 주세요.'],
  [/too large|payload/i, '내용이 너무 커서 저장하지 못했어요.'],
  [/rate limit|too many requests/i, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.']
];

/** 오류 → 한국어 안내 (이미 한국어 문장이면 그대로) */
export function errorText(err, fallback = '문제가 생겼어요. 잠시 후 다시 시도해 주세요.') {
  const msg = String(err?.message || err || '').trim();
  if (!msg) return fallback;
  const hit = RULES.find(([re]) => re.test(msg) || re.test(String(err?.code || '')));
  if (hit) return hit[1];
  // 서버가 보낸 한국어 안내(예: '이미 처리된 요청입니다')는 그대로
  if (/[가-힣]/.test(msg)) return msg;
  return fallback;
}
