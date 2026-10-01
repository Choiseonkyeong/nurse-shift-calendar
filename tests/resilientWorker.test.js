import { describe, it, expect, vi } from 'vitest';
import { resilientWorker } from '../src/lib/resilientWorker.js';

// 가짜 작업자: crashOn 에 든 이미지를 읽으면 죽음(이후 모든 호출 실패)
function factory(crashOn = new Set()) {
  const made = [];
  const create = vi.fn(async () => {
    let dead = false;
    const w = {
      params: {},
      setParameters: vi.fn(async (p) => {
        if (dead) throw new Error('dead');
        Object.assign(w.params, p);
      }),
      recognize: vi.fn(async (img) => {
        if (dead) throw new Error('dead');
        if (crashOn.has(img)) {
          dead = true;
          throw new Error('RuntimeError: Aborted()');
        }
        return { data: { text: `${img}@${w.params.tessedit_pageseg_mode}`, confidence: 90 } };
      }),
      terminate: vi.fn(async () => {
        if (dead) throw new Error('dead');
      })
    };
    made.push(w);
    return w;
  });
  return { create, made };
}

describe('resilientWorker', () => {
  it('한 칸에서 엔진이 죽으면 그 칸은 빈 결과, 새 작업자가 같은 설정으로 다음 칸을 읽음', async () => {
    const { create, made } = factory(new Set(['bad']));
    const w = await resilientWorker(create);
    await w.setParameters({ tessedit_pageseg_mode: '8' });
    expect((await w.recognize('a')).data.text).toBe('a@8');
    expect(await w.recognize('bad')).toEqual({ data: { text: '', confidence: 0, blocks: [] } });
    expect((await w.recognize('b')).data.text).toBe('b@8'); // 설정(PSM 8) 유지
    expect(create).toHaveBeenCalledTimes(2);
    expect(made[1].params.tessedit_pageseg_mode).toBe('8');
    await w.terminate();
  });

  it('계속 죽으면(사진 자체 문제) 정해진 횟수 뒤 원래 오류를 던짐', async () => {
    const { create } = factory(new Set(['bad']));
    const w = await resilientWorker(create, { maxCrashes: 2 });
    await w.recognize('bad');
    await w.recognize('bad');
    await expect(w.recognize('bad')).rejects.toThrow('Aborted');
  });
});
