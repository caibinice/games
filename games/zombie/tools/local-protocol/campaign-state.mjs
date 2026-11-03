import { CAMPAIGN_ENTRIES, ELITE_ENTRIES } from '../../public/client-expanded.mjs';
import { ACTIVITY_LEVELS } from './activity-level-source.mjs';
import { PROGRESSION_SOURCE } from './progression-source.mjs';
const entries = [...CAMPAIGN_ENTRIES, ...ELITE_ENTRIES, ...PROGRESSION_SOURCE.RescueLevels],
  known = new Map(
    [...entries, ...ACTIVITY_LEVELS.filter((r) => [3, 4, 8].includes(r.LevelType))].map((r) => [
      r.LevelID,
      r,
    ]),
  );
export const isMazeBattle = (role) =>
  known.get(role.pendingBattle?.level)?.LevelType === 8 && !!role.localMaze?.pending;
export function campaignState(role) {
  const saved = role.localCampaign;
  if (saved?.version === 1 && saved.levels && typeof saved.levels === 'object')
    return structuredClone(saved);
  return {
    version: 1,
    sequence: 0,
    levels: role.battleWins
      ? { 1001: { wins: role.battleWins, bestHp: role.bestHpRate || 0, claims: [] } }
      : {},
  };
}
export function campaignUnlocked(role, id) {
  const row = known.get(id);
  if (!row) return false;
  const s = campaignState(role);
  // Personal-server challenge modes stay open; they are not normal chapters.
  if ([3, 4, 6].includes(row.LevelType)) return true;
  if (row.LevelType === 8) return !!role.localMaze?.pending;
  if (row.level === 1) return row.LevelType === 1 || !!s.levels[1001]?.wins;
  return !!s.levels[id - 1]?.wins;
}
export function campaignData(role) {
  const s = campaignState(role);
  return {
    UnlockLevelList: entries
      .filter((r) => campaignUnlocked(role, r.LevelID) || s.levels[r.LevelID])
      .map((r) => {
        const d = s.levels[r.LevelID] || {};
        return {
          LevelID: r.LevelID,
          FinLevelCnt: d.wins || 0,
          LastMaxHpRate: d.bestHp || 0,
          // Native UpdateShow treats an unclaimed entry as immediately claimable;
          // it does not re-check wins/HP. Never advertise unearned star chests.
          LevelAwardList: [1, 2, 3]
            .filter((star) => d.wins && star <= (d.bestHp >= 100 ? 3 : d.bestHp >= 50 ? 2 : 1))
            .map((StarLevel) => ({
              StarLevel,
              IsAward: (d.claims || []).includes(StarLevel) ? 1 : 0,
            })),
        };
      }),
  };
}
export function startCampaign(role, id, seconds) {
  if (!campaignUnlocked(role, id)) return null;
  const s = campaignState(role);
  s.sequence++;
  return {
    ...role,
    localCampaign: s,
    pendingBattle: { id: String(9000001000 + s.sequence), level: id, started: seconds },
  };
}
export function campaignAwards(id) {
  const row = known.get(id);
  if (!row) return [];
  const a = (AwardItemType, AwardItemID, AwardItemCnt) => ({
    AwardItemType,
    AwardItemID,
    AwardItemCnt,
  });
  // Explicit personal-server rewards. Live BootyID definitions are not bundled
  // in this APK; never advertise invented rates as the original server pool.
  return [
    a(2, 99002, 1000 + row.level * 50),
    a(2, 99004, 50 + row.level * 5),
    a(1, 61001 + ((row.level - 1) % 14), 10),
    a(1, 50001 + ((row.level - 1) % 6), 5),
    a(1, 1001, 10),
  ];
}
export function claimCampaignStar(role, chapter, level, star) {
  const id = level >= 1001 ? level : chapter * 1000 + level,
    s = campaignState(role),
    entry = s.levels[id],
    earned = entry?.wins ? (entry.bestHp >= 100 ? 3 : entry.bestHp >= 50 ? 2 : 1) : 0;
  if (!entry || star < 1 || star > earned || (entry.claims || []).includes(star)) return null;
  entry.claims = [...(entry.claims || []), star];
  return { role: { ...role, localCampaign: s }, awards: campaignAwards(id) };
}
export function settleCampaign(role, fin, seconds) {
  if (role.lastSettlement?.battleId === fin.BattleGID)
    return { role, ...role.lastSettlement, replayed: true };
  const battle = role.pendingBattle;
  if (!battle || battle.id !== fin.BattleGID) return null;
  const won = fin.IsWin === 1 && fin.IsFin === 1,
    s = campaignState(role),
    old = s.levels[battle.level] || { wins: 0, bestHp: 0, claims: [] };
  if (won)
    s.levels[battle.level] = {
      ...old,
      wins: old.wins + 1,
      bestHp: Math.max(old.bestHp, fin.HpRate),
    };
  const data = {
    LevelID: battle.level,
    IsWin: won ? 1 : 0,
    StarLevel: won ? (fin.HpRate >= 100 ? 3 : fin.HpRate >= 50 ? 2 : 1) : 0,
    CurHpRate: fin.HpRate,
    IsNewRecord: won && fin.HpRate > old.bestHp ? 1 : 0,
    BattleDurationTime: Math.max(0, seconds - battle.started),
    IsHalfWayFin: fin.IsHalfWayFin,
  };
  const awards = won ? campaignAwards(battle.level) : [],
    lastSettlement = { battleId: battle.id, data, awards };
  return {
    role: {
      ...role,
      pendingBattle: null,
      localCampaign: s,
      battleWins: (role.battleWins || 0) + (won ? 1 : 0),
      bestHpRate: Math.max(role.bestHpRate || 0, won ? fin.HpRate : 0),
      lastSettlement,
    },
    ...lastSettlement,
    replayed: false,
  };
}
