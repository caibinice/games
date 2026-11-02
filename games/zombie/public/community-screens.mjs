import { eventRule, eventProgress } from './activity-state.mjs';
import { esc, header } from './screens.mjs';
import { CAMPAIGN_LEVEL_COUNT } from './campaign-limits.mjs';
const box = (title, body) => `<div class="community-panel"><h2>${title}</h2>${body}</div>`;
const btn = (label, attrs = '', secondary = false) =>
  `<button class="${secondary ? 'secondary-button' : 'gold-button'}" ${attrs}>${label}</button>`;
export function guildScreen(meta, state) {
  const g = state.guild,
    me = state.guildPlayer,
    busy = state.guildBusy ? 'disabled' : '';
  let html = '';
  if (state.guildLoading) html = box('正在连接军团…', '<p>共享成员、聊天和首领进度。</p>');
  else if (state.guildError)
    html = box(
      '军团连接中断',
      `<p>${esc(state.guildError)}</p>${btn('重新连接', 'data-guild-action="refresh"')}`,
    );
  else if (!g)
    html =
      box(
        '创建自己的军团',
        `<p>免费创建 · 无限次签到 · 可添加机器人</p><label>军团名称<input id="guild-name" maxlength="24" value="${esc(meta.name)}的军团"></label>${btn('免费创建军团', `data-guild-action="create" ${busy}`)}`,
      ) +
      box(
        '加入朋友的军团',
        `<label>六位军团码<input id="guild-code" maxlength="6" value="${esc(state.guildInvite || '')}" autocomplete="off" placeholder="例如 ABC234"></label>${btn('加入军团', `data-guild-action="join" ${busy}`)}${btn('刷新军团列表', 'data-guild-action="refresh"', true)}<div class="guild-directory">${(state.guildDirectory || []).map((g) => `<div><b>${esc(g.name)}</b><span>${g.members}/128人 · ${esc(g.code)}</span>${btn('加入', `data-guild-action="join" data-code="${esc(g.code)}" ${busy}`)}</div>`).join('') || '<p>暂时没有军团，创建一个邀请朋友吧。</p>'}</div>`,
      );
  else {
    const owner = g.owner === me,
      members = g.members || [],
      own = members.find((m) => m.id === me);
    html =
      box(
        `${esc(g.name)} <small>Lv.${g.level}</small>`,
        `<p>军团码 <b class="guild-code">${esc(g.code)}</b> · ${members.length}/128人</p><p>我的签到 ${own?.signIns || 0} 次 · 贡献 ${own?.contribution || 0}</p><div class="community-actions">${btn('无限签到 +100钻石', `data-guild-action="signin" ${busy}`)}${btn('连续签到10次', `data-guild-action="signin10" ${busy}`)}${btn('邀请朋友', 'data-guild-action="invite"', true)}${btn('刷新', 'data-guild-action="refresh"', true)}</div><p>不设每日次数；每次签到金币+10000、钻石+100、贡献+100。</p>`,
      ) +
      box(
        `军团首领 · 第${g.bossRound}轮`,
        `<div class="guild-boss-hp"><i style="width:${Math.max(0, Math.min(100, (g.bossHp / g.bossMaxHp) * 100))}%"></i></div><p>${g.bossHp} / ${g.bossMaxHp}</p>${btn('参与首领战', `data-guild-action="raid" ${busy}`)}<p>所有成员共用首领血量。机器人每30秒自动签到、攻击；页面每10秒同步。</p>`,
      ) +
      box(
        '军团成员',
        `<div class="community-actions">${owner ? btn('添加1名机器人', `data-guild-action="bots" data-count="1" ${busy}`) + btn('添加10名机器人', `data-guild-action="bots" data-count="10" ${busy}`) : '<p>团长可免费添加机器人。</p>'}</div><div class="guild-members">${members.map((m) => `<div><b>${m.bot ? '🤖 ' : m.leader ? '★ ' : ''}${esc(m.name)}</b><span>贡献 ${m.contribution} · 签到 ${m.signIns} · 伤害 ${m.damage}</span></div>`).join('')}</div>`,
      ) +
      box(
        '军团聊天',
        `<div class="guild-chat">${(g.chat || [])
          .slice(-30)
          .map((m) => `<p><b>${esc(m.name)}：</b>${esc(m.text)}</p>`)
          .join(
            '',
          )}</div><input id="guild-message" maxlength="180" placeholder="发送给军团所有成员"><div class="community-actions">${btn('发送', `data-guild-action="chat" ${busy}`)}${btn('退出军团', 'data-guild-action="leave"', true)}</div>`,
      );
  }
  return `<section class="screen community-screen" aria-label="军团页面">${header(meta)}<h1 class="community-title">军团 · 多人集结</h1><div class="screen-scroll community-scroll">${html}<p class="community-foot">军团身份只用于这款游戏，与智能座舱业务账号独立。</p></div></section>`;
}
export const ACTIVITY_NAMES = {
  0: '尘世巨蟒',
  3: '深渊挑战',
  4: '终末危机',
  5: '末世战场',
  6: '寰球救援',
  7: '异域挑战',
  8: '雾境迷宫',
  9: '核心试炼',
  10: '荣耀战场',
  11: '危局对弈',
  12: '异星入侵',
  13: '军团联赛',
  14: '生化挑战',
  15: '常驻地图',
  16: '边陲阵地',
  17: '遗落旧闻',
  18: '黑暗挑战',
  19: '怪物嘉年华',
  20: '银河空援',
  21: '无尽寒冬',
  22: '金币狂欢',
  23: '雷霆镇祟',
  24: '雷霆镇祟·特别篇',
};
export function activityScreen(meta, state) {
  const list = (state.activities || []).filter(
      (a) => state.activityType === undefined || a.LevelType === state.activityType,
    ),
    page = Math.max(
      0,
      Math.min(Math.max(0, Math.ceil(list.length / 12) - 1), state.activityPage || 0),
    ),
    rows = list.slice(page * 12, page * 12 + 12);
  const types = [...new Set((state.activities || []).map((a) => a.LevelType))];
  return `<section class="screen community-screen" aria-label="常驻活动页面">${header(meta)}<h1 class="community-title">${state.tab === 'base' ? '基地 · 常驻活动' : '征途 · 全部挑战'}</h1><div class="screen-scroll community-scroll">${box('活动常开 · 挑战与积分', `<p>所有活动常开，不按星期轮换，不限挑战次数。挑战沿用APK出怪配置，深渊30级上限、全词条与终末危机禁疗已按客户端规则接入；迷宫三层随机事件、组队和其他专属机关继续逐项迁移，不以普通波次试跑冒充完整活动。主线普通${CAMPAIGN_LEVEL_COUNT}关、精英${CAMPAIGN_LEVEL_COUNT}关；副本按客户端配置独立列出。</p>${btn('客户端活动规则', 'data-native-event-help="' + (state.activityType || 3) + '"')}${btn('免费活动补给', 'data-grant="all"')}${btn('畅玩控制台', 'data-action="cheats"', true)}`)}<div class="activity-filters">${types.map((t) => btn(ACTIVITY_NAMES[t] || '特别活动' + t, `data-activity-type="${t}"`, state.activityType !== t)).join('')}</div>${state.activityError ? box('活动加载中断', `<p>${esc(state.activityError)}</p>${btn('重试', 'data-action="activities"')}`) : !state.activities ? box('正在载入活动目录…', '') : box(`${esc(ACTIVITY_NAMES[state.activityType] || '全部活动')} · ${list.length}个配置`, rows.map((a) => `<div class="activity-row"><div><b>${esc(a.name)}</b><span>常开 · ${a.waves || '—'}波${a.scheduleMode === 'web-adapted' ? ' · 网页时序适配' : ' · 已导入原生时序'}</span><p class="event-progress">${eventRule(a).description} · 已通关 ${eventProgress(meta, a.LevelID).wins}次 / ${eventProgress(meta, a.LevelID).points}积分</p></div>${btn('积分奖励', `data-event-claim="${a.LevelID}"`, true)}${a.available ? btn('开始挑战', `data-activity="${a.LevelID}"`) : btn('领取活动补给', 'data-grant="all"', true)}</div>`).join('') + `<div class="community-actions">${btn('上一页', 'data-activity-page="-1"', true)}<span>${page + 1}/${Math.max(1, Math.ceil(list.length / 12))}</span>${btn('下一页', 'data-activity-page="1"', true)}</div>`)}<p class="community-foot">特殊副本的随机库、对战与机关规则使用网页适配；20份客户端未内置波次的危局对弈配置保留补给入口。</p></div></section>`;
}

export function baseScreen(meta) {
  return `<section class="screen base-hub" aria-label="基地页面">${header(meta)}<button class="base-node research" data-action="skill-tree">研究所</button><button class="base-node wall" data-action="forge">防线</button><button class="base-node training" data-action="activities">历练大厅</button><button class="base-node food" data-grant="energy">食堂</button><button class="base-node rank" data-action="activities">活动总览</button><button class="base-node tavern" data-action="mercenary">酒馆</button></section>`;
}
