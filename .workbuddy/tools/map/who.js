'use strict';
/* ============================================================
 * who.js —— 按"我要改什么"反查"改哪里、会波及什么、跑哪条验证"
 * ------------------------------------------------------------
 * 老板 2026-11-01：「是否可以建立一个资产链，或者逻辑对应表，或者项目树，
 *   或者其他还有助于指哪打哪的方式」
 *
 * 这个工具的定位不是"文档"，是**动手前的第一站**：
 *   以前要改一个东西，得先想"这在哪个文件"→ grep → 再想"会不会动到别的"
 *   → 再想"跑哪几条断言"。三跳全靠记忆。
 * 现在：
 *   who.js 海波             → 命中的代码位置 / 断言组 / 交付文档
 *   who.js --impact map3d   → 谁依赖它、涉及哪些断言、建议跑哪条命令
 *   who.js --tree           → 项目树（按分包 + 功能域）
 *   who.js --assets actors  → 资产链（谁加载、多大）
 *   who.js --drift          → 各处硬编码清单与权威清单的差异
 *
 * 索引来自 gen_index.js（自动生成）。这里**只读不写**。
 * ============================================================ */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.resolve(__dirname, '..', '..', '..');
var JS = path.join(ROOT, 'js');
var IDX = path.join(ROOT, '.workbuddy', 'index', 'project-index.json');
var MODS = path.join(JS, 'modules.json');

function readLF(p) { return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'); }

if (!fs.existsSync(IDX) || !fs.existsSync(MODS)) {
  console.error('索引不存在。先跑：node .workbuddy/tools/map/gen_index.js');
  process.exit(1);
}
var ID = JSON.parse(readLF(IDX));
var MD = JSON.parse(readLF(MODS));

function modByName(n) {
  for (var i = 0; i < MD.modules.length; i++) if (MD.modules[i].name === n) return MD.modules[i];
  return null;
}

/* ---------------- 项目树 ---------------- */
function tree() {
  console.log('项目树（按分包 · 权威来源 js/modules.json）\n');
  var LAYER = { core: '引擎与数据（开局即用）', war: '战斗 / 素材表', ui: '界面 / 3D / 入口' };
  ['core', 'war', 'ui'].forEach(function (b) {
    var list = MD.bundles[b].map(modByName).filter(Boolean);
    var lines = list.reduce(function (a, m) { return a + m.lines; }, 0);
    console.log('■ bundle-' + b + '　' + LAYER[b] + '　' + list.length + ' 模块 / ' + lines.toLocaleString() + ' 行');
    list.sort(function (a, b2) { return b2.lines - a.lines; }).forEach(function (m) {
      var duty = m.duty ? '　' + m.duty : '';
      console.log('　　' + m.name.padEnd(13) + String(m.lines).padStart(6) + ' 行'
        + (m.deps && m.deps.length ? '  ←' + m.deps.length : '') + duty);
    });
    console.log('');
  });
  var notIn = MD.problem.notInOrder;
  if (notIn.length) console.log('⚠️ 磁盘上有但未登记（不会进 bundle）：' + notIn.join(', '));
  console.log('合计 ' + MD.modules.length + ' 模块 · 源码指纹 ' + MD.sourceHash);
}

/* ---------------- 资产链 ---------------- */
function assets(prefix) {
  var list = ID.assets;
  if (prefix) list = list.filter(function (a) { return a.path.indexOf(prefix) >= 0; });
  if (!list.length) { console.log('没有匹配的资产'); return; }

  /* 按目录归并：530 个文件逐条列没人看得完 */
  var byDir = {};
  list.forEach(function (a) {
    var d = a.path.split('/').slice(0, 2).join('/');
    if (!byDir[d]) byDir[d] = { n: 0, bytes: 0, kinds: {}, refs: {}, samples: [] };
    var g = byDir[d];
    g.n++; g.bytes += a.bytes;
    g.kinds[a.kind] = (g.kinds[a.kind] || 0) + 1;
    a.refs.forEach(function (r) { g.refs[r] = (g.refs[r] || 0) + 1; });
    if (g.samples.length < 3) g.samples.push(a.path.split('/').pop());
  });

  console.log('资产链（' + list.length + ' 个文件 / ' + (list.reduce(function (a, b) { return a + b.bytes; }, 0) / 1048576).toFixed(0) + ' MB）\n');  Object.keys(byDir).sort().forEach(function (d) {
    var g = byDir[d];
    var kinds = Object.keys(g.kinds).map(function (k) { return k + '×' + g.kinds[k]; }).join(' ');
    var loaders = Object.keys(g.refs).sort(function (a, b) { return g.refs[b] - g.refs[a]; });
    /* 文件级匹配为空时退回**目录级**：拼路径（'assets/actors/' + name + '.glb'）
       在源码里没有文件名，文件级永远空 —— 这不是"未使用"，是"写法抓不到"。 */
    var dirLoaders = (ID.assetDirs && ID.assetDirs[d]) || [];
    var loaderText = loaders.length
      ? loaders.join(', ')
      : (dirLoaders.length
        ? dirLoaders.join(', ') + '　（目录级：代码用拼路径，抓不到文件名）'
        : '（未在代码里找到引用 —— 可能是未用资产）');
    console.log('■ ' + d + '　' + g.n + ' 个 / ' + (g.bytes / 1048576).toFixed(0) + ' MB　[' + kinds + ']');
    console.log('　　加载方：' + loaderText);
    console.log('　　示例：' + g.samples.join(', '));
    console.log('');
  });
  console.log('注：引用匹配是"路径或文件名子串"，同名文件可能误报；改资产前用 --impact 看具体模块。');
}

/* ---------------- 影响面 ---------------- */
function impact(arg) {
  var name = arg.replace(/^js\//, '').replace(/\.js$/, '');
  var m = modByName(name);
  if (!m) {
    /* 也许给的是符号名 */
    var s = ID.symbols[arg] || ID.symbols['ui.' + arg];
    if (s) {
      console.log('【符号】' + arg + ' → ' + s.file + ':' + s.line + '（模块 ' + s.module + '）');
      return impact(s.module);
    }
    console.log('未知模块：' + name + '。用 --tree 看有哪些。');
    return;
  }

  var users = MD.modules.filter(function (o) {
    return o.name !== name && o.deps && o.deps.indexOf(name) >= 0;
  }).map(function (o) { return o.name; });

  var uses = (m.deps || []);

  /* 断言：段内提及该文件的；再加上段内提及"引用了它的模块"的（间接） */
  /* 索引里 files 存的是模块名（map3d），不带 .js —— 第一版带后缀比对，恒为空 */
  var direct = ID.checks.filter(function (c) { return c.files.indexOf(name) >= 0; });
  var indirect = ID.checks.filter(function (c) {
    if (c.files.indexOf(name) >= 0) return false;
    return c.files.some(function (f) { return users.indexOf(f) >= 0; });
  });

  console.log('【影响面】' + name + '　' + m.file + '　' + m.lines + ' 行　bundle-' + m.bundle);
  if (m.duty) console.log('　　职责：' + m.duty);
  console.log('');
  console.log('　▼ 它依赖（改动可能被这些的接口变化打断）：' + (uses.length ? uses.join(', ') : '（无）'));
  console.log('　▲ 依赖它的（改它要考虑这些）：' + (users.length ? users.join(', ') : '（无）'));
  console.log('');
  console.log('　§ 直接相关断言 ' + direct.length + ' 组：' +
    (direct.length ? direct.map(function (c) { return '§' + c.id; }).join(' ') : '（无）'));
  /* 间接断言只有"直接为 0"时才有诊断价值。直接有 16 组时再列 148 组间接，
     纯噪声 —— 人会以为要跑 148 组。 */
  if (!direct.length && indirect.length) {
    console.log('　　无直接关联；间接（经由上游模块，仅供参考）' + indirect.length + ' 组：' +
      indirect.slice(0, 8).map(function (c) { return '§' + c.id; }).join(' ') + ' …');
  }
  /* 资产链：改了这个模块，哪些资产会跟着受影响。
     这是"资产链"最容易断的一环 —— 代码在 js/，模型在 assets/，两边没有任何 import 关系。 */
  var relAssets = ID.assets.filter(function (a) { return a.refs.indexOf(m.file) >= 0; });
  var relDirs = Object.keys(ID.assetDirs || {}).filter(function (d) {
    return (ID.assetDirs[d] || []).indexOf(m.file) >= 0;
  });
  if (relAssets.length || relDirs.length) {
    var byDir = {};
    relAssets.forEach(function (a) {
      var d = a.path.split('/').slice(0, 2).join('/');
      byDir[d] = (byDir[d] || 0) + 1;
    });
    console.log('');
    if (Object.keys(byDir).length) {
      console.log('　◆ 相关资产（文件级匹配）' + relAssets.length + ' 个：' +
        Object.keys(byDir).map(function (d) { return d + '(' + byDir[d] + ')'; }).join('　'));
    }
    if (relDirs.length) {
      /* 目录级 = 代码里是"拼路径"（assets/actors/' + name + '.glb'），抓不到文件名。
         这恰恰是最需要提示的：改这个模块会影响整类资产。 */
      console.log('　◆ 相关资产（目录级：代码用拼路径，按目录算）' + relDirs.join('　'));
    }
  }

  /* 立姿/尺度标定表：角色资产的"第二个入口"。
     换模型时除了文件，还要改 gltf.js 里的 GTF.FIT —— 不知道这条会白折腾半天。 */
  if (name === 'gltf' && ID.fits && Object.keys(ID.fits).length) {
    console.log('');
    console.log('　◆ 角色标定表 GTF.FIT（改模型/改尺寸要一起改这里）：');
    Object.keys(ID.fits).forEach(function (k) {
      var f = ID.fits[k];
      console.log('　　　' + k.padEnd(18) + 'scale=' + (f.scale || '-') +
        '　stand=' + (f.stand || '-') + '　footY=' + (f.footY || '0'));
    });
  }

  var nCheck = direct.reduce(function (a, c) { return a + c.count; }, 0);
  console.log('');
  console.log('　　建议验证顺序：');
  console.log('　　　1) 语法　 node --check ' + m.file);
  console.log('　　　2) 冒烟　 node .workbuddy/tools/prof/smoke_slice.js --changed ' + m.file + ' --run');
  console.log('　　　3) 构建　 python .workbuddy/tools/patch/build_bundle.py');
  console.log('　　　4) 全量　 ' + (nCheck > 40 ? '改动较大（' + nCheck + ' 条直接断言），跑全量 smoke' : '按需跑全量 smoke'));
}

/* ---------------- 关键词检索 ---------------- */
function search(kw) {
  var hits = { code: [], checks: [], docs: [], assets: [] };

  /* ① 代码：逐文件找关键词，输出行号与上下文 */
  fs.readdirSync(JS).filter(function (f) {
    return /\.js$/.test(f) && !/^bundle-/.test(f) && f !== 'ui-all.js';
  }).forEach(function (f) {
    var lines = readLF(path.join(JS, f)).split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(kw) < 0) continue;
      hits.code.push({
        file: 'js/' + f, line: i + 1,
        text: lines[i].replace(/^\s+/, '').slice(0, 90)
      });
      if (hits.code.length > 60) return;
    }
  });

  /* ② 断言标题 */
  ID.checks.forEach(function (c) {
    if ((c.title && c.title.indexOf(kw) >= 0)) hits.checks.push(c);
  });

  /* ③ 交付文档 */
  var dd = path.join(ROOT, 'docs', '_史料', '交付');
  if (fs.existsSync(dd)) {
    fs.readdirSync(dd).filter(function (f) { return /\.md$/.test(f); }).forEach(function (f) {
      if (f.indexOf(kw) >= 0) { hits.docs.push('docs/_史料/交付/' + f); return; }
      var body = readLF(path.join(dd, f));
      if (body.indexOf(kw) >= 0) {
        var first = body.split('\n').filter(function (L) { return L.indexOf(kw) >= 0; })[0] || '';
        hits.docs.push('docs/_史料/交付/' + f + '　｜ ' + first.replace(/^[#*\s]+/, '').slice(0, 60));
      }
    });
  }

  /* ④ 资产 */
  hits.assets = ID.assets.filter(function (a) { return a.path.indexOf(kw) >= 0; }).slice(0, 8);

  var total = hits.code.length + hits.checks.length + hits.docs.length + hits.assets.length;
  console.log('【关键词】' + kw + '　命中 ' + total + ' 处\n');

  if (hits.code.length) {
    console.log('■ 代码（' + hits.code.length + (hits.code.length > 60 ? '+' : '') + ' 行）');
    hits.code.slice(0, 14).forEach(function (h) {
      console.log('　' + (h.file + ':' + h.line).padEnd(26) + h.text);
    });
    if (hits.code.length > 14) console.log('　… 另有 ' + (hits.code.length - 14) + ' 行');
    console.log('');
  }
  if (hits.checks.length) {
    console.log('■ 断言组（' + hits.checks.length + '）');
    hits.checks.forEach(function (c) {
      console.log('　§' + c.id + '　' + (c.title || '(无标题)') + '　' + c.count + ' 条　' +
        (c.files.length ? c.files.join(',') : ''));
    });
    console.log('');
  }
  if (hits.assets.length) {
    console.log('■ 资产（' + hits.assets.length + '）');
    hits.assets.forEach(function (a) { console.log('　' + a.path + '　' + (a.bytes / 1024).toFixed(0) + ' KB　← ' + (a.refs.join(',') || '无引用')); });
    console.log('');
  }
  if (hits.docs.length) {
    console.log('■ 交付文档（' + hits.docs.length + '）');
    hits.docs.forEach(function (d) { console.log('　' + d); });
    console.log('');
  }

  /* 建议命令：从命中文件里取最主要的那个模块 */
  var freq = {};
  hits.code.forEach(function (h) {
    var n = h.file.replace(/^js\//, '').replace(/\.js$/, '');
    freq[n] = (freq[n] || 0) + 1;
  });
  var top = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; })[0];
  if (top) {
    console.log('→ 下一步：node .workbuddy/tools/map/who.js --impact ' + top);
    console.log('　　　　　node .workbuddy/tools/prof/smoke_slice.js --changed js/' + top + '.js --run');
  }
}

/* ---------------- 清单对账 ---------------- */
function drift() {
  console.log('【清单对账】权威 = js/modules.json（' + MD.modules.length + ' 模块）\n');
  ID.hardcoded.forEach(function (t) {
    if (!t.exists) { console.log('■ ' + t.file + '　（不存在）'); return; }
    console.log('■ ' + t.file + '　' + t.note);
    if (!t.lists.length) { console.log('　（未发现模块清单）'); console.log(''); return; }
    t.lists.forEach(function (l) {
      var tag = l.ok ? '✓' : '✗';
      console.log('　' + tag + ' ' + l.name + '（行 ' + l.line + ' · ' + (l.kind === 'full' ? '全量' : '子集') + ' · ' + l.count + ' 项）');
      if (l.missing.length) console.log('　　　漏：' + l.missing.join(', ') + '　← 覆盖率下降（假绿）');
      if (l.extra.length) console.log('　　　多：' + l.extra.join(', ') + '　← 会 ReferenceError（假红）');
    });
    console.log('');
  });
}

/* ---------------- 入口 ---------------- */
(function main() {
  var a = process.argv.slice(2);
  if (!a.length) {
    console.log('用法：');
    console.log('  node .workbuddy/tools/map/who.js 海波              # 按关键词反查');
    console.log('  node .workbuddy/tools/map/who.js --impact map3d    # 影响面 + 建议验证顺序');
    console.log('  node .workbuddy/tools/map/who.js --tree            # 项目树（分包/行数/职责）');
    console.log('  node .workbuddy/tools/map/who.js --assets actors   # 资产链');
    console.log('  node .workbuddy/tools/map/who.js --drift           # 硬编码清单对账');
    console.log('');
    console.log('索引：' + ID.counts.modules + ' 模块 / ' + ID.counts.symbols + ' 符号 / '
      + ID.counts.checks + ' 断言组 / ' + ID.counts.assets + ' 资产　（源码指纹 ' + ID.sourceHash + '）');
    return;
  }
  if (a[0] === '--tree') return tree();
  if (a[0] === '--assets') return assets(a[1] || '');
  if (a[0] === '--drift') return drift();
  if (a[0] === '--impact') { if (!a[1]) { console.log('要给模块名，例如 --impact map3d'); return; } return impact(a[1], true); }
  if (a[0] === '--impact-sym') return impact(a[1]);
  return search(a.join(' '));
})();
