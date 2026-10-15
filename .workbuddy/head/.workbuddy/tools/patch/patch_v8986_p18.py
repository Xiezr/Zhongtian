# -*- coding: utf-8 -*-
"""v89.86 整改 · P-18 自动化预算闸门
   事故：自动升级+研究 40 分钟把石料 13.9 万抽到 15、金 16 万抽到 1.4 万（手动建设被卡死）。
   修法：每次消费前检查「花完至少留下花前存量的 pct%」（默认 5%，可 0/5/10/20/30，0=不设限）；
        超线候选跳过（换更便宜的试），全部超线则暂停并说明；
        另加「自动研究最高等级」（0=不限）。只拦自动化，手动不受影响。
"""
import io
import os
import sys

DO = r'E:\Deepseekdb\js\domain.js'
UI = r'E:\Deepseekdb\js\ui.js'
MA = r'E:\Deepseekdb\js\main.js'
DA = r'E:\Deepseekdb\js\data.js'


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


# ============ data.js · 默认设置 ============
edit(DA, r"""  DATA.DEFAULT_SETTINGS = { timeScale: 120, tax: 0.5, hearts: 100, autoSave: true, autoUpgrade: false, autoResearch: false, zoom: 100 };""",
     r"""  DATA.DEFAULT_SETTINGS = { timeScale: 120, tax: 0.5, hearts: 100, autoSave: true, autoUpgrade: false, autoResearch: false, zoom: 100,
    /* v89.86（整改 P-18）：自动化预算闸门 —— 每次消费后至少留下花前存量的 pct%；0 = 不设限 */
    autoReservePct: 5, autoTechMaxLv: 0 };""",
     'P-18 · 默认设置')

# ============ domain.js · 闸门三件套 + 接线 ============
edit(DO, r"""  GAME.autoUpgrade = function () {""",
     r"""  /* ============================================================
   * v89.86（整改 P-18）：自动化**预算闸门** —— 唯一出口
   * ------------------------------------------------------------
   * 实测事故：自动升级 + 自动研究开启 40 分钟，把石料 13.9 万抽到 15、金 16 万抽到 1.4 万，
   * 玩家手动建设（铁匠铺 600 石）被彻底卡死。
   * 口径：每次消费前检查「花完至少留下花前存量的 pct%」（默认 5%，可调 0~50，0=不设限）。
   * 只拦自动化 —— 手动建造/研究是玩家自己的决定，不受此线约束。
   * ============================================================ */
  GAME.autoReservePct = function () {
    var s = GAME.state;
    var v = (s && s.settings && s.settings.autoReservePct);
    return (v == null) ? 5 : Math.max(0, Math.min(50, Number(v) || 0));
  };
  GAME.autoBudgetCheck = function (cost) {
    var s = GAME.state;
    if (!s || !cost) return { ok: true };
    var pct = GAME.autoReservePct();
    if (!pct) return { ok: true };
    var lack = [];
    for (var k in cost) {
      if (k === 'time') continue;
      var have = s.res[k] || 0;
      if (have - (cost[k] || 0) < have * pct / 100) lack.push(GAME.resName(k));
    }
    if (!lack.length) return { ok: true };
    return { ok: false, lack: lack,
      msg: '预算闸门：花完将跌破保留下限（存量的 ' + pct + '%）—— 缺 ' + lack.join('、') };
  };
  /* 候选项目的造价（与各升级入口读同一份数据；折扣只少不多，按原价判更稳） */
  GAME.autoCostOfCandidate = function (c) {
    if (!c) return null;
    var city = GAME.cityById(c.cityId) || GAME.currentCity();
    if (c.kind === 'city') {
      var cell = city && city.cells && city.cells[c.idx];
      var b = cell && cell.build && DATA.BUILDINGS[cell.build.id];
      return b ? b.levelCost(cell.build.lvl) : null;
    }
    if (c.kind === 'wall') {
      var bw = DATA.BUILDINGS.chengqiang;
      return bw ? bw.levelCost((city && city.wallLv) || 0) : null;
    }
    if (c.kind === 'ext') {
      var e = (city && GAME.extGridOf) ? GAME.extGridOf(city)[c.idx] : null;
      return e ? GAME.extBuildCost(e.type, e.lv) : null;
    }
    return null;
  };

  GAME.autoUpgrade = function () {""",
     'P-18 · 闸门三件套')

edit(DO, r"""    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var r = c.kind === 'ext' ? GAME.upgradeExt(c.idx, c.cityId)
        : (c.kind === 'wall' ? GAME.buildWall(c.cityId)
          : GAME.upgradeAt(c.cityId || city.id, c.idx));
      if (r && r.ok) {
        s.autoState = { paused: false, last: c.name, msg: '正在升级 ' + c.name + ' → Lv' + (c.lv + 1) };
        GAME.log('自动升级：' + c.name + ' → Lv' + (c.lv + 1));
        return { ok: true, target: c };
      }
      if (r && !r.ok && /不足/.test(r.msg)) {
        /* 资源不足 → 暂停，等待资源恢复后自动继续 */
        s.autoState = { paused: true, reason: r.msg, want: c.name, msg: '资源不足，暂停中（待升级 ' + c.name + '）' };
        return { paused: true, reason: r.msg, target: c };
      }
    }
    s.autoState = { paused: false, msg: '暂无可升级项' };
    return null;
  };""",
     r"""    /* v89.86（整改 P-18）：预算闸门 —— 会击穿保留线的候选**跳过**（换更便宜的试）；
       全部候选都被挡下 → 暂停并说明（与"资源不足"同一暂停语义，不关开关）。 */
    var gated = [], gatedMsg = '';
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var bchk = GAME.autoBudgetCheck(GAME.autoCostOfCandidate(c));
      if (!bchk.ok) { gated.push(c.name); gatedMsg = bchk.msg; continue; }
      var r = c.kind === 'ext' ? GAME.upgradeExt(c.idx, c.cityId)
        : (c.kind === 'wall' ? GAME.buildWall(c.cityId)
          : GAME.upgradeAt(c.cityId || city.id, c.idx));
      if (r && r.ok) {
        s.autoState = { paused: false, last: c.name, msg: '正在升级 ' + c.name + ' → Lv' + (c.lv + 1) };
        GAME.log('自动升级：' + c.name + ' → Lv' + (c.lv + 1));
        return { ok: true, target: c };
      }
      if (r && !r.ok && /不足/.test(r.msg)) {
        /* 资源不足 → 暂停，等待资源恢复后自动继续 */
        s.autoState = { paused: true, reason: r.msg, want: c.name, msg: '资源不足，暂停中（待升级 ' + c.name + '）' };
        return { paused: true, reason: r.msg, target: c };
      }
    }
    if (gated.length && gated.length === cands.length) {
      s.autoState = { paused: true, reason: gatedMsg, gated: true,
        msg: gatedMsg + '（' + gated.length + ' 项待升）' };
      return { paused: true, reason: gatedMsg, gated: true };
    }
    s.autoState = { paused: false, msg: '暂无可升级项' };
    return null;
  };""",
     'P-18 · autoUpgrade 闸门接线')

edit(DO, r"""    var cands = (DATA.TECH || []).filter(function (t) {
      return shuLv >= t.lv && (s.techs[t.id] || 0) < 10;
    }).sort(function (a, b) {
      var la = s.techs[a.id] || 0, lb = s.techs[b.id] || 0;
      return la - lb || a.lv - b.lv;
    });
    if (!cands.length) { s.autoTechState = { done: true, msg: '科技已全部满级（或受书院等级限制）' }; return null; }
    for (var i = 0; i < cands.length; i++) {
      var r = GAME.systems.research(cands[i].id);
      if (r && r.ok) { s.autoTechState = { msg: '正在研究 ' + cands[i].name }; GAME.log('自动研究：' + cands[i].name); return r; }
      if (r && /不足/.test(r.msg)) { s.autoTechState = { paused: true, want: cands[i].name, msg: r.msg }; return r; }
    }
    s.autoTechState = { msg: '暂无可研究项' };
    return null;
  };""",
     r"""    /* v89.86（整改 P-18）：自动研究**等级上限**（settings.autoTechMaxLv，0=不限） */
    var capLv18 = (s.settings && s.settings.autoTechMaxLv) || 0;
    var cands = (DATA.TECH || []).filter(function (t) {
      var lv = s.techs[t.id] || 0;
      if (shuLv < t.lv || lv >= 10) return false;
      if (capLv18 > 0 && lv >= capLv18) return false;
      return true;
    }).sort(function (a, b) {
      var la = s.techs[a.id] || 0, lb = s.techs[b.id] || 0;
      return la - lb || a.lv - b.lv;
    });
    if (!cands.length) {
      s.autoTechState = { done: true, msg: capLv18 > 0
        ? '科技已到自动研究上限（Lv' + capLv18 + '）'
        : '科技已全部满级（或受书院等级限制）' };
      return null;
    }
    /* v89.86（整改 P-18）：预算闸门（与自动升级同一条线） */
    var gatedT = 0, gatedMsgT = '';
    for (var i = 0; i < cands.length; i++) {
      var bchkT = GAME.autoBudgetCheck(DATA.techCost(cands[i], (s.techs[cands[i].id] || 0) + 1));
      if (!bchkT.ok) { gatedT++; gatedMsgT = bchkT.msg; continue; }
      var r = GAME.systems.research(cands[i].id);
      if (r && r.ok) { s.autoTechState = { msg: '正在研究 ' + cands[i].name }; GAME.log('自动研究：' + cands[i].name); return r; }
      if (r && /不足/.test(r.msg)) { s.autoTechState = { paused: true, want: cands[i].name, msg: r.msg }; return r; }
    }
    if (gatedT && gatedT === cands.length) {
      s.autoTechState = { paused: true, gated: true, msg: gatedMsgT };
      return null;
    }
    s.autoTechState = { msg: '暂无可研究项' };
    return null;
  };""",
     'P-18 · autoResearch 上限与闸门')

# ============ ui.js · 自动化页加「预算闸门」卡 ============
edit(UI, r"""      /* ---- 自动研究 ---- */
      '<div class="auto-card">' +
        '<div class="ac-title">📜 自动研究</div>' +
        '<div class="auto-state">' + U.escape((s.autoTechState && s.autoTechState.msg) || '未开启') + '</div>' +
        '<div class="auto-note">从书院当前能研究的科技里挑最便宜的一项；' +
          '资源不足则暂停等待，不影响开关状态。</div>' +
      '</div>' +""",
     r"""      /* ---- 自动研究 ---- */
      '<div class="auto-card">' +
        '<div class="ac-title">📜 自动研究</div>' +
        '<div class="auto-state">' + U.escape((s.autoTechState && s.autoTechState.msg) || '未开启') + '</div>' +
        '<div class="auto-note">从书院当前能研究的科技里挑最便宜的一项；' +
          '资源不足则暂停等待，不影响开关状态。</div>' +
      '</div>' +

      /* ---- 预算闸门（v89.86 · 整改 P-18） ---- */
      '<div class="auto-card">' +
        '<div class="ac-title">🛡️ 预算闸门' +
          ui.help('自动化每次消费前先算「花完还剩多少」：\\n' +
            '剩不到花前存量的选定比例 → 跳过这一项（换更便宜的试）；\\n' +
            '全部候选都超线 → 暂停并说明（资源恢复后自动继续）。\\n' +
            '只拦自动化 —— 手动建造/研究不受影响。') +
        '</div>' +
        '<div class="auto-line"><span class="al-k">资源保留下限</span>' +
          ui.chips({ cls: 'chips-xs', after: 'autofin', k: 'reservePct',
            opts: [0, 5, 10, 20, 30].map(function (v) {
              return { v: v, on: v === GAME.autoReservePct(), label: v === 0 ? '不保留' : (v + '%') };
            }) }) +
          '<span class="ui-sub">每次消费后至少留下存量的该比例</span></div>' +
        '<div class="auto-line"><span class="al-k">自动研究上限</span>' +
          ui.chips({ cls: 'chips-xs', after: 'autofin', k: 'techMaxLv',
            opts: [0, 3, 5, 8].map(function (v) {
              return { v: v, on: v === (s.settings.autoTechMaxLv || 0), label: v === 0 ? '不限' : ('Lv' + v) };
            }) }) +
          '<span class="ui-sub">自动研究只升到该等级（手动不受限）</span></div>' +
        '<div class="auto-state">' + U.escape(ui.autoReserveLine()) + '</div>' +
      '</div>' +""",
     'P-18 · 自动化页预算闸门卡')

edit(UI, r"""  ui.autoHTML = function () {""",
     r"""  /* v89.86（整改 P-18）：预算闸门/研究上限的一句话现状（自动化页与开关 toast 共用） */
  ui.autoReserveLine = function () {
    var pct = GAME.autoReservePct();
    var capT = (GAME.state && GAME.state.settings && GAME.state.settings.autoTechMaxLv) || 0;
    return (pct > 0
      ? ('预算闸门：每次消费后各资源至少留下花前存量的 ' + pct + '%')
      : '预算闸门：不设下限（自动化可把资源花到 0）')
      + '　·　' + (capT ? ('自动研究只升到 Lv' + capT) : '自动研究不限等级');
  };

  ui.autoHTML = function () {""",
     'P-18 · autoReserveLine')

# ============ main.js · 处理与 toast ============
edit(MA, r"""        /* v29（需求 5）：自动出征参数（字段名走 data-k） */
        else if (after === 'automarch') GAME.doSetAutoMarch(el.dataset.k, el.dataset.v);
        break;""",
     r"""        /* v29（需求 5）：自动出征参数（字段名走 data-k） */
        else if (after === 'automarch') GAME.doSetAutoMarch(el.dataset.k, el.dataset.v);
        /* v89.86（P-18）：自动化预算闸门 / 自动研究上限 */
        else if (after === 'autofin') GAME.doSetAutoFin(el.dataset.k, el.dataset.v);
        break;""",
     'P-18 · chip-set autofin')

edit(MA, r"""      case 'toggle-auto-research': GAME.state.settings.autoResearch = !GAME.state.settings.autoResearch; GAME.refreshView(); break;""",
     r"""      case 'toggle-auto-research': GAME.doToggleAutoResearch(); break;   /* v89.86（P-18）：改函数（带保留线下限提示） */""",
     'P-18 · 自动研究开关改函数')

edit(MA, r"""      s.autoState = { paused: false, msg: '已开启，待命' };
      ui.toast('🔨 自动升级已开启（按等级从低到高）');""",
     r"""      s.autoState = { paused: false, msg: '已开启，待命' };
      /* v89.86（P-18）：开启时提示当前将遵循的预算下限 */
      ui.toast('🔨 自动升级已开启（按等级从低到高）　·　' + ui.autoReserveLine());""",
     'P-18 · 升级开关 toast')

edit(MA, r"""  /* ---------- 背包动作 ---------- */""",
     r"""  /* v89.86（整改 P-18）：自动研究开关（原为一行内联写法 —— 补 toast 与保留线提示） */
  GAME.doToggleAutoResearch = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings.autoResearch = !s.settings.autoResearch;
    if (s.settings.autoResearch) {
      s.autoTechState = { paused: false, msg: '已开启，待命' };
      ui.toast('📜 自动研究已开启　·　' + ui.autoReserveLine());
      if (GAME.autoResearch) GAME.autoResearch();
    } else {
      s.autoTechState = null;
      ui.toast('自动研究已关闭');
    }
    GAME.refreshView();
  };
  /* v89.86（P-18）：预算闸门 / 自动研究上限（chips → 设置落盘 → 重绘本页） */
  GAME.doSetAutoFin = function (k, v) {
    var s = GAME.state;
    if (!s) return;
    s.settings = s.settings || {};
    v = Number(v) || 0;
    if (k === 'reservePct') {
      s.settings.autoReservePct = Math.max(0, Math.min(50, v));
      ui.toast('资源保留下限：' + (s.settings.autoReservePct ? (s.settings.autoReservePct + '%（每次消费后至少留下存量的该比例）') : '不保留'));
    } else if (k === 'techMaxLv') {
      s.settings.autoTechMaxLv = Math.max(0, Math.min(10, v));
      ui.toast('自动研究上限：' + (s.settings.autoTechMaxLv ? ('Lv' + s.settings.autoTechMaxLv) : '不限'));
    }
    GAME.refreshView();
  };

  /* ---------- 背包动作 ---------- */""",
     'P-18 · doSetAutoFin / doToggleAutoResearch')

print('DONE')
