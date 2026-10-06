import { describe, it, expect, afterEach } from 'vitest';
import { readSheet } from '../src/lib/readSheet';

/** 브라우저 Worker 대용: behavior 로 응답을 흉내 */
function installWorker(behavior) {
  const made = [];
  globalThis.Worker = class {
    constructor() {
      this.terminated = false;
      made.push(this);
    }
    postMessage(msg) {
      behavior(this, msg);
    }
    terminate() {
      this.terminated = true;
    }
  };
  return made;
}
const file = (name = 'r.xlsx') => ({ name, type: '', arrayBuffer: async () => new ArrayBuffer(8) });

afterEach(() => {
  delete globalThis.Worker;
});

describe('readSheet (엑셀은 격리된 워커에서, 시간 제한)', () => {
  it('워커 결과를 돌려주고 워커는 정리', async () => {
    const made = installWorker((w, msg) => setTimeout(() => w.onmessage({ data: { ok: true, matrix: [['a']], dateCells: {}, isCsv: msg.isCsv } })));
    expect(await readSheet(file())).toEqual({ matrix: [['a']], dateCells: {}, sheets: [{ name: '', matrix: [['a']], dateCells: {} }], active: 0 });
    expect(made[0].terminated).toBe(true);
  });

  it('응답이 없으면(조작된 파일로 멈춤) 시간 초과 안내 후 워커 강제 종료', async () => {
    const made = installWorker(() => {});
    await expect(readSheet(file(), { timeoutMs: 30 })).rejects.toThrow(/너무 오래/);
    expect(made[0].terminated).toBe(true);
  });

  it('파일 오류는 한국어 안내, 워커 파일을 못 불러오면 새로고침 대상 오류', async () => {
    installWorker((w) => setTimeout(() => w.onmessage({ data: { ok: false, message: 'bad zip' } })));
    await expect(readSheet(file())).rejects.toThrow('엑셀 파일을 열 수 없습니다.');
    installWorker((w) => setTimeout(() => w.onerror({ message: '' })));
    await expect(readSheet(file())).rejects.toThrow(/Loading chunk/);
  });
});
