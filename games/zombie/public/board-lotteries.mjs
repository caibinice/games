// Shared APK board geometry/config and state transitions, not online prize pools.
import { NATIVE_OPERATIONS as DATA } from './native-operations-data.mjs';
const raw = DATA.legacyRawTables;
export const TREASURE_LAYERS = raw.FindTreasureLayerConfig.rows.filter(
  (r) => r.ActSubID === 5800101,
);
export const STAR_BIG = raw.XunXingBigCellConfig.rows.filter((r) => r.ActSubID === 7800101);
export const STAR_SMALL = raw.XunXingSmallCellConfig.rows.filter((r) => r.ActSubID === 7800101);
const maxLayer = Math.max(...TREASURE_LAYERS.map((r) => r.LayerID));
const int = (v, min = 0, max = 1e9) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : min));
const unique = (values, valid) => [...new Set(Array.isArray(values) ? values.filter(valid) : [])];
export function treasureRings(layer) {
  const row = TREASURE_LAYERS.find((r) => r.LayerID === layer) || TREASURE_LAYERS[0],
    cells = raw.FindTreasureCircleConfig.rows.filter((r) => r.CircleGroupID === row.CircleGroupID);
  return [...new Set(cells.map((r) => r.CircleID))].map((id) => ({
    id,
    cells: cells.filter((r) => r.CircleID === id),
  }));
}
export function normalizeTreasureBoard(s) {
  s.layer = int(s.layer, 1, maxLayer);
  const rings = treasureRings(s.layer);
  s.circle = int(s.circle, 1, rings.length);
  s.cells = unique(s.cells, (id) => rings[s.circle - 1].cells.some((r) => r.CellID === id));
  s.progress = unique(s.progress, (id) => TREASURE_LAYERS.some((r) => r.LayerID === id));
  s.boardClaimed = unique(s.boardClaimed, (id) => s.progress.includes(id));
  s.task = int(s.task);
  s.choices =
    s.choices && typeof s.choices === 'object' && !Array.isArray(s.choices) ? s.choices : {};
  s.history = Array.isArray(s.history) ? s.history.filter(Number.isInteger).slice(-100) : [];
  return s;
}
export function treasureStep(s, pick) {
  normalizeTreasureBoard(s);
  const rings = treasureRings(s.layer),
    ring = rings[s.circle - 1],
    available = ring.cells.filter((r) => !s.cells.includes(r.CellID));
  if (!available.length) return null;
  const cell = pick(available),
    hit = {
      cell,
      layer: s.layer,
      circle: s.circle,
      index: ring.cells.findIndex((r) => r.CellID === cell.CellID),
      completedLayer: 0,
    };
  s.cells.push(cell.CellID);
  s.draws = int(s.draws) + 1;
  s.history = [...(s.history || []), cell.CellID].slice(-100);
  if (cell.IsBig || s.cells.length === ring.cells.length) {
    s.circle++;
    s.cells = [];
    if (s.circle > rings.length) {
      hit.completedLayer = s.layer;
      if (!s.progress.includes(s.layer)) s.progress.push(s.layer);
      s.layer = s.layer === maxLayer ? 1 : s.layer + 1;
      s.circle = 1;
    }
  }
  return hit;
}
export const starOptions = (cell) => {
  const row = STAR_BIG.find((r) => r.BigCellID === cell);
  return row
    ? [1, 2, 3, 4, 5]
        .filter((k) => row['BootyID' + k])
        .map((k, index) => ({
          booty: row['BootyID' + k],
          limit: row['Limit' + k],
          poolIndex: (STAR_BIG.indexOf(row) + index) % 12,
        }))
    : [];
};
function finishStarRound(s) {
  s.lastRound = [...s.big];
  s.big = [];
  s.small = [];
  s.reset = int(s.reset) + 1;
}
export function normalizeStarBoard(s) {
  s.skipAnimation = s.skipAnimation === true;
  s.big = unique(s.big, (id) => STAR_BIG.some((r) => r.BigCellID === id));
  s.small = unique(s.small, (id) => STAR_SMALL.some((r) => r.SmallCellID === id));
  s.history = Array.isArray(s.history) ? s.history.filter(Number.isInteger).slice(-100) : [];
  s.counts = s.counts && typeof s.counts === 'object' && !Array.isArray(s.counts) ? s.counts : {};
  s.choices =
    s.choices && typeof s.choices === 'object' && !Array.isArray(s.choices) ? s.choices : {};
  for (const r of STAR_BIG) {
    s.counts[r.BigCellID] = int(s.counts[r.BigCellID]);
    if (!starOptions(r.BigCellID).some((c) => c.booty === s.choices[r.BigCellID]))
      delete s.choices[r.BigCellID];
  }
  s.reset = int(s.reset);
  s.lastRound = unique(s.lastRound, (id) => STAR_BIG.some((r) => r.BigCellID === id));
  // Native UpdateCost indexes the seven-row cost table by DrawBigPrizeCnt.
  // Leaving seven claimed cells blocks the next request (cost becomes zero).
  // Also migrate already-stalled legacy saves, once and without re-awarding.
  if (s.big.length === STAR_BIG.length) finishStarRound(s);
  return s;
}
export function starTurn(s, multi, pick) {
  normalizeStarBoard(s);
  const hits = [];
  let big = null;
  for (let i = 0; i < (multi ? STAR_SMALL.length : 1); i++) {
    if (s.small.length === STAR_SMALL.length) s.small = [];
    const cell = pick(STAR_SMALL.filter((r) => !s.small.includes(r.SmallCellID)));
    s.small.push(cell.SmallCellID);
    hits.push(cell);
    if (cell.IsSpecialItem) {
      let eligible = STAR_BIG.filter(
        (r) => !s.big.includes(r.BigCellID) && r.MinCnt <= s.big.length + 1,
      );
      if (!eligible.length) eligible = STAR_BIG.filter((r) => !s.big.includes(r.BigCellID));
      big = pick(eligible);
      s.big.push(big.BigCellID);
      s.counts[big.BigCellID] = int(s.counts[big.BigCellID]) + 1;
      s.small = [];
      break;
    }
  }
  const completedRound = s.big.length === STAR_BIG.length;
  if (completedRound) finishStarRound(s);
  s.draws = int(s.draws) + hits.length;
  s.history = [...(s.history || []), ...hits.map((r) => r.SmallCellID)].slice(-100);
  return { hits, big, completedRound };
}
export function sourceBoardSlots(nodes, group) {
  const parent = nodes.find((n) => n.name === group),
    by = new Map(nodes.map((n) => [n.rectId, n]));
  return parent
    ? parent.children
        .map((id) => by.get(id))
        .filter((n) => n && /^m_itemBooty|^m_itemChildNode/.test(n.name))
    : [];
}
