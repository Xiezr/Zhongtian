/* 性能探针：把 smoke-test.js 截成"前 N 段"并在 newGame/ensure 上装计时钩子，
 * 用来回答"时间到底花在哪"。不改原文件，产物是仓库根的 .tmp_smoke_head.js
 * （必须放仓库根：smoke 内部用 __dirname 找 js/）。
 *
 * 用法：
 *   node .workbuddy/tools/prof/gen_head_prof.js [截止段号=60]
 *   node .tmp_smoke_head.js > .workbuddy/tmp_head_prof.out 2>&1
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..', '..');      /* .workbuddy/tools/prof → 仓库根 */
var STOP = parseInt(process.argv[2] || '60', 10);

var src = fs.readFileSync(path.join(ROOT, 'smoke-test.js'), 'utf8').split('\n');

/* 切点：第 STOP 段之前最后一个顶层 IIFE 收尾（`  })();`） */
var cut = null;
var re = new RegExp('===== ' + STOP + '\\. ');
for (var i = 0; i < src.length; i++) {
  if (re.test(src[i])) break;
  if (src[i] === '  })();') cut = i;
}
if (cut == null) { console.error('找不到切点'); process.exit(1); }
var head = src.slice(0, cut + 1);

/* 装钩子：newGame / ensure / 各段耗时 */
var hookIdx = -1;
for (var j = 0; j < head.length; j++) {
  if (head[j].indexOf("require('./js/bundle-ui.js')") >= 0) { hookIdx = j; break; }
}
if (hookIdx < 0) { console.error('找不到 bundle 载入行'); process.exit(1); }
head.splice(hookIdx + 1, 0,
  '  /* [prof] 计时钩子（由 gen_head_prof.js 注入） */',
  '  var _pN = 0, _pT = 0, _pSeeds = {}, _pSpT = 0, _pSecT = 0, _pSecT0 = Date.now();',
  '  var _pOrig = GAME.newGame;',
  '  GAME.newGame = function (o) {',
  '    var _a = Date.now();',
  '    var _s = (o && o.mapSeed != null) ? String(o.mapSeed) : "(random)";',
  '    _pSeeds[_s] = (_pSeeds[_s] || 0) + 1;',
  '    var _r = _pOrig.apply(GAME, arguments);',
  '    _pT += Date.now() - _a; _pN++; return _r;',
  '  };',
  '  [GAME.sphere, GAME.mapSphere].forEach(function (sp) {',
  '    if (!sp || !sp.ensure) return;',
  '    var oe = sp.ensure;',
  '    sp.ensure = function () { var a = Date.now(); var r = oe.apply(sp, arguments); _pSpT += Date.now() - a; return r; };',
  '  });'
);

head.push("  var _pk = Object.keys(_pSeeds);");
head.push("  console.log('[prof] newGame=' + _pN + ' 次 · 累计 ' + (_pT / 1000).toFixed(1) + 's'");
head.push("    + ' · 不同种子=' + _pk.length + ' · 可复用次数=' + (_pN - _pk.length)");
head.push("    + ' · sphere.ensure 累计=' + (_pSpT / 1000).toFixed(1) + 's');");
head.push("  console.log('[prof] 种子前 8：' + _pk.slice(0, 8).map(function (k) { return k + 'x' + _pSeeds[k]; }).join('  '));");
head.push("  console.log('结果(截断段)');");
head.push('  process.exit(FAIL ? 1 : 0);');
head.push('})();');

var out = path.join(ROOT, '.tmp_smoke_head.js');
fs.writeFileSync(out, head.join('\n'), 'utf8');
console.log('已生成 ' + out + '（' + head.length + ' 行，截止第 ' + STOP + ' 段）');
