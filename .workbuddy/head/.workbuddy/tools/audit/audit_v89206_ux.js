/* v89.206 体验梳理 · 交互面盘点脚本（ux）
   ① 动作反馈覆盖：main.js 全部 case → 是否引到 反馈出口（toast/notify/moment/openXxx/refresh）
   ② 悬停提示覆盖：data-action 按钮带 title 的比例
   ③ 弹窗尺寸档位分布 ④ 键盘/提示层/反馈总量
   用法：node .workbuddy/tools/audit/audit_v89206_ux.js（输出重定向再读） */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
function read(p) { try { return fs.readFileSync(R + p, 'utf8'); } catch (e) { return ''; } }
var MAIN = read('js/main.js'), UI = read('js/ui.js'), HTML = read('index.html');
var ALLJS = ['data', 'state', 'domain', 'systems', 'tactic', 'battle', 'map', 'ui', 'main']
  .map(function (f) { return read('js/' + f + '.js'); }).join('\n');
function cnt(re, s) { return (String(s).match(re) || []).length; }

console.log('══════ ① 动作反馈覆盖（main.js case → 反馈出口）══════');
(function () {
  var lines = MAIN.split('\n');
  var marks = [];
  lines.forEach(function (L, i) {
    var m = L.match(/^\s*case '([\w-]+)':/);
    if (m) marks.push({ name: m[1], at: i });
  });
  var cases = marks.map(function (mk, k) {
    var end = (k + 1 < marks.length) ? marks[k + 1].at : Math.min(lines.length, mk.at + 40);
    return { name: mk.name, body: lines.slice(mk.at, end).join('\n'), at: mk.at + 1 };
  });
  /* doXxx 定义体（main.js 内）*/
  function bodyOf(fn) {
    var i = MAIN.indexOf('GAME.' + fn + ' = function');
    if (i < 0) return null;
    var j = MAIN.indexOf('\n  };', i);
    return MAIN.slice(i, j > 0 ? j : i + 400);
  }
  var noFb = [], fb = 0;
  cases.forEach(function (c) {
    var b = c.body;
    var ok = /toast|notify|moment|openModal|open[A-Z]|refresh|renderView|setView|toggle/.test(b);
    if (!ok) {
      var m = b.match(/GAME\.(do\w+)/);
      if (m) {
        var fb2 = bodyOf(m[1]);
        if (fb2 && /toast|notify|moment|openModal|open[A-Z]|refresh|renderView|setView/.test(fb2)) ok = true;
      }
    }
    if (ok) fb++; else noFb.push(c.name + ' (行' + c.at + ')');
  });
  console.log('  case 总数 ' + cases.length + ' · 有反馈路径 ' + fb
    + '（' + (fb / cases.length * 100).toFixed(0) + '%）· 待复核 ' + noFb.length);
  noFb.slice(0, 40).forEach(function (x) { console.log('    [待复核] ' + x); });
})();

console.log('\n══════ ② 悬停提示覆盖（data-action 按钮带 title 比例）══════');
(function () {
  var src = ALLJS + HTML;
  var all = cnt(/data-action="/g, src);
  var withT = cnt(/data-action="[^"]+"[^>]{0,220}?title="/g, src);
  console.log('  data-action 总数 ' + all + ' · 同标签带 title ' + withT
    + '（' + (withT / all * 100).toFixed(0) + '% · 其余由无 title 但语义自明/或悬停体系承担）');
  console.log('  提示体系：#tip-layer ' + cnt(/tip-layer/g, src) + ' · data-tip-el ' + cnt(/data-tip-el/g, src)
    + ' · 原生 title= ' + cnt(/ title="/g, src));
})();

console.log('\n══════ ③ 弹窗尺寸档位分布 ══════');
(function () {
  var dist = {};
  (ALLJS.match(/openModal\([^;]{0,240}?'(sm|lg|xxl|xl|md)'/g) || []).forEach(function (x) {
    var m = x.match(/'(sm|lg|xxl|xl|md)'$/); if (m) dist[m[1]] = (dist[m[1]] || 0) + 1;
  });
  var dist2 = {};
  (ALLJS.match(/openModal\(/g) || []).forEach(function () { dist2['总'] = (dist2['总'] || 0) + 1; });
  console.log('  openModal 调用总 ' + (dist2['总'] || 0) + ' · 显式档位：' + JSON.stringify(dist));
})();

console.log('\n══════ ④ 反馈出口总量（js/ 全量）══════');
(function () {
  console.log('  ui.toast … ' + cnt(/ui\.toast\(/g, ALLJS)
    + ' · ui.notify … ' + cnt(/ui\.notify\(/g, ALLJS)
    + ' · ui.moment … ' + cnt(/ui\.moment\(/g, ALLJS)
    + ' · GAME.log … ' + cnt(/GAME\.log\(/g, ALLJS));
  console.log('  键盘监听 keydown … ' + cnt(/addEventListener\('keydown'/g, ALLJS)
    + ' · 音效 audio … ' + cnt(/playSfx|Audio\(/g, ALLJS));
})();

console.log('\n══════ ⑤ 入口深度采样（主界面 → 关键面板的点击链）══════');
(function () {
  var navs = cnt(/data-action="(open|nav)[\w-]*"/g, ALLJS + HTML);
  console.log('  主界面直达类按钮（open-/nav-）总数 ' + navs);
  var panels = (ALLJS.match(/ui\.open[A-Z][\w]* = function/g) || [])
    .map(function (x) { return x.replace(/ui\./, '').replace(/ = function/, ''); });
  console.log('  ui.openXxx 面板函数 ' + panels.length + ' 个');
})();
