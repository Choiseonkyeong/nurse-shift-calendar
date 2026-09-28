import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import SocialButtons from './SocialButtons';
import { PROVIDERS } from '../lib/socialAuth';
import { X, ShieldCheck, Mail, KeyRound, LogIn, Loader2, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import {
  getAccountInfo,
  linkEmail,
  setPassword,
  signInWithEmail,
  sendPasswordReset,
  deleteMyAccount,
  friendlyAuthError
} from '../lib/account';

const inputCls =
  'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-400';
const primaryBtn =
  'w-full py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5';

/**
 * 계정 연결 / 기존 계정 로그인
 * @param online  서버 연결 여부 (profile 존재)
 * @param initialMode 'link' | 'login'
 */
export default function AccountModal({ online, userName, initialMode = 'link', initialMessage = null, onClose, onStatusChange }) {
  const [mode, setMode] = useState(initialMode);
  const [info, setInfo] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPasswordValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage); // { type: 'error'|'ok', text }

  const refresh = async (opts) => {
    try {
      const next = await getAccountInfo(opts);
      setInfo(next);
      onStatusChange?.(next.status);
      return next;
    } catch (err) {
      setMessage({ type: 'error', text: friendlyAuthError(err) });
      return null;
    }
  };

  useEffect(() => {
    if (online) refresh();
    // 창을 열 때 1회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const run = async (fn) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ type: 'error', text: friendlyAuthError(err) });
    } finally {
      setBusy(false);
    }
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleLink = () =>
    run(async () => {
      await linkEmail(email);
      const next = await refresh({ refresh: true });
      setMessage({
        type: 'ok',
        text:
          next?.status === 'needs_password'
            ? '이메일이 연결되었어요. 로그인에 쓸 비밀번호를 정해 주세요.'
            : `${email.trim()} 으로 인증 메일을 보냈어요. 메일의 링크를 누른 뒤 아래 [인증 확인]을 눌러 주세요.`
      });
    });

  const handleCheck = () =>
    run(async () => {
      const next = await refresh({ refresh: true });
      if (next?.status === 'pending') setMessage({ type: 'error', text: '아직 인증 전이에요. 메일함(스팸함 포함)의 링크를 눌러 주세요.' });
    });

  const handleSetPassword = () =>
    run(async () => {
      await setPassword(password);
      setPasswordValue('');
      await refresh();
      setMessage({ type: 'ok', text: '계정 연결이 끝났어요. 새 폰에서는 이 이메일과 비밀번호로 로그인하면 돼요.' });
    });

  const confirmReplace = () =>
    !userName || // 첫 실행이면 지울 데이터가 없음
    window.confirm(
      '이 기기에 있는 근무·메모는 지워지고 로그인한 계정의 데이터로 바뀝니다.\n(필요하면 먼저 [백업 파일 저장]을 해 두세요)\n\n로그인할까요?'
    );
  const socialError = (err) => setMessage({ type: 'error', text: friendlyAuthError(err) });
  const socialLabel = (ids) => ids.map((id) => PROVIDERS.find((p) => p.id === id)?.label || id).join('·');

  const handleLogin = () =>
    run(async () => {
      if (!confirmReplace()) return;
      await signInWithEmail(email, password, userName);
      window.location.reload();
    });

  const handleReset = () =>
    run(async () => {
      await sendPasswordReset(email);
      setMessage({ type: 'ok', text: '비밀번호 재설정 메일을 보냈어요. 메일의 링크에서 새 비밀번호를 정한 뒤 로그인해 주세요.' });
    });

  // 계정 삭제: '삭제' 를 직접 입력해야 진행 (실수 방지)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const handleDeleteAccount = () =>
    run(async () => {
      await deleteMyAccount();
      window.location.reload();
    });

  const status = info?.status;

  return (
    <Modal onClose={onClose} label="계정">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl border border-slate-100 max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-base text-slate-900 flex items-center gap-1.5">
            <ShieldCheck size={17} className="text-indigo-600" /> 계정
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl text-xs font-black">
          {[
            ['link', '이 기기 계정 지키기'],
            ['login', '기존 계정으로 로그인']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setMessage(null);
              }}
              className={`py-2 rounded-xl cursor-pointer ${mode === key ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {!online && mode === 'link' ? (
          <p className="text-xs font-bold text-amber-700 bg-amber-50 rounded-2xl p-3">
            서버에 연결되지 않았어요. 인터넷 연결 후 다시 열어 주세요.
          </p>
        ) : mode === 'link' ? (
          <div className="space-y-3">
            {!info && (
              <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" /> 계정 확인 중...
              </p>
            )}

            {status === 'anonymous' && (
              <>
                <p className="text-xs font-bold text-slate-600 bg-amber-50 border border-amber-100 rounded-2xl p-3 flex gap-2">
                  <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  지금은 이 기기에만 묶인 임시 계정이에요. 앱을 지우거나 폰을 바꾸면 근무·그룹에 다시 들어올 수 없어요. 카카오·Google 계정이나 이메일을 연결해 두세요.
                </p>
                <SocialButtons mode="link" verb="계정 연결" disabled={busy} onError={socialError} />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="이메일 주소"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
                <button type="button" onClick={handleLink} disabled={busy || !validEmail} className={primaryBtn}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} 인증 메일 보내기
                </button>
              </>
            )}

            {status === 'pending' && (
              <>
                <p className="text-xs font-bold text-slate-600 bg-indigo-50 rounded-2xl p-3">
                  <b>{info.pendingEmail}</b> 으로 보낸 인증 메일의 링크를 눌러 주세요. 링크가 웹 페이지로 열려도 괜찮아요. 누른 뒤 여기로 돌아와 [인증 확인]을 눌러 주세요.
                </p>
                <button type="button" onClick={handleCheck} disabled={busy} className={primaryBtn}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} 인증 확인
                </button>
                <button
                  type="button"
                  onClick={() => setInfo({ ...info, status: 'anonymous' })}
                  className="w-full text-[11px] font-bold text-slate-400 underline cursor-pointer"
                >
                  다른 이메일로 다시 보내기
                </button>
              </>
            )}

            {status === 'linked' && info.social?.length > 0 && (
              <p className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-2xl p-3 flex gap-2">
                <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                <span>
                  <b>{socialLabel(info.social)}</b> 계정에 연결되어 있어요{info.email ? ` (${info.email})` : ''}. 새 폰에서는 [기존 계정으로 로그인 → {socialLabel(info.social.slice(0, 1))}로 로그인]을 누르면 돼요.
                </span>
              </p>
            )}

            {(status === 'needs_password' || status === 'linked') && !info.social?.length && (
              <>
                <p className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-2xl p-3 flex gap-2">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span>
                    <b>{info.email}</b> 계정에 연결되어 있어요.
                    {status === 'linked' ? ' 새 폰에서는 [기존 계정으로 로그인]을 이용하세요.' : ' 로그인에 쓸 비밀번호를 정해 주세요.'}
                  </span>
                </p>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={status === 'linked' ? '새 비밀번호 (변경할 때만)' : '비밀번호 (6자 이상)'}
                  value={password}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  className={inputCls}
                />
                <button type="button" onClick={handleSetPassword} disabled={busy || password.length < 6} className={primaryBtn}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                  {status === 'linked' ? '비밀번호 변경' : '비밀번호 설정'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500">
              다른 폰에서 연결해 둔 계정으로 로그인하면 근무·메모·그룹을 그대로 불러와요.
            </p>
            <SocialButtons mode="login" verb="로그인" disabled={busy} beforeStart={confirmReplace} onError={socialError} />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              className={inputCls}
            />
            <button type="button" onClick={handleLogin} disabled={busy || !validEmail || !password} className={primaryBtn}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />} 로그인
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={busy || !validEmail}
              className="w-full text-[11px] font-bold text-slate-400 underline disabled:opacity-40 cursor-pointer"
            >
              비밀번호를 잊었어요 (재설정 메일 받기)
            </button>
          </div>
        )}

        {online && mode === 'link' && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            {!deleteOpen ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="w-full text-[11px] font-bold text-slate-400 hover:text-rose-500 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} /> 계정 삭제
              </button>
            ) : (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 space-y-2">
                <p className="text-xs font-bold text-rose-700">
                  계정과 서버의 모든 데이터(근무·메모·근무 종류·설정·그룹 참여·게시글·교환 요청)가 삭제되고 되돌릴 수 없어요.
                  필요하면 먼저 [등록 → 백업 저장]을 해 두세요.
                </p>
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="확인을 위해 '삭제' 입력"
                  aria-label="계정 삭제 확인"
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeleteConfirm('');
                    }}
                    className="flex-1 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-black text-slate-600 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={busy || deleteConfirm.trim() !== '삭제'}
                    className="flex-1 py-2 rounded-2xl bg-rose-600 text-white text-xs font-black disabled:opacity-40 cursor-pointer"
                  >
                    영구 삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener"
          className="block text-center text-[11px] font-bold text-slate-400 underline"
        >
          개인정보처리방침
        </a>

        {message && (
          <p
            role="status"
            className={`text-xs font-bold rounded-2xl p-3 ${message.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </Modal>
  );
}
