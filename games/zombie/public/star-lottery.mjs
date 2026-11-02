import { STAR_BIG, STAR_SMALL } from './board-lotteries.mjs';

// Pinned APK: both loop timers read 0.13f, and stop after four wraps.
// GetRandomNumber is a fixed switch, not random: jump table at 0x6F9477.
export const STAR_SWEEP_MS = 130;
export const STAR_SWEEP_PASSES = 4;
export const STAR_MOON_VISUAL_ORDER = [1, 3, 2, 4, 6, 5, 7];
const smallIds = STAR_SMALL.map((r) => r.SmallCellID),
  bigIds = STAR_BIG.map((r) => r.BigCellID);
const valid = (values, ids) => [
  ...new Set((Array.isArray(values) ? values : []).filter((id) => ids.includes(id))),
];

export function starAnimationPlan(rows, initial = {}) {
  const hits = valid(
      rows.map((r) => r.starCell),
      smallIds,
    ),
    big = rows.find((r) => bigIds.includes(r.starBigCell))?.starBigCell;
  if (!hits.length) return [];
  const takenSmall = new Set(valid(initial.small, smallIds)),
    takenBig = new Set(valid(initial.big, bigIds)),
    plan = [];
  const phase = (name, group, cells, ms) => plan.push({ name, group, cells, ms });
  // The APK's skip toggle bypasses the star sweep, but not the moon sweep.
  if (!initial.skipAnimation)
    for (let pass = 0; pass < STAR_SWEEP_PASSES; pass++)
      for (const id of smallIds)
        if (!takenSmall.has(id)) phase('small-sweep', 'small', [id], STAR_SWEEP_MS);
  // Final glow holds are H5 adaptations; particle/tween migration is pending.
  phase('small-result', 'small', hits, 400);
  if (big) {
    phase('transfer', '', [], 1000); // StarToMoon uses a one-second alpha tween.
    for (let pass = 0; pass < STAR_SWEEP_PASSES; pass++)
      for (let index = 0; index < bigIds.length; index++) {
        if (takenBig.has(bigIds[index])) continue;
        let target = STAR_MOON_VISUAL_ORDER[index];
        for (let offset = 0; offset < bigIds.length && takenBig.has(target); offset++)
          target = STAR_MOON_VISUAL_ORDER[(index + offset) % bigIds.length];
        if (!takenBig.has(target)) phase('big-sweep', 'big', [target], STAR_SWEEP_MS);
      }
    phase('big-result', 'big', [big], 800);
  }
  return plan;
}

export async function animateStarDraw(
  root,
  rows,
  initial = {},
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  if (!root?.isConnected) return;
  const cells = [...root.querySelectorAll('[data-star-cell]')],
    byId = new Map(cells.map((n) => [n.dataset.starCell, n]));
  const clear = () => cells.forEach((n) => n.classList.remove('star-active'));
  try {
    for (const phase of starAnimationPlan(rows, initial)) {
      if (!root.isConnected) return;
      clear();
      root.dataset.starPhase = phase.name;
      for (const id of phase.cells) {
        const node = byId.get(phase.group + ':' + id);
        node?.classList.add('star-active');
        if (phase.name.endsWith('-result')) node?.classList.add('board-collected');
      }
      await sleep(phase.ms);
    }
  } finally {
    clear();
    root.dataset.starPhase = 'idle';
  }
}
