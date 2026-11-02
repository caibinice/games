import { createHmac, timingSafeEqual } from 'node:crypto';

export function advertisedWorld({
  host = '127.0.0.1',
  port = 53174,
  name = '本地协议测试区',
} = {}) {
  if (
    typeof host !== 'string' ||
    host.length > 253 ||
    !/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host) ||
    host.includes('..')
  )
    throw Error('Invalid advertised game host');
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error('Invalid advertised game port');
  if (typeof name !== 'string' || !name.trim() || name.length > 50 || /[\x00-\x1f]/.test(name))
    throw Error('Invalid advertised world name');
  return { host, port, name };
}

// Matches the 22-byte key length already observed in the native login packet.
// The TCP listener never accepts the old constant key when this guard is used.
export function nativeLoginGuard(secret, { ttlSeconds = 900 } = {}) {
  if (!Buffer.isBuffer(secret) || secret.length < 32)
    throw Error('Native session secret requires at least 32 bytes');
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 3600)
    throw Error('Invalid native login TTL');
  const mac = (stamp) =>
    createHmac('sha256', secret)
      .update('native-login-v1:' + stamp)
      .digest()
      .subarray(0, 12)
      .toString('base64url');
  function issue(now = Date.now()) {
    const stamp = Math.floor(now / 1000)
      .toString(36)
      .padStart(6, '0');
    if (stamp.length !== 6) throw Error('Native timestamp exceeds fixed token width');
    return stamp + mac(stamp);
  }
  function valid(token, now = Date.now()) {
    if (typeof token !== 'string' || !/^[0-9a-z]{6}[A-Za-z0-9_-]{16}$/.test(token)) return false;
    const stamp = token.slice(0, 6),
      age = Math.floor(now / 1000) - parseInt(stamp, 36);
    if (age < -10 || age > ttlSeconds) return false;
    return timingSafeEqual(Buffer.from(token.slice(6), 'ascii'), Buffer.from(mac(stamp), 'ascii'));
  }
  function packet(body, now = Date.now()) {
    if (!Buffer.isBuffer(body) || body.length > 65536) return false;
    for (let i = 4; i <= body.length - 22; i++) {
      const token = body.subarray(i, i + 22).toString('latin1');
      if (valid(token, now)) return true;
    }
    return false;
  }
  return { issue, valid, packet };
}
