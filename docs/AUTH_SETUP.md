# 소셜 로그인 (카카오 / Google) 설정 가이드

앱 첫 화면에서 **카카오로 시작하기 / Google로 시작하기** 로 로그인합니다.
처음 로그인하면 자동으로 회원가입(프로필 생성)되고, 기존 익명 사용자는 같은 계정에 소셜 계정이 연결되어 데이터가 유지됩니다.

> ⚠️ 이 설정을 끝내기 전에 로그인 기능이 포함된 버전을 배포하면 **아무도 로그인할 수 없습니다.**
> 반드시 아래 1~4단계를 먼저 완료하세요.

공통 콜백 주소 (카카오·구글 양쪽에 등록):

```
https://ianilyiumkvkowcnuawt.supabase.co/auth/v1/callback
```

## 1. 카카오

1. https://developers.kakao.com → 로그인 → **내 애플리케이션 → 애플리케이션 추가하기**
   (앱 이름: ShiftFlow 등, 회사명: 개인 이름 가능)
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

1. https://console.cloud.google.com → 프로젝트 선택 (Firebase 의 ShiftFlow 프로젝트 사용 가능)
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
   - **User Signups → Allow manual linking: ON** (기존 익명 사용자의 데이터를 소셜 계정에 연결하는 데 필요)
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

1. Vercel Preview(PR 미리보기) 주소에서 **카카오로 시작하기 / Google로 시작하기** 각각 로그인
2. 로그인 후 상단에 카카오 닉네임 / 구글 이름이 표시되고 기존 근무표가 그대로 보이면 성공
3. Supabase **Authentication → Users** 에서 Provider 가 kakao / google 로 표시되는지 확인

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| `redirect_uri mismatch` / KOE006 | 카카오·구글 콘솔의 Redirect URI 가 공통 콜백 주소와 정확히 같은지 |
| 로그인 후 localhost / 다른 주소로 이동 | Supabase Redirect URLs 에 해당 주소가 있는지 |
| `Manual linking is disabled` | Supabase *Allow manual linking* ON |
| 카카오 로그인 후 오류(이메일 관련) | 이메일 동의항목 설정 또는 *Allow users without an email* |
| 앱(APK)에서 로그인 후 앱으로 안 돌아옴 | Redirect URLs 에 `com.nurseshift.app://auth-callback` 등록 여부 |
