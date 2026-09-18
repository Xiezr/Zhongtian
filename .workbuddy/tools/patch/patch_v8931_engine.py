# -*- coding: utf-8 -*-
"""v89.31 动作触发补丁（引擎 + UI + 挂点）

内容：
  · state.js：TRIG 扩展（actCooldownMs / _actAt）+ SG.ACT 表（14 个动作键）
              + SG.actPool / SG.preferRows / SG.rollAct
              + applyBuildDone×4 / applyTrainDone / applyTechDone 发 GAME.onActionDone
  · ui.js：ui.sgTryAct（动作触发 → 相关建筑池 → 叠层开卷）
  · main.js：GAME.onActionDone 桥；onMarchArrive 战事触发（胜/败/占城/据地）；
             doHeal / doInnRecruit / doMarketTrade / doFinishGather / doCityMove /
             doLordPromote / build-city 七处动作挂点
"""
import io
import os
import sys

R = r'E:\Deepseekdb'


def read(p):
    return io.open(R + '\\' + p, encoding='utf-8', newline='').read()


def write(p, src):
    full = R + '\\' + p
    tmp = full + '.tmp8931'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, full)


def nl_of(src):
    return '\r\n' if '\r\n' in src[:4000] else '\n'


def edit(p, pairs, tag):
    src = read(p)
    nl = nl_of(src)
    for old, new, name in pairs:
        o2 = old.replace('\n', nl)
        n2 = new.replace('\n', nl)
        c = src.count(o2)
        if c != 1:
            print('FAIL [%s -> %s] 命中 %d 次' % (tag, name, c))
            sys.exit(1)
        src = src.replace(o2, n2, 1)
    write(p, src)
    back = read(p)
    for old, new, name in pairs:
        assert new.replace('\n', nl) in back, '%s / %s 回查失败' % (tag, name)
    print('OK  ' + tag)


# ================================================================
# 1) state.js
# ================================================================
TRIG_OLD = """  GAME.SG.TRIG = {
    chance: 0.35,        /* 有未读故事时的触发概率 */
    chanceDone: 0.12,    /* 全部读毕后的重读概率（低） */
    cooldownMs: 60 * 1000,
    rng: Math.random,    /* 返回 [0,1)；可注入（测试） */
    pin: null,           /* 调试/测试：指定命中篇目（须在该锚点池内） */
    _lastAt: 0           /* 上次被抽走的时刻（运行态，不入档） */
  };"""

TRIG_NEW = """  GAME.SG.TRIG = {
    chance: 0.35,        /* 有未读故事时的触发概率 */
    chanceDone: 0.12,    /* 全部读毕后的重读概率（低） */
    cooldownMs: 60 * 1000,
    /* v89.31：动作触发（战事/营造/民生…）—— 同类动作的最小间隔（各记各的） */
    actCooldownMs: 3 * 60 * 1000,
    rng: Math.random,    /* 返回 [0,1)；可注入（测试） */
    pin: null,           /* 调试/测试：指定命中篇目（须在该锚点池内） */
    _lastAt: 0,          /* 上次被抽走的时刻（运行态，不入档） */
    _actAt: {}           /* v89.31：各动作键上次触发时刻（运行态，不入档） */
  };"""

ACT_OLD = """    GAME.SG.TRIG._lastAt = now;
    return { fire: true, sid: pick.st.id, st: pick.st };
  };
  /* 结算：赏赐走 STORY.applyReward（唯一奖赏出口），本处只做**形状折算** */"""

ACT_NEW = """    GAME.SG.TRIG._lastAt = now;
    return { fire: true, sid: pick.st.id, st: pick.st };
  };
  /* ============================================================
   * v89.31 · 动作触发（逸闻奇遇 · 因果线）
   * ------------------------------------------------------------
   * 除「点击建筑 / 地块」外，玩家的**动作结算**也可偶遇逸闻 ——
   * 覆盖四条线（共 14 个动作键）：
   *   · 战事：出征胜 / 出征败 / 占领城池 / 据守野地（行军抵达时结算）；
   *   · 营造：建造升级完成（含城外与城墙）/ 迁址 / 筑城；
   *   · 民生：训练完成 / 治疗伤兵 / 市易 / 采集归来；
   *   · 成长：研习（科技）完成 / 招贤（客栈招募）/ 爵位晋升。
   * 每个动作键给出「相关建筑池」：
   *   anchors —— 静态数组，或按 ctx 动态解析（如占城取该档城池 + 官府 + 鸿胪寺）；
   *   chance / cd —— 命中概率与同类冷却（默认 actCooldownMs）；prefer —— 可选的标签收窄；
   * 池内先取「有未读结局的」（fresh），全读毕后转低概率重读；pin 指定时绕过 prefer。
   * 挂点：引擎侧（tick 内完成）经 GAME.onActionDone（main.js 定义）→ ui.sgTryAct；
   *       界面侧动作在 main.js 各 doXxx 内直接 ui.sgTryAct。
   * ============================================================ */
  GAME.SG.ACT = {
    /* ---- 战事（onMarchArrive 结算） ---- */
    'battle-win': {
      chance: 0.35, cd: 4 * 60 * 1000,
      prefer: ['军伍', '军务', '军情', '城防', '烽燧', '马政', '驿传', '边务', '营务'],
      anchors: [['building', 'junying'], ['building', 'xiaochang'], ['building', 'chengqiang'],
                ['building', 'fenghuotai'], ['building', 'majiu'], ['building', 'yizhan']]
    },
    'battle-lose': {
      chance: 0.30, cd: 4 * 60 * 1000,
      prefer: ['军伍', '军务', '城防', '驿传', '赈济', '信义', '流民'],
      anchors: [['building', 'junying'], ['building', 'xiaochang'], ['building', 'chengqiang'],
                ['building', 'yizhan'], ['building', 'minfang']]
    },
    'occupy-city': {
      chance: 0.50, cd: 4 * 60 * 1000,
      anchors: function (ctx) {
        var t = ['county', 'jun', 'zhou', 'capital'].indexOf(ctx && ctx.type) >= 0 ? ctx.type : 'county';
        return [['city', t], ['building', 'guanfu'], ['building', 'honglusi']];
      }
    },
    'occupy-wild': {
      chance: 0.30,
      anchors: function (ctx) {
        return [['wild', (ctx && ctx.terrain) || 'hill'], ['building', 'fenghuotai'], ['building', 'chengqiang']];
      }
    },
    /* ---- 营造（applyBuildDone 结算） ---- */
    'build-done': {
      chance: 0.20,
      anchors: function (ctx) {
        var ty = (ctx && ctx.type) || '';
        var b = (ctx && ctx.id) || 'gongjiangzuofang';
        if (ty.indexOf('ext') === 0) return [['ext', b], ['building', 'gongjiangzuofang']];
        if (ty === 'wall') return [['building', 'chengqiang'], ['building', 'gongjiangzuofang']];
        return [['building', b], ['building', 'gongjiangzuofang']];
      }
    },
    'move-city': {
      chance: 0.60, cd: 4 * 60 * 1000,
      anchors: [['building', 'guanfu'], ['building', 'minfang'], ['building', 'gongjiangzuofang'], ['building', 'chengqiang']]
    },
    'build-city': {
      chance: 0.60, cd: 4 * 60 * 1000,
      anchors: [['building', 'guanfu'], ['building', 'minfang'], ['building', 'gongjiangzuofang'], ['building', 'chengqiang']]
    },
    /* ---- 民生 / 成长 ---- */
    'train-done': {
      chance: 0.10, cd: 5 * 60 * 1000,
      anchors: [['building', 'junying'], ['building', 'xiaochang'], ['building', 'tiejiangpu']]
    },
    'tech-done': {
      chance: 0.35,
      anchors: [['building', 'shuyuan'], ['building', 'zhaoxianguan']]
    },
    'heal-wounded': {
      chance: 0.25,
      anchors: [['building', 'junying'], ['building', 'minfang']]
    },
    'recruit-hero': {
      chance: 0.50, cd: 4 * 60 * 1000,
      anchors: [['building', 'zhaoxianguan'], ['building', 'kezhan']]
    },
    'market-trade': {
      chance: 0.08, cd: 5 * 60 * 1000,
      anchors: [['building', 'shichang'], ['building', 'cangku']]
    },
    'gather-done': {
      chance: 0.10, cd: 5 * 60 * 1000,
      anchors: function (ctx) {
        return [['wild', (ctx && ctx.terrain) || 'hill'], ['building', 'cangku']];
      }
    },
    'promote': {
      chance: 0.50, cd: 4 * 60 * 1000,
      anchors: [['building', 'guanfu'], ['building', 'honglusi'], ['building', 'minfang']]
    }
  };
  /* 动作池：相关锚点合并去重 → fresh（有未读结局）/ done（读毕） */
  GAME.SG.actPool = function (key, ctx) {
    var act = GAME.SG.ACT[key];
    if (!act) return { fresh: [], done: [], total: 0, act: null };
    var list = (typeof act.anchors === 'function') ? (act.anchors(ctx || {}) || []) : (act.anchors || []);
    var seen = {}, fresh = [], done = [], total = 0;
    list.forEach(function (a) {
      if (!a) return;
      GAME.SG.anchor(a[0], a[1]).forEach(function (r) {
        if (seen[r.st.id]) return;
        seen[r.st.id] = 1; total += 1;
        if ((r.done || []).length < (r.st.endings || []).length) fresh.push(r); else done.push(r);
      });
    });
    return { fresh: fresh, done: done, total: total, act: act };
  };
  /* prefer：优先取「标签命中」的那一档（只收窄、不缩空；pin 指定时绕过） */
  GAME.SG.preferRows = function (rows, act) {
    var pref = (act && act.prefer) || [];
    if (!pref.length || !rows.length) return rows;
    var hit = rows.filter(function (r) {
      var tg = r.st.tags || [];
      for (var i = 0; i < tg.length; i++) if (pref.indexOf(tg[i]) >= 0) return true;
      return false;
    });
    return hit.length ? hit : rows;
  };
  /* 动作掷骰：返回 { fire, why, sid, st, key }；why ∈ empty / cool / roll / pin-miss */
  GAME.SG.rollAct = function (key, ctx, at) {
    var p = GAME.SG.actPool(key, ctx);
    if (!p.total) return { fire: false, why: 'empty' };
    var act = p.act || {};
    var now = (at == null ? Date.now() : at);
    var cd = act.cd || GAME.SG.TRIG.actCooldownMs;
    if (now - (GAME.SG.TRIG._actAt[key] || 0) < cd) return { fire: false, why: 'cool' };
    var usePin = !!GAME.SG.TRIG.pin;
    var fresh = usePin ? p.fresh : GAME.SG.preferRows(p.fresh, act);
    var done = usePin ? p.done : GAME.SG.preferRows(p.done, act);
    var pool = fresh.length ? fresh : done;
    var pick = null;
    if (usePin) {
      for (var i = 0; i < pool.length; i++) {
        if (pool[i].st.id === GAME.SG.TRIG.pin) { pick = pool[i]; break; }
      }
      if (!pick) return { fire: false, why: 'pin-miss' };
    } else {
      var chance = fresh.length ? act.chance : (act.chanceDone != null ? act.chanceDone : GAME.SG.TRIG.chanceDone);
      if (GAME.SG.TRIG.rng() >= chance) return { fire: false, why: 'roll' };
      pick = pool[Math.min(pool.length - 1, Math.floor(GAME.SG.TRIG.rng() * pool.length))];
    }
    GAME.SG.TRIG._actAt[key] = now;
    return { fire: true, sid: pick.st.id, st: pick.st, key: key };
  };
  /* 结算：赏赐走 STORY.applyReward（唯一奖赏出口），本处只做**形状折算** */"""

BUILD_EXT_OLD = """      e.pending = null;   // 关键：清掉建设中标记
      GAME.log('城外' + (DATA.EXT_BUILDINGS[q.buildId] ? DATA.EXT_BUILDINGS[q.buildId].name : '建筑') + (q.type === 'ext_build' ? '建造完成' : '升级至 Lv' + q.targetLevel));
      return;"""
BUILD_EXT_NEW = """      e.pending = null;   // 关键：清掉建设中标记
      GAME.log('城外' + (DATA.EXT_BUILDINGS[q.buildId] ? DATA.EXT_BUILDINGS[q.buildId].name : '建筑') + (q.type === 'ext_build' ? '建造完成' : '升级至 Lv' + q.targetLevel));
      if (GAME.onActionDone) GAME.onActionDone('build-done', { id: q.buildId, type: q.type });
      return;"""

BUILD_WALL_OLD = """        GAME.log('城墙' + (wasLv === 0 ? '建成' : '升级至 Lv' + q.targetLevel)
          + '（耐久 ' + (q.targetLevel * 100) + '万 · 守军防御 +' + (q.targetLevel * 10) + '%）');
      }
      return;"""
BUILD_WALL_NEW = """        GAME.log('城墙' + (wasLv === 0 ? '建成' : '升级至 Lv' + q.targetLevel)
          + '（耐久 ' + (q.targetLevel * 100) + '万 · 守军防御 +' + (q.targetLevel * 10) + '%）');
        if (GAME.onActionDone) GAME.onActionDone('build-done', { id: 'wall', type: 'wall' });
      }
      return;"""

BUILD_TAIL_OLD = """    GAME.statBump('buildDone', 1);
    GAME.log('建筑完成：' + (DATA.BUILDINGS[q.buildId] ? DATA.BUILDINGS[q.buildId].name : q.buildId) + (q.type === 'upgrade' ? ' 升级' : ''));
  };"""
BUILD_TAIL_NEW = """    GAME.statBump('buildDone', 1);
    GAME.log('建筑完成：' + (DATA.BUILDINGS[q.buildId] ? DATA.BUILDINGS[q.buildId].name : q.buildId) + (q.type === 'upgrade' ? ' 升级' : ''));
    if (GAME.onActionDone) GAME.onActionDone('build-done', { id: q.buildId, type: q.type });
  };"""

TRAIN_OLD = """    GAME.log('训练完成：' + (DATA.TROOPS[t.troopId] ? DATA.TROOPS[t.troopId].name : t.troopId) + ' ×' + t.count);
  };"""
TRAIN_NEW = """    GAME.log('训练完成：' + (DATA.TROOPS[t.troopId] ? DATA.TROOPS[t.troopId].name : t.troopId) + ' ×' + t.count);
    if (GAME.onActionDone) GAME.onActionDone('train-done', { troopId: t.troopId, count: t.count });
  };"""

TECH_OLD = """    GAME.log('科技完成：' + name);
  };"""
TECH_NEW = """    GAME.log('科技完成：' + name);
    if (GAME.onActionDone) GAME.onActionDone('tech-done', { techId: tq.techId });
  };"""

edit('js/state.js', [
    (TRIG_OLD, TRIG_NEW, 'TRIG 扩展'),
    (ACT_OLD, ACT_NEW, 'SG.ACT 表 + 三函数'),
    (BUILD_EXT_OLD, BUILD_EXT_NEW, 'build 回调·城外'),
    (BUILD_WALL_OLD, BUILD_WALL_NEW, 'build 回调·城墙'),
    (BUILD_TAIL_OLD, BUILD_TAIL_NEW, 'build 回调·城内'),
    (TRAIN_OLD, TRAIN_NEW, 'train 回调'),
    (TECH_OLD, TECH_NEW, 'tech 回调'),
], 'state.js')

# ================================================================
# 2) ui.js
# ================================================================
UI_OLD = """  /* 概率奇遇：点开建筑 / 地块后掷骰；命中则在面板之上开卷（弹窗不关） */
  ui.sgTryTrigger = function (kind, id) {
    if (!GAME.SG || !GAME.SG.roll || !id) return false;
    var r = GAME.SG.roll(kind, id);
    if (!r.fire) return false;
    ui.openStory(r.sid, true);
    return true;
  };"""
UI_NEW = UI_OLD + """
  /* v89.31 · 动作触发：战事 / 营造 / 民生 / 成长等动作结算后调用（见 GAME.SG.ACT 表）；
     命中即从「相关建筑」池里抽一篇，在当前画面（含弹窗）之上开卷（叠层语义）。 */
  ui.sgTryAct = function (key, ctx) {
    if (!GAME.SG || !GAME.SG.rollAct || !key) return false;
    var r = GAME.SG.rollAct(key, ctx);
    if (!r.fire) return false;
    ui.openStory(r.sid, true);
    return true;
  };"""

edit('js/ui.js', [(UI_OLD, UI_NEW, 'ui.sgTryAct')], 'ui.js')

# ================================================================
# 3) main.js
# ================================================================
MARCH_OLD = """    if (r.ok) {
      ui.toast('⚔️ ' + m.name + '：' + r.msg);
    }
    /* 攻占新城 / 战斗结果都在战报里，这里不重复打扰 */
  };"""
MARCH_NEW = """    if (r.ok) {
      ui.toast('⚔️ ' + m.name + '：' + r.msg);
    }
    /* v89.31 · 战事奇遇：胜 / 败 / 占城 / 据地 之后，从「相关建筑」池里偶遇一篇逸闻 */
    if (r.result && r.result.winner && r.result.winner !== 'scout' && GAME.SG && ui.sgTryAct) {
      var _t31 = r.target || {};
      var _m31 = GAME.battle.modeOf(r.mode) || {};
      var _win31 = r.result.winner === 'atk';
      if (_win31 && _m31.occupy && _t31.kind === 'city') {
        ui.sgTryAct('occupy-city', { type: _t31.cityType || 'county' });
      } else if (_win31 && _m31.occupy && _t31.kind === 'wild') {
        ui.sgTryAct('occupy-wild', { terrain: _t31.terrain || 'hill' });
      } else {
        ui.sgTryAct(_win31 ? 'battle-win' : 'battle-lose');
      }
    }
    /* 攻占新城 / 战斗结果都在战报里；逸闻触发单独在上一条处理 */
  };
  /* v89.31 · 引擎侧动作完成桥（营造 / 训练 / 研习在 tick 内结算）→ 逸闻动作触发 */
  GAME.onActionDone = function (key, ctx) {
    if (ui.sgTryAct) ui.sgTryAct(key, ctx);
  };"""

HEAL_OLD = """    var host = document.querySelector('#modal-root [data-heal-host]');
    var k = host ? host.dataset.healHost : '';
    if (k === 'xiaochang') ui.openXiaochang();
    else if (k === 'marches') ui.openMarches();
  };"""
HEAL_NEW = """    var host = document.querySelector('#modal-root [data-heal-host]');
    var k = host ? host.dataset.healHost : '';
    if (k === 'xiaochang') ui.openXiaochang();
    else if (k === 'marches') ui.openMarches();
    ui.sgTryAct('heal-wounded');   /* v89.31 · 动作触发 */
  };"""

INN_OLD = """  GAME.doInnRecruit = function (cid) {
    /* v64：把**当前城**传进去 —— 客栈在城里，席位也在城里 */
    var c = GAME.currentCity();
    var r = GAME.innRecruit(cid, c ? c.id : null);
    ui.toast(r.msg);
    if (r.ok) { ui.openInn(); GAME.refreshAll(); }
  };"""
INN_NEW = """  GAME.doInnRecruit = function (cid) {
    /* v64：把**当前城**传进去 —— 客栈在城里，席位也在城里 */
    var c = GAME.currentCity();
    var r = GAME.innRecruit(cid, c ? c.id : null);
    ui.toast(r.msg);
    if (r.ok) { ui.openInn(); GAME.refreshAll(); ui.sgTryAct('recruit-hero', { cid: cid }); }   /* v89.31 */
  };"""

MKT_OLD = """    var r = GAME.marketTrade(f.value, t.value, Number(a.value) || 0);
    ui.toast(r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); }
  };"""
MKT_NEW = """    var r = GAME.marketTrade(f.value, t.value, Number(a.value) || 0);
    ui.toast(r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); ui.sgTryAct('market-trade'); }   /* v89.31 */
  };"""

GATHER_OLD = """  GAME.doFinishGather = function (id) {
    var r = GAME.finishGather(id);
    ui.toast(r.msg);
    GAME.refreshAll();
    ui.openGathers();
  };"""
GATHER_NEW = """  GAME.doFinishGather = function (id) {
    /* v89.31：先取本次采集的地形（动作触发池要用），再结算（记录会被移除） */
    var _rec31 = null;
    (GAME.gatherList() || []).forEach(function (x) { if (x.id === id) _rec31 = x; });
    var r = GAME.finishGather(id);
    ui.toast(r.msg);
    if (r.ok) ui.sgTryAct('gather-done', { terrain: _rec31 ? _rec31.type : null });
    GAME.refreshAll();
    ui.openGathers();
  };"""

MOVE_OLD = """    var r = GAME.moveCityTo(id, el1 ? el1.value : NaN, el2 ? el2.value : NaN);
    ui.toast(r.msg);
    if (r.ok) {
      ui.closeModal();
      if (ui.view === 'map' && ui.renderMapCanvas) ui.renderMapCanvas();
      GAME.refreshAll();
    }
  };"""
MOVE_NEW = """    var r = GAME.moveCityTo(id, el1 ? el1.value : NaN, el2 ? el2.value : NaN);
    ui.toast(r.msg);
    if (r.ok) {
      ui.closeModal();
      if (ui.view === 'map' && ui.renderMapCanvas) ui.renderMapCanvas();
      GAME.refreshAll();
      ui.sgTryAct('move-city');   /* v89.31 · 动作触发 */
    }
  };"""

PROMOTE_OLD = """  GAME.doLordPromote = function () {
    var r = GAME.systems.promote();
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); }
  };"""
PROMOTE_NEW = """  GAME.doLordPromote = function () {
    var r = GAME.systems.promote();
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); ui.sgTryAct('promote'); }   /* v89.31 */
  };"""

BUILDCITY_OLD = """      case 'build-city': (function () { var xy = ui._buildCityXY; if (!xy) return; var r = GAME.buildCityAt(xy.x, xy.y); ui.toast(r.msg); if (r.ok) { ui.closeModal(); GAME.refreshAll(); } })(); break;"""
BUILDCITY_NEW = """      case 'build-city': (function () { var xy = ui._buildCityXY; if (!xy) return; var r = GAME.buildCityAt(xy.x, xy.y); ui.toast(r.msg); if (r.ok) { ui.closeModal(); GAME.refreshAll(); ui.sgTryAct('build-city'); } })(); break;"""

edit('js/main.js', [
    (MARCH_OLD, MARCH_NEW, 'onMarchArrive + 桥'),
    (HEAL_OLD, HEAL_NEW, 'doHeal'),
    (INN_OLD, INN_NEW, 'doInnRecruit'),
    (MKT_OLD, MKT_NEW, 'doMarketTrade'),
    (GATHER_OLD, GATHER_NEW, 'doFinishGather'),
    (MOVE_OLD, MOVE_NEW, 'doCityMove'),
    (PROMOTE_OLD, PROMOTE_NEW, 'doLordPromote'),
    (BUILDCITY_OLD, BUILDCITY_NEW, 'build-city'),
], 'main.js')

print('ALL OK')
