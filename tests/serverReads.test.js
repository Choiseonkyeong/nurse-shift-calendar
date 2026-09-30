// 재발 방지: 서버는 한 번에 최대 1000행만 돌려줌 → 계속 늘어나는 목록은 반드시 나눠 받기(fetchAllRows),
// 그 밖의 목록 조회는 개수 제한(.limit)을 명시. 새 조회를 추가할 때 빠뜨리면 이 테스트가 실패함
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(fileURLToPath(new URL('../src/lib/shiftApi.js', import.meta.url)), 'utf8');
const bodyOf = (name) => {
  const start = src.indexOf(`export async function ${name}(`);
  expect(start, `${name} 함수가 없음`).toBeGreaterThan(-1);
  const next = src.indexOf('\nexport ', start + 1);
  return src.slice(start, next === -1 ? undefined : next);
};

describe('서버 목록 조회 1000행 제한 대응', () => {
  it('오래 쓸수록 늘어나는 목록(내 근무·메모·그룹 근무표)은 끝까지 나눠 받음', () => {
    ['fetchMyShifts', 'fetchMyNotes', 'fetchGroupSchedule'].forEach((fn) => {
      expect(bodyOf(fn), `${fn} 은 fetchAllRows 로 나눠 받아야 함`).toMatch(/fetchAllRows\(/);
      expect(bodyOf(fn), `${fn} 은 정렬 기준이 있어야 페이지가 겹치지 않음`).toMatch(/\.order\(/);
    });
  });

  it('그 밖의 테이블 조회는 개수 제한을 명시', () => {
    const selects = [...src.matchAll(/\.from\('(\w+)'\)[\s\S]*?;/g)].map((m) => m[0]).filter((q) => /\.select\(/.test(q));
    expect(selects.length).toBeGreaterThan(0);
    selects.forEach((q) => {
      const ok = /\.limit\(/.test(q) || /\.range\(/.test(q) || /\.delete\(\)/.test(q) || /fetchAllRows/.test(src.slice(0, src.indexOf(q)).split('\n').slice(-2).join('\n'));
      expect(ok, `개수 제한 없는 조회:\n${q}`).toBe(true);
    });
  });
});
