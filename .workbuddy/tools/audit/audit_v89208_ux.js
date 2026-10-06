/* v89.208 体验梳理 · 交互面盘点（ux）
   承接 v89.206 版（反馈覆盖 77% · 抽查 8 例）→ 本轮把**待复核 75 条一次列全**并附
   "体里首个调用"，可整批判类，不再靠抽样。

   产出：
     ① 动作反馈覆盖（main.js case → 反馈出口）+ 待复核全量清单（带首个调用 + 自动初判）
     ② 提示体系三层 + 纯图标按钮 title 覆盖（v89.207 已补 → 复核）
     ③ 弹窗档位分布 / 反馈出口总量 / 空态覆盖
     ④ 键盘与输入现状
     ⑤ 顶栏页签与入口深度（主界面骨架可点面）

   用法：node .workbuddy/tools/audit/audit_v89208_ux.js
   实机复核另跑：node .workbuddy/tools/show/shot_v89207_gates.js */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
function read(p) { try { return fs.readFileSync(R + p, 'utf8'); } catch (e) { return ''; } }
var MAIN = read('js/main.js'), UI = read('js/ui.js'), HTML = read('index.html');
var MOD = ['data', 'state', 'domain', 'systems', 'tactic', 'battle', 'map', 'ui', 'main', 'icons', 'story'];
var ALLJS = MOD.map(function (f) { return read('js/' + f + '.js'); }).join('\n');
function cnt(re, s) { return (String(s).match(re) || []).length; }

console.log('══════ ① 动作反馈覆盖（main.js case → 反馈出口）══════');
(function () {
  /* case 体切片 —— v89208 修的量尺 bug：
     v89206 版按"下一个 case 标记行"截体，遇到**贯穿标签**（`case 'a':` 换行 `case 'b': {`
     共用一段体）时，`case 'a'` 的体被截成 0 行 → 恒判"无反馈"。上轮报告把这类记为
     "多行 case（脚本误报）"却没说清成因；本轮改成"见到代码后再遇 case 标记才收尾"。 */
  var lines = MAIN.split('\n');
  var marks = [];
  lines.forEach(function (L, i) {
    var m = L.match(/^\s*case '([\w-]+)':/);
    if (m) marks.push({ name: m[1], at: i });
  });
  function isLabel(s) { return /^case '[\w-]+':(\s*\{.*)?$/.test(s) || /^default:/.test(s); }
  var cases = marks.map(function (mk) {
    var end = lines.length, seenCode = false;
    for (var t = mk.at + 1; t < lines.length; t++) {
      var s = lines[t].trim();
      if (isLabel(s) && seenCode) { end = t; break; }
      if (s && !isLabel(s) && !/^\/[/*]/.test(s)) seenCode = true;
    }
    return { name: mk.name, body: lines.slice(mk.at, end).join('\n'), at: mk.at + 1 };
  });
  function bodyOf(fn) {
    var i = MAIN.indexOf('GAME.' + fn + ' = function');
    if (i < 0) return null;
    var j = MAIN.indexOf('\n  };', i);
    return MAIN.slice(i, j > 0 ? j : i + 400);
  }
  /* ui.xxx 的体也要下钻一层 —— `case 'plan-save': ui.expSavePlan();` 的 toast
     在 ui.expSavePlan 里，只递归 GAME.do* 会把它误判成"无反馈"。 */
  function uiBodyOf(fn) {
    var i = UI.indexOf('ui.' + fn + ' = function');
    if (i < 0) return null;
    var j = UI.indexOf('\n  };', i);
    return UI.slice(i, j > 0 ? j : i + 600);
  }
  var FBRE = /toast|notify|moment|openModal|open[A-Z]|refresh|renderView|setView|toggle/;
  var noFb = [], fb = 0;
  cases.forEach(function (c) {
    var ok = FBRE.test(c.body);
    if (!ok) {
      var m = c.body.match(/GAME\.(do\w+)/);
      if (m) { var fb2 = bodyOf(m[1]); if (fb2 && FBRE.test(fb2)) ok = true; }
    }
    if (!ok) {
      var m3 = c.body.match(/ui\.([a-zA-Z]\w*)\s*\(/);
      if (m3) { var fb3 = uiBodyOf(m3[1]); if (fb3 && FBRE.test(fb3)) ok = true; }
    }
    if (ok) { fb++; return; }
    /* 首个调用 = 分类线索（含点链：`GAME.battle.autoBattle` 别只取到 `GAME.battle`） */
    var m2 = c.body.match(/(?:ui|GAME|S|T)\.[\w$]+(?:\.[\w$]+)*\s*\(/g) || [];
    var first = m2.map(function (x) { return x.replace(/\s*\($/, ''); })
      .filter(function (x) { return !/^(ui|GAME)\._/.test(x); }).slice(0, 3).join(' → ');
    /* 自动初判：改视图/重绘/选中态/直接写 DOM = 结果立即可见的"视觉即时类" */
    var vis = /(ui\.(set|render|repaint|paint|toggle|close|zoom|map|scroll|refresh|chip|qty|cg|update)\w*|GAME\.(refresh|setView|renderView)\w*|\.value\s*=|\.innerHTML\s*=|el\.className)/.test(c.body);
    noFb.push({ name: c.name, at: c.at, first: first || '(无调用)', vis: vis });
  });
  console.log('  case 总数 ' + cases.length + ' · 有反馈路径 ' + fb
    + '（' + (fb / cases.length * 100).toFixed(0) + '%）· 待复核 ' + noFb.length);
  var vN = noFb.filter(function (x) { return x.vis; }).length;
  console.log('  待复核中自动初判为"视觉即时类"（改视图/重绘/选中态）… ' + vN
    + ' · 其余需人工判 ' + (noFb.length - vN));
  console.log('  ── 全量待复核清单（名称 · 行 · 首个调用 · 初判）──');
  noFb.forEach(function (x) {
    console.log('     ' + x.name.padEnd(22) + ' 行' + String(x.at).padStart(5) + '  '
      + (x.vis ? '[视]' : '[?] ') + ' ' + x.first);
  });
})();

console.log('\n══════ ② 提示体系三层 + 纯图标按钮 title 覆盖 ══════');
(function () {
  var src = ALLJS + HTML;
  var all = cnt(/data-action="/g, src);
  var withT = cnt(/data-action="[^"]+"[^>]{0,220}?title="/g, src);
  console.log('  data-action 出现 ' + all + ' 次 · 同标签带 title ' + withT
    + '（' + (withT / all * 100).toFixed(0) + '% —— 其余是文字语义自明按钮）');
  console.log('  提示体系：原生 title= ' + cnt(/ title="/g, src) + ' · #tip-layer ' + cnt(/tip-layer/g, src)
    + ' · data-tip-el ' + cnt(/data-tip-el/g, src) + ' · ui.help( ' + cnt(/ui\.help\(/g, src));
  /* 纯图标按钮 = 标签里去掉标签/emoji/空白后无文字 */
  var btns = (src.match(/<button[^>]*>[\s\S]{0,120}?<\/button>/g) || []);
  var iconOnly = btns.filter(function (b) {
    var inner = b.replace(/^<button[^>]*>/, '').replace(/<\/button>$/, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/&[a-z]+;/g, '').trim();
    return inner.length === 0;
  });
  var iconNoTitle = iconOnly.filter(function (b) { return !/ title="/.test(b); });
  console.log('  button 总数 ' + btns.length + ' · 纯图标 ' + iconOnly.length
    + ' · 其中无 title ' + iconNoTitle.length + (iconNoTitle.length ? ' ⚠' : ' ✅'));
  iconNoTitle.slice(0, 10).forEach(function (b) { console.log('     [缺] ' + b.replace(/\s+/g, ' ').slice(0, 90)); });
  console.log('  空态文案（"暂无/空/未…"处理）… ' + cnt(/暂无|空空|还没有|尚未|无可用|没有可|空空如也/g, src));
})();

console.log('\n══════ ③ 弹窗档位 / 反馈出口总量 ══════');
(function () {
  var dist = {};
  (ALLJS.match(/openModal\([^;]{0,240}?'(sm|lg|xxl|xl|md)'/g) || []).forEach(function (x) {
    var m = x.match(/'(sm|lg|xxl|xl|md)'$/); if (m) dist[m[1]] = (dist[m[1]] || 0) + 1;
  });
  console.log('  openModal 调用 ' + cnt(/openModal\(/g, ALLJS) + ' · 显式档位 ' + JSON.stringify(dist));
  console.log('  ui.toast ' + cnt(/ui\.toast\(/g, ALLJS) + ' · ui.notify ' + cnt(/ui\.notify\(/g, ALLJS)
    + ' · ui.moment ' + cnt(/ui\.moment\(/g, ALLJS) + ' · GAME.log ' + cnt(/GAME\.log\(/g, ALLJS)
    + ' · ui.floatGain ' + cnt(/ui\.floatGain\(/g, ALLJS));
  console.log('  弹窗函数 ui.openXxx ' + cnt(/ui\.open[A-Z][\w]* = function/g, UI)
    + ' · 关闭出口 closeModal ' + cnt(/closeModal\(/g, ALLJS));
})();

console.log('\n══════ ④ 键盘与输入 ══════');
(function () {
  var kd = (ALLJS.match(/addEventListener\(\s*'keydown'/g) || []).length;
  console.log('  keydown 监听 ' + kd + ' 处（集中式）· 音效调用 ' + cnt(/playSfx|ui\.sfx\(/g, ALLJS));
  /* 数字键 1-9 与 Esc 是否在册 */
  var mi = MAIN.indexOf("addEventListener('keydown'");
  var seg = MAIN.slice(mi, mi + 2400);
  /* 口径：Esc 认 `Escape` 字面；数字键认 `parseInt(e.key` —— 别认 `[1-9]`（实现里
     写的是 `_n207 >= 1 && _n207 <= 9`，用字符类会漏判成"未见"，v89208 首跑就踩了这坑）。 */
  console.log('  Esc 关弹窗 ' + (/Escape/.test(seg) ? '在册 ✅' : '未见 ⚠')
    + ' · 数字键 1-9 切视图 ' + (/parseInt\(\s*e\.key/.test(seg) ? '在册 ✅（与顶栏 setView 同出口）' : '未见 ⚠'));
  console.log('  文本输入框 input ' + cnt(/<input/g, ALLJS + HTML)
    + '（其中 type="text" ' + cnt(/type="text"/g, ALLJS + HTML) + ' —— 玩家可控文本面）');
})();

console.log('\n══════ ⑤ 顶栏页签与主界面骨架 ══════');
(function () {
  var tabs = (HTML.match(/<div[^>]*data-view="[\w-]+"[\s\S]{0,200}?<\/div>/g) || []).map(function (x) {
    var v = (x.match(/data-view="([\w-]+)"/) || [])[1] || '?';
    var label = x.replace(/<span[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').trim();
    return v + '「' + label + '」';
  });
  console.log('  index.html 顶栏页签 ' + tabs.length + ' 个：' + tabs.join(' · '));
  console.log('  骨架静态 data-action ' + cnt(/data-action="/g, HTML) + ' 个 · 底栏/导航按钮 data-nav '
    + cnt(/data-nav="/g, HTML) + ' 个');
})();
