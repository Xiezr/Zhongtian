/* ============================================================
 * state.js — 世界状态与存档
 * ------------------------------------------------------------
 * 只放「世界是什么」，不放「世界怎么动」。后者在 engine.js。
 *
 * 一个格子 = 一层地形（航拍图）+ 可选一层地点（建筑立绘）。
 *   地形回答「走起来多难」  地点回答「来这一趟值不值」
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.DATA;
  var SAVE_KEY = 'new-wasteland-save-v1';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var S = null;
  var rng = null;

  function idx(x, y) { return y * DATA.MAP_W + x; }
  function inMap(x, y) { return x >= 0 && y >= 0 && x < DATA.MAP_W && y < DATA.MAP_H; }
  function tileAt(x, y) { return inMap(x, y) ? S.tiles[idx(x, y)] : null; }
  function dist(x1, y1, x2, y2) { return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2)); }
  function isAdjacent(x1, y1, x2, y2) { return dist(x1, y1, x2, y2) === 1; }

  function linePath(x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return null;
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
    var n = Math.max(Math.abs(dx), Math.abs(dy));
    var sx = Math.sign(dx), sy = Math.sign(dy);
    var out = [];
    for (var i = 1; i <= n; i++) out.push({ x: x1 + sx * i, y: y1 + sy * i });
    return out;
  }

  /* ---------- 格子的三个派生量（engine 与 ui 共用同一口径）---------- */
  function defOf(tile) { return tile ? DATA.TILES[tile.type] : null; }
  function siteOf(tile) { return (tile && tile.site) ? DATA.TILES[tile.site] : null; }

  function tileDanger(tile) {
    if (!tile) return 1;
    var d = (defOf(tile) || {}).danger || 0;
    if (tile.site) d += (siteOf(tile) || {}).danger || 0;
    if (tile.owner) d += 1;
    return Math.max(1, d);
  }

  function tileSupply(tile) {
    return (defOf(tile) || {}).supply || 1;
  }

  function tileHalt(tile) {
    return !!tile.site || !!((defOf(tile) || {}).halt);
  }

  function tileYield(tile) {
    var out = {};
    [defOf(tile), siteOf(tile)].forEach(function (d) {
      if (!d || !d.yield) return;
      Object.keys(d.yield).forEach(function (k) { out[k] = (out[k] || 0) + d.yield[k]; });
    });
    return out;
  }

  /* ---------- 地图生成 ---------- */
  function pickByWeight(r, ids, filter) {
    var pool = [], total = 0;
    ids.forEach(function (id) {
      var t = DATA.TILES[id];
      if (!t || !t.weight) return;
      if (filter && !filter(id, t)) return;
      total += t.weight;
      pool.push({ id: id, w: t.weight });
    });
    var v = r() * total;
    for (var i = 0; i < pool.length; i++) {
      v -= pool[i].w;
      if (v <= 0) return pool[i].id;
    }
    return pool.length ? pool[0].id : null;
  }

  function makeTile(terrainId, siteId) {
    return {
      type: terrainId,      // 地形 id（沿用 type 这个名字，别的地方都在用）
      site: siteId || null, // 地点 id
      lit: false,
      hint: '',
      owner: null,
      note: '',
      deadHere: null,
      raided: false
    };
  }

  function newWorld(seed) {
    rng = mulberry32(seed);
    S = {
      ver: 1,
      seed: seed,
      hour: 0,
      tiles: [],
      city: { name: '灰岗', food: 120, iron: 60, scrap: 40, pop: 60, seed: 0, tech: 0 },
      nextWinter: DATA.CONFIG.winterEvery,
      winters: 0,
      teams: [],
      memorial: [],
      factions: DATA.FACTIONS.map(function (f) {
        return { id: f.id, name: f.name, color: f.color, cells: 0, atGate: false };
      }),
      log: [],
      event: null,
      stats: { lost: 0, lit: 0, survived: 0, teams: 0 },
      seq: 1
    };

    for (var y = 0; y < DATA.MAP_H; y++) {
      for (var x = 0; x < DATA.MAP_W; x++) {
        var d = dist(x, y, DATA.CITY.x, DATA.CITY.y);
        /* 城边不放沙地（新手第一趟别就撞死线） */
        var terrain = pickByWeight(rng, DATA.TERRAIN_IDS, function (id) {
          return !(d <= 2 && id === 'desert');
        });
        var site = null;
        if (d >= 2 && rng() < 0.13) site = pickByWeight(rng, DATA.SITE_IDS);
        S.tiles[idx(x, y)] = makeTile(terrain, site);
      }
    }

    /* 城 */
    var c = S.tiles[idx(DATA.CITY.x, DATA.CITY.y)];
    c.type = 'plain';
    c.site = 'home';
    c.lit = true;
    c.note = '灰岗';
    revealAround(DATA.CITY.x, DATA.CITY.y, 1);

    /* ---------- 保证近处有东西可找 ----------
     * 纯随机的话，冬天可能变成无解的死线。
     * 所以按距离强制放两颗种子库、一个物资站。
     */
    function forceSite(type, minD, maxD) {
      var corners = [[2, 2], [12, 12], [12, 2]];
      for (var tries = 0; tries < 300; tries++) {
        var fx = 1 + Math.floor(rng() * (DATA.MAP_W - 2));
        var fy = 1 + Math.floor(rng() * (DATA.MAP_H - 2));
        var d = dist(fx, fy, DATA.CITY.x, DATA.CITY.y);
        if (d < minD || d > maxD) continue;
        if (corners.some(function (q) { return q[0] === fx && q[1] === fy; })) continue;
        var t = S.tiles[idx(fx, fy)];
        if (t.site === 'home' || t.owner) continue;
        t.site = type;
        t.note = '';
        return true;
      }
      return false;
    }
    forceSite('seed', 4, 6);
    forceSite('seed', 4, 6);
    forceSite('warehouse', 3, 4);

    /* 势力：三个角各一个据点 */
    var spots = [
      { x: 2, y: 2, f: 'rust' },
      { x: 12, y: 12, f: 'ash' },
      { x: 12, y: 2, f: 'caravan' }
    ];
    spots.forEach(function (sp) {
      var t = S.tiles[idx(sp.x, sp.y)];
      t.site = 'fort';
      t.owner = sp.f;
      t.lit = true;
      t.note = (DATA.FACTIONS.filter(function (f) { return f.id === sp.f; })[0] || {}).name || '据点';
    });

    makeTeam();

    log('第 ' + S.hour + ' 时 · 灰岗的灯还亮着。四周是黑的。', 'sys');
    log('第一小队在城门集合：八个人，六格补给。', 'sys');
    log('走一格要一格粮。沼泽要两格。走到第三格，就只剩回程。', 'dim');
    log('第 ' + DATA.CONFIG.winterEvery + ' 小时，冬天就来。城里没有种子。', 'warn');
    return S;
  }

  /* ---------- 半信息：点亮一格后，周围一圈给出「痕迹」 ---------- */
  function hintOf(tile) {
    if (tile.site) {
      return ({
        warehouse: '铁皮反光', seed: '白雾', town: '烟',
        bigcity: '高墙', capital: '灯光', fort: '旗', home: '灯'
      })[tile.site] || '人造物';
    }
    return ({
      plain: '风声', grass: '草动', forest: '树影', hill: '石头',
      lake: '水光', desert: '热浪', swamp: '水汽'
    })[tile.type] || '风声';
  }

  function revealAround(x, y, r) {
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        var t = tileAt(x + dx, y + dy);
        if (!t || t.lit) continue;
        if (!t.hint) t.hint = hintOf(t);
      }
    }
  }

  function reveal(x, y) {
    var t = tileAt(x, y);
    if (!t) return;
    if (!t.lit) {
      t.lit = true;
      t.hint = '';
      S.stats.lit++;
      revealAround(x, y, 1);
    }
  }

  /* ---------- 队伍 ---------- */
  function randName() {
    var s = DATA.SURNAMES[Math.floor(rng() * DATA.SURNAMES.length)];
    var g = DATA.GIVEN[Math.floor(rng() * DATA.GIVEN.length)];
    return s + g;
  }

  function makeTeam() {
    var n = S.teams.length;
    var army = {};
    Object.keys(DATA.CONFIG.defaultArmy).forEach(function (k) {
      army[k] = DATA.CONFIG.defaultArmy[k];
    });
    var t = {
      id: 'T' + (S.seq++),
      name: DATA.TEAM_NAMES[n] || ('第' + (n + 1)),
      army: army,                       /* 编成：{兵种 id: 数量} */
      men: countMen(army),
      vets: 0,
      supply: maxSupplyOf(army),
      maxSupply: maxSupplyOf(army),
      x: DATA.CITY.x,
      y: DATA.CITY.y,
      status: 'home',
      roster: []
    };
    for (var i = 0; i < t.men; i++) t.roster.push({ name: randName(), vet: false });
    S.teams.push(t);
    S.stats.teams++;
    return t;
  }

  /* 编制上限随年份长：活过一个冬天，城里就能多养两个单位。
     这是「每年推进」唯一的数值回报，也是打旧都的前提。 */
  function capacityNow() {
    return DATA.CONFIG.capacity + (S.winters || 0) * 2;
  }

  function countMen(army) {
    var n = 0;
    Object.keys(army || {}).forEach(function (k) { n += army[k]; });
    return n;
  }

  function armyPop(army) {
    var p = 0;
    Object.keys(army || {}).forEach(function (k) {
      var u = DATA.UNITS[k];
      if (u) p += u.pop * army[k];
    });
    return p;
  }

  function maxSupplyOf(army) {
    var s = DATA.CONFIG.teamSupply;
    Object.keys(army || {}).forEach(function (k) {
      var u = DATA.UNITS[k];
      if (u) s += u.haul * army[k];
    });
    return s;
  }

  /* 一条编成的四个轴。tile 可选：给了就按遮蔽地形打折。 */
  function armyStats(army, tile) {
    var covered = tile ? (DATA.COVERED.indexOf(tile.site || tile.type) >= 0) : false;
    var out = { fire: 0, armor: 0, scout: 0, haul: 0, men: 0, pop: 0 };
    Object.keys(army || {}).forEach(function (id) {
      var u = DATA.UNITS[id];
      if (!u) return;
      var n = army[id];
      var f = u.fire;
      if (u.range >= 900) f *= covered ? DATA.COVER_FAR : DATA.OPEN_FAR;
      else if (u.range <= 100) f *= covered ? DATA.COVER_MELEE : DATA.OPEN_MELEE;
      out.fire += f * n;
      out.armor += u.armor * n;
      out.scout += u.scout * n;
      out.haul += u.haul * n;
      out.men += n;
      out.pop += u.pop * n;
    });
    out.fire = Math.round(out.fire * 10) / 10;
    out.armor = Math.round(out.armor * 10) / 10;
    return out;
  }

  function teamStats(t, tile) {
    var st = armyStats(t.army, tile);
    st.fire = Math.round(st.fire * (1 + (t.vets || 0) * 0.06) * 10) / 10;
    return st;
  }

  /* 队伍图标：取数量最多的那个兵种 */
  function leadUnitOf(army) {
    var best = null, bestN = -1;
    Object.keys(army || {}).forEach(function (id) {
      if (army[id] > bestN) { bestN = army[id]; best = id; }
    });
    return (DATA.UNITS[best] && DATA.UNITS[best].img) || 'assets/icon/buxingji.png';
  }

  function teamPower(t) { return t.men + t.vets * DATA.CONFIG.vetBonus; }

  /* ---------- 日志 ---------- */
  function log(text, kind) {
    S.log.unshift({ h: S.hour, text: text, kind: kind || 'info' });
    if (S.log.length > 120) S.log.length = 120;
  }

  /* ---------- 存档 ---------- */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; }
    catch (e) { return false; }
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.ver !== 1 || !s.tiles || s.tiles.length !== DATA.MAP_W * DATA.MAP_H) return null;
      S = s;
      rng = mulberry32(s.seed + s.hour);
      return S;
    } catch (e) { return null; }
  }

  function reset(seed) {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    return newWorld(seed || 20261021);
  }

  global.STATE = {
    S: function () { return S; },
    set: function (s) { S = s; },
    rng: function () { return rng; },
    idx: idx, inMap: inMap, tileAt: tileAt, dist: dist,
    isAdjacent: isAdjacent, linePath: linePath,
    defOf: defOf, siteOf: siteOf,
    tileDanger: tileDanger, tileSupply: tileSupply, tileHalt: tileHalt, tileYield: tileYield,
    newWorld: newWorld, makeTeam: makeTeam, teamPower: teamPower,
    armyStats: armyStats, teamStats: teamStats, armyPop: armyPop,
    countMen: countMen, maxSupplyOf: maxSupplyOf, leadUnitOf: leadUnitOf,
    capacityNow: capacityNow,
    reveal: reveal, revealAround: revealAround,
    log: log, save: save, load: load, reset: reset,
    randName: randName
  };
})(window);
