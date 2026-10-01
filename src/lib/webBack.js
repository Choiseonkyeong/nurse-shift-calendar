// 웹(브라우저·홈 화면 앱) 뒤로가기
// 팝업이 열려 있거나 내 근무 탭이 아닐 때 방문 기록에 한 칸(__back)을 넣어 둔다.
// 뒤로가기로 그 칸이 빠지면 앱을 나가지 않고 onBack(팝업 닫기 → 내 근무 탭)으로 처리.
// 돌아갈 곳이 없어지면(창을 X로 닫음 등) 넣어 둔 칸을 직접 빼서, 내 근무 첫 화면에서는 뒤로가기 한 번에 나가게.

const isGuard = (state) => state?.__back === true;

/**
 * @param needGuard  () => boolean  지금 뒤로가기를 앱 안에서 처리해야 하는지
 * @param onBack     () => void     뒤로가기 처리
 * @returns { sync, dispose }  sync: 상태가 바뀔 때마다 호출
 */
export function installWebBack({ needGuard, onBack, win = window }) {
  const { history } = win;
  let dropping = false; // 우리가 history.back() 으로 칸을 빼는 중
  let disposed = false;

  const sync = () => {
    if (disposed || dropping) return;
    const has = isGuard(history.state);
    if (needGuard() && !has) history.pushState({ ...(history.state || {}), __back: true }, '');
    else if (!needGuard() && has) {
      dropping = true;
      history.back();
    }
  };

  const onPop = () => {
    if (dropping) {
      dropping = false;
      sync(); // 빼는 사이 다시 팝업이 열렸을 수 있음
      return;
    }
    if (isGuard(history.state)) return; // 앞으로 가기 등으로 칸 위로 돌아옴
    onBack();
    // 화면 상태가 반영된 뒤 다시 맞춤 (남은 팝업·탭이 있으면 칸을 다시 넣음)
    win.setTimeout(sync, 0);
  };

  win.addEventListener('popstate', onPop);
  return {
    sync,
    dispose() {
      disposed = true;
      win.removeEventListener('popstate', onPop);
    }
  };
}
