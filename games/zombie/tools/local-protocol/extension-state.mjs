import { SKIN_CATALOG as T } from './skin-catalog.mjs';
import { growthState, skinLoadout } from './growth-state.mjs';
import { MECHA_BASE, MECHA_GROWTH as M } from './mecha-source.mjs';
export function gunState(role) {
  return structuredClone(role.localGuns || { guns: { 1: 1 }, current: 1, skillLevel: 1 });
}
export function gunData(role) {
  const s = gunState(role);
  return {
    GunList: Object.entries(s.guns).map(([GunID, GunLevel]) => ({
      GunID: Number(GunID),
      GunLevel,
    })),
    GunSkillLevel: s.skillLevel,
    CurGunID: s.current,
  };
}
export function mechaState(role) {
  const s = structuredClone(role.localMechas || { owned: {}, slots: [] });
  // The native skill button is disabled for level 0 even when the star gate is
  // met. Star rewards must activate their skills in notifications, including
  // legacy saves created before this rule was implemented.
  for (const [id, own] of Object.entries(s.owned)) {
    own.skills ||= {};
    for (const cfg of M.BianShenSkillActivateConfig) {
      if (
        cfg.BianShenType === Number(id) &&
        cfg.NeedBianShenStarLv <= own.star &&
        M.BianShenSkillLvUpConfig.some(
          (r) =>
            r.BianShenType === Number(id) &&
            r.SkillPos === cfg.SkillPos &&
            r.SkillLv === 1 &&
            r.NeedBianShenLv <= own.level,
        )
      )
        own.skills[cfg.SkillPos] = Math.max(1, own.skills[cfg.SkillPos] || 0);
    }
  }
  return s;
}
export function mechaBattleData(role) {
  const s = mechaState(role);
  return {
    BianShenList: s.slots
      .filter((id) => id && s.owned[id])
      .map((id) => ({
        BianShenType: id,
        StarLevel: s.owned[id].star,
        BianShenSkillList: Object.entries(s.owned[id].skills || {}).map(([SkillPos, Level]) => ({
          SkillPos: Number(SkillPos),
          Level,
        })),
        SubAffixList: [],
        SuitAffixList: [],
      })),
  };
}
export function mechaNotifications(role) {
  const s = mechaState(role);
  return [
    {
      cmd: 7300,
      type: 'CSNotifyBianShenData',
      data: {
        IsTotal: 1,
        BianShenList: Object.entries(s.owned).map(([id, r]) => ({
          BianShenType: Number(id),
          Level: r.level,
          StarLevel: r.star,
          BianShenSkillList: Object.entries(r.skills || {}).map(([SkillPos, Level]) => ({
            SkillPos: Number(SkillPos),
            Level,
          })),
          ChipList: [],
        })),
      },
    },
    { cmd: 7315, type: 'CSNotifyBianShenFightData', data: { FightList: s.slots } },
  ];
}
export const extensionCommands = new Set([
  29202, 29204, 29206, 29208, 29210, 29308, 29310, 7301, 7303, 7305, 7307, 7309, 7311, 7313, 12812,
  2007,
]);
export function extensionAction(q, role, p) {
  const c = q.cmd,
    b = q.body,
    fail = (type, extra = {}) => ({
      role,
      cmd: c + 1,
      type,
      data: { ...extra, Result: { Ret: 1 } },
    }),
    ok = (type, r = role, extra = {}) => ({
      role: r,
      cmd: c + 1,
      type,
      data: { ...extra, Result: { Ret: 0 } },
    });
  const uint = (at = 0) => b.readUInt32BE(at),
    size = (n) => {
      if (b.length !== n) throw Error('Invalid extension request length');
    };
  if (c === 12812) {
    size(4);
    return ok('CSAdActivateQueryRes', role, { AdType: uint(), IsActivate: 1 });
  }
  if (c === 2007) {
    size(1);
    return { role, cmd: 2008, type: 'CSActLogoutRes', data: { GameReason: 0, GameReasonStr: '' } };
  }
  if ([29308, 29310].includes(c)) {
    const s = growthState(role, p);
    s.pages ||= {};
    s.extra ||= {};
    const type = c === 29308 ? (size(20), uint(4)) : (size(8), uint()),
      page = c === 29308 ? uint(16) : uint(4),
      response = c === 29308 ? 'CSSkinExtraRes' : 'CSSkinExtraChangePageRes';
    if (![1, 2, 3, 4, 5].includes(type) || page < 0 || page > 4) return fail(response);
    if (c === 29310) {
      s.pages[type] = page;
      if ([1, 2, 4, 5].includes(type)) s.pages[type < 3 ? type + 3 : type - 3] = page;
    } else {
      const id = uint(),
        slot = uint(8),
        sub = uint(12),
        cfg = T.SkinBaseConfig.find((r) => r.SkinID === id),
        storageType = slot === 4 && [1, 2].includes(type) ? type + 3 : type,
        slots = skinLoadout(s, storageType, page),
        entry = slots.find((r) => r.Slot === slot);
      const sourceType = cfg?.SkinType,
        targetType = sourceType === 4 ? 1 : sourceType === 5 ? 2 : sourceType;
      if (
        !entry ||
        sub > 3 ||
        (id && (!s.skins[id] || (targetType !== type && sourceType !== type)))
      )
        return fail(response, { SkinID: id, SkinType: type, Slot: slot });
      if (sub === 0 || sub === 1) {
        entry.EffectSkinID = id;
        const group = T.SkinBaseConfig.find((r) => r.SkinID === id)?.GroupID;
        for (const child of entry.SubSlotEntry) {
          if (child.SubID === 1) child.SlotSkinID = id;
          else if (
            !id ||
            T.SkinBaseConfig.find((r) => r.SkinID === child.SlotSkinID)?.GroupID !== group
          )
            child.SlotSkinID = 0;
        }
      } else {
        const target = entry.SubSlotEntry.find((r) => r.SubID === sub);
        if (!target) return fail(response);
        target.SlotSkinID = id;
      }
      s.extra[storageType] ||= {};
      s.extra[storageType][page] = slots;
      s.pages[storageType] = page;
      return {
        ...ok(response, { ...role, localGrowth: s }, { SkinID: id, SkinType: type, Slot: slot }),
        dirty: true,
      };
    }
    return { ...ok(response, { ...role, localGrowth: s }), dirty: true };
  }
  if (c >= 29202 && c <= 29210) {
    size(4);
    const id = uint(),
      s = gunState(role),
      types = {
        29202: 'CSGunSkillUpLevelRes',
        29204: 'CSGunUnlockRes',
        29206: 'CSUseGunRes',
        29208: 'CSGunSkillUnlockRes',
        29210: 'CSGunUpRes',
      },
      type = types[c];
    if ([29202, 29208].includes(c)) {
      // The actual activation button sends a reserved GunSkillID=0.
      const target = id || s.skillLevel + 1;
      if (
        !T.GunSkillConfig.some((r) => r.GunSkillLevel === target) ||
        !p.freeActions ||
        target > s.skillLevel + 1
      )
        return fail(type);
      s.skillLevel = Math.max(s.skillLevel, target);
    } else {
      const cfg = T.GunBaseConfig.find((r) => r.ID === id);
      if (!cfg) return fail(type);
      if (c === 29204) {
        if (s.guns[id] || !p.freeActions) return fail(type);
        s.guns[id] = 1;
      }
      if (c === 29206) {
        if (!s.guns[id]) return fail(type);
        s.current = id;
      }
      if (c === 29210) {
        const level = s.guns[id];
        const levels = T.GunUpConfig.filter((r) => r.GunID === id);
        if (!level || !p.freeActions || !levels.length) return fail(type);
        // At the source cap (5), a repeated tap is an acknowledged no-op, not
        // a network failure. Never invent a level without client configuration.
        if (levels.some((r) => r.Level === level + 1)) s.guns[id]++;
        else if (level !== Math.max(...levels.map((r) => r.Level))) return fail(type);
      }
    }
    return {
      ...ok(
        type,
        { ...role, localGuns: s },
        c === 29202 ? { GunSkillID: id, SkillLevel: s.skillLevel } : {},
      ),
      dirty: true,
    };
  }
  if (c >= 7301 && c <= 7313) {
    const s = mechaState(role),
      types = {
        7301: 'CSActivateBianShenRes',
        7303: 'CSWearBianShenRes',
        7305: 'CSUnWearBianShenRes',
        7307: 'CSBianShenUpLvRes',
        7309: 'CSActivateBianShenSkillRes',
        7311: 'CSBianShenSkillUpLvRes',
        7313: 'CSBianShenUpStarLvRes',
      },
      type = types[c];
    if (c === 7303) {
      if (b.length < 4) return fail(type);
      const count = uint();
      if (count > 3 || b.length !== 4 + count * 8) return fail(type);
      const slots = [0, 0, 0];
      for (let i = 0; i < count; i++) {
        const id = uint(4 + i * 8),
          idx = uint(8 + i * 8);
        if ((id && !s.owned[id]) || idx > 2 || slots[idx]) return fail(type);
        slots[idx] = id;
      }
      s.slots = slots;
    } else {
      size([7309, 7311, 7313].includes(c) ? 8 : 4);
      const id = uint(),
        cfg = MECHA_BASE.find((r) => r.BianShenType === id),
        own = s.owned[id];
      if (!cfg) return fail(type);
      if (c === 7301) {
        if (own || !p.freeActions) return fail(type);
        s.owned[id] = {
          level: 1,
          star: 1,
          skills: Object.fromEntries(
            M.BianShenSkillActivateConfig.filter(
              (r) => r.BianShenType === id && r.NeedBianShenStarLv <= 1,
            ).map((r) => [r.SkillPos, 1]),
          ),
        };
      } else if (c === 7305) s.slots = s.slots.map((v) => (v === id ? 0 : v));
      else if (!own || !p.freeActions) return fail(type);
      else if (c === 7307) {
        if (
          !M.BianShenLevelConfig.some(
            (r) => r.BianShenType === id && r.BianShenLevel === own.level + 1,
          )
        )
          return fail(type);
        own.level++;
      } else if (c === 7313) {
        if (
          !M.BianShenUpStarLvConfig.some((r) => r.BianShenType === id && r.StarLv === own.star + 1)
        )
          return fail(type);
        own.star++;
      } else if (c === 7309 || c === 7311) {
        const pos = uint(4);
        own.skills ||= {};
        const level = own.skills[pos] || 0;
        if (
          !M.BianShenSkillActivateConfig.some(
            (r) => r.BianShenType === id && r.SkillPos === pos && r.NeedBianShenStarLv <= own.star,
          )
        )
          return fail(type);
        // Also accept a legacy level-zero upgrade after validating its gates;
        // normal native UI receives auto-activated level 1 from mechaState.
        if (c === 7309 && level) return ok(type, role);
        const next = M.BianShenSkillLvUpConfig.find(
          (r) => r.BianShenType === id && r.SkillPos === pos && r.SkillLv === level + 1,
        );
        if (!next || next.NeedBianShenLv > own.level) return fail(type);
        own.skills[pos] = level + 1;
      }
    }
    const updated = { ...role, localMechas: mechaState({ ...role, localMechas: s }) };
    return { ...ok(type, updated), notifications: mechaNotifications(updated) };
  }
  return null;
}
