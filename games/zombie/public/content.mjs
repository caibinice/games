import { CLIENT_SKILLS, CLIENT_ICONS } from './client-data.mjs';
export const SKILLS = [
  {
    id: 'grenade',
    name: '温压弹',
    art: 0,
    color: '#ffb546',
    desc: '发射温压弹，造成范围爆炸并灼烧敌人。',
  },
  {
    id: 'frost',
    name: '干冰弹',
    art: 1,
    color: '#6dd9ff',
    desc: '干冰爆炸造成范围伤害，持续减速尸潮。',
  },
  {
    id: 'laser',
    name: '高能射线',
    art: 2,
    color: '#62caff',
    desc: '持续射线贯穿目标路径，打击整列敌人。',
  },
  {
    id: 'vehicle',
    name: '装甲车',
    art: 3,
    color: '#d6ca53',
    desc: '装甲车冲过战场，推退沿途敌人。',
  },
  {
    id: 'guided',
    name: '制导激光',
    art: 4,
    color: '#71e2ff',
    desc: '锁定目标，制导光束造成高额单体伤害。',
  },
  {
    id: 'electron',
    name: '跃迁电子',
    art: 5,
    color: '#ffc258',
    desc: '电子在密集敌人之间连续跃迁攻击。',
  },
  {
    id: 'iceblast',
    name: '冰爆发生器',
    art: 6,
    color: '#7bdfff',
    desc: '释放大型冰爆，冻结范围内的感染者。',
  },
  {
    id: 'lightning',
    name: '电磁穿刺',
    art: 7,
    color: '#a4baff',
    desc: '连锁电磁打击，穿刺并麻痹多个目标。',
  },
  {
    id: 'vortex',
    name: '旋风加农',
    art: 8,
    color: '#76ebcf',
    desc: '旋风卷起敌人，持续造成伤害并聚拢尸潮。',
  },
  {
    id: 'airdrop',
    name: '空投轰炸',
    art: 9,
    color: '#ffb375',
    desc: '轰炸机沿目标区域投放多枚炸弹。',
  },
  {
    id: 'wind',
    name: '压缩气刃',
    art: 10,
    color: '#7ff1da',
    desc: '高速气刃横扫前方，切割宽幅区域。',
  },
  {
    id: 'fuel',
    name: '燃油弹',
    art: 11,
    color: '#ffa34f',
    desc: '燃油爆炸留下灼烧区，压制密集尸潮。',
  },
  {
    id: 'drone',
    name: '无人机',
    art: 12,
    color: '#d7e6a0',
    desc: '两翼无人机自动射击，提供持续火力支援。',
  },
  {
    id: 'electric',
    name: '电击柱',
    art: 13,
    color: '#ae9aff',
    desc: '部署电击柱，周期性电击范围内的目标。',
  },
].map((skill) => {
  const original = CLIENT_SKILLS.find((s) => s.id === skill.id);
  return original
    ? {
        ...skill,
        name: original.name,
        desc: original.description,
        clientId: original.ID,
        unlockLevel: original.UnlockCondParam,
      }
    : skill;
});
export const GEAR_SLOTS = [
  { id: 'helmet', name: '头盔', art: 0 },
  { id: 'bracer', name: '护臂', art: 1 },
  { id: 'armor', name: '衣服', art: 2 },
  { id: 'pants', name: '裤子', art: 3 },
  { id: 'boots', name: '足具', art: 4 },
  { id: 'gloves', name: '手套', art: 5 },
];
export const RARITIES = [
  { name: '普通', color: '#c9c8bc' },
  { name: '精良', color: '#81c746' },
  { name: '卓越', color: '#4bbbf5' },
  { name: '完美', color: '#b48bf2' },
  { name: '传说', color: '#ffb83f' },
  { name: '绝世', color: '#fc5551' },
  { name: '至尊', color: '#e6a7ff' },
];
export const AFFIXES = [
  { id: 'attack', name: '攻击增幅', unit: '%', value: 1.6 },
  { id: 'hp', name: '防线耐久', unit: '%', value: 2 },
  { id: 'critical', name: '暴击伤害', unit: '%', value: 3 },
  { id: 'rapid', name: '枪械射速', unit: '%', value: 1.2 },
  { id: 'cooldown', name: '技能冷却缩减', unit: '%', value: 0.9 },
  { id: 'element', name: '元素技能伤害', unit: '%', value: 2 },
];
export const UI_ASSET = './assets/original-ui/';
export const skillById = (id) => SKILLS.find((s) => s.id === id);
export const shortNumber = (n) =>
  n >= 100000000
    ? (n / 100000000).toFixed(2) + '亿'
    : n >= 10000
      ? (n / 10000).toFixed(2) + '万'
      : Math.floor(n).toString();
export const skillImage = (id) =>
  CLIENT_ICONS[id] || UI_ASSET + 'skill-' + (skillById(id)?.art ?? 0) + '.png';
export const gemImage = (rarity) => UI_ASSET + 'gem-' + (rarity >= 6 ? 'rainbow' : 'red') + '.png';
