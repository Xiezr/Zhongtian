/* ============================================================
 * map3d.js — Three.js **星球 3D 地图**（cube-sphere 地形 + 等面积地块）
 * ------------------------------------------------------------
 * 老板口径：地形卷成**球形**（星球表面地形）；地形与地块都**不在两极收敛**；
 *   地块**等面积**、随数量缩小；地块**依附地形高度**（距球心 = 海平面 R + 地形高）。
 * 地形：**cube-sphere**（立方体 6 面细分投影球面 → 顶点全球均匀，无极性挤压）。
 * 地块：**斐波那契球面均匀分布**（等面积 · 无极性收敛）。
 * 数据：高度/深度来自 GAME.map.heightAt / depthAt（单一出口）；地形读 GAME.map.tile。
 * 相机：轨道（左键拖动转向 · 滚轮缩放）。回退：GAME.map3d.enabled=false → 二维。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
import './gltf.js';
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  /* ============================================================
   * v156.15：两个**不依赖 THREE** 的地块分派函数，提前定义好 ——
   * ------------------------------------------------------------
   * 为什么提出来：本文件在 jsdom（无 THREE）下第 18 行就整块 `return`，
   * 于是"点哪一格该给什么面板 / 该不该给手势条"这段**纯数据逻辑**在 smoke 里根本不存在，
   * 只能靠正则扫源码（等于没测）。
   * 这两个函数只碰 GAME.map / GAME.camp / GAME.village / GAME.fortOwnAt（v158.25 起不含 ruin）
   * 和 `GAME.map3d.cellRef|cellKind`，**一行 THREE 都不需要** → 提到守卫之前，
   * 两种环境都挂上同一份实现（不许在无 THREE 分支里另写一份）。
   * ============================================================ */
  /* ============================================================
   * v156.17（老板：「地图上各颜色地块是啥意思，能不能悬停显示」）
   * `_cellBrief(ci)` —— 一格到底**是什么**（纯数据，不碰 THREE）
   * ------------------------------------------------------------
   * 返回 { icon, title, lv, facts[], tasks[], coord, kind }：
   *   facts = 它是什么（地形 / 归属 / 状态）
   *   tasks = 点它能干什么（营地可清剿、遗迹可探索、村社可交涉、未占野地可占领……）
   * 为什么做成纯函数：悬停提示在 jsdom 里没法测（无 WebGL），但这套判定必须能测 ——
   * 所以判定与渲染分开，smoke 直接调它（§582）。
   * ============================================================ */
  function _cellBrief(ci) {
    var S = GAME.mapSphere || GAME.sphere || {};
    var cells = S.cells;
    if (!cells || !(ci >= 0) || !cells[ci]) return null;
    var c = cells[ci];
    var TN = S.TYPE_NAME || (GAME.sphere && GAME.sphere.TYPE_NAME) || {};
    var ICON = { lake: '💧', zhaoze: '🪵', plain: '🌿', caoyuan: '🌾', forest: '🌲', desert: '🏜', hill: '⛰' };
    var lv = (c.level != null) ? Math.max(0, c.level | 0) : 0;
    var kind = null;
    try { kind = (GAME.map3d && GAME.map3d.cellKind) ? GAME.map3d.cellKind[ci] : null; } catch (e) { kind = null; }
    var out = {
      icon: ICON[c.type] || '🗺',
      title: (TN[c.type] || '地块'),
      lv: lv,
      facts: [],
      tasks: [],
      coord: (GAME.map && GAME.map.coordText && c.x != null && c.y != null)
        ? GAME.map.coordText(c.x, c.y) : null,
      kind: kind
    };
    var hidden = false;
    try { hidden = !!(GAME.fog && GAME.fog.get && GAME.fog.get(ci) === 0); } catch (e) { hidden = false; }
    if (hidden) {
      out.icon = '🌫';
      out.title = '未探明';
      out.lv = null;
      /* ============================================================
       * v157.77（老板：「依旧还有很多色块……没有声明这个是什么东西」）
       * ------------------------------------------------------------
       * 未探明格上有两种长相：干净的一片空白，和**一层暖褐色**
       * （v92.6 半信息痕迹：迷雾边缘按概率泛色，表示"那边有东西"）。
       * 以前两者都只说"这一带还没有记载"，于是褐色块变成"没人解释的色块"。
       * 这里把颜色含义说清楚，但**仍然不透露是什么** —— 守住 v92.6 的口径：
       * 「知道有东西、不知是什么」是设计，不是缺陷。
       * ============================================================ */
      out.facts.push('这一带还没有记载');
      out.tasks.push('派一队过去（点它 = 派队），抵达后周围显现');
      return out;
    }
    /* v157.77：补上 `lord` —— 地图上亮黄那格是「君主所在」，
       以前这里没有分支，它会一路掉到"野地（未占）"，等于君主脚下说不出是什么。 */
    out.facts.push(kind === 'own' ? '己方城市'
      : kind === 'npc' ? '名城'
        : kind === 'adm' ? '行政城'
          : kind === 'lord' ? '君主所在（你的主力在此）' : null);
    out.facts = out.facts.filter(Boolean);
    var ownCity = GAME.map && GAME.map.ownCityAt ? GAME.map.ownCityAt(ci) : null;
    var npc = GAME.map && GAME.map.npcAt ? GAME.map.npcAt(ci) : null;
    if (ownCity) {
      out.facts.push('你的城：' + (ownCity.name || '无名'));
      out.tasks.push('点它 = 进城 / 运输 / 派遣');
    } else if (npc) {
      out.facts.push('名城：' + (npc.name || '无名'));
      out.tasks.push('点它 = 出征（面板底部有侦查 / 掠夺 / 占领）');
    } else {
      var fort = null;
      try {
        fort = (GAME.map.fortAt && GAME.map.fortAt(ci,
          GAME.map._pctx && GAME.mapPlanetOf ? GAME.map._pctx(GAME.mapPlanetOf().id) : null)) || null;
      } catch (e2) { fort = null; }
      var ownFort = null;
      try { ownFort = (GAME.fortOwnAt && GAME.fortOwnAt(ci)) || null; } catch (e3) { ownFort = null; }
      if (ownFort) { out.facts.push('我方前哨'); out.tasks.push('点它 = 驻军 / 采集 / 据点情报'); }
      else if (fort) { out.facts.push('据点（未占）'); out.tasks.push('点它 = 出征攻打（先侦查可看守军）'); }
      else if (GAME.camp && GAME.camp.isFound && GAME.camp.isFound(ci)) {
        out.facts.push('营地');
        out.tasks.push('⚔️ 可清剿（走到跟前动手，给经验与物资）');
      } else if (GAME.village && GAME.village.at && GAME.village.at(ci)
        && (!GAME.village.isKnown || GAME.village.isKnown(ci))) {
        out.facts.push('村社');
        out.tasks.push('🏘️ 可交涉（关系长期变化）');
      /* ⛔ v158.25：遗迹情报分支随遗迹系统退役（老板选 A）。 */
      } else {
        var w = null;
        try { w = GAME.map.wildAt ? GAME.map.wildAt(ci) : null; } catch (e4) { w = null; }
        if (w) { out.facts.push('野地（已占）'); out.tasks.push('点它 = 采集 / 派驻 / 放弃'); }
        else {
          out.facts.push('野地（未占）');
          out.tasks.push('点它 = 出征占领 / 掠夺（可先侦查）');
          if (c.type === 'plain') out.tasks.push('平地：占领后可在这里立城');
        }
      }
    }
    /* ============================================================
     * v157.77：色块说明兜底
     * ------------------------------------------------------------
     * 整格涂色有 5 类来源（营地 / 村社 / 遗迹 / 我方占领 / 阵亡纪念）。
     * ⚠️ v157.98：「迷雾边缘的动静痕迹」已整条退役（老板指令）—— 它是前传
     *    （v92.6 构想 A2）的遗留，前传下线后既没有玩法承接，又让地图多出一批
     *    "说不清是什么的色块"。别再把它加回来。
     * 上面各分支已经覆盖了绝大多数情况，但**任何一格只要上了色，就应当说得出它是什么** ——
     * 玩家不该对着色块猜。这里按"来源表"补一行，并用 indexOf 去重，
     * 避免与上面已经写明的"营地 / 村社"重复（遗迹 v158.25 退役）。
     * ============================================================ */
    var _tkK = null;
    try { _tkK = (GAME.map3d && GAME.map3d._tintKind) ? GAME.map3d._tintKind[ci] : null; } catch (e6) { _tkK = null; }
    var TK_DESC = {
      camp: '幸存者营地',
      village: '村社',
      /* v158.25：ruin 随遗迹系统退役 */
      own: '我方占领',
      memorial: '阵亡纪念地'
    };
    if (_tkK && TK_DESC[_tkK]) {
      var _hit = out.facts.join('').indexOf(TK_DESC[_tkK]) >= 0
        || (_tkK === 'own' && out.facts.join('').indexOf('前哨') >= 0)
        || (_tkK === 'camp' && out.facts.join('').indexOf('营地') >= 0)
        || (_tkK === 'village' && out.facts.join('').indexOf('村社') >= 0);
      if (!_hit) out.facts.push('地面标记：' + TK_DESC[_tkK]);
    }
    return out;
  }
  /* ============================================================
   * v158.20（老板「去掉人物模式 · 只提示人物位置 · 让人物真实走动起来」）
   * ------------------------------------------------------------
   * 点场景 = 小人**走过去** + 开面板，一次包住。
   * 为什么包一层、不改 `_openCellPanel`：那个出口还被别处用（面板内跳转、程序化打开），
   * 那些地方不该让小人跑一趟。只有**玩家点地图**这条路径才走这里。
   * ============================================================ */
  function _openAndWalk(ci) {
    M._openWalkCi = ci;                      /* 可观测标记（探针/调试：证明"点图"确实走了这条路） */
    M._openWalkErr = null;
    try { if (M && M.walkTo) M.walkTo(ci); } catch (eW) { M._openWalkErr = String((eW && eW.message) || eW); }
    return _openCellPanel(ci);
  }
  /* 那一格**原来的**面板分派（v156.15 从 pickAt 里原样抽出）。
     ⚠️ 分支顺序是 v92 定的语义，一个字别动：
       己方城 → 名城 → 行政城 → 据点 → **营地**（人）→ **村社**（关系）→ **遗迹**（死物）→ 野地兜底。 */
  function _openCellPanel(ci) {
    var ui = GAME.ui;
    if (!ui) return;
    var M = GAME.map3d || {};
    var cell = (M._collider && M._collider.cells) ? M._collider.cells[ci] : null;
    var kind = (M.cellKind && M.cellKind[ci]) || 'wild';
    var reg = M.regionAt ? M.regionAt(ci) : null;
    var ref = M.cellRef && M.cellRef[ci];
    /* ⛔ v158.43（老板「不要再弹出这个了『未探明地块』」）：v158.38 的
       未探明一级详情面板（ui.openFogModalCi）整条退役 —— 按诉求 2 拍板口径
       「常规点击地面无响应」，雾格点击不弹任何面板。E 键已由 nearestInteractable
       过滤雾格、walkTo 到达不开面板，此分支无调用者，随面板一起撤。
       雾格守卫：任何残留路径（面板内跳转等）点到未探明格也静默返回，
       不落进 kind 分派弹野地面板。 */
    try {
      if (GAME.fog && GAME.fog.get && GAME.fog.get(ci) === 0) return;
    } catch (eFg43) { }
    if (kind === 'own' && ref && ui.openCityPanel) ui.openCityPanel(ref);
    /* v158.41（老板「总是分层，不要立即出征」）：名城/行政城（敌方城）不再直跳 ⚔️出征界面，
       改走 openCityPanel（🏙 看城详情 + 底部侦查/掠夺/占领按钮），与己方城、野地统一分层。 */
    else if (kind === 'npc' && ref && ui.openCityPanel) ui.openCityPanel(ref);
    else if (kind === 'adm' && ref && ui.openCityPanel) ui.openCityPanel(ref);
    else if (kind === 'fort' && GAME.map.fortAt) {
      var ff = GAME.map.fortAt(ci, GAME.map._pctx(GAME.mapPlanetOf ? GAME.mapPlanetOf().id : null));
      if (ff && ui.openFortModal) ui.openFortModal(ff);
      else if (ui.openLandModalCi) { GAME.map._terrOverride = cell ? cell.type : null; GAME.map._regionOverride = reg; ui.openLandModalCi(ci); }
    }
    else if (GAME.camp && GAME.camp.isFound(ci) && ui.openCampModal) ui.openCampModal(ci);
    else if (GAME.village && GAME.village.at && GAME.village.at(ci) && GAME.village.isKnown(ci) && ui.openVillageModal) ui.openVillageModal(ci);
    /* ⛔ v158.25：`ui.openRuinModal` 随遗迹系统退役。 */
    else if (ui.openLandModalCi) {
      GAME.map._terrOverride = cell ? cell.type : null;
      GAME.map._regionOverride = reg;
      ui.openLandModalCi(ci);
    }
    /* v158.6（P5-b 任务链）：打开过任一面板 = "环顾四周"这一格看过。
       观察钩子只登记、不拦截、不改面板内容（见 js/quest.js onLook）。 */
    if (GAME.questline && GAME.questline.onLook) GAME.questline.onLook();
  }
  /* ---- 纯数学实现（**不依赖 THREE**）----
     为什么不用 THREE.Vector3/Quaternion：map3d 在没有 three 的环境（node 门禁、
     首屏未加载）会走"enabled:false · why:no-three"降级分支，**根本注册不到出口**，
     于是这条坐标系不变量在门禁里永远测不到。改成纯数组运算后，
     数学本身可以在 node 里直接验，浏览器端再包成 THREE 四元数用。 */
  function _hyp(a, b, c) { return Math.sqrt(a * a + b * b + c * c); }
  function _cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function _qmul(a, b) {                     /* 四元数 x,y,z,w 相乘（a 先不作用，b 先作用） */
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
    ];
  }
  /* 把 +Y 对到 dir（基座 ⟂ 半径），再绕**自身竖轴**转 yawDeg 度。返回 [x,y,z,w]。
     v156.25：`seatProp()` 是同一件事的另一种写法（setFromUnitVectors + rotateY），
       两者实测完全等价 —— 改这里时请一并看那处的注释（判据：转身只绕局部轴）。 */
  function surfaceQuad(dir, yawDeg) {
    var x = dir[0], y = dir[1], z = dir[2];
    var L = _hyp(x, y, z) || 1; x /= L; y /= L; z /= L;
    var d = y;                                /* dot((0,1,0), n) */
    var q;
    if (d > -0.999999) {
      /* axis = cross((0,1,0), n) = (z, 0, -x)；w = 1 + dot */
      q = [z, 0, -x, 1 + d];
    } else {
      q = [1, 0, 0, 0];                       /* n ≈ −Y：绕 X 转 180° */
    }
    var ql = _hyp(q[0], q[1], q[2]) || Math.abs(q[3]) || 1;
    var qn = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]) || 1;
    q = [q[0] / qn, q[1] / qn, q[2] / qn, q[3] / qn];
    if (yawDeg) {
      var a = yawDeg * Math.PI / 360;         /* 半角 */
      /* 右乘绕**局部** Y —— 与"先自转再对齐"同序；
         若改成绕世界法线右乘，就是把上轴先掰歪再拉平（v156.19 城堡歪掉的根因） */
      q = _qmul(q, [0, Math.sin(a), 0, Math.cos(a)]);
    }
    return q;
  }
  /* 球面正交基（右手）：up = 半径，east = 东（世界口径 = −Z），south = 南。返回数组。 */
  function surfaceFrame(dir) {
    var L = _hyp(dir[0], dir[1], dir[2]) || 1;
    var n = [dir[0] / L, dir[1] / L, dir[2] / L];
    var dN = n[1];
    var north = [-n[0] * dN, 1 - n[1] * dN, -n[2] * dN];
    var nl = _hyp(north[0], north[1], north[2]);
    if (nl < 1e-8) { north = [1 - n[0] * n[0], -n[0] * n[1], -n[0] * n[2]]; nl = _hyp(north[0], north[1], north[2]) || 1; }
    north = [north[0] / nl, north[1] / nl, north[2] / nl];
    var east = _cross(north, n);
    var south = _cross(east, n);
    return { up: n, east: east, south: south };
  }
  /* v158.0（P0）：行走用的**连续**切平面基。
     ⚠️ 不能直接复用 surfaceFrame：它的 north 在极点用 [1,0,0] 兜底，而
        dir=[ε,1,0] 时连续极限是 [−1,0,0] —— 跨极点那一格 east/south 会瞬间反向，
        表现为"角色在极点来回抖、相机瞬间贴脸"。surfaceQuad 是 shortest-arc
        四元数，除南极外处处连续，这里把局部 +X/+Z 旋到切平面当 east/south。 */
  function avatarBasis(dir) {
    var q = surfaceQuad(dir, 0);
    function rot(v) {
      var u0 = q[0], u1 = q[1], u2 = q[2], w = q[3];
      var cx = u1 * v[2] - u2 * v[1], cy = u2 * v[0] - u0 * v[2], cz = u0 * v[1] - u1 * v[0];
      var dx = u1 * cz - u2 * cy, dy = u2 * cx - u0 * cz, dz = u0 * cy - u1 * cx;
      return [v[0] + 2 * (w * cx + dx), v[1] + 2 * (w * cy + dy), v[2] + 2 * (w * cz + dz)];
    }
    var L = _hyp(dir[0], dir[1], dir[2]) || 1;
    return { up: [dir[0] / L, dir[1] / L, dir[2] / L], east: rot([1, 0, 0]), south: rot([0, 0, 1]) };
  }

  /* 把纯数组四元数灌进一个 THREE.Quaternion（浏览器路径专用；函数体里才碰 THREE） */
  function applyQuad(qt, dir, yawDeg) {
    var q = surfaceQuad(dir, yawDeg);
    qt.set(q[0], q[1], q[2], q[3]);
    return qt;
  }
  /* ============================================================
   * v157.54（老板「近地面左键长按拖动画面剧烈跳动 · 绝对稳定 · 最保守方法」）
   * ------------------------------------------------------------
   * 两个**不依赖 THREE** 的纯数学出口，故意放在无 THREE 守卫之前：
   * jsdom 下本文件整块 return，若把「按下冻结 / 每帧算位移」留在守卫之后，
   * smoke 就只能 grep 源码（等于没测 —— v156.15 的教训）。
   *
   * 病根（.workbuddy/tools/probe/probe_v15754_pan_stability.js 实测）：
   *   v157.24 的「锚点抓取」每帧从**当前相机**重新拾取地面命中点，
   *   T = 按下锚点 − 当前命中点 → 相机 += T，**输入依赖自己的输出**。
   *   贴地平视时俯角 θ→0，纵向每像素地面位移按 1/sin²θ 放大
   *   （42°→2° 实测 367.607 倍；手抖 3px = 5.025 米 = 2.956 倍眼高）；
   *   单帧实测可达 7.883 米（4.637 倍眼高）、90 帧内方向反转 25 次。
   *   再叠加它写 camO.dist 却没同步 _zoomTarget，placeCamera 每帧回拉半径
   *   —— 方向已变、半径被拽回，整屏地面与标记一起跳。
   *
   * 修法 = 拖拽平移的行业标准（OrbitControls / Google Earth）：
   *   按下时一次算定每像素地面位移并**冻结**；之后每帧只读鼠标增量。
   *   不改视线 _surfDir / 契约向量 _surfRight，不写 camO.dist，不动玩法语义。
   * ============================================================ */
  function _panProj(v, r) {                 /* 去掉径向分量，只留切平面 */
    var d = v.x * r.x + v.y * r.y + v.z * r.z;
    return { x: v.x - d * r.x, y: v.y - d * r.y, z: v.z - d * r.z };
  }
  function _panClamp(v, cap) {              /* 收口到 cap 米以内；退化/坏值返回 null */
    var L = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (!isFinite(L) || L < 1e-9 || !isFinite(cap) || cap <= 0) return null;
    if (L > cap * 50) return null;         /* 明显不是"相邻一像素"，交给兜底方向 */
    var s = L > cap ? cap / L : 1;
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }
  /* ① 按下时冻结基准。pa=(x,y) 命中点、pb=(x+1,y)、pc=(x,y+1)；
     返回 { ex, ey, maxStep, dist, ok }。ex/ey 是「鼠标右移/下移一像素时地面点的
     切平面位移」，符号由实测给出，不需猜 fov、视口或俯角公式（拾取出口即唯一口径）。
     opts: cap 每像素上限 · fallback 打空时的兜底尺度 · fx/fy 兜底方向 ·
           maxStep 单帧上限 · dist 按下时的相机半径（全程冻结）。 */
  function panBasisOf(pa, pb, pc, radial, opts) {
    var o = opts || {}, r = radial || { x: 0, y: 1, z: 0 };
    var cap = (isFinite(o.cap) && o.cap > 0) ? o.cap : 0.255;
    var fb = (isFinite(o.fallback) && o.fallback > 0) ? o.fallback : cap * 0.5;
    function pick(p, q, f) {
      if (p && q) {
        var c = _panClamp(_panProj({ x: q.x - p.x, y: q.y - p.y, z: q.z - p.z }, r), cap);
        if (c) return c;
      }
      /* 拾取打空或异常：沿兜底方向给一个保守小尺度，保证这一轴仍能拖 */
      var d = _panProj(f || { x: 1, y: 0, z: 0 }, r);
      var dl = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      if (!isFinite(dl) || dl < 1e-9) return { x: 0, y: 0, z: 0 };
      return { x: d.x / dl * fb, y: d.y / dl * fb, z: d.z / dl * fb };
    }
    var ex = pick(pa, pb, o.fx), ey = pick(pa, pc, o.fy);
    var ok = (Math.sqrt(ex.x * ex.x + ex.y * ex.y + ex.z * ex.z) > 1e-9 ||
              Math.sqrt(ey.x * ey.x + ey.y * ey.y + ey.z * ey.z) > 1e-9);
    return {
      ex: ex, ey: ey, cap: cap,
      maxStep: (isFinite(o.maxStep) && o.maxStep > 0) ? o.maxStep : 0.85,
      dist: o.dist, ok: ok
    };
  }
  /* ② 每帧位移：只读鼠标增量与冻结基准，**不读相机**（回路已断）。
     单帧按 maxStep 限幅；非有限输入/输出一律返回 ok:false（跳过本帧，绝不写状态）。
     返回值不含任何半径或相机量 —— 拖拽对滚轮阻尼零干扰。 */
  function panStepOf(dx, dy, b) {
    var none = { x: 0, y: 0, z: 0, len: 0, ok: false };
    if (!b || !isFinite(dx) || !isFinite(dy)) return none;
    var ex = b.ex || none, ey = b.ey || none;
    var x = -(dx * ex.x + dy * ey.x);
    var y = -(dx * ex.y + dy * ey.y);
    var z = -(dx * ex.z + dy * ey.z);
    var L = Math.sqrt(x * x + y * y + z * z);
    if (!isFinite(L) || L < 1e-9) return none;
    var mx = (isFinite(b.maxStep) && b.maxStep > 0) ? b.maxStep : 0.85;
    if (L > mx) { var s = mx / L; x *= s; y *= s; z *= s; L = mx; }
    return { x: x, y: y, z: z, len: L, ok: true };
  }
  if (typeof THREE === 'undefined') {
    /* 无 THREE（jsdom）：只留这几个纯数据出口 —— smoke 靠它们验"这一格是什么" */
    GAME.map3d = { enabled: false, why: 'no-three',
      openCellPanel: _openCellPanel, cellBrief: _cellBrief,
      townScaleOf: _townScaleOf,
      /* v156.19：球面坐标系的纯数学出口（无 three 也要能验） */
      surfaceQuad: surfaceQuad, surfaceFrame: surfaceFrame,
      /* v158.2（P2）：街区几何挂到同一个 scene 的唯一出口（无 THREE 时返回 null） */
      _scene: function () { return (typeof scene !== 'undefined') ? scene : null; },
      /* v158.1（P1）：行走/交互共用的连续切平面基 —— 探针与游戏必须同口径 */
      avatarBasis: avatarBasis,
      /* v157.54：拖拽平移的两个纯数学出口（无 three 也要能真调，见上方注释） */
      panBasisOf: panBasisOf, panStepOf: panStepOf };
    return;
  }
  var SP = GAME.mapSphere;                         /* v90.97（双球面）：地图渲染走**地图球面**（与逻辑球面 GAME.sphere 解耦）*/
  var M = GAME.map3d = { enabled: true,
    openCellPanel: _openCellPanel, cellBrief: _cellBrief,
    townScaleOf: _townScaleOf,
    surfaceQuad: surfaceQuad, surfaceFrame: surfaceFrame,
    _scene: function () { return scene; },
    avatarBasis: avatarBasis,
    panBasisOf: panBasisOf, panStepOf: panStepOf };

  var R = (SP && SP.R) || 300;                    /* 星球海平面半径 */
  var HSC = (SP && SP.HSC) || 26;                 /* 高度 → 世界单位（山≈40 · 陆地≈5）*/
  /* ============================================================
   * v92.240j（老板：「云层不切割，已探明的地块更亮即可」）
   * ------------------------------------------------------------
   * 上一版（v92.240i）把厚云做成**按格拼六边形、已探明格不进网格** —— 那就是"切割"：
   * 云是一块块被挖掉洞的马赛克，洞口边缘随格子走向锯齿，远看像破洞的纱网。
   * 现在改口径：**云层不切割** —— 一整层连续球壳（buildSkyClouds 的 M._sky）
   * 罩住全星，探明度**不再决定有没有云**；
   * 已探明与否仍由**地表亮度**表达（v92.240j 口径，注意：v157.76 起地表亮度
   *   **不再参与迷雾**——顶点色压暗已退役，见下方墓碑）；
   *   探明范围自此只由**地块线框**标识（已探明冷蓝 / 未探明隐形），
   *   且不再按格铺贴地加亮六边形（会在视野内造碎斑）。
   *
   * 大气层基准高度（海平面之上，世界单位）。取 **55** 的依据：
   *   · 最高峰 ≈ 40 —— 云顶必须整体高于它，否则山会穿破云壳、读起来是"地面上的斑块"；
   *   · 再高（如 90）会让斜视角下整层云幕把地表压得过暗（历史教训：lift 14 时已被截图确认）。
   * ============================================================ */
  /* v92.241：大气高度/浓度**不再写死** —— 由 planetgen 依据星球特征（半径/山脉强度/
     大气密度/云量）派生后写进 SP.ATM_H / SP.ATM_A。此处改为**调用时解引用**，
     否则换星球（参数变了）后仍是旧值。缺省 55 / 0.30 与改前观感一致。 */
  function atmH() { return (SP && SP.ATM_H) || 55; }
  function atmA() { return (SP && SP.ATM_A != null) ? SP.ATM_A : 0.30; }
  /* 换星球/改大气参数后重建云壳。v92.246：原处还留着 `_atmoVer` 与只读的 `M.atmoVer`，
     但那两个**全仓没有任何读者**（复核抓到的死出口）—— 一并删掉，只留这一个真出口。 */
  M.invalidateAtmo = function () { if (M.buildSkyClouds) M.buildSkyClouds(); };
  /* v155g（性能）：200 → 128。
     实测（软件光栅）单地形球就吃 ~300ms/帧：6 面 × 201² ≈ 73.6 万顶点。
     128 → 6 面 × 129² ≈ 30 万顶点（-60%），远看几乎无差别（贴图/顶点色承担细节）。*/
  var K = 128;                   /* cube-sphere 每面细分 */
  /* 地块细分（固定）：icosphere 顶点数 = 10×4^6+2 = **40962 个地块** —— SSOT 在 sphere.js。*/
  var TILE_SUB = (SP && SP.sub) || 6;
  /* v90.97（双球面）：球面内核别名**调用时解引用 SP** —— 地图切星球后地形/噪声须随地图球面走；
     若像旧版冻结 `SP.sphElev` 的绑定，切球后地形色/高仍按**逻辑球面**算（双球面错配）。
     地形/噪声一律走 sphere.js，别在此重算。*/
  var sphElev = function (d) { return SP.sphElev(d); };
  var seed3 = function () { return SP.seed3(); };
  var nearestCell = function (d) { return SP.nearestCell(d); };
  var h3 = function () { return SP.h3.apply(SP, arguments); };
  var n3 = function () { return SP.n3.apply(SP, arguments); };
  var fbm3 = function () { return SP.fbm3.apply(SP, arguments); };
  var TYPE_NAME = SP.TYPE_NAME;                   /* 地形名表（各星球一致，静态即可）*/

  /* ============================================================
   * v157.15：**地面高度唯一出口**（自然地形 ∪ 玩家整平台面）
   * ------------------------------------------------------------
   * 整平后"地面"不再是 sphElev 一个函数能回答的：
   *   已整平的格 → 层号 × 层高（水平台面）；
   *   其余        → 自然地形。
   * 地表层所有"贴地"的几何（地形网格 / 地砖 / 景物 / 方格 / 高亮 / 拾取 / 相机基线）
   * 必须**统一走这里**，否则会出现"砖抬上去了、相机还埋在原来的坡里"这类错位。
   *
   * 性能：没有整平数据时（绝大多数存档 / 老档）直接返回自然高度，
   *   一次 hasOwnProperty 都不做 —— 现有画面与开销零变化。
   * ============================================================ */
  function _terrMapOf() {
    var s = (typeof GAME !== 'undefined' && GAME.state) ? GAME.state : null;
    var m = s && s.terrain;
    return (m && typeof m === 'object') ? m : null;
  }
  function _terrAny() {
    var m = _terrMapOf();
    if (!m) return false;
    for (var k in m) if (m.hasOwnProperty(k)) return true;
    return false;
  }
  /* 层号 → **归一化高度**（与 sphElev 同口径）。
     ⚠️ 这里踩过一次单位坑：sphElev 返回的是归一化高度，渲染处再 × HSC(26) 变世界单位。
        直接把"米"当归一化用，8 层会抬 208 世界单位（比最高的山还高 5 倍）。 */
  function _lvToElev(lv) {
    return (lv || 0) * (GAME.TERRACE_H || 1.0) / (HSC || 26);
  }
  /* 方向 → 该处台面高度（归一化）；未整平返回 null */
  /* ============================================================
   * v157.26：高度查询的**键**从六边形 ci 换成方格 (i,j)
   * ------------------------------------------------------------
   * 这是"整平按方格走"的关键一步：地形层、地砖、放置全部调这一个函数，
   * 换了键之后，台面边界自然变成方格边界（1.4 米采样切出的锯齿 < 半格）。
   * `gridCellOf` 依赖切平面锚；锚还没建（没进过地表）时返回 null → 走自然地形。
   * ============================================================ */
  function _terrLevelHAt(d) {
    var m = _terrMapOf();
    if (!m) return null;
    var g = null;
    try { g = M.gridCellOf(d); } catch (e) { return null; }
    if (!g) return null;
    var lv = m[g.i + ',' + g.j];
    return (lv == null) ? null : _lvToElev(lv);
  }
  /* 方向 → 地面高度（**归一化**，与 sphElev 同口径）。**地表层唯一入口** */
  function groundHAt(d) {
    var th = _terrLevelHAt(d);
    if (th != null) return Math.max(0, th);
    var e = 0;
    try { e = sphElev(d); } catch (eX) { e = 0; }
    return Math.max(0, e) || 0;
  }
  M.groundHAt = groundHAt;                 /* 探针 / 交互用 */
  M.terrAny = _terrAny;

  /* 按**方格编号**直接查台面高度（渲染循环里逐格用，不做坐标换算） */
  function _terrHOfIJ(i, j) {
    var m = _terrMapOf();
    if (!m) return null;
    var lv = m[(i | 0) + ',' + (j | 0)];
    return (lv == null) ? null : _lvToElev(lv);
  }
  /* 自然地形高度（归一化）—— 给数据层算"无记录时的基准层"用 */
  M.elevNatAt = function (d) {
    try { return sphElev(d); } catch (e) { return 0; }
  };
  /* 第 t 条边外侧的邻居格号。
     边的中点方向正好落在两格交界上，nearestCell 会摇摆 —— 所以从**格心**
     沿"格心→边中点"再延伸 1.5 倍（越过边界 50%），稳稳落进邻格里。 */


  /* ============================================================
   * v154：地形配色**按类型**（与 GAME.sphere.cellType 同一把尺）
   * ------------------------------------------------------------
   * 老板：「黄黄的一看以为是荒漠，结果一点是森林……绿绿的以为是草原，结果一点是沼泽」。
   * 病根是上色走高度色带、分类走另一套阈值。现在颜色只由**类型**决定基色，
   * 再叠一点同类型内部的明暗（同一种地也有深浅，但绝不会串色）。
   * 同类型相邻格颜色接近 → 成片；类型交界处颜色断开 → 边界自然出现（不需要再画线）。
   * ============================================================ */
  /* ============================================================
   * v155e（老板：「云量太少了」）—— 一层**全星高空云**（原 r = R*1.015，v92.240i 起抬到 R + ATM_H）
   * ------------------------------------------------------------
   * 与"已探明/未探明"无关：这层是**天候**，全星都有、不遮操作、不影响判定，
   * 只让画面"天上有云"。两层不同速度的 fbm → 云团缓慢漂移。
   * v92.240j：这一层**就是完整大气层**（此前还有第二层按格切割的厚云，已删）。
   * ============================================================ */
  function buildSkyClouds() {
    if (typeof THREE === 'undefined' || !scene) return;
    if (M._sky) { scene.remove(M._sky); if (M._sky.geometry) M._sky.geometry.dispose(); M._sky = null; }
    /* v92.240i：整球云壳从 R*1.015（=R+4.5，**比山峰还低**，山会穿破它、读起来像"地面斑块"）
       抬到大气层基准高度 R + ATM_H —— 这才是一层罩住整颗星球的**完整大气层**。 */
    var g = new THREE.SphereGeometry(R + atmH(), 128, 84);
    var mat = new THREE.ShaderMaterial({
      /* v157.73：`uIn` = 「相机正在云层里」的浓度（钟形，见下方每帧更新）。
         只给壳加浓用 —— 球壳在壳面上必然透明（`edge` 归零），单靠它做不出穿越感，
         真正的穿越感来自云片掠过 + 背景压白，这里只是让"云墙扑过来"更实。
         v157.84：`uClean` = 近景云纹抑制（0 = 只有均匀薄雾，1 = 全云）。
         为什么需要：壳的 alpha 在**球面正面**最强（rim≈1 → edge=1、cloudMask=1），
         所以从 100~200 米俯瞰时，头顶那层 fbm 云正好盖在海面上 —— 就是老板截图里
         那片"雾状色斑"。高空看整球时云是观感加分，贴近看地面时云就是脏。
         口径：agl 120→380 米线性 0→1（远景满云，中近景只剩 8% 均匀底雾）。 */
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uIn: { value: 0 }, uClean: { value: 1 } },
      vertexShader: [
        'varying vec3 vP;',
        'varying vec3 vN;',
        'varying vec3 vW;',
        'void main(){',
        '  vP = position;',
        '  vN = normalize(mat3(modelMatrix) * normal);',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  vW = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime; uniform float uFade; uniform float uIn; uniform float uClean;',
        'varying vec3 vP; varying vec3 vN; varying vec3 vW;',
        'float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }',
        'float n31(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);',
        '  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),',
        '             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }',
        'float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*n31(p); p*=2.07; a*=0.5; } return v; }',
        'void main(){',
        '  vec3 d = normalize(vP);',
        '  float c1 = fbm(d * 5.5 + vec3(uTime * 0.008, 0.0, uTime * 0.005));',
        '  float c2 = fbm(d * 12.0 - vec3(uTime * 0.014, 0.0, -uTime * 0.010));',
        '  float dens = smoothstep(0.40, 0.70, c1 * 0.72 + c2 * 0.28);',
        /* v92.240j：这一层就是**完整大气层本身**（不再有第二层按格切割的厚云）。
           0.13 太薄（老板此前说"看着像纯球体/云太少了"），0.52 太厚（整球糊白）——
           取 0.30：整星罩一层看得见的大气，底下的地表明暗仍然透得出来。
           探明度**不再**参与这一层（不切割），只影响地表加亮（见 buildFog）。 */
        /* v92.241：浓度由星球参数派生（SP.ATM_A）—— 大气密度/云量大的星球更浓。
           ⚠️ v157m：这里原来还有一行 `float a = dens * ...`，与下方 v156.34 的
           `float a = (...) * edge * ...` **同名重定义** → 整个 fragment 编译失败，
           大气层从 v156.34 起就没渲染出来（浏览器只报 "a : redefinition"）。
           浓度统一在下方那一段算，这里只留注释，别再写第二遍。 */
        /* ============================================================
         * v156.34（老板 2026-11-02「星球自转过程中半径闪烁」）
         * ------------------------------------------------------------
         * 现象：球体外那圈大气雾的**外边界**在自转时忽薄忽厚地跳
         * （实测同一方向的最外亮像素半径 std 高达 31px，均值 377 → 428）。
         *
         * 病根不在"噪声随时间漂移"（uTime 每秒只走 0.008，八帧内几乎不动），
         * 而在**图案与边界的耦合**：这层壳的 alpha 完全由 fbm(d) 决定，
         * 而 d 固定在星球上 —— 自转时噪声图案从轮廓线上扫进扫出，
         * 于是"哪一像素还算大气"这件事每一帧都换答案。
         *
         * 修法分两层（缺一不可）：
         *   ① `edge`  —— **确定性**的边缘淡出（只跟视线夹角有关，不碰噪声）。
         *      轮廓处恒为 0，所以边界位置固定 → 自转不再改变外轮廓。
         *   ② `cloudMask` —— 把噪声**赶出边缘区**：rim < 0.30 时云图案不参与，
         *      只留 0.08 的均匀底雾。噪声再扫，也扫不到决定边界的那一段。
         * 观感上是"大气在正面厚、越往边越薄"，本来也是这么回事。
         * ============================================================ */
        '  float rim = clamp(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0, 1.0);',
        '  float edge = smoothstep(0.0, 0.45, rim);',
        '  float cloudMask = smoothstep(0.30, 0.85, rim);',
        /* v157.73：`* (1 + uIn*1.35)` —— 跨层瞬间把壳整体加浓，配合云片形成"云墙"；
           clamp 到 1，避免两层叠加后过曝成纯白块。 */
        /* v157.84：云纹乘 `uClean` —— 近景（agl<380）逐渐去掉成团的云，
           只留 0.08 的均匀底雾。0.92 的云权重与 0.08 的底雾是**两项**，别合并。 */
        '  float dens2 = dens * uClean;',
        '  float a = (dens2 * cloudMask * 0.92 + 0.08) * edge * ' + atmA().toFixed(3) + ' * uFade * (1.0 + uIn * 1.35);',
        '  if (a > 1.0) a = 1.0;',
        '  vec3 col = mix(vec3(0.76, 0.80, 0.87), vec3(0.98, 0.99, 1.0), dens2);',
        '  gl_FragColor = vec4(col, a);',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, side: THREE.FrontSide
    });
    M._sky = new THREE.Mesh(g, mat);
    M._sky.renderOrder = 22;
    M._skyMat = mat;
    scene.add(M._sky);

    /* ============================================================
     * v157.73（老板「如何做到拉近距离时穿越云层的感觉」）
     * ------------------------------------------------------------
     * 为什么不能只靠上面那层球壳：相机**穿过壳面**时，`edge = smoothstep(0, 0.45, rim)`
     * 必然归零（v156.34 为修自转闪烁定下的"轮廓处淡出"），那一刻壳是透明的 ——
     * 穿过去只会"少一层半透明"，不会有任何被云裹住的感觉。
     *
     * 所以补一层**云片**（Sprite）：铺在 R + ATM_H 上下约 ±0.6×ATM_H 的带子里，
     * 相机拉近穿层时，它们从镜头前一片片掠过 —— 这才是"在云里"的来源。
     *   · 固定在球面上（不跟相机走）：相机平移/缩放时才有透视掠过感；
     *   · 高度分 5 档错开：穿层是"一层一层"，不是同高一片；
     *   · 44 片、单片直径 ≈ R*0.09，unlit + depthWrite:false，成本与一片草相当；
     *   · 不参与任何判定、不遮操作，纯观感（与 v157.68「视野内不加渲染」不冲突：
     *     那些限制针对**地表探明度**那套几何，云在天上，且只在穿层的几秒里浓）。
     * ============================================================ */
    if (M._puffs) {
      scene.remove(M._puffs);
      M._puffs.traverse(function (o) {
        if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      });
      M._puffs = null;
    }
    (function buildPuffs() {
      var grp = new THREE.Group();
      var tex = (function () {
        var S = 128, cv2 = document.createElement('canvas');
        cv2.width = S; cv2.height = S;
        var g2 = cv2.getContext('2d');
        /* 三团偏移的柔和斑叠成不规则云块 —— 单个径向渐变更像"雾球"，不像云 */
        function blob(cx, cy, rr, aa) {
          var gr = g2.createRadialGradient(cx, cy, 0, cx, cy, rr);
          gr.addColorStop(0, 'rgba(255,255,255,' + aa.toFixed(3) + ')');
          gr.addColorStop(0.55, 'rgba(248,250,253,' + (aa * 0.45).toFixed(3) + ')');
          gr.addColorStop(1, 'rgba(244,248,252,0)');
          g2.fillStyle = gr;
          g2.beginPath(); g2.arc(cx, cy, rr, 0, Math.PI * 2); g2.fill();
        }
        blob(S * 0.50, S * 0.52, S * 0.44, 0.85);
        blob(S * 0.29, S * 0.41, S * 0.29, 0.52);
        blob(S * 0.71, S * 0.57, S * 0.27, 0.48);
        var t = new THREE.CanvasTexture(cv2);
        t.minFilter = THREE.LinearFilter;      /* 云片近看就糊，不需要 mipmap */
        t.generateMipmaps = false;
        if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })();
      var hC = atmH(), N = 44, gold = 2.399963;   /* 黄金角 → 球面均匀撒点 */
      for (var i2 = 0; i2 < N; i2++) {
        var y2 = 1 - (i2 + 0.5) / N * 2;
        var rr2 = Math.sqrt(Math.max(0, 1 - y2 * y2));
        var th2 = i2 * gold;
        var dir2 = [Math.cos(th2) * rr2, y2, Math.sin(th2) * rr2];
        /* 5 档高度错开：±0.48×hC 为主，另加 ±0.12×hC 的微扰 */
        var rad2 = R + hC + (i2 % 5 - 2) * hC * 0.24 + (i2 % 3 - 1) * hC * 0.08;
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, transparent: true, depthWrite: false, depthTest: true, opacity: 0
        }));
        sp.position.set(dir2[0] * rad2, dir2[1] * rad2, dir2[2] * rad2);
        var sc = R * (0.085 + (i2 % 7) * 0.007);
        sp.scale.set(sc, sc * 0.62, 1);        /* 压扁：云层是横着摊的，不是圆球 */
        sp.renderOrder = 21;
        grp.add(sp);
      }
      M._puffs = grp;
      scene.add(grp);
    })();
  }
  M.buildSkyClouds = buildSkyClouds;

  /* v157.71（老板「地图上各种地块颜色，根本分不清是什么」）：
   * 这里**不再另写一份**地形色。唯一来源 = DATA.TERRAIN[t].color，
   * 七色已在 data.js 按 v45 老板拍板的「色相拉开 / 明度分档 / 饱和度兜底」重排。
   * 旧本地字面量的病根：plain/desert 32.1、zhaoze/forest 亮度差 3.2，
   * 又与 2D TERRAIN_TINT、面板 DATA.TERRAIN.color 三套口径互不一致。
   * bundle 顺序 core → war → ui，data.js 在 core，此处 GAME.DATA.TERRAIN 已就绪；
   * 单模块加载 / 测试桩缺 DATA 时只兜一个 plain，正常路径永远走派生。 */
  var TERRAIN_RGB = (function () {
    var D = (GAME.DATA && GAME.DATA.TERRAIN) || {}, out = {};
    Object.keys(D).forEach(function (k) {
      var h = D[k] && D[k].color;
      if (typeof h !== 'string' || h.length !== 7 || h.charAt(0) !== '#') return;
      out[k] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    });
    if (!out.plain) out.plain = [170, 214, 186];
    return out;
  })();
  M.terrainRGB = TERRAIN_RGB;

  /* ============================================================
   * v155c（老板：「颜色有点死板，对比也差，稍微精细一点」）
   * ------------------------------------------------------------
   * 改前：一个类型一个纯色 → 整片同色（死板），类型交界是硬切（对比突兀）。
   * 现在每个格子算颜色时叠四层，**只调明暗/微色相，不换类型色**：
   *   ① 海拔明暗   —— 谷地压暗、高处提亮（山体起伏看得出来）
   *   ② 坡度阴影   —— 陡坡压暗（侵蚀感，像打了侧光）
   *   ③ 气候微调   —— 热偏暖、冷偏青、湿偏绿、干偏黄（同一类型也有区域差异）
   *   ④ 邻域平滑   —— 与相邻格平均两步（类型交界自然过渡，不再是拼贴）
   * 最后再叠一点高频颗粒（近看不糊）。
   * ============================================================ */
  var _cellCol = null, _cellColVer = '';
  /* v157.86：`_cellColorSoft` 每次调用顺手写出这三个值（顶点→格映射），
     buildGlobe 循环读取后存成 `M._globeVtxCell`，供已探索提亮使用。 */
  var _lastSoft = { ci0: -1, ci1: -1, t: 0 };
  function buildCellColors() {
    var SPn = GAME.sphere;
    if (!SPn || !SPn.cells) return;
    var ver = (SPn.seed3 ? SPn.seed3() : 0) + '|' + SPn.cells.length + '|' + (SPn._emax || 0);
    if (_cellCol && _cellColVer === ver) return;
    var n = SPn.cells.length, T = SPn._terr || {};
    var alt = T.alt || null, sl = T.slope || null, heat = T.heat || null, wet = T.wet || null;
    var col = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var c = SPn.cells[i]; if (!c) continue;
      var base = TERRAIN_RGB[c.type] || TERRAIN_RGB.plain;
      var r = base[0], g = base[1], b = base[2];
      /* ① 海拔明暗：0.2 为基准，海拔每高 0.1 提亮 5%，低处压 4% */
      var a = alt ? alt[i] : 0.2;
      var kA = 1 + (a - 0.2) * 0.55;
      /* ② 坡度阴影：越陡越暗（最多 −22%） */
      var sv = sl ? sl[i] : 0;
      var kS = 1 - Math.min(0.22, sv * 0.38);
      var k = kA * kS;
      r *= k; g *= k; b *= k;
      /* ③ 气候微调（很小，但能让同类有层次） */
      if (heat) {
        var hh = heat[i] - 0.5;
        r += hh * 16; g += hh * 6; b -= hh * 10;
      }
      if (wet) {
        var ww = wet[i] - 0.5;
        g += ww * 10; b += ww * 4; r -= ww * 6;
      }
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
    }
    /* ④ 邻域平滑：两轮，每轮向邻居平均靠 35%（类型交界因此有过渡） */
    var adj = SPn.adj;
    if (adj) {
      for (var pass = 0; pass < 2; pass++) {
        var next = new Float32Array(col);
        for (var j = 0; j < n; j++) {
          var an = adj[j]; if (!an || !an.length) continue;
          var ar = 0, ag = 0, ab = 0, m = 0;
          for (var q = 0; q < an.length; q++) {
            var nb = an[q]; if (!SPn.cells[nb]) continue;
            ar += col[nb * 3]; ag += col[nb * 3 + 1]; ab += col[nb * 3 + 2]; m++;
          }
          if (!m) continue;
          var wgt = 0.35;
          next[j * 3] = col[j * 3] * (1 - wgt) + (ar / m) * wgt;
          next[j * 3 + 1] = col[j * 3 + 1] * (1 - wgt) + (ag / m) * wgt;
          next[j * 3 + 2] = col[j * 3 + 2] * (1 - wgt) + (ab / m) * wgt;
        }
        col = next;
      }
    }
    _cellCol = col; _cellColVer = ver;
  }
  M._buildCellColors = buildCellColors;
  M.cellColorOf = function (ci) {
    buildCellColors();
    if (!_cellCol || ci == null || ci < 0) return null;
    return [_cellCol[ci * 3], _cellCol[ci * 3 + 1], _cellCol[ci * 3 + 2]];
  };

  /* ============================================================
   * v157.75（老板「高空中看地块边界锯齿状，一种比较别扭的渲染方式」）
   * ------------------------------------------------------------
   * 病根：globe 顶点色是**每顶点硬取最近格**（`SP.nearestCell` → `cellColorOf`），
   * 于是每种地形都成了「一块块六边形硬边色块」—— 高空看就是拼贴 + 锯齿。
   * 改法：取最近格 c0 与**次近邻格** c1（必在 `SP.adj[ci0]` 里，六边形邻接，最多 6 次点积），
   * 按「谁更近」插值：格边界处两者等距 → t≈0.5（自然过渡），格心处 c0 独占 → t≈0。
   * ⚠️ 只给 globe 顶点用（`sphBiome` 的 soft 分支）；**地表近景仍走硬边** ——
   *    那里地块本来就是六边形拼的，糊了反而看不出「我站在哪一格」。
   * ============================================================ */
  function _cellColorSoft(d, ci0, dot0) {
    /* ⚠️ 不要在这里调 `M.cellColorOf()` —— 它每次都走一遍 `buildCellColors()`
       的版本缓存校验（拼三段字符串再比），99846 顶点 × 2 次会把首屏构建拖慢到
       出现「正在构建星球…100%」卡住。直接读已经建好的 `_cellCol` 数组。 */
    if (!_cellCol) { buildCellColors(); if (!_cellCol) return null; }
    var c0 = [_cellCol[ci0 * 3], _cellCol[ci0 * 3 + 1], _cellCol[ci0 * 3 + 2]];
    var adj = SP.adj && SP.adj[ci0];
    if (!adj || !adj.length) return c0;
    var best = -2, bj = -1;
    for (var i = 0; i < adj.length; i++) {
      var cc = SP.cells[adj[i]];
      if (!cc || !cc.dir) continue;
      var dt = cc.dir[0] * d[0] + cc.dir[1] * d[1] + cc.dir[2] * d[2];
      if (dt > best) { best = dt; bj = adj[i]; }
    }
    if (bj < 0) { _lastSoft.ci0 = ci0; _lastSoft.ci1 = -1; _lastSoft.t = 0; return c0; }
    var c1 = [_cellCol[bj * 3], _cellCol[bj * 3 + 1], _cellCol[bj * 3 + 2]];
    var a0 = Math.max(1e-6, 1 - dot0), a1 = Math.max(1e-6, 1 - best);
    var t = a0 / (a0 + a1);                     /* 格边界 ≈0.5 / 格心 ≈0 */
    /* v157.75b（实机教训）：`buildCellColors` 已经在**格级别**做过两轮 35% 邻域平滑，
       顶点级再混满 0.5 等于平滑两次 —— agl=110 整屏糊成一片、没有层次。
       限到 0.28：边界台阶软化一半，地块内部的明暗/纹理留住。 */
    t = Math.min(t, 0.5) * 0.56;
    /* v157.86：顺手把「顶点→最近格/次近格/混合权重」写出去 —— buildGlobe 用它
       做**已探索提亮**的顶点级软插值（不自算第二遍 nearestCell，零额外成本）。 */
    _lastSoft.ci0 = ci0; _lastSoft.ci1 = bj; _lastSoft.t = t;
    return [c0[0] + (c1[0] - c0[0]) * t,
            c0[1] + (c1[1] - c0[1]) * t,
            c0[2] + (c1[2] - c0[2]) * t];
  }

  /* v158.8：sphBiome 每次调用把「实际用到的最近格」写到这里，
     _surfTerrainGeo 读它回写增量缓存，避免未命中时重复 nearestCell。 */
  var _lastBiomeCi = -1;
  function sphBiome(e, dy, d, soft, ciHint) {
    var s = seed3(), P = SP.PLANET || {};
    var t = 'lake';
    /* v158.8：`ciHint` 是调用方提供的「上一顶点最近格」缓存命中值。
       命中时跳过 `SP.nearestCell` 全查（规则网格增量缓存的关键）。 */
    var ci = (ciHint != null && ciHint >= 0) ? ciHint
           : ((SP.nearestCell && d) ? SP.nearestCell(d) : -1);
    _lastBiomeCi = ci;
    try {
      if (ci >= 0 && SP.cells && SP.cells[ci] && SP.cells[ci].type) t = SP.cells[ci].type;
      /* v157.92d：**按高程纠正"水格却在水面之上"的配色**
         存在"类型标成 lake、高程却是正的"格子 —— 它们被涂成湖蓝、又高过水面，
         视觉上就是海里冒出一块浅蓝小岛（老板「海水露底」的残余）。*/
      /* ⚠️ 只改 t 不够：下面 `cc`（平滑格色）会覆盖它 —— 首版就栽在这，
         实机把水染红才看清"那块是水面的洞"。所以这里必须把 cc 一起清掉。*/
      if (t === 'lake' && e > 0.004) { t = 'plain'; cc = null; }
      else if (e >= 0) t = 'plain';
    } catch (eCt) { t = e < 0 ? 'lake' : 'plain'; }
    /* 用**平滑后的格色**（含海拔/坡度/气候/邻域过渡） */
    var cc = null;
    if (ci >= 0) {
      if (soft && d && SP.cells[ci] && SP.cells[ci].dir) {
        var _d0c = SP.cells[ci].dir;
        var _dot0 = _d0c[0] * d[0] + _d0c[1] * d[1] + _d0c[2] * d[2];
        cc = _cellColorSoft(d, ci, _dot0) || M.cellColorOf(ci);
      } else cc = M.cellColorOf(ci);
    }
    var m = cc ? [cc[0], cc[1], cc[2]] : (TERRAIN_RGB[t] || TERRAIN_RGB.plain).slice();
    /* 高频颗粒（近看木有塑料感；只调亮暗不改色） */
    if (d) {
      var hi = (fbm3(d, 52.0, s + 733) - 0.5);
      var k = 1 + hi * 0.10 * (P.detail == null ? 0.7 : P.detail);
      m = [m[0] * k, m[1] * k, m[2] * k];
    }
    if (t === 'lake') {
      var dep = Math.max(0, Math.min(1, -e / 0.35));
      m = [m[0] * (1 - dep * 0.30), m[1] * (1 - dep * 0.26), m[2] * (1 - dep * 0.18)];
    }
    return [Math.max(0, Math.min(255, Math.round(m[0]))), Math.max(0, Math.min(255, Math.round(m[1]))), Math.max(0, Math.min(255, Math.round(m[2])))];
  }

  var R3, scene, cam, globe, water, tiles, wcv, built = false, _tileSub = 0;
  var axisRoot = null;                                  /* v156.52：穿过球心的南北虚拟轴 */
  /* v156.47（老板「目前相机固定对准星球球心，要求自由相机」）——
     lookYaw / lookPitch 是**朝向相对球心的偏移**，默认 0 = 仍看球心。
     位置依旧受球壳约束（不钻地），自由的是**视线**：右键拖拽把视线偏出去，
     于是贴地时能看地平线、能抬头看天 —— 这是轨道相机做不到的。 */
  var camO = { yaw: 0.8, pitch: 0.42, dist: R * 2.9, lookYaw: 0, lookPitch: 0,
    quat: null, dir: null, _euler: null };   /* v156.54：quat = 相机朝向**唯一真相**（含 roll）；yaw/pitch/dir 都是派生值 */
  M.camO = camO;                                          /* 暴露以便脚本/调试设视角 */
  /* v90.98（老板）：**地图视野缩放**区间（与滚轮/缩放条同源）。
     dist = 相机到球心距离：越小越近 = 视野越小；越大越远 = 视野越大。 */
  /* ============================================================
   * v92.242（老板：「无支点，仅规定一个最大空间 —— 以星球中心为球心、
   *                 星球 50 倍半径为半径的自由空间」）
   * ------------------------------------------------------------
   * 相机可去的地方 = 以球心为中心、半径 **50R** 的球：
   *   内界 1.02R（不让相机钻进星球里面，钻进去只能看见内壁/黑），
   *   外界 50R（老板指定的最大空间）。
   * 距离从此**一律以球心为基准**（旧代码里总览按球心、贴地按格子，两套口径混用）。
   * ============================================================ */
  /* ============================================================
   * v156.47：内界从 R*1.02 抬到 R*1.15 —— **1.02 是钻进地形里**。
   * ------------------------------------------------------------
   * 原注释写「内界：贴着地表」，但地形本身有高度（起伏几十单位），
   * 相机在 R*1.02（离球心只多 6 单位）时已经在地壳内部：背面剔除后，
   * 屏幕上只剩省界细线和一片暗色 —— 实测截图确认（见 probe_freecam）。
   * 实测对照：1.05 = 全暗（在内部）/ 1.15 = 地表清晰、地平线可见 / 1.6 = 最佳低空视角。
   * 这个 bug 一直存在，但**只有在自由相机下才看得见**（轨道相机永远俯视，
   * 拉到最近也是从上方看，不会贴到地面）。
   * ============================================================ */
  /* ============================================================
   * v157e：**自转开关**（老板：「出一个按钮"自转"，点击开启或关闭自转」）
   * ------------------------------------------------------------
   * ⛔ v157.83 改默认（老板「球体不是跟着鼠标走，而是乱滚」的体感来源之一）：
   *   原来默认开，60 秒一圈 —— 玩家没点任何按钮，球就一直在慢慢漂；
   *   他刚看了一会儿再拖鼠标，第一帧还要"对上"自转后的角度。
   *   这与老板 v157.34 立的口径直接冲突：「位置与朝向都只由玩家改」。
   *   现在**默认静止**，想看自转点一下「🌏 自转」（按钮仍在，一键恢复）。
   * 关掉就是真的不动 —— 不再有"静止 10 秒它自己又转起来"那种猜不透的行为。
   * 地表模式下**永远不转**（见 _spinTick）：人站在地上，星球转 = 画面转。
   * ============================================================ */
  /* v157.101（老板 2026-11-22「我能接受。请实现我的意图」）——
     **轨迹球相机**：允许翻过极点、允许 roll。关掉即回到转台（yaw/pitch）老行为。*/
  M.CAM_TRACKBALL = true;
  /* v158.0（P0 大世界）：玩家化身 + 第三人称跟随。
     PLAYER_AVATAR 是总开关（关掉即回到 v157 点格传送 + 轨道相机）；
     FOLLOW 是当前是否处在跟随态（Tab 进出），不写 camO 任何字段 ——
     这样退出跟随时轨迹球姿态逐位还原，零跳变。 */
  M.PLAYER_AVATAR = true;
  M.FOLLOW = false;
  /* v158.2（P2 大世界）：街区层总开关。关掉即回到 v158.1 的"格子模型 + 面板"，
     街区几何不建、相机不覆盖、位姿不动。 */
  M.DISTRICT = true;
  /* v158.3（P3 大世界）：载具层总开关。关掉后街区步行/上马入口全部失效，
     回到 v158.2 的纯步行街区；不改 P0/P1/P2 任何状态与位姿。 */
  M.VEHICLE = true;
  /* v158.4（P4 大世界）：NPC 生态层总开关。关掉后街区照常，只是街上没人、
     E 键不弹对话/战斗提示；不改 P0~P3 任何状态与位置锚。 */
  M.NPC = true;
  /* v158.6（P5-b 大世界）：任务链引导层总开关。关掉后引导链停摆，
     其余照常；不改 P0~P4 任何状态、位置、输入分派。 */
  M.QUEST = true;
  /* v158.14（老板「人物如何走动，我至今没有发现操作选项」）：
     站在城市格上进人物视角时，**自动落到街区**（city 层）。
     原因：球面城格画的是堡垒/城墙模型，不是可行走空间 —— 人站进去是埋在墙里，
     实测"进了人物视角只看到一堵墙"，自然以为没有移动功能。街区本来就是
     城里的可行走层（有街道/居民/载具），这里跟面板「🚶 走进街区」走同一个
     GAME.district.enter 出口，只省掉一次点击。关掉即回到 v158.13 原状。 */
  M.AUTO_DISTRICT = true;
  M._avatarClock = 0;
  M.spinOn = false;
  M.setSpin = function (on) {
    M.spinOn = !!on;
    M._lastAct = 0;                    /* 立刻生效，不等 1.5 秒的"操作让路"冷却 */
    M._spinLast = 0;                   /* 清时基：重启时第一格不按旧时间算 */
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    return M.spinOn;
  };

  /* ⛔ v157.32：原先这里写 `M.ZOOM_MIN = R * 0.95`（下方 603 行又改成 R+眼高）——
     两处赋值就是第二份口径，删掉这一份，只留下方与真实下限对齐的那个。 */
  M.R = R; M.HSC = HSC;                                   /* 暴露给自检/探针（对外只读口径） */
  /* v156.50：**离地最低高度**（世界单位）。山高≈40，取 30 时平原离地 30、山上自动抬到 30+，不穿模。
     ⚠️ v157b 起**不再使用** —— 它就是"永远俯视"的根源（强制离地 30 米，俯角压不平）。
     保留常量只为兼容旧探针。 */
  M.CAM_MIN_AGL = 30;
  /* ============================================================
   * v156.72 地表模式（老板「拉进放大地面后进入地面场景」）
   * ------------------------------------------------------------
   * 关键发现：cam 本来就是 **PerspectiveCamera(42)** —— 不是正交。
   * 所以"拉近就是放大后的地图"不是投影的问题，而是两条约束卡着：
   *   ① CAM_MIN_AGL=30 强制离地 30，永远俯视；
   *   ② 视线被钉在**球心方向**，贴地时就是垂直往下看。
   * 把这两条在地表模式下解开，球面曲率会自然给出地平线 —— 这就是
   * 无人深空/戴森球那种"站在星球上"的观感来源，不需要切换场景。
   * ============================================================ */
  M._surf = false;
  M.SURF_EYE = 1.7;        /* 人眼高（世界单位 ≈ 米）—— 老板：一个人眼高度 */
  /* v157.35（P0-A1）：**地表可见性判据用的地形高** —— 只在玩家主动缩放那一刻更新
     （滚轮 / 滑块 / 进地表），平移期间冻结。
     为什么冻结：每帧跟地形 = 走过山忽实忽虚；用绝对海拔 = 站在高地上永久半透明。
     冻结之后两条都躲开了：贴地 agl≈眼高（不管地形多高），平移不改数（不闪）。 */
  M._fadeGround = 0;
  /* ⛔ v157.32（老板「缩小放大之后位置跳变」的排查副产物）：
     ZOOM_MIN 原来是 R*0.95 = 285，而相机真实下限是 `R + 眼高` = 301.7 ——
     于是**滑块最底下的 1.4% 是死区**：拖到 0 相机不动，松手 thumb 又弹回 0.014，
     看着就是"缩到底之后跳一下"。这里让 ZOOM_MIN 与真实下限同一个数，死区消失。 */
  M.ZOOM_MIN = R + M.SURF_EYE;
  M.SURF_PITCH = 0.10;     /* 保留：旧调用方还在读 */
  /* v157b：两档的分界（离地高度）与贴地时的注视距离。
     AGL_SURF=55 ≈ 15 格高：超过它就看不出地砖纹理了，视线往下砸，
     正好接上轨道视角的"看球心"。 */
  M.AGL_SURF = 55;
  M.SURF_LOOK0 = 40;

  /* ============================================================
   * v157b：**地表状态的唯一施加点**（副作用全在这里）
   * ------------------------------------------------------------
   * 谁来决定"现在是不是地表"？—— 只有 placeCamera 根据**离地高度**决定，
   * 所以这里单独拆出一个纯副作用函数 `_applySurf(on)`：
   * 换背景、退地图符号、建/拆近景层。
   * `M.surfaceMode(on)` 退化为"把相机高度推到对应区间"的便捷入口（给探针用），
   * UI 不再需要按钮 —— 老板：「不需要特别按钮」。
   * ============================================================ */
  /* ============================================================
   * v157r（老板：「高度下降时有一个场景突变（地面凸显，花草树木出现），
   *        有点突兀，能不能平滑过渡，由虚转实」）
   * ------------------------------------------------------------
   * 病根：`rebuildSurf` 建完就是**全不透明**，拉远时 `destroySurf` 又是**瞬间拆掉**——
   * 两个方向都是硬切，所以一格滚轮之间"地面、树、草"凭空出现。
   *
   * 改法：给地表层一个**总透明度 `_surfFade`**，
   *   · 进地表：先建层但 fade=0（完全看不见），随**离地高度**递减而升到 1；
   *   · 出地表：不立刻拆，先把 fade 降到 0 再 destroy。
   * 为什么绑"离地高度"而不是固定时长：玩家慢慢滚轮时它就该慢慢变实，
   * 猛拉到底时它自然快——跟手的过渡永远比定时动画自然。
   *
   * 地形/地砖/线/树/草是**各自的材质**，统一在这里乘一个系数；
   * 原始 opacity 记在材质的 `_fadeBase` 上（材质每次重建都是新的，不会串）。
   * 背景色也一起插值（深空 ↔ 天空色）——它是"突变感"的另一半来源。
   * ============================================================ */
  var _surfFade = 0;                 /* 0=全虚 1=全实 */
  var _surfKillPending = false;      /* 已退出地表但还有余影，等淡完再拆 */
  var _skySurf = null, _skyDeep = null;

  /* ⛔ v157.36（P0-A2）：**地表可见性与"模式"脱钩** —— 先把阈值推到模式切换之外。
     ------------------------------------------------------------
     病灶：原 FADE_FAR = 55 **与切离地表模式的 AGL_SURF = 55 是同一个数**，于是顺序反了：
       54m 还是地表模式、fade 已近 0（看不见地面）→ 55m 地面没了 → 62m 才切模式。
       中间 7 米是"看不见地面、却还能点格子"的怪状态。
     改法：NEAR 10→70、FAR 55→130。地表在**切模式之后**才继续淡出，
       于是"看不见地面却还在地表模式"这段区间被消除（55m 时 fade 仍是 1）。
     保留 FADE_FAR=130 而不是更大：130m 处 44 米半径的地表只占画面很小一块，
       再大就成"贴片浮在球上"，且超过 130m 后地图符号必须接管（A2-1 待验）。
     */
  M.SURF_FADE_NEAR = 40;             /* 离地 ≤40 米：全实（原来 10 米就开始虚，走在哪都发虚） */
  /* 过渡带起点取**切换点本身**（AGL_SURF=55），不是更近的值：
     实测取 50 时，45 米高度上 fade 只有 0.04 —— 那一段画面是 globe 的
     模糊色块（99846 顶点近看没细节），"糊得很难看"。从 55 起算，
     45 米处已有 0.22，地表层一进场就开始浮现。 */
  M.SURF_FADE_FAR = 62;              /* 离地 ≥62 米：全虚 = AGL_SURF(55) + 滞后(7) —— 恰好在切模式前淡完 */
  M.SURF_FADE_K = 0.10;              /* 每帧逼近系数：约 0.4 秒收敛 */

  /* 把当前 fade 写到所有材质与背景上 */
  function _surfApplyAlpha(f) {
    if (scene && M._skyKeep != null) {
      if (!_skyDeep) _skyDeep = new THREE.Color(M._skyKeep);
      if (!_skySurf) _skySurf = new THREE.Color(0x8e97a4);
      if (!scene.background || !scene.background.isColor) scene.background = new THREE.Color();
      scene.background.copy(_skyDeep).lerp(_skySurf, f);
    }
    if (!SR || !SR.root) return;
    /* fade≈0 时整组跳过：省掉几千个半透明图元的排序与混合 */
    SR.root.visible = f > 0.004;
    if (!SR.root.visible) return;
    SR.root.traverse(function (o) {
      var m = o.material;
      if (!m) return;
      var mats = Array.isArray(m) ? m : [m];
      for (var i = 0; i < mats.length; i++) {
        var mm = mats[i];
        if (!mm) continue;
        if (mm._fadeBase == null) {
          mm._fadeBase = (mm.opacity == null) ? 1 : mm.opacity;
          mm._fadeDW = (mm.depthWrite !== false);
        }
        mm.transparent = true;
        mm.opacity = mm._fadeBase * f;
        /* 全实时恢复原 depthWrite：否则地面和树会互相"透"过来 */
        mm.depthWrite = (f > 0.995) ? mm._fadeDW : false;
      }
    });
  }

  /* 每帧推进 fade（在 placeCamera 之后调用，因为要用它算出的 _agl） */
  function _tickSurfFade() {
    /* ⛔ v157.36（P0-A2）：**阈值收进"地表模式区间"内**，但可见性仍归模式管。
       ------------------------------------------------------------
       试过让地表跨模式存在（把这里的 `if (M._surf)` 去掉），实测无效：
       离开地表模式时地表层会被 `destroySurf()` 销毁，`buildSurf` 只在 `M._surf` 时调用，
       所以轨道模式下 SR 恒为 null，fade 永远读 0。要真做到"跨模式存在"，
       得在轨道模式下每帧维护几何与中心格 —— 62 米以上它只占画面一小块，
       用这个代价换那点面积，G3 不过，放弃。
       改为：把 NEAR/FAR 收进"地表模式"的区间（40 / 62），于是
         · 10~55 米这段"走到哪地面都半透明"的老毛病消失（NEAR 从 10 提到 40）；
         · 地表在**切模式之前**就淡完（FAR=62 = AGL_SURF 55 + 滞后 7），
           不再有"看不见地面却还在地表模式"的怪状态。 */
    var t = 0;
    var aglE = -1;                       /* 分档/预览共用的"有效高度" */
    if (M._surf) {
      /* ⛔ v157.35（P0-A1）：判据 = 海拔 − **快照地形高**（不是每帧地形，也不是裸海拔）。
         ------------------------------------------------------------
         两个错都试过了：
           · 每帧 agl（v157.22）：走过山忽实忽虚 —— 因为地形高每帧在变；
           · 裸 _rAlt（v157.31）：是**绝对海拔**，站上 25 米丘陵时判据算出 26.7 米
             → 地表立刻半透明（地形越高地面越虚，与操作无关）。
         现在把地形高降级成**输入时的快照**（与 camFloorAt 同一时机，见 wheel / setZoom /
         _applySurf）。于是：贴地 agl ≈ 眼高（多高的地形都一样清晰）；
         平移期间一个数都不动；只有玩家主动缩放才改判据。 */
      var _altN = (M._rAlt != null) ? M._rAlt : (M._agl || 0);
      var _gh = M._fadeGround || 0;
      aglE = Math.max(0, _altN - _gh);
      /* 建造模式机位更高（28 米），全实范围必须跟着放宽 ——
         否则一进建造模式地砖就半透明，方格看着发虚。 */
      var f0 = (M.mode === M.MODE_BUILD) ? Math.max(M.SURF_FADE_NEAR, 35) : M.SURF_FADE_NEAR;
      /* ============================================================
       * v158.48（老板「相机在海拔 60-40 之间，景物加载有跳变」）：规则变更 ——
       * 淡入窗口从「40 ~ 切模式高度(62)」扩成统一 **40 ~ 70**：
       *   出地表（62m 切模式）时还有 ~0.2 余影，继续淡到 70 才消失 ——
       *   与轨道态预览（下方 else 分支）同一条曲线，进出无接缝。
       * v157.50 老口径「淡完才变轨道」按新规则让位于「60~40 全程平滑」。
       * ============================================================ */
      var FAR48 = 70;
      t = 1 - Math.min(1, Math.max(0, (aglE - f0) / (FAR48 - f0)));
      t = t * t * (3 - 2 * t);                    /* smoothstep：两头缓、中间快 */
    } else {
      /* ============================================================
       * v158.48（老板「在这个比较高空的时候，元素就应该是加载出来了，
       *   只不过显示它的缩略版……让他的缩略物逐渐精细化，随着高度」）：
       * 轨道态低空**预览** —— agl < 65 就提前构建地表层（构建时 alpha≈0
       *   看不见，55 进地表不再"突然 new"）；65~40 区间 alpha 渐入到 0.45
       *   （"缩略版"淡影先现）；细节分档见下方（先树后草石）。
       * 65 以上不构建；75 以上余影淡完后拆层（滞回防抖动）。 */
      var _aglP = Math.max(0, (M._rAlt != null ? M._rAlt : (camO.dist - R)));
      if (_aglP < 65) {
        /* 懒构建 + 平移重锚（3 格 ≈15.75m 外重建；SR 陈旧时回到低空不露错位） */
        try {
          var _needP48 = !SR || !SR.dir || !camO.dir
            || (camO.dir[0] * SR.dir[0] + camO.dir[1] * SR.dir[1] + camO.dir[2] * SR.dir[2])
               < Math.cos((5.25 / R) * 3);
          if (_needP48) rebuildSurf(camO.dir || [0, 1, 0]);
        } catch (ePrev48) { }
        aglE = _aglP;
        t = 1 - Math.min(1, Math.max(0, (_aglP - M.SURF_FADE_NEAR) / (70 - M.SURF_FADE_NEAR)));
        t = t * t * (3 - 2 * t);
        /* v158.59：飞行态低空不再停在 0.45 —— 老板要"连续空间"，贴地飞时
           地面必须是**全实**的（半透明地面看起来就是没加载完）。
           65m→0.45 起、48m→1 全实，仍然连续渐变；非飞行态保持旧的半实预览。 */
        /* ⚠️ 必须在本函数内自己算：_onShip 是 placeCamera 的局部变量，
           跨函数引用会 ReferenceError（写了就会被外层 try/catch 吞掉）。 */
        var _onShip59 = !!(M._fly && M._fly.active);
        var _capP59 = _onShip59
          ? Math.max(0.45, Math.min(1, (65 - _aglP) / 17))
          : 0.45;
        t = Math.min(_capP59, t);
      } else if (_aglP >= 75 && !_surfKillPending) {
        _surfKillPending = true;                 /* 淡完即拆（下方统一出口） */
      }
    }
    /* v158.48 分档缩略：aglE > 48 只显树（草/石/芦苇隐）—— 先大件后细节，
       随着高度降低逐渐精细化。sig 去重，状态不变不写 visible。 */
    try {
      if (SR && M._surfScat && M._surfScat.meshes) {
        var _wantSmall48 = aglE <= 48;
        if (_wantSmall48 !== M._scatSmall) {
          M._scatSmall = _wantSmall48;
          for (var _si48 = 0; _si48 < M._surfScat.meshes.length; _si48++) {
            var _im48 = M._surfScat.meshes[_si48];
            if (!_im48 || !_im48.name) continue;
            var _k48 = _im48.name.slice('surfScatter_'.length);
            if (_k48 === 'trunk' || _k48 === 'crown') continue;
            _im48.visible = _wantSmall48;
          }
        }
      }
    } catch (eScat48) { }
    /* v157.47（P1 探索实体化）：地标（遗迹/村社/营地）每 500ms 对一次"数量签名"，
       变了才重建 —— 发现一处遗迹时**不用等下一次平移**就能立起来。
       不每帧重建：那等于每帧 new 一批 mesh 再 dispose，GPU 会被抖死。
       也不只在 rebuildSurf 里做：sweep 发现遗迹时玩家可能站着不动。 */
    if (Date.now() - _lmAt > 500) {
      _lmAt = Date.now();
      try { buildLandmarks(false); } catch (eLM) { }
    }
    var k = M.SURF_FADE_K;
    /* ============================================================
     * v157.18（老板「高空到地面还有一个跳变，画面抖一下，会有地面景象突然出现」）
     * ------------------------------------------------------------
     * 目标透明度 t 由 agl 决定，但**推进速度没有上限**：
     *   滚轮把 agl 从 55 一口气拉到 25 时，t 直接从 0 跳到 1，
     *   fade 用 K=0.14 逼近 → 7 帧（0.12 秒）就把整片地面"啪"地铺上来
     *   —— 观感就是"地面景象突然出现 + 抖一下"。
     *
     * 现在给**上升**加时间上限：不管 t 跳多远，最快也要 SURF_FADE_IN_MS
     * （默认 550ms）才推到全实。下降仍走原来的指数衰减（退场不该拖沓）。
     * 这样滚得多快，地面都是"长出来"的。
     * ============================================================ */
    var _prevFade = _surfFade;
    _surfFade += (t - _surfFade) * k;
    /* v157.50：**退场也加上限**（200ms 必淡完）。指数逼近在快滚时跟不上：
       连滚三格跨过 62 米只要 0.3 秒，而 K=0.10/帧要 0.3 秒才降到 0.4 ——
       切模式那一帧还看得见半透明地形，这就是"阈值处不干净"的观感来源。 */
    if (t < _prevFade) {
      var _now50 = Date.now();
      var _dt50 = (M._fadeOutAt == null) ? 16 : Math.min(120, _now50 - M._fadeOutAt);
      M._fadeOutAt = _now50;
      var _outMs = (M.SURF_FADE_OUT_MS == null) ? 200 : M.SURF_FADE_OUT_MS;
      var _minDrop = _dt50 / Math.max(1, _outMs);
      if (_prevFade - _surfFade < _minDrop) _surfFade = Math.max(t, _prevFade - _minDrop);
    } else { M._fadeOutAt = 0; }
    if (t > _prevFade) {
      var _now18 = Date.now();
      var _dt18 = (M._fadeLastAt == null) ? 16 : Math.min(120, _now18 - M._fadeLastAt);
      M._fadeLastAt = _now18;
      var _inMs = (M.SURF_FADE_IN_MS == null) ? 550 : M.SURF_FADE_IN_MS;
      var _cap18 = _prevFade + _dt18 / Math.max(1, _inMs);
      if (_surfFade > _cap18) _surfFade = _cap18;
    }
    if (Math.abs(_surfFade - t) < 0.003) _surfFade = t;
    if (!(_surfFade >= 0)) _surfFade = 0;         /* 也挡住 NaN */
    if (_surfFade > 1) _surfFade = 1;
    _surfApplyAlpha(_surfFade);

    /* 已经退出地表、余影也淡完了 → 这时才真正拆掉。
       v158.48：预览层在 ≥75m 或出地表（killPending）且淡完时拆；
       65~75 之间淡完也**保留**（alpha=0 不可见，防横跳反复建拆）。 */
    if (!M._surf && _surfFade <= 0.005) {
      var _agK48 = Math.max(0, (M._rAlt != null ? M._rAlt : (camO.dist - R)));
      if (_surfKillPending || _agK48 >= 75) {
        _surfKillPending = false;
        try { destroySurf(); } catch (eK) { }
      }
    }
  }
  M._surfFade = function () { return _surfFade; };

  function _applySurf(on) {
    var v = !!on;
    if (v === M._surf && (v ? !!SR : !SR)) return;      /* 幂等 */
    M._surf = v;
    /* 贴地时两件必须跟着变，否则一眼还是"地图"：
       ① 背景：深空色 → 天空色（透视贴地时天空要占画面上三分之一）；
       ② 网格线：0.6 不透明 → 0.12。六边形是"地图的语言"，
          站到地面上还满屏描边，永远像在看棋盘。 */
    try {
      if (scene) {
        if (!M._skyKeep) M._skyKeep = scene.background ? scene.background.getHex() : 0x0a1020;
        /* ⚠️ 这里不能用 _skyBase —— 它是 scene3d 的私有变量，map3d 里没有声明。
           读取未声明标识符会抛 ReferenceError（无论是否严格模式），被外层
           try/catch 吞掉后 **整块设置都不执行**，天空一直是深空色。
           实测像素 RGB=[1,1,4]（深空），就是这条造成的。 */
        /* v157r：背景色不在这里硬切 —— 交给 _surfApplyAlpha 按 fade 插值。
           硬切那一瞬间"天空从深空变灰"，本身就是突变感的一半。 */
      }
      if (M._shellMat) M._shellMat.opacity = M._surf ? 0.12 : 0.6;
      /* v157.76：探明边界线同样只在太空模式亮 —— 站在地上时它是"地图语言"，
         会变成地上一条莫名其妙的亮线（同 v157 让城色块/插旗退场的理由）。 */
      /* ⛔ v157.86：边界线已整条删除，这里不再有「地表模式隐藏边界」的判断。 */
      /* ============================================================
       * v157：地表模式 = **只看世界，不看地图符号**
       * ------------------------------------------------------------
       * 城市色块、插旗、出征箭头、格心标记都是"地图语言"：
       * 站在地上时它们会变成地上一块莫名其妙的色斑（实测：城脚下一块亮蓝方块）。
       * 地表有真实的城模型和地块，这些符号全部退场。
       * 名称标签保留（"这是哪座城"在地面同样有用），交给 scaleLabels 逐帧管。
       * ============================================================ */
      /* ⛔ v157.37 试过：把 `_markers` 在地表打开以"保留领地色" —— **错**。
         `_markers` 是**六边形面片**（几十米一格），地表的地砖是 2 米方格，
         两者一叠就是"方形格线上浮着六边形色块"，正是老板说的"混到一起"。
         正确做法：颜色应由**地砖自己**表达（地表层已按地形着色），
         领地色要落到地砖上也是下一步在地表层做，不是打开六边形图层。
         所以这里保持隐藏 —— 近地面只有方形地砖一层。 */
      if (M._markers) M._markers.visible = !M._surf;
      if (M._flags) M._flags.visible = !M._surf;
      if (M._arrows) M._arrows.visible = !M._surf;
      /* v157c：陨石带也退场 —— 站在地面上抬头看到一串黑点飘在天上，
         既不是云也不是星，读起来像渲染错误（右键转头后才暴露）。 */
      if (beltRoot) beltRoot.visible = !M._surf;
      /* v157e：压暗已并入 globe 顶点色，不再有独立图层要开关。
         落地后地形由地表层（不压暗）呈现，globe 只剩远景，压暗与否都不影响近处观感。 */
      if (M._surf) {
        /* v158.31（老板「怎么走，怎么交互」）：操作条原来只由 `M.setFollow` 驱动，
           而人物模式已退役 → **屏幕上没有任何操作说明**。改成跟着地表状态走：
           落到地面就亮，升空就收。 */
        try { if (GAME.ui && GAME.ui.renderFollowHud) GAME.ui.renderFollowHud(true); } catch (eHud0) { }
        /* v158.22：进地表重置跟随相机的水平基准 —— 换一片地方后
           "北"必须按新位置的切平面重算，否则镜头会歪着看人。 */
        M._surfCamE1 = null;
        M._surfOrbitYaw = 0;
        M.SURF_CAM_EL = 1.0;
        /* v158.26：镜头锚点也要重置 —— 否则从上一片地方"飞"过来（一帧跨几十公里）。 */
        M._surfCamAnchor = null;
        /* v157.18（推翻 v157.17 的"延后到 45 米"）：**就在进入这一刻建**。
           那时候 fade 还是 0（55 米 = SURF_FADE_FAR，地表层全透明），
           构建的卡顿发生在"画面里还没有地面"的时候 —— 玩家感知不到。
           延后到 45 米反而更糟：那时 fade 已 ~0.3，地面半可见，卡顿看得见。
           配套：采样降到 1.4 米（重建 180ms → 40ms），这次卡顿从 11 帧降到 2~3 帧。 */
        rebuildSurf(camO.dir || [0, 1, 0]);
        /* 新层从"全虚"起步，之后由 _tickSurfFade 按离地高度推上去 */
        _surfKillPending = false;
        _surfApplyAlpha(_surfFade);
      } else if (_surfFade > 0.005) {
        try { if (GAME.ui && GAME.ui.renderFollowHud) GAME.ui.renderFollowHud(false); } catch (eHud1) { }
        /* 还有余影 → 先淡出，淡完由 _tickSurfFade 调 destroySurf */
        _surfKillPending = true;
      } else {
        _surfKillPending = false;
        destroySurf();
      }
    } catch (e) { }
  }

  /* ============================================================
   * v157v：**战略 / 建造 模式切换**（唯一入口）
   * ------------------------------------------------------------
   * 两个模式不只是换显示，是**换一套坐标系**：
   *   战略：六边形 ci。悬停出地块情报，看得见领地/迷雾/城市。
   *   建造：四边形 (i,j)。只铺方格，不悬停六边形、不读地块情报。
   *
   * 进建造要把相机拉到近地（离地 ≈9 米）——方格只在近景铺得开；
   * 玩家手动拉远不会退出建造模式（模式是**显式状态**，不跟高度绑定），
   * 这一点和"轨道/地表自动切换"是两套独立机制，别混。
   * ============================================================ */
  M.setMode = function (mode) {
    var m = (mode === M.MODE_BUILD) ? M.MODE_BUILD : M.MODE_STRATEGY;
    if (m === M.mode) return M.mode;
    M.mode = m;
    try {
      if (m === M.MODE_BUILD) {
        var d0 = camO.dir || [0, 1, 0];
        var e0 = 0;
        try { e0 = elevAvgAt(d0); } catch (eE) { }
        /* ============================================================
         * 建造视角 = **俯视约 42°**，不是平视。
         * ------------------------------------------------------------
         * 实测：离地 9 米时俯角只有 11°，鼠标一放到画面中部，射线就打到
         * 地平线附近几十米外的格子 —— 根本没法"看着脚下这一格"摆放。
         * 离地 28 米时 `lookDistAt` 把注视点收到 28 米，俯角 ≈42°，
         * 视野里是一整片方格，鼠标指着哪里就是哪里。
         * 配套：建造模式的 fade 全实范围要放宽到 35 米（见 _tickSurfFade），
         * 否则机位一高，地砖就半透明了。
         * ============================================================ */
        camO.dist = Math.min(camO.dist, R + e0 + 28);
        camO.quat = null; camO._euler = null;
        _syncZoom();
        M.BUILD_GRID = true;
      } else {
        try { M.gridHighlight(null); } catch (eG) { }
        M._hoverCell = null;
      }
      touch(); redraw();
    } catch (e) { }
    return M.mode;
  };
  M.isBuildMode = function () { return M.mode === M.MODE_BUILD; };

  M.surfaceMode = function (on) {
    /* 便捷入口：把离地高度推过阈值，真正的状态切换由 placeCamera 派生。
       （保留它是因为探针/自动化在用；正常玩法靠滚轮，不需要按钮。） */
    try {
      if (on) camO.dist = R + elevAvgAt(camO.dir || [0, 1, 0]) + (M.SURF_EYE || 1.7) * 1.5;
      else camO.dist = R * 2.9;
    } catch (eD) { }
    _syncZoom();
    /* 探针/自动化入口 = **立即到位**，不跑过渡动画，
       否则所有截图与自检会拍到半透明中间态（那是玩家路径才需要的）。 */
    _surfFade = on ? 1 : 0;
    /* v157.35：进地表时把地形高快照一次 —— 之后平移不改，直到下一次缩放。 */
    if (on && M._groundAt) M._fadeGround = M._groundAt();
    _surfKillPending = false;
    try { _applySurf(!!on); } catch (e) { }
    try { _surfApplyAlpha(_surfFade); } catch (eA) { }
    try { touch(); redraw(); } catch (e) { }
    return M._surf;
  };

  /* ============================================================
   * v157 · 地表层
   * ------------------------------------------------------------
   * 老板：「尝试开始做地面部分，想要星露谷那样的平面建设效果。
   *        当然，适配现有建造体系，风格，球面系。比较对标的就是戴森球计划。」
   *
   * 目标 X：站到星球表面，脚下是一块块**看得清、点得中**的地，
   *         可以直接在上面建设 —— 而不是隔着一层球看一张图。
   *
   * 路径 Y：**不新造网格**。icosphere 早就把 40962 格算好了：
   *           cell.rim = 贴地六边形边界（5~6 点）、cell.pos = 格心、cell.dir = 法向。
   *         缺的只是"实体化"，补两层：
   *           ① 近景地形层 —— 切平面 1 米采样、半径 46 米。
   *              globe 是 K=128 固定细分：贴地时一格（5.25 米）铺满半个屏幕，
   *              却只有 2 个三角形 —— 那是"地图"，不是"地"。
   *           ② 地块平台层 —— 每格把 rim 连成六边形面 + 描边。
   *              星露谷的"田垄"就是这个角色：让每一格有边界、有归属、可点选。
   *
   * 代价 Z：地形约 1.7 万三角形 + 地块约 3 千，**只在 _surf 打开时存在**，
   *         退出即 dispose。重建以"半格"为阈值，不是每帧。
   * ============================================================ */
  var SR = null;                       /* { root, dir, ci, terr, plate, plateLine } */
  /* v157.48：落地时**一次性**把视线抬到俯角 -15°（只跑 220ms，不是常驻自动运动）。
     为什么必须做：进地表时视线是从轨道继承的 —— 而轨道默认正对球心，
     落地后就是 el=−90°（正对脚下）。此时"左右拖 = 绕径向转"退化成绕视线自转，
     转了等于没转 —— 实测连续 3 次水平拖，surfDir 一个数都没变。
     所以"右键转不全向"的根不是转向算法，是**起点在天底**。 */
  var _surfTilt = null;
  M.SURF_R = 46;                       /* 近景地形覆盖半径（世界单位 ≈ 米）*/
  /* v157.18：采样精度 1.0 → 1.4 米。
     实测重建 60~80ms 里 **地形层独占 40~60ms**（8649 顶点 × nearestCell + sphBiome），
     是"滚到地面时卡一下"的最大头。地形层画的是 43~46 米外的野地 + 整平台面，
     两种都不需要 1 米精度；1.4 米后顶点 8649 → 4356，耗时降到 ~25ms。
     ⚠️ 别超过 1.6：再粗，平台外那圈野地的坡折会看得出多边形。 */
  /* v158.34：1.4 → 1.7。地形层是"远景"，1.4 米的采样在 16 米机位下过密
     （4489 → 3048 顶点，重建的地形段从 12.6ms 降到 ~9ms）。 */
  M.SURF_STEP = 1.7;                   /* 近景地形采样精度（米） */
  /* 环数必须让平台半径 < 地形层半径，否则砖会**浮在没有地形的球面上**
     （11 环 ≈ 39.5 米 < 46 米，外面留一圈"野地"，正好是砖与荒野的分界）。*/
  M.SURF_RINGS = 12;                   /* 地块平台覆盖环数（1+3·12·13 = 469 格 ≈ 43 米）*/
  M.SURF_LIFT = 0.06;                  /* 平台比地形层高多少（z-fight 余量）*/

  function _sUnit(a) { var l = _hyp(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  /* 以 n 为法向的正交基（t1 × t2 = n，保证三角形绕向朝外） */
  function _sBasis(n) {
    var up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var t1 = _sUnit(_cross(up, n));
    var t2 = _cross(n, t1);
    return [t1, t2];
  }

  function destroySurf() {
    if (!SR) return;
    try {
      scene.remove(SR.root);
      SR.root.traverse(function (o) {
        /* 景物的几何是**跨次重建共享**的（_SCATTER_DEF 缓存），
           这里 dispose 掉会让下次重建重新上传一遍 GPU 资源。
           打 _shared 标记跳过；材质每次新建，照常释放。 */
        if (o.geometry && !o.geometry._shared) o.geometry.dispose();
        if (o.material && !o.material._shared) o.material.dispose();
      });
    } catch (e) { }
    SR = null;
    /* v157.47：地标必须跟地表层同生共死 —— 只靠 500ms 的定时检查会漏：
       弹窗打开时渲染循环可能被暂停，切走之后那批 mesh 就留在场景里了（实测 n=1）。 */
    try {
      if (lmRoot) { scene.remove(lmRoot); disposeTree(lmRoot); lmRoot = null; }
      _lmSig = '';
    } catch (eL) { }
    M._sr = null;          /* ⚠️ 对外暴露的那份引用也要清 —— 只清闭包里的 SR，
                              外部读 M._sr 仍是旧对象（实测"已升空但 hasSR 还是 true"）*/
    /* v158.15（老板「六边形地块碍事」）：地表悬停高亮整条退役 —— 原先挂在这里的
       surfHi 清理逻辑随之删除（surfHi/surfHiCi/M._hiCi 都不存在了，见 2367 行墓碑）。
       退地表不再需要"清亮格"。 */
  }
  M.destroySurf = destroySurf;

  /* 近景地形：切平面 (u,v) → 球面方向 → sphElev → 位置。
     ⚠️ 必须"先定向、再定高"：直接把切平面点当位置会丢掉球面曲率
        （46 米外下陷 46²/2R ≈ 3.5 米，整片地会像被掀起来一样）。 */
  /* ============================================================
   * v158.8（老板「近地面每次卡一下」）：**规则网格最近格增量缓存**
   * ------------------------------------------------------------
   * 病根：`_surfTerrainGeo` 的 1.4 米采样网格有 67×67 ≈ 4489 个顶点，
   *   每个顶点都调一次 `sphBiome` → `SP.nearestCell`（空间哈希壳层扫描）
   *   + `M.cellColorOf`（版本字符串校验）+ `fbm3`（高频噪声）。
   *   虽然 nearestCell 已有空间哈希，但 4489 次「哈希键 + 壳层扫描 + 点积」
   *   累加仍要 ~66ms（实测 4 帧卡顿）。
   *
   * 关键事实：采样是**规则网格**，相邻顶点方向连续变化，最近格**几乎不变**
   *   （一格约 1.7 米，步长 1.4 米，最多跨一两格）。所以用一个「上一顶点
   *   最近格」做种子：新顶点先与该格方向点积，若仍 ≥ 相邻格边界阈值（cos 半角），
   *   直接复用格号，跳过 nearestCell 全查；只有越界时才真正 nearestCell 重查。
   *
   * 正确性：nearestCell 是「方向→最近格」的纯函数（只依赖当前星球 SP 状态），
   *   增量缓存不改变结果，只是把「逐顶点全查」换成「点积命中 + 偶发重查」。
   * ============================================================ */
  function _surfTerrainGeo(n, t1, t2, innerR) {
    var half = M.SURF_R, step = M.SURF_STEP;
    var N = Math.round(half * 2 / step) + 1;
    var nvtx = N * N;
    var pos = new Float32Array(nvtx * 3), col = new Float32Array(nvtx * 3);
    var uv = new Float32Array(nvtx * 2);
    var cR = [n[0] * R, n[1] * R, n[2] * R];
    var k = 0, ku = 0;
    /* v157.15：逐顶点标记"是不是整平台面"。整平格的地形要**留着** ——
       台面抬起后下面不能是洞，而 1 米采样的地形正好充当台地的崖壁。 */
    var _terrFlag = new Uint8Array(nvtx);
    var _PLn = (M.SURF_PLIFT == null ? 0.4 : M.SURF_PLIFT) / HSC;
    /* v158.8 增量缓存状态：_ciSeen = 上次最近格号，_ciDot = 上次「方向·格方向」点积。
       复用阈值取 cos(一格视角半径)。格视角半径 ≈ 弧长/球半径，一格约 1.7 米世界单位
       （cellW），球半径 R 归一化 ≈ 1，故半角 ≈ cellW/(2·R·HSC) 很小；
       这里用保守的 0.9999（约 0.81°）—— 只会复用「确实同格」的顶点。 */
    var _ciSeen = -1, _ciDir = null, _ciDotThr = 0.9999;
    for (var j = 0; j < N; j++) {
      var v = -half + j * step;
      for (var i = 0; i < N; i++) {
        var u = -half + i * step;
        var d = _sUnit([
          cR[0] + t1[0] * u + t2[0] * v,
          cR[1] + t1[1] * u + t2[1] * v,
          cR[2] + t1[2] * u + t2[2] * v]);
        var th = _terrLevelHAt(d);
        var e, vtx;
        if (th != null) { e = th - _PLn; vtx = 1; }
        else { e = groundHAt(d); vtx = 0; }
        var rr = R + Math.max(0, e) * HSC + 0.03;
        pos[k] = d[0] * rr; pos[k + 1] = d[1] * rr; pos[k + 2] = d[2] * rr;
        /* v158.8：最近格增量缓存 —— 点积命中则跳过 nearestCell 全查 */
        var ciHit = -1;
        if (_ciSeen >= 0 && _ciDir) {
          var _dotSeen = _ciDir[0] * d[0] + _ciDir[1] * d[1] + _ciDir[2] * d[2];
          if (_dotSeen >= _ciDotThr) ciHit = _ciSeen;
        }
        var c = sphBiome(e, d[1], d, false, ciHit);
        /* v158.8：回写缓存 —— 直接读 sphBiome 写出的实际 ci（命中=缓存值，
           未命中=sphBiome 内部已 nearestCell 的结果），零重复查询。 */
        if (_lastBiomeCi >= 0) {
          _ciSeen = _lastBiomeCi;
          _ciDir = (SP.cells && SP.cells[_ciSeen] && SP.cells[_ciSeen].dir)
            ? SP.cells[_ciSeen].dir : null;
        }
        col[k] = c[0] / 255; col[k + 1] = c[1] / 255; col[k + 2] = c[2] / 255;
        uv[ku] = i / (N - 1); uv[ku + 1] = j / (N - 1);
        if (vtx) _terrFlag[(k / 3) | 0] = 1;
        k += 3; ku += 2;
      }
    }
    /* ============================================================
     * v157：**平台范围内不画地形层**（innerR 内挖空）
     * ------------------------------------------------------------
     * 起因：地形有起伏，而地砖是切平面。1 米采样的地形层在格子内部
     * 经常高过地砖（坡度 >5% 就够），从缝里顶上来 →
     * 整片地像被啃过、露出深褐碎片（实测占屏 35%，怎么调缝宽都修不掉）。
     *
     * 几何上这是必然的：两张不同分辨率的曲面覆盖同一块地，必然互相穿插。
     * 所以不修"谁高谁低"，改成**不相交**：平台范围内只留地砖，
     * 地形层从平台外沿才开始画 —— 中间是"我的地"，外面是"野地"，
     * 这正好也是建设类游戏该有的边界感。
     * ============================================================ */
    var _cosIn = (innerR && innerR > 0) ? Math.cos(Math.min(1.4, innerR / R)) : -2;
    var idx = new Uint32Array((N - 1) * (N - 1) * 6), ii = 0;
    for (var j2 = 0; j2 < N - 1; j2++) for (var i2 = 0; i2 < N - 1; i2++) {
      var a = j2 * N + i2, b = a + 1, c2 = a + N, d2 = c2 + 1;
      /* ============================================================
       * v158.21（老板「为什么近地面的视野边界是个正方形？我没见过正方形的一个视野边界」）
       * ------------------------------------------------------------
       * 地形层原来是 `N×N` **方阵**采样（u,v 都取到 ±half），四个角伸到 half×1.41 ——
       * 这就是玩家看到的那口"正方形井"的最终来源（平台那边也一并裁圆了）。
       * 现在只保留"四边形中心落在半径 half 的圆内"的三角，边界成弧。
       * 被跳过的位置在 idx 里留 0（退化三角，不渲染、也不影响包围球）。
       * ============================================================ */
      var _cu = -half + (i2 + 0.5) * step, _cv = -half + (j2 + 0.5) * step;
      if (_cu * _cu + _cv * _cv > half * half) continue;
      /* ============================================================
       * v157.21：**四边形中心落在整平格里才不画**
       * ------------------------------------------------------------
       * 上一版按"任一顶点属于整平格就跳过"，边界会被 1.4 米采样网格放大成
       * 锯齿状的大洞（实测是一个带尖角的星形坑，比原来更难看）。
       * 改成看**四边形中心**：洞的边界跟着格子走，误差 ≤ 半个采样格（0.7 米），
       * 而且不会因为"只碰到一个角"就整块被挖掉。
       * 台面本身由地砖顶面 + 四周侧壁封闭，地形层只负责野地。
       * ============================================================ */
      var _qcx = (pos[a * 3] + pos[b * 3] + pos[c2 * 3] + pos[d2 * 3]) * 0.25;
      var _qcy = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c2 * 3 + 1] + pos[d2 * 3 + 1]) * 0.25;
      var _qcz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c2 * 3 + 2] + pos[d2 * 3 + 2]) * 0.25;
      var _qL = Math.hypot(_qcx, _qcy, _qcz) || 1;
      if (_terrLevelHAt([_qcx / _qL, _qcy / _qL, _qcz / _qL]) != null) continue;
      if (_cosIn > -1) {
        /* 四点全部落在内圈 → 整块跳过（用顶点方向与中心方向的夹角判） */
        var _in = true;
        var _chk = [a, b, c2, d2];
        for (var _q = 0; _q < 4; _q++) {
          var _o = _chk[_q] * 3;
          var _px = pos[_o], _py = pos[_o + 1], _pz = pos[_o + 2];
          var _L2 = Math.hypot(_px, _py, _pz) || 1;
          if ((_px * n[0] + _py * n[1] + _pz * n[2]) / _L2 < _cosIn) { _in = false; break; }
        }
        if (_in) continue;
      }
      idx[ii++] = a; idx[ii++] = b; idx[ii++] = c2;      /* t1 × t2 = n → 朝外 */
      idx[ii++] = b; idx[ii++] = d2; idx[ii++] = c2;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  /* ============================================================
   * 地块平台（v157 定稿）：**贴地六边形 + 无缝拼接**
   * ------------------------------------------------------------
   * 走过的两条弯路，都记在这里，免得再走一次：
   *   ① 地砖跟随地形 + 地形层不挖空 → 两张不同分辨率的曲面必然互相穿插，
   *      地形从格子中间顶出来，整片地像被啃过（占屏 35%）。
   *   ② 地砖改"平砖"（每格一个半径）→ 本星球地形起伏约 26 个世界单位，
   *      相邻格能差好几米，平砖立刻变成高低错落的"柱林"（截图确认）。
   *
   * 正解：**地形层在平台范围内挖空**（互不相交）+ 地砖**跟随地形**（无缝）。
   * 地砖的角点是 sphere.js 共享的 rim 方向 → 相邻格在同一条边上顶点完全重合，
   * 天然严丝合缝，既不需要留缝也不需要裙边。
   * ============================================================ */
  /* ============================================================
   * v157.26：地砖 = **方形砖**（老板：「建造对地面的操作依赖的是六边形网格，
   *          跟设想有差别」）
   * ------------------------------------------------------------
   * 上一版每个**六边形 cell** 一块六边形砖，整平也按 cell 写 —— 于是
   * "点一块 2 米方砖，动的是它所在那 5.25 米的一大块六边形"，
   * 台面边界是六边形、切面不是方的。
   *
   * 现在：一格 = 一个 2 米见方的砖，编号就是 (i,j)（切平面锚给出，
   * 全球唯一、重锚后不漂）。地砖 / 侧壁 / 描边 / 整平 / 放置全部同一套坐标。
   *
   * 每格 5 个顶点（4 角 + 心），4 个三角；省掉边中点 —— 2 米砖跨坡的
   * 弯曲可以忽略，省一半顶点。
   * 高度：**整平格四角同高**（水平台面）；未整平格跟随自然地形（角点各自取高度）。
   * 侧壁：4 邻逐条比较，谁高谁画一段竖面（墙高 = 这条边上两格的实际高差）。
   * ============================================================ */
  function _surfPlateGeo(ci0) {
    var c0 = SP.cells && SP.cells[ci0];
    var dir0 = (c0 && c0.dir) ? c0.dir : [0, 1, 0];
    var A = _gridAnchorFor(dir0);                 /* 后面所有格坐标都靠这个锚 */
    var list = SP.hopsWithin ? SP.hopsWithin(ci0, M.SURF_RINGS) : [];   /* 景物撒布仍按六边形环 */
    var CELL = M.BUILD_CELL;
    /* v158.34：22 → 20 格（44 → 40 米窗口）。16 米机位下 40 米外早已出画，
       省下的 267 格正好是平台段的一半开销。 */
    var RANGE = (M.SURF_GRID_RANGE == null ? 20 : M.SURF_GRID_RANGE);
    var LIFT = (M.SURF_PLIFT == null ? 0.4 : M.SURF_PLIFT);
    var LINE_LIFT = 0.05;
    var g0 = M.gridCellOf(dir0) || { i: 0, j: 0 };

    var pos = [], col = [], idx = [], lp = [];
    /* 描边去重：用**局部格点编号**做整数键。
       原来按顶点坐标 toFixed(3) 拼字符串，2025 格 × 4 边 = 8100 次格式化 + 8 千个
       字符串键 —— 实测这一段占了重建时间的 1/4。局部编号是 int，Set 里直接比。 */
    var _lineSet = (typeof Set === 'function') ? new Set() : null;
    var _lineObj = _lineSet ? null : {};
    var _LID = function (gi, gj) {
      var li = (gi - g0.i + RANGE + 1) & 63;
      var lj = (gj - g0.j + RANGE + 1) & 63;
      return (li << 7) | lj;
    };
    var cellN = 0;

    /* ============================================================
     * v157.26 性能：**格点缓存**（角点被 4 个格共享，只算一次）
     * ------------------------------------------------------------
     * 首版逐格算 4 角 + 格心 = 5 次 _gridDirOf + 5 次 sphElev，
     * 2809 格 → 14045 次，实测整次重建 **205ms**（滚到地面会卡四帧）。
     * 现在：格点（角）编号 (gi,gj) 只算一次 → 方向+自然高度；
     *      格心方向用四角平均（球面上误差 < 0.1°，看不出来）。
     * 调用量 14045 → 2809，另省掉逐格的 nearestCell（水色改用 eC<0 判）。
     * ============================================================ */
    var _cn = {};
    var cornerNat = function (gi, gj) {
      var k = gi + ',' + gj;
      var q = _cn[k];
      if (q) return q;
      /* ⚠️ 必须减掉**全局锚偏移**：对外编号是"全球唯一"的（重锚会平移），
         而 _gridDirOf 吃的是**本锚局部坐标**。漏减的后果是整个砖阵列被投到
         地球另一侧 —— 表现为"地表一片空白，只有远处云"（踩过）。 */
      var d = _gridDirOf((gi - _gridOrigin.i - 0.5) * CELL, (gj - _gridOrigin.j - 0.5) * CELL, A);
      var dd = [d.x, d.y, d.z];
      var e = 0;
      try { e = sphElev(dd); } catch (x) { e = 0; }
      q = { d: dd, e: Math.max(0, e) };
      /* v157.59：角点原色随方向缓存（与 _cn 同生命周期，每角只算一次），
         供平台逐顶点取 sphBiome 原色，消除「每格一色」的方格色斑。 */
      try { q.c = sphBiome(q.e, dd[1], dd) || [180, 172, 132]; } catch (x) { q.c = [180, 172, 132]; }
      _cn[k] = q;
      return q;
    };
    var ptOf = function (d, th) {
      var rr = R + Math.max(0, th) * HSC + LIFT;
      return [d[0] * rr, d[1] * rr, d[2] * rr];
    };

    for (var i = g0.i - RANGE; i <= g0.i + RANGE; i++) {
      for (var j = g0.j - RANGE; j <= g0.j + RANGE; j++) {
        /* ============================================================
         * v158.21（老板「为什么近地面的视野边界是个正方形？我没见过正方形的一个视野边界」）
         * ------------------------------------------------------------
         * 原来是 `(2*RANGE+1)²` 的**方阵**（45×45 = 2025 格）：四个角伸到 79×1.41 ≈ 112 米，
         * 而地形层 `_surfTerrainGeo` 从 43 米外才铺 —— 方阵的直角边直接压在地形上，
         * 就是玩家看到的那口"正方形井"。
         * 现在按**圆形**裁切（半径 RANGE 格），边界是弧、且外圈被地形层接住，看不出接缝。
         * ============================================================ */
        var _di = i - g0.i, _dj = j - g0.j;
        if (_di * _di + _dj * _dj > RANGE * RANGE) continue;
        var th = _terrHOfIJ(i, j);
        /* 四角（格点编号：SW=(i,j) SE=(i+1,j) NE=(i+1,j+1) NW=(i,j+1)） */
        var cSW = cornerNat(i, j), cSE = cornerNat(i + 1, j),
            cNE = cornerNat(i + 1, j + 1), cNW = cornerNat(i, j + 1);
        var cds = [cSW.d, cSE.d, cNE.d, cNW.d];
        var esNat = [cSW.e, cSE.e, cNE.e, cNW.e];
        /* 高度：整平格**四角同高**（水平台面）；否则跟随自然地形 */
        var isT = (th != null);
        var es = isT ? [Math.max(0, th), Math.max(0, th), Math.max(0, th), Math.max(0, th)] : esNat;
        /* 格心：方向 = 四角平均（归一化）；高度 = 台面 或 四角平均 */
        var vx = cds[0][0] + cds[1][0] + cds[2][0] + cds[3][0];
        var vy = cds[0][1] + cds[1][1] + cds[2][1] + cds[3][1];
        var vz = cds[0][2] + cds[1][2] + cds[2][2] + cds[3][2];
        var vL = Math.hypot(vx, vy, vz) || 1;
        var ctrD = [vx / vL, vy / vL, vz / vL];
        var eC = isT ? Math.max(0, th) : (esNat[0] + esNat[1] + esNat[2] + esNat[3]) * 0.25;

        /* ---- 颜色：地形原色（与地形层 surfTerrain 同一套 sphBiome，逐顶点取色 → 无缝、无方格色斑） ----
         * v157.59（老板「地面色斑严重，要求以地形原色呈现；方形/六边形地块只做边缘规划，不影响地形起伏与颜色」）：
         *   原每格 5 顶点共用一个被 97% 漂向沙色的色值 → 整片"深浅不一的沙色斑块"。
         *   现改为**每顶点按其自身方向+自然高度取 sphBiome 原色**（与 surfTerrain 完全一致），
         *   相邻格共享的角点方向相同 → 颜色相同 → 连续无界；去掉沙色漂变，露出真实地形原色
         *   （森林绿/草原黄/荒漠褐…）。角点色随方向在 _cn 缓存（只算一次）；中心色按自然平均高度取。
         *   侧壁仍走暗土剖面（v157.27），不参与原色。 */
        var cCs = [cSW.c, cSE.c, cNE.c, cNW.c];
        var eCnat = (cSW.e + cSE.e + cNE.e + cNW.e) * 0.25;
        var cC = sphBiome(eCnat, ctrD[1], ctrD) || [180, 172, 132];

        /* ---- 顶点：4 角 + 心（各取自身原色） ---- */
        var Vs = [];
        for (var k = 0; k < 4; k++) Vs.push(ptOf(cds[k], es[k]));
        var Vc = ptOf(ctrD, eC);

        var b0 = pos.length / 3;
        pos.push(Vc[0], Vc[1], Vc[2]); col.push(cC[0] / 255, cC[1] / 255, cC[2] / 255);
        for (k = 0; k < 4; k++) {
          pos.push(Vs[k][0], Vs[k][1], Vs[k][2]);
          col.push(cCs[k][0] / 255, cCs[k][1] / 255, cCs[k][2] / 255);
        }
        /* 绕序按"法向朝外"现场判定（球面各处朝向不同，写死顺序会被背面剔除） */
        for (k = 0; k < 4; k++) {
          var kn = (k + 1) % 4;
          var a3 = b0, b3 = b0 + 1 + k, c3 = b0 + 1 + kn;
          var ax = pos[b3 * 3] - pos[a3 * 3], ay = pos[b3 * 3 + 1] - pos[a3 * 3 + 1], az = pos[b3 * 3 + 2] - pos[a3 * 3 + 2];
          var bx = pos[c3 * 3] - pos[a3 * 3], by = pos[c3 * 3 + 1] - pos[a3 * 3 + 1], bz = pos[c3 * 3 + 2] - pos[a3 * 3 + 2];
          var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
          if (nx * Vc[0] + ny * Vc[1] + nz * Vc[2] < 0) idx.push(a3, c3, b3);
          else idx.push(a3, b3, c3);
        }

        /* ============================================================
         * 侧壁：4 邻逐条比，谁高谁画（每段只画一次）
         * ------------------------------------------------------------
         * v157.27（老板「泥土没有厚度」）：原来墙就是"台面 → 邻格面"一张零厚度的皮，
         * 从侧面看只有一条边、没有土层感。三处改法：
         *   ① **土层剖面**：上沿（草根/表土）深、下部（底土）更暗，顶点色竖向渐变；
         *   ② **土沿 LIP**：墙顶比台面高 8 厘米 —— 从上方看会有一圈明显的边棱，
         *      台地看起来是"被切开的土块"，不是"贴在地上的一块布"；
         *   ③ **压深 DIG**：墙底比邻格面再低 25 厘米 —— 墙插进地里，
         *      任何角度都不会看到悬空缝。
         * ============================================================ */
        var NB = [[i, j - 1], [i + 1, j], [i, j + 1], [i - 1, j]];   /* 边 k 外侧的邻格 */
        /* ⚠️ LIP/DIG 是**米**，而 es[]/e0 是**归一化高度**（×HSC 才是米）——
           直接相加会把 8 厘米变成 2 米（208 厘米的土沿，整块地会翘边）。 */
        var LIP = 0.08 / (HSC || 26), DIG = 0.25 / (HSC || 26);
        var _tc = [(cC[0] + cCs[0][0] + cCs[1][0] + cCs[2][0] + cCs[3][0]) / 5 / 255,
                   (cC[1] + cCs[0][1] + cCs[1][1] + cCs[2][1] + cCs[3][1]) / 5 / 255,
                   (cC[2] + cCs[0][2] + cCs[1][2] + cCs[2][2] + cCs[3][2]) / 5 / 255];
        var _wcTop = [_tc[0] * 0.66, _tc[1] * 0.56, _tc[2] * 0.42];      /* 上沿：草根土 */
        var _wcBot = [_tc[0] * 0.38, _tc[1] * 0.30, _tc[2] * 0.20];      /* 下部：底土 */
        for (k = 0; k < 4; k++) {
          var k2 = (k + 1) % 4;
          var nth = _terrHOfIJ(NB[k][0], NB[k][1]);
          /* 邻格在这条边上的两端高度：整平 → 它的台面；否则就是同一对格点的自然高度 */
          var e0 = (nth != null) ? Math.max(0, nth) : esNat[k];
          var e1 = (nth != null) ? Math.max(0, nth) : esNat[k2];
          if (es[k] - e0 < 0.02 && es[k2] - e1 < 0.02) continue;   /* 邻格不低 → 让邻格画 */
          /* 顶边：本格台面 + 土沿；底边：邻格面 − 压深 */
          var top0 = ptOf(cds[k], es[k] + LIP);
          var top1 = ptOf(cds[k2], es[k2] + LIP);
          var bot0 = ptOf(cds[k], Math.max(0, e0 - DIG));
          var bot1 = ptOf(cds[k2], Math.max(0, e1 - DIG));
          var qd = [top0, top1, bot1, bot0];
          var ex1 = qd[1][0] - qd[0][0], ey1 = qd[1][1] - qd[0][1], ez1 = qd[1][2] - qd[0][2];
          var ex2 = qd[2][0] - qd[0][0], ey2 = qd[2][1] - qd[0][1], ez2 = qd[2][2] - qd[0][2];
          var wnx = ey1 * ez2 - ez1 * ey2, wny = ez1 * ex2 - ex1 * ez2, wnz = ex1 * ey2 - ey1 * ex2;
          var wmx = (top0[0] + top1[0]) * 0.5, wmy = (top0[1] + top1[1]) * 0.5, wmz = (top0[2] + top1[2]) * 0.5;
          if (wnx * wmx + wny * wmy + wnz * wmz < 0) qd = [top0, bot0, bot1, top1];
          /* 顶点色：上面两个是上沿、下面两个是底土 → 竖向渐变（土层剖面） */
          var wb0 = pos.length / 3;
          pos.push(qd[0][0], qd[0][1], qd[0][2]); col.push(_wcTop[0], _wcTop[1], _wcTop[2]);
          pos.push(qd[1][0], qd[1][1], qd[1][2]); col.push(_wcTop[0], _wcTop[1], _wcTop[2]);
          pos.push(qd[2][0], qd[2][1], qd[2][2]); col.push(_wcBot[0], _wcBot[1], _wcBot[2]);
          pos.push(qd[3][0], qd[3][1], qd[3][2]); col.push(_wcBot[0], _wcBot[1], _wcBot[2]);
          idx.push(wb0, wb0 + 1, wb0 + 2, wb0, wb0 + 2, wb0 + 3);
        }

        /* ---- 描边：4 条边，按**格点编号**去重（一条边只画一次） ---- */
        var gids = [_LID(i, j), _LID(i + 1, j), _LID(i + 1, j + 1), _LID(i, j + 1)];
        for (k = 0; k < 4; k++) {
          var kk = (k + 1) % 4;
          var ga = gids[k], gb = gids[kk];
          var ek2 = (ga < gb) ? (ga * 16384 + gb) : (gb * 16384 + ga);
          if (_lineSet) { if (_lineSet.has(ek2)) continue; _lineSet.add(ek2); }
          else { if (_lineObj[ek2]) continue; _lineObj[ek2] = 1; }
          var pa = ptOf(cds[k], es[k] + LINE_LIFT);
          var pb = ptOf(cds[kk], es[kk] + LINE_LIFT);
          lp.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
        }
        cellN++;
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    var lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    return { geo: geo, lgeo: lgeo, cells: cellN, list: list };
  }

  /* ============================================================
   * v157j：**按地形撒景物**（老板：「地面地块上，能不能就地形生成一下景物，
   *         森林里有树木，草原有长草等」）
   * ------------------------------------------------------------
   * 设计取舍：
   *  · 每种景物一个 **InstancedMesh**（树干/树冠/草/芦苇/石头 = 5 个 draw call）。
   *    逐棵 Mesh 会在 469 格上产生几千个对象，光排序就够卡。
   *  · 材质用 **MeshBasicMaterial + 顶点色**，不用 Lambert：
   *    地砖本身就是 unlit 的，景物一旦吃光照，两者亮度体系会打架
   *    （而且太阳强度 3.2，会把草照成荧光绿）。明暗烘进顶点色即可。
   *  · 随机数用**按格号播种**的 LCG：同一格每次重建撒在同一个位置，
   *    否则每次落地物体会跳一遍，像在抽搐。
   *  · 只撒在平台范围内（12 环），与地砖同源，不会飘到野地上。
   * ============================================================ */
  var _SCATTER_DEF = null;
  function _scatterDefs() {
    if (_SCATTER_DEF) return _SCATTER_DEF;
    /* 顶点色：按高度从底到顶由暗到亮，制造"球体感"（unlit 材质唯一的明暗手段） */
    function paint(g, cBot, cTop) {
      var p = g.attributes.position, n = p.count;
      var col = new Float32Array(n * 3);
      var mn = Infinity, mx = -Infinity;
      for (var i = 0; i < n; i++) { var y = p.getY(i); if (y < mn) mn = y; if (y > mx) mx = y; }
      var span = (mx - mn) || 1;
      for (var j = 0; j < n; j++) {
        var k = (p.getY(j) - mn) / span;
        col[j * 3] = (cBot[0] + (cTop[0] - cBot[0]) * k) / 255;
        col[j * 3 + 1] = (cBot[1] + (cTop[1] - cBot[1]) * k) / 255;
        col[j * 3 + 2] = (cBot[2] + (cTop[2] - cBot[2]) * k) / 255;
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return g;
    }
    var trunkH = 1.0, crownH = 2.4;
    var trunk = new THREE.CylinderGeometry(0.10, 0.16, trunkH, 5, 1);
    trunk.translate(0, trunkH / 2, 0);
    paint(trunk, [86, 58, 36], [122, 88, 56]);
    var crown = new THREE.ConeGeometry(0.95, crownH, 7, 1);
    crown.translate(0, trunkH + crownH / 2, 0);
    paint(crown, [34, 78, 38], [86, 140, 74]);
    /* 草 = **两片交叉的梯形叶**（低多边形游戏的常规做法）。
       之前用 ConeGeometry 出来像"缩小版的树"：有体积、有棱，一眼就是小树苗。
       交叉片是"剪影"：侧面看有厚度、正面看是叶片，远近似草。
       需要 DoubleSide（片是单面的），材质按 key 单独给。 */
    var grass = (function () {
      var hw = 0.46, h = 0.92, tw = 0.15;
      var v = [
        -hw, 0, 0, hw, 0, 0, tw, h, 0, -tw, h, 0,
        0, 0, -hw, 0, 0, hw, 0, h, tw, 0, h, -tw
      ];
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
      g.computeVertexNormals();
      return g;
    })();
    paint(grass, [86, 116, 40], [178, 206, 96]);
    var reed = new THREE.CylinderGeometry(0.05, 0.06, 1.35, 3, 1);
    reed.translate(0, 0.675, 0);
    paint(reed, [88, 110, 52], [160, 178, 92]);
    var rock = new THREE.IcosahedronGeometry(0.34, 0);
    rock.translate(0, 0.16, 0);
    paint(rock, [96, 96, 90], [172, 170, 160]);

    /* 几何跨次重建共享 → 打标记，避免 destroySurf 反复 dispose */
    [trunk, crown, grass, reed, rock].forEach(function (g) { g._shared = true; });
    _SCATTER_DEF = {
      /* 形状 → 几何 */
      geos: { trunk: trunk, crown: crown, grass: grass, reed: reed, rock: rock },
      /* 地形类型 → 每格数量（整数部分必给，小数部分按概率多给一个） */
      plan: {
        /* 注意：crown 不在表里 —— 树冠跟随树干生成（一个树干必配一个树冠）。
           分开抽签会让两者数量对不上，屏幕上出现"有冠无干"或"光头树干"。 */
        forest:  { trunk: 2.2, grass: 2,   rock: 0.2 },
        caoyuan: { grass: 5,   trunk: 0.25 },
        plain:   { grass: 1.6, rock: 0.4 },
        desert:  { rock: 1.0 },
        hill:    { rock: 1.8,  grass: 1.2 },
        zhaoze:  { reed: 3,    grass: 1.5 }
      },
      trunkH: trunkH
    };
    return _SCATTER_DEF;
  }

  function _surfScatter(list, root) {
    if (!list || !list.length || !SP.cells) return null;
    var D = _scatterDefs();
    var Y = new THREE.Vector3(0, 1, 0);
    var up = new THREE.Vector3(), tA = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
    var p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), sv = new THREE.Vector3();
    var qt = new THREE.Quaternion(), qy = new THREE.Quaternion(), mt = new THREE.Matrix4();
    var PLIFT = (M.SURF_PLIFT == null ? 0.4 : M.SURF_PLIFT) + 0.02;
    var bags = { trunk: [], crown: [], grass: [], reed: [], rock: [] };
    var total = 0;

    for (var li = 0; li < list.length; li++) {
      var c = SP.cells[list[li]];
      if (!c || !c.pos || !c.rim || !c.nt) continue;
      var plan = D.plan[c.type];
      if (!plan) continue;                       /* lake 等：不撒 */
      /* 格内切平面基 */
      up.set(c.pos[0], c.pos[1], c.pos[2]).normalize();
      tA.set(0, 1, 0);
      if (Math.abs(up.y) > 0.99) tA.set(1, 0, 0);
      t1.crossVectors(tA, up).normalize();
      tA.copy(up);
      t2.crossVectors(tA, t1).normalize();
      var rad = Math.hypot(c.rim[0][0] - c.pos[0], c.rim[0][1] - c.pos[1], c.rim[0][2] - c.pos[2]);

      /* 按格号播种：同一格每次重建落点一致（否则每次落地景物乱跳） */
      var seed = (list[li] * 2654435761 + 12345) >>> 0;
      var rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

      for (var kind in plan) {
        var want = plan[kind];
        var cnt = Math.floor(want) + (rnd() < (want - Math.floor(want)) ? 1 : 0);
        for (var k = 0; k < cnt; k++) {
          var u = (rnd() - 0.5) * 1.7 * rad;
          var v = (rnd() - 0.5) * 1.7 * rad;
          p0.copy(up).addScaledVector(t1, u / R).addScaledVector(t2, v / R).normalize();
          var e = 0;
          try { e = groundHAt([p0.x, p0.y, p0.z]) || 0; } catch (eE) { }
          p0.multiplyScalar(R + Math.max(0, e) * HSC + PLIFT);
          qt.setFromUnitVectors(Y, up);
          qy.setFromAxisAngle(Y, rnd() * 6.2832);
          qt.multiply(qy);
          var sc = 0.78 + rnd() * 0.55;
          sv.set(sc, sc, sc);
          mt.compose(p0, qt, sv);
          bags[kind].push(mt.clone());
          total++;
          if (kind === 'trunk') {
            /* 树冠：**位置与树干相同**，不要再沿法线抬高。
               crown 几何本身已经 translate 到 trunkH 之上，再抬一次就会
               浮在半空 —— 屏幕上就是"光头树干 + 天上一个绿锥"（截图确认过）。
               缩放会同时带上几何里的偏移，所以两者天然对齐。 */
            bags.crown.push(mt.clone());
            total++;
          }
        }
        /* 草丛是"一簇"：同格多给几根细草，避免孤零零一根 */
      }
    }

    var meshes = [];
    for (var key in bags) {
      var arr = bags[key];
      if (!arr.length) continue;
      var mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        /* 草是交叉片，必须双面；其它是实体块，单面更省。 */
        side: (key === 'grass') ? THREE.DoubleSide : THREE.FrontSide
      });
      /* 只有草吃风（老板：「小草固定模型，读取风力图」）——树保持绝对静止 */
      if (key === 'grass') _applyGrassWind(mat);
      var im = new THREE.InstancedMesh(D.geos[key], mat, arr.length);
      im.name = 'surfScatter_' + key;
      for (var i2 = 0; i2 < arr.length; i2++) im.setMatrixAt(i2, arr[i2]);
      im.instanceMatrix.needsUpdate = true;
      /* 实例散布在整个球面片区上，默认包围球只按几何算 → 会被整体剔除。
         直接关掉视锥剔除（与城镇 InstancedMesh 同一处理）。 */
      im.frustumCulled = false;
      im.renderOrder = 5;
      root.add(im);
      meshes.push(im);
    }
    return { meshes: meshes, count: total };
  }

  /* ============================================================
   * v157l：**风过草原**（老板：「如何形成随机风力图，小草固定模型，
   *         读取风力图，一次提交计算多次」）
   * ------------------------------------------------------------
   * 做法就是 GPU 顶点动画，模型本身**一个顶点都不改**：
   *   · 风场是程序化的，不占纹理 —— 顶点着色器里用 3 个不同频率的正弦叠加
   *     + 1 个空间包络（`_wFr`），一次 draw call 里几千根草各自算各自的相位；
   *   · 相位源用**实例世界坐标** dotted with 风向，所以风是"从一侧扫过去"的波，
   *     不是所有草一起抽搐；
   *   · 强度权重按草高平方（根部纹丝不动、叶尖最活），顺带压低一点高度，
   *     视觉上像被风压弯；
   *   · 风向在**每个草自己切平面**上的投影（`_wAx/_wAz` 转成局部分量），
   *     这样球面上任何位置的风都沿地表刮，不会在极地附近失效。
   *
   * 为什么不用 ShaderMaterial 重写：Basic 材质已经处理了 instancing /
   * vertexColors / 深度，重写等于把这些再实现一遍；`onBeforeCompile`
   * 只往 `<begin_vertex>` 后面插一段就够了。
   * ============================================================ */
  var _windU = {
    uWindTime: { value: 0 },
    uWindDir: { value: new THREE.Vector3(0.85, 0, 0.53).normalize() },
    uWindAmp: { value: 1 }
  };
  M.WIND_GAIN = 1.45;                    /* 摆幅总倍率：1.0 时草只偏 0.6 米，风感偏弱 */
  M._wind = _windU;                      /* 暴露给探针/自检 */
  function _applyGrassWind(mat) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uWindTime = _windU.uWindTime;
      sh.uniforms.uWindDir = _windU.uWindDir;
      sh.uniforms.uWindAmp = _windU.uWindAmp;
      sh.vertexShader =
        'uniform float uWindTime;\nuniform vec3 uWindDir;\nuniform float uWindAmp;\n' +
        sh.vertexShader;
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        '#ifdef USE_INSTANCING',
        /* 高度权重：根部 0（不动），叶尖 1（最活）；平方让弯曲更自然 */
        '  float _wH = clamp(transformed.y / 0.92, 0.0, 1.0);',
        '  _wH = _wH * _wH;',
        /* 实例世界位置 → 相位源（同一片草相位相近，整片像波浪） */
        '  vec3 _wP = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);',
        '  float _wPh = uWindTime * 1.7 + dot(_wP, vec3(0.57, 0.31, 0.57));',
        /* 三个倍频正弦叠加 = 阵风里的小抖动（"一次提交里算多次"就是这里） */
        '  float _wSw = sin(_wPh) * 0.62 + sin(_wPh * 2.3 + 1.7) * 0.26 + sin(_wPh * 4.7 + 0.4) * 0.12;',
        /* 大尺度包络：风头从一侧扫过草原，一波一波 */
        '  float _wFr = 0.52 + 0.48 * sin(dot(_wP, uWindDir) * 0.075 - uWindTime * 0.55);',
        '  float _wA = uWindAmp * _wFr * _wH;',
        /* 风向量转到这根草自己的切平面（世界风向 → 局部 xz 系数） */
        '  vec3 _wAx = normalize(instanceMatrix[0].xyz);',
        '  vec3 _wAz = normalize(instanceMatrix[2].xyz);',
        '  vec2 _wL = vec2(dot(_wAx, uWindDir), dot(_wAz, uWindDir));',
        '  float _wLn = length(_wL);',
        '  _wL = _wLn > 0.0001 ? _wL / _wLn : vec2(0.0);',
        '  transformed.xz += _wL * (_wSw * _wA);',
        '  transformed.y -= abs(_wSw) * _wA * 0.10;',   /* 被风压弯 */
        '#endif'
      ].join('\n'));
    };
    mat.customProgramCacheKey = function () { return 'grassWind_v1'; };
  }
  /* 每帧更新：时间轴 + 阵风强度 + 风向缓慢偏转（约 140 秒一圈） */
  function _updateWind() {
    if (M._windFreeze) return;            /* 探针取证用：冻结风场，手动喂时间 */
    var t = Date.now() * 0.001;
    _windU.uWindTime.value = t;
    var g = 0.66 + 0.34 * Math.sin(t * 0.37) * Math.sin(t * 0.131 + 1.1);
    _windU.uWindAmp.value = Math.max(0.18, g) * (M.WIND_GAIN == null ? 1 : M.WIND_GAIN);
    var a = 0.6 + Math.sin(t * 0.045) * 1.35;
    _windU.uWindDir.value.set(Math.cos(a), 0, Math.sin(a)).normalize();
  }

  /* ============================================================
   * v157o：**方形建造网格** —— 滚动锚 + 平行移动
   *          （老板：「那还是正方形持续适配好一点」）
   * ------------------------------------------------------------
   * 上一版的致命缺陷：基向量取自**当前中心格** `cells[ci0].pos`。
   * 人一走、地表层一重建，整套方格的朝向就跟着变一点 ——
   * 建筑一旦按格子坐标存档，走两步就全错位。这不是手感问题，是坐标不成立。
   *
   * 现在坐标由**世界方向唯一决定**：
   *   · 锚 A = 一个世界方向 + 切平面基 (t1,t2)，只在一处建立；
   *   · 球面点 p ↔ 弧长坐标 (u,v) 走**指数映射**（正反两侧同一个公式，自洽）；
   *   · 格子编号 (i,j) = round(u/CELL), round(v/CELL) —— 与相机无关。
   *
   * "持续适配"怎么做到（关键）：
   *   离锚超过 GRID_ANCHOR_MAX（60 米）就**重锚**，但重锚点必须落在整数格点上，
   *   切向量用**平行移动**（沿大圆搬，不引入 roll）——
   *   于是新锚就是旧坐标的一个格点，编号连续、方格也不转。
   *   平时窗口只随中心平移，不动锚。
   *
   * 为什么不能"一个锚吃全球"：R=300，走 100 米 = 19° 弧，格子拉伸 5.8%;
   * 200 米 = 27%，方块会变成菱形。滚动锚把误差关在 60 米（1.4%）以内。
   *
   * 为什么不能用经纬网格：经线在高纬收敛，格子越靠近极地越窄（戴森球计划
   * 也是这个病，所以玩家把工厂全堆在赤道）。这里用切平面锚，局部处处等距。
   *
   * 开关：M.BUILD_GRID = false 回退到纯六边形；M.BUILD_MODE = 'inset' 看另一方案。
   * ============================================================ */
  /* ============================================================
   * v157v（老板：「应该区分战略模式和建造模式」）
   * ------------------------------------------------------------
   * 两个模式的**职责边界**（不是换皮，是换坐标系）：
   *   战略模式：大地图。六边形地块承载领地/迷雾/资源/城市/行军。
   *             悬停读的是 **ci**（六边形格），显示的是地块情报。
   *   建造模式：落地施工。只认**四边形建造格 (i,j)** ——
   *             不悬停六边形、不读地块情报、不显示六边形示意。
   *
   * 为什么必须分开：两套格子的语义完全不同（5.25 米战略 / 2 米战术），
   * 混在一起就会"悬停显示的是六边形情报、但你在看方格"。
   * 老板原话：「根本来说不再捡取六边形地块数据，而改识别四边形地块数据」。
   * ============================================================ */
  M.MODE_STRATEGY = 'strategy';
  M.MODE_BUILD = 'build';
  M.mode = M.MODE_STRATEGY;

  M.BUILD_GRID = true;
  M.BUILD_MODE = 'grid';
  /* v157.56（老板「线条太杂，不要边线了」）+ v158.15（连悬停亮色一起退）：
     地表常驻线总开关。false = 不画方形建造网格(surfBuildGrid) 与 六边形平台边线(surfPlateLine)，
     地表只剩地形本身（悬停高亮已于 v158.15 整条退役，见 2367 行墓碑）。
     要回退「极淡网格」置 true。 */
  M.SURF_LINES = false;
  /* v157.56（老板「线条太杂，不要边线」）：太空六边形线框总开关。false = 彻底隐藏 tiles 星球线框
     （地表本就隐藏）；区划边界是独立图层（见 v157p 注释），不受影响。置 true 才显示（峰值 0.16 极淡）。 */
  M.TILE_LINES = false;
  M.BUILD_CELL = 2.0;                    /* 建造格边长（米） */
  M.BUILD_N = 40;                        /* 每边格数：40×2=80 米，边界推出视野 */
  /* 锚漂移上限（米）。实测：阈值 60 + 离散检查（玩家一格一格走，不会正好踩在 60）
     实际跨度会到 80 米 → 切向偏 15°，重锚边界两侧的"北"方向差出一个肉眼可辨的角度。
     收到 45 → 实测跨度 60 米以内，偏差 ≈ 8.6°。重锚频一点无所谓（只在重建时判断）。 */
  M.GRID_ANCHOR_MAX = 45;

  var _gridAnchor = null;                /* { dir, t1, t2 } */
  /* 重锚会让**局部**坐标整体平移（新锚的 (0,0) 落在旧坐标的某个格点上）。
     如果建筑存档直接存局部 (i,j)，走 60 米后同一个世界点的编号就变了 ——
     所以维护一份**全局偏移**，对外编号一律 = 局部 + 偏移。
     这是"持续适配"能成立的前提：编号在世界范围内唯一、不随锚移动。 */
  var _gridOrigin = { i: 0, j: 0 };

  function _gClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* 首次建锚：北极取世界 y 轴（球体建模基准），t1 = 东，t2 = 北 */
  function _gridAnchorMake(d) {
    var ref = new THREE.Vector3(0, 1, 0);
    if (Math.abs(d.y) > 0.985) ref.set(0, 0, 1);   /* 极地附近换参考轴，避免退化 */
    var t1 = new THREE.Vector3().crossVectors(ref, d).normalize();
    var t2 = new THREE.Vector3().crossVectors(d, t1).normalize();
    return { dir: d.clone(), t1: t1, t2: t2 };
  }

  /* 平行移动：把切向量 v 从 from 沿大圆搬到 to。
     标准式 t' = t − ⟨t,to⟩/(1+⟨from,to⟩) · (from+to)
     保长、保角、不引入 roll —— 所以重锚后方格不会"歪一点"。 */
  function _gridTransport(v, from, to) {
    var k = _gClamp(from.dot(to), -1, 1);
    if (k > 0.999999) return v.clone();
    var w = new THREE.Vector3().addVectors(from, to).multiplyScalar(v.dot(to) / (1 + k));
    return v.clone().sub(w).normalize();
  }

  /* 球面方向 → 弧长坐标（米） */
  function _gridUVOf(d, A) {
    var c = _gClamp(d.dot(A.dir), -1, 1);
    var th = Math.acos(c);
    if (th < 1e-9) return [0, 0];
    var perp = new THREE.Vector3().subVectors(d, A.dir.clone().multiplyScalar(c));
    if (perp.lengthSq() < 1e-16) return [0, 0];
    perp.normalize();
    var arc = th * R;
    return [arc * perp.dot(A.t1), arc * perp.dot(A.t2)];
  }

  /* 弧长坐标 → 球面方向（与 _gridUVOf 严格互逆） */
  function _gridDirOf(u, v, A) {
    var len = Math.hypot(u, v);
    if (len < 1e-9) return A.dir.clone();
    var th = len / R;
    var s = A.t1.clone().multiplyScalar(u / len).add(A.t2.clone().multiplyScalar(v / len));
    return A.dir.clone().multiplyScalar(Math.cos(th)).add(s.multiplyScalar(Math.sin(th))).normalize();
  }

  /* 取锚：漂移超限就沿整数格点重锚（编号连续） */
  function _gridAnchorFor(dir) {
    var d = new THREE.Vector3(dir[0], dir[1], dir[2]);
    if (d.lengthSq() < 1e-12) d.set(0, 1, 0);
    d.normalize();
    if (!_gridAnchor) { _gridAnchor = _gridAnchorMake(d); return _gridAnchor; }
    var A = _gridAnchor;
    var drift = Math.acos(_gClamp(A.dir.dot(d), -1, 1)) * R;
    if (drift <= M.GRID_ANCHOR_MAX) return A;

    /* 重锚：把当前中心吸附到最近的**整数格点**，再平行移动切向量。
       吸附这一步是编号连续的关键 —— 新锚就是旧坐标的 (i,j) 交点。 */
    var uv = _gridUVOf(d, A), CELL = M.BUILD_CELL;
    var si = Math.round(uv[0] / CELL), sj = Math.round(uv[1] / CELL);
    var dSnap = _gridDirOf(si * CELL, sj * CELL, A);
    /* 新锚 = 旧坐标的 (si,sj) → 全局偏移加这么多，对外编号才连续 */
    _gridOrigin.i += si; _gridOrigin.j += sj;
    var t1 = _gridTransport(A.t1, A.dir, dSnap);
    /* 数值正交化（平行移动理论上已垂直，防浮点漂） */
    t1.sub(dSnap.clone().multiplyScalar(t1.dot(dSnap))).normalize();
    var t2 = new THREE.Vector3().crossVectors(dSnap, t1).normalize();
    _gridAnchor = { dir: dSnap, t1: t1, t2: t2 };
    M._gridReanchors = (M._gridReanchors || 0) + 1;
    return _gridAnchor;
  }

  /* 探针/自检用：世界方向 → 格子编号（负数也合法，球面是个闭环） */
  M.gridCellOf = function (p) {
    var A = _gridAnchor;
    if (!A || !p) return null;
    var d = new THREE.Vector3(p[0], p[1], p[2]);
    if (d.lengthSq() < 1e-12) return null;
    var uv = _gridUVOf(d.normalize(), A), CELL = M.BUILD_CELL;
    /* 对外编号含全局偏移 —— 重锚前后同一个世界点得到同一个 (i,j) */
    return { i: Math.round(uv[0] / CELL) + _gridOrigin.i,
             j: Math.round(uv[1] / CELL) + _gridOrigin.j,
             u: +(uv[0] + _gridOrigin.i * CELL).toFixed(3),
             v: +(uv[1] + _gridOrigin.j * CELL).toFixed(3), cell: CELL };
  };
  M.gridInfo = function () {
    var A = _gridAnchor;
    if (!A) return null;
    return {
      dir: [+A.dir.x.toFixed(6), +A.dir.y.toFixed(6), +A.dir.z.toFixed(6)],
      t1: [+A.t1.x.toFixed(6), +A.t1.y.toFixed(6), +A.t1.z.toFixed(6)],
      reanchors: M._gridReanchors || 0, mode: M.BUILD_MODE, cell: M.BUILD_CELL,
      origin: { i: _gridOrigin.i, j: _gridOrigin.j }
    };
  };
  /* ============================================================
   * 方形网格自检（v157o）
   * ------------------------------------------------------------
   * 只查三件会真正毁掉存档的事，每件都带**下限**（空数据不能"没有异常"）：
   *   ① 往返自洽：格子号 → 世界方向 → 格子号，必须原样回来
   *   ② 编号稳定：走过一段路，**起点**的格子号不许漂
   *   ③ 真的在适配：必须发生过重锚（reanchors ≥ 1），否则"没动过"也能全绿
   * ============================================================ */
  M.gridSelfCheck = function () {
    var out = { fails: [], metrics: {} };
    try {
      if (!SP || !SP.cells || !SP.cells.length) { out.fails.push('G0/无球面数据'); out.ok = false; return out; }
      var wasSurf = M._surf;
      var c0 = SP.cells[0];
      if (!c0 || !c0.dir) { out.fails.push('G0/首格无方向'); out.ok = false; return out; }
      var d0 = c0.dir.slice();
      var keepDist = camO.dist;
      camO.dist = R + 20 + 14; camO.quat = null; camO._euler = null; _syncZoom();
      M.lookAtDir(d0);
      M.rebuildSurf(d0);

      var ci = M.gridCellOf(d0);
      if (!ci) { out.fails.push('G1/无锚：gridCellOf 为空'); out.ok = false; return out; }
      out.metrics.start = [ci.i, ci.j];

      /* ① 往返自洽（4 组，含负号） */
      var rtBad = 0;
      var probes = [[ci.i, ci.j], [ci.i + 7, ci.j - 3], [ci.i - 12, ci.j + 15], [ci.i + 21, ci.j + 21]];
      for (var q = 0; q < probes.length; q++) {
        var dd = M.gridCellDir(probes[q][0], probes[q][1]);
        var cc = dd ? M.gridCellOf(dd) : null;
        if (!cc || cc.i !== probes[q][0] || cc.j !== probes[q][1]) rtBad++;
      }
      out.metrics.roundTripBad = rtBad;
      if (rtBad > 0) out.fails.push('G1/往返不自洽: ' + rtBad + '/4 组回不来（下限 0）');

      /* ② 走 120 米（6 段 × 20 米），起点编号不许漂 */
      var re0 = (M._gridReanchors || 0);
      var cur = ci;
      for (var k = 0; k < 6; k++) {
        var nd = M.gridCellDir(cur.i + 10, cur.j);
        if (!nd) { out.fails.push('G2/方向为空 @段' + k); break; }
        M.lookAtDir(nd);
        M.rebuildSurf(nd);
        cur = M.gridCellOf(nd) || cur;
      }
      var still = M.gridCellOf(d0);
      var dI = still ? (still.i - ci.i) : 999, dJ = still ? (still.j - ci.j) : 999;
      out.metrics.startDrift = [dI, dJ];
      out.metrics.reanchors = (M._gridReanchors || 0) - re0;
      if (Math.abs(dI) > 0 || Math.abs(dJ) > 0) {
        out.fails.push('G2/编号漂移: 走 120 米后起点变了 Δ(' + dI + ',' + dJ + ')（下限 |Δ|=0）');
      }
      /* ③ 必须真的重锚过 —— 120 米 > 45 米阈值，至少 2 次 */
      if (out.metrics.reanchors < 1) {
        out.fails.push('G3/没重锚: 走 120 米 reanchors=' + out.metrics.reanchors + '（下限 1）— 网格没在"持续适配"');
      }

      camO.dist = keepDist; camO.quat = null; camO._euler = null; _syncZoom();
      try { if (wasSurf) M.surfaceMode(false); } catch (e2) { }
    } catch (e) {
      out.fails.push('G0/异常: ' + (e && e.message));
    }
    out.ok = out.fails.length === 0;
    return out;
  };

  /* 世界点 → 该格中心的球面方向（放置建筑用：格心不一定在相机方向） */
  M.gridCellDir = function (i, j) {
    var A = _gridAnchor;
    if (!A) return null;
    var d = _gridDirOf((i - _gridOrigin.i) * M.BUILD_CELL,
                       (j - _gridOrigin.j) * M.BUILD_CELL, A);
    return [d.x, d.y, d.z];
  };

  function _surfBuildGrid(ci0, dir) {
    var c0 = SP.cells && SP.cells[ci0];
    if (!c0 || !c0.pos) return null;
    var center = (dir && dir.length === 3) ? dir : c0.dir || c0.pos;
    var A = _gridAnchorFor(center);

    var CELL = M.BUILD_CELL, N = M.BUILD_N, half = CELL * N * 0.5;
    var LIFT = (M.SURF_PLIFT == null ? 0.4 : M.SURF_PLIFT) + 0.07;
    var SEG = 20;                       /* 每条线分 20 段，足够贴合球面 */
    var pos = [];
    var P = new THREE.Vector3();

    var project = function (u, v) {
      P.copy(_gridDirOf(u, v, A));
      var e = 0;
      try { e = groundHAt([P.x, P.y, P.z]) || 0; } catch (err) { }
      P.multiplyScalar(R + e * HSC + LIFT);
      return P;
    };

    /* 窗口中心 = 当前视线的格坐标（**量化到格**，所以窗口平移是整格跳，
       镜头移动时方格纹路不会"爬"）。 */
    var dc = new THREE.Vector3(center[0], center[1], center[2]).normalize();
    var uvc = _gridUVOf(dc, A);
    var i0 = Math.round(uvc[0] / CELL), j0 = Math.round(uvc[1] / CELL);
    var M2 = Math.round(N / 2);

    var addLine = function (fixed, axis) {
      var prev = null;
      for (var s = 0; s <= SEG; s++) {
        var t = (axis === 0) ? (j0 - M2 + N * (s / SEG)) * CELL
                             : (i0 - M2 + N * (s / SEG)) * CELL;
        var pt = (axis === 0) ? project(fixed, t) : project(t, fixed);
        if (prev) pos.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z);
        prev = pt.clone();
      }
    };
    for (var k = -M2; k <= M2; k++) {
      addLine((i0 + k) * CELL, 0);      /* u 固定 → 沿 t2 走 */
      addLine((j0 + k) * CELL, 1);      /* v 固定 → 沿 t1 走 */
    }
    /* 边缘淡出：线色从深绿渐变到地面色，让网格"融进地里"而不是硬切一刀。
       LineBasicMaterial 不支持顶点 alpha，所以用**颜色**模拟。
       参考点用**当前中心 dc**，不能用锚 —— 锚可能已漂到 60 米外。 */
    var col = [];
    var GROUND = [0xd8, 0xc8, 0x8a], INK = [0x1c, 0x2a, 0x12];
    var fadeR = half * 1.02;
    for (var vi = 0; vi < pos.length / 3; vi++) {
      var px = pos[vi * 3], py = pos[vi * 3 + 1], pz = pos[vi * 3 + 2];
      var rr = Math.hypot(px, py, pz) || 1;
      var dotc = (px * dc.x + py * dc.y + pz * dc.z) / rr;
      var arc = Math.acos(_gClamp(dotc, -1, 1)) * R;
      var kk = arc / fadeR;
      kk = _gClamp((kk - 0.45) / 0.55, 0, 1);
      kk = kk * kk * (3 - 2 * kk);                 /* smoothstep */
      col.push(
        (INK[0] + (GROUND[0] - INK[0]) * kk) / 255,
        (INK[1] + (GROUND[1] - INK[1]) * kk) / 255,
        (INK[2] + (GROUND[2] - INK[2]) * kk) / 255
      );
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    var m = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.52,
      depthWrite: false, polygonOffset: true,
      polygonOffsetFactor: -6, polygonOffsetUnits: -12
    });
    var mesh = new THREE.LineSegments(g, m);
    mesh.name = 'surfBuildGrid';
    mesh.renderOrder = 6;
    return mesh;
  }

  /* ------------------------------------------------------------
   * 'inset' 模式：每个六边形里嵌一个正方形
   * 正方形内接于六边形的**内切圆**（半径 = 格宽/2 × cos30° = 1.559），
   * 所以边长 = 1.559 × √2 ≈ 2.20 米，四角正好顶到六边形的边中点，
   * 剩下六个角是"地皮/缝"，可以当道路或留白。
   * 代价：每格朝向不同，跨格的 2×2 建筑对不齐 —— 这个模式只能 1 格 1 建筑。
   * ------------------------------------------------------------ */
  function _surfInsetGeo(list) {
    if (!list || !list.length) return null;
    var pos = [];
    var up = new THREE.Vector3(), tA = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
    var P = new THREE.Vector3();
    var LIFT = (M.SURF_PLIFT == null ? 0.4 : M.SURF_PLIFT) + 0.07;
    var HALF = 1.10;                    /* 2.20 / 2 */
    var SEG = 4;

    for (var i = 0; i < list.length; i++) {
      var c = SP.cells[list[i]];
      if (!c || !c.pos || c.type === 'lake') continue;
      up.set(c.pos[0], c.pos[1], c.pos[2]).normalize();
      tA.set(0, 1, 0);
      if (Math.abs(up.y) > 0.985) tA.set(1, 0, 0);
      t1.crossVectors(tA, up).normalize();
      tA.copy(up);
      t2.crossVectors(tA, t1).normalize();

      var proj = function (u, v) {
        P.copy(up).addScaledVector(t1, u / R).addScaledVector(t2, v / R).normalize();
        var e = 0;
        try { e = groundHAt([P.x, P.y, P.z]) || 0; } catch (err) { }
        P.multiplyScalar(R + e * HSC + LIFT);
        return P.clone();
      };
      var cs = [proj(-HALF, -HALF), proj(HALF, -HALF), proj(HALF, HALF), proj(-HALF, HALF)];
      for (var e2 = 0; e2 < 4; e2++) {
        var a2v = cs[e2], b2v = cs[(e2 + 1) % 4];
        var prev = a2v;
        for (var sg = 1; sg <= SEG; sg++) {
          var t = sg / SEG;
          P.copy(a2v).lerp(b2v, t).normalize();
          var ee = 0;
          try { ee = groundHAt([P.x, P.y, P.z]) || 0; } catch (err2) { }
          P.multiplyScalar(R + Math.max(0, ee) * HSC + LIFT);
          pos.push(prev.x, prev.y, prev.z, P.x, P.y, P.z);
          prev = P.clone();
        }
      }
    }
    if (!pos.length) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    var m = new THREE.LineBasicMaterial({
      color: 0x1c2a12, transparent: true, opacity: 0.55,
      depthWrite: false, polygonOffset: true,
      polygonOffsetFactor: -6, polygonOffsetUnits: -12
    });
    var mesh = new THREE.LineSegments(g, m);
    mesh.name = 'surfBuildGrid';
    mesh.renderOrder = 6;
    return mesh;
  }

  function rebuildSurf(dir) {
    if (!scene || !SP || !SP.cells || !SP.cells.length) return false;
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    destroySurf();
    var n = _sUnit(dir || [0, 1, 0]);
    var B = _sBasis(n), t1 = B[0], t2 = B[1];
    var ci0 = SP.nearestCell ? SP.nearestCell(n) : 0;
    if (ci0 < 0) ci0 = 0;

    var root = new THREE.Group();
    root.name = 'surfaceLayer';

    /* ① 地形 */
    /* 平台（12 环 ≈ 43 米）范围内挖空，地形层从 43 米外才开始 */
    var _innerR = (M.SURF_RINGS || 12) * 3.59 + 1.0;
    var _tt0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var tg = _surfTerrainGeo(n, t1, t2, _innerR);
    var tmat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide });
    try { applyTerminator(tmat); } catch (e) { }
    try {
      /* v157.89e：地表也用**域扭曲 + 互质格**的 512² 颗粒图。
         原用 384² 的 8/16/32 规整格噪声 → 贴地视角看到同一团纹样按固定间距重复（老板「还是有规律斑纹」）。
         颜色模式必须走 0.74~1.0 区间，否则地表整体变暗。*/
      var dt = makeGrainTex('c'); dt.repeat.set(28, 28);
      tmat.map = dt; tmat.needsUpdate = true;
    } catch (e) { }
    var terr = new THREE.Mesh(tg, tmat);
    terr.name = 'surfTerrain';
    terr.renderOrder = 1;
    root.add(terr);

    /* ② 地块平台（台面 + 裙边）+ 描边 */
    var _tt1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var pg = _surfPlateGeo(ci0);
    var _tt2 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var pmat = new THREE.MeshBasicMaterial({
      /* 不透明：平台就是"地"，没有透明需求。透明会引入排序问题
         （半透明的平台与描边互相穿插，格子边界会闪）。 */
      vertexColors: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4
    });
    var plate = new THREE.Mesh(pg.geo, pmat);
    plate.name = 'surfPlate';
    plate.renderOrder = 3;
    root.add(plate);
    /* 建造网格开启时，六边形线退到背景（0.38 → 0.14）：
       两套网格同权重叠在一起谁也读不出（实测截图一团乱线）。 */
    var lmat = new THREE.LineBasicMaterial({
      color: 0x14180f, transparent: true, depthWrite: false,
      /* v157t：方格在场时六边形描边**完全退场**（0.14 → 0）。地表已经有方格做坐标，
         六边形的边在近景只会斜穿画面、跟方格打架（实测还剩几条斜线很扎眼）。
         v157.56：受 SURF_LINES 管控 —— 关掉后两套常驻线（方格/六边形）一起熄灭。 */
      opacity: (M.SURF_LINES && !M.BUILD_GRID) ? 0.38 : 0.0,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8
    });
    var plateLine = new THREE.LineSegments(pg.lgeo, lmat);
    plateLine.name = 'surfPlateLine';
    plateLine.renderOrder = 4;
    root.add(plateLine);

    /* ③ 景物：按地形类型撒树/草/芦苇/石（与地砖同源，只铺在平台范围内） */
    var scat = null;
    try { scat = _surfScatter(pg.list, root); } catch (eS) { scat = null; }
    M._surfScat = scat;                     /* v158.48：分档缩略（先树后草石）用 */
    var _tt3 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    /* ④ 方形建造网格（实验层，M.BUILD_GRID=false 即回退到纯六边形；
        v157.56：再受 SURF_LINES 管控 —— 关掉后不画） */
    var bgrid = null;
    if (M.SURF_LINES && M.BUILD_GRID) {
      try {
        bgrid = (M.BUILD_MODE === 'inset')
          ? _surfInsetGeo(pg.list)
          : _surfBuildGrid(ci0, n);      /* 传已归一化的 n，dir 可能为 null */
      } catch (eB) { bgrid = null; }
    }
    if (bgrid) root.add(bgrid);

    scene.add(root);
    var t1ms = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    SR = { root: root, dir: n, ci: ci0, terr: terr, plate: plate, plateLine: plateLine,
           scatter: scat, builtMs: +(t1ms - t0).toFixed(1), verts: tg.attributes.position.count, cells: pg.cells,
           /* v157.18：分段耗时 —— 卡顿到底是谁造成的，先量再改 */
           timing: { terr: +(_tt1 - _tt0).toFixed(1), plate: +(_tt2 - _tt1).toFixed(1),
                     scatter: +(_tt3 - _tt2).toFixed(1), gridAndAdd: +(t1ms - _tt3).toFixed(1) } };
    M._sr = SR;
    /* v157.47：格锚随相机中心格变 → 地标的 (i,j) 全部作废，必须强制重算。 */
    try { buildLandmarks(true); } catch (eL0) { }
    return true;
  }
  /* ============================================================
   * 【墓碑】v158.15：地表格子悬停高亮（surfHighlight）整条退役
   * ------------------------------------------------------------
   * 老板 2026-11-25「六边形地块有点有点碍事儿了，就作为一个可操作项来看」→ 拍板「近地面全退」。
   * 退役前形态：地表模式鼠标一动，就在指着的那一格铺一个**整格六边形**
   *   （填充 #9fe8ff 透明度 0.20 + 亮边 #bdf2ff 0.95；边线 depthTest:false → 无视地形遮挡）。
   * 实机取证（v158.15 探针）：格径 ≈3.6 米、跟随相机在身后 6 米 →
   *   脚下整片草地被染青、占屏宽约 90%，且**不输出任何文字**
   *   （为了它把近地面的地块简报也 tipHide 掉了）= 纯装饰、零信息、还长得像"选中框"。
   * 历史（同一件事被判了三次）：v157.37 老板「近地面不应该再出现六边形地块的操作」→ 删；
   *   v157.56「只留悬停亮色」→ 恢复；v158.15 第二次判定碍事 → 整条退场。
   * 退役范围：M.surfHighlight / _surfHiBuild / _surfHiAt / surfHi / surfHiCi / surfHiSel
   *   / M._hiCi 全部删除。**不留可调开关** —— 要复活必须重写，不许留半套。
   * 现在近地面"我在哪一格"由地砖本身表达，"能交互什么"由底栏 E 提示表达；
   *   建造模式仍走四边形 gridHighlight（v157.12 老板拍板的另一套坐标语言，不受影响）。
   * ============================================================ */

  /* ============================================================
   * v157v：**四边形拾取**（建造模式唯一入口）
   * ------------------------------------------------------------
   * 老板：「不再捡取六边形地块数据，而改识别四边形地块数据」。
   * 所以这里**完全不碰 ci**：射线打真实地面 → 世界点 → 弧长坐标 → (i,j)。
   * 战略模式仍走 `pickCiByRay`（六边形），两条路互不干扰。
   * ============================================================ */
  M.pickGroundPoint = function (rc) {
    if (!rc) return null;
    /* 地表模式打地砖/地形本身（所见即所中）；轨道退到光滑球 */
    if (M._surf && SR) {
      if (SR.plate) {
        var h1 = rc.intersectObject(SR.plate, false);
        if (h1.length) return h1[0].point;
      }
      if (SR.terr) {
        var h2 = rc.intersectObject(SR.terr, false);
        if (h2.length) return h2[0].point;
      }
    }
    if (!M._collider) return null;
    var h3 = rc.intersectObject(M._collider, false);
    return h3.length ? h3[0].point : null;
  };

  /* ============================================================
   * v158.39（老板「戴森球计划那种建造」）：放置/取消的唯一出口
   * ------------------------------------------------------------
   * 旧版只有"点一下落一件"，按住左键拖过去一件都不放；右键还会继续转镜头，
   * 没有"放下手上的东西"这个成熟建造游戏的本能操作。
   * 现在点击、拖铺、拾取都走 placeAtPoint；取消统一走 cancelHeldBuild。
   * ============================================================ */
  M._placeDrag = false;
  M._placeLastIJ = null;
  M.placeAtPoint = function (pt, opt) {
    opt = opt || {};
    if (!pt || !GAME.place || !GAME.ui || !GAME.ui._placeItem) return { ok: false, msg: '手上没有可放的东西' };
    var _gP = M.gridAt(pt);
    if (!_gP) return { ok: false, msg: '这里没有可建的方格' };
    if (opt.dedupe && M._placeLastIJ && M._placeLastIJ[0] === _gP.i && M._placeLastIJ[1] === _gP.j) {
      return { ok: true, skipped: true, rec: null };
    }
    var _itP = GAME.place.item(GAME.ui._placeItem);
    var _rP = GAME.place.add(_gP.i, _gP.j, GAME.ui._placeItem, { yaw: M.PLACE_YAW || 0 });
    if (_rP && _rP.ok) M._placeLastIJ = [_gP.i, _gP.j];
    M._ghostCi = -1; M._ghostIJ = null;
    if (!opt.silent && GAME.ui.toast) {
      GAME.ui.toast(_rP && _rP.ok
        ? ('已放下：' + (_itP ? _itP.name : GAME.ui._placeItem))
        : ('⚠ ' + ((_rP && _rP.msg) || '放置失败')));
    }
    return _rP;
  };
  M.cancelHeldBuild = function () {
    var ui = GAME.ui;
    if (!ui) return;
    ui._placeItem = null;
    ui._plantTool = false;
    ui._plantId = '';                       /* v158.43：手持建筑 id 一并清 */
    M._placeDrag = false;
    M._placeLastIJ = null;
    if (M.clearGhost) { M.clearGhost(); M._ghostCi = -1; M._ghostIJ = null; }
    if (M.gridHighlight) M.gridHighlight(null);
    if (ui.renderBuildBar) ui.renderBuildBar('item');
  };

  /* 世界点 → 建造格 (i,j)。没锚就返回 null（未进过地表时正常） */
  M.gridCellAt = function (p) {
    if (!p) return null;
    var g = M.gridCellOf([p.x != null ? p.x : p[0], p.y != null ? p.y : p[1], p.z != null ? p.z : p[2]]);
    if (!g) return null;
    return { i: g.i, j: g.j, key: g.i + ',' + g.j };
  };

  /* 四边形高亮：4 个角直接由 _gridDirOf 给出（与网格同一套锚，绝不偏） */
  var gridHi = null, gridHiKey = '';
  function _gridHiBuild(i, j, isSel) {
    var A = _gridAnchor;
    if (!A) return false;
    if (gridHi) {
      scene.remove(gridHi);
      gridHi.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      gridHi = null;
    }
    var CELL = M.BUILD_CELL;
    var lift = (M.SURF_PLIFT == null ? 0.4 : M.SURF_PLIFT) + 0.12;
    var at = function (u, v) {
      var d = _gridDirOf(u * CELL, v * CELL, A);
      var e = 0;
      try { e = groundHAt([d.x, d.y, d.z]) || 0; } catch (err) { }
      var rr = R + e * HSC + lift;
      return [d.x * rr, d.y * rr, d.z * rr];
    };
    /* 格 (i,j) 的四个角在它自己的 (i,j)~（i+1,j+1) */
    var c00 = at(i, j), c10 = at(i + 1, j), c11 = at(i + 1, j + 1), c01 = at(i, j + 1);
    var pos = [], lp = [];
    [c00, c10, c11, c01].forEach(function (q) { pos.push(q[0], q[1], q[2]); });
    var order = [0, 1, 2, 0, 2, 3];
    var idx = order;
    [[c00, c10], [c10, c11], [c11, c01], [c01, c00]].forEach(function (e2) {
      lp.push(e2[0][0], e2[0][1], e2[0][2], e2[1][0], e2[1][1], e2[1][2]);
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    var grp = new THREE.Group();
    var fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: isSel ? 0xffd76a : 0x8fe3b0, transparent: true,
      opacity: isSel ? 0.42 : 0.26, depthWrite: false,
      side: THREE.DoubleSide, polygonOffset: true,
      polygonOffsetFactor: -8, polygonOffsetUnits: -16
    }));
    fill.renderOrder = 10;
    grp.add(fill);
    var lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    var line = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      color: isSel ? 0xffe9a8 : 0xd8fff0, transparent: true, opacity: 0.95,
      depthWrite: false, depthTest: false
    }));
    line.renderOrder = 11;
    grp.add(line);
    grp.name = 'buildCellHi';
    scene.add(grp);
    gridHi = grp;
    return true;
  }
  M.gridHighlight = function (i, j, sel) {
    if (i == null || j == null) {
      if (gridHi) { scene.remove(gridHi); gridHi = null; }
      gridHiKey = '';
      M._hiCell = null;
      return;
    }
    var key = i + ',' + j + (sel ? '!' : '');
    if (key === gridHiKey) return;
    if (_gridHiBuild(i, j, !!sel)) {
      gridHiKey = key;
      M._hiCell = { i: i, j: j };
    }
  };
  M._gridHiVisible = function () { return !!gridHi; };

  /* ============================================================
   * v157.15：**整平工具**（老板「增加一个地面平整功能，参考我的世界」）
   * ------------------------------------------------------------
   * 交互取"画笔"这一档，最省也最直觉：
   *   · 工具页签点「⛰ 整平」→ 手上多了把铲子；
   *   · 底部 [−] 第 N 层 [+] 调**目标层**（1 层 = TERRACE_H 米）；
   *   · 在地面上按住左键拖 → 走过的每一格都被削/填到该层；
   *   · 「↩ 恢复」把走过的格还原成自然地形。
   *
   * 为什么是"拖刷"而不是"框选"：框选要画选区、要松开才生效，中途看不出
   * 高低对不对；拖刷每走一格立刻改数据（几何按 150ms 节流重建），
   * 玩家看到的是"地形跟着手变平"，这才是《我的世界》的手感。
   *
   * 重建成本：整层重建 ~180ms，所以拖拽期间**节流**（见 render 里的 _terraceDirty），
   * 松手立刻补一次，保证最终画面是准的。
   * ============================================================ */
  M.TOOL_NONE = 'none';
  M.TOOL_TERRACE = 'terrace';
  M.TOOL = M.TOOL_NONE;
  M.TERRACE_TARGET = 8;                    /* 目标层（默认 8 层 = 8 米） */
  M._terraceDirty = false;
  M._terraceAt = 0;

  M.setTool = function (t) {
    var v = (t === M.TOOL_TERRACE) ? M.TOOL_TERRACE : M.TOOL_NONE;
    M.TOOL = v;
    try { M.gridHighlight(null); } catch (e) { }
    M._hoverCell = null;
    return v;
  };
  M.terraceLevel = function (delta) {
    var lv = Math.round((M.TERRACE_TARGET || 0) + (delta || 0));
    lv = Math.max(GAME.TERRACE_MIN == null ? -8 : GAME.TERRACE_MIN,
                  Math.min(GAME.TERRACE_MAX == null ? 60 : GAME.TERRACE_MAX, lv));
    M.TERRACE_TARGET = lv;
    return lv;
  };
  M.terraceSetLevel = function (lv) {
    M.TERRACE_TARGET = Math.max(-8, Math.min(60, Math.round(lv || 0)));
    return M.TERRACE_TARGET;
  };
  /* 世界点（Vector3 或数组）→ 格号 → 交给 `GAME.terrain.paint` 刷一铲。
     渲染层只负责**从鼠标算出是哪一格**；"一铲能挖多深、基准取谁、钳在哪"都是规则，
     现在收在 domain 的 `GAME.terrain`（v157.18 层级归位，老板问的就是这件事）。 */
  /* ============================================================
   * v157.22：**笔刷**（老板「拖一大片更省事」）
   * ------------------------------------------------------------
   * TERRACE_BRUSH = 0 → 只刷当前格；1 → 含 1 环（7 格）；2 → 含 2 环（19 格）。
   * 成熟建造游戏都是这个手感：小笔刷修边、大笔刷推平。
   * 一次落笔会写到多格，返回值里带 cells 计数给提示用。
   * ============================================================ */
  M.TERRACE_BRUSH = 0;
  /* 笔刷：方格邻域。0 → 1 格；1 → 3×3 = 9 格；2 → 5×5 = 25 格。
     （v157.26 之前按六边形环扩张，现在跟地砖同一套方格坐标） */
  function _brushList(i, j) {
    var out = [[i, j]];
    var r = M.TERRACE_BRUSH | 0;
    for (var di = -r; di <= r; di++) {
      for (var dj = -r; dj <= r; dj++) {
        if (di === 0 && dj === 0) continue;
        out.push([i + di, j + dj]);
      }
    }
    return out;
  }
  M.terraceBrushSize = function () {
    var r = M.TERRACE_BRUSH | 0;
    var n = 2 * r + 1;
    return n * n;
  };

  /* 世界点 → **方格编号**（这是"建造只认方格"的入口）。
     渲染层只做坐标解算；"一铲能挖多深、基准取谁、钳在哪"是规则，在 GAME.terrain。 */
  M.gridAt = function (p) {
    if (!p) return null;
    var x = (p.x != null ? p.x : p[0]), y = (p.y != null ? p.y : p[1]), z = (p.z != null ? p.z : p[2]);
    var L = Math.hypot(x, y, z) || 1;
    if (L < 1e-9) return null;
    var d = [x / L, y / L, z / L];
    try { _gridAnchorFor(d); } catch (e0) { }
    try { return M.gridCellOf(d); } catch (e) { return null; }
  };
  M.terracePaintAt = function (p, lv) {
    if (!p) return null;
    var g = M.gridAt(p);
    if (!g) return null;
    var useLv = (lv == null) ? M.TERRACE_TARGET : lv;
    var list = _brushList(g.i, g.j), last = null, n = 0, rej = null;
    for (var k = 0; k < list.length; k++) {
      var r = GAME.terrain.paint(list[k][0], list[k][1], useLv);
      if (r && r.rejected) { rej = rej || r; continue; }
      if (r) { last = r; n++; }
    }
    M._terraceDirty = true;
    if (!n && rej) return rej;                 /* 整片都没写进去：把拒绝原因交出去 */
    if (last) last.cells = n;
    return last;
  };
  /* 恢复自然地形（同一支刷子，反方向） */
  M.terraceClearAt = function (p) {
    if (!p) return null;
    var g = M.gridAt(p);
    if (!g) return null;
    var list = _brushList(g.i, g.j), n = 0;
    for (var k = 0; k < list.length; k++) { GAME.terrain.clearAt(list[k][0], list[k][1]); n++; }
    M._terraceDirty = true;
    return { i: g.i, j: g.j, cells: n };
  };
  /* ============================================================
   * v157.21：**一笔**（拖刷补间）
   * ------------------------------------------------------------
   * 原来靠 mousemove 逐个采样：拖快的时候两个事件之间隔了好几格，
   * 中间就是**漏的** —— 拖完得到的是一串断断续续的斑块，
   * 玩家看到的就是"奇怪的形状"。
   * 现在把上一采样点到当前点之间按 0.6 米（约 1/9 格）插值补画，
   * 一笔下去必定是一条连续的带子。
   * ============================================================ */
  M.terraceStrokeAt = function (p) {
    if (!p) return null;
    var x = (p.x != null ? p.x : p[0]), y = (p.y != null ? p.y : p[1]), z = (p.z != null ? p.z : p[2]);
    var last = M._terraceLastP;
    M._terraceLastP = [x, y, z];
    var paint = M._terraceErase ? M.terraceClearAt : M.terracePaintAt;
    if (!last) return paint(p);
    var dx = x - last[0], dy = y - last[1], dz = z - last[2];
    var d = Math.hypot(dx, dy, dz);
    if (d < 0.6) return paint(p);
    var n = Math.min(48, Math.ceil(d / 0.6));
    var out = null;
    for (var i = 1; i <= n; i++) {
      var t = i / n;
      var q = [last[0] + dx * t, last[1] + dy * t, last[2] + dz * t];
      var r = paint(q);
      if (r) out = r;
    }
    return out;
  };
  /* 松手 / 切工具 → 立刻把几何对齐数据（不等节流那一拍） */
  M.terraceFlush = function () {
    if (!M._terraceDirty) return false;
    M._terraceDirty = false;
    M._terraceAt = Date.now();
    try { if (M._surf) rebuildSurf(camO.dir || [0, 1, 0]); } catch (e) { }
    return true;
  };
  M.terraceInfo = function () {
    return { tool: M.TOOL, target: M.TERRACE_TARGET, count: GAME.terrain ? GAME.terrain.count() : 0 };
  };

  /* ============================================================
   * v157：**把相机指到某个球面方向** —— 唯一正确入口
   * ------------------------------------------------------------
   * 陷阱：`camO.dir` 是 placeCamera 的**派生值**（每帧从 quat 重算并写回），
   * 外部 `camO.dir = [x,y,z]` 会在下一帧被覆盖 —— 表现为"我明明指过去了，
   * 画面还在原地"。实测拿它对准一座城，屏幕上只剩一片空地。
   * 要改朝向就改 **yaw/pitch**（或走这里），别碰 dir。
   * ============================================================ */
  M.lookAtDir = function (d) {
    if (!d) return null;
    var L = _hyp(d[0], d[1], d[2]) || 1;
    var x = d[0] / L, y = d[1] / L, z = d[2] / L;
    camO.pitch = Math.asin(Math.max(-1, Math.min(1, y)));
    camO.yaw = Math.atan2(x, z);
    camO.quat = null; camO._euler = null;
    return [camO.yaw, camO.pitch];
  };

  /* ============================================================
   * v157：地表层自检 —— 与 selfCheck（世界生成六层）并列的**第七层**
   * ------------------------------------------------------------
   * 判据只关心"地表层是不是真的存在且尺寸对"：
   *   ① 能建（格数、顶点数有下限，防"建了个空壳"也算通过）
   *   ② 真的进了场景（在 scene.children 里）
   *   ③ 能拆干净（destroySurf 后 _sr 为空 —— 这条是实测踩到的 bug：
   *      只清闭包 SR 不清 M._sr，外部一直以为还开着）
   * ⚠️ 全部带**下限**：空几何也能"没有异常"，但那是坏的。
   * ============================================================ */
  M.surfSelfCheck = function () {
    var out = { fails: [], metrics: {} };
    var was = M._surf;
    try {
      if (!M._surf) M.surfaceMode(true);
      var st = M.surfStats();
      out.metrics = st || {};
      if (!st) out.fails.push('S1/未构建: surfStats 为空');
      else {
        if (!(st.cells >= 200)) out.fails.push('S1/格数: ' + st.cells + '（下限 200）');
        if (!(st.verts >= 2000)) out.fails.push('S1/顶点: ' + st.verts + '（下限 2000）');
        if (!(st.ms >= 0)) out.fails.push('S1/耗时: ' + st.ms);
      }
      if (!SR || !SR.root) out.fails.push('S2/入口: 闭包 SR 为空');
      else {
        if (!SR.terr) out.fails.push('S2/地形层: 缺');
        if (!SR.plate) out.fails.push('S2/地块层: 缺');
        if (!SR.plateLine) out.fails.push('S2/描边层: 缺');
        /* S2b/景物层（v157j）：数量必须**有下限** —— 空数组也能"没有异常"，
           但那是坏的。同时要求至少出现两种景物，否则"只长草不长树"也算过。 */
        var scN = (SR.scatter && SR.scatter.meshes) ? SR.scatter.meshes.length : 0;
        var scC = (SR.scatter && SR.scatter.count) || 0;
        out.metrics.scatterMeshes = scN;
        out.metrics.scatterCount = scC;
        if (!(scN >= 2)) out.fails.push('S2b/景物种类: ' + scN + '（下限 2）');
        if (!(scC >= 200)) out.fails.push('S2b/景物数量: ' + scC + '（下限 200）');
        var inScene = false;
        if (scene) for (var i = 0; i < scene.children.length; i++) if (scene.children[i] === SR.root) inScene = true;
        if (!inScene) out.fails.push('S2/未入场景: surfaceLayer 不在 scene.children');
      }
      destroySurf();
      if (M._sr !== null || SR !== null) out.fails.push('S3/未拆干净: destroySurf 后仍有引用');
    } catch (e) {
      out.fails.push('S0/异常: ' + (e && e.message));
    } finally {
      try { if (!was) M.surfaceMode(false); } catch (e2) { }
    }
    out.ok = out.fails.length === 0;
    return out;
  };

  /* ============================================================
   * v157b：相机自检 —— 把老板那两条口径钉成断言
   * ------------------------------------------------------------
   * C1 贴地必须**平视**（俯角 < 5°）：这是"最下方转为平行于地平面"。
   * C2 高处必须**俯视**（俯角 > 70°），且与轨道视角接得上（→90°）。
   * C3 俯角随高度**单调**递增：中间不能有回摆（回摆 = 拉到一半突然抬头）。
   * 全部走 lookDistAt / pitchAt 这两个纯函数，不依赖渲染状态。
   * ============================================================ */
  M.camSelfCheck = function () {
    var out = { fails: [], metrics: {} };
    var eye = M.SURF_EYE || 1.7, top = (M.AGL_SURF || 55);
    var ldEye = lookDistAt(eye), ldTop = lookDistAt(top * 0.999);
    var pEye = M.pitchAt(eye), pTop = M.pitchAt(top * 0.999);
    out.metrics = { lookEye: +ldEye.toFixed(1), pitchEye: +pEye.toFixed(1), pitchTop: +pTop.toFixed(1) };
    if (!(isFinite(ldEye) && ldEye > 20)) out.fails.push('C1/贴地注视距离: ' + ldEye + '（应 > 20 米）');
    if (!(isFinite(pEye) && pEye < 5)) out.fails.push('C1/贴地不平视: ' + pEye.toFixed(1) + '°（应 < 5）');
    if (!(isFinite(pTop) && pTop > 70)) out.fails.push('C2/高处不足俯视: ' + pTop.toFixed(1) + '°（应 > 70）');
    var prev = -1, mono = true, bad = 0;
    for (var a = 0; a <= (M.AGL_SURF || 55); a += 5) {
      var p = M.pitchAt(a);
      if (!isFinite(p)) { bad++; break; }
      if (p < prev - 0.01) { mono = false; }
      prev = p;
    }
    if (bad) out.fails.push('C3/非有限: pitchAt 返回了非数值');
    if (!mono) out.fails.push('C3/非单调: 俯角在某个高度回摆了');
    out.ok = out.fails.length === 0;
    return out;
  };

  /* ============================================================
   * v157q：**相机防穿模自检**（老板：「有时候会穿模（相机跑到地形下了）」）
   * ------------------------------------------------------------
   * 走的是**真实的 placeCamera**，不是复现一遍公式 ——
   * 复现公式的自检会在"公式改了但 placeCamera 没跟上"时全绿，那是假绿。
   *
   * 扫 4 个纬度 × 24 个方位，每个都尽量贴地（dist = R+2 逼出最差情况），
   * 读 cam.position 的实际半径，跟该方向的地面（地砖顶面）比。
   *
   * 判据全部带**下限**：样本数 ≥ 96、低于地面的方位数必须为 0、最小间隙必须 > 0。
   * 没有下限的话，"一次都没扫"也会算通过。
   * ============================================================ */
  /* ============================================================
   * v157.31：**滚轮落地的唯一出口** —— "想贴地"这一下把半径抬到安全高度。
   * ------------------------------------------------------------
   * 老板要「观察窗口不动」：地形不许在**平移/转视角**时改相机。
   * 但滚到底还是要防钻山 —— 所以只在**滚轮那一次**调用本函数夹一次，
   * 夹完就写进 camO.dist（一个数），之后平移期间再也不重算。
   * 唯一出口：wheel 与自检都读它，别处不许再写一份地形下限。
   * ============================================================ */
  /* v157.34：**真实离地高度**的按需出口（每帧不再算）—— 探针/UI 才用。
     内部才读地形，placeCamera 不调它。 */
  M._aglOf = function () {
    var dir = camO.dir || [0, 1, 0];
    try { return +((camO.dist - R) - (elevAvgAt(dir) || 0)).toFixed(2); }
    catch (e) { return +(camO.dist - R).toFixed(2); }
  };

  /* v157.35：相机正下方地形高（世界单位）—— 只给"输入时快照"与探针用。
     单点采样，不做 2 环平均：平均会被山脊拉动，正是"跨山脊地表变虚"的老原因。 */
  M._groundAt = function () {
    try { return +(groundHAt(camO.dir || [0, 1, 0]) * HSC).toFixed(2); } catch (e) { return 0; }
  };

  /* v158.0（P0）：**地形高度采样唯一出口**（dir 或 ci → 世界单位）。
     只读 groundHAt（地表层的既有口径，含整平台面），绝不另算 heightAt；
     ⛔ 不许把它搬进 placeCamera 函数体 —— §243①e 锁死那里不许读地形。 */
  M._groundAtUnit = function (dirOrCi) {
    var d = null;
    if (Array.isArray(dirOrCi)) d = dirOrCi;
    else if (dirOrCi != null && _tileCells && _tileCells[dirOrCi | 0]) {
      d = _tileCells[dirOrCi | 0].dir;
    } else if (dirOrCi == null) d = camO.dir || [0, 1, 0];
    if (!d || d.length < 3) return 0;
    try { return +(groundHAt(d) * HSC).toFixed(3); } catch (e) { return 0; }
  };

  M.camFloorAt = function (dir) {
    var f = R + (M.SURF_EYE || 1.7);
    try {
      var gh = groundHAt(dir || camO.dir) * HSC;
      if (isFinite(gh) && gh > 0) f = Math.max(f, R + gh + (M.SURF_EYE || 1.7));
    } catch (e) { }
    return f;
  };

  M.camGuardCheck = function () {
    var out = { fails: [], metrics: {} };
    var keepYaw = camO.yaw, keepPitch = camO.pitch, keepDist = camO.dist;
    var keepSurf = M._surf;
    var n = 0, badFloor = 0, minGap = 1e9, worst = null;
    var rMin = 1e9, rMax = -1e9;
    try {
      M.surfaceMode(true);
      for (var li = 0; li < 4; li++) {
        var lat = -0.55 + li * 0.37;
        for (var ai = 0; ai < 24; ai++) {
          var lon = ai * Math.PI * 2 / 24;
          camO.yaw = lon; camO.pitch = lat;
          camO.quat = null; camO._euler = null;
          /* ① 半径恒定：固定一个"玩家给的"距离，96 个方位渲染出来的 |pos| 必须一样。
             这一条是老板那句"观察窗口不动"的**正面证据** —— 旧版这里每个方位都不同。 */
          camO.dist = R + 40; _syncZoom();
          for (var w = 0; w < 20; w++) placeCamera();
          var camR = Math.sqrt(cam.position.x * cam.position.x +
                               cam.position.y * cam.position.y +
                               cam.position.z * cam.position.z);
          if (camR < rMin) rMin = camR;
          if (camR > rMax) rMax = camR;
          /* ② 滚轮下限：camFloorAt 必须能挡住"钻进山里"（限一次性使用，不是每帧跟随） */
          var fl = M.camFloorAt(camO.dir);
          var groundR = R + Math.max(0, groundHAt(camO.dir) * HSC) + 0.4;
          var gap = fl - groundR;
          n++;
          if (gap < minGap) {
            minGap = gap;
            worst = { lat: +lat.toFixed(2), lon: +lon.toFixed(2), gap: +gap.toFixed(2) };
          }
          if (gap < -0.01) badFloor++;
        }
      }
    } catch (e) {
      out.fails.push('C4/异常: ' + (e && e.message));
    } finally {
      camO.yaw = keepYaw; camO.pitch = keepPitch; camO.dist = keepDist;
      camO.quat = null; camO._euler = null; _syncZoom();
      try { if (!keepSurf) M.surfaceMode(false); } catch (e2) { }
    }
    var spread = +(rMax - rMin).toFixed(4);
    out.metrics = { samples: n, radiusSpread: spread, floorBelow: badFloor, minFloorGap: +minGap.toFixed(2), worst: worst };
    if (!(n >= 96)) out.fails.push('C4/样本不足: ' + n + '（下限 96）');
    if (!(spread <= 0.01)) out.fails.push('C4/半径随方位变: 最大差 ' + spread + ' 米（地形又在改相机了）');
    if (badFloor > 0) out.fails.push('C4/滚轮下限失效: ' + badFloor + '/' + n + ' 个方位仍会钻进地面（最差 ' +
      (worst ? worst.gap + ' 米）' : '') + '）');
    if (!(minGap > 0)) out.fails.push('C4/最小间隙: ' + minGap.toFixed(2) + ' 米（必须 > 0）');
    out.ok = out.fails.length === 0;
    return out;
  };

  /* ============================================================
   * v157d：**射线与地面求交**（真地形，不是光滑球）
   * ------------------------------------------------------------
   * 老板：「落地之后，鼠标悬停地块高亮，但高亮地块与鼠标总是有点距离错位」。
   *
   * 根因：拾取用的是 `_collider` —— 半径 R+0.6 的**光滑球**（看不见，只做拾取）。
   * 而地表在 R + 地形高×HSC（平原约 R+5，山地 R+30）。
   * 射线从斜上方下来，先穿过光滑球、再走几米才碰到真实地面 ——
   * 于是反查出来的格沿着视线往远处偏，高度差越大偏得越多。
   * 这正是"有点距离、不是完全正对"。
   *
   * 解法：迭代把"求交的球半径"逼近真实地形半径。
   *   ① 先和半径 R 的球求交 → 得到一个方向；
   *   ② 按该方向取地形高 → 得到新的球半径；
   *   ③ 再求交 → 直到半径不再变化（通常 2~3 次收敛）。
   * 每次迭代只多一个 sphElev，比 raycast 196K 三角形的 globe 便宜得多。
   * ============================================================ */
  function _raySphereT(o, d, r) {
    var b = o.x * d.x + o.y * d.y + o.z * d.z;
    var c = o.x * o.x + o.y * o.y + o.z * o.z - r * r;
    var disc = b * b - c;
    if (disc < 0) return null;
    var sq = Math.sqrt(disc);
    var t1 = -b - sq, t2 = -b + sq;
    if (t1 > 1e-3) return t1;
    if (t2 > 1e-3) return t2;      /* 相机在球内时取出口 */
    return null;
  }
  /* 返回 { dir: 命中点单位方向, r: 命中处的半径, ok: 是否收敛 } */
  function groundHit(ray) {
    var o = ray.origin, d = ray.direction;
    var rr = R, dir = null, ok = false;
    for (var i = 0; i < 6; i++) {
      var t = _raySphereT(o, d, rr);
      if (t == null) break;
      var L = Math.hypot(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t) || 1;
      dir = [(o.x + d.x * t) / L, (o.y + d.y * t) / L, (o.z + d.z * t) / L];
      var e = 0;
      try { e = groundHAt(dir); } catch (eS) { e = 0; }
      var nr = R + e * HSC;
      if (Math.abs(nr - rr) < 0.05) { rr = nr; ok = true; break; }
      rr = nr;
    }
    return { dir: dir, r: rr, ok: ok };
  }
  M.groundHit = groundHit;          /* 暴露：放置预览/自检共用同一把尺子 */

  /* ============================================================
   * v157d：**拾取格的唯一出口**
   * ------------------------------------------------------------
   * 为什么不能只用 groundHit：那是**解析近似**——从半径 R 的球开始迭代，
   * 遇到起伏大的地方会收敛到错误的盆地（实测高亮偏出画面 240~334 px）。
   *
   * 正解：直接 raycast **玩家看到的那块网**，命中即所见，没有近似。
   *   ① `SR.plate`（地砖，469 格 × 12 三角形 ≈ 5.6K）—— 近处，准确到格
   *   ② `SR.terr` （地形层，16K 三角形）—— 地砖范围外的野地
   *   ③ `groundHit`  —— 再往外（超出地表层），退回解析
   * 三级都 miss 才返回 -1。5.6K 三角形的 raycast 约 1ms，比算错便宜得多。
   * ============================================================ */
  function pickCiByRay(rc, fallbackPoint) {
    if (!SP || !SP.nearestCell) return -1;
    if (M._surf && SR) {
      if (SR.plate) {
        var h1 = rc.intersectObject(SR.plate, false);
        if (h1.length) {
          var p1 = h1[0].point;
          return SP.nearestCell([p1.x, p1.y, p1.z]);
        }
      }
      if (SR.terr) {
        var h2 = rc.intersectObject(SR.terr, false);
        if (h2.length) {
          var p2 = h2[0].point;
          return SP.nearestCell([p2.x, p2.y, p2.z]);
        }
      }
    }
    /* 轨道模式（或地表层都 miss）走原来的光滑球点 —— 远景下它足够准。
       地表层 miss 时也拿它兜底，总比返回 -1 让高亮消失好。 */
    if (fallbackPoint) return SP.nearestCell([fallbackPoint.x, fallbackPoint.y, fallbackPoint.z]);
    var g = groundHit(rc.ray);
    return (g && g.dir) ? SP.nearestCell(g.dir) : -1;
  }
  M.pickCiByRay = pickCiByRay;

  /* ============================================================
   * v157i：**转向契约表**（唯一语义来源）
   * ------------------------------------------------------------
   * 老板 2026-11-08 20:46 给的是功能定义，不是"翻符号"：
   *   ① 高空左键：揪住球拖 —— 绕球心、内容跟手，「轴心就是球心」；
   *   ② 高空右键：以相机为轴心转头，无角度上限，**360° 自由**；
   *   ③ 地表左键：揪住地面一点 —— 绕球心随鼠标左右前后移动。
   *
   * 于是两个键从此**不再共用一套符号**：
   *   左键 = `grab`（抓取）：射线求真实球面点 → 两点旋转 → 反算 yaw/pitch。
   *          不需要灵敏度常数，抓取点误差实测 2~8px。
   *   右键 = `look`（转头）：相机自身为轴心，只有符号需要按场景区分
   *          （`lookPitch` 轨道正=抬头、地表正=低头，同一符号画面走向相反）。
   *
   * ⚠️ 改这里等于改手感。smoke §243⑪ / §243⑪b 锁死这两条。
   * ============================================================ */
  var TURN = {
    /* 左键：抓取。不看符号 —— 走"射线求交 + 两点旋转"，见 mousemove 里 v157i 段 */
    left: 'grab',
    /* 右键：转头（相机为轴心，水平 ±180° 环绕 = 可连转一圈） */
    lookYaw:   { orbit: -1, surf: -1 },
    lookPitch: { orbit: -1, surf: +1 }    /* 两场景都是"下拖 = 低头" */
  };
  M.TURN = TURN;
  /* 灵敏度只作用于**右键转头**。左键是抓取，不需要任何常数
     （所以原来的 TURN_K_YAW / TURN_K_PITCH 已随抓取改造退役）。 */
  M.TURN_K_LOOK = 0.005;
  M.TURN_K_SURF = 0.0045;

  M.rebuildSurf = rebuildSurf;  M.surfStats = function () {
    return SR ? { cells: SR.cells, verts: SR.verts, ms: SR.builtMs, ci: SR.ci, timing: SR.timing || null } : null;
  };
  /* v157.35：只读探针出口 —— 地表层当前透明度（P0 要量"它到底在哪一档消失"）。
     纯读，不参与任何逻辑。 */
  M.surfAlpha = function () { return _surfFade; };
  M.surfSpan = function () { return (M.SURF_GRID_RANGE || 0) * (M.BUILD_CELL || 2); };
  /* ============================================================
   * v156.52（老板「提供一个正位按钮（把球体摆正）」）——
   * 把视角恢复到初始方位（= 轴线竖直、北极在上、视角在东南方向俯视）。
   * 注意：清的不只是 yaw/pitch/dist，**还必须清 lookYaw/lookPitch**（自由视线偏移），
   * 否则按了「正位」球是正了、视线还歪着，等于没复位。
   * ============================================================ */
  M.resetView = function () {
    camO.yaw = 0.8; camO.pitch = 0.42; camO.dist = R * 2.9;
    camO.quat = null; camO.dir = null; camO._euler = null;
    _syncZoom();   /* 强制 placeCamera 用欧拉角重建 q（丢弃 roll） */
    camO.lookYaw = 0; camO.lookPitch = 0;
    try { touch(); redraw(); } catch (e) { }
  };
  M.ZOOM_MAX = R * 50;                                    /* 外界：老板指定的最大空间 */

  /* v91.33（性能）：版本戳（把 M.render 里的内联拼串抽出，预建时可预盖）。 */
  M._pverOf = function () { return (SP.seed3 ? SP.seed3() : 0) + '|' + (SP.sub || 0) + '|' + (SP.PLANET ? JSON.stringify(SP.PLANET) : ''); };
  M._mkVerOf = function () { return (((GAME.mapSliceOf && GAME.mapSliceOf()) || {}).cities || []).map(function (c) { return c.id + ':' + c.x + ',' + c.y; }).join('|') + '#' + _tileSub;   /* v157.85：`#pl<pos>`（前传君主站位）随前传退役删除 */ };
  M._flVerOf = function () { var sl = (GAME.mapSliceOf && GAME.mapSliceOf()) || {}; var fp = Object.keys(sl.forts || {}).sort().join(','); var wp = (sl.wilds || []).map(function (w) { return w.ci; }).sort(function (a, b) { return a - b; }).join('|'); var _ck = ''; if (GAME.camp && GAME.camp.found) { var cf = GAME.camp.found(); var n = 0, dm = 0; Object.keys(cf).forEach(function (k) { n++; if (cf[k].mode) dm++; }); _ck = '#c' + n + '/' + dm; } /* v158.25：ruin 段随遗迹系统退役 */
      /* v93.2：村社——活着几处、护着几处、空了几处（任一变化都要重建标记） */
      if (GAME.state && GAME.state.villages) {
        var _vva = GAME.state.villages, _vn = 0, _vg = 0, _vd = 0;
        Object.keys(_vva).forEach(function (k) { _vn++; if (_vva[k].guardAt > 0) _vg++; if (_vva[k].dead) _vd++; });
        _ck += '#v' + _vn + '/' + _vg + '/' + _vd;
        /* 世界新开垦的聚落也要进指纹，否则"长出来了"但地图不重画 */
        _ck += '#n' + Object.keys((GAME.state && GAME.state.villageNew) || {}).length;
      } return fp + '#' + wp + '#' + _tileSub + '#' + (GAME.memorial ? GAME.memorial.total() : 0) + _ck; };
  M._arVerOf = function () { var sl = (GAME.mapSliceOf && GAME.mapSliceOf()) || {}; return (sl.marches || []).map(function (m) { return m.id + ':' + m.cityId + '>' + m.tci; }).join('|') + '#' + _tileSub; };
  /* v91.33：**后台预建**全场景（进游戏后调用）—— 含**全部版本戳**（否则首次 M.render 会全量重建）。
     v91.35：拆成**可分段**的步骤（`preloadSteps`）—— 每段之间让出事件循环，避免一次性同步阻塞主线程。
     段序 = 原同步 preload 的展开（严格同序，结果一致）。 */
  M.preloadSteps = function () {
    if (built) return [];               /* 已建 → 零步骤 */
    if (typeof THREE === 'undefined') return [];
    /* ⚠️ v91.35：**先建渲染器，失败即零步骤** —— jsdom（无 WebGL）下 `ensure()` 会抛、
       scene/R3 保持 undefined；若不在此拦下，分帧运行器会吞掉抛错、继续跑完 `finish`，
       把 `built` 置成 true（此时 scene 是 undefined）→ 之后 `M.rebuild()` 里
       `scene.remove(_wonderGrp)` 必崩（"Cannot read properties of undefined"）。
       实测该坑曾让「存档往返」e2e 断言整条红。 */
    try { ensure(); } catch (e) { return []; }
    if (!R3 || !scene) return [];
    var steps = [
      { label: 'sphere', run: function () { if (SP && SP.build) SP.build(SP.sub); } },
      /* v91.46（老板）：「星环加载很慢，一开始没出来、过一会突然出现」——
         奇观 .glb.js 是 2~7MB 的 base64 脚本，**异步加载**（注入 script 即返回）。
         此前它排在**最后**（sphere→globe→tiles→regions→markers→wonder）→ 脚本要等前面
         ~1.6s 的重活跑完才开始下载 → 地图已现、奇观却迟迟不来。
         现**提前到第 2 步**：脚本立刻开始下载，其下载/解析与后续 globe/tiles/regions 重活
         **并行** → 地图出现时奇观基本就绪（buildWonder 只注入脚本、即时返回，不阻塞后续）。
         仅依赖 sphere 已建（cells 就位），不依赖 tiles/markers。 */
      { label: 'wonder', run: function () { buildWonder(); } },
      { label: 'globe+tiles', run: function () { buildGlobe(); buildTiles(TILE_SUB); } },
      { label: 'regions', run: function () { buildRegions(); } },
      { label: 'markers', run: function () { buildMarkers(); buildTowns(); buildFlags(); buildMarchArrows(); } },
      /* 陨石带是**装饰**：失败也不能中断分帧加载（否则 built 永远不置 true，地图不渲染）。 */
      { label: 'belt', run: function () { try { if (buildBelt) buildBelt(); } catch (eBelt0) { } } },
      /* v91.46：**等奇观就绪再出图**（轮询让出主线程 → glb onload + 解析能跑完）。
         放在最后重活（regions/markers）之后 —— 那时脚本多半已下载完，只需等解析，
         首帧即"地图 + 奇观"一起出现，不再分两次"蹦"。超时（maxWait）则先出地图。 */
      { label: 'wonder-ready', run: function () { }, waitFor: function () {
        if (!M._wonderGrp) return true;                     /* 无奇观/已失败 → 不等 */
        return !!(M._wonderBody && M._wonderSpin && M._wonderSpin.material && M._wonderSpin.material.map);
      }, maxWait: 2500 },
      { label: 'finish', run: function () {
        M._pver = M._pverOf(); M._mkVer = M._mkVerOf(); M._flVer = M._flVerOf(); M._arVer = M._arVerOf();
        try {
          placeCamera();
          if (wcv && typeof window !== 'undefined') {
            wcv.width = window.innerWidth || 1680; wcv.height = window.innerHeight || 900;
            R3.setSize(wcv.width, wcv.height, false); cam.aspect = wcv.width / wcv.height; cam.updateProjectionMatrix();
          }
          R3.render(scene, cam);
        } catch (e) { }
        if (R3 && scene) built = true;   /* 只有渲染器真就绪才认"已建" */
      } },
    ];
    return steps;
  };
  M.preload = function () {
    if (built) return;
    var steps = M.preloadSteps();
    for (var i = 0; i < steps.length; i++) steps[i].run();
  };
  /* ============================================================
   * v92.243 · 光照总闸（唯一出口）
   * ------------------------------------------------------------
   * `mode`：'mix'（默认，全空间 + 太阳）/ 'sun'（只要单向光，对比最强）/
   *         'ambient'（只要全空间均匀光，最平但最不会看漏东西）。
   * `az/el`：太阳方位角/高度角（度）—— 决定受光面朝哪边。
   * 太阳颜色**不在这里定**，跟着 `SP.PLANET.starColor`（恒星色温）走。
   * 想调就一句：`GAME.map3d.setLight({ mode:'sun', sunInt:3.0 })`。
   * ============================================================ */
  /* 取值依据：v91.38 曾因"环境光太软太平"把奇观打成糊片，所以**太阳必须仍是主光**
     （3.2 远大于环境 0.34），环境光只负责"抬底"——让背光面/远景碎屑不至纯黑。 */
  M.LIGHT = { mode: 'mix', sunInt: 3.2, ambInt: 0.34, hemiInt: 0.28, fillInt: 0.60, az: -42, el: 34, term: 0.45 };
  /* 太阳方向（世界坐标，指向光源）与昼夜强度 —— 给 globe 的注入着色器共用。
     ⚠️ 模块加载时**不能**直接 `new THREE.Vector3(...)`：jsdom（无 THREE）下会整包加载失败，
     而 smoke-test 正是那样跑起来的 —— 一律延迟到 applyLight / 浏览器里再建。 */
  M._sunDir = (typeof THREE !== 'undefined' && THREE.Vector3) ? new THREE.Vector3(0, 1, 0) : null;
  M._termU = { value: 0.45 };
  /* v157.89：地形起伏明暗的强度（0 = 关 · 1 = 默认）。老板觉得"不够立体"就往上给，
     觉得"太脏/太暗"就往回收 —— 一个数就能调，不必改着色器。*/
  M._reliefU = { value: 1.0 };
  /* v157.89 P1：片元级细节法线（近看颗粒）。
     ⚠️ 不能走 three 的 normalMap —— 球体是 MeshBasicMaterial，normalMap 对它无效（静默忽略）。
        这里把细节灰度贴图当高度场，在片元里求梯度自己扰动法线。*/
  M._detailTexU = { value: null };   /* 指向 makeGrainTex('n') 高度场（颜色图走 'c'，两个缓存 key）*/
  /* v157.93：**逐像素地貌配色**（B 方案）—— 颜色改由图集采样，不再吃顶点密度。
     每面 N² 个纹素：N=256 → 纹素 1.84 单位（顶点是 3.7，即 2 倍精度）；N=512 → 0.92 单位（4 倍）。*/
  M.COLOR_ATLAS_N = 256;
  M.useColorAtlas = true;
  M._colTex = null;         /* 烘好的图集（Texture）*/
  M._colTexU = { value: null };   /* 着色器采样器条目（编译后赋值也生效）*/
  M._colAtlasMs = 0;        /* 烘焙耗时（探针/断言）*/
  M.RELIEF_TEX = true;      /* v157.94：明暗走**逐像素法线图集**（关掉则退回逐顶点 vNrm，保命/对照）*/
  M._nrmTex = null;         /* 法线+曲率图集：RGB=法线(编码) A=曲率遮蔽 */
  M._nrmTexU = { value: null };
  M._nrmAtlasMs = 0;
  /* v157.95：水球方案 —— 水面 = 整球，海岸线由片元按高程图裁 */
  M.WATER_SPHERE = true;
  M._elevTex = null;
  M._elevTexU = { value: null };
  M._elevBakeMs = 0;
  M.WATERLEVEL = 0.038;      /* 与水面半径 R+1.0 对应的高程（1.0 / HSC）*/
  M._colAtlasKey = '';      /* 缓存键：种子+精度 —— globe 会被反复重建，不缓存就每次重烘 1.6 秒 */
  M._detailU = { value: 0 };        /* 法线扰动强度（**默认关**：老板两次报"规律斑纹"，先只留颜色细节；M.setDetail(1) 可开）*/
  M.DETAIL_REPEAT = 120;             /* uv 放大倍数（扫参定档：40/60/90 在贴地视角是大块迷彩斑，120 才是细颗粒）*/
  M._detRepU = { value: 120 };       /* 运行时出口：M.setGrainRep(v) */
  M.setGrainRep = function (v) {
    var n = (v == null) ? 120 : Math.max(4, Math.min(400, +v || 120));
    M._detRepU.value = n; M.DETAIL_REPEAT = n;
    return n;
  };
  M.DETAIL_SLOPE = 18;               /* 高度差 → 法线倾角的放大系数*/
  M._detailAmpU = { value: 0.12 };    /* 颗粒压暗幅度（扫参：0.30 压暗 12.6% 越红线；0.22 在贴地视角偏脏；0.12 干净）*/
  /* v157.89：**强度基准**（M.setRelief 写它）。真正的 uniform = BASE × 高度淡出系数，
     见 placeCamera 的 `_reliefU` 更新 —— 淡出是为了近景不出现"刷痕"。*/
  M.RELIEF_BASE = 1.0;
  M.RELIEF_AGL_FULL = 520;      /* 海拔 ≥ 此值：起伏全量（看整球那一档）*/
  M.RELIEF_AGL_ZERO = 210;      /* 海拔 ≤ 此值：起伏归零（贴地那一档）*/
  /* v157.89c：起伏明暗的**归一化枢轴**。
     纯方向明暗只会压暗坡面（cos 是凹函数）→ 整幅必然变暗（实测 P90 掉 15%），
     老板一眼就是"变暗了"。修法不是削斜率（那是削立体感），而是除以"平均曝光"：
       系数 = (0.70 + 0.46·relV) / (0.70 + 0.46·pivot)
     其中 pivot = 全球顶点 relV 的平均值。这样对比度一分不少，平均亮度回到 1.0。
     太阳换方位时重算（applyLight 里调 _recalcRelPivot）。*/
  M._relPivotU = { value: 0.5 };
  M._globeNrmArr = null;
  M._recalcRelPivot = function () {
    var na = M._globeNrmArr, sd = M._sunDir;
    if (!na || !sd) return null;
    var sx = sd.x, sy = sd.y, sz = sd.z, sum = 0, cnt = 0;
    var L = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
    sx /= L; sy /= L; sz /= L;
    for (var i = 0; i < na.length; i += 15) {       /* stride：9.9 万顶点抽 1/5，够稳且几乎不耗时 */
      var d = na[i] * sx + na[i + 1] * sy + na[i + 2] * sz;
      sum += (d < 0 ? 0 : (d > 1 ? 1 : d)); cnt++;
    }
    var pv = cnt ? (sum / cnt) : 0.5;
    M._relPivotU.value = pv;
    return +pv.toFixed(3);
  };
  /* ============================================================
   * v92.243 · 给**不受光的球面**注入太阳明暗（昼夜线）
   * ------------------------------------------------------------
   * 星球地表是 `MeshBasicMaterial`（v154e：为了让地形色"写入即所见"刻意不用光照）。
   * 但老板要"单向光模拟太阳"，纯 Basic 材质是照不出昼夜的 —— 于是用 onBeforeCompile
   * 在片元末尾乘一个方向因子：`1-term + term*(0.35 + 0.65*max(0,dot(N,Sun)))`。
   *   · 只**压暗**背光面，绝不提亮 —— 所以日面颜色与以前完全一致（不会再度发白）；
   *   · 球心在原点、地表是球 → 顶点位置本身就等于法线，不必依赖 objectNormal
   *     （Basic 的顶点着色器里 objectNormal 只在 USE_ENVMAP/USE_SKINNING 时才存在）；
   *   · `term = 0` 即完全关闭（一个数回到旧观感）；include 名字对不上时静默不生效，不会崩。
   * ============================================================ */
  /* v157.89：第二参 `withRelief` = 是否注入"地形起伏明暗"。
     只给球面开（地块/水面/标记物不开）：它们的法线不是地形法线，硬开会把侧面压黑。*/
  function applyTerminator(mat, withRelief) {
    if (!mat || typeof mat.onBeforeCompile !== 'function') return mat;
    var REL = !!withRelief;
    mat.onBeforeCompile = function (sh) {
      /* ⚠️ v156.16：这里必须是 `{ value: … }` 的 **uniform 条目**，不能塞裸 Vector3。
         three 的 `WebGLUniforms.upload` 读的是 `entry.value`；塞裸对象时 `.value` 是 undefined，
         接着 `setValue(gl, undefined)` 就去读 `undefined.x` →
         页面报 `Cannot read properties of undefined (reading 'x')`（每个 program 首次上传炸一次，
         之后 three 认为已上传、不再炸 —— 所以看起来"偶发一次"而不是白屏）。
         这条从 v92.243 起一直在，也意味着**昼夜线（terminator）其实从未生效**。
         现在条目持有同一个 Vector3 引用，`applyLight()` 里 `.set(...)` 仍然生效。 */
      sh.uniforms.uSunDir = { value: M._sunDir };
      sh.uniforms.uTerm = M._termU;
      var _dRep = (+M.DETAIL_REPEAT || 16);
      /* v157.93：图集**半纹素内缩** —— 面边界 uv 到 1.0 时会采到隔壁格的纹素，
         实测表现为立方体面之间的细黑线（六个面各一条）。内缩半纹素即可。*/
      var _cN = (+M.COLOR_ATLAS_N || 256);
      var _cScale = 1 - 1 / _cN, _cInset = 0.5 / _cN;
      var _vHead = 'varying vec3 vWn;\n'
        + (REL ? 'attribute float aShade;\nattribute float aFace;\nuniform float uDetRep;\nvarying vec3 vNrm;\nvarying float vShade;\nvarying vec2 vDUv;\nvarying vec2 vAUv;\n' : '');
      sh.vertexShader = _vHead + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vWn = normalize(mat3(modelMatrix) * position);'
        + (REL ? ('\n  vNrm = normalize(mat3(modelMatrix) * normal);\n  vShade = aShade;\n  vAUv = (uv * ' + _cScale.toFixed(8) + ' + ' + _cInset.toFixed(8) + ' + vec2(mod(aFace, 4.0), floor(aFace / 4.0))) * 0.25;'
                  + '\n  vDUv = uv * uDetRep;') : '')
      );
      var _fHead = 'uniform vec3 uSunDir; uniform float uTerm;'
        + (REL ? (' uniform float uRelief; uniform float uPivot; varying vec3 vNrm; varying float vShade;'
                  + ' uniform sampler2D uDetailTex; uniform float uDetail; uniform float uDetAmp; uniform float uDetRep;'
                  + ' uniform sampler2D uColTex; uniform sampler2D uNrmTex;'
                  + ' uniform mat4 modelMatrix; varying vec2 vDUv; varying vec2 vAUv;') : '')
        + ' varying vec3 vWn;\n';
      var _body = '\n'
        + '  float _sunL = clamp(dot(normalize(vWn), normalize(uSunDir)), 0.0, 1.0);\n'
        /* v158.17（老板「转到城的背面整个星球变暗」）：夜面底数 0.35 → 0.55。
           原式的夜面是 (1-term)+term*0.35（term=0.45 → 0.7075），**再叠**上地形起伏
           的归一化系数（夜面 _relV=0 → _relN≈0.75）后只剩 53% —— 实机是
           "整颗星球糊成一片暗"、地形看不出起伏。
           改底数只动夜面：_sunL=1 时 0.55+0.45 = 1.0，**日面与以前逐位一致**
           （不会再度发白），夜面抬到 79.8%（× 起伏 ≈ 60%），昼夜差仍在但不瞎。 */
        + '  gl_FragColor.rgb *= (1.0 - uTerm) + uTerm * (0.55 + 0.45 * _sunL);';
      if (REL) {
        /* 起伏明暗：用**真地形法线**与太阳夹角，0.70~1.16 的软包裹（无硬阴影）。
           · 只用一次乘，不叠第二套光照；日面仍以 1.0 为基准，不整体提亮。
           · 系数区间刻意不对称（压暗 30%、提亮 16%）：山体"抢眼"但不会把亮色顶爆。*/
        sh.uniforms.uRelief = M._reliefU;
        sh.uniforms.uColTex = M._colTexU;
        sh.uniforms.uNrmTex = M._nrmTexU;
        sh.uniforms.uDetail = M._detailU;
        sh.uniforms.uPivot = M._relPivotU;
        sh.uniforms.uDetAmp = M._detailAmpU;
        sh.uniforms.uDetRep = M._detRepU;
        sh.uniforms.uDetailTex = M._detailTexU;
        _body += '\n'
          /* P1：细节法线。1.6 纹素步长求梯度（步长必须与 vDUv 的放大倍数同源，
             否则颗粒尺度会随 DETAIL_REPEAT 变化而错位）。*/
          + (M.RELIEF_TEX
              ? ('  vec4 _nt = texture2D(uNrmTex, vAUv);\n'
                 + '  vec3 _N0 = normalize(mat3(modelMatrix) * normalize(_nt.xyz * 2.0 - 1.0));\n'
                 + '  float _shadeV = 0.74 + _nt.a * 0.32;\n')
              : ('  vec3 _N0 = normalize(vNrm);\n'
                 + '  float _shadeV = vShade;\n'))
          + '  vec3 _up = abs(_N0.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);\n'
          + '  vec3 _T = normalize(cross(_up, _N0));\n'
          + '  vec3 _B = cross(_N0, _T);\n'
          + '  float _e = 1.6 * uDetRep / 512.0;\n'
          + '  float _h0 = texture2D(uDetailTex, vDUv).r;\n'
          + '  float _hx = texture2D(uDetailTex, vDUv + vec2(_e, 0.0)).r - _h0;\n'
          + '  float _hy = texture2D(uDetailTex, vDUv + vec2(0.0, _e)).r - _h0;\n'
          + '  vec3 _Nd = normalize(_N0 + (_T * (-_hx) + _B * (-_hy)) * (' + (+M.DETAIL_SLOPE || 18).toFixed(1) + ' * uDetail));\n'
          /* ⚠️ v157.89 P1 首版踩的坑：这里原本只有一条 `_rel`，用的是**扰动后**的法线，
             而它整体被 `uRelief` 闸门乘着 —— 于是近景浮雕淡出（uRelief=0）时，
             细节颗粒**跟着一起失效**（实测 zoom0.13 增益 0.0%）。两层必须解耦：
               · `_relV` 顶点法线 → 地形起伏，受 uRelief 管（远景）；
               · 细节颗粒用 `_relV − _relD` 的**差值**，只受 uDetail 管（近景），
                 且**只压暗不提亮** → 永不削顶；mipmap 把地形压平时差值为 0，
                 远景既不脏也不整体变暗（这一条是"对称写法"做不到的）。*/
          + '  vec3 _ct = texture2D(uColTex, vAUv).rgb;\n'
          + '  gl_FragColor.rgb *= _ct;\n'
          + '  vec3 _sunN = normalize(uSunDir);\n'
          + '  float _relV = clamp(dot(_N0, _sunN), 0.0, 1.0);\n'
          + '  float _relD = clamp(dot(_Nd, _sunN), 0.0, 1.0);\n'
          + '  float _relN = (0.70 + 0.46 * _relV) / (0.70 + 0.46 * uPivot);\n'
          + '  gl_FragColor.rgb *= mix(1.0, _relN, uRelief);\n'
          + '  gl_FragColor.rgb *= mix(1.0, _shadeV, uRelief);\n'
          + '  gl_FragColor.rgb *= 1.0 - uDetAmp * max(0.0, _relV - _relD) * uDetail;';
      }
      sh.fragmentShader = _fHead
        + sh.fragmentShader.replace('#include <dithering_fragment>',
            '#include <dithering_fragment>' + _body);
    };
    mat.needsUpdate = true;
    return mat;
  }
  M.applyTerminator = applyTerminator;
  M.applyLight = function () {
    var L = M.LIGHT, mode = L.mode || 'mix';
    var ambK = (mode === 'sun') ? 0.15 : 1.0;          /* 'sun' 也留一点底光，否则夜面纯黑 */
    var sunK = (mode === 'ambient') ? 0.0 : 1.0;
    if (M._amb) M._amb.intensity = Math.max(0, (+L.ambInt || 0) * ambK);
    if (M._hemi) M._hemi.intensity = Math.max(0, (+L.hemiInt || 0) * ambK);
    if (M._fillLight) M._fillLight.intensity = Math.max(0, (+L.fillInt || 0) * (mode === 'ambient' ? 0.15 : 1));
    if (M._sun) {
      M._sun.intensity = Math.max(0, (+L.sunInt || 0) * sunK);
      var a = (+L.az || 0) * Math.PI / 180;
      var e = Math.max(-89, Math.min(89, +L.el || 0)) * Math.PI / 180;
      var D = 4000;
      var sx = Math.cos(e) * Math.sin(a), sy = Math.sin(e), sz = Math.cos(e) * Math.cos(a);
      M._sun.position.set(sx * D, sy * D, sz * D);
      if (!M._sunDir && typeof THREE !== 'undefined' && THREE.Vector3) M._sunDir = new THREE.Vector3(0, 1, 0);
      if (M._sunDir) M._sunDir.set(sx, sy, sz);
      if (SP && SP.PLANET && SP.PLANET.starColor != null) M._sun.color.setHex(SP.PLANET.starColor);
    }
    /* 昼夜强度：0 = 关闭（回到"写入即所见"），1 = 最强 */
    var _t = (L.term == null) ? 0 : Math.max(0, Math.min(1, +L.term || 0));
    if (M._termU) M._termU.value = (mode === 'ambient') ? 0 : _t;
    if (M._recalcRelPivot) M._recalcRelPivot();     /* v157.89c：太阳方位变了，归一化枢轴跟着变 */
  };
  /* v157.89：地形起伏明暗强度（0 = 关 · 1 = 默认）。给老板一个"一个数调手感"的出口。*/
  M.setRelief = function (v) {
    var n = (v == null) ? 1 : (Math.max(0, Math.min(1, +v || 0)));
    M.RELIEF_BASE = n;
    M._reliefU.value = n;                    /* 本帧立即生效，不等下一帧 */
    return n;
  };
  /* v157.89 P1：细节法线强度（0 = 关 · 1 = 默认）。与 setRelief 各管一层：
     relief 管"地形起伏"（顶点级 · 远景），detail 管"表面颗粒"（像素级 · 近景）。*/
  M.setDetail = function (v) {
    var n = (v == null) ? 1 : (Math.max(0, Math.min(2, +v || 0)));
    M._detailU.value = n;
    return n;
  };
  M.setLight = function (opt) {
    if (opt) for (var k in opt) if (opt[k] != null) M.LIGHT[k] = opt[k];
    M.applyLight();
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    return M.LIGHT;
  };

  function ensure() {
    if (R3) return;
    wcv = document.createElement('canvas');
    R3 = new THREE.WebGLRenderer({ canvas: wcv, antialias: true, preserveDrawingBuffer: true });
    R3.setPixelRatio(1);
    /* ============================================================
     * v154e（实测：整颗球发白、地形色被冲淡）
     * ------------------------------------------------------------
     * 地形颜色是**按 sRGB 肉眼值**写进 BufferGeometry 顶点色的，而渲染器把输出做了
     * sRGB 编码（outputColorSpace=SRGB）→ 相当于编码了两次 → 所有颜色被提亮、发灰白。
     * 现在：关掉输出色彩空间转换（线性直出），顶点色按"写入即所见"处理。
     * 色调映射同理：Basic 材质用不上，ACES 只会把中灰往白推。
     * ============================================================ */
    if ('outputColorSpace' in R3) R3.outputColorSpace = THREE.LinearSRGBColorSpace || '';
    R3.toneMapping = THREE.NoToneMapping;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1020);
    /* ============================================================
     * v157.61：地表（map3d）接入程序化 env（与 scene3d 同源：零外链、无 HDRI）。
     * ------------------------------------------------------------
     * 地表上的单位/建筑模型经 GAME.gltf.parse 加载（8052+），buildMaterial 据此放开 metalness
     * 上限（`GTF._envOK`），金属件与粗糙面才有反射/环境色 —— 这正是 v157.58 缺失的最后一环：
     * scene3d 有 env，但 map3d 没有，导致地表金属资产始终夹在 0.25。
     * 用程序化天空 canvas + PMREM，避免任何外部资源依赖。
     * 注：duel3d 仍走 v157.58 起的全局 `_envOK=true 且无 env` 状态（未引入新回归，老板未反馈变黑）。
     * ============================================================ */
    (function buildSurfEnv() {
      try {
        var cv2 = document.createElement('canvas');
        cv2.width = 512; cv2.height = 256;
        var g2 = cv2.getContext('2d');
        var sky = g2.createLinearGradient(0, 0, 0, 256);
        sky.addColorStop(0.00, '#0e151d');   /* 天顶：最深 */
        sky.addColorStop(0.34, '#38434f');
        sky.addColorStop(0.50, '#9c8f78');   /* 地平线：暖沙色 */
        sky.addColorStop(0.62, '#5b5142');
        sky.addColorStop(1.00, '#241f19');   /* 地面：暗褐 */
        g2.fillStyle = sky; g2.fillRect(0, 0, 512, 256);
        var sg = g2.createRadialGradient(392, 96, 3, 392, 96, 104);
        sg.addColorStop(0.00, 'rgba(255,242,214,1)');
        sg.addColorStop(0.22, 'rgba(255,208,142,0.62)');
        sg.addColorStop(0.55, 'rgba(240,178,110,0.16)');
        sg.addColorStop(1.00, 'rgba(230,170,100,0)');
        g2.fillStyle = sg; g2.fillRect(286, 0, 212, 200);
        var eq = new THREE.CanvasTexture(cv2);
        eq.mapping = THREE.EquirectangularReflectionMapping;
        var pm = new THREE.PMREMGenerator(R3);
        pm.compileEquirectangularShader();
        scene.environment = pm.fromEquirectangular(eq).texture;
        if (GAME.gltf && GAME.gltf.setEnvAvailable) GAME.gltf.setEnvAvailable(true);
        eq.dispose(); pm.dispose();
      } catch (e) { /* 老版本无 PMREM → 退回纯直射光，不影响可用性 */ }
    })();
    /* ============================================================
     * v156.52（老板「提供一条虚拟线（穿过球心）」）——
     * 一条**南北极轴**，贯穿球心、两端各伸出 1.3R。
     * 用处：旋转时有个固定参照，一眼看出「球摆没摆正」；
     * 加上「正位」按钮，摆正 = 轴线竖直 + 视角回到初始方位。
     * 半透明青色，不抢地形配色；frustumCulled=false 防止极端角度被裁掉。
     * ============================================================ */
    (function buildAxis() {
      if (axisRoot) { scene.remove(axisRoot); disposeTree(axisRoot); axisRoot = null; }
      /* 用**细圆柱**而不是 Line：linewidth 在多数 WebGL 实现里恒为 1px，
         1280 宽的画面里根本看不见（第一版就这么失败了）。圆柱有真实宽度，一定可见。 */
      var g = new THREE.CylinderGeometry(1.15, 1.15, R * 2.6, 10, 1, true);
      axisRoot = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        color: 0x5fd0ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false
      }));
      axisRoot.frustumCulled = false;
      axisRoot.renderOrder = 2;
      M._axisRoot = axisRoot;
      scene.add(axisRoot);
    })();
    cam = new THREE.PerspectiveCamera(42, 1, 1, 6000);
    M._cam = cam;              /* 暴露相机对象：拾取/投影/自检都要用它（它不在 scene 树里） */
    /* ============================================================
     * v92.243（老板：「提供适当的背景光亮度，可为全空间或单向光（模拟太阳）」）
     * ------------------------------------------------------------
     * 两套都给了，并留一个总闸 `M.setLight()`：
     *   · **全空间**（ambient + hemisphere）—— 保证"背光面不是纯黑"，
     *     相机能飞到 50R 时远处那些碎屑/建筑仍然看得见轮廓；
     *   · **单向光**（directional = 太阳）—— 按恒星色温着色、方向由 az/el 定，
     *     负责"受光面亮 / 背光面暗"的立体感。
     * 默认 `mode:'mix'`（两者叠加）；调成 `'sun'` 就只剩太阳（对比最强），
     * 调成 `'ambient'` 就纯均匀照明（没有明暗，最平但最不会看漏东西）。
     *
     * ⚠️ 作用范围要清楚：球体本身（globe/water/tiles/markers）是**不受光的 Basic 材质**
     *    （v154e 为了地形配色"写入即所见"刻意这么做）。所以这套光实际照亮的是：
     *    陨石带石块、地表放置物、3D 小人、奇观天体 —— 正是"背景里那些东西"。
     * ============================================================ */
    M._amb = new THREE.AmbientLight(0xdfe8f0, 0.34); scene.add(M._amb);
    M._hemi = new THREE.HemisphereLight(0xd8e4f0, 0x2a2a30, 0.28); scene.add(M._hemi);
    var sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
    sun.position.set(-800, 500, -500); scene.add(sun); M._sun = sun;
    /* 侧后方补一盏弱平行光：勾出**轮廓边**（避免背光面纯黑、也让圆面有转折）。 */
    var fill = new THREE.DirectionalLight(0xbcd2e8, 0.55);
    fill.position.set(700, -300, 600); scene.add(fill); M._fillLight = fill;
    M.applyLight();                                  /* 把 M.LIGHT 的当前值落上去 */
  }

  /* v90.67（老板 1 · 方案B）：**细节纹理** —— 可平铺的多倍频值噪声，乘到地形顶点色上，
     近看有"花草 / 岩石"颗粒（比纯顶点色强一档；cube 面间因纹理可平铺而无缝）。*/
  /* ============================================================
   * 细节纹理**必须跨次复用**（v157.13 · 实测泄漏修复）
   * ------------------------------------------------------------
   * `material.dispose()` 只释放材质本身，**不会释放 material.map**。
   * 每次 rebuildSurf / buildGlobe 都 new 一张 384² CanvasTexture
   * （384×384×4 ≈ 589KB 显存），且 destroySurf 的 dispose 循环也碰不到它
   * —— 实测：进出地表 12 次，renderer.info.memory.textures 从 15 线性涨到 27，
   * 一次都没回收；几何数则稳定在 39（说明几何的 dispose 是对的）。
   *
   * 修法取最省的一档：按用途 key 缓存。
   * ⚠️ 不能全共用一张 —— 两处 repeat 不同（地表 28、球面 7），
   *    同一个 Texture 对象被两边 set repeat 会互相踩。
   * ============================================================ */
  /* ⛔ v157.90：旧生成器（384² 的 8/16/32 规整格噪声）**整条退役**，函数与调用一并删除。
     它是「规律斑纹」的唯一来源：非二次幂 → mipmap 退化；规整格 → 放大后成点阵。
     现在所有细节贴图（球面颜色 / 地表颜色 / 法线高度场）统一由 `makeGrainTex(mode)` 提供。
     缓存表保留（两张颗粒图各占一个 key，共享复用，v157.13 的显存泄漏修复照旧生效）。*/
  var _dtCache = {};

  /* ============================================================
   * v157.89d：**颗粒高度场**（修 P1 的规则网点）
   * ------------------------------------------------------------
   * 老板截图「有斑纹」= 近景一片等间距小圆点。两个成因叠加：
   *   ① 原贴图 384² **非二次幂** —— WebGL1 下 mipmap / RepeatWrapping 退化，
   *      高 repeat（96）时出摩尔纹（规则点阵的典型形态）；
   *   ② 噪声只有 8/16/32 三个**规整格**，格点本身就是等间距的。
   * 修法：512²（POT）+ 互质格 6/15/37 + 域扭曲（低频场推移采样坐标）。
   * 这张图**只给法线用**，颜色仍用原来那张（不改变地形配色）。
   * ============================================================ */
  function makeGrainTex(mode) {
    var _ck = (mode === 'c') ? 'grainC' : 'grainN';
    if (_dtCache[_ck]) return _dtCache[_ck];
    var N = 512;
    function lattice(g, salt) {
      var a = new Float32Array(g * g);
      for (var i = 0; i < g * g; i++) a[i] = h3(i % g, (i / g) | 0, salt, 17);
      return a;
    }
    var W = lattice(5, 91), L6 = lattice(6, 71), L15 = lattice(15, 72), L37 = lattice(37, 73);
    function samp(A, g, x, y) {
      var gx = x * g, gy = y * g, x0 = Math.floor(gx), y0 = Math.floor(gy);
      var fx = gx - x0, fy = gy - y0;
      var x1 = (x0 + 1) % g, y1 = (y0 + 1) % g;
      var x0m = ((x0 % g) + g) % g, y0m = ((y0 % g) + g) % g;
      var v00 = A[y0m * g + x0m], v10 = A[y0m * g + x1], v01 = A[y1 * g + x0m], v11 = A[y1 * g + x1];
      var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      var t = v00 + (v10 - v00) * u, b = v01 + (v11 - v01) * u;
      return t + (b - t) * v;
    }
    var cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    var cx = cv.getContext('2d'); var img = cx.createImageData(N, N);
    for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) {
      var u = xx / N, v = yy / N;
      /* 域扭曲：低频场把采样坐标推开 ±6% 个格 —— 格点被揉散，不再等间距 */
      var wx = (samp(W, 5, u, v) - 0.5) * 0.12;
      var wy = (samp(W, 5, u + 0.37, v + 0.61) - 0.5) * 0.12;
      var n = samp(L6, 6, u + wx, v + wy) * 0.50
            + samp(L15, 15, u + wx * 1.8, v + wy * 1.8) * 0.32
            + samp(L37, 37, u + wx * 2.6, v + wy * 2.6) * 0.18;
      /* 两种用途同一套噪声，只改亮度区间：
         · 'n'（默认）= 高度场，0.35~0.65；
         · 'c' = 当颜色乘子用，**必须**保持原细节图的 0.74~1.0，否则地表整体变暗。*/
      var c = Math.round(((mode === 'c') ? (0.74 + n * 0.26) : (0.35 + n * 0.30)) * 255);
      var o = (yy * N + xx) * 4;
      img.data[o] = c; img.data[o + 1] = c; img.data[o + 2] = c; img.data[o + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 4;
    t._shared = true;
    _dtCache[_ck] = t;
    return t;
  }
  M.GRAIN_N = 512;

  /* ============================================================
   * v157.93：烘焙地貌配色图集（B 方案）
   * ------------------------------------------------------------
   * 逐纹素调用 `sphBiome(e, dy, dir, true)` —— 与顶点用的是**同一条出口**，
   * 所以色带、湖泊深度、高频细节全都在，不存在"两套配色"漂移。
   * 图集：4×4 格（只填前 6 格），整张 4N×4N 是二次幂（N=256→1024，N=512→2048），
   * mipmap 正常，不会再踩 v157.89d 那个 NPOT 的坑。
   * ============================================================ */
  /* ============================================================
   * v157.95：**等距柱状高程图**（给水面的逐像素裁剪用）
   * ------------------------------------------------------------
   * 为什么不用立方体图集：得在片元里自己算"哪个面 + 面内 uv"，
   * 六个面的参数化各不相同（有两个是镜像的），写错一个面就多一条接缝 ——
   * 今晚已经在接缝上栽过两次，不再赌这个。
   * 等距柱状只要 atan2/asin 两行，没有面、没有镜像。
   * 编码：v = (e + 0.15) / 0.30，8 位 → 分辨率 ≈ 0.0012 高程 ≈ 0.03 世界单位。
   * ============================================================ */
  function bakeElevTex(W, H) {
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var cx = cv.getContext('2d'); var img = cx.createImageData(W, H); var d = img.data;
    var PI = Math.PI;
    for (var y = 0; y < H; y++) {
      var lat = (0.5 - (y + 0.5) / H) * PI;          /* +π/2 → -π/2（与 uv.y=1 在上一致，配 flipY=false）*/
      var cy0 = Math.cos(lat), sy0 = Math.sin(lat);
      for (var x = 0; x < W; x++) {
        var lon = ((x + 0.5) / W - 0.5) * 2 * PI;
        /* ⚠️ v157.97：**经度约定必须与片元一致**。
           片元用 `atan2(z, x)` ⇒ x 对应 cos、z 对应 sin。
           原来写反（x=sin, z=cos）→ 整张高程图旋转 90°，水面裁剪全错位（老板「一大块斑」）。*/
        var dx = cy0 * Math.cos(lon), dy = sy0, dz = cy0 * Math.sin(lon);
        var e = sphElev([dx, dy, dz]);
        var v = (e + 0.15) / 0.30;
        v = v < 0 ? 0 : (v > 1 ? 1 : v);
        var o = (y * W + x) * 4;
        var c = Math.round(v * 255);
        d[o] = c; d[o + 1] = c; d[o + 2] = c; d[o + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;                       /* 上面按"行 = 纬度"算的，不许再翻 */
    tex.wrapS = THREE.RepeatWrapping;        /* 经度环绕 */
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex._shared = true;
    M._elevBakeMs = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0);
    return tex;
  }

  function bakeColorAtlas(N) {
    /* v157.93：**必须按 种子+精度 缓存**。globe 每次 renderMapCanvas 都可能重建
       （v157.86 踩过：提亮被静默抹掉就是因为每次重建），不缓存等于每次首屏多等 1.6 秒。*/
    var _key = (SP && SP.seed3 ? SP.seed3() : 'x') + '|' + N + '|' + (M._planetVer || 0);
    if (M._colTex && M._colAtlasKey === _key) { M._colAtlasErr = 'cached'; return M._colTex; }
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var F = (SP && SP.CUBE_FACES) ? SP.CUBE_FACES : null;
    if (!F || F.length < 6) { M._colAtlasErr = 'no-faces:' + (F ? F.length : 'null'); return null; }
    var A = 4 * N;
    var cv = document.createElement('canvas'); cv.width = A; cv.height = A;
    var cx = cv.getContext('2d'); var img = cx.createImageData(A, A);
    var d = img.data;
    /* v157.94：法线图集（与配色同布局）*/
    var ncv = document.createElement('canvas'); ncv.width = A; ncv.height = A;
    var ncx = ncv.getContext('2d'); var nimg = ncx.createImageData(A, A);
    var nd = nimg.data;
    /* 每面高度场（先存下来，法线用差分求；避免重复调 sphElev）*/
    var hArr = new Float32Array(N * N);
    var seeded = seed3 ? seed3() : 0, P = (SP && SP.PLANET) ? SP.PLANET : {};
    for (var fi = 0; fi < 6; fi++) {
      var ox = (fi % 4) * N, oy = ((fi / 4) | 0) * N, fn = F[fi];
      for (var y = 0; y < N; y++) {
        var v = -1 + 2 * (y + 0.5) / N;
        for (var x = 0; x < N; x++) {
          var u = -1 + 2 * (x + 0.5) / N;
          var p = fn(u, v);
          var L = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 1;
          var dx = p[0] / L, dy = p[1] / L, dz = p[2] / L;
          var e = sphElev([dx, dy, dz]);
          var c = sphBiome(e, dy, [dx, dy, dz], true);
          var o = ((oy + y) * A + (ox + x)) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
          hArr[y * N + x] = Math.max(0, e) * HSC;      /* 世界单位的相对高度 */
        }
      }
      /* ---- 球面原生法线 + 曲率遮蔽，写进法线图集 ----
       * v158.54（老板「星球闪变…始终没有解决为什么星球有死角，有该死的轴线。
       *   那轴线只做标识用。从生成层面消失死角」）——
       * 病根（探针 p_diag_v15854_atlas_seam 实测）：改前每个 cube 面用**自己的面参数
       *   fn(u,v) 的切向 + 面内差分**烘焙法线，六个面在共享棱上切基不同、边缘还是
       *   单边差分 → 图集法线跨棱平均差 68.65/765、最大 358/765（近乎反向）。
       *   顶点法线虽早在 v157.89 焊接到 0.02°，但 RELIEF_TEX 下片元读的是这张图集 ——
       *   那条看起来像"轴线/死角"的直线、以及转动时的闪变，就来自这里。
       * 修法（生成层，不是相机/渲染补丁）：法线改由**球面原生 3D 梯度**生成 ——
       *   同一 3D 方向 d 在任意 cube 面、任意纹素都得到同一条法线（与面参数化无关），
       *   跨棱零缝。切基只依赖 d 且带极点兜底（与 SP.tangentOf 同口径，避免新极点）。
       * 曲率遮蔽同样是球面原生（4 邻域沿 d 的切向取），不再用面参数 hArr 的单边邻居。 */
      var epsS = 1.5 / N;                             /* 球面角步长 ≈ 一个纹素 */
      var _t1 = [0, 0, 0], _t2 = [0, 0, 0], _d0 = [0, 0, 0];
      function sphBasis(d) {
        /* 全局一致的球面切平面基：只依赖方向 d，不依赖 cube 面参数。
           极点（|y|>0.9）换参考轴，消除 d=(0,±1,0) 处 cross 退化。 */
        var wx = 0, wy = 1, wz = 0;
        if (Math.abs(d[1]) > 0.9) { wx = 1; wy = 0; }
        var px = wy * d[2] - wz * d[1], py = wz * d[0] - wx * d[2], pz = wx * d[1] - wy * d[0];
        var pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
        _t1[0] = px / pl; _t1[1] = py / pl; _t1[2] = pz / pl;
        _t2[0] = d[1] * _t1[2] - d[2] * _t1[1];
        _t2[1] = d[2] * _t1[0] - d[0] * _t1[2];
        _t2[2] = d[0] * _t1[1] - d[1] * _t1[0];
      }
      /* 球面法线专用的**低频高度**：法线只描述山脊/谷地的形状趋势，高频颗粒由
         uDetailTex 负责。完整 sphElev 是 8 octaves，逐像素差分把高频也 EXAG 放大，
         正是"星球闪变"（细碎明暗随转动跳）的来源之一。
         这里只用 SP.fbm3 的低 3 阶（与 contField/mountainField 同源），省 5/8 算力
         且法线更平滑；颜色图集仍用完整 sphElev，地形配色不受影响。 */
      function elevAt(d, t, s) {
        var x = d[0] + t[0] * s, y = d[1] + t[1] * s, z = d[2] + t[2] * s;
        var l = Math.sqrt(x * x + y * y + z * z) || 1;
        x /= l; y /= l; z /= l;
        var sd = (SP && SP.seed3) ? SP.seed3() : 0;
        var base = SP.fbm3([x, y, z], 1.1, sd + 11) * 2.2;   /* 大陆骨架 */
        var ridge = 1 - Math.abs(2 * SP.fbm3([x, y, z], 2.8, sd + 77) - 1);
        return Math.max(0, base + ridge * ridge * 0.9);
      }
      for (var yy = 0; yy < N; yy++) {
        for (var xx = 0; xx < N; xx++) {
          var hC = hArr[yy * N + xx];
          /* 该纹素的球面方向 d（与颜色采样同一 pC，跨面同 d 必同法线）*/
          var uu = -1 + 2 * (xx + 0.5) / N, vv = -1 + 2 * (yy + 0.5) / N;
          var pC = fn(uu, vv);
          var lC = Math.sqrt(pC[0] * pC[0] + pC[1] * pC[1] + pC[2] * pC[2]) || 1;
          var rx = pC[0] / lC, ry = pC[1] / lC, rz = pC[2] / lC;
          _d0[0] = rx; _d0[1] = ry; _d0[2] = rz;
          sphBasis(_d0);
          /* e0 必须与 elevAt 同口径（低频），否则 g=(邻-e0) 混了两套尺度 →
             海洋处冒出巨大常数梯度。hC 仍给颜色/曲率的完整高度用。 */
          var e0 = elevAt(_d0, _t1, 0);
          /* 球面原生梯度：中心差分（对称 → 棱两侧同 d 必同法线；前向差分实测
             接缝反而从 18 涨到 30，因为不对称放大了采样点微差）。4 邻域共用一次
             方向量化缓存，cube 六面共享棱的采样点方向重合 → 命中，压住首屏耗时。 */
          var eT1p = elevAt(_d0, _t1, epsS), eT1m = elevAt(_d0, _t1, -epsS);
          var eT2p = elevAt(_d0, _t2, epsS), eT2m = elevAt(_d0, _t2, -epsS);
          var g1 = (eT1p - eT1m) / (2 * epsS);
          var g2 = (eT2p - eT2m) / (2 * epsS);
          /* 曲面切向 = R·t + r·(dh/ds)；高度远小于半径，一阶近似 */
          var Pux = R * _t1[0] + rx * g1 * HSC, Puy = R * _t1[1] + ry * g1 * HSC, Puz = R * _t1[2] + rz * g1 * HSC;
          var Pvx = R * _t2[0] + rx * g2 * HSC, Pvy = R * _t2[1] + ry * g2 * HSC, Pvz = R * _t2[2] + rz * g2 * HSC;
          var nx = Puy * Pvz - Puz * Pvy, ny = Puz * Pvx - Pux * Pvz, nz = Pux * Pvy - Puy * Pvx;
          var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
          if (nx * rx + ny * ry + nz * rz < 0) { nx = -nx; ny = -ny; nz = -nz; }
          /* 法线夸张：与顶点版同口径（切向 ×EXAG，tanθ'=EXAG·tanθ）*/
          var _exg = (M.RELIEF_EXAG == null ? 2.0 : +M.RELIEF_EXAG);
          var _dd = nx * rx + ny * ry + nz * rz;
          var _tx = nx - _dd * rx, _ty = ny - _dd * ry, _tz = nz - _dd * rz;
          var _ex = rx + _tx * _exg, _ey = ry + _ty * _exg, _ez = rz + _tz * _exg;
          var _el = Math.sqrt(_ex * _ex + _ey * _ey + _ez * _ez) || 1;
          nx = _ex / _el; ny = _ey / _el; nz = _ez / _el;
          /* 曲率遮蔽（球面原生 4 邻域）：谷地暗、山脊微亮 */
          var lap = hC - (eT1p + eT1m + eT2p + eT2m) * HSC / 4;
          var sh = 1 + lap * (M.CURV_K == null ? 0.18 : M.CURV_K);
          if (sh < 0.74) sh = 0.74; else if (sh > 1.06) sh = 1.06;
          var no = ((oy + yy) * A + (ox + xx)) * 4;
          nd[no] = Math.round((nx * 0.5 + 0.5) * 255);
          nd[no + 1] = Math.round((ny * 0.5 + 0.5) * 255);
          nd[no + 2] = Math.round((nz * 0.5 + 0.5) * 255);
          nd[no + 3] = Math.round(((sh - 0.74) / 0.32) * 255);
        }
      }
    }
    cx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;                        /* 关键：按行序烘 → 不许再翻 */
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    try { tex.anisotropy = 8; } catch (eA) { }
    tex._shared = true;
    ncx.putImageData(nimg, 0, 0);
    var ntex = new THREE.CanvasTexture(ncv);
    ntex.flipY = false;
    ntex.wrapS = ntex.wrapT = THREE.ClampToEdgeWrapping;
    ntex.minFilter = THREE.LinearMipmapLinearFilter;
    ntex.magFilter = THREE.LinearFilter;
    ntex.generateMipmaps = true;
    try { ntex.anisotropy = 8; } catch (eN2) { }
    ntex._shared = true;
    M._nrmTex = ntex;
    if (M._nrmTexU) M._nrmTexU.value = ntex;
    M._nrmAtlasMs = M._colAtlasMs;
    M._colAtlasErr = 'ok';
    M._colAtlasKey = _key;
    M._colAtlasMs = Math.round(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0);
    return tex;
  }

  /* cube-sphere 地形（**球面原生噪声 · 连续无缝**）：顶点全球均匀，地形直接在球面生成。*/
  function buildGlobe() {
    /* v90.78：重建安全 —— 换星球时先移除旧的星球网格与海面（否则会**叠加**多颗球）。 */
    if (globe) { scene.remove(globe); if (globe.geometry) globe.geometry.dispose(); globe = null; }
    if (water) { scene.remove(water); if (water.geometry) water.geometry.dispose(); water = null; }
    var VW = K + 1;
    var FACES = (SP && SP.CUBE_FACES) ? SP.CUBE_FACES : [
      function (u, v) { return [1, v, u]; }, function (u, v) { return [-1, v, -u]; },
      function (u, v) { return [u, 1, -v]; }, function (u, v) { return [u, -1, v]; },
      function (u, v) { return [u, v, 1]; }, function (u, v) { return [-u, v, -1]; }
    ];
    var pos = [], col = [], nor = [], idx = [], uv = [], facA = [];
    var _vx0 = [], _vx1 = [], _vxt = [];      /* v157.86：每顶点的 c0/c1/混合权重 */
    FACES.forEach(function (fn, fi) {   /* v157.93：要的是面号（顶点 aFace 用它偏移图集）*/
      var base = pos.length / 3;
      /* ============================================================
       * v155k（老板：「球体上有明显的直线分界」）
       * ------------------------------------------------------------
       * 根因：六个 cube-sphere 面的**参数化方向不一致**（有的面是镜像的），
       * 生成的三角形绕向因此有正有反。改成 FrontSide 后，绕向反的那几个面
       * 被背面剔除 → 直接露出背景色（就是那条笔直的分界）。
       * 修法：**逐面探测绕向**，反的面把索引顺序翻过来。
       * ============================================================ */
      /* v155k：绕向判定统一走 sphere.js 的 SP.faceFlipOf（几何唯一约定）。
         ⚠️ 上一版在这里自己算叉积、顺序搞反 → 六个面全被翻 → 整球透明。 */
      var _flip = false;
      try { _flip = (SP && SP.faceFlipOf) ? SP.faceFlipOf(fn, 2 / K) : false; } catch (eF) { _flip = false; }
      for (var j = 0; j < VW; j++) for (var i = 0; i < VW; i++) {
        var u = -1 + 2 * i / K, v = -1 + 2 * j / K, p = fn(u, v);
        var L = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        var dx = p[0] / L, dy = p[1] / L, dz = p[2] / L;
        var e = sphElev([dx, dy, dz]);                     /* 球面原生高度（连续 · 无接缝 · 不来自平面地图）*/
        /* ============================================================
         * v157.92：**给海一个真正的海盆**（老板「海水露底了……海水没有厚度」）
         * ------------------------------------------------------------
         * 改前 `Math.max(0, e)` 把**负高程截成 0** ⇒ 所有海底都正好在 R 这张球面上，
         * 而水面在 R+1.0、浪高 ±1.5 → **波谷一低就穿到海底下面**，
         * 露出来的正是球体那层深蓝"湖色" → 看到的就是一块块深色六边形斑。
         * 改后负高程按 SEA_DEPTH 折算成真实深度（浅海浅、深海深），
         * 于是水面与海床之间有了真实的厚度，波谷也吃不穿。
         * ⚠️ 系数取 0.45 而不是 1：海床再深也不会把海岸弄成悬崖（陆地侧仍用满 HSC）。
         * ============================================================ */
        var _eH = (e >= 0) ? (e * HSC) : (e * HSC * 0.45);
        var rr = R + _eH;
        pos.push(dx * rr, dy * rr, dz * rr);
        /* v157.89：**占位** —— 真法线等六个面全建完后统一求（见下方 buildTerrainNormals）。
           ⚠️ 改前这里是 `nor.push(dx,dy,dz)`（径向法线）：它与地形起伏完全无关，
           实测偏离径向 最大 0.02° / 平均 0° —— 山脊与山谷受光一模一样，
           这就是「球体像贴了张地图的纸」的根因，也是「换受光材质也没用」的原因。*/
        nor.push(0, 0, 0);
        uv.push(i / K, j / K);
        /* v157.75：`soft=true` —— 顶点级邻格软混合，消除「一格一色」的六边形硬边。
           地表近景（1186 / 1325 / 1362 三处调用）不传，保持地块硬边。 */
        var c = sphBiome(e, dy, [dx, dy, dz], true);
        /* v157.93：走图集时顶点色只存**明暗系数**（默认 1），颜色由片元采样图集；
           图集不可用（烘焙失败/被关）则退回原样存基色。 */
        if (M.useColorAtlas) { col.push(1, 1, 1); facA.push(fi); }
        else { col.push(c[0] / 255, c[1] / 255, c[2] / 255); facA.push(0); }
        _vx0.push(_lastSoft.ci0); _vx1.push(_lastSoft.ci1); _vxt.push(_lastSoft.t);
      }
      for (var z = 0; z < K; z++) for (var x = 0; x < K; x++) {
        var a = base + z * VW + x, b = a + 1, c2 = a + VW, d = c2 + 1;
        if (_flip) idx.push(a, b, c2, b, d, c2);
        else idx.push(a, c2, b, b, c2, d);
      }
    });
    /* ============================================================
     * v157.89：**真地形法线**（老板「球体是空壳，可以全填充吗」的续集）
     * ------------------------------------------------------------
     * 取舍说明：原计划是「把 Basic 换成 Lambert 受光材质」，取证后发现那条路会白做 ——
     *   `nor` 全是径向，Lambert 拿径向法线算出来只是**一颗光滑的球**（与现有昼夜线同果），
     *   山脊山谷照样一样亮。真正缺的是「地形法线」；补上它，起伏才有受光。
     *   材质仍留 Basic：场景那四盏灯（太阳 3.2 强度）一旦真正参与，会把整颗球打爆成白，
     *   并连带改变地表建筑/单位的观感 —— 那是另一件事，不在 P0 范围内。
     *
     * 算法：三角面法线（叉积，模长 = 2×面积 → 天然面积加权）累加到顶点；
     *   再按「方向」跨面焊接 —— cube-sphere 六片在公共边上有重复顶点，
     *   不焊接会沿六条大圆出现接缝亮/暗线（正是老板最反感的"色斑"）。
     * ============================================================ */
    (function buildTerrainNormals() {
      var nv = pos.length / 3;
      var acc = new Float32Array(nv * 3), wmap = Object.create(null);
      var hArr = new Float32Array(nv);
      var nbSum = new Float32Array(nv), nbCnt = new Float32Array(nv);
      var vi, k, px, py, pz, L, j3;
      for (vi = 0; vi < nv; vi++) {
        j3 = vi * 3; px = pos[j3]; py = pos[j3 + 1]; pz = pos[j3 + 2];
        L = Math.sqrt(px * px + py * py + pz * pz) || 1;
        hArr[vi] = L;                     /* 该顶点的球心距 = 地形高度（R + 归一化高度×HSC）*/
        k = (px / L).toFixed(5) + ',' + (py / L).toFixed(5) + ',' + (pz / L).toFixed(5);
        if (!wmap[k]) wmap[k] = [];
        wmap[k].push(vi);
      }
      for (var t = 0; t < idx.length; t += 3) {
        var ia = idx[t], ib = idx[t + 1], ic = idx[t + 2];
        var a3 = ia * 3, b3 = ib * 3, c3 = ic * 3;
        var ax = pos[a3], ay = pos[a3 + 1], az = pos[a3 + 2];
        var ux = pos[b3] - ax, uy = pos[b3 + 1] - ay, uz = pos[b3 + 2] - az;
        var vx = pos[c3] - ax, vy = pos[c3 + 1] - ay, vz = pos[c3 + 2] - az;
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        /* 朝外统一：六个面绕向不一致 → 用径向点积定向（与 SP.faceFlipOf 同一约定）*/
        if (nx * ax + ny * ay + nz * az < 0) { nx = -nx; ny = -ny; nz = -nz; }
        acc[a3] += nx; acc[a3 + 1] += ny; acc[a3 + 2] += nz;
        acc[b3] += nx; acc[b3 + 1] += ny; acc[b3 + 2] += nz;
        acc[c3] += nx; acc[c3 + 1] += ny; acc[c3 + 2] += nz;
        /* 邻点高程累加（求曲率用 —— 谷地/山脊的判据）*/
        nbSum[ia] += hArr[ib] + hArr[ic]; nbCnt[ia] += 2;
        nbSum[ib] += hArr[ia] + hArr[ic]; nbCnt[ib] += 2;
        nbSum[ic] += hArr[ia] + hArr[ib]; nbCnt[ic] += 2;
      }
      var weldN = 0;
      for (var kk in wmap) {
        var list = wmap[kk];
        if (list.length < 2) continue;
        weldN += list.length;
        var sx = 0, sy = 0, sz = 0, q, i2, i3;
        for (q = 0; q < list.length; q++) {
          i2 = list[q] * 3;
          sx += acc[i2]; sy += acc[i2 + 1]; sz += acc[i2 + 2];
        }
        for (q = 0; q < list.length; q++) {
          i3 = list[q] * 3;
          acc[i3] = sx; acc[i3 + 1] = sy; acc[i3 + 2] = sz;
        }
      }
      /* 曲率：顶点高程 − 邻点平均高程。先量样本平均幅度，再定归一化系数，
         这样换星球 / 换地形尺度都不用改常数（不写死"每单位多少"）。*/
      var curv = new Float32Array(nv), cavg = 0, cn = 0;
      for (var vc = 0; vc < nv; vc++) {
        if (!nbCnt[vc]) continue;
        curv[vc] = hArr[vc] - nbSum[vc] / nbCnt[vc];
        cavg += Math.abs(curv[vc]); cn++;
      }
      cavg = cavg / (cn || 1);
      var kA = (0.20 / (cavg > 1e-4 ? cavg : 1)), shMin = 1, shMax = 1;
      var EXAG = (M.RELIEF_EXAG == null ? 2.0 : +M.RELIEF_EXAG);
      var shade = new Float32Array(nv);

      var devMax = 0, devSum = 0;
      for (var vj = 0; vj < nv; vj++) {
        j3 = vj * 3;
        px = pos[j3]; py = pos[j3 + 1]; pz = pos[j3 + 2];
        L = Math.sqrt(px * px + py * py + pz * pz) || 1;
        var rx = px / L, ry = py / L, rz = pz / L;
        var x2 = acc[j3], y2 = acc[j3 + 1], z2 = acc[j3 + 2];
        var L2 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);
        var ux2, uy2, uz2;
        if (L2 > 1e-9) { ux2 = x2 / L2; uy2 = y2 / L2; uz2 = z2 / L2; }
        else { ux2 = rx; uy2 = ry; uz2 = rz; }
        /* ============================================================
         * v157.106（老板「事实很糟糕」那张图）：**水下地形一律压平**
         * ------------------------------------------------------------
         * 海面若因任何原因没盖住（着色器失败/遮罩偏移/裁剪），露出来的就是海底；
         * 而海底现在有真实起伏（v157.92 的海盆）→ 看起来就是"蓝色山峰"。
         * 与其继续在"为什么没盖住"上赌，不如让**海底本身不像地形**：
         *   · 法线取径向（不参与受光 → 没有任何明暗起伏）
         *   · 曲率遮蔽置 1（不再压暗/提亮）
         * 于是无论水面在不在，海都是平的。水面只负责浪与反光。
         * ============================================================ */
        if (hArr[vj] < R - 0.02) {
          nor[j3] = rx; nor[j3 + 1] = ry; nor[j3 + 2] = rz;
          shade[vj] = 1.0;
          continue;
        }
        var d0 = rx * ux2 + ry * uy2 + rz * uz2;
        var ang = Math.acos(Math.max(-1, Math.min(1, d0))) * 180 / Math.PI;
        devSum += ang; if (ang > devMax) devMax = ang;
        /* ① 法线夸张：保留"朝外"分量，切向分量 × EXAG（tanθ' = EXAG·tanθ）*/
        var tx = ux2 - d0 * rx, ty = uy2 - d0 * ry, tz = uz2 - d0 * rz;
        var ex = rx + tx * EXAG, ey = ry + ty * EXAG, ez = rz + tz * EXAG;
        var Le = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
        nor[j3] = ex / Le; nor[j3 + 1] = ey / Le; nor[j3 + 2] = ez / Le;
        /* ② 曲率遮蔽：谷地压暗到 0.74、山脊最多提亮到 1.06（不对称 —— 怕把亮色顶爆）*/
        var sh = 1 + curv[vj] * kA;
        if (sh < 0.74) sh = 0.74; else if (sh > 1.06) sh = 1.06;
        shade[vj] = sh;
        if (sh < shMin) shMin = sh; if (sh > shMax) shMax = sh;
      }
      M._globeShade = shade;             /* 由 buildGlobe 落成顶点属性 aShade */
      M._globeNrmArr = nor;              /* v157.89c：给明暗归一化算枢轴用 */
      if (M._recalcRelPivot) M._recalcRelPivot();
      /* 自检出口：改前 maxDeg/avgDeg 应恒 0；改后应显著 > 0（法线真随地形走）*/
      M._globeNrmStat = {
        verts: nv, welded: weldN, exag: EXAG,
        maxDeg: +devMax.toFixed(2), avgDeg: +(devSum / (nv || 1)).toFixed(2),
        curvMeanAbs: +cavg.toFixed(3), kA: +kA.toFixed(3),
        shadeMin: +shMin.toFixed(3), shadeMax: +shMax.toFixed(3)
      };
    })();
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    /* v157.86：**原始顶点色副本** —— 「已探索提亮」每次迷雾变化都从它乘回来。
       ⚠️ 必须在 setAttribute 之后取（BufferAttribute 会自己复制一份 Float32Array，
          `col` 原数组不会被就地改写，副本与原色永远同源）。 */
    M._globeColBase = new Float32Array(col);
    M._globeVtxCell = { ci0: _vx0, ci1: _vx1, t: _vxt };
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    /* v157.93：立方体面号（片元按它偏移到图集对应格）*/
    geo.setAttribute('aFace', new THREE.Float32BufferAttribute(facA, 1));
    /* v15789：曲率遮蔽系数（每顶点一个标量，1 = 无影响）。复用 uRelief 同一个闸门。*/
    if (M._globeShade) geo.setAttribute('aShade', new THREE.Float32BufferAttribute(M._globeShade, 1));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    /* ⛔ v157.76：`M._globeColBase`（原始顶点色副本，供顶点色压暗乘回原色）
       随 `paintGlobeFog` 一起退役 —— globe 顶点色自 buildGlobe 之后不再被改写，
       副本已无消费者。
    /* v155h（性能）：**单面**渲染。DoubleSide 会把球背面（永远看不到）也逐像素光栅化 ——
       实测地形球单独渲染 232ms，其中约一半花在背面。
       单面后球背的三角面被背面剔除，像素量减半。 */
    var _gmat243 = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide });
    applyTerminator(_gmat243, true);    /* v92.243 昼夜线 + v157.89 地形起伏明暗（仅球面）*/
    globe = new THREE.Mesh(geo, _gmat243);
    /* v156.70：暴露地形网格，供几何自检（射线量"线框是否贴地"）。
       之前没有这个出口，只能用 _collider（半径 R+0.6 的光滑球）当基准，
       量出来的偏差全是假的 —— 差点据此误判。 */
    M._globe = globe;
    /* v157.86：**建完立刻重画一次"已探索提亮"**。
       ⚠️ 这是本轮踩到的真坑：`buildGlobe` 会用 sphBiome 的原色**重建整条 color 属性**，
       而 fog 版本没变 → `buildFog()` 不会再被调用 → 提亮被静默抹掉。
       探针实测：把 LIT 压到 0.05 画面也不变黑，关掉 globe 才看到
       "正在构建星球…100%"—— 说明每次都在重建，改的色根本没上屏。 */
    try { paintGlobeExplore(); } catch (ePG0) { }
    /* v156.71：记录"这块网格是按哪颗星球建的" —— 分层自检据此判断
       数据层与渲染层是否同源。不做这个记录时，脱节在画面上只表现为
       "边界线飘着""地形对不上"，没有数字可查。 */
    try {
      M._worldSeed = (SP.seed3 ? SP.seed3() : null);
      M._worldVer = SP.worldVer || 0;
    } catch (eWV) { }
    /* ============================================================
     * v157.90b：球面**不再挂颜色细节贴图**（整段删除，不是关掉）
     * ------------------------------------------------------------
     * 取证链（老板两张近景截图 + 逐层隔离）：
     *   · 只留球体网格（其余全部隐藏）→ 小记号仍在；
     *   · 关掉顶点色、只留贴图 → 记号仍在；
     *   · 关掉贴图 → 记号消失。
     * ⇒ 记号来自**贴图**。任何"平铺的程序化噪声"在某个缩放/角度都会把格点露出来：
     *   repeat 7 是大软块，repeat 48 是规则小记号 —— 调参数只是换一种花样（已试过 20/40/70/120）。
     * 结论：球面用**纯顶点色 + 起伏明暗**。近景要有真质感只能上正式的高程/反照率贴图（素材活），
     *       不是再调一次 repeat 能解决的。
     * ⚠️ 只撤球面这一处；`_detailTexU`（法线高度场）保留给 `M.setDetail()`，默认关。
     * ============================================================ */
    if (M._detailTexU) { try { M._detailTexU.value = makeGrainTex(); } catch (eG) { } }
    /* v157.93：烘地貌配色图集（一次性；耗时写进 M._colAtlasMs 供探针）*/
    if (M.useColorAtlas) {
      /* v157.95：高程图（水面裁剪用）。1024×512 足够：赤道处一格 1.84 世界单位 */
      try {
        if (!M._elevTex || M._elevPlanetKey !== (SP.seed3 ? SP.seed3() : 0)) {
          M._elevTex = bakeElevTex(1024, 512);
          M._elevPlanetKey = (SP.seed3 ? SP.seed3() : 0);
          if (M._elevTexU) M._elevTexU.value = M._elevTex;
        }
      } catch (eET) { M._elevErr = String(eET && (eET.message || eET)); }
      try {
        var _ct = bakeColorAtlas(+M.COLOR_ATLAS_N || 256);
        if (_ct) { M._colTex = _ct; if (M._colTexU) M._colTexU.value = _ct; }
      } catch (eCT) { M._colTex = null; M._colAtlasErr = String(eCT && (eCT.message || eCT)); }
    }
    M._globeMat = globe.material;
    scene.add(globe);
    /* ============================================================
     * v155（老板：「要波浪，不是要诡异」「海洋颜色采用旧方案，只是波浪形态改变」
     *   ＋参考工程 `WorkBuddy/2026-10-27-20-10-37/water-sphere.html`）
     * ------------------------------------------------------------
     * 旧方案 = 纯色 `#4a7fa0` 不透明球（v90.58 定的）。现在：
     *   · **颜色不动**（同一个 0x4a7fa0）；
     *   · 波浪改成参考工程的**真几何**做法：顶点沿法线位移（3 层 fbm，振幅递减、
     *     速度不同），法线用有限差分算，片元只做 diffuse + fresnel；
     *   · 海面**只覆盖水格**（不再是一整颗球）—— 海岸线精确、也不会盖住陆地。
     * 参考：surface(dir) = dir*(R + fbm(dir)*amp)，nN = cross(T-P, B-P)。
     * ============================================================ */
    /* ============================================================
     * v155i：水面几何 + **离岸距离场**
     * ------------------------------------------------------------
     * `uCoast`：0 = 岸边（浪高 0）、1 = 离岸 ≥3 格（满浪高）。
     * 用一次 BFS：从"邻接陆地的水格"出发，向水内部扩散层数。
     * 于是浪自动在海岸线附近平息 —— 交界不再有"浪切进沙滩"。
     * ============================================================ */
    var wpos = [], wcnt = 0, wcoast = [];
    /* ============================================================
     * v157.92b：`uCoast` 改成**按顶点自身深度**算（原来按"格"）
     * ------------------------------------------------------------
     * 原来一格一个值（`_cv`），相邻格在 0 与 1 之间跳变 → 浪高在格边界**突跳** →
     * 看到的就是一块块六边形（老板「出现六边形边界」）。
     * 改成用该顶点方向的水深：同一位置必得同一个值 ⇒ 跨格连续，
     * 浪随深度平滑减弱（岸边平、深海满），也没有"平格子"的斑。
     * ============================================================ */
    function _coastOfDir(dd) {
      var _d = Math.hypot(dd[0], dd[1], dd[2]) || 1;
      var _dep = -sphElev([dd[0] / _d, dd[1] / _d, dd[2] / _d]);   /* >0 = 水下深度（高程单位）*/
      var _t = _dep / 0.05;                                        /* 0.05 高程 ≈ 1.3 世界单位深 */
      return _t < 0 ? 0 : (_t > 1 ? 1 : _t);
    }
    try {
      var _fc = SP.faceCell, _fp = SP.fpos, _cl = SP.cells, _adj = SP.adj;
      /* ① 岸边水格 = 有陆地邻居的水格 */
      var coastD = new Int16Array(_cl.length).fill(-1);
      var q0 = [];
      for (var _i1 = 0; _i1 < _cl.length; _i1++) {
        var _cc1 = _cl[_i1];
        if (!_cc1 || _cc1.type !== 'lake') continue;
        var _an1 = _adj[_i1] || [], _isCoast = false;
        for (var _j1 = 0; _j1 < _an1.length; _j1++) {
          var _nb1 = _cl[_an1[_j1]];
          if (_nb1 && _nb1.type !== 'lake') { _isCoast = true; break; }
        }
        if (_isCoast) { coastD[_i1] = 0; q0.push(_i1); }
      }
      /* ② 向内扩散（只走水格），量到 6 层就够 */
      var _head = 0;
      while (_head < q0.length) {
        var _cur = q0[_head++], _d0 = coastD[_cur];
        if (_d0 >= 6) continue;
        var _an2 = _adj[_cur] || [];
        for (var _j2 = 0; _j2 < _an2.length; _j2++) {
          var _nb2 = _an2[_j2];
          if (coastD[_nb2] !== -1) continue;
          var _cn2 = _cl[_nb2];
          if (!_cn2 || _cn2.type !== 'lake') continue;
          coastD[_nb2] = _d0 + 1; q0.push(_nb2);
        }
      }
      /* ============================================================
       * v155j（性能）：**每格一个多边形 + 索引**（不再"每格 6 个三角面各写 3 个顶点"）
       * 六边形 6 个外沿 + 1 个中心 = 7 顶点 / 6 三角，比原来省 ~2.5 倍顶点。
       * ============================================================ */
      var _idx = [];
      for (var _w = 0; _w < _cl.length; _w++) {
        var _c = _cl[_w];
        if (!_c || _c.type !== 'lake' || !_c.rim) continue;
        var _cd = coastD[_w];
        var _cv = (_cd < 0) ? 1 : Math.min(1, _cd / 3);     /* 0=岸边 · 1=离岸 3 格以上 */
        var _base = wpos.length / 3;
        /* 中心点（方向中心 × 水面半径） */
        var _d = _c.dir, _dl = Math.hypot(_d[0], _d[1], _d[2]) || 1;
        var _dc = [_d[0] / _dl, _d[1] / _dl, _d[2] / _dl];
        /* ============================================================
         * v157.92c：**把水边贴到等高线**（治海岸线的六边形台阶）
         * ------------------------------------------------------------
         * 水按整格画 → 岸线是一圈六边形边。这里对每个外沿顶点：
         *   · 它在水下 → 原样保留；
         *   · 它在水上（该点是陆地）→ 沿"格心 → 该点"内插到高程 = 0 的位置，
         *     于是水面边界落在水陆交界处，精度从"整格"提到"亚格"。
         * 格心也在水上（整格都是陆地）→ 整格不画。
         * ============================================================ */
        var _eC = sphElev(_dc);
        /* ⚠️ v157.92e：**不能只看格心**。实测 19152 个水格里 26 个"格心在水上、
           外沿仍在水下"——只看格心会把它们整格跳过，海面上就打出一个洞（老板「露底」）。
           现在要"格心 + 全部外沿都在水上"才判定整格皆陆。*/
        var _rimE = [], _anyWet = (_eC < 0);
        for (var _k0 = 0; _k0 < _c.rim.length; _k0++) {
          var _q0 = _c.rim[_k0], _q0l = Math.hypot(_q0[0], _q0[1], _q0[2]) || 1;
          var _e0 = sphElev([_q0[0] / _q0l, _q0[1] / _q0l, _q0[2] / _q0l]);
          _rimE.push(_e0);
          if (_e0 < 0) _anyWet = true;
        }
        /* v157.92f：整格都在水面之上的"湖格"（实测 4/19152）——
          跳过就在海面留一个洞（就是老板截图那块浅蓝）。这里**照画一块水平水面盖住**：
          少 4 格物理正确，换整片海面无缝，值。*/
        if (_eC >= 0) _eC = -1e-4;                    /* 格心干、外沿湿：把格心按水线算 */
        var _flatCell = !_anyWet;                     /* 整格皆干 → 不裁剪，平铺盖住 */
        wpos.push(_dc[0] * (R + 1.0), _dc[1] * (R + 1.0), _dc[2] * (R + 1.0));
        wcoast.push(_flatCell ? 1 : _coastOfDir(_dc));
        var _mm = _c.rim.length;
        for (var _k = 0; _k < _mm; _k++) {
          var _p = _c.rim[_k], _pl = Math.hypot(_p[0], _p[1], _p[2]) || 1;
          var _pd = [_p[0] / _pl, _p[1] / _pl, _p[2] / _pl];
          var _eR = _rimE[_k];
          if (_eR >= 0 && !_flatCell) {
            /* 插值到高程 0：t 从格心(负) 走到该点(正) */
            var _t = _eC / (_eC - _eR);
            if (_t < 0) _t = 0; else if (_t > 1) _t = 1;
            var _ix = _dc[0] + (_pd[0] - _dc[0]) * _t;
            var _iy = _dc[1] + (_pd[1] - _dc[1]) * _t;
            var _iz = _dc[2] + (_pd[2] - _dc[2]) * _t;
            var _il = Math.hypot(_ix, _iy, _iz) || 1;
            _pd = [_ix / _il, _iy / _il, _iz / _il];
            wpos.push(_pd[0] * (R + 1.0), _pd[1] * (R + 1.0), _pd[2] * (R + 1.0));
            wcoast.push(_flatCell ? 1 : 0);          /* 水线处浪高归零；整格皆干的"补丁格"按满浪融入周围 */
          } else {
            wpos.push(_pd[0] * (R + 1.0), _pd[1] * (R + 1.0), _pd[2] * (R + 1.0));
            wcoast.push(_flatCell ? 1 : _coastOfDir(_pd));
          }
        }
        for (var _k2 = 0; _k2 < _mm; _k2++) {
          _idx.push(_base, _base + 1 + _k2, _base + 1 + ((_k2 + 1) % _mm));
        }
        wcnt++;
      }
      M._waterIdx = _idx;
    } catch (eW0) { /* 取不到水格 → 走兜底整球 */ }
    /* ============================================================
     * v155h（性能）：水面**按距离换档**
     * ------------------------------------------------------------
     * "只覆盖水格"的做法顶点 = 水格三角面 ≈ 73 万（40962 格里一半是水）——
     * 实测每帧 +150ms，纯属浪费：远看根本分不出"水格拼出来的"和"整球"。
     *   · 近（camO.dist 小）：真实水格（海岸线精确）
     *   · 远：一颗低模整球（96×64）
     * 两套几何都在切换点重建，避免每帧重建。
     * ============================================================ */
    var wg;
    /* ============================================================
     * v157.95：**水球**（老板「海面没有厚度，导致持续空洞」的终止方案）
     * ------------------------------------------------------------
     * 不用水格多边形了：一颗完整球，海岸线交给片元按高程图 discard。
     * 顶点半径无所谓 —— 顶点着色器本来就用 `normalize(position)` 重算表面。
     * uCoast 仍按顶点方向的水深给（岸边平浪、深海满浪），与旧口径一致。
     * ============================================================ */
    if (M.WATER_SPHERE) {
      wg = new THREE.SphereGeometry(1.0, 160, 120);
      var _nvS = wg.attributes.position.count;
      var _posS = wg.attributes.position.array;
      var _cs = new Float32Array(_nvS);
      for (var _iS = 0; _iS < _nvS; _iS++) {
        var _ax = _posS[_iS * 3], _ay = _posS[_iS * 3 + 1], _az = _posS[_iS * 3 + 2];
        var _al = Math.sqrt(_ax * _ax + _ay * _ay + _az * _az) || 1;
        var _dep = -sphElev([_ax / _al, _ay / _al, _az / _al]);
        var _tt = _dep / 0.05;
        _cs[_iS] = _tt < 0 ? 0 : (_tt > 1 ? 1 : _tt);
      }
      wg.setAttribute('uCoast', new THREE.Float32BufferAttribute(_cs, 1));
      wcnt = 1;
    } else if (wcnt) wg = new THREE.BufferGeometry();
    else {
      wg = new THREE.SphereGeometry(R + 0.4, 96, 64);
      /* v155i：兜底整球没有"离岸距离场" → 补一个全 1（否则 attribute 缺省 0，浪全平） */
      var _nv0 = wg.attributes.position.count, _c1 = new Float32Array(_nv0);
      for (var _i0 = 0; _i0 < _nv0; _i0++) _c1[_i0] = 1;
      wg.setAttribute('uCoast', new THREE.Float32BufferAttribute(_c1, 1));
    }
    if (wcnt && !M.WATER_SPHERE) {
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
      if (wcoast.length) wg.setAttribute('uCoast', new THREE.Float32BufferAttribute(wcoast, 1));
      if (M._waterIdx && M._waterIdx.length) wg.setIndex(M._waterIdx);
    }
    M._waterTiled = wcnt ? wg : null;          /* 近景用 */
    M._waterDenseVerts = wcnt;
    /* ⛔ v155i（老板：「海洋陆地交界处不对劲」）：
       **不再"远看换整球"** —— 整球半径 R+0.4 会把低洼陆地一起淹掉，
       于是同一个 seed 近看有海岸、远看没有（同一局两种世界）。
       统一只用"水格拼出来的"几何。 */
    try {
      /* ---- 顶点：沿法线位移（3 层 fbm，替身用 3 组不同频率/速度的正弦堆叠；零贴图） ---- */
      var marineVS = [
        'uniform float uTime, uAmp, uR, uFar;',
        /* ============================================================
         * v156.15（实机探针抓到的**真 bug**）：这里原来少了这两行声明 ——
         *   `attribute float uCoast;`（几何按顶点写离岸距离，见 wg.setAttribute('uCoast')）
         *   `varying float vCoast;`（main() 里 `vCoast = uCoast;` 要写它）
         * 于是顶点着色器 **编译失败**：`ERROR: 0:101: 'vCoast' : undeclared identifier`
         * → 水面材质整条报废，紧接着渲染器抛 "Cannot read properties of undefined (reading 'x')"
         * （页面级运行时异常；`audit_v125b_perf_ui.js` 的「无页面运行时异常」那一条就是被它顶红的）。
         * 教训：自定义 attribute / varying **必须自己声明**（three 只注入 position/normal/uv 等标准项），
         * 而 jsdom 里没有 WebGL —— 这条只能靠实机探针抓。
         * ============================================================ */
        'attribute float uCoast;',
        'varying float vCoast;',
        'varying vec3 vN; varying vec3 vView; varying vec3 vW; varying float vFar;',
        /* ============================================================
         * v155d（老板：「海面目前毫无波澜，起伏没有体现出来」）
         * ------------------------------------------------------------
         * 病根：波相位写成了 `dot(normalize(position), K)` —— 点积范围只有 [-1,1]，
         * 乘上 0.19~1.95 的波数后，**整个球面的相位只变化约 2 弧度量级** ≈ 一个正弦的
         * 一小段 → 看起来就是平的。
         * 正解：用**世界位置**做相位 `dot(position, K)`（position 长度 ≈ R=300），
         * 波数取 0.21~1.9 时波长 = 2π/k ≈ 3.3~30 世界单位（一格 ≈ 5 单位）——真正的浪。
         * ============================================================ */
        /* ============================================================
         * v156.22（老板：「海波还是有点太规整太明显了」）
         * ------------------------------------------------------------
         * 实测 A/B（同机位、只把 uAmp 从 3.2 改 0）：关浪是一片干净深蓝；开浪则整片
         * 海面浮着一层**规则的大斑块**。根因不是振幅，是**形状**：
         *   · 5 条固定方向的正弦叠加 → 相位线性 → 等相位线是**平行直线**；
         *   · 域扭曲用的也是 3 条慢正弦（周期 300+ 单位）→ 扭曲本身同样规则，
         *     只是把"直条纹"弯成"弯条纹"，规律感一点没少。
         * 正解：换**值噪声 fbm**（哈希噪声，天生非周期），并让噪声自己扭曲自己。
         *   GLSL 里哈希噪声比三角函数还便宜（只有乘加、没有 sin），13 万顶点撑得住。
         * 分层：base(涌浪 ~12 单位) + mid(~5) + chop(~2.2)，权重递减；
         *   振幅再乘 uFar（按镜头距离轻微衰减）—— 远景本就不该看得见小浪。
         * ============================================================ */
        'float hash13(vec3 p){',
        '  p = fract(p * 0.1031);',
        '  p += dot(p, p.yzx + 33.33);',
        '  return fract((p.x + p.y) * p.z);',
        '}',
        'float vn(vec3 x){',
        '  vec3 i = floor(x), f = fract(x);',
        '  f = f * f * (3.0 - 2.0 * f);',
        '  float n000 = hash13(i),                     n100 = hash13(i + vec3(1.0, 0.0, 0.0));',
        '  float n010 = hash13(i + vec3(0.0, 1.0, 0.0)), n110 = hash13(i + vec3(1.0, 1.0, 0.0));',
        '  float n001 = hash13(i + vec3(0.0, 0.0, 1.0)), n101 = hash13(i + vec3(1.0, 0.0, 1.0));',
        '  float n011 = hash13(i + vec3(0.0, 1.0, 1.0)), n111 = hash13(i + vec3(1.0, 1.0, 1.0));',
        '  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),',
        '             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);',
        '}',
        'float fbm2(vec3 p){ return 0.62 * vn(p) + 0.38 * vn(p * 2.13 + 7.3); }',
        /* 域扭曲：用噪声推噪声（不是用正弦推正弦）—— "不规整"的关键就是这一步 */
        'vec3 warp(vec3 q, float t){',
        '  return q + (vec3(',
        '    vn(q * 0.55 + vec3(0.0, 0.0, t * 0.050)),',
        '    vn(q * 0.55 + vec3(5.2, 1.3, -t * 0.045)),',
        '    vn(q * 0.55 + vec3(11.7, 9.1, t * 0.038))) - 0.5) * 1.35;',
        '}',
        'float h(vec3 P, float t){',
        '  vec3 Q = warp(P * 0.085, t);',
        '  float base = fbm2(Q) - 0.5;',
        '  float mid  = vn(Q * 2.40 + vec3(0.0, 0.0, t * 0.120)) - 0.5;',
        '  float chop = vn(Q * 6.10 - vec3(0.0, 0.0, t * 0.210)) - 0.5;',
        '  return (base + mid * 0.45 + chop * 0.18) * 2.0;',
        '}',
        /* 快波：求法线用（少一层 chop，视觉无差别） */
        'float hf(vec3 P, float t){',
        '  vec3 Q = warp(P * 0.085, t);',
        '  float base = fbm2(Q) - 0.5;',
        '  float mid  = vn(Q * 2.40 + vec3(0.0, 0.0, t * 0.120)) - 0.5;',
        '  return (base + mid * 0.45) * 2.0;',
        '}',
        'vec3 surfF(vec3 d, float c, float t){ vec3 P = d * uR; float k = smoothstep(0.30, 0.75, c); return d * (uR + hf(P, t) * uAmp * k * uFar); }',
        'vec3 surf(vec3 d, float c){ vec3 P = d * uR; float k = smoothstep(0.30, 0.75, c); return d * (uR + h(P, uTime) * uAmp * k * uFar); }',

        'void main(){',
        '  vec3 d = normalize(position);',
        '  vec3 T = normalize(cross(d, vec3(0.0, 1.0, 0.0) + 0.0001));',
        '  vec3 B = normalize(cross(d, T));',
        '  float e = 0.020;',
        '  vCoast = uCoast;',
        '  vFar = uFar;',
        '  vec3 P  = surf(d, uCoast);',
        '  vW = P;',
        '  vec3 PT = surfF(normalize(d + T * e), uCoast, uTime);',
        '  vec3 PB = surfF(normalize(d + B * e), uCoast, uTime);',
        '  vec3 n  = normalize(cross(PT - P, PB - P));',
        '  if (dot(n, d) < 0.0) n = -n;',
        '  vN = normalize(normalMatrix * n);',
        '  vec4 mv = modelViewMatrix * vec4(P, 1.0);',
        '  vView = mv.xyz;',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n');
      var marineFS = [
        'uniform vec3 uColor;',
        'uniform float uTime;',
        /* v157.95：水球裁剪用 —— 高程图 + 水面线 */
        'uniform sampler2D uElevTex;',
        'uniform float uWaterLevel;',
        'uniform float uDebugMask;',
        'varying vec3 vN; varying vec3 vView; varying vec3 vW; varying float vFar;',
        '',
        '/* 与顶点着色器同一套哈希噪声（GLSL 不能 include，只能各写一份） */',
        'float hash13(vec3 p){',
        '  p = fract(p * 0.1031);',
        '  p += dot(p, p.yzx + 33.33);',
        '  return fract((p.x + p.y) * p.z);',
        '}',
        'float vn(vec3 x){',
        '  vec3 i = floor(x), f = fract(x);',
        '  f = f * f * (3.0 - 2.0 * f);',
        '  float n000 = hash13(i),                      n100 = hash13(i + vec3(1.0, 0.0, 0.0));',
        '  float n010 = hash13(i + vec3(0.0, 1.0, 0.0)),  n110 = hash13(i + vec3(1.0, 1.0, 0.0));',
        '  float n001 = hash13(i + vec3(0.0, 0.0, 1.0)),  n101 = hash13(i + vec3(1.0, 0.0, 1.0));',
        '  float n011 = hash13(i + vec3(0.0, 1.0, 1.0)),  n111 = hash13(i + vec3(1.0, 1.0, 1.0));',
        '  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),',
        '             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);',
        '}',
        '/* 细浪高度场：两层不同尺度、不同流速 —— 非周期，不会出现"斑点阵列" */',
        'float rip(vec3 p){',
        '  float a = vn(p * 0.62 + vec3(0.0, 0.0, uTime * 0.55));',
        '  float b = vn(p * 1.55 - vec3(0.0, 0.0, uTime * 0.83) + 13.7);',
        '  return a * 0.65 + b * 0.35;',
        '}',
        '',
        'void main(){',
        /* ============================================================
         * v157.95：**整球水面 + 逐像素裁剪**
         * 查等距柱状高程图，高程高于水面线就 discard。
         * 海岸线由像素决定 ⇒ 没有多边形台阶、没有格缝、也不可能"露底"。
         * ============================================================ */
        '  vec3 _sd = normalize(vW);',
        /* 纬度：烘焙 `lat=(0.5-(y+0.5)/H)*π` + flipY=false ⇒ 第 0 行 = 北极 */
        '  vec2 _euv = vec2(atan(_sd.z, _sd.x) / 6.283185307 + 0.5, 0.5 - asin(clamp(_sd.y, -1.0, 1.0)) / 3.141592653);',
        '  float _eh = texture2D(uElevTex, _euv).r * 0.30 - 0.15;',
        '  if (uDebugMask > 0.5) { gl_FragColor = vec4(vec3(clamp((_eh + 0.1) * 6.0, 0.0, 1.0)), 1.0); return; }',
        '  if (_eh > uWaterLevel) discard;',
        '  vec3 N = normalize(vN);',
        '  vec3 V = normalize(-vView);',
        '  /* 切平面基：在球面上 perturN 必须沿切向做，否则会被当成"法线歪了" */',
        '  vec3 upv = abs(N.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);',
        '  vec3 T = normalize(cross(upv, N));',
        '  vec3 B = cross(N, T);',
        '  /* 像素级细浪：三采样求梯度（正中央 + 沿 T/B 各一步） */',
        '  float e = 0.55;',
        '  float h0 = rip(vW);',
        '  float hT = rip(vW + T * e);',
        '  float hB = rip(vW + B * e);',
        '  /* vFar：远景把细浪淡掉（否则整片海在闪 = 又变成"规整的噪点"） */',
        '  /* 逐像素距离衰减：越远的像素细浪越淡（不做这个，镜头一动就是一片摩尔纹闪烁） */',
        '  float camD = length(vView);',
        /* v157.105（老板「依旧海水堆起山峰」）：细浪法线在**远处必须彻底消失**。
           原来 140~430 才淡出，而星球尺度下像素距相机只有 100~200 →
           dFade≈1，整片海被大尺度明暗糊成"山脊"。
           实测：浪高 A/B（uAmp 1.1 → 0）像素差为 **0** —— 几何本来是平的，
           所谓"山"全是这层法线明暗。现在衰减提前到 60~170，星球视角下恒为 0。*/
        '  float dFade = 1.0 - smoothstep(60.0, 170.0, camD);',
        /* v157.84（老板「还有色斑」）：amp 0.42 → 0.24。
           法线扰动一强，diff / fres / spec 三项同时被放大 —— 在近景（agl 8~60）
           读出来就是一层"亮蓝色斑团"糊在海面上（实测 agl=35 时成片出现）。
           0.24 仍保留浪纹起伏，但不再形成可辨认的团块。 */
        '  float amp = 0.18 * clamp(vFar, 0.0, 1.0) * (0.20 + 0.80 * dFade);',
        '  N = normalize(N - (hT - h0) / e * T * amp - (hB - h0) / e * B * amp);',
        '  /* 主光：画面左上方（与场景太阳一致的方向感） */',
        '  vec3 Ld = normalize(vec3(0.45, 0.80, 0.40));',
        '  float diff = max(dot(N, Ld), 0.0);',
        '  /* 镜面：浪脊上的反光才是"水"的读法（只有 diffuse 会像一块布） */',
        '  vec3 H = normalize(Ld + V);',
        '  float spec = pow(max(dot(N, H), 0.0), 42.0);',
        '  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);',
        '  vec3 col = uColor * (0.55 + 0.55 * diff);',
        /* v157.84：0.34 → 0.24 —— 近景浪脊上的高光点在低分辨率下读作"白色麻点"
           （老板截图中海面那层细小亮点）。保留高光（水感来源），只降强度。 */
        '  col += vec3(0.95, 0.97, 1.00) * spec * 0.24;',
        '  col += vec3(0.12, 0.20, 0.28) * fres;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n');
      var wmat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: 1.1 },                     /* 世界单位：约 0.44 格宽（浪高看得出来，又不穿地块） */
          /* v155j（修正 v155i 的符号错误）：湖底地形面在 R+0.6（PLATEAU），
             水面必须**略高于它**（+0.62）才看得见；之前的 R-0.8 直接把水压到海底下面，
             于是海洋显示成深蓝的"湖底色"（就是那半边发黑）。 */
          uR: { value: R + 1.0 },
          uColor: { value: new THREE.Color(0x4a7fa0) },  /* 旧方案的颜色，不改 */
          /* v156.22：远景衰减系数（1 = 满浪 · 0 = 平）。由 render 按 camO.dist 更新 */
          uFar: { value: 1 },
          uElevTex: M._elevTexU,
          uWaterLevel: { value: M.WATERLEVEL },
          uDebugMask: { value: 0 }
        },
        vertexShader: marineVS, fragmentShader: marineFS,
        side: THREE.FrontSide,
        /* ⛔ v157.103（老板「蓝色大山峰，挺好笑的」）：
           这里原来有 `polygonOffset: true, factor:-2, units:-4` —— 那是 v155l 为了压
           "水面与海床只差 0.02 的深度打架"加的。但 polygonOffset 的偏移量**随表面斜率放大**：
           山坡越陡，水面被往镜头拉的越多，最后**水画在山的前面** → 出现"蓝色大山峰"。
           现在海床已经压低成真实海盆（差好几个单位），不再需要它；
           去掉后由深度测试自然决定遮挡：山高过水面就挡住水。*/
        polygonOffset: false
      });
      water = new THREE.Mesh(wg, wmat);
      M._waterMat = wmat;
    } catch (eW) {
      water = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: 0x4a7fa0 }));
      M._waterMat = null;
    }
    scene.add(water);
    try { if (!M._sky) buildSkyClouds(); } catch (eSky0) { }
  }

  /* ---- 构建六边球地块（拓扑/地形/几何一律取自 sphere.js）----
     每条边由相邻两格**共享**（Goldberg 对偶）→ 真正**边嵌合**；透明六边线框，衬在彩色地形上。
     几何数据（upos 线框段 / fpos 拾取面 / faceCell 面→格）由 GAME.sphere 产出后转 THREE 缓冲。 */
  function buildTiles(sub) {
    if (tiles) { scene.remove(tiles); if (tiles.geometry) tiles.geometry.dispose(); }
    if (M._collider) { scene.remove(M._collider); if (M._collider.geometry) M._collider.geometry.dispose(); }
    if (M._fill) { scene.remove(M._fill); if (M._fill.geometry) M._fill.geometry.dispose(); }
    SP.build(sub);                                   /* 球面内核构建（幂等）*/
    var cells = SP.cells, upos = SP.upos, fpos = SP.fpos;
    /* 地块 = **纯线框**（老板：不要地块上色）· 只声明地块边界 */
    var ugeo = new THREE.BufferGeometry();
    ugeo.setAttribute('position', new THREE.Float32BufferAttribute(upos, 3));
    /* v92：线框**顶点色** —— 迷雾遮罩靠它，不靠多画一层几何。
       暗区把线框染成近黑（不是纯黑：留一点点轮廓，球面才不像一块死黑饼）；
       半明略暗；全明保留原本的冷蓝。
       为什么要走顶点色：线框画在 `_shellR` 球壳上，比地形表面高；
       雾面若只贴地，线框就从雾里穿出来 —— 实测截图里暗区满屏白点就是这个。
       而靠"把雾面抬高"去盖，盖住的是**整颗球**（含已探明区），越修越错。 */
    var ucol = new Float32Array(upos.length);
    for (var ui0 = 0; ui0 < ucol.length; ui0++) ucol[ui0] = 1;
    var lineColAttr = new THREE.Float32BufferAttribute(ucol, 3);
    ugeo.setAttribute('color', lineColAttr);
    M._lineColAttr = lineColAttr;
    var mat = new THREE.LineBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false,
      /* v154e：靠深度偏移"贴"在地形上，而不是把几何抬高（抬高 = 悬空桌面） */
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8
    });
    M._shellMat = mat;
    tiles = new THREE.LineSegments(ugeo, mat);
    /* v157b：必须压在未探明压暗层（renderOrder 17）**之上** ——
       否则省市区边界会被雾一并盖掉，而老板明确要"保留区划边界"。
       19 = 所有雾层（17/18）与云（20+）之间的夹层。 */
    tiles.renderOrder = 19;
    scene.add(tiles);
    /* ============================================================
     * v155h（性能）：拾取壳换成**低模球 + 方向反查**。
     * ------------------------------------------------------------
     * 原来用"每个六边形一个三角形"的填充几何（73.7 万顶点）只为了知道"点到哪一格"——
     * 射线打到球面后，按方向 `nearestCell` 求格即可（结果等价，误差 < 1 格）。
     * 顶点 73.7 万 → 约 5 千，每帧省 ~100ms。
     * ============================================================ */
    var fgeo = new THREE.SphereGeometry(R + 0.6, 96, 64);
    M._collider = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
    M._collider.cells = cells; M._collider.nv = SP.nv;
    M._collider.faceCell = null;                  /* 不再有 face→cell 表 */
    scene.add(M._collider);
    _tileSub = sub; _tileCells = cells; M._vdirs = SP.V; M._cent = SP.cent; M._icoF = SP.F;
    /* v154：新线框 → 区域边界色重算（否则换格数后边界色丢） */
    try { if (M._regionOn) paintRegionEdges(); } catch (eRP) { }
  }
  var _tileCells = [];

  /* ============================================================
   * v157.x：**一格在屏幕上占多少像素** —— 所有 LOD 判定的唯一口径
   * ------------------------------------------------------------
   * 为什么要有这个纯函数：LOD 阈值如果散落在各处各写一套，
   * 改一起就要改一片，且没法单独验。这里统一成"输入距离/视口高，
   * 输出每格像素边长"，纯数学、无副作用 → 可以在 node 里直接断言。
   *
   * 推导：球半径 R 投影成 f*R/d 像素（f = 半视口高 / tan(fov/2)）；
   *       可见半球有 n/2 格，铺在该圆盘内 → 每格边长 ≈ r_px·√(π/(n/2))。
   * ============================================================ */
  M.cellPxAt = function (dist, viewH) {
    var n = Math.max(1024, ((_tileCells && _tileCells.length) || 40962) * 0.5);
    var f = ((viewH || 800) * 0.5) / Math.tan(cam.fov * Math.PI / 360);
    return f * R / Math.max(1, dist) * Math.sqrt(Math.PI / n);
  };

  /* ============================================================
   * v92：迷雾层
   * ------------------------------------------------------------
   * 未探明（fog 0）→ 近黑的雾壳，看不见地形
   * 半明  （fog 1）→ 灰纱，看得见起伏，不知道上面有什么
   * 全明  （fog 2）→ 不遮
   *
   * 几何直接用 SP.fpos（每面 3 顶点 · faceCell 面→格）沿格子法线外扩：
   * 雾必须浮在地形之上，否则山脊会穿破它。
   * 只在 fog.ver() 变化时重建 —— 全量 24 万个面片，不能每帧跑。
   * ============================================================ */
  /* ⛔ v157.68（老板截图「杂色」）：两级**贴地加亮六边形层**（_fogLit / _fogLit1）整条退役。
     它们按 fog 三档给同一片已探明区铺不同强度的六边形，正是视野内部那些
     硬边浅色碎斑的来源。已探明范围此后不叠加任何几何层，只由
     顶点色上做「原色 / 均匀压暗」明暗两态（该压暗已于 v157.76 退役）。 */
  /* ============================================================
   * ⛔ v157.76（老板：「有视野的范围还是保留那个高亮吧……我建议只做这个
   * 标识性的调整，不要影响到原来的渲染颜色」）
   * ------------------------------------------------------------
   * `paintGlobeFog` 整条退役。它自 v157e 起按迷雾给 globe **顶点色**乘系数
   * （v157.68 收敛成两态：已探明 1.0 / 未探明 0.34），"未探明"那片其实是
   * 压暗过的地形色 —— 老板认定这正是「影响了原来的渲染颜色」。
   *
   * 新口径（本版）：
   *   · 地形色 = 地形色。globe 顶点色在 buildGlobe 之后**不再被任何东西改写**，
   *     已探明 / 未探明看到的是同一份原色。
   *   · 视野范围只做**标识性**调整：地块线框（paintLineFog）——
   *     已探明（含半明）冷蓝可见、未探明隐形；范围边界 = 线出现在哪、停在哪。
   *   · 视野内部零额外渲染、零调色（v157.68 口径继续有效）。
   *
   * ⚠️ 代价明写：未探明区现在也看得到真实地形色（只是没有网格线），
   *    不再有"暗一片"的未知感。这是老板拍板要的取舍，不是遗漏。
   *    要恢复压暗：`git revert` 本版，或照 v157.68 的两态公式重加一遍。
   * ============================================================ */

  /* ============================================================
   * v157.68（老板截图「杂色」）：3D 视野渲染改成「两态 + 干净边界」。
   * ------------------------------------------------------------
   * 旧口径（v92.240j ~ v157e）在这里按 fog 三档铺两层**贴地六边形加亮层**
   * （fog=2 → 0.20 / fog=1 → 0.10 / fog=0 → 无），globe 顶点色再按
   * 1.0 / 0.78 / 0.34 三档压暗、线框按三档染色。三档在 reveal 半径边缘
   * 交错 → 已探明范围内部被切成一片片硬边六边形深浅碎斑。
   * 实机证据：.workbuddy/shots/v15768-BEFORE-fogclean.png —— 深蓝未探明底 +
   * 中央一圈硬边浅色六边形碎斑，与老板放大截图同构。
   *
   * 老板口径（v157.63 逐字）：「要的是边界感，而不是在视野内增加渲染」。
   * 本版据此：
   *   ① 已探明范围内部**零额外渲染** —— 删掉两层贴地加亮几何，
   *      globe 顶点色回原色，线框统一冷蓝；半明不再单独成一档颜色。
   *   ② 未探明**整体均匀压暗**（paintGlobeFog 的 0.34）+ 线框隐形 ——
   *      一片干净的暗，没有中间档、没有羽化、没有格间色差斑块。
   *      ⛔ v157.76 退役：老板「只做标识性调整，不要影响原来的渲染颜色」——
   *      压暗本身就是改地形色，已整条拆除；未探明现在也是原色，只靠"没有线框"标识。
   *   ③ 边界 = 已探明/未探明之间的六边形格边 —— 线框的有无即边界（v157.76 起唯一标识）。
   * 大气云壳（buildSkyClouds 的 M._sky）不按格分档，保持不动。
   *
   * 两条历史弯路别再走（v157e 已记录）：贴地压暗层 → 外轮廓多边形棱；
   * 统一球壳 → 露出浅色斑块。压暗是「颜色」的事，就在顶点色上做。
   * ============================================================ */
  /* ⛔ v157.86（老板「去除现有边界高亮机制」）
     ------------------------------------------------------------
     这里原有整套「视野边界柔光带」：
       `_fogEdgeMesh/_fogEdgeBuf/_fogEdgeSegs/_fogEdgeUv` 缓冲、
       `_fogEdgeGradTex()` 横截面渐变纹理、`buildFogBoundary()` 6 顶点宽带构建、
       `M._fogEdgeProbe()` 取证出口。
     整条删除。视野标识改为 `paintGlobeExplore()`（已探明区域顶点色提亮），
     不再有任何"画在球面上的额外几何"。
     ⚠️ `ensureEdgeOther()` **保留** —— `paintLineFog()`（地块线框色，已探明冷蓝/
        未探明隐形）仍在用它，那是线框层的标识，与本条边界带不是一回事。
     ============================================================ */

  function buildFog() {
    var F = GAME.fog;
    if (!F) return;
    F.ensure();
    /* 只在 fog 版本变化时被调用（render 里 M._fogVer 比对）。
       v157.76 起只重算**一处**：地块线框色（已探明冷蓝 / 未探明隐形）。
       globe 顶点色不再参与迷雾 —— 老板「只做标识性调整，不要影响原来的渲染颜色」，
       地形色就是地形色，视野范围由"线出现在哪、停在哪"表达。
       ⚠️ 线框本身受 TILE_LINES=false（v157.56「线条太杂」）隐藏，
          所以「视野范围」真正可见的标识是下面这条**独立的边界线**。 */
    paintLineFog();
    /* v157.86（老板「已探索区域亮度升高。去除现有边界高亮机制」）：
       这里原来调 `buildFogBoundary()`（三角带边界）。边界整条退役，
       视野标识改为**顶点色提亮**：已探明 ×1.10，未探明原色。 */
    paintGlobeExplore();
  }

  /* ============================================================
   * v157.76：**探明边界的边段映射**
   * ------------------------------------------------------------
   * 地块线框的每段边被两侧的格**各画一次**（端点坐标完全相同），所以能用端点
   * 做键把"另一侧是哪一格"找出来 —— v154 区域边界用的就是这套办法。
   * 这里把它预计算成 Int32Array：paintLineFog 在迷雾变化时被反复调用，
   * 不能每次都拼字符串（实测 24.5 万段，一次就够呛）。
   * 表由 paintRegionEdges 顺手填（同一趟循环，零额外开销），
   * 缺失时才自己建一次兜底 —— 视野标识不能因为区划生成失败就消失。
   * ============================================================ */
  function ensureEdgeOther() {
    if (M._edgeOther && M._edgeOtherFor === M._lineColAttr) return M._edgeOther;
    var SPn = GAME.sphere, up = SPn && SPn.upos, uc = SPn && SPn.uposCell;
    if (!up || !uc) return null;
    var raw = M._edgePairRaw, keyOf = M._edgeKeyOf;
    if (!raw || !keyOf) {
      keyOf = function (o) {
        var x1 = up[o], y1 = up[o + 1], z1 = up[o + 2], x2 = up[o + 3], y2 = up[o + 4], z2 = up[o + 5];
        var ka = Math.round(x1 * 100) + ',' + Math.round(y1 * 100) + ',' + Math.round(z1 * 100);
        var kb = Math.round(x2 * 100) + ',' + Math.round(y2 * 100) + ',' + Math.round(z2 * 100);
        return ka < kb ? ka + '|' + kb : kb + '|' + ka;
      };
      raw = {};
      for (var i = 0; i < uc.length; i++) {
        var k = keyOf(i * 6);
        if (raw[k] == null) raw[k] = uc[i];
        else if (raw[k] !== uc[i]) raw[k] = { a: raw[k], b: uc[i] };
      }
      M._edgePairRaw = raw; M._edgeKeyOf = keyOf;
    }
    var n = uc.length, out = new Int32Array(n);
    for (var j = 0; j < n; j++) {
      out[j] = -1;
      var p = raw[keyOf(j * 6)];
      if (p && typeof p === 'object') out[j] = (p.a === uc[j]) ? p.b : p.a;
    }
    M._edgeOther = out; M._edgeOtherFor = M._lineColAttr;
    return out;
  }

  /* ============================================================
   * v157.86（老板「已探索区域亮度升高。去除现有边界高亮机制」）
   * ------------------------------------------------------------
   * 视野标识从「画一条边界带」换成「已探索区域整体提亮」。
   *
   * 口径：
   *   · 已探明格（`GAME.fog.get(ci) > 0`）→ 顶点色 × `M.EXPLORE_LIT`（默认 1.10）
   *   · 未探明格 → **原色一寸不改**
   * 为什么是"提亮已探索"而不是"压暗未探索"：v157.76 老板否过一次整体压暗
   *   （画面发灰、地形色全被吃掉）；提亮方向相反 —— 地形色仍是地形色，
   *   只是「你认识的世界」亮一成，边界由明暗差自然读出来，不需要任何几何。
   *
   * 两个必须做对的细节：
   *   ① **从原始色乘回来**（`M._globeColBase`），不是就地累乘 —— 否则每推进一次
   *      迷雾就再亮 10%，走两步整颗球就白了；
   *   ② **顶点级软插值**（c0/c1/权重 t，由 `_cellColorSoft` 顺手写出）——
   *      直接按"最近格"二值提亮会得到一圈六边形硬边，
   *      那等于把删掉的边界线换成一条更丑的锯齿。
   *
   * 性能：顶点→格 的映射在建球时就算好了（`M._globeVtxCell`），
   *   这里每次只做 O(n) 查表 + 三次乘法（n ≈ 9.98 万，实测 ~8ms）。
   * ============================================================ */
  /* 已探索提亮 / 未探索微压 —— 只提亮 10% 在实机近景里几乎看不出来
     （截图对比：整屏亮度差 < 3%，人眼读不出"我探索过这里"）。
     所以给一个**相对**口径：已探索 ×1.15、未探索 ×0.90 → 交界处 1.28 倍差，
     一眼能看出"哪片是我认识的"。两个数都可调（1/1 = 关掉）。 */
  M.EXPLORE_LIT = 1.15;                 /* 已探索区域亮度系数 */
  M.EXPLORE_DIM = 0.90;                 /* 未探索区域亮度系数（1 = 不压暗） */
  function paintGlobeExplore() {
    var F = GAME.fog, g = M._globe, base = M._globeColBase, vx = M._globeVtxCell;
    if (!F || !g || !base || !vx) return 0;
    var geo = g.geometry;
    var attr = geo && geo.attributes && geo.attributes.color;
    if (!attr || !attr.array) return 0;
    var arr = attr.array;
    var n = Math.min(attr.count, base.length / 3, vx.ci0.length);
    var LIT = (M.EXPLORE_LIT > 0 ? M.EXPLORE_LIT : 1);
    var DIM = (M.EXPLORE_DIM > 0 ? M.EXPLORE_DIM : 1);
    var lit = 0;
    for (var i = 0; i < n; i++) {
      var c0 = vx.ci0[i], c1 = vx.ci1[i], t = vx.t[i] || 0;
      var k0 = (c0 >= 0 && F.get(c0) > 0) ? LIT : DIM;
      var k1 = (c1 >= 0 && F.get(c1) > 0) ? LIT : DIM;
      if (k0 > 1) lit++;
      var k = k0 + (k1 - k0) * t;
      var i3 = i * 3;
      if (M.useColorAtlas && M._colTex) {
        /* v157.93：颜色由图集提供 → 顶点色只承载**系数**（1.15 提亮 / 0.90 压暗）*/
        arr[i3] = k; arr[i3 + 1] = k; arr[i3 + 2] = k;
      } else if (k === 1) {
        arr[i3] = base[i3]; arr[i3 + 1] = base[i3 + 1]; arr[i3 + 2] = base[i3 + 2];
      } else {
        arr[i3] = Math.min(1, base[i3] * k);
        arr[i3 + 1] = Math.min(1, base[i3 + 1] * k);
        arr[i3 + 2] = Math.min(1, base[i3 + 2] * k);
      }
    }
    attr.needsUpdate = true;
    M._globeExploreLit = lit;          /* 探针/断言：被提亮的顶点数 */
    M._globeExploreN = n;
    return lit;
  }
  M._paintGlobeExplore = paintGlobeExplore;

  /* 线框按探明度上色（与雾面同一把尺子：fog.get） */
  function paintLineFog() {
    var attr = M._lineColAttr, SPn = GAME.sphere;
    if (!attr || !SPn || !SPn.uposCell) return;
    var arr = attr.array, uc = SPn.uposCell, F = GAME.fog;
    /* v157.76：每段边的"另一侧格"，用来判这条边是不是**探明边界** */
    var other = ensureEdgeOther();
    for (var i = 0; i < uc.length; i++) {
      var v = F ? F.get(uc[i]) : 2;
      var r, g, b;
      /* v137：未探明线框从**近黑**（0.02/0.03/0.05）提到深灰蓝 ——
         上面盖的是流动云层，底下若纯黑，云会像"浮在黑布上的白斑"；
         留一点轮廓，读起来才是"雾里看地形"。 */
      /* v157b（老板：「未探索的地方目前有模糊的边界线，建议不显示这种模糊边界
         （但显示省市区边界，保留区划边界）」）
         ------------------------------------------------------------
         未探明区原本用深灰蓝（0.13/0.16/0.22）画地块线 —— 远看就是一层
         "模糊的边"，既不是地形也不是区划，像画面没加载完。
         现在**染成背景色 = 隐形**：未探明的地方就该是一片空，什么也不画。
         ⚠️ 区域边界色（rc）在下面覆盖 —— 省/市/区界照旧可见，
            这是老板明确要保留的东西，别把这行也一起染成背景色。 */
      if (v === 0) {
        var _bgH = (M._skyKeep == null) ? 0x0a1020 : M._skyKeep;
        r = ((_bgH >> 16) & 255) / 255;
        g = ((_bgH >> 8) & 255) / 255;
        b = (_bgH & 255) / 255;
      }
      else { r = 0.56; g = 0.70; b = 0.84; }   /* v157.68：已探明（含半明）统一冷蓝，视野内不按格分档 */
      /* v154：区域边界色覆盖雾色（**同一条边**，不另画线 → 没有重影） */
      var rc = M._regionEdgeCol && M._regionEdgeCol[i];
      if (rc) { r = rc[0]; g = rc[1]; b = rc[2]; }
      /* ============================================================
       * v157.76（老板：「有视野的范围还是保留那个高亮吧……我建议只做这个
       * 标识性的调整，不要影响到原来的渲染颜色」）
       * ------------------------------------------------------------
       * 顶点色压暗退役后，远看已探明 / 未探明是**同一片地形色**，范围就没了标识。
       * 这里在同一条地块边上只改颜色（不加几何、不加面片、不动地形）：
       * 一侧已探明、另一侧未探明的那条边 → 亮青白，视野范围自己浮出来。
       * 优先级最高：它是「我能看到哪」的唯一标识；区划色在其内部照常可见。
       * ============================================================ */
      var ob = other ? other[i] : -1;
      if (ob >= 0 && F && ((v > 0) !== (F.get(ob) > 0))) {
        r = 0.92; g = 0.98; b = 1.0;
      }
      var o = i * 6;                                        /* 每段 2 顶点 × 3 分量 */
      arr[o] = r; arr[o + 1] = g; arr[o + 2] = b;
      arr[o + 3] = r; arr[o + 4] = g; arr[o + 5] = b;
    }
    attr.needsUpdate = true;
  }
  /* ============================================================
   * v154：省/市/区边界 = **同一批地块边**重新上色（不新增几何）
   * ------------------------------------------------------------
   * 老板：「除了地块有六边形边，不允许其他有边，现在有重影（省市区的边应该
   *   重描地块的边连接形成，而不是重新画一条）」。
   * 实现：
   *   · 地块线框的每段边（upos，2 顶点）都能找到"另一侧"的格子（同一条边被两格各画一次）；
   *   · 两侧归属不同（省>市>区，高层优先）→ 这段边按该级颜色上色；
   *   · 同归属 → 用迷雾/默认色；
   *   · paintLineFog 统一消费 M._regionEdgeCol（顺序：区域色覆盖雾色）。
   * ============================================================ */
  M._regionEdgeCol = {};
  function paintRegionEdges() {
    M._regionEdgeCol = {};
    var attr = M._lineColAttr, SPn = GAME.sphere;
    if (!attr || !SPn || !SPn.upos || !SPn.uposCell) return;
    var S = null;
    try { S = genSettlements(); } catch (e0) { return; }
    if (!S || !S.provOf) return;
    var up = SPn.upos, uc = SPn.uposCell, n = uc.length;
    /* 边 → 两侧所属格（用端点坐标做键：同一段边两格算出的端点完全相同） */
    var key = function (o) {
      var x1 = up[o], y1 = up[o + 1], z1 = up[o + 2], x2 = up[o + 3], y2 = up[o + 4], z2 = up[o + 5];
      var a = [x1, y1, z1].map(function (v) { return Math.round(v * 100); }).join(',');
      var b = [x2, y2, z2].map(function (v) { return Math.round(v * 100); }).join(',');
      return a < b ? a + '|' + b : b + '|' + a;
    };
    var m = {};
    for (var i = 0; i < n; i++) {
      var k = key(i * 6);
      if (m[k] == null) m[k] = uc[i];
      else if (m[k] !== uc[i]) m[k] = { a: m[k], b: uc[i] };
    }
    var pal = M.regionPalette || { prov: [80, 140, 255], market: [255, 90, 200], district: [40, 150, 70] };
    var on = M._regionOn || { prov: true };
    /* v157.76：顺手把「每段边的另一侧格」填好（同一趟循环，零额外 key 开销） */
    var other = new Int32Array(n);
    for (var j = 0; j < n; j++) {
      other[j] = -1;
      var pair = m[key(j * 6)];
      if (!pair || typeof pair !== 'object') continue;
      var a = pair.a, b = pair.b;
      other[j] = (a === uc[j]) ? b : a;
      if (S.provOf[a] < 0 || S.provOf[b] < 0) continue;         /* 海/无分区不画 */
      var col = null;
      if (on.prov && S.provOf[a] !== S.provOf[b]) col = pal.prov;
      else if (on.market && S.marketOf[a] !== S.marketOf[b]) col = pal.market;
      else if (on.district && S.districtOf[a] !== S.districtOf[b]) col = pal.district;
      if (col) M._regionEdgeCol[j] = [col[0] / 255, col[1] / 255, col[2] / 255];
    }
    M._edgeOther = other;
    M._edgeOtherFor = M._lineColAttr;
    paintLineFog();
    /* ⛔ v157.86：这里原有「几何建好后补建边界线」—— 边界已退役。
       改为补一次**已探索提亮**（首次进场时 fog 版本可能还没变过）。 */
    try { paintGlobeExplore(); } catch (ePG) { }
  }
  M.paintRegionEdges = paintRegionEdges;
  /* ============================================================
   * v156.71 世界生成 · 分层自检（老板「步骤性建立世界生成顺序…自检这个过程」）
   * ------------------------------------------------------------
   * 为什么放在这里、而不是外部工具里：
   *   地形/地块/省市区大量状态是**闭包私有**（genSettlements、globe、_vdirs）。
   *   外部探针只能隔着一层猜，实测就出现过"数据都对、返回值却拿不到"的情况。
   *   自检与生成同源，才能读到真实产物 —— 这是分层自检能成立的前提。
   *
   * 分层与不变量（每层都必须**有下限**，禁止 0===0 式通过）：
   *   L1 星球   seed 确定性、不同 seed 可区分
   *   L2 地形   格数、陆地占比 5~92%、高度有起伏、无 NaN
   *   L3 地块   每格有 type、邻接对称
   *   L4 渲染   网格与数据同源（_worldSeed == seed3）
   *   L5 几何   线框贴地（边中点相对真实地形 p90 ≤ 1.5 单位）
   *   L6 行政   省/市/区数量、陆地 100% 有归属、区不跨市、市不跨省
   *
   * 返回 { seed, ok, fails[], metrics{} }；调用方（工具/快测）只负责收集。
   * ============================================================ */
  M.selfCheck = function (seedIn) {
    var out = { seed: seedIn, fails: [], metrics: {} };
    var fail = function (k, msg) { out.fails.push(k + ': ' + msg); };
    var SP = GAME.sphere;
    if (!SP) { fail('L0/入口', '没有 GAME.sphere'); out.ok = false; return out; }

    /* ---- L2 地形 ---- */
    var cells = SP.cells || [];
    out.metrics.cells = cells.length;
    if (!(cells.length >= 10000)) fail('L2地形/格数', '只有 ' + cells.length + ' 格（下限 10000）');

    var step = Math.max(1, Math.floor(cells.length / 2500));
    var land = 0, sampled = 0, eMin = 1e9, eMax = -1e9, nan = 0;
    for (var i = 0; i < cells.length; i += step) {
      var c = cells[i]; if (!c) continue;
      var e = SP.sphElev(SP.V[i]);
      if (!isFinite(e)) { nan++; continue; }
      if (e < eMin) eMin = e;
      if (e > eMax) eMax = e;
      if (e >= 0) land++;
      sampled++;
    }
    if (sampled < 200) fail('L2地形/采样', '有效采样只有 ' + sampled + '（下限 200）');
    var landPct = sampled ? land / sampled * 100 : 0;
    out.metrics.landPct = +landPct.toFixed(1);
    out.metrics.elev = [+eMin.toFixed(2), +eMax.toFixed(2)];
    if (nan) fail('L2地形/NaN', nan + ' 个点高度非有限');
    if (sampled >= 200 && (landPct < 5 || landPct > 92)) fail('L2地形/海陆比', landPct.toFixed(1) + '%');
    if (eMax - eMin < 0.05) fail('L2地形/起伏', '高差仅 ' + (eMax - eMin).toFixed(3));

    /* ---- L3 地块 ---- */
    var noType = 0;
    for (var t = 0; t < cells.length; t += step * 3) { if (!cells[t] || !cells[t].type) noType++; }
    if (noType) fail('L3地块/类型', noType + ' 个格没有 type');
    var adj = SP.adj || [], asym = 0, chk = 0;
    for (var a = 0; a < adj.length && chk < 300; a += Math.max(1, Math.floor(adj.length / 300))) {
      var nb = adj[a] || []; if (!nb.length) continue;
      for (var q = 0; q < nb.length; q++) {
        var back = adj[nb[q]] || [];
        if (back.indexOf(a) < 0) asym++;
      }
      chk++;
    }
    if (asym) fail('L3地块/邻接', asym + ' 条单向邻接');

    /* ---- L4 渲染同源 ---- */
    var sameSrc = (M._worldSeed === (SP.seed3 ? SP.seed3() : null));
    out.metrics.sameSrc = sameSrc;
    if (!sameSrc) fail('L4渲染/不同源', '网格 seed=' + M._worldSeed + '，数据 seed=' + (SP.seed3 ? SP.seed3() : '?'));

    /* ---- L5 几何贴地 ---- */
    var gl = M._globe, THREE = window.THREE;
    if (sameSrc && gl && SP.upos && THREE) {
      try {
        gl.updateMatrixWorld(true);
        var oldSide = gl.material.side;
        gl.material.side = THREE.DoubleSide; gl.material.needsUpdate = true;
        var rc = new THREE.Raycaster(), O = new THREE.Vector3(0, 0, 0);
        var up = SP.upos, segN = up.length / 6, devs = [];
        var st2 = Math.max(1, Math.floor(segN / 120));
        for (var s2 = 0; s2 < segN; s2 += st2) {
          var o2 = s2 * 6;
          var A = new THREE.Vector3(up[o2], up[o2 + 1], up[o2 + 2]);
          var B = new THREE.Vector3(up[o2 + 3], up[o2 + 4], up[o2 + 5]);
          var mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
          rc.set(O, mid.clone().normalize()); rc.far = 2000;
          var hit = rc.intersectObject(gl, false);
          if (hit.length) devs.push(mid.length() - hit[0].distance);
        }
        gl.material.side = oldSide; gl.material.needsUpdate = true;
        devs.sort(function (x, y) { return x - y; });
        if (devs.length < 20) fail('L5几何/采样', '只拿到 ' + devs.length + ' 个交点（下限 20）');
        else {
          var p90 = devs[Math.floor(devs.length * 0.9)];
          out.metrics.lineP90 = +p90.toFixed(3);
          if (p90 > 1.5) fail('L5几何/线框悬空', 'p90 ' + p90.toFixed(2) + ' 单位');
        }
      } catch (eG) { fail('L5几何/异常', eG.message); }
    } else if (sameSrc) {
      fail('L5几何/入口', '缺 _globe 或 upos');
    }

    /* ---- L6 省市区 ---- */
    var S = null;
    try { S = genSettlements(); } catch (eS) { fail('L6行政/异常', eS.message); }
    if (S) {
      var uniq = function (arr) {
        if (!arr) return -1;
        var seen = {}, n = 0;
        for (var k = 0; k < arr.length; k++) { var v = arr[k]; if (v < 0) continue; if (!seen[v]) { seen[v] = 1; n++; } }
        return n;
      };
      var pN = uniq(S.provOf), mN = uniq(S.marketOf), dN = uniq(S.districtOf);
      out.metrics.prov = pN; out.metrics.market = mN; out.metrics.district = dN;
      if (out.metrics.cells !== (S.provOf ? S.provOf.length : -1))
        fail('L6行政/尺寸', 'provOf 长度 ' + (S.provOf ? S.provOf.length : '-') + ' ≠ 格数 ' + out.metrics.cells);
      if (!(pN >= 1)) fail('L6行政/省数', pN + ' 个省（下限 1）');
      if (!(mN >= 1)) fail('L6行政/市数', mN + ' 个市（下限 1）');
      if (!(dN >= 1)) fail('L6行政/区数', dN + ' 个区（下限 1）');

      /* 陆地必须 100% 有省归属（海面按最近省心并入，属设计） */
      var miss = 0, landN = 0;
      for (var z = 0; z < cells.length; z += step) {
        var cc = cells[z]; if (!cc) continue;
        if (cc.type === 'lake') continue;
        if (SP.sphElev(SP.V[z]) < 0) continue;
        landN++;
        if (S.provOf[z] < 0) miss++;
      }
      out.metrics.landCells = landN;
      out.metrics.unassigned = miss;
      if (landN >= 100 && miss > 0) fail('L6行政/未分配', miss + '/' + landN + ' 个陆地格无省');

      /* 嵌套：区不跨市、市不跨省 */
      var d2m = {}, m2p = {}, viol = 0;
      for (var y = 0; y < S.districtOf.length; y++) {
        var dI = S.districtOf[y]; if (dI < 0) continue;
        var mI = S.marketOf[y], pI = S.provOf[y];
        if (d2m[dI] == null) d2m[dI] = mI; else if (d2m[dI] !== mI) viol++;
        if (m2p[mI] == null) m2p[mI] = pI; else if (m2p[mI] !== pI) viol++;
      }
      if (viol) fail('L6行政/层级交叉', viol + ' 处');
    } else {
      fail('L6行政/入口', 'genSettlements 无返回');
    }

    /* ---- L7 细节分级（grid fade）----
       老板问「高空要不要模糊地面细节」。这里把判定钉成断言：
       贴地必须看得清格、轨道高度必须一格都别画。
       ⚠️ 校验必须带**下限**（不能只比大小）：全 0 / NaN 也能"单调递减"，
       那种情况下测试全绿但线框彻底消失 —— 平凡解陷阱。 */
    if (typeof M.cellPxAt !== 'function') {
      fail('L7分级/入口', '缺 M.cellPxAt');
    } else {
      var dNear = R + 30, dFar = M.ZOOM_MAX || R * 50;
      var pNear = M.cellPxAt(dNear, 800), pFar = M.cellPxAt(dFar, 800);
      out.metrics.cellPxNear = +pNear.toFixed(2);
      out.metrics.cellPxFar = +pFar.toFixed(2);
      if (!(isFinite(pNear) && pNear > 0)) fail('L7分级/非有限', '贴地每格 ' + pNear + 'px（须为有限正数）');
      if (!(isFinite(pFar) && pFar > 0)) fail('L7分级/非有限', '轨道每格 ' + pFar + 'px（须为有限正数）');
      if (pNear <= 3.0) fail('L7分级/贴地不可见', '每格仅 ' + pNear.toFixed(2) + 'px（应 > 3）');
      if (pFar >= 0.9) fail('L7分级/高空未隐藏', '每格 ' + pFar.toFixed(2) + 'px（应 < 0.9）');
      /* 单调：跨越 4 个数量级距离都必须递减，不能在中途反弹 */
      var prev = Infinity, mono = true;
      for (var dd = 1; dd <= 8; dd++) {
        var v = M.cellPxAt(dNear * Math.pow(dFar / dNear, dd / 8), 800);
        if (!isFinite(v) || v > prev) mono = false;
        prev = v;
      }
      if (!mono) fail('L7分级/非单调', '距离增大时每格像素出现反弹');
    }

    out.ok = out.fails.length === 0;
    return out;
  };

  /* 该格是否被迷雾遮住（未探明）。标记/标签/点击都用这一把尺子。 */
  function fogHides(ci) {
    return !!(GAME.fog && GAME.fog.get(ci) === 0);
  }

  /* ============================================================
   * 球面聚落层级：1 旧都（全球）→ 12 行省 → 36 市 → 240 区
   *   自然划分（球面 k-means）· 按面积分配（州下市数 ∝ 州面积、市下区数 ∝ 市面积）。
   * ============================================================ */
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function sphereKmeans(dirs, k, iters) {
    k = Math.min(k, dirs.length); if (k <= 0) return [];
    var cent = [];
    for (var i = 0; i < k; i++) cent.push(dirs[Math.floor((i + 0.5) / k * dirs.length)]);
    for (var it = 0; it < (iters || 8); it++) {
      var sums = [], cnt = [];
      for (var j = 0; j < k; j++) { sums.push([0, 0, 0]); cnt.push(0); }
      for (var d = 0; d < dirs.length; d++) {
        var best = 0, bd = -2, D = dirs[d];
        for (var j2 = 0; j2 < k; j2++) { var dt = dot3(D, cent[j2]); if (dt > bd) { bd = dt; best = j2; } }
        sums[best][0] += D[0]; sums[best][1] += D[1]; sums[best][2] += D[2]; cnt[best]++;
      }
      for (var j3 = 0; j3 < k; j3++) { var s = sums[j3], L = Math.hypot(s[0], s[1], s[2]) || 1; cent[j3] = [s[0] / L, s[1] / L, s[2] / L]; }
    }
    return cent;
  }
  /* 域扭曲：用一个**平滑噪声**微调方向（相邻格扭曲相近 → 边界平滑蜿蜒，不逐格乱跳）*/
  function warpDir(dir, salt) {
    var F = 3.5, A = 0.45;
    return [dir[0] + (n3(dir[0] * F, dir[1] * F, dir[2] * F, salt) - 0.5) * A,
      dir[1] + (n3(dir[0] * F + 7.7, dir[1] * F + 3.1, dir[2] * F + 5.5, salt + 11) - 0.5) * A,
      dir[2] + (n3(dir[0] * F + 2.3, dir[1] * F + 9.9, dir[2] * F + 1.7, salt + 22) - 0.5) * A];
  }
  function nearestCentNoisy(dir, cent, salt) {
    var wd = warpDir(dir, salt), best = 0, bd = -9;
    for (var j = 0; j < cent.length; j++) { var dt = dot3(wd, cent[j]); if (dt > bd) { bd = dt; best = j; } }
    return best;
  }
  /* 层级聚落：**嵌套分区**（省→市在其省内分 → 区在其市内分），成员数组保证不重叠、边界连续。*/
  /* 废土风地名池（前缀×后缀，组合足够多 → 48市+139区 不撞名）*/
  var WAS_PRE = '灰烬 锈铁 焦土 残垣 断壁 死寂 荒漠 骸骨 血砂 断岭 哑雷 幽谷 裂隙 熔炉 钢渣 尘沙 寒霜 暗礁 枯枝 腐沼 孤崖 湮墟 碎穹 蚀岸 烬渡 砾城 塌方 荒冢 蚀骨 噬风 焦关 铁砧 血锈 哑钟 残炉 险滩 流沙'.split(' ');
  var WAS_SUF = '堡 垒 坞 镇 驿 哨 坑 场 关 陉 坡 陲 墟 垠 岬 望 台 仓 栈 洼 隘'.split(' ');
  function genSettlements() {
    if (M._settle && M._settleSeed === seed3()) return M._settle;
    var nv = (M._vdirs || []).length, idxs = [], dirs = [];
    /* v155b（顺次划定）：行政区的"陆地"口径必须与**地形**一致（e >= 0），
       不能再用 0.05 这个旧门槛 —— 否则海岸那一圈"地形是海、行政区却算陆地"。 */
    var landOfTerr = function (i) {
      var c = (GAME.sphere && GAME.sphere.cells) ? GAME.sphere.cells[i] : null;
      if (c && c.type) return c.type !== 'lake';
      return sphElev(M._vdirs[i]) >= 0;
    };
    for (var i = 0; i < nv; i++) if (M._vdirs[i] && landOfTerr(i)) { idxs.push(i); dirs.push(M._vdirs[i]); }   /* 只分陆地 */
    var empty = { old: [0, 1, 0], provCent: [], marketCent: [], districtCent: [],
      provOf: new Int16Array(0), marketOf: new Int16Array(0), districtOf: new Int16Array(0), table: { old: null, prov: [], market: [], district: [] } };
    if (!dirs.length) return empty;
    var seed = seed3();
    function rh(a, b) { var h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x2545f491); h ^= h >>> 13; return (h >>> 8) / 16777216; }
    /* v90.99（老板）：**每颗星球独立的省市区** —— 省名走废土名池（seed 决定，各星不重样）。
       旧口径 `PROV_NAMES = DATA.START_STATES` 是**全仓一份**的常量 → 所有星球行省重名（老板验收发现）。
       母星保留其「出生区」体系（STATE_SPECIALTY 等，按计划地块读 `stateOfCity`），与本 3D 行政层无关。 */
    var ni = 0, _nameUsed = {};
    var _n0 = (seed >>> 0) % WAS_PRE.length;             /* v90.99：起始前缀随 seed → 各星球名字不重样 */
    function genName() {                                  /* 废土名 · 前后缀快速轮换（自然混合）· 唯一 */
      var ln = WAS_PRE.length * WAS_SUF.length;
      for (var tries = 0; tries < ln; tries++) {
        var n = WAS_PRE[(_n0 + ni * 7) % WAS_PRE.length] + WAS_SUF[(ni * 13) % WAS_SUF.length];
        ni++;
        if (!_nameUsed[n]) { _nameUsed[n] = 1; return n; }
      }
      return '废邑' + (ni++);
    }
    /* 加权就近：权重越大 → 该区面积越大（面积 ∝ 权重）· 域扭曲 → 边界平滑 */
    function weightedNearest(dir, cent, wts, salt) {
      var wd = warpDir(dir, salt), best = 0, bs = 1e9;
      for (var j = 0; j < cent.length; j++) {
        var d = 1 - dot3(wd, cent[j]) + 0.02;
        var s = d / wts[j];
        if (s < bs) { bs = s; best = j; }
      }
      return best;
    }
    /* ============================================================
     * v91.44（老板）：「行省/市/区的**首府/首市/首区**竟然不在该辖区内」——
     *   根因：中心点取的是 kmeans **质心方向**，而行政区是**非凸连通块**，
     *   质心常落在辖区外（甚至落进别的区）→ `nearestCell(质心)` 取到的格子不在本区。
     * 修：`groupCenterDir(cent, members)` = 取**该组成员方向求平均 → 再取离平均最近的成员格**，
     *   保证返回的**一定落在组内**（成员本身）。省/市/区三级中心统一走它。
     * ============================================================ */
    function groupCenterDir(cent, members) {
      if (!members || !members.length) return { dir: cent, ci: -1 };
      var sx = 0, sy = 0, sz = 0;
      for (var gi = 0; gi < members.length; gi++) { var gd = M._vdirs[members[gi]]; if (!gd) continue; sx += gd[0]; sy += gd[1]; sz += gd[2]; }
      var gl = Math.hypot(sx, sy, sz) || 1, gc = [sx / gl, sy / gl, sz / gl];
      var best = null, bci = -1, bd = -2;
      for (var gj = 0; gj < members.length; gj++) { var dd = M._vdirs[members[gj]]; if (!dd) continue; var dt = dd[0] * gc[0] + dd[1] * gc[1] + dd[2] * gc[2]; if (dt > bd) { bd = dt; best = dd; bci = members[gj]; } }
      return { dir: best || cent, ci: bci };
    }
    /* v90.99（老板）：**省/市/区数量随星球陆地面积缩放** —— 老家（~45% 陆地）为 1.0 基准，
       小星球省更少、大星球省更多（不必与老家一致）。再按「每省 2~6 市、每市 2~4 区」配面积。 */
    var landFrac = dirs.length / Math.max(1, nv);
    var scale = landFrac / 0.45;
    var nProv = Math.max(3, Math.min(18, Math.round(scale * 12)));
    nProv = Math.min(nProv, dirs.length);                 /* 省数不得超过陆地格数 */
    if (nProv < 1) return empty;
    var MC = []; for (var q0 = 0; q0 < nProv; q0++) MC.push(2);
    var targetM = Math.max(nProv * 2, Math.min(nProv * 6, Math.round(scale * 48)));
    var pool = targetM - nProv * 2;
    for (var jj = 0; pool > 0; jj++) { var ix = Math.floor(rh(100 + jj, seed) * nProv); if (MC[ix] < 6) { MC[ix]++; pool--; } }
    var DC = [], PD = [];
    for (var pp = 0; pp < nProv; pp++) { var arr = [], tot = 0; for (var qq = 0; qq < MC[pp]; qq++) { var dv = 2 + Math.floor(rh((pp * 97 + qq) * 13 + 5, seed) * 3); arr.push(dv); tot += dv; } DC.push(arr); PD.push(tot); }
    /* 顶点邻接（供连通性修复）*/
    var adj = new Array(nv);
    for (var ai = 0; ai < nv; ai++) adj[ai] = [];
    var fAdj = M._icoF || [];
    for (var af = 0; af < fAdj.length; af++) {
      var TF = fAdj[af];
      adj[TF[0]].push(TF[1], TF[2]); adj[TF[1]].push(TF[0], TF[2]); adj[TF[2]].push(TF[0], TF[1]);
    }
    /* 连通性修复：把每级的**孤岛碎片**并进相邻最大区（保证每省/市/区**相邻连续**）。
       parent = 上级归属数组（市/区修复时只在**同一父区**内合并，不破坏辖地嵌套）。*/
    function repairConn(mem, land, parent) {
      var groups = {};
      for (var li = 0; li < land.length; li++) { var g = mem[land[li]]; if (g < 0) continue; (groups[g] = groups[g] || []).push(land[li]); }
      for (var gk in groups) {
        var gid = +gk, members = groups[gk], seen = {}, comps = [];
        for (var mi = 0; mi < members.length; mi++) {
          var ci = members[mi]; if (seen[ci]) continue;
          var stack = [ci], comp = []; seen[ci] = 1;
          while (stack.length) { var c = stack.pop(); comp.push(c); var anb = adj[c]; for (var k = 0; k < anb.length; k++) { var nb = anb[k]; if (!seen[nb] && mem[nb] === gid && (!parent || parent[nb] === parent[c])) { seen[nb] = 1; stack.push(nb); } } }
          comps.push(comp);
        }
        if (comps.length <= 1) continue;
        comps.sort(function (a, b) { return b.length - a.length; });
        for (var kk = 1; kk < comps.length; kk++) {
          var isl = comps[kk], cnt = {}, bg = -1, bc = 0;
          for (var ii = 0; ii < isl.length; ii++) { var an2 = adj[isl[ii]]; for (var q = 0; q < an2.length; q++) { var n2 = an2[q]; if (mem[n2] !== gid && mem[n2] >= 0 && (!parent || parent[n2] === parent[isl[ii]])) { cnt[mem[n2]] = (cnt[mem[n2]] || 0) + 1; } } }
          for (var g2 in cnt) if (cnt[g2] > bc) { bc = cnt[g2]; bg = +g2; }
          for (var i3 = 0; i3 < isl.length; i3++) mem[isl[i3]] = bg;
        }
      }
    }
    /* v90.99：省数 = nProv（随星球陆地面积缩放，见上）—— 互相接壤、覆盖全陆 · 省面积 ∝ 省总区数 PD */
    var provCent = sphereKmeans(dirs, nProv, 10);
    var provOf = new Int16Array(nv).fill(-1), provMembers = [];
    for (var js = 0; js < provCent.length; js++) provMembers.push([]);
    /* v90.58（老板「海面也应该有行政划分，归入行省管理范围」）：
       行省归属**覆盖全球**（陆 + 海）—— 海面按**最近省心**并入行省；省界因此延伸到海面。
       市/区仍只划在陆地（下方按 provMembers=陆地成员 分市）。 */
    for (var dj = 0; dj < nv; dj++) { var _vd = M._vdirs[dj]; if (!_vd) continue; provOf[dj] = weightedNearest(_vd, provCent, PD, 4100 + seed); }
    repairConn(provOf, idxs);                                  /* 省 connectivity（只修陆地；海面 Voronoi 本就连通） */
    for (var d2 = 0; d2 < idxs.length; d2++) if (provOf[idxs[d2]] >= 0) provMembers[provOf[idxs[d2]]].push(idxs[d2]);
    var marketCent = [], marketOf = new Int16Array(nv).fill(-1), districtCent = [], districtOf = new Int16Array(nv).fill(-1);
    var table = { old: null, prov: [], market: [], district: [] };
    var lc = [0, 0, 0], ln = 0;
    for (var i2 = 0; i2 < dirs.length; i2++) if (sphElev(dirs[i2]) > 0.4) { lc[0] += dirs[i2][0]; lc[1] += dirs[i2][1]; lc[2] += dirs[i2][2]; ln++; }
    if (ln) { var L = Math.hypot(lc[0], lc[1], lc[2]) || 1; lc = [lc[0] / L, lc[1] / L, lc[2] / L]; } else lc = dirs[0];
    table.old = null;   /* v90.59（老板「怎么有 2 个灰烬城」）：旧都是 **NPC 名城 灰烬城**（NPC_CITIES.cap），
                           行政层不再另造一个同名「灰烬城」中心（原 addAdm('old') 位置由质心算出、与 NPC 城错位 → 重名两款）。 */
    /* 各省分市（市数 = MC[p]）；**市面积 ∝ 该市区数 DC[p][q]** · 市在本省内（连通修复限同省）*/
    for (var p = 0; p < provCent.length; p++) {
      var pm = provMembers[p]; if (!pm.length) continue;
      var pNode = { name: genName(), cent: provCent[p], markets: [] };   /* v90.99：省名走废土名池（各星唯一） */
      var mn = Math.max(1, Math.min(MC[p], pm.length));
      var pmd = pm.map(function (ci) { return M._vdirs[ci]; });
      var mc = sphereKmeans(pmd, mn, 6), mdc = DC[p].slice(0, mn);
      var mBase = marketCent.length;
      for (var t = 0; t < pm.length; t++) { var ci2 = pm[t], a2 = weightedNearest(M._vdirs[ci2], mc, mdc, 7300 + seed); marketOf[ci2] = mBase + a2; }
      repairConn(marketOf, pm, provOf);                        /* 市 connectivity（限同省）*/
      var mm = [];
      for (var q2 = 0; q2 < mn; q2++) mm.push([]);
      for (var t2b = 0; t2b < pm.length; t2b++) { var ci2b = pm[t2b], a2b = marketOf[ci2b] - mBase; if (a2b >= 0 && a2b < mn) mm[a2b].push(ci2b); else { /* 越界兜底：并入最近 */ mm[Math.max(0, Math.min(mn - 1, a2b))].push(ci2b); marketOf[ci2b] = mBase + Math.max(0, Math.min(mn - 1, a2b)); } }
      for (var q3 = 0; q3 < mn; q3++) {
        var mIdx = marketCent.length; marketCent.push(mc[q3]);
        var mmb = mm[q3] || [], mNode = { name: genName(), cent: mc[q3], prov: p, districts: [] };
        var dn = Math.max(1, Math.min(mdc[q3], mmb.length || 1));
        if (mmb.length) {
          var mmd = mmb.map(function (ci) { return M._vdirs[ci]; });
          var dc = sphereKmeans(mmd, dn, 5), dBase = districtCent.length;
          for (var t3 = 0; t3 < mmb.length; t3++) districtOf[mmb[t3]] = dBase + nearestCentNoisy(M._vdirs[mmb[t3]], dc, 9500 + seed);
          repairConn(districtOf, mmb, marketOf);               /* 区 connectivity（限同市）*/
          for (var q4 = 0; q4 < dc.length; q4++) { districtCent.push(dc[q4]); mNode.districts.push(districtCent.length - 1); table.district.push({ name: genName(), cent: dc[q4], market: mIdx }); }
        }
        pNode.markets.push(table.market.length); table.market.push(mNode);
      }
      table.prov.push(pNode);
    }
    /* v91.44：**行政中心一律落回本辖区**（kmeans 质心可能落在辖区外/别区）——
       用最终归属数组反推每级成员，把中心改成"组内离组质心最近的格"，并**记下该格的 ci**。
       中心格 = 组内成员本身 → 一定落在本辖区；且 `_ci` 直供落点，免 `nearestCell` 再反查
       （反查在边界上可能落到邻格 → 少数市/区"中心跑到邻区"的残留）。 */
    (function () {
      var _pM = [], _mM = [], _dM = [];
      for (var z = 0; z < provCent.length; z++) _pM.push([]);
      for (var z2 = 0; z2 < marketCent.length; z2++) _mM.push([]);
      for (var z3 = 0; z3 < districtCent.length; z3++) _dM.push([]);
      for (var ci = 0; ci < nv; ci++) {
        if (provOf[ci] >= 0 && _pM[provOf[ci]]) _pM[provOf[ci]].push(ci);
        if (marketOf[ci] >= 0 && _mM[marketOf[ci]]) _mM[marketOf[ci]].push(ci);
        if (districtOf[ci] >= 0 && _dM[districtOf[ci]]) _dM[districtOf[ci]].push(ci);
      }
      for (var pi = 0; pi < provCent.length; pi++) { var g1 = groupCenterDir(provCent[pi], _pM[pi]); provCent[pi] = g1.dir; if (table.prov[pi]) table.prov[pi].cent = g1.dir; }
      for (var mi = 0; mi < marketCent.length; mi++) { var g2 = groupCenterDir(marketCent[mi], _mM[mi]); marketCent[mi] = g2.dir; if (table.market[mi]) table.market[mi].cent = g2.dir; }
      for (var di = 0; di < districtCent.length; di++) { var g3 = groupCenterDir(districtCent[di], _dM[di]); districtCent[di] = g3.dir; if (table.district[di]) table.district[di].cent = g3.dir; }
    })();
    M.adminTable = table;
    /* 行政中心**城对象**（旧都/省府/市府/区）—— 占据地块、可点弹出征界面 */
    /* v157f（老板：「省市区名城初始等级上限，不随被玩家占领而改变，首府20级，
       占了不能变成12级」）——
       这里原来另有一套 `EGT = {old:22, prov:18, market:14, district:9}`，
       与名城的档位表 `NPC_TIER_LV = {capital:24, zhou:20, jun:16, county:12}` **并存**。
       两套值一旦同时存在于同一座城上就是 bug 温床：上限按档位算（20），
       而 `city.level` 字段是 EGT（18），谁读字段谁就看到另一个数。
       现在**只有一套**：等级一律取档位表，EGT 退役。 */
    var admCities = [];
    function tierOf(lv) { return lv === 'old' ? 'capital' : lv === 'prov' ? 'zhou' : lv === 'market' ? 'jun' : 'county'; }
    /* v91.44：落点 ci = **在最终归属数组里属于本辖区 idx、且方向离该中心最近的格** ——
       无论如何都能保证"中心格 ∈ 本辖区"（省/市/区同一把尺）。 */
    function cellInGroup(arr, idx, cent) {
      var best = -1, bd = -2;
      for (var k = 0; k < nv; k++) {
        if (arr[k] !== idx) continue;
        var d = M._vdirs[k]; if (!d) continue;
        var dt = d[0] * cent[0] + d[1] * cent[1] + d[2] * cent[2];
        if (dt > bd) { bd = dt; best = k; }
      }
      return best;
    }
    function addAdm(lv, name, cent, idx, hintArr) {
      var ci = (hintArr ? cellInGroup(hintArr, idx, cent) : -1);
      if (ci < 0) ci = nearestCell(cent);
      if (ci < 0) return;
      var cell = _tileCells[ci]; if (!cell) return;
      var tier = tierOf(lv);
      /* ⚠️ 本文件没有 `DATA` 这个符号（用 GAME.DATA）—— 写成 DATA.xxx 会抛
         ReferenceError，被外层 try 吞掉 → 253 座行政城全部消失且无报错。 */
      var _D = GAME.DATA || {};
      var lvl = ((_D.NPC_TIER_LV || {})[tier]) || _D.MAX_BLEVEL || 12;   /* 唯一起源：档位表 */

      var c = { id: 'adm_' + lv + '_' + idx, name: name, x: cell.x, y: cell.y, ci: ci,
        type: tier, owner: 'npc', level: lvl, tierCap: lvl,
        /* tierCap = **档位等级上限**，独立于 level 字段存一份：
           占领后玩家侧的各种加成/闸门怎么变，这个数都不该跟着变。 */
        admLevel: lv, admIndex: idx, _cent: cent };
      c.garrison = GAME.genGarrison ? GAME.genGarrison(c) : {};   /* 旧设定：按城档守军 */
      c.maxArmy = c.garrison;
      admCities.push(c);
    }
    /* v90.59（老板「怎么有 2 个灰烬城」）：旧都 = **NPC 名城 灰烬城**（NPC_CITIES.cap）——
       行政层不再另造同名「灰烬城」中心（原 addAdm('old') 按质心算出、与 NPC 城错位 → 重名两款）。 */
    var pa;
    for (pa = 0; pa < provCent.length; pa++) {
      var pv2 = table.prov[pa]; if (!pv2) continue;
      addAdm('prov', pv2.name + '府', pv2.cent, pa, provOf);
      pv2.markets.forEach(function (mi) { var m = table.market[mi]; addAdm('market', m.name, m.cent, mi, marketOf); });
      pv2.markets.forEach(function (mi) { table.market[mi].districts.forEach(function (di) { var d = table.district[di]; addAdm('district', d.name, d.cent, di, districtOf); }); });
    }
    M.admCities = admCities;
    M._settle = { old: lc, oldName: '灰烬城', provCent: provCent, marketCent: marketCent, districtCent: districtCent,
      provOf: provOf, marketOf: marketOf, districtOf: districtOf, table: table, admCities: admCities };
    M._settleSeed = seed;
    return M._settle;
  }

  /* ---- 区域 **边界线**：只画"两侧地块属于不同区"的共享六边形边（对偶边 = 干净连续单线）
     parent/target 给定 → 只画**该父区内**的子级边界（选省时只画本省内的市界）。---- */
  function regionLineSegs(mem, parent, target) {
    var F = M._icoF, cent = M._cent;
    if (!F || !cent) return [];
    function cp(f) { var d = cent[f], r = R + Math.max(0, sphElev(d)) * HSC + 2.2; return [d[0] * r, d[1] * r, d[2] * r]; }
    var emap = {}, seg = [];
    for (var f = 0; f < F.length; f++) {
      var T = F[f];
      for (var e = 0; e < 3; e++) {
        var i = T[e], j = T[(e + 1) % 3], key = i < j ? i + '_' + j : j + '_' + i;
        if (emap[key] === undefined) { emap[key] = f; continue; }
        if (mem[i] < 0 || mem[j] < 0) continue;           /* 海/无分区 → 不画 */
        if (mem[i] === mem[j]) continue;                 /* 同区 → 非边界 */
        if (parent && (parent[i] !== target || parent[j] !== target)) continue;   /* 限父区内部 */
        var a = cp(emap[key]), b = cp(f);                /* 共享边两侧两面的对偶点 = 六边形边 */
        seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
    return seg;
  }
  function buildRegions() {
    if (M._regions) { scene.remove(M._regions); M._regions = null; }
    if (!M._vdirs || !M._icoF) return;
    var lv = M.regionLevel == null ? 3 : M.regionLevel;   /* 分级显示：1=仅省界 2=+市 3=+区（逐步生成）*/
    var S = genSettlements();
    var grp = new THREE.Group();
    /* v154（老板：「除了地块有六边形边，不允许其他有边，现在有重影 ——
       省市区的边应该重描地块的边，而不是重新画一条」）
       —— 不再另外画一层线（那层线用的是另一套顶点，和大六边形错位 = 重影）。
       改成：**把地块自己的边**（与六边形边同一条）按归属上色 ——
         · 省界 = 亮蓝、市界 = 品红、区界 = 深绿，逐层覆盖；
         · 只改那块线框的顶点色，不新增任何几何 → 永远与六边形边重合。 */
    M.regionPalette = { prov: [80, 140, 255], market: [255, 90, 200], district: [40, 150, 70] };
    M._regionOn = { prov: true, market: lv >= 2, district: lv >= 3 };
    /* 画线交给 paintRegionEdges（在 buildTiles 之后、对 ume 顶点色动手） */
    try { paintRegionEdges(); } catch (eRG) { /* 边界着色失败不挡地图 */ }
    M._regions = grp; scene.add(grp);
  }

  /* 据点(黄) / 城市(红) / 己方城(蓝) —— 各自地块的抬升点位（中心小六边）。*/
  /* 聚落层级柱子尺寸：旧都最大 → 省府 → 市 → 区 逐渐缩小 */
  function buildMarkers() {
    if (M._markers) { scene.remove(M._markers); M._markers = null; }
    if (M._labels) { scene.remove(M._labels); M._labels = null; }
    if (!_tileCells || !_tileCells.length || !M._vdirs) return;
    var S = genSettlements(); if (!S) return;
    /* v90.97（双球面）：据点按**地图星球**的球面/种子/分片算（未必 = 当前城所在星球）。 */
    var mctx = GAME.map._pctx(GAME.mapPlanetOf ? GAME.mapPlanetOf().id : null);
    var mark = {};                                          /* cellIndex → [r,g,b]（平涂地块）*/
    /* 地块**属性索引**：每格 = 野地 / 城市 / 据点（明确区分）*/
    var cellKind = {}, cellRef = {};
    /* ═══ v156.18（老板：「城市或据点整成一个 3D 模型，废土风格」）═══
       城镇模型的数据源就在这里顺手攒一份 —— `buildTowns()` 直接吃 `M._settles`，
       不再自己去扫一遍地图（两处各算一遍，迟早出现"色块在这、模型在那"的错位）。
       每条 = { ci, kind, lv }；lv 用来决定城镇规模（等级越高越大）。 */
    var settles = M._settles = { own: [], npc: [], adm: [], fort: [] };
    for (var vi0 = 0; vi0 < M._vdirs.length; vi0++) if (M._vdirs[vi0] && S.provOf[vi0] >= 0) { cellKind[vi0] = 'wild'; }   /* 默认：陆地块 = 野地 */
    /* 据点 = 黄 */
    for (var fi = 0; fi < _tileCells.length; fi++) { var fc = _tileCells[fi]; if (fc && GAME.map.fortAt(fc.ci, mctx)) { mark[fi] = [226, 202, 64]; cellKind[fi] = 'fort';
      var _ffo = GAME.map.fortAt(fc.ci, mctx);
      settles.fort.push({ ci: fi, lv: (_ffo && (_ffo.lv || _ffo.level)) || 1 }); } }
    /* v90.70：实体 → 六边格索引。带 .ci 直用（球系唯一身份）；否则按 (x,y) 现算（旧档/未标注）。 */
    function ciOfRef(ref) {
      if (!ref) return -1;
      if (ref.ci != null && ref.ci >= 0 && SP.cells && SP.cells[ref.ci]) return ref.ci;
      if (ref.x == null || ref.y == null) return -1;
      return nearestCell(dirOfCell(ref.x, ref.y));
    }
    /* NPC 名城 = 红
       v91.09（老板「新星球名城没有守兵」根因）：marker 的 cellRef 直接传 **DATA.NPC_CITIES 原始模板**
       （无 `garrison` 字段）→ 弹出征/攻打时 `npcCity.garrison` 为空（**0 守军、免战可占**）。
       2D 路径走 `s.map.cities`（buildNpcCities 产、**带守军**）故无此问题 —— 根因是 3D 走了原始模板。
       守军按城 id 派生（`genGarrison` 与星球无关）→ 缺则现算，一次补齐（幂等）。 */
    /* ═══ v139（老板「城随地形走」）：**这里必须读迁移后的名单** ═══
       原写法读 `DATA.NPC_CITIES`（原始常量表，x/y 是旧 2D 年代的坐标）。
       v139 把城按地形重选址之后，原始表就是**过期快照**：
         · 红标记仍画在旧位置（实测 13 座名城里 6 座的旧位置是湖）；
         · 点中它拿到的 cellRef 也是原始模板（x/y 错、ci 错）→ 出征目标错位。
       改读 `state.map.cities` —— buildNpcCities 产、**已迁移、带守军与 water 标志**；
       原始表仅在「还没 buildNpcCities」时兜底（避免开局一瞬没标记）。 */
    var _npcList = (((GAME.state || {}).map || {}).cities) || [];
    if (!_npcList.length) _npcList = (GAME.DATA.NPC_CITIES || []);
    _npcList.forEach(function (c) {
      if (c.lon == null || c.lat == null) { var d = dirOfCell(c.x, c.y); c.lon = (-Math.atan2(d[2], d[0]) * 180 / Math.PI + 360) % 360; c.lat = Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180 / Math.PI; }
      if (!c.garrison && GAME.genGarrison) { c.garrison = GAME.genGarrison(c); c.maxArmy = c.garrison; }
      var ci = ciOfRef(c); if (ci >= 0) { mark[ci] = [220, 70, 60]; cellKind[ci] = 'npc'; cellRef[ci] = c;
        settles.npc.push({ ci: ci, lv: c.lv || c.level || 3 }); }
    });
    /* 行政中心城 = 紫色（按球面质心方向取格）
       ═══ v156.24（老板「占领省市区首府」）═══
       已被我方占据的行政中心**不再画成紫色**：
       否则同一格会同时出现"己方城的蓝标记"和"行政城的紫模型"（两座模型叠在一起），
       玩家看到的是"我打下了省府，可地图上它还是敌方的样子"。
       判据与下面的 own 分支同源（都读 mapSliceOf().cities），不另立一套。 */
    var _ownAdmKey = {};
    ((GAME.mapSliceOf() || {}).cities || []).forEach(function (c) {
      if (c && c.admLevel && c.admIndex != null) _ownAdmKey[c.admLevel + '|' + c.admIndex] = 1;
    });
    (M.admCities || []).forEach(function (c) {
      if (_ownAdmKey[c.admLevel + '|' + c.admIndex]) return;    /* 已占 → 交给 own 分支画 */
      var ci = (c.ci != null && c.ci >= 0) ? c.ci : nearestCell(c._cent); if (ci >= 0) { mark[ci] = [180, 120, 210]; cellKind[ci] = 'adm'; cellRef[ci] = c;
        settles.adm.push({ ci: ci, lv: c.lv || 4 }); } });
    /* 己方城 = 蓝：落在其**球面六边格索引 ci**（球系唯一身份，免 (x,y) 往返）
       v90.97（双球面）：读**地图星球分片**的城（未必 = 当前城所在星球）。 */
    M._ownCells = {};
    ((GAME.mapSliceOf() || {}).cities || []).forEach(function (c) {
      var ci = ciOfRef(c);
      var dir = (ci >= 0 && SP.cells[ci]) ? SP.cells[ci].dir : dirOfCell(c.x, c.y);
      c.lon = (-Math.atan2(dir[2], dir[0]) * 180 / Math.PI + 360) % 360;
      c.lat = Math.asin(Math.max(-1, Math.min(1, dir[1]))) * 180 / Math.PI;
      if (ci < 0) return;
      mark[ci] = [80, 150, 230]; cellKind[ci] = 'own'; cellRef[ci] = c; M._ownCells[ci] = c;
      settles.own.push({ ci: ci, lv: c.lv || c.level || 1 });
    });
    /* v92：**未探明的格子一律不出标记**。
       只把地形画暗却照样显示每座城/每块野地，迷雾就只是"地图变暗"，
       玩家仍然一眼看尽 —— 那不是未知，是滤镜。
       己方城豁免（自家地盘必然已点亮，兜底防"自家城凭空消失"）。 */
    Object.keys(mark).forEach(function (k) {
      if (cellKind[k] === 'own') return;
      if (fogHides(+k)) { delete mark[k]; delete cellKind[k]; delete cellRef[k]; }
    });
    /* ============================================================
     * v152（实测截图抓到）：**前传开局旁边冒出几块粉/红六边形** ——
     * 那是名城/adm 城的标记面，按"雾里不出标记"的规矩**本该被删掉**，
     * 但它们是在 fogHides 判定**之后**才写进 mark 的（顺序反了）：
     *   · 行政中心城（紫）、名城（红）在 749~767 行就写好了；
     *   · 迷雾过滤在 772 行跑 —— 表面上看没问题……
     * 真正的漏洞是 `fogHides()` 只认**渲染球面**（GAME.sphere），而这两批标记
     * 写的是 `ciOfRef(c)` 在**地图球面**上的格号 —— 两球格号不同 → 判不出"在雾里"。
     * 口径：标记面上的**非己方**格子，统一按"该格是否已探明"再滤一遍（用 ci 直查）。
     * ============================================================ */
    try {
      /* ⛔ v157.85：这里原有 v152d 的「前传里把非己方城市色块删掉」分支 ——
         前传整段退役后不存在"独行者"阶段，城市/行政区色块按正常规则（探明与否）显示。 */
      Object.keys(mark).forEach(function (k) {
        var _k = +k;
        if (cellKind[_k] === 'own' || cellKind[_k] === 'lord') return;
        var _f = (GAME.fog && GAME.fog.get) ? GAME.fog.get(_k) : 2;
        if (_f === 0) { delete mark[_k]; delete cellKind[_k]; delete cellRef[_k]; }
      });
    } catch (eF152) { /* 过滤失败不挡地图 */ }
    /* ⛔ v157.85：v132 的「前传里把君主那一格涂成金色」整段删除（前传退役）。 */
    /* ⛔ v157.72（老板 2026-11-16「去除那些任务型地块标色并退役任务」）：
       v151「雾里有动静的格子自己发光」整条退役 —— 曾在君主视野 ≤10 环内把
       「有荒野事、且已探明」的格子涂成暗金色，让地图自己当任务板。
       ⚠️ 荒野行动内核（`GAME.jianghuActsAt`）**未动**：它是"这格能不能做事"的唯一判据口，
          退役的是「地图上的任务点提示」这一层。 */
    M.cellKind = cellKind; M.cellRef = cellRef;
    /* 平涂：每格六边形填色（贴地形 · 微抬）*/
    var pos = [], col = [], idx = [], base = 0;
    for (var ci2 in mark) {
      var c = _tileCells[ci2]; if (!c || !c.rim) continue;
      var rim = c.rim, mm = rim.length, P = c.pos, up = null, cL = Math.hypot(P[0], P[1], P[2]) || 1; up = [P[0] / cL, P[1] / cL, P[2] / cL];
      var rgb2 = mark[ci2], lift = 0.4;
      pos.push(P[0] + up[0] * lift, P[1] + up[1] * lift, P[2] + up[2] * lift); col.push(rgb2[0] / 255, rgb2[1] / 255, rgb2[2] / 255);
      var start = base, apex = base;
      for (var j = 0; j < mm; j++) { var p = rim[j], L = Math.hypot(p[0], p[1], p[2]) || 1; pos.push(p[0] + p[0] / L * lift, p[1] + p[1] / L * lift, p[2] + p[2] / L * lift); col.push(rgb2[0] / 255, rgb2[1] / 255, rgb2[2] / 255); }
      for (var t = 0; t < mm; t++) idx.push(apex, apex + 1 + t, apex + 1 + (t + 1) % mm);
      base = apex + 1 + mm;
    }
    if (pos.length) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      M._markers = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      scene.add(M._markers);
    }
    /* 名城：**指示线 + 悬浮名称**（在球外悬浮）*/
    var grp = new THREE.Group();
    var lp = [];
    function floatName(dir, text, colHex) {
      /* ⛔ v157.85：前传「只浮脚下那个名字」的过滤已删 —— 现在一律按迷雾决定是否浮名。 */
      /* v92：未探明格**不浮名**。否则雾里还飘着"灰烬城 / 某某府"，
         等于把整张地图的行省结构白送 —— 迷雾就形同虚设了。
         ⚠️ 必须用 **SP**（= GAME.mapSphere）反查，不能用 GAME.sphere：
         双球面下逻辑球面可能还没 build（nv=0，nearestCell 恒返回 -1）→ 过滤静默失效，
         未探明区照样飘城名（实测截图确认）。 */
      if (GAME.fog && dir && SP.nearestCell) {
        var _fci = SP.nearestCell(dir);
        if (_fci >= 0 && GAME.fog.get(_fci) === 0) return;
      }
      var r = R + Math.max(0, sphElev(dir)) * HSC;
      var g0 = [dir[0] * r, dir[1] * r, dir[2] * r];                 /* 地面点 */
      var g1 = [dir[0] * (r + 46), dir[1] * (r + 46), dir[2] * (r + 46)];   /* 悬浮点 */
      lp.push(g0[0], g0[1], g0[2], g1[0], g1[1], g1[2]);
      var spr = nameSprite(text, colHex || '#ffffff');
      spr.position.set(g1[0], g1[1], g1[2]);
      grp.add(spr);
    }
    /* v90.70：名称引线也走 ci（= 标记所在格），免 (x,y) 往返；无 ci 的旧档回退 dirOfCell。 */
    function dirOfRef(ref) {
      var ci = ciOfRef(ref);
      return (ci >= 0 && SP.cells[ci]) ? SP.cells[ci].dir : dirOfCell(ref.x, ref.y);
    }
    /* v91.36（老板「有名称的名城被占领后，同时冒出 2 个名称标签」）——
       被占名城**不再画原（金）标签**，只留「本城」的蓝标签（下方 own 循环画），
       避免同名双标签叠在一起。判据：本星球分片里已拥有的城，其 `origId` = 该名城的 id。 */
    var _ownOrig = {};
    (((GAME.mapSliceOf && GAME.mapSliceOf()) || {}).cities || []).forEach(function (c) { if (c && c.origId) _ownOrig[c.origId] = 1; });
    /* v139：同上 —— 金名也必须跟迁移后的坐标走，否则湖面上会漂着一串没有对应物的城名。 */
    _npcList.forEach(function (c) { if (_ownOrig[c.id]) return; if (c.type === 'capital' || c.type === 'zhou') floatName(dirOfRef(c), c.name || '', '#ffd76a'); });
    var ol = M.admCities || [];
    ol.forEach(function (c) { if (c.admLevel === 'old' || c.admLevel === 'prov') floatName(c._cent, c.name, c.admLevel === 'old' ? '#ffd76a' : '#cfe6ff'); });
    /* v90.57（老板）：**己方城市**也引出名称（像名城一样）—— 亮蓝＝己方色。
       v90.97（双球面）：名称取**地图星球分片**的城。 */
    /* v139（老板：「水中据点」）：浮动城市在名字后面挂一个「水上」，
       颜色也换成偏青 —— 一眼能看出"这座城是浮着的"，而不是漏渲染。 */
    /* ⚠️ v139 实测采到：这段第一版挂在 `mapSliceOf().cities` 上，
       而那个列表只有**玩家自己的城**（`sliceOf` → `by(s.cities)`）——
       水中据点是 NPC 城，在 `s.map.cities` 里，所以「· 水上」标签一条都没画出来（截图确认水面上空白）。
       现在：自己的城照旧蓝色；NPC 城里的浮动城单独上青色 + 「· 水上」。 */
    (((GAME.mapSliceOf && GAME.mapSliceOf()) || {}).cities || []).forEach(function (c) {
      floatName(dirOfCell(c.x, c.y), c.name || '城', '#8fd4ff');
    });
    _npcList.forEach(function (c) {
      if (!c.water) return;
      floatName(dirOfCell(c.x, c.y), (c.name || '城') + ' · 水上', '#6fd7e8');
    });
    /* ⛔ v157.85：前传的「▲ 你」头顶标签已删（前传退役，不再有"君主人偶"）。 */
    if (lp.length) { var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x0b0f14, transparent: true, opacity: 0.92, depthWrite: false }))); }
    M._labels = grp; scene.add(grp);
  }
  /* v91.12（老板 16）：**出征弧形箭头** —— 城市1 → 目标，地图上画一道**导弹打击曲线**。
     数据 = 当前地图星球的 `s.marches`（在途行军）：出发城(cityId) → 目标(tx,ty)。
     弧线走球面：起点/终点方向球面插值（slerp）并**沿法线外拱**（越高越像弹道）。
     淡金线 + 悬浮箭头头（Sprite）；随行军增减/抵达而重建（版本键 _arVer）。 */
  /* ============================================================
   * v156.18（老板：「城市或据点整成一个 3D 模型，用废土风格的城市或城镇模型」）
   * buildTowns() —— 整格色块 → **立体的废土城镇 / 前哨**
   * ------------------------------------------------------------
   * 口径（沿项目一贯做法）：
   *   · **纯程序化几何**：零外链、零贴图（同 makeFigure / makeProp / makeTree）；
   *   · 两套模板：`city` 城墙 + 6 角楼 + 主楼 + 棚屋 + 水塔 + 烟囱 + 废料堆；
   *     `fort` 围墙 + 瞭望塔 + 一间棚屋 + 碎料（据点有 1106 个，模板必须便宜）；
   *   · **InstancedMesh**：一个模板一次 draw call，四类归属（己方城 / 名城 / 行政 / 据点）
   *     各一个实例化网格，颜色靠 `instanceColor` 乘上去 —— 不是"一城一个 Group"（那是上万次 draw call）；
   *   · 规模随等级：城市 1 级 ≈ 0.7 格宽，每级 +6%，封顶 ~1.2 格；据点固定 ~0.35 格；
   *   · 雾里不画（与地块标记同一口径：没探明就不该看见城镇）；
   *   · `M.townsEnabled === false` 可一键关掉（低配兜底）。
   * 朝向：+Y 对齐格子法线，再按 ci 派生稳定转角（同一座城每次重建朝向一致，不会"转圈"）。
   * ============================================================ */
  /* 城镇尺寸 = f(kind, lv, 格宽) —— **纯函数**，故意不碰 THREE：
     jsdom 里建不出几何，但"多大、随等级怎么长、有没有封顶"这段口径必须能测（smoke §584）。 */
  function _townScaleOf(kind, lv, cellW) {
    var l = Math.max(1, Math.min(12, (lv | 0) || 1));
    return (kind === 'fort') ? (cellW * 0.18) : (cellW * 0.30 * (1 + 0.05 * (l - 1)));
  }
  var _townGeoCache = {};
  function _townRnd(i) {                     /* 稳定伪随机：同一 ci 每次一样 */
    var x = ((i | 0) * 2654435761) >>> 0;
    x ^= x >>> 15; x = (x * 2246822519) >>> 0; x ^= x >>> 13;
    return ((x >>> 0) % 100000) / 100000;
  }
  var _TOWN_C = {                            /* 废土调色（灰烬 / 锈 / 钢 / 骨白 / 灯）
                                                  ⚠️ 基准色比"写实废土"整体提亮 ~1.3×：
                                                  城镇在地图上是**小尺度远景**，暗色一压就成黑疙瘩。 */
    ash: [0.78, 0.75, 0.68], rust: [0.74, 0.45, 0.29], rustD: [0.52, 0.34, 0.22],
    steel: [0.58, 0.62, 0.66], wood: [0.55, 0.46, 0.34], bone: [0.90, 0.86, 0.74],
    glow: [1.00, 0.86, 0.45], dark: [0.30, 0.30, 0.32], sand: [0.80, 0.73, 0.58]
  };
  /* 把若干"几何 + 变换"合并成一个 BufferGeometry（带顶点色）。
     three r160 的 UMD **不带 BufferGeometryUtils**（那是 addon）→ 这里手写最小版合并。 */
  function _townMerge(parts) {
    var pos = [], nor = [], col = [], idx = [];
    var v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
    parts.forEach(function (p) {
      var g = p.geo, m = p.m, c = p.c || _TOWN_C.ash;
      var pa = g.attributes.position, na = g.attributes.normal, ia = g.index;
      nm.getNormalMatrix(m);
      var base = pos.length / 3;
      for (var i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m);
        pos.push(v.x, v.y, v.z);
        var ny = 1, nx = 0;
        if (na) {
          n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
          nor.push(n.x, n.y, n.z);
          ny = n.y; nx = n.x;
        } else { nor.push(0, 1, 0); }
        /* ⚠️ v156.18：**明暗直接烘进顶点色**，材质用 unlit（MeshBasicMaterial）。
           为什么不用 Lambert：地表是 MeshBasic（v154 口径：写入即所见），
           城镇若吃场景光照，转到背光面就整片变纯黑剪影（实测截图就是一团黑）。
           这里按面法线做假光照：顶面最亮、侧面压暗、并按 x 方向再分一点左右明暗，
           不依赖灯，转到哪儿都读得出体块。 */
        var shade = 0.74 + 0.32 * Math.max(0, ny) - 0.10 * Math.max(0, -nx);
        col.push(Math.min(1, c[0] * shade), Math.min(1, c[1] * shade), Math.min(1, c[2] * shade));
      }
      if (ia) { for (var k = 0; k < ia.count; k++) idx.push(base + ia.getX(k)); }
      else { for (var k2 = 0; k2 < pa.count; k2++) idx.push(base + k2); }
      g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.setIndex(idx);
    out.computeBoundingSphere();
    return out;
  }
  function _townM(x, y, z, ry, sx, sy, sz) {
    var m = new THREE.Matrix4();
    var q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx || 1, sy || 1, sz || 1));
    return m;
  }
  /* ============================================================
   * 城市模板（本地单位，跨度约 3.2；调用方按格宽缩放）
   * ------------------------------------------------------------
   * v156.18 第二版：**按轮廓建模，不按细节建模**。
   *   第一版做了墙段/烟囱/废料等 30 多个零件，实机截图一看全糊成"散落木条"——
   *   地图上一座城只有 ~0.6 格宽，细杆在这个尺度就是噪点。
   * 第二版换成**粗体块**：抬起的六边形台基（一眼看出"这里是一块地"）
   *   + 实心六边柱环墙（比 6 段方块连贯）+ 主楼（最高）+ 2 副楼 + 3 角楼 + 水塔。
   *   零件从 34 个降到 ~12 个，面数反而更少，剪影却清楚了。
   * ============================================================ */
  function _townGeoCity() {
    var P = [];
    var box = function (w, h, d, x, y, z, ry, c) {
      P.push({ geo: new THREE.BoxGeometry(w, h, d), m: _townM(x, y, z, ry), c: c });
    };
    var cyl = function (rt, rb, h, x, y, z, seg, c) {
      P.push({ geo: new THREE.CylinderGeometry(rt, rb, h, seg), m: _townM(x, y + h / 2, z), c: c });
    };
    var cone = function (r, h, x, y, z, seg, c) {
      P.push({ geo: new THREE.ConeGeometry(r, h, seg), m: _townM(x, y + h / 2, z), c: c });
    };
    /* ① 台基：六边形矮台（城镇从地表"抬起来"，一眼分辨"这一格有东西"） */
    cyl(1.58, 1.66, 0.20, 0, 0, 0, 6, _TOWN_C.dark);   /* 深色底盘：与地形拉对比，城镇才跳得出来 */
    /* ② 环墙：**空心**六边柱（openEnded=true）。
       ⚠️ 第一版用实心 CylinderGeometry：它自带顶盖 → 俯视时顶盖把整座城盖成一个
       大六边形色块，城内什么都看不见（截图当场抓到）。openEnded 之后才是一圈墙。 */
    /* 城墙用**深锈色 + 更厚更高**：它是"废土城镇"的身份标识，
       浅色薄墙在远景里直接消失（第三版实测），深色一圈才看得出"这里被围起来了"。 */
    P.push({ geo: new THREE.CylinderGeometry(1.50, 1.66, 0.96, 6, 1, true),
      m: _townM(0, 0.20 + 0.48, 0), c: _TOWN_C.rustD });
    /* 墙头一圈浅色压顶（给轮廓一条高光线，俯视也认得出墙） */
    P.push({ geo: new THREE.CylinderGeometry(1.53, 1.55, 0.09, 6, 1, true),
      m: _townM(0, 1.20, 0), c: _TOWN_C.bone });
    /* ③ 城门：前墙上一块深色门洞 */
    box(0.44, 0.36, 0.16, 0, 0.34, 1.44, 0, _TOWN_C.dark);
    /* ④ 主楼：全城最高，坡屋顶 + 两扇亮窗 */
    box(1.00, 1.90, 1.00, 0, 1.15, 0, 0.18, _TOWN_C.bone);
    cone(0.86, 0.66, 0, 2.10, 0, 4, _TOWN_C.rust);
    box(0.18, 0.16, 0.08, 0.24, 1.24, 0.50, 0.18, _TOWN_C.glow);
    box(0.18, 0.16, 0.08, -0.22, 0.80, 0.50, 0.18, _TOWN_C.glow);
    /* ⑤ 两座副楼（高度不同 → 有高低错落的天际线） */
    box(0.58, 0.96, 0.58, -0.66, 0.64, 0.34, 0.5, _TOWN_C.ash);
    cone(0.48, 0.30, -0.66, 1.12, 0.34, 4, _TOWN_C.rustD);
    box(0.52, 0.74, 0.52, 0.62, 0.53, -0.52, 1.1, _TOWN_C.rustD);
    /* ⑥ 三座角楼（只放三个：全放会变成"一圈细柱子"的噪点） */
    for (var t = 0; t < 3; t++) {
      var ta = t * Math.PI * 2 / 3 + 0.4;
      var tx = Math.cos(ta) * 1.30, tz = Math.sin(ta) * 1.30;
      cyl(0.32, 0.36, 1.42, tx, 0.20, tz, 6, _TOWN_C.bone);
      cone(0.44, 0.38, tx, 1.62, tz, 6, _TOWN_C.rust);
      box(0.15, 0.12, 0.15, tx, 1.20, tz, 0, _TOWN_C.glow);    /* 塔灯 */
    }
    /* ⑦ 水塔：废土城镇的招牌剪影（做粗一点才看得见） */
    cyl(0.17, 0.21, 1.16, -1.06, 0.16, -0.72, 6, _TOWN_C.steel);
    P.push({ geo: new THREE.SphereGeometry(0.27, 7, 5), m: _townM(-1.06, 1.44, -0.72), c: _TOWN_C.rust });
    return _townMerge(P);
  }
  /* ---- 据点模板（便宜版：台基 + 3 段粗墙 + 瞭望塔 + 一间棚屋，约 80 面）---- */
  function _townGeoFort() {
    var P = [];
    var box = function (w, h, d, x, y, z, ry, c) {
      P.push({ geo: new THREE.BoxGeometry(w, h, d), m: _townM(x, y, z, ry), c: c });
    };
    /* 台基 + 三面粗墙（围出半圈，留一口子当"还没有门"的前哨） */
    P.push({ geo: new THREE.CylinderGeometry(1.05, 1.10, 0.14, 6), m: _townM(0, 0.07, 0), c: _TOWN_C.sand });
    /* 台基顶盖用**开口**圆柱做一圈矮护栏时要注意：这里保留实心底板（据点需要"地"） */
    for (var i = 0; i < 3; i++) {
      var a = i * Math.PI * 2 / 3;
      box(1.34, 0.46, 0.24, Math.cos(a) * 0.92, 0.37, Math.sin(a) * 0.92, -a, _TOWN_C.ash);
    }
    /* 瞭望塔（据点唯一的高点）+ 塔灯 */
    P.push({ geo: new THREE.CylinderGeometry(0.24, 0.30, 1.06, 6), m: _townM(0.26, 0.67, -0.26), c: _TOWN_C.ash });
    P.push({ geo: new THREE.ConeGeometry(0.36, 0.34, 6), m: _townM(0.26, 1.37, -0.26), c: _TOWN_C.rust });
    box(0.15, 0.11, 0.15, 0.26, 1.06, -0.26, 0, _TOWN_C.glow);
    /* 一间棚屋 + 一个油桶（够认出"有人驻"就行） */
    box(0.58, 0.44, 0.50, -0.40, 0.34, 0.30, 0.6, _TOWN_C.rustD);
    P.push({ geo: new THREE.CylinderGeometry(0.16, 0.16, 0.34, 6), m: _townM(-0.78, 0.30, -0.34), c: _TOWN_C.steel });
    return _townMerge(P);
  }
  /* ============================================================
   * 球面坐标系 —— **唯一口径**（v2026-11-01 老板：「地图上城堡方向错乱，
   *   确定一下坐标体系，底部垂直于与球心的连线」）
   * ------------------------------------------------------------
   * 【世界系】原点 = 球心；+Y = 北极；经度 0° = +X；**东 = −Z**
   *   （icoSpheres 末尾翻 z 做经度镜像的结果，见 sphere.js:418 —— 镜像后
   *    「北极朝上」视角下东才落在屏幕右侧。）
   *
   * 【格局部系（右手）】+X = 东、+Y = 径向（朝天）、+Z = 南。
   *   → 推论：**3D 资产必须按「基座在 y=0、正面朝 +Z（南）」建模**，
   *     摆上去后基座平面自动 ⟂ 半径，脚/底座正好踩在地表。
   *
   * 【两个踩过的坑，写死在这里当规矩】
   *   ① 对齐法线后若要"绕自身竖轴转身"，轴必须是**局部 (0,1,0)**：
   *      正确 = q_align × R((0,1,0), θ)（右乘，先自转再对齐）；
   *      错误 = q_align × R(**n**, θ)（绕世界法线右乘）——
   *      这会把物体自己的上轴先转离法线，再被 q_align 拉平 → 随 θ 歪 0~90°。
   *      **v156.19 的"城堡方向错乱"就是这个错**：实测两座城偏离径向 18.6° / 142°。
   *   ② 平移与旋转必须**同源**：都用同一个 dir，否则位置在 A 格、姿态按 B 格。
   * ============================================================ */

  function buildTowns() {
    /* 重建：只摘掉实例化网格并释放**材质**；几何是 `_townGeoCache` 里共享的，
       在这里 dispose 会让下次重建拿到空几何（一次就白屏）。 */
    if (M._towns) {
      M._towns.forEach(function (o) {
        scene.remove(o);
        if (o.material && o.material.dispose) o.material.dispose();
        if (o.dispose) o.dispose();
      });
    }
    M._towns = [];
    if (M.townsEnabled === false) return;
    if (!_tileCells || !_tileCells.length || !M._settles) return;
    var S = M._settles;
    var cellW = Math.sqrt(4 * Math.PI * R * R / Math.max(1, _tileCells.filter(Boolean).length)) || 5;
    /* 四类归属 → 一个实例化网格各一份（颜色靠 instanceColor 乘，不是四套几何） */
    var GROUPS = [
      { key: 'own', kind: 'city', tint: [0.96, 1.04, 1.16] },   /* 己方：极淡冷调（归属主要看底下六边形色块） */
      { key: 'npc', kind: 'city', tint: [1.16, 0.94, 0.90] },   /* 名城：淡锈红 */
      { key: 'adm', kind: 'city', tint: [1.06, 0.94, 1.14] },   /* 行政：淡紫 */
      { key: 'fort', kind: 'fort', tint: [1.14, 1.06, 0.88] }    /* 据点：淡土黄 */
    ];
    var nn = new THREE.Vector3(), q = new THREE.Quaternion();
    var m4 = new THREE.Matrix4(), pp = new THREE.Vector3(), ss = new THREE.Vector3();
    var col = new THREE.Color();
    GROUPS.forEach(function (G) {
      var list = (S[G.key] || []).filter(function (e) {
        return e && e.ci >= 0 && e.ci < _tileCells.length && _tileCells[e.ci] && _tileCells[e.ci].dir
          && !fogHides(e.ci);
      });
      if (!list.length) return;
      var geo = _townGeoCache[G.kind] || (_townGeoCache[G.kind] = (G.kind === 'fort' ? _townGeoFort() : _townGeoCity()));
      /* unlit：明暗已在 _townMerge 里烘进顶点色（同地表口径，转到哪都看得清体块） */
      var mat = new THREE.MeshBasicMaterial({ vertexColors: true });
      var im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(function (e, i) {
        var d = _tileCells[e.ci].dir;
        var rr = R + Math.max(0, sphElev(d)) * HSC + 0.30;
        nn.set(d[0], d[1], d[2]).normalize();
        /* v156.19 修：**姿态走 surfaceQuat 唯一出口**（基座 ⟂ 半径）。
           转身角绕**局部竖轴** ±30°（确定性微扰，避免一排城像复制粘贴），
           不再是原来那条 `qr.setFromAxisAngle(nn, θ)` —— 它右乘绕世界法线，
           等于先把上轴掰歪再拉平，每座城随机歪 0~90°（本次"方向错乱"根因）。 */
        applyQuad(q, [nn.x, nn.y, nn.z], (_townRnd(e.ci) - 0.5) * 60);
        var lv = Math.max(1, Math.min(12, (e.lv | 0) || 1));
        var sc = _townScaleOf(G.kind, lv, cellW);
        pp.set(d[0] * rr, d[1] * rr, d[2] * rr);
        ss.set(sc, sc, sc);
        m4.compose(pp, q, ss);
        im.setMatrixAt(i, m4);
        col.setRGB(G.tint[0], G.tint[1], G.tint[2]);
        im.setColorAt(i, col);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = false;
      im.renderOrder = 3;
      scene.add(im);
      M._towns.push(im);
    });
  }

  function buildMarchArrows() {
    if (M._arrows) { scene.remove(M._arrows); M._arrows = null; }
    if (!GAME.map || !GAME.map.lonlatOf || !_tileCells || !_tileCells.length) return;
    var sl = (GAME.mapSliceOf && GAME.mapSliceOf()) || {};
    var marches = sl.marches || [];
    var cities = sl.cities || [];
    function cityOf(id) { for (var i = 0; i < cities.length; i++) if (cities[i].id === id) return cities[i]; return null; }
    /* 世界格 → 球面单位方向（走球系坐标唯一出口，与标记同源） */
    function dirAt(x, y) {
      var c = GAME.map.lonlatOf(x, y), d = GAME.map.dirOf(c.lon, c.lat);
      var L = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / L, d[1] / L, d[2] / L];
    }
    function slerp(a, b, t) {          /* 球面插值（防跨球弦切穿地表） */
      var dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      var th = Math.acos(dot);
      if (th < 1e-4) return a.slice();
      var s = Math.sin(th), w1 = Math.sin((1 - t) * th) / s, w2 = Math.sin(t * th) / s;
      var v = [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
      var L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L];
    }
    var grp = new THREE.Group(), segs = [], heads = [];
    marches.forEach(function (m) {
      if (!m) return;
      var c0 = cityOf(m.cityId); if (!c0 || m.tx == null || m.ty == null) return;
      var a = dirAt(c0.x, c0.y), b = dirAt(m.tx, m.ty);
      var R0 = (typeof R === 'number' ? R : 300) + 6;
      var N = 26, pts = [];
      for (var i = 0; i <= N; i++) {
        var t = i / N, d = slerp(a, b, t);
        var arc = Math.sin(t * Math.PI) * 0.16;   /* 弹道外拱 */
        var r = R0 * (1 + arc);
        pts.push(new THREE.Vector3(d[0] * r, d[1] * r, d[2] * r));
      }
      /* 用**带状（ribbon）**画弧 —— LineBasicMaterial 的 linewidth 在 WebGL 被忽略（恒 1px），
         单线太细看不见；改三角带（每点沿"侧向"±半宽）→ 明确可见的弹道曲线。 */
      var halfW = R0 * 0.0035;
      var vpos = [], vcol = [], idx = [], A = [0.98, 0.82, 0.32], A2 = [0.72, 0.55, 0.12];
      for (var k = 0; k <= N; k++) {
        var p = pts[k];
        var rad = p.clone().normalize();
        var tan = (k < N ? pts[k + 1].clone().sub(p) : p.clone().sub(pts[k - 1])).normalize();
        var side = new THREE.Vector3().crossVectors(rad, tan).normalize().multiplyScalar(halfW);
        vpos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z);
        vcol.push(A2[0], A2[1], A2[2], A[0], A[1], A[2]);
        if (k < N) { var o = k * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vpos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(vcol, 3));
      geo.setIndex(idx);
      grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })));
      /* 箭头头：终点沿切线方向 */
      var tip = pts[N], prev = pts[N - 1];
      var tang = new THREE.Vector3(tip.x - prev.x, tip.y - prev.y, tip.z - prev.z).normalize();
      var spr = arrowHeadSprite();
      spr.position.copy(tip).add(tang.clone().multiplyScalar(R0 * 0.02));
      grp.add(spr);
      heads.push(spr);
      segs.push(geo);
    });
    M._arrows = grp; scene.add(grp);
  }
  function arrowHeadSprite() {
    var SS = 2, w = 20 * SS, h = 26 * SS;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.beginPath(); g.moveTo(w / 2, 2 * SS); g.lineTo(w - 3 * SS, h - 2 * SS); g.lineTo(w / 2, h - 8 * SS); g.lineTo(3 * SS, h - 2 * SS); g.closePath();
    g.fillStyle = '#ffcf4d'; g.fill();
    g.lineWidth = 2 * SS; g.strokeStyle = 'rgba(10,14,20,.95)'; g.stroke();
    var tx = new THREE.CanvasTexture(c);
    tx.minFilter = THREE.LinearMipmapLinearFilter; tx.generateMipmaps = true;
    if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false }));
    spr.userData = { asp: w / h, arrow: true };
    return spr;
  }
  /* 平面格 (x,y) → 球面方向（走 GAME.map 的**球系坐标单一出口**）*/
  function dirOfCell(x, y) {
    var c = GAME.map.lonlatOf(x, y);
    return GAME.map.dirOf(c.lon, c.lat);
  }

  /* v91.05（老板）：「为己方据点、野地在地图上插个小旗子」——
     小旗 Sprite（旗杆 + 三角旗 + 底座），己方**据点=琥珀金 / 野地=绿**。
     屏幕尺寸由 scaleLabels 每帧归一（同名称标签）→ 恒定大小、随缩放不飘。 */
  function flagSprite(colorHex) {
    var SS = 3, w = 22 * SS, h = 30 * SS;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    var poleX = 6 * SS;
    /* 旗杆 */
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(poleX, 2 * SS); g.lineTo(poleX, h - 2 * SS);
    g.lineWidth = 3.2 * SS; g.strokeStyle = 'rgba(6,9,13,.95)'; g.stroke();
    g.lineWidth = 1.6 * SS; g.strokeStyle = '#cfd8e2'; g.stroke();
    /* 三角旗（右向） */
    var fw = w - poleX - 3 * SS, fh = 13 * SS;
    g.beginPath(); g.moveTo(poleX, 3 * SS); g.lineTo(poleX + fw, 3 * SS + fh * 0.5); g.lineTo(poleX, 3 * SS + fh); g.closePath();
    g.lineWidth = 2.4 * SS; g.strokeStyle = 'rgba(6,9,13,.95)'; g.stroke();
    g.fillStyle = colorHex; g.fill();
    /* 底座圆点 */
    g.beginPath(); g.arc(poleX, h - 3 * SS, 2.6 * SS, 0, 6.283);
    g.fillStyle = colorHex; g.fill();
    g.lineWidth = 1.5 * SS; g.strokeStyle = 'rgba(6,9,13,.9)'; g.stroke();
    var tx = new THREE.CanvasTexture(c);
    tx.minFilter = THREE.LinearMipmapLinearFilter; tx.generateMipmaps = true;
    if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: true }));
    spr.userData = { asp: w / h, flag: true };
    return spr;
  }
  /* ============================================================
   * v156（老板：「这些散点完全都没有依据……为什么不把对应的那个格子
   *   就是地块给它整体涂色呢？感觉现在那个点乱飘的」）
   * ------------------------------------------------------------
   * 改前：营地/村社/遗迹/迷雾边缘的"有东西"暗示，全是**悬空小球**
   *       （SphereGeometry 画在格心上方 3~5 单位）—— 既不贴地，也看不出属于哪一格。
   * 现在：统一改成**整格涂色** —— 每个标记就是一整个六边形地块，
   *       用半透明色罩在地表上（与地块同形、随地形、永远对得上格子）。
   * 实现：先收集 `{ ci: [r,g,b] }`，最后一次建一个"每格一个六边形"的网格。
   * ============================================================ */
  function buildCellTint(entries, opacity, order) {
    var n = 0, ci2;
    for (ci2 in entries) n++;
    if (!n) return null;
    var position = [], color = [], index = [];
    for (ci2 in entries) {
      var cell = _tileCells[ci2];
      if (!cell || !cell.pos || !cell.rim || !cell.rim.length) continue;
      var c = entries[ci2];
      var base = position.length / 3;
      var P = cell.pos, L = Math.hypot(P[0], P[1], P[2]) || 1, lift = 0.9;
      position.push(P[0] + P[0] / L * lift, P[1] + P[1] / L * lift, P[2] + P[2] / L * lift);
      color.push(c[0] / 255, c[1] / 255, c[2] / 255);
      var mm = cell.rim.length;
      for (var k = 0; k < mm; k++) {
        var p = cell.rim[k], pl = Math.hypot(p[0], p[1], p[2]) || 1;
        position.push(p[0] + p[0] / pl * lift, p[1] + p[1] / pl * lift, p[2] + p[2] / pl * lift);
        color.push(c[0] / 255, c[1] / 255, c[2] / 255);
      }
      for (k = 0; k < mm; k++) index.push(base, base + 1 + k, base + 1 + ((k + 1) % mm));
    }
    if (!position.length) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    g.setIndex(index);
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: opacity == null ? 0.55 : opacity,
      side: THREE.DoubleSide, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6
    }));
    m.renderOrder = order == null ? 19 : order;
    scene.add(m);
    return m;
  }

  /* 己方据点/野地 → 插旗（按**地图星球**；坐标走六边格中心）。*/
  function buildFlags() {
    if (M._flags) { scene.remove(M._flags); M._flags = null; }
    if (!_tileCells || !_tileCells.length) return;
    var sl = (GAME.mapSliceOf && GAME.mapSliceOf()) || {};
    var grp = new THREE.Group();
    /* v156：所有"地标类"标记改成整格涂色（见 buildCellTint 的注释） */
    var _tint = {};
    /* v157.77（老板：「依旧还有很多色块……没有声明这个是什么东西」）：
       `_tint` 只存颜色，**没存"为什么上色"** —— 于是悬停简报只能说"未探明"，
       玩家对着一片褐色/金色/青色块无从判断。这里同一处写入时顺手记下来源，
       悬停与面板都读它（同源，不会出现"颜色和说明不一致"）。
       取值：camp / village / own / memorial（v157.98 trace 退役 · v158.25 ruin 退役）*/
    var _tk = {}, _tkOwn = {};
    /* v157s（老板：「被占领地块，全地块用一个特征色显示，加上小旗子」）——
       旗子**只画了一个 sprite**，地上什么都没有。于是：
         · 玩家看到的"占领"只有一面小旗，点击容错极小；
         · 而 sprite 还抬升了 1.5 米，点它等于点它**背后**那格 → "点了旗子说未占领"。
       现在两件一起补：整格涂色（面积大、点哪儿都对）+ sprite 记住自己的 ci（点旗精确命中）。 */
    var _tintOwn = {};                 /* 占领类涂色，优先级高于营地/村社（末尾合并） */
    function _hex2rgb(h) {
      var v = String(h || '').replace('#', '');
      if (v.length !== 6) return [200, 200, 200];
      return [parseInt(v.substr(0, 2), 16), parseInt(v.substr(2, 2), 16), parseInt(v.substr(4, 2), 16)];
    }
    function place(ref, colorHex, kindW) {
      /* v91.25（球系）：**以 ci 直接落格**（旧法 dirOfCell(x,y) 经 (x,y)→经纬→最近格 往返，
         会落到邻格 → 棋子错位）。缺 ci 的旧档才回退坐标往返。 */
      var ci = (ref && ref.ci != null && ref.ci >= 0) ? ref.ci : ((ref && ref.x != null && ref.y != null) ? nearestCell(dirOfCell(ref.x, ref.y)) : -1);
      var cell = (ci >= 0) ? _tileCells[ci] : null; if (!cell || !cell.pos) return;
      /* ============================================================
       * v157u（老板：「旗子还是原来大小就行，置于地块中间，目前飞起一大片」）
       * ------------------------------------------------------------
       * 两个错：
       *  ① `flagSprite` 用 `userData = { asp: w/h, flag: true }` 记**宽高比**，
       *     而我上一版整条覆盖成 `{ ci, kind }` → `asp` 丢了 →
       *     `scaleLabels` 退回默认 5.3（真值 22/30≈0.73）→ 宽度膨胀 7 倍，
       *     就是"飞起一大片"。**改 userData 必须按字段写，不能整体替换。**
       *  ② 位置抬了 1.5 米、锚点又在图像中心 → 整个旗子悬在半空。
       *     改为**底部锚点 + 0.4 米**：旗杆底落在格面上，看起来是"插在地里"。
       * ============================================================ */
      var P = cell.pos, L = Math.hypot(P[0], P[1], P[2]) || 1, lift = 0.4;
      var spr = flagSprite(colorHex);
      spr.position.set(P[0] + P[0] / L * lift, P[1] + P[1] / L * lift, P[2] + P[2] / L * lift);
      /* 锚点移到图像底部（原 0.5 是中心）：旗杆底对齐格面 */
      spr.center.set(0.5, 0.03);
      /* ⚠️ 只补字段，不要整体替换 —— 会冲掉 asp / flag */
      spr.userData.ci = ci;
      spr.userData.kind = 'flag';
      grp.add(spr);
      /* 整格涂色：跟旗子同一个色，一眼看出"这块地是我的" */
      _tintOwn[ci] = _hex2rgb(colorHex);
      _tkOwn[ci] = kindW || 'own';   /* v157.77：连来源一起记，悬停才能说清是什么 */
    }
    var fo = sl.forts || {};
    /* 己方据点 = **蓝**（原来是琥珀金 #ffcf4d，与"营地·待交涉"的 [255,200,87] 几乎同色，
       玩家分不出"这格是营地还是我的前哨"）。蓝色在本图配色里没有别的用途。 */
    Object.keys(fo).forEach(function (k) { place(fo[k], '#4aa8ff'); });
    (sl.wilds || []).forEach(function (w) { place(w, '#7bd88f'); });      /* 己方野地 = 绿 */
    /* v92：**阵亡地点**留一面暗红的旗 —— 地图上看得见"这一带死过人"。
       不做数字标签（"42 人"）挂在旗上：旗帜是纪念，不是战绩榜。 */
    if (GAME.memorial && GAME.memorial.byPlace) {
      var bp = GAME.memorial.byPlace();
      Object.keys(bp).forEach(function (k) {
        var ci = +k; if (!(ci >= 0)) return;
        var cell0 = _tileCells[ci];
        if (!cell0 || !cell0.pos) return;
        if (GAME.fog && GAME.fog.get(ci) === 0) return;   /* 未探明的地方不显示（否则等于免费探图）*/
        place({ ci: ci }, '#9c3b34', 'memorial');
      });
    }
    /* v156：整格涂色层在**本函数末尾**构建（营地/村社/遗迹都在后面才写入 _tint） */
    /* ⛔ v157.98：「迷雾边缘的动静痕迹」涂色已退役（见 §586q 相关注释）——
       它属于已下线的前传（v92.6 构想 A2），删除后未探明区只剩「干净未探明」一种长相。 */
    /* v92.4：已发现的幸存者营地 —— 金珠（待交涉）/ 绿珠（已招募）/ 暗红珠（已洗劫）。
       只在已探明处显示：探明度掉了（换星球/重置）就不画，不泄露位置。 */
    if (GAME.camp && GAME.camp.found) {
      var _cf = GAME.camp.found();
      Object.keys(_cf).forEach(function (k) {
        var ci = +k, rec = _cf[k];
        var cell0 = _tileCells[ci];
        if (!cell0 || !cell0.pos) return;
        if (GAME.fog && GAME.fog.get(ci) <= 0) return;
        var col = rec && rec.mode === 'recruit' ? [123, 216, 143] : (rec && rec.mode === 'raid' ? [156, 59, 52] : [255, 200, 87]);
        _tint[ci] = col; _tk[ci] = 'camp';
      });
    }
    /* v93.2：**村社** —— 废土上还有别人在活。
       与营地/遗迹不同：它们不需要"发现"动作，探明就看得见（人住在那里是明显的）。
       暖白＝有人 · 亮绿＝你护着 · 暗灰＝空村（他们走了）。 */
    if (GAME.village && GAME.village.list) {
      /* ⚠️ 必须用 listAll：list() 只是哈希候选，**世界自己开垦出来的新村不在里面**
         （v93.5）。用 list() 会出现"行政页说有 25 处，地图上只画 24 处"。 */
      var _vl = (GAME.village.listAll || GAME.village.list)();
      for (var _vi = 0; _vi < _vl.length; _vi++) {
        var _vci = _vl[_vi];
        var _vc = _tileCells[_vci];
        if (!_vc || !_vc.pos) continue;
        if (GAME.fog && GAME.fog.get(_vci) <= 0) continue;
        var _vr = GAME.village.peek(_vci);
        _tint[_vci] = (_vr && _vr.dead) ? [74, 74, 74]
          : ((_vr && _vr.guardAt > 0) ? [155, 227, 106] : [217, 201, 138]);
        _tk[_vci] = 'village';
      }
    }
    /* ⛔ v158.25：遗迹青珠涂色随遗迹系统退役（老板选 A）。 */
    /* v157s：占领类涂色**最后写入** —— 同一格既是营地又是我的前哨时，以"已占领"为准。 */
    var _ownN = 0;
    for (var _ok in _tintOwn) { _tint[_ok] = _tintOwn[_ok]; _tk[_ok] = _tkOwn[_ok] || 'own'; _ownN++; }
    M._tintKind = _tk;   /* v157.77：色块来源表（悬停 / 面板共用，与涂色同源） */
    M._flagOwnCount = _ownN;
    /* v156：整格涂色层放在**末尾**（上面的营地/村社/遗迹才写入 _tint） */
    M._flags = grp; scene.add(grp);
    if (M._cellTint) { scene.remove(M._cellTint); if (M._cellTint.geometry) M._cellTint.geometry.dispose(); M._cellTint = null; }
    M._cellTint = buildCellTint(_tint, 0.55, 19);
  }

  /* 名称标签（画布文字 → 贴图 → Sprite）。
     v90.57（老板）：canvas **按文字裁宽**（长名不挤）；屏幕尺寸由 `scaleLabels()` 每帧按相机距离归一
     → **不随星球缩放变大小**（恒定可读）。
     v90.58（老板）：字号**减半**、**去粗体**；`depthTest:true` 让**星球遮挡背面**的名称（背面城市不再透出来）。 */
  function nameSprite(text, color) {
    /* v90.71（老板）：名称清晰化 —— 画布**超采样 3×**（纹理分辨率 ≫ 屏幕尺寸 → 缩小后锐利）；
       字体换**清晰 CJK 字族**（雅黑/苹方/系统 UI）；仍不加粗（老板："可以不加粗看看"）。 */
    var SS = 3, fs = 15 * SS, pad = 10 * SS, h = 26 * SS;
    var FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC","Segoe UI",sans-serif';
    var c = document.createElement('canvas');
    var probe = c.getContext('2d');
    probe.font = fs + 'px ' + FONT;
    var tw = Math.max(40 * SS, Math.ceil(probe.measureText(text).width) + pad * 2);
    c.width = tw; c.height = h;
    var g = c.getContext('2d');
    g.font = fs + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 3 * SS; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(10,14,20,.92)'; g.strokeText(text, tw / 2, h / 2);
    g.fillStyle = color || '#ffffff'; g.fillText(text, tw / 2, h / 2);
    var tx = new THREE.CanvasTexture(c);
    tx.minFilter = THREE.LinearMipmapLinearFilter; tx.generateMipmaps = true;
    if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: true }));
    spr.userData = { asp: tw / h };   /* 宽高比 —— scaleLabels 按屏高定尺寸时用 */
    return spr;
  }
  /* v90.57（老板）：把名称 Sprite 的**屏幕尺寸钉死**（不随星球缩放变大小）——
     世界尺寸 ∝ 相机到标签的距离（透视下 = 恒定屏幕占比）。每帧调用。 */
  function scaleLabels() {
    if (!cam) return;
    var frac = 0.028;                                   /* 标签高 ≈ 屏幕高的 2.8%（v90.58 老板：再小一半） */
    var k = 2 * Math.tan(cam.fov * Math.PI / 360) * frac;
    [M._labels, M._hl, M._flags, M._wonderGrp ? { children: M._wonderBody ? [M._wonderBody] : [] } : null].forEach(function (grp) {
      if (!grp || !grp.children) return;
      grp.children.forEach(function (ch) {
        if (!ch.isSprite) return;
        var d = cam.position.distanceTo(ch.position);
        /* 小旗 ≈ 名称标签同高；箭头头略小（指向终点） */
        var kf = (ch.userData && ch.userData.flag) ? 1.05 : ((ch.userData && ch.userData.arrow) ? 0.9 : 1);
        var hW = k * d * kf;
        ch.scale.set(hW * ((ch.userData && ch.userData.asp) || 5.3), hW, 1);
      });
    });
  }
  /* 某层级中心的球面世界点（贴地形 + 抬升）*/
  function centerWorld(centDir, H) {
    var r = R + Math.max(0, sphElev(centDir)) * HSC + (H || 7);
    return [centDir[0] * r, centDir[1] * r, centDir[2] * r];
  }
  /* ---- 检索高亮：选定 省/市/区 → 该区地块增亮、其余地形调暗；
     并显示**下一级**内部边界 + 首府点 + 名称。---- */
  function buildHighlight() {
    if (M._hl) { scene.remove(M._hl); M._hl = null; }
    /* v90.71：地形高亮在时，星球调暗由它掌管（勿被省市区高亮复位）。 */
    if (M._globeMat && !M._terrainHl) M._globeMat.color.setHex(0xffffff);
    var S = genSettlements(); if (!S) return;
    var sel = M._region; if (!sel) return;
    if (M._globeMat && !M._terrainHl) M._globeMat.color.setHex(0x5a5a5a);       /* 其余地形调暗 */
    var T = S.table, V = M._vdirs, F = M._icoF; if (!V || !F) return;
    var grp = new THREE.Group();
    /* ① 亮层（选中区顶盖）*/
    var mem = sel.level === 'prov' ? S.provOf : sel.level === 'market' ? S.marketOf : S.districtOf;
    var tgt = sel.index;
    var pos = [], idx = [], base = 0, H = 5, cent = M._cent;
    var vor = {};
    for (var f = 0; f < F.length; f++) for (var k = 0; k < 3; k++) { var vv = F[f][k]; (vor[vv] = vor[vv] || []).push(f); }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dt(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    for (var vs in vor) {
      var vi = +vs; if (mem[vi] !== tgt) continue;
      var n = V[vi], fs = vor[vi]; if (fs.length < 3) continue;
      var up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      var tx2 = cross(up, n), tl = Math.hypot(tx2[0], tx2[1], tx2[2]) || 1; tx2 = [tx2[0] / tl, tx2[1] / tl, tx2[2] / tl];
      var ty = cross(n, tx2);
      fs.sort(function (A, B) { var cA = cent[A], cB = cent[B]; return Math.atan2(dt(cA, ty), dt(cA, tx2)) - Math.atan2(dt(cB, ty), dt(cB, tx2)); });
      var rn = R + Math.max(0, sphElev(n)) * HSC, P = [n[0] * rn, n[1] * rn, n[2] * rn];
      var mm = fs.length, start = base;
      for (var j = 0; j < mm; j++) { var p = cent[fs[j]], rr = R + Math.max(0, sphElev(p)) * HSC; pos.push(p[0] * rr, p[1] * rr, p[2] * rr); }
      for (var j2 = 0; j2 < mm; j2++) pos.push(pos[(start + j2) * 3] + n[0] * H, pos[(start + j2) * 3 + 1] + n[1] * H, pos[(start + j2) * 3 + 2] + n[2] * H);
      for (var t = 1; t < mm - 1; t++) idx.push(base + mm, base + mm + t, base + mm + t + 1);
      base += mm * 2;
    }
    if (pos.length) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
      grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe070, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })));
    }
    /* ② 下一级：边界线 + 首府点 + 名称 */
    function addChildLines(segArr, col, op) {
      if (!segArr.length) return;
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segArr, 3));
      grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false })));
    }
    function addCapitalPoint(centDir, col, sz) {
      var P = centerWorld(centDir, 5), g = new THREE.SphereGeometry(sz, 8, 8);
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(P[0], P[1], P[2]); grp.add(m);
    }
    function addText(centDir, text) {
      var P = centerWorld(centDir, 12), spr = nameSprite(text); spr.position.set(P[0], P[1], P[2]); grp.add(spr);
    }
    if (sel.level === 'prov') {
      addChildLines(regionLineSegs(S.marketOf, S.provOf, tgt), 0xff40c0, 0.9);   /* 本省内的市界 */
      var pv = T.prov[tgt];
      pv.markets.forEach(function (mi) { var m = T.market[mi]; addCapitalPoint(m.cent, 0xff40c0, 2.2); addText(m.cent, m.name); });
    } else if (sel.level === 'market') {
      addChildLines(regionLineSegs(S.districtOf, S.marketOf, tgt), 0x156a26, 0.9);   /* 本市内的区界 */
      var mk = T.market[tgt];
      mk.districts.forEach(function (di) { var dd = T.district[di]; addCapitalPoint(dd.cent, 0x156a26, 1.8); addText(dd.cent, dd.name); });
    }
    M._hl = grp; scene.add(grp);
  }
  M.setHighlight = function (sel) {                          /* sel: null 或 {level,index} */
    M._region = sel || null;
    if (sel) M.clearBeam();   /* v90.71：选省/市/区 = 其他操作 → 定位线消失 */
    buildHighlight();
    /* 相机**自动转到该区域正面**（该区中心朝向相机）*/
    if (sel) {
      var S = genSettlements(), T = S && S.table, c = null;
      if (T) c = sel.level === 'prov' ? T.prov[sel.index] && T.prov[sel.index].cent
        : sel.level === 'market' ? T.market[sel.index] && T.market[sel.index].cent
          : T.district[sel.index] && T.district[sel.index].cent;
      if (c) {
        var latA = Math.asin(Math.max(-1, Math.min(1, c[1])));
        camO.yaw = Math.atan2(c[0], c[2]);                 /* 水平角 → 首府朝向相机 */
        camO.pitch = Math.max(-1.35, Math.min(1.35, latA));/* 俯角 = 首府纬度 → 首府居中 */
        camO.dist = sel.level === 'district' ? R * 1.8 : sel.level === 'market' ? R * 2.03 : R * 2.3;
        _syncZoom();
        /* v156.47：自动转视角 = 重新对准球心，视线偏移清零 */
        camO.lookYaw = 0; camO.lookPitch = 0;
      }
    }
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  };

  /* v90.66（老板 0a）：**地形高亮**。
     v90.71（老板 6）：改为**选中地形提亮 · 其余区域整体调暗**（类似省/市/区选择效果）——
     把整颗星球材质调暗，再把该地形的地块**亮色满铺**叠上去 → 选中地形是亮块、其余沉下去。 */
  var _TERRAIN_HL_COLOR = {
    lake: 0x4aa6e0, zhaoze: 0x6f8f4a, plain: 0xd8cfa0, caoyuan: 0x9db24a,
    forest: 0x3f8a52, desert: 0xd9b45c, hill: 0x9a8f82,
  };
  function resetGlobeDim() {
    if (!M._globeMat) return;
    M._globeMat.color.setHex(M._region ? 0x5a5a5a : 0xffffff);
  }
  M.setTerrainHighlight = function (type) {                  /* type: 地形 key 或 null/'' = 清除 */
    M._terrainHl = type || null;
    if (M._terrainHl) M.clearBeam();   /* v90.71：选地形 = 其他操作 → 定位线消失 */
    if (M._thl) { scene.remove(M._thl); if (M._thl.geometry) M._thl.geometry.dispose(); M._thl = null; }
    if (!M._terrainHl || !_tileCells || !_tileCells.length) {
      resetGlobeDim();                  /* 清除：星球恢复原亮度（省市区高亮若在则保留其调暗）*/
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      return;
    }
    if (M._globeMat) M._globeMat.color.setHex(0x454545);   /* 其余区域整体调暗 */
    var col = _TERRAIN_HL_COLOR[M._terrainHl] || 0xffffff;
    var pos = [], idx = [], base = 0;
    for (var i = 0; i < _tileCells.length; i++) {
      var c = _tileCells[i];
      if (!c || c.type !== M._terrainHl || !c.rim) continue;
      var rim = c.rim, mm = rim.length, P = c.pos, L = Math.hypot(P[0], P[1], P[2]) || 1;
      var lift = 0.9;                                        /* 微抬，浮在底面之上不 z-fight */
      pos.push(P[0] + P[0] / L * lift, P[1] + P[1] / L * lift, P[2] + P[2] / L * lift);
      var apex = base;
      for (var j = 0; j < mm; j++) { var p = rim[j], l2 = Math.hypot(p[0], p[1], p[2]) || 1; pos.push(p[0] + p[0] / l2 * lift, p[1] + p[1] / l2 * lift, p[2] + p[2] / l2 * lift); }
      for (var t = 0; t < mm; t++) idx.push(apex, apex + 1 + t, apex + 1 + (t + 1) % mm);
      base = apex + 1 + mm;
    }
    if (pos.length) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      /* 选中地形满铺亮块（0.92 不透）+ 细描边 → 「亮块 vs 暗底」对比强烈。 */
      M._thl = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false }));
      scene.add(M._thl);
    }
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  };

  /* ============================================================
   * v92.242（老板）：**无支点的自由空间相机**
   * ------------------------------------------------------------
   * 相机永远绕**星球中心**，不再有任何"贴地焦点"当支点 ——
   * 旧版的 focus 支点会黏在前传人物那一格上（前传结束后也不撒手），
   * 而且 dist 的基准在两种模式下不一致（总览从球心算、贴地从格子算）。
   *
   * 现在只有两条约束，正好是老板说的"仅规定一个最大空间"：
   *   · 位置落在半径 1.02R ~ 50R 的球壳里（内界防止钻进星球）；
   *   · 朝向自由：yaw 任意，pitch 可到 ±88°（能绕到极点俯看）。
   * 看向球心 —— 所以"贴地看某一格"= 把 yaw/pitch 指向那一格 + 距离收到 R+1.5×HSC。
   * ============================================================ */
  /* ============================================================
   * v157b：**周边地形的平均高度**（不是脚下那格）
   * ------------------------------------------------------------
   * 老板：「相机高度尽量维持不动，跟随地形的话视觉很晃」。
   * 取 2 环（19 格）的 e 平均 —— 单格起伏被摊平，地势走向保留。
   * 带两层缓存：
   *   ① 按 ci 缓存（跨格才重算，19 次查表 ≈ 0）；
   *   ② 指数平滑（跨格那一下也不硬跳）。
   * ⚠️ 平滑状态必须跟着 seed 走：换星球后地势完全不同，
   *   沿用旧值会让相机从上一颗星球的高度慢慢飘过来（同 _rimHMap 那类缓存陷阱）。
   * ============================================================ */
  var _elevAvgCi = -1, _elevAvgVal = 0, _elevSm = null, _elevSmSeed = null;
  /* v157.17：防穿模硬下限的**限速跟随值**（见 placeCamera）。
     直接用 `_elevHere + 0.4` 覆盖基线，跨过山脊时一帧抬二三十米 —— 那就是
     老板说的"高度突变"。改成逐帧追赶：抬得快（6 米/帧 ≈ 360 米/秒，够防穿模），
     落得慢（跟随平滑基线），画面就不会"弹"一下。 */
  /* ⛔ v157.31：`_elevGuard` 随"地形不参与半径"一并退役（老板：窗口不动）。 */
  function elevAvgAt(dir) {
    var sd = (SP && SP.seed3) ? SP.seed3() : 0;
    if (_elevSmSeed !== sd) { _elevSm = null; _elevSmSeed = sd; _elevAvgCi = -1; }
    var ci = (SP && SP.nearestCell) ? SP.nearestCell(dir) : -1;
    if (ci !== _elevAvgCi) {
      var v = 0;
      if (ci >= 0 && SP.hopsWithin) {
        /* 4 环 = 61 格 ≈ 半径 15 米：单格和"两三格的小土包"都被摊平，
           只剩整片地势的走向。2 环时实测仍会随缓坡上下 20 米。 */
        var list = SP.hopsWithin(ci, 4), s = 0, n = 0;
        for (var i = 0; i < list.length; i++) {
          var c = SP.cells && SP.cells[list[i]];
          if (c) { s += Math.max(0, c.e || 0); n++; }
        }
        v = n ? (s / n) * HSC : Math.max(0, sphElev(dir)) * HSC;
      } else {
        v = Math.max(0, sphElev(dir)) * HSC;
      }
      _elevAvgVal = v;
      _elevAvgCi = ci;
    }
    /* 时间常数约 25 帧：跨越明显地形差时相机会慢慢"漂"过去，不是硬跳。
       ⚠️ 别调到 0.02 以下 —— 那样快速拖动时相机会明显滞后于视角。 */
    if (_elevSm == null) _elevSm = _elevAvgVal;
    else _elevSm = _elevSm * 0.92 + _elevAvgVal * 0.08;
    return _elevSm;
  }

  /* ============================================================
   * v157b：**注视距离** —— 俯角的唯一来源（纯函数）
   * ------------------------------------------------------------
   * 老板要的两条，都归结到这一个函数：
   *   ·「最近地面时转为平行于地平面」→ agl=眼高时注视距离最大（40 米）→ 俯角 ≈0；
   *   ·「高度变化时自动进入轨道/地面」→ agl→AGL_SURF 时注视距离→0 → 俯角 90°，
   *     正好和轨道视角（看球心、垂直向下）接上，过阈值不跳。
   *
   * 抽成纯函数的理由：俯角公式若散在 placeCamera 和自检两处，
   * 改一处漂一处，断言就形同虚设。现在两边吃同一个式子。
   * 用 (1−t²) 而不是 (1−t)：低空段变化更缓，平视区间更长。
   * ============================================================ */
  function lookDistAt(agl) {
    var t = Math.max(0, Math.min(1, (agl || 0) / (M.AGL_SURF || 55)));
    return (M.SURF_LOOK0 || 40) * (1 - t * t);
  }
  M.lookDistAt = lookDistAt;
  /* 给定离地高度的视线俯角（度，0 = 平行于地平面） */
  M.pitchAt = function (agl) {
    var ld = lookDistAt(agl);
    var dh = (agl || 0) - (M.SURF_LOOK_H || 1.5);
    return Math.atan2(Math.abs(dh), Math.max(1e-6, ld)) * 180 / Math.PI;
  };

  /* ============================================================
   * 视线 d + 站立者向上 radial → 屏幕"右"向量。
   * ------------------------------------------------------------
   * 这是**地平线永远水平**的唯一来源：up = right × d 恒垂直于视线，
   * 所以画面绕视线不会翻滚，也就不会出现"过天顶就翻过来"。
   * d 与 radial 平行（正看脚下 / 正看头顶）时叉乘退化 → 沿用上一帧 right
   * 并投影掉视线分量，因此正对天顶也不跳。
   * ⚠️ 别在别处另算一遍 right，两套算法迟早打架。
   * ============================================================ */
  function _surfRightOf(d, radial) {
    /* ============================================================
     * v157.25（实测教训）：**不能每帧用 cross(d, radial) 现算 right**。
     * ------------------------------------------------------------
     * 视线接近天顶/脚底时 |cross| → 0，方向完全由浮点噪声决定 ——
     * 上一帧 right 指东、下一帧指西，绕它转的垂直旋转就自己抵消自己。
     * 实测：右键往上拖 8 轮，俯仰卡在 **−86.9°** 不动（每轮还回退 0.5°），
     * 这正是老板说的"到天顶就转不过去"。
     *
     * 正解：right 是**契约向量**（存在 M._surfRight 里），只做"投影回 ⟂ d"这一步。
     * 它与 d 的夹角理论恒为 90°，所以投影几乎不改动 → 天顶附近也稳。
     * 水平旋转时 d 和 right 一起绕径向转；垂直旋转只转 d（绕 right）——
     * 于是 d 能连续越过天顶绕完整圈，right 永远不失向。
     * ============================================================ */
    var r = M._surfRight ? M._surfRight.clone() : null;
    if (r) {
      /* ⛔ v157.34：**别每帧都投影+归一化** —— 那是浮点噪声的累积器。
         实测：贴地静止 3 秒，相机朝向自己慢慢转了 0.0686°（老板会说"画面在飘"）。
         已经是 ⟂ 的（|dot| < 1e-4）就原样返回：不做任何数值操作，累积不成立。 */
      if (Math.abs(r.dot(d)) < 1e-4) return r.normalize();
      r.addScaledVector(d, -r.dot(d));          /* 只有明显不垂时才校正一次 */
      if (r.lengthSq() > 1e-6) return r.normalize();
    }
    /* 没有契约向量（首次进入）：用叉乘兜底，退化时随便挑一个正交方向 */
    r = new THREE.Vector3().crossVectors(d, radial);
    if (r.lengthSq() < 1e-6) {
      r = (Math.abs(d.y) < 0.9) ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      r.addScaledVector(d, -r.dot(d));
    }
    if (r.lengthSq() < 1e-9) r.set(1, 0, 0);
    return r.normalize();
  }
  M.surfRightOf = _surfRightOf;
  /* 探针出口（只读）：场景与当前 fade —— 诊断"抬头一片黑"到底是谁的颜色 */
  M._bgOf = function () {
    try {
      return { bg: scene.background && scene.background.getHex ? scene.background.getHex() : null,
               fade: +_surfFade.toFixed(3), skyKeep: M._skyKeep };
    } catch (e) { return null; }
  };

  /* 探针/自检出口：相机光轴（世界系单位向量）。
     用来量"相邻两帧视角跳了多少度"——这是"过渡平滑"唯一可量化的口径。 */
  M._camQ = function () {
    try {
      var v = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      return [+v.x.toFixed(6), +v.y.toFixed(6), +v.z.toFixed(6)];
    } catch (e) { return null; }
  };
  /* 探针出口：相机"画面上"方向 + 位置。roll（画面横滚）必须同时看 up 才量得出来 ——
     只看光轴的话，画面绕光轴翻 180° 时光轴一点没变（这就是这次的 bug 类型）。 */
  /* 探针出口：相机对象本身（探针要自己发射线时用，正式逻辑不碰） */
  M._camObj = function () { return cam; };
  M._camU = function () {
    M._dbgWant = true;                 /* 探针打开后才记基向量，正式运行零开销 */
    try {
      var u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      var q = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      return {
        up: [+u.x.toFixed(6), +u.y.toFixed(6), +u.z.toFixed(6)],
        fwd: [+q.x.toFixed(6), +q.y.toFixed(6), +q.z.toFixed(6)],
        pos: [+cam.position.x.toFixed(3), +cam.position.y.toFixed(3), +cam.position.z.toFixed(3)],
        posR: +cam.position.length().toFixed(3)
      };
    } catch (e) { return null; }
  };

  /* ============================================================
   * v157.50（老板「鼠标滚轮滚动不能有距离跳变，识别到滚动应根据高度
   *          采取平滑曲线速度下降，而不是根据滚轮位移下降」）
   * ------------------------------------------------------------
   * 实测（tools/_cam-wheel-probe.js）旧实现的两种跳：
   *   ① 贴地第一格 rAlt 1.7 → 20.4（**×12**，+18.7 米）—— 因为 v157.31 把
   *      缩放量乘在**球心距离**上（302×1.06 看着只多 6%，落到 agl 上是 12 倍）；
   *   ② 120 米处灵敏度**硬切**（_K 0.0006 → 0.0012）—— 同一格从 +25 米变 +55 米。
   *
   * 现在的口径（三条，缺一不可）：
   *   · 缩放量乘在**离地高度 agl** 上（不是球心距离）→ 比例处处一致；
   *   · 灵敏度 `k(agl)` 是一条**连续曲线**（1/(1+agl/6.5) 衰减），没有分段阈值；
   *   · 滚轮只写**目标高度**，相机每帧朝目标阻尼逼近（τ≈70ms）→ 再快的手指
   *     也不会让画面瞬移，先滑过去。
   * 于是"一格"的绝对位移随高度自然增大（近处一两米、远处几百米），而**相对**
   * 速度随高度平滑下降 —— 这正是老板要的"按高度、不是按滚轮位移"。
   * ============================================================ */
  var _zoomTarget = null;        /* 目标海拔（agl，米）；null = 未初始化 */
  var _zoomLastT = 0;            /* 上一帧时间戳（ms），用来算阻尼系数 */
  /* 灵敏度曲线：返回"一格（deltaY=100）对应的比例"。连续、单调、无分段。 */
  function _zoomK(agl) {
    /* v158.48（老板「滚轮每格的精度……到近地面 50、40 的时候每格只降 1~2m，
       不然就有高度跳变」）：分段曲线 ——
       · agl ≥ 60：旧曲线（高空每格大值，60 处 ≈18%/格 ≈10.7m）；
       · 52~60：线性过渡急剧收窄；
       · agl < 52：近地曲线（50 处 4%/格≈2m、40 处 4.4%≈1.8m、20 处 6.7%≈1.3m、
         2 处 27%≈0.55m、0.6 处 41%≈0.25m —— 贴地越滚越细，无高度跳变）。 */
    if (agl >= 60) return 0.045 + 1.05 / (1 + Math.max(0, agl) / 6.5);
    if (agl >= 52) {
      var _k60 = 0.045 + 1.05 / (1 + agl / 6.5);
      var _w52 = (agl - 52) / 8;
      return _k60 * _w52 + 0.042 * (1 - _w52);
    }
    return 0.02 + 0.4 / (1 + Math.max(0, agl) / 2.5);
  }
  /* 把滚轮事件换算成目标 agl（唯一入口：wheel / setZoom / surfaceMode 都走它） */
  function _zoomStepTo(target, deltaY) {
    var k = _zoomK(target) * ((deltaY || 0) / 100);
    var step = Math.exp(k);
    /* 单次事件封顶：防"甩一下滚轮"横跨整个量程（与旧实现同值，手感保留） */
    if (step > 1.9) step = 1.9;
    if (step < 0.53) step = 0.53;
    return target * step;
  }
  /* 「瞬移类」入口（跳城 / 正位 / 读档 / 探针 / 滑块）改完 camO.dist 必须调它：
     否则下一帧阻尼会把人拽回旧目标 —— 这是这类动画最常见的坑。 */
  function _syncZoom() { _zoomTarget = camO.dist - R; }
  M._syncZoom = _syncZoom;
  /* ============================================================
   * v158.42（老板「绝不允许高度跳变」）：**平滑跳转唯一出口**。
   * ------------------------------------------------------------
   * 病根：focusOnCell / centerOn / setZoom(滑块) / clearFocus / 进出地表
   *   这些「瞬移类」入口都直接写 `camO.dist` 再 `_syncZoom()` —— 前者瞬间改高度、
   *   后者把阻尼目标也瞬间设成新值，于是 placeCamera 的 _zoomDamp 下一帧直接吸附，
   *   **高度零过渡硬跳**（从 R*2.9 的战略视野啪一下贴到 R+HSC*1.5，或反过来）。
   *   滚轮不跳，是因为它只写 `_zoomTarget`，把「到达」交给每帧的阻尼去逼近。
   *
   * 修法：给这些入口同一个 `_zoomTo` —— 只写目标（`_zoomTarget = 目标海拔`），
   *   不碰 `camO.dist`，让 _zoomDamp 用同一套 70ms 时间常数平滑过渡。
   *   `snap=true` = 立即到位（探针 / 自动化 / 自检要拍「最终态」截图，
   *   不能拍到半透明中间态；这些不是玩家体验，保留瞬间落位）。
   * ============================================================ */
  function _zoomTo(targetDist, snap) {
    if (snap) { camO.dist = targetDist; _syncZoom(); }
    else { _zoomTarget = targetDist - R; }   /* 阻尼每帧逼近，高度连续 */
  }
  M._zoomTo = _zoomTo;
  /* ============================================================
   * v158.28（老板「左键只选择地图元素，不转动相机。地图位置的变动，
   *          通过鼠标在地图四周……画面持续向右移动，显示右方地图」）
   * ------------------------------------------------------------
   * ① **边缘推镜**（edge pan）：指针停在画面边缘带内 → 画面持续往那一侧走。
   *    高空：观察点沿切平面滑动（半径不变、滚轮阻尼不受影响）。
   *    地表：镜头绕角色转（相机锁着人，只能绕，不能平移）。
   * ② **左键拖拽不再改相机**（见 mousemove：地表分支整段停用、轨道拖拽直接 return），
   *    左键只剩"点选地块 / 点按钮"。
   *
   * ⚠️ 守老板定过的边界（v157.34「停手画面自己动」被否过）：
   *    **指针不在边缘带里就一动不动**，这是有输入位置依据的移动，不是自动漂移。
   * ============================================================ */
  /* ============================================================
   * v158.34（老板「画面太卡」）：**自测开关** —— F2 打开左上角一行
   * `fps · 帧时间 p95 · 上次地表重建耗时`。卡的时候一眼看出卡在哪：
   *   fps 低 + 重建耗时不涨  → 是渲染/填充率
   *   fps 平时高、偶发掉到个位 → 是整层重建
   * 只统计，不改任何行为。
   * ============================================================ */
  M.PERF = 0;
  M._perf = { fps: 0, ms: 0, p95: 0, rebuildMs: 0, at: 0, frames: 0, acc: 0, ring: [] };
  function _perfTick(dt) {
    if (!M.PERF) return;
    var st = M._perf;
    var ms = Math.max(0.1, (dt || 0.016) * 1000);
    st.frames++; st.acc += ms;
    st.ring.push(ms);
    if (st.ring.length > 120) st.ring.shift();
    var now = Date.now();
    if (now - st.at < 500) return;
    st.at = now;
    var sorted = st.ring.slice().sort(function (a, b) { return a - b; });
    st.ms = +(st.acc / Math.max(1, st.frames)).toFixed(1);
    st.p95 = +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].toFixed(1);
    st.fps = +(1000 / Math.max(0.1, st.ms)).toFixed(0);
    st.frames = 0; st.acc = 0;
    try {
      if (GAME.ui && GAME.ui.perfHud) GAME.ui.perfHud(st);
    } catch (ePH) { }
  }
  M._perfTick = _perfTick;          /* 渲染循环每帧调；只读 + 偶发写 DOM */

  M.LEFT_DRAG_CAM = false;     /* 左键拖拽能不能动相机（老板口径：不能） */
  /* v158.43（老板「去掉鼠标接近屏幕边界时相机转动的设定」）：边缘推镜整段关停。
     相机仅由默认视角 + 鼠标（左键轨道 / 右键转向）+ 飞行物 WASD 操控，
     指针停在画面边缘不再转动相机。保留开关以便飞行系统落地后统一收口。 */
  M.EDGE_PAN = 0;              /* 边缘推镜总闸（0=关停） */
  M.EDGE_PAN_BAND = 0.055;     /* 边缘带：取短边的 5.5%（最小 10px） */
  M.EDGE_PAN_SPEED = 1.0;      /* 倍率（1 ≈ 水平 0.9 rad/s · 垂直 0.55 rad/s） */
  M._ptr = null;               /* 指针位置（相对画布，拖动时也更新） */
  function _tickEdgePan(dt) {
    if (!M.EDGE_PAN) return false;
    var pt = M._ptr;
    if (!pt || pt.out) return false;
    var w = pt.w, h = pt.h;
    if (!(w > 8) || !(h > 8)) return false;
    var band = Math.max(10, Math.round(Math.min(w, h) * M.EDGE_PAN_BAND));
    var dx = (pt.x > w - band) ? 1 : ((pt.x < band) ? -1 : 0);
    var dy = (pt.y > h - band) ? 1 : ((pt.y < band) ? -1 : 0);
    if (!dx && !dy) return false;
    /* ⚠️ 上限放到 0.12 秒：headless 的 rAF 会节流到 1~2fps，卡 0.05 会让推镜慢 20 倍
       （探针实测 0.6 秒只转 2.35°，真机是 31°）。真机掉帧时也靠这个上限防跳。 */
    dt = Math.max(0.001, Math.min(0.12, dt || 0.016));
    var k = M.EDGE_PAN_SPEED * dt;
    if (M._surf) {
      /* v158.39（老板「取消边缘转换角度」）：v158.28 曾把地表边缘推镜实现成
         「绕角色改 orbitYaw / SURF_CAM_EL」，那不是移动地图，是偷偷转镜头。
         新口径：地表边缘带只负责提示"指针在边缘"，**不再改任何相机角度**；
         地表看哪由右键/中键明确控制。高空仍保留原边缘推镜。 */
      return false;
    } else {
      /* ⚠️ 这里**必须写 yaw/pitch**、不能只写 `camO.dir`：
         `placeCamera` 的 `_dirty` 判据是 `M.CAM_TRACKBALL ? !camO.quat : …`，
         清掉 quat 之后它会**按 yaw/pitch 重建** —— 只改 dir 的话姿态回退成旧值，
         实测球心 NDC 0 → 0（画面一动不动，只是数据变了）。
         同时**不许用 asin 反算 pitch**（§586r 把全文件 asin 写点钉死在 4 处），
         所以水平只动 yaw（经度）、垂直用增量 —— 两者都不需要反算。 */
      if (dx) camO.yaw += dx * 0.9 * k;
      if (dy) camO.pitch = Math.max(-1.55, Math.min(1.55, camO.pitch + dy * 0.55 * k));
      camO.quat = null; camO._euler = null;
    }
    /* ⚠️ 两条都不能要：
       ① touch / redraw 是 canvas 事件闭包里的局部函数（7505），本函数在模块作用域
          —— 调了直接 `touch is not defined`（探针实测 FATAL）。
       ② `renderMapCanvas()` 会**同步重建界面**，其中又会走到渲染循环 → 再进本函数，
          形成递归：探针 42 次调用累积出 Δyaw 651 rad（实测）。
       本函数只改相机状态；绘制由渲染循环本来那一帧负责，不需要在这里催。 */
    try { M._lastAct = Date.now(); } catch (eT) { }
    return true;
  }
  M.edgePanTick = _tickEdgePan;
  M.edgePanProbe = function () {
    var pt = M._ptr;
    if (!pt) return { on: !!M.EDGE_PAN, ptr: null };
    var band = Math.max(10, Math.round(Math.min(pt.w, pt.h) * M.EDGE_PAN_BAND));
    return { on: !!M.EDGE_PAN, w: pt.w, h: pt.h, x: pt.x, y: pt.y, band: band, out: !!pt.out,
      dx: (pt.x > pt.w - band) ? 1 : ((pt.x < band) ? -1 : 0),
      dy: (pt.y > pt.h - band) ? 1 : ((pt.y < band) ? -1 : 0) };
  };
  /* ============================================================
   * v158.43（老板诉求1·高空「左键移动相机本体，模拟飞船加速过程」→
   *        AskUserQuestion 拍板：「设置一个飞行物（代表相机），比如空天飞机，
   *        然后通过 WASD 操纵，飞行速度曲线和轨迹参考太空飞行及其他飞行
   *        题材游戏设定」+「带惯性加减速」+「无实体模型·纯相机飞行」）
   * ------------------------------------------------------------
   * **飞行系统 = 高空 WASD 驱动的纯相机惯性飞行**
   *   触发面：轨道态（!M._surf）+ 地图页，WASD 写 GAME._flyKeys（main.js）。
   *   语义：W 加速 / S 减速（可倒飞）/ A 左转 / D 右转（转机头 = 转 yaw）；
   *        松键惯性衰减；左键按下即停止惯性（诉求 1 原文「直至左键操作」）。
   *   轨迹：位置沿「机头方向（当前视线在切平面的投影）」推进 —— 看哪飞哪；
   *        转向写 camO.yaw（A/D），画面跟着转 = 机头转向。
   *   速度曲线：加速度恒定（FLY_ACCEL）爬到上限，松键按 FLY_DECAY 指数滑行
   *        （太空游戏手感）；倒飞上限 = 0.6×前飞上限。
   * ⚠️ 推进后 pitch 必须反算（asin）—— 这是 §586r 4 处合法写点之外的
   *    **第 5 处**（v158.43 规则变更：飞行位置显式设置需要它，smoke §586r
   *    断言按新口径重写）。不写 pitch 的话 placeCamera 按旧 yaw/pitch 重建，
   *    位置推进会白干。
   * ⚠️ 只写状态、不 touch/redraw：本函数与 _tickEdgePan 同处模块作用域，
   *    touch 是事件闭包局部函数；绘制由渲染循环当帧负责。
   * ============================================================ */
  /* ============================================================
   * v158.52（老板五条：①高度固定不合理 ②QE→←→加减速、↑↓改海拔
   *   ③前进不是前进 ④转向无速度轨迹、像在转星球 ⑤三角锥战舰形体）
   * ------------------------------------------------------------
   * **飞行 = 太空中的惯性战舰**（不再是"绕球滚动的相机"）：
   *   · 位置 `fly.pos` 是自由 3D 点（不再锁 camO.dist 球面），沿**速度矢量**
   *     `fly.vel` 推进；v158.52 机头由 W/S 俯仰、A/D 转向操纵；
   *   · 速度标量 `fly.v` 在无外力时**恒定**（牛顿第一定律）——只有 ←→（加减速）
   *     或左键（刹车）才改它；松键不再指数衰减；
   *   · v158.52 转向时机头先转、速度以有限角率追随（FLY_VEL_TURN）；
   *   · ↑↓ 直接改球心距离（海拔），松手保持当前高度；
   *   · 第三人称机位 + 三角锥战舰 mesh + 尾迹线，让运动看得见。
   *   ⚠️ v158.53 整条重做（老板「可操纵性差、上不是上、下不是下、
   *     完全没有坐标原点、玩家不知道自己在哪里」）：鼠标即机头（看哪飞哪）、
   *     vel 瞬时对齐 head（有限追随的 20.8° 侧滑整条退役）、W/S 改推进刹车、
   *     A/D 改横滚 + 协调转弯 + banking、HUD 常驻「星球方位指示」。
   *     上面 VEL_TURN/PITCH 只作演进溯源，墓碑见常量区，不得复活。
   * camO.dir/dist/yaw/pitch 仍是 placeCamera 与地表交班的唯一位置来源，
   * 每帧由 fly.pos 反算写回（这是与既有相机状态机的唯一接口）。
   * ============================================================ */
  M.FLY_MAX = 120;         /* 前飞上限（m/s） */
  M.FLY_BACK_MAX = 72;     /* 倒飞上限 = 0.6×FLY_MAX */
  M.FLY_ACCEL = 48;        /* 加速度（m/s²）：约 2.5 秒到顶 */
  M.FLY_TURN = 1.1;        /* 机头转向率（rad/s） */
  /* v158.53（老板「角度转向始终有硬伤、可操纵性差、上不上上、下不是下、
        完全不知道自己在哪里、不能按意愿想去哪就去」）—— 按无人深空范式重做：
        鼠标即机头（看哪飞哪）；速度**瞬时**对齐机头（旧版有限追随产生 20.8°
        侧滑=推舵还在往原方向飘，探针实测）；A/D 改为横滚带 banking；
        W/S 推进刹车。旧 FLY_VEL_TURN/FLY_PITCH 退役（墓碑见下）。 */
  M.FLY_LOOK_K = 0.0042;   /* 右键拖动 → 机头转角（rad/px）：拖 250px ≈ 60° */
  M.FLY_ROLL = 1.7;        /* A/D 横滚角率（rad/s） */
  /* ============================================================
   * v158.58（老板：「AD 不再改变相机朝向，而是改变飞行器方向」）
   * ------------------------------------------------------------
   * 旧版 A/D 是"横滚 + 一点点协调转弯"（FLY_BANK_TURN 0.75 rad/s ≈43°/s），
   * 方向变化又慢又不直观；而相机朝向是从飞行器位置反算的，一转向画面立刻
   * 跟着转，玩家看到的是"世界在转"，不是"飞行器在转"。
   * 现在三件事分开：
   *   · A/D = **改变飞行器方向**（绕当地天顶偏航，FLY_YAW_RATE ≈86°/s），
   *     同时做视觉横滚（左转左倾），但方向与姿态分别记录；
   *   · **相机尾向滞后跟随**（FLY_CAM_TURN 2.2 rad/s < 偏航率）——
   *     A/D 急转时相机跟得慢，飞行器先偏出去，转向才"看得见"；
   *   · 相机朝向仍由「相机→飞行器」方向闭式反解（screenY=0.66 不变）。
   * ⛔ FLY_BANK_TURN 退役：它的"横滚顺便带一点转向"语义已被 FLY_YAW_RATE
   *    完整取代，留着只会让人以为转向还有个隐藏比例。
   * ============================================================ */
  M.FLY_YAW_RATE = 1.5;    /* A/D 偏航角速度（rad/s ≈86°/s）：转 90° 约 1 秒 */
  /* ⚠️ 必须是**一阶跟随（时间常数）**而不是限速：限速只要快过偏航率就永远
     追得上，测不出滞后（首轮 FLY_CAM_TURN=2.2 rad/s 实测残差 0.0°）。
     4.0/s ≈ 时间常数 0.25s：急转时稳态落后 ≈ 偏航率/4.0 ≈ 21°（看得见），
     松手 1.5s（6 个时间常数）后收敛到 0.3% 以内。 */
  M.FLY_CAM_TURN = 4.0;    /* 相机尾向跟随速率（1/s） */
  /* ⛔ v158.53 退役：FLY_VEL_TURN（速度有限追随 → 20.8° 侧滑）、
     FLY_PITCH（W/S 俯仰 → 改为推进）。去向：速度瞬时对齐见 _tickFlight ④；
     俯仰改由鼠标完成（FLY_LOOK_K）。
     ⛔ v158.56 退役：FLY_CLIMB（↑↓ 改海拔 = 电梯）。老板「Ws和上下为加减速」
        —— ↑↓ 与 W/S 同义进速度通道，海拔只由飞行方向决定；高空滚轮也不再
        调高度。去向：_tickFlight ① 速度通道 / wheel 飞行态直接 return。 */

  /* ============================================================
   * v158.56（老板：「在高空，不再由滚轮调整高度，飞行器和相机分离。
   *   相机总是在飞行器的尾端或者人物的背部。飞行器应该在屏幕的下 2/5
   *   我要在正中间。鼠标指示飞行的方向。Ws 和上下为加减速。
   *   设置飞行器的起飞降落程序」）
   * ------------------------------------------------------------
   * ① 滚轮在飞行态**整条禁用**（高度不再有第二个入口）；
   * ② **机位与机体姿态解耦**：位置永远吊在尾端（-head），姿态 up 以星球
   *    径向为骨、机体 up 只掺一点 —— 于是滚转在画面里看得见，画面不跟着翻；
   * ③ 战舰精确落在屏幕纵向 FLY_SCREEN_Y（下方 2/5）、水平正中：位置固定后
   *    用「视线绕 right 轴抬 θ」闭式反解，θ = atan(ny·tan(fov/2))，
   *    θ 的正负由 cross(Δ,up)=right 的右手定则确定，不靠试参；
   * ④ 鼠标**绝对指示**航向：鼠标偏离屏幕中心的方向 → 目标方向 aim（相对
   *    当前机体基算一次并锁定）。机头限速朝 aim 转，到位即停；鼠标回中
   *    （死区 FLY_AIM_DEAD）则保持当前航向 —— 这就是「看哪飞哪」且不打转；
   * ⑤ W/S/↑/↓/←/→ 全是速度（±FLY_ACCEL），A/D 只剩横滚；
   * ⑥ 起飞/降落是**分阶段程序**（phase: takeoff/landing），期间接管位姿，
   *    不被玩家输入打断，结束回 cruise / 交回地表层。
   * ============================================================ */
  M.FLY_AIM_MAX = 1.15;    /* 鼠标到屏幕边缘 → 航向最大偏转（rad ≈ 66°） */
  M.FLY_AIM_PITCH = 0.85;  /* 鼠标上下到边缘 → 最大俯仰（rad ≈ 49°） */
  M.FLY_AIM_DEAD = 0.10;   /* 回中死区（屏幕半宽比例）：回中=保持航向不转 */
  M.FLY_AIM_RATE = 1.7;    /* 机头朝指示方向的最大角速度（rad/s） */
  M.FLY_SCREEN_Y = 0.66;   /* 战舰在屏幕纵向位置：下方 2/5 区域、水平正中 */
  /* v158.52 实机截图取证：初版 BACK18/UP6/LOOK42 + 大锥(2.4,8) 占屏约 1/4、
     挡住大半视野（v15852-A/B 截图）；缩机 + 拉远后形体仍清晰、占屏约 1/12。 */
  M.FLY_CAM_BACK = 26;     /* 机位沿机头反向吊在尾端（m） */
  M.FLY_CAM_UP = 6;        /* 机位抬离机体的高度（m，沿相机 up） */
  M.FLY_CAM_MIX = 0.3;     /* 相机 up 里掺多少机体 up：有姿态感又不翻画面 */
  M.FLY_CAM_LOOK = 1200;   /* 视线远点（只定朝向，不参与机位） */
  M.FLY_TAKEOFF_T = 2.4;   /* 起飞程序时长（s） */
  M.FLY_LAND_T = 2.6;      /* 降落程序时长（s） */
  M.FLY_TAKEOFF_V = 62;    /* 起飞结束时的速度（m/s，约半巡航） */
  /* ⛔ v158.57 退役：FLY_TRAIL_MAX（尾迹采样点数）。尾迹线整条删除 ——
     相机永远吊机尾时它必然投影成一根竖针（v15856-D / v15857-A / v15857-B
     三次实机图），缩点数不解决问题。去向见 M._fly 上方墓碑。 */
  /* ============================================================
   * v158.57（老板：「高空飞行在不改变海拔时，不应该相对固定高度吗？
   *   然后由于引力逐步下降。设计着陆程序」）
   * ------------------------------------------------------------
   * 诊断（`.workbuddy/tmp/diag_v15857_alt.js`）量出两件事：
   *   · 水平切向 v=80 飞 6 秒，高度自己涨 **+124.6m** —— 旧版沿切线走直线，
   *     等于一点点飞出星球，根本没有"高度"概念；
   *   · 鼠标只在水平方向右移 4 秒，机头却抬头 **37.7°** —— 绕机体 up 转 yaw
   *     会带出径向分量，于是"左右看"变成"往上爬"。
   * 修法把机头拆成两件事，各自管：
   *   · **水平切向**（转向）→ 只决定往哪飞，恒留在切平面内；
   *   · **俯仰角 fly.pitch**（相对当地水平面）→ 单独配平，松手回 FLY_TRIM；
   *   · 位置每帧按 `holdR` **贴回球面**，holdR 由引力下沉率推进 ——
   *     于是"平飞不掉高、引力慢慢沉、抬头才爬升"三件事同时成立。
   * ============================================================ */
  M.FLY_GRAV_SINK = 1.0;   /* 引力稳态下沉率（m/s）：平飞时的高度自然衰减 */
  M.FLY_PITCH_RATE = 0.9;  /* 俯仰配平角速度（rad/s）：抬头/低头都不突变 */
  M.FLY_TRIM = 0;          /* 松手配平迎角（rad）：0 = 平飞不补偿，交给引力慢慢沉 */
  M.FLY_LAND_AUTO_ALT = 26;/* 低于该离地高度且在下沉 → 自动进入着陆程序 */
  M.FLY_LAND_SINK = 26;    /* 着陆程序的下降速率（m/s）—— 决定程序时长 */
  M.FLY_LAND_T_MAX = 7;    /* 着陆程序时长上限（s），高空落下来也不会太久 */
  M.FLY_LEVEL_AFTER = 2.5; /* 无方向输入 N 秒后视角偏移缓慢回 0 */
  M.FLY_LEVEL_RATE = 0.5;
  /* ⛔ v158.57 退役：尾迹线（fly.trail / _shipTrail）。实机图 v15857-A/B 与
     v15856-D 三次拍到同一缺陷：相机永远吊在机尾、尾迹沿 -head 指向相机，
     投影就是一条贯穿半屏的竖针（缩到 18 点仍到底）。老板从未要求尾迹，
     运动感由战舰姿态 + 引擎光点承担。去向：_ensureShip/_paintShip 已整条删除，
     §623④ 改为反向断言禁止复活。 */
  M._fly = { v: 0, pos: null, head: null, vel: null, up: null, active: false,
             climb: 0,
             aim: null, aimPitch: null, phase: 'cruise', phaseT: 0,
             launchHead: null, landR0: null, landHead: null,
             pitch: 0, sink: 0, holdR: null, autoLand: 0, camTail: null };
  function _flyVec(a) { return new THREE.Vector3(a[0], a[1], a[2]); }

  /* ============================================================
   * v158.53（老板点名「星球方位指示」）—— 飞行导航的**唯一只读数据源**。
   * ------------------------------------------------------------
   * 老板反馈「完全没有一个坐标原点、没有一个可参考性……玩家完全不知道
   * 自己在哪里」。根因不是参数，是缺参照：HUD 只有速度，星球在机头前方
   * 还是背后、机体是正飞还是倒扣，屏幕上一概看不出来。这里把
   * 「战机 → 球心」矢量投影到机体正交基（head / right / up），给出：
   *   bearing  星球相对机头的方位角：0=正前，正=右，负=左（-180..180）
   *   elev     星球在机体 up 方向的仰角：正=星球在机体上方
   *   dir8     八方位中文（前/右前/右/右后/后/左后/左/左前）
   *   vertical 上方/平齐/下方
   *   alt      离地海拔（球心距 − R），range 球心距
   *   toward   机头与「指向球心」的夹角（0=直冲星球，180=背向星球）
   *   bank     机体横滚角（_bankAngle 快照）
   * 只算不改状态；HUD 与探针共用同一出口，避免"显示的和测的不是一回事"。
   * ============================================================ */
  M._flyNavState = function () {
    var f = M._fly;
    if (!f || !f.active || !f.pos || !f.head) return null;
    var p = _flyVec(f.pos), r = p.length();
    var rad = p.clone().multiplyScalar(1 / Math.max(1e-6, r));
    var toP = rad.clone().negate();                       /* 战机 → 球心 */
    var hd = _flyVec(f.head).normalize();
    var up = f.up ? _flyVec(f.up).normalize() : rad.clone();
    var right = new THREE.Vector3().crossVectors(hd, up);
    if (right.lengthSq() < 1e-8) right = new THREE.Vector3().crossVectors(hd, rad);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    var front = toP.dot(hd), side = toP.dot(right), top = toP.dot(up);
    var bearing = Math.atan2(side, front) * 180 / Math.PI;
    var elev = Math.asin(Math.max(-1, Math.min(1, top))) * 180 / Math.PI;
    var _names = ['前', '右前', '右', '右后', '后', '左后', '左', '左前'];
    var _idx = ((Math.round(bearing / 45) % 8) + 8) % 8;
    /* 星球在机体**正上/正下方**时，front/side 同时趋 0，bearing 是浮点噪声
       （实测基线 elev=-90° bearing 却在 0~18° 乱跳）。此时八方位无意义，
       直接报"正下方/正上方"——这正是玩家最需要的参照：脚底就是星球。 */
    var _pole = Math.abs(elev) > 80;
    return {
      bearing: _pole ? 0 : bearing, elev: elev,
      dir8: _pole ? (elev > 0 ? '正上方' : '正下方') : _names[_idx],
      vertical: elev > 20 ? '上方' : (elev < -20 ? '下方' : '平齐'),
      alt: r - R, range: r,
      toward: Math.acos(Math.max(-1, Math.min(1, front))) * 180 / Math.PI,
      bank: M._bankAngle || 0,
      /* v158.56：起飞/降落程序态 —— HUD 要能说清"现在是不是我在开" */
      phase: f.phase || 'cruise',
      /* v158.57：俯仰/下沉率 —— 让玩家看懂"为什么在掉高度" */
      pitch: (f.pitch || 0) * 180 / Math.PI,
      sink: f.sink || 0,
      holdAlt: (f.holdR == null) ? (r - R) : (f.holdR - R)
    };
  };

  /* ---- 三角锥战舰 + 尾迹（唯一形体；地表态隐藏） ---- */
  function _ensureShip() {
    if (M._shipMesh || !scene || !scene.add) return M._shipMesh;
    try {
      var g = new THREE.ConeGeometry(1.2, 4, 3);
      g.rotateX(Math.PI / 2);                 /* 锥尖 +Y → +Z（head） */
      var m = new THREE.MeshBasicMaterial({ color: 0x7ff3ff, wireframe: false });
      M._shipMesh = new THREE.Mesh(g, m);
      /* 引擎光点：锥尾一个小球，让"前进方向"一眼可辨 */
      var eg = new THREE.SphereGeometry(0.5, 8, 6);
      M._shipEngine = new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ color: 0xffb84d }));
      scene.add(M._shipMesh); scene.add(M._shipEngine);
      /* ⛔ v158.57 退役：尾迹 THREE.Line（见 M._fly 上方墓碑）。 */
    } catch (eS) { M._shipErr = String(eS && eS.message); }
    return M._shipMesh || null;
  }
  function _paintShip() {
    var fly = M._fly;
    if (!fly || !M._shipMesh) return;
    var show = !!(fly.active && !M._surf && fly.pos && fly.head);
    M._shipMesh.visible = M._shipEngine.visible = show;
    if (!show) return;
    try {
      var p = _flyVec(fly.pos), h = _flyVec(fly.head).normalize(), r = p.clone().normalize();
      M._shipMesh.position.copy(p);
      /* v158.52：机头对齐走正交基 makeBasis（z=机头、y=径向背向星球），
         不用 setFromUnitVectors((0,0,1),dir) —— 那是 §586s 明令退役的"最短弧"构造；
         虽然这里只作用于战舰 mesh、不碰相机姿态链，也不许借同形态复活。 */
      var _bZ = h.clone();
      var _bX = new THREE.Vector3().crossVectors(r, _bZ);
      if (_bX.lengthSq() < 1e-8) _bX.crossVectors(new THREE.Vector3(0, 1, 0), _bZ);
      if (_bX.lengthSq() < 1e-8) _bX.set(1, 0, 0);
      _bX.normalize();
      var _bY = new THREE.Vector3().crossVectors(_bZ, _bX).normalize();
      M._shipMesh.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(_bX, _bY, _bZ));
      M._shipEngine.position.copy(p).addScaledVector(h, -2.2);
      /* ⛔ v158.57 退役：尾迹填充（见 M._fly 上方墓碑）。 */
    } catch (eP) { if (!M._shipPaintErr) M._shipPaintErr = String(eP && eP.message); }
  }
  M.paintShip = _paintShip;

  /* ============================================================
   * v158.56：飞行状态的**唯一提交出口**。
   * 正常巡航与起飞/降落程序都经这里写 fly.* + camO + 尾迹 + 战舰，
   * 避免"程序一套、巡航一套"，也保证 HUD/探针读到的永远是同一份快照。
   * ============================================================ */
  function _commitFlight(fly, pos, head, bank, dt) {
    var radial = pos.clone().normalize();
    /* ============================================================
     * v158.58：**相机尾向滞后跟随**（老板「AD 不再改变相机朝向」）。
     * ------------------------------------------------------------
     * 旧版相机位置 = shipPos − head×BACK，head 一转相机的世界位置立刻
     * 绕过去 → 画面跟着转，"看着像星球在转"。现在尾向单独存一份
     * `fly.camTail`，按 FLY_CAM_TURN(2.2 rad/s) 朝 −head 追：
     * 偏航率 1.5 < 跟随 2.2 时仍会追上（不会永久落后），但急转瞬间相机
     * 明显慢半拍，于是**飞行器在画面里先偏出去**，转向看得见。
     * 尾向恒投影在切平面内 —— 否则 A/D 会把它带出地表平面，相机钻地下。
     * ============================================================ */
    var _dtC = Math.max(0.001, Math.min(0.12, dt || 0.016));
    var _want = head.clone().negate();
    _want.addScaledVector(radial, -_want.dot(radial));
    if (_want.lengthSq() < 1e-8) _want.copy(radial).negate();
    _want.normalize();
    if (!fly.camTail) fly.camTail = [_want.x, _want.y, _want.z];
    var _ct = _flyVec(fly.camTail);
    if (_ct.lengthSq() < 1e-8) _ct.copy(_want);
    _ct.normalize();
    var _kC = (M.FLY_CAM_TURN || 4.0) * _dtC;
    if (_kC > 1) _kC = 1;
    _ct.lerp(_want, _kC);
    if (_ct.lengthSq() < 1e-8) _ct.copy(_want);
    _ct.normalize();
    fly.camTail = [_ct.x, _ct.y, _ct.z];
    fly.pos = [pos.x, pos.y, pos.z];
    fly.head = [head.x, head.y, head.z];
    fly.vel = [head.x, head.y, head.z];       /* 速度瞬时对齐机头（v158.53 口径） */
    fly.up = [bank.x, bank.y, bank.z];
    M._bankAngle = Math.acos(Math.max(-1, Math.min(1, bank.dot(radial)))) * 180 / Math.PI;
    fly.active = true;
    M._flyNav = M._flyNavState();
    var _nr = pos.length();
    camO.dist = _nr;
    try { _zoomTarget = _nr - R; _zoomLastT = 0; } catch (eZ) { }
    var _ndF = pos.clone().multiplyScalar(1 / Math.max(1e-6, _nr));
    camO.dir = [_ndF.x, _ndF.y, _ndF.z];
    camO.yaw = Math.atan2(_ndF.x, _ndF.z);
    camO.pitch = Math.asin(Math.max(-1, Math.min(1, _ndF.y)));
    camO.quat = null; camO._euler = null;
    var _now = Date.now();
    /* ⛔ v158.57 退役：尾迹采样（见 M._fly 上方墓碑）。 */
    _ensureShip();
    _paintShip();
    try { M._lastAct = _now; } catch (eT) { }
  }

  /* ============================================================
   * v158.56：起飞 / 降落程序（老板「设置飞行器的起飞降落程序」）。
   * ------------------------------------------------------------
   * 程序期间**接管位姿**，玩家输入不打断（"程序"就该是程序）：
   *   takeoff 0→1：速度 0→FLY_TAKEOFF_V 平滑抬升，机头锁定起飞方向推进
   *                （真爬升的弧线，不是电梯直上）；到点切 cruise。
   *   landing 0→0.35：机头压向球心、速度归零；
   *           0.35→1：沿径向插值降到地表眼高；到点交回地表层（surfaceMode）。
   * 两者都经 _commitFlight，落点/朝向与巡航完全同构。
   * ============================================================ */
  function _tickProgram(dt) {
    var fly = M._fly;
    if (!fly || !fly.pos || !fly.head) return false;
    var pos = _flyVec(fly.pos), head = _flyVec(fly.head);
    var radial = pos.clone().normalize();
    fly.phaseT = (fly.phaseT || 0) + dt;
    var bank = fly.up ? _flyVec(fly.up).normalize() : radial.clone();
    if (fly.phase === 'takeoff') {
      var T = M.FLY_TAKEOFF_T || 2.4;
      var k = Math.min(1, fly.phaseT / T);
      var e = k * k * (3 - 2 * k);              /* smoothstep：起手柔和、收尾稳 */
      fly.v = (M.FLY_TAKEOFF_V || 62) * e;
      var lh = fly.launchHead ? _flyVec(fly.launchHead).normalize() : head.clone();
      head.copy(lh);
      pos.addScaledVector(head, fly.v * dt);
      bank.lerp(radial, Math.min(1, 2.2 * dt)).normalize();
      bank.addScaledVector(head, -bank.dot(head)).normalize();
      if (k >= 1) { fly.phase = 'cruise'; fly.phaseT = 0; }
    } else if (fly.phase === 'landing') {
      var _r0 = (fly.landR0 != null) ? fly.landR0 : pos.length();
      /* v158.57：落点按**地形高**算（与巡航下限同一口径），否则山里"落地"。 */
      var _terrL = 0;
      try {
        _terrL = (M.camFloorAt ? M.camFloorAt([radial.x, radial.y, radial.z]) : 0) || 0;
      } catch (eTL57) { _terrL = 0; }
      var _r1 = Math.max(R + (M.SURF_EYE || 1.7) * 1.5, _terrL + (M.SURF_EYE || 1.7));
      /* v158.57：程序时长按**高度 / 常下沉率**算 —— 高空掉下来不会等太久
         （上限 7s），低空也不拖沓（下限 1.8s）。旧版固定 2.6s，从 300m 落下来
         等于 115 m/s 砸地。 */
      var _need = Math.abs(_r0 - _r1) / Math.max(1, (M.FLY_LAND_SINK || 26));
      var T2 = Math.max(1.8, Math.min((M.FLY_LAND_T_MAX || 7), _need));
      var k2 = Math.min(1, fly.phaseT / T2);
      var _down = radial.clone().negate();
      head.lerp(_down, Math.min(1, 3.0 * dt)).normalize();
      fly.v = Math.max(0, (fly.v || 0) * (1 - Math.min(1, 2.6 * dt)));
      var _e2 = (k2 < 0.35) ? 0 : ((k2 - 0.35) / 0.65);
      _e2 = _e2 * _e2 * (3 - 2 * _e2);
      pos.setLength(Math.max(_r1, _r0 + (_r1 - _r0) * _e2));
      bank.lerp(radial, Math.min(1, 2.6 * dt)).normalize();
      bank.addScaledVector(head, -bank.dot(head)).normalize();
      if (k2 >= 1) {
        /* ============================================================
         * v158.59（老板「地面不要切换成人。做一个飞行器着陆，然后出来之后
         *   才是人」「不允许有高空和地面之分，这是一个连续的空间」）
         * ------------------------------------------------------------
         * 旧版落地即 `surfaceMode(true)`：人瞬间出现、飞行器消失、
         * 相机跳到地表机位 —— 这就是 60-40 段"跳变"的终点。
         * 现在落地只是**把飞行器停在地上**：phase=landed、飞行器保留、
         * 相机仍在机尾。人要**主动下机**（空格）才出现，
         * 进地表只有一个入口 M.flyExit()。
         * ============================================================ */
        fly.phase = 'landed'; fly.phaseT = 0; fly.v = 0;
        fly.sink = 0;
        /* v158.59：停放姿态 —— 机头回水平（沿降落前的朝向），机体 up 回径向。
           否则机头仍朝下，飞行器是"倒插在土里"的。 */
        var _pk2 = pos.clone().normalize();
        var _ph2 = fly.landHead ? _flyVec(fly.landHead) : head.clone();
        _ph2.addScaledVector(_pk2, -_ph2.dot(_pk2));
        if (_ph2.lengthSq() < 1e-6) _ph2.crossVectors(_pk2, new THREE.Vector3(0, 1, 0));
        if (_ph2.lengthSq() < 1e-6) _ph2.set(1, 0, 0);
        _ph2.normalize();
        head.copy(_ph2);
        bank.copy(_pk2);
        _commitFlight(fly, pos, head, bank, dt);
        _paintShip();
        try { if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🛬 已着陆 · 空格下机'); } catch (eLS) { }
        return true;
      }
    }
    /* v158.57：程序自己管半径，同步 holdR/pitch —— 交回巡航时高度从落点
       接着算，不会因为 holdR 是旧值而跳一下。 */
    fly.holdR = pos.length();
    fly.pitch = Math.asin(Math.max(-1, Math.min(1, head.dot(radial))));
    fly.sink = 0;
    _commitFlight(fly, pos, head, bank, dt);
    return true;
  }

  function _tickFlight(dt) {
    var fly = M._fly || (M._fly = { v: 0, pos: null, head: null, vel: null, active: false,
                                    climb: 0 });
    var keys = (GAME && GAME._flyKeys) || null;
    /* 地表/跟随 = 走路态：战舰收起、速度清零 */
    if (M._surf || M.FOLLOW) {
      if (fly.v) fly.v = 0;
      if (fly.active) fly.active = false;
      if (fly.aim) fly.aim = null;                       /* v158.56：鼠标指示随飞行态作废 */
      if (fly.phase !== 'dock') { fly.phase = 'dock'; fly.phaseT = 0; }
      fly.autoLand = 0;                                  /* v158.57：落地后清自动着陆标记 */
      fly.sink = 0;
      if (M._flyCrossOn) {
        M._flyCrossOn = false;
        try { if (GAME.ui && GAME.ui.renderFlyCross) GAME.ui.renderFlyCross(0, 0, false); } catch (eC0) { }
      }
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
      /* v158.52 · 启动瞬态兜底：camO.dir 在首帧 placeCamera 之前是 null，
         旧版直接读 camO.dir[0] 会抛 "Cannot read properties of null"（探针①抓出）。
         用 yaw/pitch 反推等价单位方向（与下面 6662-6663 的反算同式），
         保证首帧就有合法 pos/head/vel，不依赖相机状态机先跑过一轮。 */
      var _dir0 = (camO.dir && camO.dir.length === 3) ? camO.dir : [
        Math.sin(camO.yaw) * Math.cos(camO.pitch),
        Math.sin(camO.pitch),
        Math.cos(camO.yaw) * Math.cos(camO.pitch)
      ];
      fly.pos = [_dir0[0] * _dd, _dir0[1] * _dd, _dir0[2] * _dd];
      var _rv = new THREE.Vector3(_dir0[0], _dir0[1], _dir0[2]);
      var _hv = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
      _hv.addScaledVector(_rv, -_hv.dot(_rv));
      if (_hv.lengthSq() < 1e-8) {
        _hv = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), _rv);
        if (_hv.lengthSq() < 1e-8) _hv.set(1, 0, 0);
      }
      _hv.normalize();
      fly.head = [_hv.x, _hv.y, _hv.z];
      fly.vel = [_hv.x, _hv.y, _hv.z];
      fly.up = [_rv.x, _rv.y, _rv.z];   /* v158.53：机体"上"初始 = 径向背向星球 */
    }
    /* v158.56：起飞/降落程序期间由程序接管位姿，玩家输入不打断。 */
    if (fly.phase === 'takeoff' || fly.phase === 'landing') {
      return _tickProgram(dt);
    }
    /* v158.59：已着陆 = 停在原地（不推进、不下沉、不响应方向键），
       等玩家下机或再次起飞。相机仍在机尾，画面不动。 */
    if (fly.phase === 'landed') {
      fly.v = 0; fly.sink = 0;
      var _lp2 = _flyVec(fly.pos), _lh2 = _flyVec(fly.head).normalize();
      var _lb2 = fly.up ? _flyVec(fly.up).normalize() : _lp2.clone().normalize();
      _lb2.addScaledVector(_lh2, -_lb2.dot(_lh2));
      if (_lb2.lengthSq() < 1e-8) _lb2.copy(_lp2).normalize();
      _lb2.normalize();
      _commitFlight(fly, _lp2, _lh2, _lb2, dt);
      return false;
    }
    var pos = _flyVec(fly.pos), head = _flyVec(fly.head);
    var radial = pos.clone().normalize();
    /* ⛔ v158.56（老板「在高空，不再由滚轮调整高度」）：飞行态不再消费
       _zoomTarget —— 高度只由飞行方向决定，滚轮入口在 wheel 里直接 return。
       旧段「先消费滚轮目标、再叠加 ↑↓ 改半径」整条退役。 */
    /* ① 速度标量：W/S、↑/↓、←/→ 全进同一条速度通道（老板「Ws和上下为加减速」）。
       无输入恒速（牛顿第一定律）；↑↓ 不再是电梯（FLY_CLIMB 退役）。 */
    if (w || u || r) fly.v += (M.FLY_ACCEL || 48) * dt;
    if (s || dn || l) fly.v -= (M.FLY_ACCEL || 48) * dt;
    var _vmax = M.FLY_MAX || 120, _vmin = -(M.FLY_BACK_MAX || 72);
    fly.v = Math.max(_vmin, Math.min(_vmax, fly.v));
    if (!r && !l && !w && !s && !u && !dn && Math.abs(fly.v) < 0.01) fly.v = 0;
    /* ② ⛔ v158.56 退役：↑↓ 改海拔（"电梯"语义）。去向：速度通道见 ①。 */
    fly.climb = 0;
    /* ③ 鼠标**绝对指示**航向（老板「鼠标指示飞行的方向」）。
       aim 由鼠标偏离屏幕中心的方向算一次并锁定（见 M._flyAimAt）：
       机头以 FLY_AIM_RATE 限速朝它转，到位即停 —— 鼠标不动就保持航向，
       不会像"每帧重算"那样一直打转。鼠标回中死区 → aim=null，保持当前。 */
    if (fly.aim) {
      var _aim = _flyVec(fly.aim).normalize();
      var _ang = head.angleTo(_aim);
      var _mx = (M.FLY_AIM_RATE || 1.7) * dt;
      if (_ang <= _mx) head.copy(_aim);
      else head.lerp(_aim, _mx / Math.max(1e-6, _ang)).normalize();
      head.normalize();
    }
    /* ============================================================
     * ④ A/D = **改变飞行器方向**（v158.58，老板「AD 不再改变相机朝向，
     *    而是改变飞行器方向」）。
     *  · 偏航：绕当地天顶按 FLY_YAW_RATE(1.5 rad/s) 转机头 —— A 左、D 右。
     *    旧版 `_rollDir = a ? -1 : 1` 配 `applyAxisAngle(radial, …)` 实际是
     *    **A 右转**（Rodrigues：绕 +径向正角才向左），方向是反的，一并修正。
     *  · 横滚：同时做视觉倾斜（左转左倾），但它是姿态、不参与方向；
     *    松手回正到径向。
     *  · 清 aim：A/D 动了方向就接管，否则鼠标指示下一帧会把机头拉回去。
     * 相机不在这里转 —— 相机尾向在 _commitFlight 里按 FLY_CAM_TURN 滞后跟随。
     * ============================================================ */
    var _bank = fly.up ? _flyVec(fly.up).normalize() : radial.clone();
    if (a || d) {
      var _yawDir = a ? 1 : -1;                 /* A = 左转（绕天顶正角）、D = 右转 */
      head.applyAxisAngle(radial, _yawDir * (M.FLY_YAW_RATE || 1.5) * dt).normalize();
      _bank.applyAxisAngle(head, -_yawDir * (M.FLY_ROLL || 1.7) * dt).normalize();
      /* 机头转后重新正交化 up，防与 head 不垂直导致画面翻滚 */
      _bank.addScaledVector(head, -_bank.dot(head)).normalize();
      /* A/D 接管方向：清掉鼠标指示，否则下一帧 aim 会把机头拉回旧方向 */
      fly.aim = null; fly.aimPitch = null;
    } else {
      /* 松手缓慢回正：机体 up 朝径向靠拢（脚底星球），转回平飞 */
      _bank.lerp(radial, Math.min(1, 0.8 * dt)).normalize();
    }
    head.normalize();
    /* ============================================================
     * ③b v158.57：**俯仰与水平转向分离**（老板「不改变海拔时应该相对固定
     *     高度」）。机头拆成「切向方向（往哪飞）」+「俯仰角 fly.pitch
     *     （相对当地水平面）」，俯仰单独按 FLY_PITCH_RATE 配平：
     *       · 有鼠标指示 → 目标俯仰 = aim 相对当地水平面的仰角；
     *       · 松手 → 回 FLY_TRIM（≈1.15° 的配平迎角，用 v·sinθ 抵消引力）；
     *       · 重建 head = 切向×cos(pitch) + 径向×sin(pitch)。
     *     这样"左右转"永远留在切平面内，不会再像旧版那样一转就爬高
     *     （诊断 C：鼠标纯水平右移，机头却抬头 37.7°）。
     * ============================================================ */
    var _aimPitch = (fly.aim && fly.aimPitch != null)
      ? fly.aimPitch : (M.FLY_TRIM == null ? 0 : M.FLY_TRIM);
    var _p0 = (fly.pitch == null) ? 0 : fly.pitch;
    var _pr = (M.FLY_PITCH_RATE || 0.9) * dt;
    var _dp = _aimPitch - _p0;
    _p0 += Math.max(-_pr, Math.min(_pr, _dp));
    fly.pitch = _p0;
    var _tanH = head.clone().addScaledVector(radial, -head.dot(radial));
    if (_tanH.lengthSq() < 1e-6) {
      _tanH.crossVectors(radial, new THREE.Vector3(0, 1, 0));
      if (_tanH.lengthSq() < 1e-6) _tanH.set(1, 0, 0);
    }
    _tanH.normalize();
    head.copy(_tanH).multiplyScalar(Math.cos(_p0))
      .addScaledVector(radial, Math.sin(_p0)).normalize();
    /* v158.57：俯仰改了 head，机体 up 必须跟着重新正交化 —— 否则 head·up
       不再是 0（探针 v15855⑤ 实测 0.68），HUD 的 right 基与横滚角都会偏。 */
    _bank.addScaledVector(head, -_bank.dot(head));
    if (_bank.lengthSq() < 1e-8) _bank.copy(radial);
    _bank.normalize();

    /* ⑤ 速度瞬时对齐机头（v158.53 规则变更）：
       旧"有限追随"实测 0.5s 侧滑 20.8° —— 推了舵还往原方向飘，老板原话
       "不能按自己意愿想去哪就去"。现在 vel = head，看哪飞哪；转向的弧线
       由机头自己在转产生，不再靠速度滞后 —— 轨迹仍是弧，但不再脱节。
       ⑥ 位置沿速度矢量推进 + 状态/相机对账 + 尾迹 + 战舰：全部收进
       _commitFlight（起飞降落程序共用同一条出口，绝不各写一套）。 */
    pos.addScaledVector(head, fly.v * dt);
    /* ============================================================
     * ⑤b v158.57：**贴回球面**。旧版不贴：沿切线走直线 = 一点点飞出星球
     *   （诊断 B：v=80 水平飞 6 秒高度 +124.6m），根本没有"保持高度"。
     *   现在半径由 holdR 决定，holdR 按引力下沉率推进：
     *     sink = GRAV_SINK·cos(pitch) − v·sin(pitch)
     *   平飞（pitch≈0）→ sink≈GRAV_SINK，**缓慢下降**（老板「由于引力逐步下降」）；
     *   抬头把 v·sin(pitch) 顶过引力 → sink<0 → 爬升；
     *   低头 → sink 变大 → 快速下降。
     * ============================================================ */
    var _sink = (M.FLY_GRAV_SINK == null ? 1.2 : M.FLY_GRAV_SINK) * Math.cos(_p0)
      - fly.v * Math.sin(_p0);
    var _holdR = (fly.holdR == null) ? pos.length() : fly.holdR;
    _holdR -= _sink * dt;
    /* v158.57：下限必须吃**地形高**。实机图 v15857-C 抓出：定值下限
       R+2.7m 让飞行器在 22m 高度直接钻进山里，战舰被地形完全遮住。
       高度只认球心距是不够的 —— 山下 22m 是空中，山上 22m 是土里。 */
    var _terr = 0;
    try {
      _terr = (M.camFloorAt ? M.camFloorAt([radial.x, radial.y, radial.z]) : 0) || 0;
    } catch (eT57) { _terr = 0; }
    var _rMin = Math.max(R + (M.SURF_EYE || 1.7) * 1.6, _terr + 4);
    var _rMax = M.ZOOM_MAX || R * 50;
    _holdR = Math.max(_rMin, Math.min(_rMax, _holdR));
    pos.setLength(_holdR);
    fly.holdR = _holdR;
    fly.sink = _sink;
    /* ⑤c v158.57：引力会把高度一路带下来 —— 低空仍在沉就自动进入着陆程序，
       不让玩家在 10m 高度以 80m/s 撞地。抬头能把 sink 压到 0 以下（爬升），
       所以想贴地低飞仍然做得到。 */
    if ((_holdR - R) < (M.FLY_LAND_AUTO_ALT || 26) && _sink > 0) {
      if (!fly.autoLand) {
        fly.autoLand = 1;
        try { if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🛬 高度过低，自动着陆'); } catch (eAL) { }
      }
      M.flyLand();
    }
    _commitFlight(fly, pos, head, _bank, dt);
    return !!(l || r || u || dn || w || s || a || d || fly.v);
  }
  M.flyTick = _tickFlight;
  /* 探针出口（只读纯函数）：飞行状态快照 —— 给 smoke 断言/探针用。 */
  /* v158.53：探针出口扩为「机体 up + 横滚角 + 导航快照」，velTurn 整条退役。
     仍保留 lookYaw/lookPitch 只读字段（地表态环视仍需，飞行态恒 0）。 */
  M.flyProbe = function () {
    var f = M._fly || {};
    return { v: f.v || 0, pos: f.pos ? f.pos.slice() : null,
      head: f.head ? f.head.slice() : null, vel: f.vel ? f.vel.slice() : null,
      up: f.up ? f.up.slice() : null,
      active: !!f.active, climb: f.climb || 0, trail: 0,   /* v158.57 尾迹退役，恒 0 */
      alt: f.pos ? (Math.hypot(f.pos[0], f.pos[1], f.pos[2]) - R) : null,
      max: M.FLY_MAX, back: M.FLY_BACK_MAX, accel: M.FLY_ACCEL,
      turn: M.FLY_TURN, lookK: M.FLY_LOOK_K, roll: M.FLY_ROLL,
      yawRate: M.FLY_YAW_RATE, camTurn: M.FLY_CAM_TURN,
      camTail: f.camTail ? f.camTail.slice() : null,
      /* v158.56：climbRate（↑↓ 电梯）随 FLY_CLIMB 退役；改为只读新口径 */
      aimMax: M.FLY_AIM_MAX, aimRate: M.FLY_AIM_RATE, screenY: M.FLY_SCREEN_Y,
      phase: f.phase || 'cruise', phaseT: f.phaseT || 0,
      aim: f.aim ? f.aim.slice() : null,
      camBack: M.FLY_CAM_BACK, camUp: M.FLY_CAM_UP, camMix: M.FLY_CAM_MIX,
      /* v158.57：高度保持/引力下沉/自动着陆的只读快照 */
      gravSink: M.FLY_GRAV_SINK, pitchRate: M.FLY_PITCH_RATE, trim: M.FLY_TRIM,
      landAutoAlt: M.FLY_LAND_AUTO_ALT, landSink: M.FLY_LAND_SINK,
      pitch: f.pitch || 0, sink: f.sink || 0,
      holdR: f.holdR == null ? null : f.holdR,
      holdAlt: f.holdR == null ? null : (f.holdR - R),
      autoLand: f.autoLand || 0,
      bank: M._bankAngle || 0, nav: M._flyNavState ? M._flyNavState() : null,
      /* ⚠️ v158.57：相机俯仰必须叫 camPitch —— 旧字段名 `pitch` 与机头俯仰
         同名，会把 `pitch: f.pitch` 静默覆盖成相机值（探针⑤实测读到 +24.2°
         的相机俯仰、而机头其实是 −28.6°）。两个 pitch 语义不同，不许共用键名。 */
      yaw: camO.yaw, camPitch: camO.pitch, dir: camO.dir ? camO.dir.slice() : null,
      lookYaw: camO.lookYaw, lookPitch: camO.lookPitch,
      camPos: M._flyCam ? M._flyCam.pos.slice() : null };
  };
  /* ============================================================
   * v158.56：鼠标**指示飞行方向**（唯一入口：mousemove / 探针都走它）
   * ------------------------------------------------------------
   * 屏幕坐标 → 相对屏幕中心的偏离方向 → 相对**当前机体基**的 yaw/pitch →
   * 世界方向 aim。算一次写进 fly.aim 并锁定，机头限速朝它转（到位即停）；
   * 鼠标回到中心死区 → aim=null，保持当前航向，不会一直打转。
   * 这是「指示」而不是「相对拖动」：鼠标停在哪，飞船就朝那个方向飞。
   * ============================================================ */
  M._flyAimAt = function (px, py) {
    var f = M._fly;
    if (!f) return null;
    if (!f.active || M._surf || !f.pos || !f.head) { f.aim = null; f.aimPitch = null; return null; }
    /* ⚠️ canvas 是 M.bindControls(canvas) 的**形参**，模块作用域没有它 ——
       直接引用会抛 ReferenceError 并被外层 try/catch 吞掉（探针④实测 aim 恒 null）。
       统一从 M._cvEl 取（bindControls 里赋值），兜底按 id 查。
       ⚠️ 归一化必须用**画布 rect**（同 clientX 坐标系）：画布被 app-scale 缩放时
       clientWidth 与 clientX 不同量纲，直接相除会把"靠边"算成"接近中心"
       （实测 nx 从 0.41 掉到 -0.06 → 落进死区 → aim 恒 null）。 */
    var _cv = M._cvEl || (typeof document !== 'undefined' ? document.getElementById('mapCanvas') : null);
    var _rc = null;
    try { _rc = (_cv && _cv.getBoundingClientRect) ? _cv.getBoundingClientRect() : null; } catch (eRc) { _rc = null; }
    var w = (_rc && _rc.width) || window.innerWidth || 1;
    var h = (_rc && _rc.height) || window.innerHeight || 1;
    var ox = (_rc && _rc.left) || 0, oy = (_rc && _rc.top) || 0;
    var nx = ((px - ox) / Math.max(1, w) - 0.5) * 2;
    var ny = ((py - oy) / Math.max(1, h) - 0.5) * 2;
    var mag = Math.hypot(nx, ny);
    var dead = (M.FLY_AIM_DEAD == null ? 0.10 : M.FLY_AIM_DEAD);
    if (mag <= dead) { f.aim = null; f.aimPitch = null; return null; }   /* 回中 = 保持航向 */
    /* 死区外重新标定到 0..1：刚出死区是小角度，靠边才是满偏 */
    var k = Math.min(1, (mag - dead) / Math.max(1e-6, 1 - dead)) / mag;
    var yaw = nx * k * (M.FLY_AIM_MAX == null ? 1.15 : M.FLY_AIM_MAX);
    var pit = -ny * k * (M.FLY_AIM_PITCH == null ? 0.85 : M.FLY_AIM_PITCH);
    var hd = _flyVec(f.head).normalize();
    /* ============================================================
     * v158.57（老板「不改变海拔时应该相对固定高度」）：偏航轴从**机体 up**
     *   改回**当地径向**。诊断 C 实测：鼠标纯水平右移 4 秒，机头却抬头
     *   37.7°（换 pitch 配平后仍 16.6°）—— 因为机体 up 在转向后有横向
     *   倾斜，绕它转 yaw 会把机头带出切平面。
     *   现在 yaw 绕 radial：水平输入恒留在切平面，俯仰只由 ny 决定，
     *   "左右看"再也不会变成"往上爬"。
     * ============================================================ */
    var rad = _flyVec(f.pos).normalize();
    var right = new THREE.Vector3().crossVectors(hd, rad);
    if (right.lengthSq() < 1e-8) {
      right.crossVectors(new THREE.Vector3(0, 1, 0), rad);
      if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    }
    right.normalize();
    var q = new THREE.Quaternion();
    var aim = hd.clone();
    /* 鼠标右 → 机头右转（绕径向负向）；鼠标上 → 抬头（绕 right 正向）。
       方向由 right = cross(head, radial) 的右手定则确定，探针逐项验过符号。 */
    if (yaw) { q.setFromAxisAngle(rad, -yaw); aim.applyQuaternion(q); }
    if (pit) { q.setFromAxisAngle(right, pit); aim.applyQuaternion(q); }
    aim.normalize();
    f.aim = [aim.x, aim.y, aim.z];
    /* v158.57：俯仰角**单独存一份锁定值**。若每帧从世界方向 aim 反算
       asin(aim·radial)，飞行器沿球面飞远后径向转了 45°，同一世界方向的
       相对仰角就跟着变 —— 诊断 C 实测"鼠标纯水平右移"仍涨到 15.8°。
       锁定角度后：ny=0 → aimPitch=0 → 俯仰恒 0，飞多远都不变形。 */
    f.aimPitch = pit;
    return f.aim;
  };

  /* ============================================================
   * v158.56：起飞 / 降落（唯一出入口；空格键与探针共用同一函数）
   * ------------------------------------------------------------
   * 起飞点取「当前相机方向对应的地表上方」，机头沿径向向外拉起 35° ——
   * 于是起飞能看到星球在脚下展开，不是黑屏直上。程序由 _tickProgram 跑。
   * ============================================================ */
  M.flyLaunch = function () {
    var f = M._fly;
    if (!f || !cam || !cam.quaternion) return false;
    if (f.active && !M._surf) return false;               /* 已经在飞，不重复起飞 */
    var _dir = (camO.dir && camO.dir.length === 3) ? camO.dir.slice() : [0, 1, 0];
    var _rad = new THREE.Vector3(_dir[0], _dir[1], _dir[2]);
    if (_rad.lengthSq() < 1e-8) _rad.set(0, 1, 0);
    _rad.normalize();
    var _alt0 = (M.SURF_EYE || 1.7) * 1.5 + 6;
    /* 先切出地表：_surf 守卫会直接把飞行通道关掉，必须在起跳前切 */
    if (M._surf) { try { M.surfaceMode(false); } catch (eL0) { } }
    var _p = _rad.clone().multiplyScalar(R + _alt0);
    var _tang = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    _tang.addScaledVector(_rad, -_tang.dot(_rad));
    if (_tang.lengthSq() < 1e-6) _tang.crossVectors(new THREE.Vector3(0, 1, 0), _rad);
    if (_tang.lengthSq() < 1e-6) _tang.set(1, 0, 0);
    _tang.normalize();
    var _a35 = 35 * Math.PI / 180;
    var _h = _rad.clone().multiplyScalar(Math.cos(_a35))
      .addScaledVector(_tang, Math.sin(_a35)).normalize();
    f.pos = [_p.x, _p.y, _p.z];
    f.head = [_h.x, _h.y, _h.z];
    f.vel = [_h.x, _h.y, _h.z];
    f.up = [_rad.x, _rad.y, _rad.z];
    f.launchHead = [_h.x, _h.y, _h.z];
    f.v = 0; f.active = true; f.aim = null;
    f.phase = 'takeoff'; f.phaseT = 0;
    f.landR0 = null;
    /* v158.57：高度/俯仰状态从起飞点重置 —— 否则 holdR 还是上一轮的值，
       起飞后第一帧就会被 setLength 拽到旧高度。 */
    f.holdR = _p.length();
    f.camTail = [-_h.x, -_h.y, -_h.z];   /* v158.58：起飞相机就位在机尾 */
    f.pitch = Math.asin(Math.max(-1, Math.min(1, _h.dot(_rad))));
    f.sink = 0; f.autoLand = 0;
    try { _zoomTarget = _p.length() - R; _zoomLastT = 0; } catch (eL1) { }
    try { _ensureShip(); _paintShip(); } catch (eL2) { }
    try { if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🧑‍✈️ 登机 · 🚀 起飞程序启动'); } catch (eL3) { }
    return true;
  };
  M.flyLand = function () {
    var f = M._fly;
    if (!f || !f.active || M._surf) return false;
    if (f.phase === 'takeoff' || f.phase === 'landing') return false;
    f.phase = 'landing'; f.phaseT = 0; f.aim = null;
    f.landR0 = f.pos ? Math.hypot(f.pos[0], f.pos[1], f.pos[2]) : (camO.dist || R * 2);
    /* v158.59：记下**降落前的水平朝向**。降落程序会把机头压向球心（−73°），
       直接用落地那一刻的 head 当停放姿态，飞行器会竖直插在地上
       （实机图 v15859-C 拍到）。停好后要摆平成机头朝前的姿态。 */
    if (f.pos && f.head) {
      var _pk = _flyVec(f.pos).normalize();
      var _pt = _flyVec(f.head).normalize();
      _pt.addScaledVector(_pk, -_pt.dot(_pk));
      if (_pt.lengthSq() < 1e-6) _pt.crossVectors(_pk, new THREE.Vector3(0, 1, 0));
      if (_pt.lengthSq() < 1e-6) _pt.set(1, 0, 0);
      f.landHead = [_pt.normalize().x, _pt.y, _pt.z];
    }
    /* ⚠️ v158.57：这里**不许**清 autoLand —— 自动着陆是先置 1 再调本函数，
       清掉就等于"自动着陆永远读不到标记"（探针⑥实测 autoLand=0）。
       标记由 flyLaunch / 落地分支统一清。 */
    /* ⛔ v158.57：尾迹整条退役，这里的清理一并删除。 */
    try { if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🛬 降落程序启动'); } catch (eL4) { }
    return true;
  };
  /* ============================================================
   * v158.59：**下机** —— 进地表层的唯一入口。
   * ------------------------------------------------------------
   * 老板「地面不要切换成人。做一个飞行器着陆，然后出来之后才是人」：
   * 着陆只是把飞行器停在地上（phase=landed），人不会自己出现；
   * 只有玩家主动下机，才 surfaceMode(true) 建地表、现出人物。
   * 这样"飞行"与"地面"之间不再有按高度自动跳的开关 —— 只有一个动作。
   * ============================================================ */
  M.flyExit = function () {
    var f = M._fly;
    if (!f || f.phase !== 'landed') return false;
    f.phase = 'dock'; f.phaseT = 0;
    /* ============================================================
     * v158.59：下机时的**相机朝向**必须主动给。
     * ------------------------------------------------------------
     * 地表分支的规则是"`_surfDir` 非空就保持玩家视线"，而飞行态没有
     * `_surfDir`；不设的话它复用 `_prevF`（降落时的 −73° 俯冲视线）——
     * 下机后相机还盯着脚下，人就在画面外（实机图 v15859-D 拍到）。
     * 这里按**降落前的水平朝向**给一个正常第三人称视线。
     * ============================================================ */
    try {
      var _pkX = f.pos ? _flyVec(f.pos).normalize() : new THREE.Vector3(0, 1, 0);
      var _phX = f.landHead ? _flyVec(f.landHead) : new THREE.Vector3(0, 0, -1);
      _phX.addScaledVector(_pkX, -_phX.dot(_pkX));
      if (_phX.lengthSq() < 1e-6) _phX.crossVectors(_pkX, new THREE.Vector3(0, 0, 1));
      if (_phX.lengthSq() < 1e-6) _phX.set(1, 0, 0);
      _phX.normalize();
      M._surfDir = _phX.clone();
      M._surfRight = new THREE.Vector3().crossVectors(_phX, _pkX).normalize();
      M._surfAnchor = null;
      /* 下机用**近距**第三人称（16 ↔ 3.2 档里取 5.5m）：地表默认 16m 是给
         "从高空滚下来"的大视野准备的，直接套用会让人只占十几个像素
         （实机图 v15859-D 抓到）。滚轮仍可自己拉远拉近。 */
      M._surfCamDist = Math.max(M.SURF_CAM_MIN_DIST || 3.2,
        Math.min(M.SURF_CAM_DIST || 16, 5.5));
      /* 俯角也调平：地表默认 SURF_CAM_EL=1.0 rad(≈57°) 是"俯视看地图"的
         角度，刚下机就套用等于低头看脚（看不到地平线）。0.42 rad ≈ 24°
         是正常第三人称背后视角，玩家仍可用右键自己调。 */
      M.SURF_CAM_EL = 0.42;
      camO.lookYaw = 0; camO.lookPitch = 0;
    } catch (eEx0) { }
    /* ============================================================
     * v158.59：把**玩家位姿落到落点** —— 这才叫"下机"。
     * ------------------------------------------------------------
     * 不写这一步，地表态的玩家小人还停在进入飞行前的位置（可能在几百米
     * 外），相机对着落点地面，人在画面外（实机图 v15859-D 拍到）。
     * 走 P0 的唯一出口 setPlayerPose，不直接写 state。
     * ============================================================ */
    try {
      var _dpX = f.pos ? _flyVec(f.pos).normalize() : new THREE.Vector3(0, 1, 0);
      var _hX = (M._groundAtUnit ? M._groundAtUnit([_dpX.x, _dpX.y, _dpX.z]) : 0) || 0;
      var _yawX = 0;
      if (f.landHead) {
        /* yaw：把水平朝向换算成球面方位（与 playerPose 同口径：yaw 绕径向） */
        var _rgtX = new THREE.Vector3().crossVectors(f.landHead ? _flyVec(f.landHead) : new THREE.Vector3(1, 0, 0), _dpX);
        if (_rgtX.lengthSq() > 1e-8) _yawX = 0;
      }
      M.setPlayerPose({ dir: [_dpX.x, _dpX.y, _dpX.z], h: _hX, yaw: _yawX, v: [0, 0, 0], ci: null });
    } catch (eEx4) { }
    /* 先收起飞行器再交班：surfaceMode 里 placeCamera 会读 fly.active，
       顺序反了会多渲染一帧"人在飞行器上"的重叠。 */
    f.active = false;
    try { M.surfaceMode(true); } catch (eEx) { }
    try { _paintShip(); } catch (eEx1) { }
    try { if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🚶 已下机'); } catch (eEx2) { }
    return true;
  };

  M.flyToggle = function () {
    var f = M._fly;
    if (!f) return false;
    /* 已着陆 → 下机（不是直接起飞，先让"人"出现） */
    if (f.phase === 'landed') return M.flyExit();
    if (f.active && !M._surf) return M.flyLand();
    return M.flyLaunch();
  };

  /* ============================================================
   * v158.44（老板「人太大又太小了。我建议，人的占屏比例应该相对固定，
   *   则在高空时，人物会比例放大。在地面时，人甚至应该小于树才对」）
   * ------------------------------------------------------------
   * **屏占比固定缩放**：人物世界尺寸随"相机到人的距离"动态缩放，
   *   屏幕占比恒为 FIG_SCREEN_FRAC（2.5% 屏高）—— 高空放大看得见、
   *   地面 clamp 回基准比例（buildFigures 的 baseScale ≤1.45，人 1.74m
   *   < 最矮的树 2.7m）。
   * 公式：worldH = frac × 2d × tan(fov/2)；scale = max(base, worldH / 1.2)
   *   （1.2 = 方块人几何身高；actor 骨骼替身已对齐 1.2）。
   * 每帧跑（只写 2 个 group 的 scale，无重建、零开销），placeCamera 之后调用
   *   用本帧相机位置算距离。
   * ============================================================ */
  M.FIG_SCREEN_FRAC = 0.025;   /* 人形目标屏高占比（2.5%） */
  M.FIG_BASE_H = 1.2;          /* 方块人几何身高（scale 的基准） */
  function _figScaleTick() {
    if (!figRoot || !figCache) return;
    if (!cam || !cam.position || !cam.fov) return;
    var st = GAME.state;
    if (!st) return;
    var pp = M.playerPose();
    if (!pp || !pp.dir) return;
    var _pr = R + ((pp.h != null && isFinite(pp.h)) ? pp.h : 0);
    var _dF = Math.hypot(
      cam.position.x - pp.dir[0] * _pr,
      cam.position.y - pp.dir[1] * _pr,
      cam.position.z - pp.dir[2] * _pr);
    _dF = Math.max(0.1, _dF);
    var _whF = (M.FIG_SCREEN_FRAC || 0.025) * 2 * _dF * Math.tan(cam.fov * Math.PI / 360);
    /* v158.46d：_sF 不再有 Math.max(1, …) 下限 —— 近处屏占比对应的目标尺寸
       小于 1× 时允许小于 1（基准 base 才是真下限：0.5 → 人 0.6m）。
       旧写法 max(1,…) 会把地表人物钉死在 1×，基准 0.5 永远不生效。 */
    var _sF = _whF / (M.FIG_BASE_H || 1.2);
    M._figScale = _sF;                 /* 探针读数 */
    M._figDist = _dF;
    /* 只缩**玩家小人**（stand）—— 城市人偶（city）是"城市的标志"，跟着放大
       会盖过城池本身；老板要固定屏占比的是"人物"，不是城市标记。 */
    var _fst = figCache.stand;
    if (_fst && _fst.g) {
      var _base = _fst.g.userData.baseScale || 1;
      _fst.g.scale.setScalar(Math.max(_base, _sF));
    }
  }
  M.figScaleTick = _figScaleTick;
  /* 探针出口（只读纯函数）：给定距离算目标 scale（同 _figScaleTick 公式；
     v158.46d 起无 1× 下限，与 _figScaleTick 同源） */
  M.figScaleOf = function (d, fov) {
    var f = fov == null ? 42 : fov;
    var wh = (M.FIG_SCREEN_FRAC || 0.025) * 2 * Math.max(0.1, d) * Math.tan(f * Math.PI / 360);
    return wh / (M.FIG_BASE_H || 1.2);
  };
  /* 探针出口（只读）：stand/city 人偶当前 scale —— 供行为断言用
     （figCache 是闭包变量，测试不能直接读）。 */
  M.figScaleProbe = function () {
    var out = { stand: null, city: null, base: null, dist: M._figDist || null, err: M._fsErr1 || null };
    try {
      if (figCache && figCache.stand && figCache.stand.g) {
        out.stand = figCache.stand.g.scale.x;
        out.base = figCache.stand.g.userData.baseScale || null;
      }
      if (figCache && figCache.city && figCache.city.g) out.city = figCache.city.g.scale.x;
    } catch (eFP) { out.err = String((eFP && eFP.message) || eFP); }
    return out;
  };
  /* 探针出口（只读纯函数）：滚轮曲线与交班衰减 —— 给 smoke 断言用，
     不在别处调用。`_zoomCurveProbe(agl, dy)` 返回"这一格滚到哪"。 */
  M._zoomCurveProbe = function (agl, dy) { return _zoomStepTo(Math.max(0.6, +agl || 0.6), dy == null ? 100 : dy); };
  /* ⛔ v157.74：交班衰减探针随 `_handoffMul` 一起退役 —— 老板
     「滚轮只管高度，不要再自动转移那个相机的方向」，高度不再驱动视线。 */

  /* ============================================================
   * v157.50（老板「62 米阈值处视线仍是硬切，要求全面平滑」）
   * ------------------------------------------------------------
   * 病根：地表分支的视线是**自由向量**（落地 −15°，为了能左右拖），
   *   轨道分支的视线是**看球心**（−90°）。切模式那一帧直接换公式，
   *   实测一格滚轮视线转了 **75°**（−15 → −89.96）。
   * 修法（**交班**而不是切换）：轨道分支每帧算一次"当前视线和看球心的差"
   *   `_hEl`，再乘一条**只与高度有关**的衰减（62 米满值 → 95 米归零）——
   *   于是上行下行共用同一条曲线，天然对称。
   *   于是：刚出地表时画面**一动不动**（差还在），继续拉远才慢慢回正到看球心；
   *   反向滚回来时同理 —— 到 62 米视线正好已经是地表那一套，进地表零跳变。
   * 为什么不在过渡带里直接改 `_surfDir`：那等于"没人操作时程序自己转头"，
   *   v157.34 已经因为这个被否过一次。交班只发生在**滚轮跨阈值**那一刻，边界清楚。
   * ============================================================ */
  function _smoothstep01(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-6, b - a)));
    return t * t * (3 - 2 * t);
  }
  /* ============================================================
   * v157.83（老板「球体不是跟着鼠标走，而是乱滚」）
   * ------------------------------------------------------------
   * 病根：轨道姿态原来用
   *     quat = setFromUnitVectors((0,0,1), dir)
   * —— 那是「把 +Z 转到 dir 的**最短弧**」。它只钉住一个轴，up 是副产物：
   * 绕水平轴转 θ 的同时，相机 up 被同一轴带着转了 θ，于是**画面 roll = 俯角**。
   * 纯数学实测（`.workbuddy/tmp/cam_roll_probe.js`，不依赖渲染）：
   *     pitch 24° → roll 10.3° ｜ 52° → 23.1° ｜ 80° → 39.2° ｜ 越过极点单帧跳 89°
   * 拖动时俯角一直在变 → 倾斜角一直跟着变 → 玩家看到的就是「球自己在乱滚」，
   * 而不是「我拨到哪它跟到哪」。且最短弧在 dir≈−Z 时退化，400 帧里有 30 帧
   * 视线偏出球心（位置对、朝向错）。
   *
   * 正解：**turntable（三脚架）姿态** —— 与 OrbitControls 及所有成熟轨道相机同构：
   *     R = Ry(yaw) · Rx(−pitch) · Rz(roll)
   *   ① 前两项把 +Z 精确转到 dir（视线正对球心），up 由 Ry 保持竖直
   *      → |pitch| < 90° 时 roll ≡ 0：地平线水平，拖动方向 = 内容移动方向；
   *   ② 第三项绕**局部视线轴**滚，不改变 dir（相机位置一点不动）。
   *
   * roll 为什么不能恒为 0：沿经线滚过极点（老板 v157.80 要的「无死角」），
   * 球面上的「上方」必然翻转 180° —— 拓扑事实，躲不掉。两种处理：
   *   · 突变（越极点那帧翻半圈）→ 实测单帧 180°，比现状更丑；
   *   · **分摊**（本版）：pitch 每跨一个极点（90°+180°·n），roll 在 ±14.4° 的
   *     拖动带里用 smoothstep 平滑转 180°，画面像"球从眼前滚过去"，符合物理；
   *     常规拖动（|pitch| < 75°）roll 恒 0，完全跟手。
   * ============================================================ */
  function _camRollOf(pitch) {
    var W = 0.08;                       /* 过渡半宽，单位 π（≈14.4°） */
    var f = pitch / Math.PI;
    var n = Math.floor(f);
    var frac = f - n;                   /* [0,1) */
    if (frac <= 0.5 - W) return n * Math.PI;
    if (frac >= 0.5 + W) return (n + 1) * Math.PI;
    var t = (frac - (0.5 - W)) / (2 * W);
    t = t * t * (3 - 2 * t);            /* smoothstep：两端斜率为 0，无拐点 */
    return (n + t) * Math.PI;
  }
  M._camRollOf = _camRollOf;            /* 暴露给探针/断言核对（纯函数，无副作用） */
  /* 交班衰减窗口：62 米（AGL_SURF+HYST）满值 → 95 米归零。 */
  /* ⛔ v157.74 退役：`_handoffMul(rAlt)` 曾是「按离地高度把视线融合回看球心」的权重
     （62m = 1 → 95m = 0）。它让**滚轮一动画面就自己转**，与老板
     「滚轮只管高度，不要再自动转移那个相机的方向」直接冲突，整条删除。
     现在 `placeCamera` 里 `_lpEff` 只等于玩家自己的 `lookPitch`。 */

  function placeCamera() {    /* ============================================================
     * v156.55（老板「右键的相机，我希望是相机绕球心运动，
     *          而不是在视野内摆弄球体」）—— **回到轨道相机**。
     * ------------------------------------------------------------
     * v156.54 用累积四元数解决了"翻过极点"，但代价是**引入了 roll**：
     *   球会在视野里倾倒、画面会倒过来 —— 那正是老板说的"摆弄球体"。
     * 他要的是轨道相机：**相机绕着球心走，地平线永远水平**。
     *
     * 做法：状态回到 yaw/pitch（欧拉角），朝向用 `rotation.set(pitch, yaw, 0, 'YXZ')`
     *   表达 —— 不走 lookAt，所以 up∥视线时也不会退化抖动。
     *   极点靠**纬度反射**处理（阈值严格取 π/2，见拖动处），
     *   反射后 pitch < π/2，不会每帧反复触发（v156.52 的 bug 是阈值取成 π/2-0.02）。
     *   → 相机始终在球外绕行、up 恒定竖直，翻越极点时经度自动 +180。
     * ============================================================ */
    /* ============================================================
     * v156.59（老板「过了南北轴线就跳转到对面半球…做一个空间中的自由球有这么难吗」）
     * ------------------------------------------------------------
     * 根因：`dir = (cos p·sin y, sin p, cos p·cos y)` 在极点附近 **cos p 变号**
     *   → 水平分量整体反号 → 位置瞬间跳到经度 y+180（画面仿佛闪到对面半球）。
     *   这是球坐标的固有奇点，**再怎么调 p 都消不掉**。
     *
     * 正解：**camO.quat 累积旋转**（真正的空间自由球）。
     *   相机位置方向完全由四元数给出，没有极角/方位角参与，
     *   所以任意方向连续、无奇点。up 跟着转（球会"倾倒"）——
     *   这正是"拿手指拨一个实体球"的手感。没有地平线锁定的概念。
     *   yaw/pitch 只在外部写入时（跳城市 / 正位）用来重建 quat。
     * ============================================================ */
    /* ============================================================
     * v157.50：**滚轮阻尼**（放在状态读取之前 —— 本帧的 d 就用阻尼后的值）
     * ------------------------------------------------------------
     * 滚轮只写 `_zoomTarget`，这里每帧朝它逼近一次：
     *   agl += (target − agl) × (1 − e^(−dt/τ))，τ = 70ms
     * 为什么用时间而不是固定系数：掉帧时固定系数会"变慢"，而这里 60fps / 20fps
     * 都是同样的 70ms 收敛，手感不随帧率变。
     * 收敛到 0.01 米内直接吸附，避免永远差一点点（滑块读数会一直抖）。
     * ⚠️ 外部改 camO.dist 的入口（setZoom / surfaceMode / 探针 / 读档）必须同时写
     *    `_zoomTarget`，否则下一帧会被阻尼拉回旧目标 —— 这是这类动画最常见的坑。
     * ============================================================ */
    (function _zoomDamp() {
      if (_zoomTarget == null) { _zoomTarget = camO.dist - R; return; }
      var nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      var dtMs = _zoomLastT ? Math.min(120, nowMs - _zoomLastT) : 16;
      _zoomLastT = nowMs;
      var agl = camO.dist - R;
      var kk = 1 - Math.exp(-dtMs / 70);
      var nAgl = agl + (_zoomTarget - agl) * kk;
      if (Math.abs(_zoomTarget - nAgl) < 0.01) nAgl = _zoomTarget;
      camO.dist = R + Math.max(0.6, nAgl);
    })();
    /* ⛔ v158.49（老板「为什么拉近地面的时候自动跳回了人物所在地？
       从哪里变动高度就落到哪个位置」）：v158.22 的「地表每帧把 camO 对齐玩家」
       整段删除 —— 拉近落地时相机指向被瞬间拽回人物所在地，高空"转换位置"
       形同虚设。新口径：落点 = 相机当前指向（camO.dir 保持拉近时的值）；
       地表层与机位锚点由 _surfAvatarCam 的锚点驱动（指向处起、玩家移动时才平滑跟随）。 */
    var _yaw = camO.yaw, _pitch = camO.pitch;
    /* v157.101：轨迹球模式下 quat 是**真值**，不许从 yaw/pitch 重建
       （重建会把 roll 与"越过极点"的信息一起抹掉 —— 那就退回转台了）。*/
    var _dirty = M.CAM_TRACKBALL ? !camO.quat
      : (!camO.quat || !camO._euler ||
        Math.abs(_yaw - camO._euler[0]) > 1e-9 || Math.abs(_pitch - camO._euler[1]) > 1e-9);
    if (_dirty) {
      /* v157.83：turntable 姿态（Ry·Rx·Rz），**不再用 setFromUnitVectors**。
         理由见 `_camRollOf` 上方注释 —— 最短弧会把俯角转成画面 roll。
         Euler 'YXZ' = Ry(y)·Rx(x)·Rz(z)，与推导逐项对应。
         dir 由本四元数反算（下一行 applyQuaternion），位置/朝向永远同源。 */
      camO.quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-_pitch, _yaw, _camRollOf(_pitch), 'YXZ'));
      camO._euler = [_yaw, _pitch];
    }
    var _dirV = new THREE.Vector3(0, 0, 1).applyQuaternion(camO.quat).normalize();
    var _dir0 = [_dirV.x, _dirV.y, _dirV.z];
    camO.dir = _dir0;
    /* v157.34：d 的上下限在下方一行定死 —— **下限是常数 `R + 眼高`**。
       历史上这里曾按"周边平均地形高 + 眼高"算下限（见 §退役段），
       那正是"相机跟着地形走"的来源，已整段删除。 */
    /* ============================================================
     * v156.50（老板「相机规定距离地面最低 X 米就好了吧」）——
     * 约束口径从**离球心**改成**离地**。
     * ------------------------------------------------------------
     * 旧版 ZOOM_MIN = R*1.15 是拍出来的一个固定球心距离：
     * 平原上离地约 45、够用；但地形最高约 40 单位（HSC 注释：山≈40），
     * 相机转到山上时离地只剩几个单位 —— 仍会贴地/钻模，只是不如 1.02R 那么明显。
     * 改成按方向取地形高度，强制「离地 ≥ CAM_MIN_AGL」，于是：
     *   · 平原：可以贴得更近（335 vs 345），细节更多；
     *   · 山上：自动抬高（370），不再穿模。
     * 两条下限取较大者，ZOOM_MIN 仍作为绝对兜底（防止地形数据缺失时失控）。
     * ============================================================ */
    var _dir0 = camO.dir;
    /* ⛔ 已退役整段（v157.15 平滑基线 / v157.17 限速硬下限 / v157q 平均+硬下限）：
       它们都在做同一件事 —— **让相机跟着地形走**，只是把"跳"摊成"漂"。
       v157.31 删硬下限、v157.34 连每帧 `elevAvgAt` 一起删：
       现在 placeCamera 不读地形，位置只由 `camO.dist` 决定。 */
    /* ============================================================
     * 一套相机，两种表现（v157b 立 · v157.34 改口径）
     * ------------------------------------------------------------
     * **唯一控制量是半径 `r = d − R`（海拔）** —— 不是离地高度。
     * 为什么改：agl 里含地形高，走过一片山就会自己跨阈值，等于地形在切模式；
     * 半径只受滚轮影响，这才是老板要的"观察窗口不动"。
     * 两种表现由 r 决定：
     *
     *   agl < AGL_SURF(55) → 地面视角，俯角随高度连续变化：
     *       agl = 眼高(1.7) → 注视 40 米外 → 俯角 ≈ 0.3°（**平行于地平面**）
     *       agl = 27        → 注视 20 米外 → 俯角 ≈ 52°
     *       agl = 55        → 注视 0 米    → 俯角 90°（垂直向下）
     *   agl ≥ AGL_SURF     → 轨道视角（看球心、绕球转）
     *
     * 为什么能无缝：agl→AGL_SURF 时注视距离→0，地面视角的极限就是
     * "垂直向下看脚下"，与轨道视角在球面正上方**完全一致** → 过阈值画面不跳。
     *
     * 旧版为什么"总是俯视"：`CAM_MIN_AGL=30` 强制离地至少 30 米，
     * 再叠一个固定 LIFT=19，俯角最低也有 50° 以上 —— 无论怎么拉都压不平。
     * ============================================================ */
    /* v157.31：**半径 = 玩家给的 camO.dist，地形不参与**。
       下限是常数 `R + 眼高`（不是 `R + 地形高`）—— 这是"窗口不动"的唯一来源。 */
    var _minD = R + (M.SURF_EYE || 1.7);
    var d = Math.max(_minD, Math.min(M.ZOOM_MAX, camO.dist));
    camO.dist = d;
    /* _agl 仍是"离地高度"，但只用于两件事：①俯角/注视距离 ②探针与界面读数。
       它**不再**参与位置与模式判定（地形一高它就变，参与判定就会跳模式）。 */
    /* 读数：`_agl` 退化为"海拔"（= d−R）的别名，真正离地高度按需用 `M._aglOf()`。
       这样即使是探针误用，也不会把地形重新带回每帧路径。 */
    var _agl = _rAlt;
    var _rAlt = d - R;                 /* 海拔（球心距离 − 海平面半径）：稳定量 */
    M._agl = _agl;                     /* 离地高度（含地形）—— 只给探针/俯角用，不参与位置与模式 */
    M._rAlt = _rAlt;                   /* v157.31：海拔（d − R）—— 位置/模式/地表淡出都读它，地形高不影响 */
    /* v157.89：起伏明暗**随高度淡出**。
       它服务的是"看整颗星球"那一档；贴地时地形细节归地块层，而逐顶点明暗被放大后
       在近景会变成"刷痕"状条纹（实机 zoom0.13 取证）。淡出口径写在 M.RELIEF_AGL_*。*/
    if (M._reliefU) {
      var _rF = (_rAlt - (M.RELIEF_AGL_ZERO || 210)) /
                ((M.RELIEF_AGL_FULL || 520) - (M.RELIEF_AGL_ZERO || 210));
      _rF = _rF < 0 ? 0 : (_rF > 1 ? 1 : _rF);
      M._reliefU.value = (M.RELIEF_BASE == null ? 1 : M.RELIEF_BASE) * _rF;
      M._reliefFade = _rF;             /* 探针/自检读数 */
    }
    /* 模式判定必须用 **d（球心距离）**，不能用 agl ——
       agl 里含地形高度，而地形随视角变：站在山顶 dist 不变、agl 却会掉到 20 以下，
       于是"没动滚轮，模式自己跳了"。d 只受用户操作影响，才是稳定的判据。
       +20 是给地形高留的余量（HSC 注释：山≈40，取半档）。 */
    /* v157.17：判据从 **d（球心距离）** 改成 **agl（离地高度）** 并加**滞回**。
       旧写法 `d < R + 55 + 20` 里的 20 是"给地形高留的余量"——可地形高度在
       0~40 之间浮动，等于同一个滚轮位置在不同地形上会**换个时刻**进/出地表模式，
       玩家看到的就是"滚到某一档，画面忽然换了套相机"。
       现在：进 = 离地 55 米，出 = 离地 62 米（`AGL_HYST`），离地高度是唯一口径，
       判据只读半径 → 不随视角/地形抖。 */
    var _aglIn = (M.AGL_SURF || 55);
    var _aglOut = _aglIn + (M.AGL_HYST == null ? 7 : M.AGL_HYST);
    /* v157.31：判据从 agl 改成 **半径**（`_rAlt` = d − R）。
       agl 里含地形高，走过一片山就会自己跨阈值 → "没滚轮，模式却变了"。
       半径只受滚轮影响，这是原地形判据想达到、但没达到的东西。 */
    /* ============================================================
     * v158.56：**起飞/降落程序期间禁用自动地表切换**。
     * ------------------------------------------------------------
     * 起飞点离地只有 ~8.5m（< 55m 阈值），若不豁免，placeCamera 下一帧
     * 就把它判回地表 → 战舰收起、程序被 _tickFlight 的 _surf 守卫打断
     * （探针⑥实测 phase takeoff→dock、Δalt=0）。降落同理：程序降到
     * 55m 以下时会被提前判进地表，半空换相机。
     * 现在由程序独占这段过渡，落地那一刻由 _tickProgram 显式
     * surfaceMode(true) 交班 —— 进出地表只剩一个出口。
     * ============================================================ */
    /* ============================================================
     * v158.59（老板「不允许有高空和地面之分，这是一个连续的空间」）
     * ------------------------------------------------------------
     * 旧判据是"按半径派生"：<55m 进地表、<62m 出 —— 60-40 段之所以跳，
     * 根子就是这里有一个**二元开关**。
     * 现在：只要还在飞行器上（fly.active），就**永不切地表**，高度怎么变
     * 都只是一段连续运动；进地表只有一个入口 —— 下机（M.flyExit）。
     * ============================================================ */
    var _onShip = !!(M._fly && M._fly.active);
    var _surfNow = _onShip ? false
      : (M._surf ? (_rAlt < _aglOut) : (_rAlt < _aglIn));
    var _enterSurfNow = false;
    if (_surfNow !== M._surf) {
      /* v157.50：**出地表那一刻记交班**（进地表的接手在下方地表分支里做）。 */
      /* v157.50：本帧是否"刚进地表"（只在切换这一帧做初始化，之后玩家自由转）。 */
      _enterSurfNow = (!M._surf && !!_surfNow);
      try { _applySurf(_surfNow); } catch (eAS) { }
    }
    cam.position.set(d * _dir0[0], d * _dir0[1], d * _dir0[2]);
    if (_surfNow) {
      M._surfVis = true;                 /* v157.31：给轨道分支留"刚离开地表"的标记 */
      var _upV = new THREE.Vector3(_dir0[0], _dir0[1], _dir0[2]);
      /* ============================================================
       * v157.25（老板：「右键到 270 度就向上垂直天空、向后下后方，
       *          就是平行于地面，没办法 360 度无死角」）
       * ------------------------------------------------------------
       * 上一版（v157.20/24）用**一个俯仰角 p** 驱动：
       *      lookV = head·cos p − radial·sin p
       *      up    = radial·cos p + head·sin p
       * 数学上 p 能转满 2π、两者恒正交（实测 5°/步无停滞），但**观感是错的**：
       *   · up 跟着 p 一起翻 → p 过 90°（天顶）后画面**整体倒转**；
       *   · 倒转之后"往上拖"在屏幕上变成"往下走"，手感立刻错乱；
       *   · 而 p 还要在 ±π 折回，玩家看到的是一次次"转到头又回来"。
       * 所以"270 度就卡住 / 到平行地面为止"的真实来源不是角度不够，是**画面在翻**。
       *
       * 正解（真正的第一人称自由视角）：
       *   状态只存**视线方向 `_surfDir`**（单位向量），转角用四元数增量累积，
       *   **永不折回、永不夹** —— 想转几圈转几圈。
       *   每帧现算基向量：
       *       right = d × radial      （见 _surfRightOf）
       *       up    = right × d
       *   于是 up 恒 ⟂ 视线、地平线恒水平，画面绝不倒转；
       *   抬头越过天顶只是"继续往后看"，不是"翻过来"。
       * ============================================================ */
      /* ---- 1. 初始化：**从上一帧真实相机取**，这是零跳变唯一的来源 ---- */
      var _prevF = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      /* v157.48：先看能不能**原样复用**上一次离开时的视线（纯缩放往返） */
      /* 复用判据：**只要上一次的视线还在就复用**。
         不再比"机位有没有动" —— 那个判据在"缩放来回蹭阈值"时会时真时假，
         于是往返残差时有时无（实测 2.5° 间歇出现）。换地方的失效交给平移那条路
         （轨道里左键拖动 = 换地方 → 主动清空视线）。 */
      var _reuse = !!M._surfDir;
      if (false) {
        try {
          var _upR2 = new THREE.Vector3(_dir0[0], _dir0[1], _dir0[2]).normalize();
          var _p0 = new THREE.Vector3(M._surfAnchor.pos[0], M._surfAnchor.pos[1], M._surfAnchor.pos[2]);
          var _f0 = new THREE.Vector3(M._surfAnchor.fwd[0], M._surfAnchor.fwd[1], M._surfAnchor.fwd[2]);
          var _fNow = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
          /* 只比**机位**（<1.2° ≈ 6 米）。不能比朝向：拉到轨道后相机是按"看球心"
             摆的，那个朝向和地表视线本来就差着一大截 —— 拿它当判据，复用永远不成立，
             于是每次缩放往返都要重新推 yaw，而"看球心"时切向分量≈0 → yaw 是任意的
             （实测往返偏 104°）。 */
          /* 阈值 6°（≈31 米）：只缩放不平移时必然命中；真平移过（十字拖拽几十米）就不成立。 */
          _reuse = (_p0.dot(_upR2) > Math.cos(6 * Math.PI / 180));
        } catch (eRU) { _reuse = false; }
      }
      /* ============================================================
       * v157.50：进地表**一律从"当前真实视线"接手**（不再复用上次的 _surfDir）。
       * 为什么改：从 62 米滚进来时，画面此刻是"看球心（−90°）"或交班中的角度看，
       *   而旧逻辑一进门就强设 −15°，等于**落地瞬间被弹了一下**（实测 75°/格）。
       *   现在"上一帧看到哪，进来就看哪" —— 这是零跳变唯一的来源。
       * 例外：视线太陡（< −65°，几乎垂直看脚下）时，左右拖会是空操作（v157.48 的
       *   老问题），此时才抬到 −15°，并保留 220ms 过渡（那是操作必需，不是装饰）。
       * ============================================================ */
      var _uE = new THREE.Vector3(_dir0[0], _dir0[1], _dir0[2]).normalize();
      var _elPrev = Math.asin(Math.max(-1, Math.min(1, _prevF.clone().normalize().dot(_uE))));
      var _tooSteep = _elPrev < (-65 * Math.PI / 180);
      /* ⚠️ 初始化**只能做一次**（刚进地表那一帧 / 或还没有视线时）。
         写成"每帧都进这个分支"会每帧重置 _surfDir 与 tilt（实测视线永远停在 from）。 */
      if (!_enterSurfNow && M._surfDir) {
        /* 地表停留期间：什么都不做 —— 视线归玩家（v157.34 的"程序不自己动"）。
           唯一例外在下面两个初始化分支里。 */
      } else if (!_tooSteep) {
        _surfTilt = null;
        M._surfDir = _prevF.clone().normalize();
        M._surfRight = new THREE.Vector3().crossVectors(M._surfDir, _uE).normalize();
        M._surfAnchor = null;
        camO.lookYaw = 0; camO.lookPitch = 0;
        M._surfHold = false;
        M._entryDbg = { mode: 'handoff', elPrev: +(_elPrev * 180 / Math.PI).toFixed(2), tilt: false };
      } else if (_reuse && !M._surfDir) {          /* 只在"刚进地表、还没有视线"这一刻复用一次 */
        _surfTilt = null;
        M._surfRight = new THREE.Vector3().crossVectors(
          M._surfDir.clone().normalize(),
          new THREE.Vector3(_dir0[0], _dir0[1], _dir0[2]).normalize()).normalize();
        M._surfAnchor = null;               /* 一次性：用完作废，避免每帧重复判定 */
      } else {
        /* v157.31：进地表时把轨道的 lookYaw/lookPitch 清零 ——
           它的分量已经烘进 `_prevF`（屏幕方向不变），再留着就会两套叠加。 */
        camO.lookYaw = 0; camO.lookPitch = 0;
        M._surfHold = false;                       /* 上一次离开时的"用户接管"标记别带进来 */
        /* ---- v157.60：去除「进地表自动转向水平」 ----
           老板：「相机接近地面时，去除相机自动转向水平这个功能。滚轮只负责高度，右键负责角度」。
           即：进入地表**保留玩家进入前的真实视角**（_prevF），不再把俯角强制抬到 -15°（近水平）。
           滚轮只改离地高度、右键（转头）负责角度，朝向完全交给玩家。
           唯一保留：当进入视角近乎垂直看地（el < -80°）时，夹到 -80° 上限 ——
           仅为避免「切向分量≈0 → 左右拖是空操作」的退化态；这是防奇异点，不是转向水平（俯角仍很陡）。 */
        _surfTilt = null;                          /* v157.60：不再构造任何自动过渡 */
        var _dPrev = _prevF.clone().normalize();
        var _elPrevFix = Math.asin(Math.max(-1, Math.min(1, _dPrev.dot(_uE))));
        if (_elPrevFix < (-80 * Math.PI / 180)) {
          var _hFix = _dPrev.clone().addScaledVector(_uE, -_dPrev.dot(_uE));
          if (_hFix.lengthSq() < 1e-6) _hFix.set(1, 0, 0).addScaledVector(_uE, -_uE.x);
          _hFix.normalize();
          var _elFix = -80 * Math.PI / 180;
          _dPrev = _hFix.clone().multiplyScalar(Math.cos(_elFix)).addScaledVector(_uE, Math.sin(_elFix)).normalize();
        }
        M._surfDir = _dPrev;
        M._surfRight = new THREE.Vector3().crossVectors(M._surfDir, _uE).normalize();
        M._surfAnchor = null;                      /* 不记强制锚：保留真实视角，往返不强制重推导 */
        M._entryDbg = { mode: 'handoff', elPrev: +(_elPrev * 180 / Math.PI).toFixed(2),
          elFix: +(_elPrevFix * 180 / Math.PI).toFixed(2), tilt: false,
          clamp: _elPrevFix < (-80 * Math.PI / 180) };
      }
      /* 过渡推进（只在落地那一瞬间存在；用户一动就放弃） */
      if (_surfTilt) {
        var _kt = (Date.now() - _surfTilt.t0) / (_surfTilt.dur || 220);
        if (_kt >= 1) {
          /* ⛔ 收尾必须**落到 to**：只把定时器清掉的话，最后一帧可能停在 k=0.5，
             视线就永远卡在中间（实测停在 el −29° 而不是 −15°）。掉帧时更明显。 */
          M._surfDir = _surfTilt.to.clone().normalize();
          _surfTilt = null;
        } else if (M._surfHold) {
          _surfTilt = null;                       /* 用户接管：让位 */
        } else {
          var _ke = _kt * _kt * (3 - 2 * _kt);
          M._surfDir = _surfTilt.from.clone().lerp(_surfTilt.to, _ke).normalize();
        }
      }
      var _d0 = M._surfDir.clone().normalize();

      /* ⛔ v157.34（S2 · 计划 20261110-相机统一模型）：**自动抬头已删**。
         ------------------------------------------------------------
         它每帧把视线往水平方向抬 0.02 弧度（≈1.1°/帧），本意是 v157b 要的
         "落地尽量平行于地平面"。但代价是：**只要停手，画面就一直在自己动**——
         老板说"观察窗口不动"，这条自动运动恰好是唯一一个"程序在无人操作时改画面"的地方。
         现在的口径：**位置与朝向都只由玩家改**。想平视就上下拖一下；不拖就永远保持。
         `_aglPrev` / `_settleN` 随之退役（原本只服务这条自动抬头）。 */

      /* ---- 3. 基向量：right 是**契约向量**（只投影回 ⟂ d），up = right × d ----
         这样 up 恒 ⟂ 视线、且随 d 平滑转动 —— 越过天顶不会翻画面，也不会退化。 */
      var _right = _surfRightOf(_d0, _upV);
      var _upCam = new THREE.Vector3().crossVectors(_right, _d0);
      if (_upCam.lengthSq() < 1e-9) _upCam.copy(_upV);
      _upCam.normalize();
      M._surfRight = _right.clone();          /* 存回来（正交化后的），下一帧继续用 */

      /* S1/S2：投影距离/俯角**只读海拔**（`_rAlt = d − R`），地形不进派生量。
         这样同一滚轮位置走过山坡，画面里的俯角不会跟着地形变。 */
      var _lookD = lookDistAt(_rAlt);
      var _pit = Math.asin(Math.max(-1, Math.min(1, -_d0.dot(_upV))));
      /* 探针：只在调用过 `_camU()` 后记录（正式运行零开销） */
      if (M._dbgWant) M._dbgSurf = {
        agl: (M._aglOf ? M._aglOf() : +_agl.toFixed(2)),
        pit: +(_pit * 180 / Math.PI).toFixed(1),        /* >0 低头看地 · <0 抬头看天 */
        lookD: +_lookD.toFixed(2), settle: 0, hold: !!M._surfHold,
        upV: [+_upV.x.toFixed(5), +_upV.y.toFixed(5), +_upV.z.toFixed(5)],
        dir: [+_d0.x.toFixed(5), +_d0.y.toFixed(5), +_d0.z.toFixed(5)],
        right: [+_right.x.toFixed(5), +_right.y.toFixed(5), +_right.z.toFixed(5)],
        upCam: [+_upCam.x.toFixed(5), +_upCam.y.toFixed(5), +_upCam.z.toFixed(5)]
      };
      cam.up.copy(_upCam);
      cam.lookAt(
        cam.position.x + _d0.x * 24,
        cam.position.y + _d0.y * 24,
        cam.position.z + _d0.z * 24
      );
      /* ============================================================
       * v158.22（老板「操控一小人走在地面上」）：星露谷式跟随接管
       * ------------------------------------------------------------
       * 上面那套是"第一人称站在地上自己看"，玩家看不到自己。
       * 老板要的是星露谷：**镜头在角色斜上方、看着角色**。
       * 所以这里最后覆盖机位（position / up / lookAt），
       * 轨道与地表的其余逻辑一个字不改 —— 失败就落回原来的第一人称。
       * ============================================================ */
      if (M.SURF_AVATAR !== false) {
        try {
          if (M._surfAvatarCam()) { cam.updateMatrixWorld(); return; }
        } catch (eSC22) { }
      }
      cam.updateMatrixWorld();
      return;
    }
    cam.position.set(d * _dir0[0], d * _dir0[1], d * _dir0[2]);
    /* ============================================================
     * v157.81：**相机方向连续性守卫**（运行时，不是测试）
     * ------------------------------------------------------------
     * 相机方向每帧只允许小步变化。任何让它单帧跳 >30° 的改动都会记进
     * `M._camJumps`（带 surf / rAlt 上下文，便于区分预期跳变）。
     * 滚轮缩放、切城、进出地表属预期跳变，也会被记下来。
     * 意义：以后谁再往这条链路里塞"每帧反算 / 夹取 / 归一化"，
     *       不用等玩家投诉，`M._camJumps` 里直接就有证据。
     * ============================================================ */
    if (M._camPrevDir) {
      var _jd0 = _dir0[0] * M._camPrevDir[0] + _dir0[1] * M._camPrevDir[1] + _dir0[2] * M._camPrevDir[2];
      var _ja0 = Math.acos(Math.max(-1, Math.min(1, _jd0))) * 180 / Math.PI;
      if (_ja0 > (M.CAM_JUMP_MAX || 30)) {
        M._camJumps = M._camJumps || [];
        if (M._camJumps.length < 60) {
          M._camJumps.push({
            deg: Math.round(_ja0 * 10) / 10,
            surf: !!M._surf,
            rAlt: Math.round(_rAlt * 10) / 10
          });
        }
      }
    }
    M._camPrevDir = [_dir0[0], _dir0[1], _dir0[2]];
    /* 回到轨道相机：清掉地表状态的航向/俯仰 —— 下次进入必须重新从真实相机取，
       否则会拿"上次离开时"的旧航向，又是一次跳变。 */
    /* 地表视线是**自由向量**（可以绕好几圈），切回轨道相机前必须换算成它的欧拉角，
       否则会拿"上次离开时"的旧姿态，又是一次跳变。轨道是"绕球心看球"，
       所以把方向折算回 yaw/pitch 即可（roll 丢掉 —— 轨道相机本来就没有 roll）。 */
    /* ⛔ v157.48（老板「地面放大缩小还有位置跳变」）：这一段的**量纲用错了**。
       `camO.yaw/pitch` 在轨道模式里定义的是**相机站在球的哪个方向**（位置），
       可这里塞进去的是**视线朝向** `_surfDir` —— 于是"从地面拉远"时，
       相机被摆到了"视线指的那一侧"，也就是**星球另一面**（实测往返位置翻到对侧）。
       正解：位置仍用径向 `camO.dir`（人还在原地，只是升高），
       视线偏移（lookYaw/lookPitch）清零 —— 拉远 = 退回太空看这颗球，看球心是自然的。
       原来那条"把视线折算成欧拉角"的注释本身没错，错在把位置量和朝向量混成了一个。 */
    /* ⛔ v157.81：这里原有 `if (camO.dir && M._surfVis === true) { camO.pitch = asin(...) }`
       —— 整段**物理删除**，不是加条件。
       ------------------------------------------------------------
       它自 v157e 起就在，名义作用是"从地表退回轨道时把径向折算成欧拉角"。但这条理由
       在 v157.48 就失效了：现在地表模式全程**不碰** `camO.yaw/pitch`
       （只改 `_surfDir` / `cam.position` / `cam.up`），所以退出地表时 pitch/yaw
       本来就是进去时的值，根本不需要重算。
       留着的唯一后果：`asin` 主值域 [−π/2, π/2] 把玩家累加出的 pitch 折回 ——
       一旦任何路径让它每帧执行（v157.78 就是这样），滚过极点就变成"来回打转"。
       实测证据：pitch 稳停 −1.592，130 帧累加 3.25 弧度一步未生效。
       现在整段删掉 —— 相机姿态只有一个来源：输入（拖动 / 滚轮 / 外部定位）。 */
    var _wasSurfV = (M._surfVis === true);
    M._surfVis = false;
    _surfTilt = null;              /* v157.48：离开地表，落地过渡作废 */
    /* ⛔ v157.48（老板「地面放大缩小还有位置跳变」的真凶）：
       原来离开地表就把 `_surfDir` 清掉，下次进来只能从"轨道正对球心"重新推 yaw ——
       而正对球心时切向分量≈0，推出来的朝向是**任意的**。实测往返一次视线偏 104°。
       现在：**留着**，并记下离开时的机位与朝向；下次进来若这两者都没怎么动，
       就直接复用（纯缩放往返 = 原样回来，零跳变）。 */
    if (_surfTilt && _surfTilt.to) M._surfDir = _surfTilt.to.clone();
    M._surfAnchor = (M._surfDir && camO.dir)
      ? { pos: [camO.dir[0], camO.dir[1], camO.dir[2]],
          fwd: (function () { var f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); return [f.x, f.y, f.z]; })() }
      : null;
    M._surfHold = false;
    /* ============================================================
     * ⛔ 修 bug（v157.31 · 老板「高空那个右键的视角转换功能丢失了」）
     * ------------------------------------------------------------
     * 这两行原来是**每帧无条件清零**：
     *     camO.lookYaw = 0; camO.lookPitch = 0;
     * 而右键拖动的结果正是写进这两个数（见 mousemove 的轨道分支）。
     * 于是"写进去 → 同一帧被清零 → 渲染时偏移恒为 0" —— 高空右键永远没反应，
     * 地面分支不走这段代码，所以只有地面能用。这就是老板说的"高空丢失"。
     * 正解：只在**地表 → 轨道的切换那一帧**清一次（防两套叠加），平时绝不碰。
     * ============================================================ */
    if (_wasSurfV) { camO.lookYaw = 0; camO.lookPitch = 0; }
    /* ============================================================
     * v156.47 自由相机：朝向与位置**解耦**
     * ------------------------------------------------------------
     * 原来是 cam.lookAt(0,0,0) —— 视线永远钉在球心，贴地只能俯视。
     * 现在用等价的欧拉角（YXZ）表达「看球心」，再叠加 lookYaw/lookPitch 偏移：
     *   · 偏移为 0 时与 lookAt(0,0,0) **逐位等价**（推导见下，已截图对拍）；
     *   · 偏移非 0 时视线脱离球心，能看地平线/天空。
     * 等价性：视向 d = -position/|position|；yaw = atan2(dx, dz)（相机看 -Z），
     *         pitch = asin(dy)（pitch>0 为抬头）。
     * ============================================================ */
    var _L = Math.hypot(cam.position.x, cam.position.y, cam.position.z) || 1;
    /* v156.54：直接吃四元数（含 roll）——不用欧拉分解，极点也不会翻车。
       自由视线偏移（lookYaw/lookPitch）作为**局部**增量左乘在相机自身朝向上。 */
    /* v156.58：x 用 -asin(dir.y) 现算 —— 它对任意 pitch 都自动折回 [-90°,90°]，
       和 dir 永远一致，不会出现角度超界导致画面翻转。 */
    var _pFromDir = -Math.asin(Math.max(-1, Math.min(1, _dir0[1])));
    /* v156.55：回到**欧拉角 + 固定 up**（无 roll）。
       用 rotation.set 而不是 lookAt —— up∥视线时 lookAt 会退化抖动，
       直接设角度没有这个问题。lookYaw/lookPitch 仍作为叠加偏移保留（中键转头用）。 */
    /* v156.56：**yaw 少了 180°** —— 之前写成 atan2(-dx, -dz)，视线正好背对球心，
       于是拖动时相机在转、画面里却只有太空（球整个跑到背后）。
       推导：相机默认看 (0,0,-1)，绕 Y 转 yaw 后看 (-sin, 0, -cos)；
       要看向 v = -dir，即 sin(yaw)=dir[0]、cos(yaw)=dir[2] → yaw = atan2(dir[0], dir[2])。 */
    /* v156.59：直接用四元数（含 roll）——球可以自由倾倒，这才是"空间中的自由球"。
       lookYaw/lookPitch 作为**局部**偏移左乘（中键转头用）。 */
    cam.quaternion.copy(camO.quat);
    /* ⛔ v157.74（老板 2026-11-16「滚轮只管高度，不要再自动转移那个相机的方向」）：
       v157.50 的**交班偏移**（`_hEl`）整条退役 —— 它按离地高度把视线从地表方向
       连续融合回「看球心」（62m 满值 → 95m 归零），于是**滚轮一动，画面自己就转**。
       现在 `_lpEff` 只等于玩家自己的 `lookPitch`，没有任何高度驱动的项：
         · 滚轮 → 只改 `camO.dist`；· 朝向 → 只有右键能改。
       ⚠️ 退役的是「按高度渐变」这一条；进退地表那一刻的方向交接仍保留（见上方
          `_surfDir` / `_prevF` 分支），那是**模式切换**、不是滚轮转向。 */
    var _lpEff = camO.lookPitch;
    if (M._fly && M._fly.active && !M._surf && M._fly.pos && M._fly.head && cam.lookAt) {
      /* ============================================================
       * v158.56（老板「飞行器和相机分离。相机总是在飞行器的尾端或者人物的
       *   背部。飞行器应该在屏幕的下 2/5 我要在正中间」）
       * ------------------------------------------------------------
       * 旧版（v158.53）相机 up = 机体 up，滚转时**整个画面跟着翻** ——
       * 玩家看到的是"世界在转"，不是"飞行器在滚"。这就是"没分离"。
       * 现在：
       *   ① 位置永远吊在尾端（沿 -head 后退 BACK，再沿相机 up 抬 UP）；
       *   ② 相机 up = 星球径向为骨 + 机体 up 只掺 CAM_MIX —— 滚转在画面里
       *      看得见（机体真的翻），画面本身只轻微倾斜，不会天旋地转；
       *   ③ 战舰屏幕纵向精确落在 FLY_SCREEN_Y（下方 2/5）、水平正中：
       *      先定机位，再让视线绕 right 轴抬 θ，θ = atan(ny·tan(fov/2))。
       *      right = cross(Δ, camUp) 由右手定则确定，水平分量恒 0 →
       *      自动居中，不靠试参数。θ 的推导：视线抬高 θ，物体会落到
       *      画面下方 tanθ/tan(fov/2) 的归一化位置。
       * ============================================================ */
      var _sp = _flyVec(M._fly.pos);
      var _hd = _flyVec(M._fly.head).normalize();
      var _rad = _sp.clone().normalize();
      var _mechUp = M._fly.up ? _flyVec(M._fly.up).normalize() : _rad.clone();
      var _camUp = _rad.clone().addScaledVector(_mechUp, (M.FLY_CAM_MIX == null ? 0.3 : M.FLY_CAM_MIX));
      if (_camUp.lengthSq() < 1e-8) _camUp.copy(_rad);
      _camUp.normalize();
      /* 姿态分离的兜底：径向与机体 up 反向（倒飞）时也别让 up 退化 */
      if (_camUp.dot(_rad) < 0) _camUp.copy(_rad);
      /* v158.58：机位沿**滞后尾向** camTail（不是 −head）——
         A/D 转向时相机慢半拍，飞行器才会在画面里偏出去。 */
      var _tailV = M._fly.camTail ? _flyVec(M._fly.camTail) : _hd.clone().negate();
      if (_tailV.lengthSq() < 1e-8) _tailV.copy(_hd).negate();
      _tailV.addScaledVector(_rad, -_tailV.dot(_rad));
      if (_tailV.lengthSq() < 1e-8) _tailV.copy(_hd).negate();
      _tailV.normalize();
      cam.position.copy(_sp).addScaledVector(_tailV, (M.FLY_CAM_BACK || 26))
        .addScaledVector(_camUp, (M.FLY_CAM_UP || 6));
      /* 从相机指向战舰的方向 Δ，再绕 right 抬 θ → 战舰落到 FLY_SCREEN_Y */
      var _delta = _sp.clone().sub(cam.position);
      var _dlen = _delta.length();
      var _dn0 = (_dlen > 1e-6) ? _delta.clone().multiplyScalar(1 / _dlen) : _hd.clone();
      /* ============================================================
       * v158.57（实机图 v15857-C 抓出）：俯冲/降落时机头压向球心
       *   （仰角 −73°），相机 up（径向）与视线几乎平行 → `cross(Δ, up)`
       *   和 `lookAt` 同时退化，**战舰直接从画面消失**。
       *   视线与 up 近平行时改用**机体 up**做相机上方向（它与 head 正交，
       *   俯冲时仍非退化），天空/地面朝向依然正确。
       * ============================================================ */
      if (Math.abs(_dn0.dot(_camUp)) > 0.97) {
        _camUp.copy(_mechUp).addScaledVector(_dn0, -_mechUp.dot(_dn0));
        if (_camUp.lengthSq() < 1e-6) _camUp.crossVectors(_dn0, new THREE.Vector3(0, 1, 0));
        if (_camUp.lengthSq() < 1e-6) _camUp.set(1, 0, 0);
        _camUp.normalize();
      }
      cam.up.copy(_camUp);
      var _rightAx = new THREE.Vector3().crossVectors(_dn0, _camUp);
      if (_rightAx.lengthSq() < 1e-8) {
        _rightAx.crossVectors(_dn0, new THREE.Vector3(0, 1, 0));
        if (_rightAx.lengthSq() < 1e-8) _rightAx.set(1, 0, 0);
      }
      _rightAx.normalize();
      var _fovR = (cam.fov || 55) * Math.PI / 180;
      var _sy = (M.FLY_SCREEN_Y == null ? 0.66 : M.FLY_SCREEN_Y);
      var _ny = (_sy - 0.5) * 2;
      var _theta = Math.atan(_ny * Math.tan(_fovR * 0.5));
      var _lookDir = _dn0.clone().applyAxisAngle(_rightAx, _theta).normalize();
      var _tg = cam.position.clone().addScaledVector(_lookDir, (M.FLY_CAM_LOOK || 1200));
      cam.lookAt(_tg);
      M._flyCam = { pos: cam.position.toArray(), up: _camUp.toArray(),
                    tail: _tailV.toArray(), look: _lookDir.toArray(),
                    screenY: _sy, theta: _theta };
    } else {
      cam.quaternion.copy(camO.quat);
      if (camO.lookYaw || _lpEff) {
        cam.quaternion.multiply(new THREE.Quaternion().setFromEuler(
          new THREE.Euler(Math.max(-1.55, Math.min(1.55, _lpEff)), camO.lookYaw, 0, 'YXZ')));
      }
    }
    cam.updateMatrixWorld();
    /* 远到 50R（=15000）时，旧的 far=6000 会把星球整个裁掉 —— 按距离动态给足余量；
       near 同步抬高，否则 near=1 / far=33000 的深度精度会把球面打成 z-fighting。 */
    /* ============================================================
     * v156.47 近景补光（自由相机的必要配套）
     * ------------------------------------------------------------
     * 这个场景的光照是按「从外面看整个星球」调的：主光是方向光（3.2），
     * 环境光只有 0.34。远景时看到的是球的一大片（总有受光面），所以亮；
     * **贴地时只看得到一小块，一旦背对太阳就只剩 0.34 环境光 —— 实测几乎全黑**，
     * 只有省界细线还看得见。
     * 这里按距离线性补环境光/半球光（贴地最亮），模拟近地表的大气散射。
     * 远处回到原值，远景观感一字不动。
     * ============================================================ */
    var _nearK = Math.max(0, Math.min(1, 1 - (d - M.ZOOM_MIN) / (R * 1.15)));
    if (M._amb) M._amb.intensity = 0.34 + 0.62 * _nearK;
    if (M._hemi) M._hemi.intensity = 0.28 + 0.46 * _nearK;
    var far = Math.max(6000, d * 2.4), near = Math.max(1, d * 0.002);
    if (Math.abs(cam.far - far) > 1 || Math.abs(cam.near - near) > 0.01) {
      cam.far = far; cam.near = near; cam.updateProjectionMatrix();
    }
  }

  M.render = function (target2d) {
    try { ensure(); } catch (e) { M.enabled = false; return false; }
    var cw = target2d.width, ch = target2d.height;
    if (wcv.width !== cw || wcv.height !== ch) { wcv.width = cw; wcv.height = ch; R3.setSize(cw, ch, false); cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
    /* v90.78（老板「换星球后地图没变」）：**星球身份**变（种子/规格/细分）→ 强制重建几何。
       v90.81：规格含全部要素（大陆数/山脉成因/海深/恒星色温…）→ 序列化比对。 */
    var _pver = M._pverOf();
    if (_pver !== M._pver) {
      M._pver = _pver; built = false; M._mkVer = null; M.region = null; M.clearBeam();
      if (M._sun && SP.PLANET && SP.PLANET.starColor != null) M._sun.color.setHex(SP.PLANET.starColor);   /* 恒星色温 → 光色 */
    }
    if (!built) { buildGlobe(); buildTiles(TILE_SUB); buildRegions(); buildMarkers(); buildFlags(); buildMarchArrows(); built = true; }
    /* v92：迷雾层 —— 探明度一变就重建（行军点亮 / 侦查 / 占城都会推 ver）。
       放在 built 之后：换星球时 buildTiles 换了 cells，雾层必须跟着重量。 */
    var _fv = GAME.fog ? GAME.fog.ver() : 0;
    if (_fv !== M._fogVer) {
      M._fogVer = _fv; buildFog();
      M._mkVer = null;   /* 迷雾变了 → 标记/浮名的可见集也变了，下一行强制重建 */
    }
    buildWonder();   /* v91.30：奇观天体（按当前地图星球 · 幂等） */
    /* v152c：首帧时地块还没建，focusOnCell 记了 pending —— 这里补上（只补一次） */
    if (M._pendingFocus != null) { var _pf = M._pendingFocus; M._pendingFocus = null; try { M.focusOnCell(_pf); } catch (ePF) {} }
    /* v90.81（老板 4 · L0 自转）：地图页静止 10s 无操作 → 星球按 PLANET.spinSec 自动旋转。
       见下方 insetInterval 驱动器（每 33ms 步进 + 重绘）。 */
    if (M._lastAct == null) M._lastAct = Date.now();
    /* ⛔ v157.85：这里是 v152d/v92.241b「前传期相机贴着君主那一格」的软约束 ——
       前传退役后**相机距离只由滚轮决定**（与 v157.74「滚轮只管高度」同一口径），
       整段删除。 */
    M._focus = null;                                      /* 兼容壳：任何残留都清掉 */
    _updateWind();                                        /* v157l：风场时间轴/阵风/风向 */
    /* v158.28：边缘推镜要在 placeCamera **之前**跑，当帧就生效（否则慢一帧）。 */
    /* ⚠️ 三件事各自 try：原来挤在一个 try 里，前面一段抛错会把后面**整段跳过**
       —— 实测 F2 性能条停在 0fps、尘土也不出现，就是被同一个 catch 吞了。 */
    var _epNow = Date.now();
    var _epDt = Math.min(0.05, (_epNow - (M._epAt || _epNow - 16)) / 1000) || 0.016;
    M._epAt = _epNow;
    try { _tickEdgePan(_epDt); } catch (eEP1) { if (!M._epErr1) { M._epErr1 = String(eEP1 && eEP1.message); } }
    /* v158.43：高空 WASD 飞行（纯相机惯性飞行）—— 也在 placeCamera 之前跑，当帧生效 */
    try { _tickFlight(_epDt); } catch (eFL1) { if (!M._flErr1) { M._flErr1 = String(eFL1 && eFL1.message); } }
    /* v158.53：飞行 HUD 已移到 placeCamera **之后**（纯 UI 呈现，不需要在
       相机前跑；也保住 §616②「edgePan → placeCamera 当帧距离 <2000」的结构判据，
       不放宽断言）。_flyNav 由上方 _tickFlight 写，位置无关。 */
    /* v158.46：相机高度 HUD —— 海拔口径（老板拍板：dist−R，不含地形）；
       sig 去重（取整变化才写 DOM）。v158.46c（老板「不要占据用户的心智」）：
       **高度变化时显示，静止 3 秒自动淡出** —— 实时在需要时给，静止不占屏 */
    try {
      if (GAME.ui && GAME.ui.renderAltHud) {
        var _ag46 = M._rAlt != null ? M._rAlt : (camO.dist - R);
        var _sig46 = Math.round(Math.max(0, _ag46));
        var _now46 = Date.now();
        if (_sig46 !== (M._altHudSig || -1)) {
          M._altHudSig = _sig46;
          M._altLastChg = _now46;
          GAME.ui.renderAltHud(_ag46);
        } else if (M._altLastChg && (_now46 - M._altLastChg) > 3000) {
          M._altLastChg = 0;   /* 清标记防每帧重复触发淡出 */
          GAME.ui.renderAltHud(null);
        }
      }
    } catch (eAH) { }
    try { _dustTick(_epDt); } catch (eEP2) { if (!M._epErr2) { M._epErr2 = String(eEP2 && eEP2.message); } }
    try { _perfTick(_epDt); } catch (eEP3) { if (!M._epErr3) { M._epErr3 = String(eEP3 && eEP3.message); } }
    placeCamera();
    /* v158.44：人物屏占比固定缩放 —— 在 placeCamera 之后用本帧机位算距离 */
    try { _figScaleTick(); } catch (eFS1) { if (!M._fsErr1) { M._fsErr1 = String(eFS1 && eFS1.message); } }
    /* v158.43 → v158.53（规则变更）：飞行 HUD 从"有速度才闪一下"改为
       飞行态**常驻仪表** —— 星球方位/横滚/海拔是参照系，静止时同样要看得见
       （老板：「完全没有一个坐标原点……玩家完全不知道自己在哪里」）。
       sig 去重要含方位/海拔/横滚，否则转头了速度没变 HUD 就不刷新。
       位置在 _figScaleTick 之后：纯 UI 呈现不抢相机当帧，同时守住
       §616②（edgePan→placeCamera <2000）与 §624②（placeCamera→figScale <600）。 */
    try {
      if (GAME.ui && GAME.ui.renderFlyHud) {
        var _flying = !!(M._fly && M._fly.active && !M._surf && M._fly.pos && M._fly.head);
        var _fv0 = (M._fly && M._fly.v) || 0;
        var _nv = M._flyNav || null;
        /* v158.59：sig 里加 phase —— 着陆瞬间速度归 0、方位不变，旧 sig 不变
           就不刷新，HUD 永远停在"巡航"，看不到"已着陆 · 空格下机"。 */
        var _sigF = _flying
          ? [Math.round(Math.abs(_fv0)), Math.round(_nv ? _nv.bearing : 0),
             Math.round(_nv ? _nv.alt : 0), Math.round(_nv ? _nv.bank : 0),
             String(_nv ? _nv.phase : '')].join(':')
          : 'off';
        if (_sigF !== (M._flyHudSig || '')) {
          M._flyHudSig = _sigF;
          GAME.ui.renderFlyHud(_flying ? _fv0 : null, _nv);
        }
      }
    } catch (eFH) { }
    /* v158.0（P0）：跟随态在 placeCamera **之后**覆盖相机，且只写 camO.dir
       （让地表 patch 跟着人走），绝不碰 quat/dist/lookPitch —— 退出跟随零跳变。 */
    if ((M.FOLLOW || M._surf) && M.PLAYER_AVATAR) {
      var _avNow = Date.now();
      var _avDt = Math.min(0.05, (_avNow - (M._avatarClock || _avNow)) / 1000) || 0.016;
      M._avatarClock = _avNow;
      try {
        /* v158.19：把 stepAvatar 的返回交给 followAvatar —— 摆腿要知道"这一帧到底走没走"。 */
        var _avOut = M.stepAvatar(_avDt, (GAME && GAME._keys) || null);
        /* v158.22：把这一帧的"走没走 / 步长"留到 syncFigures **之后**再用 ——
           syncFigures 跨格会重建小人到格心，必须在它之后再摆回连续位姿。 */
        M._lastAvOut = _avOut; M._lastAvDt = _avDt;
        /* v158.22（老板「操控一小人走在地面上」）：**地表也走位姿** ——
           WASD 归 stepAvatar，镜头由 placeCamera 的 _surfAvatarCam 接管。
           followAvatar 是 v158.0 的贴脸第三人称，只服务街区自动落位，
           地表不能调它（那正是"像老年痴呆"的原因）。 */
        if (M.FOLLOW) M.followAvatar(_avDt, _avOut);
        var _pp = M.playerPose();
        if (_pp && Array.isArray(_pp.dir)) camO.dir = _pp.dir.slice();
        /* v158.1（P1）：走近提示挂在跟随态里，且只在目标变化时写 DOM ——
           每帧无脑 innerHTML 会把 rAF 吃掉一大截；sig 去重后跨格才刷一次。 */
        try {
          /* v158.2（P2）：街区态由 district HUD 接管，P1 的地面提示必须静默，
             否则两条 HUD 会叠在同一屏上（同一格既是城又是街道）。 */
          if (GAME.ui && GAME.ui.renderInteractHint
            && !(M.DISTRICT && GAME.district && GAME.district.active)
            && !(GAME.vehicle && GAME.vehicle.mounted)) {
            var _nh = M.nearestInteractable();
            var _nhSig = _nh ? (_nh.ci + ':' + _nh.kind + ':' + _nh.verb) : '';
            if (_nhSig !== M._interactHintSig) {
              M._interactHintSig = _nhSig;
              GAME.ui.renderInteractHint(_nh);
            }
          }
        } catch (eHint) { }
      } catch (eAv) { }
    }
    /* v158.20（老板「让人物真实走动起来」）：战略视角下点图 → 小人沿球面走过去（相机不动）。
       到了就把交互交回去（点哪走到哪、到了就看信息）—— 走过去与「场景可交互」同时成立。 */
    if (M._walkTo >= 0 && !M.FOLLOW) {
      var _wNow = Date.now();
      var _wDt = Math.min(0.05, (_wNow - (M._walkClock || _wNow)) / 1000) || 0.016;
      M._walkClock = _wNow;
      try {
        var _wr = M.stepWalkTo(_wDt);
        if (_wr && _wr.arrived) {
          /* v158.24：「走过去要做的事」（勘探/建厂提示）已在 `stepWalkTo` 的到达出口执行
             —— 那是到达的唯一出口，换个驱动（自动化/探针）也不会漏。
             这里只负责**开面板**：UI 不往下沉到位姿层。 */
          try { _openCellPanel(_wr.ci); } catch (eWC) { }
        }
      } catch (eWalk) { }
    }
    /* v158.18（老板「新手玩法」）：任务链常驻提示 —— 内部 sig 去重，
       只在步骤/视图变化时写 DOM（不每帧 innerHTML）。 */
    try { if (GAME.ui && GAME.ui.renderQuestHint) GAME.ui.renderQuestHint(); } catch (eQh) { }
    /* v158.2（P2 · 城市街区 L1）：在 P0/P1 之后覆盖相机 —— 只写 cam，
       绝不写 camO.dist / camO.quat / lookPitch，退出街区时上一帧的轨道相机逐位还原。 */
    if (M.DISTRICT && GAME.district && GAME.district.active) {
      try {
        GAME.district.tick();
        GAME.district.camera();
      } catch (eDist) { }
      /* v158.17：街区态**整组收起球面小人**。街区的相机已经切到城格局部空间，
         球面小人却按 p.dir 摆在格心球面上 —— 实机表现是"画面里有个一模一样的人
         站在 9 米外的空地上，但那不是我"（v158.16 玩家视角走查 figVsMe=9.45）。
         街区里"我自己"改由 district.js 画在街区 root 上（buildAvatar），同一本账。 */
      if (figRoot) figRoot.visible = false;
    } else {
      if (M._districtWasActive && GAME.district && GAME.district.resetCam) {
        GAME.district.resetCam();
        M._districtWasActive = false;
      }
      if (figRoot) figRoot.visible = true;
    }
    if (M.DISTRICT && GAME.district && GAME.district.active) M._districtWasActive = true;
    /* v158.6（P5-b 任务链）：观察器 tick —— 轮询 P0~P4 状态、达标推进，
       不拦截输入、不写位姿；每帧一次、异常隔离。 */
    if (GAME.questline && GAME.questline.tick) {
      try { GAME.questline.tick(); } catch (eQ) { }
    }
    /* v157.15：整平拖刷的**节流重建**。
       整层重建 ~180ms，拖拽时每格重建会把手感拖死 → 150ms 一次；
       松手由 M.terraceFlush() 立刻补一帧，保证最终画面与数据一致。
       位置必须在 _tickSurfFade 之前：新材质还没设 alpha，交给下面统一推。 */
    if (M._terraceDirty && M._surf) {
      var _tn15 = Date.now();
      if (_tn15 - (M._terraceAt || 0) > 150) {
        M._terraceAt = _tn15; M._terraceDirty = false;
        try {
          var _rb0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
          rebuildSurf(camO.dir || [0, 1, 0]);
          if (_rb0) {
            M._perf.rebuildMs = +((performance.now() - _rb0)).toFixed(1);
            M._perf.rebuildN = (M._perf.rebuildN || 0) + 1;
          }
        } catch (eT15) { }
      }
    }
    /* v157r：地表层"由虚转实"。必须放在 placeCamera 之后 ——
       它要用 placeCamera 算出的 _agl 决定目标透明度。 */
    try { _tickSurfFade(); } catch (eFade) { }
    /* ============================================================
     * v157：地表层**跟着人走** —— 走超过半格才重锚，不是每帧重建。
     * 半格阈值 = 2.6 米：低于这个距离，脚下这片的几何几乎没变，
     * 重建只是白花 CPU（实测单次 rebuild ≈ 数十毫秒）。
     * ============================================================ */
    if (M._surf) {
      try {
        if (!SR) { rebuildSurf(camO.dir); }
        else if (M._surfCamAnchor && isFinite(M._surfCamAnchor.x)) {
          /* v158.49：重锚判据改跟**镜头锚点**（不是 camO.dir —— 它已不再每帧
             对齐玩家）：锚点走远 1.5 格就重建，地表层跟着落点/玩家走。 */
          var _aN49 = M._surfCamAnchor.clone().normalize();
          var _sdd = _aN49.x * SR.dir[0] + _aN49.y * SR.dir[1] + _aN49.z * SR.dir[2];
          /* v158.34（老板「画面太卡」）：半格（2.6 米）就整层重建，实测一次 29ms
             —— 4.5 m/s 走路时每 0.58 秒掉 2 帧，就是"一顿一顿"的来源。
             先放到 1.5 格（7.9 米）：4.5 m/s 时 1.7 秒才重建一次；
             窗口 40 米，走完 7.9 米边缘还剩 32 米余量，不会露边。 */
          var _halfCell = (5.25 / R) * 1.5;              /* 1.5 格的球心角（≈7.9 米） */
          /* v157.24：**平移时给重建加节流**。走路是每 2.6 米一次，频率很低；
             但按住左键拖拽可以一秒推十几米，按"半格"触发就是每 5 帧一次 47ms 重建
             —— 那正是"拖起来一顿一顿"的来源。拖拽期间最多 150ms 一次，
             松手再补一帧对齐（见 mouseup）。 */
          if (_sdd < Math.cos(_halfCell)) {
            var _nowR = Date.now();
            if (!M._panDrag || _nowR - (M._surfRebuildAt || 0) > 150) {
              M._surfRebuildAt = _nowR;
              rebuildSurf([_aN49.x, _aN49.y, _aN49.z]);
            }
          }
        }
      } catch (eSurf) { }
    }
    /* 地块数**固定**（老板）：不再随缩放切换级别 —— 恒定 TILE_SUB（= 40962 块）。*/
    /* 城市/据点增减/迁移（占领/迁址/放弃）→ 重建标记。v90.62（老板「移动后新城2 无色块/名称」）：
       旧判据只数**城市条数** —— 迁址时条数不变 → 标记不重建 → 旧色块/名称留在原地。
       改：把各城的 **id + 坐标** 拼进版本号，任一城移动即触发重建（色块与连线随城走）。 */
    var _mkVer = M._mkVerOf();
    if (_mkVer !== M._mkVer) { M._mkVer = _mkVer; buildMarkers(); buildTowns(); }
    /* v153：地表上的 3D 小人（君主 / 当前城 / 指认格）—— 每帧同步，换格只挪不重建 */
    try { syncFigures(); } catch (eFig) { if (typeof console !== 'undefined' && console.warn) console.warn('[figures]', eFig && eFig.message); }
    /* ============================================================
     * v158.22（老板「操控一小人走在地面上」）
     * ------------------------------------------------------------
     * 地表跟随相机只管镜头；小人模型必须**每帧摆到连续位姿**，
     * 否则只在跨格时被 syncFigures 重建到格心 —— 近看是一格一跳（5.25 米）。
     * 放在 syncFigures 之后：重建与摆位谁先谁后，最后写的必须是连续位姿。
     * ============================================================ */
    if (M._surf && M.SURF_AVATAR !== false) {
      try { M.syncAvatarFigure(M._lastAvDt || 0.016, M._lastAvOut || null); } catch (eSync22) { }
    }
    /* v91.05（老板）：己方**据点/野地插旗** —— 归属随占/放/迁变，同款"坐标拼版本号"触发重建。 */
    var _flVer = M._flVerOf();
    if (_flVer !== M._flVer) { M._flVer = _flVer; buildFlags(); }
    /* v91.12（老板 16）：**出征弧形箭头** —— 在途行军增减/改向即重建（id+起止坐标拼版本号）。 */
    var _arVer = M._arVerOf();
    if (_arVer !== M._arVer) { M._arVer = _arVer; buildMarchArrows(); }
    /* v92.240k：地块放置物 —— 数据层 bump 一次就全量重摆（放置/拆除/旋转都走这条）。 */
    var _plV = (GAME.place && GAME.place.ver) ? GAME.place.ver() : 0;
    if (_plV !== _plVer) { _plVer = _plV; buildPlacements(); }
    /* v92.241：陨石带 —— 行星参数/种子变了才重建；石块每帧按开普勒相位走动。
       ⚠️ 整段 try/catch：这是**每帧**路径，陨石带只是装饰，绝不能让它把渲染循环带死
       （首版就因为一个未声明变量抛 ReferenceError，整个画面只剩 CSS 底色）。 */
    try {
      if (M.beltVer) {
        var _bV = M.beltVer();
        if (_bV !== _beltVer) { _beltVer = _bV; buildBelt(); }
        else if (_beltRocks) beltUpdate(Date.now());
        /* v157c：陨石带是**站在星球外面**才看得见的东西。落地后它就成了
           天空里一串黑点（重建那次还会把 visible 重置回 true），所以每帧压一遍。 */
        if (beltRoot) beltRoot.visible = !M._surf;
      }
    } catch (eBelt) { _beltRocks = null; }
    /* 手上已经没东西了（切页/收工/放置完成）→ 幽灵必须跟着消失，
       否则会有一件半透明的物件永远卡在场景里。 */
    if (plGhost && !(GAME.ui && GAME.ui._placeItem)) { M.clearGhost(); M._ghostCi = -1; M._ghostIJ = null; }
    /* 同 v93.4：球面 depthWrite=false（透明排序需要），背面的物体会透到前半球 ——
       每帧按相机方向裁一次（阈值 0.05：边缘掠射角下别突然闪掉）。 */
    if (plRoot && plRoot.children.length) {
      var _cp2 = cam.position, _cl2 = Math.hypot(_cp2.x, _cp2.y, _cp2.z) || 1;
      var _nx2 = _cp2.x / _cl2, _ny2 = _cp2.y / _cl2, _nz2 = _cp2.z / _cl2;
      for (var _pi = 0; _pi < plRoot.children.length; _pi++) {
        var _po = plRoot.children[_pi], _pp2 = _po.position;
        var _pl2 = Math.hypot(_pp2.x, _pp2.y, _pp2.z) || 1;
        _po.visible = ((_pp2.x / _pl2) * _nx2 + (_pp2.y / _pl2) * _ny2 + (_pp2.z / _pl2) * _nz2) > 0.05;
      }
    }
    /* ============================================================
     * v152（老板：「地块不再高出地表，而是全部贴近地形 —— 圆形放射出来的六边形，
     * 在地表上切出的边」）
     * ------------------------------------------------------------
     * 改前：线框**越近越透明**（远处才看得见网格，贴近地面时网格完全消失）——
     * 那正好和"地表上切出来的六边形"相反：玩家站的那一格反而看不见边界。
     * 现在：**近处保留一条细边**（0.18 不透明度），远处才加倍；任何距离都看得见格子。
     * ============================================================ */
    /* ============================================================
     * v157.x（老板：「是否需要在高空模糊地面细节，近地时加载」）
     * ------------------------------------------------------------
     * 根因不是"没模糊"，而是**反了**：v152 让线框越远越明显（0.10→0.44 后恒定），
     * 而 40962 格在轨道高度每格只占 ~0.4 屏幕像素
     * （1200px 视口 · 42° fov · d=15000 时球半径只有 19px）。
     * 4 万个亚像素三角形叠在一起 = 一片灰雾 + 摩尔纹抖动，
     * 这就是"高空模糊"的真实来源，不是纹理精度不够。
     *
     * 正确做法（行业标准 grid fade）：**按每格屏幕像素决定画不画**。
     * 人眼在高空本来分辨不出 1 格，画出来只是噪声；看不见就不进渲染队列。
     * 真正该在高空保留的是区域边界/城市点（另有单独图层，不受此影响）。
     * ============================================================ */
    if (M._shellMat) {
      /* ============================================================
       * v157p（老板：「目前高空还是以六边形分解，是不是统一四边形？」）
       * ------------------------------------------------------------
       * 先把事实摆清楚：高空那层六边形**不是色块**，是 `tiles` 线框
       * （40962 格 → 245760 段）。它承载的是领地/迷雾/区划的视觉参照。
       *
       * 老板觉得"碎"，直接原因是这条曲线**方向反了**：
       * v152 为了让远处的细线看得见，把透明度做成"越远越明显"（0.10 → 0.44），
       * 于是恰好在他那个高度给出 ~0.30 —— 满屏蜂巢。
       * 但按尺度逻辑，格子是**战术层**的语言：拉远时该退场，不是该加强
       * （戴森球计划拉远后同样只剩色块，看不到格）。
       *
       * 改成"越远越淡"：1.30R 时 0.46（贴着星球看，格子清清楚楚）
       * → 2.05R 时 0.06（看整颗球，几乎只剩地形与区划边界）。
       * ⚠️ 下方 _pxCell 的亚像素 LOD 保留不动 —— 那是"1px 以下根本不画"，
       *    与这里的方向性是两个独立机制。
       * ============================================================ */
      /* v157.56：M.TILE_LINES 默认 false = 太空六边形线框彻底隐藏（老板「线条太杂，不要边线」）。
         区划边界是独立图层（见 v157p 注释），隐藏 tiles 不影响它。置 true 才走下方渐显逻辑。 */
      if (!M.TILE_LINES) {
        if (M._shellMat) M._shellMat.opacity = 0.0;
        if (tiles) tiles.visible = false;
        M._cellPx = 0; M._cellLod = 0;
      } else {
      var near = R * 1.30, far = R * 2.05;
      var o = 0.16 - 0.14 * Math.min(1, Math.max(0, (camO.dist - near) / (far - near)));   /* v157.56：太空六边形极淡，max 0.16 → 远 0.02 */
      if (M._surf) {
        /* v157：地表模式下地块由地表层（surfPlate）实体化呈现。
           40962 格的粗线框必须退场 —— 两套网格同时出现就是重影。 */
        M._shellMat.opacity = 0.0;
        if (tiles) tiles.visible = false;
      } else {
        var _pxCell = M.cellPxAt(camO.dist, ch);
        /* 0.9px 以下完全看不见 → 隐藏；3px 以上完整保留；中间 smoothstep 过渡 */
        var _lk = Math.min(1, Math.max(0, (_pxCell - 0.9) / (3.0 - 0.9)));
        _lk = _lk * _lk * (3 - 2 * _lk);
        var _oFin = o * _lk;
        M._shellMat.opacity = _oFin;
        if (tiles) tiles.visible = _oFin > 0.012;    /* 亚阈值直接跳过，不占 drawcall */
        M._cellPx = _pxCell;
        M._cellLod = _lk;
      }
      }
    }
    /* ============================================================
     * v93.4：**球背面的标记不要透出来**
     * ------------------------------------------------------------
     * 球面材质的 depthWrite 是 false（透明排序需要），代价是：
     * 球**背面**的标记不会被遮挡，会穿过球体显示在前半球上。
     * 表现就是截图里"整片海面上都是村子"—— 数据层其实一处都没错
     * （实机统计：村社 163 / 营地 93 / 遗迹 58，水上 0 处）。
     *
     * 所以这里每帧按相机方向裁一次：法线朝背后的整组隐藏。
     * 阈值 0.05 而不是 0 —— 球体边缘那一圈在掠射角下会突然闪掉。
     * ============================================================ */
    if (M._flags && M._flags.children.length) {
      var _cp = cam.position, _cl = Math.hypot(_cp.x, _cp.y, _cp.z) || 1;
      var _nx = _cp.x / _cl, _ny = _cp.y / _cl, _nz = _cp.z / _cl;
      for (var _fi = 0; _fi < M._flags.children.length; _fi++) {
        var _fo = M._flags.children[_fi], _fp = _fo.position;
        var _fl2 = Math.hypot(_fp.x, _fp.y, _fp.z) || 1;
        _fo.visible = ((_fp.x * _nx + _fp.y * _ny + _fp.z * _nz) / _fl2) > 0.05;
      }
    }
    scaleLabels();   /* v90.57：名称标签**钉死屏幕尺寸**（不随缩放变大小），每帧归一 */
    /* v90.71（老板 7）：定位光束远端发光点**红光脉动闪烁**（每帧按世界时间调制大小/透明度）。*/
    if (M._beamPos) {
      var ph = (Date.now() % 900) / 900;                       /* 0~1 周期 0.9s */
      var k = 0.5 + 0.5 * Math.sin(ph * Math.PI * 2);          /* 0~1 脉动 */
      var base = Math.max(5, camO.dist * 0.02);
      M._beamPos.scale.set(base * (0.6 + 0.7 * k), base * (0.6 + 0.7 * k), 1);
      if (M._beamPos.material) M._beamPos.material.opacity = 0.4 + 0.6 * k;
    }
    /* v137：云层时间推进（秒）—— 所有云材质共用一个时钟，避免各层漂移不同步 */
    /* v153：海面波浪时间推进（与云共用同一种每帧时钟） */
    if (M._waterMat && M._waterMat.uniforms && M._waterMat.uniforms.uTime) {
      M._waterMat.uniforms.uTime.value = (Date.now() % 3600000) / 1000;
      /* v156.22（老板：「海波太规整太明显」）：**振幅随镜头距离衰减**。
         物理上本来就该这样：离得越远，小浪在屏幕上的投影越小，看不清；
         观感上也能避免"从轨道看整片海都在抽动"的假。
         0.45 的下限保留一点起伏，不至于回到"海面毫无波澜"（v155d 的老问题）。 */
      if (M._waterMat.uniforms.uFar) {
        var _wf = Math.max(0, Math.min(1, (camO.dist - R * 1.0) / (R * 2.2)));
        M._waterMat.uniforms.uFar.value = 1.0 - 0.55 * _wf;   /* 1.0（贴近）→ 0.45（轨道） */
      }
      /* v155g（性能）：水面只在"看得到海"的距离上渲染。贴地 1 格时它全在视野外，
         仍会被光栅化 + 跑重着色器（实测每帧多 ~150ms）。 */
      if (water) {
        water.visible = (camO.dist > R * 0.55);
        /* v155i：**不再按距离换几何**（那会让远/近两个世界不一样）。
           只在"完全看不到海"的极近视角下隐藏。 */
      }
    }
    if (M._skyMat && M._skyMat.uniforms && M._skyMat.uniforms.uTime) {
      M._skyMat.uniforms.uTime.value = (Date.now() % 3600000) / 1000;
      /* ============================================================
       * v157.73（老板「如何做到拉近距离时穿越云层的感觉」）
       * ------------------------------------------------------------
       * 旧口径（v155f）：`uFade = (dist − R*1.15) / (R*0.55)` —— 离地 45 米就开始淡，
       *   而云壳在 R+ATM_H(55)：**相机还没碰到云，云先没了**，穿过去当然毫无感觉。
       * 新口径拆成两件正交的事，别再混：
       *   ① `uFade` —— 只负责「别糊地面」：离地 ≥ 0.55×hC(≈30m) 全显示，
       *      30 → 5 米之间线性收到 0（贴地时云在头顶 50 米、正俯视看不到，省性能）；
       *   ② `uIn`   —— 只负责「在云里」：以 |离地 − hC| / (0.35×hC) 的**钟形**，
       *      跨层 ±19 米内从 1 掉到 0，同时驱动云片浓度与背景压白。
       * 两者正交：100 米看云海（fade=1 / in=0）、55 米穿层（fade=1 / in=1）、
       * 贴地 2 米（fade≈0 / in=0）。
       * ============================================================ */
      var _hC = atmH();
      var _agl = camO.dist - R;
      var _fade = Math.max(0, Math.min(1, (_agl - _hC * 0.09) / (_hC * 0.46)));
      var _k = (_agl - _hC) / _hC;
      var _in = Math.max(0, 1 - Math.abs(_k) / 0.35);
      M._skyMat.uniforms.uFade.value = _fade;
      if (M._skyMat.uniforms.uIn) M._skyMat.uniforms.uIn.value = _in;
      /* v157.84：近景云纹抑制 —— agl 120→380 米线性 0→1。
         120 米以下只剩 8% 均匀底雾（没有成团云影压在海面上），380 米以上看整球满云。 */
      if (M._skyMat.uniforms.uClean) {
        M._skyMat.uniforms.uClean.value = Math.max(0, Math.min(1, (_agl - 120) / 260));
      }
      if (M._sky) M._sky.visible = _fade > 0.02;
      /* ============================================================
       * v157.84（老板「还有色斑」· 附截图：海面一片雾状白斑）
       * ------------------------------------------------------------
       * 病根：云雾层是**按"离云层多近"持续显示**的 ——
       *     _in = 1 − |agl − hC| / (0.35·hC)     （hC = atmH ≈ 55 米）
       *   于是 **agl 在 36~74 米之间时 _in > 0，而 55 米处 _in = 1**；
       *   2D 层拿它当不透明度铺 26 团圆白斑（0.82 峰值），云片再叠 0.31。
       *   实测（`.workbuddy/tools/show/probe_v15784_veil.js`）：
       *     agl 130 → veil 0 ｜ 74 → 0.013 ｜ **55 → 1.000（整屏白斑）** ｜ 45 → 0.481 ｜ 30 → 0
       *   而 55 米正是"拉近看地图"最常用的高度 —— 玩家一停在那儿，海面就永远糊一层
       *   雾状斑块，看起来就是「还有色斑」。截图实测与老板那张完全同型。
       *
       * 正解：**穿云是"事件"，不是"状态"**。
       *   · `_inBurst` —— 只有**跨过云层高度那一下**（side 翻转）触发，0.9 秒二次衰减；
       *     这才是"穿过云层"的语义：云扫过去，然后放开。停住不糊。
       *   · `_inHaze` —— 真停在云层高度（±5 米）时给 **8% 均匀薄白**（无斑块纹理），
       *     保留"在云里"的一点体感，但它是均匀的"雾"，不是一块块的"脏"。
       *   · 瞬移（切城/读档，单帧 |Δagl| > 400 米）不算穿越，不触发白幕。
       * ⚠️ 与 v157.74「滚轮只管高度、不要自动转相机方向」不冲突：本段只改**雾的浓度**，
       *    一个角度都不动。
       * ============================================================ */
      var _dAgl = (_agl - (M._veilAglLast == null ? _agl : M._veilAglLast));
      M._veilAglLast = _agl;
      /* 滞回 ±2 米：相机停在云层高度时 agl 会在 hC 上下微抖（阻尼收敛），
         没有滞回就会每抖一次触发一轮白幕 —— 那等于把"色斑"换个方式又请回来。 */
      if (M._veilSide == null) {
        M._veilSide = (_agl >= _hC) ? 1 : -1;              /* 首帧只记基准，不触发 */
      } else if (Math.abs(_dAgl) > 400) {
        M._veilSide = (_agl >= _hC) ? 1 : -1; M._veilAt = 0;   /* 瞬移跨层：不铺白幕 */
      } else {
        var _cross = (M._veilSide === 1 && _agl < _hC - 2)
          || (M._veilSide === -1 && _agl > _hC + 2);
        if (_cross) { M._veilSide = -M._veilSide; M._veilAt = Date.now(); }
      }
      var _age = M._veilAt ? (Date.now() - M._veilAt) : 1e9;
      var _x = _age < 900 ? (1 - _age / 900) : 0;
      var _burst = _x * _x;                               /* 二次衰减：起手浓、尾段快散 */
      /* ⚠️ 峰值**不能**再乘 `_in`：`_in` 是"离云层多近"，跨层那一刻 agl 已经掉到
         hC−20 附近（钟形窗口 ±19 米的边缘），乘上去就恒等于 0 ——
         实测第一版就是这么把"穿云感"一起修没的（滚轮全程 veil=0.000）。
         穿越是事件：事件本身给浓度，衰减交给 `_burst`。 */
      M._cloudVeil = 0.62 * _burst;                       /* 2D 云斑：只在穿越用 */
      M._cloudHaze = (Math.abs(_agl - _hC) < 5)
        ? (1 - Math.abs(_agl - _hC) / 5) * 0.08 : 0;      /* 停在云里：均匀薄白 */

      /* 云片：**只有跨层那几秒才亮**（乘 _inBurst）—— 总览时完全收掉，
         否则 44 片半透明云会在球面上糊一层薄雾，把刚修好的地形色又压灰。
         v157.84：由 `_in`（接近度，会长时间 >0）改为 `_in`×穿越衰减 —— 停住不亮。 */
      if (M._puffs) {
        var _pOp = _fade * _burst * 0.62;
        M._puffs.visible = _pOp > 0.01;
        if (M._puffs.visible) {
          var _ph0 = Date.now() / 9000;
          var _kids = M._puffs.children;
          for (var _pi = 0; _pi < _kids.length; _pi++) {
            /* 每片相位错开：穿层时是"一片片掠过"，不是整屏同时亮 */
            var _ph = 0.72 + 0.28 * Math.sin(_ph0 + _pi * 0.7);
            _kids[_pi].material.opacity = Math.min(0.9, _pOp * _ph);
          }
        }
      }

      /* 穿云浓度交给 **2D 合成层**去画（见下方 render 之后的云雾段）。
         ⚠️ 这里原本想改 `scene.background` 压白，**实测无效**：轨道相机始终朝球心
            俯视，3D 几何铺满整屏，background 一个像素都露不出来 —— agl=55 的实机截图
            是放大的地表纹理，一点云感都没有。2D 层与视角无关，才是「糊一屏」的正确出口。
         ⛔ v157.84：这里原有 `M._cloudVeil = _in;` —— **删掉**。它把"离云层多近"
            直接当浓度写回，会覆盖上面算好的"穿越事件"值，等于没改（实测 agl 停在 55
            仍是 1.000）。浓度唯一来源在 `_inBurst` / `_inHaze` 两行。 */
    }
    R3.render(scene, cam);
    var ctx = target2d.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(wcv, 0, 0, cw, ch);
    /* ============================================================
     * v157.73（老板「如何做到拉近距离时穿越云层的感觉」）
     * ------------------------------------------------------------
     * 穿云雾：相机跨过云层高度（R + ATM_H）前后 ±0.35×ATM_H 内，
     * 在 **2D 合成层**铺一层缓慢漂移的云斑，把画面短暂糊住再放开。
     *
     * 为什么必须画在这一层（而不是 3D）：
     *   · 轨道相机**始终朝球心俯视**，3D 几何铺满整屏 → `scene.background` 露不出来；
     *   · 球壳在**壳面上必然透明**（`edge` 归零，v156.34 为修自转闪烁定的）→ 穿层那刻没云；
     *   · 2D 层与视角无关，是唯一能「糊一屏」的出口，成本只是几次 Canvas 填充。
     * 观感设计：固定种子生成 42 团柔和云斑（四向复制保证平铺无缝），
     *   两张不同速度的偏移让云「从画面掠过」，而不是一张静止的白幕。
     * ============================================================ */
    /* v157.84：「停在云里」= 均匀薄白（8% 上限，无斑块纹理）。
       与下方的云斑（穿越用）刻意分开：均匀的雾不会读成"脏斑"，
       而一团团的圆斑铺满屏一定会。 */
    if (M._cloudHaze > 0.004) {
      ctx.save();
      ctx.fillStyle = 'rgba(226,233,242,' + M._cloudHaze.toFixed(3) + ')';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
    }
    if (M._cloudVeil > 0.012) {
      try {
        if (!M._veilTex) {
          var VS = 512, vc = document.createElement('canvas');
          vc.width = vc.height = VS;
          var vg = vc.getContext('2d');
          var vseed = 20261116;                   /* 固定种子：截图可复现，不用 Math.random */
          var vrnd = function () { vseed = (vseed * 1664525 + 1013904223) >>> 0; return vseed / 4294967296; };
          /* v157.73 调参：42 团 × 半径 0.10~0.27 实测太碎，像"霉斑"而不是云团；
             改成 26 团 × 0.16~0.38（大团、少而柔），提白到 238,243,250。 */
          for (var vi = 0; vi < 26; vi++) {
            var vx = vrnd() * VS, vy = vrnd() * VS;
            var vrr = VS * (0.16 + vrnd() * 0.22);
            var vaa = 0.20 + vrnd() * 0.26;
            /* 3×3 复制：斑块跨贴图边界时两边都有，平铺才不出现硬缝 */
            for (var vdx = -1; vdx <= 1; vdx++) {
              for (var vdy = -1; vdy <= 1; vdy++) {
                var gv = vg.createRadialGradient(vx + vdx * VS, vy + vdy * VS, 0,
                  vx + vdx * VS, vy + vdy * VS, vrr);
                gv.addColorStop(0, 'rgba(238,243,250,' + vaa.toFixed(3) + ')');
                gv.addColorStop(1, 'rgba(238,243,250,0)');
                vg.fillStyle = gv;
                vg.beginPath();
                vg.arc(vx + vdx * VS, vy + vdy * VS, vrr, 0, Math.PI * 2);
                vg.fill();
              }
            }
          }
          M._veilTex = vc;
        }
        if (!M._veilPat) M._veilPat = ctx.createPattern(M._veilTex, 'repeat');
        var _va = Math.min(0.80, M._cloudVeil * 0.82);
        /* 第一层：原尺寸，慢漂移 */
        var _vox = (Date.now() / 52) % 512, _voy = (Date.now() / 78) % 512;
        ctx.save();
        ctx.globalAlpha = _va;
        ctx.translate(-_vox, -_voy);
        ctx.fillStyle = M._veilPat;
        ctx.fillRect(0, 0, cw + 512, ch + 512);
        ctx.restore();
        /* 第二层：0.62 倍缩放 + 反向漂移 —— 单层平铺在 1280 宽上会露出重复节奏，
           叠一层不同尺度就看不出来了（只在穿层的 1 秒内画，性能可忽略）。 */
        var _vox2 = (Date.now() / 34) % 512, _voy2 = (Date.now() / 61) % 512;
        ctx.save();
        ctx.globalAlpha = _va * 0.55;
        ctx.scale(0.62, 0.62);
        ctx.translate(-_vox2, -_voy2);
        ctx.fillStyle = M._veilPat;
        ctx.fillRect(0, 0, (cw + 512) / 0.62, (ch + 512) / 0.62);
        ctx.restore();
      } catch (eVeil) { /* 云雾失败不挡渲染 */ }
    }
    /* v90.83：**当前星球标识**（左下常驻）—— 换球后一眼可辨"现在是哪颗"（生成/进入星球后即时更新）。
       放左下：右上被地形/行政检索栏占用。 */
    /* ⛔ v157.85：原来前传期不画这条（"一个人不是统治者"）。前传退役 → 恒画。 */
    if (GAME.state && GAME.state.planets) {
      var _ap = GAME.activePlanetOf ? GAME.activePlanetOf() : null;
      if (_ap) {
        var _pt = '🪐 ' + _ap.name + ' · 种子 ' + _ap.seed;
        ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        var _pw = ctx.measureText(_pt).width;
        ctx.fillStyle = 'rgba(10,14,20,.78)'; ctx.fillRect(14, ch - 40, _pw + 22, 28);
        ctx.strokeStyle = 'rgba(255,215,106,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(14, ch - 40, _pw + 22, 28);
        ctx.fillStyle = '#ffd76a'; ctx.fillText(_pt, 25, ch - 32);
        /* v92：**行迹**（已探明 % + 当前视野半径），挂在星球标识同一行右侧。
           放在地图上而不是藏在军务页里：探索度是这张地图的主状态，
           玩家抬头就该看见"我还认识多少"。 */
        if (GAME.fog && GAME.fog.stats) {
          var _fs2 = GAME.fog.stats();
          /* 顺带报"下一档还差多少" —— 里程碑只落一条日志很容易被错过，
             常驻在 HUD 上玩家才知道"再探 2.7% 视野就 +1"。 */
          var _nextT = null;
          ((GAME.DATA.FOG || {}).tiers || []).forEach(function (t) {
            if (!_nextT && _fs2.pct < t.pct) _nextT = t;
          });
          var _ft = '🗺 行迹 ' + _fs2.pct + '%　· 视野 ' + GAME.fog.radiusOf() + ' 格'
            + (_nextT ? ('　· 再 ' + (Math.round((_nextT.pct - _fs2.pct) * 10) / 10) + '% → ' + _nextT.r + ' 格') : '');
          var _fx = 14 + _pw + 30;
          ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          var _fw = ctx.measureText(_ft).width;
          ctx.fillStyle = 'rgba(10,14,20,.78)'; ctx.fillRect(_fx, ch - 40, _fw + 22, 28);
          ctx.strokeStyle = 'rgba(143,180,214,.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(_fx, ch - 40, _fw + 22, 28);
          ctx.fillStyle = '#8fb4d6'; ctx.fillText(_ft, _fx + 11, ch - 32);
        }
      }
    }
    /* 点击选中 → 画信息条（地块类型 + 等级）*/
    if (M._cell) {
      var _kname = { wild: '野地', fort: '据点', npc: '名城', adm: '行政城', own: '己方城' }[M._cellKind] || '野地';
      /* v92：未探明格**连地形名与海拔都不给** —— 否则信息条就成了免费的探图工具。 */
      /* v92.5：这一格归哪家军阀 —— 与点击面板同一出口（faction.controlOf），
         不在这里另算一遍距离。未探明的格子不给（连地形都不给，更不会给归属）。 */
      var _facName = '';
      if (M._cellKind !== 'unknown' && GAME.faction && GAME.faction.controlOf) {
        var _fid = GAME.faction.controlOf(M._cell.ci != null ? M._cell.ci : -1);
        if (_fid) {
          var _fd = GAME.faction.defOf(_fid);
          var _isCore = GAME.faction.coreAt && GAME.faction.coreAt(M._cell.ci) === _fid;
          _facName = ((_fd && _fd.name) || _fid) + (_isCore ? ' 的核心（打下来它领地腰斩）' : ' 的地盘');
        }
      }
      var txt = (M._cellKind === 'unknown')
        ? '【未探明】这一带地图上没有记载'
        : ('【' + _kname + '】' + M._cell.name + ' · 等级 ' + M._cell.level
          + ' · 球系坐标 ' + (GAME.map.coordText ? GAME.map.coordText(M._cell.x, M._cell.y) : (Math.round(M._cell.lon) + '°E ' + Math.round(M._cell.lat) + '°'))
          + (_facName ? ('　⚔ ' + _facName) : ''));
      /* v90.66（老板）：字号缩到与底部导航栏一致（原 bold 20px 偏大）。 */
      ctx.font = '13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      var tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(10,14,20,.78)'; ctx.fillRect(14, 12, tw + 22, 28);
      ctx.strokeStyle = 'rgba(200,230,255,.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(14, 12, tw + 22, 28);
      ctx.fillStyle = '#eaf4ff'; ctx.fillText(txt, 25, 20);
    }
    /* v90.81：自转驱动器 —— 地图页静止 10s 后**每 33ms 步进 + 重绘**（setInterval，稳）。
       非自转态（有操作 / 非地图页）自动停。 */
    function _spinTick() {
      /* v155e：前传（相机贴着某一格）**不自转** —— 绕脚下那一格转圈没有意义，
         而且正是"转一阵子后画面抖一下"的来源之一。
         v157e：地表模式同理 —— 人站在地上，星球"转"等于整个画面转，几秒就晕。
         v157e：改由**显式开关** M.spinOn 控制（老板要一个"自转"按钮）。
           原来那套"静止 10 秒自动转"是隐式的：玩家没动它却自己转了，
           想停也停不下来。现在只有开关打开才转，且操作后 1.5 秒内让路（拖动不打架）。 */
      /* ⛔ v157.85：`!_inPro`（前传不自转）已删 —— 前传退役，判据只剩"开关 + 非地表 + 在地图页"。 */
      var ok = M.spinOn && !M._surf
        && GAME.ui && GAME.ui.view === 'map' && GAME.state
        && (Date.now() - (M._lastAct || 0) > 1500);
      if (!ok) {
        /* ============================================================
         * v158.34（老板「画面太卡」）· **这里原来是 `return`**
         * ------------------------------------------------------------
         * 不自转（有操作 / 在地表 / 关了自转按钮）就**整帧不渲染** ——
         * 于是 3D 地图根本没有帧循环：走路靠键盘 repeat 事件一帧一帧推，
         * 30Hz 还不匀，松手就停。这就是"卡"和"不跟手"的总根子。
         * 现在：不自转只跳过**自转那一步**，渲染照旧每帧跑（rAF 已 60fps）。
         * ============================================================ */
        M._spinLast = 0;                                     /* 停下时清时基，下次启动不跳一大格 */
      } else {
      var _spin = (SP.PLANET && SP.PLANET.spinSec) || 60;
      /* ============================================================
       * v92.240k（老板：「现在球体还是有震颤」）
       * ------------------------------------------------------------
       * 病根：原式 `yaw += (2π/spinSec) * 0.033` —— **每步固定 0.033 秒的角度**，
       * 却假设回调真的每 33ms 来一次。而 `setInterval(…, 33)` 的实到间隔取决于
       * 那一帧渲染有多贵（40962 地块 + 球面着色器，帧耗时本来就抖），
       * 浏览器还会合并/节流 —— 于是**真实角速度 = 固定角 ÷ 抖动的实际间隔**：
       * 帧一慢就转慢、帧一快就转快 → 画面持续"一颤一颤"。
       * 正解：与海浪/云层（uTime = Date.now()/1000）同一把尺 —— **按真实经过时间推进**。
       *   · dt 取真实毫秒差，角速度恒定，帧率抖也不再转成转速抖；
       *   · dt 上限 200ms：卡顿/切后台回来时不许一次跳一大格（否则是"猛甩一下"）。
       * ============================================================ */
      var _now = Date.now();
      var _dt = M._spinLast ? (_now - M._spinLast) : 33;
      M._spinLast = _now;
      if (!(_dt > 0) || _dt > 200) _dt = 33;                 /* NaN/负数/超长 → 退回标称步长 */
      /* ============================================================
       * v156.63（老板「统一旋转绕地心线，达成地心线不动，球体环绕地心线」）
       * ------------------------------------------------------------
       * 语义不变：绕**世界 Y 轴（地心线）**公转，轴线在屏幕上的位置不动。
       *
       * ⛔ v157.83 改实现（老板「球体不跟着鼠标走，而是乱滚」的第二个真因）：
       *   旧写法 `camO.quat.premultiply(Ry)` 只改了 quat，**不同步 yaw**，
       *   然后 `camO._euler = [camO.yaw, camO.pitch]` 假装它干净 —— 于是
       *   quat 已转了 N 度、yaw 还停在旧值。玩家一拖动 → `camO.quat = null`
       *   → placeCamera 按旧 yaw 重建 → **画面瞬间跳回自转前**，之后接着自转。
       *   自转默认开启（`M.spinOn = true`），1.5 秒无操作就转 —— 每个玩家都会撞上。
       *
       * 现在姿态只有**一个真值来源** = yaw/pitch（roll 由 pitch 派生，见 `_camRollOf`）。
       * 数学上 premultiply(Ry(θ)) ≡ yaw += θ（R = Ry(y)·Rx(−p)·Rz(r)），
       * 所以直接累加 yaw 与旧写法逐位等价，但不会再丢角度。
       * ============================================================ */
      var _spinAng = (2 * Math.PI / _spin) * (_dt / 1000);
      /* v157.101：轨迹球模式下自转必须**乘到 quat 上**（绕世界 Y）。
         原来 `yaw += …; quat = null` 会让 placeCamera 按 yaw 重建 → roll 与过极点信息全丢。*/
      if (M.CAM_TRACKBALL && camO.quat) {
        var _qyS = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), _spinAng);
        camO.quat.premultiply(_qyS).normalize();
        var _dvS = new THREE.Vector3(0, 0, 1).applyQuaternion(camO.quat);
        camO.dir = [_dvS.x, _dvS.y, _dvS.z];
        camO.yaw = Math.atan2(_dvS.x, _dvS.z);
        camO.pitch = Math.asin(Math.max(-1, Math.min(1, _dvS.y)));
        camO._euler = null;
      } else {
        camO.yaw += _spinAng;
        camO.quat = null; camO._euler = null;    /* 交给 placeCamera 按新 yaw 重建 */
      }
      }
      /* 无论转不转，**这一帧都要画**（自转只是其中一步） */
      try { wonderStep(); } catch (eWS) { }                   /* v91.30：奇观轨行 + 出场/离场动画 */
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    }
    /* ============================================================
     * v158.34（老板「画面太卡」）· **帧率上限从 30 抬到 60**
     * ------------------------------------------------------------
     * 病根一直在这：整张 3D 地图是靠 `setInterval(_spinTick, 33)` 驱动的
     *   —— 33ms = **30fps 封顶**，而且 setInterval 在浏览器繁忙时还会被吞帧。
     *   走路时再叠一次 27ms 的地表重建，体感就是"一卡一卡 + 整体不跟手"。
     * 现在换 rAF：
     *   · 60fps（高刷屏用 14ms 门槛限到 ~70fps，不白烧）；
     *   · 切后台/隐藏时浏览器自动暂停 rAF，回来也不会积压；
     *   · jsdom 无 rAF 时退回 setInterval（门禁/测试不断）。
     * ============================================================ */
    if (!M._rafOn && typeof requestAnimationFrame === 'function') {
      M._rafOn = true;
      M._rafLast = 0;
      var _rafLoop = function () {
        if (!M._rafOn) return;
        M._rafId = requestAnimationFrame(_rafLoop);
        var _nowP = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (M._rafLast && (_nowP - M._rafLast) < 14) return;   /* 高刷屏别白跑两遍 */
        M._rafLast = _nowP;
        try { _spinTick(); } catch (eRAF) { if (!M._rafErr) M._rafErr = String(eRAF && eRAF.message); }
      };
      M._rafId = requestAnimationFrame(_rafLoop);
    } else if (!M._spinTimer && typeof setInterval !== 'undefined') {
      M._spinTimer = setInterval(_spinTick, 33);
    }
    return true;
  };

  M.bindControls = function (canvas) {
    if (!canvas || canvas._m3dBound) return;
    canvas._m3dBound = true;
    /* v158.56：把画布元素暴露到模块作用域 —— _flyAimAt 在模块层，
       拿不到本函数的形参 canvas（引用会抛 ReferenceError）。 */
    M._cvEl = canvas;
    var drag = 0, lookDrag = 0, lx = 0, ly = 0, moved = false;
    var lx0 = 0, ly0 = 0;        /* v156.59 arcball：上一帧的**画布内**坐标 */
    function redraw() { if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); }
    function touch() { M._lastAct = Date.now(); }            /* v90.81：无操作计时（自转）*/

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    /* 中键按下的默认行为是『自动滚动』，会吃掉拖拽 —— 一并挡掉 */
    canvas.addEventListener('auxclick', function (e) { if (e.button === 1) e.preventDefault(); });
    /* v156.47：右键现在有用了（转头）—— 必须吃掉浏览器右键菜单，否则一拖就弹。 */
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    /* ============================================================
     * v158.28（老板「地图位置的变动，通过鼠标在地图四周……」）
     * ------------------------------------------------------------
     * 边缘推镜要的是**指针位置**，而且拖动中也得更新（既有两个 mousemove
     * 一个在 drag 时直接 return、一个按 90ms 节流），所以单独记一份只读指针。
     * ============================================================ */
    document.addEventListener('mousemove', function (e) {
      try {
        var rp = canvas.getBoundingClientRect();
        if (!rp.width) return;
        M._ptr = { x: e.clientX - rp.left, y: e.clientY - rp.top,
          w: rp.width, h: rp.height, out: false };
      } catch (eP) { }
    }, { passive: true });
    canvas.addEventListener('mouseleave', function () { if (M._ptr) M._ptr.out = true; });
    canvas.addEventListener('mousedown', function (e) {
      /* v153f：只有**左键**才算"开始拖动/点击" —— 之前右键/中键也 drag=1，
         于是左键点一下（press）→ 右键点一下（release）会配成"没拖动 = 点击"，
         把前半段左键的坐标当成点击位置（实测点右上角却走了南西）。 */
      /* v156.47 自由相机：**右键拖拽 = 转头**（位置不动，只把视线从球心偏出去）。
         左键仍是「绕球心转 + 点选地块」，两套互不干扰。
         双击右键 = 视线回正（重新对准球心）—— 偏出去之后得能一键找回北。 */
      /* v156.49（老板「浏览器现有右键拖动手势，如何禁用」）——
         右键被浏览器/扩展的『右键手势』（右拖=前进、左拖=返回）抢了，
         而**网页拦不住浏览器级手势**（只能拦 contextmenu）。
         所以转头**同时支持中键**：中键没有手势冲突，任何浏览器都能用。 */
      /* ============================================================
       * v156.55（老板「右键的相机，我希望是相机绕球心运动，
       *          而不是在视野内摆弄球体」）
       * ------------------------------------------------------------
       * **右键 = 轨道相机**：和左键同一套（位置绕球心、up 竖直、无 roll）。
       * 之前右键是"视野内转头"，球会在画面里滑来滑去 —— 那就是"摆弄球体"。
       * 转头能力没丢：**中键**仍然转头（位置不动、只偏视线），
       * 且中键没有浏览器手势冲突。
       * 双击右键 = 视角正位。
       * ============================================================ */
      /* ============================================================
       * v157c（老板：「左右键长按的功能重叠，建议左键维持（以球心为支点
       *   转动球体），右键变为以相机为支点转动视角，看向不同方位」）
       * ------------------------------------------------------------
       * 分工重排：
       *   左键 = 轨道（绕球心转球体，位置变、朝向跟着球心）
       *   右键 = 转头（位置不动，只把视线偏出去；地表模式下 = 环顾四周）
       *   中键 = 同右键（保留，因为部分浏览器会抢右键手势）
       * 双击右键 = 视角回正。
       * ============================================================ */
      if (e.button === 2) {
        /* ============================================================
         * v158.43（老板诉求1「右键是移动相机，不是移动星球」）—— **规则变更：高空右键回到"转头"**
         * ------------------------------------------------------------
         * 诉求 1 原文（高空）：「右键转动相机朝向而不改变位置（相机本体可以
         *   维持一个持续的速度，直至左键操作）」。
         * v158.27 曾把右键定为"绕球心"（_rmbOrbit 抓球），现在高空换回
         *   转头语义（lookYaw/lookPitch 偏移，位置一寸不动）；高空位置移动
         *   交给新的 **WASD 飞行系统**（_tickFlight）。
         * 地表右键不变：仍走 _rmbOrbit + lookDrag=2（绕角色转，v158.36 口径）。
         * 双击右键 = 视线回正的能力保留（_rmbLook 标记 + mouseup lookDrag 分支）。
         * ============================================================ */
        if (M._surf) {
          M._rmbOrbit = true;
          M._rmbDownAt = Date.now(); M._rmbMoved = false;
          /* v158.36：地表右键要落到 mousemove 的 lookDrag 语义区（绕角色转），
             这里给一个独立标记；mouseup 的 _rmbOrbit 分支会一并清掉。 */
          lookDrag = 2;
          /* 不 return —— 继续落下去初始化为"抓球拖拽"（与左键同一条路） */
        } else {
          /* v158.53（无人深空）：高空右键 = **转机头**（看哪飞哪）。
             旧 v158.43 的"转头偏移 lookYaw/lookPitch"整条退役 —— 它让视线
             与航向解耦（实测右键转 86°、机头 0°，玩家彻底迷失）。
             _rmbLook 保留为"正在拖机头"标记；中键 lookDrag 也走同一分支。 */
          M._rmbLook = true;
          M._rmbDownAt = Date.now(); M._rmbMoved = false;
          moved = false;
          lookDrag = 1; lx = e.clientX; ly = e.clientY; touch(); e.preventDefault(); return;
        }
      } else if (e.button === 1) {                             /* 中键 = 自由转头 */
        lookDrag = 1; lx = e.clientX; ly = e.clientY; touch(); e.preventDefault(); return;
      }
      if (e.button !== 0 && e.button !== 2) return;
      /* v158.39：建造模式手持物品 → 按下即落一件，拖过一格落一件（戴森式连铺）。
         必须放在整平分支前：一只手只能拿一样，拿物品时铲子不会同时在手。 */
      if (e.button === 0 && M.mode === M.MODE_BUILD && GAME.ui && GAME.ui._placeItem) {
        M._placeDrag = true;
        M._placeLastIJ = null;
        var gpHold = _groundPtAt(e.clientX, e.clientY);
        if (gpHold) M.placeAtPoint(gpHold, { silent: false });
        drag = 1; moved = false; lx = e.clientX; ly = e.clientY;
        if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
        touch(); e.preventDefault(); return;
      }
      /* v157.15：建造模式 + 整平铲子 → 左键是**刷地**，不转球
         （转球/选格在拖刷期间全让位，否则一边刷一边把镜头甩走）。 */
      /* v158.27：右键现在也走这条路径，但**只有左键**才是刷地（右键仍只转镜头）。 */
      if (e.button === 0 && M.mode === M.MODE_BUILD && M.TOOL === M.TOOL_TERRACE && M._surf) {
        M._terraceDrag = true;
        M._terraceLastP = null;
        lx = e.clientX; ly = e.clientY;
        try {
          var rcT = _rayOfEvent(canvas, e);
          var gpT = rcT ? M.pickGroundPoint(rcT) : null;
          if (gpT) {
            /* **按下的那一格决定台面高度**（成熟建造游戏都是这个手感）：
               先量这一格现在是多少层，再把目标层设成它 —— 玩家不用记"第几层"，
               拖过去的地自然和起点一样平。 */
            if (M.TERRACE_AUTO !== false && !M._terraceErase) {
              var _g0 = M.gridAt(gpT);
              if (_g0 && !GAME.terrain.waterAt(_g0.i, _g0.j)) {
                /* 水面格不当基准（它不接整平，拿它的高度当目标只会让整笔都无效） */
                var _lv0 = GAME.terrain.levelAt(_g0.i, _g0.j);
                if (_lv0 == null) _lv0 = GAME.terrain.naturalLevelAt(_g0.i, _g0.j);
                M.TERRACE_TARGET = _lv0;
              }
            }
            if (M._terraceErase) M.terraceClearAt(gpT); else M.terraceStrokeAt(gpT);
            if (GAME.ui && GAME.ui.renderBuildBar) GAME.ui.renderBuildBar('tool');
          }
        } catch (eT0) { }
        touch(); e.preventDefault(); return;
      }
      /* ============================================================
       * v157.24（老板逐字：「左键应该是移动相机本身 —— 粘起面前的一个点，
       *          这个点不动，向前/后拖，相机往反方向去动」）
       * ------------------------------------------------------------
       * 语义不变（仍是「粘住地面一点、相机反向走」），但**实现口径**在
       * v157.54 改为「按下时冻结基准」：
       *   旧做法每帧从当前相机重新拾取地面命中点，用「锚点 − 命中点」全量补回。
       *   那是输入依赖输出的反馈回路；近地面掠射角下按 1/sin²θ 放大几百倍，
       *   叠加写了 camO.dist 却没同步 _zoomTarget，整屏会剧烈跳动。
       *   新做法：按下这一刻一次采 (x,y)/(x+1,y)/(x,y+1) 三个地面点，
       *   由唯一出口 panBasisOf 算出并**冻结**每像素地面位移；之后每帧
       *   只读鼠标增量（panStepOf）。只取切平面分量，高度交给 placeCamera。
       * 代价：拖得很远时「点严格在光标下」变成一阶近似（轻微漂移），
       *   换来构造上不可能跳 —— 老板要求「绝对稳定 · 最保守」。
       * ⛔ 旧状态 M._panA 整条退役（改由 M._panBasis 表达「抓到了地面」），
       *   不留只写不读的字段。
       * ============================================================ */
      M._panDrag = false; M._panBasis = null;
      /* v158.43（诉求 1 原文「相机本体可以维持一个持续的速度，直至左键操作」）：
         左键按下 = 停止高空飞行惯性（点选/拖拽都不该带着飞船速度做）。 */
      if (e.button === 0 && M._fly && M._fly.v) M._fly.v = 0;
      /* v158.43（老板诉求1·地面）：「左键单击=移动/放置，左键长按=平移镜头」。
         v158.36 曾按「左键只选不转相机」把这里锁在 `LEFT_DRAG_CAM`（默认 false），
         导致地表左键既不抓地也不平移，位移全靠边缘推镜 —— 而边缘推镜本需求已关停。
         现在地表左键**按下即抓地建 panBasis**：单击（未拖动）松手走 pickAt→走路/放置，
         长按拖动走 mousemove 的 `if (M._surf && M._panDrag)` 平移镜头，两态天然由
         `moved` 区分（mouseup 里拖动过就 return、不再当点击）。这是地面新语义，
         独立于高空「左键只选」的 `LEFT_DRAG_CAM` 开关。右键地表也会落到这里初始化
         panBasis，但它 mousedown 已设 lookDrag=2，mousemove 的 lookDrag 分支优先于
         _panDrag，不冲突；mouseup 的 _rmbOrbit 分支也会清 _panDrag。 */
      if (M._surf) {
        var _pa0 = _groundPtAt(e.clientX, e.clientY);
        if (_pa0) {
          var _pb0 = _groundPtAt(e.clientX + 1, e.clientY);
          var _pc0 = _groundPtAt(e.clientX, e.clientY + 1);
          var _rad0 = new THREE.Vector3(cam.position.x, cam.position.y, cam.position.z).normalize();
          var _rgt0 = M._surfRight ? M._surfRight.clone() : new THREE.Vector3(1, 0, 0);
          var _dS0 = M._surfDir ? M._surfDir.clone() : null;
          var _fwd0 = _dS0 ? _dS0.addScaledVector(_rad0, -_dS0.dot(_rad0)) : null;
          if (!_fwd0 || !isFinite(_fwd0.x) || _fwd0.lengthSq() < 1e-6) {
            _fwd0 = new THREE.Vector3().crossVectors(_rad0, _rgt0);
          }
          var _eye0 = M.SURF_EYE || 1.7;
          M._panBasis = M.panBasisOf(
            _pa0, _pb0, _pc0,
            { x: _rad0.x, y: _rad0.y, z: _rad0.z },
            { cap: _eye0 * 0.15,                 /* 每像素 ≤ 15% 眼高 */
              fallback: _eye0 * 0.15 * 0.5,     /* 拾取打空时的保守兜底 */
              fx: { x: _rgt0.x, y: _rgt0.y, z: _rgt0.z },
              /* v157.54 复核修正（独立复核抓出）：实测 ey =「下移一像素、地面点
                 朝相机走」≈ −fwd（panBasisOf 的 pc=(x,y+1) 口径），兜底方向必须与
                 实测同号，否则掠射 <0.5° 或 (x,y+1) 打空时纵向拖拽会反向。
                 fx 实测 ≈ +right，不动。 */
              fy: { x: -_fwd0.x, y: -_fwd0.y, z: -_fwd0.z },
              maxStep: _eye0 * 0.5,             /* 单帧 ≤ 半个眼高 */
              dist: camO.dist }                /* 半径冻结，拖拽全程不写 camO.dist */
          );
          M._panDrag = !!(M._panBasis && M._panBasis.ok);
        }
      }
      drag = 1; moved = false; lx = e.clientX; ly = e.clientY;
        var _rd = canvas.getBoundingClientRect(); lx0 = e.clientX - _rd.left; ly0 = e.clientY - _rd.top; touch(); e.preventDefault();
    });
    /* 屏幕坐标 → 射线（整平拖刷用；与 hover/pickAt 同一套换算） */
    function _rayOfEvent(cv, ev) {
      var r = cv.getBoundingClientRect();
      if (!r.width) return null;
      var nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
      var ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
      var rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(nx, ny), cam);
      return rc;
    }
    /* 屏幕点 → 地面点（世界坐标）。地表模式打地砖，轨道模式打拾取壳；
       打空返回 null（看着天空时拖拽就什么都不做，比乱猜一个点稳）。 */
    function _groundPtAt(cx, cy) {
      var rc = _rayOfEvent(canvas, { clientX: cx, clientY: cy });
      if (!rc) return null;
      var tgt = (M._surf && SR && SR.plate) ? SR.plate : M._collider;
      if (!tgt) return null;
      var h = rc.intersectObject(tgt, false);
      return h.length ? h[0].point.clone() : null;
    }
    /* v92.240k：放置模式的幽灵预览 —— 鼠标在地图上移动，幽灵跟到那一格。
       只在**手持物品时**才发射线（否则白白每帧 raycast）；同一格不重复重建。 */
    canvas.addEventListener('mousemove', function (e) {
      var ui = GAME.ui;
      /* v157.15：整平拖刷 —— 按住左键时每一帧都把这格削/填平 */
      if (M._terraceDrag && M.TOOL === M.TOOL_TERRACE) {
        try {
          var rcD = _rayOfEvent(canvas, e);
          var gpD = rcD ? M.pickGroundPoint(rcD) : null;
          if (gpD) { if (M._terraceErase) M.terraceClearAt(gpD); else M.terraceStrokeAt(gpD); }
        } catch (eD) { }
        if (M.mode === M.MODE_BUILD) {
          try {
            var gD = M.gridCellAt(M.pickGroundPoint(_rayOfEvent(canvas, e)));
            if (gD) M.gridHighlight(gD.i, gD.j, false);
          } catch (eD2) { }
        }
        var hd = GAME.ui && GAME.ui.tipHide; if (hd) hd();
        return;
      }
      /* v158.39：按住左键连铺 —— 每跨一格落一件，同格不重复放。 */
      if (M._placeDrag && M.mode === M.MODE_BUILD && ui && ui._placeItem) {
        try {
          var rcP = _rayOfEvent(canvas, e);
          var gpP = rcP ? M.pickGroundPoint(rcP) : null;
          if (gpP) {
            var gP = M.gridAt(gpP);
            if (gP) M.gridHighlight(gP.i, gP.j, false);
            var rP = M.placeAtPoint(gpP, { silent: true, dedupe: true });
            if (rP && rP.ok && !rP.skipped && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
          }
        } catch (ePD) { }
        var hdP = GAME.ui && GAME.ui.tipHide; if (hdP) hdP();
        return;
      }
      if (!ui || (!ui._placeItem && !ui._plantTool) || !M._collider) return;
      var r0 = canvas.getBoundingClientRect();
      if (!r0.width) return;
      var nx0 = ((e.clientX - r0.left) / r0.width) * 2 - 1, ny0 = -((e.clientY - r0.top) / r0.height) * 2 + 1;
      var rc0 = new THREE.Raycaster();
      rc0.setFromCamera(new THREE.Vector2(nx0, ny0), cam);
      /* v158.39：幽灵与落位统一走 pickGroundPoint —— 旧版幽灵打光滑球壳、
         落位打真实地砖，坡地上会差一格。 */
      var _pt0 = M.pickGroundPoint(rc0);
      if (!_pt0) {
        if (M._ghostCi !== -1) { M._ghostCi = -1; M.clearGhost(); redraw(); }
        if (ui._plantTool && M.gridHighlight) M.gridHighlight(null);
        return;
      }
      /* v157.26：幽灵跟的是**方格**（与地砖、整平、落位同一套坐标），
         不再走六边形 pickCiByRay —— 否则"幽灵在方砖 A、物件落到六边形 B"。 */
      var _g0 = M.gridAt(_pt0);
      if (!_g0) {
        if (M._ghostCi !== -1) { M._ghostCi = -1; M._ghostIJ = null; M.clearGhost(); redraw(); }
        if (ui._plantTool && M.gridHighlight) M.gridHighlight(null);
        return;
      }
      if (ui._plantTool) { if (M.gridHighlight) M.gridHighlight(_g0.i, _g0.j, true); redraw(); return; }
      if (M._ghostIJ && M._ghostIJ[0] === _g0.i && M._ghostIJ[1] === _g0.j) return;
      M._ghostIJ = [_g0.i, _g0.j];
      M._ghostCi = _g0.i;
      M.ghost(ui._placeItem, _g0.i, _g0.j, M.PLACE_YAW || 0);
      redraw();
    });
    /* ============================================================
     * v156.17（老板：「各颜色地块是啥意思，能不能悬停显示」）
     * ------------------------------------------------------------
     * 悬停 = 一格一张小卡：**地形 + 等级 + 它是什么 + 点它能干什么**。
     * 颜色只表达地形，所以先回答"这一格是什么地形"，再回答"上面有什么"。
     * 三条边界：
     *   ① 节流 90ms —— 每帧 raycast 太浪费（放置模式那条已经证明单次很便宜，但没必要）；
     *   ② 拖拽转视角时不弹（`drag` 为真就静默），离开画布即收起；
     *   ③ 只在正式期弹（前传另有 HUD 指路，别两套提示打架）。
     * ============================================================ */
    var _hovLast = 0, _hovCi = -1;
    canvas.addEventListener('mousemove', function (e) {
      if (!M._collider || drag) return;
      /* ⛔ v157.85：前传"不弹悬停卡"的判断已删。 */
      var now = (Date.now ? Date.now() : 0);
      if (now - _hovLast < 90) return;
      _hovLast = now;
      var ui2 = GAME.ui;
      if (!ui2 || !ui2.showMapCellTip) return;
      var r1 = canvas.getBoundingClientRect();
      if (!r1.width) return;
      var nx1 = ((e.clientX - r1.left) / r1.width) * 2 - 1;
      var ny1 = -((e.clientY - r1.top) / r1.height) * 2 + 1;
      var rc1 = new THREE.Raycaster();
      rc1.setFromCamera(new THREE.Vector2(nx1, ny1), cam);
      var h1 = rc1.intersectObject(M._collider, false);
      /* ============================================================
       * v157w：**贴地平视时 `_collider` 根本打不到**
       * ------------------------------------------------------------
       * `_collider` 是 R+0.6 的光滑球（只用于拾取）。地表模式下相机在
       * R+地形+几米、视线几乎**切向**（贴地平视）——射线从球面掠过，不相交。
       * 实测贴地 5 米时 6 个屏幕点 `colHit` 全是 0，而同一束射线打地砖
       * 却能正常命中（ground/cell 都有值）。
       * 所以"命中 _collider"**不能当地表模式的前置条件**，否则悬停和点击
       * 全部静默失效（表现为"点了没反应 / 悬停不亮"）。
       * ============================================================ */
      if (!h1.length && !M._surf) { if (_hovCi !== -1) { _hovCi = -1; ui2.tipHide(); } return; }
      var p1 = h1.length ? h1[0].point : null;
      /* ============================================================
       * v157v：**建造模式只认四边形**（老板：「不再捡取六边形地块数据，
       *        而改识别四边形地块数据」）
       * ------------------------------------------------------------
       * 这一段**完全不碰 ci**：射线打真实地面 → 世界点 → 弧长坐标 → (i,j)。
       * 顺带把地块情报条也关掉 —— 建造时你关心的是"这一格放不放得下"，
       * 不是"这里是什么地形、归谁管"。
       * ============================================================ */
      if (M.mode === M.MODE_BUILD) {
        var _gp = M.pickGroundPoint(rc1);
        var _gc = M.gridCellAt(_gp);
        if (_gc) { M.gridHighlight(_gc.i, _gc.j, false); M._hoverCell = _gc; }
        else { M.gridHighlight(null); M._hoverCell = null; }
        ui2.tipHide();
        return;
      }
      /* v157d：统一走 pickCiByRay —— 地表模式 raycast 地砖本身，
         轨道模式用光滑球点（远景下足够准）。 */
      var ci1 = pickCiByRay(rc1, p1);
      if (ci1 < 0) { ui2.tipHide(); return; }
      /* ⛔ v157.37（老板：「近地面不应该再出现六边形地块的操作」）：
         原来这里每悬停一次就在脚下点亮**一个六边形**——那是"地图语言"，
         贴在 2 米地面上就是一块六边形的怪斑，还和方形地砖抢视觉。
         地表的地块身份由 **地砖（方形）+ 地块涂色** 表达，六边形高亮全部退场。
         建造模式走上面的 gridHighlight 分支，不经过这里。 */
      if (M._surf) {
        /* v158.15（老板「六边形地块碍事」→ 选「近地面全退」）：这里原来会点亮**整格六边形**，
           实测 6 米跟随视角下约占屏宽 90%、把脚下草地整片染青，且不输出任何信息。
           现在**什么都不画** —— 悬停高亮已整条退役（见 2367 行墓碑）。
           近地面"指着哪一格"由地砖本身表达；"能交互什么"由底栏 E 提示表达。
           保留 tipHide：地表不弹地图浮签的口径不变（与 v157.56「线条太杂」同源）。 */
        ui2.tipHide(); return;
      }
      if (ci1 === _hovCi) { ui2.showMapCellTip(M.cellBrief(ci1), e.clientX, e.clientY); return; }
      _hovCi = ci1;
      ui2.showMapCellTip(M.cellBrief(ci1), e.clientX, e.clientY);
    });
    canvas.addEventListener('mouseleave', function () {
      if (M.mode === M.MODE_BUILD) { M.gridHighlight(null); M._hoverCell = null; }
      _hovCi = -1;
      if (GAME.ui && GAME.ui.tipHide) GAME.ui.tipHide();
    });
    window.addEventListener('mousemove', function (e) {
      /* v158.56（老板「鼠标指示飞行的方向」）：飞行态在画布上移动鼠标即
         更新目标航向（唯一入口 _flyAimAt）。
         ⚠️ 判定用**画布 rect 命中**而不是 `e.target === canvas`：地图上有
         透明 UI 层时会命中覆盖元素，target 判等直接失效（截图探针实测
         准星元素从未创建）。按钮/链接/输入框上不抢，避免点 UI 时飞船乱转。 */
      try {
        if (M._fly && M._fly.active && !M._surf) {
          var _tg56 = (e.target && e.target.tagName) || '';
          var _rc56 = null;
          try { _rc56 = canvas.getBoundingClientRect(); } catch (eRC) { _rc56 = null; }
          var _in56 = !_rc56 || (e.clientX >= _rc56.left && e.clientX <= _rc56.right
            && e.clientY >= _rc56.top && e.clientY <= _rc56.bottom);
          if (_in56 && _tg56 !== 'BUTTON' && _tg56 !== 'A' && _tg56 !== 'INPUT'
              && _tg56 !== 'TEXTAREA' && _tg56 !== 'SELECT') {
            M._flyAimAt(e.clientX, e.clientY);
            if (GAME.ui && GAME.ui.renderFlyCross) {
              GAME.ui.renderFlyCross(e.clientX, e.clientY, !!M._fly.aim);
            }
          }
        }
      } catch (eAim) { }
      /* ============================================================
       * v158.21（老板「视野外不能点击。不能点击我怎么左键进行拖动」）
       * ------------------------------------------------------------
       * 地表模式的相机朝向由 **`M._surfDir`** 决定（placeCamera 的地表分支不读 camO.quat），
       * 所以左键轨道拖拽在贴地时"改四元数"等于白改 —— 实测拖 200px 只走了 Δyaw=0.0008。
       * 现在贴地时左键也走"环视"这条唯一出口（与右键 lookDrag 同一套数学），
       * 拖动 = 绕站立者转视线：左右环视 / 抬头低头，任何方向都有回应。
       * ============================================================ */
      /* v158.36（从零实测：「右键在地表完全无效」）
       * ------------------------------------------------------------
       * 病根：v158.28 给左键加了「只选不转」后，这个分支用 `drag && !lookDrag`
       * 把右键也吞了 —— 右键在 mousedown 只设 _rmbOrbit、不设 lookDrag，
       * 于是落到这儿被当成左键，拖动只标 moved、相机一毫米不动。
       * 老口径 v158.27 明确：地表右键 = 绕角色转（_surfOrbitYaw + 俯角）。
       * 修法：右键越过「左键只选」分支，落到下方 lookDrag 语义区；
       * 那里已有完整的 _surfOrbitYaw / SURF_CAM_EL 写入（v158.27 那条）。
       */
      if (M._surf && drag && !lookDrag && !M._rmbOrbit && M.SURF_AVATAR !== false && !M._panDrag) {
        var _sdx2 = e.clientX - lx, _sdy2 = e.clientY - ly;
        if (Math.abs(_sdx2) + Math.abs(_sdy2) < 1) return;
        lx = e.clientX; ly = e.clientY;
        if (Math.abs(_sdx2) + Math.abs(_sdy2) > 3) M._rmbMoved = true;
        /* ============================================================
         * v158.28（老板「什么时候左键变成了转动相机角度了？」「左键只选择地图元素，
         *          不转动相机」）—— **整段停用**。
         * 这里从 v157.23 起是"地表左键 = 转头"，v158.22 又改成"绕角色转"，
         * 两次都是"左键转相机"。老板现在的口径是左键**只选**，位移交给边缘推镜
         * （`_tickEdgePan`）。所以拖拽只标 moved（防松手被当点击），相机一毫米不动。
         * ============================================================ */
        /* v158.36（从零实测抓到）：上面注释写的是"拖拽只标 moved（防松手
           被当点击）"，但代码写成了 `M._rmbMoved` —— 那个字段**只写不读**，
           mouseup 判据 `if (!wasDrag || moved) return;` 认的是局部 `moved`。
           于是地表左键拖 216px 后松手仍走 `M.pickAt()` → 触发"点哪走哪"
           → 小人走过去、相机跟着移动 1.84 米（p_edgepan⑤ 实测 ΔcamPos
           =[-0.056,-1.396,1.187]）。修法：把标记写给真正被读的 `moved`。
           M._rmbMoved 保留只写形态（历史字段，它不是本轮引入的）。 */
        if (Math.abs(_sdx2) + Math.abs(_sdy2) > 3) moved = true;
        /* v158.22 的"绕角色转"整段收进开关里：默认 `LEFT_DRAG_CAM = false` —— 左键不动相机。
           要恢复旧手感只改这一个常量（不是删代码，也不是留不可达分支）。 */
        if (M.LEFT_DRAG_CAM) {
          if (_sdx2) M._surfOrbitYaw -= _sdx2 * 0.0035;
          if (_sdy2) M.SURF_CAM_EL = Math.max(M.SURF_CAM_EL_MIN, Math.min(M.SURF_CAM_EL_MAX, M.SURF_CAM_EL + _sdy2 * 0.0018));
          touch(); redraw();
        }
        return;
      }
      /* v158.36：右键同样越过这个「转头(_surfDir)」分支，落到 lookDrag 的
         绕角色转(_surfOrbitYaw)，与 v158.27 的键位口径一致。 */
      if (M._surf && drag && !lookDrag && !M._rmbOrbit && !M._panDrag) {
        var _sdx2 = e.clientX - lx, _sdy2 = e.clientY - ly;
        if (Math.abs(_sdx2) + Math.abs(_sdy2) < 1) return;
        lx = e.clientX; ly = e.clientY;
        if (Math.abs(_sdx2) + Math.abs(_sdy2) > 3) moved = true;
        var _radS2 = new THREE.Vector3(cam.position.x, cam.position.y, cam.position.z).normalize();
        var _dS2 = (M._surfDir ? M._surfDir.clone()
          : new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)).normalize();
        if (_sdx2) {
          var _aY2 = TURN.lookYaw.surf * _sdx2 * M.TURN_K_LOOK;
          if (Math.abs(_dS2.dot(_radS2)) > 0.999) {
            if (M._surfRight) M._surfRight.applyAxisAngle(_dS2, _aY2).normalize();
          } else {
            _dS2.applyAxisAngle(_radS2, _aY2).normalize();
            if (M._surfRight) M._surfRight.applyAxisAngle(_radS2, _aY2).normalize();
          }
        }
        if (_sdy2) {
          var _rS2 = _surfRightOf(_dS2, _radS2);
          _dS2.applyAxisAngle(_rS2, -TURN.lookPitch.surf * _sdy2 * M.TURN_K_SURF).normalize();
        }
        M._surfDir = _dS2;
        M._surfHold = true;
        _surfTilt = null;
        touch(); redraw(); return;
      }
      if (lookDrag) {
        var _dx = e.clientX - lx, _dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
        /* ============================================================
         * v158.53（无人深空范式）：高空右键拖 = **直接转机头**。
         * 旧版这里写 camO.lookYaw/lookPitch（视线偏移），而航向 fly.head
         * 由键盘另管 —— 实测右键转 86°、机头转 0°，即"看这边、飞那边"，
         * 老板原话"鼠标右键完全不知道自己在哪里"。正解：左右拖绕径向
         * 偏航机头、上下拖绕机体 right 俯仰机头，眼到机到。
         * 地表/非飞行态仍走下方旧 lookYaw/lookPitch 分支（那是环视/转头）。
         * ============================================================ */
        if (!M._surf && M._fly && M._fly.active && M._fly.head
            && (lookDrag === 1) && (!M.FOLLOW)) {
          /* ============================================================
           * v158.55（老板「右键长按拖动，越过屏幕中线 → 近乎 180° 翻转，
           *   一下正面一下背面快速切换」）—— 根因是旧式旋转轴退化：
           *   旧 pitch 轴 = cross(radial, head)：当 head 趋向 ±radial（正对/
           *   背对球心，即"越过中线"）时叉乘 → 0，兜底 (1,0,0) 与真实右向
           *   反向 → 轴每帧翻 180°，机头在正/背面之间高频弹跳（探针实测
           *   head·rad 越过 0.998 后连翻 21 次）。yaw 轴用 radial 也有同病：
           *   head∥radial 时绕 radial 转 = 机体自转，左右拖看不见转向。
           *   正解（无人深空式机体基）：yaw 绕**机体 up**、pitch 绕**机体
           *   right = cross(head, up)** —— 二者与 head 恒正交，正对球心处
           *   不退化；head 与 up 一起旋转，机基始终自洽，绝不弹跳。
           * ============================================================ */
          var _K = (M.FLY_LOOK_K || 0.0042);
          var _fh = _flyVec(M._fly.head).normalize();
          var _fu = M._fly.up ? _flyVec(M._fly.up) : null;
          if (!_fu) {
            var _fp0 = _flyVec(M._fly.pos);
            _fu = (_fp0.lengthSq() > 1e-8) ? _fp0.normalize() : new THREE.Vector3(0, 1, 0);
          }
          /* 防御：up 必须 ⊥ head（_tickFlight 每帧已正交化，这里再兜一次） */
          _fu.addScaledVector(_fh, -_fu.dot(_fh));
          if (_fu.lengthSq() < 1e-8) {
            var _frad0 = _flyVec(M._fly.pos).normalize();
            _fu.crossVectors(_frad0, _fh);
            if (_fu.lengthSq() < 1e-8) _fu.crossVectors(new THREE.Vector3(0, 1, 0), _fh);
            if (_fu.lengthSq() < 1e-8) _fu.crossVectors(new THREE.Vector3(1, 0, 0), _fh);
          }
          _fu.normalize();
          var _qLook = new THREE.Quaternion();
          /* 左右拖 = 绕机体 up 偏航（head 正对球心时仍是真转向，不是自转） */
          if (_dx) {
            _qLook.setFromAxisAngle(_fu, -_dx * _K);
            _fh.applyQuaternion(_qLook); _fu.applyQuaternion(_qLook);
          }
          /* 上下拖 = 绕机体 right 俯仰；right = cross(head, up) 与 head 恒正交，
             正对球心不退化 —— 这是消除 180° 翻转的关键。 */
          var _fright = new THREE.Vector3().crossVectors(_fh, _fu).normalize();
          if (_dy) {
            _qLook.setFromAxisAngle(_fright, -_dy * _K);
            _fh.applyQuaternion(_qLook); _fu.applyQuaternion(_qLook);
          }
          _fh.normalize(); _fu.normalize();
          /* v158.56：手动转头优先 —— 清掉鼠标指示，否则下一帧 aim 会把机头
             拉回鼠标指的旧方向（玩家会觉得"拖了没用"）。鼠标再动会重设 aim。 */
          M._fly.aim = null;
          M._fly.head = [_fh.x, _fh.y, _fh.z];
          M._fly.up = [_fu.x, _fu.y, _fu.z];
          if (Math.abs(_dx) + Math.abs(_dy) > 3) moved = true;
          touch(); redraw(); return;
        }
        /* 两个轴同一规则：**画面内容跟手**（见下方 v157g 注释）。
           右拖 = 内容右移（yaw 减）；下拖 = 内容下移（lookPitch 增）。 */
        /* ============================================================
         * v156.51（老板「目前相机还是始终对着球心」）——
         * 旧限幅是固定 ±0.75 弧度（43°），**远景下这个值太大**：
         *   相机在 R*2.9 时，球在视野里的张角只有 asin(R/d) ≈ 20°，
         *   偏移 43° 直接把整颗星球推出画面 → 拖完是纯黑，看着像没反应/坏了。
         * 改成**随距离自适应**：限幅 = 球半径张角 × 0.9。
         *   远景 R*2.9 → 约 18°（球一直留在画面里，拖拽有反馈）
         *   贴地 R*1.1 → 约 59°（能贴地看地平线）
         * 这样自由和不丢参照同时成立。
         * ============================================================ */
        /* ============================================================
         * v157i（老板：「转向角太小了，要求 360 度自由转向」）
         * ------------------------------------------------------------
         * 旧限幅是**随距离自适应**的（远景 asin(R/d)*0.9 ≈ 18°），
         * 目的是"别把球推出画面"。但那是抓取的顾虑，不该管转头：
         * 右键的语义是"以相机为轴心看四周"，被锁在 18° 就永远只能瞥一眼。
         *
         * 现在：水平 **±180° 环绕**（连续转一圈，越过 π 自动折回，
         * 四元数连续叠加不会跳）；垂直抬头/低头各到 89°（天顶/脚底）。
         * ============================================================ */
        /* ============================================================
         * v157.25（老板：「右键 270 度就到平行地面，没法 360 度无死角」）
         * ------------------------------------------------------------
         * 地表**不再用 lookPitch 这个角度**，而是直接转那根**视线向量**：
         *   水平：绕"站立者向上"（径向）转  → 左右环视，可以连转好几圈
         *   垂直：绕当前"右向"转            → 抬头/低头，越过天顶继续往后
         * 两处都**不夹、不折回**，所以没有"到头"这回事。
         * 画面方向由 placeCamera 用 right×d 现算，地平线恒水平 —— 转过天顶也不会翻。
         * ============================================================ */
        if (M._surf) {
          if (Math.abs(_dx) + Math.abs(_dy) > 3) M._rmbMoved = true;
          /* ============================================================
           * v158.27（老板「垃圾操作，右键往前？？？」）
           * ------------------------------------------------------------
           * 病根：星露谷相机只读 `_surfOrbitYaw` / `SURF_CAM_EL`，
           *   而这里原来写的是 `M._surfDir` —— **写了没人读**。
           *   实测：右键上拖 220px，`_surfDir` 从 (-0.51,-0.46,-0.72) 变成
           *   (0.44,-0.49,-0.76)，而相位移 **0.00 米**、画面零变化。
           *   玩家的体感就是"右键按下去什么都不对"。
           *
           * 现在右键与左键同一套语义（绕角色一圈 + 抬压俯角）：
           *   左右拖 = 绕角色转（星露谷那种"镜头绕着人走"）
           *   上下拖 = 抬高/压低镜头（v158.39 起夹 3.4°~77°，低角自动拉近，钻不到地下）
           * 两个键都有效，且都不会推动小人（位姿只由 WASD/走路驱动）。
           * ============================================================ */
          if (_dx) M._surfOrbitYaw -= _dx * 0.0035;
          if (_dy) M.SURF_CAM_EL = Math.max(M.SURF_CAM_EL_MIN, Math.min(M.SURF_CAM_EL_MAX, M.SURF_CAM_EL + _dy * 0.0018));
          M._surfHold = true;          /* 用户接管过视角：落地过渡立刻让位 */
          _surfTilt = null;
          touch(); redraw(); return;
        }
        if (Math.abs(_dx) + Math.abs(_dy) > 3) M._rmbMoved = true;
        /* v158.43：高空右键（_rmbLook）拖过也写 moved —— mouseup 的 lookDrag
           分支要用它判"拖过"（双击回正只认真单击）。中键写它无副作用。 */
        if (Math.abs(_dx) + Math.abs(_dy) > 3) moved = true;
        var _lp = camO.lookPitch + TURN.lookPitch.orbit * _dy * M.TURN_K_LOOK;
        camO.lookPitch = Math.max(-1.55, Math.min(1.55, _lp));
        var _ly = camO.lookYaw + TURN.lookYaw.orbit * _dx * M.TURN_K_LOOK;
        /* 折回 [-π, π]：超过半圈就等价回来，拖多少圈都连续 */
        camO.lookYaw = ((_ly + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        touch(); redraw(); return;
      }
      if (!drag) return;
      var _prevX = lx, _prevY = ly;      /* 抓取要用**上一帧**的鼠标点，先存下来 */
      var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      var _rc = canvas.getBoundingClientRect();
      var _cxp = e.clientX - _rc.left, _cyp = e.clientY - _rc.top;
      /* ============================================================
       * v157.80（老板复发：「高空左键旋转还有死角，有个地方无法跨过」）
       * ------------------------------------------------------------
       * 真凶不是旋转，是**松手被误判成"点击"**。
       * 旧判据 `|dx| + |dy| > 3` 只看**单帧**位移：慢拖（每帧 1~3px，
       * 高空精细对位时的常态）永远不达标 → moved 恒 false →
       * mouseup 里 `if (!wasDrag || moved) return;` 不 return，继续走点击逻辑
       * → 点在野地上就弹出出征面板盖住地图中央 → 那片区域再也收不到 mousedown。
       * 玩家的感受就是"转到某个地方卡住了 / 有个地方过不去"。
       * 实测复现（v157.80 探针）：141 步 × 3px 连续上拖，moved 全程 false，
       * 松手后 `document.elementFromPoint(画布中心)` 从 CANVAS 变成 DIV.exp-sec。
       *
       * 修法：**累计位移**也参与判定（>4px 即算拖动）。
       * 单帧 >3 保留（快拖立即识别）；手抖 1~2px 的真点选仍按点击处理。
       * ============================================================ */
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (!moved) {
        var _acx = _cxp - lx0, _acy = _cyp - ly0;
        if (_acx * _acx + _acy * _acy > 16) moved = true;
      }
      /* ============================================================
       * v157.23（老板：「地面状态左键长按拖拽总是自动先调转一个方向，
       *          然后再移动，不能自由转动，画面抖动很厉害」）
       * ------------------------------------------------------------
       * 地表左键原来走的是**抓球**（射线打地面两点 → 绕球心转相机）。
       * 那套是给轨道视角设计的：转的是"你在球外看球的位置"。
       * 落地后相机是"站在地面上"的，抓球等于让你**沿着地面挪位置**，
       * 而不是转头 —— 于是：
       *   ① 转头量根本没进 heading，画面不跟手（"不能自由转动"）；
       *   ② 相机被挪到别处 → 地形/台面重建、up 跟着 quat 变 → 抖；
       *   ③ 首帧 quat 一变，up 立刻换了个方向 → 就是"先调转一个方向"。
       * 正解：地表左键 = **直接转头**，与右键同一套映射（同一个 TURN 表），
       * 位置一点不动。轨道视角的左键抓球保持不变（那里它是对的）。
       * ============================================================ */
      if (!M._surf && drag) {
        /* 轨道里左键拖动 = 换了地方看球。上一处地表的视线不再有意义，
           清空它，下次落地重新按当前朝向推导（否则会带着旧城市的朝向落地）。 */
        M._surfDir = null; M._surfRight = null; M._surfAnchor = null;
        /* v158.28：老板「左键只选择地图元素，不转动相机」—— 左键停用；
           看别处改由**边缘推镜**（指针贴边）或右键绕中心。
           v158.36（从零实测抓到）：这道闸原文不区分左右键，把右键也一起
           `return` 了 —— p_cam_free 水平拖累计 0°、高空右键完全无响应，
           与 §615「右键绕球心」直接冲突。修法：只拦左键，右键越闸落到
           下方 v157.101 轨迹球抓球（与地表右键 v158.36 修复同型）。 */
        if (M.LEFT_DRAG_CAM === false && !M._rmbOrbit) { touch(); redraw(); return; }
      }
      if (M._surf && M._panDrag) {
        /* ============================================================
         * v157.54：纯增量平移 —— 输入只来自「鼠标增量 + 按下时冻结的基准」。
         * ------------------------------------------------------------
         * 已退役：每帧用当前相机重新拾取地面命中点、再拿锚点减它全量补回。
         *   那是反馈回路（输入依赖自己的输出），贴地掠射角下按 1/sin²θ 放大，
         *   探针实测单帧 7.883 米（4.637 倍眼高）、90 帧内方向反转 25 次；
         *   且它改了半径却没同步 _zoomTarget，placeCamera 每帧把半径拉回
         *   —— 方向已变、半径被拽回，玩家看到「整个画面元素一起跳」。
         * 现在 panStepOf 是纯函数（无 THREE / 无相机 / 无射线）：
         *   位移 = −(dx·ex + dy·ey)，单帧 ≤ 半个眼高，坏值直接跳过本帧。
         * ⚠️ **不写 camO.dist**：把新位置归一化到按下时冻结的半径即可。
         *   半径一寸不动 → 滚轮阻尼（_zoomTarget）完全不受拖拽干扰；
         *   反过来在这里调 _syncZoom()，会把用户正在逼近的滚轮目标改掉。
         * ⚠️ 不改 _surfDir / _surfRight：视线归玩家，平移只搬位置、不转头。
         * ============================================================ */
        var _B54 = M._panBasis;
        if (_B54 && _B54.ok && isFinite(_B54.dist) && _B54.dist > 0) {
          var _st54 = M.panStepOf(dx, dy, _B54);
          if (_st54.ok) {
            var _np54 = new THREE.Vector3(camO.dir[0], camO.dir[1], camO.dir[2])
              .multiplyScalar(_B54.dist)
              .add(new THREE.Vector3(_st54.x, _st54.y, _st54.z));
            var _nl54 = _np54.length();
            if (isFinite(_nl54) && _nl54 > 1e-6) {
              _np54.multiplyScalar(_B54.dist / _nl54);  /* 半径归一：camO.dist 保持原值 */
              var _u54 = 1 / _B54.dist;
              camO.dir = [_np54.x * _u54, _np54.y * _u54, _np54.z * _u54];
              /* v157.83：这里原来用 setFromUnitVectors 顺手建 quat —— 与 placeCamera
                 的 turntable 构造是两套姿态口径（roll 不同）。地表模式虽然由
                 `cam.up + lookAt` 覆盖朝向，但一旦退回轨道就会带着这条"最短弧"
                 姿态（roll 随纬度）。现在统一成：**姿态只由 placeCamera 重建**。 */
              camO.quat = null;
              camO.yaw = Math.atan2(camO.dir[0], camO.dir[2]);
              camO.pitch = Math.asin(Math.max(-1, Math.min(1, camO.dir[1])));
              camO._euler = null;              /* 置空 → 下帧必重建，与 dir 同一来源 */
              /* 落定过渡曾在无人操作时改俯角 —— 用户一旦平移就接管镜头 */
              M._surfHold = true;
              touch(); redraw();
            }
          }
        }
        return;
      }
      /* ⛔ v158.21（老板「视野外不能点击。不能点击我怎么左键进行拖动」）：
         这里原来是 `if (M._surf) { touch(); redraw(); return; }` ——
         地表模式**没抓到地面点**（看着天空、或者鼠标在有限平台的界外）就什么都不做。
         配合方形的有限平台，玩家在边界外按住左键完全没反应，等于被锁在正方形里。
         现在不 return，落到下面的轨道拖拽：没抓到手，就用"转球"的方式给一个回应。 */
      /* ============================================================
       * v156.55（老板「右键的相机，我希望是相机绕球心运动，
       *          而不是在视野内摆弄球体」）—— **轨道相机：无 roll、无翻越**
       * ------------------------------------------------------------
       * 前两版都在试图"翻过极点"，但**轨道相机的语义就是绕球心**：
       *   相机在球面外侧走，up 恒定竖直 → 地平线永远水平、球不倾倒。
       *   到极点自然停住（这不是"轴限制"，是绕行的边界），要看另一面就转经度。
       *
       * 而"翻越"用反射实现必然在折点附近抖：
       *   反射是折叠映射，π/2 是它的不动点；拖拽步长一小，就会反复穿越阈值，
       *   每穿一次 yaw += 180° —— 实测 yaw 冲到 98（每帧转 180°），就是老板看到的震颤。
       * 所以：**纬度 clamp，经度自由**。想翻过去就转经度（水平拖），不受限。
       * ============================================================ */
      /* ============================================================
       * v156.58（老板「跨不过中轴线，无法接着滚动南极到北极形成一个圆」）
       * ------------------------------------------------------------
       * **纬度不设上限**。之前的 clamp（±89°）和反射折叠都会"停在极点"，
       * 而老板要的是**沿经线无限滚动**：北极 → 南极 → 再回北极，一个完整的圆。
       *
       * 数学上这是天然成立的：位置方向 = (cos p·sin y, sin p, cos p·cos y)，
       * sin/cos 对任意实数 p 都有定义且连续 ——
       *   p=90°  → 北极 (0,1,0)
       *   p=180° → 对面赤道 (-sin y, 0, -cos y)
       *   p=270° → 南极 (0,-1,0)
       *   p=360° → 回到出发点
       * 所以只要**不 clamp**，拖拽就是连续的圆周运动，不会有边界、不会震颤。
       * 渲染时用 asin(dir.y) 把角度折回 ±90°（自动、无跳变），
       * 经度由 atan2(dir.x, dir.z) 现算 —— 两者都从 dir 派生，永远一致。
       * ============================================================ */
      /* ============================================================
       * v156.59：**arcball**（真正的空间自由球）
       * ------------------------------------------------------------
       * 不再改 yaw/pitch —— 那是球坐标，过极点必跳。
       * 把两次鼠标位置映射到单位球面两点 v0→v1，绕 (v0×v1) 转 acos(v0·v1)：
       *   · 轴和角都从两点现算，任意方向连续，没有任何极点；
       *   · 屏幕边缘拖拽时降级到双曲覆盖（点投影到球外 → 用圆盘边缘），
       *     所以怎么甩都不会卡住。
       * 效果就是用手指拨一个实体球：正着转、斜着转、倒着转都行。
       * ============================================================ */
      /* ============================================================
       * v156.62（老板「我要的是任意点位地形跟着鼠标走，而不是换了南北就有变化」）
       * ------------------------------------------------------------
       * 上一版用 arcball：旋转轴 = 屏幕两点叉积，**映射到世界空间**。
       * 于是球一旦转到"倒过来"的姿态，屏幕的上下和世界的上下不再一致，
       * 同一个拖动方向的效果就反了 —— 这正是"换了南北就有变化"。
       *
       * 要让**任意姿态都跟手**，旋转必须施加在**相机自身坐标系**里：
       *   拖右 → 绕相机局部 Y 轴转；拖上 → 绕相机局部 X 轴转；
       *   用 `quat.multiply(q)`（右乘 = 局部空间）而不是 premultiply（世界空间）。
       * 局部轴永远与屏幕对齐，所以不管球转到哪个姿态，"拖哪边内容就往哪边走"。
       * 代价：球会倾倒（up 跟着转）—— 这是自由球的必然，按「正位」可回正。
       * ============================================================ */
      /* ============================================================
       * v157c（老板：「目前的上下左右（左键拖动）是斜角的」）
       * ------------------------------------------------------------
       * 根因：上一版用**局部空间四元数累积**
       *   `quat.multiply(qy).multiply(qx)`
       * —— 第二次旋转的轴已经被第一次转过了。只要拖过一次水平方向，
       * 局部 Y 就不再是屏幕竖直方向，之后斜向拖动必然"斜着滚"，
       * 而且 roll 会一路累积（球越拖越歪）。
       *
       * 改成**欧拉角**：水平拖只改 yaw、垂直拖只改 pitch，两者互不干扰，
       * roll 恒为 0 —— 拖右就是水平转、拖上就是垂直翻，不存在斜角。
       * 代价是不再有"球可以倒过来"的自由姿态；老板要的正是"以球心为支点
       * 转动球体"，球绕球心转、北极仍朝上，这才是球体该有的行为。
       * （纬度不 clamp，p 可以无限增长 → 仍能从北极滚到南极连成一个圆；
       *   渲染时 dir 由 sin/cos 现算，越界自动折回，不会跳。）
       * ============================================================ */
      /* ============================================================
       * v157h（老板：「高空左键上下左右又崩了，不该动的别动，
       *        实现上一次通过的转向效果，统一所有转向效果」）
       * ------------------------------------------------------------
       * 用基准图/拖动图直接比对（湖的位置）定下的**唯一契约**：
       *   下拖 → 画面内容**向下**走（跟手）；右拖 → 内容**向左**走。
       * 之前崩的真正原因不是符号，是**左右键没联动**：
       *   左键已经改成"下拖内容下移"，右键还留在"下拖内容上移"，
       *   两个键方向相反 → 一用就乱 → "上下左右全崩"。
       *
       * 四个位置现在都满足同一条契约（实测见 .workbuddy/memory 当日表）：
       *   · 轨道左键 pitch += dy（相机北移 → 内容下移）
       *   · 轨道右键 lookPitch += dy（抬头 → 内容下移）
       *   · 地表左键 lookPitch -= dy（抬头 → 内容下移；地表正=低头，故取反）
       *   · 地表右键 lookPitch -= dy
       * ⚠️ 符号在两种场景**必须不同**（pitch 的语义相反），这就是"分场景联动"。
       *    改任何一处都要重跑 4×2 矩阵，别再凭"统一符号"推断。
       * ============================================================ */
        /* ⛔ v157.81：这里原有 v157i 的「抓取球面交点」方案说明 —— 该方案已整条退役。
           它有三个修不掉的问题（都实测过）：
             ① 相机在球外时球轮廓被压成极窄一条，鼠标拖到那儿交点几乎不动
                → `dir.y` 爬到 ±0.93（≈±68.6°）就停住回头，极点永远到不了；
             ② 每帧要打两次 raycast 求交，纯属浪费；
             ③ 算完还要"从四元数反算 yaw/pitch"，而反算用的 asin 会把值域折回
                [−π/2, π/2] —— 这正是"滚过极点就来回打转"的根源。
           现行方案 = **pitch/yaw 纯累加**（见下方 v157.80 段），不依赖任何射线，
           也不做任何反算。 */
      var _rcG = canvas.getBoundingClientRect();
      if (_rcG.width > 0 && cam) {
        /* v157.81：`_ndcG` / `_rayG` 与交点 `_P0`/`_P1`、以及 `_tgtG` 的两次求交
           —— 整段退役。它们唯一的消费者是上面那条 `else if (_P0 && _P1)`，
           该分支永远不可达（`M._surf` 已在更早处 return）。
           顺带每帧省掉两次 `intersectObject`。 */
        /* ============================================================
         * v157.80（老板复发：「高空左键旋转还有死角，有个地方无法跨过」·
         *          「你就不能借鉴现有成熟的方案吗」）
         * ------------------------------------------------------------
         * 轨道旋转 = **球坐标双角度纯累加**（pitch / yaw），**不做归一化**。
         *
         * 为什么这样就没有死角 —— 关键在 placeCamera 的求向公式：
         *     dir = ( cos(p)·sin(y),  sin(p),  cos(p)·cos(y) )
         *   pitch 超过 ±π/2 时 cos(p) 自然变负，dir 平滑绕到球的另一侧。
         *   也就是说这个公式**本来就支持 pitch 无限累加**，
         *   越极点是连续的，不需要任何"翻转/折回"的补丁。
         *
         * 三次失败的真正原因（都已实测排除）：
         *   ① **抓球面交点**（v157i~v157.78 主路径）：相机在球外时球的最上/下
         *      轮廓在屏幕上被压成极窄一条，鼠标拖到那儿交点几乎不动 →
         *      灵敏度衰减到 0。实测 dir.y 爬到 ±0.93（≈±68.6°）就停住回头。
         *   ② **arcball（屏幕→单位球）**：球内均匀，但球外是死区 ——
         *      圆外点按 1/|v| 投到赤道，沿径向拖时方向不变。
         *      实测"从画布左下斜拖到右上"130 帧里 34 帧完全不动。
         *   ③ **累加 + 跨极点归一化**（v157.78 那版）：数学等价，但
         *      `yaw += nπ` 让视角突变半圈，与 asin 反算混用会震荡；
         *      实测某一轮只走了 3.2°。
         *
         * 本版：**只保留累加，删掉归一化**。pitch 可以为 π/1.5、2π−0.3…
         * 任何值，(cos p, sin p) 自己就把姿态映射回来；一次拖动转几圈都连续。
         * 地表模式（`M._surf`）不参与，仍走抓地砖。
         * ============================================================ */
        /* ============================================================
         * v158.21（老板「视野外不能点击 · 不能左键拖动 · 近地面视野是正方形」）
         * ------------------------------------------------------------
         * 原来这里是 `if (!M._surf) { ... }` —— **地表模式整段跳过轨道拖拽**，
         * 理由是"地表走抓地砖"，而那个 `else if (_P0 && _P1)` 分支 v157.81 就删了。
         * 净效果：贴地时鼠标左键**完全拖不动**，再配上方形的 45×45 平台边界，
         * 玩家被锁在一口正方形井里。
         * 现在地表也走同一套轨迹球：拖动 = 绕球心转，视野随之平移（不是地面翻滚，
         * 因为贴地时 camO.dist 固定在 R+眼高，转的是视线方向）。
         * ============================================================ */
        if (true) {
          var _sdxv = e.clientX - _prevX, _sdyv = e.clientY - _prevY;
          var _K = 0.005;                       /* 弧度/像素：拖满一屏约 180° */
          if (M.CAM_TRACKBALL) {
            /* ============================================================
             * v157.101：**轨迹球**（老板「球体转动过不了轴线」的最终解）
             * ------------------------------------------------------------
             * 旧法 = 转台：pitch 只能 ±90°，dir.y = sin(pitch) 恒 ≥ 0 —— 极点就是奇点，
             *   拖过去只会沿原经线折回赤道，永远进不了南半球（探针实测 dir.y 从不为负）。
             * 新法 = 把拖动量直接累积成四元数（TrackballControls 语义）：
             *   水平拖 → 绕**世界 Y**；竖直拖 → 绕**相机当前的右轴**。
             *   于是可以自然翻过任意极点；代价是 roll 会随之产生 —— 老板已明确接受。
             * ============================================================ */
            if (!camO.quat) {
              camO.quat = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(-camO.pitch, camO.yaw, 0, 'YXZ'));
            }
            var _upT = new THREE.Vector3(0, 1, 0);
            var _rightT = new THREE.Vector3(1, 0, 0).applyQuaternion(camO.quat);
            var _dqY = new THREE.Quaternion().setFromAxisAngle(_upT, -_sdxv * _K);
            var _dqP = new THREE.Quaternion().setFromAxisAngle(_rightT, -_sdyv * _K);
            camO.quat = _dqP.multiply(_dqY).multiply(camO.quat).normalize();
            var _dvT = new THREE.Vector3(0, 0, 1).applyQuaternion(camO.quat);
            camO.dir = [_dvT.x, _dvT.y, _dvT.z];
            camO.yaw = Math.atan2(_dvT.x, _dvT.z);
            camO.pitch = Math.asin(Math.max(-1, Math.min(1, _dvT.y)));
            camO._euler = null;                 /* 交给 placeCamera；轨迹球模式它不会重建 */
          } else {
            camO.pitch += _sdyv * _K;           /* 下拖 = 内容下移（相机北移） */
            camO.yaw -= _sdxv * _K;             /* 右拖 = 内容左移 */
          }
          /* 浮点保险：转几十圈后把角度折回一个周期 —— 2π 是 dir 的周期，
             折回**不改变姿态**，所以不会跳（这与"跨极点归一化"是两件事）。 */
          if (camO.pitch > 1e4 || camO.pitch < -1e4) camO.pitch %= (Math.PI * 2);
          if (camO.yaw > 1e4 || camO.yaw < -1e4) camO.yaw %= (Math.PI * 2);
          /* ============================================================
           * v158.23（老板「星球在场景中固定，相机视角应该能自由连续到达任何角度」）
           * ------------------------------------------------------------
           * 病灶就在这一行：上面刚把拖动累积成四元数（可以翻过任意极点），
           * 这里**无条件清掉它**，让 placeCamera 按 `yaw/pitch` 重建。
           * 而 pitch 是 `asin(dir.y)` —— 主值域只有 ±90°：
           *   · 跨极点的信息（roll、以及"越过天顶后继续走"）在这一步全丢；
           *   · 拖过天顶只会沿原经线折回，**永远进不了另一半球**；
           *   · 表现为老板说的"有个地方无法跨过"。
           * 轨迹球模式下 quat 就是真值，**绝不许清**（`_dirty` 判据是 `!camO.quat`，
           * 只要它在，placeCamera 就一直用姿态本身，不回头读 yaw/pitch）。
           * ============================================================ */
          if (!M.CAM_TRACKBALL) camO.quat = null;
          camO._euler = null;
          /* ⛔ v157.81：这里原有 `} else if (_P0 && _P1)` 那个分支（抓地砖 → 反算 yaw/pitch）
             —— 死代码，已删。函数上方 `if (M._surf) { ... return; }` 已经挡住了地表模式，
             走到这里 `M._surf` 必为 false，该分支永远不可达。
             而它内部两行 `camO.pitch = asin(...)` 正是"每帧折回 pitch"的同型代码：
             哪天真有路径漏过那个 return，死角就原地复活。删掉才叫治本。 */
        }

        /* ⛔ v157.78：「边缘打空 → 退回单位球」那条分支整段退役。
           它是在"交点可能为空"的前提下写的兜底；现在轨道模式取射线方向，
           `_P0/_P1` 恒非空，那段永远不会执行 —— 留着就是死代码。
           而且它本身就是死角的一半成因：单位球在屏幕球外会把方向**折反**
           （x,y 超出单位圆时按 1/|v| 拉回边缘），拖到球边缘就变成往回转。 */
      }
      /* v157i（老板：「轴心不完全是球心」）：右键转头的偏移会残留在相机朝向上，
         带着它去抓球，视觉旋转中心就偏了。抓取时快速衰减回 0 ——
         衰减而不是清零，否则画面会"啪"地跳一下。 */
      if (camO.lookYaw || camO.lookPitch) {
        camO.lookYaw *= 0.80;
        camO.lookPitch *= 0.80;
        if (Math.abs(camO.lookYaw) < 1e-3) camO.lookYaw = 0;
        if (Math.abs(camO.lookPitch) < 1e-3) camO.lookPitch = 0;
      }
      touch(); redraw();
    });
    window.addEventListener('mouseup', function (e) {
      /* v158.39：建造模式里右键单击 = 放下手上的东西（戴森式取消）；
         右键拖过仍然照旧绕角色/球心转镜头，不会误取消。 */
      if (e.button === 2 && M.mode === M.MODE_BUILD && GAME.ui
          && (GAME.ui._placeItem || GAME.ui._plantTool) && !M._rmbMoved && !moved) {
        if (M.cancelHeldBuild) M.cancelHeldBuild();
        if (GAME.ui.toast) GAME.ui.toast('已放下手上的建造物');
      }
      if (M._placeDrag) {
        M._placeDrag = false; M._placeLastIJ = null;
        /* 按下时已经落过一件；松手不能再走 pickAt 落第二件 / 弹地块面板。 */
        drag = 0; moved = false;
        if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
        return;
      }
      /* ============================================================
       * v158.27：右键 = 抓球拖拽（绕球心）。松手只有三件事：
       *   ① 清状态；② 双击回正（两次都没拖）；③ 补一次地表重建。
       * **永远不当"点击选格"** —— 否则松手会顺手把小人送到鼠标那一格
       * （这正是"右键往前"最脏的一种可能）。
       * ============================================================ */
      if (M._rmbOrbit) {
        M._rmbOrbit = false;
        lookDrag = 0;   /* v158.36：清掉 mousedown 给地表右键设的 lookDrag=2 */
        M._panBasis = null;
        M._panDrag = false;        /* 右键也走左键那条初始化，必须把它清掉，
                                      否则下一次左键点击会被 `if (M._panDrag)` 吞掉 */
        /* ⚠️ 只认本次的 `moved`：`_rmbMoved` 会被中键/其它分支残留成 true，
           导致"右键单击"永远被判成"拖过"、双击回正失效（实测）。 */
        var _movedR = !!moved;
        drag = 0; moved = false;
        if (!_movedR) {
          var _nowRmb = Date.now();
          if (_nowRmb - (M._lastRmbUp || 0) < 320) {
            M._lastRmbUp = 0;
            if (M._surf) { M._surfOrbitYaw = 0; M.SURF_CAM_EL = 1.0; }
            else if (M.resetView) M.resetView();
            else { camO.lookYaw = 0; camO.lookPitch = 0; }
            touch(); redraw();
          } else {
            M._lastRmbUp = _nowRmb;
          }
        } else {
          M._lastRmbUp = 0;
          if (M._surf) { try { rebuildSurf(camO.dir); } catch (ePR2) { } }
        }
        return;
      }
      if (M._terraceDrag) {
        M._terraceDrag = false;
        M._terraceLastP = null;
        try { M.terraceFlush(); } catch (eTF) { }
        if (GAME.ui && GAME.ui.toast && GAME.terrain) {
          GAME.ui.toast('整平完成 · 全星球已整平 ' + GAME.terrain.count() + ' 格');
        }
        if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
        return;
      }
      if (lookDrag) {
        /* v158.43（规则变更）：高空右键改走 lookDrag=1（转头、位置不动），
           所以这里除了**中键转头**（松手即结束），还多一路 **右键转头**：
           `_rmbLook` 标记只在 mousedown 高空右键分支置位，中键不置 ——
           双击回正只认右键（与 v156.47「双击右键 = 视线回正」的能力一致）。
           地表右键走 _rmbOrbit 分支，不经过这里。
           v158.53（规则变更）：飞行态机头=视线，双击右键不再写 lookYaw/lookPitch，
           改为**回正到平飞**（机体 up 归径向、机头朝向不变）——保留"双击 = 回正"
           的能力，但语义对齐无人深空的 level out。地表态仍用旧视线回正。 */
        var _wasRmbLook = !!M._rmbLook;
        M._rmbLook = false;
        lookDrag = 0;
        if (_wasRmbLook && !moved) {
          var _nowLk = Date.now();
          if (_nowLk - (M._lastRmbLookUp || 0) < 320) {
            M._lastRmbLookUp = 0;
            if (!M._surf && M._fly && M._fly.active && M._fly.pos && M._fly.head) {
              var _lr = _flyVec(M._fly.pos).normalize();
              M._fly.up = [_lr.x, _lr.y, _lr.z];
              M._fly.aim = null;      /* v158.56：回正平飞同时清鼠标指示，否则下一帧又被拉走 */
              M._bankAngle = 0;
            } else {
              camO.lookYaw = 0; camO.lookPitch = 0;
            }
            touch(); redraw();
          } else {
            M._lastRmbLookUp = _nowLk;
          }
        }
        return;
      }
      /* 平移结束：补一次重建，让几何对齐到最终位置（节流期间可能欠了一帧）。
         ⚠️ 只有**真的拖过**才在这里 return —— 否则地表里"点一下"（放置物品 /
         选中格子）会被这行吞掉（`_panDrag` 在按下时就置位了）。 */
      if (M._panDrag) {
        M._panDrag = false; M._panBasis = null;
        if (moved) {
          try { if (M._surf) rebuildSurf(camO.dir); } catch (ePR) { }
          if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
          /* v158.43：平移后 drag 必须清零 —— 残留 1 会让悬停提示
             `if (!M._collider || drag) return;` 永久失效（既有隐患，
             LEFT_DRAG_CAM 默认关时没人走到这；诉求 1 让地表左键平移常态化后必踩）。 */
          drag = 0; moved = false;
          return;
        }
      }
      M._panBasis = null;
      var wasDrag = drag; drag = 0;
      M._lastClickDebug = { wasDrag: wasDrag, moved: moved, x: e.clientX, y: e.clientY };
      if (!wasDrag || moved) return;
      /* v153（老板：「可以在星球地表上逐格移动」）——
         前传里点地图 = **人沿地表走过去**（0.22s 插值），走完再刷界面。
         走几格由 P.mapClick 决定（精力够到哪走到哪）；这里只负责"先走给人看"。 */
      /* v157.21：**建造模式不走路**。前传那段"点地图=人走过去"会在下面直接 return，
         建造模式一旦落在前传期，拿着物品怎么点都放不下去（实测 count 恒 0）。
         建造是"编辑地图"，与"角色移动"本来就是两件事。 */
      if (M.mode === M.MODE_BUILD) { M.pickAt(canvas, e.clientX, e.clientY); return; }
      /* ⛔ v157.85：这里原有「前传里点地图 = 君主沿地表走过去」整块（含
         `buildLordWalking` / `_lastClickDebug` / `prologue.mapClick` 三路调用）——
         前传整段退役，点击一律走 `M.pickAt()`（选地块）。 */
      M.pickAt(canvas, e.clientX, e.clientY);   /* 没拖动 = 点击 → 选地块 */
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      /* v158.56（老板「在高空，不再由滚轮调整高度」）：飞行态滚轮整条禁用。
         高度只由飞行方向决定；进出高空改走起飞/降落程序（空格）。
         地表态（走路）滚轮仍按 REGION 逻辑调相机距离，不受影响。 */
      if (M._fly && M._fly.active && !M._surf) { return; }
      /* v157b：滚轮只改**球心距离**，轨道/地表由 placeCamera 按离地高度自动派生
         —— 不需要"升空"特判，也不需要按钮（老板：「不需要特别按钮」）。 */
      /* ============================================================
       * v158.47（老板「地面时滚轮应仍能调整相机高度，滚轮对高度的调节是连续的。
       *        地面时相机随高度调整，逐渐拉近人物」）：地表态滚轮**调距离基准**
       *   _surfCamDist（16 ↔ 3.2m 连续指数），与右键仰角 distOf(el) 协同 ——
       *   机位距离 = MIN + (live − MIN)·t^0.75，滚轮定上限、右键定比例。
       *   向外滚到最远（16m）仍继续 → 落到下方 agl 逻辑升空，衔接轨道态。
       * ============================================================ */
      if (M._surf) {
        if (M._surfCamDist == null || !isFinite(M._surfCamDist)) M._surfCamDist = M.SURF_CAM_DIST;
        var _sdNew47 = Math.max(M.SURF_CAM_MIN_DIST, Math.min(M.SURF_CAM_DIST,
          M._surfCamDist * Math.exp((e.deltaY || 0) * 0.0008)));
        if (!((e.deltaY || 0) > 0 && _sdNew47 >= M.SURF_CAM_DIST - 0.001)) {
          M._surfCamDist = _sdNew47;
          touch(); redraw();
          return;
        }
        M._surfCamDist = M.SURF_CAM_DIST;   /* 到顶，放行升空 */
      }
      /* ============================================================
       * v157k（老板：「控制高度的滚轮单格高度差太高了，希望高度平滑连续下降，
       *        远处快，近处慢」）
       * ------------------------------------------------------------
       * 旧写法是**球心距离** × 1.12 —— 错在基准选错了：
       *   贴地时 dist≈320（含球半径 300），一格 1.12 倍 = 360，
       *   离地 20 米直接变 58 米（2.9 倍！）；高空 3000→3360 只变 13%。
       * 所以"同样一格"，近处像弹射、远处像没动。
       *
       * 现在按**离地高度 agl** 做比例缩放，并让缩放量随 deltaY **连续**变化
       * （不再固定 1.12/格，滚轮滚多少变多少、触控板细滑也跟手）：
       *   agl' = agl × exp(-deltaY × K)
       * 这样近处一格只动一两米、远处动几百米，比例手感处处一致。
       * elev 由 dist 反解出来保持不变，避免滚一下顺带"改地形高度"。
       * ============================================================ */
      /* ============================================================
       * v157.50（老板「滚轮不能有距离跳变；速度按高度取平滑曲线，
       *          不是按滚轮位移」）—— 旧实现在这里做了三件互相打架的事：
       *   ① 乘在**球心距离**上（贴地 302×1.06 → agl 1.7→20，12 倍）；
       *   ② 灵敏度在 120 米处**硬切**（0.0006 ↔ 0.0012，同一格 +25 变 +55 米）；
       *   ③ 向内滚时把当前位置**立刻**顶到地形下限（floor 钳制）＝ 一次瞬移。
       * 现在：只写**目标高度**，灵敏度走连续曲线 `_zoomK(agl)`，
       *   下限钳制作用在**目标**上（阻尼负责把画面滑过去，不瞬移）。
       * 逐格实测见 tools/_cam-wheel-probe.js / docs v15750。
       * ============================================================ */
      var _aglNow = Math.max(0.6, camO.dist - R);
      if (_zoomTarget == null) _zoomTarget = _aglNow;
      var _tNew = _zoomStepTo(_zoomTarget, e.deltaY || 0);
      /* 防穿模：只约束**目标**，且只往内滚时约束（向外永远放行 —— 平移后再往外滚
         不会被 floor 一把顶上天空）。下限换成 agl 口径，与缩放同一把尺。 */
      var _floor = (M.camFloorAt ? M.camFloorAt(camO.dir) : (R + (M.SURF_EYE || 1.7)));
      var _floorAgl = Math.max(0.6, _floor - R);
      if (e.deltaY < 0 && _tNew < _floorAgl) _tNew = _floorAgl;
      if (_tNew > M.ZOOM_MAX - R) _tNew = M.ZOOM_MAX - R;
      if (_tNew < 0.6) _tNew = 0.6;
      _zoomTarget = _tNew;
      /* v157.35：与 camFloorAt 同一时机 —— 缩放这一次才更新"判据用的地形高"。 */
      if (M._groundAt) M._fadeGround = M._groundAt();
      /* 往外拉即"我想看全貌" → 前传的贴地跟随不再抢镜头 */
      if (_tNew > _aglNow) M.camFree = true;
      touch(); redraw();
    }, { passive: false });
  };
  /* v90.98（老板）：缩放条 ↔ 相机距离的**唯一换算**（滚轮也用同一对区间）。
     zoomFrac()：0 = 极小视野（最近）→ 1 = 极大视野（最远）—— 供底栏滑块落位。 */
  /* v92.242：1.02R ~ 50R 跨度 49 倍，线性滑块会有一大半行程"看不出变化" → 改用对数刻度。 */
  M.zoomFrac = function () {
    /* v158.42：读**目标球心距离**（R + _zoomTarget）而非当前 camO.dist ——
       滑块落位要反映「你要去哪」，而不是「阻尼中间态」，否则设完值滑块滞后 70ms
       在后面追赶。目标为空（初始态）回退到当前 dist。 */
    var _base = (_zoomTarget == null || !isFinite(_zoomTarget)) ? camO.dist : (R + _zoomTarget);
    var a = Math.log(M.ZOOM_MIN), b = Math.log(M.ZOOM_MAX);
    var v = Math.log(Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, _base)));
    return Math.max(0, Math.min(1, (v - a) / (b - a)));
  };
  /* setZoom(frac)：滑块拖动 → 设视野（0 近 · 1 远）；不动朝向。返回当前 frac。 */
  M.setZoom = function (frac) {
    frac = Math.max(0, Math.min(1, Number(frac) || 0));
    var a = Math.log(M.ZOOM_MIN), b = Math.log(M.ZOOM_MAX);
    var _tz = Math.exp(a + (b - a) * frac);
    /* v157.32：滑块与滚轮同一把下限（camFloorAt），否则能把相机拖进山里 */
    try {
      var _flz = M.camFloorAt ? M.camFloorAt(camO.dir) : 0;
      if (_flz && _tz < _flz) _tz = _flz;
      if (M._groundAt) M._fadeGround = M._groundAt();
    } catch (eZ) { }
    /* v158.42：滑块也走平滑跳转（原直接写 dist 会跳变，与滚轮手感不一致）。 */
    _zoomTo(_tz);
    if (frac > 0.05) M.camFree = true;
    if (frac <= 0.02) M.camFree = false;
    if (M._lastAct != null) M._lastAct = Date.now();       /* 视为一次操作（重置自转计时）*/
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    return frac;
  };

  /* 地块 → 行政归属（省/市/区）；vi = 地块顶点索引 */
  M.regionAt = function (vi) {
    var S = M._settle; if (!S || !S.table || vi == null) return null;
    var T = S.table, pi = S.provOf[vi], mi = S.marketOf[vi], di = S.districtOf[vi];
    if (pi < 0) return null;
    return {
      prov: T.prov[pi] ? T.prov[pi].name : '', market: (mi >= 0 && T.market[mi]) ? T.market[mi].name : '',
      district: (di >= 0 && T.district[di]) ? T.district[di].name : '', provIndex: pi, marketIndex: mi, districtIndex: di
    };
  };
  /* 行政中心城（旧都/省府/市府/区）by 格坐标 */
  M.admCityAt = function (x, y) {
    var list = M.admCities; if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].x === x && list[i].y === y) return list[i];
    return null;
  };
  /* ============================================================
   * v152（老板：「球面是可活动区域，玩家在上边直接走动」）
   * ------------------------------------------------------------
   * 前传的相机不再"总览一颗球"：
   *   · `centerOn` 把镜头对准君主所在的格；
   *   · 之后把距离**压到近地**（`R + 2.2×HSC` 量级 ≈ 一格占屏幕 1/6），
   *     玩家就像站在地表上——点哪个方向就走过去。
   * 正式阶段仍可滚轮拉回总览（ZOOM_MAX 不变）。
   * ============================================================ */
  /* v152: screen position of a cell centre -- same camera the raycaster uses.
     Exposed so scripts/players can aim at a specific hex. */
  M.screenOfCell = function (ci) {
    var c = _tileCells && _tileCells[ci];
    if (!c || !c.pos || !cam) return null;
    var v = new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]).project(cam);
    var cv = (GAME.ui && GAME.ui.canvasEl) ? GAME.ui.canvasEl() : null;
    var cvEl = cv || (typeof document !== 'undefined' ? document.getElementById('mapCanvas') : null);
    if (!cvEl) return null;
    return { x: (v.x * 0.5 + 0.5) * cvEl.width, y: (-v.y * 0.5 + 0.5) * cvEl.height, behind: v.z > 1 };
  };
  /* ============================================================
   * v92.241b（老板：「相机支点变成开局创建的人物了」）
   * ------------------------------------------------------------
   * 病根：`M._focus` 一旦被前传 `focusOnCell` 写上，**全仓没有任何地方清它**
   *   （v152 起就只有 setter，没有 clearer）。于是：
   *     · 前传期绕"脚下那一格"转 —— 这是设计（贴地跟随）；
   *     · **前传结束/立城之后仍然绕那一格转** —— 这是 bug：玩家以为相机的支点被人物绑住了；
   *     · 点「回本城」走 `centerOn`（它只改 yaw/pitch/dist，不清 focus）→ 依旧绕旧格。
   * 修法：给一个唯一出口 `clearFocus()`，并在三条路径上自动清：
   *     ① 滚轮拉远 / 缩放条拉远（玩家明确想看全貌）；
   *     ② 前传已结束（render 里检测到 prologue 关掉）；
   *     ③ `centerOn`（回本城/回灰烬城/看某格）。
   * 另加 `M.camFree`：玩家一旦主动拉远，前传的"跟随"就不再抢镜头，
   * 直到他再次拉近 / 显式 `focusOnCell(ci, true)`。
   * ============================================================ */
  /* v92.242：支点已删除 —— 这两个只剩**兼容壳**（旧调用点还能调，语义变成"什么都不锁"）。 */
  M.camFree = false;
  M.clearFocus = function (opts) {
    M._focus = null; M._pendingFocus = null;
    if (opts && opts.dist != null) { _zoomTo(Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, opts.dist))); }
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    return false;
  };
  /* 对准某一格：只改**朝向**和距离（距离仍从球心算），不设任何支点。
     "贴地看这一格" = 相机悬在它正上方 R + 1.5×HSC 处、看向球心。 */
  M.focusOnCell = function (ci, force) {
    if (M.camFree && !force) return false;          /* 玩家拉远过 → 不抢镜头 */
    if (force) M.camFree = false;
    var c = _tileCells && _tileCells[ci];
    if (!c || !c.dir) { M._pendingFocus = ci; return false; }
    M._pendingFocus = null;
    var d = c.dir;
    camO.yaw = Math.atan2(d[0], d[2]);
    camO.pitch = Math.max(-1.55, Math.min(1.55, Math.asin(Math.max(-1, Math.min(1, d[1])))));
    /* v158.42：贴地看这一格走平滑跳转，高度连续（不直接写 dist，否则战略视野啪一下砸到地表）。 */
    _zoomTo(R + HSC * 1.5);                       /* ≈ 一格半的视距（站在这一格上方）*/
    M._focus = null;
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    return true;
  };

  /* ============================================================
   * v153（老板：「给一个人类模型，可以在星球地表上逐格移动 · 3D 的」）
   * ------------------------------------------------------------
   * 一个**程序化小人**（没有外部模型文件 —— 纯 box 拼装，零加载）：
   *   身体 / 头 / 两条腿 / 两条手臂；脚底贴在**该格自己的地形高度**上，
   *   并且**人站直的方向 = 该格的法线**（球面上"上"是变化的）。
   * 谁站上去：
   *   · 前传：君主（金色小人，跟着 `prologue.pos` 一格格走）；
   *   · 正式阶段：当前城所在格（蓝色小人，代表"你在这儿"）；
   *   · 玩家在地图上"指认待机格"（`GAME.state._standCi`）→ 银色小人。
   * 换格时**只移动**，不重建（重建会闪）；改格数/换星球才 disposal 重建。
   * ============================================================ */
  var figRoot = null, figCache = {};
  var figLastT = (typeof Date.now !== 'undefined') ? Date.now() : 0;   /* 骨骼角色每帧 mixer 推进用 dt 时钟 */
  M._standVer = '';
  /* ============================================================
   * v158.33 · 脚步尘土（老板「半分用户体验都没有」）
   * ------------------------------------------------------------
   * 走路只有腿在摆、脚下什么都没有 —— 这是"贴地滑行"最后的破绽：
   * 真人每一步都会踢起一点土，哪怕只是淡淡一团。
   * 做法：8 个 Sprite 的池子，每"半步"（相位跨 π）在脚下生成一个，
   *   0.55 秒内放大 1.4 倍、淡出到 0。只在走起来时生成（站着不冒烟）。
   * 不用粒子系统：8 个 Sprite 就是 8 个 draw call，比 `Points` 还好调。
   * ============================================================ */
  var _dustPool = null, _dustTex = null, _dustNext = 0;
  function _dustInit() {
    if (_dustPool) return true;
    if (!scene || !THREE) return false;
    try {
      var cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      var cx = cv.getContext('2d');
      var gdc = cx.createRadialGradient(32, 32, 2, 32, 32, 30);
      gdc.addColorStop(0, 'rgba(216,203,170,0.9)');
      gdc.addColorStop(0.5, 'rgba(200,184,152,0.38)');
      gdc.addColorStop(1, 'rgba(200,184,152,0)');
      cx.fillStyle = gdc; cx.fillRect(0, 0, 64, 64);
      _dustTex = new THREE.CanvasTexture(cv);
      _dustPool = [];
      for (var i = 0; i < 8; i++) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: _dustTex, transparent: true, opacity: 0, depthWrite: false
        }));
        sp.visible = false;
        sp.scale.setScalar(0.6);
        scene.add(sp);
        _dustPool.push({ s: sp, t: -1, sc: 1 });
      }
    } catch (eD0) { _dustPool = null; return false; }
    return true;
  }
  function _dustSpawn(pos, sc) {
    if (!_dustInit() || !pos) return;
    var it = _dustPool[_dustNext % _dustPool.length];
    _dustNext++;
    it.t = 0;
    it.sc = sc || 1;
    /* 抬高 0.35 米：贴地（0.06）会被地形面片挡住，实测截图里完全看不到 */
    it.s.position.set(pos.x, pos.y + 0.35, pos.z);
    it.s.visible = true;
    it.s.material.opacity = 0.62;
    it.s.scale.setScalar(0.8 * (sc || 1));
  }
  function _dustTick(dt) {
    if (!_dustPool) return;
    for (var i = 0; i < _dustPool.length; i++) {
      var it = _dustPool[i];
      if (it.t < 0) continue;
      it.t += dt;
      var k = it.t / 0.55;
      if (k >= 1) {
        it.t = -1; it.s.visible = false; it.s.material.opacity = 0;
        continue;
      }
      it.s.material.opacity = 0.55 * (1 - k) * (1 - k);
      it.s.scale.setScalar((0.8 + k * 1.9) * (it.sc || 1));
    }
  }
  function makeFigure(color, scale, actorName) {
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: color });
    var dark = new THREE.MeshBasicMaterial({ color: 0x2a2f38 });
    /* v153c：头用肤色、身体用阵营色 —— 俯视时也能一眼认出"这是个人" */
    var skin = new THREE.MeshBasicMaterial({ color: 0xe8c39a });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.26), mat);
    body.position.y = 0.62;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin);
    head.position.y = 1.06;
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.16), dark);
    legL.position.set(-0.11, 0.16, 0);
    var legR = legL.clone(); legR.position.x = 0.11;
    /* v158.33：手臂原来和躯干**同一个材质** —— 从背后看跟身体连成一块，
       摆动完全看不出来（截图确认：整个人就是一根橙条）。用略深的同色系分开。 */
    var armMat = new THREE.MeshBasicMaterial({ color: color });
    try { armMat.color.multiplyScalar(0.72); } catch (eAM) { }
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.13), armMat);
    armL.position.set(-0.27, 0.66, 0);
    var armR = armL.clone(); armR.position.x = 0.27;
    g.add(body, head, legL, legR, armL, armR);
    g.userData.legs = [legL, legR];
    /* v158.33（老板「我只是想要人物操纵感」）：手臂和躯干也要能被动画驱动。
       原来建了手臂就没人再用 —— 走路只有腿在摆，上半身整个是块木板。 */
    g.userData.arms = [armL, armR];
    g.userData.torso = body;
    g.userData.baseScale = scale || 1;
    /* v2026xxxx：骨骼角色替身（序章君主用 RobotExpressive 作示范）。
       加载成功后挂到 g 上、缩放对齐方块人高度、隐藏方块人；失败则留方块人兜底。 */
    if (actorName && GAME.gltf && GAME.gltf.Actor) {
      var pa = new GAME.gltf.Actor({ name: actorName });
      pa.load(function (a) {
        if (!a || !a.root) return;
        a.root.scale.setScalar(1.2);        /* 归一化身高 1.0 → 对齐方块人 ~1.2 */
        g.add(a.root);
        g.userData.actor = a;
        g.children.forEach(function (c) { if (c !== a.root) c.visible = false; });
      });
    }
    g.scale.setScalar(scale || 1);
    return g;
  }
  /* 把一个小人摆到某格上：脚贴地形、身体沿法线站直 */
  function placeFigure(g, ci) {
    var c = _tileCells && _tileCells[ci];
    if (!c || !c.dir) return false;
    var d = c.dir;
    var rr = R + Math.max(0, sphElev(d)) * HSC + 0.55;
    g.position.set(d[0] * rr, d[1] * rr, d[2] * rr);
    /* v156.19：姿态统一走 surfaceQuat（+Y→径向，转身绕**局部**竖轴）。
       原来这里用 g.rotateY() 其实是对的（局部轴），但两处写法不一容易再踩坑，
       收敛成一个出口：给了 yaw 就自转，没有就正面朝南（+Z）。 */
    applyQuad(g.quaternion, d, ci % 360);
    g.userData.baseQ = g.quaternion.clone();
    return true;
  }
  /* v158.0（P0）：placeFigure 的**连续 dir 版兄弟**。
     ⚠️ 不能每帧调 teleportTo / buildFigures —— 那会整组 dispose+重建小人；
     这里只挪不重建，姿态仍走 applyQuad（+Y 对齐格法线），与旧落座口径逐位一致。 */
  function placeFigureAtDir(g, d, yawDeg) {
    if (!g || !Array.isArray(d) || d.length < 3) return false;
    var L = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1;
    var u = [d[0] / L, d[1] / L, d[2] / L];
    var rr = R + Math.max(0, sphElev(u)) * HSC + 0.55;
    g.position.set(u[0] * rr, u[1] * rr, u[2] * rr);
    applyQuad(g.quaternion, u, yawDeg || 0);
    if (g.userData.baseQ) g.userData.baseQ.copy(g.quaternion);
    else g.userData.baseQ = g.quaternion.clone();
    return true;
  }
  /* ⛔ v158.36 移除：animateFigureWalk（原 v158.20 的走路动画函数）。
     病因：v158.32 给它加了 `avOut.spd` 读取却没加形参 —— 键盘走路走的是
     syncAvatarFigure（有参）所以全绿，只有「点一下自动走过去」这条玩家真实
     路径（stepWalkTo）会抛 ReferenceError: avOut is not defined。
     去向：走路动画唯一出口 = M.syncAvatarFigure(dt, avOut)（v158.33 起就
     已实现手臂/躯干/腿相位全套），stepWalkTo 与 followAvatar 都改调它。 */

  function buildFigures() {
    if (figRoot) { scene.remove(figRoot); figRoot = null; }
    figCache = {};
    figRoot = new THREE.Group();
    scene.add(figRoot);
    /* 尺寸：一格的世界宽度随格数变，小人取"格宽的 1/3" —— 40962 时约 1.7 单位 */
    var cellW = (4 * Math.PI * R * R / Math.max(1, (_tileCells || []).filter(Boolean).length)) || 1;
    cellW = Math.sqrt(cellW);
    /* v158.44（老板「人太大又太小了……在地面时，人甚至应该小于树才对」）：
       基准比例上限从 5.0 收紧到 **1.45** —— 方块人几何高 1.2，1.45× ≈ 1.74 米，
       而最矮的树也有 2.7 米（树干 1.0+树冠 2.4，缩放 0.78 起）—— 地面人恒小于树。
       高空"看不见"不靠基准比例解决，改由 _figScaleTick 按屏占比动态放大（下方）。 */
    /* v158.46（老板「人小一点好了，整个比例尺相应就大了」）：上限 1.45 → **1.0**
       —— 人 1.2 米 ≈ 最矮树（2.7m）的一半，山/城/星球相对人物更显体量；
       高空可见性仍由屏占比固定缩放（FIG_SCREEN_FRAC）兜住，不因缩小而看不见。 */
    /* v158.46d（老板「人还是太高了，再一半」）：上限 1.0 → **0.5**
       —— 人 0.6 米 ≈ 最矮树的 1/4，格子/城池/山体相对人更显庞大；
       高空屏占比固定缩放不受影响（base 只是下限）。 */
    var sc = Math.max(0.4, Math.min(0.5, cellW * 0.45 / 1.2));
    var who = [];
    /* ⛔ v157.85：前传的「金色君主人偶」分支已删 —— 现在一律画当前城市。 */
    var pc = GAME.currentCity && GAME.currentCity();
    if (pc && pc.ci != null) who.push({ ci: pc.ci, color: 0x8fd4ff, scale: sc, key: 'city' });
    var stc = M.playerCi();                    /* v158.22：唯一位姿出口（含开局补锚） */
    /* v158.7：玩家小人（待机格）回到**真实比例**（与城市小人同 scale）。
       原 v157.96 为「老板说从没看见过小人」而放大 ×3.2 + 加青色光环；
       现老板反馈「大地图人物比城市还大」，收回放大与光环，只留金色小人本身。 */
    if (stc != null && stc >= 0) who.push({ ci: stc, color: 0xffd76a, scale: sc, key: 'stand' });
    who.forEach(function (w) {
      var g = makeFigure(w.color, w.scale, w.actor);
      if (!placeFigure(g, w.ci)) return;
      g.userData.ci = w.ci;                 /* v157.99：拾取时据此反查所在格 */
      /* ============================================================
       * v158.20（老板「只提示人物位置」）—— 玩家小人脚下一圈光环。
       * ------------------------------------------------------------
       * v157.96 曾给小人"放大 ×3.2 + 青色光环"，v158.7 因为"大地图人物比城市还大"
       * 把**两样一起**收了 —— 但真正让人"比城还大"的是放大，光环只是标记。
       * 现在单独把**光环**加回来、模型比例一点不动：战略视角下远远就能找到自己。
       * ============================================================ */
      if (w.key === 'stand') {
        var ring = new THREE.Mesh(
          new THREE.RingGeometry(0.52, 0.68, 28),
          new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.85,
            side: THREE.DoubleSide, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        ring.name = 'standRing';
        ring.userData.noPick = true;        /* 别让光环抢走"点小人"的射线 */
        g.add(ring);
      }
      figCache[w.key] = { g: g, ci: w.ci };
      figRoot.add(g);
    });
  }
  /* ============================================================
   * v157.96：**传送到某格**（地块面板的「⤓ 传送」按钮调它）
   * ------------------------------------------------------------
   * 语义：把"玩家所在格"设为 ci —— 也就是银色/金色那个玩家小人站过去。
   * 只动 `state._standCi` 一个字段；渲染侧靠 `_standVer` 变化重建（换格只挪不重建闪）。
   * ============================================================ */
  M.teleportTo = function (ci) {
    ci = ci | 0;
    M._spd = 0;                    /* v158.32：传送必须清速度，否则落地点会先"滑"一段 */
    M._lastWd = null;              /* v158.35：方向也要清，否则落地会先沿旧方向滑一下 */
    if (!(_tileCells && _tileCells[ci])) return false;
    if (!GAME.state) return false;
    var d = _tileCells[ci].dir;
    /* v158.17：**街区态下换格必须先撤街区**。
       否则会出现"人已经传到野地、街区还亮着"的错位态 —— 相机仍在城格局部空间、
       D.pos 还是那条街，而位姿已经在几格之外（实测把「回本城」挡成了空操作：
       gotoXY 看到 D.active && D.ci === ci 以为"我已经在这儿"，其实人早走了）。
       `snapshot = null` 是为了别让 240ms 后那次"还原旧位姿"把人拽回原处。 */
    var _D = GAME.district;
    if (_D && _D.active && _D.ci !== ci && _D.exit) {
      _D.snapshot = null;
      _D.exit();
      if (GAME.ui && GAME.ui.renderDistrictHud) GAME.ui.renderDistrictHud(false);
    }
    /* v158.0：格锚传送必须同步连续位姿 —— 否则"传送过去人没动"。 */
    M.setPlayerPose({ dir: [d[0], d[1], d[2]], h: M._groundAtUnit(d), yaw: 0, v: [0, 0, 0], ci: ci });
    M._standVer = '';                    /* 强制下一帧重建到新格 */
    return true;
  };
  M.playerCi = function () {
    var st = GAME.state;
    if (!st) return -1;
    /* v158.22：读侧也走一次迁移 —— 开局 `_avatar`/`_standCi` 都是空的，
       而这里过去只读不补，真实玩家 `playerCi` 恒 -1（图上没有人）。
       迁移本身幂等（`_avatar` 齐了就直接返回 0）。 */
    if (GAME.migrateAvatar158) { try { GAME.migrateAvatar158(st); } catch (eMg) { } }
    return (st._standCi != null) ? st._standCi : -1;
  };

  /* ============================================================
   * v158.22（老板「星露谷不就是场景样板吗，操控一小人走在地面上这么难？」）
   * 地表跟随相机 —— 星露谷角度
   * ------------------------------------------------------------
   * 为什么不复用 followAvatar：
   *   那套是 v158.0 的"贴脸第三人称"（FOLLOW_DIST=6 · 俯角 15°），老板连说两轮
   *   "像老年痴呆 / 莫名其妙"，v158.20 已把它的玩家入口退役。
   *   星露谷那套不是"眼睛长在脑后"，而是**镜头站在角色斜上方、看着角色**：
   *     距离 28 米 · 仰角 ≈ 50° —— 自己看得见，周围能点的地也看得见。
   *
   * 只读位姿（M.playerPose / M.playerCi），一个字段都不写。
   * 平台层以 `camO.dir` 为中心重建，所以 placeCamera 开头会把 camO 对齐玩家；
   * 这里只负责把"最终机位"摆到玩家斜上方。
   * ============================================================ */
  /* v158.33（老板「半分用户体验都没有」）：26 米时角色只有 **25 像素高** ——
     摆臂、尘土、前倾这些全都白做，玩家根本看不见。拉近到 16 米：
     角色约 40 像素、视野约 3.7 格（底栏写的就是「视野 4 格」），
     这才是"能看见自己在走"的距离。 */
  M.SURF_CAM_DIST = 16;        /* 高仰角默认距离（米）——5.25 米一格，约看 3.7 格 */
  M._surfCamDist = null;       /* v158.47：地表相机距离基准（滚轮连续调，16 ↔ 3.2m）；
                                  运行时态不入档，懒初始化为 SURF_CAM_DIST */
  /* v158.39（老板「向上看时……相机与人的距离缩短，最终在眼睛与地面之间」）：
     旧版距离恒 16m：右键上拖只把仰角从 1.0 压到 0.42，相机仍在 2.8m 高空、离人 16m，
     观感是"镜头越仰越远"。现在距离随仰角连续收缩，最低到 3.2m；
     配合最低仰角 0.06rad（3.4°），镜头落在眼高与地面之间，且始终离地 > 0。 */
  M.SURF_CAM_MIN_DIST = 3.2;   /* 抬头到最低仰角时的相机距离 */
  M.SURF_CAM_EL_MIN = 0.06;    /* 3.4°：再低就没法保证不穿地 */
  M.SURF_CAM_EL_MAX = 1.35;    /* 77°：原上限不动 */
  M.SURF_CAM_GROUND_GAP = 0.12;/* 相机底部离玩家脚下地面的硬下限（米），保证"眼睛与地面之间" */
  M.SURF_CAM_EL = 1.0;         /* 初始仰角（弧度）≈ 57° */
  M._surfOrbitYaw = 0;         /* 绕过角色一圈（右键拖） */
  M._surfCamE1 = null;         /* 水平基准，进地表定一次、之后固定（走动时画面不旋转） */
  /* ============================================================
   * v158.26（老板「为啥移动整个世界都在动，而不是相机+人物移动」）
   * ------------------------------------------------------------
   * 病根是**硬跟随**：每帧 `cam.position = 玩家位置 + 固定偏移` + `lookAt(玩家)`，
   * 于是玩家永远钉在画面正中、一像素不动 —— 走动时唯一在动的只有背景。
   * 观感就是"世界在搬运，人没走"。
   *
   * 现在给镜头锚点一个**时间常数**：走动时锚点落后玩家约 `速度×LAG`，
   * 玩家因此真的会在画面里往前挪一段；停下后 0.07s 迅速归位
   * （静止时不长时间自漂 —— v157.34 的"停手画面自己动"是被否过的）。
   *
   * 只改**镜头锚点**，不改位姿、不改世界坐标：世界依旧是静止的参照物。
   * ============================================================ */
  M.SURF_CAM_LAG = 0.26;       /* 走动中：锚点时间常数（秒）→ 4.5m/s 时落后约 1.2 米 */
  /* ⛔ v158.49：SURF_CAM_LAG_STOP（停下 0.07s 快速归位）退役 —— 那会把人拽回画面，
     违反「从哪里变动高度就落到哪个位置」（落点=指向处，玩家不动锚点不动）。 */
  M._surfCamAnchor = null;     /* 镜头锚点（世界坐标，初始=相机指向点；玩家移动时滞后跟随） */
  M._surfAvatarCam = function () {
    var ci = M.playerCi();
    if (ci < 0) return false;
    var pp = M.playerPose();
    if (!pp || !pp.dir) return false;
    var d = pp.dir;
    /* v158.50：位姿 h 在玩家**站着不动**时是 0（只有走路 stepAvatar 才更新），
       直接用会把锚点/玩家点埋进地里 —— 一律以真实地面高兜底。 */
    var _ppH = (isFinite(pp.h) && pp.h > 0) ? pp.h : (M._groundAtUnit(d) || 0);
    var R2 = M.R + _ppH + 0.05;
    var P = new THREE.Vector3(d[0] * R2, d[1] * R2, d[2] * R2);
    /* ---- 镜头锚点（v158.49 口径：落点=指向处）----
       v158.49（老板「从哪里变动高度就落到哪个位置」）：锚点初始 = **相机指向点**
       （camO.dir 拉近落地的位置），不再从玩家位置起 —— 玩家在高空把相机转到
       别处拉近，落地就停在那处，不再跳回人物所在地。
       玩家**移动时**（WASD 走路）锚点以滞后时间常数平滑跟上玩家；站着不动
       锚点原地不动（v158.26 的"停下 0.07s 快速归位"退役 —— 那会把人拽回画面）。 */
    var _dt = Math.max(0.001, Math.min(0.05, M._lastAvDt || 0.016));
    var _moving = !!(M._lastAvOut && M._lastAvOut.moved);
    if (!M._surfCamAnchor || !isFinite(M._surfCamAnchor.x)) {
      /* 初始锚点 = 相机指向点（camO.dir），贴到**真实地面高**上（v158.50：
         不用玩家位姿 h —— 站着不动时 h=0 会把锚点埋进地里） */
      var _cd0 = camO.dir || d;
      var _cdGh = M._groundAtUnit(_cd0) || 0;
      var _R2a = M.R + _cdGh + 0.05;
      M._surfCamAnchor = new THREE.Vector3(_cd0[0] * _R2a, _cd0[1] * _R2a, _cd0[2] * _R2a);
    } else if (_moving) {
      var _tau = Math.max(0.02, M.SURF_CAM_LAG);
      var _k = 1 - Math.exp(-_dt / _tau);
      M._surfCamAnchor.lerp(P, Math.min(1, _k));
      /* 贴回球壳：两帧之间走的是**弦**，不修正会一路往地里沉。
         只修长度、不动方向 —— 角度上的滞后（= 观感里的"人往前挪"）完整保留。 */
      var _aL = M._surfCamAnchor.length() || 1;
      M._surfCamAnchor.multiplyScalar(R2 / _aL);
    }
    var A = M._surfCamAnchor;
    /* v158.49：机位基向量改从**锚点径向**算（机位围绕锚点），
       不再从玩家径向算 —— 否则锚点在远处时机位方向与落点错位。 */
    var up = new THREE.Vector3().copy(A).normalize();
    if (!M._surfCamE1) {
      var e0 = new THREE.Vector3(0, 1, 0).cross(up);
      if (e0.lengthSq() < 1e-6) e0.set(1, 0, 0);
      M._surfCamE1 = e0.normalize();
    }
    /* 投影回切平面（换地方后 up 变了，e1 必须重新正交化） */
    var e1 = M._surfCamE1.clone().addScaledVector(up, -M._surfCamE1.dot(up));
    if (e1.lengthSq() < 1e-9) e1.set(1, 0, 0).addScaledVector(up, -up.x);
    e1.normalize();
    var e2 = new THREE.Vector3().crossVectors(up, e1).normalize();
    /* v158.39：仰角下限从 0.42 放到 0.06，同时把距离改成仰角的单调函数。
       高仰角仍是 16m 俯视；抬头到最低仰角时只剩 3.2m，机位落在眼高与地面之间。 */
    var elMin = Math.max(0.001, Math.min(M.SURF_CAM_EL_MIN, M.SURF_CAM_EL_MAX));
    var elMax = Math.max(elMin, M.SURF_CAM_EL_MAX);
    var el = Math.max(elMin, Math.min(elMax, M.SURF_CAM_EL));
    var ay = M._surfOrbitYaw;
    function _dcamOf(e) {
      return up.clone().multiplyScalar(Math.sin(e))
        .addScaledVector(e1, Math.cos(e) * Math.cos(ay))
        .addScaledVector(e2, Math.cos(e) * Math.sin(ay));
    }
    function _distOf(e) {
      /* v158.47：距离上限改读滚轮控制的 live 基准 _surfCamDist（默认 16m）——
         滚轮连续调"相机高度/距离"，右键仰角在 [MIN, live] 内缩放，两者协同。 */
      var _dL = (M._surfCamDist != null && isFinite(M._surfCamDist))
        ? Math.max(M.SURF_CAM_MIN_DIST, Math.min(M.SURF_CAM_DIST, M._surfCamDist))
        : M.SURF_CAM_DIST;
      var s0 = Math.sin(elMin), s1 = Math.sin(elMax);
      var t = (Math.sin(e) - s0) / Math.max(1e-6, s1 - s0);
      t = Math.max(0, Math.min(1, t));
      return M.SURF_CAM_MIN_DIST + (_dL - M.SURF_CAM_MIN_DIST) * Math.pow(t, 0.75);
    }
    var dirCam = _dcamOf(el);
    var camDist = _distOf(el);
    var pos = A.clone().addScaledVector(dirCam, camDist);

    /* 地面硬闸（v158.39 终版）：既要贴地看人，又不能钻进坡地。
       不能靠"抬高仰角"解决——坡地上会把 0.06rad 顶到 0.75、距离拉回 10m。
       正确做法是**保持方向、只把径向抬到地面之上**：水平距离仍是 3m 级，
       镜头正下方若有更高的坡，就沿径向补那几米，不会穿地也不会甩远。 */
    var _gdir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    var _pFloor = M._groundAtUnit([_gdir.x, _gdir.y, _gdir.z]);
    var _pr0 = pos.length() || 1;
    var _cdir = pos.clone().multiplyScalar(1 / _pr0);
    var _cFloor = M._groundAtUnit([_cdir.x, _cdir.y, _cdir.z]);
    var _floorR = M.R + Math.max(_pFloor, _cFloor) + M.SURF_CAM_GROUND_GAP;
    if (_pr0 < _floorR) pos.multiplyScalar(_floorR / _pr0);

    /* ============================================================
     * v158.50（老板「相机转移到山坡侧向或者后向时，会穿模」）：
     * **视线遮挡检测** —— 只探测**机位附近**（机位本身 + 侧向 ±0.8m + 视线 55% 处），
     * 任一探测点落进坡体（离地 < 0.05m）就先沿视线二分收缩；
     * **缩到底还穿**（锚点紧贴坡缘）→ 沿锚点径向抬升（0.5m 一档，最多 6m）——
     * 贴坡停住、不抬仰角（v158.39 已否掉抬仰角）、不钻坡。 */
    if (M.SURF_CAM_OCCLUSION !== false) {
      var _dCam50 = pos.clone().sub(A);
      var _dL50 = _dCam50.length() || 1;
      var _dDir50 = _dCam50.clone().multiplyScalar(1 / _dL50);
      var _side50 = new THREE.Vector3().crossVectors(_dDir50, up);
      if (_side50.lengthSq() < 1e-9) _side50 = new THREE.Vector3(1, 0, 0);
      _side50.normalize();
      function _ok50(dist, lift) {
        var base = A.clone().addScaledVector(_dDir50, dist).addScaledVector(up, lift);
        /* ⚠️ 只探测机位本身 + 侧向 ±0.8m —— 视线路径上的点（锚点附近）
           贴坡是正常姿态，不参与判穿（否则会误抬 6m）。 */
        var qs = [base,
          base.clone().addScaledVector(_side50, 0.8),
          base.clone().addScaledVector(_side50, -0.8)];
        for (var i = 0; i < qs.length; i++) {
          var q = qs[i], qL = q.length() || 1;
          var gh = M._groundAtUnit([q.x / qL, q.y / qL, q.z / qL]);
          /* 判穿 = 离地 < 0.05m（真穿进坡体才缩；贴坡 0.1m+ 是正常贴地姿态） */
          if (qL < M.R + gh + 0.05) return false;
        }
        return true;
      }
      var _try50 = _dL50, _lift50 = 0;
      if (!_ok50(_try50, 0)) {
        _try50 = _dL50 * 0.55;
        if (!_ok50(_try50, 0)) _try50 = _dL50 * 0.3;
        if (!_ok50(_try50, 0)) {
          for (_lift50 = 0.5; _lift50 <= 6.01; _lift50 += 0.5) {
            if (_ok50(_try50, _lift50)) break;
          }
        }
      }
      if (_try50 < _dL50 - 0.05 || _lift50 > 0) {
        pos = A.clone().addScaledVector(_dDir50, Math.max(0.5, _try50))
          .addScaledVector(up, _lift50);
      }
    }

    /* ============================================================
     * v158.35（老板「操作上达到星露谷的标准了吗」）
     * WASD 必须是**屏幕方向**：按 W 往画面上方走，不管人物朝哪。
     * 必须在地面硬闸之后再算，否则被抬高的机位会让 W 方向差几度。
     * ============================================================ */
    var _hf = dirCam.clone().addScaledVector(up, -dirCam.dot(up));
    if (_hf.lengthSq() > 1e-6) {
      _hf.normalize().negate();
      M._surfFwdW = [_hf.x, _hf.y, _hf.z];
    } else {
      M._surfFwdW = null;      /* 正俯视（镜头在正上方）：退化，stepAvatar 退回人物朝向 */
    }

    cam.position.copy(pos);
    cam.up.copy(up);
    /* 看**锚点**而不是玩家：玩家因此在画面里偏向前进方向（约 5% 屏高），
       走动时"人真的在走"，停下后锚点归位、玩家回到正中。 */
    cam.lookAt(A.x, A.y, A.z);
    return true;
  };

  /* ============================================================
   * v158.0（P0 大世界）：位姿唯一出口
   * ------------------------------------------------------------
   * 读：M.playerPose()  —— 永远返回**深拷贝**（外部改它不许污染存档）
   * 写：M.setPlayerPose —— 唯一写入口，顺带同步 _standCi 格锚
   * 走：M.stepAvatar    —— kinematic 胶囊：球面方向 + 高度场采样，非物理引擎
   * 相机：M.followAvatar —— 第三人称 rig，只读位姿、不写 camO
   * ============================================================ */
  M.playerPose = function () {
    var st = GAME.state;
    if (!st) return null;
    if (!st._avatar && GAME.migrateAvatar158) GAME.migrateAvatar158(st);
    var a = st._avatar;
    if (!a) return null;
    return { dir: a.dir.slice(), h: a.h, yaw: a.yaw, v: a.v.slice() };
  };

  M.setPlayerPose = function (p) {
    var st = GAME.state;
    if (!st || !p) return false;
    if (!st._avatar && GAME.migrateAvatar158) GAME.migrateAvatar158(st);
    var a = st._avatar;
    if (!a) return false;
    if (Array.isArray(p.dir) && p.dir.length === 3
      && isFinite(p.dir[0]) && isFinite(p.dir[1]) && isFinite(p.dir[2])) {
      var L = Math.sqrt(p.dir[0] * p.dir[0] + p.dir[1] * p.dir[1] + p.dir[2] * p.dir[2]) || 1;
      a.dir = [p.dir[0] / L, p.dir[1] / L, p.dir[2] / L];
    }
    if (isFinite(p.h)) a.h = p.h;
    if (isFinite(p.yaw)) a.yaw = p.yaw;
    if (Array.isArray(p.v) && p.v.length === 3) a.v = [p.v[0] | 0, p.v[1] | 0, p.v[2] | 0];
    /* 格锚由 dir 派生；teleportTo 给的精确 ci 优先（避免球面最近格取整差一格）。 */
    if (p.ci != null) st._standCi = p.ci | 0;
    else if (p.dir && GAME.mapSphere && GAME.mapSphere.nearestCell) {
      /* nearestCell 是 O(nv)（4 万顶点），每帧跑会吃掉整帧预算。
         还在同一格（夹角 < 半格）就跳过；跨格才真正反算。 */
      var curCell = (st._standCi != null && GAME.mapSphere.cells[st._standCi])
        ? GAME.mapSphere.cells[st._standCi].dir : null;
      var dotSame = curCell ? (a.dir[0] * curCell[0] + a.dir[1] * curCell[1] + a.dir[2] * curCell[2]) : -1;
      if (dotSame <= 0.9999) {
        var ci = GAME.mapSphere.nearestCell(a.dir);
        if (ci >= 0) st._standCi = ci;
      }
    }
    return true;
  };

  /* ============================================================
   * v158.1（P1 大世界）：走近即交互
   * ------------------------------------------------------------
   * 老板口径（计划 §P1）：走到遗迹/资源/传送点前**出现提示**，按 E 触发
   * **原来那个面板**或获得物。因此这里只做"找目标"，绝不另起面板/另写背包。
   *
   * 判据（三条同时满足才算命中）：
   *   ① 距离：当前格 + 6 邻格（SP.adj 是六边邻接；球面没有"8 邻格"）；
   *   ② 朝向：目标方向落在角色**前方 30° 锥**内 —— 复用 P0 的 avatarBasis
   *      与 stepAvatar 同一个 fwd 公式，禁止另算一套（§589v 唯一出口）；
   *   ③ 内容：该格有实物（遗迹/村社/营地/城/据点/放置物），不是"路过就提示"。
   * 不进半径自动触发：老板 v157.96 口径"世界不能路过就踩雷"，必须显式按键。
   * ============================================================ */
  M.INTERACT_NEAR = true;
  M.INTERACT_RANGE = 1;                 /* 六边环数：≤1 格 */
  M.INTERACT_CONE = 30;                 /* 度：正前方半角 */
  var INTERACT_INFO = {
    own: ['己方城市', '进入'], npc: ['名城', '查看'], adm: ['行政城', '查看'],
    fort: ['据点', '查看'], lord: ['君主所在', '进入'],
    village: ['村社', '交涉'], camp: ['营地', '清剿'],   /* v158.25：ruin 已退役 */
    prop: ['放置物', '查看'],
    /* v158.12（S3）：资源地块 —— 只对「有工业价值」的三地形提示勘探，见 _interactKindOf */
    res: ['资源地块', '勘探']
  };
  /* 值得走近提示勘探的地形（森林→生物质 / 山地→废钢 / 荒漠→电能）。
     ⚠️ plain/caoyuan/lake 也映射 grain，但那是**最基础资源且遍地都是** ——
     每格都弹「勘探」会变成满屏噪音（老板交互 8 原则第 1 条：复杂留给系统）。
     这些地形仍可在**地块面板**里勘探，只是不在提示条上抢戏。 */
  var RES_HINT_TYPES = { forest: 1, hill: 1, desert: 1 };
  function _propAtCi(ci) {
    try {
      var d = SP.cells[ci].dir;
      var g = M.gridAt([d[0] * R, d[1] * R, d[2] * R]);
      if (!g) return null;
      return (GAME.place && GAME.place.at) ? GAME.place.at(g.i, g.j) : null;
    } catch (eP) { return null; }
  }
  function _interactKindOf(ci) {
    var k = (M.cellKind && M.cellKind[ci]) || null;
    if (k && INTERACT_INFO[k]) return k;
    /* ⛔ v158.25：'ruin' 这一 kind 随遗迹系统退役。 */
    try { if (GAME.camp && GAME.camp.isFound && GAME.camp.isFound(ci)) return 'camp'; } catch (e2) { }
    try {
      if (GAME.village && GAME.village.at && GAME.village.at(ci)
        && (!GAME.village.isKnown || GAME.village.isKnown(ci))) return 'village';
    } catch (e3) { }
    if (_propAtCi(ci)) return 'prop';
    /* v158.12（S3）：未勘探的资源地块 → 提示可勘探。
       排序放在最后：城/遗迹/村社/营地这些「有实物的东西」优先，资源地块是
       地形自带的背景层，不该把它们的状态提示挤掉。
       只认森林/山地/荒漠（见 RES_HINT_TYPES），且**已勘探就不再提示**
       —— 勘探是一次性的，勘探完提示条该消失，换面板里的建厂入口。 */
    try {
      var _rv = (GAME.resource && GAME.resource.view) ? GAME.resource.view(ci) : null;
      if (_rv && !_rv.scanned && RES_HINT_TYPES[_rv.type]) return 'res';
    } catch (eR) { }
    return null;
  }
  /* 返回 {ci, kind, name, verb, angle, hex} 或 null。**只读**，不改 state。 */
  M.nearestInteractable = function () {
    if (!M.INTERACT_NEAR || !M.PLAYER_AVATAR) return null;
    var st = GAME.state, p = M.playerPose();
    if (!st || !p || !SP || !SP.cells) return null;
    var ci = st._standCi;
    if (!(ci >= 0) || !SP.cells[ci]) return null;
    var fr = avatarBasis(p.dir), yaw = p.yaw || 0;
    var fwd = [
      fr.east[0] * Math.sin(yaw) - fr.south[0] * Math.cos(yaw),
      fr.east[1] * Math.sin(yaw) - fr.south[1] * Math.cos(yaw),
      fr.east[2] * Math.sin(yaw) - fr.south[2] * Math.cos(yaw)
    ];
    var cand = [ci].concat(SP.adj[ci] || []);
    var lim = M.INTERACT_RANGE | 0, cone = M.INTERACT_CONE;
    var best = null;
    for (var i = 0; i < cand.length; i++) {
      var t = cand[i];
      if (!(t >= 0) || !SP.cells[t]) continue;
      var hex = (t === ci) ? 0 : 1;
      if (hex > lim) continue;
      var ang = 0;
      if (hex) {
        /* ⚠️ 别拿 fwd 直接点乘 td：td 是**径向**（邻格与脚下只差 ~1°），
           fwd 是**切向**，两者天然正交（实测 dot≈0.018 → 89°），会把正前方
           的所有目标都判成背后。先把 td 投影到角色切平面，再与 fwd 比夹角。 */
        var td = SP.cells[t].dir;
        var rad = td[0] * p.dir[0] + td[1] * p.dir[1] + td[2] * p.dir[2];
        var pv = [td[0] - rad * p.dir[0], td[1] - rad * p.dir[1], td[2] - rad * p.dir[2]];
        var pl = Math.sqrt(pv[0] * pv[0] + pv[1] * pv[1] + pv[2] * pv[2]);
        if (pl > 1e-9) {
          var dot = (fwd[0] * pv[0] + fwd[1] * pv[1] + fwd[2] * pv[2]) / pl;
          ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
          if (ang > cone) continue;                  /* 背对 / 超锥 = 误触，直接排除 */
        }
      }
      /* 未探明的格不长出可交互物 —— 与 _cellBrief「未探明」口径一致 */
      try { if (GAME.fog && GAME.fog.get && GAME.fog.get(t) <= 0) continue; } catch (eF) { }
      var kind = _interactKindOf(t);
      if (!kind || !INTERACT_INFO[kind]) continue;
      var score = hex * 100 + ang;                   /* 当前格优先，其次夹角最小 */
      if (best && score >= best._score) continue;
      best = {
        ci: t, kind: kind, name: INTERACT_INFO[kind][0], verb: INTERACT_INFO[kind][1],
        angle: +ang.toFixed(2), hex: hex, _score: score
      };
    }
    if (best) delete best._score;
    return best;
  };

  /* 胶囊半径（世界单位）：皮肤宽度 0.03 = 半径的 10%，照 Unity CharacterController 口径。 */
  M.CAPSULE_R = 0.3;
  M.WALK_SPEED = 4.5;
  /* ============================================================
   * v158.32（老板「我只是想要人物操纵感」）
   * ------------------------------------------------------------
   * 病根不是键位，是**人是个开关**：`step = move * WALK_SPEED * dt` 一帧满速、
   * 松手一帧归零，`p.v` 恒 [0,0,0] —— 观感就是"贴地滑行的方块"，
   * 按下去和松开之间没有任何重量。
   * 现在给速度一个一阶状态：起步 ~0.25 秒到全速、松手 ~0.17 秒停住；
   * 撞上陡坡/被挡时速度直接归零（不许顶着山继续"蓄力"）。
   * ============================================================ */
  /* v158.35（老板「达到星露谷的标准了吗」）：加减速**调快一倍**。
     0.25 秒到全速在手感上就是"按下去等一下才动"；星露谷几乎是瞬时。
     现在 0.13 秒起、0.10 秒停 —— 仍有重量感（不是开关），但跟手。 */
  M.WALK_ACCEL = 34;           /* m/s²：0 → 4.5 约 0.13 秒 */
  M.WALK_BRAKE = 44;           /* m/s²：4.5 → 0 约 0.10 秒 */
  /* v158.35：`M.BACK_RATE`（后退 62% 速度）随坦克式操作一起退役 ——
     八方向里"S"是"往画面下方走"，不是倒车，八个方向一律同速。 */
  M.YAW_TAU = 0.06;            /* 朝向对齐移动方向的时间常数（秒）：≈3.6 帧，几乎瞬时 */
  M._surfFwdW = null;          /* 屏幕前方（切平面上），由 _surfAvatarCam 每帧写 */
  M._lastWd = null;            /* 最后一次移动方向：松手后沿它滑停 */
  M._spd = 0;                  /* 当前速度大小（m/s，v158.35 起恒 ≥0：方向由 _mvDir 定） */
  M.SLIDE_SPEED = 3.0;
  M.SLOPE_LIMIT = 40;

  /* 一步走：输入 → 切平面位移 → 坡度判定 → 贴高。
     keys 形如 {w:1,a:0,s:0,d:0}；返回诊断量给探针/断言读，不返回位姿本身。 */
  M.stepAvatar = function (dt, keys) {
    var p = M.playerPose();
    if (!p) return null;
    dt = Math.max(0, Math.min(0.05, dt || 0.016));
    var fr = avatarBasis(p.dir);                  // 连续基：surfaceFrame 在极点会反向
    var yaw = p.yaw || 0;
    var fwd = [
      fr.east[0] * Math.sin(yaw) - fr.south[0] * Math.cos(yaw),
      fr.east[1] * Math.sin(yaw) - fr.south[1] * Math.cos(yaw),
      fr.east[2] * Math.sin(yaw) - fr.south[2] * Math.cos(yaw)
    ];
    /* ============================================================
     * v158.35（老板「操作上达到星露谷的标准了吗」）
     * ------------------------------------------------------------
     * 之前是**坦克式**：W/S = 前后油门，A/D = 原地转向（yaw += 3 rad/s）。
     *   实测单按 D 一秒：位移 **0 米**、人原地转 172° —— 按"右"却不往右走。
     * 星露谷是**八方向**：WASD 直接就是屏幕方向上的位移，
     *   斜向**归一化**（不会斜着更快），人物朝向自动对齐移动方向，
     *   没有独立的"转身键"。
     * 这一版按星露谷口径重写输入层。A/D 从"转身"改成"左右平移"；
     *   要原地环顾请用右键拖（绕角色转，v158.27 已改好）。
     * ============================================================ */
    var _mx = ((keys && keys.d) ? 1 : 0) - ((keys && keys.a) ? 1 : 0);
    var _my = ((keys && keys.w) ? 1 : 0) - ((keys && keys.s) ? 1 : 0);
    var _hasIn = (_mx !== 0 || _my !== 0);
    var out = { moved: 0, slide: 0, slope: 0, blocked: 0, ground: 0, gap: 0 };

    /* 屏幕基（切平面上）：前方 = 镜头看进去的那一侧；右 = 前 × 径向
       （`M._surfFwdW` 由 `_surfAvatarCam` 每帧写；高空时退回人物朝向） */
    var _sf = fwd;
    if (M._surf && M._surfFwdW && isFinite(M._surfFwdW[0])) {
      var _s0 = M._surfFwdW;
      var _sd0 = _s0[0] * p.dir[0] + _s0[1] * p.dir[1] + _s0[2] * p.dir[2];
      var _ox = _s0[0] - _sd0 * p.dir[0];
      var _oy = _s0[1] - _sd0 * p.dir[1];
      var _oz = _s0[2] - _sd0 * p.dir[2];
      var _ol = Math.sqrt(_ox * _ox + _oy * _oy + _oz * _oz);
      if (_ol > 1e-6) _sf = [_ox / _ol, _oy / _ol, _oz / _ol];
    }
    var _rt = [
      _sf[1] * p.dir[2] - _sf[2] * p.dir[1],
      _sf[2] * p.dir[0] - _sf[0] * p.dir[2],
      _sf[0] * p.dir[1] - _sf[1] * p.dir[0]
    ];
    var _rl = Math.sqrt(_rt[0] * _rt[0] + _rt[1] * _rt[1] + _rt[2] * _rt[2]);
    _rt = (_rl > 1e-9) ? [_rt[0] / _rl, _rt[1] / _rl, _rt[2] / _rl] : [0, 0, 0];

    /* 输入 → 世界方向。**必须归一化**：不然 W+D 会比单按 W 快 41%
       （斜向 bug 是 2D 游戏最经典的一处不专业）。 */
    var _wd = null;
    if (_hasIn) {
      var _wx = _sf[0] * _my + _rt[0] * _mx;
      var _wy = _sf[1] * _my + _rt[1] * _mx;
      var _wz = _sf[2] * _my + _rt[2] * _mx;
      var _wl = Math.sqrt(_wx * _wx + _wy * _wy + _wz * _wz);
      if (_wl > 1e-9) {
        _wd = [_wx / _wl, _wy / _wl, _wz / _wl];
        /* 朝向自动对齐移动方向：指数插值，时间常数 M.YAW_TAU（0.06 秒 ≈ 3.6 帧）。
           不做"转向键"，也不再是恒速转盘 —— 往哪走就朝哪。 */
        var _ey = _wd[0] * fr.east[0] + _wd[1] * fr.east[1] + _wd[2] * fr.east[2];
        var _sy = _wd[0] * fr.south[0] + _wd[1] * fr.south[1] + _wd[2] * fr.south[2];
        var _tgtYaw = Math.atan2(_ey, -_sy);
        var _dyaw2 = _tgtYaw - yaw;
        while (_dyaw2 > Math.PI) _dyaw2 -= Math.PI * 2;
        while (_dyaw2 < -Math.PI) _dyaw2 += Math.PI * 2;
        yaw += _dyaw2 * (1 - Math.exp(-dt / M.YAW_TAU));
        M._lastWd = _wd;
      }
    }
    /* ---- 速度是一阶状态（有起步/刹车），但**八个方向同速** ---- */
    var _tgtSpd = _hasIn ? M.WALK_SPEED : 0;
    if (M._spd == null || !isFinite(M._spd)) M._spd = 0;
    var _dv = _tgtSpd - M._spd;
    var _rate = (_tgtSpd > M._spd) ? M.WALK_ACCEL : M.WALK_BRAKE;
    var _cap = _rate * dt;
    if (_dv > _cap) _dv = _cap; else if (_dv < -_cap) _dv = -_cap;
    M._spd += _dv;
    if (!_hasIn && Math.abs(M._spd) < 0.03) M._spd = 0;   /* 收尾别留 0.02 的"蠕" */
    var step = M._spd * dt;
    /* 位移沿**输入方向**（不是人物朝向）：朝向哪怕还在插值，人已经往对的方向走了
       —— 这就是"跟手"的来源。松手后沿最后一次方向滑停。 */
    var _mvDir = _wd || M._lastWd || fwd;
    if (Math.abs(step) > 1e-9) {
      var nd = [
        p.dir[0] + _mvDir[0] * step / R,
        p.dir[1] + _mvDir[1] * step / R,
        p.dir[2] + _mvDir[2] * step / R
      ];
      var nL = Math.sqrt(nd[0] * nd[0] + nd[1] * nd[1] + nd[2] * nd[2]) || 1;
      nd = [nd[0] / nL, nd[1] / nL, nd[2] / nL];
      var g0 = M._groundAtUnit(p.dir), g1 = M._groundAtUnit(nd);
      var slope = Math.atan2(g1 - g0, Math.max(0.01, Math.abs(step))) * 180 / Math.PI;
      out.slope = +slope.toFixed(2);
      if (slope > M.SLOPE_LIMIT && g1 > g0) {
        /* 陡坡上行被挡 + 反向滑落（>40° 是老板原话；5° 滞回防抖）。 */
        var sd = [
          p.dir[0] - _mvDir[0] * M.SLIDE_SPEED * dt / R,
          p.dir[1] - _mvDir[1] * M.SLIDE_SPEED * dt / R,
          p.dir[2] - _mvDir[2] * M.SLIDE_SPEED * dt / R
        ];
        var sL = Math.sqrt(sd[0] * sd[0] + sd[1] * sd[1] + sd[2] * sd[2]) || 1;
        p.dir = [sd[0] / sL, sd[1] / sL, sd[2] / sL];
        p.h = M._groundAtUnit(p.dir);
        out.slide = 1; out.blocked = 1;
        M._spd = 0;                            /* 顶住了就是顶住了，不许继续蓄速 */
      } else {
        p.dir = nd; p.h = g1; out.moved = 1;
      }
      out.ground = p.h;
    } else {
      /* 站着也逐帧贴高：地形被建造/整平改动时脚不会陷进去或飘起来。 */
      p.h = M._groundAtUnit(p.dir);
      out.ground = p.h;
    }
    p.yaw = yaw;
    /* v158.32：`p.v` 从"恒 [0,0,0]"改成**真实速度向量** —— 动画相位、镜头滞后、
       探针都该读它，而不是读那个写死的 WALK_SPEED。 */
    p.v = [_mvDir[0] * M._spd, _mvDir[1] * M._spd, _mvDir[2] * M._spd];
    out.spd = +M._spd.toFixed(4);
    if (Math.abs(M._spd) > 0.15) out.moved = 1;
    M.setPlayerPose(p);
    var chk = M.playerPose();
    out.gap = +Math.abs(chk.h - M._groundAtUnit(chk.dir)).toFixed(4);
    return out;
  };

  /* ============================================================
   * v158.20（老板「去掉人物模式 · 只提示人物位置 · 让人物真实走动起来」）
   * ------------------------------------------------------------
   * 点地图 = 小人**真的走过去**：不切视角、不瞬移、不新增"模式"。
   * 只记一个目标格，渲染循环每帧沿球面弧线推进；到了停、再交回交互。
   * 相机不动 —— 这是战略视角，镜头由玩家自己缩放平移，不是"人物模式"。
   * （v151 前传曾有「点地图 = 走路」的玩法，v157.85 前传退役时被删；这里恢复它，
   *   并把它接到现有的 _openCellPanel 交互上 —— 走过去和看信息同时发生。）
   * ============================================================ */
  M._walkTo = -1;
  /* ============================================================
   * v158.37（老板「存在高度跳变」）：自动走"到达"判据的距离阈值。
   * ------------------------------------------------------------
   * 原值 0.6m 写在分支里 —— 到达那一帧直接把角色从"距目标 0.6m 处"
   * 锁到目标格心。探针 p_height_jump 实测：38° 坡上一帧高度跳 0.518m、
   * 相机半径跳 0.528m（键盘走路只有 0.059m/帧）——肉眼可见的"高度跳变"。
   * 收紧到 2cm：让 slerp 把最后一段走完，高度仍逐帧走 _groundAtUnit
   * 唯一出口采样；到达帧与前一帧高度差 < 2cm×坡度 ≈ 0.02m，连续。
   * ⛔ 别再调大：0.6m 的教训就是"看着很小的阈值，在陡坡上也是大跳变"。
   * ============================================================ */
  M.WALK_TO_ARRIVE_M = 0.02;
  M.walkTo = function (ci) {
    ci = ci | 0;
    if (!(_tileCells && _tileCells[ci])) return false;
    if (!GAME.state) return false;
    if (!GAME.state._avatar) M.teleportTo(ci);      /* 还没有位姿：先落到当前格 */
    M._walkTo = ci;
    return true;
  };
  M.walkStop = function () { M._walkTo = -1; return true; };
  M.walkTarget = function () { return M._walkTo; };
  /** 每帧推进（仅战略视角）：返回 {moved} / {arrived:ci} / null。FOLLOW 态交给 followAvatar。 */
  M.stepWalkTo = function (dt) {
    if (M._walkTo < 0 || M.FOLLOW) return null;
    var p = M.playerPose();
    var tc = _tileCells && _tileCells[M._walkTo];
    if (!p || !tc || !tc.dir) { M._walkTo = -1; return null; }
    dt = Math.max(0, Math.min(0.05, dt || 0.016));
    var td = tc.dir;
    var dot = p.dir[0] * td[0] + p.dir[1] * td[1] + p.dir[2] * td[2];
    dot = Math.max(-1, Math.min(1, dot));
    var ang = Math.acos(dot);                       /* 球面角距（弧度） */
    var dist = ang * R;                             /* 球面弧距（米） */
    if (dist <= M.WALK_TO_ARRIVE_M) {               /* 到达（2cm 内）→ 锁定到目标格；v158.37 收紧，见常量注释 */
      var hitCi = M._walkTo; M._walkTo = -1;
      M.setPlayerPose({ dir: [td[0], td[1], td[2]], h: M._groundAtUnit(td),
        yaw: (p.yaw || 0), v: [0, 0, 0], ci: hitCi });
      M._standVer = '';
      /* ============================================================
       * v158.24（老板「怎么走近，行为逻辑链真的有吗」）
       * ------------------------------------------------------------
       * "走过去之后要做的事"放在**到达的唯一出口**，不放在渲染循环里。
       * 原因：渲染循环只是驱动者之一（自动化/探针也会直接推 stepWalkTo），
       *   把业务放在驱动者里，换个驱动就整段失效 —— 实测手动步进时
       *   `_walkThen` 永远不执行，表现为"走到了却没勘探"。
       * 这里只做"数据层的到达动作"（勘探免费、立即完成）；
       * 面板交给外层（`_openCellPanel`）开，UI 不往下沉。
       * ============================================================ */
      var _then24 = M._walkThen;
      if (_then24 && _then24.ci === hitCi) {
        M._walkThen = null;
        if (_then24.act === 'scan') {
          try { if (GAME.resource && GAME.resource.scan) GAME.resource.scan(hitCi); } catch (eWS24) { }
          if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🔍 到了，已替你勘探');
        } else if (_then24.act === 'build') {
          if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🏭 到地块了 —— 可以建采集场');
        }
      }
      return { arrived: true, ci: hitCi };
    }
    var step = Math.min(dist, M.WALK_SPEED * dt);
    /* v158.20：**球面大圆插值（slerp）**，不是线性插值再归一化 ——
       后者在夹角大时弧长会明显缩水、极端情况（近对跖）直接退化，
       实测"点远处那一格"会越走越偏（dot 0.26 / 距目标 392m）。 */
    var stepAng = Math.min(ang, step / R);
    var sinA = Math.sin(ang);
    var nd;
    if (sinA < 1e-6) {
      nd = td.slice();                              /* 重合 / 对跖的退化兜底 */
    } else {
      var w1 = Math.sin(ang - stepAng) / sinA;
      var w2 = Math.sin(stepAng) / sinA;
      nd = [p.dir[0] * w1 + td[0] * w2,
            p.dir[1] * w1 + td[1] * w2,
            p.dir[2] * w1 + td[2] * w2];
      var nL = Math.sqrt(nd[0] * nd[0] + nd[1] * nd[1] + nd[2] * nd[2]) || 1;
      nd = [nd[0] / nL, nd[1] / nL, nd[2] / nL];
    }
    /* 朝向 = 行进方向（与 stepAvatar 的 fwd 同一把尺：yaw=0 → 朝北） */
    var fr = avatarBasis(p.dir);
    var tx = td[0] - p.dir[0] * dot, ty = td[1] - p.dir[1] * dot, tz = td[2] - p.dir[2] * dot;
    var dx = tx * fr.east[0] + ty * fr.east[1] + tz * fr.east[2];
    var dz = tx * fr.south[0] + ty * fr.south[1] + tz * fr.south[2];
    var yaw = Math.atan2(dx, -dz);
    /* 不传 ci：让格锚按 dir 反算（setPlayerPose 有"同格跳过"优化，4 万顶点不会每帧跑）。 */
    M.setPlayerPose({ dir: nd, h: M._groundAtUnit(nd), yaw: yaw, v: [0, 0, 0] });
    /* 只挪图元、不重建（重建会闪）；摆腿跟上 */
    var fg = figCache && figCache['stand'] && figCache['stand'].g;
    /* v158.36：收口到唯一出口 —— 自动走路也走 syncAvatarFigure（有手臂/躯干动画），
       不再调那个会抛 avOut 的重复函数。 */
    try { M.syncAvatarFigure(dt, { moved: true, spd: M.WALK_SPEED }); } catch (eAF) { }
    return { moved: +step.toFixed(3), left: +(dist - step).toFixed(1) };
  };

  /* ============================================================
   * v158.0（P0）：第三人称跟随相机 —— Cinemachine Third Person Follow 的
   * 极简骨架：Origin(角色) → Hand(眼高) → Camera(身后 6m / 俯角 15°)。
   * ⛔ 不写 camO 任何字段：轨迹球真值是 camO.quat，碰它就会让退出跟随
   *    那一帧画面跳回；也不写 M._rAlt/_agl/_zoomTarget（那属于 placeCamera）。
   * ============================================================ */
  M.FOLLOW_DIST = 6.0;
  M.FOLLOW_PITCH = 15;
  M.FOLLOW_DAMP = 0.15;
  M._followPos = null;

  /* ============================================================
   * v158.22（老板「操控一小人走在地面上」）：**把小人摆到连续位姿 + 摆腿**
   * ------------------------------------------------------------
   * 从 followAvatar 里抽出来的公用出口，两个相机共用：
   *   · followAvatar（街区自动落位 / 旧第三人称）
   *   · 地表跟随相机（_surfAvatarCam，星露谷视角）—— 那套只管镜头，不管模型，
   *     过去地表时小人停在格心、腿也不动，近看就是"人贴地滑行"。
   * 只读位姿；相位跟速度（步幅 1.5m 口径），一停立刻归零。
   * ============================================================ */
  M.syncAvatarFigure = function (dt, avOut) {
    var p = M.playerPose();
    if (!p) return null;
    dt = Math.max(0, Math.min(0.05, dt || 0.016));
    var fg = (figCache && figCache['stand']) ? figCache['stand'].g : null;
    if (!fg) return null;
    placeFigureAtDir(fg, p.dir, (p.yaw || 0) * 180 / Math.PI);
    var _mv = !!(avOut && avOut.moved);
    M._figMoving = _mv;                            /* v158.19：figureOf().walking 读它 */
    /* v158.33：相位跟**真实速度**（v158.32 加了起步/刹车，慢走腿要慢、刹车腿要收） */
    var _spd = (avOut && isFinite(avOut.spd)) ? Math.abs(avOut.spd) : (_mv ? M.WALK_SPEED : 0);
    if (_spd > 0.12) M._figPhase = (M._figPhase || 0) + dt * (_spd / 1.5) * Math.PI;
    else M._figPhase = 0;
    /* 摆幅也跟速度：起步那一下是"小步"，不是一上来就甩大腿 */
    var _amp = 0.6 * Math.min(1, 0.25 + _spd / Math.max(0.1, M.WALK_SPEED));
    var _sw = _spd > 0.12 ? Math.sin(M._figPhase) * _amp : 0;
    var _legs = fg.userData && fg.userData.legs;
    if (_legs && _legs.length) {
      _legs[0].rotation.x = _sw;
      if (_legs[1]) _legs[1].rotation.x = -_sw;
    }
    /* 手臂反相摆（左腿前 → 右臂前），幅度略小于腿 */
    var _arms = fg.userData && fg.userData.arms;
    if (_arms && _arms.length) {
      _arms[0].rotation.x = -_sw * 0.85;
      if (_arms[1]) _arms[1].rotation.x = _sw * 0.85;
    }
    /* 躯干随速度前倾（最多 ~7°）：站着笔直、跑起来前压 —— 人味儿的一半在这 */
    var _tor = fg.userData && fg.userData.torso;
    if (_tor) {
      var _lean = Math.min(0.12, (_spd / Math.max(0.1, M.WALK_SPEED)) * 0.12);
      _tor.rotation.x = _lean;
    }
    /* 3cm 上下颠簸（与街区同一口径）：纯滑行最大的观感破绽是"身体高度完全不抖"。 */
    if (_mv && _spd > 0.12) fg.position.y += Math.abs(Math.sin(M._figPhase)) * 0.03 * (fg.userData.baseScale || 1);
    /* 脚步声的视觉那半：相位每过 π = 一步，脚下踢一团土 */
    if (_spd > 0.45) {
      var _si = Math.floor(M._figPhase / Math.PI);
      if (M._figStepIdx == null) M._figStepIdx = _si;
      else if (_si !== M._figStepIdx) { M._figStepIdx = _si; _dustSpawn(fg.position, fg.userData.baseScale || 1); }
    } else {
      M._figStepIdx = null;
    }
    return fg;
  };

  M.followAvatar = function (dt, avOut) {
    var p = M.playerPose();
    if (!p) return null;
    dt = Math.max(0, Math.min(0.05, dt || 0.016));
    var fr = avatarBasis(p.dir);
    var yaw = p.yaw || 0;
    var fwd = [
      fr.east[0] * Math.sin(yaw) - fr.south[0] * Math.cos(yaw),
      fr.east[1] * Math.sin(yaw) - fr.south[1] * Math.cos(yaw),
      fr.east[2] * Math.sin(yaw) - fr.south[2] * Math.cos(yaw)
    ];
    var eyeY = R + p.h + 1.7;                      // 1.7m 眼高（不可谈判的人体常量）
    var P = [p.dir[0] * eyeY, p.dir[1] * eyeY, p.dir[2] * eyeY];
    var rise = M.FOLLOW_DIST * Math.tan(M.FOLLOW_PITCH * Math.PI / 180);
    var target = [
      P[0] - fwd[0] * M.FOLLOW_DIST + fr.up[0] * rise,
      P[1] - fwd[1] * M.FOLLOW_DIST + fr.up[1] * rise,
      P[2] - fwd[2] * M.FOLLOW_DIST + fr.up[2] * rise
    ];
    function liftOutOfGround(v) {
      var L = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
      var d = [v[0] / L, v[1] / L, v[2] / L];
      var floor = R + M._groundAtUnit(d) + 0.5;
      var r = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      if (r < floor) return [d[0] * floor, d[1] * floor, d[2] * floor];
      return v;
    }
    target = liftOutOfGround(target);
    if (!M._followPos) M._followPos = target.slice();
    var k = 1 - Math.exp(-dt / M.FOLLOW_DAMP);      // 帧率无关的指数阻尼
    for (var i = 0; i < 3; i++) M._followPos[i] += (target[i] - M._followPos[i]) * k;
    M._followPos = liftOutOfGround(M._followPos);
    cam.position.set(M._followPos[0], M._followPos[1], M._followPos[2]);
    cam.up.set(fr.up[0], fr.up[1], fr.up[2]);
    cam.lookAt(P[0], P[1], P[2]);
    cam.updateMatrixWorld();
    /* v158.22：摆人 + 摆腿走公用出口（地表跟随相机也调它，近看不许滑行）。 */
    M.syncAvatarFigure(dt, avOut);
    var dx = M._followPos[0] - P[0], dy = M._followPos[1] - P[1], dz = M._followPos[2] - P[2];
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    var horiz = Math.sqrt(dx * dx + dz * dz);
    var fL = Math.sqrt(M._followPos[0] * M._followPos[0] + M._followPos[1] * M._followPos[1]
      + M._followPos[2] * M._followPos[2]) || 1;
    var fdir = [M._followPos[0] / fL, M._followPos[1] / fL, M._followPos[2] / fL];
    return {
      dist: +dist.toFixed(3),
      pitch: +(Math.atan2(dy, Math.max(0.01, horiz)) * 180 / Math.PI).toFixed(3),
      groundGap: +(fL - R - M._groundAtUnit(fdir)).toFixed(3)
    };
  };

  /* 进入/退出跟随态。进入时把角色放到相机当前看的方向，避免"一按 Tab 人瞬移"。 */
  M.setFollow = function (on) {
    on = !!on;
    if (!M.PLAYER_AVATAR) on = false;
    if (on) {
      var d = camO.dir || [0, 1, 0];
      if (!GAME.state || !GAME.state._avatar) {
        M.setPlayerPose({ dir: [d[0], d[1], d[2]], h: M._groundAtUnit(d), yaw: 0, v: [0, 0, 0] });
      } else {
        /* v158.14：新开局 migrateAvatar158 早把 _avatar 建好了，上面那条就不会走 ——
           于是 _standCi 一直是空，playerCi() 恒 -1，"脚下是不是城格"无从判断，
           下面自动进街区永远触发不了（实测就是这个原因）。这里同出口写回一次
           （位姿逐位不动），只为让 setPlayerPose 内部按 dir 反算格锚。 */
        M.setPlayerPose(M.playerPose());
      }
      /* v158.42：进出地表走平滑跳转，高度连续（原 surfaceMode 直接写 dist 会硬跳）。 */
      _zoomTo(R + elevAvgAt(camO.dir || [0, 1, 0]) + (M.SURF_EYE || 1.7) * 1.5);
      M._followPos = null;
    } else {
      /* v158.14：退出跟随必须把相机放回轨道高度。只清 FOLLOW 会让 camO.dist
         停在进地表时写的 302，人走了、镜头还贴在地面上 —— 实机表现是
         「Q 回星球后满屏一片蓝」（就是贴在球面上看海）。surfaceMode(false)
         把 dist 复位到 R*2.9，即进地表前的战略视野。 */
      try { _zoomTo(R * 2.9); } catch (eSm) { }
    }
    M.FOLLOW = on;
    /* v158.14（老板「我至今没有发现操作选项」）：跟随态常驻操作条。
       与底栏「🧍 人物」高亮同一个开关，进出都走这一条出口，
       不在别处单独写 DOM（否则按钮/Tab/退出三条路径会各写一份、状态打架）。 */
    if (GAME.ui && GAME.ui.renderFollowHud) GAME.ui.renderFollowHud(on);
    /* v158.14：站在城市格上进人物视角 → 直接落到街区（见 M.AUTO_DISTRICT 说明）。
       与面板「🚶 走进街区」同一个 enter 出口；失败静默落回纯球面站位。 */
    if (on && M.AUTO_DISTRICT !== false && M.DISTRICT !== false
      && GAME.district && GAME.district.enter && !GAME.district.active) {
      try {
        var _adCi = M.playerCi(), _adCity = null;
        var _adCs = (GAME.state && GAME.state.cities) || [];
        for (var _adi = 0; _adi < _adCs.length; _adi++) {
          if (_adCs[_adi] && _adCs[_adi].ci === _adCi) { _adCity = _adCs[_adi]; break; }
        }
        if (_adCity) {
          var _adR = GAME.district.enter(_adCi, _adCity);
          if (_adR && _adR.ok) {
            if (GAME.ui && GAME.ui.renderDistrictHud) GAME.ui.renderDistrictHud(true);
            M._districtWasActive = true;
            if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🚶 已在城内街区 · WASD / 方向键走 · Q 回星球');
          }
        }
      } catch (eAd) { }
    }
    /* 退出跟随 = 同时退出街区（否则人留在街道上，球面位姿与街区态打架）。
       ⚠️ 不在这里清 M._districtWasActive —— 渲染循环的 else 分支靠它调一次
       D.resetCam()，提前清掉会让街区相机的过渡起点残留（下一轮进街区闪一下）。 */
    if (!on && GAME.district && GAME.district.active && GAME.district.exit) {
      try {
        GAME.district.exit();
        if (GAME.ui && GAME.ui.renderDistrictHud) GAME.ui.renderDistrictHud(false);
      } catch (eDx) { }
    }
    if (!on && GAME.ui && GAME.ui.renderInteractHint) {
      M._interactHintSig = '';                       /* 退出跟随立刻收提示，不留在屏幕上 */
      GAME.ui.renderInteractHint(null);
    }
    /* ⛔ v158.20（老板「去掉人物模式」）：这里原来是"同步底栏「🧍 人物」按钮高亮"，
       按钮已删 → 整段退役（留着就是孤儿按钮引用，audit 会拦）。 */
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    return M.FOLLOW;
  };

  /* ============================================================
   * v153b（老板：「可以在星球地表上逐格移动」）——
   * 走路时不是"瞬移一格"，而是**沿地表最短弧插值走过来**（~220ms），
   * 走的那 0.22 秒里腿在摆；到了再触发一次"落脚"动作（`state._walkTo` 清空）。
   * 地图上其他人（战斗单位）走地表由 `M.surfaceWalk()` 同一套插值处理。
   * ============================================================ */
  /* ⛔ v157.85：`walkAnim` / `M.walkDur` / `slerpVec` / `startWalk` 整条链删除 ——
     它们只服务「前传君主点地图沿地表走过去」（`M.buildLordWalking`）。
     前传退役后没有人偶需要逐格插值，城市人偶换格直接重摆（`buildFigures`）。 */
  /* ============================================================
   * v92.240k（老板：「在地图界面的地块上放置物体……形成标准化的物品放置和组件引擎」）
   * ------------------------------------------------------------
   * 这一层只认数据层 `GAME.place`（js/placement.js）：
   *   · 读 `all()` 摆网格，`ver()` 变了才全量重建（放置/拆除/旋转都会 bump）；
   *   · 外观走**程序化几何**（物品目录里的 `geo.parts`：box/cyl/cone/sphere），
   *     不依赖美术资源 —— 往后加物品只改目录一行，这里一行都不用动。
   * 摆放算法沿用 `placeFigure`（+Y 对齐格法线 + 贴地），
   * 唯一区别：朝向用**玩家可控的 yaw**（记录里带 y 字段），不是按 ci 随机。
   * ============================================================ */
  var plRoot = null, plGhost = null, _plVer = -1;

  /* 一格的世界宽度（40962 格时 ≈3.26）。目录里的 w=1 取 0.8 格宽 ——
     太大会糊住相邻格，太小则像地上撒了把芝麻。 */
  function propScale() {
    var n = (_tileCells || []).filter(Boolean).length || 1;
    var cellW = Math.sqrt(4 * Math.PI * R * R / n) || 1;
    return Math.max(0.6, Math.min(9, cellW * 0.8));
  }
  function disposeTree(g) {
    if (!g) return;
    g.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    });
  }
  /* ghost: null=实体 / 'ok'=合法预览 / 'bad'=非法预览（染红） */
  function makeProp(item, ghost) {
    var grp = new THREE.Group();
    var parts = (item && item.geo && item.geo.parts) || [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], geo = null;
      if (p.k === 'cyl') geo = new THREE.CylinderGeometry(p.r || 0.2, p.r || 0.2, p.h || 0.4, 10);
      else if (p.k === 'cone') geo = new THREE.ConeGeometry(p.r || 0.2, p.h || 0.4, 10);
      else if (p.k === 'sphere') geo = new THREE.SphereGeometry(p.r || 0.2, 10, 8);
      else geo = new THREE.BoxGeometry(p.w || 0.4, p.h || 0.4, p.d || 0.4);
      var col = (p.c == null ? 0x8a8577 : p.c);
      var mat = ghost === 'bad'
        ? new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.40, depthWrite: false })
        : ghost === 'ok'
          ? new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, depthWrite: false })
          : new THREE.MeshLambertMaterial({ color: col });
      var m = new THREE.Mesh(geo, mat);
      m.position.set(p.x || 0, p.y || 0, p.z || 0);
      if (p.rx) m.rotation.x = p.rx * Math.PI / 180;
      grp.add(m);
    }
    return grp;
  }
  /* 把一件物品坐到某格上：+Y 对法线、贴地表、再绕竖轴转 yaw（度）。
     ============================================================
     v156.25：这里与 `surfaceQuad(ci, yaw)` **数学等价**（实测 |dot|=1.000000000000，
       上轴偏差 5e-16 = 浮点噪声；见 .workbuddy/tools/show/probe_axis_equiv.js）：
         setFromUnitVectors(up, n)  → 「对齐」四元数
         rotateY(θ)                 → **局部轴**右乘（three 的实现就是 q × qY）
       和 surfaceQuad 里 `q × qY(局部)` 是同一个式子，只是写法不同。
     ⛔ 唯一要守的判据：**转身永远绕局部轴**。
       反例（v156.19 城堡朝向错乱的真因）：`q.multiply(绕世界法线`n`的四元数)`。
       四元数右乘是"先转右边、再转左边" —— 拿世界轴当右边，等于先把物体上轴
       从法线上掰开、再用 q 拉回来，于是每座城随机歪 0~90°（实测 18.6° / 142°）。
     以后若要合并这两处：**整段替换 + 跑探针复验**，不要"顺手"把 rotateY
       换成绕世界轴的写法 —— 那种改动看起来更"对称"，但它就是上面那个 bug。
     ============================================================ */
  /* 把物件坐到**方格 (i,j) 的格心**上。
     v157.26：位置改由 gridCellDir 给（方格坐标系），高度走 groundHAt（含整平台面）。 */
  function seatProp(g, i, j, yawDeg) {
    var d = null;
    try { d = M.gridCellDir(i, j); } catch (e0) { d = null; }
    if (!d) return false;
    /* v157.21：**必须走 groundHAt**（含整平台面），不能再用 sphElev（只认自然地形）。
       旧写法的后果：在抬高的台地上放树 → 树落在原地形高度 → 整棵埋进台面里看不见；
       在挖低的台地上放 → 树浮在半空。这正是老板说的"放置很不稳定"。
       抬 0.05 是防 z-fighting（砖面本身已经比地面高 SURF_PLIFT=0.4，物件再高一点）。 */
    /* 还要**再加砖厚**：地表层的地砖面比地形高 SURF_PLIFT(0.4)，
       只按地形坐的话物件会陷进砖里 0.35 米（实测树根看不见）。 */
    var rr = R + groundHAt(d) * HSC + (M.SURF_PLIFT == null ? 0.4 : M.SURF_PLIFT) + 0.05;
    g.position.set(d[0] * rr, d[1] * rr, d[2] * rr);
    var n = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    g.rotateY((+yawDeg || 0) * Math.PI / 180);
    g.userData.i = i; g.userData.j = j;
    return true;
  }
  function buildPlacements() {
    if (plRoot) { scene.remove(plRoot); disposeTree(plRoot); plRoot = null; }
    var PLc = GAME.place;
    if (!PLc || !PLc.all) return;
    var all = PLc.all(), sc = propScale();
    plRoot = new THREE.Group();
    for (var key in all) {
      var rec = all[key]; if (!rec) continue;
      var it = PLc.item(rec.i); if (!it) continue;
      var g = makeProp(it, null);
      var okSeat = false;
      if (key.indexOf(',') > 0) {
        /* v157.26 新键："i,j" */
        var pr = key.split(',');
        okSeat = seatProp(g, +pr[0], +pr[1], rec.y);
      } else if (_tileCells && _tileCells[+key]) {
        /* 旧档（六边形 ci 键）：按老位置摆，别让玩家的房子凭空消失 */
        var oc = _tileCells[+key];
        var od = oc.dir;
        var orr = R + groundHAt(od) * HSC + (M.SURF_PLIFT == null ? 0.4 : M.SURF_PLIFT) + 0.05;
        g.position.set(od[0] * orr, od[1] * orr, od[2] * orr);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(od[0], od[1], od[2]).normalize());
        g.rotateY((+rec.y || 0) * Math.PI / 180);
        okSeat = true;
      }
      if (!okSeat) { disposeTree(g); continue; }
      g.scale.setScalar(sc * (+rec.s || 1));
      plRoot.add(g);
    }
    scene.add(plRoot);
  }
  M.buildPlacements = buildPlacements;

  /* ============================================================
   * v157.47（P1 · 探索实体化）：遗迹 / 村社 / 营地 在地表上是**实物**
   * ------------------------------------------------------------
   * 病灶：三者在战略视图里是整格涂色 + 点开面板；**贴地时什么都看不见** ——
   * "探索"永远发生在面板列表里，玩家没有"走过去看看"这个动作。
   *
   * 现在：站在地表时，相机附近（SURF_GRID_RANGE 格内）的那几处会立成实物：
   *   遗迹 = 断柱 · 村社 = 草屋 · 营地 = 帐篷。
   * 点它 → 走 `_openCellPanel(ci)`，与战略视图点同一格**同一个出口** ——
   * 不新增面板、不新增存档字段，只补"看得见、点得到"。
   *
   * 为什么不做"走过去自动触发"：这个游戏没有玩家化身，"走"= 左键平移相机，
   * 自动触发会让"平移看地形"变成"一路踩雷"。所以是**看得见 + 点得到**。
   * ============================================================ */
  var lmRoot = null, _lmSig = '', _lmAt = 0;
  var LM_MAX = 24;                    /* 同屏最多 24 个 —— 地表只有 ±44 米，再多也没地方站 */
  function lmSig() {
    var n1 = 0, n2 = 0, n3 = 0;
    /* v158.25：n1（遗迹数）随遗迹系统退役，恒 0 */
    try { n2 = Object.keys((GAME.state && GAME.state.villages) || {}).length; } catch (e2) { }
    try { n3 = Object.keys((GAME.camp && GAME.camp.found) ? GAME.camp.found() : {}).length; } catch (e3) { }
    return (M._surf ? 's' : 'o') + n1 + '/' + n2 + '/' + n3;
  }
  function lmMesh(kind) {
    var g = new THREE.Group();
    /* ⛔ 用 MeshBasicMaterial（无光照），不是 Lambert：这一层地表的其余部分
       （地砖/草/树）都是无光照平色，场景里没有够亮的光源 —— 实测 Lambert
       渲出来是**近黑**的一块，像贴了个洞。平色反而和周围一致。 */
    var mk = function (geo, col, x, y, z) {
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col }));
      m.position.set(x || 0, y || 0, z || 0);
      g.add(m);
      return m;
    };
    /* ⛔ v158.25：'ruin' 造型（断柱+斜梁）随遗迹系统退役。 */
    if (kind === 'village') {
      /* 草屋：圆墙 + 锥顶，和玩家的"木屋"区分开（那道是方屋） */
      mk(new THREE.CylinderGeometry(0.86, 0.96, 0.86, 8), 0x8d6e4b, 0, 0.43, 0);
      mk(new THREE.ConeGeometry(1.12, 0.95, 8), 0xa8845c, 0, 1.13, 0);
    } else {
      /* 营地：帐篷 */
      mk(new THREE.ConeGeometry(0.92, 1.5, 5), 0x7a6a55, 0, 0.75, 0);
    }
    return g;
  }
  function buildLandmarks(force) {
    var sig = lmSig();
    if (!force && sig === _lmSig) return 0;
    _lmSig = sig;
    if (lmRoot) { if (scene) scene.remove(lmRoot); disposeTree(lmRoot); lmRoot = null; }
    if (!scene || !M._surf || !SP || !SP.cells) return 0;
    var cand = [];
    var push = function (ci, kind) {
      ci = +ci;
      if (!(ci >= 0) || !SP.cells[ci]) return;
      cand.push({ ci: ci, kind: kind });
    };
    /* ⛔ v158.25：遗迹地标随遗迹系统退役。 */
    try { var vs = (GAME.state && GAME.state.villages) || {}; for (var k2 in vs) push(k2, 'village'); } catch (e2) { }
    try { var cf = (GAME.camp && GAME.camp.found) ? GAME.camp.found() : {}; for (var k3 in cf) push(k3, 'camp'); } catch (e3) { }
    if (!cand.length) return 0;
    /* 先按"离相机中心多远"排一遍：地表只有 ±44 米，远处那些算了也放不下 */
    var cdir = camO.dir || [0, 1, 0];
    for (var q = 0; q < cand.length; q++) {
      var cd = SP.cells[cand[q].ci].dir || [0, 1, 0];
      cand[q].dot = cd[0] * cdir[0] + cd[1] * cdir[1] + cd[2] * cdir[2];
    }
    cand.sort(function (a, b) { return b.dot - a.dot; });
    var range = (M.SURF_GRID_RANGE == null ? 22 : M.SURF_GRID_RANGE);
    /* ⛔ 不套 `propScale()`：那是给**物品 prefab** 用的（它的部件只有 0.3~0.6 米，
       乘 4.2 倍才到 1.5~2.5 米）。地标几何是按**米**建的（断柱 2.6 米），
       再乘 4.2 就成了 11 米巨物 —— 实测相机直接钻进模型里，画面一片黑。 */
    var grp = new THREE.Group();
    grp.name = 'surfLandmarks';
    var made = 0;
    for (var i = 0; i < cand.length && made < LM_MAX; i++) {
      var c = cand[i], cell = SP.cells[c.ci];
      /* 已经按 dot 降序 → 一旦掉出"脚下这一片"就直接停，不再对后面几百处算投影。
         0.985 ≈ 10° ≈ 52 米（R=300），刚好盖住 ±44 米的地表 patch。
         这条早退是平移时重建的成本闸：没有它，每次跨格都要对全部遗迹/村社算一遍。 */
      if (c.dot < 0.985) break;
      var dd = cell && cell.dir;
      if (!dd) continue;
      var gpos = null;
      try { gpos = M.gridAt([dd[0] * R, dd[1] * R, dd[2] * R]); } catch (e4) { gpos = null; }
      if (!gpos) continue;
      /* gridAt 会给一个格子号，但"在不在这一片地表里"要自己判 —— 不然会把
         地球背面的地标也摆到脚下（v157.26 踩过一次同类：漏减格锚偏移）。 */
      if (Math.abs(gpos.i) > range || Math.abs(gpos.j) > range) continue;
      var mesh = lmMesh(c.kind);
      if (!seatProp(mesh, gpos.i, gpos.j, 0)) { disposeTree(mesh); continue; }
      /* 几何按米建模；1.3 倍是"看清"与"不突兀"之间的折中
         （实测 1.0 在 15 米外只剩一小块灰，和草丛分不开）。 */
      mesh.scale.setScalar(1.3);
      mesh.userData.ci = c.ci;
      mesh.userData.kind = c.kind;
      grp.add(mesh);
      made++;
    }
    lmRoot = grp;
    scene.add(lmRoot);
    return made;
  }
  M.buildLandmarks = function (force) { return buildLandmarks(force !== false); };
  /* v157.48 探针出口：落地抬视线的一次性过渡是否还在跑。
     自检必须先等它为 false 再测"静止漂移"，否则会把过渡当成"自己在动"。 */
  M._tiltActive = function () { return !!_surfTilt; };

  M.landmarkStats = function () {
    return { n: lmRoot ? lmRoot.children.length : 0, sig: _lmSig };
  };
  /* 探针出口（与 `_camObj` 同规格）：给实机自检取地标的世界坐标投影，不参与逻辑。 */
  M._lmObj = function () { return lmRoot; };

  /* 幽灵预览：手上拿着东西时跟着格子走。itemId 为空或 ci<0 → 清掉。
     合法=原色半透明；非法（未探明 / 已占用）= 整件染红，玩家一眼看出放不下。 */
  M.PLACE_YAW = 0;                     /* 手上那件的朝向（度），R 键 / 工具条按钮改 */
  M.ghost = function (itemId, i, j, yaw) {
    M.clearGhost();
    var PLc = GAME.place;
    if (!PLc || !itemId || i == null || j == null) return false;
    var it = PLc.item(itemId); if (!it) return false;
    var chk = PLc.canPlace ? PLc.canPlace(i, j, itemId) : { ok: true };
    var g = makeProp(it, chk.ok ? 'ok' : 'bad');
    if (!seatProp(g, i, j, (yaw == null ? (M.PLACE_YAW || 0) : yaw))) { disposeTree(g); return false; }
    g.scale.setScalar(propScale());
    plGhost = g;
    scene.add(plGhost);
    return true;
  };
  M.clearGhost = function () {
    if (!plGhost) return;
    scene.remove(plGhost); disposeTree(plGhost); plGhost = null;
  };

  /* ============================================================
   * v92.241（老板）：**陨石带** —— 星球外一圈确定性生成的碎屑。
   * ------------------------------------------------------------
   * · 数据全在 `GAME.belt`（js/belt.js）：同 (seed, spec) 必得同一条带，
   *   因此**不进存档** —— 换回来重算即可，不会出现"存档里的带与星球对不上"。
   * · 这里只负责画：一个 InstancedMesh（无 InstancedMesh 时退回单体网格并限量）。
   * · 每块石头按**开普勒第三定律**绕行（外圈更慢），带看着才"活"而不是整圈平移。
   * · 后续「星际采矿」直接读 `GAME.belt.rockOf(id)` / `yieldOf()`，不用改这里。
   * ============================================================ */
  /* ⛔ 本文件第 16 行是 `'use strict'` —— 这里**漏一个 var 就是 ReferenceError**，
     不是"静默变全局"。v92.241 首版漏了 `_beltVer`：tick 每帧读它 → 抛错 → 渲染循环整条死掉
     → 画布只剩 CSS 底色（`--map-ground: #84a050`），老板看到的就是"新开游戏一片青绿色"。
     `node --check` 查不出这种错，只能靠"标识符必须有 var"来守。 */
  var beltRoot = null, _beltIM = null, _beltRocks = null, _beltMs = [], _beltT0 = 0, _beltVer = -1;
  var _beltTmpM = null, _beltTmpQ = null, _beltTmpE = null, _beltTmpP = null, _beltTmpS = null;
  /* v92.246（复核）：这个函数**每帧**被 `M.beltVer()` 调一次。
     原来每次都 `specOf()` 新建一个对象再交给 `BL.current()` 拼 13 段字符串做 key ——
     纯浪费。现在按"原始 belt 参数对象的引用 + 种子"记忆，命中就直接返回上一条带
     （`planet.params.belt` 是稳定对象，引用相等即可靠）。 */
  var _beltMemo = null, _beltMemoRaw, _beltMemoSeed, _beltMemoPl;
  function beltNow() {
    if (!GAME.belt || !GAME.belt.current) return null;
    var pl = GAME.activePlanetOf ? GAME.activePlanetOf() : null;
    var seed = (pl && pl.seed) || (GAME.state && GAME.state.map && GAME.state.map.seed) || 1;
    var raw = (pl && pl.params && pl.params.belt) || null;
    /* 记忆键必须含 `pl` 本身：两颗星球**种子相同**、又都没写 belt 参数时，
       raw 都是 null —— 只比 (raw, seed) 会把 A 的带错发给 B（带的密度还受 impact 影响）。 */
    if (_beltMemo && _beltMemoRaw === raw && _beltMemoSeed === seed && _beltMemoPl === pl) return _beltMemo;
    var spec = GAME.belt.specOf ? GAME.belt.specOf(raw, pl) : null;
    _beltMemo = GAME.belt.current(seed, spec, R);
    _beltMemoRaw = raw; _beltMemoSeed = seed; _beltMemoPl = pl;
    return _beltMemo;
  }
  function buildBelt() {
    if (beltRoot) { scene.remove(beltRoot); disposeTree(beltRoot); beltRoot = null; }
    _beltIM = null; _beltRocks = null; _beltMs = [];
    if (typeof THREE === 'undefined' || !scene) return;
    var b = beltNow();
    if (!b || !b.rocks || !b.rocks.length || !b.spec || !b.spec.enabled) return;
    var rocks = b.rocks;
    beltRoot = new THREE.Group(); beltRoot.renderOrder = 4;
    var geo = new THREE.IcosahedronGeometry(1, 0);
    var mat = new THREE.MeshLambertMaterial({ color: 0x8b8175 });
    _beltT0 = Date.now();
    if (typeof THREE.InstancedMesh === 'function') {
      var im = new THREE.InstancedMesh(geo, mat, rocks.length);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage || 35048);
      /* ⛔ InstancedMesh 的包围球默认取自**基础几何**（半径 1、位于原点），
         不是一个环带 —— 一旦原点出了视锥，整条带会被整体剔除（"转个角度陨石带就没了"）。
         直接关掉剔除：240 个实例本来就不贵，稳定比省这点更值。 */
      im.frustumCulled = false;
      im.userData.belt = true;                 /* 拾取时用它认层 */
      _beltIM = im; _beltRocks = rocks;
      beltRoot.add(im);
      beltUpdate(Date.now());
    } else {
      /* 退回：单体网格。限量 140 块（软件光栅下 draw call 很贵），按尺寸从大到小取。 */
      var pick = rocks.slice().sort(function (a, c) { return c.size - a.size; }).slice(0, 140);
      _beltRocks = pick; _beltMs = [];
      for (var i = 0; i < pick.length; i++) {
        var m = new THREE.Mesh(geo, mat);
        var rr = pick[i];
        m.scale.set(rr.size, rr.size * (0.7 + 0.5 * ((rr.shape % 97) / 97)), rr.size * (0.7 + 0.5 * ((rr.shape % 61) / 61)));
        _beltMs.push(m); beltRoot.add(m);
      }
      beltUpdate(Date.now());
    }
    scene.add(beltRoot);
  }
  M.buildBelt = buildBelt;
  var _bp = [0, 0, 0];
  function beltUpdate(nowMs) {
    if (!_beltRocks) return;
    var t = (nowMs - _beltT0) / 1000;
    if (_beltIM) {
      /* 矩阵/四元数/向量全部**复用**（240 块 × 60fps 若每帧新建 ≈ 1.4 万次分配，
         在软件光栅机上会明显拖帧）。 */
      var mt = _beltTmpM || (_beltTmpM = new THREE.Matrix4());
      var q = _beltTmpQ || (_beltTmpQ = new THREE.Quaternion());
      var e = _beltTmpE || (_beltTmpE = new THREE.Euler());
      var vP = _beltTmpP || (_beltTmpP = new THREE.Vector3());
      var vS = _beltTmpS || (_beltTmpS = new THREE.Vector3());
      for (var i = 0; i < _beltRocks.length; i++) {
        var r = _beltRocks[i];
        GAME.belt.posOf(r, t, _bp);
        e.set(r.shape * 0.001, r.spin * t * 0.35, r.shape * 0.0007);
        q.setFromEuler(e);
        vP.set(_bp[0], _bp[1], _bp[2]);
        vS.set(r.size, r.size * (0.7 + 0.5 * ((r.shape % 97) / 97)), r.size * (0.7 + 0.5 * ((r.shape % 61) / 61)));
        mt.compose(vP, q, vS);
        _beltIM.setMatrixAt(i, mt);
      }
      _beltIM.instanceMatrix.needsUpdate = true;
    } else {
      for (var j = 0; j < _beltMs.length; j++) {
        var r2 = _beltRocks[j];
        GAME.belt.posOf(r2, t, _bp);
        _beltMs[j].position.set(_bp[0], _bp[1], _bp[2]);
      }
    }
  }
  M.beltUpdate = beltUpdate;
  /* 版本：参数/种子变了才重建（不是每帧）*/
  M.beltVer = function () {
    var b = beltNow();
    return b ? b.ver : 0;
  };

  /* 每帧：只把变了的人挪一下（不重建） */
  function syncFigures() {
    /* 骨骼角色每帧推进需要 dt（秒） */
    var _now = Date.now();
    var fdt = Math.min(0.05, (_now - figLastT) / 1000) || 0.016; figLastT = _now;
    /* 第一次调用时 figRoot 还不存在 —— 先建出来 */
    if (!figRoot) {
      /* ⛔ v157.85：前传首帧把君主人偶摆到 pos 的分支已删。 */
      buildFigures();
      return;
    }
    /* ⛔ v157.85：原「① 正在走的那一个：沿地表弧线插值」整段删除（前传退役）。 */
    /* ② 谁该站在哪 —— 版本变化才重建（换格只挪）
       v158.22：格锚走 `M.playerCi()` 唯一出口（它会触发开局位姿迁移）；
       直读 `state._standCi` 会让"开局从无到有"这一步不触发重建。 */
    var ver = (M.playerCi() >= 0 ? M.playerCi() : '')
      + '|' + (GAME.currentCity && GAME.currentCity() ? (GAME.currentCity().ci || '') : '')
      + '|' + ((_tileCells || []).length);
    if (ver !== M._standVer) {
      M._standVer = ver;
      /* ⛔ v157.85：君主人偶的"换格就补走路动画"已删（前传退役）。 */
      buildFigures();
      return;
    }
    /* ③ 站着时轻微呼吸/摆手（只在有人时做，开销可忽略） */
    var t = (Date.now() % 2000) / 2000;
    Object.keys(figCache).forEach(function (k) {
      var f = figCache[k], g = f.g;
      if (!g || !g.userData) return;
      if (g.userData.actor && g.userData.actor.root) {
        g.userData.actor.skill('idle');
        g.userData.actor.update(fdt);
        return;                              /* 骨骼角色自带动画，不做方块人呼吸缩放 */
      }
      if (!g.userData.legs) return;
      var br = Math.sin(t * Math.PI * 2) * 0.05;
      g.scale.y = (g.userData.baseScale || g.scale.y) * (1 + br * 0.1);
    });
  }
  /* ⛔ v157.85：`M.buildLordWalking(fromCi, toCi)` 整条删除 —— 它是前传君主
     「先摆上一格再走过来」的唯一建法，前传退役后无调用者。 */
  M.buildFigures = buildFigures;
  M.syncFigures = syncFigures;
  /* v153：给脚本/测试看小人此刻的真实世界坐标与所在格（只读出口） */
  M.figureOf = function (key) {
    var f = figCache[key || 'lord'];
    if (!f || !f.g) return null;
    /* v158.19（老板「走的好像老年痴呆一样」）：`walking` 不再恒 false ——
       球面小人的摆腿相位由 followAvatar 逐帧推进，这里如实反映"这一刻在不在走"
       （探针 / 调试要能读到；前传的行走插值仍不恢复）。 */
    return { ci: f.ci, pos: [f.g.position.x, f.g.position.y, f.g.position.z], walking: !!M._figMoving };
  };

  /* 点击拾取：Raycaster 打到地块填充 → 取格类型/等级 → 存为选中（画在画布上）*/
  M.pickAt = function (canvas, clientX, clientY) {
    M.clearBeam();   /* v90.71（老板 7）：点选其他地块 = 其他操作 → 定位指示线消失 */
    if (!M._collider) return;
    var r = canvas.getBoundingClientRect();
    if (!r.width) return;
    var nx = ((clientX - r.left) / r.width) * 2 - 1, ny = -((clientY - r.top) / r.height) * 2 + 1;
    var rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(nx, ny), cam);
    /* v91.30：先判**奇观天体**（点击开奇观菜单）——比地块优先。 */
    if (M._wonderBody) {
      var wh = rc.intersectObject(M._wonderBody, true);
      if (wh && wh.length && GAME.ui && GAME.ui.openWonder) { GAME.ui.openWonder(_wonderPid()); return; }
    }
    /* ============================================================
     * v92.245（老板：「星空中物体应有体积，并可点击」）
     * ------------------------------------------------------------
     * 陨石带的石块现在有真实体积（2.2~13 世界单位），并且**可点**：
     * 命中 InstancedMesh 后 `instanceId` 就是 `_beltRocks` 的下标 ——
     * 直接开一张"这块石头"的卡（储量/轨道/尺寸），也是后续**星际采矿**的入口。
     * 放在地块之前：石头在星球外侧，点它不该被误判成点地面。
     * ============================================================ */
    if (_beltIM && _beltRocks && _beltRocks.length) {
      var bh = rc.intersectObject(_beltIM, false);
      if (bh && bh.length) {
        var _bidx = bh[0].instanceId;
        var _brock = (_bidx != null && _beltRocks[_bidx]) ? _beltRocks[_bidx] : null;
        if (_brock && GAME.ui && GAME.ui.openBeltRock) { GAME.ui.openBeltRock(_brock); return; }
      }
    }
    /* v157.47（P1）：地表地标是**实物** —— 先判它。
       命中就开"那一格"的原面板（与战略视图点同一格是同一个出口），然后 return，
       免得继续落到地块分支把它当成"点了块野地"。 */
    if (lmRoot && lmRoot.children.length) {
      var _lh = rc.intersectObject(lmRoot, true);
      if (_lh && _lh.length) {
        var _lo = _lh[0].object;
        var _lci = null;
        if (_lo && _lo.userData && _lo.userData.ci != null) _lci = _lo.userData.ci;
        else if (_lo && _lo.parent && _lo.parent.userData && _lo.parent.userData.ci != null) _lci = _lo.parent.userData.ci;
        if (_lci != null) {
          M._cell = _lci;
          try { _openAndWalk(_lci); } catch (eL1) { }
          return;
        }
      }
    }
    /* ============================================================
     * v157.99：**人物与放置物**先判（老板「为什么人物不可选中，地图上的 3D 资产不可选中」）
     * ------------------------------------------------------------
     * 病根：`pickAt` 的射线只打「奇观 → 陨石 → 地标 → 碰撞球」，
     *   小人和放置物**根本不在射线集合里** —— 射线一穿而过，落在它们脚下的格子上，
     *   于是"点了小人却选中了地"，看起来就是"不可选"。
     * 修法：它们站在地面上，就该比地面**优先被命中**。
     * ============================================================ */
    if (figRoot && figRoot.children.length) {
      var _fh = rc.intersectObject(figRoot, true);
      if (_fh && _fh.length) {
        var _fci = null;
        for (var _pp = _fh[0].object; _pp; _pp = _pp.parent) {
          if (_pp.userData && _pp.userData.ci != null) { _fci = _pp.userData.ci; break; }
        }
        if (_fci != null) {
          M._lastPickKind = 'figure';
          M._cell = _fci;
          try { _openAndWalk(_fci); } catch (eF1) { }
          if (GAME.ui && GAME.ui.toast) GAME.ui.toast('👤 选中了人物（所在格已打开）');
          return;
        }
      }
    }
    if (plRoot && plRoot.children.length) {
      var _plh = rc.intersectObject(plRoot, true);
      if (_plh && _plh.length) {
        M._lastPickKind = 'prop';
        var _pci = pickCiByRay(rc, _plh[0].point);
        if (_pci >= 0) {
          M._cell = _pci;
          try { _openAndWalk(_pci); } catch (eP1) { }
          if (GAME.ui && GAME.ui.toast) GAME.ui.toast('🧱 选中了放置物（所在格已打开）');
          return;
        }
      }
    }
    M._lastPickKind = 'cell';
    var hit = rc.intersectObject(M._collider, false);
    /* v157w：地表模式不能拿"命中 _collider"当前置条件 —— 贴地平视时射线
       从球面掠过、根本不相交（见 hover 处注释）。真正的地面是地砖。 */
    if (!hit.length && !M._surf) { M._cell = null; if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); return; }
    /* v155h → v157d：点击也走统一出口（地表模式 raycast 地砖，所见即所得） */
    var _hp = hit.length ? hit[0].point : null;
    /* v157v：建造模式点一下 = 选中四边形格（不碰 ci），交给建造流程 */
    if (M.mode === M.MODE_BUILD) {
      var _gpB = M.pickGroundPoint(rc);
      var _gcB = M.gridCellAt(_gpB);
      /* ============================================================
       * v157.21（老板「放置很不稳定」）—— **手上拿着东西时，点击 = 落位**
       * ------------------------------------------------------------
       * 这一段在改造前会直接 `return`（只做"选格"），于是建造模式下拿着物品
       * 点地图**什么都不会发生**：幽灵跟着鼠标走，点下去却没有任何反应。
       * 实测 e2e：连点两次，`GAME.place.count()` 始终是 0。
       *
       * 顺序必须是「整平工具 → 放置 → 选格」：
       *   铲子/物品都是"手持态"，谁在手谁优先；都没拿才是选格看信息。
       * ============================================================ */
      /* v158.43（老板「进入建造模式时，左键点击出现勘探选项」）：
         建造模式下点资源地 —— 未勘探先自动勘探（给丰度/储量），已勘探则建对应采集场。
         「勘探 → 建造」两步在一个点击动作里打通，不再要求先开地块面板。
         手持指定建筑（_plantId）时建那一座；否则按资源类型自动匹配（quickBuildPlant）。 */
      if (GAME.ui && GAME.ui._plantTool) {
        var _ciPlant = -1;
        try { _ciPlant = pickCiByRay(rc, _hp); } catch (ePL0) { _ciPlant = -1; }
        var _pr = null;
        /* 未勘探的资源地 → 先勘探（勘探是建造的前置，一步到位） */
        var _RSs = GAME.resource;
        var _rview = (_RSs && _RSs.view && _ciPlant >= 0) ? _RSs.view(_ciPlant) : null;
        if (_rview && _rview.res && !_rview.scanned) {
          var _rrec = _RSs.scan(_ciPlant);
          if (_rrec) {
            var _rtier = _RSs.richTier ? _RSs.richTier(_rrec.richness) : null;
            if (GAME.ui.toast) GAME.ui.toast('🔍 勘探完成：' + (_RSs.resName ? _RSs.resName(_rrec.res) : _rrec.res)
              + ' · ' + (_rtier ? _rtier.name : '') + ' ×' + (_rrec.richness || 0).toFixed(2)
              + ' · 储量 ' + (GAME.utils && GAME.utils.numText ? GAME.utils.numText(_rrec.reserve || 0, 0) : Math.round(_rrec.reserve || 0)));
          }
        }
        var _plantIdNow = GAME.ui._plantId || '';
        if (_plantIdNow && GAME.buildPlant) {
          _pr = GAME.buildPlant(_ciPlant, _plantIdNow);
        } else {
          _pr = GAME.quickBuildPlant
            ? GAME.quickBuildPlant(_ciPlant)
            : { ok: false, msg: '当前版本没有采集场快速建造' };
        }
        if (GAME.ui.toast) GAME.ui.toast(_pr.ok ? _pr.msg : ('⚠ ' + _pr.msg));
        if (GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
        return;
      }
      if (GAME.place && GAME.ui && GAME.ui._placeItem) {
        /* v158.39：幽灵、点击、拖铺共用 placeAtPoint 唯一出口；
           旧版这里内联 place.add，拖铺又写第二份，极易一边改一边漏。 */
        var _rP = M.placeAtPoint(_gpB, { silent: false });
        if (GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
        return;
      }
      /* v157.15：手上是整平工具 → 这一下是"刷地"，不是"选格" */
      if (M.TOOL === M.TOOL_TERRACE) {
        var _tp = M._terraceErase ? M.terraceClearAt(_gpB) : M.terracePaintAt(_gpB);
        if (_tp && _tp.rejected === 'water' && GAME.ui && GAME.ui.toast && !M._terraceDrag) {
          GAME.ui.toast('🌊 这里是水面 —— 整平只对陆地生效（填海是另一套工具）');
        } else if (_tp && _tp.rejected === 'steep' && GAME.ui && GAME.ui.toast && !M._terraceDrag) {
          GAME.ui.toast('⛰ 这一格落差 ' + _tp.drop + ' 米，太陡 —— 先把周围削缓');
        } else if (_tp && GAME.ui && GAME.ui.toast && !M._terraceDrag) {
          GAME.ui.toast(M._terraceErase ? ('已复原 1 格（剩 ' + GAME.terrain.count() + ' 格整平）')
            : ('整平 → 第 ' + _tp.level + ' 层（' + (_tp.level * (GAME.TERRACE_H || 1)) + ' 米）'));
        }
        if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
        return;
      }
      if (_gcB) {
        M.gridHighlight(_gcB.i, _gcB.j, true);
        M._selCell = _gcB;
        if (GAME.ui && GAME.ui.toast) GAME.ui.toast('建造格 (' + _gcB.i + ', ' + _gcB.j + ')');
      }
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      return;
    }
    var ci = pickCiByRay(rc, _hp);
    /* ============================================================
     * v157s（老板：「点击小旗子发现未占领，可见对应性有问题」）
     * ------------------------------------------------------------
     * 旗子是抬升 1.5 米的 sprite，而这里只跟**地面**求交 ——
     * 点旗子等于点它**背后**那格（视线穿过旗子继续打到地上），
     * 于是"旗子在这格、点击选中隔壁格"，查询自然说未占领。
     *
     * 现在先跟旗子求交：命中就用 sprite 自带的 ci 覆盖地面解算结果。
     * 旗子小、地面大，只在"真的点在旗子上"时才覆盖，不会误抢。
     * ============================================================ */
    if (M._flags) {
      var _fh = rc.intersectObject(M._flags, true);
      if (_fh && _fh.length) {
        var _fo = _fh[0].object;
        var _fci = (_fo && _fo.userData && _fo.userData.ci != null) ? _fo.userData.ci : -1;
        if (_fci >= 0) { ci = _fci; M._lastFlagHit = _fci; }
      }
    }
    if (ci < 0) return;
    var cell = M._collider.cells[ci];
    if (!cell) return;
    /* ============================================================
     * v151（老板：「点地图地块来行动」「生成了一整颗星球却只被卡片读」）
     * ------------------------------------------------------------
     * 前传里的地图点击**只做一件事：走路 / 就地动手**（`P.mapClick`）。
     * 改前这里会按格类型弹出"未占领野地面板"、据点情报、营地 ——
     * 前传没有城没有兵，那些面板一个都用不上，等于点了没反应。
     * 放在迷雾判定**之前**：雾里的格子也要能点（`P.pathTo` 会算到已探明的边上），
     * 否则新人点远处只会得到一句"未探明"，而不知道该怎么过去。
     * ============================================================ */
    /* ⛔ v157.85：前传「点格子 = 让它算能不能走过去」分支已删（前传退役）。 */
    /* ============================================================
     * v92.240k：放置模式 —— 手上拿着东西时，点格 = 落位（不走地块原逻辑）。
     * ------------------------------------------------------------
     * 放在迷雾判定**之前**：`canPlace` 自己会拒未探明格，理由也比
     * "那边还没探明"更贴题（"这片地还没探明，放不了"）。
     * 放完**不自动收工** —— 连着建第二件是常态（MC 手感），
     * 想退出点 UI 上的"收工"，或再点一次"建造"面板里的同一件。
     * ============================================================ */
    if (GAME.place && GAME.ui && GAME.ui._placeItem) {
      var _pid = GAME.ui._placeItem, _ui2 = GAME.ui;
      var _cOld = (SP.cells && SP.cells[ci]) || null;
      var _gOld = (_cOld && _cOld.dir) ? M.gridAt(_cOld.dir) : null;
      var _res = _gOld ? GAME.place.add(_gOld.i, _gOld.j, _pid) : { ok: false, msg: '这儿不是一格地。' };
      if (_ui2.toast) {
        var _itm = GAME.place.item(_pid);
        _ui2.toast(_res.ok ? ('🧱 已放下：' + (_itm ? _itm.name : _pid)) : ('⚠ ' + _res.msg));
      }
      M._ghostCi = -1; M._ghostIJ = null; M.clearGhost();
      if (_ui2.renderMapCanvas) _ui2.renderMapCanvas();
      return;
    }
    /* ============================================================
     * v158.20（老板「去掉人物模式 · 只提示人物位置 · 让人物真实走动起来」）
     * ------------------------------------------------------------
     * **点哪就走哪 —— 包括未探明的格子**：走过去本身就是探路
     * （v151 的老玩法就是"点地图 = 走路"，v157.85 前传退役时一并删了）。
     * 所以 walkTo 必须在迷雾判定**之前**：否则点一块没探明的地只会弹
     * "派一队过去"，小人一步不动 —— 玩家体感就是"点了没用"。
     * 放置模式（上一段已 return）不走路：那是施工，不是赶路。
     * ============================================================ */
    /* v158.30（老板「左键一点就弹地块信息，那这还能走吗」）：
       **只有野地才走**。城/据点/营地/村社点一下是"我要看它"，把人拽过去
       既没用又打断（走过去还要等）。野地的语义才是"走过去"。 */
    var _kindEarly = (M.cellKind && M.cellKind[ci]) || 'wild';
    /* v158.43（老板「常规情况下左键点击地面无需响应」）：
       只有**地表态**（站在地面上）点野地才走路（诉求 1 地面「左键单击=人物移动」）；
       战略态（高空俯瞰）点普通野地**无响应** —— 不再"边点边弹/点哪走哪"。 */
    if (_kindEarly === 'wild' && M._surf) { try { M.walkTo(ci); } catch (eWk2) { } }
    /* v92：**未探明的格子点不进去** —— 这是迷雾真正的玩法后果。
       不做成"点开发现是空的"：那只是把信息藏一层，玩家照样能靠点击扫图。
       整片未探明 = 地图上没有这一带，得先派人过去（这里连地形都不给看）。 */
    /* ⛔ v158.43（老板「不要再弹出这个了『未探明地块』」）规则变更：
       雾格点击**不再弹任何面板**（v158.38 的一级详情面板 openFogModalCi 整条退役）。
       按诉求 2 已拍板口径「常规情况下左键点击地面无需响应」—— 未探明格也是地面，
       点击静默；勘探入口在建造模式（点左键自动勘探，v158.43 诉求 3 已打通）。
       _cell/_cellKind 仍记录（探针可观测），不弹窗、不 toast。 */
    if (fogHides(ci)) {
      M._cell = cell; M._cellKind = 'unknown';
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      return;
    }
    M._cell = cell;
    var kind = (M.cellKind && M.cellKind[ci]) || 'wild';   /* 地块属性：野地/城市/据点/行政城/己方城 */
    M._cellKind = kind;
    var reg = M.regionAt(ci);                                  /* 该地块的省/市/区归属 */
    /* v157.72（老板 2026-11-16「地块统一一层菜单，不要加地块操作这一层」）：
       点地块**直达** `openCellPanel`（按 kind 分发到城市 / 攻打 / 据点 / 野地面板）。
       v157.57 的「🗺 地块操作」中间菜单整条退役 —— 详情面板里本来就有
       侦查 / 掠夺 / 占领 / 经营 / 派遣 / 一键出征，那一层只多一次点击。
       smoke §580② 已翻转为反向守卫：点击不许再经任何中间菜单。 */
    /* v158.20：走路已在迷雾判定之前统一接上（点哪走哪，含未探明）。
       这里只负责开面板 —— 走过去与看信息互不等待。用公开出口 M.openCellPanel
       （与 _openCellPanel 同一函数，§580②/§589af 钉的就是这个出口不被中转）。 */
    /* ============================================================
     * v158.30（老板「左键一点就弹出来地块的信息，那这还能走吗？键位全他妈是冲突的」）
     * ------------------------------------------------------------
     * 病根：点**任何**格子都会 `openCellPanel` —— 一块大面板盖住地图中央，
     *   想接着点/走都得先关它。左键于是同时是"走"和"弹窗"，键位自己打自己。
     *
     * 现在把两件事分开：
     *   · **野地**：点 = 只走过去（一步不弹），到了按 **E** 才打开这一格；
     *   · **有实体的**（己方城/名城/行政城/据点/营地/村社）：点 = 打开它（那是选择目标，
     *     本来就不该移动小人，上面 walkTo 也已按 kind 拦掉）。
     * 这样"左键走路 / E 查看"各归各位，不再互相覆盖。
     * ============================================================ */
    /* v158.43（老板「常规情况左键点击地面无需响应」）：
       物件（城/据点/营地/村社）点一下仍是"选择目标"→ 弹它自己的面板；
       野地在战略态**无响应**（不弹、不 toast），地表态已在上方 walkTo 走过去。 */
    if (kind !== 'wild') M.openCellPanel(ci);
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  };
  M.centerOn = function (x, y) {                            /* 相机对准某格（回主城/回本城/灰烬城）· 不高亮 */
    /* v92.241b：centerOn 是"绕球心看某格" —— 必须先把前传留下的贴地焦点清掉，
       否则 dist 是相对**旧那一格**算的，支点还是黏在人物身上。 */
    M._focus = null; M._pendingFocus = null; M.camFree = true;
    var c = GAME.map.lonlatOf(x, y), d = GAME.map.dirOf(c.lon, c.lat);
    camO.yaw = Math.atan2(d[0], d[2]);
    camO.pitch = Math.max(-1.35, Math.min(1.35, c.lat * Math.PI / 180));
    /* v158.16（玩家视角走查）：轨迹球模式下 **quat 才是真值** —— placeCamera 的
       `_dirty` 判据是 `M.CAM_TRACKBALL ? !camO.quat : …`，只要 quat 有值就不会
       按 yaw/pitch 重建。所以这里只改 yaw/pitch 等于没改朝向，实际效果是
       「回本城」把镜头拉近（dist 生效）却不转向，城反被推出画面
       （实测城格 NDC y: 0.66 → 1.05，出视野）。
       必须显式清掉姿态缓存，让下一帧按新 yaw/pitch 重建。
       ⚠️ 别改成"直接写 quat"：setFromEuler(-pitch, yaw, roll, 'YXZ') 与
          placeCamera 同一套约定，重建即为唯一出口，避免两处算出不同 roll。 */
    camO.quat = null; camO._euler = null; camO.dir = null;
    /* v158.42：回城也走平滑跳转，高度连续（原直接 camO.dist = R*1.9 会瞬间跳变）。 */
    _zoomTo(R * 1.9);
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  };
  /* ============================================================
   * v158.17（老板「参考现有成熟设计完善」③）· **把人也搬过去**
   * ------------------------------------------------------------
   * 病根：底栏「回主城 / 回本城 / 灰烬城」三个按钮从 v50 起只调 `ui.mapCenterOn`
   * → 只转镜头。P0 之前"相机=玩家视角"，移相机等于移玩家；有了独立位姿之后
   * 这条链路断了：镜头到了城，人还在野地（v158.16 实测 playerCi 仍是被传送前那格，
   * 城格 NDC y = −1.5 直接被推出画面 —— 因为下一帧 followAvatar 又把
   * `camO.dir` 改回**人的朝向**，镜头自然跟着人走）。
   *
   * 所以导航必须同时写两样：镜头（mapCenterOn 里已做）+ 位姿（这里）。
   * 位姿走 P0 唯一出口 `setPlayerPose`，不新开第三个写入口。
   *   · 给了 ci 就用格锚（teleportTo 同一口径，避免最近格取整差一格）；
   *   · 没给 ci（如灰烬城这种只有格坐标的）就让 setPlayerPose 自己反算。
   * 街区态：先撤街区、并**清掉快照**，否则 240ms 后那次"还原 P0 位姿"
   * 会把刚传过去的人拽回原处（这就是同一个 bug 的另一条路径）。
   * ============================================================ */
  M.gotoXY = function (x, y, ci) {
    if (!GAME.map || !GAME.state) return false;
    var D = GAME.district;
    ci = (ci == null || ci === '') ? null : (ci | 0);
    /* 已经在目标城的街区里 → 什么都不用做（"回家"不该把人从街上踢回城门）。
       ⚠️ 必须同时核对**人真的在这格**：街区态与位姿有可能脱节（teleportTo 以前
       不撤街区就会造出这种态），只看 D.ci 会把「回本城」挡成空操作。 */
    if (D && D.active && ci != null && D.ci === ci && M.playerCi() === ci) return true;
    if (D && D.active && D.exit) {
      D.snapshot = null;            /* 不还原旧位姿：人要跟着这次导航走 */
      D.exit();
      if (GAME.ui && GAME.ui.renderDistrictHud) GAME.ui.renderDistrictHud(false);
    }
    var c = GAME.map.lonlatOf(x, y), d = GAME.map.dirOf(c.lon, c.lat);
    if (!d || !isFinite(d[0])) return false;
    var p = { dir: [d[0], d[1], d[2]], h: M._groundAtUnit(d), yaw: 0, v: [0, 0, 0] };
    if (ci != null) p.ci = ci;
    M.setPlayerPose(p);
    M._standVer = '';               /* 强制下一帧把小人物重建到新格（换格只挪不重建会留在旧格） */
    return true;
  };
  /* v90.68（老板）：**定位光束** —— 从某格**向外射出一道**提示玩家 + 相机对准该格。
     v90.71（老板 7）：远端加**红光持续闪烁**的发光点（醒目好找）；做其他操作后指示线消失。
     换目标先清旧束；传 null 清除。 */
  function glowSprite() {
    var N = 128, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    gr.addColorStop(0, 'rgba(255,120,100,1)'); gr.addColorStop(0.32, 'rgba(255,52,40,.85)');
    gr.addColorStop(0.66, 'rgba(210,30,20,.32)'); gr.addColorStop(1, 'rgba(190,16,10,0)');
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
    var tx = new THREE.CanvasTexture(cv); tx.needsUpdate = true;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    spr.userData.glow = true;
    return spr;
  }
  M.clearBeam = function () {
    if (M._beam) { scene.remove(M._beam); if (M._beam.geometry) M._beam.geometry.dispose(); M._beam = null; }
    if (M._beamPos) { scene.remove(M._beamPos); if (M._beamPos.material) M._beamPos.material.dispose(); M._beamPos = null; }
  };
  M.beamTo = function (x, y) {
    M.clearBeam();
    if (x == null || y == null) { if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); return; }
    try {
      var c = GAME.map.lonlatOf(x, y), d = GAME.map.dirOf(c.lon, c.lat);
      var r = R + groundHAt(d) * HSC;
      var g0 = [d[0] * r, d[1] * r, d[2] * r];
      var g1 = [d[0] * (r + 160), d[1] * (r + 160), d[2] * (r + 160)];   /* 向外射出一道 */
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([g0[0], g0[1], g0[2], g1[0], g1[1], g1[2]], 3));
      M._beam = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff5236, transparent: true, opacity: 0.97, depthWrite: false }));
      scene.add(M._beam);
      M._beamPos = glowSprite();                     /* 远端发光点（红光闪烁，见 render 每帧脉动）*/
      M._beamPos.position.set(g1[0], g1[1], g1[2]);
      scene.add(M._beamPos);
    } catch (e) { /* 忽略 */ }
    M.centerOn(x, y);
  };
  /* ============================================================
   * v91.30 奇观天体（绕星球轨道 · 出场/离场动画 · 点击开奇观菜单）
   * ------------------------------------------------------------
   * 今日奇观按**当前地图星球**取（GAME.wonderOf(mapPlanetId)）。.glb 经 gltf.js 极简解析，
   * 几何缓存于 M._wonderGeo[id]（一次解析多次用）。载入失败/无 THREE → 静默缺席（不阻塞地图）。
   * ⚠️ .glb 走 fetch：http 服务下正常；纯 file:// 双击可能被浏览器拦（届时天体缺席，地图不受影响）。
   * ============================================================ */
  M._wonderGeo = M._wonderGeo || {};
  /* base64 → ArrayBuffer（GLB 字节）。 */
  function _wonderB64Buf(b64) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function _wonderPid() {
    var s = GAME.state || {};
    return (s.mapPlanetId != null) ? s.mapPlanetId : (s.activePlanet || 1);
  }
  function buildWonder() {
    var pid = _wonderPid();
    var wd = GAME.wonderOf ? GAME.wonderOf(pid) : null;
    if (!wd) { if (M._wonderGrp) { scene.remove(M._wonderGrp); M._wonderGrp = null; M._wonderBody = null; M._wonderId = null; } return; }
    if (M._wonderId === wd.id && M._wonderGrp) return;             /* 幂等：同星球同奇观不重建 */
    if (M._wonderGrp) { scene.remove(M._wonderGrp); M._wonderGrp = null; M._wonderBody = null; }
    M._wonderId = wd.id;
    var grp = new THREE.Group();
    M._wonderGrp = grp; M._wonderAngle = 0.6; M._wonderT0 = (GAME.utils && GAME.utils.now ? GAME.utils.now() : Date.now());
    scene.add(grp);
    /* 天体网格：几何缓存/异步载入 */
    function place(geo) {
      if (M._wonderId !== wd.id) return;
      var mode = wd.place || 'space';
      M._wonderMode = mode;
      var mesh = new THREE.Mesh(geo, geo._mat);
      var body = new THREE.Group(); body.add(mesh);
      M._wonderSpin = mesh;                                       /* v91.34：自旋目标 = 几何体本身（绕自身竖轴） */
      if (wd.planetRing) {
        /* v91.44（老板）：「星环套在球体上了，不该与地表接触，建议离地心 2.5 个半径；
           并且星环应在三维空间中相对不动，看着中间球体转动」——
           · **尺寸**：外径 = 2.5R（远在球外，绝不接触地表）。
           · **姿态**：环模型在 Y-Z 平面（轴沿 X）→ 绕 Z 转 90° 后落在 **X-Z 赤道面**，
             且**不另加倾角** —— 水平环对 Y 轴**旋转对称**，相机绕 Y 自转（= 自动"星球自转"）
             时环的**轮廓保持不动**，只有中间球面的地形在转 → 正是"环静、球转"的观感。
           · 位置恒在**球心**；世界坐标不旋转（静态）。 */
        var _r0 = 0.5;
        try {
          geo.computeBoundingBox(); var _bb = geo.boundingBox;
          _r0 = Math.max(Math.abs(_bb.max.y), Math.abs(_bb.min.y), Math.abs(_bb.max.z), Math.abs(_bb.min.z)) || 0.5;
        } catch (e) { }
        mesh.scale.setScalar((R * 2.5 / _r0) * (2 / 3));   /* v154：尺度 ×2/3 */
        body.rotation.z = Math.PI / 2;          /* 放平到赤道面（不倾） */
        M._planetRing = true; M._wonderUp = [0, 1, 0]; M._wonderR = 0;
      } else if (mode === 'space') {
        M._planetRing = false;
        mesh.scale.setScalar(R * 0.64 * (2 / 3));   /* v154：整体 ×2/3（原 R*0.64）*/
      } else {
        M._planetRing = false;
        /* 地表/海面：落在星球某格上 —— 贴地(海拔) + 按法线立起 + 按包围盒**底面**坐地。
           v91.38：模型**已由解析器应用节点旋转**（gltf.js 读 nodes[].rotation）→ 标准 **Y-up**，
           故把 **+Y** 对齐球面法线 d（老板「角度颠倒」的根因是解析器漏读节点旋转，非本处对齐）。 */
        var sc = _wonderSurfaceCell(mode, wd.id);
        var d = (sc && sc.dir) ? sc.dir : [0, 1, 0];
        /* ============================================================
         * v154（老板：「奇观尺度缩小为原三分之二，长宽高都是；
         *   神殿类有底座的，底部平面应当与指向圆心的线垂直（地面得平坦），底座可以陷入地面」）
         * ------------------------------------------------------------
         * 尺度：原来按星球半径给（R*0.30 与真实模型尺寸无关 → 有的巨大有的极小）。
         *   现在按**模型自身包围盒**缩到"格宽的 1.6 倍"，再乘老板要的 2/3。
         * 朝向：模型 +Y 对齐该格法线（底座平面 ⟂ 指向圆心的半径）——已成立；
         *   另外**把底座压进地里 8%**（margin 为负），像真的埋进土里。
         * ============================================================ */
        var _cellW = Math.sqrt(4 * Math.PI * R * R / Math.max(1, SP.nv || 40962));
        var _bb0 = null;
        try { geo.computeBoundingBox(); _bb0 = geo.boundingBox; } catch (e0) { }
        var _maxDim = 1;
        if (_bb0) _maxDim = Math.max(_bb0.max.x - _bb0.min.x, _bb0.max.y - _bb0.min.y, _bb0.max.z - _bb0.min.z) || 1;
        /* v156.48（老板「奇观太小了，适当增大，长度大概 3 个地块是合适的」）——
         * 尺寸口径改成**直接按地块数**：最大边 = 格宽 × 3。
         * 旧值是 3.2 × 2/3 = 2.13 格宽（v154 那次「缩小为原 2/3」留下的），
         * 沿革：R*0.30（按半径，尺寸失控）→ v154 按包围盒 → 2.13 格宽 → 现在 3.0 格宽。
         * 用包围盒最长边对齐格宽，所以「长度 3 个地块」对高瘦/矮胖模型都成立。
         * 每个奇观自己的 scaleMul 仍乘在最后，保留个体差异。 */
        var S = (_cellW * 3.0 / _maxDim) * (wd.scaleMul || 1);
        mesh.scale.setScalar(S);
        var tg = new THREE.Group(); tg.add(mesh);
        /* v156.19：奇观同样走 surfaceQuat（基座平面 ⟂ 指向圆心的半径）。
           正面（模型 +Z）默认朝南；奇观不额外自转，保持"四方端正"。 */
        applyQuad(tg.quaternion, d, 0);
        body.add(tg);
        /* 落点：按包围盒 8 角沿法线的最小投影 `low`（< 0 = 有部分在原点之下）反推 ——
           rr = surfR − low + margin → **最低点坐在地表上**。海面给负 margin（半潜入水）。 */
        var surfR = R + Math.max(0, sphElev(d)) * HSC;
        if (mode === 'water') surfR = R + 2.0;                   /* 浮在水面 */
        var low = 0;
        try {
          geo.computeBoundingBox();
          var bb = geo.boundingBox, cs = [];
          for (var xi = 0; xi < 2; xi++) for (var yi = 0; yi < 2; yi++) for (var zi = 0; zi < 2; zi++)
            cs.push(new THREE.Vector3((xi ? bb.max.x : bb.min.x) * S, (yi ? bb.max.y : bb.min.y) * S, (zi ? bb.max.z : bb.min.z) * S).applyQuaternion(tg.quaternion));
          for (var ci = 0; ci < cs.length; ci++) { var dt2 = cs[ci].x * d[0] + cs[ci].y * d[1] + cs[ci].z * d[2]; if (dt2 < low) low = dt2; }
        } catch (e) { }
        /* 陆地：底座**压进地里**（-8% 高度），读起来像"长在地上"；海面：半潜 */
        var _hBelow = 0;
        try { _hBelow = Math.max(0, (_bb0 ? (_bb0.max.y - _bb0.min.y) : 1) * S * 0.08); } catch (e1) { }
        var margin = (mode === 'water') ? -R * 0.015 : -_hBelow;
        var rr = surfR - low + margin;
        M._wonderUp = d; M._wonderR = rr;
      }
      /* 名称标签（浮在主体上方）。 */
      var lbl = null;
      try {
        lbl = nameSprite('✨ ' + wd.name, '#ffe6a8');
        if (wd.planetRing) { var _eh = R * 1.15; lbl.position.set(0, _eh, 0); }   /* 星环：标在环外顶（环外径 2.5R） */
        else {
          var _lh = R * (mode === 'space' ? 0.2 : 0.16);
          if (mode === 'space') lbl.position.set(0, _lh, 0);
          else lbl.position.set(d[0] * _lh, d[1] * _lh, d[2] * _lh);
        }
        body.add(lbl);
      } catch (e) { }
      M._wonderBody = body;
      grp.add(body);
      M._wonderLam = lbl;
      wonderStep();   /* 放置后立即定位（否则等自转才移出原点，埋在球里不可见） */
    }
    var geo0 = M._wonderGeo[wd.id];
    if (geo0) { place(geo0); return; }
    if (!GAME.gltf) return;
    function useBytes(ab) {
      if (M._wonderId !== wd.id) return;
      try {
        var parsed = GAME.gltf.parse(ab);
        if (!parsed.parts.length) return;
        var part = parsed.parts[0];
        var geo = GAME.gltf.bakeGeometry(part, THREE, 1);
        geo._mat = GAME.gltf.buildMaterial(THREE, part, function () { if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); });
        M._wonderGeo[wd.id] = geo;
        place(geo);
        if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      } catch (e) { /* 解析失败：静默缺席 */ }
    }
    /* v91.30：**按需注入 base64 模块**（`assets/wonders/<id>.glb.js` 设 window.__WONDER_GLB[id]）——
       双击 file:// 也能出（<script> 不受 fetch 的 CORS 限制），且只加载当前奇观这一个（不拖首屏）。 */
    var gb = window.__WONDER_GLB && window.__WONDER_GLB[wd.id];
    if (gb) { useBytes(_wonderB64Buf(gb)); return; }
    if (!document || !document.createElement) return;
    var sc = document.createElement('script');
    /* v91.38 修复（老板「奇观角度颠倒、颜色糊」）：本 asset 脚本此前**不带 ?v=** →
       index.html bump 后浏览器仍命中**旧缓存**的 .glb.js（旧的 Y-up 朝向 + 512px 糊贴图），
       于是"改了没用"。锚定到 index.html 的构建号（同源同串），随每次 bump 自动失效。
       取法：页面上任一 `?v=NNNN`（js/*.js 由 bump 脚本统一写同号）。 */
    var _bv = 0;
    try {
      var _any = document.querySelector('script[src*="?v="]');
      if (_any) { var _m = /[?&]v=(\d+)/.exec(_any.getAttribute('src') || ''); if (_m) _bv = _m[1]; }
    } catch (e) { }
    sc.src = 'assets/wonders/' + wd.id + '.glb.js' + (_bv ? ('?v=' + _bv) : '');
    sc.onload = function () { var b = window.__WONDER_GLB && window.__WONDER_GLB[wd.id]; if (b) useBytes(_wonderB64Buf(b)); };
    (document.head || document.body || document.documentElement).appendChild(sc);
  }
  /* 地表/海面落点：按 place 在该星球球面找一格（决定论）。water→湖/沼；land→陆地形。 */
  function _wonderSurfaceCell(kind, wid) {
    var SP2 = GAME.mapSphere && GAME.mapSphere.cells ? GAME.mapSphere : (GAME.sphere || null);
    var cells = SP2 && SP2.cells; if (!cells) return null;
    var want = (kind === 'water') ? ['lake', 'zhaoze'] : ['plain', 'caoyuan', 'forest', 'hill', 'desert'];
    /* ============================================================
     * v91.43（老板）：「哪有奇观落在家门口」——**不再锚定出生地附近**，改为
     *   **确定性随机**落在本星球任意一块合适地形上（可能落在球背面）。
     * · 确定性 = 星球种子 × 奇观 id 哈希 → 同一星球·同一奇观**每次落同一格**
     *   （重载/重建不跳位）；奇观按日一换 → 落点随之变，合"奇观常有常新"。
     * · 取"合适地形格集合"里的第 (hash % N) 个：一次 O(nv) 线性扫描（~1ms），
     *   无 BFS、无逐格求距（老版本那个 12 秒死循环不会再回来）。
     * · 无合适地形（如该球无湖）→ 退回"任意非城市格"，保证仍能落位。
     * ============================================================ */
    var seed = (SP2.seed3 ? SP2.seed3() : 0) >>> 0;
    var str = String(wid || '');
    var h = (seed ^ 2166136261) >>> 0;
    for (var si = 0; si < str.length; si++) h = Math.imul(h ^ str.charCodeAt(si), 16777619) >>> 0;   /* FNV-1a */
    var matches = [];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i]; if (!c) continue;
      if (want.indexOf(c.type) >= 0) matches.push(c);
    }
    if (!matches.length) {                              /* 回退：任意非城市格（含海/山） */
      for (var j = 0; j < cells.length; j++) { var c2 = cells[j]; if (c2 && c2.type !== 'city') matches.push(c2); }
    }
    if (!matches.length) return null;
    return matches[h % matches.length];
  }
  /* 每 33ms：太空轨行 / 地表·海面微旋 + 出场 scale 动画。 */
  function wonderStep() {
    if (!M._wonderBody || !M._wonderGrp) return;
    var mode = M._wonderMode || 'space';
    if (M._planetRing) {
      /* v91.40 行星环：恒在**球心**（环对称，环面内自旋不可见 → 不转，静置）。 */
      M._wonderBody.position.set(0, 0, 0);
    } else if (mode === 'space') {
      M._wonderAngle = (M._wonderAngle || 0) + 0.004;
      var a = M._wonderAngle, R_W = R * 1.6;
      var dir = [Math.cos(a), 0.22, Math.sin(a)];
      var L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      M._wonderBody.position.set(dir[0] / L * R_W, dir[1] / L * R_W, dir[2] / L * R_W);
    } else {
      /* 地表/海面：位置固定（贴地/入海），绕**自身竖轴**（= 所在处法线 d）慢转（活气）。
         v91.38：模型为 **Y-up**（解析器已应用节点旋转）—— tg 把 +Y 映到法线 d，
         故 `mesh.rotation.y` 即绕 d 自旋。 */
      var d = M._wonderUp || [0, 1, 0];
      var r = M._wonderR || (R + 2);
      M._wonderBody.position.set(d[0] * r, d[1] * r, d[2] * r);
      /* v156.63（老板「有点不太符合逻辑，建议统一旋转绕地心线」）——
         ⛔ 取消奇观自身自转：它是绕所在处的**法线**转的（赤道附近法线接近水平，
         看起来像"风车横着转"）。现在改为**整球绕地心线自转**（见 _spinTick），
         奇观作为球面上的物体会跟着一起转，逻辑统一：地心线不动，球环环绕它。 */
    }
    /* 出场：0.6s 内 scale 0→1（ease-out）。 */
    var t = (Date.now() - (M._wonderT0 || 0)) / 600; if (t > 1) t = 1;
    var e = 1 - Math.pow(1 - t, 3);
    M._wonderBody.scale.setScalar(0.2 + 0.8 * e);
    M._wonderBody.visible = e > 0.02;
  }
  M.wonderStep = wonderStep;
  /* 奇观天体 → 屏幕坐标（相机投影）。返回 {ndcX,ndcY,behind} 或 null。 */
  M.wonderScreen = function () {
    if (!M._wonderBody || !cam) return null;
    var v = new THREE.Vector3().copy(M._wonderBody.position).project(cam);
    return { ndcX: v.x, ndcY: v.y, behind: v.z > 1 };
  };
  M.buildWonder = buildWonder;

  M.rebuild = function () { built = false; _tileSub = -1; M._mkVer = null; M._flVer = null; M._arVer = null;
    M._fogVer = -1;
    /* v91.30：清奇观天体 → 下次 M.render 按当前星球重建。 */
    if (M._wonderGrp) { scene.remove(M._wonderGrp); M._wonderGrp = null; M._wonderBody = null; M._wonderLam = null; }
    /* v153：换星球/换格网 → 小人一起清掉（下一帧按新格重摆） */
    if (figRoot) { scene.remove(figRoot); figRoot = null; figCache = {}; M._standVer = ''; }
    /* v92.240k：放置物按星球分桶，换星球必须清掉（否则旧星球的物件挂在新球面上）*/
    M.clearGhost();
    if (plRoot) { scene.remove(plRoot); disposeTree(plRoot); plRoot = null; }
    _plVer = -1;
    /* v92.241b：换星球 → 贴地焦点作废（那一格在新球上是别的地方），并允许重新跟随 */
    M._focus = null; M._pendingFocus = null; M.camFree = false;
    /* v92.241：陨石带也要清（旧星球的带半径按旧半径算的，留着会插进新球）*/
    if (beltRoot) { scene.remove(beltRoot); disposeTree(beltRoot); beltRoot = null; }
    _beltIM = null; _beltRocks = null; _beltMs = []; _beltVer = -1;
    _beltMemo = null; _beltMemoRaw = null; _beltMemoPl = null; };
})();
