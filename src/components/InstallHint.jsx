import React, { useEffect, useState } from 'react';
import { Smartphone, X, ExternalLink, Download, Share, Copy } from 'lucide-react';
import { INSTALL_HINT_KEY, currentInstallEnv, externalOpenUrl, inAppName, isInAppEnv, subscribeInstallPrompt, promptInstall } from '../lib/installHint';
import { toast } from '../lib/toast';

const readDismissed = () => {
  try {
    return localStorage.getItem(INSTALL_HINT_KEY) === '1';
  } catch (e) {
    return false;
  }
};

const isIos = (env) => env.endsWith('-ios');
// 조사까지 포함 (크롬으로 / 사파리로)
const openWith = (env) => (isIos(env) ? '사파리로 열기' : '크롬으로 열기');
const appNameOf = () => inAppName(navigator.userAgent || '') || '이 앱';

async function copyAddress() {
  const href = window.location.href;
  try {
    await navigator.clipboard.writeText(href);
    toast('주소를 복사했어요. 사파리 주소창에 붙여넣어 열어 주세요.', 'success');
  } catch (e) {
    window.prompt('아래 주소를 길게 눌러 복사해 사파리에서 열어 주세요.', href);
  }
}

/**
 * 앱 안 브라우저(카카오톡·밴드·네이버 앱 등)에서 열렸을 때: 크롬·사파리로 열기 버튼 (첫 화면에서도 사용)
 * 아이폰 앱 안 브라우저(카카오톡 제외)는 바로 여는 방법이 없어 주소 복사
 */
export function KakaoOpenExternal({ strong = false }) {
  const env = currentInstallEnv();
  if (!isInAppEnv(env)) return null;
  const cls = `flex items-center justify-center gap-1.5 w-full h-11 rounded-xl text-[14px] font-semibold ${strong ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`;
  const href = externalOpenUrl(env, window.location.href);
  if (!href) {
    return (
      <button type="button" onClick={copyAddress} className={`${cls} cursor-pointer`}>
        <Copy size={14} /> 주소 복사
      </button>
    );
  }
  return (
    <a href={href} className={cls}>
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

  const kakao = isInAppEnv(env); // 카카오톡·밴드·네이버 앱 등 앱 안 브라우저
  if (dismissed || env === 'installed') return null;
  if (!kakao && env !== 'ios' && !canPrompt) return null;

  const browser = isIos(env) ? '사파리' : '크롬';
  const app = kakao ? appNameOf() : '';
  return (
    <div className="mb-4 p-4 rounded-2xl bg-slate-50 space-y-3" role="region" aria-label="홈 화면에 추가 안내">
      <div className="flex items-start gap-2">
        <Smartphone size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-[13px] text-slate-500 space-y-1">
          {kakao ? (
            <>
              <p className="text-[15px] font-semibold text-slate-900">{app} 안에서 열렸어요</p>
              <p>
                {app}에서는 홈 화면에 추가할 수 없어요. {isIos(env) ? '사파리로' : '크롬으로'} 열어서 홈 화면에 추가하면 앱처럼 쓸 수 있어요.
              </p>
              {hasData && !accountLinked && (
                <p>
                  {browser}에서는 새로 시작돼요. 지금 근무를 그대로 옮기려면 먼저{' '}
                  <button type="button" onClick={onLinkAccount} className="underline font-semibold text-blue-700 cursor-pointer">
                    계정을 연결
                  </button>
                  하고 {browser}에서 로그인하세요.
                </p>
              )}
            </>
          ) : env === 'ios' ? (
            <>
              <p className="text-[15px] font-semibold text-slate-900">홈 화면에 추가하면 앱처럼 쓸 수 있어요</p>
              <p className="flex items-center gap-1 flex-wrap">
                아래 공유 버튼 <Share size={12} className="inline" /> → &apos;홈 화면에 추가&apos;를 눌러 주세요.
              </p>
            </>
          ) : (
            <p className="text-[15px] font-semibold text-slate-900">홈 화면에 설치하면 앱처럼 바로 열 수 있어요</p>
          )}
        </div>
        <button type="button" onClick={dismiss} className="w-8 h-8 -mr-1 -mt-1 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-100 cursor-pointer shrink-0" aria-label="안내 닫기">
          <X size={18} />
        </button>
      </div>
      {kakao && (
        <>
          <KakaoOpenExternal strong />
          <p className="text-[12px] text-slate-400 text-center">
            {env === 'inapp-ios'
              ? `${app} 화면의 ··· 메뉴 → 'Safari로 열기'가 있으면 그걸 눌러도 돼요`
              : `안 열리면 ${app} 화면의 ⋮ 또는 ··· 메뉴 → '다른 브라우저로 열기'`}
          </p>
        </>
      )}
      {!kakao && canPrompt && (
        <button
          type="button"
          onClick={async () => {
            if (await promptInstall()) dismiss();
          }}
          className="flex items-center justify-center gap-1.5 w-full h-11 rounded-xl bg-blue-600 text-white text-[14px] font-semibold cursor-pointer"
        >
          <Download size={14} /> 홈 화면에 설치
        </button>
      )}
    </div>
  );
}
