/* ============================================================
 * audit_v89116_refs.js — **"引用了不存在的成员"** 静态审计
 * ------------------------------------------------------------
 * 来历：v89.116 抓出一个活了很多版本的 bug ——
 *   `var g = GAME.guardOf ? GAME.guardOf(city) : null;`
 *   `GAME.guardOf` **根本不存在**（真名 guardGeneralOf），
 *   而三元判断把"函数不存在"这件事**静默吞掉**（永远 null）：
 *   守将不进守城战斗、战报永远写"（无守将）"、防守体检那列恒为"未任命"。
 * 这类 bug 的死角：语法通过、测试通过（没人断言"守将该出现"）、只在观感上体现。
 *
 * 判据：扫描 js/*.js 里出现的 `GAME.<ident>` / `DATA.<ident>` / `U.<ident>`，
 * 若该 ident 在全仓**从未被定义**（`GAME.x =` / `GAME.x:` / `x:` 在对象里），
 * 则报"疑似拼错 / 未接线"。带白名单（动态挂载、测试桩、外部注入）。
 * 用法：node .workbuddy/tools/audit/audit_v89116_refs.js
 * 退出码：0 = 干净；1 = 有疑似未定义引用。
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var FILES = ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic',
  'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'];

/* 白名单：动态挂载 / 测试或工具注入 / 平台/浏览器提供 / 本项目约定的外部注入点 */
var OK = {
  GAME: ['icons', 'bitmaps', 'portraits', 'gicons', 'ui', 'utils', 'DATA', 'state', 'story',
    'tactic', 'battle', 'map', 'systems', 'SG', '_bsess', '_battleSeq', '_battleJustDone',
    '_realNowOf', 'onLog', 'action', 'refreshAll', 'refreshView', 'newGame', 'adoptState'],
  DATA: [],
  U: [],
};
/* 额外白名单：这些名字可能是"运行期由别处挂上"的（列出并注明原因） */
var EXTRA = {
  'GAME.icons': 'icons.js 挂载', 'GAME.bitmaps': 'bitmaps.js 挂载',
  /* v89.141（复核）：与主 audit.js 的同名白名单**对齐**（此前两版不一致 ——
     单跑版把"故意不定义"的注入点报成了"疑似拼错"，主 audit 反而不报，容易误伤） */
  'GAME.onLog': '试玩工具挂的钩子（tools/playtest/*.js 里 G.onLog = …）',
  'GAME._realNowOf': '测试拨钟钩子（smoke/e2e 覆写它把"现实时间"固定住）',
};

function stripComment(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}
var src = {};
var all = '';
FILES.forEach(function (f) {
  var p = path.join(R, 'js', f + '.js');
  src[f] = stripComment(fs.readFileSync(p, 'utf8'));
  all += src[f] + '\n';
});

/* 定义面：`X.name =` / `X.name:` / `name:`（对象字面量里的键）/ `function name(`
   —— 宽松收集，宁可漏报也不误报（这是"防拼错"审计，不是接口检查） */
function defines(ns, name) {
  var pats = [
    new RegExp('\\b' + ns + '\\.' + name + '\\s*='),
    new RegExp('\\b' + ns + '\\.' + name + '\\s*:'),
    new RegExp('[\\{,\\s]' + name + '\\s*:'),
    new RegExp('\\b' + name + '\\s*=[^=]'),
    new RegExp('function\\s+' + name + '\\s*\\('),
  ];
  for (var i = 0; i < pats.length; i++) if (pats[i].test(all)) return true;
  return false;
}

var bad = [], checked = 0;
['GAME', 'DATA', 'U'].forEach(function (ns) {
  var seen = {};
  var re = new RegExp('\\b' + ns + '\\.([A-Za-z_$][\\w$]*)', 'g'), m;
  while ((m = re.exec(all)) !== null) {
    var name = m[1];
    if (seen[name]) continue;
    seen[name] = 1;
    checked++;
    if ((OK[ns] || []).indexOf(name) >= 0) continue;
    if (!defines(ns, name)) bad.push(ns + '.' + name);
  }
});
console.log('引用点去重后 ' + checked + ' 个成员名（GAME/DATA/U 三命名空间）');
if (bad.length) {
  console.log('\n⚠ 疑似"引用了不存在的成员"（拼错 / 未接线）共 ' + bad.length + ' 个：');
  bad.forEach(function (b) {
    /* 打印首个出现位置，便于定位 */
    var hits = [];
    FILES.forEach(function (f) {
      var i = src[f].indexOf(b);
      if (i >= 0 && hits.length < 2) hits.push(f + '.js:' + (src[f].slice(0, i).split('\n').length));
    });
    console.log('   ' + b + '　' + hits.join(' · '));
  });
  process.exit(1);
}
console.log('✅ 未发现"引用了不存在的成员"');
process.exit(0);
