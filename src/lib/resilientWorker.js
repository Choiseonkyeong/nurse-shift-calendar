// 인식 엔진(Tesseract) 작업자가 특정 칸 이미지에서 내부 오류(Assert failed → Aborted)로 죽어도
// 사진 전체 등록이 실패하지 않게: 작업자를 새로 만들고 설정을 되살린 뒤, 그 한 번은 빈 결과(못 읽은 칸)로 처리

const EMPTY = { data: { text: '', confidence: 0, blocks: [] } };

/**
 * @param create      () => Promise<worker>  새 작업자 만들기
 * @param maxCrashes  이보다 많이 죽으면 원래 오류를 그대로 던짐 (사진 자체 문제 → 무한 반복 방지)
 * @param isAborted   취소됐으면 true → 다시 만들지 않고 오류 그대로
 */
export async function resilientWorker(create, { maxCrashes = 5, isAborted = () => false } = {}) {
  let worker = await create();
  let params = {};
  const api = {
    crashes: 0,
    async setParameters(p) {
      params = { ...params, ...p };
      return worker.setParameters(p);
    },
    async recognize(...args) {
      try {
        return await worker.recognize(...args);
      } catch (e) {
        if (isAborted()) throw e; // 사용자가 취소해서 멈춘 것 → 새로 만들지 않음
        api.crashes += 1;
        if (api.crashes > maxCrashes) throw e;
        try {
          await worker.terminate();
        } catch {
          /* 이미 죽은 작업자 */
        }
        worker = await create();
        if (Object.keys(params).length) await worker.setParameters(params);
        return EMPTY;
      }
    },
    terminate: () => worker.terminate()
  };
  return api;
}
