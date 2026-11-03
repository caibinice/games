import { PROGRESSION_SOURCE as S } from './progression-source.mjs';
import { SKIN_CATALOG as G } from './skin-catalog.mjs';

export function roleProgress(role, profile = {}) {
  let level = Math.min(200, profile.level || 1),
    exp = role.localXp || 0;
  const costs = new Map(S.PlayerExpConfig.map((r) => [r.Level, r.Exp]));
  while (level < 200 && costs.get(level) > 0 && exp >= costs.get(level)) {
    exp -= costs.get(level++);
  }
  return { level, exp };
}

export function wallState(role) {
  const s = structuredClone(role.localWall || { level: 1, skills: {} });
  s.skills ||= {};
  for (const r of S.WallConfig)
    if (r.Level <= s.level && r.GroupId)
      s.skills[r.GroupId] = Math.max(1, s.skills[r.GroupId] || 0);
  return s;
}
export function wallData(role) {
  const s = wallState(role);
  return {
    Level: s.level,
    SkillData: Object.entries(s.skills).map(([ID, Level]) => ({ ID: +ID, Level })),
  };
}
export const activeState = (r) => structuredClone(r.localActiveSkills || { owned: {}, slots: {} });
export const ultraState = (r) => structuredClone(r.localUltra || { owned: {}, page: 1, slots: {} });
export function activeBattleSkills(role) {
  const s = activeState(role);
  return Object.entries(s.slots)
    .filter(([, id]) => s.owned[id])
    .map(([Pos, SkillID]) => ({ Pos: +Pos, SkillID, Level: s.owned[SkillID] }));
}
export function ultraBattleData(role) {
  const s = ultraState(role);
  return {
    UsingPageID: s.page,
    UltraWeaponList: Object.entries(s.owned).map(([UltraWeaponID, r]) => ({
      UltraWeaponID: +UltraWeaponID,
      Level: r.level,
      Star: r.star,
    })),
    SlotList: Object.entries(s.slots).map(([key, UltraWeaponID]) => {
      const [PageID, SlotID] = key.split(':').map(Number);
      return { PageID, SlotID, UltraWeaponID };
    }),
  };
}
export function progressionNotifications(role) {
  const a = activeState(role);
  return [
    {
      cmd: 5000,
      type: 'CSNotifyWuXueData',
      data: {
        IsTotal: 1,
        HaveInstallData: 1,
        WuXueList: Object.entries(a.owned).map(([WuXueID, WuXueLevel]) => ({
          WuXueID: +WuXueID,
          WuXueLevel,
        })),
        WuXuePosData: {
          WuXuePosList: Object.entries(a.slots).map(([Pos, WuXueID]) => ({ Pos: +Pos, WuXueID })),
        },
      },
    },
    { cmd: 17309, type: 'CSNotifyUltraWeaponData', data: ultraBattleData(role) },
    {
      cmd: 17107,
      type: 'CSMulChallengeNotifyData',
      data: {
        TicketCnt: 1000000,
        DailyLeftChallengeNum: 1000000,
        DailyTotalChallengeNum: 1000000,
        LevelList: S.RescueLevels.map((r) => ({ LevelID: r.LevelID, EffectID: 0 })),
      },
    },
  ];
}

// Profile stats are legacy save baselines, not permanent final stats. Apply the
// source equipment delta relative to the original level-1 starter equipment.
export function equipmentStats(equip) {
  let attack = 0,
    hp = 0,
    starterAttack = 0;
  for (const item of equip.EquipList) {
    const cfg = G.EquipConfig.find((r) => r.ItemID === item.ItemID),
      d = item.Detail.EquipDetail;
    if (!cfg) continue;
    const up = G.EquipUpLevelConfig.find((r) => r.Type === cfg.Type && r.Level === d.Level);
    const prefix = G.EquipPrefixParamConfig.find(
      (r) => r.Stage === cfg.PinJie && r.Quality === d.Quality && r.Prefix === d.Prefix,
    );
    const factor = Math.max(0, 1 + (prefix?.LevelParam || 0));
    for (const a of [...cfg.ImpactData, ...(up?.ImpactData || [])]) {
      if (a.DataType === 103) attack += a.Value * factor;
      if (a.DataType === 101) hp += a.Value * factor;
    }
    const base = G.EquipConfig.find((r) => r.Type === cfg.Type && r.PinJie === 1);
    const first = G.EquipUpLevelConfig.find((r) => r.Type === cfg.Type && r.Level === 1);
    starterAttack += [...(base?.ImpactData || []), ...(first?.ImpactData || [])]
      .filter((r) => r.DataType === 103)
      .reduce((n, r) => n + r.Value * 0.5, 0);
  }
  return {
    attack: Math.max(0, attack - starterAttack),
    hp,
    fight: Math.round(attack),
    deltaFight: Math.round(attack - starterAttack),
  };
}

export const progressionCommands = new Set([
  5001, 5003, 5005, 5007, 14500, 14502, 17301, 17303, 17305, 17307, 17310,
]);
export function progressionAction(q, role, p) {
  const types = {
    5001: 'CSStudyWuXueRes',
    5003: 'CSUpWuXueLvRes',
    5005: 'CSInstallWuXueRes',
    5007: 'CSUninstallWuXueRes',
    14500: 'CSUpgradeWalllevelRes',
    14502: 'CSUpgradeWallSkillRes',
    17301: 'CSUltraWeaponActivateRes',
    17303: 'CSUltraWeaponUplevelRes',
    17305: 'CSUltraWeaponUpStarRes',
    17307: 'CSUltraWeaponArmRes',
    17310: 'CSUltraWeaponChangePageRes',
  };
  const out = (r = role, ret = 0) => ({
    role: r,
    cmd: q.cmd + 1,
    type: types[q.cmd],
    data: { Result: { Ret: ret } },
    dirtyRole: !ret,
    notifications: ret ? [] : progressionNotifications(r),
  });
  const fail = () => out(role, 1),
    b = q.body,
    uint = (at = 0) => b.readUInt32BE(at);
  const size = {
    5001: 4,
    5003: 4,
    5005: 5,
    5007: 1,
    14500: 4,
    14502: 4,
    17301: 8,
    17303: 4,
    17305: 4,
    17307: 16,
    17310: 4,
  };
  if (!p.freeActions || b.length !== size[q.cmd]) return fail();
  if (q.cmd >= 5001 && q.cmd <= 5007) {
    const s = activeState(role);
    if (q.cmd === 5007) {
      if (b[0] < 1 || b[0] > 3) return fail();
      delete s.slots[b[0]];
    } else {
      const id = uint(),
        cfg = S.WuXueBaseConfig.find((r) => r.WuXueID === id);
      if (!cfg) return fail();
      if (q.cmd === 5001) s.owned[id] ||= 1;
      if (q.cmd === 5003) {
        if (!s.owned[id]) return fail();
        const next = S.WuXueLevelUpConfig.find((r) => r.ID === id && r.Level === s.owned[id] + 1);
        if (!next) return fail();
        s.owned[id]++;
      }
      if (q.cmd === 5005) {
        const pos = b[4];
        if (!s.owned[id] || pos < 1 || pos > 3) return fail();
        for (const [slot, old] of Object.entries(s.slots)) if (old === id) delete s.slots[slot];
        s.slots[pos] = id;
      }
    }
    return out({ ...role, localActiveSkills: s });
  }
  if ([14500, 14502].includes(q.cmd)) {
    const s = wallState(role);
    if (q.cmd === 14500) {
      if (!S.WallConfig.some((r) => r.Level === s.level + 1)) return fail();
      s.level++;
    } else {
      const id = uint(),
        level = s.skills[id];
      if (!level || !S.WallSkillLevelConfig.some((r) => r.GroupId === id && r.Level === level + 1))
        return fail();
      s.skills[id]++;
    }
    return out({ ...role, localWall: wallState({ ...role, localWall: s }) });
  }
  const s = ultraState(role),
    id = uint();
  if (q.cmd === 17310) {
    if (id < 1 || id > 3) return fail();
    s.page = id;
  } else {
    const cfg = S.UltraWeaponBaseConfig.find((r) => r.UltraWeaponID === id);
    if (!cfg) return fail();
    if (q.cmd === 17301) {
      if (uint(4) > 1) return fail();
      s.owned[id] ||= { level: 0, star: 1 };
    } else {
      const own = s.owned[id];
      if (!own) return fail();
      if (q.cmd === 17303) {
        if (
          !S.UltraWeaponUpLevelConfig.some(
            (r) => r.UltraWeaponID === id && r.QualityLevel === own.level + 1,
          )
        )
          return fail();
        own.level++;
      } else if (q.cmd === 17305) {
        if (
          !S.UltraWeaponUpStarConfig.some((r) => r.UltraWeaponID === id && r.Star === own.star + 1)
        )
          return fail();
        own.star++;
      } else if (q.cmd === 17307) {
        const page = uint(4),
          slot = uint(8),
          remove = uint(12);
        const conf = S.UltraWeaponSlotConfig.find((r) => r.SlotID === slot);
        if (
          page < 1 ||
          page > 3 ||
          !conf ||
          remove > 1 ||
          conf.UnlockLevel > roleProgress(role, p).level
        )
          return fail();
        if (remove) delete s.slots[page + ':' + slot];
        else {
          for (const [key, old] of Object.entries(s.slots))
            if (key.startsWith(page + ':') && old === id) delete s.slots[key];
          s.slots[page + ':' + slot] = id;
        }
      }
    }
  }
  return out({ ...role, localUltra: s });
}
