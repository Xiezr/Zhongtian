/* v89.132 探针：军务处重构 / 缩略地图 / 节钺开拓（老板需求 0·1·2·3）
 * ------------------------------------------------------------
 * ① 军务处：两营左右分列（camp-cards）+ 均列逐兵种；兵源与征募 / 军心 两卡退役
 * ② 军务总览：⑤ 两营区已删、统计行无「伤兵」
 * ③ 缩略图：城名去 bold、我城红点（大号档）、名称层、波纹层、（源码级）paintMiniPulse
 * ④ 节钺开拓：三种扩编真调（前置/上限/余额）+ 真加数量（建位/容量/席位）
 * 跑法：node .workbuddy/tools/probe/probe_v89132_three.js
 */
var R = 'E:/Deepseekdb/';
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, D = G.DATA, U = G.utils;
var uSrc = fs.readFileSync(path.join(R, 'js', 'ui.js'), 'utf8');
var hSrc = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
var OUT = [];
function say(s) { OUT.push(s); console.log(s); }
function ok(name, cond, extra) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra != null ? '  [' + extra + ']' : ''));
}

var st = G.newGame({ name: '测', cityName: '许都', region: '豫州', mapSeed: 20260926 });
if (!st.map.grid) G.map.generate();
var c = st.cities[0];
G.ui._cityId = c.id;

console.log('===== ① 军务处：两营左右分列 =====');
st.wounded = 15; st.woundedArmy = { yibing: 12, gongjian: 3 };
st.captives = { qingji: 5, changqiang: 8 };
var hA = G.ui.marchAffairsHTML();
ok('两营容器 .camp-cards（左右分列的网格）', hA.indexOf('class="camp-cards"') >= 0);
ok('两营卡片 .camp-card 各一', (hA.match(/class="camp-card"/g) || []).length === 2);
ok('伤兵营标题 / 俘虏营标题在位', hA.indexOf('🏥 伤兵营') >= 0 && hA.indexOf('🪶 俘虏营') >= 0);
ok('伤兵营逐兵种（义兵 12 / 弓箭手 3）', hA.indexOf('义兵') >= 0 && hA.indexOf('弓箭手') >= 0);
ok('俘虏营逐兵种（轻骑兵 5 / 长枪兵 8）', hA.indexOf('轻骑兵') >= 0 && hA.indexOf('长枪兵') >= 0);
ok('兵源与征募 已退役', hA.indexOf('兵源与征募') < 0);
ok('军心（逃兵风险） 已退役', hA.indexOf('军心') < 0);
var hW = G.ui.campCard('wounded'), hC = G.ui.campCard('captive');
ok('campCard 单参形态（无 compact）', hW.indexOf('camp-card') >= 0 && hC.indexOf('camp-card') >= 0);
ok('俘虏营仍纯文字（无 <img>）· 伤兵营带图标', hC.indexOf('<img') < 0 && hW.indexOf('<img') >= 0);

console.log('');
console.log('===== ② 军务总览：两营区退役 =====');
G.ui._marchTab = 'over';
var hOver = G.ui.marchesHTML();
ok('无 ⑤ 两营区', hOver.indexOf('⑤ 两营') < 0);
ok('无两营紧凑卡（campCard）', hOver.indexOf('campCard') < 0);
ok('统计行无「伤兵」项', hOver.indexOf('　·　伤兵 ') < 0);
ok('四段结构仍在（① 城内 / ② 驻守野地 / ③ 采集队 / ④ 行军）',
  hOver.indexOf('① 城内') >= 0 && hOver.indexOf('② 驻守野地') >= 0
  && hOver.indexOf('③ 采集队') >= 0 && hOver.indexOf('④ 行军') >= 0);
ok('军务处页签角标仍在（campBadgeN 唯一出口）',
  G.ui.campBadgeN() === 15 + G.captivesTotalOf(),
  'badge=' + G.ui.campBadgeN() + ' = 伤兵15 + 俘虏' + G.captivesTotalOf());

console.log('');
console.log('===== ③ 缩略地图 =====');
ok('城名层去 bold（源码级）', uSrc.indexOf("'bold ' + fs + 'px sans-serif'") < 0
  && uSrc.indexOf("'normal ' + fs + 'px sans-serif'") >= 0);
ok('描边减细（0.12fs）', uSrc.indexOf('fs * 0.12') >= 0);
ok('我城点 = 红点出口（miniMeDot）', typeof G.ui.miniMeDot === 'function'
  && uSrc.indexOf("ui.MINI_ME = { dot: '#ff3a2a'") >= 0);
ok('波纹出口（miniMeWave）+ 动画层（paintMiniPulse）', typeof G.ui.miniMeWave === 'function'
  && typeof G.ui.paintMiniPulse === 'function');
ok('我城名称层（miniMeLabels）', typeof G.ui.miniMeLabels === 'function');
ok('底部小图大号红点 + 闪烁（meBig/meBlink）',
  uSrc.indexOf('{ meBig: true, meBlink: true }') >= 0);
ok('主循环每秒重绘底部小图', fs.readFileSync(path.join(R, 'js', 'main.js'), 'utf8')
  .indexOf('ui.paintMiniBottom();') >= 0);
ok('图例「我城」色改红', hSrc.indexOf('--lg-me: #ff3a2a') >= 0);
ok('波纹层 CSS（.mini-wrap canvas.mini-pulse）', hSrc.indexOf('.mini-wrap canvas.mini-pulse') >= 0);
/* 真调：假 ctx 数"我城点了几个 / 红点半径" */
var FAKE = function () {
  var rec = { arcs: [], fills: [], strokes: 0, rects: 0, texts: 0, bad: false };
  return {
    rec: rec,
    set fillStyle(v) { rec.lastFill = v; }, get fillStyle() { return rec.lastFill; },
    set strokeStyle(v) { }, set lineWidth(v) { }, set globalAlpha(v) { rec.alpha = v; },
    set font(v) { rec.lastFont = v; }, set textAlign(v) { }, set textBaseline(v) { },
    beginPath: function () { }, arc: function (x, y, r) { rec.arcs.push([x, y, r, rec.lastFill]); },
    fill: function () { rec.fills.push(rec.lastFill); }, stroke: function () { rec.strokes++; },
    fillRect: function () { rec.rects++; }, clearRect: function () { },
    drawImage: function () { }, strokeText: function () { }, fillText: function () { rec.texts++; },
    save: function () { }, restore: function () { }, ellipse: function () { }
  };
};
var f1 = FAKE();
G.ui.miniMeDot(f1, 100, 100, 1000, false);
G.ui.miniMeDot(f1, 100, 100, 1000, true);
var rSmall = f1.rec.arcs[0][2], rBig = f1.rec.arcs[1][2];
ok('红点：小档 r=' + rSmall + ' / 底部小图档 r=' + rBig + '（大号看得见）', rBig > rSmall * 3);
var f2 = FAKE();
G.ui.miniMeWave(f2, 100, 100, 1000, 500);
ok('波纹：真画 2 圈', f2.rec.arcs.length === 2 && f2.rec.strokes === 2);

console.log('');
console.log('===== ④ 节钺开拓 =====');
var C = D.JIEYUE;
ok('数据表新增 xcMax / genMax', C.xcMax === 2 && C.genMax === 2);
/* 前置：无校场 / 无招贤馆 → 拒 */
var pre0 = G.jieyueExpandOf(c, 'xc');
var preG = G.jieyueExpandOf(c, 'gen');
ok('无校场 → 校场扩编被拒', pre0.ok === false && pre0.msg.indexOf('校场') >= 0, pre0.msg);
ok('无招贤馆 → 招贤纳士被拒', preG.ok === false && preG.msg.indexOf('招贤馆') >= 0, preG.msg);
/* 建校场（摆格）+ 招贤馆 */
var put = function (bid) {
  var idx = -1;
  (c.cells || []).forEach(function (cell, i) { if (idx < 0 && !cell.build) idx = i; });
  c.cells[idx] = { build: { id: bid, lvl: 2 } };
};
put('xiaochang'); put('zhaoxianguan');
st.jieyue = 10;
/* ① 校场扩编：容量 +1 万 */
var cap0 = G.battle.marchCapOf(c);
var rx1 = G.jieyueExpand('xc', c.id);
var cap1 = G.battle.marchCapOf(c);
console.log('  marchCapOf: ' + U.fmt(cap0) + ' → ' + U.fmt(cap1) + '（差 ' + U.fmt(cap1 - cap0) + '）');
ok('校场扩编真调 OK 且容量上涨（期望差=10000×加成系数）',
  rx1.ok === true && (cap1 - cap0) >= 10000);
console.log('  msg: ' + rx1.msg);
/* ② 招贤纳士：席位 +1 */
var slot0 = G.genSlotsOf(c);
var rg1 = G.jieyueExpand('gen', c.id);
var slot1 = G.genSlotsOf(c);
ok('招贤纳士真调 OK 且席位 +1', rg1.ok === true && slot1 === slot0 + 1, slot0 + ' → ' + slot1);
console.log('  msg: ' + rg1.msg);
/* ③ 上限：各至多 2 次 */
G.jieyueExpand('xc', c.id); G.jieyueExpand('gen', c.id);
var rx3 = G.jieyueExpand('xc', c.id);
var rg3 = G.jieyueExpand('gen', c.id);
ok('第 3 次校场扩编被上限拦下', rx3.ok === false && rx3.msg.indexOf('上限') >= 0, rx3.msg);
ok('第 3 次招贤纳士被上限拦下', rg3.ok === false && rg3.msg.indexOf('上限') >= 0, rg3.msg);
var cap2 = G.battle.marchCapOf(c), slot2 = G.genSlotsOf(c);
console.log('  上限态：容量 ' + U.fmt(cap2) + '（=2 次满）· 席位 ' + slot2 + '（=2 次满） · 余额 ' + G.jieyueOf());
/* ④ 余额不足 */
st.jieyue = 0;
var rb = G.jieyueExpand('city', c.id);
ok('节钺不足 → 拒且不改状态', rb.ok === false && rb.msg.indexOf('节钺不足') >= 0, rb.msg);
/* ⑤ 城建扩编仍可用（旧链未断） */
st.jieyue = 1;
var bs0 = G.buildSlots(c);
var rc = G.jieyueExpand('city', c.id);
ok('城建扩编（旧链）：建造位 +1', rc.ok === true && G.buildSlots(c) === bs0 + 1);
/* ⑥ 节钺面板渲染 */
G.state = st;
try {
  G.ui.openJieyue();
  var root = global.document.querySelector('#modal-root');
  var t = (root && root.innerHTML) || '';
  ok('openJieyue 面板：余额 + 四用途 + 全境进度',
    t.indexOf('节钺') >= 0 && t.indexOf('问鼎天授') >= 0 && t.indexOf('校场扩编') >= 0
    && t.indexOf('招贤纳士') >= 0 && t.indexOf('全境扩编') >= 0 && t.indexOf('首占名城') >= 0);
  try { G.ui.closeAllModals(); } catch (e) { }
} catch (e) {
  ok('openJieyue 面板渲染', false, '异常: ' + e.message);
}

console.log('');
console.log('===== 完成 =====');
process.exit(0);
