/* v156.25：把「转身轴」的判据写进 seatProp 与 surfaceQuad 两处，防止未来各改一半导致分叉。
 * 纯注释改动，零行为变化。
 * 用法：node .workbuddy/tools/patch/patch_axis_note.js
 */
'use strict';
var fs = require('fs');
var p = 'js/map3d.js';
var s = fs.readFileSync(p, 'utf8');

if (s.indexOf('v156.25') >= 0) { console.log('SKIP'); process.exit(0); }

/* ---- 1) seatProp：说明与 surfaceQuad 等价 + 为什么必须绕局部轴 ---- */
var oldSeat = `  /* 把一件物品坐到某格上：+Y 对法线、贴地表、再绕竖轴转 yaw（度）。 */
  function seatProp(g, ci, yawDeg) {`;
if (s.indexOf(oldSeat) < 0) { console.error('seat anchor missing'); process.exit(1); }

var newSeat = `  /* 把一件物品坐到某格上：+Y 对法线、贴地表、再绕竖轴转 yaw（度）。
     ============================================================
     v156.25：这里与 \`surfaceQuad(ci, yaw)\` **数学等价**（实测 |dot|=1.000000000000，
       上轴偏差 5e-16 = 浮点噪声；见 .workbuddy/tools/show/probe_axis_equiv.js）：
         setFromUnitVectors(up, n)  → 「对齐」四元数
         rotateY(θ)                 → **局部轴**右乘（three 的实现就是 q × qY）
       和 surfaceQuad 里 \`q × qY(局部)\` 是同一个式子，只是写法不同。
     ⛔ 唯一要守的判据：**转身永远绕局部轴**。
       反例（v156.19 城堡朝向错乱的真因）：\`q.multiply(绕世界法线\`n\`的四元数)\`。
       四元数右乘是"先转右边、再转左边" —— 拿世界轴当右边，等于先把物体上轴
       从法线上掰开、再用 q 拉回来，于是每座城随机歪 0~90°（实测 18.6° / 142°）。
     以后若要合并这两处：**整段替换 + 跑探针复验**，不要"顺手"把 rotateY
       换成绕世界轴的写法 —— 那种改动看起来更"对称"，但它就是上面那个 bug。
     ============================================================ */
  function seatProp(g, ci, yawDeg) {`;
s = s.replace(oldSeat, newSeat);

/* ---- 2) surfaceQuad：反向指路（读到这里的人知道还有另一处等价实现） ---- */
var oldQ = `  /* 把 +Y 对到 dir（基座 ⟂ 半径），再绕**自身竖轴**转 yawDeg 度。返回 [x,y,z,w]。 */`;
if (s.indexOf(oldQ) >= 0) {
  s = s.replace(oldQ, `  /* 把 +Y 对到 dir（基座 ⟂ 半径），再绕**自身竖轴**转 yawDeg 度。返回 [x,y,z,w]。
     v156.25：\`seatProp()\` 是同一件事的另一种写法（setFromUnitVectors + rotateY），
       两者实测完全等价 —— 改这里时请一并看那处的注释（判据：转身只绕局部轴）。 */`);
}

fs.writeFileSync(p, s, 'utf8');
console.log('patched map3d.js: 轴判据注释（零行为变化）');
