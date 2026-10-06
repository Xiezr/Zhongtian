/* v89.204 探针 a：民心占领机制 —— 改前基线 / 改后对照（同一支探针跑两遍）
   ------------------------------------------------------------
   老板需求 1：「据点、城池占领以民心为基础，战斗成功，败方失去20点民心，
   民心为0时可以被占领（如为我方，除主城不可被占领外，别的城池将会被敌方占领）」

   断言按**目标态**写：改前跑 → 红（拿到基线数据）；补丁后跑 → 全绿。
   全部经游戏出口造局，不碰存档文件。防御式写法（改前出口不存在也不崩）。
   ------------------------------------------------------------
   运行：node .workbuddy/tools/probe/probe_v89204a_hearts.js   （输出重定向到文件再读） */
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra == null ? '' : extra) + ']'); }
}

/* ── boot：新局 + 首城造兵造将 ── */
var st = G.newGame({ name: 'v204a', cityName: '许都', mapSeed: 20261006 });
G.state = st;
if (!st.map.grid) G.map.generate();
st.world.weather = 'clear';
st.settings.battleWatch = false;
var c0 = st.cities[0];
G.ui._cityId = c0.id;
c0.army = { qingji: 99999, gongjian: 99999, minfu: 100000 };
var lord = G.lordGeneralOf();
lord.status = 'idle';
if (G.setStaNow) G.setStaNow(lord, 9999);
lord.energy = 9999;

console.log('=== ① 数据表基线 ===');
chk('①a DATA.SIEGE.heartsLoss === 20（固定扣民心 20 · 老板给定）',
  (DATA.SIEGE || {}).heartsLoss === 20, 'heartsLoss=' + (DATA.SIEGE || {}).heartsLoss);
chk('①b 围攻范围含全部城池（fort/county/jun/zhou/capital）', (function () {
  var sc = (DATA.SIEGE || {}).scope || [];
  return ['fort', 'county', 'jun', 'zhou', 'capital'].every(function (k) { return sc.indexOf(k) >= 0; });
})(), 'scope=' + JSON.stringify((DATA.SIEGE || {}).scope));
chk('①c 旧的动态 chip 参数（chipBase/chipMin/chipMax）已退役',
  (DATA.SIEGE || {}).chipBase === undefined && (DATA.SIEGE || {}).chipMin === undefined
  && (DATA.SIEGE || {}).chipMax === undefined, 'chipBase=' + (DATA.SIEGE || {}).chipBase);
chk('①d DATA.INVASION.loseCity === true（撤销"输了不丢城"红线）',
  (DATA.INVASION || {}).loseCity === true, 'loseCity=' + (DATA.INVASION || {}).loseCity);
chk('①e 民心恢复与衰减参数仍在（repairPerDay / defScale / defThr）',
  (DATA.SIEGE || {}).repairPerDay > 0 && (DATA.SIEGE || {}).defScale > 0 && (DATA.SIEGE || {}).defThr > 0,
  'repair=' + (DATA.SIEGE || {}).repairPerDay);

console.log('=== ② 据点单波（改前：动态 chip 16~45%）===');
var ft = null, ft2 = null;
for (var x = 30; x < 130 && (!ft || !ft2); x++) {
  for (var y = 30; y < 130 && (!ft || !ft2); y++) {
    var f = G.map.fortAt(x, y);
    if (!f) continue;
    if (!ft) ft = f;
    if (f.level <= 4 && !ft2) ft2 = f;
  }
}
ft = ft2 || ft;   /* 优先低级靶（保证有守军且打得动） */
chk('②a 找到据点靶', !!ft, ft && (ft.name + ' Lv' + ft.level));
var rFort = null;
if (ft) {
  lord.energy = 9999; if (G.setStaNow) G.setStaNow(lord, 9999);
  rFort = G.battle.expedition({ kind: 'fort', x: ft.x, y: ft.y }, 'occupy', { qingji: 20000 }, lord.id);
}
var sg1 = rFort && rFort.result && rFort.result.siege;
console.log('    据点首波：ok=' + (rFort && rFort.ok) + ' winner=' + (rFort && rFort.result && rFort.result.winner)
  + ' chip=' + (sg1 && sg1.chip) + ' 民心余=' + (sg1 && sg1.hold));
chk('②b 取胜单波 → 扣民心恰为 20（固定）', !!(sg1 && sg1.chip === 20 && sg1.hold === 80),
  sg1 ? ('chip=' + sg1.chip + ' hold=' + sg1.hold) : '无围攻记录');

console.log('=== ③ 战败/撤退不扣民心（改前：不论胜负都推进）===');
/* 必败靶：**最高等级**据点（守军最大），用民夫少量攻 → 必输 */
var ft3 = null;
for (var x3 = 30; x3 < 130; x3++) {
  for (var y3 = 30; y3 < 130; y3++) {
    var f3 = G.map.fortAt(x3, y3);
    if (f3 && (!ft3 || f3.level > ft3.level)) ft3 = f3;
  }
}
chk('③a 找到必败靶（最高级据点）', !!ft3, ft3 && (ft3.name + ' Lv' + ft3.level));
var rLose = null, loseTry = [];
[300, 1000, 30].forEach(function (n) {
  if (rLose && rLose.result) return;
  lord.energy = 9999; if (G.setStaNow) G.setStaNow(lord, 9999);
  rLose = G.battle.expedition({ kind: 'fort', x: ft3.x, y: ft3.y }, 'occupy', { minfu: n }, lord.id);
  loseTry.push(n + ':' + (rLose && rLose.ok) + '/' + (rLose && rLose.msg ? rLose.msg.slice(0, 40) : ''));
  if (rLose && rLose.result) return;
});
var sgL = rLose && rLose.result && rLose.result.siege;
var winL = rLose && rLose.result && rLose.result.winner;
console.log('    弱攻强：tries=' + loseTry.join(' | ') + ' → winner=' + winL
  + ' chip=' + (sgL && sgL.chip) + ' 民心余=' + (sgL && sgL.hold));
chk('③b 战败 → 不扣民心（败仗无围攻推进）',
  !!(rLose && rLose.result && winL !== 'atk') ? (!sgL || sgL.hold >= 100) : false,
  'winner=' + winL + ' hold=' + (sgL && sgL.hold) + ' tries=' + loseTry.join('|'));

console.log('=== ④ 名城（州城）纳入围攻（改前：决战制 · scope 不含）===');
var zhou = null;
(st.map.cities || []).forEach(function (x) { if (!zhou && x.type === 'zhou') zhou = x; });
var scopeZ = null, scopeC = null;
if (zhou) {
  var tz = G.battle.resolveTarget({ kind: 'city', id: zhou.id });
  scopeZ = G.siegeScopeOf(tz);
}
var county = null;
(st.map.cities || []).forEach(function (x) { if (!county && x.type === 'county') county = x; });
if (county) {
  var tc = G.battle.resolveTarget({ kind: 'city', id: county.id });
  scopeC = G.siegeScopeOf(tc);
}
chk('④a 州城在围攻范围（可多波磨）', scopeZ === true, 'zhou scope=' + scopeZ);
chk('④b 县城在围攻范围', scopeC === true, 'county scope=' + scopeC);

console.log('=== ⑤ 玩家城民心·战争创伤出口（改前：无）===');
chk('⑤a cityHeartsOf 出口在册', typeof G.cityHeartsOf === 'function', typeof G.cityHeartsOf);
chk('⑤b heartsWarAdd / heartsWarOf 出口在册',
  typeof G.heartsWarAdd === 'function' && typeof G.heartsWarOf === 'function',
  typeof G.heartsWarAdd + '/' + typeof G.heartsWarOf);
chk('⑤c cityFallen（失城处置）出口在册', typeof G.cityFallen === 'function', typeof G.cityFallen);

console.log('=== ⑥ 敌方破城 + 民心归零 → 失城（含主城保护）===');
/* 场景 A：非主城·民心清零·守方必败 → 城失 */
var lostA = { ran: false };
if (typeof G.cityFallen === 'function' && typeof G.heartsWarAdd === 'function' && st.cities.length >= 1) {
  /* 先造第二城（失城测试要有收容城；主城=许都） */
  G.mainCitySet ? null : null;
  var cA = c0;   /* 用首城测——但首城=默认主城会受保护，先设 mainCityId 到别城 */
  /* 造一座副城 */
  var cx = c0.x + 3, cy = c0.y + 3;
  st.wilds = st.wilds || [];
  if (G.map.tile(cx, cy) && !st.wilds.some(function (w) { return w.x === cx && w.y === cy; })) {
    st.wilds.push({ x: cx, y: cy, type: 'plain', level: 3, levelDay: G.questDayIndex() });
  }
  var built = null;
  try { built = G.buildCityAt(cx, cy); } catch (e) { built = null; }
  if (built && built.ok && built.city) {
    st.mainCityId = built.city.id;      /* 主城改到新城 → 首城 c0 变成可被占的副城 */
    lostA.ran = true;
    var beforeN = st.cities.length;
    /* 民心清零：战争创伤拉满 */
    G.heartsWarAdd(c0, 200);
    var hNow = G.cityHeartsOf(c0);
    /* 守方必败（清空驻军），敌军得手 → 应失城 */
    c0.army = {}; c0.def = 0;
    var out6 = G.invasionResolve(c0, '流寇', 77);
    lostA.held = out6 && out6.held;
    lostA.citiesBefore = beforeN;
    lostA.citiesAfter = st.cities.length;
    lostA.gone = !st.cities.some(function (c) { return c.id === c0.id; });
    lostA.npcBack = !!(st.map.cities || []).some(function (c) { return c.id === c0.id || c.origId === c0.id || (c.x === c0.x && c.y === c0.y); });
    lostA.hearts = hNow;
  }
}
if (lostA.ran) {
  console.log('    场景A：民心=' + lostA.hearts + ' held=' + lostA.held
    + ' 城数 ' + lostA.citiesBefore + '→' + lostA.citiesAfter + ' npc回到地图=' + lostA.npcBack);
  chk('⑥a 非主城·民心0·城破 → 城池失陷（s.cities 移除）', lostA.gone === true,
    'gone=' + lostA.gone + ' cities=' + lostA.citiesAfter);
  chk('⑥b 失城 → 变回地图上的 NPC 城（可再打回）', lostA.npcBack === true, 'npcBack=' + lostA.npcBack);
  /* 场景 B：主城（新城）民心清零 → 不可被占 */
  var cB = G.cityById ? G.cityById(st.mainCityId) : null;
  if (cB) {
    G.heartsWarAdd(cB, 200);
    cB.army = {}; cB.def = 0;
    var nB0 = st.cities.length;
    var out6b = G.invasionResolve(cB, '流寇', 78);
    chk('⑥c 主城·民心0·城破 → 不可被占（红线）',
      st.cities.length === nB0 && !!st.cities.some(function (c) { return c.id === cB.id; }),
      'cities=' + st.cities.length + ' held=' + (out6b && out6b.held));
  } else {
    chk('⑥c 主城·民心0·城破 → 不可被占（红线）', false, '未找到主城');
  }
} else {
  chk('⑥a 非主城·民心0·城破 → 城池失陷（s.cities 移除）', false, '造局未就绪（改前出口缺失，预期）');
  chk('⑥b 失城 → 变回地图上的 NPC 城（可再打回）', false, '造局未就绪');
  chk('⑥c 主城·民心0·城破 → 不可被占（红线）', false, '造局未就绪');
}

console.log('=== ⑦ 战争创伤恢复（每现实日 8 · 读时惰性）===');
chk('⑦a 战争创伤可被安抚/时间恢复（heartsWarOf 读时含恢复口径）', (function () {
  if (typeof G.heartsWarOf !== 'function') return false;
  var c7 = st.cities[0];
  if (!c7) return false;
  G.heartsWarAdd(c7, 20);
  var w0 = G.heartsWarOf(c7);
  /* 把记录日拨早 2 天 → 应恢复 16 */
  var rec = (c7.warHearts && c7.warHearts) || null;
  if (rec) { rec.day = G.questDayIndex() - 2; }
  var w1 = G.heartsWarOf(c7);
  return w0 >= 20 && Math.abs(w1 - (w0 - 16)) <= 0.001;
})(), '见实现');

console.log('');
console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败' + (FAIL ? '（改前基线：红单即待改造项）' : '（全绿）'));
process.exit(0);
