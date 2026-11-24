/* ============================================================
 * npc.js — v158.4（P4 · NPC 生态与事件）运行时居民层
 * ------------------------------------------------------------
 * 老板要的结果：路上有人走动，早出晚归，走近能对话，敌对会开打；
 * 世界不再只有玩家一个活物。
 *
 * 五条硬纪律（与 AGENTS.md 〇之〇「实现老板意图，不许异化」对齐）：
 *  1. 几何真值只有一份：站位/航点全部由 scene3d._npcPlan(plan, seed,
 *     {count}) 派生（同一个 free 格筛选、同一套 rng），不另造第二套路网；
 *  2. 位置不入档：N.list 只活在运行时；不写 GAME.state，存档里没有 npcPos，
 *     读档后由 district.enter → N.spawn(plan, seed) 重建；
 *  3. 日程 4 段（夜/晨/昼/暮）按 state.world.elapsed 派生，不新增时钟字段；
 *     每段一个互异锚点，切段后目标改变 → 位置差可观测；
 *  4. 判定出口不另算：敌对开打只调 GAME.duel.play()，体力只写
 *     GAME.setStaNow()，日志只走 GAME.log()；
 *  5. 不碰 P0/P1/P2/P3：不写 state._avatar、不写 camO、不写 D.pos、
 *     不占三套玩家按键；街区层退出时 N.reset() 清干净。
 *
 * 开关 M.NPC=false 回到 v158.3：街区照常，只是街上没人、E 键不弹 NPC 提示。
 * 本模块排在 core 包（district/vehicle 之后），加载期只定义函数；
 * 所有对 ui / scene3d / district 的访问都在调用期。
 * ============================================================ */
import './core.js';
(function () {
  var G = GAME;
  var N = G.npc = G.npc || {};

  /* ---------- 常量（计划硬指标） ---------- */
  N.MIN_COUNT = 12;                  /* 同屏 ≥12（计划 A） */
  N.RANGE = 2.4;                     /* 街区局部米：走近才触发 */
  N.CONE = 60;                       /* 度：目标要在正前方扇形内 */
  N.HOSTILE_EVERY = 5;               /* 每 5 人 1 个敌对 → 12 人里 2 个 */
  N.PHASE_IDX = { night: 0, dawn: 1, day: 2, dusk: 3 };
  N.PHASE_NAME = ['night', 'dawn', 'day', 'dusk'];
  N.NAMES = ['行人', '挑夫', '货郎', '守夜人', '游侠', '匠人',
    '商户', '驿卒', '旅人', '樵夫', '铁匠', '药童'];
  /* 对话数据驱动：只写当街能说的话，不新建任何前传设定/任务线。 */
  N.TALK = {
    dawn: ['天亮了，路好走。', '赶早市？趁凉快。'],
    day: ['街上热闹，慢些走。', '这趟货得赶在天黑前。'],
    dusk: ['天要暗了，早些回吧。', '收摊咯。'],
    night: ['夜里安静，别走太远。', '还没歇着？']
  };

  /* ---------- 运行时态（一律不入档） ---------- */
  N.active = false;
  N.list = [];
  N.plan = null;
  N.seed = 0;
  N.ci = -1;
  N.cityId = null;
  N._meshes = [];
  N._ownMats = [];
  N._hintSig = '';
  N._phase = null;

  /** 时段：与 scene3d 的 phaseOf/hourNow 同一口径（有出口就复用，不抄公式）。 */
  N.hour = function () {
    var w = (G.state || {}).world || {};
    return ((((w.elapsed || 0) % 86400) + 86400) % 86400) / 3600;
  };
  N.phase = function () {
    var S = G.scene3d, h = N.hour();
    if (S && typeof S._phaseOf === 'function') return S._phaseOf(h);
    h = ((h % 24) + 24) % 24;
    if (h < 6) return 'night';
    if (h < 11) return 'dawn';
    if (h < 17) return 'day';
    if (h < 20) return 'dusk';
    return 'night';
  };

  /** 四段锚点：夜=家 / 晨=航点1 / 昼=航点2 / 暮=两点中点（互异且不落建筑）。
   *  ⚠️ v158.4 首轮实测踩坑：_npcPlan 的三个航点**有放回抽样**，可能抽到同一格，
   *     于是四个锚点里两个相距 0.075m —— 日程"切换有位置差"变成平凡解。
   *     这里按 plan.cells 确定性重抽，保证任意两段至少差 0.9m。 */
  function anchorsOf(plan, pd) {
    var wps = pd.wps || [{ x: pd.x, z: pd.z }];
    var a0 = wps[0], a1 = wps[1] || wps[0], a2 = wps[2] || wps[1] || wps[0];
    var out = [
      { x: a0.x, z: a0.z },
      { x: a1.x, z: a1.z },
      { x: a2.x, z: a2.z },
      { x: (a2.x + a0.x) / 2, z: (a2.z + a0.z) / 2 }
    ];
    var b = plan.bounds || { x0: -1e9, x1: 1e9, z0: -1e9, z1: 1e9 };
    var cells = plan.cells || [];
    function inBounds(p) {
      return p.x >= b.x0 + 0.4 && p.x <= b.x1 - 0.4
        && p.z >= b.z0 + 0.4 && p.z <= b.z1 - 0.4;
    }
    function good(p, upto) {
      if (!inBounds(p)) return false;
      if (G.district && G.district.hitSolid && G.district.hitSolid(plan, p.x, p.z, 0.35)) return false;
      for (var i = 0; i < upto; i++) {
        var dx = p.x - out[i].x, dz = p.z - out[i].z;
        if (dx * dx + dz * dz < 0.81) return false;   /* 至少差 0.9m */
      }
      return true;
    }
    /* 从 cityPlan 的同一本 cell 账里重抽；start 由 id+seed 决定 → 同 seed 同结果。 */
    function redraw(upto) {
      if (!cells.length) return false;
      var start = ((pd.id + 1) * 13 + upto * 7 + N.seed) % cells.length;
      for (var s = 0; s < cells.length; s++) {
        var it = cells[(start + s) % cells.length];
        if (!it || it.kind !== 'empty') continue;
        var cand = { x: it.x, z: it.z };
        if (good(cand, upto)) { out[upto] = cand; return true; }
      }
      /* 极端小城：空地不够就在家周围按 8 方向找，仍守 0.9m 间距。 */
      for (var r = 1.2; r <= 6; r += 1.2) {
        for (var k = 0; k < 8; k++) {
          var ang = k * Math.PI / 4;
          var c2 = { x: out[0].x + Math.cos(ang) * r, z: out[0].z + Math.sin(ang) * r };
          if (good(c2, upto)) { out[upto] = c2; return true; }
        }
      }
      return false;
    }
    for (var i = 1; i < 4; i++) if (!good(out[i], i)) redraw(i);
    return out;
  }

  /** 唯一生成出口：plan/seed 决定身份与锚点；位置每次读档重建，不落存档。 */
  N.spawn = function (plan, cityId, ci) {
    N.reset();
    var M = G.map3d;
    if (!M || M.NPC === false) return { ok: false, msg: 'NPC 层已关闭' };
    var S = G.scene3d;
    if (!plan || !S || typeof S._npcPlan !== 'function') return { ok: false, msg: '行人计划缺失' };
    var seed = 7788 + (plan.cols || 8) * 100 + (plan.rows || 6) + (ci | 0) * 7;
    var base = S._npcPlan(plan, seed, { count: N.MIN_COUNT });
    if (!base.length) return { ok: false, msg: '没有可站立的空地' };

    N.active = true;
    N.plan = plan;
    N.seed = seed;
    N.ci = ci | 0;
    N.cityId = cityId || null;
    N.list = base.map(function (pd, i) {
      return {
        id: pd.id, x: pd.x, z: pd.z, yaw: 0,
        wps: pd.wps, speed: pd.speed, tint: pd.tint, phase: pd.phase,
        name: N.NAMES[i % N.NAMES.length],
        hostile: (i % N.HOSTILE_EVERY === N.HOSTILE_EVERY - 1),
        anchors: anchorsOf(plan, pd), leg: pd.phase
      };
    });
    N._phase = N.phase();
    return { ok: true, count: N.list.length, phase: N._phase, seed: seed };
  };

  /** 街区退出 / 关开关：只清运行时态，不碰 P0 位姿与街区位置锚。 */
  N.reset = function () {
    N.active = false;
    N.list = [];
    N.plan = null;
    N._meshes = [];
    N._hintSig = '';
    N._phase = null;
    for (var i = 0; i < N._ownMats.length; i++) {
      try { if (N._ownMats[i].dispose) N._ownMats[i].dispose(); } catch (e) { }
    }
    N._ownMats = [];
    if (G.ui && G.ui.renderNpcHint) G.ui.renderNpcHint(null);
  };

  /** 唯一每帧步进：12 人 × 1 次锚点插值，p95 远低于 2ms；渲染同步同帧。 */
  N.tick = function (dt) {
    if (!N.active || !N.list.length) return null;
    var M = G.map3d, D = G.district;
    if (M && M.NPC === false) return null;
    if (!D || !D.active) return null;
    dt = Math.max(D.STEP_MIN || 1 / 120, Math.min(D.STEP_MAX || 0.05, dt || 1 / 60));
    var ph = N.phase(), idx = N.PHASE_IDX[ph] || 0;
    var moved = 0, total = 0;
    for (var i = 0; i < N.list.length; i++) {
      var np = N.list[i], a = np.anchors[idx];
      var dx = a.x - np.x, dz = a.z - np.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.12) {
        var st = Math.min(d, np.speed * dt * (ph === 'night' ? 0.45 : 1));
        np.x += dx / d * st;
        np.z += dz / d * st;
        np.yaw = Math.atan2(dx, dz);
        np.leg += st * 3;
        moved++;
        total += st;
      }
    }
    N.syncMesh();
    /* 提示只在签名变化时写 DOM（dist 每帧变，不能进签名）。 */
    var near = (D.phase === 'hold' && !(G.vehicle && G.vehicle.mounted)) ? N.nearest() : null;
    var sig = near ? (near.id + ':' + near.hostile + ':' + near.verb) : '';
    if (sig !== N._hintSig && G.ui && G.ui.renderNpcHint) {
      G.ui.renderNpcHint(near);
      N._hintSig = sig;
    }
    N._phase = ph;
    return { phase: ph, count: N.list.length, moved: moved, step: +total.toFixed(4) };
  };

  /** 最近可交互居民：街区 hold 态 + 局部米 + 正前方扇形；误报 0（条件全真才返回）。 */
  N.nearest = function () {
    if (!N.active || !N.list.length) return null;
    var M = G.map3d;
    if (M && M.NPC === false) return null;
    var D = G.district;
    if (!D || !D.active || D.phase !== 'hold' || !D.plan) return null;
    if (G.vehicle && G.vehicle.mounted) return null;
    var fx = Math.sin(D.yaw), fz = -Math.cos(D.yaw);
    var best = null;
    for (var i = 0; i < N.list.length; i++) {
      var np = N.list[i];
      var dx = np.x - D.pos.x, dz = np.z - D.pos.z;
      var d2 = dx * dx + dz * dz;
      if (d2 > N.RANGE * N.RANGE) continue;
      var dist = Math.sqrt(d2);
      var cos = dist > 0.05 ? (dx * fx + dz * fz) / dist : 1;
      var ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
      if (ang > N.CONE) continue;
      if (!best || dist < best.dist) {
        best = {
          id: np.id, name: np.name, hostile: np.hostile,
          verb: np.hostile ? '挑战' : '交谈',
          dist: +dist.toFixed(3), angle: +ang.toFixed(1)
        };
      }
    }
    return best;
  };

  /** 对话唯一出口：无敌对/无目标静默；台词数据驱动，走既有 log + toast。 */
  N.talk = function () {
    var near = N.nearest();
    if (!near) return { ok: false, msg: '' };
    if (near.hostile) return { ok: false, msg: '对方正盯着你，先分个高下。' };
    var lines = N.TALK[N.phase()] || N.TALK.day;
    var line = lines[near.id % lines.length];
    var text = near.name + '：' + line;
    if (G.log) G.log(text);
    if (G.ui && G.ui.toast) G.ui.toast(text);
    return { ok: true, id: near.id, name: near.name, line: line, text: text };
  };

  /** 战斗唯一出口：只做"选人 + 组对手 + 调 duel.play + 落体力"，不另算伤害。 */
  N.fight = function () {
    var near = N.nearest();
    if (!near) return { ok: false, msg: '' };
    if (!near.hostile) return { ok: false, msg: '' };
    var DU = G.duel;
    if (!DU || typeof DU.play !== 'function') return { ok: false, msg: '斗将出口缺失' };
    var gens = (G.state || {}).generals || [], me = null;
    for (var i = 0; i < gens.length; i++) {
      if (!gens[i].dead) { me = gens[i]; break; }
    }
    if (!me) return { ok: false, msg: '没有可出战将领' };
    if (DU.gate) {
      var gate = DU.gate(me);
      if (!gate.ok) return { ok: false, msg: gate.msg };
    }
    var lv = 6 + (near.id * 3 + N.seed) % 25;
    var foe = {
      id: 'street-' + N.ci + '-' + near.id, name: near.name, level: lv,
      tong: 30 + lv * 2, nz: 30 + lv, yw: 40 + lv * 3, zm: 30 + lv * 2,
      attack: 20 + lv * 3, defense: 15 + lv * 2, stamina: 60 + lv * 4
    };
    var cfg = (G.DATA && G.DATA.DUEL) || {};
    var moves = (cfg.moveOrder || []).slice(0, cfg.playRounds || 5);
    if (!moves.length) moves = ['stab'];
    var res = DU.play(me, foe, moves, 'npc' + N.ci + ':' + N.seed + ':' + near.id);
    if (!res) return { ok: false, msg: '斗将判定失败' };
    var hp0 = DU.hp0Of ? DU.hp0Of(me) : 100;
    if (G.setStaNow) G.setStaNow(me, Math.max(0, Math.min(hp0, res.hpA)));
    if (G.log) {
      G.log('街边冲突：' + (me.name || '我军') + ' 对 ' + near.name + '，'
        + (res.winner === 'atk' ? '胜' : res.winner === 'def' ? '败' : '平手'));
    }
    return { ok: true, id: near.id, name: near.name, winner: res.winner,
      rounds: res.rounds.length, hpA: res.hpA, hpB: res.hpB };
  };

  /** E 键唯一分派：敌对 → fight，平民 → talk；两者都先过 nearest 误报关。 */
  N.interact = function () {
    var near = N.nearest();
    if (!near) return { ok: false, msg: '' };
    return near.hostile ? N.fight() : N.talk();
  };

  /* ---------- 渲染：挂在 P2 同一个 root 上，与街区一起渐显/渐隐 ---------- */
  function npcMat(color) {
    var m = new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 0 });
    N._ownMats.push(m);
    var D = G.district;
    if (D && D._mats) D._mats.push(m);
    return m;
  }
  N.build = function (root, plan) {
    N._meshes = [];
    if (!root || !N.active || typeof THREE === 'undefined') return false;
    try {
      var skin = npcMat(0xd9b08c), pants = npcMat(0x5a5248), mark = npcMat(0xc0392b);
      var tint = [0x8a6f4d, 0x5f7a6a, 0x7d5a5a, 0x4f5f7d].map(npcMat);
      for (var i = 0; i < N.list.length; i++) {
        var np = N.list[i], grp = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.60, 0.20), tint[np.tint % tint.length]);
        body.position.y = 0.72;
        grp.add(body);
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), skin);
        head.position.y = 1.13;
        grp.add(head);
        var mkLeg = function (sx) {
          var pv = new THREE.Group();
          pv.position.set(sx * 0.075, 0.42, 0);
          var lm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), pants);
          lm.position.y = -0.21;
          pv.add(lm);
          grp.add(pv);
          return pv;
        };
        var legL = mkLeg(-1), legR = mkLeg(1);
        if (np.hostile) {                 /* 红标：一眼看出谁会开打 */
          var bad = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), mark);
          bad.position.y = 1.38;
          grp.add(bad);
        }
        grp.position.set(np.x, 0, np.z);
        root.add(grp);                    /* 不进 nodeList：不抢 P1/P3 的拾取 */
        N._meshes.push({ grp: grp, legL: legL, legR: legR });
      }
      N.syncMesh();
      return true;
    } catch (e) {
      N._meshes = [];
      return false;
    }
  };
  N.syncMesh = function () {
    if (typeof THREE === 'undefined') return;
    for (var i = 0; i < N._meshes.length; i++) {
      var m = N._meshes[i], np = N.list[i];
      if (!m || !np) continue;
      m.grp.position.set(np.x, Math.abs(Math.sin(np.leg)) * 0.02, np.z);
      m.grp.rotation.y = np.yaw;
      m.legL.rotation.x = Math.sin(np.leg) * 0.6;
      m.legR.rotation.x = -Math.sin(np.leg) * 0.6;
    }
  };
})();
