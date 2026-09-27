'use strict';
/* v89.151 综合探针 A：老板 8 条的现状取证
   ① 兵种悬停「血都是零」的真病根（快照 cp() 漏字段？）
   ② 关键帧数据（replay）体积 —— 回答老板「影响大吗，以什么维度评估」
   ③ 克制反查（克谁 / 被谁克）—— 为悬停的绿字/红字设计
   ④ 快照 keys vs 引擎 unit keys 的逐字段对账
   跑法：node .workbuddy/tools/probe/probe_v89151_base.js */
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join('E:/Deepseekdb/', '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join('E:/Deepseekdb/js/', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

G.newGame({ name: '探151', cityName: '许都', region: '豫州', mapSeed: 20260951 });
if (!G.state.map.grid) G.map.generate();
var st = G.state, c = st.cities[0];
G.ui._cityId = c.id;

/* ============ ① 兵种悬停：现状输出与血为零病根 ============ */
console.log('===== ① 兵种悬停（btUnitTip）现状 =====');
var xc = c.cells.filter(function (x) { return x.build && x.build.id === 'xiaochang'; })[0];
if (xc) xc.build.lvl = 8;
c.army = { changqiang: 20000, qingji: 4000, chuangnu: 1500 };
var gen = st.generals[0]; gen.stamina = 999; gen.energy = 999;
var wl = null;
for (var rr = 3; rr <= 14 && !wl; rr++) {
  for (var dy = -rr; dy <= rr && !wl; dy++) {
    for (var dx = -rr; dx <= rr && !wl; dx++) {
      var x = c.x + dx, y = c.y + dy, tl = G.map.tile(x, y);
      if (!tl || G.map.wildAt(x, y) || (G.map.npcAt && G.map.npcAt(x, y))) continue;
      var lv = G.map.wildLevelNow(x, y);
      if (!(lv >= 6)) continue;
      var wd = G.wildDefenseAt(x, y, lv);
      if (wd && wd.gen) wl = { x: x, y: y, lv: lv };
    }
  }
}
st.settings.battleWatch = true;
var r1 = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'raid', { changqiang: 9000 }, gen.id, {});
var rec = null; (st.battles || []).forEach(function (b) { rec = b; });
console.log('挂起=' + r1.ok + ' pending=' + r1.pending + ' rec=' + (rec && rec.id));
G.ui.openBattlefield(rec.id);
var snap = rec.snapLast || (function () {
  /* 会话快照出口 */
  var ses = G._bsess[rec.id];
  return ses ? ses.snap() : null;
})();
console.log('snap 来源: snapLast=' + !!rec.snapLast);
var u0 = (snap && snap.atk && snap.atk[0]) || null;
console.log('snap.atk[0] keys = ' + JSON.stringify(u0 ? Object.keys(u0) : null));
/* 引擎里的活 unit（session 内部） */
var ses = G._bsess[rec.id];
var liveUnit = null;
if (ses) {
  try {
    var env = ses.env || null;
    /* 会话对象不暴露 env → 用公开途径：step 后再看；若无则只比字段 */
  } catch (e) { }
}
/* 字段对账：unitsInit 产出的字段（源码已知）vs snap cp() 复制的字段 */
var ENGINE_FIELDS = ['id', 'name', 'side', 'count', 'start', 'hpPer', 'range', 'spd', 'cover', 'stance', 'target', 'sortie', 'adv', 'atkPct', 'defPct', 'vsCity'];
var SNAP_FIELDS = u0 ? Object.keys(u0) : [];
var missing = ENGINE_FIELDS.filter(function (k) { return SNAP_FIELDS.indexOf(k) < 0; });
console.log('引擎字段 ' + ENGINE_FIELDS.length + ' 个 · 快照只抄了 ' + SNAP_FIELDS.length + ' 个');
console.log('❌ 快照漏抄字段 = ' + JSON.stringify(missing));
/* 直接调 btUnitTip 看输出（走真实出口） */
var tip = G.ui.btUnitTip(u0, 'atk');
console.log('---- btUnitTip 实输出 ----');
console.log(tip);
/* perHp 直算（验证 NaN） */
var f = G.battle.unitFinalOf(u0, gen);
console.log('unitFinalOf.hp = ' + f.hp + '（应为数字；NaN 即"血为零"病根）');
console.log('unitFinalOf.baseHp = ' + f.baseHp + ' · totalHp = ' + f.totalHp);

/* ============ ③ 克制反查 ============ */
console.log('\n===== ③ 克制反查（克谁 / 被谁克）=====');
G.troopCounterOf = G.troopCounterOf || null;   /* 若已存在则是唯一出口 */
Object.keys(DATA.TROOPS).forEach(function (id) {
  var beats = [], beaten = [];
  Object.keys(DATA.TROOPS).forEach(function (fid) {
    var atk = (DATA.COUNTER_ATK[id] || {})[fid] || 1;      /* 我打他 */
    var myDef = (DATA.COUNTER_DEF[id] || {})[fid] || 1;    /* 我挨他打，我的防 */
    var foeAtk = (DATA.COUNTER_ATK[fid] || {})[id] || 1;   /* 他打我 */
    var foeDef = (DATA.COUNTER_DEF[fid] || {})[id] || 1;
    if (atk > 1 || myDef > 1) beats.push(fid + '(' + (atk > 1 ? '攻×' + atk : '防×' + myDef) + ')');
    if (foeAtk > 1 || foeDef > 1) beaten.push(fid + '(' + (foeAtk > 1 ? '他攻×' + foeAtk : '他防×' + foeDef) + ')');
  });
  if (beats.length || beaten.length) {
    console.log('  ' + DATA.TROOPS[id].name + '：克 ' + (beats.join('、') || '—')
      + '　|　被克 ' + (beaten.join('、') || '—'));
  }
});

/* ============ ② replay 数据体积 ============ */
console.log('\n===== ② 关键帧数据（replay）体积实测 =====');
st.settings.battleWatch = false;
gen.stamina = 999; gen.energy = 999;
var r2 = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'raid', { changqiang: 9000 }, gen.id, {});
var rep = st.reports[0];
function bytes(o) { return JSON.stringify(o || null).length; }
console.log('本场：回合数=' + ((r2.result || {}).rounds || '?')
  + ' · 我方兵种 ' + Object.keys((r2.result || {}).atkStartBy || {}).length
  + ' · 敌方兵种 ' + Object.keys((r2.result || {}).defStartBy || {}).length);
console.log('replay 帧数 = ' + ((rep.replay || []).length) + ' 帧');
console.log('replay JSON = ' + bytes(rep.replay) + ' B（' + (bytes(rep.replay) / 1024).toFixed(1) + ' KB）');
console.log('scene  JSON = ' + bytes(rep.scene) + ' B');
console.log('body   JSON = ' + bytes(rep.body) + ' B');
console.log('整条战报 JSON = ' + bytes(rep) + ' B（' + (bytes(rep) / 1024).toFixed(1) + ' KB）');
/* 单帧样本 */
if (rep.replay && rep.replay.length) {
  console.log('首帧样本 = ' + JSON.stringify(rep.replay[0]).slice(0, 300));
  var mid = rep.replay[Math.floor(rep.replay.length / 2)];
  console.log('中帧样本 = ' + JSON.stringify(mid).slice(0, 300));
}
/* 战报上限（60 条）下的总量估算 */
var cap60 = bytes(rep) * 60;
console.log('若每次 ≈ 本场规模：60 场上限 → 约 ' + (cap60 / 1024 / 1024).toFixed(2) + ' MB');
/* 存档总大小对比 */
var sp = G.savePayload ? G.savePayload() : null;
console.log('当前存档 JSON = ' + (sp ? (bytes(sp) / 1024).toFixed(1) + ' KB' : '(savePayload 不可用)')
  + ' · 其中战报 ' + ((sp && sp.reports ? bytes(sp.reports) : 0) / 1024).toFixed(1) + ' KB');
if (sp && sp.reports) {
  console.log('存档内战报 ' + sp.reports.length + ' 条 · replay 合计 '
    + (bytes(sp.reports.map(function (x) { return x.replay; })) / 1024).toFixed(1) + ' KB');
}
/* 逐帧结构：一个帧的字段 */
if (rep.replay && rep.replay[0]) {
  console.log('帧字段 = ' + JSON.stringify(Object.keys(rep.replay[0])));
}

/* ============ 补充：悬停需求需要的 全军防御 ============ */
console.log('\n===== ⑤ 悬停需求字段核对（unitFinalOf 能否给全军防御）=====');
console.log('unitFinalOf 现有字段 = ' + JSON.stringify(Object.keys(f)));
console.log('需要新增 totalDef（= def × count）· 现有 totalAtk=' + f.totalAtk + ' totalHp=' + f.totalHp);

process.exit(0);
