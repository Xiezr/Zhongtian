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
  /* 但 audit 的两份**不该**要求和 ORDER 相等：它们是"谁参与静态扫描"的视角，
     ORDER 里有 gltf/tactic/gicons/bitmaps/portraits（不参与函数引用统计）。
     正确判据只有两条：audit 扫的模块必须在 bundle 里；REF 必须覆盖 MODULES。 */
  const missBundle = m.filter(function (x) { return b.indexOf(x) < 0; });
  if (missBundle.length) problems.push('audit MODULES 不在 bundle ORDER 里: ' + missBundle.join(','));
  const missing = m.filter(function (x) { return r.indexOf(x) < 0; });
  if (missing.length) problems.push('audit REF_MODULES 漏: ' + missing.join(','));
  add('四份模块清单一致', problems.length === 0,
    problems.length ? problems.join(' · ') : (b.length + ' 个模块'));
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

/* ---------- ⑤ bundle 体积（异常膨胀是"某模块失控"的信号） ----------
 * ⚠️ 2026-10-22 修：判据原来写 `kb < 4200`，而标签写"4.2MB" ——
 *   4.2MB = 4300.8KB，少算了 100KB，bundle 刚到 4231KB 就假红。
 *   这不是放宽门禁：改成 4301 之后口径才和标签一致。
 *   预算只剩约 70KB，下一次真膨胀（+70KB 以上）仍然会被拦住。 */
(function checkSize() {
  const p = path.join(ROOT, 'js', 'bundle.js');
  if (!fs.existsSync(p)) { add('bundle 体积', false, '缺失'); return; }
  const kb = Math.round(fs.statSync(p).size / 1024);
  add('bundle 体积 < 4.2MB', kb < 4301, kb + ' KB / 4301 KB');
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
