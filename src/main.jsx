import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // 👈 main.jsx와 App.jsx가 둘 다 src 폴더 안에 있을 때
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import { applyTheme, watchSystemTheme } from './lib/theme'
import { handleWebOAuthReturn, listenNativeOAuth } from './lib/socialAuth'
import { installUpdateGuard } from './lib/appUpdate'

// 첫 화면 전에 테마 적용 (깜빡임 방지)
applyTheme()
watchSystemTheme()

const render = () =>
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )

// 새 버전 배포 후 오래 열린 탭: 돌아올 때 새 버전 확인, 파일 로드 실패 시 새로고침
installUpdateGuard()

// 카카오·구글 로그인에서 돌아온 경우: 세션·데이터 정리를 먼저 끝내고 화면 그리기
listenNativeOAuth().catch((err) => console.warn('소셜 로그인 복귀 대기 실패', err))
handleWebOAuthReturn()
  .catch((err) => console.warn('소셜 로그인 처리 실패', err))
  .finally(render)

// 웹(PWA): 설치·오프라인 실행용 서비스 워커. 네이티브 앱은 파일이 앱에 포함돼 있어 불필요
if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('서비스 워커 등록 실패', err));
  });
}
