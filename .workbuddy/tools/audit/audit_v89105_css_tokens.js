'use strict';
/* ============================================================
 * v89.105 · CSS 基调审计（基调统一的前置量测）
 * ------------------------------------------------------------
 * 为什么要有这个脚本：
 *   老板要的是"基调统一、界面好看、间隔固定"。这句话在工程上等于四条硬约束：
 *     ① 字号：只许用 --fs-* 令牌，不许裸 px（裸 px 会让同一层级的文字大小漂移）
 *     ② 间距：只许用 --sp-* 令牌 / 4px 栅格倍数（间隔固定 = 同一节奏的分隔距离）
 *     ③ 圆角：只许用 --r-* 令牌（形状一致性锁）
 *     ④ 颜色：只许用 var(--...)，不许裸 hex（色彩一致性锁）
 *   先把违规**全量列出来**，再谈改 —— 否则改完会出现"改了一处、漏了三处"。
 *
 * 用法：
 *   node .workbuddy/tools/audit/audit_v89105_css_tokens.js            # 汇总
 *   node .workbuddy/tools/audit/audit_v89105_css_tokens.js --list     # 逐条明细
 * ============================================================ */
var fs = require('fs');
var path = require('path');
var R = path.join(__dirname, '..', '..', '..');
var html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');

/* 取 <style> 段（含多条 style） */
var m = html.match(/<style>([\s\S]*?)<\/style>/g) || [];
var css = m.map(function (s) { return s.replace(/<\/?style>/g, ''); }).join('\n');
/* 剥注释：注释里出现的 px/hex 不算违规（本项目踩过这个坑） */
var cssNC = css.replace(/\/\*[\s\S]*?\*\//g, '');

var out = [];
function say(s) { out.push(s); console.log(s); }
var LIST = process.argv.indexOf('--list') >= 0;

/* ---------- 声明块切分：把每条规则的 { } 抓出来，带行号 ---------- */
var lines = cssNC.split('\n');
var decls = [];      // { line, prop, val, sel }
var selStack = [];
lines.forEach(function (ln, i) {
  ln.split('{').forEach(function (part, k) { if (k < part.length) {} });
  /* 简化：逐行匹配 `prop: value;` */
  var re = /([a-zA-Z-]+)\s*:\s*([^;}]+)[;}]/g, mm;
  while ((mm = re.exec(ln)) !== null) {
    decls.push({ line: i + 1, prop: mm[1], val: mm[2].trim(), raw: ln.trim() });
  }
});
/* 取选择器（向上找最近一行含 `{` 的） */
decls.forEach(function (d) {
  for (var i = d.line - 1; i >= 0; i--) {
    if (lines[i] && lines[i].indexOf('{') >= 0) {
      d.sel = lines[i].split('{')[0].replace(/^\s*/, '');
      break;
    }
  }
});

function report(title, hits, total, note) {
  say('');
  say('===== ' + title + ' =====');
  say('  违规 ' + hits.length + ' / 共 ' + total + ' 条声明'
    + (hits.length ? '　（占比 ' + Math.round(hits.length / Math.max(1, total) * 1000) / 10 + '%）' : ''));
  if (note) say('  ' + note);
  if (LIST) {
    hits.slice(0, 200).forEach(function (h) {
      say('    index.html:' + h.line + '  ' + h.prop + ': ' + h.val + '   ← ' + (h.sel || '?'));
    });
    if (hits.length > 200) say('    … 余 ' + (hits.length - 200) + ' 条');
  }
}

/* ---------- ① 字号：裸 px ---------- */
var fsDecls = decls.filter(function (d) { return d.prop === 'font-size'; });
var fsBare = fsDecls.filter(function (d) { return /px/.test(d.val) && !/var\(/.test(d.val); });
var fsTok = fsDecls.filter(function (d) { return /var\(--fs-/.test(d.val); });
report('① 字号', fsBare, fsDecls.length,
  '令牌 ' + fsTok.length + ' 条（var(--fs-*)）· 其余 ' + (fsDecls.length - fsBare.length - fsTok.length) + ' 条为 em/%/inherit');
var bareVals = {};
fsBare.forEach(function (d) { bareVals[d.val] = (bareVals[d.val] || 0) + 1; });
if (fsBare.length) say('  裸值分布：' + Object.keys(bareVals).sort().map(function (k) { return k + '×' + bareVals[k]; }).join('  '));

/* ---------- ② 间距：必须走令牌 ----------
   判据 = 项目标尺（不是"4 的倍数"）：1/2/4/6/8/10/12/14/18/24。
   标尺外的字面值一律算漂移；var/calc/0/auto 放行；
   负值（布局叠压）与大值（>32px 的版式尺寸）单列，不算节奏漂移。 */
var SP_SCALE = [1, 2, 4, 6, 8, 10, 12, 14, 18, 24];
function badSpace(val) {
  if (val.indexOf('calc(') >= 0) return false;
  if (val.indexOf('var(') >= 0) return false;
  if (/^(0|auto|inherit|unset|initial)$/.test(val)) return false;
  var parts = val.split(/\s+/), bad = false, big = false;
  parts.forEach(function (p) {
    var mm = /^(-?[\d.]+)px$/.exec(p);
    if (!mm) return;
    var v = parseFloat(mm[1]);
    if (v < 0 || v > 32) { big = true; return; }          // 负值/版式大值：单列
    if (SP_SCALE.indexOf(v) < 0) bad = true;
  });
  return bad && !big;
}
var spDecls = decls.filter(function (d) {
  return ['padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'gap', 'row-gap', 'column-gap'].indexOf(d.prop) >= 0;
});
var spBad = spDecls.filter(function (d) { return badSpace(d.val); });
report('② 间距', spBad, spDecls.length,
  '判据：标尺 ' + SP_SCALE.join('/') + 'px 或令牌；负值/版式大值(>32px)单列');
var spVals = {};
spBad.forEach(function (d) { spVals[d.val] = (spVals[d.val] || 0) + 1; });
if (spBad.length) {
  say('  漂移值 top10：' + Object.keys(spVals).sort(function (a, b) { return spVals[b] - spVals[a]; })
    .slice(0, 10).map(function (k) { return k + '×' + spVals[k]; }).join('  '));
}

/* ---------- ③ 圆角 ---------- */
var rdDecls = decls.filter(function (d) { return /^border(-[a-z]+)*-radius$/.test(d.prop); });
var rdBad = rdDecls.filter(function (d) { return !/var\(--r-|^(0|inherit|50%|999px|9999px)$/.test(d.val) && !/var\(/.test(d.val); });
report('③ 圆角', rdBad, rdDecls.length, '判据：只许 var(--r-*) / 0 / 50% / 999px');
var rdVals = {};
rdBad.forEach(function (d) { rdVals[d.val] = (rdVals[d.val] || 0) + 1; });
if (rdBad.length) say('  裸圆角分布：' + Object.keys(rdVals).sort().map(function (k) { return k + '×' + rdVals[k]; }).join('  '));

/* ---------- ④ 颜色：裸 hex / rgb ---------- */
var COLOR_PROPS = /^(color|background|background-color|border-color|border|border-top|border-bottom|border-left|border-right|box-shadow|text-shadow|fill|stroke|outline)$/;
var cDecls = decls.filter(function (d) { return COLOR_PROPS.test(d.prop); });
var cBad = cDecls.filter(function (d) {
  if (d.val.indexOf('var(') >= 0) return false;
  if (/^(none|inherit|transparent|currentColor|0)$/i.test(d.val)) return false;
  if (/rgba?\(\s*var\(/.test(d.val)) return false;
  return /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/.test(d.val);
});
report('④ 颜色', cBad, cDecls.length, '判据：只许 var(--*)；transparent/none 放行');
if (cBad.length) {
  var cVals = {};
  cBad.forEach(function (d) { cVals[d.val.slice(0, 60)] = (cVals[d.val.slice(0, 60)] || 0) + 1; });
  say('  裸色值 top10：');
  Object.keys(cVals).sort(function (a, b) { return cVals[b] - cVals[a]; }).slice(0, 10)
    .forEach(function (k) { say('    ' + cVals[k] + '×  ' + k); });
}

/* ---------- ⑤ 弹窗尺寸档：是否只走白名单 ---------- */
var sizeDecls = decls.filter(function (d) { return /\.modal|\.m-body|\.inner-panel/.test(d.sel || ''); });
say('');
say('===== ⑤ 弹窗/面板基础规则 =====');
say('  相关声明 ' + sizeDecls.length + ' 条（.modal / .m-body / .inner-panel）');
['.modal {', '.m-body {', '.m-head {', '.m-foot {', '.inner-panel {'].forEach(function (k) {
  var hit = decls.filter(function (d) { return (d.sel || '').trim() === k.replace(' {', ''); });
  say('  ' + k + '  → ' + hit.length + ' 条声明');
});

/* ---------- ⑥ 令牌现状（全部自定义属性，含字号/间距/圆角/色彩） ---------- */
say('');
say('===== ⑥ 令牌现状 =====');
[
  ['字号 --fs-*', /--fs-[a-z0-9-]+\s*:/g],
  ['间距 --sp-*', /--sp-[a-z0-9-]+\s*:/g],
  ['圆角 --r-*', /--r-[a-z0-9-]+\s*:/g],
  ['其他（色彩/尺寸/主题）', /--(?!(?:fs|sp|r)-)[a-z][a-z0-9-]*\s*:/g],
].forEach(function (pair) {
  var found = cssNC.match(pair[1]) || [];
  var uniq = [];
  found.forEach(function (f) { var k = f.replace(/\s*:$/, ''); if (uniq.indexOf(k) < 0) uniq.push(k); });
  say('  ' + pair[0] + ' 共 ' + uniq.length + ' 个'
    + (uniq.length <= 14 ? '：' + uniq.join(' ') : '（略，见 --list）'));
  if (LIST && uniq.length > 14) say('    ' + uniq.join(' '));
});

/* ---------- ⑦ 令牌定义完整性 ----------
   判据：CSS 里 `var(--X)` 引用的每个 X 都必须有定义 —— 除非它由 JS 内联注入
   （元素级变量，如沙盘的 `style="--lane:34px"`）。
   为什么值得一条独立检查：**没有定义的 var() 会让整条声明失效**
   （CSS 在最外层计算值阶段就判无效），而且失效是静默的 ——
   界面只是"某个颜色/尺寸没生效"，肉眼很难定位。本轮就抓到一处（--beauty-tag-rgb）。 */
(function () {
  var defs = {};
  (cssNC.match(/--[a-z][a-z0-9-]*\s*:/g) || []).forEach(function (d) {
    defs[d.replace(/\s*:$/, '')] = 1;
  });
  var uses = {};
  (cssNC.match(/var\(--[a-z][a-z0-9-]*/g) || []).forEach(function (u) {
    var n = u.slice(4);
    uses[n] = (uses[n] || 0) + 1;
  });
  /* JS 内联注入的变量（元素级，合理） */
  var jsInline = {};
  ['ui.js', 'main.js', 'battle.js', 'tactic.js', 'domain.js', 'map.js', 'icons.js', 'systems.js'].forEach(function (f) {
    var fp = path.join(R, 'js', f);
    if (!fs.existsSync(fp)) return;
    var js = fs.readFileSync(fp, 'utf8');
    (js.match(/--[a-z][a-z0-9-]*\s*:/g) || []).forEach(function (d) {
      jsInline[d.replace(/\s*:$/, '')] = f;
    });
  });
  var miss = Object.keys(uses).filter(function (k) { return !defs[k] && !jsInline[k]; });
  var inline = Object.keys(uses).filter(function (k) { return !defs[k] && jsInline[k]; });
  say('');
  say('===== ⑦ 令牌定义完整性 =====');
  say('  已定义 ' + Object.keys(defs).length + ' 个 · 被引用 ' + Object.keys(uses).length + ' 个');
  say('  引用但**未定义**：' + (miss.length
    ? '❌ ' + miss.map(function (k) { return k + '×' + uses[k]; }).join('  ')
    : '✅ 0（引用的都已定义）'));
  if (inline.length) {
    say('  由 JS 内联注入（元素级，合规）：' + inline.map(function (k) {
      return k + '×' + uses[k] + '@' + jsInline[k];
    }).join('  '));
  }
})();

/* ---------- ⑦ 汇总尾行（给门禁看的机器可读行） ---------- */
say('');
say('SUMMARY ' + JSON.stringify({
  fsBare: fsBare.length, fsTotal: fsDecls.length,
  spBad: spBad.length, spTotal: spDecls.length,
  rdBad: rdBad.length, rdTotal: rdDecls.length,
  cBad: cBad.length, cTotal: cDecls.length,
}));
process.exit(0);
