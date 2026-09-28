import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // 👈 main.jsx와 App.jsx가 둘 다 src 폴더 안에 있을 때
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// 웹(PWA): 설치·오프라인 실행용 서비스 워커. 네이티브 앱은 파일이 앱에 포함돼 있어 불필요
if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('서비스 워커 등록 실패', err));
  });
}
