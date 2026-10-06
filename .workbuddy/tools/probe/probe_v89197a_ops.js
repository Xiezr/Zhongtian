/* v89.197 探针A：战法（强攻/围困/奇袭）全链行为验证（老板 1 问的取证）
   —— 老板问「战法依赖什么、产生什么效果、好像没发挥作用」→ 本探针给出全链证据：
   ① dispatch 链：m.ops 落库 + 围困行军 ×1.5
   ② 战斗对照（raid）：assault vs encircle（同据点同兵力同种子）—— 结果 + schemeNote
   ③ 奇袭放大：scheme=yaoyan 时 assault vs surprise —— 守军逃散 % 对照
   ④ 破防对照（occupy）：assault vs encircle —— siege.chip 与公式核对
   ⑤ UI 链：三 chip 渲染 + lock 判定（奇袭无计略置灰）
   ⑥ 挂起链：观战挂起 → rec.ops / rec.sim.scNote → autoBattle 落账 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '战法探针', region: '烬环' });
if (!G.state.map.grid) G.map.generate();
var st = G.state, c0 = st.cities[0];
st.settings = st.settings || {};
st.settings.battleWatch = false;          /* 即时结算（对照用） */
st.rank = 6;                              /* 抬爵位（occupy 领地上限闸） */
G.state.world.weather = 'clear';          /* 天气固定（§90.1） */
G.ui._cityId = c0.id;

var TID = 'qingji';
function armOf(n) { var o = {}; o[TID] = n; return o; }
function sta999(g) { G.setStaNow(g, G.staMax(g)); g.energy = 999; }

/* 据点池（优先低等级——守军小便于打赢对照） */
var hi = [], lo = [];
for (var yy = 0; yy < 240; yy++) {
  for (var xx = 0; xx < 240; xx++) {
    var ff = G.map.fortAt(xx, yy);
    if (!ff) continue;
    if (ff.level <= 5) lo.push(ff); else hi.push(ff);
  }
}
hi.sort(function (a, b) { return a.level - b.level; });
var forts = (lo.length >= 3 ? lo : lo.concat(hi)).slice(0, 8);
console.log('据点池（' + forts.length + '）：' + forts.map(function (f) {
  return f.name + 'Lv' + f.level + '@' + f.x + ',' + f.y;
}).join('　'));
if (!forts.length) { console.log('无据点，退出'); process.exit(0); }

var hero = G.makeGeneral('战法将', 80, 'idle', c0.id, false, 'ming', 'balance');
st.generals.push(hero);
sta999(hero);

function garSum(lv) {
  var g = G.map.fortGarrison(lv), n = 0;
  for (var k in g) n += g[k];
  return n;
}

/* ══════ ① dispatch 链 ══════ */
console.log('\n══════ ① dispatch 链：m.ops 落库 + 围困行军 ×1.5 ══════');
var fA = forts[0];
function trip(ops) {
  delete (st.fortRaids || {})[fA.x + ',' + fA.y];
  c0.army = {}; c0.army[TID] = 500000;
  hero.status = 'idle'; sta999(hero);
  var r = G.march.dispatch({ kind: 'fort', x: fA.x, y: fA.y }, 'raid', armOf(3000), hero.id, null, ops);
  if (!r.ok) return { ok: false, msg: r.msg };
  var m = st.marches[st.marches.length - 1];
  var out = { ok: true, ops: m.ops, tt: m.totalTime };
  st.marches.pop();
  c0.army[TID] += 3000; hero.status = 'idle';
  return out;
}
var t1 = trip('assault'), t2 = trip('encircle'), t3 = trip('surprise');
console.log('  强攻：ok=' + t1.ok + '　m.ops=' + t1.ops + '　行军=' + t1.tt + ' 游戏秒' + (t1.msg ? '（' + t1.msg + '）' : ''));
console.log('  围困：ok=' + t2.ok + '　m.ops=' + t2.ops + '　行军=' + t2.tt + ' 游戏秒' + (t2.msg ? '（' + t2.msg + '）' : ''));
console.log('  奇袭（无计略）：ok=' + t3.ok + '　' + (t3.ok ? 'm.ops=' + t3.ops : 'msg=' + t3.msg) + '（应被拒：奇袭须先选定一门计略）');
console.log('  → 围困/强攻 行军比 = ' + (t2.ok && t1.ok ? (t2.tt / t1.tt).toFixed(3) : '-') + '（应 ≈1.5）');

/* ══════ ② 战斗对照 raid ══════ */
console.log('\n══════ ② 战斗对照（raid · 同据点同兵力）：强攻 vs 围困 ══════');
var garr = garSum(fA.level);
var nSo = Math.round(garr * 1.3);
console.log('  ' + fA.name + ' Lv' + fA.level + ' 守军合计 ' + garr + '　出兵 ' + nSo + ' ' + TID);
function fightRaid(ops, scheme) {
  delete (st.fortRaids || {})[fA.x + ',' + fA.y];
  c0.army = {}; c0.army[TID] = 500000;
  hero.status = 'idle'; sta999(hero);
  if (G.siegeClear) G.siegeClear({ kind: 'fort', x: fA.x, y: fA.y });
  return G.battle.expedition({ kind: 'fort', x: fA.x, y: fA.y }, 'raid', armOf(nSo), hero.id,
    { ops: ops, scheme: scheme || null });
}
var r1 = fightRaid('assault'), r2 = fightRaid('encircle');
function brief(r) {
  if (!r) return 'null';
  if (!r.ok) return '被拒：' + r.msg;
  var x = r.result || {};
  return 'winner=' + x.winner + '　rounds=' + x.rounds + '　我损=' + x.atkLoss + '　敌损=' + x.defLoss
    + '　note=' + JSON.stringify(r.schemeNote || x.schemeNote || '');
}
console.log('  强攻：' + brief(r1));
console.log('  围困：' + brief(r2));

/* ══════ ③ 奇袭放大（yaoyan）══════ */
console.log('\n══════ ③ 奇袭放大：计略「妖言惑众」×1 / ×1.5 ══════');
var r3a = fightRaid('assault', 'yaoyan');
var r3b = fightRaid('surprise', 'yaoyan');
console.log('  强攻+妖言：' + brief(r3a));
console.log('  奇袭+妖言：' + brief(r3b));

/* ══════ ④ 破防对照（occupy）══════ */
console.log('\n══════ ④ 破防对照（occupy）：assault vs encircle ══════');
var fB = forts[1], fC = forts[2];
function fightOccupy(ops, ft) {
  c0.army = {}; c0.army[TID] = 500000;
  hero.status = 'idle'; sta999(hero);
  if (G.siegeClear) G.siegeClear({ kind: 'fort', x: ft.x, y: ft.y });
  return G.battle.expedition({ kind: 'fort', x: ft.x, y: ft.y }, 'occupy', armOf(nSo), hero.id, { ops: ops });
}
var r4a = fightOccupy('assault', fB);
var r4b = fightOccupy('encircle', fC);
function siegeBrief(r) {
  if (!r) return 'null';
  if (!r.ok) return '被拒：' + r.msg;
  var x = r.result || {};
  var sg = x.siege || {};
  return 'winner=' + x.winner + '　siege.chip=' + sg.chip + '%　hold余=' + sg.hold + '%　ratio=' + sg.ratio
    + '　公式核对：chip = ' + G.siegeChipOf(sg.ratio, 'assault') + '(攻)/' + G.siegeChipOf(sg.ratio, 'encircle') + '(困)'
    + '　note=' + JSON.stringify(r.schemeNote || x.schemeNote || '');
}
console.log('  强攻占 ' + fB.name + '：' + siegeBrief(r4a));
console.log('  围困占 ' + fC.name + '：' + siegeBrief(r4b));

/* ══════ ⑤ UI 链 ══════ */
console.log('\n══════ ⑤ UI 链：chips 渲染 + lock 判定 ══════');
G.ui._expRes = { kind: 'fort', x: fA.x, y: fA.y };
G.ui._expOps = 'assault';
G.ui._expScheme = null;
var h5 = G.ui.expOpsChipsHTML();
var chips5 = (h5.match(/data-action="exp-ops"/g) || []).length;
console.log('  chip 数=' + chips5 + '（应 3）　含 active 强攻=' + /"[^"]*active[^"]*"[^>]*data-v="assault"|data-v="assault"[^>]*active/.test(h5));
console.log('  无计略时 奇袭 lock=' + JSON.stringify(G.ui.expOpsLockOf('surprise')));
G.ui._expScheme = 'yaoyan';
console.log('  有计略时 奇袭 lock=' + JSON.stringify(G.ui.expOpsLockOf('surprise')));
console.log('  野地目标时 围困 lock=' + JSON.stringify(GAME.opsConfigIssueOf('encircle', { kind: 'wild' }, 'yaoyan')));
console.log('  note=' + G.ui.expOpsNoteHTML().slice(0, 80));

/* ══════ ⑥ 挂起链（观战）══════ */
console.log('\n══════ ⑥ 挂起链：观战挂起 → rec.ops → autoBattle 落账 ══════');
st.settings.battleWatch = true;
delete (st.fortRaids || {})[fA.x + ',' + fA.y];
c0.army = {}; c0.army[TID] = 500000;
hero.status = 'idle'; sta999(hero);
if (G.siegeClear) G.siegeClear({ kind: 'fort', x: fA.x, y: fA.y });
var rd = G.march.dispatch({ kind: 'fort', x: fA.x, y: fA.y }, 'raid', armOf(nSo), hero.id, null, 'encircle');
console.log('  dispatch ok=' + rd.ok + '（' + (rd.msg || '') + '）');
var nT = 0;
while (st.marches.length && nT < 900 && !((st.battles || []).length)) { G.march.tick(); nT++; }
var rec = (st.battles || [])[0];
if (rec) {
  console.log('  挂起 rec.id=' + rec.id + '　rec.ops=' + rec.ops + '（应 encircle）');
  console.log('  rec.sim.scNote=' + JSON.stringify(rec.sim && rec.sim.scNote));
  G.battle.autoBattle(rec.id);
  var jd = G._battleJustDone;
  console.log('  autoBattle → ok=' + (jd && jd.ok) + ' winner=' + (jd && jd.winner)
    + ' rounds=' + (jd && jd.rounds));
  if (jd && jd.report) {
    var bd = jd.report.body || '';
    console.log('  战报含【计谋】行=' + (bd.indexOf('围困') >= 0)
      + '　片段=' + JSON.stringify(bd.replace(/<br>/g, '｜').slice(0, 120)));
  }
} else {
  console.log('  未挂起（marches=' + st.marches.length + '）');
}

console.log('\n完成。');
process.exit(0);
