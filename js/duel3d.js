/* ============================================================
 * js/duel3d.js — **斗将 3D 舞台**（v156.20 · 老板「目前还是偏文字游戏了，
 *   把文字场景化，3D 对战」）
 * ------------------------------------------------------------
 * 定位：把原来"两张画像 + 伤害数字"的斗将面板，换成**看得见两个人真打**的 3D 舞台。
 *
 * 三条边界（不越界）：
 *   ① **判定仍然只有一份**：胜负/伤害全走 `GAME.duel.play()`（纯函数，见 duel.js）。
 *      本模块**只读结果**，不掷骰、不改血 —— 于是"画面演的"与"账上算的"永远同一场。
 *   ② **只做表现**：舞台负责 站位/出招/受击/胜负姿态；名字、血条、招式键仍是 DOM
 *      （3D 里画血条在低分辨率下必糊，且读不出数值）。
 *   ③ **单例 + 可重入**：面板每走一合都会整块重绘，`mount()` 被反复调用；
 *      场景/加载好的角色**只建一次**，画布元素在 DOM 里被搬来搬去（保 context 不丢）。
 *
 * 角色与动作（资产见 assets/actors，动作映射见 gltf.js 的 CLIP_MAPS）：
 *   我方 = Soldier（人形，4 段动作）；对手 = RobotExpressive（机械，14 段动作）。
 *   ⚠️ 诚实缺口：Soldier 只有 Idle/Run/Walk/TPose —— 它的 "出招" 是 Run、"受击" 是 Idle，
 *      靠位移补戏；想更好看就把 ME_MODEL 换成 RobotExpressive（一行）。
 * ============================================================ */
import './core.js';
import './gltf.js';
(function () {
  var GAME = window.GAME = window.GAME || {};
  var D3 = GAME.duel3d = {};

  D3.enabled = true;                 /* 测试/降级开关：关掉就退回纯 DOM 面板 */
  /* ============================================================
   * CLIP_ON —— 是否播放骨骼动作（**默认关**，原因写在下面）
   * ------------------------------------------------------------
   * Soldier 这个资产的"绑定姿态空间"（网格 0.003 单位）与"骨骼空间"（1.5 单位）
   * 差三个数量级，动作里又带根位移：一旦播 clip，模型会被推到画面外（实测
   * pxAfter=0，人直接消失）。Robot 没有这个问题，但两个角色一个动一个不动更怪。
   * 所以 v1 只做**站桩对打**：前冲 + 前倾 + 受击退 + 伤害数字（尺寸全程稳定）。
   * 要开动作，先修 gltf 的蒙皮空间（或换一个 binding 规整的角色资产）。
   * ============================================================ */
  var CLIP_ON = false;
  var ME_MODEL = 'Soldier';
  var FOE_MODEL = 'RobotExpressive';

  /* 站位（世界单位）：两人分列 ±X，面对面 */
  var ME_X = -0.62, FOE_X = 0.62;
  /* 实测默认朝向（.workbuddy/shots/stand_idle.png）：士兵背面朝 +Z（正面 −Z）、机器人正面 +Z。
     两人都绕 −90° 才能面对面（士兵→+X，机器人→−X）。 */
  var ME_YAW = -Math.PI * 0.5;
  var FOE_YAW = Math.PI * 0.5;

  var S = null;                      /* 单例场景 */
  var _idleFrames = 0;               /* 画布不在页面上连续多少帧（用于自动停 RAF） */

  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function THREE_OK() { return !!(window.THREE && GAME.gltf && GAME.gltf.Actor); }

  /* ---------------- 场景构建（只做一次） ---------------- */
  function build() {
    if (S) return S;
    if (!THREE_OK()) return null;
    var THREE = window.THREE;
    var canvas = document.createElement('canvas');
    canvas.className = 'duel-canvas';
    var renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x140f0b, 3.6, 7.5);

    var cam = new THREE.PerspectiveCamera(40, 1.6, 0.05, 60);
    cam.position.set(0, 1.18, 2.60);
    cam.lookAt(0, 0.55, 0);

    /* 光：暖主光 + 冷补光 + 半球环境（废土黄昏的基调，不抢人物剪影） */
    scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x241a12, 1.05));
    var key = new THREE.DirectionalLight(0xffe6bf, 1.75); key.position.set(3.2, 5.4, 3.4); scene.add(key);
    var rim = new THREE.DirectionalLight(0x7f9dd6, 0.85); rim.position.set(-3.6, 2.4, -3.2); scene.add(rim);

    /* 地台：一块圆形沙地 + 一圈暗红边沿（"竞技场"的最小视觉锚） */
    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.15, 56),
      new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.98, metalness: 0.04 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(1.62, 1.74, 64),
      new THREE.MeshBasicMaterial({ color: 0x9a6a3a, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    scene.add(ring);

    S = {
      canvas: canvas, renderer: renderer, scene: scene, cam: cam,
      me: null, foe: null, meReady: false, foeReady: false,
      round: 0, over: false, winner: null,
      anim: null,                 /* 当前这一合的表演时间线 */
      t0: nowMs(), last: nowMs(),
      raf: 0, dead: false
    };
    loadActors(S);
    S.raf = requestAnimationFrame(tick);
    return S;
  }

  /* ⚠️ 两个坑一起规避：
     ① `parseAnimated` 把"立姿"旋转写在 `actor.root.rotation.z`（或 .x）上 ——
        这里**绝不能**直接改 `root.rotation.y`：Euler 三个分量是复合的，
        在 z=90° 的基础上再写 y=180° 会把站姿拧成**躺姿**（实测就是这么躺的）。
        正确做法：套一层 Group，转身加在外层，根节点原样不动。
     ② 归一化的"脚底贴地"补偿记在 `root.position.y`，外层不能再写 0（会埋进地里）。 */
  function prepRoot(actor, x, yaw) {
    var THREE = window.THREE;
    var wrap = new THREE.Group();
    wrap.add(actor.root);
    wrap.position.set(x, 0, 0);
    wrap.rotation.y = yaw;
    actor._wrap = wrap;
    actor._groundY = actor.root.position.y || 0;
    actor.root.traverse(function (o) { if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; } });
    return wrap;
  }

  function loadActors(st) {
    var me = new GAME.gltf.Actor({ name: ME_MODEL });
    me.load(function (a) {
      if (!a || st.dead) return;
      st.scene.add(prepRoot(a, ME_X, ME_YAW));
      st.me = a; st.meReady = true;
      if (CLIP_ON) a.skill(st.over ? (st.winner === 'atk' ? 'victory' : 'defeat') : 'idle');
    });
    var foe = new GAME.gltf.Actor({ name: FOE_MODEL });
    foe.load(function (a) {
      if (!a || st.dead) return;
      st.scene.add(prepRoot(a, FOE_X, FOE_YAW));
      st.foe = a; st.foeReady = true;
      if (CLIP_ON) a.skill(st.over ? (st.winner === 'def' ? 'victory' : 'defeat') : 'idle');
    });
  }

  /* ---------------- 每帧 ---------------- */
  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  function tick() {
    if (!S || S.dead) return;
    S.raf = requestAnimationFrame(tick);
    var t = nowMs(), dt = Math.min(0.05, (t - S.last) / 1000);
    S.last = t;

    if (S.canvas.isConnected === false) {
      /* 画布被面板重绘摘下来了：先空转，连续 240 帧（≈4s）还不在就停下来省电 */
      if (++_idleFrames > 240) { S.dead = true; return; }
    } else { _idleFrames = 0; }

    if (S.me) S.me.update(dt);
    if (S.foe) S.foe.update(dt);
    if (S.anim) stepAnim(S.anim, t);

    if (S.canvas.width > 0 && S.canvas.height > 0) S.renderer.render(S.scene, S.cam);
  }

  /* ---------------- 一合的表演时间线 ----------------
   * 0.00~0.34 进攻方前冲（左右各出手一次 → 两边都冲）
   * 0.34~0.52 命中：受击方位移一下 + 后仰
   * 0.52~0.95 回到站位
   * 任何时刻被新的 react() 打断都重新计时（连点招式不会卡在"冲到一半"）
   */
  var LUNGE = 0.62, RECOIL = 0.24;
  function stepAnim(an, t) {
    var p = (t - an.t0) / 1000;
    var st = S;
    function put(actor, baseX, sign, off) {
      if (!actor || !actor._wrap) return;
      actor._wrap.position.x = baseX + off * sign;
    }
    if (an.over) {                       /* 结算：归位 + 只播姿态（别停在"冲出去一半"的位置） */
      if (st.me && st.me._wrap) { st.me._wrap.position.x = ME_X; st.me._wrap.rotation.x = 0; }
      if (st.foe && st.foe._wrap) { st.foe._wrap.position.x = FOE_X; st.foe._wrap.rotation.x = 0; }
      if (p > 0.25) { st.anim = null; }
      return;
    }
    if (p >= 1.0) { st.anim = null; return; }
    /* 前半：双方同时前冲（每合双方各出手一次，这是本作的规矩） */
    var punch = p < 0.5 ? ease(Math.min(1, p / 0.34)) * (p < 0.34 ? 1 : 1) : 0;
    if (p >= 0.5) punch = Math.max(0, 1 - ease(Math.min(1, (p - 0.5) / 0.35)));
    if (p >= 0.34 && p < 0.5) punch = 1;
    var meOff = LUNGE * punch, foeOff = LUNGE * punch;
    /* 受击：谁挨得多谁多退半步 */
    var rec = 0;
    if (p > 0.34) rec = RECOIL * Math.max(0, 1 - Math.min(1, (p - 0.34) / 0.34));
    put(st.me, ME_X, +1, meOff - (an.dmgToA > an.dmgToB ? rec : 0));
    put(st.foe, FOE_X, -1, foeOff - (an.dmgToB > an.dmgToA ? rec : 0));
    /* 身体微俯：出招时前倾一点，站着时不僵 */
    var lean = 0.10 * punch;
    if (st.me && st.me._wrap) st.me._wrap.rotation.x = lean;
    if (st.foe && st.foe._wrap) st.foe._wrap.rotation.x = lean;
  }

  /* ---------------- 对外：挂到面板上 ----------------
   * opts = {
   *   holderId, roundNo, over, winner, dmgToA, dmgToB,
   *   meName, foeName, meHp, meMax, foeHp, foeMax, faceMe, faceFoe
   * }
   */
  D3.mount = function (opts) {
    opts = opts || {};
    if (!D3.enabled) return false;
    var st = build();
    if (!st) return false;
    var holder = document.getElementById(opts.holderId || 'duel-stage3d');
    if (!holder) return false;

    if (st.canvas.parentNode !== holder) {
      holder.appendChild(st.canvas);
      _idleFrames = 0;
      /* 曾因长时间离屏停过 RAF → 重新挂上来时把循环拉起来（否则画面定住） */
      if (st.dead) { st.dead = false; st.last = nowMs(); st.raf = requestAnimationFrame(tick); }
      /* 画布被 DOM 搬过一次后 context 仍有效，但视口要按新容器重量 */
      var w = Math.max(1, holder.clientWidth || 520);
      var h = Math.max(1, holder.clientHeight || 240);
      st.renderer.setSize(w, h, false);
      st.cam.aspect = w / h;
      st.cam.updateProjectionMatrix();
    }

    /* 新的一合 → 重播表演；同一合重复挂载（比如重绘）不重播 */
    var rn = opts.roundNo | 0;
    if (rn !== st.round) {
      st.round = rn;
      st.over = !!opts.over;
      st.winner = opts.winner || null;
      if (st.over) {
        st.anim = { t0: nowMs(), over: true, dmgToA: 0, dmgToB: 0 };
        var w = st.winner;
        if (CLIP_ON) {
          if (st.me) st.me.skill(w === 'atk' ? 'victory' : (w === 'def' ? 'defeat' : 'idle'));
          if (st.foe) st.foe.skill(w === 'def' ? 'victory' : (w === 'atk' ? 'defeat' : 'idle'));
        }
      } else if (rn > 0) {
        st.anim = { t0: nowMs(), over: false, dmgToA: opts.dmgToA | 0, dmgToB: opts.dmgToB | 0 };
        if (CLIP_ON) {
          if (st.me) st.me.skill('attack');
          if (st.foe) st.foe.skill('attack');
        }
      }
    }
    return true;
  };

  /* 供外部/测试读状态（不算公开 API，但比"翻内部变量"稳）。
     bbox 一并给出：立姿/贴地/比例这三件事全靠它说话，比"看着像"可靠。 */
  D3.state = function () {
    if (!S) return null;
    var THREE = window.THREE;
    function bbox(a) {
      if (!a || !a.root) return null;
      try {
        var b = new THREE.Box3().setFromObject(a.root);
        return {
          min: [+b.min.x.toFixed(3), +b.min.y.toFixed(3), +b.min.z.toFixed(3)],
          max: [+b.max.x.toFixed(3), +b.max.y.toFixed(3), +b.max.z.toFixed(3)],
          h: +(b.max.y - b.min.y).toFixed(3)
        };
      } catch (e) { return null; }
    }
    return {
      ready: !!(S.meReady && S.foeReady), me: S.meReady, foe: S.foeReady,
      round: S.round, over: S.over, winner: S.winner,
      meClip: S.me && S.me.currentName, foeClip: S.foe && S.foe.currentName,
      canvasInDom: !!(S.canvas && S.canvas.isConnected),
      size: S.canvas ? [S.canvas.width, S.canvas.height] : null,
      meBox: bbox(S.me), foeBox: bbox(S.foe),
      mePos: S.me ? S.me.root.position.toArray().map(function (v) { return +v.toFixed(3); }) : null,
      foePos: S.foe ? S.foe.root.position.toArray().map(function (v) { return +v.toFixed(3); }) : null,
      cam: S.cam.position.toArray().map(function (v) { return +v.toFixed(2); })
    };
  };

  D3.close = function () {
    if (!S) return;
    S.dead = true;
    try { cancelAnimationFrame(S.raf); } catch (e) { }
    try { if (S.canvas.parentNode) S.canvas.parentNode.removeChild(S.canvas); } catch (e) { }
    try { S.renderer.dispose(); } catch (e) { }
    S = null;
  };
})();
