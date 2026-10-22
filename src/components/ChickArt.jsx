import React from 'react';
import chick from '../assets/chick.webp';

// 병아리 그림 장면 (수당 카드·그룹 첫 화면). 그림은 Mascot 과 같은 chick.webp, 동전·꽃은 직접 그린 SVG

const Img = ({ size, className = '', style }) => (
  <img src={chick} width={size} height={size} alt="" aria-hidden="true" draggable={false} decoding="async"
    className={`object-contain select-none ${className}`} style={style} />
);

/** ₩ 동전 */
const Coin = ({ x, y, r = 11 }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r} fill="#d6dbe1" stroke="#8b949e" strokeWidth="1.5" />
    <circle r={r - 3} fill="none" stroke="#a7b0b9" strokeWidth="1" />
    <text y="4" textAnchor="middle" fontSize={r} fontWeight="700" fill="#5b6470">₩</text>
  </g>
);

/** 동전을 저글링하는 병아리 (수당 카드) */
export function CoinChick({ size = 104 }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <Img size={size * 0.72} className="absolute bottom-0 left-1/2 -translate-x-1/2" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
        <path d="M18 34 q-4 -6 0 -12 M24 30 q-3 -5 0 -9 M82 34 q4 -6 0 -12 M76 30 q3 -5 0 -9" fill="none" stroke="#7a8794" strokeWidth="1.6" strokeLinecap="round" />
        <Coin x={50} y={10} />
        <Coin x={22} y={46} r={10} />
        <Coin x={80} y={44} r={10} />
      </svg>
    </span>
  );
}

/** 손잡은 병아리 셋 (그룹 첫 화면). 오른쪽 병아리는 머리에 꽃 */
export function ChickFriends({ width = 220 }) {
  const s = width * 0.42;
  return (
    <span className="relative inline-block" style={{ width, height: s * 1.05 }} aria-hidden="true">
      <Img size={s} className="absolute bottom-0 left-0" style={{ transform: 'rotate(-6deg)' }} />
      <Img size={s} className="absolute bottom-0 right-0" style={{ transform: 'rotate(6deg) scaleX(-1)' }} />
      <Img size={s * 1.05} className="absolute bottom-0 left-1/2 -translate-x-1/2" />
      <svg viewBox="0 0 24 24" className="absolute" style={{ width: s * 0.26, right: s * 0.2, top: s * 0.08 }}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="12" cy="6.5" rx="4" ry="5" fill="#f5a3b8" stroke="#d9768f" strokeWidth="0.8" transform={`rotate(${a} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="3" fill="#f7d36b" />
      </svg>
    </span>
  );
}
