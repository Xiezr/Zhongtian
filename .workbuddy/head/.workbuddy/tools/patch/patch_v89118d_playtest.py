# -*- coding: utf-8 -*-
"""
patch_v89118d_playtest.py — fork 出 v89.118 试玩评测驾驶舱

以 play_strat_600x.js（v89.92 多策略，与本版本兼容：短跑 0 错）为基，
生成 play_v89118.js，新增：
  · INV：分类计数（来犯预警/守成/被破/收编/斗将）+ 不变量违规台账
  · driveV89118：自动治疗开启、俘虏收编（并**核对人口增量口径**）、守城沙盘 verify 核对
  · checkInvariants：资源/军队/将领状态/施工卡死/行军卡死/战报上限/俘虏伤兵/战报坏值
  · checkViews：22 个视图渲染函数逐个调，抓异常与文本坏值（NaN/undefined）
  · 收尾输出 inv_final.json
用法：node play_v89118.js 108000 v89118_30h
"""
import io, os, sys

R = 'E:/Deepseekdb/'
SRC = R + '.workbuddy/tools/playtest/play_strat_600x.js'
DST = R + '.workbuddy/tools/playtest/play_v89118.js'

s = io.open(SRC, encoding='utf-8').read()
old_len = len(s)
FILE = {'s': s}


def edit(old, new, tag):
    n = FILE['s'].count(old)
    if n != 1:
        print('!! [%s] 锚点匹配 %d 次 → 中止' % (tag, n))
        sys.exit(1)
    FILE['s'] = FILE['s'].replace(old, new, 1)
    print('  ✓ %s' % tag)


# ---------- 1. 头部 ----------
edit("""/* STRAT v1 (v89.92) */
/* 生成自 play_gold_600x.js（v89.92 多策略 fork）；禁止手改生成物 —— 改 patch_v8992_strat.py。 */""",
"""/* v89.118 试玩评测驾驶舱 */
/* fork 自 play_strat_600x.js（v89.92 多策略）；禁止手改生成物 —— 改 patch_v89118d_playtest.py。 */""",
'H1 头部')

edit("""RUN('=== v89.92 多策略对照推演开始（STRAT v1 · MODE=' + MODE + '） ===');""",
"""RUN('=== v89.118 600× × 30h 全功能试玩评测（STRAT v1 基座 · MODE=' + MODE + '） ===');""",
'H2 标题')

# ---------- 2. INV 定义 + onLog 计数 ----------
edit("""/* ---------- 2. 采集器：全量日志 / 错误 / 战报 / 快照 ---------- */
var SNAPS = path.join(OUT, 'snapshots.jsonl');""",
"""/* ---------- 2. 采集器：全量日志 / 错误 / 战报 / 快照 ---------- */
/* v89.118：分类计数 + 不变量违规台账（试玩"发掘漏洞"的两只眼睛） */
var INV = {
  invasionWarn: 0, invasionHeld: 0, invasionBreached: 0, invasionFailBeacon: 0,
  conscriptRuns: 0, captiveConscripted: 0, captivePop: 0, duelMentions: 0,
  sandboxChecked: 0, defReportNoSbx: 0,
  pendingRep: null, slotLast: 0,
  violations: {}, violN: 0,
};
INV.count = function (msg) {
  /* v89.118 加固：标记时直接抓**战报引用**（布尔标记会在下一次脑周期读到别人） */
  function markRep() {
    var rs = (GAME.state && GAME.state.reports) || [];
    INV.pendingRep = rs[0] || null;
  }
  if (msg.indexOf('🔥 烽火：') >= 0) INV.invasionWarn++;
  else if (msg.indexOf('🛡 ') === 0 && msg.indexOf('击退') >= 0) { INV.invasionHeld++; markRep(); }
  else if (msg.indexOf('攻破城门') >= 0) { INV.invasionBreached++; markRep(); }
  else if (msg.indexOf('城门失守但') >= 0) { INV.invasionFailBeacon++; markRep(); }
  if (msg.indexOf('🪶 ') === 0 && msg.indexOf('收编俘虏') >= 0) INV.conscriptRuns++;
  if (msg.indexOf('【斗将】') >= 0) INV.duelMentions++;
};
INV.viol = function (tag, detail) {
  var key = tag + '｜' + String(detail).slice(0, 90);
  if (!INV.violations[key]) {
    INV.violations[key] = { n: 0, first: tNow };
    RUN('🚨 不变量违规：' + key);
  }
  INV.violations[key].n++;
  INV.violN++;
};
var SNAPS = path.join(OUT, 'snapshots.jsonl');""",
'H3 INV 定义')

edit("""G.onLog = function (msg) { EV.push({ t: tNow, gt: (G.state && G.state.world && G.state.world.elapsed) || 0, msg: msg }); };""",
"""G.onLog = function (msg) {
  EV.push({ t: tNow, gt: (G.state && G.state.world && G.state.world.elapsed) || 0, msg: msg });
  INV.count(msg);
};""",
'H4 onLog 计数')

# ---------- 3. 建局段：开启自动治疗 ----------
edit("""st.settings.innAuto = { on: true, min: 'ying' };
G.ui = G.ui || {}; G.ui._cityId = city0.id;""",
"""st.settings.innAuto = { on: true, min: 'ying' };
st.settings.autoHeal = true;                 /* v89.118：自动治疗入驾驶舱（满金即治） */
G.ui = G.ui || {}; G.ui._cityId = city0.id;""",
'H5 开启自动治疗')

# ---------- 3.5 名城攻坚战（改**源文件** MILE 表：提前 + 降门槛） ----------
edit("""  { id: 'npcAtk', at: 19200, done: false, retries: 0, fn: function () {""",
"""  { id: 'npcAtk', at: 7200, done: false, retries: 0, fn: function () {""",
'G2a 名城攻坚提前')
edit("""      if (totalArmy() < 150000) { RUN('📋 名城攻坚评估：兵力 ' + fmtNum(totalArmy()) + ' 不足以挑战名城（跳过实攻，作为内容深度结论）'); return 'ok'; }""",
"""      /* v89.118：门槛 150000 → 20000（30h 试玩实测兵力 12.6 万，旧门槛永远跳过；
         降门槛让试玩**真打一场名城** —— 覆盖斗将 / 名城守将 / 守城沙盘两路）。 */
      if (totalArmy() < 20000) { RUN('📋 名城攻坚评估：兵力 ' + fmtNum(totalArmy()) + ' 不足以挑战名城（跳过实攻，作为内容深度结论）'); return 'ok'; }""",
'G2b 名城门槛')

# ---------- 4. 8.5 段（新功能驱动 + 不变量 + 视图体检） ----------
edit("""/* ---------- 9. 主循环 ---------- */""",
"""/* ---------- 8.5 v89.118：新功能驱动 + 不变量体检 + 视图体检 ---------- */
function driveV89118() {
  /* ① 俘虏收编（新口径：收编那一刻才加人口，增量 = 兵种 pop 折算）——
        顺手核对"执行侧人口增量"与"返回的 pop 字段"是否同源。 */
  var cn = G.captivesTotalOf ? G.captivesTotalOf() : 0;
  if (cn >= 300) {
    var popB = 0;
    st.cities.forEach(function (c) { popB += (G.res(c).pop || 0); });
    var r = null;
    try { r = G.doConscriptCaptives(); } catch (e) { noteErr('conscript', e); }
    if (r && r.ok) {
      INV.conscriptRuns++;
      INV.captiveConscripted += r.n;
      INV.captivePop += r.pop;
      var popA = 0;
      st.cities.forEach(function (c) { popA += (G.res(c).pop || 0); });
      if (Math.abs((popA - popB) - r.pop) > 1) {
        INV.viol('conscript-pop-mismatch', '实际Δ=' + Math.round(popA - popB) + ' 报=' + r.pop);
      }
      RUN('🪶 v89.118：收编 ' + r.n + ' 众 → 人口 +' + r.pop + '（口径核对 Δ=' + Math.round(popA - popB) + '）');
    }
  }
  /* ② 战报沙盘 verify（v89.118 加固：核的是**标记时那条战报的引用**）——
        违规消息带 hist/sim 明细，真出问题一眼定位（错位假阳性已排除）。 */
  if (INV.pendingRep) {
    var rep0 = INV.pendingRep;
    INV.pendingRep = null;
    if (rep0 && (st.reports || []).indexOf(rep0) >= 0) {
      if (rep0.sandbox) {
        var sb = null;
        try { sb = G.battle.sandboxOf ? G.battle.sandboxOf(rep0) : null; } catch (e) { noteErr('sandboxOf', e); }
        if (sb && sb.verify === false) {
          var hR = rep0.sandbox.result || {};
          INV.viol('sandbox-verify-false', String(rep0.title || '').slice(0, 26)
            + '｜hist ' + hR.rounds + '/' + hR.atkLoss + '/' + hR.defLoss
            + '｜sim ' + sb.sim.rounds + '/' + sb.sim.atkLoss + '/' + sb.sim.defLoss);
        } else if (sb) INV.sandboxChecked++;
        else INV.defReportNoSbx++;
      } else {
        /* 没配方的战报 —— 记数（未列阵/空城计等路径可能确实无沙盘，不算违规） */
        INV.defReportNoSbx++;
      }
    }
  }
  /* ③ 晋爵（v89.118 补驱动）：领地上限 = 下一档爵位门槛（v89.108）——
        不晋爵就扩不动：旧驾驶舱因此整场停在 2 城（实测）。 */
  if (tNow - (INV.lastPromoteAt || -1e9) >= 240) {
    INV.lastPromoteAt = tNow;
    var pr = null;
    try { pr = G.systems.promote(); } catch (e3) { noteErr('promote', e3); }
    if (pr && pr.ok) {
      INV.promotes = (INV.promotes || 0) + 1;
      RUN('🏅 晋爵：' + pr.msg + '（领地上限 ' + G.cityCapOf() + ' 座）');
    } else if (pr && !pr.ok && !INV.promoteMsg) {
      INV.promoteMsg = String(pr.msg || '');          /* 首次记录原因（分析用） */
    }
  }
  /* ④ 扩张（v89.118 补驱动）：有爵位空间就找平原建新城 —— 覆盖多城路径。
        搜索半径外扩到 48 格（默认 3~20 在 30h 实测没找到空平原 → 卡 2 城）。 */
  if (tNow - (INV.lastExpandAt || -1e9) >= 480) {
    INV.lastExpandAt = tNow;
    var capE = G.cityCapOf ? G.cityCapOf() : 0;
    if ((st.cities || []).length < capE) {
      var spotE = null;
      var c0E = st.cities[0];
      for (var rrE = 3; rrE <= 48 && !spotE; rrE++) {
        for (var dyE = -rrE; dyE <= rrE && !spotE; dyE++) for (var dxE = -rrE; dxE <= rrE && !spotE; dxE++) {
          if (Math.max(Math.abs(dxE), Math.abs(dyE)) !== rrE) continue;
          var xE = c0E.x + dxE, yE = c0E.y + dyE;
          if (xE < 3 || yE < 3 || xE >= DATA.MAP_W - 3 || yE >= DATA.MAP_H - 3) continue;
          var tlE = G.map.tile(xE, yE);
          if (!tlE || tlE.terrain !== 'plain') continue;
          if (G.map.wildAt(xE, yE) || G.map.npcAt(xE, yE) || G.map.ownCityAt(xE, yE) || G.map.fortAt(xE, yE)) continue;
          spotE = { x: xE, y: yE };
        }
      }
      if (spotE) {
        var reE = null;
        try { reE = G.buildCityAt(spotE.x, spotE.y); } catch (e4) { noteErr('expand', e4); }
        if (reE && reE.ok) RUN('🏙 建新城：' + (reE.msg || '') + '（城 ' + st.cities.length + '/' + capE + '）');
        else if (reE && !INV.expandMsg) INV.expandMsg = String(reE.msg || '(无 msg)');
      } else if (!INV.expandMsg) {
        INV.expandMsg = '半径 48 格内无空闲平原（cap=' + capE + '，城=' + st.cities.length + '）';
      }
    }
  }
  /* ④b 名城攻坚（v89.118 补驱动）：兵力够且有闲将 → 打最近名城。
        覆盖：斗将（双方有将才触发）/ 名城守将 / 出征沙盘与守城沙盘两路。 */
  if (!INV.npcAtkDone && tNow - (INV.lastNpcAtkAt || -1e9) >= 2400) {
    INV.lastNpcAtkAt = tNow;
    if (totalArmy() >= 20000) {
      var c0N = st.cities[0], npcN = null;
      for (var rrN = 5; rrN <= 30 && !npcN; rrN++) {
        for (var dyN = -rrN; dyN <= rrN && !npcN; dyN++) for (var dxN = -rrN; dxN <= rrN && !npcN; dxN++) {
          if (Math.max(Math.abs(dxN), Math.abs(dyN)) !== rrN) continue;
          var fN = G.map.npcAt(c0N.x + dxN, c0N.y + dyN);
          if (fN) npcN = fN;
        }
      }
      if (npcN) {
        var genN = idleGen(true);
        if (genN) {
          setCity(c0N);
          var tkN = takeArmy(c0N, Math.floor(totalArmy() * 0.6));
          var rN = safeCall('npcAtk118', function () {
            return G.march.dispatch({ kind: 'city', id: npcN.id, npc: npcN }, 'raid', tkN.army, genN.id);
          });
          if (rN && rN.ok) {
            INV.npcAtkDone = 1;
            RUN('⚔️ v89.118 名城攻坚「' + npcN.name + '」：' + rN.msg + '（兵力 ' + fmtNum(tkN.total) + '）');
          } else if (rN && !rN.ok && !INV.npcAtkMsg) {
            INV.npcAtkMsg = String(rN.msg || '');
          }
        }
      } else if (!INV.npcAtkMsg) {
        INV.npcAtkMsg = '30 格内无名城';
      }
    } else if (!INV.npcAtkMsg) {
      INV.npcAtkMsg = '兵力未达 20000（当前 ' + fmtNum(totalArmy()) + '）';
    }
  }
  /* ⑤ 来犯排期推进（只记进度，供收尾对账） */
  var slotNow = G.invasionSlotOf ? G.invasionSlotOf(G.realNow()) : 0;
  if (slotNow > INV.slotLast) INV.slotLast = slotNow;
}

function checkInvariants() {
  var RESK = ['grain', 'wood', 'stone', 'iron', 'gold'];
  var OKS = { idle: 1, march: 1, gather: 1, mayor: 1, guard: 1 };
  st.cities.forEach(function (c) {
    var R2 = G.res(c);
    RESK.forEach(function (k2) {
      var v = R2[k2];
      if (!isFinite(v)) INV.viol('res-nan', c.name + '.' + k2 + '=' + v);
      else if (v < -1) INV.viol('res-negative', c.name + '.' + k2 + '=' + Math.round(v));
    });
    if (!isFinite(R2.pop) || R2.pop < 0) INV.viol('pop-bad', c.name + ' pop=' + R2.pop);
    for (var k in (c.army || {})) {
      var n = c.army[k];
      if (!isFinite(n) || n < 0) INV.viol('army-bad', c.name + '.' + k + '=' + n);
      if (!G.DATA.TROOPS[k]) INV.viol('army-unknown', k);
    }
    (c.cells || []).forEach(function (cl, ci) {
      if (cl && cl.pending && cl.pending.until && cl.pending.until < st.world.elapsed - 86400 * 3) {
        INV.viol('build-stuck', c.name + ' cell#' + ci);
      }
    });
  });
  (st.generals || []).forEach(function (g) {
    var s2 = g.status || 'idle';
    if (!OKS[s2]) INV.viol('gen-status', g.name + '=' + s2);
    if (!isFinite(g.level) || (g.level || 0) < 0) INV.viol('gen-lv', g.name + '=' + g.level);
  });
  (st.marches || []).forEach(function (m) {
    if (m.totalTime && m.elapsed > m.totalTime * 3 + 600) {
      INV.viol('march-stuck', (m.target && m.target.name) || '?');
    }
  });
  if ((st.reports || []).length > (G.DATA.REPORT_MAX || 60) + 2) {
    INV.viol('report-overflow', st.reports.length);
  }
  var cn2 = G.captivesTotalOf ? G.captivesTotalOf() : 0;
  if (!isFinite(cn2) || cn2 < 0) INV.viol('captive-bad', cn2);
  if (!isFinite(st.wounded || 0) || (st.wounded || 0) < 0) INV.viol('wounded-bad', st.wounded);
  if (!st.cities.length) INV.viol('no-city', '');
  (st.reports || []).slice(0, 8).forEach(function (rp) {
    var tx = String(rp.body || '') + String((rp.loot || []).join(''));
    var m2 = tx.match(/NaN|undefined|Infinity/);
    if (m2) INV.viol('report-text', String(rp.title || '').slice(0, 20) + ' 含 ' + m2[0]);
  });
}

function checkViews() {
  var LIST = [
    ['cityHTML', 'cityHTML'], ['extHTML', 'extHTML'], ['troopsHTML', 'troopsHTML'],
    ['generalsHTML', 'generalsHTML'], ['marchesHTML', 'marchesHTML'], ['equipHTML', 'equipHTML'],
    ['techHTML', 'techHTML'], ['itemsHTML', 'itemsHTML'], ['rankHTML', 'rankHTML'],
    ['mapHTML', 'mapHTML'], ['shopHTML', 'shopHTML'], ['bagHTML', 'bagHTML'],
    ['tasksHTML', 'tasksHTML'], ['reportsHTML', 'reportsHTML'], ['settingsHTML', 'settingsHTML'],
    ['autoHTML', 'autoHTML'], ['storyHTML', 'storyHTML'], ['storiesHTML', 'storiesHTML'],
    ['marchBeaconHTML', 'marchBeaconHTML'], ['marchAffairsHTML', 'marchAffairsHTML'],
    ['invasionRulesHTML', 'invasionRulesHTML'], ['beaconFlowHTML', 'beaconFlowHTML'],
  ];
  LIST.forEach(function (it) {
    var fn = G.ui[it[1]];
    if (typeof fn !== 'function') { INV.viol('view-missing', it[0]); return; }
    try {
      var v = fn();
      if (typeof v === 'string' && /NaN|undefined/.test(v)) {
        INV.viol('view-text', it[0] + ' 含 ' + (v.match(/NaN|undefined/) || [''])[0]);
      }
    } catch (e) { noteErr('view.' + it[0], e); }
  });
  /* 自动化面板七个页逐个渲染（v89.118 起含 invasion） */
  (G.ui.AUTO_ITEMS || []).forEach(function (x) {
    try {
      var h = G.ui.autoPaneHTML(x.id);
      if (typeof h === 'string' && /NaN|undefined/.test(h)) INV.viol('view-text', 'pane.' + x.id);
    } catch (e) { noteErr('view.pane.' + x.id, e); }
  });
}

/* ---------- 9. 主循环 ---------- */""",
'H6 8.5 段')

# ---------- 5. 主循环插入调用 ----------
edit("""    safeCall('b.milestones', execMilestones);
  }
  if (tNow % SNAP_EVERY === 0) snapshot();""",
"""    safeCall('b.milestones', execMilestones);
    safeCall('b.v118', driveV89118);            /* v89.118：新功能驱动（收编/沙盘核对/来犯） */
  }
  if (tNow % 240 === 0) safeCall('inv.check', checkInvariants);     /* v89.118：不变量体检 */
  if (tNow % 4800 === 0) safeCall('inv.views', checkViews);          /* v89.118：视图渲染体检 */
  if (tNow % SNAP_EVERY === 0) snapshot();""",
'H7 主循环调用')

# ---------- 6. 收尾输出 ----------
edit("""try {
  fs.writeFileSync(path.join(OUT, 'strat_final.json'), JSON.stringify({""",
"""try {
  fs.writeFileSync(path.join(OUT, 'inv_final.json'), JSON.stringify({
    invasion: { warn: INV.invasionWarn, held: INV.invasionHeld, breached: INV.invasionBreached,
      failBeacon: INV.invasionFailBeacon, slotLast: INV.slotLast },
    captive: { conscriptedN: INV.captiveConscripted, popGained: INV.captivePop, runs: INV.conscriptRuns,
      campLeft: (G.captivesTotalOf ? G.captivesTotalOf() : 0) },
    sandbox: { checked: INV.sandboxChecked, noSandbox: INV.defReportNoSbx },
    duelMentions: INV.duelMentions,
    promotes: INV.promotes || 0,
    promoteMsg: INV.promoteMsg || '',
    expandMsg: INV.expandMsg || '',
    npcAtkMsg: INV.npcAtkMsg || '',
    violations: INV.violations, violN: INV.violN
  }, null, 1));
} catch (e) { noteErr('inv.final', e); }
try {
  fs.writeFileSync(path.join(OUT, 'strat_final.json'), JSON.stringify({""",
'H8 收尾输出')

# ---------- 写盘 + 自检 ----------
assert '<<<<<<<' not in FILE['s']
o = (FILE['s'].count('{'), FILE['s'].count('}'))
so = (s.count('{'), s.count('}'))
d0 = (o[0] - o[1]) - (so[0] - so[1])
print('花括号净变化 %+d（新增段自平衡）' % d0)
if d0 != 0:
    print('!! 不配平 → 中止'); sys.exit(1)
tmp = DST + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(FILE['s'])
os.replace(tmp, DST)
print('  → 落盘 %s（%d → %d 字节）' % (os.path.basename(DST), old_len, len(FILE['s'])))
print('补丁 E（驾驶舱 fork）完成')
