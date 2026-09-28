# 서버(Supabase) 설정 체크리스트

앱 코드는 모두 배포되어 있고, 아래는 **Supabase 대시보드에서 한 번만** 하면 되는 작업입니다.
위에서부터 순서대로 하면 됩니다. (이미 한 항목은 건너뛰기)

## 1. SQL 2개 실행 (필수, 2분)

SQL Editor → New query → 아래 파일을 **하나씩 전체** 붙여넣고 Run

| 파일 | 기능 | 확인 쿼리 (오류 없이 나오면 완료) |
|---|---|---|
| `supabase/migrations/20260928000800_shift_swaps.sql` | 그룹 근무 교환 요청 | `select count(*) from shift_swaps;` |
| `supabase/migrations/20260928000900_profile_settings.sql` | 시급·연차·알림 설정을 서버에 저장 (새 폰 로그인 시 복원) | `select get_my_settings();` → `null` |

실행 전에도 앱은 정상 동작합니다. (교환 버튼이 안 보이고, 설정은 기기에만 저장될 뿐)

## 2. 이메일 계정 연결 (필수, 3분)

폰을 바꾸거나 앱을 지워도 데이터를 지키기 위한 설정입니다.

1. **Authentication → Sign In / Providers → Email**: `Enable Email provider` 켜짐 확인
   - `Confirm email`: 켜 두기 권장 (인증 메일 링크를 눌러야 연결됨)
2. **Authentication → URL Configuration**
   - `Site URL`: Vercel 운영 주소 (예: `https://nurse-shift-calendar.vercel.app`)
   - `Redirect URLs`: 같은 주소 추가
   - 인증 메일 링크를 누르면 이 주소의 "이메일 인증 완료" 화면이 열립니다.
3. (사용자가 많아지면) **Authentication → Emails → SMTP Settings**
   - Supabase 기본 메일은 시간당 발송 수가 매우 적습니다. 실제 서비스에서는 무료 SMTP(예: Resend, Brevo)를 연결하세요.

확인: 앱 → 왼쪽 위 프로필 동그라미(노란 점) → 이메일 입력 → 인증 메일 수신 → 링크 클릭 → 앱에서 [인증 확인] → 비밀번호 설정.

## 3. 웹에서도 창을 닫았을 때 알림 받기 (선택)

앱(APK·iOS)은 4번 푸시 설정만 하면 되고, **웹 버전**도 브라우저를 닫은 상태에서 알림을 받으려면:

1. Firebase 콘솔 → 프로젝트 설정 → **내 앱 → 웹 앱 추가** → 표시되는 `firebaseConfig` 값 복사
2. Firebase 콘솔 → 프로젝트 설정 → **클라우드 메시징 → 웹 푸시 인증서 → 키 쌍 생성** → 키 복사
3. Vercel → 프로젝트 → Settings → **Environment Variables** 에 추가 후 Redeploy
   - `VITE_FIREBASE_WEB_CONFIG` = `{"apiKey":"...","authDomain":"...","projectId":"...","messagingSenderId":"...","appId":"..."}` (1번 값을 JSON 으로)
   - `VITE_FIREBASE_VAPID_KEY` = 2번 키
   - 둘 다 공개되어도 되는 값입니다. (서비스 계정 키와 다름)

설정 전에는 웹에서 "이 화면이 열려 있을 때만" 알림이 옵니다. 발송은 앱과 같은 서버 함수가 담당하므로 4번 푸시 설정이 먼저 되어 있어야 합니다.

## 4. 백그라운드 푸시 알림 (선택)

[`docs/PUSH_SETUP.md`](./PUSH_SETUP.md) 참고
(Firebase 서비스 계정 키, GitHub Secrets 3개, Deploy Supabase Functions 실행, `pg_cron`/`pg_net` + vault + `000300` 마이그레이션, `google-services.json`)
