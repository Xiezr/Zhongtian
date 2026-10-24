/* ============================================================
 * scene3d.js — 2.5D 场景运行时（v140 · 老板 2026-10-24）
 * ------------------------------------------------------------
 * 老板原话：
 *   「目前前20级还是 PPT，这不是个正经游戏。做场景，玩家在地图上自由走动：
 *     1）采集：出来一片可发掘的废墟、砍伐的林地、收割的庄稼等。
 *     2）垂钓，出来一个垂钓场景。
 *     3）拜访，出来一个拜访背景，要求 2.5D 或 3D，类似星露谷界面，
 *        风格为废土科技或匹配的场景风格。456……要求建立 10 个场景，
 *        不只是放 PPT 那种，是 3D 场景宝贝。」
 *
 * 这个文件解决的就是「点了按钮只弹一行字」的问题：**真进一个地方，自己走，走到东西旁边动手**。
 *
 * ══════════════════════════════════════════════════════════════
 * 一、为什么是正交相机 + 固定倾角（而不是透视、也不是真第一人称）
 * ══════════════════════════════════════════════════════════════
 * 星露谷那种视角的本质是**正交投影 + 45°~55° 俯角**：
 *   · 正交没有近大远小，物件大小恒定 → 玩家能读"距离"和"格子"；
 *   · 固定倾角 → 不用转镜头，WASD 的方向与屏幕永远一致，不需要玩家学操作；
 *   · 透视会把远处压扁，俯视行走反而晕。
 * 相机跟随玩家（简单 lerp），但**不旋转** —— 旋转会让"上=北"失效，
 * 在只有 WASD 的操作里是纯粹的负担。
 *
 * ══════════════════════════════════════════════════════════════
 * 二、为什么不复用 map3d 的 renderer
 * ══════════════════════════════════════════════════════════════
 * map3d 的 renderer 绑在离屏 canvas 上，还带着 globe/云层/标记一整套状态，
 * 且它的 rAF 与"当前星球"强耦合。场景要能独立进出（进 20 次、退 20 次不泄漏），
 * 所以自己一个 renderer + 自己一条 rAF，只在场景开着时跑。
 *
 * ══════════════════════════════════════════════════════════════
 * 三、美术从哪来：**全部程序化**，零外链
 * ══════════════════════════════════════════════════════════════
 * 项目是纯静态、断网可跑（vendor 里只有 three 本体），assets 下只有奇迹的 glb。
 * 所以场景里的断墙、树、芦苇、钓台、帐篷、辐能塔……**全部由 three 的基本体拼**：
 *   Box / Cylinder / Cone / Icosahedron / Plane + 顶点色 + 一张程序生成的噪声贴图。
 * 好处不只是"没有资源依赖"：
 *   · 每个场景只有 ~60 个 Mesh，手机也跑得动；
 *   · 换配色即换风格（废土橙锈 / 辐光青 / 夜紫），10 个场景共用一套道具库；
 *   · 想加第 11 个场景 = 加一条配置，不用等美术。
 *
 * ══════════════════════════════════════════════════════════════
 * 四、交互闭环：**只走一条结算出口**
 * ══════════════════════════════════════════════════════════════
 * 场景里动手 → 调 `G.prologue.act(ci, actId)`（前传既有出口：扣精力体力、掷骰、给辐能核心/经验）。
 * 场景**不自己算产出**。以前的教训（v136 斗将 HP 与比分两本账）就是"呈现层偷偷算了一份"，
 * 那种 bug 查起来极贵。这里场景只负责"你走到了没有"。
 *
 * ══════════════════════════════════════════════════════════════
 * 五、10 个场景（`S.list()` 可查）
 * ══════════════════════════════════════════════════════════════
 *   ruin   废墟发掘   · 断墙/钢筋/碎石堆 → 采集、清剿
 *   forest 林地砍伐   · 活树/枯树/伐木桩   → 采集
 *   field  庄稼收割   · 麦垄/稻草人/水桶   → 采集
 *   lake   临湖垂钓   · 水面/钓台/芦苇     → 垂钓（lake_scene）
 *   hamlet 村社拜访   · 土屋/院墙/篝火     → 拜访
 *   trial  旧世试炼场 · 石门/石阶/图腾     → 试炼
 *   camp   掠夺者营地 · 帐篷/栅栏/火堆     → 清剿
 *   spire  辐能塔     · 塔身/光柱/晶体     → 静修
 *   market 荒野市集   · 摊位/灯串/货箱     → 情报（拜访）
 *   crash  坠机残骸   · 机身/机翼/散落箱   → 搜刮（采集）
 * ============================================================ */
(function () {
  /* ⚠️ 不要写 `var D = DATA;` —— `DATA` 在 bundle 里**不是全局**（各模块内部自己取），
     拼进 IIFE 后这一行直接 ReferenceError，而它在包的最外层，
     一抛就会把后面的 main.js 一起打断（实测：创角界面根本不出现）。
     统一走 `GAME.DATA`（data.js 在 ORDER 里排在 scene3d 之前，此处一定已就绪）。 */
  var G = GAME, D = GAME.DATA || {};
  var U = GAME.utils;   /* `U` 也不是全局：每个模块自己 `var U = GAME.utils;`（prologue.js:37 同） */
  var S = G.scene3d = {};

  /* ============================================================
   * 0. 调色板（废土科技）
   * ------------------------------------------------------------
   * 颜色只在这里定义一次 —— 换风格改这一处，10 个场景一起变。
   * ============================================================ */
  var C = {
    rust: 0xb4622f, rustDark: 0x7a3f1e,
    iron: 0x3a4048, steel: 0x6b7684, steelLight: 0x9aa6b4,
    moss: 0x5a6b4a, mossDark: 0x36432c,
    sand: 0x8a7a52, ash: 0x6a6258,
    bone: 0xa89b84, wood: 0x6b533a, woodDark: 0x483824,
    glow: 0x4fd1c5, neon: 0xffb347, blood: 0xa8332a,
    water: 0x2b4d5a, wheat: 0xc9a64a,
  };
  var _matCache = {};
  function lam(c, extra) {
    /* 同色同参数复用材质：60 个 Mesh 能压到 ~15 个材质，draw 状态切换少一半 */
    var k = c + '|' + (extra ? JSON.stringify(extra) : '');
    if (_matCache[k]) return _matCache[k];
    var o = { color: c };
    if (extra) for (var q in extra) o[q] = extra[q];
    var m = new THREE.MeshLambertMaterial(o);
    _matCache[k] = m;
    return m;
  }
  function mesh(geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    if (x != null) m.position.set(x, y || 0, z || 0);
    m.castShadow = false; m.receiveShadow = false;
    return m;
  }
  /* 确定性随机：同一场景每次进来长得一样（否则"记住路"这件事不成立） */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
  }

  /* ============================================================
   * 1. 道具库（全部基本体拼装，每个函数返回一个 Group）
   * ============================================================ */

  function gTree(scale, dead) {
    var g = new THREE.Group(), s = scale || 1;
    var trunkH = 2.2 * s;
    g.add(mesh(new THREE.CylinderGeometry(0.13 * s, 0.2 * s, trunkH, 6), lam(dead ? C.woodDark : C.wood), 0, trunkH / 2, 0));
    if (!dead) {
      /* 三层锥体树冠：低模但轮廓清楚，比一个球更有"针叶林"的感觉 */
      var cols = [C.mossDark, C.moss, 0x6f815a];
      for (var i = 0; i < 3; i++) {
        var r = (1.25 - i * 0.28) * s, h = (1.15 - i * 0.15) * s;
        var cone = mesh(new THREE.ConeGeometry(r, h, 7), lam(cols[i]), 0, trunkH + i * 0.72 * s + h * 0.3, 0);
        g.add(cone);
      }
    } else {
      /* 枯树：三根斜枝，没有叶子 */
      for (var k = 0; k < 3; k++) {
        var a = (k / 3) * Math.PI * 2 + 0.4;
        var br = mesh(new THREE.CylinderGeometry(0.05 * s, 0.09 * s, 1.1 * s, 5), lam(C.woodDark));
        br.position.set(Math.cos(a) * 0.28 * s, trunkH * 0.86, Math.sin(a) * 0.28 * s);
        br.rotation.z = Math.cos(a) * 0.7; br.rotation.x = -Math.sin(a) * 0.7;
        g.add(br);
      }
    }
    return g;
  }

  function gStump(scale) {
    var g = new THREE.Group(), s = scale || 1;
    g.add(mesh(new THREE.CylinderGeometry(0.34 * s, 0.4 * s, 0.42 * s, 7), lam(C.wood), 0, 0.21 * s, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.05, 7), lam(C.bone), 0, 0.44 * s, 0));
    return g;
  }

  /* 断墙：一块墙板 + 顶部参差的碎口（用 2~3 个小 Box 咬边） */
  function gWall(w, hgt, seed) {
    var g = new THREE.Group(), R = rng(seed || 7);
    var thick = 0.34;
    g.add(mesh(new THREE.BoxGeometry(w, hgt, thick), lam(C.ash), 0, hgt / 2, 0));
    var teeth = Math.max(2, Math.round(w / 0.7));
    for (var i = 0; i < teeth; i++) {
      if (R() > 0.55) continue;
      var bw = w / teeth * (0.5 + R() * 0.5), bh = 0.25 + R() * 0.65;
      g.add(mesh(new THREE.BoxGeometry(bw, bh, thick * 0.96), lam(C.ash), -w / 2 + (i + 0.5) * (w / teeth), hgt + bh / 2 - 0.06, 0));
    }
    /* 墙面上的锈痕：一块薄板贴在正面 */
    if (R() > 0.4) g.add(mesh(new THREE.BoxGeometry(w * 0.42, hgt * 0.5, 0.02), lam(C.rustDark), (R() - 0.5) * w * 0.4, hgt * 0.45, thick / 2 + 0.012));
    return g;
  }

  function gRebar(n, seed) {
    var g = new THREE.Group(), R = rng(seed || 11);
    for (var i = 0; i < (n || 4); i++) {
      var r = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5 + R() * 1.1, 4), lam(C.rust));
      r.position.set((R() - 0.5) * 0.7, 0.75, (R() - 0.5) * 0.7);
      r.rotation.z = (R() - 0.5) * 0.8; r.rotation.x = (R() - 0.5) * 0.8;
      g.add(r);
    }
    return g;
  }

  function gRubble(n, seed) {
    var g = new THREE.Group(), R = rng(seed || 13);
    for (var i = 0; i < (n || 6); i++) {
      var s = 0.16 + R() * 0.42;
      var b = mesh(new THREE.BoxGeometry(s, s * (0.5 + R()), s * (0.7 + R() * 0.6)), lam(i % 3 ? C.ash : C.steel), (R() - 0.5) * 1.9, s * 0.35, (R() - 0.5) * 1.9);
      b.rotation.set(R() * 0.5, R() * 3.14, R() * 0.5);
      g.add(b);
    }
    return g;
  }

  function gCrate(s) {
    s = s || 1;
    var g = new THREE.Group();
    var w = 0.8 * s, h = 0.7 * s;
    g.add(mesh(new THREE.BoxGeometry(w, h, w), lam(C.wood), 0, h / 2, 0));
    /* 两道铁箍 */
    [-0.26, 0.26].forEach(function (dy) {
      g.add(mesh(new THREE.BoxGeometry(w * 1.03, 0.07 * s, w * 1.03), lam(C.rust), 0, h / 2 + dy * s, 0));
    });
    return g;
  }

  function gBarrel() {
    var g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.92, 10), lam(C.rust), 0, 0.46, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 10), lam(C.iron), 0, 0.68, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 10), lam(C.iron), 0, 0.24, 0));
    return g;
  }

  function gReed(n, seed) {
    var g = new THREE.Group(), R = rng(seed || 17);
    for (var i = 0; i < (n || 7); i++) {
      var h = 0.8 + R() * 0.9;
      var c = mesh(new THREE.CylinderGeometry(0.022, 0.03, h, 4), lam(C.moss), (R() - 0.5) * 1.2, h / 2, (R() - 0.5) * 1.2);
      c.rotation.z = (R() - 0.5) * 0.24;
      g.add(c);
      if (R() > 0.6) g.add(mesh(new THREE.ConeGeometry(0.05, 0.2, 5), lam(C.sand), c.position.x, h + 0.08, c.position.z));
    }
    return g;
  }

  function gWheat(n, seed) {
    var g = new THREE.Group(), R = rng(seed || 19);
    for (var i = 0; i < (n || 9); i++) {
      var h = 0.6 + R() * 0.3;
      var st = mesh(new THREE.BoxGeometry(0.045, h, 0.045), lam(C.wheat), (R() - 0.5) * 1.1, h / 2, (R() - 0.5) * 1.1);
      st.rotation.z = (R() - 0.5) * 0.2;
      g.add(st);
      g.add(mesh(new THREE.BoxGeometry(0.11, 0.16, 0.1), lam(0xd7b862), st.position.x, h + 0.02, st.position.z));
    }
    return g;
  }

  function gScarecrow() {
    var g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 5), lam(C.wood), 0, 0.85, 0));
    g.add(mesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), lam(C.woodDark), 0, 1.32, 0));
    g.add(mesh(new THREE.SphereGeometry(0.19, 8, 6), lam(C.bone), 0, 1.55, 0));
    g.add(mesh(new THREE.ConeGeometry(0.28, 0.22, 8), lam(C.rustDark), 0, 1.7, 0));
    g.add(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.2), lam(0x7d6a4a), 0, 1.06, 0));
    return g;
  }

  function gHut(seed) {
    var g = new THREE.Group(), R = rng(seed || 23);
    var w = 2.4, d = 2.0, h = 1.5;
    g.add(mesh(new THREE.BoxGeometry(w, h, d), lam(C.bone), 0, h / 2, 0));
    /* 斜屋顶：用四棱锥（Cone 4 段）压扁 */
    var roof = mesh(new THREE.ConeGeometry(w * 0.82, 0.95, 4), lam(C.rustDark), 0, h + 0.45, 0);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    /* 门洞：一块更暗的板 */
    g.add(mesh(new THREE.BoxGeometry(0.52, 0.95, 0.04), lam(0x1b1a17), 0, 0.48, d / 2 + 0.02));
    /* 窗：辐光青（废土科技的唯一"活"颜色） */
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.34, 0.04), lam(C.glow, { emissive: C.glow, emissiveIntensity: 0.5 }), -0.72, h * 0.68, d / 2 + 0.02));
    /* 烟囱 */
    g.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.55, 6), lam(C.steel), w * 0.3, h + 0.6, -0.3));
    if (R() > 0.5) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), lam(C.steel), w * 0.3 + 0.2, h + 0.95, -0.3));
    return g;
  }

  function gFence(n) {
    var g = new THREE.Group(), w = (n || 5) * 0.7;
    for (var i = 0; i <= (n || 5); i++) {
      var x = -w / 2 + i * 0.7;
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 5), lam(C.woodDark), x, 0.45, 0));
    }
    g.add(mesh(new THREE.BoxGeometry(w, 0.07, 0.05), lam(C.wood), 0, 0.66, 0));
    g.add(mesh(new THREE.BoxGeometry(w, 0.07, 0.05), lam(C.wood), 0, 0.34, 0));
    return g;
  }

  function gTent() {
    var g = new THREE.Group();
    var t = mesh(new THREE.ConeGeometry(1.35, 1.5, 4), lam(0x6a5b45), 0, 0.75, 0);
    t.rotation.y = Math.PI / 4;
    g.add(t);
    g.add(mesh(new THREE.BoxGeometry(0.6, 0.8, 0.06), lam(0x241f19), 0, 0.4, 0.86));
    /* 顶上一根支撑杆 */
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 4), lam(C.steel), 0, 0.85, 0));
    return g;
  }

  function gFire() {
    var g = new THREE.Group();
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * Math.PI * 2;
      g.add(mesh(new THREE.BoxGeometry(0.42, 0.12, 0.12), lam(C.woodDark), Math.cos(a) * 0.28, 0.08, Math.sin(a) * 0.28));
    }
    var f = mesh(new THREE.ConeGeometry(0.3, 0.72, 6), lam(C.neon, { emissive: C.neon, emissiveIntensity: 0.9, transparent: true, opacity: 0.92 }), 0, 0.42, 0);
    f.name = 'flame';
    g.add(f);
    return g;
  }

  function gSolar() {
    var g = new THREE.Group();
    var p = mesh(new THREE.BoxGeometry(1.9, 0.06, 1.2), lam(0x24405c), 0, 0.9, 0);
    p.rotation.x = -0.42;
    g.add(p);
    /* 面板上的栅格线 */
    for (var i = -1; i <= 1; i++) {
      var ln = mesh(new THREE.BoxGeometry(1.92, 0.02, 0.03), lam(C.steelLight), 0, 0.92 - i * 0.0, i * 0.4);
      ln.rotation.x = -0.42; g.add(ln);
    }
    [-0.7, 0.7].forEach(function (x) {
      g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 5), lam(C.steel), x, 0.45, 0));
    });
    return g;
  }

  function gPipe(len) {
    var g = new THREE.Group();
    var c = mesh(new THREE.CylinderGeometry(0.18, 0.18, len || 2.4, 8), lam(C.steel), 0, 0.18, 0);
    c.rotation.z = Math.PI / 2;
    g.add(c);
    g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 8), lam(C.rust), (len || 2.4) / 2, 0.18, 0));
    return g;
  }

  function gGate() {
    var g = new THREE.Group();
    [-1.1, 1.1].forEach(function (x) {
      g.add(mesh(new THREE.BoxGeometry(0.42, 3.2, 0.42), lam(C.ash), x, 1.6, 0));
    });
    g.add(mesh(new THREE.BoxGeometry(2.8, 0.42, 0.5), lam(C.ash), 0, 3.0, 0));
    /* 门楣上的辐光条 */
    g.add(mesh(new THREE.BoxGeometry(2.0, 0.1, 0.06), lam(C.glow, { emissive: C.glow, emissiveIntensity: 0.8 }), 0, 3.0, 0.28));
    return g;
  }

  function gStatue() {
    var g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), lam(C.ash), 0, 0.17, 0));
    var body = mesh(new THREE.CylinderGeometry(0.26, 0.36, 1.5, 6), lam(C.steel), 0, 1.1, 0);
    body.rotation.z = 0.06; g.add(body);
    g.add(mesh(new THREE.SphereGeometry(0.26, 8, 6), lam(C.bone), 0.05, 2.0, 0));
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.1, 0.1), lam(C.steel), 0.05, 1.55, 0));
    return g;
  }

  function gTower(h) {
    h = h || 6;
    var g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.5, 1.15, h, 8), lam(C.iron), 0, h / 2, 0));
    for (var i = 0; i < 3; i++) {
      var ring = mesh(new THREE.CylinderGeometry(0.62 + i * 0.16, 0.62 + i * 0.16, 0.12, 8), lam(C.rust), 0, h * (0.25 + i * 0.22), 0);
      g.add(ring);
    }
    /* 塔顶的辐光核 */
    var core = mesh(new THREE.IcosahedronGeometry(0.42, 0), lam(C.glow, { emissive: C.glow, emissiveIntensity: 1.0, transparent: true, opacity: 0.9 }), 0, h + 0.45, 0);
    core.name = 'core';
    g.add(core);
    return g;
  }

  function gCrystal(seed) {
    var g = new THREE.Group(), R = rng(seed || 29);
    for (var i = 0; i < 3; i++) {
      var h = 0.7 + R() * 0.8;
      var c = mesh(new THREE.ConeGeometry(0.16 + R() * 0.1, h, 5), lam(C.glow, { emissive: C.glow, emissiveIntensity: 0.7, transparent: true, opacity: 0.86 }),
        (R() - 0.5) * 0.7, h / 2, (R() - 0.5) * 0.7);
      c.rotation.z = (R() - 0.5) * 0.4; c.rotation.x = (R() - 0.5) * 0.4;
      g.add(c);
    }
    return g;
  }

  function gWreck(seed) {
    var g = new THREE.Group(), R = rng(seed || 31);
    /* 机身：圆柱躺在侧卧姿态 + 机翼（斜置 Box）+ 尾翼 */
    var fus = mesh(new THREE.CylinderGeometry(0.95, 1.15, 5.2, 10), lam(C.steelLight), 0, 1.0, 0);
    fus.rotation.z = Math.PI / 2; fus.rotation.y = 0.18;
    g.add(fus);
    var nose = mesh(new THREE.ConeGeometry(0.95, 1.4, 10), lam(C.steel), 2.95, 1.0, 0.28);
    nose.rotation.z = -Math.PI / 2; g.add(nose);
    var wing = mesh(new THREE.BoxGeometry(0.18, 0.14, 4.2), lam(C.steelLight), 0.4, 1.0, 0);
    wing.rotation.z = 0.35; wing.rotation.x = 0.12; g.add(wing);
    var tail = mesh(new THREE.BoxGeometry(0.14, 1.5, 0.9), lam(C.steel), -2.5, 1.6, 0);
    tail.rotation.z = -0.25; g.add(tail);
    /* 破裂处的火焰残迹（暗红） */
    g.add(mesh(new THREE.BoxGeometry(1.1, 0.9, 1.2), lam(C.rustDark), -0.4, 0.5, 0));
    for (var i = 0; i < 4; i++) g.add(gCrate(0.6 + R() * 0.3).translateX((R() - 0.5) * 3.2).translateZ((R() - 0.5) * 3.2));
    return g;
  }

  function gStall() {
    var g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(2.2, 0.12, 1.0), lam(C.wood), 0, 0.85, 0));
    [-0.95, 0.95].forEach(function (x) {
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), lam(C.woodDark), x, 0.45, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 5), lam(C.woodDark), x, 1.35, -0.42));
    });
    /* 遮阳布：两块斜板 */
    var a = mesh(new THREE.BoxGeometry(2.4, 0.05, 0.72), lam(0x8c5a3c), 0, 2.1, -0.16);
    a.rotation.x = 0.34; g.add(a);
    /* 摊上两个货箱 */
    g.add(gCrate(0.5).translateX(-0.6).translateY(0.9));
    g.add(gBarrel().translateX(0.62).translateY(0.86).translateZ(0.06));
    return g;
  }

  function gLantern() {
    var g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 5), lam(C.steel), 0, 0.95, 0));
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), lam(C.steel), 0.14, 1.9, 0));
    g.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), lam(C.neon, { emissive: C.neon, emissiveIntensity: 0.9 }), 0.28, 1.78, 0));
    return g;
  }

  function gRock(seed) {
    var R = rng(seed || 37);
    var s = 0.5 + R() * 0.9;
    return new THREE.Group().add(mesh(new THREE.IcosahedronGeometry(s, 0), lam(R() > 0.5 ? C.ash : C.steel), 0, s * 0.55, 0));
  }

  function gLog() {
    var g = new THREE.Group();
    var l = mesh(new THREE.CylinderGeometry(0.26, 0.28, 1.8, 7), lam(C.wood), 0, 0.27, 0);
    l.rotation.z = Math.PI / 2; g.add(l);
    g.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 7), lam(C.bone), 0.9, 0.27, 0));
    return g;
  }

  /* 交互点用的小物件：地面上的"可拾取"标记 */
  /* 废土物种的实体：四足低伏 + 前倾的头 + 两只辐光眼。
     不用贴图、不加骨骼 —— 它只要"在那儿"就够了，动作交给斗将面板。 */
  function gBeast(seed) {
    var R = rng(seed || 41);
    var g = new THREE.Group();
    var body = mesh(new THREE.BoxGeometry(1.15, 0.5, 0.62), lam(0x5c6b52), 0, 0.52, 0);
    body.rotation.x = 0.06;
    g.add(body);
    /* 背上的骨刺 */
    for (var i = 0; i < 3; i++) {
      var sp = mesh(new THREE.ConeGeometry(0.08, 0.26 + R() * 0.12, 4), lam(0x8f9a7c), -0.3 + i * 0.3, 0.82, 0);
      sp.rotation.z = (R() - 0.5) * 0.3;
      g.add(sp);
    }
    /* 头：前倾，压在身体前端 */
    var head = mesh(new THREE.BoxGeometry(0.42, 0.36, 0.4), lam(0x6b7a5c), 0.66, 0.66, 0);
    head.rotation.z = -0.18;
    g.add(head);
    /* 眼：辐光青（夜里也能看见它在看你） */
    [-0.11, 0.11].forEach(function (dz) {
      g.add(mesh(new THREE.SphereGeometry(0.045, 6, 5), lam(C.glow, { emissive: C.glow, emissiveIntensity: 1.0 }), 0.84, 0.72, dz));
    });
    /* 四条腿 */
    [[-0.36, -0.22], [-0.36, 0.22], [0.36, -0.22], [0.36, 0.22]].forEach(function (q) {
      g.add(mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.42, 5), lam(0x4a5644), q[0], 0.21, q[1]));
    });
    /* 尾巴 */
    var tail = mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.7, 5), lam(0x4a5644), -0.76, 0.62, 0);
    tail.rotation.z = 0.9;
    g.add(tail);
    return g;
  }

  function gNodeRing(col) {
    var g = new THREE.Group();
    var r = mesh(new THREE.RingGeometry(0.55, 0.72, 20), lam(col || C.glow, { transparent: true, opacity: 0.5, side: THREE.DoubleSide }), 0, 0.03, 0);
    r.rotation.x = -Math.PI / 2;
    r.name = 'ring';
    g.add(r);
    return g;
  }

  var PROP = {
    tree: gTree, deadTree: function (s) { return gTree(s || 1, true); }, stump: gStump,
    wall: gWall, rebar: gRebar, rubble: gRubble, crate: gCrate, barrel: gBarrel,
    reed: gReed, wheat: gWheat, scarecrow: gScarecrow, hut: gHut, fence: gFence,
    tent: gTent, fire: gFire, solar: gSolar, pipe: gPipe, gate: gGate, statue: gStatue,
    tower: gTower, crystal: gCrystal, wreck: gWreck, stall: gStall, lantern: gLantern,
    rock: gRock, log: gLog, beast: gBeast,
  };

  /* ══════════════════════════════════════════════════════════════
   * 参数映射表 —— **必须有这张表**
   * --------------------------------------------------------------
   * 道具函数的签名不统一（`gTree(scale, dead)` / `gWall(w, h, seed)` /
   * `gRubble(n, seed)` …），而配置里是 `{t, x, z, s, n, w, h, seed}`。
   * 第一版直接把配置对象按位置摊开传：`fn(p.s, p.seed, p.n, ...)` ——
   * 结果 `gTree(scale, dead)` 的第二个参数拿到的是 **seed（数字，真值）**，
   * 于是整片针叶林全被渲染成枯树。**参数顺序不一致时，位置传参就是定时炸弹。**
   * 现在每个类型显式声明自己吃哪几个参数，加新道具只在这张表加一行。
   * ══════════════════════════════════════════════════════════════ */
  var ARGS = {
    tree: function (o) { return [o.s || 1, false]; },
    deadTree: function (o) { return [o.s || 1, true]; },
    stump: function (o) { return [o.s || 1]; },
    wall: function (o) { return [o.w || 3, o.h || 2, o.seed]; },
    rebar: function (o) { return [o.n || 4, o.seed]; },
    rubble: function (o) { return [o.n || 6, o.seed]; },
    crate: function (o) { return [o.s || 1]; },
    reed: function (o) { return [o.n || 7, o.seed]; },
    wheat: function (o) { return [o.n || 9, o.seed]; },
    hut: function (o) { return [o.seed]; },
    fence: function (o) { return [o.n || 5]; },
    pipe: function (o) { return [o.len || 2.4]; },
    tower: function (o) { return [o.hgt || o.h || 6]; },
    crystal: function (o) { return [o.seed]; },
    wreck: function (o) { return [o.seed]; },
    rock: function (o) { return [o.seed]; },
  };
  /* 接地阴影：一块压扁的暗椭圆。
     没开 shadowMap（移动端太贵），但没有接地阴影时物件像"贴在画面上"而不是"立在地上"，
     这是廉价但效果最大的一步。 */
  var _shadowMat = null;
  function contactShadow(r) {
    if (!_shadowMat) _shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26 });
    var m = new THREE.Mesh(new THREE.CircleGeometry(r || 0.5, 14), _shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.012;
    m.name = 'cshadow';
    return m;
  }
  function makeProp(cfg) {
    var fn = PROP[cfg.t];
    if (!fn) return null;
    var args = (ARGS[cfg.t] || function () { return []; })(cfg);
    var o = fn.apply(null, args);
    if (!o) return null;
    /* 阴影大小按道具类型给：树/墙/塔大，芦苇/麦子几乎没有 */
    var SH = { tree: 0.9, deadTree: 0.7, wall: 1.6, hut: 1.7, tower: 1.5, wreck: 2.6, gate: 1.6,
      tent: 1.1, stall: 1.2, statue: 0.7, solar: 1.1, fire: 0.7, rock: 0.8, crate: 0.55,
      barrel: 0.45, fence: 1.2, rubble: 0.9, log: 0.8, scarecrow: 0.4, stump: 0.45,
      pipe: 0.9, lantern: 0.2, crystal: 0.5, wheat: 0.0, reed: 0.0 };
    var sr = SH[cfg.t] == null ? 0.5 : SH[cfg.t];
    if (sr > 0) o.add(contactShadow(sr));
    return o;
  }

  /* ============================================================
   * 2. 十个场景（数据驱动）
   * ------------------------------------------------------------
   * 每个场景：
   *   ground  地面配色（贴图基色）· sky 天光 · fog 雾色
   *   props   装饰物（可散布 n 份）· nodes 可交互点（真正能动手的地方）
   *   act     默认动作（与 DATA.LING_ACT 的 id 对齐）
   * 交互点必须有 `act`，否则它只是布景 —— 布景和交互在数据上就分开。
   * ============================================================ */
  var SCENES = [
    {
      id: 'ruin', name: '废墟发掘', sub: '断墙与钢筋下面，旧世的东西还没烂透',
      ground: 0x7d6f5c, sky: 0x9fb0bd, fog: 0x8b8a80, act: 'cai', seed: 101,
      props: [
        { t: 'wall', x: -4.2, z: -3.4, w: 4.2, h: 2.0, rot: 0.1 },
        { t: 'wall', x: 3.6, z: -5.2, w: 3.4, h: 1.4, rot: -0.5 },
        { t: 'wall', x: 5.2, z: 2.4, w: 2.8, h: 2.6, rot: 1.2 },
        { t: 'rubble', x: 0.8, z: -1.2, n: 8, seed: 11 },
        { t: 'rubble', x: -3.4, z: 3.6, n: 6, seed: 12 },
        { t: 'rebar', x: -3.9, z: -1.6, n: 5, seed: 13 },
        { t: 'rebar', x: 3.2, z: 2.0, n: 3, seed: 14 },
        { t: 'pipe', x: 4.4, z: -1.8, len: 2.8, rot: 0.7 },
        { t: 'crate', x: 2.2, z: 4.2, s: 1 },
        { t: 'deadTree', x: -6.4, z: 1.2, s: 1.2 },
        { t: 'rock', x: 6.4, z: 4.4, seed: 15 },
        { t: 'solar', x: -1.4, z: 5.6, rot: -0.3 },
      ],
      nodes: [
        { t: 'rubble', x: 0.6, z: -0.6, act: 'cai', label: '翻找碎石堆', hint: '药草、矿料、偶尔一个辐能核心' },
        { t: 'crate', x: 2.4, z: 3.9, act: 'cai', label: '撬开货箱', hint: '旧世留下的存货' },
        { t: 'rebar', x: -3.6, z: -1.4, act: 'tao', label: '清剿这一带的掠夺者', hint: '动手，胜则物资丰厚' },
      ],
    },
    {
      id: 'forest', name: '林地砍伐', sub: '针叶还绿着，但树皮上全是锈斑',
      ground: 0x3f4a33, sky: 0x8aa0a8, fog: 0x6b7a62, act: 'cai', seed: 202,
      props: [
        { t: 'tree', x: -4.6, z: -4.0, s: 1.15, seed: 1 }, { t: 'tree', x: -1.8, z: -5.6, s: 0.95, seed: 2 },
        { t: 'tree', x: 2.2, z: -4.6, s: 1.25, seed: 3 }, { t: 'tree', x: 5.4, z: -2.6, s: 1.0, seed: 4 },
        { t: 'tree', x: -6.2, z: 0.4, s: 0.9, seed: 5 }, { t: 'tree', x: 6.0, z: 1.6, s: 1.1, seed: 6 },
        { t: 'tree', x: -4.0, z: 4.6, s: 1.05, seed: 7 }, { t: 'tree', x: 3.2, z: 5.2, s: 0.95, seed: 8 },
        { t: 'deadTree', x: 0.6, z: 3.4, s: 1.0, seed: 9 },
        { t: 'log', x: -2.6, z: 1.8, rot: 0.5 }, { t: 'log', x: 1.6, z: 0.4, rot: -0.8 },
        { t: 'rock', x: 4.6, z: -0.6, seed: 21 },
      ],
      nodes: [
        { t: 'tree', x: 2.0, z: -4.2, s: 1.2, seed: 3, act: 'cai', label: '伐这棵树', hint: '木材与树脂' },
        { t: 'stump', x: -2.4, z: 1.6, act: 'cai', label: '翻找树桩', hint: '菌菇、树脂' },
        { t: 'log', x: 1.4, z: 0.6, rot: -0.8, act: 'cai', label: '劈开倒木', hint: '干燥的木料' },
      ],
    },
    {
      id: 'field', name: '庄稼收割', sub: '没人收的麦子，自己长成了一片黄',
      ground: 0x7a6a3e, sky: 0xb3b58f, fog: 0x9a9170, act: 'cai', seed: 303,
      props: [
        { t: 'wheat', x: -3.2, z: -3.6, n: 10, seed: 1 }, { t: 'wheat', x: -0.4, z: -4.4, n: 10, seed: 2 },
        { t: 'wheat', x: 2.6, z: -3.8, n: 10, seed: 3 }, { t: 'wheat', x: 5.2, z: -2.4, n: 9, seed: 4 },
        { t: 'wheat', x: -5.4, z: 0.6, n: 9, seed: 5 }, { t: 'wheat', x: 3.4, z: 1.4, n: 10, seed: 6 },
        { t: 'wheat', x: -2.0, z: 3.8, n: 9, seed: 7 }, { t: 'wheat', x: 1.2, z: 5.0, n: 9, seed: 8 },
        { t: 'scarecrow', x: 0.2, z: -1.2 },
        { t: 'fence', x: -6.0, z: -1.6, n: 4, rot: 1.57 },
        { t: 'barrel', x: 4.6, z: 3.6 },
        { t: 'hut', x: -5.6, z: -5.0, seed: 9, s: 0.8 },
      ],
      nodes: [
        { t: 'wheat', x: -0.6, z: -3.8, n: 8, seed: 2, act: 'cai', label: '割一片麦子', hint: '粮食入袋' },
        { t: 'barrel', x: 4.5, z: 3.4, act: 'cai', label: '翻桶里的存粮', hint: '也许还没霉' },
        { t: 'scarecrow', x: 0.2, z: -1.0, act: 'bai', label: '稻草人后面有人吗', hint: '荒野上总有些躲着的人' },
      ],
    },
    {
      id: 'lake', name: '临湖垂钓', sub: '水面很静，静得像在等你下钩',
      ground: 0x7a6f55, sky: 0x93b3c4, fog: 0x8fa6b2, act: 'lake_scene', seed: 404,
      water: true,
      props: [
        /* 芦苇贴着岸线（-1.2 ~ -0.4），散开的几丛在岸上；石头在岸，
           倒木当"凳"，灯在岸上做参照物。全部避开水面中线，免得漂着。 */
        { t: 'reed', x: -3.6, z: -0.9, n: 8, seed: 1 }, { t: 'reed', x: 4.4, z: -0.7, n: 7, seed: 2 },
        { t: 'reed', x: -1.4, z: 3.4, n: 6, seed: 3 }, { t: 'reed', x: 5.2, z: 2.2, n: 5, seed: 6 },
        { t: 'rock', x: -5.2, z: 2.4, seed: 4 }, { t: 'rock', x: 5.6, z: 0.6, seed: 5 },
        { t: 'log', x: -4.6, z: 0.4, rot: 0.9 },
        { t: 'deadTree', x: 6.2, z: 3.4, s: 1.1 },
        { t: 'lantern', x: 2.8, z: -0.6 },
      ],
      nodes: [
        /* 钓点在**岸边**（z≈-1.4，水面从 -1 开始）：站在岸上钓，
           而不是站在水里钓 —— 这是"湖"和"水坑"的区别。 */
        { t: 'pipe', x: 0.4, z: -1.4, len: 1.4, act: 'lake_scene', label: '下竿垂钓', hint: '肥鱼入篓，偶得水中沉物' },
        { t: 'reed', x: -3.2, z: -1.0, n: 5, seed: 1, act: 'cai', label: '在芦苇里摸', hint: '水边的药材' },
        { t: 'rock', x: -4.6, z: 1.6, act: 'xiu', label: '在石上静坐', hint: '辐能充裕处调息' },
      ],
    },
    {
      id: 'hamlet', name: '村社拜访', sub: '三间土屋，一盏还亮着的灯',
      ground: 0x6f6047, sky: 0xa8a48c, fog: 0x8d8770, act: 'bai', seed: 505,
      props: [
        { t: 'hut', x: -3.2, z: -3.6, seed: 1 }, { t: 'hut', x: 3.4, z: -3.0, seed: 2 },
        { t: 'hut', x: 0.2, z: -6.0, seed: 3, s: 0.9 },
        { t: 'fire', x: 0.4, z: 0.6 },
        { t: 'fence', x: -5.6, z: 1.2, n: 4, rot: 1.4 },
        { t: 'fence', x: 5.4, z: 1.4, n: 4, rot: 1.4 },
        { t: 'crate', x: -1.6, z: 2.4 }, { t: 'barrel', x: 2.0, z: 2.6 },
        { t: 'lantern', x: -1.2, z: -1.4 }, { t: 'lantern', x: 1.8, z: -1.6 },
        { t: 'tree', x: 5.8, z: 3.6, s: 0.85, seed: 4 },
      ],
      nodes: [
        { t: 'hut', x: -3.0, z: -3.4, seed: 1, act: 'bai', label: '敲门', hint: '一段小故事，一份小赠礼' },
        { t: 'fire', x: 0.4, z: 0.6, act: 'bai', label: '在火边坐下', hint: '听人讲讲这一带的事' },
        { t: 'crate', x: -1.6, z: 2.4, act: 'cai', label: '看看院角的杂物', hint: '人家不要的，也许你用得上' },
      ],
    },
    {
      id: 'trial', name: '旧世试炼场', sub: '石门后面，是三层越来越硬的东西',
      ground: 0x5b5a52, sky: 0x8b93a0, fog: 0x7a7d80, act: 'shi', seed: 606,
      props: [
        { t: 'gate', x: 0, z: -5.2 },
        { t: 'wall', x: -3.6, z: -5.0, w: 3.0, h: 2.8, rot: 0 }, { t: 'wall', x: 3.6, z: -5.0, w: 3.0, h: 2.8, rot: 0 },
        { t: 'statue', x: -4.6, z: -1.0 }, { t: 'statue', x: 4.6, z: -1.0 },
        { t: 'rubble', x: 0.0, z: 2.4, n: 7, seed: 3 },
        { t: 'crystal', x: -2.2, z: 3.8, seed: 4 }, { t: 'crystal', x: 2.4, z: 3.6, seed: 5 },
        { t: 'pipe', x: 5.8, z: 2.2, len: 3.0, rot: -0.6 },
        { t: 'rebar', x: -5.4, z: 1.6, n: 4, seed: 6 },
      ],
      nodes: [
        { t: 'gate', x: 0, z: -4.8, act: 'shi', label: '推开石门（第一层）', hint: '逐层加码，见好就收' },
        { t: 'crystal', x: -2.1, z: 3.6, act: 'xiu', label: '在晶体旁调息', hint: '辐能浓，恢复得快' },
        { t: 'rubble', x: 0.2, z: 2.2, act: 'cai', label: '翻翻碎砖', hint: '试炼场里的旧装备' },
      ],
    },
    {
      id: 'camp', name: '掠夺者营地', sub: '火还烧着，人不知道去哪了',
      ground: 0x554b3c, sky: 0x8f8577, fog: 0x7b7161, act: 'tao', seed: 707,
      props: [
        { t: 'tent', x: -3.6, z: -3.0, rot: 0.2 }, { t: 'tent', x: 3.2, z: -3.6, rot: -0.4 },
        { t: 'tent', x: 0.2, z: -5.6, rot: 0.1, s: 0.9 },
        { t: 'fire', x: 0.0, z: 0.2 },
        { t: 'fence', x: -6.0, z: 0.4, n: 5, rot: 1.5 }, { t: 'fence', x: 6.0, z: 0.4, n: 5, rot: 1.5 },
        { t: 'barrel', x: 2.4, z: 1.8 }, { t: 'barrel', x: 3.0, z: 2.6 },
        { t: 'crate', x: -2.6, z: 2.2 }, { t: 'crate', x: -3.2, z: 3.0 },
        { t: 'rebar', x: 5.0, z: -1.6, n: 4, seed: 8 },
        { t: 'deadTree', x: -5.8, z: -4.4, s: 1.2 },
      ],
      nodes: [
        { t: 'fire', x: 0.0, z: 0.2, act: 'tao', label: '掀了这个营地', hint: '打，赢了东西都是你的' },
        { t: 'crate', x: -2.5, z: 2.1, act: 'cai', label: '撬箱子', hint: '抢来的东西堆在这儿' },
        { t: 'tent', x: -3.4, z: -2.8, rot: 0.2, act: 'cai', label: '搜帐篷', hint: '可能有人还在里面' },
      ],
    },
    {
      id: 'spire', name: '辐能塔', sub: '塔还在工作，没人知道它在给谁供电',
      ground: 0x3d4348, sky: 0x6f8494, fog: 0x5e7280, act: 'xiu', seed: 808,
      props: [
        { t: 'tower', x: 0, z: -4.2, h: 7 },
        { t: 'crystal', x: -3.4, z: -1.2, seed: 1 }, { t: 'crystal', x: 3.6, z: -0.8, seed: 2 },
        { t: 'crystal', x: -2.0, z: 3.2, seed: 3 }, { t: 'crystal', x: 2.6, z: 3.6, seed: 4 },
        { t: 'pipe', x: -5.4, z: 1.8, len: 3.2, rot: 0.4 }, { t: 'pipe', x: 5.6, z: 2.4, len: 2.6, rot: -0.5 },
        { t: 'solar', x: -4.8, z: 4.4, rot: 0.3 }, { t: 'solar', x: 4.8, z: 4.8, rot: -0.4 },
        { t: 'rubble', x: 1.4, z: 1.2, n: 5, seed: 5 },
      ],
      nodes: [
        { t: 'tower', x: 0, z: -3.6, h: 7, act: 'xiu', label: '在塔下入定', hint: '辐能稳定入体，偶有顿悟' },
        { t: 'crystal', x: -3.3, z: -1.0, act: 'cai', label: '敲一块晶体', hint: '辐能核心' },
        { t: 'rubble', x: 1.3, z: 1.1, act: 'cai', label: '翻找塔基碎石', hint: '维修剩下的零件' },
      ],
    },
    {
      id: 'market', name: '荒野市集', sub: '灯串还亮着，摊主在等最后一个客人',
      ground: 0x5f574a, sky: 0x9c8f7c, fog: 0x867a68, act: 'bai', seed: 909,
      props: [
        { t: 'stall', x: -3.4, z: -2.6, rot: 0.1 }, { t: 'stall', x: 3.2, z: -3.0, rot: -0.15 },
        { t: 'stall', x: 0.2, z: -5.4, rot: 0.0 },
        { t: 'lantern', x: -1.6, z: 0.8 }, { t: 'lantern', x: 1.8, z: 0.6 },
        { t: 'fire', x: 0.2, z: 2.8 },
        { t: 'crate', x: -4.8, z: 2.2 }, { t: 'barrel', x: 4.6, z: 2.4 },
        { t: 'fence', x: -6.2, z: -0.4, n: 3, rot: 1.5 },
        { t: 'solar', x: 5.6, z: -0.8, rot: 0.5 },
      ],
      nodes: [
        { t: 'stall', x: -3.2, z: -2.4, rot: 0.1, act: 'bai', label: '和摊主聊两句', hint: '情报与赠礼' },
        { t: 'stall', x: 3.0, z: -2.8, rot: -0.15, act: 'bai', label: '问另一摊的价', hint: '也许能换点东西' },
        { t: 'crate', x: -4.6, z: 2.0, act: 'cai', label: '翻散落的货', hint: '掉的、忘的、不要的' },
      ],
    },
    {
      id: 'crash', name: '坠机残骸', sub: '机身斜插在地上，货舱门还半开着',
      ground: 0x4e4a44, sky: 0x8e97a4, fog: 0x76797e, act: 'cai', seed: 1010,
      props: [
        { t: 'wreck', x: 0.2, z: -2.4, seed: 1 },
        { t: 'rubble', x: -3.4, z: 1.6, n: 7, seed: 2 },
        { t: 'rubble', x: 3.6, z: 2.2, n: 6, seed: 3 },
        { t: 'crate', x: -2.2, z: 3.4 }, { t: 'crate', x: 2.6, z: 3.8, s: 0.8 },
        { t: 'barrel', x: 4.4, z: -0.6 },
        { t: 'rebar', x: -4.6, z: -0.8, n: 4, seed: 4 },
        { t: 'deadTree', x: -6.0, z: 3.0, s: 1.1 }, { t: 'rock', x: 5.8, z: 3.4, seed: 5 },
        { t: 'pipe', x: 4.8, z: 1.2, len: 2.4, rot: 0.9 },
      ],
      nodes: [
        { t: 'wreck', x: 0.2, z: -2.0, seed: 1, act: 'cai', label: '搜货舱', hint: '旧世航材、辐能核心' },
        { t: 'crate', x: -2.1, z: 3.2, act: 'cai', label: '开散落的箱子', hint: '空运的单子还在里面' },
        { t: 'rubble', x: 3.4, z: 2.0, act: 'tao', label: '有人在这儿蹲着', hint: '拾荒者不让抢' },
      ],
    },
  ];

  /* ============================================================
   * 3. 运行时
   * ============================================================ */
  var layer = null, cvs = null, R3 = null, scene = null, cam = null;
  var player = null, nodeList = [], propRoot = null, waterMesh = null;
  var openId = null, ctx = null, lastT = 0, rafId = 0;
  var nearNode = null, keys = {}, targetPt = null;
  /* 正交视口高度（世界单位）。
     ⚠️ 26 的时候实测"所有东西都很小"：2 米高的断墙在 880px 高的屏上只有 68px，
     读起来像俯瞰沙盘而不是"我站在废墟里"。17.5 更接近星露谷那种"人占屏高 1/6"的比例。 */
  var FRUSTUM_H = 17.5;
  var frustumH = FRUSTUM_H;      /* 当前场景实际用的视口高度（城内要放宽，见 buildCityScene） */
  var SPEED = 6.2;              /* 单位/秒，走起来不飘 */
  var BOUND = 13;               /* 场景活动半径 */

  function ensure() {
    if (R3) return;
    layer = document.createElement('div');
    layer.id = 'scene-layer';
    /* ⚠️ 挂进 #app-scale（与弹窗同一层叠上下文）—— v130 踩过：挂 body 的 fixed 层
       会盖住所有弹窗，而且 `#app-scale` 带 transform 使内部的 z-index 对外失效。 */
    layer.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;z-index:60;'
      + 'background:#0b0d10;overflow:hidden;';
    cvs = document.createElement('canvas');
    cvs.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;';
    layer.appendChild(cvs);
    var host = document.getElementById('app-scale') || document.body;
    host.appendChild(layer);
    layer.style.display = 'none';

    R3 = new THREE.WebGLRenderer({ canvas: cvs, antialias: true });
    R3.setClearColor(0x0b0d10, 1);
    try { R3.outputColorSpace = THREE.SRGBColorSpace; } catch (e) { /* r150 以下没有 */ }

    scene = new THREE.Scene();
    cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
    /* 光：半球光给环境色，方向光给"太阳"和影子方向感。
       不启用 shadowMap —— 正交场景里靠颜色和轮廓已经够，阴影贴图在移动端太贵。 */
    /* 三层光：
         hemi  天光/地面反光 → 决定整体环境色
         sun   主光（暖） → 给"太阳在哪"和明暗面
         rim   背光（冷） → 把暗面从背景里剥出来（没有它，灰墙压在灰地上就是一片糊）
       再加一盏很弱的环境光把最暗处抬起来 —— 低于这个亮度，暗部细节全丢。 */
    scene.add(new THREE.HemisphereLight(0xe4eef5, 0x4a4638, 1.0));
    var amb = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(amb);
    var sun = new THREE.DirectionalLight(0xfff1d8, 1.15);
    sun.position.set(9, 16, 7);
    scene.add(sun);
    var rim = new THREE.DirectionalLight(0x9fc4d8, 0.55);
    rim.position.set(-8, 6, -9);
    scene.add(rim);

    /* 键鼠 */
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', function (e) { keys[e.key] = false; }, true);
    window.addEventListener('resize', resize, false);
    cvs.addEventListener('pointerdown', onPointerDown);
    return;
  }

  function resize() {
    if (!R3) return;
    var w = layer.clientWidth || 1, h = layer.clientHeight || 1;
    R3.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R3.setSize(w, h, false);
    var asp = w / h;
    cam.left = -frustumH * asp / 2; cam.right = frustumH * asp / 2;
    cam.top = frustumH / 2; cam.bottom = -frustumH / 2;
    cam.updateProjectionMatrix();
  }

  /* ---------- 地面贴图（程序生成，1 张 256² 噪声图） ---------- */
  function groundTexture(baseCol, seed, kind) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    var g = cv.getContext('2d');
    var base = new THREE.Color(baseCol);
    g.fillStyle = '#' + base.getHexString();
    g.fillRect(0, 0, 256, 256);
    var R = rng(seed || 5);
    /* 噪点：三档明暗，做成"被踩过的地" */
    for (var i = 0; i < 2600; i++) {
      var v = (R() - 0.5) * 0.24;
      var c = base.clone().offsetHSL(0, 0, v);
      g.fillStyle = '#' + c.getHexString();
      var s = 1 + R() * 3;
      g.fillRect(R() * 256, R() * 256, s, s);
    }
    /* 裂缝 / 草丛：按场景类型给不同笔触 */
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 1;
    for (var k = 0; k < 26; k++) {
      g.beginPath();
      var x = R() * 256, y = R() * 256;
      g.moveTo(x, y);
      for (var j = 0; j < 3; j++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    if (kind === 'grass') {
      g.strokeStyle = 'rgba(150,180,120,0.28)';
      for (var m = 0; m < 220; m++) {
        var gx = R() * 256, gy = R() * 256;
        g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + (R() - 0.5) * 4, gy - 3 - R() * 4); g.stroke();
      }
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 7);
    return tex;
  }

  /* ---------- 场景装配 ---------- */
  function buildScene(cfg) {
    cityView = false; frustumH = FRUSTUM_H;
    if (propRoot) { scene.remove(propRoot); propRoot = null; }
    nodeList = []; nearNode = null; waterMesh = null;
    propRoot = new THREE.Group();
    scene.add(propRoot);

    /* 天光与雾：改 scene.background / fog 比换材质便宜，一眼就换风格 */
    scene.background = new THREE.Color(cfg.sky || 0x8e97a4);
    scene.fog = new THREE.FogExp2(cfg.fog || cfg.sky || 0x8e97a4, 0.020);

    /* 地面 */
    var kind = (cfg.id === 'forest' || cfg.id === 'field') ? 'grass' : 'ash';
    var gtex = groundTexture(cfg.ground, cfg.seed || 7, kind);
    var gm = new THREE.MeshLambertMaterial({ map: gtex, color: 0xffffff });
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 1, 1), gm);
    ground.rotation.x = -Math.PI / 2;
    propRoot.add(ground);

    /* 水（只有 lake 有）：单独一块半透明面 + 每帧顶点波动 */
    if (cfg.water) {
      /* ⚠️ 第一版把水面放在 y=-0.06（地面之下），结果只有波峰穿出地面，
         整片湖变成一堆"水斑"（实测截图：六七个八角形水坑）。原因是
         **不透明地面把水全挡了**，而这套渲染没有水下透射。
         正确做法：水面**抬到地面之上**（0.03，靠距离免 z-fight），
         并且铺在玩家**前方远处** —— 玩家站岸上，湖在视野上方。
         ⚠️ 方向别搞反：镜头朝 **-z** 看（`cam.lookAt(cx, ·, cz-17)`），
         所以"前方"= 负 z。第一版放 +18，结果整片湖跑到画面最底部（截图确认）。 */
      var wg = new THREE.PlaneGeometry(30, 26, 28, 24);
      /* ⛔ 水**不做半透明**。
         踩过的坑：半透明水 + 半透明地面斑块 + 无水下透射，三者叠在一起时，
         透过水能看见底下两块 18 边形的浅色斑（截图里像"湖里有洞"）。
         查了半天才定位到是透明排序，而不是几何错误。
         湖面是**实地**，直接给不透明材质 —— 既没有穿插，也没有排序问题，
         观感上还更"水"（浅色底透出来的那种发灰不像水）。 */
      var wm = new THREE.MeshLambertMaterial({ color: C.water });
      waterMesh = new THREE.Mesh(wg, wm);
      waterMesh.rotation.x = -Math.PI / 2;
      /* 水面基准高度 **0.12**，不是 0.03 ——
         实测：0.03 + 波幅 0.03 时，波谷把顶点推到地面以下，
         不透明水面就"缺一块"，透出浅色地面，看起来像湖里有洞（截图确认）。
         基准必须 > 波幅，否则每一帧都有洞。
         代价是水面比岸高 12cm —— 正交视角下读起来是"水满到岸边"。 */
      waterMesh.position.set(0, 0.12, -14);
      waterMesh.name = 'water';
      waterMesh.renderOrder = 3;
      propRoot.add(waterMesh);
    }

    /* ---------- 地面细节：斑块 + 零星植被 ----------
       一整片均匀噪声看起来像"贴图"，不像地。加两层：
         · 3~4 块颜色略深的椭圆斑（踩出来的路/湿泥）
         · 30 来个小物件（草丛 / 碎石），确定性散布
       这些东西**不参与交互**，纯粹是为了让眼睛有落点。 */
    (function () {   /* 地面散布：匿名 IIFE（命名会被审计当死函数） */
      var R = rng((cfg.seed || 7) + 991);
      /* ⚠️ 不透明度 0.85 的深色斑在浅地上像"油渍"（实测截图看得很清楚）。
         它只是"踩出来的路"，该是**几乎看不见的一层脏**：0.22 就够。 */
      var patchMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(cfg.ground).multiplyScalar(0.7), transparent: true, opacity: 0.22 });
      for (var i = 0; i < 5; i++) {
        var pr = 1.1 + R() * 1.5;
        var pm = new THREE.Mesh(new THREE.CircleGeometry(pr, 18), patchMat);
        pm.rotation.x = -Math.PI / 2;
        var _px = (R() - 0.5) * 14, _pz = (R() - 0.5) * 14;
        /* 水场景：斑块不要落进湖里（在水面下会被半透明水透出来，看着像水里有洞） */
        if (cfg.water && _pz < 0.5) continue;
        pm.position.set(_px, 0.008 + i * 0.002, _pz);
        pm.scale.z = 0.62 + R() * 0.5;
        propRoot.add(pm);
      }
      var tuftMat = lam(cfg.id === 'field' ? C.wheat : 0x6f8a52);
      var pebbleMat = lam(C.steel);
      for (var k = 0; k < 34; k++) {
        var x = (R() - 0.5) * 20, z = (R() - 0.5) * 20;
        /* 湖里不长草：水面的那块（z 偏正）跳过 */
        if (cfg.water && z < -1.2) continue;   /* 只跳过水面那一片（岸上照常长草） */
        if (R() > 0.42) {
          var t = new THREE.Mesh(new THREE.ConeGeometry(0.09 + R() * 0.07, 0.3 + R() * 0.26, 3), tuftMat);
          t.position.set(x, 0.16, z);
          t.rotation.y = R() * 3.14;
          propRoot.add(t);
        } else {
          var pb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07 + R() * 0.07, 0), pebbleMat);
          pb.position.set(x, 0.05, z);
          propRoot.add(pb);
        }
      }
    })();

    /* 装饰 */
    (cfg.props || []).forEach(function (p) {
      var o = makeProp(p);
      if (!o) return;
      o.position.set(p.x || 0, 0, p.z || 0);
      if (p.rot) o.rotation.y = p.rot;
      propRoot.add(o);
    });

    /* 交互点：每处都是"能动手的"，与布景分开。
       ⚠️ 场景里这处写的是 `cai`（翻碎石堆），但**这一刻这一格能不能采集**由
       `jianghuActsAt(ci)` 说了算（荒野之事按日随机）。实测：场景里动手，
       `P.act` 直接回「此处野地无『采集』」—— 玩家会觉得"我明明站在碎石堆前"。
       所以装配时把每个节点的动作**对齐到这一格真实可做的动作**：
         节点动作可用 → 用它；
         不可用       → 退到入口动作（进场景时的那个）；
         入口动作也不可用 → 退到这一格第一个可用动作；
       整格没有可用动作 → 节点不建（场景只剩布景，不冒充"能动手"）。 */
    var _avail = (ctx && ctx.availableActs && ctx.availableActs.length) ? ctx.availableActs.slice() : null;
    if (!_avail) {
      _avail = (G.jianghuActsAt && ctx && ctx.ci != null) ? (G.jianghuActsAt(ctx.ci) || []).map(function (a) { return a.id; }) : [];
    }
    var _entryAct = (ctx && ctx.actId) || cfg.act;
    var _fallback = (_avail.indexOf(_entryAct) >= 0) ? _entryAct : (_avail[0] || null);

    (cfg.nodes || []).forEach(function (nd, i) {
      var _use = null;
      if (_avail.indexOf(nd.act) >= 0) _use = nd.act;
      else if (_fallback) _use = _fallback;
      if (!_use) return;                     /* 这格今天什么都不能做 → 不建节点 */
      nd = (function (q) { var o = {}; for (var k in q) o[k] = q[k]; o.act = _use; return o; })(nd);
      /* 动作被改写时，标签必须跟着改 ——
         实测：节点写「翻找碎石堆」，代理成 `bai` 之后结果卡是「拜访 · 行商的水囊」，
         两句话对不上，玩家只会觉得系统乱了。宁可让标签朴素一点，也不能说一套做一套。 */
      if (nd.act !== (cfg.nodes[i] || {}).act) {
        var _ad = (D && D.LING_ACT) ? D.LING_ACT[nd.act] : null;
        if (_ad) { nd.label = _ad.name; nd.hint = _ad.desc || nd.hint; }
      }
      var o = makeProp(nd.seed == null ? (function () { var q = {}; for (var k in nd) q[k] = nd[k]; q.seed = 100 + i; return q; })() : nd);
      if (!o) return;
      o.position.set(nd.x || 0, 0, nd.z || 0);
      if (nd.rot) o.rotation.y = nd.rot;
      var ring = gNodeRing(C.glow);
      ring.position.set(0, 0, 0);
      o.add(ring);
      /* 今天这一处是不是已经收拾过（进出场景、读档都记得） */
      var _wasDone = S.isDone(cfg.id, i);
      o.userData.node = { idx: i, act: nd.act, label: nd.label, hint: nd.hint, done: _wasDone, ring: ring };
      if (_wasDone) { ring.visible = false; dimProp(o); }
      propRoot.add(o);
      nodeList.push(o);
    });

    /* ---------- 遭遇（v141）：撞上一头废土物种 ----------
       第 11 种"场景内容"：不是布置好的交互点，而是**这一次走出来撞见的**。
       确定性抽（场景+格+天）→ 读档重进不会换对手；位置也按同一个哈希定。
       它不消耗"节点次数"，但赢了照常走斗将结算（经验/物资/头目服了）。 */
    var _enc = encounterFor(cfg, (ctx && ctx.ci != null) ? ctx.ci : 0);
    if (_enc) {
      var _eh = hashStr(cfg.id + '|enc|' + ((ctx && ctx.ci) | 0) + '|' + sceneDay());
      var _ex = ((_eh % 9) - 4) * 0.9, _ez = (((_eh >>> 4) % 7) - 3) * 0.9 - 1.2;
      var _b = PROP.beast(_eh % 97);
      _b.position.set(_ex, 0, _ez);
      var _ering = gNodeRing(C.red || 0xa8332a);
      _b.add(_ering);
      _b.userData.node = {
        idx: 900, duel: true, speciesId: _enc.id,
        label: '遭遇 · ' + _enc.name,
        hint: (_enc.tag || '') + '　动手就进斗将',
        done: false, ring: _ering,
      };
      propRoot.add(_b);
      nodeList.push(_b);
      ctx = ctx || {};
      ctx.encounter = _enc.id;
    }

    /* 玩家 */
    player = buildPlayer();
    player.position.set(0, 0, 4.5);
    propRoot.add(player);

    targetPt = null;
    cam.position.set(0, 18, 18);
    cam.lookAt(0, 0.6, 0);
    resize();
  }

  function buildPlayer() {
    var g = new THREE.Group();
    var body = mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.95, 8), lam(0x8ea6b8), 0, 0.5, 0);
    body.name = 'body';
    g.add(body);
    g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), lam(0xd9c7a8), 0, 1.14, 0));
    /* 单肩背包 + 一盏胸前的辐光小灯：废土科技的唯一"人味" */
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), lam(0x6b533a), 0, 0.62, -0.26));
    g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), lam(C.glow, { emissive: C.glow, emissiveIntensity: 1.0 }), 0, 0.82, 0.24));
    /* 脚下影子（一个压扁的暗圆）：没有阴影贴图时，它是"站在地上"的关键提示 */
    var sh = mesh(new THREE.CircleGeometry(0.36, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }), 0, 0.015, 0);
    sh.rotation.x = -Math.PI / 2;
    sh.name = 'shadow';
    g.add(sh);
    /* 头顶的指示三角：小场景里人物只有几十像素，不加这个容易"找不到自己"
       （俯视 60° 时人体被压扁，靠颜色分辨不够）。 */
    var mk = mesh(new THREE.ConeGeometry(0.17, 0.30, 4), new THREE.MeshBasicMaterial({ color: C.glow }),
      0, 1.66, 0);
    mk.rotation.x = Math.PI;         /* 尖朝下 */
    mk.name = 'marker';
    g.add(mk);
    /* 头顶标记**穿透遮挡**（只有它，不含身体）。
       第一版把整个人设成 depthTest:false，结果是"人浮在屋顶上"——
       因为玩家永远贴着南侧那栋房子，人就被画在那栋房的屋顶上（截图确认）。
       正确的做法是：身体老实被遮（该被挡就挡），
       但头顶那个三角永远可见 —— 玩家随时知道"我在哪"，画面也不假。 */
    mk.material.depthTest = false;
    mk.material.depthWrite = false;
    mk.renderOrder = 999;
    return g;
  }

  /* ---------- 输入 ---------- */
  function onKeyDown(e) {
    if (!openId) return;
    var k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); S.close(); return; }
    if (k === 'e' || k === 'E' || k === 'Enter') { e.preventDefault(); e.stopPropagation(); S.interact(); return; }
    if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(k) >= 0) {
      keys[k] = true;
      e.preventDefault(); e.stopPropagation();
    }
  }

  function onPointerDown(ev) {
    if (!openId) return;
    var r = cvs.getBoundingClientRect();
    var nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
    var ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
    var ray = new THREE.Raycaster();
    ray.setFromCamera({ x: nx, y: ny }, cam);
    /* 先点交互物：点到就走过去（并自动交互） */
    var hits = ray.intersectObjects(nodeList, true);
    if (hits.length) {
      var t = hits[0].object;
      while (t && !t.userData.node) t = t.parent;
      if (t && t.userData.node) {
        var d = dist2(t.position.x, t.position.z, player.position.x, player.position.z);
        if (d < 3.0) { S.interact(t); return; }
        targetPt = { x: t.position.x, z: t.position.z + 1.1, node: t };
        return;
      }
    }
    /* 点地：走过去 */
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var pt = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, pt)) {
      targetPt = { x: Math.max(-BOUND, Math.min(BOUND, pt.x)), z: Math.max(-BOUND, Math.min(BOUND, pt.z)), node: null };
    }
  }

  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

  /* ---------- 每帧 ---------- */
  function step(now) {
    if (!openId) return;
    rafId = requestAnimationFrame(step);
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;

    if (player) {
      var vx = 0, vz = 0;
      if (keys['w'] || keys['W'] || keys['ArrowUp']) vz -= 1;
      if (keys['s'] || keys['S'] || keys['ArrowDown']) vz += 1;
      if (keys['a'] || keys['A'] || keys['ArrowLeft']) vx -= 1;
      if (keys['d'] || keys['D'] || keys['ArrowRight']) vx += 1;
      if (vx || vz) {
        targetPt = null;                     /* 手动走动会取消点击寻路 */
        var len = Math.sqrt(vx * vx + vz * vz);
        movePlayer(vx / len * SPEED * dt, vz / len * SPEED * dt);
        bobWalk(now);
      } else if (targetPt) {
        var dx = targetPt.x - player.position.x, dz = targetPt.z - player.position.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 0.18) {
          var nd0 = targetPt.node; targetPt = null;
          if (nd0) S.interact(nd0);
        } else {
          var stp = Math.min(d, SPEED * dt);
          movePlayer(dx / d * stp, dz / d * stp);
          bobWalk(now);
        }
      } else {
        /* 站住：身体回正 */
        player.rotation.z *= 0.85;
        player.position.y += (0 - player.position.y) * 0.2;
      }
    }

    /* 走出城门 = 出城。
       为什么不只留"按 E 出城"：门就开在那儿，人走过去了还要回头按一下键，
       是"界面在演动作"。走进门洞、越过门槛，这件事本身就该成立。 */
    if (cityView && cityOutZ && player && player.position.z > cityOutZ) {
      S.close();
      if (G.ui && G.ui.toast) G.ui.toast('你走出城门，回到野外');
      return;
    }

    updateNear();
    animWorld(now);
    updateCamera(dt);
    if (waterMesh) {
      var pos = waterMesh.geometry.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        var x = pos.getX(i), y = pos.getY(i);
        /* 波幅 0.05/0.04，且基准高度（0.12）必须大于波幅 ——
           这是"湖里有洞"那个 bug 的唯一解法：只要波谷低于 0，就会有洞。 */
        pos.setZ(i, Math.sin(x * 0.5 + now * 0.0012) * 0.05 + Math.cos(y * 0.7 + now * 0.0016) * 0.04);
      }
      pos.needsUpdate = true;
    }
    R3.render(scene, cam);
  }

  function movePlayer(dx, dz) {
    var nx = player.position.x + dx, nz = player.position.z + dz;
    if (cityView && cityBounds) {
      /* 城内：先夹到城的活动范围，再**分轴**推进。
         分轴（先 x 后 z）的意义：正面撞墙时，另一个方向仍然能走 ——
         玩家沿着墙根侧滑过去，而不是"贴住就不动了"。整体回退做不到这一点。 */
      nx = Math.max(cityBounds.x0, Math.min(cityBounds.x1, nx));
      nz = Math.max(cityBounds.z0, Math.min(cityBounds.z1, nz));
      if (!hitsSolid(nx, player.position.z, CITY_R)) player.position.x = nx;
      if (!hitsSolid(player.position.x, nz, CITY_R)) player.position.z = nz;
    } else {
      nx = Math.max(-BOUND, Math.min(BOUND, nx));
      nz = Math.max(-BOUND, Math.min(BOUND, nz));
      player.position.x = nx; player.position.z = nz;
    }
    /* 朝向：把身体绕 Y 转到移动方向（影子不动） */
    var ang = Math.atan2(dx, dz);
    player.rotation.y += (ang - player.rotation.y) * 0.25;
  }

  function bobWalk(now) {
    /* 走的"重量感"：上下小幅 + 左右轻摆。没有骨骼，这是最便宜的读法。 */
    player.position.y = Math.abs(Math.sin(now * 0.011)) * 0.06;
    player.rotation.z = Math.sin(now * 0.0055) * 0.04;
  }

  var cityView = false;
  function updateCamera(dt) {
    if (!player) return;
    if (cityView) {
      /* 城内镜头 v142：**跟着人走**（v140 是钉死的俯瞰）。
         相机在玩家后方 12、高 20.6 → 52° 俯角；看向玩家**前方 3.5 米**。
         ⚠️ 这两个数是**量出来的，不是估的**：第一版看向前方 6 米，
         结果玩家本身被推到画面下边缘之外（正交投影下，玩家相对视线中心的
         屏幕偏移 = −lookY·cosθ − L·sinθ = −5.22 米，而半屏只有 5.5 米）——
         截图里整条街都在，就是看不到自己。改成 3.5 米后玩家落在下方 30%。
         为什么是 52° 而不是野地那种 45°：巷子只有 1.14 米宽，
         45° 时前方那排房子会把巷道整个挡住，屏幕上半部全是屋顶。 */
      var k = Math.min(1, dt * 5);
      var tx = player.position.x, tz = player.position.z;
      cam.position.x += (tx - cam.position.x) * k;
      cam.position.z += (tz + 8 - cam.position.z) * k;
      cam.position.y = 21.65;
      cam.lookAt(cam.position.x, 0.8, cam.position.z - 9.72);
      return;
    }
    var tx = player.position.x, tz = player.position.z;
    /* 相机跟人，但只跟一半：跟满会晕，不跟会走丢。
       倾角固定（不做旋转），所以 WASD 与屏幕方向永远一致。 */
    var cx = cam.position.x + (tx - cam.position.x) * Math.min(1, dt * 4.5);
    /* 相机在玩家后方 10、上方 18；看向**前方 7**（不是玩家本人）——
       这样玩家落在画面下三分之一，前方能看见要走的路。
       看向玩家本人会让"要去的方向"被挤到画面顶部，走起来一直像在低头看脚。 */
    var cz = cam.position.z + (tz + 10 - cam.position.z) * Math.min(1, dt * 4.5);
    cam.position.set(cx, 18, cz);
    cam.lookAt(cx, 0.6, cz - 17);
  }

  function animWorld(now) {
    if (!propRoot) return;
    /* 火苗与塔芯：轻微缩放 + 亮度呼吸（不需要真实光照） */
    propRoot.traverse(function (o) {
      if (!o.name) return;
      if (o.name === 'marker') {
        o.position.y = 1.62 + Math.sin(now * 0.004) * 0.07;
      } else if (o.name === 'flame') {
        var k = 0.9 + Math.sin(now * 0.012 + o.id) * 0.12;
        o.scale.set(k, 1.05 + Math.sin(now * 0.017 + o.id) * 0.1, k);
      } else if (o.name === 'core') {
        var k2 = 1 + Math.sin(now * 0.004) * 0.06;
        o.scale.set(k2, k2, k2);
        o.rotation.y += 0.004;
      }
    });
  }

  function updateNear() {
    if (!player) return;
    var best = null, bd = 2.6;
    for (var i = 0; i < nodeList.length; i++) {
      var o = nodeList[i], nd = o.userData.node;
      if (nd.done) { if (nd.ring) nd.ring.visible = false; continue; }
      var d = dist2(o.position.x, o.position.z, player.position.x, player.position.z);
      if (d < bd) { bd = d; best = o; }
      if (nd.ring) {
        var near = d < 2.6;
        nd.ring.visible = near;
        var s = 1 + Math.sin(performance.now() * 0.005) * 0.08;
        nd.ring.scale.set(s, s, s);
      }
    }
    if (best !== nearNode) {
      nearNode = best;
      renderHud();
    }
  }

  /* ---------- HUD（DOM 叠在 canvas 上） ---------- */
  function renderHud() {
    if (!layer) return;
    var old = layer.querySelector('.scene-ui');
    if (old) old.remove();
    /* 暗角（vignette）：一层径向渐变盖在 canvas 上。
       作用有两个：① 四角压暗，视线被收到中间；② 顶部本来就压暗，
       标题字压在浅色地面上也能读清（实测没它的时候金色标题在沙地上糊成一片）。 */
    if (!layer.querySelector('.scene-vig')) {
      var vig = document.createElement('div');
      vig.className = 'scene-vig';
      vig.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;'
        + 'background:radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 42%, rgba(0,0,0,.46) 100%);';
      layer.appendChild(vig);
    }
    if (!openId) return;
    var cfg = (openId === 'city')
      ? { name: '我的城', sub: '在街上走走 —— 走出城门就是出城' }
      : (sceneCfg(openId) || {});
    var ui = document.createElement('div');
    ui.className = 'scene-ui';
    ui.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;';
    var nd = nearNode && nearNode.userData.node;
    var nodesTotal = nodeList.length;
    var nodesDone = nodeList.filter(function (o) { return o.userData.node.done; }).length;
    ui.innerHTML =
      '<div style="position:absolute;left:0;top:0;right:0;padding:10px 14px;'
      + 'background:linear-gradient(to bottom,rgba(6,8,11,.94) 0%,rgba(6,8,11,.72) 55%,rgba(6,8,11,0) 100%);">'
      + '<div style="font-size:var(--fs-h2);font-weight:700;color:var(--gold-light);letter-spacing:1px;">'
      + U.escape(cfg.name || '') + '</div>'
      + '<div style="font-size:var(--fs-cap);color:var(--text-dim);margin-top:2px;">'
      + U.escape(cfg.sub || '')
      /* 城内不报"几处已收拾"：那里的节点是 48 栋房子，不是可采集点，
         报个 0/48 会让人以为"什么都没做"。 */
      + (openId === 'city' ? '' : ('　<b style="color:var(--green-ok);">' + nodesDone + '/' + nodesTotal + '</b> 处已收拾'))
      + '</div>'
      + '</div>'
      /* 交互提示条放底部中间：视线在场景中心，提示不该在角落 */
      + '<div style="position:absolute;left:50%;bottom:52px;transform:translateX(-50%);'
      + 'padding:7px 16px;border-radius:6px;background:rgba(10,12,16,.86);border:1px solid '
      + (nd ? 'var(--gold-light)' : 'var(--line)') + ';color:' + (nd ? 'var(--gold-light)' : 'var(--text-dim)')
      + ';font-size:var(--fs-body);white-space:nowrap;">'
      + (nd ? ('<b>[E]</b> ' + U.escape(nd.label || '动手') + '　<span style="opacity:.7;font-size:var(--fs-cap);">'
        + U.escape(nd.hint || '') + '</span>') : '走到发光的东西旁边，才能动手')
      + '</div>'
      + '<div style="position:absolute;left:14px;bottom:14px;font-size:var(--fs-cap);color:var(--text-dim);">'
      + (openId === 'city'
        ? 'WASD / 方向键 逛街　·　点地面走过去　·　走出城门回野外'
        : 'WASD / 方向键 走动　·　点地面走过去　·　点发光处自动靠近')
      + '</div>'
      + '<div style="position:absolute;right:14px;bottom:14px;pointer-events:auto;">'
      + '<button data-scene="close" style="padding:6px 14px;border-radius:5px;cursor:pointer;'
      + 'background:#1a1e25;border:1px solid var(--line);color:var(--text);font-size:var(--fs-cap);">'
      + '离开（Esc）</button></div>';
    layer.appendChild(ui);
    ui.addEventListener('click', function (e) {
      var b = e.target.closest('[data-scene="close"]');
      if (b) S.close();
    });
  }

  /* ============================================================
   * 城内 3D（v140 · 回答老板「如何将城内外转成 3D」）
   * ------------------------------------------------------------
   * 城内和野地不同：它**本来就有坐标**（`city.cells[idx]`，idx = row*col + col）。
   * 所以"转 3D"不是重建世界，而是**换一层呈现**：
   *     col/row → (x, z)        T = 每个格子在世界里的边长
   *     cell.build.id + lvl → 建筑模块（越高越像样）
   *     cell.official → 政务厅（2×2 占地，单独一块）
   * 数据一个字段都不改 —— 存档、建造、产出、科技前置全部照旧走原来的 `city`，
   * 3D 只是"换个角度看同一份数据"。这也是它能安全上线的唯一理由。
   * ============================================================ */
  /* ------------------------------------------------------------
   * v142：从"俯瞰沙盘"改成"能逛的街区"（老板：继续做城内街区）
   * ------------------------------------------------------------
   * v140 的城内是这样的：相机钉死在 20 米高空、看全整座 8×6 的城，
   * 每格 2.1 米、建筑占 70% → 巷子只剩 0.63 米，**比人还窄**，
   * 所以那时候只能俯瞰：走进去会卡在房子缝里。
   *
   * 三个数改完，它才成其为街区：
   *   CITY_T  3.0   格子边长。8×6 → 24×18 米，一屏（视口 11）看到四分之一，
   *                 这才有"逛"的余地；2.1 的时候整城只有 16.8 米，一屏全收。
   *   CITY_BW 1.40  建筑占地 → 巷道 1.60 米。人宽 0.60（半径 0.30）。
   *                 1.14 是"刚好挤过去"，但**贴墙的距离只有 0.03 米**，
   *                 相机一有俯角，南侧那面墙就把人挡没了（截图确认：
   *                 60° 时只剩一个头顶三角在飘）。1.60 让贴身距离变成 0.5 米，
   *                 65° 俯角下墙顶的遮挡落到脚踝，人才完整可见。
   *   CITY_R  0.30  人的碰撞半径（比模型略大一点点，贴墙时不会露出半个身子）。
   *
   * 碰撞用**分轴推进**（先试 x、再试 z），撞墙就贴着墙滑 ——
   * 不像"整体回退"那样一碰就定住，沿墙走的手感全靠这一条。
   * ------------------------------------------------------------ */
  var CITY_T = 3.0;
  var CITY_BW = 1.40;
  var CITY_R = 0.30;
  /* 围墙离格子区的距离。0.9 的时候，城门内侧只剩 1.35 米空地，
     玩家出生就站在门楣底下 —— 65° 俯角下门楣把人挡到只剩脚（截图确认）。
     2.2 让墙根有一圈 2.5 米宽的空地，出生点能退到门外看不见的位置。 */
  var CITY_PAD = 2.2;
  var citySolids = [], cityBounds = null, cityOutZ = 0;

  /* 圆 vs 轴对齐盒：把圆心夹到盒上取最近点，比半径近就是撞了。
     比"点在盒内"多一步，好处是**贴墙滑行时不会在角上抖**。 */
  function hitsSolid(x, z, r) {
    for (var i = 0; i < citySolids.length; i++) {
      var s = citySolids[i];
      var cx = x < s.x0 ? s.x0 : (x > s.x1 ? s.x1 : x);
      var cz = z < s.z0 ? s.z0 : (z > s.z1 ? s.z1 : z);
      var dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  /* ============================================================
   * cityPlan —— 城内的**几何真值**（纯函数，不碰 THREE / DOM）
   * ------------------------------------------------------------
   * 为什么要单独一份：渲染要 THREE，门禁跑在 node 里没有 WebGL。
   * 如果"碰撞盒在哪、巷道多宽、门洞多宽"只在 buildCityScene 里算，
   * 那这些问题就只能靠肉眼截图验证 —— 而截图看不出"这条路其实走不通"。
   *
   * 所以：**几何只算一次**（这里），渲染照着画，碰撞照着用。
   * 这不是"两本账"，是同一本账的两个读者 —— 与 v136 斗将 HP 那种
   * "呈现层偷偷算了一份"是两回事。
   * ============================================================ */
  function cityPlan(c) {
    var COLS = c.col || 8, ROWS = c.row || 6;
    var T = CITY_T, bw = CITY_BW;
    var W = COLS * T, D = ROWS * T;
    var hw = W / 2 + CITY_PAD, hd = D / 2 + CITY_PAD;
    var gateHalf = 1.6;
    var out = {
      cols: COLS, rows: ROWS, T: T, bw: bw, walk: T - bw, W: W, D: D,
      hw: hw, hd: hd, gateHalf: gateHalf, outZ: hd + 1.9,
      /* 出生点：城门内侧的墙根空地，离门 1.75 米 ——
         刚好退出门楣在 65° 俯角下的遮挡锥（门楣底 3.02 − 1.75×tan65° = −0.7，
         也就是说视线到这里已经落到地面以下，人整条都看得见）。
         这个数是按遮挡锥算的，不是估的。 */
      spawn: { x: 0, z: hd - 1.75 },
      bounds: { x0: -hw + 0.35, x1: hw - 0.35, z0: -hd + 0.35, z1: hd + 2.6 },
      cells: [], solids: [], wall: false,
    };
    function solid(cx, cz, w, d) {
      out.solids.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    }

    var cells = c.cells || [];
    /* ⚠️ 政务厅占 2×2，四格的 `official` **都是 true**（不是 1/2/3/4）。
       v140 写的是 `official === 1 || official === true` —— 前半句永远不成立、
       后半句四格全中，于是**同一座衙门被画了四遍**（v142 截图确认：
       中央一大块、四个角各一面红旗）。既有的口径是"取下标最小的那一格做代表"
       （domain.js:4841 `idx !== gfFirst` 就是这条），这里照抄，不另立规矩。 */
    var govIdx = -1;
    for (var gi = 0; gi < cells.length; gi++) {
      if (cells[gi] && cells[gi].official) { govIdx = gi; break; }
    }
    for (var idx = 0; idx < cells.length; idx++) {
      var cell = cells[idx];
      var col = idx % COLS, row = Math.floor(idx / COLS);
      var x = (col - (COLS - 1) / 2) * T;
      var z = (row - (ROWS - 1) / 2) * T;
      var it = { idx: idx, col: col, row: row, x: x, z: z, kind: 'empty', bid: null, lvl: 0, plaza: null };
      if (!cell) { it.kind = 'void'; out.cells.push(it); continue; }
      if (cell.official) {
        it.kind = (idx === govIdx) ? 'gov' : 'govPart';
        if (idx === govIdx) {
          it.lvl = (c.gov && c.gov.lvl) || 1;
          it.gx = x + T * 0.5; it.gz = z + T * 0.5;
          it.gw = T * 2 - (T - bw);
          solid(it.gx, it.gz, it.gw + 0.3, it.gw + 0.3);
        }
      } else if (cell.build && cell.build.id) {
        it.kind = 'house'; it.bid = cell.build.id; it.lvl = cell.build.lvl || 1;
        solid(x, z, bw + 0.16, bw + 0.16);
      } else {
        /* 空地：按格子下标决定放什么（确定性，不用随机流，免得和建筑抖动抢） */
        var hv = ((idx * 2654435761) >>> 0) % 1000 / 1000;
        if (hv < 0.55) {
          var kinds = ['well', 'pile', 'brazier', 'rack'];
          it.plaza = kinds[Math.floor(hv * 7) % kinds.length];
          if (it.plaza === 'well') solid(x, z, 0.9, 0.9);
          else if (it.plaza === 'pile') solid(x, z, 0.95, 0.95);
          else if (it.plaza === 'brazier') solid(x, z, 0.6, 0.6);
          /* rack（晾架）：两根细杆，不占地 */
        }
      }
      out.cells.push(it);
    }

    /* 墙：南面留门洞。四段 + 两个门柱，都是碰撞体 —— 玩家只能从门洞出去。
       这就是"城门"能成立的全部机制：不是按钮，是墙上真的少了一块。 */
    if (c.wall && c.wall.build) {
      out.wall = true;
      solid(0, -hd, W + CITY_PAD * 2 + 0.8, 0.7);                    /* 北 */
      solid(-(hw + gateHalf) / 2, hd, hw - gateHalf + 0.2, 0.7);      /* 南 · 左 */
      solid((hw + gateHalf) / 2, hd, hw - gateHalf + 0.2, 0.7);       /* 南 · 右 */
      solid(-hw, 0, 0.7, D + CITY_PAD * 2);                          /* 西 */
      solid(hw, 0, 0.7, D + CITY_PAD * 2);                           /* 东 */
    }
    solid(-gateHalf, hd, 0.5, 0.7);
    solid(gateHalf, hd, 0.5, 0.7);
    return out;
  }
  S.cityPlan = cityPlan;
  S.cityGeo = { T: CITY_T, bw: CITY_BW, walk: CITY_T - CITY_BW, r: CITY_R, pad: CITY_PAD };

  function buildCityScene() {
    var c = G.currentCity ? G.currentCity() : null;
    if (!c) return false;
    /* 几何真值来自 cityPlan（碰撞、门洞、活动范围都在那一份里算好）。
       这里只负责"照着画"，不再自己算坐标 —— 各算一份就是两本账。 */
    var plan = cityPlan(c);
    var COLS = plan.cols, ROWS = plan.rows, W = plan.W, D = plan.D;
    var R = rng(7788);
    citySolids = plan.solids;
    cityBounds = plan.bounds;
    cityOutZ = plan.outZ;

    /* 城内雾 0.006 —— 0.016 在这个距离上把所有颜色洗成灰褐色，
       整张图像蒙了一层土（截图确认）。城内是"看自己的城"，不该有野地那种空气感。
       v142 相机拉近到视口 11、贴地 50° 走，雾再淡一档（0.004）：
       否则街对面的房子已经发灰，"巷子有多深"读不出来。 */
    scene.background = new THREE.Color(0x9db0bd);
    scene.fog = new THREE.FogExp2(0x9db0bd, 0.004);

    /* 地面：v142 从"棋盘格线"换成**石板路**
       —— 格线是给俯瞰沙盘用的（让人数格子）；街区视角要的是"脚下是路"，
       格线反而把街区切回成表格。石板缝本身就能读出尺度，不需要再画格子。 */
    var cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    var g2 = cv.getContext('2d');
    /* 底色 = 石缝的深色，石块压在上面 */
    g2.fillStyle = '#4e4739'; g2.fillRect(0, 0, 512, 512);
    /* 8×8 块石板（每块 0.75 米，512px 对应 6 米）+ 半块错缝：
       错缝是关键 —— 齐缝看起来像瓷砖，错缝才像人铺的路。 */
    for (var by2 = 0; by2 < 8; by2++) {
      var off2 = (by2 % 2) * 32;
      for (var bx2 = -1; bx2 < 9; bx2++) {
        var bx0 = bx2 * 64 + off2, by0 = by2 * 64;
        var lv2 = (R() - 0.5) * 0.15;
        var sc2 = new THREE.Color(0x6e655a).offsetHSL((R() - 0.5) * 0.02, 0.02 * (R() - 0.5), lv2);
        g2.fillStyle = '#' + sc2.getHexString();
        g2.fillRect(bx0 + 2, by0 + 2, 60, 60);
        /* 每块石板的右上角打亮一点：给"石面"一点高低差，不只是色块 */
        g2.fillStyle = 'rgba(255,246,224,0.05)';
        g2.fillRect(bx0 + 2, by0 + 2, 60, 5);
      }
    }
    /* 磨痕：横竖各几道浅色擦痕（被车辙/脚踩出来的） */
    for (var mg = 0; mg < 24; mg++) {
      g2.strokeStyle = 'rgba(210,198,170,0.055)';
      g2.lineWidth = 1 + R() * 3;
      g2.beginPath();
      var mx = R() * 512, my = R() * 512;
      g2.moveTo(mx, my); g2.lineTo(mx + (R() - 0.5) * 90, my + (R() - 0.5) * 20);
      g2.stroke();
    }
    /* 碎石与土渣：叠在石缝上，破掉"新铺的路"那种干净 */
    for (var st2 = 0; st2 < 1400; st2++) {
      var dv2 = (R() - 0.5) * 0.22;
      g2.fillStyle = '#' + new THREE.Color(0x6a6152).offsetHSL(0, 0, dv2).getHexString();
      g2.fillRect(R() * 512, R() * 512, 1 + R() * 2, 1 + R() * 2);
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    var padW = W + CITY_PAD * 2 + 2, padD = D + CITY_PAD * 2 + 2;
    tex.repeat.set(padW / 6, padD / 6);      /* 纹理 1 tile = 6 米 */
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(padW, padD),
      new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    propRoot.add(ground);
    /* 城外：一大块夯土（不铺石板）。没有它，石板四周就是虚空，
       走出城门时"城外"和"世界尽头"分不开。 */
    /* 十字主街：中央一纵一横铺**浅色**石板。
       所有巷道一样宽的城读不出"主街在哪"，走到哪都像在迷宫；
       一条亮一点的路，玩家自然往那儿走（也解释了为什么城门开在南面正中）。 */
    var roadMat = new THREE.MeshLambertMaterial({ color: 0x8a8170 });
    var roadV = new THREE.Mesh(new THREE.PlaneGeometry(CITY_T - CITY_BW, D + CITY_PAD * 2), roadMat);
    roadV.rotation.x = -Math.PI / 2; roadV.position.set(0, 0.021, 0);
    propRoot.add(roadV);
    var roadH = new THREE.Mesh(new THREE.PlaneGeometry(W + CITY_PAD * 2, CITY_T - CITY_BW), roadMat);
    roadH.rotation.x = -Math.PI / 2; roadH.position.set(0, 0.022, 0);
    propRoot.add(roadH);

    var outTex = groundTexture(0x7d6f55, 4242, 'ash');
    outTex.repeat.set(9, 9);
    var outG = new THREE.Mesh(new THREE.PlaneGeometry(80, 80),
      new THREE.MeshLambertMaterial({ map: outTex }));
    outG.rotation.x = -Math.PI / 2;
    propRoot.add(outG);

    /* 建筑模块：只按"分类 + 等级"给形，不为每个建筑单独建模。
       Lv 决定层数/高度 —— Lv5 的三层楼和 Lv1 的窝棚，一眼能分出来。 */
    /* 分类配色：v140 全是灰黄，截图里整座城是一块石头 —— 分不出兵营、作坊、民房。
       v142 按"材质"分开：夯土 / 木 / 铁灰 / 锈红，远看一片街，近看有区别。 */
    var CAT_COL = { gov: 0xcbb282, prod: 0xb08b4e, mil: 0x7d8790, live: 0xd2bb95, craft: 0xb4643a, other: 0x9a9384 };
    /* 建筑名：三个可能的表都试一遍（DATA.BUILDINGS 在，但早先实测标签印出了裸 id，
       说明取名字这一步在某些加载顺序下拿不到 —— 多兜一层比猜便宜）。 */
    function bname(bid) {
      var t = [D && D.BUILDINGS, D && D.BUILD, G && G.DATA && G.DATA.BUILDINGS];
      for (var i = 0; i < t.length; i++) {
        var e = t[i] && t[i][bid];
        if (e && e.name) return e.name;
      }
      return bid;
    }
    function catOfBid(bid) {
      var B = (D && D.BUILDINGS) ? D.BUILDINGS[bid] : null;
      if (!B) return 'other';
      var cat = B.cat || '';
      if (B.mil || /junying|xiaochang|chengqiang|majiu/.test(bid)) return 'mil';
      if (/minfang|juzhu/.test(bid)) return 'live';
      if (/nongtian|linchang|caikuang|shuijing/.test(bid)) return 'prod';
      if (/tiejiang|gongjiang|zuofang|shuyuan|keyan/.test(bid)) return 'craft';
      return cat === 'gov' ? 'gov' : 'other';
    }
    function house(bid, lvl, x, z, cidx) {
      var grp = new THREE.Group();
      var cat = catOfBid(bid);
      var base = CAT_COL[cat] || CAT_COL.other;
      if (lvl > 6) lvl = 6;
      /* 高度：v140 是 1.35 + 0.62/级 —— 在 2.1 米的格子里像一根根烟囱。
         格子放大到 3 米、占地 1.86 之后，房子要"矮而宽"才像沿街的铺面：
         一层 1.15 米，每级 +0.42（最高 6 级 3.25，是城里最高的楼）。 */
      var h = 1.0 + (lvl - 1) * 0.30;
      var w = CITY_BW, d = CITY_BW;
      /* 地基台：比墙宽一圈的矮台。没有它，墙是"插"在地里的，
         加了这一圈，房子才像"盖"在地上的。 */
      grp.add(mesh(new THREE.BoxGeometry(w + 0.16, 0.12, d + 0.16), lam(0x7f786a), 0, 0.06, 0));
      grp.add(mesh(new THREE.BoxGeometry(w, h, d), lam(base), 0, 0.12 + h / 2, 0));
      var topY = 0.12 + h;

      /* 屋顶分两种：
           mil  → 平顶 + 女儿墙（营房/城墙/马厩那种"能站人"的顶）
           其余 → 四棱锥坡顶
         两种屋顶一眼能分出"这片是兵营还是民宅"，不用点开面板。 */
      if (cat === 'mil') {
        [[0, -d / 2 + 0.06, w + 0.04, 0.07], [0, d / 2 - 0.06, w + 0.04, 0.07],
         [-w / 2 + 0.06, 0, 0.07, d + 0.04], [w / 2 - 0.06, 0, 0.07, d + 0.04]].forEach(function (q) {
          grp.add(mesh(new THREE.BoxGeometry(q[2], 0.22, q[3]), lam(0x6f6a5e), q[0], topY + 0.11, q[1]));
        });
        /* 沙袋：平顶上码两个，像有人守 */
        grp.add(mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), lam(0x8a7a5c), -w * 0.22, topY + 0.30, 0));
      } else {
        /* 檐口：比墙宽一圈的薄板，压住墙顶。
           没有它，坡屋顶在 45° 俯视下只剩一条深边，整栋楼读起来是"平顶盒子"
           （v142 第一版截图：一整条街全是灰箱子）。 */
        grp.add(mesh(new THREE.BoxGeometry(w * 1.10, 0.07, d * 1.10),
          lam(new THREE.Color(base).multiplyScalar(0.44).getHex()), 0, topY + 0.02, 0));
        var roof = mesh(new THREE.ConeGeometry(w * 0.78, 0.46 + lvl * 0.03, 4),
          lam(new THREE.Color(base).multiplyScalar(0.50).getHex()), 0, topY + 0.28, 0);
        roof.rotation.y = Math.PI / 4;
        grp.add(roof);
        /* 屋脊：沿 x 一条深色细梁，坡顶就有了"脊"（三件里最便宜的一件） */
        grp.add(mesh(new THREE.BoxGeometry(w * 0.42, 0.05, 0.07),
          lam(new THREE.Color(base).multiplyScalar(0.34).getHex()), 0, topY + 0.52 + lvl * 0.03, 0));
        /* 瓦垄：两条沿坡面的横向细条。65° 俯视时坡顶只占十几像素，
           没有这两条，屋顶就是一块均匀的色板（"像纸盒"的主要来源）。 */
        var tileMat = lam(new THREE.Color(base).multiplyScalar(0.40).getHex());
        [-0.30, 0.30].forEach(function (tz2) {
          var tl = mesh(new THREE.BoxGeometry(w * 0.86, 0.03, 0.05), tileMat, 0,
            topY + 0.40 - Math.abs(tz2) * 0.22, tz2 * d * 0.72);
          grp.add(tl);
        });
      }

      /* 门朝 +z（相机在南边往北看，+z 面就是玩家看到的那一面）。
         门、窗、台阶、招牌都在这一面 —— 巷子两侧全是"店面"，这就是街区感。 */
      var face = d / 2 + 0.02;
      grp.add(mesh(new THREE.BoxGeometry(0.36, 0.66, 0.06), lam(0x3f3123), 0, 0.45, face));
      grp.add(mesh(new THREE.BoxGeometry(0.42, 0.06, 0.10), lam(0x5a4a34), 0, 0.79, face + 0.02));
      /* 台阶：一小条石阶，暗示"要跨一步才进去" */
      grp.add(mesh(new THREE.BoxGeometry(0.62, 0.07, 0.18), lam(0x8b8272), 0, 0.035, face + 0.10));
      /* 窗：住人/作坊才点灯（空建筑不点 —— 夜里的"人气"就是这么读出来的） */
      if (cat === 'live' || cat === 'craft' || cat === 'gov') {
        var wm = lam(C.glow, { emissive: C.glow, emissiveIntensity: 0.55 });
        grp.add(mesh(new THREE.BoxGeometry(0.20, 0.20, 0.04), wm, -w * 0.30, 0.82 + h * 0.28, face));
        grp.add(mesh(new THREE.BoxGeometry(0.20, 0.20, 0.04), wm, w * 0.30, 0.82 + h * 0.28, face));
      }
      /* 门雨棚：门上一块斜板。有它，门口就有"阴影"，
         不然门只是墙上一块深色贴片（截图确认：远看像一个个洞）。 */
      var awn = mesh(new THREE.BoxGeometry(0.78, 0.05, 0.34), lam(new THREE.Color(base).multiplyScalar(0.52).getHex()),
        0, 0.92, face + 0.14);
      awn.rotation.x = -0.22;
      grp.add(awn);
      /* 招牌：一小块按分类上色的板，挂在门楣上。远看是一排彩色小块，
         近看知道"这栋是作坊/民房/兵营"。 */
      if (lvl >= 2) {
        grp.add(mesh(new THREE.BoxGeometry(0.56, 0.13, 0.04), lam(C.neon, { emissive: C.neon, emissiveIntensity: 0.4 }),
          0, 0.98 + h * 0.22, face + 0.04));
      }
      /* 街边小物件：木桶 / 货箱 / 花盆 / 拴马桩（4 成房子有，贴着自己的墙边放）。
         尺寸压到 0.26 以内、位置贴墙 —— 巷道 1.6 米，剩 1.3 米给人走。
         这类东西**不进碰撞表**：挡路的装饰是纯负担，踩过去就好。 */
      var side = R() < 0.5 ? -1 : 1;
      var sx2 = side * (w / 2 + 0.16), sz2 = face + 0.22;
      var kind2 = Math.floor(R() * 4);
      if (R() < 0.42) {
        if (kind2 === 0) {
          grp.add(mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.34, 8), lam(C.wood), sx2, 0.17, sz2));
          grp.add(mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.04, 8), lam(0x4a3b28), sx2, 0.36, sz2));
        } else if (kind2 === 1) {
          grp.add(mesh(new THREE.BoxGeometry(0.26, 0.24, 0.26), lam(0x8a7a5c), sx2, 0.12, sz2));
        } else if (kind2 === 2) {
          grp.add(mesh(new THREE.CylinderGeometry(0.10, 0.13, 0.16, 6), lam(0x9a6a4a), sx2, 0.08, sz2));
          grp.add(mesh(new THREE.ConeGeometry(0.16, 0.20, 5), lam(C.moss), sx2, 0.24, sz2));
        } else {
          grp.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 5), lam(C.woodDark), sx2, 0.25, sz2));
          grp.add(mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), lam(C.woodDark), sx2, 0.46, sz2));
        }
      }
      /* Lv≥3 加一层"楼"；Lv≥4 加水塔/天线 —— 等级看得见，不用点开面板 */
      if (lvl >= 3) {
        grp.add(mesh(new THREE.BoxGeometry(w * 0.78, 0.56, d * 0.78), lam(base), 0, topY + 0.28, 0));
        grp.add(mesh(new THREE.BoxGeometry(w * 0.62, 0.05, d * 0.62), lam(0x6f6a5e), 0, topY + 0.56, 0));
      }
      if (lvl >= 4) {
        grp.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 8), lam(0x8a8f96), w * 0.24, topY + 0.70, -d * 0.2));
        grp.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 5), lam(0x6b7684), w * 0.24, topY + 1.06, -d * 0.2));
      }
      /* 烟囱：三成的房子有（确定性随机，同一座城每次进来一样） */
      if (R() < 0.32) {
        grp.add(mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), lam(0x6f6a5e), -w * 0.26, topY + 0.30, -d * 0.22));
      }
      grp.add(contactShadow(CITY_BW * 0.62));
      grp.position.set(x, 0, z);
      grp.userData.node = { info: true, idx: cidx, label: bname(bid) + ' Lv' + lvl, bid: bid, lvl: lvl, cat: cat };
      propRoot.add(grp);
      nodeList.push(grp);
      /* 碰撞盒不在这里加 —— 在 cityPlan 里按同一套尺寸算好了（渲染只管画） */
      return grp;
    }

    /* 街道道具：只在"能站人的地方"放，且**一律不挡主通道**
       —— 玩家要在 1.14 米的巷子里走，任何占地的装饰都会把巷子卡成死胡同。
       所以：装饰要么挂高（灯笼）、要么贴在墙面（招牌/窗），
       要么放在空地格中间（那一格本来就空）。 */
    function laneLamp(x, z) {
      var g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.95, 6), lam(0x4a4740), 0, 0.98, 0));
      /* 灯头：一个倒锥铁皮罩 + 里面的暖光球（夜里是城里的"星星"） */
      /* 灯头：一个**尖朝下**的漏斗铁罩 + 罩口露出来的暖光球。
         v142 第一版罩子尖朝上（Three 的 Cone 默认），球被罩在里面 ——
         52° 俯视时只看得见一个灰罩子，灯是"灭"的（截图确认）。
         翻过来，光就露出来了。 */
      var shade = mesh(new THREE.ConeGeometry(0.17, 0.16, 6), lam(0x5a5449), 0, 1.95, 0);
      shade.rotation.x = Math.PI;
      g.add(shade);
      g.add(mesh(new THREE.SphereGeometry(0.085, 8, 6), lam(C.neon, { emissive: C.neon, emissiveIntensity: 0.95 }), 0, 1.86, 0));
      g.add(contactShadow(0.16));
      g.position.set(x, 0, z);
      propRoot.add(g);
      /* 细杆不进碰撞表：玩家宁可穿过去，也不要被一根灯杆卡在巷口 */
      return g;
    }

    function plazaPiece(x, z, kind, seed) {
      var g = new THREE.Group(), Rp = rng(seed);
      if (kind === 'well') {
        /* 水井：井圈 + 两根立柱 + 小顶 —— 空地格的"中心物" */
        g.add(mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.34, 12), lam(0x8b8272), 0, 0.17, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12), lam(0x2d2a24), 0, 0.33, 0));
        [-0.34, 0.34].forEach(function (qx) {
          g.add(mesh(new THREE.BoxGeometry(0.07, 0.86, 0.07), lam(C.woodDark), qx, 0.43, 0));
        });
        g.add(mesh(new THREE.BoxGeometry(0.86, 0.06, 0.5), lam(C.wood), 0, 0.86, 0));
      } else if (kind === 'pile') {
        /* 货堆：几个箱子 + 一个桶，空地上"这里有人做生意" */
        for (var pi = 0; pi < 4; pi++) {
          var pw = 0.26 + Rp() * 0.12, ph = 0.22 + Rp() * 0.12;
          var px2 = (Rp() - 0.5) * 0.5, pz2 = (Rp() - 0.5) * 0.5;
          g.add(mesh(new THREE.BoxGeometry(pw, ph, pw), lam(Rp() < 0.5 ? C.wood : 0x8a7a5c),
            px2, ph / 2, pz2));
        }
      } else if (kind === 'brazier') {
        /* 火盆：营地里那口烧着的铁盆，夜里能看见城还活着 */
        g.add(mesh(new THREE.CylinderGeometry(0.20, 0.28, 0.30, 8), lam(0x3a3630), 0, 0.15, 0));
        var fl = mesh(new THREE.ConeGeometry(0.18, 0.44, 6), lam(0xff8b3d, { emissive: 0xff8b3d, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }), 0, 0.48, 0);
        fl.name = 'flame';
        g.add(fl);
      } else {
        /* 晾衣/木架：两根杆 + 一条横木（不占地，纯剪影） */
        [-0.4, 0.4].forEach(function (qx) {
          g.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 5), lam(C.woodDark), qx, 0.75, 0));
        });
        g.add(mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), lam(C.wood), 0, 1.45, 0));
        g.add(mesh(new THREE.BoxGeometry(0.34, 0.4, 0.02), lam(0x9a8d74), -0.18, 1.18, 0));
        g.add(mesh(new THREE.BoxGeometry(0.28, 0.34, 0.02), lam(0x7a6a52), 0.2, 1.21, 0));
      }
      g.position.set(x, 0, z);
      propRoot.add(g);
      return g;
    }

    for (var ci2 = 0; ci2 < plan.cells.length; ci2++) {
      var it = plan.cells[ci2];
      if (it.kind === 'void') continue;
      var x = it.x, z = it.z;
      /* 政务厅占 4 格：只有 lead 那一格画，其余三格跳过 */
      if (it.kind === 'govPart') continue;
      if (it.kind === 'gov') {
        var glv = it.lvl;
        var gW = it.gw;
        /* 墙面要"露得出来"：v142 第一版 gh=1.8、屋顶半径 gW*0.82（底面 5.1 米），
           65° 俯角下屋顶把 4.4 米的墙面**整面盖住** —— 截图里政务厅就是一块棕色大板，
           门、窗、匾额一个都看不见。gh 抬到 2.2、屋顶收到 0.66（底面 4.1 米），
           墙面才露出来。 */
        var gh = 2.2;
        var gov = new THREE.Group();
        gov.add(mesh(new THREE.BoxGeometry(gW + 0.26, 0.18, gW + 0.26), lam(0x7f786a), 0, 0.09, 0));
        gov.add(mesh(new THREE.BoxGeometry(gW, gh, gW), lam(0xc9b07a), 0, 0.18 + gh / 2, 0));
        /* 屋顶：大四棱锥 + 正脊上的旗杆。政务厅是全城最高的那栋，
           "一眼能找到衙门"比任何标签都省事。 */
        gov.add(mesh(new THREE.BoxGeometry(gW * 1.02, 0.09, gW * 1.02), lam(0x4e5a58), 0, 0.18 + gh + 0.05, 0));
        /* 重檐：下大上小两层坡顶。单层大锥在 45° 下是一整块棕色，
           加一层小的，屋脊的位置就出来了（衙门的分量也在这）。 */
        var gr2 = mesh(new THREE.ConeGeometry(gW * 0.66, 0.62, 4), lam(0x62706e), 0, 0.18 + gh + 0.36, 0);
        gr2.rotation.y = Math.PI / 4; gov.add(gr2);
        var gr3 = mesh(new THREE.ConeGeometry(gW * 0.46, 0.50, 4), lam(0x4e5a58), 0, 0.18 + gh + 0.90, 0);
        gr3.rotation.y = Math.PI / 4; gov.add(gr3);
        gov.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), lam(0x6b7684), 0, 0.18 + gh + 1.55, 0));
        gov.add(mesh(new THREE.BoxGeometry(0.46, 0.28, 0.03), lam(C.blood, { emissive: C.blood, emissiveIntensity: 0.3 }), 0.24, 0.18 + gh + 1.68, 0));
        /* 柱廊：正门四根柱子撑一段檐（衙门感全在这四根柱子上） */
        [-gW * 0.36, -gW * 0.12, gW * 0.12, gW * 0.36].forEach(function (qx) {
          gov.add(mesh(new THREE.CylinderGeometry(0.075, 0.085, 1.25, 6), lam(0xd6c49a), qx, 0.72, gW / 2 + 0.42));
        });
        gov.add(mesh(new THREE.BoxGeometry(gW * 0.92, 0.14, 0.9), lam(0x9a8a68), 0, 1.4, gW / 2 + 0.42));
        gov.add(mesh(new THREE.BoxGeometry(0.62, 0.86, 0.07), lam(0x3f3123), 0, 0.61, gW / 2 + 0.02));
        /* 匾额 + 两排窗：衙门那面墙 4.4 米宽，只有一扇门的话就是一块"棕色大板"
           （v142 截图确认：整栋楼读不出是房子）。 */
        gov.add(mesh(new THREE.BoxGeometry(1.5, 0.34, 0.05), lam(0x2f2a22), 0, 1.28, gW / 2 + 0.05));
        gov.add(mesh(new THREE.BoxGeometry(1.3, 0.20, 0.03), lam(C.glow, { emissive: C.glow, emissiveIntensity: 0.45 }), 0, 1.28, gW / 2 + 0.07));
        [-0.30, 0.30].forEach(function (wx2) {
          [-0.34, 0.34].forEach(function (wy2) {
            gov.add(mesh(new THREE.BoxGeometry(0.34, 0.30, 0.04), lam(0x4a3d2c),
              wx2 * gW, (0.18 + gh * 0.5) + wy2 * gh * 0.28, gW / 2 + 0.03));
          });
        });
        /* 瓦垄：正南这一面坡加四条横线，重檐才不是两块纯色 */
        var gTile = lam(0x3f4a49);
        [-0.34, -0.11, 0.11, 0.34].forEach(function (tx3) {
          gov.add(mesh(new THREE.BoxGeometry(gW * 0.70, 0.03, 0.05), gTile,
            tx3 * gW * 0.5, 0.18 + gh + 0.42, gW * 0.30));
        });
        gov.add(mesh(new THREE.BoxGeometry(0.9, 0.10, 0.26), lam(0x8b8272), 0, 0.05, gW / 2 + 0.16));
        gov.add(contactShadow(gW * 0.72));
        gov.position.set(it.gx, 0, it.gz);
        gov.userData.node = { info: true, idx: it.idx, label: '政务厅 Lv' + glv, bid: 'guanfu', lvl: glv, cat: 'gov' };
        propRoot.add(gov); nodeList.push(gov);
        continue;
      }
      if (it.kind === 'house') house(it.bid, it.lvl, x, z, it.idx);
      else if (it.plaza) plazaPiece(x, z, it.plaza, it.idx + 3000);
      else {
        /* 什么都不放的空地：给一点碎石，别让格子里空得像没加载 */
        var pad = mesh(new THREE.BoxGeometry(0.5, 0.03, 0.42), lam(0x7e7565), x + 0.4, 0.02, z - 0.3);
        propRoot.add(pad);
      }
    }

    /* 巷口的路灯：每三个格子一盏（放在格子的左上角，正好是十字巷口） */
    for (var li = 0; li < c.cells.length; li++) {
      if (((li % COLS) + Math.floor(li / COLS)) % 3 !== 0) continue;
      var lcol = li % COLS, lrow = Math.floor(li / COLS);
      laneLamp((lcol - (COLS - 1) / 2) * CITY_T - CITY_T / 2,
        (lrow - (ROWS - 1) / 2) * CITY_T - CITY_T / 2);
    }

    /* 围墙：南面**留一个门洞**（宽 3.2）。v140 的墙是整圈封死的，
       城门只是个"按 E 出城"的牌子 —— 玩家看得出那是假的（墙没断）。
       v142 墙真的断开，人真的走出去。 */
    var hw = W / 2 + CITY_PAD, hd = D / 2 + CITY_PAD;
    var gateHalf = 1.6;
    if (c.wall && c.wall.build) {
      var wl = new THREE.Group();
      var wallSeg = function (cx0, cz0, sw, sd) {
        wl.add(mesh(new THREE.BoxGeometry(sw, 1.3, sd), lam(0x8d8578), cx0, 0.65, cz0));
        /* 墙头压顶：一条比墙薄的深色石条，墙就不再是"一块灰板" */
        wl.add(mesh(new THREE.BoxGeometry(sw + 0.06, 0.1, sd + 0.06), lam(0x6f6a5e), cx0, 1.34, cz0));
      };
      wallSeg(0, -hd, W + CITY_PAD * 2 + 0.6, 0.5);                       /* 北 */
      wallSeg(-(hw + gateHalf) / 2 - 0.0, hd, hw - gateHalf, 0.5);        /* 南 · 左 */
      wallSeg((hw + gateHalf) / 2, hd, hw - gateHalf, 0.5);               /* 南 · 右 */
      wallSeg(-hw, 0, 0.5, D + CITY_PAD * 2);                            /* 西 */
      wallSeg(hw, 0, 0.5, D + CITY_PAD * 2);                             /* 东 */
      propRoot.add(wl);
    }

    /* 城门：立在墙的缺口里（不是墙前面）。
       门柱、门楣、一块发光的门牌 —— 三件就够读出"这是主出入口"。
       ⚠️ 门楼必须**够高**：v142 第一版门楣在 2.12 米，玩家出生在门内 0.95 米，
       52° 俯角下视线从门楣顶继续下落 0.95×tan52°=1.22 米 → 到玩家头上只剩 1.13 米，
       正好把 1.35 米高的人**整个脑袋盖掉**（截图里"人不见了"，其实是站在门底下）。
       现在门楣底 2.72 米 > 玩家头顶投影 2.57 米，站在门里也看得见自己。 */
    var gate = new THREE.Group();
    [-gateHalf, gateHalf].forEach(function (gx) {
      gate.add(mesh(new THREE.BoxGeometry(0.46, 2.2, 0.62), lam(0xa2967e), gx, 1.1, 0));
      gate.add(mesh(new THREE.BoxGeometry(0.56, 0.14, 0.72), lam(0x7a6f5e), gx, 2.27, 0));
    });
    gate.add(mesh(new THREE.BoxGeometry(gateHalf * 2 + 1.2, 0.4, 0.66), lam(0x8d8578), 0, 2.52, 0));
    gate.add(mesh(new THREE.BoxGeometry(gateHalf * 2 - 0.4, 0.12, 0.06), lam(C.glow, { emissive: C.glow, emissiveIntensity: 0.9 }), 0, 2.52, 0.35));
    gate.add(mesh(new THREE.BoxGeometry(1.5, 0.34, 0.08), lam(0x6b533a), 0, 2.06, 0.3));
    gate.add(contactShadow(1.5));
    gate.position.set(0, 0, hd);
    gate.userData.node = { idx: 901, gate: true, label: '城门 · 出城', hint: '走出去，回到野外', done: false };
    propRoot.add(gate);
    nodeList.push(gate);
    /* 门外的路：一条伸出去的土路，告诉玩家"往这儿走就是外面" */
    var road = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.2),
      new THREE.MeshLambertMaterial({ color: 0x7a6e58 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.015, hd + 2.1);
    propRoot.add(road);

    /* 城的活动范围：比格子区多一圈墙根，南面多放 2.6 米（门外） */
    cityBounds = { x0: -hw + 0.35, x1: hw - 0.35, z0: -hd + 0.35, z1: hd + 2.6 };
    /* 走到这道线就算出城（不必回头点门） */
    cityOutZ = hd + 1.9;

    player = buildPlayer();
    /* ⚠️ 必须挂进 propRoot。v140 漏了这一行 —— 城内"能走"，但**从来没有画过人**：
       相机跟着一个看不见的点跑，玩家只能靠底部提示条猜自己在哪（v142 截图才发现）。
       野地那边挂了，城内照抄时漏了，这类"只在一处生效"的 bug 截图比断言管用。 */
    propRoot.add(player);
    /* 出生点：来自 plan（与门禁量的是同一个点 —— 两处各写一个数就会漂） */
    player.position.set(plan.spawn.x, 0, plan.spawn.z);
    targetPt = null;
    /* 城内相机跟随（v142）：视口 11 米 —— 一屏看到约 4 格宽、5 格深，
       差不多"一条街 + 对面一排房子"，这是"逛"的取景。
       v140 的 15.5 是俯瞰全城用的，跟着人走会晃得厉害。 */
    cityView = true;
    frustumH = 9.5;
    cam.position.set(0, 21.65, plan.spawn.z + 8);
    cam.lookAt(0, 0.8, plan.spawn.z - 1.72);
    resize();
    return true;
  }

  function sceneCfg(id) {
    for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === id) return SCENES[i];
    return null;
  }

  /* ============================================================
   * 4. 对外 API
   * ============================================================ */
  S.list = function () {
    return SCENES.map(function (c) {
      return { id: c.id, name: c.name, sub: c.sub, act: c.act, nodes: (c.nodes || []).length };
    });
  };
  S.isOpen = function () { return !!openId; };
  /* 节点完成状态（按 场景+节点+游戏内天数）：纯 state 接口，不依赖渲染，
     所以 smoke 里可以直接断言"做了就记住、隔天会复位"。 */
  S.isDone = function (sceneId, i) { return !!doneStore()[nodeKey(sceneId, i)]; };
  S.markDone = function (sceneId, i) { try { doneStore()[nodeKey(sceneId, i)] = 1; return true; } catch (e) { return false; } };
  S.dayNow = sceneDay;
  /* 遭遇的决定（同参数同结果）—— 给门禁验"确定性"，不给随机开后门 */
  S.encounterFor = function (sceneId, ci) {
    var cfg = sceneCfg(sceneId);
    if (!cfg) return null;
    return encounterFor(cfg, ci);
  };
  /* 城内 3D（入口在城市页右下角） */
  S.openCity = function () { return S.open('city'); };
  S.current = function () { return openId; };
  /* 相机/玩家的真实位姿（给门禁和排障用）。
     为什么要有它：v142 调镜头时，"玩家不在画面里"和"俯角只有 20°"这种问题
     只能靠**量**——截图里看不出相机到底朝哪。这里把俯角、玩家在 NDC 里的位置
     直接算出来，断言就能钉住"玩家必须在画面内、俯角必须在 45°~60°"。 */
  S._debug = function () {
    if (!player || !cam) return null;
    var dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    var pv = new THREE.Vector3(player.position.x, 0.8, player.position.z).project(cam);
    return {
      player: { x: player.position.x, z: player.position.z },
      cam: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      dir: { x: dir.x, y: dir.y, z: dir.z },
      pitchDeg: Math.round(Math.atan2(-dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z)) * 180 / Math.PI),
      ndc: { x: pv.x, y: pv.y },
      frustumH: frustumH, cityView: cityView, solids: citySolids.length,
      bounded: !!cityBounds,
    };
  };

  /* 动作 → 场景。地形决定"同样的采集，长什么样"：
       森林里砍树、草原上割麦、其余翻废墟 —— 这是"采集"三个不同场景的来源。 */
  S.pickFor = function (actId, terrain) {
    if (actId === 'lake_scene') return 'lake';
    if (actId === 'shi') return 'trial';
    if (actId === 'tao') return 'camp';
    if (actId === 'bai') return (terrain === 'hill' ? 'market' : 'hamlet');
    if (actId === 'xiu') return 'spire';
    if (actId === 'cai') {
      if (terrain === 'forest') return 'forest';
      if (terrain === 'caoyuan') return 'field';
      return 'ruin';
    }
    if (terrain === 'forest') return 'forest';
    if (terrain === 'lake') return 'lake';
    return 'ruin';
  };

  /* 打开场景。ctx = { ci, actId, terrain } */
  S.open = function (sceneId, ctxIn) {
    ensure();
    /* 'city' 不是一张静态配置，而是**照当前城的数据现搭**（城内 3D 原型） */
    if (sceneId === 'city') {
      openId = 'city';
      ctx = ctxIn || {};
      layer.style.display = 'block';
      if (propRoot) { scene.remove(propRoot); propRoot = null; }
      nodeList = []; nearNode = null; waterMesh = null;
      propRoot = new THREE.Group();
      scene.add(propRoot);
      var okc = buildCityScene();
      if (!okc) { openId = null; layer.style.display = 'none'; return { ok: false, msg: '现在没有城' }; }
      renderHud();
      lastT = performance.now();
      if (!rafId) rafId = requestAnimationFrame(step);
      var ph0 = document.getElementById('prologue-screen');
      if (ph0) ph0.style.display = 'none';
      return { ok: true, scene: 'city', name: '我的城（3D）' };
    }
    var cfg = sceneCfg(sceneId);
    if (!cfg) return { ok: false, msg: '没有这个场景：' + sceneId };
    openId = sceneId;
    ctx = ctxIn || {};
    /* ⚠️ 必须**先显示层、再装配**：层还是 display:none 时 clientWidth/Height 都是 0，
       正交相机按 0×0 算视口 → canvas 后备缓冲只有 1×1，画面看起来"什么都没有"
       （实测 _state().canvas = {w:1,h:1}）。顺序反了就是白屏，而且不报错。 */
    layer.style.display = 'block';
    try { pruneDone(); } catch (e) {}
    buildScene(cfg);
    resize();
    renderHud();
    lastT = performance.now();
    if (!rafId) rafId = requestAnimationFrame(step);
    /* 让 HUD 层知道现在在场景里（前传 HUD 要暂时让位） */
    if (G.prologue && G.prologue.on && G.prologue.on()) {
      var ph = document.getElementById('prologue-screen');
      if (ph) ph.style.display = 'none';
    }
    return { ok: true, scene: sceneId, name: cfg.name };
  };

  S.close = function () {
    if (!openId) return { ok: false };
    openId = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (layer) { layer.style.display = 'none'; layer.innerHTML = ''; layer.appendChild(cvs); }
    /* canvas 被 innerHTML 清掉后要挂回来 */
    if (layer && cvs && cvs.parentNode !== layer) layer.appendChild(cvs);
    if (propRoot) { scene.remove(propRoot); propRoot = null; }
    nodeList = []; nearNode = null; keys = {};
    var ph = document.getElementById('prologue-screen');
    if (ph) ph.style.display = '';
    if (G.refreshAll) { try { G.refreshAll(); } catch (e) {} }
    return { ok: true };
  };

  /* 场景入口（由 UI 调）：按动作 + 地形选场景 */
  S.play = function (actId, ci) {
    var terrain = null;
    if (G.prologue && G.prologue.cellTypeOf && ci != null) terrain = G.prologue.cellTypeOf(ci);
    /* 进场景的门槛与按钮一致：这一格今天能做这件事，才让进 */
    var avail = [];
    if (G.jianghuActsAt && ci != null) {
      try { avail = (G.jianghuActsAt(ci) || []).map(function (a) { return a.id; }); } catch (e) { avail = []; }
    }
    if (actId && avail.length && avail.indexOf(actId) < 0) {
      return { ok: false, msg: '这地方今天做不了这件事 —— 换一处或明天再来' };
    }
    var id = S.pickFor(actId, terrain);
    var r = S.open(id, { ci: ci, actId: actId, terrain: terrain, availableActs: avail });
    if (r.ok) r.act = actId;
    return r;
  };

  /* 交互：真正结算仍走 prologue.act（唯一出口） */
  S.interact = function (obj) {
    var o = obj || nearNode;
    if (!o || !o.userData.node) return { ok: false, msg: '附近没有可动手的东西' };
    var nd = o.userData.node;
    /* 城内的建筑不是"可拾取物"：点它只出信息卡（数据还是城市页那份），
       不能在这里造/收 —— 那是城市页的活，两边都能改就会有两笔账。 */
    if (nd.info) {
      showInfo(nd);
      return { ok: true, info: true };
    }
    /* 城门：走出城门 = 离开这个 3D 视图，回到地图 */
    if (nd.gate) {
      S.close();
      if (G.ui && G.ui.toast) G.ui.toast('你走出城门，回到野外');
      return { ok: true, gate: true };
    }
    /* 遭遇：进斗将（复用 v136 那套面板与内核，不另写一份战斗） */
    if (nd.duel) {
      var _ci = (ctx && ctx.ci != null) ? ctx.ci : null;
      var _foe = G.prologue.duelFoe(_ci, nd.speciesId);
      var _r = G.prologue.duelBegin(_ci, _foe);
      if (!_r.ok) {
        showResult(nd, { ok: false, msg: _r.msg }, 'duel');
        return _r;
      }
      nd.done = true;
      if (nd.ring) nd.ring.visible = false;
      dimProp(o);
      if (G.ui && G.ui.openDuelPanel) G.ui.openDuelPanel();
      return _r;
    }
    if (nd.done) return { ok: false, msg: '这里已经收拾过了' };
    var actId = nd.act || (ctx && ctx.actId) || 'cai';
    var ci = (ctx && ctx.ci != null) ? ctx.ci : null;
    var res = null;
    try {
      res = G.prologue && G.prologue.act ? G.prologue.act(ci, actId) : null;
    } catch (e) { res = { ok: false, msg: '动手时出错了：' + (e.message || '') }; }
    nd.done = true;
    if (nd.ring) nd.ring.visible = false;
    dimProp(o);
    /* 记到 state.sceneDone（按天）：这一趟收拾过的，同一天再进来就是暗的 */
    if (nd.idx != null && nd.idx < 900) S.markDone(openId, nd.idx);
    showResult(nd, res || { ok: false, msg: '没有结果' }, actId);
    return res || { ok: true };
  };

  /* 城内建筑的信息卡（不开建造面板 —— 那是城市页的事） */
  function showInfo(nd) {
    var card = document.createElement('div');
    card.className = 'scene-card';
    card.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
      + 'min-width:240px;padding:13px 16px;border-radius:9px;background:rgba(12,14,18,.95);'
      + 'border:1px solid var(--gold-light);box-shadow:0 12px 36px rgba(0,0,0,.6);pointer-events:auto;';
    card.innerHTML = '<div style="font-size:var(--fs-h2);font-weight:700;color:var(--gold-light);">'
      + U.escape(nd.label || '') + '</div>'
      + '<div class="ui-sub" style="margin-top:5px;">'
      + (nd.lvl > 0 ? ('等级 Lv' + nd.lvl) : '还没建东西') + '</div>'
      + '<div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end;">'
      + '<button data-scene="card-close" style="padding:5px 12px;border-radius:5px;cursor:pointer;'
      + 'background:#1a1e25;border:1px solid var(--line);color:var(--text);font-size:var(--fs-cap);">关掉</button>'
      + '<button data-scene="to-city" data-enter-idx="' + (nd.idx != null && nd.idx < 900 ? nd.idx : '') + '"'
      + ' style="padding:5px 12px;border-radius:5px;cursor:pointer;'
      + 'background:#241f14;border:1px solid var(--gold-light);color:var(--gold-light);font-size:var(--fs-cap);">'
      + (nd.idx != null && nd.idx < 900 ? '进屋 · 建造/升级' : '回城内界面') + '</button></div>';
    layer.appendChild(card);
    card.addEventListener('click', function (e) {
      if (e.target.closest('[data-scene="card-close"]')) { card.remove(); return; }
      var go = e.target.closest('[data-scene="to-city"]');
      if (go) {
        var ix = go.getAttribute('data-enter-idx');
        card.remove();
        /* 有格号 = 走进去办事（开这一格的建筑面板）；没有 = 只回城市页 */
        if (ix !== '' && ix != null) S.enterBuilding(Number(ix));
        else { S.close(); try { G.ui.setView('city'); } catch (err) {} }
      }
    });
  }

  /* 走进这栋楼（v142）：关掉 3D → 回城市页 → **直接打开这一格的建筑面板**。
     为什么不造一个"3D 里的建造界面"：建造/升级/队列是城市页那套面板的活，
     3D 再实现一遍就是两本账（v136 斗将 HP 那个坑）。
     3D 只负责"带你走到门口"，办不办事交给既有的门。 */
  S.enterBuilding = function (idx) {
    var city = G.currentCity ? G.currentCity() : null;
    S.close();
    try { if (G.ui && G.ui.setView) G.ui.setView('city'); } catch (e) {}
    try {
      if (G.ui && G.ui.openBuildModal && idx != null && idx >= 0) {
        G.ui.openBuildModal(idx, city ? city.id : null);
        return { ok: true, idx: idx };
      }
    } catch (e) { return { ok: false, msg: e.message || '打不开建筑面板' }; }
    return { ok: false, msg: '没有建筑面板' };
  };

  /* ---------- 状态持久化（v141） ----------
   * 缺口：上一版"这一趟收拾过没有"只存在 `userData.node.done` 里，
   * 一退出场景就没了 —— 玩家采集完再进来，碎石堆又满了。
   * 现在按 **场景 + 节点 + 游戏内天数** 记在 `state.sceneDone`：
   *   · 同一天内进出、存档读档都还记得（这就是"收拾过了"该有的意思）；
   *   · 第二天自动复位（荒野之事每天都会再长出来，与 P.act 的每日锁同口径）；
   *   · 键里带天数，所以不需要额外的"过期清理"逻辑，顺手 prune 一下旧键防膨胀。
   * 为什么不挂在 prologue 下：城内场景（正式阶段）也能用，且这是"场景"的事。 */
  function sceneDay() {
    return Math.floor((((G.state || {}).world || {}).elapsed || 0) / 86400);
  }
  function doneStore() {
    var st = G.state;
    if (!st) return {};
    if (!st.sceneDone || typeof st.sceneDone !== 'object') st.sceneDone = {};
    return st.sceneDone;
  }
  function nodeKey(sceneId, i) { return sceneId + '#' + i + '#' + sceneDay(); }
  function pruneDone() {
    var m = doneStore(), today = sceneDay(), keys = Object.keys(m);
    if (keys.length < 150) return 0;
    var dropped = 0;
    keys.forEach(function (k) {
      var d = parseInt(String(k).split('#')[2], 10);
      if (!(d >= today - 3)) { delete m[k]; dropped++; }
    });
    return dropped;
  }
  function dimProp(o) {
    o.traverse(function (c) {
      if (c.isMesh && c.material && c.material.color) {
        c.material = c.material.clone();
        c.material.color.multiplyScalar(0.62);
      }
    });
  }
  /* 遭遇：确定性抽（同场景/同格/同一天 → 同一头），免得"读档重进换了个对手" */
  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function encounterFor(cfg, ci) {
    if (!(G.prologue && G.prologue.on && G.prologue.on())) return null;   /* 只有前传君主一个人在外面走 */
    var LIST = (D && D.DUEL_FOES) || [];
    if (!LIST.length) return null;
    var h = hashStr(cfg.id + '|' + (ci | 0) + '|' + sceneDay());
    if ((h % 100) >= 38) return null;                                     /* 约 38% 的场次会撞上 */
    return LIST[(h >>> 8) % LIST.length];
  }

  function showResult(nd, res, actId) {
    var card = document.createElement('div');
    card.className = 'scene-card';
    var okc = res && res.ok !== false;
    card.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);'
      + 'min-width:280px;max-width:420px;padding:14px 18px;border-radius:9px;'
      + 'background:rgba(12,14,18,.95);border:1px solid ' + (okc ? 'var(--gold-light)' : 'var(--red-light)')
      + ';box-shadow:0 12px 36px rgba(0,0,0,.6);pointer-events:auto;';
    card.innerHTML = '<div style="font-size:var(--fs-h2);font-weight:700;color:'
      + (okc ? 'var(--gold-light)' : 'var(--red-light)') + ';">'
      + U.escape(nd.label || '动手') + '</div>'
      + '<div style="margin-top:7px;font-size:var(--fs-body);line-height:1.7;color:var(--text);">'
      + U.escape((res && res.msg) || '（没有回话）') + '</div>'
      + (res && res.gain ? '<div style="margin-top:5px;font-size:var(--fs-cap);color:var(--green-ok);">'
        + U.escape(res.gain) + '</div>' : '')
      + '<div style="margin-top:11px;text-align:right;">'
      + '<button data-scene="ok" style="padding:5px 16px;border-radius:5px;cursor:pointer;'
      + 'background:#1a1e25;border:1px solid var(--line);color:var(--text);font-size:var(--fs-cap);">知道了</button>'
      + '</div>';
    layer.appendChild(card);
    var kill = function () {
      if (card.parentNode) card.remove();
      renderHud();
      if (G.refreshAll) { try { G.refreshAll(); } catch (e) {} }
    };
    card.addEventListener('click', function (e) {
      if (e.target.closest('[data-scene="ok"]')) kill();
    });
    /* 8 秒自动消失，免得挡着走动 */
    setTimeout(function () { if (card.parentNode) kill(); }, 8000);
  }

  /* 供探针用：运行时只读状态（走动有没有生效、交互点在哪、附近是谁）。
     放这个不是为了给测试开后门，而是"3D 场景没法用 DOM 断言"——
     没有它就只能靠截图，而截图读不出"我到底有没有动"。 */
  S._state = function () {
    return {
      open: openId, scene: openId,
      player: player ? { x: +player.position.x.toFixed(2), z: +player.position.z.toFixed(2) } : null,
      near: nearNode ? (nearNode.userData.node.label || '') : null,
      encounter: (ctx && ctx.encounter) || null,
      nodes: nodeList.map(function (o) {
        var n = o.userData.node;
        return { x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2), act: n.act, label: n.label,
          done: !!n.done, duel: !!n.duel, gate: !!n.gate, info: !!n.info, idx: n.idx };
      }),
      layerShown: !!(layer && layer.style.display !== 'none'),
      canvas: cvs ? { w: cvs.width, h: cvs.height } : null,
    };
  };
  S._moveTo = function (x, z) { if (player) { player.position.x = x; player.position.z = z; } };
  S._hide = function (name, v) {
    if (!propRoot) return 0;
    var n = 0;
    propRoot.traverse(function (o) { if (o.isMesh && (o.name === name)) { o.visible = v !== false; n++; } });
    return n;
  };
  /* 诊断：列出场景里所有网格的位置/尺寸/颜色（查"画面上多出来的东西"用） */
  S._dump = function (filterZ) {
    var out = [];
    if (!propRoot) return out;
    propRoot.traverse(function (o) {
      if (!o.isMesh) return;
      var wp = new THREE.Vector3(); o.getWorldPosition(wp);
      if (filterZ != null && wp.z > filterZ) return;
      out.push({
        n: o.name || '-', y: +wp.y.toFixed(2), x: +wp.x.toFixed(1), z: +wp.z.toFixed(1),
        rx: +o.rotation.x.toFixed(2),
        col: o.material && o.material.color ? o.material.color.getHexString() : '-',
        op: o.material ? o.material.opacity : 1,
        geo: o.geometry && o.geometry.type,
      });
    });
    return out;
  };
  S._act = function (i) { return S.interact(nodeList[i]); };

  /* 供探针/测试用：不打开界面也能拿到场景装配结果 */
  S._probe = function (id) {
    var cfg = sceneCfg(id);
    if (!cfg) return null;
    /* 未知道具类型：配置里写了 `wreak` 这种手误时，那个道具会**静默地什么都不画**，
       场景看起来只是"空了点"，很难发现。所以把未知类型报出来，让断言能拦。 */
    var unknown = [];
    (cfg.props || []).concat(cfg.nodes || []).forEach(function (o) {
      if (!PROP[o.t]) unknown.push(o.t);
    });
    return {
      id: cfg.id, name: cfg.name, act: cfg.act,
      props: (cfg.props || []).length, nodes: (cfg.nodes || []).length,
      nodeActs: (cfg.nodes || []).map(function (n) { return n.act; }),
      unknown: unknown,
      water: !!cfg.water,
      colors: { ground: cfg.ground, sky: cfg.sky },
    };
  };
})();
