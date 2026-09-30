// src/lib/csvText.js
/** CSV 글자 인코딩 판별: UTF-8 이 아니면 한국어 엑셀 기본 저장 형식(EUC-KR/CP949) */
export function decodeCsv(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch (e) {
    return new TextDecoder('euc-kr').decode(buffer);
  }
}
