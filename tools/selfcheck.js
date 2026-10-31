/* ============================================================
 * tools/selfcheck.js —— 项目自检（定期跑 · 可被定时任务直接调用）
 * ------------------------------------------------------------
 * 为什么要有它：门禁是四份脚本（audit / chain / smoke / e2e），
 *   · 单跑一个看不出"四个都过"；
 *   · 而且有几类问题**不在任何门禁里**：
 *     ① 模块清单散在**四处**（build_bundle ORDER / smoke ORDER /
 *        audit MODULES / audit REF_MODULES）—— 漏一处就出误报；
 *     ② bundle 与源码不同步（改了源码忘了构建）；
 *     ③ 工作区堆了未提交改动（下次提交被门禁拦下时才发现）。
 *   这个脚本把"四份清单是否一致 + 四道门禁 + 工作区状态"收成一份简报。
 *
 * 用法：
 *   node tools/selfcheck.js            # 全量（约 4 分钟）
 *   node tools/selfcheck.js --fast     # 跳过 e2e（约 1.5 分钟）
 *
 * 退出码：0 全绿 / 1 有红项。
 * 产物：docs/自检-YYYY-MM-DD.md（当天覆盖）
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FAST = process.argv.indexOf('--fast') >= 0;
const TODAY = new Date();
const YMD = TODAY.getFullYear() + '-' +
  String(TODAY.getMonth() + 1).padStart(2, '0') + '-' +
  String(TODAY.getDate()).padStart(2, '0');

const rows = [];      /* { name, ok, detail } */
function add(name, ok, detail) { rows.push({ name, ok: !!ok, detail: detail || '' }); }

function run(cmd, args, timeout) {
  try {
    const out = execFileSync(cmd, args, {
      cwd: ROOT, encoding: 'utf8', timeout: timeout || 600000,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, {
        NODE_PATH: process.env.NODE_PATH || 'C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules',
      }),
    });
    return { ok: true, out: out || '' };
  } catch (e) {
    return { ok: false, out: ((e.stdout || '') + (e.stderr || '')), code: e.status };
  }
}

/* ---------- ① 四份模块清单一致性 ---------- */
function listIn(file, marker) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return null;
  const src = fs.readFileSync(p, 'utf8');
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const j = src.indexOf(']', i);
  if (j < 0) return null;
  const seg = src.slice(i, j);
  return (seg.match(/'([a-z0-9]+)'/g) || []).map(function (s) { return s.replace(/'/g, ''); });
}
(function checkManifests() {
  const b = listIn('.workbuddy/tools/patch/build_bundle.py', 'ORDER = [');
  const s = listIn('smoke-test.js', 'var ORDER = [');
  const m = listIn('audit.js', 'const MODULES = [');
  const r = listIn('audit.js', 'const REF_MODULES = [');
  if (!b || !s || !m || !r) { add('四份模块清单一致', false, '有一份没解析到'); return; }
  const eq = (a, c) => a.length === c.length && a.every((x, i) => x === c[i]);
  const problems = [];
  /* build_bundle ORDER 与 smoke 守卫 ORDER 必须是**完全同一份**（同一个视角：加载顺序）*/
  if (!eq(b, s)) problems.push('build_bundle ORDER ≠ smoke ORDER');

  /* ── 双向校验（判据A · 2026-10-31）──
     来历：以前只查「audit 扫的 ⊆ bundle」这一个方向，于是**新增模块漏收进 audit 清单**
     时没有任何一条红 —— audit 对它完全是瞎的：它定义的东西看不见，别人对它的引用
     就被误报成「⑥ 引用了不存在的成员」。实测：belt / placement / planetgen
     三个新模块漏收 → `GAME.planetgen` 假红（定义在 planetgen.js，audit 没读）。
     所以 ORDER → 清单 这个反方向也必须查。反向豁免**必须写理由**，且只许下面两张表。 */

  /* audit MODULES 的豁免：不参与 ①「函数定义 / 引用」统计的模块（逐个核过，别加"顺手"豁免）：
       · gltf     —— 自研 GLB 解析器，只在 window 级挂 GAME.gltf / GAME.gltfVersion
                     （⑥ 的 REF_OK 已写清来源）；函数是 GTF.* 内部别名，① 数它只污染函数总数；
       · tactic   —— 战斗引擎内核，函数是 T.* 内部别名（31 个），只被 battle 消费；
                     **它的引用必须扫**（在 REF_MODULES 里），但不必进①的死函数统计；
       · gicons / bitmaps —— 图标 / 位图**纯数据表挂载**，0 个 `X.y = function` 定义；
       · portraits —— 立绘表挂载，函数是 P.* 内部别名（7 个），同 gicons。 */
  const MODULES_EXEMPT = ['gltf', 'tactic', 'gicons', 'bitmaps', 'portraits'];
  /* audit REF_MODULES 的豁免：⑥ 的引用扫描面也要求覆盖 ORDER。只豁免 gltf 一个 ——
     它挂的 GAME.gltf / GAME.gltfVersion 已在 REF_OK 里写清来源，扫它不再产出可行动信号。 */
  const REF_MODULES_EXEMPT = ['gltf'];

  /* 正向：清单里的模块必须在 bundle 里（否则读取的是不存在的文件，检查会崩或静默漏） */
  const missBundle = m.filter(function (x) { return b.indexOf(x) < 0; });
  if (missBundle.length) problems.push('audit MODULES 不在 bundle ORDER 里: ' + missBundle.join(','));
  const missBundleR = r.filter(function (x) { return b.indexOf(x) < 0; });
  if (missBundleR.length) problems.push('audit REF_MODULES 不在 bundle ORDER 里: ' + missBundleR.join(','));
  /* 反向：ORDER 里的模块必须被 audit 扫到（除上面两张有理由的豁免表） */
  const missMod = b.filter(function (x) { return m.indexOf(x) < 0 && MODULES_EXEMPT.indexOf(x) < 0; });
  if (missMod.length) problems.push('audit MODULES 漏收（bundle ORDER 有、①没扫 → audit 对它是瞎的）: ' + missMod.join(','));
  const missRef = b.filter(function (x) { return r.indexOf(x) < 0 && REF_MODULES_EXEMPT.indexOf(x) < 0; });
  if (missRef.length) problems.push('audit REF_MODULES 漏收（bundle ORDER 有、⑥没扫）: ' + missRef.join(','));
  /* REF 必须覆盖 MODULES（⑥ 的扫描面是 ① 的超集） */
  const missing = m.filter(function (x) { return r.indexOf(x) < 0; });
  if (missing.length) problems.push('audit REF_MODULES 漏: ' + missing.join(','));
  add('四份模块清单一致', problems.length === 0,
    problems.length ? problems.join(' · ')
      : (b.length + ' 个模块 · 双向校验通过（MODULES 豁免 ' + MODULES_EXEMPT.length
         + ' · REF_MODULES 豁免 ' + REF_MODULES_EXEMPT.length + '）'));
})();

/* ---------- ② bundle 与源码同步 ---------- */
(function checkBundle() {
  const r = run('python', ['.workbuddy/tools/patch/build_bundle.py', '--check'], 120000);
  const line = (r.out.split('\n').filter(Boolean).pop() || '').trim();
  add('bundle 与源码同步', r.ok, line);
})();

/* ---------- ③ 四道门禁 ---------- */
function gate(name, cmd, args, passRe) {
  const r = run(cmd, args);
  const out = r.out || '';
  const m = passRe.exec(out);
  const ok = r.ok && !!m;
  const tail = (out.split('\n').filter(function (l) { return /结果|汇总|死函数|✅|❌/.test(l); }).pop() || '').trim();
  add(name, ok, m ? m[0] : (tail || ('退出码 ' + r.code)));
  /* 把失败项摘出来，简报里要能看到"红在哪" */
  const bad = out.split('\n').filter(function (l) { return l.indexOf('❌') >= 0; }).slice(0, 5);
  if (!ok && bad.length) add('  └ ' + name + ' 失败项', false, bad.join(' | ').slice(0, 300));
  return out;
}

gate('结构审计 audit', 'node', ['audit.js'], /死函数 0 · 孤儿按钮 0/);
gate('链路审计 chain', 'node', ['chain-audit.js'], /结果：(\d+) 通过 \/ 0 失败/);
gate('冒烟 smoke', 'node', ['smoke-test.js'], /结果：(\d+) 通过 \/ 0 失败/);
if (!FAST) gate('端到端 e2e', 'node', ['e2e-test.js'], /结果：(\d+) 通过 \/ 0 失败/);

/* ---------- ④ 工作区状态 ---------- */
(function checkGit() {
  const r = run('git', ['status', '--short'], 60000);
  if (!r.ok) { add('工作区干净', false, 'git 不可用'); return; }
  const lines = r.out.split('\n').filter(Boolean);
  /* 只算**已跟踪**文件的改动：`??` 是 .workbuddy 日志/备份/截图这类过程产物，
     项目本来就有几百项，算进来等于每天都红（第一版就踩了这个，误报 247 项）。*/
  const tracked = lines.filter(function (l) { return l.indexOf('??') !== 0; });
  const staged = tracked.filter(function (l) { return /^[MADRC]/.test(l); }).length;
  const dirty = tracked.length;
  add('工作区干净（已跟踪文件）', dirty === 0,
    dirty ? (dirty + ' 项改动未提交（已暂存 ' + staged + '）') : '无改动');
})();

/* ---------- ⑤ 分包体积（异常膨胀是"某模块失控"的信号） ----------
 * v104（老板 2026-10-23「拆」）：单包曾到 4245KB / 上限 4301KB，只剩 56KB。
 * 按"何时用到"切成三包（core / war / ui），每包单独量、单独判 ——
 * 某一包失控（比如 ui 突然涨 800KB）一眼能看出是哪一块，而不是一笔总数。
 *
 * 阈值 2600KB：三包当前 core 1525 / war 561 / ui 1234，最大的一包留了 40% 余量。
 * ⚠️ 同时钉住"旧单包不许回来"：留着它就是第二份产物，迟早有人改错那一份。 */
(function checkSize() {
  const packs = ['bundle-core', 'bundle-war', 'bundle-ui'];
  const LIMIT = 2600;
  const parts = [];
  let ok = true;
  for (const n of packs) {
    const p = path.join(ROOT, 'js', n + '.js');
    if (!fs.existsSync(p)) { parts.push(n + ' 缺失'); ok = false; continue; }
    const kb = Math.round(fs.statSync(p).size / 1024);
    if (kb >= LIMIT) ok = false;
    parts.push(n.replace('bundle-', '') + ' ' + kb);
  }
  if (fs.existsSync(path.join(ROOT, 'js', 'bundle.js'))) { ok = false; parts.push('旧单包仍在'); }
  add('分包体积（各 < 2.6MB · 无旧单包）', ok, parts.join(' · ') + ' KB / ' + LIMIT + ' KB');
})();

/* ---------- ⑥ 架构棘轮（v106 · 老板 2026-10-23 把架构决定权交过来） ----------
 * 为什么是"棘轮"而不是"重构干净"：57 个模块 / 4000+ 断言 / 两年迭代，
 * 把 state（249 出口 · 46 个模块依赖）拆开，失败概率远大于收益。
 * 但腐化得有闸：基线记下当前每对跨层引用次数，**只许降不许升**。
 * 新代码一跨层就红 —— 老债按自己的节奏还。 */
(function checkArch() {
  const p = path.join(ROOT, 'tools/diag-arch.js');
  if (!fs.existsSync(p)) { add('架构棘轮', false, '缺 tools/diag-arch.js'); return; }
  const r = run('node', ['tools/diag-arch.js', '--check'], 120000);
  const txt = (r.out || '').trim().split('\n').filter(Boolean);
  const line = (txt[txt.length - 1] || '').replace(/^[✅❌]\s*/, '');
  add('架构棘轮（跨层引用不增加）', r.ok, line || (r.ok ? 'ok' : '失败'));
})();

/* ---------- 输出 ---------- */
const fails = rows.filter(function (x) { return !x.ok; });
const lines = [];
lines.push('# 自检报告 · ' + YMD);
lines.push('');
lines.push('> 由 `node tools/selfcheck.js` 生成' + (FAST ? '（--fast，跳过 e2e）' : '（全量）'));
lines.push('');
lines.push('**结论：' + (fails.length ? ('⛔ ' + fails.length + ' 项红') : '✅ 全绿') + '**');
lines.push('');
lines.push('| 检查项 | 结果 | 说明 |');
lines.push('|---|---|---|');
rows.forEach(function (x) {
  lines.push('| ' + x.name + ' | ' + (x.ok ? '✅' : '❌') + ' | ' + String(x.detail).replace(/\|/g, '/') + ' |');
});
lines.push('');

/* ⚠️ 产物必须落在**不进版本库**的地方（.workbuddy/tmp/ 已被 .gitignore 覆盖）。
   第一版写进 docs/，结果自检每跑一次就改一次那个文件 ——
   "工作区干净"这一项刚提交完又是红的，自己把自己弄脏。
   生成物不是源码，不该被纳入"是否有未提交改动"的统计。 */
const outDir = path.join(ROOT, '.workbuddy', 'tmp');
try { fs.mkdirSync(outDir, { recursive: true }); } catch (e) { /* ignore */ }
const outp = path.join(outDir, 'selfcheck-' + YMD + '.md');
try { fs.writeFileSync(outp, lines.join('\n'), 'utf8'); } catch (e) { /* 不可写就只打印 */ }

console.log(lines.join('\n'));
console.log('\n（简报已写入 .workbuddy/tmp/selfcheck-' + YMD + '.md）');
process.exit(fails.length ? 1 : 0);
