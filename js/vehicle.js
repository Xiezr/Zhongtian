/* ============================================================
 * vehicle.js — v158.3（P3 · 载具与碰撞）运行时载具层
 * ------------------------------------------------------------
 * 老板要的结果：在街区里走到马/车旁按 E 上车，WASD 驱动跑起来，
 * 撞建筑**停住而不是穿过去**，按 E 下车回到原处。
 *
 * 四条硬纪律（与 AGENTS.md 〇之〇「实现老板意图，不许异化」对齐）：
 *  1. 不新建场景 / 不新建高度计算：载具跑在 P2 街区层，位置锚复用 D.pos/D.yaw
 *     （相机 D.camera 读同一锚，自动跟随；高度由 D.frameOf 的 _groundAtUnit 给出）；
 *  2. 不写 GAME.state._avatar、不写 camO.*：退出街区仍走 D.snapshot + setPlayerPose 唯一出口；
 *  3. 不碰 P1 交互：nearestInteractable / INTERACT_INFO / #interact-hint 逐字不动，
 *     载具查询另起 V.nearestMount()（球面格锚 vs 街区局部米，不是同一套坐标）；
 *  4. 碰撞口径同源：只用 D.hitSolid(D.plan, x, z, V.radius) 与 D.plan.bounds，
 *     plan.solids 只读；固定步长子步进 ≤0.5 格/步防高速漏碰。
 *
 * 按键三级隔离：P0 球面 GAME._keys / P2 街区 D.keys / P3 载具 V.keys。
 * 本模块排在 core 包（map3d/scene3d/district 之后），加载期只定义函数。
 * ============================================================ */
(function () {
  var G = GAME;
  var V = G.vehicle = G.vehicle || {};

  /* ---------- 运行时态（不入档） ---------- */
  V.mounted = false;                 /* 唯一载具状态位：是否在车上 */
  V.kind = 'horse';                  /* horse / cart */
  V.speed = 0;                       /* 当前切向速度（米/秒），可负 = 倒车 */
  V.keys = {};                       /* 载具态 W/A/S/D；与 D.keys 隔离 */
  V.park = null;                     /* 下车后车的停放点 {x,z}，null = 用默认停点 */
  V.ground = 0;                      /* 当前城格地表高（复用 P0 _groundAtUnit） */
  V._mesh = null;

  /* ---------- 常量（计划硬指标） ---------- */
  V.SPEED_MAX = 9;                   /* 马 9 m/s = 步行 4.5 的两倍 */
  V.ACCEL = 8;                       /* 加速度 m/s² */
  V.BRAKE_S = 0.5;                   /* 松键刹车 ≤0.5s（计划硬指标） */
  V.SUBSTEP_FRAC = 0.5;              /* 子步进上限 0.5 格/步（计划硬指标） */
  V.RADIUS = 0.65;                   /* 载具碰撞半径 > 人物 CAPSULE_R 0.3 */
  V.MOUNT_RANGE = 2.2;               /* 局部米：走到车旁 2.2m 内可上 */
  V.MOUNT_CONE = 45;                 /* 度：车要在正前方 45° 内 */

  /** 默认停点：出生点东侧一步，保证「出生即看得见车，走两步能上」。 */
  V.parkOf = function (plan) {
    if (V.park) return V.park;
    if (!plan || !plan.spawn) return { x: 2.4, z: 0 };
    var b = plan.bounds || { x0: -13, x1: 13 };
    return { x: Math.min(b.x1 - 1, plan.spawn.x + 2.4), z: plan.spawn.z };
  };

  /** 最近可上载具：只用街区局部坐标 D.pos/D.yaw，不碰球面 nearestInteractable。 */
  V.nearestMount = function () {
    var D = G.district;
    if (!D || !D.active || V.mounted || !D.plan) return null;
    var park = V.parkOf(D.plan);
    var dx = park.x - D.pos.x, dz = park.z - D.pos.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > V.MOUNT_RANGE) return null;
    var fx = Math.sin(D.yaw), fz = -Math.cos(D.yaw);
    var cos = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1;
    var ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    if (ang > V.MOUNT_CONE) return null;
    return { kind: V.kind, name: V.kind === 'horse' ? '坐骑' : '马车',
      verb: '骑乘', dist: +dist.toFixed(3), angle: +ang.toFixed(1) };
  };

  /** 上车：只写 V.* 运行时态；位置锚 D.pos 不动（车瞬移到人，不瞬移人）。 */
  V.mount = function () {
    var D = G.district;
    if (!D || !D.active) return { ok: false, msg: '不在街区' };
    var M = G.map3d;
    if (M && M.VEHICLE === false) return { ok: false, msg: '载具层已关闭' };
    if (V.mounted) return { ok: false, msg: '已在车上' };
    var near = V.nearestMount();
    if (!near) return { ok: false, msg: '附近没有载具' };
    V.mounted = true;
    V.kind = near.kind;
    V.speed = 0;
    V.keys = {};
    if (D.keys) D.keys = {};
    V.syncMesh();
    /* v158.6（P5-b 任务链）：上车 = 观察钩子（后置登记，不拦截）。 */
    if (G.questline && G.questline.onRide) G.questline.onRide();
    return { ok: true, kind: V.kind, name: near.name };
  };

  /** 下车：车停在原地，人留在同一位置锚 —— 「回到原格附近」。 */
  V.dismount = function () {
    var D = G.district;
    if (!V.mounted) return { ok: false, msg: '未在车上' };
    V.mounted = false;
    V.speed = 0;
    V.keys = {};
    if (D && D.keys) D.keys = {};
    if (D) V.park = { x: D.pos.x, z: D.pos.z };
    V.syncMesh();
    return { ok: true, x: D ? +D.pos.x.toFixed(3) : 0, z: D ? +D.pos.z.toFixed(3) : 0 };
  };

  /** E 键唯一出口：在车上 → 下车；不在车上且靠近 → 上车。 */
  V.toggle = function () {
    return V.mounted ? V.dismount() : V.mount();
  };

  /** 刹车：松键后 |speed| 线性归零，耗时 ≤ V.BRAKE_S。 */
  V._brake = function (dt) {
    var dec = (V.SPEED_MAX / V.BRAKE_S) * dt;
    if (Math.abs(V.speed) <= dec) { V.speed = 0; return; }
    V.speed -= (V.speed > 0 ? dec : -dec);
  };

  /** 载具步进：kinematic（不走刚体力）；固定子步进 + 分轴 sweep，撞墙停住。
   *  位置锚写 D.pos/D.yaw —— 相机 D.camera 与街区几何同帧读到，不新增第二套位置。 */
  V.step = function (dt, keys, plan) {
    var D = G.district;
    if (!D || !D.active || !V.mounted || !plan || !plan.bounds) return null;
    var M = G.map3d;
    /* 高度只调 P0 唯一出口，不新增一套地形计算（验收 B）。 */
    V.ground = (M && M._groundAtUnit) ? M._groundAtUnit(D.ci) : 0;
    dt = Math.max(D.STEP_MIN || 1 / 120, Math.min(D.STEP_MAX || 0.05, dt || 1 / 60));
    var turn = ((keys && keys.d) ? 1 : 0) - ((keys && keys.a) ? 1 : 0);
    var move = ((keys && keys.w) ? 1 : 0) - ((keys && keys.s) ? 1 : 0);
    if (turn) D.yaw += turn * 1.5 * dt;
    if (move) {
      V.speed += (move > 0 ? V.ACCEL : -V.ACCEL * 1.5) * dt;
    } else {
      V._brake(dt);
    }
    V.speed = Math.max(-V.SPEED_MAX * 0.4, Math.min(V.SPEED_MAX, V.speed));

    var step = V.speed * dt;
    /* 固定步长子步进：≤0.5 格/步，且不超过 0.4m（比半格更保守，防漏碰）。 */
    var subMax = Math.min((plan.T || 3) * V.SUBSTEP_FRAC, 0.4);
    var n = Math.max(1, Math.ceil(Math.abs(step) / subMax));
    var per = step / n, hit = 0;
    var b = plan.bounds, r = V.radius || V.RADIUS;
    for (var i = 0; i < n; i++) {
      var dx = Math.sin(D.yaw) * per, dz = -Math.cos(D.yaw) * per;
      var nx = Math.max(b.x0 + r, Math.min(b.x1 - r, D.pos.x + dx));
      if (!D.hitSolid(plan, nx, D.pos.z, r)) D.pos.x = nx; else hit++;
      var nz = Math.max(b.z0 + r, Math.min(b.z1 - r, D.pos.z + dz));
      if (!D.hitSolid(plan, D.pos.x, nz, r)) D.pos.z = nz; else hit++;
      if (hit) { V.speed = 0; break; }   /* 撞墙停住：速度立即归零，不沿墙滑行 */
    }
    V.syncMesh();
    return { x: +D.pos.x.toFixed(4), z: +D.pos.z.toFixed(4), yaw: +D.yaw.toFixed(4),
      speed: +V.speed.toFixed(4), subs: n, hit: hit, moved: Math.abs(step) > 0 };
  };

  /** 渲染跟随：载具 mesh 与 D.pos/D.yaw 同帧同步（jsdom 无 THREE 时安全noop）。 */
  V.syncMesh = function () {
    if (!V._mesh || typeof THREE === 'undefined') return;
    var D = G.district;
    if (!D) return;
    V._mesh.position.set(D.pos.x, 0.45, D.pos.z);
    V._mesh.rotation.y = -D.yaw;
  };

  /** 由 district.build() 调一次：在街区 root 上画一辆程序化载具，材质走 D._mats 渐显。 */
  V.build = function (root, plan) {
    V._mesh = null;
    if (!root || typeof THREE === 'undefined') return false;
    var D = G.district;
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.6),
      new THREE.MeshLambertMaterial({ color: V.kind === 'horse' ? 0x7b4a2d : 0x4a5b7b,
        transparent: true, opacity: 1 }));
    var p = V.parkOf(plan);
    m.position.set(p.x, 0.45, p.z);
    root.add(m);
    if (D && D._mats) D._mats.push(m.material);   /* 与街区一起渐显/渐隐 */
    V._mesh = m;
    V.syncMesh();
    return true;
  };

  /** 退出街区 / 一键回退：清运行时态，不碰 P0 位姿与 camO。 */
  V.reset = function () {
    V.mounted = false;
    V.speed = 0;
    V.keys = {};
    V.park = null;
    V._mesh = null;
  };
})();
