#!/usr/bin/env node
/* ============================================================
 * mutation_probe.js —— 「这些断言到底能不能抓 bug？」
 * ------------------------------------------------------------
 * 老板 2026-11-02：「改至完善」
 *
 * 这是 Q1 的盲区补丁。Q1 只能查「条件写成字面量」这种**形式上的**假绿，
 * 查不出「断言写得很像样，但判据其实测不到东西」——那种断言照样永远绿。
 *
 * 唯一的证明方式：**把功能改坏，看它会不会红**（变异测试 / mutation testing）。
 * 改坏了还是绿 = 这批断言是装饰品。
 *
 * 为什么用 monkey-patch 而不是改源码：
 *   改源码要 build（30 秒）+ 还原（风险），一轮 5 分钟起；
 *   这里在 smoke 加载完 bundle 后**运行时替换**函数，零改文件、零恢复风险，
 *   代价是只能变异「挂在 GAME.* 出口上」的函数 —— 这也是实际被 UI 调用的那批，
 *   正好是最该被断言守住的部分。
 *
 * 用法：
 *   node .workbuddy/tools/prof/mutation_probe.js --list
 *   node .workbuddy/tools/prof/mutation_probe.js --run <变异名>
 *   node .workbuddy/tools/prof/mutation_probe.js --all          # 逐个跑（很慢）
 *
 * 判定：
 *   killed   = 断言红了 → 这批断言**真的**在守这个功能（好）
 *   survived = 全绿     → 没有任何断言守住它（坏，要补断言或删掉那条假断言）
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const LOG = path.join(ROOT, '.workbuddy', 'mutation-log.json');

/* ============================================================
 * 变异表：name → { target, mutate(src) }
 * ------------------------------------------------------------
 * 选的都是**玩家能感知**的核心出口，且返回值简单、改坏后必然影响下游：
 *   · hpMult    体力→全军生命倍率  （改坏 = 装备不加血，战斗数值全偏）
 *   · cityDist  球面距离            （改坏 = AI 选点/最近城判断全错）
 *   · adminCisOf 行政区下辖清单     （改坏 = 视野解锁错乱）
 *   · staMax    体力上限            （改坏 = 装备体力不生效）
 * ============================================================ */
const MUTANTS = {
  'hpMult:no-bonus': {
    target: 'GAME.battle.hpMult',
    desc: 'hpMult 恒返回 1（无视体力加成）',
    apply: (G) => { G.battle.hpMult = function () { return 1; }; },
  },
  'hpMult:double': {
    target: 'GAME.battle.hpMult',
    desc: 'hpMult 把加成翻倍（1 + 2×bonus）',
    apply: (G) => {
      const orig = G.battle.hpMult;
      G.battle.hpMult = function (g) { const v = orig(g); return 1 + (v - 1) * 2; };
    },
  },
  'staMax:flat': {
    target: 'GAME.staMax',
    desc: 'staMax 忽视装备体力（只算基础）',
    apply: (G) => {
      // 只保留不含装备的算法：把装备清空后取值
      const orig = G.staMax;
      G.staMax = function (g) {
        if (!g || !g.equip) return orig(g);
        const bak = g.equip;
        g.equip = {};
        const v = orig(g);
        g.equip = bak;
        return v;
      };
    },
  },
  'cityDist:constant': {
    target: 'GAME.cityDist',
    desc: 'cityDist 恒返回 0（所有城等距）',
    apply: (G) => { G.cityDist = function () { return 0; }; },
  },
  'adminCisOf:empty': {
    target: 'GAME.map.adminCisOf',
    desc: 'adminCisOf 恒返回空表（无下辖地）',
    apply: (G) => { G.map.adminCisOf = function () { return []; }; },
  },
};

/* ============================================================
 * 探针本体：一个可以被 smoke 加载的"注射器"
 * ------------------------------------------------------------
 * smoke 用 `--mutate=<name>` 时，在 bundle 加载后调用这里注入变异。
 * 所以 smoke 里要有一小段：
 *   if (MUTATE) require('.workbuddy/tools/prof/mutation_probe.js').inject(GAME, MUTATE);
 * ============================================================ */
function inject(G, name) {
  const m = MUTANTS[name];
  if (!m) return false;
  try { m.apply(G); return true; } catch (e) { return false; }
}

/* ---------------- CLI ---------------- */
function main() {
  const argv = process.argv.slice(2);
  if (argv.indexOf('--list') >= 0 || argv.length === 0) {
    console.log('\n可用变异（把功能改坏，看断言会不会红）：\n');
    Object.keys(MUTANTS).forEach((k) => {
      console.log('  ' + k.padEnd(22) + MUTANTS[k].desc);
    });
    console.log('\n跑一个：  node .workbuddy/tools/prof/mutation_probe.js --run hpMult:no-bonus\n');
    return;
  }

  const i = argv.indexOf('--run');
  const names = i >= 0 ? [argv[i + 1]]
    : argv.indexOf('--all') >= 0 ? Object.keys(MUTANTS) : [];

  if (!names.length || !MUTANTS[names[0]]) {
    console.error('✗ 未知变异：' + names[0]);
    process.exit(2);
  }

  let log = {};
  try { log = JSON.parse(fs.readFileSync(LOG, 'utf8')); } catch (e) { log = {}; }

  names.forEach((name) => {
    console.log('\n══ 变异 ' + name + '：' + MUTANTS[name].desc);
    console.log('   目标：' + MUTANTS[name].target);
    const t0 = Date.now();
    // 用 smoke_fast（分片，~3.5 分钟）；分片崩溃会自动回退串行，照样有效
    const r = cp.spawnSync(process.execPath,
      [path.join('.workbuddy/tools/prof/smoke_fast.js'), '--mutate', name],
      { cwd: ROOT, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
    const out = (r.stdout || '') + (r.stderr || '');
    const m = /结果：(\d+) 通过 \/ (\d+) 失败/.exec(out);
    let fails = m ? +m[2] : -1;
    const secs = Math.round((Date.now() - t0) / 1000);

    let verdict, note;
    if (!m) {
      verdict = 'error';
      note = '没打印汇总行（分片崩溃且串行也失败？）';
    } else {
      /* ============================================================
       * ⛔ 判断 killed 必须**排除基线里的已知失败**。
       * ------------------------------------------------------------
       * 第一版直接用「红了几条」，实测踩到：hpMult 变异报 8 条红，
       * 其中 4 条是基线常驻的（出生州 / 帧自洽 / 回放 / 锁城签名）——
       * 它们**不做任何变异也是红的**。这样的判据会永远 killed，
       * 等于把变异测试变成一台永远点头的机器（正是本轮要防的"牢笼"）。
       * 只认「基线之外的新增失败」。
       * ============================================================ */
      const baseSet = new Set();
      try {
        const b = JSON.parse(fs.readFileSync(path.join(ROOT, '.workbuddy', 'gate-baseline.json'), 'utf8'));
        Object.keys((b.entries || {})['smoke-test.js'] || {}).forEach((t) => baseSet.add(t));
      } catch (e) { /* 没基线就当空表 */ }

      const seen = new Set();
      out.split('\n').forEach((L) => {
        const m2 = /❌\s+(.+?)(?:\s{2,}\[|$)/.exec(L);
        if (m2) seen.add(m2[1].trim());
      });
      const fresh = [...seen].filter((t) => !baseSet.has(t));
      const known = [...seen].filter((t) => baseSet.has(t));

      if (fresh.length > 0) {
        verdict = 'killed';
        fails = fresh.length;
        note = '新增失败 ' + fresh.length + ' 条 → 这个功能有断言守着'
          + (known.length ? '（另有 ' + known.length + ' 条基线常驻红，不计）' : '');
      } else {
        verdict = 'survived';
        fails = 0;
        note = '**只有基线那 ' + known.length + ' 条红，没有新增** → 这个功能没人守';
      }
    }
    console.log('   ' + verdict.toUpperCase().padEnd(9) + note + '（' + secs + ' 秒）');
    if (verdict === 'killed') {
      out.split('\n').filter((L) => L.indexOf('❌') >= 0).slice(0, 4)
        .forEach((L) => console.log('     ' + L.trim()));
    }

    log[name] = { verdict, fails, secs, at: new Date().toISOString().slice(0, 19), desc: MUTANTS[name].desc };
    try {
      fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
    } catch (e) { }
  });

  console.log('\n─'.repeat(30));
  Object.keys(log).forEach((k) => {
    const v = log[k].verdict;
    console.log('  ' + (v === 'killed' ? '✅' : v === 'survived' ? '❌' : '⚠️ ')
      + ' ' + k.padEnd(22) + v);
  });
}

module.exports = { inject, MUTANTS };
if (require.main === module) main();
