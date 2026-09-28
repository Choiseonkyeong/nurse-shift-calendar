# 서버(Supabase) 설정 체크리스트

앱 코드는 모두 배포되어 있고, 아래는 **Supabase 대시보드에서 한 번만** 하면 되는 작업입니다.
위에서부터 순서대로 하면 됩니다. (이미 한 항목은 건너뛰기)

## 1. 근무 교환 기능 (필수, 1분)

SQL Editor → New query → 아래 파일 **전체**를 붙여넣고 Run

- `supabase/migrations/20260928000800_shift_swaps.sql`

확인: `select count(*) from shift_swaps;` 가 오류 없이 `0` 이 나오면 완료.
(실행 전에는 그룹 게시판에 "근무 교환 요청" 버튼이 보이지 않을 뿐, 다른 기능은 정상 동작)

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

## 3. 백그라운드 푸시 알림 (선택)

[`docs/PUSH_SETUP.md`](./PUSH_SETUP.md) 참고
(Firebase 서비스 계정 키, GitHub Secrets 3개, Deploy Supabase Functions 실행, `pg_cron`/`pg_net` + vault + `000300` 마이그레이션, `google-services.json`)
