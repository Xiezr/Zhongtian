/* v156.23（老板「占领省市区首府，可以看到该省市区下辖地的视野」）
 * 在 map.js 里加「格 → 州」的**唯一出口**，供 fog 按州点亮。
 * 做法：复用已有的 `_countyField()`（多源 BFS，格 → 最近聚落 ci，随 seed 缓存），
 *   再把「聚落 → 州」查表接上。于是全图每格都有**唯一**州属，州界就是
 *   「离哪座城的聚落在谁家辖区」的自然分界，不需要另写一套平面划界
 *   （平面矩形划界会和球面投影打架，历史上已经踩过）。
 * 用法：node .workbuddy/tools/patch/patch_state_field.js
 */
'use strict';
var fs = require('fs');
var p = 'js/map.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('GAME.map._stateField = function') >= 0) {
  console.log('SKIP: _stateField already present');
  process.exit(0);
}

var anchor = `  /* 聚落 ci → 该聚落城的**近邻重镇**（同州最近 jun，按聚落缓存）。O(1) 摊还。 */`;
if (s.indexOf(anchor) < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

var block = `  /* ============================================================
   * v156.23（老板「占领省市区首府，可以看到该省市区下辖地的视野」）
   * ------------------------------------------------------------
   * **格 → 州** 的唯一出口。州界从哪来：直接复用上面的 \`_countyField()\` ——
   *   它已经把全图每格 BFS 到"最近聚落"，而聚落自带 \`state\`，于是
   *   「这格归哪个州」= 「离我最近的聚落属于哪个州」。全图天然有唯一归属，
   *   且与地图/城市布局同源（改城不改界），不需要另一套平面矩形划界
   *   （平面矩形在球面上会和投影打架 —— 城堡朝向那轮已经吃过这个亏）。
   * 一次 O(nv) 建表（约 4 万格），随 seed 缓存；查询 O(1)。
   * ⚠️ 与 \`_countyField\` 同生共死：seed 变了必须重建（这里按 seed 判等）。
   * ============================================================ */
  GAME.map._stateField = function () {
    var s = GAME.state, SP = GAME.sphere;
    if (!s || !SP || !SP.cells || !SP.adj) return null;
    var seed = (s.map && s.map.seed) || 1;
    var cch = GAME.map._stateF;
    if (cch && cch.seed === seed) return cch;
    var f = GAME.map._countyField();
    if (!f) return null;
    var byCi = (GAME.map._cntyF && GAME.map._cntyF.byCi) || {};
    var nv = SP.nv, of = new Int32Array(nv), names = [], idxOf = {};
    var i, k, owner, c, st;
    for (i = 0; i < nv; i++) {
      owner = f[i];
      c = owner >= 0 ? byCi[owner] : null;
      st = (c && c.state) ? c.state : '';
      if (!st) { of[i] = -1; continue; }
      k = idxOf[st];
      if (k == null) { k = names.length; idxOf[st] = k; names.push(st); }
      of[i] = k;
    }
    /* 反查表：每州的格索引清单（点亮时只遍历本州，不扫全图） */
    var cells = [], j;
    for (j = 0; j < names.length; j++) cells.push([]);
    for (i = 0; i < nv; i++) if (of[i] >= 0) cells[of[i]].push(i);
    GAME.map._stateF = { seed: seed, of: of, names: names, idxOf: idxOf, cells: cells };
    return GAME.map._stateF;
  };

  /* 州名 → 该州辖下所有格（数组；州不存在 → null）。O(1) 查表。 */
  GAME.map.stateCiList = function (stateName) {
    if (!stateName) return null;
    var f = GAME.map._stateField();
    if (!f) return null;
    var k = f.idxOf[stateName];
    return (k == null) ? null : f.cells[k];
  };

  /* 格 → 州名（'' = 无归属）。用于面板与断言。 */
  GAME.map.stateAt = function (ci) {
    var f = GAME.map._stateField();
    if (!f || ci == null || ci < 0 || ci >= f.of.length) return '';
    var k = f.of[ci];
    return k >= 0 ? f.names[k] : '';
  };

  /* 州 → 下辖城镇清单（首府/重镇/聚落；按 DATA 静态表 + 当前 NPC 表取并集）。
     用于「占领首府后，告诉玩家这一州到底有几座城」。 */
  GAME.map.stateCities = function (stateName) {
    var out = [];
    if (!stateName) return out;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c && c.state === stateName) out.push(c);
    });
    return out;
  };

`;

s = s.replace(anchor, block + anchor);
fs.writeFileSync(p, s, 'utf8');
console.log('patched map.js: _stateField / stateCiList / stateAt / stateCities');
