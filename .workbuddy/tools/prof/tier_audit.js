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
 * 五问全过 = 体系能自我否定；任一不过 = 体系在骗人，先修体系。
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
  return { ratio };
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
  return { ratio, last };
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

/* ============================================================ */
function main() {
  q1_falseGreen();
  q2_expiry();
  q3_coverage();
  q4_inflation();
  q5_overridable();

  if (JSON_OUT) {
    console.log(JSON.stringify({ limit: LIMIT, findings }, null, 1));
    process.exit(findings.some((f) => f.level === 'red') ? 1 : 0);
  }

  const icon = { red: '❌', warn: '⚠️ ', ok: '✅', info: '   ' };
  console.log('\n═══ 验证体系自审（五问）═══\n');
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
