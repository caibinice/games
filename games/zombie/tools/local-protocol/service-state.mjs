// Personal-server services. Reward quantities are explicit local rules, not
// reconstructed official drop rates. Protocol fields use the pinned client.
import { campaignAwards, claimCampaignStar } from './campaign-state.mjs';
import { MAZE_SOURCE } from './maze-source.mjs';
export function patrolAwards(role) {
  return campaignAwards(Math.max(1001, role.lastSettlement?.data?.LevelID || 1001));
}
export function patrolNotifications(role, seconds) {
  const awards = patrolAwards(role);
  return [
    {
      cmd: 12320,
      type: 'CSNotifyTourData',
      data: { StartTime: 1, HangTourBooty: { AwardItem: awards } },
    },
    {
      cmd: 4288,
      type: 'CSNotifyPatrolAwardData',
      data: { LastPatrolTime: 1, CumuPatrolTime: 28800, PatrolAward: { AwardItem: awards } },
    },
  ];
}
export function worldBossNotifications() {
  return [
    {
      cmd: 4183,
      type: 'CSNotifyWorldBossData',
      data: {
        DailyChallengeNum: 1000000,
        SumScore: 0,
        DayChangeHasBuyNum: 0,
        NextBuyCost: 0,
        DailyHasPlayNum: 0,
        BuyMaxCount: 1000000,
      },
    },
    { cmd: 4185, type: 'CSNotifyWorldBossCfg', data: { LevelID: 4001 } },
  ];
}
export function adNotifications(role) {
  return [
    {
      cmd: 12801,
      type: 'CSNotifyAdConfig',
      data: {
        AdTypeConfigList: Array.from({ length: 16 }, (_, i) => ({
          AdType: i + 1,
          OpenType: 0,
          DailyMaxWatchNum: 1000000,
          WatchInterval: 0,
          FreeAdItemId: 0,
          ActiveParam: [0, 0],
          BootyParam: [0, 0, 0],
          BootyList: {},
          IsClose: 0,
          IsNeedPreload: 0,
          ShowAdParam: Array(40).fill(''),
        })),
      },
    },
    {
      cmd: 12800,
      type: 'CSNotifyAdData',
      data: {
        AdTypeDataList: Array.from({ length: 16 }, (_, i) => ({
          AdType: i + 1,
          DailyWatchNum: 0,
          LastWatchTime: 0,
          IsActivate: 1,
        })),
        CurrBattleWatchNum: 0,
      },
    },
  ];
}
export const guildState = (role) =>
  structuredClone(
    role.localGuild || {
      id: '9100000001',
      name: role.name + '的军团',
      flag: 1,
      createdAt: role.createdAt,
      donations: 0,
    },
  );
export function guildRoleData(role) {
  const s = guildState(role);
  return { GuildUID: s.id, Name: s.name, Flag: s.flag, Level: 1 };
}
export function guildBuildingNotification() {
  return {
    cmd: 16611,
    type: 'CSGuildBuildingDataNotify',
    data: {
      BuildingUnlockList: MAZE_SOURCE.GuildBuildingConfig.map((r) => ({
        BuildingType: r.BuildingID,
      })),
    },
  };
}
function guildMember(role, seconds, bot = 0) {
  const s = guildState(role);
  return {
    RoleData: {
      Uin: 900000001 + bot,
      RoleID: String(BigInt(role.id) + BigInt(bot)),
      WorldID: 1,
      BirthWorldID: 1,
      RoleNO: 1 + bot,
      RoleName: bot ? '军团机器人' + bot : role.name,
      Sex: 1,
      Level: 30,
      Head: 1000,
      BodyType: 1,
      HeadSex: 1,
      ClothID: 11000,
      WeaponID: 12000,
    },
    GuildPos: bot ? 5 : 1,
    GuildRank: bot ? 5 : 1,
    JoinTime: s.createdAt,
    ContribteWeek: bot ? 100 : s.donations,
    ContribteHave: bot ? 100 : s.donations,
    ContribteHistory: bot ? 100 : s.donations,
    LastLoginTime: seconds,
    IsOnline: 1,
  };
}
export function guildNotification(role, seconds) {
  const s = guildState(role);
  return {
    cmd: 16002,
    type: 'CSGuildNotifyRes',
    data: {
      HaveGuildBriefData: 1,
      GuildBriefData: {
        GID: s.id,
        NO: 1,
        Name: s.name,
        Level: 1,
        MemberNum: 4,
        Annouce: '个人军团 · 可重复签到',
        Claim: '自建服务器',
        JoinLevel: 1,
        JoinType: 0,
        Country: 0,
        Money: 1000000,
        TotalSalary: 0,
        GuildBuilding: Array.from({ length: 5 }, (_, i) => ({
          BuildingID: i + 1,
          BuildingLevel: 1,
        })),
        FounderRoleNO: 1,
        FounderName: role.name,
        AutoAcceptApply: 1,
        FreshSuccess: 1,
        Flag: s.flag,
      },
      MemberInit: 1,
      GuildMemberData: [0, 1, 2, 3].map((bot) => guildMember(role, seconds, bot)),
      WinNum: 0,
    },
  };
}
export const serviceCommands = new Set([
  4186, 4286, 4500, 4289, 12321, 12323, 12802, 12805, 16001, 16003, 16005, 16031, 16070, 16079,
]);
export function serviceAction(q, role, seconds, p) {
  const c = q.cmd,
    b = q.body,
    ok = (type, data = {}, r = role) => ({
      role: r,
      cmd: c + 1,
      type,
      data: { Result: { Ret: 0 }, ...data },
    });
  if (c === 12805) {
    if (
      b.length < 8 ||
      b.readInt32BE(4) < 0 ||
      b.readInt32BE(4) > 10 ||
      b.length !== 8 + b.readInt32BE(4) * 4
    )
      throw Error('Invalid ad context');
    return ok('CSAdSaveParamRes');
  }
  if (c === 12802) {
    if (b.length < 13) throw Error('Short ad reward request');
    const ad = b.readInt32BE(),
      count = b.readInt32BE(5);
    if (ad < 1 || ad > 16 || count < 0 || count > 10 || b.length !== 13 + count * 4)
      throw Error('Invalid ad reward request');
    // The pinned client's actual quick-patrol button uses AD_TYPE_SAODANG (8).
    // Keep type 3 compatibility for earlier personal-client requests.
    const patrol = [3, 8].includes(ad),
      params = Array.from({ length: count }, (_, i) => b.readInt32BE(9 + i * 4)),
      awards = patrol ? patrolAwards(role) : [],
      base = patrol
        ? { ...role, localPatrol: { count: (role.localPatrol?.count || 0) + 1, lastAt: seconds } }
        : role,
      updated = {
        ...base,
        localAdAudit: {
          lastType: ad,
          lastAt: seconds,
          counts: {
            ...role.localAdAudit?.counts,
            [ad]: (role.localAdAudit?.counts?.[ad] || 0) + 1,
          },
        },
      };
    return {
      ...ok(
        'CSWatchAdRewardRes',
        { AdType: ad, Param: params, BootyList: { AwardItem: awards } },
        updated,
      ),
      awards,
      notifications: [
        ...adNotifications(updated),
        ...(patrol ? patrolNotifications(updated, seconds) : []),
      ],
    };
  }
  if (c === 4186) {
    if (b.length !== 1) throw Error('Invalid world-boss chance request');
    return { ...ok('CSWorldBossBuyChanceRes'), notifications: worldBossNotifications() };
  }
  if (c === 4286) {
    if (b.length !== 12) throw Error('Invalid stage-star reward request');
    const out = claimCampaignStar(role, b.readInt32BE(), b.readInt32BE(4), b.readInt32BE(8));
    return out
      ? {
          ...ok('CSGetLevelAwardRes', { BootyAwardList: { AwardItem: out.awards } }, out.role),
          awards: out.awards,
          dirtyLevel: true,
        }
      : {
          role,
          cmd: 4287,
          type: 'CSGetLevelAwardRes',
          data: { Result: { Ret: 1 }, BootyAwardList: {} },
          dirtyLevel: true,
        };
  }
  if ([4500, 4289, 12321, 12323].includes(c)) {
    if (b.length !== ([12321, 12323].includes(c) ? 1 : 4)) throw Error('Invalid patrol request');
    const type = {
        4500: 'CSFetchGuaJiAwardRes',
        4289: 'CSGetPatrolAwardRes',
        12321: 'CSDrawHangTourBootyRes',
        12323: 'CSDrawQuickTourBootyRes',
      }[c],
      awards = patrolAwards(role),
      updated = {
        ...role,
        localPatrol: { count: (role.localPatrol?.count || 0) + 1, lastAt: seconds },
      };
    return {
      ...ok(type, c === 4289 ? {} : { BootyList: { AwardItem: awards } }, updated),
      awards,
      notifications: patrolNotifications(updated, seconds),
    };
  }
  if (c === 16001) {
    if (b.length !== 1) throw Error('Invalid guild query');
    const n = guildNotification(role, seconds);
    return {
      role,
      cmd: n.cmd,
      type: n.type,
      data: n.data,
      notifications: [guildBuildingNotification()],
    };
  }
  if (c === 16005) {
    if (b.length !== 8) throw Error('Invalid guild search');
    return ok('CSGuildSearchRes', { SearchID: b.readBigUInt64BE().toString(), ResultData: [] });
  }
  if (c === 16031) {
    if (b.length !== 1 && b.length !== 4) throw Error('Invalid guild history query');
    return { role, cmd: 16032, type: 'CSGuildHistoryRes', data: { ArrHistoryData: [] } };
  }
  if (c === 16003) {
    let at = 0;
    const string = (max) => {
      if (at + 4 > b.length) throw Error('Short guild creation');
      const len = b.readUInt32BE(at);
      at += 4;
      if (len < 1 || len > max || at + len > b.length || b[at + len - 1] !== 0)
        throw Error('Invalid guild name');
      const v = b.subarray(at, at + len - 1).toString('utf8');
      at += len;
      return v;
    };
    const name = string(64);
    if (at + 4 > b.length) throw Error('Short guild flag');
    const flag = b.readUInt32BE(at);
    at += 4;
    string(256);
    string(256);
    if (at + 1 !== b.length) throw Error('Invalid guild creation length');
    const updated = { ...role, localGuild: { ...guildState(role), name, flag } };
    return {
      ...ok('CSGuildCreateRes', {}, updated),
      dirtyGuild: true,
      notifications: [guildNotification(updated, seconds), guildBuildingNotification()],
    };
  }
  if (c === 16079) {
    return {
      role,
      cmd: 16080,
      type: 'CSGuildDonateDataRes',
      data: { TodayDonateCnt: 0, LastDonateTime: 0 },
    };
  }
  if (c === 16070) {
    if (b.length !== 1 && b.length !== 4) throw Error('Invalid guild donation');
    const s = guildState(role);
    s.donations += 100;
    const updated = { ...role, localGuild: s };
    return {
      ...ok('CSGuildDonateMoneyRes', { AddContribute: 100 }, updated),
      notifications: [
        guildNotification(updated, seconds),
        {
          cmd: 16080,
          type: 'CSGuildDonateDataRes',
          data: { TodayDonateCnt: 0, LastDonateTime: 0 },
        },
      ],
    };
  }
  return null;
}
