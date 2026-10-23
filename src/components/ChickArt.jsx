import React from 'react';
import chickCoins from '../assets/chick-coins.webp';
import chickFriends from '../assets/chick-friends.webp';

// 병아리 장면 그림 (수당 카드·그룹 첫 화면) — 시안 그림을 배경 없이 오려 낸 것

/** 날개를 들고 동전을 저글링하는 병아리 (수당 카드) */
export function CoinChick({ size = 104 }) {
  return (
    <img src={chickCoins} width={size} height={size} alt="" aria-hidden="true" draggable={false} decoding="async"
      className="shrink-0 object-contain select-none" />
  );
}

/** 손잡은 병아리 셋 (그룹 첫 화면). 오른쪽 병아리는 머리에 꽃 */
export function ChickFriends({ width = 220 }) {
  return (
    <img src={chickFriends} width={width} height={Math.round(width * 0.42)} alt="" aria-hidden="true" draggable={false} decoding="async"
      className="inline-block object-contain select-none" />
  );
}
