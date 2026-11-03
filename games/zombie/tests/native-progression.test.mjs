import { describe, it, expect } from 'vitest';
import {
  createLocalRole,
  localRoleData,
  roleSessionReply,
  localBattleEntry,
  packRoleStruct,
} from '../tools/local-protocol/role-session.mjs';
import {
  roleProgress,
  wallData,
  activeBattleSkills,
  ultraBattleData,
} from '../tools/local-protocol/progression-state.mjs';
import { PROGRESSION_SOURCE as S } from '../tools/local-protocol/progression-source.mjs';
import { SKIN_CATALOG as G } from '../tools/local-protocol/skin-catalog.mjs';
import { patrolAwards } from '../tools/local-protocol/service-state.mjs';
import { createChipItem } from '../tools/local-protocol/chip-state.mjs';

const now = 1793660000000,
  p = { freeActions: true, level: 30, gold: 1000, gems: [], fight: 1000, attack: 100, maxHp: 5000 };
const base = createLocalRole(
  { name: 'progression-regression', head: 1000, sex: 1, bodyType: 1 },
  now,
);
const req = (cmd, ...v) => {
  const body = Buffer.alloc(v.length * 4);
  v.forEach((n, i) => body.writeUInt32BE(n, i * 4));
  return { cmd, body, echo: 11 };
};
const act = (r, cmd, ...v) => roleSessionReply(req(cmd, ...v), r, now, p);
const data = (r) => localRoleData(r, now, p);
const start = (r) => {
  const body = Buffer.alloc(13);
  body.writeInt32BE(1001);
  return localBattleEntry(r, { body }, now, p).body;
};

describe('native persistent progression', () => {
  it('consumes source experience thresholds, migrates old total XP, and preserves residual experience on reload', () => {
    const r = { ...base, localXp: 216 + 230 + 7 };
    expect(roleProgress(r, p)).toEqual({ level: 32, exp: 7 });
    expect(data(JSON.parse(JSON.stringify(r))).BaseData).toMatchObject({ Level: 32, Exp: 7 });
    expect(r.localXp).toBe(453);
    expect(roleProgress({ ...base, localXp: 1e9 }, p).level).toBe(200);
  });

  it('increments actual combat attack and both fight displays after strengthening', () => {
    const before = data(base),
      body = Buffer.alloc(5);
    body.writeUInt32BE(91001);
    body[4] = 1;
    const out = roleSessionReply({ cmd: 4217, body }, base, now, p),
      after = data(out.role);
    expect(after.AttrData.Atk).toBeGreaterThan(before.AttrData.Atk);
    expect(after.BaseData.FightVal).toBeGreaterThan(before.BaseData.FightVal);
    expect(after.EquipData.FightVal).toBeGreaterThan(before.EquipData.FightVal);
    expect(
      out.notifications[0].body.includes(packRoleStruct('CSActorAttrData', after.AttrData)),
    ).toBe(true);
  });

  it('uses all source quality/prefix grades, never skipping an intermediate grade', () => {
    for (const gid of [91001, 91002, 91003, 91004, 91005, 91006]) {
      let r = base,
        previous = data(r).BaseData.FightVal;
      const path = G.EquipReforgeConfig.filter((x) => x.EquipPinJie === 1).sort(
        (a, b) => a.Quality - b.Quality || a.Prefix - b.Prefix,
      );
      for (const grade of path.slice(1)) {
        const out = act(r, 4219, gid);
        expect(out.reply.body.readInt32BE()).toBe(0);
        r = out.role;
        const d = data(r),
          detail = d.EquipData.EquipList.find((i) => i.ItemGID === gid).Detail.EquipDetail;
        expect(detail).toMatchObject({
          Quality: grade.Quality,
          Prefix: grade.Prefix,
          InitQuality: 1,
        });
        expect(d.BaseData.FightVal).toBeGreaterThanOrEqual(previous);
        previous = d.BaseData.FightVal;
      }
      expect(act(r, 4219, gid).reply.body.readInt32BE()).toBe(1);
    }
  });

  it('activates, upgrades, equips and uninstalls a pioneer skill with the actual five-byte install request', () => {
    let r = act(base, 5001, 10001).role;
    r = act(r, 5003, 10001).role;
    const body = Buffer.alloc(5);
    body.writeUInt32BE(10001);
    body[4] = 1;
    const out = roleSessionReply({ cmd: 5005, body }, r, now, p);
    r = out.role;
    expect(out.reply.body.readInt32BE()).toBe(0);
    expect(activeBattleSkills(r)).toEqual([{ Pos: 1, SkillID: 10001, Level: 2 }]);
    expect(start(r).includes(packRoleStruct('ZhaoShiSkillEntry', activeBattleSkills(r)[0]))).toBe(
      true,
    );
    expect(data(r).AttrData.MaxMp).toBeGreaterThanOrEqual(
      S.WuXueBaseConfig.find((x) => x.WuXueID === 10001).Fury,
    );
    const removed = roleSessionReply({ cmd: 5007, body: Buffer.from([1]) }, r, now, p);
    expect(activeBattleSkills(removed.role)).toEqual([]);
  });

  it('upgrades each of the 17 pioneer skills through its source level table', () => {
    for (const cfg of S.WuXueBaseConfig) {
      let r = act(base, 5001, cfg.WuXueID).role;
      const max = Math.max(
        ...S.WuXueLevelUpConfig.filter((x) => x.ID === cfg.WuXueID).map((x) => x.Level),
      );
      for (let n = 2; n <= max; n++) {
        const out = act(r, 5003, cfg.WuXueID);
        expect(out.reply.body.readInt32BE()).toBe(0);
        r = out.role;
      }
      expect(r.localActiveSkills.owned[cfg.WuXueID]).toBe(max);
      expect(act(r, 5003, cfg.WuXueID).reply.body.readInt32BE()).toBe(1);
    }
  });

  it('activates, strengthens, stars and installs ultra weapons on isolated pages and sends battle data', () => {
    let r = act(base, 17301, 401, 0).role;
    r = act(r, 17303, 401).role;
    r = act(r, 17305, 401).role;
    let out = act(r, 17307, 401, 1, 1, 0);
    r = out.role;
    expect(out.reply.body.readInt32BE()).toBe(0);
    expect(ultraBattleData(r)).toMatchObject({
      UsingPageID: 1,
      UltraWeaponList: [{ UltraWeaponID: 401, Level: 1, Star: 2 }],
      SlotList: [{ PageID: 1, SlotID: 1, UltraWeaponID: 401 }],
    });
    expect(start(r).includes(packRoleStruct('CSBattleUltraWeaponData', ultraBattleData(r)))).toBe(
      true,
    );
    r = act(r, 17310, 2).role;
    expect(ultraBattleData(r).UsingPageID).toBe(2);
    r = act(r, 17307, 401, 1, 1, 1).role;
    expect(ultraBattleData(r).SlotList).toEqual([]);
  });

  it('unlocks wall skills at real wall thresholds and carries the upgraded skills into the combat packet', () => {
    let r = base;
    for (let level = 2; level <= 9; level++) {
      const out = act(r, 14500, 0);
      expect(out.reply.body.readInt32BE()).toBe(0);
      r = out.role;
    }
    expect(wallData(r)).toMatchObject({ Level: 9, SkillData: [{ ID: 101, Level: 1 }] });
    expect(data(r).AttrData.MaxHp).toBeGreaterThan(p.maxHp);
    r = act(r, 14502, 101).role;
    expect(wallData(r).SkillData[0].Level).toBe(2);
    expect(start(r).includes(packRoleStruct('CSBattleWallData', { BattleWall: wallData(r) }))).toBe(
      true,
    );
  });

  it('varies patrol materials while preserving preview/grant agreement and adding gems', () => {
    const found = new Set();
    let r = base;
    for (let n = 0; n < 24; n++) {
      const preview = patrolAwards(r);
      expect(patrolAwards(r)).toEqual(preview);
      found.add(preview.find((x) => x.AwardItemID >= 50001 && x.AwardItemID <= 50006).AwardItemID);
      const out = roleSessionReply({ cmd: 12323, body: Buffer.from([0]) }, r, now, p);
      expect(
        out.reply.body.includes(packRoleStruct('CSBootyAwardList', { AwardItem: preview })),
      ).toBe(true);
      r = out.role;
    }
    expect(found.size).toBeGreaterThan(3);
    expect(
      data(r)
        .BagData.ItemData.filter((x) => x.ItemType === 3)
        .reduce((n, x) => n + x.StackCnt, 0),
    ).toBe(24);
    expect(data(r).BaseData.Level).toBeGreaterThan(30);
  });

  it('opens a chip box into typed native chip items, consumes boxes and preserves chips after an unrelated inventory save', () => {
    const profile = { ...p, goods: { 201201: 3 } };
    const original = localRoleData(base, now, profile).BagData.ItemData.find(
      (x) => x.ItemID === 201201,
    );
    const body = Buffer.alloc(16);
    body.writeUInt32BE(original.ItemGID);
    body.writeUInt32BE(2, 4);
    body.writeUInt32BE(original.ItemID, 8);
    const out = roleSessionReply({ cmd: 4007, body }, base, now, profile);
    expect(out.reply.cmd).toBe(4008);
    expect(out.reply.body.readInt32BE()).toBe(0);
    let r = out.role;
    expect(r.localChips).toHaveLength(2);
    expect(
      localRoleData(r, now, profile).BagData.ItemData.find((x) => x.ItemID === 201201).StackCnt,
    ).toBe(1);
    expect(new Set(r.localChips.map((x) => x.ItemGID)).size).toBe(2);
    for (const chip of r.localChips) {
      expect(chip.ItemType).toBe(4);
      expect(chip.Detail.ChipDetail.MainAffix).toBeGreaterThan(0);
      expect(packRoleStruct('CSItemData', chip).length).toBeGreaterThan(35);
    }
    r = roleSessionReply({ cmd: 12323, body: Buffer.from([0]) }, r, now, profile).role;
    expect(
      localRoleData(JSON.parse(JSON.stringify(r)), now, profile).BagData.ItemData.filter(
        (x) => x.ItemType === 4,
      ),
    ).toHaveLength(2);
  });

  it('creates valid source main affixes for all 52 chips', () => {
    for (const cfg of S.ChipConfig) {
      const item = createChipItem(cfg.ItemID, { ItemData: [] }, 1, () => 0);
      expect(
        S.ChipMainAffixLevelConfig.some(
          (r) => r.MainAffixID === item.Detail.ChipDetail.MainAffix && r.Level === 1,
        ),
      ).toBe(true);
    }
  });

  it('pushes function-open state during login instead of relying on an optional cached client query', () => {
    const body = Buffer.alloc(12);
    body.writeBigUInt64BE(BigInt(base.id));
    const out = roleSessionReply({ cmd: 2005, body }, base, now, p);
    expect(out.notifications.map((x) => x.cmd)).toEqual(
      expect.arrayContaining([3014, 5000, 17309, 17107, 4183, 4185]),
    );
  });

  it('advertises real rescue-level IDs and accepts their native start request', () => {
    const unlocked = data(base).LevelData.UnlockLevelList.map((r) => r.LevelID);
    for (const row of S.RescueLevels) {
      expect(unlocked).toContain(row.LevelID);
      const body = Buffer.alloc(13);
      body.writeUInt32BE(row.LevelID);
      const out = roleSessionReply({ cmd: 4251, body }, base, now, p);
      expect(out.reply.body.readInt32BE()).toBe(0);
      expect(out.role.pendingBattle.level).toBe(row.LevelID);
      expect(out.notifications[0].cmd).toBe(4253);
    }
  });
});
