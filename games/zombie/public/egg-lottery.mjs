// APK rules: six levels, four selectable rewards, protected third attempt,
// free demotion ends the round. The missing live advancement odds use local 50%.
export const eggRewardIndexes = (level) =>
  Array.from({ length: 4 }, (_, i) => (Math.max(0, 6 - level) * 2 + i) % 12);
export const eggCanClaim = (s) => s.floor > 0 || s.claimReady === true;
export function advanceEgg(s, protect, rng) {
  if (s.claimReady) return { ok: false, reason: '请先选择本轮降层奖励' };
  if (s.floor >= 6) return { ok: false, reason: '已到第六层，请选择奖励' };
  s.draws++;
  const success = (protect && s.protect >= 2) || rng() < 0.5;
  if (success) {
    s.floor++;
    s.protect = 0;
  } else if (protect) s.protect++;
  else {
    s.floor = Math.max(0, s.floor - 1);
    s.protect = 0;
    s.claimReady = true;
  }
  return { ok: true, success, floor: s.floor, claimReady: s.claimReady === true };
}
export function resetEgg(s) {
  s.floor = 0;
  s.protect = 0;
  s.claimReady = false;
  s.round++;
}
