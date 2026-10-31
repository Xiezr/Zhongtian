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
   * 这两个函数只碰 GAME.map / GAME.camp / GAME.village / GAME.ruin / GAME.fortOwnAt
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
      out.facts.push('这一带还没有记载');
      out.tasks.push('派一队过去（点它 = 派队），抵达后周围显现');
      return out;
    }
    out.facts.push(kind === 'own' ? '己方城市'
      : kind === 'npc' ? '名城'
        : kind === 'adm' ? '行政城' : null);
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
      } else if (GAME.ruin && GAME.ruin.isFound && GAME.ruin.isFound(ci)) {
        out.facts.push('遗迹');
        out.tasks.push('🏚️ 可探索（给材料）');
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
    return out;
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
    if (kind === 'own' && ref && ui.openCityPanel) ui.openCityPanel(ref);
    else if (kind === 'npc' && ref && ui.openAttackModal) ui.openAttackModal(ref);
    else if (kind === 'adm' && ref && ui.openAttackModal) ui.openAttackModal(ref);
    else if (kind === 'fort' && GAME.map.fortAt) {
      var ff = GAME.map.fortAt(ci, GAME.map._pctx(GAME.mapPlanetOf ? GAME.mapPlanetOf().id : null));
      if (ff && ui.openFortModal) ui.openFortModal(ff);
      else if (ui.openLandModalCi) { GAME.map._terrOverride = cell ? cell.type : null; GAME.map._regionOverride = reg; ui.openLandModalCi(ci); }
    }
    else if (GAME.camp && GAME.camp.isFound(ci) && ui.openCampModal) ui.openCampModal(ci);
    else if (GAME.village && GAME.village.at && GAME.village.at(ci) && GAME.village.isKnown(ci) && ui.openVillageModal) ui.openVillageModal(ci);
    else if (GAME.ruin && GAME.ruin.isFound(ci) && ui.openRuinModal) ui.openRuinModal(ci);
    else if (ui.openLandModalCi) {
      GAME.map._terrOverride = cell ? cell.type : null;
      GAME.map._regionOverride = reg;
      ui.openLandModalCi(ci);
    }
  }
  if (typeof THREE === 'undefined') {
    /* 无 THREE（jsdom）：只留这几个纯数据出口 —— smoke 靠它们验"这一格是什么" */
    GAME.map3d = { enabled: false, why: 'no-three',
      openCellPanel: _openCellPanel, cellBrief: _cellBrief,
      townScaleOf: _townScaleOf };
    return;
  }
  var SP = GAME.mapSphere;                         /* v90.97（双球面）：地图渲染走**地图球面**（与逻辑球面 GAME.sphere 解耦）*/
  var M = GAME.map3d = { enabled: true,
    openCellPanel: _openCellPanel, cellBrief: _cellBrief,
    townScaleOf: _townScaleOf };

  var R = (SP && SP.R) || 300;                    /* 星球海平面半径 */
  var HSC = (SP && SP.HSC) || 26;                 /* 高度 → 世界单位（山≈40 · 陆地≈5）*/
  /* ============================================================
   * v92.240j（老板：「云层不切割，已探明的地块更亮即可」）
   * ------------------------------------------------------------
   * 上一版（v92.240i）把厚云做成**按格拼六边形、已探明格不进网格** —— 那就是"切割"：
   * 云是一块块被挖掉洞的马赛克，洞口边缘随格子走向锯齿，远看像破洞的纱网。
   * 现在改口径：**云层不切割** —— 一整层连续球壳（buildSkyClouds 的 M._sky）
   * 罩住全星，探明度**不再决定有没有云**；
   * 已探明与否改由**地表亮度**表达（buildFog 的贴地加亮层 _fogLit / _fogLit1）。
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
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
      vertexShader: [
        'varying vec3 vP;',
        'void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime; uniform float uFade;',
        'varying vec3 vP;',
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
        /* v92.241：浓度由星球参数派生（SP.ATM_A）—— 大气密度/云量大的星球更浓。 */
        '  float a = dens * ' + atmA().toFixed(3) + ' * uFade;',
        '  vec3 col = mix(vec3(0.76, 0.80, 0.87), vec3(0.98, 0.99, 1.0), dens);',
        '  gl_FragColor = vec4(col, a);',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, side: THREE.FrontSide
    });
    M._sky = new THREE.Mesh(g, mat);
    M._sky.renderOrder = 22;
    M._skyMat = mat;
    scene.add(M._sky);
  }
  M.buildSkyClouds = buildSkyClouds;

  var TERRAIN_RGB = {
    lake:    [28, 66, 104],     /* 深蓝 */
    zhaoze:  [86, 104, 70],     /* 沼泽：浑浊的青褐绿（不是"黑绿"） */
    plain:   [188, 176, 132],   /* 浅土黄（能立城的空地） */
    caoyuan: [162, 180, 98],    /* 草原：黄绿 */
    forest:  [48, 112, 58],     /* 森林：饱和的深绿（绝不会是黄的） */
    desert:  [216, 186, 120],   /* 荒漠：沙黄 */
    hill:    [156, 144, 126]    /* 山地：暖灰岩；很高的地方掺雪 */
  };
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

  function sphBiome(e, dy, d) {
    var s = seed3(), P = SP.PLANET || {};
    var t = 'lake';
    var ci = (SP.nearestCell && d) ? SP.nearestCell(d) : -1;
    try {
      if (ci >= 0 && SP.cells && SP.cells[ci] && SP.cells[ci].type) t = SP.cells[ci].type;
      else if (e >= 0) t = 'plain';
    } catch (eCt) { t = e < 0 ? 'lake' : 'plain'; }
    /* 用**平滑后的格色**（含海拔/坡度/气候/邻域过渡） */
    var cc = null;
    if (ci >= 0) cc = M.cellColorOf(ci);
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
  var camO = { yaw: 0.8, pitch: 0.42, dist: R * 2.9 };
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
  M.ZOOM_MIN = R * 1.02;                                  /* 内界：贴着地表 */
  M.ZOOM_MAX = R * 50;                                    /* 外界：老板指定的最大空间 */

  /* v91.33（性能）：版本戳（把 M.render 里的内联拼串抽出，预建时可预盖）。 */
  M._pverOf = function () { return (SP.seed3 ? SP.seed3() : 0) + '|' + (SP.sub || 0) + '|' + (SP.PLANET ? JSON.stringify(SP.PLANET) : ''); };
  M._mkVerOf = function () { return (((GAME.mapSliceOf && GAME.mapSliceOf()) || {}).cities || []).map(function (c) { return c.id + ':' + c.x + ',' + c.y; }).join('|') + '#pl' + ((GAME.prologue && GAME.prologue.on && GAME.prologue.on()) ? (GAME.prologue.pos ? GAME.prologue.pos() : -1) : -1) + '#' + _tileSub; };
  M._flVerOf = function () { var sl = (GAME.mapSliceOf && GAME.mapSliceOf()) || {}; var fp = Object.keys(sl.forts || {}).sort().join(','); var wp = (sl.wilds || []).map(function (w) { return w.ci; }).sort(function (a, b) { return a - b; }).join('|'); var _ck = ''; if (GAME.camp && GAME.camp.found) { var cf = GAME.camp.found(); var n = 0, dm = 0; Object.keys(cf).forEach(function (k) { n++; if (cf[k].mode) dm++; }); _ck = '#c' + n + '/' + dm; } if (GAME.ruin && GAME.ruin.found) { var rf = GAME.ruin.found(); var rn = 0, rd = 0; Object.keys(rf).forEach(function (k) { rn++; if (rf[k].side) rd++; }); _ck += '#r' + rn + '/' + rd; }
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
  function applyTerminator(mat) {
    if (!mat || typeof mat.onBeforeCompile !== 'function') return mat;
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
      sh.vertexShader = 'varying vec3 vWn;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vWn = normalize(mat3(modelMatrix) * position);'
      );
      sh.fragmentShader = 'uniform vec3 uSunDir; uniform float uTerm; varying vec3 vWn;\n'
        + sh.fragmentShader.replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\n'
          + '  float _sunL = clamp(dot(normalize(vWn), normalize(uSunDir)), 0.0, 1.0);\n'
          + '  gl_FragColor.rgb *= (1.0 - uTerm) + uTerm * (0.35 + 0.65 * _sunL);'
        );
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
    cam = new THREE.PerspectiveCamera(42, 1, 1, 6000);
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
  function makeDetailTex() {
    var N = 384, L8 = null, L16 = null, L32 = null;
    function lattice(g, salt) { var a = new Float32Array(g * g); for (var i = 0; i < g * g; i++) a[i] = h3(i % g, (i / g) | 0, salt, 13); return a; }
    L8 = lattice(8, 11); L16 = lattice(16, 22); L32 = lattice(32, 33);
    function samp(L, g, x, y) {
      var gx = x * g, gy = y * g, x0 = Math.floor(gx), y0 = Math.floor(gy);
      var fx = gx - x0, fy = gy - y0, x1 = (x0 + 1) % g, y1 = (y0 + 1) % g, x0m = ((x0 % g) + g) % g, y0m = ((y0 % g) + g) % g;
      var v00 = L[y0m * g + x0m], v10 = L[y0m * g + x1], v01 = L[y1 * g + x0m], v11 = L[y1 * g + x1];
      var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      var t = v00 + (v10 - v00) * u, b = v01 + (v11 - v01) * u;
      return t + (b - t) * v;
    }
    var cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    var cx = cv.getContext('2d'); var img = cx.createImageData(N, N);
    for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) {
      var x = xx / N, y = yy / N;
      var n = samp(L8, 8, x, y) * 0.5 + samp(L16, 16, x, y) * 0.3 + samp(L32, 32, x, y) * 0.2;
      var c = Math.round((0.74 + n * 0.26) * 255);
      var o = (yy * N + xx) * 4; img.data[o] = c; img.data[o + 1] = c; img.data[o + 2] = c; img.data[o + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
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
    var pos = [], col = [], nor = [], idx = [], uv = [];
    FACES.forEach(function (fn) {
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
        var rr = R + Math.max(0, e) * HSC;
        pos.push(dx * rr, dy * rr, dz * rr);
        nor.push(dx, dy, dz);                              /* 法线=位置方向（球面朝外 · 不受绕向影响）*/
        uv.push(i / K, j / K);
        var c = sphBiome(e, dy, [dx, dy, dz]);
        col.push(c[0] / 255, c[1] / 255, c[2] / 255);
      }
      for (var z = 0; z < K; z++) for (var x = 0; x < K; x++) {
        var a = base + z * VW + x, b = a + 1, c2 = a + VW, d = c2 + 1;
        if (_flip) idx.push(a, b, c2, b, d, c2);
        else idx.push(a, c2, b, b, c2, d);
      }
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    /* v155h（性能）：**单面**渲染。DoubleSide 会把球背面（永远看不到）也逐像素光栅化 ——
       实测地形球单独渲染 232ms，其中约一半花在背面。
       单面后球背的三角面被背面剔除，像素量减半。 */
    var _gmat243 = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide });
    applyTerminator(_gmat243);          /* v92.243：太阳方向明暗（昼夜线）*/
    globe = new THREE.Mesh(geo, _gmat243);
    /* v90.67（方案B）：细节纹理**乘**到顶点色上（MeshBasicMaterial: color×vertexColor×map）——近看有颗粒。 */
    try {
      var dtex = makeDetailTex(); dtex.repeat.set(7, 7);
      globe.material.map = dtex; globe.material.needsUpdate = true;
    } catch (e) { /* 纹理生成失败 → 退回纯顶点色 */ }
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
        wpos.push(_d[0] / _dl * (R + 1.0), _d[1] / _dl * (R + 1.0), _d[2] / _dl * (R + 1.0));
        wcoast.push(_cv);
        var _mm = _c.rim.length;
        for (var _k = 0; _k < _mm; _k++) {
          var _p = _c.rim[_k], _pl = Math.hypot(_p[0], _p[1], _p[2]) || 1;
          wpos.push(_p[0] / _pl * (R + 1.0), _p[1] / _pl * (R + 1.0), _p[2] / _pl * (R + 1.0));
          wcoast.push(_cv);
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
    if (wcnt) wg = new THREE.BufferGeometry();
    else {
      wg = new THREE.SphereGeometry(R + 0.4, 96, 64);
      /* v155i：兜底整球没有"离岸距离场" → 补一个全 1（否则 attribute 缺省 0，浪全平） */
      var _nv0 = wg.attributes.position.count, _c1 = new Float32Array(_nv0);
      for (var _i0 = 0; _i0 < _nv0; _i0++) _c1[_i0] = 1;
      wg.setAttribute('uCoast', new THREE.Float32BufferAttribute(_c1, 1));
    }
    if (wcnt) {
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
        'uniform float uTime, uAmp, uR;',
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
        'varying vec3 vN; varying vec3 vView;',
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
         * v155g（老板：「波浪现在是规律性的」）
         * ------------------------------------------------------------
         * 五条正弦叠加必然出现**平行条纹**（相位是线性的，等相位线就是直线）。
         * 最简洁的两招破掉规律性（不引入贴图、不加噪声纹理）：
         *   ① **域扭曲**：采样点先被三个慢变的 sin 推开（波长是主浪的 10 倍以上），
         *      等相位线被拉弯 → 波峰不再是笔直的平行带；
         *   ② **慢变包络**：整片海域的浪高缓慢起伏（有的地方浪大、有的地方近乎平静）。
         * 再加一条"相位抖动"正弦，让 5 条波在局部互相错开，破掉晶格感。
         * ============================================================ */
        /* v155j（性能）：**位移用全波，求法线用快波**。
           原来每个顶点要跑 3 次 5 条波（有限差分求法线）= 3× 的波形开销。
           法线只需要"大致坡度"，用前两条波 + 域扭曲即可，视觉无差别。 */
        'vec3 warp(vec3 P, float t){',
        '  return P + vec3(',
        '      sin(P.y * 0.019 + t * 0.11),',
        '      sin(P.z * 0.016 - t * 0.09),',
        '      sin(P.x * 0.021 + t * 0.13)) * 11.0;',
        '}',
        'float h(vec3 P, float t){',
        '  float env = 0.68 + 0.32 * sin(P.x * 0.0085 + t * 0.05) * sin(P.z * 0.0072 - t * 0.041);',
        '  vec3 W = warp(P, t);',
        '  float v = 0.0;',
        '  v += 0.90 * sin(dot(W, normalize(vec3( 0.62, 0.41, 0.67))) * 0.21 + t * 0.42);',
        '  v += 0.55 * sin(dot(W, normalize(vec3(-0.51, 0.73,-0.45))) * 0.37 + t * 0.61);',
        '  v += 0.32 * sin(dot(W, normalize(vec3( 0.13,-0.61, 0.78))) * 0.66 + t * 0.83);',
        '  v += 0.18 * sin(dot(W, normalize(vec3(-0.84, 0.22, 0.49))) * 1.13 - t * 1.05);',
        '  v += 0.14 * sin(dot(W, normalize(vec3( 0.35, 0.88,-0.31))) * 0.52',
        '                   + sin(dot(W, vec3(0.010, 0.013, 0.009))) * 3.4 + t * 0.73);',
        '  return v * 0.33 * env;',
        '}',
        /* 快波：只前两条（求法线用） */
        'float hf(vec3 P, float t){',
        '  vec3 W = warp(P, t);',
        '  float v = 0.90 * sin(dot(W, normalize(vec3( 0.62, 0.41, 0.67))) * 0.21 + t * 0.42)',
        '          + 0.55 * sin(dot(W, normalize(vec3(-0.51, 0.73,-0.45))) * 0.37 + t * 0.61)',
        '          + 0.32 * sin(dot(W, normalize(vec3( 0.13,-0.61, 0.78))) * 0.66 + t * 0.83);',
        '  return v * 0.33;',
        '}',
        'vec3 surfF(vec3 d, float c, float t){ vec3 P = d * uR; float k = smoothstep(0.0, 0.55, c); return d * (uR + hf(P, t) * uAmp * k); }',
        'vec3 surf(vec3 d, float c){ vec3 P = d * uR; float k = smoothstep(0.0, 0.55, c); return d * (uR + h(P, uTime) * uAmp * k); }',

        'void main(){',
        '  vec3 d = normalize(position);',
        '  vec3 T = normalize(cross(d, vec3(0.0, 1.0, 0.0) + 0.0001));',
        '  vec3 B = normalize(cross(d, T));',
        '  float e = 0.020;',
        '  vCoast = uCoast;',
        '  vec3 P  = surf(d, uCoast);',
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
        'varying vec3 vN; varying vec3 vView;',
        'void main(){',
        '  vec3 N = normalize(vN);',
        '  vec3 V = normalize(-vView);',
        /* 主光：画面左上方（与场景太阳一致的方向感） */
        '  vec3 L = normalize(vec3(0.45, 0.80, 0.40));',
        '  float diff = max(dot(N, L), 0.0);',
        /* v155f：**高光** —— 浪脊上的镜面反光才是"水"的读法（只有 diffuse 会像一块布） */
        '  vec3 H = normalize(L + V);',
        '  float spec = pow(max(dot(N, H), 0.0), 48.0);',
        '  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);',
        '  vec3 col = uColor * (0.55 + 0.55 * diff);',
        '  col += vec3(0.95, 0.97, 1.00) * spec * 0.42;',
        '  col += vec3(0.12, 0.20, 0.28) * fres;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n');
      var wmat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: 3.2 },                     /* 世界单位：约 0.44 格宽（浪高看得出来，又不穿地块） */
          /* v155j（修正 v155i 的符号错误）：湖底地形面在 R+0.6（PLATEAU），
             水面必须**略高于它**（+0.62）才看得见；之前的 R-0.8 直接把水压到海底下面，
             于是海洋显示成深蓝的"湖底色"（就是那半边发黑）。 */
          uR: { value: R + 1.0 },
          uColor: { value: new THREE.Color(0x4a7fa0) }   /* 旧方案的颜色，不改 */
        },
        vertexShader: marineVS, fragmentShader: marineFS,
        side: THREE.FrontSide,
        /* v155l（老板：「六边形内有三角形」）：水面与海床只差 0.02 → 深度打架，
           碎片随机"透出"成三角斑。抬高 0.4 之外，再用 polygonOffset 把水面往镜头拉一点。 */
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4
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
  /* v92.240j：探明度不再切云，改成两级**贴地加亮**层（已探明满强度 / 半明半强度）。 */
  var _fogLit = null, _fogLit1 = null;
  function buildFog() {
    var kill = function (m) { if (m) { scene.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); } };
    kill(_fogLit); kill(_fogLit1); _fogLit = _fogLit1 = null;
    /* v137：云材质数组也要清 —— `kill` 只 dispose 材质，数组里的旧引用还在，
       而 render 每帧会遍历它推 uTime → 换星球/迷雾重建时越积越多。 */
    M._cloudMats = [];
    var F = GAME.fog, SPn = GAME.sphere;
    if (!F || !SPn || !SPn.fpos || !SPn.faceCell) return;
    F.ensure();
    var fpos = SPn.fpos, fc = SPn.faceCell, cells = SPn.cells;
    var lit = [], half = [], t, v;
    /* v155h：原来对**每个三角面**都判一次 → 同一格可能被塞进列表多次
       （六边形通常由 6 个三角面拼，雾层顶点因此膨胀到 73 万）。
       按**格子**去重后每格只画一次。 */
    /* ============================================================
     * v155m（老板：「六边形内有三角形」· 第三次）——
     * 根因：这里按**三角面**收集，且每格只留**第一个**三角面 →
     * 雾只铺了六边形的 1/6（一个三角），在六边形内部呈现为三角形。
     * 现在按**格子**收集，makeMesh 用整块六边形（中心 + 外沿）铺。
     * ============================================================ */
    /* v92.240j：这里收集的不再是"要铺云的格子"，而是**要加亮的地块**。
       fog=2（已探明）→ lit（满强度）；fog=1（半明）→ half（半强度）；
       fog=0（未探明）→ 两边都不进 → 只有大气层罩着、地表保持原亮度（最暗）。 */
    var _seenLit = {}, _seenHalf = {}, lit = [], half = [];
    var _cellOfFace = SPn.faceCell || null;
    for (t = 0; t < fc.length; t++) {
      v = F.get(fc[t]);
      var _k = _cellOfFace ? _cellOfFace[t] : t;
      if (v === 2) { if (!_seenLit[_k]) { _seenLit[_k] = 1; lit.push(_k); } }
      else if (v === 1) { if (!_seenHalf[_k]) { _seenHalf[_k] = 1; half.push(_k); } }
    }
    /* ============================================================
     * v137（老板：「地图上黑魆魆的，能不能做云雾遮盖效果……我看人家又三维又流体的」）
     * ------------------------------------------------------------
     * 改前：未探明区 = 一层 `0x070b11`、**不透明度 0.94** 的实心面。
     *      那不是"雾"，是"拿黑布盖住" —— 整球看过去就是一块死黑饼。
     * 现在：同一批三角面换 **FBM 噪声着色器** ——
     *   · 3D value noise 四倍频叠加（fbm），乘上缓慢平移的时间 → 云在球面上流动；
     *   · 厚度决定不透明度与亮度（薄的透出底下地形，厚的更白更实）；
     *   · 颜色从深蓝灰渐变到灰白 —— 读起来是"高空云层"，不是"没渲染出来的黑"。
     * 为什么不上 raymarching 体积云（leoawen / jorjboi 那类）：
     *   那套要 3D 纹理烘焙 + TAA + 后处理管线，是"第一人称飞行穿过云"的方案；
     *   这里是**俯视一颗球**，云贴在球壳上已经足够"三维又流体"，
     *   成本从"每像素步进 20+ 次"降到"每像素 4 次噪声"。
     * ============================================================ */
    var CLOUD_VS = 'varying vec3 vP;\n'
      + 'void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
    var CLOUD_FS = [
      'uniform float uTime; uniform float uBase; uniform float uAlpha;',
      'varying vec3 vP;',
      'float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
      'float n31(vec3 p){',
      '  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(mix(h31(i), h31(i + vec3(1.0,0.0,0.0)), f.x),',
      '                 mix(h31(i + vec3(0.0,1.0,0.0)), h31(i + vec3(1.0,1.0,0.0)), f.x), f.y),',
      '             mix(mix(h31(i + vec3(0.0,0.0,1.0)), h31(i + vec3(1.0,0.0,1.0)), f.x),',
      '                 mix(h31(i + vec3(0.0,1.0,1.0)), h31(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z);',
      '}',
      'float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * n31(p); p *= 2.03; a *= 0.5; } return v; }',
      'void main(){',
      '  vec3 d = normalize(vP);',
      /* 两层不同速度 → 视差感（内层慢、外层快） */
      /* 各向异性缩放 → 云被拉成**丝带状**（等比例缩放只会得到一团团噪点） */
      '  vec3 q1 = d * vec3(3.1, 6.4, 3.1) + vec3(uTime * 0.020, uTime * 0.008, uTime * 0.014);',
      '  vec3 q2 = d * vec3(8.0, 15.0, 8.0) - vec3(uTime * 0.011, uTime * 0.017, uTime * 0.006);',
      /* ⚠️ 第一版参数（uBase 0.72 + smoothstep 0.30~0.80）实测像"磨砂玻璃球"：
         整颗球均匀糊一层白，地形一点透不出来 —— 那不是云，是毛玻璃。
         云要**有空洞**：薄处几乎全透（露出地形）、厚处几乎不透。
         所以 uBase 降到 0.34，并把 smoothstep 区间收窄（0.42~0.72）——
         同样一张噪声图，明暗对比拉开，才有"云团 + 云隙"的层次。 */
      '  float f = fbm(q1) * 0.68 + fbm(q2) * 0.32;',
      '  float a = uAlpha * (uBase + (1.0 - uBase) * smoothstep(0.42, 0.72, f));',
      /* v154d: 未探明是"微暗"不是"雪白" —— 云色压到深蓝灰，厚度只影响深浅 */
      '  vec3 col = mix(vec3(0.05,0.07,0.10), vec3(0.34,0.38,0.45), smoothstep(0.35, 0.75, f));',
      '  gl_FragColor = vec4(col, a);',
      '}'
    ].join('\n');
    function cloudMat(opacity, base) {
      var mm = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBase: { value: base },
          uAlpha: { value: opacity },
        },
        vertexShader: CLOUD_VS,
        fragmentShader: CLOUD_FS,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      mm.frustumCulled = false;
      (M._cloudMats = M._cloudMats || []).push(mm);
      return mm;
    }
    /* v92.240j：新增第 9 参 blend —— 传 THREE.AdditiveBlending 即"加亮"（地表提亮层用）。 */
    function makeMesh(list, lift, color, opacity, order, useCloud, cloudBase, shellR, blend) {
      if (!list.length) return null;
      /* v155m：list 里装的是**格索引**；每格铺一块完整六边形（中心 + 外沿三角扇）。 */
      var position = [], index = [], i, k, d;
      for (i = 0; i < list.length; i++) {
        var cx = cells[list[i]];
        if (!cx || !cx.dir || !cx.rim || !cx.rim.length) continue;
        d = cx.dir;
        var _base = position.length / 3;
        /* v92.240i：给了 shellR 就把顶点一律投影到**固定半径**球壳（大气层高度），
           不再沿各自法向外推 lift —— 云因此是光滑整壳，不随地形起伏。
           原式 p + p/|p|·lift 等价于 p/|p|·(|p|+lift)，故 shellR 时只需把半径换掉。 */
        var _r0 = Math.hypot(cx.pos[0], cx.pos[1], cx.pos[2]) || R;
        var _cr = shellR ? shellR : (_r0 + lift);
        position.push(cx.pos[0] / _r0 * _cr,
                      cx.pos[1] / _r0 * _cr,
                      cx.pos[2] / _r0 * _cr);
        var _mm = cx.rim.length;
        for (k = 0; k < _mm; k++) {
          var _p = cx.rim[k], _pl = Math.hypot(_p[0], _p[1], _p[2]) || 1;
          var _pr = shellR ? shellR : (_pl + lift);
          position.push(_p[0] / _pl * _pr, _p[1] / _pl * _pr, _p[2] / _pl * _pr);
        }
        for (k = 0; k < _mm; k++) index.push(_base, _base + 1 + k, _base + 1 + ((k + 1) % _mm));
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
      if (index.length) g.setIndex(index);
      var m = new THREE.Mesh(g, useCloud ? cloudMat(opacity, cloudBase == null ? 0.34 : cloudBase)
        : new THREE.MeshBasicMaterial({
            color: color, transparent: true, opacity: opacity,
            side: THREE.DoubleSide, depthWrite: false,
            blending: blend || THREE.NormalBlending
          }));
      m.renderOrder = order;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    }
    /* 外扩量：雾面只需盖住**自己脚下那格的地形**（山脊），不必去盖线框 ——
       线框现在由顶点色自己熄掉（paintLineFog）。
       上一版把 lift 提到 14 想盖线框，结果雾壳膨胀到把已探明区也挡住（截图确认）。 */
    /* ============================================================
     * v152（老板：「说好未探索区域只要云雾缭绕微暗就行 —— 现在点哪都是
     * '那边还没探明'，地图根本点不动」）
     * ------------------------------------------------------------
     * 迷雾的**作用从"挡住操作"改成"遮住信息"**：
     *   · 未探明 = 一层薄雾 + 把地形压暗（还看得见轮廓，能点、能走进去）；
     *   · 半明   = 极薄的一层（几乎只是压一点对比）。
     * 判定"能不能点/能不能走"的地方也随之改口径（见 prologue.P.pathTo 的
     * 「雾里可以走，只是看不见」与 map3d.pickAt 的未探明分支）。
     * ============================================================ */
    /* v154c：雾团下面直接透出地形色（老板要的是"那里有东西，只是看不清"）。
       原来 uAlpha 0.62 的云＋lift 4 把地形整个刷白 → 远看像雪原。
       现在：**更低透明度 + 更贴地**，雾是"一层纱"，地形色仍然透出来。 */
    /* v155e（老板：「云量太少了」）：未探明从"薄纱"加到"确实有云"，但仍透得出地形 */
    /* ============================================================
     * v92.240j（老板：「云层不切割，已探明的地块更亮即可」）
     * ------------------------------------------------------------
     * 这里**不再建任何云网格** —— 云是 buildSkyClouds 里那一整层连续大气球壳，
     * 罩全星、不按格挖洞（挖洞 = 马赛克状破洞纱网，就是老板说的"切割"）。
     * 探明度改由**贴地加亮**表达：加亮层贴着地形（lift 0.8，只比地表高一点），
     * 走 AdditiveBlending（叠加提亮，不是盖一层白）—— 地形色仍然认得出。
     *   · fog=2 已探明 → 0.20 满强度（云底下明显更亮）
     *   · fog=1 半明   → 0.10 半强度
     *   · fog=0 未探明 → 无加亮，只有大气层 → 相对最暗
     * renderOrder 18：压在云层（20~22）之下、地表之上。
     * ============================================================ */
    _fogLit = makeMesh(lit, 0.8, 0xfff2dc, 0.20, 18, false, null, null, THREE.AdditiveBlending);
    _fogLit1 = makeMesh(half, 0.8, 0xfff2dc, 0.10, 18, false, null, null, THREE.AdditiveBlending);
    /* v154：海水波纹动画抬到**海平面之上**一点点 —— 只盖水面，不糊陆地 */
    if (M._waterMat) { }
    paintLineFog();
  }

  /* 线框按探明度上色（与雾面同一把尺子：fog.get） */
  function paintLineFog() {
    var attr = M._lineColAttr, SPn = GAME.sphere;
    if (!attr || !SPn || !SPn.uposCell) return;
    var arr = attr.array, uc = SPn.uposCell, F = GAME.fog;
    for (var i = 0; i < uc.length; i++) {
      var v = F ? F.get(uc[i]) : 2;
      var r, g, b;
      /* v137：未探明线框从**近黑**（0.02/0.03/0.05）提到深灰蓝 ——
         上面盖的是流动云层，底下若纯黑，云会像"浮在黑布上的白斑"；
         留一点轮廓，读起来才是"雾里看地形"。 */
      if (v === 0) { r = 0.13; g = 0.16; b = 0.22; }
      else if (v === 1) { r = 0.28; g = 0.36; b = 0.45; }   /* 半明：灰蓝 */
      else { r = 0.56; g = 0.70; b = 0.84; }                /* 全明：原冷蓝 */
      /* v154：区域边界色覆盖雾色（**同一条边**，不另画线 → 没有重影） */
      var rc = M._regionEdgeCol && M._regionEdgeCol[i];
      if (rc) { r = rc[0]; g = rc[1]; b = rc[2]; }
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
    for (var j = 0; j < n; j++) {
      var pair = m[key(j * 6)];
      if (!pair || typeof pair !== 'object') continue;
      var a = pair.a, b = pair.b;
      if (S.provOf[a] < 0 || S.provOf[b] < 0) continue;         /* 海/无分区不画 */
      var col = null;
      if (on.prov && S.provOf[a] !== S.provOf[b]) col = pal.prov;
      else if (on.market && S.marketOf[a] !== S.marketOf[b]) col = pal.market;
      else if (on.district && S.districtOf[a] !== S.districtOf[b]) col = pal.district;
      if (col) M._regionEdgeCol[j] = [col[0] / 255, col[1] / 255, col[2] / 255];
    }
    paintLineFog();
  }
  M.paintRegionEdges = paintRegionEdges;

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
    var admCities = [], EGT = { old: 22, prov: 18, market: 14, district: 9 };
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
      var tier = tierOf(lv), lvl = EGT[lv];
      var c = { id: 'adm_' + lv + '_' + idx, name: name, x: cell.x, y: cell.y, ci: ci,
        type: tier, owner: 'npc', level: lvl, admLevel: lv, admIndex: idx, _cent: cent };
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
      if (c.lon == null || c.lat == null) { var d = dirOfCell(c.x, c.y); c.lon = (Math.atan2(d[2], d[0]) * 180 / Math.PI + 360) % 360; c.lat = Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180 / Math.PI; }
      if (!c.garrison && GAME.genGarrison) { c.garrison = GAME.genGarrison(c); c.maxArmy = c.garrison; }
      var ci = ciOfRef(c); if (ci >= 0) { mark[ci] = [220, 70, 60]; cellKind[ci] = 'npc'; cellRef[ci] = c;
        settles.npc.push({ ci: ci, lv: c.lv || c.level || 3 }); }
    });
    /* 行政中心城 = 紫色（按球面质心方向取格）*/
    (M.admCities || []).forEach(function (c) { var ci = (c.ci != null && c.ci >= 0) ? c.ci : nearestCell(c._cent); if (ci >= 0) { mark[ci] = [180, 120, 210]; cellKind[ci] = 'adm'; cellRef[ci] = c;
      settles.adm.push({ ci: ci, lv: c.lv || 4 }); } });
    /* 己方城 = 蓝：落在其**球面六边格索引 ci**（球系唯一身份，免 (x,y) 往返）
       v90.97（双球面）：读**地图星球分片**的城（未必 = 当前城所在星球）。 */
    M._ownCells = {};
    ((GAME.mapSliceOf() || {}).cities || []).forEach(function (c) {
      var ci = ciOfRef(c);
      var dir = (ci >= 0 && SP.cells[ci]) ? SP.cells[ci].dir : dirOfCell(c.x, c.y);
      c.lon = (Math.atan2(dir[2], dir[0]) * 180 / Math.PI + 360) % 360;
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
      /* v152d: in the prologue the player is a lone wanderer -- faction/admin city
         paint blobs are noise (they read like render bugs). Keep only: you + places
         where something is happening. */
      var _inPro = !!(GAME.prologue && GAME.prologue.on && GAME.prologue.on());
      Object.keys(mark).forEach(function (k) {
        var _k = +k;
        if (cellKind[_k] === 'own' || cellKind[_k] === 'lord' || cellKind[_k] === 'actspot') return;
        if (_inPro) { delete mark[_k]; delete cellKind[_k]; delete cellRef[_k]; return; }
        var _f = (GAME.fog && GAME.fog.get) ? GAME.fog.get(_k) : 2;
        if (_f === 0) { delete mark[_k]; delete cellKind[_k]; delete cellRef[_k]; }
      });
    } catch (eF152) { /* 过滤失败不挡地图 */ }
    /* ============================================================
     * v132：前传里"**我站在这一格**"（平涂部分）。
     * ------------------------------------------------------------
     * 前传是君主一个人在大地图上走，之前屏幕上没有任何标记指向自己
     * （视野区域中心就是自己，但玩家不知道中心在哪）。
     * 写在 `fogHides` 过滤**之后** —— 脚下必然已探明，放后面省得被雾判掉。
     * ⚠️ 已核对：`_tileCells = SP.cells`（map3d.js:252/278），
     * 所以 `mark[ci]` 与消费端 `_tileCells[ci]` 是**同一套索引**。
     * 悬浮标签另在 floatName 定义之后补（那里 grp/lp 才初始化好）。
     * ============================================================ */
    var _lordCi = -1;
    if (GAME.prologue && GAME.prologue.on && GAME.prologue.on()) {
      var _ciP = GAME.prologue.pos ? GAME.prologue.pos() : -1;
      if (_ciP >= 0 && _tileCells[_ciP]) {
        _lordCi = _ciP;
        mark[_ciP] = [255, 216, 92];
        cellKind[_ciP] = 'lord';
        cellRef[_ciP] = { lord: true };
      }
      /* ============================================================
       * v151（老板：「地图就是游戏本体」）：**雾里有动静的格子自己发光**。
       * ------------------------------------------------------------
       * 走路、动手都回到地图以后，"往哪走"这件事必须由地图回答 ——
       * 不能靠 HUD 上写一行"最近的动静：东"。这里把君主视野内（≤10 环）
       * 有荒野事、且**已探明**的格子标成暗金色，地图自己就是任务板。
       * 迷雾外（fog=0）不给 —— 那是"未知"，标了等于免费探图。
       * ============================================================ */
      try {
        if (M.cellKind && GAME.jianghuActsAt && SP.hopsWithin) {
          var _ringP = SP.hopsWithin(_ciP, 10) || [];
          for (var _ji = 0; _ji < _ringP.length; _ji++) {
            var _jc = _ringP[_ji];
            if (_jc === _ciP || !_tileCells[_jc]) continue;
            if (cellKind[_jc]) continue;
            if (GAME.fog && GAME.fog.get(_jc) === 0) continue;
            if (!(GAME.jianghuActsAt(_jc) || []).length) continue;
            mark[_jc] = [196, 158, 74];
            cellKind[_jc] = 'actspot';
            cellRef[_jc] = { actspot: true };
          }
        }
      } catch (e) { /* 标点失败不挡地图 */ }
    }
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
      /* v152：前传里只浮脚下那一个名字 —— 远处的城名地名都是没探明就不该知道的信息。 */
      if (GAME.prologue && GAME.prologue.on && GAME.prologue.on()) {
        try {
          var _lp = GAME.prologue.pos ? GAME.prologue.pos() : -1;
          var _ci2 = dir ? SP.nearestCell(dir) : -1;
          if (_ci2 !== _lp) return;
        } catch (ePN) { }
      }
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
    /* v132 前传：君主头顶一个"▲ 你"（这里 grp/lp 已初始化，才能安全调 floatName） */
    if (_lordCi >= 0 && _tileCells[_lordCi] && _tileCells[_lordCi].dir) {
      floatName(_tileCells[_lordCi].dir, '▲ 你', '#ffe28a');
    }
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
    var up = new THREE.Vector3(0, 1, 0);
    var nn = new THREE.Vector3(), q = new THREE.Quaternion(), qr = new THREE.Quaternion();
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
        q.setFromUnitVectors(up, nn);
        qr.setFromAxisAngle(nn, _townRnd(e.ci) * Math.PI * 2);
        q.multiply(qr);
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
    function place(ref, colorHex) {
      /* v91.25（球系）：**以 ci 直接落格**（旧法 dirOfCell(x,y) 经 (x,y)→经纬→最近格 往返，
         会落到邻格 → 棋子错位）。缺 ci 的旧档才回退坐标往返。 */
      var ci = (ref && ref.ci != null && ref.ci >= 0) ? ref.ci : ((ref && ref.x != null && ref.y != null) ? nearestCell(dirOfCell(ref.x, ref.y)) : -1);
      var cell = (ci >= 0) ? _tileCells[ci] : null; if (!cell || !cell.pos) return;
      var P = cell.pos, L = Math.hypot(P[0], P[1], P[2]) || 1, lift = 1.5;
      var spr = flagSprite(colorHex);
      spr.position.set(P[0] + P[0] / L * lift, P[1] + P[1] / L * lift, P[2] + P[2] / L * lift);
      grp.add(spr);
    }
    var fo = sl.forts || {};
    Object.keys(fo).forEach(function (k) { place(fo[k], '#ffcf4d'); });   /* 己方据点 = 琥珀金 */
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
        place({ ci: ci }, '#9c3b34');
      });
    }
    /* v156：整格涂色层在**本函数末尾**构建（营地/村社/遗迹都在后面才写入 _tint） */
    /* ============================================================
     * v92.6（构想 A2：半信息痕迹）—— 迷雾边缘的"有东西"暗示
     * ------------------------------------------------------------
     * 文档原话：「未点亮区能看到烟柱、脚印、无线电杂音，知道『有东西』
     * 但不知是什么」。
     *
     * 这是纯视觉，不带任何情报：不给地形、不给等级、点不开、不进 info 条。
     * 它只回答"往哪走"这个方向问题 —— 全黑的球玩家不知道往哪推。
     * 位置由哈希决定（确定性），玩家可以记住"那根烟一直在那边"。
     * ============================================================ */
    if (GAME.fog && GAME.DATA && GAME.DATA.FOG && GAME.DATA.FOG.traceChance) {
      var _tc = GAME.DATA.FOG.traceChance;
      var _tn = _tileCells.length;
      for (var _ti = 0; _ti < _tn; _ti++) {
        if (GAME.fog.get(_ti) !== 0) continue;          /* 只看未探明格 */
        var _tc0 = _tileCells[_ti];
        if (!_tc0 || !_tc0.pos || !_tc0.nt) continue;
        /* 必须紧贴已探明区（更远的地方，玩家连"那边有东西"都没理由知道） */
        var _near = false;
        for (var _adj = 0; _adj < _tc0.nt; _adj++) {
          var _nb = SP.adj[_ti] && SP.adj[_ti][_adj];
          if (_nb != null && _nb >= 0 && GAME.fog.get(_nb) > 0) { _near = true; break; }
        }
        if (!_near) continue;
        /* 确定性：同一格永远有/没有这根烟 */
        var _hx = (_ti * 2654435761 + (_tileSub + 7) * 40503) >>> 0;
        _hx ^= _hx >>> 13; _hx = (_hx * 1274126177) >>> 0; _hx ^= _hx >>> 16;
        if ((_hx >>> 0) / 4294967296 >= _tc) continue;
        /* v156：不再悬空小球 → 这块地**整格**泛一点暖色（"那边有动静"）。 */
        _tint[_ti] = [150, 112, 70];
      }
    }
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
        _tint[ci] = col;
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
      }
    }
    /* v92.7：已发现的旧世界遗迹 —— 青珠（待翻）/ 暗青（已翻） */
    if (GAME.ruin && GAME.ruin.found) {
      var _rf = GAME.ruin.found();
      Object.keys(_rf).forEach(function (k) {
        var ci = +k, rec = _rf[k];
        var cell0 = _tileCells[ci];
        if (!cell0 || !cell0.pos) return;
        if (GAME.fog && GAME.fog.get(ci) <= 0) return;
        _tint[ci] = (rec && rec.side) ? [58, 92, 88] : [110, 199, 192];
      });
    }
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
  function placeCamera() {
    var pitch = Math.max(-1.55, Math.min(1.55, camO.pitch));
    var d = Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, camO.dist));
    camO.dist = d;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    cam.position.set(d * cp * Math.sin(camO.yaw), d * sp, d * cp * Math.cos(camO.yaw));
    cam.lookAt(0, 0, 0);
    /* 远到 50R（=15000）时，旧的 far=6000 会把星球整个裁掉 —— 按距离动态给足余量；
       near 同步抬高，否则 near=1 / far=33000 的深度精度会把球面打成 z-fighting。 */
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
    /* v152d: prologue camera stays glued to the player's tile (undo centerOn / slider).
       v92.241b：加了 `!M.camFree` —— 玩家主动拉远过就不再抢镜头，
       否则"往外滚一格、下一帧又被拽回贴地"，表现就是"相机支点被人物焊死了"。 */
    /* v92.242：支点已废 —— 这里只剩"前传期别把镜头甩太远"这一条软约束。
       距离基准统一为从**球心**算：贴地 = R + 1.5×HSC。 */
    var _inPro241 = !!(GAME.prologue && GAME.prologue.on && GAME.prologue.on());
    if (_inPro241 && !M.camFree) {
      var _nearD152 = R + HSC * 1.5;
      if (camO.dist > _nearD152 * 1.05) camO.dist = _nearD152;
    }
    M._focus = null;                                      /* 兼容壳：任何残留都清掉 */
    placeCamera();
    /* 地块数**固定**（老板）：不再随缩放切换级别 —— 恒定 TILE_SUB（= 40962 块）。*/
    /* 城市/据点增减/迁移（占领/迁址/放弃）→ 重建标记。v90.62（老板「移动后新城2 无色块/名称」）：
       旧判据只数**城市条数** —— 迁址时条数不变 → 标记不重建 → 旧色块/名称留在原地。
       改：把各城的 **id + 坐标** 拼进版本号，任一城移动即触发重建（色块与连线随城走）。 */
    var _mkVer = M._mkVerOf();
    if (_mkVer !== M._mkVer) { M._mkVer = _mkVer; buildMarkers(); buildTowns(); }
    /* v153：地表上的 3D 小人（君主 / 当前城 / 指认格）—— 每帧同步，换格只挪不重建 */
    try { syncFigures(); } catch (eFig) { if (typeof console !== 'undefined' && console.warn) console.warn('[figures]', eFig && eFig.message); }
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
      }
    } catch (eBelt) { _beltRocks = null; }
    /* 手上已经没东西了（切页/收工/放置完成）→ 幽灵必须跟着消失，
       否则会有一件半透明的物件永远卡在场景里。 */
    if (plGhost && !(GAME.ui && GAME.ui._placeItem)) { M.clearGhost(); M._ghostCi = -1; }
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
    if (M._shellMat) {
      var near = R * 1.45, far = R * 2.7;
      var o = 0.10 + 0.34 * Math.min(1, Math.max(0, (camO.dist - near) / (far - near)));
      M._shellMat.opacity = o;
      if (tiles) tiles.visible = true;
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
      /* v155f：近景（贴地/看水面）**把云淡出** —— 否则云壳挡在相机与地面之间，一片糊 */
      var _fade = Math.max(0, Math.min(1, (camO.dist - R * 1.15) / (R * 0.55)));
      M._skyMat.uniforms.uFade.value = _fade;
      if (M._sky) M._sky.visible = _fade > 0.02;
    }
    if (M._cloudMats && M._cloudMats.length) {
      var _ct = (Date.now() % 3600000) / 1000;
      for (var _ci2 = 0; _ci2 < M._cloudMats.length; _ci2++) {
        var _u = M._cloudMats[_ci2].uniforms;
        if (_u && _u.uTime) _u.uTime.value = _ct;
      }
    }
    R3.render(scene, cam);
    var ctx = target2d.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(wcv, 0, 0, cw, ch);
    /* v90.83：**当前星球标识**（左下常驻）—— 换球后一眼可辨"现在是哪颗"（生成/进入星球后即时更新）。
       放左下：右上被地形/行政检索栏占用。 */
    /* v131：前传不画这条 —— 那时候玩家是**一个人**在野外，不是一颗星球的统治者；
       「🪐 老家 · 种子 … / 行迹 0.1% · 视野 4 格」摆在那里纯属噪音（截图里最扎眼的一处）。 */
    var _inPrologue = !!(GAME.prologue && GAME.prologue.on && GAME.prologue.on());
    if (GAME.state && GAME.state.planets && !_inPrologue) {
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
         而且正是"转一阵子后画面抖一下"的来源之一。 */
      var _inPro = !!(GAME.prologue && GAME.prologue.on && GAME.prologue.on());
      var ok = !_inPro && GAME.ui && GAME.ui.view === 'map' && GAME.state && (Date.now() - (M._lastAct || 0) > 10000);
      if (!ok) {
        if (M._spinTimer) { clearInterval(M._spinTimer); M._spinTimer = null; }
        M._spinLast = 0;                                     /* v92.240k：停下时清时基，下次启动不跳一大格 */
        return;
      }
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
      camO.yaw += (2 * Math.PI / _spin) * (_dt / 1000);      /* spinSec 秒一圈，与帧率无关 */
      wonderStep();                                          /* v91.30：奇观轨行 + 出场/离场动画 */
      if (GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
    }
    if (!M._spinTimer && typeof setInterval !== 'undefined') M._spinTimer = setInterval(_spinTick, 33);
    return true;
  };

  M.bindControls = function (canvas) {
    if (!canvas || canvas._m3dBound) return;
    canvas._m3dBound = true;
    var drag = 0, lx = 0, ly = 0, moved = false;
    function redraw() { if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); }
    function touch() { M._lastAct = Date.now(); }            /* v90.81：无操作计时（自转）*/
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('mousedown', function (e) {
      /* v153f：只有**左键**才算"开始拖动/点击" —— 之前右键/中键也 drag=1，
         于是左键点一下（press）→ 右键点一下（release）会配成"没拖动 = 点击"，
         把前半段左键的坐标当成点击位置（实测点右上角却走了南西）。 */
      if (e.button !== 0) return;
      drag = 1; moved = false; lx = e.clientX; ly = e.clientY; touch(); e.preventDefault();
    });
    /* v92.240k：放置模式的幽灵预览 —— 鼠标在地图上移动，幽灵跟到那一格。
       只在**手持物品时**才发射线（否则白白每帧 raycast）；同一格不重复重建。 */
    canvas.addEventListener('mousemove', function (e) {
      var ui = GAME.ui;
      if (!ui || !ui._placeItem || !M._collider) return;
      var r0 = canvas.getBoundingClientRect();
      if (!r0.width) return;
      var nx0 = ((e.clientX - r0.left) / r0.width) * 2 - 1, ny0 = -((e.clientY - r0.top) / r0.height) * 2 + 1;
      var rc0 = new THREE.Raycaster();
      rc0.setFromCamera(new THREE.Vector2(nx0, ny0), cam);
      var h0 = rc0.intersectObject(M._collider, false);
      if (!h0.length) { if (M._ghostCi !== -1) { M._ghostCi = -1; M.clearGhost(); redraw(); } return; }
      var _pt0 = h0[0].point;
      var ci0 = (SP && SP.nearestCell) ? SP.nearestCell([_pt0.x, _pt0.y, _pt0.z]) : -1;
      if (ci0 < 0 || ci0 === M._ghostCi) return;
      M._ghostCi = ci0;
      M.ghost(ui._placeItem, ci0);
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
      if (GAME.prologue && GAME.prologue.on && GAME.prologue.on()) return;
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
      if (!h1.length) { if (_hovCi !== -1) { _hovCi = -1; ui2.tipHide(); } return; }
      var p1 = h1[0].point;
      var ci1 = (SP && SP.nearestCell) ? SP.nearestCell([p1.x, p1.y, p1.z]) : -1;
      if (ci1 < 0) { ui2.tipHide(); return; }
      if (ci1 === _hovCi) { ui2.showMapCellTip(M.cellBrief(ci1), e.clientX, e.clientY); return; }
      _hovCi = ci1;
      ui2.showMapCellTip(M.cellBrief(ci1), e.clientX, e.clientY);
    });
    canvas.addEventListener('mouseleave', function () {
      _hovCi = -1;
      if (GAME.ui && GAME.ui.tipHide) GAME.ui.tipHide();
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      camO.yaw -= dx * 0.006;
      camO.pitch = Math.max(-1.4, Math.min(1.4, camO.pitch + dy * 0.006));
      touch(); redraw();
    });
    window.addEventListener('mouseup', function (e) {
      var wasDrag = drag; drag = 0;
      M._lastClickDebug = { wasDrag: wasDrag, moved: moved, x: e.clientX, y: e.clientY };
      if (!wasDrag || moved) return;
      /* v153（老板：「可以在星球地表上逐格移动」）——
         前传里点地图 = **人沿地表走过去**（0.22s 插值），走完再刷界面。
         走几格由 P.mapClick 决定（精力够到哪走到哪）；这里只负责"先走给人看"。 */
      if (GAME.prologue && GAME.prologue.on && GAME.prologue.on() && GAME.prologue.mapClick && M._collider) {
        var r0 = canvas.getBoundingClientRect();
        if (!r0.width) { M.pickAt(canvas, e.clientX, e.clientY); return; }
        /* 用 window 坐标落点（窗口偏移不再影响）：先换算成画布内坐标 */
        var inX = Math.max(0, Math.min(canvas.width, e.clientX - window.scrollX - r0.left));
        var inY = Math.max(0, Math.min(canvas.height, e.clientY - window.scrollY - r0.top));
        var nx0 = (inX / r0.width) * 2 - 1, ny0 = -(inY / r0.height) * 2 + 1;
        var rc0 = new THREE.Raycaster();
        rc0.setFromCamera(new THREE.Vector2(nx0, ny0), cam);
        var h0 = rc0.intersectObject(M._collider, false);
        if (!h0.length) return;
        /* v155h：拾取壳已是低模球 → 用命中点方向反查格 */
        var _pt0 = h0[0].point;
        var ci0 = (SP && SP.nearestCell) ? SP.nearestCell([_pt0.x, _pt0.y, _pt0.z]) : -1;
        if (ci0 < 0) return;
        var fromCi = GAME.prologue.pos();
        M._lastClickDebug = { ci0: ci0, fromCi: fromCi, moved: moved, drag: wasDrag };
        if (ci0 === fromCi) { M.pickAt(canvas, e.clientX, e.clientY); return; }   /* 点脚下：开面板 */
        var res0 = GAME.prologue.mapClick(ci0);
        M._lastClickDebug.steps = res0 && res0.steps;
        M._lastClickDebug.ok = res0 && res0.ok;
        M._lastClickDebug.msg = res0 && res0.msg;
        if (res0 && res0.ok && res0.steps > 0) {
          M.buildLordWalking(fromCi, GAME.prologue.pos());
          M._lastClickDebug.started = true;
          /* 走完再刷（避免"人还在这边、地图已经换成那边"） */
          setTimeout(function () {
            if (GAME.refreshAll) GAME.refreshAll();
            if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
          }, 240);
        } else if (res0 && res0.msg && GAME.ui && GAME.ui.toast) {
          GAME.ui.toast(res0.msg);
        }
        return;
      }
      M.pickAt(canvas, e.clientX, e.clientY);   /* 没拖动 = 点击 → 选地块 */
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var _prevD = camO.dist;
      /* v92.242：滚轮按**比例**推拉（对数手感），1.02R ↔ 50R 全程可用。 */
      var _step = (e.deltaY < 0 ? 1 / 1.12 : 1.12);
      camO.dist = Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, camO.dist * _step));
      /* 往外拉即"我想看全貌" → 前传的贴地跟随不再抢镜头 */
      if (camO.dist > _prevD) M.camFree = true;
      touch(); redraw();
    }, { passive: false });
  };
  /* v90.98（老板）：缩放条 ↔ 相机距离的**唯一换算**（滚轮也用同一对区间）。
     zoomFrac()：0 = 极小视野（最近）→ 1 = 极大视野（最远）—— 供底栏滑块落位。 */
  /* v92.242：1.02R ~ 50R 跨度 49 倍，线性滑块会有一大半行程"看不出变化" → 改用对数刻度。 */
  M.zoomFrac = function () {
    var a = Math.log(M.ZOOM_MIN), b = Math.log(M.ZOOM_MAX);
    var v = Math.log(Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, camO.dist)));
    return Math.max(0, Math.min(1, (v - a) / (b - a)));
  };
  /* setZoom(frac)：滑块拖动 → 设视野（0 近 · 1 远）；不动朝向。返回当前 frac。 */
  M.setZoom = function (frac) {
    frac = Math.max(0, Math.min(1, Number(frac) || 0));
    var a = Math.log(M.ZOOM_MIN), b = Math.log(M.ZOOM_MAX);
    camO.dist = Math.exp(a + (b - a) * frac);
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
    if (opts && opts.dist != null) camO.dist = Math.max(M.ZOOM_MIN, Math.min(M.ZOOM_MAX, opts.dist));
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
    camO.dist = R + HSC * 1.5;                    /* ≈ 一格半的视距（站在这一格上方）*/
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
  M._standVer = '';
  function makeFigure(color, scale) {
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
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.13), mat);
    armL.position.set(-0.27, 0.66, 0);
    var armR = armL.clone(); armR.position.x = 0.27;
    g.add(body, head, legL, legR, armL, armR);
    g.userData.legs = [legL, legR];
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
    /* 让模型的 +Y 指向该格法线 */
    var up = new THREE.Vector3(0, 1, 0);
    var n = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    g.quaternion.setFromUnitVectors(up, n);
    /* 再绕自身竖轴随机一转，避免每个人都朝同一个方向；记下基准朝向供行走插值 */
    g.rotateY((ci % 360) * Math.PI / 180);
    g.userData.baseQ = g.quaternion.clone();
    return true;
  }
  function buildFigures() {
    if (figRoot) { scene.remove(figRoot); figRoot = null; }
    figCache = {};
    figRoot = new THREE.Group();
    scene.add(figRoot);
    /* 尺寸：一格的世界宽度随格数变，小人取"格宽的 1/3" —— 40962 时约 1.7 单位 */
    var cellW = (4 * Math.PI * R * R / Math.max(1, (_tileCells || []).filter(Boolean).length)) || 1;
    cellW = Math.sqrt(cellW);
    var sc = Math.max(0.8, Math.min(5.0, cellW * 0.45 / 1.2));
    var who = [];
    if (GAME.prologue && GAME.prologue.on && GAME.prologue.on() && GAME.prologue.pos) {
      who.push({ ci: GAME.prologue.pos(), color: 0xffd166, scale: sc * 1.15, key: 'lord' });
    } else {
      var pc = GAME.currentCity && GAME.currentCity();
      if (pc && pc.ci != null) who.push({ ci: pc.ci, color: 0x8fd4ff, scale: sc, key: 'city' });
    }
    var stc = (GAME.state && GAME.state._standCi);
    if (stc != null && stc >= 0) who.push({ ci: stc, color: 0xcfd6df, scale: sc * 0.95, key: 'stand' });
    who.forEach(function (w) {
      var g = makeFigure(w.color, w.scale);
      if (!placeFigure(g, w.ci)) return;
      figCache[w.key] = { g: g, ci: w.ci };
      figRoot.add(g);
    });
  }
  /* ============================================================
   * v153b（老板：「可以在星球地表上逐格移动」）——
   * 走路时不是"瞬移一格"，而是**沿地表最短弧插值走过来**（~220ms），
   * 走的那 0.22 秒里腿在摆；到了再触发一次"落脚"动作（`state._walkTo` 清空）。
   * 地图上其他人（战斗单位）走地表由 `M.surfaceWalk()` 同一套插值处理。
   * ============================================================ */
  var walkAnim = null;          /* { key, from:{pos,quat}, to:ci, t0, dur } */
  M.walkDur = 220;              /* v153: 走一格用多少毫秒（玩家可感知的位移时长） */
  function slerpVec(a, b, t) {
    var dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    dot = Math.max(-1, Math.min(1, dot));
    var th = Math.acos(dot) || 1e-6;
    var s1 = Math.sin((1 - t) * th) / Math.sin(th), s2 = Math.sin(t * th) / Math.sin(th);
    return [a[0] * s1 + b[0] * s2, a[1] * s1 + b[1] * s2, a[2] * s1 + b[2] * s2];
  }
  function startWalk(key, g, ci) {
    var c = _tileCells && _tileCells[ci];
    if (!c || !c.dir) return false;
    /* 终点姿态：按终点格重算一次（照 placeFigure 的算法），只取姿态不落位 */
    var d = c.dir;
    var n = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    var qTo = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    var spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((ci % 360) * Math.PI / 180));
    qTo.multiply(spin);
    walkAnim = {
      key: key, g: g, to: ci, t0: Date.now(), dur: (M.walkDur || 220),
      fromPos: g.position.clone(),
      toDir: [n.x, n.y, n.z],
      fromQ: g.quaternion.clone(),
      toQ: qTo
    };
    return true;
  }
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
  /* 把一件物品坐到某格上：+Y 对法线、贴地表、再绕竖轴转 yaw（度）。 */
  function seatProp(g, ci, yawDeg) {
    var c = _tileCells && _tileCells[ci];
    if (!c || !c.dir) return false;
    var d = c.dir;
    var rr = R + Math.max(0, sphElev(d)) * HSC + 0.05;
    g.position.set(d[0] * rr, d[1] * rr, d[2] * rr);
    var n = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    g.rotateY((+yawDeg || 0) * Math.PI / 180);
    g.userData.ci = ci;
    return true;
  }
  function buildPlacements() {
    if (plRoot) { scene.remove(plRoot); disposeTree(plRoot); plRoot = null; }
    var PLc = GAME.place;
    if (!PLc || !PLc.all) return;
    var all = PLc.all(), sc = propScale();
    plRoot = new THREE.Group();
    for (var ci in all) {
      var rec = all[ci]; if (!rec) continue;
      var it = PLc.item(rec.i); if (!it) continue;
      var g = makeProp(it, null);
      if (!seatProp(g, +ci, rec.y)) { disposeTree(g); continue; }
      g.scale.setScalar(sc * (+rec.s || 1));
      plRoot.add(g);
    }
    scene.add(plRoot);
  }
  M.buildPlacements = buildPlacements;

  /* 幽灵预览：手上拿着东西时跟着格子走。itemId 为空或 ci<0 → 清掉。
     合法=原色半透明；非法（未探明 / 已占用）= 整件染红，玩家一眼看出放不下。 */
  M.ghost = function (itemId, ci) {
    M.clearGhost();
    var PLc = GAME.place;
    if (!PLc || !itemId || !(ci >= 0)) return false;
    var it = PLc.item(itemId); if (!it) return false;
    var chk = PLc.canPlace ? PLc.canPlace(ci, itemId) : { ok: true };
    var g = makeProp(it, chk.ok ? 'ok' : 'bad');
    if (!seatProp(g, +ci, 0)) { disposeTree(g); return false; }
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
    /* 第一次调用时 figRoot 还不存在 —— 先建出来 */
    if (!figRoot) {
      if (GAME.prologue && GAME.prologue.on && GAME.prologue.on()) {
        /* 前传首帧：直接把小人摆在当前格（原地，不播走路） */
        var p0 = GAME.prologue.pos();
        if (M.buildLordWalking(p0, p0)) { walkAnim = null; M._standVer = 'p' + p0 + '|||' + (_tileCells || []).length; return; }
      }
      buildFigures();
      return;
    }
    /* ① 正在走的那一个：沿地表弧线插值位置 + 姿态（含朝向） */
    if (walkAnim) {
      var w = walkAnim, c2w = _tileCells && _tileCells[w.to];
      var kw = Math.min(1, (Date.now() - w.t0) / w.dur);
      var ew = kw * kw * (3 - 2 * kw);
      if (c2w && c2w.dir) {
        var rTo = R + Math.max(0, sphElev(w.toDir)) * HSC + 0.55;
        var rr0 = w.fromPos.length();
        var rr2 = rr0 + (rTo - rr0) * ew + Math.sin(Math.PI * kw) * 0.8;
        var curDir = w.fromPos.clone().normalize();
        var dir3 = slerpVec([curDir.x, curDir.y, curDir.z], w.toDir, ew);
        w.g.position.set(dir3[0] * rr2, dir3[1] * rr2, dir3[2] * rr2);
        if (w.fromQ && w.toQ) w.g.quaternion.copy(w.fromQ).slerp(w.toQ, ew);
        if (w.g.userData && w.g.userData.legs) {
          var sw2 = Math.sin(Date.now() / 70) * 0.5;
          w.g.userData.legs[0].rotation.x = sw2;
          w.g.userData.legs[1].rotation.x = -sw2;
        }
        if (kw >= 1) {
          if (w.g.userData && w.g.userData.legs) {
            w.g.userData.legs[0].rotation.x = 0;
            w.g.userData.legs[1].rotation.x = 0;
          }
          walkAnim = null;
        }
      } else walkAnim = null;
      /* 走路期间不许重建（否则会被刷新成"直接站在终点"） */
      if (walkAnim) return;
    }
    /* ② 谁该站在哪 —— 版本变化才重建（换格只挪） */
    var ver = (GAME.prologue && GAME.prologue.on && GAME.prologue.on() && GAME.prologue.pos ? ('p' + GAME.prologue.pos()) : '')
      + '|' + ((GAME.state && GAME.state._standCi) || '')
      + '|' + (GAME.currentCity && GAME.currentCity() ? (GAME.currentCity().ci || '') : '')
      + '|' + ((_tileCells || []).length);
    if (ver !== M._standVer) {
      M._standVer = ver;
      var lordCi = (GAME.prologue && GAME.prologue.on && GAME.prologue.on() && GAME.prologue.pos) ? GAME.prologue.pos() : null;
      var lordFig = figCache.lord && figCache.lord.g;
      if (lordCi != null && lordFig && figCache.lord.ci !== lordCi && !walkAnim) {
        figCache.lord.ci = lordCi;
        startWalk('lord', lordFig, lordCi);
        return;
      }
      buildFigures();
      return;
    }
    /* ③ 站着时轻微呼吸/摆手（只在有人时做，开销可忽略） */
    var t = (Date.now() % 2000) / 2000;
    Object.keys(figCache).forEach(function (k) {
      var f = figCache[k], g = f.g;
      if (!g || !g.userData || !g.userData.legs) return;
      var br = Math.sin(t * Math.PI * 2) * 0.05;
      g.scale.y = (g.userData.baseScale || g.scale.y) * (1 + br * 0.1);
    });
  }
  /* v153d：前传里"当前格"小人的唯一建法 —— 先摆到**上一格**，再沿地表走一步。
     （syncFigures 里只拦 ver 变化、buildFigures 里没有 from 信息 —— 那是 bug。） */
  M.buildLordWalking = function (fromCi, toCi) {
    if (figRoot) { scene.remove(figRoot); figRoot = null; }
    figCache = {};
    figRoot = new THREE.Group();
    scene.add(figRoot);
    var cellW = Math.sqrt((4 * Math.PI * R * R / Math.max(1, (_tileCells || []).length)) || 1);
    var sc = Math.max(0.8, Math.min(5.0, cellW * 0.45 / 1.2));
    var g = makeFigure(0xffd166, sc * 1.15);
    if (!placeFigure(g, fromCi)) return false;
    figCache.lord = { g: g, ci: toCi };
    figRoot.add(g);
    /* 记下版本，免得 syncFigures 在走路途中又重建一次 */
    M._standVer = 'p' + toCi + '|' + ((GAME.state && GAME.state._standCi) || '')
      + '|' + (GAME.currentCity && GAME.currentCity() ? (GAME.currentCity().ci || '') : '')
      + '|' + ((_tileCells || []).length);
    startWalk('lord', g, toCi);
    return true;
  };
  M.buildFigures = buildFigures;
  M.syncFigures = syncFigures;
  /* v153：给脚本/测试看小人此刻的真实世界坐标与所在格（只读出口） */
  M.figureOf = function (key) {
    var f = figCache[key || 'lord'];
    if (!f || !f.g) return null;
    return { ci: f.ci, pos: [f.g.position.x, f.g.position.y, f.g.position.z], walking: !!walkAnim };
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
    var hit = rc.intersectObject(M._collider, false);
    if (!hit.length) { M._cell = null; if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas(); return; }
    /* v155h：低模拾取壳 → 命中点方向 → 最近格 */
    var _hp = hit[0].point;
    var ci = (SP && SP.nearestCell) ? SP.nearestCell([_hp.x, _hp.y, _hp.z]) : -1;
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
    if (GAME.prologue && GAME.prologue.on && GAME.prologue.on() && GAME.prologue.mapClick) {
      var pr = GAME.prologue.mapClick(ci);
      if (pr && pr.msg && GAME.ui && GAME.ui.toast) GAME.ui.toast(pr.msg);
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      return;
    }
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
      var _res = GAME.place.add(ci, _pid);
      if (_ui2.toast) {
        var _itm = GAME.place.item(_pid);
        _ui2.toast(_res.ok ? ('🧱 已放下：' + (_itm ? _itm.name : _pid)) : ('⚠ ' + _res.msg));
      }
      M._ghostCi = -1; M.clearGhost();
      if (_ui2.renderMapCanvas) _ui2.renderMapCanvas();
      return;
    }
    /* v92：**未探明的格子点不进去** —— 这是迷雾真正的玩法后果。
       不做成"点开发现是空的"：那只是把信息藏一层，玩家照样能靠点击扫图。
       整片未探明 = 地图上没有这一带，得先派人过去（这里连地形都不给看）。 */
    if (fogHides(ci)) {
      M._cell = cell; M._cellKind = 'unknown';
      /* v152（老板：「点哪都是'那边还没探明'」）：未探明**不再是一次性提示**，
         而是一个能落地的选择 —— 派队过去（抵达即显形），而不是把人挡在门外。
         前传另有 P.mapClick 在上面先接走（走过去本身就是探路）。 */
      if (GAME.ui && GAME.ui.openExpModal) {
        try {
          GAME.ui.openExpModal({ kind: 'wild', ci: ci },
            { hint: '未探明 —— 派一队过去，抵达后周围就会显现' });
        } catch (e0) { /* 打不开发征面板也不要挡住地图 */ }
      } else if (GAME.ui && GAME.ui.toast) {
        GAME.ui.toast('🌫 这一带还没有记载 —— 派一队过去就能看见');
      }
      if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
      return;
    }
    M._cell = cell;
    var kind = (M.cellKind && M.cellKind[ci]) || 'wild';   /* 地块属性：野地/城市/据点/行政城/己方城 */
    M._cellKind = kind;
    var reg = M.regionAt(ci);                                  /* 该地块的省/市/区归属 */
    /* ============================================================
     * ⛔ v156.15b（老板：「为什么地图上地块现在多了一层菜单，出征侦查详情。这不是套娃吗」）
     * ------------------------------------------------------------
     * v156.15 曾在这里先弹一条「⚔出征 / 🔍侦查 / 📜详情」的短条，点「详情」才开原面板。
     * 那是**把 1 步变成 2 步**：这三个动作原本就在面板里（未占野地底部「侦查/掠夺/占领」
     * 是 v89.152 老板亲自定在菜单底部的）。已整条撤除。
     * 现在的口径：**点地块 = 直接开那一格的面板**，不再有中间层。
     * smoke §580 已改成反向守卫：谁再往这一层加菜单就红。
     * ============================================================ */
    M.openCellPanel(ci);
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
  };
  M.centerOn = function (x, y) {                            /* 相机对准某格（回主城/回本城/灰烬城）· 不高亮 */
    /* v92.241b：centerOn 是"绕球心看某格" —— 必须先把前传留下的贴地焦点清掉，
       否则 dist 是相对**旧那一格**算的，支点还是黏在人物身上。 */
    M._focus = null; M._pendingFocus = null; M.camFree = true;
    var c = GAME.map.lonlatOf(x, y), d = GAME.map.dirOf(c.lon, c.lat);
    camO.yaw = Math.atan2(d[0], d[2]);
    camO.pitch = Math.max(-1.35, Math.min(1.35, c.lat * Math.PI / 180));
    camO.dist = R * 1.9;
    if (GAME.ui && GAME.ui.renderMapCanvas) GAME.ui.renderMapCanvas();
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
      var r = R + Math.max(0, sphElev(d)) * HSC;
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
        var S = (_cellW * 3.2 / _maxDim) * (2 / 3) * (wd.scaleMul || 1);
        mesh.scale.setScalar(S);
        var tg = new THREE.Group(); tg.add(mesh);
        tg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0], d[1], d[2]).normalize());
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
      var mesh = M._wonderSpin;
      if (mesh) mesh.rotation.y += 0.003;
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
