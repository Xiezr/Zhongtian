'use strict';
/* ============================================================
 * gen_index.js —— 项目索引生成器（唯一真相源）
 * ------------------------------------------------------------
 * 老板 2026-11-01：「是否可以建立一个资产链，或者逻辑对应表，或者项目树，
 *   或者其他还有助于指哪打哪的方式」
 *
 * 设计三条铁律（都是被这轮 ui.js 拆分打出来的）：
 *   ① **自动生成，不手写**。手写清单必腐化 —— 上一轮就发现同一个"模块清单"
 *      在仓库里有 8 份，加一个模块要改 8 处，漏一处就假红/假绿。
 *   ② **必须被消费**。build_bundle.py 从这里读 ORDER，否则它只是第 9 份清单。
 *   ③ **可对账**。各处仍硬编码的清单要跟这里比对，不一致就报红（先不改它们，
 *      先让不同步**可见**，再逐个收编）。
 *
 * 产物：
 *   js/modules.json                  权威清单（顺序/分包/职责/依赖）→ 给构建与工具读
 *   .workbuddy/index/project-index.json  查询库（符号/断言/资产/引用位置）→ 给 who.js 读
 *
 * 用法：
 *   node .workbuddy/tools/map/gen_index.js           生成
 *   node .workbuddy/tools/map/gen_index.js --check   只核对（不写盘），有漂移则退出码 1
 * ============================================================ */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.resolve(__dirname, '..', '..', '..');
var JS = path.join(ROOT, 'js');
var OUT_MODULES = path.join(JS, 'modules.json');
var OUT_INDEX = path.join(ROOT, '.workbuddy', 'index', 'project-index.json');
var BUILD_PY = path.join(ROOT, '.workbuddy', 'tools', 'patch', 'build_bundle.py');
var SMOKE = path.join(ROOT, 'smoke-test.js');

var CHECK_ONLY = process.argv.indexOf('--check') >= 0;

/* ---------------- 小工具 ---------------- */
function readLF(p) { return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'); }
function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }

function listModules() {
  return fs.readdirSync(JS).filter(function (f) {
    return /\.js$/.test(f) && !/^bundle-/.test(f) && f !== 'ui-all.js';
  }).map(function (f) { return f.replace(/\.js$/, ''); });
}

/* ---------------- ① 「顺序 / 分包」从哪来（打破循环依赖） ---------------- */
/* ============================================================
 * 这里有个必须先想清楚的**循环**：
 *   构建脚本要读清单（不然清单就是第 9 份废纸）
 *   生成器要读构建脚本（不然顺序从哪来）
 *
 * 打破方式：**清单自己存 layout，且 layout 只在"首次迁移"时来自构建脚本**。
 *   第一次：modules.json 还没有 layout → 从 build_bundle.py 的 ORDER/WAR/UI_SPLIT 抄一份
 *   之后  ：一律读 modules.json 的 layout；build_bundle.py 反过来读它
 *   加模块：只改 modules.json 的 layout.order（一处），构建与索引自动跟上
 * ============================================================ */
function parseBuildOrder() {
  var src = readLF(BUILD_PY);
  function grabList(name) {
    var m = new RegExp(name + '\\s*=\\s*\\[([\\s\\S]*?)\\]').exec(src);
    if (!m) return [];
    return (m[1].match(/'([a-z0-9-]+)'/g) || []).map(function (s) { return s.replace(/'/g, ''); });
  }
  var uiLine = (/UI\s*=\s*(\[[^\]]*\])\s*\+\s*UI_SPLIT\s*\+\s*(\[[^\]]*\])/.exec(src) || []);
  var ui = [];
  if (uiLine.length === 3) {
    var head = (uiLine[1].match(/'([a-z0-9-]+)'/g) || []).map(function (s) { return s.replace(/'/g, ''); });
    var tail = (uiLine[2].match(/'([a-z0-9-]+)'/g) || []).map(function (s) { return s.replace(/'/g, ''); });
    ui = head.concat(grabList('UI_SPLIT'), tail);
  }
  return { order: grabList('ORDER'), war: grabList('WAR'), uiSplit: grabList('UI_SPLIT'), ui: ui };
}

function loadLayout() {
  if (fs.existsSync(OUT_MODULES)) {
    try {
      var o = JSON.parse(readLF(OUT_MODULES));
      if (o.layout && o.layout.order && o.layout.order.length) {
        return { layout: o.layout, from: 'js/modules.json' };
      }
    } catch (e) { /* 坏了就走迁移 */ }
  }
  var b = parseBuildOrder();
  if (!b.order.length) {
    console.error('✗ 既没有 js/modules.json 的 layout，也读不到构建脚本的 ORDER。无法确定加载顺序。');
    process.exit(1);
  }
  return {
    layout: { order: b.order, war: b.war, uiSplit: b.uiSplit },
    from: '.workbuddy/tools/patch/build_bundle.py（首次迁移，之后以 modules.json 为准）'
  };
}

/* ---------------- ② 单模块元信息 ---------------- */
/* ⚠️ 导出提取的坑（第一版就踩了）：
     原正则要求行首恰好 "  GAME.xxx ="，而实际代码大量写成
       `var M = GAME.map3d = { … }`   /   `GAME.mapSphere = SP = { … }`
     行首不是 GAME，于是 map3d 的导出**全部为空** → 依赖图里没有任何人
     "依赖 map3d" → --impact 显示"依赖它的（无）"，把一个枢纽模块报成孤岛。
   改成"任意位置的 GAME.x =（x 后面不能是点）"即可。
   另外 M. 不收：它是各文件内部的别名（`var M = GAME.map3d`），不是命名空间挂载，
   收了会造出 "M.xxx" 这种不存在的符号。 */
var RE_EXPORT = [
  [/\bGAME\.([A-Za-z_$][\w$]*)\s*=(?![=>])/g, 'GAME'],
  [/\bui\.([A-Za-z_$][\w$]*)\s*=(?![=>])/g, 'ui'],
  [/\bDATA\.([A-Za-z_$][\w$]*)\s*=(?![=>])/g, 'DATA'],
  [/\bSP\.([A-Za-z_$][\w$]*)\s*=(?![=>])/g, 'SP'],
  [/\bF\.([A-Za-z_$][\w$]*)\s*=(?![=>])/g, 'F'],
  [/\bU\.([A-Za-z_$][\w$]*)\s*=(?![=>])/g, 'U']
];

function dutyOf(lines) {
  /* 职责 = 文件头注释里第一句有信息量的中文/英文说明。
     跳过 "=====" 分隔线、跳过 vNNN 变更记录行、跳过纯符号行。 */
  var head = lines.slice(0, 30).join('\n');
  var blocks = head.split(/\n/);
  for (var i = 0; i < blocks.length; i++) {
    var t = blocks[i].replace(/^\s*(\/\*+|\*+|\/\/+)\s?/, '').replace(/\*+\/\s*$/, '').trim();
    if (!t) continue;
    if (/^=+$/.test(t)) continue;
    if (/^v\d/.test(t)) continue;
    if (/^-+$/.test(t)) continue;
    if (/^(use strict|'use strict')/.test(t)) continue;
    if (t.length < 4) continue;
    return t.length > 60 ? t.slice(0, 60) + '…' : t;
  }
  return '';
}

function scanModule(name, order, bundleOf) {
  var file = 'js/' + name + '.js';
  var full = path.join(JS, name + '.js');
  if (!fs.existsSync(full)) return null;
  var src = readLF(full);
  var lines = src.split('\n');

  var exports = {};          /* "GAME.map3d" -> line */
  RE_EXPORT.forEach(function (pair) {
    var re = pair[0], ns = pair[1];
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      var line = src.slice(0, m.index).split('\n').length;
      exports[ns + '.' + m[1]] = line;
    }
  });

  return {
    name: name,
    file: file,
    lines: lines.length,
    bundle: bundleOf[name] || '?',
    duty: dutyOf(lines),
    exports: exports,
    _src: src
  };
}

/* ---------------- ③ 依赖：命名空间级引用 → 归属模块 ---------------- */
/* ⚠️ 这里最容易做成"全连接"（第一版就是）：
 *   我原来统计"模块里出现了别的模块导出的任何符号"，于是
 *     `GAME.newGame()` / `GAME.log()` 这类**顶层函数调用**
 *     也被算成"依赖 domain / state"，结果每个模块都依赖 80+ 个模块 ——
 *     图上全连，等于没图。
 *
 * 现在只认两种**真依赖**：
 *   ① `GAME.<ns>.xxx`  —— 二层访问，ns 是被当命名空间用的（map3d/sphere/domain…）
 *   ② `ui.<fn>` / `DATA.<x>` / `SP.<x>` / `F.<x>` —— 符号级精确归属
 * 顶层函数调用（`GAME.newGame()`）不计入模块依赖：那是全局 API，不是模块边界。
 */
function computeDeps(mods) {
  /* 符号 → 模块 */
  var symOwner = {};
  mods.forEach(function (m) {
    Object.keys(m.exports).forEach(function (sym) { symOwner[sym] = m.name; });
  });

  /* 哪些名字被当命名空间用（源码里出现 `GAME.x.`） */
  var nsUsed = {};
  mods.forEach(function (m) {
    var re = /\bGAME\.([A-Za-z_$][\w$]*)\s*\./g, mm;
    while ((mm = re.exec(m._src))) nsUsed[mm[1]] = 1;
  });

  /* ============================================================
   * 每个文件自己的**别名表**：`var F = GAME.fog` → F 在**本文件**才指 fog
   * ------------------------------------------------------------
   * 踩到的假阳性（v156.28 实测）：`ui-view.js:1132` 写的是
   *     var F = GAME.faction;   … F.ensure() / F.stats()
   * 而 fog.js 里也有 `F.ensure` 这些符号 —— 于是索引判"ui-view 依赖 fog"，
   * 实际它依赖的是 **faction**。
   * 单字母别名（F/U/M/S/P）在 60+ 个文件里各自指向不同对象，按"符号名"归属必然串味。
   * 正解：先按文件解析别名，再判依赖。
   * ============================================================ */
  mods.forEach(function (m) {
    var alias = {};
    var re = /\bvar\s+([A-Za-z_$][\w$]*)\s*=\s*GAME\.([A-Za-z_$][\w$]*)/g, a;
    while ((a = re.exec(m._src))) {
      if (!alias[a[1]]) alias[a[1]] = a[2];
    }
    /* `var SP = GAME.sphere` 这类已经覆盖；再补 `X = GAME` 整体赋值（少见，防御） */
    m._alias = alias;
  });

  mods.forEach(function (m) {
    var deps = {};
    function add(sym) {
      var owner = symOwner[sym];
      if (owner && owner !== m.name) deps[owner] = (deps[owner] || 0) + 1;
    }
    var alias = m._alias || {};

    /* ① `GAME.<ns>.xxx` —— 明确的二层访问 */
    var reNs = /\bGAME\.([A-Za-z_$][\w$]*)\s*\./g, a;
    while ((a = reNs.exec(m._src))) {
      var ns = a[1];
      if (nsUsed[ns]) add('GAME.' + ns);
    }

    /* ② `<别名>.xxx` —— 按**本文件的别名表**解析后再归属
          （不在别名表里的单字母一律忽略：无法确定它指向谁，宁缺勿错） */
    var reAl = /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g, b;
    while ((b = reAl.exec(m._src))) {
      var base = b[1];
      if (base === 'GAME' || base === 'DATA' || base === 'ui') continue;  /* 走 ③ */
      if (!alias[base]) continue;
      add('GAME.' + alias[base]);
    }

    /* ③ 全局命名空间下的符号级引用（ui.fn / DATA.x） */
    [['ui', /\bui\.([A-Za-z_$][\w$]*)/g], ['DATA', /\bDATA\.([A-Za-z_$][\w$]*)/g]]
      .forEach(function (pair) {
        var re = pair[1], mm2;
        while ((mm2 = re.exec(m._src))) add(pair[0] + '.' + mm2[1]);
      });

    m.deps = Object.keys(deps).sort(function (a2, b2) { return deps[b2] - deps[a2]; });
    m.depWeight = deps;
    delete m._src;
    delete m._alias;
  });
}

/* ---------------- ④ 断言组：§N → 涉及文件 ---------------- */
/* ⚠️ 分组的坑（第一版）：
     我把"每条 check('§N …')"都当成锚点，于是同一组的多条断言互为边界，
     §587（7 条 check）被切成 7 个"只含 1 条"的组，`files` 也只剩最后一条的上下文
     → --impact map3d 只报"1 组相关断言"，把 12 组全丢了。
   正解：**按编号聚合**。一个 §N 的范围 = 它第一次出现 → 下一个**不同编号**第一次出现。
   这样同组的多条 check（写在段中间各处）都被收进来。 */
function scanChecks(modNames, symOwner) {
  if (!fs.existsSync(SMOKE)) return [];
  var src = readLF(SMOKE);
  var lines = src.split('\n');

  /* 先扫一遍：每个编号出现的所有行号 */
  var byId = {};      /* id -> { lines: [], firstLine: n, title: '' } */
  var re = /§(\d+)/;
  for (var i = 0; i < lines.length; i++) {
    var L = lines[i];
    if (L.indexOf('§') < 0) continue;
    var m = re.exec(L);
    if (!m) continue;
    var id = m[1];
    if (!byId[id]) byId[id] = { id: id, lines: [], firstLine: i, title: '' };
    byId[id].lines.push(i);
    /* 标题优先取"组级标记"那行（===== §N 标题 或 check('§N 标题） */
    if (!byId[id].title && (/=====\s*§\d+/.test(L) || /check\(\s*'§\d+/.test(L))) {
      var t = L.replace(/^[\s\S]*?§\d+\s*/, '').replace(/['",)].*$/, '').replace(/[=\s]+$/, '').trim();
      byId[id].title = t.slice(0, 50);
    }
  }

  /* 编号按首次出现排序，范围到"下一个不同编号"的首次出现为止 */
  var ids = Object.keys(byId).sort(function (a, b) { return byId[a].firstLine - byId[b].firstLine; });
  var starts = ids.map(function (id) { return byId[id].firstLine; });

  var nameSet = {};
  modNames.forEach(function (n) { nameSet[n] = 1; });

  return ids.map(function (id, k) {
    var g = byId[id];
    var end = (k + 1 < starts.length) ? starts[k + 1] : lines.length;
    var body = lines.slice(g.firstLine, end).join('\n');

    /* 涉及文件，两条路都要走：
       ① 段内直接写了文件名（js/map3d.js、'ui.js'）—— 最直观，但很多断言根本不提文件名；
       ② 段内出现了**别的模块导出的符号**（GAME.map3d.surfaceQuad、ui.openDuelPanel）
          —— 靠符号归属反推。只走 ① 时 map3d 报"0 组相关断言"，实际有十几组。 */
    var files = {};
    (body.match(/[a-z0-9-]+\.js/g) || []).forEach(function (f) {
      var n = f.replace(/\.js$/, '');
      if (nameSet[n]) files[n] = 1;
    });
    (body.match(/\b(?:GAME|DATA|SP|ui|F|U)\.[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?/g) || []).forEach(function (sym) {
      if (symOwner[sym]) { files[symOwner[sym]] = 1; return; }
      var one = sym.split('.').slice(0, 2).join('.');
      if (symOwner[one]) files[symOwner[one]] = 1;
    });

    return {
      id: id,
      title: g.title || '',
      line: g.firstLine + 1,
      count: (body.match(/check\(/g) || []).length,
      files: Object.keys(files).sort()
    };
  }).filter(function (c) { return c.count > 0 || c.files.length > 0; })
    .sort(function (a, b) { return +a.id - +b.id; });
}

/* ---------------- ⑤ 资产链：文件 → 谁引用 ---------------- */
function scanAssets(mods) {
  var root = path.join(ROOT, 'assets');
  if (!fs.existsSync(root)) return { files: [], dirs: {} };
  var out = [];

  /* 只列"叶子文件"，但 .glb.js 是 .glb 的 base64 镜像 —— 单独标出，避免误当两份资产 */
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      var full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); return; }
      var st = fs.statSync(full);
      out.push({
        path: rel(full),
        bytes: st.size,
        kind: (e.name.match(/\.([a-z0-9]+)$/i) || [, '?'])[1].toLowerCase(),
        refs: []
      });
    });
  }
  walk(root);

  /* 引用：在 js/**（含 index.html）里找该资产的路径子串。
     同一目录常被"批量拼路径"，故同时记录目录级引用（如 assets/portraits/pool）。 */
  var sources = fs.readdirSync(JS).filter(function (f) {
    return /\.js$/.test(f) && !/^bundle-/.test(f) && f !== 'ui-all.js';
  }).map(function (f) { return { file: 'js/' + f, src: readLF(path.join(JS, f)) }; });
  var htmlP = path.join(ROOT, 'index.html');
  if (fs.existsSync(htmlP)) sources.push({ file: 'index.html', src: readLF(htmlP) });

  out.forEach(function (a) {
    var base = a.path.split('/').pop();
    sources.forEach(function (s) {
      if (s.src.indexOf(a.path) >= 0 || s.src.indexOf(base) >= 0) {
        a.refs.push(s.file);
      }
    });
    /* 去重 */
    a.refs = a.refs.filter(function (v, i, arr) { return arr.indexOf(v) === i; });
  });

  /* ============================================================
   * 目录级引用：拼路径的写法抓不到文件名
   * ------------------------------------------------------------
   * `assets/actors/' + name + '.glb'` 这种拼接，源码里没有 "Soldier.glb" 字面量，
   * 于是文件级匹配全部落空 —— 实测 --impact gltf 一个资产都不显示，
   * 而这个模块恰恰是"加载全部角色模型"的那一个。
   * 这里退一步记"谁引用了 assets/<dir>/"，用目录说明关系。
   * ============================================================ */
  var dirs = {};
  var dirSet = {};
  out.forEach(function (a) {
    var d = a.path.split('/').slice(0, 2).join('/');
    dirSet[d] = 1;
  });
  Object.keys(dirSet).forEach(function (d) {
    sources.forEach(function (s) {
      if (s.src.indexOf(d + '/') >= 0) {
        if (!dirs[d]) dirs[d] = [];
        dirs[d].push(s.file);
      }
    });
  });

  return { files: out, dirs: dirs };
}

/* ---------------- ⑥ 对账：仓库里其它硬编码清单 ---------------- */
/* ============================================================
 * 这里必须区分两类清单，否则对账全是误报（第一版就踩了）：
 *
 *   全量清单（ORDER / audit.MODULES / smoke 的静态检查列表）
 *     → 判据是"与磁盘模块集合**相等**"：漏一个 = 覆盖率暴跌（假绿），
 *       多一个 = ReferenceError（假红）。
 *   子集清单（WAR / UI_SPLIT）
 *     → 它们本来只装一部分，判据只能是"**成员都得真实存在**"，
 *       不能要求它包含全部模块。
 *
 * 第一版没区分，于是 WAR（9 个）被报"漏了 77 个"—— 一条噪声，
 * 而且会把真正的问题淹掉。
 * ============================================================ */
function scanHardcodedLists(order, mods) {
  var targets = [
    { file: '.workbuddy/tools/patch/build_bundle.py', note: '构建 ORDER / WAR / UI_SPLIT' },
    { file: 'audit.js', note: 'MODULES / REF_MODULES' },
    { file: 'smoke-test.js', note: '静态检查列表 / hash ORDER' }
  ];
  var diskModules = mods.map(function (m) { return m.name; });
  var res = [];

  targets.forEach(function (t) {
    var p = path.join(ROOT, t.file);
    if (!fs.existsSync(p)) { res.push({ file: t.file, note: t.note, exists: false, lists: [] }); return; }
    var src = readLF(p);
    var lines = src.split('\n');
    var lists = [];

    /* 抓形如 xxx = ['a', 'b', ...] 的长数组；成员名"全部"落在模块名集合里才算模块清单
       （这条要求把一堆抓错的业务数组过滤掉了：它们混着中文/大写常量） */
    var re = /([A-Za-z_$][\w$]*)\s*=\s*\[([^\]]{80,})\]/g, m;
    while ((m = re.exec(src))) {
      var names = (m[2].match(/'([a-z0-9-]+)'/g) || []).map(function (s) { return s.replace(/'/g, ''); });
      if (names.length < 5) continue;
      var hit = names.filter(function (n) { return diskModules.indexOf(n) >= 0; });
      if (hit.length / names.length < 0.95) continue;     /* 必须是"清一色模块名" */

      var lineNo = src.slice(0, m.index).split('\n').length;
      /* 覆盖了 ORDER 的 90% 以上 → 全量清单；否则视为子集清单 */
      var covered = order.filter(function (n) { return names.indexOf(n) >= 0; }).length;
      var isFull = order.length > 0 && covered / order.length >= 0.9;

      var missing = isFull ? diskModules.filter(function (n) { return names.indexOf(n) < 0; }) : [];
      var extra = names.filter(function (n) { return diskModules.indexOf(n) < 0; });
      lists.push({
        name: m[1],
        line: lineNo,
        kind: isFull ? 'full' : 'subset',
        count: names.length,
        missing: missing,      /* 全量清单漏项 → 覆盖率暴跌（假绿） */
        extra: extra,          /* 成员不存在 → ReferenceError（假红） */
        ok: missing.length === 0 && extra.length === 0
      });
    }
    res.push({ file: t.file, note: t.note, exists: true, lists: lists });
  });
  return res;
}

/* ---------------- 主流程 ---------------- */
function build() {
  var loaded = loadLayout();
  var layout = loaded.layout;

  /* ui 分包 = order 里落在 uiSplit + 两端固定成员中的那些（不硬编码 head/tail，
     以后往 ui 段里插文件只要改 layout.order + uiSplit 即可） */
  var UI_EDGE = { story: 1, ui: 1, duel3d: 1, map3d: 1, scene3d: 1, main: 1 };
  var build = {
    order: layout.order,
    war: layout.war,
    uiSplit: layout.uiSplit,
    ui: layout.order.filter(function (n) {
      return UI_EDGE[n] || layout.uiSplit.indexOf(n) >= 0;
    })
  };

  var disk = listModules();
  var bundleOf = {};
  build.ui.forEach(function (n) { bundleOf[n] = 'ui'; });
  build.war.forEach(function (n) { bundleOf[n] = 'war'; });
  build.order.forEach(function (n) { if (!bundleOf[n]) bundleOf[n] = 'core'; });

  var mods = disk.map(function (n) { return scanModule(n, build.order, bundleOf); })
    .filter(Boolean)
    .sort(function (a, b) { return a.name.localeCompare(b.name); });

  computeDeps(mods);

  /* 顺序问题：磁盘有但 ORDER 没有 → 不会进 bundle（最隐蔽的一类 bug） */
  var notInOrder = disk.filter(function (n) { return build.order.indexOf(n) < 0; });
  var inOrderNoFile = build.order.filter(function (n) { return disk.indexOf(n) < 0; });

  /* 符号 → 所属模块（断言归属要用） */
  var symOwnerMap = {};
  mods.forEach(function (m) {
    Object.keys(m.exports).forEach(function (sym) { symOwnerMap[sym] = m.name; });
  });
  var checks = scanChecks(disk, symOwnerMap);
  var scanA = scanAssets(mods);
  var assets = scanA.files;
  var assetDirs = scanA.dirs;

  /* 角色资产的**标定表**：资产名 → 缩放 / 立姿角 / 贴地补偿。
     这是"资产链"上最容易漏的一环：换模型 / 改尺寸时，代码在 gltf.js 的 GTF.FIT 里，
     而模型文件在 assets/actors/ 下 —— 光看目录找不到这条关系。 */
  var fits = {};
  try {
    var gsrc = readLF(path.join(JS, 'gltf.js'));
    var fm = /GTF\.FIT\s*=\s*\{([\s\S]*?)\n  \};/.exec(gsrc);
    if (fm) {
      var reFit = /([A-Za-z_$][\w$]*)\s*:\s*\{([^}]*)\}/g, mf;
      while ((mf = reFit.exec(fm[1]))) {
        var body = mf[2];
        /* 取值要**先试数组**：stand 是 [90, 0, 0]，用 [^,}]+ 会在第一个逗号处截断
           得到 "[90"（第一版就这样，把立姿角吞成了半个） */
        var g = function (k) {
          var r = new RegExp(k + '\\s*:\\s*(\\[[^\\]]*\\]|[^,}\\n]+)').exec(body);
          return r ? r[1].trim() : null;
        };
        fits[mf[1]] = { scale: g('scale'), footY: g('footY'), stand: g('stand') };
      }
    }
  } catch (e) { /* 没有 FIT 表就留空 */ }

  var hardcoded = scanHardcodedLists(build.order, mods);

  /* 源码指纹：与 bundle.hash 同口径（模块名 + 内容），用于"索引是否新鲜" */
  var h = crypto.createHash('sha256');
  build.order.concat(notInOrder).forEach(function (n) {
    var p = path.join(JS, n + '.js');
    if (!fs.existsSync(p)) return;
    h.update(n, 'utf8'); h.update('\0'); h.update(readLF(p), 'utf8');
  });
  var sourceHash = h.digest('hex').slice(0, 16);

  var symbols = {};
  mods.forEach(function (m) {
    Object.keys(m.exports).forEach(function (sym) {
      symbols[sym] = { file: m.file, line: m.exports[sym], module: m.name };
    });
    delete m.exports;      /* modules.json 里不需要逐符号明细，省体积 */
    delete m.depWeight;
  });

  var modulesJson = {
    _note: '本文件由 .workbuddy/tools/map/gen_index.js 生成。**layout 是唯一手改处**（加模块只改这里），其余字段每次重跑自动刷新。',
    _why: '唯一权威清单。以前"模块清单"在仓库里有 8 份，加一个模块要改 8 处，漏一处就假红/假绿。',
    /* ============================================================
     * ⛔ v156.42：**bundles 是打包分组，不是依赖分层**。
     * ------------------------------------------------------------
     * 2026-11-02 查清：build_bundle.py 只按 order 拼接三个包，
     * **从不校验依赖方向**。所以 core→ui / war→ui 的调用不是"违规"，
     * 是从来没有这条规则（实测 65 条边 / 177 个调用点，其中 69% 是 compute）。
     * 台账：.workbuddy/layer-debt.json（node .workbuddy/tools/prof/layer_debt.js）
     * 别看到 core/war/ui 三个词就以为有分层约束 —— 它只决定"哪个文件拼进哪个包"。
     * ============================================================ */
    _bundlesAre: 'packaging-only（只决定文件拼进哪个包，不约束谁可以调谁）',
    _layoutFrom: loaded.from,
    sourceHash: sourceHash,
    /* layout：人工可编辑（加载顺序 / 分包归属）；构建脚本与索引都读它 */
    layout: {
      order: build.order,
      war: build.war,
      uiSplit: build.uiSplit
    },
    order: build.order,
    bundles: {
      core: build.order.filter(function (n) { return bundleOf[n] === 'core'; }),
      war: build.order.filter(function (n) { return bundleOf[n] === 'war'; }),
      ui: build.order.filter(function (n) { return bundleOf[n] === 'ui'; })
    },
    problem: {
      notInOrder: notInOrder,          /* 磁盘上有、ORDER 没登记 → 不会被打包 */
      orderWithoutFile: inOrderNoFile  /* ORDER 登记了、文件不在 → 构建会炸 */
    },
    modules: mods
  };

  var indexJson = {
    builtAt: modulesJson.builtAt,
    sourceHash: sourceHash,
    counts: {
      modules: mods.length,
      symbols: Object.keys(symbols).length,
      checks: checks.length,
      assets: assets.length,
      assetBytes: assets.reduce(function (a, b) { return a + b.bytes; }, 0)
    },
    symbols: symbols,
    checks: checks,
    assets: assets,
    assetDirs: assetDirs,
    fits: fits,
    hardcoded: hardcoded
  };

  return { modulesJson: modulesJson, indexJson: indexJson };
}

/* ---------------- 漂移检查 ---------------- */
function driftReport(modulesJson, indexJson) {
  var issues = [];

  if (modulesJson.problem.notInOrder.length) {
    issues.push('磁盘上有但 ORDER 未登记（不会进 bundle）：' + modulesJson.problem.notInOrder.join(', '));
  }
  if (modulesJson.problem.orderWithoutFile.length) {
    issues.push('ORDER 登记了但文件不存在：' + modulesJson.problem.orderWithoutFile.join(', '));
  }

  indexJson.hardcoded.forEach(function (t) {
    if (!t.exists) { issues.push(t.file + ' 不存在'); return; }
    t.lists.forEach(function (l) {
      if (l.ok) return;
      if (l.missing.length) issues.push(t.file + ' 的 ' + l.name + ' 漏了：' + l.missing.join(', '));
      if (l.extra.length) issues.push(t.file + ' 的 ' + l.name + ' 多出（磁盘没有）：' + l.extra.join(', '));
    });
  });

  /* 索引新鲜度：modules.json 里的 sourceHash 与当前源码是否一致 */
  if (fs.existsSync(OUT_MODULES)) {
    try {
      var old = JSON.parse(readLF(OUT_MODULES));
      if (old.sourceHash !== modulesJson.sourceHash) {
        issues.push('js/modules.json 已过期（源码变了没重跑生成器）');
      }
    } catch (e) { issues.push('js/modules.json 解析失败：' + e.message); }
  } else {
    issues.push('js/modules.json 不存在（先跑一次生成器）');
  }

  return issues;
}

/* ---------------- 入口 ---------------- */
(function main() {
  var r = build();

  if (CHECK_ONLY) {
    /* 只核对：此时盘上还是旧索引，"过期"才有意义 */
    var issues = driftReport(r.modulesJson, r.indexJson);
    console.log('【索引对账】');
    console.log('  模块 ' + r.indexJson.counts.modules
      + ' · 符号 ' + r.indexJson.counts.symbols
      + ' · 断言组 ' + r.indexJson.counts.checks
      + ' · 资产 ' + r.indexJson.counts.assets);
    if (!issues.length) { console.log('  ✓ 无漂移'); process.exit(0); }
    issues.forEach(function (s) { console.log('  ✗ ' + s); });
    process.exit(1);
  }

  /* ⚠️ 顺序要紧：**先写盘，再对账**。
     第一版先对账后写盘，于是第一次运行永远报 "js/modules.json 不存在" ——
     一条自造的噪声（真问题被它挤到后面）。 */
  fs.mkdirSync(path.dirname(OUT_INDEX), { recursive: true });
  fs.writeFileSync(OUT_MODULES, JSON.stringify(r.modulesJson, null, 1), 'utf8');
  fs.writeFileSync(OUT_INDEX, JSON.stringify(r.indexJson), 'utf8');

  var issues = driftReport(r.modulesJson, r.indexJson);

  console.log('【索引已生成】sourceHash=' + r.modulesJson.sourceHash);
  console.log('  js/modules.json                     ' + (fs.statSync(OUT_MODULES).size / 1024).toFixed(1) + ' KB');
  console.log('  .workbuddy/index/project-index.json ' + (fs.statSync(OUT_INDEX).size / 1024).toFixed(0) + ' KB');
  console.log('  模块 ' + r.indexJson.counts.modules
    + ' · 符号 ' + r.indexJson.counts.symbols
    + ' · 断言组 ' + r.indexJson.counts.checks
    + ' · 资产 ' + r.indexJson.counts.assets
    + '（' + (r.indexJson.counts.assetBytes / 1048576).toFixed(0) + ' MB）');

  var hc = r.indexJson.hardcoded.filter(function (t) { return t.exists; });
  var full = 0, sub = 0, bad = 0;
  hc.forEach(function (t) {
    t.lists.forEach(function (l) {
      if (l.kind === 'full') full++; else sub++;
      if (!l.ok) bad++;
    });
  });
  console.log('  硬编码清单 ' + (full + sub) + ' 处（全量 ' + full + ' / 子集 ' + sub
    + '），不同步 ' + bad + ' 处');
  if (issues.length) {
    console.log('');
    issues.forEach(function (s) { console.log('  ⚠ ' + s); });
  }
})();
