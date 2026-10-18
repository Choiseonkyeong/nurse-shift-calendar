// src/lib/introPref.js
// 첫 화면(시작 화면): 배경 고르기·내 사진·열 때마다 보기 (이 기기에만 저장)
const BG_KEY = 'intro_bg';
const PHOTO_KEY = 'intro_photo';
const SEEN_KEY = 'intro_seen';
const EVERY_KEY = 'intro_every_launch';

export const INTRO_BGS = [
  { key: 'sunset', label: '노을 창가' },
  { key: 'dawn', label: '새벽 하늘' },
  { key: 'night', label: '밤 근무' },
  { key: 'blossom', label: '벚꽃' }
];

const get = (k) => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
const set = (k, v) => {
  try {
    if (v === null || v === undefined) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
    return true;
  } catch (e) {
    return false; // 저장 공간이 꽉 찬 경우 등
  }
};

/** 'sunset' | 'dawn' | 'night' | 'blossom' | 'photo' */
export function getIntroBg() {
  const v = get(BG_KEY);
  if (v === 'photo' && get(PHOTO_KEY)) return 'photo';
  return INTRO_BGS.some((b) => b.key === v) ? v : 'sunset';
}
export const setIntroBg = (key) => set(BG_KEY, key === 'sunset' ? null : key);
export const getIntroPhoto = () => get(PHOTO_KEY);
/** 내 사진 저장 (실패하면 false: 사진이 너무 큼) */
export const setIntroPhoto = (dataUrl) => set(PHOTO_KEY, dataUrl);

export const introSeen = () => get(SEEN_KEY) === '1';
export const markIntroSeen = () => set(SEEN_KEY, '1');
// 기본: 앱을 열 때마다 첫 화면 (끄면 '0' 저장)
export const introEveryLaunch = () => get(EVERY_KEY) !== '0';
export const setIntroEveryLaunch = (on) => set(EVERY_KEY, on ? null : '0');

/** 고른 사진을 화면 크기(긴 변 1600px)로 줄여 JPEG 로 (저장 공간 절약) */
export function shrinkPhoto(file, max = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
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
