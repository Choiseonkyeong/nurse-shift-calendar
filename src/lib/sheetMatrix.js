// src/lib/sheetMatrix.js
// 엑셀·CSV 파일 → 표(문자열 2차원 배열) + 날짜 서식 칸 { 'R:C': 'YYYY-MM-DD' }
// (워커 안에서 실행: lib/xlsxWorker.js)
import { decodeCsv } from './csvText';

// 근무표 한 장에 충분한 크기로 제한 (거대한/조작된 파일이 화면을 멈추지 않게)
export const MAX_ROWS = 500;
export const MAX_COLS = 200;

export function sheetToMatrix(XLSX, buffer, isCsv) {
  const workbook = isCsv
    ? XLSX.read(decodeCsv(buffer), { type: 'string', cellNF: true })
    : XLSX.read(buffer, { type: 'array', cellNF: true }); // cellNF: 날짜 서식 판별용
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100');
  range.e.r = Math.min(range.e.r, range.s.r + MAX_ROWS - 1);
  range.e.c = Math.min(range.e.c, range.s.c + MAX_COLS - 1);

  const matrix = [];
  const dateCells = {};
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
      const date = cell?.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z) ? XLSX.SSF.parse_date_code(cell.v) : null;
      if (date?.y) {
        dateCells[`${R - range.s.r}:${C - range.s.c}`] = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        row.push(String(date.d));
      } else {
        row.push(cell ? String(cell.v).trim() : '');
      }
    }
    matrix.push(row);
  }
  return { matrix, dateCells };
}
