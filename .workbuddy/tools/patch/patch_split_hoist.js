/* v156.27b：让 split_ui.js 自动处理「跨功能的顶层局部变量」。
 *
 * 事故：第一次拆分只给每段注入了 GAME/DATA/U/$/$$，
 *   漏了 3 个被多个功能域共用的常量表：
 *     EQUIP_SLOT_ORDER（ui-bag 定义，ui-craft 用）
 *     BAG_LEGACY_TAB（ui-bag 定义，ui-view 用）
 *     BLDG_FUNC（ui-build 定义，ui-battle + ui-view 用）
 *   → e2e 直接报 `BAG_LEGACY_TAB is not defined`（而且 ui-battle 比 ui-build 先加载，
 *     光加别名也没用，必须把定义前移）。
 *
 * 做法：
 *   ① 从原文件里把这三个定义块（括号配平到语句结束）**摘出来**
 *   ② 统一放到 ui.js 的初始化区，并挂到 `ui._C`
 *   ③ 每个 ui-*.js 若用到其中某个名字，头部加 `var X = ui._C.X;`
 *   函数体一个字不改（所以函数快照仍然逐条一致）。
 *
 * 用法：node .workbuddy/tools/patch/patch_split_hoist.js
 */
'use strict';
var fs = require('fs');
var p = '.workbuddy/tools/patch/split_ui.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('HOIST') >= 0) { console.log('SKIP: 已修'); process.exit(0); }

/* ---- ① 在 PLAN 后面插入 HOIST 配置与提取逻辑 ---- */
var anchorPlan = "/* ---- 吸附：往前找最近的分节标题，保证不切断函数体 ---- */";
if (s.indexOf(anchorPlan) < 0) { anchorPlan = '/* ============================================================\n * 切点判定'; }
if (s.indexOf(anchorPlan) < 0) { console.error('✗ PLAN 之后找不到插入点'); process.exit(1); }

var hoistBlock = `/* ============================================================
 * HOIST —— 「跨功能的顶层局部变量」
 * ------------------------------------------------------------
 * 拆分前它们在同一个 IIFE 里全文件可见；拆成 19 个 IIFE 后就断了。
 * 这三个都是纯常量表（数组/对象字面量，不依赖运行时），可以安全前移。
 * ⚠️ 其中 BLDG_FUNC 被 ui-battle（先加载）引用 —— 所以必须**定义前移**，
 *    光在引用文件里加别名会拿到 undefined。
 * 判据来源：node .workbuddy/tools/prof/find_shared_vars.js --file .workbuddy/backup/ui.js.bak
 * ============================================================ */
var HOIST = ['EQUIP_SLOT_ORDER', 'BAG_LEGACY_TAB', 'BLDG_FUNC'];

/* 取出一个顶层 var 的完整定义块（括号配平 + 以分号结束） */
function findVarBlock(name) {
  var re = new RegExp('^  var ' + name + '\\\\s*=');
  for (var i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    var d = 0, j = i;
    for (; j < lines.length; j++) {
      for (var c = 0; c < lines[j].length; c++) {
        var ch = lines[j][c];
        if (ch === '{' || ch === '[' || ch === '(') d++;
        else if (ch === '}' || ch === ']' || ch === ')') d--;
      }
      if (d <= 0 && /;\\s*$/.test(lines[j])) break;
    }
    return { name: name, start: i, end: j + 1, text: lines.slice(i, j + 1) };
  }
  return null;
}

var HOISTED = HOIST.map(findVarBlock).filter(Boolean);
HOIST.forEach(function (n) {
  if (!HOISTED.some(function (h) { return h.name === n; })) {
    console.error('✗ 找不到 HOIST 变量定义：' + n);
    process.exit(1);
  }
});

/* ---- 吸附：往前找最近的分节标题，保证不切断函数体 ---- */`;

s = s.replace(anchorPlan, hoistBlock, 1);

/* ---- ② 切段时，把 HOIST 块的行从段内容里剔除 ---- */
var oldSlice = `  var body = lines.slice(c.start, end);`;
var newSlice = `  /* 剔除已被前移到 ui.js 的共享常量块（否则会重复定义 → 后定义的覆盖前定义的） */
  var body = [];
  for (var bi = c.start; bi < end; bi++) {
    var ho = null;
    for (var hi = 0; hi < HOISTED.length; hi++) {
      if (bi >= HOISTED[hi].start && bi < HOISTED[hi].end) { ho = HOISTED[hi]; break; }
    }
    if (ho) { bi = ho.end - 1; continue; }
    body.push(lines[bi]);
  }`;
if (s.indexOf(oldSlice) < 0) { console.error('✗ slice anchor'); process.exit(1); }
s = s.replace(oldSlice, newSlice, 1);

/* ---- ③ ui.js 头部写入常量 + ui._C；各段按需加别名 ---- */
var oldHead = `    out.push('  ui._dom = { $: $, $$: $$ };');
    return out;`;
var newHead = `    out.push('  ui._dom = { $: $, $$: $$ };');
    out.push('');
    out.push('  /* ============================================================');
    out.push('   * 跨功能域共用的常量表（v156.27 拆分时前移到这里）');
    out.push('   * ------------------------------------------------------------');
    out.push('   * 它们原来散在 ui.js 各处，被多个功能域引用；拆成独立文件后');
    out.push('   * 各自 IIFE 互相看不见，所以统一放在**最先执行**的这里，');
    out.push('   * 其余文件用 var X = ui._C.X; 取同一个对象（不是副本）。');
    out.push('   * ⛔ 不要在各 ui-*.js 里再写一份：那样会出现多个副本，改一个不生效。');
    out.push('   * ============================================================ */');
    out.push('  ui._C = {};');
    HOISTED.forEach(function (h) {
      h.text.forEach(function (L) { out.push(L); });
      out.push('  ui._C.' + h.name + ' = ' + h.name + ';');
      out.push('');
    });
    return out;`;
if (s.indexOf(oldHead) < 0) { console.error('✗ head anchor'); process.exit(1); }
s = s.replace(oldHead, newHead, 1);

/* 非首段：按需加别名 */
var oldSub = `  out.push('  var $ = ui._dom.$, $$ = ui._dom.$$;');
  return out;`;
var newSub = `  out.push('  var $ = ui._dom.$, $$ = ui._dom.$$;');
  return out;`;
if (s.indexOf(oldSub) < 0) { console.error('✗ sub anchor'); process.exit(1); }

/* ---- ④ 段内容拼装后，按"是否用到"注入别名 ---- */
var oldOut = `  var out = head(c.name, c.title, false).concat(body).concat(['})();']);`;
var newOut = `  var out = head(c.name, c.title, false);
  /* 这段用到了哪些共享常量？给它们取别名（指向 ui._C 的同一个对象） */
  var bodyText = body.join('\\n');
  HOISTED.forEach(function (h) {
    if (new RegExp('(^|[^.\\\\w$])' + h.name + '\\\\b').test(bodyText)) {
      out.push('  /* 共享常量（定义在 ui.js 的 ui._C 里，全站唯一一份） */');
      out.push('  var ' + h.name + ' = ui._C.' + h.name + ';');
      out.push('');
    }
  });
  out = out.concat(body).concat(['})();']);`;
if (s.indexOf(oldOut) < 0) { console.error('✗ out anchor'); process.exit(1); }
s = s.replace(oldOut, newOut, 1);

fs.writeFileSync(p, s, 'utf8');
console.log('split_ui.js: HOIST 已接入（共享常量前移 + 按需别名）');
