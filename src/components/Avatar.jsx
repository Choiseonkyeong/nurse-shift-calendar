import React from 'react';
import Mascot from './Mascot';
import { useProfilePhoto } from '../lib/profilePhoto';

/** 프로필 동그라미: 내 사진, 없으면 옅은 앱 색 바탕의 병아리 */
export default function Avatar({ size = 48, className = '' }) {
  const photo = useProfilePhoto();
  return (
    <span
      className={`rounded-full overflow-hidden shrink-0 flex items-center justify-center ${photo ? '' : 'bg-blue-50'} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {photo ? (
        <img src={photo} alt="" width={size} height={size} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <Mascot size={Math.round(size * 0.82)} />
      )}
    </span>
  );
}
