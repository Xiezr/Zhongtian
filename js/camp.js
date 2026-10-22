/* ============================================================
 * camp.js — 幸存者营地（v92.4 / v93 第一块）
 * ------------------------------------------------------------
 * 起因（docs/玩法提案-从进度条到选择.md 第 7 节）：
 *   「**人口与探索绑定**：新人口来自幸存者营地 —— 一次解决两件事：
 *     兵源变稀缺 + 探索有回报」。
 *
 * 老板诊断（同一份文档）：
 *   「兵源无限不是数值问题，是**损失不可逆**这个前提被抹掉了。」
 *   而"不可逆"不能用"调死亡剂量"来做（老板：「不要被数值困住」）。
 *
 * 所以这里给的是**情境**，不是数值：
 *   地图上散落着幸存者营地。点亮才看得见。走到跟前只有两个选择 ——
 *   **招募**（带走人，长期变成兵）或 **抢夺**（拿走物资，但风声传开，
 *   之后的营地会警惕你，招募到的人一次比一次少）。
 *
 * ⚠️ 刻意不做的事：
 *   · 不改 `POP_CFG.fillHours`（补员速度）—— 那会同时推翻 6 处既有断言，
 *     且"补给慢"是惩罚思维，老板明确不要。营地带的是**净增量**，不是减速。
 *   · 不给"抢"扣战力/扣民心 —— 名声只体现为**后面的人不愿意跟你走**，
 *     这才是代价的形状，不是罚单。
 *   · 不做随机刷新 —— 营地是哈希生成的固定地标，同一颗球永远那几个。
 *     "找得到"才有意义，"刷出来"只是资源点。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var C = GAME.camp = {};
  var U = GAME.utils;          /* core.js 先于本模块求值（bundle 顺序保证） */

  var _list = null;      /* 候选营地 ci 列表（按球面 seed 缓存） */
  var _listSeed = -1;
  var _sweepAt = 0;      /* 上次扫描（现实毫秒）——节流用 */

  function SP() { return (GAME.sphereOf ? GAME.sphereOf()
    : (GAME.mapSphere || GAME.sphere))   /* v98.6：`GAME.sphereOf()` 是**既有**出口（state.js：按 pid 取那颗星球的球面，
      默认当前星球 → 返回有 cells 的 GAME.sphere）。
      原来的 `GAME.mapSphere || GAME.sphere` 在玩家**还没打开地图**时是致命的：
      mapSphere 对象存在但没 build，`||` 不生效 → 拿到空球 → 村社/遗迹/势力/竞争者全空。 */; }
  function data() { return (GAME.DATA && GAME.DATA.CAMP) || {}; }

  /* 确定性哈希：同一颗球、同一格，永远是同一个结果。
     ⚠️ 刻意**不用** `GAME.map._fortHashCi` —— 它带日盐（野地等级每天漂移要用）。
     营地是"固定地标"：带盐的哈希会让 `list()`（缓存）与 `at()`（实时）脱钩，
     表现为"列表里有、点开说这里没有营地"。这里只吃 (ci, seed)。 */
  function h(ci, salt) {
    var x = (ci * 2654435761 + salt * 40503) >>> 0;
    x ^= x >>> 13; x = (x * 1274126177) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /* 该格是不是营地 / 是哪一档。渲染与点击都走这一个出口。 */
  C.at = function (ci) {
    var s = SP();
    if (!s || !s.cells) return null;
    var cell = s.cells[ci];
    if (!cell) return null;
    /* 海里没有幸存者 —— 也省掉一大半候选 */
    /* ⚠️ v93.4 修正：**海洋的 type 是 'lake'**（sphere.js cellType：
       原文 `if (e < 0) return 'lake';` 后面跟着的注释写的是「海 → 湖泊」）。
       这里原来写的是 'sea' / 'ocean' —— 那两个值**整个项目都不存在**，
       于是"海里不生成"从来没有生效过（营地 v92.4 起就错了，村社照抄）。
       表现为水面上有村子/营地/遗迹。 */
    if (cell.type === 'lake') return null;
    var sd = (s.seed3 ? s.seed3() : 0) | 0;
    if (h(ci, sd + 8101) >= (data().chance || 0.004)) return null;
    var _r = h(ci, sd + 8102);
    var tiers = data().tiers || [];
    var t = tiers[Math.min(tiers.length - 1, Math.floor(_r * tiers.length))];
    if (!t) return null;
    return { ci: ci, tier: t.id, name: t.name, pop: t.pop, loot: t.loot };
  };

  /* 候选列表（缓存）—— 扫描只走这几十上百个格，不遍历 40962 */
  C.list = function () {
    var s = SP();
    if (!s || !s.cells) return [];
    var sd = (s.seed3 ? s.seed3() : 0) | 0;
    if (_list && _listSeed === sd) return _list;
    var out = [];
    var n = s.cells.length;
    for (var ci = 0; ci < n; ci++) {
      var cell = s.cells[ci];
      if (!cell) continue;
      if (cell.type === 'lake') continue;
      if (h(ci, sd + 8101) < (data().chance || 0.004)) out.push(ci);
    }
    _list = out; _listSeed = sd;
    return out;
  };

  /* 已发现的营地（state.camps） */
  C.found = function () { return ((GAME.state || {}).camps) || {}; };

  /* 某格是否已发现（渲染用：未发现不画） */
  C.isFound = function (ci) {
    return !!C.found()[ci];
  };

  /* ============================================================
   * sweep —— 把"已探明但还没登记"的营地收进账
   * ------------------------------------------------------------
   * 为什么不是"点亮那一刻回调"：一次 revealAround 半径 6 要点 127 格，
   * 每格回调一次哈希判断会把 fog 的热路径拖慢。这里改成节流扫描：
   * 候选只有一两百个，5 秒扫一次几乎零成本。
   * ============================================================ */
  C.sweep = function (force) {
    var st = GAME.state;
    if (!st || !GAME.fog) return 0;
    var now = Date.now();
    if (!force && now - _sweepAt < 5000) return 0;
    _sweepAt = now;
    var list = C.list();
    if (!list.length) return 0;
    st.camps = st.camps || {};
    var got = 0;
    for (var i = 0; i < list.length; i++) {
      var ci = list[i];
      if (st.camps[ci]) continue;
      if (GAME.fog.get(ci) <= 0) continue;        /* 没探明就当不知道 */
      var w = C.at(ci);
      if (!w) continue;
      st.camps[ci] = { tier: w.tier, mode: null, at: now };
      got++;
      if (GAME.log && GAME.log.war) {
        GAME.log.war('🏕 发现幸存者营地：' + w.name + '（地图上标了金点 · 点击可交涉）');
      }
    }
    if (got) {
      /* 迷雾层要重画（营地标记挂在 flags 上，靠 _flVer 触发重建） */
      if (GAME.map3d && GAME.map3d.rebuild) { /* 不整场重建，只让标记失效 */ }
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    }
    return got;
  };

  /* 离该格最近的我方城（营地归属：谁先到算谁的） */
  C.cityNearOf = function (ci) {
    var st = GAME.state;
    if (!st) return null;
    var s = SP();
    if (!s || !s.distOf) return GAME.currentCity ? GAME.currentCity() : null;
    var best = null, bd = 1e9;
    (st.cities || []).forEach(function (c) {
      if (!c || c.npc) return;
      var d = s.distOf({ ci: c.ci }, { ci: ci });
      if (d < bd) { bd = d; best = c; }
    });
    return best || (GAME.currentCity ? GAME.currentCity() : null);
  };

  /* 风声：抢过几次，后面的人就多警惕几分（叠减，封顶） */
  C.waryMul = function () {
    var st = GAME.state || {};
    var n = st.campRaids || 0;
    var d = data();
    var per = d.waryPerRaid != null ? d.waryPerRaid : 0.08;
    var floor = d.waryFloor != null ? d.waryFloor : 0.2;
    return Math.max(floor, 1 - n * per);
  };

  /* ============================================================
   * act —— 交涉：招募 或 抢夺
   * ------------------------------------------------------------
   * 这是整个模块唯一的"决策点"，也是废土内核（牺牲）落地的地方：
   *   招募 = 带走人（兵源），但拿不到物资；
   *   抢夺 = 拿走物资（即时），但风声传开，后面招到的人越来越少。
   * 两个都对，看你要什么。
   * ============================================================ */
  C.act = function (ci, mode) {
    var st = GAME.state;
    if (!st) return { ok: false, msg: '无存档' };
    var w = C.at(ci);
    if (!w) return { ok: false, msg: '这里没有营地' };
    st.camps = st.camps || {};
    var rec = st.camps[ci];
    if (!rec) return { ok: false, msg: '还没发现这处营地' };
    if (rec.mode) return { ok: false, msg: '这处营地已经处理过了' };

    if (mode === 'recruit') {
      var city = C.cityNearOf(ci);
      if (!city) return { ok: false, msg: '附近没有己方城市' };
      /* v92.8：年景（B5）—— 丰年多来三成，疫年闭门。风声与年景相乘。 */
      /* v93.3：农具图纸（拓荒队带回的）→ 招得到更多人。
         v93.1：名声 → 屠夫招不到人（他们听说了），仁名有人主动跟来。 */
      var mul = C.waryMul()
        * (GAME.yearMulOf ? GAME.yearMulOf('campMul') : 1)
        * (GAME.convoy && GAME.convoy.toolMul ? GAME.convoy.toolMul() : 1)
        * (GAME.renown ? GAME.renown.willFollow() : 1);
      var n = Math.max(1, Math.round(w.pop * mul));
      /* 人口走既有出口：直接加到存量的 pop（不超上限）*/
      var cap = GAME.effPopCapOf ? GAME.effPopCapOf(city) : (GAME.maxPopOf ? GAME.maxPopOf(city) : 0);
      /* ⚠️ v93.5 修既存 bug：人口在 `GAME.res(city).pop`，不是 `city.pop`。
         从 v92.4 起这里的"招募 +N 人"一直加到一个不存在的字段上 ——
         玩家从来没真的多过一个人，而 §289 的断言也跟着读了同一个错字段，全绿。 */
      var RC = GAME.res(city);
      var before = RC.pop || 0;
      RC.pop = Math.min(cap || (before + n), before + n);
      var got = Math.round(RC.pop - before);
      rec.mode = 'recruit';
      rec.n = got;
      rec.cityId = city.id;
      rec.at = Date.now();
      return { ok: true, msg: '从' + w.name + '带回 ' + got + ' 名幸存者（' + city.name + '）'
        + (mul < 0.999 ? '　· 风声已传开，只招到七成' : ''), n: got, cityId: city.id };
    }

    if (mode === 'raid') {
      var co = GAME.currentCity ? GAME.currentCity() : null;
      var loot = GAME.battle && GAME.battle.resolveTarget ? null : null;
      rec.mode = 'raid';
      rec.at = Date.now();
      st.campRaids = (st.campRaids || 0) + 1;
      /* v93.1：洗劫进"名声"总账 —— 以前它只影响营地这一个局部乘数，
         现在世界会记住（纳贡要多付、村社不愿跟你走）。 */
      if (GAME.renown) GAME.renown.add('cruelty', GAME.renown.W.raidCamp);
      /* 资源按品类平摊，走既有资源出口 */
      var keys = ['grain', 'wood', 'stone', 'iron'];
      var per = Math.max(1, Math.round((w.loot || 0) / keys.length));
      var added = [];
      keys.forEach(function (k) {
        if (co) { co.res = co.res || {}; co.res[k] = (co.res[k] || 0) + per; }
        added.push(k);
      });
      var later = C.waryMul();
      return { ok: true, msg: '洗劫了' + w.name + '：粮木石铁各 +' + U.numText(per, 0)
        + '　· 消息传开，之后招募只剩 ' + Math.round(later * 100) + '%', loot: per };
    }

    return { ok: false, msg: '未知的处理方式' };
  };

  /* 界面用的一行摘要 */
  C.lineOf = function (ci) {
    var w = C.at(ci);
    if (!w) return '';
    var rec = C.found()[ci];
    if (!rec) return w.name + '（未发现）';
    if (rec.mode === 'recruit') return w.name + ' · 已招募 ' + U.numText(rec.n || 0, 0) + ' 人';
    if (rec.mode === 'raid') return w.name + ' · 已被洗劫';
    return w.name + ' · 待交涉（招 ' + U.numText(Math.round(w.pop * C.waryMul()), 0)
      + ' 人 / 抢 ' + U.numText(w.loot || 0, 0) + ' 物资）';
  };
})();
