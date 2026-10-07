import React from 'react';
import { RotateCw } from 'lucide-react';
import { isChunkLoadError, reloadForUpdate, UPDATE_NOTICE } from '../lib/appUpdate';

/** 예상 못 한 오류로 화면이 하얗게 되는 대신 안내 + 새로고침 (근무 데이터는 기기·서버에 그대로) */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('화면 오류:', error);
    if (isChunkLoadError(error)) reloadForUpdate(UPDATE_NOTICE);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col px-6 pt-[calc(var(--safe-top)+15vh)] pb-[calc(var(--safe-bottom)+24px)]">
        <div className="flex-1 w-full max-w-sm mx-auto text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <RotateCw size={30} />
          </div>
          <h1 className="pt-2 text-[22px] font-bold text-slate-900">화면을 여는 중 문제가 생겼어요</h1>
          <p className="text-[15px] text-slate-500 leading-relaxed">근무·메모는 기기와 서버에 그대로 있어요.<br />새로고침하면 대부분 해결돼요.</p>
          <p className="pt-4 text-[11px] text-slate-300 break-all">{String(this.state.error?.message || this.state.error).slice(0, 160)}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full max-w-sm mx-auto h-14 rounded-2xl bg-blue-600 text-white text-[16px] font-semibold cursor-pointer"
        >
          새로고침
        </button>
      </div>
    );
  }
}
