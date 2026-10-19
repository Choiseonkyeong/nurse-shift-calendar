# 작업 규칙 (AI 도우미·개발자 공통)

이 저장소는 **ChatGPT(Codex), Claude 등 여러 AI와 사람이 함께** 고칩니다.
서로의 작업을 덮어쓰지 않도록 **작업 전에 이 파일과 [CHANGELOG.md](CHANGELOG.md)를 꼭 읽고** 아래 규칙을 지켜 주세요.

## 1. 덮어쓰기 방지 (가장 중요)
1. **작업 시작 전 최신 master 받기**: `git fetch origin && git checkout -B <내 브랜치> origin/master`
   - 예전에 받아 둔 코드로 작업하면 다른 사람이 고친 내용이 지워집니다.
2. **master 에 직접 올리지 않기**: 브랜치에서 작업 → PR → 검사(CI) 통과 → 머지.
3. **강제 푸시(`--force`) 금지** (내 브랜치를 master 기준으로 다시 맞출 때만 `--force-with-lease`).
4. 충돌이 나면 **양쪽 변경을 모두 살려서** 합치기. 한쪽을 통째로 버리지 않기.
5. 파일을 통째로 새로 쓰지 말고 **필요한 부분만 고치기**. 내가 만들지 않은 기능·문구·색을 함부로 되돌리지 않기.
6. 고치려는 기능이 최근에 바뀌었는지 `CHANGELOG.md`와 `git log -- <파일>`로 먼저 확인하기.

## 2. 수정 내역 기록
- 변경할 때마다 **`CHANGELOG.md` 맨 위 날짜 아래에 한 줄** 추가 (사용자 입장에서, 한국어).
- 커밋 메시지·PR 설명도 한국어로, 무엇이 왜 바뀌었는지 적기.

## 3. 올리기 전 확인
```bash
npm ci                 # 처음 한 번 (엑셀 읽기 부품은 vendor/ 안의 파일을 씀)
npm run lint           # 코드 검사
npx vitest run         # 단위 테스트
npx playwright test    # 화면(e2e) 테스트 — 화면을 바꿨으면 꼭
```
- 테스트가 실패하면 **테스트를 지우거나 건너뛰지 말고** 원인을 고치기. 화면 문구·구조를 일부러 바꿨다면 테스트를 그에 맞게 고치기.
- e2e 는 `e2e/helpers.js`의 `openApp()`을 씀 (첫 화면은 지나간 상태로 시작, `intro: true`면 처음 사용자처럼).

## 4. 절대 하지 말 것
- 비밀값(Firebase 서비스 계정 JSON, 카카오 REST 키·Client Secret, 서명 키, 애플 키 등)을 코드·대화·커밋에 넣지 않기 → GitHub Secrets 에만.
- 실제 근무표 사진·엑셀(동료 실명 포함)을 저장소에 올리지 않기.
- 공개 페이지(`public/privacy.html` 등)에 운영자 개인 이메일 넣지 않기.
- 저작권 있는 사진·브랜드 로고를 앱에 넣지 않기 (첫 화면 기본 배경은 직접 그린 SVG).

## 5. 지금 디자인 기준 (바꾸려면 사용자와 먼저 확인)
- 글꼴: **Pretendard** 기본 (설정 › 꾸미기에서 변경 가능). 굵기: 제목 700 · 근무 코드 600 · 날짜 500 · 본문 400.
- 앱 색: 블루 기본 (`src/lib/accentPref.js`, 코드 전체의 `blue`/`indigo` 색 변수를 바꿔 끼우는 방식).
- 근무 기본 색: `src/lib/shiftTypes.js` (D `#E0EDF9` · E `#F9E9DC` · N `#EBE6F7` · OFF `#EAECE9`).
- 내 근무 화면: 맨 위 "2026년 10월 ⌄" → 달력(날짜 16px 아래 직사각형 근무 칩, 오늘은 세이지색 상자 `.today-cell`) → 근무 수 카드 → 오늘 한마디.
- 첫 화면: `src/components/IntroScreen.jsx` — 로그인 전에는 열 때마다, 로그인한 폰은 안 보임.
- 수당: 근무 1회 수당 × 횟수만 (`src/lib/allowance.js` `shiftAllowance`). 계약 나이트 개수 기준·시급 계산은 넣지 않기로 함.
- 캐릭터: `src/components/Mascot.jsx` (하얀 북극곰 얼굴 토닥이, SVG · 기본/응원/휴식 표정).

## 6. 구조 한눈에
- 화면: `src/App.jsx`(머리글·탭·동기화), `src/components/*Tab.jsx`(내 근무·수당·그룹·설정)
- 데이터: 이 기기 `localStorage` + 서버(Supabase, `src/lib/shiftApi.js`). 날짜 메모는 한 줄 = 일정 하나 (`src/lib/dayItems.js`)
- 앱: Capacitor (안드로이드 `android/`, 아이폰 `ios/`) — 네이티브 알람·위젯 코드 포함
- 배포: master 에 머지되면 Vercel(웹) 자동 배포 + 안드로이드 APK 빌드. 사용자가 할 일 목록은 `docs/OWNER_TODO.md`
