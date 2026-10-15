import React from 'react';

// 첫 화면 배경: 직접 그린 일러스트 4가지 (저작권 걱정 없는 그림) 또는 내 사진
// 모두 화면을 꽉 채우고(slice), 글자가 잘 보이도록 위·아래를 살짝 어둡게

// 먼 도시 실루엣 (건물 + 에펠탑 모양 탑)
const Skyline = ({ fill, opacity = 1, y = 560 }) => (
  <g fill={fill} opacity={opacity}>
    <path d={`M0 ${y} h38 v-46 h22 v26 h30 v-58 h26 v40 h34 v-22 h28 v52 h30 v-34 h24 v40 h40 v-30 h26 v24 h36 v-48 h22 v42 h34 V844 H0 Z`} />
    {/* 탑: 네 다리와 점점 가늘어지는 몸통 */}
    <path d={`M258 ${y + 10} Q276 ${y - 30} 284 ${y - 70} L290 ${y - 150} L294 ${y - 205} L296 ${y - 240} L298 ${y - 205} L302 ${y - 150} L308 ${y - 70} Q316 ${y - 30} 334 ${y + 10} L318 ${y + 10} Q296 ${y - 44} 274 ${y + 10} Z`} />
    <rect x="281" y={y - 74} width="30" height="6" rx="1.5" />
    <rect x="287" y={y - 154} width="18" height="5" rx="1.5" />
    <rect x="295" y={y - 252} width="2" height="14" />
  </g>
);

function Scene({ kind }) {
  if (kind === 'dawn') {
    return (
      <>
        <defs>
          <linearGradient id="dawnSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8EA4D2" />
            <stop offset="0.45" stopColor="#C9B6D9" />
            <stop offset="0.75" stopColor="#F2C6C2" />
            <stop offset="1" stopColor="#F7DCC8" />
          </linearGradient>
          <radialGradient id="dawnSun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#FFF4E0" stopOpacity="0.95" />
            <stop offset="1" stopColor="#FFF4E0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="390" height="844" fill="url(#dawnSky)" />
        <circle cx="120" cy="590" r="160" fill="url(#dawnSun)" />
        <g fill="#fff" opacity="0.55">
          <ellipse cx="90" cy="250" rx="90" ry="18" />
          <ellipse cx="150" cy="238" rx="60" ry="16" />
          <ellipse cx="300" cy="330" rx="110" ry="20" />
          <ellipse cx="250" cy="318" rx="60" ry="15" />
          <ellipse cx="60" cy="430" rx="80" ry="14" />
        </g>
        <Skyline fill="#6E6A8F" opacity="0.55" y={640} />
        <Skyline fill="#4E4A6E" opacity="0.8" y={700} />
      </>
    );
  }
  if (kind === 'night') {
    const stars = [
      [40, 90, 1.6], [110, 60, 1.2], [180, 120, 1.8], [250, 70, 1.3], [330, 110, 1.7], [360, 200, 1.1], [70, 200, 1.2],
      [150, 230, 1.5], [220, 180, 1], [290, 250, 1.4], [30, 310, 1.1], [120, 340, 1.3], [340, 330, 1.2], [200, 300, 1]
    ];
    return (
      <>
        <defs>
          <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0E1530" />
            <stop offset="0.6" stopColor="#24305C" />
            <stop offset="1" stopColor="#4A4A78" />
          </linearGradient>
          <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#FFF6D8" stopOpacity="0.5" />
            <stop offset="1" stopColor="#FFF6D8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="390" height="844" fill="url(#nightSky)" />
        <circle cx="290" cy="170" r="110" fill="url(#moonGlow)" />
        <circle cx="290" cy="170" r="34" fill="#FFF3CF" />
        <circle cx="304" cy="160" r="30" fill="#1B2448" />
        <g fill="#fff">
          {stars.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} opacity="0.85" />
          ))}
        </g>
        <Skyline fill="#161C3A" y={660} />
        {/* 창문 불빛 */}
        <g fill="#FFD98A" opacity="0.8">
          {[[16, 690], [46, 700], [104, 680], [140, 700], [196, 690], [232, 706], [340, 694], [366, 710], [76, 720], [170, 730]].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="5" height="7" rx="1" />
          ))}
        </g>
      </>
    );
  }
  if (kind === 'blossom') {
    const flowers = [
      [30, 110], [70, 140], [110, 100], [150, 150], [60, 200], [190, 120], [230, 170], [20, 260], [100, 250],
      [300, 520], [340, 560], [360, 480], [280, 600], [330, 640], [250, 560]
    ];
    return (
      <>
        <defs>
          <linearGradient id="blossomSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F9D7DF" />
            <stop offset="0.5" stopColor="#FBE7E4" />
            <stop offset="1" stopColor="#E9EEF7" />
          </linearGradient>
        </defs>
        <rect width="390" height="844" fill="url(#blossomSky)" />
        <g fill="none" stroke="#8C6A64" strokeLinecap="round">
          <path d="M-10 60 Q120 120 250 160" strokeWidth="9" />
          <path d="M60 90 Q80 180 40 260" strokeWidth="5" />
          <path d="M150 128 Q180 70 230 60" strokeWidth="4" />
          <path d="M400 440 Q320 520 250 640" strokeWidth="8" />
          <path d="M330 530 Q370 590 350 680" strokeWidth="4" />
        </g>
        {flowers.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${i * 23})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="0" cy="-9" rx="7" ry="10" fill={i % 3 ? '#F7B6C6' : '#FBD0DA'} transform={`rotate(${a})`} />
            ))}
            <circle r="3.5" fill="#E77E9B" />
          </g>
        ))}
        <g fill="#F7B6C6" opacity="0.7">
          {[[120, 380], [200, 300], [60, 460], [180, 520], [90, 620], [220, 420]].map(([x, y]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="5" ry="3" transform={`rotate(30 ${x} ${y})`} />
          ))}
        </g>
      </>
    );
  }
  // sunset: 노을 지는 창가
  return (
    <>
      <defs>
        <linearGradient id="sunsetSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7FA6CF" />
          <stop offset="0.45" stopColor="#E8B79A" />
          <stop offset="0.75" stopColor="#F2A97E" />
          <stop offset="1" stopColor="#C9785C" />
        </linearGradient>
        <radialGradient id="sunsetSun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE7B8" stopOpacity="1" />
          <stop offset="1" stopColor="#FFE7B8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="curtain" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4A2E22" />
          <stop offset="1" stopColor="#7A4B33" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect width="390" height="844" fill="url(#sunsetSky)" />
      <circle cx="230" cy="560" r="170" fill="url(#sunsetSun)" />
      <Skyline fill="#8A5A4A" opacity="0.55" y={640} />
      <Skyline fill="#5E3B30" opacity="0.85" y={700} />
      {/* 창틀·커튼 */}
      <path d="M0 0 H70 Q52 300 66 844 H0 Z" fill="url(#curtain)" />
      <rect x="64" y="0" width="10" height="844" fill="#3B241B" opacity="0.7" />
      <rect x="340" y="0" width="50" height="844" fill="#3B241B" opacity="0.75" />
      <rect x="64" y="0" width="290" height="14" fill="#3B241B" opacity="0.7" />
      {/* 발코니 난간 */}
      <g stroke="#2E1C15" strokeWidth="4" fill="none" opacity="0.85">
        <path d="M66 690 H344" />
        <path d="M66 760 H344" />
        {[90, 130, 170, 210, 250, 290, 330].map((x) => (
          <path key={x} d={`M${x} 690 v70 M${x - 20} 725 q20 -26 40 0 q-20 26 -40 0`} />
        ))}
      </g>
    </>
  );
}

export default function IntroBackground({ bg = 'sunset', photo = null, className = '' }) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {bg === 'photo' && photo ? (
        <img src={photo} alt="" className="w-full h-full object-cover" />
      ) : (
        <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <Scene kind={bg} />
        </svg>
      )}
      {/* 글자가 잘 보이게 위·아래 어둡게 */}
      <div className={`absolute inset-0 bg-gradient-to-b ${bg === 'blossom' ? 'from-black/55 via-black/15' : 'from-black/45 via-black/5'} to-black/50`} />
    </div>
  );
}
