/* ============================================================
 * district.js — v158.2（P2 · 城市街区 L1）运行时街区层
 * ------------------------------------------------------------
 * 老板要的结果：站在城格上按"进入"，镜头推近变成**能走的街道**，
 * 走到建筑门口；按"退出"回星球视角，位置不变。**没有读盘、没有切场景**。
 *
 * 三条硬纪律（与 AGENTS.md 〇之〇「实现老板意图，不许异化」对齐）：
 *  1. 不新建 THREE.Scene：街区 root 挂在 map3d 的同一个 scene 上，只是相机覆盖；
 *  2. 不写 GAME.state._avatar：进入前用 M.playerPose() 快照，退出用 M.setPlayerPose()
 *     这个 P0 唯一出口还原；街区自己的位置只在运行时态 D.pos 里；
 *  3. 不另算一套几何真值：布局/碰撞盒直接用 scene3d.cityPlan(c)（同一本账）。
 *
 * 本模块排在 core 包（modules.json layout.order 的 map3d/scene3d 之后），
 * 加载时只定义函数；所有 GAME.map3d / GAME.scene3d 访问都发生在调用期。
 * ============================================================ */
(function () {
  var G = GAME;
  var D = G.district = G.district || {};

  D.active = false;                 /* 街区是否开着（唯一状态位） */
  D.phase = 'out';                  /* in / hold / out */
  D.ci = -1;
  D.cityId = null;
  D.t = 0;                          /* 0..1 过渡进度 */
  D.keys = {};                      /* W/A/S/D 街区态按键；不入档 */
  D.pos = { x: 0, z: 0 };
  D.yaw = 0;
  D.plan = null;
  D.frame = null;
  D.root = null;
  D.snapshot = null;                /* 进入前的 P0 位姿 */
  D._from = null;                   /* 进入瞬间的相机姿态，退出时回到它 */
  D._mats = [];
  D._clock = 0;
  D.TRANSITION_MS = 240;            /* ≤300ms（计划硬指标），留 60ms 给掉帧 */
  D.STEP_MIN = 1 / 120;
  D.STEP_MAX = 0.05;

  /* ---------- 纯数据 / 纯数学：jsdom 无 THREE 也要能验 ---------- */

  /** 布局唯一来源：scene3d.cityPlan。没有 city 时给一份确定性空城（探针用）。 */
  D.planOf = function (city) {
    var S = G.scene3d;
    if (S && S.cityPlan && city) return S.cityPlan(city);
    return { cols: 8, rows: 6, T: 3, bw: 1.4, W: 24, D: 18, hw: 14.2, hd: 11.2,
      spawn: { x: 0, z: 9.45 },
      bounds: { x0: -13.85, x1: 13.85, z0: -10.85, z1: 13.8 },
      cells: [], solids: [], wall: false };
  };

  /** 圆 vs 轴对齐盒（与 scene3d.hitsSolid 同口径）：贴墙能滑，不在角上抖。 */
  D.hitSolid = function (plan, x, z, r) {
    if (!plan || !plan.solids) return false;
    for (var i = 0; i < plan.solids.length; i++) {
      var s = plan.solids[i];
      var cx = x < s.x0 ? s.x0 : (x > s.x1 ? s.x1 : x);
      var cz = z < s.z0 ? s.z0 : (z > s.z1 ? s.z1 : z);
      var dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  };

  /** 城格局部标架：up/east/south 全部来自 P0 的 avatarBasis，不另算。 */
  D.frameOf = function (ci) {
    var M = G.map3d, SP = G.mapSphere;
    if (!M || !SP || !SP.cells || !SP.cells[ci]) return null;
    var c = SP.cells[ci], fr = M.avatarBasis(c.dir);
    var h = M._groundAtUnit ? M._groundAtUnit(ci) : 0;
    var r = (M.R || 300) + h + 0.05 + (M.SURF_PLIFT || 0.4);
    return { up: fr.up.slice(), east: fr.east.slice(), south: fr.south.slice(),
      origin: [c.dir[0] * r, c.dir[1] * r, c.dir[2] * r], h: h };
  };

  /** 局部 (x,y,z) → 世界坐标（街区 root 用四元数摆，态与相机同口径）。 */
  D.world = function (frame, x, y, z) {
    if (!frame) return [0, 0, 0];
    var o = frame.origin, u = frame.up, e = frame.east, s = frame.south;
    return [o[0] + e[0] * x + u[0] * y + s[0] * z,
      o[1] + e[1] * x + u[1] * y + s[1] * z,
      o[2] + e[2] * x + u[2] * y + s[2] * z];
  };

  /* ---------- 渲染：只建当前城格，挂同一个 scene ---------- */

  function clearRoot() {
    if (!D.root) return;
    try {
      while (D.root.children.length) {
        var c = D.root.children.pop();
        if (c.geometry && c.geometry.dispose) c.geometry.dispose();
      }
      if (D.root.parent) D.root.parent.remove(D.root);
    } catch (e) { }
    D.root = null;
    D._mats = [];
  }

  function mat(color) {
    var m = new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 0 });
    D._mats.push(m);
    return m;
  }

  function box(w, h, d, x, y, z, color, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function build() {
    clearRoot();
    var plan = D.plan, fr = D.frame;
    if (!plan || !fr || typeof THREE === 'undefined') return false;
    var root = D.root = new THREE.Group();
    root.name = 'districtLayer';
    /* 局部 X=east / Y=up / Z=south —— 右手系（cross(east,up)=south） */
    var m4 = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(fr.east[0], fr.east[1], fr.east[2]),
      new THREE.Vector3(fr.up[0], fr.up[1], fr.up[2]),
      new THREE.Vector3(fr.south[0], fr.south[1], fr.south[2]));
    root.quaternion.setFromRotationMatrix(m4);
    root.position.set(fr.origin[0], fr.origin[1], fr.origin[2]);

    var pad = 2.2, W = plan.W + pad * 2, Z = plan.D + pad * 2;
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(W, Z), mat(0x746b58));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    root.add(ground);
    /* 巷道：每格一条浅色带，让"街"能被看见（不是一块色斑） */
    for (var r = 0; r <= plan.rows; r++) {
      var zz = (r - plan.rows / 2) * plan.T;
      box(W, 0.02, 0.34, 0, -0.02, zz, 0x9a8f76, root);
    }
    for (var c0 = 0; c0 <= plan.cols; c0++) {
      var xx = (c0 - plan.cols / 2) * plan.T;
      box(0.34, 0.02, Z, xx, -0.02, 0, 0x9a8f76, root);
    }
    /* 建筑：与 cityPlan 的 solids 同源，只画有 kind 的格 */
    for (var i = 0; i < plan.cells.length; i++) {
      var it = plan.cells[i];
      if (!it || it.kind === 'void') continue;
      var gx = it.gx != null ? it.gx : it.x;
      var gz = it.gz != null ? it.gz : it.z;
      if (it.kind === 'gov') {
        var gw = it.gw || 4.6;
        box(gw, 4.2, gw, gx, 2.1, gz, 0xcbb282, root);
        box(gw * 0.55, 0.7, gw * 0.55, gx, 4.55, gz, 0x9c3f32, root);
      } else if (it.kind === 'house') {
        var bh = 2.2 + (it.lvl || 1) * 0.28;
        box(plan.bw, bh, plan.bw, it.x, bh / 2, it.z, 0xb08b4e, root);
        box(plan.bw * 0.7, 0.18, plan.bw * 0.7, it.x, bh + 0.09, it.z, 0x7d8790, root);
      } else if (it.plaza === 'well') {
        box(0.9, 0.55, 0.9, it.x, 0.275, it.z, 0x7d8790, root);
      } else if (it.plaza === 'pile') {
        box(0.95, 0.5, 0.95, it.x, 0.25, it.z, 0x9a9384, root);
      } else if (it.plaza === 'brazier') {
        box(0.6, 0.6, 0.6, it.x, 0.3, it.z, 0xb4643a, root);
      }
    }
    /* 城门柱：wall 的南面缺口在 cityPlan 里已是碰撞体，这里只补可见物 */
    if (plan.wall) {
      box(0.7, 2.6, 0.7, -plan.gateHalf, 1.3, plan.hd, 0x8a8072, root);
      box(0.7, 2.6, 0.7, plan.gateHalf, 1.3, plan.hd, 0x8a8072, root);
    }
    /* v158.3（P3）：载具画在同一个街区 root 上（与街道同源渐显，不新建场景）。 */
    if (G.vehicle && G.vehicle.build) G.vehicle.build(root, plan);
    /* v158.4（P4）：居民也画在同一个 root 上，材质并入 D._mats 一起渐显；
       不进 nodeList、不碰 D.pos/camO，位置只在 GAME.npc.list 里。 */
    if (G.npc && G.npc.build) G.npc.build(root, plan);
    /* 挂在 map3d 的同一个 scene（scene 出口由 map3d 提供，不自建） */
    var sc = G.map3d && G.map3d._scene && G.map3d._scene();
    if (!sc || !sc.add) return false;
    sc.add(root);
    return true;
  }

  /* ---------- 状态机：enter/exit 各一处写 active ---------- */

  D.enter = function (ci, city) {
    var M = G.map3d;
    if (!M || !M.DISTRICT) return { ok: false, msg: '街区层已关闭' };
    if (!M.FOLLOW || !M.PLAYER_AVATAR) return { ok: false, msg: '未处于跟随态' };
    if (D.active) return { ok: false, msg: '已在街区' };
    ci = ci | 0;
    var fr = D.frameOf(ci);
    if (!fr) return { ok: false, msg: '城格无效' };
    var p = M.playerPose();
    if (!p) return { ok: false, msg: '角色位姿未就绪' };
    var plan = D.planOf(city || (G.cityById && (function () {
      for (var i = 0; i < (G.state.cities || []).length; i++) {
        if (G.state.cities[i].ci === ci) return G.state.cities[i];
      }
      return null;
    })()));
    if (!plan || !plan.bounds) return { ok: false, msg: '街区布局未生成' };

    D.snapshot = { dir: p.dir.slice(), h: p.h, yaw: p.yaw, v: p.v.slice(), ci: ci };
    D.ci = ci;
    D.cityId = city ? city.id : null;
    D.plan = plan;
    D.frame = fr;
    D.pos = { x: plan.spawn.x, z: plan.spawn.z };
    D.yaw = p.yaw || 0;
    D.keys = {};
    D.t = 0;
    D.phase = 'in';
    D.active = true;                       /* ← 唯一进入写 */
    D._clock = Date.now();
    D._from = null;                        /* 首帧由 camera() 从当前 cam 采样 */
    /* v158.4（P4）：居民运行态由 plan + ci 派生，读档重进即重建，不入档。 */
    if (G.npc && G.npc.spawn) G.npc.spawn(plan, D.cityId || (city ? city.id : null), ci);
    /* v158.6（P5-b 任务链）：进城 = 观察钩子（后置登记，不拦截）。 */
    if (G.questline && G.questline.onEnter) G.questline.onEnter();
    if (!build()) {                        /* 无 THREE（jsdom）仍允许逻辑态进入 */
      D._noRender = true;
    } else {
      D._noRender = false;
      for (var k = 0; k < D._mats.length; k++) D._mats[k].opacity = 0;
    }
    return { ok: true, ci: ci, plan: plan, snap: D.snapshot };
  };

  D.exit = function () {
    if (!D.active) return { ok: false, msg: '不在街区' };
    D.phase = 'out';
    D.t = 0;
    D._clock = Date.now();
    D.keys = {};
    return { ok: true };
  };

  /** 每帧由 map3d 渲染循环调用一次：推进过渡 → 步进街区行走 → 渐显/渐隐。 */
  D.tick = function () {
    if (!D.active) return null;
    var now = Date.now();
    var dt = Math.max(0, Math.min(D.STEP_MAX, (now - (D._clock || now)) / 1000)) || 1 / 60;
    D._clock = now;
    var rate = dt * 1000 / D.TRANSITION_MS;
    if (D.phase !== 'hold') {
      D.t = Math.max(0, Math.min(1, D.t + (D.phase === 'in' ? rate : -rate)));
      if (D.phase === 'in' && D.t >= 1) D.phase = 'hold';
      if (D.phase === 'out' && D.t <= 0) {
        var snap = D.snapshot;
        D.active = false;                  /* ← 唯一退出写 */
        D.phase = 'out';
        clearRoot();
        /* v158.3（P3）：离街区时清载具运行时态（不入档、不留残留按键/速度）。 */
        if (G.vehicle && G.vehicle.reset) G.vehicle.reset();
        /* v158.4（P4）：离街区清居民运行态与提示条，不留幽灵 NPC。 */
        if (G.npc && G.npc.reset) G.npc.reset();
        if (snap && G.map3d.setPlayerPose) G.map3d.setPlayerPose(snap);
        if (G.ui && G.ui.renderDistrictHud) G.ui.renderDistrictHud(false);
        if (G.ui && G.ui.renderVehicleHud) G.ui.renderVehicleHud(false);
        D.snapshot = null;
        D.plan = null;
        D.frame = null;
        return { done: true };
      }
    } else {
      /* v158.3（P3）：载具态走 V.step，步行态仍走 D.step（函数本体逐字不动 ——
         P2 探针直接调 D.step 验撞墙，改它就会翻红）。 */
      var V = G.vehicle;
      if (V && V.mounted) V.step(dt, V.keys, D.plan);
      else D.step(dt, D.keys);
      /* v158.4（P4）：NPC 与玩家同帧推进；载具态只关交互提示，不关日程。 */
      if (G.npc && G.npc.tick) G.npc.tick(dt);
    }
    var op = Math.max(0, Math.min(1, D.t));
    for (var i = 0; i < D._mats.length; i++) D._mats[i].opacity = op;
    return { done: false, t: D.t, phase: D.phase };
  };

  /** 街区局部行走：分轴推进，撞墙贴墙滑；坐标只在 D.pos 里，不碰 _avatar。 */
  D.step = function (dt, keys) {
    if (!D.active || !D.plan) return null;
    dt = Math.max(D.STEP_MIN, Math.min(D.STEP_MAX, dt || 1 / 60));
    var M = G.map3d;
    var turn = ((keys && keys.d) ? 1 : 0) - ((keys && keys.a) ? 1 : 0);
    var move = ((keys && keys.w) ? 1 : 0) - ((keys && keys.s) ? 1 : 0);
    if (turn) D.yaw += turn * 1.8 * dt;
    var step = move * ((M && M.WALK_SPEED) || 4.5) * dt;
    var dx = Math.sin(D.yaw) * step, dz = -Math.cos(D.yaw) * step;
    var b = D.plan.bounds, r = (M && M.CAPSULE_R) || 0.3;
    var nx = Math.max(b.x0, Math.min(b.x1, D.pos.x + dx));
    if (!D.hitSolid(D.plan, nx, D.pos.z, r)) D.pos.x = nx;
    var nz = Math.max(b.z0, Math.min(b.z1, D.pos.z + dz));
    if (!D.hitSolid(D.plan, D.pos.x, nz, r)) D.pos.z = nz;
    return { x: +D.pos.x.toFixed(4), z: +D.pos.z.toFixed(4), yaw: +D.yaw.toFixed(4), moved: step !== 0 };
  };

  /** 相机覆盖：在 placeCamera + followAvatar 之后写，只写 cam，不碰 camO。 */
  D.camera = function () {
    if (!D.active) return null;
    var M = G.map3d, cam = M && M._cam;
    if (!cam || !D.frame || typeof THREE === 'undefined') return null;
    var fr = D.frame, rise = ((M.FOLLOW_DIST || 6) * Math.tan((M.FOLLOW_PITCH || 15) * Math.PI / 180));
    var fx = Math.sin(D.yaw), fz = -Math.cos(D.yaw);
    var px = D.pos.x, pz = D.pos.z;
    var eye = 1.7;
    var camL = [px - fx * (M.FOLLOW_DIST || 6), eye + rise, pz - fz * (M.FOLLOW_DIST || 6)];
    var lookL = [px, eye, pz];
    var camW = D.world(fr, camL[0], camL[1], camL[2]);
    var lookW = D.world(fr, lookL[0], lookL[1], lookL[2]);

    if (!D._from) {
      var dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      D._from = { p: cam.position.clone(), u: cam.up.clone(),
        t: cam.position.clone().add(dir.multiplyScalar(20)) };
    }
    var t = Math.max(0, Math.min(1, D.t));
    var ease = t * t * (3 - 2 * t);
    var pp = new THREE.Vector3(camW[0], camW[1], camW[2]);
    var tt = new THREE.Vector3(lookW[0], lookW[1], lookW[2]);
    var uu = new THREE.Vector3(fr.up[0], fr.up[1], fr.up[2]);
    if (D._from && ease < 1) {
      pp.lerpVectors(D._from.p, pp, ease);
      tt.lerpVectors(D._from.t, tt, ease);
      uu.lerpVectors(D._from.u, uu, ease);
    }
    cam.position.copy(pp);
    cam.up.copy(uu);
    cam.lookAt(tt);
    cam.updateMatrixWorld();
    var ddx = camL[0] - px, ddy = camL[1] - eye, ddz = camL[2] - pz;
    return { t: +t.toFixed(4), dist: +Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz).toFixed(4) };
  };

  /** 退出后清相机起点，下一帧 P0 从自己的阻尼态接管（逐位还原，零跳变）。 */
  D.resetCam = function () { D._from = null; };
})();
