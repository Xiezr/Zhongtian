'use strict';
/* ============================================================
 * gen_tiers.js —— 生成**段级断言分档表**（.workbuddy/assert-tiers.json）
 * ------------------------------------------------------------
 * 为什么按"段"而不是按"单条"：
 *   · 单条判定要靠正则猜断言体，规则永远有漏（第一版把「出生州」判成实现类、
 *     第二版又把 CSS lint 三条漏成行为类）；
 *   · 段的语义稳定（"玩法：攻城结算" vs "界面：顶栏结构"），而且**段号不随行号漂移**，
 *     所以表可以长期用，只在段主题真变了时改一行。
 *
 * 生成规则：段内每条 check 用"实现证据"规则判一次，实现类占比 > 50% → 段 = impl。
 * 人工校正：跑完看下面的"临界段"清单，把明显误判的段号填进 OVERRIDE 后重跑。
 *
 * 用法：node .workbuddy/tools/prof/gen_tiers.js [--show 20]
 * ============================================================ */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..', '..');
var SHOW = 20;
var args = process.argv.slice(2);
for (var i = 0; i < args.length; i++) if (args[i] === '--show') SHOW = Number(args[i + 1]) || 20;

/* ============================================================
 * 人工校正表：段号 → 强制分档
 * ------------------------------------------------------------
 * 只在"规则明显判错"时填。填之前先看 --show 打印的临界段。
 * 判据不是为了好看，而是问一句：**这条红了，是不是玩家真的坏了？**
 *   不是 → impl（实现类，允许随改随删）
 *   是   → behavior（必须拦）
 * ============================================================ */
var OVERRIDE = {
  /* CSS 令牌纪律（v89.105 那一段）：断言查的是 index.html 里的间距/圆角/颜色字面量。
     它们红 = 有人写了裸 5px，不代表玩法坏了 → 实现类。 */
  '88': 'impl'
};

var IMPL = [
  { re: /class="[a-z][\w-]*"/, why: 'HTML 类名' },
  { re: /'#[a-z][\w-]*'|"#[a-z][\w-]*"/, why: 'DOM id' },
  { re: /\.[a-z][\w-]*\s*\{/, why: 'CSS 规则' },
  { re: /innerHTML/, why: 'innerHTML 结构' },
  { re: /\.toString\(\)/, why: '函数源码' },
  { re: /data-action=|data-view=/, why: 'DOM 属性' },
  { re: /__uiAll\(\)|readFileSync|stripComment\(/, why: '读源码' },
  { re: /className|classList/, why: 'class 断言' },
  { re: /rgba?\(\s*\d+\s*,/, why: '颜色字面量' },
  { re: /border-radius\s*:|margin-(left|right)\s*:|padding\s*:/, why: '间距/圆角字面量' }
];

/* 标题关键词强制分档：有些断言的实现证据藏在它调用的辅助函数里（断言体只有一行），
   正则取不到 —— 这类按标题关键词补。比段号稳：段号会随插入段漂移，标题是改断言时才动。 */
var TITLE_OVERRIDE = [
   { re: /标尺|圆角|令牌|裸字号|裸 hex|颜色：属性值|字号|间距/, tier: 'impl' },
   { re: /零残留|已退役|已删|不再有|不许回来/, tier: 'impl' },
   /* v156.41：断言体里对**源码**做正则（`.test(uS)` / `codeOf(...)`），
      但源码变量在断言之外取（`var uS = __uiAll()`）—— 正则在断言体里抓不到
      `__uiAll()` 字样，于是被误判成行为类。§174③「锁城签名」就是这样：
      函数签名加了个 mode 参数，它红了，却被算成"产品坏了"。
      凡标题里带「签名 / 在册 / 结构 / 接线」的，几乎都是查源码的实现类。 */
   { re: /签名|在册|接线|源码/, tier: 'impl' }
];
 var SRC = path.join(ROOT, 'smoke-test.js');
var lines = fs.readFileSync(SRC, 'utf8').split('\n');

/* 段边界（段号来自标题行） */
var segs = [];
for (var n = 0; n < lines.length; n++) {
  var m = /=====\s*(\d+)\.\s*(.+?)\s*=====/.exec(lines[n]);
  if (m) segs.push({ no: m[1], title: m[2], line: n });
}
segs.forEach(function (s, k) { s.end = (k + 1 < segs.length) ? segs[k + 1].line : lines.length; });
var preludeEnd = segs.length ? segs[0].line : lines.length;

/* 逐条 check 判定（只在段内） */
function blockAt(i) {
  var ind = lines[i].match(/^\s*/)[0].length, buf = [];
  for (var j = i; j < Math.min(lines.length, i + 90); j++) {
    buf.push(lines[j]);
    if (j > i) {
      var m2 = lines[j].match(/^\s*/)[0].length;
      if (m2 === ind && (/^\s*\}\)+\)?;?\s*$/.test(lines[j]) || /^\s*check\(/.test(lines[j]))) break;
    }
  }
  return buf.join('\n');
}

segs.forEach(function (s) {
  var total = 0, impl = 0;
  for (var i = s.line; i < s.end; i++) {
    if (!/^\s*check\(/.test(lines[i])) continue;
    total++;
    var body = blockAt(i).split('\n').slice(1).join('\n');
    if (IMPL.some(function (r) { return r.re.test(body); })) impl++;
  }
  s.checks = total;
  s.impl = impl;
  s.ratio = total ? impl / total : 0;
  s.auto = (total > 0 && s.ratio > 0.5) ? 'impl' : 'behavior';
  s.tier = OVERRIDE[s.no] || s.auto;
  s.forced = !!OVERRIDE[s.no];
});

/* 单条表：行号 → impl（这才是真正要用的粒度 —— 段内多数决只能降级 115/4661，
   而实际是**每段里都掺着几条**实现断言，必须逐条判）。 */
 var perTitle = {};   /* 标题 djb2 → 1 = 实现类。用标题而不是行号：行号会随改动漂移，分片文件的行号更是全变；标题是唯一稳定的。 */
 function djb2(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h; }
 var _dup = {};
 segs.forEach(function (s) {
   for (var i = s.line; i < s.end; i++) {
     if (!/^\s*check\(/.test(lines[i])) continue;
     var blk = blockAt(i);
     var tm = /check\(\s*'([^']{2,120})'/.exec(blk) || /check\(\s*"([^"]{2,120})"/.exec(blk);
     if (!tm) continue;
     var body = blk.split('\n').slice(1).join('\n');
     var isImpl = IMPL.some(function (r) { return r.re.test(body); })
       || TITLE_OVERRIDE.some(function (o) { return o.re.test(tm[1]); });
     var k = djb2(tm[1]);
     if (perTitle[k] === undefined) perTitle[k] = isImpl ? 1 : 0;
     else if (isImpl) perTitle[k] = 1;   /* 同名断言只要有一条锁实现，就按实现类处理（保守） */
   }
 });
 var implSegs = segs.filter(function (s) { return s.tier === 'impl'; });
var behSegs = segs.filter(function (s) { return s.tier === 'behavior'; });
var implChecks = implSegs.reduce(function (a, s) { return a + s.checks; }, 0);
var behChecks = behSegs.reduce(function (a, s) { return a + s.checks; }, 0);

var out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  note: '段号 → impl(实现类·红了不阻断) / behavior(行为类·红了必须拦)。改段主题后重跑 gen_tiers.js。',
  counts: { segs: segs.length, implSegs: implSegs.length, behSegs: behSegs.length, implChecks: implChecks, behChecks: behChecks },
  srcHash: require('crypto').createHash('sha256').update(fs.readFileSync(SRC)).digest('hex').slice(0, 16),
  implTitles: perTitle,
  tiers: {}
};
segs.forEach(function (s) { out.tiers[s.no] = s.tier; });

var outFile = path.join(ROOT, '.workbuddy/assert-tiers.json');
/* ------------------------------------------------------------
 * v156.39：给每条「实现类」记一个 since（首次被判为 impl 的日期）。
 * 为什么必须记：**降级不阻断 = 永久豁免**，30 天后没人记得它为什么免检。
 * tier_audit 按 since 判到期 → 到期就要求升级回 ❌（要么修，要么改断言）。
 * 只保留**仍在表里**的旧 since，消失的自动丢弃（不留垃圾）。
 * ------------------------------------------------------------ */
var oldSince = {};
try {
  var prev = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  oldSince = prev.since || {};
} catch (e) { /* 首跑没有旧表 */ }
var today = new Date().toISOString().slice(0, 10);
var since = {};
Object.keys(perTitle).forEach(function (k) {
  if (perTitle[k] !== 1) return;
  since[k] = oldSince[k] || today;
});
out.since = since;

fs.writeFileSync(outFile, JSON.stringify(out, null, 1));

console.log('段 ' + segs.length + ' 个（前置 ' + preludeEnd + ' 行）');
console.log('  实现类段 ' + implSegs.length + ' 个 / 断言 ' + implChecks + ' 条');
console.log('  行为类段 ' + behSegs.length + ' 个 / 断言 ' + behChecks + ' 条');
console.log('  → ' + outFile);

console.log('\n=== 被判成"实现类"的段（红了只警告） ===');
implSegs.slice(0, SHOW).forEach(function (s) {
  console.log('  #' + s.no.padStart(3) + '  ' + s.checks + '条(' + Math.round(s.ratio * 100) + '% 实现)  '
    + s.title.slice(0, 44) + (s.forced ? '   ← 人工校正' : ''));
});
if (implSegs.length > SHOW) console.log('  … 另有 ' + (implSegs.length - SHOW) + ' 段');

console.log('\n=== 临界段（实现占比 30~60%，最可能判错，建议人工看一眼） ===');
segs.filter(function (s) { return s.checks >= 3 && s.ratio > 0.3 && s.ratio <= 0.6; })
  .sort(function (a, b) { return b.ratio - a.ratio; }).slice(0, 10)
  .forEach(function (s) {
    console.log('  #' + s.no.padStart(3) + '  ' + s.checks + '条(' + Math.round(s.ratio * 100) + '%)  '
      + s.title.slice(0, 48) + '   → ' + s.tier);
  });
