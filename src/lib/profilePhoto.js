// src/lib/profilePhoto.js
// 프로필 사진 (이 기기에만 저장, 백업 파일에 포함). 없으면 화면은 병아리 기본 캐릭터
import { useSyncExternalStore } from 'react';

export const PROFILE_PHOTO_KEY = 'profile_photo';
const EVENT = 'profile-photo-change';

export function getProfilePhoto() {
  try {
    return localStorage.getItem(PROFILE_PHOTO_KEY) || '';
  } catch (e) {
    return '';
  }
}

/** 저장 (실패하면 false: 저장 공간 부족 등). 빈 값이면 지움 → 기본 병아리 */
export function setProfilePhoto(dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(PROFILE_PHOTO_KEY, dataUrl);
    else localStorage.removeItem(PROFILE_PHOTO_KEY);
  } catch (e) {
    return false;
  }
  window.dispatchEvent(new Event(EVENT));
  return true;
}

const subscribe = (cb) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb); // 다른 탭에서 바꾼 경우
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};

/** 화면에서 쓰는 훅: 사진 data URL (없으면 '') */
export const useProfilePhoto = () => useSyncExternalStore(subscribe, getProfilePhoto, () => '');

/** 고른 사진을 가운데 정사각형으로 잘라 size px JPEG 로 (약 20~40KB) */
export function squarePhoto(file, size = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('사진 파일을 골라 주세요'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 열 수 없어요'));
    };
    img.src = url;
  });
}
