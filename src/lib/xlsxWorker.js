// src/lib/xlsxWorker.js
// 엑셀 파일은 별도 워커에서 읽음: 엑셀 라이브러리(SheetJS)의 알려진 취약점
// (조작된 파일로 인한 프로토타입 오염·무한 대기)이 앱 화면에 영향을 주지 않도록 격리
import * as XLSX from 'xlsx';
import { sheetToMatrix } from './sheetMatrix';

self.onmessage = ({ data: { buffer, isCsv } }) => {
  try {
    self.postMessage({ ok: true, ...sheetToMatrix(XLSX, buffer, isCsv) });
  } catch (err) {
    self.postMessage({ ok: false, message: String(err?.message || err) });
  }
};
