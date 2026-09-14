const fs = require('fs'), path = require('path');
const BASE = 'C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules/@iconify-json';
const load = p => JSON.parse(fs.readFileSync(path.join(BASE, p, 'icons.json'), 'utf8'));
const MC = load('mingcute'), IP = load('icon-park'), GI = load('game-icons');
const lists = { mingcute: MC, 'icon-park': IP, 'game-icons': GI };

console.log('=== 库规模 ===');
Object.keys(lists).forEach(k => {
  const n = Object.keys(lists[k].icons).filter(x => !lists[k].icons[x].hidden).length;
  console.log('  ' + k.padEnd(12) + n + ' 个   画布 ' + lists[k].width + 'x' + lists[k].height);
});

console.log('\n=== 命名样例 ===');
['mingcute', 'icon-park'].forEach(k => {
  const ks = Object.keys(lists[k].icons).filter(x => !lists[k].icons[x].hidden);
  console.log('  ' + k + ': ' + ks.slice(0, 14).join(', '));
});

/* 三国时代背景需要的元素 → 候选英文名 */
const PROBE = {
  '宫殿/官府': ['palace', 'temple', 'pagoda', 'court', 'government', 'chinese'],
  '民居': ['house', 'home', 'building', 'cottage'],
  '城墙/城门': ['wall', 'gate', 'castle', 'fort', 'tower'],
  '军营/帐篷': ['tent', 'camp', 'barracks', 'military'],
  '烽火台': ['beacon', 'watchtower', 'fire', 'signal', 'bonfire'],
  '市场': ['market', 'shop', 'store', 'trade', 'scale'],
  '仓库': ['warehouse', 'box', 'crate', 'storage', 'inventory'],
  '书院': ['book', 'scroll', 'school', 'education', 'brush'],
  '铁匠铺': ['anvil', 'hammer', 'forge', 'blacksmith'],
  '作坊': ['gear', 'setting', 'tool', 'craft'],
  '客栈': ['hotel', 'inn', 'bed', 'tavern', 'lantern'],
  '马厩': ['horse', 'stable', 'saddle'],
  '农田': ['wheat', 'rice', 'farm', 'field', 'plant'],
  '林地': ['tree', 'forest', 'wood', 'pine'],
  '矿山': ['mountain', 'mine', 'ore', 'pick'],
  '湖泊': ['water', 'lake', 'wave', 'drop'],
  '沙漠': ['desert', 'sand', 'cactus'],
  '沼泽': ['swamp', 'marsh', 'reed'],
  '平原': ['grass', 'field', 'plain', 'meadow'],
  '粮': ['wheat', 'rice', 'grain', 'food', 'bowl'],
  '木': ['wood', 'timber', 'log', 'lumber'],
  '石': ['stone', 'rock', 'brick'],
  '铁': ['iron', 'metal', 'steel', 'ore', 'anvil'],
  '金/钱': ['coin', 'gold', 'money', 'yuan', 'currency'],
  '人口': ['people', 'person', 'user', 'family', 'farmer', 'crowd'],
  '剑': ['sword', 'blade', 'knife', 'dagger'],
  '长枪/矛': ['spear', 'lance', 'halberd', 'pike'],
  '弓弩': ['bow', 'arrow', 'crossbow', 'archery'],
  '盾': ['shield', 'defense', 'guard'],
  '铠甲': ['armor', 'armour', 'vest', 'chest'],
  '头盔': ['helmet', 'hat', 'cap', 'crown'],
  '靴': ['boot', 'shoe', 'foot'],
  '腰带': ['belt', 'waist', 'band'],
  '戒指': ['ring', 'jewel', 'diamond'],
  '项链/玉佩': ['necklace', 'pendant', 'jade', 'pearl', 'charm'],
  '坐骑': ['horse', 'ride', 'mount'],
  '士兵': ['soldier', 'warrior', 'army', 'general', 'guard', 'knight'],
  '战鼓': ['drum', 'music', 'bell'],
  '旗帜': ['flag', 'banner', 'pennant'],
  '地图': ['map', 'compass', 'location', 'navigate'],
  '沙漏/计时': ['hourglass', 'time', 'clock', 'timer'],
  '药水/丹药': ['potion', 'medicine', 'bottle', 'flask', 'pill'],
  '玉石': ['jade', 'gem', 'crystal', 'pearl'],
  '布帛/丝绸': ['silk', 'cloth', 'fabric', 'roll', 'thread'],
  '绳索': ['rope', 'knot', 'string', 'cable'],
  '皮革': ['leather', 'hide', 'skin'],
  '宝箱': ['chest', 'treasure', 'box'],
  '灯笼': ['lantern', 'lamp', 'light'],
  '云纹/祥云': ['cloud', 'mist', 'fog'],
  '龙': ['dragon', 'loong'],
  '卷轴': ['scroll', 'paper', 'document', 'letter'],
  '印章': ['seal', 'stamp', 'chop'],
};
Object.keys(PROBE).forEach(label => {
  const row = [];
  ['mingcute', 'icon-park', 'game-icons'].forEach(k => {
    const src = lists[k].icons;
    const hit = PROBE[label].filter(n => Object.keys(src).some(x => x === n || x.indexOf(n + '-') === 0 || x.indexOf('-' + n) >= 0 || x.indexOf(n) >= 0)).slice(0, 4);
    row.push(k.replace('mingcute', 'MC').replace('icon-park', 'IP').replace('game-icons', 'GI') + (hit.length ? ':' + hit.join('|') : ':无'));
  });
  console.log(('【' + label + '】').padEnd(11) + row.join('   '));
});
