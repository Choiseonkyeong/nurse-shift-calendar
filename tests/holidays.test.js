import { describe, it, expect } from 'vitest';
import { HOLIDAYS } from '../src/utils/holidays';

// 음력 명절은 한국 음력(단기력, 한국 시간 기준)으로 다시 계산해 목록과 대조
// (중국 음력과 하루 차이 나는 해가 있음: 2028년 설날은 한국 1/27, 중국 1/26)
const lunar = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const key = (d) => d.toISOString().slice(0, 10);
const shift = (k, n) => {
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return key(d);
};
function lunarDay(year, month, day) {
  for (let d = new Date(Date.UTC(year, 0, 1)); d.getUTCFullYear() === year; d.setUTCDate(d.getUTCDate() + 1)) {
    const p = Object.fromEntries(lunar.formatToParts(d).map((x) => [x.type, x.value]));
    if (p.month === String(month) && p.day === String(day)) return key(d);
  }
  return null;
}
const years = [...new Set(Object.keys(HOLIDAYS).map((k) => +k.slice(0, 4)))];

describe('공휴일 목록', () => {
  it.each(years)('%i년 설날·추석 연휴(전날·당일·다음날)와 부처님오신날이 한국 음력과 일치', (y) => {
    const seol = lunarDay(y, 1, 1);
    const chuseok = lunarDay(y, 8, 15);
    const buddha = lunarDay(y, 4, 8);
    for (const k of [shift(seol, -1), seol, shift(seol, 1)]) expect(HOLIDAYS[k], `설날 ${k}`).toMatch(/설날/);
    for (const k of [shift(chuseok, -1), chuseok, shift(chuseok, 1)]) expect(HOLIDAYS[k], `추석 ${k}`).toMatch(/추석/);
    expect(HOLIDAYS[buddha], `부처님오신날 ${buddha}`).toMatch(/부처님오신날/);
    // 목록의 설날·추석 표시가 연휴 밖 날짜에 있으면 안 됨
    Object.entries(HOLIDAYS)
      .filter(([k, v]) => k.startsWith(`${y}-`) && /설날|추석/.test(v))
      .forEach(([k, v]) => {
        const base = /설날/.test(v) ? seol : chuseok;
        expect([shift(base, -1), base, shift(base, 1)], `${k} ${v}`).toContain(k);
      });
  });

  it('2028년 설날 연휴는 1/26~28 (1/25 는 평일)', () => {
    expect(HOLIDAYS['2028-01-25']).toBeUndefined();
    expect(['2028-01-26', '2028-01-27', '2028-01-28'].map((k) => HOLIDAYS[k])).toEqual(['설날', '설날', '설날']);
  });
});
