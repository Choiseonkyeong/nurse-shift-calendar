import React, { useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, AlertTriangle } from 'lucide-react';
import { getSupabase } from '../supabaseClient';
import { clearLocalAccountData, friendlyAuthError } from '../lib/account';

/**
 * 인증 메일 링크로 웹 페이지가 열렸을 때 보이는 화면
 *  - 이메일 인증: 완료 안내 (서버에서 이미 인증됨) → 앱으로 돌아가 [인증 확인]
 *  - 비밀번호 재설정: 새 비밀번호 입력
 */
export default function AuthLanding({ type, onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const resetPassword = async () => {
    setBusy(true);
    setError('');
    try {
      // 주소(#)의 인증 토큰으로 재설정 세션이 만들어짐
      const supabase = await getSupabase();
      await supabase.auth.getSession();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      // 이 브라우저는 로그아웃 (앱에서 새 비밀번호로 로그인)
      await supabase.auth.signOut({ scope: 'local' });
      clearLocalAccountData();
      setDone(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  // 앱 화면처럼: 흰 바탕, 가운데 아이콘·제목·설명, 아래 큰 버튼
  const box = (icon, title, body, action) => (
    <div className="min-h-[100dvh] bg-white flex flex-col px-6 pt-[calc(var(--safe-top)+15vh)] pb-[calc(var(--safe-bottom)+24px)]">
      <div className="flex-1 w-full max-w-sm mx-auto text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">{icon}</div>
        <h1 className="pt-2 text-[22px] font-bold text-slate-900">{title}</h1>
        <div className="text-[15px] text-slate-500 leading-relaxed space-y-3">{body}</div>
      </div>
      <div className="w-full max-w-sm mx-auto">{action}</div>
    </div>
  );

  const btnCls = 'w-full h-14 rounded-2xl bg-blue-600 text-white text-[16px] font-semibold disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5';
  const continueBtn = (
    <button onClick={onDone} className={btnCls}>
      웹에서 근무표 열기
    </button>
  );

  if (type === 'error') {
    return box(
      <AlertTriangle size={30} />,
      '링크가 만료되었어요',
      <p>인증 링크는 한 번만, 일정 시간 안에만 쓸 수 있어요. 앱에서 메일을 다시 받아 주세요.</p>,
      continueBtn
    );
  }

  if (type === 'recovery') {
    if (done) {
      return box(<CheckCircle2 size={30} />, '비밀번호를 바꿨어요', <p>앱의 [계정 → 기존 계정으로 로그인]에서 새 비밀번호로 로그인해 주세요.</p>, continueBtn);
    }
    return box(
      <KeyRound size={30} />,
      '새 비밀번호 설정',
      <>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-14 px-4 bg-slate-50 rounded-2xl text-[16px] text-slate-900 outline-none focus:ring-2 focus:ring-blue-200"
        />
        {error && <p className="text-[14px] text-rose-500">{error}</p>}
      </>,
      <button
        onClick={resetPassword}
        disabled={busy || password.length < 6}
        className={btnCls}
      >
        {busy && <Loader2 size={18} className="animate-spin" />} 비밀번호 바꾸기
      </button>
    );
  }

  return box(
    <CheckCircle2 size={30} />,
    '이메일 인증 완료',
    <p>앱으로 돌아가 [계정] 화면에서 [인증 확인]을 누른 뒤 비밀번호를 정해 주세요.</p>,
    continueBtn
  );
}
