#!/usr/bin/env node
/* ============================================================
 * assert_owner.js —— **断言级**的文件归属（不是段级）
 * ------------------------------------------------------------
 * 为什么要重算：
 *   `impact_of.js` / `seg-modules.json` 记的是**段**到文件的直接调用。
 *   一个段有 271 条断言、其中 3 条碰到 ui-city，段口径就把 271 条全算给 ui-city。
 *   实测后果：「ui-city 482 行 → 牵动 1694 条」——虚高一个数量级，
 *   拿它当"改动成本地图"会得出完全错误的结论（以为 UI 文件是维护黑洞）。
 *
 *   真正该问的是：**改这个文件，有多少条断言的判据会跟着变**。
 *   所以按断言体里的符号引用来归属，一条断言对同一文件只记一次。
 *
 * 用法：
 *   node .workbuddy/tools/prof/assert_owner.js            # 按文件排 TOP
 *   node .workbuddy/tools/prof/assert_owner.js --layer    # 按层汇总
 *   node .workbuddy/tools/prof/assert_owner.js --file js/ui-city.js   # 反查
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const R = (p) => path.join(ROOT, p);

const idx = JSON.parse(fs.readFileSync(R('.workbuddy/index/project-index.json'), 'utf8'));
const mods = JSON.parse(fs.readFileSync(R('js/modules.json'), 'utf8'));
const SYM = idx.symbols || {};

/* 文件 → 层 */
const layerOf = {};
mods.modules.forEach((m) => { layerOf[m.file.replace(/\\/g, '/')] = m.bundle; });
const linesOf = {};
mods.modules.forEach((m) => { linesOf[m.file.replace(/\\/g, '/')] = m.lines || 0; });

/* 取一条断言块（从 check( 起到同缩进的收尾） */
function blockAt(lines, i) {
  const ind = lines[i].match(/^\s*/)[0].length;
  const buf = [];
  for (let j = i; j < Math.min(lines.length, i + 120); j++) {
    buf.push(lines[j]);
    if (j > i) {
      const m = lines[j].match(/^\s*/)[0].length;
      if (m === ind && (/^\s*\}\)+\)?;?\s*$/.test(lines[j]) || /^\s*check\(/.test(lines[j]))) break;
    }
  }
  return buf.join('\n');
}

/* 一条断言引用了哪些文件的符号 */
function ownersOf(text) {
  const hit = new Set();
  /* ui.xxx / GAME.xxx / GAME.map.xxx 等 —— 统一用 symbol 表反查 */
  const re = /\b(?:GAME\.)?(ui|battle|map3d|map|state|domain|data|story|tactic|sphere|portraits|systems|fog|main)\.[A-Za-z_$][\w$]*/g;
  let m;
  while ((m = re.exec(text))) {
    const full = m[0];
    const cands = [full, full.replace(/^GAME\./, '')];
    for (const c of cands) {
      const s = SYM[c];
      if (s && s.file) { hit.add(s.file.replace(/\\/g, '/')); break; }
    }
  }
  return hit;
}

const SRC = fs.readFileSync(R('smoke-test.js'), 'utf8');
const lines = SRC.split('\n');
const perFile = {};      // file → 断言条数
let totalChecks = 0;
const unattributed = [];

for (let i = 0; i < lines.length; i++) {
  if (!/^\s*check\(/.test(lines[i])) continue;
  totalChecks++;
  const blk = blockAt(lines, i);
  const own = ownersOf(blk);
  if (!own.size) { unattributed.push(i + 1); continue; }
  own.forEach((f) => { perFile[f] = (perFile[f] || 0) + 1; });
}

const argv = process.argv.slice(2);
if (argv.indexOf('--file') >= 0) {
  const f = argv[argv.indexOf('--file') + 1].replace(/\\/g, '/');
  console.log(`\n${f}（${layerOf[f] || '?'} · ${linesOf[f] || 0} 行）→ ${perFile[f] || 0} 条断言直接引用它`);
  process.exit(0);
}

const rows = Object.keys(perFile).map((f) => ({
  file: f, n: perFile[f], layer: layerOf[f] || '?', lines: linesOf[f] || 0,
})).sort((a, b) => b.n - a.n);

if (argv.indexOf('--layer') >= 0) {
  console.log('\n══ 按层汇总（断言级归属，一条断言对同一文件只计一次）══\n');
  console.log('  层     模块   行数     断言归属   密度(条/千行)');
  ['core', 'war', 'ui', '?'].forEach((L) => {
    const g = rows.filter((r) => r.layer === L);
    if (!g.length) return;
    const n = g.reduce((a, r) => a + r.n, 0);
    const ln = g.reduce((a, r) => a + r.lines, 0);
    console.log('  ' + L.padEnd(6) + String(g.length).padStart(4) + String(ln).padStart(8)
      + String(n).padStart(10) + (n / Math.max(1, ln) * 1000).toFixed(1).padStart(12));
  });
  const tot = rows.reduce((a, r) => a + r.n, 0);
  console.log('\n  断言归属合计 ' + tot + '（一条断言可引用多个文件）／ check 总数 ' + totalChecks
    + '／ 未归属 ' + unattributed.length);
  process.exit(0);
}

console.log('\n══ 断言级改动成本（引用它的断言条数）══\n');
console.log('  条数   行数   层    文件');
rows.slice(0, 25).forEach((r) => {
  console.log('  ' + String(r.n).padStart(4) + String(r.lines).padStart(7) + '  '
    + r.layer.padEnd(5) + ' ' + r.file);
});
console.log('\n  归属合计 ' + rows.reduce((a, r) => a + r.n, 0)
  + ' ／ check 总数 ' + totalChecks + ' ／ 未归属 ' + unattributed.length + ' 条');
