/* v35-g：扫描 assets/icons/ui/ 生成 js/bitmaps.js（位图素材登记表）
 * 幂等；icons.js 用 typeof BITMAPS 延迟绑定，故本文件须在 icons.js 之后加载。
 */
const fs = require('fs');
const UI = 'E:/Deepseekdb/assets/icons/ui/';
const OUT = 'E:/Deepseekdb/js/bitmaps.js';

const files = fs.readdirSync(UI).filter(f => f.endsWith('.png')).sort();
/* 前缀规则：组 → 文件名前缀 */
const PREFIX = [
  ['terrain', 'ai_terrain_'],
  ['mat', 'ai_mat_'],
  ['slot', 'ai_slot_'],
  ['item', 'ai_item_'],
  ['troop', 'ai_'],
  ['building', 'ai_'],
  ['ext', 'ai_'],
  ['res', 'ai_'],
];

const L = [];
L.push('/* ============================================================');
L.push(' * js/bitmaps.js — AI 位图素材登记表（v35）');
L.push(' * ------------------------------------------------------------');
L.push(' * 素材：AI 生成的汉代风图标，1024×1024 透明 PNG（已抠底）。');
L.push(' * 生成规格见 docs/AI图标生成清单.md，落位台账见 docs/图标素材注册表.md。');
L.push(' * 本文件由 .workbuddy/tmp/gen_bitmaps.js 扫描目录自动生成 —— 请勿手改。');
L.push(' *');
L.push(' * 用法：BITMAPS.src(group, id) → 相对路径（不存在返回空串，上层走矢量回退）');
L.push(' * ============================================================ */');
L.push('var BITMAPS = (function () {');
L.push('  var DIR = ' + JSON.stringify('assets/icons/ui/') + ';');
L.push('  var F = {};');
files.forEach(f => L.push('  F[' + JSON.stringify(f) + '] = 1;'));
L.push('  var PREFIX = ' + JSON.stringify(Object.fromEntries(PREFIX), null, 2).split('\n').map((x, i) => i ? '  ' + x : x).join('\n') + ';');
L.push('  function fileOf(group, id) {');
L.push("    var p = PREFIX[group]; if (!p) return '';");
L.push("    var f = p + id + '.png';");
L.push('    return F[f] ? f : \'\';');
L.push('  }');
L.push('  return {');
L.push('    DIR: DIR, F: F, PREFIX: PREFIX,');
L.push('    has: function (f) { return !!F[f]; },');
L.push('    fileOf: fileOf,');
L.push("    src: function (group, id) { var f = fileOf(group, id); return f ? DIR + f : ''; },");
L.push('    count: ' + files.length + ',');
L.push('  };');
L.push('})();');
L.push('');
L.push('/* v36：CommonJS 桥接 —— smoke-test.js 用 require 加载，裸 var 是模块局部，');
L.push('   icons.js 里的 typeof BITMAPS 会恒为 undefined（素材层静默失效）。 */');
L.push("if (typeof window !== 'undefined') window.BITMAPS = BITMAPS;");
L.push('');

fs.writeFileSync(OUT, L.join('\n'), 'utf8');
console.log('生成 js/bitmaps.js  文件数=' + files.length + '  字节=' + fs.statSync(OUT).size);

/* 覆盖度核对：分组统计 */
const stat = {};
files.forEach(f => {
  let g = 'other';
  PREFIX.forEach(([k, p]) => { if (g === 'other' && f.indexOf(p) === 0) g = k; });
  stat[g] = (stat[g] || 0) + 1;
});
console.log('分组：' + JSON.stringify(stat));

/* 命名规范告警 */
const bad = files.filter(f => !/^ai_(mat_|slot_|item_|terrain_)?[a-z_0-9]+\.png$/.test(f));
console.log(bad.length ? '⚠ 命名异常：' + bad.join(',') : '命名规范 ✅');
