import { CLIENT_GEMS, CLIENT_GEM_COMPOSE } from '../../public/client-gem-data.mjs';
import { gemInAnyPage } from './gem-state.mjs';
import { starterGems } from './native-extra.mjs';
import { gemCounts, gemItems } from './gem-stack.mjs';
const gems = new Map(CLIENT_GEMS.map((g) => [g.id, g]));
export function parseGemCompose(body) {
  let at = 0;
  const read = () => {
    if (at + 4 > body.length) throw Error('Truncated gem-compose request');
    const n = body.readInt32BE(at);
    at += 4;
    return n;
  };
  const count = read();
  if (count < 1 || count > 60) throw Error('Invalid gem-compose group count');
  const groups = [];
  for (let i = 0; i < count; i++) {
    const quality = read(),
      part = read(),
      n = read();
    if (n < 1 || n > 60) throw Error('Invalid gem-compose cost count');
    const costs = [];
    for (let j = 0; j < n; j++) costs.push({ id: read(), count: read() });
    groups.push({ quality, part, costs });
  }
  if (at !== body.length) throw Error('Trailing gem-compose request data');
  return groups;
}
export function composeGems(
  groups,
  bag,
  equip,
  seconds,
  locks = [],
  pick = (n) => Math.floor(Math.random() * n),
) {
  const available = gemCounts(bag.ItemData);
  const spend = new Map(),
    outputs = [];
  for (const group of groups) {
    const rule = CLIENT_GEM_COMPOSE.find((r) => r.Quality === group.quality);
    let total = 0;
    if (!rule || ![1, 2, 3, 4, 5, 6].includes(group.part)) return { ret: 1 };
    for (const c of group.costs) {
      const g = gems.get(c.id);
      if (
        !g ||
        g.quality !== rule.NeedQuality ||
        g.part !== group.part ||
        !Number.isInteger(c.count) ||
        c.count <= 0 ||
        c.count > 60 ||
        locks.includes(c.id) ||
        gemInAnyPage(equip, c.id)
      )
        return { ret: 1 };
      total += c.count;
      spend.set(c.id, (spend.get(c.id) || 0) + c.count);
    }
    if (!total || total % rule.NeedNum || total > 60) return { ret: 1 };
    const pool = CLIENT_GEMS.filter(
      (g) =>
        g.quality === group.quality &&
        g.part === group.part &&
        g.id < 999000000 &&
        g.id % 10 === g.quality,
    );
    if (!pool.length) return { ret: 1 };
    for (let i = 0; i < total / rule.NeedNum; i++) outputs.push(pool[pick(pool.length)].id);
  }
  if ([...spend].some(([id, n]) => n > (available.get(id) || 0))) return { ret: 1 };
  for (const [id, n] of spend) available.set(id, available.get(id) - n);
  for (const id of outputs) available.set(id, (available.get(id) || 0) + 1);
  const items = gemItems(available, seconds, locks);
  return {
    ret: 0,
    bag: { IsAll: 1, ItemData: [...items, ...bag.ItemData.filter((i) => i.ItemType !== 3)] },
    rewards: starterGems(seconds, outputs),
  };
}
