// src/lib/appUpdate.js
// 새 버전 배포 후 오래 열려 있던 웹 탭 대응
//  - 빌드 파일 이름에 해시가 붙어 있어서, 배포 전 화면이 나중에 필요한 파일(사진 인식·탭 화면 등)을 부르면
//    이미 없는 파일이라 실패함 ("Failed to fetch dynamically imported module")
//  - 예방: 탭으로 돌아올 때 새 버전이 있으면 조용히 새로고침 (데이터는 기기·서버에 있어 그대로)
//  - 복구: 그래도 파일을 못 불러오면 한 번 새로고침 → 같은 탭으로 돌아와 "업데이트됨, 다시 시도" 안내
//  - 앱(APK·iOS)은 파일이 앱 안에 있어 해당 없음

const RELOAD_AT_KEY = 'app_update_reload_at';
const RESUME_KEY = 'app_update_resume'; // { tab, notice }
export const UPDATE_NOTICE = '✨ 앱이 최신 버전으로 업데이트됐어요. 방금 하던 작업(파일 올리기 등)을 다시 해 주세요.';

export function isChunkLoadError(err) {
  const msg = String(err?.message || err || '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed|ChunkLoadError|Unable to preload CSS/i.test(msg);
}

let currentTab = null;
/** 새로고침 후 돌아올 탭 기억용 (App 이 탭을 바꿀 때 알려 줌) */
export const setResumeTab = (tab) => {
  currentTab = tab;
};

/**
 * 새 버전으로 새로고침 (30초 안에 두 번은 하지 않음 → 무한 새로고침 방지)
 * @param notice 새로고침 후 보여줄 안내 (없으면 조용히)
 * @returns 새로고침했으면 true
 */
let reloading = false;
export function reloadForUpdate(notice = '') {
  if (reloading) {
    // 이미 새로고침 중 (다른 처리기가 먼저 시작) → 안내 문구만 덧붙임
    if (notice) {
      try {
        sessionStorage.setItem(RESUME_KEY, JSON.stringify({ tab: currentTab, notice }));
      } catch (e) {
        /* 무시 */
      }
    }
    return true;
  }
  try {
    const last = Number(sessionStorage.getItem(RELOAD_AT_KEY)) || 0;
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ tab: currentTab, notice }));
  } catch (e) {
    /* 저장 실패해도 새로고침은 진행 */
  }
  reloading = true;
  window.location.reload();
  return true;
}

/** 새로고침 직후 한 번: { tab, notice } | null */
export function consumeResume() {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/** React.lazy 용: 화면 파일을 못 불러오면 새 버전으로 새로고침 (그동안은 로딩 표시 유지) */
export const lazyImport = (load) => () =>
  load().catch((err) => {
    if (isChunkLoadError(err) && reloadForUpdate(UPDATE_NOTICE)) return new Promise(() => {});
    throw err;
  });

// 화면의 시작 파일: <script type="module" src="/assets/index-해시.js"> (미리 불러오는 다른 index-*.js 와 구분)
const mainScript = (html) => (html.match(/<script[^>]*type="module"[^>]*src="(\/assets\/[^"]+\.js)"/) || [])[1] || null;

/** 서버의 최신 화면이 지금 화면과 다른지 (다르면 새 배포가 있음) */
export async function hasNewVersion(fetchImpl = fetch, doc = document) {
  const src = doc.querySelector('script[type="module"][src^="/assets/"]')?.getAttribute('src');
  const current = src ? mainScript(`<script type="module" src="${src}">`) : null;
  if (!current) return false; // 개발 서버 등
  const res = await fetchImpl(`/?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return false;
  const latest = mainScript(await res.text());
  return Boolean(latest && latest !== current);
}

/** 웹에서만: 탭으로 돌아올 때 새 버전 확인 + 파일 로드 실패 시 복구 */
export function installUpdateGuard() {
  if (window.Capacitor?.isNativePlatform?.()) return;

  // Vite 가 미리 불러오기(preload)에 실패했을 때
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForUpdate(UPDATE_NOTICE)) event.preventDefault();
  });
  // 처리되지 않은 파일 로드 실패
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) reloadForUpdate(UPDATE_NOTICE);
  });

  let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    hasNewVersion()
      .then((changed) => changed && reloadForUpdate())
      .catch(() => {}); // 오프라인 등은 무시
  });
}
