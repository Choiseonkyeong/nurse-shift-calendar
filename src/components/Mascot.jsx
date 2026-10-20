import React from 'react';
import polarBearFace from '../assets/polar-bear-face.webp';

/** 눈을 뜬 북극곰 얼굴 토닥이. 모든 화면에서 같은 얼굴을 사용해요. */
export default function Mascot({ size = 64, className = '', title }) {
  return (
    <img src={polarBearFace} width={size} height={size}
      className={`shrink-0 object-contain ${className}`} alt={title || ''}
      aria-hidden={title ? undefined : true} draggable={false} decoding="async" />
  );
}
