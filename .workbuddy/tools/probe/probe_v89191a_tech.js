/* v89.191 探针A：科技按城 + 建筑闸门 全链路自检
   ① 新局：城有 techs{} · 研究写回发起城 ② techCapOf 主城20/别城10
   ③ 尾段价（11/20 级） ④ 配对闸（城墙↔作坊） ⑤ 建筑↔科技双向闸
   ⑥ 兵种科技组合（轻骑 3 科技） ⑦ 老档迁移（全境表→各城 + 删顶层）
   ⑧ 战斗上下文（boostSnapshot(city) + withBoost 装 _techCtx） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;
var ok = 0, bad = 0;
function chk(tag, cond, extra) {
  if (cond) { ok++; console.log('PASS ' + tag + (extra ? '  [' + extra + ']' : '')); }
  else { bad++; console.log('FAIL ' + tag + (extra ? '  [' + extra + ']' : '')); }
}

G.newGame({ name: 'tech191', region: '烬环' });
var c0 = G.state.cities[0];
chk('①a 新局城市带 techs 表', !!c0.techs && typeof c0.techs === 'object');
chk('①b state 顶层无 techs', G.state.techs === undefined);

/* ①c 研究写回发起城 */
c0.cells = c0.cells || [];
c0.cells[c0.cells.length - 1] = { build: { id: 'shuyuan', lvl: 3 } };
G.techSet('yanjiu', 0, c0);
c0.res.gold = 9999999; c0.res.wood = 999999; c0.res.stone = 999999;
var r0 = G.systems.research('zhongzhi', c0.id);
chk('①c 研究受理', r0.ok === true, r0.msg);
for (var i = 0; i < 30; i++) G.tickOnce();
chk('①d 完成后写回本城 Lv1', (c0.techs.zhongzhi || 0) === 1, 'lv=' + (c0.techs.zhongzhi || 0));

/* ② 上限 */
chk('②a 非主城上限 10', G.techCapOf(c0) === 10);
G.state.mainCityId = c0.id;
chk('②b 主城上限 20', G.techCapOf(c0) === 20);
chk('②c 主城可推到 20（canResearch 11 级通过）', (function () {
  G.techSet('zhongzhi', 10, c0);
  var r = G.systems.canResearch('zhongzhi', c0.id);
  return r.ok === true;
})());

/* ③ 尾段价 */
var t11 = D.techCost({ type: 'grain' }, 11), t20 = D.techCost({ type: 'grain' }, 20);
chk('③ 尾段价 11=80万 · 20≈3071万', t11.gold === 800000 && t20.gold === 30754688,
  '11=' + t11.gold + ' 20=' + t20.gold);
var t10 = D.techCost({ type: 'grain' }, 10);
chk('③b 1~10 级价逐字不变（10=614400）', t10.gold === 614400, '10=' + t10.gold);

/* ④ 配对闸（城墙↔工匠作坊） */
G.state.mainCityId = null;
var cA = G.makeCity({ id: 'pgA', name: '配对城', x: c0.x + 5, y: c0.y + 5 });
G.registerCity(cA);
cA.cells = []; for (var ci = 0; ci < 48; ci++) cA.cells.push({});   /* 空格用空对象（数组显式 null 会崩旧码） */
/* 官府 Lv6 居中 4 格 */
var gcs = G.govCellsOf(8, 6);
gcs.forEach(function (gi) { cA.cells[gi] = { build: { id: 'guanfu', lvl: 6 } }; });
cA.cells[10] = { build: { id: 'chengqiang', lvl: 3 } };
cA.cells[11] = { build: { id: 'gongjiangzuofang', lvl: 0 } };
chk('④a 城墙(3) vs 作坊(0)：相差 3 > 2 → 上限被压到 2', G.buildCapOf(cA, 'chengqiang') === 2,
  'cap=' + G.buildCapOf(cA, 'chengqiang'));
var pre4 = G.buildPrereqOf(cA, 'chengqiang', 4);
chk('④b 升城墙到 4 → 报配对方闸', pre4.ok === false && /相差不得超过 2 级/.test(pre4.msg), pre4.short);
chk('④c 追方不受限（作坊可升）', G.pairGapOf(cA, 'gongjiangzuofang').cap === 5, 'cap=' + G.pairGapOf(cA, 'gongjiangzuofang').cap);
/* 驿站↔马厩 */
cA.cells[12] = { build: { id: 'yizhan', lvl: 4 } };
cA.cells[13] = { build: { id: 'majiu', lvl: 0 } };
var pre4b = G.buildPrereqOf(cA, 'yizhan', 5);
chk('④d 驿站(4) vs 马厩(0) → 升驿站 5 被拦', pre4b.ok === false && /相差不得超过 2 级/.test(pre4b.msg), pre4b.short);

/* ⑤ 建筑↔科技双向闸 */
cA.cells[14] = { build: { id: 'junying', lvl: 2 } };
var pre5 = G.buildPrereqOf(cA, 'junying', 3);
chk('⑤a 军营升 3 需练兵技巧 Lv1（未研究→拦）', pre5.ok === false && /练兵技巧/.test(pre5.msg), pre5.short);
G.techSet('lianbing', 1, cA);
var pre5b = G.buildPrereqOf(cA, 'junying', 3);
chk('⑤b 研究后放行', pre5b.ok === true, JSON.stringify(pre5b.list));
/* 研究侧 req：战斗技巧需军营 3 */
cA.cells[15] = { build: { id: 'shuyuan', lvl: 3 } };
var cr5 = G.systems.canResearch('zhandou', cA.id);
chk('⑤c 未达军营3 → 无法研究战斗技巧', cr5.ok === false && /军营/.test(cr5.msg), cr5.msg);
var jyCell = null;
cA.cells.forEach(function (x) { if (x && x.build && x.build.id === 'junying') jyCell = x; });
jyCell.build.lvl = 3;
cA.res.gold = 9999999;
var cr5b = G.systems.canResearch('zhandou', cA.id);
chk('⑤d 军营3 后研究受理', cr5b.ok === true, cr5b.msg);

/* ⑥ 兵种科技组合（轻骑） */
c0.army = c0.army || {};
var ct6 = G.canTrain('qingji', cA);
chk('⑥a 轻骑缺 3 科技 → 被拒且逐条列出', ct6.ok === false && /战斗技巧|行军技巧|驾驭技巧/.test(ct6.msg), ct6.msg);
G.techSet('zhandou', 1, cA); G.techSet('xingjun', 1, cA); G.techSet('jiayu', 1, cA);
/* 建筑门槛：junying5 + majiu1 + majiu2(query req for xingjun research not needed now) */
jyCell.build.lvl = 5;
cA.cells[13].build.lvl = 1;
var ct6b = G.canTrain('qingji', cA);
chk('⑥b 补齐 3 科技 + 军营5 后放行', ct6b.ok === true, ct6b.msg);
/* 斥候 */
var ch6 = D.TROOPS.chihou.unlock.tech || {};
chk('⑥c 斥候解锁表含侦察技巧', ch6.zhencha === 1, JSON.stringify(ch6));

/* ⑦ 老档迁移 */
var fake = G.makeCity({ id: 'mg1', name: '迁移甲', x: c0.x + 8, y: c0.y + 8 });
var fake2 = G.makeCity({ id: 'mg2', name: '迁移乙', x: c0.x + 9, y: c0.y + 9 });
var st7 = { cities: [fake, fake2], queues: { tech: [{ techId: 'kanfa', elapsed: 5, totalTime: 10 }] }, techs: { zhongzhi: 7, kanfa: 3 } };
G.migrateTechs191(st7);
chk('⑦a 各城各得一份', fake.techs.zhongzhi === 7 && fake2.techs.kanfa === 3);
chk('⑦b 顶层表已删', st7.techs === undefined);
chk('⑦c 队列补 cityId', st7.queues.tech[0].cityId === 'mg1', st7.queues.tech[0].cityId);
G.migrateTechs191(st7);
chk('⑦d 二次调用幂等（不翻倍）', fake.techs.zhongzhi === 7);

/* ⑧ 战斗上下文 */
var snap = G.battle.boostSnapshot(cA);
chk('⑧a 快照带该城科技', snap.techs.zhandou === 1 && snap.techs.lianbing === 1, JSON.stringify(snap.techs));
var insideVal = null;
G.battle.withBoost(snap, function () {
  insideVal = G.systems.techLevel('zhandou');   /* ctx 生效：不传城也读 cA */
});
chk('⑧b withBoost 内 ctx 生效', insideVal === 1, 'inside=' + insideVal);
chk('⑧c withBoost 后 ctx 还原', G.systems._techCtx == null && G.systems.techLevel('zhandou') === 0,
  'after=' + G.systems.techLevel('zhandou'));
chk('⑧d 空快照=0（纯 NPC）', (function () {
  var s2 = G.battle.boostSnapshot(null);
  var v = null;
  G.battle.withBoost(s2, function () { v = G.systems.techLevel('zhandou'); });
  return v === 0;
})());

console.log('\n结果：' + ok + ' 通过 / ' + bad + ' 失败');
process.exit(bad ? 1 : 0);
