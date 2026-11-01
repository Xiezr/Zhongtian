/* v156.27：把 ui.js 拆出的 18 个文件接进**所有模块清单**。
 *
 * 要同步四处（漏一处就出问题）：
 *   · build_bundle.py 的 ORDER（构建顺序 = 运行时定义顺序）
 *   · build_bundle.py 的 UI（分包归属 —— 漏了会落到 core 包里）
 *   · smoke-test.js 的两处"源码静态检查"列表（$ / U / DATA 的声明检查）
 *     ⛔ 漏这处最危险：它们逐文件读源码找"用了没声明"，
 *        只扫 18 行的 ui.js 会让覆盖率暴跌，历史红变成**假绿**。
 *   · smoke-test.js 的两处 ORDER（构建 hash 的复算口径）
 *
 * 用法：node .workbuddy/tools/patch/patch_ui_order.js
 */
'use strict';
var fs = require('fs');

var UI_SPLIT = [
  'ui-fx', 'ui-core', 'ui-modal', 'ui-shell', 'ui-battle', 'ui-city', 'ui-army',
  'ui-bag', 'ui-craft', 'ui-view', 'ui-build', 'ui-planet', 'ui-space',
  'ui-delve', 'ui-mapui', 'ui-exped', 'ui-report', 'ui-config'
];

/* ---------- 1) build_bundle.py ---------- */
(function () {
  var p = '.workbuddy/tools/patch/build_bundle.py';
  var s = fs.readFileSync(p, 'utf8');
  if (s.indexOf("'ui-fx'") >= 0) { console.log('SKIP build_bundle.py'); return; }

  /* ORDER 尾部：'story', 'ui', 'main']  → 展开 */
  var oldOrder = "         'story', 'ui', 'main']";
  if (s.indexOf(oldOrder) < 0) {
    oldOrder = "'story', 'ui', 'main']";
  }
  if (s.indexOf(oldOrder) < 0) { console.error('✗ build ORDER anchor'); process.exit(1); }
  var newOrder = "         'story', 'ui',\n"
    + UI_SPLIT.map(function (n, i) {
      return "         " + (i === 0 ? '' : '') + "'" + n + "'" + (n === UI_SPLIT[UI_SPLIT.length - 1] ? ',' : ',');
    }).join('\n')
    + "\n         'main']";
  s = s.replace(oldOrder, newOrder);

  /* UI 分包 */
  var oldUI = "UI = ['story', 'ui', 'duel3d', 'map3d', 'scene3d', 'main']";
  if (s.indexOf(oldUI) < 0) { console.error('✗ build UI anchor'); process.exit(1); }
  var newUI = "UI = ['story', 'ui']\n"
    + UI_SPLIT.map(function (n) { return "      + ['" + n + "']"; }).join('\n')
    + "\n      + ['duel3d', 'map3d', 'scene3d', 'main']";
  s = s.replace(oldUI, newUI);

  fs.writeFileSync(p, s, 'utf8');
  console.log('build_bundle.py: ORDER + UI 已展开');
})();

/* ---------- 2) smoke-test.js ---------- */
(function () {
  var p = 'smoke-test.js';
  var s = fs.readFileSync(p, 'utf8');
  if (s.indexOf("'ui-fx'") >= 0) { console.log('SKIP smoke-test.js'); return; }

  /* ⚠️ 每个元素要**自带闭合引号**：', \'ui-fx\'
     第一次写成 "', '" + n（少一个 '）→ 产出了 'ui'', 'ui-fx' 的语法错。 */
  var expand = UI_SPLIT.map(function (n) { return ", '" + n + "'"; }).join('');
  var oldPat = "'story', 'ui', 'main']";
  var n = (s.match(/'story', 'ui', 'main'\]/g) || []).length;
  if (!n) { console.error('✗ smoke anchor'); process.exit(1); }
  s = s.split(oldPat).join("'story', 'ui'" + expand + ", 'main']");
  fs.writeFileSync(p, s, 'utf8');
  console.log('smoke-test.js: ' + n + ' 处模块清单已展开（含 2 处静态检查列表）');
})();

console.log('DONE');
