# -*- coding: utf-8 -*-
"""v89.86 整改 · P-07 黄金消耗出口：建造 / 科技队列的花金提速
   背景：后期黄金 30 万+闲置（v89.49 已给募兵队列开"花金买时间"，市场已有金→资源）。
   修法：同一把尺子接到**建造 / 科技**队列 —— 立即完成价 = 工程价值 × 20% × 剩余比例。
   入口：建筑面板（城内 / 城外 / 城墙施工中）与科技面板的「研究中」行。
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


# ============ domain.js · 提速计价与支付 ============
edit(DO, r"""  /* ============================================================
   * 自动研究（v16 · 需求 #8）：与自动建造并列""",
     r"""  /* ============================================================
   * v89.86（整改 P-07）：建造 / 科技队列的**花金提速** —— 黄金消耗出口
   * ------------------------------------------------------------
   * 背景：后期黄金 30 万+闲置；v89.49 已给募兵队列开「花金买时间」，
   *       市场有金→资源、门派有捐资 —— 这里把同一把尺子接到**建造 / 科技**队列：
   *   立即完成价 = 工程价值 × 20% × 剩余比例（不足 1 金按 1 金）。
   * 入口：建筑面板（城内 / 城外 / 城墙施工中）与科技面板「研究中」行的 ⚡。
   * ============================================================ */
  GAME.QUEUE_RUSH_PCT = 0.2;
  /* 在办工程的价值（= 该项工程的原始造价总额；按队列自身数据回算，不依赖渲染下标） */
  GAME.queueValueOf = function (q) {
    if (!q) return 0;
    var cost = null;
    if (q.type === 'build') {
      var b1 = DATA.BUILDINGS[q.buildId];
      cost = b1 ? b1.buildCost : null;
    } else if (q.type === 'upgrade') {
      var b2 = DATA.BUILDINGS[q.buildId];
      cost = b2 ? b2.levelCost((q.targetLevel || 2) - 1) : null;
    } else if (q.type === 'wall') {
      var bw = DATA.BUILDINGS.chengqiang;
      cost = bw ? (((q.targetLevel || 1) <= 1) ? bw.buildCost : bw.levelCost((q.targetLevel || 2) - 1)) : null;
    } else if (q.type === 'ext_build' || q.type === 'ext_upgrade') {
      cost = GAME.extBuildCost(q.buildId, q.type === 'ext_build' ? 0 : Math.max(0, (q.targetLevel || 2) - 1));
    } else if (q.techId) {
      var t = null;
      (DATA.TECH || []).forEach(function (x) { if (x.id === q.techId) t = x; });
      cost = t ? DATA.techCost(t, ((GAME.state.techs || {})[q.techId] || 0) + 1) : null;
    }
    if (!cost) return 0;
    var v = 0;
    for (var k in cost) { if (k === 'time') continue; v += cost[k] || 0; }
    return Math.round(v);
  };
  GAME.queueRushCost = function (q) {
    if (!q || !q.totalTime) return 0;
    var remain = Math.max(0, Math.min(1, 1 - (q.elapsed || 0) / q.totalTime));
    if (!(remain > 0)) return 0;
    return Math.max(1, Math.ceil(GAME.queueValueOf(q) * GAME.QUEUE_RUSH_PCT * remain));
  };
  /* 按位置/类型找在办工程（不依赖渲染时的下标 —— 面板可能已过时） */
  GAME.queueAt = function (kind, ref) {
    var s = GAME.state;
    var out = null;
    if (kind === 'tech') return (s.queues.tech || [])[0] || null;
    (s.queues.build || []).forEach(function (q) {
      if (out) return;
      if (kind === 'city' && (q.type === 'build' || q.type === 'upgrade') && Number(q.gridIndex) === Number(ref)) out = q;
      if (kind === 'ext' && (q.type === 'ext_build' || q.type === 'ext_upgrade') && Number(q.extIdx) === Number(ref)) out = q;
      if (kind === 'wall' && q.type === 'wall') out = q;
    });
    return out;
  };
  GAME.queueRushPay = function (q, what) {
    var s = GAME.state;
    if (!q) return { ok: false, msg: '没有在办的工程' };
    if ((q.elapsed || 0) >= q.totalTime) return { ok: false, msg: '该工程已完工' };
    var cost = GAME.queueRushCost(q);
    if ((s.res.gold || 0) < cost) {
      return { ok: false, msg: '黄金不足（需 ' + U.fmt(cost) + '，现有 ' + U.fmt(s.res.gold || 0) + '）' };
    }
    s.res.gold -= cost;
    q.elapsed = q.totalTime;      /* 下一拍由既有队列推进统一结算（与在线推进同一出口） */
    GAME.log('💰 花金提速：' + (what || '工程') + '（-' + U.fmt(cost) + ' 金，立等可成）');
    return { ok: true, cost: cost, msg: (what || '工程') + ' 提速完成（-' + U.fmt(cost) + ' 金，下一拍落成）' };
  };

  /* ============================================================
   * 自动研究（v16 · 需求 #8）：与自动建造并列""",
     'P-07 · 队列提速三件套')

# ============ ui.js · 城内建筑面板 ============
edit(UI, r"""        '<div class="bldg-foot">' +
          '<button class="btn sm red" data-action="cancel-build" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>');""",
     r"""        '<div class="bldg-foot">' +
          /* v89.86（整改 P-07）：花金提速（黄金消耗出口）—— 立即完成价 = 工程价 20% × 剩余比例 */
          '<button class="btn sm gold" data-action="rush-build" data-idx="' + idx + '" title="花金立即完成（工程价 20% × 剩余比例）">⚡ 提速</button>' +
          '<button class="btn sm red" data-action="cancel-build" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>');""",
     'P-07 · 城内建筑面板提速')

# ============ ui.js · 城墙面板 ============
edit(UI, r"""          '<button class="btn sm red" data-action="cancel-build" data-kind="wall">取消施工</button>'""",
     r"""          '<button class="btn sm gold" data-action="rush-wall" title="花金立即完成（工程价 20% × 剩余比例）">⚡ 提速</button>' +
          '<button class="btn sm red" data-action="cancel-build" data-kind="wall">取消施工</button>'""",
     'P-07 · 城墙面板提速')

# ============ ui.js · 城外地块面板 ============
edit(UI, r"""          '<button class="btn sm red" data-action="cancel-build" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>'""",
     r"""          '<button class="btn sm gold" data-action="rush-ext" data-idx="' + idx + '" title="花金立即完成（工程价 20% × 剩余比例）">⚡ 提速</button>' +
          '<button class="btn sm red" data-action="cancel-build" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>'""",
     'P-07 · 城外地块面板提速')

# ============ ui.js · 科技面板 ============
edit(UI, r"""      (cur ? '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-body);margin-bottom:8px;">🔬 研究中：' + (function(){ var n=cur.techId; DATA.TECH.forEach(function(x){if(x.id===cur.techId)n=x.name;}); return n; })() + ' ' + Math.min(100, Math.floor(cur.elapsed / cur.totalTime * 100)) + '%</div>' : '') +""",
     r"""      (cur ? '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-body);margin-bottom:8px;">🔬 研究中：' + (function(){ var n=cur.techId; DATA.TECH.forEach(function(x){if(x.id===cur.techId)n=x.name;}); return n; })() + ' ' + Math.min(100, Math.floor(cur.elapsed / cur.totalTime * 100)) + '%' +
        /* v89.86（整改 P-07）：科技队列花金提速（黄金消耗出口） */
        '　<button class="btn sm gold" data-action="rush-tech" title="花金立即完成（研究费 20% × 剩余比例）">⚡ 提速</button></div>' : '') +""",
     'P-07 · 科技面板提速')

# ============ main.js · 四个动作 ============
edit(MA, r"""      case 'quest-detail': ui.openQuestDetail(el.dataset.kind, el.dataset.id); break;""",
     r"""      case 'quest-detail': ui.openQuestDetail(el.dataset.kind, el.dataset.id); break;
      /* v89.86（整改 P-07）：建造 / 科技队列花金提速（黄金消耗出口） */
      case 'rush-build': {
        var _rq1 = GAME.queueRushPay(GAME.queueAt('city', el.dataset.idx), '营造工程');
        ui.toast(_rq1.msg);
        GAME.refreshAll();
        if (GAME.queueAt('city', el.dataset.idx)) ui.openBuildModal(Number(el.dataset.idx));
        break;
      }
      case 'rush-ext': {
        var _rq2 = GAME.queueRushPay(GAME.queueAt('ext', el.dataset.idx), '城外工程');
        ui.toast(_rq2.msg);
        GAME.refreshAll();
        if (GAME.queueAt('ext', el.dataset.idx)) ui.openExtModal(Number(el.dataset.idx));
        break;
      }
      case 'rush-wall': {
        var _rq3 = GAME.queueRushPay(GAME.queueAt('wall'), '城墙工程');
        ui.toast(_rq3.msg);
        GAME.refreshAll();
        ui.openWallPanel();
        break;
      }
      case 'rush-tech': {
        var _rq4 = GAME.queueRushPay(GAME.queueAt('tech'), '科技研究');
        ui.toast(_rq4.msg);
        GAME.refreshAll();
        ui.openPanel('tech');
        break;
      }""",
     'P-07 · main 提速动作')

print('DONE')
