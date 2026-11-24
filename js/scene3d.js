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
 * 四、交互闭环：**结算只走既有出口，场景不自己算**
 * ══════════════════════════════════════════════════════════════
 * 场景里动手 → 按宿主调**既有的那一个出口**：
 *   · 序章宿主 → `G.prologue.act(ci, actId)`（不锁日 · 双倍率 · 前传专属）；
 *   · 正式宿主 → `GAME.jianghuDo(ci, genId, actId)`（日锁 · 将选 · 与地块按钮同口）。
 * 场景**不自己算产出**。以前的教训（v136 斗将 HP 与比分两本账）就是"呈现层偷偷算了一份"，
 * 那种 bug 查起来极贵。这里场景只负责"你走到了没有"。
 * v143 之前正式阶段的江湖动作是"弹一行字"（v90.93 去全屏剧本的后遗症）；
 * v143 起 `ui.doJianghu` 也走 `S.play` 进场景 —— 3D 场景不再是序章限定。
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
  /* v143：时段光照（晨/昼/昏/夜）—— 星露谷感的另一半是"天会黑"。
     LGT 指向 ensure() 建的三盏灯；_skyBase/_fogBase 是 buildScene 设的
     场景本色（tint 只做乘法，不改配置 —— 数据与呈现分开）。 */
  var LGT = null, _skyBase = 0x8e97a4, _fogBase = 0x8e97a4, _lastPhase = null;

  /* ============================================================
   * v157.87 · 海面场景（老板「地面更精细化，落到海面时，想要一个战舰世界
   *   那样的场景那么样一个比例和 3D 场景，创建一个人，在场景中自由移动。
   *   优先采用成熟方案」）
   * ------------------------------------------------------------
   * 技术选型**全是成熟做法**，没有一处自创：
   *   · 相机   → 透视 + 第三人称环绕（舰游/开放世界那一套），不再是正交"看棋盘"
   *   · 波浪   → 三重正弦涌浪（顶点位移）+ 高频法线细节（片元）。
   *              这是 three.js Water 与各家海洋 demo 的标准分工：
   *              **几何只承担采得动的大浪，小浪全部交给法线**
   *              （顶点永远不够密 —— 12 米一格采不动 2 米的浪）
   *   · 水面   → Schlick 菲涅尔 + 天空反射 + 太阳镜面（窄高光 + 宽光带）
   *   · 地平线 → 天空底部、雾、水面远景**同一个颜色**，接缝自然消失
   *   · 尺度   → 远景军舰按真实舰长拼（驱逐 118 m / 巡洋 182 m / 战列 246 m），
   *              它们才是"这片海有多大"的参照物
   *
   * ⛔ 一条硬约束：**GPU 的顶点位移与 CPU 的站立高度必须是同一个函数**。
   *   `seaWaveY`（JS）与 `seaWaveGlsl`（GLSL）都由同一份 `SEA_W` 生成，
   *   改海况只改那张表 —— 分开写两套，人就会在浪里沉浮/踩空，
   *   而且这种偏差只能靠肉眼才看得出来。
   * ============================================================ */
  var SEA = {
    SIZE: 3000,          /* 海面网格边长（米）：铺得比能见度大，看不到边 */
    SEG: 240,            /* 240×240 → 12.5 米一格（只有 40 米以上的涌浪采得动） */
    BOUND: 480,          /* 人可走范围 ±480 米，再远就是雾里 */
    SPEED: 6.0,          /* 走：地面 4.2 → 6.0（尺度一大，4.2 像冻住） */
    RUN: 13.5,
    HORIZON: 0x9dbccc,   /* 地平线色：天空底 / 雾 / 水面远景共用这一个 */
    ZENITH: 0x18466f,    /* 天顶：深蓝。海面视角只在 0~20° 仰角里，
                            天顶不深一点，整屏天空就是一片灰（第一版实测） */
    DEEP: 0x08252f,
    SHALLOW: 0x1e6274,
    SUN: 0xfff2da,
    FOG: 0.00046,        /* 雾密度：600 m 透射 0.93、1500 m 0.62（军舰在雾里但读得出轮廓） */
  };
  /* 三重涌浪 { 振幅, 波长, 相速, 方向 } —— 调海况只改这张表 */
  var SEA_W = [
    { A: 0.95, L: 160, S: 5.2, D: [0.92, 0.39] },
    { A: 0.48, L: 82, S: 4.0, D: [-0.36, 0.93] },
    { A: 0.22, L: 40, S: 3.2, D: [0.71, -0.70] }
  ];
  var SEA_AMP = 0;
  for (var _swi = 0; _swi < SEA_W.length; _swi++) SEA_AMP += SEA_W[_swi].A;

  /* CPU 侧的浪高：与下面 GLSL 逐项对齐 */
  function seaWaveY(x, z, t) {
    var y = 0;
    for (var i = 0; i < SEA_W.length; i++) {
      var w = SEA_W[i], k = 2 * Math.PI / w.L;
      y += w.A * Math.sin(k * (w.D[0] * x + w.D[1] * z) - w.S * t);
    }
    return y;
  }
  /* 把同一张表翻成 GLSL（数字只有一份） */
  function seaWaveGlsl() {
    var L = ['float seaH(vec2 p, float t, out vec2 grad) {', '  float h = 0.0; grad = vec2(0.0);'];
    for (var i = 0; i < SEA_W.length; i++) {
      var w = SEA_W[i], k = 2 * Math.PI / w.L;
      L.push('  { float ph = ' + k.toFixed(7) + ' * dot(p, vec2(' + w.D[0].toFixed(5) + ', '
        + w.D[1].toFixed(5) + ')) - ' + w.S.toFixed(5) + ' * t;'
        + ' h += ' + w.A.toFixed(5) + ' * sin(ph);'
        + ' grad += ' + (w.A * k).toFixed(7) + ' * vec2(' + w.D[0].toFixed(5) + ', '
        + w.D[1].toFixed(5) + ') * cos(ph); }');
    }
    L.push('  return h;', '}');
    return L.join('\n');
  }

  /* 海面场景的运行时状态 */
  var seaView = false, seaMesh = null, seaSky = null, seaMat = null, seaSkyMat = null;
  var seaTime = 0, seaCam = null, orthoCam = null;
  var seaFloat = [], seaShips = [], seaRipple = [], seaRipT = 0;
  var seaYaw = 0, seaPitch = 0.26, seaDist = 12.5, seaDrag = null;
  var _seaPrev = { x: 0, z: 0 };

  /* ============================================================
   * 0. 调色板（废土科技）
   * ------------------------------------------------------------
   * 颜色只在这里定义一次 —— 换风格改这一处，10 个场景一起变。
   * ============================================================ */
  var C = {
    rust: 0xb4622f, rustDark: 0x7a3f1e,
    iron: 0x3a4048, steel: 0x6b7684, steelLight: 0x9aa6b4,
    moss: 0x5a6b4a, mossDark: 0x36432c,
    /* v156.68c：ash 从 0x6a6258（灰褐）改为 0x585d61（冷灰）。
       原因：墙用 ash，而碎垣地面是 0x7d6f5c —— 两者色相几乎一样（都是灰褐），
       墙体直接融进地面，怎么调光都出不来层次。
       改成冷灰后，暖地面 / 冷墙体形成冷暖对比，墙的轮廓自己就立起来了。 */
    sand: 0x8a7a52, ash: 0x585d61,
    bone: 0xa89b84, wood: 0x6b533a, woodDark: 0x483824,
    glow: 0x4fd1c5, neon: 0xffb347, blood: 0xa8332a,
    water: 0x2b4d5a, wheat: 0xc9a64a,
  };
  var _matCache = {};
  function lam(c, extra) {
    /* 同色同参数复用材质：60 个 Mesh 能压到 ~15 个材质，draw 状态切换少一半 */
    var k = c + '|' + (extra ? JSON.stringify(extra) : '');
    if (_matCache[k]) return _matCache[k];
    /* v156.68：Lambert → MeshStandard（PBR）。
       Lambert 只有漫反射、没有高光、不吃环境贴图 —— 金属、石头、布、木头
       全都是「同一块塑料」的质感，这就是画面幼稚的主因。
       Standard 有 roughness / metalness 两轴：
         · 默认 roughness .92 / metalness .02 → 石头、土墙、木头（粗糙、无反射）
         · 金属件在调用处传 metalness .7~.9 / roughness .25~.4（见 PROP）
       同色同参数仍复用缓存，draw call 不增加。 */
    var o = { color: c, roughness: 0.92, metalness: 0.02 };
    if (extra) for (var q in extra) o[q] = extra[q];
    /* v156.68：默认挂通用表面贴图（灰阶，与 color 相乘）。
       一张贴图服务所有颜色 → 内存一份、draw call 不增。
       发光件/水面/UI 薄片传 { noMap: true } 关掉。 */
    var _noMap = o.noMap; delete o.noMap;
    var _mapKind = o.mapKind; delete o.mapKind;
    if (!_noMap) o.map = surfaceTex(_mapKind || 'prop', 7);
    /* v156.68c：**金属件自动给金属参数**。
       调色板里 iron / steel / steelLight 就是废铁、钢、亮钢。
       Lambert 时代所有材质长一样；PBR 下金属必须有 metalness + 低 roughness，
       否则它只是「灰色塑料」—— 这是「发挥 three.js 能力」最直接的一处。
       显式传了 extra 的（锈迹、发光件）不覆盖，保留调用处的意图。 */
    if (extra === undefined && (c === C.iron || c === C.steel || c === C.steelLight)) {
      o.metalness = 0.74; o.roughness = 0.36;
      o.envMapIntensity = 1.35;      /* 金属靠环境贴图出反射，强度给足 */
    }
    /* 顶点色 = 几何烘焙的 AO（见 bakeAO）。所有走 mesh() 的几何体都会带 color，
       所以这里统一开是安全的。 */
    if (o.vertexColors === undefined) o.vertexColors = true;
    var m = new THREE.MeshStandardMaterial(o);
    _matCache[k] = m;
    return m;
  }
  /* ============================================================
   * v156.68 通用表面纹理（把「纯色块」变成「有材质的面」）
   * ------------------------------------------------------------
   * 之前每个物体都是 lam(纯色) —— 一个颜色刷满整面墙。
   * 这就是「低模积木」的观感来源：**没有纹理就没有尺度**，
   * PBR / 阴影再准，纯色面看上去依然是贴纸。
   *
   * 做一张**灰阶**表面图（白底 + 明暗扰动，均值≈0.88），
   * 用 MeshStandardMaterial 的 map 与 color **相乘**：
   *   同一张贴图服务所有颜色 → 内存只有一份，draw call 一个不增。
   *
   * 五层叠加，每层解决一个具体的「假」：
   *   ① 低频大斑 —— 大尺度脏污/褪色（纯高频噪点没有尺度感，像电视雪花）
   *   ② 高频颗粒 —— 微观粗糙（贴图拉远时的塑料感来源）
   *   ③ 裂缝折线 —— 混凝土的破损线索，让「废墟」由纹理本身承担
   *   ④ 底部暗带 —— **廉价 AO**：盒子每面 UV 都是 0..1，
   *                 底边压暗 = 物体与地面的接触暗部（「浮在板上」的解药）
   *   ⑤ 顶部微亮 —— 受天光的顶面更亮，强化体积
   * ============================================================ */
  var _surfCache = {};
  function surfaceTex(kind, seed) {
    var key = kind + '|' + (seed || 0);
    if (_surfCache[key]) return _surfCache[key];
    var N = 256;
    var cv = document.createElement('canvas');
    cv.width = cv.height = N;
    var g = cv.getContext('2d');
    var R = rng((seed || 7) * 977 + (kind === 'ground' ? 5381 : 2141));

    /* ① 底：略低于纯白，这样相乘后整体轻微压暗（更像旧物） */
    g.fillStyle = '#e2e2e2';
    g.fillRect(0, 0, N, N);

    /* ② 低频大斑：大尺度脏污。半径 20~85px，明暗 ±，边缘用径向渐变化开 */
    var i, x, y, rr, v, rg;
    for (i = 0; i < 30; i++) {
      x = R() * N; y = R() * N; rr = 34 + R() * 104;   /* 放大：一张纹理覆盖 ~3.8 米，斑块要有 0.5~2 米 */
      v = Math.round(132 + R() * 112);   /* 明暗跨度拉大：斑驳要看得出来 */
      rg = g.createRadialGradient(x, y, 0, x, y, rr);
      rg.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',0.66)');
      rg.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)');
      g.fillStyle = rg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }

    /* ③ 高频颗粒：逐像素微扰。图像数据直接算，比画几万个点快 */
    var img = g.getImageData(0, 0, N, N), d = img.data;
    for (i = 0; i < d.length; i += 4) {
      var n = (R() - 0.5) * 24;          /* ±12 灰阶（放太大会变雪花） */
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);

    /* ④ 裂缝：随机折线，深灰 + 细。接地/风化最容易在裂缝处显脏 */
    g.lineCap = 'round';
    for (i = 0; i < 5; i++) {
      g.beginPath();
      var cx = R() * N, cy = R() * N;
      g.moveTo(cx, cy);
      var segs = 3 + Math.floor(R() * 4);
      for (var k2 = 0; k2 < segs; k2++) {
        cx += (R() - 0.5) * 92; cy += (R() - 0.5) * 92;   /* 裂缝要跨 1~2 米才看得出是裂缝 */
        g.lineTo(cx, cy);
      }
      g.strokeStyle = 'rgba(70,66,60,' + (0.16 + R() * 0.22).toFixed(2) + ')';
      g.lineWidth = 0.7 + R() * 1.3;
      g.stroke();
    }

    /* ⑤ ⛔ 这里原本还有「底部暗带 + 顶部微亮」当作廉价 AO —— **撤掉了**。
       它依赖「盒体每面 UV 都是 0..1」这个前提，而为了让纹理密度一致，
       uvBox() 已经把 UV 改成世界坐标 + RepeatWrapping：
       暗带于是按 1.6 米周期在墙面上**重复出现**，成了横向灰条纹（截图确认）。
       AO 改由 bakeAO() 用**顶点色**实现 —— 与 UV 完全解耦。 */

    /* ⑥ kind==='wall' 专用：**预制板接缝 + 渗水痕**
       这是让「一面墙」像建筑而不是像色块的关键层。
       没有结构线，再好的斑驳也只是「脏的平面」；
       有了接缝，人眼会自动读出「这是拼装的墙体」，尺度感随之成立。 */
    if (kind === 'wall') {
      g.strokeStyle = 'rgba(46,44,42,0.5)';
      g.lineWidth = 2.6;
      for (var wy = 1; wy <= 1; wy++) {
        g.beginPath(); g.moveTo(0, N * 0.5); g.lineTo(N, N * 0.5); g.stroke();
      }
      g.beginPath(); g.moveTo(N * 0.5, 0); g.lineTo(N * 0.5, N); g.stroke();
      /* 接缝旁的凿痕高光：只画一侧，光才「有方向」 */
      g.strokeStyle = 'rgba(210,206,198,0.18)';
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, N * 0.5 + 2.2); g.lineTo(N, N * 0.5 + 2.2); g.stroke();

      /* 渗水痕：从上方往下流的暗条，宽窄不一。废墟墙最典型的「时间痕迹」 */
      /* ⚠️ 第一版画了 16 条，而这张贴图在 20 米长墙上要重复 6 次 → 96 条竖线，
         成了「竖条纹壁纸」（截图确认）。渗水痕本来就是**偶发**的：
         降到 4 条、透明度减半，才像「有几处漏过水」而不是「刷了条纹漆」。 */
      for (var wi = 0; wi < 4; wi++) {
        var wx2 = R() * N, wy2 = R() * N * 0.45;
        var wl = 70 + R() * 190;
        var lgw = g.createLinearGradient(wx2, wy2, wx2, wy2 + wl);
        lgw.addColorStop(0, 'rgba(38,34,30,' + (0.10 + R() * 0.12).toFixed(2) + ')');
        lgw.addColorStop(1, 'rgba(38,34,30,0)');
        g.fillStyle = lgw;
        g.fillRect(wx2 - 1 - R() * 4, wy2, 3 + R() * 9, wl);
      }
    }

    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    try { tex.colorSpace = THREE.SRGBColorSpace; } catch (e) { }
    tex.anisotropy = 4;
    _surfCache[key] = tex;
    return tex;
  }

  /* 按世界尺寸重算盒体 UV。
     ⚠️ BoxGeometry 的默认 UV 是「每面 0..1」—— 一面 20 米长的墙和一面 0.3 米的箱子
     贴同一张纹理，前者会被拉成糊成一片的花。命中率最高的一步就是这里：
     按顶点在面内的真实坐标 × 密度，让纹理密度在所有尺寸上都一致。 */
  /* 回转体（圆柱/圆锥/球）的 UV 缩放。
     这几类的默认 UV 也是 0..1：2.2 米高的树干和 0.4 米的桩子贴同一张纹理，
     密度差 5 倍 —— 树干上的斑驳会被拉成竖条。按周长/高度折算平铺次数。 */
  function uvTurned(geo, perUnit) {
    if (geo.userData._uvT) return;
    geo.userData._uvT = 1;
    var pos = geo.attributes && geo.attributes.position, uv = geo.attributes && geo.attributes.uv;
    if (!pos || !uv) return;
    geo.computeBoundingBox();
    var bb = geo.boundingBox;
    var h = Math.max(0.05, bb.max.y - bb.min.y);
    var r = Math.max(0.05, Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2);
    var repU = Math.max(1, Math.round(2 * Math.PI * r * perUnit));
    var repV = Math.max(1, Math.round(h * perUnit));
    for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * repU, uv.getY(i) * repV);
    uv.needsUpdate = true;
  }

  function uvBox(geo, perUnit) {
    if (geo.userData._uv === perUnit) return;
    geo.userData._uv = perUnit;
    var pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    if (!pos || !nor || !uv) return;
    for (var i = 0; i < pos.count; i++) {
      var ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
      var u, v;
      if (ax >= ay && ax >= az) { u = pos.getZ(i); v = pos.getY(i); }        /* 法线朝 X → 用 Z/Y */
      else if (ay >= ax && ay >= az) { u = pos.getX(i); v = pos.getZ(i); }   /* 法线朝 Y → 用 X/Z */
      else { u = pos.getX(i); v = pos.getY(i); }                             /* 法线朝 Z → 用 X/Y */
      uv.setXY(i, u * perUnit, v * perUnit);
    }
    uv.needsUpdate = true;
  }

  /* 顶点色 AO：按**局部 Y** 把物体底部压暗。
     为什么不用贴图：贴图的 UV 要按世界尺寸缩放（否则长墙被拉花），
     任何「按 UV 画暗带」的做法都会在重复周期里反复出现。
     顶点色与 UV 完全无关，且对所有几何体类型都成立（盒/柱/锥/球都行）。
     曲线：底部 42% 内 0.58 → 1.0 快速抬升，顶部 15% 再轻微提亮（天光）。 */
  function bakeAO(geo) {
    if (geo.userData._ao) return;
    geo.userData._ao = 1;
    var pos = geo.attributes && geo.attributes.position;
    if (!pos) return;
    geo.computeBoundingBox();
    var bb = geo.boundingBox;
    var y0 = bb.min.y, h = Math.max(1e-4, bb.max.y - bb.min.y);
    var col = new Float32Array(pos.count * 3);
    for (var i = 0; i < pos.count; i++) {
      var t = (pos.getY(i) - y0) / h;                 /* 0 = 底，1 = 顶 */
      var k;
      if (t < 0.42) k = 0.58 + 0.42 * (t / 0.42);     /* 接触暗部 */
      else if (t > 0.86) k = 1.0 + 0.05 * ((t - 0.86) / 0.14);
      else k = 1.0;
      col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  /* 辉光贴图（径向渐变）：给交互点做「这里有东西」的视觉焦点。
     additive 混合 + depthWrite:false —— 叠在场景上像光晕，不会把背后压黑。 */
  var _glowTex = null;
  function glowSprite(colHex, size, op) {
    if (!_glowTex) {
      var cvG = document.createElement('canvas');
      cvG.width = cvG.height = 128;
      var gG = cvG.getContext('2d');
      var rgG = gG.createRadialGradient(64, 64, 0, 64, 64, 64);
      rgG.addColorStop(0.00, 'rgba(255,255,255,1)');
      rgG.addColorStop(0.22, 'rgba(255,255,255,0.62)');
      rgG.addColorStop(0.52, 'rgba(255,255,255,0.18)');
      rgG.addColorStop(1.00, 'rgba(255,255,255,0)');
      gG.fillStyle = rgG; gG.fillRect(0, 0, 128, 128);
      _glowTex = new THREE.CanvasTexture(cvG);
    }
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: _glowTex, color: colHex, transparent: true, opacity: op == null ? 0.62 : op,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    sp.scale.set(size, size, 1);
    sp.name = 'glow';
    return sp;
  }

  function mesh(geo, mat, x, y, z) {
    if (geo) {
      /* 0.30/米：一张图覆盖 3.3 米。墙高 3.6 → 1.1 个周期（接缝可见、不糊）；
         0.17 时墙只覆盖 0.6 个周期，纹理被放大 1.6 倍，细节全糊掉。 */
      if (geo.type === 'BoxGeometry') uvBox(geo, 0.30);
      else if (geo.type === 'CylinderGeometry' || geo.type === 'ConeGeometry'
        || geo.type === 'SphereGeometry' || geo.type === 'IcosahedronGeometry') uvTurned(geo, 0.30);
      bakeAO(geo);
    }
    var m = new THREE.Mesh(geo, mat);
    if (x != null) m.position.set(x, y || 0, z || 0);
    /* v156.68：全局开投影。之前写死 false —— 所有物体都不会落影，
       只能靠一个黑色圆片假装接地，一眼假。 */
    m.castShadow = true; m.receiveShadow = true;
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
    /* v156.68c：墙体用 wall 专版贴图（带预制板接缝 + 渗水痕）。
       普通 prop 贴图是「均匀的脏」，只有接缝才能读出「建筑」。 */
    g.add(mesh(new THREE.BoxGeometry(w, hgt, thick), lam(C.ash, { mapKind: 'wall' }), 0, hgt / 2, 0));
    var teeth = Math.max(2, Math.round(w / 0.7));
    for (var i = 0; i < teeth; i++) {
      if (R() > 0.55) continue;
      var bw = w / teeth * (0.5 + R() * 0.5), bh = 0.25 + R() * 0.65;
      g.add(mesh(new THREE.BoxGeometry(bw, bh, thick * 0.96), lam(C.ash), -w / 2 + (i + 0.5) * (w / teeth), hgt + bh / 2 - 0.06, 0));
    }
    /* 墙面上的锈迹（v156.68 改）：
       旧版是**一整块 w*0.42 × hgt*0.5 的亮橙薄板**贴在墙正中 —— 规整、饱和、像便利贴，
       是画面里最扎眼的元素（截图确认）。
       改成 2~4 块**小块、低饱和、偏暗**的锈斑，分散贴在墙面上部：
       锈是「渗出来的脏」，不是「刷上去的漆」。 */
    var nr = 1 + Math.floor(R() * 3);
    for (var q2 = 0; q2 < nr; q2++) {
      var rw = w * (0.10 + R() * 0.17), rh = hgt * (0.14 + R() * 0.26);
      var rustMat = lam(C.rustDark, { roughness: 0.98, metalness: 0.08, color: 0x6b4632 });
      g.add(mesh(new THREE.BoxGeometry(rw, rh, 0.016), rustMat,
        (R() - 0.5) * (w - rw) * 0.86, hgt * (0.42 + R() * 0.42), thick / 2 + 0.010));
    }
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
    tower: gTower, crystal: gCrystal, wreck: gWreck, raft: seaRaft, stall: gStall, lantern: gLantern,
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
    raft: function (o) { return [o.seed]; },
    rock: function (o) { return [o.seed]; },
  };
  /* 接地阴影：一块压扁的暗椭圆。
     没开 shadowMap（移动端太贵），但没有接地阴影时物件像"贴在画面上"而不是"立在地上"，
     这是廉价但效果最大的一步。 */
  var _shadowMat = null;
  function contactShadow(r) {
    /* v156.67：0.26 的纯黑圆片在浅色地上像"洞口"，而且它是**圆**，
       和墙上/碎石那种方形轮廓对不上 —— 这是"简陋感"的第二大来源。
       降到 0.15 只留"物体压着地"的暗示，不做形状承诺。 */
    /* v156.68：开真阴影后，这个假圆片必须退到「几乎看不见」。
       它原本是 0.26 的纯黑圆（像地上的洞），上一版降到 0.15；
       现在有 shadowMap 的真实投影，留 0.06 只补「物体与地面的接触暗部」
       （AO 的作用），多一分就会和真阴影叠成双重影。 */
    if (!_shadowMat) _shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.06, depthWrite: false });
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
  /* ============================================================
   * v156.65 探索场景布局生成器（老板「类似探索性游戏的曲折场景，
   *   你可以从基础框架搭起，以便继续完善」）
   * ------------------------------------------------------------
   * 与 cityPlan 同一个范式：**几何只算一次**（纯数据，不碰 THREE / DOM），
   *   渲染照着画、碰撞照着用 —— 所以"这条路其实走不通"能在 node 里测出来。
   *
   * 为什么用"拓扑模板"而不是纯程序化（BSP / 迷宫）：
   *   纯程序化保证连通，但产出的曲折经常不好玩（长直走廊、死路过多）。
   *   手写模板 → 复杂度可控、可调；加新拓扑只需往 TOPO 里再加一条。
   *
   * 坐标：地面 40×40，可走范围 ±18。墙**只用轴对齐**（rot=0），
   *   这样碰撞盒是精确 AABB —— 旋转墙只做装饰、不进 solids。
   * ============================================================ */
  function scenePlan(cfg) {
    var seed = (cfg.seed || 7) | 0;
    var R = rng(seed + 4407);
    var HALF = 18;
    var props = [], nodes = [], solids = [], patrol = [];

    /* 一段轴对齐墙：同时产出渲染数据和碰撞盒（一个来源，不会两本账）。
       ⚠️ 关键：makeProp 的 wall 只认 `w`（沿 X 的长度），**不认厚度**。
       所以竖墙（d > w）必须把长边塞进 w，并用 rot 转 90° ——
       否则会被画成"0.7 米宽的柱子"（第一版就是这个样子，截图确认）。
       碰撞盒仍用**轴对齐**的原始 w/d，与渲染朝向无关。 */
    function wall(cx, cz, w, d, h) {
      var vertical = d > w;
      var len = vertical ? d : w;
      props.push({ t: 'wall', x: cx, z: cz, w: len, h: h || 3.6, rot: vertical ? Math.PI / 2 : 0, d: Math.min(w, d) });
      solids.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    }
    function rubble(x, z, n, sd) { props.push({ t: 'rubble', x: x, z: z, n: n || 6, seed: sd || (seed + x * 7 + z * 13) | 0 }); }
    function rebar(x, z, n, sd) { props.push({ t: 'rebar', x: x, z: z, n: n || 4, seed: sd || (seed + x * 11 + z * 5) | 0 }); }

    /* ---------------- 三种拓扑 ---------------- */
    var topo = ['L', 'ring', 'plaza'][Math.abs(seed) % 3];
    var spawn = { x: -11, z: -13 };
    var target = { x: 11, z: 11 };

    if (topo === 'L') {
      /* L 形长廊（v156.65b 收窄）：竖廊宽 4.5、横廊宽 4.5 ——
         11 米宽不叫走廊，叫空地，看着不像"曲折"。 */
      /* ⚠️ 坐标系：+z 是画面下方（玩家背后），-z 是前方。
         布局**必须以原点为中心** —— 第一版整体偏到左上角（x=-8.5, z=±8），
         而相机按"出生点 +10/-7"取景，结果只拍到地面边缘（截图确认）。 */
      wall(-2.6, -2, 0.7, 20, 3.6);            /* 竖廊左墙 */
      wall(2.6, -2, 0.7, 20, 3.6);             /* 竖廊右墙 → 宽 4.5 米通道 */
      wall(-5, -12.4, 15, 0.7, 3.6);           /* 横廊上沿（尽头） */
      wall(-5, -7.6, 8, 0.7, 3.6);             /* 横廊下沿（左侧留口 = 拐弯处） */
      wall(-11.5, -10, 0.7, 6, 3.6);           /* 目标区侧墙 */
      rubble(0, 2, 8); rebar(1.4, -3, 5); rubble(-1.2, -5, 6);
      rubble(-5, -10, 7); rebar(-9, -10, 4);
      nodes.push({ t: 'rubble', x: 0, z: 2, act: 'cai', label: '翻找碎石堆', hint: '药草、矿料、偶尔一个辐能核心' });
      nodes.push({ t: 'crate', x: -10, z: -10, act: 'cai', label: '撬开货箱', hint: '旧世留下的存货' });
      spawn = { x: 0, z: 6 };
      target = { x: -10, z: -10 };
    } else if (topo === 'ring') {
      /* 回字形：中间一整块建筑体，玩家必须绕行；
         西侧留缺口（入口），东北角是目标 —— 走一圈才到 */
      wall(0, -6, 18, 0.6, 2.4);               /* 中块南墙 */
      wall(0, 6, 18, 0.6, 2.4);                /* 中块北墙 */
      wall(-9, 0, 0.6, 12, 2.4);               /* 中块西墙（有缺口 → 拆成两段） */
      solids.pop(); props.pop();               /* 撤销上面那段，改两段留门 */
      wall(-9, -4.2, 0.6, 3.6, 2.4);
      wall(-9, 4.2, 0.6, 3.6, 2.4);
      wall(9, 0, 0.6, 12, 2.4);                /* 中块东墙（全封 → 只能从西绕） */
      wall(-15, 0, 0.6, 26);                   /* 外圈西墙 */
      wall(15, 0, 0.6, 26);                    /* 外圈东墙 */
      wall(0, 15, 26, 0.6);                    /* 外圈北墙 */
      wall(0, -14, 26, 0.6);                   /* 外圈南墙（留门 → 两段） */
      solids.pop(); props.pop(); solids.pop(); props.pop();
      wall(-9, -14, 12, 0.6); wall(9, -14, 12, 0.6);
      rubble(-12, -8, 7); rebar(-12, 6, 4); rubble(12, -6, 6);
      rubble(0, 10, 5);
      nodes.push({ t: 'rubble', x: -12, z: -8, act: 'cai', label: '翻找碎石堆', hint: '沿外围一路搜' });
      nodes.push({ t: 'rebar', x: 12, z: 9, act: 'tao', label: '清剿这一带的掠夺者', hint: '动手，胜则物资丰厚' });
      target = { x: 12, z: 9 };
    } else {
      /* 双广场 + 窄巷：左开阔（资源多）→ 挤过 3 米窄巷 → 右广场（目标） */
      /* 双广场 + 2.5 米窄巷，**整体围绕原点**（视口高 17.5，布局半径 ≤ 9）。
         v156.66：第一版铺到 x=-12 / z=±10，出生点 (-12,-10) 离原点太远，
         相机追过去只剩角落 —— 生成式布局必须以 (0,0) 为心，不能往外铺。
         玩家 (-2.5, 4) 站在左广场南口：直走是窄巷，挤过去才到右广场。 */
      wall(-4.5, -8, 9, 0.7); wall(-4.5, 5.5, 9, 0.7);   /* 左广场南北围挡 */
      wall(-9, -1.25, 0.7, 14.2);                        /* 左广场西墙（封闭） */
      wall(-4.5, -2, 0.7, 11);                           /* 左广场东墙（留巷口） */
      wall(4.5, -8, 9, 0.7); wall(4.5, 5.5, 9, 0.7);     /* 右广场南北围挡 */
      wall(9, -1.25, 0.7, 14.2);                         /* 右广场东墙（封闭） */
      wall(4.5, -2, 0.7, 11);                            /* 右广场西墙（留巷口） */
      wall(0, -2, 4, 0.7); wall(0, 1.5, 4, 0.7);         /* 窄巷上下沿 → 2.5 米宽 */
      rubble(-2.5, 1, 7); rebar(-3.5, -5, 4);
      rubble(0.5, -1, 4);                                /* 巷道碎石（挤过去要绕） */
      rubble(2.5, -5, 6); rebar(3, 1, 4);
      nodes.push({ t: 'rubble', x: -2.5, z: 1, act: 'cai', label: '翻找碎石堆', hint: '左广场物资密集' });
      nodes.push({ t: 'crate', x: 2.5, z: -5, act: 'cai', label: '撬开货箱', hint: '旧世留下的存货' });
      target = { x: 2.5, z: -5 };
      spawn = { x: -2.5, z: 4 };
    }

    /* ---------------- 通用点缀：碎石 / 枯树 / 太阳能板 ---------------- */
    for (var i = 0; i < 5; i++) {
      var ax = (R() - 0.5) * 32, az = (R() - 0.5) * 32;
      if (Math.abs(ax) > HALF - 1 || Math.abs(az) > HALF - 1) continue;
      props.push({ t: R() > 0.55 ? 'deadTree' : 'rock', x: ax, z: az, s: 0.8 + R() * 0.6, seed: (seed + i * 31) | 0 });
    }
    props.push({ t: 'solar', x: 14, z: -12, rot: -0.3 });
    props.push({ t: 'pipe', x: -15, z: 12, len: 2.8, rot: 0.7 });

    var bounds = { x0: -HALF + 1, x1: HALF - 1, z0: -HALF + 1, z1: HALF - 1 };

    /* ---------------- 连通性验证（BFS，0.5 米格） ----------------
       这是"框架"的价值：布局好不好在不进 WebGL 的情况下就能判定。 */
    var GRID = 0.5, NX = Math.ceil((HALF * 2) / GRID);
    function blocked(x, z, r) {
      if (x < bounds.x0 + r || x > bounds.x1 - r || z < bounds.z0 + r || z > bounds.z1 - r) return true;
      for (var k = 0; k < solids.length; k++) {
        var sl = solids[k];
        var cx = x < sl.x0 ? sl.x0 : (x > sl.x1 ? sl.x1 : x);
        var cz = z < sl.z0 ? sl.z0 : (z > sl.z1 ? sl.z1 : z);
        var dx = x - cx, dz2 = z - cz;
        if (dx * dx + dz2 * dz2 < r * r) return true;
      }
      return false;
    }
    function reachable(from, to) {
      var r = 0.35;
      var sx = Math.round((from.x + HALF) / GRID), sz = Math.round((from.z + HALF) / GRID);
      var tx = Math.round((to.x + HALF) / GRID), tz = Math.round((to.z + HALF) / GRID);
      var seen = {}, q = [[sx, sz]], head = 0;
      seen[sx + ',' + sz] = 1;
      while (head < q.length) {
        var cur = q[head++];
        if (cur[0] === tx && cur[1] === tz) return true;
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var d2 = 0; d2 < 4; d2++) {
          var nx2 = cur[0] + dirs[d2][0], nz2 = cur[1] + dirs[d2][1];
          if (nx2 < 0 || nz2 < 0 || nx2 >= NX || nz2 >= NX) continue;
          var key = nx2 + ',' + nz2;
          if (seen[key]) continue;
          var wx = nx2 * GRID - HALF, wz = nz2 * GRID - HALF;
          if (blocked(wx, wz, r)) continue;
          seen[key] = 1; q.push([nx2, nz2]);
        }
      }
      return false;
    }
    var reach = { ok: true, bad: [] };
    for (var n2 = 0; n2 < nodes.length; n2++) {
      if (!reachable(spawn, nodes[n2])) { reach.ok = false; reach.bad.push(n2); }
    }
    if (!reachable(spawn, target)) { reach.ok = false; reach.bad.push('target'); }

    /* 巡逻点：沿可走格随机取若干（行人用；当前 gather 场景不用，留接口） */
    for (var p2 = 0; p2 < 6; p2++) {
      var px = (R() - 0.5) * 30, pz = (R() - 0.5) * 30;
      if (!blocked(px, pz, 0.6)) patrol.push({ x: px, z: pz });
    }

    return {
      topo: topo, seed: seed, props: props, nodes: nodes, solids: solids,
      bounds: bounds, spawn: spawn, target: target, patrol: patrol, reach: reach,
    };
  }
  S._scenePlan = scenePlan;   /* 暴露给 node 测试（smoke 里能验连通性） */

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
      /* ============================================================
       * v157.87（老板「落到海面时，想要一个战舰世界那样的场景…」）
       * ------------------------------------------------------------
       * `lake`（水域格）从"40 米见方的小水塘"换成**海面场景**：
       *   · 场景 id 保持 'lake'（`S.pickFor('lake_scene','lake')` 与
       *     `jianghuActsAt` 的入口一字不改，垂钓/采集/调息的账本也不动）
       *   · 布景坐标从 ±5 米改成 ±40 米 —— 尺度变了，旧坐标会挤成一坨
       *   · `water: true` 撤掉：海面是**场景自带的一整片海**（buildSeaScene），
       *     不是"地上一块水面板"。留 `water` 会在地上再铺一层 30×26 的板子，
       *     和海面打架（同一位置两层水面，深度冲突）。
       * ============================================================ */
      id: 'lake', name: '海上漂流', sub: '水面一直铺到天边 —— 雾里还停着几艘军舰',
      ground: 0x7a6f55, sky: 0x93b3c4, fog: 0x8fa6b2, act: 'lake_scene', seed: 404,
      sea: true,
      props: [
        /* 水上的东西：半沉的船壳、漂着的桶和箱、芦苇丛、露出水面的礁石。
           全部在 60 米内 —— 人走到哪儿都能看见"参照物"，才读得出尺度。 */
        { t: 'barrel', x: 8, z: -12 }, { t: 'barrel', x: 11.5, z: -10.5 },
        { t: 'crate', x: 6.4, z: -13.6, s: 1.1 },
        { t: 'reed', x: 14, z: -20, n: 7, seed: 2 }, { t: 'reed', x: 19, z: -17, n: 5, seed: 4 },
        { t: 'rock', x: -18, z: -9, seed: 5 }, { t: 'rock', x: -21, z: -11, seed: 6 },
        { t: 'log', x: 3.2, z: -7.5, rot: 1.1 },
        { t: 'reed', x: -6, z: -3.6, n: 5, seed: 7 },
      ],
      nodes: [
        /* 钓点挂在**半沉的船壳**上：人站在浪里，靠在残骸边下竿。
           （旧版钓点是"岸上的一根管子"—— 海上没有岸了） */
        { t: 'raft', x: -16, z: -26, seed: 3, act: 'lake_scene', label: '在浮筏上下竿', hint: '肥鱼入篓，偶得水中沉物' },
        { t: 'reed', x: 14, z: -20, n: 6, seed: 2, act: 'cai', label: '在芦苇丛里摸', hint: '水边的药材' },
        { t: 'rock', x: -18, z: -9, seed: 5, act: 'xiu', label: '在礁石上静坐', hint: '辐能充裕处调息' },
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

  /* v2026xxxx：骨骼角色（Soldier）替身 —— 程序化方块人的升级版。
     load 成功后挂到 player 组上；加载前/失败则用方块人兜底（场景不空白）。 */
  var playerActor = null, playerActing = false;
  /* 斗将：遭遇节点旁生成敌方 Soldier（duel.js 本身无 3D 渲染，这里是它的宿主视觉）。
     duelActive 期间玩家播 attack、敌人播 guard；玩家走动/S.close 时清场。 */
  var duelFoeActor = null, duelFoeGroup = null, duelActive = false;

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
    /* v156.68c：**暗角（vignette）**。
       正交场景的问题之一是「画面一直铺到边缘、没有呼吸」，
       观众会觉得像在看俯视示意图而不是一个场景。
       用 CSS 在 canvas 上叠一层径向渐变：中心透明、四周压暗 ——
       零 GPU 成本（不经过 WebGL），但立刻把注意力收到中心。
       pointer-events:none 保证不挡点击。 */
    (function addVignette() {
      var v = document.createElement('div');
      v.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3;' +
        'background:radial-gradient(ellipse 68% 62% at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.16) 68%, rgba(0,0,0,0.42) 100%);';
      layer.appendChild(v);
    })();

    R3 = new THREE.WebGLRenderer({ canvas: cvs, antialias: true });
    R3.setClearColor(0x0b0d10, 1);
    try { R3.outputColorSpace = THREE.SRGBColorSpace; } catch (e) { /* r150 以下没有 */ }
    /* ============================================================
     * v156.68（老板「渲染太幼稚了，没有发挥 three.js 的能力」）
     * ------------------------------------------------------------
     * 之前只用了 three 的「最低配置」：Lambert 材质 + 无阴影 + 无色调映射 +
     * 无环境贴图。这四样都不开，画面必然是「纯色积木贴在板上」——
     * 跟 three 能做什么没关系，是根本没用。
     *
     * 这一版把核心能力全开（都不需要 addon，项目只有 three.min.js）：
     *   ① ACESFilmic 色调映射 —— 亮部不过曝、暗部有层次，是「电影感」的来源
     *   ② shadowMap（PCFSoft）—— 物体终于有真实投影，而不是地上一个黑圆片
     *   ③ scene.environment（程序化 PMREM）—— 金属才有反射、粗糙面才有环境色
     *   ④ 材质 Lambert → MeshStandard（PBR）—— 见 lam()
     * ============================================================ */
    try {
      R3.toneMapping = THREE.ACESFilmicToneMapping;
      R3.toneMappingExposure = 1.32;      /* PBR + ACES 下画面整体偏暗，补偿到 1.32 */
    } catch (e0) { }
    try {
      R3.shadowMap.enabled = true;
      R3.shadowMap.type = THREE.PCFSoftShadowMap;   /* 硬边阴影会显「低模」，软边才融得进画面 */
    } catch (e1) { }

    scene = new THREE.Scene();
    /* ------------------------------------------------------------
     * v156.68 程序化环境贴图（PBR 的灵魂）
     * ------------------------------------------------------------
     * MeshStandardMaterial 没有 environment 就等于塑料：metalness 再高也不反光。
     * 项目只有 three.min.js（没有 RoomEnvironment / RGBELoader 这些 addon），
     * 所以用 Canvas 现画一张 equirect 全景：
     *   天顶暗 → 高空灰蓝 → 地平线暖沙 → 地面暗褐，
     *   再在地平线上方点一个暖色太阳斑。
     * 过 PMREMGenerator 转成预滤波环境贴图 —— 金属件会反射出这个太阳，
     * 画面立刻有「光源真的在场景里」的感觉。
     * ------------------------------------------------------------ */
    (function buildEnv() {
      try {
        var cv2 = document.createElement('canvas');
        cv2.width = 512; cv2.height = 256;
        var g2 = cv2.getContext('2d');
        var sky = g2.createLinearGradient(0, 0, 0, 256);
        sky.addColorStop(0.00, '#0e151d');   /* 天顶：最深 */
        sky.addColorStop(0.34, '#38434f');
        sky.addColorStop(0.50, '#9c8f78');   /* 地平线：暖沙色 */
        sky.addColorStop(0.62, '#5b5142');
        sky.addColorStop(1.00, '#241f19');   /* 地面：暗褐（给物体底部环境反光） */
        g2.fillStyle = sky; g2.fillRect(0, 0, 512, 256);
        /* 太阳斑：偏高、偏一侧。PBR 高光会在这里「点亮」，金属才有金属样 */
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
        /* v157.58：通知 gltf 解析器"本场景已有程序化 env"—— buildMaterial 据此放开 metalness 上限，
           金属件才有反射、粗糙面才有环境色（不影响无 env 的 map3d/duel3d 场景）。 */
        if (GAME.gltf && GAME.gltf.setEnvAvailable) GAME.gltf.setEnvAvailable(true);
        eq.dispose(); pm.dispose();
      } catch (e) { /* 老版本没有 PMREM → 退回纯直射光，不影响可用性 */ }
    })();
    /* v157.87：正交相机留一个引用 —— 海面场景要换成透视，退出时必须换回来 */
    orthoCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
    cam = orthoCam;
    /* 光：半球光给环境色，方向光给"太阳"和影子方向感。
       不启用 shadowMap —— 正交场景里靠颜色和轮廓已经够，阴影贴图在移动端太贵。 */
    /* 三层光：
         hemi  天光/地面反光 → 决定整体环境色
         sun   主光（暖） → 给"太阳在哪"和明暗面
         rim   背光（冷） → 把暗面从背景里剥出来（没有它，灰墙压在灰地上就是一片糊）
       再加一盏很弱的环境光把最暗处抬起来 —— 低于这个亮度，暗部细节全丢。 */
    /* v156.68b：**拉开明暗对比**。
       旧参数是「环境光 1.0 + 环境 0.22 + 主光 1.15」—— 环境光几乎和主光一样强，
       于是所有面亮度接近，阴影（如果有）也压不下去，画面就成了「一层灰雾」。
       PBR 下方向光要给得更足、环境光要收得更紧：
         hemi 1.0 → 0.42（只负责天光/地面反光的色相）
         amb  0.22 → 0.08（只把纯黑抬起来一点）
         sun  1.15 → 2.25（主光主导，明暗面才分得开）
         rim  0.55 → 0.85（背光把暗面从背景里剥出来） */
    scene.add(new THREE.HemisphereLight(0xe4eef5, 0x4a4638, 0.30));
    var amb = new THREE.AmbientLight(0xffffff, 0.08);
    scene.add(amb);
    var sun = new THREE.DirectionalLight(0xfff1d8, 2.60);
    sun.position.set(9, 16, 7);
    /* v156.68：主光投影。正交光源的 shadow camera 要手动覆盖整个场景（40×40），
       否则边缘物体没有阴影。1024² + PCFSoft 在这个体量（几十个 mesh）下开销很小，
       换来的是「物体真的站在地上」—— 这是廉价假圆片永远做不到的。 */
    try {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
      sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
      /* ⚠️ 关键：改了正交 shadow camera 的边界**必须** updateProjectionMatrix()。
         不调它，投影矩阵还是默认的 -5..5（10×10 米），
         而墙在 ±12 米外 —— 影子全被裁掉，等于没开阴影。
         第一版就是这么「开了但看不见」的。 */
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = -0.0009;        /* 防止自阴影「痤疮」 */
      sun.shadow.normalBias = 0.022;
    } catch (e2) { }
    scene.add(sun);
    var rim = new THREE.DirectionalLight(0x9fc4d8, 0.85);
    rim.position.set(-8, 6, -9);
    scene.add(rim);
    /* v156.67：野外场景把主光压低（16 → 9），让地面起伏真的产生明暗。
       原来是 (9,16,7) 近乎顶光 → 法线朝上的平面全是一个亮度，加了起伏也白加。
       城市场景 (cityView) 的取景是"俯瞰街道"，顶光更清楚，所以只在野外改。 */
    if (!cityView) {
      sun.position.set(12, 9, 9);
      rim.position.set(-9, 5, -11);
    }
    LGT = { sun: sun, amb: amb, rim: rim };   /* v143：时段光照要能改这三盏 */

    /* 键鼠 */
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', function (e) { keys[e.key] = false; }, true);
    window.addEventListener('resize', resize, false);
    cvs.addEventListener('pointerdown', onPointerDown);
    /* v157.87：海面的环绕镜头要拖拽/滚轮 —— 监听挂在 window 上，
       拖动移出 canvas 也不会丢事件（拖到工具栏就"粘住"是常见毛病）。 */
    window.addEventListener('pointermove', onPointerMove, false);
    window.addEventListener('pointerup', onPointerUp, false);
    window.addEventListener('pointercancel', onPointerUp, false);
    cvs.addEventListener('wheel', onWheel, { passive: false });
    return;
  }

  function resize() {
    if (!R3) return;
    var w = layer.clientWidth || 1, h = layer.clientHeight || 1;
    R3.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R3.setSize(w, h, false);
    var asp = w / h;
    /* v157.87：海面场景是透视相机，正交那套 left/right/top/bottom 对它无意义 */
    if (cam && cam.isPerspectiveCamera) {
      cam.aspect = asp;
      cam.updateProjectionMatrix();
      return;
    }
    cam.left = -frustumH * asp / 2; cam.right = frustumH * asp / 2;
    cam.top = frustumH / 2; cam.bottom = -frustumH / 2;
    cam.updateProjectionMatrix();
  }

  /* ============================================================
   * v157.87 · 地面法线贴图（老板「地面更精细化」）
   * ------------------------------------------------------------
   * 之前地面只有颜色贴图 + 顶点色 —— 光照再准，**表面物理上是平的**，
   * 近景一看就是"一张图铺在板上"。
   * 法线贴图是这件事的成熟解法：不加一个面，靠切线空间法线骗出凹凸感。
   * 做法（标准流程）：
   *   ① 多倍频值噪声 → 高度图
   *   ② Sobel 求梯度 → RGB 编码法线
   *   ③ **取样按环绕取模**（x±1 用 % N）→ 贴图可无缝平铺（不透光、不出现接缝线）
   * 只 256²，每种地面生成一次；和颜色贴图各自 repeat(3,3)。
   * ============================================================ */
  function groundNormalTex(seed) {
    var N = 256;
    var hgt = new Float32Array(N * N);
    var R = rng((seed || 7) + 8123);
    var oct = [[16, 0.55], [7, 0.28], [3, 0.17]];
    for (var o = 0; o < oct.length; o++) {
      var cell = oct[o][0], amp = oct[o][1];
      var gw = Math.ceil(N / cell) + 2;
      var grid = new Float32Array(gw * gw);
      for (var q = 0; q < grid.length; q++) grid[q] = R();
      for (var y = 0; y < N; y++) {
        var gy = y / cell, iy = Math.floor(gy), fy = gy - iy, sy = fy * fy * (3 - 2 * fy);
        for (var x = 0; x < N; x++) {
          var gx = x / cell, ix = Math.floor(gx), fx = gx - ix, sx = fx * fx * (3 - 2 * fx);
          var a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1];
          var c = grid[(iy + 1) * gw + ix], d = grid[(iy + 1) * gw + ix + 1];
          var v0 = a + (b - a) * sx, v1 = c + (d - c) * sx;
          hgt[y * N + x] += (v0 + (v1 - v0) * sy) * amp;
        }
      }
    }
    var cv = document.createElement('canvas');
    cv.width = cv.height = N;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(N, N);
    var STR = 7.4;      /* 高度→坡度的放大系数：小了看不出凹凸，大了像橘子皮 */
    for (var yy = 0; yy < N; yy++) {
      var ym = ((yy - 1) + N) % N, yp = (yy + 1) % N;
      for (var xx = 0; xx < N; xx++) {
        var xm = ((xx - 1) + N) % N, xp = (xx + 1) % N;
        var dx = (hgt[yy * N + xp] - hgt[yy * N + xm]) * STR;
        var dz = (hgt[yp * N + xx] - hgt[ym * N + xx]) * STR;
        var len = Math.sqrt(dx * dx + dz * dz + 1);
        var i4 = (yy * N + xx) * 4;
        img.data[i4] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
        img.data[i4 + 1] = Math.round(((-dz / len) * 0.5 + 0.5) * 255);
        img.data[i4 + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
        img.data[i4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  /* ---------- 地面贴图（程序生成，1 张 256² 噪声图） ---------- */
  function groundTexture(baseCol, seed, kind) {
    /* v156.68b：512² + repeat(5,5) 时，同一张图的暗斑在画面上重复 25 次，
       肉眼立刻能看出「阵列」。改 512² + repeat(3,3)：
       重复次数降到 9，且单格覆盖 13.3 米，斑块不再有周期感。 */
    var cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    var g = cv.getContext('2d');
    var base = new THREE.Color(baseCol);
    g.fillStyle = '#' + base.getHexString();
    g.fillRect(0, 0, 512, 512);
    var R = rng(seed || 5);

    /* ============================================================
     * v156.68b（老板「渲染太幼稚」）—— 地面加**大尺度层次**
     * ------------------------------------------------------------
     * 旧版只有 2600 个 1~3px 的点 + 26 条细线 —— 全是**高频**。
     * 高频没有尺度参照，看起来就是「砂纸 / 电视雪花」，
     * 而地面占画面 80%，于是整幅画面显得廉价。
     *
     * 真实地表的层次是「大块脏 + 局部斑 + 细颗粒」三层叠加：
     *   ① 大色斑（半径 40~110px ≈ 1.2~3.4 米）：湿/干、踩实/松土
     *   ② 污渍团（多个圆叠成不规则形）：油渍、积水痕、焦痕
     *   ③ 干裂网：缝隙交错，是「久无人烟」最直接的信号
     * 三层之后才叠原来的颗粒 —— 顺序不能反，细颗粒必须压在最上面。
     * ============================================================ */
    var _i, _x, _y, _r, _v, _rg;
    /* ⛔ 原来的「① 大色斑 / ② 污渍团」两层**已删除**。
       它们画的是几十米级的尺度，而贴图要 repeat —— 必然出现形状重复的「云影」。
       大尺度改由地面几何体的**顶点色**承担（见 buildScene 里 _cols）。
       留在这里的只有小尺度：颗粒、干裂、草叶 —— 这些重复了也看不出来。 */

    /* ③ 干裂网：主裂缝粗、支缝细，交错才有「旱地」感 */
    g.lineCap = 'round';
    for (_i = 0; _i < 9; _i++) {
      var _cx2 = R() * 512, _cy2 = R() * 512;
      g.beginPath(); g.moveTo(_cx2, _cy2);
      for (var _j = 0; _j < 5; _j++) {
        _cx2 += (R() - 0.5) * 92; _cy2 += (R() - 0.5) * 92;
        g.lineTo(_cx2, _cy2);
      }
      g.strokeStyle = 'rgba(28,24,18,' + (0.20 + R() * 0.22).toFixed(2) + ')';
      g.lineWidth = 2.4 + R() * 4.0;
      g.stroke();
    }

    /* 噪点：三档明暗，做成"被踩过的地" */
    /* v156.68b：原 7000 个 2~8px 的点，像素放大后成了「一地白盐」——
       颗粒层的作用是**打破纯色**，不是"撒石子"。数量降到 2800、尺寸 1~3px、
       亮度扰动收窄到 ±0.09，让它退成底噪。 */
    for (var i = 0; i < 2800; i++) {
      var v = (R() - 0.5) * 0.18;
      var c = base.clone().offsetHSL(0, 0, v);
      g.fillStyle = '#' + c.getHexString();
      var s = 1 + R() * 2.4;
      g.fillRect(R() * 512, R() * 512, s, s);
    }
    /* 裂缝 / 草丛：按场景类型给不同笔触 */
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 2;
    for (var k = 0; k < 26; k++) {
      g.beginPath();
      var x = R() * 512, y = R() * 512;
      g.moveTo(x, y);
      for (var j = 0; j < 3; j++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; g.lineTo(x, y); }
      g.stroke();
    }
    if (kind === 'grass') {
      g.strokeStyle = 'rgba(150,180,120,0.28)';
      for (var m = 0; m < 220; m++) {
        var gx = R() * 512, gy = R() * 512;
        g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + (R() - 0.5) * 4, gy - 3 - R() * 4); g.stroke();
      }
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 7);
    return tex;
  }


  /* ============================================================
   * 海面场景（v157.87）—— 天空 / 海面 / 军舰 / 站在浪上的人
   * ============================================================ */
  function seaSkyMaterial() {
    var vs = [
      'varying vec3 vDir;',
      'void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
    ].join('\n');
    var fs = [
      'varying vec3 vDir;',
      'uniform vec3 uSunDir;',
      'uniform vec3 uZen;',
      'uniform vec3 uHor;',
      'uniform vec3 uSunCol;',
      'void main() {',
      '  vec3 d = normalize(vDir);',
      '  float h = clamp(d.y, -1.0, 1.0);',
      /* 0.50 次方：天际线附近快速转蓝。0.62 时抬头才见蓝，
         而海面视角几乎永远在 0~20° 仰角里 —— 于是整屏天空是灰的（第一版实测）。 */
      '  float t = pow(clamp(h, 0.0, 1.0), 0.42);',
      '  vec3 col = mix(uHor, uZen, t);',
      /* 地平线以下：与雾同色。海面盖住它，只在极远处露出一丝 ——
         如果这里给"另一片天"，地平线上就会出现一条假的色带。 */
      /* 地平线以下压回雾色（海面盖住它）。带宽从 0.10 收到 0.04：
         0.10 时地平线上有一条明显的浅灰带，像一张纸的毛边。 */
      '  col = mix(col, uHor, smoothstep(0.04, -0.02, h));',
      '  float sd = max(dot(d, normalize(uSunDir)), 0.0);',
      '  col += uSunCol * pow(sd, 1200.0) * 2.8;',
      '  col += uSunCol * pow(sd, 22.0) * 0.13;',
      '  col += uSunCol * pow(sd, 3.0) * 0.045 * smoothstep(-0.15, 0.45, h);',
      '  gl_FragColor = vec4(col, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n');
    return new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.20, 0.34, -0.92).normalize() },
        uZen: { value: new THREE.Color(SEA.ZENITH) },
        uHor: { value: new THREE.Color(SEA.HORIZON) },
        uSunCol: { value: new THREE.Color(SEA.SUN) }
      },
      vertexShader: vs, fragmentShader: fs
    });
  }

  function seaOceanMaterial() {
    var vs = [
      'uniform float uTime;',
      'varying vec3 vW;',
      'varying vec3 vN;',
      'varying float vH;',
      seaWaveGlsl(),
      'void main() {',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      '  vec2 g;',
      '  float h = seaH(wp.xz, uTime, g);',
      '  wp.y += h;',
      '  vW = wp.xyz; vH = h;',
      '  vN = normalize(vec3(-g.x, 1.0, -g.y));',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n');
    var fs = [
      'uniform float uTime;',
      'uniform vec3 uSunDir;',
      'uniform vec3 uSunCol;',
      'uniform vec3 uDeep;',
      'uniform vec3 uShallow;',
      'uniform vec3 uSky;',
      'uniform vec3 uZen;',
      'uniform vec3 uFogCol;',
      'uniform float uFogDen;',
      'uniform float uAmp;',
      'varying vec3 vW;',
      'varying vec3 vN;',
      'varying float vH;',
      'float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'float vnoise(vec2 p) {',
      '  vec2 i = floor(p), f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));',
      '  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));',
      '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
      '}',
      'void main() {',
      '  vec3 V = normalize(cameraPosition - vW);',
      /* 高频细节只进法线：顶点 12.5 米一格，2~7 米的浪在几何上根本采不动。
         三组斜向正弦（系数 = 振幅×波数），叠在涌浪法线上。 */
      '  vec2 p = vW.xz;',
      '  vec2 g = vec2(0.0);',
      /* 6 组不同方向的细节波：3 组时法线干涉成"灯芯绒"（第一版实测：整片海是
         一排平行斜纹）。真实的近岸海面是多个方向的浪互相错开的，加方向数最有效。 */
      '  { float ph = 0.70 * dot(p, vec2(0.80, 0.60)) - 1.55 * uTime; g += 0.048 * vec2(0.80, 0.60) * cos(ph); }',
      '  { float ph = 1.13 * dot(p, vec2(-0.62, 0.78)) - 1.95 * uTime; g += 0.030 * vec2(-0.62, 0.78) * cos(ph); }',
      '  { float ph = 1.70 * dot(p, vec2(0.96, -0.28)) - 2.40 * uTime; g += 0.020 * vec2(0.96, -0.28) * cos(ph); }',
      '  { float ph = 2.35 * dot(p, vec2(0.35, -0.94)) - 2.85 * uTime; g += 0.013 * vec2(0.35, -0.94) * cos(ph); }',
      '  { float ph = 3.10 * dot(p, vec2(-0.90, -0.44)) - 3.30 * uTime; g += 0.009 * vec2(-0.90, -0.44) * cos(ph); }',
      '  { float ph = 4.20 * dot(p, vec2(0.12, 0.99)) - 3.90 * uTime; g += 0.006 * vec2(0.12, 0.99) * cos(ph); }',
      /* 细节强度随大尺度噪声起伏：海面不会处处一样"毛"——
         均匀的毛，看上去就是一块有纹路的布（这是第一版最明显的问题）。 */
      '  float rough = 0.55 + 0.85 * vnoise(p * 0.021 + vec2(uTime * 0.02, 0.0));',
      '  g *= rough;',
      /* 太阳"碎金"：真实海面的反光是**无数小面**在闪，不是一整块渐变。
         解析正弦给不了这个（波长再短就采不动），用两个噪声斜率当场抖：
         只在 240 米内生效 —— 远处像素小于波长，抖起来就是噪点（会闪）。 */
      '  float nearK = 1.0 - smoothstep(25.0, 130.0, length(cameraPosition - vW));',
      '  float s1 = vnoise(p * 2.1 + vec2(uTime * 0.55, -uTime * 0.31));',
      '  float s2 = vnoise(p * 3.7 - vec2(uTime * 0.42, uTime * 0.66));',
      '  g += vec2(s1 - 0.5, s2 - 0.5) * 0.20 * nearK;',
      '  vec3 N = normalize(vec3(vN.x - g.x, vN.y, vN.z - g.y));',
      '  float NdV = max(dot(N, V), 0.0);',
      /* Schlick：水的 F0 = 0.02（垂直看是透明的深色，掠射才成镜面） */
      '  float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);',
      '  vec3 R = reflect(-V, N);',
      '  vec3 refl = mix(uSky, uZen, pow(clamp(R.y, 0.0, 1.0), 0.62));',
      '  float sd = max(dot(R, normalize(uSunDir)), 0.0);',
      /* 反射里的太阳：收紧到 420 次幂 —— 260 次时它是一大片白斑，不像反光 */
      '  refl += uSunCol * pow(sd, 420.0) * 0.75;',
      /* 水体：浪尖透光（次表面散射的廉价近似），浪谷更深 */
      '  float crest = clamp(vH / max(uAmp, 0.001) * 0.5 + 0.5, 0.0, 1.0);',
      '  vec3 body = mix(uDeep, uShallow, crest * 0.75);',
      '  body += uSunCol * pow(crest, 7.0) * 0.05;',
      '  vec3 col = mix(body, refl, fres);',
      /* 太阳镜面：窄（720 次幂，一点星芒）+ 宽（64 次幂，一条光带） */
      '  vec3 Hv = normalize(normalize(uSunDir) + V);',
      '  float sh = max(dot(N, Hv), 0.0);',
      /* 太阳镜面：窄项给"星点"，宽项只留一丝 —— 宽项 0.20 时水面上是一块
         像探照灯的白斑（第一版实测），WoWS 那种是一条细碎的金路。 */
      '  col += uSunCol * (pow(sh, 1400.0) * 1.45 + pow(sh, 110.0) * 0.07);',
      /* 白沫：**只长在浪尖上**，用高频噪声调制浓淡。
         ⛔ 这里原来还有一项 `smoothstep(0.74,0.97, vnoise(p*0.42…))` —— 阈值化的
            值噪声会生成 3~5 米大小、边缘圆滑的白斑；近景看就是"水下有个白球
            透过水面"（老板实测：「水面穿模，似乎有个球体在下面」）。
            泡沫必须是**细碎纹理 × 浪尖**，不是一块块圆斑。 */
      /* 两重门槛：浪尖足够高 **且** 噪声足够高 → 零星斑点。
         只用一个门槛时，浪尖的等值线本身就是一块大而圆的区域，
         整片糊上去就像水下的白色球体（老板实测：「似乎有个球体在下面」）。 */
      '  float foamC = smoothstep(0.90, 1.0, crest);',
      '  float fn = vnoise(p * 2.4 + vec2(uTime * 0.45, -uTime * 0.35));',
      '  float foam = foamC * smoothstep(0.55, 0.85, fn) * 0.9;',
      '  col = mix(col, vec3(0.84, 0.91, 0.95), clamp(foam, 0.0, 0.40));',
      /* 雾：公式与 THREE.FogExp2 完全一致，否则水面和军舰会在同一距离上
         变成两种颜色，地平线附近会出现一条谁都不属于的带子 */
      '  float d = length(cameraPosition - vW);',
      '  float fg = 1.0 - exp(-pow(d * uFogDen, 2.0));',
      '  col = mix(col, uFogCol, clamp(fg, 0.0, 1.0));',
      '  gl_FragColor = vec4(col, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n');
    return new THREE.ShaderMaterial({
      fog: false,
      /* ⛔ 必须双面。单面（默认 FrontSide）时，只要相机被一排浪头盖到水面之下
         （低俯角贴着浪看很容易发生），整个海面会"消失"，直接露出天空穹顶的内壁 ——
         屏幕上就是"水面穿模，下面有个大球"（老板实测）。双面兜住这个状态：
         即使真的钻到水下，看到的仍是一层水，不是天空。 */
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.20, 0.34, -0.92).normalize() },
        uSunCol: { value: new THREE.Color(SEA.SUN) },
        uDeep: { value: new THREE.Color(SEA.DEEP) },
        uShallow: { value: new THREE.Color(SEA.SHALLOW) },
        uSky: { value: new THREE.Color(SEA.HORIZON) },
        uZen: { value: new THREE.Color(SEA.ZENITH) },
        uFogCol: { value: new THREE.Color(SEA.HORIZON) },
        uFogDen: { value: SEA.FOG },
        uAmp: { value: SEA_AMP }
      },
      vertexShader: vs, fragmentShader: fs
    });
  }

  /* 烟的贴图（软灰团）：军舰在雾里冒烟，是"这艘船在开"的唯一线索 */
  var _smokeTex = null;
  function smokeSprite(size, op) {
    if (!_smokeTex) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      var g = cv.getContext('2d');
      var rg = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      rg.addColorStop(0.00, 'rgba(196,196,196,0.95)');
      rg.addColorStop(0.45, 'rgba(150,150,150,0.42)');
      rg.addColorStop(1.00, 'rgba(120,120,120,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
      _smokeTex = new THREE.CanvasTexture(cv);
    }
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: _smokeTex, color: 0x9aa1a6, transparent: true, opacity: op == null ? 0.26 : op,
      depthWrite: false, fog: true
    }));
    sp.scale.set(size, size, 1);
    return sp;
  }

  /* 军舰：几百米外只看得到轮廓 —— 基本体拼装就够，比例按真实舰长给 */
  var SEA_SHIP = {
    dd: { len: 118, beam: 11.5, dep: 8.0, tower: 17, turret: 2, funnel: 2, mast: 19 },
    cl: { len: 182, beam: 18.5, dep: 11.5, tower: 26, turret: 3, funnel: 2, mast: 27 },
    bb: { len: 246, beam: 33.0, dep: 15.0, tower: 30, turret: 3, funnel: 2, mast: 34 }
  };
  function seaShip(kind) {
    var K = SEA_SHIP[kind] || SEA_SHIP.cl;
    var g = new THREE.Group();
    /* ⚠️ 必须显式 vertexColors:false：lam() 默认开顶点色（走 mesh() 的几何都带
       bakeAO 的 color 属性），而这里的几何是直接 new 出来的，没有 color 属性，
       开顶点色会读到默认值 (0,0,0) → 整艘船全黑。 */
    var hullMat = lam(0x2f3a45, { roughness: 0.80, metalness: 0.18, vertexColors: false, noMap: true });
    var deckMat = lam(0x6b6557, { roughness: 0.96, vertexColors: false, noMap: true });
    var supMat = lam(0x9aa3aa, { roughness: 0.68, metalness: 0.16, vertexColors: false, noMap: true });
    var darkMat = lam(0x2a3138, { roughness: 0.86, vertexColors: false, noMap: true });

    var L2 = K.len / 2, B2 = K.beam / 2;
    var sh = new THREE.Shape();
    sh.moveTo(-L2, -B2 * 0.92);
    sh.lineTo(L2 * 0.52, -B2);
    sh.quadraticCurveTo(L2 * 0.88, -B2 * 0.82, L2, 0);
    sh.quadraticCurveTo(L2 * 0.88, B2 * 0.82, L2 * 0.52, B2);
    sh.lineTo(-L2, B2 * 0.92);
    sh.closePath();
    var hg = new THREE.ExtrudeGeometry(sh, { depth: K.dep, bevelEnabled: false, curveSegments: 6 });
    hg.rotateX(-Math.PI / 2);          /* 形状在 XY 面 → 立起来：X 是舰长、Z 是舰宽、Y 是吃水 */
    var hull = new THREE.Mesh(hg, hullMat);
    /* 干舷 ≈ 吃水的 54%：0.55 时露出水面的太少，远看就是"一块漂着的板"（截图确认） */
    hull.position.y = -K.dep * 0.46;
    g.add(hull);

    var deckY = K.dep * 0.45;
    var deck = new THREE.Mesh(new THREE.BoxGeometry(K.len * 0.86, 0.5, K.beam * 0.82), deckMat);
    deck.position.set(-K.len * 0.03, deckY + 0.2, 0);
    g.add(deck);

    /* 舰桥（前部）+ 后部甲板室 */
    var bw = K.len * 0.17, bh = K.tower * 0.50, bd = K.beam * 0.70;
    var bridge = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), supMat);
    bridge.position.set(K.len * 0.08, deckY + bh / 2 + 0.4, 0);
    g.add(bridge);
    var bridge2 = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.60, bh * 0.46, bd * 0.66), supMat);
    bridge2.position.set(K.len * 0.09, deckY + bh + bh * 0.23 + 0.4, 0);
    g.add(bridge2);
    var hangar = new THREE.Mesh(new THREE.BoxGeometry(K.len * 0.20, K.tower * 0.22, K.beam * 0.58), supMat);
    hangar.position.set(-K.len * 0.22, deckY + K.tower * 0.11 + 0.4, 0);
    g.add(hangar);

    /* 烟囱 */
    for (var fi = 0; fi < K.funnel; fi++) {
      var fr = K.beam * 0.12;
      var fn = new THREE.Mesh(new THREE.CylinderGeometry(fr * 0.86, fr, K.tower * 0.46, 8), darkMat);
      fn.position.set(K.len * (0.02 - fi * 0.15), deckY + K.tower * 0.23 + 0.4, 0);
      g.add(fn);
      /* 烟：三团往上飘，位置按烟囱给 */
      for (var si = 0; si < 3; si++) {
        var sm = smokeSprite(K.len * (0.22 + si * 0.10), 0.30 - si * 0.06);
        sm.position.set(K.len * (0.02 - fi * 0.15) - si * K.len * 0.035,
          deckY + K.tower * 0.52 + si * K.tower * 0.20, 0);
        g.add(sm);
      }
    }

    /* 桅杆（一根细杆 + 一根横桁）：远看就是"那上面有东西"，尺度感很靠它 */
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, K.mast * 0.5, 6), darkMat);
    mast.position.set(K.len * 0.09, deckY + bh + K.mast * 0.25 + 0.4, 0);
    g.add(mast);
    var yard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, K.beam * 0.5), darkMat);
    yard.position.set(K.len * 0.09, deckY + bh + K.mast * 0.40 + 0.4, 0);
    g.add(yard);

    /* 主炮：炮塔方块 + 两根炮管（朝舰艏） */
    var tr = K.beam * 0.26;
    for (var ti = 0; ti < K.turret; ti++) {
      var tx = (ti === 0) ? K.len * 0.30 : (ti === 1 ? K.len * 0.38 : -K.len * 0.34);
      var tz = (ti === 1) ? -K.beam * 0.24 : (ti === 2 ? K.beam * 0.20 : 0);
      var tb = new THREE.Mesh(new THREE.BoxGeometry(tr * 1.5, tr * 0.72, tr * 1.15), supMat);
      tb.position.set(tx, deckY + tr * 0.42, tz);
      g.add(tb);
      for (var bi = 0; bi < 2; bi++) {
        var br = new THREE.Mesh(new THREE.CylinderGeometry(tr * 0.11, tr * 0.13, tr * 1.7, 6), darkMat);
        br.rotation.z = -Math.PI / 2;
        br.position.set(tx + tr * 1.25, deckY + tr * 0.46, tz + (bi ? 1 : -1) * tr * 0.26);
        g.add(br);
      }
    }
    g.traverse(function (o) { o.castShadow = false; o.receiveShadow = false; });
    g.name = 'ship';
    return g;
  }


  /* 海上浮筏：木板 + 浮桶 + 竿架 —— 钓点必须有个"能站的地方"，
     否则"站在浪里下竿"读起来像是浮空。 */
  function seaRaft(seed) {
    var g = new THREE.Group(), R = rng(seed || 7);
    var wood = lam(0x6b533a), wood2 = lam(0x554431);
    var iron = lam(0x6a3a22, { roughness: 0.9 });
    var dark = lam(0x2a2a2c);
    for (var i = 0; i < 6; i++) {
      var pl = mesh(new THREE.BoxGeometry(0.40, 0.12, 1.9), (i % 2) ? wood : wood2,
        -1.02 + i * 0.41, 0.06, 0);
      pl.rotation.y = (R() - 0.5) * 0.035;
      g.add(pl);
    }
    for (var k = 0; k < 4; k++) {
      var b = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.92, 10), iron,
        (k < 2 ? -0.62 : 0.62), -0.10, (k % 2 ? -0.58 : 0.58));
      b.rotation.z = Math.PI / 2;
      g.add(b);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.4, 6), wood2, 0.95, 0.80, -0.42));
    var rod = mesh(new THREE.CylinderGeometry(0.012, 0.030, 2.3, 5), dark, 1.62, 1.34, -1.05);
    rod.rotation.z = -0.62; rod.rotation.x = 0.26;
    g.add(rod);
    g.add(mesh(new THREE.BoxGeometry(0.66, 0.46, 0.66), wood, -0.62, 0.35, 0.34));
    g.add(mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.22, 8),
      lam(C.glow, { emissive: C.glow, emissiveIntensity: 1.0, noMap: true }), -1.0, 0.86, -0.55));
    return g;
  }

  /* 光照/配色：时段 tint 乘进来（与 applyPhase 的雾色口径完全一致） */
  function seaApplyLight() {
    if (!seaSkyMat || !seaMat) return;
    var ph = PHASES[phaseOf(hourNow())] || PHASES.day;
    var tint = ph.tint;
    var su = seaSkyMat.uniforms, ou = seaMat.uniforms;
    su.uZen.value.setHex(SEA.ZENITH).multiplyScalar(tint);
    su.uHor.value.setHex(SEA.HORIZON).multiplyScalar(tint);
    su.uSunCol.value.setHex(SEA.SUN).multiplyScalar(Math.max(0.30, tint));
    ou.uDeep.value.setHex(SEA.DEEP).multiplyScalar(tint);
    ou.uShallow.value.setHex(SEA.SHALLOW).multiplyScalar(tint);
    ou.uSky.value.setHex(SEA.HORIZON).multiplyScalar(tint);
    ou.uZen.value.setHex(SEA.ZENITH).multiplyScalar(tint);
    ou.uSunCol.value.setHex(SEA.SUN).multiplyScalar(Math.max(0.30, tint));
    /* 雾色必须与 scene.fog（applyPhase 刚设过）逐位相同 ——
       这里用同一份 _fogBase 与同一个 tint 算，天然一致 */
    ou.uFogCol.value.setHex(_fogBase).multiplyScalar(tint);
    ou.uFogDen.value = SEA.FOG;
    _lastPhase = phaseOf(hourNow());
  }

  /* ---------- 海面场景装配 ---------- */
  function buildSeaScene(cfg) {
    seaView = true; cityView = false; frustumH = FRUSTUM_H;
    if (propRoot) { scene.remove(propRoot); propRoot = null; }
    nodeList = []; nearNode = null; waterMesh = null;
    citySolids = []; cityBounds = null;
    seaFloat = []; seaShips = []; seaRipple = []; seaRipT = 0; seaTime = 0;
    propRoot = new THREE.Group();
    scene.add(propRoot);

    _skyBase = SEA.HORIZON; _fogBase = SEA.HORIZON;
    scene.background = new THREE.Color(SEA.HORIZON);
    scene.fog = new THREE.FogExp2(SEA.HORIZON, SEA.FOG);

    /* 相机：透视 + 第三人称环绕。正交是"看棋盘"的镜头 ——
       海面要的是"站在水里往外看"，地平线必须是一条真实的高度线。 */
    if (!seaCam) seaCam = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 7000);
    cam = seaCam;
    seaYaw = 0; seaPitch = 0.26; seaDist = 12.5;
    seaCam.position.set(0, 4.2, seaDist);

    /* 天空穹顶：跟着人平移（不旋转，太阳方向才钉在世界里） */
    seaSky = new THREE.Mesh(new THREE.SphereGeometry(4200, 32, 20), seaSkyMaterial());
    seaSky.name = 'seaSky';
    seaSky.renderOrder = -10;
    seaSky.frustumCulled = false;
    propRoot.add(seaSky);
    seaSkyMat = seaSky.material;

    /* 海面：一块 3 km 的网格，跟人一起平移 —— "无限海"的标准做法。
       波浪按**世界坐标**算，所以平移是无缝的；按格对齐只是为了不让顶点在水面上游。 */
    var og = new THREE.PlaneGeometry(SEA.SIZE, SEA.SIZE, SEA.SEG, SEA.SEG);
    og.rotateX(-Math.PI / 2);
    seaMat = seaOceanMaterial();
    seaMesh = new THREE.Mesh(og, seaMat);
    seaMesh.name = 'sea';
    seaMesh.frustumCulled = false;
    propRoot.add(seaMesh);

    /* 太阳：放在**画面前方偏左** —— 视线正对时能看到一条太阳反光带（WoWS 的招牌画面） */
    var sunDir = new THREE.Vector3(0.20, 0.34, -0.92).normalize();
    seaMat.uniforms.uSunDir.value.copy(sunDir);
    seaSkyMat.uniforms.uSunDir.value.copy(sunDir);
    try {
      LGT.sun.position.copy(sunDir).multiplyScalar(220);
      LGT.sun.castShadow = false;    /* 海面没有地面接影，白跑一遍 shadow pass */
    } catch (e0) { }

    /* 远景军舰：三艘，1600 米内 —— 它们是"这片海有多大"的唯一参照 */
    [{ k: 'cl', x: -300, z: -720, rot: 0.52, spd: 0.55 },
      { k: 'dd', x: 430, z: -900, rot: -0.88, spd: 0.80 },
      { k: 'bb', x: -760, z: -1250, rot: 0.14, spd: 0.38 }].forEach(function (sp) {
      var g = seaShip(sp.k);
      g.position.set(sp.x, 0, sp.z);
      g.rotation.y = sp.rot;
      propRoot.add(g);
      seaShips.push({ g: g, rot: sp.rot, spd: sp.spd, ph: seaShips.length * 2.1 });
    });

    /* 浮在水上的布景（残骸/油桶/箱/芦苇/礁石）：随浪起伏 */
    (cfg.props || []).forEach(function (p) {
      var o = makeProp(p);
      if (!o) return;
      /* 水上不要"接地阴影圆片" —— 那是给陆地用的，漂在浪上像个黑洞 */
      for (var i2 = o.children.length - 1; i2 >= 0; i2--) {
        if (o.children[i2].name === 'cshadow') o.remove(o.children[i2]);
      }
      o.position.set(p.x || 0, 0, p.z || 0);
      if (p.rot) o.rotation.y = p.rot;
      propRoot.add(o);
      seaFloat.push({ obj: o, x: p.x || 0, z: p.z || 0 });
    });

    /* 交互点：动作对齐这一格真实可做的（与陆上场景同一套规矩，一行不改） */
    var _avail = (ctx && ctx.availableActs && ctx.availableActs.length) ? ctx.availableActs.slice() : null;
    if (!_avail) {
      _avail = (G.jianghuActsAt && ctx && ctx.ci != null)
        ? (G.jianghuActsAt(ctx.ci) || []).map(function (a) { return a.id; }) : [];
    }
    var _entryAct = (ctx && ctx.actId) || cfg.act;
    var _fallback = (_avail.indexOf(_entryAct) >= 0) ? _entryAct : (_avail[0] || null);
    (cfg.nodes || []).forEach(function (nd, i) {
      var _use = null;
      if (_avail.indexOf(nd.act) >= 0) _use = nd.act;
      else if (_fallback) _use = _fallback;
      if (!_use) return;
      var q = {}; for (var k in nd) q[k] = nd[k];
      q.act = _use;
      if (q.act !== nd.act) {
        var _ad = (D && D.LING_ACT) ? D.LING_ACT[q.act] : null;
        if (_ad) { q.label = _ad.name; q.hint = _ad.desc || q.hint; }
      }
      if (q.seed == null) q.seed = 100 + i;
      var o = makeProp(q);
      if (!o) return;
      for (var i3 = o.children.length - 1; i3 >= 0; i3--) {
        if (o.children[i3].name === 'cshadow') o.remove(o.children[i3]);
      }
      o.position.set(q.x || 0, 0, q.z || 0);
      if (q.rot) o.rotation.y = q.rot;
      var ring = gNodeRing(C.glow);
      o.add(ring);
      var _gs = glowSprite(C.glow, 2.6, 0.55);
      _gs.position.set(0, 0.55, 0);
      o.add(_gs);
      var _wasDone = S.isDone(cfg.id, i);
      o.userData.node = { idx: i, act: q.act, label: q.label, hint: q.hint, done: _wasDone, ring: ring };
      if (_wasDone) { ring.visible = false; dimProp(o); }
      propRoot.add(o);
      nodeList.push(o);
      seaFloat.push({ obj: o, x: q.x || 0, z: q.z || 0 });
    });

    /* 脚下的涟漪池：走在浪上要给"水被踩到了"的证据 */
    var rg = new THREE.RingGeometry(0.46, 0.60, 22);
    rg.rotateX(-Math.PI / 2);
    for (var ri = 0; ri < 8; ri++) {
      var rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({
        color: 0xe2f1f8, transparent: true, opacity: 0, depthWrite: false
      }));
      rm.name = 'ripple';
      rm.visible = false;
      propRoot.add(rm);
      seaRipple.push({ m: rm, t0: -1 });
    }

    /* 人 */
    player = buildPlayer();
    player.position.set(0, 0, 0);
    /* 水面上不留"接地黑圆片"（那是陆地的读法），但也不能什么都不留 ——
       人站在起伏的浪上，脚与水面的关系需要一个锚点。改成**淡白水花**：
       颜色换成水色、透明度压到 0.18、放大一点，读起来就是"踩起的水纹"。 */
    var _psh = player.getObjectByName('shadow');
    if (_psh) {
      _psh.material.color.setHex(0xdfeef5);
      _psh.material.opacity = 0.12;
      _psh.scale.set(1.15, 1.15, 1.15);
    }
    propRoot.add(player);
    targetPt = null;
    _seaPrev.x = 0; _seaPrev.z = 0;

    seaApplyLight();
    seaCam.position.set(0, 4.2, seaDist);
    seaCam.lookAt(0, 1.6, -6);
    return true;
  }

  /* 海面每帧：时间、跟随、浪高、浮物、军舰、涟漪 */
  function seaTick(dt) {
    if (!seaView || !player) return;
    seaTime += dt;
    var t = seaTime;

    if (seaMesh) {
      /* 按格对齐平移：不对齐的话海水纹理会随相机"游"，像贴图在动 */
      var stp = SEA.SIZE / SEA.SEG;
      seaMesh.position.x = Math.round(player.position.x / stp) * stp;
      seaMesh.position.z = Math.round(player.position.z / stp) * stp;
      seaMat.uniforms.uTime.value = t;
    }
    if (seaSky) seaSky.position.set(player.position.x, 0, player.position.z);

    /* 人站在浪上：与 GPU 同一函数（seaWaveY ←→ seaH），不会踩空。
       抬 0.05：0.10 时脚底与水面之间有一道缝（远看像悬着），0.02 时又像陷进水里。
       剩下那一点点误差（GPU 12.5 米网格插值 vs CPU 精确值）由脚下的
       淡白水花圆片兜住 —— 见 buildSeaScene 里对 'shadow' 的处理。 */
    player.position.y = seaWaveY(player.position.x, player.position.z, t) + 0.05;

    for (var i = 0; i < seaFloat.length; i++) {
      var f = seaFloat[i], o = f.obj;
      o.position.y = seaWaveY(f.x, f.z, t) * 0.9 + 0.04;
      /* 顺着浪面倾斜（取两处高差当坡度）：浮物"浮着"和"立在水上"是两回事 */
      o.rotation.z = (seaWaveY(f.x + 1.4, f.z, t) - seaWaveY(f.x - 1.4, f.z, t)) * 0.5;
      o.rotation.x = (seaWaveY(f.x, f.z + 1.4, t) - seaWaveY(f.x, f.z - 1.4, t)) * -0.5;
    }

    for (var si = 0; si < seaShips.length; si++) {
      var sp = seaShips[si];
      sp.g.position.x += Math.cos(sp.rot) * sp.spd * dt;
      sp.g.position.z -= Math.sin(sp.rot) * sp.spd * dt;
      sp.g.position.y = seaWaveY(sp.g.position.x, sp.g.position.z, t) * 0.22;
      sp.g.rotation.z = Math.sin(t * 0.31 + sp.ph) * 0.010;
    }

    /* 涟漪：走起来才生（0.26 s 一圈），2 秒内扩到 7 倍、淡出 */
    var dx = player.position.x - _seaPrev.x, dz = player.position.z - _seaPrev.z;
    var spd = Math.sqrt(dx * dx + dz * dz) / Math.max(dt, 1e-4);
    _seaPrev.x = player.position.x; _seaPrev.z = player.position.z;
    if (spd > 0.5) {
      seaRipT -= dt;
      if (seaRipT <= 0) {
        seaRipT = 0.34;
        for (var rj = 0; rj < seaRipple.length; rj++) {
          if (seaRipple[rj].t0 < 0) {
            var rq0 = seaRipple[rj];
            rq0.t0 = t;
            rq0.m.position.set(player.position.x,
              seaWaveY(player.position.x, player.position.z, t) + 0.04, player.position.z);
            rq0.m.visible = true;
            break;
          }
        }
      }
    }
    for (var rk = 0; rk < seaRipple.length; rk++) {
      var rq = seaRipple[rk];
      if (rq.t0 < 0) continue;
      var k = (t - rq.t0) / 2.0;
      if (k >= 1) { rq.t0 = -1; rq.m.visible = false; continue; }
      /* 0.6→6.5 倍、0.42 不透明度：实机看着是"一圈圈泳圈"（截图确认）。
         收到 3.6 倍 / 0.20 —— 涟漪只要"水被踩动"的暗示，不是特效。 */
      var sc = 0.55 + k * 3.6;
      rq.m.scale.set(sc, 1, sc);
      rq.m.material.opacity = 0.20 * (1 - k) * (1 - k);
    }
  }

  function updateSeaCamera(dt) {
    if (!player) return;
    var tx = player.position.x, ty = player.position.y + 1.15, tz = player.position.z;
    var cp = Math.cos(seaPitch), sp = Math.sin(seaPitch);
    var px = tx + Math.sin(seaYaw) * seaDist * cp;
    var pz = tz + Math.cos(seaYaw) * seaDist * cp;
    var py = ty + seaDist * sp;
    /* 镜头不许沉到水下：贴水时它会"钻进浪里"，一帧全绿。
       余量给到 1.5 米 —— 0.85 时浪尖（振幅 1.65）仍能盖过镜头。 */
    var wl = seaWaveY(px, pz, seaTime) + 1.5;
    if (py < wl) py = wl;
    var k = Math.min(1, dt * 6.5);
    cam.position.x += (px - cam.position.x) * k;
    cam.position.y += (py - cam.position.y) * k;
    cam.position.z += (pz - cam.position.z) * k;
    /* 看向"人前方 N 米、略高"：人是下三分之一，地平线在上三分之一 ——
       舰游的取景（人小、世界大），远景军舰正好落在画面上缘。
       ⚠️ N 必须随俯角收：固定 6 米时，俯角拉到 1.2（近乎头顶），
       视线会越过人落到他前方，**人自己从画面下缘掉出去**（实测）。 */
    var ahead = 6.0 * Math.max(0, 1 - seaPitch / 0.95);
    cam.lookAt(tx - Math.sin(seaYaw) * ahead, ty + 1.05, tz - Math.cos(seaYaw) * ahead);
  }

  /* ---------- 场景装配 ---------- */
  function buildScene(cfg) {
    /* v157.87：从海面场景回来必须**三件事都复位** —— 换回正交相机、
       恢复主光投影、把主光摆回野外那套位置（海面把它挪到了 220 米外）。 */
    seaView = false;
    cam = orthoCam || cam;
    cityView = false; frustumH = FRUSTUM_H;
    try {
      LGT.sun.castShadow = true;
      LGT.sun.position.set(12, 9, 9);
      LGT.rim.position.set(-9, 5, -11);
    } catch (eSB) { }
    if (propRoot) { scene.remove(propRoot); propRoot = null; }
    nodeList = []; nearNode = null; waterMesh = null;

    /* ============================================================
     * v156.65（老板「类似探索性游戏的曲折场景，从基础框架搭起」）
     * ------------------------------------------------------------
     * `ruin` 场景改为**生成式布局**：scenePlan 出一份纯数据（墙/道具/交互点/连通性），
     * 渲染照着画，碰撞照用同一份 solids。
     * ⚠️ 关键 bug 一并修掉：旧版 buildScene **从不清空 citySolids** ——
     *   从城市场景切到采集场景时，上一次城里的碰撞盒还留着，
     *   玩家会在"空气墙"里被挡住（或反过来穿过真墙）。
     * 其余 9 个场景暂时仍走手写 props（渐进迁移，不一次全改）。
     * ============================================================ */
    var plan = (cfg.id === 'ruin') ? scenePlan(cfg) : null;
    citySolids = plan ? plan.solids : [];
    cityBounds = plan ? plan.bounds : null;
    var useProps = plan ? plan.props : (cfg.props || []);
    var useNodes = plan ? plan.nodes : (cfg.nodes || []);
    propRoot = new THREE.Group();
    scene.add(propRoot);

    /* 天光与雾：改 scene.background / fog 比换材质便宜，一眼就换风格 */
    _skyBase = cfg.sky || 0x8e97a4; _fogBase = cfg.fog || cfg.sky || 0x8e97a4;
    scene.background = new THREE.Color(_skyBase);
    /* v156.67（老板「能做的必须做到底」）：雾从 0.020 加到 0.030 ——
       0.020 时远处几乎不衰减，画面像"贴纸"；0.030 才有纵深，墙根发灰。 */
    /* v156.68c：雾 0.030 → 0.022。
       0.030 在 20 米处透射率只有 ~70%，把刚加进去的纹理和明暗全冲淡了 ——
       画面"雾蒙蒙"不是因为材质不够，是因为雾盖住了。
       0.022 保留纵深（远处墙根发灰），但不吃掉细节。 */
    scene.fog = new THREE.FogExp2(_fogBase, 0.022);

    /* 地面 */
    var kind = (cfg.id === 'forest' || cfg.id === 'field') ? 'grass' : 'ash';
    var gtex = groundTexture(cfg.ground, cfg.seed || 7, kind);
    /* v156.67：纹理必须 repeat —— 256² 拉满 40×40 会糊成一块颜色，
       没有"地面"的尺度感。5×5 让噪点/裂缝回到可读的大小。 */
    gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping;
    gtex.repeat.set(3, 3);
    /* v156.68：地面也换 PBR —— 它是画面占比最大的面，Lambert 的纯漫反射
       在有真阴影之后会显得「影子浮在色块上」。roughness 拉满 1.0（土/尘土无镜面），
       metalness 0（不反光），envMapIntensity 压低到 .35（只吃一点环境色，不自发光）。 */
    var gm = new THREE.MeshStandardMaterial({
      map: gtex, color: 0xffffff, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.35,
      vertexColors: true,   /* v156.68d：大尺度明暗由顶点色给（贴图会重复，顶点色不会） */
      /* v157.87：法线贴图 —— 地面从"一张平图"变成有凹凸的表面（成熟做法，零加面） */
      normalMap: groundNormalTex(cfg.seed || 7),
      normalScale: new THREE.Vector2(0.85, 0.85),
    });
    /* v156.67：**地面要有起伏**。
       旧版是 PlaneGeometry(40,40,1,1) —— 一张绝对平的板，法线全朝上，
       在平行光下就是均匀一片色（这就是"简陋"最大的来源：占 80% 画面的东西没有明暗）。
       现在细分到 48×48 并加 ±0.08 米的低频起伏：
         · 幅度远小于玩家身高（1.8）和墙厚，**不影响行走与碰撞**（碰撞盒是 2D 的）；
         · computeVertexNormals 后，坡面会接光/背光 → 立刻有"地"的质感。
       ⚠️ PlaneGeometry 在 XY 平面，`rotation.x = -PI/2` 之后：
          局部 Z（法线方向）→ 世界 Y（高度），所以位移写在 setZ。 */
    /* v157.87：48×48 → 96×96。顶点色承担"大尺度明暗"，格子越密，
       这片地上"湿/干/踩实"的过渡越连续；48 格时大约 0.83 米一个顶点，
       近景能看出插值的直线段。96 格 = 0.42 米，配合法线贴图就够了。 */
    var gGeo = new THREE.PlaneGeometry(40, 40, 96, 96);
    (function () {
      var _pa = gGeo.attributes.position, _Rg = rng((cfg.seed || 7) + 3311);
      /* ============================================================
       * v156.68d：**地面的大尺度变化改由顶点色承担**。
       * ------------------------------------------------------------
       * 之前把「大色斑 / 污渍团」画进贴图，而贴图要 repeat(3,3) ——
       * 于是同一个形状在地面上重复 9 次，森林/湖畔那种浅色地上
       * 看起来像一片「形状相同的云影」，规律性一眼可见（截图确认）。
       *
       * 贴图**必然**重复，这消不掉。正确分工是：
       *   大尺度（几十米级的明暗起伏）→ **顶点色**，逐顶点算，天然不重复
       *   小尺度（颗粒、裂缝、板缝）    → 贴图 repeat
       * 三层正弦 + 一层随机，得到 0.74~1.06 的亮度乘子 ——
       * 足够看出「这片湿、那片干」，但不会像贴了一张斑马图。
       * ============================================================ */
      var _cols = new Float32Array(_pa.count * 3);
      for (var i = 0; i < _pa.count; i++) {
        var _x = _pa.getX(i), _y = _pa.getY(i);
        var _h = Math.sin(_x * 0.33 + 1.7) * 0.170
               + Math.cos(_y * 0.41 - 0.9) * 0.140
               /* v157.87：叠一层 3 米级的微起伏。幅度 2 厘米 ——
                  只够让法线贴图"有几何支撑"（贴图骗出来的凹凸遇到掠射光会穿帮），
                  又远小于脚高与碰撞（碰撞是 2D 的，完全不受影响）。 */
               + Math.sin(_x * 1.9 + _y * 2.6) * 0.020
               + (_Rg() - 0.5) * 0.060;
        _pa.setZ(i, _h);
        var _n1 = Math.sin(_x * 0.19 + 1.3) * Math.cos(_y * 0.15 - 0.7);
        var _n2 = Math.sin(_x * 0.44 - 2.1) * Math.cos(_y * 0.37 + 1.1);
        var _n3 = Math.sin((_x + _y) * 0.09 + 0.5);
        /* 幅度 0.86 ± 0.23：贴图的大色斑删掉之后，0.90±0.17 显得太空，
           加大到能看出「这块偏湿、那块偏干」，同时仍远小于物体自身的明暗。 */
        var _k = 0.86 + _n1 * 0.105 + _n2 * 0.055 + _n3 * 0.075;
        if (_k < 0.66) _k = 0.66; if (_k > 1.10) _k = 1.10;
        _cols[i * 3] = _k; _cols[i * 3 + 1] = _k; _cols[i * 3 + 2] = _k;
      }
      gGeo.setAttribute('color', new THREE.BufferAttribute(_cols, 3));
      gGeo.computeVertexNormals();
    })();
    var ground = new THREE.Mesh(gGeo, gm);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;      /* v156.68：地面是唯一接影的面，必须开 */
    ground.castShadow = false;        /* 自己不投影（否则起伏会自影成脏斑） */
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
      /* v156.68c：水面从 Lambert 换 Standard —— 水是「最低粗糙度 + 吃环境反射」的典型，
         用纯漫反射材质画水，永远是"一块深蓝色的板"。
         roughness 0.08 近乎镜面，envMapIntensity 1.6 让它映出天空与太阳斑。 */
      var wm = new THREE.MeshStandardMaterial({
        color: C.water, roughness: 0.08, metalness: 0.12, envMapIntensity: 1.6,
        transparent: true, opacity: 0.92, vertexColors: false,
      });
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
      /* ============================================================
       * v157.87（老板「地面更精细化」）：散落物 34 个 Mesh → 2 个 InstancedMesh
       * ------------------------------------------------------------
       * 34 个独立 Mesh = 34 次 draw call，密不起来（再密就是几百次）。
       * InstancedMesh 是 three 的标准做法：同一个几何 + 同一个材质，
       * 一次 draw 画 N 个 —— 于是**能从 34 个加到 370 个**，
       * 反而比原来更省。近景的"地面有东西"全靠这一层。
       * ============================================================ */
      /* ⚠️ 碎石不能用 C.steel（亮蓝灰的钢）：在土色地面上是一地**蓝色纸屑**。
         石头就该是石头色，比地面略冷、略深，靠明暗读出来。 */
      var tuftMat = lam(cfg.id === 'field' ? C.wheat : 0x5f7048);
      var pebbleMat = lam(0x6a6358, { roughness: 0.98 });
      var _layers = [
        { geo: new THREE.DodecahedronGeometry(0.075, 0), n: 190, mat: pebbleMat, y0: 0.02, y1: 0.06, s0: 0.55, s1: 1.35 },
        { geo: new THREE.ConeGeometry(0.070, 0.28, 3), n: 150, mat: tuftMat, y0: 0.12, y1: 0.19, s0: 0.6, s1: 1.5 }
      ];
      _layers.forEach(function (Ly) {
        bakeAO(Ly.geo);
        var im = new THREE.InstancedMesh(Ly.geo, Ly.mat, Ly.n);
        im.castShadow = false; im.receiveShadow = true;
        var mtx = new THREE.Matrix4(), qt = new THREE.Quaternion();
        var sc3 = new THREE.Vector3(), p3 = new THREE.Vector3(), eu = new THREE.Euler();
        var put = 0;
        for (var k = 0; k < Ly.n * 3 && put < Ly.n; k++) {
          var x = (R() - 0.5) * 26, z = (R() - 0.5) * 26;
          /* 水面上不长草（旧 lake 场景的规矩，留着不至于让草浮在湖里） */
          if (cfg.water && z < -1.2 && Ly.mat === tuftMat) continue;
          eu.set(0, R() * 6.283, 0); qt.setFromEuler(eu);
          var sc = Ly.s0 + R() * (Ly.s1 - Ly.s0);
          sc3.set(sc, sc * (0.78 + R() * 0.55), sc);
          p3.set(x, Ly.y0 + R() * (Ly.y1 - Ly.y0), z);
          mtx.compose(p3, qt, sc3);
          im.setMatrixAt(put++, mtx);
        }
        im.count = put;
        im.instanceMatrix.needsUpdate = true;
        propRoot.add(im);
      });
    })();

    /* ============================================================
     * v156.67 浮尘（空气里的颗粒）
     * ------------------------------------------------------------
     * 废土场景缺"空气"就会像沙盘：干净、静止、没有纵深。
     * 240 个半透明小点，确定性散布在场景上空 0.3~3.5 米，
     * 靠 animWorld 里整体缓慢平移 + 上下浮动来"飘"（不逐点动画，省 CPU）。
     * depthWrite:false —— 粒子之间不互相遮挡，避免边缘发黑。
     * ============================================================ */
    (function () {
      var N = 240, pos = new Float32Array(N * 3), Rr = rng((cfg.seed || 7) + 771);
      for (var i = 0; i < N; i++) {
        pos[i * 3] = (Rr() - 0.5) * 28;
        pos[i * 3 + 1] = 0.3 + Rr() * 3.2;
        pos[i * 3 + 2] = (Rr() - 0.5) * 28;
      }
      var dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var dm = new THREE.PointsMaterial({
        color: 0xd8cdb4, size: 0.06, transparent: true, opacity: 0.45,
        sizeAttenuation: true, depthWrite: false, fog: true,
      });
      var du = new THREE.Points(dg, dm);
      du.name = 'dust';
      propRoot.add(du);
    })();

    /* 装饰 */
    useProps.forEach(function (p) {
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

    useNodes.forEach(function (nd, i) {
      var _use = null;
      if (_avail.indexOf(nd.act) >= 0) _use = nd.act;
      else if (_fallback) _use = _fallback;
      if (!_use) return;                     /* 这格今天什么都不能做 → 不建节点 */
      nd = (function (q) { var o = {}; for (var k in q) o[k] = q[k]; o.act = _use; return o; })(nd);
      /* 动作被改写时，标签必须跟着改 ——
         实测：节点写「翻找碎石堆」，代理成 `bai` 之后结果卡是「拜访 · 行商的水囊」，
         两句话对不上，玩家只会觉得系统乱了。宁可让标签朴素一点，也不能说一套做一套。 */
      if (nd.act !== (useNodes[i] || {}).act) {
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
      /* v156.68c：交互点加辉光 —— 正交俯视下，一块发光的地面标记不够"亮"，
         加一层 additive 光晕才有「这里能动手」的视觉焦点。 */
      var _gs = glowSprite(C.glow, 2.2, 0.55);
      _gs.position.set(0, 0.55, 0);
      o.add(_gs);
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
    if (plan && plan.spawn) player.position.set(plan.spawn.x, 0, plan.spawn.z);
    else player.position.set(0, 0, 4.5);
    propRoot.add(player);

    targetPt = null;
    /* v156.65b：相机初始位置要**对齐出生点**。
       旧版硬编码 (0,18,18) 看向原点 —— 生成式布局的出生点可能在侧面/角落，
       开场就会看到"地面一角 + 大片天空"（截图确认）。
       这里按跟随逻辑同一口径（后方 +10、看向前方 -7）直接就位，之后交给 updateCamera 接管。

       ⚠️ v156.66：上面这段注释一度和代码不一致（注释说要对齐，代码写死 (0,18,18)），
       因为中途"恢复原取景"只改了代码没改注释。实测 player(-12,-10) + cam(0,18,18)
       → 相机在 20 米外看原点，画面只剩地面边缘。现在代码与注释一致。 */
    var _sx = (plan && plan.spawn) ? plan.spawn.x : 0;
    var _sz = (plan && plan.spawn) ? plan.spawn.z : 4.5;
    cam.position.set(_sx, 18, _sz + 10);
    cam.lookAt(_sx, 0.6, _sz - 7);
    resize();
  }


  /* ============================================================
   * v157.87 · 程序化人形（老板「创建一个人」）
   * ------------------------------------------------------------
   * ⛔ 为什么**不用** assets/actors/Soldier.glb：
   *   它的蒙皮空间是坏的（网格 0.003 单位 / 骨骼 1.5 单位，差三个数量级）。
   *   实测隔离截图（关掉海面与天空、灰底）：渲染出来是**几片碎三角形的残骸**，
   *   不是人形；把 clip 停掉也一样。`js/duel3d.js` 早就因为同一原因把
   *   `CLIP_ON` 长期关着。把「创建一个人」建立在渲染不出人形的资产上是不行的。
   *
   * 做法：基本体拼一副**分层骨架**（髋 → 躯干 → 头 / 肩 → 上臂 → 前臂 / 髋 → 腿 → 膝），
   *   关节全是 THREE.Group，转关节就是摆姿势。无骨骼资产的标准替代，
   *   也是低模游戏最常见的做法（成本 = 十几个盒子，一次 draw 一轮）。
   * 尺寸按成年男性：总高 ≈1.78（腿 0.90 / 躯干 0.55 / 头 0.24）。
   * ============================================================ */
  var playerRig = null;
  function buildPerson() {
    var g = new THREE.Group();
    g.name = 'person';
    var skin = lam(0xc79a78);
    var coat = lam(0x6d5b41);
    var coat2 = lam(0x584a35);
    var pants = lam(0x3c424c);
    var boot = lam(0x2a2a2c, { roughness: 0.68 });
    var packM = lam(0x4c4536);
    var glowM = lam(C.glow, { emissive: C.glow, emissiveIntensity: 0.9, noMap: true });

    function box(w, h, d, mat, x, y, z) {
      return mesh(new THREE.BoxGeometry(w, h, d), mat, x || 0, y || 0, z || 0);
    }

    var hip = new THREE.Group();
    hip.position.set(0, 0.90, 0);
    g.add(hip);

    var torso = new THREE.Group();
    hip.add(torso);
    torso.add(box(0.40, 0.50, 0.24, coat, 0, 0.27, 0));       /* 胸腔 */
    torso.add(box(0.34, 0.14, 0.22, coat2, 0, 0.02, 0));      /* 腰 */
    torso.add(box(0.37, 0.09, 0.25, pants, 0, -0.06, 0));     /* 皮带 */
    /* 胸口的辐能核心：一个会呼吸的小灯，远处也能认出"那是个人" */
    var core = mesh(new THREE.SphereGeometry(0.045, 10, 8), glowM, 0.085, 0.37, 0.125);
    core.name = 'core';
    torso.add(core);
    torso.add(box(0.30, 0.34, 0.16, packM, 0, 0.30, -0.19));  /* 背包 */
    torso.add(box(0.10, 0.12, 0.06, coat2, 0, 0.44, -0.27));

    torso.add(box(0.11, 0.09, 0.11, skin, 0, 0.555, 0));      /* 脖子 */
    var head = new THREE.Group();
    head.position.set(0, 0.60, 0);
    torso.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.115, 14, 12), skin, 0, 0.10, 0));
    head.add(box(0.25, 0.055, 0.24, coat2, 0, 0.19, 0));      /* 帽 */
    head.add(box(0.22, 0.045, 0.03, glowM, 0, 0.125, 0.108)); /* 护目镜 */

    function arm(side) {
      var sh = new THREE.Group();
      sh.position.set(side * 0.235, 0.46, 0);
      torso.add(sh);
      sh.add(box(0.115, 0.30, 0.125, coat, 0, -0.15, 0));
      var el = new THREE.Group();
      el.position.set(0, -0.30, 0);
      sh.add(el);
      el.add(box(0.10, 0.28, 0.105, coat2, 0, -0.14, 0));
      el.add(box(0.10, 0.10, 0.11, skin, 0, -0.31, 0));
      return { sh: sh, el: el };
    }
    var armL = arm(-1), armR = arm(1);

    function leg(side) {
      var hp = new THREE.Group();
      hp.position.set(side * 0.105, 0, 0);
      hip.add(hp);
      hp.add(box(0.155, 0.44, 0.17, pants, 0, -0.22, 0));
      var kn = new THREE.Group();
      kn.position.set(0, -0.44, 0);
      hp.add(kn);
      kn.add(box(0.135, 0.40, 0.155, pants, 0, -0.20, 0));
      kn.add(box(0.155, 0.10, 0.27, boot, 0, -0.43, 0.05));
      return { hp: hp, kn: kn };
    }
    var legL = leg(-1), legR = leg(1);

    playerRig = { g: g, hip: hip, torso: torso, head: head,
      armL: armL, armR: armR, legL: legL, legR: legR, core: core };
    return g;
  }

  /* 走/站两套姿态。moving=0/1；t 是秒。
     三个细节是"像人在走"的关键：① 髋的上下起伏 ② 躯干前倾+扭转 ③ 手臂反相摆。 */
  function personAnim(t, moving) {
    var R = playerRig;
    if (!R) return;
    var w = t * (moving ? 7.4 : 1.5);
    var amp = moving ? 0.62 : 0.03;
    var sw = Math.sin(w);
    R.legL.hp.rotation.x = sw * amp;
    R.legR.hp.rotation.x = -sw * amp;
    R.legL.kn.rotation.x = Math.max(0, -Math.sin(w - 0.5)) * amp * 2.1;
    R.legR.kn.rotation.x = Math.max(0, Math.sin(w - 0.5)) * amp * 1.6;
    R.armL.sh.rotation.x = -sw * amp * 0.85;
    R.armR.sh.rotation.x = sw * amp * 0.85;
    R.armL.sh.rotation.z = 0.10 + (moving ? 0.02 : 0.05);
    R.armR.sh.rotation.z = -0.10 - (moving ? 0.02 : 0.05);
    R.armL.el.rotation.x = -0.18 - (moving ? 0.28 : 0.06);
    R.armR.el.rotation.x = -0.18 - (moving ? 0.28 : 0.06);
    R.hip.position.y = 0.90 + (moving ? Math.abs(sw) * 0.035 : Math.sin(t * 1.6) * 0.008);
    R.torso.rotation.x = moving ? 0.07 : 0.02;
    R.torso.rotation.y = sw * 0.07;
    R.head.rotation.y = -sw * 0.05;
    if (R.core && R.core.material) R.core.material.emissiveIntensity = 0.7 + Math.sin(t * 2.2) * 0.25;
  }

  function buildPlayer() {
    var g = new THREE.Group();
    /* v157.87：**程序化人形**（1.78 米，带关节）—— 原先这里是"方块人 + 加载
       Soldier.glb 后整体隐藏"。Soldier 的蒙皮坏了（渲染出来是碎片），
       所以改成人形骨架 + 程序化步态，见 buildPerson 的注释。 */
    var fig = buildPerson();
    fig.name = 'fig';
    g.add(fig);
    /* 脚下影子（一个压扁的暗圆）：没有阴影贴图时，它仍是"站在地上"的关键提示 */
    var sh = mesh(new THREE.CircleGeometry(0.36, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }), 0, 0.015, 0);
    sh.rotation.x = -Math.PI / 2; sh.name = 'shadow'; g.add(sh);
    /* 头顶指示三角（穿透遮挡，永远可见） */
    /* v157.87：0.17/0.30 的三角在第三人称近景里比头还大（截图很明显），
       收到 0.10/0.20 —— 是"指一下"，不是"顶个牌子" */
    var mk = mesh(new THREE.ConeGeometry(0.10, 0.20, 4), new THREE.MeshBasicMaterial({ color: C.glow }),
      0, 1.66, 0);
    mk.rotation.x = Math.PI;         /* 尖朝下 */
    mk.name = 'marker';
    g.add(mk);
    /* 头顶标记**穿透遮挡**（只有它，不含身体）。 */
    mk.material.depthTest = false;
    mk.material.depthWrite = false;
    mk.renderOrder = 999;
    /* ⛔ v157.87：原来这里会异步加载 Soldier.glb 并把方块人藏掉。
       该资产的蒙皮空间是坏的（渲染结果是碎片，见 buildPerson 注释），
       所以整条 gltf 分支删除 —— 玩家模型只有一个来源：程序化人形。
       `playerActor` 保留为 null（step 里的 skill 分支据此走程序化步态那条）。 */
    playerActor = null;
    mk.position.y = 1.86;             /* 人形头顶 1.72 + 一点余量 */
    return g;
  }

  /* ---------- 输入 ---------- */
  function onKeyDown(e) {
    if (!openId) return;
    var k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); S.close(); return; }
    if (k === 'e' || k === 'E' || k === 'Enter') { e.preventDefault(); e.stopPropagation(); S.interact(); return; }
    /* 海面尺度大，走起来要有"跑"（Shift）—— 只记状态，不抢默认行为 */
    if (k === 'Shift') { keys['Shift'] = true; return; }
    if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(k) >= 0) {
      keys[k] = true;
      playerActing = false; clearDuelFoe();   /* 玩家一动，蹲下/斗将姿态即解除 */
      e.preventDefault(); e.stopPropagation();
    }
  }

  function onPointerDown(ev) {
    if (!openId) return;
    /* 海面：按下不立刻判定"点地走" —— 先记下来。
       拖动 = 转视角；没移动过就松手 = 点水面走过去。
       （旧版直接 raycast，"想转镜头"会被当成"想跑过去"，人一拖就乱走。） */
    if (seaView) {
      seaDrag = { x: ev.clientX, y: ev.clientY, moved: 0 };
      return;
    }
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

  /* ---------- 海面：环绕镜头（拖） / 远近（滚轮） / 点水面走过去 ---------- */
  function onPointerMove(ev) {
    if (!seaView || !seaDrag) return;
    var dx = ev.clientX - seaDrag.x, dy = ev.clientY - seaDrag.y;
    seaDrag.x = ev.clientX; seaDrag.y = ev.clientY;
    seaDrag.moved += Math.abs(dx) + Math.abs(dy);
    if (seaDrag.moved <= 4) return;       /* 手抖不算拖 */
    seaYaw -= dx * 0.0062;
    /* 俯角夹住：0.02 是"几乎贴水面往前看"，1.20 是"俯视到自己头顶" ——
       越过这两端，画面要么钻进水里、要么变成看地板。 */
    seaPitch = Math.max(0.02, Math.min(1.20, seaPitch + dy * 0.0045));
  }
  function onPointerUp(ev) {
    if (!seaView || !seaDrag) return;
    var d = seaDrag; seaDrag = null;
    if (d.moved > 6) return;              /* 拖过 = 转镜头，不当作点击 */
    if (!player || !cam) return;
    var r = cvs.getBoundingClientRect();
    var nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
    var ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
    var ray = new THREE.Raycaster();
    ray.setFromCamera({ x: nx, y: ny }, cam);
    /* 水面按 y=0 的平面算（浪高 ±1.6 米，取平均面就够 —— 点哪儿走到哪儿） */
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    var pt = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, pt)) return;   /* 点到天上：不动作 */
    targetPt = {
      x: Math.max(-SEA.BOUND, Math.min(SEA.BOUND, pt.x)),
      z: Math.max(-SEA.BOUND, Math.min(SEA.BOUND, pt.z)),
      node: null
    };
  }
  function onWheel(ev) {
    if (!seaView) return;
    ev.preventDefault();
    var step = Math.max(-3.5, Math.min(3.5, ev.deltaY * 0.012));
    seaDist = Math.max(5, Math.min(45, seaDist + step));
  }

  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

  /* ---------- 每帧 ---------- */
  function step(now) {
    if (!openId) return;
    rafId = requestAnimationFrame(step);
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    /* v143：跨时段重算光照（phaseOf 是纯算术，不变就不 apply —— 近零成本） */
    if (_lastPhase !== phaseOf(hourNow())) applyPhase();

    if (player) {
      var vx = 0, vz = 0;
      if (keys['w'] || keys['W'] || keys['ArrowUp']) vz -= 1;
      if (keys['s'] || keys['S'] || keys['ArrowDown']) vz += 1;
      if (keys['a'] || keys['A'] || keys['ArrowLeft']) vx -= 1;
      if (keys['d'] || keys['D'] || keys['ArrowRight']) vx += 1;
      var moving = false;
      /* v157.87：海面速度更快（6.0 / 跑 13.5）—— 同一套按键，尺度不同 */
      var _spd = seaView ? ((keys['Shift'] || keys['shift']) ? SEA.RUN : SEA.SPEED) : SPEED;
      if (vx || vz) {
        targetPt = null;                     /* 手动走动会取消点击寻路 */
        playerActing = false;                /* 走动即取消"蹲下采集" */
        var len = Math.sqrt(vx * vx + vz * vz);
        var _ux = vx / len, _uz = vz / len;
        if (seaView) {
          /* **相机相对移动**：环绕镜头下 W 必须永远是"往画面里走"。
             直接沿用世界轴（W = -z）会变成"镜头转到哪，键位就错到哪"。 */
          var _fx = -Math.sin(seaYaw), _fz = -Math.cos(seaYaw);
          var _rx = Math.cos(seaYaw), _rz = -Math.sin(seaYaw);
          var _mx = _rx * _ux + _fx * (-_uz);
          var _mz = _rz * _ux + _fz * (-_uz);
          var _ml = Math.sqrt(_mx * _mx + _mz * _mz) || 1;
          _ux = _mx / _ml; _uz = _mz / _ml;
        }
        movePlayer(_ux * _spd * dt, _uz * _spd * dt);
        moving = true;
      } else if (targetPt) {
        var dx = targetPt.x - player.position.x, dz = targetPt.z - player.position.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 0.18) {
          var nd0 = targetPt.node; targetPt = null;
          if (nd0) S.interact(nd0);
        } else {
          var stp = Math.min(d, _spd * dt);
          movePlayer(dx / d * stp, dz / d * stp);
          moving = true;
        }
      } else if (!playerActor) {
        /* 站住：身体回正。⚠️ 海面的 y 由浪高接管（seaTick），这里不能往下压 */
        player.rotation.z *= 0.85;
        if (!seaView) player.position.y += (0 - player.position.y) * 0.2;
      }
      /* v157.87：程序化人形的姿态（走 / 站）—— 每帧一次，十几个关节的赋值 */
      personAnim(now / 1000, moving ? 1 : 0);
      /* 骨骼角色：每帧推进 mixer + 按状态切动作（walk/idle/sit/attack） */
      if (playerActor) {
        if (moving) playerActor.skill('walk');
        else if (duelActive && duelFoeActor) playerActor.skill('attack');
        else if (playerActing) playerActor.skill('sit');
        else playerActor.skill('idle');
        playerActor.update(dt);
      }
      /* 敌方斗将：同步推进它的动作 */
      if (duelFoeActor) duelFoeActor.update(dt);
    }
    /* 海面：时间/跟随/浪高/浮物/军舰/涟漪（必须在移动之后跑，人才踩在浪上） */
    if (seaView) seaTick(dt);

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
    /* v143.2：行人巡逻（城内场景才有；night 隐藏是 stepNpcs 内部判的） */
    if (cityView) stepNpcs(dt, now);
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
    /* ============================================================
     * v156.66（老板「做吧，做到你认为在你的范围内改无可改」）
     * ------------------------------------------------------------
     * ⛔ 旧版把碰撞整个包在 `if (cityView && cityBounds)` 里面 ——
     *   也就是说**只有城市场景才做碰撞**，采集/废墟场景 cityView=false，
     *   走的是下面的 else 分支：只夹边界，不查 solids。
     *   实测：废墟场景里朝墙走 2 秒，玩家从 x=-2.5 穿到 -7.37（墙在 -4.5）。
     *   于是"曲折布局"只是贴图，玩家可以直线穿过去 —— 等于没做。
     *
     * 现在：边界与碰撞**分开**。
     *   · 边界：城用 cityBounds、野外用 ±BOUND；
     *   · 碰撞：只要 solids 非空就查（hitsSolid 在空数组上返回 false，
     *     所以森林/田野这些没有墙的场景行为不变）。
     * 仍然**分轴**推进：正面撞墙时另一轴还能走 → 贴着墙根侧滑，不是原地卡死。
     * ============================================================ */
    var bd = cityView ? cityBounds : null;
    if (bd) {
      nx = Math.max(bd.x0, Math.min(bd.x1, nx));
      nz = Math.max(bd.z0, Math.min(bd.z1, nz));
    } else {
      /* v157.87：海面可走 ±480 米（40 米见方的场子会让人觉得"这就是个池子"） */
      var _bd2 = seaView ? SEA.BOUND : BOUND;
      nx = Math.max(-_bd2, Math.min(_bd2, nx));
      nz = Math.max(-_bd2, Math.min(_bd2, nz));
    }
    if (!hitsSolid(nx, player.position.z, CITY_R)) player.position.x = nx;
    if (!hitsSolid(player.position.x, nz, CITY_R)) player.position.z = nz;
    /* 朝向：把身体绕 Y 转到移动方向（影子不动） */
    var ang = Math.atan2(dx, dz);
    player.rotation.y += (ang - player.rotation.y) * 0.25;
  }

  /* ⛔ v157.87：`bobWalk`（方块人的上下晃动）删除 —— 姿态改由 `personAnim`
     驱动关节，玩家身上再叠一层整体位移会打架。 */

  var cityView = false;
  function updateCamera(dt) {
    if (!player) return;
    if (seaView) { updateSeaCamera(dt); return; }
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
      } else if (o.name === 'glow') {
        o.material.opacity = 0.44 + Math.sin(now * 0.0024 + o.id) * 0.17;
      } else if (o.name === 'core') {
        var k2 = 1 + Math.sin(now * 0.004) * 0.06;
        o.scale.set(k2, k2, k2);
        o.rotation.y += 0.004;
      } else if (o.name === 'dust') {
        /* v156.67：浮尘整体飘 —— 不逐点算（240 点每帧算太贵），
           让整团缓慢升降 + 极慢自转，靠视差就有"空气在动"的错觉。 */
        o.position.y = Math.sin(now * 0.00035) * 0.18;
        o.rotation.y = now * 0.000018;
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
  /* ============================================================
   * v143：时段光照（晨 / 昼 / 昏 / 夜）
   * ------------------------------------------------------------
   * 为什么：10 个场景再好看，天永远是亮的也就少了"过日子"的感觉。
   *   星露谷那种沉浸感，一半是昼夜循环给的。
   * 怎么做：**不改任何场景配置**，只按游戏内小时改三盏灯的色/强，
   *   天光与雾乘一个 tint（本色 × 系数）。数据归数据，呈现归呈现。
   * 性能：phaseOf 是纯算术，每帧判"变没变"近零成本；只有跨时段才 apply。
   * ============================================================ */
  /* v156.68b：**四组光参按 PBR 重新标定**。
     ------------------------------------------------------------
     起因：老板说「渲染太幼稚」。我先查了实际数值 ——
     sun.intensity 实测 **0.16**（我设的是 2.25），因为 applyPhase() 会覆盖它。
     而 0.16 是「夜」档的旧值，同时 ambI 给到 0.30 —— **主光比环境光还弱**。
     环境光主导 = 所有面一样亮 = 没有明暗 = 没有体积 = 一片灰。
     这不是"参数没调好"，是**旧参数是为 Lambert 标的**：
     Lambert 只有漫反射，光强 1.15 已经很亮；PBR 要按同样的照度给到 2.5+。

     新的配比原则：**主光主导，环境只补色**。
       day   sun 2.60 / amb 0.08  → 强侧光，明暗面清晰，阴影实
       dawn  sun 1.70 / amb 0.10  → 低角度暖光，长影
       dusk  sun 1.55 / amb 0.10  → 更红更低
       night sun 0.55 / amb 0.10  → 月光（冷），仍能看出轮廓与投影
     夜晚旧值 sunI 0.16 太暗、ambI 0.30 太亮，等于"没有光源的灰色世界"。
     ============================================================ */
  var PHASES = {
    night: { sun: 0x93a9d6, sunI: 0.55, ambI: 0.10, rim: 0x4a6a9a, rimI: 0.30, tint: 0.52 },
    dawn:  { sun: 0xffb37a, sunI: 1.70, ambI: 0.10, rim: 0x8fa8c8, rimI: 0.42, tint: 0.88 },
    day:   { sun: 0xfff1d8, sunI: 2.60, ambI: 0.08, rim: 0x9fc4d8, rimI: 0.62, tint: 1.0 },
    dusk:  { sun: 0xff8a4a, sunI: 1.55, ambI: 0.10, rim: 0x7a6a9a, rimI: 0.45, tint: 0.84 }
  };
  /* 时段划分（游戏内小时）：0~5 夜 · 6~10 晨 · 11~16 昼 · 17~19 昏 · 20~23 夜 */
  function phaseOf(hour) {
    var h = ((hour % 24) + 24) % 24;
    if (h < 6) return 'night';
    if (h < 11) return 'dawn';
    if (h < 17) return 'day';
    if (h < 20) return 'dusk';
    return 'night';
  }
  function hourNow() {
    return ((((G.state || {}).world || {}).elapsed || 0) % 86400) / 3600;
  }
  function applyPhase() {
    var ph = PHASES[phaseOf(hourNow())];
    if (!ph || !LGT || !scene) return;
    try {
      LGT.sun.color.setHex(ph.sun); LGT.sun.intensity = ph.sunI;
      LGT.amb.intensity = ph.ambI;
      LGT.rim.color.setHex(ph.rim); LGT.rim.intensity = ph.rimI;
      if (scene.background && scene.background.set) {
        scene.background.setHex(_skyBase).multiplyScalar(ph.tint);
      }
      if (scene.fog && scene.fog.color && scene.fog.color.set) {
        scene.fog.color.setHex(_fogBase).multiplyScalar(ph.tint);
      }
    } catch (e) { /* 观测层不许影响玩法 */ }
    /* v157.87：海面的天空/海水/雾色是 shader uniform，要跟着时段一起走
       （不然天一黑，陆上是夜、海上还是正午） */
    if (seaView) seaApplyLight();
    _lastPhase = phaseOf(hourNow());
  }

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
      : (openId === 'pv'
        ? { name: '建造预览', sub: '这是它建成后的样子 —— 左右是邻格参照物' }
        : (sceneCfg(openId) || {}));
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
      + ((openId === 'city' || openId === 'pv' || nodesTotal === 0) ? '' : ('　<b style="color:var(--green-ok);">' + nodesDone + '/' + nodesTotal + '</b> 处已收拾'))
      /* v143：野地等级（难度/收益倍率都乘在它上 —— 与地块界面同一口径）。
         正式/序章两宿主都有；城市场景没有这个概念，不显示。 */
      + ((ctx && ctx.lv != null && openId !== 'city') ? ('　<b style="color:var(--gold-light);">野地 Lv' + ctx.lv + '</b>') : '')
      + '</div>'
      + '</div>'
      /* 交互提示条放底部中间：视线在场景中心，提示不该在角落 */
      + '<div style="position:absolute;left:50%;bottom:52px;transform:translateX(-50%);'
      + 'padding:7px 16px;border-radius:6px;background:rgba(10,12,16,.86);border:1px solid '
      + (nd ? 'var(--gold-light)' : 'var(--line)') + ';color:' + (nd ? 'var(--gold-light)' : 'var(--text-dim)')
      + ';font-size:var(--fs-body);white-space:nowrap;">'
      + (nd ? ('<b>[E]</b> ' + U.escape(nd.label || '动手') + '　<span style="opacity:.7;font-size:var(--fs-cap);">'
        + U.escape(nd.hint || '') + '</span>')
        : (openId === 'pv' ? '预览不会改变任何东西 —— 关掉它再决定建不建' : '走到发光的东西旁边，才能动手'))
      + '</div>'
      + '<div style="position:absolute;left:14px;bottom:14px;font-size:var(--fs-cap);color:var(--text-dim);">'
      + (openId === 'city'
        ? 'WASD / 方向键 逛街　·　点地面走过去　·　走出城门回野外'
        : (openId === 'pv'
          ? '这是预览（不占格、不扣费）·　Esc 返回建造面板'
          : (seaView
            ? 'WASD 走动（Shift 跑）　·　拖动鼠标看四周　·　滚轮远近　·　点水面走过去'
            : 'WASD / 方向键 走动　·　点地面走过去　·　点发光处自动靠近')))
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
  /* v147（D 期「建造时的 3D 预览」）：预览场景的格子边长（只给预览用，不动城内街区） */
  var PV_T = 3.2, PV_GAP = 0.8;
  var citySolids = [], cityBounds = null, cityOutZ = 0;
  /* v147：预览用的分类色（城内街区与建造预览**同一份** —— 不另起一套配色） */
  var PV_CAT_COL = { gov: 0xcbb282, prod: 0xb08b4e, mil: 0x7d8790, live: 0xd2bb95, craft: 0xb4643a, other: 0x9a9384 };
  /* v143.2：城内行人（氛围层）。plan 是纯数据（_npcPlan 生成，可无 THREE 测），
     grp 是渲染产物（buildCityScene 里建）。二者分开：测逻辑不用起 WebGL。 */
  var cityNpcs = [];

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

  /* ============================================================
   * v143.2 · 城内行人计划（**纯数据 · 无 THREE 依赖**）
   * ------------------------------------------------------------
   * 为什么 plan 与渲染分开：smoke 里没有 WebGL/THREE，可测的只有数据。
   * 「行人在哪、走哪、多快」全部在这一层算完，buildCityScene 只负责照着摆 mesh。
   *
   * 设计约束（氛围层三不）：
   *   · 不可交互 —— 不进 nodeList，玩家点不到（免得挡着采集/建筑的点选）；
   *   · 不挡路   —— 站位与航点全部落在非碰撞格（进不去房子的内部）；
   *   · 不造假   —— 全城的格都盖了房子（free 为空）就返回 []，不硬塞。
   * 数量随城大小 4~10：城是"活的"，但不是庙会。
   * 确定性：同 plan 同 seed → 同一份计划（同一座城每次进来人在同一处）。
   * ============================================================ */
  function npcInSolid(plan, x, z) {
    var ss = plan.solids || [];
    for (var i = 0; i < ss.length; i++) {
      var s = ss[i];
      if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return true;
    }
    return false;
  }
  /* v158.4（P4）：opts.count 只覆盖人数，不另算一套航点。
     默认（不传 opts）仍是 4~10 的氛围层，§354 的既有断言逐字不变；
     P4 传入 count=12 时复用同一套 free 格筛选 + 三航点 + rng 逻辑。 */
  S._npcPlan = function (plan, seed, opts) {
    var out = [];
    try {
      if (!plan || !plan.cells || !plan.cells.length) return out;
      var R = rng((seed || 4242) >>> 0);
      /* 候选站立点：空地格中心，且不在任何碰撞盒里（well/pile/brazier 也算占地） */
      var free = [];
      for (var i = 0; i < plan.cells.length; i++) {
        var it = plan.cells[i];
        if (!it || it.kind !== 'empty') continue;
        if (npcInSolid(plan, it.x, it.z)) continue;
        free.push(it);
      }
      if (!free.length) return out;               /* 没有空地 → 没有行人，不假修建 */
      var n = Math.max(4, Math.min(10, Math.round(plan.cells.length / 8)));
      if (opts && opts.count != null) {
        n = Math.max(1, Math.min(Math.floor(opts.count), Math.max(1, free.length * 2)));
      }
      for (var p = 0; p < n; p++) {
        var home = free[Math.floor(R() * free.length)];
        /* 每人 3 个航点：家 + 两个随机空地（带 0.8 米内抖动，别走成尺子）。
           航点循环 = 巡逻，不用每步重选目标 —— 状态少、可回放。 */
        var wps = [{ x: home.x, z: home.z }];
        for (var w = 0; w < 2; w++) {
          var t = free[Math.floor(R() * free.length)];
          wps.push({ x: t.x + (R() - 0.5) * 0.8, z: t.z + (R() - 0.5) * 0.8 });
        }
        out.push({
          id: p, x: home.x, z: home.z,
          wps: wps,
          speed: 0.55 + R() * 0.5,               /* 米/秒：比玩家（SPEED≈3.2）慢一半多 */
          tint: Math.floor(R() * 4),             /* 衣色 4 选 1 */
          phase: R() * 6.283                      /* 摆腿相位：各走各的，免得同进同退像广播操 */
        });
      }
    } catch (e) { return []; }
    return out;
  };
  /* 行人总览（渲染层状态摘要，供守卫断言；不返回 THREE 对象） */
  S._cityNpcs = function () {
    return cityNpcs.map(function (np) {
      return { id: np.plan.id, x: np.grp.position.x, z: np.grp.position.z, wi: np.wi,
        wps: np.plan.wps.length, visible: np.grp.visible };
    });
  };
  S.cityGeo = { T: CITY_T, bw: CITY_BW, walk: CITY_T - CITY_BW, r: CITY_R, pad: CITY_PAD };

  /* ============================================================
   * v147（D 期「建造时的 3D 预览」）—— 建造前先看一眼它长什么样
   * ------------------------------------------------------------
   * 老板（v91.71）：「主题 = 军事投送」，接力卡 D 期剩下的那一条就是
   * **建造时的 3D 预览**（D 期其余部分 v143.x 已经把 2.5D 场景接进玩法了）。
   *
   * 为什么单独一个函数、而不是复用 buildCityScene：
   *   城内街区是"整座城的现状"（48 格 + 碰撞 + 行人 + 城门），
   *   预览是"一栋候选建筑"（比邻格高一点，好读体量）。
   *   两者共用**同一套道具与配色**（`PV_CAT_COL` / `house()` 的形体口径），
   *   但布局、相机、交互都不同 —— 硬塞进一个函数会立刻变成两本账。
   *
   * ctx = { bid, lvl, cityId } —— 纯数据进，渲染出；失败返回 null（调用方 toast）。
   * 无 WebGL 时由调用方（ui.openBuildPreview）按 `typeof THREE` 兜底成静态图。
   * ============================================================ */
  function buildPreviewScene(ctxIn) {
    var c = ctxIn.cityId ? G.cityById(ctxIn.cityId) : G.currentCity();
    if (!c) return null;
    var bid = ctxIn.bid, lvl = Math.max(1, Math.min(6, (ctxIn.lvl | 0) || 1));
    var B = (G.DATA.BUILDINGS || {})[bid];
    if (!B) return null;
    /* ⚠️ 先置 openId —— renderHud 的第一行是 `if (!openId) return;`
       （它由 S.open 在 cfg 分支里设置；预览分支自己装配，必须自己置） */
    openId = 'pv';
    layer.style.display = 'block';
    if (propRoot) { scene.remove(propRoot); propRoot = null; }
    nodeList = []; nearNode = null; waterMesh = null;
    propRoot = new THREE.Group();
    scene.add(propRoot);
    cityView = false;
    frustumH = 8.5;
    _skyBase = 0x9db0bd; _fogBase = 0x9db0bd;
    scene.background = new THREE.Color(0x9db0bd);
    scene.fog = new THREE.FogExp2(0x9db0bd, 0.006);

    var R = rng(90210);
    function lamP(color, o) {
      var p = { color: color };
      if (o) for (var k in o) p[k] = o[k];
      return new THREE.MeshLambertMaterial(p);
    }
    /* 地面：夯土棋盘（格线画在地上，让"一格占多大"读得出来） */
    var cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    var g2 = cv.getContext('2d');
    g2.fillStyle = '#6f6553'; g2.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 2400; i++) {
      var dv = (R() - 0.5) * 0.22;
      g2.fillStyle = '#' + new THREE.Color(0x6a6152).offsetHSL(0, 0, dv).getHexString();
      g2.fillRect(R() * 512, R() * 512, 1 + R() * 2.5, 1 + R() * 2.5);
    }
    g2.strokeStyle = 'rgba(40,36,28,0.30)'; g2.lineWidth = 2;
    for (var gl = 0; gl <= 512; gl += 128) {
      g2.beginPath(); g2.moveTo(gl, 0); g2.lineTo(gl, 512); g2.stroke();
      g2.beginPath(); g2.moveTo(0, gl); g2.lineTo(512, gl); g2.stroke();
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    propRoot.add(ground);
    /* 台基：候选建筑脚下比地面亮半档 —— "它会被放在这儿" */
    var pad = new THREE.Mesh(new THREE.PlaneGeometry(PV_T - 0.2, PV_T - 0.2),
      lamP(0x8b8272));
    pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.03, 0);
    propRoot.add(pad);

    /* 主建筑：形状照 `house()` 的口径重画一份（预览不依赖城内那套布局） */
    var cat = (B.mil ? 'mil' : (/minfang|juzhu/.test(bid) ? 'live'
      : (/nongtian|linchang|caikuang|shuijing/.test(bid) ? 'prod'
        : (/tiejiang|gongjiang|zuofang|shuyuan|keyan/.test(bid) ? 'craft'
          : (B.cat === 'gov' ? 'gov' : 'other')))));
    var base = PV_CAT_COL[cat] || PV_CAT_COL.other;
    var h = 1.0 + (lvl - 1) * 0.30;
    var w = PV_T - PV_GAP, d = PV_T - PV_GAP;
    var grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.12, d + 0.16), lamP(0x7f786a)).translateY(0.06));
    var box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lamP(base));
    box.position.y = 0.12 + h / 2;
    grp.add(box);
    var topY = 0.12 + h;
    if (cat === 'mil') {
      [[0, -d / 2 + 0.06, w + 0.04, 0.07], [0, d / 2 - 0.06, w + 0.04, 0.07],
       [-w / 2 + 0.06, 0, 0.07, d + 0.04], [w / 2 - 0.06, 0, 0.07, d + 0.04]].forEach(function (q) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(q[2], 0.22, q[3]), lamP(0x6f6a5e));
        m.position.set(q[0], topY + 0.11, q[1]); grp.add(m);
      });
      var bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.22), lamP(0x8a7a5c));
      bag.position.set(-w * 0.22, topY + 0.30, 0); grp.add(bag);
    } else {
      var eave = new THREE.Mesh(new THREE.BoxGeometry(w * 1.10, 0.07, d * 1.10),
        lamP(new THREE.Color(base).multiplyScalar(0.44).getHex()));
      eave.position.y = topY + 0.02; grp.add(eave);
      var roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 0.46 + lvl * 0.03, 4),
        lamP(new THREE.Color(base).multiplyScalar(0.50).getHex()));
      roof.position.y = topY + 0.28; roof.rotation.y = Math.PI / 4; grp.add(roof);
      var ridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.42, 0.05, 0.07),
        lamP(new THREE.Color(base).multiplyScalar(0.34).getHex()));
      ridge.position.y = topY + 0.52 + lvl * 0.03; grp.add(ridge);
    }
    /* 门 / 窗 / 招牌（朝 +z，与城内同一个"玩家看到的那一面"口径） */
    var face = d / 2 + 0.02;
    var door = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.66, 0.06), lamP(0x3f3123));
    door.position.set(0, 0.45, face); grp.add(door);
    /* ⚠️ 变量名不能叫 `step` —— 会遮住外层的**每帧函数** `function step(now)`，
       `requestAnimationFrame(step)` 当场报 "parameter 1 is not of type 'Function'"（实测踩到） */
    var stepM = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.18), lamP(0x8b8272));
    stepM.position.set(0, 0.035, face + 0.10); grp.add(stepM);
    if (cat === 'live' || cat === 'craft' || cat === 'gov') {
      var glow = 0xffd27a;
      [-w * 0.30, w * 0.30].forEach(function (wx) {
        var winm = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.20, 0.04),
          new THREE.MeshLambertMaterial({ color: glow, emissive: glow, emissiveIntensity: 0.55 }));
        winm.position.set(wx, 0.82 + h * 0.28, face); grp.add(winm);
      });
    }
    grp.position.set(0, 0, 0);
    propRoot.add(grp);

    /* 参照物：左邻（居所 Lv1）· 右邻（作坊 Lv1）—— "它比旁边高多少"一眼能读 */
    function neighbor(px, col, lh) {
      var g = new THREE.Group();
      var b0 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.12, d + 0.16), lamP(0x7f786a));
      b0.position.y = 0.06; g.add(b0);
      var b1 = new THREE.Mesh(new THREE.BoxGeometry(w, lh, d), lamP(col));
      b1.position.y = 0.12 + lh / 2; g.add(b1);
      var rf = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 0.5, 4),
        lamP(new THREE.Color(col).multiplyScalar(0.5).getHex()));
      rf.position.y = 0.12 + lh + 0.25; rf.rotation.y = Math.PI / 4; g.add(rf);
      g.position.set(px, 0, 0.6);
      propRoot.add(g);
    }
    neighbor(-(PV_T + 0.9), PV_CAT_COL.live, 1.0);
    neighbor((PV_T + 0.9), PV_CAT_COL.craft, 1.3);
    /* 施工围栏：围在候选建筑外侧（"这是还没建的东西"，不是现状） */
    var fenceMat = lamP(0x9a7448);
    [[-(PV_T / 2 + 0.25), 0], [(PV_T / 2 + 0.25), 0]].forEach(function (q) {
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.08), fenceMat);
      post.position.set(q[0], 0.275, q[1] + 0.9); propRoot.add(post);
    });

    /* 相机：正交 · 55° 俯角 · 南侧看过去（与城内同一个"读体量"的角度） */
    cam.position.set(0, 9.2, 7.6);
    cam.lookAt(0, 0.9, 0);
    resize();
    applyPhase();          /* 跟随当前时辰（夜里点灯） */
    renderHud();
    lastT = performance.now();
    if (!rafId) rafId = requestAnimationFrame(step);
    return { name: B.name || bid, bid: bid, lvl: lvl };
  }
  S._buildPreviewScene = buildPreviewScene;   /* 排障/探针：直接看它建得出来建不出来 */

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
    _skyBase = 0x9db0bd; _fogBase = 0x9db0bd;
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
    var CAT_COL = PV_CAT_COL;
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
    /* v143.2：行人放在最后 —— 城先盖起来，人再上街（顺序反了会看到空城走人） */
    npcBuild(plan);
    return true;
  }

  /* ============================================================
   * v143.2 · 城内行人渲染 + 巡逻动画
   * ------------------------------------------------------------
   * 形体：4 个 mesh/人（身体 + 头 + 两腿）—— 腿各挂一个 pivot Group，
   *   绕 pivot 转才不会插进地里。预算 10 人 × 4 = 40 mesh，
   *   对全城 400+ 的存量是 +10%，可接受；再多就换 InstancedMesh（现在不必）。
   * 材质：肤色/衣色**共享**（4 衣色），不每人一份 —— 少 30 次材质切换。
   * 生命：挂 propRoot 下，close 时随 propRoot 一起清（cityNpcs 数组同步清空）。
   * ============================================================ */
  var NPC_SKIN = 0xd9b08c, NPC_TINT = [0x8a6f4d, 0x5f7a6a, 0x7d5a5a, 0x4f5f7d];
  var npcMatSkin = null, npcMatTint = null, npcMatPants = null;
  function npcMats() {
    if (!npcMatSkin) {
      npcMatSkin = new THREE.MeshLambertMaterial({ color: NPC_SKIN });
      npcMatPants = new THREE.MeshLambertMaterial({ color: 0x5a5248 });
      npcMatTint = NPC_TINT.map(function (c) { return new THREE.MeshLambertMaterial({ color: c }); });
    }
    return { skin: npcMatSkin, pants: npcMatPants, tint: npcMatTint };
  }
  function npcBuild(plan) {
    try {
      cityNpcs = [];
      var pl = S._npcPlan(plan, 7788 + plan.cols * 100 + plan.rows);
      if (!pl.length) return;
      var M = npcMats();
      for (var i = 0; i < pl.length; i++) {
        var pd = pl[i];
        var grp = new THREE.Group();
        /* 身体（0.60）+ 腿（0.42）≈ 1.02，加头 0.23 → 总高约 1.25 米：
           比玩家（1.35）略矮 —— 一眼能分"这是路人不是我自己"。 */
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.60, 0.20), M.tint[pd.tint % M.tint.length]);
        body.position.y = 0.42 + 0.30;
        grp.add(body);
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), M.skin);
        head.position.y = 1.13;
        grp.add(head);
        /* 腿：pivot 在髋（y=0.42），腿 mesh 下移半个腿高，绕 pivot 摆 */
        var mkLeg = function (sx) {
          var pv = new THREE.Group();
          pv.position.set(sx * 0.075, 0.42, 0);
          var lm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), M.pants);
          lm.position.y = -0.21;
          pv.add(lm);
          grp.add(pv);
          return pv;
        };
        var legL = mkLeg(-1), legR = mkLeg(1);
        var sh = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.y = 0.015;
        grp.add(sh);
        grp.position.set(pd.x, 0, pd.z);
        propRoot.add(grp);
        /* 不进 nodeList（不可交互）· 不进 solids（不挡路）—— 氛围层三不的后两条 */
        cityNpcs.push({ plan: pd, grp: grp, legL: legL, legR: legR, wi: 0 });
      }
    } catch (e) { cityNpcs = []; }
  }
  function stepNpcs(dt, now) {
    if (!cityNpcs.length) return;
    /* 夜里路上没人：整组隐藏（省 draw call，也比"半夜还逛街"讲得通）。
       出门另说 —— 玩家走到哪跟到哪的逻辑不在这层。 */
    var night = _lastPhase === 'night';
    for (var i = 0; i < cityNpcs.length; i++) {
      var np = cityNpcs[i];
      if (np.grp.visible === night) np.grp.visible = !night;
      if (night) continue;
      var wp = np.plan.wps[np.wi % np.plan.wps.length];
      var dx = wp.x - np.grp.position.x, dz = wp.z - np.grp.position.z;
      var d2 = dx * dx + dz * dz;
      if (d2 < 0.02) { np.wi = (np.wi + 1) % np.plan.wps.length; continue; }
      var d = Math.sqrt(d2), stp = Math.min(d, np.plan.speed * dt);
      np.grp.position.x += dx / d * stp;
      np.grp.position.z += dz / d * stp;
      np.grp.rotation.y = Math.atan2(dx, dz);
      /* 摆腿 + 身体微沉：走起来的关键是"动"，不是"像" */
      var sw = Math.sin(now / 1000 * 7 + np.plan.phase);
      np.legL.rotation.x = sw * 0.6;
      np.legR.rotation.x = -sw * 0.6;
      np.grp.position.y = Math.abs(sw) * 0.02;
    }
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
  /* v143：当前时段（night/dawn/day/dusk）—— 给门禁验时段划分边界，
     也给排障（"天怎么没黑"先看这里返回什么）。 */
  S.phase = function () { return phaseOf(hourNow()); };
  S._phaseOf = phaseOf;
  /* 遭遇的决定（同参数同结果）—— 给门禁验"确定性"，不给随机开后门 */
  S.encounterFor = function (sceneId, ci) {
    var cfg = sceneCfg(sceneId);
    if (!cfg) return null;
    return encounterFor(cfg, ci);
  };
  /* 城内 3D（入口在城市页右下角） */
  S.openCity = function () { return S.open('city'); };
  /* v147（D 期）：**建造预览** —— 建造面板上的「先看看」入口 */
  S.openBuildPreview = function (bid, lvl, cityId) { return S.open('pv', { bid: bid, lvl: lvl, cityId: cityId }); };
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

  /* v157.87 海面场景的取证出口（探针与断言都走它，不去翻内部变量） */
  S._sea = function () {
    if (!seaView) return { on: false };
    var samples = [];
    for (var i = 0; i < 4; i++) samples.push(+seaWaveY(i * 37 - 40, i * -23 + 11, 1.7).toFixed(4));
    return {
      on: true,
      persp: !!(cam && cam.isPerspectiveCamera),
      cam: [+cam.position.x.toFixed(2), +cam.position.y.toFixed(2), +cam.position.z.toFixed(2)],
      player: [+player.position.x.toFixed(2), +player.position.y.toFixed(3), +player.position.z.toFixed(2)],
      waveAtPlayer: +seaWaveY(player.position.x, player.position.z, seaTime).toFixed(3),
      waveSamples: samples,
      ships: seaShips.length, floats: seaFloat.length, nodes: nodeList.length,
      yaw: +seaYaw.toFixed(3), pitch: +seaPitch.toFixed(3), dist: +seaDist.toFixed(2),
      time: +seaTime.toFixed(2),
      fog: seaMat ? seaMat.uniforms.uFogDen.value : null,
      oceanVerts: seaMesh ? seaMesh.geometry.attributes.position.count : 0,
      /* 人到底有没有、多高 —— "创建一个人"这件事必须能读数验证，不能靠截图猜 */
      body: (function () {
        if (!player) return null;
        var fig = null;
        for (var i = 0; i < player.children.length; i++) {
          if (player.children[i].name === 'fig') fig = player.children[i];
        }
        var box = new THREE.Box3().setFromObject(player);
        return {
          kids: player.children.length,
          figVisible: fig ? !!fig.visible : null,
          actor: !!(player.userData && player.userData.actor),
          h: +(box.max.y - box.min.y).toFixed(2),
          y0: +(box.min.y - player.position.y).toFixed(2)
        };
      })()
    };
  };
  /* 场景对象出口：探针要能"关掉某一层看剩下的"（分层隔离是定位渲染问题的唯一手段） */
  S._root = function () { return scene; };
  S._waveY = seaWaveY;
  S._waveGlsl = seaWaveGlsl;
  S._SEA_W = SEA_W;
  S._SEA = SEA;

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
      applyPhase();          /* v143：进城就按当前时辰点亮（天会黑） */
      renderHud();
      lastT = performance.now();
      if (!rafId) rafId = requestAnimationFrame(step);
      return { ok: true, scene: 'city', name: '我的城（3D）' };
    }
    /* v147：**建造预览**不是一张静态场景，而是照着候选建筑现搭一格 + 当前城做参照 */
    if (sceneId === 'pv') {
      var okp = buildPreviewScene(ctxIn || {});
      if (!okp) return { ok: false, msg: '没有这个建造项' };
      openId = 'pv';
      return { ok: true, scene: 'pv', name: '建造预览 · ' + okp.name };
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
    /* v157.87：海面是一个独立装配流程（透视相机 + 自带天空/海面） */
    if (cfg.sea) buildSeaScene(cfg); else buildScene(cfg);
    resize();
    applyPhase();          /* v143：进场景就按当前时辰点亮（天会黑） */
    renderHud();
    lastT = performance.now();
    if (!rafId) rafId = requestAnimationFrame(step);
    /* ⛔ v157.85：前传 HUD（#prologue-screen）的让位逻辑已删 —— 前传退役。 */
    return { ok: true, scene: sceneId, name: cfg.name };
  };

  /* 斗将视觉宿主：在玩家身前生成敌方 Soldier，面朝玩家；玩家播 attack、敌人播 guard。
     duel.js 本身只做战斗结算、无 3D 渲染，这里补上"看得见的两个人"。 */
  function spawnDuelFoe(nd) {
    if (!player || !propRoot || !(GAME.gltf && GAME.gltf.Actor)) return;
    clearDuelFoe();
    var a = new GAME.gltf.Actor({ name: 'Soldier' });
    a.load(function (av) {
      if (!av || !av.root) return;
      var grp = new THREE.Group();
      av.root.scale.setScalar(1.0);
      grp.add(av.root);
      /* 站在玩家身前 1.8 米、面朝玩家 */
      var fa = player.rotation.y;
      grp.position.set(player.position.x + Math.sin(fa) * 1.8, 0, player.position.z + Math.cos(fa) * 1.8);
      grp.rotation.y = fa + Math.PI;
      propRoot.add(grp);
      duelFoeActor = av; duelFoeGroup = grp; duelActive = true;
      av.skill('guard');
    });
  }
  function clearDuelFoe() {
    if (duelFoeGroup && propRoot) propRoot.remove(duelFoeGroup);
    duelFoeGroup = null; duelFoeActor = null; duelActive = false;
  }

  S.close = function () {
    if (!openId) return { ok: false };
    /* v143：结算过的正式局，退出落点是地块界面（玩家从那儿点按钮进来的）。
       先取出再走后面的清场 —— ctx 会被下一次 open 重置。 */
    var exitTo = (ctx && ctx.exitTo) || null;
    var exitCi = (ctx && ctx.ci != null) ? ctx.ci : null;
    openId = null;
    /* v157.87：离开海面 —— 退出拖拽态、换回正交相机（否则下次进陆上场景
       会拿透视相机去算 left/right，画面直接糊掉） */
    seaView = false; seaDrag = null; cam = orthoCam || cam;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (layer) { layer.style.display = 'none'; layer.innerHTML = ''; layer.appendChild(cvs); }
    /* canvas 被 innerHTML 清掉后要挂回来 */
    if (layer && cvs && cvs.parentNode !== layer) layer.appendChild(cvs);
    if (propRoot) { scene.remove(propRoot); propRoot = null; }
    nodeList = []; nearNode = null; keys = {};
    clearDuelFoe(); playerActor = null; playerRig = null; playerActing = false;
    /* v143.2：行人随 propRoot 清（数组同步空，_cityNpcs() 归零） */
    cityNpcs = [];
    npcMatSkin = null; npcMatTint = null; npcMatPants = null;
    /* ⛔ v157.85：恢复前传 HUD 的显示已删（前传退役）。 */
    if (G.refreshAll) { try { G.refreshAll(); } catch (e) {} }
    /* v143：回地块界面（带 ci 重开那一格的面板）—— 失败不挡关门，场景必须能退 */
    if (exitTo === 'land' && exitCi != null && G.ui && G.ui.openLandModalCi) {
      try { G.ui.openLandModalCi(exitCi); } catch (e) {}
    }
    return { ok: true };
  };

  /* 场景入口（由 UI 调）：按动作 + 地形选场景 */
  S._dbg = function () {
    return {
      frustumH: frustumH, cityView: !!cityView,
      cam: cam ? cam.position.toArray().map(function (v) { return +v.toFixed(2); }) : null,
      player: player ? [+player.position.x.toFixed(2), +player.position.z.toFixed(2)] : null,
      solids: (citySolids || []).length, bounds: cityBounds,
    };
  };

  /* v156.68 渲染诊断：阴影/色调映射/环境的真实状态。
     「开了但看不见」这类问题只能读数，不能靠截图猜。 */
  S._gfx = function () {
    var o = { ok: false };
    try {
      o.shadowMapEnabled = !!(R3 && R3.shadowMap && R3.shadowMap.enabled);
      o.shadowMapType = R3 ? R3.shadowMap.type : null;
      o.toneMapping = R3 ? R3.toneMapping : null;
      o.exposure = R3 ? R3.toneMappingExposure : null;
      o.physicallyCorrect = R3 ? (R3.useLegacyLights === undefined ? 'n/a' : R3.useLegacyLights) : null;
      o.env = !!(scene && scene.environment);
      o.fog = scene && scene.fog ? scene.fog.density : null;
      var L = LGT || {};
      o.sunCast = L.sun ? L.sun.castShadow : null;
      o.sunIntensity = L.sun ? L.sun.intensity : null;
      o.sunPos = L.sun ? L.sun.position.toArray().map(function (v) { return +v.toFixed(1); }) : null;
      o.shadowCam = L.sun && L.sun.shadow ? {
        l: L.sun.shadow.camera.left, r: L.sun.shadow.camera.right,
        t: L.sun.shadow.camera.top, b: L.sun.shadow.camera.bottom,
        n: L.sun.shadow.camera.near, f: L.sun.shadow.camera.far,
      } : null;
      o.shadowMapObj = L.sun && L.sun.shadow ? !!L.sun.shadow.map : null;
      o.renderCalls = R3 && R3.info ? R3.info.render.calls : null;
      o.triangles = R3 && R3.info ? R3.info.render.triangles : null;
      o.ok = true;
    } catch (e) { o.err = e.message; }
    return o;
  };

  S.play = function (actId, ci, opts) {
    opts = opts || {};
    /* ⛔ v157.85：前传整段退役 → 场景只有一个宿主 = **正式阶段**（`live` 恒真）。
       原来这里按 `prologue.on()` 分两路，还从 `prologue.cellTypeOf` 取地形；
       现在地形统一取逻辑球面字段（与 `jianghuActsAt` 同源）。 */
    var live = true;
    var terrain = null;
    if (ci != null && G.sphere && G.sphere.cells && G.sphere.cells[ci]) {
      terrain = G.sphere.cells[ci].type;
    }
    /* 进场景的门槛与按钮一致：这一格今天能做这件事，才让进 */
    var avail = [];
    if (G.jianghuActsAt && ci != null) {
      try { avail = (G.jianghuActsAt(ci) || []).map(function (a) { return a.id; }); } catch (e) { avail = []; }
    }
    if (actId && avail.length && avail.indexOf(actId) < 0) {
      return { ok: false, why: 'gate', msg: '这地方今天做不了这件事 —— 换一处或明天再来' };
    }
    var id = S.pickFor(actId, terrain);
    /* v143：野地等级带进 ctx —— HUD 显示"野地 LvN"（与地块界面"野地 LvN · 难度 ×"
       同一口径：难度/收益倍率都乘在它上面）。非野地格取不到就 null，HUD 不显示。 */
    var lv = null;
    try { if (G.map && G.map.wildLevelNow && ci != null) lv = G.map.wildLevelNow(ci); } catch (e) { lv = null; }
    var r = S.open(id, {
      ci: ci, actId: actId, terrain: terrain, availableActs: avail,
      live: live, gen: opts.gen || null, exitTo: opts.exitTo || null,
      lv: (typeof lv === 'number' ? lv : null)
    });
    if (r.ok) r.act = actId;
    return r;
  };

  /* ============================================================
   * v143.3 · 正式阶段遭遇的结算路由（**判定与呈现分离**）
   * ------------------------------------------------------------
   * 场景里的红圈（遭遇 · 废土物种）在正式局的归属：它不是每日动作，
   * 是"这一次撞见的仗" —— 结算走唯一账本 jianghuDo(…,'tao')。
   * 这里只做**判定**（调账本 + 决定 done/exitTo），呈现（飘字/暗化/关场景）
   * 留在 interact —— 分离是为了这条路由可以在没有 WebGL 的 smoke 里测。
   * 契约：
   *   · ok        → { ok:true, res, markDone:true, exitTo:'land' }
   *   · 干不成     → { ok:false, res:{ok:false,msg}, markDone:false }（不标 done）
   *   · 账本抛错   → 同上（观测层不许把渲染故障升级成玩法故障）
   * ============================================================ */
  S._encounterSettle = function (ci, genId) {
    var res = null;
    try { res = G.jianghuDo ? G.jianghuDo(ci, genId, 'tao') : null; }
    catch (e) { res = { ok: false, msg: '动手时出错了：' + (e.message || '') }; }
    if (res && res.ok) return { ok: true, res: res, markDone: true, exitTo: 'land' };
    return { ok: false, res: res || { ok: false, msg: '现在打不了这一架' }, markDone: false };
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
      /* v143.3：正式阶段的遭遇 ≠ 序章斗将 —— 先修一个断裂：
         duel 分支原来无条件调 G.prologue.duelBegin，正式局（立城后）必报
         「已经立城了」：红圈撞见了，却什么都不能干。
         正式宿主的遭遇 = 「这一格撞见的仗」→ 走**既有唯一账本**
         jianghuDo(ci, gen, 'tao')（清剿：扣精力体力、按战力与野地等级判胜败、
         辐能核心/负伤全在那本账上）。不新开斗将口径 —— 斗将正式化涉及
         结算口径变更，是拍板项（见 HANDOVER 候选）。 */
      if (ctx && ctx.live) {
        var _set = S._encounterSettle(_ci,
          (ctx && ctx.gen) || (G.lordGeneralOf && (G.lordGeneralOf() || {}).id) || null);
        if (_set.ok) {
          nd.done = true;
          if (nd.ring) nd.ring.visible = false;
          dimProp(o);
          if (nd.idx != null && nd.idx < 900) S.markDone(openId, nd.idx);
          showResult(nd, _set.res, 'tao');
          ctx.exitTo = 'land';                 /* 与采集同一条退出落点 */
          return _set.res;
        }
        /* 打不了（日锁/精力/此地今日无此事）→ **不标 done**：
           那是"没干成"，不是"收拾过了" —— 标了这架今天就白撞了。 */
        showResult(nd, _set.res, 'tao');
        return _set.res;
      }
      /* ⛔ v157.85：`G.prologue.duelFoe/duelBegin` 分支已删（前传的君主斗将）。
         正式阶段的遭遇在上面的 `ctx.live` 分支走 `jianghuDo(…,'tao')`。 */
      return { ok: false, msg: '这里现在打不了' };
    }
    if (nd.done) return { ok: false, msg: '这里已经收拾过了' };
    var actId = nd.act || (ctx && ctx.actId) || 'cai';
    var ci = (ctx && ctx.ci != null) ? ctx.ci : null;
    var res = null;
    {
      /* v143：正式宿主 —— 结算走 GAME.jianghuDo（地块按钮那一个出口）。
         失败（日锁/精力体力不够）不标 done：那不是"收拾过了"，是"今天没干成"，
         节点得留着，明天还能来。成功才落 done + 记退出落点（回地块界面）。 */
      var genId = (ctx && ctx.gen) || (G.lordGeneralOf && G.lordGeneralOf() || {}).id;
      try {
        var r0 = GAME.jianghuDo ? GAME.jianghuDo(ci, genId, actId) : null;
      } catch (e) { r0 = { ok: false, msg: '动手时出错了：' + (e.message || '') }; }
      if (r0 && r0.ok === false) {
        showResult(nd, { ok: false, msg: r0.msg || '今天在这儿做不了这件事' }, actId);
        return r0;
      }
      res = r0 ? {
        ok: true,
        msg: (r0.name || '收拾') + (r0.text ? '：' + r0.text : ''),
        bad: r0.bad
      } : { ok: false, msg: '没有结果' };
      if (res.ok) ctx.exitTo = 'land';   /* 结算成功 → 退出时回地块界面（ux：看完结果回主线） */
    }
    nd.done = true;
    playerActing = true;                   /* 采集/垂钓：蹲下动作，走动即取消 */
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
    /* ⛔ v157.85：前传退役 —— 原先「只有前传君主一个人在外面走才有随机遭遇」，
       现在没有前传，这条随机遭遇随之取消（正式阶段的红圈遭遇走 jianghuDo 那条账）。 */
    return null;
    // eslint-disable-next-line no-unreachable
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
