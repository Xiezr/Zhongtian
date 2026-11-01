/* ui.js 拆分 —— **纯搬运**：所有 `ui.xxx` 定义及其先后顺序一字不改，只是换文件。
 *
 * 三条约束（任何一条破了都会出事，都踩过）：
 *   ① 切点必须在**顶层**：用 `前 N 行 + '})();'` 试编译证明，不靠缩进猜
 *      （踩过：注释吸附到函数体内 → ui.cityHTML 被切成半截，而 node --check 竟然通过）
 *   ② 跨功能的顶层局部变量必须**前移**到 ui.js 并挂 ui._C
 *      （踩过：BAG_LEGACY_TAB is not defined；BLDG_FUNC 还被先加载的 ui-battle 用，
 *        光加别名不行，必须定义前移）
 *   ③ 共享常量只存一份，其余文件取**引用**不取副本
 *
 * 用法：
 *   node .workbuddy/tools/patch/split_ui.js --dry    # 只预览
 *   node .workbuddy/tools/patch/split_ui.js          # 真拆（备份到 .workbuddy/backup/）
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..', '..');
var SRC = path.join(ROOT, 'js', 'ui.js');
var BAK = path.join(ROOT, '.workbuddy', 'backup');

var lines = fs.readFileSync(SRC, 'utf8').split('\n');
var N = lines.length;

var PLAN = [
  { name: 'ui-fx',     at: 20,     title: '反馈层 · 里程碑演出 / 通知 / 浮字 / 音效 / 场景层' },
  { name: 'ui-core',   at: 258,    title: '基础件 · 点选控件 / 主题 / 闪烁 / 无法操作提示' },
  { name: 'ui-modal',  at: 533,    title: '弹窗框架 · 格局 / 键盘流 / 实时刷新 / 悬停保护 / 整体缩放' },
  { name: 'ui-shell',  at: 1257,   title: '外框 · 图例 / 坐标浮层 / 环境状态条 / 队列总览' },
  { name: 'ui-battle', at: 1746,   title: '战斗 · 观战 / 沙盘 / 战略战术 / 俘虏 / 警报 / 阵亡名录' },
  { name: 'ui-city',   at: 3942,   title: '城市 · 新手引导 / 城市操作栏 / 侧栏驻军与资源' },
  { name: 'ui-army',   at: 4408,   title: '军务 · 出征战术 / 阵位指令 / 募兵' },
  { name: 'ui-bag',    at: 4775,   title: '行囊 · 背包 / 装备 / 分页排序' },
  { name: 'ui-craft',  at: 6024,   title: '器物 · 宝物 / 神器 / 荒野行动 / 游商 / 制造 / 熔铸 / 抽卡' },
  { name: 'ui-view',   at: 7904,   title: '视图与枢纽 · setView / 交易站 / 英雄枢纽 / 节钺 / 行政 / 世界账本' },
  { name: 'ui-build',  at: 9430,   title: '建造 · 前传君主 / 等距渲染 / 围墙 / 格内建筑 / 政务厅' },
  { name: 'ui-planet', at: 11236,  title: '星球与英雄 · 星球生成切换 / 英雄界面 / 属性 / 部件栏' },
  { name: 'ui-space',  at: 13555,  title: '星空 · 星系 / 空间站 / 殖民 / 深空远征 / 3D 预览' },
  { name: 'ui-delve',  at: 14791,  title: '废土 · 营地 / 遗迹 / 斗将 / 村社 / 拓荒队 / 三条线' },
  { name: 'ui-mapui',  at: 15482,  title: '地图界面 · 调兵运输 / 据点情报 / 地图本体 / 前哨格' },
  { name: 'ui-exped',  at: 16258,  title: '出征 · 城内布局 / 统一出征面板 / 计略 / 方案 / 辎重 / 战前推演' },
  { name: 'ui-report', at: 18363,  title: '文书 · 通用分页 / 统计 / 公文 / 战报沙盘' },
  { name: 'ui-config', at: 19885,  title: '设置与自动化 · 存档 / 自动出征 / 自动采购 / 奇观 / 战力评估' }
];

function safeCut(idx) {
  if (idx <= 0) return false;
  var body = lines.slice(0, idx).filter(function (L) {
    return !/^\s*import\s/.test(L);
  }).join('\n');
  try { new Function(body + '\n})();\n'); return true; } catch (e) { return false; }
}

function snapToSection(lineNo) {
  var start = lineNo - 1;
  for (var i = start; i >= 0 && i > start - 600; i--) {
    if (/^  \/\* ={6,}/.test(lines[i]) && safeCut(i)) return i;
  }
  for (var j = start; j >= 0; j--) if (safeCut(j)) return j;
  return -1;
}

var cuts = [];
PLAN.forEach(function (p) {
  var idx = snapToSection(p.at);
  if (idx < 0) { console.error('✗ 找不到安全切点：' + p.name + '（目标行 ' + p.at + '）'); process.exit(1); }
  cuts.push({ name: p.name, title: p.title, start: idx, want: p.at - 1 });
});

var HOIST = ['EQUIP_SLOT_ORDER', 'BAG_LEGACY_TAB', 'BLDG_FUNC'];

function findVarBlock(name) {
  var re = new RegExp('^  var ' + name + '\\s*=');
  for (var i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    var d = 0, j = i;
    for (; j < lines.length; j++) {
      for (var c = 0; c < lines[j].length; c++) {
        var ch = lines[j][c];
        if (ch === '{' || ch === '[' || ch === '(') d++;
        else if (ch === '}' || ch === ']' || ch === ')') d--;
      }
      if (d <= 0 && /;\s*$/.test(lines[j])) break;
    }
    return { name: name, start: i, end: j + 1, text: lines.slice(i, j + 1) };
  }
  return null;
}

var HOISTED = [];
HOIST.forEach(function (n) {
  var b = findVarBlock(n);
  if (!b) { console.error('✗ 找不到共享常量定义：' + n); process.exit(1); }
  HOISTED.push(b);
});

function headFirst() {
  var h = [
    '/* ============================================================',
    ' * ui.js　界面层入口 · ui 命名空间初始化（拆分后只剩骨架）',
    ' * ------------------------------------------------------------',
    ' * v156.27：21,456 行的 ui.js 按功能域拆成 19 个文件（本文件 + 18 个 ui-*.js）。',
    ' *   **纯搬运**：所有 ui.xxx 定义及其先后顺序一字未改。',
    ' *   等价性证明：node .workbuddy/tools/prof/snapshot_ui_fns.js --diff before after',
    ' * ⛔ 这个文件只放"全站唯一的东西"：命名空间、$ / $$、跨域共享常量。',
    ' *    具体面板请去对应的 ui-<域>.js，不要往这里加。',
    ' * ============================================================ */',
    "import './core.js';",
    "import './data.js';",
    "import './state.js';",
    '(function () {',
    '  var GAME = window.GAME = window.GAME || {};',
    '  var DATA = GAME.DATA, U = GAME.utils;',
    '',
    '  /* 全站唯一的 ui 命名空间。**只在这里初始化一次**；其余 ui-*.js 取引用。 */',
    '  var ui = GAME.ui = {',
    "    view: 'city', side: 'res',",
    '    _curGrid: null, _attackNpc: null, _attackWild: null, _cityId: null,',
    '  };',
    '',
    '  /* 两个取元素的小工具：全站唯一实现，挂到 ui._dom 供其余 ui-*.js 取别名。',
    '     ⛔ 不要在各文件里再写一份 —— 那样 18 份实现迟早不一致。 */',
    '  var $ = function (sel, root) { return (root || document).querySelector(sel); };',
    '  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };',
    '  ui._dom = { $: $, $$: $$ };',
    '',
    '  /* ============================================================',
    '   * 跨功能域共享的常量表（拆分时前移到这里）',
    '   * ------------------------------------------------------------',
    '   * 它们原来散在 ui.js 各处、被多个功能域引用；拆成独立文件后各自',
    '   * IIFE 互相看不见，所以统一放在**最先执行**的这里。',
    '   * 其余文件用 ui._C 取**同一个对象**（不是副本）。',
    '   * ⛔ 不要在 ui-*.js 里再写一份：多个副本会"改一个不生效"。',
    '   * ============================================================ */',
    '  ui._C = {};'
  ];
  HOISTED.forEach(function (b) {
    h = h.concat(b.text);
    h.push('  ui._C.' + b.name + ' = ' + b.name + ';');
    h.push('');
  });
  return h;
}

function headOther(name, title) {
  return [
    '/* ============================================================',
    ' * ' + name + '.js　' + title,
    ' * ------------------------------------------------------------',
    ' * 拆分自 ui.js（v156.27）。**纯搬运** —— 所有 ui.xxx 定义及其先后顺序',
    ' *   一字未改，只是换了文件。等价性由逐条 sha1 比对证明。',
    ' * ⚠️ 这个文件的职责就是「一个功能域的全部面板实现」，不要在这里改引擎逻辑。',
    ' * ============================================================ */',
    "import './ui.js';",
    '(function () {',
    '  var GAME = window.GAME;',
    '  var DATA = GAME.DATA, U = GAME.utils;',
    '  var ui = GAME.ui;',
    '  var $ = ui._dom.$, $$ = ui._dom.$$;'
  ];
}

console.log('══ 切点（试编译验证过在顶层）══');
console.log('  ui.js  1 ~ 18（头 + 初始化 + $/$$ + 共享常量）');
cuts.forEach(function (c, i) {
  var end = (i + 1 < cuts.length) ? cuts[i + 1].start : N;
  console.log('  ' + c.name.padEnd(10) + ' 行 ' + String(c.start + 1).padStart(6) + ' ~ '
    + String(end).padStart(6) + '  (' + (end - c.start) + ' 行)'
    + (c.start !== c.want ? '  ← 吸附自 ' + (c.want + 1) : ''));
});
console.log('  共享常量前移：' + HOISTED.map(function (x) { return x.name + '@' + (x.start + 1); }).join(', '));

if (process.argv.indexOf('--dry') >= 0) { console.log('\n（--dry：未写入）'); process.exit(0); }

fs.mkdirSync(BAK, { recursive: true });
fs.copyFileSync(SRC, path.join(BAK, 'ui.js.bak'));

fs.writeFileSync(SRC, headFirst().concat(['})();']).join('\n') + '\n', 'utf8');

var stats = [];
cuts.forEach(function (c, i) {
  var end = (i + 1 < cuts.length) ? cuts[i + 1].start : N;

  var body = [];
  for (var bi = c.start; bi < end; bi++) {
    var hit = null;
    for (var hi = 0; hi < HOISTED.length; hi++) {
      if (bi >= HOISTED[hi].start && bi < HOISTED[hi].end) { hit = HOISTED[hi]; break; }
    }
    if (hit) { bi = hit.end - 1; continue; }
    body.push(lines[bi]);
  }
  if (i === cuts.length - 1) {
    while (body.length && body[body.length - 1].trim() === '') body.pop();
    if (body.length && body[body.length - 1].trim() === '})();') body.pop();
  }

  var out = headOther(c.name, c.title);
  var bodyText = body.join('\n');
  var aliased = HOISTED.filter(function (h) {
    return new RegExp('(^|[^.\\w$])' + h.name + '\\b').test(bodyText);
  });
  if (aliased.length) {
    out.push('');
    out.push('  /* 共享常量：定义在 ui.js 的 ui._C（全站唯一一份，取的是同一个对象） */');
    aliased.forEach(function (h) { out.push('  var ' + h.name + ' = ui._C.' + h.name + ';'); });
  }
  out.push('');
  out = out.concat(body).concat(['})();']);

  fs.writeFileSync(path.join(ROOT, 'js', c.name + '.js'), out.join('\n') + '\n', 'utf8');
  stats.push([c.name, out.length, aliased.map(function (h) { return h.name; })]);
});

console.log('\n══ 已写出 ══');
stats.forEach(function (s) {
  console.log('  js/' + s[0] + '.js  ' + String(s[1]).padStart(6) + ' 行'
    + (s[2].length ? '   共享常量：' + s[2].join(',') : ''));
});
console.log('  备份：.workbuddy/backup/ui.js.bak');
