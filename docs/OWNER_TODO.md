# 운영자가 직접 해야 하는 일 (코드로는 할 수 없는 것)

앱 코드는 모두 배포되어 있습니다. 아래는 **계정·대시보드 접근 권한이 있는 운영자만** 할 수 있는 작업입니다.
위에서부터 순서대로 하고, 끝난 항목은 `[x]` 로 표시해 두세요.

## 꼭 해야 하는 것

- [x] **1. Supabase SQL 3개 실행** (3분) — ✅ 2026-09-30 완료 (확인 쿼리 결과 1·1·1)
  - Supabase 대시보드 → SQL Editor → New query → 아래 파일 내용을 **하나씩 전체** 붙여넣고 Run
    1. `supabase/migrations/20260928000800_shift_swaps.sql` — 그룹 근무 교환 요청
    2. `supabase/migrations/20260928000900_profile_settings.sql` — 시급·연차·알림 설정을 서버에 저장 (새 폰 로그인 시 복원)
    3. `supabase/migrations/20260928001000_delete_account.sql` — 앱 안에서 계정 삭제 (스토어 심사 필수)
  - 확인: 오류 없이 `Success` 가 뜨면 완료. 실행 전에도 앱은 동작하지만 위 3가지 기능이 꺼져 있습니다.

- [ ] **2. 개인정보처리방침 문의처 입력** (1분)
  - `public/privacy.html` 의 `[운영자 이름 · 문의 이메일을 입력하세요]` 를 실제 값으로 바꿔야 합니다.
  - 운영자 이름(또는 앱 이름/상호)과 문의 이메일을 알려 주면 대신 바꿔 드립니다.
  - 스토어에 입력할 주소: `https://nurse-shift-calendar.vercel.app/privacy.html`

- [ ] **3. 엑셀 읽기 라이브러리(SheetJS) 보안 업데이트 허용** (1분)
  - 지금 쓰는 엑셀 읽기 라이브러리에 보안 경고가 1건 있습니다(조작된 엑셀 파일을 열면 앱이 오래 멈출 수 있음).
  - 새 버전은 SheetJS 사이트(`cdn.sheetjs.com`)에서만 받을 수 있어, Claude Code 작업 환경에서 이 주소를 허용해야 합니다.
  - 방법: Claude Code 세션 제목 줄의 클라우드 환경 메뉴 → **Edit** → Network access 의 허용 도메인에 `cdn.sheetjs.com` 추가 → 저장 후 "SheetJS 업데이트해줘"
  - 참고: https://code.claude.com/docs/en/claude-code-on-the-web

- [ ] **4. 실제 폰으로 한 번 써 보기** (10분) — 자동 테스트로는 확인할 수 없는 것
  - 근무표를 **폰 카메라로 직접 찍어** 사진 등록 → 결과를 알려 주거나 사진을 보내 주면 정확도 확인
    (동료 실명이 있는 사진은 확인용으로만 쓰고 저장소에는 올리지 않습니다)
  - 아이폰이 있으면: 사파리에서 열어 홈 화면에 추가 → 사진 등록(2400만 화소 사진), 화면 밀어서 뒤로가기
  - 안드로이드: 홈 화면에 추가한 앱에서 날짜 창을 연 채 뒤로가기 → 창만 닫히는지

## 선택 (필요할 때)

- [ ] **5. Google 로그인 마무리** (15분) — 하기 전에는 Google 버튼이 숨겨져 있어 문제없음
  1. https://console.cloud.google.com → 프로젝트 만들기 (이름은 **영문**, 예: `nurse-shift`)
  2. API 및 서비스 → OAuth 동의 화면 → 외부 → 앱 이름·지원 이메일 입력 → 테스트 사용자에 본인 Gmail 추가
  3. 사용자 인증 정보 → OAuth 클라이언트 ID → 웹 애플리케이션
     - 승인된 JavaScript 원본: `https://nurse-shift-calendar.vercel.app`
     - 승인된 리디렉션 URI: `https://ianilyiumkvkowcnuawt.supabase.co/auth/v1/callback` (카카오에 넣은 것과 같은 주소)
  4. 발급된 클라이언트 ID·보안 비밀번호를 Supabase → Authentication → Sign In / Providers → Google 에 입력 → Save
  5. 모든 사람이 쓰게 하려면 OAuth 동의 화면에서 **앱 게시**
  - ⚠️ 클라이언트 보안 비밀번호는 채팅·코드에 붙여넣지 말고 Supabase 화면에만 입력하세요.
  - 자세한 내용: [`AUTH_SETUP.md`](./AUTH_SETUP.md)

- [ ] **6. 메일 발송 한도 늘리기** — 사용자가 많아지면
  - Supabase 기본 메일은 시간당 발송 수가 매우 적습니다. Authentication → Emails → SMTP Settings 에 무료 SMTP(Resend, Brevo 등) 연결

- [ ] **7. 웹 버전 푸시 알림** — 웹에서 브라우저를 닫아도 알림을 받게 하려면 (선택)
  - 설치한 앱(Android/iOS)은 폰 안에서 알림을 예약하므로 **이 설정 없이도 앱을 꺼 둔 상태에서 알림이 옵니다.**
  - 웹까지 원할 때만 [`PUSH_SETUP.md`](./PUSH_SETUP.md) 순서대로 (Firebase → GitHub Secrets 3개 → 함수 배포 → 예약 실행 SQL)

- [ ] **8. 스토어 등록 전**
  - 안드로이드 출시용 서명: GitHub → Settings → Secrets and variables → Actions 에 `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` 등록 (지금은 테스트용 APK 만 만들어짐)
  - iOS 출시용 서명: Apple 개발자 계정 필요, Secrets 에 `IOS_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` 등록
  - 구글 플레이 "데이터 보안": 계정 삭제 경로 = 프로필 → 계정 → 계정 삭제 (웹도 같은 경로)
  - 개인정보 라벨: 개인정보처리방침 1번 표 그대로 (광고·추적 없음, 사진은 기기 안에서만 처리)

## 하지 않아도 되는 것 (확인 완료)

- 서버 1000행 제한: 앱이 1000개씩 나눠 받도록 되어 있어 **Supabase 설정 변경 불필요**
- 그룹 색상: 이제 각자 폰에만 저장되어 서버 설정 불필요
- 앱 근무 알림: 폰 안에서 예약 → Firebase·서버 설정 불필요
- 공휴일: 2025~2030년 등록, 설날·추석은 자동 테스트로 음력과 대조. 2031년 이후·새 임시공휴일은 지정되면 "공휴일 추가해줘"
