// Local-only APK protocol research. No forwarding and no production credentials.
export const REFERENCE_APK_SHA256 =
  '7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6';
export const FIXTURE_UIN = '900000001';

export function sdkIdentity(now = Date.now(), accountType = 1) {
  const seconds = Math.floor(now / 1000);
  // Required fields were recovered from DodUserManager.parseLogin, not guessed
  // from the appearance of the SDK login screen. Optional verification fields
  // are deliberately absent: this identity exists only inside the local test.
  return {
    ret: 0,
    info: 'local protocol fixture',
    uin: FIXTURE_UIN,
    create_time: seconds,
    login_time: seconds,
    account_type: accountType,
    token: 'LOCAL_FIXTURE_ONLY',
    account_name: 'fixture-local',
    accountname: 'fixture-local',
    is_can_login: 1,
    need_active: 0,
    mobile_need_set_pwd: 0,
    is_need_bind_mobile: 0,
    is_need_verify_realname: 0,
  };
}

export function gameIdentity(now = Date.now(), loginKey = 'LOCAL_FIXTURE_GAME_KEY') {
  // AccountAuthMgr.ParseAuthResult: mandatory numeric/string types were checked
  // against the ARM64 GetInt64/GetString/GetInt calls in the reference build.
  const seconds = Math.floor(now / 1000);
  return {
    ret: 0,
    info: 'local protocol fixture',
    uin: Number(FIXTURE_UIN),
    authtime: seconds,
    loginkey: loginKey,
    channelname: 'dodsdk',
    channeltype: 0,
    accountname: 'fixture-local',
    createtime: String(seconds),
    is_bind_guest: 0,
    regionid: 0,
  };
}

export function worldDirectory(
  now = Date.now(),
  port = 53174,
  world = { host: '127.0.0.1', port, name: '本地协议测试区' },
) {
  const seconds = Math.floor(now / 1000);
  // convertWorldState splits on '|'; WorldInfo.CanEnter requires both bit 1
  // (open) and bit 2 (run). A bare 'run' is explicitly not an open server.
  return {
    world_list: [
      {
        world_id: 1,
        world_name: world.name,
        state: 'open|run',
        conn_ip: world.host,
        conn_port: world.port,
        enter_svr_notice: 'Local protocol fixture; role-session implementation pending',
        uin_open_time: 0,
        world_open_time: seconds - 86400,
        ispingshen: 0,
      },
    ],
    test_flag: 1,
    last_vist_worlds: ['1'],
    role_world_ids: [],
    gray_world: [],
    is_open_subscribe: 0,
    is_open_headfunc: 0,
    CurTime: seconds,
  };
}

export function routeFixture(
  method,
  target,
  {
    version,
    now = Date.now(),
    sdkPaths = [],
    gameAuth = false,
    directory = false,
    tcpPort = 53174,
    nativeAccount = false,
    roleFixture = false,
    world,
    loginKey,
  } = {},
) {
  let url;
  try {
    url = new URL(target, 'http://127.0.0.1');
  } catch {
    return response(400, 'invalid-target', { ret: -9900, info: 'Invalid target' });
  }
  if (!['http:', 'https:'].includes(url.protocol))
    return response(400, 'invalid-target', { ret: -9900, info: 'Invalid protocol' });
  const path = url.pathname;
  if (method === 'GET' && path === '/notice/get_policy.php')
    return response(200, 'personal-notice', { ret: 0, info: '', policy: [], data: [] });
  if (method === 'GET' && path === '/notice/get_notice.php')
    return response(200, 'personal-notice', { ret: 0, info: '', notice: [], data: [] });
  if (method === 'GET' && path === '/login/fcm_config.php')
    return response(200, 'sdk-config', {
      ret: 0,
      nppa_real_name: 0,
      guest_total_time: 0,
      is_holiday: 0,
      not_adult_normal_online_time: 0,
      not_adult_holiday_online_time: 0,
      not_adult_service_interval: [],
    });
  if (method === 'GET' && path === '/login/login_config.php')
    return response(200, 'sdk-config', {
      ret: 0,
      block_login_type: [],
      enable_qiyu: 0,
      kefu_url: '',
      wx_kefu_url: '',
      qiyu_group_id: '',
      qiyu_vip_group_id: '',
      captcha_url: '',
    });
  if (
    method === 'GET' &&
    ['/reg', '/106.php', '/help/notice/privacy.html', '/help/notice/service.html'].includes(path)
  )
    return {
      status: 200,
      layer: 'personal-notice',
      contentType: 'text/html; charset=utf-8',
      body: Buffer.from(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>个人自建服说明</title><main style="font:18px/1.8 sans-serif;padding:24px"><h1>个人自建服</h1><p>这是个人测试版本。点击游客登录即可使用自建角色，不需要填写手机号、身份证或支付信息。游戏进度保存在自建服务器；当前不提供充值、短信注册或第三方账号绑定。</p></main>',
      ),
    };
  if (path === '/__fixture/status')
    return response(200, 'status', {
      localFixture: true,
      apk: REFERENCE_APK_SHA256,
      implemented: [
        'version-cache',
        'sdk-identity',
        ...(gameAuth ? ['game-auth'] : []),
        ...(directory ? ['directory'] : []),
        ...(nativeAccount ? ['native-account'] : []),
        ...(roleFixture
          ? ['role-create', 'role-login-minimal', 'bootstrap-queries', 'reference-battle-1001']
          : []),
      ],
      pending: [
        ...(!gameAuth ? ['game-auth'] : []),
        ...(!directory ? ['directory'] : []),
        ...(roleFixture
          ? [
              'equipment-state',
              'gems-and-events',
              'battle-settlement',
              'all-levels',
              'resource-dependencies',
            ]
          : ['role-session']),
      ],
    });
  if (path === '/ver/new_ver.php' && method === 'GET')
    return version
      ? {
          status: 200,
          layer: 'version-cache',
          body: version,
          contentType: 'application/json; charset=utf-8',
        }
      : response(503, 'version-pending', { ret: -9901, info: 'Version fixture not supplied' });
  if (
    ['GET', 'POST'].includes(method) &&
    (path === '/login/login_guest.php' || sdkPaths.includes(path))
  )
    return response(
      200,
      'sdk-identity',
      sdkIdentity(now, path === '/login/login_guest.php' ? 1 : 2),
    );
  if (path === '/auth/auth_sdk/auth.php' || path === '/auth/auth_quick/auth.php')
    return gameAuth
      ? response(200, 'game-auth', gameIdentity(now, loginKey))
      : response(503, 'game-auth-pending', { ret: -9902, info: 'Local game-auth schema pending' });
  if (path === '/dir/new_dir.php')
    return directory
      ? response(200, 'directory', worldDirectory(now, tcpPort, world))
      : response(503, 'directory-pending', { ret: -9903, info: 'Local directory schema pending' });
  // Unknown routes never get a generic success and never leave this process.
  return response(502, 'unimplemented', {
    ret: -9990,
    info: 'Local fixture route not implemented',
    path,
  });
}
function response(status, layer, data) {
  return {
    status,
    layer,
    body: Buffer.from(JSON.stringify(data)),
    contentType: 'application/json; charset=utf-8',
  };
}

export function requestEvidence(method, target, body = '', contentType = '') {
  let url;
  try {
    url = new URL(target, 'http://127.0.0.1');
  } catch {
    return { method, path: '<invalid>' };
  }
  let bodyKeys = [];
  try {
    if (contentType.includes('json')) {
      const data = JSON.parse(body);
      bodyKeys = data && typeof data === 'object' ? Object.keys(data) : [];
    } else if (contentType.includes('x-www-form-urlencoded'))
      bodyKeys = [...new Set(new URLSearchParams(body).keys())];
  } catch {}
  // Values may contain tokens or device identifiers. Only names are retained.
  const names = (keys) =>
    [...new Set(keys)]
      .filter((k) => /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(k))
      .slice(0, 64)
      .sort();
  return {
    method,
    host: url.host,
    path: url.pathname,
    queryKeys: names(url.searchParams.keys()),
    bodyKeys: names(bodyKeys),
  };
}
