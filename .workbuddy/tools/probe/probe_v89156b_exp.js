/* ============================================================
 * probe_v89156b_exp.js  v89.156 需求 2/3/4 验证探针（Node 桩）
 *   ① 侦察成功率打表（scoutChanceOf 各场景）
 *   ② 侦察失败行为（无情报 / 失败公文 / msg）· 成功对照
 *   ③ 出征界面结构（标题 / 限制行 / 单列 / 道具下拉 / 预估位置与条件）
 * 运行：node .workbuddy/tools/probe/probe_v89156b_exp.js
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function ck(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
if (!G.state.map.grid) G.map.generate();
var st = G.state, c = st.cities[0];
G.ui._cityId = c.id;

/* ---------- ① 侦察成功率打表 ---------- */
console.log('\n===== ① 侦察成功率（scoutChanceOf） =====');
function mkGen(name, lv, rank, opts) {
  var g = { id: 'g_' + name, name: name, level: lv, rank: rank, tong: 60, yw: 60, zm: 60, nz: 60, style: 'balance' };
  for (var k in (opts || {})) g[k] = opts[k];
  return g;
}
var my3 = mkGen('我方英杰', 20, 'ying');           /* star3 */
var table = [
  ['同资质同等级（英杰 Lv20 vs 英杰 Lv20）', my3, mkGen('F', 20, 'ying'), 0.85],
  ['+2星 -10级（英杰 vs 良材 Lv10）', my3, mkGen('F', 10, 'liang'), 0.97],
  ['+2星 +0级（英杰 vs 凡品 Lv20）', my3, mkGen('F', 20, 'fan'), 0.95],
  ['-1星 +10级（英杰 vs 名世 Lv30）', my3, mkGen('F', 30, 'ming'), 0.65],
  ['-2星 +20级（英杰 vs 天授 Lv40）', my3, mkGen('F', 40, 'tian'), 0.45],
  ['-2星 +40级（英杰 vs 天授 Lv60 → 下限）', my3, mkGen('F', 60, 'tian'), 0.40],
];
table.forEach(function (row) {
  var t = { kind: 'wild', guard: row[2] };
  var r = G.battle.scoutChanceOf(row[1], t);
  var ok = Math.abs(r.p - row[3]) < 0.011;
  ck(row[0] + ' → ' + (Math.round(r.p * 1000) / 10) + '%', ok, 'want ' + row[3] + ' got ' + Math.round(r.p * 100) + '%');
});
var noFoe = G.battle.scoutChanceOf(my3, { kind: 'wild', guard: null });
ck('无守将 → 必成（p=1）', noFoe.p === 1 && noFoe.foe === null, 'p=' + noFoe.p);
console.log('    （新局主将「' + (st.generals[0].name) + '」资质 ' + G.rankOf(st.generals[0]).name + ' star' + G.rankOf(st.generals[0]).star + '）');

/* ---------- ② 侦察失败 / 成功 ---------- */
console.log('\n===== ② 侦察失败行为 =====');
/* 找一块有效野地（近处、有等级） */
var tx = -1, ty = -1;
for (var rr = 1; rr <= 12 && tx < 0; rr++) {
  for (var dy = -rr; dy <= rr && tx < 0; dy++) for (var dx = -rr; dx <= rr && tx < 0; dx++) {
    var xx = c.x + dx, yy = c.y + dy;
    var lv0 = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 0;
    if (lv0 > 0 && !G.map.wildAt(xx, yy) && !G.map.npcAt(xx, yy) && !G.map.fortAt(xx, yy)) { tx = xx; ty = yy; }
  }
}
console.log('    靶野地 = (' + tx + ',' + ty + ') Lv' + G.map.wildLevelNow(tx, ty));
/* 为侦察指定一个带守将的目标（直接改 tile 的 guard —— scoutTarget 读 t.guard，
   而 expedition 的 t 来自 resolveTarget…… 用 resolveTarget 拿真 t 再注入 guard 太绕；
   直接**直调 scoutTarget** 验证判定+失败数据，再**直调 expedition** 验证公文/msg 段
   （target 用真野地；守将注入走 resolveTarget 之后的 t —— expedition 内部解析，
    改为注入到 map 层：野地守将由 wildDefenseAt 确定性生成，不可注入。
    → 采用「直调 scoutTarget + 手造 t」验判定；「直调 expedition（不注入）」验无守将路径与
      成功路径公文；失败公文用**手造 t + 复用 expedition 的公文构造**不现实 ——
      改用 e2e/手动 patch 前置（把 Math.random 固定）时野地守将的真实存在性） */
/* 手造带守将的 t（scoutTarget 只读 t 的这些字段） */
var fakeT = {
  kind: 'wild', x: tx, y: ty, terrain: G.map.tile(tx, ty).terrain, level: G.map.wildLevelNow(tx, ty),
  guard: mkGen('敌守将', 40, 'tian'), garrison: { changqiang: 5000 }, def: 0,
};
var _rnd = Math.random;
Math.random = function () { return 0.999; };        /* 必失败（任何 p<0.999） */
var scFail = G.battle.scoutTarget(fakeT, st.generals[0]);
Math.random = _rnd;
ck('失败：sc.fail = true', scFail.fail === true);
ck('失败：无情报（roster 空 / guard null / 无数值）', (scFail.roster || []).length === 0 && !scFail.guard, 'roster=' + JSON.stringify(scFail.roster));
ck('失败：chance 带守将与双方等级（公文用）', scFail.chance && scFail.chance.foe && scFail.chance.foe.name === '敌守将', JSON.stringify(scFail.chance && {p: scFail.chance.p, foe: scFail.chance.foe.name}));
Math.random = function () { return 0.001; };        /* 必成功 */
var scOk = G.battle.scoutTarget(fakeT, st.generals[0]);
Math.random = _rnd;
ck('对照：成功时 fail 非 true（走到分层路径）', !scOk.fail && typeof scOk.intel === 'object');

/* 直调 expedition 走真野地（无守将 → 必成）—— 验成功路径 + 公文 */
var _exp0 = G.battle.expedition;
var genR = st.generals[0];
genR.status = 'idle'; genR.stamina = 100; genR.energy = 50;
G.setStaNow && G.setStaNow(genR, 100);
var r1 = _exp0.call(G.battle, { kind: 'wild', x: tx, y: ty }, 'scout', {}, genR.id, {});
console.log('    真野地侦察（无守将）→ ok=' + r1.ok + ' msg=' + String(r1.msg).slice(0, 70));
ck('真野地（无守将）侦察必成', r1.ok === true && !r1.fail);
var rep0 = (st.reports || [])[0];
ck('成功公文在册（title 侦查回报）', rep0 && /侦查回报/.test(rep0.title) && !!rep0.scout, rep0 && rep0.title);

/* 失败公文：把 scoutTarget 换成返回 fail 的包（模拟守将压过我方）——
   验 expedition 的 fail 分支（lines / 公文 / msg / 归队）。 */
var _sc0 = G.battle.scoutTarget;
G.battle.scoutTarget = function (t, gen) {
  var o = _sc0.call(G.battle, t, gen);
  o.fail = true;
  o.chance = { p: 0.4, foe: { name: '模拟守将', level: 40, rank: 'tian' }, myLv: (gen.level || 1), foeLv: 40, myStar: 3, foeStar: 5 };
  return o;
};
genR.stamina = 100; genR.energy = 50;
var r2 = _exp0.call(G.battle, { kind: 'wild', x: tx, y: ty }, 'scout', {}, genR.id, {});
G.battle.scoutTarget = _sc0;
console.log('    模拟失败 → ok=' + r2.ok + ' msg=' + String(r2.msg).slice(0, 90));
ck('失败：msg 为「侦查失败…」', r2.ok === true && r2.fail === true && /侦查失败/.test(r2.msg), String(r2.msg).slice(0, 60));
var rep1 = (st.reports || [])[0];
ck('失败公文在册（title 侦查失败 · X）', rep1 && /^侦查失败 · /.test(rep1.title), rep1 && rep1.title);
ck('失败公文**不带** scout 字段（面板不可展开）', rep1 && rep1.scout == null && rep1.win === false);
ck('失败公文正文含缘由与建言', rep1 && /缘由/.test(rep1.body) && /建言/.test(rep1.body));
ck('失败公文不等于回报（对照：成功那份含 scout 字段）', rep0 && rep0.scout != null);

/* ---------- ③ 出征界面结构 ---------- */
console.log('\n===== ③ 出征界面结构 =====');
function capHTML(target) {
  var html = '';
  var _om = G.ui.openModal;
  G.ui.openModal = function (h) { html = h; };
  try { G.ui.openExpModal(target); } catch (e) { html = 'ERR:' + e.message; }
  G.ui.openModal = _om;
  return html;
}
var hW = capHTML({ kind: 'wild', x: tx, y: ty });
console.log('    无主野地面板 HTML 长度 = ' + hW.length);
ck('① 额度标签在（新局无校场 → 不设上限）',
  hW.indexOf('id="exp-cap-t"') >= 0 && hW.indexOf('不设上限') >= 0,
  '含不设上限=' + (hW.indexOf('不设上限') >= 0));
/* 造局：给本城塞一座 Lv5 校场 → 标签应显示「校场出征上限」 */
var keepCells = JSON.parse(JSON.stringify(c.cells || []));
c.cells = (c.cells || []).slice();
c.cells.push({ build: { id: 'xiaochang', lvl: 5 }, pending: null });
var hW2 = capHTML({ kind: 'wild', x: tx, y: ty });
c.cells = keepCells;
ck('① 有校场 → 标题含「校场出征上限」', hW2.indexOf('校场出征上限') >= 0,
  (hW2.match(/派遣兵力（<span id="exp-cap-t">([^<]*)/) || [])[1]);
ck('① 主将标题去掉「· 可用道具」', hW.indexOf('>主将</div>') >= 0 && hW.indexOf('主将 · 可用道具') < 0);
ck('② 目标区有限制容器 exp-limits（无限制时为空）', hW.indexOf('id="exp-limits"') >= 0);
ck('② 无限制时不含旧引导「请用<b>侦查</b>获取」', hW.indexOf('请用<b>侦查</b>获取') < 0);
ck('③ 四块行序：计略 → 方式 → 方案 → 战术', (function () {
  var a = hW.indexOf('exp-a-tactic'), b = hW.indexOf('exp-a-modes'), d = hW.indexOf('exp-a-plan'), e = hW.indexOf('exp-a-tacmenu');
  return a > 0 && a < b && b < d && d < e;
})());
var iL = hW.indexOf('exp-col-l'), iR = hW.indexOf('exp-col-r');
var iItems = hW.indexOf('可用道具');
ck('③ 可用道具在**左列**（col-l 与 col-r 之间）', iItems > iL && iItems < iR, 'iL=' + iL + ' items=' + iItems + ' iR=' + iR);
ck('③ 可用道具 = 下拉框（exp-item-sel + 使用键）', hW.indexOf('id="exp-item-sel"') >= 0 && hW.indexOf('exp-use-item-pick') >= 0);
ck('③ 可用道具不再全列 chips（旧 exp-use-item 按钮无）', hW.indexOf('data-action="exp-use-item"') < 0);
var iEst = hW.indexOf('exp-a-est');
var iTroops = hW.indexOf('exp-a-troops');
ck('④ 预估在**右列**且位于派遣兵力之后', iEst > iR && iEst > iTroops, 'iEst=' + iEst + ' iR=' + iR + ' iTroops=' + iTroops);
ck('④ 预估含 4 行（行军/总览/战力/搬运）且无旧 wildcap', hW.indexOf('id="exp-march"') >= 0 && hW.indexOf('id="exp-haul"') >= 0 && hW.indexOf('id="exp-wildcap"') < 0);

/* 己方野地（station）：无预估 / 无限制 / 派驻上限 */
st.wilds = st.wilds || [];
st.wilds.push({ x: tx, y: ty, type: G.map.tile(tx, ty).terrain, level: G.map.wildLevelNow(tx, ty), day: 0, startDay: 0 });
var hS = capHTML({ kind: 'wild', x: tx, y: ty });
console.log('    己方野地面板 HTML 长度 = ' + hS.length);
ck('④ 己方野地：**无预估**（exp-a-est 不渲染）', hS.indexOf('exp-a-est') < 0);
ck('② 己方野地：标题为「派驻上限」', hS.indexOf('派驻上限') >= 0);
st.wilds = st.wilds.filter(function (z) { return !(z.x === tx && z.y === ty); });

/* 己方城池（transfer）：无预估 / 有辎重 */
if (st.cities.length >= 2) {
  var hT = capHTML({ kind: 'own', id: st.cities[1].id });
  ck('④ 己方城池：无预估 + 有辎重区', hT.indexOf('exp-a-est') < 0 && hT.indexOf('exp-a-cargo') >= 0);
  ck('② 己方城池：标题为「目标城余量」', hT.indexOf('目标城余量') >= 0 || hT.indexOf('不设上限') >= 0, hT.indexOf('目标城余量') >= 0 ? '目标城余量' : '不设上限');
} else {
  console.log('    （单城局：跳过 transfer 用例）');
}

/* 限制行实内容：野地满 → expLimitsHTML 出文 */
console.log('\n===== ④ 限制行内容实测 =====');
var _limBak = (st.wilds || []).slice();
var cap154 = (G.buildingLevel(c, 'guanfu') || 1) + G.cityBonusNum(c, 'wildCap');
st.wilds = [];
for (var wi = 0; wi < cap154; wi++) st.wilds.push({ x: 900 + wi, y: 900, type: 'lake', level: 1, day: 0, startDay: 0 });
G.ui._expRes = { kind: 'wild', x: tx, y: ty };
G.ui._expMode = 'occupy';
var limHtml = G.ui.expLimitsHTML();
ck('野地满 → 限制行含「野地已达上限」', /野地已达上限/.test(limHtml), limHtml.slice(0, 60));
st.wilds = _limBak;
/* 领地满：直接改爵位容量不可行 —— 造超编：塞城市到 cap */
var capC = G.cityCapOf();
while (st.cities.length < capC) {
  var mc = JSON.parse(JSON.stringify(st.cities[0]));
  mc.id = 'x' + st.cities.length; mc.name = '测邑' + st.cities.length;
  st.cities.push(mc);
}
G.ui._expRes = { kind: 'city', id: 'npc_x', npc: { id: 'npc_x' }, name: '测城' };
var limHtml2 = G.ui.expLimitsHTML();
ck('领地满 → 限制行含「领地上限」+「无法纳入版图」', /领地上限/.test(limHtml2) && /无法纳入版图/.test(limHtml2), limHtml2.slice(0, 80));
/* 还原城市数 */
st.cities = st.cities.slice(0, 1);

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
