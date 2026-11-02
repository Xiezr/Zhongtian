#!/usr/bin/env node
/* ============================================================
 * tier_audit.js —— **验证体系的自审器**
 * ------------------------------------------------------------
 * 老板 2026-11-02：「复核这套体系完备，是可以否定自身的完备，
 *   不断自我改进的完备，而不是另一个牢笼」
 *
 * 一个只会「判红」的体系是半个体系 —— 它管得住坏代码，管不住自己。
 * 这一轮我刚给它加了三个新机制（分档 / 分片 / 基线），如果不审它们，
 * 它们本身就会变成新的牢笼：
 *
 *   · 分档 → 「标成实现类」可以逃避任何红     → Q2 到期 + Q4 膨胀
 *   · 基线 → 「加进基线」可以永久屏蔽          → Q2 到期
 *   · 分片 → 静默漏段就是假绿（比红更危险）    → Q3 覆盖下限
 *   · skip → 「没测到」冒充「通过」            → Q1 假绿
 *   · 体系本身 → 能不能被一脚踢开？            → Q5 可推翻
 *
 * 六问全过 = 体系能自我否定；任一不过 = 体系在骗人，先修体系。
 *
 * 用法：
 *   node .workbuddy/tools/prof/tier_audit.js          # 自审，有问题退出码 1
 *   node .workbuddy/tools/prof/tier_audit.js --json   # 机器可读
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const R = (p) => path.join(ROOT, p);
const JSON_OUT = process.argv.indexOf('--json') >= 0;

/* 可调阈值 —— 全部集中在这里，因为「阈值本身也会过期」 */
const LIMIT = {
  implRatio: 0.35,     // 实现类断言占比上限（超了说明在靠降级逃避）
  skipCount: 12,       // 跳过条数上限（超了说明大量路径没测到）
  warnCount: 20,       // ⚠️ 待修上限（超了说明「不阻断」被滥用）
  graceDays: 30,       // 任何豁免的宽限期（天）—— 到期必须重新做决定
  coverage: 0.99,      // 分片合计条数 / 串行全量条数 的下限
};

const findings = [];   // {q, level, msg, fix}
const add = (q, level, msg, fix) => findings.push({ q, level, msg, fix });

/* ---------- 工具 ---------- */
function readIf(p) {
  try { return fs.readFileSync(R(p), 'utf8'); } catch (e) { return null; }
}
function readJson(p) {
  try { return JSON.parse(readIf(p) || 'null'); } catch (e) { return null; }
}
function daysSince(iso) {
  if (!iso) return null;
  const t = Date.parse(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}
/* 剥注释（判代码不判注释 —— 这条踩过两次） */
function stripComment(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}

/* ============================================================
 * Q1 假绿：这条断言还能红吗？
 * ------------------------------------------------------------
 * 「永远绿的断言」比「红的断言」危险得多：红的会被修，
 * 绿的会被当成保护伞，而它其实什么都没保护。
 * ============================================================ */
function q1_falseGreen() {
  const files = ['smoke-test.js', 'e2e-test.js'];
  let scanned = 0;
  const liars = [];
  for (const f of files) {
    const src = readIf(f);
    if (!src) continue;
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = /^\s*check\(\s*(['"`])(.{2,140}?)\1\s*,\s*(.+)$/.exec(lines[i]);
      if (!m) continue;
      scanned++;
      let cond = m[3].trim();
      /* 只看到 cond 的**开头**就够判：字面量真值。不要试图解析整行（会误伤含函数的表达式）。 */
      if (/^(true|1)\s*[,)]/.test(cond) || /^!!\s*(1|true|\{\})\s*[,)]/.test(cond)) {
        liars.push({ file: f, line: i + 1, title: m[2], why: '条件字面量恒真' });
        continue;
      }
      /* 空字符串 / 非空字符串字面量当条件 */
      if (/^(['"`]).*\1\s*[,)]$/.test(cond) && !/===|!==|indexOf|test\(/.test(cond)) {
        liars.push({ file: f, line: i + 1, title: m[2], why: '条件为字符串字面量（恒真）' });
        continue;
      }
      /* 纯标识符 / obj.prop 结尾：**先看它是不是变量**。
         `normal` / `distinct` / `R154.rowOrder` 都是本文件里赋过值的布尔变量，
         把它们当「函数引用」是误判（我第一版就这么误报了 7 条）。
         判据：该名字在文件里出现过 `var/let/const NAME` 或 `NAME =` → 是变量，放过；
         从未被赋值 → 才可能是「传了个函数/对象当条件」（恒真陷阱）。 */
      const tid = /^([A-Za-z_$][\w$.]*)\s*\)\s*[,;)]?\s*$/.exec(cond);
      if (tid && !/^(!!|!|false|true|null|undefined|0|1|NaN)$/.test(tid[1])) {
        const name = tid[1];
        const leaf = name.split('.').pop();
        const isAssigned = new RegExp('(var|let|const)\\s+' + leaf + '\\b|\\b' + leaf + '\\s*=(?!=)').test(src);
        if (!isAssigned) {
          liars.push({ file: f, line: i + 1, title: m[2], why: '条件为函数引用（truthy，未求值）' });
        }
      }
    }
  }
  if (liars.length) {
    add('Q1', 'red', `恒真断言 ${liars.length} 条（扫了 ${scanned} 条 check）`,
      '改成真判据，或换 skip() 明确标注「没测到」');
    liars.slice(0, 8).forEach((x) => add('Q1', 'info', `  ${x.file}:${x.line}  ${x.title.slice(0, 50)}  —— ${x.why}`));
  } else {
    add('Q1', 'ok', `无恒真断言（扫了 ${scanned} 条 check）`);
  }

  /* ============================================================
   * Q1²（v156.40）：**变异测试** —— 形式对了，判据真的有效吗？
   * ------------------------------------------------------------
   * 上面扫的是「条件写成字面量」这种形式假绿。但还有一类查不出：
   * 断言写得很像样，判据其实永远为真（比如比较了两个恒等的东西）。
   * 唯一证明方式是把功能改坏看它红不红（mutation_probe.js）。
   * 这里只读结果，不跑（跑一次 3.5 分钟，不属于每轮门禁）。
   * ============================================================ */
  const mut = readJson('.workbuddy/mutation-log.json');
  if (!mut || !Object.keys(mut).length) {
    add('Q1', 'warn', '没有变异测试记录 —— 断言"能不能抓 bug"未被验证过',
      'node .workbuddy/tools/prof/mutation_probe.js --all（慢，可分批跑）');
  } else {
    const names = Object.keys(mut);
    const survived = names.filter((k) => mut[k].verdict === 'survived');
    const killed = names.filter((k) => mut[k].verdict === 'killed');
    const oldest = Math.min.apply(null, names.map((k) => {
      const d = daysSince((mut[k].at || '').slice(0, 10));
      return d == null ? 9999 : d;
    }));
    add('Q1', survived.length ? 'red' : 'ok',
      `变异测试：${killed.length} 个被断言杀死 / ${survived.length} 个存活（${names.length} 个变异，最近 ${oldest} 天前）`,
      survived.length ? '存活的变异 = 功能改坏了都没人发现：' + survived.slice(0, 4).join(', ')
        : null);
    if (oldest > LIMIT.graceDays) {
      add('Q1', 'warn', `变异测试已 ${oldest} 天没跑 —— 断言强度结论过期`, '重跑 mutation_probe.js');
    }
  }
  return { scanned, liars: liars.length };
}

/* ============================================================
 * Q2 豁免到期：分档降级 / 门禁基线 有没有无限期挂着？
 * ============================================================ */
function q2_expiry() {
  const tiers = readJson('.workbuddy/assert-tiers.json');
  const base = readJson('.workbuddy/gate-baseline.json');
  let expired = 0;

  /* 2a 实现类降级 */
  if (tiers && tiers.since) {
    const ages = Object.keys(tiers.since).map((k) => daysSince(tiers.since[k])).filter((d) => d != null);
    const oldest = ages.length ? Math.max.apply(null, ages) : 0;
    const over = ages.filter((d) => d > LIMIT.graceDays).length;
    expired += over;
    add('Q2', over ? 'red' : 'ok',
      `实现类降级 ${Object.keys(tiers.since).length} 条，最久 ${oldest} 天，超 ${LIMIT.graceDays} 天宽限的 ${over} 条`,
      over ? '到期项必须重新做决定：修实现 / 改断言 / 明确续期（改 since）' : null);
  } else {
    add('Q2', 'warn', '分档表没有 since 字段 —— 豁免无到期机制', '重跑 gen_tiers.js 生成 since');
  }

  /* 2b 门禁基线 */
  if (base && base.entries) {
    let n = 0, noSince = 0, over = 0;
    Object.keys(base.entries).forEach((f) => {
      const e = base.entries[f];
      const items = typeof e === 'object' ? Object.keys(e) : [];
      items.forEach((t) => {
        n++;
        const s = (base.since && base.since[t]) || null;
        if (!s) noSince++;
        else if ((daysSince(s) || 0) > LIMIT.graceDays) over++;
      });
    });
    expired += over;
    if (n) {
      if (noSince) {
        add('Q2', 'warn', `门禁基线 ${n} 条中 ${noSince} 条没有 since（无法判到期）`,
          '给 gate-baseline.json 补 since；新基线必须带日期');
      }
      add('Q2', over ? 'red' : 'ok',
        `门禁基线 ${n} 条，超 ${LIMIT.graceDays} 天宽限的 ${over} 条`,
        over ? '到期项必须修掉或由人显式续期 —— 基线是「临时豁免」，不是「永久合规」' : null);
    }
  }
  return { expired };
}

/* ============================================================
 * Q3 覆盖下限：分片有没有静默漏段？
 * ------------------------------------------------------------
 * 分片最容易出的错不是「红」，是**少跑了一段还不报错**。
 * 「两个都空也算相等」的平凡解 —— 必须带下限。
 * ============================================================ */
function q3_coverage() {
  const census = readJson('.workbuddy/smoke-census.json');
  if (!census || !census.full) {
    add('Q3', 'warn', '没有全量条数基线（.workbuddy/smoke-census.json）—— 无法判断分片是否漏跑',
      '跑一次串行全量即会写入');
    return { ratio: null };
  }
  if (!census.lastSplit) {
    add('Q3', 'warn', '没有最近一次分片记录 —— 无法比对', '跑一次 smoke_fast.js');
    return { ratio: null };
  }
  const ratio = census.lastSplit.total / census.full;
  const bad = ratio < LIMIT.coverage;
  add('Q3', bad ? 'red' : 'ok',
    `分片 ${census.lastSplit.total} 条 / 全量 ${census.full} 条 = ${(ratio * 100).toFixed(1)}%（下限 ${(LIMIT.coverage * 100)}%，可略多）`,
    bad ? '分片漏跑了段 —— 分片结果不可信，回退串行' : null);

  /* 反向：分片**明显多于**串行也是坏信号 ——
     说明各份自带开局后走到了串行走不到的分支（世界状态不同），
     那分片验证的就不是同一个程序行为了。比"少"少见，但同样是失真。 */
  if (ratio > 1.05) {
    add('Q3', 'warn',
      `分片比串行多 ${((ratio - 1) * 100).toFixed(1)}% —— 各份自带世界导致分支不同`,
      '分片只能当加速冒烟，不能当回归裁判；结论以串行全量为准');
  }

  /* ============================================================
   * v156.40：**标题集合比对** —— 条数对了，标题未必对。
   * ------------------------------------------------------------
   * 条数比能发现"少了一批"，发现不了"少的那条恰好是关键"，
   * 更发现不了"条数一样但换了两条"（换掉的那两条可能是唯一守住某功能的）。
   * 这里比的是断言**标题集合**，缺几条就报几条，并带出标题原文。
   * ============================================================ */
  const ti = census.titles;
  if (!ti) {
    add('Q3', 'warn', '没有标题集合比对结果 —— 只能靠条数（弱判据）',
      '跑一次 smoke_fast（它会读取 smoke-titles-full.json 做集合比对）');
  } else if (ti.missing > 0) {
    add('Q3', 'red',
      `分片漏跑 ${ti.missing} 条断言（集合比对：全量 ${ti.full} / 分片 ${ti.split}）`,
      '这几条在分片模式下从未执行 —— 列出标题见 smoke_fast 的输出');
    (ti.missingTitles || []).slice(0, 6).forEach((t) => add('Q3', 'info', '  · ' + t));
  } else {
    add('Q3', 'ok',
      `标题集合：全量 ${ti.full} / 分片 ${ti.split}，缺 0 条（多 ${ti.extra} 条属各份世界差异）`);
  }
  return { ratio, titles: ti || null };
}

/* ============================================================
 * Q4 体系膨胀：靠「标成实现类 / 跳过」逃避的迹象
 * ============================================================ */
function q4_inflation() {
  const tiers = readJson('.workbuddy/assert-tiers.json');
  if (!tiers || !tiers.implTitles) { add('Q4', 'warn', '没有分档表'); return {}; }
  const all = Object.keys(tiers.implTitles).length;
  const impl = Object.keys(tiers.implTitles).filter((k) => tiers.implTitles[k] === 1).length;
  const ratio = impl / all;
  add('Q4', ratio > LIMIT.implRatio ? 'red' : 'ok',
    `实现类 ${impl}/${all} = ${(ratio * 100).toFixed(1)}%（上限 ${(LIMIT.implRatio * 100)}%）`,
    ratio > LIMIT.implRatio ? '实现类在膨胀 —— 说明有人靠「标成实现类」让红消失，而不是改实现' : null);

  /* 最近一次 smoke 的跳过 / 待修 */
  const logs = ['smoke-last.log', 'smoke-last-fast.log']
    .map((f) => readIf('.workbuddy/' + f)).filter(Boolean);
  let last = null;
  logs.forEach((s) => {
    /* ⚠️ 分隔符必须写 `\s*\/\s*`，不能写死 ` \/ `：
       前一段的 `[^/]*` 是贪婪的，会把「（实现类·不阻断） 」的**尾随空格吃掉**，
       于是后面那个「 / 1 跳过」里要求的空格就没了 → 跳过数永远读成 0（第一版就这样）。
       自审器自己读错数字，是最不能容忍的 bug —— 它会让人误以为体系健康。 */
    const m = /结果：(\d+) 通过 \/ (\d+) 失败(?:\s*\/\s*(\d+) 待修[^/]*)?(?:\s*\/\s*(\d+) 跳过[^)]*)?/.exec(s);
    if (m) last = { pass: +m[1], fail: +m[2], warn: +(m[3] || 0), skip: +(m[4] || 0) };
  });
  if (last) {
    add('Q4', last.skip > LIMIT.skipCount ? 'red' : 'ok',
      `最近一次：${last.pass} 通过 / ${last.fail} 失败 / ${last.warn} 待修 / ${last.skip} 跳过（跳过上限 ${LIMIT.skipCount}）`,
      last.skip > LIMIT.skipCount ? '跳过太多 —— 大量路径没被执行，通过数是虚的' : null);
    add('Q4', last.warn > LIMIT.warnCount ? 'red' : 'ok',
      `待修 ${last.warn} 条（上限 ${LIMIT.warnCount}）`,
      last.warn > LIMIT.warnCount ? '⚠️ 待修堆积 —— 不阻断正在被当成合法通道' : null);
  } else {
    add('Q4', 'info', '没有最近一次 smoke 日志，跳过/待修计数未审');
  }

  /* ============================================================
   * Q4²（v156.40）：**阈值不该是拍的** —— 用历史趋势校验它
   * ------------------------------------------------------------
   * 上一轮我承认过：35% / 12 / 20 全是拍脑袋。拍出来的阈值有两层骗人：
   *   ① 看起来精确（"25.1% < 35%"），其实那个 35 没有依据；
   *   ② 不会自己变 —— 项目规模变了，阈值还在原地。
   * 这里做两件事，成本都很低：
   *   · 每轮把指标追加到 tier-history.jsonl（**历史是阈值的唯一依据**）；
   *   · 有 ≥8 条历史时，用 p95 与拍的阈值比较，取更严的那个，并说明改了没有。
   * ============================================================ */
  const trend = recordAndTrend({ implRatio: +ratio.toFixed(4), impl, all,
    skip: last ? last.skip : null, warn: last ? last.warn : null });
  if (trend.note) add('Q4', trend.level || 'info', trend.note, trend.fix);

  /* ============================================================
   * Q4³（v156.44）：**规范自己守不守自己的规矩**
   * ------------------------------------------------------------
   * 老板 2026-11-02「那你有信心说目前的规范是比较好的了吗」——
   * 查下来最刺眼的不是规范写得对不对，是 **AGENTS §7 那张阈值表自己就是废纸**：
   *   单文件 5000 行 / 实际 smoke-test.js 47411 行（表里自己点名"反面教材"）
   *   门禁 3 分钟 / 实际 691 秒
   *   一次性脚本 20 个 / 实际 268 个
   * 6 条阈值 3 条严重超标，**没有任何机制在看它们**。
   *
   * 所以这里不新增条款（§12 冻结了），只是**让已有的那张表变成每轮可见的数字**。
   * 刻意用 info 不判红：一旦判红就得立刻拆 47411 行，那是项目级工程，
   * 硬判红只会把它变成"合法的红"——正是上一轮清掉的东西。
   * ============================================================ */
  try {
    const NORM = [
      { k: '单文件行数', limit: 5000, now: fs.readFileSync(R('smoke-test.js'), 'utf8').split('\n').length, unit: '行', who: 'smoke-test.js' },
      { k: '一次性脚本', limit: 20, now: (function () {
        let n = 0;
        ['.workbuddy/tools/show', '.workbuddy/tools/probe'].forEach((d) => {
          try { n += fs.readdirSync(R(d)).filter((f) => f.endsWith('.js')).length; } catch (e) { }
        });
        try { n += fs.readdirSync(R('tools')).filter((f) => /^_/.test(f) && f.endsWith('.js')).length; } catch (e) { }
        return n;
      })(), unit: '个', who: 'show+probe+tools/_*' },
    ];
    const over = NORM.filter((x) => x.now > x.limit);
    add('Q4', 'info', '规范自守（AGENTS §7 阈值表）：'
      + NORM.map((x) => `${x.k} ${x.now}${x.unit}/限${x.limit}`).join(' · ')
      + (over.length ? `　⚠️ ${over.length} 条超标` : '　✅ 全在阈值内'));
    if (over.length) {
      add('Q4', 'info', '　超标的：' + over.map((x) => `${x.k}（${x.who}，超 ${(x.now / x.limit).toFixed(1)} 倍）`).join('、'));
    }
  } catch (e) { add('Q4', 'info', '规范自守检查失败：' + e.message); }

  return { ratio, last, trend };
}

/* 历史化：追加 + 算趋势。写坏了不能影响主流程（这里全部 try 包住）。 */
function recordAndTrend(cur) {
  const F = '.workbuddy/tier-history.jsonl';
  const out = { n: 0, note: null, level: 'info', fix: null };
  try {
    let rows = [];
    try {
      rows = (readIf(F) || '').split('\n').filter(Boolean).map((l) => {
        try { return JSON.parse(l); } catch (e) { return null; }
      }).filter(Boolean);
    } catch (e) { rows = []; }

    const lastRow = rows[rows.length - 1];
    /* 同一天同一组数字不重复写（否则刷一次跑一次，历史全是噪声） */
    const same = lastRow && lastRow.implRatio === cur.implRatio
      && lastRow.skip === cur.skip && lastRow.warn === cur.warn;
    if (!same) {
      rows.push(Object.assign({ at: new Date().toISOString().slice(0, 19) }, cur));
      if (rows.length > 500) rows = rows.slice(-500);
      fs.writeFileSync(R(F), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    }
    out.n = rows.length;

    if (rows.length >= 8) {
      const vals = rows.map((r) => r.implRatio).filter((v) => typeof v === 'number').sort((a, b) => a - b);
      const p95 = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))];
      if (cur.implRatio > p95 && cur.implRatio > LIMIT.implRatio * 0.9) {
        out.level = 'warn';
        out.note = `实现类占比 ${(cur.implRatio * 100).toFixed(1)}% 超过历史 p95（${(p95 * 100).toFixed(1)}%，${vals.length} 次记录）`;
        out.fix = '这是「相对自己变差」的信号 —— 比那个拍出来的 35% 更可信';
      } else {
        out.note = `历史 ${rows.length} 次记录，实现类 p95 = ${(p95 * 100).toFixed(1)}%（当前 ${(cur.implRatio * 100).toFixed(1)}%）`;
      }
    } else {
      out.note = `阈值仍是拍的（历史只 ${rows.length} 条，≥8 条后才用 p95 校验）`;
    }
  } catch (e) {
    out.note = '历史记录失败：' + e.message;
  }
  return out;
}

/* ============================================================
 * Q5 可推翻：这套体系能不能被一脚踢开？
 * ------------------------------------------------------------
 * 不可推翻的体系 = 牢笼。判据不是「有没有开关」，而是
 * **开关真的生效**：strict 模式下分档表必须完全不参与判定。
 * ============================================================ */
function q5_overridable() {
  const smoke = readIf('smoke-test.js');
  const gate = readIf('.workbuddy/tools/git/gate.py');
  const okSmoke = !!smoke && /--strict/.test(stripComment(smoke)) && /if\s*\(\s*STRICT\s*\)/.test(stripComment(smoke));
  const okGate = !!gate && /--strict/.test(gate);
  if (okSmoke && okGate) {
    add('Q5', 'ok', '可推翻：smoke --strict 忽略分档、gate --strict 忽略基线');
  } else {
    add('Q5', 'red',
      `可推翻性缺失（smoke:${okSmoke ? '有' : '无'} gate:${okGate ? '有' : '无'}）`,
      '体系必须能被「要求全绿」一脚踢开，否则它自己就是牢笼');
  }
}

/* ============================================================
 * Q6 视觉：断言守不住"看起来坏了"
 * ------------------------------------------------------------
 * 「海波太规整」「星球半径闪烁」这两次，4425 条断言全绿，
 * 是老板肉眼看出来的 —— 断言查"元素在不在、文案对不对"，
 * 查不出"这团雾在抖"。
 *
 * 这里只读结果（visual-last.json），不跑浏览器（跑一次 2 分钟，不属每轮门禁）。
 * ============================================================ */
function q6_visual() {
  const v = readJson('.workbuddy/visual-last.json');
  if (!v || !v.results || !v.results.length) {
    add('Q6', 'warn', '没有视觉基线记录 —— UI 长什么样没人守着',
      'node .workbuddy/tools/prof/visual_baseline.js --update（先建基线）');
    return {};
  }
  const age = daysSince((v.at || '').slice(0, 10));
  const same = v.results.filter((r) => r.verdict === 'same' || r.verdict === 'created' || r.verdict === 'updated').length;
  add('Q6', v.red ? 'red' : 'ok',
    `视觉基线 ${v.results.length} 个场景（${same} 一致 / ${v.red} 不符 / ${v.warn} 微差），${age == null ? '?' : age} 天前`,
    v.red ? '界面真的变了 —— 看 .workbuddy/shots/visual/ 下的新截图，确认是有意的就 --update' : null);
  if (age != null && age > LIMIT.graceDays) {
    add('Q6', 'warn', `视觉基线已 ${age} 天没跑`, '重跑 visual_baseline.js');
  }
  add('Q6', 'info', '范围：仅 UI 静态场景；3D（星球/海面/城池模型）无时间冻结入口，仍未覆盖');
  return v;
}

/* ============================================================ */
function main() {
  q1_falseGreen();
  q2_expiry();
  q3_coverage();
  q4_inflation();
  q5_overridable();
  q6_visual();

  if (JSON_OUT) {
    console.log(JSON.stringify({ limit: LIMIT, findings }, null, 1));
    process.exit(findings.some((f) => f.level === 'red') ? 1 : 0);
  }

  const icon = { red: '❌', warn: '⚠️ ', ok: '✅', info: '   ' };
  console.log('\n═══ 验证体系自审（六问）═══\n');
  let cur = null;
  findings.forEach((f) => {
    if (f.q !== cur) {
      cur = f.q;
      const name = {
        Q1: 'Q1 假绿：断言还能红吗',
        Q2: 'Q2 到期：豁免有没有无限期挂着',
        Q3: 'Q3 覆盖：分片有没有静默漏段',
        Q4: 'Q4 膨胀：有没有靠降级/跳过来逃避',
        Q5: 'Q5 可推翻：体系能不能被一脚踢开',
        Q6: 'Q6 视觉：看得见的部分有没有人守着',
      }[f.q];
      console.log('\n' + name);
    }
    console.log('  ' + icon[f.level] + ' ' + f.msg);
    if (f.fix && f.level !== 'ok') console.log('     → ' + f.fix);
  });
  const red = findings.filter((f) => f.level === 'red').length;
  const warn = findings.filter((f) => f.level === 'warn').length;
  console.log('\n' + (red ? '❌ 体系自身有 ' + red + ' 处问题（先修体系，别信它的结论）'
    : '✅ 体系自洽' + (warn ? `（${warn} 处提醒）` : ''))
    + '\n');
  process.exit(red ? 1 : 0);
}
main();
