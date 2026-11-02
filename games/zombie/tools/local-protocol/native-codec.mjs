// Wire format recovered from the pinned reference APK. The key is supplied at
// runtime from its PlatformInfo; no APK key or real identity is stored here.
const DELTA = 0x9e3779b9;
const u32 = (n) => n >>> 0;
const mx = (z, y, sum, p, e, k) =>
  u32(u32(((z >>> 5) ^ (y << 2)) + ((y >>> 3) ^ (z << 4))) ^ u32((sum ^ y) + (k[(p & 3) ^ e] ^ z)));

export function keyWords(text) {
  const bytes = Buffer.from(text, 'utf8'),
    padded = Buffer.alloc(Math.max(16, Math.ceil(bytes.length / 4) * 4));
  bytes.copy(padded);
  return Array.from({ length: 4 }, (_, i) => padded.readUInt32LE(i * 4));
}
export function xxtea(bytes, key, decrypt = false) {
  if (bytes.length < 16 || bytes.length % 16 !== 0 || key.length !== 4)
    throw Error('Invalid native cipher parameters');
  const v = Array.from({ length: bytes.length / 4 }, (_, i) => bytes.readUInt32LE(i * 4)),
    n = v.length,
    rounds = 6 + Math.floor(52 / n);
  if (decrypt) {
    let sum = u32(rounds * DELTA),
      y = v[0];
    while (sum) {
      const e = (sum >>> 2) & 3;
      for (let p = n - 1; p >= 0; p--) {
        const z = v[p ? p - 1 : n - 1];
        y = v[p] = u32(v[p] - mx(z, y, sum, p, e, key));
      }
      sum = u32(sum - DELTA);
    }
  } else {
    let sum = 0,
      z = v[n - 1];
    for (let q = 0; q < rounds; q++) {
      sum = u32(sum + DELTA);
      const e = (sum >>> 2) & 3;
      for (let p = 0; p < n; p++) {
        const y = v[p < n - 1 ? p + 1 : 0];
        z = v[p] = u32(v[p] + mx(z, y, sum, p, e, key));
      }
    }
  }
  const out = Buffer.alloc(bytes.length);
  v.forEach((word, i) => out.writeUInt32LE(word, i * 4));
  return out;
}
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function encodeNativePacket({ cmd, body, echo = 0, serverTime = 0, sequence = 0 }, key) {
  const inner = Buffer.alloc(18 + body.length);
  inner.writeUInt16BE(0x3243, 0);
  inner.writeUInt16BE(cmd, 2);
  inner.writeUInt32BE(inner.length, 4);
  inner.writeUInt16BE(1, 8);
  inner.writeUInt32BE(echo, 10);
  inner.writeUInt32BE(serverTime, 14);
  body.copy(inner, 18);
  const plain = Buffer.alloc(Math.ceil((6 + inner.length) / 16) * 16);
  plain.writeUInt32BE(crc32(inner), 0);
  plain.writeUInt16BE(sequence & 0xffff, 4);
  inner.copy(plain, 6);
  const wire = Buffer.alloc(6 + plain.length);
  wire.writeUInt16BE(0x3245, 0);
  wire.writeUInt32BE(wire.length, 2);
  xxtea(plain, key).copy(wire, 6);
  return wire;
}
export function nativeFrameLength(bytes) {
  if (bytes.length < 6) return null;
  const magic = bytes.readUInt16BE(0),
    size = bytes.readUInt32BE(2),
    alignment = magic === 0x3245 ? 16 : magic === 0x3246 ? 4 : 0;
  if (!alignment || size < 30 || size > 65536 || (size - 6) % alignment)
    throw Error('Invalid native frame header');
  return size;
}
export function decodeNativePacket(wire, key, simpleKey = 0) {
  const size = nativeFrameLength(wire);
  if (size === null || size !== wire.length) throw Error('Incomplete native frame');
  let plain;
  if (wire.readUInt16BE(0) === 0x3245) plain = xxtea(wire.subarray(6), key, true);
  else {
    plain = Buffer.from(wire.subarray(6));
    const k = Buffer.alloc(4);
    k.writeUInt32BE(simpleKey);
    for (let i = 0; i < plain.length; i++) plain[i] ^= k[i % 4];
  }
  if (plain.readUInt16BE(6) !== 0x3243) throw Error('Invalid inner native magic');
  const length = plain.readUInt32BE(10);
  if (length < 18 || length + 6 > plain.length) throw Error('Invalid inner native length');
  const inner = plain.subarray(6, 6 + length);
  if (crc32(inner) !== plain.readUInt32BE(0)) throw Error('Native CRC mismatch');
  return {
    cmd: inner.readUInt16BE(2),
    version: inner.readUInt16BE(8),
    echo: inner.readUInt32BE(10),
    serverTime: inner.readUInt32BE(14),
    sequence: plain.readUInt16BE(4),
    body: inner.subarray(18),
  };
}
export function accountReconnectFlag(body) {
  // CSActLoginReq: Uin/SvrID/AuthTime, ChannelName, LoginKey, Reconnect.
  // Short synthetic login probes have no reconnect field.
  if (body.length < 20) return 0;
  let at = 12;
  for (const max of [64, 128]) {
    if (at + 4 > body.length) return 0;
    const n = body.readUInt32BE(at);
    at += 4;
    if (n < 1 || n > max || at + n > body.length || body[at + n - 1] !== 0) return 0;
    at += n;
  }
  if (at >= body.length) return 0;
  if (body[at] > 1) throw Error('Invalid native reconnect flag');
  return body[at];
}
export function accountLoginReply(request, now = Date.now(), role = null, authorize = null) {
  // CSActLoginRes.pack: UinInfo, ProtoResult, time, reconnect, quick-login,
  // simple key, is-have-role, server-open-time. Role existence is explicit.
  if (
    request.cmd !== 2001 ||
    request.body.length < 4 ||
    request.body.readUInt32BE(0) !== 900000001 ||
    !(authorize
      ? authorize(request.body, now)
      : request.body.includes(Buffer.from('LOCAL_FIXTURE_GAME_KEY')))
  )
    throw Error('Not a local synthetic account-login request');
  const seconds = Math.floor(now / 1000),
    body = Buffer.alloc(32);
  body.writeUInt32BE(900000001, 0);
  if (role) body.writeBigUInt64BE(BigInt(role.id), 4);
  body.writeUInt32BE(seconds, 17);
  body[21] = accountReconnectFlag(request.body);
  body.writeUInt32BE(0, 23);
  body[27] = role ? 1 : 0;
  body.writeUInt32BE(seconds - 86400, 28);
  return { cmd: 2002, body, echo: request.echo, serverTime: seconds };
}
export function nativeString(text, maxBytes) {
  const value = Buffer.from(text + '\0', 'utf8');
  if (value.length > maxBytes) throw Error('Native string too long');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(value.length);
  return Buffer.concat([length, value]);
}
export function accountAuxReply(request, now = Date.now()) {
  const serverTime = Math.floor(now / 1000);
  if (request.cmd === 2009 && request.body.length === 4)
    return {
      cmd: 2010,
      body: Buffer.concat([request.body, nativeString('127.0.0.1', 32)]),
      echo: request.echo,
      serverTime,
    };
  if (request.cmd === 2014 && request.body.length === 5)
    return {
      cmd: 2015,
      body: Buffer.concat([Buffer.alloc(5), nativeString('本地测试员', 32)]),
      echo: request.echo,
      serverTime,
    };
  return null;
}
