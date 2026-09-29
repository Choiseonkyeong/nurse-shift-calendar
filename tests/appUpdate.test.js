import { describe, it, expect } from 'vitest';
import { isChunkLoadError, hasNewVersion } from '../src/lib/appUpdate';

const docWith = (src) => ({ querySelectorAll: () => (src ? [{ getAttribute: () => src }] : []) });
const fetchHtml = (html) => async () => ({ ok: true, text: async () => html });

describe('새 배포 감지', () => {
  it('파일 로드 실패 메시지 판별', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/rosterOcr-e44ef601.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('이미지를 열 수 없습니다.'))).toBe(false);
  });

  it('서버 화면의 메인 파일 이름이 다르면 새 버전', async () => {
    const doc = docWith('/assets/index-aaa111.js');
    expect(await hasNewVersion(fetchHtml('<script type="module" src="/assets/index-bbb222.js"></script>'), doc)).toBe(true);
    expect(await hasNewVersion(fetchHtml('<script type="module" src="/assets/index-aaa111.js"></script>'), doc)).toBe(false);
  });

  it('개발 서버(빌드 파일 없음)에서는 확인 안 함', async () => {
    expect(await hasNewVersion(fetchHtml('<script src="/assets/index-bbb.js">'), docWith('/src/main.jsx'))).toBe(false);
  });
});
