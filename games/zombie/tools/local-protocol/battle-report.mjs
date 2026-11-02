import { roleTypes } from './role-schema.mjs';
import { battleReportTypes } from './battle-report-schema.mjs';
const types = { ...roleTypes, ...battleReportTypes };
const fixed = { 'CSBootyAwardItem.AwardItemParam': 3, 'CSBootyAwardItem.AwardItemRunParam': 2 };
export function readBattleReport(body) {
  if (!Buffer.isBuffer(body) || body.length > 65536) throw Error('Invalid battle report size');
  let at = 0,
    nodes = 0;
  const take = (n) => {
    if (n < 0 || at + n > body.length) throw Error('Truncated battle report');
    const b = body.subarray(at, at + n);
    at += n;
    return b;
  };
  const scalar = (t) => {
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
    };
    const method = {
      byte: 'readUInt8',
      sbyte: 'readInt8',
      short: 'readInt16BE',
      ushort: 'readUInt16BE',
      int: 'readInt32BE',
      uint: 'readUInt32BE',
      float: 'readFloatBE',
      long: 'readBigInt64BE',
      ulong: 'readBigUInt64BE',
    };
    if (!sizes[t]) throw Error('Unknown report scalar ' + t);
    const v = take(sizes[t])[method[t]]();
    return typeof v === 'bigint' ? v.toString() : v;
  };
  const extra = () => {
    const count = scalar('byte');
    if (count > 4) throw Error('Invalid report equipment attributes');
    take(count * 10);
  };
  function read(type, depth = 0) {
    if (depth > 35 || ++nodes > 15000) throw Error('Battle report complexity exceeded');
    if (type === 'string') {
      const n = scalar('uint');
      if (n < 1 || n > 2048) throw Error('Invalid report string');
      const v = take(n);
      if (v[n - 1] !== 0) throw Error('Unterminated report string');
      return v.subarray(0, -1).toString('utf8');
    }
    if (type === 'CSItemData') {
      const v = {
        ItemGID: scalar('uint'),
        ItemID: scalar('uint'),
        StackCnt: scalar('uint'),
        ItemType: scalar('byte'),
        CreateTime: scalar('uint'),
      };
      if (v.ItemType === 1) take(4);
      else if (v.ItemType === 3) take(4);
      else if (v.ItemType === 2) {
        take(14);
        extra();
        const temp = scalar('byte');
        if (temp > 1) throw Error('Invalid report equipment flag');
        if (temp) extra();
        take(6);
      } else throw Error('Unsupported report item type');
      return v;
    }
    if (!types[type]) return scalar(type);
    const data = {},
      fields = types[type];
    for (let i = 0; i < fields.length; i++) {
      const [name, kind] = fields[i],
        prev = fields[i - 1];
      if (type === 'CSNotifyEnterLevel' && name === 'RelayRoomInfo' && !data.IsHaveRelayRoomInfo)
        continue;
      if (kind.endsWith('[]')) {
        const count = fixed[type + '.' + name] ?? data[prev?.[0]];
        if (
          !Number.isInteger(count) ||
          count < 0 ||
          count > (type === 'CSBattlePackData' ? 65536 : 4096)
        )
          throw Error('Invalid report count ' + type + '.' + name);
        if (type === 'CSBattlePackData' && name === 'Data') data[name] = take(count);
        else data[name] = Array.from({ length: count }, () => read(kind.slice(0, -2), depth + 1));
      } else data[name] = read(kind, depth + 1);
    }
    return data;
  }
  const data = read('CSLevelFinStageClientData');
  if (at !== body.length) throw Error('Trailing battle report bytes');
  return data;
}
export function mazeCarryOver(fin, role) {
  if (!fin.ClientData?.length) return null;
  const report = readBattleReport(fin.ClientData),
    start = report.StartParam,
    battle = role.pendingBattle;
  if (start.BattleGID !== battle?.id || start.LevelID !== battle.level)
    throw Error('Battle report identity mismatch');
  const player = report.PlayerRunCheckData.PlayerRunData.find((p) => p.RoleID === role.id),
    mess = player?.MessFinalData,
    last = mess?.LastMessData;
  // FillCSLevelStartParam (0x136AE28) fills only MessFinalData.LastMessData;
  // the final wrapper's coordinates remain zero. Validate the start snapshot.
  const node = start.MessData;
  if (
    !last ||
    !start.HasMessData ||
    node.Level !== role.localMaze?.level ||
    node.Row !== role.localMaze.pending?.Row ||
    node.Clo !== role.localMaze.pending?.Clo ||
    (mess.Level && mess.Level !== node.Level) ||
    (mess.Row && mess.Row !== node.Row) ||
    (mess.Clo && mess.Clo !== node.Clo)
  )
    throw Error('Maze report node mismatch');
  if (
    last.WallHpMax < 1 ||
    last.WallHp < 0 ||
    last.WallHp > last.WallHpMax ||
    last.BuildList.length > 512 ||
    last.BuildList.some((b) => !b.BuildID || b.Count < 1 || b.Count > 10000)
  )
    throw Error('Invalid maze carry-over');
  return last;
}
