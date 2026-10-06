// src/lib/readSheet.js
// 엑셀·CSV 파일 읽기 (워커에서, 시간 제한). 결과: { matrix, dateCells(첫 탭), sheets: [{ name, matrix, dateCells }], active }
export const READ_TIMEOUT_MS = 20000;

export async function readSheet(file, { timeoutMs = READ_TIMEOUT_MS } = {}) {
  const buffer = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  const worker = new Worker(new URL('./xlsxWorker.js', import.meta.url), { type: 'module' });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('엑셀 파일을 읽는 데 너무 오래 걸려요. 파일이 손상되지 않았는지 확인해 주세요.')),
        timeoutMs
      );
      worker.onmessage = ({ data }) => {
        clearTimeout(timer);
        if (data?.ok) {
          const sheets = data.sheets || [{ name: '', matrix: data.matrix, dateCells: data.dateCells }];
          resolve({ matrix: data.matrix, dateCells: data.dateCells, sheets, active: data.active || 0 });
        }
        else reject(new Error('엑셀 파일을 열 수 없습니다.'));
      };
      worker.onerror = (e) => {
        clearTimeout(timer);
        e.preventDefault?.();
        // 워커 파일 자체를 못 불러온 경우(새 배포 후 오래 열린 탭 등): 메시지가 없음 → 새 버전으로 새로고침 대상
        reject(new Error(e?.message ? '엑셀 파일을 열 수 없습니다.' : 'Loading chunk xlsxWorker failed'));
      };
      worker.postMessage({ buffer, isCsv }, [buffer]);
    });
  } finally {
    worker.terminate(); // 끝나거나 멈추면 워커째 정리 (오염된 상태도 함께 사라짐)
  }
}
