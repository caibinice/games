// Local permanent-event progression. Source wave tables stay unchanged; these
// explicit web objectives are not represented as original online event logic.
export const EVENT_RULES = {
  3: {
    mode: 'abyss',
    name: '深渊挑战',
    description: '从最高层记录挑战；局内上限30级，全技能词条开放',
  },
  4: { mode: 'crisis', name: '终末危机', description: '禁止所有回血；积累首领伤害与个人记录' },
  6: { mode: 'rescue', name: '寰球救援', description: '独立怪物组合、挑战效果和成就记录' },
  8: {
    mode: 'maze',
    name: '雾境迷宫',
    description: '原作三层探索、路线事件与增益；局内词条上限30',
  },
  9: { mode: 'trial', name: '核心试炼', description: '核心与六元素试炼塔；技能增益与逐层奖励' },
  22: { mode: 'gold', name: '金币狂欢', description: '原生金币关卡配置；挑战入口与次数常开' },
};
export const eventRule = (stage) =>
  EVENT_RULES[stage?.base?.LevelType ?? stage?.LevelType] || {
    mode: 'waves',
    name: '活动挑战',
    description: '使用本活动独立的客户端关卡配置',
  };
export function initEvent(g) {
  if (!g.activity) return;
  g.event = { ...eventRule(g.client), kills: 0, coins: 0 };
  if (g.event.mode === 'abyss') {
    g.maxRank = 30;
    g.nativeAllAffixes = true;
  }
  if (g.event.mode === 'maze') g.maxRank = 30;
  if (g.event.mode === 'crisis') g.noHealing = true;
}
export function eventTick() {}
export function eventProgress(meta, id) {
  return meta.eventProgress?.[id] || { runs: 0, wins: 0, bestKills: 0, points: 0, claimed: 0 };
}
export function claimEventMilestone(meta, id) {
  const p = meta.eventProgress?.[id];
  if (!p) return false;
  const next = p.claimed + 1;
  if (p.points < next * 100) return false;
  p.claimed = next;
  meta.diamonds = Math.min(1e9, meta.diamonds + 100);
  meta.materials.forge = Math.min(1e9, meta.materials.forge + 20);
  return true;
}
export function mazeNodes(meta) {
  const progress = meta.maze || { cleared: [], position: 0 };
  return Array.from({ length: 15 }, (_, id) => ({
    id,
    row: Math.floor(id / 3),
    col: id % 3,
    cleared: progress.cleared.includes(id),
    open:
      id < 3 ||
      progress.cleared.some(
        (n) => Math.floor(n / 3) === Math.floor(id / 3) - 1 && Math.abs((n % 3) - (id % 3)) <= 1,
      ),
    kind: id % 5 === 2 ? 'supply' : id >= 12 ? 'boss' : 'battle',
  }));
}
export function enterMaze(meta, id) {
  const node = mazeNodes(meta).find((n) => n.id === id && n.open);
  if (!node) return false;
  meta.maze = { ...(meta.maze || { cleared: [] }), position: id };
  if (node.kind === 'supply' && !node.cleared) {
    meta.maze.cleared.push(id);
    meta.gold = Math.min(1e9, meta.gold + 30000);
    meta.materials.forge += 10;
  }
  return node;
}
