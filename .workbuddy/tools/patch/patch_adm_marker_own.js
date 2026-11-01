/* v156.24c：已被我方占据的行政中心城，不再画成紫色敌方城。
 * 现象（实测 probe_adm_marker.js）：占领省府后该格 cellKind 已是 'own'，
 *   但 M._settles.adm 仍留着它 → buildTowns 会在同一格再立一座紫色行政城模型，
 *   叠在己方城模型上 —— 玩家看到的是"我打下了省府，可地图上它还是敌方的样子"。
 * 用法：node .workbuddy/tools/patch/patch_adm_marker_own.js
 */
'use strict';
var fs = require('fs');
var p = 'js/map3d.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('_ownAdmKey') >= 0) { console.log('SKIP: already patched'); process.exit(0); }

var old = `    /* 行政中心城 = 紫色（按球面质心方向取格）*/
    (M.admCities || []).forEach(function (c) { var ci = (c.ci != null && c.ci >= 0) ? c.ci : nearestCell(c._cent); if (ci >= 0) { mark[ci] = [180, 120, 210]; cellKind[ci] = 'adm'; cellRef[ci] = c;
      settles.adm.push({ ci: ci, lv: c.lv || 4 }); } });`;

if (s.indexOf(old) < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

var neu = `    /* 行政中心城 = 紫色（按球面质心方向取格）
       ═══ v156.24（老板「占领省市区首府」）═══
       已被我方占据的行政中心**不再画成紫色**：
       否则同一格会同时出现"己方城的蓝标记"和"行政城的紫模型"（两座模型叠在一起），
       玩家看到的是"我打下了省府，可地图上它还是敌方的样子"。
       判据与下面的 own 分支同源（都读 mapSliceOf().cities），不另立一套。 */
    var _ownAdmKey = {};
    ((GAME.mapSliceOf() || {}).cities || []).forEach(function (c) {
      if (c && c.admLevel && c.admIndex != null) _ownAdmKey[c.admLevel + '|' + c.admIndex] = 1;
    });
    (M.admCities || []).forEach(function (c) {
      if (_ownAdmKey[c.admLevel + '|' + c.admIndex]) return;    /* 已占 → 交给 own 分支画 */
      var ci = (c.ci != null && c.ci >= 0) ? c.ci : nearestCell(c._cent); if (ci >= 0) { mark[ci] = [180, 120, 210]; cellKind[ci] = 'adm'; cellRef[ci] = c;
        settles.adm.push({ ci: ci, lv: c.lv || 4 }); } });`;

s = s.replace(old, neu);
fs.writeFileSync(p, s, 'utf8');
console.log('patched map3d.js: 已占行政城不再画紫色');
