# -*- coding: utf-8 -*-
"""v70 · 第 2 块（坐标与迁址）+ 第 3 块（君主将领）。

第 2 块 · 老板需求 3/4：
  「城池的主界面提供其坐标（500*500），自动确认。形成一个随机设置，可以一键随机
    当前城池坐标位置（除名城，名城固定）」
  「为玩家城池提供坐标切换，移动到某坐标时，替换原地块建筑（除名城，名城固定）」

第 3 块 · 老板需求 1：
  「增加一个角色将领（即玩家角色本身，具有将领的所有功能，但是不可解雇，
    留可扩张框架，后续将设计普通将领不具备的功能）」

用法：python patch_v70_city_lord.py     （幂等；锚点不唯一就拒绝写盘）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
J = lambda *a: os.path.join(ROOT, *a)
DATA = J('js', 'data.js')
STATE = J('js', 'state.js')
DOMAIN = J('js', 'domain.js')
UI = J('js', 'ui.js')
MAIN = J('js', 'main.js')
HTML = J('index.html')


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def save_lf(p, s, tag):
    if '\r' in s:
        print('!! %s：内容含 CR，拒绝写盘' % tag)
        return False
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    if b'\r' in io.open(p, 'rb').read():
        print('!! %s：落盘核验失败' % tag)
        return False
    return True


def cut(src, old, new, tag, optional=False):
    n = src.count(old)
    if n == 0:
        if optional:
            print('  · %s：已改过（跳过）' % tag)
            return src
        print('!! %s：锚点 0 次命中，拒绝写盘' % tag)
        return None
    if n > 1:
        print('!! %s：锚点 %d 次命中（必须唯一），拒绝写盘' % (tag, n))
        return None
    print('  ✓ %s' % tag)
    return src.replace(old, new, 1)


# ============================================================
# A. domain.js —— 坐标与迁址（插在「征收」块之前）
# ============================================================
COORD_ANCHOR = """  /* ============================================================
   * 征收（v16 引入 · v24 需求 4/5 重构）"""

COORD_NEW = """  /* ============================================================
   * 城池坐标与迁址（v70 · 老板）
   * ------------------------------------------------------------
   * 老板三条：
   *   ① 「城池的主界面提供其坐标（500×500），自动确认」；
   *   ② 「一键随机当前城池坐标位置（除名城，名城固定）」；
   *   ③ 「为玩家城池提供坐标切换，移动到某坐标时，替换原地块建筑」
   *
   * 口径（唯一出口，界面与业务共用 —— 界面置灰与真执行读同一份判据）：
   *   · 可迁 = **自建城**（`type === 'self'`）。攻占来的名城/州郡县城带 origId，
   *     它的坐标是"历史上就在那里"的地理事实 → 固定（老板："除名城，名城固定"）。
   *   · 可迁入的坐标 = **平原**、界内（0~499）、且无任何占用
   *     （我方城 / 系统城 / 野外城池 / 已占野地）。与「平原筑城」同一条地形约束 ——
   *     自建城脚下必是平原，所以"旧地块还原"有确定答案：还回平原。
   *   · 「替换原地块建筑」= 旧坐标那格归还地图（恢复地形），新坐标那格成为城池。
   * ============================================================ */
  GAME.COORD_MAX = (DATA.MAP_W || 500) - 1;
  GAME.coordText = function (city) {
    if (!city) return '—';
    return '(' + city.x + ', ' + city.y + ')';
  };
  /* 可迁判据：自建城才可迁（名城 = 地理固定） */
  GAME.isMovableCity = function (city) {
    return !!(city && city.type === 'self');
  };
  /* 目标坐标是否可迁入 —— **唯一判据** */
  GAME.canCityMoveTo = function (city, x, y) {
    var s = GAME.state;
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    if (!GAME.isMovableCity(city)) {
      return { ok: false, msg: '名城地望固定 —— 只有自建城可以迁址' };
    }
    x = Math.round(Number(x)); y = Math.round(Number(y));
    if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x > GAME.COORD_MAX || y > GAME.COORD_MAX) {
      return { ok: false, msg: '坐标须在 0 ~ ' + GAME.COORD_MAX + ' 之间' };
    }
    if (city.x === x && city.y === y) return { ok: false, msg: '已在目标坐标上' };
    var own = GAME.map.ownCityAt(x, y);
    if (own) return { ok: false, msg: '该坐标已有我方城池「' + own.name + '」' };
    var npc = GAME.map.npcAt(x, y);
    if (npc) return { ok: false, msg: '该坐标为名城「' + npc.name + '」所据，不可占用' };
    var fort = GAME.map.fortAt(x, y);
    if (fort) return { ok: false, msg: '该坐标是野外城池「' + fort.name + '」，需先攻取' };
    var w = GAME.map.wildAt(x, y);
    if (w) return { ok: false, msg: '该坐标是已占野地，不可占用' };
    var t = GAME.map.tile(x, y);
    if (!t) return { ok: false, msg: '坐标越出地图' };
    if (t.terrain !== 'plain') {
      var tn = DATA.TERRAIN[t.terrain] ? DATA.TERRAIN[t.terrain].name : t.terrain;
      return { ok: false, msg: '只有**平原**可以立城（' + tn + ' 不可）' };
    }
    return { ok: true };
  };
  /* 迁址（唯一执行）：旧格归还地图 → 新址脚下变城池 → 坐标落定 */
  GAME.moveCityTo = function (cityId, x, y) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var chk = GAME.canCityMoveTo(city, x, y);
    if (!chk.ok) return chk;
    x = Math.round(Number(x)); y = Math.round(Number(y));
    var from = { x: city.x, y: city.y };
    /* ① 旧格归还：走「放弃城池」同一出口 restoreCityTile（自建城 → 还回平原） */
    GAME.restoreCityTile(city);
    /* ② 落新址 */
    city.x = x; city.y = y;
    var t = GAME.map.tile(x, y);
    if (t) t.terrain = 'city';
    GAME.log('📍 迁址：' + city.name + ' (' + from.x + ',' + from.y + ') → (' + x + ',' + y + ')');
    return { ok: true, msg: '已迁至 (' + x + ', ' + y + ')', city: city, from: from };
  };
  /* 掷一个可迁坐标（纯函数：rnd 可注入 → 测试确定；默认 Math.random） */
  GAME.randomCityCoord = function (city, rnd) {
    var rand = rnd || Math.random;
    var M = GAME.COORD_MAX;
    for (var i = 0; i < 400; i++) {
      var x = Math.floor(rand() * (M + 1)), y = Math.floor(rand() * (M + 1));
      if (GAME.canCityMoveTo(city, x, y).ok) return { x: x, y: y };
    }
    return null;
  };
  /* 一键随机（老板："一键随机当前城池坐标位置"） */
  GAME.randomMoveCity = function (cityId) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    if (!GAME.isMovableCity(city)) return { ok: false, msg: '名城地望固定 —— 只有自建城可以迁址' };
    var c = GAME.randomCityCoord(city);
    if (!c) return { ok: false, msg: '地图上暂无可迁的平原空地' };
    var r = GAME.moveCityTo(city.id, c.x, c.y);
    if (r.ok) r.msg = '🎲 已随机迁至 (' + c.x + ', ' + c.y + ')';
    return r;
  };

""" + COORD_ANCHOR

# ============================================================
# B. ui.js —— 城池属性栏坐标行 + 迁址弹窗
# ============================================================
ATTR_OLD = """        '<span class="val" style="font-weight:400;color:var(--text-dim);">[' + c.x + ',' + c.y + '] 官府Lv' +
          (GAME.buildingLevel(c, 'guanfu') || 1) + '</span></div>' +"""

ATTR_NEW = """        /* v70（老板）：「城池的主界面提供其坐标（500×500）… 一键随机… 坐标切换
           （除名城，名城固定）」—— 坐标常显；自建城给 🎲/📍 两个入口，
           名城（地理固定）只标注不可迁。两钮都走唯一出口 GAME.canCityMoveTo。 */
        '<span class="val" style="font-weight:400;color:var(--text-dim);">' +
          '500×500 · ' + GAME.coordText(c) + ' · 官府Lv' + (GAME.buildingLevel(c, 'guanfu') || 1) +
          (GAME.isMovableCity(c)
            ? ' <button class="btn sm" data-action="city-random" title="一键随机：迁到一处空闲平原">🎲</button>' +
              '<button class="btn sm" data-action="city-move-ask" title="坐标切换：输入坐标迁址">📍</button>'
            : ' <span style="opacity:.7">名城固定</span>') +
        '</span></div>' +"""

MOVEASK_ANCHOR = """  ui.openCityPanel = function (city) {"""

MOVEASK_NEW = """  /* v70（老板）：「为玩家城池提供坐标切换」—— 输入坐标迁址（唯一入口）。
     判据与执行都在 GAME.canCityMoveTo / moveCityTo（界面不自己判一遍）。 */
  ui.openCityMoveAsk = function (city) {
    var c = city || GAME.currentCity();
    if (!c) return;
    ui._cityMoveId = c.id;
    var movable = GAME.isMovableCity(c);
    ui.openModal(
      '<div class="gold-heading">📍 迁址 · ' + U.escape(c.name) + '</div>' +
      '<div class="note">迁址后：**原坐标那格归还地图**，新坐标成为你的城池。' +
        '只可迁到**平原**空地（界内 0 ~ ' + GAME.COORD_MAX + '）。名城地望固定，不可迁。</div>' +
      '<div class="attr"><span class="k">当前坐标</span><span class="v">' +
        GAME.coordText(c) + ' / 500×500</span></div>' +
      (movable
        ? '<div class="attr"><span class="k">迁往</span><span class="v">' +
            'X <input type="number" id="move-x" class="qty-input" style="width:76px;" min="0" max="' +
              GAME.COORD_MAX + '" value="' + c.x + '">　' +
            'Y <input type="number" id="move-y" class="qty-input" style="width:76px;" min="0" max="' +
              GAME.COORD_MAX + '" value="' + c.y + '"></span></div>'
        : '<div class="note">这座城是名城 —— 地望固定，不可迁址。</div>') +
      '<div class="modal-foot">' +
        (movable ? '<button class="btn gold" data-action="city-move-do">确认迁址</button>' : '') +
        '<button class="btn" data-action="close-modal">' + (movable ? '取消' : '关闭') + '</button></div>'
    );
  };

""" + MOVEASK_ANCHOR

# ============================================================
# C. main.js —— 三个 action + 两个 handler
# ============================================================
CASE_ANCHOR = """      case 'view': ui.setView(el.dataset.view); break;"""

CASE_NEW = """      /* v70（老板需求 3/4）：城池坐标 —— 一键随机 / 坐标切换 */
      case 'city-move-ask': ui.openCityMoveAsk(); break;
      case 'city-move-do': GAME.doCityMove(); break;
      case 'city-random': GAME.doRandomCityMove(); break;
      case 'view': ui.setView(el.dataset.view); break;"""

HANDLER_ANCHOR = """  GAME.doDismissGen = function (genId) {"""

HANDLER_NEW = """  /* v70（老板需求 3/4）：迁址（坐标切换）与一键随机 —— 唯一执行都走 GAME.moveCityTo */
  GAME.doCityMove = function () {
    var el1 = document.getElementById('move-x'), el2 = document.getElementById('move-y');
    var cur = GAME.currentCity();
    var id = ui._cityMoveId || (cur && cur.id);
    var r = GAME.moveCityTo(id, el1 ? el1.value : NaN, el2 ? el2.value : NaN);
    ui.toast(r.msg);
    if (r.ok) {
      ui.closeModal();
      if (ui.view === 'map' && ui.renderMapCanvas) ui.renderMapCanvas();
      GAME.refreshAll();
    }
  };
  GAME.doRandomCityMove = function () {
    var r = GAME.randomMoveCity();
    ui.toast(r.msg);
    if (r.ok) {
      if (ui.view === 'map' && ui.renderMapCanvas) ui.renderMapCanvas();
      GAME.refreshAll();
    }
  };

""" + HANDLER_ANCHOR

# ============================================================
# D. data.js —— 君主配置 + 特权表（框架）
# ============================================================
LORDDATA_ANCHOR = """  DATA.INITIAL_GENERAL = '赵子龙';"""

LORDDATA_NEW = """  DATA.INITIAL_GENERAL = '赵子龙';

  /* ============================================================
   * 君主将领（v70 · 老板：「增加一个角色将领（即玩家角色本身）」）
   * ------------------------------------------------------------
   * 资质选**名世**（当世罕有，可镇一方）：比招募池里的良材高一档、不到天授 ——
   * 君主强在"能镇场"，不强在碾压名将（名将仍要去招贤馆招）。
   * 六维取资质区间的中值（不掷骰，见 `GAME.makeLordGeneral`）。
   * ── 后续「普通将领不具备的功能」往 `LORD_TRAITS` 加行即可：
   *    将领档案里会渲染成「君主特权」；普通将领返回空数组、整块不显示。
   * ============================================================ */
  DATA.LORD_GEN = { rankId: 'ming', styleId: 'balance', level: 1 };
  DATA.LORD_TRAITS = [
    { id: 'undismissable', icon: '👑', name: '帐下不离',
      desc: '君主本人 —— 不可解雇，也不会因忠诚低下离去' },
  ];"""

# ============================================================
# E. state.js —— makeLordGeneral + 三个辅助出口（插在 makeHero 之前）
# ============================================================
LORDGEN_ANCHOR = """  /* 生成历史名将（野地抓将/占领名城必降） */"""

LORDGEN_NEW = """  /* ============================================================
   * 君主将领（v70 · 老板）—— 唯一出口
   * ------------------------------------------------------------
   * 老板原话：「增加一个角色将领（即玩家角色本身，具有将领的所有功能，
   *   但是不可解雇，留可扩张框架，后续将设计普通将领不具备的功能）」
   *
   * 口径：
   *   · 君主**就是一名将领**（进 `state.generals`，装备 / 出征 / 守将 / 派遣 /
   *     经验……全部功能照用），靠 `isLord` 一位区分；
   *   · 不可解雇（`GAME.dismissGeneral` 守卫）+ 不会因忠诚离去（两处离职判定守卫）；
   *   · 头像 seed 与顶栏君主头像**同源**（`ruler.portraitSeed`）——
   *     各摇一次就是两张脸，正是"创建界面头像与将领不一致"那一类问题的根因；
   *   · 君主**专属功能**的扩张点是 `DATA.LORD_TRAITS`（档案里渲染成「君主特权」）。
   * ============================================================ */
  GAME.isLordGeneral = function (g) { return !!(g && g.isLord); };
  /* 当前君主将领（无则 null —— 所有调用点都必须能接受 null） */
  GAME.lordGeneralOf = function () {
    var s = GAME.state, hit = null;
    ((s && s.generals) || []).forEach(function (g) { if (!hit && GAME.isLordGeneral(g)) hit = g; });
    return hit;
  };
  /* 君主专属能力清单（框架出口）：普通将领返回空数组 —— 界面据此整块不渲染 */
  GAME.lordTraitsOf = function (g) {
    return GAME.isLordGeneral(g) ? (DATA.LORD_TRAITS || []) : [];
  };
  GAME.makeLordGeneral = function (rulerOpts, seed, cityId) {
    var L = DATA.LORD_GEN || {};
    var r = rulerOpts || {};
    var g = GAME.makeGeneral(r.name || '君主', L.level || 1, 'idle',
      cityId || null, true, L.rankId, L.styleId);
    g.id = 'lord';                     /* 稳定 id：'lord' 不匹配 /^(g|cd)\\d+$/，不与 nextGenId 撞车 */
    g.isLord = true;
    g.name = r.name || g.name;
    g.gender = r.gender || 'male';
    g.portraitSeed = (seed != null) ? seed : GAME.portraits.seedOf(g);
    g.loyalty = 100;                   /* 永不离去（离职判定另有两处守卫） */
    g.salary = 0;                      /* 君主不领俸禄 */
    /* 六维取资质区间的**中值**（不掷骰、不吃 Math.random）：
       君主是玩家本人 —— 随机会让"老档迁移"读一次变一次，也无从比较两局；
       中值 = 该资质的标准水平，可复算、可断言。 */
    var rk = (DATA.GEN_RANK_BY_ID && DATA.GEN_RANK_BY_ID[L.rankId]) || DATA.GEN_RANK_BY_ID.liang;
    var style = DATA.GEN_STYLES[0];
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === L.styleId) style = x; });
    var mid = Math.round((rk.base[0] + rk.base[1]) / 2);
    g.tong = Math.round(mid * style.mul.tong);
    g.nz = Math.round(mid * style.mul.nz);
    g.yw = Math.round(mid * style.mul.yw);
    g.zm = Math.round(mid * style.mul.zm);
    return g;
  };

""" + LORDGEN_ANCHOR

# newGame：先算 lordSeed，再进 state；generals 追加君主
NG_SEED_OLD = """    var mapSeed = U.now() % 100000;
    GAME.state = {"""

NG_SEED_NEW = """    var mapSeed = U.now() % 100000;
    /* v70：君主头像 seed **只摇一次**，ruler 与君主将领共用 ——
       各摇一次就是两张脸（顶栏一个、将领页一个），正是"头像不一致"的根因。 */
    var lordSeed = rulerOpts.portraitSeed != null
      ? rulerOpts.portraitSeed
      : Math.floor(Math.random() * 4294967296);
    GAME.state = {"""

NG_PORTRAIT_OLD = """        portraitSeed: rulerOpts.portraitSeed != null
          ? rulerOpts.portraitSeed
          : Math.floor(Math.random() * 4294967296),
      },"""

NG_PORTRAIT_NEW = """        portraitSeed: lordSeed,
      },"""

NG_GENERALS_OLD = """      generals: [gen],"""
NG_GENERALS_NEW = """      /* v70（老板）：君主本人也是一位将领 —— 排在末尾，不动既有索引口径
         （`generals[0]` 仍是开局名将，测试与旧档迁移都按原样） */
      generals: [gen, GAME.makeLordGeneral(rulerOpts, lordSeed, city.id)],"""

# 离职判定两处守卫
DESERT1_OLD = """      s.generals = s.generals.filter(function (g) { return !(g.loyalty < lo.desertAt && Math.random() < lo.desertChancePerHour * hours); });"""

DESERT1_NEW = """      /* v70：君主不参与"忠诚离去"（老板「不可解雇」的另一半 —— 自己也不会走） */
      s.generals = s.generals.filter(function (g) {
        if (GAME.isLordGeneral(g)) return true;
        return !(g.loyalty < lo.desertAt && Math.random() < lo.desertChancePerHour * hours);
      });"""

DESERT2_OLD = """      /* 忠诚极低：有概率离去（名将更难留，但概率仍很低） */
      if ((g.loyalty == null ? 70 : g.loyalty) < lo.desertAt) {"""

DESERT2_NEW = """      /* 忠诚极低：有概率离去（名将更难留，但概率仍很低）
         v70：君主除外 —— 「不可解雇」的另一半是"自己不会走" */
      if (!GAME.isLordGeneral(g) && (g.loyalty == null ? 70 : g.loyalty) < lo.desertAt) {"""

# 老档迁移（插在存档迁移段之前）
MIG_ANCHOR = """      /* 存档迁移：旧默认倍率 30× → 120×（真实数值下 30× 读秒过慢） */"""

MIG_NEW = """      /* ---- v70 迁移：老档补一位「君主将领」（老板 2026-09-14）----
         老档的名单里没有玩家本人 —— 补一位（头像 seed 与 ruler 同源、归属首城）。
         新档（newGame 已建）命中 hasLord 时整段跳过，不会重复添人。 */
      (function () {
        var hasLord = false;
        ((st.generals) || []).forEach(function (g) { if (g && g.isLord) hasLord = true; });
        if (hasLord) return;
        var seed = (st.ruler && st.ruler.portraitSeed != null) ? st.ruler.portraitSeed : undefined;
        var home = (st.cities && st.cities[0]) ? st.cities[0].id : null;
        st.generals = st.generals || [];
        st.generals.push(GAME.makeLordGeneral(st.ruler || {}, seed, home));
      })();
""" + MIG_ANCHOR

# ============================================================
# F. domain.js —— 解雇守卫
# ============================================================
DISMISS_OLD = """    if (!g) return { ok: false, msg: '将领不存在' };
    if (g.status === 'march') return { ok: false, msg: g.name + ' 正在出征，不可解雇' };"""

DISMISS_NEW = """    if (!g) return { ok: false, msg: '将领不存在' };
    /* v70（老板）：「不可解雇」—— 君主本人（框架与守卫同源：GAME.isLordGeneral） */
    if (GAME.isLordGeneral(g)) return { ok: false, msg: '君主本人不可解雇' };
    if (g.status === 'march') return { ok: false, msg: g.name + ' 正在出征，不可解雇' };"""

# ============================================================
# G. ui.js —— 名单标「君主」+ 档案隐藏解雇 + 君主特权块
# ============================================================
ROW_BADGE_OLD = """        '<b class="grow-name">' + U.escape(g.name) +
          (g.hero ? '<span class="gcard-tag hero">名将</span>' : '') +"""

ROW_BADGE_NEW = """        '<b class="grow-name">' + U.escape(g.name) +
          (GAME.isLordGeneral(g) ? '<span class="gcard-tag lord">君主</span>' : '') +
          (g.hero ? '<span class="gcard-tag hero">名将</span>' : '') +"""

PANE_OPS_OLD = """          '<button class="btn sm' + (g.status === 'guard' ? ' red' : ' gold') + '" data-action="assign-guard" data-gen="' + genId + '">' +
            (g.status === 'guard' ? '解除守将' : '任命守将') + '</button>' +
          '<button class="btn sm" data-action="dismiss-gen" data-gen="' + genId + '">解雇</button>' +
        '</span>' +
      '</div>' +"""

PANE_OPS_NEW = """          '<button class="btn sm' + (g.status === 'guard' ? ' red' : ' gold') + '" data-action="assign-guard" data-gen="' + genId + '">' +
            (g.status === 'guard' ? '解除守将' : '任命守将') + '</button>' +
          /* v70（老板）：「不可解雇」—— 君主的档案里**不给解雇按钮**（守卫在域层，这里连入口都不给） */
          (GAME.isLordGeneral(g) ? '' :
            '<button class="btn sm" data-action="dismiss-gen" data-gen="' + genId + '">解雇</button>') +
        '</span>' +
      '</div>' +
      /* v70（老板）：「留可扩张框架」—— 君主特权清单（数据源 DATA.LORD_TRAITS，
         走 GAME.lordTraitsOf）。普通将领返回空数组 → 整块不渲染、不占高度。 */
      (GAME.lordTraitsOf(g).length
        ? '<div class="note" style="margin-top:4px;">👑 君主特权：' +
            GAME.lordTraitsOf(g).map(function (t) {
              return t.icon + ' <b>' + t.name + '</b> ' + t.desc;
            }).join('　') + '</div>'
        : '') +"""

# ============================================================
# H. index.html —— 君主标签色
# ============================================================
TAGVAR_OLD = """    --beauty-tag: #e08ab0;   /* v29：美人标（原写死在 .gcard-tag.beauty 里） */"""

TAGVAR_NEW = """    --beauty-tag: #e08ab0;   /* v29：美人标（原写死在 .gcard-tag.beauty 里） */
    --lord-tag: #e0b23c;     /* v70：君主标（玩家角色本人） */"""

TAGCSS_OLD = """  .gcard-tag.beauty { color: var(--beauty-tag); }"""

TAGCSS_NEW = """  .gcard-tag.beauty { color: var(--beauty-tag); }
  .gcard-tag.lord { color: var(--lord-tag); }"""

EDITS = [
    (DOMAIN, COORD_ANCHOR, COORD_NEW, 'A. 坐标与迁址（唯一出口 ×4）'),
    (UI, ATTR_OLD, ATTR_NEW, 'B1. 城池属性栏坐标行 + 两钮'),
    (UI, MOVEASK_ANCHOR, MOVEASK_NEW, 'B2. 迁址弹窗'),
    (MAIN, CASE_ANCHOR, CASE_NEW, 'C1. 三个 action'),
    (MAIN, HANDLER_ANCHOR, HANDLER_NEW, 'C2. 两个 handler'),
    (DATA, LORDDATA_ANCHOR, LORDDATA_NEW, 'D. 君主配置 + 特权表（框架）'),
    (STATE, LORDGEN_ANCHOR, LORDGEN_NEW, 'E1. makeLordGeneral + 三个出口'),
    (STATE, NG_SEED_OLD, NG_SEED_NEW, 'E2. lordSeed 只摇一次'),
    (STATE, NG_PORTRAIT_OLD, NG_PORTRAIT_NEW, 'E3. ruler.portraitSeed = lordSeed'),
    (STATE, NG_GENERALS_OLD, NG_GENERALS_NEW, 'E4. generals 追加君主'),
    (STATE, DESERT1_OLD, DESERT1_NEW, 'E5. 离线离职守卫'),
    (STATE, DESERT2_OLD, DESERT2_NEW, 'E6. 在线离职守卫'),
    (STATE, MIG_ANCHOR, MIG_NEW, 'E7. 老档迁移补君主'),
    (DOMAIN, DISMISS_OLD, DISMISS_NEW, 'F. 解雇守卫'),
    (UI, ROW_BADGE_OLD, ROW_BADGE_NEW, 'G1. 名单标「君主」'),
    (UI, PANE_OPS_OLD, PANE_OPS_NEW, 'G2. 档案：无解雇钮 + 君主特权'),
    (HTML, TAGVAR_OLD, TAGVAR_NEW, 'H1. --lord-tag 变量'),
    (HTML, TAGCSS_OLD, TAGCSS_NEW, 'H2. .gcard-tag.lord'),
]


def main():
    files = {}
    fails = []
    # 幂等总闸：任一处已改过就整脚本跳过后续（避免半改状态）
    probe = read(DOMAIN)
    if 'GAME.canCityMoveTo' in probe and 'GAME.isLordGeneral' in read(STATE):
        print('· 全部已改过（幂等跳过）')
        return 0
    for path, old, new, tag in EDITS:
        if path not in files:
            files[path] = read(path)
        res = cut(files[path], old, new, tag, optional=True)
        if res is None:
            fails.append(tag)
            continue
        files[path] = res
    for path, s in files.items():
        if not save_lf(path, s, os.path.basename(path)):
            fails.append(os.path.basename(path))
    print('')
    if fails:
        print('✗ 未完成：' + ', '.join(fails))
        return 1
    print('✓ 全部完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
