/* 验证：seatProp 的「setFromUnitVectors + rotateY」与 surfaceQuad 是否数学等价。
 *   若等价 → 只是口径重复（防分叉），不是 bug；
 *   若不等价 → 是漏网的真 bug（又一处"随机歪"）。
 * 纯数学，不需要 three。
 * 用法：node .workbuddy/tools/show/probe_axis_equiv.js
 */
'use strict';
global.window = global;
function anyObj() {
  return new Proxy(function () { }, {
    get: function (t, k) {
      if (k === 'classList') return { add: function () { }, remove: function () { }, toggle: function () { }, contains: function () { return false; } };
      if (k === 'style' || k === 'dataset') return {};
      if (k === 'getContext') return function () { return null; };
      if (k === 'appendChild' || k === 'removeChild' || k === 'addEventListener' || k === 'setAttribute') return function () { };
      if (k === 'children' || k === 'childNodes') return [];
      if (k === 'width' || k === 'height' || k === 'clientWidth' || k === 'clientHeight') return 100;
      if (k === 'textContent' || k === 'innerHTML' || k === 'value') return '';
      if (k === 'querySelector') return function () { return anyObj(); };
      if (k === 'querySelectorAll') return function () { return []; };
      return anyObj();
    },
    set: function () { return true; }, apply: function () { return anyObj(); }
  });
}
global.document = anyObj();
global.localStorage = { getItem: function () { return null; }, setItem: function () { }, removeItem: function () { } };
require('E:/Deepseekdb/js/bundle-core.js');
try { require('E:/Deepseekdb/js/bundle-war.js'); } catch(e){}
try { require('E:/Deepseekdb/js/bundle-ui.js'); } catch(e){ console.log('ui load: '+e.message); }

var M = global.GAME && global.GAME.map3d;
if (!M || typeof M.surfaceQuad !== 'function') { console.log('FAIL: surfaceQuad 不可用'); process.exit(1); }

/* ---- three 的两个算法，按源码解析式手写（避免引 three）---- */
function norm(a) { var L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function qmul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}
/* Quaternion.setFromUnitVectors(from, to) 的 three 源码逻辑 */
function setFromUnitVectors(from, to) {
  var r = dot(from, to) + 1;
  if (r < 1e-8) {
    r = 0;
    if (Math.abs(from[0]) > Math.abs(from[2])) return norm4([-from[1], from[0], 0, r]);
    return norm4([0, -from[2], from[1], r]);
  }
  var c = cross(from, to);
  return norm4([c[0], c[1], c[2], r]);
}
function norm4(q) { var L = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / L, q[1] / L, q[2] / L, q[3] / L]; }
/* Object3D.rotateY(angle) = quaternion.multiply(绕局部 Y 的四元数) */
function rotateY(q, ang) {
  var h = ang / 2;
  return norm4(qmul(q, [0, Math.sin(h), 0, Math.cos(h)]));
}
/* 四元数把向量转出去 */
function apply(q, v) {
  var x = q[0], y = q[1], z = q[2], w = q[3];
  var ix = w * v[0] + y * v[2] - z * v[1];
  var iy = w * v[1] + z * v[0] - x * v[2];
  var iz = w * v[2] + x * v[1] - y * v[0];
  var iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x
  ];
}

var dirs = [[0, 1, 0], [1, 0, 0], [0, 0, -1], [-0.415, 0.291, 0.862], [-0.964, 0.198, 0.175], [0.3, -0.8, 0.5]];
var yaws = [0, 37, -90, 137, 288];
var worstQ = 0, worstUp = 0, worstCase = '';

dirs.forEach(function (d) {
  var n = norm(d);
  yaws.forEach(function (yw) {
    /* A：surfaceQuad（唯一出口） */
    var qA = M.surfaceQuad(d, yw);
    /* B：seatProp 的写法 —— setFromUnitVectors((0,1,0), n) 然后 rotateY(rad) */
    var qB = rotateY(setFromUnitVectors([0, 1, 0], n), yw * Math.PI / 180);
    /* 四元数 ±q 等价 → 取 |dot| 判断 */
    var dq = Math.abs(dot4(qA, qB));
    if (dq < worstQ || worstCase === '') { /* 保留最小值 */ }
    if (worstCase === '' || dq < worstQ) { worstQ = dq; worstCase = 'dir=' + JSON.stringify(d) + ' yaw=' + yw; }
    /* 上轴是否仍垂直法线 */
    var upA = apply(qA, [0, 1, 0]), upB = apply(qB, [0, 1, 0]);
    var e = Math.hypot(upA[0] - upB[0], upA[1] - upB[1], upA[2] - upB[2]);
    if (e > worstUp) worstUp = e;
  });
});
function dot4(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; }

console.log('四元数最小一致度 |dot| = ' + worstQ.toFixed(12) + '  （1 = 完全相同）');
console.log('上轴最大偏差          = ' + worstUp.toExponential(3));
console.log('最差样本：' + worstCase);
console.log(worstQ > 1 - 1e-9 ? '结论：**完全等价** —— seatProp 不是 bug，只是第二份实现' : '结论：**不等价** —— seatProp 是真 bug');
