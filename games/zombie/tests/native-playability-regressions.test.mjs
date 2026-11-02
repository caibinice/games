import { describe, it, expect } from 'vitest';
import {
  createLocalRole,
  roleSessionReply,
  localRoleData,
  localBattleEntry,
  packRoleStruct,
} from '../tools/local-protocol/role-session.mjs';
import { campaignData } from '../tools/local-protocol/campaign-state.mjs';
import { mechaBattleData, mechaState } from '../tools/local-protocol/extension-state.mjs';
import { shopAction } from '../tools/local-protocol/shop-state.mjs';
import { SHOP_SOURCE as SHOP } from '../tools/local-protocol/shop-source.mjs';
import { MECHA_GROWTH as M, MECHA_BASE } from '../tools/local-protocol/mecha-source.mjs';
import { SKIN_CATALOG as T } from '../tools/local-protocol/skin-catalog.mjs';

const now = 1793600000000;
const p = { freeActions: true, level: 80, gold: 1000, goods: {}, gems: [] };
const base = createLocalRole(
  { name: 'playability-regression', head: 1000, sex: 1, bodyType: 1 },
  now,
);
const req = (cmd, ...values) => {
  const body = Buffer.alloc(values.length * 4);
  values.forEach((n, i) => body.writeUInt32BE(n, i * 4));
  return { cmd, body, echo: 19 };
};
const act = (role, cmd, ...values) => roleSessionReply(req(cmd, ...values), role, now, p);

describe('reported native playability regressions', () => {
  it('never advertises an unearned chest on an unlocked next stage', () => {
    const role = {
      ...base,
      localCampaign: {
        version: 1,
        sequence: 1,
        levels: {
          1001: { wins: 1, bestHp: 100, claims: [1] },
        },
      },
    };
    const data = campaignData(role).UnlockLevelList;
    expect(data.find((r) => r.LevelID === 1001).LevelAwardList).toEqual([
      { StarLevel: 1, IsAward: 1 },
      { StarLevel: 2, IsAward: 0 },
      { StarLevel: 3, IsAward: 0 },
    ]);
    expect(data.find((r) => r.LevelID === 1002).LevelAwardList).toEqual([]);
    expect(data.find((r) => r.LevelID === 2001).LevelAwardList).toEqual([]);
    expect(act(role, 4286, 1, 2, 1).reply.body.readInt32BE()).toBe(1);
  });

  it.each([
    [20, 1],
    [50, 2],
    [99, 2],
    [100, 3],
  ])('advertises only earned stars at HP %s', (hp, stars) => {
    const r = { ...base, battleWins: 1, bestHpRate: hp };
    expect(campaignData(r).UnlockLevelList[0].LevelAwardList).toHaveLength(stars);
  });

  it('automatically unlocks a star-gated skill before the native UI permits its upgrade request', () => {
    let r = act(base, 7301, 3).role;
    expect(act(r, 7311, 3, 2).reply.body.readInt32BE()).toBe(1);
    r = act(r, 7313, 3, 0).role;
    expect(r.localMechas.owned[3].skills[2]).toBe(1);
    let out = act(r, 7311, 3, 2);
    expect(out.reply.body.readInt32BE()).toBe(0);
    expect(out.notifications.map((n) => n.cmd)).toEqual([7300, 7315]);
    r = out.role;
    expect(r.localMechas.owned[3].skills[2]).toBe(2);
    r = act(r, 7311, 3, 2).role;
    expect(r.localMechas.owned[3].skills[2]).toBe(3);
    expect(base.localMechas).toBeUndefined();
  });

  it('activates and levels every source mech skill from a high-star legacy empty-skill save', () => {
    for (const cfg of MECHA_BASE) {
      let r = {
        ...base,
        localMechas: {
          owned: { [cfg.BianShenType]: { level: 1000, star: 10, skills: {} } },
          slots: [cfg.BianShenType],
        },
      };
      const normalized = mechaState(r);
      expect(Object.values(normalized.owned[cfg.BianShenType].skills)).toEqual([1, 1, 1, 1, 1]);
      expect(r.localMechas.owned[cfg.BianShenType].skills).toEqual({});
      r = { ...r, localMechas: normalized };
      for (const slot of M.BianShenSkillActivateConfig.filter(
        (s) => s.BianShenType === cfg.BianShenType,
      )) {
        const max = Math.max(
          ...M.BianShenSkillLvUpConfig.filter(
            (s) => s.BianShenType === cfg.BianShenType && s.SkillPos === slot.SkillPos,
          ).map((s) => s.SkillLv),
        );
        for (let level = 2; level <= max; level++) {
          const out = act(r, 7311, cfg.BianShenType, slot.SkillPos);
          expect(
            out.reply.body.readInt32BE(),
            `${cfg.BianShenType}/${slot.SkillPos}/${level}`,
          ).toBe(0);
          r = out.role;
        }
        expect(r.localMechas.owned[cfg.BianShenType].skills[slot.SkillPos]).toBe(max);
        expect(act(r, 7311, cfg.BianShenType, slot.SkillPos).reply.body.readInt32BE()).toBe(1);
      }
      expect(mechaBattleData(r).BianShenList[0].BianShenSkillList.length).toBe(5);
    }
  });

  it('embeds equipped mech ownership and activated skills in the real battle entry', () => {
    let r = act(base, 7301, 3).role;
    r = act(r, 7303, 1, 3, 0).role;
    const body = Buffer.alloc(13);
    body.writeInt32BE(1001);
    const entry = localBattleEntry(r, { body }, now, p);
    expect(entry.body.includes(packRoleStruct('CSBattleBianShenData', mechaBattleData(r)))).toBe(
      true,
    );
  });

  it('accepts reserved zero from the actual gun skill activation button without skipping the source tree', () => {
    // The native button checks the gun manual before it sends any request.
    expect(
      localRoleData(base, now, p).BagData.ItemData.find((i) => i.ItemID === 90002).StackCnt,
    ).toBeGreaterThanOrEqual(10);
    let r = act(base, 29208, 0).role;
    expect(r.localGuns.skillLevel).toBe(2);
    r = act(r, 29208, 0).role;
    expect(r.localGuns.skillLevel).toBe(3);
    expect(act(r, 29202, 9999).reply.body.readInt32BE()).toBe(1);
  });

  it('upgrades all 49 non-default source guns to their true cap and acknowledges repeated max-level taps', () => {
    for (const id of [...new Set(T.GunUpConfig.map((r) => r.GunID))]) {
      let r = act(base, 29204, id).role;
      const max = Math.max(...T.GunUpConfig.filter((g) => g.GunID === id).map((g) => g.Level));
      for (let i = 1; i <= max + 2; i++) {
        const out = act(r, 29210, id);
        expect(out.reply.body.readInt32BE(), `gun ${id}, tap ${i}`).toBe(0);
        r = out.role;
      }
      expect(r.localGuns.guns[id]).toBe(max);
    }
  });

  it('buys source regular-shop items repeatedly, granting and persisting real inventory', () => {
    let r = base;
    const before =
      localRoleData(r, now, p).BagData.ItemData.find((i) => i.ItemID === 51000)?.StackCnt || 0;
    for (let n = 0; n < 3; n++) {
      const out = act(r, 4300, 2, 101, 2);
      expect(out.reply.cmd).toBe(4301);
      expect(out.reply.body.readInt32BE()).toBe(0);
      expect(out.notifications.some((n) => n.cmd === 2021)).toBe(true);
      r = out.role;
    }
    expect(r.localShop.common[101]).toBe(6);
    expect(
      localRoleData(JSON.parse(JSON.stringify(r)), now, p).BagData.ItemData.find(
        (i) => i.ItemID === 51000,
      ).StackCnt,
    ).toBe(before + 60);
  });

  it('handles the separate native gold-shop endpoint with the source quantity', () => {
    const out = act(base, 4310, 88001);
    expect(out.reply.cmd).toBe(4311);
    expect(out.reply.body.readInt32BE()).toBe(0);
    expect(shopAction(req(4310, 88001), base, p, () => 0).awards[0].AwardItemCnt).toBe(4500);
    expect(localRoleData(out.role, now, p).BaseData.Gold).toBe(1e9);
    expect(act(base, 4310, 99999).reply.body.readInt32BE()).toBe(1);
  });

  it('uses source chest guarantee intervals across requests, rather than resetting every draw', () => {
    let r = base;
    for (let i = 1; i <= 20; i++) {
      const out = shopAction(req(4300, 1, 102, 1), r, p, () => 0);
      expect(out.data.Result.Ret).toBe(0);
      if (i % 10 === 0) {
        const guarantee = SHOP.BootyConfig.find((b) => b.BootyID === 404012);
        expect(out.awards[0].AwardItemID).toBe(guarantee.ItemID);
      }
      r = out.role;
    }
    expect(r.localShop.chests[102]).toBe(20);
  });

  it('opens shop chests into real unlocked gem stacks, not unusable auto-use box placeholders', () => {
    const out = act(base, 4300, 1, 102, 10);
    expect(out.reply.body.readInt32BE()).toBe(0);
    const items = localRoleData(out.role, now, p).BagData.ItemData;
    expect(items.some((i) => i.ItemType === 3)).toBe(true);
    expect(items.some((i) => i.ItemType === 1 && i.ItemID >= 70001 && i.ItemID <= 70007)).toBe(
      false,
    );
  });

  it('rejects bad shop IDs, batches and paid-mode requests without state mutation or disconnection', () => {
    for (const q of [
      req(4300, 2, 9999, 1),
      req(4300, 2, 101, 0),
      req(4300, 1, 102, 101),
      { cmd: 4300, body: Buffer.alloc(2) },
    ]) {
      const out = roleSessionReply(q, base, now, p);
      expect(out.reply.body.readInt32BE()).toBe(1);
      expect(out.role).toBe(base);
    }
    expect(shopAction(req(4300, 2, 101, 1), base, {}, () => 0).data.Result.Ret).toBe(1);
  });
});
