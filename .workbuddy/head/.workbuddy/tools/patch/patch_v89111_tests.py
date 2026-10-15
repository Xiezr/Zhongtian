# -*- coding: utf-8 -*-
"""
v89.111 测试与工具适配 + 两处文案微修
① js/state.js：文案微修（'警报告警音'、去多余空格）
② smoke-test.js：烽火页用例改"拨时钟"；第 53 节三处 per-city 写法改时钟驱动；新增 §92
③ 工具：shot_v89109_def.js / shot_v89107_beacon.js 改"拨到 9:01 / 提前 3 时"
④ probe_v89111_inv.js：标注修正（补算从第 2 天跳到第 6 天 = 4 场，不是 3 场）
跑法：python .workbuddy/tools/patch/patch_v89111_tests.py
"""
import io, os, shutil, subprocess

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')
NODE = r'C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-3/node.exe'

files = ['js/state.js', 'smoke-test.js',
         '.workbuddy/tools/show/shot_v89109_def.js', '.workbuddy/tools/show/shot_v89107_beacon.js',
         '.workbuddy/tools/probe/probe_v89111_inv.js']
orig = {}
for f in files:
    p = os.path.join(R, f)
    orig[f] = io.open(p, encoding='utf-8').read()
    shutil.copy2(p, os.path.join(BK, os.path.basename(f).replace('.js', '.v89111pre.js')))
print('[备份] 5 个文件 → .workbuddy/backup/*.v89111pre.js')

new = dict(orig)
def rep(f, a, b, n=1):
    s = new[f]
    assert a in s, '未命中[' + f + ']：' + a[:90].replace('\n', '⏎')
    assert s.count(a) == n, '命中数不符[' + f + '] 期望%d 实际%d' % (n, s.count(a))
    new[f] = s.replace(a, b, n)

# ① 文案微修
rep('js/state.js', """        if (GAME.sfx) GAME.sfx('alarm');     /* v89.93（E4）：警报告告警音 */""",
    """        if (GAME.sfx) GAME.sfx('alarm');     /* v89.93（E4）：烽火警讯音 */""")
rep('js/state.js', """        GAME.log.beacon('🔥 烽火：' + GAME.invasionIntelTextOf(tgt, nDay) +
          ' 将于' + (nDay === day ? '今日' : '明日') + ' ' +""",
    """        GAME.log.beacon('🔥 烽火：' + GAME.invasionIntelTextOf(tgt, nDay) +
          '将于' + (nDay === day ? '今日' : '明日') + ' ' +""")
rep('.workbuddy/tools/probe/probe_v89111_inv.js',
    """p('跨 3 天 fired=' + fBulk + '（应=3）· 烽火消息 +' + (nMsg() - nb) + '（3 场结算；无历史补报）');""",
    """p('从第 2 天跳到第 6 天 fired=' + fBulk + '（应=4：第 3~6 天各一场）· 烽火消息 +'
  + (nMsg() - nb) + '（4 场结算；无历史补报）');""")

# ② smoke —— 烽火页用例（拨时钟）
S = 'smoke-test.js'
rep(S, """      var st9 = G.newGame({ name: '烽火链', cityName: '许都' });
      if (!st9.map.grid) G.map.generate();
      st9.cities.push(G.makeCity({ id: 'fv2', name: '二城', x: 265, y: 215 }));
      G.invasionTick(0);
      var c9 = G.currentCity();
      if (!c9 || G.invasionDueAt(c9) <= 0) return false;   /* 排期没生效 = 测不了 = 判红 */
      /* 拨进预警窗 → 页面应显示「警报中」，棋盘上的烽火台格应挂 .alarm */
      var _w = G.invasionWarnSec(c9);
      c9.inv.warned = false;
      c9.inv.nextAt = ((G.state.world && G.state.world.elapsed) || 0) + _w.warnSec - 3600;
      var al = G.invasionAlertOf(c9);""",
"""      var st9 = G.newGame({ name: '烽火链', cityName: '许都' });
      if (!st9.map.grid) G.map.generate();
      st9.cities.push(G.makeCity({ id: 'fv2', name: '二城', x: 265, y: 215 }));
      /* v89.111：来袭改"每日 9 时一场"——把时钟拨到当日来犯时刻前 3 时（进窗）再 tick */
      st9.world = st9.world || {};
      st9.world.elapsed = G.invasionDueOfDay(G.invasionDayOf(st9.world.elapsed || 0)) - 3 * 3600;
      G.invasionTick(0);
      var c9 = G.currentCity();
      if (!c9 || G.invasionDueAt(c9) <= 0) return false;   /* 排期没生效 = 测不了 = 判红 */
      var al = G.invasionAlertOf(c9);""")

# ② smoke —— 第 53 节：排期 / 到点触发 / 开关 / 城数 四处
rep(S, """    check('首次推进后给出排期（invasionDueAt > 0）',
      (function () { G.invasionTick(0); return G.invasionDueAt(c) > 0; })());""",
"""    check('首次推进后给出排期（invasionDueAt = 下一个来犯时刻 · 目标=轮转城）', (function () {
      G.invasionTick(0);
      var due = G.invasionDueAt(c);
      return due > 0 && due === G.invasionDueOfDay(G.invasionDayOf(due))
        && (due - ((st.world && st.world.elapsed) || 0)) <= 86400;
    })());""")

rep(S, """    /* ---- 到点必触发 + 不丢城 ---- */
    var cityCount = st.cities.length;
    var now = st.world.elapsed || 0;
    c.inv.nextAt = now - 1;
    var fired = G.invasionTick(0);
    check('时间轮到点必触发（返回触发次数 ≥1）', fired >= 1, 'fired=' + fired);""",
"""    /* ---- 到点必触发（v89.111：拨到当天 9:01，结算当天那一场）+ 不丢城 ---- */
    var cityCount = st.cities.length;
    var now = st.world.elapsed || 0;
    st.world.elapsed = G.invasionDueOfDay(G.invasionDayOf(now)) + 60;   /* 当天 9:01 */
    var fired = G.invasionTick(1);
    check('每日 9 时到点必触发（当天一场）', fired === 1, 'fired=' + fired);
    check('同日再推进不重复结算（一天只有一场）', G.invasionTick(0) === 0);""")

rep(S, """    /* ---- 边界：开关 ---- */
    st.settings.invasion = false;
    c.inv.nextAt = (st.world.elapsed || 0) - 1;
    check('总开关关掉后永不触发', G.invasionTick(0) === 0);""",
"""    /* ---- 边界：开关 ---- */
    st.settings.invasion = false;
    st.world.elapsed += 86400 + 3600;    /* 再跨一天：开着闸必打，关着闸不许打 */
    check('总开关关掉后永不触发', G.invasionTick(0) === 0);""")

rep(S, """    check('城数不足解锁门槛时 invasionDueAt 返回 0', G.invasionDueAt(c) === 0);
    c.inv.nextAt = (st.world.elapsed || 0) - 1;
    check('城数不足解锁门槛时 invasionTick 不触发', G.invasionTick(0) === 0);""",
"""    check('城数不足解锁门槛时 invasionDueAt 返回 0', G.invasionDueAt(c) === 0);
    check('城数不足解锁门槛时 invasionTick 不触发', G.invasionTick(0) === 0);""")

# ② smoke —— 新增 §92（插在第 53 节之前）
SEC92 = r"""  /* ============================================================
   * 92. v89.111（老板）：**来袭固定每日 9 时一场**（目标轮转 · 提前 4 时只报一次）
   * ------------------------------------------------------------
   * 老板令：「自动攻城固定每日9点即可，提前4h提醒一次，无需频繁报告来袭预警」
   *        「其他势力攻打，烽火警讯显示其军队来袭剩余时间」。
   * 本段钉住六条：
   *   ① 结构：attackHour=9 · warnHours=4；旧口径（baseDays/minDays/tightenPerCity/
   *      beaconBonusHours/warnBeaconMax/invasionIntervalSec/city.inv）全部退役；
   *   ② 行为：5:30 进窗报**一条**（含 势力+剩余时间+今日9时）· 8:00 不重复；
   *      9:01 结算**一场**（目标=轮转城）· 10:00 不重复；次日轮转到下一城；
   *   ③ 一致：预警报的势力 == 结算打的势力（同一出口 invasionSrcOf）；
   *   ④ 离线：跨 4 天一次补算 4 场，且不为历史场次补报预警；
   *   ⑤ 情报：烽火台 Lv0 只报势力 → Lv2 加战力与兵种明细；
   *   ⑥ 烽火页：含「来犯」「剩余」「每日 9 时」。
   * ============================================================ */
  console.log('\n===== 92. v89.111 来袭：每日 9 时一场（轮转 · 单次预警 · 剩余时间） =====');
  (function () {
    var bak92 = G.state;
    try {
      var st92 = G.newGame({ name: '烽火92', cityName: '许都', mapSeed: 20260923 });
      if (!st92.map.grid) G.map.generate();
      G.state = st92;
      st92.world = st92.world || {};
      st92.cities.push(G.makeCity({ id: 'v92b', name: '二城', x: 265, y: 215 }));
      st92.cities.push(G.makeCity({ id: 'v92c', name: '三城', x: 266, y: 216 }));
      st92.cities.forEach(function (cc) { cc.army = { yibing: 8000 }; });
      function setT92(day, h, m) { st92.world.elapsed = day * 86400 + h * 3600 + (m || 0) * 60; }
      function nMsg92() { return (G.msgsOf('beacon') || []).length; }
      function last92() { var m = G.msgsOf('beacon') || []; return m.length ? m[0].msg : ''; }

      check('① 结构：每日 9 时 / 提前 4 时；旧口径全退役', (function () {
        return DATA.INVASION.attackHour === 9 && DATA.INVASION.warnHours === 4
          && DATA.INVASION.baseDays === undefined && DATA.INVASION.minDays === undefined
          && DATA.INVASION.tightenPerCity === undefined && DATA.INVASION.beaconBonusHours === undefined
          && DATA.INVASION.warnBeaconMax === undefined
          && typeof G.invasionIntervalSec !== 'function';
      })());

      setT92(0, 5, 30);
      var n0 = nMsg92();
      G.invasionTick(0);
      var n1 = nMsg92(), w1 = last92();
      setT92(0, 8, 0);
      G.invasionTick(0);
      var n2 = nMsg92();
      var tgt0 = G.invasionTargetOfDay(0);
      check('②-1 5:30 进窗报一条（含 势力 + 剩余时间 + 今日 9 时）',
        n1 - n0 === 1 && w1.indexOf('今日 9 时') >= 0 && w1.indexOf('剩余') >= 0
        && w1.indexOf(G.invasionSrcOf(tgt0, 0)) >= 0, w1.slice(0, 70));
      check('②-2 同一天 8:00 不重复报（去"频繁报告"）', n2 === n1);
      setT92(0, 9, 1);
      var f1 = G.invasionTick(1);
      setT92(0, 10, 0);
      var f2 = G.invasionTick(0);
      check('②-3 9:01 结算一场（目标=轮转首城）· 10:00 不再结算',
        f1 === 1 && f2 === 0 && tgt0 === st92.cities[0]);
      setT92(1, 5, 30);
      G.invasionTick(0);
      var w2 = last92();
      check('②-4 次日轮转到下一城（预警点名 二城）',
        w2.indexOf('二城') >= 0 && G.invasionTargetOfDay(1) === st92.cities[1], w2.slice(0, 60));

      setT92(1, 9, 1);
      G.invasionTick(1);
      var r2 = last92();
      var src2 = G.invasionSrcOf(st92.cities[1], 1);
      check('③ 预警报的势力 == 结算打的势力（唯一出口 invasionSrcOf）',
        w2.indexOf(src2) >= 0 && r2.indexOf(src2) >= 0);

      var nb = nMsg92();
      setT92(5, 9, 1);
      var fB = G.invasionTick(0);
      check('④ 离线跨 4 天补算 4 场（不重不漏）', fB === 4, 'fired=' + fB);
      check('④-2 补算不为历史场次补报预警（只多出结算消息）',
        (nMsg92() - nb) === fB, '新增 ' + (nMsg92() - nb) + ' 条');

      var t92 = G.invasionTargetOfDay(7);
      var t0txt = G.invasionIntelTextOf(t92, 7);
      var cell92 = null;
      (t92.cells || []).forEach(function (x, i) { if (!x.build && !x.official && cell92 == null) cell92 = i; });
      if (cell92 != null) t92.cells[cell92].build = { id: 'fenghuotai', lvl: 2 };
      var t2txt = G.invasionIntelTextOf(t92, 7);
      check('⑤ 烽火台情报：Lv0 只报势力 → Lv2 加战力与兵种明细',
        t0txt.indexOf('战力') < 0 && t2txt.indexOf('战力') >= 0 && t2txt.indexOf('×') >= 0,
        t2txt.slice(0, 60));

      var pg92 = G.ui.marchBeaconHTML();
      check('⑥ 烽火页显示 来犯势力 / 下次来袭（剩余时间）/ 每日 9 时',
        pg92.indexOf('来犯') >= 0 && pg92.indexOf('剩余') >= 0 && pg92.indexOf('每日 9 时') >= 0);
    } finally { G.state = bak92; }
  })();

"""
anchor = r"""  console.log('  --- 第 53 节：定期来袭（第 2 期 · 防守） ---');"""
assert anchor in new[S], 'smoke 插入锚点未命中'
new[S] = new[S].replace(anchor, SEC92 + anchor, 1)

# ③ 工具改"拨时钟"
rep('.workbuddy/tools/show/shot_v89109_def.js', """    /* 真触发一次来袭（走 invasionTick 的结算分支 → 真打 + 写战报） */
    c.inv = { nextAt: 0, warned: false };
    var fired = G.invasionTick(1);""",
"""    /* 真触发一次来袭（v89.111：拨到当日 9:01 → 结算当天那一场并写战报） */
    st.world = st.world || {};
    st.world.elapsed = G.invasionDueOfDay(G.invasionDayOf(st.world.elapsed || 0)) + 60;
    var fired = G.invasionTick(1);""")

rep('.workbuddy/tools/show/shot_v89107_beacon.js', """    /* 拨进预警窗 → 真走 invasionTick 的报信分支（会落 beacon 消息 + sfx） */
    if (!c.inv) c.inv = { nextAt: 0, warned: false };
    var wp = G.invasionWarnSec(c);
    c.inv.warned = false;
    c.inv.nextAt = ((st.world && st.world.elapsed) || 0) + wp.warnSec - 3600;
    G.invasionTick(0);""",
"""    /* 拨进预警窗 → 真走 invasionTick 的报信分支（v89.111：拨到当日来犯时刻前 3 时） */
    st.world = st.world || {};
    st.world.elapsed = G.invasionDueOfDay(G.invasionDayOf(st.world.elapsed || 0)) - 3 * 3600;
    var wp = G.invasionWarnSec(c);
    G.invasionTick(0);""")

# 落盘 + 自检
for f in files:
    io.open(os.path.join(R, f), 'w', encoding='utf-8', newline='').write(new[f])
print('[落盘] 5 个文件已更新')
ok = True
for f in files:
    r = subprocess.run([NODE, '--check', os.path.join(R, f)], capture_output=True, text=True)
    if r.returncode != 0:
        ok = False
        print('[语法失败] ' + f + '\n' + r.stderr[:500])
print('[自检] node --check：' + ('全部通过' if ok else '有失败'))
print('[完成] ' + ('✔' if ok else '✘'))
