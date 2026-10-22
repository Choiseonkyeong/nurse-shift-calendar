import React from 'react';
import chick from '../assets/chick.webp';

/** 노란 병아리 캐릭터. 모든 화면에서 같은 그림을 사용해요. */
export default function Mascot({ size = 64, className = '', title }) {
  return (
    <img src={chick} width={size} height={size}
      className={`shrink-0 object-contain ${className}`} alt={title || ''}
      aria-hidden={title ? undefined : true} draggable={false} decoding="async" />
  );
}
