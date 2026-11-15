/* v157.54 取证探针 · 近地面左键长按拖拽「画面元素剧烈跳动」
 * ------------------------------------------------------------------
 * 纯数学复刻，不加载 three.js / 不碰游戏状态 / 不改任何文件。
 * 对照 `js/map3d.js` 的两条实现：
 *   BEFORE = 6479-6505 现行「锚点抓取平移」：每帧从**当前相机**射线求交地面，
 *            T = 按下时的锚点 − 当前光标命中点，相机 += T（输入依赖自己的输出）。
 *   AFTER  = 冻结基准的纯增量：T = 鼠标增量 × 按下时一次算定的尺度，
 *            无射线、无反馈、按眼高限幅、非有限值跳过。
 *
 * ⚠️ AFTER 是**独立数学复刻**（不同实现路径才叫独立复核）；产品实现由
 *    smoke §601 真调 `GAME.map3d.panBasisOf / panStepOf` 验证，两条证据互补。
 *
 * 三张表：
 *   A 掠射病态：俯角 → 每像素地面位移 / 手抖 3px 的单帧位移 / 相对眼高倍数
 *   B 90 帧带手抖轨迹：before/after 的单帧位移与波动
 *   C 构造性证明：反馈回路的反证**不能用「换相机起点」**——
 *                 现行公式里起点在 `anchor − p1` 中恰好抵消（实测差 0，首版判据因此假红）。
 *                 正确对照 = 「逐帧累积相机位移」vs「每帧都从初始相机重算」：
 *                 两者逐帧差 >0 才证明输入真的依赖自己的输出；改后两者应完全相同。
 * 判据一律带下限，防「0===0」平凡解（项目铁律 §0.4）。
 * 用法：node .workbuddy/tools/probe/probe_v15754_pan_stability.js
 */
'use strict';

var EYE = 1.7;            /* M.SURF_EYE：地表眼高（米） */
var R = 300;              /* 球半径，只用于 C 段的半径偏移换算 */
var PX_ANG = 0.0012;      /* 一像素对应的视角变化（rad）≈ 0.069° */
var FRAMES = 90;          /* 数据下限 */
var JITTER = 1;           /* 手抖幅度（像素）—— 长按拖动时的真实量级 */
var LIMIT_BEFORE = 40;    /* 现行代码写死的单帧位移上限（6488 行） */
var LIMIT_AFTER = EYE * 0.5;   /* 改后：单帧不超过半个眼高 */

function fmt(n) { return (Math.round(n * 1000) / 1000).toFixed(3); }

/* 解析：鼠标横向/纵向每像素对应的地面位移（米）。
   横向 = h·PX_ANG/tanθ；纵向 = h·PX_ANG/sin²θ —— 后者在 θ→0 时爆炸。 */
function sens(thetaDeg) {
  var t = thetaDeg * Math.PI / 180, s = Math.sin(t), c = Math.cos(t);
  return { lateral: EYE * PX_ANG * c / s, forward: EYE * PX_ANG / (s * s) };
}

/* 生成一条固定轨迹：匀速右拖 + 上下手抖。两次模拟共用同一串输入。 */
function track() {
  var out = [], mx = 400, my = 300;
  for (var f = 0; f < FRAMES; f++) {
    var dx = 2 + ((f % 3) - 1) * JITTER;
    var dy = (f % 7 < 4 ? 1 : -1) * JITTER;
    mx += dx; my += dy;
    out.push({ dx: dx, dy: dy, mx: mx, my: my });
  }
  return out;
}

/* BEFORE：每帧从当前相机重新射线求交，锚点在按下时固定，一步全补 */
function beforeRun(tiltDeg, trk, startX, startZ, noFeedback) {
  /* noFeedback=true：每帧都从初始相机重算命中点（不累积上一帧位移）。
     与累积版逐帧对照，才能证明「输入依赖自己的输出」这条回路真的存在。 */
  var theta = tiltDeg * Math.PI / 180;
  var cam = { x: startX, z: startZ };
  var d0 = EYE / Math.tan(theta);
  var anchor = { x: startX, z: startZ + d0 };
  var out = [], miss = 0;
  for (var f = 0; f < trk.length; f++) {
    var s = trk[f];
    var th = theta - (s.my - 300) * PX_ANG;
    if (th <= 0.002) { miss++; out.push({ x: 0, z: 0 }); continue; }
    var d = EYE / Math.tan(th);
    var phi = (s.mx - 400) * PX_ANG;
    var px = (noFeedback ? startX : cam.x) + d * Math.tan(phi);
    var pz = (noFeedback ? startZ : cam.z) + d;
    var T = { x: anchor.x - px, z: anchor.z - pz };
    var tl = Math.hypot(T.x, T.z);
    if (tl > LIMIT_BEFORE) { T.x *= LIMIT_BEFORE / tl; T.z *= LIMIT_BEFORE / tl; }
    out.push(T);
    cam.x += T.x; cam.z += T.z;
  }
  return { steps: out, miss: miss };
}

/* AFTER：按下时冻结尺度 k（带上限），之后位移只由鼠标增量决定 */
function afterRun(tiltDeg, trk, startX, startZ) {
  var theta = tiltDeg * Math.PI / 180;
  var s = Math.max(0.02, Math.sin(theta));
  var k = Math.min(0.25, EYE * PX_ANG / s);       /* 一次算定，全程不变 */
  var out = [], miss = 0;
  for (var f = 0; f < trk.length; f++) {
    var q = trk[f];
    var T = { x: -q.dx * k, z: -q.dy * k * 0.5 };
    if (!isFinite(T.x) || !isFinite(T.z)) { miss++; out.push({ x: 0, z: 0 }); continue; }
    var tl = Math.hypot(T.x, T.z);
    if (tl > LIMIT_AFTER) { T.x *= LIMIT_AFTER / tl; T.z *= LIMIT_AFTER / tl; }
    out.push(T);
  }
  return { steps: out, miss: miss, k: k };
}

function stats(run) {
  var mx = 0, sum = 0, arr = [];
  for (var i = 0; i < run.steps.length; i++) {
    var v = Math.hypot(run.steps[i].x, run.steps[i].z);
    arr.push(v); sum += v; if (v > mx) mx = v;
  }
  var mean = sum / arr.length;
  return { max: mx, mean: mean, arr: arr, miss: run.miss };
}

function maxSeqDiff(a, b) {
  var m = 0;
  for (var i = 0; i < a.arr.length; i++) m = Math.max(m, Math.abs(a.arr[i] - b.arr[i]));
  return m;
}
/* 位移方向反转次数：相邻两帧位移向量点积 < 0 = 画面来回抽（老板说的「跳动」）。 */
function reversals(run) {
  var n = 0;
  for (var i = 1; i < run.steps.length; i++) {
    var a = run.steps[i - 1], b = run.steps[i];
    if (a.x * b.x + a.z * b.z < 0) n++;
  }
  return n;
}

var trk = track();
var tiltNear = 2;      /* 近地面：贴地平视 ≈ 2°（map3d.js:5439 明写 agl=眼高时俯角≈0.3°） */
var tiltHigh = 42;     /* 建造俯视 ≈ 42°（884 行注释） */

console.log('=== A · 掠射病态解析表 ===');
console.log('俯角(°)  横向每px(米)  纵向每px(米)  手抖3px单帧(米)  ÷眼高');
[42, 20, 10, 5, 2, 1].forEach(function (deg) {
  var q = sens(deg);
  var j = q.forward * 3;
  console.log('  ' + String(deg).padStart(5) + '   ' + fmt(q.lateral).padStart(11) + '   ' +
    fmt(q.forward).padStart(11) + '   ' + fmt(j).padStart(13) + '   ' + fmt(j / EYE).padStart(7));
});
var amp = sens(2).forward / sens(42).forward;

console.log('\n=== B · 90 帧带手抖轨迹（近地面 2°）===');
var bN = stats(beforeRun(tiltNear, trk, 0, 0));
var aN = stats(afterRun(tiltNear, trk, 0, 0));
var bH = stats(beforeRun(tiltHigh, trk, 0, 0));
console.log('BEFORE 近地面 : max=' + fmt(bN.max) + ' 米  mean=' + fmt(bN.mean) + '  ÷眼高=' + fmt(bN.max / EYE) + '  miss=' + bN.miss);
console.log('BEFORE 高空42°: max=' + fmt(bH.max) + ' 米  mean=' + fmt(bH.mean) + '  ÷眼高=' + fmt(bH.max / EYE) + '  miss=' + bH.miss);
console.log('AFTER  近地面 : max=' + fmt(aN.max) + ' 米  mean=' + fmt(aN.mean) + '  ÷眼高=' + fmt(aN.max / EYE) + '  miss=' + aN.miss + '  k=' + fmt(aN.k !== undefined ? aN.k : afterRun(tiltNear, trk, 0, 0).k));

console.log('\n=== C · 反馈回路是否断开（累积 vs 不累积，同一串鼠标输入）===');
var bNF = stats(beforeRun(tiltNear, trk, 0, 0, true));
var aNF = stats(afterRun(tiltNear, trk, 0, 0, true));
var dB = maxSeqDiff(bN, bNF), dA = maxSeqDiff(aN, aNF);
console.log('BEFORE 累积 vs 不累积：最大逐帧差 = ' + fmt(dB) + ' 米  （>0 = 输入依赖自己的输出）');
console.log('AFTER  累积 vs 不累积：最大逐帧差 = ' + fmt(dA) + ' 米  （=0 = 回路已断）');
/* 辅助对照（不作判据）：换起点在现行公式里恰好抵消，改后天然无关 */
var bFar = stats(beforeRun(tiltNear, trk, 120, -80));
var aFar = stats(afterRun(tiltNear, trk, 120, -80));
console.log('辅助 · 换起点(120,-80)：BEFORE ' + fmt(maxSeqDiff(bN, bFar)) +
  ' / AFTER ' + fmt(maxSeqDiff(aN, aFar)) + ' 米');

/* D · `_zoomTarget` 拉扯：现行 _panDrag 写 camO.dist = |相机位置|，
   却没调 _syncZoom()；_zoomDamp 每帧按 kk=1-exp(-16/70) 拉回旧目标。 */
var kk = 1 - Math.exp(-16 / 70);
var deltaPlanar = 40;                       /* 一帧最多平移 40 米 */
var radialShift = Math.sqrt(R * R + deltaPlanar * deltaPlanar) - R;
console.log('\n=== D · 缩放阻尼拉扯（现行代码缺 _syncZoom 的后果）===');
console.log('单帧平移 ' + deltaPlanar + ' 米 → 球心距偏移 ' + fmt(radialShift) +
  ' 米（眼高的 ' + fmt(radialShift / EYE) + ' 倍）；阻尼每帧回拉 ' + fmt(kk * 100) + '% 到旧目标');
console.log('→ 方向已变、半径被逐帧拽回：地面/标记/云层整体跳动');

console.log('\n=== 判据（带下限，防平凡解）===');
var revB = reversals(beforeRun(tiltNear, trk, 0, 0));
var revA = reversals(afterRun(tiltNear, trk, 0, 0));
var P = [
  ['A 放大比 ≥100 倍（近地面病态确实存在，非 0===0）', amp >= 100, fmt(amp)],
  ['B 数据下限：帧数 ≥60、两套模拟都真的跑了', trk.length >= 60 && bN.arr.length === 90 && aN.arr.length === 90, String(trk.length)],
  ['B 改前近地面单帧位移 ≥1 倍眼高（确实会剧烈跳）', bN.max / EYE >= 1, fmt(bN.max / EYE)],
  ['B 改前近地面 ≫ 高空（解释「有时候」= 只在贴地时出现）', bN.max > bH.max * 5, fmt(bN.max / Math.max(1e-9, bH.max))],
  ['B 改后单帧位移 ≤0.5 倍眼高（有界）', aN.max / EYE <= 0.5, fmt(aN.max / EYE)],
  ['B 改前位移方向确实反转（反证：画面来回抽）', revB > 0, String(revB)],
  ['B 改后位移方向反转 0 次（不来回跳）', revA === 0, String(revA)],
  ['C 数据下限：对照两套模拟都真跑了 90 帧', bNF.arr.length === 90 && aNF.arr.length === 90, String(bNF.arr.length + '/' + aNF.arr.length)],
  ['C 改后位移与「是否累积」无关（回路已断）', dA === 0, fmt(dA)],
  ['C 改前确实与「是否累积」有关（反证：回路存在）', dB > 0.01, fmt(dB)],
  ['C 改后位移与相机起点无关', maxSeqDiff(aN, aFar) === 0, fmt(maxSeqDiff(aN, aFar))],
  ['D 半径偏移 > 眼高（拉扯量级真实）', radialShift / EYE > 1, fmt(radialShift / EYE)]
];
var bad = 0;
P.forEach(function (p) { console.log((p[1] ? '  ✅ ' : '  ❌ ') + p[0] + '  [实测 ' + p[2] + ']'); if (!p[1]) bad++; });
console.log('\n结论：' + (bad === 0 ? '病态确认成立，改后构造上有界' : bad + ' 条判据未过 —— 不要据此改代码'));
process.exit(0);
