import { CLIENT_STAGES, CLIENT_MONSTERS, CLIENT_XP } from './client-data.mjs';
import { CAMPAIGN_ENTRIES, ELITE_ENTRIES, EXTRA_MONSTERS } from './client-expanded.mjs';
import { CAMPAIGN_LEVEL_COUNT } from './campaign-limits.mjs';

export function clientStage(level, elite = false) {
  const i = Math.max(0, Math.min(CAMPAIGN_LEVEL_COUNT - 1, (Math.trunc(level) || 1) - 1));
  return !elite && i < CLIENT_STAGES.length
    ? CLIENT_STAGES[i]
    : (elite ? ELITE_ENTRIES : CAMPAIGN_ENTRIES)[i];
}
const cache = new Map();
let activityCatalog;
async function readJson(file) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(new URL(file, import.meta.url), { signal: controller.signal });
    if (!r.ok) throw Error('关卡资源加载失败，请重试');
    return await r.json();
  } catch (e) {
    if (e.name === 'AbortError') throw Error('关卡加载超时，请重试');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export async function loadActivities() {
  if (!activityCatalog)
    activityCatalog = await readJson('./assets/client-campaign/activities.json');
  return activityCatalog;
}
export async function loadClientStage(level, elite = false, activityId = null) {
  const entry = activityId
    ? (await loadActivities()).find((x) => x.LevelID === activityId)
    : clientStage(level, elite);
  if (!entry || entry.available === false) throw Error('参考包未内置这个关卡的波次文件');
  if (!activityId && !elite && entry.waves instanceof Array) return entry;
  if (cache.has(entry.LevelID)) return cache.get(entry.LevelID);
  const chunk = await readJson(entry.file),
    data = chunk[entry.LevelID];
  if (
    !data ||
    data.LevelID !== entry.LevelID ||
    !Array.isArray(data.waveRows) ||
    data.waveRows.length > 5000 ||
    data.waveFields.length !== 25
  )
    throw Error('关卡数据格式异常');
  const sourceWaves = data.waveRows.map((row) =>
    Object.fromEntries(data.waveFields.map((key, i) => [key, row[i]])),
  );
  const pool = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const waves = sourceWaves.map((w, i) => ({
    ...w,
    MonsterID: clientMonster(w.MonsterID) ? w.MonsterID : pool[i % pool.length],
    sourceMonsterID: w.MonsterID,
  }));
  // Timed campaign data is exact. PvP/random-library/zero-time endless modes
  // retain source fields but use the explicitly labelled web challenge adapter.
  if (waves.length > 1 && waves.every((w) => w.TriggerTime === 0)) {
    let elapsed = 0;
    for (const n of [...new Set(waves.map((w) => w.Wave))].sort((a, b) => a - b)) {
      const group = waves.filter((w) => w.Wave === n);
      for (const w of group) w.TriggerTime = elapsed;
      elapsed += Math.max(
        15,
        ...group.map(
          (w) =>
            (Math.max(1, w.MonsterNum) / Math.max(1, w.SingleRefreshNum)) *
              Math.max(0.1, w.Interval) +
            5,
        ),
      );
    }
  }
  const stage = { ...data, level: entry.level || 1, waves, sourceWaves, activity: !!activityId };
  cache.set(entry.LevelID, stage);
  while (cache.size > 16) cache.delete(cache.keys().next().value);
  return stage;
}
// Native LevelWaveItemConfig::.ctor (arm64 RVA 0x11BE0F0): truncate
// MonsterNum * random(1 - MonsterNumRangeRatio, 1 + MonsterNumRangeRatio).
// The web PRNG remains independently seeded; it is not the native TSRandom stream.
export function clientPlan(stage, random) {
  return stage.waves.map((config) => ({
    config,
    spawned: 0,
    total:
      config.MonsterNumRangeRatio > 0
        ? Math.trunc(
            config.MonsterNum *
              (1 - config.MonsterNumRangeRatio + random() * 2 * config.MonsterNumRangeRatio),
          )
        : config.MonsterNum,
    next: config.TriggerTime,
  }));
}
export function clientXp(rank) {
  const row = CLIENT_XP.find((x) => x.ID === 1 && x.Level === rank);
  return row?.Exp || 40;
}
export function clientMonster(id) {
  return EXTRA_MONSTERS[id] || CLIENT_MONSTERS[id];
}
export function clientEnemyType(monster) {
  if (monster.Type === 2) return 'boss';
  const kind = monster.MonsterID % 1000;
  if (kind === 20) return 'runner';
  if (kind === 80 || kind === 110) return 'armor';
  if (kind === 120) return 'bomber';
  if ([150, 180, 210, 220].includes(kind)) return 'brute';
  return 'walker';
}
