'use strict';
var fs = require('fs');
var p = '.workbuddy/tools/prof/smoke_slice.js';
var s = fs.readFileSync(p, 'utf8');
if (s.indexOf('总是带上第 1 段') >= 0) { console.log('SKIP'); process.exit(0); }
var old = '  /* 最近新增的段总是纳入（新功能往往还没被人"引用"过） */';
var neu = [
  '  /* 第 1 段 = 骨架段（stub / require / 公共工具，如 fsMod/pathMod 就在这里），',
  '     任何切片都必须带上 —— 否则选中段一用到 fsMod 就 ReferenceError。',
  '     这是"总是带上第 1 段"。 */',
  '  if (idxList.indexOf(0) < 0) idxList.push(0);',
  '',
  '  /* 最近新增的段总是纳入（新功能往往还没被人"引用"过） */'
].join('\n');
if (s.indexOf(old) < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }
s = s.replace(old, neu, 1);
fs.writeFileSync(p, s, 'utf8');
console.log('patched: 切片总带第 1 段');
