import React from 'react';
import chickCoins from '../assets/chick-coins.webp';
import chickFriends from '../assets/chick-friends.webp';

// 병아리 장면 그림 (수당 카드·그룹 첫 화면) — 시안 그림을 배경 없이 오려 낸 것

/** 날개를 들고 동전을 저글링하는 병아리 (수당 카드) */
export function CoinChick({ size = 104 }) {
  return (
    <span className="chick-scene chick-scene--coins shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <img src={chickCoins} width={size} height={size} alt="" draggable={false} decoding="async"
        className="chick-scene__picture object-contain select-none" />
      <span className="chick-sparkle chick-sparkle--first">✦</span>
      <span className="chick-sparkle chick-sparkle--second">✧</span>
    </span>
  );
}

/** 손잡은 병아리 셋 (그룹 첫 화면). 오른쪽 병아리는 머리에 꽃 */
export function ChickFriends({ width = 220 }) {
  return (
    <span className="chick-scene chick-scene--friends" style={{ width, height: Math.round(width * 0.42) }} aria-hidden="true">
      <img src={chickFriends} width={width} height={Math.round(width * 0.42)} alt="" draggable={false} decoding="async"
        className="chick-scene__picture object-contain select-none" />
      <span className="chick-sparkle chick-sparkle--first">✦</span>
      <span className="chick-sparkle chick-sparkle--second">♡</span>
    </span>
  );
}
