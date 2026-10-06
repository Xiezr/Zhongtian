/* v89.209 探针：v89.208 评估缺陷链修复 —— 改前基线 / 改后对照（同一支探针跑两遍）
   ============================================================
   v89.208 评估（并发会话）实证的三个缺陷：
     ① importText 只验"cities 是非空数组" → [{}]/[null]/5000×{}/generals:'oops'/map:null 全放行
     ② adoptState 首行即 GAME.state = st → 中途抛错留半迁移态（loadFrom 吞异常返回 null）
     ③ generals 非数组 → nextGenId 崩 → 连「新游戏」都开不了
   本探针按**目标态**写断言：改前跑 → 红（拿到基线）；补丁后跑 → 全绿。
   防御式写法（改前 saveShapeChk 不存在也不崩）。
   ------------------------------------------------------------
   运行：node .workbuddy/tools/probe/probe_v892209_import.js   （输出重定向到文件再读） */
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra == null ? '' : extra) + ']'); }
}

var H209 = (typeof G.saveShapeChk === 'function');
console.log('saveShapeChk 在册 = ' + H209);

function withState(tag, fn) {
  var bk = G.state;
  try { fn(); } catch (e) {
    FAIL++; console.log('  ✗ ' + tag + ' [section crash] ' + (e && e.message));
  } finally { G.state = bk; }
}
function freshPayload() {
  G.newGame({ name: 'v209tmp', cityName: '许都' });
  return JSON.parse(G.savePayload());
}
function packOf(st, withCheck) {
  var p = { _fmt: G.SAVE_FMT, _ver: 3, state: st };
  if (withCheck) p._check = G.checksum(JSON.stringify(st));
  return JSON.stringify(p);
}

/* ══════════ ① 形状抽检矩阵（saveShapeChk 直调） ══════════ */
console.log('\n=== ① 形状抽检矩阵（saveShapeChk 直调）===');
withState('①', function () {
  var GOOD = freshPayload();
  function mk(mut) { var x = JSON.parse(JSON.stringify(GOOD)); mut(x); return x; }
  var r;
  r = H209 ? G.saveShapeChk(mk(function (x) { x.cities = [{}]; })) : null;
  chk('①a cities=[{}] → 拒（报"城池"）', !!r && r.ok === false && /城池/.test(r.msg), r && r.msg);
  r = H209 ? G.saveShapeChk(mk(function (x) { x.cities = [null]; })) : null;
  chk('①b cities=[null] → 拒', !!r && r.ok === false, r && r.msg);
  r = H209 ? G.saveShapeChk(mk(function (x) { x.generals = 'oops'; })) : null;
  chk('①c generals:"oops" → 拒（报"将领"）', !!r && r.ok === false && /将领/.test(r.msg), r && r.msg);
  r = H209 ? G.saveShapeChk(mk(function (x) { x.generals = [null]; })) : null;
  chk('①d generals=[null] → 拒', !!r && r.ok === false, r && r.msg);
  r = H209 ? G.saveShapeChk(mk(function (x) { x.map = null; })) : null;
  chk('①e map=null → 拒（报"地图"）', !!r && r.ok === false && /地图/.test(r.msg), r && r.msg);
  r = H209 ? G.saveShapeChk(GOOD) : null;
  chk('①f 真档 → 通过（合法零误杀）', !!r && r.ok === true, r && r.msg);
});

/* ══════════ ② importText 真调（坏档两形态全拒 · 真档仍通） ══════════ */
console.log('\n=== ② importText 真调 ===');
withState('②', function () {
  var GOOD = freshPayload();
  function mk(mut) { var x = JSON.parse(JSON.stringify(GOOD)); mut(x); return x; }
  var bads = [
    ['cities=[{}]', mk(function (x) { x.cities = [{}]; })],
    ['cities=[null]', mk(function (x) { x.cities = [null]; })],
    ['cities=5000×{}', (function () { var x = mk(function () { }); x.cities = new Array(5000); for (var i = 0; i < 5000; i++) x.cities[i] = {}; return x; })()],
    ['generals=oops', mk(function (x) { x.generals = 'oops'; })],
    ['map=null', mk(function (x) { x.map = null; })],
  ];
  var acc = [];
  [true, false].forEach(function (wc) {
    bads.forEach(function (c) {
      var r2 = null;
      try { r2 = G.importText(packOf(c[1], wc), 's3'); } catch (e) { r2 = { ok: 'THREW', msg: e.message }; }
      if (!r2 || r2.ok !== false || r2.msg === 'THREW') acc.push(c[0] + '/' + (wc ? '含校验和' : '省略校验和') + '→' + JSON.stringify(r2 && r2.msg).slice(0, 40));
    });
  });
  chk('②a 5 类坏档 × 两形态（10 发）全部拒绝', acc.length === 0, acc.slice(0, 3).join(' | '));
  var rok = G.importText(packOf(GOOD, true), 's3');
  var rok2 = G.importText(packOf(GOOD, false), 's3');
  chk('②b 真档（含校验和 / 省略校验和）仍通过', rok.ok === true && rok2.ok === true, (rok.msg || '') + ' · ' + (rok2.msg || ''));
  G.dropSlot('s3');
});

/* ══════════ ③ adoptState 原子性 ══════════ */
console.log('\n=== ③ adoptState 原子性（读路径同闸 + 回滚）===');
withState('③', function () {
  G.newGame({ name: 'v209c1', cityName: '许都' });
  var goodRef = G.state;
  var badA = JSON.parse(JSON.stringify(goodRef));
  badA.cities = [{}];
  var threwA = false;
  try { G.adoptState(badA); } catch (e) { threwA = true; }
  chk('③a 形状坏档 → 抛 + GAME.state 完全未动（早拒）', threwA && G.state === goodRef,
    'threw=' + threwA + ' sameRef=' + (G.state === goodRef));

  G.newGame({ name: 'v209c2', cityName: '许都' });
  var goodRef2 = G.state;
  var badB = JSON.parse(G.savePayload());
  badB.queues.train = 'oops';            /* 形状抽检放行（queues 不在检查面）→ 深链中途崩 */
  var threwB = false;
  try { G.adoptState(badB); } catch (e) { threwB = true; }
  chk('③b 深链中途崩 → 抛 + 回滚到原对象（不留半迁移）',
    threwB && G.state === goodRef2 && G.state !== badB
    && !!(G.state.cities && G.state.cities.length === goodRef2.cities.length),
    'threw=' + threwB + ' sameRef=' + (G.state === goodRef2) + ' leaked=' + (G.state === badB));

  G.newGame({ name: 'v209c3', cityName: '许都' });
  var okC = null, errC = null;
  try { okC = G.adoptState(JSON.parse(G.savePayload())); } catch (e) { errC = e.message; }
  chk('③c 正常读档路径不受影响（返回对象 + cities 在）',
    !errC && !!okC && !!okC.cities && okC.cities.length >= 1, errC || ('cities=' + (okC && okC.cities && okC.cities.length)));
});

/* ══════════ ④ syncSeq / nextGenId 守卫 ══════════ */
console.log('\n=== ④ syncSeq / nextGenId 守卫 ===');
withState('④', function () {
  G.newGame({ name: 'v209d', cityName: '许都' });
  G.state.inn = {};                      /* 隔离候选池（否则 max 会被 cdN 候选抬高） */
  G.state.generals = 'oops';
  var maxD = null, idD = null, errD = null;
  try { maxD = G.syncSeq(); idD = G.nextGenId(); } catch (e) { errD = String(e && e.message); }
  chk('④a generals=oops：不崩 · syncSeq=0 · 发号可用', errD === null && maxD === 0 && /^g\d+$/.test(idD || ''),
    errD || ('max=' + maxD + ' id=' + idD));

  G.state.generals = [null, { id: 'g7', name: 'x', level: 1 }];
  var maxE = null, errE = null;
  try { maxE = G.syncSeq(); } catch (e) { errE = String(e && e.message); }
  chk('④b generals=[null, g7]：跳过 null · max=7', errE === null && maxE === 7, errE || ('max=' + maxE));
});

/* ══════════ ⑤ 真档形状往返（合法零误杀 · 双形态） ══════════ */
console.log('\n=== ⑤ 真档形状往返 ===');
withState('⑤', function () {
  var payload = freshPayload();
  var r1 = H209 ? G.saveShapeChk(payload) : null;
  chk('⑤a savePayload 产物 → 通过', !!r1 && r1.ok === true, r1 && r1.msg);
  var adopted = null, err5 = null;
  try { adopted = G.adoptState(JSON.parse(G.savePayload())); } catch (e) { err5 = e.message; }
  var r2 = H209 && adopted ? G.saveShapeChk(adopted) : null;
  chk('⑤b adoptState 后形态 → 仍通过', !!r2 && r2.ok === true, err5 || (r2 && r2.msg));
});

/* ══════════ ⑥ 连锁解开：坏 generals 也不挡「新游戏」 ══════════ */
console.log('\n=== ⑥ 新游戏连锁 ===');
withState('⑥', function () {
  G.newGame({ name: 'v209f', cityName: '许都' });
  G.state.generals = 'oops';
  var errF = null;
  try { G.newGame({ name: 'v209f2', cityName: '许都' }); } catch (e) { errF = String(e && e.message); }
  chk('⑥ generals 非数组时「新游戏」仍可开（守卫兜住）', errF === null, errF || '');
});

/* ══════════ ⑦ 真档导入→读回（门不误伤合法档） ══════════ */
console.log('\n=== ⑦ 真档导入→读回 ===');
withState('⑦', function () {
  var GOOD = freshPayload();
  var r = G.importText(packOf(GOOD, true), 's3');
  var lr = r.ok ? G.loadFrom('s3') : null;
  chk('⑦ 导入→读回 全链通（cities 在 · 形状再次通过）', r.ok === true && !!lr && lr.cities.length >= 1
    && (!H209 || G.saveShapeChk(lr).ok === true), r.msg);
  G.dropSlot('s3');
});

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(0);
