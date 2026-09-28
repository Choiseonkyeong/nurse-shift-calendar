// 웹(PWA) 오프라인 지원: 앱 화면과 빌드 파일을 캐시해 인터넷 없이도 열리게 함
// (근무 데이터는 기기 localStorage 에 있고, 서버 동기화는 온라인이 되면 앱이 처리)
const CACHE = 'nurse-shift-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const putCache = (req, res) => {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // 페이지: 네트워크 우선(최신 배포), 오프라인이면 캐시
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => putCache('/', res))
        .catch(() => caches.match('/'))
    );
    return;
  }

  // 해시가 붙은 빌드 파일: 캐시 우선 (내용이 바뀌면 파일명이 바뀜)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => putCache(req, res))));
    return;
  }

  // 그 외(아이콘, 사진 인식 엔진 등): 캐시 먼저 보여주고 뒤에서 갱신
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => putCache(req, res))
        .catch(() => hit);
      return hit || network;
    })
  );
});

// ---------------- 웹 푸시 (근무 시작 알림) ----------------
// 서버(FCM)가 보낸 메시지: { notification: { title, body }, data: {...} }
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { notification: { title: '근무 알림', body: event.data ? event.data.text() : '' } };
  }
  const n = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(
    self.registration.showNotification(n.title || data.title || '근무 알림', {
      body: n.body || data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.work_date ? `shift-${data.work_date}` : 'shift-reminder',
      data: { url: '/' }
    })
  );
});

// 알림을 누르면 열려 있는 앱 창으로 이동, 없으면 새로 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus();
      return self.clients.openWindow(url);
    })
  );
});
