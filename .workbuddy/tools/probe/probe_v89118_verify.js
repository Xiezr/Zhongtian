/* ============================================================
 * probe_v89118_verify.js — 沙盘重跑不一致（verify=false）诊断
 * ------------------------------------------------------------
 * 背景：600×30h 试玩抓出 23 场 `sandbox-verify-false`（守城 + 掠夺两路）。
 * 本探针：载入试玩终档 → 对每份有配方的战报跑 sandboxOf →
 *   ① 列 hist vs sim 的 rounds/atkLoss/defLoss 差异；
 *   ② 对 false 的，dump 配方里的关键输入（init 动作/目标、simOpts、编制规模），
 *      并做**单变量排查**：把 init 的 stance 全部改成 advance（默认）再跑，看是否趋于一致。
 * 用法：node .workbuddy/tools/probe/probe_v89118_verify.js [tag]
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var TAG = process.argv[2] || 'v89118_30h';
var D = path.join(R, '.workbuddy/tmp/playtest600', TAG);
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, U = G.utils;
G.newGame({ name: 'x', cityName: '许都' });
var payload = JSON.parse(fs.readFileSync(path.join(D, 'final_state.json'), 'utf8'));
G.adoptState(payload);
var st = G.state;

console.log('===== 战报沙盘重跑核验（' + TAG + '）=====');
var ok = 0, bad = 0;
var badList = [];
(st.reports || []).forEach(function (rep, i) {
  if (!rep.sandbox) return;
  var sb = null;
  try { sb = G.battle.sandboxOf(rep); } catch (e) { console.log('  #' + i + ' sandboxOf 抛错：' + e.message); bad++; return; }
  if (!sb) { bad++; badList.push({ i: i, rep: rep, sb: null }); return; }
  if (sb.verify) { ok++; return; }
  bad++;
  badList.push({ i: i, rep: rep, sb: sb });
});
console.log('可核验战报：verify=true ' + ok + ' 场 · verify=false ' + bad + ' 场');

console.log('\n--- false 清单（前 12）---');
badList.slice(0, 12).forEach(function (x) {
  var rep = x.rep, sb = x.sb, rc = rep.sandbox;
  console.log('  ' + String(rep.title || '').slice(0, 30));
  console.log('     hist: rounds=' + rc.result.rounds + ' atkLoss=' + rc.result.atkLoss + ' defLoss=' + rc.result.defLoss);
  if (sb) {
    console.log('     sim : rounds=' + sb.sim.rounds + ' atkLoss=' + sb.sim.atkLoss + ' defLoss=' + sb.sim.defLoss
      + ' winner=' + sb.sim.winner);
  }
  console.log('     ourSide=' + rc.ourSide + ' atk=' + G.battle.marchMenOf(rc.atkArmy) + ' def=' + G.battle.marchMenOf(rc.scArmy)
    + ' cmds=' + (rc.cmds ? rc.cmds.length + ' 轮' : '无'));
  console.log('     simOpts=' + JSON.stringify(rc.simOpts));
  console.log('     init.atk=' + JSON.stringify((rc.init || {}).atk).slice(0, 220));
  console.log('     init.def=' + JSON.stringify((rc.init || {}).def).slice(0, 220));
  console.log('     scGen=' + (rc.scGen ? ('有(' + (rc.scGen.name || '?') + ')') : '无')
    + ' gen=' + (rc.gen ? '有' : '无'));
});

/* ---- 单变量排查 ①：把所有指令重置为默认（全 advance / 目标=对位），看是否一致 ---- */
console.log('\n--- 单变量 A：忽略 cmds（不重放逐回合指令）---');
var aOk = 0, aBad = 0;
badList.forEach(function (x) {
  if (!x.sb) return;
  var rep2 = JSON.parse(JSON.stringify(x.rep));
  rep2.sandbox.cmds = null;
  var sb2 = null;
  try { sb2 = G.battle.sandboxOf(rep2); } catch (e) { return; }
  if (sb2 && sb2.verify) aOk++; else aBad++;
});
console.log('  A：忽略 cmds 后 verify=true ' + aOk + ' / false ' + aBad);

/* ---- 单变量排查 ②：把 init 的 stance 全改 advance 且 target 清空 ---- */
console.log('\n--- 单变量 B：init 动作全改默认（advance / 目标清空）---');
var bOk = 0, bBad = 0;
badList.forEach(function (x) {
  if (!x.sb) return;
  var rep2 = JSON.parse(JSON.stringify(x.rep));
  ['atk', 'def'].forEach(function (sd) {
    (rep2.sandbox.init[sd] || []).forEach(function (u) { u.s = 'advance'; u.t = ''; });
  });
  var sb2 = null;
  try { sb2 = G.battle.sandboxOf(rep2); } catch (e) { return; }
  if (sb2 && sb2.verify) bOk++; else bBad++;
});
console.log('  B：默认动作后 verify=true ' + bOk + ' / false ' + bBad);

/* ---- 单变量排查 ③：重跑两次同样的输入，看引擎本身是否确定  ---- */
console.log('\n--- 单变量 C：同一输入重跑两次（引擎确定性）---');
var cBad = 0, cTot = 0;
badList.slice(0, 5).forEach(function (x) {
  if (!x.sb) return;
  var s1 = G.battle.sandboxOf(x.rep), s2 = G.battle.sandboxOf(x.rep);
  cTot++;
  if (!s1 || !s2 || s1.sim.rounds !== s2.sim.rounds || s1.sim.atkLoss !== s2.sim.atkLoss
    || s1.sim.defLoss !== s2.sim.defLoss) {
    cBad++;
    console.log('  ✗ 不确定：' + String(x.rep.title).slice(0, 26)
      + ' r1=' + (s1 && s1.sim.rounds) + '/' + (s1 && s1.sim.atkLoss)
      + ' r2=' + (s2 && s2.sim.rounds) + '/' + (s2 && s2.sim.atkLoss));
  }
});
console.log('  C：' + cTot + ' 场里 ' + cBad + ' 场重跑不一致（>0 = 引擎有随机性/状态依赖）');

process.exit(0);
