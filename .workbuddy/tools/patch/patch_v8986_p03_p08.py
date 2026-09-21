# -*- coding: utf-8 -*-
"""v89.86 整改 · P-03 任务「前往」按钮 + P-08 随机任务可达性过滤
   P-03：任务详情加「前往」——建筑类定位到城池对应格（已有→直开该格；未有→开建造选择器），
         其余按 metric 归一去处（城外/科技/兵营/地图/将领/商城）+ 文案指引。
   P-08：随机任务生成时过滤不可达项（实测反例：人口上限 200 时刷出「养兵 0/500」）。
"""
import io
import os
import sys

DO = r'E:\Deepseekdb\js\domain.js'
UI = r'E:\Deepseekdb\js\ui.js'
MA = r'E:\Deepseekdb\js\main.js'


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


# ============ P-08 · domain：可达性过滤 ============
edit(DO, r"""  /* 抽一批随机任务：同批内类型互不相同 */
  function rollBatch(count, pool) {
    var usedType = {}, usedId = {};
    pool.forEach(function (e) {
      var d = RQ_BY_ID[e.id];
      if (d) usedType[d.type] = true;
      usedId[e.id] = true;
    });
    var out = [];
    for (var i = 0; i < count; i++) {
      var cands = DATA.RANDOM_QUESTS.filter(function (q) {
        return !usedType[q.type] && !usedId[q.id];
      });
      if (!cands.length) {
        cands = DATA.RANDOM_QUESTS.filter(function (q) { return !usedId[q.id]; });
      }""",
     r"""  /* v89.86（整改 P-08）：随机任务的**可达性过滤** —— 目标必须落在当前进度够得着的范围内。
     实测反例：人口上限 200 时刷出「养兵之资 0/500」（armyTotal 500），目标脱离进度。
     判据（保守，只砍明确不可达的）：
       · armyTotal        —— 目标 ≤ 全境人口上限合计（拥兵上限即人口上限）
       · troopCount(sub)  —— 该兵种**已解锁**（未解锁的兵种刷出来只能干瞪眼）
       · bldCount(sub)    —— 唯一建筑已建成时，不再刷"再建一座"
     全部生成路径（每日刷新 / 单条换新 / 全部换新）都走 rollBatch —— 拦在这一处即可。 */
  GAME.questReachable = function (def) {
    if (!def) return true;
    var s = GAME.state;
    if (!s) return true;
    var city = GAME.currentCity() || (s.cities || [])[0];
    if (!city) return false;
    if (def.metric === 'armyTotal') {
      var popCap = 0;
      (s.cities || []).forEach(function (ct) { popCap += (GAME.maxPopOf ? GAME.maxPopOf(ct) : 0) || 0; });
      return (def.goal || 0) <= Math.max(1, popCap);
    }
    if (def.metric === 'troopCount' && def.sub) {
      var t = DATA.TROOPS[def.sub];
      if (!t) return false;
      var u = t.unlock || {};
      for (var k in u) {
        if ((GAME.buildingLevel(city, k) || 0) < u[k]) return false;
      }
      return true;
    }
    if (def.metric === 'bldCount' && def.sub) {
      var UNIQ = GAME.UNIQUE_BUILDINGS || {};
      if (UNIQ[def.sub]) {
        return (GAME.buildingLevel(city, def.sub) || 0) <= 0;   /* 唯一建筑已建成 → 不可达 */
      }
      return true;
    }
    return true;
  };

  /* 抽一批随机任务：同批内类型互不相同 */
  function rollBatch(count, pool) {
    var usedType = {}, usedId = {};
    pool.forEach(function (e) {
      var d = RQ_BY_ID[e.id];
      if (d) usedType[d.type] = true;
      usedId[e.id] = true;
    });
    var out = [];
    for (var i = 0; i < count; i++) {
      var cands = DATA.RANDOM_QUESTS.filter(function (q) {
        return !usedType[q.type] && !usedId[q.id] && GAME.questReachable(q);   /* v89.86（P-08） */
      });
      if (!cands.length) {
        cands = DATA.RANDOM_QUESTS.filter(function (q) { return !usedId[q.id] && GAME.questReachable(q); });
      }""",
     'P-08 · 可达性过滤')

# ============ P-03 · ui：前往映射 + 执行 ============
edit(UI, r"""  ui.openQuestDetail = function (kind, id) {""",
     r"""  /* v89.86（整改 P-03）：任务「前往」的去处映射 —— 一处归表，入口与执行共用。
     建筑类能精确定位就精确定位（见 doQuestGo），其余按 metric 归到对应视图。 */
  ui.questJumpOf = function (def) {
    var m = (def && def.metric) || '';
    var CITY = { bldCount: 1, bldLevel: 1, buildDone: 1, res: 1, pop: 1, hearts: 1, gold: 1,
                 matTotal: 1, forgeTotal: 1, equipCount: 1, forgeKinds: 1 };
    var GEN = { recruitCount: 1, genCount: 1, heroCount: 1, rank: 1 };
    if (CITY[m]) return { view: 'city', msg: '前往城池（城内建筑 / 侧栏资源）' };
    if (m === 'extCount' || m === 'extTotal' || m === 'extLevel') return { view: 'ext', msg: '前往城外地块' };
    if (m === 'techLevel' || m === 'techTotal' || m === 'techDone') return { view: 'tech', msg: '前往书院 · 科技' };
    if (m === 'trainTotal' || m === 'troopCount' || m === 'armyTotal') return { view: 'troops', msg: '前往兵营 · 募兵' };
    if (m === 'conquerCount' || m === 'winCount' || m === 'wildCount' || m === 'cityCount') return { view: 'map', msg: '前往地图（选目标出征）' };
    if (GEN[m]) return { view: 'generals', msg: '前往将领' };
    if (m === 'tradeCount') return { view: 'shop', msg: '前往商城' };
    return null;
  };
  /* 「前往」执行：建筑类 → 城池对应格（已有该建筑直开该格；否则开建造选择器）；其余 → 切视图 + 指引 */
  ui.doQuestGo = function (kind, id) {
    var s = GAME.state;
    var def = null;
    if (kind === 'random') {
      var entry = null;
      (s.quests.pool || []).forEach(function (e) { if (e.id === id) entry = e; });
      if (entry && GAME.randomQuestDef) def = GAME.randomQuestDef(entry.id);
    } else {
      (DATA.QUESTS || []).forEach(function (q) { if (q.id === id) def = q; });
    }
    if (!def) { ui.toast('任务不存在'); return; }
    var j = ui.questJumpOf(def);
    ui.closeModal();
    if (!j) { ui.toast('按指引进行：' + (def.guide || '—')); return; }
    if (j.view === 'city' && def.sub && DATA.BUILDINGS[def.sub]) {
      var city = GAME.currentCity();
      var hit = -1, empty = -1;
      (city.cells || []).forEach(function (c, i) {
        if (c && c.build && c.build.id === def.sub && hit < 0) hit = i;
        if (c && !c.build && empty < 0) empty = i;
      });
      ui.setView('city');
      var pick = hit >= 0 ? hit : empty;
      if (pick >= 0) {
        ui.openBuildModal(pick);
        ui.toast('已定位：' + (hit >= 0 ? ((DATA.BUILDINGS[def.sub]).name + ' 所在格') : '城内空地 —— 选择要建造的建筑'));
      } else {
        ui.toast(j.msg + '（' + (def.guide || '按任务指引进行') + '）');
      }
      return;
    }
    ui.setView(j.view);
    ui.toast(j.msg + (def.guide ? '　' + def.guide : ''));
  };

  ui.openQuestDetail = function (kind, id) {""",
     'P-03 · 前往映射与执行')

edit(UI, r"""    var foot = '<div class="m-foot">';
    if (claimed) {
      foot += '<span class="ui-sub">已领取</span>';
    } else if (ready) {""",
     r"""    var foot = '<div class="m-foot">';
    /* v89.86（整改 P-03）：任务「前往」—— 建筑类定位到城池对应格，其余切到该管事的视图 */
    if (!claimed && ui.questJumpOf(def)) {
      foot += '<button class="btn gold" data-action="quest-go" data-kind="' + (isRandom ? 'random' : 'growth')
        + '" data-id="' + def.id + '">🧭 前往</button>';
    }
    if (claimed) {
      foot += '<span class="ui-sub">已领取</span>';
    } else if (ready) {""",
     'P-03 · 详情页前往按钮')

# ============ P-03 · main：动作 ============
edit(MA, r"""      case 'quest-detail': ui.openQuestDetail(el.dataset.kind, el.dataset.id); break;""",
     r"""      case 'quest-detail': ui.openQuestDetail(el.dataset.kind, el.dataset.id); break;
      /* v89.86（整改 P-03）：任务「前往」（建筑类定位到城池对应格；其余切视图） */
      case 'quest-go': ui.doQuestGo(el.dataset.kind, el.dataset.id); break;""",
     'P-03 · main 动作')

print('DONE')
