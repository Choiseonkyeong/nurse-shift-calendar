import React from 'react';
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
      <div className="min-h-screen bg-page flex items-center justify-center p-6">
        <div className="bg-white max-w-xs w-full rounded-3xl p-6 text-center space-y-3 shadow-xl border border-slate-100">
          <p className="text-3xl">😵</p>
          <h1 className="font-black text-base text-slate-900">화면을 여는 중 문제가 생겼어요</h1>
          <p className="text-xs font-bold text-slate-500">근무·메모는 기기와 서버에 그대로 있어요. 새로고침하면 대부분 해결돼요.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black cursor-pointer"
          >
            새로고침
          </button>
          <p className="text-[10px] text-slate-300 break-all">{String(this.state.error?.message || this.state.error).slice(0, 160)}</p>
        </div>
      </div>
    );
  }
}
