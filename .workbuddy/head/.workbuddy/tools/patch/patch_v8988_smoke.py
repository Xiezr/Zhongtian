# -*- coding: utf-8 -*-
"""v89.88：smoke-test.js 更新 + 新增 §88 断言块。

P1 §87 战斗块钉定天气（修复"雨天假红"的既有脆弱点）
P2 §⑦ 等级标签 1~8 → 1~10
P3 §⑦ 等级随天变化断言改读真实出口（原为自证式公式）
P4 §⑦ 守军单调 1~10
P5 §⑦ 攻取据点：挑低级据点 + 钉天气 + 关观战（走真实胜负路径）
P6 新增 §88 块（据点改造 + 悬浮）
"""
import io

P = r'E:\Deepseekdb\smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    assert s.count(old) == 1, (tag, s.count(old))
    s = s.replace(old, new, 1)


# ============================================================
# P1：§87 战斗块钉定天气
# ============================================================
rep("""    var oldState = G.state;
    var S87 = G.newGame({ name: 'v87', cityName: '许都' });
    if (!S87.map.grid) G.map.generate();
    G.state = S87;
    var c87 = S87.cities[0];""",
"""    var oldState = G.state;
    var S87 = G.newGame({ name: 'v87', cityName: '许都' });
    if (!S87.map.grid) G.map.generate();
    G.state = S87;
    /* v89.88：**钉定天气为「晴」** —— 战斗引擎读天气（雨：弓兵射程 −20%、行军 −20%），
       本块的战斗断言（溅射/反击）会随雨天改变首回合序列而**假红**（实测复发）。
       单元断言必须与天气无关；S87 是本块专用临时局，直接钉定不还原。
       （项目既有惯例：需要确定战斗结果的用例都先置 clear —— 见 §⑤/§⑦ 各自写法。） */
    S87.world.weather = 'clear';
    var c87 = S87.cities[0];""", 'P1')

# ============================================================
# P2：等级标签
# ============================================================
rep("""  check('等级落在 1~8', Object.keys(lvSet).every(function (k) { return +k >= DATA.FORT.levelMin && +k <= DATA.FORT.levelMax; }),
    Object.keys(lvSet).sort().join(','));""",
"""  check('等级落在 1~10', Object.keys(lvSet).every(function (k) { return +k >= DATA.FORT.levelMin && +k <= DATA.FORT.levelMax; }),
    Object.keys(lvSet).sort().join(','));""", 'P2')

# ============================================================
# P3：等级随天变化（改读真实出口）
# ============================================================
rep("""  check('等级随「天」变化（每日盐不同）', (function () {
    var day = G.questDayIndex ? G.questDayIndex() : 0;
    var diff = 0, tested = 0;
    for (var x2 = 0; x2 < 80 && tested < 12; x2++) {
      for (var y2 = 0; y2 < 80 && tested < 12; y2++) {
        if (!G.map.hasFort(x2, y2)) continue;
        tested++;
        var l1 = 1 + Math.floor(G.map._fortHash(x2, y2, 101 + day) * 8);
        var l2 = 1 + Math.floor(G.map._fortHash(x2, y2, 101 + day + 1) * 8);
        if (l1 !== l2) diff++;
      }
    }
    return tested >= 6 && diff > 0;
  })(), '次日等级确有变化');""",
"""  check('等级随「天」变化（每日配额重掷 · 位置不变）', (function () {
    /* v89.88：等级不再"逐格掷点"，而是**全图配额分配**（8/9/10 各 30%）。
       判据改读真实出口 `_fortLevelAt(day, x, y)` —— 原先直接算哈希公式，
       口径一变它就变成"测一条不存在的公式"（自证式断言）。 */
    var day = G.questDayIndex ? G.questDayIndex() : 0;
    var diff = 0, tested = 0;
    for (var x2 = 0; x2 < 80 && tested < 12; x2++) {
      for (var y2 = 0; y2 < 80 && tested < 12; y2++) {
        if (!G.map.hasFort(x2, y2)) continue;
        tested++;
        var l1 = G.map._fortLevelAt(day, x2, y2);
        var l2 = G.map._fortLevelAt(day + 1, x2, y2);
        if (l1 !== l2) diff++;
      }
    }
    return tested >= 6 && diff > 0;
  })(), '次日等级确有变化');""", 'P3')

# ============================================================
# P4：守军单调 1~10
# ============================================================
rep("""  check('守军随等级递增', (function () {
    function sum(lv) { var g = G.map.fortGarrison(lv), t = 0; for (var k in g) t += g[k]; return t; }
    for (var lv = 2; lv <= 8; lv++) if (sum(lv) <= sum(lv - 1)) return false;
    return true;
  })(), 'Lv1 ' + (function () { var g = G.map.fortGarrison(1), t = 0; for (var k in g) t += g[k]; return t; })()
    + ' → Lv8 ' + (function () { var g = G.map.fortGarrison(8), t = 0; for (var k in g) t += g[k]; return t; })());""",
"""  check('守军随等级递增（1~10）', (function () {
    function sum(lv) { var g = G.map.fortGarrison(lv), t = 0; for (var k in g) t += g[k]; return t; }
    for (var lv = 2; lv <= 10; lv++) if (sum(lv) <= sum(lv - 1)) return false;
    return true;
  })(), 'Lv1 ' + (function () { var g = G.map.fortGarrison(1), t = 0; for (var k in g) t += g[k]; return t; })()
    + ' → Lv10 ' + (function () { var g = G.map.fortGarrison(10), t = 0; for (var k in g) t += g[k]; return t; })());""", 'P4')

# ============================================================
# P5a：找低级据点作攻击目标
# ============================================================
rep("""  var fTarget = null;
  for (var sx = 30; sx < 120 && !fTarget; sx++) {
    for (var sy = 30; sy < 120 && !fTarget; sy++) if (G.map.hasFort(sx, sy)) fTarget = G.map.fortAt(sx, sy);
  }
  check('找到测试据点', !!fTarget, fTarget && (fTarget.name + ' Lv' + fTarget.level));""",
"""  /* v89.88：据点等级分布上移（8/9/10 占 90%）、守军 ×10 ——
     攻取用例优先挑一座**低级据点**（≤ Lv4）：固定 4 万弓兵正好覆盖
     "校场容量"闸门与"打得赢"的**正向路径**（守军规模断言见 §88）。 */
  var fAny = null, fLow = null;
  for (var sx = 30; sx < 120; sx++) {
    for (var sy = 30; sy < 120; sy++) {
      if (!G.map.hasFort(sx, sy)) continue;
      var fHere = G.map.fortAt(sx, sy);
      if (fHere && !fAny) fAny = fHere;
      if (fHere && fHere.level <= 4 && !fLow) fLow = fHere;
    }
  }
  var fTarget = fLow || fAny;
  check('找到测试据点', !!fTarget, fTarget && (fTarget.name + ' Lv' + fTarget.level + (fLow ? '（低级靶）' : '（兜底靶）')));""", 'P5a')

# ============================================================
# P5b：攻取据点（钉天气 + 关观战）
# ============================================================
rep("""  var gF = G.makeGeneral('攻坚甲', 60, 'idle', cS.id, false);
  gF.stamina = 100; gF.energy = 100;
  gF.tong = 400; gF.yw = 300; gF.zm = 300;
  gS.generals.push(gF);
  cS.army.gongjian = 40000;
  var rep0F = gS.rep || 0;
  var rFort = G.battle.expedition({ kind: 'fort', x: fTarget.x, y: fTarget.y }, 'occupy', { gongjian: 40000 }, gF.id);""",
"""  var gF = G.makeGeneral('攻坚甲', 60, 'idle', cS.id, false);
  gF.stamina = 100; gF.energy = 100;
  gF.tong = 400; gF.yw = 300; gF.zm = 300;
  gS.generals.push(gF);
  cS.army.gongjian = 40000;
  /* v89.88：钉天气（晴）+ 关观战挂起 —— 让这条用例走**真实结算**路径
     （观战默认开启时 expedition 只挂起、不产生战果，正向断言此前从未真正跑过） */
  var weF = gS.world.weather; gS.world.weather = 'clear';
  var bwF = gS.settings.battleWatch; gS.settings.battleWatch = false;
  var rep0F = gS.rep || 0;
  var rFort = G.battle.expedition({ kind: 'fort', x: fTarget.x, y: fTarget.y }, 'occupy', { gongjian: 40000 }, gF.id);
  gS.settings.battleWatch = bwF;
  gS.world.weather = weF;""", 'P5b')

# ============================================================
# P6：§88 新断言块（插在结果输出之前）
# ============================================================
anchor = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
assert s.count(anchor) == 1, ('P6 anchor', s.count(anchor))

block = """  /* ============================================================
   * 88. v89.88（老板需求 1~4）：野外城池改造（等级/守军/满配）+ 地图悬浮
   * ------------------------------------------------------------
   * 独立建局（结尾恢复旧 state）。
   * ============================================================ */
  console.log('\\n--- 88. v89.88 野外城池改造 / 地图悬浮 ---');
  (function () {
    var oldState = G.state;
    var S88 = G.newGame({ name: 'v88', cityName: '许都' });
    if (!S88.map.grid) G.map.generate();
    G.state = S88;
    var mS88 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
    var uS88 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
    var bS88 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'battle.js'), 'utf8');

    /* ---- ① 等级分布（构造性配额） ---- */
    check('v89.88（据点）：上限 10 · 分布配置（8/9/10 各 30% · 低档 10%）', (function () {
      var D = DATA.FORT;
      return D.levelMin === 1 && D.levelMax === 10
        && !!D.levelDist && D.levelDist.high.join(',') === '8,9,10' && D.levelDist.highPct === 0.30;
    })());

    var c88 = null;
    check('v89.88（据点）：全图配额精确成立（Lv8/9/10 各 30.0% · 1~7 合计 10%）', (function () {
      var cand = G.map._fortCandidates();
      if (!cand.length) return false;
      var day = G.questDayIndex ? G.questDayIndex() : 0;
      var tbl = G.map._fortLevelTable(day);
      var cnt = {}, n = cand.length;
      Object.keys(tbl).forEach(function (k) { cnt[tbl[k]] = (cnt[tbl[k]] || 0) + 1; });
      var ok = Math.abs(cnt[8] / n - 0.30) <= 0.002 && Math.abs(cnt[9] / n - 0.30) <= 0.002
        && Math.abs(cnt[10] / n - 0.30) <= 0.002;
      var low = 0, lows = [];
      for (var lv = 1; lv <= 7; lv++) { low += (cnt[lv] || 0); lows.push(cnt[lv] || 0); }
      ok = ok && Math.abs(low / n - 0.10) <= 0.002
        && (Math.max.apply(null, lows) - Math.min.apply(null, lows)) <= 1;
      c88 = { n: n, cnt: cnt };
      return ok;
    })(), c88 ? ('共 ' + c88.n + ' 座 · Lv8/9/10 = ' + c88.cnt[8] + '/' + c88.cnt[9] + '/' + c88.cnt[10]) : '无候选');

    check('v89.88（据点）：同日两次构建逐点一致（确定性）', (function () {
      var day = G.questDayIndex ? G.questDayIndex() : 0;
      var t1 = G.map._fortLevelTable(day);
      var bak = G.map._fortLv;
      G.map._fortLv = null;                       /* 强制重建 */
      var t2 = G.map._fortLevelTable(day);
      G.map._fortLv = bak;
      var k2 = Object.keys(t1), same = true;
      for (var i = 0; i < k2.length && i < 2000; i++) { if (t1[k2[i]] !== t2[k2[i]]) { same = false; break; } }
      return same && k2.length > 1000;
    })());

    check('v89.88（据点）：逐日重掷 —— 次日分布同样成立（配额不靠运气）', (function () {
      var day = G.questDayIndex ? G.questDayIndex() : 0;
      var t0 = G.map._fortLevelTable(day), t1 = G.map._fortLevelTable(day + 1);
      var ks = Object.keys(t0), diff = 0, tot = 0;
      for (var i = 0; i < ks.length; i += 7) { tot++; if (t0[ks[i]] !== t1[ks[i]]) diff++; }
      var cnt = {}, n = 0;
      Object.keys(t1).forEach(function (k) { cnt[t1[k]] = (cnt[t1[k]] || 0) + 1; n++; });
      var distOk = Math.abs(cnt[8] / n - 0.30) <= 0.002 && Math.abs(cnt[10] / n - 0.30) <= 0.002;
      return tot > 200 && diff / tot > 0.4 && distOk;
    })());

    check('v89.88（据点）：_fortHash 内联版与 U.rng 逐位等价（防两处实现漂移）', (function () {
      var bad = 0, tested = 0;
      for (var x = 3; x < 40; x += 2) for (var y = 3; y < 40; y += 2) {
        var h = (x * 73856093 ^ y * 19349663 ^ ((S88.map.seed || 1) * 2654435761) ^ (7 * 83492791)) >>> 0;
        tested++;
        if (U.rng(h)() !== G.map._fortHash(x, y, 7)) bad++;
      }
      return tested > 300 && bad === 0;
    })());

    /* ---- ② 守军 ×10 且恒超同级野地 ---- */
    check('v89.88（据点）：守军 ×10（Lv1=500）且**每一级**都 ≥ 同级野地上限', (function () {
      function sum(lv) { var g = G.map.fortGarrison(lv), t = 0; for (var k in g) t += g[k]; return t; }
      if (sum(1) !== 500) return false;           /* 50 × 10 */
      for (var lv = 1; lv <= 10; lv++) {
        var wm = 0;
        (DATA.WILD_DEFENSE[lv] || []).forEach(function (e) { wm += e.max; });
        if (!(sum(lv) > wm)) return false;
        if (lv > 1 && !(sum(lv) > sum(lv - 1))) return false;
      }
      return true;
    })(), 'Lv1 ' + (function () { var g = G.map.fortGarrison(1), t = 0; for (var k in g) t += g[k]; return t; })()
      + ' → Lv10 ' + (function () { var g = G.map.fortGarrison(10), t = 0; for (var k in g) t += g[k]; return t; })());

    /* ---- ③ 满配（建筑/城墙/人口/城防随等级到顶） ---- */
    check('v89.88（据点）：Lv8/9/10 建筑·城墙·人口·城防全到级（满配）', (function () {
      function pf(lv) { return G.fortPlanOf({ x: 1, y: 1, level: lv, name: 'x', kind: 'fort' }); }
      var ok = true;
      [8, 9, 10].forEach(function (lv) {
        var p = pf(lv), cp = G.cityPlanOf(lv);
        if (!(p.level === lv && p.buildLv === lv && p.wallLv === lv)) ok = false;
        if (!cp.cells.every(function (c) { return !c.build || c.build.lvl === lv; })) ok = false;
      });
      return ok && G.fortDefOf({ level: 10 }) === 50 && pf(10).popCap > pf(8).popCap;
    })());

    /* ---- ④ 资源满配（战利品曲线 + 档位次序） ---- */
    check('v89.88（据点）：战利品满配曲线（Lv1→Lv10 ≈15× · 档位次序不破）', (function () {
      var bak = Math.random; Math.random = function () { return 0.5; };
      try {
        function grain(tier, lv) { return G.battle.genLoot({ type: tier, level: lv, x: 1, y: 1 }, 1).grain; }
        var r1 = grain('fort', 1), r10 = grain('fort', 10);
        var curve = r10 / r1 > 12 && r10 / r1 < 18;
        var order = grain('jun', 7) > grain('fort', 3) && grain('capital', 10) > r10;
        return curve && order;
      } finally { Math.random = bak; }
    })());

    check('v89.88（据点）：侦查「掠夺可得」= 实际掠夺基准（cityResMul.raid · 不再虚报 2.4×）', (function () {
      var i = bS88.indexOf("if (t.kind === 'fort' && GAME.battle.genLoot)");
      var seg = bS88.substr(i, 900).replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/\\/\\/[^\\n]*/g, '');
      var srcOk = i >= 0 && seg.indexOf('cityResMul') >= 0 && seg.indexOf('wildResMul') < 0;
      var cands = G.map._fortCandidates();
      if (!cands.length) return false;
      var fx = cands[10] % DATA.MAP_W, fy = (cands[10] / DATA.MAP_W) | 0;
      var tgt = G.battle.resolveTarget({ kind: 'fort', x: fx, y: fy });
      if (!tgt || !tgt.ok) return false;
      var bak = Math.random; Math.random = function () { return 0.5; };
      try {
        var want = G.battle.genLoot(tgt, 0.5);
        var rep88 = G.battle.resReportOf(tgt);
        var byName = {};
        (DATA.RESOURCES || []).forEach(function (m) { byName[m.name] = m.key; });
        var behOk = !!rep88 && rep88.kind === 'loot' && rep88.rows.length >= 4
          && rep88.rows.every(function (r) { return r.v === Math.round(want[byName[r.name]]); });
        return srcOk && behOk;
      } finally { Math.random = bak; }
    })());

    /* ---- ⑤ 地图悬浮（坐标 + 等级） ---- */
    check('v89.88（悬浮）：四类地块浮层齐备（坐标 + 等级 · 走唯一出口）', (function () {
      var c0 = S88.cities[0];
      var npc = (S88.map.cities || [])[0];
      var cands = G.map._fortCandidates();
      var ff = null;
      for (var i = 0; i < cands.length && !ff; i++) {
        var fx = cands[i] % DATA.MAP_W, fy = (cands[i] / DATA.MAP_W) | 0;
        ff = G.map.fortAt(fx, fy);
      }
      var t0 = G.ui.mapTipFor({ kind: 'player', city: c0, x: c0.x, y: c0.y });
      var t1 = npc ? G.ui.mapTipFor({ kind: 'npc', city: npc, x: npc.x, y: npc.y }) : null;
      var t2 = ff ? G.ui.mapTipFor({ kind: 'fort', fort: ff, x: ff.x, y: ff.y }) : null;
      var t3 = G.ui.mapTipFor({ kind: 'land', x: 5, y: 5 });
      var all = [t0, t1, t2, t3];
      var okAll = all.every(function (th) { return !!th && th.indexOf('📍 坐标') >= 0 && /Lv\\d+/.test(th); });
      var okKind = !!t0 && t0.indexOf('城等级') >= 0 && !!t1 && t1.indexOf('城等级') >= 0
        && !!t2 && t2.indexOf('野外城池') >= 0 && !!t3 && t3.indexOf('野地') >= 0;
      /* 与唯一出口对拍 */
      var okLv = t0.indexOf('Lv' + G.cityLvOf(c0)) >= 0
        && t1.indexOf('Lv' + G.cityLvOf(npc)) >= 0
        && t2.indexOf('Lv' + ff.level) >= 0
        && t3.indexOf('Lv' + G.map.wildLevelNow(5, 5)) >= 0;
      return okAll && okKind && okLv;
    })());

    check('v89.88（悬浮）：主循环接线（mapCanvas mousemove · 按格节流 · 移出收起）', (function () {
      return /addEventListener\\('mousemove'/.test(mS88) && /id !== 'mapCanvas'/.test(mS88)
        && /_mapHoverKey/.test(mS88) && /mapTipFor/.test(mS88)
        && /addEventListener\\('mouseout'/.test(mS88) && /ui\\.mapTipFor = function/.test(uS88);
    })());

    G.state = oldState;
  })();

"""

s = s.replace(anchor, block + anchor, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK smoke-test.js 全部补丁')
