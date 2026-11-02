import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { sdkIdentity, gameIdentity } from './fixture.mjs';

export const PERSONAL_ACCOUNTS = Object.freeze(['admin1', 'admin2', 'admin3']);
export function createAccountConfig(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    throw Error('Invalid account password');
  return {
    version: 1,
    accounts: Object.fromEntries(
      PERSONAL_ACCOUNTS.map((name) => {
        const salt = randomBytes(16).toString('hex');
        return [name, { salt, hash: scryptSync(password, salt, 32).toString('hex') }];
      }),
    ),
  };
}
export function personalAccounts(
  config,
  secret,
  { ttlSeconds = 30 * 86400, nativeTtlSeconds = ttlSeconds } = {},
) {
  if (
    ![ttlSeconds, nativeTtlSeconds].every((n) => Number.isInteger(n) && n >= 60 && n <= 30 * 86400)
  )
    throw Error('Invalid personal session lifetime');
  if (
    !Buffer.isBuffer(secret) ||
    secret.length < 32 ||
    config?.version !== 1 ||
    Object.keys(config.accounts ?? {})
      .sort()
      .join(',') !== [...PERSONAL_ACCOUNTS].sort().join(',')
  )
    throw Error('Invalid personal account configuration');
  for (const row of Object.values(config.accounts))
    if (!/^[a-f0-9]{32}$/.test(row.salt) || !/^[a-f0-9]{64}$/.test(row.hash))
      throw Error('Invalid password verifier');
  const mac = (domain, value, n = 18) =>
    createHmac('sha256', secret)
      .update(domain + value)
      .digest()
      .subarray(0, n)
      .toString('base64url');
  const eq = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  function issueSdk(name, now = Date.now()) {
    if (!PERSONAL_ACCOUNTS.includes(name)) throw Error('Unknown personal account');
    const data = name + '.' + Math.floor(now / 1000).toString(36);
    return data + '.' + mac('sdk-account-v1:', data);
  }
  function sdkAccount(token, now = Date.now()) {
    if (typeof token !== 'string' || token.length > 100) return null;
    const parts = token.split('.');
    if (
      parts.length !== 3 ||
      !PERSONAL_ACCOUNTS.includes(parts[0]) ||
      !/^[0-9a-z]{6,8}$/.test(parts[1])
    )
      return null;
    const age = Math.floor(now / 1000) - parseInt(parts[1], 36);
    return age >= -10 &&
      age <= ttlSeconds &&
      eq(parts[2], mac('sdk-account-v1:', parts[0] + '.' + parts[1]))
      ? parts[0]
      : null;
  }
  function issueNative(name, now = Date.now()) {
    if (!PERSONAL_ACCOUNTS.includes(name)) throw Error('Unknown personal account');
    const data =
      Math.floor(now / 1000)
        .toString(36)
        .padStart(6, '0') + String(PERSONAL_ACCOUNTS.indexOf(name) + 1);
    if (data.length !== 7) throw Error('Native token width exceeded');
    return data + mac('native-account-v1:', data, 11);
  }
  function nativeAccount(token, now = Date.now()) {
    if (typeof token !== 'string' || !/^[0-9a-z]{6}[123][A-Za-z0-9_-]{15}$/.test(token))
      return null;
    const data = token.slice(0, 7),
      age = Math.floor(now / 1000) - parseInt(data.slice(0, 6), 36);
    return age >= -10 &&
      age <= nativeTtlSeconds &&
      eq(token.slice(7), mac('native-account-v1:', data, 11))
      ? PERSONAL_ACCOUNTS[Number(data[6]) - 1]
      : null;
  }
  function packetAccount(body, now = Date.now()) {
    for (let i = 4; i <= body.length - 22; i++) {
      const name = nativeAccount(body.subarray(i, i + 22).toString('latin1'), now);
      if (name) return name;
    }
    return null;
  }
  function credentials(name, password) {
    // Run one verifier for unknown names as well, without accepting arbitrary IDs.
    const row = PERSONAL_ACCOUNTS.includes(name) ? config.accounts[name] : config.accounts.admin1;
    if (typeof password !== 'string' || password.length > 128) return false;
    const matches = timingSafeEqual(
      scryptSync(password, row.salt, 32),
      Buffer.from(row.hash, 'hex'),
    );
    return PERSONAL_ACCOUNTS.includes(name) && matches;
  }
  const response = (data) => ({
    status: 200,
    layer: 'personal-account',
    contentType: 'application/json; charset=utf-8',
    body: Buffer.from(JSON.stringify(data)),
  });
  function route(method, target, body = '', contentType = '', now = Date.now()) {
    const url = new URL(target, 'http://127.0.0.1'),
      params = new URLSearchParams(url.search);
    if (contentType.includes('application/json')) {
      try {
        for (const [k, v] of Object.entries(JSON.parse(body)))
          if (typeof v === 'string') params.set(k, v);
      } catch {
        return response({ ret: 1, info: '请求格式错误' });
      }
    } else for (const [k, v] of new URLSearchParams(body)) params.set(k, v);
    const path = url.pathname;
    if (path === '/login/login_guest.php')
      return response({ ret: 1, info: '请使用 admin1、admin2 或 admin3 账号登录' });
    if (
      [
        '/login/login_verify_mobile_passwd.php',
        '/login/login_verify_passwd.php',
        '/login/check_login.php',
      ].includes(path)
    ) {
      let name;
      if (path === '/login/check_login.php') name = sdkAccount(params.get('token'), now);
      else {
        const id =
          params.get('mobile') ??
          params.get('account') ??
          params.get('username') ??
          params.get('account_name');
        if (credentials(id, params.get('passwd') ?? params.get('password'))) name = id;
      }
      if (!name) return response({ ret: 1, info: '账号或密码错误，仅开放 admin1、admin2、admin3' });
      return response({
        ...sdkIdentity(now, 2),
        token: issueSdk(name, now),
        account_name: name,
        accountname: name,
        mobile: name,
      });
    }
    if (['/auth/auth_sdk/auth.php', '/auth/auth_quick/auth.php'].includes(path)) {
      // The native auth request wraps the SDK identity in sdk_data on this build.
      let token = params.get('token');
      for (const key of ['sdk_data', 'sdkdata', 'ext', 'sdkInfo', 'sdkinfo']) {
        const raw = params.get(key);
        if (raw)
          try {
            const obj = JSON.parse(raw);
            token = obj.token ?? obj.Token ?? token;
          } catch {}
      }
      const name = sdkAccount(token, now);
      if (!name) return response({ ret: 1, info: '登录凭据已失效，请重新输入账号密码' });
      return response({ ...gameIdentity(now, issueNative(name, now)), accountname: '900000001' });
    }
    return null;
  }
  return { route, credentials, issueSdk, sdkAccount, issueNative, nativeAccount, packetAccount };
}

export function accountRoleStore(directory, validate) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = (name) => {
    if (!PERSONAL_ACCOUNTS.includes(name)) throw Error('Unknown personal account');
    return join(directory, name + '.json');
  };
  return {
    load(name) {
      const path = file(name);
      return existsSync(path) ? validate(JSON.parse(readFileSync(path, 'utf8'))) : null;
    },
    save(name, role) {
      validate(role);
      const path = file(name);
      writeFileSync(path + '.tmp', JSON.stringify(role, null, 2), { mode: 0o600 });
      renameSync(path + '.tmp', path);
    },
  };
}
