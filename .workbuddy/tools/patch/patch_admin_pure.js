/* v156.24b：把 adminCiList 的过滤逻辑抽成**纯函数** `adminCisOf(fields, level, index)`，
 * 让 node 门禁（没有 three、`_settle` 为空）也能真测到逻辑，而不是只能做源码匹配。
 * 用法：node .workbuddy/tools/patch/patch_admin_pure.js
 */
'use strict';
var fs = require('fs');
var p = 'js/map.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('GAME.map.adminCisOf = function') >= 0) { console.log('SKIP'); process.exit(0); }

var oldFn = `  /* level: 'prov' | 'market' | 'district'；index: 该级序号。返回格索引数组（可能为空数组）。 */
  GAME.map.adminCiList = function (level, index) {
    var f = GAME.map.adminFields();
    if (!f || index == null || index < 0) return null;
    var arr = level === 'prov' ? f.prov : level === 'market' ? f.market : level === 'district' ? f.district : null;
    if (!arr) return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) if (arr[i] === index) out.push(i);
    return out;
  };`;

if (s.indexOf(oldFn) < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }

var newFn = `  /* ============================================================
   * **过滤逻辑本体（纯函数，无副作用、不碰 three）**
   * ------------------------------------------------------------
   * 为什么单独拆出来：行政区数据（provOf/marketOf/districtOf）只在浏览器里
   *   由 \`genSettlements()\` 生成；而"按 level+index 取格清单"这一步是纯数组操作。
   *   拆开后，node 门禁可以喂构造数组验证**过滤是否正确**（含越界/串级/乱 level），
   *   不必等浏览器——这是这个功能唯一能在 CI 里守住的部分。
   * fields: {prov, market, district} 三个 Int16Array/数组（-1 = 无归属）
   * level : 'prov' | 'market' | 'district'
   * index : 该级序号（>= 0）
   * 返回：格索引数组；fields/level/index 非法 → null（**区分"没有这种级别"与"这一格都没有"**）
   * ============================================================ */
  GAME.map.adminCisOf = function (fields, level, index) {
    if (!fields || index == null || index < 0) return null;
    var arr = level === 'prov' ? fields.prov
      : level === 'market' ? fields.market
        : level === 'district' ? fields.district : null;
    if (!arr || !arr.length) return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) if (arr[i] === index) out.push(i);
    return out;
  };

  /* level: 'prov' | 'market' | 'district'；index: 该级序号。返回格索引数组（可能为空数组）。 */
  GAME.map.adminCiList = function (level, index) {
    return GAME.map.adminCisOf(GAME.map.adminFields(), level, index);
  };`;

s = s.replace(oldFn, newFn);
fs.writeFileSync(p, s, 'utf8');
console.log('patched map.js: adminCisOf (pure) + adminCiList (wrapper)');
