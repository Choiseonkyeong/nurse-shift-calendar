# 백그라운드 푸시 알림 설정 가이드

> **앱(Android/iOS)은 이 설정이 필요 없습니다.** 앱은 근무 알림을 폰 안에서 미리 예약해서(`src/lib/localReminders.js`)
> Firebase·서버 없이도 앱을 꺼 둔 상태에서 알림이 옵니다. 아래는 **웹 버전**에서 브라우저를 닫아도 알림을 받고 싶을 때만 하면 됩니다.

근무 시작 N분 전 알림을 **앱이 종료돼 있어도** 받기 위한 1회성 설정입니다.
코드는 이미 준비되어 있으며, 아래 콘솔 작업만 하면 동작합니다.

```
pg_cron(5분) → Edge Function send-shift-reminders → FCM → Android / iOS(APNs)
```

## 1. Firebase 프로젝트

1. https://console.firebase.google.com → **프로젝트 추가** (Google Analytics 는 꺼도 됨)
2. **Android 앱 추가**
   - 패키지 이름: `com.nurseshift.app`
   - `google-services.json` 다운로드 → `android/app/google-services.json` 에 넣고 커밋
     (커밋하지 않으려면 `base64 -i google-services.json` 결과를 GitHub Secret `GOOGLE_SERVICES_JSON_BASE64` 로 등록)
3. **iOS 앱 추가**
   - 번들 ID: `com.nurseshift.app`
   - `GoogleService-Info.plist` 다운로드 → Xcode 에서 `ios/App/App` 폴더로 드래그
     (**Copy items if needed**, Target **App** 체크) → 변경된 `project.pbxproj` 와 함께 커밋
4. **APNs 인증 키 업로드** (iOS 푸시에 필수)
   - Apple Developer → Certificates, IDs & Profiles → **Keys** → `+` → *Apple Push Notifications service (APNs)* 체크 → `.p8` 다운로드
   - Firebase → 프로젝트 설정 → **클라우드 메시징** → Apple 앱 구성 → APNs 인증 키 업로드 (Key ID, Team ID 입력)
   - Apple Developer → Identifiers → `com.nurseshift.app` → **Push Notifications** 체크
5. **서비스 계정 키**
   - Firebase → 프로젝트 설정 → **서비스 계정** → *새 비공개 키 생성* → JSON 다운로드
   - ⚠️ 이 파일은 비밀값입니다. 저장소에 커밋하지 마세요.

## 2. 발송 함수 배포 (GitHub Actions 자동, CLI 설치 불필요)

1. **CRON_SECRET 만들기**: 아무 긴 랜덤 문자열 (예: 비밀번호 생성기로 40자 이상). 3단계에서 한 번 더 씁니다.
2. **Supabase 액세스 토큰**: supabase.com → 오른쪽 위 프로필 → **Account preferences → Access Tokens → Generate new token**
3. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret** 으로 3개 등록

   | 이름 | 값 |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | 2번 토큰 |
   | `FIREBASE_SERVICE_ACCOUNT` | 1단계 5번 서비스 계정 JSON 파일 내용 **전체** |
   | `CRON_SECRET` | 1번 랜덤 문자열 |

4. GitHub → **Actions → Deploy Supabase Functions → Run workflow** (master 선택) 실행
   → 초록색 체크가 뜨면 함수 배포 + 시크릿 등록 완료
   (이후 `supabase/functions/` 가 바뀌어 master 에 머지되면 자동 재배포)

## 3. 스케줄러 (DB)

1. Supabase 대시보드 → **Database → Extensions** 에서 `pg_cron`, `pg_net` 활성화
2. SQL Editor 에서 (값 교체 후) 실행:
   ```sql
   select vault.create_secret('https://ianilyiumkvkowcnuawt.supabase.co', 'project_url');
   select vault.create_secret('<2단계 1번 CRON_SECRET 값>', 'shift_reminder_cron_secret');
   ```
3. `supabase/migrations/20260928000300_schedule_shift_reminders.sql` 전체를 SQL Editor 에서 실행

## 4. 앱 빌드 & 확인

1. 1단계 파일을 커밋/등록한 뒤 GitHub Actions 에서 새 APK / IPA 빌드
2. 앱 설치 → **내 근무 → 알림 설정 → 30분 전** → 알림 권한 허용
3. SQL Editor 에서 등록 확인:
   ```sql
   select platform, updated_at from device_tokens;
   select * from notification_settings;
   ```
4. 발송 테스트: 오늘 날짜에 근무를 넣고, 시작 시각이 `지금 + 알림분 + 몇 분` 이 되도록
   **연차/수당** 탭에서 근무 시간을 조정 → 앱 종료 후 대기
5. 발송 이력 / 오류 확인:
   ```sql
   select * from notification_log order by sent_at desc limit 10;
   select * from cron.job_run_details order by start_time desc limit 10;
   ```
   Edge Function 로그: 대시보드 → Edge Functions → send-shift-reminders → Logs

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| `device_tokens` 가 비어 있음 | 앱 알림 권한, `google-services.json` / `GoogleService-Info.plist` 포함 여부 |
| cron 은 도는데 발송 0건 | `notification_settings.shift_reminder_enabled`, 근무 코드가 work(D/E/N/M)인지, 시작 시각 |
| 함수 응답 401 | Vault `shift_reminder_cron_secret` 과 함수 시크릿 `CRON_SECRET` 값 일치 여부 |
| iOS 만 안 옴 | APNs 키 업로드, App ID 의 Push Notifications 체크 |
