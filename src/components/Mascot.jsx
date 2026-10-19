import React from 'react';

/**
 * 앱 캐릭터 '토닥이': 동그란 귀와 작은 코의 하얀 북극곰 얼굴 (직접 그린 SVG)
 * mood: happy(기본) | sleep(나이트·쉬는 날) | cheer(응원)
 * 얼굴만 표시하며, 기본·휴식·응원 표정을 지원
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
      {/* 작은 화면과 다크 모드에서도 흰 얼굴의 윤곽이 보이도록 */}
      <circle cx="28" cy="31" r="15" fill="#fffdfa" stroke="#89949e" strokeWidth="2.5" />
      <circle cx="92" cy="31" r="15" fill="#fffdfa" stroke="#89949e" strokeWidth="2.5" />
      <circle cx="28" cy="31" r="7.5" fill="#f3e4df" />
      <circle cx="92" cy="31" r="7.5" fill="#f3e4df" />
      <path d="M60 26 C88 26 105 45 105 73 C105 99 88 109 60 109 C32 109 15 99 15 73 C15 45 32 26 60 26 Z" fill="#fffdfa" stroke="#89949e" strokeWidth="2.5" />
      {/* 눈 */}
      {sleep || cheer ? (
        <>
          <path d={sleep ? 'M40 67 q6 6 12 0' : 'M40 69 q6 -8 12 0'} fill="none" stroke="#3f3a3c" strokeWidth="3" strokeLinecap="round" />
          <path d={sleep ? 'M68 67 q6 6 12 0' : 'M68 69 q6 -8 12 0'} fill="none" stroke="#3f3a3c" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="46" cy="66" rx="3.8" ry="4.8" fill="#3f3a3c" />
          <ellipse cx="74" cy="66" rx="3.8" ry="4.8" fill="#3f3a3c" />
          <circle cx="47" cy="64.5" r="1.2" fill="#fff" />
          <circle cx="75" cy="64.5" r="1.2" fill="#fff" />
        </>
      )}
      {/* 볼 */}
      <ellipse cx="36" cy="82" rx="7" ry="4.5" fill="#efbcb0" opacity="0.65" />
      <ellipse cx="84" cy="82" rx="7" ry="4.5" fill="#efbcb0" opacity="0.65" />
      {/* 도톰한 주둥이와 작은 검은 코 */}
      <ellipse cx="60" cy="83" rx="15" ry="12" fill="#f2f1ec" />
      <path d="M55 77 Q60 74 65 77 Q65 82 60 83 Q55 82 55 77 Z" fill="#3f3a3c" />
      <path d="M60 82 v4" fill="none" stroke="#3f3a3c" strokeWidth="2.4" strokeLinecap="round" />
      {/* 입 */}
      <path d="M54 86 q3 4 6 0 q3 4 6 0" fill="none" stroke="#3f3a3c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
