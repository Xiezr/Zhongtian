/* ============================================================
 * intent_closure.js —— 「需求意图 → 交付 → 断言」对账表
 * ------------------------------------------------------------
 * 为什么要有它（2026-11-13 整改）：
 *   本仓有 7 层验证 + 6 问元判据 + 4469 条断言，但体系自己承认一个制度性缺口：
 *   「老板原话 → 断言 §xxx」的对照是**人工填写、无人复核**。门禁全绿只证明
 *   "代码做了你说的"，证明不了"你说的是对的" —— 那正是 AI 生成代码最易错的地方。
 *
 * ⛔ 本工具的三条硬边界（防止它长成第 8 层门禁）：
 *   ① **只读**：不写任何文件、不改任何状态；
 *   ② **不进 gate**：gate.py 的 TESTS / L0 里不许加它；
 *   ③ **恒退 0**：它不判「通过 / 失败」，只回答「能不能拿出对账证据」。
 *      输出只有「需解释 / 无需解释」，不是绿红；要不要补，由交付时的人决定。
 *
 * ⚠️ 误报纪律（v1 首跑踩过）：交付目录里**截图轮只有 png 没有 md**、
 *   台账的「老板原话」有 3 种写法、段号后面跟着反引号 —— 一律先按真实形态校准，
 *   别把"格式不同"报成"证据缺失"。本工具只把**断链**列为需解释。
 *
 * ⚠️ v2（2026-11-13 · 独立复核后修，复核记录见 v15752 交付文档）：
 *   ① **平凡解**：v1 里 rd() 读失败返 '' → 0 轮次 → 「（无断链）」→ 恒退 0，
 *      空数据完美复现空史实（本仓反复栽在这上面）。现加**数据下限**：
 *      台账 / 轮次数 / 交付目录 / 测试语料任一不可读，显式报「本表不可信」，
 *      绝不当成「无断链」。阈值只用来挡空数据，不用来判质量。
 *   ② **自指误报**：引用历史断链的段落（诚实缺口 / 遗留 / 复现 / 回退）不再被
 *      当成「点名断言」；章节号 `§14.5` 先摘掉；老板原话允许跨行写法。
 *   ③ **装饰判据退役**：「交付文档没写怎么验的」在全文匹配下近乎恒真（永不触发），
 *      从「需解释」里移除，只留作表格里的软信号 —— 软判断交给人，AI 不结案。
 *   ④ 复现命令按实际 `--last N` 打印，不再硬编码 12。
 *
 * 用法：
 *   node .workbuddy/tools/audit/intent_closure.js            # 最近 6 轮
 *   node .workbuddy/tools/audit/intent_closure.js --last 12  # 最近 12 轮
 *   node .workbuddy/tools/audit/intent_closure.js --all       # 全部（很宽，仅普查用）
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const DELIV = path.join(ROOT, 'docs', '_史料', '交付');
const LEDGER = path.join(ROOT, '需求档案.md');
const TESTS = ['smoke-test.js', 'e2e-test.js'];
const SKIP_HEAD = /诚实缺口|遗留|待老板|待用户|复现|回退|参考|附录|缺口|反面/;

function rd(p) {
  try {
    const s = fs.readFileSync(p, 'utf8');
    return typeof s === 'string' ? s : '';
  } catch (e) { return ''; }
}

function pad(s, n) {
  s = String(s == null ? '' : s);
  let w = 0;
  for (const ch of s) w += /[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? 2 : 1;
  return s + ' '.repeat(Math.max(0, n - w));
}

/* ---------- ⓪ 数据下限：空数据不许"完美复现"空史实 ---------- */
function sourceHealth(rs, index, corpus) {
  const bad = [];
  const ledger = rd(LEDGER);
  if (ledger.length < 1000) bad.push('需求台账不可读或过短（' + ledger.length + ' 字符）');
  if (!rs.length) bad.push('台账里解析到 0 个轮次 —— 本表不可信');
  if (!Object.keys(index).length) bad.push('交付目录不可读或 0 个附件');
  if (corpus.length < 10000) bad.push('测试语料不可读或过短（' + corpus.length + ' 字符）');
  return bad;
}

/* ---------- ① 需求台账：逐轮明细标题 + 老板原话 ---------- */
function rounds() {
  const src = rd(LEDGER);
  const out = [];
  const re = /^##\s+(v[\d.]+[a-z]?)\s*·\s*([\d-]+)?[^\n]*$/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const end = re.lastIndex;
    const next = src.indexOf('\n## ', end);
    const body = src.slice(end, next < 0 ? src.length : next);
    /* 台账里实测的三种逐字写法（记录规则 #2），外加 v157.52 的跨行写法：
       `**老板原话**：「` · `> 老板原话（**逐字**）：「` · `> 老板：「` ·
       `**老板原话**（两条，逐字）：\n> 「…」` */
    const head = body.slice(0, 500);
    const quote = /老板原话[\s\S]{0,160}「/.test(head) ||
                  />\s*老板[：:][\s\S]{0,160}「/.test(head) ||
                  /\*\*逐字原文\*\*/.test(head);
    out.push({ ver: m[1], date: m[2] || '', quote: quote });
  }
  return out;
}

/* ---------- ② 交付附件：md 与截图都算（截图轮本来就没有 md） ---------- */
function deliverIndex() {
  const map = {};
  try {
    for (const f of fs.readdirSync(DELIV)) {
      const low = f.toLowerCase();
      const isMd = low.endsWith('.md');
      const isImg = /\.(png|jpg|jpeg|webp|gif)$/.test(low);
      if (!isMd && !isImg) continue;
      const m = f.match(/^v(\d+)/);
      if (!m) continue;
      (map[m[1]] = map[m[1]] || []).push({ f: f, md: isMd });
    }
  } catch (e) { /* 目录不存在就当没有交付附件 —— 由 sourceHealth 兜住，不许静默判过 */ }
  for (const k in map) {
    map[k].sort(function (a, b) { return (b.md ? 1 : 0) - (a.md ? 1 : 0); });
  }
  return map;
}

function verKeys(ver) {
  const digits = ver.replace(/^v/, '').replace(/\./g, '');   // v157.51 → 15751
  const base = digits.replace(/[a-z]+$/, '');                 // 尾缀字母去掉
  return [digits, base, base.slice(0, 3)];
}

function findDeliver(ver, index) {
  for (const k of verKeys(ver)) {
    if (index[k] && index[k].length) return index[k][0];
  }
  return null;
}

/* ---------- ③ 段号对账：交付文档点名的断言，真的在测试里吗 ---------- */
function testCorpus() {
  let s = '';
  for (const f of TESTS) s += rd(path.join(ROOT, f)) + '\n';
  return s;
}

function parts(md) { return md.split(/(?=^#{1,3} )/m); }

function assertText(md) {
  /* 引用历史断链的小节不算「点名断言」，否则工具会把自己写的说明扫成断链 */
  return parts(md).filter(function (p) {
    return !SKIP_HEAD.test(p.split('\n')[0] || '');
  }).join('\n');
}

function segRefs(md) {
  const seen = {};
  const out = [];
  for (const line0 of assertText(md).split('\n')) {
    if (!/断言|smoke|e2e|锁|同步改|回归/i.test(line0)) continue;
    const line = line0.replace(/§\d+\.\d+/g, '');   /* 章节号 §14.5 不是断言段号 */
    const re = /§(\d+)([①-⑳a-z]{0,3})/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const full = m[0];
      if (seen[full]) continue;
      seen[full] = 1;
      out.push({ full: full, base: '§' + m[1] });
    }
  }
  return out;
}

/* ---------- ④ 主表 ---------- */
function main() {
  const args = process.argv.slice(2);
  const all = args.indexOf('--all') >= 0;
  const li = args.indexOf('--last');
  const lastN = li >= 0 ? (parseInt(args[li + 1], 10) || 6) : 6;

  const rs = rounds();
  const index = deliverIndex();
  const corpus = testCorpus();
  const bad = sourceHealth(rs, index, corpus);
  const use = all ? rs : rs.slice(-lastN);

  console.log('━━ 需求意图对账表（只读 · 不进门禁 · 恒退 0）━━');
  console.log('   对账链：老板原话 → 交付附件 → 验证段 → 点名的段号真的在测试里');
  console.log('   ⚠️ 只有「断链 / 数据源不可读」才列进需解释；格式差异 / 截图轮 / 历史归纳轮不算缺陷。\n');
  console.log(pad('轮次', 14) + pad('原话', 8) + pad('交付', 8) + pad('验证', 6) +
              pad('缺口', 6) + pad('段号 H/B/M', 14) + '附件');
  console.log('-'.repeat(84));

  const explain = [];
  for (const r of use) {
    const d = findDeliver(r.ver, index);
    const md = d && d.md ? rd(path.join(DELIV, d.f)) : '';
    /* 软信号：只显示给人看，不进「需解释」（v2 退役了恒真的装饰判据） */
    const hasVerify = /验证|门禁|复现|smoke|e2e|断言/i.test(md);
    const hasGap = /诚实缺口|待续|未完成|下一批/.test(md);

    const segs = md ? segRefs(md) : [];
    let H = 0, B = 0, M = 0;
    const missed = [];
    for (const s of segs) {
      if (corpus.indexOf(s.full) >= 0) H++;
      else if (corpus.indexOf(s.base) >= 0) B++;      /* 基础段号在，后缀写法不一致 */
      else { M++; missed.push(s.full); }
    }
    const segTxt = segs.length ? (H + '/' + B + '/' + M) : '—';

    const why = [];
    if (M) why.push('段号断链 ' + missed.join(' '));
    if (r.quote && !d) why.push('有逐字原话但无交付附件');
    if (why.length) explain.push({ ver: r.ver, why: why.join('；') });

    console.log(
      pad(r.ver, 14) +
      pad(r.quote ? '✓' : '归纳', 8) +
      pad(d ? (d.md ? 'md' : '仅图') : '—', 8) +
      pad(md ? (hasVerify ? '✓' : '—') : '—', 6) +
      pad(md ? (hasGap ? '✓' : '—') : '—', 6) +
      pad(segTxt, 14) +
      (d ? d.f : '（无）')
    );
  }

  if (bad.length) {
    console.log('\n   ⛔ 数据下限未过 —— 本表不可信（不是「无断链」）：');
    for (const b of bad) console.log('     · ' + b);
    explain.push({ ver: '(数据源)', why: '数据下限未过 ' + bad.length + ' 项，本表不可信' });
  }

  console.log('\n   最近 ' + use.length + ' 轮 · 需解释 ' + explain.length + ' 项');
  if (explain.length) {
    for (const e of explain) console.log('     · ' + pad(e.ver, 12) + e.why);
  } else {
    console.log('     （无断链，且数据下限已过）');
  }
  console.log('\n   段号 H=完整命中 / B=仅基础段号命中（文档后缀写法不同，需人工确认）/ M=测试里找不到。');
  console.log('   B 不算断链但要点名：连写段号应回文档改成真实段号，否则下轮对账还会糊。');
  console.log('   验证列是软信号（有验证字样即 ✓），不进需解释；判定归人。');
  console.log('   复现：node .workbuddy/tools/audit/intent_closure.js --last ' + lastN);
  return 0;
}

try { process.exit(main()); } catch (e) {
  console.log('对账工具异常（只读，无副作用）：' + (e && e.message ? e.message : String(e)));
  process.exit(0);                       /* 恒退 0：绝不让它变成拦路的第 8 层 */
}
