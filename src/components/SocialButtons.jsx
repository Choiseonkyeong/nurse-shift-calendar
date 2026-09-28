import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchEnabledProviders, startSocialAuth } from '../lib/socialAuth';

let providersPromise = null;
const loadProviders = () => {
  if (!providersPromise) {
    providersPromise = fetchEnabledProviders().then((list) => {
      if (!list.length) providersPromise = null; // 서버 설정 전이거나 오프라인 → 다음에 다시 확인
      return list;
    });
  }
  return providersPromise;
};

const LOGOS = {
  kakao: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.52 2 10.86c0 2.8 1.87 5.26 4.68 6.65l-.95 3.5c-.08.3.26.54.52.37l4.17-2.76c.52.06 1.04.1 1.58.1 5.52 0 10-3.52 10-7.86S17.52 3 12 3z"
      />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
};

/**
 * 카카오 / Google 버튼 (Supabase 에서 켜 둔 것만 표시)
 * @param mode 'link' = 지금 계정에 연결 | 'login' = 그 계정으로 로그인
 * @param verb 버튼 문구 끝말 (예: '계정 연결', '로그인', '시작')
 * @param beforeStart 시작 전 확인. false 를 돌려주면 취소
 */
export default function SocialButtons({ mode, verb, beforeStart, onError, disabled = false, exclude = [] }) {
  const [providers, setProviders] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    loadProviders().then((list) => alive && setProviders(list));
    return () => {
      alive = false;
    };
  }, []);

  const shown = providers.filter((p) => !exclude.includes(p.id));
  if (!shown.length) return null;

  const start = async (provider) => {
    if (beforeStart && beforeStart() === false) return;
    setBusy(provider);
    try {
      await startSocialAuth(provider, mode);
      // 웹은 페이지가 이동하고, 앱은 브라우저에서 돌아오면 새로고침됨
    } catch (err) {
      onError?.(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      {shown.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => start(p.id)}
          disabled={disabled || Boolean(busy)}
          style={{ backgroundColor: p.bg, color: p.fg }}
          className={`w-full py-2.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
            p.border ? 'border border-slate-300' : ''
          }`}
        >
          {busy === p.id ? <Loader2 size={15} className="animate-spin" /> : LOGOS[p.id]}
          {p.label}로 {verb}
        </button>
      ))}
    </div>
  );
}
