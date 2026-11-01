#!/usr/bin/env node
/* ============================================================
 * impact_of.js —— 「改这个文件，会牵动多少条断言？」
 * ------------------------------------------------------------
 * 老板 2026-11-02：「怎么解决牵动谁？」
 *
 * 答案不是「让测试能跳段」（试过，切片必崩：段之间有状态依赖），
 * 而是**改之前就知道**：这条改动落在哪几段断言的责任田里。
 *   不知道 → 改完跑 8 分钟，红在哪个角落全凭运气（漏改 #map-info 那次）；
 *   知道   → 主动去看那几十条，20 秒。
 *
 * 数据来源 `.workbuddy/seg-modules.json`（由 gen_seg_modules.js 生成）：
 *   seg.direct = 该段**直接**调用到的 js 文件（按符号表反查）。
 *
 * ⛔ 只用 direct，不用 files：
 *   files 是传递闭包，传一步就覆盖 143/238 段（GAME.state 是上帝模块），
 *   等于「改任何文件都要跑全量」，那种清单没用。
 *
 * 用法：
 *   node .workbuddy/tools/prof/impact_of.js js/ui-space.js [更多文件…]
 *   node .workbuddy/tools/prof/impact_of.js --json js/ui-space.js
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const argv = process.argv.slice(2);
const AS_JSON = argv.indexOf('--json') >= 0;
const files = argv.filter((a) => a !== '--json');

let db;
try {
  db = JSON.parse(fs.readFileSync(path.join(ROOT, '.workbuddy', 'seg-modules.json'), 'utf8'));
} catch (e) {
  console.error('✗ 没有 seg-modules.json，先跑 gen_seg_modules.js');
  process.exit(2);
}

const segs = db.segs || {};
const norm = (f) => f.replace(/\\/g, '/').replace(/^\.\//, '');

const out = [];
let totalSeg = 0, totalChk = 0;
for (const f of files) {
  const key = norm(f);
  const hits = [];
  Object.keys(segs).forEach((no) => {
    const s = segs[no];
    if ((s.direct || []).map(norm).indexOf(key) >= 0) {
      hits.push({ seg: no, title: s.title, checks: s.checks || 0 });
    }
  });
  hits.sort((a, b) => b.checks - a.checks);
  const chk = hits.reduce((a, h) => a + h.checks, 0);
  out.push({ file: key, segs: hits.length, checks: chk, top: hits.slice(0, 8) });
  totalSeg += hits.length;
  totalChk += chk;
}

if (AS_JSON) {
  console.log(JSON.stringify({ files: out, totalSeg, totalChk }, null, 1));
  process.exit(0);
}

out.forEach((o) => {
  console.log(`\n══ ${o.file}  →  直接牵动 ${o.segs} 段 / ${o.checks} 条断言`);
  if (!o.segs) { console.log('   （没有段直接调用它 —— 可能是纯工具/资产，或还没被测试覆盖）'); return; }
  o.top.forEach((h) => {
    console.log(`   #${String(h.seg).padStart(3)}  ${String(h.checks).padStart(4)} 条  ${h.title.slice(0, 46)}`);
  });
  if (o.segs > o.top.length) console.log(`   … 另有 ${o.segs - o.top.length} 段`);
});
if (files.length > 1) {
  console.log(`\n合计：${totalSeg} 段 / ${totalChk} 条（全量约 4425 条）`);
}
console.log('\n提示：这是**该重点看什么**，不是「该跑什么」——');
console.log('     段之间有共享状态，切片跑会崩（实测过），验证仍走 smoke_fast 的全量分片。');
