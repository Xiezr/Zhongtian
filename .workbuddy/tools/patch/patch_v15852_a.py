# -*- coding: utf-8 -*-
"""v158.52 A：重写 _tickFlight 为自由 3D 惯性飞行 + 三角锥战舰 + 尾迹。
   读-改-写分离；幂等 mark = M.FLY_VEL_TURN；每行 newline='' 保 LF。"""
import io, os, sys

P = 'E:/Deepseekdb/js/map3d.js'
MARK = 'M.FLY_VEL_TURN'
START = '  M.FLY_MAX = 120;         /* 前飞上限（m/s）。v158.45 提速：45→120（老板「相机移动'
END = '  /* ============================================================\n   * v158.44（老板「人太大又太小了。'


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


NEW = r'''  /* ============================================================
   * v158.52（老板五条：①高度固定不合理 ②QE→←→加减速、↑↓改海拔
   *   ③前进不是前进 ④转向无速度轨迹、像在转星球 ⑤三角锥战舰形体）
   * ------------------------------------------------------------
   * **飞行 = 太空中的惯性战舰**（不再是"绕球滚动的相机"）：
   *   · 位置 `fly.pos` 是自由 3D 点（不再锁 camO.dist 球面），沿**速度矢量**
   *     `fly.vel` 推进；机头 `fly.head` 由 W/S 俯仰、A/D 转向操纵；
   *   · 速度标量 `fly.v` 在无外力时**恒定**（牛顿第一定律）——只有 ←→（加减速）
   *     或左键（刹车）才改它；松键不再指数衰减；
   *   · 转向时机头先转，**速度矢量以有限角率追随**（FLY_VEL_TURN）——
   *     于是轨迹是一条弧线，飞船"漂移"着拐弯，而不是把星球转过来；
   *   · ↑↓ 直接改球心距离（海拔），松手保持当前高度；
   *   · 第三人称机位 + 三角锥战舰 mesh + 尾迹线，让运动看得见。
   * camO.dir/dist/yaw/pitch 仍是 placeCamera 与地表交班的唯一位置来源，
   * 每帧由 fly.pos 反算写回（这是与既有相机状态机的唯一接口）。
   * ============================================================ */
  M.FLY_MAX = 120;         /* 前飞上限（m/s） */
  M.FLY_BACK_MAX = 72;     /* 倒飞上限 = 0.6×FLY_MAX */
  M.FLY_ACCEL = 48;        /* 加速度（m/s²）：约 2.5 秒到顶 */
  M.FLY_TURN = 1.1;        /* 机头转向率（rad/s） */
  M.FLY_VEL_TURN = 0.65;   /* v158.52：速度矢量追随机头的角率（rad/s）——
                              有限角率 = 转向留弧线（惯性），不是瞬移朝向 */
  M.FLY_CLIMB = 24;        /* v158.52：↑↓ 升降速率（m/s）——直接改半径 */
  M.FLY_CAM_BACK = 18;     /* v158.52：第三人称机位在战舰后方（m） */
  M.FLY_CAM_UP = 6;        /* 机位高于战舰（m，沿径向朝外） */
  M.FLY_CAM_LOOK = 42;     /* 机位注视战舰前方（m） */
  M.FLY_TRAIL_MAX = 120;   /* 尾迹采样点数 */
  M.FLY_PITCH = 0.9;       /* W/S 机头俯仰率（rad/s） */
  M.FLY_LEVEL_AFTER = 2.5; /* 无方向输入 N 秒后右键视角偏移缓慢回 0 */
  M.FLY_LEVEL_RATE = 0.5;
  M._fly = { v: 0, pos: null, head: null, vel: null, active: false,
             climb: 0, trail: [], trailAt: 0 };
  function _flyVec(a) { return new THREE.Vector3(a[0], a[1], a[2]); }

  /* ---- 三角锥战舰 + 尾迹（唯一形体；地表态隐藏） ---- */
  function _ensureShip() {
    if (M._shipMesh || !scene || !scene.add) return M._shipMesh;
    try {
      var g = new THREE.ConeGeometry(2.4, 8, 3);
      g.rotateX(Math.PI / 2);                 /* 锥尖 +Y → +Z（head） */
      var m = new THREE.MeshBasicMaterial({ color: 0x7ff3ff, wireframe: false });
      M._shipMesh = new THREE.Mesh(g, m);
      /* 引擎光点：锥尾一个小球，让"前进方向"一眼可辨 */
      var eg = new THREE.SphereGeometry(0.9, 8, 6);
      M._shipEngine = new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ color: 0xffb84d }));
      scene.add(M._shipMesh); scene.add(M._shipEngine);
      var tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array((M.FLY_TRAIL_MAX || 120) * 3), 3));
      M._shipTrail = new THREE.Line(tg, new THREE.LineBasicMaterial({
        color: 0x35ffe8, transparent: true, opacity: 0.75 }));
      M._shipTrail.frustumCulled = false;
      scene.add(M._shipTrail);
    } catch (eS) { M._shipErr = String(eS && eS.message); }
    return M._shipMesh || null;
  }
  function _paintShip() {
    var fly = M._fly;
    if (!fly || !M._shipMesh) return;
    var show = !!(fly.active && !M._surf && fly.pos && fly.head);
    M._shipMesh.visible = M._shipEngine.visible = M._shipTrail.visible = show;
    if (!show) return;
    try {
      var p = _flyVec(fly.pos), h = _flyVec(fly.head).normalize(), r = p.clone().normalize();
      M._shipMesh.position.copy(p);
      M._shipMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), h);
      M._shipEngine.position.copy(p).addScaledVector(h, -4.4);
      var arr = M._shipTrail.geometry.attributes.position.array;
      var n = fly.trail.length;
      for (var i = 0; i < n; i++) {
        var t = fly.trail[i]; arr[i * 3] = t[0]; arr[i * 3 + 1] = t[1]; arr[i * 3 + 2] = t[2];
      }
      M._shipTrail.geometry.attributes.position.needsUpdate = true;
      M._shipTrail.geometry.setDrawRange(0, n);
    } catch (eP) { if (!M._shipPaintErr) M._shipPaintErr = String(eP && eP.message); }
  }
  M.paintShip = _paintShip;

  function _tickFlight(dt) {
    var fly = M._fly || (M._fly = { v: 0, pos: null, head: null, vel: null, active: false,
                                    climb: 0, trail: [], trailAt: 0 });
    var keys = (GAME && GAME._flyKeys) || null;
    /* 地表/跟随 = 走路态：战舰收起、速度清零 */
    if (M._surf || M.FOLLOW) {
      if (fly.v) fly.v = 0;
      if (fly.active) fly.active = false;
      _paintShip();
      return false;
    }
    dt = Math.max(0.001, Math.min(0.12, dt || 0.016));
    var l = !!(keys && keys.left), r = !!(keys && keys.right),
        u = !!(keys && keys.up), dn = !!(keys && keys.down),
        w = !!(keys && keys.w), s = !!(keys && keys.s),
        a = !!(keys && keys.a), d = !!(keys && keys.d);
    if (!fly.pos || !fly.head || !fly.vel) {
      var _dd = camO.dist;
      fly.pos = [camO.dir[0] * _dd, camO.dir[1] * _dd, camO.dir[2] * _dd];
      var _rv = new THREE.Vector3(camO.dir[0], camO.dir[1], camO.dir[2]);
      var _hv = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
      _hv.addScaledVector(_rv, -_hv.dot(_rv));
      if (_hv.lengthSq() < 1e-8) {
        _hv = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), _rv);
        if (_hv.lengthSq() < 1e-8) _hv.set(1, 0, 0);
      }
      _hv.normalize();
      fly.head = [_hv.x, _hv.y, _hv.z];
      fly.vel = [_hv.x, _hv.y, _hv.z];
    }
    var pos = _flyVec(fly.pos), head = _flyVec(fly.head), vel = _flyVec(fly.vel);
    var radial = pos.clone().normalize();
    /* ① 速度标量：←→ 是唯一的"发动机力"，无输入恒速（牛顿第一定律） */
    if (r) fly.v += (M.FLY_ACCEL || 48) * dt;
    if (l) fly.v -= (M.FLY_ACCEL || 48) * dt;
    var _vmax = M.FLY_MAX || 120, _vmin = -(M.FLY_BACK_MAX || 72);
    fly.v = Math.max(_vmin, Math.min(_vmax, fly.v));
    if (!r && !l && Math.abs(fly.v) < 0.01) fly.v = 0;
    /* ② ↑↓ 升降：直接改球心距离（海拔），松手保持 */
    var _climb = u ? (M.FLY_CLIMB || 24) : (dn ? -(M.FLY_CLIMB || 24) : 0);
    if (_climb) {
      var _nr0 = pos.length() + _climb * dt;
      _nr0 = Math.max(R + (M.SURF_EYE || 1.7) + 2, Math.min(M.ZOOM_MAX || R * 50, _nr0));
      pos.setLength(_nr0);
      radial = pos.clone().normalize();
    }
    fly.climb = _climb;
    /* ③ 机头：W/S 俯仰（绕 right）、A/D 转向（绕径向 up） */
    var right = new THREE.Vector3().crossVectors(radial, head);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    if (a) head.applyAxisAngle(radial, -(M.FLY_TURN || 1.1) * dt);
    if (d) head.applyAxisAngle(radial, (M.FLY_TURN || 1.1) * dt);
    if (w) head.applyAxisAngle(right, (M.FLY_PITCH || 0.9) * dt);
    if (s) head.applyAxisAngle(right, -(M.FLY_PITCH || 0.9) * dt);
    head.normalize();
    /* ④ 速度矢量以有限角率追随机头 —— 转向留下弧线轨迹（惯性），
          而不是旧版"视线切向瞬移、星球像被转过来" */
    var _vt = (M.FLY_VEL_TURN || 0.65) * (0.25 + 0.75 * Math.min(1, Math.abs(fly.v) / _vmax));
    vel.lerp(head, Math.min(1, _vt * dt)).normalize();
    /* ⑤ 位置沿速度矢量推进（自由 3D，不再锁球面切向） */
    pos.addScaledVector(vel, fly.v * dt);
    fly.pos = [pos.x, pos.y, pos.z];
    fly.head = [head.x, head.y, head.z];
    fly.vel = [vel.x, vel.y, vel.z];
    fly.active = true;
    /* 与既有相机状态机对账：每帧由自由位置反算 camO 的位置量 */
    var _nr = pos.length();
    camO.dist = _nr;
    /* 同步滚轮阻尼锚点：否则 placeCamera 的 _zoomDamp 会把半径拉回旧值 */
    try { _zoomTarget = _nr - R; _zoomLastT = 0; } catch (eZ) { }
    var _nd = pos.clone().multiplyScalar(1 / Math.max(1e-6, _nr));
    camO.dir = [_nd.x, _nd.y, _nd.z];
    camO.yaw = Math.atan2(_nd.x, _nd.z);
    camO.pitch = Math.asin(Math.max(-1, Math.min(1, _nd.y)));
    camO.quat = null; camO._euler = null;
    /* 右键视角偏移缓慢回正（v158.51 保留；第三人称 up 恒径向，天然脚底星球） */
    var _idle = !(w || s || a || d || !!M._rmbLook);
    if (_idle) {
      M._flyIdleT = (M._flyIdleT || 0) + dt;
      if (M._flyIdleT > (M.FLY_LEVEL_AFTER || 2.5)) {
        var _lp = camO.lookPitch || 0;
        camO.lookPitch = Math.abs(_lp) > 0.01
          ? _lp - Math.sign(_lp) * Math.min(Math.abs(_lp), (M.FLY_LEVEL_RATE || 0.5) * dt) : 0;
      }
    } else M._flyIdleT = 0;
    /* 尾迹采样：每 0.08 秒一点，只记真在动的时候 */
    var _now = Date.now();
    if (Math.abs(fly.v) > 0.3 && _now - (fly.trailAt || 0) > 80) {
      fly.trail.push([pos.x, pos.y, pos.z]);
      if (fly.trail.length > (M.FLY_TRAIL_MAX || 120)) fly.trail.shift();
      fly.trailAt = _now;
    }
    _ensureShip();
    _paintShip();
    try { M._lastAct = _now; } catch (eT) { }
    return !!(l || r || u || dn || w || s || a || d || fly.v);
  }
  M.flyTick = _tickFlight;
  /* 探针出口（只读纯函数）：飞行状态快照 —— 给 smoke 断言/探针用。 */
  M.flyProbe = function () {
    var f = M._fly || {};
    return { v: f.v || 0, pos: f.pos ? f.pos.slice() : null,
      head: f.head ? f.head.slice() : null, vel: f.vel ? f.vel.slice() : null,
      active: !!f.active, climb: f.climb || 0, trail: (f.trail || []).length,
      alt: f.pos ? (Math.hypot(f.pos[0], f.pos[1], f.pos[2]) - R) : null,
      max: M.FLY_MAX, back: M.FLY_BACK_MAX, accel: M.FLY_ACCEL,
      turn: M.FLY_TURN, velTurn: M.FLY_VEL_TURN, climbRate: M.FLY_CLIMB,
      yaw: camO.yaw, pitch: camO.pitch, dir: camO.dir ? camO.dir.slice() : null,
      lookYaw: camO.lookYaw, lookPitch: camO.lookPitch };
  };
'''


def main():
    s = rd(P)
    if MARK in s:
        print('[skip] v158.52 A already applied')
        return
    i = s.index(START)
    j = s.index(END, i)
    old = s[i:j]
    assert 'M.FLY_MAX = 120;' in old and 'M.flyTick = _tickFlight;' in old, 'anchor region wrong'
    s2 = s[:i] + NEW + s[j:]
    assert s2.count(MARK) >= 1, 'mark not written'
    # 结构自检：括号差值不变（剥注释有已知偏差，用差值法）
    for op, cl in (('{', '}'), ('(', ')'), ('[', ']')):
        assert s2.count(op) - s2.count(cl) == s.count(op) - s.count(cl), ('bracket diff ' + op)
    wr(P, s2)
    print('[ok] v158.52 A applied: %d -> %d chars' % (len(s), len(s2)))


main()
