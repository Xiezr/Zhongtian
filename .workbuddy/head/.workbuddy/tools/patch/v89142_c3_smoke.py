# v89.142 C3：smoke-test.js —— 收编断言升级（§98 两条 + §99 两条）
# 跑法：python .workbuddy/tools/patch/v89142_c3_smoke.py
import io
P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89142/smoke-test.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

# ---------------- §98 ① 唯一出口 ----------------
rep("""    check('① 俘虏人口唯一出口：captivePopOf = Σ(兵种数量 × 该兵种 pop)', (function () {
      var camp = { yibing: 10, gongjian: 5, nanjiangxiangbing: 2, unknown: 3 };
      var want = 10 * (D98.TROOPS.yibing.pop || 1) + 5 * (D98.TROOPS.gongjian.pop || 1)
        + 2 * (D98.TROOPS.nanjiangxiangbing.pop || 1) + 3 * 1;
      return G.captivePopOf(camp) === want && G.captivePopOf({}) === 0 && want > 17;
    })(), 'want=' + (function () {
      var c = { yibing: 10, gongjian: 5, nanjiangxiangbing: 2, unknown: 3 };
      return G.captivePopOf(c);
    })());""",
"""    /* v89.142（老板 5）：「收编**直接转换为本城相应兵种**，增加相应数量。收编应支出黄金。
       按照相应兵种造价（所有资源换算黄金）的 50% 计算」——
       旧出口 captivePopOf（Σ pop）随"收编加人口"整条退役；新口径三件套见 battle.js。 */
    check('① 收编口径唯一出口：troopGoldCostOf（市场平价折金）+ conscriptPlanOf（×50% 一次取整）', (function () {
      var camp = { yibing: 10, gongjian: 5, nanjiangxiangbing: 2, unknown: 3 };
      var per = D98.MARKET_SELL.per, ra = D98.MARKET_SELL.ratio;
      var manual = function (tid) {                    /* 手算：Σ 资源量 ÷ per × ratio */
        var co = D98.TROOPS[tid].cost || {}, g = 0;
        for (var k in co) g += co[k] / per * (ra[k] || 0);
        return g;
      };
      var plan = G.conscriptPlanOf(camp);
      var wantBy = { yibing: 10, gongjian: 5, nanjiangxiangbing: 2, minfu: 3 };  /* unknown → 民夫 */
      var okBy = Object.keys(wantBy).every(function (k) { return plan.byType[k] === wantBy[k]; })
        && Object.keys(plan.byType).length === Object.keys(wantBy).length;
      var wantCost = Math.round((10 * manual('yibing') + 5 * manual('gongjian')
        + 2 * manual('nanjiangxiangbing') + 3 * manual('minfu')) * D98.CAPTIVE.conscriptPct);
      return plan.men === 20 && okBy && plan.cost === wantCost && wantCost > 0
        && G.conscriptPlanOf({}).men === 0 && G.conscriptPlanOf({}).cost === 0
        && G.troopGoldCostOf('nope') === 0
        && G.troopGoldCostOf('changqiang') === 450 / per * 1 + 500 / per * 2 + 100 / per * 4;
    })(), 'cost=' + G.conscriptPlanOf({ yibing: 10, gongjian: 5, nanjiangxiangbing: 2, unknown: 3 }).cost);""",
 's98-唯一出口')

# ---------------- §98 ② 收编入军执行 ----------------
rep("""    check('① 收编那一刻才加人口：增量与 captivePopOf 同源（执行 + 按钮文案两处）', (function () {
      var st = G.newGame({ name: '俘', cityName: '许都' });
      G.state = st;
      try {
        st.captives = { gongjian: 6, changqiang: 3 };     /* pop 2 与 1 → 6×2+3 = 15 */
        var want = G.captivePopOf();
        var c0 = G.currentCity();
        var pop0 = G.res(c0).pop;
        var h0 = G.ui.campCard('captive');
        var r = G.doConscriptCaptives(c0.id);
        return want === 15 && r.ok && r.pop === 15
          && Math.round(G.res(c0).pop - pop0) === 15
          && h0.indexOf('人口 +' + U.numText(15, 0)) >= 0
          && G.captivesTotalOf() === 0;
      } finally { G.state = bak98; }
    })());""",
"""    check('① 收编入军：逐兵种入军 + 支金（造价 50%）· 人口**不动** · 界面与执行同源', (function () {
      var st = G.newGame({ name: '俘', cityName: '许都' });
      G.state = st;
      try {
        st.captives = { gongjian: 6, changqiang: 3 };
        var c0 = G.currentCity();
        var plan = G.conscriptPlanOf();
        st.res.gold = plan.cost + 777;                    /* 备足金，验证"扣得对" */
        var gold0 = st.res.gold, pop0 = G.res(c0).pop;
        var a0g = (c0.army.gongjian || 0), a0q = (c0.army.changqiang || 0);
        var h0 = G.ui.campCard('captive');
        var r = G.doConscriptCaptives(c0.id);
        var goldAfter = st.res.gold;
        /* 金不足也要**整单拒绝**（不动兵、不扣金、俘虏还在） */
        st.captives = { gongjian: 6 }; st.res.gold = 1;
        var rDeny = G.doConscriptCaptives(c0.id);
        return plan.men === 9 && r.ok && r.cost === plan.cost
          && (gold0 - goldAfter) === plan.cost
          && (c0.army.gongjian || 0) - a0g === 6
          && (c0.army.changqiang || 0) - a0q === 3
          && G.res(c0).pop === pop0                       /* 人口不动（v89.142 起收编不加人口） */
          && h0.indexOf('收编入军') >= 0
          && h0.indexOf('费 ' + U.numText(plan.cost, 0) + ' 金') >= 0
          && rDeny.ok === false && st.res.gold === 1 && G.captivesTotalOf() === 6;
      } finally { G.state = bak98; }
    })());""",
 's98-收编执行')

# ---------------- §99 D ① 口径 ----------------
rep("""      /* 收编为民：一次加人口（与旧口径同一笔账） */
      var cons = GAME.doConscriptCaptives(c99.id);
      ok = ok && cons.ok && Rr.pop === 1000 + camp && GAME.captivesTotalOf() === 0;
      S99.captives = bkCap;
      return ok;""",
"""      /* v89.142（老板 5）：收编 = **逐兵种转入本城军队** + 支金（造价 50%）—— 人口不动 */
      var planC = GAME.conscriptPlanOf(S99.captives);
      Rr.gold = Math.max(Rr.gold || 0, planC.cost + 5000);
      var gold0C = Rr.gold;
      var aBC = JSON.parse(JSON.stringify(c99.army || {}));
      var cons = GAME.doConscriptCaptives(c99.id);
      var addC = 0, addOk = true;
      for (var _tkC in (cons.byType || {})) {
        addC += cons.byType[_tkC];
        addOk = addOk && ((c99.army[_tkC] || 0) - (aBC[_tkC] || 0)) === cons.byType[_tkC];
      }
      ok = ok && cons.ok && addC === camp && addOk
        && (gold0C - Rr.gold) === planC.cost && planC.cost > 0
        && Rr.pop === 1000                                /* 人口不动 */
        && GAME.captivesTotalOf() === 0;
      S99.captives = bkCap;
      return ok;""",
 's99-D①')

# ---------------- §99 D ② 实战集成 ----------------
rep("""      var campN = GAME.captivesTotalOf();
      var byN = 0;
      for (var _bk in ((cap && cap.byType) || {})) byN += cap.byType[_bk];
      var wantPop = GAME.captivePopOf();          /* 收编前算：= Σ(兵种数量 × pop) */
      var cons = GAME.doConscriptCaptives(c99.id);
      window.__cap99 = '俘获 ' + (cap ? cap.gain : 0) + ' 人（拆分 ' + byN + '）→ 营 ' + campN
        + ' → 折算人口 ' + wantPop + ' → 收编后人口 ' + Math.round(Rr.pop);
      return !!cap && cap.gain > 0 && byN === cap.gain && campN === cap.gain
        && cons.ok && cons.pop === wantPop && Rr.pop === 1000 + wantPop
        && (S99.reports || [])[0] && S99.reports[0].body.indexOf('俘获') >= 0
        && S99.reports[0].body.indexOf('俘虏营') >= 0;""",
"""      var campN = GAME.captivesTotalOf();
      var byN = 0;
      for (var _bk in ((cap && cap.byType) || {})) byN += cap.byType[_bk];
      /* v89.142（老板 5）：收编 = 转入本城相应兵种 + 支金（50% 兵种造价）；人口不动 */
      var planD = GAME.conscriptPlanOf(S99.captives);
      Rr.gold = Math.max(Rr.gold || 0, planD.cost + 5000);
      var goldBD = Rr.gold;
      var menBD = G.battle.marchMenOf(c99.army);
      var cons = GAME.doConscriptCaptives(c99.id);
      window.__cap99 = '俘获 ' + (cap ? cap.gain : 0) + ' 人（拆分 ' + byN + '）→ 营 ' + campN
        + ' → 收编入军 ' + cons.n + '（费 ' + cons.cost + '）→ 军 +' +
        (G.battle.marchMenOf(c99.army) - menBD) + ' · 人口 ' + Math.round(Rr.pop);
      return !!cap && cap.gain > 0 && byN === cap.gain && campN === cap.gain
        && cons.ok && cons.n === cap.gain
        && (G.battle.marchMenOf(c99.army) - menBD) === cap.gain     /* 兵真的进来了 */
        && (goldBD - Rr.gold) === cons.cost && cons.cost > 0        /* 金真的扣了 */
        && Rr.pop === 1000                                          /* 人口不动 */
        && (S99.reports || [])[0] && S99.reports[0].body.indexOf('俘获') >= 0
        && S99.reports[0].body.indexOf('俘虏营') >= 0;""",
 's99-D②')

# 自检 + 落盘
assert 'G.captivePopOf' not in s and 'GAME.captivePopOf(' not in s, '旧出口被调用'
assert s.count('conscriptPlanOf') >= 5
assert '\r\n' not in s
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}'))
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE smoke-test.js  len ' + str(len(bak)) + ' -> ' + str(len(s)))
