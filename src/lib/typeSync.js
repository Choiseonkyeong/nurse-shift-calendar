// src/lib/typeSync.js
// 근무 종류(이름·색·시간) 변경을 서버에 못 보냈을 때(오프라인) 기기에 쌓아 두고, 다음 연결 때 먼저 보냄
// → 서버 목록으로 덮어써져 사라지거나, 지운 종류가 되살아나는 문제 방지
//   큐 형식: { upsert: { 코드: 종류 }, remove: [코드] } — 같은 코드의 마지막 작업만 남김

export const TYPE_QUEUE_KEY = 'pending_type_ops';

export function readTypeQueue(storage = localStorage) {
  try {
    const q = JSON.parse(storage.getItem(TYPE_QUEUE_KEY) || 'null');
    return { upsert: q?.upsert || {}, remove: q?.remove || [] };
  } catch (e) {
    return { upsert: {}, remove: [] };
  }
}

function writeTypeQueue(q, storage) {
  if (!Object.keys(q.upsert).length && !q.remove.length) storage.removeItem(TYPE_QUEUE_KEY);
  else storage.setItem(TYPE_QUEUE_KEY, JSON.stringify(q));
}

/** @param op { type: 'upsert', value: 종류 } | { type: 'remove', code } */
export function queueTypeOp(op, storage = localStorage) {
  const q = readTypeQueue(storage);
  if (op.type === 'upsert') {
    q.upsert[op.value.code] = op.value;
    q.remove = q.remove.filter((c) => c !== op.value.code);
  } else {
    delete q.upsert[op.code];
    if (!q.remove.includes(op.code)) q.remove.push(op.code);
  }
  writeTypeQueue(q, storage);
}

/**
 * 쌓인 작업을 서버로 보냄. 성공한 작업만 큐에서 빠지고, 실패하면 다음에 다시 시도
 * @returns 남은 작업 수
 */
export async function flushTypeQueue({ upsert, remove }, storage = localStorage) {
  const q = readTypeQueue(storage);
  for (const [code, value] of Object.entries(q.upsert)) {
    try {
      await upsert(value);
      delete q.upsert[code];
    } catch (e) {
      /* 다음 연결 때 재시도 */
    }
  }
  for (const code of [...q.remove]) {
    try {
      await remove(code);
      q.remove = q.remove.filter((c) => c !== code);
    } catch (e) {
      /* 다음 연결 때 재시도 */
    }
  }
  writeTypeQueue(q, storage);
  return Object.keys(q.upsert).length + q.remove.length;
}

/** 서버 목록 위에 아직 못 보낸 기기 변경을 얹은 결과 (화면 표시용) */
export function applyTypeQueue(serverTypes = [], storage = localStorage) {
  const q = readTypeQueue(storage);
  const byCode = new Map(serverTypes.map((t) => [t.code, t]));
  Object.values(q.upsert).forEach((t) => byCode.set(t.code, t));
  q.remove.forEach((c) => byCode.delete(c));
  return [...byCode.values()];
}
