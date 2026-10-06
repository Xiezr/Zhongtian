/* v89.208 代码梳理 · 量化 + 一致性/健壮性探针（codemap）
   承接 v89.206 版（存在性/规模）→ 本轮加"对不对"的口径探针。

   产出：
     ① 每文件规模/函数/注释率 + 出口面        （同 v89.206 口径，可对照）
     ② v89 版本注释热度 top20
     ③ 分层纪律账本（剥注释后下层误引上层）
     ④ 最长函数 top15
     ⑤ 玩家可控文本转义面（create-name / 城名 / 君主名）   【新】
     ⑥ 健壮性探针：空 catch / 监听配平 / 定时器配平 / eval / window 赋值  【新】
     ⑦ 重复代码块（归一化后 ≥8 行完全相同的片段出现在 ≥2 处）  【新】
     ⑧ 遗留标记清单（TODO / FIXME / 待办 / 未完成 / 暂不 …）  【新】

   用法：node .workbuddy/tools/audit/audit_v89208_codemap.js  （建议重定向到文件再读）
   注意：只扫 js/ + index.html —— backup/ 与 .workbuddy/backup/ 是历史快照，不入账。 */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var MOD = ['data', 'state', 'domain', 'systems', 'tactic', 'battle', 'map', 'ui', 'main',
  'story', 'icons', 'gicons', 'portraits', 'bitmaps', 'questdata'];
var ALL = MOD.map(function (f) { return 'js/' + f + '.js'; }).concat(['index.html']);

function read(p) { try { return fs.readFileSync(R + p, 'utf8'); } catch (e) { return ''; } }
function cnt(re, s) { return (String(s).match(re) || []).length; }

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

console.log('\n══════ ①b 出口面（唯一出口计数）══════');
(function () {
  /* 口径：GAME 要含**命名空间链**（`GAME.battle.foo = function` 也要算）——
     只用 `GAME\.[\w$]+ =` 会漏掉 150 个，v89208 首跑就漏过一版（768 vs 918）。 */
  var g = 0, gd = 0, u = 0;
  MOD.forEach(function (f) {
    var s = read('js/' + f + '.js');
    g += cnt(/GAME\.[\w$]+(?:\.[\w$]+)*\s*=\s*function/g, s);
    gd += cnt(/GAME\.[\w$]+\.[\w$]+\s*=\s*function/g, s);
    u += cnt(/\bui\.[\w$]+\s*=\s*function/g, s);
  });
  console.log('  GAME.x = function … ' + g + '（其中命名空间链 GAME.a.b … ' + gd + '）'
    + ' · ui.x = function … ' + u + ' · 合计 ' + (g + u));
})();

console.log('\n══════ ② v89 版本注释热度（js/+index.html 全量 · top 20）══════');
(function () {
  var c = {};
  ALL.forEach(function (f) {
    (read(f).match(/v89\.\d{3}[a-z]?/g) || []).forEach(function (v) { c[v] = (c[v] || 0) + 1; });
  });
  var arr = Object.keys(c).map(function (k) { return [k, c[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  console.log('  版本 token 总数 ' + arr.reduce(function (a, b) { return a + b[1]; }, 0)
    + ' · 涉及版本 ' + arr.length + ' 个 · top 20：');
  console.log('    ' + arr.slice(0, 20).map(function (x) { return x[0] + ' ×' + x[1]; }).join('   '));
})();

console.log('\n══════ ③ 分层纪律账本（剥注释后 · 下层误引上层 = 疑似违规）══════');
(function () {
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
    s.split('\n').forEach(function (L, i) { if (L.match(p[1])) hits.push((i + 1) + ':' + L.trim().slice(0, 70)); });
    console.log('  [' + p[0] + '] 命中 ' + hits.length + (hits.length ? '：' : ' ✅'));
    hits.slice(0, 10).forEach(function (h) { console.log('     ' + h); });
  });
})();

console.log('\n══════ ④ 最长函数 top 15（近似：声明行 → 下一个两空格 }; ）══════');
(function () {
  var out = [];
  ALL.forEach(function (f) {
    if (f.indexOf('.html') >= 0) return;
    var lines = read(f).split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^\s{2}([\w$.]+\s*=\s*function|function\s+[\w$]+)/);
      if (!m) continue;
      var j = i + 1;
      for (; j < Math.min(lines.length, i + 3000); j++) if (/^  \};?\s*$/.test(lines[j])) break;
      out.push({ f: f.replace('js/', '').replace('.js', ''), name: m[1].slice(0, 46), len: j - i, at: i + 1 });
    }
  });
  out.sort(function (a, b) { return b.len - a.len; });
  out.slice(0, 15).forEach(function (x) {
    console.log('  ' + x.f.padEnd(8) + ' 行 ' + String(x.at).padStart(6) + ' · ' + String(x.len).padStart(4) + ' 行 · ' + x.name);
  });
  console.log('  ── 函数总数 ' + out.length
    + ' · >150 行 ' + out.filter(function (x) { return x.len > 150; }).length + ' 个'
    + ' · >300 行 ' + out.filter(function (x) { return x.len > 300; }).length + ' 个');
})();

console.log('\n══════ ⑤ 玩家可控文本转义面【新】══════');
(function () {
  /* 玩家能改的字：君主名（create-name / rename-lord-input）与城名（rename-city-input）。
     这些字会进 innerHTML —— 未过 U.escape 就是"自定义名字能改坏版面"的风险位。 */
  var IDS = /\b(ruler\.name|city\.name|c\.name|lordName|playerName)\b/;
  var anyEscape = 0, noEscape = [];
  MOD.forEach(function (f) {
    var rel = 'js/' + f + '.js';
    read(rel).split('\n').forEach(function (L, i) {
      if (!IDS.test(L)) return;
      /* 只看会进 HTML 的行：含标签或字符串拼接 */
      var htmlish = (L.indexOf('<') >= 0 && L.indexOf("'") >= 0);
      if (!htmlish) return;
      if (/U\.escape|GAME\.utils\.escape/.test(L)) { anyEscape++; return; }
      noEscape.push(rel + ':' + (i + 1) + '  ' + L.trim().slice(0, 76));
    });
  });
  console.log('  U.escape 总用量 ' + cnt(/U\.escape\(|GAME\.utils\.escape\(/g, ALL.map(read).join('\n')));
  console.log('  HTML 行中含玩家可控 .name 且已转义 … ' + anyEscape + ' 处');
  console.log('  HTML 行中含玩家可控 .name 未见转义 … ' + noEscape.length + ' 处：');
  noEscape.slice(0, 25).forEach(function (h) { console.log('     [待核] ' + h); });
  if (noEscape.length > 25) console.log('     …另有 ' + (noEscape.length - 25) + ' 处');
})();

console.log('\n══════ ⑥ 健壮性探针【新】══════');
(function () {
  var src = ALL.map(read).join('\n');
  /* 空 catch 落到行号：23 处静默吞异常，逐条看是否"有意兜底"还是"漏处理" */
  var emptyCatch = [];
  MOD.forEach(function (f) {
    read('js/' + f + '.js').split('\n').forEach(function (L, i) {
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(L)) emptyCatch.push(f + ':' + (i + 1) + '  ' + L.trim().slice(0, 72));
    });
  });
  console.log('  空 catch（catch (e) {}）… ' + emptyCatch.length + ' 处：');
  emptyCatch.forEach(function (h) { console.log('     ' + h); });
  var add = cnt(/addEventListener\(/g, src), rem = cnt(/removeEventListener\(/g, src);
  console.log('  addEventListener ' + add + ' · removeEventListener ' + rem
    + '（差 ' + (add - rem) + ' —— 单页常驻监听不必配平，仅作存量登记）');
  var st = cnt(/setTimeout\(/g, src), si = cnt(/setInterval\(/g, src);
  console.log('  setTimeout ' + st + ' · clearTimeout ' + cnt(/clearTimeout\(/g, src)
    + ' · setInterval ' + si + ' · clearInterval ' + cnt(/clearInterval\(/g, src));
  console.log('  eval( ' + cnt(/\beval\s*\(/g, src) + ' · new Function( ' + cnt(/new\s+Function\s*\(/g, src)
    + ' · document.write ' + cnt(/document\.write\(/g, src));
  console.log('  window.x = 赋值 ' + cnt(/window\.[\w$]+\s*=/g, src)
    + '（含装配行，逐条见 ③ 的 data 账本）');
  /* localStorage 归属：应只在存档层（state.js）出现 */
  var ls = [];
  MOD.forEach(function (f) {
    var n = cnt(/localStorage\./g, read('js/' + f + '.js'));
    if (n) ls.push(f + ' ' + n);
  });
  console.log('  localStorage.* 分布（应只在 state.js）… ' + (ls.join(' · ') || '无'));
  var jp = [];
  MOD.forEach(function (f) {
    var n = cnt(/JSON\.parse\(/g, read('js/' + f + '.js'));
    if (n) jp.push(f + ' ' + n);
  });
  console.log('  JSON.parse 分布 … ' + (jp.join(' · ') || '无'));
})();

console.log('\n══════ ⑦ 重复代码块（归一化 ≥8 行完全相同 · ≥2 处）【新】══════');
(function () {
  var W = 8, map = {};
  ALL.forEach(function (f) {
    if (f.indexOf('.html') >= 0) return;
    var lines = read(f).split('\n');
    var norm = lines.map(function (L) {
      return L.replace(/\s+/g, ' ').trim();
    });
    for (var i = 0; i + W <= norm.length; i++) {
      var win = norm.slice(i, i + W);
      /* 跳过含空行/短行/纯注释的窗口 —— 那类重复无意义 */
      var ok = true;
      for (var k = 0; k < W; k++) {
        var t = win[k];
        if (!t || t.length < 6 || t.indexOf('//') === 0 || t.indexOf('*') === 0 || t.indexOf('/*') === 0) { ok = false; break; }
      }
      if (!ok) continue;
      var key = win.join('\n');
      (map[key] = map[key] || []).push(f.replace('js/', '') + ':' + (i + 1));
    }
  });
  var groups = Object.keys(map).filter(function (k) { return map[k].length >= 2; });
  console.log('  ≥8 行完全相同的代码块 ' + groups.length + ' 组（同一文件内相邻窗口会重叠计数，看"不同位置"即可）');
  groups.slice(0, 8).forEach(function (k, gi) {
    console.log('  ── 组 ' + (gi + 1) + '（' + map[k].length + ' 处）: ' + map[k].join(' , '));
    console.log('     ' + k.split('\n')[0].slice(0, 74));
  });
})();

console.log('\n══════ ⑧ 遗留标记清单【新】══════');
(function () {
  /* 严格口径：只认"动作型"标记，且**排除老板原话引用**（「…」内是需求文不是待办）。
     上一版宽口径（含 XXX / 未完成）全是假阳性：openXXX() / 「损失XX资源」/ "未完成可累积"。 */
  var MARK = /(TODO|FIXME|HACK)|待办|待老板拍板|待定|暂不实现|以后再|留待|本(轮|期)不做|未完成清单/;
  var hits = [];
  ALL.forEach(function (f) {
    read(f).split('\n').forEach(function (L, i) {
      var t = L.trim();
      if (!/^(\/\/|\*|\/\*)/.test(t)) return;
      if (t.indexOf('「') >= 0 || t.indexOf('」') >= 0) return;   /* 老板原话引用，不算待办 */
      if (!MARK.test(t)) return;
      hits.push(f + ':' + (i + 1) + '  ' + t.replace(/^(\/\/|\*|\/\*)\s*/, '').slice(0, 78));
    });
  });
  console.log('  代码注释里的遗留标记 ' + hits.length + ' 条：');
  hits.forEach(function (h) { console.log('     ' + h); });
})();
