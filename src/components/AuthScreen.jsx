import React, { useState, useEffect } from 'react';
import { CalendarHeart, Loader2, WifiOff } from 'lucide-react';
import { startSocialLogin } from '../lib/auth';

const KakaoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#191919"
      d="M12 3C6.48 3 2 6.54 2 10.9c0 2.83 1.88 5.3 4.7 6.7-.2.72-.74 2.64-.85 3.05-.13.5.19.5.39.36.16-.1 2.53-1.72 3.55-2.42.72.1 1.46.16 2.21.16 5.52 0 10-3.54 10-7.9S17.52 3 12 3z"
    />
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/**
 * 첫 실행 로그인/회원가입 화면
 * - 처음 로그인하면 자동으로 회원가입(프로필 생성)
 * - 기존 사용자는 소셜 계정이 기존 데이터에 연결됨
 */
export default function AuthScreen({ errorMessage, onContinueOffline }) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);

  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const handleLogin = async (provider) => {
    setError('');
    setPending(provider);
    try {
      await startSocialLogin(provider);
      // 웹은 소셜 로그인 페이지로 이동, 앱은 인앱 브라우저가 열림 → 돌아오면 세션 변경으로 화면 전환
    } catch (err) {
      setError(err.message || '로그인을 시작하지 못했습니다.');
    } finally {
      setPending(null);
    }
  };

  const message = error || errorMessage;

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pt-16 pb-10 bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="space-y-6 text-center">
        <div className="mx-auto w-20 h-20 rounded-3xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
          <CalendarHeart size={40} strokeWidth={2.2} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">근무표 & 메이트</h1>
          <p className="text-sm font-bold text-slate-500 leading-relaxed">
            교대근무 일정, 수당 정산, 동료 근무 비교를
            <br />한 곳에서 관리하세요.
          </p>
        </div>

        <div className="flex justify-center gap-1.5 pt-2">
          {[
            ['D', '#FEF08A', '#854D0E'],
            ['E', '#FFEDD5', '#9A3412'],
            ['N', '#E0F2FE', '#0369A1'],
            ['OFF', '#F1F5F9', '#475569']
          ].map(([code, bg, fg]) => (
            <span key={code} style={{ backgroundColor: bg, color: fg }} className="px-3 py-1 rounded-full text-xs font-black">
              {code}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {message && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-bold text-rose-600 text-center">
            {message}
          </div>
        )}

        <button
          type="button"
          disabled={!!pending || offline}
          onClick={() => handleLogin('kakao')}
          style={{ backgroundColor: '#FEE500', color: '#191919' }}
          className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xs transition hover:brightness-95 disabled:opacity-60 cursor-pointer"
        >
          {pending === 'kakao' ? <Loader2 size={18} className="animate-spin" /> : <KakaoIcon />}
          카카오로 시작하기
        </button>

        <button
          type="button"
          disabled={!!pending || offline}
          onClick={() => handleLogin('google')}
          className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-white text-slate-800 border border-slate-200 shadow-xs transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
        >
          {pending === 'google' ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
          Google로 시작하기
        </button>

        {offline && (
          <div className="pt-1 space-y-2 text-center">
            <p className="text-xs font-bold text-slate-400 flex items-center justify-center gap-1">
              <WifiOff size={13} /> 인터넷에 연결되어 있지 않습니다.
            </p>
            <button
              type="button"
              onClick={onContinueOffline}
              className="text-xs font-black text-indigo-600 underline cursor-pointer"
            >
              오프라인으로 계속하기
            </button>
          </div>
        )}

        <p className="text-[11px] font-bold text-slate-400 text-center leading-relaxed pt-1">
          처음 로그인하면 자동으로 회원가입됩니다.
          <br />기존에 쓰던 근무표는 로그인 후에도 그대로 유지됩니다.
        </p>
      </div>
    </div>
  );
}
