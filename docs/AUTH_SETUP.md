# 소셜 로그인 (카카오 / Google) 설정 가이드

앱에서 버튼이 나오는 곳:

| 위치 | 버튼 | 동작 |
|---|---|---|
| 첫 화면(이름 입력) | 카카오로 시작 / Google로 시작 | 처음이면 새 계정(카카오 닉네임·구글 이름 사용), 이미 있으면 그 계정 데이터로 |
| 프로필 → 계정 → 이 기기 계정 지키기 | 카카오로 계정 연결 / Google로 계정 연결 | 지금 쓰던 계정에 연결 → 근무·그룹 그대로, 다음부터 그 계정으로 로그인 |
| 프로필 → 계정 → 기존 계정으로 로그인 | 카카오로 로그인 / Google로 로그인 | 다른 폰에서 연결해 둔 계정으로 로그인 (이 기기 데이터는 계정 데이터로 교체) |

> 버튼은 **Supabase 에서 켠 제공자만** 보입니다. 아래 설정 전에는 버튼이 숨겨져 있고 기존 기능(이메일 계정)은 그대로 동작하므로, 배포 순서는 상관없습니다.
>
> ⚠️ Client Secret·REST API 키는 Supabase 대시보드에만 입력하세요. 채팅·코드·깃허브에 올리지 마세요.

공통 콜백 주소 (카카오·구글 양쪽에 등록):

```
https://ianilyiumkvkowcnuawt.supabase.co/auth/v1/callback
```

## 1. 카카오

1. https://developers.kakao.com → 로그인 → **내 애플리케이션 → 애플리케이션 추가하기**
   (앱 이름: 근무표, 회사명: 개인 이름 가능)
2. **앱 키** 에서 **REST API 키** 복사 → Supabase 의 *Client ID*
3. **제품 설정 → 카카오 로그인**
   - **활성화 설정: ON**
   - **Redirect URI** 등록: 위 공통 콜백 주소
4. **제품 설정 → 카카오 로그인 → 보안** → **Client Secret 코드 생성** → **활성화 상태: 사용함**
   → 코드 복사 → Supabase 의 *Client Secret*
5. **제품 설정 → 카카오 로그인 → 동의항목**
   - 닉네임: 필수 동의
   - 프로필 사진: 선택 동의
   - 카카오계정(이메일): 가능하면 **필수 동의** (이메일 항목은 **비즈 앱 전환** 후 설정 가능 —
     *앱 설정 → 비즈니스* 에서 개인 개발자 비즈 앱 전환 가능)
6. **앱 설정 → 플랫폼 → Web** → 사이트 도메인에 `https://nurse-shift-calendar.vercel.app` 등록

## 2. Google

1. https://console.cloud.google.com → 프로젝트 선택 (푸시 알림용 Firebase 프로젝트 사용 가능)
2. **API 및 서비스 → OAuth 동의 화면**
   - User Type: **외부**, 앱 이름 / 지원 이메일 입력 → 범위는 기본값(email, profile, openid)
   - 테스트 중에는 **테스트 사용자** 에 본인 Gmail 추가, 공개하려면 **앱 게시**
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://nurse-shift-calendar.vercel.app`
   - 승인된 리디렉션 URI: 위 공통 콜백 주소
   - 생성 후 **클라이언트 ID / 클라이언트 보안 비밀번호** 복사

## 3. Supabase

1. **Authentication → Sign In / Providers**
   - **Kakao**: Enable → Client ID(REST API 키), Client Secret 입력 → Save
     (이메일 동의항목을 설정하지 못했다면 *Allow users without an email* 옵션이 보이면 켜기)
   - **Google**: Enable → Client ID, Client Secret 입력 → Save
   - **Allow manual linking: ON** (Sign In / Providers 페이지 위쪽 *User Signups* — [카카오로 계정 연결] 에 필요)
   - **Allow anonymous sign-ins: ON** 유지 (이름만 입력하고 시작하는 사용자용)
2. **Authentication → URL Configuration**
   - **Site URL**: `https://nurse-shift-calendar.vercel.app`
   - **Redirect URLs** 에 모두 추가:
     ```
     https://nurse-shift-calendar.vercel.app/**
     https://*-choiseonkyeongs-projects.vercel.app/**
     http://localhost:5173/**
     com.nurseshift.app://auth-callback
     ```

## 4. 확인

1. 웹에서 프로필 → 계정 → **카카오로 계정 연결** → 카카오 로그인 → "카카오 계정이 연결됐어요" + 근무표 그대로면 성공
2. 다른 브라우저(시크릿 창)에서 첫 화면 **카카오로 시작** → 같은 이름·근무가 나오면 성공 (Google 도 같은 방법)
3. 앱(APK): 같은 순서로 확인 — 로그인 후 앱으로 자동 복귀
4. Supabase **Authentication → Users** 에서 Provider 가 kakao / google 로 표시되는지 확인

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| `redirect_uri mismatch` / KOE006 | 카카오·구글 콘솔의 Redirect URI 가 공통 콜백 주소와 정확히 같은지 |
| 로그인 후 localhost / 다른 주소로 이동 | Supabase Redirect URLs 에 해당 주소가 있는지 |
| "서버에서 계정 연결이 꺼져 있어요" | Supabase *Allow manual linking* ON |
| "이미 다른 근무표 계정에 연결되어 있어요" | 그 카카오/구글 계정은 다른 계정에 이미 연결됨 → [기존 계정으로 로그인] 사용 |
| 버튼이 안 보임 | Supabase 에서 해당 Provider Enable + Save 했는지 (앱을 다시 열기) |
| 카카오 로그인 후 오류(이메일 관련) | 이메일 동의항목 설정 또는 *Allow users without an email* |
| 앱(APK)에서 로그인 후 앱으로 안 돌아옴 | Redirect URLs 에 `com.nurseshift.app://auth-callback` 등록 여부 |
