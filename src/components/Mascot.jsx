import React from 'react';

/**
 * 앱 캐릭터 '토닥이': 간호사 모자를 쓴 동글동글한 곰 (직접 그린 SVG)
 * mood: happy(기본) | sleep(나이트·쉬는 날) | cheer(응원)
 * 모자 십자·볼 색은 앱 포인트 색(text-blue-*)을 따라감
 */
export default function Mascot({ size = 64, mood = 'happy', className = '', title }) {
  const sleep = mood === 'sleep';
  const cheer = mood === 'cheer';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={`text-blue-400 shrink-0 ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* 그림자 */}
      <ellipse cx="60" cy="112" rx="30" ry="4" fill="currentColor" opacity="0.15" />
      {/* 둥근 곰 귀 */}
      <circle cx="30" cy="38" r="17" fill="#d9b58f" stroke="#b88e68" strokeWidth="2" />
      <circle cx="90" cy="38" r="17" fill="#d9b58f" stroke="#b88e68" strokeWidth="2" />
      <circle cx="30" cy="38" r="9" fill="#f5dfc6" />
      <circle cx="90" cy="38" r="9" fill="#f5dfc6" />
      {/* 몸(얼굴) */}
      <ellipse cx="60" cy="72" rx="42" ry="38" fill="#d9b58f" stroke="#b88e68" strokeWidth="2" />
      {/* 간호사 모자 */}
      <path d="M42 40 Q60 30 78 40 L74 50 Q60 45 46 50 Z" fill="#fff" stroke="#f1d5dc" strokeWidth="2" strokeLinejoin="round" />
      <rect x="57.5" y="37" width="5" height="11" rx="1.5" fill="currentColor" />
      <rect x="54.5" y="40" width="11" height="5" rx="1.5" fill="currentColor" />
      {/* 눈 */}
      {sleep ? (
        <>
          <path d="M40 70 q6 5 12 0" fill="none" stroke="#3f3a3c" strokeWidth="3" strokeLinecap="round" />
          <path d="M68 70 q6 5 12 0" fill="none" stroke="#3f3a3c" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="46" cy="69" rx="5" ry="6" fill="#3f3a3c" />
          <ellipse cx="74" cy="69" rx="5" ry="6" fill="#3f3a3c" />
          <circle cx="47.8" cy="66.6" r="1.8" fill="#fff" />
          <circle cx="75.8" cy="66.6" r="1.8" fill="#fff" />
        </>
      )}
      {/* 볼 */}
      <ellipse cx="36" cy="82" rx="7" ry="4.5" fill="currentColor" opacity="0.45" />
      <ellipse cx="84" cy="82" rx="7" ry="4.5" fill="currentColor" opacity="0.45" />
      {/* 밝은 주둥이와 곰 코 */}
      <ellipse cx="60" cy="83" rx="15" ry="12" fill="#f8e9d6" />
      <path d="M55 77 Q60 74 65 77 Q65 82 60 83 Q55 82 55 77 Z" fill="#3f3a3c" />
      <path d="M60 82 v4" fill="none" stroke="#3f3a3c" strokeWidth="2.4" strokeLinecap="round" />
      {/* 입 */}
      <path d="M54 86 q3 4 6 0 q3 4 6 0" fill="none" stroke="#3f3a3c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* 팔 */}
      {cheer ? (
        <>
          <ellipse cx="22" cy="58" rx="8" ry="10" fill="#d9b58f" stroke="#b88e68" strokeWidth="2" transform="rotate(-25 22 58)" />
          <ellipse cx="98" cy="58" rx="8" ry="10" fill="#d9b58f" stroke="#b88e68" strokeWidth="2" transform="rotate(25 98 58)" />
          <path d="M14 36 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="currentColor" />
          <path d="M104 30 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 z" fill="currentColor" opacity="0.7" />
        </>
      ) : (
        <>
          <ellipse cx="28" cy="94" rx="8" ry="7" fill="#d9b58f" stroke="#b88e68" strokeWidth="2" />
          <ellipse cx="92" cy="94" rx="8" ry="7" fill="#d9b58f" stroke="#b88e68" strokeWidth="2" />
        </>
      )}
      {sleep && (
        <text x="92" y="38" fontSize="16" fontWeight="700" fill="currentColor" fontFamily="sans-serif">
          z
        </text>
      )}
    </svg>
  );
}
