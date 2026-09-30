import { describe, it, expect } from 'vitest';
import { pickRosterName, nameDistance } from '../src/lib/rosterName';

const roster = ['강인경', '최수민', '박혜영', '김비나', '이경은', '롱숙언', '남영주'];

describe('근무표에서 내 이름 고르기', () => {
  it('편집 거리', () => {
    expect(nameDistance('홍숙언', '롱숙언')).toBe(1);
    expect(nameDistance('최수민', '최수민')).toBe(0);
    expect(nameDistance('비나', '김비나')).toBe(1);
  });

  it('앱 이름과 같으면 그 줄', () => {
    expect(pickRosterName(roster, { userName: '최수민' })).toEqual({ name: '최수민', how: 'exact' });
  });

  it('닉네임이면 설정한 근무표 이름으로', () => {
    expect(pickRosterName(roster, { userName: '수미니', rosterName: '최수민' })).toEqual({ name: '최수민', how: 'exact' });
  });

  it('닉네임이고 설정도 없으면 못 고름 → 선택 창', () => {
    expect(pickRosterName(roster, { userName: '뽀송이' }).name).toBe('');
  });

  it('이름 일부만 같아도 (후보 하나일 때)', () => {
    expect(pickRosterName(roster, { userName: '수민' }).name).toBe('최수민');
    // '경' 한 글자는 비교 안 함, '경은' 은 이경은 하나뿐
    expect(pickRosterName(roster, { userName: '경은' }).name).toBe('이경은');
  });

  it('사진 오타: 한 글자 다르면 같은 사람 (3글자 이상)', () => {
    expect(pickRosterName(roster, { rosterName: '홍숙언' })).toEqual({ name: '롱숙언', how: 'similar' });
    expect(pickRosterName(['홍숙언', '김간호'], { rosterName: '롱숙언' }).name).toBe('홍숙언');
  });

  it('비슷한 사람이 둘 이상이면 고르지 않음', () => {
    expect(pickRosterName(['김민지', '김민주', '박간호'], { rosterName: '김민수' }).name).toBe('');
    expect(pickRosterName(['김민지', '이민지'], { userName: '민지' }).name).toBe('');
  });

  it('설정한 근무표 이름이 앱 이름보다 우선', () => {
    // 닉네임이 우연히 다른 동료 이름과 같아도 설정한 이름으로
    expect(pickRosterName(['김비나', '최수민'], { userName: '김비나', rosterName: '최수민' }).name).toBe('최수민');
  });

  it('한 명뿐인 근무표', () => {
    expect(pickRosterName(['아무개'], { userName: '뽀송이' })).toEqual({ name: '아무개', how: 'single' });
  });
  it('영문 이름은 대소문자·띄어쓰기 달라도 같은 사람', () => {
    expect(pickRosterName(['Kim Minji', 'Lee Sora'], { userName: 'kim minji' })).toEqual({ name: 'Kim Minji', how: 'exact' });
    expect(pickRosterName(['Kim Minji', 'Lee Sora'], { userName: 'KIMMINJI' }).name).toBe('Kim Minji');
  });
});
