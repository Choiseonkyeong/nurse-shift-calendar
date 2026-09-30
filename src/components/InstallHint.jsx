import React, { useEffect, useState } from 'react';
import { Smartphone, X, ExternalLink, Download, Share } from 'lucide-react';
import { INSTALL_HINT_KEY, currentInstallEnv, kakaoExternalUrl, subscribeInstallPrompt, promptInstall } from '../lib/installHint';

const readDismissed = () => {
  try {
    return localStorage.getItem(INSTALL_HINT_KEY) === '1';
  } catch (e) {
    return false;
  }
};

// 조사까지 포함 (크롬으로 / 사파리로)
const openWith = (env) => (env === 'kakao-ios' ? '사파리로 열기' : '크롬으로 열기');

/** 카카오톡 안 브라우저에서 열렸을 때: 크롬·사파리로 열기 버튼 (첫 화면에서도 사용) */
export function KakaoOpenExternal({ strong = false }) {
  const env = currentInstallEnv();
  if (env !== 'kakao-android' && env !== 'kakao-ios') return null;
  return (
    <a
      href={kakaoExternalUrl(window.location.href)}
      className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-2xl text-xs font-black ${strong ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-900'}`}
    >
      <ExternalLink size={14} /> {openWith(env)}
    </a>
  );
}

/**
 * 홈 화면에 추가 안내 (웹에서만, 닫으면 다시 안 뜸)
 * @param accountLinked  계정 연결 여부 — 카카오톡에서 쓰던 데이터를 크롬으로 옮기려면 계정이 필요
 * @param hasData        이 브라우저에 근무가 있는지
 */
export default function InstallHint({ accountLinked, hasData, onLinkAccount }) {
  const [env] = useState(currentInstallEnv);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [canPrompt, setCanPrompt] = useState(false);
  useEffect(() => subscribeInstallPrompt(setCanPrompt), []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(INSTALL_HINT_KEY, '1');
    } catch (e) {
      /* 저장 불가 브라우저 */
    }
  };

  const kakao = env === 'kakao-android' || env === 'kakao-ios';
  if (dismissed || env === 'installed') return null;
  if (!kakao && env !== 'ios' && !canPrompt) return null;

  const browser = env === 'kakao-ios' ? '사파리' : '크롬';
  return (
    <div className="mb-4 p-4 rounded-3xl bg-amber-50 border border-amber-100 space-y-2" role="region" aria-label="홈 화면에 추가 안내">
      <div className="flex items-start gap-2">
        <Smartphone size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-xs font-bold text-amber-900 space-y-1">
          {kakao ? (
            <>
              <p className="font-black">카카오톡 안에서 열렸어요</p>
              <p className="text-amber-800/80">
                카카오톡에서는 홈 화면에 추가할 수 없어요. {env === 'kakao-ios' ? '사파리로' : '크롬으로'} 열어서 홈 화면에 추가하면 앱처럼 쓸 수 있어요.
              </p>
              {hasData && !accountLinked && (
                <p className="text-amber-800/80">
                  {browser}에서는 새로 시작돼요. 지금 근무를 그대로 옮기려면 먼저{' '}
                  <button type="button" onClick={onLinkAccount} className="underline font-black text-amber-900 cursor-pointer">
                    계정을 연결
                  </button>
                  하고 {browser}에서 로그인하세요.
                </p>
              )}
            </>
          ) : env === 'ios' ? (
            <>
              <p className="font-black">홈 화면에 추가하면 앱처럼 쓸 수 있어요</p>
              <p className="text-amber-800/80 flex items-center gap-1 flex-wrap">
                아래 공유 버튼 <Share size={12} className="inline" /> → &apos;홈 화면에 추가&apos;를 눌러 주세요.
              </p>
            </>
          ) : (
            <p className="font-black">홈 화면에 설치하면 앱처럼 바로 열 수 있어요</p>
          )}
        </div>
        <button type="button" onClick={dismiss} className="text-amber-400 hover:text-amber-600 cursor-pointer shrink-0" aria-label="안내 닫기">
          <X size={16} />
        </button>
      </div>
      {kakao && (
        <>
          <KakaoOpenExternal strong />
          <p className="text-[10px] font-bold text-amber-700/70 text-center">
            안 열리면 카카오톡 화면의 ⋮ 또는 ··· 메뉴 → &apos;다른 브라우저로 열기&apos;
          </p>
        </>
      )}
      {!kakao && canPrompt && (
        <button
          type="button"
          onClick={async () => {
            if (await promptInstall()) dismiss();
          }}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-2xl bg-amber-500 text-white text-xs font-black cursor-pointer"
        >
          <Download size={14} /> 홈 화면에 설치
        </button>
      )}
    </div>
  );
}
