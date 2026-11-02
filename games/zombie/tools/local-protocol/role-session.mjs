import { nativeFuncOpened } from './native-func-open.mjs';
import {
  packItemData,
  packEquipData,
  starterEquipment,
  starterGems,
  parseFinLevelPrefix,
  packFinLevelRes,
  packRefuseReconnectRes,
  packBootyAwardItem,
} from './native-extra.mjs';
import { nativeString } from './native-codec.mjs';
import { roleTypes } from './role-schema.mjs';
import { CLIENT_GEMS, CLIENT_GEM_ROLL } from '../../public/client-gem-data.mjs';
import { randomInt } from 'node:crypto';
import { SKIN_CATALOG as GROWTH } from './skin-catalog.mjs';
import {
  equipmentFor,
  activeGems,
  subtractActive,
  saveEquipment,
  gemInAnyPage,
  applyGemAction,
} from './gem-state.mjs';
import { parseGemCompose, composeGems } from './gem-compose.mjs';
import { activityGrowthTypes } from './activity-growth-schema.mjs';
import { lotteryTypes, lotteryArrayRules } from './lottery-schema.mjs';
import {
  lotteryCommands,
  lotteryAction,
  lotteryNotifications,
  lotteryOpenEntries,
  lotteryFreeTickets,
} from './lottery-state.mjs';
import { gemCounts, gemItems } from './gem-stack.mjs';
import { growthData, growthAction, battleSkinData } from './growth-state.mjs';
import { activityOpenData, boxConfig, boxData, drawBox, operTextData } from './activity-state.mjs';
import { campaignData, startCampaign, settleCampaign, isMazeBattle } from './campaign-state.mjs';
import { extensionTypes, extensionArrayRules } from './extension-schema.mjs';
import {
  extensionCommands,
  extensionAction,
  gunData,
  mechaNotifications,
  mechaBattleData,
} from './extension-state.mjs';
import { MECHA_BASE, MECHA_GROWTH } from './mecha-source.mjs';
import {
  serviceCommands,
  serviceAction,
  patrolNotifications,
  patrolAwards,
  guildRoleData,
  guildNotification,
  guildBuildingNotification,
  worldBossNotifications,
  adNotifications,
} from './service-state.mjs';
import {
  mazeCommands,
  mazeAction,
  mazeNotifications,
  mazeBattleData,
  settleMaze,
} from './maze-state.mjs';
import { mazeCarryOver } from './battle-report.mjs';
import { battleReportTypes } from './battle-report-schema.mjs';
import { normalGem, migrateHiddenGems } from './gem-policy.mjs';
Object.assign(roleTypes, activityGrowthTypes);
Object.assign(roleTypes, lotteryTypes);
Object.assign(roleTypes, extensionTypes);
Object.assign(roleTypes, battleReportTypes);
roleTypes.CSTextConfig = [
  ['ID', 'uint'],
  ['ArgNum', 'short'],
  ['Content', 'string'],
];
roleTypes.CSOperTextNotifyRes = [
  ['TextCnt', 'int'],
  ['TextConfig', 'CSTextConfig[]'],
];

roleTypes.CSFuncOpenedEntry = [
  ['FuncID', 'uint'],
  ['FetchTime', 'uint'],
];
roleTypes.CSRankInfo = [
  ['RankStats', 'byte'],
  ['StatsVal', 'ushort'],
  ['AgoRanking', 'ushort'],
];
roleTypes.CSSelfInfo = [
  ['RankInfoData', 'CSRankInfo'],
  ['Ranking', 'ushort'],
  ['SpecParamCnt', 'int'],
  ['SpecParam', 'int[]'],
  ['Int64Param', 'long'],
];
roleTypes.CSGetPlayerRankRes = [
  ['Result', 'ProtoResult'],
  ['RankTypeID', 'int'],
  ['RankCnt', 'byte'],
  ['RankList', 'CSPlayerRankData[]'],
  ['SelfData', 'CSSelfInfo'],
];
roleTypes.CSGemRollRes = [
  ['Result', 'ProtoResult'],
  ['NewGem', 'CSItemData'],
];
roleTypes.CSMagicSkillDataEntry = [
  ['ID', 'uint'],
  ['Level', 'int'],
  ['Name', 'int'],
  ['CostGoldCnt', 'uint'],
  ['CostItemType', 'uint'],
  ['CostItemCnt', 'uint'],
];
roleTypes.CSNotifyMagicSkillData = [
  ['DataCount', 'uint'],
  ['DataList', 'CSMagicSkillDataEntry[]'],
];
roleTypes.CSNotifyEquipGemInlayData = [
  ['GemInlayData', 'CSEquipGemInlayData'],
  ['UsingPageID', 'int'],
];
roleTypes.CSEquipGemInlayData = [
  ['GemPageCnt', 'int'],
  ['GemPageData', 'CSGemPageData[]'],
];
roleTypes.CSUpEquipLevelRes = [
  ['Result', 'ProtoResult'],
  ['ItemGID', 'uint'],
];
roleTypes.CSOnekeyUpEquipLevelRes = [['Result', 'ProtoResult']];
roleTypes.CSEquipReforgeRes = [
  ['Result', 'ProtoResult'],
  ['ItemGID', 'uint'],
];
roleTypes.CSGemComposeRes = [
  ['Result', 'ProtoResult'],
  ['GemCnt', 'int'],
  ['GemList', 'CSItemData[]'],
];
roleTypes.CSReRandLearnedSkillRes = [
  ['Result', 'ProtoResult'],
  ['ReRandNum', 'int'],
];
export const LOCAL_ROLE_ID = '9000000001';
const GEM_IDS = new Set(CLIENT_GEMS.map((g) => g.id));
const SKIN_IDS = new Map(
  GROWTH.SkinBaseConfig.filter((r) =>
    GROWTH.SkinLevelConfig.some((l) => l.SkinID === r.SkinID && l.SkinLevel === 1),
  ).map((r) => [r.SkinID, r.SkinType]),
);
const MERC_IDS = new Map(GROWTH.MercenaryBaseConfig.map((r) => [r.ID, r.InitQualityLv]));
const CORE_IDS = new Set(GROWTH.MagicSkillConfig.map((r) => r.ID)),
  GOOD_IDS = new Set(GROWTH.GoodsConfig.filter((r) => r.ItemID > 3).map((r) => r.ItemID));
const PROFILE_BOUNDS = {
  level: [1, 999],
  gold: [0, 1_000_000_000],
  diamonds: [0, 1_000_000_000],
  energy: [0, 1_000_000],
  attack: [1, 1_000_000],
  maxHp: [1, 100_000_000],
  fight: [0, 1_000_000_000],
  reagent: [0, 9999],
  coreLevel: [0, 46],
};
export function validateFixtureProfile(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid local profile');
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'freeActions') {
      if (typeof value !== 'boolean') throw Error('Invalid free-action option');
      out[key] = value;
      continue;
    }
    if (['cores', 'goods'].includes(key)) {
      const ids = key === 'cores' ? CORE_IDS : GOOD_IDS,
        max = key === 'cores' ? 46 : 1_000_000_000;
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length > (key === 'cores' ? 14 : 500) ||
        Object.entries(value).some(
          ([id, n]) =>
            !/^\d+$/.test(id) ||
            String(Number(id)) !== id ||
            !ids.has(Number(id)) ||
            !Number.isInteger(n) ||
            n < 0 ||
            n > max,
        )
      )
        throw Error('Invalid local ' + key + ' map');
      out[key] = { ...value };
      continue;
    }
    if (['gems', 'forms', 'outfits', 'mercs'].includes(key)) {
      const valid =
        key === 'gems'
          ? (id) => GEM_IDS.has(id)
          : key === 'forms'
            ? (id) => SKIN_IDS.get(id) === 2
            : key === 'outfits'
              ? (id) => SKIN_IDS.get(id) === 1
              : (id) => MERC_IDS.has(id);
      if (
        !Array.isArray(value) ||
        value.length > 60 ||
        value.some((id) => !Number.isInteger(id) || !valid(id))
      )
        throw Error('Invalid local ' + key + ' list');
      out[key] = [...value];
      continue;
    }
    if (['equippedForm', 'equippedOutfit', 'activeMerc'].includes(key)) {
      if (!Number.isInteger(value) || value < 0) throw Error('Invalid local selection');
      out[key] = value;
      continue;
    }
    const range = PROFILE_BOUNDS[key];
    if (!range || !Number.isInteger(value) || value < range[0] || value > range[1])
      throw Error('Invalid local profile field ' + key);
    out[key] = value;
  }
  for (const [key, list] of [
    ['equippedForm', 'forms'],
    ['equippedOutfit', 'outfits'],
    ['activeMerc', 'mercs'],
  ])
    if (out[key] && !out[list]?.includes(out[key]))
      throw Error('Local selection must be owned: ' + key);
  return out;
}
export const ROLE_GROUPS = [
  ['BaseData', 'CSRoleBaseData'],
  ['BagData', 'CSBagData'],
  ['EquipData', 'CSEquipData'],
  ['LevelData', 'CSLevelData'],
  ['GuaJiData', 'CSGuaJiData'],
  ['AttrData', 'CSActorAttrData'],
  ['KvAttrData', 'CSActorAttrKvData'],
  ['FashionData', 'CSFashionData'],
  ['WallData', 'CSWallData'],
  ['H5GameData', 'CSH5GameData'],
  ['GunData', 'CSGunData'],
  ['SkinData', 'CSSkinData'],
  ['MercenaryData', 'CSMercenaryData'],
  ['EndlessLevleData', 'CSEndlessLevelData'],
  ['GuildData', 'CSGuildData'],
];

function scalar(type, value = 0) {
  const sizes = {
      byte: 1,
      sbyte: 1,
      short: 2,
      ushort: 2,
      int: 4,
      uint: 4,
      float: 4,
      long: 8,
      ulong: 8,
      double: 8,
    },
    size = sizes[type];
  if (!size) throw Error(`Unsupported native scalar ${type}`);
  const b = Buffer.alloc(size);
  const methods = {
    byte: 'writeUInt8',
    sbyte: 'writeInt8',
    short: 'writeInt16BE',
    ushort: 'writeUInt16BE',
    int: 'writeInt32BE',
    uint: 'writeUInt32BE',
    float: 'writeFloatBE',
    long: 'writeBigInt64BE',
    ulong: 'writeBigUInt64BE',
    double: 'writeDoubleBE',
  };
  b[methods[type]](type === 'long' || type === 'ulong' ? BigInt(value) : Number(value));
  return b;
}
export function packRoleStruct(type, data = {}) {
  if (type === 'CSBootyAwardItem') return packBootyAwardItem(data);
  if (type === 'CSItemData') return packItemData(data);
  if (type === 'CSEquipData') return packEquipData(data);
  const fields = roleTypes[type];
  if (!fields) throw Error(`Unknown native role type ${type}`);
  const chunks = [];
  const names = new Set(fields.map(([name]) => name));
  for (const name of Object.keys(data))
    if (!names.has(name)) throw Error(`Unknown native role field ${type}.${name}`);
  for (let i = 0; i < fields.length; i++) {
    const [name, kind] = fields[i],
      value = data[name];
    const previous = fields[i - 1];
    // Only relay room info is conditional. Native unpack still consumes every
    // mode substructure when HasX=0 (verified 0x17A1910..0x17A1A38).
    if (
      type === 'CSNotifyEnterLevel' &&
      name === 'RelayRoomInfo' &&
      !Number(data.IsHaveRelayRoomInfo ?? 0)
    )
      continue;
    if (kind.endsWith('[]')) {
      const list = value ?? [];
      if (
        !Array.isArray(list) ||
        list.length > (type === 'CSBagData' ? 4096 : type === 'CSBattlePackData' ? 65536 : 1024)
      )
        throw Error('Invalid native role list');
      const rule = extensionArrayRules[type + '.' + name] || lotteryArrayRules[type + '.' + name],
        countName = rule?.count ?? fields[i - 1]?.[0];
      if (rule?.max !== undefined && list.length > rule.max)
        throw Error(`Native list limit ${type}.${name}: ${rule.max}`);
      if (
        rule?.fixed !== undefined
          ? list.length !== rule.fixed
          : data[countName] !== undefined && data[countName] !== list.length
      )
        throw Error(`Native count mismatch ${type}.${name}`);
      for (const item of list)
        chunks.push(
          kind === 'string[]'
            ? nativeString(item, 2048)
            : roleTypes[kind.slice(0, -2)]
              ? packRoleStruct(kind.slice(0, -2), item)
              : scalar(kind.slice(0, -2), item),
        );
    } else if (kind === 'string') chunks.push(nativeString(value ?? '', 2048));
    else if (roleTypes[kind]) chunks.push(packRoleStruct(kind, value ?? {}));
    else {
      const next = fields[i + 1],
        nextRule =
          next &&
          (extensionArrayRules[type + '.' + next[0]] || lotteryArrayRules[type + '.' + next[0]]);
      const resolved =
        value ?? (next?.[1].endsWith('[]') && !nextRule?.fixed ? (data[next[0]] ?? []).length : 0);
      chunks.push(scalar(kind, resolved));
    }
  }
  return Buffer.concat(chunks);
}
export function parseRoleCreate(body) {
  if (body.length < 15) throw Error('Short local role-create request');
  const length = body.readUInt32BE(6);
  if (length < 2 || length > 64 || body.length !== 14 + length || body[9 + length] !== 0)
    throw Error('Invalid local role name encoding');
  const name = body.subarray(10, 9 + length).toString('utf8');
  if (!name.trim() || name.includes('\ufffd')) throw Error('Invalid local role name');
  return {
    head: body.readInt32BE(0),
    sex: body[4],
    bodyType: body[5],
    name,
    lang: body.readInt32BE(10 + length),
  };
}
export function createLocalRole(input, now = Date.now()) {
  return {
    version: 1,
    uin: 900000001,
    id: LOCAL_ROLE_ID,
    name: input.name,
    head: input.head,
    sex: input.sex,
    bodyType: input.bodyType,
    createdAt: Math.floor(now / 1000),
  };
}
export function validateLocalRole(role) {
  if (
    role?.version !== 1 ||
    role.uin !== 900000001 ||
    role.id !== LOCAL_ROLE_ID ||
    typeof role.name !== 'string' ||
    Buffer.byteLength(role.name) > 63 ||
    !Number.isInteger(role.createdAt)
  )
    throw Error('Invalid local role state');
  return migrateHiddenGems(role);
}
export function localRoleData(role, now = Date.now(), profile = {}) {
  validateLocalRole(role);
  profile = validateFixtureProfile(profile);
  const seconds = Math.floor(now / 1000),
    level = profile.level ?? 1,
    attack = profile.attack ?? 100,
    maxHp = profile.maxHp ?? 1000,
    fight = profile.fight ?? 100;
  return {
    BaseData: {
      RoleID: role.id,
      RoleNO: 1,
      WorldID: 1,
      BirthWorldID: 1,
      RoleName: role.name,
      Head: role.head,
      Sex: role.sex,
      BodyType: role.bodyType,
      Level: level,
      Exp: role.localXp || 0,
      FightVal: fight,
      Diamond: profile.diamonds ?? 10000,
      Gold: localGold(role, profile),
      Stma: profile.energy ?? 100,
      LastLoginTime: seconds,
      CreateTime: role.createdAt,
      LastAddStmaTime: seconds,
      IsFinGuide: 1,
      HeadSex: role.sex,
      FreeRenameTimes: 1,
    },
    BagData: localBagData(role, seconds, profile),
    EquipData: equipmentFor(role, seconds, profile),
    LevelData: campaignData(role),
    GuaJiData: { IsOpen: 1, LastFetchTime: 1, BootyList: { AwardItem: patrolAwards(role) } },
    AttrData: {
      MaxHp: maxHp,
      HpCount: 1,
      Atk: attack,
      CritMulti: 1.5,
      HitRatio: 1,
      MoveSpeed: 3,
      InitSkillCount: 1,
      ShootTimes: 1,
      ShootCount: 1,
      BulletFlySpeed: 0,
      ReloadTime: 1,
      GunDamageRatio: 1,
      GunAtk: attack,
    },
    KvAttrData: {},
    FashionData: {},
    WallData: { Level: 1, SkillData: [] },
    H5GameData: null,
    GunData: gunData(role),
    ...growthData(role, profile),
    EndlessLevleData: { DailyTotalChallengeNum: profile.freeActions ? 1000000 : 3, CurrLevel: 1 },
    GuildData: guildRoleData(role),
  };
}
export function packLocalRoleData(role, now = Date.now(), profile = {}) {
  return packRoleDataGroups(localRoleData(role, now, profile));
}
export function packRoleDataGroups(data) {
  const chunks = [];
  for (const [name, type] of ROLE_GROUPS) {
    const present = data[name] != null;
    chunks.push(Buffer.from([present ? 1 : 0]));
    if (present) chunks.push(packRoleStruct(type, data[name]));
  }
  return Buffer.concat(chunks);
}
function bagFingerprint(profile) {
  return JSON.stringify([
    profile.gems ?? null,
    profile.reagent ?? 0,
    ...(profile.goods ? [profile.goods] : []),
  ]);
}
function localGold(role, profile) {
  if (profile.freeActions) return 1e9;
  return role.localGold?.baseline === (profile.gold ?? 100000) &&
    Number.isInteger(role.localGold.value) &&
    role.localGold.value >= 0 &&
    role.localGold.value <= 1e9
    ? role.localGold.value
    : (profile.gold ?? 100000);
}
function localBagData(role, seconds, profile) {
  const saved = role.localBag;
  const counted =
    saved?.gemCounts &&
    typeof saved.gemCounts === 'object' &&
    !Array.isArray(saved.gemCounts) &&
    Object.keys(saved.gemCounts).length <= GEM_IDS.size &&
    Object.entries(saved.gemCounts).every(
      ([id, n]) => GEM_IDS.has(Number(id)) && Number.isInteger(n) && n > 0 && n <= 1e9,
    );
  const valid =
    saved?.fingerprint === bagFingerprint(profile) &&
    (counted ||
      (Array.isArray(saved.gems) &&
        saved.gems.length <= 60 &&
        saved.gems.every((id) => GEM_IDS.has(id)))) &&
    Number.isInteger(saved.reagent) &&
    saved.reagent >= 0 &&
    saved.reagent <= 1e9;
  const ids = valid
      ? saved.gems
      : subtractActive(
          starterGems(seconds, profile.gems).map((g) => g.ItemID),
          equipmentFor(role, seconds, profile),
        ),
    counts =
      valid && counted
        ? new Map([
            ...(saved.gems || [])
              .filter((id) => saved.gemCounts[id])
              .map((id) => [id, saved.gemCounts[id]]),
            ...Object.entries(saved.gemCounts).map(([id, n]) => [Number(id), n]),
          ])
        : gemCounts(starterGems(seconds, ids)),
    goods = { ...(valid ? (saved.goods ?? profile.goods) : profile.goods) };
  let reagent = valid ? saved.reagent : (profile.reagent ?? goods[1001] ?? 0);
  delete goods[1001];
  // Free mode replenishes only cultivation consumables. It does not replace the
  // bag fingerprint or discard earned gems, outfits, mercenary fragments or boxes.
  if (profile.freeActions) {
    reagent = Math.max(reagent, 9999);
    for (const id of [
      100002,
      ...GROWTH.MagicSkillConfig.map((r) => r.PieceItemID),
      ...GROWTH.EquipUpLevelConfig.map((r) => r.CostItemID),
      ...GROWTH.SkinBaseConfig.map((r) => r.CostItemID),
      ...GROWTH.SkinLevelConfig.flatMap((r) => r.CostItem.map((i) => i.ItemID)),
      ...GROWTH.GunBaseConfig.map((r) => r.UnlockCondParam1),
      ...GROWTH.GunUpConfig.flatMap((r) => [r.CostItemID, r.CommonCostItemID]),
      ...MECHA_BASE.map((r) => r.ActivateItemID),
      ...MECHA_GROWTH.BianShenLevelConfig.map((r) => r.NeedItemID),
      ...MECHA_GROWTH.BianShenSkillLvUpConfig.map((r) => r.NeedItemID),
      ...MECHA_GROWTH.BianShenUpStarLvConfig.flatMap((r) => r.UpStarCostList.map((i) => i.ItemID)),
    ])
      if (GOOD_IDS.has(id)) goods[id] = Math.max(goods[id] || 0, 1000000);
  }
  const lockCounts = valid
    ? (saved.lockCounts ?? Object.fromEntries((saved.locks ?? []).map((id) => [id, 1])))
    : null;
  return {
    IsAll: 1,
    ItemData: [
      ...gemItems(counts, seconds, valid ? (saved.locks ?? []) : [], lockCounts),
      ...Object.entries({ 1001: reagent, ...goods })
        .filter(([id, n]) => GOOD_IDS.has(Number(id)) && Number.isInteger(n) && n > 0 && n <= 1e9)
        .map(([id, n], i) => ({
          ItemGID: 93001 + i,
          ItemID: Number(id),
          StackCnt: n,
          ItemType: 1,
          CreateTime: seconds,
          Detail: { GoodsDetail: { LastUseTime: 0 } },
        })),
    ],
  };
}
function saveBag(role, profile, bag) {
  const counts = gemCounts(bag.ItemData),
    lockCounts = Object.fromEntries(
      gemCounts(bag.ItemData.filter((i) => i.Detail?.GemDetail?.IsLock === 1)),
    );
  return {
    ...role,
    localBag: {
      fingerprint: bagFingerprint(profile),
      gemCounts: Object.fromEntries(counts),
      gems: bag.ItemData.filter((i) => i.ItemType === 3 && i.StackCnt > 0)
        .slice(0, 60)
        .map((i) => i.ItemID),
      reagent: bag.ItemData.find((i) => i.ItemID === 1001)?.StackCnt ?? 0,
      goods: Object.fromEntries(
        bag.ItemData.filter((i) => i.ItemType === 1 && i.ItemID !== 1001).map((i) => [
          i.ItemID,
          i.StackCnt,
        ]),
      ),
      locks: Object.keys(lockCounts).map(Number),
      lockCounts,
    },
  };
}
function gemActionReply(request, role, now, profile) {
  const seconds = Math.floor(now / 1000),
    equip = equipmentFor(role, seconds, profile),
    bag = localBagData(role, seconds, profile),
    out = applyGemAction(
      request.cmd,
      request.body,
      equip,
      bag,
      seconds,
      role.localBag?.locks ?? [],
    ),
    reply = {
      cmd: { 4200: 4201, 4206: 4207, 4208: 4209, 4210: 4211 }[request.cmd],
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct('ProtoResult', { Ret: out.ret }),
    };
  if (out.ret) return { role, reply };
  const updated = saveBag(
    saveEquipment(
      { ...role, localBag: { ...role.localBag, locks: out.locks } },
      profile,
      out.equip,
    ),
    profile,
    out.bag,
  );
  // The pinned APK's 4212 handler is a no-op. Its actual update path is 2021
  // with HaveEquipData=1; a bag-only dirty update leaves the native slots stale.
  return {
    role: updated,
    reply,
    notifications: [
      {
        cmd: 4212,
        echo: 0,
        serverTime: seconds,
        body: packRoleStruct('CSNotifyEquipGemInlayData', {
          GemInlayData: { GemPageData: out.equip.GemPageData },
          UsingPageID: out.equip.UsingPageID,
        }),
      },
      {
        cmd: 2021,
        echo: 0,
        serverTime: seconds,
        body: packRoleDataGroups({
          EquipData: out.equip,
          BagData: localBagData(updated, seconds, profile),
        }),
      },
    ],
  };
}
function coreLevels(role, profile) {
  const baseline = Object.fromEntries(
      [...CORE_IDS].map((id) => [id, profile.cores?.[id] ?? profile.coreLevel ?? 1]),
    ),
    fingerprint = JSON.stringify(baseline),
    saved = role.localCores;
  const valid =
    saved?.fingerprint === fingerprint &&
    saved.levels &&
    Object.keys(saved.levels).length === CORE_IDS.size &&
    Object.entries(saved.levels).every(
      ([id, n]) => CORE_IDS.has(Number(id)) && Number.isInteger(n) && n >= 0 && n <= 46,
    );
  const migrated =
    profile.freeActions &&
    saved?.levels &&
    [...CORE_IDS].every(
      (id) => Number.isInteger(saved.levels[id]) && saved.levels[id] >= 0 && saved.levels[id] <= 46,
    );
  return {
    fingerprint,
    levels: valid
      ? { ...saved.levels }
      : migrated
        ? Object.fromEntries([...CORE_IDS].map((id) => [id, Math.max(1, saved.levels[id])]))
        : baseline,
  };
}
export function localCoreData(role, profile = {}) {
  const { levels } = coreLevels(role, profile);
  return {
    DataList: GROWTH.MagicSkillConfig.map((r) => {
      const level = levels[r.ID],
        cost =
          level < 46
            ? GROWTH.MagicSkillLevelConfig.find(
                (c) => c.ID === r.ID && c.Level === Math.max(1, level),
              )
            : null;
      return {
        ID: r.ID,
        Level: level,
        Name: r.Name,
        CostGoldCnt: cost?.CostGoldCnt ?? 0,
        CostItemType: cost?.CostItemID ?? 0,
        CostItemCnt: cost?.CostItemCnt ?? 0,
      };
    }),
  };
}
const coreNotification = (role, profile, seconds) => ({
  cmd: 29001,
  echo: 0,
  serverTime: seconds,
  body: packRoleStruct('CSNotifyMagicSkillData', localCoreData(role, profile)),
});
function coreUpgradeReply(request, role, now, profile) {
  if (request.body.length !== 4) throw Error('Invalid core-upgrade request length');
  const id = request.body.readUInt32BE(),
    seconds = Math.floor(now / 1000),
    state = coreLevels(role, profile),
    level = state.levels[id],
    cost = GROWTH.MagicSkillLevelConfig.find((r) => r.ID === id && r.Level === Math.max(1, level)),
    gold = localGold(role, profile),
    bag = localBagData(role, seconds, profile),
    material = bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === cost?.CostItemID);
  const respond = (updated, ret, notifications = []) => ({
    role: updated,
    reply: {
      cmd: 29003,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct('ProtoResult', { Ret: ret }),
    },
    notifications,
  });
  if (
    !CORE_IDS.has(id) ||
    level >= 46 ||
    !cost ||
    gold < cost.CostGoldCnt ||
    (material?.StackCnt ?? 0) < cost.CostItemCnt
  )
    return respond(role, 1);
  if (material && !profile.freeActions) material.StackCnt -= cost.CostItemCnt;
  const updated = saveBag(
      {
        ...role,
        localCores: {
          fingerprint: state.fingerprint,
          levels: { ...state.levels, [id]: level + 1 },
        },
        localGold: { baseline: profile.gold ?? 100000, value: gold - cost.CostGoldCnt },
      },
      profile,
      bag,
    ),
    data = localRoleData(updated, now, profile);
  return respond(updated, 0, [
    coreNotification(updated, profile, seconds),
    {
      cmd: 2021,
      echo: 0,
      serverTime: seconds,
      body: packRoleDataGroups({ BaseData: data.BaseData, BagData: data.BagData }),
    },
  ]);
}
function equipUpgradeReply(request, role, now, profile) {
  if (request.body.length !== 5 || request.body[4] > 1)
    throw Error('Invalid equipment-upgrade request');
  const gid = request.body.readUInt32BE(),
    seconds = Math.floor(now / 1000),
    equip = equipmentFor(role, seconds, profile),
    item = equip.EquipList.find((i) => i.ItemGID === gid),
    source = GROWTH.EquipConfig.find((r) => r.ItemID === item?.ItemID),
    detail = item?.Detail.EquipDetail,
    bag = localBagData(role, seconds, profile);
  const respond = (updated, ret, notifications = []) => ({
    role: updated,
    reply: {
      cmd: 4218,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct('CSUpEquipLevelRes', { Result: { Ret: ret }, ItemGID: gid }),
    },
    notifications,
  });
  const limit = GROWTH.EquipMaxUpLevelConfig.find(
    (r) => r.PinJie === source?.PinJie && r.Quality === detail?.Quality,
  );
  if (!source || !detail || !limit) return respond(role, 1);
  let gold = localGold(role, profile),
    count = 0;
  for (let i = 0; i < (request.body[4] ? 10 : 1); i++) {
    const cost = GROWTH.EquipUpLevelConfig.find(
        (r) => r.Type === source.Type && r.Level === detail.Level,
      ),
      next = GROWTH.EquipUpLevelConfig.find(
        (r) => r.Type === source.Type && r.Level === detail.Level + 1,
      ),
      material = bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === cost?.CostItemID);
    if (
      !cost ||
      !next ||
      detail.Level >= limit.MaxLevel ||
      (!profile.freeActions &&
        (cost.RoleLevel > (profile.level ?? 1) ||
          cost.MoneyType !== 2 ||
          gold < cost.MoneyNum ||
          (material?.StackCnt ?? 0) < cost.CostItemNum))
    )
      break;
    if (!profile.freeActions) {
      gold -= cost.MoneyNum;
      if (material) material.StackCnt -= cost.CostItemNum;
    }
    detail.Level++;
    count++;
  }
  if (!count) return respond(role, 1);
  const updated = saveBag(
      saveEquipment(
        { ...role, localGold: { baseline: profile.gold ?? 100000, value: gold } },
        profile,
        equip,
      ),
      profile,
      bag,
    ),
    data = localRoleData(updated, now, profile);
  return respond(updated, 0, [
    {
      cmd: 2021,
      echo: 0,
      serverTime: seconds,
      body: packRoleDataGroups({
        BaseData: data.BaseData,
        EquipData: data.EquipData,
        BagData: data.BagData,
      }),
    },
  ]);
}
function equipReforgeReply(request, role, now, profile) {
  if (request.body.length !== 4) throw Error('Invalid equipment-reforge request');
  const gid = request.body.readUInt32BE(),
    seconds = Math.floor(now / 1000),
    equip = equipmentFor(role, seconds, profile),
    item = equip.EquipList.find((i) => i.ItemGID === gid),
    cfg = GROWTH.EquipConfig.find((r) => r.ItemID === item?.ItemID),
    detail = item?.Detail.EquipDetail,
    bag = localBagData(role, seconds, profile);
  const respond = (r, ret, notifications = []) => ({
    role: r,
    reply: {
      cmd: 4220,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct('CSEquipReforgeRes', { Result: { Ret: ret }, ItemGID: gid }),
    },
    notifications,
  });
  const current = GROWTH.EquipReforgeConfig.find(
      (r) =>
        r.EquipPinJie === cfg?.PinJie &&
        r.Quality === detail?.Quality &&
        r.Prefix === detail?.Prefix,
    ),
    next = GROWTH.EquipReforgeConfig.find(
      (r) =>
        r.EquipPinJie === cfg?.PinJie &&
        r.Quality === detail?.Quality + 1 &&
        r.Prefix === detail?.Prefix,
    ),
    material = bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === current?.CostItemID);
  if (
    !detail ||
    !current ||
    !next ||
    (!profile.freeActions &&
      ((material?.StackCnt || 0) < current.CostItemNum ||
        (profile.level || 1) < current.MinPlayerLv))
  )
    return respond(role, 1);
  if (!profile.freeActions) material.StackCnt -= current.CostItemNum;
  detail.Quality = next.Quality;
  detail.InitQuality = Math.max(detail.InitQuality || 1, next.Quality);
  const updated = saveBag(saveEquipment(role, profile, equip), profile, bag),
    data = localRoleData(updated, now, profile);
  return respond(updated, 0, [
    {
      cmd: 2021,
      echo: 0,
      serverTime: seconds,
      body: packRoleDataGroups({ EquipData: data.EquipData, BagData: data.BagData }),
    },
  ]);
}
function oneKeyEquipUpgradeReply(request, role, now, profile) {
  if (request.body.length !== 1) throw Error('Invalid one-key equipment-upgrade request');
  const seconds = Math.floor(now / 1000),
    equip = equipmentFor(role, seconds, profile),
    bag = localBagData(role, seconds, profile);
  let gold = localGold(role, profile),
    count = 0;
  // The request contains no selected GID. Locally distribute upgrades across all
  // owned slots, lowest level first; original server allocation order is unknown.
  for (let guard = 0; guard < 1000; guard++) {
    let paid = false;
    for (const item of [...equip.EquipList].sort(
      (a, b) => a.Detail.EquipDetail.Level - b.Detail.EquipDetail.Level || a.ItemGID - b.ItemGID,
    )) {
      const d = item.Detail.EquipDetail,
        source = GROWTH.EquipConfig.find((r) => r.ItemID === item.ItemID),
        cost = GROWTH.EquipUpLevelConfig.find(
          (r) => r.Type === source?.Type && r.Level === d.Level,
        ),
        next = GROWTH.EquipUpLevelConfig.find(
          (r) => r.Type === source?.Type && r.Level === d.Level + 1,
        ),
        limit = GROWTH.EquipMaxUpLevelConfig.find(
          (r) => r.PinJie === source?.PinJie && r.Quality === d.Quality,
        ),
        material = bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === cost?.CostItemID);
      if (
        !source ||
        !cost ||
        !next ||
        !limit ||
        d.Level >= limit.MaxLevel ||
        (!profile.freeActions &&
          (cost.RoleLevel > (profile.level ?? 1) ||
            cost.MoneyType !== 2 ||
            gold < cost.MoneyNum ||
            (material?.StackCnt ?? 0) < cost.CostItemNum))
      )
        continue;
      if (!profile.freeActions) {
        gold -= cost.MoneyNum;
        if (material) material.StackCnt -= cost.CostItemNum;
      }
      d.Level++;
      count++;
      paid = true;
      break;
    }
    if (!paid) break;
  }
  const updated = count
      ? saveBag(
          saveEquipment(
            { ...role, localGold: { baseline: profile.gold ?? 100000, value: gold } },
            profile,
            equip,
          ),
          profile,
          bag,
        )
      : role,
    data = count ? localRoleData(updated, now, profile) : null;
  return {
    role: updated,
    reply: {
      cmd: 4239,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct('CSOnekeyUpEquipLevelRes', { Result: { Ret: count ? 0 : 1 } }),
    },
    notifications: count
      ? [
          {
            cmd: 2021,
            echo: 0,
            serverTime: seconds,
            body: packRoleDataGroups({
              BaseData: data.BaseData,
              EquipData: data.EquipData,
              BagData: data.BagData,
            }),
          },
        ]
      : [],
  };
}
function gemComposeReply(request, role, now, profile) {
  const seconds = Math.floor(now / 1000),
    out = composeGems(
      parseGemCompose(request.body),
      localBagData(role, seconds, profile),
      equipmentFor(role, seconds, profile),
      seconds,
      role.localBag?.locks ?? [],
      randomInt,
    ),
    updated = out.ret ? role : saveBag(role, profile, out.bag);
  return {
    role: updated,
    reply: {
      cmd: 4203,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct('CSGemComposeRes', {
        Result: { Ret: out.ret },
        GemList: out.rewards ?? [],
      }),
    },
    notifications: out.ret
      ? []
      : [
          {
            cmd: 2021,
            echo: 0,
            serverTime: seconds,
            body: packRoleDataGroups({ BagData: localBagData(updated, seconds, profile) }),
          },
        ],
  };
}
function growthReply(request, role, now, profile) {
  const seconds = Math.floor(now / 1000),
    out = growthAction(
      request,
      role,
      profile,
      localBagData(role, seconds, profile),
      localGold(role, profile),
    ),
    types = {
      29302: 'CSSkinUnlockRes',
      29304: 'CSSkinSkillUpLevelRes',
      29306: 'CSUseSkinRes',
      5801: 'CSMercenaryLevelUpRes',
      5803: 'CSMercenaryActivateRes',
      5805: 'CSMercenaryUpgradeRes',
      5807: 'CSMercenaryUseRes',
    },
    body = { Result: { Ret: out.ret } };
  if (request.cmd === 29304)
    Object.assign(body, { SkinID: out.id || 0, SkinLevel: out.newLevel || 0 });
  const updated = out.ret
      ? role
      : saveBag(
          { ...out.role, localGold: { baseline: profile.gold ?? 100000, value: out.gold } },
          profile,
          out.bag,
        ),
    data = out.ret ? null : localRoleData(updated, now, profile);
  return {
    role: updated,
    reply: {
      cmd: request.cmd + 1,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct(types[request.cmd], body),
    },
    notifications: data
      ? [
          {
            cmd: 2021,
            echo: 0,
            serverTime: seconds,
            body: packRoleDataGroups({
              BaseData: data.BaseData,
              BagData: data.BagData,
              ...growthData(updated, profile),
            }),
          },
        ]
      : [],
  };
}
function extensionReply(request, role, now, profile) {
  const seconds = Math.floor(now / 1000),
    out = extensionAction(request, role, profile);
  if (!out) return null;
  const notifications = (out.notifications || []).map((n) => ({
    ...n,
    echo: 0,
    serverTime: seconds,
    body: packRoleStruct(n.type, n.data),
  }));
  if (out.dirty) {
    const data = localRoleData(out.role, now, profile);
    notifications.push({
      cmd: 2021,
      echo: 0,
      serverTime: seconds,
      body: packRoleDataGroups({ GunData: data.GunData, SkinData: data.SkinData }),
    });
  }
  return {
    role: out.role,
    reply: {
      cmd: out.cmd,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct(out.type, out.data),
    },
    notifications,
  };
}
function serviceReply(request, role, now, profile) {
  const seconds = Math.floor(now / 1000),
    out = mazeCommands.has(request.cmd)
      ? mazeAction(request, role, profile)
      : serviceAction(request, role, seconds, profile);
  if (!out) return null;
  let updated = out.role;
  if (out.awards?.length) {
    const bag = localBagData(updated, seconds, profile);
    let gold = localGold(updated, profile),
      xp = updated.localXp || 0;
    for (const a of out.awards) {
      if (a.AwardItemType === 2) {
        if (a.AwardItemID === 99002) gold = Math.min(1e9, gold + a.AwardItemCnt);
        if (a.AwardItemID === 99004) xp = Math.min(1e9, xp + a.AwardItemCnt);
      } else {
        let item = bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === a.AwardItemID);
        if (!item) {
          item = {
            ItemGID: 95000 + bag.ItemData.length,
            ItemID: a.AwardItemID,
            StackCnt: 0,
            ItemType: 1,
            CreateTime: seconds,
            Detail: { GoodsDetail: { LastUseTime: 0 } },
          };
          bag.ItemData.push(item);
        }
        item.StackCnt = Math.min(1e9, item.StackCnt + a.AwardItemCnt);
      }
    }
    updated = saveBag(
      { ...updated, localXp: xp, localGold: { baseline: profile.gold ?? 100000, value: gold } },
      profile,
      bag,
    );
  }
  const notifications = (out.notifications || []).map((n) => ({
    cmd: n.cmd,
    echo: 0,
    serverTime: seconds,
    body: packRoleStruct(n.type, n.data),
  }));
  if (out.battleStartId) {
    if (!out.resumeBattle || updated.pendingBattle?.level !== out.battleStartId)
      updated = startCampaign(updated, out.battleStartId, seconds);
    if (!updated) throw Error('Invalid maze battle start');
    const body = Buffer.alloc(13);
    body.writeInt32BE(out.battleStartId);
    notifications.push(localBattleEntry(updated, { body }, now, profile));
  }
  if (out.awards?.length || out.dirtyGuild) {
    const data = localRoleData(updated, now, profile);
    notifications.push({
      cmd: 2021,
      echo: 0,
      serverTime: seconds,
      body: packRoleDataGroups({
        BaseData: data.BaseData,
        BagData: data.BagData,
        GuildData: data.GuildData,
        ...(out.dirtyLevel ? { LevelData: data.LevelData } : {}),
      }),
    });
  }
  return {
    role: updated,
    reply: {
      cmd: out.cmd,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct(out.type, out.data),
    },
    notifications,
  };
}
function boxDrawReply(request, role, now, profile) {
  if (request.body.length !== 4) throw Error('Invalid limit-box draw request');
  const seconds = Math.floor(now / 1000),
    out = drawBox(role, request.body.readInt32BE(), randomInt),
    awards = out.awards ?? [],
    bag = localBagData(role, seconds, profile);
  let gold = localGold(role, profile);
  for (const a of awards) {
    if (a.AwardItemType === 2) gold = Math.min(1e9, gold + a.AwardItemCnt);
    else if (a.AwardItemType === 1) {
      let item = bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === a.AwardItemID);
      if (!item) {
        item = {
          ItemGID: 95000 + bag.ItemData.length,
          ItemID: a.AwardItemID,
          StackCnt: 0,
          ItemType: 1,
          CreateTime: seconds,
          Detail: { GoodsDetail: { LastUseTime: 0 } },
        };
        bag.ItemData.push(item);
      }
      item.StackCnt = Math.min(1e9, item.StackCnt + a.AwardItemCnt);
    }
  }
  const updated = out.ret
      ? role
      : saveBag(
          { ...out.role, localGold: { baseline: profile.gold ?? 100000, value: gold } },
          profile,
          bag,
        ),
    data = out.ret ? null : localRoleData(updated, now, profile);
  return {
    role: updated,
    reply: {
      cmd: 10936,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct('CSLimitBoxDrawRes', {
        Result: { Ret: out.ret },
        BootyList: { AwardItem: awards },
        DrawResultList: out.results ?? [],
        LuckBootyList: { AwardItem: out.luck ?? [] },
      }),
    },
    notifications: data
      ? [
          {
            cmd: 10934,
            echo: 0,
            serverTime: seconds,
            body: packRoleStruct('CSNotifyLimitBoxData', boxData(updated)),
          },
          {
            cmd: 2021,
            echo: 0,
            serverTime: seconds,
            body: packRoleDataGroups({ BaseData: data.BaseData, BagData: data.BagData }),
          },
        ]
      : [],
  };
}
function lotteryReply(request, role, now, profile) {
  const seconds = Math.floor(now / 1000),
    out = lotteryAction(request, role, randomInt),
    bag = localBagData(role, seconds, profile);
  let gold = localGold(role, profile);
  // Random-gem goods 70001..70007 are AutoUse=1 / FuncValue=5 in the APK.
  // Advertise that native good in activity configs, grant its real gem to the bag.
  const resolvedAwards = out.awards.flatMap((award) => {
    const goods = GROWTH.GoodsConfig.find((r) => r.ItemID === award.AwardItemID);
    if (award.AwardItemType !== 1 || goods?.AutoUse !== 1 || goods.Func?.FuncValue !== 5)
      return [award];
    const quality = goods.Func.ArrFuncParam[0],
      pool = CLIENT_GEMS.filter((g) => g.quality === quality && normalGem(g));
    if (!pool.length || award.AwardItemCnt > 1000) throw Error('Invalid auto-use gem reward');
    return Array.from({ length: award.AwardItemCnt }, () => ({
      ...award,
      AwardItemID: pool[randomInt(pool.length)].id,
      AwardItemCnt: 1,
    }));
  });
  for (const award of resolvedAwards) {
    const { AwardItemType: kind, AwardItemID: id, AwardItemCnt: count } = award;
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 1e9 ||
      ![1, 2].includes(kind) ||
      (kind === 1 && !GEM_IDS.has(id) && !GOOD_IDS.has(id))
    )
      throw Error('Unsupported local lottery reward');
    if (kind === 2) {
      gold = Math.min(1e9, gold + count);
      continue;
    }
    const gem = GEM_IDS.has(id),
      itemType = gem ? 3 : 1;
    let item = bag.ItemData.find((i) => i.ItemType === itemType && i.ItemID === id);
    if (!item) {
      item = {
        ItemGID: 95000 + bag.ItemData.length,
        ItemID: id,
        ItemType: itemType,
        StackCnt: 0,
        CreateTime: seconds,
        Detail: gem ? { GemDetail: { IsLock: 0 } } : { GoodsDetail: { LastUseTime: 0 } },
      };
      bag.ItemData.push(item);
    }
    item.StackCnt = Math.min(1e9, item.StackCnt + count);
  }
  const updated = out.ret
    ? role
    : out.awards.length
      ? saveBag(
          { ...out.role, localGold: { baseline: profile.gold ?? 100000, value: gold } },
          profile,
          bag,
        )
      : out.role;
  const cmd = request.cmd,
    updates =
      cmd === 10015 || cmd === 10017 || cmd === 11970
        ? [10013, 10014]
        : [10213, 10215].includes(cmd)
          ? [10212, 10217]
          : [11974, 11976].includes(cmd)
            ? [11973, 11978]
            : [10914, 10918].includes(cmd)
              ? [10913]
              : [14802, 14804].includes(cmd)
                ? [14801]
                : [14809, 14811].includes(cmd)
                  ? [14808]
                  : [12049, 12053, 12094, 12096].includes(cmd)
                    ? [12048, 12076, 12063]
                    : [12089, 12092].includes(cmd)
                      ? [12088, 12091]
                      : [];
  const notifications = out.ret
    ? []
    : lotteryNotifications(updated, cmd === 10914 || cmd === 10918)
        .filter(
          (n) => updates.includes(n.cmd) || ((cmd === 10914 || cmd === 10918) && n.cmd === 10912),
        )
        .map((n) => ({
          cmd: n.cmd,
          echo: 0,
          serverTime: seconds,
          body: packRoleStruct(n.type, n.data),
        }));
  if (!out.ret && out.awards.length) {
    const data = localRoleData(updated, now, profile);
    notifications.push({
      cmd: 2021,
      echo: 0,
      serverTime: seconds,
      body: packRoleDataGroups({ BaseData: data.BaseData, BagData: data.BagData }),
    });
  }
  return {
    role: updated,
    reply: {
      cmd: cmd + 1,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct(out.type, out.response),
    },
    notifications,
  };
}
function activityNotifications(role, seconds) {
  return [
    { cmd: 10933, type: 'CSNotifyLimitBoxConfig', data: boxConfig() },
    { cmd: 10934, type: 'CSNotifyLimitBoxData', data: boxData(role) },
    ...lotteryNotifications(role),
    {
      cmd: 4702,
      type: 'CSNotifyActivityOpenConfig',
      data: { ActivityList: [...activityOpenData().ActivityList, ...lotteryOpenEntries()] },
    },
  ].map((n) => ({
    cmd: n.cmd,
    echo: 0,
    serverTime: seconds,
    body: packRoleStruct(n.type, n.data),
  }));
}
export function gemRollReply(request, role, now, profile, rng = randomInt) {
  if (request.body.length !== 16) throw Error('Invalid local gem-roll request length');
  const [itemID, page, part, order] = [0, 4, 8, 12].map((at) => request.body.readUInt32BE(at)),
    seconds = Math.floor(now / 1000);
  const bag = localBagData(role, seconds, profile),
    gems = bag.ItemData.filter((i) => i.ItemType === 3),
    index = gems.findIndex((i) => i.ItemID === itemID && !i.Detail.GemDetail.IsLock),
    source = CLIENT_GEMS.find((g) => g.id === itemID),
    rule = CLIENT_GEM_ROLL.find((r) => r.Quality === source?.quality),
    reagent = bag.ItemData.find((i) => i.ItemID === 1001)?.StackCnt ?? 0;
  const error = () => ({
    role,
    reply: {
      cmd: 4205,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct('CSGemRollRes', {
        Result: { Ret: 1 },
        NewGem: { ItemType: 3, StackCnt: 0 },
      }),
    },
  });
  // This fixture implements bag rolls only. Equipped pages need their own state transitions.
  // After a successful bag roll the APK sends Type=0 on the same open panel.
  // Derive the part from the owned source ID; nonzero mismatches remain invalid.
  const equip = equipmentFor(role, seconds, profile),
    bagCount = gems.filter((i) => i.ItemID === itemID).reduce((n, i) => n + i.StackCnt, 0),
    locked = gems
      .filter((i) => i.ItemID === itemID && i.Detail.GemDetail.IsLock)
      .reduce((n, i) => n + i.StackCnt, 0),
    activeCount = activeGems(equip).filter((i) => i.ItemID === itemID).length,
    maxReferenced = Math.max(
      0,
      ...equip.GemPageData.map(
        (p) =>
          p.GemPageEquipData.flatMap((e) => e.GemList).filter((g) => g.GemData.ItemID === itemID)
            .length,
      ),
    );
  if (
    page !== 0 ||
    order !== 0 ||
    index < 0 ||
    (part !== 0 && source.part !== part) ||
    !rule?.CanRoll ||
    reagent < rule.CostItemNum ||
    bagCount <= Math.max(locked, maxReferenced - activeCount)
  )
    return error();
  const pool = CLIENT_GEMS.filter(
    (g) =>
      g.part === source.part &&
      g.quality === source.quality &&
      g.id !== itemID &&
      g.id < 999000000 &&
      g.id % 10 === source.quality,
  );
  if (!pool.length) return error();
  const chosen = pool[rng(pool.length)],
    nextGem = {
      ...gems[index],
      ItemID: chosen.id,
      StackCnt: 1,
      Detail: { GemDetail: { IsLock: 0 } },
    };
  gems[index].StackCnt--;
  if (gems[index].StackCnt === 0) bag.ItemData.splice(bag.ItemData.indexOf(gems[index]), 1);
  const existing = bag.ItemData.find(
    (i) => i.ItemType === 3 && i.ItemID === chosen.id && !i.Detail.GemDetail.IsLock,
  );
  if (existing) existing.StackCnt++;
  else bag.ItemData.push(nextGem);
  if (!profile.freeActions)
    bag.ItemData.find((i) => i.ItemID === 1001).StackCnt -= rule.CostItemNum;
  const updated = saveBag(role, profile, bag);
  return {
    role: updated,
    reply: {
      cmd: 4205,
      echo: request.echo,
      serverTime: seconds,
      body: packRoleStruct('CSGemRollRes', { Result: {}, NewGem: nextGem }),
    },
    notifications: [
      {
        cmd: 2021,
        echo: 0,
        serverTime: seconds,
        body: packRoleDataGroups({ BagData: localBagData(updated, seconds, profile) }),
      },
    ],
  };
}
export function localBattleEntry(role, request, now = Date.now(), profile = {}) {
  validateLocalRole(role);
  const data = localRoleData(role, now, profile),
    q = (n) => BigInt(Math.round(n * 4294967296));
  const attr = {};
  for (const [key, value] of Object.entries(data.AttrData)) {
    const field = roleTypes.CSActorBattleAttrData.find(([name]) => name === key);
    if (field) attr[key] = field[1] === 'long' ? q(value) : value;
  }
  const combatSkins = battleSkinData(role, profile),
    outfit = combatSkins.SkinList.find((s) => s.SkinType === 1)?.SkinChooseInfo.CurSkinID,
    model =
      GROWTH.SkinBaseConfig.find((s) => s.SkinID === outfit)?.ModelId[
        role.bodyType === 2 ? 1 : 0
      ] || (role.bodyType === 2 ? 21000 : 11000),
    weapon = GROWTH.GunBaseConfig.find((g) => g.ID === data.GunData.CurGunID)?.ClothID || 12000;
  const player = {
    BaseData: {
      WeaponID: weapon,
      RoleID: role.id,
      RoleName: role.name,
      BodyType: role.bodyType,
      ClothID: model,
      ModelID: model,
      PlayerLevel: data.BaseData.Level,
      PlayerFightValue: data.BaseData.FightVal,
      WorldID: 1,
      Head: role.head,
      HeadSex: role.sex,
      ScreenData: { Width: 900, Height: 1600 },
      MagicSkillData: {
        SkillList: Object.entries(coreLevels(role, profile).levels)
          .filter(([, n]) => n > 0)
          .map(([id, SkillLevel]) => ({ SkillID: Number(id), SkillLevel })),
      },
      BattleEquipGemData: {
        EquipList: data.EquipData.EquipList,
        GemList: activeGems(data.EquipData).map((i) => ({ ItemID: i.ItemID })),
      },
      BattleGunData: {
        GunList: data.GunData.GunList.map((g) => ({ GunID: g.GunID, Level: g.GunLevel })),
        GunSkillLevel: data.GunData.GunSkillLevel,
        CurGunID: data.GunData.CurGunID,
        CurGunLevel:
          data.GunData.GunList.find((g) => g.GunID === data.GunData.CurGunID)?.GunLevel || 1,
      },
      BattleWallData: { BattleWall: { Level: 1 } },
      BattleSkinData: { BattleSkin: combatSkins },
      BattleMercenaryData: data.MercenaryData,
      BattleBianShenData: mechaBattleData(role),
    },
    ActorRunData: { Hp: data.AttrData.MaxHp },
    AttrData: attr,
    SkillList: [],
  };
  const state = {
    Result: {},
    LevelID: role.pendingBattle?.level || request.body.readInt32BE(0),
    LevelDiffcult: request.body.readInt32BE(4),
    BattleGID: role.pendingBattle?.id || '9000001001',
    RandSeed: 123456,
    WallRoleID: role.id,
    CaptainRoleID: role.id,
    PlayerData: [{ PlayerData: player, ActorLevel: 1 }],
    StartTime: Math.floor(now / 1000),
  };
  const maze = isMazeBattle(role)
    ? mazeBattleData(
        role,
        data.AttrData.MaxHp,
        combatSkins.SkinList.find((s) => s.SkinType === 2),
      )
    : null;
  if (maze) Object.assign(state, { HasMessData: 1, MessData: maze });
  return {
    cmd: 4253,
    body: packRoleStruct('CSNotifyEnterLevel', state),
    echo: 0,
    serverTime: Math.floor(now / 1000),
  };
}
export function roleSessionReply(request, role, now = Date.now(), profile = {}) {
  if (serviceCommands.has(request.cmd) || mazeCommands.has(request.cmd)) {
    validateLocalRole(role);
    return serviceReply(request, role, now, validateFixtureProfile(profile));
  }
  if (extensionCommands.has(request.cmd)) {
    validateLocalRole(role);
    return extensionReply(request, role, now, validateFixtureProfile(profile));
  }
  if (lotteryCommands.has(request.cmd)) {
    validateLocalRole(role);
    return lotteryReply(request, role, now, validateFixtureProfile(profile));
  }
  const seconds = Math.floor(now / 1000);
  if ([29302, 29304, 29306, 5801, 5803, 5805, 5807].includes(request.cmd)) {
    validateLocalRole(role);
    return growthReply(request, role, now, validateFixtureProfile(profile));
  }
  if (request.cmd === 10935) {
    validateLocalRole(role);
    return boxDrawReply(request, role, now, validateFixtureProfile(profile));
  }
  if (request.cmd === 10931) {
    validateLocalRole(role);
    return {
      role,
      reply: {
        cmd: 10932,
        echo: request.echo,
        serverTime: seconds,
        body: packRoleStruct('CSOperTextNotifyRes', operTextData(request.body)),
      },
    };
  }
  if (request.cmd === 4204) {
    validateLocalRole(role);
    return gemRollReply(request, role, now, validateFixtureProfile(profile));
  }
  if (request.cmd === 4202) {
    validateLocalRole(role);
    return gemComposeReply(request, role, now, validateFixtureProfile(profile));
  }
  if ([4200, 4206, 4208, 4210].includes(request.cmd)) {
    validateLocalRole(role);
    return gemActionReply(request, role, now, validateFixtureProfile(profile));
  }
  if (request.cmd === 29002) {
    validateLocalRole(role);
    return coreUpgradeReply(request, role, now, validateFixtureProfile(profile));
  }
  if (request.cmd === 4217) {
    validateLocalRole(role);
    return equipUpgradeReply(request, role, now, validateFixtureProfile(profile));
  }
  if (request.cmd === 4219) {
    validateLocalRole(role);
    return equipReforgeReply(request, role, now, validateFixtureProfile(profile));
  }
  if (request.cmd === 4238) {
    validateLocalRole(role);
    return oneKeyEquipUpgradeReply(request, role, now, validateFixtureProfile(profile));
  }
  if (request.cmd === 2003) {
    const created = role ?? createLocalRole(parseRoleCreate(request.body), now);
    validateLocalRole(created);
    const fixed = Buffer.alloc(17);
    fixed.writeBigUInt64BE(BigInt(created.id), 5);
    fixed.writeUInt32BE(created.createdAt, 13);
    return {
      role: created,
      reply: {
        cmd: 2004,
        body: Buffer.concat([fixed, nativeString(created.name, 64)]),
        echo: request.echo,
        serverTime: seconds,
      },
    };
  }
  if (request.cmd === 2005) {
    validateLocalRole(role);
    if (request.body.length !== 12 || request.body.readBigUInt64BE(0) !== BigInt(role.id))
      throw Error('Unknown local role login');
    const bag = localBagData(role, seconds, validateFixtureProfile(profile));
    for (const id of lotteryFreeTickets) {
      let item = bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === id);
      if (!item) {
        item = {
          ItemGID: 96000 + bag.ItemData.length,
          ItemID: id,
          ItemType: 1,
          StackCnt: 0,
          CreateTime: seconds,
          Detail: { GoodsDetail: { LastUseTime: 0 } },
        };
        bag.ItemData.push(item);
      }
      item.StackCnt = Math.max(item.StackCnt, 1000000);
    }
    role = saveBag(role, profile, bag);
    const fixed = Buffer.alloc(22);
    fixed.writeUInt32BE(900000001, 0);
    fixed.writeBigUInt64BE(BigInt(role.id), 4);
    fixed.writeUInt32BE(seconds, 17);
    return {
      role,
      reply: {
        cmd: 2006,
        body: Buffer.concat([fixed, packLocalRoleData(role, now, profile)]),
        echo: request.echo,
        serverTime: seconds,
      },
      notifications: [
        coreNotification(role, profile, seconds),
        ...[guildNotification(role, seconds), guildBuildingNotification()].map((n) => ({
          cmd: n.cmd,
          echo: 0,
          serverTime: seconds,
          body: packRoleStruct(n.type, n.data),
        })),
        ...mazeNotifications(role).map((n) => ({
          cmd: n.cmd,
          echo: 0,
          serverTime: seconds,
          body: packRoleStruct(n.type, n.data),
        })),
        ...adNotifications(role).map((n) => ({
          cmd: n.cmd,
          echo: 0,
          serverTime: seconds,
          body: packRoleStruct(n.type, n.data),
        })),
        ...worldBossNotifications().map((n) => ({
          cmd: n.cmd,
          echo: 0,
          serverTime: seconds,
          body: packRoleStruct(n.type, n.data),
        })),
        ...patrolNotifications(role, seconds).map((n) => ({
          cmd: n.cmd,
          echo: 0,
          serverTime: seconds,
          body: packRoleStruct(n.type, n.data),
        })),
        ...mechaNotifications(role).map((n) => ({
          cmd: n.cmd,
          echo: 0,
          serverTime: seconds,
          body: packRoleStruct(n.type, n.data),
        })),
        ...activityNotifications(role, seconds),
      ],
    };
  }
  if (request.cmd === 4251 && request.body.length === 13) {
    validateLocalRole(role);
    const id = request.body.readInt32BE(0),
      body = Buffer.alloc(9),
      updated = startCampaign(role, id, seconds);
    body.writeInt32BE(id, 5);
    if (!updated) body.writeInt32BE(1, 0);
    return {
      role: updated || role,
      reply: { cmd: 4252, body, echo: request.echo, serverTime: seconds },
      notifications: updated ? [localBattleEntry(updated, request, now, profile)] : [],
    };
  }
  if (request.cmd === 4256) {
    validateLocalRole(role);
    return {
      role: { ...role, pendingBattle: null },
      reply: {
        cmd: 4257,
        body: packRefuseReconnectRes(role.pendingBattle?.level || 1001),
        echo: request.echo,
        serverTime: seconds,
      },
    };
  }
  if (request.cmd === 4278) {
    validateLocalRole(role);
    if (request.body.length !== 4) throw Error('Invalid battle skill refresh request');
    const valid = role.pendingBattle && request.body.readInt32BE() === role.pendingBattle.level;
    // Native RefreshReRandomSkillInfo refuses <=0 before running its real RNG.
    // Keep the request enabled with a positive quota on every validated request.
    const count = valid ? Math.min(1000000, (role.pendingBattle.reRandNum || 0) + 1) : 0;
    return {
      role: valid ? { ...role, pendingBattle: { ...role.pendingBattle, reRandNum: count } } : role,
      reply: {
        cmd: 4279,
        body: packRoleStruct('CSReRandLearnedSkillRes', {
          Result: { Ret: valid ? 0 : 1 },
          ReRandNum: count,
        }),
        echo: request.echo,
        serverTime: seconds,
      },
    };
  }
  if (request.cmd === 4254) {
    // 先按战斗 ID 做幂等结算；旧战报重发不应推进另一场战斗或重复发奖。
    validateLocalRole(role);
    const fin = parseFinLevelPrefix(request.body),
      out = settleCampaign(role, fin, seconds);
    if (!out) throw Error('Unknown local pending battle');
    const settlesMaze = !out.replayed && isMazeBattle(role);
    let carry = null,
      reportError = null;
    if (settlesMaze && fin.ClientData.length) {
      try {
        carry = mazeCarryOver(fin, role);
      } catch (e) {
        reportError = e.message;
      }
    }
    let updated = settlesMaze
      ? settleMaze(out.role, out.data.IsWin === 1, carry, fin.HpRate)
      : out.role;
    if (reportError) updated = { ...updated, localMaze: { ...updated.localMaze, reportError } };
    else if (carry) {
      updated.localMaze = { ...updated.localMaze };
      delete updated.localMaze.reportError;
    }
    if (!out.replayed && out.awards.length) {
      const bag = localBagData(updated, seconds, profile);
      let gold = localGold(updated, profile),
        xp = updated.localXp || 0;
      for (const a of out.awards) {
        if (a.AwardItemType === 2) {
          if (a.AwardItemID === 99002) gold = Math.min(1e9, gold + a.AwardItemCnt);
          if (a.AwardItemID === 99004) xp = Math.min(1e9, xp + a.AwardItemCnt);
          continue;
        }
        let item = bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === a.AwardItemID);
        if (!item) {
          item = {
            ItemGID: 95000 + bag.ItemData.length,
            ItemID: a.AwardItemID,
            StackCnt: 0,
            ItemType: 1,
            CreateTime: seconds,
            Detail: { GoodsDetail: { LastUseTime: 0 } },
          };
          bag.ItemData.push(item);
        }
        item.StackCnt = Math.min(1e9, item.StackCnt + a.AwardItemCnt);
      }
      updated = saveBag(
        { ...updated, localXp: xp, localGold: { baseline: profile.gold ?? 100000, value: gold } },
        profile,
        bag,
      );
    }
    const data = localRoleData(updated, now, profile);
    return {
      role: updated,
      reply: {
        cmd: 4255,
        body: packFinLevelRes({ ...out.data, BootyList: { AwardItem: out.awards } }),
        echo: request.echo,
        serverTime: seconds,
      },
      notifications: [
        {
          cmd: 2021,
          echo: 0,
          serverTime: seconds,
          body: packRoleDataGroups({
            BaseData: data.BaseData,
            BagData: data.BagData,
            LevelData: data.LevelData,
          }),
        },
        ...(role.localMaze?.pending
          ? mazeNotifications(updated).map((n) => ({
              cmd: n.cmd,
              echo: 0,
              serverTime: seconds,
              body: packRoleStruct(n.type, n.data),
            }))
          : []),
      ],
    };
  }
  if (request.cmd === 5300 && request.body.length === 8) {
    validateLocalRole(role);
    return {
      role,
      reply: {
        cmd: 5301,
        body: packRoleStruct('CSGetPlayerRankRes', {
          RankTypeID: request.body.readInt32BE(0),
          RankList: [],
          SelfData: {},
        }),
        echo: request.echo,
        serverTime: seconds,
      },
    };
  }
  const boot = {
    2048: [2049, 'CSUpdateScreenRatioRes', {}],
    13001: [13002, 'CSFriendDataRes', { IsAll: 1 }],
    13012: [13013, 'CSFriendRecommendRes', {}],
    13016: [13017, 'CSFriendTiLiListRes', { IsAll: 1 }],
    13019: [13020, 'CSFriendApplyListRes', { IsAll: 1 }],
    13037: [13038, 'CSQueryBlackListDataRes', {}],
    4307: [4308, 'CSQueryGoodsInfoRes', {}],
    3013: [3014, 'CSGuideFuncOpenedRes', nativeFuncOpened(seconds)],
    16026: [16027, 'CSGuildApplicantListRes', {}],
  };
  if (boot[request.cmd]) {
    validateLocalRole(role);
    const [cmd, type, data] = boot[request.cmd];
    return {
      role,
      reply: { cmd, body: packRoleStruct(type, data), echo: request.echo, serverTime: seconds },
    };
  }
  if (request.cmd === 4145) {
    validateLocalRole(role);
    return {
      role,
      reply: { cmd: 4146, body: Buffer.alloc(5), echo: request.echo, serverTime: seconds },
    };
  }
  return null;
}
