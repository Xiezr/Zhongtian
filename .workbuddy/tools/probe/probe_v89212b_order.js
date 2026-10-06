/* v89.212（老板 2）：出征界面左侧行序 —— 目标 → 主将 → 出征方式 → 出征方案 → 出征战术 → 出征计略 → 可用道具。
   目标态探针：读 ui.openExpModal 源码，dump `.exp-quad` 之后的模块顺序。改前红 / 改后绿。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var uS = fs.readFileSync(path.join(R, 'js/ui.js'), 'utf8');

var PASS = 0, FAIL = 0;
function chk(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + name); }
  else { FAIL++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

/* 截 openExpModal 函数体（到下一个顶层 ui.xxx = function 为止） */
var i0 = uS.indexOf('ui.openExpModal = function');
var i1 = uS.indexOf('\n  ui.', i0 + 30);
var exp = uS.slice(i0, i1 > 0 ? i1 : i0 + 40000);

var q = exp.indexOf('class="exp-quad"');
console.log('=== 出征面板：模块出现顺序（源码级）===');
var order = ['exp-a-target', 'exp-a-gen', 'exp-a-modes', 'exp-a-plan', 'exp-a-tacmenu', 'exp-a-tactic', 'exp-a-items'];
var pos = {};
order.forEach(function (k) { pos[k] = exp.indexOf(k, k === 'exp-a-target' ? 0 : 0); });
console.log('    ' + order.map(function (k) { return k + '@' + pos[k]; }).join('  '));

/* 目标序（老板 2）：目标 < 主将 < 出征方式 < 方案 < 战术 < 计略 < 可用道具 */
var want = ['exp-a-target', 'exp-a-gen', 'exp-a-modes', 'exp-a-plan', 'exp-a-tacmenu', 'exp-a-tactic', 'exp-a-items'];
var good = true, last = -1, seq = [];
for (var i = 0; i < want.length; i++) {
  var p = exp.indexOf(want[i]);
  seq.push(want[i] + '@' + p);
  if (p < 0 || p < last) good = false;
  last = p;
}
console.log('    顺序：' + seq.join(' → '));
chk('① 七模块齐备且在册', want.every(function (k) { return exp.indexOf(k) >= 0; }), seq.join(','));
chk('② 相对顺序 = 目标→主将→出征方式→方案→战术→计略→可用道具', good, seq.join(','));
chk('③ 计略在出征战术之后（v89.212 老板令）',
  exp.indexOf('exp-a-tactic') > exp.indexOf('exp-a-tacmenu'));
chk('④ 出征方式在方案之前',
  exp.indexOf('exp-a-modes') < exp.indexOf('exp-a-plan'));

console.log('');
console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
