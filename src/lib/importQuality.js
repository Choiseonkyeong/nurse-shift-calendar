// src/lib/importQuality.js
// 사진 가져오기 결과 품질 판단

/**
 * 다시 찍기 안내를 보여줄지: 확인할 칸(노란 테두리·못 읽은 칸)이 3칸 이상이고 등록한 칸의 10% 이상
 * (실험: 보통 캡처·흐린 사진은 확인할 칸 1~8칸/약 210칸, 가로 900px 정도 작은 사진은 26칸/196칸)
 */
export function needsRetakeHint({ source, uncertain = [], count = 0 } = {}) {
  return source === '사진' && uncertain.length >= 3 && uncertain.length >= count * 0.1;
}
