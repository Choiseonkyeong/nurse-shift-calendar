import React, { useState } from 'react';
import { errorText } from '../lib/errorText';
import Modal from './Modal';
import SocialButtons from './SocialButtons';
import { KakaoOpenExternal } from './InstallHint';
import { currentInstallEnv, inAppName, isInAppEnv } from '../lib/installHint';

/**
 * 첫 실행: 이름 입력 (그룹 멤버에게 보이는 이름) — 비워 두고 바로 시작할 수 있음
 * groupMode: 그룹을 만들거나 참여할 때 이름이 아직 없으면 묻는 창 (필수)
 */
export default function NameSetup({ onSubmit, onLogin, onCancel, initialName = '', confirmMode = false, groupMode = false }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const trimmed = name.trim();

  const submit = (e) => {
    e.preventDefault();
    // 첫 실행은 이름 없이 시작 가능 (나중에 그룹 쓸 때 정하면 됨)
    if (trimmed || (!confirmMode && !groupMode)) onSubmit(trimmed.slice(0, 30));
  };
  const required = confirmMode || groupMode;

  return (
    <Modal align="center" label="이름 입력" zIndex={110} onClose={groupMode ? onCancel : undefined}>
      <form onSubmit={submit} className="bg-white w-full max-w-[20rem] rounded-2xl p-6 space-y-4 shadow-xl text-left">
        <div className="space-y-1">
          <h2 className="text-[22px] font-bold text-slate-900">
            {confirmMode ? '이름을 확인해 주세요' : groupMode ? '그룹에서 쓸 이름' : '환영합니다!'}
          </h2>
          <p className="text-[14px] text-slate-500 leading-relaxed">
            {confirmMode
              ? '예전 버전의 기본 이름이 설정되어 있어요. 본인 이름이 맞는지 확인해 주세요.'
              : groupMode
                ? '그룹 동료에게 이 이름으로 보여요. 언제든 위쪽 이름을 눌러 바꿀 수 있어요.'
                : '이름은 그룹에서 동료에게 보일 때만 쓰여요. 비워 두고 바로 시작해도 돼요.'}
          </p>
        </div>
        {/* 카카오톡·밴드 등 앱 안 브라우저: 여기서 시작하면 크롬·사파리에선 다시 시작해야 해서 먼저 옮기도록 */}
        {!required && isInAppEnv(currentInstallEnv()) && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 space-y-2 text-left">
            <p className="text-[11px] font-bold text-amber-900">
              {inAppName(navigator.userAgent || '') || '이 앱'} 안에서 열렸어요. 홈 화면에 앱처럼 추가하려면 먼저 아래 버튼으로 열어서 시작하세요.
            </p>
            <KakaoOpenExternal />
          </div>
        )}
        <input
          // 첫 실행(이름 선택)에는 폰 키보드가 바로 올라와 버튼을 가리지 않게, 이름이 꼭 필요할 때만 바로 입력
          autoFocus={required || !window.matchMedia?.('(pointer: coarse)').matches}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder={required ? '예: 김간호' : '예: 김간호 (선택)'}
          className="w-full h-12 px-4 bg-slate-100 rounded-xl text-[16px] outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="submit"
          disabled={required && !trimmed}
          className="w-full h-12 rounded-xl bg-blue-600 text-white text-[16px] font-semibold disabled:opacity-40 cursor-pointer"
        >
          {confirmMode || groupMode ? '확인' : trimmed ? '시작하기' : '이름 없이 시작하기'}
        </button>
        {!required && (
          <>
            <SocialButtons mode="login" verb="시작" onError={(err) => setError(errorText(err))} />
            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          </>
        )}
        {!required && onLogin && (
          <button type="button" onClick={onLogin} className="w-full text-[13px] text-slate-500 cursor-pointer">
            이미 계정이 있어요 (다른 폰에서 쓰던 데이터 불러오기)
          </button>
        )}
      </form>
    </Modal>
  );
}
