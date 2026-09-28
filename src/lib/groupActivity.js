// src/lib/groupActivity.js
// 그룹 게시판 '새 글' 표시: 그룹별로 마지막으로 본 글 시각을 기기에 저장

const KEY = 'group_last_seen';

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
};

/** 게시판을 본 시점의 최신 글 시각 저장 */
export function markGroupSeen(groupId, latestPostAt) {
  if (!latestPostAt) return;
  const seen = read();
  if (seen[groupId] && seen[groupId] >= latestPostAt) return;
  seen[groupId] = latestPostAt;
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch (e) {
    /* 저장 공간 부족 등은 무시 */
  }
}

/** 마지막으로 본 뒤 새 글이 있는지 */
export function hasUnread(groupId, lastPostAt) {
  if (!lastPostAt) return false;
  const seen = read()[groupId];
  return !seen || lastPostAt > seen;
}
