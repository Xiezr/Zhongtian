# -*- coding: utf-8 -*-
"""v89.86 整改 · P-23 兵力悬殊二次确认 + P-19 募兵上限归因 + P-05 人口占用说明
   · P-23：战力比 < 0.5 → 首次点击只"上膛"（按钮变红复述战力比），再点才发兵；
           战力比唯一出口 ui.expPowerOf（预估行与确认闸共用，防两份逻辑漂移）。
   · P-19：上限 0 时归因（人口不足 / 资源不足）——GAME.trainLimitOf 唯一出口。
   · P-05：募兵面板常驻"每兵占人口 N（可用 X）"。
"""
import io
import os
import sys

UI = r'E:\Deepseekdb\js\ui.js'
DO = r'E:\Deepseekdb\js\domain.js'
MA = r'E:\Deepseekdb\js\main.js'
E2 = r'E:\Deepseekdb\e2e-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


# ============ P-19 · domain：上限归因唯一出口 ============
edit(DO, r"""  GAME.maxTrainCount = function (troopId, cityId, bIdx) {
    var s = GAME.state, t = DATA.TROOPS[troopId];
    if (!s || !t) return 0;
    /* v29（需求 13）：器械与募兵的上限口径相同（人口 + 资源短板），
       bIdx 只是调用方用来定位队列的，不参与上限计算。 */
    var n = 500000;                                  // 与 GAME.train 的单次上限一致
    /* 人口：可用人口 ÷ 每兵占人口 */
    if (t.pop > 0) n = Math.min(n, Math.floor((s.res.pop || 0) / t.pop));
    /* 资源：逐项余量 ÷ 单兵消耗，取最小的那一项（短板决定上限） */
    for (var k in (t.cost || {})) {
      var need = t.cost[k];
      if (need > 0) n = Math.min(n, Math.floor((s.res[k] || 0) / need));
    }
    return Math.max(0, Math.floor(n));
  };""",
     r"""  /* v89.86（整改 P-19）：可募上限的**归因**出口 —— 上限为 0 时要说清是谁卡住：
     reason = 'pop'（人口耗尽）/ 'res'（资源不足，lack 列最短缺的几种）。
     maxTrainCount 收敛为它的 cap 字段（旧口径逐字保留，两处不再各算一遍）。 */
  GAME.trainLimitOf = function (troopId) {
    var s = GAME.state, t = DATA.TROOPS[troopId];
    if (!s || !t) return { cap: 0, popBound: Infinity, resBound: Infinity, reason: '', lack: [] };
    var cap = 500000;                                // 与 GAME.train 的单次上限一致
    /* 人口：可用人口 ÷ 每兵占人口 */
    var popBound = Infinity;
    if (t.pop > 0) popBound = Math.floor((s.res.pop || 0) / t.pop);
    /* 资源：逐项余量 ÷ 单兵消耗，取最小的那一项（短板决定上限） */
    var resBound = Infinity;
    for (var k in (t.cost || {})) {
      var need = t.cost[k];
      if (need > 0) resBound = Math.min(resBound, Math.floor((s.res[k] || 0) / need));
    }
    cap = Math.max(0, Math.floor(Math.min(cap, popBound, resBound)));
    var reason = '', lack = [];
    if (cap <= 0) {
      reason = (popBound <= resBound) ? 'pop' : 'res';
      if (reason === 'res') {
        for (var k2 in (t.cost || {})) {
          if ((t.cost[k2] || 0) > 0 && (s.res[k2] || 0) < t.cost[k2]) lack.push(k2);
        }
      }
    }
    return { cap: cap, popBound: popBound, resBound: resBound, reason: reason, lack: lack };
  };
  GAME.maxTrainCount = function (troopId, cityId, bIdx) {
    /* v29（需求 13）：器械与募兵的上限口径相同（人口 + 资源短板），
       bIdx 只是调用方用来定位队列的，不参与上限计算。 */
    return GAME.trainLimitOf(troopId).cap;
  };""",
     'P-19 · trainLimitOf 唯一出口')

# ============ P-23 · ui：战力比唯一出口 + 上膛/还原 ============
edit(UI, r"""  /* 行军队列预估（出征弹窗内实时显示）
     行军速度由**最慢兵种**决定，所以必须等玩家填完兵力才准；
     未填时按城内现有兵种占位估算，并标注说明。 */
  ui.updateExpMarch = function () {
    var box = $('#exp-march');
    if (!box) return;""",
     r"""  /* ============================================================
   * v89.86（整改 P-23）：兵力悬殊二次确认 —— 战力比的**唯一出口** + 按钮两态
   * ------------------------------------------------------------
   * 实测代价（老板试玩）：0.02:1 出兵 → 200 长枪全灭、敌损 0。
   * 预估行与确认闸必须读同一个战力比 —— 各自算一遍就会"面板报悬殊、确认却没拦住"。
   * ============================================================ */
  /* 战力比：我方 = 各兵种填报量 × troopPower；守方 = 守军 × troopPower × (1 + 城防/defDivisor)。
     口径与 v74 预估行完全一致（原逻辑迁移到此处，两处共用）。 */
  ui.expPowerOf = function () {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var city = GAME.currentCity();
    if (!tp || !city) return null;
    var mine = 0, n = 0;
    Object.keys(city.army || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Number(inp.value) || 0 : 0;
      n += v;
      mine += v * tp(id);
    });
    var res = ui._expRes;
    var def = 0;
    if (res) {
      var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
      var wall = (res.def || 0) / div;
      for (var k in (res.garrison || {})) def += tp(k) * (res.garrison[k] || 0);
      def = Math.round(def * (1 + wall));
    }
    return { mine: Math.round(mine), def: def, n: n, ratio: def > 0 ? mine / def : null };
  };
  /* "上膛"标记：兵力悬殊时第一次点击置 true（只警告不发兵） */
  ui._expForceArmed = false;
  /* 还原确认按钮（正常态）+ 清"上膛" —— 兵力/方式一变就调它 */
  ui.resetExpConfirm = function () {
    ui._expForceArmed = false;
    var btn = document.querySelector('#modal-root [data-action="exp-confirm"]');
    if (!btn) return;
    var cur = GAME.battle.modeOf(ui._expMode || 'occupy');
    btn.className = 'btn gold';
    btn.innerHTML = cur.icon + ' ' + cur.name;
  };

  /* 行军队列预估（出征弹窗内实时显示）
     行军速度由**最慢兵种**决定，所以必须等玩家填完兵力才准；
     未填时按城内现有兵种占位估算，并标注说明。 */
  ui.updateExpMarch = function () {
    var box = $('#exp-march');
    if (!box) return;
    /* v89.86（P-23）：兵力/将领一变，二次确认重新计数并还原按钮（防"上膛"状态残留） */
    if (ui._expForceArmed) ui.resetExpConfirm();""",
     'P-23 · 战力比出口与上膛')

edit(UI, r"""      if (pow73) {
        var res74 = ui._expRes;
        var def74 = 0;
        if (res74 && tp74) {
          var div74 = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
          var wall74 = (res74.def || 0) / div74;
          for (var k74 in (res74.garrison || {})) def74 += tp74(k74) * (res74.garrison[k74] || 0);
          def74 = Math.round(def74 * (1 + wall74));
        }
        if (def74 > 0 && mine74 > 0) {
          var ratio74 = mine74 / def74;
          var lv74 = ratio74 >= 1.6 ? ['兵力充足', 'var(--green-ok)']
            : ratio74 >= 1.0 ? ['势均力敌', 'var(--gold-light)']
            : ratio74 >= 0.6 ? ['兵力偏少', 'var(--amber, #e0a83c)']
            : ['兵力悬殊', 'var(--red-light)'];
          pow73.innerHTML = '⚔️ 战力估算　我方 <b style="color:var(--blue-info)">' + U.numText(mine74, 0) +
            '</b>　vs　守军 <b style="color:var(--red-light)">' + U.numText(def74, 0) + '</b>' +
            '　<span style="color:' + lv74[1] + ';font-weight:700;">' + lv74[0] + '（' +
            (Math.round(ratio74 * 100) / 100) + ' : 1）</span>' +
            '<span style="opacity:.6;">　估算口径：兵种属性加权，守方含城防</span>';
        } else {
          pow73.innerHTML = '⚔️ 战力估算　' + (mine74 > 0 ? '守军兵力未知' : '填入兵力后显示对比');
        }
      }""",
     r"""      if (pow73) {
        /* v89.86（P-23）：战力比改读唯一出口 ui.expPowerOf（确认闸共用同一口径） */
        var pw74 = ui.expPowerOf ? ui.expPowerOf() : null;
        if (pw74 && pw74.def > 0 && pw74.mine > 0) {
          var ratio74 = pw74.ratio;
          var lv74 = ratio74 >= 1.6 ? ['兵力充足', 'var(--green-ok)']
            : ratio74 >= 1.0 ? ['势均力敌', 'var(--gold-light)']
            : ratio74 >= 0.6 ? ['兵力偏少', 'var(--amber, #e0a83c)']
            : ['兵力悬殊', 'var(--red-light)'];
          pow73.innerHTML = '⚔️ 战力估算　我方 <b style="color:var(--blue-info)">' + U.numText(pw74.mine, 0) +
            '</b>　vs　守军 <b style="color:var(--red-light)">' + U.numText(pw74.def, 0) + '</b>' +
            '　<span style="color:' + lv74[1] + ';font-weight:700;">' + lv74[0] + '（' +
            (Math.round(ratio74 * 100) / 100) + ' : 1）</span>' +
            '<span style="opacity:.6;">　估算口径：兵种属性加权，守方含城防</span>';
        } else {
          pow73.innerHTML = '⚔️ 战力估算　' + ((pw74 && pw74.mine > 0) ? '守军兵力未知' : '填入兵力后显示对比');
        }
      }""",
     'P-23 · 预估行改读唯一出口')

edit(UI, r"""    ui._expMode = m;
    var msel = document.getElementById('exp-mode');   /* v89.58：下拉框与内部状态同步 */
    if (msel && msel.value !== m) msel.value = m;
    var cur = GAME.battle.modeOf(m);
    var btn = $('#modal-root [data-action="exp-confirm"]');
    if (btn) btn.innerHTML = cur.icon + ' ' + cur.name;""",
     r"""    ui._expMode = m;
    var msel = document.getElementById('exp-mode');   /* v89.58：下拉框与内部状态同步 */
    if (msel && msel.value !== m) msel.value = m;
    /* v89.86（P-23）：换方式 → 二次确认重新计数 + 按钮还原（原为直接改 innerHTML，改走唯一出口） */
    ui.resetExpConfirm();""",
     'P-23 · setExpMode 走上膛还原')

# ============ P-19 / P-05 · ui：募兵面板 ============
edit(UI, r"""    /* v28（需求 5）：按当前人口与资源算出的**可募上限** */
    var maxN = sel ? GAME.maxTrainCount(sel.id, c.id, ui._trainBIdx) : 0;""",
     r"""    /* v28（需求 5）：按当前人口与资源算出的**可募上限**
       v89.86（整改 P-19）：上限为 0 时要**说清谁卡住**（人口 vs 资源）——
       归因走 GAME.trainLimitOf 唯一出口（maxTrainCount 是它的 cap 字段）。 */
    var limN = (sel && GAME.trainLimitOf) ? GAME.trainLimitOf(sel.id) : null;
    var maxN = sel ? GAME.maxTrainCount(sel.id, c.id, ui._trainBIdx) : 0;""",
     'P-19 · 面板读归因')

edit(UI, r"""        '<span class="ui-sub">上限 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
          + U.numText(maxN, 0) + '</b></span>' +""",
     r"""        '<span class="ui-sub">上限 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
          + U.numText(maxN, 0) + '</b></span>' +
        /* v89.86（整改 P-19）：上限 0 → 当场归因（人口不足 / 资源不足），不再"静默归零" */
        ((maxN <= 0 && limN)
          ? '<span class="ui-sub" style="color:var(--red-light);">' +
              (limN.reason === 'pop'
                ? '⚠️ 人口不足（募兵占用人口）—— 建民房或等待人口增长'
                : (limN.reason === 'res'
                    ? '⚠️ 资源不足 —— 缺 ' + ((limN.lack || []).map(function (k) { return GAME.resName(k); }).join('、') || '募兵所需资源')
                    : '当前不可募')) +
            '</span>'
          : '') +
        /* v89.86（整改 P-05）：募兵吃人口的说明常驻（此前零提示，"200→140"一脸问号） */
        (sel ? '<span class="ui-sub">每兵占人口 ' + sel.pop + '（可用 ' + U.numText(Math.floor(s.res.pop || 0), 0) + '）</span>' : '') +""",
     'P-19/P-05 · 上限归因与人口说明')

# ============ P-23 · main：doExpConfirm 二次确认闸门 ============
edit(MA, r"""    var md = GAME.battle.modeOf(mode);
    if (md.battle && Object.keys(atk).length === 0) { ui.toast('请选择出征兵力'); return; }
    /* v18：出征改为**行军队列** —— 校验/扣除在出发时完成，战斗在抵达时才打。
       于是「速度」这条属性、驿站、烽火台、天气、行军技巧、急行军令才真正有意义。 */
    var r = GAME.march.dispatch(target, mode, atk, genSel.value, ui._expScheme || null);""",
     r"""    var md = GAME.battle.modeOf(mode);
    if (md.battle && Object.keys(atk).length === 0) { ui.toast('请选择出征兵力'); return; }
    /* v89.86（整改 P-23）：兵力悬殊二次确认 —— 实测代价：0.02:1 出兵 → 200 长枪全灭、敌损 0。
       战力比 < 0.5 时第一次点击只"上膛"（按钮变红复述后果），再点一次才真发兵。
       例外：侦查（不接战）与"占领己方野地"（到了即驻，不接战）不设此闸。 */
    var _tgt86 = ui._expRes;
    var _peaceful86 = !!(_tgt86 && _tgt86.kind === 'wild' && GAME.map.wildAt(_tgt86.x, _tgt86.y));
    var _pw86 = (md.battle && !_peaceful86 && ui.expPowerOf) ? ui.expPowerOf() : null;
    if (_pw86 && _pw86.def > 0 && _pw86.mine > 0 && _pw86.ratio < 0.5 && !ui._expForceArmed) {
      ui._expForceArmed = true;
      var _ratioTxt86 = (Math.round(_pw86.ratio * 100) / 100) + ' : 1';
      var _btn86 = document.querySelector('#modal-root [data-action="exp-confirm"]');
      if (_btn86) {
        _btn86.className = 'btn red';
        _btn86.innerHTML = '⚠️ 兵力悬殊（' + _ratioTxt86 + '）—— 再点一次才发兵';
      }
      ui.toast('⚠️ 兵力悬殊（' + _ratioTxt86 + '）：此战恐全军覆没，再点一次才发兵');
      return;
    }
    ui._expForceArmed = false;
    /* v18：出征改为**行军队列** —— 校验/扣除在出发时完成，战斗在抵达时才打。
       于是「速度」这条属性、驿站、烽火台、天气、行军技巧、急行军令才真正有意义。 */
    var r = GAME.march.dispatch(target, mode, atk, genSel.value, ui._expScheme || null);""",
     'P-23 · doExpConfirm 二次确认')

# ============ 测试同步：e2e v86 提交携计（按新闸门点 1~2 次） ============
edit(E2, r"""    const inp = document.querySelector('#exp-yibing');
    if (inp) { inp.value = '100'; }
    click(document.querySelector('#modal-root [data-action="exp-confirm"]'));
    await sleep(200);
    check('v86：提交后行军携计（marches[].scheme = yaoyan）', (function () {
      return (G.state.marches || []).some((m) => m.scheme === 'yaoyan');
    })());""",
     r"""    const inp = document.querySelector('#exp-yibing');
    if (inp) { inp.value = '100'; }
    /* v89.86（P-23）：兵力悬殊（<0.5）时首次点击只"上膛"不发兵 —— 按真实状态点 1~2 次 */
    const marchesBefore86 = (G.state.marches || []).length;
    const _pw86b = G.ui.expPowerOf ? G.ui.expPowerOf() : null;
    const needTwo86 = !!(_pw86b && _pw86b.def > 0 && _pw86b.mine > 0 && _pw86b.ratio < 0.5);
    click(document.querySelector('#modal-root [data-action="exp-confirm"]'));
    await sleep(140);
    if (needTwo86) {
      check('v89.86（P-23）：兵力悬殊首击拦下（未出行军）',
        (G.state.marches || []).length === marchesBefore86,
        'ratio=' + (Math.round(_pw86b.ratio * 100) / 100));
      click(document.querySelector('#modal-root [data-action="exp-confirm"]'));
      await sleep(200);
    }
    check('v86：提交后行军携计（marches[].scheme = yaoyan）', (function () {
      return (G.state.marches || []).some((m) => m.scheme === 'yaoyan');
    })());""",
     '测试 · e2e v86 提交携计适配二次确认')

print('DONE')
