/* v89.198 探针：战法玩法全撤（行为级）· 管理弹窗统一行 · 出征备注四项 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
function modalHTML() {
  var root = null;
  try { root = global.document.querySelector('#modal-root'); } catch (e) { root = null; }
  return (root && root.innerHTML) || '';
}

console.log('══════ ① 战法全撤：数据 / 出口 / 签名 ══════');
chk('DATA.OPS 已退役', G.DATA.OPS === undefined);
chk('ops 出口已退役（opsIdOf/opsOf/opsConfigIssueOf）',
  typeof G.opsIdOf === 'undefined' && typeof G.opsOf === 'undefined' && typeof G.opsConfigIssueOf === 'undefined');
chk('siegeChipOf 单参 / dispatch 六参', G.siegeChipOf.length === 1 && G.march.dispatch.length === 6,
  'chip=' + G.siegeChipOf.length + ' dispatch=' + G.march.dispatch.length);
chk('SIEGE 战法系数零残留', DATA.SIEGE.encircle === undefined && DATA.SIEGE.surprise === undefined);

console.log('══════ ② 真打一场（据点）：战报无战法痕迹 ══════');
G.newGame({ name: 'probe198', cityName: '许都', region: '碎垣', mapSeed: 20260932 });
var st = G.state;
if (!st.map.grid) G.map.generate();
st.world.weather = 'clear';
var c0 = st.cities[0];
st.settings = st.settings || {};
st.settings.battleWatch = false;
G.ui._cityId = c0.id;
var ft = null;
for (var y = 0; y < 220 && !ft; y++) {
  for (var x = 0; x < 220 && !ft; x++) {
    var f = G.map.fortAt(x, y);
    if (f && f.level <= 3) ft = f;
  }
}
chk('找到低阶据点', !!ft, ft ? (ft.name + ' Lv' + ft.level) : '—');
var hero = G.makeGeneral('探198', 80, 'idle', c0.id, false, 'ming', 'balance');
st.generals.push(hero);
G.setStaNow(hero, G.staMax(hero)); hero.energy = 999;
c0.army = { qingji: 500000 };
var rr = G.battle.expedition({ kind: 'fort', x: ft.x, y: ft.y }, 'raid', { qingji: 2000 }, hero.id, {});
var rep = st.reports && st.reports[0];
var body = rep ? rep.body : '';
chk('即时结算出报告', !!rep && !!rr);
chk('战报无【战法】/「围困」/「奇袭」',
  body.indexOf('【战法】') < 0 && body.indexOf('围困') < 0 && body.indexOf('奇袭') < 0,
  'len=' + body.length);

console.log('══════ ③ 旧 ops 参数零效果（前向兼容） ══════');
/* ② 的掠夺已把 ft 标记为「今日已掠夺」——对照用**另一座据点**（ft2） */
var ft2 = null;
for (var y2 = 0; y2 < 220 && !ft2; y2++) {
  for (var x2 = 0; x2 < 220 && !ft2; x2++) {
    var f2 = G.map.fortAt(x2, y2);
    if (f2 && !(f2.x === ft.x && f2.y === ft.y)) ft2 = f2;
  }
}
chk('找到第二座据点（对照用）', !!ft2, ft2 ? (ft2.name + ' Lv' + ft2.level) : '—');
c0.army = { qingji: 500000 };
hero.status = 'idle'; G.setStaNow(hero, G.staMax(hero)); hero.energy = 999;
st.marches = [];
var d1 = G.march.dispatch({ kind: 'fort', x: ft2.x, y: ft2.y }, 'raid', { qingji: 100 }, hero.id, null);
var t1 = d1.ok ? st.marches[0].totalTime : -1;
var r1ok = d1.ok;
var recOps1 = d1.ok ? String(st.marches[0].ops) : 'no';
st.marches = [];
hero.status = 'idle'; G.setStaNow(hero, G.staMax(hero)); hero.energy = 999;
var d2 = G.march.dispatch({ kind: 'fort', x: ft2.x, y: ft2.y }, 'raid', { qingji: 100 }, hero.id, null, 'encircle');
var t2 = d2.ok ? st.marches[0].totalTime : -2;
var recOps2 = d2.ok ? String(st.marches[0].ops) : 'no';
st.marches = [];
chk('旧参不拦截 / 不加时长 / 不入档',
  r1ok && d2.ok && t1 > 0 && t1 === t2 && recOps1 === 'undefined' && recOps2 === 'undefined',
  't1=' + t1 + ' t2=' + t2 + ' ops=' + recOps1 + (d1.ok ? '' : (' msg=' + d1.msg)));

console.log('══════ ④ 军师估算只读计略 ══════');
G.ui._expRes = { kind: 'fort', x: 10, y: 10, garrison: { yibing: 1000 }, def: 0 };
G.ui._expScheme = null;
var m0 = G.ui.expDefModsOf();
G.ui._expScheme = 'yaoyan';
var m1 = G.ui.expDefModsOf();
G.ui._expScheme = 'huoshao';
var m2 = G.ui.expDefModsOf();
G.ui._expScheme = null;
chk('无计略=1 · 妖言守军0.85 · 火烧城防折',
  m0.garrisonMul === 1 && m0.notes.length === 0
  && Math.abs(m1.garrisonMul - 0.85) < 1e-9 && Math.abs(m1.wallMul - 1) < 1e-9
  && m2.wallMul < 1 && m2.garrisonMul === 1,
  'm1=' + m1.garrisonMul.toFixed(3) + ' m2wall=' + m2.wallMul.toFixed(3));

console.log('══════ ⑤ 出征面板：备注四项（真渲染） ══════');
c0.army = { qingji: 3000 };
G.ui.closeAllModals();
G.ui.openExpModal({ kind: 'wild', x: c0.x + 3, y: c0.y + 2 });
var html = modalHTML();
var mVital = html.match(/id="exp-gen-vital"/);
var genOk5 = !!(G.ui._expGen && (st.generals || []).some(function (g) { return g.id === G.ui._expGen; }));
chk('无 #exp-ops / 无「锦囊 ×」/ 无「阵位 」',
  html.indexOf('id="exp-ops"') < 0 && html.indexOf('锦囊 ×') < 0 && html.indexOf('阵位 ') < 0,
  'len=' + html.length);
chk('主将栏「精力/体力」行骨架在册（内容填充由实机验）', !!mVital && genOk5,
  'vital=' + !!mVital + ' gen=' + G.ui._expGen);
chk('目标栏「相称建议」在册', /相称建议/.test(html),
  (html.match(/相称建议[^<]{0,30}/) || [''])[0]);
G.ui.closeAllModals();

console.log('══════ ⑥ 管理弹窗：统一行（真渲染） ══════');
G.ui.openAutoMarch();
var html2 = modalHTML();
var labs = (html2.match(/class="exp-lab">[^<]+</g) || []).map(function (s) {
  return s.replace('class="exp-lab">', '').replace('<', '');
});
var need = ['执行将领', '目标类型', '目标等级', '搜索距离', '出征方式', '计略', '出征战术', '出征频率', '每日上限'];
chk('9 个名称列齐备', need.every(function (n) { return labs.indexOf(n) >= 0; }), labs.join(','));
chk('无 am-tac-sum / 无「阵位 」/ 战术行含设置链',
  html2.indexOf('am-tac-sum') < 0 && html2.indexOf('阵位 ') < 0
  && html2.indexOf('data-action="open-tactic-set"') >= 0);
G.ui.closeAllModals();

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
