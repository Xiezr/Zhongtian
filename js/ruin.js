/* ============================================================
 * ruin.js — 旧世界遗迹（v92.7 · 构想 A4 遗物埋点 + A9 遗迹剧情）
 * ------------------------------------------------------------
 * 文档原话：
 *   A4「特定格埋遗物/图纸，先点亮 + 满足条件才能挖」
 *   A9「点亮特定区域触发故事（废弃实验室/旧时代纪念碑/幸存者营地）」
 *   第 5 节「叙事选择 ❌ 无（叙事层 v89.218 已删）」—— 这一栏是空的。
 *
 * 和营地（camp.js）的分工：
 *   · 营地 = 人。招人 or 抢物资，代价是名声。
 *   · 遗迹 = **旧世界的东西**。同一处遗迹只能翻一次，翻了这边就没有那边。
 *
 * 取舍在哪（"放弃测试"）：
 *   每处遗迹两个翻法，**互斥**：拿材料的就没有资源，拿资源的就没有材料。
 *   越远的遗迹越富（`tierMulOf`）—— 探索的回报落在产出上，而不是另一个加成。
 *
 * ⚠️ 刻意不做：不给图纸/科技（`DATA.BLUEPRINT` 与科技链都有自己的口径，
 *   在这里塞一份会造出第二个产出源）。遗迹给的是**材料与资源**，
 *   交给现有的锻造/建造去消耗。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var R = GAME.ruin = {};
  var U = GAME.utils;

  var _list = null, _listSeed = -1, _sweepAt = 0;

  function SP() { return GAME.mapSphere || GAME.sphere; }
  function data() { return (GAME.DATA && GAME.DATA.RUIN) || {}; }

  /* 纯哈希（只吃 ci + seed）：遗迹是固定地标，同一颗球永远那几个 */
  function h(ci, salt) {
    var x = (ci * 2654435761 + salt * 40503) >>> 0;
    x ^= x >>> 13; x = (x * 1274126177) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  R.at = function (ci) {
    var s = SP();
    if (!s || !s.cells) return null;
    var cell = s.cells[ci];
    if (!cell) return null;
    if (cell.type === 'sea' || cell.type === 'ocean') return null;
    var sd = (s.seed3 ? s.seed3() : 0) | 0;
    if (h(ci, sd + 9101) >= (data().chance || 0.0025)) return null;
    var kinds = data().kinds || [];
    if (!kinds.length) return null;
    var k = kinds[Math.floor(h(ci, sd + 9102) * kinds.length) % kinds.length];
    if (!k) return null;
    return { ci: ci, kind: k.id, name: k.name, flavor: k.flavor, a: k.a, b: k.b };
  };

  R.list = function () {
    var s = SP();
    if (!s || !s.cells) return [];
    var sd = (s.seed3 ? s.seed3() : 0) | 0;
    if (_list && _listSeed === sd) return _list;
    var out = [], n = s.cells.length;
    for (var ci = 0; ci < n; ci++) {
      var cell = s.cells[ci];
      if (!cell) continue;
      if (cell.type === 'sea' || cell.type === 'ocean') continue;
      if (h(ci, sd + 9101) < (data().chance || 0.0025)) out.push(ci);
    }
    _list = out; _listSeed = sd;
    return out;
  };

  R.found = function () { return ((GAME.state || {}).ruins) || {}; };
  R.isFound = function (ci) { return !!R.found()[ci]; };

  /* 远处更富：探索的回报落在产出上，而不是给个加成 */
  R.tierMulOf = function (ci) {
    var s = SP();
    var pc = GAME.currentCity ? GAME.currentCity() : null;
    if (!s || !pc || pc.ci == null || pc.ci < 0) return 1;
    var d = s.distOf({ ci: pc.ci }, { ci: ci });
    return 1 + Math.min(1.5, d / 40);          /* 40 格外封顶 +150% */
  };

  /* 与营地同一套节流扫描：候选只有几十处，5 秒扫一次几乎零成本 */
  R.sweep = function (force) {
    var st = GAME.state;
    if (!st || !GAME.fog) return 0;
    var now = Date.now();
    if (!force && now - _sweepAt < 5000) return 0;
    _sweepAt = now;
    var list = R.list();
    if (!list.length) return 0;
    st.ruins = st.ruins || {};
    var got = 0;
    for (var i = 0; i < list.length; i++) {
      var ci = list[i];
      if (st.ruins[ci]) continue;
      if (GAME.fog.get(ci) <= 0) continue;
      var w = R.at(ci);
      if (!w) continue;
      st.ruins[ci] = { kind: w.kind, side: null, at: now };
      got++;
      if (GAME.log && GAME.log.war) {
        GAME.log.war('🏚 发现旧世界遗迹：' + w.name + '（地图上标了青点 · 点击可翻找）');
      }
    }
    if (got && GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    return got;
  };

  /* ============================================================
   * act —— 翻找：两种互斥的拿法
   * ------------------------------------------------------------
   * a = 材料（锻造用）· b = 资源（建造用）· 少数是人口。
   * 选了一个，另一个就永远拿不到了 —— 这就是"放弃"。
   * ============================================================ */
  R.act = function (ci, side) {
    var st = GAME.state;
    if (!st) return { ok: false, msg: '无存档' };
    var w = R.at(ci);
    if (!w) return { ok: false, msg: '这里没有遗迹' };
    st.ruins = st.ruins || {};
    var rec = st.ruins[ci];
    if (!rec) return { ok: false, msg: '还没发现这处遗迹' };
    if (rec.side) return { ok: false, msg: '这处遗迹已经翻过了' };
    var pick = side === 'a' ? w.a : (side === 'b' ? w.b : null);
    if (!pick) return { ok: false, msg: '未知的翻找方式' };
    var city = (GAME.camp && GAME.camp.cityNearOf) ? GAME.camp.cityNearOf(ci)
      : (GAME.currentCity ? GAME.currentCity() : null);
    if (!city) return { ok: false, msg: '附近没有己方城市' };

    var mul = R.tierMulOf(ci);
    var out = [];
    if (pick.mat) {
      var n = Math.max(1, Math.round((pick.n || 8) * mul));
      GAME.items.add(pick.mat, n);
      var md = GAME.DATA.MATERIAL_BY_ID && GAME.DATA.MATERIAL_BY_ID[pick.mat];
      out.push((md ? md.name : pick.mat) + '×' + n);
    }
    if (pick.res) {
      city.res = city.res || {};
      Object.keys(pick.res).forEach(function (k) {
        var v = Math.max(1, Math.round(pick.res[k] * mul));
        city.res[k] = (city.res[k] || 0) + v;
        out.push(({ grain: '粮', wood: '木', stone: '石', iron: '铁' }[k] || k) + '+' + U.numText(v, 0));
      });
    }
    if (pick.pop) {
      var cap = GAME.effPopCapOf ? GAME.effPopCapOf(city) : (GAME.maxPopOf ? GAME.maxPopOf(city) : 0);
      var before = city.pop || 0;
      city.pop = Math.min(cap || (before + pick.pop), before + Math.round(pick.pop * mul));
      out.push('幸存者 +' + U.numText(Math.round(city.pop - before), 0));
    }
    if (pick.grain) {
      /* 有代价的选项：粮食不够就不给做（说清楚，别静默扣成负数）*/
      var need = Math.round(pick.grain * mul);
      if (((city.res || {}).grain || 0) < need) {
        return { ok: false, msg: '要养活他们得先有 ' + U.numText(need, 0) + ' 粮 —— 现在不够' };
      }
      city.res.grain -= need;
      out.push('粮 −' + U.numText(need, 0));
    }

    rec.side = side;
    rec.at = Date.now();
    rec.got = out.join('、');
    return { ok: true, msg: '在' + w.name + '翻出：' + out.join('、') };
  };

  R.lineOf = function (ci) {
    var w = R.at(ci);
    if (!w) return '';
    var rec = R.found()[ci];
    if (!rec) return w.name + '（未发现）';
    if (rec.side) return w.name + ' · 已翻找（' + (rec.got || '') + '）';
    return w.name + ' · 待翻找（' + w.a.label + ' / ' + w.b.label + '）';
  };
})();
