// src/lib/sheetMatrix.js
// 엑셀·CSV 파일 → 표(문자열 2차원 배열) + 날짜 서식 칸 { 'R:C': 'YYYY-MM-DD' }
// (워커 안에서 실행: lib/xlsxWorker.js)
import { decodeCsv } from './csvText';

// 근무표 한 장에 충분한 크기로 제한 (거대한/조작된 파일이 화면을 멈추지 않게)
export const MAX_ROWS = 500;
export const MAX_COLS = 200;

export const MAX_SHEETS = 12;

/**
 * 엑셀·CSV → 모든 탭(최대 MAX_SHEETS) { sheets: [{ name, matrix, dateCells }], active: 엑셀에서 마지막으로 보던 탭 }
 * matrix·dateCells 는 첫 탭 (예전 호출 호환)
 */
export function sheetToMatrix(XLSX, buffer, isCsv) {
  const workbook = isCsv
    ? XLSX.read(decodeCsv(buffer), { type: 'string', cellNF: true })
    : XLSX.read(buffer, { type: 'array', cellNF: true }); // cellNF: 날짜 서식 판별용
  const names = workbook.SheetNames.slice(0, MAX_SHEETS);
  const sheets = names.map((name) => ({ name, ...worksheetToMatrix(XLSX, workbook.Sheets[name]) }));
  const activeTab = isCsv ? 0 : activeTabOf(XLSX, buffer);
  return { matrix: sheets[0].matrix, dateCells: sheets[0].dateCells, sheets, active: activeTab < sheets.length ? activeTab : 0 };
}

/** 엑셀에서 마지막으로 보던 탭 번호 (xl/workbook.xml 의 workbookView activeTab). 라이브러리가 읽어 주지 않아 직접 */
function activeTabOf(XLSX, buffer) {
  try {
    const zip = XLSX.CFB.read(new Uint8Array(buffer), { type: 'array' });
    const entry = XLSX.CFB.find(zip, '/xl/workbook.xml');
    const m = entry && /<workbookView\b[^>]*\sactiveTab="(\d+)"/.exec(new TextDecoder().decode(entry.content));
    return m ? Number(m[1]) : 0;
  } catch {
    return 0; // 옛 .xls 등
  }
}

function worksheetToMatrix(XLSX, worksheet) {
  if (!worksheet) return { matrix: [], dateCells: {} };
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
