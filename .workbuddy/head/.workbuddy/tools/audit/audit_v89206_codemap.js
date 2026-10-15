/* v89.206 代码梳理 · 量化脚本（codemap）
   产出：① 每文件规模/函数/注释率 ② v89 版本注释热度 ③ 粗依赖方向 ④ 最长函数 top
        ⑤ 分层纪律探针（data/state/map 是否误引上层）
   用法：node .workbuddy/tools/audit/audit_v89206_codemap.js  （输出重定向到文件再读） */
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
var MOD = ['data', 'state', 'domain', 'systems', 'tactic', 'battle', 'map', 'ui', 'main',
  'story', 'icons', 'gicons', 'portraits', 'bitmaps', 'questdata'];
var ALL = MOD.map(function (f) { return 'js/' + f + '.js'; }).concat(['index.html']);

function read(p) { try { return fs.readFileSync(R + p, 'utf8'); } catch (e) { return ''; } }

console.log('══════ ① 每文件规模 / 函数 / 注释率 ══════');
var grand = { loc: 0, fns: 0, cmt: 0 };
MOD.forEach(function (f) {
  var s = read('js/' + f + '.js');
  var lines = s.split('\n');
  var cmt = 0, code = 0;
  lines.forEach(function (L) {
    var t = L.trim();
    if (!t) return;
    if (t.indexOf('//') === 0 || t.indexOf('/*') === 0 || t.indexOf('*') === 0 || t.indexOf('*/') === 0) cmt++;
    else code++;
  });
  var fns = (s.match(/^\s{2}(?:[\w$.]+\s*=\s*function|function\s+[\w$]+)/gm) || []).length;
  grand.loc += lines.length; grand.fns += fns; grand.cmt += cmt;
  console.log('  ' + f.padEnd(12) + ' 行 ' + String(lines.length).padStart(6)
    + ' · 顶层函数 ' + String(fns).padStart(5)
    + ' · 注释行 ' + String(cmt).padStart(6) + '（' + (cmt / Math.max(1, code + cmt) * 100).toFixed(1) + '%）');
});
console.log('  ── js/ 合计 ' + grand.loc + ' 行 · 函数 ' + grand.fns + ' · 注释 ' + grand.cmt);

console.log('\n══════ ② v89 版本注释热度（js/+index.html 全量 · top 20）══════');
(function () {
  var cnt = {};
  ALL.forEach(function (f) {
    var s = read(f);
    var m = s.match(/v89\.\d{3}[a-z]?/g) || [];
    m.forEach(function (v) { cnt[v] = (cnt[v] || 0) + 1; });
  });
  var arr = Object.keys(cnt).map(function (k) { return [k, cnt[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; });
  console.log('  版本 token 总数 ' + arr.reduce(function (a, b) { return a + b[1]; }, 0)
    + ' · 涉及版本 ' + arr.length + ' 个 · top 20：');
  arr.slice(0, 20).forEach(function (x) { console.log('    ' + x[0] + '  ×' + x[1]); });
})();

console.log('\n══════ ③ 粗依赖方向（引用计数 · 每文件）══════');
console.log('  文件         GAME.    ui.    DATA.   G.map  G.battle  U.');
MOD.forEach(function (f) {
  var s = read('js/' + f + '.js');
  var c = function (re) { return (s.match(re) || []).length; };
  console.log('  ' + f.padEnd(11)
    + String(c(/GAME\./g)).padStart(6)
    + String(c(/\bui\./g)).padStart(6)
    + String(c(/DATA\./g)).padStart(8)
    + String(c(/G\.map\./g)).padStart(7)
    + String(c(/G\.battle\./g)).padStart(9)
    + String(c(/\bU\./g)).padStart(5));
});

console.log('\n══════ ④ 最长函数 top 15（近似：声明行 → 下一个两空格 }; ）══════');
(function () {
  var out = [];
  ALL.forEach(function (f) {
    var s = read(f);
    if (f.indexOf('.html') >= 0) return;
    var lines = s.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^\s{2}([\w$.]+\s*=\s*function|function\s+[\w$]+)/);
      if (!m) continue;
      var j = i + 1, depth = 0;
      for (; j < Math.min(lines.length, i + 3000); j++) {
        if (/^  \};?\s*$/.test(lines[j])) break;
      }
      out.push({ f: f.replace('js/', '').replace('.js', ''), name: m[1].slice(0, 46), len: j - i, at: i + 1 });
    }
  });
  out.sort(function (a, b) { return b.len - a.len; });
  out.slice(0, 15).forEach(function (x) {
    console.log('  ' + x.f.padEnd(8) + ' 行 ' + String(x.at).padStart(6) + ' · ' + String(x.len).padStart(4) + ' 行 · ' + x.name);
  });
  var over300 = out.filter(function (x) { return x.len > 300; }).length;
  var over150 = out.filter(function (x) { return x.len > 150; }).length;
  console.log('  ── 函数总数 ' + out.length + ' · >150 行 ' + over150 + ' 个 · >300 行 ' + over300 + ' 个');
})();

console.log('\n══════ ⑤ 分层纪律探针（剥注释后 · 下层误引上层 = 疑似违规）══════');
(function () {
  /* 状态机剥注释（保换行以对齐行号）——注释里提及不算违规 */
  function stripComment(src) {
    var out = '', i = 0, n = src.length, mode = 0, c, c2;
    for (; i < n; i++) {
      c = src[i]; c2 = src[i + 1];
      if (mode === 0) {
        if (c === '/' && c2 === '/') { mode = 1; i++; out += ' '; continue; }
        if (c === '/' && c2 === '*') { mode = 2; i++; out += ' '; continue; }
        if (c === "'") mode = 3; else if (c === '"') mode = 4; else if (c === '`') mode = 5;
        out += c; continue;
      }
      if (mode === 1) { if (c === '\n') { mode = 0; out += c; } else out += ' '; continue; }
      if (mode === 2) { if (c === '*' && c2 === '/') { mode = 0; i++; out += ' '; } else out += (c === '\n' ? '\n' : ' '); continue; }
      if (c === '\\') { out += c + (c2 || ''); i++; continue; }
      if ((mode === 3 && c === "'") || (mode === 4 && c === '"') || (mode === 5 && c === '`')) mode = 0;
      out += c;
    }
    return out;
  }
  [['data', /\b(GAME\.|ui\.|G\.map\.|G\.battle\.)/g],
   ['state', /\bui\./g],
   ['map', /\bui\./g],
   ['domain', /\bui\./g],
   ['systems', /\bui\./g],
   ['tactic', /\bui\.|GAME\.state\b/g]
  ].forEach(function (p) {
    var s = stripComment(read('js/' + p[0] + '.js'));
    var hits = [];
    s.split('\n').forEach(function (L, i) {
      if (L.match(p[1])) hits.push((i + 1) + ':' + L.trim().slice(0, 72));
    });
    console.log('  [' + p[0] + '] 剥注释后命中 ' + hits.length + (hits.length ? '：' : ' ✅'));
    hits.slice(0, 8).forEach(function (h) { console.log('     ' + h); });
  });
})();
