/* ============================================================
 * audit_v89134_tables.js —— 数据表盘点器 v2（v89.134 · 需求「数据表梳理」）
 * ------------------------------------------------------------
 * 只读。两种用法：
 *   ① 命令行：node audit_v89134_tables.js [--json]（人看的盘点报告）
 *   ② 模块：require 后调 scanAll()（gen_tables_index.js 的共享数据源）
 * 产出四盘：
 *   定义盘（写点）· 引用盘（消费方）· 卫生盘（跨文件写/重复定义/孤儿/悬空）
 * 判级：⛔ = 阻断（必须解释或修）· · = 提示 · ✅ = 通过
 *
 * v2.2（自抓自修 ×2）：**正则字面量识别 + 双剥离产物**——
 *   v2.1 曾把 `/[&<>"]/` 里的引号当字符串开始、误剥其后整段代码（引用骤减/孤儿 25 个）。
 * v2 相对 v1 的三处修正（v1 首跑时抓出的自身缺陷）：
 *   ① 剥注释再扫（v1 把墓碑注释里的 DATA.X 算成引用 —— 悬空引用 8 个全假）；
 *   ② 测试文件也算消费方（WILD_DEF_ORIG_TOTAL 被 smoke 消费 3 处 —— v1 误判孤儿）；
 *   ③ 构建步骤白名单（JEWEL_LADDER 空值占位、ITEMS 三段并入 —— 是设计不是冲突）。
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

/* ---------- 白名单（每条必须有理由） ---------- */
/* ① 构建步骤：同名多次写 = 一段构建逻辑的多个阶段，非冲突 */
var KNOWN_BUILDS = {
  'JEWEL_LADDER': 'null 占位 + jewelLadder() 惰性填充（代价表早于 ITEMS 执行）',
  'ITEMS': '主表 + 图纸并入 + 材料并入（三段构建 · 各自幂等去重）',
  'ITEM_BY_ID': '建表 + 全量末尾重建（防表过期 · v89.121 教训）',
  'MAX_LEVEL_ABS': '基准值 + 加成推导（同一 IIFE 内多步赋值）',
  'RANK_BUILD_LIFT_MAX': '定值 + 自校正（爵位档数扩容时向上修正）',
};
/* ② 合法跨文件写域（除 data.js 外） */
var LEGAL_EXTRA_WRITERS = {
  'js/questdata.js': '任务数据分包（v12 起 · 加载序在 data.js 之后，覆盖是设计）',
};
/* ③ 孤儿白名单（每条必须有理由 · 目前为空）
 * 说明：CITY_PERK_KEYS 曾在 v1/v2 白名单里 —— v89.134 接线后它已被
 * smoke §115⑤ 真实消费（引用计数 ≥1），**撤出白名单**：它若再变孤儿就该报警。 */
var ORPHAN_OK = {};

/* ---------- 剥离器（**保行号** · v2.2 加了正则字面量识别） ----------
 * 两个剥离档位（同一函数，开关 keepStringContent）：
 *   · false = **纯代码区**（注释/字符串内容/正则体 → 空白）→ 写点扫描用；
 *     —— v2.1 的教训：测试断言里 indexOf('DATA.QUESTS = ') 会被当成写点（真误报）；
 *   · true  = 保留字符串内容（注释/正则体 → 空白）→ 引用扫描用
 *     —— 字符串里的 `DATA.X` 也算"提及"（墓碑断言的观测来源）。
 * v2.2 的关键新增：**正则字面量识别** —— v2.1 把 state.js 的 `/[&<>"]/`
 *   里那个 " 当成字符串开始 → 其后整段代码被剥 → 引用骤减、孤儿暴涨 25 个。
 * 正则起始启发式：`/` 前一个有意义字符是 运算符/开括号/逗号/冒号/分号，
 *   或前一个词是 return/typeof/case 等关键字。边界场景接受少量误差。 */
function stripJs(code, keepStringContent) {
  var out = '', i = 0, n = code.length;
  var inStr = null, inBlock = false, inLine = false, inRe = false, inCls = false;
  var prev = '\n', prevWord = '', word = '';
  function flushWord() { if (word) { prevWord = word; word = ''; } }
  function isReStart() {
    if (!prev) return true;
    if ('=(,:[!&|?{};+-*%^~<>'.indexOf(prev) >= 0) return true;
    return /^(return|typeof|case|in|of|new|delete|void|do|else|yield|await)$/.test(prevWord);
  }
  while (i < n) {
    var c = code[i], c2 = code[i + 1];
    if (inBlock) {
      if (c === '*' && c2 === '/') { out += '  '; i += 2; inBlock = false; }
      else { out += (c === '\n') ? '\n' : ' '; i++; }
      continue;
    }
    if (inLine) {
      if (c === '\n') { out += '\n'; inLine = false; }
      else out += ' ';
      i++;
      continue;
    }
    if (inStr) {
      if (c === '\n') { out += '\n'; i++; continue; }
      if (c === '\\') { out += keepStringContent ? (c + (c2 || '')) : '  '; i += 2; continue; }
      if (c === inStr) { out += c; inStr = null; i++; continue; }
      out += keepStringContent ? c : ' ';
      i++;
      continue;
    }
    if (inRe) {
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (c === '[') { inCls = true; out += ' '; i++; continue; }
      if (c === ']' && inCls) { inCls = false; out += ' '; i++; continue; }
      if (c === '/' && !inCls) { out += '/'; inRe = false; prev = '/'; i++; continue; }
      if (c === '\n') { inRe = false; out += '\n'; i++; continue; }   /* 非法正则：退出 */
      out += ' ';
      i++;
      continue;
    }
    /* ---- 代码区 ---- */
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; i++; prev = c; continue; }
    if (c === '/' && c2 === '*') { inBlock = true; out += '  '; i += 2; continue; }
    if (c === '/' && c2 === '/') { inLine = true; out += '  '; i += 2; continue; }
    if (c === '/') {
      if (isReStart()) { inRe = true; inCls = false; out += '/'; i++; continue; }
      out += '/'; i++; prev = '/'; continue;
    }
    if (/[A-Za-z_$]/.test(c)) { word += c; out += c; i++; prev = c; continue; }
    if (/\s/.test(c)) {
      if (c === '\n') flushWord();
      out += c; i++;
      if (c === '\n') prev = '';        /* 换行 → 下一行行首视作表达式起点（保守） */
      continue;
    }
    flushWord();
    prev = c; out += c; i++;
  }
  return out;
}

/* ---------- 扫描（ROOT 下 js/ 全部 + 三个测试文件） ---------- */
function scanAll() {
  var ROOT = path.join(__dirname, '..', '..', '..');
  var SCAN = [];
  fs.readdirSync(path.join(ROOT, 'js'))
    .filter(function (f) { return /\.js$/.test(f); })
    .forEach(function (f) { SCAN.push({ id: 'js/' + f, p: path.join(ROOT, 'js', f) }); });
  ['smoke-test.js', 'e2e-test.js', 'audit.js'].forEach(function (f) {
    var p = path.join(ROOT, f);
    if (fs.existsSync(p)) SCAN.push({ id: f, p: p });
  });

  var src = {}, srcCode = {};
  SCAN.forEach(function (f) {
    var raw = fs.readFileSync(f.p, 'utf8').replace(/\r\n/g, '\n');
    src[f.id] = stripJs(raw, true);      /* 引用扫描：保留字符串内容（墓碑断言要能看见） */
    srcCode[f.id] = stripJs(raw, false); /* 写点扫描：纯代码区（字符串/正则都不算） */
  });

  /* ① 写点扫描（纯代码区） */
  var defs = {};
  var nameRe = /\bDATA\.([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/g;
  SCAN.forEach(function (f) {
    var lines = srcCode[f.id].split('\n');
    lines.forEach(function (ln, i) {
      nameRe.lastIndex = 0;
      var m;
      while ((m = nameRe.exec(ln))) {
        var name = m[1];
        var after = ln.slice(m.index + m[0].length).trim();
        var kind = /^\[/.test(after) ? 'array' : /^\{/.test(after) ? 'object'
          : /^function/.test(after) ? 'func' : /^null/.test(after) ? 'null占位' : 'scalar';
        (defs[name] = defs[name] || []).push({ file: f.id, line: i + 1, kind: kind });
      }
    });
  });

  /* ② 引用扫描（剥注释后；写行不计） */
  var refs = {};
  SCAN.forEach(function (f) {
    var lines = src[f.id].split('\n');
    lines.forEach(function (ln) {
      var re = /\bDATA\.([A-Za-z_][A-Za-z0-9_]*)\b/g;
      var m;
      while ((m = re.exec(ln))) {
        var name = m[1];
        var tail = ln.slice(m.index + m[0].length);
        if (/^\s*=(?!=)/.test(tail)) continue;      /* 写行 */
        refs[name] = refs[name] || { total: 0, byFile: {} };
        refs[name].total++;
        refs[name].byFile[f.id] = (refs[name].byFile[f.id] || 0) + 1;
      }
    });
  });

  /* ③ 卫生判定 */
  function legalWriter(file) { return file === 'js/data.js' || Object.prototype.hasOwnProperty.call(LEGAL_EXTRA_WRITERS, file); }
  var crossWrite = [], multiWriteReal = [], multiWriteKnown = [];
  Object.keys(defs).forEach(function (name) {
    var outside = defs[name].filter(function (d) { return !legalWriter(d.file); });
    if (outside.length) crossWrite.push({ name: name, at: outside });
    if (defs[name].length > 1) {
      var rec = { name: name, n: defs[name].length, at: defs[name] };
      if (Object.prototype.hasOwnProperty.call(KNOWN_BUILDS, name)) multiWriteKnown.push(rec);
      else multiWriteReal.push(rec);
    }
  });
  var orphan = [], orphanOk = [];
  Object.keys(defs).forEach(function (name) {
    var r = refs[name];
    if (!r || r.total <= 0) {
      if (Object.prototype.hasOwnProperty.call(ORPHAN_OK, name)) orphanOk.push(name);
      else orphan.push(name);
    }
  });
  /* 悬空引用分两档：js/ 内 = ⛔ 真问题；仅测试内 = · 墓碑断言/旧名兜底（合法测试模式） */
  var danglingSrc = [], danglingTest = [];
  Object.keys(refs).forEach(function (name) {
    if (defs[name] || refs[name].total <= 0) return;
    var files = Object.keys(refs[name].byFile);
    var rec = { name: name, total: refs[name].total, byFile: files.join(',') };
    if (files.some(function (f) { return f.indexOf('js/') === 0; })) danglingSrc.push(rec);
    else danglingTest.push(rec);
  });

  var writeFiles = {};
  Object.keys(defs).forEach(function (name) {
    defs[name].forEach(function (d) { writeFiles[d.file] = (writeFiles[d.file] || 0) + 1; });
  });

  return { defs: defs, refs: refs, writeFiles: writeFiles, crossWrite: crossWrite,
    multiWriteReal: multiWriteReal, multiWriteKnown: multiWriteKnown, orphan: orphan,
    orphanOk: orphanOk, danglingSrc: danglingSrc, danglingTest: danglingTest,
    scanCount: SCAN.length };
}

module.exports = { scanAll: scanAll, KNOWN_BUILDS: KNOWN_BUILDS,
  LEGAL_EXTRA_WRITERS: LEGAL_EXTRA_WRITERS, ORPHAN_OK: ORPHAN_OK };

/* ---------- 命令行输出 ---------- */
if (require.main === module) {
  var A = scanAll();
  if (process.argv.indexOf('--json') >= 0) {
    console.log(JSON.stringify(A, null, 1));
    process.exit(0);
  }
  console.log('==========================================');
  console.log(' 数据表盘点报告 v2（v89.134）');
  console.log('==========================================');
  console.log('表总数（写点名）:', Object.keys(A.defs).length);
  console.log('写点文件分布:', JSON.stringify(A.writeFiles));
  console.log('扫描范围:', A.scanCount, '个文件（js/ 全部 + smoke/e2e/audit）');
  console.log('');
  console.log('--- ⛔ 跨文件写（合法域：data.js / questdata.js）---');
  if (!A.crossWrite.length) console.log('  （无）✔');
  A.crossWrite.forEach(function (c) {
    console.log('  ' + c.name + ': ' + c.at.map(function (a) { return a.file + ':' + a.line; }).join(', '));
  });
  console.log('');
  console.log('--- ⛔ 重复定义（白名单外）---');
  if (!A.multiWriteReal.length) console.log('  （无）✔');
  A.multiWriteReal.forEach(function (m) {
    console.log('  ' + m.name + ' × ' + m.n + ' @ ' + m.at.map(function (a) { return a.file + ':' + a.line; }).join(', '));
  });
  console.log('');
  console.log('--- · 构建步骤（白名单 · 设计如此）---');
  A.multiWriteKnown.forEach(function (m) {
    console.log('  ' + m.name + ' × ' + m.n + '  —— ' + KNOWN_BUILDS[m.name]);
  });
  console.log('');
  console.log('--- ⛔ 孤儿表（零引用 · 白名单外）---');
  if (!A.orphan.length) console.log('  （无）✔');
  A.orphan.forEach(function (n) {
    var d = A.defs[n][0];
    console.log('  ' + n + '  @ ' + d.file + ':' + d.line + '  kind=' + d.kind);
  });
  console.log('  （白名单内：' + (A.orphanOk.join(', ') || '无') + '）');
  console.log('');
  console.log('--- ⛔ 悬空引用（js/ 内读了没写点）---');
  if (!A.danglingSrc.length) console.log('  （无）✔');
  A.danglingSrc.forEach(function (d) { console.log('  ' + d.name + ' × ' + d.total + '  @ ' + d.byFile); });
  console.log('');
  console.log('--- · 测试内引用已删名（墓碑断言/旧名兜底 · 合法模式）---');
  if (!A.danglingTest.length) console.log('  （无）');
  A.danglingTest.forEach(function (d) { console.log('  ' + d.name + ' × ' + d.total); });
  console.log('');
  console.log('--- 引用热力 TOP 20 ---');
  Object.keys(A.refs).filter(function (n) { return A.refs[n].total > 0 && A.defs[n]; })
    .sort(function (a, b) { return A.refs[b].total - A.refs[a].total; })
    .slice(0, 20).forEach(function (n) {
      console.log('  ' + n.padEnd(24) + ' ' + String(A.refs[n].total).padStart(4)
        + '  ' + Object.keys(A.refs[n].byFile).map(function (x) {
          return x.replace('js/', '').replace('.js', ''); }).join(','));
    });
  console.log('');
  console.log('--- 结果 ---');
  var bad = A.crossWrite.length + A.multiWriteReal.length + A.orphan.length + A.danglingSrc.length;
  console.log(bad === 0 ? '✅ 卫生四查全过（跨文件写 / 重复定义 / 孤儿 / 悬空）' : '⛔ 需处理 ' + bad + ' 项');
  console.log('==========================================');
  /* v89.136（老板「盘点器进入 gate」）：非零退出码表示"需处理"——
     gate.py 与 pre-commit 都读它（与 smoke/e2e 同一约定：红 = 不许提交）。 */
  process.exit(bad === 0 ? 0 : 1);
}
