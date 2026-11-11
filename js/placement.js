/* ============================================================
 * placement.js — 地块放置物引擎（P1：纯放置，组件接口预留）
 * ------------------------------------------------------------
 * 老板 2026-10-30：「能不能在地图界面的地块上进行建造，就是放置物体模块，
 *                   像我的世界那样，形成一个标准化的物品放置和组件引擎」。
 *
 * 这个模块只管**数据**：谁在哪一格、放了什么、朝哪儿、什么版本。
 * 渲染（map3d.js）和交互（ui.js / main.js）都不在这里 ——
 * 它们只认 `GAME.place` 这套 API 和 `_ver` 版本号。
 *
 * ── 定下的三条口径（老板拍板）──────────────────────────────
 *   1. **一格一件**：每个六边形格子最多放一件物品，落在格子中心。
 *      数据结构最简单（placements[ci] = item），冲突判定 O(1)，
 *      与既有 `GAME.extGridOf(city)` 同款。
 *   2. **程序化几何**：物品外观由 `geo.parts` 描述（box / cyl / cone /
 *      sphere），不依赖美术资源 —— 想加物品随时加一行目录。
 *   3. **P1 只做放置**：物品目录 + 放置/拆除/旋转 + 存档。
 *      `COMPONENTS` 钩子（onPlace/onTick/onRemove/save/load）**先预留**，
 *      P2 再实现具体组件（产出 / 存储 / 防御 / 光照）。
 *
 * ── 存档 ──────────────────────────────────────────────────
 * 存档是整体序列化 `state`（`savePayload` 只剥 `grid`），
 * 所以放置物挂在 `state.placements` 上就**自动入档**，不用改 save/load。
 * 按星球 id 分桶 —— 换星球不串味：
 *     state.placements = { <pid>: { <ci>: { i, y, s, t } } }
 *     i=物品id  y=朝向(度)  s=缩放  t=放置时刻
 *
 * ⚠️ 刻意不做的事（P1）：
 *   · 不扣资源（`PL.free = true`）。目录里带 `cost` 字段，等经济系统接好再开闸。
 *   · 不做格内子坐标 / 三维碰撞。
 *   · 不跑组件 tick（`PL.tick()` 留着，但没人调 —— 接了才会跑）。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var PL = GAME.place = {};

  /* ============================================================
   * 1. 物品目录
   * ------------------------------------------------------------
   * geo.parts 的每个零件：
   *   { k:'box'|'cyl'|'cone'|'sphere', w,h,d, r, y, c, x, z, rx }
   *   w/h/d = 尺寸（世界单位，1 ≈ 一格宽的 0.35）；r = 半径（cyl/cone/sphere）
   *   x/y/z = 相对格心的偏移（y 为沿法线向上）；c = 颜色；rx = 绕 x 轴翻（度）
   * 整件物品的占地宽度 = `w`，高度 = `h`（渲染层用它做视距剔除与幽灵比例）。
   * ============================================================ */
  var ITEMS = {
    /* ============================================================
     * v157.18（老板「比如说植物、树木、鱼塘这种」）—— 第一批"活着的"微景观
     * ------------------------------------------------------------
     * 全部走**程序化几何**（box/cyl/cone/sphere），不引美术资源：
     * 想加一件就是加一条目录，重建即生效。
     * ⚠️ 地表限制**只写在下方 GROUND 表**（唯一出口）——这里不写 ground 字段，
     *    否则两处定义迟早打架。
     * ============================================================ */
    tree: {
      id: 'tree', name: '大树', tag: 'plant', w: 1.0, h: 3.0,
      desc: '一棵能遮阴的树。风一吹，树冠会跟着摆。',
      cost: { wood: 2 },
      geo: { parts: [
        { k: 'cyl', r: 0.11, h: 1.30, y: 0.65, c: 0x6b4a2f },
        { k: 'cone', r: 0.62, h: 1.20, y: 1.70, c: 0x3f7a3c },
        { k: 'cone', r: 0.46, h: 1.00, y: 2.35, c: 0x4a8a44 },
        { k: 'cone', r: 0.28, h: 0.72, y: 2.90, c: 0x55984c }
      ] }
    },
    bush: {
      id: 'bush', name: '灌木', tag: 'plant', w: 0.7, h: 0.9,
      desc: '低矮的一丛，能结野果。放在路边不挡道。',
      cost: { wood: 1 },
      geo: { parts: [
        { k: 'sphere', r: 0.34, y: 0.30, c: 0x3e6f38 },
        { k: 'sphere', r: 0.24, y: 0.42, x: 0.18, c: 0x4a7f40 },
        { k: 'sphere', r: 0.20, y: 0.36, z: -0.16, c: 0x386530 }
      ] }
    },
    pond: {
      id: 'pond', name: '鱼塘', tag: 'water', w: 1.1, h: 0.5,
      desc: '挖出来的一汪水。能养鱼，也能当景看。',
      cost: { stone: 6 },
      geo: { parts: [
        { k: 'box', w: 1.15, h: 0.12, d: 1.15, y: 0.06, c: 0x8a8577 },
        { k: 'box', w: 1.00, h: 0.06, d: 1.00, y: 0.14, c: 0x3d7fa8 },
        { k: 'box', w: 0.20, h: 0.22, d: 0.20, x: 0.52, z: 0.52, y: 0.11, c: 0x7d7869 }
      ] }
    },
    fence: {
      id: 'fence', name: '矮栏', tag: 'def', w: 1.0, h: 1.0,
      desc: '一圈矮木栏。划出院子、拦一拦牲口。',
      cost: { wood: 3 },
      geo: { parts: [
        { k: 'box', w: 0.10, h: 0.95, d: 0.10, x: -0.45, y: 0.48, c: 0x6b4a2f },
        { k: 'box', w: 0.10, h: 0.95, d: 0.10, x: 0.45, y: 0.48, c: 0x6b4a2f },
        { k: 'box', w: 1.00, h: 0.09, d: 0.06, y: 0.72, c: 0x7d5a3a },
        { k: 'box', w: 1.00, h: 0.09, d: 0.06, y: 0.42, c: 0x7d5a3a }
      ] }
    },
    hut: {
      id: 'hut', name: '木屋', tag: 'live', w: 1.0, h: 1.8,
      desc: '一间能住人的小木屋。得建在平整的台地上（山地先整平）。',
      cost: { wood: 12, stone: 4 },
      geo: { parts: [
        { k: 'box', w: 0.86, h: 0.72, d: 0.86, y: 0.36, c: 0x8a6a45 },
        { k: 'cone', r: 0.72, h: 0.62, y: 1.03, c: 0x7a4a34 },
        { k: 'box', w: 0.18, h: 0.34, d: 0.06, y: 0.17, z: 0.44, c: 0x4a3020 }
      ] }
    },
    cairn: {
      id: 'cairn', name: '石堆', tag: 'decor', w: 0.9, h: 1.1,
      desc: '几块垒起来的石头。路过的人会加一块，所以它只会越长越高。',
      cost: { stone: 2 },
      geo: { parts: [
        { k: 'box', w: 0.90, h: 0.30, d: 0.90, y: 0.15, c: 0x8a8577 },
        { k: 'box', w: 0.66, h: 0.28, d: 0.66, y: 0.43, c: 0x9b9689 },
        { k: 'box', w: 0.44, h: 0.24, d: 0.44, y: 0.68, c: 0x7d7869 },
        { k: 'cone', r: 0.16, h: 0.34, y: 0.94, c: 0xb0aa9c }
      ] }
    },
    totem: {
      id: 'totem', name: '图腾柱', tag: 'decor', w: 0.8, h: 2.2,
      desc: '一根刻满眼睛的柱子。没人记得它最初刻的是谁。',
      cost: { wood: 6 },
      geo: { parts: [
        { k: 'cyl', r: 0.34, h: 0.18, y: 0.09, c: 0x6b5f4e },
        { k: 'box', w: 0.34, h: 1.60, d: 0.34, y: 0.98, c: 0x7a6a54 },
        { k: 'box', w: 0.46, h: 0.22, d: 0.46, y: 1.62, c: 0x8d5f3c },
        { k: 'cone', r: 0.28, h: 0.44, y: 1.94, c: 0x9d6b45 }
      ] }
    },
    watchtower: {
      id: 'watchtower', name: '望塔', tag: 'sight', w: 1.1, h: 3.0,
      desc: '四根柱子撑起一个平台。站上去能多看两格 —— 前提是它还没塌。',
      cost: { wood: 14, stone: 4 },
      geo: { parts: [
        { k: 'cyl', r: 0.14, h: 2.20, y: 1.10, c: 0x6d5c48, x: -0.32, z: -0.32 },
        { k: 'cyl', r: 0.14, h: 2.20, y: 1.10, c: 0x6d5c48, x: 0.32, z: -0.32 },
        { k: 'cyl', r: 0.14, h: 2.20, y: 1.10, c: 0x6d5c48, x: -0.32, z: 0.32 },
        { k: 'cyl', r: 0.14, h: 2.20, y: 1.10, c: 0x6d5c48, x: 0.32, z: 0.32 },
        { k: 'box', w: 1.00, h: 0.16, d: 1.00, y: 2.28, c: 0x7d6a52 },
        { k: 'cone', r: 0.62, h: 0.52, y: 2.62, c: 0x8a5c3b }
      ] }
    },
    banner: {
      id: 'banner', name: '旗标', tag: 'mark', w: 0.7, h: 2.4,
      desc: '一面布。它不挡风，也不挡人，只告诉别人"这儿有人来过"。',
      cost: { wood: 3, cloth: 2 },
      geo: { parts: [
        { k: 'cyl', r: 0.07, h: 2.20, y: 1.10, c: 0x5f5140 },
        { k: 'box', w: 0.06, h: 0.90, d: 0.52, y: 1.85, c: 0xc0483c, x: 0.06 }
      ] }
    },
    brazier: {
      id: 'brazier', name: '火盆', tag: 'light', w: 0.8, h: 1.0,
      desc: '夜里能照出一圈光。也照出你不想看见的东西。',
      cost: { stone: 3, wood: 2 },
      geo: { parts: [
        { k: 'cyl', r: 0.16, h: 0.44, y: 0.22, c: 0x5b544a },
        { k: 'cyl', r: 0.38, h: 0.24, y: 0.56, c: 0x6d6357 },
        { k: 'cone', r: 0.26, h: 0.46, y: 0.90, c: 0xff8a3c }
      ] }
    },
    crate: {
      id: 'crate', name: '补给箱', tag: 'store', w: 0.9, h: 0.8,
      desc: '钉死的木箱。里面是什么取决于你最后一次补给还剩什么。',
      cost: { wood: 5 },
      geo: { parts: [
        { k: 'box', w: 0.86, h: 0.66, d: 0.86, y: 0.33, c: 0x7a6448 },
        { k: 'box', w: 0.90, h: 0.08, d: 0.90, y: 0.66, c: 0x5f4e37 }
      ] }
    },
    palisade: {
      id: 'palisade', name: '木栅', tag: 'def', w: 1.1, h: 1.6,
      desc: '削尖的木桩围一圈。挡不住大军，但能让狼多想两秒。',
      cost: { wood: 8 },
      geo: { parts: [
        { k: 'box', w: 1.05, h: 0.14, d: 0.18, y: 0.72, c: 0x6f5c45 },
        { k: 'cone', r: 0.11, h: 0.30, y: 1.42, c: 0x7d6a50, x: -0.44 },
        { k: 'cone', r: 0.11, h: 0.30, y: 1.42, c: 0x7d6a50, x: -0.14 },
        { k: 'cone', r: 0.11, h: 0.30, y: 1.42, c: 0x7d6a50, x: 0.14 },
        { k: 'cone', r: 0.11, h: 0.30, y: 1.42, c: 0x7d6a50, x: 0.44 }
      ] }
    },
    shrine: {
      id: 'shrine', name: '神龛', tag: 'relic', w: 1.0, h: 1.8,
      desc: '供着没人叫得出名字的东西。香火断了很久，石头还在。',
      cost: { stone: 8 },
      geo: { parts: [
        { k: 'box', w: 1.00, h: 0.22, d: 1.00, y: 0.11, c: 0x6a6559 },
        { k: 'box', w: 0.72, h: 1.00, d: 0.72, y: 0.72, c: 0x827b6c },
        { k: 'box', w: 0.94, h: 0.16, d: 0.94, y: 1.30, c: 0x716a5c },
        { k: 'sphere', r: 0.22, y: 1.58, c: 0xd8c98a }
      ] }
    },
    /* ---- 水面类（v92.241 · 老板：「有些船舶或者浮台类的，可以在海洋上」）---- */
    pontoon: {
      id: 'pontoon', name: '浮台', tag: 'water', ground: 'water', w: 1.3, h: 0.5,
      desc: '几只空桶扎成的台子。踩上去晃，但能站人、能堆货。',
      cost: { wood: 10 },
      geo: { parts: [
        { k: 'box', w: 1.30, h: 0.20, d: 1.00, y: 0.06, c: 0x8a7355 },
        { k: 'cyl', r: 0.20, h: 0.92, y: 0.02, c: 0x6f5c45, x: -0.40, z: -0.30, rx: 90 },
        { k: 'cyl', r: 0.20, h: 0.92, y: 0.02, c: 0x6f5c45, x: 0.40, z: -0.30, rx: 90 },
        { k: 'cyl', r: 0.20, h: 0.92, y: 0.02, c: 0x6f5c45, x: -0.40, z: 0.30, rx: 90 },
        { k: 'cyl', r: 0.20, h: 0.92, y: 0.02, c: 0x6f5c45, x: 0.40, z: 0.30, rx: 90 }
      ] }
    },
    boat: {
      id: 'boat', name: '小舟', tag: 'water', ground: 'water', w: 0.9, h: 0.6,
      desc: '一条只能坐两个人的船。它去不了远海，但足够过一条河。',
      cost: { wood: 8 },
      geo: { parts: [
        { k: 'box', w: 0.42, h: 0.26, d: 0.90, y: 0.10, c: 0x7a6244 },
        { k: 'box', w: 0.20, h: 0.30, d: 0.86, y: 0.26, c: 0x6b5439 },
        { k: 'box', w: 0.06, h: 0.70, d: 0.06, y: 0.55, c: 0x5f4c33 }
      ] }
    },
    pier: {
      id: 'pier', name: '栈桥', tag: 'water', ground: 'coast', w: 1.2, h: 0.6,
      desc: '从岸边伸出去的几块板。有它，船才知道该停在哪。',
      cost: { wood: 12, stone: 4 },
      geo: { parts: [
        { k: 'box', w: 0.70, h: 0.14, d: 1.20, y: 0.28, c: 0x8a7355 },
        { k: 'cyl', r: 0.08, h: 0.60, y: 0.10, c: 0x6b5439, x: -0.22, z: 0.40 },
        { k: 'cyl', r: 0.08, h: 0.60, y: 0.10, c: 0x6b5439, x: 0.22, z: 0.40 },
        { k: 'cyl', r: 0.08, h: 0.60, y: 0.10, c: 0x6b5439, x: -0.22, z: -0.40 },
        { k: 'cyl', r: 0.08, h: 0.60, y: 0.10, c: 0x6b5439, x: 0.22, z: -0.40 }
      ] }
    }
  };
  /* ============================================================
   * 1b. 落地要求 —— **按建筑类型区分地形**（v92.241 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「星球表面的建造只允许在平原地带进行，或者至少要对建筑类型进行区分；
   *   比如船舶/浮台类可以在海洋上；对地面平整度有要求，高山不太适合建造。」
   *
   * ground：
   *   'flat'  —— 只能建在**平原类**（平地/草原）且起伏不超过 slopeMax 的格子上
   *   'land'  —— 任意陆地（含森林/荒漠；**山地不行**，山坡立不住）
   *   'water' —— 只能在**水面**（海 e<0 或湖泊）
   *   'coast' —— 水陆交界的格子（有一侧是水、一侧是陆）
   * slopeMax：单位是**世界单位**（一格约 21 弧长，陆地高差 ≈1，山峰 ≈40）。
   *   判定口径与 SP 的 HSC 一致：高差(e) × HSC。改这块阈值就能整体松/紧。
   * ============================================================ */
  /* 阈值来自**实测标定**（seed 4321 · 40962 格 · HSC=26 · 只比同侧邻格）：
   *   plain   坡度 p50=1.48  p75=1.88  p90=2.18  max=4.05
   *   caoyuan 坡度 p50=2.12  p75=2.63  p90=3.18
   *   hill    坡度 p50=3.14  p75=3.90  p90=4.70  max=8.07
   *   forest  坡度 p75=2.88 · desert 1.95 · zhaoze 1.89
   * 取 2.2~2.8 → 平地绝大多数可建、草原约七成可建；取 5~6.5 → 森林/荒漠/湿地大体可建。 */
  var GROUND = {
    cairn: { g: 'land', slopeMax: 12 },        /* 石堆：本来就在山里堆的，几乎不挑 */
    totem: { g: 'flat', slopeMax: 2.8 },       /* 柱子要立正 */
    watchtower: { g: 'flat', slopeMax: 2.5 },  /* 四根柱脚，差一点就歪 */
    banner: { g: 'land', slopeMax: 5.0 },      /* 插根杆子，坡上也能插 */
    brazier: { g: 'flat', slopeMax: 2.5 },     /* 火盆得放平，不然油会流出来 */
    crate: { g: 'land', slopeMax: 5.5 },       /* 箱子歪着也能堆 */
    palisade: { g: 'land', slopeMax: 6.5 },    /* 栅栏本来就顺着坡走 */
    shrine: { g: 'flat', slopeMax: 2.2 },      /* 神龛：最挑地的一段 */
    pontoon: { g: 'water' },
    boat: { g: 'water' },
    pier: { g: 'coast' },
    /* v157.18 · 第一批微景观 */
    tree: { g: 'land', slopeMax: 7.0 },        /* 树根能抓坡 */
    bush: { g: 'land', slopeMax: 9.0 },        /* 灌木最不挑地 */
    pond: { g: 'flat', slopeMax: 2.5 },        /* 水面必须端平，不然一边高一边低 */
    fence: { g: 'land', slopeMax: 6.0 },       /* 栅栏顺着坡走 */
    hut: { g: 'flat', slopeMax: 2.2 }          /* 屋子最挑地：整平过的台地正好 */
  };
  (function () {
    for (var k in GROUND) {
      if (!ITEMS[k]) continue;
      ITEMS[k].ground = GROUND[k].g;
      if (GROUND[k].slopeMax != null) ITEMS[k].slopeMax = GROUND[k].slopeMax;
    }
  })();
  PL.GROUND = GROUND;
  PL.GROUND_NAME = { flat: '平地', land: '陆地', water: '水面', coast: '岸线' };
  PL.ITEMS = ITEMS;
  PL.list = function () {
    var out = [], k;
    for (k in ITEMS) if (ITEMS[k]) out.push(ITEMS[k]);
    return out;
  };
  PL.item = function (id) { return (id && ITEMS[id]) || null; };

  /* 让别处也能走 DATA 这把尺（将来目录搬进 data.js 时不用改调用方）。 */
  if (GAME.DATA) GAME.DATA.PLACEABLES = ITEMS;

  /* ============================================================
   * 2. 组件注册表（P1：只预留，不实现）
   * ------------------------------------------------------------
   * 用法（P2）：
   *   GAME.place.comp('produce', { onPlace:function(ctx){}, onTick:function(ctx){},
   *                                onRemove:function(ctx){},
   *                                save:function(p){return {};}, load:function(p,o){} });
   *   物品用 `comps:['produce']` 声明自己带哪些组件。
   * ============================================================ */
  var COMPS = {};
  PL.comp = function (id, def) { if (id && def) COMPS[id] = def; return COMPS[id] || null; };
  PL.comps = function () { return COMPS; };

  /* 触发某组件钩子。P1 没有任何组件，`_fire` 就是个空转的安全网 ——
     将来接了组件也不会因为"没人调用"而漏跑。异常一律吞掉：
     一个组件报错不该让整张地图摆不出来。 */
  function _fire(hook, ctx) {
    var it = ctx && PL.item(ctx.i), cs = (it && it.comps) || [];
    for (var i = 0; i < cs.length; i++) {
      var c = COMPS[cs[i]];
      if (!c || typeof c[hook] !== 'function') continue;
      try { c[hook](ctx); } catch (e) { /* 组件异常不影响放置本体 */ }
    }
  }
  PL.fire = _fire;

  /* 每月/每日跑一次（P1 无人调用；P2 由 growth.monthly 或主循环接上）。 */
  PL.tick = function () {
    var b = bucket(); if (!b) return 0;
    var n = 0;
    for (var ci in b) {
      if (!b[ci]) continue;
      _fire('onTick', { ci: +ci, i: b[ci].i, p: b[ci] });
      n++;
    }
    return n;
  };

  /* ============================================================
   * 3. 存档桶
   * ------------------------------------------------------------
   * 按星球 id 分桶：换星球时放置物互不干扰，也不必迁移。
   * ⚠️ 必须在 `GAME.state` 存在时才建桶 —— 模块加载早于建局。
   * ============================================================ */
  var _ver = 1;                       /* 渲染层靠它做增量重建 */

  PL.pid = function () {
    var p = GAME.activePlanetOf && GAME.activePlanetOf();
    var id = (p && p.id) != null ? p.id : (GAME.state && GAME.state.activePlanet);
    return (id != null ? id : 1);
  };

  function root() {
    var s = GAME.state;
    if (!s) return null;
    if (!s.placements || typeof s.placements !== 'object') s.placements = {};
    return s.placements;
  }
  function bucket(create) {
    var r = root(); if (!r) return null;
    var pid = String(PL.pid());
    if (!r[pid] || typeof r[pid] !== 'object') {
      if (!create) return null;
      r[pid] = {};
    }
    return r[pid];
  }
  PL.ver = function () { return _ver; };
  PL.bump = function () { _ver++; return _ver; };
  PL.all = function () { return bucket(false) || {}; };
  /* 方格键：与 GAME.terrain **同一套键**（"i,j"），一条链到底 */
  PL.keyOf = function (i, j) { return (i | 0) + ',' + (j | 0); };
  PL.at = function (i, j) { var b = bucket(false); return (b && b[PL.keyOf(i, j)]) || null; };
  PL.count = function () { var b = bucket(false), n = 0; if (b) for (var k in b) if (b[k]) n++; return n; };

  /* ============================================================
   * 4. 放置规则
   * ------------------------------------------------------------
   * 返回 { ok, msg } —— 交互层直接把 msg 弹出去，渲染层拿 ok 给幽灵上色。
   * ============================================================ */
  /* 单格地形档案 —— 判定"这块地能不能盖"的唯一出口。
     slope = 与**邻格的最大高差**（世界单位）；rough = 平均起伏（做"平不平"的手感指标）。*/
  /* 单格地形档案（**按方格**）—— 判定"这块地能不能盖"的唯一出口。
     slope = 与 4 个邻格的最大高差（世界单位）；rough = 平均起伏。 */
  PL.terrainOf = function (i, j) {
    var md = GAME.map3d, s = GAME.sphere;
    if (!md || !md.gridCellDir || !s || !s.cells) return null;
    var d = md.gridCellDir(i | 0, j | 0);
    if (!d) return null;
    var ci = s.nearestCell ? s.nearestCell(d) : -1;
    var c = s.cells[ci];
    if (!c) return null;
    var HSC = s.HSC || 26, TH = GAME.TERRACE_H || 1;
    /* 高度：已整平 → 台面（折回归一化，与 c.e 同一把尺）；否则格心自然高度 */
    var lv = (GAME.terrain && GAME.terrain.levelAt) ? GAME.terrain.levelAt(i, j) : null;
    var terraced = (lv != null);
    var e = terraced ? (lv * TH / HSC) : (+c.e || 0);
    var selfWet = (e < 0) || (c.type === 'lake') || (c.type === 'ocean');
    var NB = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
    var mx = 0, sum = 0, n = 0, wet = 0, dry = 0;
    for (var q = 0; q < NB.length; q++) {
      var nd = md.gridCellDir(NB[q][0], NB[q][1]);
      if (!nd) continue;
      var nci = s.nearestCell ? s.nearestCell(nd) : -1;
      var nc = s.cells[nci];
      if (!nc) continue;
      /* 邻格也吃整平 —— 两块整到同一层的地，高差必须是 0 */
      var nlv = (GAME.terrain && GAME.terrain.levelAt) ? GAME.terrain.levelAt(NB[q][0], NB[q][1]) : null;
      var ne = (nlv != null) ? (nlv * TH / HSC) : (+nc.e || 0);
      var ncWet = (ne < 0) || (nc.type === 'lake') || (nc.type === 'ocean');
      if (ncWet) wet++; else dry++;
      /* 只跟**同一侧**（陆对陆 / 水对水）比高差：海岸格若跟海底比，
         坡度会被水深拉爆，"海边一小块平地"永远判成陡坡（它恰恰最该能盖房子）。 */
      if (ncWet !== selfWet) continue;
      var dd = Math.abs(ne - e);
      if (dd > mx) mx = dd;
      sum += dd; n++;
    }
    var type = c.type;
    var nm = c.name || ((s.TYPE_NAME || {})[type] || type || '未知');
    var water = (e < 0) || type === 'lake' || type === 'ocean';
    var coast = (wet > 0 && dry > 0) || type === 'zhaoze';
    return {
      i: i | 0, j: j | 0, ci: ci,
      e: +(+e).toFixed(3), type: type, name: nm,
      slope: +(mx * HSC).toFixed(2), rough: +(n ? (sum / n) * HSC : 0).toFixed(2),
      water: water, land: !water, coast: coast,
      plain: !water && (type === 'plain' || type === 'caoyuan'),
      hill: (type === 'hill'),
      terraced: terraced        /* 已整平：人工造地，可建 */
    };
  };

  PL.canPlace = function (i, j, itemId) {
    if (i == null || j == null) return { ok: false, msg: '这儿不是一格地。' };
    var ci = -1;
    var it = PL.item(itemId);
    if (!it) return { ok: false, msg: '没有这种东西可放。' };
    var SPn = GAME.sphere;
    var T0 = PL.terrainOf(i, j);
    if (!T0) return { ok: false, msg: '这儿不是一格地。' };
    ci = T0.ci;
    var F = GAME.fog;
    /* 未探明的格子不许放 —— 否则等于"往没去过的地方空投"。
       ⛔ v157.38（实机体验自检发现）：门槛原来是 **2 级**，而 fog 的 2 级定义是
       "扎过营 / 侦查过 / 打下来过"；**站在地表看得见地形只是 1 级**。
       于是"站在自家城墙外放一棵树"会被拒 —— 提示"这片地还没探明"，
       玩家看着脚下清清楚楚的地面，完全无法理解。
       改成 1 级：见过地形（= 你看得见）就能放；0 级（纯黑）仍然拒绝。 */
    /* ⛔ v157.38（实机体验自检发现，两处叠加）：
       ① 门槛原来是 2（= 扎过营/侦查过）；站在地表看得见地形只有 1。
       ② 更根本：`fog.revealAround` 只在**打完仗**时调用，玩家走到自己的地表
          从来没被点亮过 —— 实测自家城墙外那一格 fog=0。
       于是"站在地上放一棵树"被拒，提示"这片地还没探明"，玩家看着脚下的地想不通。
       口径修正：**地表模式 = 你人在那儿、看得见 = 视为已探明**（`M._surf` 为真时豁免）。
       fog 本身不动（战略视图的未知区仍是未知），只是"放东西"这条不再要求扎过营。 */
    var _surfHere = !!(GAME.map3d && GAME.map3d._surf);
    if (F && F.get && F.get(ci) < 1 && !_surfHere) return { ok: false, msg: '这片地还没探明，放不了。' };
    var b = bucket(false);
    var _bk = PL.keyOf(i, j);
    if (b && b[_bk]) {
      /* v92.246（全面复核补口）：残留的"坏记录"不该继续占位 ——
         物品 id 已从目录删除时它渲染不出来、面板也列不出来（拆不掉），
         却会让这一格永久"已经有东西了"。发现即清，然后当空格处理。 */
      if (!PL.item(b[_bk].i)) { delete b[_bk]; _ver++; }
      else return { ok: false, msg: '这格已经有东西了（先拆再放）。' };
    }
    /* ---- 地形/平整度判定（老板：建造要分地形，高山不能盖，船/浮台下水）---- */
    var T = T0;
    var g = it.ground || 'land';
    if (g === 'water') {
      if (!T.water) return { ok: false, msg: '「' + it.name + '」只能下水 —— 这是' + T.name + '。' };
    } else if (g === 'coast') {
      if (!T.coast) return { ok: false, msg: '「' + it.name + '」要立在水陆交界处（岸线/湿地）。' };
    } else {
      if (T.water) return { ok: false, msg: '水里立不住「' + it.name + '」—— 水面上请用浮台 / 小舟。' };
      if (g === 'flat') {
        /* 结构类：山地不许 —— **但整平过的例外**（人工削出来的台地就是建设用地）。
           这是"整平 → 建造"闭环的另一半：否则玩家把山坡削平了还被告知"山地盖不了"。 */
        if (T.hill && !T.terraced) return { ok: false, msg: '山地太陡，「' + it.name + '」盖不上去（先用 ⛰ 整平削出平台）。' };
        if (!T.plain && !T.terraced) return { ok: false, msg: '「' + it.name + '」要建在平地上 —— 这里是' + T.name + '（可以先整平）。' };
        var sMax = (it.slopeMax != null) ? it.slopeMax : 3;
        if (T.slope > sMax) {
          return { ok: false, msg: '这块地不够平（起伏 ' + T.slope + '，上限 ' + sMax + '）——「' + it.name + '」立不住。' };
        }
      } else {
        /* land：任意陆地，但陡坡仍然不行（用 slopeMax 兜住）*/
        var lMax = (it.slopeMax != null) ? it.slopeMax : 8;
        if (T.slope > lMax) return { ok: false, msg: '坡太陡（起伏 ' + T.slope + '，上限 ' + lMax + '）——「' + it.name + '」搁不住。' };
      }
    }
    return { ok: true, msg: '', terrain: T };
  };

  /* ============================================================
   * 5. 放置 / 拆除 / 旋转
   * ============================================================ */
  PL.add = function (i, j, itemId, opt) {
    var chk = PL.canPlace(i, j, itemId);
    if (!chk.ok) return chk;
    opt = opt || {};
    var b = bucket(true); if (!b) return { ok: false, msg: '世界还没建好。' };
    var rec = {
      i: itemId,
      y: (opt.yaw != null ? +opt.yaw : 0),
      s: (opt.scale != null ? +opt.scale : 1),
      t: Date.now(),
      ci: (chk.terrain && chk.terrain.ci != null) ? chk.terrain.ci : -1
    };
    b[PL.keyOf(i, j)] = rec;
    _fire('onPlace', { i: i, j: j, ci: rec.ci, it: itemId, p: rec });
    _ver++;
    return { ok: true, msg: '', rec: rec };
  };

  PL.remove = function (i, j) {
    var b = bucket(false);
    var k = PL.keyOf(i, j);
    if (!b || !b[k]) return { ok: false, msg: '这格没东西可拆。' };
    var rec = b[k];
    _fire('onRemove', { i: i, j: j, ci: rec.ci, it: rec.i, p: rec });
    delete b[k];
    _ver++;
    return { ok: true, msg: '', rec: rec };
  };

  /* 旋转：默认每次 45°。返回新的朝向（度）。 */
  PL.rotate = function (i, j, step) {
    var b = bucket(false);
    var k = PL.keyOf(i, j);
    if (!b || !b[k]) return { ok: false, msg: '这格没东西可转。' };
    var d = (step != null ? +step : 45);
    b[k].y = ((+b[k].y || 0) + d) % 360;
    if (b[k].y < 0) b[k].y += 360;
    _ver++;
    return { ok: true, msg: '', yaw: b[k].y };
  };

  PL.clear = function () {
    var b = bucket(false); if (!b) return 0;
    var n = 0;
    for (var k in b) if (b[k]) { n++; delete b[k]; }
    _ver++;
    return n;
  };

  /* ============================================================
   * 6. 读档兜底
   * ------------------------------------------------------------
   * `savePayload` 只剥 `grid`，placements 自动往返。但**老档没有这个字段**，
   * 且读档可能带进脏数据（id 不在目录里 / ci 越界） —— 这里统一洗一遍。
   * ============================================================ */
  PL.sanitize = function () {
    var r = root(); if (!r) return 0;
    var SPn = GAME.sphere, dropped = 0, kept = 0;
    for (var pid in r) {
      var b = r[pid];
      if (!b || typeof b !== 'object') { delete r[pid]; continue; }
      for (var key in b) {
        var p = b[key];
        if (!p || !p.i || !PL.item(p.i)) { delete b[key]; dropped++; continue; }
        /* ⛔ v157.42（实机存档往返发现）：**放置物读档全丢** 的根因就在下一行。
           v157.18 把格键从"六边形 ci（纯数字）"改成"方格 "i,j"" 之后，
           这里仍在按 `SPn.cells[+ci]` 校验 —— 而 `+"3,5"` 是 NaN、`cells[NaN]` 恒 undefined，
           于是**每一条都被判成"这颗星球上不存在的格"删掉**。
           实测：存 2 件 → 读档 0 件；整平（terrain）没事，因为它不走这条清理。
           修法：只有**老档的纯数字键**才做 cells 校验；新的 "i,j" 键是切平面坐标，不在球面格集里。 */
        var _oldStyle = !isNaN(+key);
        if (_oldStyle && SPn && SPn.cells && !SPn.cells[+key]) { delete b[key]; dropped++; continue; }
        if (p.y == null) p.y = 0;
        if (p.s == null) p.s = 1;
        kept++;
      }
    }
    _ver++;
    return kept;
  };
})();
