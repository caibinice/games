// Short independently written cross-check notes, not copies of the articles.
export const GUIDE_SOURCES=[
 {title:'搜狐 · 宝石属性优先级',date:'2025-04-22',url:'https://www.sohu.com/a/887241876_121906874',note:'用来梳理暴击、冷却、控制与百分比伤害的搭配方向；榜单是作者建议，不作为战斗倍率。'},
 {title:'7724 · 各部位宝石词条',date:'2025-10-23',url:'https://www.7724.com/xjskp/news/201689.html',note:'交叉检查秒杀、传送、防线免疫、冻伤、燃烧区域及负面状态联动；实际数值按已标明的APK品质表执行。'},
 {title:'游侠 · 宝石属性汇总',date:'2024-12-11',url:'https://m.ali213.net/news/gl2412/1571777.html',note:'用于核对头盔、衣服的专属效果。有些网页百分号与APK文本不同，例如防线减伤在本包为固定数值，单独展示。'},
 {title:'日升 · 核心选择参考',date:'2025-12-22',url:'https://m.51nacs.com/article/2866.html',note:'核对宠物管家、电玩狂欢、奥特曼赛文、本格推理等幻形名称与技能归属；本包尚无的数据不生成虚构升级数值。'},
 {title:'TapTap · 技能解析',date:'2024-08-06',url:'https://www.taptap.cn/moment/555387492593828129',note:'作为温压燃烧区、冰系控制与枪械分裂/穿透等组合的交叉检查。技能等级门槛以本APK的构筑条件为准。'},
 {title:'TapTap · 幻形核心解析',date:'2024-07-04',url:'https://www.taptap.cn/moment/557878878794678995',note:'重点核对出战幻形的初始技能、元素加成，以及已激活幻形收藏属性的叠加；不把历史强度排行当作固定规则。'}
];
export const GEM_TAGS=[['','全部'],['暴击','暴击'],['冷却','冷却'],['最大生命值','百分比'],['秒杀','秒杀'],['防线免疫','防线免疫'],['冻伤','冻伤'],['燃烧区域','燃烧区域'],['枪械','枪械'],['负面状态','异常联动'],['雇佣兵','佣兵'],['无限火力','无限火力'],['防线每损失','掉血支援'],['折射','折射'],['溅射','溅射'],['电极','电极联动']];
export const guideHTML=()=>`<p>攻略用于机制对照，战斗数值优先对应指定APK。页面会区分已接入和配置参考，不把未执行的词条放进掉落池。</p><div class="guide-links">${GUIDE_SOURCES.map(r=>`<article><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title} ↗</a><small>${r.date}</small><p>${r.note}</p></article>`).join('')}</div>`;
