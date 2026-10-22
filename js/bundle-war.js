/*! Deepseekdb bundle-war — 第 2/3 包（8 个模块）
 *  由 .workbuddy/tools/patch/build_bundle.py 生成，请勿手改。
 *  ⚠️ 三包必须按 core → war → ui 顺序加载（window.GAME 全局共享）。 */
/* ---- gltf.js ---- */
/* ============================================================
 * v91.30 gltf.js — **极简 GLB 加载器**（无外链 · 配合 vendor three r150 UMD）
 * ------------------------------------------------------------
 * three r150 的 GLTFLoader 是 ES module；本项目纯静态零外链（vendor three UMD），
 * 且奇观 .glb 经 gltf-transform 优化为**单一网格 + 少量贴图**的规整结构 →
 * 一个 ~150 行的解析器即可，不引 GLTFLoader（避免 r150/r160 兼容与模块化改造）。
 * 支持：单/多 primitive · POSITION/NORMAL/TEXCOORD_0 · 索引 · baseColor/normal 贴图。
 * ⚠️ 仅覆盖我们自己的素材形态；通用 glTF 特性（蒙皮/动画/KHR_draco）不支持。
 * ============================================================ */

(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var GTF = {};

  var CITEM = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  var CNUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

  var CGET = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' };
  function accArray(gltf, bin, ai) {
    var a = gltf.accessors && gltf.accessors[ai];
    if (!a || a.bufferView == null) return null;
    var bv = gltf.bufferViews && gltf.bufferViews[a.bufferView];
    if (!bv) return null;
    var TA = CITEM[a.componentType]; if (!TA) return null;
    var cn = CNUM[a.type]; if (!cn) return null;
    var n = a.count;
    var base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    var es = TA.BYTES_PER_ELEMENT;
    var stride = bv.byteStride || 0;
    /* v91.30：**交错布局**（byteStride ≠ 紧密排列）—— gltf-transform 默认把 pos/norm/uv 塞进
       同一 bufferView 交错存放；此时必须按 stride 逐元素解交错，不能按连续视图读。 */
    if (stride && stride !== cn * es) {
      var dv = new DataView(bin), get = CGET[a.componentType];
      var out = new TA(n * cn);
      for (var i = 0; i < n; i++) for (var c = 0; c < cn; c++) out[i * cn + c] = dv[get](base + i * stride + c * es, true);
      return out;
    }
    return new TA(bin, base, n * cn);
  }

  /* 解析 arrayBuffer（.glb）→ { parts:[{position,nor,uv,count}], textures:[{url,kind}], doubleSided } */
  GTF.parse = function (ab) {
    var dv = new DataView(ab);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('非法 GLB（magic）');
    var total = dv.getUint32(8, true), off = 12, json = null, bin = null;
    while (off < total) {
      var clen = dv.getUint32(off, true), ctype = dv.getUint32(off + 4, true), dOff = off + 8;
      if (ctype === 0x4E4F534A) json = ab.slice(dOff, dOff + clen);       /* 'JSON' */
      else if (ctype === 0x004E4942) bin = ab.slice(dOff, dOff + clen);  /* 'BIN'  */
      off = dOff + clen;
    }
    if (!json) throw new Error('GLB 缺 JSON chunk');
    var gltf = JSON.parse(new TextDecoder('utf-8').decode(json));
    if (!bin) bin = new ArrayBuffer(0);

    /* 贴图（baseColor / normal 两类）→ blob URL */
    function texUrl(ti) {
      if (ti == null) return null;
      var tex = gltf.textures && gltf.textures[ti]; if (!tex) return null;
      /* v91.30：webp 源在 EXT_texture_webp extension 下（非 tex.source）—— gltf-transform 默认如此。 */
      var src = (tex.source != null) ? tex.source
        : (tex.extensions && tex.extensions.EXT_texture_webp ? tex.extensions.EXT_texture_webp.source : null);
      var img = gltf.images && gltf.images[src]; if (!img || img.bufferView == null) return null;
      var bv = gltf.bufferViews[img.bufferView]; if (!bv) return null;
      var bytes = new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength);
      try { return URL.createObjectURL(new Blob([bytes], { type: img.mimeType || 'image/png' })); }
      catch (e) { return null; }
    }

    /* ---- v91.38：**节点变换**（关键修复）----
       我们的奇观 .glb 来自 gltf-transform，scene 名 `convert`、每个 node 带一条
       **四元数旋转**（典型 `[0.7071,0,0,0.7071]` = 绕 X +90°，把导出的 Z-up 转成正统 Y-up）。
       解析器此前**只读 mesh.primitives、完全忽略 nodes[].rotation** → 拿到的是**未旋转**的
       原始 mesh（Z-up），任何"对齐到法线"的后续处理都建立在**错的模型朝向**上
       （老板：「奇观角度颠倒」的根因；某个模型还因轴向差 180° 看着完全翻过来）。
       现按 glTF 规范：从 scene 根**沿 children 复合 TRS**，逐 mesh 求出世界矩阵，
       与 bakeGeometry 同处应用（位置→点变换，法线→方向变换）。 */
    function _q2m(q) {                               /* 四元数 → 3x3 元素（列主序数组） */
      var x = q[0], y = q[1], z = q[2], w = q[3];
      return [
        1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
        2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
        2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
    }
    function _mul(a, b) {                            /* 两个 3x3（列主序）相乘 a·b */
      var o = new Array(9);
      for (var c = 0; c < 3; c++) for (var r = 0; r < 3; r++) {
        o[c * 3 + r] = a[0 * 3 + r] * b[c * 3 + 0] + a[1 * 3 + r] * b[c * 3 + 1] + a[2 * 3 + r] * b[c * 3 + 2];
      }
      return o;
    }
    /* 每个 mesh 索引 → 复合（旋转 3x3 + 平移 3 + 缩放 3）。节点链一般很短。 */
    var _meshXf = {};
    (function () {
      var nodes = gltf.nodes || [];
      var seen = {};
      function nodeXf(n) {
        if (!n) return { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0], s: [1, 1, 1] };
        var r = n.matrix ? [n.matrix[0], n.matrix[1], n.matrix[2], n.matrix[4], n.matrix[5], n.matrix[6], n.matrix[8], n.matrix[9], n.matrix[10]]
          : (n.rotation ? _q2m(n.rotation) : [1, 0, 0, 0, 1, 0, 0, 0, 1]);
        return { r: r, t: n.translation || [0, 0, 0], s: n.scale || [1, 1, 1] };
      }
      /* 复合 父·子（先子缩放着父旋转、再父平移 —— 够这套单节点素材用；多级也正确） */
      function compose(p, c) {
        return {
          r: _mul(p.r, c.r),
          t: [p.r[0] * (c.s[0] * c.t[0]) + p.r[3] * (c.s[1] * c.t[1]) + p.r[6] * (c.s[2] * c.t[2]) + p.t[0],
              p.r[1] * (c.s[0] * c.t[0]) + p.r[4] * (c.s[1] * c.t[1]) + p.r[7] * (c.s[2] * c.t[2]) + p.t[1],
              p.r[2] * (c.s[0] * c.t[0]) + p.r[5] * (c.s[1] * c.t[1]) + p.r[8] * (c.s[2] * c.t[2]) + p.t[2]],
          s: [p.s[0] * c.s[0], p.s[1] * c.s[1], p.s[2] * c.s[2]],
        };
      }
      function rec(ni, acc) {
        if (ni == null || seen[ni]) return; seen[ni] = 1;
        var n = nodes[ni]; if (!n) return;
        var xf = compose(acc, nodeXf(n));
        if (n.mesh != null) _meshXf[n.mesh] = xf;
        (n.children || []).forEach(function (ci) { rec(ci, xf); });
      }
      var root = { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0], s: [1, 1, 1] };
      var scene = (gltf.scenes && gltf.scenes[gltf.scene == null ? 0 : gltf.scene]) || (gltf.scenes && gltf.scenes[0]);
      var roots = (scene && scene.nodes) || (gltf.nodes || []).map(function (_, i) { return i; });
      roots.forEach(function (ri) { rec(ri, root); });
    })();
    function xfPoint(xf, p) {                        /* 点 = R·(S·v) + T */
      var vx = p[0] * xf.s[0], vy = p[1] * xf.s[1], vz = p[2] * xf.s[2], r = xf.r;
      return [r[0] * vx + r[3] * vy + r[6] * vz + xf.t[0],
              r[1] * vx + r[4] * vy + r[7] * vz + xf.t[1],
              r[2] * vx + r[5] * vy + r[8] * vz + xf.t[2]];
    }
    function xfDir(xf, p) {                           /* 方向 = R·v（不吃平移/缩放） */
      var r = xf.r;
      return [r[0] * p[0] + r[3] * p[1] + r[6] * p[2],
              r[1] * p[0] + r[4] * p[1] + r[7] * p[2],
              r[2] * p[0] + r[5] * p[1] + r[8] * p[2]];
    }
    function _isIdentity(xf) {
      return !xf || (xf.r[0] === 1 && xf.r[4] === 1 && xf.r[8] === 1 && xf.r[1] === 0 && xf.r[2] === 0 && xf.r[3] === 0
        && xf.r[5] === 0 && xf.r[6] === 0 && xf.r[7] === 0 && xf.t[0] === 0 && xf.t[1] === 0 && xf.t[2] === 0 && xf.s[0] === 1);
    }

    var parts = [];
    (gltf.meshes || []).forEach(function (mesh, mi) {
      var xf = _meshXf[mi];
      (mesh.primitives || []).forEach(function (prim) {
        if ((prim.mode != null) && prim.mode !== 4) return;   /* 只取三角形 */
        var at = prim.attributes || {};
        if (at.POSITION == null) return;
        var pos = accArray(gltf, bin, at.POSITION); if (!pos) return;
        var nor = (at.NORMAL != null) ? accArray(gltf, bin, at.NORMAL) : null;
        var uv = (at.TEXCOORD_0 != null) ? accArray(gltf, bin, at.TEXCOORD_0) : null;
        var idx = (prim.indices != null) ? accArray(gltf, bin, prim.indices) : null;
        /* v91.38：应用节点复合变换（原地写回副本 —— 视图可能共享 bin，必须拷一份）。 */
        if (xf && !_isIdentity(xf)) {
          var cp = new Float32Array(pos.length), i3;
          for (i3 = 0; i3 < pos.length; i3 += 3) { var q = xfPoint(xf, [pos[i3], pos[i3 + 1], pos[i3 + 2]]); cp[i3] = q[0]; cp[i3 + 1] = q[1]; cp[i3 + 2] = q[2]; }
          pos = cp;
          if (nor) {
            var cn = new Float32Array(nor.length);
            for (i3 = 0; i3 < nor.length; i3 += 3) { var dn = xfDir(xf, [nor[i3], nor[i3 + 1], nor[i3 + 2]]); cn[i3] = dn[0]; cn[i3 + 1] = dn[1]; cn[i3 + 2] = dn[2]; }
            nor = cn;
          }
        }
        var mat = (prim.material != null) ? (gltf.materials[prim.material] || {}) : {};
        var pbr = mat.pbrMetallicRoughness || {};
        parts.push({
          position: pos, nor: nor, uv: uv, idx: idx,
          count: pos.length / 3,
          map: texUrl(pbr.baseColorTexture && pbr.baseColorTexture.index),
          normalMap: texUrl(mat.normalTexture && mat.normalTexture.index),
          metalness: (pbr.metallicFactor != null ? pbr.metallicFactor : 0),
          roughness: (pbr.roughnessFactor != null ? pbr.roughnessFactor : 0.7),
          doubleSided: !!mat.doubleSided,
        });
      });
    });
    return { parts: parts };
  };

  /* 归一化：把几何**居中 + 缩放到长边 = target**（世界单位），返回 {center,scale} 供对齐。 */
  GTF.bakeGeometry = function (part, THREE, target) {
    target = target || 1;
    var pos = part.position, n = pos.length;
    var minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
    for (var i = 0; i < n; i += 3) {
      var x = pos[i], y = pos[i + 1], z = pos[i + 2];
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
    }
    var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, cz = (minz + maxz) / 2;
    var span = Math.max(maxx - minx, maxy - miny, maxz - minz) || 1;
    var s = target / span;
    /* 复制并就地居中缩放（不污染 bin 原数据 —— pos 是共享视图） */
    var p2 = new Float32Array(n);
    for (var j = 0; j < n; j += 3) {
      p2[j] = (pos[j] - cx) * s; p2[j + 1] = (pos[j + 1] - cy) * s; p2[j + 2] = (pos[j + 2] - cz) * s;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p2, 3));
    if (part.nor) geo.setAttribute('normal', new THREE.BufferAttribute(part.nor, 3));
    if (part.uv) geo.setAttribute('uv', new THREE.BufferAttribute(part.uv, 2));
    if (!part.nor) geo.computeVertexNormals();
    if (part.idx) geo.setIndex(new THREE.BufferAttribute(part.idx, 1));
    return geo;
  };

  /* 建材质并把 webp **立即加载**（blob URL 在后续重建可能失效 → 载完即可 revoke）。 */
  GTF.buildMaterial = function (THREE, part, onReady) {
    /* ⚠️ 材质**先建**、再在贴图 onload 里**直接改 material.map**（不能改 mopt —— 构造时已拷贝）。 */
    /* ============================================================
     * v91.38（老板「奇观表面糊成一片，色彩无层次」）——
     * 根因：此前用 **MeshBasicMaterial（不受光）**，还把 normalMap **直接丢弃** →
     *   表面永远满亮、无明暗、无高光 → 近看就是一张**平贴的彩色贴花**（"糊成一片、无层次"）。
     * 改：用 **MeshStandardMaterial（受光）** + **normalMap**（模型自带的法线贴图，恢复凹凸明暗）
     *   + 少量 emissive（用自身贴图当自发光）—— 背光面不至于死黑（奇观常在背光侧），
     *   但**保留明暗层次**（不再满亮平贴）。
     * 回退：无 MeshStandardMaterial（极旧 three）时退回 Basic（行为同改前）。
     * ============================================================ */
    var _std = !!THREE.MeshStandardMaterial;
    var mat = new (_std ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial)({
      side: part.doubleSided ? THREE.DoubleSide : THREE.FrontSide, color: 0xffffff,
    });
    if (_std) {
      /* 无环境贴图 → 金属会发黑，夹到一个低值（奇观多为岩石/金属混材，靠漫反射看形）。 */
      mat.metalness = Math.min(part.metalness != null ? part.metalness : 0, 0.25);
      mat.roughness = (part.roughness != null ? part.roughness : 0.8);
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveIntensity = 0.18;      /* 自发光 = 自身贴图 ×0.18：补背光，但不抹平明暗 */
    }
    /* 统一贴图加载（baseColor / normalMap）；载完回调一次。 */
    var _pending = 0, _done = 0;
    function _finish() { if (onReady && _done === _pending) onReady(); }
    function _load(url, apply) {
      if (!url) return;
      _pending++;
      var bmp = new Image();
      bmp.onload = function () {
        try {
          var tx = new THREE.Texture(bmp); tx.needsUpdate = true;
          if (THREE.SRGBColorSpace && apply !== 'normal') tx.colorSpace = THREE.SRGBColorSpace;
          apply(tx); mat.needsUpdate = true;
        } catch (e) { }
        try { URL.revokeObjectURL(url); } catch (e) { }
        _done++; _finish();
      };
      bmp.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) { } _done++; _finish(); };
      bmp.src = url;
    }
    try {
      _load(part.map, function (tx) {
        mat.map = tx;
        if (_std) mat.emissiveMap = tx;      /* 自发光用自身颜色（保留原贴图色，不加环境光染色） */
      });
      /* v91.38：法线贴图此前被丢弃（"胡乱着色"观感的一因）——现接上，恢复表面凹凸明暗。 */
      if (_std) _load(part.normalMap, function (tx) { mat.normalMap = tx; mat.normalScale = new THREE.Vector2(1, 1); });
      else if (part.normalMap) { try { URL.revokeObjectURL(part.normalMap); } catch (e) { } }
      if (!_pending) _finish();
    } catch (e) { _finish(); }
    return mat;
  };

  GAME.gltf = GTF;
  GAME.gltfVersion = 'v91.30';   /* 成员定义锚（供 audit ⑥ 识别 · 见 audit.js 白名单） */
})();

/* ---- battle.js ---- */
/* ============================================================
 * battle.js  回合制战斗（真实数值版）
 * 速度先手、远程射程优势、英雄四维加成、科技/宝物加成、伤兵营
 * ============================================================ */



(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  GAME.battle = {};

  /* v89.86（整改 P-25）：行军队列抵达结算的「军账守恒」标记 ——
     dispatch 时兵力已扣离本城；此后无论结算成功、目标熄灭还是中途异常，
     兵力都必须有去向（归城 / 驻军 / 伤兵营）。
     `GAME.march.arrive` 在结算前置 false；`GAME.battle.expedition` 在归还点置 true；
     arrive 的失败兜底读它决定是否把兵原路退回（防双重回补）。
     全链路同步执行，不存在跨帧残留。 */
  var _expArmySettled = true;

  /* 科技加成取值（统一入口，避免各处写 GAME.systems.techBonus 冗长判空）
     判据：只要 techBonus 存在就取，缺失时返回 0（保证测试环境可跑） */
  function TB(type) {
    return (GAME.systems && GAME.systems.techBonus) ? GAME.systems.techBonus(type) : 0;
  }

  function totalCount(army) {
    var n = 0;
    for (var id in army) n += army[id];
    return n;
  }
  /* v91.86：星球难度阶梯 —— 守军数量按星球放大（第 1 星球 ×1，既有基线零影响）。
     只放大「常规目标」（野地/据点/NPC 城）；奇观守卫与自家调兵不动。 */
  function scaleGarrison(army, pid) {
    if (!army) return army;
    var k = (GAME.planetScaleOf ? GAME.planetScaleOf(pid) : 1);
    if (!(k > 1.0001)) return army;
    var out = {};
    for (var id in army) out[id] = Math.max(1, Math.round((army[id] || 0) * k));
    return out;
  }
  function totalHp(army, gen) {
    var hp = 0;
    for (var id in army) if (DATA.TROOPS[id]) hp += army[id] * DATA.TROOPS[id].hp;
    /* 生命维持：士兵生命 +3%/级 —— 同等伤害下战损更少 */
    return hp * (1 + TB('hp')) * hpMultOf(gen);
  }
  /* 英雄加成 → 全军生命（v29 · 需求 11 重写；v66 收成一条链）
     * ------------------------------------------------------------
     * ② **只看体力这一条链**：体力满则全军生命厚，刚打完仗体力见底就明显变脆
     *     —— 于是"休整/服止血粉"第一次有了战斗意义。
     *    取值走 GAME.staHpBonus()（界面与战斗同源，不写第二份公式）。
     * v66（老板）：「部分英雄的体力没有加上装备的数值」。根因就是这里：
     *   装备那一列（源数据表的「体力」）原先**在体力之外**又开了一条
     *   `eqHp = min(0.25, 装备体力/10000)` 的路，与"体力→全军生命"并行。
     *   同一个数两个出口 → 界面上的"体力"当然对不上部件栏。
     *   现在装备体力并进体力上限（GAME.staMax），这里那条并行路径**删掉**。
     */
  function hpMultOf(gen) {
    if (!gen) return 1;
    return 1 + (GAME.staHpBonus ? GAME.staHpBonus(gen) : 0);
  }
  /* 兵种速度（影响先手判定）
   * 科技加成各管一类：机动行军→全军、机车操控→机车、传动系统→器械 */
  function spdMultOf(t) {
    var m = 1 + TB('march');
    if (!t) return m;
    if (t.craft) return m * (1 + TB('wheel'));                    // 器械（无人轰炸机/东风快递）
    if (t.ride) {
      /* v89.229：id 模式匹配（/qi$|tieqi|qingji/）退役 —— 兵种重构后 id 无此规律，
         改读 TROOPS 的显式字段 `ride`（原 cav 类的显式化）。 */
      return m * (1 + TB('ride'));                                // 机车
    }
    return m;
  }
  function armySpeed(army) {
    /* 天气：行军速度（雨天 −20% / 雪 −50% / 雾 −30% / 大风 +10%） */
    var wMove = 1;
    if (GAME.story && GAME.story.combatMod) wMove = GAME.story.combatMod().move || 1;
    var spd = 0, n = 0;
    for (var id in army) {
      var t = DATA.TROOPS[id];
      if (t && army[id] > 0) { spd += t.spd * spdMultOf(t) * army[id]; n += army[id]; }
    }
    return (n ? spd / n : 100) * wMove;
  }
  /* 远程占比（射程≥800） */
  function rangeRatio(army) {
    var r = 0, n = 0;
    for (var id in army) {
      var t = DATA.TROOPS[id];
      if (t && army[id] > 0) { if (t.range >= 800) r += army[id]; n += army[id]; }
    }
    return n ? r / n : 0;
  }

  /* 攻方对守方伤害（英雄/科技/宝物加成 + 指挥覆盖限制） */
  function damageOf(attackerArmy, defenderArmy, general, defenderDefBonus, isFirst) {
    var s = GAME.state;
    var sum = 0;
    for (var id in attackerArmy) {
      var t = DATA.TROOPS[id];
      if (!t) continue;
      var cnt = attackerArmy[id];
      if (cnt <= 0) continue;
      /* v89.179：克制系统全撤 —— dice 回退引擎与 tactic 主引擎同口径：
         伤害 = 兵种纸面攻 × 加成链（不再有"打谁 / 被谁打"的对局态因子）。 */
      /* 英雄加成 —— v52 链、v89.96 改双刻度（唯一原子见 domain.js atkPctOf）：
           武力：每 20 点 → 全军攻击 +1%（无上限属性，单独降率）
           装备：每 10 攻击值 → 全军攻击 +1%（v52 口径，有天花板）
           genAttrs.atkPct 是**唯一换算原子**，UI / 战报 / 战斗引擎三处同源；
           旧 `× (1 + a.atk/10000)` 旁路与 tactic 侧的"装备绝对值加法"均已清除。 */
      var atkMult = 1, defMult = 1, cover = 1;
      if (general) {
        var a = GAME.genAttrs(general);
        /* 指挥覆盖：指挥×100 内士兵吃满加成；指挥链路科技再放宽覆盖范围。
           v91.92：换算收敛到 GAME.coverOf（唯一出口，与 tactic / 战力评估同源）——
           变量名仍叫 cover，是因为下面 atkMult/defMult 的写法与断言（smoke 3564）
           都按 `a.atkPct * cover` 守着"加成 × 覆盖率"这条链，不另立第二套写法。 */
        cover = GAME.coverOf(a.tong, 1 + TB('command'), cnt).cover;
        atkMult = 1 + a.atkPct * cover;        // 全军攻击（含装备，见 genAttrs.atkVal）
        defMult = 1 + a.defPct * cover;        // 全军防御（对防守方由调用方传）
      }
      /* 科技 */
      atkMult *= (1 + GAME.systems.techBonus('atk'));
      /* 宝物：冲锋号 */
      if (GAME.systems.buffActive('military') && s.buffs.military.atk) atkMult *= (1 + s.buffs.military.atk);
      /* 英雄羁绊（后台静默加成，界面不提示；v90.93：年号项退役） */
      if (GAME.story) atkMult *= GAME.story.atkMult();
      /* 远程白嫖：射程远超时首轮伤害加成（模拟"后退射杀"） */
      var dmg = cnt * t.atk * atkMult;
      /* 弹道校正：远程射程 +4%/级 */
      var effRange = t.range * (1 + TB('range'));
      if (GAME.story) effRange *= GAME.story.combatMod().archerRange; // 雨天远程射程 −20%
      if (isFirst && effRange >= 1200 && rangeRatio(defenderArmy) < 0.3) dmg *= 1.3; // 远程先手优势
      sum += dmg;
    }
    var defRed = defenderDefBonus || 0;
    return sum * Math.max(0.05, 1 - defRed);
  }

  function applyDamage(army, damage, gen) {
    var hp = totalHp(army, gen);
    if (hp <= 0) { clearArmy(army); return army; }
    var lossFraction = Math.min(1, damage / hp);
    for (var id in army) {
      var per = DATA.TROOPS[id];
      if (!per) continue;
      var loss = Math.floor(army[id] * lossFraction);
      army[id] -= loss;
      if (army[id] <= 0) delete army[id];
    }
    return army;
  }
  function clearArmy(army) { for (var id in army) delete army[id]; }

  function logRound(round, aDmg, dDmg, aRemain, dRemain) {
    return '第' + round + '回合：我军造成 ' + Math.floor(aDmg) + ' 伤害，敌军造成 ' + Math.floor(dDmg) + ' 伤害。我军余 ' + aRemain + '，敌军余 ' + dRemain;
  }

  /* 对外只读：行军速度与先手判定（UI 展示与测试断言共用，
     避免测试只能靠「战斗轮数」间接推测，那种测法极易被伤害饱和掩盖） */
  GAME.battle.armySpeedOf = function (army) { return armySpeed(army); };
  GAME.battle.firstStrike = function (atkArmy, defArmy, atkGen, defGen) {
    var a = armySpeed(atkArmy), d = armySpeed(defArmy);
    /* v26（需求 2）：速度是**五维之一**，口径为「求和计算」——
       英雄速度有多少点，就直接给全军战斗速度加多少点（线性相加）。
       旧写法是 ×(1 + spd/200) 的乘算，高速度英雄被指数放大；
       改成加算后，"每点速度 = 全军速度 +1 点" 这句话才真的成立。 */
    if (atkGen) a += (GAME.genAttrs(atkGen).spd || 0);
    if (defGen) d += (GAME.genAttrs(defGen).spd || 0);
    return a >= d || rangeRatio(atkArmy) > rangeRatio(defArmy) + 0.2;
  };

  /* 下面三个工具原本是本文件私有，v27 起导出给 tactic.js 复用 ——
     避免"两份科技/速度/生命加成公式"各自漂移。 */
  GAME.battle.techOf = TB;
  GAME.battle.spdMult = spdMultOf;
  GAME.battle.hpMult = hpMultOf;

  /* ------------------------------------------------------------
   * 战斗结算入口（v27 · 需求 5）
   * ------------------------------------------------------------
   * 默认走**回合制文字战场**（js/tactic.js）：有战场纵深、有推进、
   * 有逐回合战况，战报里能画出战斗场景。
   * 旧的「整军对拼掷骰」保留为 simulateDice —— 两者签名与返回字段完全一致，
   * 于是出征/行军/伤兵/战报等上层代码一行都不用改。
   * 想回退：state.settings.battleEngine = 'dice'。
   * ------------------------------------------------------------ */
  GAME.battle.simulate = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {
    var s = GAME.state;
    var engine = (s && s.settings && s.settings.battleEngine) || 'tactic';
    if (engine !== 'dice' && GAME.tactic && GAME.tactic.simulate) {
      return GAME.tactic.simulate(atkArmy, atkGen, defArmy, defVal, defGen, opts);
    }
    return GAME.battle.simulateDice(atkArmy, atkGen, defArmy, defVal, defGen, opts);
  };

  /* 模拟战斗（旧引擎：速度先手 + 整军对拼）
   * defVal : 目标「城防值」（聚落 40 / 重镇 60 / 首府 90 / 旧都 110；野地 0；据点 10+等级×4）
   * defGen : 守将（可空）
   * opts   : { sieging: true } 表示攻城 —— 只有攻城才吃「攻城伤害」加成
   */
  GAME.battle.simulateDice = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {
    atkArmy = U.deep(atkArmy); defArmy = U.deep(defArmy);
    opts = opts || {};
    /* v28（需求 0）：侦察单元（nocombat）是侦察单元，两个引擎口径一致 ——
       从战场剔除，因此既不输出也不阵亡。 */
    function stripScouts(a) {
      var o = {};
      for (var k in (a || {})) {
        var t0 = DATA.TROOPS[k];
        if (t0 && t0.nocombat) continue;
        o[k] = a[k];
      }
      return o;
    }
    atkArmy = stripScouts(atkArmy);
    defArmy = stripScouts(defArmy);

    /* 守方防御加成。
       旧写法 min(0.6, defVal × 0.10) 有单位错位：城防值动辄 40~110，
       一乘 0.1 就远超 0.6 上限，导致**聚落与旧都的城防效果完全相同**，
       城防梯度被彻底抹平。改为 /200 线性：聚落 0.20 / 重镇 0.30 / 首府 0.45 / 旧都 0.55。 */
    var defBonus = Math.min(0.85, (defVal || 0) / 200);
    /* 英雄羁绊：守御之力（后台静默）—— 唯一来源 STORY.defMult() */
    if (GAME.story && GAME.story.defMult) defBonus = Math.min(0.9, defBonus + GAME.story.defMult());
    if (defGen) {
      /* v52：守将的防御加成同样走「谋略→防御值→百分比」这条链（含装备/套装防御），
         原来分成 `zm/100` 与 `def/10000` 两笔的地方合成一笔。
         v91.92：再并上「指挥溢出减伤」——指挥够覆盖全军后，多余的指挥转减伤
         （口径见 domain.js coverOf）。⚠️ 本引擎的减伤是**加法封顶 0.9**，
         而 defPct 在后期本身就远超 0.9，所以这里 DR 多半被上限吞掉 ——
         属既有引擎差异（主引擎 tactic 走乘法碰撞，不受此限），不另开旁路。 */
      var ga = GAME.genAttrs(defGen);
      defBonus = Math.min(0.9, defBonus + ga.defPct
        + GAME.coverOf(ga.tong, 1 + TB('command'), totalCount(defArmy)).dr);
    }

    /* 攻方自身减伤：装甲强化（科技）+ 装备护甲 —— 在守方反击时生效。
       此前「装甲强化」与装备 def 只在扮演守方时才算，而玩家**只当攻方**，
       等于这两项完全废弃。v52：攻方的防御也走同一条链（含谋略与装备）。
       v91.92：同上并指挥溢出减伤（同口径）。 */
    var atkDefPct = 0;
    if (atkGen) {
      var ag = GAME.genAttrs(atkGen);
      atkDefPct = ag.defPct + GAME.coverOf(ag.tong, 1 + TB('command'), totalCount(atkArmy)).dr;
    }
    var atkDefBonus = Math.min(0.85, TB('def') + atkDefPct);

    /* 攻城伤害：羁绊「白衣渡江」（v90.93：赛季国策项随年号纪元退役）
       v28（需求 0）：再乘**攻城器械的内建倍率**，并让器械拆城。
       旧引擎保留作回退，但数值口径不能与主引擎（tactic.js）漂移 ——
       否则"切换引擎"等于换了一套规则。 */
    var siegeMult = 1;
    if (opts.sieging && GAME.story && GAME.story.siegeMult) siegeMult = GAME.story.siegeMult();
    var craftN = 0;
    if (opts.sieging) {
      for (var ck in atkArmy) {
        var ct = DATA.TROOPS[ck];
        if (ct && ct.craft && atkArmy[ck] > 0) craftN++;
      }
      craftN = Math.min(3, craftN);
    }
    if (craftN > 0) {
      siegeMult *= (GAME.tactic ? GAME.tactic.CRAFT_SIEGE_MULT : 2.2);
      defBonus *= Math.pow(GAME.tactic ? GAME.tactic.CRAFT_DEF_CUT : 0.8, craftN);
    }

    var aStart = totalCount(atkArmy), dStart = totalCount(defArmy);
    /* v57（老板拍板）：回合上限收到 **30**，与 tactic 引擎的 T.MAX_ROUNDS 取同一口径。
       原版：野战 30 回合，超时双方仍有兵 = 平局。 */
    var log = [], round = 0, maxRounds = 30;
    /* 座驾速度参与先手判定（报告：赤兔 100 / 绝影 120 / 乌云踏雪 145） */
    var aFirst = GAME.battle.firstStrike(atkArmy, defArmy, atkGen, defGen);

    /* 天时：奇袭窗口 —— 只有**抢到先手**才吃这两个加成
     *   · 大雾 ambush ×2（「侦察单元难察敌情，然偷袭伤害 ×2」）
     *   · 大风 fire ×3（「风急天高：火攻威力 ×3」），需带火器（器械/远程）
     *   · 雨雪 fire = 0（「火攻失效」）
     * 此前这两项在 WEATHERS 里声明，却没有任何战斗读取点。 */
    var firstMul = 1;
    var hasFireUnit = false;
    for (var fu in atkArmy) {
      var ft = DATA.TROOPS[fu];
      if (ft && atkArmy[fu] > 0 && (ft.craft || ft.range >= 1000)) { hasFireUnit = true; break; }
    }
    if (aFirst && GAME.story && GAME.story.combatMod) {
      var cmW = GAME.story.combatMod();
      if (cmW.ambush > 1) firstMul *= cmW.ambush;
      if (cmW.fire > 1 && hasFireUnit) firstMul *= cmW.fire;
    }

    if (aFirst) {
      /* 攻方先手一轮 */
      var pre = damageOf(atkArmy, defArmy, atkGen, defBonus, true) * siegeMult * firstMul;
      applyDamage(defArmy, pre, defGen);
      if (totalCount(defArmy) <= 0) log.push('先手远程打击：敌军全灭！');
    }

    while (totalCount(atkArmy) > 0 && totalCount(defArmy) > 0 && round < maxRounds) {
      round++;
      var aDmg = damageOf(atkArmy, defArmy, atkGen, defBonus, round === 1) * siegeMult
        * ((round === 1 && aFirst) ? firstMul : 1);
      applyDamage(defArmy, aDmg, defGen);
      if (totalCount(defArmy) <= 0) break;
      var dDmg = damageOf(defArmy, atkArmy, null, atkDefBonus, false);
      applyDamage(atkArmy, dDmg, atkGen);
      log.push(logRound(round, aDmg, dDmg, totalCount(atkArmy), totalCount(defArmy)));
    }

    var aRemain = totalCount(atkArmy), dRemain = totalCount(defArmy);
    var winner;
    if (dRemain <= 0 && aRemain > 0) winner = 'atk';
    else if (aRemain <= 0 && dRemain > 0) winner = 'def';
    else if (aRemain > 0 && dRemain > 0) {
      winner = (aRemain / aStart) > (dRemain / dStart) ? 'atk' : 'def';
    } else winner = 'def';

    return {
      winner: winner,
      atkLoss: aStart - aRemain, defLoss: dStart - dRemain,
      atkRemain: aRemain, defRemain: dRemain,
      rounds: round, log: log,
    };
  };

  /* --------- 玩家攻击 NPC 城 --------- */
  GAME.battle.attackCity = function (npcCity, atkArmy, genId, modeId) {
    return GAME.battle.expedition({ kind: 'city', id: npcCity.id, npc: npcCity }, modeId || 'occupy', atkArmy, genId);
  };

  /* ============================================================
   * v89.186（老板 2/4）：**伤兵回收率唯一出口**
   * ------------------------------------------------------------
   * 改前口径散在三处、且互不一致（probe_v89186a 取证）：
   *   · returnArmy（出征）：base 0.45 + schemeKeep + buff（**替换**） + tech × + sect ×
   *   · applyWounded（旧口/测试）：base + tech ×（缺 schemeKeep / sect）
   *   · state.js 守城战：**只有 base**（商品/科技全不吃 —— 守城买的伤兵书没用）
   * 且 buff 走替换语义：救护手册 0.30 低于当时基础 0.45 → 买了反而亏；医疗手册 0.45 = 没买。
   * 本出口统一口径（老板拍板：**提高固定伤兵比例** + 商品改**加法提升**）：
   *   base（DATA.EXPEDITION.woundedRate = 0.75）
   *   + schemeKeep（金蝉脱壳：战败额外保全）
   *   + buff.wound（商品：+5% / +10% / +15% —— 加法，见商品表）
   *   → × (1 + 再生技术)，全程以 woundCap（0.9）封顶。
   * 三处消费点（returnArmy / applyWounded / 守城）+ 界面显示 全读它。
   * ============================================================ */
  GAME.woundedRateOf = function (result) {
    var s = GAME.state;
    var E = DATA.EXPEDITION || {};
    var cap = (E.woundCap == null) ? 0.9 : E.woundCap;
    var rate = (E.woundedRate == null) ? 0.75 : E.woundedRate;
    if (result && result.schemeKeep) rate += result.schemeKeep;   /* 金蝉脱壳（战败保全，与商品同链相加） */
    /* v89.186：商品改**加法**（原为替换 —— 见函数头注释） */
    if (s && s.buffs && s.buffs.military && s.buffs.military.wound
      && GAME.systems && GAME.systems.buffActive && GAME.systems.buffActive('military')) {
      rate += s.buffs.military.wound;
    }
    rate = Math.min(cap, rate);
    /* 再生技术：伤兵回收率 +3%/级（乘法链） */
    if (GAME.systems && GAME.systems.techBonus) rate = Math.min(cap, rate * (1 + GAME.systems.techBonus('repair')));
    return rate;
  };
  /* 伤兵营：阵亡者按回收率折为伤兵（存伤兵营，花旧币治疗） */
  GAME.battle.applyWounded = function (lossCount) {
    var s = GAME.state;
    if (!lossCount || lossCount <= 0) return;
    /* v89.186：率走唯一出口（原在此只算 base+tech，与 returnArmy 分叉） */
    var rate = GAME.woundedRateOf(null);
    s.wounded = (s.wounded || 0) + Math.floor(lossCount * rate);
  };

  /* 治疗伤兵 */
  /* 治疗费**唯一出口**（伤兵 × 10 旧币）—— 弹窗、自动治疗、断言共读这一处（v89.115 抽取，
     此前"n * 10"在 battle.heal 与 ui.woundedBlock 各写一份）。 */
  GAME.healFeeOf = function (n) { return Math.max(0, Math.floor(n || 0)) * 10; };
  GAME.battle.heal = function (cityId) {
    var s = GAME.state;
    var n = s.wounded || 0;
    if (!n) return { ok: false, msg: '伤兵营为空' };
    var gold = GAME.healFeeOf(n);
    if ((s.res.gold || 0) < gold) return { ok: false, msg: '旧币不足（需 ' + U.fmt(gold) + '）' };
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity() || s.cities[0];
    GAME.goldAdd(-gold);   /* v91.67：旧币走唯一出口 */
    /* 真正归队：按兵种把伤兵加回城市。
       此前只是 `s.wounded = 0` 然后把「归队」写进日志 —— 兵没有回来，
       治疗纯粹是一笔没有回报的旧币消耗。 */
    var comp = s.woundedArmy || {}, back = 0, backBy = {};
    for (var id in comp) {
      var c = comp[id] || 0;
      if (c <= 0 || !city) continue;
      GAME.city.armyAdd(city, { [id]: c });
      back += c;
      backBy[id] = (backBy[id] || 0) + c;      /* v89.116：逐兵种明细（界面要列出来） */
    }
    s.wounded = 0;
    s.woundedArmy = {};
    if (back > 0) {
      GAME.log.war('治疗伤兵 ' + U.fmt(back) + ' 名，已归入 ' + city.name);
      return { ok: true, msg: '治疗伤兵 ' + U.fmt(back) + ' 名归队', back: back, backBy: backBy,
        gold: gold, city: city.name };
    }
    /* 无兵种构成记录（历史存档）：无法还原，只能遣散 */
    GAME.log.war('治疗伤兵 ' + U.fmt(n) + ' 名（无兵种记录，已就地遣散）');
    return { ok: true, msg: '治疗完毕（' + U.fmt(n) + ' 名无兵种记录，已遣散）' };
  };

  /* ============================================================
   * v89.87（老板需求 4）：战斗观战 —— 会话挂起 / 逐回合推进 / 落账重放
   * ------------------------------------------------------------
   * · 玩家出征战斗抵达后不再即时结算：挂起到 `s.battles`（纯数据，随存档走），
   *   由战场界面逐回合指挥（`settings.battleSec` 真实秒/回合，点「完成」提前结算）；
   * · 会话引擎 = `GAME.tactic.begin` 的**确定性**会话（同输入必得同结果），
   *   每回合指令快照进 `history` —— 读档恢复 = 重建会话 + 按 history 重放；
   * · 战斗结束 → `finishBattle` 重入 expedition（opts._result/_sim）走既有落账段；
   * · 无界面时也照常走表（60 秒一回合自动结算）——"后台照常走"（老板拍板）。
   * ============================================================ */
  /* 是否需要玩家指挥（观战）：未显式自动 + 设置开启 */
  GAME.battle._needWatch = function (opts) {
    var s = GAME.state;
    if (opts && opts.auto) return false;
    return !(s && s.settings && s.settings.battleWatch === false);
  };

  /* 建立/重建会话：按 history 重放到当前回合（读档恢复与首建同一路径）
     v89.192（老板 2）：加可选第 2 参 `collectSteps` —— 传数组时把重放中**每回合的
     `{ r, gap, events, snap }`** 收集进去（供界面补渲染"前边回合的记录"）。
     不传 = 与既有行为逐字一致（读档恢复/守城等所有既有调用零影响）。 */
  GAME.battle._makeEnv = function (rec, collectSteps) {
    var s = GAME.state;
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    /* v89.142（老板 7）：重放用**斗将后的那份主将**（rec.sim.genSim）——
       否则史实（结算读 genSim）与重放（读原件）在英雄属性上差一个 +10%，verify 必假红。 */
    var _genSimD = rec.sim.genSim || gen;
    /* v91.85：观战路径也要接策略层 —— 原来只有 T.simulate（自动结算）那条路装，
       而默认 battleWatch=true，等于"AI 只在关掉观战时才生效"。
       这里按 **rec.sim.simOpts.battleAI 快照**决定，重跑与首算同源。 */
    var _so = rec.sim.simOpts || {};
    if (_so.battleAI && GAME.strat && GAME.strat.autoPlan && !_so.plan) {
      var _so2 = {};
      for (var _kk in _so) _so2[_kk] = _so[_kk];
      _so2.plan = GAME.strat.autoPlan({ sides: ['def'], allowRetreat: true });
      _so = _so2;
    }
    var env = null;
    /* v89.179b·P1-3：会话建立 + 逐回合重放读的是"现在"的全局加成（科技/天时/羁绊/战鼓），
       而史实是开打那一刻的 → 读档/挂起重放会漂。包 withBoost(rec.sim.boost) 装回史实快照。 */
    GAME.battle.withBoost(rec.sim.boost, function () {
      env = GAME.tactic.begin(rec.atkArmy, _genSimD, rec.sim.scArmy || {}, rec.sim.scVal || 0,
        rec.sim.scGen || null, _so);
      (rec.history || []).forEach(function (h) {
        for (var tid in (h || {})) env.setCmd('atk', tid, h[tid]);
        var _st192 = env.step();
        if (collectSteps && _st192) {
          collectSteps.push({ r: _st192.r, gap: _st192.gap,
            events: _st192.events || [], snap: _st192.snap || null });
        }
      });
    });
    return env;
  };

  /* 挂起：保存战斗输入与落账上下文（s.battles 全为纯数据，可随存档往返） */
  GAME.battle._suspendExpedition = function (target, modeId, atkArmy, genId, opts, simIn) {
    var s = GAME.state;
    s.battles = s.battles || [];
    var id = 'bt' + (GAME._battleSeq = (GAME._battleSeq || 0) + 1);
    var rec = {
      id: id, kind: 'expedition', side: 'atk',
      pid: (target && target.pid != null) ? target.pid : GAME.curPid(),
      target: U.deep(target), modeId: modeId,
      atkArmy: U.deep(atkArmy), genId: genId,
      cityId: opts.cityId || null, scheme: opts.scheme || null,
      /* ⛔ v89.198（老板「清除战法这个玩法」）：随军战法（ops）字段随玩法全撤退役。 */
      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,
             scGen: simIn.scGen ? U.deep(simIn.scGen) : null,
             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {},
             /* v89.142（老板 7）：「斗将战从未触发」（真因：这里漏存两字段）——
                挂起前 `_doDuel()` 的成果必须**随会话走**，否则结算读取时：
                  · duel → undefined：战报没有【斗将】段、回合战况无从播报；
                  · genSim → undefined：我方斗将加成丢失（守方 scGen 带加成生效 → 只给对面加成）。
                重放（_makeEnv）同样要读这两份 —— 不然沙盘与史实对不上。 */
             duel: simIn.duel ? U.deep(simIn.duel) : null,
             genSim: simIn.genSim ? U.deep(simIn.genSim) : null,
             /* v89.118：战斗加成快照随挂起会话走（结算与重跑同源） */
             boost: simIn.boost || null },
      round: 0, cnt: (s.settings && s.settings.battleSec) || 60, state: 'live',
      cmd: {}, history: [], snapLast: null, evLast: [], gapLast: null,
      bornAt: U.now(),
    };
    s.battles.push(rec);
    GAME._bsess = GAME._bsess || {};
    GAME._bsess[id] = GAME.battle._makeEnv(rec);
    GAME.log.war('⚔️ 大军已抵 ' + ((rec.target && rec.target.name) || '目标')
      + '，战斗待指挥（每回合 ' + rec.cnt + ' 秒，可点「完成」提前结算）');
    return { ok: true, pending: true, battleId: id, target: rec.target,
             msg: '抵达' + ((rec.target && rec.target.name) || '') + '，战斗待指挥' };
  };

  /* 找记录 */
  GAME.battle._recOf = function (id) {
    var out = null;
    ((GAME.state && GAME.state.battles) || []).forEach(function (b) { if (b.id === id) out = b; });
    return out;
  };

  /* ============================================================
   * v89.164（老板 3）：**智能战斗**（通用战斗方案的执行器 · 规则表 DATA.SMART_PLAN）
   * ------------------------------------------------------------
   * 开关 `settings.smartBattle`（默认开）；执行点 = stepBattle（推进的唯一出口）：
   *   本回合指令改写 → 落 rec.cmd（界面下拉即读它）→ 照常进 history 快照，
   *   于是重放 / 读档 / 沙盘校验全部逐回合一致（与玩家手改指令同一条链）。
   * 只托管**我方攻方**（rec.side === 'atk'）——守城侧有围墙/固守逻辑，不掺和。
   * ============================================================ */
  GAME.battle.smartPlanOf = function () {
    return DATA.SMART_PLAN || { gapInf: 250, gapCav: 250, rangeK: 1, targets: {} };
  };
  GAME.battle.smartOnOf = function () {
    var s = GAME.state;
    return !(s && s.settings && s.settings.smartBattle === false);   /* 默认开 */
  };
  GAME.battle.setSmartBattle = function (on) {
    var s = GAME.state;
    if (!s) return;
    s.settings = s.settings || {};
    s.settings.smartBattle = !!on;
  };
  /* 单个单位的姿态决策（纯函数 · 执行与断言共用）：
     u = 内部单位（读 range/spd）；gap = 到敌前军间距（field − 双方前出）。 */
  GAME.battle.smartStanceOf = function (u, gap, plan, mode, ctx) {
    plan = plan || GAME.battle.smartPlanOf();
    mode = mode || 'echelon';
    if (mode === 'turtle') return 'hold';        /* 退守消耗：全军原地（驻守减伤） */
    if (mode === 'charge') return 'advance';     /* 一波冲锋：全军全速、永不转防御 */
    var _er = (u.er != null ? u.er : (u.range || 0));
    if (mode === 'line') {                       /* 齐头并进：贴到**射程边缘**才转防御 */
      return (gap <= _er) ? 'hold' : 'advance';
    }
    if (mode === 'spear' && plan.fastestId && u.id === plan.fastestId) {
      return 'advance';                          /* 针尖麦芒：尖刀（最快一档）持续前压 */
    }
    /* echelon 错落有致（默认 · v89.164 标定） */
    if ((u.range || 0) >= 500) {
      if (gap > u.range * (plan.rangeK || 1)) return 'advance';
      /* v89.180（老板 3/4「距离难道不是自走火炮的生命线吗……那是还不够智能」）：
         **风筝** —— 进射程后不再无条件站桩：处于威胁线内（敌下回合能打到我）、
         且存在"我打得到 / 它够不着"的窗口（敌射程 < 我）、且退一步后仍在射程内
         （退出去打不着 → 原地打）→ **后撤一步**（引擎的 retreat 可退到 −D，
         后退回合照常开火 = 边退边射）；否则站桩输出（驻守减伤）。
         ctx 由 smartApply 按**团队条件**构造（我方最慢远程 > 敌最前速度才给 ctx.kite ——
         混编里最慢那支决定整条远程线是否风筝；probe_v89180b 的 S3 实测"部分退、部分留"
         反而更差）。**无 ctx（旧调用 / 旧断言）→ 行为与 v89.164 逐字一致。** */
      if (ctx && ctx.kite && ctx.back > 0 && gap <= ctx.threat && ctx.eRange < _er - 1
          && gap + ctx.back <= _er + 1) return 'retreat';   /* back>0：退不动就别退（hold 驻守减伤） */
      return 'hold';
    }
    var isCav = (u.spd || 0) >= 400;
    var k = isCav ? (plan.gapCav != null ? plan.gapCav : 250)
                  : (plan.gapInf != null ? plan.gapInf : 250);
    /* v91.100：**近战不再"停 250 结阵"** —— 动作三角开启后驻守要付 −20% 输出，
       而它换来的 −20% 受创在"击杀判胜负"的仗里只是把战斗拖长（实测镜像局
       平均战损 39.9% → 42.1%）。所以近战一路压上去，结阵交给玩家自己按。 */
    if (DATA.STANCE_TRIANGLE_ON) return 'advance';
    return (gap <= k) ? 'hold' : 'advance';
  };
  /* 应用：把方案写进本场战斗（env.setCmd + rec.cmd）。
     只托管攻方；返回"本回合改了几支部队"（探针/断言用）。 */
  GAME.battle.smartApply = function (rec, env) {
    if (!rec || rec.side !== 'atk' || !env || !env.setCmd) return { n: 0, notes: [] };
    var plan = GAME.battle.smartPlanOf();
    /* v89.175：目标规则（首回合赛马选定；缺省 static = v89.164 静态表，行为不变）
       v89.176：阵型模式（modes × rules 联合赛马；缺省 echelon = v89.164 标定，行为不变） */
    var rule = rec.smartRule || 'static';
    var mode = rec.smartMode || 'echelon';
    var mine = (env.units && env.units.atk) || [];
    var theirs = (env.units && env.units.def) || [];
    /* v89.176：尖刀是谁 —— 我军存活部队里 spd 最高的一支（spear 模式用；经 planX
       传入 smartStanceOf，让它保持纯函数）。 */
    var _fastest = '', _fspd = -1;
    mine.forEach(function (x) { if (x.count > 0 && (x.spd || 0) > _fspd) { _fspd = x.spd || 0; _fastest = x.id; } });
    var planX = { gapInf: plan.gapInf, gapCav: plan.gapCav, rangeK: plan.rangeK,
      targets: plan.targets, fastestId: _fastest };
    var D = env.field || 1, themFront = 0, _eF180 = null;
    theirs.forEach(function (x) {
      if (x.count > 0 && x.adv > themFront) { themFront = x.adv; _eF180 = x; }
    });
    /* v89.180（老板 3/4）：风筝（kite）**团队条件**与威胁线 —— 唯一出口
       （开战赛马与实战执行共用本函数）。团队条件：我方存活远程（射程 ≥ 500）的
       最小速度 > 敌最前单位速度（跑不动就别退）；威胁线 = 敌射程 + 敌速度 × kiteLead。 */
    var kiteOn180 = false, kiteThreat180 = 0, kiteER180 = 0;
    if (_eF180) {
      var _eSpd180 = _eF180.spd || 0;
      var _minRSpd180 = Infinity, _hasR180 = false;
      mine.forEach(function (x) {
        if (x.count > 0 && (x.range || 0) >= 500) {
          _hasR180 = true;
          if ((x.spd || 0) < _minRSpd180) _minRSpd180 = (x.spd || 0);
        }
      });
      kiteOn180 = _hasR180 && _eSpd180 > 0 && _minRSpd180 > _eSpd180;
      kiteER180 = (_eF180.er != null ? _eF180.er : (_eF180.range || 0));
      kiteThreat180 = kiteER180 + _eSpd180 * (plan.kiteLead == null ? 1 : plan.kiteLead);
    }
    rec.cmd = rec.cmd || {};
    /* ⛔ v89.164 撤销（实测有害）：曾加"目标灭失回退"（目标兵种灭后改打敌方主力）——
       对照实验（probe diag_trace）显示：火力被引离**前线可歼灭目标**后，敌方前排
       不再减员并一路推进穿场（dFront 12160），敌损从 4435（全灭）掉到 726。
       目标灭失时**保持原值**、由引擎回落"射程内任意"反而是实测最优。 */
    var n = 0, notes = [];
    var SC = {};
    (DATA.STANCES || []).forEach(function (x) { SC[x.id] = x.name; });
    var tName = function (tid) {
      var t = DATA.TROOPS[tid];
      return t ? t.name : String(tid || '');
    };
    mine.forEach(function (u) {
      if (!(u.count > 0)) return;
      var c = rec.cmd[u.id] = rec.cmd[u.id] || {};
      var kctx180 = null;
      if (kiteOn180 && (u.range || 0) >= 500) {
        var _bk180 = Math.min(u.spd || 0, u.adv + D);   /* 与引擎 retreat 的退量同尺 */
        if (_bk180 > 0) kctx180 = { kite: true, threat: kiteThreat180, eRange: kiteER180, back: _bk180 };
      }
      var wantS = GAME.battle.smartStanceOf(u, D - u.adv - themFront, planX, mode, kctx180);
      /* v89.175：目标 = 规则决策（静态表 / 伤害最优 / 清除效率 / 清前排） */
      var wantT = (rule === 'static')
        ? plan.targets[u.id]
        : GAME.battle.smartPickTarget(u, theirs, rule, D);
      var patch = {};
      if (wantS && c.s !== wantS) {
        notes.push(u.name + ' ' + (SC[c.s] || c.s || '—') + '→' + (SC[wantS] || wantS));
        c.s = wantS; patch.s = wantS;
      }
      if (wantT != null && c.t !== wantT) {
        notes.push(u.name + ' 目标→' + tName(wantT));
        c.t = wantT; patch.t = wantT;
      }
      if (patch.s || patch.t !== undefined) { env.setCmd('atk', u.id, patch); n++; }
    });
    return { n: n, notes: notes };
  };
  /* v89.175：目标评分器（**唯一出口** —— 赛马模拟与实战执行共用同一把尺）。
     规则：dmg = 期望实伤（perAtk×防御对冲÷单兵HP · v89.179 起无相克项）；eff = 有效杀（防溢出，
     能打满的优先）；front = 清前排（adv 大者优先 + 有效杀打底）。
     与 v89.164 静态表同源可比：static 直接读 plan.targets（代表兵种）。 */
  GAME.battle.smartPickTarget = function (u, foes, rule, D) {
    var list = (foes || []).filter(function (e) { return e.count > 0; });
    if (!list.length) return null;
    var T = GAME.tactic;
    var perA = T.perAtk(u);
    var best = null, bestSc = -Infinity;
    list.forEach(function (e) {
      var cf = T.clashFactor(perA, T.perDef(e));
      var perHp = T.perHp(e, null);
      var hold = T.stanceTakenMul(e);      /* v91.95：动作三角（受创倍率，唯一口径） */
      /* v89.180：拆械 —— 评分器与实战共用一把尺（无人轰炸机打器械的 killF 乘 vsMech） */
      var _st180 = DATA.TROOPS[u.id] || {};
      var _et180 = DATA.TROOPS[e.id] || {};
      var mechF180 = (_st180.vsMech && _et180.mech) ? _st180.vsMech : 1;
      var killF = perA * u.count * cf * hold * mechF180 / perHp;
      var sc;
      if (rule === 'dmg') sc = killF;
      else if (rule === 'eff') sc = Math.min(killF, e.count) * 1000 + killF * 0.001;
      else if (rule === 'front') sc = e.adv * 1000 + Math.min(killF, e.count);
      /* v89.185（老板 7「改进战役智能」）：**击其脆弱** —— 优先每兵生命最低的目标
         （清场加速；probe_v89185f 实测 infHeavy 我损 -16% vs 次优规则）。 */
      else if (rule === 'weak') sc = -perHp * 1000 + Math.min(killF, e.count);
      else sc = killF;
      if (sc > bestSc) { bestSc = sc; best = e; }
    });
    return best ? best.id : null;
  };
  /* v89.175：**开战赛马** —— 候选策略各全速模拟一遍（引擎确定 → 同输入同结果）。
     v89.176：候选空间从 4 条目标规则扩到 **5 阵型 × 4 目标 = 20 组合**；
     评分从「胜 > 交换比」改为「**胜 > 保兵率 > 交换比**」——老板「减少伤亡很重要，
     或者最重要」：同胜局面选**我方损失最小**的组合，劣局同样优先保兵。
     结果 `{ rule, mode, scores }` 存 rec.smartPick（随档往返），每场只跑一次；
     成本（probe_v89176d 实测）20 组合 ≈ 数十毫秒（首回合一次，长跑无感）。 */
  GAME.battle.smartArbitrate = function (rec) {
    var plan = GAME.battle.smartPlanOf();
    var rules = (plan.rules || ['static']).slice();
    var modes = (plan.modes || ['echelon']).slice();
    var t0 = Date.now();
    var gen = null;
    (GAME.state.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    var genSim = (rec.sim && rec.sim.genSim) || gen;
    var scores = [];
    modes.forEach(function (mode) {
      rules.forEach(function (rule) {
        var env = null;
        try {
          env = GAME.tactic.begin(rec.atkArmy || {}, genSim, (rec.sim && rec.sim.scArmy) || {},
            (rec.sim && rec.sim.scVal) || 0, (rec.sim && rec.sim.scGen) || null,
            (rec.sim && rec.sim.simOpts) || {});
        } catch (e) { env = null; }
        if (!env) return;
        var recX = { side: 'atk', cmd: {}, smartRule: rule, smartMode: mode };
        var g = 0;
        while (!env.over && g++ < 40) { GAME.battle.smartApply(recX, env); env.step(); }
        var aRem = 0, dRem = 0, aStart = 0, dStart = 0;
        env.units.atk.forEach(function (u) { aStart += u.start; if (u.count > 0) aRem += u.count; });
        env.units.def.forEach(function (u) { dStart += u.start; if (u.count > 0) dRem += u.count; });
        var win = aRem > 0 && dRem === 0;
        var ratio;
        if (dRem === 0) ratio = (aStart > aRem) ? (dStart / (aStart - aRem)) : 999;
        else ratio = (dStart - dRem) / Math.max(0.0001, (aStart - aRem));
        ratio = Math.round(ratio * 100) / 100;
        var aLoss = aStart > 0 ? Math.round((aStart - aRem) / aStart * 1000) / 1000 : 0;
        scores.push({ mode: mode, rule: rule, win: win, ratio: ratio, aLoss: aLoss, rounds: g });
      });
    });
    var best = null, bestSc = -1e30;
    scores.forEach(function (s) {
      var sc = (s.win ? 1e6 : 0) + (1 - s.aLoss) * 1e4 + Math.min(s.ratio, 999);
      if (sc > bestSc) { bestSc = sc; best = s; }
    });
    return { rule: (best && best.rule) || 'static', mode: (best && best.mode) || 'echelon',
      scores: scores, ms: Date.now() - t0 };
  };
  /* v89.176：保兵闸的三个读数出口（stepBattle 与界面共用 —— 数值只改 DATA.SMART_PLAN） */
  GAME.battle.retreatAtOf = function () {
    var p = GAME.battle.smartPlanOf();
    return (p && p.retreatAt != null) ? p.retreatAt : 0.30;
  };
  GAME.battle.warnAtOf = function () {
    var p = GAME.battle.smartPlanOf();
    return (p && p.warnAt != null) ? p.warnAt : 0.22;
  };
  /* 我方当前损失率（从会话快照算：start 总量 ↔ 现存总量；无快照/无 start → 0） */
  GAME.battle.lossRatioOf = function (ses) {
    if (!ses || !ses.snap) return 0;
    var snap = null;
    try { snap = ses.snap(); } catch (e) { return 0; }
    var s0 = 0, s1 = 0;
    ((snap && snap.atk) || []).forEach(function (u) { s0 += (u.start || 0); s1 += (u.count || 0); });
    if (s0 <= 0) return 0;
    return Math.max(0, (s0 - s1) / s0);
  };
  /* 目标是否"非拿下不可"（撤不得）—— 口径：**名城**（聚落及以上系统城，
     GAME.isFamousCity 唯一出口）。野地 / 据点 / 自建城 → false（到线可撤）。 */
  GAME.battle.mustTakeOf = function (rec) {
    try {
      if (!rec || !rec.target) return false;
      var t = GAME.battle.resolveTarget(rec.target);
      if (!t || !t.ok || t.kind !== 'city') return false;
      return !!(t.npc && GAME.isFamousCity && GAME.isFamousCity(t.npc));
    } catch (e) { return false; }
  };
  /* 推进一回合：指令先落会话、快照进 history（重放一致），再 step */
  GAME.battle.stepBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    /* v89.164：智能战斗（默认开）——本回合先改写我方指令（姿态+目标），
       改写落 rec.cmd → 随后照常进 history 快照（重放/读档逐回合一致）。
       v89.175（老板「多种最优路径比较」）：首回合**赛马**（4 套策略全速模拟 → 选最优，
       结果确定可重放）；每回合记录**调整明细**（rec.smartNote/smartLog，战报与回合
       记录渲染读它 —— 「每回合我要看见调整」）。 */
    if (GAME.battle.smartOnOf()) {
      if (!rec.smartPick) rec.smartPick = GAME.battle.smartArbitrate(rec);
      if (rec.smartPick && rec.smartPick.rule) rec.smartRule = rec.smartPick.rule;
      if (rec.smartPick && rec.smartPick.mode) rec.smartMode = rec.smartPick.mode;
      var _sm175 = GAME.battle.smartApply(rec, ses);
      rec.smartNote = { r: (rec.round || 0) + 1, n: _sm175.n, notes: _sm175.notes,
        rule: rec.smartRule, mode: rec.smartMode };
      (rec.smartLog = rec.smartLog || []).push(rec.smartNote);
      if (rec.smartLog.length > 80) rec.smartLog.shift();
      /* ============================================================
       * v89.176（老板「减少伤亡很重要……损伤 30% 的局面，宁愿撤退。
       *   除非是有非拿下不可的目标比如名城」）：**保兵闸**。
       * 损失达线（DATA.SMART_PLAN.retreatAt）且目标非名城 → 走既有撤退落账
       * （retreatBattle：残部带回、本波破防按半计）；到线原因写进 smartNote
       * 与战报日志（问题可见）。名城（聚落及以上系统城）死战不退。
       * 返回 null = 本回合无正常推进记录（已按撤退结算，调用方照常收尾）。
       * ============================================================ */
      var _lr176 = GAME.battle.lossRatioOf(ses);
      if (_lr176 >= GAME.battle.retreatAtOf() && !GAME.battle.mustTakeOf(rec)) {
        rec.smartNote.retreat = true;
        rec.smartNote.notes = rec.smartNote.notes || [];
        rec.smartNote.notes.push('损失 ' + Math.round(_lr176 * 100) + '% 达撤退线 → 保兵撤退');
        GAME.log.war('🏳️ 智能托管：损失达 ' + Math.round(_lr176 * 100) + '%（撤退线 '
          + Math.round(GAME.battle.retreatAtOf() * 100) + '%），按保兵策略主动撤退（残部带回）');
        GAME.battle.retreatBattle(id);
        return null;
      }
      if (_lr176 >= GAME.battle.warnAtOf() && !rec.smartWarned) {
        rec.smartWarned = true;
        GAME.log.war('⚠️ 智能托管：损失 ' + Math.round(_lr176 * 100) + '% 已近撤退线（'
          + Math.round(GAME.battle.retreatAtOf() * 100) + '%）—— 非名城目标到线将自动撤退（保兵）');
      }
    }
    var snapCmd = U.deep(rec.cmd || {});
    rec.history.push(snapCmd);
    for (var tid in snapCmd) ses.setCmd('atk', tid, snapCmd[tid]);
    /* v89.179b·P1-3：每回合推进也装回史实加成快照（否则观战途中点科技/天时变化、
       战鼓到期，这场仗的结果会漂；读档重放与史实不同源）。rec.sim.boost 为空（旧档/沙盘）时
       直接跑，与既有行为一致。 */
    var r = GAME.battle.withBoost(rec.sim.boost, function () { return ses.step(); });
    if (!r) return null;
    rec.round = r.r;
    rec.gapLast = r.gap;
    rec.evLast = r.events || [];
    rec.snapLast = r.snap || null;
    if (r.over) GAME.battle.finishBattle(id);
    return r;
  };

  /* 自动：用当前指令一键跑完（history 逐回合同步，读档重放仍一致）
     ------------------------------------------------------------
     v89.136（老板 3）：**改走 stepBattle 同一条推进路径** —— 与「完成回合」共用唯一出口：
     · `rec.round / gapLast / evLast / snapLast` 逐回合更新 → 结束时的 `lastStep` 不空
       （旧版直调 `ses.step()`，这些字段从没写过 —— 老板实测「最后一回合没有完整显示」
        的另一半病根：自动/后台跑完时最后一回合**连数据都没有**）；
     · history 逐回合仍同步（stepBattle 内部 push）→ 读档重放一致性不变；
     · `r.over` 时 stepBattle 自带 finishBattle → 循环退出即已落账。 */
  GAME.battle.autoBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var guard = 0;
    var last = null;
    while (!ses.over && guard++ < 200) {
      last = GAME.battle.stepBattle(id);
      if (!last || rec.state !== 'live') break;   /* 推进失败或内部已 finish */
    }
    if (rec.state === 'live') return GAME.battle.finishBattle(id);
    return GAME._battleJustDone || last;
  };

  /* 结束：收尾组装 result → 重入 expedition 落账（_result/_sim）→ 清挂起
     ------------------------------------------------------------
     v89.94（B2 · E1）：落账段拆成 `_settleBattle` —— 「完成」与「主动撤退」
     走**同一段落账**，只在 result 上差一个 retreat 旗标（不复制落账逻辑）。 */
  GAME.battle.finishBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    return GAME.battle._settleBattle(id, ses.finish());
  };

  /* v89.94（B2 · E1）：主动撤退 —— 撤出战斗、带走残部、保留已造成的破防（按半计）。
     与"打完"只有两点不同：① result.retreat=true（破防 ×0.5、战报写明"主动撤退"）；
     ② 不判胜（目标未下 —— 哪怕台上占优，撤了就是没拿下）。 */
  GAME.battle.retreatBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var result = ses.finish();
    result.retreat = true;
    if (result.winner === 'atk') result.winner = 'def';
    return GAME.battle._settleBattle(id, result);
  };

  /* 落账段（finishBattle / retreatBattle 共用） */
  GAME.battle._settleBattle = function (id, result) {
    var s = GAME.state;
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!rec) return null;
    rec.state = 'done';
    /* v89.102（沙盘）：把**逐回合指令**一并带进落账 —— 战报里的沙盘配方要靠它
       重放（否则玩家在战场上改过的动作/目标会丢，重跑跑出另一场仗）。 */
    if (rec.sim && !rec.sim.history) rec.sim.history = U.deep(rec.history || []);
    var resp = null, err = null;
    _expArmySettled = false;
    try {
      resp = GAME.battle.expedition(rec.target, rec.modeId, rec.atkArmy, rec.genId,
        { arrived: true, cityId: rec.cityId, scheme: rec.scheme,
          _result: result, _sim: rec.sim });
    } catch (e) { err = e; }
    /* 英雄状态收尾（等价 arrive 的 idle 设置） */
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    if (gen && gen.status === 'march') GAME.gen.release(gen);   /* v91.65 */
    /* 军账兜底（P-25 同口径）：落账异常 / 目标失效 → 折返 */
    if (err || !resp || resp.ok === false) {
      var city = rec.cityId ? GAME.cityById(rec.cityId) : null;
      var rolled = false;
      if (!_expArmySettled && city) {
        for (var aR in rec.atkArmy) GAME.city.armyAdd(city, { [aR]: rec.atkArmy[aR] });
        rolled = true;
      }
      _expArmySettled = true;
      GAME.log.war('⚠️ 战斗结算中止（' + (err ? '异常' : ((resp && resp.msg) || '目标已不存在')) + '）：'
        + (rolled ? '大军折返 ' + city.name : '军账已结'));
      if (err && typeof console !== 'undefined' && console.warn) console.warn('[finishBattle] 落账异常：', err);
    }
    /* ============================================================
     * v95：**战果层**（goals）—— 作战目标/老兵伤兵/套装指令/牌组/破墙
     * 全部在这一次调用里结账。放在归还兵之后、清 battles 之前，
     * 因为那时 `rec` 与 `result` 都还在作用域里。
     * 内部自带 try/catch：框架期任何一个新模块抛错都不许影响主流程。
     * ============================================================ */
    if (GAME.goals && GAME.goals.afterBattle) GAME.goals.afterBattle(rec, result, resp);
    s.battles = (s.battles || []).filter(function (b) { return b.id !== id; });
    delete GAME._bsess[id];
    GAME._battleJustDone = {
      id: id, ok: !(err || !resp || resp.ok === false),
      winner: result.winner, rounds: result.rounds,
      atkLoss: result.atkLoss, defLoss: result.defLoss,
      resp: resp || null, rolled: !!(err || !resp || resp.ok === false),
      /* v89.136（老板 3）：**最后一回合**的播报数据随结果带走 ——
         rec 在本函数末尾即被移出 s.battles，UI 侧再想补播就取不到了
         （老板实测「最后一回合没有完整显示」的病根）。 */
      lastStep: { r: rec.round, gap: rec.gapLast, events: (rec.evLast || []).slice(),
        snap: rec.snapLast ? U.deep(rec.snapLast) : null },
      /* v89.196（老板 4）：「我想要看到全部战斗过程……战斗已结束……自动战斗直接结算」——
         落账生成的战报（含沙盘配方 sandbox）**挂到结束回执**上：
         结束界面的「🎬 回看全程」据此直接开沙盘（不必再翻公文找战报）。
         同步调用内采集：expedition 落账即 `s.reports.unshift(report)` → reports[0] 就是本条；
         折返/异常（无战报）时为 null。 */
      report: (!err && resp && resp.ok !== false && s.reports && s.reports[0]) ? s.reports[0] : null,
    };
    if (GAME.ui && GAME.ui.onBattleDone) GAME.ui.onBattleDone(GAME._battleJustDone);
    /* v89.93（E4）：战斗结果 —— 胜/败两声（反馈层最该有的两秒） */
    if (GAME.sfx) GAME.sfx(result.winner === 'atk' ? 'win' : 'lose');
    return resp;
  };

  /* 主循环倒计时（真实秒）：「后台照常走」——界面关闭也按表推进；
     界面动画播放中（rec.anim）暂停计时。 */
  GAME.battle.tick = function (dt) {
    var s = GAME.state;
    if (!s || !s.battles || !s.battles.length) return;
    var sec = (s.settings && s.settings.battleSec) || 60;
    s.battles.slice().forEach(function (rec) {
      if (rec.state !== 'live' || rec.anim) return;
      if (rec.cnt == null) rec.cnt = sec;
      rec.cnt -= (dt || 1);
      if (rec.cnt <= 0) {
        rec.cnt = sec;
        GAME.battle.stepBattle(rec.id);
      }
    });
  };

  /* 读档恢复：重建会话（按 history 重放）——live 战斗继续等指挥 */
  GAME.battle.restoreBattles = function () {
    var s = GAME.state;
    if (!s || !s.battles || !s.battles.length) return;
    GAME._bsess = GAME._bsess || {};
    var drop = [];
    s.battles.forEach(function (rec) {
      rec.anim = false;
      if (rec.state !== 'live') { drop.push(rec.id); return; }
      try {
        GAME._bsess[rec.id] = GAME.battle._makeEnv(rec);
      } catch (e) {
        try { GAME.battle.autoBattle(rec.id); } catch (e2) { drop.push(rec.id); }
      }
    });
    if (drop.length) s.battles = s.battles.filter(function (b) { return drop.indexOf(b.id) < 0; });
  };

  /* ============================================================
   * v89.200（老板 2）：「睡眠、离线期间自动打」——挂起战斗**离线自动打完**。
   * ------------------------------------------------------------
   * 场景：战斗挂起（待指挥）后玩家入睡 / 关掉页面 —— 回来时不该还"等您指挥"。
   *   · 调用点唯一：GAME.offlineCatchup（时间跳变补偿与读档补算共用同一段，
   *     见 state.js 的门槛段 —— secReal ≥ DATA.LOOP_GAP.battleAutoSec 才打）；
   *   · 会话重建：真离线读档时 GAME._bsess 尚未重建（restoreBattles 晚于本调用）
   *     —— 缺会话就地按 history 重放重建（与 restoreBattles 同法）；
   *     单场失败只跳过（保持挂起、不删记录），绝不让一场坏数据阻断其余。
   *   · 打完 = 走 autoBattle 唯一推进路径（stepBattle 逐回合 → history/逐回合
   *     数据完整保留）→ 战报与沙盘配方照常生成（归来可「公文 → 战报」回看全程）。
   * ============================================================ */
  GAME.battle.autoFinishBattles = function () {
    var s = GAME.state;
    if (!s || !s.battles || !s.battles.length) return { n: 0 };
    var before = s.battles.length;
    s.battles.slice().forEach(function (rec) {
      if (rec.state !== 'live') return;
      try {
        GAME._bsess = GAME._bsess || {};
        if (!GAME._bsess[rec.id]) GAME._bsess[rec.id] = GAME.battle._makeEnv(rec);
        GAME.battle.autoBattle(rec.id);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('[autoFinishBattles] 跳过一场：', e);
      }
    });
    /* 计数 = 记录减少量（打完/落账折返都会移出 s.battles；失败的保持原数不误计） */
    return { n: before - ((GAME.state && GAME.state.battles) || []).length };
  };

  /* 待指挥战斗数（军务 / 徽标用） */
  GAME.battle.pendingCount = function () {
    var s = GAME.state;
    if (!s || !s.battles) return 0;
    var n = 0;
    s.battles.forEach(function (b) { if (b.state === 'live') n++; });
    return n;
  };

  /* --------- 攻占处理 ---------
     v60（需求 4/6）：新城**继承该城剩余的库藏** —— 未占据时那份库存是派生的，
     占领就地转正（× cityInherit）。不继承的话，打下一座 9 级首府只能得到一座
     "0 粮 0 旧币"的空城，与"这城本该有多少"完全脱节。
     fromCity 是**出征的出发城**（战利品记在它头上，资源归属城市）。 */
  /* ============================================================
   * v89.99（老板「幸存者不足就开发其他路径」）：**俘获溃卒** —— 唯一出口
   * 打胜时按敌军损失比例把溃卒收入**俘虏营**（s.captives，逐兵种）。
   * 参数全在 DATA.CAPTIVE（kinds 白名单：野地不俘、小仗不收、有上限）。
   * v89.142（老板 5）：入营后的**去向重做** —— 收编 = 直接转入本城相应兵种 + 支旧币
   *   （50% 兵种造价），不再折算幸存者；见下方 conscriptPlanOf / doConscriptCaptives。
   * ============================================================ */
  /* v89.113：`enemyLoss` = 敌军损失的**显式口径**（可选）。
     攻方视角可直接读 result.defLoss；**防御战**里我方是守方、敌军损失在 result.atkLoss ——
     靠 target 自己猜一定会错（这正是"守城没有俘虏/数字对不上"的一类病根）。 */
  /* ============================================================
   * v89.116（老板「伤兵营放在军务处下，俘虏营也是。出现伤病或俘虏时，
   *   列出具体兵种及数量，不要一个总数量」）
   * ------------------------------------------------------------
   * 改前：俘获当场折算成一个**总数**，直接 `pop += gain` 完事 ——
   *   既没有"俘虏营"这个落点，也看不出抓到的是些什么兵。
   * 现在：按**敌军的逐兵种损失表**折算，逐兵种入 `s.captives`（俘虏营）：
   *   · 攻方视角：敌军 = 守方 → `result.defLossBy`
   *   · 守方视角（守城）：敌军 = 攻方 → `result.atkLossBy`
   *   总数仍按 `DATA.CAPTIVE.rate` 折、仍受 `min/cap` 约束（口径不变），
   *   逐兵种分配用"按权重取整 + 余数补最大项"（与 `assignArmy` 同手法，避免取整丢人）。
   * 收编 / 释放由玩家在军务处决定（`GAME.doConscriptCaptives` / `doReleaseCaptives`）。
   * v89.142：收编已改为**转入本城军队 + 支旧币**（50% 兵种造价）—— 不再折算幸存者。
   * ============================================================ */
  GAME.battle.captiveGain = function (city, result, target, enemyLoss, enemyLossBy, opts) {
    var cfg = DATA.CAPTIVE || {};
    if (!city || !result) return { gain: 0 };
    var kinds = cfg.kinds || ['wild', 'fort', 'city', 'defense'];
    if (kinds.indexOf(target && target.kind) < 0) return { gain: 0 };
    var defLoss = (enemyLoss != null) ? enemyLoss : (result.defLoss || 0);
    if (!(defLoss > 0)) return { gain: 0 };
    /* v89.135（老板 2）：计谋「围师必阙」—— 俘获率加成走显式第 6 参（调用方给）。 */
    var _rate = (cfg.rate == null ? 0.08 : cfg.rate);
    if (opts && opts.captiveUp) _rate *= (1 + opts.captiveUp);
    var gain = Math.round(defLoss * _rate);
    if (gain < (cfg.min == null ? 15 : cfg.min)) return { gain: 0 };
    gain = Math.min(cfg.cap == null ? 500 : cfg.cap, gain);
    /* 逐兵种分配：没有明细（旧档 / 骰子引擎）→ 落一个 'unknown' 桶，
       界面显示"来历不明的一批"，不假装知道兵种。 */
    var by = enemyLossBy || {};
    var keys = [];
    var tot = 0;
    for (var k in by) { var v = Math.max(0, Math.floor(by[k] || 0)); if (v > 0) { keys.push(k); tot += v; } }
    var out = {};
    if (!keys.length) {
      out.unknown = gain;
    } else {
      var used = 0;
      keys.forEach(function (kk) {
        var n = Math.floor(gain * (Math.floor(by[kk]) / tot));
        if (n > 0) { out[kk] = n; used += n; }
      });
      var rest = gain - used;
      if (rest > 0) {                        /* 余数补给损失最大的一项（不丢人） */
        var top = keys[0];
        keys.forEach(function (kk) { if ((by[kk] || 0) > (by[top] || 0)) top = kk; });
        out[top] = (out[top] || 0) + rest;
      }
    }
    var s = GAME.state;
    s.captives = s.captives || {};
    for (var ck in out) s.captives[ck] = (s.captives[ck] || 0) + out[ck];
    return { gain: gain, byType: out, city: city.name };
  };

  /* ---- 俘虏营的两个出口（唯一出口：军务处按钮、探针、测试都走它们）---- */
  GAME.captivesTotalOf = function (camp) {
    var s = GAME.state, t = 0;
    for (var k in (s.captives || {})) t += Math.max(0, s.captives[k] || 0);
    return t;
  };
  /* ============================================================
   * v89.142（老板 5）：「俘虏营收编**直接转换为本城相应兵种**，增加相应数量。
   *   收编应支出旧币。按照相应兵种造价（所有资源换算旧币）的 50% 计算」
   * ------------------------------------------------------------
   * 三件套（全部唯一出口 —— 界面按钮文案 / 执行 / 探针 / 断言都读它们）：
   *   ① troopGoldCostOf(tid)：兵种造价的**旧币当量** = Σ 资源量 ÷ per × ratio
   *      （DATA.MARKET_SELL：粮1 木2 石3 铁4、每 20 单位 1 旧币 —— 与交易站**平价**同源；
   *       不乘交易站折损与"物多价贱"：那是"此刻卖值多少"，这里是"这座兵值多少钱"，
   *       稳定可对账，且四类同乘 → 1:2:3:4 的比例永远成立）；
   *   ② conscriptPlanOf(camp)：逐兵种转换明细 { byType, men, cost, pct }；
   *      无明细（'unknown'，旧档 / 骰子引擎）→ 计入 DATA.CAPTIVE.unknownAs（板车）；
   *      花费 = Σ(数量 × 单兵旧币造价) × conscriptPct(50%)，**一次取整**（不逐项丢零头）。
   *   ③ doConscriptCaptives：读 ② 执行 —— 扣旧币 → 逐兵种入本城军队；**不再加幸存者**
   *      （"直接转换为本城相应兵种"= 兑现物就是兵，幸存者那条旧口径整条退役）。
   * ⛔ 旧出口 `captivePopOf`（Σ 兵种数量 × pop）随本条退役 —— 它只有"收编加幸存者"
   *    这一个语义，留着就是第二个出口。
   * ============================================================ */
  GAME.troopGoldCostOf = function (tid) {
    var c = DATA.MARKET_SELL || { per: 20, ratio: {} };
    var t = DATA.TROOPS[tid];
    if (!t || !t.cost || !c.per) return 0;
    var g = 0;
    for (var k in t.cost) g += (t.cost[k] || 0) / c.per * ((c.ratio && c.ratio[k]) || 0);
    return g;
  };
  GAME.conscriptPlanOf = function (camp) {
    var cfg = DATA.CAPTIVE || {};
    var map = camp || (GAME.state || {}).captives || {};
    var by = {}, men = 0, cost = 0;
    var UNK = cfg.unknownAs || 'banche';   /* v89.229：板车 → 板车 */
    for (var k in map) {
      var n = Math.max(0, Math.floor(map[k] || 0));
      if (!n) continue;
      var tid = (k === 'unknown' || !DATA.TROOPS[k]) ? UNK : k;   /* 无明细 → 板车 */
      by[tid] = (by[tid] || 0) + n;
      men += n;
    }
    for (var t2 in by) cost += by[t2] * GAME.troopGoldCostOf(t2);
    var pct = (cfg.conscriptPct == null ? 0.5 : cfg.conscriptPct);
    return { byType: by, men: men, cost: Math.round(cost * pct), pct: pct };
  };
  /* 收编入军：**直接转换**为本城相应兵种（老板口径）；支旧币不足则整单拒绝（不半途扣） */
  GAME.doConscriptCaptives = function (cityId) {
    var s = GAME.state;
    var plan = GAME.conscriptPlanOf(s.captives);
    if (!plan.men) return { ok: false, msg: '俘虏营为空' };
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity() || s.cities[0];
    if (!city) return { ok: false, msg: '没有可安置的城市' };
    var Rc = GAME.res(city);
    if ((Rc.gold || 0) < plan.cost) {
      return { ok: false, msg: '旧币不足（收编需 ' + U.fmt(plan.cost) + '，现有 ' +
        U.fmt(Rc.gold || 0) + '）' };
    }
    Rc.gold = (Rc.gold || 0) - plan.cost;
    city.army = city.army || {};
    var bits = [];
    Object.keys(plan.byType).forEach(function (tid) {
      var n = plan.byType[tid];
      GAME.city.armyAdd(city, { [tid]: n });
      bits.push((DATA.TROOPS[tid] ? DATA.TROOPS[tid].name : tid) + '+' + U.fmt(n));
    });
    s.captives = {};
    GAME.log.sys('🪶 ' + city.name + ' 收编俘虏 ' + U.fmt(plan.men) + ' 众入军（' + bits.join('、') +
      '，支旧币 ' + U.fmt(plan.cost) + '）');
    return { ok: true, msg: '收编 ' + U.fmt(plan.men) + ' 众入军（支旧币 ' + U.fmt(plan.cost) + '）',
      n: plan.men, cost: plan.cost, byType: plan.byType, city: city.name };
  };
  /* 释放：不添幸存者，换一点声望（"仁义之师"的实惠，但明显小于收编的收益） */
  GAME.doReleaseCaptives = function () {
    var s = GAME.state;
    var n = GAME.captivesTotalOf();
    if (!n) return { ok: false, msg: '俘虏营为空' };
    var rep = Math.max(1, Math.round(n / 50));
    s.rep = (s.rep || 0) + rep;
    s.captives = {};
    GAME.log.sys('🕊 释放俘虏 ' + U.fmt(n) + ' 众（声望 +' + rep + '）');
    return { ok: true, msg: '释放 ' + U.fmt(n) + ' 众（声望 +' + rep + '）', n: n, rep: rep };
  };

  GAME.onConquer = function (npcCity, result, gen, fromCity) {
    var s = GAME.state;
    /* v89.108（兜底）：领地上限 —— 正常已在 battle.prepare 拦下（发起与抵达各一次），
       此闸只防"绕过 prepare 的路径"，宁可不占也不破上限。 */
    var _cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
    if (!_cc108.ok) {
      /* ⛔ v89.203（老板 3）：此前拒绝只进「战争日志」—— 玩家打赢后城没进来会一头雾水
         （"占领了名城却没有归属"的观感来源之一）。补一条**醒目 toast**（与日志同文案）。
         引擎尾部已有 GAME.ui 钩子先例（onBattleDone / moment / sfx），此处同款、缺 ui 时降级。 */
      var _m203 = npcCity.name + ' 城垣已破，但' + _cc108.msg + ' —— 此城未能纳入版图';
      GAME.log.war('⚠️ ' + _m203);
      if (GAME.ui && GAME.ui.notify) GAME.ui.notify('warn', _m203);
      return { ok: false, msg: _cc108.msg };
    }
    /* v89.95（A1）：**首占名城 → 节钺**（旧币买不到的稀缺资源，见 DATA.JIEYUE）。
       同一座城只算一次（jieyueClaim 幂等）；档位越高的城给得越多。 */
    var _hfCfg = DATA.JIEYUE || { byTier: {} };
    var _hfN = ((_hfCfg.byTier || {})[npcCity.type]) || 0;
    if (_hfN > 0 && GAME.jieyueClaim) {
      GAME.jieyueClaim('city:' + npcCity.id, _hfN, '首占 ' + npcCity.name);
    }
    var inherit = GAME.npcCityRes(npcCity);
    var keep = (DATA.EXPEDITION.cityInherit != null) ? DATA.EXPEDITION.cityInherit : 0.8;
    var startRes = {};
    /* v89.134：读 DATA.RES_ORDER（资源集唯一数据源） */
    DATA.RES_ORDER.forEach(function (k) {
      startRes[k] = Math.round((inherit[k] || 0) * keep);
    });
    startRes.pop = inherit.pop || 0;
    var newCity = GAME.makeCity({
      /* v91.03（老板「英雄界面显示全部英雄」根因修复）：城 id **带星球前缀** ——
         改前 'conq_'+npcCity.id 在**不同星球**会撞（两颗星都打同一座 NPC 名城 = 同 id）
         → genCityOf/cityById 按 id 只在当前星球找 → 别星城的英雄被判成**本城的城** → 泄漏。
         前缀 pid 使各星球的城 id 全局唯一。 */
      id: 'conq_p' + ((GAME.state && GAME.state.activePlanet) || 1) + '_' + npcCity.id,
      name: npcCity.name,
      x: npcCity.x, y: npcCity.y,
      type: npcCity.type,                 // v14：保留城档位 → 决定岁贡（旧都/首府/重镇/聚落）
      state: npcCity.state,               // v14：保留区属 → 决定辖区特产材料
      res: startRes,                      // v60：继承库藏
    });
    /* v89.79：占城继承的是**档位等级**（12/16/20/24）—— 与 cityLvOf 同值，
       所以占下来的城"城等级 = 政务厅等级"依然成立。 */
    newCity.level = npcCity.level;
    newCity.state = npcCity.state;      // 所属区
    newCity.origId = npcCity.id;        // 原 NPC id
    /* ============================================================
     * v60（需求 6）：**建筑就地转正** —— 未占据城市的设定是"建筑默认全满、
     * 均 N 级"（见 GAME.npcCityShadow），所以攻占一座 9 级城，拿到的就是
     * 一座 9 级满配城 + 围墙 + 满额外城地块。
     * 改前这里把非政务厅格**全部清空**、只补 2 座 1 级居所 ——
     * 那等于"打下一座名城却得到一片空地"，与"这城本该有什么"完全脱节，
     * 也让刚刚继承来的库藏与幸存者失去意义（满配建筑才是它们的存在基础）。
     * ============================================================ */
    var sh = GAME.npcCityShadow(npcCity);
    newCity.col = sh.col;                 // ⚠️ col/row 必须跟着 cells 一起换！
    newCity.row = sh.row;                 // 漏了就是"40 格却按 8×6 渲染" → 行列错乱
    newCity.cells = sh.cells.map(function (c) {
      /* v89.220（老板 3）：占城建筑带 `hiLv` = 满配等级 —— 科技闸存量宽限的基准
         （打下来的城，科技从 0 而建筑已 12~24 级：拆了能升回、突破才需研究）。 */
      return { build: c.build ? { id: c.build.id, lvl: c.build.lvl, hiLv: c.build.lvl } : null,
        pending: null, official: !!c.official };
    });
    newCity.extGrid = sh.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });
    /* v89.128：围墙从影子格**提取到环城槽**（玩家侧不占格）。
       v91.19（固定栏位）：布局里**不再有围墙格** → 直接按该城建筑等级建环城墙（否则占城无墙）。 */
    newCity.wall = { build: null, pending: null };
    var _wlBl = sh.wallLv || (GAME.npcBuildLvOf ? GAME.npcBuildLvOf(npcCity) : (sh.buildLv || 1)) || 1;
    newCity.wall.build = { id: 'chengqiang', lvl: _wlBl };
    newCity.cells.forEach(function (c) {
      /* 兼容老影子（万一仍含围墙格）：归一为居所 */
      if (c.build && c.build.id === 'chengqiang') { c.build = { id: 'minfang', lvl: c.build.lvl || 1 }; c.pending = null; }
    });
    newCity.def = npcCity.def || 0;
    /* v60（需求 4）：**占领不再另发一次性战利品** ——
       与「占领野地不取财货」同一铁律：城市连同剩余库藏（上面的 startRes）一起归你。
       原先这里还发一份 genLoot，与出征结算里的 cityResMul 是两个出口。
       材料与军械缴获不受影响（那是"城里存着的东西"，与财货不同）。 */
    /* 打造材料：按城市等级掉落 */
    GAME.battle.grantMaterials(DATA.CITY_MATERIAL[npcCity.type] || DATA.CITY_MATERIAL.jun, 1, '缴获物资');
    /* 军械战利品：图纸与成品装备（装备获取途径之一） */
    var eq = GAME.battle.rollEquipLoot(npcCity);
    if (eq.length) GAME.log.war('缴获军械：' + eq.join('、'));
    GAME.registerCity(newCity);   /* v89.161：入库唯一出口（缴获的旧币并进玩家池） */
    /* ⛔ v90.93：声望的赛季国策增益（STORY.repMult）随年号纪元退役。 */
    var repGain = Math.round((npcCity.rep || 10)
      * (1 + GAME.artifactBonusNum('repPct')));   /* v79：传国玉玺 —— 声望获得 +5%/级 */
    s.rep += repGain;
    /* 从 NPC 列表移除 */
    var idx = -1;
    for (var i = 0; i < s.map.cities.length; i++) if (s.map.cities[i].id === npcCity.id) { idx = i; break; }
    if (idx >= 0) s.map.cities.splice(idx, 1);
    /* v91.25（球系）：新城入 s.cities 后 terrainAt 自然返回 'city'，无需改平面格。 */
    /* 英雄经验（v55 · 与野地战同一个出口）：
       原来写 `rep × 5`（聚落 300、旧都 2000）—— 与野地那套口径互不相干，
       而且比"打一块 10 级野地"还少，攻下名城的战功反而最不值钱。
       现在统一按**实际歼灭的守军资源量**折算，攻名城自然给得比野地多。 */
    if (gen && result && result.defLossBy) {
      var expC = GAME.battle.battleExp(result.defLossBy, gen);
      result.expInfo = GAME.battle.gainExp(gen, expC.gain, '攻占 ' + npcCity.name);
      result.expGain = expC.gain;
      result.expRaw = expC.raw;
      result.expCapped = expC.capped;
    }
    /* v79（神器 · 特殊活动）：开疆拓土 → 供奉值大额入账（按城档折算） */
    if (GAME.artGain) {
      GAME.artGain(((DATA.ARTIFACT || {}).capturePts || {})[npcCity.type] || 40, '开疆拓土 · ' + npcCity.name);
    }
    /* 英雄必降：按城匹配（城名一致，或坐标邻近 ±3 格） */
    var hero = GAME.battle.grantHero(npcCity, fromCity);
    /* v86：挑拨离间 —— 守将忠诚 ≤25（累计施计 ≥3 次）时，战胜后 50% 倒戈归降。
       种子不用随机数：同一个城同一局结果稳定（照 invasionRoll 先例，
       断言可复现；roll 值仅由城 id 与结果决定）。 */
    (function () {
      if (!GAME.schemeOf || !GAME.schemeMarksOf) return;
      var _tk = 'npc:' + npcCity.id;
      var _n = GAME.schemeMarksOf(_tk, 'tiaobo');
      if (!_n) return;
      var _tsc = GAME.schemeOf('tiaobo');
      var _loy = Math.max(0, 100 - _tsc.eff.loyaltyDrop * _n);
      if (_loy > _tsc.eff.joinAt) return;
      var _roll = GAME.invasionRoll ? GAME.invasionRoll('tj|' + npcCity.id + '|' + _n) : Math.random();
      if (_roll >= _tsc.eff.joinChance) return;
      var _ng = GAME.npcCityInfo ? GAME.npcCityInfo(npcCity).guard : null;
      if (!_ng) return;
      var _gj = GAME.makeHero(_ng, _ng.level);
      _gj.loyalty = 50;
      if (fromCity) _gj.cityId = fromCity.id;
      GAME.gen.add(_gj);   /* v91.65 */
      GAME.log.war('🕸️ 挑拨离间奏效：守将 ' + _ng.name + ' 倒戈归降，愿效犬马之劳！');
    })();
    /* 美人 50% 几率（攻占重镇/首府）—— v91.02：传出发城，女将归降该城（不再无归属） */
    if (npcCity.type !== 'capital' && Math.random() < 0.5) GAME.battle.grantBeauty(npcCity, fromCity);
    /* v90.92：任务系统退役 —— 原 advanceConquer（已占城计数）已删。 */
    GAME.log.war('占领新城市：' + npcCity.name + '！（威望 +' + repGain + '）');
    /* v89.93（整改 E5）：**占城演出** —— 核心目标达成，值一张卡（此前只有一行日志） */
    if (GAME.ui && GAME.ui.moment) {
      GAME.ui.moment({
        kind: 'card', icon: '🏯', title: '克城 · ' + npcCity.name,
        /* v89.116：原读 `DATA.CITY_TIER_NAME`（不存在）→ 提示里显示原始英文键。
           真口径 = `GAME.cityTierName`（读 DATA.CITY_TIER，与城市信息面板同源）。 */
        sub: '威望 +' + repGain + '　·　' + (npcCity.state || '') + '　·　'
          + (GAME.cityTierName ? GAME.cityTierName({ type: npcCity.type }) : npcCity.type),
        lines: ['城防已破，府库入我囊中。', '「' + npcCity.name + '」自此易帜，天下侧目。']
      });
      GAME.ui.sfx('rank');
    }
    /* ⛔ v91.36（老板「占领旧都并非结束」）：`GAME.checkVictory()`（天下一统弹窗）调用**删除**。 */
  };

  /* ============================================================
   * v89.115（老板「设计斗将战」）：**斗将战**（英雄个人战 · 军队战前）
   * ------------------------------------------------------------
   * · 触发：只在**双方都有英雄**时才有得斗（出击打野地/据点/名城 · 我方主将 vs 守将）；
   *   概率 = DATA.DUEL.chance（50%）。敌方无将（如流寇来袭）→ 不触发。
   * · 个人战：逐合比"武力 ×2 + 指挥 + 谋略 ×0.5 + 等级 ×2"（各带确定性抖动），
   *   先占先多者胜（DATA.DUEL.rounds 合）。
   * · 结果：胜者英雄**属性 +bonusPct（10%）** —— 以"深拷贝并放大属性"实现，
   *   原件不动 → 天然只是"这一战"；加成经 genAttrs 链（攻/防/指挥覆盖/速度）
   *   传导成**全军战斗力**。
   * · 确定性：种子由调用方给（同一个 seed 必得同一结果）—— 观战挂起与沙盘配方
   *   都靠"把结果存进 _sim"来复现，重放绝不重掷（v89.87 会话制的同一原则）。
   * ============================================================ */
  GAME.battle.duelBoostOf = function (g, pct) {
    if (!g) return g;
    var D = DATA.DUEL || {};
    var m = 1 + (pct == null ? (D.bonusPct == null ? 0.10 : D.bonusPct) : pct);
    var out = U.deep(g);
    ['tong', 'yw', 'zm', 'nz', 'spd'].forEach(function (k) {
      out[k] = Math.round((out[k] || 0) * m);
    });
    out._duelBoost = m;                 /* 标记：让战报/断言能看出"这是斗将后的那一份" */
    return out;
  };
  /* 斗将种子（确定性随机源）：同一场战斗一个值 —— 目标坐标 + 现实毫秒 */
  GAME.battle.duelSeedOf = function (target) {
    var t = target || {};
    return (t.x == null ? '-' : t.x) + ',' + (t.y == null ? '-' : t.y) + '@' + U.now();
  };
  /* 掷一次斗将（纯函数：只读两名英雄，不落任何状态） */
  GAME.battle.rollDuel = function (atkGen, defGen, seed) {
    var D = DATA.DUEL || {};
    if (!D.enabled || !atkGen || !defGen) return null;
    var roll = GAME.invasionRoll('duel|' + atkGen.id + '|' + defGen.id + '|' + (seed == null ? 0 : seed));
    var ch = (D.chance == null ? 0.5 : D.chance);
    if (roll >= ch) return { done: false, chance: ch, log: ['二将未及交锋（斗将未触发）'] };
    var pa = GAME.genAttrs ? GAME.genAttrs(atkGen) : atkGen;
    var pb = GAME.genAttrs ? GAME.genAttrs(defGen) : defGen;
    function power(a, g, salt) {
      var v = (a.yw || 0) * 2 + (a.tong || 0) + (a.zm || 0) * 0.5 + (g.level || 1) * 2;
      return v * (0.85 + GAME.invasionRoll('duelp|' + g.id + '|' + salt) * 0.3);
    }
    var rounds = Math.max(1, D.rounds == null ? 3 : D.rounds);
    var wa = 0, wb = 0, log = [];
    for (var i = 1; i <= rounds; i++) {
      if (power(pa, atkGen, i) >= power(pb, defGen, i + 100)) { wa++; log.push('第' + i + '合 ' + atkGen.name + ' 占先'); }
      else { wb++; log.push('第' + i + '合 ' + defGen.name + ' 占先'); }
    }
    var winner = (wa >= wb) ? 'atk' : 'def';
    log.push('斗将 ' + rounds + ' 合，' + (winner === 'atk' ? atkGen.name : defGen.name) + ' 胜（' + wa + ' : ' + wb + '）');
    return { done: true, winner: winner, wa: wa, wb: wb, rounds: rounds,
      winnerName: (winner === 'atk' ? atkGen.name : defGen.name),
      bonusPct: (D.bonusPct == null ? 0.10 : D.bonusPct), log: log };
  };
  /* 出征面板的预告一句（无守将/不适用 → 空串） */
  GAME.battle.duelPreviewOf = function (atkGen, defGen) {
    var D = DATA.DUEL || {};
    if (!D.enabled || !atkGen || !defGen) return '';
    return '⚔ 斗将：' + U.escape(atkGen.name) + ' vs ' + U.escape(defGen.name) +
      '（战前 ' + Math.round((D.chance == null ? 0.5 : D.chance) * 100) + '% 触发 · 胜者全军 +' +
      Math.round((D.bonusPct == null ? 0.10 : D.bonusPct) * 100) + '%）';
  };

  /* ============================================================
   * v92.9（构想 C1）：**手动斗将** —— 招式心理战
   * ------------------------------------------------------------
   * 文档：「已有 stub 但是自动比大小。要做成玩法需三件：
   *   ①可选非强制 ②招式心理战（看不到对手出什么）③将领性格决定招式池」。
   *
   * 这里给 ②③ 一个可操作的形状：
   *   · 玩家出 5 招（突刺/格挡/佯攻/蓄力），每招克一种、被一种克；
   *   · 对手的招式**当合不显示**，只看得到"谁占先"；
   *   · 对手出招由**属性倾向**加权（高武力偏突刺、高谋略偏佯攻、
   *     高统率偏格挡），所以观察两合能猜 —— 这是"可预判"那一半；
   *   · 结果不可撤销（这一场合就是这一场），这是"不可逆"那一半。
   *
   * 纯函数：不落任何状态。履历由调用方（GAME.doDuel）记。
   * ============================================================ */
  GAME.battle.duelTendency = function (g) {
    /* 倾向 = 属性权重，返回一组相对权重（不需要归一化，抽样时按累计）*/
    var yw = (g && g.yw) || 10, zm = (g && g.zm) || 10, tong = (g && g.tong) || 10;
    return {
      stab: 1 + yw / 20,        /* 武力高 → 突刺 */
      guard: 1 + tong / 20,     /* 统率高 → 格挡 */
      feint: 1 + zm / 20,       /* 谋略高 → 佯攻 */
      charge: 1.1               /* 蓄力：谁也不特别偏好，留个底 */
    };
  };
  /* 对手当合出什么（确定性：同一 seed 同一合必得同一招） */
  GAME.battle.duelEnemyMove = function (defGen, round, seed) {
    var D = DATA.DUEL || {};
    var order = D.moveOrder || ['stab', 'guard', 'feint', 'charge'];
    var w = GAME.battle.duelTendency(defGen);
    var tot = 0, i;
    for (i = 0; i < order.length; i++) tot += (w[order[i]] || 1);
    var r = GAME.invasionRoll('duelm|' + (defGen && defGen.id) + '|' + round + '|' + (seed == null ? 0 : seed)) * tot;
    var acc = 0;
    for (i = 0; i < order.length; i++) {
      acc += (w[order[i]] || 1);
      if (r < acc) return order[i];
    }
    return order[order.length - 1];
  };
  /* 打一场手动斗将：moves = ['stab','guard',...]（长度 playRounds） */
  GAME.battle.duelPlay = function (atkGen, defGen, moves, seed) {
    var D = DATA.DUEL || {};
    var MV = D.moves || {};
    if (!atkGen || !defGen || !moves || !moves.length) return null;
    var need = D.winScore || 3;
    var wa = 0, wb = 0, log = [], rows = [];
    for (var i = 0; i < moves.length; i++) {
      var am = moves[i];
      var bm = GAME.battle.duelEnemyMove(defGen, i + 1, seed);
      var res;
      if (am === bm) res = 'tie';
      else if (MV[am] && MV[am].beats === bm) res = 'a';
      else res = 'b';
      if (res === 'a') wa++; else if (res === 'b') wb++;
      var an = (MV[am] || {}).name || am, bn = (MV[bm] || {}).name || bm;
      rows.push({ r: i + 1, a: am, b: bm, aName: an, bName: bn, res: res });
      log.push('第' + (i + 1) + '合：' + an + ' 对 ' + bn + '　'
        + (res === 'a' ? (atkGen.name + ' 占先') : res === 'b' ? (defGen.name + ' 占先') : '相持'));
      if (wa >= need || wb >= need) break;          /* 先到 3 分即止 */
    }
    var winner = wa > wb ? 'atk' : (wb > wa ? 'def' : 'draw');
    log.push('斗将 ' + rows.length + ' 合，' + (winner === 'atk' ? atkGen.name : winner === 'def' ? defGen.name : '未分胜负')
      + '（' + wa + ' : ' + wb + '）');
    return { done: true, winner: winner, wa: wa, wb: wb, rows: rows, log: log,
      winnerName: winner === 'atk' ? atkGen.name : winner === 'def' ? defGen.name : '未分胜负',
      bonusPct: (D.bonusPct == null ? 0.10 : D.bonusPct) };
  };

  /* ============================================================
   * v92.13（C1 补完）：**斗将士气**
   * ------------------------------------------------------------
   * 审计里 C1 判定是「◐ 手动版已做，未接战前士气」——
   * 赢一场斗将只记履历，没有战略意义。这里接上。
   *
   * 口径：
   *   · 手动斗将胜 → 该英雄 2 现实小时内"有士气"；
   *   · 这 2 小时里他出征，**只在"斗将本来没触发"的空档**补成我方胜；
   *   · 已经打过的对拼**不改写**（士气不是外挂，赢了就是赢了，输了还是输了）；
   *   · 结果仍是"胜者属性 +10%"（复用 duelBoostOf），不新造加成。
   * ============================================================ */
  GAME.battle.MORALE_MS = 2 * 3600000;
  GAME.battle.moraleOf = function (g) {
    if (!g || !g.duelMoraleUntil) return false;
    return g.duelMoraleUntil > Date.now();
  };
  GAME.battle.applyMorale = function (duel, gen) {
    if (!gen) return duel;
    if (!GAME.battle.moraleOf(gen)) return duel;
    var out = duel || { done: false };
    if (out.done && out.winner) { out.morale = true; return out; }   /* 打过了，不改写 */
    out.done = true;
    out.winner = 'atk';
    out.winnerName = gen.name;
    out.morale = true;
    out.wa = out.wa == null ? 0 : out.wa;
    out.wb = out.wb == null ? 0 : out.wb;
    out.bonusPct = (DATA.DUEL && DATA.DUEL.bonusPct != null) ? DATA.DUEL.bonusPct : 0.10;
    out.log = ['斗将：' + gen.name + ' 挟前番叫阵之威，先声夺人（士气）'];
    return out;
  };

  /* ============================================================
   * v92.14（老板：斗将可以派将领去挑衅其他城池，获得特殊奖励）
   * ------------------------------------------------------------
   * 玩家版：地图点一座敌城 → 「派将挑衅」→ 与该城守将打 5 合心理战。
   *   赢：那城**胆寒** 24 小时（守军 −12%）+ 我方英雄获 2 小时士气；
   *   输：英雄掉 20 点体力（不做重伤 —— 点一次输一次太挫败）；
   *   无守将：叫阵无人应，直接拒（不消耗）。
   * 与"向势力叫阵"的区别：那个只记履历，这个**真的削弱下一次攻城**。
   * ============================================================ */
  /* 把"胆寒"作用到守军编成上 —— 抽成纯函数，测试能直接验 */
  GAME.battle.applyFearTo = function (army, pct) {
    if (!army || !(pct > 0)) return army;
    var out = {};
    for (var k in army) out[k] = Math.max(1, Math.round((army[k] || 0) * (1 - pct)));
    return out;
  };

  GAME.battle.fearOf = function (t) {
    var st = GAME.state;
    if (!st || !st.cityFear) return 0;
    var cid = t && ((t.npc && t.npc.id) || t.cityId || (t.city && t.city.id));
    if (!cid) return 0;
    var f = st.cityFear[cid];
    if (!f) return 0;
    if ((f.until || 0) <= Date.now()) { delete st.cityFear[cid]; return 0; }
    return f.pct || 0;
  };

  GAME.battle.provoke = function (npc, gen, moves, seed) {
    var D = DATA.DUEL || {};
    if (!npc) return { ok: false, msg: '没有目标城' };
    if (!gen) return { ok: false, msg: '要派一位英雄去' };
    var nci = GAME.npcCityInfo ? GAME.npcCityInfo(npc) : null;
    var guard = nci && nci.guard;
    if (!guard) return { ok: false, msg: '这座城没有守将，叫阵无人应' };
    var res = GAME.battle.duelPlay(gen, guard, moves, seed);
    if (!res) return { ok: false, msg: '斗将无法开始' };
    var st = GAME.state;
    st.cityFear = st.cityFear || {};
    if (res.winner === 'atk') {
      var hours = D.fearHours == null ? 24 : D.fearHours;
      st.cityFear[npc.id] = { until: Date.now() + hours * 3600000, pct: (D.fearPct == null ? 0.12 : D.fearPct) };
      gen.duelW = (gen.duelW || 0) + 1;
      gen.duelMoraleUntil = Date.now() + ((GAME.battle.MORALE_MS) || 7200000);
      return { ok: true, res: res,
        msg: '挑衅得手：' + (GAME.cityFullName ? GAME.cityFullName(npc) : '该城')
          + ' 守军胆寒 ' + hours + ' 小时（守军 −' + Math.round((D.fearPct == null ? 0.12 : D.fearPct) * 100) + '%）' };
    }
    if (res.winner === 'def') {
      gen.duelL = (gen.duelL || 0) + 1;
      var cost = D.provokeStaCost == null ? 20 : D.provokeStaCost;
      if (GAME.setStaNow && GAME.staNow) GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - cost));
      return { ok: false, res: res, msg: '挑衅失手：' + guard.name + ' 占了上风，' + gen.name + ' 折了一阵（体力 −' + cost + '）' };
    }
    return { ok: false, res: res, msg: '势均力敌，双方各自收兵（不算得手）' };
  };

  /* 战利品按城类型 */
  GAME.battle.genLootEx = function (c, extMul, rnd, dry) {
    var tier = (c && c.type) ? c.type
      : (c && c.kind === 'wild' ? 'wild'
      : ((c && c.dropType) || 'county'));
    /* v89.109（老板「10 级野外城市资源量那么少，必有错误」）：三处修正 ——
       ① 据点曲线 1.35 → **2.15**：取证（probe_v89109_fortres.js）——
          旧口径下 Lv10 据点打 22.4 万守军只抢 44 万资源（掠夺/守军 = 1.97），
          而聚落同口径是 785 —— 打一场损兵成本就 ≥2000 万（1 万步行机 ≈ 1050 万资源），
          掠夺 44 万 = 血亏 50 倍。新曲线 Lv10 ≈ 3200 万（≈ 阵亡两万兵的成本，保本略赚）。
       ② **野地补等级曲线**：旧口径 Lv1/5/10 掠夺量恒为 12.7 万（tier 落 'county'
          不吃 lv）—— 高级野地白打。补 1.45^(lv-1)。同等级下**据点 > 野地**仍成立
          （Lv8：425 万 vs 172 万）。
       ③ 档位表补 `wild: 0.9` —— tier 判据新增 'wild' 后，若表里没有它就会落
          `|| 1` 兜底，白涨 11%（改判据不能改到不该改的口径）。 */
    var mult = { wild: 0.9, fort: 0.5, county: 0.9, jun: 1, zhou: 3, capital: 8 }[tier] || 1;
    mult *= (extMul == null ? 1 : extMul);
    if (tier === 'fort') mult *= Math.pow(2.15, (c.lv || c.level || 1) - 1);
    /* v91.90（老板「把野地资源砍一砍，一块地那么多钱说不过去」）：
       **野地掠夺 = 守军人数 × 每兵资源**（默认 80），不再用 1.45^(lv-1) 的指数曲线。
       理由：指数曲线比守军涨得快 —— 旧口径 Lv15 守军 27 万却给 1746 万资源（每兵 65），
       而 Lv10 只有 357 万；改成"每兵固定"之后，一处参数同时兜住三件事
       （打多大的仗 / 损多少兵 / 抢多少东西），实测盈亏恒定在打平。
       基准 = 四资源中值合计 71500（grain25000+wood20000+stone15000+iron11500）。 */
    if (tier === 'wild') {
      var _wl = Math.max(0, Math.min(15, (c.lv || c.level || 0) | 0));
      var _tb = DATA.WILD_DEFENSE[_wl] || [], _cnt = 0;
      for (var _i = 0; _i < _tb.length; _i++) _cnt += (_tb[_i].min + _tb[_i].max) / 2;
      /* 按**守军造价**给（不是按人头）—— 后期守军兵种贵，按人头会覆盖不了战损。
         5% 正好等于"一场 5% 损兵"的补员成本：打平，不赚不亏。 */
      var _mid = {}, _val = 0;
      for (var _j = 0; _j < _tb.length; _j++) _mid[_tb[_j].id] = (_tb[_j].min + _tb[_j].max) / 2;
      _val = GAME.battle.armyResourceValue(_mid);
      var _r = (DATA.EXPEDITION && DATA.EXPEDITION.wildLootRatio) || 0.05;
      mult *= (_val * _r) / 71500;
    }
    /* 载重优化：掠夺与采集收获 +5%/级（负重 = 能搬回来多少） */
    mult *= (1 + TB('load'));
    /* v89.114：随机源与落账开关**显式传入**（`rnd` 默认 Math.random）——
       出征面板的"目标估掠"用同一公式取区间中值（rnd 恒 0.5、dry=true 不落账），
       于是"面板看到的量"与"结算搬回来的量"永远同一份公式，不会两处漂移。 */
    var rd = rnd || Math.random;
    /* v89.189（老板 2）：基数收进 DATA.LOOT_BASE（唯一数据源）——旧币随价值体系下调，
       资源保持 v89.109 曲线（与建筑/军费规模匹配）。 */
    var LB = DATA.LOOT_BASE || {};
    function _rg189(k, d0, d1) {
      var rg = LB[k] || [d0, d1];
      return rg[0] + rd() * (rg[1] - rg[0]);
    }
    var out = {
      grain: Math.round(_rg189('grain', 20000, 30000) * mult),
      wood: Math.round(_rg189('wood', 15000, 25000) * mult),
      stone: Math.round(_rg189('stone', 10000, 20000) * mult),
      iron: Math.round(_rg189('iron', 8000, 15000) * mult),
      gold: Math.round(_rg189('gold', 200, 600) * mult),
    };
    /* 珠宝：忠诚管理的补给来源（越高等级城市越多）。dry（估算）不掷骰、不落账 */
    if (!dry && rd() < 0.55) {
      var jewels = DATA.ITEMS.filter(function (it) { return it.type === 'jewel'; });
      var jTop = Math.min(jewels.length, mult + 3);
      var j = jewels[Math.floor(rd() * jTop)];
      var cnt = 1 + Math.floor(rd() * (mult > 2 ? 3 : 1));
      GAME.items.add(j.id, cnt);   /* v91.63 */
      GAME.log.war('缴获珠宝：' + j.name + ' ×' + cnt);
    }
    return out;
  };
  /* 正常掷骰生成（原入口，签名不变） */
  GAME.battle.genLoot = function (c, extMul) {
    return GAME.battle.genLootEx(c, extMul, Math.random, false);
  };
  /* 期望口径（不掷骰、不落账）：出征面板「目标估掠」用 —— 只给基准量，
     战时加成（废墟搜刮 / 趁火打劫）因人而异，不进估算。 */
  GAME.battle.lootEstOf = function (c, extMul) {
    return GAME.battle.genLootEx(c, extMul, function () { return 0.5; }, true);
  };

  /* ============================================================
   * v89.109（老板「只有打破围墙并杀死出城迎战的军队，才能进行资源掠夺」）
   * —— **掠夺前置闸，唯一出口**（我方掠夺 NPC 与敌方来掠夺我方，共用这一个判据）
   * ------------------------------------------------------------
   * 判定（看一场战斗的 result）：
   *   ① **破防**：城防工事（箭塔 = 围墙的具象）被拆光，**或**守军被全歼 ——
   *      两者达成其一即算"这座城已经失去抵抗"（无工事的目标视为无墙可破，恒过）；
   *   ② **出城迎战部队被歼灭**：守方若把某些兵种设为出城迎战（sortie），
   *      它们在野战军全部阵亡前挡住攻方（tactic 里连拆墙都被拦），
   *      所以"杀光他们"是破城的一部分；没有出城部队时恒过。
   * ⚠️ 只闸**掠夺资源**（战利品）—— 兵损、经验、材料/军械掉落照旧：
   *    打仗本身的代价与收益不受影响，缺的只是"搬走库藏"这一步。
   * ============================================================ */
  GAME.battle.lootGateOf = function (r, t) {
    if (!r) return { ok: true, msg: '' };
    if (r.engine !== 'tactic') return { ok: true, msg: '' };   /* 骰子引擎（旧口径回退）不受闸 */
    var wallOk = !(r.towerStart > 0) || (r.towerLeft <= 0) || (r.defRemain <= 0);
    var sortieOk = !(r.defSortieStart > 0) || (r.defSortieLeft <= 0);
    if (wallOk && sortieOk) return { ok: true, msg: '' };
    var why = [];
    if (!wallOk) {
      why.push('围墙未破（城防工事余 ' + r.towerLeft + '/' + r.towerStart + '，守军余 '
        + U.numText(r.defRemain, 0) + '）');
    }
    if (!sortieOk) {
      why.push('出城迎战的守军尚未歼灭（余 ' + U.numText(r.defSortieLeft, 0) + '）');
    }
    return { ok: false, msg: '掠夺无功而返：' + why.join('、')
      + ' —— 破墙（打箭塔）或全歼守军后，再来劫掠' };
  };

  /* ============================================================
   * v89.114（老板「为兵种增加负重属性…掠夺返回的物资数量，与军队总负重有关」）
   * —— **掠夺搬运：两个唯一出口**（幸存编制 / 搬运计划）
   * ------------------------------------------------------------
   * 病根：掠夺量一直是"凭空全给" —— 打多少给多少，与带了多少人、多少人活着
   * 回来毫无关系。负重（DATA.TROOPS[].load）只在"随军辎重"一条线上生效。
   *
   * 口径（两条）：
   *   ① **幸存编制**（`survivedArmyOf`）= 逐兵种 floor(编制 × 幸存率)，
   *      幸存率 = `result.atkRemain / 编制总数`（与 `returnArmy` 归队同一把尺，
   *      `returnArmy` 已改为直接调本函数 —— 一个算法、两处消费，不许各算一份）。
   *   ② **搬运计划**（`haulPlanOf`）= 能搬走多少：
   *        cap  = 幸存部队总载重（`cargoCapOf`） − 去程随军辎重（一支部队一份运力）
   *        超载时按同一比例缩放各类战利品（保持结构），余数**留在原处**（下次可再取）。
   *
   * 设计效果（标定见 probe_v89114_load.js）：纯战兵编队可搬同级战利品约 1/4~1/3；
   * 编入 ~1% 运输平台（或 5% 板车）即可全数搬回 —— "带不带后勤"从此是一道真题。
   * ============================================================ */
  GAME.battle.survivedArmyOf = function (sentArmy, result) {
    var out = {}, aStart = 0, id;
    var T = DATA.TROOPS || {};
    /* v89.179b·P0-2：参战兵口径 = 不含 nocombat（侦察单元/后勤）的兵种。
       原 aStart 把侦察单元也算进分母，而 result.atkRemain 只统计参战兵（tactic 跳过 nocombat）
       → 幸存率被稀释、侦察单元也按比例蒸发。修复：侦察单元整队返回，不进幸存率分母；
       无 nocombat 兵种时与旧行为完全一致（向后兼容）。 */
    for (id in (sentArmy || {})) {
      if (T[id] && T[id].nocombat) continue;
      aStart += Math.max(0, Math.floor(sentArmy[id] || 0));
    }
    var keep = aStart > 0 ? Math.max(0, Math.min(1, (result && result.atkRemain || 0) / aStart)) : 1;
    for (id in sentArmy) {
      var n = Math.floor(sentArmy[id] || 0);
      if (n <= 0) continue;
      if (T[id] && T[id].nocombat) { out[id] = n; continue; }   /* 非参战兵整队返回 */
      out[id] = Math.floor(n * keep);
    }
    return out;
  };
  /* 搬运上限（单一算式）：幸存部队的载重 − 去程已载辎重（下限 0） */
  GAME.battle.haulCapOf = function (o) {
    o = o || {};
    var surv = GAME.battle.survivedArmyOf(o.army || {}, o.result);
    var cap = Math.max(0, GAME.cargoCapOf(surv) - GAME.cargoLoadOf(o.cargo || null));
    /* ============================================================
     * v92：**距离折损** —— 远征半径的真实手感
     * ------------------------------------------------------------
     * 老板：「全图开放缺探索」「兵源无限…什么设定在摧毁游戏」。
     * 这里不禁止远行（禁止 = 墙，不是取舍），而是让远行的**收获变薄**：
     * 路上要吃的、要带的、要留人看着的，都从搬运力里扣。
     *
     * 近处（5 格）= 几乎全额带回；中等（20 格）≈ 七成半；
     * 极远（60 格以上）只剩一成半 —— 地板 15% 而不是 0：
     * 打下来却一件不剩，玩家只会觉得"这仗白打了"，而不是"下次该带辎重队"。
     * ============================================================ */
    if (o.dist > 0) {
      var k = (DATA.EXPEDITION && DATA.EXPEDITION.haulDecayPerTile) || 0;
      if (k > 0) cap = cap * Math.max(0.15, 1 - o.dist * k);
    }
    return cap;
  };
  /* 一批战利品的**重量**（粮木石铁旧币同权 1:1，与 cargoLoadOf 同源同口径） */
  GAME.battle.lootWeightOf = function (loot) {
    var w = 0, keys = GAME.TRANSPORT_KEYS || [];
    for (var i = 0; i < keys.length; i++) {
      w += Math.max(0, Math.floor((loot || {})[keys[i]] || 0));
    }
    return w;
  };
  /* 搬运计划（纯函数，不落账）：{ cap, weight, factor, keep, left, kept, lost, decay, dist } */
  GAME.battle.haulPlanOf = function (o) {
    o = o || {};
    var loot = o.loot || {};
    var cap = GAME.battle.haulCapOf(o);
    /* v92：无折损基准（同一算式但不传 dist）—— 只为了把"折了多少"算出来给战报看。
       结算一场仗调两次 survivedArmyOf 无所谓；关键是口径同源，
       不许在战报里另写一个"距离折扣"公式（那就是两份实现了）。 */
    var capFull = GAME.battle.haulCapOf({ army: o.army, result: o.result, cargo: o.cargo });
    var decay = capFull > 0 ? Math.max(0, Math.min(1, cap / capFull)) : 1;
    var wt = GAME.battle.lootWeightOf(loot);
    var factor = wt > 0 ? Math.min(1, cap / wt) : 1;
    var keep = {}, left = {}, kept = 0;
    (GAME.TRANSPORT_KEYS || []).forEach(function (k) {
      var v = Math.max(0, Math.floor(loot[k] || 0));
      var g = Math.floor(v * factor);     /* 逐项 floor → 总量必然 ≤ cap（不会超装） */
      keep[k] = g;
      left[k] = v - g;
      kept += g;
    });
    return { cap: cap, weight: wt, factor: factor, keep: keep, left: left,
      kept: kept, lost: wt - kept, decay: decay, dist: o.dist || 0 };
  };

  /* 打造材料掉落：表 = { matId: [min, max] }，mult 为数量倍率 */
  GAME.battle.grantMaterials = function (table, mult, label) {
    var s = GAME.state;
    if (!table) return [];
    var got = [];
    for (var mid in table) {
      var rng = table[mid], lo = rng[0], hi = rng[1];
      var cnt = Math.round((lo + Math.random() * (hi - lo + 1)) * (mult || 1));
      if (cnt <= 0) continue;
      GAME.items.add(mid, cnt);
      var m = DATA.MATERIAL_BY_ID[mid];
      got.push((m ? m.name : mid) + '×' + cnt);
    }
    if (got.length && label) GAME.log.war(label + '：' + got.join('、'));
    return got;
  };

  /* 军械战利品：按城类型掉落「图纸」或「成品装备」 */
  GAME.battle.rollEquipLoot = function (npcCity) {
    if (!npcCity) return [];
    /* 野地：无军械 */
    if (npcCity.kind === 'wild') return [];
    if (npcCity.kind === 'fort') npcCity = { type: 'fort', level: npcCity.lv, name: npcCity.name, x: npcCity.x, y: npcCity.y };
    else if (npcCity.kind === 'city') npcCity = npcCity.npc || npcCity;
    var s = GAME.state;
    var rule = DATA.LOOT_EQUIP[npcCity.type] || DATA.LOOT_EQUIP.jun;
    var got = [];
    /* ① 图纸 */
    if (Math.random() < rule.blueprint) {
      var owned = s.items || {};
      var bps = DATA.BLUEPRINTS.filter(function (b) { return !owned[b.id]; });
      var bp = bps.length ? bps[Math.floor(Math.random() * bps.length)] : DATA.BLUEPRINTS[Math.floor(Math.random() * DATA.BLUEPRINTS.length)];
      GAME.items.add(bp.id, 1);
      got.push(bp.name + '（图纸）');
    }
    /* ② 成品装备（品质随城等级） */
    if (Math.random() < rule.piece) {
      var lo = rule.q[0], hi = rule.q[1];
      var q = lo + Math.floor(Math.random() * (hi - lo + 1));
      var pool = [];
      /* v90.14：散件退役 —— 缴获改为**套装件**（按品质 q 取同档任意套装件）。 */
      Object.keys(DATA.EQUIP).forEach(function (k) {
        var e = DATA.EQUIP[k];
        if (e && e.set && e.q === q) pool.push(k);
      });
      if (!pool.length) pool.push('coarse_ti_chest');
      var id = pool[Math.floor(Math.random() * pool.length)];
      if (DATA.EQUIP[id]) {
        GAME.addEquip(id);   /* v79：缴获入包走实例唯一出口 */
        got.push(DATA.EQUIP[id].name);
      }
    }
    return got;
  };

  /* 攻占名城 → 镇守英雄必定投降 */
  GAME.battle.grantHero = function (npcCity, fromCity) {
    var s = GAME.state;
    /* v64：降将也要有归属城（席位按城算，无主之将会随"当前在看哪座城"飘）。
       取**出征的出发城** —— 谁打下来的就归谁。 */
    var home = fromCity || GAME.currentCity() || (s.cities && s.cities[0]) || null;
    var candidates = DATA.HEROES.filter(function (h) {
      /* v90.100：出身城**按城名匹配**（去 (x,y) 坐标依赖；h.city 为英雄的出生名城名）。 */
      return h.city === npcCity.name;
    });
    if (!candidates.length) return null;
    var h = candidates[Math.floor(Math.random() * candidates.length)];
    /* 已拥有则跳过 */
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].name === h.name) return null;
    var g = GAME.makeHero(h);
    g.loyalty = 60;
    if (home) g.cityId = home.id;
    GAME.gen.add(g);   /* v91.65 */
    GAME.log.war('守将 ' + h.name + ' 归降！（攻打城市必降）');   /* v89.188（老板 3）：文案中性化 */
    return g;
  };

  /* 美人 50% */
  GAME.battle.grantBeauty = function (npcCity, fromCity) {
    var s = GAME.state;
    var owned = {};
    s.generals.forEach(function (g) { owned[g.name] = true; });
    var cands = DATA.BEAUTIES.filter(function (b) { return !owned[b.name]; });
    if (!cands.length) return null;
    var b = cands[Math.floor(Math.random() * cands.length)];
    var g = GAME.makeHero(b);
    g.loyalty = 60;
    /* v91.02：**降将也要有归属城**（与 grantHero 同款）—— 改前这里没写 cityId →
       null → genCityOf 回退"当前城" → 这位女将**在每个城里都出现**（老板报的"英雄界面
       显示全部英雄而非本城"），且会随"在看哪座城"飘。取出征出发城：谁打下来的就归谁。 */
    var home = fromCity || GAME.currentCity() || (s.cities && s.cities[0]) || null;
    if (home) g.cityId = home.id;
    GAME.gen.add(g);   /* v91.65：名册唯一入口 */
    GAME.log.war('获得女将 ' + b.name + '！（掠夺/占领野外城市50%几率）');   /* v89.188（老板 3）：文案中性化 */
    return g;
  };

  /* --------- 野地战斗 --------- */
  /* ============================================================
   * 出征三方式（v13）
   *   侦查：不接战，探明虚实 + 顺手物资 + 宝物线索
   *   掠夺：接战但不占，资源/材料/珠宝最丰
   *   占领：接战并据有，得地得城
   * ============================================================ */
  GAME.battle.modeOf = function (id) {
    var arr = (DATA.EXPEDITION && DATA.EXPEDITION.modes) || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return arr[arr.length - 1] || { id: 'occupy', name: '占领', stamina: 22, energy: 9, battle: true, occupy: true };
  };

  /* 野地守军 —— v55：**这里的旧实现已删**。
     它按 `20 × 2.4^lv × garrisonMul(0.55)` 公式生成，与真正在用的
     `GAME.wildDefenseAt`（读 `DATA.WILD_DEFENSE` 逐级表）是**同一件事的第二份实现**，
     而且系数还不一样（0.55 下调）。audit 没报出来是因为它只扫 `GAME.x =` 形态、
     不扫 `GAME.battle.x =`。留着就是"改一处忘一处"的种子，删掉。 */

  /* ============================================================
   * 军队资源价值（v55）：把一支部队折算成"资源量"——原版经验规则的计价口径。
   * 原版：**每消灭对方 1000 资源的军队得 1 经验**。
   * 口径 = 兵种建造价（粮+木+石+铁）之和 × 数量。**唯一出口**，
   * 经验换算、战报显示、以后可能的"战功"都读它，不各算一遍。
   * ============================================================ */
  GAME.battle.armyResourceValue = function (army) {
    var total = 0;
    for (var id in (army || {})) {
      var n = army[id];
      if (!n || n <= 0) continue;
      var t = DATA.TROOPS[id];
      if (!t || !t.cost) continue;
      var one = (t.cost.grain || 0) + (t.cost.wood || 0) + (t.cost.stone || 0) + (t.cost.iron || 0);
      total += one * n;
    }
    return Math.round(total);
  };

  /* 战斗经验（v55 · 原版规则；v56 老板拍板收口）——**唯一出口**，野地/攻城/守城都走这里。
     经验 = round(歼灭敌军的资源量 / perResource) × winMul(2)，再封顶到
     「当前升级所需经验 × capPct（80%）」。
     返回 { gain, raw, cap, capped }，capped=true 时战报要说明"已达单场上限"，
     否则玩家会以为哪里算错了。

     ⚠️ v56：**这里只算胜方经验**（原版有 `loseMul` 让败方拿一半）。
     老板拍板「胜方才有经验」，所以我把败方系数与 `won` 参数**一起删了** ——
     留一个恒为 0 的系数就是"假旋钮"（看着可调、实际乘 0），
     比没有更坏；调用方（败方分支）也一并不再调用本函数。 */
  /* v91.89：守军**战力**合计（与军师估算/来袭强度/家底同一把尺）。
     只用于经验结算（mode='power'），不改任何战斗数学。 */
  GAME.battle.armyPowerTotal = function (army) {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var n = 0;
    for (var id in (army || {})) {
      var c = army[id] || 0;
      if (!c) continue;
      n += (tp ? tp(id) : 1) * c;
    }
    return Math.round(n);
  };
  GAME.battle.battleExp = function (defLossBy, gen) {
    var R = DATA.EXP_RULE || { perResource: 1000, winMul: 2, capPct: 0.8 };
    if (!gen) return { gain: 0, raw: 0, cap: 0, capped: false };
    /* v91.89：双口径 —— mode='power' 按战力，其余按资源（旧口径保留，可一格切回） */
    var val = (R.mode === 'power')
      ? GAME.battle.armyPowerTotal(defLossBy)
      : GAME.battle.armyResourceValue(defLossBy);
    var per = (R.mode === 'power') ? (R.perPower || 180) : (R.perResource || 1000);
    var raw = Math.round(val / per) * R.winMul;
    var cap = Math.round(GAME.expNeedOf(gen) * R.capPct);
    var gain = Math.max(0, Math.min(raw, cap));
    return { gain: gain, raw: raw, cap: cap, capped: raw > cap, value: val, mode: (R.mode === 'power' ? 'power' : 'resource') };
  };

  /* ============================================================
   * v89.149（老板 1）：「战斗可获得声望，**根据军师估算的军力对比设定系数，
   *   根据消灭的军力为基础**，设定声望获得量，**不要太泛滥**」
   * ------------------------------------------------------------
   * **唯一出口**（表在 `DATA.REP_RULE`；出征与守城两条落账路径都走这里，
   * 别处不许直接写 `s.rep`）：
   *   · 基础 = **歼灭的军力**（敌军开局 − 残余），用 `story.troopPower` 折算
   *     —— 与「军师估算 / 来袭强度 / 家底」同一把尺，不另造第二把；
   *   · 系数 = 军力对比 `foeStart / myStart` 的**平方根**（夹 coefLo~coefHi）：
   *     以少打多系数高、以多打少系数低（平方根 = 不让"人多"把声望一次打到地板）；
   *   · **视角必须显式传**（v89.149 沿用 v89.116 的教训：`captiveGain` 靠 target 猜
   *     攻守视角，防御战里读错字段）。`battleRepView(result, mySide, win)` 一处转换：
   *       攻方视角 → 我 = atkStartBy / 敌 = defStartBy / 歼灭 = defLossBy；
   *       守方视角 → 我 = defStartBy / 敌 = atkStartBy / 歼灭 = atkLossBy。
   * ============================================================ */
  GAME.battle.repGainOf = function (view) {
    var R = DATA.REP_RULE || {};
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    function sum(m) {
      var t = 0;
      for (var k in (m || {})) t += (tp ? tp(k) : 1) * (m[k] || 0);
      return t;
    }
    var myStart = sum(view && view.mine);
    var foeStart = sum(view && view.foe);
    var lost = sum(view && view.foeLoss);          /* 歼灭的军力 */
    var ratio = myStart > 0 ? (foeStart / myStart) : 0;
    var lo = (R.coefLo == null) ? 0.4 : R.coefLo;
    var hi = (R.coefHi == null) ? 2 : R.coefHi;
    var coef = Math.max(lo, Math.min(hi, Math.sqrt(ratio || 0)));
    var mul = (view && view.win) ? (R.winMul == null ? 1 : R.winMul)
      : (R.loseMul == null ? 0.35 : R.loseMul);
    var raw = lost / (R.perPower || 30000) * coef * mul;
    var cap = R.cap || 0;
    var gain = Math.max(0, Math.round(raw));
    var capped = cap > 0 && gain > cap;
    if (capped) gain = cap;
    return { gain: gain, raw: Math.round(raw * 100) / 100, cap: cap, capped: capped,
      lost: Math.round(lost), mine: Math.round(myStart), foe: Math.round(foeStart),
      ratio: Math.round(ratio * 100) / 100, coef: Math.round(coef * 100) / 100,
      win: !!(view && view.win) };
  };
  /* 视角转换（唯一一处把 result 的四个逐兵种表映射成"我/敌/歼灭"） */
  GAME.battle.battleRepView = function (result, mySide, win) {
    var meDef = (mySide === 'def');
    return {
      win: !!win,
      mine: meDef ? (result && result.defStartBy) : (result && result.atkStartBy),
      foe: meDef ? (result && result.atkStartBy) : (result && result.defStartBy),
      foeLoss: meDef ? (result && result.atkLossBy) : (result && result.defLossBy),
    };
  };
  /* 记一笔战功声望：写账 + 日志 + 挂到 `result.repGain`（战报 / 结算界面读同一份） */
  GAME.battle.grantBattleRep = function (result, mySide, win, why) {
    var g = GAME.battle.repGainOf(GAME.battle.battleRepView(result, mySide, win));
    if (result) result.repGain = g;
    if (!g || g.gain <= 0) return g;
    GAME.state.rep = (GAME.state.rep || 0) + g.gain;
    GAME.log.war('🏅 ' + ((why ? why + ' ' : '')) + '战功：歼灭军力 ' + U.fmt(g.lost)
      + '（兵比 ' + g.ratio.toFixed(2) + ' ×' + g.coef.toFixed(2) + '）→ 声望 +' + g.gain
      + (g.capped ? '（单场封顶）' : ''));
    return g;
  };

  /* v83（老板）：「形成经验惩罚机制」——
     掠夺 / 占领**野地**时，按「每 12 级一个台阶」给经验打折（唯一出口）。
     · expTierOf：英雄等级 → 该吃满的野地等级（1~10；>120 封顶在 10 级野地）
     · expPenaltyOf：野地等级 ≥ 台阶 → 1（吃满）；每差一档 ×decay，地板 minMul
     野地 0 级按 1 级对待（尚未长成的野地不比 1 级更差）。 */
  GAME.battle.expTierOf = function (genLevel) {
    var P = DATA.EXP_PENALTY || { tier: 12, maxLv: 15 };
    return Math.min(P.maxLv, Math.max(1, Math.ceil((genLevel || 1) / P.tier)));
  };
  GAME.battle.expPenaltyOf = function (genLevel, wildLevel) {
    var P = DATA.EXP_PENALTY || { tier: 12, maxLv: 10, decay: 0.65, minMul: 0.03 };
    var need = GAME.battle.expTierOf(genLevel);
    var wl = Math.max(1, Math.round(wildLevel || 1));
    if (wl >= need) return { mul: 1, need: need, wl: wl, gap: 0 };
    var gap = need - wl;
    return { mul: Math.max(P.minMul, Math.pow(P.decay, gap)), need: need, wl: wl, gap: gap };
  };

  /* 目标解析：野地 / 城市 / 野外城市（球系：按格索引 ci） */
  GAME.battle.resolveTarget = function (target) {
    var s = GAME.state;
    if (!target) return { ok: false, msg: '未指定目标' };
    if (target.kind === 'wild') {
      var _wpid = (target.pid != null) ? target.pid : GAME.curPid();
      var _wSP = GAME.sphereOf(_wpid);
      var tcell = (_wSP && _wSP.cells) ? _wSP.cells[target.ci] : null;
      if (!tcell) return { ok: false, msg: '目标格越界' };
      if (tcell.type === 'city') return { ok: false, msg: '该处为城市，请点击城市出征' };
      /* v90.69：野地**地形口径 = 球面**（所见即所得）——优先用点选带入的 terrain；无则读球面地块。 */
      var _wildTerr = target.terrain || tcell.type;
      var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(target.ci) : GAME.map.wildLevel(target.ci);
      /* v27（需求 3）：守军由 wildDefenseAt 按 (格, 现实日) 确定性生成 —— 侦查所见即战斗所遇。 */
      var wd = GAME.wildDefenseAt(target.ci, lv);
      /* v92.16（B1）：**势力核心不是普通野地** —— 守军按该家半径算（越大越难打），
         打下来它的领地腰斩。核心格原来只是一块"等级碰巧很低"的野地，
         玩家打过去毫无意义；现在它是一处真正的目标。 */
      var _fid = (GAME.faction && GAME.faction.coreAt) ? GAME.faction.coreAt(target.ci) : null;
      var _fcore = _fid ? GAME.faction.coreGarrisonOf(_fid) : null;
      if (_fcore) wd = { army: _fcore.army, gen: _fcore.gen, day: wd.day };
      return { ok: true, kind: 'wild', pid: _wpid, ci: target.ci, x: tcell.x, y: tcell.y, lon: tcell.lon, lat: tcell.lat, lv: lv,
        faction: _fid,
        name: _fid
          ? (((GAME.faction.defOf(_fid) || {}).name || _fid) + ' 核心')
          : ((DATA.TERRAIN[_wildTerr] ? DATA.TERRAIN[_wildTerr].name : '野地') + ' Lv' + lv),
        terrain: _wildTerr, garrison: scaleGarrison(wd.army, _wpid), guard: wd.gen, def: 0, defDay: wd.day, env: (GAME.planetEnvOf ? GAME.planetEnvOf(_wpid) : null) };
    }
    if (target.kind === 'fort' && GAME.map.fortAt) {
      var _fpid2 = (target.pid != null) ? target.pid : GAME.curPid();
      /* v91.74：老调用点只给 (x,y)（据点面板/自动出征）—— 先按该星球球面换成 ci。 */
      if (target.ci == null && target.x != null) {
        var _fsp = GAME.sphereOf(_fpid2);
        target.ci = (_fsp && _fsp.ciOfXY) ? _fsp.ciOfXY(target.x, target.y) : -1;
      }
      var f = GAME.map.fortAt(target.ci, GAME.map._pctx(_fpid2, true));
      if (!f) return { ok: false, msg: '此处并无野外城市' };
      var fg = GAME.map.fortGarrison(f.level);
      /* v61：野地城市建筑全满；布局 GAME.fortPlanOf · 城防 GAME.fortDefOf · 守将 GAME.fortGuardOf。 */
      return { ok: true, kind: 'fort', pid: _fpid2, ci: f.ci, x: f.x, y: f.y, lon: f.lon, lat: f.lat, lv: f.level, name: f.name + '（野外城市 Lv' + f.level + '）',
        fort: f, garrison: scaleGarrison(fg, _fpid2), def: GAME.fortDefOf(f), plan: GAME.fortPlanOf(f),
        guard: GAME.fortGuardOf(f),
        cityType: 'fort', dropType: 'fort' };
    }
    /* v91.31（老板）：**奇观探索目标** —— 「派军搜查/深潜攻坚」走出征界面（选将/选兵）。
       结算走 GAME.wonderExplore（非战斗）；resolveTarget 只做面板解析。 */
    if (target.kind === 'wonder') {
      var wpid = (target.pid != null) ? target.pid : ((s.activePlanet) || 1);
      var wd = GAME.wonderOf ? GAME.wonderOf(wpid) : null;
      if (!wd) return { ok: false, msg: '该星球无奇观' };
      return { ok: true, kind: 'wonder', pid: wpid, mode: target.mode || 'search',
        name: wd.icon + ' ' + wd.name, garrison: {}, guard: null, def: 0 };
    }
    /* v91.52（老板）：奇观**层级挑战**目标 —— 攻击第 N 层守军（走战斗引擎）。 */
    if (target.kind === 'wonderFight') {
      var fpid = (target.pid != null) ? target.pid : ((s.activePlanet) || 1);
      var fwd = GAME.wonderOf ? GAME.wonderOf(fpid) : null;
      if (!fwd) return { ok: false, msg: '该星球无奇观' };
      var fdef = GAME.wonderLayerDefOf(target.lv);
      return { ok: true, kind: 'wonderFight', pid: fpid, lv: target.lv,
        name: fwd.name + ' · 第 ' + target.lv + ' 层守卫',
        garrison: fdef.army, guard: fdef.gen, def: 0 };
    }
    /* v89.87（老板需求 2）：调兵目标 —— 本境自家城市（走行军通道） */
    if (target.kind === 'owncity') {
      var oc = GAME.cityById(target.id);
      if (!oc) return { ok: false, msg: '目标城市不存在' };
      return { ok: true, kind: 'owncity', id: oc.id, ci: oc.ci, x: oc.x, y: oc.y, lon: oc.lon, lat: oc.lat, name: oc.name, city: oc };
    }
    if (target.kind === 'city') {
      var npc = target.npc || null;   // 允许直接传入城市对象（测试/临时目标）
      /* v91.74：世界数据全局一份 —— 先按"该星球的名城派生表"找，再回落当前地图的派生表。 */
      if (!npc) {
        var _cpid = (target.pid != null) ? target.pid : GAME.curPid();
        try {
          var _ps = GAME._planetById(_cpid);
          var _npcList = GAME.buildNpcCities(_ps ? _ps.seed : (s.map && s.map.seed), GAME.sphereOf(_cpid));
          _npcList.forEach(function (c) { if (!npc && c.id === target.id) npc = c; });
        } catch (e) {}
        if (!npc) (s.map.cities || []).forEach(function (c) { if (!npc && c.id === target.id) npc = c; });
      }
      if (!npc) return { ok: false, msg: '目标城市不存在（可能已被攻占）' };
      var ng = GAME.npcCityGuard(npc);
      return { ok: true, kind: 'city', id: npc.id, lv: GAME.cityLvOf(npc), name: npc.name,
        x: npc.x, y: npc.y, ci: npc.ci, lon: npc.lon, lat: npc.lat,
        npc: npc, garrison: scaleGarrison(npc.garrison, (target.pid != null ? target.pid : GAME.curPid())), def: npc.def, guard: ng,
        cityType: npc.type, dropType: GAME.battle.dropTierOf(npc) };
    }
    return { ok: false, msg: '未知目标类型' };
  };

  /* 掉落档位：野外城市 / 系统城市（聚落、重镇）/ 名城（首府、旧都） */
  GAME.battle.dropTierOf = function (npc) {
    if (!npc) return 'county';
    if (npc.type === 'capital' || npc.type === 'zhou') return npc.type;
    if (npc.type === 'fort') return 'fort';
    return npc.type;
  };

  /* ------------------------------------------------------------
   * 侦查情报分层（v65 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「不同侦察技巧等级应该可以侦察出**不同类型**的信息，比如，
   *   资源数量，兵种数量，英雄名称属性，建筑等级和数量，可获得的宝物/特产等」
   *
   * 分层表在 `DATA.SCOUT_INTEL`（数据驱动，改表就是改分层，不碰这里）。
   * 唯一出口 `intelTiersOf()`：战斗侧与界面都读它 ——
   *   「哪几层已解锁 / 下一层还差几级」只在一个地方算，别处不要再各判一遍。
   * 大雾天：情报**整体降级**（既有设定保留），已解锁的也看不准。
   * ⚠️ 顺手拾获（材料/宝物）**不受分层影响** —— 那是"顺手拿到的"，不是"看出来的"。
   * ------------------------------------------------------------ */
  GAME.battle.intelTiersOf = function () {
    var lv = (GAME.systems && GAME.systems.techLevel) ? GAME.systems.techLevel('zhencha') : 0;
    var list = (DATA.SCOUT_INTEL || []).map(function (t) {
      return { id: t.id, name: t.name, unlock: t.unlock, hint: t.hint, unlocked: lv >= t.unlock };
    });
    var got = {}, next = null;
    list.forEach(function (t) {
      got[t.id] = t.unlocked;
      if (!next && !t.unlocked) next = t;
    });
    return { lv: lv, list: list, got: got, next: next };
  };

  /* 目标城的**资源数量**情报（层 ②）。
     城市（未占据名城）报它的库藏；据点没有库藏（掠夺所得是"打下来才有"的），
     所以报**掠夺可得**的量 —— 两者都回答"这里有多少东西"。 */
  GAME.battle.resReportOf = function (t) {
    if (!t) return null;
    if (t.kind === 'city' && t.npc && GAME.npcCityRes) {
      var R = GAME.npcCityRes(t.npc), rows = [];
      /* v89.76 修 bug：`DATA.RESOURCES` **本身就含 `pop`**，这里原先又补推一行「幸存者」，
         于是侦查公文里「幸存者」印了两遍（老板截图：`幸存者 24.9万　幸存者 24.9万`）。
         删掉补推那一行 —— 顺序由 `DATA.RESOURCES` 独家决定。 */
      (DATA.RESOURCES || []).forEach(function (m) {
        if (R[m.key] == null) return;
        rows.push({ name: m.name, v: Math.round(R[m.key]) });
      });
      return { kind: 'store', title: '城内库藏（占领后尽归我有）', rows: rows };
    }
    if (t.kind === 'fort' && GAME.battle.genLoot) {
      /* v89.88：口径对齐**实际结算** —— 据点掠夺在 `expedition` 里走
         `cityResMul.raid`（0.5），原先这里读 `wildResMul.raid`（1.2），
         "侦查看到的掠夺可得"比打完拿到的虚报 **2.4 倍**
         （侦查的数 ≠ 打完的数，正是本项目最忌讳的一类不一致）。
         ⚠️ 战时的废墟搜刮 / 计略加成因人而异，这里给的是**基准量**。 */
      var mul = (DATA.EXPEDITION && DATA.EXPEDITION.cityResMul && DATA.EXPEDITION.cityResMul.raid) || 0.5;
      var loot = GAME.battle.genLoot(t, mul), rows2 = [];
      (DATA.RESOURCES || []).forEach(function (m) {
        if (loot[m.key] == null) return;
        rows2.push({ name: m.name, v: Math.round(loot[m.key]) });
      });
      return { kind: 'loot', title: '掠夺可得（一支部队一次的量）', rows: rows2 };
    }
    return null;
  };

  /* 目标城的**建筑与工事**情报（层 ⑤）。
     数据源与"满配布局"同一套（`GAME.planSummaryOf` / `GAME.fortPlanOf`），
     所以面板里报的建筑清单 = 打下来真正拿到的那一套 —— 不会两处对不上。 */
  GAME.battle.buildReportOf = function (t) {
    if (!t) return null;
    var summary = null, buildLv = 1, wallLv = 0, def = t.def || 0, towers = 0;
    /* v89.77：**城外**建筑也要报出来 —— 老板要的是"城**内外**建筑全是 12/16"，
       原先只报城内，他看不到城外那部分，没法确认。 */
    var extN = 0, extLv = 0;
    if (t.kind === 'city' && t.npc) {
      buildLv = GAME.npcBuildLvOf(t.npc);
      summary = GAME.planSummaryOf(GAME.cityLvOf(t.npc), buildLv);
      var sh = GAME.npcCityShadow(t.npc);
      wallLv = GAME.buildingLevel(sh, 'chengqiang') || buildLv;
      def = GAME.cityDefense(sh);
      towers = GAME.towersFromDef ? GAME.towersFromDef(def) : 0;
      extN = (sh.extGrid || []).length;
      extLv = extN ? (sh.extGrid[0].lv || buildLv) : buildLv;
    } else if (t.kind === 'fort' && t.fort && GAME.fortPlanOf) {
      var fp = GAME.fortPlanOf(t.fort);
      summary = { plan: fp, items: fp.items, total: fp.total, minfang: fp.minfang };
      buildLv = fp.buildLv; wallLv = fp.wallLv; def = fp.def;
      towers = GAME.towersFromDef ? GAME.towersFromDef(def) : 0;
      extN = GAME.extPlanOf ? GAME.extPlanOf(fp.level).length : 0;
      extLv = fp.buildLv;
    } else {
      return null;         // 野地没有建筑
    }
    return {
      col: summary.plan.col, row: summary.plan.row, total: summary.total,
      buildLv: buildLv, wallLv: wallLv, def: def, towers: towers,
      items: summary.items || [], minfang: summary.minfang || 0,
      extN: extN, extLv: extLv,
    };
  };

  /* ------------------------------------------------------------
   * 侦查（v27 · 需求 3 → v65 分层）
   * ------------------------------------------------------------
   * v27 改前：守军数字只能"约 N 名"，兵种要侦察网络 ≥3 才看得见，
   *   宝物与产地完全看不到 —— 玩家只能靠试。
   * v27 改后：一次侦查给全六项（总数/兵种/守将/宝物/可采/类型）。
   * v65（老板）：**改回按等级分层解锁** —— 全给等于这条科技没有成长感。
   *   已解锁的层给**准确值**（同日同地多次侦查结果一致）；
   *   未解锁的层给 `null`，界面显示"侦察网络 Lv N 可查"。
   * 侦察网络的另一半作用（顺手所得的数量与品质）始终生效，不受分层影响。
   * ------------------------------------------------------------ */
  /* ============================================================
   * v89.156（老板 4）：「侦察可能失败，视双方英雄资质和等级差设计」
   * ------------------------------------------------------------
   * **侦察成功率的唯一出口**（结算 / 公文 / 探针 / 断言都读它）：
   *   P = base + perLv×(我方等级 − 守将等级) + perStar×(我方资质星 − 守将资质星)，
   *   clamp 到 [lo, hi]；**目标无守将 → p=1（必成，不掷骰）**。
   * 参数在 DATA.SCOUT_RULE（标定见 data.js 注释）。
   * ============================================================ */
  GAME.battle.scoutChanceOf = function (gen, t) {
    var R = DATA.SCOUT_RULE || { base: 0.85, perLv: 0.015, perStar: 0.05, lo: 0.40, hi: 0.97 };
    var foe = (t && t.guard) || null;
    var myLv = (gen && gen.level) || 1;
    var myStar = ((gen && GAME.rankOf) ? (GAME.rankOf(gen).star || 1) : 1);
    if (!foe) return { p: 1, foe: null, myLv: myLv, foeLv: 0, myStar: myStar, foeStar: 0 };
    var foeLv = foe.level || 1;
    var foeStar = ((GAME.rankOf ? GAME.rankOf(foe).star : 1) || 1);
    var p = R.base + R.perLv * (myLv - foeLv) + R.perStar * (myStar - foeStar);
    p = Math.max(R.lo, Math.min(R.hi, p));
    return { p: p, foe: foe, myLv: myLv, foeLv: foeLv, myStar: myStar, foeStar: foeStar };
  };

  GAME.battle.scoutTarget = function (t, gen) {
    var s = GAME.state, out = { gNum: 0, kinds: [], loot: [], detail: {} };
    var tiers = GAME.battle.intelTiersOf();
    var got = tiers.got;
    out.intel = tiers;
    /* v89.156（老板 4）：侦察可能失败 —— 视双方英雄资质与等级差（唯一出口 scoutChanceOf）。
       失败 = 一无所获：无情报（连"约略"也不给）、无顺手所得、无宝物线索；
       成功后的分层/大雾逻辑不变（大雾是"降级"，失败是"没成"，两回事）。 */
    var _ch156 = GAME.battle.scoutChanceOf(gen, t);
    out.chance = _ch156;
    if (_ch156.foe && Math.random() >= _ch156.p) {
      out.fail = true;
      out.detail.fail = true;
      return out;
    }
    /* 天气：大雾侦察单元难察 —— 情报整体降级（已解锁的也看不准），且不拾获 */
    var cmW = null;
    if (GAME.story && GAME.story.combatMod) cmW = GAME.story.combatMod();
    var blinded = !!(cmW && cmW.scout === false);
    out.detail.blinded = blinded;
    var g = t.garrison || {};
    var gAll = 0;
    for (var k in g) gAll += g[k] || 0;
    var techLv = tiers.lv;
    out.detail.techLv = techLv;
    /* 层 ① 守军总数：解锁后是准确数；未解锁只报"约"（仍给个数，不至于两眼一抹黑） */
    var exactTotal = !!got.total && !blinded;
    out.totalExact = exactTotal;
    out.gNum = exactTotal ? gAll : Math.round(gAll * 0.8);
    /* 层 ③ 兵种编制 */
    var roster = [];
    Object.keys(g).forEach(function (id) {
      if ((g[id] || 0) <= 0) return;
      var tt = DATA.TROOPS[id];
      roster.push({ id: id, name: tt ? tt.name : id, n: g[id] });
    });
    roster.sort(function (a2, b2) { return b2.n - a2.n; });
    var showRoster = !!got.troops && !blinded;
    out.roster = showRoster ? roster : [];
    /* 层 ④ 守将名册 */
    out.guard = (got.guard && !blinded) ? (t.guard || null) : null;
    /* 层 ② 资源数量 / 层 ⑤ 建筑工事 */
    out.res = (got.res && !blinded) ? GAME.battle.resReportOf(t) : null;
    out.build = (got.build && !blinded) ? GAME.battle.buildReportOf(t) : null;
    out.detail.kinds = !!got.troops && !blinded;
    out.detail.wall = (t.kind === 'city' || t.kind === 'fort');
    out.detail.gen = !!got.guard && !blinded;
    out.detail.roster = showRoster;
    out.detail.lv = techLv;
    /* 顺手采集：按目标类型给少量材料（侦察网络提升拾获率与数量；大雾则一无所获）
       ⚠️ 这一段**不看分层** —— 拾获是"顺手拿到的"，谁都能顺手，只是看得多的人才看得细。 */
    var tbl = blinded ? null : (t.kind === 'wild' ? DATA.WILD_MATERIAL[t.terrain] : DATA.CITY_MATERIAL[t.dropType || 'county']);
    if (tbl) {
      var ids = Object.keys(tbl);
      var scBonus = 1 + TB('scout');
      var take = 1 + Math.floor(Math.random() * 2 * scBonus);
      for (var i = 0; i < Math.min(take, ids.length); i++) {
        var mid = ids[Math.floor(Math.random() * ids.length)];
        var cnt = Math.max(1, Math.round((tbl[mid][0] + Math.random() * 2) * (DATA.EXPEDITION.wildMatMul.scout || 0.35) * scBonus));
        GAME.items.add(mid, cnt);
        out.loot.push((DATA.MATERIAL_BY_ID[mid] ? DATA.MATERIAL_BY_ID[mid].name : mid) + '×' + cnt);
      }
    }
    /* 宝物线索：低概率直接获得一件小宝物（侦察网络提升概率） */
    if (Math.random() < 0.18 * (1 + TB('scout'))) {
      var pool = (DATA.ITEMS || []).filter(function (it) {
        return it.price > 0 && it.type !== 'material' && it.type !== 'blueprint' && it.price <= 40;
      });
      if (pool.length) {
        var got2 = pool[Math.floor(Math.random() * pool.length)];
        GAME.items.add(got2.id, 1);
        out.treasure = got2.name;
      }
    }
    /* 层 ⑥ 可图之利（珠宝/材料/军械/可采资源/产量加成） */
    var ter = t.terrain || null;
    var matTbl = (t.kind === 'wild')
      ? (DATA.WILD_MATERIAL[ter] || {})
      : (DATA.CITY_MATERIAL[t.dropType || 'county'] || {});
    var matNames = Object.keys(matTbl).map(function (mid) {
      return DATA.MATERIAL_BY_ID[mid] ? DATA.MATERIAL_BY_ID[mid].name : mid;
    });
    var jewels = (DATA.ITEMS || []).filter(function (it) { return it.type === 'jewel'; });
    var jewTop = Math.min(jewels.length, t.kind === 'wild' ? 4 : Math.max(1, t.lv || 1));
    var showSpoils = !!got.spoils && !blinded;
    out.spoils = showSpoils ? {
      /* ④ 掠夺可得宝物 */
      jewels: jewels.slice(0, jewTop).map(function (j) { return j.name; }),
      /* ⑤ 占领后可采资源（地形决定；平地无可采之物） */
      gather: t.kind === 'wild' ? (GAME.gatherResOf(ter) || null) : null,
      gatherName: (t.kind === 'wild' && GAME.gatherResOf(ter))
        ? ((function () {
            var k = GAME.gatherResOf(ter), nm = k;
            DATA.RESOURCES.forEach(function (r) { if (r.key === k) nm = r.name; });
            return nm;
          })()) : null,
      /* 可采资源之外的持续收益：占地的产量加成 */
      terrainBonus: t.kind === 'wild' ? (GAME.wildAddOf(ter, t.lv || 0) || {}) : null,
      /* ⑥ 可获宝物的类型 */
      types: ['珠宝（赏赐英雄、提升忠诚）', '材料（打造高阶装备的主料）',
        '军械图纸（打造套装件的必需物）', '成品装备（直接佩戴）'],
      materials: matNames,
      equip: (t.kind === 'fort' || t.kind === 'city') ? '按城市档次掉落图纸与成品装备' : '野地不掉军械',
    } : null;
    return out;
  };

  /* ============================================================
   * v89.102（老板）：「练兵场出征应限制总兵力数而不是幸存者」
   * ------------------------------------------------------------
   * 老板原话：「谁家练兵场按幸存者，不是按人数」。
   * 改前口径 = Σ(兵种.pop × 数量)（幸存者当量）—— 于是同样"一万人马"，
   * 带伏击车（pop 2）比带步行机（pop 1）少吃一半容量，与"练兵场点兵"的
   * 直觉完全相反（练兵场点的是**人头**）。
   * 现在：容量 = 练兵场等级 × 10000（**人马**），再乘三条加成链
   * （建筑专精 / 军事增益）。
   * ⚠️ 幸存者仍是**募兵**时的消耗（GAME.train / trainLimitOf 一字不动）——
   *    改的只是"出征这道门"的量纲。
   * 唯一出口：出征校验 / 调兵校验 / 抵达复验 / 界面提示 / 测试全读这里，
   * 不许任何一处再各算一遍（否则又会出现"面板说能出兵、一发兵被拦"）。
   * ============================================================ */
  GAME.battle.MARCH_MEN_PER_LV = 10000;
  /* 总兵力数（人头）—— 出征容量的计量单位 */
  GAME.battle.marchMenOf = function (army) {
    var n = 0;
    for (var id in (army || {})) n += Math.floor(army[id] || 0);
    return n;
  };
  /* 城市的出征容量（人马）。无练兵场 → 0（= 不设限，见调用处的 `cap > 0` 判据） */
  GAME.battle.marchCapOf = function (city) {
    if (!city) return 0;
    var xc = GAME.buildingLevel(city, 'xiaochang') || 0;
    /* v89.132（老板「节钺设计再开拓一下」）：节钺 · 练兵场扩编 —— 每城 +1 万人马
       （等效练兵场 +1 级）。**只加出征容量这一项**：募兵名额 / 练兵收益等仍由
       建筑等级决定，不随之膨胀；无练兵场 → 仍为 0（不设限），不凭空开闸。 */
    var _jx = Math.min(city.jieyueXc || 0, (DATA.JIEYUE || {}).xcMax || 2);
    if (xc > 0) xc += _jx;
    var cap = xc * GAME.battle.MARCH_MEN_PER_LV * (1 + GAME.mastery('marchCapPct', city));
    if (GAME.story) cap = Math.round(cap * GAME.story.leadMult());
    var s = GAME.state;
    if (GAME.systems.buffActive('military') && s && s.buffs && s.buffs.military.cap) {
      cap = Math.round(cap * (1 + s.buffs.military.cap));
    }
    return cap;
  };
  /* 报错文案用：装得下 `men` 人所需的练兵场等级（与容量口径同源，不另算） */
  GAME.battle.marchCapLvFor = function (men) {
    return Math.max(1, Math.ceil((men || 0) / GAME.battle.MARCH_MEN_PER_LV));
  };

  GAME.battle.prepare = function (target, modeId, atkArmy, genId, opts) {
    opts = opts || {};
    var s = GAME.state;
    var mode = GAME.battle.modeOf(modeId);
    var city = (opts.cityId && GAME.cityById(opts.cityId)) || GAME.currentCity();
    if (!city) return { ok: false, msg: '无城市可出兵' };
    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === genId) gen = s.generals[i];
    /* v89.137（老板 7）：**station 增援允许不带将** ——
       野地已有英雄驻守时，增援只并兵不换将（与 doWildGarrison 的"已有将→不带将"同规），
       而入口统一到出征界面后，"不带将"是界面上的正常形态（不是老档残迹）。
       判据挂在**目标野地的现役驻将**上（不是"玩家有没有选将"）—— else 分支保持原拦截。 */
    var _stNoGen137 = false;
    if (!gen && modeId === 'station' && GAME.map && GAME.map.wildAt) {
      var _tpre137 = GAME.battle.resolveTarget(target);
      if (_tpre137.ok && _tpre137.kind === 'wild') {
        var _wpre137 = GAME.map.wildAt(_tpre137.ci);
        _stNoGen137 = !!(_wpre137 && _wpre137.garrison && _wpre137.garrison.genId);
      }
    }
    /* v91.76（老板）：派遣/运输**可无英雄**（城市归属不变，只搬兵/货）——
       其余方式仍须带队。 */
    if (!gen && !_stNoGen137 && modeId !== 'dispatch' && modeId !== 'transport' && modeId !== 'transfer') {
      return { ok: false, msg: '请选择出征英雄' };
    }
    /* v89.117（老板「城主和守将不能执行出征动作」）：与界面**同一判据**（唯一出口
       GAME.marchBlockOf）—— 界面置灰只是提示，这里才是拦得住的那道闸
       （自动出征 / 脚本 / 老档里的旧配置都会经过 prepare）。 */
    if (gen) {
      var _mb = GAME.marchBlockOf(gen);
      if (_mb) return { ok: false, msg: gen.name + ' 不可出征：' + _mb };
    }

    /* v89.36（老板「维持军队无需耗净水」）：断粮门槛随军粮维持一并退役 ——
       军队不再吃粮，出征不再有"粮尽"拦截（缺粮哗变系统同时移出）。 */

    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) return { ok: false, msg: t.msg || '目标无效' };

    /* v89.87（老板需求 2）：调兵 / 驻守 / 采集的前置校验（统一出口的口子）
       v91.76：派遣 / 运输同属"己方城市间"通道。 */
    var _ownMoveMode = (mode.id === 'transfer' || mode.id === 'dispatch' || mode.id === 'transport');
    if (_ownMoveMode && t.kind !== 'owncity') return { ok: false, msg: '「' + mode.name + '」目标须为本境城市' };
    if (mode.id === 'transport') {
      var _ct76 = 0; for (var _ck76 in (atkArmy || {})) _ct76 += Math.max(0, Math.floor(atkArmy[_ck76] || 0));
      if (opts.cargo && _ct76 <= 0) return { ok: false, msg: '运输须带兵押运（运力来自兵种负重）' };
    }
    /* ============================================================
     * v89.138（老板 2）：「英雄派遣」并进出征界面后，原 `GAME.doDispatch` 的
     * **目标城席位预检**迁移到这道唯一闸口（入场即拦，比"到了再发现住不下"好）——
     * 英雄是**归属城市**的，席位 = 该城英雄枢纽房间数；不拦的话目标城名册会静默超编。
     * （「守将/城主不可出征」由下方 `GAME.marchBlockOf` 同一出口负责。）
     * ============================================================ */
    if (_ownMoveMode && t.kind === 'owncity' && gen) {
      var _to138 = t.city;
      if (_to138 && gen.cityId !== _to138.id) {
        var _slots138 = GAME.genSlotsOf(_to138), _used138 = GAME.generalsIn(_to138).length;
        if (_used138 >= _slots138) {
          return { ok: false, msg: _slots138 <= 0
            ? (_to138.name + ' 尚无英雄枢纽（0 席）—— 先在该城建造英雄枢纽才能安置英雄')
            : (_to138.name + ' 英雄枢纽无空位（' + _used138 + '/' + _slots138 + '），请先升级该城英雄枢纽') };
        }
      }
    }
    if (mode.id === 'station') {
      if (!(t.kind === 'wild' && GAME.map.wildAt(t.ci))) {
        return { ok: false, msg: '驻守目标须是已属我方的野地' };
      }
      /* ============================================================
       * v89.137（老板 7）：驻守（增援）的三道出发前判据 —— 入口统一到出征界面后的补全。
       * ① 驻军上限预检：超限**不发兵**（比"到了再折返"少一趟白跑）。
       *    真正的硬判仍在 `GAME.wildGarrisonAdd` 的 overflow（抵达时兜底，兵不丢）；
       *    上限口径与 ui / domain 同一把尺（GAME.wildGarrisonCap）。
       * ② **无将硬闸**：野地已有驻将 → 增援一律不带将（界面传什么都不会把将带走、
       *    也不会白扣体力）—— 与 `wildGarrisonAdd` 的"genId 只在空位写入"同规。
       * ③ 计谋护栏：不带将不能施计（schemePrepare 会报"需要主将施计"，
       *    这里提前给更清楚的文案；界面在"已有驻将"时也不会带计谋提交）。
       * ============================================================ */
      var _w137b = GAME.map.wildAt(t.ci);
      var _cap137b = GAME.wildGarrisonCap(_w137b.level, _w137b.x, _w137b.y);   /* v89.186：#3 兵站加成读坐标 */
      var _have137b = GAME.wildGarrisonTotal(_w137b.garrison);
      var _men137b = 0;
      for (var _k137b in (atkArmy || {})) _men137b += Math.floor(atkArmy[_k137b] || 0);
      if (_cap137b > 0 && _have137b + _men137b > _cap137b) {
        return { ok: false, msg: '驻军上限 ' + U.numText(_cap137b, 0) + '（' + _w137b.level + ' 级野地 ×'
          + U.numText(DATA.WILD_GARRISON.perLevel, 0) + '）：现有 ' + U.numText(_have137b, 0)
          + '，本次 ' + U.numText(_men137b, 0) + ' 将超出' };
      }
      if (_w137b.garrison && _w137b.garrison.genId) {
        if (gen) gen = null;                       /* ② 无将硬闸（已有驻将） */
        else if (opts && opts.scheme) {
          return { ok: false, msg: '不带将的增援不能施计（计谋须主将施展）' };
        }
      }
    }
    if (mode.id === 'gather' && !(t.kind === 'wild' && GAME.map.wildAt(t.ci))) {
      return { ok: false, msg: '采集目标须是已属我方的野地' };
    }

    /* ⛔ v89.198（老板「清除战法这个玩法」）：战法出行校验随玩法全撤退役。 */

    /* v89.108（老板）：**领地上限** —— 占领城市 / 拔除据点都会产出一座新城，先过这道闸。
       拦在 `prepare` = 出征两条路（即时结算 / 行军队列）都拦得住；
       **抵达时（opts.arrived）同样拦**：出发后若别处先占了城，兵原路折返（军账守恒护栏
       在 march.arrive / _settleBattle 里），不会"白占一座超编城"。 */
    if (mode.occupy && (t.kind === 'city' || t.kind === 'fort')) {
      var _cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
      if (!_cc108.ok) return { ok: false, msg: _cc108.msg };
    }

    /* v63（老板）：「野外城每天只能被掠夺一次」。
       拦在 `prepare` 里 —— 出征的两条路（即时结算 / 行军队列 `march.dispatch`）
       都先过这里，所以才拦得住；写在界面里只是提示，绕过界面就失效。
       ⚠️ 只拦「掠夺」：占领（会把据点打掉、当日不再出现）与侦查不受影响。 */
    if (!opts.arrived && mode.id === 'raid' && t.kind === 'fort'
        && GAME.map.fortRaidedToday && GAME.map.fortRaidedToday(t.ci)) {
      return { ok: false, msg: '此据点今日已被掠夺（每日每处限一次），明日再来' };
    }

    if (!opts.arrived) {
      /* v66：门槛与消耗一律走**池子口径**（GAME.staNow）——
         装备体力进上限后，`gen.stamina` 只是"等级那一份的余量"，
         再拿它比门槛会出现"面板显示体力满、却说过不了门槛"的矛盾。 */
      /* v89.137：无将增援（station）不校验体力/精力（军队全体行动，没有带队人可扣） */
      if (gen && GAME.staNow(gen) < GAME.staCostOf(mode, opts && opts.scheme)) {
        return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/'
          + GAME.staCostOf(mode, opts && opts.scheme) + '），休整或服止血粉' };
      }
      if (gen && (gen.energy || 0) < mode.energy) {
        return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + mode.energy + '），可服提神剂' };
      }
      if (mode.battle) {
        /* v89.102（老板）：练兵场容量按**总兵力数（人头）**计 —— 见 marchCapOf 段注释 */
        var needMen = GAME.battle.marchMenOf(atkArmy);
        if (!needMen) return { ok: false, msg: '请先派遣兵力' };
        var cap = GAME.battle.marchCapOf(city);
        if (cap > 0 && needMen > cap) {
          return { ok: false, msg: '练兵场容量不足（需 Lv' + GAME.battle.marchCapLvFor(needMen) + ' 练兵场）' };
        }
        for (var a2 in atkArmy) {
          if ((city.army[a2] || 0) < atkArmy[a2]) {
            return { ok: false, msg: '兵力不足（' + (DATA.TROOPS[a2] ? DATA.TROOPS[a2].name : a2) + '）' };
          }
        }
      }
    }
    return { ok: true, gen: gen, mode: mode, t: t, city: city };
  };

  /* 出征主入口
   * opts.arrived = true 表示这是「行军队列抵达后」的结算：
   *   体力/精力/断粮/兵力校验与扣除都已在出发时完成，此处只负责打与归还。
   * opts.cityId 指定出发城市（行军结算时城市可能已不是当前视图那座）。 */
  GAME.battle.expedition = function (target, modeId, atkArmy, genId, opts) {
    opts = opts || {};
    var p = GAME.battle.prepare(target, modeId, atkArmy, genId, opts);
    if (!p.ok) return p;
    /* ============================================================
     * v89.191（老板 3-④）：出征全程把科技读点钉在**出发城** ——
     *   · set-if-unset：重放 / 沙盘已有更权威的快照上下文时不覆盖；
     *   · try/finally 还原（抛错也不漏）。
     * 覆盖范围 = 整段结算（战斗模拟走 withBoost 的快照，采集负重 / 掠夺 / 伤兵回收 /
     * 侦察分层等**非模拟读点**由此获得正确城市）。
     * ============================================================ */
    var Sys191 = GAME.systems;
    var bakCtx191 = Sys191 ? Sys191._techCtx : null;
    var setCtx191 = false;
    if (Sys191 && Sys191._techCtx == null) {
      Sys191._techCtx = GAME.techsOf(p.city);
      setCtx191 = true;
    }
    try {
      return GAME.battle._expeditionRun(p, target, modeId, atkArmy, genId, opts);
    } finally {
      if (setCtx191) Sys191._techCtx = bakCtx191;
    }
  };
  /* ============================================================
   * v89.210：守方输入构造**唯一出口** —— 从 _expeditionRun 抵达段逐字节搬出。
   * ------------------------------------------------------------
   * 结算（_expeditionRun）与「战前推演」（GAME.battle.previewOf）共用它：
   * 「同一把尺」—— 杜绝"推演一套、实战一套"的漂移（本仓唯一出口铁律）。
   * 参数：t = resolveTarget 的解析结果 · modeId = 出征方式 · opts.scheme / opts._sim 语义同结算。
   * ============================================================ */
  GAME.battle.defenseInputsOf = function (t, modeId, opts) {
    opts = opts || {};
    var defBonus = (t.def || 0);
    /* v27（需求 3/5）：守将（野地贼将 / 名城守将）参与战斗 —— 双方英雄都要加成 */
    /* v59：把**目标城的围墙等级**传给引擎 —— 箭塔射程要用它
       （照搬原版：箭塔射程 = 基础×(1+抛射) + 基础×(围墙等级×3%) + 100） */
    var tWallLv = (t.npc && GAME.buildingLevel) ? GAME.buildingLevel(t.npc, 'chengqiang') : 0;
    /* v86（老板「按计划进行」· G1）：计谋效果 —— **全部作用于战斗入参**（零引擎改动）：
       妖言惑众→守军副本 −15%；焚其辎重→城防值 −30%；挑拨离间→守将加成减半。
       累计施计次数走 state 层唯一出口 schemeMarksOf（挑拨：忠诚 = 100 − 25×n）。 */
    var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;
    /* v92.14（斗将挑衅）：被叫过阵的城，守军胆寒 —— 少一成。
       与 schemeOf 的"妖言惑众"同层（都只改战斗入参），不碰引擎。 */
    var _fear = GAME.battle.fearOf(t);
    if (_fear > 0 && scArmy) {
      scArmy = GAME.battle.applyFearTo(scArmy, _fear);
      scNote = '胆寒 · 守军 −' + Math.round(_fear * 100) + '%';
    }
    /* ⛔ v89.198（老板「清除战法这个玩法」）：战法（强攻/围困/奇袭）全撤 ——
       奇袭的「计略 ×1.5」放大退役，计略按**基准系数**结算（与 ui.expDefModsOf 同源）。 */
    if (opts.scheme) {
      var _sc = GAME.schemeOf(opts.scheme);
      if (_sc) {
        if (_sc.id === 'yaoyan') {
          var _ga = {};
          for (var _gk in (scArmy || {})) {
            _ga[_gk] = Math.max(1, Math.round((scArmy[_gk] || 0) * (1 + _sc.eff.guardPct)));
          }
          scArmy = _ga;
          scNote = '妖言惑众 · 守军逃散 ' + Math.round(-_sc.eff.guardPct * 100) + '%';
        } else if (_sc.id === 'huoshao') {
          scVal = Math.round((defBonus || 0) * (1 - Math.min(0.9, _sc.eff.defCut)));
          scNote = '焚其辎重 · 城防失灵 ' + Math.round(Math.min(0.9, _sc.eff.defCut) * 100) + '%';
        } else if (_sc.id === 'tiaobo') {
          var _tn = GAME.schemeMarksOf(GAME.schemeKeyOf(t), 'tiaobo');
          var _loy = Math.max(0, 100 - _sc.eff.loyaltyDrop * _tn);
          if (scGen && _loy <= _sc.eff.faintAt) {
            scGen = U.deep(scGen);
            scGen.zm = Math.round((scGen.zm || 0) * 0.5);
            scNote = '挑拨离间 · 守将离心（忠诚 ' + _loy + '，加成减半）';
          } else {
            scNote = '挑拨离间 · 谗言已下（守将忠诚 ' + _loy + '）';
          }
        }
        /* 趁火打劫（掠夺系数）与金蝉脱壳（战败保全）在下方各自结算点另行注明 */
      }
    }
    /* ============================================================
     * ⛔ v89.198（老板「清除战法这个玩法」）：围困（行军×1.5 / 守军−12% / 城防疲敝 / 破防×1.5）
     *   随玩法全撤退役；本段只剩**围攻**（据点/城市）：守军与城防按**当前民心**缩放 ——
     *   民心越失、抵抗越弱（v89.204：民心口径 · 全部城市纳入）。
     * ⚠️ 必须发生在**观战挂起之前**：挂起时保存的 scArmy/scVal 是权威输入，
     *    重放读它（`opts._sim`）不重算 —— 否则同一场战斗两次结算结果会不同。
     * ⚠️ 缩放对**掠夺/占领都生效**（城破了就是破了），但**破防只有占领推进**。
     * ============================================================ */
    if (!opts._sim) {
      if (GAME.siegeScopeOf(t)) {
        var _sgS = GAME.siegeScaleOf(t);
        var _sgA = {};
        for (var _sgK in scArmy) {
          var _sgV = scArmy[_sgK] || 0;
          _sgA[_sgK] = _sgV > 0 ? Math.max(1, Math.round(_sgV * _sgS.garrison)) : 0;
        }
        scArmy = _sgA;
        scVal = Math.round(scVal * _sgS.def);
        if (_sgS.hold < 100) {
          scNote = (scNote ? scNote + '；' : '') + '围攻已成 · 民心仅余 ' + Math.round(_sgS.hold)
            + '%（守军与城防同步衰减）';
        }
      }
    }
    /* ============================================================
     * v89.87（老板需求 4 · 战斗观战）：出征战斗改为**会话制**
     * ------------------------------------------------------------
     * 开启观战（settings.battleWatch !== false）且非自动时，抵达不再立即
     * 跑完模拟 —— 在此建立战场会话并挂起（GAME.battle.stepBattle 逐回合
     * 推进，60 真实秒/回合、可提前完成）；战斗结束由 finishBattle 带
     * `opts._result` 重入本函数，从同一锚点继续走下方**既有落账段** ——
     * 一场战斗、一段代码、两条路径，落账逻辑零复制。
     * `opts._sim`：挂起时保存的战斗输入（重放用 —— 保证与首算逐字节一致）。
     * ============================================================ */
    var simOpts = { sieging: t.kind === 'city', kind: t.kind, defName: t.name, wallLv: tWallLv,
        /* v89.136（老板 4）：出征模式随 simOpts 走 —— 引擎据此读"细分（掠夺/占领）战术"
           （重放/挂起路径同样携带 —— simOpts 整存于 _sim）。 */
        modeId: modeId,
        /* v62（老板：「机工坊可以造箭塔，箭塔默认参与防守」）：
           守方的箭塔座数走**唯一出口** `GAME.towerCountOf` ——
           它把"城防折出"与"机工坊建造"合并成一个数。
           NPC 城没有自建箭塔（`city.towers` 未定义）→ 结果与 v59 完全一致；
           玩家城作为守方时，自己造的箭塔自动上阵（不需要任何指派）。 */
        towers: (t.npc && GAME.towerCountOf) ? GAME.towerCountOf(t.npc) : null,
        /* v91.85：把"本场是否启用策略层"随 simOpts 一起存成**纯数据**。
           观战/读档重跑都从 simOpts 重建会话 —— 只认这里的快照，不认"现在"的全局设置，
           这样中途改设置也不会让同一场仗前后两半用两套 AI。 */
        battleAI: !!(GAME.state && GAME.state.settings && GAME.state.settings.battleAI),
        /* v91.86：目标星球 —— 环境规则按它解析（跨星球出征不能读"当前城"） */
        pid: (t && t.pid != null) ? t.pid : (GAME.curPid ? GAME.curPid() : 1),
        /* v98.2：**玩家亲自出征** —— 只有这种战斗吃"作战目标"的战场修正
           （平推/强攻/斩首/奇袭）。NPC 互打与测试模拟不受影响。 */
        playerAtk: true,
        /* v101：**危险梯度**（A5）—— 越往迷雾深处，攻方生命越薄。
           在这里算成快照（不是运行时读），理由同 atkLv：观战重放/读档重跑必须同源。 */
        targetCi: (t && t.ci != null) ? t.ci : null,
        riskHp: (function () {
          try {
            if (!GAME.risk || !t || t.ci == null) return 0;
            var dg = GAME.risk.dangerAt(t.ci);
            if (!(dg > 0)) return 0;
            var k = ((GAME.DATA && GAME.DATA.RISK) || {}).hpAtFull;
            return -dg * (k == null ? 0.12 : k);
          } catch (e) { return 0; }
        })(),
        /* v98.5：**老兵等级**也是战场加成（每级 +3% 攻）。与 atkLv 同源取城，
           同样存进 simOpts —— 重放/读档重跑必须用同一份。 */
        atkVet: (function () {
          try {
            var _c2 = (opts && opts.cityId && GAME.city && GAME.city.byId)
              ? GAME.city.byId(opts.cityId) : null;
            return (GAME.veteran && _c2 && GAME.veteran.atkPctOf) ? GAME.veteran.atkPctOf(_c2.id) : 0;
          } catch (e) { return 0; }
        })(),
        /* v96：**出兵城的兵员等级** —— {兵种: 1..5}。
           放在 simOpts 里（而不是运行时读），因为 simOpts 会被整存进 `rec.sim`：
           观战重放/读档重跑必须用**同一份等级快照**，否则同一场仗重跑会变。 */
        atkLv: (function () {
          try {
            var _cid = opts && opts.cityId;
            var _c = (_cid && GAME.city && GAME.city.byId) ? GAME.city.byId(_cid) : null;
            return (GAME.trooplv && _c) ? GAME.trooplv.mapOf(_c) : null;
          } catch (e) { return null; }
        })() };
    return { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts };
  };

  /* ============================================================
   * v89.210（老板拍板 · 不留遗留）：**战前推演** —— 出征前预演一场。
   * ------------------------------------------------------------
   * 口径：与实战**同一引擎 + 同一输入构造**（defenseInputsOf）——
   *   推演 = "照当前态势打这一场会怎样"的确定性预演（引擎确定性：同输入同结果）。
   * 未计入（对玩家写明的诚实口径）：行军期间的天时/科技变化 · 战前斗将（随机触发，胜者 +10%）。
   * 纯读：不扣兵、不扣体力、不写战报（兵/将深拷贝传入引擎）。
   * ============================================================ */
  GAME.battle.previewOf = function (target, modeId, atkArmy, genId, opts) {
    opts = opts || {};
    var p = GAME.battle.prepare(target, modeId, atkArmy, genId, opts);
    if (!p.ok) return p;
    var t = p.t, gen = p.gen, city = p.city;
    var _di = GAME.battle.defenseInputsOf(t, modeId, { scheme: opts.scheme });
    /* v90.16 修复（§210③c）：实战在**开打前**扣本场体力（`_expeditionRun` 的
       setStaNow(gen, staNow − staCostOf)），体力经 cover 影响战果；推演原先不扣 →
       推演按满体力算、实战按扣后算，两者对不上（实测 atkLoss 121 vs 122）。
       此处对**副本**扣同一笔，令推演与实战逐字节同源（原件不动 —— 推演零副作用）。 */
    var genPrev = gen ? U.deep(gen) : null;
    if (genPrev && GAME.staCostOf) {
      GAME.setStaNow(genPrev, GAME.staNow(genPrev) - GAME.staCostOf(p.mode, opts.scheme));
      genPrev.energy = Math.max(0, (genPrev.energy || 0) - (p.mode.energy || 0));
    }
    /* 与 expedition 同款：科技读点钉在出发城（set-if-unset + try/finally 还原） */
    var Sys210 = GAME.systems;
    var bak210 = Sys210 ? Sys210._techCtx : null;
    var set210 = false;
    if (Sys210 && Sys210._techCtx == null) { Sys210._techCtx = GAME.techsOf(city); set210 = true; }
    try {
      var boost = GAME.battle.boostSnapshot(city);
      var result = GAME.battle.withBoost(boost, function () {
        return GAME.battle.simulate(U.deep(atkArmy), genPrev,
          _di.scArmy, _di.scVal, _di.scGen, _di.simOpts);
      });
      return { ok: true, t: t, gen: gen, city: city, boost: boost,
        def: { scArmy: _di.scArmy, scVal: _di.scVal, scGen: _di.scGen,
          scNote: _di.scNote, simOpts: _di.simOpts },
        result: result };
    } finally {
      if (set210) Sys210._techCtx = bak210;
    }
  };

  /* 出征结算主体（v89.191 从 expedition 拆出；参数 p = prepare 的结果） */
  GAME.battle._expeditionRun = function (p, target, modeId, atkArmy, genId, opts) {
    var s = GAME.state;
    var mode = p.mode, gen = p.gen, city = p.city, t = p.t;

    /* ============================================================
     * v89.87（老板需求 2）：非战斗行动抵达落账 —— 调兵（owncity）/ 采集（gather）
     * ------------------------------------------------------------
     * 两条路径与出征共用同一行军通道（dispatch 出发时已扣兵/体力），
     * 抵达时在此落账。**必须放在侦查判定之前**：两者的 mode.battle 都是
     * false，若按顺序走会被当成侦查结算（探守军、写侦查公文）。
     * · 调兵：抵达入城（v89.220 起**不再复验目标城容量** —— 驻军不设容量闸）；
     * · 采集：**v89.136 起仅服务老档** —— 英雄带队采集已并入驻军开采（入口全撤），
     *   此处只负责把"老档在途"的采集行军并入该野地驻军（不丢兵）。
     * ============================================================ */
    if (t.kind === 'owncity') {
      var _to = t.city;
      /* ⛔ v89.220（老板 2）：抵达复验（目标城练兵场容量）随发起闸一并退役 ——
         驻军不受目标城容量限制（见 domain.doTransferCargo 段 / docs/_史料/交付/v89220-基因实验室与建筑条件复核.md）。 */
      var _mv = 0;
      for (var _ok2 in atkArmy) {
        var _n2 = Math.floor(atkArmy[_ok2] || 0);
        if (_n2 <= 0) continue;
        GAME.city.armyAdd(_to, { [_ok2]: _n2 });
        _mv += _n2;
      }
      if (gen) gen.cityId = _to.id;             /* v91.76：可无将 —— 有将才随军入驻新城 */
      if (mode.id === 'dispatch' && gen && GAME.gen.set) GAME.gen.set(gen, 'idle');   /* 已入城，释放行军态 */
      _expArmySettled = true;                 /* 军账已结（兵入新城） */
      /* v89.103（老板「资源运输采用出征界面」）：**随军辎重落账** ——
         与"即时运输"同一套口径（GAME.transportPlanOf / transportApply）：
         距离损耗 + 目的地仓容；装不下的原路退回出发城（不抽损耗）。
         ⚠️ 放在兵力入城之后：军账已结（_expArmySettled=true），
            辎重的增减都是"落账"而不是"回滚"。 */
      var _cg = opts.cargo || null;
      var _cgOut = null;
      if (_cg) {
        _cgOut = GAME.transportCargo(_cg, city, _to);
        if (_cgOut.keys.length) {
          GAME.log.war('🚚 辎重抵 ' + _to.name + '：' + _cgOut.lines.join('；'));
        }
      }
      GAME.log.war('🚚 军队调防：' + U.fmt(_mv) + ' 兵入 ' + _to.name + (gen ? '（' + gen.name + ' 统带）' : '（无将）'));
      /* v91.76（老板）：**运输**送达后沿原路返回（耗时与去程相同）；兵与货已卸、
         空车返程即结束该行军 —— 由 march.dispatch 标记 roundTrip 后归城释放。 */
      return { ok: true, mode: mode.id, peaceful: true, target: t, moved: _mv, cargo: _cgOut,
        msg: '已入驻 ' + _to.name + '（+' + U.fmt(_mv) + ' 兵'
          + (_cgOut && _cgOut.keys.length ? ' · 辎重实收 ' + U.fmt(_cgOut.landed) + ' 单位' : '') + '）' };
    }
    if (mode.id === 'gather') {
      /* v89.136：英雄带队采集已并入驻军开采（`dispatchGather` / `openGatherModal` /
         `openGathers` 全撤，墓碑见各文件）。此分支**仅服务老档**：
         v89.136 之前出发、仍在途的采集行军 —— 抵达时兵并入该野地驻军
         （野地非我方则整体回城），与此前"抵达开始采集"的下场等价（**不丢兵**）。 */
      var _gw136 = GAME.map.wildAt(t.ci);
      var _gadd136 = 0;
      if (_gw136) {
        var _gb136 = GAME.wildGarrisonAdd(t.ci, atkArmy, city.id, { noCap: true, genId: gen && gen.id });
        if (_gb136.overflow) {
          for (var _o136 in _gb136.overflow) GAME.city.armyAdd(city, { [_o136]: _gb136.overflow[_o136] });
        }
        _gadd136 = _gb136.add || 0;
        var _wg136 = GAME.wildGarrisonAt(t.ci);
        if (gen) gen.status = (_wg136 && _wg136.genId === gen.id) ? 'garrison' : 'idle';
      } else {
        for (var _k136 in atkArmy) GAME.city.armyAdd(city, { [_k136]: atkArmy[_k136] });
        if (gen) GAME.gen.release(gen);   /* v91.65 */
      }
      _expArmySettled = true;                 /* 军账已结（兵已并入 / 已回城） */
      return { ok: true, mode: 'gather', peaceful: true, target: t,
        msg: '（老档在途）采集队抵达：' + U.fmt(_gadd136) + ' 兵并入驻军'
          + (gen ? '，' + gen.name + ' 留驻野地' : '') };
    }

    /* ---- 侦查：不接战 ---- */
    if (!mode.battle) {
      /* v89.135：体力折扣走唯一出口（以逸待劳） */
      GAME.setStaNow(gen, GAME.staNow(gen) - GAME.staCostOf(mode, opts && opts.scheme));
      gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
      var sc = GAME.battle.scoutTarget(t, gen);
      GAME.battle.gainExp(gen, 30, '侦察 ' + t.name);
      GAME.statBump('scouts', 1);
      var gd = sc.guard;
      var itL = sc.intel || { got: {}, lv: 0, next: null };
      /* v89.156（老板 4）：侦察失败 → 只报失手（缘由 = 守将资质/等级压过我方侦察单元），
         不再走成功路径的分层日志。 */
      var lines;
      if (sc.fail) {
        var _chF = sc.chance || {};
        var _foeF = _chF.foe || null;
        lines = ['【侦查失败】守军戒备森严，此行未得任何情报。'];
        if (_foeF) {
          lines.push('缘由：守将 ' + _foeF.name + '（' + GAME.rankOf(_foeF).name + ' Lv' + (_foeF.level || 1)
            + '）机警过人 —— 我方侦察单元（' + (gen ? (GAME.rankOf(gen).name + ' Lv' + (gen.level || 1)) : '无将')
            + '）未能应付。');
        }
        lines.push('建言：改派资质更高、等级更高的英雄带队，成功率随之提高。');
      } else {
      /* 日志也按分层：没解锁的项不写"守将：无"（那是误导 —— 不是没有，是看不见），
         改写"未解锁"。 */
      lines = [sc.totalExact
        ? ('守军 ' + U.numText(sc.gNum, 0) + ' 名')
        : ('守军约 ' + U.numText(sc.gNum, 0) + ' 名（未点验）')];
      (sc.roster || []).forEach(function (x) { lines.push(x.name + ' ' + U.numText(x.n, 0)); });
      if (itL.got.guard) {
        lines.push(gd ? ('守将：' + gd.name + '（' + GAME.rankOf(gd).name + ' Lv' + gd.level + '）') : '守将：无');
      } else {
        lines.push('守将：未探得');
      }
      if (itL.got.build && sc.build) lines.push('城防 ' + sc.build.def + ' · 围墙 Lv' + sc.build.wallLv);
      else if (sc.detail.wall) lines.push('目标城防 ' + (t.def || 0));
      if (itL.next) lines.push('（下一层情报：' + itL.next.name + ' 需侦察网络 Lv' + itL.next.unlock + '）');
      }
      /* v89.73（老板：「侦察后形成公文报告，不只是弹窗」）
         ------------------------------------------------------------
         改前侦查结果只活在那个弹窗里 —— 一关就没了，想回头比对"上次看的守军
         是多少"只能再派一次侦察单元。现在**同时落一份公文**（进公文页可回看）。
         正文按**已解锁的层**写（与弹窗同一口径）：没解锁的写"未探得"，
         而不是写"守将：无" —— 那是误导，不是没有，是看不见。 */
      (function () {
        /* v89.156（老板 4）：失败公文 —— 不带 `scout` 字段（公文列表的"展开侦查面板"
           只认它 → 失败没有面板可展开）；正文就是 lines（失败缘由 / 建言）。 */
        if (sc.fail) {
          s.reports.unshift({
            t: U.now(), type: 'scout',
            title: '侦查失败 · ' + t.name,
            body: lines.join('<br>'), loot: [], win: false,
            intel: { lv: itL.lv, target: t.name },
          });
          while (s.reports.length > (DATA.REPORT_MAX || 60)) {
            var _dropF = -1;
            for (var _riF = s.reports.length - 1; _riF >= 0; _riF--) {
              if (!s.reports[_riF].fav) { _dropF = _riF; break; }
            }
            if (_dropF < 0) break;
            s.reports.splice(_dropF, 1);
          }
          s.repUnread = (s.repUnread || 0) + 1;
          return;
        }
        var rp = [lines.join('<br>')];
        if (sc.loot && sc.loot.length) rp.push('【顺手所得】' + sc.loot.join('、'));
        if (sc.treasure) rp.push('【意外发现】' + sc.treasure);
        rp.push('【情报层级】侦察网络 Lv' + itL.lv + (itL.next
          ? '　·　下一层：' + itL.next.name + '（还差 ' + (itL.next.unlock - itL.lv) + ' 级）'
          : '　·　六层情报全开'));
        rp.push('【顺手拾获】不受分层影响 —— 任何等级都能捡到。');
        s.reports.unshift({
          t: U.now(), type: 'scout',
          title: '侦查回报 · ' + (sc.totalExact ? '' : '（约略）') + t.name,
          body: rp.join('<br>'),
          loot: (sc.loot || []).slice(), win: true,
          intel: { lv: itL.lv, target: t.name },
          /* ============================================================
           * v89.102（老板）：「侦查报告不要自动冒出来」
           * ------------------------------------------------------------
           * 改前：行军抵达（或即时报捷）后**自动弹**分层面板 —— 玩家正在做别的
           * 事也会被盖住。现在改为**只落公文**（公文菜单图标闪黄提示），
           * 玩家点进公文里这一条，再按「展开侦查面板」看完整分层情报。
           * 为此把面板需要的那几个字段**随公文一起存**（口径与当场一致：
           * 已解锁的层给准确值、未解锁的层显示锁定行）。
           * ============================================================ */
          scout: {
            kind: t.kind, name: t.name,
            intelTiers: sc.intel, totalExact: sc.totalExact, gNum: sc.gNum,
            roster: (sc.roster || []).slice(), guard: gd || null,
            loot: (sc.loot || []).slice(), treasure: sc.treasure || null,
            resReport: sc.res || null, buildReport: sc.build || null,
            def: t.def || 0,
            field: (GAME.tactic && GAME.tactic.battlefieldOf)
              ? GAME.tactic.battlefieldOf(atkArmy, sc.garrison || t.garrison || {}, t.def || 0,
                  { sieging: t.kind !== 'wild',
                    wallLv: (t.npc && GAME.buildingLevel) ? GAME.buildingLevel(t.npc, 'chengqiang') : 0 })
              : 2000,
            blinded: !!(sc.detail && sc.detail.blinded),
          },
        });
        /* v89.107：上限走 DATA.REPORT_MAX；挤掉最旧的**未收藏**那份
           （收藏 = 玩家点名要留，不许被上限挤掉 —— 试玩里 436 场只留 60 份时发现的） */
        while (s.reports.length > (DATA.REPORT_MAX || 60)) {
          var _drop = -1;
          for (var _ri = s.reports.length - 1; _ri >= 0; _ri--) {
            if (!s.reports[_ri].fav) { _drop = _ri; break; }
          }
          if (_drop < 0) break;
          s.reports.splice(_drop, 1);
        }
        s.repUnread = (s.repUnread || 0) + 1;      /* 与战报同一套"未读闪黄" */
      })();
      /* v89.86（整改 P-25）：行军队列抵达的侦查 —— dispatch 时随行兵力已扣离本城，
         而侦查不接战，随行者须原路归城（修复前"带兵侦查 = 凭空丢兵"）。 */
      if (opts.arrived) {
        var _cS = (opts.cityId && GAME.cityById(opts.cityId)) || GAME.currentCity();
        var _aS = 0;
        for (var _kS in atkArmy) _aS += (atkArmy[_kS] || 0);
        if (_cS && _aS > 0) GAME.battle.returnArmy(_cS, atkArmy, { atkRemain: _aS });
        _expArmySettled = true;      /* 军账已结（随行者归城 / 本就无兵） */
      }
      /* ============================================================
       * v92：**侦查 = 专门的探索工具**
       * ------------------------------------------------------------
       * 全明 3 格 + 外围半明 6 格（普通抵达只给 2 格全明）。
       * 掠夺/占领换收益，侦查换"看见" —— 否则半明这一档永远只有行军沿途
       * 顺带触发，玩家也就没有"专门派人去探路"的动机。
       * 放在 arrived 之外：即时报捷（点击直接结算）与行军抵达都算数。
       * ============================================================ */
      if (GAME.fog && t && t.ci != null && t.ci >= 0) {
        try {
          GAME.fog.revealAround(t.ci, 3, GAME.fog.ALL);
          GAME.fog.revealAround(t.ci, 6, GAME.fog.TERRAIN);
        } catch (eF) { /* 视野失败不阻断侦查结算 */ }
      }
      return {
        ok: true, mode: mode.id, result: { winner: 'scout' },
        intel: lines, roster: sc.roster, guard: gd, spoils: sc.spoils,
        /* v65：把**分层状态**一起带出去 —— 面板据此决定显示实值还是锁定行。
           ⚠️ `gNum` 必须一起带（面板的"守军总数"行读它）——
             之前漏了，面板会显示「约 undefined 名」；这个真 bug 是 e2e 抓到的。 */
        intelTiers: sc.intel, totalExact: sc.totalExact, gNum: sc.gNum,
        resReport: sc.res, buildReport: sc.build,
        /* v57：战场纵深改由**双方配兵**算（最远射程 + 199）；
           侦察时守军与随行部队都取到，所以这里能给出真实值。 */
        def: t.def || 0,
        field: (GAME.tactic && GAME.tactic.battlefieldOf)
          ? GAME.tactic.battlefieldOf(atkArmy, sc.garrison || t.garrison || {}, t.def || 0,
              { sieging: t.kind !== 'wild',
                wallLv: (t.npc && GAME.buildingLevel) ? GAME.buildingLevel(t.npc, 'chengqiang') : 0 })
          : 2000,
        blinded: !!(sc.detail && sc.detail.blinded),
        loot: sc.loot, treasure: sc.treasure,
        /* v89.156（老板 4）：失败给独立的 msg（行军抵达的 toast / 军务读它） */
        fail: !!sc.fail,
        msg: sc.fail
          ? ('侦查失败：' + t.name + ' 守军戒备森严，侦察单元未得情报'
              + (sc.chance && sc.chance.foe ? '（守将 ' + sc.chance.foe.name + ' 坐镇）' : ''))
          : ('侦查完成：' + lines[0] + (sc.loot.length ? '，顺手得 ' + sc.loot.join('、') : '')),
      };
    }

    /* ---- 掠夺 / 占领：需带兵（校验已在 prepare 完成，这里只做出征即离城的扣除） ---- */
    if (!opts.arrived) {
      /* 出征即离城：此处扣除，战后由 returnArmy 归还幸存者
         （行军模式下由 GAME.march.dispatch 扣除，抵达结算时 opts.arrived=true 不再重复扣） */
      for (var a3 in atkArmy) GAME.city.armySub(city, { [a3]: atkArmy[a3] });
      /* v89.137：无将增援（station）没有带队人可扣 —— 兵出去、体力不扣 */
      if (gen) {
        GAME.setStaNow(gen, GAME.staNow(gen) - GAME.staCostOf(mode, opts && opts.scheme));
        gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
      }
    }

    /* ---- v89.63「派遣」(station)：到**已属我方**的野地不接战，到了就驻 ----
       放在上面扣兵/扣体力之后 —— 即时出征与行军队列（dispatch 已扣）两条路径
       走到这里都已完成扣减，所以本段**只负责入驻**，不重复扣任何东西。
       为什么必须短路：己方野地上没有"守军"可打，走战斗结算会出现
       "自己打自己地盘、还按己方守军算伤害"的荒谬结果。 */
    if (mode.station && t.kind === 'wild' && GAME.map.wildAt(t.ci)) {
      /* v89.135（老板 4）：「设置英雄在野地停留的机制」—— 驻军首队（或补将）时把
         带队英雄写进 `garrison.genId`，英雄驻留野地（status='garrison'、cityId=null）；
         已有**别的**英雄驻守时，新将随军**回城**（增援不许带将，与 doWildGarrison 同规）。 */
      var _wg135 = GAME.wildGarrisonAt(t.ci);
      var _hadGen135 = !!(_wg135 && _wg135.genId);
      var _ga = GAME.wildGarrisonAdd(t.ci, atkArmy, city.id, { genId: gen && gen.id });
      if (_ga.overflow) {
        for (var _o1 in _ga.overflow) GAME.city.armyAdd(city, { [_o1]: _ga.overflow[_o1] });
      }
      var _genStay135 = false;
      if (gen) {
        var _wg2 = GAME.wildGarrisonAt(t.ci);
        /* v89.135：**驻守不改 cityId**（编制城保持 —— "人在野地"由 status 表达）——
           改前置 null 会打穿所有按 `g.cityId === 城.id` 过滤的界面（荒野行动君主在城、
           任命候选…），实测把 v88/v89 的荒野段整条链路连带失败。 */
        if (_wg2 && _wg2.genId === gen.id) { GAME.gen.set(gen, 'garrison'); _genStay135 = true; }   /* v91.65 */
        else { GAME.gen.release(gen); }   /* v91.65 */
      }
      var _stMsg = '派遣驻守 ' + U.fmt(_ga.add || 0) + ' 名（守地不衰减'
        + (_genStay135 ? '，' + gen.name + ' 驻留野地' : '') + '）';
      GAME.log.war('🛡️ ' + t.name + '：' + _stMsg
        + (_ga.overflow && Object.keys(_ga.overflow).length ? '；超出驻军上限者已回城' : ''));
      _expArmySettled = true;      /* v89.86（P-25）：军账已结（驻军 / 溢出均已落地） */
      return {
        ok: true, mode: mode.id, result: { winner: 'atk' }, target: t,
        peaceful: true, msg: _stMsg,
      };
    }

    /* 目标城防。旧写法把**我方围墙等级**加到了敌方防御上（`wallLvl` 取自 GAME.currentCity()），
       等于「自己修墙让敌人更硬」；且因 0.6 封顶而长期看不出问题。此处一并修正 */
    /* ============================================================
     * v89.210：守方输入构造抽为**唯一出口** GAME.battle.defenseInputsOf ——
     * 结算与「战前推演」（previewOf）共用同一份构造（逐字节搬运，行为不变）：
     *   defBonus / tWallLv / scArmy·scVal·scGen·scNote / 计谋效果 / 围攻缩放 / simOpts。
     * ============================================================ */
    var _di210 = GAME.battle.defenseInputsOf(t, modeId, opts);
    var scArmy = _di210.scArmy, scVal = _di210.scVal, scGen = _di210.scGen, scNote = _di210.scNote;
    var simOpts = _di210.simOpts;

    /* ---- v89.115（老板「设计斗将战，为英雄个人战，军队作战中概率触发（50%），
       斗将战在军队战前进行，斗将战胜利将获得临时 10% 英雄属性加成」）----
       战前斗将：胜方主将拿到一份**属性 +10% 的副本**（原件不动 = 只此一战），
       由 genAttrs 加成链传导到全军。结果随 `_sim` 存走 —— 重放/挂起不重掷。 */
    var duel = null, genSim = gen;
    function _doDuel() {
      duel = GAME.battle.rollDuel(gen, scGen, GAME.battle.duelSeedOf(target));
      /* v92.13（C1 补完）：手动斗将赢过的英雄，这一战先声夺人。
         只补"本来没触发斗将"的空档，不改写已经打过的结果 —— 士气不是外挂。 */
      duel = GAME.battle.applyMorale(duel, gen);
      if (duel && duel.done) {
        if (duel.winner === 'atk') genSim = GAME.battle.duelBoostOf(gen);
        else scGen = GAME.battle.duelBoostOf(scGen);
        GAME.log.war('⚔ 斗将：' + duel.log.join('；'));
      }
      return duel;
    }
    /* v89.118：战斗加成快照 —— 开打那一刻采集；重放沿用挂起时的那份（三者同源） */
    var _boost = (opts._sim && opts._sim.boost) || GAME.battle.boostSnapshot(city);
    if (opts._sim) {                       /* 重放：用挂起时保存的权威输入（不重算） */
      scArmy = opts._sim.scArmy || {}; scVal = opts._sim.scVal || 0;
      scGen = opts._sim.scGen || null; scNote = opts._sim.scNote || null;
      simOpts = opts._sim.simOpts || simOpts;
      duel = opts._sim.duel || null;
      genSim = opts._sim.genSim || gen;
    } else if (!opts._result && GAME.battle._needWatch(opts)) {
      /* 观战：**先斗将**（战前发生），结果与加成后的两份英雄一并挂起 */
      _doDuel();
      return GAME.battle._suspendExpedition(target, modeId, atkArmy, genId, opts,
        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts,
          duel: duel, genSim: genSim, boost: _boost });
    } else if (!opts._sim) {
      /* 即时结算（非观战、非重放）：同样战前斗将 */
      _doDuel();
    }
    /* v89.118：结算也在加成快照内跑 —— 史实结果 = "那一刻的加成"下的结果，
       与沙盘重跑（装回同一份快照）逐字节同源。 */
    var result = opts._result || GAME.battle.withBoost(_boost, function () {
      return GAME.battle.simulate(atkArmy, genSim, scArmy, scVal, scGen, simOpts);
    });
    if (duel) result.duel = duel;
    /* ============================================================
     * v89.102（沙盘）：**开打前那一刻的输入快照**（配方专用）
     * ------------------------------------------------------------
     * 必须在下面这些"会改输入"的步骤**之前**取：
     *   · `returnArmy(city, atkArmy, …)` 结算归队时会把 `atkArmy` 逐项清零
     *     —— 真机实测：战后取配方拿到的是 `{fujiche:0, daodanche:0, …}`，
     *       重跑成了**空阵**（0 回合 0 损失），而校验又是 0==0 **假通过**；
     *   · `gainExp(gen, …)` 可能让英雄当场升级 —— 用战后的将重跑，同配方跑出另一场仗。
     * 这个坑靠"真浏览器截图脚本里推演按钮被禁用"才暴露（Node 探针里英雄没升级、
     * 也没走到 returnArmy 之后，所以一直绿）。
     * ============================================================ */
    /* v89.115：配方里的主将用**斗将后的那份**（genSim）—— 否则沙盘重跑会少一个 +10% 的加成，
       校验必然对不上（v89.102 的教训：配方必须与"开打那一刻的输入"逐字节一致）。 */
    var _sbArmy = U.deep(atkArmy), _sbGen = genSim ? U.deep(genSim) : null;
    /* v86：计谋注脚 —— 战报/日志可见（金蝉脱壳只在战败时另算保全） */
    if (scNote) result.schemeNote = scNote;
    if (opts.scheme === 'jintui' && result.winner !== 'atk') {
      var _jt = GAME.schemeOf('jintui');
      result.schemeKeep = _jt ? Math.min(1, _jt.eff.woundedKeep) : 0;
      result.schemeNote = '金蝉脱壳 · 保全而退（阵亡 ' + Math.round(result.schemeKeep * 100) + '% 转伤兵）';
    }
    var win = result.winner === 'atk';
    GAME.statBump('wins', win ? 1 : 0);
    GAME.statBump(mode.occupy ? 'conquerAttempt' : 'raidCount', 1);

    /* ============================================================
     * v89.204（老板 1）：围攻 —— **占领以民心为基础**（旧"守备值"口径改制）
     * ------------------------------------------------------------
     * · **战斗成功，败方失去 20 点民心**（固定 · DATA.SIEGE.heartsLoss）——
     *   仅"本战获胜"推进；战败 / 主动撤退**不折损民心**（旧"不论胜负都破防"退役）；
     * · 民心归零 + 本战获胜 = 拔城；否则"守军退守内城"，整军再来；
     * · 民心越低守军/城防越弱（siegeScaleAt 不变 —— 民心涣散，抵抗自弱）。
     * ============================================================ */
    var siegeOut = null;
    if (mode.occupy && GAME.siegeScopeOf(t)) {
      if (win && !result.retreat) {
        siegeOut = GAME.siegeChipApply(t, GAME.siegeChipOf());
        result.siege = { chip: siegeOut.chip, hold: siegeOut.hold, waves: siegeOut.waves,
          broke: siegeOut.broke, retreat: false };
        GAME.log.war('⚔️ 得胜：' + t.name + ' 民心 −' + siegeOut.chip + ' → 余 '
          + Math.round(siegeOut.hold) + '%（第 ' + siegeOut.waves + ' 波）'
          + (siegeOut.broke ? ' —— 民心已尽，城垣垂危' : ''));
      } else {
        /* 战败 / 主动撤退：民心未动（给一句交代，但不折损 —— "得胜方可夺其民心"） */
        var _st204 = GAME.siegeStateOf(t);
        if (_st204 && !_st204.fresh) {
          GAME.log.war((result.retreat ? '🏳️ 主动撤退' : '⚔️ 受挫') + '：' + t.name
            + ' 民心未动（余 ' + Math.round(_st204.hold) + '%）—— 得胜方可夺其民心');
        }
      }
    }

    var gains = { res: null, mats: [], equip: [], hero: null, beauty: null, gold: 0 };

    if (win) {
      /* v89.99：俘获迁民 —— 攻破据点/名城，溃卒入**俘虏营**（唯一出口 captiveGain）
         v89.116：把敌军（= 守方）的逐兵种损失表一起传进去 —— 俘虏营要按兵种列清单 */
      /* v89.135：围师必阙（attack）俘获 +60% —— 显式传策（同战同源） */
      var _wsEff = (opts.scheme === 'weishi' && GAME.schemeOf)
        ? (GAME.schemeOf('weishi') || {}).eff : null;
      var _capt99 = GAME.battle.captiveGain(city, result, t, null, result.defLossBy,
        { captiveUp: (_wsEff && _wsEff.captiveUp) || 0 });
      if (_capt99 && _capt99.gain > 0) {
        result.captives = _capt99;
        GAME.log.war('🪶 俘获溃卒：' + _capt99.city + ' +' + U.fmt(_capt99.gain) + ' 人（入俘虏营）');
      }
      /* v63（老板）：「野外城每天只能被掠夺一次」——**得手才计数**。
         掠夺失败不占用当天的额度（打不过不算掠夺过；否则一次失手就整天没得打，
         与 `prepare` 的拦截语义要一致：拦的是"已掠夺过"，不是"已尝试过"）。 */
      if (t.kind === 'fort' && mode.id === 'raid' && GAME.map.markFortRaided) {
        GAME.map.markFortRaided(t.ci);
        result.fortRaidDaily = true;
      }
      /* 战利品（v15 按原版铁律重排）：
         · **野地**：掠夺有资源；**占领不给资源** —— 收益在长期加成与采集权
         · **城市**：掠夺厚（1.7×），占领薄（0.8×，因城市本身会持续纳税） */
      var isWild = (t.kind === 'wild');
      var mulTbl = isWild ? (DATA.EXPEDITION.wildResMul || {}) : (DATA.EXPEDITION.cityResMul || {});
      var resMul = mulTbl[mode.id];
      if (resMul == null) resMul = 1;
      /* v89.109：掠夺资源**先过城防闸**（唯一出口 lootGateOf）——
         未破墙 / 未歼野战军 → 这一趟抢不到东西（战斗照打照记，兵损经验材料不受影响）。 */
      var _lg109 = (resMul > 0) ? GAME.battle.lootGateOf(result, t) : { ok: true, msg: '' };
      if (resMul > 0 && !_lg109.ok) {
        result.lootGate = _lg109;
        GAME.log.war('🧱 ' + _lg109.msg);
      }
      if (resMul > 0 && _lg109.ok) {
        /* 废墟搜刮：掠夺资源收获 +3%/级 —— 只对「掠夺」生效（占领本就不取财货） */
        var raidBonus = (mode.id === 'raid') ? (1 + TB('pillage')) : 1;
        /* v86：趁火打劫 —— 本战掠夺资源 +30%（乘乱取利，与废墟搜刮叠乘） */
        if (opts.scheme === 'chenhuo') {
          var _ch = GAME.schemeOf('chenhuo');
          raidBonus *= 1 + (_ch ? _ch.eff.lootPct : 0);
        }
        /* v60（需求 4/6）：**城市**用该城自己的派生库存做战利品来源
           （"侦查看到的数" = "打完搬回来的数"，一个出口）；
           野地/据点仍走 genLoot 的按档位生成。 */
        var loot = (t.kind === 'city' && t.npc)
          ? GAME.npcLoot(t.npc, mode.id, raidBonus)
          : GAME.battle.genLoot(t, resMul * raidBonus);
        /* v89.114（老板「掠夺返回的物资数量与军队总负重有关」）：
           战利品总重 ≤ **随军载重**（幸存部队，扣去去程已载辎重）。
           超载时按比例缩减，余数留在原处（战报里明示"未能装下"，下次可再取）。 */
        /* v92：传 dist —— 搬运力按距离折损（远行的收获变薄，不是去不了） */
        var _dist92 = (GAME.sphere && GAME.sphere.distOf && city && t)
          ? GAME.sphere.distOf({ ci: city.ci }, { ci: t.ci }) : 0;
        var _haul = GAME.battle.haulPlanOf({ army: atkArmy, result: result, cargo: opts.cargo, loot: loot, dist: _dist92 });
        /* v89.189（老板 2 · 顺修）：**旧币不入搬运** —— gold 不在 TRANSPORT_KEYS
           （v89.161：旧币是玩家层级货币），但旧实现把 keep 直接覆盖回 loot →
           genLootEx / npcLoot 产的 gold 在下一步**静默蒸发**（"面板估掠有旧币、
           打完不给"的真 bug）。现在：旧币从原始战利品单独取出、直入玩家旧币池
           （与珠宝/材料落账同精神：货币不靠辎重队搬）。 */
        var _goldLoot189 = Math.max(0, Math.round(loot.gold || 0));
        if (_goldLoot189 > 0) {
          if (GAME.goldAdd) GAME.goldAdd(_goldLoot189);
          else GAME.goldAdd(_goldLoot189);   /* v91.67 */
          gains.gold = _goldLoot189;
        }
        loot = _haul.keep;
        gains.haul = _haul;
        /* v60（需求 4）：战利品归**出征的出发城**（资源归属城市） */
        var lootCity = city || GAME.currentCity();
        var Rloot = GAME.res(lootCity);
        for (var lk in loot) { if (loot[lk] > 0) Rloot[lk] = (Rloot[lk] || 0) + loot[lk]; }
        gains.res = loot;
      } else if (resMul <= 0) {
        gains.res = null;
        GAME.log.war('占领不取财货 —— 掠夺得资源，占领得地盘（回报在此地长久的产量加成与采集权）');
      }

      /* 材料 */
      var matTbl = t.kind === 'wild' ? DATA.WILD_MATERIAL[t.terrain] : DATA.CITY_MATERIAL[t.dropType || 'county'];
      var matMul = t.kind === 'wild'
        ? (DATA.EXPEDITION.wildMatMul[mode.id] || 1)
        : (DATA.EXPEDITION.cityMatMul[mode.id] || 1);
      if (matTbl) gains.mats = GAME.battle.grantMaterials(matTbl, matMul, '缴获材料');

      /* 珠宝（掠夺概率更高；**占领野地不取财货**） */
      var jc = DATA.EXPEDITION.jewelChance[mode.id] || 0;
      if (isWild && mode.occupy) jc = 0;
      if (Math.random() < jc) {
        var jewels = (DATA.ITEMS || []).filter(function (it) { return it.type === 'jewel'; });
        if (jewels.length) {
          var top = Math.min(jewels.length, (t.kind === 'city' || t.kind === 'fort') ? t.lv : 4);
          var j = jewels[Math.floor(Math.random() * Math.max(1, top))];
          var jn = 1 + Math.floor(Math.random() * 2);
          GAME.items.add(j.id, jn);
          GAME.log.war('缴获珠宝：' + j.name + ' ×' + jn);
        }
      }

      /* 军械：掠夺亦可得图纸与成品 */
      var eq = GAME.battle.rollEquipLoot(t);
      if (eq.length) { gains.equip = eq; GAME.log.war('缴获军械：' + eq.join('、')); }

      /* v89.224（老板 2）：种子缴获整条退役（播种改「立项」后不再需要种子）。
         来源等级口径保留 —— 辐能核心掉落继续用它（城档折算随表迁入 DATA.ESSENCE_DROP.cityLv）。 */
      var dropLv = (t.kind === 'wild')
        ? (t.lv || 1)
        : (((DATA.ESSENCE_DROP || {}).cityLv || {})[t.dropType || 'county'] || (t.lv || 3));

      /* v89.51：辐能核心 —— 缴获线的产出（补上调校基因强化件的产出口） */
      var essLoot = GAME.grantEssenceDrop(dropLv, DATA.ESSENCE_DROP.battleMult, '✨ 缴获辐能核心');
      if (essLoot.length) gains.essence = essLoot;

      /* v89.179c（老板「高阶加速宝物改采集/战役掉落」）：战役缴获线（次渠道，
         mult = DATA.BOOST_DROP.battleMult）。与精华掉落同构，只掷 BOOST_DROP 表。 */
      var boostLoot = GAME.grantBoostDrop(dropLv, (DATA.BOOST_DROP || {}).battleMult, '🎁 缴获加速宝物');
      if (boostLoot.length) gains.boost = boostLoot;

      /* v89.186（老板 1）：遗物 —— 打据点/名城缴获（唯一渠道；与上面的"加速宝物"互不占配额）。
         掉落随机不影响战斗确定性（发生在落账段，沙盘重跑只重跑引擎）。 */
      var baoLoot = GAME.grantBaoDrop ? GAME.grantBaoDrop(t) : [];
      if (baoLoot.length) gains.baoju = baoLoot;

      /* 占领：据而有之 */
      if (mode.occupy) {
        if (t.kind === 'wild') {
          /* v79：附属野地上限 = 政务厅等级 + 威望/主城加成（唯一汇总口） */
          var limit = (GAME.buildingLevel(city, 'guanfu') || 1) + GAME.cityBonusNum(city, 'wildCap');
          if ((s.wilds || []).length >= limit) {
            GAME.log.war('野地数量已达上限（政务厅' + limit + '级），转为就地取材');
          } else {
            s.wilds = s.wilds || [];
            if (!GAME.map.wildAt(t.ci)) {
              /* v15：记录占领时的等级与日期，此后每现实日 -1 级（见 GAME.decayWilds）
                 v90.70：附 ci（球面六边格索引）—— 与城/据点统一按球系身份 */
              var _wc = GAME.sphere && GAME.sphere.cells ? GAME.sphere.cells[t.ci] : null;
              s.wilds.push({
                pid: (t.pid != null) ? t.pid : GAME.curPid(),
                ci: t.ci, type: t.terrain, level: t.lv,
                lon: _wc ? _wc.lon : null, lat: _wc ? _wc.lat : null,
                levelDay: GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000),
              });
            }
            var _add = GAME.wildAddOf(t.terrain, t.lv) || {};
            var _pct = [];
            for (var _r in _add) _pct.push('+' + Math.round(_add[_r] * 100) + '%');
            GAME.log.war('占领野地：' + DATA.TERRAIN[t.terrain].name + ' Lv' + t.lv
              + '（产量加成 ' + _pct.join('/') + '，可派军采集）');
            GAME.statBump('wilds', 1);
          }
          var enc = GAME.story ? GAME.story.encounterRoll() : null;
          result.encounter = enc;
        } else if (t.kind === 'fort') {
          if (!siegeOut || siegeOut.broke) {
            /* v89.103（老板「拔除据点可以占据该据点」）：拔除 = **据而有之** ——
               据点就地转成我方一座城（详见 GAME.claimFort）。 */
            var _occ103 = GAME.claimFort(t, gen, city, result);
            if (_occ103 && _occ103.ok) result.claimed = _occ103;
            if (siegeOut) GAME.siegeClear(t);      /* v89.94：下城即清围攻档 */
          } else {
            /* 围攻未果：民心未尽 —— 兵回城，民心保留（下波再来） */
            GAME.log.war('🏯 ' + t.name + ' 民心未尽（余 ' + Math.round(siegeOut.hold)
              + '%）：守军退守内城，可整军再攻（占领＝夺其民心 · 胜者每战 −20）');
          }
        } else {
          if (!siegeOut || siegeOut.broke) {
            GAME.onConquer(t.npc, result, gen, city);
            if (siegeOut) GAME.siegeClear(t);
          } else {
            GAME.log.war('🏯 ' + t.name + ' 民心未尽（余 ' + Math.round(siegeOut.hold)
              + '%）：守军退守内城，可整军再攻（占领＝夺其民心 · 胜者每战 −20）');
          }
        }
      }

      /* 英雄经验（v55 · 原版规则；v56 老板调口径）：
         经验 = 歼灭敌军的资源量 / 1000 × 2（胜方），并封顶到"升级需求的 80%"。
         ⚠️ 口径从"野地等级 × 12"改成"**实际歼灭量**"——这是本质修正：
         原来的线性公式对二次增长的升级需求，到后期是 750~840 场一级（实测）。 */
      var expR = GAME.battle.battleExp(result.defLossBy, gen);
      /* v83（老板）：「形成经验惩罚机制」——掠夺 / 占领野地时按台阶打折。
         野地以外（城市 / 野外城市）不适用；打折后保底 1 点（不至于完全归零）。 */
      if (t.kind === 'wild' && expR.gain > 0) {
        var penR = GAME.battle.expPenaltyOf(gen.level, t.lv);
        if (penR.mul < 1) {
          result.expPenalty = {
            mul: penR.mul, need: penR.need, wl: penR.wl, gap: penR.gap,
            before: expR.gain, after: Math.max(1, Math.round(expR.gain * penR.mul)),
          };
          expR.gain = result.expPenalty.after;
        }
      }
      var whyEx = mode.name + ' ' + t.name
        + (result.expPenalty ? '（越级惩罚 ×' + Number(result.expPenalty.mul).toFixed(2) + '）' : '');
      var exps = GAME.battle.gainExp(gen, expR.gain, whyEx);
      /* 战报里体现经验：否则玩家永远不知道打仗还会涨经验，"经验可操作"就无从谈起 */
      result.expGain = expR.gain;
      result.expInfo = exps;
      result.expRaw = expR.raw;
      result.expCapped = expR.capped;
      result.defValue = expR.value;
    } else {
      /* 战败：**不给经验**（v56 · 老板拍板：「胜方才有经验」）。
         原版是"败方拿一半"，我们收掉了。这不是暗改 —— 战报要写一句
         「战败无功，未获经验」，否则原版过来的玩家会以为经验算漏了。 */
      result.expNone = true;
      /* 战败：伤兵在下方 returnArmy 统一结算（此前这里直接 applyWounded 会重复计数） */
      /* v89.94（B2 · E1）：**主动撤退不是战败** —— 撤退是决策（保全而退），
         不该被当失败惩罚：不扣忠诚、不写"坚守不退"，写清"破防已保留"。 */
      if (result.retreat) {
        GAME.log.war('🏳️ ' + gen.name + ' 主动撤退：' + t.name + ' 未克（破防已保留，残部带回）');
      } else {
      /* v14.1：忠诚的唯一自然下降途径 —— 出征战败挫伤士气。
         （此前是随时间/民心/欠俸慢慢掉，玩家什么都没做也会掉，体验很差） */
      var lLoss = (DATA.LOYALTY && DATA.LOYALTY.defeatLoss) || 8;
      var lBefore = gen.loyalty == null ? 70 : gen.loyalty;
      /* v89.40（老板）：「君主不会掉忠诚」—— 战败挫伤不适用于君主
         （与「不可解雇 / 绝不离去」同源：忠诚对君主无意义，详情页也不再出忠诚行）。 */
      if (GAME.isLordGeneral(gen)) {
        GAME.log.war((mode.occupy ? '攻城' : '劫掠') + '失败：' + t.name + ' 坚守不退（可退而休整）');
      } else {
        gen.loyalty = Math.max(0, lBefore - lLoss);
        GAME.log.war((mode.occupy ? '攻城' : '劫掠') + '失败：' + t.name + ' 坚守不退（可退而休整）'
          + '，' + gen.name + ' 忠诚 -' + lLoss + '（现 ' + Math.round(gen.loyalty) + '）');
        if (gen.loyalty < (DATA.LOYALTY.warnAt || 50)) {
          GAME.log.war('⚠️ ' + gen.name + ' 忠诚已低于 ' + DATA.LOYALTY.warnAt + '，加成减半，宜以珠宝赏赐安抚。');
        }
      }
      }
    }

    /* v89.149（老板 1）：**出征视角**落一笔战功声望（我方 = 攻方）——
       基础 = 歼灭的军力（defLossBy），系数 = 军力对比（与军师估算同尺）。
       败仗也有斩获，但威望折损（DATA.REP_RULE.loseMul）；口径全在 grantBattleRep 一处。 */
    GAME.battle.grantBattleRep(result, 'atk', win, t.name);

    /* 归队 —— 「派出去的兵能回来」的唯一路径。
       之前 expedition 扣了兵却从不归还 `result.atkRemain`，伤兵也只是个计数，
       等于每次出征都在凭空蒸发军队、治疗是纯旧币消耗。 */
    var returned = { back: {}, wounded: {} };
    /* v89.63：「派遣」打下来的兵**留驻该地**（伤兵仍回城医治）——
       于是"出兵"与"驻守"合成一道手续，那道独立的「派军驻守」按钮就此退场。 */
    var _stW = (mode.station && t.kind === 'wild' && win) ? GAME.map.wildAt(t.ci) : null;
    var _stAdd = 0;
    /* v92：名录要的是"派出去多少" —— 必须在 returnArmy 之前留一份。
       returnArmy 会按幸存编制改写原地账，事后再读 atkArmy 拿到的是残值。 */
    var _sentSnap = U.deep(atkArmy);
    if (city) {
      returned = GAME.battle.returnArmy(city, atkArmy, result, _stW ? function (back) {
        /* v89.135（老板 3）：**占领新野地不受驻军上限**（noCap）——「10W 占领 1 级野地
           也能全部进去」；老板 4：首队随征英雄记入驻军（genId）。 */
        var _gb = GAME.wildGarrisonAdd(t.ci, back, city.id, {
          genId: gen && gen.id,
          noCap: !!mode.occupy,
        });
        if (_gb.overflow) {
          for (var _o2 in _gb.overflow) GAME.city.armyAdd(city, { [_o2]: _gb.overflow[_o2] });
        }
        _stAdd = _gb.add || 0;
      } : null);
    }
    _expArmySettled = true;      /* v89.86（P-25）：军账已结（幸存者 / 伤兵均已入账） */
    /* v92：阵亡名录 —— 只记**再也不会回来的人**（归队的、抬回来能治的都不算）。
       ⚠️ 刻意不加任何加成或惩罚：给死亡标上汇率，玩家就开始算
       "送多少人头最划算"，这件事的性质就变了。它只是一面墙。*/
    if (GAME.memorial) {
      try {
        GAME.memorial.record({
          sent: _sentSnap, back: returned.back, wounded: returned.wounded,
          place: t.name, ci: t.ci, win: win, mode: mode.name, gen: gen,
        });
      } catch (eM) { /* 名录失败不阻断结算 */ }
    }
    var backN = 0, woundN = 0;
    for (var bk in returned.back) backN += returned.back[bk];
    for (var wk in returned.wounded) woundN += returned.wounded[wk];
    if (_stW) {
      /* v89.135（老板 4）：占领/驻守后**英雄留在野地**（与 station 到达同口径）——
         驻军有将，野地面板可见，开采由他带队（老板第 5 条）。 */
      /* v89.135：驻守不改 cityId（同 station 段） */
      if (gen) { GAME.gen.set(gen, 'garrison'); }   /* v91.65 */
      GAME.log.war('🛡️ 派遣驻守：' + U.fmt(_stAdd) + ' 名留驻 ' + t.name
        + (gen ? '，' + gen.name + ' 驻留野地' : '')
        + (woundN > 0 ? '，伤兵 ' + U.fmt(woundN) + ' 回城医治' : ''));
    } else if (backN > 0 || woundN > 0) {
      GAME.log.war('班师 ' + (city ? city.name : '') + '：' + U.fmt(backN) + ' 名归营'
        + (woundN > 0 ? '，伤兵 ' + U.fmt(woundN) + ' 入营（可花旧币治疗归队）' : ''));
    }

    /* v20：战报必须包含**战利品**。
       此前 body 只有伤亡，战利品仅写进系统提示，玩家看战报以为「掠夺胜利什么都没得到」。 */
    var lootLines = [];
    /* v89.189（老板 2）：缴获旧币单列（旧币不入搬运、直接入池——旧版它连战报都不出现） */
    if (gains.gold > 0) lootLines.push('💰 缴获旧币：+' + U.fmt(gains.gold) + '（直接入旧币库）');
    if (gains.res) {
      var _lp = [];
      for (var _rk in gains.res) {
        /* v60：资源中文名走**唯一出口** GAME.resName（原先这里内联了一张表，
           与 DATA.RESOURCES 是两个出口 —— 一改名就两边对不上）。 */
        if (gains.res[_rk] > 0) _lp.push(GAME.resName(_rk) + ' +' + U.numText(gains.res[_rk], 0));
      }
      if (_lp.length) lootLines.push('资财：' + _lp.join('　') + '（已入' +
        ((typeof city !== 'undefined' && city) ? city.name
          : (GAME.currentCity() ? GAME.currentCity().name : '出发城')) + '府库' +
        /* v89.114：运力口径随行（"搬了多少"与"最多能搬多少"同源 haulPlanOf） */
        ((gains.haul && gains.haul.weight > 0)
          ? '；随军载重 ' + U.fmt(gains.haul.cap) + ' ／ 实载 ' + U.fmt(gains.haul.kept) : '') + '）');
    } else if (win && mode.occupy && t.kind === 'wild') {
      lootLines.push('战果：据而有之（占领不取财货，回报在此地长久的产量加成与采集权）');
    } else if (win && mode.occupy && t.kind === 'city') {
      /* v60（需求 4/6）：攻占的口径变了 —— 不再另发一笔财货，
         而是**城市连同其中的库藏**（该城按等级派生的库存 × cityInherit）一起归我。 */
      lootLines.push('战果：城市易主，其中库藏尽归我有（占领不取现财 —— 财货已在城中）');
    } else if (win && mode.occupy && t.kind === 'fort' && result.claimed) {
      /* v89.186（老板 3）：据点剥离 —— 占据 = **我方前哨**（不转城市；周边野地享 5 项之利）
         v89.193（老板 2）：半径与效果随前哨等级 —— 文案走唯一出口 fortEffectOf（不重算）。 */
      var _fx193r = GAME.fortEffectOf(result.claimed);
      lootLines.push('战果：**收为我方前哨** —— ' + t.name + '（Lv' + result.claimed.lv
        + ' · 不占城市名额）；周边 ' + _fx193r.radius
        + ' 格内野地：衰减减半 · 采集×' + _fx193r.gatherMul + ' · 驻军上限 ×' + _fx193r.garrisonCapMul
        + ' · ' + (_fx193r.intelFull ? '情报确凿' : '情报半明') + ' · 商税 ' + _fx193r.tax + ' 旧币/现实日');
    }
    /* v89.114：运力不足的明示（唯一出口 haulPlanOf 的结果）——
       "搬回来多少"与"最多能搬多少"写进战报，玩家一眼看出差在后勤。 */
    if (gains.haul && gains.haul.lost > 0) {
      lootLines.push('🚚 运力不足：库藏重 ' + U.fmt(gains.haul.weight) + '，随军载重仅 '
        + U.fmt(gains.haul.cap) + ' —— 尚有 ' + U.fmt(gains.haul.lost)
        + ' 未能装下（仍留库中，下次可再取；编入运输平台或板车可提高搬运量）');
    }
    /* v92：**远途折损**要说出来，否则玩家只会觉得"这仗掠夺怎么这么少"，
       学不到"远 = 贵"这条规则。距离 ≥ 8 格才提，免得近处打每一仗都刷一行。 */
    if (gains.haul && gains.haul.dist >= 8 && gains.haul.decay < 0.995) {
      lootLines.push('🧭 远途折损：往返 ' + Math.round(gains.haul.dist) + ' 格，搬运力只剩 '
        + Math.round(gains.haul.decay * 100) + '% —— 这一趟的路途吃掉了大半运力；'
        + '想把远处库藏搬干净，得带运输平台 / 板车，或者就近先修前哨。');
    }
    if (gains.mats && gains.mats.length) lootLines.push('材料：' + gains.mats.join('、'));
    if (gains.equip && gains.equip.length) lootLines.push('军械：' + gains.equip.join('、'));
    /* v89.113（老板「战斗胜利为什么没有俘虏」）：俘虏进战利品清单 —— 玩家一眼可见 */
    if (result.captives && result.captives.gain > 0) {
      /* v89.116：按兵种列出来（老板：「不要一个总数量」） */
      var _cpl = [];
      for (var _ck in (result.captives.byType || {})) {
        if (!result.captives.byType[_ck]) continue;
        _cpl.push((DATA.TROOPS[_ck] ? DATA.TROOPS[_ck].name : (_ck === 'unknown' ? '来历不明' : _ck))
          + ' ×' + U.fmt(result.captives.byType[_ck]));
      }
      lootLines.push('俘虏：' + U.fmt(result.captives.gain) + ' 众入营'
        + (_cpl.length ? '（' + _cpl.join('、') + '）' : '')
        + '　·　军务处·俘虏营可收编入军（费旧币 = 兵种造价的 50%）');
    }
    /* v63（老板）：野外城市每日限掠一次 —— 要么告诉玩家"本日额度已用尽"，
       要么他下次点掠夺被拦下来时会以为"功能坏了"。 */
    if (win && t.kind === 'fort' && mode.id === 'raid') {
      lootLines.push('备注：此据点今日已掠夺，**每日每处限一次**，明日可再来');
    }
    /* v27（需求 4）：战报正文**详细列出兵种损耗** ——
       原先只写"我军损失 3,412"一个总数，玩家无法判断是哪一兵种被打残了。 */
    var lossLines = [];
    var al = GAME.battle.troopLossText(result.atkStartBy, result.atkLossBy);
    var dl = GAME.battle.troopLossText(result.defStartBy, result.defLossBy);
    if (al) lossLines.push('我军 ' + al);
    if (dl) lossLines.push('敌军 ' + dl);
    var report = {
      t: U.now(), type: 'war',
      title: (win ? '胜利' : '战败') + ' · ' + mode.name + ' ' + t.name,
      body: GAME.battle.reportText(t.name, atkArmy, gen, result)
        + (result.duel && result.duel.done
          ? '<br>【斗将】' + result.duel.log.join('；') + '　·　' + result.duel.winnerName +
            ' 得势：其全军英雄属性 +' + Math.round((result.duel.bonusPct || 0.10) * 100) + '%（限本战）'
          : '')
        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')
        + (result.retreat ? '<br>【撤退】主动撤退：残部带回，民心未动（围攻进度保留）。' : '')
        + (result.siege ? '<br>【围攻】民心 −' + result.siege.chip + ' → 余 '
          + Math.round(result.siege.hold) + '%（第 '
          + result.siege.waves + ' 波' + (result.siege.broke ? ' · 民心已尽，城垣垂危' : ' · 守军退守内城') + '）' : '')
        + (lossLines.length ? '<br>【兵种损耗】' + lossLines.join('<br>') : '')
        /* 正文以 HTML 渲染（其余部分用 <br>），换行必须同格式 */
        + (lootLines.length ? '<br>【战利品】' + lootLines.join('；') : (win ? '<br>【战利品】无' : '')),
      loot: lootLines,
      win: win,
      /* 结构化的兵种损耗（战报详情里那张表直接用，不去解析正文） */
      loss: {
        atkStart: result.atkStartBy || {}, atkLoss: result.atkLossBy || {},
        defStart: result.defStartBy || {}, defLoss: result.defLossBy || {},
      },
      /* v27（需求 5）：战报存一份**精简**战斗场景 ——
         整个 roundsLog 带每支部队的每个动作，会让存档迅速膨胀；
         这里只留条带与逐回合兵力（≤16 帧）。 */
      scene: GAME.battle.compactScene(result),
      /* v89.94（B2 · E3）：分回合回放的关键帧（≤10 帧 + 关键帧标记；增量 <2KB/场） */
      replay: GAME.battle.replayFramesOf(result),
      /* v89.102（老板「固定沙盘 · 逐兵种逐帧」）：沙盘**配方** ——
         打开战报时用同一把引擎重跑，得到逐帧画面（每个兵种的移动/攻击各一帧）。
         存配方不存帧：≈2KB/场，且口径永远跟着引擎走。
         `_sim.history` = 观战路径的逐回合指令（即时结算的仗为 null）。 */
      sandbox: GAME.battle.sandboxRecipeOf(result, _sbArmy, _sbGen, scArmy, scVal, scGen, simOpts,
        { cmds: (opts._sim && opts._sim.history) || null,
          place: { kind: t.kind, terrain: t.terrain || null },
          boost: _boost }),
      /* v89.94（B2 · E3）：以少胜多 —— 以弱胜强的一仗才值得晒（出征=攻方视角） */
      underdog: GAME.battle.underdogOf(result, 'atk'),
      /* v89.94（B2 · E1）：围攻战果（据点/聚落才有）—— 列表与详情都要显示"还差多少" */
      siege: result.siege || null,
    };
    s.reports.unshift(report);
    /* v89.107：同上 —— 上限一处（DATA.REPORT_MAX），挤掉跳过收藏 */
    while (s.reports.length > (DATA.REPORT_MAX || 60)) {
      var _d2 = -1;
      for (var _r2 = s.reports.length - 1; _r2 >= 0; _r2--) {
        if (!s.reports[_r2].fav) { _d2 = _r2; break; }
      }
      if (_d2 < 0) break;
      s.reports.splice(_d2, 1);
    }
    /* v41（需求 4）：新战报 → 未读 +1，公文菜单图标开始闪黄（进公文页清零） */
    s.repUnread = (s.repUnread || 0) + 1;   /* v82：收编同段重复行（原先每份战报 +2） */
    return {
      ok: true, mode: mode.id, result: result, target: t, gains: gains,
      msg: (win
        ? ((siegeOut && !siegeOut.broke)
          ? '围攻得势：' + t.name + ' 民心余 ' + Math.round(siegeOut.hold) + '%（未下城）'
          : mode.name + '成功：' + t.name)
        : (mode.name + '失败：' + t.name)),
    };
  };

  /* 战后归队：幸存者按类型同比例回城；阵亡者按回收率折算为伤兵（另记兵种构成，治疗后再归队）
     ------------------------------------------------------------------
     此前**两条路径都没有归还**：
       · expedition 只做了 `GAME.city.armySub(city, (id: atkArmy[id]`，`result.atkRemain` 从未加回城市
         → 派 10 万、零损失打一场，回来城内是 0，每次出征都在凭空蒸发军队
       · applyWounded 只累加 `s.wounded` 这个数字，heal() 也只是把它清零
         → 「伤兵归队」是空话，治疗成了一笔没有任何回报的旧币消耗
     现在统一在这里归还，并记录伤兵的**兵种构成**（`s.woundedArmy`）。 */
  /* v89.63：新增可选的第 4 参 `backSink` —— 由调用方决定"活着的兵"去哪。
     出征「派遣」(station) 用它把幸存者直接送进野地驻军（而不是回城）；
     不传则完全维持旧行为（回城）。伤兵**始终回城**（要医治，不能扔在野外）。 */
  GAME.battle.returnArmy = function (city, sentArmy, result, backSink) {
    var s = GAME.state;
    var aStart = 0;
    for (var id in sentArmy) aStart += sentArmy[id];
    if (!city || !aStart) return { back: {}, wounded: {} };
    /* v89.114：幸存编制改走**唯一出口** `survivedArmyOf`（与掠夺搬运同一把尺）——
       原先这里另算一份 keep；两处算法各自演化，就会出现"搬货按 A、归队按 B"。
       归队与搬货的差别只在 rate（伤兵回收率）：归队把阵亡者的一部分折成伤兵。 */
    var surv = GAME.battle.survivedArmyOf(sentArmy, result);
    /* v89.186：率走**唯一出口**（base + 金蝉脱壳 + 商品 + 维修科技）——
       原实现四段散在此处、且商品是替换语义（详见 GAME.woundedRateOf 注释）。 */
    var rate = GAME.woundedRateOf(result);
    var back = {}, wounded = {}, wTotal = 0;
    for (var id2 in sentArmy) {
      var n = sentArmy[id2] || 0;
      if (n <= 0) continue;
      var alive = surv[id2] || 0;      /* v89.114：来自 survivedArmyOf（唯一出口） */
      var dead = n - alive;
      if (alive > 0) {
        back[id2] = alive;
        if (!backSink) GAME.city.armyAdd(city, { [id2]: alive });   /* 有 backSink 时目的地由调用方落地 */
      }
      var w = Math.floor(dead * rate);
      if (w > 0) { wounded[id2] = w; wTotal += w; }
    }
    if (wTotal > 0) {
      s.woundedArmy = s.woundedArmy || {};
      for (var id3 in wounded) s.woundedArmy[id3] = (s.woundedArmy[id3] || 0) + wounded[id3];
      s.wounded = (s.wounded || 0) + wTotal;
    }
    if (backSink && Object.keys(back).length) backSink(back);   /* 唯一出口：去哪由调用方说了算 */
    return { back: back, wounded: wounded };
  };

  /* 兼容旧接口：默认「占领」 */

  /* ============================================================
   * v89.186（老板 3）：据点剥离 —— **占据 = 野外建筑 + 归属**（不再就地转城市）
   * ------------------------------------------------------------
   * 沿革：v89.103 曾"拔除 = 就地转为我方一座城"（建筑转正 + 幸存者归附 + 占城市名额）；
   * 老板拍板改为：**不转城市** —— 占据后作为"我方前哨"（野外建筑）提供 buff：
   *   #1 前哨效应（覆盖内野地衰减减半）· #2 采集增产 · #3 兵站（驻军上限 +50%）
   *   · #5 情报站（守军/守将情报确凿）· #6 商旅税所（每游戏日商税）。
   * 顺带解决 v89.108 的既有矛盾（"据点转正占城名额"让扩张玩家两难）——**不占名额**。
   * 旧档：已转正的据点城**不追溯**（保留为城市）；本函数只服务新占据。
   * 数据：`s.forts['x,y'] = { x, y, lv, name, day, cityId }`（随档；v89.193 起含
   *   cityId = **占据时的出发城** —— "每城最多 5 处"的归属口径）；`fortsTaken` 照写
   *   （地图"该格不再生成据点"的既有读点不变）。
   * v89.193（老板 2）：「设置同附属野地，每城最多 5 个」+「等级不同的前哨辐射范围和
   *   效果不同」—— 超限**不设哨**（战利品照收；两层防线：据点面板受阻提示 →
   *   这里结算兜底）；半径/效果随等级（DATA.FORT_AURA.tiers，走 GAME.fortEffectOf 唯一出口）。
   * 返回 { ok, fort, rep, lv }；超限 { ok:false, full:true }：调用方据此写"收为我方前哨"。
   * ============================================================ */
  GAME.claimFort = function (t, gen, fromCity, result) {
    var s = GAME.state;
    if (!t || t.kind !== 'fort' || !t.fort) return { ok: false, msg: '不是野外城市' };
    var f = t.fort;
    /* v91.74：据点按 (pid, ci) 定位 —— ci 只在星球内唯一。 */
    var _fpid = (t.pid != null) ? t.pid : (f.pid != null ? f.pid : GAME.curPid());
    var _fSP = GAME.sphereOf(_fpid);
    /* v90.100：fort 对象缺 ci 时由 (x,y) 派生（兼容旧夹具）。 */
    if ((f.ci == null || f.ci < 0) && f.x != null && _fSP && _fSP.ciOfXY) f.ci = _fSP.ciOfXY(f.x, f.y);
    var lv = Math.max(1, f.level || 1);
    var A = DATA.FORT_AURA || {};
    var forts = GAME.fortsOf();
    var key = GAME.fortKey(f.ci, _fpid);
    /* v89.193：归属 = 出发城；超限分支 —— 本格照常记"已拔除"（不再刷据点）、
       不登记前哨（战利品已在 result 里照收）。 */
    var own193 = (fromCity && (s.cities || []).some(function (c) { return c.id === fromCity.id; })) ? fromCity : null;
    var max193 = A.maxPerCity == null ? 5 : A.maxPerCity;
    if (own193 && GAME.fortsOfCity(own193).length >= max193) {
      if (GAME.map.markFortTaken) GAME.map.markFortTaken(f.ci, key, _fpid);
      if (GAME.map.razeFort) GAME.map.razeFort(f.ci, _fpid);
      GAME.log.war('🚩 拔除 ' + f.name + '（野外城市 Lv' + lv + '）—— 但「' + own193.name
        + '」的前哨已满（' + max193 + ' 处），**未能设哨**（战利品照收；可先放手一处，或从其他城市出征）');
      return { ok: false, full: true,
        msg: f.name + ' 已拔除，但本城前哨已满（' + max193 + ' 处）—— 未能设哨' };
    }
    var _fc = (_fSP && _fSP.cells) ? _fSP.cells[f.ci] : null;
    var rec = forts[key] = forts[key] || {
      pid: _fpid,
      ci: f.ci, lon: f.lon != null ? f.lon : (_fc ? _fc.lon : null), lat: f.lat != null ? f.lat : (_fc ? _fc.lat : null),
      /* x/y：渲染缓存（由 ci 派生；x/y 不再作身份） */
      x: _fc ? _fc.x : null, y: _fc ? _fc.y : null,
      day: GAME.questDayIndex ? GAME.questDayIndex() : 0 };
    rec.lv = lv; rec.name = f.name;
    rec.cityId = own193 ? own193.id : (rec.cityId || null);   /* v89.193：归属城（老档迁移兜底） */
    var fx193 = GAME.fortEffectOf(rec);                       /* v89.193：半径/文案与覆盖同源（按等级） */
    var RR = fx193.radius;
    if (GAME.map.markFortTaken) GAME.map.markFortTaken(f.ci, key, _fpid);
    if (GAME.map.razeFort) GAME.map.razeFort(f.ci, _fpid);    /* 当日标记：今日不再出现 */
    /* v89.195（老板 1）：「前哨可放手」—— 记录**占据前的地形**（terrain0），
       放手时恢复（GAME.abandonFort 唯一出口）。`rec.terrain0 ||` 保证只记最早那一次。 */
    /* 据点仍占该格（视觉可见）：地形由 sphere 供，无需平面 tile 标记 */
    GAME.statBump('forts', 1);
    /* ⛔ v90.93：STORY.repMult（年号国策）随年号纪元退役。 */
    var repF = Math.round(20 + lv * 5);
    s.rep = (s.rep || 0) + repF;
    GAME.log.war('🚩 拔除 ' + f.name + '（野外城市 Lv' + lv + '）—— 收为**我方前哨**（声望 +' + repF + '）：'
      + '周边 ' + RR + ' 格内野地：衰减减半 · 采集×' + fx193.gatherMul + ' · 驻军上限 ×'
      + fx193.garrisonCapMul + ' · ' + (fx193.intelFull ? '情报确凿' : '情报半明') + '，商税 '
      + fx193.tax + ' 旧币/现实日');
    return { ok: true, fort: rec, rep: repF, lv: lv,
      msg: f.name + ' 已为我方前哨（周边 ' + RR + ' 格野地受益 · 商税 ' + fx193.tax + ' 旧币/日 · 不占城市名额）' };
  };

  /* --------- 经验升级（真实公式：等级²×100） --------- */
  GAME.checkLevelUp = function (gen) {
    var need = GAME.expNeedOf(gen);
    var step = 0, from = gen.level;
    /* v29（需求 2）：**资质决定等级上限**（凡人 60 / 突变体 100 / 进化体 140 /
       觉醒体 180 / 天启体 240）。到顶后经验继续累积但不再升级 ——
       不扣经验，玩家换一个高资质的将或喂丹药仍有意义。 */
    var capLv = (GAME.genLevelCap ? GAME.genLevelCap(gen) : 999);
    while (gen.exp >= need && gen.level < capLv) {
      gen.exp -= need;
      gen.level += 1;
      step = GAME.applyLevelGrowth(gen);   // 资质决定每级成长（凡人+1 … 天启体+8）
      need = GAME.expNeedOf(gen);
      GAME.log.sys('⭐ 英雄 ' + gen.name + ' 升至 Lv' + gen.level +
        '（自动加点 +' + step + ' · 自由点 +' + step + '）');
    }
    /* v89.159（老板 1）：「升级时英雄刷新状态，恢复所有体力、精力」——
       英雄**自身升级**（战斗/侦察/练功/经验道具…凡经 gainExp 的路径）即回满
       体力与精力、状态焕然一新。写在本函数 = **升级的唯一出口**：
       不在各调用点各写一遍 —— 否则又会出现"某条路升级不回满"
       （同 v89.151「打包点漏字段」的教训）。多级连升只回一次（幂等）。 */
    if (gen.level > from) {
      if (GAME.setStaNow) GAME.setStaNow(gen, GAME.staMax(gen));
      if (GAME.setEnergyNow) GAME.setEnergyNow(gen, GAME.energyMaxOf(gen));
      GAME.log.sys('✨ ' + gen.name + ' 升级刷新：体力 ' + Math.round(GAME.staNow(gen)) + '/'
        + Math.round(GAME.staMax(gen)) + ' · 精力 ' + Math.round(GAME.energyNowOf(gen)) + '/'
        + Math.round(GAME.energyMaxOf(gen)) + '（已回满）');
    }
    var capped = gen.level >= capLv;
    if (capped && from < capLv) {
      /* v91.57：君主修行退役 —— 君主与普通英雄同走"资质上限"文案。 */
      GAME.log.sys('🔒 ' + gen.name + ' 已达资质上限 Lv' + capLv
        + '（' + (GAME.rankOf(gen).name) + '），再多的经验也无法提升');
    }
    return { from: from, to: gen.level, up: gen.level - from, step: step, capped: capped, cap: capLv };
  };

  /* 获取经验的**唯一入口**（v26 · 需求 1）
     ------------------------------------------------------------
     原先三处战斗/侦察各自 `gen.exp += x` 后直接调 checkLevelUp，
     好处是短，坏处是：① 公式散落；② 玩家看不到自己涨了多少经验。
     现在统一从这里进，并把「+N 经验（当前/所需）」写进公文，
     让经验从"背后悄悄涨的数字"变成看得见、可操作的东西。 */
  GAME.battle.gainExp = function (gen, amount, why) {
    amount = Math.max(0, Math.round(amount || 0));
    /* v79：演算图谱 —— 英雄经验 +6%/级（唯一消费口） */
    if (amount > 0 && GAME.artifactBonusNum) {
      amount = Math.round(amount * (1 + GAME.artifactBonusNum('genExpPct')));
    }
    if (!gen || amount <= 0) return null;
    gen.exp = (gen.exp || 0) + amount;
    var r = GAME.checkLevelUp(gen);
    if (r && r.up && GAME.sfx) GAME.sfx('levelup');   /* v89.93（E4）：升级音 */
    var need = GAME.expNeedOf(gen);
    GAME.log.sys('📗 ' + gen.name + ' 经验 +' + U.numText(amount, 0)
      + (why ? '（' + why + '）' : '')
      + '　当前 Lv' + gen.level + ' ' + U.numText(gen.exp, 0) + ' / ' + U.numText(need, 0));
    return { gain: amount, level: gen.level, up: r.up, exp: gen.exp, need: need, from: r.from };
  };

  /* 兵种损耗文本（v27 · 需求 4）：兵种 初始 → 剩余（损 N） */
  GAME.battle.troopLossText = function (startBy, lossBy) {
    var parts = [];
    Object.keys(lossBy || {}).forEach(function (id) {
      var t = DATA.TROOPS[id];
      var st = (startBy || {})[id] || 0, lost = lossBy[id] || 0;
      if (lost <= 0) return;
      parts.push((t ? t.name : id) + ' ' + U.numText(st, 0) + ' → ' + U.numText(st - lost, 0)
        + '（损 ' + U.numText(lost, 0) + '）');
    });
    return parts.join('　');
  };

  /* ============================================================
   * v89.94（B2 · E3）：战报回放的数据侧 —— 战力口径 / 以少胜多 / 关键帧
   * ------------------------------------------------------------
   * · armyPowerOf：兵种构成 → 战力（走 STORY.troopPower 唯一出口，与来袭/家底同一把尺）；
   * · underdogOf：以弱胜强（我方战力 < 守方战力×0.8 且赢）；
   * · replayFramesOf：从 roundsLog 抽 ≤maxFrames 帧（首 2 + 尾 2 + 首杀/破塔/折半/最烈），
   *   每帧带条带与一行事件（截断到 maxEv 字），并给关键帧标记。
   *   验收线：战报增量 < 2KB/场（probe 实测钉住）。
   * ============================================================ */
  GAME.battle.armyPowerOf = function (by) {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var n = 0;
    for (var k in (by || {})) {
      n += (by[k] || 0) * (tp ? tp(k) : ((DATA.TROOPS[k] || {}).power || 1));
    }
    return Math.round(n);
  };
  GAME.battle.underdogOf = function (r, mySide) {
    /* v89.179b·P2-8：加显式视角参数（§17.2 同函数被两视角调用必须显式传参）。
       不传 mySide → 默认攻方（与旧行为一致，向后兼容）。 */
    if (!r) return false;
    var iAmDef = (mySide === 'def');
    var meWin = iAmDef ? (r.winner === 'def') : (r.winner === 'atk');
    if (!meWin) return false;
    var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
    var myRaw = GAME.battle.armyPowerOf(iAmDef ? r.defStartBy : r.atkStartBy);
    var foeRaw = GAME.battle.armyPowerOf(iAmDef ? r.atkStartBy : r.defStartBy);
    /* 守方加成（城防/箭塔）只作用于"守方"一侧：攻视角下敌(守)吃它，守视角下我吃它 */
    var myEff = myRaw * (1 + ((iAmDef ? (r.defBonusEff || 0) : 0) / div));
    var foeEff = foeRaw * (1 + ((iAmDef ? 0 : (r.defBonusEff || 0)) / div));
    return foeEff > 0 && myEff > 0 && myEff < foeEff * 0.8;
  };
  /* ============================================================
   * v89.157（老板「逐回合文字复盘」）：**逐回合文字**的唯一出口
   * ------------------------------------------------------------
   * 与关键帧摘要（replayFramesOf 的 ev 字段）**同源** —— 回合事件的措辞只在这里定义
   * （改措辞只改一处）；`roundLinesOf` 把每回合拼成一行，供战报正文的
   * 「逐回合文字复盘」入口消费（旧档没有 roundsLog 的战报返回空数组）。
   * ============================================================ */
  GAME.battle.evTextOf = function (rr, maxEv) {
    var parts = [], hostOf = {};
    /* v89.119（老板「反击应该在敌方出手后…反击和对方出手记录在同一行」）：
       反击并入**引发它的那次出手**同一段，口径与回合记录/战报纪要一致
       （唯一配对规则：counter.targetId === 该出手的 id，且阵营相反）。 */
    (rr.events || []).forEach(function (e) {
      if (parts.length >= 3) return;
      if (e.kind === 'attack') {
        parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '→' + (e.target || '')
          + ' 杀 ' + U.numText(e.kill || 0, 0));
        if (e.id != null) hostOf[(e.side === 'atk' ? 'a' : 'd') + '|' + e.id] = parts.length - 1;
      } else if (e.kind === 'counter') {
        var hk = (e.side === 'atk' ? 'd' : 'a') + '|' + e.targetId;
        var hi = hostOf[hk];
        /* v89.136（老板 3）：同口径 —— 按反击者阵营给词（'对方'→'我方/敌方'） */
        if (hi != null) parts[hi] += '（' + (e.side === 'atk' ? '我方' : '敌方') + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0) + '）';
        else parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0));
      } else if (e.kind === 'tower') {
        parts.push('破塔 ' + (e.destroy || 0) + ' 座（余 ' + (e.left || 0) + '）');
      } else if (e.kind === 'wall') {
        parts.push('城头→' + (e.target || '') + ' 杀 ' + U.numText(e.kill || 0, 0));
      }
    });
    var s0 = parts.join('；');
    if (s0.length > maxEv) s0 = s0.slice(0, maxEv - 1) + '…';
    return s0;

  };

  /* 逐回合一行：`第N回合（我 X · 敌 Y）：我步行机→自走火炮 杀 120；…`
     —— 兵力读回合记录（rr.a / rr.d = 双方当时兵力）；没有事件的回合写「（无交火）」。 */
  GAME.battle.roundLinesOf = function (r) {
    if (!r || !r.roundsLog || !r.roundsLog.length) return [];
    var maxEv = (DATA.REPLAY && DATA.REPLAY.maxEv) || 56;
    return r.roundsLog.map(function (rr) {
      var ev = GAME.battle.evTextOf(rr, maxEv);
      var tail = [];
      if (rr.a != null) tail.push('我 ' + U.numText(rr.a, 0));
      if (rr.d != null) tail.push('敌 ' + U.numText(rr.d, 0));
      return '第' + (rr.r != null ? rr.r : '?') + '回合' +
        (tail.length ? '（' + tail.join(' · ') + '）' : '') + '：' + (ev || '（无交火）');
    });
  };

  GAME.battle.replayFramesOf = function (r) {
    var cfg = DATA.REPLAY || {};
    var maxFrames = cfg.maxFrames || 10, maxEv = cfg.maxEv || 56;
    if (!r || r.engine !== 'tactic' || !r.roundsLog || !r.roundsLog.length) return null;
    var log = r.roundsLog, strips = r.strips || [], n = log.length;
    /* v89.157：事件措辞抽到唯一出口 evTextOf（与战报「逐回合文字复盘」同源） */
    var evLine = function (rr) { return GAME.battle.evTextOf(rr, maxEv); };
    var a0 = (log[0] && log[0].a) || 0, d0 = (log[0] && log[0].d) || 0;
    var picks = {};
    [0, 1, n - 2, n - 1].forEach(function (i) { if (i >= 0 && i < n) picks[i] = true; });
    var firstKill = -1, firstTower = -1, halfA = -1, halfD = -1, maxKill = 0, maxIdx = -1;
    log.forEach(function (rr, i) {
      var k = 0;
      (rr.events || []).forEach(function (e) {
        if (e.kill) k += e.kill;
        if (firstKill < 0 && (e.kill || 0) > 0) firstKill = i;
        if (firstTower < 0 && e.kind === 'tower') firstTower = i;
      });
      if (k > maxKill) { maxKill = k; maxIdx = i; }
      if (halfA < 0 && a0 > 0 && rr.a <= a0 * 0.5) halfA = i;
      if (halfD < 0 && d0 > 0 && rr.d <= d0 * 0.5) halfD = i;
    });
    [firstKill, firstTower, maxIdx].forEach(function (i) { if (i >= 0) picks[i] = true; });
    [halfA, halfD].forEach(function (i) { if (i >= 0) picks[i] = true; });
    var idx = Object.keys(picks).map(Number).sort(function (x, y) { return x - y; });
    while (idx.length > maxFrames) idx.splice(idx.length - 2, 1);      /* 优先保首尾 */
    var frames = idx.map(function (i) {
      var rr = log[i];
      return { r: rr.r, a: rr.a, d: rr.d, gap: rr.gap, s: strips[i] || '', ev: evLine(rr) };
    });
    var key = [];
    if (firstKill >= 0) key.push({ r: log[firstKill].r, tag: 'first', text: '初次接敌' });
    if (firstTower >= 0) key.push({ r: log[firstTower].r, tag: 'tower', text: '攻破箭塔' });
    if (halfD >= 0) key.push({ r: log[halfD].r, tag: 'half', text: '敌军折半' });
    if (halfA >= 0) key.push({ r: log[halfA].r, tag: 'lost', text: '我军折半' });
    if (maxIdx >= 0) key.push({ r: log[maxIdx].r, tag: 'hot', text: '最烈一回合' });
    key.push({ r: log[n - 1].r, tag: 'final',
      text: r.retreat ? '主动撤退' : (r.winner === 'atk' ? '得胜' : '力尽') });
    return { field: r.field, rounds: n, frames: frames, key: key, retreat: !!r.retreat };
  };

  /* ============================================================
   * v89.102（老板「固定沙盘 · 逐兵种逐帧」）：战报沙盘 —— 数据侧
   * ------------------------------------------------------------
   * 存储策略：**存配方，不存帧**。
   *   · 引擎完全确定（tactic.js 头注：同样输入必得同样结果）——
   *     沙盘打开时用同一把引擎、同一组输入重跑，得到的就是那一仗的
   *     逐帧画面（每个兵种的移动 / 攻击各一帧）；
   *   · 配方 ≈ 2KB/场，比"存全量帧"（5~20KB/场）省一个数量级，
   *     而且口径永远跟着引擎走（引擎一改，画面自动同步，不会留下
   *     "用旧公式画出来的历史帧"）；
   *   · `init` 必须一并存：重跑时以 `opts.stances` 原样覆盖双方动作/目标，
   *     否则玩家事后改了出征战术，同一份战报会跑出另一场仗。
   * 校验：重跑结果与战报记下的回合数 / 双方损失逐项相等才算"忠实"；
   *   不相等（战后又升了科技，全局加成已变）→ 沙盘退回关键帧回放并在
   *   标题栏写明原因 —— 宁可说清"看不了逐帧"，也不给一幅假画面。
   * ============================================================ */
  GAME.battle.SANDBOX_KIND = { move: 'm', retreat: 'r', attack: 'a', counter: 'c', tower: 't', wall: 'w' };

  /* ============================================================
   * v89.118（600×30h 试玩）：「战斗加成快照」—— 沙盘保真度的根因修复
   * ------------------------------------------------------------
   * 引擎在结算/重跑时读**全局**加成：`systems.techBonus`（科技）、
   * `STORY.combatMod()`（天时 weather）、`STORY.atkMult/siegeMult/
   * cityDefMult`（羁绊）、`state.buffs`（战鼓 buff）。这些在 30 小时里都会漂移 ——
   * 于是**重跑读"现在"、史实读"那一刻"**，verify 必然出现假不一致（实测 23 场）。
   *
   * 口径（沿用 v89.102 的教训"配方必须与开打那一刻逐字节一致"）：
   *   · boostSnapshot() 在**开打那一刻**采集（纯数据小快照）；
   *   · withBoost() 在结算/重跑期间把它临时装回全局读点，用完**逐项还原**；
   *   · 快照随配方与挂起会话走（rc.boost / _sim.boost）——
   *     史实结算、挂起重放、沙盘重跑三者同源。
   * 采集清单 = 引擎侧全部全局读点（tactic.js 里的 TB/combatMod/atkMult/siegeMult/
   * buffActive 与 state.buffs）—— 新增读点时要往这里补一项，别只改一边。
   * ============================================================ */
  GAME.battle.boostSnapshot = function (city) {
    var st = GAME.state || {}, S = GAME.story || {};
    try {
      return {
        /* v89.191（老板 3-④）：科技快照 = **那一战那座城**的表
           （出征 = 出发城 / 守城 = 被攻城；无城 → 空表，纯 NPC 场景不吃科技）——
           与 v89.118 同一机制，只是内容从"全境表"换成"该城表"，史实与重跑依旧同源。 */
        techs: U.deep((city && city.techs) || {}),   /* → systems.techBonus（TB 全部 type） */
        world: U.deep(st.world || {}),            /* → STORY.combatMod（天时，由 world 推导） */
        buffs: U.deep(st.buffs || {}),            /* → systems.buffActive + st.buffs.military */
        atkMult: (S.atkMult ? S.atkMult() : 1),   /* 羁绊「攻」（v90.93：年号 atkEra 已随年号纪元退役） */
        siegeMult: (S.siegeMult ? S.siegeMult() : 1),
        cityDefMult: (S.cityDefMult ? S.cityDefMult() : 1),
        defAdd: (S.defMult ? S.defMult() : 0),    /* 羁绊「守御」（战役层也读） */
      };
    } catch (e) { return null; }
  };
  /* 把快照装回全局读点跑 fn，然后逐项还原。bs 为空 → 直接跑（旧档 / 无快照的仗）。 */
  GAME.battle.withBoost = function (bs, fn) {
    if (!fn) return null;
    if (!bs) return fn();
    var st = GAME.state, S = GAME.story, Sys = GAME.systems;
    if (!st || !S) return fn();
    var bak = {
      techCtx: Sys ? Sys._techCtx : null, world: st.world, buffs: st.buffs,
      atkMult: S.atkMult, siegeMult: S.siegeMult, cityDefMult: S.cityDefMult, defMult: S.defMult,
    };
    try {
      /* v89.191：科技快照装进 systems 的**读点上下文**（`st.techs` 已随按城改造退役 ——
         快照里的 techs 现在就是"那一战那座城"的表）。 */
      if (Sys && bs.techs) Sys._techCtx = bs.techs;
      if (bs.world) st.world = bs.world;
      st.buffs = bs.buffs || {};
      if (bs.atkMult != null) S.atkMult = function () { return bs.atkMult; };
      if (bs.siegeMult != null) S.siegeMult = function () { return bs.siegeMult; };
      if (bs.cityDefMult != null) S.cityDefMult = function () { return bs.cityDefMult; };
      if (bs.defAdd != null) S.defMult = function () { return bs.defAdd; };
      return fn();
    } finally {
      if (Sys) Sys._techCtx = bak.techCtx;
      st.world = bak.world; st.buffs = bak.buffs;
      S.atkMult = bak.atkMult; S.siegeMult = bak.siegeMult;
      S.cityDefMult = bak.cityDefMult; S.defMult = bak.defMult;
    }
  };

  GAME.battle.sandboxRecipeOf = function (r, atkArmy, gen, scArmy, scVal, scGen, simOpts, extra) {
    if (!r || r.engine !== 'tactic' || !r.unitsInit) return null;
    extra = extra || {};
    /* 阵位只留"动作 + 目标"两个字段：行位（adv）是动作的函数，引擎自己会算 */
    function brief(list) {
      return (list || []).map(function (u) { return { id: u.id, s: u.stance || 'advance', t: u.target || '' }; });
    }
    return {
      atkArmy: U.deep(atkArmy || {}),
      gen: gen ? U.deep(gen) : null,
      scArmy: U.deep(scArmy || {}),
      scVal: scVal || 0,
      scGen: scGen ? U.deep(scGen) : null,
      simOpts: U.deep(simOpts || {}),
      init: { atk: brief(r.unitsInit.atk), def: brief(r.unitsInit.def) },
      /* v89.102：**逐回合指令快照**（观战路径才有）——
         玩家在战场上逐回合改动作/目标的那种仗，重跑必须按 history 重放，
         否则重跑用的还是"初始阵位"，校验必然不过（那是"少了指令"，
         不是"科技变了"）。没有 history（即时结算的仗）→ 恒用初始阵位。 */
      cmds: (extra.cmds && extra.cmds.length) ? U.deep(extra.cmds) : null,
      /* 沙盘底图用：目标的地形/种类（纯画面，不参与任何结算） */
      place: extra.place || null,
      /* v89.116（老板「守城的战报沙盘应当通用掠夺战斗的沙盘，并增加右侧（我方守城）
         的围墙示意」）：**视角** —— 沙盘画面上"哪一边是我"。
         'atk'（默认）= 我攻敌守（出征口径）；'def' = 我守敌攻（来袭口径）：
         界面据此把标签、可操作侧、围墙位置整个反过来。
         `wall`：围墙示意（等级 + 箭塔数），只有守城仗才有。 */
      ourSide: (extra.ourSide === 'def') ? 'def' : 'atk',
      wall: extra.wall || null,
      /* v89.118：**战斗加成快照**（开打那一刻的科技/天时/羁绊/战鼓）——
         重跑靠它把全局读点装回史实那一刻（否则 30h 后重跑必然 verify=false）。 */
      boost: extra.boost || null,
      /* 史实结果（校验沙盘忠实度的锚点，不参与画面） */
      /* v89.185b：`retreat` 标志随配方走 —— 史实"主动撤退"（智能保兵 v89.176 / 手动）
         是"提前结束"的动作，重跑必须对齐（见 _sandboxBuild 的 stopAfter），
         否则重跑一路打到回合上限、verify 必 false（智能托管默认开 → 所有智能战报中招）。 */
      result: { rounds: r.rounds, atkLoss: r.atkLoss, defLoss: r.defLoss, retreat: !!r.retreat },
    };
  };

  /* 由战报重建沙盘。
     返回 null = 这份战报没有（或无法建立）沙盘 —— 上层退回关键帧回放。
     { field, rounds, maxRounds, ids[], init, frames[], per[], towers, verify, hist, sim,
       kinds: {动作字符 → 中文} } */
  GAME.battle.sandboxOf = function (rep) {
    var rc = rep && rep.sandbox;
    if (!rc || !GAME.tactic || !GAME.tactic.begin) return null;
    /* v89.118：重跑期间把**史实那一刻的加成快照**装回全局读点 —— 否则读的是"现在"
       的科技/天时/羁绊/战鼓，与史实不同源（30h 试玩实测 23 场假不一致）。 */
    return GAME.battle.withBoost(rc.boost || null, function () {
      return GAME.battle._sandboxBuild(rc);
    });
  };
  /* 沙盘构建本体（在 withBoost 的加成快照内执行；逻辑与 v89.102 逐字相同） */
  GAME.battle._sandboxBuild = function (rc) {
    /* 快照缺失 / 空阵 → 没有沙盘（不许拿"0 回合 0 损失"当通过：那是假绿，
       真机踩过 —— `returnArmy` 清零后的 atkArmy 被写进配方）。 */
    if (GAME.battle.marchMenOf(rc.atkArmy) <= 0) return null;
    /* 快照缺失 / 空阵 → 没有沙盘（不许拿"0 回合 0 损失"当通过：那是假绿，
       真机踩过 —— `returnArmy` 清零后的 atkArmy 被写进配方）。 */
    if (GAME.battle.marchMenOf(rc.atkArmy) <= 0) return null;
    var K = GAME.battle.SANDBOX_KIND;
    var ids = [], idIdx = {};
    function iid(s) {
      if (!s) return -1;
      if (!(s in idIdx)) { idIdx[s] = ids.length; ids.push(s); }
      return idIdx[s];
    }
    var stances = { atk: {}, def: {} };
    (((rc.init || {}).atk) || []).forEach(function (u) { stances.atk[u.id] = { s: u.s, t: u.t }; });
    (((rc.init || {}).def) || []).forEach(function (u) { stances.def[u.id] = { s: u.s, t: u.t }; });
    var opts = U.deep(rc.simOpts || {});
    opts.stances = stances;
    var env;
    try {
      env = GAME.tactic.begin(rc.atkArmy || {}, rc.gen || null, rc.scArmy || {}, rc.scVal || 0,
        rc.scGen || null, opts);
    } catch (e) { return null; }
    var init = env.snap();
    /* v89.102：逐回合指令重放（与 `_makeEnv` 同一手法 —— 观战路径的史实指令） */
    var cmds = rc.cmds || null;
    /* v89.185b：史实为**主动撤退**（result.retreat）→ 重跑到同一回合数（result.rounds）即停 ——
       对齐"这场仗是被提前结束的"，否则重跑打满上限、与史实两回事（verify 必 false）。 */
    var stopAfter = ((rc.result || {}).retreat) ? (((rc.result || {}).rounds) || 0) : 0;
    var frames = [], per = [], guard = 0;
    while (!env.over && guard++ < (GAME.tactic.MAX_ROUNDS || 30) + 5) {
      if (stopAfter && per.length >= stopAfter) break;
      var _ci = per.length;
      if (cmds && cmds[_ci]) {
        for (var _tid in cmds[_ci]) env.setCmd('atk', _tid, cmds[_ci][_tid]);
      }
      var st = env.step();
      if (!st) break;
      per.push([st.r, st.a, st.d, st.gap]);
      (st.events || []).forEach(function (e) {
        var tgt = e.targetId || '';
        if (e.kind === 'wall' && e.hits && e.hits[0]) tgt = e.hits[0].id;
        frames.push([
          st.r || 0,
          e.side === 'atk' ? 0 : 1,
          iid(e.id || ''),
          K[e.kind] || '?',
          iid(tgt),
          Math.round(e.step || e.kill || e.destroy || 0),
          Math.round(e.kind === 'tower' ? (e.left || 0) : (e.gap || 0)),
        ]);
      });
    }
    var fin = env.finish();
    /* 一帧都没有 = 重跑没跑起来（空阵/输入不全）→ 没有沙盘，别给"空画面" */
    if (!frames.length) return null;
    var aL = 0, dL = 0, k;
    for (k in (fin.atkLossBy || {})) aL += fin.atkLossBy[k];
    for (k in (fin.defLossBy || {})) dL += fin.defLossBy[k];
    var hist = rc.result || null;
    /* ⚠️ 必须要求双方回合数 ≥1：`0 === 0` 会让空阵"校验通过"（真机踩过，见上手注释） */
    var verify = !!hist && hist.rounds >= 1 && fin.rounds >= 1
      && fin.rounds === hist.rounds && aL === hist.atkLoss && dL === hist.defLoss;
    return {
      field: init.field || 1, rounds: per.length, maxRounds: init.maxRounds || (GAME.tactic.MAX_ROUNDS || 30),
      ids: ids, init: init, frames: frames, per: per,
      towers: init.towers ? init.towers.start : 0,
      /* v89.116：视角 / 围墙 / 地形随配方带出 ——
         ⚠️ `place` 此前**从没被携带过**（配方里存了，返回时丢了）：
            界面 `sdFieldHTML` 读 `sb.place` 取野地地形贴图，于是那张贴图一直没生效。 */
      ourSide: (rc.ourSide === 'def') ? 'def' : 'atk',
      wall: rc.wall || null,
      place: rc.place || null,
      verify: verify,
      hist: hist, sim: { rounds: fin.rounds, atkLoss: aL, defLoss: dL, winner: fin.winner },
      kinds: K,
    };
  };

  /* 精简战斗场景（供战报存档与详情面板）：条带 ≤16 帧 + 逐回合兵力 */
  GAME.battle.compactScene = function (r) {
    if (!r || r.engine !== 'tactic' || !r.strips || !r.strips.length) return null;
    var n = r.strips.length, idx = [];
    for (var i = 0; i < n; i++) if (i < 14 || i >= n - 2) idx.push(i);
    return {
      field: r.field, rounds: r.rounds,
      rows: idx.map(function (i) {
        var rr = r.roundsLog[i];
        return { r: i + 1, a: rr.a, d: rr.d, gap: rr.gap, s: r.strips[i] };
      }),
      roundsText: r.log,
    };
  };

  GAME.battle.reportText = function (cityName, atkArmy, gen, result) {
    var line1 = '【' + cityName + '】攻城' + (result.winner === 'atk' ? '胜利' : '失败') + '。';
    var line2 = '远征英雄：' + (gen ? gen.name : '无') + '。战斗持续 ' + result.rounds + ' 回合。';
    var line3 = '我军损失 ' + result.atkLoss + '，剩余 ' + result.atkRemain + '；敌军损失 ' + result.defLoss + '，剩余 ' + result.defRemain + '。';
    var line4 = '';
    /* v26（需求 1）：经验写进战报正文 —— 这是玩家唯一会认真看战报的地方。
       v55：经验改按"歼灭资源量"折算后，必须把**单场封顶**说明白，
       否则玩家会以为算错了（打大城反而只拿一点点）。
       v56（老板：胜方才有经验）：败方也要写明"未获经验"——
       原版败方是拿一半的，不写一句会被当成 bug。 */
    if (result.expInfo && gen) {
      var ei = result.expInfo;
      line4 = '<br>经验：' + gen.name + ' +' + U.numText(ei.gain, 0)
        /* v83（老板）：「形成经验惩罚机制」——越级打野地要把打折原因写明白，
           否则玩家会以为经验算漏了（与"单场封顶"同一原则）。 */
        + (result.expPenalty
          ? '<span style="color:var(--text-dim);">（越级惩罚 ×' + Number(result.expPenalty.mul).toFixed(2)
            + '：Lv' + gen.level + ' 宜打 ' + result.expPenalty.need + ' 级野地）</span>'
          : (result.expCapped
            ? '<span style="color:var(--text-dim);">（歼灭 ' + U.numText(result.expRaw || 0, 0)
              + '，已达单场上限 ' + U.numText(ei.gain, 0) + '）</span>'
            : (result.defValue
              /* v89.89（A3 · 100+ 轮实玩期待）：口径就地解释 —— 悬停「歼敌值」看折算规则
                 （100+ 轮实玩实测："歼敌值 3,120 资源"口径费解）。 */
              ? '<span style="color:var(--text-dim);">（<span style="cursor:help;" '
                + 'title="歼敌值 = 按歼灭敌军的资源造价折算（与英雄经验同一口径）">歼敌值</span> '
                + U.numText(result.defValue, 0) + ' 资源）</span>' : '')))
        + '　Lv' + ei.level + '（' + U.numText(ei.exp, 0) + ' / ' + U.numText(ei.need, 0) + '）'
        + (ei.up > 0 ? '　<b style="color:var(--gold-light);">连升 ' + ei.up + ' 级！</b>' : '');
    } else if (result.expNone && gen) {
      line4 = '<br><span style="color:var(--text-dim);">战败无功，未获经验。</span>';
    }
    /* v89.149（老板 1）：战功声望也写进战报正文 —— 与经验同一位置、同一原则
       （"玩家唯一会认真看战报的地方"）；口径用悬停解释，不占正文篇幅。 */
    var line5 = '';
    if (result.repGain && result.repGain.gain > 0) {
      var rg = result.repGain;
      var _R149 = DATA.REP_RULE || {};
      line5 = '<br><span style="cursor:help;" title="声望 = 歼灭军力 ÷ '
        + U.numText(_R149.perPower || 30000, 0)
        + ' × 兵力对比系数（平方根，'
        + (_R149.coefLo == null ? 0.4 : _R149.coefLo) + '~'
        + (_R149.coefHi == null ? 2 : _R149.coefHi)
        + ' 夹取）">声望</span> +' + U.numText(rg.gain, 0)
        + '<span style="color:var(--text-dim);">（歼灭军力 ' + U.numText(rg.lost, 0)
        + ' · 兵比 ' + rg.ratio.toFixed(2) + ' ×' + rg.coef.toFixed(2)
        + (rg.capped ? ' · 单场封顶' : '') + '）</span>';
    }
    return line1 + '<br>' + line2 + '<br>' + line3 + line4 + line5;
  };

  /* v60（需求 4）： 已删 —— 战报正文自己拼 lootLines，
     而资源中文名已收口到 GAME.resName。留着一个没人调的函数就是死函数（audit 报过）。 */
  /* ============================================================
   * 行军队列（v18）
   * 出征不再瞬间抵达：按「距离 ÷ 兵种速度」算出行军时长，抵达时才结算。
   * 于是这些东西第一次真正有了意义：
   *   · 速度 spd（取队伍中最慢的兵种 —— 带器械会拖慢全军）
   *   · 传送站（己方城市间提速 1.5~6 倍，按建筑等级）
   *   · 瞭望塔 10 级（27×27 范围内行军 +50%）
   *   · 天气 move（雨 −20% / 雪 −50% / 雾 −30% / 大风 +10%）
   *   · 机动行军 / 机车操控 / 传动系统（按兵种类型分别提速）
   *   · 急行军令（立即完成当前行军）
   * ============================================================ */
  GAME.march = {};

  /* 行军基数：1 格 = 60 游戏秒 ÷ 速度系数（基准速度见 marchBaseSpeed） */
  GAME.march.secPerTile = function () {
    return (DATA.EXPEDITION && DATA.EXPEDITION.marchSecPerTile) || 60;
  };
  /* 再近也要走满 N 现实秒，否则队列一闪而过看不见 */
  GAME.march.minRealSec = function () {
    return (DATA.EXPEDITION && DATA.EXPEDITION.marchMinRealSec) || 2;
  };

  /* 行军耗时（单位：游戏秒，与建造/训练队列口径一致；球系：from/to 带 .ci） */
  GAME.march.travelTime = function (from, to, army, secPerTile, gen) {
    var ts = GAME.timeScale();
    /* v90.100：距离口径 = **球面六边相邻环数**（step-dist / Honeycomb）。 */
    var dist = (GAME.sphere && GAME.sphere.distOf) ? GAME.sphere.distOf(from, to) : 1;
    if (dist <= 0) dist = 1;
    var fac = GAME.march.speedFactor(army, from, to, gen);
    /* v91.86：星球环境也作用在行军上（低重力更快 / 轨道封锁更慢） */
    var _envPid = (to && to.pid != null) ? to.pid : (GAME.curPid ? GAME.curPid() : 1);
    var _envM = GAME.planetEnvOf ? GAME.planetEnvOf(_envPid) : null;
    if (_envM && _envM.spd && Math.abs(_envM.spd - 1) > 1e-9) fac = fac * _envM.spd;
    var gameSec = dist * (secPerTile || GAME.march.secPerTile()) / Math.max(0.05, fac);
    var realSec = Math.max(GAME.march.minRealSec(), gameSec / ts);
    return Math.round(realSec * ts);
  };

  /* 行军速度系数：1.0 = 标准步卒（spd = marchBaseSpeed）、晴、无加成
     v26（需求 2）：主将速度也计入 —— 每 1 点速度 = 全军行军速度 +1 点
     （兵种 spd 量级 100~1000，基准 marchBaseSpeed=300，故 +1 点 ≈ 系数 +1/300）。
     在此之前英雄速度只影响战斗先手，对行军毫无作用，是个只显示不生效的死属性。 */
  GAME.march.speedFactor = function (army, from, to, gen) {
    /* ① 最慢兵种决定全军速度（带东风快递就别指望跑得快） */
    var slowest = null;
    for (var id in (army || {})) {
      var t = DATA.TROOPS[id];
      if (!t || !(army[id] > 0)) continue;
      var spd = t.spd * spdMultOf(t);          // spdMultOf 已含行军/驾驭/车轮科技
      if (slowest === null || spd < slowest) slowest = spd;
    }
    if (slowest === null) slowest = 100;
    /* DATA.TROOPS 的 spd 在 100~1000 量级，按 marchBaseSpeed(300) 归一 */
    var base = (DATA.EXPEDITION && DATA.EXPEDITION.marchBaseSpeed) || 300;
    var m = slowest / base;

    /* ② 主将速度：求和计算（+1 点 = 全军行军速度 +1 点） */
    var gspd = gen && GAME.genAttrs ? (GAME.genAttrs(gen).spd || 0) : 0;
    if (gspd > 0) m *= (1 + gspd / base);

    /* ③ 天气：雨 −20% / 雪 −50% / 雾 −30% / 大风 +10% */
    if (GAME.story && GAME.story.combatMod) m *= (GAME.story.combatMod().move || 1);
    /* ③′ v91.56（老板）：聚变燃料 —— 全军行军提速（dur 小时 · 唯一出口 s.buffs.marchBoost）。 */
    if (GAME.state && GAME.state.buffs && GAME.state.buffs.marchBoost
      && GAME.state.buffs.marchBoost.until > U.now()) m *= (1 + (GAME.state.buffs.marchBoost.mult || 0));


    /* ③ 己方城市的传送站：城市间行军提速 1.5~6 倍 */
    var fc = from && from.cityId ? GAME.cityById(from.cityId) : null;
    if (fc) {
      var yz = GAME.buildingLevel(fc, 'yizhan') || 0;
      var tbl = DATA.BUILDINGS.yizhan && DATA.BUILDINGS.yizhan.speed;
      if (yz > 0 && tbl) m *= (tbl[yz - 1] || 1);
      /* v28（需求 1）：传送站建筑专精 —— 行军速度再 +0.5 倍/档
         （v89.137：三档 = ×1.5 / ×2.0 / ×2.5） */
      var _yz137 = GAME.mastery ? GAME.mastery('marchAdd', fc) : 0;
      if (_yz137 > 0) m *= (1 + _yz137);

      /* ⑤ 瞭望塔 10 级：27×27 范围内行军 +50%（半径 13 格）
         v28（需求 1）：建筑专精把范围再放 6 格、强度再 +20%/档（v89.137 三档） */
      var fh = GAME.buildingLevel(fc, 'fenghuotai') || 0;
      var bb = (GAME.mastery ? GAME.mastery('beaconBoost', fc) : 0);
      if (fh >= 10 && to && to.ci != null) {
        var d = GAME.cityDist(fc, to);
        if (d <= 13 + bb * 30) m *= (1.5 + bb);
      }
    }
    return m;
  };

  /* ============================================================
   * v89.137（老板 2）：**兵种最终属性**（科技 / 英雄 / 装备等全加成后）
   * ------------------------------------------------------------
   * 战斗界面悬停兵种时的唯一出口 —— 口径直接读战斗引擎自己的
   * perAtk / perDef / perHp（`GAME.tactic.*`），不另算一份，
   * "悬停里看到的数"与"结算时用的数"必然同一把尺。
   * 传入 u = 引擎单位（unitsOf 的产物：含 id / count / cover / atkPct / defPct / hpPer）；
   * gen = 该单位所属方的英雄（我方法：rec.genId；敌方法：rec.sim.scGen）——
   * 生命加成走 T.perHp(u, gen)，与战斗里"被击方英雄加血"同源。
   * 返回 null 表示不是有效兵种（调用方自行兜底）。
   * ⚠️ 不含"攻城"这类**对局态**因子（那是 perAtk 的 opts，随打谁而变）——
   *   悬停给的是"这支部队自己的面板"。
   * ============================================================ */
  GAME.battle.unitFinalOf = function (u, gen) {
    if (!u || !DATA.TROOPS[u.id]) return null;
    var T = GAME.tactic, t = DATA.TROOPS[u.id];
    if (!T) return null;
    /* v89.151（老板 5）：悬停读的是**战场快照**（快照字段曾漏 hpPer/atkPct/defPct/cover，
       见 tactic.snapUnits 的病根注释）—— 这里对缺失字段做**规范化兜底**，
       保证"外部构造/老档快照"也拿得到计算值而不是 NaN：
       基础值兜底（hpPer→t.hp 等），加成缺失按 0 计。 */
    var uu = {
      id: u.id, count: u.count || 0, vsCity: !!u.vsCity,
      hpPer: u.hpPer || t.hp,
      atkPct: u.atkPct || 0, defPct: u.defPct || 0, cover: u.cover || 0,
    };
    var atk = Math.round(T.perAtk(uu));
    var def = Math.round(T.perDef(uu));
    var hp = Math.round(T.perHp(uu, gen || null));
    var cnt = uu.count;
    return {
      id: u.id, name: t.name || u.name || u.id,
      atk: atk, baseAtk: t.atk,
      def: def, baseDef: t.def,
      hp: hp, baseHp: u.hpPer || t.hp,
      range: t.range, spd: u.spd || t.spd,
      /* v89.151（老板 5）：悬停要「全军血量 / 全军攻击 / **全军防御**」三行 ——
         totalDef = 单位防 × 人数（与 totalAtk/totalHp 同尺）。 */
      count: cnt, totalAtk: atk * cnt, totalDef: def * cnt, totalHp: hp * cnt,
    };
  };

  /* 队伍行军速度的“可读”表述（界面展示用） */
  GAME.march.speedText = function (army, from, to, gen) {
    var fac = GAME.march.speedFactor(army, from, to, gen);
    return Math.round(fac * 100) + '%';
  };

  /* 出发：校验 → 扣除 → 入队（真正的结算在抵达时由 tick 触发） */
  GAME.march.dispatch = function (target, modeId, army, genId, schemeId, extra) {
    var s = GAME.state;
    /* ⛔ v89.198（老板「清除战法这个玩法」）：第 6 参 ops（随军战法）随玩法全撤退役。 */
    var p = GAME.battle.prepare(target, modeId, army, genId, { scheme: schemeId || null, cityId: (extra && extra.fromCityId) || null });
    if (!p.ok) return p;
    var city = p.city, gen = p.gen, mode = p.mode, t = p.t;
    /* ============================================================
     * v89.103（老板「资源运输应当采用出征界面」）：**随军辎重**（extra.cargo）
     * ------------------------------------------------------------
     * 校验在这里、扣减也在这里（与兵力同一时刻出门）：
     *   · 库存够不够；· 运力够不够（随军载重 = Σ 兵数 × 兵种载重）。
     * 抵达时由 expedition 的 owncity 分支按同一套运输口径落账；
     * 失败/召回在 arrive / recall 里原路退回。**任何一步都不许让货凭空消失。**
     * ============================================================ */
    var cargo = null;
    if (extra && extra.cargo) {
      cargo = {};
      for (var ck in extra.cargo) {
        var cn = Math.floor(extra.cargo[ck] || 0);
        if (cn <= 0) continue;
        if (GAME.TRANSPORT_KEYS.indexOf(ck) < 0) continue;
        var chave = Math.floor(GAME.res(city)[ck] || 0);
        if (chave < cn) return { ok: false, msg: GAME.resName(ck) + '不足（现有 ' + U.fmt(chave) + '）' };
        cargo[ck] = cn;
      }
      if (!Object.keys(cargo).length) cargo = null;
      if (cargo) {
        var _capW = GAME.cargoCapOf(army), _needW = GAME.cargoLoadOf(cargo);
        if (_needW > _capW) {
          return { ok: false, msg: '运力不足：辎重 ' + U.fmt(_needW) + ' ＞ 随军载重 ' + U.fmt(_capW)
            + '（多带板车 / 运输平台）' };
        }
      }
    }
    /* v86（老板「按计划进行」· G1）：计谋 —— 校验与计费在出发时完成；
       效果由抵达时的 expedition 读 opts.scheme（行军途中不占战斗状态）。 */
    var scheme = null;
    if (schemeId) {
      var schk = GAME.schemePrepare(schemeId, t, gen);
      if (!schk.ok) return schk;
      GAME.schemeUse(schemeId, t, gen);
      scheme = schemeId;
    }

    for (var a in army) GAME.city.armySub(city, { [a]: army[a] });
    var cargoTxt = '';
    if (cargo) {
      var _Rc = GAME.res(city);
      var _parts = [];
      for (var ck2 in cargo) {
        _Rc[ck2] = (_Rc[ck2] || 0) - cargo[ck2];
        _parts.push(GAME.resName(ck2) + U.fmt(cargo[ck2]));
      }
      cargoTxt = '　辎重 ' + _parts.join('/');
    }
    /* v89.135：dispatch 时 scheme 已随军（scheme 变量在上方解析）—— 体力折扣同源
       v89.137：无将增援（station 补兵）没有主将 —— 跳过扣减与状态置位；m.genId 记空串，
       抵达时 arrive 按"设计上无将"放行（不是"主将已不在"）。 */
    if (gen) {
      GAME.setStaNow(gen, GAME.staNow(gen) - GAME.staCostOf(mode, scheme));
      gen.energy = Math.max(0, (gen.energy || 0) - mode.energy);
      GAME.gen.set(gen, 'march');   /* v91.65 */
    }

    var to = { ci: t.ci };
    var total = GAME.march.travelTime({ ci: city.ci, cityId: city.id }, to, army, null, gen);
    /* v86：千里奔袭 —— 本次行军 +30%（只影响这一趟，不改全局速度链） */
    if (scheme === 'benxi') {
      var _bx = GAME.schemeOf('benxi');
      total = Math.round(total / (1 + (_bx ? _bx.eff.marchPct : 0)));
    }
    /* ⛔ v89.198：围困行军 ×1.5（围师必久）随战法全撤退役 —— 出征一律基准时长。 */
    s.marches = s.marches || [];
    var m = {
      id: 'mr' + (GAME._marchSeq = (GAME._marchSeq || 0) + 1),
      pid: (t.pid != null) ? t.pid : GAME.pidOf(city),
      cityId: city.id, genId: gen ? gen.id : '', modeId: mode.id,   /* v89.137：'' = 无将增援 */
      target: target, tci: t.ci, name: t.name, kind: t.kind,
      army: U.deep(army), elapsed: 0, totalTime: total,
      scheme: scheme,                    /* v86：随军计谋（抵达时读） */
      cargo: cargo || null,              /* v89.103：随军辎重（抵达落账 / 失败退回） */
      roundTrip: !!(mode && mode.roundTrip),   /* v91.76：运输送达后原路返程 */
    };
    s.marches.push(m);
    /* v92：出征 = 走过去看见什么。
       沿途只点亮到**半明**（见过地形，不知道上面有什么）；
       真正"到了"才升到全明（见 march.arrive）—— 路上远远看一眼 ≠ 在那儿扎过营。 */
    if (GAME.fog) {
      try { GAME.fog.revealPath({ ci: city.ci }, { ci: t.ci }, GAME.fog.TERRAIN); } catch (e) { /* 视野失败不阻断出征 */ }
    }
    var left = Math.max(0, total / GAME.timeScale());
    GAME.log.war('🛫 ' + (gen ? gen.name + ' 率军' : '增援部队') + '出发 → ' + t.name + '（' + mode.name
      + cargoTxt
      + ' · 行军 ' + U.durExact(left) + ' · 速度 ' + GAME.march.speedText(army, { cityId: city.id }, to, gen) + '）');
    if (GAME.sfx) GAME.sfx('march');      /* v89.93（E4）：出征音 */
    return {
      ok: true, mode: mode.id, marched: true, march: m,
      msg: '大军已发，约 ' + U.durExact(left) + ' 后抵达 ' + t.name,
    };
  };

  /* 推进（主循环每秒调用）。抵达即结算。 */
  GAME.march.tick = function () {
    var s = GAME.state;
    if (!s || !s.marches || !s.marches.length) return;
    var ts = GAME.timeScale();
    var done = [];
    for (var i = 0; i < s.marches.length; i++) {
      var m = s.marches[i];
      var ts0 = ts;                       // 本 tick 折合的游戏秒
      if (m.returning) {
        m.returnElapsed = (m.returnElapsed || 0) + ts0;
        if (m.returnElapsed >= (m.returnTotal || 1)) done.push(m);
      } else {
        m.elapsed += ts0;
        if (m.elapsed >= m.totalTime) done.push(m);
      }
    }
    if (!done.length) return;
    s.marches = s.marches.filter(function (x) { return done.indexOf(x) < 0; });
    done.forEach(function (m) {
      if (m.returning) { GAME.march.returnArrive(m); return; }
      GAME.march.arrive(m);
      /* v91.76（老板）：**运输**送达后沿原路返回（耗时与去程相同）——
         抵达时兵/货已卸，返程只带回队伍本身；归城由 returnArrive 释放。 */
      if (m.roundTrip && !m.returning && GAME.cityById(m.cityId)) {
        m.returning = true;
        m.returnTotal = Math.max(1, Math.round(m.totalTime || 0));
        m.returnElapsed = 0;
        s.marches.push(m);
        GAME.log.war('↩️ ' + m.name + ' 方向运输已卸货，空车返程（约 '
          + U.durExact(m.returnTotal / GAME.timeScale()) + ' 后归城）');
      }
    });
  };

  /* 抵达结算：调用与即时出征同一套核心（opts.arrived 跳过校验与扣除） */
  GAME.march.arrive = function (m) {
    var s = GAME.state;
    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === m.genId) gen = s.generals[i];
    var city = GAME.cityById(m.cityId);
    /* v89.137（老板 7）：`m.genId === ''` = **设计上的无将增援**（station 补兵，不走折返）；
       只有"记了将、人却已不在"（解雇/离去）才折返。 */
    if (!gen && m.genId) {
      /* 英雄已不在（解雇/离去）：兵力原路退回，避免凭空消失 */
      if (city) for (var a in m.army) GAME.city.armyAdd(city, { [a]: m.army[a] });
      GAME.log.war('⚠️ 行军中断：' + m.name + ' 方向的主将已不在，大军折返 ' + ((city && city.name) || ''));
      return null;
    }
    /* v89.86（整改 P-25）：军账守恒护栏 —— 详见 `_expArmySettled` 定义。
       抵达结算失败（目标在途中熄灭：据点当日已拔除 / 城市被夺 …）或抛异常时，
       把仍挂在行军账上的兵力原路退回，绝不让"派出去的兵"凭空消失。 */
    _expArmySettled = false;
    var r = null, err = null;
    try {
      r = GAME.battle.expedition(m.target, m.modeId, m.army, m.genId,
        { arrived: true, cityId: m.cityId, scheme: m.scheme || null,
          cargo: m.cargo || null });      /* v89.103：随军辎重（owncity 分支落账） */
    } catch (e) { err = e; }
    /* v92：抵达 = 这一带并入已知（全明）。**不论战果** —— 人已经站在那儿了，
       看没看见、打没打赢，都不影响"这里有什么"这件事已经被知道。 */
    if (GAME.fog && m.tci != null && m.tci >= 0) {
      try { GAME.fog.revealAround(m.tci, 2, GAME.fog.ALL); } catch (e2) { /* 视野失败不阻断结算 */ }
    }
    /* v92.16（B1）：**讨伐势力核心得手 → 它的领地腰斩**。
       判据写多重（不同结算路径返回结构不同），并且整段包 try：
       削势力失败绝不能拖垮一次正常结算 —— 兵已经打完了，账得先结清。 */
    try {
      if (r && m.target && m.target.ci != null && GAME.faction && GAME.faction.coreAt) {
        var _fraid = GAME.faction.coreAt(m.target.ci);
        var _fwin = (r.winner === 'atk') || (r.sim && r.sim.winner === 'atk') || (r.result && r.result.winner === 'atk');
        if (_fraid && _fwin) {
          var _fres = GAME.faction.onRaidWin(_fraid);
          if (_fres && GAME.log && GAME.log.war) GAME.log.war('🏴 ' + _fres.msg);
        } else if (_fwin && GAME.faction.controlOf) {
          /* v92.21（A7）：不在它的核心，但在它的地盘上打赢了 → 它会警觉 */
          var _fwhere = GAME.faction.controlOf(m.target.ci);
          if (_fwhere) {
            var _fal = GAME.faction.alarmBy(_fwhere);
            if (_fal && GAME.log && GAME.log.war) GAME.log.war('👁 ' + _fal.msg);
          }
        }
      }
    } catch (eF) { /* 削势力失败不阻断结算 */ }
    /* v89.87：观战挂起（pending）时英雄**保持征战在外**，不置 idle ——
       等 finishBattle 落账后统一收尾（否则战斗中英雄会被当成空闲可再派遣）。
       v89.137：`gen` 可能为 null（无将增援 · station 补兵）—— 守卫防空引用。 */
    if (gen && !(r && r.pending) && gen.status === 'march') GAME.gen.release(gen);   /* v91.65 */
    if (err || !r || r.ok === false) {
      var rolled = false;
      if (!_expArmySettled && city) {
        for (var aR in m.army) GAME.city.armyAdd(city, { [aR]: m.army[aR] });
        /* v89.103：辎重与兵力同进退 —— 结算失败时原路退回，不许凭空消失 */
        if (m.cargo) {
          var _Rbk = GAME.res(city);
          for (var ckR in m.cargo) _Rbk[ckR] = (_Rbk[ckR] || 0) + m.cargo[ckR];
        }
        rolled = true;
      }
      _expArmySettled = true;
      var whyR = err ? '结算异常' : ((r && r.msg) || '目标已不存在');
      GAME.log.war('⚠️ ' + m.name + ' 方向进军中止（' + whyR + '）：'
        + (rolled ? '大军原路折返 ' + city.name : '军账已结，兵已入城 / 伤兵营'));
      if (err && typeof console !== 'undefined' && console.warn) console.warn('[march.arrive] 抵达结算异常：', err);
      if (GAME.onMarchArrive) {
        GAME.onMarchArrive(m, { ok: false, rolled: rolled, msg: whyR, err: err ? String((err && err.message) || err) : null });
      }
      return { ok: false, rolled: rolled, msg: whyR };
    }
    if (r.result && r.result.winner === 'scout') {
      GAME.log.war('🔭 ' + (gen ? gen.name : '侦察单元') + ' 侦察归来：' + m.name);   /* v89.137：无将守卫 */
    }
    if (GAME.onMarchArrive) GAME.onMarchArrive(m, r);
    return r;
  };

  /* 行军即刻抵达 —— 唯一出口（v89.179c 老板②B方案）
     ------------------------------------------------------------
     原状：UI 里有个**免费**的「⚡急行军令（立即抵达）」按钮（不扣旧币、不耗道具），
           而付费的急行军令 / 疾行令行为与它相同 → 两支道具被完全压死（"鬼商品"）。
     现在：即刻抵达**必须消耗道具**，且两支各有分工（见 DATA.ITEMS 的 marchScope）：
       · 急行军令（one）→ 只催单支（军务页逐行「⚡ 急行军」，带 marchId）
       · 疾行令（all）  → 催全部（面板底部按钮）
     ⚠️ `rushApply` 是**纯效果**（不扣道具）—— 扣道具分两处，但都只经此一个效果出口：
        · 按钮路径 `rushByItem`（点了就扣 1）
        · 背包路径 `S.useItem`（其尾部统一扣 1，见 systems.js） */
  GAME.march.rushApply = function (marchId) {
    var s = GAME.state;
    var all = (s.marches || []).slice();
    if (!all.length) return { ok: false, msg: '当前没有行军队列' };
    var targets = marchId ? all.filter(function (m) { return m.id === marchId; }) : all;
    if (!targets.length) return { ok: false, msg: '该行军已结束' };
    s.marches = all.filter(function (m) { return targets.indexOf(m) < 0; });
    targets.forEach(function (m) { GAME.march.arrive(m); });
    return { ok: true, count: targets.length, msg: targets.length + ' 支大军即刻抵达' };
  };
  /* 离线结算用：把"离线期间早该抵达"的行军一次结清。
     **不消耗道具** —— 那是正确性需求（时间本就过去了），不是玩家点了什么。 */
  GAME.march.rushAll = function () { return GAME.march.rushApply(null); };
  /* 按钮路径：校验作用域 → 校验道具 → 走同一效果出口 → 扣 1 */
  GAME.march.rushByItem = function (itemId, marchId) {
    var s = GAME.state;
    var it = GAME.systems.itemInfo(itemId);
    if (!it || it.target !== 'march') return { ok: false, msg: '该宝物不能用于行军' };
    if (it.marchScope === 'one' && !marchId) {
      return { ok: false, msg: '「' + it.name + '」只用于**单支**行军（请点该行的「⚡ 急行军」）' };
    }
    if (it.marchScope === 'all' && marchId) {
      return { ok: false, msg: '「' + it.name + '」用于**全部**行军（请用面板底部的按钮）' };
    }
    if (((s.items || {})[itemId] || 0) <= 0) {
      return { ok: false, need: itemId, msg: '需要「' + it.name + '」×1 —— 背包里没有（可就地购买）' };
    }
    var r = GAME.march.rushApply(marchId || null);
    if (!r.ok) return r;
    GAME.items.sub(itemId, 1);   /* v91.62：走背包归属出口（下界恒 0） */
    GAME.log.war('⚡ ' + it.name + '：' + r.msg);
    return { ok: true, count: r.count, msg: '⚡ ' + it.name + '：' + r.msg };
  };

  /* 撤回：兵力原路返还（无收益） */
  GAME.march.recall = function (id) {
    var s = GAME.state;
    var m = null;
    (s.marches || []).forEach(function (x) { if (x.id === id) m = x; });
    if (!m) return { ok: false, msg: '该行军已结束' };
    /* v91.13（老板 15）：「出征可取消，军队**原路返回**、**耗时与距离相关**」——
       改前召回=**瞬间**归城（兵力当场回）。现改为：行军掉头（returning），
       用时 = **已走出多远**（elapsed 折合的距离），走完才归城。 */
    if (m.returning) return { ok: false, msg: '已在返回途中' };
    var city = GAME.cityById(m.cityId);
    /* 用**独立返回计时**（不回写 totalTime/elapsed）—— 保留原行军时长，回程才算返回。 */
    m.returning = true;
    m.returnTotal = Math.max(1, Math.round(m.elapsed || 0));   /* 返回耗时 ≈ 已行进量（距离相关） */
    m.returnElapsed = 0;
    if (city) GAME.log.war('↩️ ' + m.name + ' 方向的大军**折返**（原路返回 ' + city.name
      + ' · 约 ' + U.durExact(m.returnTotal / GAME.timeScale()) + '）');
    return { ok: true, msg: '已下令折返（约 ' + U.durExact(m.returnTotal / GAME.timeScale()) + ' 后归城）' };
  };
  /* v91.13：折返**抵达** —— 兵力/辎重原路归城，主将归位（召回真正生效的时点）。 */
  GAME.march.returnArrive = function (m) {
    var s = GAME.state;
    var city = GAME.cityById(m.cityId);
    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === m.genId) gen = s.generals[i];
    if (gen && gen.status === 'march') GAME.gen.release(gen);   /* v91.65 */
    if (city) {
      for (var a in m.army) GAME.city.armyAdd(city, { [a]: m.army[a] });
      if (m.cargo) {
        var _Rrc = GAME.res(city);
        for (var ckC in m.cargo) _Rrc[ckC] = (_Rrc[ckC] || 0) + m.cargo[ckC];
      }
      GAME.log.war('↩️ ' + m.name + ' 方向的大军已归 ' + city.name + '（折返抵达）');
    } else {
      /* 出发城已不在（被放弃/夺走）：兵力并入首城，绝不凭空消失 */
      var home = (s.cities && s.cities[0]) || null;
      if (home) for (var a2 in m.army) GAME.city.armyAdd(home, { [a2]: m.army[a2] });
      GAME.log.war('⚠️ 折返抵达但出发城不在，兵力并入首城');
    }
    if (GAME.onMarchArrive) GAME.onMarchArrive(m, { ok: true, returned: true });
    return { ok: true };
  };

  /* 行军进度（界面用） */
  GAME.march.progressOf = function (m) {
    if (m && m.returning) {
      var rp = Math.min(100, Math.floor((m.returnElapsed || 0) / (m.returnTotal || 1) * 100));
      var rl = Math.max(0, ((m.returnTotal || 0) - (m.returnElapsed || 0)) / GAME.timeScale());
      return { pct: rp, left: rl, returning: true, label: '↩︎ 返回中 ' + rp + '% · ' + U.durExact(rl) };
    }
    var pct = Math.min(100, Math.floor((m.elapsed || 0) / (m.totalTime || 1) * 100));
    var left = Math.max(0, ((m.totalTime || 0) - (m.elapsed || 0)) / GAME.timeScale());
    return { pct: pct, left: left, label: pct + '% · ' + U.durExact(left) };
  };

  /* ============================================================
   * v91.83（老板）：「补充**将领战力评估**、**兵种战力评估体系**；
   *   基于将领对兵种的加成，建立**总体战力评估**」。
   * ------------------------------------------------------------
   * 三层共用**同一把尺** —— 单兵战力复用 `STORY.troopPower`（全仓唯一出口，不另造）：
   *   ① 兵种战力 `troopOf(id)` = hp×W.hp + atk×W.atk + def×W.def + spd×W.spd
   *   ② 将领战力 `genOf(g, army)` = **带兵容量 × 加成强度 × 单兵战力**
   *       带兵容量 coverCap = 指挥 × 100 ×(1+指挥链路科技)  ← 能吃满加成的兵数上限
   *       加成强度 avgBonus = (atkPct + defPct)/2           ← 全军攻/防加成均值
   *       → 量纲与①一致：= 该将麾下塞满兵时，凭加成**额外**贡献的战力。
   *         （加成原子 atkPct/defPct 走 GAME.atkPctOf/defPctOf，与战斗引擎同源。）
   *   ③ 总体战力 `armyOf(army, gen)` = Σ 兵种战力 ×(1 + 加成 × 覆盖率)
   *       覆盖率 cover_i = min(cnt_i, coverCap)/cnt_i —— **逐兵种**，
   *       与 damageOf 里 `covered/cnt` 是同一个公式（不是另写一套）。
   * ⚠️ 速度/先手**不折进总战力** —— 先手要有对手才能判（firstStrike 需双方），
   *    单列为 `spd` 指标，避免"无对手也能算出先手"的伪精度。
   * ============================================================ */
  GAME.power = {};

  /* ① 单兵战力（唯一出口） */
  GAME.power.troopOf = function (id) {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    return tp ? tp(id) : (((DATA.TROOPS[id] || {}).power) || 0);
  };
  /* 兵种评估行：纸面分项 + 派生指标（人口效率 / 性价比 / 定位）。 */
  GAME.power.troopRow = function (id) {
    var t = DATA.TROOPS[id]; if (!t) return null;
    var p = GAME.power.troopOf(id);
    var cost = 0, cn = t.cost || {};
    for (var k in cn) cost += (cn[k] || 0);
    /* 定位由**数据派生**（不手写表）：新增兵种自动归类。 */
    var role = t.nocombat ? '非战斗'
      : (t.load >= 5000 ? '运输'
        : (t.range >= 800 ? '远程'
          : (t.def >= t.atk ? '防御' : '突击')));
    return { id: id, name: t.name, ab: t.ab, icon: t.icon || '', grp: t.grp, nocombat: !!t.nocombat,
      hp: t.hp || 0, atk: t.atk || 0, def: t.def || 0, spd: t.spd || 0, range: t.range || 0,
      load: t.load || 0, pop: t.pop || 0, power: p, cost: cost,
      perPop: (t.pop ? p / t.pop : 0), perCost: (cost ? p / cost : 0), role: role };
  };
  GAME.power.troopRows = function (opts) {
    opts = opts || {};
    var rows = Object.keys(DATA.TROOPS || {}).map(function (id) { return GAME.power.troopRow(id); }).filter(Boolean);
    if (opts.grp) rows = rows.filter(function (r) { return r.grp === opts.grp; });
    if (opts.combatOnly) rows = rows.filter(function (r) { return !r.nocombat; });
    rows.sort(function (a, b) { return b.power - a.power; });
    return rows;
  };
  /* 编成的**加权平均**单兵战力 —— 将领评估的基准尺（不给编成则取全兵种均值）。 */
  GAME.power.avgTroopOf = function (army) {
    var n = 0, sum = 0;
    if (army) {
      for (var k in army) {
        var c = Math.max(0, Math.floor(army[k] || 0));
        if (c > 0) { n += c; sum += c * GAME.power.troopOf(k); }
      }
    }
    if (n > 0) return sum / n;
    var ids = Object.keys(DATA.TROOPS || {}), s2 = 0;
    ids.forEach(function (x) { s2 += GAME.power.troopOf(x); });
    return ids.length ? s2 / ids.length : 1;
  };

  /* ② 将领战力评估（army 可选：给了就用该编成的加权单兵战力作尺） */
  GAME.power.genOf = function (g, army) {
    if (!g) return null;
    var a = GAME.genAttrs(g);
    /* v91.92：覆盖走 GAME.coverOf（唯一出口）；dr = 指挥溢出减伤（口径见 domain.js） */
    var cv = GAME.coverOf(a.tong, 1 + TB('command'), totalCount(army || {}));
    var coverCap = Math.round(cv.cap);
    var atkPct = a.atkPct || 0, defPct = a.defPct || 0;
    var avgBonus = (atkPct + defPct) / 2;
    var unit = GAME.power.avgTroopOf(army);
    return { id: g.id, name: g.name, level: g.level || 1,
      tong: a.tong, yw: a.yw, zm: a.zm, nz: a.nz, spd: a.spd,
      atkVal: a.atkVal || 0, defVal: a.defVal || 0,
      coverCap: coverCap, atkPct: atkPct, defPct: defPct, avgBonus: avgBonus,
      dr: cv.dr, unit: unit, power: Math.round(coverCap * avgBonus * unit) };
  };
  GAME.power.genRows = function (army) {
    return ((GAME.state && GAME.state.generals) || []).map(function (g) { return GAME.power.genOf(g, army); })
      .filter(Boolean).sort(function (a, b) { return b.power - a.power; });
  };

  /* ③ 总体战力 = 编成 × 将领加成（逐兵种覆盖率 · 与战斗引擎同一公式） */
  GAME.power.armyOf = function (army, gen) {
    army = army || {};
    var base = 0, add = 0, n = 0, load = 0, spdSum = 0;
    var byId = {};
    var a = gen ? GAME.genAttrs(gen) : null;
    var coverCap = a ? (a.tong || 0) * GAME.COVER_PER_TONG * (1 + TB('command')) : 0;
    var avgBonus = a ? (((a.atkPct || 0) + (a.defPct || 0)) / 2) : 0;
    var spdMult = 1 + TB('ride');
    for (var id in army) {
      var cnt = Math.max(0, Math.floor(army[id] || 0)); if (cnt <= 0) continue;
      var t = DATA.TROOPS[id]; if (!t) continue;
      var p = GAME.power.troopOf(id) * cnt;
      base += p; n += cnt;
      load += cnt * (t.load || 0);
      spdSum += (t.spd || 0) * (t.ride ? spdMult : 1) * cnt;   /* 机车加成与 armySpeed 同口径 */
      /* v91.92：覆盖率与减伤都走唯一出口（dr 仅供展示，不进战力口径） */
      var cvI = a ? GAME.coverOf(a.tong, 1 + TB('command'), cnt) : { cover: 0, dr: 0 };
      var cover = cvI.cover;
      var addI = p * avgBonus * cover;
      byId[id] = { cnt: cnt, power: Math.round(p), cover: cover, dr: cvI.dr, add: Math.round(addI) };
      add += addI;
    }
    return {
      base: Math.round(base), add: Math.round(add), total: Math.round(base + add),
      troops: n, load: load, spd: (n ? spdSum / n : 0),
      coverRate: (base > 0 ? add / base : 0),              /* 实际吃到的加成率（含覆盖折损） */
      bonusRate: avgBonus,                                  /* 满覆盖时的加成率 */
      coverCap: Math.round(coverCap), byId: byId,
      gen: (a && gen) ? { id: gen.id, name: gen.name, atkPct: a.atkPct, defPct: a.defPct } : null,
    };
  };
  /* 一城驻军的总体战力（gen 不传 = 裸战力） */
  GAME.power.cityOf = function (city, gen) {
    if (!city) return null;
    return GAME.power.armyOf(city.army || {}, gen);
  };
})();

/* ---- strategy.js ---- */
/* ============================================================
 * strategy.js  回合战斗策略层（v91.85 新增）
 * ------------------------------------------------------------
 * 定位：**独立模块**（不碰战斗数学，只产出「每回合的动作 / 目标」）。
 *
 * 为什么要单独一层：
 *   · tactic.js 是 83KB 的结算内核，改它等于动 3785 条冒烟断言；
 *   · 决策只需要"当前战场快照"，不需要知道伤害怎么算；
 *   · 同一份策略要能被外部沙盘（battle_panel_sim）复用。
 *   所以这里只做纯函数：输入 snap（战场快照）→ 输出指令表
 *   `{atk:{troopId:{s,t}}, def:{...}}`，由 tactic.js 在每回合开火前套用。
 *
 * 旧的「幼稚策略」= 每个兵种永远打**最近的/同兵种**，动作靠战前一次性设定。
 * 本模块保留那两条规则（`front` / `same`）作回退，但默认改用评分制：
 *   ① 能一击打死 → 优先（少挨一次反击）
 *   ② 有效伤害占目标剩余血的比例 → 不浪费溢出
 *   ③ 目标威胁（攻击×剩余数量）→ 先砍输出高的
 *   ④ 挡路判定（它是我方最前面的阻挡者）→ 先清门板
 *   动作（stance）按"够不够得着"决定：够不着就推进，远程够着就原地，
 *   近战够着继续压上；守方残血且被贴脸时才允许后撤（攻方禁止后退）。
 *
 * 兼容：`GAME.strat` 不存在时 tactic.js 完全走旧逻辑；存在时也只替
 * **NPC 一侧**下指令（玩家自己的战术设置不动）。
 * ============================================================ */



(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA;

  var S = GAME.strat = {};

  /* 可选目标规则（与引擎 u.target 的语义一一对应） */
  S.RULES = ['best', 'same', 'weak', 'dmg', 'eff', 'front'];

  function aliveList(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].count > 0) out.push(list[i]);
    return out;
  }
  function frontAdv(list) {
    var m = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].count <= 0) continue;
      if (m === null || list[i].adv > m) m = list[i].adv;
    }
    return m === null ? 0 : m;
  }
  /* 间距 = 纵深 − 我方推进 − 敌方前锋推进（与 tactic.js 的 gapOf 同一把尺） */
  function gapOf(u, foes, D) {
    return Math.max(0, D - u.adv - frontAdv(foes));
  }
  function atkOf(u) {
    var t = DATA.TROOPS[u.id] || {};
    return (t.atk || 0) * (1 + (u.atkPct || 0)) * Math.max(0, u.count);
  }
  function hpOf(u) {
    return Math.max(1, (u.hpPer || ((DATA.TROOPS[u.id] || {}).hp || 1)) * Math.max(0, u.count));
  }
  function rangeOf(u) {
    return u.er || u.range || 0;
  }

  /* 目标评分：与 battle_panel_sim 的 scoreTarget 同口径
     （kill 3.0 / eff 2.0 / threat 1.2 / blocker 0.8） */
  S.scoreTarget = function (u, t, foes, D) {
    var dmg = atkOf(u);
    var hp = hpOf(t);
    var kill = dmg >= hp ? 1 : 0;
    var eff = Math.min(dmg, hp) / hp;
    var maxThreat = 1;
    for (var i = 0; i < foes.length; i++) {
      var f = foes[i];
      if (f.count <= 0) continue;
      var th = atkOf(f);
      if (th > maxThreat) maxThreat = th;
    }
    var threat = atkOf(t) / maxThreat;
    var myGap = gapOf(u, foes, D);
    var tGap = gapOf(t, [{ adv: u.adv, count: 1 }], D);
    var blocker = Math.abs(tGap - myGap) < 1e-6 ? 1 : 0;
    return 3.0 * kill + 2.0 * eff + 1.2 * threat + 0.8 * blocker;
  };

  /* 按规则在射程内挑目标；射程内没有目标返回 null */
  S.pickTarget = function (u, foes, rule, D) {
    var pool = [];
    var myRange = rangeOf(u);
    for (var i = 0; i < foes.length; i++) {
      var f = foes[i];
      if (f.count <= 0) continue;
      if (gapOf(u, foes, D) <= myRange) pool.push(f);
    }
    /* 射程判定用"我方到敌方前锋"的间距；前锋之外的单位更远，这里按单兵间距再筛一次 */
    if (!pool.length) return null;
    function nearest(arr) {
      var best = arr[0], bg = Infinity;
      for (var k = 0; k < arr.length; k++) {
        var g = gapOf(u, [arr[k]], D);
        if (g < bg) { bg = g; best = arr[k]; }
      }
      return best;
    }
    rule = rule || 'best';
    if (rule === 'same') {
      var same = [];
      for (var j = 0; j < pool.length; j++) if (pool[j].id === u.id) same.push(pool[j]);
      if (same.length) return nearest(same);
      rule = 'best';
    }
    if (rule === 'front') return nearest(pool);
    if (rule === 'weak') {
      var w = pool[0];
      for (var a = 1; a < pool.length; a++) if (hpOf(pool[a]) < hpOf(w)) w = pool[a];
      return w;
    }
    if (rule === 'dmg') {
      var d = pool[0];
      for (var b = 1; b < pool.length; b++) if (atkOf(pool[b]) > atkOf(d)) d = pool[b];
      return d;
    }
    if (rule === 'eff') {
      var e = pool[0];
      for (var c = 1; c < pool.length; c++) {
        if (atkOf(pool[c]) * hpOf(pool[c]) > atkOf(e) * hpOf(e)) e = pool[c];
      }
      return e;
    }
    /* best（含未识别的规则名） */
    var best = pool[0], bs = -Infinity;
    for (var m = 0; m < pool.length; m++) {
      var sc = S.scoreTarget(u, pool[m], foes, D);
      if (sc > bs) { bs = sc; best = pool[m]; }
    }
    return best;
  };

  /* 动作：够不着 → 推进；远程够着 → 原地；近战够着 → 压上
     opts.allowRetreat：守方残血（<15%）且被近战贴到 300 内时可后撤 */
  S.stanceOf = function (u, foes, D, opts) {
    opts = opts || {};
    var alive = aliveList(foes);
    if (!alive.length) return 'hold';
    var gap = gapOf(u, foes, D);
    var r = rangeOf(u);
    if (gap > r) return 'advance';
    if (r >= 600) {
      var hpRatio = u.count / Math.max(1, u.start || u.count);
      if (opts.allowRetreat && hpRatio < 0.15) {
        /* 只对"贴到近身"的敌近战后撤，否则原地输出更划算 */
        var danger = false;
        for (var i = 0; i < alive.length; i++) {
          var e = alive[i];
          if (rangeOf(e) < 200 && gap <= 300) { danger = true; break; }
        }
        if (danger) return 'retreat';
      }
      return 'hold';
    }
    return 'advance';
  };

  /* 给一侧生成指令表 */
  S.planSide = function (snap, side, opts) {
    opts = opts || {};
    var mine = (side === 'def') ? snap.def : snap.atk;
    var foes = (side === 'def') ? snap.atk : snap.def;
    var D = snap.field || 0;
    var rule = opts.rule || 'best';
    var out = {};
    for (var i = 0; i < mine.length; i++) {
      var u = mine[i];
      if (!u || u.count <= 0) continue;
      if (u.vsCity && opts.towerId) {
        /* 攻城器械优先拆塔（塔在射程内才指定，否则交给通用规则） */
        out[u.id] = { s: S.stanceOf(u, foes, D, opts), t: opts.towerId };
        continue;
      }
      var tg = S.pickTarget(u, foes, rule, D);
      out[u.id] = {
        s: S.stanceOf(u, foes, D, opts),
        t: tg ? tg.id : (opts.fallback || 'front')
      };
    }
    return out;
  };

  /* 双侧一起规划（外部沙盘用；游戏内只替 NPC 一侧规划） */
  S.plan = function (snap, opts) {
    opts = opts || {};
    return {
      atk: S.planSide(snap, 'atk', opts),
      def: S.planSide(snap, 'def', opts)
    };
  };

  /* 打包成 tactic.js 的 opts.plan 回调：只规划指定的一侧，另一侧返回空表（保留玩家指令） */
  S.autoPlan = function (cfg) {
    cfg = cfg || {};
    var sides = cfg.sides || ['def'];
    var rule = cfg.rule || 'best';
    var allowRetreat = (cfg.allowRetreat !== false);
    return function (snap) {
      var out = {};
      for (var i = 0; i < sides.length; i++) {
        var side = sides[i];
        out[side] = S.planSide(snap, side, {
          rule: rule,
          allowRetreat: allowRetreat,
          attacker: side === 'atk' && cfg.attacker === true,
          towerId: cfg.towerId || null
        });
      }
      return out;
    };
  };

  /* 版本标记：战报/调试可读（也方便冒烟断言"策略层已接线"） */
  S.VERSION = 'v91.85';
})();

/* ---- tactic.js ---- */
/* ============================================================
 * tactic.js  回合制文字战斗场景（v27 · 需求 5）
 * ------------------------------------------------------------
 * 把"一场仗"从抽象掷骰改成**看得见的战场**：
 *
 *   · 战场是一条**网格化的距离轴**（抽象网格地图），双方相向推进。
 *     距离：攻打野地 2000，攻打野外城市 3000，攻打城市 4000。
 *   · **回合制**。每回合所有存活部队按**速度从高到低**行动（速度含英雄加成）。
 *   · v89.87（老板拍板）：每兵种每回合**主动攻击一个目标**；主目标吃满伤害后，
 *     **v89.95 起：一击只打一个目标兵种，溢出伤害作废（无溅射）**——
 *     老板原话：「战斗一个回合只对一个目标兵种出手，后续无溅射伤害」。
 *     改前是"主目标吃满后，溢出对射程内每个敌方兵种各溅射 30%"，
 *     结果是"一回合清掉对面两三支"、战斗 1~3 回合结束（没有回合对战可玩）。
 *   · 行动规则：与最近一支敌军的间距若已在射程内 → 开火；
 *     否则**向对方推进"该兵种速度"这么远**，直到接触对方最前方的兵种。
 *   · 攻击值 = （兵种基础攻击 + 英雄/装备加成的攻击）× 该兵种数量
 *     × 攻城修正 × 武力/科技/宝物/羁绊等百分比加成。
 *   · 杀伤效果 = 攻击值 ÷ 受击部队的**兵种生命值**
 *     （生命值受**守方英雄**加成：生命维持、英雄体力、谋略与护甲）。
 *   · 双方英雄的四维都参与 —— 攻方看武力与装备攻击，守方看谋略与生命加成。
 *
 * 与旧实现的关系：
 *   旧的"整军对拼掷骰"保留为 `GAME.battle.simulateDice`（可回退），
 *   `GAME.battle.simulate` 默认走本引擎。两者返回**同一组字段**
 *   （winner / atkLoss / defLoss / atkRemain / defRemain / rounds / log），
 *   于是上层（出征、行军队列、伤兵、战报）一行都不用改。
 *
 * 本引擎**完全确定**（不含 Math.random）—— 同样的输入必得同样的结果，
 * 这也是"装备/体力让损兵更少"这类对比断言能稳定成立的前提。
 * ============================================================ */



(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  var T = GAME.tactic = {};

  /* ============================================================
   * 战场距离（v57 · 老板拍板：改成「双方最远射程 + 199」）
   * ------------------------------------------------------------
   * 改前是**场地常数**（wild 2000 / fort 3000 / city 4000）—— 也就是说
   * "带不带远程"只影响能不能隔空打，**不影响开战间距**。
   * 原版（4399 战争系统页 + 玩家实测多源一致）：
   *     战场距离 = 双方【最远射程】 + 199     （官方写 +200，实测 +199，差 1 是取整）
   * 自洽验证：野战无远程无城防时战场距离 = **270**，而近战里最远的是主战机甲 **70** →
   *     70 + 200 = 270 ✓ —— 所以**近战射程也参与比较**，不是只看远程。
   * 例：满抛射（+50%）自走火炮 1200×1.5=1800 → 1999 ✓；无人轰炸机 2299 ✓；东风快递 2599 ✓。
   *
   * 为什么这是六项里唯一的**结构性**改动：抛射科技不只加射程，它同时把开战间距
   * 推远 → **远程方拿到先手**（老玩家说"弓的第一回合先发打击是关键"的机制来源）。
   * 距离不再是背景参数，它是**先手权的一部分**。
   * ============================================================ */
  /* v89.95（B2）：纵深 = 最远射程 + MARGIN，且**不得小于 FIELD_MIN**。
     老板原话：「现在的速度对战斗具有决定性影响（一步到面前，先手打击，
     溅射伤害收场，根本没有回合对战乐趣）」。
     改前 FIELD_MIN=200、MARGIN=199 → 纯近战纵深 249，而步行机速度 300 →
     **第 1 回合就贴脸**，先手方一轮打光对手。
     ------------------------------------------------------------
     v89.139（老板 1）：「**战场距离不对，考虑兵种速度和最远射程**」——
     旧口径的 1400 是**常数保底**：谁打谁都一样远，于是
       · 板车互殴（spd 180）要 7.8 回合才接敌，30 回合上限里净走路；
       · 主战机甲互冲（spd 600）2.3 回合就贴脸 —— 速度差异只体现为"快的一方先到"，
         但"多久开始打"完全没跟配兵走。
     新口径 = **三个下限取大**：
       ① 最远射程 + MARGIN（原版规则，保证远程方的"进入射程"过程）；
       ② (双方最快单位速度之和) × MARCH_ROUNDS_MIN —— **快 vs 快**时把纵深撑开，
          防"两个精锐机车第 1 回合互撞"（老板 v89.95 抱怨的"一步到面前"）；
       ③ FIELD_MIN 1400 保底（慢速组合：板车互殴也不至于 1 回合贴脸）。
     速度口径与引擎推进**同一把尺**（`t.spd × spdMult(t)`，见 unitsOf 的 spd 字段），
     所以"几步接敌"的推算与实战逐回合记录一致。
     ⚠️ MARCH_ROUNDS_MIN 为什么是 2 而不是 3：
       接敌回合 R = ⌈D ÷ (vA+vD)⌉；若 ②用 ×3，则 D ≥ 3(vA+vD) → **所有配兵都恰好
       3 回合接敌**（速度差异被完全抹平，与"考虑兵种速度"的意图相反）。
       ×2 只抬高快组合的下限：伏击车 vs 步行机 2 回合、步行机 vs 步行机 3 回合、
       板车互殴 4 回合、东风快递压阵 5 回合 —— 快者仍先接敌，慢者不再 1 回合贴脸。 */
  /* v89.140（老板 1）：「战场距离是否考虑基于在场兵种**最远射程乘以某个系数**？合理设计」——
     采纳：从"+MARGIN（绝对量）"改为"× FIELD_RANGE_K（比例量）"。
     系数 1.25 的来由：原版口径 maxR+299 在主流射程段与 ×1.25 几乎重合
     （自走火炮 1200 → 1499 vs 1500；东风快递 1600 → 1899 vs 2000），
     但比例式在**任意射程**下都成立（低射程交给 FIELD_MIN/速度项，高射程自然成比例放大），
     不用再问"为什么是 299 而不是别的数"。 */
  T.FIELD_RANGE_K = 1.25;
  /* ⛔ v89.141：射程**加数式**常数（FIELD_MARGIN，值 299）已删 ——
     v89.140 起纵深改**比例式**（最远射程 × FIELD_RANGE_K），加数式是历史口径；
     留着只会让人以为"哪里还有一处 +299"。纵深三段口径见 battlefieldOf。 */
  /* 快 vs 快的最少接敌回合（接敌回合 = ⌈D ÷ (vA+vD)⌉ ≥ 本值），见上方 ⚠️ 论证 */
  T.MARCH_ROUNDS_MIN = 2;
  /* 绝对保底（v89.95 立的规矩：接敌要走几回合）——慢速组合由它兜底 */
  T.FIELD_MIN = 1400;
  /* ============================================================
   * 溢出溅射比例（v89.87 · 老板拍板）
   * ------------------------------------------------------------
   * 「每个兵种每回合只主动攻击一次，目标为其中一个兵种」——
   * 主目标吃满本次伤害后，**超出部分对射程内其他每个敌方兵种各溅射 30%**。
   * 取代原 v57 的「溢出按由近及远**全额**顺延」。
   * 标靶是**兵种**（编队）不是个体：溅射量按各自防御/生命折算杀兵数，
   * 各自钳制在实有人数内（打不光更多）。
   * ============================================================ */
  /* v89.95（B1）：`T.SPLASH_PCT` **退役**（一击一目标，溢出作废）。
     保留常量 = 0 只为兼容旧引用点（smoke 的老断言会改成新口径）。 */
  T.SPLASH_PCT = 0;
  /* v91.08（老板）：**克制倍率唯一出口** —— 攻方 atkId 打守方 defId 时的最终伤害倍率。
     三系循环（穿甲→重甲→机动→穿甲）· 幅度 ±0.2（DATA.COUNTER.mag）：
     我克他 ×(1+0.2) · 我被他克 ×(1−0.2) · 其余/未列兵种 ×1。 */
  T.counterMulOf = function (atkId, defId) {
    var C = (GAME.DATA && GAME.DATA.COUNTER) || null;
    if (!C) return 1;
    var R = GAME.DATA.TROOP_ROLE || {};
    var ra = R[atkId], rd = R[defId];
    if (!ra || !rd || ra === rd) return 1;
    var beats = C.beats || {};
    if (beats[ra] === rd) return 1 + (C.mag || 0.2);     /* 我克他 */
    if (beats[rd] === ra) return 1 - (C.mag || 0.2);     /* 我被他克 */
    return 1;
  };
  /* 旧场地常数**保留为回退值**：`opts.field` 显式传入时仍然可用
     （旧战报回放、跨服类玩法要另设距离），不让老数据算不出来。 */
  T.FIELD = { wild: 2000, fort: 3000, city: 4000 };
  T.fieldOf = function (kind) { return T.FIELD[kind] || T.FIELD.wild; };

  /* 一支部队"计入战场距离"的射程：含射程科技与剧情修正；
     守城时远程/器械在城头，射程并入城头火力圈（与 actSide 的 onWall 同一口径）。 */
  function fieldRangeOf(t, side, wallR) {
    var r = (t.range || 0) * (1 + TB('range'));
    if (GAME.story && GAME.story.combatMod) r *= (GAME.story.combatMod().archerRange || 1);
    if (side === 'def' && wallR > 0 && (t.range || 0) >= 500) r = Math.max(r, wallR);
    return r;
  }
  /* 战场距离的唯一出口。`opts.field` 显式给了就用它（旧回放/特殊玩法）。
     v89.139：数值 = max(射程下限, 速度下限, 绝对保底) —— 见 FIELD_MIN 段注释。 */
  T.battlefieldOf = function (atkArmy, defArmy, defVal, opts) {
    opts = opts || {};
    if (opts.field) return opts.field;
    var wallR = opts.sieging ? T.wallFireRangeRaw(defVal, opts.wallLv, opts.towers) : 0;
    /* v59：**箭塔是独立火力源 → 它的射程无条件参与"最远射程"比较**。
       改前只把 wallR 借给"守方远程兵"（fieldRangeOf 的 side==='def' 分支），
       于是守军全近战时箭塔撑不起战场 —— 而原版明说"箭塔射程 2500，我在 2600 还被打到"。 */
    var maxR = wallR;
    /* v89.139：顺带收双方"最快单位速度"（与引擎 unitsOf 的 spd 同一把尺：
       `round(t.spd × spdMult(t))`，英雄加成 battle 层已并入 spdMult 的场景除外）。 */
    var fastA = 0, fastD = 0;
    function scan(army, side) {
      Object.keys(army || {}).forEach(function (id) {
        var t = DATA.TROOPS[id];
        /* 侦察单元不参战、也不该把战场撑大/撑快 */
        if (!t || t.nocombat) return;
        var r = fieldRangeOf(t, side, wallR);
        if (r > maxR) maxR = r;
        var sd = Math.round((t.spd || 0) * spdMult(t));
        if (side === 'atk') { if (sd > fastA) fastA = sd; }
        else { if (sd > fastD) fastD = sd; }
      });
    }
    scan(atkArmy, 'atk');
    scan(defArmy, 'def');
    var spdFloor = Math.round((fastA + fastD) * T.MARCH_ROUNDS_MIN);
    /* v89.140：射程项改 `maxR × FIELD_RANGE_K`（比例式）——三下限取大不变 */
    return Math.max(T.FIELD_MIN, Math.round(maxR * T.FIELD_RANGE_K), spdFloor);
  };

  /* ============================================================
   * 战场机动（v57 · 老板拍板：改回原版 **1:1**）
   * ------------------------------------------------------------
   * v29 曾按「每 1 点速度 = 每回合推进 2.4 丈」换算，为的是让兵种速度差异在
   * 2000/3000/4000 的**大纵深**里看得出来（当时连伏击车都要 3~5 回合才摸到墙）。
   * 现在纵深换成"最远射程 + 199"（野地常常只有 249~1400），再乘 2.4 会一步贴脸，
   * 所以改回原版的 **1:1：速度就是每回合推进的丈数**。
   * 原版战报实录可逐项验证：满科技伏击车"前进 1500"、主战机甲 900、步行机 600、
   * 盾卫 550、自走火炮 500 —— 与它们的（含科技）速度一致。
   * ============================================================ */
  T.MARCH_UNIT = 1;
  /* ============================================================
   * v89.96（老板批注「伤害计算不要乱定系数，计算过程应当简洁」）：
   * v89.95 的 `T.DAMAGE_SCALE`（末端总闸）**已删除** —— 平衡一律在源头修：
   *   · 兵种耐久：hp ×10（data.js；杀率地基从 0.73/回合 → 0.073）
   *   · 属性覆盖：武力/谋略 每 20 点 +1%（genAttrs.atkPct/defPct，唯一换算原子）
   *   · 相克表：**v89.179 已全撤**（战斗按兵种纸面数值；沿革见 data.js 墓碑）
   * 伤害公式回到直读关系：k = perAtk × 数量 × cf ÷ perHp（无任何隐藏乘数）。
   * ============================================================ */
  /* v89.95（B2）：**单回合推进上限** = 纵深 × MARCH_CAP_FRAC。
     速度再高也不能一回合贴脸（老板：「一步到面前」）——超出的部分被截掉，
     于是"速度优势"表现为**早 1~2 回合接敌**，而不是"一轮打光"。 */
  T.MARCH_CAP_FRAC = 0.35;
  T.advanceCapOf = function (D) {
    return Math.max(60, Math.round((D || T.FIELD_MIN) * T.MARCH_CAP_FRAC));
  };

  /* ============================================================
   * v89.103（老板「两方应该在同一片战场上战斗」）：**前线几何**（唯一出口）
   * ------------------------------------------------------------
   * 战场是一条**共享的距离轴**：0 = 我军出发线，D = 敌军出发线。
   *   · 我方前线 = 我方最前**存活**部队的 adv（`frontAdvOf`）；
   *   · 敌方前线 = D − 敌方最前存活部队的 adv；
   *   · 间距     = D − 两方最前之和（与每回合记的 `gap` 同一公式）；
   *   · 接触     = 两军前沿间距已为 0（或已互相出手 —— 见 `hot`）。
   * 引擎的 `front()` 与沙盘/实时战场画的"前线/接触线"都读这里，
   * 界面不许另算一套（改前沙盘把两军各自钉在左右半场，中间 8% 是永久空档，
   * 于是"两半的兵永远不接触"）。
   *
   * `frontAdvOf`：全灭返回 **null**（不是 0）—— 调用方据此区分
   * "还没有人"与"人都在出发线上"（沙盘要靠它画"被攻入腹地"）。
   * ============================================================ */
  T.frontAdvOf = function (list) {
    var m = null;
    (list || []).forEach(function (u) {
      if (u.count > 0 && (m === null || u.adv > m)) m = u.adv;
    });
    return m;
  };
  /* 两军前线几何（唯一出口）。atkUnits/defUnits 只要有 {count, adv, er} 即可
     （引擎的部队、沙盘的态都满足）。
     ============================================================
     v89.104（老板）：「接触判定**按双方位移** —— 如果我一步来到你面前，
     你不能再往前移动；直到我这个兵种被完全消灭，你的后续移动才可以向前」
     ------------------------------------------------------------
     判据从"有没有开过火"（旧 hot 锁）改成**纯位置**：
       接触 = 两军前沿之间的空档 ≤ 双方最前部队的**有效射程**较大者。
     为什么用射程而不是 0：引擎的推进规则是"走到能开火就停"（free = gap − 射程），
     所以近战也是停在 gap = 射程（10~80）而不是贴到 0 —— 用射程判据，
     接触恰好发生在"两军都推不动了"的那一刻（位置事实，与打没打无关）。
     前沿互锁由引擎的推进规则保证：`adv ≤ D − 敌方前沿 − 射程`，
     任何一方都不可能推过对面（smoke/probe 有逐回合断言）。
     ============================================================ */
  T.frontsOf = function (atkUnits, defUnits, D) {
    D = D || T.FIELD_MIN;
    var fa = T.frontAdvOf(atkUnits), fd = T.frontAdvOf(defUnits);
    var aAlive = fa !== null, dAlive = fd !== null;
    /* 全灭的一方"前线"退回自己的出发线 —— 这就是"被攻入大军腹地" */
    var aAdv = aAlive ? Math.max(0, fa) : 0;
    var dAdv = dAlive ? Math.max(0, fd) : 0;
    var posA = aAdv;                       // 我方前沿（共享轴）
    var posD = D - dAdv;                   // 敌方前沿（共享轴）
    var gap = Math.max(0, posD - posA);    // 两军之间的空档
    var broke = !aAlive ? 'atk' : (!dAlive ? 'def' : null);
    /* 双方最前部队的有效射程（缺 er 时退回基础射程） */
    function reachOf(list) {
      var best = 0, m = null;
      (list || []).forEach(function (u) {
        if (u.count <= 0) return;
        if (m === null || u.adv > m) { m = u.adv; best = (u.er != null ? u.er : (u.range || 0)); }
      });
      return best;
    }
    var reach = Math.max(reachOf(atkUnits), reachOf(defUnits));
    var contact = gap <= reach;
    /* 接触线 = 两条前线的中点（= 两军贴着时就是那条贴着的线；
       还没接触时它落在两军之间的空地上，随两军推进而移动到中线）。 */
    var mid = broke ? (broke === 'atk' ? 0 : D) : (posA + posD) / 2;
    return {
      aFront: aAdv, dFront: dAdv,          // 两方最前（各自从本方出发线量）
      posA: posA, posD: posD,              // 两条前线的共享轴坐标
      gap: gap, reach: reach,
      contact: contact,
      broke: broke,                        // 'atk' | 'def' | null
      mid: mid,                            // 接触线位置
    };
  };

  /* ============================================================
   * v89.176（老板「谁在下一回合接敌」）：**接敌预测**（唯一出口）
   * ------------------------------------------------------------
   * 复刻 stepRound 的行动语义，对**当前快照**预演"本回合结束时各支走到哪"，
   * 再判定"下一回合谁将与敌交手"：
   *   · 行动顺序：速度降序、同速守方先（与 stepRound 的 order 同规）；
   *   · 目标选择：指定目标（在场）优先 → 否则"最近"（与 actSide 同规）；
   *   · 推进：free = gap − er（能开火就停）、每回合 ≤ spd、全局封顶 advanceCapOf(D)；
   *   · 开火：预演后 gap ≤ er（与 actSide 的 `if (gap <= effRange)` 同判据）。
   * 返回：
   *   fire     下一回合将开火的支 [{side, id, tgt, gap}]
   *   incoming 下一回合将挨打的支 [{side, id, by, gap}]（fire 的对偶）
   *   engage   合并集合 { 'atk|id': true, ... }（UI 角标按它标记）
   *   contact  两军前沿在预演后是否接触（frontsOf 同口径）/ gapAfter
   * ⚠️ 它是**预测**（给界面预警用），不参与任何结算：攻击造成的减员不在预演里
   *    （探针 probe_v89176e 逐回合对账，属于"预告"不是"保证"）。
   * ============================================================ */
  T.contactForecast = function (atkUnits, defUnits, D) {
    D = D || T.FIELD_MIN;
    var cap = T.advanceCapOf(D);
    var atk = (atkUnits || []).filter(function (u) { return u && u.count > 0; });
    var def = (defUnits || []).filter(function (u) { return u && u.count > 0; });
    function kk(side, id) { return side + '|' + id; }
    function erOf(u) { return (u.er != null ? u.er : (u.range || 0)) || 0; }
    var adv = {};
    atk.forEach(function (u) { adv[kk('atk', u.id)] = u.adv || 0; });
    def.forEach(function (u) { adv[kk('def', u.id)] = u.adv || 0; });
    var list = [];
    atk.forEach(function (u) { list.push({ u: u, side: 'atk' }); });
    def.forEach(function (u) { list.push({ u: u, side: 'def' }); });
    list.sort(function (x, y) {
      if ((y.u.spd || 0) !== (x.u.spd || 0)) return (y.u.spd || 0) - (x.u.spd || 0);
      return x.side === 'def' ? -1 : 1;      /* 同速守方先（与 stepRound 同规） */
    });
    function foesOf(side) { return side === 'atk' ? def : atk; }
    function posOf(side, id) {
      return side === 'atk' ? adv[kk('atk', id)] : D - adv[kk('def', id)];
    }
    function gapOf(side, id, foeSide, foeId) {
      /* 共享轴上两支的间距 —— 用**绝对值**（不依赖谁在左谁在右：
         atk 的 pos = adv、def 的 pos = D − adv，两侧比较时符号天然相反，
         用差值会在一侧恒为 0 —— 对账探针 probe_v89176e 修正）。 */
      return Math.abs(posOf(side, id) - posOf(foeSide, foeId));
    }
    function recOf(ent) {
      var foes = foesOf(ent.side);
      var pref = null;
      if (ent.u.target) {
        foes.forEach(function (e) { if (e.id === ent.u.target) pref = e; });
      }
      var best = null, bg = Infinity;
      (pref ? [pref] : foes).forEach(function (e) {
        var g = gapOf(ent.side, ent.u.id, ent.side === 'atk' ? 'def' : 'atk', e.id);
        if (g < bg) { bg = g; best = e; }
      });
      return best ? { e: best, gap: bg } : null;
    }
    /* 两轮：先全推（每支推一步）、再判定（用**最终位置**）。
       口径取舍（probe_v89176e 对账）：行动时刻版精确率高（81.7%）但漏报多（召回 62.5% ——
       不模拟击杀导致目标切换后够不着）；最终位置版召回高（95.6%）。
       界面是**预警**：宁多勿漏 → 取最终位置版。 */
    list.forEach(function (ent) {
      if ((ent.u.stance || 'advance') !== 'advance') return;
      var r0 = recOf(ent);
      if (!r0) return;
      var free = r0.gap - erOf(ent.u);
      if (free <= 0) return;
      var step = Math.min(ent.u.spd || 0, free, cap);
      if (step > 0) adv[kk(ent.side, ent.u.id)] += step;
    });
    var fire = [], incoming = [], engage = {};
    list.forEach(function (ent) {
      var r1 = recOf(ent);
      if (!r1) return;
      var foeSide = ent.side === 'atk' ? 'def' : 'atk';
      var g = gapOf(ent.side, ent.u.id, foeSide, r1.e.id);
      if (g <= erOf(ent.u)) {
        fire.push({ side: ent.side, id: ent.u.id, tgt: r1.e.id, gap: Math.round(g) });
        engage[kk(ent.side, ent.u.id)] = true;
        incoming.push({ side: foeSide, id: r1.e.id, by: ent.u.id, gap: Math.round(g) });
        engage[kk(foeSide, r1.e.id)] = true;
      }
    });
    /* 接触判定：用预演后的位置重算前沿（frontsOf 同口径） */
    var arrA = [], arrD = [];
    atk.forEach(function (u) { arrA.push({ count: 1, id: u.id, adv: adv[kk('atk', u.id)], er: erOf(u) }); });
    def.forEach(function (u) { arrD.push({ count: 1, id: u.id, adv: adv[kk('def', u.id)], er: erOf(u) }); });
    var fr = T.frontsOf(arrA, arrD, D);
    return { fire: fire, incoming: incoming, engage: engage,
      contact: fr.contact, gapAfter: fr.gap, reach: fr.reach, field: D };
  };
  /* 推算「几步到接触」—— 现在**接收战场距离本身**（`battlefieldOf` 算出），
     不再接场地种类：距离已经变成双方配兵的函数，"按场地查表"不成立了。
     界面把这条讲清楚，玩家才看得见兵种差异（机车 1 步 vs 器械靠射程先开火）。
     ⚠️ v89.139 注：这是**单侧**推进口径（"该兵种几步能开火"，用于攻城/机动对比）；
     两军迎面互推的接敌回合 = ⌈D ÷ (vA+vD)⌉，见 battlefieldOf 的 MARCH_ROUNDS_MIN 段。
     （v89.139 一度误判"零引用"而删 —— 实际 smoke §42 在用；引用面必须连测试一起 grep。） */
  T.stepsToWall = function (spd, range, D) {
    D = D || T.FIELD_MIN;
    var adv = 0, n = 0;
    /* 循环结束时 `adv + range >= D`，即**已经可以开火**，
       所以步数就是推进次数 n（不是 n+1 —— 多算一步会把伏击车的
       "1 步到墙"写成 2 步，与战场上的实际表现对不上）。 */
    while (adv + (range || 0) < D && n < 60) {
      var free = D - (range || 0) - adv;
      if (free <= 0) break;
      adv += Math.min(spd * T.MARCH_UNIT, free);
      n++;
    }
    return Math.max(1, n);
  };

  /* 回合上限（v57 · 老板拍板 40 → 30）
     原版：野战 30 回合，超时双方仍有兵 = 平局（极速版百科）；
     跨服「逐鹿中原」20 回合、自动/模拟战斗 10 回合 —— 那些属另设。 */
  T.MAX_ROUNDS = 30;
  /* v43：`T.VOLLEY_CAP`（单轮齐射上限）与 `T.CRAFT_CAP_BOOST` **已删除**。
     它们诞生于 v27（"一轮清场 → 战场条带只剩一帧"），但 v28 之后
     溢出杀伤 / 城头火力 / 守军固守 / 器械破城都已落地，多回合不再依赖它们；
     留下的只有副作用（按人头压制 → "龙枪兵"、指数衰减、偏袒人多一方）。
     完整论证见 actSide() 里杀伤计算处。 */

  /* ============================================================
   * 攻守常数（v28 · 需求 0）
   * ------------------------------------------------------------
   * 上一版有四处"看着有、其实没生效"，这里是补齐：
   *
   * ① 攻城器械（东风快递/东风快递/无人轰炸机）带 craft:true，但攻城加成只取
   *    `opts.siegeMult`，而它来自剧情羁绊/赛季国策，**默认恒为 1.0** ——
   *    于是花 19000 资源造一辆东风快递，对城市的伤害和一名步行机一模一样。
   *    实测对比（1.2 万攻 / 6000 守 / 聚落 Lv4 围墙）：
   *      纯步行机 1.2 万      损 8990
   *      步行机 9000 + 东风快递 3000  损 5155   ← 差距全来自"少了 3000 步行机"，器械本身没贡献
   *    现在给器械**内建**攻城倍率，与剧情加成相乘。
   *
   * ② 围墙 desc 写着「守军防御 +10N%、远程射程 +3N%」，实现里只有
   *    `wallLvl × 20` 加进城防值，另外两条从未落地。现按"城头火力"实现：
   *    守城时守方的远程与器械站在城上，**有效射程**随城防值放大
   *    （聚落 ≈1700 / 重镇 ≈2400 / 首府 ≈3450 / 旧都覆盖全场）。
   *
   * ③ 于是**战场纵深第一次真正产生战略含义**：
   *    纵深 4000 的攻城战，攻方要在城头火力下多走 2000 的距离（多挨十几轮箭雨）；
   *    纵深 2000 的野地战没有工事，攻方损失的轮数少得多。
   *    在此之前实测 2000/3000/4000 三档损兵是 59.8%/71.8%/59.8% —— 非单调，
   *    即"距离"当时只是走路回合数不同，与策略无关。
   *
   * ④ 攻方器械同时**拆城**：每多一类器械，守方城防减伤 ×0.8、城头火力 ×0.75
   *    （各最多叠 3 层）—— 这就是"带器械攻城"与"硬堆兵"的区别。
   * ============================================================ */
  /* ============================================================
   * 城防工事：箭塔（v59 · 老板"围墙改用箭塔吧，照搬原版"）
   * ------------------------------------------------------------
   * 取代 v58 的自定系数（城防值 × 120）。**数据与公式照搬原版**：
   *   · 4399 官方「城防介绍」：箭塔 生命 2000 · 攻击 300 · 防御 360 · 射程 1250
   *   · 射程 = 基础 ×(1 + 抛射) + 基础 ×(围墙等级 × 3%) + 100（墙位移）
   *     原版实测：十抛射十墙 → 1250 + 625 + 375 + 100 = **2350** ✓
   *     ⚠️ 这里是**加法**不是乘法：1250×1.5×1.3 = 2437 ≠ 2350。
   *     检索报告 §5.1 那张表的算式写作"×+30%"有歧义，只有结论数字
   *     （2250 + 100 = 2350）自洽 —— 本实现按加法口径。
   *   · **箭塔是可摧毁的**：耐久池 = 座数 × 2000 生命，攻城方把目标指定为箭塔
   *     即开始拆，火力随剩余座数线性衰减（原版战报：[守]箭塔6138-2390=3748）。
   *   · **双倍攻击区**：距离 ≤ 射程/2 + 100 时伤害 ×2
   *     （原版实测："箭塔 2350，双倍攻击区【0, 2250/2+100 = 1225】"）——
   *     这正是"贴脸拆箭塔"与"远处对射"收益差一倍的来源。
   *
   * ⚠️ `TW.perDef`（每 2 点城防值 = 1 座箭塔）是**映射系数、不是原版数据** ——
   *    原版由玩家自己建造工事，我们没有工事建造流程，只能把城防值折成座数。
   * ⚠️ `TW.tough` 是**量纲换算**：原版伤害量纲比本作大两个数量级
   *    （原版战报单次杀伤几百万，本作是几百），直接套 2000 生命会让一回合拆光全城箭塔。
   *    它只影响"拆箭塔要几回合"，不影响箭塔火力本身。
   * ============================================================ */
  var TW = DATA.WALL_TOWER;
  T.tower = TW;
  T.WALL_FIRE_RANGE_MAX = 3200;   /* 防爆护栏：照搬公式后正常玩法上限约 2875
                                     （满抛射 ×1.5 + 旧都围墙 24 级 ×0.72 → 2880） */
  T.WALL_DOUBLE_BASE = 0.5;       /* 双倍攻击区的边界 = 射程 × 0.5 + 墙位移 */
  T.WALL_POS = 100;               /* 攻城时围墙（箭塔）所在位置（原版："围墙在位置 100"） */
  /* v89.109（老板「出城迎战的兵种，将可以将我方前线前移，阻止敌军靠近围墙」）：
     出城迎战部队的初始前出位置 —— **围墙（100）之外**。三个效果都是引擎既有机制
     自然产生：① 打击排序按 adv 降序 → 它先挨打（"先杀出城迎战的军队"）；
     ② 攻方主目标恒为最靠前的敌部队 → 它挡在阵前，城头守军挨不到打；
     ③ 守方仍有出城部队存活时**攻方拆不到墙**（见 actSide 的 wantTower）。 */
  T.SORTIE_ADV = 200;
  T.wallTowerCount = function (defVal) {
    return (defVal > 0) ? Math.max(1, Math.round(defVal * TW.perDef)) : 0;
  };
  /* v62：箭塔座数的**显式取值口**。
     玩家城的箭塔有两个来源（城防折出 + 机工坊建造，见 `GAME.towerCountOf`），
     只传 `defVal` 表达不了"自建的那部分"，所以战斗允许调用方直接给座数
     （`opts.towers`）。不传时仍按城防折出 —— NPC 城走这条老路，行为不变。 */
  T.towerCountOfArg = function (defVal, towers) {
    if (towers != null) return Math.max(0, Math.floor(towers) || 0);
    return T.wallTowerCount(defVal);
  };
  /* 箭塔射程（照搬原版加法口径）。wallLv = 围墙等级；rangeBonus = 抛射科技 */
  T.arrowTowerRange = function (wallLv, rangeBonus) {
    var base = TW.range;
    return Math.round(base * (1 + (rangeBonus || 0)) + base * (wallLv || 0) * 0.03)
      + TW.wallOffset;
  };
  /* 城头火力的存在性判据从"城防值 > 0"改成"**箭塔座数 > 0**"（v62）——
     否则一座靠机工坊造满箭塔但城防值为 0 的城会"有塔却打不到人"。 */
  T.wallFireRangeRaw = function (defVal, wallLv, towers) {
    if (!(T.towerCountOfArg(defVal, towers) > 0)) return 0;
    return Math.min(T.WALL_FIRE_RANGE_MAX, T.arrowTowerRange(wallLv, TB('range')));
  };
  T.wallFireRange = function (defVal, D, wallLv, towers) {
    var raw = T.wallFireRangeRaw(defVal, wallLv, towers);
    return raw > 0 ? Math.min(D, raw) : 0;
  };
  /* 箭塔齐射的攻击值 = 座数 × 300（原版箭塔攻击） */
  T.wallFirePower = function (towerCount, aliveRatio) {
    var n = towerCount * (aliveRatio == null ? 1 : aliveRatio);
    return (n > 0) ? Math.round(n * TW.atk) : 0;
  };
  /* 双倍攻击区（原版）：近半个射程内，箭塔打双倍 */
  T.wallDecay = function (gap, wallRange) {
    if (!(wallRange > 0)) return 1;
    return (gap <= wallRange * T.WALL_DOUBLE_BASE + TW.wallOffset) ? 2 : 1;
  };
  /* ---------- 阵位（v59 · 照搬原版 §九）----------
     动作决定**初始站位**：前进 = 100（第一排）/ 防御 = 50（第二排）/ 后退 = 0（第三排）。
     我们的 `adv` 轴就是"前出距离"，所以行位直接当初始 adv。 */
  T.STANCE_ROW = {};
  (DATA.STANCES || []).forEach(function (x) { T.STANCE_ROW[x.id] = x.row; });

  /* ============================================================
   * v91.95（老板「动作要有代价」）：**动作三角** —— 唯一口径
   * ------------------------------------------------------------
   * 数值全部在 DATA.STANCES（dmg / taken / takenLater），这里只读不写死。
   *   · 输出倍率 `dmg`：驻守 −20%，其余 100%（原版"防御照常开火"的口径保留）；
   *   · 受创倍率 `taken`：驻守首回合 0.75、**连用第 2 回合起 0.9**（防龟缩），
   *     后退 1.25（背身），前进 1。
   * 旧版是 hold 一刀 −50% 且无任何代价 —— 实测"全体守住"把战损从 53.6% 压到 4.4%，
   * 属支配动作。改法不是单纯砍数值，而是让**每个动作都同时有收益和代价**。
   * ⚠️ `holdRun`（连续驻守回合数）由 stepRound 每回合结算前维护，随单位对象走。
   * ============================================================ */
  T.stanceDefOf = function (id) {
    var hit = null;
    (DATA.STANCES || []).forEach(function (x) { if (x.id === id) hit = x; });
    return hit;
  };
  /* 该单位**打出**的伤害倍率（驻守 −20%） */
  T.stanceDmgMul = function (u) {
    if (!DATA.STANCE_TRIANGLE_ON) return 1;                 /* 旧口径：动作不影响输出 */
    var d = u && T.stanceDefOf(u.stance);
    var m = (d && d.dmg != null) ? d.dmg : 1;
    /* v91.97：移动开火惩罚 —— 与移动目标难打对称（一个是打不准，一个是难被瞄） */
    var mvd = (u && u._moved) || 0;
    if (T.MOVE_FIRE_CUT > 0 && mvd > 0) m *= 1 - T.MOVE_FIRE_CUT * Math.min(1, mvd / T.MOVE_TARGET_REF);
    return m;
  };
  /* 该单位**受到**的伤害倍率（驻守 0.75/0.9 · 后退 1.25） */
  /* v91.95：**移动目标难打** —— 本回合走了多远（移动段写 u._moved），走满 REF 吃满折扣。
     ★ 只对**远程**射手生效（`shooter.range ≥ 500`）：这是"打移动靶"的物理直觉 ——
       敌人跑动时提前量难算；而**近战已经贴身**，目标跑不跑都照样砍到。
     第一版没加这道门，近战也被折了 0.6 倍，等于把所有接敌动作一起削，
     实测立刻压塌三条纸面断言（首轮齐射 20→12、拆械 ×3 失效、防御排序并列）。
     `shooter` 省略时按"远程"处理（旧调用/城头箭塔），保持纯函数可单测。 */
  T.moveTargetMul = function (tg, shooter) {
    if (!DATA.STANCE_TRIANGLE_ON) return 1;                  /* 旧口径：移动不折损 */
    if (shooter && (shooter.range || 0) < 500) return 1;     /* 近战：贴身了，不打折扣 */
    var mvd = (tg && tg._moved) || 0;
    if (mvd <= 0) return 1;
    return 1 - T.MOVE_TARGET_CUT * Math.min(1, mvd / T.MOVE_TARGET_REF);
  };
  T.stanceTakenMul = function (u) {
    /* v109（C2 坚守）：**关门死守** —— 选了坚守的守方，依托城墙/街垒，
       受创只剩 35%。没有这一条，兵力悬殊时守方两回合就被打光，
       "撑 N 回合"这个目标根本够不到（探针实测：400 vs 5000 两回合全灭）。 */
    if (u && u.siegeHold) return T.HOLD_SIEGE_TAKEN;
    if (!DATA.STANCE_TRIANGLE_ON) {                          /* 旧口径：仅驻守受创减半 */
      return (u && u.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
    }
    var d = u && T.stanceDefOf(u.stance);
    if (!d) return 1;
    if (u.stance === 'hold' && (u.holdRun || 0) >= 2 && d.takenLater != null) return d.takenLater;
    return (d.taken != null) ? d.taken : 1;
  };
  T.HOLD_DAMAGE_CUT = 0.5;   /* legacy：动作三角关闭时沿用「驻守受创减半」旧口径 */
  T.HOLD_SIEGE_TAKEN = 0.35; /* v109：坚守时守方受创（依托城墙，换存活） */
  T.HOLD_SIEGE_DMG = 0.55;   /* v109：坚守时守方输出（不主动出击，换存活） */
  /* v91.95：**追击** —— 对后退中的敌人，推进步长 ×1.35（追逃兵更容易）。
     没有这条，风筝流在"双方速度相等"下就是无损白嫖（实测：全体后退 损 0%、拖满 30 回合）。 */
  T.CHASE_MUL = 1.35;
  /* v91.95：**移动目标难打** —— 对"本回合移动过"的目标，远程/近战命中都打折（最低 ×0.6）。
     没有这条，谁站桩谁白打过来的那一方（实测：全体驻守损 11~15%、全体前进损 55~70%）。 */
  T.MOVE_TARGET_REF = 400;   /* 一回合移动 ≥ 该值即吃满折损 */
  /* v91.97：**移动开火惩罚** —— 边走边打打不准（输出 ×(1−0.3)）。
     没有这一条，「推进」在任何参数下都不吃亏：单位可以一边全速前进一边满额开火，
     于是"站定/结阵"永远只是白挨打（实测见 docs §10 与 §11）。 */
  T.MOVE_FIRE_CUT = 0;      /* v91.100：停用 —— 实测它与"移动目标难打"一起把远程整体削 20%+，
                               却没换来任何取舍（单位走到射程内就停，惩罚只在接敌那一两回合生效）。 */
  T.MOVE_TARGET_CUT = 0;    /* v91.100：停用，理由同上（动作的取舍改由"守/退的输出代价"承担） */   /* 折扣上限：×0.8 —— 必须 < 驻守的减伤(0.25)，否则跑动两轴全赢 */
  T.CRAFT_SIEGE_MULT = 2.2;   // 攻城器械对城市的内建伤害倍率
  T.WALL_FIRE_MUL = 0.55;     // 城头射击强度（不如平地齐射密集）
  T.CRAFT_DEF_CUT = 0.8;      // 每类器械：守方城防减伤 ×0.8
  T.CRAFT_FIRE_CUT = 0.75;    // 每类器械：城头火力 ×0.75
  T.CRAFT_STACK = 3;          // 拆城/压制最多叠 3 层
  /* v43：`T.CRAFT_CAP_BOOST` 已随单轮上限一并删除。
     v28 加它是因为"杀伤被 VOLLEY_CAP 卡死，攻城倍率换不来杀伤"；
     现在上限没了，器械的内建攻城倍率（CRAFT_SIEGE_MULT）**直接生效**，
     破阵价值由"拆城"三项（城防减伤 / 城头火力 / 内建倍率）承担，无需额外上限加成。 */

  T.GRID_COLS = 48;       /* 文字战场网格宽度（字符数） */

  /* ---------- 取值包装（battle.js 的私有工具，这里通过导出的接口取） ---------- */
  function TB(type) {
    return (GAME.battle && GAME.battle.techOf) ? GAME.battle.techOf(type) : 0;
  }
  function spdMult(t) {
    return (GAME.battle && GAME.battle.spdMult) ? GAME.battle.spdMult(t) : 1;
  }
  function hpMult(gen) {
    return (GAME.battle && GAME.battle.hpMult) ? GAME.battle.hpMult(gen) : 1;
  }
  /* v42 清理：`totalCount(army)` 已无调用点（兵力合计一律走战报里的 atkStartBy），
     属"闭包内局部死函数"—— audit 看不见这类，靠 smoke 的局部函数零调用门禁抓出。 */

  /* ============================================================
   * 部队展开：把 {兵种: 数量} 变成可行动的"部队单位"
   * ============================================================ */
  T.unitsOf = function (army, side, gen, ctx) {
    var a = gen && GAME.genAttrs ? GAME.genAttrs(gen) : null;
    /* v96：**兵员等级**（`ctx.lvMap = {兵种: 1..5}`）—— 每级 +7% 生/攻/防。
       加成走的是既有的 atkPct/defPct 百分比链与 hpPer，不另造一套数值通道；
       `lvMap` 由调用方按"这支部队是从哪座城出来的"给。 */
    var lvMap = (ctx && ctx.lvMap) || null;
    var lvPer = ((GAME.DATA && GAME.DATA.TROOPLV) || {}).gainPerLv;
    if (lvPer == null) lvPer = 0.07;
    /* v98.2：**作战目标的战场修正**（`ctx.goalMod = {atk, def, hp}`）。
       带得越少，攻越高、防越低、血越薄 —— 走的是既有的 atkPct/defPct/hpPer，
       不另造数值通道，所以战报里的数字与引擎结算永远同一份。
       只有**攻方**吃这个修正（守方还是照城防打）。 */
    var gMod = (ctx && ctx.goalMod) || null;
    var out = [];
    Object.keys(army || {}).forEach(function (id) {
      var t = DATA.TROOPS[id], n = Math.floor(army[id] || 0);
      if (!t || n <= 0) return;
      /* v28：侦察单元（nocombat）是侦察单元，不列阵也不挨打 ——
         它能以 3000 的速度一回合冲到对方面前，射程却只有 20，
         参战只会白白送掉。 */
      if (t.nocombat) return;
      /* 指挥覆盖：指挥×100 之内吃满加成，超出部分不吃（与本作既有口径一致）。
         v89.115（老板「守将在守城作战中，其属性对参与守城的军队（也就是城内所有军队）
         进行属性加成」）：**守城战**（ctx.playerDef 且本方为守方）改为**全覆盖** ——
         守将的属性加成不打指挥折扣（"城内所有军队"人人有份）；
         野战/攻城的口径不动（指挥覆盖 = 阵前指挥半径，是既有语义）。
         ⚠️ NPC 守城不在此列（其守将为系统派生，口径保持原样，不给攻城平衡添变量）。 */
      /* v91.92（老板拍板）：覆盖与「指挥溢出减伤」共用唯一出口 GAME.coverOf
         （与 battle.js / 战力评估同源，指挥每点覆盖多少兵只有这一份定义）。
         守城"全覆盖"那条特例只放宽 cover，不影响 dr —— dr 按真实覆盖量算，不白送。 */
      var cv = a ? GAME.coverOf(a.tong, 1 + TB('command'), n) : { cover: 0, dr: 0 };
      var cover = cv.cover;
      if (ctx && ctx.playerDef && side === 'def' && a) cover = 1;
      var dr = cv.dr;
      /* v59（阵位与指挥指令）：每支部队带**动作**与**目标**（照搬原版 §九）。
         动作决定初始站位 —— 前进 = 100（第一排）/ 防御 = 50（第二排）/ 后退 = 0（第三排），
         所以初始 `adv` 不再是 0，而是该动作的行位。 */
      /* `ctx.override` 是**引擎级**的阵位覆盖（smoke 用来对比"同一支部队在不同动作下"
         的结果，也供将来做防守战术时复用）。玩家侧只有攻方战术，见 GAME.tacticOf。 */
      var tc = (ctx && ctx.override && ctx.override[id])
        || (GAME.tacticOf ? GAME.tacticOf(side, id, ctx) : null);
      var stance = tc ? tc.s : 'advance';
      /* v89.116（老板「敌方兵种默认前进且目标为自身兵种」）——
         **NPC 那一侧**（`ctx.foeArmy` 有值 = 对面就是玩家）若没指定目标，
         默认打**与我方同兵种**的那支部队（我方没有该兵种 → 保持"任意"）。
         为什么放在引擎里：默认值必须进 `unitsInit`（战报配方就是从它重跑的），
         放在界面里改 = 沙盘重跑与史实不一致（verify 会红）。
         只给 NPC 侧：玩家部队的默认值由「出征 / 防守战术」给，不被这里改写。 */
      /* v89.149（老板 4）：「行动和目标设置的下拉框，**默认显示前进和同兵种**，比如开局都是前进，
         **自走火炮打自走火炮，伏击车打伏击车**」——
         v89.116 只给 NPC 一侧这个默认；本版**两侧同规**：未指定目标 → 默认打**对面同名兵种**
         （对面没有该兵种时，选靶逻辑会自然回落到"最近的敌队"，不需要额外兜底）。
         `DATA.TARGET_ANY`（战术页的「任意」）= **显式不指定** → 还原成空串（打最近的）。
         ⚠️ 必须落在**引擎**里（而不是界面）：默认值要进 `unitsInit`，战报沙盘从它重跑 ——
            放界面 = 史实与重跑不同源（v89.116 §20.5 的教训）。 */
      var tgt = tc ? (tc.t || '') : '';
      if (tgt === DATA.TARGET_ANY) tgt = '';
      else if (!tgt) tgt = id;
      /* v89.109：防守侧「出城迎战」—— 前出到围墙之外（不改动作，改初始位置） */
      var sortie = !!(tc && tc.sortie);
      var _lv = lvMap ? Math.max(1, Math.min(5, lvMap[id] | 0 || 1)) : 1;
      var _lvMul = 1 + lvPer * (_lv - 1);
      var _gHp = gMod ? Math.max(0.4, 1 + (gMod.hp || 0)) : 1;
      out.push({
        id: id, name: t.name, side: side, count: n, start: n,
        hpPer: Math.max(1, Math.round(t.hp * _lvMul * _gHp)), range: t.range,
        lv: _lv,
        spd: Math.round(t.spd * spdMult(t) * (1 + (a ? (a.spd || 0) : 0) / 300)),
        cover: cover,
        dr: dr,                     /* v91.92：指挥溢出减伤（受击时按 1−dr 生效） */
        stance: stance,
        target: tgt,
        sortie: sortie,
        adv: sortie ? T.SORTIE_ADV : (T.STANCE_ROW[stance] || 0),
        /* v89.96（老板「控制影响战斗的其他因素」）：攻/防加成**只走一个来源** ——
           genAttrs 的 atkPct/defPct（唯一换算原子见 domain.js atkPctOf/defPctOf）。
           旧版在这里散装 yw/zm/eqAtk/eqDef 四个字段、在 perAtk/perDef 里各乘一遍，
           与 UI 展示（v52 换算链）相差 4 倍 —— 属"显示与实战分离"，已并链。 */
        atkPct: (a ? (a.atkPct || 0) : 0) + (_lvMul - 1) + (gMod ? (gMod.atk || 0) : 0),
        defPct: (a ? (a.defPct || 0) : 0) + (_lvMul - 1) + (gMod ? (gMod.def || 0) : 0),
        vsCity: !!t.craft,
      });
    });
    return out;
  };

  /* 该部队的**单位**攻击值（不含数量）：兵种基础攻 × 加成链
     （英雄/装备 → 科技 → 符 → 剧情 → 攻城）。
     v89.96：英雄与装备**合入同一条百分比链**（genAttrs.atkPct，每 20 点武力 +1%、
     装备每 10 攻值 +1%）—— 旧版把装备攻击值当"绝对值加到兵种攻上"
     （自走火炮 220 + 装备 8000 = ×37），与 UI 展示链相差 4 倍；已并链。 */
  T.perAtk = function (u, opts) {
    opts = opts || {};
    var t = DATA.TROOPS[u.id];
    var base = t.atk;                                  // 兵种基础攻（唯一来源）
    var pct = 1 + (u.atkPct || 0) * (u.cover || 0);    // 英雄+装备（atkPct 唯一换算原子）
    pct *= (1 + TB('atk'));                            // 战斗条令等
    var s = GAME.state;
    if (GAME.systems && GAME.systems.buffActive && GAME.systems.buffActive('military')
      && s && s.buffs && s.buffs.military && s.buffs.military.atk) {
      pct *= (1 + s.buffs.military.atk);          // 冲锋号
    }
    if (GAME.story && GAME.story.atkMult) pct *= GAME.story.atkMult();
    /* v28：攻城器械的**内建**攻城倍率（与剧情加成相乘） */
    if (opts && opts.sieging && u.vsCity) pct *= (opts.siegeMult || 1) * T.CRAFT_SIEGE_MULT;
    return base * pct;
  };

  /* 该部队的**单位**防御值（不含数量）：兵种基础防 + 装备防御×覆盖，再乘各类百分比
     * ============================================================
     * v29（需求 11）：防御从"生命值放大"改为**独立的一维**，与攻击对冲。
     * 理由：放大生命只影响"能挨多久"，不影响"这一击打进去多少"，
     * 于是高防部队的表现是"血条莫名很长"，与攻击力之间没有直接的制衡关系。
     * ============================================================ */
  T.perDef = function (u) {
    var t = DATA.TROOPS[u.id];
    var base = t.def;                                  // 兵种基础防（v89.96：装备并链）
    var pct = 1 + (u.defPct || 0) * (u.cover || 0);     // 英雄+装备（defPct 唯一换算原子）
    pct *= (1 + TB('def'));                             // 护甲/练兵一类科技
    return Math.max(1, base * pct);
  };

  /* 攻防对冲系数：2A / (A + D)
   *   A = D（攻防相当）  → 1.00　不增不减
   *   A = 2D（攻压制防） → 1.33
   *   A → ∞              → 2.00  封顶
   *   A → 0（攻不破防）  → 0     下限受"至少 1 人"保护，不会出现绝对免伤
   * 取 2A 而非 A 是为了让 A = D 时与旧公式**同量级**，避免整场战斗节奏被改写。 */
  T.clashFactor = function (A, D) {
    A = Math.max(0, A || 0); D = Math.max(0, D || 0);
    if (A + D <= 0) return 1;
    return DATA.CLASH.K * A / (A + D);
  };

  /* 受击部队的单位生命。
     v29（需求 11）：这里**只剩**兵种生命与补给/体力加成 ——
     谋略与装备护甲已移到 perDef()，不再重复计算（否则同一个防御属性被算两遍）。
     v89.96：耐久标定（原值 ×6）已并入表值 —— `hpPer = t.hp` 直读（见 data.js
     TROOPS 注释）；本函数只叠科技（TB('hp')）与英雄（hpMult）加成。
     ⚠️ v89.181 修正注释：原文写"×10"，与实现（unitsInit 的 `hpPer: t.hp`）不符 ——
     实测链 表 hp=1800 → hpPer=1800 → perHp=1800（无加成），见 probe_v89180e。 */
  T.perHp = function (u, defGen) {
    return Math.max(1, u.hpPer * (1 + TB('hp')) * hpMult(defGen));
  };

  /* ---------- 兵种相克（已退役）----------
     v89.179：克制系统全撤（老板「取消所有克制关系，直接按兵种纸面数据计算」）——
     `counterAtkOf / counterDefOf` 两条出口随 data.js 两张表一并删除：战斗伤害
     只剩"兵种纸面数值 × 加成链"，不再有"打谁 / 被谁打"的对局态乘数。
     历史注记：防御向出口曾误收 army 对象 → 整套防御向静默失效（全靠实测打印发现）；
     相克系统的功过与全撤依据见 docs/_史料/交付/v89179-克制全撤与纸面数据复核.md。 */
  

  /* ============================================================
   * 射程衰减（v57 · 老板拍板：补）
   * ------------------------------------------------------------
   * 原版：射程 **1/2 以内 = 全伤害**；**1/2 以外 = 半伤害**；
   *       **贴身 = 1/4**（两处来源写 1/4 与 1/10，取更保守的 1/4）。
   * 补它的意义：这才是"远程不能被近身"的机制来源 —— 改前我们用
   * "首轮 ×1.3"粗略代替（方向对，但没有距离轴）。补上之后，
   * **"推进到半程内"第一次成为有收益的动作**，机动与射程开始互相制衡。
   * ⚠️ 只对**远程**（射程 ≥ 500）生效：近战本来就是贴脸互殴，
   * 给它算"贴身惩罚"等于把所有近战伤害一律除以 4，回合数会翻几倍。
   * ============================================================ */
  /* v91.98：**推进的停点** —— 1.0 = 停在射程边缘（旧口径），0.5 = 停在近半程边界。
     ⚠️ 旧口径下单位恰好停在"远半程"（衰减 ×0.5），于是"前进"和"驻守"都在 50% 档上打，
     动作之间只剩那 20% 输出惩罚的差别 —— 这是"怎么调都没取舍"的直接原因。
     走到 0.5 才进"近半程"（×1.0），"前进 = 走近换伤害 / 驻守 = 留在远档保安全"才成立。 */
  T.ADVANCE_STOP_K = 1.0;
  T.ADVANCE_STOP_K_RANGED = 1.0;   /* 远程专用停点系数：**1.0 = 旧口径**（停射程边缘）；
                                     0.5 = 走近半程（衰减 ×1.0 那一档）。实测：改 0.5 会让镜像局
                                     战损 77%→79%、"远程vs近战潮" 19%→16%，净效果接近打平但战斗变短，
                                     故**默认保持 1.0**，只作可调旋钮留着。 */
  T.DECAY_FAR = 0.5;        // 半程以外
  T.DECAY_CLOSE = 0.25;     // 贴身
  T.CLOSE_RANGE = 120;      // "贴身"的界限（丈）
  T.DECAY_MIN_RANGE = 500;  // 低于此射程的兵种不受衰减（近战）
  T.rangeDecay = function (gap, effRange) {
    if (!(effRange > 0) || effRange < T.DECAY_MIN_RANGE) return 1;
    if (gap <= T.CLOSE_RANGE) return T.DECAY_CLOSE;
    if (gap <= effRange / 2) return 1;
    return T.DECAY_FAR;
  };

  /* ============================================================
   * 文字战场网格：一行 48 字符，左军右军相向
   * ============================================================ */
  T.strip = function (aAdv, dAdv, D) {
    var n = T.GRID_COLS;
    var aCol = Math.max(0, Math.floor(aAdv / D * n)); // 我军前锋所在列
                                                     // v59：后退会让 adv 为负，条带要兜底
    var dCol = Math.ceil((D - dAdv) / D * n);       // 敌军前锋所在列
    var out = '';
    for (var i = 0; i < n; i++) {
      if (i < aCol) out += '▓';
      else if (i >= dCol) out += '▓';
      else out += '·';
    }
    return out;
  };

  /* ============================================================
   * 主模拟
   *   atkArmy / defArmy : { 兵种: 数量 }
   *   atkGen / defGen   : 双方主将（都要参与加成 —— 需求明确）
   *   defVal            : 城防值（转为守方减伤）
   *   opts              : { kind:'wild'|'fort'|'city', sieging, defName }
   * ============================================================ */
  /* ============================================================
   * v89.87：T.begin —— 建立战斗**会话**（观战界面用）
   * ------------------------------------------------------------
   * 初始化逻辑与旧 T.simulate 完全同一套。返回 env：
   *   env.step()                        → 推进一回合（返回该回合 events/双方数量/间距/快照）
   *   env.runAll()                      → 跑到结束（≡ 旧 while 循环）
   *   env.finish()                      → 收尾组装 result（与旧返回结构完全一致）
   *   env.snap()                        → 双方部队状态快照（UI 画战场用）
   *   env.setCmd(side, troopId, {s,t})  → 为该兵种下达动作/目标指令
   *   env.units                         → { atk, def } 单位数组（内部引用）
   * 引擎**完全确定**（无随机）→ 会话可由「输入 + 逐回合指令」重放重建（存档恢复）。
   * ============================================================ */
  T.begin = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {
    opts = opts || {};
    /* v57：战场距离由**双方配兵**算出来（最远射程 + 199），不再是场地常数。
       `opts.field` 显式给了仍以它为准（旧战报回放 / 跨服类玩法另设距离）。 */
    var D = T.battlefieldOf(atkArmy, defArmy, defVal, opts);
    /* v91.86 · 星球环境（一步一景）：规则对**敌我双方**同时生效。
       落点只有三处：纵深（随射程等比缩）、单位速度/射程、每回合兵力流失。
       老家 env=none → 三个乘子都是 1，行为与 v91.85 逐字节一致。 */
    var _env = opts.env || (GAME.planetEnvOf
      ? GAME.planetEnvOf(opts.pid != null ? opts.pid : (GAME.curPid ? GAME.curPid() : 1))
      : null);
    /* 注意：纵深**不随环境缩放** —— 若连战场一起缩，"射程 −30%"对双方等比，等于没改。 */
    var s = GAME.state;

    var stances = opts.stances || {};
    /* v91.85：**显式指令白名单** —— 调用方通过 opts.stances 明确指定过的兵种，
       策略层一律不得改写（smoke 的"控制变量"对照、玩家的战术设置都靠这条保护）。 */
    var _explicit = { atk: {}, def: {} };
    ['atk', 'def'].forEach(function (sd) {
      var mm = stances[sd] || {};
      Object.keys(mm).forEach(function (id) { _explicit[sd][id] = true; });
    });
    /* v89.116：`foeArmy` 传"对面那支军队" —— 引擎据它给 **NPC 侧**一个默认目标
       （同兵种）。玩家在哪一侧由 `playerDef` 决定：默认玩家是攻方 → NPC 是守方。 */
    /* v98.2：作战目标（平推/强攻/斩首/奇袭）的战场修正 —— 按兵力比自动定档，
       **不接受外部指定**（否则玩家可以"带少兵却按平推打"，那就白送了）。
       守城战（playerDef）不给攻方修正：那是别人来打你，你的目标由城防决定。 */
    /* ⚠️ **只在玩家亲自出征时**给档位修正（`opts.playerAtk`）。
       第一版是无条件按兵力比算，结果把 NPC 互打、拆械测试、智能方案对比
       全改了 —— smoke §164③/§180②/§181② 三条当场红（平均战损 42.5%→63.5%）。
       这种"隐式全局改数值"是最危险的一类改动：谁都看不出是自己的锅。 */
    var _goalMod = null;
    if (opts.playerAtk && !opts.playerDef && GAME.goals && GAME.goals.tierOf) {
      var _sa = 0, _sd = 0, _k;
      for (_k in atkArmy) _sa += (atkArmy[_k] | 0);
      for (_k in defArmy) _sd += (defArmy[_k] | 0);
      var _t98 = GAME.goals.tierOf(_sa, _sd);
      _goalMod = (_t98 && _t98.mod) || null;

      /* v98.3：**指令牌的攻/防也在这里落地**。
         牌组原来只在战果层乘 loot/loss —— "齐射（攻 +8%）"、"结阵（防 +8%）"、
         "血勇（攻 +15%）"三张的攻击向效果**一处都没生效**（goals 只读 loot/rep/loss/wound）。
         现在折进同一个 goalMod（相加，不连乘）：两条来源都走 atkPct/defPct，
         战报里就是一份数。 */
      /* v101：**危险梯度**（A5）—— 越往迷雾深处，攻方生命越薄。
         它只削血，不减战利品（远处仍然更肥，只是更疼）。
         值来自 `opts.riskHp`（battle.js 在出征瞬间算好的快照）。 */
      if (opts.riskHp) {
        _goalMod = {
          atk: (_goalMod && _goalMod.atk) || 0,
          def: (_goalMod && _goalMod.def) || 0,
          hp: ((_goalMod && _goalMod.hp) || 0) + opts.riskHp
        };
      }

      /* v98.5：老兵等级（每级 +3% 攻）—— 同一份 goalMod，相加 */
      var _vet = (opts.atkVet || 0);
      if (_vet > 0) {
        _goalMod = {
          atk: ((_goalMod && _goalMod.atk) || 0) + _vet,
          def: (_goalMod && _goalMod.def) || 0,
          hp: (_goalMod && _goalMod.hp) || 0
        };
      }

      if (GAME.deck && GAME.deck.effOf) {
        /* v107（D3）：把主将传进去 —— 风格对不上的牌这一仗打不出去 */
        var _dk = GAME.deck.effOf(atkGen);
        if (_dk && (_dk.atk || _dk.def)) {
          _goalMod = {
            atk: ((_goalMod && _goalMod.atk) || 0) + (_dk.atk || 0),
            def: ((_goalMod && _goalMod.def) || 0) + (_dk.def || 0),
            hp: (_goalMod && _goalMod.hp) || 0
          };
        }
      }
    }
    var atk = T.unitsOf(atkArmy, 'atk', atkGen,
      /* v89.136（老板 4）：modeId 透传给 GAME.tacticOf —— 出征读"细分（掠夺/占领）覆盖通用" */
      { sieging: !!opts.sieging, override: stances.atk || null, modeId: opts.modeId || null,
        lvMap: opts.atkLv || null, goalMod: _goalMod,
        foeArmy: opts.playerDef ? defArmy : null });
    var def = T.unitsOf(defArmy, 'def', defGen,
      /* v89.109：`playerDef` = 守方是**我方城市**（防御战）→ 读玩家「防守战术」设置；
         NPC 守方不传（仍用默认动作）—— 见 GAME.tacticOf 的 def 分支。 */
      { sieging: !!opts.sieging, playerDef: !!opts.playerDef, override: stances.def || null,
        modeId: opts.modeId || null,
        lvMap: opts.defLv || null,
        foeArmy: opts.playerDef ? null : atkArmy });
    /* v28：起始兵力只算**参战部队** —— 侦察单元不参战也不阵亡，
       若把它的数量算进 aStart，收尾的 atkLoss = aStart − aRemain 会把它记成"损失"。 */
    /* v91.86：环境乘子落到双方每一支部队（速度影响行动序与接敌，射程影响开火门槛） */
    if (_env && ((_env.spd && Math.abs(_env.spd - 1) > 1e-9) || (_env.range && Math.abs(_env.range - 1) > 1e-9))) {
      var _envApply = function (u) {
        if (_env.spd && Math.abs(_env.spd - 1) > 1e-9) u.spd = u.spd * _env.spd;
        /* 只削远程：近战射程本来就贴着身，等比缩等于没设计 */
        if (_env.range && Math.abs(_env.range - 1) > 1e-9 && u.range >= 800) u.range = u.range * _env.range;
      };
      atk.forEach(_envApply); def.forEach(_envApply);
    }
    var aStart = atk.reduce(function (n, u) { return n + u.start; }, 0);
    var dStart = def.reduce(function (n, u) { return n + u.start; }, 0);
    /* v89.109：出城迎战部队的初始人数（掠夺前置判据"先歼灭野战军"要用） */
    var defSortieStart = 0;
    def.forEach(function (u) { if (u.sortie) defSortieStart += u.start; });
    var scoutOnly = 0;
    Object.keys(atkArmy || {}).forEach(function (id) {
      var t0 = DATA.TROOPS[id];
      if (t0 && t0.nocombat) scoutOnly += Math.floor(atkArmy[id] || 0);
    });

    /* 城防（守方减伤）+ 守方英雄的城防加成（谋略已在生命里体现，这里只算城防工事） */
    var defBonus = Math.min(0.85, (defVal || 0) / 200);
    var siegeMult = (opts.sieging && GAME.story && GAME.story.siegeMult) ? GAME.story.siegeMult() : 1;

    /* 攻方攻城器械：拆城（削城防减伤）+ 压制城头火力 */
    var craftKinds = 0;
    atk.forEach(function (u) { if (u.vsCity) craftKinds++; });
    craftKinds = Math.min(T.CRAFT_STACK, craftKinds);
    if (opts.sieging && craftKinds > 0) {
      defBonus *= Math.pow(T.CRAFT_DEF_CUT, craftKinds);
    }
    var wallRange = opts.sieging ? T.wallFireRange(defVal, D, opts.wallLv, opts.towers) : 0;
    var wallFireMul = Math.pow(T.CRAFT_FIRE_CUT, craftKinds);

    var roundsLog = [], strips = [], log = [];
    var round = 0;

    function alive(list) {
      var out = [];
      list.forEach(function (u) { if (u.count > 0) out.push(u); });
      return out;
    }
    /* 前锋位置 = 存活部队里**最大**的 adv（唯一实现在 T.frontAdvOf，界面也读它）。
       ⚠️ v59 修正：初值原本写 `var m = 0` —— 而"后退"动作会让 adv 变成**负数**
       （退到自己出发线之后），于是负位置永远不大于 0、front 被钳在 0，
       **"后退拉开距离"整个失效**（实测：自走火炮连续后退，间距却恒定 1349、被箭塔白打 24 回合）。
       改用 null 哨兵，允许负值。 */
    function front(list) {
      var m = T.frontAdvOf(list);
      return m === null ? 0 : m;
    }
    /* 攻守两方共用一条距离轴：间距 = 纵深 − 我方推进 − 敌方推进 */
    function gapOf(u, enemyFrontAdv) {
      return Math.max(0, D - u.adv - enemyFrontAdv);
    }

    /* 一次开火：把 shooter 的攻击力按"由近及远"落到 enemyUnits 上（溢出杀伤）。
       v57：抽成函数是为了**反击复用** —— 反击与主动攻击的伤害算法必须完全一致，
       否则"反击伤害偏低"会变成一个很难查的暗偏差。 */
    /* v91.99：**可打池 = 结算与战报共用的唯一口径**
       接触面把近战的可打范围收窄到对方占位的单位；若只在 fireOnce 里过滤、
       而 actSide 仍按最近的挑战报目标，就会出现战报写的是甲、伤害落在乙——
       表现是战报帧对不上账（smoke §②帧自洽 当场抓到）。 */
    function targetPoolOf(shooter, enemyUnits) {
      var pool = enemyUnits.filter(function (e) { return e.count > 0; });
      if (DATA.CONTACT && DATA.CONTACT.on
          && (shooter.range || 0) < (DATA.CONTACT.meleeRange || 500)) {
        var fr = pool.filter(function (e) { return e._front; });
        if (fr.length) pool = fr;
      }
      return pool;
    }
    function fireOnce(shooter, enemyUnits, ctx) {
      /* v91.95：**动作三角 · 输出侧** —— 驻守 −20%（前进/后退全额）。
         唯一落点：主动攻击、反击、拆箭塔全走这里（反击复用本函数）。 */
      var perA = T.perAtk(shooter, { sieging: !!opts.sieging, siegeMult: ctx.siegeMult })
        * T.stanceDmgMul(shooter);
      /* v89.180（老板 1「补无人轰炸机拆器械特性」）：**拆械**唯一出口 ——
         无人轰炸机兵种表 `vsMech`（对器械的最终伤害倍率）× 目标兵种表 `mech` 标签。
         主动攻击与反击都走 fireOnce，故此处一处即全覆盖；其余对位零影响。 */
      var _shT180 = DATA.TROOPS[shooter.id] || {};
      var mechMulOf = function (tgId) {
        if (!_shT180.vsMech || !tgId) return 1;
        var _vt180 = DATA.TROOPS[tgId];
        return (_vt180 && _vt180.mech) ? _shT180.vsMech : 1;
      };
      /* v91.08（老板）：拆械 × 克制 —— 两者都按"攻方 vs 守方兵种"定最终伤害倍率，合并一处。 */
      var unitMulOf = function (tgId) { return mechMulOf(tgId) * (T.counterMulOf ? T.counterMulOf(shooter.id, tgId) : 1); };
      var av = perA * shooter.count * (ctx.decay || 1);
      if (ctx.onWall) av *= T.WALL_FIRE_MUL * (ctx.wallFireMul || 1);
      if (ctx.defBonus > 0) av *= Math.max(0.05, 1 - ctx.defBonus);
      var pool = targetPoolOf(shooter, enemyUnits)
        .sort(function (x, y) { return y.adv - x.adv; });      // 越靠前越先挨打
      /* v59（指挥指令）：**指定目标在射程内 → 优先打它**（照搬原版 §九）——
         实现方式是把该兵种排到打击序列最前，伤害优先落在它头上，
         溢出部分才继续按"由近及远"分配（与既有的溢伤模型一致）。 */
      if (ctx.preferId) {
        pool.sort(function (x, y) {
          var px = (x.id === ctx.preferId) ? 0 : 1;
          var py = (y.id === ctx.preferId) ? 0 : 1;
          return (px - py) || (y.adv - x.adv);
        });
      }
      var hits = [], killed = 0, clash = 1;
      /* ============================================================
       * v89.87（老板拍板）：**主动攻击 = 单主目标制**
       * ------------------------------------------------------------
       *   · 主目标 = 指定目标（`preferId` 已排到池首）/ 否则最近的一支；
       *   · 主目标吃满本次攻击的全部伤害（自然钳制：最多打光它）。
       * v89.95（B1 · 老板「一回合只对一个目标兵种出手，后续无溅射伤害」）：
       *   · **删除溅射** —— 主目标被打光后，**溢出伤害作废**，不再分给别的兵种；
       *   · 连带效果：一回合最多打掉**一支**部队，战斗从 1~3 回合拉长到多回合，
       *     "逐兵种指挥/阵位/计略"这些决策才真正有回本的空间。
       * 反击（counterStrike）本来就是"只打打我那一支"，天然合规。
       * ============================================================ */
      if (ctx.single && pool.length) {
        var tg0 = pool[0];
        var perHp0 = T.perHp(tg0, ctx.defGenOfTarget);
        var cf0 = T.clashFactor(perA, T.perDef(tg0));
        var holdMul0 = T.stanceTakenMul(tg0);      /* v91.95：动作三角（受创倍率） */
        /* v91.92：指挥溢出减伤 —— 与"防御动作减伤"同层相乘，不另开一条旁路 */
        var drMul0 = 1 - (tg0.dr || 0);
        var eff0 = av * cf0 * holdMul0 * drMul0 * T.moveTargetMul(tg0, shooter) * unitMulOf(tg0.id);
        /* v89.96：取整用 **round** 而不是 floor ——
           floor 会让"伤害不足一个人份"的攻击恒为 0 杀：实测步行机 20v20
           （每回合 0.625 人份）双方站着不动到 30 回合（卡死）。
           round 的口径是"伤害接近一个人份就算一个战损"，小规模战斗必收敛；
           大部队（每次几百上千杀）round ≈ floor，节奏不受影响。 */
        var k0 = Math.round(eff0 / perHp0);
        if (k0 > tg0.count) k0 = tg0.count;          // 自然钳制：不能杀超过目标实有人数
        var over = eff0 - k0 * perHp0;               // 主目标吃满后的**超出伤害**
        clash = cf0;
        if (k0 > 0) {
          tg0.count -= k0;
          killed += k0;
          hits.push({ id: tg0.id, name: tg0.name, kill: k0 });
        }
        /* v89.95（B1）：溢出作废 —— 不再对别的兵种溅射（一击一目标） */
        return { killed: killed, hits: hits, clash: Math.round(clash * 100) };
      }
      for (var pi = 0; pi < pool.length && av > 0; pi++) {
        var tg = pool[pi];
        var perHp = T.perHp(tg, ctx.defGenOfTarget);
        var cf = T.clashFactor(perA, T.perDef(tg));
        /* v59：**防御动作受到的伤害减半**（报告 §九） */
        var holdMul = T.stanceTakenMul(tg);           /* v91.95：动作三角（受创倍率） */
        var drMul = 1 - (tg.dr || 0);                 /* v91.92：指挥溢出减伤 */
        var eff = av * cf * holdMul * drMul * T.moveTargetMul(tg, shooter) * unitMulOf(tg.id);
        var k = Math.round(eff / perHp);             /* v89.96：同 single 分支，round 防小规模卡死 */
        if (k <= 0) break;
        if (k > tg.count) k = tg.count;      // 自然钳制：不能杀超过目标实有人数
        tg.count -= k;
        av = Math.max(0, eff - k * perHp);
        killed += k;
        clash = cf;
        hits.push({ id: tg.id, name: tg.name, kill: k });
      }
      return { killed: killed, hits: hits, clash: Math.round(clash * 100) };
    }

    /* 城防减伤只保护**守方**（攻方没有工事可依） */
    function defBonusAgainst(targetSide) { return targetSide === 'def' ? defBonus : 0; }

    /* ============================================================
     * 城头箭塔（v59 · 每回合齐射一次）
     * ------------------------------------------------------------
     * 座数 = 城防值折出的箭塔数；耐久池 = 座数 × 2000（原版箭塔生命）；
     * 火力 = **存活座数** × 300（原版箭塔攻击）× 城头密集度修正。
     * 箭塔可以被攻方指定为目标摧毁（见 actSide），火力随之线性衰减 ——
     * 这就是原版攻城战"先拆箭塔再上墙"的循环。
     * ============================================================ */
    /* v62：座数走 T.towerCountOfArg —— `opts.towers` 显式给出时以它为准
       （玩家城 = 城防折出 + 机工坊建造），否则按城防折出（NPC 城）。 */
    var towerStart = T.towerCountOfArg(defVal, opts.towers);
    var towerDmg = 0;                      /* 已累积的耐久损失（点数） */
    function towerAliveNow() {
      var left = towerStart * TW.hp - towerDmg;
      return Math.max(0, Math.ceil(left / TW.hp));
    }
    function towerHit(dmg) {
      towerDmg += dmg;
      return towerAliveNow();
    }
    /* 攻方与箭塔的距离：箭塔在守方阵线前沿（原版："攻城时围墙在位置 100"） */
    function towerGap(unit) { return Math.max(0, D - unit.adv - T.WALL_POS); }

    function wallVolley(enemyUnits, events) {
      var alive0 = towerAliveNow();
      if (!opts.sieging || wallRange <= 0 || alive0 <= 0) return;
      var power = T.wallFirePower(alive0);
      if (power <= 0) return;
      var av = power * wallFireMul;
      var pool = enemyUnits.filter(function (e) { return e.count > 0; })
        .sort(function (x, y) { return y.adv - x.adv; });
      var hits = [], killed = 0, dbl = 0;
      /* v89.95（B1）：城头火力同样**一击一目标** —— 只打射程内最靠前的那一支。
         改前是"由近及远逐个分伤"，同样属于溅射的一种（一轮打掉两三支）。 */
      var _poolOne = pool.slice(0, 1);
      for (var pi = 0; pi < _poolOne.length && av > 0; pi++) {
        var tg = _poolOne[pi];
        /* ⚠️ v59：**必须按射程筛目标** —— 改前这里无条件打遍全场（v58 的城头射程
           几乎覆盖整个战场，所以那个漏检看不出来）；v59 后箭塔射程有真实上限
           （2350 一级），不筛就会出现"攻方退到射程外仍被箭塔打"的怪象
           —— 实测：自走火炮连续后退到间距 2931、箭塔射程只有 1650，却仍每回合被杀 128 人，
           于是"后退躲箭塔"这条原版核心战术**根本用不出来**。
           按 adv 降序排列，所以一旦某支够不着，后面的更够不着 → 直接收工。 */
        if (towerGap(tg) > wallRange) break;
        /* 城头是箭塔：结算只按纸面数值（v89.179 克制全撤 —— 防御向判定已删）。 */
        var perHp = T.perHp(tg, atkGen);        /* 打的是攻方 → 用攻方英雄的生命加成 */
        var cf = T.clashFactor(power, T.perDef(tg));
        /* 双倍攻击区（原版）：距离在"射程/2 + 100"以内 → 箭塔打双倍 */
        var dec = T.wallDecay(towerGap(tg), wallRange);
        if (dec > 1) dbl++;
        var holdMul = T.stanceTakenMul(tg);           /* v91.95：动作三角（受击倍率） */
        /* v91.92：指挥溢出减伤对**任何来源的受击**都生效（包括城头箭塔）——
           规则只有一句"减伤 = 少受这么多伤"，不区分是谁打的。 */
        var eff = av * cf * dec * holdMul * (1 - (tg.dr || 0)) * T.moveTargetMul(tg);
        var k = Math.floor(eff / perHp);
        if (k <= 0) break;
        if (k > tg.count) k = tg.count;
        tg.count -= k;
        av = Math.max(0, eff - k * perHp);
        killed += k;
        hits.push({ id: tg.id, name: tg.name, kill: k });
      }
      if (killed > 0) {
        events.push({
          kind: 'wall', side: 'def', id: '_wall', name: TW.name + (dbl ? '（双倍区）' : ''),
          target: '我军', kill: killed, hits: hits, towers: alive0, dbl: dbl > 0,
        });
      }
    }

    /* 一支部队的有效射程（科技 + 剧情 + 守城时并入城头火力圈）——
       提成函数是为了让"主动开火"与"反击"用同一套口径。 */
    function effRangeFor(unit) {
      var r = unit.range * (1 + TB('range'));
      if (GAME.story && GAME.story.combatMod) r *= (GAME.story.combatMod().archerRange || 1);
      /* v89.109：出城迎战的部队在**城外**，不再吃城头火力圈（出城 = 放弃围墙护佑） */
      if (unit.side === 'def' && !unit.sortie && wallRange > 0 && unit.range >= 500) r = Math.max(r, wallRange);
      return r;
    }
    function onWallOf(unit) {
      return (unit.side === 'def') && !unit.sortie && wallRange > 0 && unit.range >= 500;
    }

    /* ============================================================
     * 反击（v57 · 老板拍板：补）
     * ------------------------------------------------------------
     * 原版（4399 战争系统页）：「如果双方都在射程内，则攻击方的每次进攻都将
     * 遭到防御方的反击。**其反击人数按照被攻击后的数量计算**。」
     * 三条要点，逐条落地：
     *   ① 触发条件是**双方都在射程内** —— 我隔着射程外打你，你够不着，就没有反击；
     *   ② 反击用的是**被打完之后剩下的兵**（`def0.count` 此时已被扣过）——
     *      战报实证：同一支部队第 2 回合反击 10,710,272，第 3 回合只剩 1,231,194，
     *      因为它已经被打残了；
     *   ③ 反击**不再触发再反击**（没有递归）—— 否则两支远程对射会无限循环。
     * ============================================================ */
    function counterStrike(shooterUnit, hit, enemyUnits, ownGen2, enemyGen2, events) {
      var def0 = null;
      for (var i = 0; i < enemyUnits.length; i++) {
        if (enemyUnits[i].id === hit.id) { def0 = enemyUnits[i]; break; }
      }
      if (!def0 || def0.count <= 0) return;         // 这一支已被打光 → 无人反击
      var rng = effRangeFor(def0);
      var g2 = Math.max(0, D - def0.adv - shooterUnit.adv);
      if (g2 > rng) return;                          // 够不着 → 不反击
      var rres = fireOnce(def0, [shooterUnit], {
        siegeMult: siegeMult,
        decay: T.rangeDecay(g2, rng),
        onWall: onWallOf(def0),
        wallFireMul: wallFireMul,
        defBonus: defBonusAgainst(shooterUnit.side),
        defGenOfTarget: ownGen2,                     // 被打的是 shooterUnit，用它自己那方的英雄
      });
      if (rres.killed > 0) {
        events.push({
          kind: 'counter', side: def0.side, id: def0.id, name: def0.name,
          target: shooterUnit.name, targetId: shooterUnit.id,
          kill: rres.killed, gap: Math.round(g2),
          decay: T.rangeDecay(g2, rng),
        });
      }
    }

    /* 一方的行动阶段 */
    function actSide(sideUnits, enemyUnits, ownGen, enemyGen, events) {
      sideUnits.forEach(function (u) {
        if (u.count <= 0) return;
        if (!alive(enemyUnits).length) return;
        /* 目标 = 箭塔。⚠️ 箭塔拆完之后**自动转为打敌军** ——
           否则"指定打箭塔"的部队会在工事清空后对着空地站到 30 回合
           （实测：东风快递 4000 拆完 100 座箭塔后发呆 19 回合，最后按兵力比判负）。
           原版语义也是"指定目标不在射程内 → 打射程内任意目标"。 */
        /* v89.109（老板「阻止敌军靠近围墙」）：**守方仍有出城迎战部队存活时，攻方拆不到墙** ——
           野战军挡在城外，攻方必须先把它打完，才能逼近围墙拆工事。
           这就是"前线前移"的硬语义（也是需求 3「打破围墙 + 杀死出城迎战军队」的前置）。 */
        var _defSortieAlive = false;
        if (u.side === 'atk') {
          for (var _si = 0; _si < enemyUnits.length; _si++) {
            if (enemyUnits[_si].sortie && enemyUnits[_si].count > 0) { _defSortieAlive = true; break; }
          }
        }
        var wantTower = (u.target === DATA.TARGET_WALL) && opts.sieging
          && towerAliveNow() > 0 && !_defSortieAlive;
        var ef = front(enemyUnits);
        var rec = null, bestGap = Infinity;
        /* v91.99：与 fireOnce 同池 —— 战报记的目标必须就是真正挨打的那支 */
        targetPoolOf(u, enemyUnits).forEach(function (e) {
          var g = gapOf(u, ef) + (ef - e.adv);   // 与该单位自身的间距
          if (g < bestGap) { bestGap = g; rec = e; }
        });
        /* v59（指挥指令）：**指定目标**优先 ——
           ① 指定兵种：把它选为战报里的目标（伤害偏好由 fireOnce 的 preferId 落实）；
           ② 指定箭塔：本回合不与守军交火，距离以"与工事的距离"为准（一路推进去拆）。
           v89.192（老板 4「目标不在射程内时应对射程内其他兵出手」）：① 的优先**加射程门槛**——
           指定目标在射程内才优先（打它）；不在射程内 → 回落"打射程内任意"（保持默认 rec=最近的）。
           老板实测：自走火炮默认目标=同兵种（v89.149「弩打弩」），同兵种在后方（1733 射程外）时，
           它对着已进射程 1200 的伏击车（1158）**只前进不开火**。原版语义（本文件上文 975 行注释
           自述）也是"指定目标不在射程内 → 打射程内任意目标"。 */
        var effRange = effRangeFor(u);
        var prefInRange = false;
        if (u.target && !wantTower) {
          var pref = null;
          enemyUnits.forEach(function (e) { if (e.count > 0 && e.id === u.target) pref = e; });
          if (pref) {
            var prefGap = gapOf(u, ef) + (ef - pref.adv);
            /* 目标在射程内 → 打它（指定优先保留）；不在 → 不覆盖 rec/bestGap（回落最近） */
            if (prefGap <= effRange) { rec = pref; bestGap = prefGap; prefInRange = true; }
          }
        }
        if (wantTower) bestGap = towerGap(u);
        if (!rec && !wantTower) return;
        var onWall = onWallOf(u);
        var gap = bestGap;
        /* v91.98：停点按"射程 × 停点系数"算 —— 远程走到近半程边界，近战不变 */
        var _stopK = ((u.range || 0) >= (T.DECAY_MIN_RANGE || 500)) ? T.ADVANCE_STOP_K_RANGED : T.ADVANCE_STOP_K;
        var free = gap - effRange * (_stopK == null ? 1 : _stopK);
        /* ============================================================
         * 指令：动作（v59 · 照搬原版 §九）
         * ------------------------------------------------------------
         *   advance 前进 → 每回合向敌阵推进
         *   hold    防御 → 原地不动（受到的伤害减半，见 fireOnce / wallVolley）
         *   retreat 后退 → 向己方后撤、拉开距离（adv 可为负 = 退到自己出发线之后）
         * ⚠️ v28 那句"攻城时守方全军固守"（holdLine）**已删除** ——
         *    固守现在由"守方默认动作 = 防御"承接，它是一条**玩家可改的指令**，
         *    不该在引擎里写死；否则"指挥守军主动出击"永远做不到。
         * ============================================================ */
        var stance = u.stance || 'advance';
        if (stance === 'advance' && free > 0 && !onWall) {
          /* 推进：每回合走「兵种速度 × MARCH_UNIT」丈，走到接触点就停。
             v57：MARCH_UNIT 已改回 **1:1**（速度即每回合丈数）。 */
          var _fleeing = false;
          enemyUnits.forEach(function (e) { if (e.count > 0 && e.stance === 'retreat') _fleeing = true; });
          var step = Math.min(u.spd * T.MARCH_UNIT * ((_fleeing && DATA.STANCE_TRIANGLE_ON) ? T.CHASE_MUL : 1), free);
          var _cap = T.advanceCapOf(D);
          if (step > _cap) step = _cap;
          u.adv += step;
          u._moved = step;
          gap -= step;
          events.push({ kind: 'move', side: u.side, id: u.id, name: u.name, step: Math.round(step), gap: Math.round(gap) });
        } else if (stance === 'retreat') {
          /* 后退（v59）：向己方后撤 —— 原版攻城战里"退到某段距离与箭塔对射、
             避开它的双倍攻击区"是核心战术（战报实录："GJ 后退到【1226,1799】处和箭塔对射"）。
             下限取 −D：允许退到自己出发线之后，但不能无限远（否则战斗永远无接触）。 */
          var back = Math.min(u.spd * T.MARCH_UNIT, u.adv + D);
          var _capB = T.advanceCapOf(D);
          if (back > _capB) back = _capB;
          if (back > 0) {
            u.adv -= back;
            u._moved = back;
            gap += back;
            events.push({ kind: 'retreat', side: u.side, id: u.id, name: u.name,
              step: Math.round(back), gap: Math.round(gap) });
          }
        }
        /* ---------- 拆箭塔（指挥指令：目标 = 城防工事） ---------- */
        if (wantTower) {
          if (opts.sieging && towerAliveNow() > 0 && gap <= effRange) {
            var tPerA = T.perAtk(u, { sieging: !!opts.sieging, siegeMult: siegeMult });
            var tAv = tPerA * u.count * T.rangeDecay(gap, effRange);
            /* 箭塔的防御取原版 360（每兵攻防对冲口径与打兵完全一致） */
            var tDmg = tAv * T.clashFactor(tPerA, TW.def) / TW.tough;
            var tBefore = towerAliveNow();
            var tAfter = towerHit(tDmg);
            if (tAfter < tBefore) {
              events.push({ kind: 'tower', side: u.side, id: u.id, name: u.name,
                destroy: tBefore - tAfter, left: tAfter, total: towerStart });
            }
          }
          return;
        }
        if (gap <= effRange) {
          /* v89.87（老板拍板）：主动攻击 = **单主目标**（rec，指定目标优先/否则最近），
             主目标吃满后超出伤害对**射程内其他每个**敌方兵种各溅射 30%。
             溅射目标在此预筛："与射手自身的间距 ≤ 射手有效射程"的其余兵种。 */
          var decay = T.rangeDecay(gap, effRange);
          var splash = [];
          enemyUnits.forEach(function (e) {
            if (e.count <= 0 || e === rec) return;
            var ge = gapOf(u, ef) + (ef - e.adv);
            if (ge <= effRange) splash.push(e);
          });
          var res = fireOnce(u, enemyUnits, {
            siegeMult: siegeMult, decay: decay, onWall: onWall,
            wallFireMul: wallFireMul,
            /* v89.192：只有"指定目标在射程内"才把它设为偏好 —— 射程外时若仍传 preferId，
               fireOnce 会把它排到打击序列最前、"跨射程"去打它，与 actSide 的回落判定打架。 */
            preferId: prefInRange ? u.target : '',
            defBonus: defBonusAgainst(u.side === 'atk' ? 'def' : 'atk'),
            defGenOfTarget: enemyGen,
            single: true, splashTargets: splash,
          });
          if (res.killed > 0) {
            events.push({
              kind: 'attack', side: u.side, id: u.id, name: u.name,
              targetId: rec.id, target: rec.name, kill: res.killed, hits: res.hits,
              clash: res.clash, decay: decay,
            });
            /* 被打到且还活着的，逐个反击（顺序即"由近及远"的打击顺序） */
            res.hits.forEach(function (h) {
              counterStrike(u, h, enemyUnits, ownGen, enemyGen, events);
            });
          }
        }
      });
    }

    /* v89.87：原 `while (…round < MAX_ROUNDS)` 循环体抽成 stepRound()，由 env.step 调用 */
    function stepRound() {
      if (env.over) return null;
      round++;
      /* v91.85：**策略层**（js/strategy.js · GAME.strat）。
         每回合开火前，按当前战场快照重排「动作 / 目标」。
         只由 `opts.plan` 提供 —— 调用方决定替哪一侧规划（游戏内只替 NPC 一侧）。
         策略异常一律吞掉并回落到原有指令：一场仗不能因为 AI 报错而中断。 */
      if (opts.plan) {
        try {
          var _plan = opts.plan(snapUnits(), round);
          if (_plan) {
            [['atk', atk], ['def', def]].forEach(function (pair) {
              var m = _plan[pair[0]];
              if (!m) return;
              pair[1].forEach(function (u) {
                if (_explicit[pair[0]] && _explicit[pair[0]][u.id]) return;   // 显式指令优先
                var c = m[u.id];
                if (!c) return;
                if (c.s) u.stance = c.s;
                if (c.t !== undefined) u.target = c.t;
              });
            });
          }
        } catch (e) { /* 策略层不得中断战斗 */ }
      }
      /* v91.95：**连续驻守计数**（动作三角的"防龟缩"项）。
         必须在**指令落定之后、开火之前**更新 —— 否则本回合改成驻守的单位
         拿不到"首回合 −25%"，或永远停在首回合的强减伤。 */
      [atk, def].forEach(function (side) {
        side.forEach(function (u) {
          u.holdRun = (u.stance === 'hold') ? ((u.holdRun || 0) + 1) : 0;
          u._moved = 0;                    /* v91.95：本回合移动量（移动目标难打用） */
        });
      });
      /* v91.97：**接触面** —— 阵位由**近战单位**占据（远程不占位，它们在后面开火）。
         近战只打得到对方"占位"的近战（见 fireOnce 的 pool 过滤）；远程不受此限。
         对方**没有近战在场**时，近战才够得着远程 —— 这就是"肉盾倒了，后排就暴露"。
         每回合重算 → 前排倒下后，下一支近战自动补位。
         用"本回合开始时的存活"算快照：同一回合内不因中途阵亡而换位，
         否则"谁先出手"会改变"谁能被打"，同一份输入就能给出不同结果（不可复现）。 */
      if (DATA.CONTACT && DATA.CONTACT.on) {
        var _mr = DATA.CONTACT.meleeRange || 500;
        var _slotsOf = function (gen) {
          var C = DATA.CONTACT, n = C.slots || 2;
          var tong = 0;
          try { tong = gen && GAME.genAttrs ? (GAME.genAttrs(gen).tong || 0) : 0; } catch (e) { tong = 0; }
          return (C.slots3Tong && tong >= C.slots3Tong) ? n + 1 : n;
        };
        [[atk, atkGen], [def, defGen]].forEach(function (pair) {
          var side = pair[0], n = _slotsOf(pair[1]);
          side.forEach(function (u) { u._front = false; });
          /* 谁能占位：近战、存活；优先**兵多**的那支（主力顶前面），同数时靠前的先上 */
          alive(side).filter(function (u) { return (u.range || 0) < _mr; })
            .sort(function (x, y) { return (y.count - x.count) || (y.adv - x.adv); })
            .forEach(function (u, i) { if (i < n) u._front = true; });
        });
      } else {
        [atk, def].forEach(function (side) { side.forEach(function (u) { u._front = true; }); });
      }
      var events = [];
      /* 速度高的先行动 —— 双方混排后统一排序（需求：速度高的兵种先行动） */
      var order = alive(atk).concat(alive(def));
      order.sort(function (x, y) {
        if (y.spd !== x.spd) return y.spd - x.spd;
        /* 同速 → **防守方先行动**（原版规则，4399 战争系统页多源一致：
           「每一回合，按照速度决定行动次序。速度快的军队先行动。
             速度相同时，防守方先行动。」）
           ⚠️ 这里原本写的是"同速时我方（攻方）略先"，与原文**正好相反**，
           而我在 v57 的检索报告里把这一栏标成"✅ 同（速度含英雄加成）"——
           那是**误判**：只核了"按速度排序"，没核"同速谁先"。
           同速先手在"同兵种对拼"里是决定性的（先手方一次齐射就可能清场）。 */
        return x.side === 'def' ? -1 : 1;
      });
      order.forEach(function (u) {
        if (u.count <= 0) return;
        var enemy = (u.side === 'atk') ? def : atk;
        if (!alive(enemy).length) return;
        actSide([u], enemy,
          u.side === 'atk' ? atkGen : defGen,        // ownGen：它自己那方的英雄
          u.side === 'atk' ? defGen : atkGen,        // enemyGen：敌方英雄
          events);
      });
      /* 城头工事每回合开火一次（原版：箭塔/擂石是守城方自带的火力） */
      if (opts.sieging) wallVolley(atk, events);
      /* v91.86：辐射带环境 —— 每回合全军按比例流失，逼玩家速战速决（双方同吃） */
      if (_env && _env.drain > 0) {
        [atk, def].forEach(function (list) {
          list.forEach(function (u) {
            if (u.count > 0) u.count = Math.max(0, u.count - Math.ceil(u.count * _env.drain));
          });
        });
      }
      var _rA = alive(atk).reduce(function (n, u) { return n + u.count; }, 0);
      var _rD = alive(def).reduce(function (n, u) { return n + u.count; }, 0);
      var _rG = Math.round(gapOf({ adv: front(atk) }, front(def)));
      roundsLog.push({ r: round, a: _rA, d: _rD, gap: _rG, events: events });
      strips.push(T.strip(front(atk), front(def), D));
      /* v109（C2）：坚守目标打完 N 回合就收手 —— 守方要的是"撑住"，不是歼灭 */
      var _holdN9 = (opts.obj && opts.obj.kind === 'hold')
        ? Math.max(1, opts.obj.rounds || 6) : 0;
      if (!alive(atk).length || !alive(def).length || round >= T.MAX_ROUNDS
        || (_holdN9 > 0 && round >= _holdN9)) env.over = true;
      return { r: round, a: _rA, d: _rD, gap: _rG, events: events, over: env.over, snap: snapUnits() };
    }

    /* ---------- 会话对象（v89.87） ---------- */
    function snapUnits() {
      /* ============================================================
       * v89.151（老板 5）：「战中兵种悬停显示的血都是零」——病根：本函数**手写字段清单**，
       *   只抄了 11 个，漏了引擎结算与悬停都要读的 6 个
       *   （`hpPer` / `atkPct` / `defPct` / `cover` / `start` / `sortie`）——
       *   `perHp()` 读 `u.hpPer` 得 undefined → `Math.max(1, NaN)` = **NaN** →
       *   悬停显示"血 0（基础 1800）"、全军血量 0，攻/防也丢了全部加成
       *   （显示的是无加成的兵种基础值）。语法过、测试过、零报错。
       *   ⚠️ 与 v89.142 的 `rec.sim` 漏存 duel/genSim 是**同族事故**（§56.1）——
       *     "手写字段清单的打包函数"必须逐字段核对（smoke §131 有对账断言）。
       *   ⛔ 快照只服务 UI（战场渲染/悬停/沙盘起点），多带字段零副作用；
       *     但**字段清单从此以引擎 unitsInit 为准** —— 加字段要同步这里与断言。
       * ============================================================ */
      function cp(u) {
        return { side: u.side, id: u.id, name: u.name, count: u.count, adv: Math.round(u.adv),
                 spd: u.spd, range: u.range, er: Math.round(effRangeFor(u)),   /* v89.104：有效射程 */
                 stance: u.stance, target: u.target || '', vsCity: !!u.vsCity,
                 /* v89.151：以下 6 项 = 引擎结算链（perAtk/perDef/perHp）的输入 —— 缺一即静默失真 */
                 hpPer: u.hpPer, cover: u.cover || 0, atkPct: u.atkPct || 0, defPct: u.defPct || 0,
                 dr: u.dr || 0,
                 start: u.start || 0, sortie: !!u.sortie };
      }
      return { round: round, field: D, atk: atk.map(cp), def: def.map(cp),
        maxRounds: T.MAX_ROUNDS,
        /* 攻城时的城防箭塔（界面显示"余 N / M 座"用） */
        towers: (opts.sieging && towerStart > 0) ? { start: towerStart, left: towerAliveNow() } : null };
    }
    /* v109（C2）：坚守 = 守方全体"关门死守"（受创 35%、输出 55%）*/
    if (opts.obj && opts.obj.kind === 'hold') {
      def.forEach(function (u) { u.siegeHold = true; });
    }
    var env = {
      field: D, over: false,
      units: { atk: atk, def: def },
      setCmd: function (side, troopId, patch) {
        var list = (side === 'def') ? def : atk;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === troopId) {
            if (patch && patch.s) list[i].stance = patch.s;
            if (patch && patch.t !== undefined) list[i].target = patch.t;
          }
        }
      },
      snap: snapUnits,
    };
    env.over = !(alive(atk).length && alive(def).length);
    /* v89.102（老板「固定沙盘」）：**初始列阵快照** —— 沙盘回放/推演的起点。
       每支部队的初始行位（动作决定）、速度、射程、兵力、指令（动作/目标）。
       存进战报后，沙盘可以"用同一把引擎重跑"重现整场仗的逐帧画面；
       重跑时以这里记下的 `stance/target` 走 `opts.stances` 覆盖 ——
       否则玩家事后改了出征战术，同一份战报会跑出不同结果。 */
    var initSnap = snapUnits();
    env.step = stepRound;
    env.runAll = function () { while (!env.over) stepRound(); };
    var _fin = null;
    env.finish = function () {
      if (_fin) return _fin;

    /* ---------- 收尾 ---------- */
    var aRemain = alive(atk).reduce(function (n, u) { return n + u.count; }, 0);
    var dRemain = alive(def).reduce(function (n, u) { return n + u.count; }, 0);
    /* v109（C2）：**坚守** —— 守方只要还有活人、并且撑满了 N 回合，就算守住。
       这条要在"按剩余比例比"之前判：兵少的守方按比例永远输，
       但"活到天亮"是另一种赢法。 */
    var _holdN9f = (opts.obj && opts.obj.kind === 'hold')
      ? Math.max(1, opts.obj.rounds || 6) : 0;
    var holdHeld = !!(_holdN9f > 0 && dRemain > 0 && round >= _holdN9f
      && !(dRemain <= 0));
    var winner;
    if (holdHeld) winner = 'def';
    else if (dRemain <= 0 && aRemain > 0) winner = 'atk';
    else if (aRemain <= 0 && dRemain > 0) winner = 'def';
    else if (aRemain > 0 && dRemain > 0) {
      winner = (aRemain / Math.max(1, aStart)) > (dRemain / Math.max(1, dStart)) ? 'atk' : 'def';
    } else winner = 'def';

    function lossBy(list) {
      var out = {}, startBy = {};
      list.forEach(function (u) {
        startBy[u.id] = u.start;
        var lost = u.start - u.count;
        if (lost > 0) out[u.id] = lost;
      });
      return { loss: out, start: startBy, remain: (function () {
        var o = {}; list.forEach(function (u) { if (u.count > 0) o[u.id] = u.count; }); return o;
      })() };
    }
    var aBy = lossBy(atk), dBy = lossBy(def);
    /* v89.109：出城迎战部队的**存活**人数（0 = 野战军已被歼灭） */
    var defSortieLeft = 0;
    def.forEach(function (u) { if (u.sortie && u.count > 0) defSortieLeft += u.count; });

    /* 逐回合纪要（文字）—— 供战报直接展示 */
    /* 回合纪要：只写**接战结果**，推进过程交给战场条带去看 ——
       把"每支部队这一回合走了多远"也写进正文，会把战报变成流水账。
       v89.119（老板）：「反击应该在敌方出手后…反击和对方出手记录在同一行」——
       反击不再独立成段：并入**引发它的那次出手**（同段、紧跟其后），
       形如「步行机(我) → 伏击车 杀伤 784（伏击车反击 杀伤 374）」。
       宿主判定：counter.targetId === 出手者 id（键带阵营，同名兵种互射不串台）。 */
    roundsLog.forEach(function (rr) {
      var at = [], hostOf = {}, open = {};
      rr.events.forEach(function (e) {
        if (e.kind === 'attack') {
          at.push(e.name + (e.side === 'atk' ? '(我)' : '(敌)') + ' → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0));
          if (e.id != null) hostOf[(e.side === 'atk' ? 'a' : 'd') + '|' + e.id] = at.length - 1;
        } else if (e.kind === 'wall') {
          at.push(e.name + ' → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0));
        } else if (e.kind === 'counter') {
          var hi = hostOf[(e.side === 'atk' ? 'd' : 'a') + '|' + e.targetId];
          /* v89.136（老板 3）：「'对方'应该是'我方'才对」——按**反击者阵营**给词 */
          var piece = (e.side === 'atk' ? '我方' : '敌方') + e.name + '反击 杀伤 ' + U.numText(e.kill, 0);
          if (hi != null) {
            at[hi] += (open[hi] ? '，' : '（') + piece;
            open[hi] = true;
          } else {
            /* 兜底：找不到那次出手（异常数据）→ 才独立成段 */
            at.push(e.name + (e.side === 'atk' ? '(我)' : '(敌)') + ' 反击 ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0));
          }
        } else if (e.kind === 'tower') {
          /* v59：拆箭塔 —— 原版战报写作"[守]箭塔6666-272=6394" */
          at.push(e.name + '(我) 攻箭塔，摧毁 ' + e.destroy + ' 座（余 ' + e.left + ' / ' + e.total + '）');
        }
      });
      Object.keys(open).forEach(function (k) { if (open[k]) at[k] += '）'; });
      log.push('第 ' + rr.r + ' 回合：' + (at.length ? at.join('；')
        : '两军推进（最近距离 ' + U.numText(Math.max(0, rr.gap), 0) + '）'));
    });

    if (craftKinds > 0) {
      log.push('攻城器械 ' + craftKinds + ' 类：城防减伤降至 '
        + Math.round(defBonus * 100) + '%，城头火力压制至 '
        + Math.round(wallFireMul * 100) + '%');
    } else if (wallRange > 0) {
      log.push(TW.name + '射程 ' + U.numText(Math.round(wallRange), 0)
        + '（' + towerAliveNow() + ' / ' + towerStart + ' 座）'
        + ' —— 无攻城器械，城防减伤 ' + Math.round(defBonus * 100) + '%');
    }
    /* v59：拆箭塔战果汇总 —— 攻城方最想知道的一句话 */
    if (towerStart > 0 && towerDmg > 0) {
      log.push('此役拆毁 ' + TW.name + ' ' + (towerStart - towerAliveNow()) + ' 座，尚存 '
        + towerAliveNow() + ' / ' + towerStart + ' 座');
    }
    if (scoutOnly > 0) log.push('侦察单元 ' + scoutOnly + ' 骑随行侦察，不列阵（不受损失）');

    _fin = {
      winner: winner,
      atkLoss: aStart - aRemain, defLoss: dStart - dRemain,
      atkRemain: aRemain, defRemain: dRemain,
      rounds: round, log: log,
      /* 战斗场景（v27 新增） */
      engine: 'tactic',
      field: D,
      /* v28：本次战场口径 —— 攻城器械数量、城头火力射程、侦察单元（不参战）数量 */
      craft: craftKinds, wallRange: wallRange, wallFireMul: wallFireMul,
      defBonusEff: defBonus, scoutOnly: scoutOnly,
      /* v59：城防箭塔 —— 开局座数 / 剩余座数（战报与界面都要显示"拆了几座"） */
      towerStart: towerStart, towerLeft: towerAliveNow(),
      roundsLog: roundsLog, strips: strips,
      /* v89.102：初始列阵（沙盘回放/推演起点；见 initSnap 处注释） */
      unitsInit: initSnap,
      atkLossBy: aBy.loss, defLossBy: dBy.loss,
      atkStartBy: aBy.start, defStartBy: dBy.start,
      atkRemainBy: aBy.remain, defRemainBy: dBy.remain,
      /* v89.109（老板「杀死出城迎战的军队才能掠夺」）：守方**出城迎战部队**的起/余 ——
         掠夺闸（battle.lootGateOf）与战报都读它。 */
      defSortieStart: defSortieStart, defSortieLeft: defSortieLeft,
    };
    return _fin;
    };
    return env;
  };

  /* v89.87：T.simulate 包装为会话（begin → runAll → finish）——
     与旧实现逐字节同行为；观战界面改用 env.step 逐回合推进。 */
  T.simulate = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {
    opts = opts || {};
    /* v91.85：给 **NPC 一侧** 装上策略层（玩家那一侧的战术设置原样不动）。
       · 开关：只有 `s.settings.battleAI === true` 才启用 —— **默认关闭**，
         保持 v91.76 的一切既有行为与验收数字不变；
       · 显式指令（opts.stances）优先，策略层不覆盖；
       · 回放/沙盘自己传了 `opts.plan` 时不覆盖（保证同一份战报重跑结果一致）。 */
    if (!opts.plan && GAME.strat && GAME.strat.autoPlan) {
      var _st = GAME.state && GAME.state.settings;
      if (_st && _st.battleAI === true) {
        var _foe = opts.playerDef ? 'atk' : 'def';
        var _o2 = {};
        for (var _k in opts) _o2[_k] = opts[_k];
        _o2.plan = GAME.strat.autoPlan({ sides: [_foe], allowRetreat: _foe === 'def' });
        opts = _o2;
      }
    }
    var env = T.begin(atkArmy, atkGen, defArmy, defVal, defGen, opts);
    env.runAll();
    return env.finish();
  };

  /* 供界面/战报使用：把一场战斗画成文字战场 */
  T.renderScene = function (r, limit) {
    if (!r || !r.strips || !r.strips.length) return '';
    limit = limit || 10;
    var n = r.strips.length;
    var idx = [];
    for (var i = 0; i < n; i++) {
      if (i < limit - 2 || i >= n - 2) idx.push(i);
    }
    var out = [];
    var last = -1;
    idx.forEach(function (i) {
      if (last >= 0 && i > last + 1) out.push('<div class="bt-gap">　　……</div>');
      var rr = r.roundsLog[i];
      out.push('<div class="bt-row"><span class="bt-r">' + (i + 1) + '</span>' +
        '<span class="bt-strip">' + r.strips[i].replace(/▓/g, '<i>▓</i>').replace(/·/g, '<u>·</u>') + '</span>' +
        '<span class="bt-n">我 ' + U.fmt(rr.a) + '　敌 ' + U.fmt(rr.d) + '</span>' +
        '<span class="bt-g">最近距离 ' + U.numText(rr.gap, 0) + '</span></div>');
      last = i;
    });
    return '<div class="bt-scene">' +
      '<div class="bt-head"><span>我方</span><span class="bt-scale">战场纵深 ' + U.numText(r.field, 0) + '</span><span>敌军</span></div>' +
      out.join('') + '</div>';
  };
})();

/* ---- icons.js ---- */
/* ============================================================
 * icons.js  手绘 SVG 图标库（v12）
 * 建筑 / 城外资源 / 野地 / 资源 / 兵种 全部矢量绘制
 * 不再使用「色块 + emoji」的组合
 * 统一风格：左上光源的平涂分层 + 檐口翘起 + 铜饰点缀
 * ============================================================ */

(function () {
  var GAME = window.GAME = window.GAME || {};
  var ICON = GAME.icons = {};
  ICON.ready = true;

  /* ---------------- 调色板 ---------------- */
  /* 暗黑风调色板（v18）：整体压暗 2~3 档、降饱和、拉开明暗差。
     设计原则：底色近乎墨黑，仅把**金/火**留作暖色高光（唯一亮点），
     其余材质一律冷灰暗调 —— 这样图标在深色面板上才有"物件感"而非贴纸感。 */
  var P = {
    /* v89.216 调色板「荒原化」（换皮视觉层 · 一处改全局）：材质与色相换到废土 ——
       青瓦→**锈铁顶** · 金琉璃→**旧铜** · 米黄砖墙→**水泥** · 亮木→**旧木** ·
       亮岩→**碎石** · 亮金→**黄铜** · 亮绿→**荒草** · 亮水→**浑水** · 亮朱→**锈红** ·
       亮钢/麻/玉/皮革→哑光版。**形制不动**（屋檐还是屋檐、城墙还是城墙），
       只把"新瓦亮漆"换成"旧料锈迹"——这是"名字已废土、图仍是新屋"的收口。
       ⚠️ 全局观感由这一处决定；要回退只改这里（备份在 .workbuddy/backup/v89215/icons.js）。 */
    ink: '#241f18',
    /* 锈铁顶 */
    tileHi: '#b4a08a', tileMd: '#857055', tileLo: '#56452f', tileEdge: '#33281a',
    /* 旧铜 */
    glaHi: '#c9a464', glaMd: '#97743c', gllaLo: '#6a5024',
    /* 水泥墙 */
    wallHi: '#d5cfc0', wallMd: '#a8a294', wallLo: '#7a7466', wallEdge: '#4e4840',
    /* 旧木 */
    woodHi: '#b89468', woodMd: '#8e6a42', woodLo: '#5f452a', woodEdge: '#3a2a18',
    /* 碎石 */
    stHi: '#cfcabd', stMd: '#a09a8e', stLo: '#6e675c', stEdge: '#46403a',
    /* 黄铜 */
    goldHi: '#e8cf92', goldMd: '#c09a48', goldLo: '#84662a',
    /* 荒草 */
    grHi: '#a8b06a', grMd: '#7a8248', grLo: '#4e5628',
    /* 浑水 */
    waHi: '#8fbcca', waMd: '#5c8ea0', waLo: '#3a6478',
    /* 火（保留暖亮） */
    fiHi: '#ffdd77', fiMd: '#f0952f', fiLo: '#b85414',
    /* 锈红 */
    rHi: '#cf6040', rMd: '#a04428', rLo: '#702e18',
    /* 哑钢 */
    irHi: '#cdd4de', irMd: '#93a0b2', irLo: '#616c7c',
    /* 帆布 */
    clHi: '#e2d3ab', clMd: '#ab9268', clLo: '#7a6340',
    /* 玉（哑） */
    jadeHi: '#86c9a2', jadeLo: '#457f5a',
    /* 皮革（旧） */
    leatherHi: '#cfae84', leatherMd: '#a07a4e', leatherLo: '#6e502f',
  };
  ICON.P = P;

  /* ---------------- 基础工具 ---------------- */
  function G(id, a, b, dir) {
    /* dir: 'v' 纵向（默认） | 'h' 横向 */
    var x2 = dir === 'h' ? 1 : 0, y2 = dir === 'h' ? 0 : 1;
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + x2 + '" y2="' + y2 + '">' +
      '<stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>';
  }
  /* 暗黑承台：建筑/城外/地形这类"大图"统一坐在同一块深色底座上。
     底座 = 深色径向渐变 + 暗金细描边 + 内圈压线 + 顶部冷光，
     让图标像是嵌在铜框里的浮雕，而不是浮在面板上的贴纸。 */
  function plateDefs() {
    return '<defs>'
      + '<radialGradient id="icPlate" cx="50%" cy="24%" r="82%">'
      +   '<stop offset="0" stop-color="#e6d2a0"/>'
      +   '<stop offset=".55" stop-color="#c8a870"/>'
      +   '<stop offset="1" stop-color="#97794a"/></radialGradient>'
      + '<linearGradient id="icRim" x1="0" y1="0" x2="0" y2="1">'
      +   '<stop offset="0" stop-color="#f8e8b8" stop-opacity=".9"/>'
      +   '<stop offset=".5" stop-color="#a8863e" stop-opacity=".55"/>'
      +   '<stop offset="1" stop-color="#6a4c1e" stop-opacity=".45"/></linearGradient>'
      + '</defs>';
  }
  function plate() {
    return plateDefs()
      + '<rect x="1.3" y="1.3" width="61.4" height="61.4" rx="9" fill="url(#icPlate)"/>'
      + /* 泥粒斜纹（夯土质感） */
      '<path d="M4 18 L60 8 M4 34 L60 24 M4 50 L60 40 M12 60 L60 52" stroke="#7a5a30" stroke-opacity=".08" stroke-width="2.4"/>'
      + '<ellipse cx="32" cy="10" rx="23" ry="9" fill="#fff6dc" opacity=".22"/>'
      + '<rect x="1.3" y="1.3" width="61.4" height="61.4" rx="9" fill="none" stroke="url(#icRim)" stroke-width="1.5"/>'
      + '<rect x="3.6" y="3.6" width="56.8" height="56.8" rx="7" fill="none" stroke="#4a3010" stroke-opacity=".38" stroke-width="1"/>'
      + '<rect x="3.6" y="3.6" width="56.8" height="56.8" rx="7" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1"/>';
  }
  /* v25（需求 7）：统一「光照层」。
     五十多个图标各画各的，形状再好也会显得不是一个世界的东西 ——
     差的就是打光。这里给**每一个**图标加同一套：
       ① 左上暖光 / 右下冷影的柔光罩（soft-light；不支持混合的浏览器退化成
          很淡的渐变，肉眼几乎无感，不会把图形糊住）
       ② 底部环境暗角，把图标"按"在平面上
     ID 固定不冲突（所有实例定义一致，取先出现的那一份即可）。 */
  function lightPass() {
    return '<defs>'
      + '<linearGradient id="icAmb" x1="0.08" y1="0" x2="0.92" y2="1">'
      +   '<stop offset="0" stop-color="#fff2cc" stop-opacity=".20"/>'
      +   '<stop offset=".42" stop-color="#ffffff" stop-opacity="0"/>'
      +   '<stop offset="1" stop-color="#3a2408" stop-opacity=".22"/></linearGradient>'
      + '<radialGradient id="icVig" cx="50%" cy="46%" r="66%">'
      +   '<stop offset=".58" stop-color="#000000" stop-opacity="0"/>'
      +   '<stop offset="1" stop-color="#2a1a04" stop-opacity=".16"/></radialGradient>'
      + '</defs>'
      + '<rect x="0" y="0" width="64" height="64" fill="url(#icAmb)" style="mix-blend-mode:soft-light" pointer-events="none"/>'
      + '<rect x="0" y="0" width="64" height="64" fill="url(#icVig)" pointer-events="none"/>';
  }
  function wrap(inner, opt) {
    opt = opt || {};
    return '<svg class="ico" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
      + lightPass() + (opt.plate ? plate() : '') + inner + '</svg>';
  }
  /* 屋顶：cx 中心，top 脊高，w 檐宽，h 檐高，tw 脊宽 */
  function roof(cx, top, w, h, tw, k, pal) {
    var A = pal === 'gla' ? [P.glaHi, P.glaMd, P.gllaLo] : [P.tileHi, P.tileMd, P.tileLo];
    var L = cx - w / 2, R = cx + w / 2, TL = cx - tw / 2, TR = cx + tw / 2;
    var y0 = top, y1 = top + h;
    return G(k + 'rf', A[0], A[2]) + G(k + 'rf2', A[1], A[2], 'h') +
      /* 主瓦面 */
      '<path d="M' + L + ' ' + y1 + ' L' + TL + ' ' + y0 + ' L' + TR + ' ' + y0 + ' L' + R + ' ' + y1 + ' Z" fill="url(#' + k + 'rf)"/>' +
      /* 瓦垄（三至四条竖线） */
      '<path d="M' + (cx - w * 0.22) + ' ' + y1 + ' L' + (cx - tw * 0.22) + ' ' + y0 + ' M' + cx + ' ' + y1 + ' L' + cx + ' ' + y0 +
      ' M' + (cx + w * 0.22) + ' ' + y1 + ' L' + (cx + tw * 0.22) + ' ' + y0 + '" stroke="' + A[2] + '" stroke-width=".7" opacity=".55" fill="none"/>' +
      /* 右暗面 */
      '<path d="M' + cx + ' ' + y0 + ' L' + TR + ' ' + y0 + ' L' + R + ' ' + y1 + ' L' + cx + ' ' + y1 + ' Z" fill="' + A[2] + '" opacity=".22"/>' +
      /* 檐口（两端翘起） */
      '<path d="M' + (L - 4) + ' ' + (y1 + 2) + ' Q' + L + ' ' + (y1 - 2.5) + ' ' + (L + 3) + ' ' + (y1 - 1.5) +
      ' L' + (R - 3) + ' ' + (y1 - 1.5) + ' Q' + R + ' ' + (y1 - 2.5) + ' ' + (R + 4) + ' ' + (y1 + 2) +
      ' Q' + R + ' ' + (y1 + 3.2) + ' ' + (R - 4) + ' ' + (y1 + 3.2) + ' L' + (L + 4) + ' ' + (y1 + 3.2) +
      ' Q' + L + ' ' + (y1 + 3.2) + ' ' + (L - 4) + ' ' + (y1 + 2) + ' Z" fill="' + A[2] + '"/>' +
      /* 正脊 + 两端鸱吻 */
      '<rect x="' + TL + '" y="' + (y0 - 3) + '" width="' + tw + '" height="4" rx="1.6" fill="' + A[2] + '"/>' +
      '<circle cx="' + TL + '" cy="' + (y0 - 1.6) + '" r="1.5" fill="' + P.goldMd + '"/>' +
      '<circle cx="' + TR + '" cy="' + (y0 - 1.6) + '" r="1.5" fill="' + P.goldMd + '"/>';
  }
  /* 茅草顶 */
  function thatch(cx, top, w, h, k) {
    var L = cx - w / 2, R = cx + w / 2, y0 = top, y1 = top + h;
    return G(k + 'tc', P.clHi, P.clLo) +
      '<path d="M' + L + ' ' + y1 + ' L' + cx + ' ' + y0 + ' L' + R + ' ' + y1 + ' Z" fill="url(#' + k + 'tc)"/>' +
      '<path d="M' + cx + ' ' + y0 + ' L' + R + ' ' + y1 + ' L' + cx + ' ' + y1 + ' Z" fill="' + P.clLo + '" opacity=".35"/>' +
      '<path d="M' + (L + 2) + ' ' + (y1 - 3) + ' L' + (R - 2) + ' ' + (y1 - 3) + '" stroke="' + P.woodEdge + '" stroke-width=".9" opacity=".45"/>' +
      '<rect x="' + (L - 2) + '" y="' + (y1 - 1) + '" width="' + (w + 4) + '" height="3.4" rx="1.4" fill="' + P.woodLo + '"/>';
  }
  /* 夯土墙 */
  function wallBlock(x, y, w, h, k) {
    return G(k + 'wl', P.wallHi, P.wallLo) +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.2" fill="url(#' + k + 'wl)"/>' +
      '<rect x="' + (x + w * 0.62) + '" y="' + y + '" width="' + (w * 0.38) + '" height="' + h + '" fill="' + P.wallLo + '" opacity=".3"/>';
  }
  /* 台基 */
  function plinth(cx, y, w, h, k) {
    return G(k + 'pl', P.stHi, P.stLo) +
      '<path d="M' + (cx - w / 2) + ' ' + y + ' L' + (cx - w / 2 + 3) + ' ' + (y + h) + ' L' + (cx + w / 2 - 3) + ' ' + (y + h) + ' L' + (cx + w / 2) + ' ' + y + ' Z" fill="url(#' + k + 'pl)"/>' +
      '<rect x="' + (cx - w / 2 - 1.5) + '" y="' + (y - 2) + '" width="' + (w + 3) + '" height="2.6" rx="1" fill="' + P.stHi + '" opacity=".85"/>';
  }
  /* 门 */
  function door(cx, y, w, h, k) {
    return '<rect x="' + (cx - w / 2) + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (w / 2) + '" fill="' + P.woodLo + '"/>' +
      '<rect x="' + (cx - w / 2 + .9) + '" y="' + (y + .9) + '" width="' + (w - 1.8) + '" height="' + (h - 1.2) + '" rx="' + ((w - 1.8) / 2) + '" fill="' + P.woodMd + '"/>' +
      '<rect x="' + (cx - w / 2) + '" y="' + (y + h - 2.2) + '" width="' + w + '" height="1.6" fill="' + P.goldMd + '" opacity=".8"/>';
  }
  /* 直棂窗 */
  function lattice(cx, y, w, h) {
    var s = '';
    for (var i = 1; i < 4; i++) s += '<line x1="' + (cx - w / 2 + w * i / 4) + '" y1="' + y + '" x2="' + (cx - w / 2 + w * i / 4) + '" y2="' + (y + h) + '" stroke="' + P.woodEdge + '" stroke-width=".7"/>';
    return '<rect x="' + (cx - w / 2) + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1" fill="#3d3126"/>' +
      '<rect x="' + (cx - w / 2 - .8) + '" y="' + (y - .8) + '" width="' + (w + 1.6) + '" height="' + (h + 1.6) + '" rx="1.4" fill="none" stroke="' + P.woodMd + '" stroke-width="1.2"/>' + s;
  }
  /* 旗 */
  function flag(x, y, h, col, col2) {
    return '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - h) + '" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
      '<path d="M' + x + ' ' + (y - h) + ' L' + (x + 13) + ' ' + (y - h + 4) + ' L' + x + ' ' + (y - h + 9) + ' Z" fill="' + col + '"/>' +
      '<path d="M' + x + ' ' + (y - h) + ' L' + (x + 7) + ' ' + (y - h + 2.4) + ' L' + x + ' ' + (y - h + 4.6) + ' Z" fill="' + col2 + '" opacity=".7"/>';
  }
  /* 酒旗/幌子 */
  function banner(x, y, h, col) {
    return '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y - h) + '" stroke="' + P.woodLo + '" stroke-width="1.4"/>' +
      '<rect x="' + (x + 1) + '" y="' + (y - h + 1) + '" width="6" height="13" rx="1" fill="' + col + '"/>' +
      '<rect x="' + (x + 1) + '" y="' + (y - h + 1) + '" width="2.4" height="13" fill="#fff" opacity=".22"/>';
  }
  /* 树 */
  function tree(x, y, s, k) {
    return G(k + 'tr', P.grHi, P.grLo) +
      '<rect x="' + (x - .9) + '" y="' + (y - 6 * s) + '" width="1.8" height="' + (6 * s) + '" fill="' + P.woodLo + '"/>' +
      '<ellipse cx="' + x + '" cy="' + (y - 9 * s) + '" rx="' + (5 * s) + '" ry="' + (5.4 * s) + '" fill="url(#' + k + 'tr)"/>' +
      '<ellipse cx="' + (x - 1.8 * s) + '" cy="' + (y - 10.6 * s) + '" rx="' + (2.2 * s) + '" ry="' + (2.1 * s) + '" fill="' + P.grHi + '" opacity=".6"/>';
  }
  /* 石堆 */
  function rocks(x, y, k) {
    return G(k + 'rk', P.stHi, P.stLo) +
      '<path d="M' + (x - 8) + ' ' + y + ' L' + (x - 5) + ' ' + (y - 7) + ' L' + (x + 1) + ' ' + (y - 8.5) + ' L' + (x + 7) + ' ' + (y - 4) + ' L' + (x + 9) + ' ' + y + ' Z" fill="url(#' + k + 'rk)"/>' +
      '<path d="M' + (x + 1) + ' ' + (y - 8.5) + ' L' + (x + 7) + ' ' + (y - 4) + ' L' + (x + 9) + ' ' + y + ' L' + (x + 1) + ' ' + y + ' Z" fill="' + P.stLo + '" opacity=".45"/>' +
      '<path d="M' + (x - 4) + ' ' + (y - 4.6) + ' L' + (x - 1.5) + ' ' + (y - 6.4) + '" stroke="' + P.stHi + '" stroke-width="1" opacity=".7"/>';
  }

  /* ============================================================
   * 城内建筑（16）
   * ============================================================ */
  var B = {};
  var KA = 'ic_';

  B.guanfu = function (k) {
    return G(k + 'rf', P.glaHi, P.gllaLo) +
      plinth(32, 50, 42, 6, k) +
      wallBlock(15, 30, 34, 20, k) +
      roof(32, 6, 48, 11, 20, k, 'gla') +
      roof(32, 20, 36, 8, 15, k, 'gla') +
      door(32, 39, 9, 11, k) +
      lattice(20, 34, 6, 7) + lattice(44, 34, 6, 7) +
      '<rect x="26" y="34.5" width="12" height="3.6" rx="1" fill="' + P.goldMd + '"/>' +
      '<text x="32" y="37.4" font-size="3" text-anchor="middle" fill="' + P.woodEdge + '" font-family="serif">政务厅</text>';
  };

  B.minfang = function (k) {
    return thatch(32, 18, 34, 13, k) +
      wallBlock(17, 31, 30, 20, k) +
      door(32, 39, 8, 12, k) +
      lattice(24, 35, 5.5, 6) + lattice(40, 35, 5.5, 6) +
      '<rect x="41" y="15" width="4.5" height="9" rx="1" fill="' + P.stMd + '"/>' +
      '<rect x="40.4" y="13.4" width="5.7" height="2.4" rx="1" fill="' + P.stLo + '"/>' +
      '<ellipse cx="43.5" cy="11.6" rx="3" ry="2" fill="#fff" opacity=".13"/>';
  };

  B.shuyuan = function (k) {
    return G(k + 'rf', P.tileHi, P.tileLo) +
      plinth(32, 51, 40, 5, k) +
      wallBlock(16, 32, 32, 19, k) +
      roof(32, 10, 44, 10, 17, k) +
      roof(32, 22, 32, 7, 13, k) +
      door(32, 40, 11, 11, k) +
      '<rect x="24" y="36" width="4" height="7" rx="1" fill="' + P.clHi + '"/>' +
      '<rect x="36" y="36" width="4" height="7" rx="1" fill="' + P.clHi + '"/>' +
      '<rect x="29.6" y="27" width="4.8" height="4.4" rx=".8" fill="' + P.goldMd + '"/>';
  };

  B.junying = function (k) {
    /* 军帐 + 枪阵 + 帅旗 */
    var s = '<ellipse cx="32" cy="50" rx="22" ry="4.4" fill="' + P.grLo + '" opacity=".35"/>';
    s += G(k + 'tn', P.clHi, P.clMd) +
      '<path d="M20 49 L32 22 L44 49 Z" fill="url(#' + k + 'tn)"/>' +
      '<path d="M32 22 L44 49 L32 49 Z" fill="' + P.clLo + '" opacity=".38"/>' +
      '<path d="M32 22 L32 49" stroke="' + P.clLo + '" stroke-width=".8" opacity=".6"/>' +
      '<path d="M20 49 L44 49" stroke="' + P.woodLo + '" stroke-width="1.2"/>' +
      '<path d="M26 40 L32 27 L38 40" fill="' + P.rMd + '" opacity=".85"/>' +
      /* 枪阵 */
      '<g stroke="' + P.woodLo + '" stroke-width="1.3">' +
      '<line x1="12" y1="49" x2="10" y2="30"/><line x1="17" y1="49" x2="15.5" y2="26"/></g>' +
      '<path d="M10 30 L8.6 26 L11.4 26 Z" fill="' + P.irHi + '"/>' +
      '<path d="M15.5 26 L14.2 22.4 L16.8 22.4 Z" fill="' + P.irHi + '"/>' +
      flag(48, 48, 26, P.rMd, P.rHi);
    return s;
  };

  B.xiaochang = function (k) {
    /* 箭靶 + 栅栏 */
    var s = G(k + 'gd', P.grHi, P.grLo) + '<ellipse cx="32" cy="51" rx="24" ry="4.6" fill="url(#' + k + 'gd)"/>';
    /* 栅栏 */
    for (var i = 0; i < 7; i++) s += '<rect x="' + (9 + i * 7) + '" y="46" width="1.6" height="6" fill="' + P.woodLo + '"/>';
    s += '<rect x="8" y="47.6" width="48" height="1.6" rx=".8" fill="' + P.woodMd + '"/>';
    /* 靶 */
    s += '<rect x="30.6" y="26" width="2.8" height="21" fill="' + P.woodMd + '"/>';
    [['#f4ead2', 9], [P.rMd, 6.2], ['#f4ead2', 3.4], [P.rLo, 1.4]].forEach(function (r) {
      s += '<circle cx="32" cy="24" r="' + r[1] + '" fill="' + r[0] + '"/>';
    });
    s += '<circle cx="32" cy="24" r="9" fill="none" stroke="' + P.woodEdge + '" stroke-width="1"/>';
    /* 弓 */
    s += '<path d="M14 22 Q6 32 14 42" fill="none" stroke="' + P.woodLo + '" stroke-width="2.2"/>' +
      '<line x1="14" y1="22" x2="14" y2="42" stroke="' + P.clHi + '" stroke-width=".8"/>';
    return s;
  };

  B.shichang = function (k) {
    var s = G(k + 'gd', P.grHi, P.grLo) + '<ellipse cx="32" cy="52" rx="23" ry="4.4" fill="url(#' + k + 'gd)"/>';
    /* 摊位棚 */
    s += '<rect x="12" y="30" width="26" height="3.2" rx="1" fill="' + P.rMd + '"/>' +
      '<path d="M12 30 L15 22 L35 22 L38 30 Z" fill="' + P.rHi + '"/>' +
      '<path d="M25 22 L28 30 L38 30 L35 22 Z" fill="' + P.rLo + '" opacity=".45"/>' +
      '<line x1="14" y1="33" x2="14" y2="51" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
      '<line x1="36" y1="33" x2="36" y2="51" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
      /* 台面与货物 */
      '<rect x="10" y="42" width="30" height="3" rx="1" fill="' + P.woodMd + '"/>' +
      '<circle cx="17" cy="39.4" r="2.6" fill="' + P.goldMd + '"/>' +
      '<circle cx="24" cy="39.8" r="2.3" fill="' + P.grMd + '"/>' +
      '<rect x="29" y="37" width="6" height="5" rx="1" fill="' + P.clHi + '"/>' +
      /* 箩筐 */
      '<path d="M42 44 L44 52 L54 52 L56 44 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M42 44 L44 52 L49 52 L47 44 Z" fill="' + P.woodLo + '"/>' +
      '<ellipse cx="49" cy="44" rx="7" ry="2" fill="' + P.woodHi + '"/>' +
      banner(58, 46, 22, P.goldMd);
    return s;
  };

  B.cangku = function (k) {
    /* 圆形粮仓 */
    var s = G(k + 'bn', P.clHi, P.clMd) + thatch(26, 14, 30, 11, k);
    s += '<rect x="13" y="25" width="26" height="26" rx="2" fill="url(#' + k + 'bn)"/>' +
      '<rect x="26" y="25" width="13" height="26" fill="' + P.clLo + '" opacity=".35"/>' +
      '<rect x="13" y="38" width="26" height="1.6" fill="' + P.woodLo + '" opacity=".5"/>' +
      '<rect x="13" y="30" width="26" height="1.6" fill="' + P.woodLo + '" opacity=".5"/>' +
      door(26, 41, 8, 10, k) +
      /* 陶瓮与麻袋 */
      '<path d="M42 39 Q39 47 42 52 L50 52 Q53 47 50 39 Z" fill="' + P.woodMd + '"/>' +
      '<ellipse cx="46" cy="39" rx="4" ry="1.6" fill="' + P.woodHi + '"/>' +
      '<rect x="44" y="45" width="11" height="7" rx="2.4" fill="' + P.clMd + '"/>' +
      '<rect x="44" y="45" width="4" height="7" rx="1.6" fill="' + P.clHi + '" opacity=".6"/>';
    return s;
  };

  B.chengqiang = function (k) {
    var s = G(k + 'wl', P.wallHi, P.wallLo);
    /* 围墙主体 */
    s += '<rect x="6" y="26" width="52" height="26" rx="1.4" fill="url(#' + k + 'wl)"/>' +
      '<rect x="34" y="26" width="24" height="26" fill="' + P.wallLo + '" opacity=".28"/>' +
      /* 垛口 */
      '<path d="M6 26 L6 20 L12 20 L12 26 L16 26 L16 20 L22 20 L22 26 L26 26 L26 20 L32 20 L32 26 L36 26 L36 20 L42 20 L42 26 L46 26 L46 20 L52 20 L52 26 L58 26 L58 26 L6 26 Z" fill="' + P.wallMd + '" stroke="' + P.wallEdge + '" stroke-width=".6"/>' +
      /* 城门 */
      '<path d="M24 52 L24 34 Q32 27 40 34 L40 52 Z" fill="' + P.woodLo + '"/>' +
      '<path d="M25.2 52 L25.2 35 Q32 28.6 38.8 35 L38.8 52 Z" fill="' + P.woodMd + '"/>' +
      '<line x1="32" y1="30" x2="32" y2="52" stroke="' + P.woodEdge + '" stroke-width=".8"/>' +
      '<circle cx="29" cy="42" r="1" fill="' + P.goldMd + '"/><circle cx="35" cy="42" r="1" fill="' + P.goldMd + '"/>' +
      /* 门楼 */
      roof(32, 8, 26, 7, 11, k) +
      '<rect x="21" y="15" width="22" height="9" fill="' + P.wallMd + '"/>' +
      '<rect x="30" y="17" width="4" height="5" rx="1" fill="#3d3126"/>' +
      '<rect x="8" y="22" width="48" height="4.4" rx="1.4" fill="' + P.wallHi + '" opacity=".9"/>';
    return s;
  };

  B.yizhan = function (k) {
    var s = thatch(26, 22, 30, 10, k);
    s += wallBlock(13, 32, 26, 16, k) +
      '<rect x="13" y="32" width="26" height="16" fill="none"/>' +
      '<rect x="22" y="36" width="8" height="12" rx="1" fill="' + P.woodLo + '"/>' +
      '<rect x="16" y="36" width="4" height="5" fill="#3d3126"/>' +
      /* 驿马 */
      '<g fill="' + P.woodLo + '">' +
      '<path d="M40 52 L42 44 Q44 40 48 39 L56 39 Q58 40 58 43 L56 44 L56 48 Q56 50 54 50 L52 50 L52 52 L50 52 L50 50 L44 50 L44 52 L42 52 Z"/>' +
      '</g>' +
      '<path d="M48 39 Q49 35 52 35 L56 36 Q57 37 56 39 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M56 36 L58 33 L59 34 L57 37 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M42 43 Q40 41 41.6 39.6 L44 41 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M52 48 Q53 45 55 43" stroke="' + P.woodLo + '" stroke-width="1.4" fill="none"/>';
    return s;
  };

  B.fenghuotai = function (k) {
    var s = G(k + 'tw', P.stHi, P.stLo);
    /* 高台（上收下阔） */
    s += '<path d="M20 52 L25 20 L39 20 L44 52 Z" fill="url(#' + k + 'tw)"/>' +
      '<path d="M32 20 L39 20 L44 52 L32 52 Z" fill="' + P.stLo + '" opacity=".42"/>' +
      /* 砖缝 */
      '<g stroke="' + P.stEdge + '" stroke-width=".6" opacity=".45">' +
      '<line x1="22" y1="30" x2="42" y2="30"/><line x1="21" y1="40" x2="43" y2="40"/></g>' +
      '<rect x="17" y="16" width="30" height="5" rx="1.4" fill="' + P.stMd + '"/>' +
      '<rect x="17" y="16" width="30" height="1.6" fill="' + P.stHi + '"/>' +
      /* 台顶柴薪与烈焰 */
      '<path d="M23 16 L41 16 L39 11 L25 11 Z" fill="' + P.woodLo + '"/>' +
      '<path d="M28 11 L36 11 L35 8 L29 8 Z" fill="' + P.woodMd + '"/>' +
      G(k + 'fr', P.fiHi, P.fiLo) +
      '<path d="M32 0 Q37 5 35.5 8 Q34 10 32 9 Q30 10 28.5 8 Q27 5 32 0 Z" fill="url(#' + k + 'fr)"/>' +
      '<path d="M32 3 Q34.6 6.4 33.4 8.4 Q32.4 9.6 32 8.6 Z" fill="' + P.fiHi + '" opacity=".85"/>' +
      /* 烟 */
      '<ellipse cx="26" cy="4" rx="4.6" ry="2.6" fill="#fff" opacity=".1"/>' +
      '<ellipse cx="39" cy="2.4" rx="3.6" ry="2.2" fill="#fff" opacity=".08"/>';
    return s;
  };

  B.majiu = function (k) {
    var s = thatch(24, 22, 28, 9, k);
    s += wallBlock(11, 31, 26, 16, k) +
      /* 载具研究所栅栏开口 */
      '<rect x="15" y="36" width="18" height="11" fill="' + P.woodLo + '" opacity=".55"/>' +
      '<g stroke="' + P.woodMd + '" stroke-width="1.2">' +
      '<line x1="18" y1="36" x2="18" y2="47"/><line x1="24" y1="36" x2="24" y2="47"/><line x1="30" y1="36" x2="30" y2="47"/></g>' +
      '<rect x="15" y="35.4" width="18" height="1.4" fill="' + P.woodMd + '"/>' +
      /* 马 */
      '<g fill="' + P.woodLo + '">' +
      '<path d="M38 52 L40 43 Q42 39 47 38 L56 38 Q58 39 58 42 L56 43 L56 48 Q56 50 54 50 L52 50 L52 52 L50 52 L50 50 L43 50 L43 52 L41 52 Z"/>' +
      '</g>' +
      '<path d="M47 38 Q48 34 51 34 L55 35 Q56 36 55 38 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M55 35 L57 32 L58 33 L56 36 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M39 42 Q37 40 38.6 38.6 L41 40 Z" fill="' + P.woodMd + '"/>' +
      '<path d="M51 47 Q52 44 54 42" stroke="' + P.woodLo + '" stroke-width="1.4" fill="none"/>';
    return s;
  };

  B.kezhan = function (k) {
    var s = plinth(32, 52, 42, 5, k);
    /* 二层楼 */
    s += wallBlock(15, 30, 34, 22, k) +
      roof(32, 12, 46, 9, 18, k) +
      '<rect x="15" y="29" width="34" height="3.4" rx="1.2" fill="' + P.woodMd + '"/>' +
      '<rect x="15" y="43" width="34" height="3.4" rx="1.2" fill="' + P.woodMd + '"/>' +
      door(28, 42, 9, 10, k) +
      lattice(20, 33, 6, 7) + lattice(36, 33, 6, 7) +
      /* 栏杆 */
      '<g stroke="' + P.woodLo + '" stroke-width="1">' +
      '<line x1="16" y1="42.6" x2="16" y2="45.6"/><line x1="21" y1="42.6" x2="21" y2="45.6"/><line x1="26" y1="42.6" x2="26" y2="45.6"/></g>' +
      banner(52, 40, 22, P.goldMd) +
      '<rect x="44" y="30" width="7" height="9" rx="1.4" fill="' + P.rMd + '"/>' +
      '<rect x="45.6" y="32" width="3.8" height="1.6" rx=".8" fill="' + P.clHi + '" opacity=".8"/>';
    return s;
  };

  B.zhaoxianguan = function (k) {
    var s = plinth(32, 52, 40, 5, k);
    s += wallBlock(14, 32, 36, 20, k) +
      roof(32, 14, 46, 9, 17, k) +
      roof(32, 25, 34, 7, 13, k) +
      door(32, 41, 11, 11, k) +
      '<rect x="22" y="36" width="5" height="8" rx="1" fill="#3d3126"/>' +
      '<rect x="37" y="36" width="5" height="8" rx="1" fill="#3d3126"/>' +
      /* 招贤榜 */
      '<rect x="44" y="30" width="12" height="15" rx="1.4" fill="' + P.clHi + '"/>' +
      '<rect x="44" y="30" width="12" height="15" rx="1.4" fill="none" stroke="' + P.woodLo + '" stroke-width="1"/>' +
      '<g stroke="' + P.woodLo + '" stroke-width=".7" opacity=".6">' +
      '<line x1="46" y1="34" x2="54" y2="34"/><line x1="46" y1="37" x2="54" y2="37"/><line x1="46" y1="40" x2="51" y2="40"/></g>' +
      '<rect x="48" y="26.6" width="4" height="3.6" rx="1" fill="' + P.goldMd + '"/>';
    return s;
  };

  B.honglusi = function (k) {
    var s = plinth(32, 52, 42, 5, k);
    s += wallBlock(16, 33, 32, 19, k) +
      roof(32, 15, 44, 9, 16, k) +
      roof(32, 26, 32, 7, 12, k) +
      door(32, 42, 10, 10, k) +
      '<rect x="23" y="36" width="5" height="7" rx="1" fill="#3d3126"/>' +
      '<rect x="36" y="36" width="5" height="7" rx="1" fill="#3d3126"/>' +
      /* 双阙 */
      '<rect x="4" y="36" width="8" height="16" rx="1" fill="' + P.stMd + '"/>' +
      '<rect x="2" y="32" width="12" height="4.4" rx="1.2" fill="' + P.stHi + '"/>' +
      '<rect x="52" y="36" width="8" height="16" rx="1" fill="' + P.stMd + '"/>' +
      '<rect x="50" y="32" width="12" height="4.4" rx="1.2" fill="' + P.stHi + '"/>' +
      '<circle cx="32" cy="30" r="2.6" fill="' + P.goldMd + '"/>';
    return s;
  };

  B.tiejiangpu = function (k) {
    var s = thatch(20, 24, 24, 8, k);
    s += wallBlock(9, 32, 22, 16, k) +
      '<rect x="13" y="37" width="14" height="11" fill="' + P.woodLo + '" opacity=".6"/>';
    /* 炉火 */
    s += G(k + 'fr', P.fiHi, P.fiLo) +
      '<path d="M13 44 L27 44 L25 36 L15 36 Z" fill="' + P.stLo + '"/>' +
      '<path d="M16 44 L24 44 L22.6 39 L17.4 39 Z" fill="url(#' + k + 'fr)"/>' +
      '<path d="M20 39 Q22 35 20.6 33 Q19.4 35 20 39 Z" fill="' + P.fiHi + '" opacity=".9"/>';
    /* 铁砧 */
    s += '<path d="M36 50 L52 50 L50 46 L38 46 Z" fill="' + P.irLo + '"/>' +
      '<path d="M40 46 L48 46 L47 42 L41 42 Z" fill="' + P.irMd + '"/>' +
      '<path d="M37 42 L51 42 L50 40 L38 40 Z" fill="' + P.irHi + '"/>' +
      '<path d="M51 40 L55 37 L53.6 40.4 Z" fill="' + P.irMd + '"/>';
    /* 锤 */
    s += '<rect x="44" y="24" width="2" height="14" rx="1" transform="rotate(18 45 31)" fill="' + P.woodMd + '"/>' +
      '<rect x="44" y="20" width="8" height="5" rx="1.4" transform="rotate(18 48 22.5)" fill="' + P.irMd + '"/>';
    return s;
  };

  B.gongjiangzuofang = function (k) {
    var s = roof(32, 20, 40, 9, 15, k);
    s += wallBlock(13, 31, 38, 20, k) +
      '<rect x="13" y="30" width="38" height="3" rx="1" fill="' + P.woodMd + '"/>' +
      door(24, 42, 10, 9, k) +
      /* 工作台 + 器械 */
      '<rect x="36" y="40" width="18" height="3" rx="1" fill="' + P.woodMd + '"/>' +
      '<rect x="38" y="43" width="2" height="8" fill="' + P.woodLo + '"/>' +
      '<rect x="50" y="43" width="2" height="8" fill="' + P.woodLo + '"/>' +
      '<circle cx="45" cy="35" r="4.4" fill="none" stroke="' + P.irMd + '" stroke-width="2"/>' +
      '<circle cx="45" cy="35" r="1.4" fill="' + P.irLo + '"/>' +
      '<g stroke="' + P.irMd + '" stroke-width="1.4">' +
      '<line x1="45" y1="30.6" x2="45" y2="33.6"/><line x1="45" y1="36.4" x2="45" y2="39.4"/>' +
      '<line x1="40.6" y1="35" x2="43.6" y2="35"/><line x1="46.4" y1="35" x2="49.4" y2="35"/></g>' +
      '<rect x="30" y="34" width="2" height="8" fill="' + P.woodLo + '"/>';
    return s;
  };

  /* ============================================================
   * 城外资源地块（4）
   * ============================================================ */
  var E = {};
  E.farm = function (k) {
    var s = G(k + 'fy', P.grHi, P.grMd) + '<ellipse cx="32" cy="54" rx="26" ry="6" fill="url(#' + k + 'fy)"/>';
    /* 田垄 */
    for (var i = 0; i < 3; i++) {
      s += '<path d="M10 ' + (44 + i * 5) + ' Q32 ' + (40 + i * 5) + ' 54 ' + (44 + i * 5) + ' L54 ' + (47 + i * 5) + ' Q32 ' + (43 + i * 5) + ' 10 ' + (47 + i * 5) + ' Z" fill="' + P.woodMd + '" opacity="' + (0.85 - i * 0.22) + '"/>';
    }
    /* 麦穗 */
    [[20, 40], [30, 36], [40, 39]].forEach(function (p) {
      s += '<line x1="' + p[0] + '" y1="' + (p[1] + 12) + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="' + P.grLo + '" stroke-width="1.2"/>' +
        '<path d="M' + p[0] + ' ' + p[1] + ' q3 4 0 9 q-3-5 0-9 Z" fill="' + P.goldHi + '"/>' +
        '<path d="M' + (p[0] - 3.4) + ' ' + (p[1] + 3) + ' q-4-3-5-6 q4 0 5 4 Z" fill="' + P.goldMd + '"/>' +
        '<path d="M' + (p[0] + 3.4) + ' ' + (p[1] + 3) + ' q4-3 5-6 q-4 0-5 4 Z" fill="' + P.goldMd + '"/>';
    });
    return s;
  };
  E.forest = function (k) {
    var s = '<ellipse cx="32" cy="55" rx="26" ry="5" fill="' + P.grLo + '" opacity=".4"/>';
    s += tree(14, 54, 1.15, k) + tree(50, 54, 1.35, k) + tree(32, 52, 0.95, k);
    /* 树桩与斧 */
    s += '<ellipse cx="32" cy="52" rx="5" ry="2.2" fill="' + P.woodMd + '"/>' +
      '<ellipse cx="32" cy="51" rx="5" ry="2.2" fill="' + P.woodHi + '"/>' +
      '<ellipse cx="32" cy="51" rx="2.4" ry="1" fill="' + P.woodMd + '" opacity=".6"/>' +
      '<rect x="18" y="34" width="1.6" height="12" rx=".8" transform="rotate(-22 18 40)" fill="' + P.woodMd + '"/>' +
      '<path d="M22 30 L29 33 L27.6 38 L20.6 35 Z" fill="' + P.irHi + '"/>' +
      '<path d="M29 33 L33 34.4 L31.6 38.4 L27.6 38 Z" fill="' + P.irMd + '"/>';
    return s;
  };
  E.quarry = function (k) {
    var s = '<ellipse cx="32" cy="54" rx="26" ry="5.4" fill="' + P.stLo + '" opacity=".35"/>';
    s += rocks(30, 52, k);
    s += '<path d="M18 52 L21 44 L29 43 L33 52 Z" fill="' + P.stMd + '"/>' +
      '<path d="M33 52 L29 43 L36 41 L40 52 Z" fill="' + P.stHi + '"/>' +
      '<path d="M40 52 L36 41 L43 44 L47 52 Z" fill="' + P.stMd + '"/>' +
      '<path d="M29 43 L36 41 L43 44" stroke="' + P.stEdge + '" stroke-width=".8" fill="none" opacity=".5"/>' +
      /* 凿子与锤 */
      '<rect x="46" y="26" width="2.4" height="13" rx="1.2" transform="rotate(20 47 32)" fill="' + P.irMd + '"/>' +
      '<path d="M44 24 L50 26 L48.6 30 L42.6 28 Z" fill="' + P.irHi + '"/>' +
      '<rect x="14" y="28" width="1.8" height="10" rx=".9" transform="rotate(-16 15 33)" fill="' + P.woodMd + '"/>' +
      '<rect x="11" y="22" width="8" height="4.6" rx="1.4" transform="rotate(-16 15 24.4)" fill="' + P.irMd + '"/>';
    return s;
  };
  E.mine = function (k) {
    var s = '<ellipse cx="32" cy="55" rx="26" ry="5" fill="' + P.stLo + '" opacity=".35"/>';
    /* 山体 + 矿洞 */
    s += G(k + 'mt', P.stHi, P.stLo) +
      '<path d="M6 54 L20 22 L34 54 Z" fill="url(#' + k + 'mt)"/>' +
      '<path d="M26 54 L44 16 L62 54 Z" fill="' + P.stMd + '"/>' +
      '<path d="M44 16 L62 54 L44 54 Z" fill="' + P.stLo + '" opacity=".45"/>' +
      '<path d="M20 22 L23 30 L17 31 Z" fill="' + P.stHi + '" opacity=".8"/>' +
      /* 洞口 */
      '<path d="M34 54 L34 40 Q42 33 50 40 L50 54 Z" fill="' + P.ink + '"/>' +
      '<path d="M35.6 54 L35.6 41.4 Q42 35.4 48.4 41.4 L48.4 54 Z" fill="#0f0b07"/>' +
      /* 支撑木架 */
      '<rect x="33" y="39" width="2.4" height="15" fill="' + P.woodLo + '"/>' +
      '<rect x="48.6" y="39" width="2.4" height="15" fill="' + P.woodLo + '"/>' +
      '<rect x="32" y="37.4" width="20" height="3" rx="1" fill="' + P.woodMd + '"/>' +
      /* 矿石车 */
      '<rect x="8" y="46" width="14" height="7" rx="1.4" fill="' + P.woodMd + '"/>' +
      '<path d="M8 46 L11 42 L19 42 L22 46 Z" fill="' + P.woodHi + '"/>' +
      '<circle cx="12" cy="54" r="2.2" fill="' + P.woodLo + '"/><circle cx="19" cy="54" r="2.2" fill="' + P.woodLo + '"/>' +
      '<circle cx="14" cy="44" r="1.8" fill="' + P.irMd + '"/><circle cx="17.4" cy="45" r="1.4" fill="' + P.goldMd + '"/>' +
      /* 镐 */
      '<rect x="52" y="22" width="2" height="14" rx="1" transform="rotate(24 53 29)" fill="' + P.woodMd + '"/>' +
      '<path d="M46 24 Q54 18 62 22 Q56 24 52 28 Q49 26 46 24 Z" fill="' + P.irMd + '"/>';
    return s;
  };

  /* ============================================================
   * 野地地形（7，供地图 canvas 与图例使用）
   * ============================================================ */
  var T = {};
  T.plain = function (k) {
    return '<ellipse cx="32" cy="40" rx="24" ry="13" fill="' + P.grMd + '"/>' +
      '<ellipse cx="32" cy="38" rx="21" ry="11" fill="' + P.grHi + '" opacity=".55"/>' +
      '<path d="M20 40 q2-5 4 0 M28 42 q2-6 4 0 M38 40 q2-5 4 0" stroke="' + P.grLo + '" stroke-width="1.4" fill="none" opacity=".7"/>';
  };
  T.caoyuan = function (k) {
    return '<ellipse cx="32" cy="40" rx="25" ry="13" fill="' + P.grHi + '"/>' +
      '<ellipse cx="32" cy="38" rx="22" ry="11" fill="#c2d68c" opacity=".45"/>' +
      '<g stroke="' + P.grLo + '" stroke-width="1.4" fill="none" opacity=".8">' +
      '<path d="M18 42 q2-7 3 0"/><path d="M26 44 q2-8 3 0"/><path d="M36 42 q2-7 3 0"/><path d="M45 43 q2-6 3 0"/></g>' +
      '<circle cx="46" cy="30" r="3.4" fill="' + P.fiHi + '" opacity=".5"/>';
  };
  T.zhaoze = function (k) {
    return '<ellipse cx="32" cy="40" rx="25" ry="13" fill="' + P.grLo + '"/>' +
      '<ellipse cx="30" cy="38" rx="20" ry="10" fill="' + P.waLo + '" opacity=".7"/>' +
      '<ellipse cx="30" cy="37" rx="15" ry="7" fill="' + P.waMd + '" opacity=".65"/>' +
      '<g stroke="' + P.grMd + '" stroke-width="1.6" fill="none">' +
      '<path d="M20 44 v-8 M22 44 q-4-3-4-7 M22 44 q4-3 4-7"/>' +
      '<path d="M42 45 v-9 M44 45 q-4-3-4-8 M44 45 q4-3 4-8"/></g>' +
      '<ellipse cx="34" cy="36" rx="4" ry="1.6" fill="#fff" opacity=".22"/>';
  };
  T.lake = function (k) {
    return '<ellipse cx="32" cy="40" rx="26" ry="14" fill="' + P.waLo + '"/>' +
      '<ellipse cx="32" cy="38" rx="22" ry="11" fill="' + P.waMd + '"/>' +
      '<ellipse cx="32" cy="36" rx="16" ry="7.4" fill="' + P.waHi + '" opacity=".55"/>' +
      '<g stroke="#fff" stroke-width="1.2" fill="none" opacity=".4">' +
      '<path d="M20 38 q4-2.4 8 0"/><path d="M32 43 q4-2.4 8 0"/><path d="M24 46 q3.4-2 6.8 0"/></g>';
  };
  T.forest = function (k) {
    return '<ellipse cx="32" cy="42" rx="25" ry="12" fill="' + P.grLo + '"/>' +
      tree(18, 46, 1.0, k) + tree(46, 46, 1.1, k) + tree(32, 44, 0.82, k) +
      '<ellipse cx="32" cy="50" rx="22" ry="4.4" fill="#000" opacity=".16"/>';
  };
  T.desert = function (k) {
    return G(k + 'ds', '#e8d5a4', '#b99a5e') +
      '<ellipse cx="32" cy="40" rx="26" ry="14" fill="url(#' + k + 'ds)"/>' +
      '<path d="M10 42 Q22 30 34 40 Q46 49 56 40" fill="none" stroke="#a8894e" stroke-width="1.8" opacity=".7"/>' +
      '<path d="M8 46 Q24 36 38 44 Q50 50 58 44" fill="none" stroke="#a8894e" stroke-width="1.4" opacity=".45"/>' +
      '<circle cx="46" cy="26" r="5" fill="#f6e3aa" opacity=".85"/>';
  };
  T.hill = function (k) {
    return '<ellipse cx="32" cy="44" rx="26" ry="11" fill="' + P.stLo + '"/>' +
      '<path d="M10 46 L22 22 L34 46 Z" fill="' + P.stMd + '"/>' +
      '<path d="M26 46 L40 16 L54 46 Z" fill="' + P.stHi + '"/>' +
      '<path d="M40 16 L54 46 L40 46 Z" fill="' + P.stMd + '" opacity=".55"/>' +
      '<path d="M40 16 L43 24 L37 25 Z" fill="#fff" opacity=".55"/>' +
      '<path d="M22 22 L24.4 28 L19.6 29 Z" fill="#fff" opacity=".35"/>';
  };
  T.city = function (k) {
    return '<rect x="10" y="26" width="44" height="24" rx="1.6" fill="' + P.wallMd + '"/>' +
      '<path d="M10 26 L10 20 L16 20 L16 26 L20 26 L20 20 L26 20 L26 26 L30 26 L30 20 L36 20 L36 26 L40 26 L40 20 L46 20 L46 26 L50 26 L50 20 L56 20 L56 26 L56 26 Z" fill="' + P.wallHi + '"/>' +
      '<path d="M24 50 L24 34 Q32 27 40 34 L40 50 Z" fill="' + P.woodLo + '"/>' +
      roof(32, 12, 26, 7, 11, k);
  };

  /* ============================================================
   * 资源（6）
   * ============================================================ */
  var R = {};
  /* v31 资源 6 重画：每个都做成"写实小品"——粮袋/木堆/石堆/矿坑/金币/村民 */
  R.grain = function (k) {
    /* 粮袋（帆布袋装粮，束口绳） */
    var s = '<ellipse cx="32" cy="56" rx="20" ry="3" fill="#000" opacity=".25"/>';
    /* 袋身（梯形上窄下宽） */
    s += '<path d="M14 22 L50 22 L54 54 L10 54 Z" fill="url(#' + G('ic_grn', P.clHi, P.clLo) + ')"/>';
    s = s.replace(G('ic_grn', P.clHi, P.clLo), '');
    s = '<ellipse cx="32" cy="56" rx="20" ry="3" fill="#000" opacity=".25"/>' +
      '<defs>' + G('ic_grn_g', P.clHi, P.clLo) + '</defs>' +
      '<path d="M14 22 L50 22 L54 54 L10 54 Z" fill="url(#ic_grn_g)"/>' +
      /* 右暗面 */
      '<path d="M32 22 L50 22 L54 54 L32 54 Z" fill="' + P.clLo + '" opacity=".28"/>' +
      /* 麻袋纹路（横线编织感） */
      '<g stroke="' + P.woodLo + '" stroke-width=".4" opacity=".55">' +
      '<path d="M14 30 L50 30"/><path d="M13 38 L51 38"/><path d="M12 46 L52 46"/>' +
      '</g>' +
      /* 束口绳（圆形束口） */
      '<ellipse cx="32" cy="22" rx="9" ry="3" fill="' + P.clMd + '"/>' +
      '<ellipse cx="32" cy="22" rx="9" ry="3" fill="none" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
      /* 绳索缠绕束口（多道弧） */
      '<path d="M23 22 Q32 18 41 22" stroke="' + P.woodMd + '" stroke-width="1.2" fill="none"/>' +
      '<path d="M23 22 Q32 26 41 22" stroke="' + P.woodMd + '" stroke-width="1.2" fill="none" opacity=".7"/>' +
      /* 粮穗头（左上伸出的麦穗） */
      '<line x1="20" y1="22" x2="14" y2="8" stroke="' + P.grLo + '" stroke-width="1.4"/>' +
      '<path d="M14 8 q3 3 0 6 q-3-3 0-6 Z" fill="' + P.goldHi + '"/>' +
      '<path d="M14 12 q-3-2-4-5 q4 0 4 5 Z" fill="' + P.goldMd + '"/>' +
      '<path d="M14 12 q3-2 4-5 q-4 0-4 5 Z" fill="' + P.goldMd + '"/>' +
      /* 袋中露出金穗 */
      '<path d="M28 20 q3 4 0 8 q-3-4 0-8 Z" fill="' + P.goldHi + '"/>' +
      '<path d="M36 20 q3 4 0 8 q-3-4 0-8 Z" fill="' + P.goldHi + '"/>';
    return s;
  };
  R.wood = function (k) {
    /* 木堆：3 段粗细不同的圆木 + 树叶点缀 */
    var s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".28"/>';
    /* 底段（最粗） */
    s += '<rect x="6" y="38" width="52" height="12" rx="2" fill="url(#' + G('ic_wd_a', P.woodHi, P.woodLo) + ')"/>';
    s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".28"/>' +
      '<defs>' + G('ic_wd_a', P.woodHi, P.woodLo) + G('ic_wd_b', P.woodMd, P.woodLo) + '</defs>' +
      '<rect x="6" y="38" width="52" height="12" rx="2" fill="url(#ic_wd_a)"/>' +
      /* 底段端面年轮 */
      '<ellipse cx="8" cy="44" rx="3" ry="6" fill="' + P.woodHi + '"/>' +
      '<ellipse cx="8" cy="44" rx="2" ry="4" fill="none" stroke="' + P.woodLo + '" stroke-width=".6"/>' +
      '<ellipse cx="8" cy="44" rx="1" ry="2" fill="' + P.woodLo + '" opacity=".7"/>' +
      /* 中段 */
      '<rect x="10" y="22" width="44" height="14" rx="2" fill="url(#ic_wd_b)"/>' +
      '<ellipse cx="54" cy="29" rx="3" ry="6" fill="' + P.woodMd + '"/>' +
      '<ellipse cx="54" cy="29" rx="2" ry="4" fill="none" stroke="' + P.woodLo + '" stroke-width=".6"/>' +
      /* 顶段（最细，亮色） */
      '<rect x="14" y="8" width="36" height="12" rx="2" fill="' + P.woodHi + '"/>' +
      '<rect x="14" y="8" width="36" height="3.4" rx="1.6" fill="#fff" opacity=".3"/>' +
      '<ellipse cx="50" cy="14" rx="3" ry="5.5" fill="' + P.woodMd + '"/>' +
      '<ellipse cx="50" cy="14" rx="2" ry="3.6" fill="none" stroke="' + P.woodLo + '" stroke-width=".6"/>' +
      /* 树皮竖纹 */
      '<g stroke="' + P.woodLo + '" stroke-width=".5" opacity=".55">' +
      '<line x1="20" y1="11" x2="20" y2="18"/><line x1="26" y1="11" x2="26" y2="18"/>' +
      '<line x1="34" y1="11" x2="34" y2="18"/><line x1="40" y1="11" x2="40" y2="18"/>' +
      '<line x1="46" y1="11" x2="46" y2="18"/>' +
      '<line x1="16" y1="25" x2="16" y2="34"/><line x1="24" y1="25" x2="24" y2="34"/>' +
      '<line x1="32" y1="25" x2="32" y2="34"/><line x1="40" y1="25" x2="40" y2="34"/>' +
      '<line x1="48" y1="25" x2="48" y2="34"/>' +
      '<line x1="12" y1="41" x2="12" y2="49"/><line x1="20" y1="41" x2="20" y2="49"/>' +
      '<line x1="28" y1="41" x2="28" y2="49"/><line x1="36" y1="41" x2="36" y2="49"/>' +
      '<line x1="44" y1="41" x2="44" y2="49"/><line x1="52" y1="41" x2="52" y2="49"/>' +
      '</g>' +
      /* 顶段嫩叶（绿色点缀） */
      '<path d="M16 8 Q14 4 18 4 Q20 6 18 9 Z" fill="' + P.grMd + '"/>' +
      '<path d="M48 8 Q50 4 46 4 Q44 6 46 9 Z" fill="' + P.grMd + '"/>';
    return s;
  };
  R.stone = function (k) {
    /* 石堆：3-4 块大小不同的石块堆叠 */
    var s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".28"/>';
    /* 底石（最大） */
    s += '<path d="M6 54 L10 38 L24 32 L40 34 L54 40 L58 54 Z" fill="' + P.stMd + '"/>' +
      '<path d="M10 38 L24 32 L40 34 L54 40 L58 54 L48 54 L36 50 L22 52 L10 54 Z" fill="' + P.stLo + '" opacity=".35"/>' +
      '<path d="M10 38 L24 32 L40 34 L54 40" stroke="' + P.stHi + '" stroke-width=".8" fill="none" opacity=".7"/>' +
      /* 中石 */
      '<path d="M14 36 L18 22 L32 18 L42 24 L44 36 Z" fill="' + P.stHi + '"/>' +
      '<path d="M32 18 L42 24 L44 36 L32 36 Z" fill="' + P.stMd + '" opacity=".4"/>' +
      '<path d="M18 22 L32 18 L42 24" stroke="' + P.stHi + '" stroke-width=".7" fill="none" opacity=".6"/>' +
      '<path d="M22 26 L26 24 M28 30 L34 28 M36 26 L40 30" stroke="' + P.stLo + '" stroke-width=".5" opacity=".55"/>' +
      /* 顶石（小而亮） */
      '<path d="M22 22 L26 10 L36 8 L40 18 L36 24 Z" fill="' + P.stHi + '"/>' +
      '<path d="M36 8 L40 18 L36 24 Z" fill="' + P.stMd + '" opacity=".35"/>' +
      '<path d="M26 10 L36 8 L40 18" stroke="#fff" stroke-width=".6" fill="none" opacity=".7"/>' +
      /* 顶石左高光 */
      '<path d="M24 18 L30 10 L36 9" stroke="#fff" stroke-width=".8" fill="none" opacity=".55"/>';
    return s;
  };
  R.iron = function (k) {
    /* 矿堆：坑坑洼洼的矿石块 + 红色光晕（暗示熔/热） */
    var s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".28"/>';
    /* 底矿（大块不规则） */
    s += '<path d="M8 52 L12 36 L20 30 L34 32 L48 30 L56 38 L56 52 Z" fill="' + P.irLo + '"/>' +
      '<path d="M12 36 L20 30 L34 32 L48 30 L56 38" stroke="' + P.irMd + '" stroke-width=".9" fill="none"/>' +
      /* 中矿 */
      '<path d="M16 34 L22 22 L34 20 L46 26 L48 34 Z" fill="' + P.irMd + '"/>' +
      '<path d="M22 22 L34 20 L46 26 L48 34 L34 34 Z" fill="' + P.irHi + '" opacity=".4"/>' +
      '<path d="M22 22 L34 20 L46 26" stroke="#fff" stroke-width=".7" fill="none" opacity=".6"/>' +
      /* 顶矿（小，最亮） */
      '<path d="M24 22 L28 10 L38 8 L42 18 L38 22 Z" fill="' + P.irHi + '"/>' +
      '<path d="M38 8 L42 18 L38 22 Z" fill="' + P.irMd + '" opacity=".4"/>' +
      '<path d="M28 10 L38 8 L42 18" stroke="#fff" stroke-width=".8" fill="none" opacity=".7"/>' +
      /* 红色光晕（暗示熔融） */
      '<circle cx="32" cy="20" r="3" fill="' + P.fiHi + '" opacity=".7"/>' +
      '<circle cx="32" cy="20" r="1.6" fill="#fff" opacity=".6"/>' +
      /* 矿面裂纹 */
      '<g stroke="' + P.ink + '" stroke-width=".6" opacity=".5">' +
      '<path d="M14 42 L20 44 M18 46 L26 48 M28 42 L34 44 M32 48 L40 46 M40 42 L48 44"/>' +
      '<path d="M22 30 L28 32 M26 36 L32 38 M36 28 L42 30"/>' +
      '</g>' +
      /* 散落小矿屑 */
      '<circle cx="14" cy="50" r="1.4" fill="' + P.irMd + '"/>' +
      '<circle cx="52" cy="50" r="1.6" fill="' + P.irMd + '"/>' +
      '<circle cx="58" cy="48" r="1" fill="' + P.irMd + '"/>';
    return s;
  };
  R.gold = function (k) {
    /* 金币堆：3 叠古钱币 + 金光 */
    var s = '<ellipse cx="32" cy="54" rx="22" ry="3" fill="#000" opacity=".25"/>';
    /* 后排高叠 */
    s += '<rect x="40" y="20" width="14" height="30" rx="1.4" fill="' + P.goldLo + '"/>' +
      '<ellipse cx="47" cy="20" rx="7" ry="2.6" fill="' + P.goldMd + '"/>' +
      '<ellipse cx="47" cy="20" rx="7" ry="2.6" fill="none" stroke="' + P.goldHi + '" stroke-width=".8"/>' +
      '<ellipse cx="47" cy="50" rx="7" ry="2.6" fill="' + P.goldLo + '"/>' +
      /* 金币叠竖纹（多枚） */
      '<line x1="40" y1="26" x2="54" y2="26" stroke="' + P.goldHi + '" stroke-width=".6" opacity=".6"/>' +
      '<line x1="40" y1="32" x2="54" y2="32" stroke="' + P.goldHi + '" stroke-width=".6" opacity=".6"/>' +
      '<line x1="40" y1="38" x2="54" y2="38" stroke="' + P.goldHi + '" stroke-width=".6" opacity=".6"/>' +
      '<line x1="40" y1="44" x2="54" y2="44" stroke="' + P.goldHi + '" stroke-width=".6" opacity=".6"/>' +
      /* 前排左叠 */
      '<rect x="10" y="28" width="14" height="22" rx="1.4" fill="' + P.goldMd + '"/>' +
      '<ellipse cx="17" cy="28" rx="7" ry="2.6" fill="' + P.goldHi + '"/>' +
      '<ellipse cx="17" cy="28" rx="7" ry="2.6" fill="none" stroke="' + P.goldLo + '" stroke-width=".7"/>' +
      '<ellipse cx="17" cy="50" rx="7" ry="2.6" fill="' + P.goldMd + '"/>' +
      /* 古钱方孔 */
      '<rect x="15" y="35" width="4" height="4" fill="' + P.goldLo + '"/>' +
      '<rect x="15" y="42" width="4" height="4" fill="' + P.goldLo + '"/>' +
      /* 前排中间矮叠 */
      '<rect x="26" y="36" width="14" height="14" rx="1.4" fill="' + P.goldMd + '"/>' +
      '<ellipse cx="33" cy="36" rx="7" ry="2.4" fill="' + P.goldHi + '"/>' +
      '<ellipse cx="33" cy="36" rx="7" ry="2.4" fill="none" stroke="' + P.goldLo + '" stroke-width=".7"/>' +
      '<ellipse cx="33" cy="50" rx="7" ry="2.4" fill="' + P.goldMd + '"/>' +
      '<rect x="31" y="40" width="4" height="4" fill="' + P.goldLo + '"/>' +
      /* 散落金币（地上一枚，斜放） */
      '<ellipse cx="6" cy="52" rx="5" ry="2" fill="' + P.goldHi + '" transform="rotate(-20 6 52)"/>' +
      '<ellipse cx="6" cy="52" rx="5" ry="2" fill="none" stroke="' + P.goldLo + '" stroke-width=".6" transform="rotate(-20 6 52)"/>' +
      '<rect x="4.5" y="51" width="3" height="3" fill="' + P.goldLo + '" transform="rotate(-20 6 52)"/>' +
      /* 金光星芒 */
      '<g stroke="' + P.goldHi + '" stroke-width=".7" stroke-linecap="round" opacity=".7">' +
      '<line x1="32" y1="6" x2="32" y2="12"/><line x1="22" y1="10" x2="26" y2="14"/>' +
      '<line x1="42" y1="10" x2="38" y2="14"/><line x1="20" y1="16" x2="24" y2="18"/>' +
      '<line x1="44" y1="16" x2="40" y2="18"/>' +
      '</g>';
    return s;
  };
  R.pop = function (k) {
    /* 村民队列：3 个小人剪影（一家） */
    var s = '<ellipse cx="32" cy="56" rx="24" ry="2.6" fill="#000" opacity=".25"/>';
    /* 左边小人（小孩） */
    s += '<circle cx="12" cy="22" r="3.8" fill="' + P.clHi + '"/>' +
      '<path d="M8 22 Q8 18 12 18 Q16 18 16 22 L16 24 L8 24 Z" fill="' + P.clLo + '"/>' +
      '<path d="M8 38 Q8 28 12 28 Q16 28 16 38 L13 38 L13 50 L11 50 L11 38 Z" fill="' + P.clMd + '"/>' +
      '<path d="M12 28 Q16 28 16 38 L13 38 L13 50 L15 50 L15 38 Z" fill="' + P.clLo + '" opacity=".4"/>' +
      /* 中间高个（成年人，戴斗笠） */
      '<ellipse cx="32" cy="14" rx="7" ry="2.4" fill="' + P.woodLo + '"/>' +
      '<rect x="30" y="13" width="4" height="6" fill="' + P.woodMd + '"/>' +
      '<circle cx="32" cy="22" r="4.2" fill="' + P.clHi + '"/>' +
      '<path d="M22 38 Q22 28 32 28 Q42 28 42 38 L37 50 L27 50 Z" fill="' + P.clMd + '"/>' +
      '<path d="M32 28 Q42 28 42 38 L37 50 L33 50 L33 28 Z" fill="' + P.clLo + '" opacity=".4"/>' +
      /* 腰带 */
      '<rect x="22" y="36" width="20" height="2" fill="' + P.woodLo + '"/>' +
      /* 右手持工具 */
      '<rect x="40" y="32" width="3" height="12" rx="1" transform="rotate(-20 41 38)" fill="' + P.woodMd + '"/>' +
      '<rect x="38" y="40" width="5" height="6" rx="1.4" transform="rotate(-20 41 43)" fill="' + P.irMd + '"/>' +
      /* 右边小人（戴包头） */
      '<path d="M50 16 Q50 12 54 12 Q58 12 58 16 L58 20 L50 20 Z" fill="' + P.woodLo + '"/>' +
      '<circle cx="54" cy="24" r="3.8" fill="' + P.clHi + '"/>' +
      '<path d="M50 38 Q50 28 54 28 Q58 28 58 38 L55 38 L55 50 L53 50 L53 38 Z" fill="' + P.clMd + '"/>' +
      /* 左边小人手持草 */
      '<line x1="6" y1="30" x2="14" y2="28" stroke="' + P.woodMd + '" stroke-width="1.4"/>' +
      '<path d="M14 28 q4 2 0 5 q-4-3 0-5 Z" fill="' + P.goldHi + '"/>' +
      /* 旗帜（中间成人肩扛小旗） */
      '<line x1="22" y1="22" x2="22" y2="14" stroke="' + P.woodMd + '" stroke-width="1.2"/>' +
      '<path d="M22 14 L30 16 L22 18 Z" fill="' + P.rMd + '"/>' +
      '<path d="M22 14 L26 15 L22 16 Z" fill="' + P.rHi + '"/>';
    return s;
  };

  /* ============================================================
   * 兵种（18）— 剪影 + 主武器，按兵科分色
   * ============================================================ */
  /* v31 兵种四类独立剪影
     foot: 步兵（持长兵器，盾在身侧）
     bow: 自走火炮（开弓姿态）
     horse: 机车（马+骑手剪影）
     cart: 器械（车/弩/东风快递） */
  function soldierFoot(tone, w) {
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    var s = '<ellipse cx="30" cy="56" rx="14" ry="2.6" fill="#000" opacity=".28"/>';
    /* 双腿（左前右后） */
    s += '<path d="M24 44 L21 56 L26 56 L29 44 Z" fill="' + C3 + '"/>' +
      '<path d="M31 44 L30 56 L35 56 L36 44 Z" fill="' + C2 + '"/>' +
      '<path d="M22 54 L26 54 M30 54 L34 54" stroke="#000" stroke-width=".6" opacity=".5"/>';
    /* 铠甲胸甲（左右分色） */
    s += '<path d="M22 22 L18 44 L30 44 L30 22 Z" fill="' + C2 + '"/>' +
      '<path d="M30 22 L42 22 L42 44 L30 44 Z" fill="' + C3 + '"/>' +
      /* 胸甲鳞片 */
      '<g stroke="' + C1 + '" stroke-width=".4" opacity=".55">' +
      '<path d="M21 28 L42 28"/><path d="M20 32 L42 32"/><path d="M19 36 L42 36"/><path d="M19 40 L42 40"/>' +
      '</g>' +
      /* 腰带 */
      '<rect x="18" y="40" width="24" height="3" fill="' + P.woodLo + '"/>' +
      '<rect x="29" y="39.5" width="3" height="4" rx=".8" fill="' + P.goldMd + '"/>';
    /* 双臂（持兵器） */
    s += '<path d="M22 22 L16 30 L18 32 L24 24 Z" fill="' + C2 + '"/>' + /* 左臂 */
      '<path d="M42 22 L48 16 L50 18 L44 24 Z" fill="' + C3 + '"/>' + /* 右臂 */
      /* 手 */
      '<circle cx="16.5" cy="30.5" r="1.6" fill="' + P.woodMd + '"/>' +
      '<circle cx="48.5" cy="16.5" r="1.6" fill="' + P.woodMd + '"/>';
    /* 头 */
    s += '<circle cx="32" cy="18" r="4.2" fill="' + P.woodMd + '"/>' +
      '<circle cx="32" cy="18" r="3.4" fill="' + P.clHi + '"/>' +
      '<circle cx="31" cy="16.5" r="1" fill="#fff" opacity=".4"/>';
    /* 头盔（带面甲） */
    s += '<path d="M27.4 16 Q27.4 11 32 11 Q36.6 11 36.6 16 Z" fill="' + C1 + '"/>' +
      '<rect x="27.6" y="14" width="8.8" height="2" rx="1" fill="' + C3 + '"/>' +
      /* 盔缨 */
      '<path d="M32 8 L31 4 M32 8 L33 4 M32 8 L32 3" stroke="' + P.rMd + '" stroke-width=".8" stroke-linecap="round"/>' +
      '<circle cx="32" cy="8" r="1" fill="' + P.goldMd + '"/>';
    /* 持的兵器（按 w 分） */
    if (w === 'spear') {
      s += '<line x1="50" y1="6" x2="44" y2="50" stroke="' + P.woodMd + '" stroke-width="2"/>' +
        '<path d="M50 6 L53 2 L55 6 L52 8 Z" fill="' + P.irHi + '"/>' +
        '<path d="M50 6 L53 2 L52 6 Z" fill="#fff" opacity=".5"/>';
    } else if (w === 'sword') {
      s += '<path d="M48 14 L54 8 L56 10 L50 16 Z" fill="' + P.irHi + '"/>' +
        '<path d="M48 14 L54 8 L55 9 L49 15 Z" fill="#fff" opacity=".4"/>' +
        '<rect x="44" y="14" width="9" height="2" rx=".8" transform="rotate(-45 48 15)" fill="' + P.goldMd + '"/>' +
        '<rect x="46" y="16" width="5" height="2.4" rx="1" transform="rotate(-45 48 17)" fill="' + P.woodMd + '"/>';
    } else if (w === 'shield') {
      s += '<rect x="10" y="26" width="14" height="20" rx="3" fill="' + P.irMd + '"/>' +
        '<rect x="10" y="26" width="14" height="5" rx="2" fill="' + P.irHi + '"/>' +
        '<path d="M12 30 L22 30 L22 42 Q17 48 12 42 Z" fill="' + P.goldMd + '"/>' +
        '<circle cx="17" cy="36" r="2.4" fill="' + P.rMd + '"/>' +
        '<line x1="17" y1="26" x2="17" y2="46" stroke="' + P.irLo + '" stroke-width="1"/>';
    } else if (w === 'axe') {
      s += '<line x1="50" y1="12" x2="46" y2="46" stroke="' + P.woodMd + '" stroke-width="2"/>' +
        '<path d="M48 10 Q56 4 60 10 Q56 14 52 18 Q49 14 48 10 Z" fill="' + P.irHi + '"/>' +
        '<path d="M48 10 Q56 4 60 10 L54 12 Z" fill="#fff" opacity=".4"/>';
    }
    return s;
  }
  function soldierBow(tone) {
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    var s = '<ellipse cx="30" cy="56" rx="14" ry="2.6" fill="#000" opacity=".28"/>';
    /* 双腿 */
    s += '<path d="M24 44 L21 56 L26 56 L29 44 Z" fill="' + C3 + '"/>' +
      '<path d="M31 44 L30 56 L35 56 L36 44 Z" fill="' + C2 + '"/>';
    /* 轻型胸甲（窄） */
    s += '<path d="M22 22 L20 44 L30 44 L30 22 Z" fill="' + C2 + '"/>' +
      '<path d="M30 22 L42 22 L42 44 L30 44 Z" fill="' + C3 + '"/>' +
      '<g stroke="' + C1 + '" stroke-width=".4" opacity=".5">' +
      '<path d="M21 28 L42 28"/><path d="M20 32 L42 32"/><path d="M19 36 L42 36"/><path d="M19 40 L42 40"/>' +
      '</g>';
    /* 左臂持弓（弓弦拉满姿态） */
    s += '<path d="M22 22 L14 30 L18 38 L24 32 Z" fill="' + C2 + '"/>' +
      /* 弓身（弯曲，浅色木） */
      '<path d="M14 30 Q6 36 14 46" stroke="' + P.woodHi + '" stroke-width="2.4" fill="none"/>' +
      '<path d="M14 30 Q6 36 14 46" stroke="' + P.woodLo + '" stroke-width=".8" fill="none" opacity=".5"/>' +
      /* 弓弦（拉紧） */
      '<line x1="14" y1="30" x2="22" y2="38" stroke="' + P.clHi + '" stroke-width=".9"/>' +
      /* 箭（搭弦） */
      '<line x1="22" y1="38" x2="48" y2="32" stroke="' + P.woodMd + '" stroke-width="1.4"/>' +
      '<path d="M48 32 L52 30 L52 33 L48 34 Z" fill="' + P.irHi + '"/>' +
      /* 箭羽 */
      '<path d="M44 33 L46 31 L46 33 Z M44 33 L46 35 L46 33 Z" fill="' + P.clHi + '"/>';
    /* 右臂拉弦 */
    s += '<path d="M42 22 L48 30 L44 34 L40 26 Z" fill="' + C3 + '"/>' +
      '<circle cx="46" cy="32" r="1.6" fill="' + P.woodMd + '"/>';
    /* 头 */
    s += '<circle cx="32" cy="18" r="4.2" fill="' + P.woodMd + '"/>' +
      '<circle cx="32" cy="18" r="3.4" fill="' + P.clHi + '"/>' +
      '<circle cx="31" cy="16.5" r="1" fill="#fff" opacity=".4"/>';
    /* 盔（轻盔，无缨） */
    s += '<path d="M27.6 16 Q27.6 11.5 32 11.5 Q36.4 11.5 36.4 16 Z" fill="' + C1 + '"/>' +
      '<rect x="27.6" y="14" width="8.8" height="2" rx="1" fill="' + C3 + '"/>' +
      /* 箭袋 */
      '<rect x="36" y="34" width="5" height="14" rx="1.4" fill="' + P.woodLo + '"/>' +
      '<rect x="36" y="34" width="5" height="3" rx="1" fill="' + P.clMd + '"/>' +
      /* 露出箭尾 */
      '<line x1="37" y1="36" x2="36" y2="32" stroke="' + P.woodMd + '" stroke-width=".7"/>' +
      '<line x1="39" y1="36" x2="38" y2="32" stroke="' + P.woodMd + '" stroke-width=".7"/>' +
      '<line x1="41" y1="36" x2="40" y2="32" stroke="' + P.woodMd + '" stroke-width=".7"/>';
    return s;
  }
  function soldierMount(tone, w) {
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    /* v89.216 换皮视觉层：骑兵剪影 → **机车**（两轮 + 车架 + 油箱 + 车把 + 前灯 + 骑行姿态；
       车头朝右）。武器语汇同旧版（矛/刀/弓/斧 一只手可持）—— 兵种语义已是「伏击车/
       主战机甲/武装直升机」，马形才是真正的错配。 */
    var s = '<ellipse cx="32" cy="57" rx="22" ry="2.6" fill="#000" opacity=".28"/>';
    var wheel = function (cx) {
      return '<circle cx="' + cx + '" cy="50" r="6.6" fill="' + P.irLo + '"/>' +
        '<circle cx="' + cx + '" cy="50" r="4.6" fill="' + P.stLo + '"/>' +
        '<circle cx="' + cx + '" cy="50" r="1.5" fill="' + P.irHi + '"/>' +
        '<g stroke="' + P.irHi + '" stroke-width=".7" opacity=".45">' +
        '<line x1="' + cx + '" y1="44.6" x2="' + cx + '" y2="55.4"/>' +
        '<line x1="' + (cx - 5.4) + '" y1="50" x2="' + (cx + 5.4) + '" y2="50"/></g>';
    };
    s += wheel(13) + wheel(51);
    /* 车架 + 油箱 + 座垫 + 排气管 + 车把 + 前灯 */
    s += '<path d="M12 50 L21 39 L43 39 L52 50 L47.4 50 L40 42.6 L24 42.6 L16.6 50 Z" fill="' + C2 + '"/>' +
      '<path d="M21 31.4 L43 31.4 Q45 31.4 45 33.4 L45 36.6 Q45 38.6 43 38.6 L21 38.6 Q19 38.6 19 36.6 L19 33.4 Q19 31.4 21 31.4 Z" fill="' + C1 + '"/>' +
      '<path d="M21 31.4 L43 31.4 Q45 31.4 45 33.4 L45 34.2 L19 34.2 L19 33.4 Q19 31.4 21 31.4 Z" fill="' + C3 + '" opacity=".75"/>' +
      '<path d="M44 45 L57 45 L57 48.2 L43 48.2 Z" fill="' + P.irMd + '"/>' +
      '<path d="M54 34.4 L63 33 L63.8 36.2 L54.8 37.4 Z" fill="' + C3 + '"/>' +
      '<line x1="58.6" y1="34.6" x2="58.6" y2="30" stroke="' + P.irMd + '" stroke-width="1.6"/>' +
      '<circle cx="61.4" cy="28.6" r="2.8" fill="' + P.goldHi + '"/>' +
      '<path d="M14 31 L27 30 L29 33.4 L14 34.4 Z" fill="' + P.leatherMd + '"/>' +
      '<line x1="24" y1="42.6" x2="18" y2="48" stroke="' + P.irLo + '" stroke-width="1.4"/>' +
      '<line x1="40" y1="42.6" x2="48" y2="48" stroke="' + P.irLo + '" stroke-width="1.4"/>';
    /* 骑手（骑行姿态：前倾，腿跨车身） */
    s += '<path d="M24 24 L21 34 L28 34 L30 24 Z" fill="' + C3 + '"/>' +
      '<path d="M36 24 L38 34 L45 34 L42 24 Z" fill="' + C2 + '"/>' +
      '<path d="M22 15 L20 27 L32 27 L32 15 Z" fill="' + C2 + '"/>' +
      '<path d="M32 15 L44 15 L42 27 L32 27 Z" fill="' + C3 + '"/>' +
      '<g stroke="' + C1 + '" stroke-width=".4" opacity=".5">' +
      '<path d="M21 19 L43 19"/><path d="M20.6 23 L42.4 23"/>' +
      '</g>';
    /* 左臂（持兵器；握在车把上方） */
    s += '<path d="M22 15 L51 12 L52.6 14.6 L21 18 Z" fill="' + C2 + '"/>' +
      '<circle cx="52" cy="13.4" r="1.5" fill="' + P.leatherMd + '"/>';
    /* 持兵器 */
    if (w === 'spear') {
      s += '<line x1="52" y1="13" x2="44" y2="1" stroke="' + P.woodMd + '" stroke-width="2"/>' +
        '<path d="M44 1 L47 -2 L49 2 L46 4 Z" fill="' + P.irHi + '"/>';
    } else if (w === 'sword') {
      s += '<path d="M52 13 L46 9 L48 7 L54 11 Z" fill="' + P.irHi + '"/>' +
        '<rect x="48" y="11" width="6" height="1.6" rx=".8" transform="rotate(-30 51 12)" fill="' + P.goldMd + '"/>';
    } else if (w === 'bow') {
      s += '<path d="M52 13 Q44 7 52 3" stroke="' + P.woodHi + '" stroke-width="1.8" fill="none"/>' +
        '<line x1="52" y1="13" x2="52" y2="3" stroke="' + P.clHi + '" stroke-width=".7"/>';
    } else if (w === 'axe') {
      s += '<line x1="52" y1="13" x2="50" y2="3" stroke="' + P.woodMd + '" stroke-width="1.6"/>' +
        '<path d="M48 3 Q42 -1 38 3 Q44 7 48 7 Z" fill="' + P.irHi + '"/>';
    }
    /* 右臂（扶把） */
    s += '<path d="M44 15 L56 20 L57.4 18 L45.4 13 Z" fill="' + C3 + '"/>';
    /* 头 + 盔（战术头盔 + 护目镜） */
    s += '<circle cx="32" cy="11.4" r="4.2" fill="' + P.leatherMd + '"/>' +
      '<circle cx="32" cy="11.4" r="3.4" fill="' + P.clHi + '"/>' +
      '<path d="M27.4 9.4 Q27.4 4 32 4 Q36.6 4 36.6 9.4 Z" fill="' + C1 + '"/>' +
      '<rect x="27.4" y="7.4" width="9.2" height="2" rx="1" fill="' + C3 + '"/>' +
      '<rect x="28.2" y="10.6" width="7.6" height="2.1" rx="1" fill="' + P.irMd + '" opacity=".9"/>' +
      '<path d="M32 4 L30 1.4 M32 4 L34 1.4" stroke="' + P.irLo + '" stroke-width=".7" stroke-linecap="round"/>';
    return s;
  }
  function soldierCart(tone, kind) {
    /* v31：器械四类——运输平台/东风快递/无人轰炸机/东风快递 */
    var C1 = tone[0], C2 = tone[1], C3 = tone[2];
    var s = '<ellipse cx="32" cy="56" rx="20" ry="2.6" fill="#000" opacity=".28"/>';
    /* 车轮（两轮） */
    s += '<circle cx="14" cy="50" r="6" fill="' + P.woodMd + '"/>' +
      '<circle cx="14" cy="50" r="4.2" fill="' + P.woodLo + '"/>' +
      '<circle cx="14" cy="50" r="1.4" fill="' + P.woodMd + '"/>' +
      '<g stroke="' + P.woodHi + '" stroke-width=".8" opacity=".6">' +
      '<line x1="14" y1="46" x2="14" y2="54"/><line x1="10" y1="50" x2="18" y2="50"/>' +
      '<line x1="11" y1="47" x2="17" y2="53"/><line x1="11" y1="53" x2="17" y2="47"/>' +
      '</g>' +
      '<circle cx="50" cy="50" r="6" fill="' + P.woodMd + '"/>' +
      '<circle cx="50" cy="50" r="4.2" fill="' + P.woodLo + '"/>' +
      '<circle cx="50" cy="50" r="1.4" fill="' + P.woodMd + '"/>' +
      '<g stroke="' + P.woodHi + '" stroke-width=".8" opacity=".6">' +
      '<line x1="50" y1="46" x2="50" y2="54"/><line x1="46" y1="50" x2="54" y2="50"/>' +
      '<line x1="47" y1="47" x2="53" y2="53"/><line x1="47" y1="53" x2="53" y2="47"/>' +
      '</g>' +
      /* 车板（两轮间木架） */
      '<rect x="20" y="42" width="24" height="6" rx="1.4" fill="' + P.woodMd + '"/>' +
      '<rect x="20" y="42" width="24" height="2" rx="1" fill="' + P.woodHi + '"/>';
    /* 车轴连轮 */
    s += '<line x1="14" y1="50" x2="20" y2="44" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
      '<line x1="50" y1="50" x2="44" y2="44" stroke="' + P.woodLo + '" stroke-width="1.6"/>';
    if (kind === 'cart') {
      /* 东风快递：基座 + 抛杆 + 配重 + 弹丸 */
      s += '<path d="M20 30 L44 30 L46 42 L18 42 Z" fill="' + C2 + '"/>' +
        '<path d="M20 30 L32 30 L32 42 L18 42 Z" fill="' + C1 + '" opacity=".4"/>' +
        /* 抛杆（斜向上） */
        '<line x1="32" y1="30" x2="14" y2="8" stroke="' + P.woodLo + '" stroke-width="2.4"/>' +
        /* 配重（吊在抛杆尾端大箱） */
        '<rect x="36" y="28" width="12" height="10" rx="1.4" fill="' + P.woodLo + '"/>' +
        '<rect x="36" y="28" width="12" height="3" rx="1" fill="' + P.woodHi + '"/>' +
        /* 弹丸（吊在抛杆头） */
        '<circle cx="14" cy="8" r="3" fill="' + P.stLo + '"/>' +
        '<circle cx="13" cy="7" r="1.2" fill="' + P.stHi + '" opacity=".7"/>';
    } else if (kind === 'siege_ram') {
      /* 东风快递：上覆皮盾的攻城槌 */
      s += '<path d="M20 18 L44 18 L46 30 L18 30 Z" fill="' + C2 + '"/>' +
        '<path d="M20 18 L32 18 L32 30 L18 30 Z" fill="' + C1 + '" opacity=".4"/>' +
        /* 屋顶皮盖 */
        '<path d="M18 18 Q32 10 46 18 Z" fill="' + P.rMd + '"/>' +
        '<path d="M18 18 Q32 10 46 18" stroke="' + P.rHi + '" stroke-width="1" fill="none" opacity=".7"/>' +
        /* 皮盖铆钉 */
        '<circle cx="24" cy="14" r="1" fill="' + P.goldMd + '"/>' +
        '<circle cx="32" cy="11" r="1" fill="' + P.goldMd + '"/>' +
        '<circle cx="40" cy="14" r="1" fill="' + P.goldMd + '"/>' +
        /* 攻城槌（前方） */
        '<line x1="14" y1="36" x2="18" y2="36" stroke="' + P.woodLo + '" stroke-width="2"/>' +
        '<rect x="6" y="34" width="12" height="4" rx="1.4" fill="' + P.woodMd + '"/>' +
        /* 槌头铁箍 */
        '<rect x="4" y="34" width="3" height="4" fill="' + P.irMd + '"/>' +
        '<rect x="15" y="34" width="3" height="4" fill="' + P.irMd + '"/>' +
        /* 铜钉 */
        '<circle cx="12" cy="36" r=".8" fill="' + P.goldMd + '"/>';
    } else if (kind === 'ballista') {
      /* 无人轰炸机：巨型弓 + 弩臂 + 弩机 */
      s += '<rect x="18" y="36" width="28" height="6" rx="1" fill="' + C2 + '"/>' +
        '<path d="M18 36 L32 36 L32 42 L18 42 Z" fill="' + C1 + '" opacity=".4"/>' +
        /* 弩臂 */
        '<path d="M18 36 Q12 18 18 12" stroke="' + P.woodLo + '" stroke-width="3" fill="none"/>' +
        '<path d="M46 36 Q52 18 46 12" stroke="' + P.woodLo + '" stroke-width="3" fill="none"/>' +
        '<path d="M18 36 Q12 18 18 12" stroke="' + P.woodHi + '" stroke-width="1" fill="none" opacity=".5"/>' +
        '<path d="M46 36 Q52 18 46 12" stroke="' + P.woodHi + '" stroke-width="1" fill="none" opacity=".5"/>' +
        /* 弩机（中间扳机盒） */
        '<rect x="29" y="22" width="6" height="14" rx="1" fill="' + P.woodMd + '"/>' +
        '<rect x="30" y="24" width="4" height="3" rx=".6" fill="' + P.goldMd + '"/>' +
        /* 长箭 */
        '<line x1="14" y1="12" x2="50" y2="12" stroke="' + P.woodMd + '" stroke-width="1.6"/>' +
        '<path d="M50 12 L54 10 L54 14 Z" fill="' + P.irHi + '"/>' +
        /* 箭羽 */
        '<path d="M48 11 L50 9 L50 11 Z M48 13 L50 15 L50 13 Z" fill="' + P.clHi + '"/>';
    } else if (kind === 'catapult') {
      /* 东风快递（原投石车形制）：高架投臂 + 弹筐 */
      s += '<path d="M22 32 L42 32 L42 42 L22 42 Z" fill="' + C2 + '"/>' +
        '<path d="M22 32 L32 32 L32 42 L22 42 Z" fill="' + C1 + '" opacity=".4"/>' +
        /* 投臂（斜向下，弹筐端朝下） */
        '<line x1="32" y1="32" x2="14" y2="42" stroke="' + P.woodLo + '" stroke-width="2.4"/>' +
        '<line x1="32" y1="32" x2="48" y2="14" stroke="' + P.woodLo + '" stroke-width="2.4"/>' +
        /* 弹筐（投臂左下端） */
        '<path d="M10 40 L18 40 L20 46 L8 46 Z" fill="' + P.woodMd + '"/>' +
        '<ellipse cx="14" cy="40" rx="5" ry="2" fill="' + P.woodHi + '"/>' +
        '<ellipse cx="14" cy="40" rx="3.6" ry="1.2" fill="' + P.woodMd + '"/>' +
        /* 配重（右上端大石） */
        '<rect x="44" y="10" width="10" height="6" rx="1" fill="' + P.stMd + '"/>' +
        '<rect x="44" y="10" width="10" height="2" fill="' + P.stHi + '"/>' +
        /* 弹丸（地上一颗） */
        '<circle cx="14" cy="50" r="2.4" fill="' + P.stLo + '"/>';
    }
    /* 器械操作员（右侧小剪影） */
    s += '<rect x="46" y="34" width="6" height="10" rx="1" fill="' + C3 + '" opacity=".7"/>' +
      '<circle cx="49" cy="32" r="1.8" fill="' + P.woodMd + '"/>';
    return s;
  }
  function weapon(k, kind) {
    /* v31 简化：本函数保留兼容入口，实际绘制由 soldier* 系列完成。
       仅当 troop_*.w 未指定时 fallback 到老绘制。 */
    if (kind === 'spear') return '<line x1="44" y1="14" x2="40" y2="52" stroke="' + P.woodMd + '" stroke-width="2"/>' +
      '<path d="M44 14 L46.6 6 L49 14 L46.6 17 Z" fill="' + P.irHi + '"/>';
    if (kind === 'sword') return '<path d="M41 20 L47 14 L50 17 L44 23 Z" fill="' + P.irHi + '"/>' +
      '<rect x="37" y="21" width="8" height="2.4" rx="1" transform="rotate(-45 41 22)" fill="' + P.goldMd + '"/>';
    if (kind === 'bow') return '<path d="M44 18 Q54 30 44 42" fill="none" stroke="' + P.woodMd + '" stroke-width="2.4"/>' +
      '<line x1="44" y1="18" x2="44" y2="42" stroke="' + P.clHi + '" stroke-width=".9"/>' +
      '<line x1="40" y1="30" x2="50" y2="30" stroke="' + P.woodLo + '" stroke-width="1.2"/>';
    if (kind === 'shield') return '<path d="M24 30 L38 30 L38 42 Q31 50 24 42 Z" fill="' + P.irMd + '"/>' +
      '<path d="M26 32 L36 32 L36 41 Q31 47 26 41 Z" fill="' + P.goldMd + '" opacity=".6"/>';
    if (kind === 'axe') return '<rect x="40" y="18" width="2.2" height="20" rx="1" transform="rotate(12 41 28)" fill="' + P.woodMd + '"/>' +
      '<path d="M38 20 Q46 12 54 18 Q48 20 45 26 Q41 24 38 20 Z" fill="' + P.irHi + '"/>';
    if (kind === 'cart') return '<rect x="30" y="34" width="24" height="14" rx="2" fill="' + P.woodMd + '"/>' +
      '<rect x="30" y="34" width="24" height="4" fill="' + P.woodHi + '"/>' +
      '<circle cx="36" cy="50" r="4.4" fill="' + P.woodLo + '"/><circle cx="48" cy="50" r="4.4" fill="' + P.woodLo + '"/>' +
      '<circle cx="36" cy="50" r="1.6" fill="' + P.woodHi + '"/><circle cx="48" cy="50" r="1.6" fill="' + P.woodHi + '"/>';
    return '';
  }
  var TR = {
    /* v89.229 兵种重构：18→14 —— 按原型继承剪影（tone/cls/w），14 个新 id 全覆盖；
       位图（assets/icons/ui/ai_<id>.png）缺省回退本表（forTroop 老绘制路径）。
       新增兵种只在本表登记即可（与 TROOPS 表同构扩展）。 */
    banche:    { tone: ['#a89070', '#c4a985', '#8a7154'], cls: 'cart', w: 'cart' },
    fujiche:   { tone: ['#8a7358', '#a88e6c', '#665340'], w: 'sword', cls: 'mount', mount: true },
    zhencha:   { tone: ['#7f9a86', '#9fb8a4', '#5f7a68'], cls: 'bow', w: 'bow', light: true },
    yunshu:    { tone: ['#96876c', '#b2a184', '#70624c'], cls: 'cart', w: 'cart' },
    buxingji:  { tone: ['#8f7a5e', '#ac9673', '#6d5c48'], cls: 'foot', w: 'spear' },
    dunwei:    { tone: ['#8a7f6a', '#a89c84', '#6a6050'], cls: 'foot', w: 'shield' },
    daodanche: { tone: ['#8e9463', '#a8ae7c', '#6c714c'], cls: 'bow', w: 'bow' },
    wuzhi:     { tone: ['#7a8a6a', '#98a886', '#586648'], w: 'bow', cls: 'mount', mount: true },
    zhuzhan:   { tone: ['#8a5f45', '#a87c5e', '#654232'], w: 'sword', cls: 'mount', mount: true },
    kuanglie:  { tone: ['#8f6a3c', '#ab864f', '#6a4c29'], w: 'spear', cls: 'mount', mount: true },
    dianci:    { tone: ['#6e8f5c', '#8cab77', '#4f6a41'], cls: 'foot', w: 'shield' },
    huopao:    { tone: ['#75664b', '#8f7d5c', '#544a36'], cls: 'cart', w: 'cart' },
    wuren:     { tone: ['#7d7154', '#9a8d6c', '#5c5240'], cls: 'bow', w: 'bow' },
    taitan:    { tone: ['#6f7a8a', '#8d98a8', '#525b68'], w: 'axe', beast: true },
    /* v91.99 中程梯队（射程 450/600/700）：位图缺省回退本表，必须登记 */
    paojiban:  { tone: ['#8a7f5c', '#a89a74', '#645b40'], cls: 'foot', w: 'bow' },
    zhongjiqiang: { tone: ['#7a6a58', '#96846f', '#564a3c'], cls: 'foot', w: 'bow' },
    guidaopao: { tone: ['#6d7480', '#8b93a0', '#4f545d'], cls: 'cart', w: 'cart' },
  };
  Object.keys(TR).forEach(function (id) {
    ICON['troop_' + id] = function (k) {
      var c = TR[id];
      var s = '';
      if (c.beast) {
        /* 泰坦机甲 */
        s += '<path d="M8 52 L12 38 Q16 32 26 32 L44 32 Q50 33 50 38 L48 40 L49 47 Q49 50 46 50 L42 50 L42 53 L39 53 L39 50 L20 50 L20 53 L17 53 L17 50 Z" fill="' + P.stLo + '"/>' +
          '<path d="M14 36 Q16 30 22 30 L26 32 L22 38 Z" fill="' + P.stMd + '"/>' +
          '<path d="M14 40 Q8 44 8 50 Q12 50 13 44 Z" fill="' + P.stMd + '"/>' +
          '<path d="M46 30 Q50 26 54 30 Q50 32 46 34 Z" fill="' + P.stMd + '"/>' +
          '<rect x="20" y="20" width="24" height="12" rx="1.6" fill="' + P.woodMd + '"/>' +
          flag(30, 22, 14, P.rMd, P.rHi);
      } else if (c.cls === 'bow') {
        /* v31：自走火炮独立剪影 */
        s += soldierBow(c.tone);
      } else if (c.cls === 'mount') {
        /* v31：机车（车体+骑手）独立剪影 */
        s += soldierMount(c.tone, c.w);
      } else if (c.cls === 'cart') {
        /* v31：器械 4 类（按 c.w 区分运输平台/东风快递/无人轰炸机/东风快递） */
        s += soldierCart(c.tone, c.w === 'cart' ? 'cart' : (c.w === 'siege_ram' ? 'siege_ram' : (c.w === 'ballista' ? 'ballista' : 'catapult')));
      } else {
        /* v31：步兵 4 种兵器（默认 foot 类） */
        s += soldierFoot(c.tone, c.w);
      }
      return s;
    };
  });

  /* ============================================================
   * 打造材料（6 系列 × 4 品阶 = 24）
   * 造型随系列变化：铁=锭 / 木=原木 / 革=兽皮 / 筋=筋束 / 玉=玉璧 / 丝=布卷
   * 品阶体现为：配色贵重度 + 光泽 + 右下角品阶珠（1~4 颗）
   * ============================================================ */
  var MAT_PAL = {
    iron: [
      ['#9098a2', '#6a727c', '#494f58'], ['#ccd5df', '#98a2ae', '#69727e'],
      ['#e2eaf4', '#a9b7c8', '#78869a'], ['#9c8fc4', '#645a8e', '#3b3560'],
    ],
    wood: [
      ['#c9a068', '#9e7845', '#755630'], ['#bb9160', '#8e6a40', '#684a2a'],
      ['#8e5c3e', '#673f28', '#462818'], ['#8fc06c', '#5f9440', '#3c6626'],
    ],
    leather: [
      ['#c2a27a', '#9a7a52', '#735a38'], ['#b98a5c', '#8e6238', '#68462a'],
      ['#90806e', '#6b5748', '#4a3c30'], ['#6f92a0', '#4a6a7c', '#32505e'],
    ],
    sinew: [
      ['#e2d2aa', '#b8a478', '#8e7c54'], ['#ecdcb4', '#c2aa7e', '#96805a'],
      ['#dbe4bc', '#a8b484', '#7a8a60'], ['#f4e4bc', '#ccb474', '#9a8048'],
    ],
    jade: [
      ['#bab5a6', '#8e8a7c', '#68645a'], ['#8fc2b2', '#5f9484', '#3e6a5c'],
      ['#f2eee2', '#d0c9ba', '#a89f90'], ['#e4cc90', '#b89c54', '#8a7030'],
    ],
    silk: [
      ['#d8cbaa', '#b0a080', '#877a5c'], ['#f2ead8', '#ccc0a8', '#9e9480'],
      ['#d06c5a', '#a4452f', '#782f20'], ['#8fd2e2', '#5aa0c0', '#3a7490'],
    ],
  };

  function matShape(series, c, tier) {
    var A = c[0], B2 = c[1], C = c[2];
    var k = 'mt' + series;
    var g = G(k + 'a', A, C) + G(k + 'b', A, B2, 'h');
    /* 品阶越高，金属环/光晕越多：tier=1 无；tier=2 一道；tier=3 两道；tier=4 三道 + 宝顶 */
    var rings = '', crown = '';
    for (var i = 0; i < tier - 1; i++) {
      var ro = 16 + i * 2.4;
      rings += '<circle cx="32" cy="22" r="' + ro + '" fill="none" stroke="' + P.goldHi + '" stroke-width=".7" opacity="' + (0.18 + i * 0.06) + '"/>';
    }
    if (tier >= 4) {
      crown = '<circle cx="32" cy="9" r="2.2" fill="' + P.goldMd + '"/>' +
              '<circle cx="32" cy="9" r="1" fill="' + P.goldHi + '"/>' +
              '<path d="M28 13 L32 6 L36 13 Z" fill="' + P.goldMd + '" opacity=".7"/>';
    }

    if (series === 'iron') {
      /* 铁系：叠层方锭 + 角棱反光 + 钢质花纹
         v31 重做：3 块递增尺寸叠起，每块左亮右暗，顶面有高光带 */
      return g + rings + crown +
        /* 底层大锭（暗） */
        '<path d="M10 50 L14 38 L50 38 L54 50 Z" fill="' + C + '"/>' +
        '<path d="M14 38 L18 32 L50 32 L50 38 Z" fill="' + B2 + '"/>' +
        '<path d="M14 38 L50 38" stroke="' + A + '" stroke-width=".8" opacity=".5"/>' +
        /* 中锭 */
        '<path d="M14 38 L18 32 L46 32 L50 38 L50 22 L46 16 L18 16 L14 22 Z" fill="' + B2 + '"/>' +
        '<path d="M18 16 L46 16 L50 22 L14 22 Z" fill="' + A + '"/>' +
        '<path d="M18 16 L46 16 L50 22" stroke="#ffffff" stroke-width="1" opacity=".4"/>' +
        /* 顶锭（亮，最小） */
        '<path d="M18 22 L22 16 L42 16 L46 22 L46 12 L42 6 L22 6 L18 12 Z" fill="' + A + '"/>' +
        '<path d="M22 6 L42 6 L46 12 L18 12 Z" fill="#ffffff" opacity=".35"/>' +
        '<path d="M22 6 L42 6 L46 12" stroke="#ffffff" stroke-width="1.2" opacity=".7"/>' +
        /* 钢质花纹：十字錾刻 */
        '<path d="M28 14 L36 14 M32 10 L32 18" stroke="' + C + '" stroke-width=".8" opacity=".6"/>' +
        /* 左侧高光 */
        '<path d="M18 22 L18 12 L22 6 L22 16 Z" fill="#ffffff" opacity=".25"/>';
    }
    if (series === 'wood') {
      /* 木系：圆木堆叠 + 树皮纹理 + 年轮断面
         v31 重做：3 段原木堆叠，每段端面有同心圆年轮 + 树皮竖纹 */
      return g + rings + crown +
        /* 底段 */
        '<rect x="8" y="42" width="48" height="10" rx="2" fill="url(#' + k + 'a)"/>' +
        /* 中段 */
        '<rect x="12" y="28" width="40" height="11" rx="2" fill="url(#' + k + 'b)"/>' +
        /* 顶段 */
        '<rect x="14" y="16" width="36" height="10" rx="2" fill="' + A + '"/>' +
        /* 顶段高光 */
        '<rect x="14" y="16" width="36" height="3" rx="1.6" fill="#ffffff" opacity=".3"/>' +
        /* 树皮竖纹（多道） */
        '<g stroke="' + C + '" stroke-width=".6" opacity=".5">' +
        '<line x1="20" y1="18" x2="20" y2="24"/><line x1="26" y1="18" x2="26" y2="24"/>' +
        '<line x1="34" y1="18" x2="34" y2="24"/><line x1="40" y1="18" x2="40" y2="24"/>' +
        '<line x1="46" y1="18" x2="46" y2="24"/>' +
        '<line x1="16" y1="30" x2="16" y2="38"/><line x1="22" y1="30" x2="22" y2="38"/>' +
        '<line x1="30" y1="30" x2="30" y2="38"/><line x1="38" y1="30" x2="38" y2="38"/>' +
        '<line x1="44" y1="30" x2="44" y2="38"/><line x1="50" y1="30" x2="50" y2="38"/>' +
        '<line x1="12" y1="44" x2="12" y2="52"/><line x1="18" y1="44" x2="18" y2="52"/>' +
        '<line x1="26" y1="44" x2="26" y2="52"/><line x1="34" y1="44" x2="34" y2="52"/>' +
        '<line x1="42" y1="44" x2="42" y2="52"/><line x1="50" y1="44" x2="50" y2="52"/>' +
        '</g>' +
        /* 右端断面（年轮同心圆） */
        '<ellipse cx="54" cy="21" rx="3" ry="4" fill="' + B2 + '"/>' +
        '<ellipse cx="54" cy="21" rx="2" ry="2.6" fill="none" stroke="' + C + '" stroke-width=".6"/>' +
        '<ellipse cx="54" cy="21" rx="1" ry="1.2" fill="' + C + '" opacity=".7"/>' +
        '<ellipse cx="50" cy="33" rx="2.6" ry="4.4" fill="' + B2 + '"/>' +
        '<ellipse cx="50" cy="33" rx="1.6" ry="2.8" fill="none" stroke="' + C + '" stroke-width=".6"/>' +
        '<ellipse cx="54" cy="47" rx="2.6" ry="4" fill="' + B2 + '"/>' +
        '<ellipse cx="54" cy="47" rx="1.6" ry="2.4" fill="none" stroke="' + C + '" stroke-width=".6"/>';
    }
    if (series === 'leather') {
      /* 革系：卷起的皮料 + 缝针线 + 铜扣
         v31 重做：上端折叠皮卷 + 缝针虚线 + 铜质圆扣 */
      return g + rings + crown +
        /* 卷起的上端（圆角矩形） */
        '<path d="M16 16 Q32 10 48 16 L48 26 Q32 22 16 26 Z" fill="url(#' + k + 'a)"/>' +
        '<path d="M16 16 Q32 10 48 16" stroke="#ffffff" stroke-width="1" opacity=".4" fill="none"/>' +
        /* 主皮面（矩形，有圆角） */
        '<path d="M14 26 Q12 28 14 30 L14 48 Q12 50 14 52 L50 52 Q52 50 50 48 L50 30 Q52 28 50 26 Z" fill="url(#' + k + 'a)"/>' +
        /* 右暗面 */
        '<path d="M32 26 L50 26 L50 52 L32 52 Z" fill="' + C + '" opacity=".25"/>' +
        /* 缝针虚线（横线多道） */
        '<g stroke="' + C + '" stroke-width=".8" stroke-dasharray="1.4 1.4" opacity=".55" fill="none">' +
        '<path d="M18 30 L46 30"/><path d="M18 36 L46 36"/><path d="M18 42 L46 42"/><path d="M18 48 L46 48"/>' +
        '</g>' +
        /* 中央铜扣（金色圆） */
        '<circle cx="32" cy="40" r="5.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="32" cy="40" r="3.6" fill="' + P.goldHi + '"/>' +
        '<circle cx="32" cy="40" r="1.6" fill="' + P.goldLo + '"/>' +
        '<circle cx="29.6" cy="37.6" r="1.6" fill="#ffffff" opacity=".5"/>' +
        /* 边角铜钉 */
        '<circle cx="18" cy="32" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="46" cy="32" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="18" cy="48" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="46" cy="48" r="1.4" fill="' + P.goldMd + '"/>' +
        /* 卷边褶皱 */
        '<path d="M16 26 Q14 28 14 30 Q12 30 12 32" stroke="' + C + '" stroke-width=".8" fill="none" opacity=".5"/>' +
        '<path d="M48 26 Q50 28 50 30 Q52 30 52 32" stroke="' + C + '" stroke-width=".8" fill="none" opacity=".5"/>';
    }
    if (series === 'sinew') {
      /* 筋系：盘绕绳束 + 金线缠绕 + 铜扣
         v31 重做：3 股绞绳 + 螺旋金线 + 顶端流苏 */
      return g + rings + crown +
        /* 底端流苏（散开的丝线） */
        '<g stroke="' + B2 + '" stroke-width=".8" stroke-linecap="round">' +
        '<line x1="22" y1="50" x2="20" y2="56"/><line x1="26" y1="50" x2="25" y2="57"/>' +
        '<line x1="30" y1="50" x2="30" y2="58"/><line x1="34" y1="50" x2="35" y2="57"/>' +
        '<line x1="38" y1="50" x2="40" y2="56"/><line x1="42" y1="50" x2="44" y2="55"/>' +
        '</g>' +
        /* 主体：3 股绞绳（v31 重新分布，让"绳"感更强） */
        '<path d="M10 14 Q22 22 10 30 Q-2 38 10 46" stroke="' + C + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M32 12 Q44 22 32 32 Q20 42 32 50" stroke="' + A + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<path d="M54 14 Q66 22 54 30 Q42 38 54 46" stroke="' + B2 + '" stroke-width="5" fill="none" stroke-linecap="round" transform="translate(-22 0)"/>' +
        /* 绞绳横纹（多道短横线模拟绳股交叠） */
        '<g stroke="' + C + '" stroke-width=".7" opacity=".55">' +
        '<line x1="16" y1="20" x2="20" y2="18"/><line x1="14" y1="26" x2="18" y2="24"/>' +
        '<line x1="14" y1="32" x2="18" y2="30"/><line x1="16" y1="38" x2="20" y2="36"/>' +
        '<line x1="20" y1="44" x2="24" y2="42"/>' +
        '</g>' +
        '<g stroke="' + C + '" stroke-width=".7" opacity=".55">' +
        '<line x1="38" y1="20" x2="42" y2="18"/><line x1="40" y1="26" x2="44" y2="24"/>' +
        '<line x1="40" y1="32" x2="44" y2="30"/><line x1="38" y1="38" x2="42" y2="36"/>' +
        '<line x1="34" y1="44" x2="38" y2="42"/>' +
        '</g>' +
        /* 顶端铜扣 */
        '<rect x="22" y="8" width="20" height="6" rx="2" fill="' + P.goldMd + '"/>' +
        '<rect x="22" y="8" width="20" height="2" rx="1" fill="' + P.goldHi + '"/>' +
        '<rect x="29" y="6" width="6" height="3" rx="1" fill="' + P.goldLo + '"/>' +
        /* 中段金线缠绕 */
        '<g stroke="' + P.goldHi + '" stroke-width=".7" fill="none" opacity=".75">' +
        '<path d="M14 26 Q22 30 30 26"/><path d="M18 30 Q26 34 34 30"/>' +
        '<path d="M30 36 Q38 40 46 36"/><path d="M28 40 Q36 44 44 40"/>' +
        '</g>';
    }
    if (series === 'jade') {
      /* 玉系：雕花玉璧 + 镂空 + 玲珑透雕
         v31 重做：双层环 + 4 兽首（夔龙纹）+ 内圈花纹 */
      return g + rings + crown +
        /* 阴影环 */
        '<circle cx="33" cy="34" r="22" fill="#000" opacity=".18"/>' +
        /* 外环（厚） */
        '<circle cx="32" cy="34" r="22" fill="url(#' + k + 'a)"/>' +
        '<circle cx="32" cy="34" r="22" fill="none" stroke="' + C + '" stroke-width="1.4"/>' +
        /* 右暗面 */
        '<path d="M32 12 A22 22 0 0 1 32 56 Z" fill="' + C + '" opacity=".22"/>' +
        /* 内圈花纹（齿轮状装饰） */
        '<g fill="' + C + '" opacity=".4">' +
        /* 8 个小齿 */
        (function () {
          var out = '';
          for (var i = 0; i < 8; i++) {
            var ang = i * Math.PI / 4;
            var x = 32 + Math.cos(ang) * 18;
            var y = 34 + Math.sin(ang) * 18;
            out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="1.6"/>';
          }
          return out;
        })() +
        '</g>' +
        /* 中孔 */
        '<circle cx="32" cy="34" r="8" fill="#1b1712"/>' +
        '<circle cx="32" cy="34" r="8" fill="none" stroke="' + C + '" stroke-width="1"/>' +
        /* 内孔边高光（让玉看起来晶莹） */
        '<circle cx="32" cy="34" r="7" fill="none" stroke="#ffffff" stroke-width=".5" opacity=".5"/>' +
        /* 左上大弧高光（v31 新增：单弧光 → 多弧光，更亮） */
        '<path d="M18 22 Q22 14 30 12" stroke="#ffffff" stroke-width="2.4" fill="none" opacity=".65" stroke-linecap="round"/>' +
        '<path d="M14 30 Q14 22 18 18" stroke="#ffffff" stroke-width="1.4" fill="none" opacity=".45" stroke-linecap="round"/>' +
        /* 右下暗纹 */
        '<path d="M40 46 Q48 42 50 36" stroke="' + C + '" stroke-width=".9" fill="none" opacity=".55"/>';
    }
    /* silk 布卷：v31 重做——折叠布匹堆 + 织纹 + 流苏穗 */
    return g + rings + crown +
      /* 底层布（折角更明显） */
      '<path d="M10 50 L10 38 L18 30 L46 30 L54 38 L54 50 Z" fill="url(#' + k + 'a)"/>' +
      /* 折角 */
      '<path d="M18 30 L22 34 L14 38 Z" fill="' + A + '" opacity=".5"/>' +
      /* 暗面 */
      '<path d="M32 30 L54 38 L54 50 L32 50 Z" fill="' + C + '" opacity=".22"/>' +
      /* 织纹横线 */
      '<g stroke="' + C + '" stroke-width=".6" opacity=".45">' +
      '<path d="M14 36 L50 36"/><path d="M12 40 L52 40"/><path d="M10 44 L54 44"/><path d="M10 48 L54 48"/>' +
      '</g>' +
      /* 上层布（折叠） */
      '<path d="M16 30 L32 18 L48 30 Z" fill="' + A + '"/>' +
      '<path d="M32 18 L48 30 L40 30 Z" fill="' + C + '" opacity=".35"/>' +
      '<path d="M16 30 L32 18" stroke="#ffffff" stroke-width="1" opacity=".5" fill="none"/>' +
      /* 上层布纹 */
      '<g stroke="' + C + '" stroke-width=".5" opacity=".5">' +
      '<path d="M20 28 L34 22"/><path d="M24 29 L36 22"/>' +
      '</g>' +
      /* 顶端绳结 */
      '<rect x="29" y="14" width="6" height="3" rx="1.2" fill="' + P.goldMd + '"/>' +
      '<rect x="29" y="14" width="6" height="1.2" rx=".6" fill="' + P.goldHi + '"/>' +
      /* 底端流苏穗 */
      '<g stroke="' + C + '" stroke-width=".7" stroke-linecap="round" opacity=".8">' +
      '<line x1="16" y1="50" x2="14" y2="56"/><line x1="22" y1="50" x2="20" y2="57"/>' +
      '<line x1="28" y1="50" x2="27" y2="58"/><line x1="34" y1="50" x2="33" y2="58"/>' +
      '<line x1="40" y1="50" x2="41" y2="57"/><line x1="46" y1="50" x2="48" y2="56"/>' +
      '</g>' +
      /* 卷边侧高光 */
      '<path d="M14 38 L18 34 L46 34 L50 38" stroke="#ffffff" stroke-width=".7" fill="none" opacity=".4"/>';
  }

  /* 品阶珠：右下角 1~4 颗，数量即品阶 */
  function tierPips(tier) {
    var s = '';
    for (var i = 0; i < tier; i++) {
      s += '<circle cx="' + (48 - i * 6) + '" cy="56" r="2.6" fill="' + P.goldMd + '" stroke="' + P.goldLo + '" stroke-width=".7"/>';
    }
    return s;
  }

  var MAT_CELLS = [
    ['fatie', 'iron', 1], ['jingtie', 'iron', 2], ['bintie', 'iron', 3], ['yuntie', 'iron', 4],
    ['songmu', 'wood', 1], ['nanmu', 'wood', 2], ['tanmu', 'wood', 3], ['jianmu', 'wood', 4],
    ['cuge', 'leather', 1], ['xiaoge', 'leather', 2], ['xige', 'leather', 3], ['jiaoge', 'leather', 4],
    ['shoujin', 'sinew', 1], ['niujin', 'sinew', 2], ['jiaojin', 'sinew', 3], ['longjin', 'sinew', 4],
    ['heshi', 'jade', 1], ['qingyu', 'jade', 2], ['yangzhi', 'jade', 3], ['kunshan', 'jade', 4],
    ['mabu', 'silk', 1], ['xijuan', 'silk', 2], ['shujin', 'silk', 3], ['yunjin', 'silk', 4],
  ];
  MAT_CELLS.forEach(function (m) {
    var id = m[0], series = m[1], tier = m[2];
    ICON['mat_' + id] = function (k) {
      var c = MAT_PAL[series][tier - 1];
      return matShape(series, c, tier) + tierPips(tier);
    };
  });

  /* ============================================================
   * 装备部位（12）— 背包格子用
   * ============================================================ */
  var SLOT_ART = {
    weapon:   '<path d="M18 48 L38 14 L43 17 L23 51 Z" fill="' + P.irHi + '"/>' +
              '<path d="M20 46 L38 16 L41 18 L23 48 Z" fill="' + P.irMd + '" opacity=".6"/>' +
              '<rect x="12" y="44" width="14" height="4.4" rx="2.2" transform="rotate(-58 19 46)" fill="' + P.goldMd + '"/>' +
              '<rect x="9" y="49" width="7" height="7" rx="2" fill="' + P.woodMd + '"/>',
    head:     '<path d="M16 40 Q16 20 32 20 Q48 20 48 40 Z" fill="' + P.irMd + '"/>' +
              '<path d="M32 20 Q48 20 48 40 L40 40 Q40 27 32 25 Z" fill="' + P.irLo + '" opacity=".55"/>' +
              '<rect x="14" y="39" width="36" height="6" rx="3" fill="' + P.irHi + '"/>' +
              '<path d="M32 20 L32 10" stroke="' + P.goldMd + '" stroke-width="2.4"/>' +
              '<circle cx="32" cy="9" r="3.2" fill="' + P.goldMd + '"/>' +
              '<rect x="26" y="30" width="12" height="9" rx="1.6" fill="' + P.ink + '" opacity=".45"/>',
    chest:    '<path d="M18 20 L26 17 L32 22 L38 17 L46 20 L46 44 Q32 50 18 44 Z" fill="' + P.irMd + '"/>' +
              '<path d="M32 22 L38 17 L46 20 L46 44 Q40 47 32 47 Z" fill="' + P.irLo + '" opacity=".5"/>' +
              '<path d="M32 22 L32 47" stroke="' + P.irHi + '" stroke-width="1.4" opacity=".7"/>' +
              '<circle cx="32" cy="30" r="3" fill="' + P.goldMd + '"/>' +
              '<circle cx="32" cy="38" r="3" fill="' + P.goldMd + '"/>',
    shoulder: '<path d="M14 42 Q14 22 34 20 L42 24 L42 34 L52 34 L52 44 L30 46 Z" fill="' + P.irMd + '"/>' +
              '<path d="M22 41 Q22 27 34 25 L38 27 Q28 30 28 42 Z" fill="' + P.irHi + '" opacity=".55"/>' +
              '<circle cx="34" cy="30" r="2.6" fill="' + P.goldMd + '"/>',
    arm:      '<path d="M24 16 L40 16 L44 30 L38 50 L26 50 L20 30 Z" fill="' + P.irMd + '"/>' +
              '<path d="M24 16 L32 16 L32 50 L26 50 L20 30 Z" fill="' + P.irHi + '" opacity=".4"/>' +
              '<path d="M22 28 L42 28 M22 38 L42 38" stroke="' + P.irLo + '" stroke-width="1.6"/>',
    waist:    '<rect x="12" y="28" width="40" height="10" rx="3" fill="' + P.leatherMd + '"/>' +
              '<rect x="12" y="28" width="40" height="3.4" rx="1.6" fill="' + P.leatherHi + '" opacity=".7"/>' +
              '<rect x="28" y="24" width="10" height="18" rx="2.6" fill="' + P.goldMd + '"/>' +
              '<rect x="30.6" y="27" width="4.8" height="12" rx="1.6" fill="' + P.goldLo + '"/>',
    feet:     '<path d="M18 16 L30 16 L30 36 L46 36 Q50 36 50 42 L50 48 L18 48 Z" fill="' + P.leatherMd + '"/>' +
              '<path d="M18 16 L24 16 L24 48 L18 48 Z" fill="' + P.leatherLo + '" opacity=".5"/>' +
              '<rect x="17" y="44" width="34" height="5" rx="2.4" fill="' + P.ink + '" opacity=".55"/>',
    back:     '<path d="M22 12 Q34 8 44 14 L50 46 Q36 54 16 46 Z" fill="' + P.rMd + '"/>' +
              '<path d="M22 12 Q34 8 44 14 L45 22 Q34 16 23 20 Z" fill="' + P.rHi + '" opacity=".5"/>' +
              '<path d="M32 10 L32 52" stroke="' + P.goldMd + '" stroke-width="1.4" opacity=".6"/>',
    neck:     '<path d="M20 14 Q20 30 32 34 Q44 30 44 14" fill="none" stroke="' + P.goldMd + '" stroke-width="2.2"/>' +
              '<path d="M32 34 L26 42 L32 52 L38 42 Z" fill="' + P.jadeHi + '"/>' +
              '<path d="M32 34 L38 42 L32 52 Z" fill="' + P.jadeLo + '" opacity=".55"/>',
    ring:     '<circle cx="32" cy="38" r="13" fill="none" stroke="' + P.goldMd + '" stroke-width="4"/>' +
              '<circle cx="32" cy="38" r="13" fill="none" stroke="' + P.goldHi + '" stroke-width="1.4" opacity=".7"/>' +
              '<path d="M32 14 L24 26 L40 26 Z" fill="' + P.jadeHi + '"/>' +
              '<path d="M32 14 L32 26 L40 26 Z" fill="' + P.jadeLo + '" opacity=".5"/>',
    pendant:  '<path d="M32 12 L42 26 L32 50 L22 26 Z" fill="' + P.jadeHi + '"/>' +
              '<path d="M32 12 L32 50 L22 26 Z" fill="' + P.jadeLo + '" opacity=".45"/>' +
              '<path d="M32 12 L32 6" stroke="' + P.goldMd + '" stroke-width="2"/>' +
              '<circle cx="32" cy="5" r="2.6" fill="' + P.goldMd + '"/>',
    /* v89.216 换皮视觉层：坐骑（马身）→ **座驾**（越野车剪影：车身 + 车顶 + 两轮 + 前灯） */
    mount:    '<path d="M8 44 L12 34 Q14 30 20 30 L44 30 Q50 32 50 38 L48 41 L49 47 Q49 50 46 50 L42 50 L42 53 L39 53 L39 50 L20 50 L20 53 L17 53 L17 50 L8 50 Z" fill="' + P.woodLo + '"/>' +
              '<path d="M8 44 L12 34 Q14 30 20 30 L20 44 Z" fill="' + P.woodMd + '" opacity=".6"/>' +
              '<path d="M22 30 L24 20 L40 20 L44 30 Z" fill="' + P.rMd + '" opacity=".9"/>' +
              '<path d="M25 22 L27 29 L39 29 L41.5 22 Z" fill="' + P.waHi + '" opacity=".55"/>' +
              '<circle cx="18" cy="50" r="5.4" fill="' + P.irLo + '"/><circle cx="18" cy="50" r="2.6" fill="' + P.stLo + '"/>' +
              '<circle cx="44" cy="50" r="5.4" fill="' + P.irLo + '"/><circle cx="44" cy="50" r="2.6" fill="' + P.stLo + '"/>' +
              '<circle cx="52" cy="34" r="2.6" fill="' + P.goldHi + '"/>' +
              '<rect x="8" y="44" width="8" height="3" rx="1.4" fill="' + P.irMd + '"/>',
  };
  var SLOT_ICON = {};
  Object.keys(SLOT_ART).forEach(function (id) {
    ICON['slot_' + id] = function () { return SLOT_ART[id]; };
  });

  /* ============================================================
   * 宝物类型（按 type，珠宝按 id 分色）
   * ============================================================ */
  /* v89.152：珠宝体系重设（18 种，配色按宝石本色）——
     唯一消费点 = 下方 ITEM_ART.jewel（`GEM_PAL[id] || 默认`），新增珠宝必须在此上色。 */
  var GEM_PAL = {
    bengzhu: ['#f2ece0', '#b8a888'],        /* 珍珠：乳白 */
    mila: ['#f0c268', '#a86c14'],           /* 琥珀：蜜黄 */
    meiyu: ['#5a5650', '#221f1c'],          /* 煤玉：漆黑 */
    puyu: ['#a8c8b0', '#5c8a68'],         /* 璞玉：原石青白 */
    zijin: ['#c8a0e8', '#7048a8'],          /* 紫晶：紫 */
    lvsongshi: ['#6fd0c0', '#1f8878'],      /* 绿松石：蓝绿 */
    hongshanhu: ['#f08a6a', '#b8452f'],     /* 红珊瑚：橘红 */
    yusui: ['#e8dcc0', '#b09c70'],          /* 玉髓：米黄 */
    yinchenmu: ['#8a6a48', '#463020'],      /* 阴沉木：深褐 */
    cuiyu: ['#5fd490', '#207a4c'],          /* 翠玉：翠绿 */
    danbaishi: ['#e8e0f4', '#a890c8'],      /* 蛋白石：幻彩白紫 */
    bixi: ['#f0a0c8', '#b83078'],           /* 碧玺：粉红 */
    jiaorenlei: ['#d8f0f8', '#78b8d0'],     /* 琉璃珠：珠光淡蓝 */
    tianzhu: ['#5a5048', '#181410'],        /* 天珠：黑褐 */
    longxianxiang: ['#d8d0b8', '#8a7c58'],  /* 龙涎香：灰白 */
    chenxiang: ['#6a4a38', '#2f1c12'],      /* 沉香：深棕 */
    yemingzhu: ['#fff4c0', '#d0a63f'],      /* 夜光珠：荧光黄 */
    dushanyu: ['#e4f0e8', '#a8c4b0'],       /* 独山玉：玉中君子 */
  };
  function gemArt(a, b) {
    return '<path d="M32 8 L50 26 L32 56 L14 26 Z" fill="' + a + '"/>' +
      '<path d="M32 8 L50 26 L32 56 Z" fill="' + b + '" opacity=".55"/>' +
      '<path d="M32 8 L14 26 L32 26 Z" fill="#ffffff" opacity=".28"/>' +
      '<path d="M14 26 L50 26" stroke="' + b + '" stroke-width="1" opacity=".6"/>';
  }
  /* v31 物品类型重画：每类有独立造型 + 材质感 */
  var ITEM_ART = {
    jewel: function (id) { var c = GEM_PAL[id] || ['#9fd6e0', '#4a90a8']; return gemArt(c[0], c[1]); },
    blueprint: function () {
      /* v31：卷轴图纸——羊皮卷 + 绑绳 + 蓝图纹 */
      var s = '<ellipse cx="32" cy="56" rx="24" ry="2.4" fill="#000" opacity=".25"/>';
      /* 卷轴底（米黄羊皮） */
      s += '<rect x="10" y="14" width="44" height="36" rx="2" fill="' + P.clMd + '"/>' +
        '<rect x="14" y="14" width="36" height="36" rx="1" fill="' + P.clHi + '"/>' +
        /* 蓝图纹（机械/武器线条图） */
        '<g stroke="' + P.woodLo + '" stroke-width=".7" opacity=".55" fill="none">' +
        '<rect x="18" y="20" width="28" height="20" rx="1"/>' +
        '<circle cx="32" cy="30" r="6"/>' +
        '<line x1="20" y1="36" x2="44" y2="36"/>' +
        '<line x1="22" y1="40" x2="42" y2="40"/>' +
        '</g>' +
        /* 卷轴两端（圆环木轴） */
        '<rect x="6" y="14" width="6" height="36" rx="3" fill="' + P.woodMd + '"/>' +
        '<rect x="6" y="14" width="6" height="36" rx="3" fill="none" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
        '<circle cx="9" cy="22" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="9" cy="42" r="1.4" fill="' + P.goldMd + '"/>' +
        '<rect x="52" y="14" width="6" height="36" rx="3" fill="' + P.woodMd + '"/>' +
        '<rect x="52" y="14" width="6" height="36" rx="3" fill="none" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
        '<circle cx="55" cy="22" r="1.4" fill="' + P.goldMd + '"/>' +
        '<circle cx="55" cy="42" r="1.4" fill="' + P.goldMd + '"/>' +
        /* 顶端红丝带 */
        '<path d="M28 8 Q32 14 36 8" stroke="' + P.rMd + '" stroke-width="2" fill="none"/>' +
        '<path d="M28 8 L24 6 M36 8 L40 6" stroke="' + P.rMd + '" stroke-width="1.6" fill="none"/>' +
        '<circle cx="32" cy="10" r="1.4" fill="' + P.goldMd + '"/>';
      return s;
    },
    prod_buff: function (id) {
      /* v31：工具箱造型——按 id 区分（锄/斧/锤/炉/鞭） */
      var s = '<ellipse cx="32" cy="54" rx="22" ry="2.6" fill="#000" opacity=".28"/>';
      var icon = '';
      if (id === 'shennongchu') {
        /* 集水塔：弯柄 + 锄头 */
        icon = '<line x1="44" y1="14" x2="20" y2="48" stroke="' + P.woodMd + '" stroke-width="3"/>' +
          '<path d="M14 46 L26 46 L30 54 L10 54 Z" fill="' + P.irMd + '"/>' +
          '<path d="M14 46 L20 46 L24 50 L18 50 Z" fill="' + P.irHi + '"/>';
      } else if (id === 'lubanfu') {
        /* 电锯组：长柄 + 斧头 */
        icon = '<line x1="20" y1="48" x2="44" y2="12" stroke="' + P.woodMd + '" stroke-width="2.4"/>' +
          '<path d="M40 8 Q52 4 56 14 Q50 16 46 22 Q42 18 40 8 Z" fill="' + P.irHi + '"/>' +
          '<path d="M40 8 Q52 4 56 14 L48 14 Z" fill="#fff" opacity=".4"/>';
      } else if (id === 'kaishanchui') {
        /* 破碎机：锤头 + 锤柄 */
        icon = '<rect x="18" y="12" width="22" height="14" rx="2" fill="' + P.irMd + '"/>' +
          '<rect x="18" y="12" width="22" height="4" rx="2" fill="' + P.irHi + '"/>' +
          '<line x1="29" y1="26" x2="20" y2="48" stroke="' + P.woodLo + '" stroke-width="3"/>' +
          '<rect x="14" y="46" width="14" height="6" rx="1.4" fill="' + P.woodMd + '"/>';
      } else if (id === 'xuantielu') {
        /* 冶炼炉：方形炉 + 火苗 + 钳 */
        icon = '<rect x="14" y="30" width="36" height="22" rx="2" fill="' + P.stLo + '"/>' +
          '<rect x="14" y="30" width="36" height="6" rx="2" fill="' + P.stMd + '"/>' +
          '<rect x="14" y="30" width="36" height="22" rx="2" fill="none" stroke="' + P.stEdge + '" stroke-width=".8"/>' +
          /* 炉口火 */
          '<path d="M22 30 Q24 22 28 30 Q26 24 30 30 Q28 22 32 30 Q30 24 34 30 Q32 22 36 30 Q34 24 38 30 Q36 22 42 30" stroke="' + P.fiHi + '" stroke-width="2" fill="none"/>' +
          '<circle cx="32" cy="38" r="3" fill="' + P.fiMd + '"/>';
      } else if (id === 'shuilibian') {
        /* 稽征令：长鞭 + 握柄 */
        icon = '<rect x="42" y="22" width="8" height="14" rx="2" fill="' + P.woodMd + '"/>' +
          '<rect x="42" y="22" width="8" height="3" rx="1" fill="' + P.goldMd + '"/>' +
          '<path d="M38 30 Q34 36 30 32 Q26 28 22 36 Q18 44 14 38 Q12 32 16 30" stroke="' + P.leatherLo + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<path d="M38 30 Q34 36 30 32 Q26 28 22 36" stroke="' + P.leatherMd + '" stroke-width="1" fill="none" stroke-linecap="round"/>';
      } else {
        /* 默认工具 */
        icon = '<line x1="32" y1="14" x2="32" y2="50" stroke="' + P.woodMd + '" stroke-width="3"/>' +
          '<rect x="24" y="8" width="16" height="10" rx="1" fill="' + P.irMd + '"/>';
      }
      s += icon + '<path d="M10 52 L54 52 L52 56 L12 56 Z" fill="' + P.goldLo + '" opacity=".55"/>';
      return s;
    },
    military_buff: function (id) {
      /* v31：军备造型——鼓/阵图/医书/旗 */
      var s = '<ellipse cx="32" cy="56" rx="22" ry="2.4" fill="#000" opacity=".28"/>';
      if (id === 'xianzhenzhangu') {
        /* 冲锋号：立鼓 + 鼓槌 */
        s += '<rect x="20" y="22" width="24" height="28" rx="2" fill="' + P.woodMd + '"/>' +
          '<ellipse cx="32" cy="22" rx="12" ry="3.4" fill="' + P.rMd + '"/>' +
          '<ellipse cx="32" cy="22" rx="10" ry="2.6" fill="' + P.rHi + '"/>' +
          '<ellipse cx="32" cy="22" rx="6" ry="1.6" fill="' + P.fiHi + '" opacity=".55"/>' +
          /* 鼓钉 */
          '<circle cx="22" cy="28" r="1.2" fill="' + P.goldMd + '"/>' +
          '<circle cx="42" cy="28" r="1.2" fill="' + P.goldMd + '"/>' +
          '<circle cx="22" cy="44" r="1.2" fill="' + P.goldMd + '"/>' +
          '<circle cx="42" cy="44" r="1.2" fill="' + P.goldMd + '"/>' +
          /* 鼓槌（斜立） */
          '<line x1="48" y1="14" x2="54" y2="48" stroke="' + P.woodLo + '" stroke-width="1.6"/>' +
          '<ellipse cx="49" cy="13" rx="2.4" ry="3" fill="' + P.woodMd + '"/>' +
          '<ellipse cx="49" cy="13" rx="1.4" ry="1.8" fill="' + P.woodHi + '"/>';
      } else if (id === 'baguazhentu') {
        /* 掩体图：圆盘 + 八卦纹 */
        s += '<circle cx="32" cy="34" r="22" fill="' + P.woodMd + '"/>' +
          '<circle cx="32" cy="34" r="20" fill="' + P.woodLo + '"/>' +
          '<circle cx="32" cy="34" r="14" fill="' + P.clMd + '"/>' +
          '<circle cx="32" cy="34" r="14" fill="none" stroke="' + P.woodEdge + '" stroke-width=".8"/>' +
          /* 阴阳鱼 */
          '<path d="M32 20 A14 14 0 0 1 32 48 A7 7 0 0 1 32 34 A7 7 0 0 0 32 20 Z" fill="' + P.fiMd + '"/>' +
          '<circle cx="32" cy="27" r="2" fill="' + P.fiHi + '"/>' +
          '<circle cx="32" cy="41" r="2" fill="' + P.ink + '"/>' +
          /* 8 卦短线 */
          '<g stroke="' + P.woodEdge + '" stroke-width="1" fill="none">' +
          (function () {
            var out = '';
            for (var i = 0; i < 8; i++) {
              var ang = i * Math.PI / 4 + Math.PI / 8;
              var x = 32 + Math.cos(ang) * 18;
              var y = 34 + Math.sin(ang) * 18;
              out += '<line x1="' + (x - 3) + '" y1="' + y + '" x2="' + (x + 3) + '" y2="' + y + '"/>';
            }
            return out;
          })() +
          '</g>';
      } else if (id === 'qingnangshu') {
        /* 救护手册：医书 */
        s += '<rect x="12" y="18" width="40" height="32" rx="2" fill="' + P.grLo + '"/>' +
          '<rect x="12" y="18" width="40" height="32" rx="2" fill="url(#ic_qnsh_g)" />';
        s = s.replace('url(#ic_qnsh_g)', 'url(#ic_qnsh)');
        s += '<rect x="12" y="18" width="40" height="32" rx="2" fill="none" stroke="' + P.grLo + '" stroke-width="1"/>' +
          /* 书脊 */
          '<line x1="32" y1="18" x2="32" y2="50" stroke="' + P.grLo + '" stroke-width="1.4"/>' +
          /* 左页药草 */
          '<path d="M16 22 Q22 26 22 30 Q22 26 16 30 Q20 32 22 30" fill="' + P.grMd + '"/>' +
          '<rect x="16" y="34" width="14" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="16" y="38" width="10" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="16" y="42" width="12" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          /* 右页文字行 */
          '<rect x="34" y="22" width="14" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="34" y="26" width="10" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="34" y="34" width="12" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="34" y="38" width="14" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          '<rect x="34" y="42" width="10" height="2" fill="' + P.woodMd + '" opacity=".6"/>' +
          /* 红丝带书签 */
          '<path d="M44 18 L48 14 L48 22 Z" fill="' + P.rMd + '"/>';
      } else if (id === 'junqi') {
        /* 军旗：旗杆 + 旗帜 + 流苏 */
        s += '<line x1="22" y1="6" x2="22" y2="56" stroke="' + P.woodMd + '" stroke-width="2.2"/>' +
          /* 旗顶铜矛 */
          '<path d="M22 6 L20 2 L24 2 Z" fill="' + P.goldMd + '"/>' +
          '<circle cx="22" cy="2" r="1" fill="' + P.goldHi + '"/>' +
          /* 旗布（带旗角） */
          '<path d="M22 10 L46 14 L42 22 L46 30 L22 26 Z" fill="' + P.rMd + '"/>' +
          '<path d="M22 10 L46 14 L42 22 L46 30 L22 26 Z" fill="none" stroke="' + P.rHi + '" stroke-width=".8"/>' +
          /* 旗上"军"字 */
          '<rect x="28" y="16" width="3" height="6" fill="' + P.goldHi + '"/>' +
          '<rect x="26" y="18" width="8" height="2" fill="' + P.goldHi + '"/>' +
          '<rect x="28" y="22" width="3" height="2" fill="' + P.goldHi + '"/>' +
          /* 流苏 */
          '<g stroke="' + P.rHi + '" stroke-width=".7" stroke-linecap="round">' +
          '<line x1="22" y1="26" x2="22" y2="36"/>' +
          '<line x1="20" y1="26" x2="18" y2="36"/>' +
          '<line x1="24" y1="26" x2="26" y2="36"/>' +
          '</g>';
      } else {
        /* 默认军备（旗） */
        s += '<line x1="22" y1="6" x2="22" y2="56" stroke="' + P.woodMd + '" stroke-width="2"/>' +
          '<path d="M22 10 L46 14 L22 22 Z" fill="' + P.rMd + '"/>';
      }
      return s;
    },
    boost: function () {
      /* v31：加速卷轴——沙漏造型 */
      return '<ellipse cx="32" cy="56" rx="20" ry="2.4" fill="#000" opacity=".25"/>' +
        /* 沙漏外框 */
        '<rect x="14" y="8" width="36" height="6" rx="1" fill="' + P.goldMd + '"/>' +
        '<rect x="14" y="48" width="36" height="6" rx="1" fill="' + P.goldMd + '"/>' +
        '<rect x="14" y="8" width="36" height="2" rx="1" fill="' + P.goldHi + '"/>' +
        '<rect x="14" y="52" width="36" height="2" rx="1" fill="' + P.goldHi + '"/>' +
        /* 沙漏玻璃 */
        '<path d="M16 14 L48 14 L34 32 L48 50 L16 50 L30 32 Z" fill="' + P.waHi + '" opacity=".5"/>' +
        '<path d="M16 14 L48 14 L34 32 L48 50 L16 50 L30 32 Z" fill="none" stroke="' + P.goldMd + '" stroke-width="1.6"/>' +
        /* 沙子（上半） */
        '<path d="M18 16 L46 16 L34 32 L18 16 Z" fill="' + P.goldHi + '" opacity=".75"/>' +
        '<path d="M20 16 L34 16 L30 28 L20 16 Z" fill="' + P.goldLo + '" opacity=".7"/>' +
        /* 沙柱（漏下） */
        '<line x1="32" y1="32" x2="32" y2="44" stroke="' + P.goldMd + '" stroke-width="2"/>' +
        /* 沙子（下半堆） */
        '<path d="M22 50 L42 50 L36 42 L28 42 Z" fill="' + P.goldMd + '"/>' +
        '<path d="M24 50 L40 50 L34 44 L30 44 Z" fill="' + P.goldHi + '"/>' +
        /* 玻璃高光 */
        '<path d="M18 16 L20 16 L34 32 L30 32 Z" fill="#fff" opacity=".5"/>';
    },
    exp: function () {
      /* v31：经验卷轴——卷起的圣旨 + 升字 */
      var s = '<ellipse cx="32" cy="56" rx="24" ry="2.4" fill="#000" opacity=".25"/>';
      s += '<rect x="10" y="22" width="44" height="24" rx="2" fill="' + P.clMd + '"/>' +
        '<rect x="14" y="22" width="36" height="24" rx="1" fill="' + P.clHi + '"/>' +
        '<rect x="14" y="22" width="36" height="6" fill="' + P.clMd + '" opacity=".5"/>' +
        '<rect x="14" y="40" width="36" height="6" fill="' + P.clMd + '" opacity=".5"/>' +
        /* 卷轴两端的卷边 */
        '<ellipse cx="10" cy="34" rx="2.4" ry="12" fill="' + P.clMd + '"/>' +
        '<ellipse cx="54" cy="34" rx="2.4" ry="12" fill="' + P.clMd + '"/>' +
        '<ellipse cx="10" cy="34" rx="1.4" ry="10" fill="' + P.clLo + '"/>' +
        '<ellipse cx="54" cy="34" rx="1.4" ry="10" fill="' + P.clLo + '"/>' +
        /* 中心"经验"二字（金色篆体简化） */
        '<path d="M22 28 L28 28 L28 36 L26 36 L26 32 L24 32 L24 36 L22 36 Z" fill="' + P.goldHi + '"/>' +
        '<path d="M22 38 L28 38 M22 41 L28 41 M22 44 L26 44" stroke="' + P.goldMd + '" stroke-width=".7"/>' +
        '<path d="M36 28 L42 28 L42 30 L40 30 L40 38 L38 38 L38 30 L36 30 Z" fill="' + P.goldHi + '"/>' +
        '<path d="M36 40 L42 40 M36 43 L42 43" stroke="' + P.goldMd + '" stroke-width=".7"/>' +
        /* 顶绳 */
        '<rect x="29" y="10" width="6" height="6" rx="1" fill="' + P.rMd + '"/>' +
        '<rect x="29" y="10" width="6" height="2" rx="1" fill="' + P.rHi + '"/>' +
        '<line x1="32" y1="6" x2="32" y2="10" stroke="' + P.woodMd + '" stroke-width="1.2"/>' +
        /* 金光 */
        '<g stroke="' + P.goldHi + '" stroke-width=".7" stroke-linecap="round" opacity=".7">' +
        '<line x1="14" y1="14" x2="18" y2="18"/><line x1="50" y1="14" x2="46" y2="18"/>' +
        '<line x1="12" y1="22" x2="18" y2="22"/><line x1="52" y1="22" x2="46" y2="22"/>' +
        '</g>';
      return s;
    },
    stamina: function () {
      /* v31：体力药水——药水瓶 + 心形 */
      var s = '<ellipse cx="32" cy="56" rx="20" ry="2.4" fill="#000" opacity=".25"/>';
      /* 瓶盖（金） */
      s += '<rect x="28" y="4" width="8" height="6" rx="1.4" fill="' + P.goldMd + '"/>' +
        '<rect x="28" y="4" width="8" height="2" rx="1" fill="' + P.goldHi + '"/>' +
        '<rect x="26" y="9" width="12" height="3" rx="1" fill="' + P.woodMd + '"/>' +
        /* 瓶颈 */
        '<path d="M26 12 L38 12 L38 18 L42 22 L42 50 Q42 56 32 56 Q22 56 22 50 L22 22 L26 18 Z" fill="' + P.waHi + '" opacity=".6"/>' +
        '<path d="M26 12 L38 12 L38 18 L42 22 L42 50 Q42 56 32 56 Q22 56 22 50 L22 22 L26 18 Z" fill="none" stroke="' + P.waLo + '" stroke-width="1"/>' +
        /* 药水（绿） */
        '<path d="M24 30 L40 30 L40 50 Q40 54 32 54 Q24 54 24 50 Z" fill="' + P.waMd + '" opacity=".85"/>' +
        '<path d="M24 30 L40 30" stroke="' + P.waLo + '" stroke-width="1" opacity=".5"/>' +
        /* 心形 */
        '<path d="M32 38 Q28 34 28 38 Q28 42 32 46 Q36 42 36 38 Q36 34 32 38 Z" fill="' + P.rMd + '"/>' +
        '<path d="M32 38 Q28 34 28 38 Q28 42 32 46" fill="' + P.rHi + '" opacity=".5"/>' +
        /* 玻璃高光 */
        '<path d="M24 22 Q22 32 24 42" stroke="#fff" stroke-width="1.4" fill="none" opacity=".7"/>' +
        '<circle cx="26" cy="26" r="1.4" fill="#fff" opacity=".55"/>';
      return s;
    },
    perm: function () {
      /* v31：永久令牌——铜牌 + 文字 */
      var s = '<ellipse cx="32" cy="56" rx="22" ry="2.4" fill="#000" opacity=".25"/>';
      /* 玉牌（绿色翡翠） */
      s += '<path d="M18 14 L46 14 L52 22 L52 38 L46 46 L18 46 L12 38 L12 22 Z" fill="' + P.jadeHi + '"/>' +
        '<path d="M18 14 L46 14 L52 22 L52 38 L46 46 L18 46 L12 38 L12 22 Z" fill="none" stroke="' + P.jadeLo + '" stroke-width="1.4"/>' +
        /* 右下暗面 */
        '<path d="M32 14 L46 14 L52 22 L52 38 L46 46 L32 46 Z" fill="' + P.jadeLo + '" opacity=".3"/>' +
        /* 高光（左上） */
        '<path d="M14 22 L18 16 L32 16 L28 22 Z" fill="#fff" opacity=".45"/>' +
        '<path d="M12 26 Q12 22 14 22" stroke="#fff" stroke-width="1" fill="none" opacity=".5"/>' +
        /* 中心字（"永"字简化） */
        '<rect x="28" y="22" width="3" height="14" fill="' + P.goldHi + '"/>' +
        '<rect x="34" y="22" width="3" height="14" fill="' + P.goldHi + '"/>' +
        '<rect x="26" y="25" width="14" height="2" fill="' + P.goldHi + '"/>' +
        '<rect x="26" y="31" width="14" height="2" fill="' + P.goldHi + '"/>' +
        /* 顶端挂绳 */
        '<path d="M28 14 Q32 8 36 14" stroke="' + P.goldMd + '" stroke-width="2" fill="none"/>' +
        '<circle cx="32" cy="6" r="1.6" fill="' + P.goldMd + '"/>' +
        '<circle cx="32" cy="6" r=".8" fill="' + P.goldHi + '"/>' +
        /* 边角装饰 */
        '<circle cx="16" cy="22" r="1" fill="' + P.goldMd + '"/>' +
        '<circle cx="48" cy="38" r="1" fill="' + P.goldMd + '"/>';
      return s;
    },
    mount_buff: function () {
      /* v31：马匹强化——马鞍 + 金光 */
      var s = '<ellipse cx="32" cy="56" rx="22" ry="2.6" fill="#000" opacity=".28"/>';
      /* 马身（剪影） */
      s += '<path d="M8 48 L12 36 Q16 30 22 30 L42 30 Q50 32 50 38 L48 40 L49 46 Q49 50 46 50 L42 50 L42 53 L39 53 L39 50 L20 50 L20 53 L17 53 L17 50 Z" fill="' + P.woodLo + '"/>' +
        '<path d="M8 48 L12 36 Q16 30 22 30 L20 36 L17 48 Z" fill="' + P.woodMd + '" opacity=".5"/>' +
        '<path d="M46 30 Q48 24 54 25 L56 27 L52 31 Z" fill="' + P.woodMd + '"/>' +
        '<path d="M14 32 Q20 28 22 30 L24 30 L20 34 Z" fill="' + P.woodHi + '"/>' +
        /* 马鞍（皮制高桥） */
        '<path d="M22 30 L20 36 L42 36 L40 30 Z" fill="' + P.rMd + '"/>' +
        '<path d="M22 30 L20 36 L26 36 L28 30 Z" fill="' + P.rHi + '" opacity=".5"/>' +
        '<path d="M40 30 L42 36 L36 36 L34 30 Z" fill="' + P.rLo + '" opacity=".4"/>' +
        /* 鞍垫 */
        '<ellipse cx="31" cy="34" rx="9" ry="2.4" fill="' + P.leatherMd + '"/>' +
        '<ellipse cx="31" cy="33.4" rx="7" ry="1.4" fill="' + P.leatherHi + '"/>' +
        /* 金色马镫 */
        '<line x1="24" y1="38" x2="24" y2="46" stroke="' + P.goldMd + '" stroke-width="1.4"/>' +
        '<ellipse cx="24" cy="47" rx="3" ry="1.6" fill="' + P.goldMd + '"/>' +
        '<line x1="38" y1="38" x2="38" y2="46" stroke="' + P.goldMd + '" stroke-width="1.4"/>' +
        '<ellipse cx="38" cy="47" rx="3" ry="1.6" fill="' + P.goldMd + '"/>' +
        /* 金光 */
        '<g stroke="' + P.goldHi + '" stroke-width=".8" stroke-linecap="round" opacity=".8">' +
        '<line x1="32" y1="6" x2="32" y2="14"/><line x1="20" y1="10" x2="24" y2="16"/>' +
        '<line x1="44" y1="10" x2="40" y2="16"/><line x1="14" y1="16" x2="20" y2="20"/>' +
        '<line x1="50" y1="16" x2="44" y2="20"/>' +
        '</g>' +
        '<circle cx="32" cy="20" r="1.4" fill="' + P.goldHi + '"/>';
      return s;
    },
    attr_buff: function () {
      /* v31：符咒（v31 重画：符纸 + 朱砂字 + 流苏） */
      var s = '<ellipse cx="32" cy="56" rx="20" ry="2.4" fill="#000" opacity=".28"/>';
      s += '<rect x="18" y="10" width="28" height="40" rx="2" fill="' + P.clHi + '"/>' +
        '<rect x="18" y="10" width="28" height="40" rx="2" fill="none" stroke="' + P.clLo + '" stroke-width="1"/>' +
        /* 边框纹 */
        '<rect x="20" y="12" width="24" height="36" rx="1" fill="none" stroke="' + P.rMd + '" stroke-width=".8"/>' +
        /* 中心朱砂"令"字（楷书简化） */
        '<path d="M32 16 L30 22 L28 24 L32 24 L34 24 L36 24 L34 22 Z" fill="' + P.rMd + '"/>' +
        '<rect x="28" y="26" width="8" height="2" fill="' + P.rMd + '"/>' +
        '<rect x="29" y="30" width="6" height="2" fill="' + P.rMd + '"/>' +
        '<rect x="30" y="34" width="4" height="2" fill="' + P.rMd + '"/>' +
        '<rect x="31" y="38" width="2" height="6" fill="' + P.rMd + '"/>' +
        /* 顶端封条 */
        '<rect x="20" y="8" width="24" height="4" rx=".8" fill="' + P.rMd + '"/>' +
        '<rect x="20" y="8" width="24" height="1.5" rx=".8" fill="' + P.rHi + '"/>' +
        /* 底端流苏（多道红丝） */
        '<g stroke="' + P.rMd + '" stroke-width=".8" stroke-linecap="round">' +
        '<line x1="22" y1="50" x2="20" y2="58"/><line x1="26" y1="50" x2="25" y2="59"/>' +
        '<line x1="30" y1="50" x2="30" y2="60"/><line x1="34" y1="50" x2="35" y2="59"/>' +
        '<line x1="38" y1="50" x2="40" y2="58"/><line x1="42" y1="50" x2="44" y2="57"/>' +
        '</g>' +
        /* 朱砂印（右下角方印） */
        '<rect x="38" y="38" width="6" height="6" rx=".8" fill="' + P.rMd + '"/>' +
        '<rect x="39" y="39" width="4" height="4" rx=".4" fill="' + P.rHi + '"/>';
      return s;
    },
    build_cost: function () {
      /* v31：施工手册——古籍书 */
      var s = '<ellipse cx="32" cy="56" rx="24" ry="2.4" fill="#000" opacity=".25"/>';
      /* 书页底 */
      s += '<rect x="10" y="14" width="44" height="36" rx="2" fill="' + P.woodMd + '"/>' +
        '<rect x="12" y="14" width="40" height="36" rx="1.4" fill="' + P.clMd + '"/>' +
        '<rect x="14" y="16" width="36" height="32" rx="1" fill="' + P.clHi + '"/>' +
        /* 书脊（中线） */
        '<line x1="32" y1="14" x2="32" y2="50" stroke="' + P.woodLo + '" stroke-width="1.4"/>' +
        /* 左页：城市图 */
        '<path d="M16 22 L26 22 L26 30 L20 30 L20 36 L26 36 L26 44 L16 44 Z" fill="none" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
        '<path d="M22 22 L22 30 M16 30 L26 30 M20 30 L20 36" stroke="' + P.woodLo + '" stroke-width=".8"/>' +
        /* 右页：木榫卯图 */
        '<path d="M36 24 L48 24 M36 30 L48 30 M36 36 L48 36 M36 42 L48 42" stroke="' + P.woodLo + '" stroke-width=".8" opacity=".7"/>' +
        '<rect x="40" y="26" width="4" height="2" fill="' + P.woodMd + '"/>' +
        '<rect x="40" y="32" width="4" height="2" fill="' + P.woodMd + '"/>' +
        /* 封面边角金饰 */
        '<path d="M10 14 L14 14 L14 18 L10 18 Z" fill="' + P.goldMd + '"/>' +
        '<path d="M50 46 L54 46 L54 50 L50 50 Z" fill="' + P.goldMd + '"/>' +
        '<rect x="11" y="15" width="2" height="2" fill="' + P.goldHi + '"/>' +
        '<rect x="51" y="47" width="2" height="2" fill="' + P.goldHi + '"/>';
      return s;
    },
    /* ---- v89.51：五类「有价却无画」的补图 ----
       宝箱 / 残卷 / 政令 / 封存匣 / 辐能核心此前**全部落 attr_buff 兜底**：
       游商与背包里一排橙色符卡，玩家分不出哪个是宝箱哪个是残卷。
       这里按各自物件补专属造型（沿用 64×64 视框与 P 调色板）。 */
    chest: function () {
      /* 宝箱：木箱 + 铜箍 + 锁扣 */
      var s = '<ellipse cx="32" cy="57" rx="24" ry="2.4" fill="#000" opacity=".25"/>';
      s += '<rect x="12" y="28" width="40" height="24" rx="2" fill="' + P.woodMd + '"/>' +
        '<rect x="14" y="33" width="36" height="17" rx="1" fill="' + P.woodHi + '" opacity=".35"/>';
      s += '<path d="M12 28 Q12 13 32 13 Q52 13 52 28 Z" fill="' + P.woodHi + '"/>' +
        '<path d="M12 28 Q12 13 32 13 L32 28 Z" fill="' + P.woodMd + '" opacity=".55"/>';
      s += '<rect x="20" y="13" width="4" height="39" fill="' + P.goldMd + '"/>' +
        '<rect x="40" y="13" width="4" height="39" fill="' + P.goldMd + '"/>' +
        '<rect x="20" y="13" width="4" height="2" fill="' + P.goldHi + '"/>' +
        '<rect x="40" y="13" width="4" height="2" fill="' + P.goldHi + '"/>';
      s += '<rect x="29" y="25" width="6" height="9" rx="1" fill="' + P.goldHi + '"/>' +
        '<rect x="31" y="28" width="2" height="3" fill="' + P.goldLo + '"/>';
      return s;
    },
    neigong: function () {
      /* 战技残卷：线装书 + 周天灵涡 */
      var s = '<ellipse cx="32" cy="57" rx="22" ry="2.2" fill="#000" opacity=".25"/>';
      s += '<rect x="14" y="10" width="36" height="44" rx="2" fill="' + P.waLo + '"/>' +
        '<rect x="17" y="12" width="30" height="40" rx="1.4" fill="' + P.waMd + '"/>';
      s += '<g fill="' + P.clHi + '">' +
        '<circle cx="22" cy="18" r="1.1"/><circle cx="22" cy="28" r="1.1"/>' +
        '<circle cx="22" cy="38" r="1.1"/><circle cx="22" cy="48" r="1.1"/></g>';
      s += '<g stroke="' + P.waHi + '" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9">' +
        '<path d="M40 22 Q30 20 29 28"/>' +
        '<path d="M40 30 Q28 28 27 38"/>' +
        '<path d="M40 38 Q30 36 30 44"/></g>';
      s += '<rect x="34" y="14" width="9" height="5" rx="1" fill="' + P.rMd + '"/>';
      return s;
    },
    corvee: function () {
      /* 政令（征调令）：令牌 + 红绳 + 牌面刻痕 + 朱印 */
      var s = '<ellipse cx="32" cy="57" rx="18" ry="2.2" fill="#000" opacity=".25"/>';
      s += '<rect x="19" y="12" width="26" height="40" rx="3" fill="' + P.woodMd + '"/>' +
        '<rect x="21" y="14" width="22" height="36" rx="2" fill="' + P.woodHi + '" opacity=".5"/>';
      s += '<path d="M27 12 Q32 5 37 12" stroke="' + P.rMd + '" stroke-width="1.6" fill="none"/>';
      s += '<g stroke="' + P.woodEdge + '" stroke-width="1.4" stroke-linecap="round" opacity=".85">' +
        '<line x1="25" y1="22" x2="39" y2="22"/>' +
        '<line x1="25" y1="30" x2="39" y2="30"/>' +
        '<line x1="25" y1="38" x2="39" y2="38"/></g>';
      s += '<rect x="28" y="43" width="8" height="6" rx="1" fill="' + P.rMd + '"/>' +
        '<rect x="29.5" y="44.5" width="5" height="3" rx=".4" fill="' + P.rHi + '"/>';
      return s;
    },
    talis: function () {
      /* 封存匣：束口囊袋 + 系带 + 金线织纹 */
      var s = '<ellipse cx="32" cy="57" rx="18" ry="2.2" fill="#000" opacity=".25"/>';
      s += '<path d="M22 26 Q14 34 16 44 Q18 55 32 55 Q46 55 48 44 Q50 34 42 26 Z" fill="' + P.rHi + '"/>' +
        '<path d="M32 26 Q14 34 16 44 Q18 55 32 55 L32 26 Z" fill="' + P.rMd + '" opacity=".45"/>';
      s += '<rect x="22" y="21" width="20" height="6" rx="2.4" fill="' + P.rLo + '"/>' +
        '<rect x="22" y="21" width="20" height="2" rx="1" fill="' + P.rHi + '" opacity=".7"/>';
      s += '<path d="M22 24 Q14 22 12 16 M42 24 Q50 22 52 16" stroke="' + P.goldMd +
        '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
      s += '<g stroke="' + P.goldHi + '" stroke-width=".9" opacity=".8" fill="none">' +
        '<path d="M24 36 L32 42 L40 36"/><path d="M26 45 L32 49 L38 45"/></g>';
      return s;
    },
    essence: function () {
      /* 辐能核心：灵珠 + 四向灵光 */
      var s = '<ellipse cx="32" cy="56" rx="16" ry="2.2" fill="#000" opacity=".25"/>';
      s += '<circle cx="32" cy="34" r="15" fill="' + P.waLo + '"/>' +
        '<circle cx="32" cy="34" r="12" fill="' + P.waMd + '"/>' +
        '<circle cx="32" cy="34" r="8" fill="' + P.waHi + '"/>' +
        '<circle cx="28" cy="30" r="3" fill="' + P.clHi + '" opacity=".85"/>';
      s += '<g fill="' + P.waHi + '" opacity=".9">' +
        '<path d="M32 8 L34 14 L40 16 L34 18 L32 24 L30 18 L24 16 L30 14 Z"/>' +
        '<path d="M49 22 L50 26 L54 27 L50 28 L49 32 L48 28 L44 27 L48 26 Z"/>' +
        '<path d="M15 22 L16 26 L20 27 L16 28 L15 32 L14 28 L10 27 L14 26 Z"/></g>';
      return s;
    },
  };
  var TYPE_KEY = {
    jewel: 'jewel', blueprint: 'blueprint', prod_buff: 'prod_buff', military_buff: 'military_buff',
    boost: 'boost', exp: 'exp', stamina: 'stamina', perm: 'perm', mount_buff: 'mount_buff',
    attr_buff: 'attr_buff', build_cost: 'build_cost',
    /* v89.51：宝箱/残卷/政令/封存匣/辐能核心 —— 补专属造型（此前全落 attr_buff 兜底） */
    chest: 'chest', neigong: 'neigong', corvee: 'corvee', talis: 'talis', essence: 'essence',
  };
  Object.keys(TYPE_KEY).forEach(function (t) {
    ICON['item_' + t] = function (k, id) { return ITEM_ART[TYPE_KEY[t]](id); };
  });

  /* ============================================================
   * 对外接口
   * ============================================================ */
  var ALL = {};
  Object.keys(B).forEach(function (id) { ALL['b_' + id] = B[id]; });
  Object.keys(E).forEach(function (id) { ALL['e_' + id] = E[id]; });
  Object.keys(T).forEach(function (id) { ALL['t_' + id] = T[id]; });
  Object.keys(R).forEach(function (id) { ALL['r_' + id] = R[id]; });
  Object.keys(TR).forEach(function (id) { ALL['troop_' + id] = ICON['troop_' + id]; });
  MAT_CELLS.forEach(function (m) { ALL['mat_' + m[0]] = ICON['mat_' + m[0]]; });
  Object.keys(SLOT_ART).forEach(function (id) { ALL['slot_' + id] = ICON['slot_' + id]; });
  Object.keys(TYPE_KEY).forEach(function (t) { ALL['item_' + t] = ICON['item_' + t]; });

  /* ============================================================
   * v32：game-icons 开源素材接入（需求原文：「建议采用网图」）
   * ------------------------------------------------------------
   * 手绘 SVG 造型上限太低（连改三代仍被判「难看」），改用专门为游戏绘制的
   * game-icons 图标库（4134 个，CC BY 3.0）。素材与映射表在 js/gicons.js。
   *
   * 为什么用"延迟绑定"包装而不是直接替换手绘实现：
   *   gicons.js 在本文件之后加载 → 此刻 GICONS 尚未定义。
   *   而取图发生在页面就绪之后（那时已就绪），所以外面套一层包装函数，
   *   运行时才查表；查不到就静默回退原手绘实现，零风险。
   * ============================================================ */
  var GI_PREFIX = [
    ['troop_', 'troop'], ['mat_', 'mat'], ['slot_', 'slot'], ['item_', 'item'],
    ['b_', 'building'], ['e_', 'ext'], ['t_', 'terrain'], ['r_', 'res'],
  ];
  var MAT_SERIES = {}, MAT_TIER = {};
  MAT_CELLS.forEach(function (m) { MAT_SERIES[m[0]] = m[1]; MAT_TIER[m[0]] = m[2]; });

  function giDraw(group, id) {
    if (typeof GICONS === 'undefined' || !GICONS) return '';
    if (group === 'mat') return GICONS.matDraw(MAT_SERIES[id], MAT_TIER[id] || 1);
    return GICONS.draw(group, id);
  }

  Object.keys(ALL).forEach(function (key) {
    var group = null, id = null, i;
    for (i = 0; i < GI_PREFIX.length; i++) {
      if (key.indexOf(GI_PREFIX[i][0]) === 0) {
        group = GI_PREFIX[i][1];
        id = key.slice(GI_PREFIX[i][0].length);
        break;
      }
    }
    if (!group) return;
    var hand = ALL[key];
    ALL[key] = function (k, arg2) {
      var art = giDraw(group, id);
      if (!art) return hand(k, arg2);                      /* 未命中 → 回退手绘 */
      if (group === 'mat') art += tierPips(MAT_TIER[id] || 1);
      return art;
    };
  });

  /* 建筑 id → 图标 key */
  var BUILDING_KEY = {
    guanfu: 'b_guanfu', minfang: 'b_minfang', shuyuan: 'b_shuyuan', junying: 'b_junying',
    xiaochang: 'b_xiaochang', shichang: 'b_shichang', cangku: 'b_cangku', chengqiang: 'b_chengqiang',
    yizhan: 'b_yizhan', fenghuotai: 'b_fenghuotai', majiu: 'b_majiu', kezhan: 'b_kezhan',
    zhaoxianguan: 'b_zhaoxianguan', honglusi: 'b_honglusi', tiejiangpu: 'b_tiejiangpu',
    gongjiangzuofang: 'b_gongjiangzuofang',
  };
  var EXT_KEY = { farm: 'e_farm', forest: 'e_forest', quarry: 'e_quarry', mine: 'e_mine' };
  var TERRAIN_KEY = {
    plain: 't_plain', caoyuan: 't_caoyuan', zhaoze: 't_zhaoze', lake: 't_lake',
    forest: 't_forest', desert: 't_desert', hill: 't_hill', city: 't_city',
  };
  var RES_KEY = { grain: 'r_grain', wood: 'r_wood', stone: 'r_stone', iron: 'r_iron', gold: 'r_gold', pop: 'r_pop' };

  /* 取图标 SVG 字符串。type: 'building'|'ext'|'terrain'|'res'|'troop' */
  /* ============================================================
   * 顶栏菜单图标（v25 · 需求 10）
   * ------------------------------------------------------------
   * 用手绘**线描**而不是平涂：20px 尺寸下线描的辨识度远高于平涂小块，
   * 而且 `stroke: currentColor` 能跟着文字一起变色（默认暗、悬停金）。
   * 禁止 emoji —— 与地块图标同一条约定。
   * ============================================================ */
  ICON.navSet = {
    city: '<path d="M4 20.5V10l8-5.5 8 5.5v10.5"/><path d="M3 20.5h18"/><path d="M9.6 20.5v-5.2h4.8v5.2"/>'
      + '<path d="M7.6 8.6V6.2h1.8v1.2M14.6 8.6V6.2h1.8v1.2"/>',
    ext: '<path d="M3.2 20.4h17.6"/><path d="M5.4 20.4V10.2l3.4-2.2 3.4 2.2v10.2"/>'
      + '<path d="M14.6 20.4V12l2.9-1.9 2.9 1.9v8.4"/>'
      + '<path d="M7.1 13.2v2.6M8.9 13.2v2.6"/><path d="M17.5 13.8v2.4"/>',
    map: '<path d="M3 6.6 9.2 4l5.6 2.6L21 4v13.4L14.8 20l-5.6-2.6L3 20z"/>'
      + '<path d="M9.2 4v13.4M14.8 6.6V20"/>',
    general: '<path d="M12 3.2c3.5 0 6 2.2 6 5.1v2.6c0 4.5-2.7 8.1-6 8.1s-6-3.6-6-8.1V8.3c0-2.9 2.5-5.1 6-5.1z"/>'
      + '<path d="M9.6 3.6h4.8"/><path d="M12 3.2c1.5 0 2.5.8 2.6 1.9h-5.2c.1-1.1 1.1-1.9 2.6-1.9z"/>'
      + '<path d="M8.6 11.4h2.1M13.3 11.4h2.1"/><path d="M12 8.4v1.6"/>',
    march: '<path d="M6 3.4v17.2"/><path d="M6 4.4h11.2l-2.5 3.5 2.5 3.5H6z"/><path d="M4 20.6h4"/>',
    /* v90.97（老板）：行政 —— 简牍/卷册（理政文书） */
    admin: '<path d="M6.4 3.6h11.2v16.8H6.4z"/><path d="M9 7.2h6M9 11h6M9 14.8h3.6"/>'
      + '<path d="M4.4 6.2v13.6M19.6 6.2v13.6"/>',
    quest: '<path d="M7 3.2h9.2A2.8 2.8 0 0 1 19 6v12a2.8 2.8 0 0 0 2.8 2.8H7A2.8 2.8 0 0 1 4.2 18V6A2.8 2.8 0 0 1 7 3.2z"/>'
      + '<path d="M7.6 3.2A2.8 2.8 0 0 0 4.8 6"/><path d="M8.4 8.4h7.2M8.4 12h7.2M8.4 15.6h4"/>',
    stats: '<path d="M4 4.4v15.2h16"/><path d="M8 19.6v-6.2M12.4 19.6V8.6M16.8 19.6v-9.4"/>',
    shop: '<path d="M4.2 9.6 5.6 4h12.8l1.4 5.6"/><path d="M4.2 9.6h15.6v9.8H4.2z"/>'
      + '<path d="M3.2 9.6c0 1.5 1.2 2.6 2.8 2.6s2.8-1.1 2.8-2.6c0 1.5 1.2 2.6 2.8 2.6s2.8-1.1 2.8-2.6c0 1.5 1.2 2.6 2.8 2.6s2.8-1.1 2.8-2.6"/>'
      + '<path d="M9.6 19.4v-4.8h4.8v4.8"/>',
    bag: '<path d="M6.2 8.2h11.6l1.3 11a1.5 1.5 0 0 1-1.5 1.6H6.4a1.5 1.5 0 0 1-1.5-1.6z"/>'
      + '<path d="M9.2 8.2V6.6a2.8 2.8 0 0 1 5.6 0v1.6"/><path d="M6.6 12.4h10.8"/>',
    /* v89.194（老板 S3）：收藏 —— 画轴（藏品含英雄画像/书画，卷轴最贴题） */
    collection: '<rect x="6.4" y="6.6" width="11.2" height="10.8" rx="1"/>'
      + '<path d="M3.6 4.6v14.8M20.4 4.6v14.8"/>'
      + '<path d="M3.6 6.6h2.8M3.6 17.4h2.8M17.6 6.6h2.8M17.6 17.4h2.8"/>',
    /* ⛔ v89.218：story 导航图标随「史册 / 故事集」页签退役。 */
    doc: '<path d="M7.6 3.4h6.6l4.2 4.2v13H7.6z"/><path d="M14.2 3.4v4.2h4.2"/>'
      + '<path d="M10.4 12.4h5.2M10.4 16.2h5.2"/>',
    /* v29（需求 5）：自动化菜单 —— 齿轮外圈 + 回旋箭头，表示"自行运转" */
    auto: '<path d="M4.6 12a7.4 7.4 0 0 1 12.6-5.2"/><path d="M17.6 3.4v3.6h-3.6"/>'
      + '<path d="M19.4 12a7.4 7.4 0 0 1-12.6 5.2"/><path d="M6.4 20.6v-3.6h3.6"/>'
      + '<circle cx="12" cy="12" r="2.2"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/>'
      + '<path d="M12 2.6l1.5 2.3 2.6-.7.4 2.7 2.7.4-.7 2.6L20.8 12l-2.3 1.5.7 2.6-2.7.4-.4 2.7-2.6-.7L12 20.8l-1.5-2.3-2.6.7-.4-2.7-2.7-.4.7-2.6L3.2 12l2.3-1.5-.7-2.6 2.7-.4.4-2.7 2.6.7z"/>',
    /* v91.60（老板）：奇观建造 —— 网格 + 构件块（类星球建造场） */
    build: '<path d="M4 4.4h16v15.2H4z"/><path d="M4 9.4h16M4 14.6h16M10.4 4.4v15.2M15.6 4.4v15.2"/>'
      + '<rect x="6.6" y="6.8" width="2.6" height="2.6" rx="0.4"/>'
      + '<rect x="12.6" y="12" width="2.6" height="2.6" rx="0.4"/>',
  };
  ICON.nav = function (key) {
    var d = ICON.navSet[key];
    if (!d) return '';
    return '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };

  /* ============================================================
   * v35：AI 位图素材层（**最高优先级**）
   * ------------------------------------------------------------
   * 需求：「游戏级美术 + 汉代风」「单个地块不再显示背景（透明），
   *        直接以图标轮廓」。
   *
   * 为什么位图不套 wrap()：
   *   wrap() 会补 lightPass（光晕暗角）与 plate()（承台圆盘）——
   *   而位图 PNG 自带透明轮廓，正是"直接以轮廓摆放"要的效果。
   *   不套 wrap 就自然没有承台，也省掉一层 SVG 包装。
   *
   * 矢量路径（game-icons / 手绘）全部保留为**回退**：
   *   BITMAPS 未登记该 id（如地形只出了城市/平原）时自动走矢量。
   * ============================================================ */
  function bmImg(src) {
    return '<img class="ico ico-img" src="' + src + '" alt="" draggable="false">';
  }
  function bmOf(group, id) {
    if (typeof BITMAPS === 'undefined' || !BITMAPS) return '';
    var src = BITMAPS.src(group, id);
    return src ? bmImg(src) : '';
  }
  /* ICON.get 的 type 既可能是分组名，也可能是 'mat_fatie' 这类复合 key */
  function bmOfType(type, id) {
    if (type === 'building' || type === 'ext' || type === 'terrain' || type === 'res' || type === 'troop') {
      return bmOf(type, id);
    }
    var m = /^(mat|slot|item)_(.+)$/.exec(type);
    return m ? bmOf(m[1], m[2]) : '';
  }

  /* v36（需求 1「政务厅的贴图没变」）：位图**原始路径**查询。
     ICON.get 返回的是包好的 <img> 字符串；而政务厅宫殿是跨 4 格的自绘容器
     （.gov-art 要按自己的尺寸与对齐方式摆图），所以单独暴露路径。 */
  ICON.bitmapSrc = function (group, id) {
    if (typeof BITMAPS === 'undefined' || !BITMAPS) return '';
    return BITMAPS.src(group, id);
  };

  /* ============================================================
   * v89.227：建筑按等级分档取图（老板：5级/10级时更雄伟、更整洁）
   * ------------------------------------------------------------
   * 三档：Lv1–4 基础 · Lv5–9 `_t2` · Lv10–MAX `_t3`（雄伟版）。
   * 素材文件名 `ai_<id>_t2.png` / `ai_<id>_t3.png` **先在就在则用**；
   * 未出图时自动降级回基础图 `ai_<id>.png` —— 系统先立、图后补，零破坏。
   * 返回 `<img>`；两档都查不到时返回 ''（调用方退回基础图/矢量）。
   * ============================================================ */
  ICON.bmBuildingTier = function (id, lvl) {
    var n = Number(lvl) || 1;
    /* v90.63（老板「6、12 级获得新皮肤」）：Lv<6 = 档1 基础皮肤；Lv6~11 = 档2（_t2）；Lv12+ = 档3（_t3）。 */
    var suffix = n >= 12 ? '_t3' : (n >= 6 ? '_t2' : '');
    if (!suffix) return '';
    return bmOf('building', id + suffix);   /* 无档位图 → ''（调用方回退基础图） */
  };
  /* ============================================================
   * 兜底层取图（**跳过 AI 位图**）：手绘 SVG / game-icons 矢量
   * ------------------------------------------------------------
   * 为什么要单独暴露：
   *   ① 测试要能**分层断言**。曾经 smoke 因为看不见素材层（裸 var 在
   *      require 下是模块局部），所有"图标长什么样"的断言其实只验到了
   *      兜底层，却误以为验的是最终输出 —— 位图从未被验过。
   *   ② 排查"换了素材却没生效"时的第一问：这个图标现在由哪一层提供？
   * ============================================================ */
  ICON.raw = function (type, id) {
    var key = null;
    if (type === 'building') key = BUILDING_KEY[id];
    else if (type === 'ext') key = EXT_KEY[id];
    else if (type === 'terrain') key = TERRAIN_KEY[id];
    else if (type === 'res') key = RES_KEY[id];
    else if (type === 'troop') key = ALL['troop_' + id] ? 'troop_' + id : null;
    else key = ALL[type] ? type : null;
    if (!key || !ALL[key]) return '';
    /* 建筑 / 城外 / 地形 是"大地图上的主体"，套承台；
       资源小标、兵种小图、材料、部位图不套（避免过重） */
    var big = (type === 'building' || type === 'ext' || type === 'terrain');
    return wrap(ALL[key]('ic_' + key + '_'), { plate: big });
  };
  /* 当前该图标由哪一层提供：'bitmap'（AI 位图）| 'vector'（矢量兜底） */
  ICON.layerOf = function (type, id) { return bmOfType(type, id) ? 'bitmap' : 'vector'; };
  ICON.get = function (type, id) {
    /* v35：AI 位图优先（自带透明轮廓，不套承台/光晕） */
    var bm = bmOfType(type, id);
    if (bm) return bm;
    return ICON.raw(type, id);
  };
  ICON.keys = function () { return Object.keys(ALL); };
  ICON.has = function (type, id) { return !!ICON.get(type, id); };

  /* 建筑 id 直接取图（供 ui 层简化调用） */
  ICON.forBuilding = function (id) { return ICON.get('building', id); };
  ICON.forExt = function (id) { return ICON.get('ext', id); };
  ICON.forTerrain = function (id) { return ICON.get('terrain', id); };
  ICON.forRes = function (id) { return ICON.get('res', id); };
  ICON.forTroop = function (id) { return ICON.get('troop', id); };
  ICON.forMat = function (id) { return ICON.get('mat_' + id, ''); };
  ICON.forEquip = function (slot) {
    /* v35：AI 位图优先 */
    var bm = bmOf('slot', slot);
    if (bm) return bm;
    var k = 'slot_' + slot;
    return ALL[k] ? wrap(ALL[k]('ic_' + k + '_')) : '';
  };
  ICON.forItem = function (type, id) {
    /* v35：AI 位图优先（材料与物品两类） */
    if (type === 'mat' || type === 'material') {
      var bm0 = bmOf('mat', id);
      if (bm0) return bm0;
    }
    var bm1 = bmOf('item', type);
    if (bm1) return bm1;
    /* v30 修复：材料（mat/material）此前漏分发，24 种材料全落 attr_buff 橙卡兜底图 */
    if ((type === 'mat' || type === 'material') && ALL['mat_' + id]) return wrap(ALL['mat_' + id]('ic_mt' + id + '_'));
    var k = 'item_' + (TYPE_KEY[type] || 'attr_buff');
    return ALL[k] ? wrap(ALL[k]('ic_' + k + '_', id)) : '';
  };
  ICON.MAT_CELLS = MAT_CELLS;
})();

/* ---- gicons.js ---- */
/* ============================================================
 * js/gicons.js — game-icons 开源图标素材层（v32）
 * ------------------------------------------------------------
 * 素材来源：https://game-icons.net  （CC BY 3.0，Lorc / Delapouite / contributors）
 * 数据取自 npm 包 @iconify-json/game-icons（经国内镜像 registry.npmmirror.com 获取）。
 * 共 66 个图标，由 .workbuddy/tmp/gen_gicons.js 自动提取 —— 请勿手改本文件。
 *
 * 渲染方式：原始剪影路径（fill="currentColor"）→ 换成按语义分配的斜向渐变，
 * 再套一层 SVG feSpecularLighting 光照滤镜（"光照浮雕"），得到金属/木石质感。
 * 渐变与滤镜定义由 defsHTML() 输出，页面只需注入一次（见 ui.ensureIconDefs）。
 * ============================================================ */

var GICONS = (function () {
  var D = {
    "animal-hide": "<path fill=\"currentColor\" d=\"M76.28 21.688c-26.378 9.306-43.39 25.92-51.374 49.53c33.78 22.83 81.775 69.988 100.875 114.813c7.62 17.88 13.92 38.086 17.97 59.126c5.308-2.97 33.706 40.776 25.5 33.156c-1.905-1.766-22.602-12.653-22.125-5.53c1.39 20.77 2.154 36.28-1.22 56.28c-8.794 52.14-56.968 122.188-56.968 122.188c22.368 21.103 35.882 27.827 74.876 35.78l77-100.405c28.983 22.87 5.424 64 28.218 62.47c21.462-1.442 2.15-41.235 18.44-61.845c16.95 22.598 36.356 41.26 55.717 57.125c2.09 2.124 1.477-61.477 5.75-47.594c4.162 13.52 13.724 52.06 18.47 65.25c12.987 13.292 22.495 24.418 38.437 27.595c36.918 7.356 33.552-2.188 69.28-22.094c0 0-62.02-74.034-76.468-118.874c-14.824-46.01-21.362-98.512-7.5-144.812c15.787-52.74 97.78-133.094 97.78-133.094c-4.763-5.607-8.447-9.992-11.686-13.688c-3.5-3.993-35.27 15.448-38.594 12.438c-3.296-2.988 21.852-28.457 17.094-31.75c-5.434-3.76-12.353-8.134-21.97-14.063c-32.09 39.05-59.294 63.115-112.624 96.376c-4.038-23.52-1.745-37.2-19.344-53.938c-17.6-16.74-55.628-29.337-89.187-.594c-14.822 12.696-11.758 33.168-19.47 51.532c-24.79-42.81-90.31-87.444-116.874-95.374zM273.157 141.03c3.632 9.382 1.912 19.278-1.5 28.626s-8.772 18.586-14.625 27.375c-3.624 5.446-7.432 10.64-11.155 15.595c10.79-3.762 22.226-7.236 33.5-2.594l10.688 4.407l-6.875 9.282c-3.87 5.213-7.125 9.803-9.97 14c3.6-1.794 7.416-3.395 11.532-4.564c3.455-.98 9.48 1.043 11.625 4s2.316 5.218 2.53 7.28c.432 4.128.016 8.136-.53 12.69c-1.093 9.104-3.05 19.868-3.5 26.062l-17.97-1.313c.597-8.223 2.62-18.754 3.595-26.875c.026-.218.007-.254.03-.47c-8.836 4.995-18.517 12.7-30.56 17.75L224.437 283l14.343-23.688c5.164-8.52 10.192-17.848 19.22-31.218c-3.025.674-6.163 1.506-9.344 2.625c-5.286 1.858-10.545 4.006-15.094 5.843s-7.876 3.33-11.78 4.156l-21.032 4.468l11.594-18.125c5.86-9.155 18.906-23.762 29.72-40c5.405-8.12 10.077-16.445 12.686-23.594s2.883-12.69 1.625-15.94l16.78-6.5z\"/>",
    "archer": "<path fill=\"currentColor\" d=\"M341 25.97c-25.5 42.42-21.2 82.13-10.9 117.13c10.3 35.1 25.6 66.5 25.6 95.5h.1c6.3-1.4 12.1-1.9 17.9-.9c-.3-34.7-16.8-67-26.4-99.6c-9.7-33-13.4-65.29 9.1-102.87zm-33.3 36.27L154.2 227.7c7.6 0 15.6.9 23.2 2.9c7.2-2.9 13.8-8 19.3-15.1c4.1-5.3 7.5-11.6 10-18.7L304 91.96c.1-9.68 1.2-19.6 3.7-29.72M164.2 107.1c-12.3 0-23.7 6.3-32.5 17.6s-14.5 27.4-14.5 45.4s5.7 34.1 14.5 45.4c1.4 1.8 2.9 3.5 4.4 5l70.9-76.3c-2.5-7.4-6.1-14-10.3-19.5c-8.8-11.3-20.2-17.6-32.5-17.6m264.5 119.5v19h-34c5.9 4.9 9 11.3 10.2 18h23.8v19l64-28zm-225.2 19c1.4 2 2.5 4.3 3.3 6.8c.8 2.4.5 5.1-.2 6.7c-.7 1.9-1.8 3.1-3.2 4.5h131.5c.1-.2.1-.4.1-.6c1.9-8.2 2.5-12.6 8-17.4zm-58.3.5c-8.5 1.3-14.4 4.5-21 6.7l-74.48-1c-23.01-.1-31.67 34.4-7.93 35.4c16.14.3 27.69-2 39.55-4s24.16-3.8 39.56-1.3c9.3 2.2 18.1 7.4 25.3 12c8.7 2.2 17.5 2 23.8.2c5.7-1.6 8.7-4.1 9.9-6.1c-5-7.6-12.3-14.2-9.6-22.3c3-6.4 9.5-9.1 15-12.1c.1 0 .2-.1.3-.1c-2.6-1.9-6.4-3.8-11.3-5.1c-10.2-2.3-19.5-3.2-29.1-2.3m209 13.7c.9-1-.8 1.7-1.3 5.7c-.6 4-.8 9.2-.4 14.4c1.3 6.9.7 16.2 6.2 21.4c6.5 4.1 24.2 5.1 27.2-1.2c1.3-12.3 4.1-23.5.8-35.2c-.8-3-1.9-4.3-2.2-4.5c-8.6-4.6-22.7-8.8-30.3-.6m-19.7 21.1c-51 .9-87.9.2-137.8.6c5.7 15.3-9.3 26.3-21.9 29.9c-.1 0-.2 0-.3.1l130.8 171c-1.4-9.8-1.5-19.3-.9-28.6l-84.2-110.1c.7-14.3 0-25.5-.9-39.3c40.6 2.7 82.7 1.5 119.6-1.7c-2.5-7-3.9-15-4.4-21.6zM112.9 299c-12.5 41.7-2.7 92.3-7.3 138v-.2L101 494h121.1l-16.7-63.3c3.5-12.9 6.8-26.4 8.9-37.6l-61.1-79.9c-17.7-.3-25.6-12.5-40.3-14.2m242.8 21.2c-.6 28.6-15.5 59.4-25.6 93.9c-7.2 24.5-11.5 51.4-4.6 79.9h18.4c-7.7-26.2-3.8-50.4 3.4-74.9c9.3-31.5 25-62.8 26.3-96.1c-6 .3-12.2-.5-17.9-2.8\"/>",
    "archery-target": "<path fill=\"currentColor\" d=\"m226.063 24.22l-9.782 32.624c12.992-2.652 26.423-4.032 40.19-4.032c10.475 0 20.766.82 30.81 2.376l-9.405-30.97h-51.813zm30.406 48.843c-99.627 0-180.19 80.53-180.19 180.156c0 99.624 80.563 180.155 180.19 180.155c99.624 0 180.155-80.53 180.155-180.156S356.094 73.061 256.468 73.061zm0 41.687c76.482 0 138.467 61.985 138.467 138.47c0 76.482-61.985 138.5-138.468 138.5c-76.485 0-138.5-62.018-138.5-138.5c0-76.485 62.015-138.47 138.5-138.47zm-.033 38.938c-54.96 0-99.53 44.54-99.53 99.5s44.57 99.5 99.53 99.5s99.5-44.54 99.5-99.5s-44.54-99.5-99.5-99.5m.032 39.687c33.052 0 59.842 26.79 59.842 59.844c0 33.052-26.79 59.843-59.843 59.843c-33.055 0-59.845-26.79-59.845-59.844s26.79-59.845 59.844-59.845zm0 30.906c-15.993 0-28.97 12.947-28.97 28.94c0 15.99 12.977 28.968 28.97 28.968c15.99 0 28.936-12.977 28.936-28.97c0-15.99-12.945-28.937-28.937-28.937zM114.905 395l-27.844 92.875h46.876l20.28-62.313A201.8 201.8 0 0 1 114.905 395m277.188 5.688a201.3 201.3 0 0 1-39.72 28.468l19.25 58.72h46.907zm-165.03 50.78v36.407h52.092v-35.53a202 202 0 0 1-22.687 1.28c-9.99 0-19.81-.74-29.408-2.156z\"/>",
    "barbed-coil": "<path fill=\"currentColor\" d=\"m229.2 18.34l-6.1 5.71C179.4 64.68 108 67.31 49.08 63.27l-11.43-.78l1.53 11.35c3.18 23.53.14 49.36-6.97 71.46c-3.67 11.4-8.49 21.8-13.85 30.3V205c13.92-12.5 24.52-31.8 31.64-53.9q2.76-8.7 4.74-17.7l54.06-3l5.3-47.84c28.9-1.87 58.2-7.39 84.3-19.84l39.5 32.35l27-30.09c17 7.66 35.6 12.29 54.4 12.1l13.3 37.22l37.5-2.1c2.6 4.8 5.5 9.5 8.6 14c8.2 12 18.5 22.6 31.6 30.5l-2.2 29.5l22 2.6c.7 11.3 2.4 22.2 5.7 32.6c3.4 10.5 8.5 20.5 15.7 29.4l-20.1 19.7l15.6 11.6c-19.6 25.2-25.9 52.4-22.9 77.6l-20.9 3.1l3.4 23.5c-25.5 7.2-48 24.8-60.7 47.5l-28-14.6L313 444c-21.5-3.4-44.9-2.8-66.5 4.9l-15.7-29l-26 22c-11.7-13-26.3-23.1-41.8-30.5c-10.7-5.2-21.7-9.1-32.8-11.9l10.5-42.4l-37.5 6c1.5-9 2.3-18.4 2-28c-.3-12.5-2.7-25.4-8.04-37.6l42.24-27.4l-35.6-19.3c17.6-17 28.6-37.4 34.1-57.5l44.2 5.8l-6.7-30.7c5.1-.2 10.2-.6 15.3-1.5c11.9-2 23.7-6.4 34.6-13.8l19.4 30.9l18.4-31.9c6.1 2.3 12.2 3.5 18.1 3.9c4.3.4 8.4.3 12.5-.1l6 37.2l24.9-18.4c4.7 6.5 10 11.8 15.8 16c4.2 3.1 8.5 5.6 13 7.7l-12.8 33.8l31.8-3.7c.5 5.1 1.7 9.8 3.4 14.2c1 2.7 2.3 5.4 3.6 7.9l-31.8 14.2l26.9 21.4c-3.2 4.8-5.8 9.8-7.7 15.2c-2.2 6.7-3.3 13.7-3.4 20.9l-22.6-8.6l4 34.6c-3.1 1.4-6.1 2.9-9.1 4.6c-4.8 2.7-9.5 5.8-13.8 9.4l-21.2-25.9l-14.3 32.8c-10.6-2-21.2-1.4-31.1 1.6l-7.8-21.3l-20.2 15.1c-7.6-7.8-16.3-14.1-25.3-19.2l20.1-28l-37-2.8c1.3-7.5 1.8-15 .9-22.3l27.3-4.4l-16.8-19.7c2.7-2 5.2-4.3 7.4-6.8c4.8-5.6 7.6-12.4 9-20.1c6.7 1.5 13.6 1.7 20.2-.2c7.8-2.1 14.8-6.8 20.7-13.4c12.9 10.7 27.1 19.2 42.1 23.4c-1.7 6.1-2.8 12.5-2.4 19.2c.3 5.5 1.7 11.1 4.3 16.5c-10.6 1.6-21.1 4.8-31 10.5c-8.8-14.5-21.9-25.3-43.1-29.1c12.7 21.9 26.7 43.4 28.4 69l13.8-16.3c14.4-13 30.4-16.5 49.2-16.7l22.3-.2l-15.8-15.8c-7-6.9-9.1-12.6-9.5-19c-.4-6.3 1.5-13.6 4.7-21.7l4.4-11.2l-11.9-1.5c-16.4-2-34.6-12.6-50.6-27.6l-8.6-8.1l-5.8 10.2c-4.7 8.1-10.4 12.2-16.2 13.8c-5.7 1.6-12 .9-18.5-2.9l-13.9-8l-.1 16c-.1 11.2-1.9 16.4-5.9 20.9c-3.9 4.6-11.5 9.1-24.3 14.8l-10 4.4l5.9 9.1c11 17.4 7.7 36.3-3.6 60.3l-5 10.6l11.4 2.5c23.5 5.1 50.3 20.1 63.3 45.3l5.4 10.6l8.9-7.7c18.7-15.9 40.3-18.3 64.6-1.4l9.3 6.6l4.6-10.5c4.1-9.6 13.5-18.3 24.7-24.5c11.1-6.3 23.9-10 32.8-10.7l11.8-1l-3.6-11.2c-5-15.1-5.1-27.8-1.4-38.8c3.8-11.1 11.7-20.9 24.8-29.8l8.2-5.5l-6-7.9c-7.5-10-14.7-18.9-18.3-28.3c-3.5-9.4-4.3-19.1 1.7-33.7l4.3-10.5l-11.1-2.2c-14.1-2.9-26.7-6.7-36.7-14s-18-18-23.1-37.3l-2.5-9.6l-9.4 3c-10.7 3.5-22.3 6.5-33.9 5.7c-11.5-.8-23.3-5.1-35.9-18l-7.8-7.8l-6.4 8.9c-12.9 17.5-28 25.1-44.8 28c-16.9 2.8-35.5.5-52.9-3.3l-12.4-2.6l1.1 12.5c2.6 32.6-14 81.4-65.48 104l-14.86 6.6l13.1 9.5c22.49 16.5 29.74 37.7 30.39 60.5s-6.1 46.5-12.52 64.1l-4.71 13l13.76-.4c20.82-.6 48.02 4.4 71.82 15.8c23.7 11.5 43.7 29 52.5 53.2l4.5 12.2h1.9l8.9-8.7c32.3-31.2 84.1-27.8 119.2-14l10.6 4.1l2-11.2c6.5-36.1 49.2-67.6 88-61.8l18.1 2.7l-8.5-16.3c-18.2-34.9-17.5-78.3 32.6-117.7l8.9-7V262l-9.5-6.4c-16.6-11-25.4-24-30.5-39.9s-6-35-5-56.4l.4-7.6l-7.4-1.9c-22.2-5.7-36.2-17.7-47.5-34.2c-11.4-16.47-19.4-37.6-27.7-59.79l-3.6-9.52l-9.2 4.34c-39 18.42-87.2.94-117.9-26.68l-6.3-5.6h-.2z\"/>",
    "belt": "<path fill=\"currentColor\" d=\"M256 126.97c-86.364 0-225.564 39.103-234.6 109.96c-9.828 90.817 77.986 124.365 144.875 128.814v-78.592c-52.133 0-70.272-22.63-66.675-50.222c7.275-55.81 100.12-63.614 156.4-63.614s149.125 7.805 156.4 63.614c3.597 27.59-14.542 50.222-66.675 50.222v78.592c66.89-4.45 154.703-37.997 144.875-128.814c-5.604-78.746-148.236-109.96-234.6-109.96m71.656 152.257l-143.312.02V384.87l143.312.157zm-17.642 21.507v23.606h-82.29v19.592h82.29v21.523h-104.12V300.8h32.33z\"/>",
    "blacksmith": "<path fill=\"currentColor\" d=\"M210 25c-10.012 0-19.372 5.32-26.74 15.145C175.892 49.968 171 64.15 171 80s4.892 30.032 12.26 39.855C190.628 129.68 199.988 135 210 135s19.372-5.32 26.74-15.145C244.108 110.032 249 95.85 249 80s-4.892-30.032-12.26-39.855C229.372 30.32 220.012 25 210 25m219.746 17.512l-18.701 15.21l-22.76-9.206l-7.72 15.271l85.86 36.313l16.807-34.532zm-5.264 59.392l-54.697 116.153l17.367 7.976L441.69 109.18zM153 122.518c-5.86.764-11.17 1.81-16 3.086V253h146V125.604c-4.83-1.276-10.14-2.322-16-3.086v59.044l-4.975 2.489c-34.146 17.073-69.904 17.073-104.05 0L153 181.563zm-34 9.982a61 61 0 0 0-5.008 2.988c-13.003 8.669-19.647 20.236-23.262 34.696c-5.902 23.608-2.042 54.157-.416 82.816H119zm182 0V253h28.686c1.626-28.659 5.486-59.208-.416-82.816c-3.615-14.46-10.26-26.027-23.262-34.696A61 61 0 0 0 301 132.5m-130 .846v36.793c26.365 11.776 51.635 11.776 78 0v-36.793C239.103 145.188 225.36 153 210 153s-29.103-7.812-39-19.654m-16.951 137.058l-.002.002v20.344H65.109c15.996 38.806 51.26 65.427 88.942 74.28V398h58.558c-12.115 30.534-33.527 55.682-58.5 77.592h-25.435v18.72h284.344v-18.72h-27.44c-28.728-21.894-50.024-47.017-61.594-77.594h63.657v-29.156c19.75-6.995 39.5-19.541 59.25-36.719c-19.806-17.518-39.235-27.25-59.25-31.937v-29.782z\"/>",
    "boat-fishing": "<path fill=\"currentColor\" d=\"M453 61.16C382.3 72.25 282.7 104.9 207.3 160c.4.2.8.5 1.2.7c4.8 3.1 8.8 7.3 11.5 12.4c66-47.5 153.2-78.35 219-91.15V401.8h18V73.85c-.3-5.2-3.1-12.04-4-12.69m-344.9 5.69c-18.66 0-35.13 18.4-35.13 42.85c0 24.5 16.47 42.9 35.13 42.9c18.7 0 35.1-18.4 35.1-42.9c0-24.45-16.4-42.85-35.1-42.85M79.73 161.2c-16.65 42.2-23.61 86.3-28.4 126.9c24.46-.9 48.24-2.4 70.97-4.5c-1.8-14.3-2.9-28.5-3.5-42.7c-8-5.9-16.2-12.8-24.39-20.1l11.99-13.4c10.9 9.7 21.5 18.4 30.9 24.5c9.3 6.2 17.6 9.5 21.9 9.8h.1c-.5 0 2.1-.4 5.7-2.8c3.5-2.5 8-6.5 12.6-11.5c9.2-9.9 19.2-23.9 26.7-37.8c1.3-2.4 1.3-4.4.3-6.9c-.9-2.5-3.1-5.2-5.9-6.9c-2.7-1.8-5.8-2.6-8.4-2.3s-5.1 1.3-7.9 5.1l-26.8 35.9l-42-44.3c-1.8.3-3.6.4-5.5.4c-10.56 0-20.24-3.5-28.37-9.4M273.3 278.5c-63.1 14.3-154.2 27.4-254.3 28.1v94.2h138.7c53.8-27.5 96.3-79.7 115.6-122.3M64 416.8c-13.18 0-29.27 4.3-42.85 8.4c-1.08.3-2.11.6-3.15 1V445c2.59-.8 5.39-1.7 8.36-2.6c12.92-3.9 28.83-7.6 37.64-7.6s18.29 3.4 28.79 7.4c10.51 4 22.01 8.6 35.21 8.6s24.7-4.6 35.2-8.6s20-7.4 28.8-7.4s18.3 3.4 28.8 7.4s22 8.6 35.2 8.6s24.7-4.6 35.2-8.6s20-7.4 28.8-7.4s18.3 3.4 28.8 7.4s22 8.6 35.2 8.6s24.7-4.6 35.2-8.6s20-7.4 28.8-7.4s24.7 3.7 37.6 7.6c3 .9 5.8 1.8 8.4 2.6v-18.8c-1-.4-2-.7-3.1-1c-13.6-4.1-29.7-8.4-42.9-8.4s-24.7 4.6-35.2 8.6s-20 7.4-28.8 7.4s-18.3-3.4-28.8-7.4s-22-8.6-35.2-8.6s-24.7 4.6-35.2 8.6s-20 7.4-28.8 7.4s-18.3-3.4-28.8-7.4s-22-8.6-35.2-8.6s-24.7 4.6-35.2 8.6s-20 7.4-28.8 7.4s-18.3-3.4-28.8-7.4s-22.02-8.6-35.2-8.6\"/>",
    "book-cover": "<path fill=\"currentColor\" d=\"m102.53 26.063l90 345.75l289.22 23.25l-90.03-345.72zm-18.968 1.406c-30.44 11.894-55.62 53.07-49.687 75.28l3.25 11.813c.654-1.722 1.345-3.44 2.063-5.157C49.102 85.688 65.734 62.636 89.56 50.5l-6-23.03zM94.44 69.187c-16.66 10.016-29.916 28.1-38 47.437c-5.2 12.44-8 25.417-8.75 36.25v.03L112.56 388.5c.305-.572.593-1.148.907-1.72c10.585-19.223 27.804-37.623 51.06-48.405L94.438 69.187zM154 107.968l239.78 16.188l-1.28 18.625l-239.75-16.155L154 107.97zm46.03 34.407l5.657 8.875l14.188 22.313l39.03-15.25l7.595-2.938l3.97 7.094l16.28 29.124l4.313 7.72l-7.438 4.717c-10.267 6.524-17.392 12.284-21.75 16.782c-3.03 3.13-4.247 5.232-4.906 6.594c1.38.303 3.433.577 6.624.28c18.268-1.69 56.285-19.964 79-61.592l5.47-10.03l8.748 7.374l46 38.812l11.532 9.72l-13.844 6l-33.28 14.374c5.447 4.925 11.436 5.916 18.436 5.406c9.95-.724 21.427-6.07 29.125-11.063l10.158 15.657c-9.41 6.1-22.867 12.934-37.938 14.03c-15.07 1.098-32.27-5.296-42.594-23.155l-5.25-9.095l9.625-4.156l30.44-13.157l-26.033-22c-25.716 40.294-62.68 59.168-87.843 61.5c-6.78.628-12.945.26-18.594-2.688c-5.65-2.95-9.984-10.6-9-17.406s4.838-12.4 10.688-18.44c4.385-4.526 10.612-9.367 17.875-14.436l-8.188-14.656L219.5 193.75l-7.156 2.78l-4.125-6.468L196 170.875c-6.308 7.158-9.485 14.528-9 21.406c.654 9.28 7.854 21.054 30.594 33.69l-9.094 16.343c-25.688-14.273-38.877-31.016-40.125-48.72c-1.248-17.703 9.393-33.013 23.5-44.562l8.156-6.655zm-5.968 118.188l239.782 16.156l-1.25 18.655l-239.78-16.188l1.25-18.625zm-24.75 96.25c-17.637 9.072-31.065 23.708-39.468 38.968c-4.49 8.153-7.307 16.452-8.72 23.876l11.626 42.156l1.688.157c-3.824-27.514 11.358-60.383 41.187-80.97zm26.22 34c-32.403 17.28-46.273 52.303-41.657 72.78l289.78 24.532c-5.298-7.743-8.625-17.827-8.592-28.313l-22.47-9.03l46.626-7.313l-13.69-13.064c5.552-6.838 13.54-12.915 24.47-17.53l-274.47-22.063z\"/>",
    "bookshelf": "<path fill=\"currentColor\" d=\"M169 57v430h78V57zM25 105v190h46V105zm158 23h18v320h-18zm128.725 7.69l-45.276 8.124l61.825 344.497l45.276-8.124zM89 153v270h62V153zm281.502 28.68l-27.594 11.773l5.494 12.877l27.594-11.773zm12.56 29.433l-27.597 11.772l5.494 12.877l27.593-11.772l-5.492-12.877zm12.555 29.434l-27.594 11.77l99.674 233.628l27.594-11.773zM25 313v30h46v-30zm190 7h18v128h-18zM25 361v126h46V361zm64 80v46h62v-46z\"/>",
    "boots": "<path fill=\"currentColor\" d=\"M334.5 85.22c-31.403.523-69.44 13.372-100.563 42.81l17.594 215.407l-6.468 77.657h58.125l15.282-37.72l21.124 37.72h151.53c7.896-58.587-44.23-130.167-74.53-130.375l-16.53 1.124c-36.103 7.265-49.647 27.03-66.314 49.78l-4.28 5.845l-6.72-2.69l-13.03-5.25l-14.283 36.595l-17.406-6.78l14.376-36.783l-11.906-4.78l-8.563-3.438l3.313-8.594c7.98-20.727 20.735-40.35 38.906-54.156c14.907-11.326 33.593-18.483 55.156-18.688c1.438-.013 2.88.014 4.344.063c1.917.063 3.856.167 5.813.343l2.5-18.157c-26.083-16.097-67.526-14.873-103.72-.72l-6.78-17.405c20.11-7.864 41.785-12.5 62.655-12.56c17.98-.054 35.357 3.307 50.563 10.874l5.593-40.656c-31.286-27.418-77.42-24.612-119.374-.594l-9.28-16.22c23.566-13.49 49.485-21.265 74.312-21.31c20.46-.04 40.183 5.176 57.28 16.78l2.188-15.844c.354-1.526.61-3.013.78-4.47c.002-.02 0-.04.002-.06c.357-10.548-4.066-18.356-12.938-25c-9.483-7.103-24.383-11.937-42.03-12.657a117 117 0 0 0-6.72-.094zm-194.406 77.31c-.838.01-1.678.03-2.5.064c-13.162.537-24.16 4.175-30.938 9.25c-6.776 5.075-9.702 10.64-8.937 18.844l-.595.062c.132 1.234.324 2.514.625 3.813l2.313 16.718c10.807-7.494 23.1-11.163 35.53-11.093c17.786.102 35.61 7.284 51.782 19.25l-11.094 15c-13.73-10.16-28.064-15.49-40.81-15.562c-11.988-.068-22.776 4.042-32.407 14.344l4.406 31.843c8.974-4.182 18.787-6.078 28.843-6.063c14.792.022 30.092 4.157 44 11.188l-8.438 16.687c-21.797-11.02-45.487-12.505-61.688-2l2.032 14.72a88 88 0 0 1 2.5-.064c14.633-.1 27.16 4.06 37.343 11.25c14.48 10.227 24.226 25.514 32.625 41.595l4.28 8.25l-8.218 4.344l-8.47 4.467L186 394.875l-16.438 8.875l-13.812-25.594l-9.156 4.844l-6.344 3.344l-4.875-5.25c-16.32-17.62-29.136-32.608-60.406-35.188l-9-.75c-32.087 15.312-47.556 38.284-42.44 76.25h190.44l-5.095-59.687l-.03-.064l13.593-162.625c-24.97-26.094-56.98-36.796-82.344-36.5zm229.344 99.032c-17.593.075-31.926 5.756-43.97 14.907c-12.36 9.39-22.03 22.778-29 37.592l26.657 10.72c14.056-18.898 30.816-38.795 61.813-48.344l-8.032-14.47c-1.3-.105-2.638-.295-3.906-.343a87 87 0 0 0-3.563-.063zM116.594 318c-4.288-.028-9.038.543-14.28 1.625l-9 10.656c23.388 6.11 38.254 19.727 50.75 32.94l10.655-5.626l8.843-4.688c-6.628-11.382-13.846-20.917-22.282-26.875c-6.494-4.586-13.685-7.535-22.874-7.967c-.593-.028-1.2-.06-1.812-.063z\"/>",
    "brick-wall": "<path fill=\"currentColor\" d=\"m494 18.02l-101 .103V119h101zm-119 .12l-238 .247V119h238zm-256 .266L18 18.51V119h101zM18 137v110h229V137zm247 0v110h229V137zM18 265v110h101V265zm119 0v110h238V265zm256 0v110h101V265zM18 393v100.98l229-.236V393zm247 0v100.727l229-.237V393z\"/>",
    "broadsword": "<path fill=\"currentColor\" d=\"m491.844 22.533l-83.42 14.865L196.572 249.25c3.262 4.815 5.37 10.72 5.37 16.932c0 5.863-1.71 11.35-4.643 15.996a53 53 0 0 0-16.027-2.477c-15.724 0-29.904 6.89-39.69 17.796l-9.112-9.113l17.237-17.237a546 546 0 0 1-13.19-17.6l-19.443 19.44l-13.215-13.215l21.828-21.827a548 548 0 0 1-12.792-20.068L72.093 258.68l58.314 58.314a53 53 0 0 0-2.49 16.063a52.9 52.9 0 0 0 4.592 21.564l-72.14 72.14l-14.56-14.56L21.013 437l14.558 14.56l-8.607 8.608l27.246 27.246l8.606-8.61l14.56 14.56l24.798-24.8l-14.557-14.556l72.158-72.16a52.9 52.9 0 0 0 21.498 4.562a53 53 0 0 0 16.063-2.49l58.363 58.363L296.5 401.48a549 549 0 0 1-20.068-12.793l-21.83 21.83L241.39 397.3l19.442-19.44a550 550 0 0 1-17.603-13.194l-17.238 17.238l-9.16-9.16c10.905-9.785 17.795-23.965 17.795-39.69c0-5.346-.806-10.51-2.285-15.39c4.703-3.04 10.288-4.817 16.265-4.816c6.21 0 11.776 1.77 16.52 4.955L476.98 105.95zm-66.227 53.012l13.215 13.215l-191.684 191.68l-13.214-13.213zM181.273 298.39c19.257 0 34.665 15.41 34.665 34.665c0 19.256-15.408 34.666-34.665 34.666s-34.666-15.41-34.666-34.665s15.41-34.666 34.666-34.666\"/>",
    "cape": "<path fill=\"currentColor\" d=\"M257.1 18.46c-17 19.58-32.7 35.31-55.1 42.98c41.5 68.46 139.9 119.76 241.2 62.36c18-14.1 26.7-31.45 34.9-47.34c-98.9-5.45-164.8-19.81-221-58M225 111.1c-18.9 38.3-41 72.2-65.1 100.2c-40.8 47.5-87.03 78.7-132.67 85.3c6.47 19.8 10.43 59.2 25.84 72.6c45.63 18.5 132.83-9.1 164.63-38.7c16.1-16.4 24-36.6 34.2-60.9c-2 35.2-13.3 56.6-27.7 72.4c-18.5 18.2-36.6 30.8-59 37.8c11.9 22.3 16.8 49.7 27.7 67.8c4.4 6.7 8 9.5 14.6 9.4c42-10.9 74.4-45.9 110.9-60.5c55.3-29.3 65.3-74 67-85.5c-1.1 28.7-12.7 67.5-31.7 83.6c33.8 12.4 47.5 67.3 52.3 90.2c15.2-14 33.2-35.4 48.1-60.1C473 393.5 487 357.2 487 324.2c-.3-38.8-17-76.4-26.5-118.2c-5-21.7-7.7-44.7-4.6-69.3c-131.7 55.7-190.9 9.4-230.9-25.6\"/>",
    "castle": "<path fill=\"currentColor\" d=\"M254.25 15.344c-132.537 0-240.188 107.62-240.188 240.156c0 132.537 107.65 240.188 240.188 240.188S494.406 388.038 494.406 255.5S386.786 15.344 254.25 15.344m0 18.687c122.436 0 221.47 99.034 221.47 221.47c0 65.65-28.465 124.583-73.75 165.125V238.75l14-22.78h-7.595L364 101.5l-43.813 114.47h-8.156l14.595 22.78v33.875h-36.813v-88.188l14.625-22.78h-7.593l-44.406-114.47l-44.375 114.47h-7.594l14.03 22.78v123.22h-37.375v-18.094l14.594-22.782h-8.19l-43.78-114.467L95.344 266.78H87.75l14.03 22.783V416.25C59.25 375.9 32.75 318.83 32.75 255.5c0-122.436 99.064-221.47 221.5-221.47zm1.094 160.532h18.687v36.344h-18.686v-36.344zm110.156 87.97h18.688v36.312H365.5V282.53zm-246.656 22.03h18.687v36.344h-18.686v-36.344zm50.875 29.407h18.686v36.342H169.72V333.97zm170.81 30.5h18.69v36.342h-18.69z\"/>",
    "cavalry": "<path fill=\"currentColor\" d=\"M258.962 29.14c-3.21.063-6.68 1.158-10.303 3.4c-5.798 3.584-11.47 10.14-14.872 18.715c-3.4 8.575-3.767 17.236-2.004 23.82c1.763 6.585 5.248 10.765 9.83 12.583s9.986 1.165 15.784-2.42c5.797-3.586 11.467-10.143 14.87-18.717c3.4-8.573 3.767-17.235 2.005-23.82c-1.763-6.584-5.25-10.764-9.832-12.58a14 14 0 0 0-5.478-.98zm83.428 36.012c-8.823 13.437-17.545 27.577-36.268 45.2l-1.615 1.52l-2.137.596c-9.165 2.554-19 3.7-28.863 4.48c-.54 5.822-1.76 11.47-3.492 16.946c14.814.187 28.827-.778 41.297-4.62c18.26-17.188 36.623-35.375 44.685-56.7zm-133.135 31.58q-.258-.001-.527.02c-1.248.117-2.846.825-5.022 2.126c-11.898 12.29-14.007 33.196-.867 57.082c5.73 10.42 18.094 18.277 33.66 23.58c13.165 4.485 28.138 7.013 41.808 8.51l3.71-13.443c-6.24-1.808-14.008-3.65-22.142-6.082c-11.813-3.53-24.576-8.437-34.355-18.432l-.343-.35l-.303-.388c-5.047-6.43-5.557-13.842-5.6-22.496c-.037-7.045.813-15.254 2.02-24.023c-3.345-2.203-6.258-4.21-8.39-5.088c-1.395-.575-2.445-1.008-3.65-1.018zm29.242 12.676c-.806 6.653-1.25 12.573-1.226 17.36c.035 6.717 1.526 10.814 1.69 11.21c1.988 1.936 4.304 3.67 6.87 5.24c4.536-8.52 8.03-16.96 9.363-25.23zm202.955 36.5c-38.698.407-97.748 25.527-127.31 46.75l21.93 26.664c23.08-25.157 50.67-42.282 78.29-49.248c28.02-7.068 56.45-3.25 78.33 13.597c1.784-1.8 2.504-3.56 2.694-5.432c.305-3.01-.998-7.446-4.865-12.283c-7.734-9.675-24.947-19.342-45.388-20.008q-1.805-.059-3.68-.04zm-259.16 8.734c-6.568 16.39-10.208 33.35-7.805 47.883c2.263 13.104 8.145 17.46 18.125 21.94c9.99 4.483 23.807 7.117 36.907 14.036l6.466 3.417l-2.022 7.03c-5.67 19.72-14.65 38.776-28.312 56.41c8.66 10.85 24.016 19.95 40.84 29.016l6.138-10.893l-17.434-29.078l4.14-4.914c10.787-12.804 16.836-38.882 20.882-55.754c-7.692-7.7-25.79-16.08-42.803-28.55l-6.36-4.66l3.784-6.917c.52-.952 1.076-1.906 1.62-2.86c-12.188-5.97-22.86-14.237-29.39-26.11a97 97 0 0 1-4.778-9.995zm260.135 29.922c-7.587-.093-15.517.908-23.664 2.963c-26.07 6.576-53.767 24.346-75.986 51.377l-6.952 8.457l-33.34-40.54c-1.77.288-3.426.55-5.21.842c9.908 16.11 16.95 31.17 25.693 40.888c5.715 6.352 11.743 10.584 20.38 12.742c8.025 2.006 18.66 2.104 33.263-1.126c-2.695-7.855-2.26-16.004-.318-23.077c2.52-9.172 7.08-17.28 10.78-24.534l16.035 8.184c-2.167 4.244-4.322 8.392-6.112 12.324c5.102-.272 13.1-.745 20.61-1.246c8.984-.6 14.34-.982 17.38-1.197c1.703-3.57 3.562-6.718 5.905-9.497c3.513-4.17 8.686-7.383 14.256-8.108a28.4 28.4 0 0 1 4.13-.234c6.8.114 13.423 2.692 21.293 6.686c1.867-6.108 3.71-12.142 5.54-18.045c-12.05-11.18-27.044-16.652-43.683-16.856zM277.92 210.86c-4.448.743-8.952 1.51-13.448 2.27c5.022 3.758 9.534 8.032 13.05 13.293l2.204 3.297l-.948 3.852c-3.357 13.658-7.853 41.85-21.802 62.15l16.474 27.48l-14.802 26.26c6.94-1.8 13.538-4.246 19.607-7.447l11-5.8l2.074 12.26c5.978 35.36-13.102 68.48-22.475 99.294c6.508 9.05 12.247 14.98 17.275 20.388c4.097 4.407 8.004 9.006 10.654 14.683h28.254c-1.863-9.857-5.227-15.497-17.834-26.75l-5.578-4.98l3.87-6.396c15.287-25.248 24.903-82.92 28.925-111.46l.92-6.526l6.503-1.092c10.253-1.72 16.833-5.857 22.162-11.826s9.233-14.076 12.258-23.29c1.334-4.067 2.448-8.31 3.478-12.62c-16.163 3.494-29.45 3.68-40.754.855c-12.36-3.088-21.957-9.893-29.4-18.164c-12.948-14.39-20.65-32.733-31.665-49.73zm-108.337 19.524c-14.047 2.79-27.408 5.57-39.43 8.29c-12.594 4.275-20.655 10.807-26.92 19.765c-6.32 9.03-10.644 20.798-14.083 34.75c-6.85 27.778-10.026 63.737-23.073 100.858l-17.465 65.434c3.948 3.74 7.722 6.273 11.717 9.855c3.488 3.13 6.69 7.757 8.58 13.504h23.447c.593-9.5-2.71-19.834-10.856-26.5l-5.18-4.235l26.142-62.953l5.35-.537c21.24-2.133 40.548-26.11 51.19-40.262l3.75-4.982l5.982 1.758c22.6 6.637 49.11 10.156 73.326 7.377c-21.107-11.086-43.545-22.54-55.405-43.017l-3.175-5.483l4.09-4.84c12.58-14.873 20.877-30.868 26.6-47.8c-8.712-3.39-18.953-6.002-28.93-10.48c-5.508-2.472-10.967-5.897-15.657-10.5zm288.38.46a3 3 0 0 0-.493.02c-1.118.146-1.406.185-2.817 1.858c-1.352 1.604-3.214 4.944-5.216 9.785c-1.614 5.982-.063 10.297 4.242 15.903c2.565 3.34 6.158 6.746 10.16 10.117c4.106-10.06 7.79-20.716 11.25-31.467c-9.026-4.414-14.86-6.17-17.128-6.217zm-340.25 13.26c-.02 0-.32.076-.358.08c.37.02.43-.086.36-.08zm313.353 4.83c-4.126.288-5.917.422-12.262.845c-10.82.72-21.303 1.44-26.12 1.497c.313 2.1 1.08 4.127 2.41 6.265l.532.854l.33.95c.627 1.807 1.2 3.502 1.744 5.15c2.49 4.435 9.938 11.22 20.264 16.535c10.333 5.317 23.014 9.548 34.29 11.682a162 162 0 0 0 3.876-7.19c-5.863-4.615-11.877-9.832-16.727-16.148c-4.34-5.652-7.67-12.72-8.337-20.44m-347.57 7.306c-5.687 2.507-11.285 5.163-16.114 7.74c-6.134 3.273-10.633 6.54-12.37 8.03c-4.556 15.79-6.52 30.088-11.78 44.884c-4.72 13.276-12.487 26.58-26.66 40.11c11.624 10 23.234 16.21 37.47 15.316c8.202-29.22 11.38-58.08 17.63-83.44c2.888-11.71 6.472-22.743 11.825-32.64zm320.41 37.61c.224 5.742-.135 11.87-.944 19.608c-.05 6.863 3.644 11.33 9.248 12.71c5.623 1.388 14.58-.295 24.822-12.622l.204-.244l.22-.23a82 82 0 0 0 3.836-4.324c-10.776-2.654-21.76-6.668-31.562-11.71a138 138 0 0 1-5.825-3.19zm-27.463 33.017c-6.36 6.718-14.816 11.936-25.082 14.857c-.01.077-.026.17-.037.248l15.336 17.203l-8.665 25.655l-14.53 3.216c-1.706 8.07-3.678 16.264-5.95 24.278c.423.08.85.17 1.27.246c10.442 1.892 19.172 1.915 26.915-1.684c17.515-18.86 28.118-31.565 31.95-53.44c-1.87-7.903-10.127-20.008-19.666-29.138c-.512-.49-1.026-.967-1.54-1.44zm-210.993 42.66c-5.333 6.792-12.013 14.51-20.16 21.164c16.307 31.444 34.568 62.892 57.48 92.173h26.753c-28.96-35.58-47.84-75.123-64.073-113.336z\"/>",
    "checked-shield": "<path fill=\"currentColor\" d=\"M48.906 19.656v10.782c0 103.173 10.53 206.07 41.313 289.53c30.78 83.463 82.763 148.094 164.53 170.563l2.188.626l2.25-.5c89.686-19.12 142.322-84.028 171.187-168.344S465.78 133.657 465.78 30.438v-10.78l-10.655 1.53C323.26 39.954 191.452 40 59.595 21.188l-10.69-1.53zM67.75 41.03c63.242 8.536 126.495 12.792 189.75 12.782v184.532h174.78c-4.905 27.572-11.31 53.747-19.592 77.937c-27.348 79.884-73.757 137.33-155.157 155.564c-.008-.003-.02.003-.03 0v-233.5H86.53c-12.87-60.99-18.277-128.81-18.78-197.313z\"/>",
    "chest-armor": "<path fill=\"currentColor\" d=\"M156.7 25.83L89 39.38c-.1 58.57-1.74 119.32-43.49 167.22C104.4 246.5 189 260.7 247 248.8v-99L108.3 88.22l7.4-16.44L256 134.2l140.3-62.42l7.4 16.44L265 149.8v99c58 11.9 142.6-2.3 201.5-42.2c-41.8-47.9-43.4-108.65-43.5-167.22l-67.7-13.55c-12.9 13.88-20.6 28.15-32.9 40.53C308.9 79.78 289.5 89 256 89s-52.9-9.22-66.4-22.64c-12.3-12.38-20-26.65-32.9-40.53M53.88 232.9C75.96 281 96.07 336.6 102.7 392.8l65 22.8c4.2-52.7 28.2-104 63.7-146.1c-55.1 6.3-122.7-5.8-177.52-36.6m404.22 0c-54.8 30.8-122.4 42.9-177.5 36.6c35.5 42.1 59.5 93.4 63.7 146.1l65.2-22.9c6.6-56.8 26.6-111.8 48.6-159.8M256 269c-40.5 43.1-67.7 97.9-70.7 152.7l61.7 21.6V336h18v107.3l61.7-21.6c-3.1-54.8-30.2-109.6-70.7-152.7m151.7 143.4L297 451.1v18.8l110.2-44.1c.1-4.5.3-8.9.5-13.4m-303.3.1c.3 4.5.4 8.9.5 13.4l110.1 44v-18.7zM279 457.4l-23 8.1l-23-8v19.6l23 9.2l23-9.2z\"/>",
    "cog": "<path fill=\"currentColor\" d=\"M234.875 18.78c-26.087 2.367-51.557 8.56-74.875 18.782c15.37 32.763 14.222 66.706-6.72 82.407c-20.835 15.617-54.055 7.965-81.124-15.69c-16.246 19.452-29.336 41.36-38.875 65.626c33.83 12.333 56.635 37.665 52.94 63.5c-3.698 25.835-32.697 43.74-68.626 46.094c2.338 25.796 8.91 50.778 18.937 73.875c17.81-8.182 35.793-11.09 51.095-8.938c13.032 1.87 23.927 7.015 31.156 16.657c15.817 21.097 7.603 54.713-16.78 81.97c19.516 16.35 42.216 29.444 66.594 39.03c12.33-33.828 37.655-56.634 63.5-52.938c25.844 3.697 43.74 32.696 46.094 68.625c26.087-2.365 51.557-8.555 74.875-18.78c-15.766-32.997-14.26-67.588 6.843-83.406c9.64-7.23 22.568-9.022 35.594-7.125c15.112 2.16 31.19 10.25 45.563 22.78c16.088-19.345 29.4-41.51 38.875-65.594c-33.83-12.332-56.635-37.653-52.938-63.5c3.697-25.846 32.665-43.772 68.594-46.125c-2.36-25.944-8.774-50.663-18.906-73.874c-32.612 15.117-66.66 13.145-82.282-7.687c-15.696-20.944-7.252-53.86 16.688-81c-19.52-16.352-42.248-29.447-66.625-39.032c-12.332 33.828-37.657 56.66-63.5 52.968c-25.846-3.693-43.744-32.696-46.095-68.625zm21.656 95.126c79.626 0 144.376 64.752 144.376 144.375c0 79.626-64.75 144.376-144.375 144.376c-79.624 0-144.374-64.75-144.374-144.375c0-79.624 64.75-144.374 144.375-144.374zm0 18.688c-69.524 0-125.686 56.162-125.686 125.687s56.162 125.69 125.687 125.69s125.69-56.164 125.69-125.69c0-69.522-56.164-125.686-125.69-125.686zm.033 15.125c61.094 0 110.625 49.53 110.625 110.624c0 61.095-49.53 110.625-110.625 110.625s-110.625-49.53-110.625-110.626c0-61.095 49.53-110.625 110.625-110.625z\"/>",
    "coins-pile": "<path fill=\"currentColor\" d=\"M431.1 23.53c-9.5 17.34-25.4 23.34-49.6 14.15c17.9 10.24 28.5 24.99 24.6 48.64c12.4-21.29 29.2-24.49 49.4-14.11c-18.3-11.28-33.4-24.22-24.4-48.68M206 45.39c-3.4 27.17-10.8 51.2-46.9 52.1c27.4 3.11 44.3 19.11 46.9 52.21c2.3-26.1 14.6-45.7 46.8-52.21c-34.1-4.65-48-23.18-46.8-52.1M85.7 101.2c-5.5 22-19 32.5-43.2 27.8c20.4 12.6 24.5 30.3 20.4 50.6c9-24.3 24-32.3 43.4-28c-24.4-9.4-24.2-29.2-20.6-50.4m310.4.8c3.6 21.2 3.8 41-20.5 50.4c19.3-4.3 34.3 3.7 43.3 28c-4.1-20.2 0-38 20.4-50.6c-24.2 4.7-37.7-5.8-43.2-27.8m-139.4 52c-9.6 0-18.1 2.4-23.7 5.8c-5.5 3.4-7.3 6.7-7.3 9.3s1.8 5.9 7.3 9.3c5.6 3.3 14.1 5.7 23.7 5.7c3.9 0 7.7-.4 11.1-1.1c5.5-6.1 12.5-10.2 19.7-12.6c.6-4.9-4.7-9.1-7.1-10.6c-5.6-3.4-14.1-5.8-23.7-5.8m-45.1 28.2c-6.2.9-9.1 3.1-10.2 5.4c-1.9 12.5 13 22.2 22.1 26.5c8.7 3.9 17.5 5.2 23.9 4.5s9.4-3.1 10.5-5.4c1.1-2.4.8-6.1-2.6-11.1c-12-.2-22.8-3.1-31.5-8.3c-4.9-3-9.3-6.9-12.2-11.6m98.6 2.6c-9.6 0-18.1 2.4-23.7 5.7c-5.5 3.4-7.3 6.7-7.3 9.3s1.8 5.9 7.3 9.3c5.6 3.3 14.1 5.7 23.7 5.7s18.1-2.4 23.7-5.7c5.5-3.4 7.3-6.7 7.3-9.3s-1.8-5.9-7.3-9.3c-5.6-3.3-14.1-5.7-23.7-5.7m48.8 12.3c5.1 10.4-10.3 23.8-17.6 28.4c1.4.7 3.2 1.3 5.5 1.8c6.4 1.2 15.2.6 24.2-2.7c7.7-2.8 14.1-7 18.4-11.3c.4-5.7 1.2-11 4.7-15c-10.5-6.9-24.8-5.1-35.2-1.2m-202-1.5c-9.6 0-18.1 2.4-23.7 5.7c4.6 6.3 5.7 13.2 4.5 20.8c5.2 2.1 11.9 3.5 19.2 3.5c9.6 0 18.1-2.4 23.7-5.7c5.5-3.4 7.3-6.7 7.3-9.3s-1.8-5.9-7.3-9.3c-5.6-3.3-14.1-5.7-23.7-5.7m251.1 14.2c-2.7 12.2 11.8 23 20.5 27.7c8.5 4.4 17.1 6.2 23.6 5.9c6.4-.4 9.6-2.5 10.8-4.8s1.2-6.1-2.2-11.6s-9.8-11.6-18.3-16.1c-6.5-3.1-28.9-11.1-34.4-1.1m-302.5-.9c-5.9-.1-13.1 1.2-20.3 4.2c-8.8 3.7-15.7 9.2-19.5 14.4c-3.8 5.3-4.2 9-3.2 11.4s4 4.8 10.4 5.8c6.3.9 15.1-.2 24-4c8.9-3.7 15.8-9.2 19.6-14.4c3.8-5.3 4.2-9 3.2-11.4c-4.3-4.9-8.5-6-14.2-6m168 13.1c-3.1 5.8-8.3 9.8-14.4 12.1c6.4 3.9 11.5 9.7 13.1 17.2c2.2 10.5-3 20.4-10.7 27.5c-7.7 7.2-18.2 12.4-30.5 14.9c-12.2 2.6-24 2.1-33.9-1.3s-18.6-10.4-20.8-20.8c-2.2-10.5 2.9-20.4 10.6-27.5c7.1-6.6 16.7-11.6 27.7-14.3c-4.4-2-8.4-4.4-12-7.1c-2.9 5.2-7.5 9.4-12.8 12.6c-9 5.4-20.4 8.3-32.9 8.3c-9.9 0-19.1-1.8-27-5.3c-6.1 7.9-15.2 14.5-26 19c-10.5 4.4-21 6.3-30.6 5.5c-3.8 7.5-11.4 12.4-19.6 15c-10.1 3.1-21.9 3.2-34 .2c-.3-.1-.6-.1-.8-.2V324c2.8-1.5 5.9-2.6 9-3.3c3.4-.8 7-1.2 10.7-1.3v-.2c-2.9-10.3 1.7-20.5 8.9-28.1s17.4-13.5 29.5-16.8c11.56-3 23.1-3.7 33.9-.8c10.1 2.8 19.3 9.2 22.1 19.5c2.9 10.3-1.6 20.5-8.9 28.1c-7.2 7.6-17.4 13.4-29.5 16.8c-1.8.5-3.7.9-5.6 1.3c7.46 8.4 11.8 21.7 9.3 30.2c-3.3 10.1-12.7 16.1-22.9 18.5c-10.3 2.4-22 1.6-33.9-2.2c-8.7-2.8-16.4-6.9-22.6-12.1v113.9h77.2c-4-10.7 3.9-11.4-7.2-16.1c-11.6-4.7-21-11.8-27.3-20.2s-9.5-19.1-5.5-29c4.1-9.8 13.9-15.1 24.3-16.7c10.4-1.5 22.1.1 33.6 4.9c11.6 4.7 21 11.8 27.3 20.2c2.3 3.1 4.2 6.4 5.5 9.9c8.4-.6 16.4.4 23.5 2.8c9.9 3.4 18.6 10.4 20.8 20.8c1.8 8.6-1.3 16.8-6.7 23.4h256.1c-6.3-7.3-10-16.6-7.4-26.2c2.8-10.3 11.9-16.7 22-19.6s21.9-2.7 33.9.6c1.7.5 3.3 1 4.9 1.6V342.7c-11 1.8-21.6 1.1-30.6-2c-9.9-3.4-18.6-10.4-20.8-20.8c-2.2-10.5 2.9-20.4 10.6-27.5c13.2-10.1 25.8-15.4 40.8-16.3V275c-15 .2-35.9-5.5-44.9-13.6c-9.3-.2-19.2-2.9-28.9-8c-10.7-5.6-19.1-13.1-24.6-21.7c-5.3 4-11.5 7.3-18.3 9.8c-11.8 4.3-23.5 5.5-33.8 3.5c-8.6-1.7-16.7-5.9-21.3-13.1c-3.8.6-7.9.9-12 .9c-12.5 0-23.9-2.9-32.9-8.3c-1.3-.8-2.5-1.6-3.7-2.5m207 5.9c1.9 11.1.3 19.9-8 26.7c7.8 2.2 14.2 2.9 21.4 2.4v-29.6c-4.5-.3-9.3-.2-13.4.5M18 229.7v28.9c9.44 3.2 21.18 4.7 30.4 2c3.3-1 5.5-2.2 7-3.6c-7.21-5.3-11.24-12.3-11.3-20.7c-3.7-2-8-3.7-12.8-4.9c-4.6-1.1-9.2-1.7-13.3-1.7m203.2 17.1c-9.4 2-17.2 6.1-22 10.4c-4.7 4.5-5.7 8.1-5.2 10.7c.5 2.5 3 5.4 9.1 7.5s14.9 2.7 24.3.7s17.2-6.1 22-10.4c4.7-4.5 5.8-8.1 5.3-10.6c-.6-2.6-3-5.4-9.1-7.6c-8.3-2.4-16.6-2.4-24.4-.7M81.9 291.6c-9.3 2.6-16.9 7.2-21.3 11.8c-4.4 4.8-5.3 8.4-4.6 11c.7 2.5 3.3 5.1 9.6 7c6.1 1.7 15 1.7 24.3-.9c9.2-2.5 16.9-7.1 21.3-11.8s5.3-8.4 4.6-10.9s-3.4-5.2-9.6-7c-7.91-2-16.83-1.3-24.3.8m261 .1c6.5.1 12.6 1.1 18.2 3c10 3.5 18.7 10.4 20.9 20.9c1 4.9.4 9.8-1.4 14.3c9.9 3.4 18.3 8.6 24.6 15c7.2 7.6 11.8 17.8 9 28.1s-11.9 16.8-22 19.6c-10.1 2.9-21.8 2.7-33.9-.6c-12.1-3.2-22.3-9-29.6-16.6c-4.4-4.6-7.9-10.1-9.2-16.1c-4.4-.4-8.7-1.3-12.6-2.7c-9.9-3.4-18.6-10.3-20.8-20.8s3-20.3 10.7-27.5c7.6-7.1 18.2-12.3 30.4-14.9c5.4-1.1 10.6-1.7 15.7-1.7m151.1 2.4c-2.2.2-4.4.5-6.6 1c-9.4 2-17.2 6.1-22 10.4c-4.7 4.5-5.7 8.1-5.2 10.7c.5 2.5 3 5.4 9 7.5c6.2 2.1 15 2.7 24.4.7c.1 0 .3-.1.4-.1zM330.9 311c-9.3 2-17.2 6.1-22 10.5c-4.6 4.4-5.7 8-5.2 10.6c.5 2.5 3 5.4 9.1 7.6c6.1 2.1 14.9 2.7 24.3.7s17.3-6.1 22-10.5c4.7-4.5 5.8-8.1 5.3-10.6c-.6-2.5-3-5.4-9.1-7.6c-8.3-2.4-16.6-2.4-24.4-.7m-133.4 5.7c12.2 2.6 22.7 7.9 30.4 15.1c7.6 7.2 12.8 17.1 10.5 27.5c-2.3 10.5-11 17.4-21 20.8c-9.9 3.3-21.7 3.8-33.9 1.1c-12.2-2.6-22.7-7.9-30.4-15c-7.6-7.2-12.8-17.1-10.5-27.6s11-17.4 21-20.7c11.5-3.6 23-3.4 33.9-1.2m-28.2 18.2c-6.1 2.1-8.6 5-9.1 7.5c-.6 2.6.5 6.2 5.2 10.6c4.7 4.5 12.5 8.6 21.9 10.6c9.4 2.1 18.2 1.5 24.4-.5c6.1-2.2 8.5-5 9.1-7.6c.5-2.5-.5-6.1-5.2-10.6c-4.8-4.4-12.6-8.6-21.9-10.6c-8-1.5-16.7-1.8-24.4.6M32 338.2c-6.2 1.5-9 4.1-9.8 6.6s-.1 6.1 4.1 11.1c4.3 4.8 11.7 9.7 20.8 12.7c9.2 2.9 18 3.3 24.3 1.8s9-4.1 9.8-6.6c.8-2.4.1-6.1-4.1-11.1c-4.3-4.8-11.6-9.7-20.8-12.7c-8.27-2.3-16.36-3.4-24.3-1.8m336.9 7c-10.3 6.9-20.1 11.5-30.6 13.3c5.3 8.5 16.8 14 24.7 16.2c9.3 2.5 18.1 2.4 24.4.7c6.2-1.9 8.8-4.6 9.5-7.1c.6-2.5-.2-6.2-4.7-10.9c-7.7-6.2-15.2-10.4-23.3-12.2m-53.7 34.9c9.9 3.4 18.6 10.3 20.8 20.8s-3 20.4-10.7 27.5c-7.6 7.1-18.2 12.3-30.4 14.9c-12.3 2.6-24 2.1-33.9-1.3c-10-3.5-18.7-10.4-20.9-20.9c-2.2-10.4 3-20.3 10.7-27.5c7.7-7.1 18.2-12.3 30.4-14.9c11.1-2.3 23.6-2.2 34 1.4M285 396.3c-9.4 2-17.3 6.1-22 10.5c-4.7 4.5-5.8 8.1-5.3 10.6c.6 2.6 3 5.4 9.1 7.6c6.1 2.1 15 2.7 24.4.7c9.3-2 17.2-6.1 22-10.5c4.6-4.4 5.7-8 5.2-10.6c-.5-2.5-3-5.4-9.1-7.6c-8.1-2.3-16.3-2.3-24.3-.7m-201.8 27c-6.4 1-9.3 3.4-10.3 5.8s-.6 6.1 3.2 11.4c3.9 5.2 10.9 10.6 19.7 14.3c9 3.6 17.7 4.6 24.2 3.7c6.3-1 9.3-3.4 10.3-5.8c.9-2.4.5-6.1-3.3-11.4c-3.9-5.2-10.8-10.6-19.7-14.3c-8.15-2.8-16.13-4.7-24.1-3.7m387.9 34.5c-6.5.1-18.5 1-20.5 8.2c-.1 12.5 16 19.8 25.6 22.5H494v-25.3c-7.3-3.4-15.2-5.2-22.9-5.4m-323.8.8c-4.3 9.9-16.3 16.3-24.7 17.7c-3 .4-6.1.6-9.3.5c-1.9 6.1 5.6 10.3 9.7 11.7h25.2c8.6-2 15.7-6 20.1-10c4.7-4.5 5.9-8.1 5.3-10.6c-.5-2.6-3-5.4-9.1-7.6c-6.2-1.6-11.4-2.4-17.2-1.7\"/>",
    "crested-helmet": "<path fill=\"currentColor\" d=\"m207.47 18.875l35.968 162.25c.29 1.087.86 1.863 2.562 2.813c1.7.95 4.433 1.66 7.22 1.656c2.785-.003 5.543-.703 7.25-1.656c1.704-.954 2.276-1.75 2.56-2.813L299 18.875zm88.936 98.03l-15.22 68.657l-.06.22l-.032.187c-1.747 6.52-6.404 11.432-11.5 14.28s-10.738 4.026-16.344 4.03c-5.606.007-11.24-1.15-16.344-4c-5.104-2.847-9.782-7.784-11.53-14.31l-.032-.19l-.063-.218l-14.686-66.218C175 133.818 147.157 164.56 135.53 202.97a459 459 0 0 0 32.314 15.468c26.527 11.43 60.506 22.55 88.5 22.406c28.003-.145 61.81-11.56 88.156-23.22a449 449 0 0 0 32.938-16.25c-12.624-39.968-42.853-71.398-81.032-84.468zm88.97 101.376c-8.365 4.538-19.865 10.487-33.313 16.44c-27.522 12.18-62.797 24.673-95.625 24.843c-32.838.17-68.293-12-96-23.938c-13.614-5.866-25.276-11.744-33.72-16.22c-.51 70.485-3.647 138.64 9.626 188.376c7.135 26.737 18.683 47.874 37.375 62.595c12.092 9.525 27.443 16.584 47.25 20.375V330.125c-28.654 16.12-67.847 2.81-81.064-30.625c8.825-22.322 30.127-33.074 50.78-33c24.583.087 48.224 15.532 48.876 45.094h.094v89h36.03l.002-87.72q-.017-.013-.032-.03c0-.422.022-.834.03-1.25c.655-29.562 24.327-45.007 48.908-45.094c20.654-.074 41.926 10.678 50.75 33c-13.204 33.403-52.324 46.702-80.97 30.656v160.47c19.544-3.867 34.6-11 46.438-20.595c18.396-14.908 29.6-36.337 36.375-63.342c12.59-50.184 8.804-118.532 8.188-188.407z\"/>",
    "crossbow": "<path fill=\"currentColor\" d=\"m89.594 18.094l-10.75 10.75l.03.03l27.532 333.563l-83.03 92.938l33.25 33.25l90.155-80.563l336.19 24.907l.186.186l.156-.156h.032v-.03l10.562-10.564c-1.676-1.676-3.122-3.437-4.687-5.156c-21.332-25.55-25.416-63.24-35.47-109.125c-8.323-37.99-21.225-81.042-53.094-125.03l-38.062 50.81c.005.008-.005.026 0 .032c28.988 36.074 46.027 67.766 59.72 96.25c15.017 31.247 26.122 59 44.467 83.688L165.314 391.5L337.53 237.594l64.376-85.97l-41.53-41.53l-85.907 64.312L122.81 344.094L98.156 45.25c24.68 18.33 52.425 29.426 83.656 44.438c28.49 13.693 60.2 30.72 96.282 59.718l50.812-38.062c-43.99-31.86-87.04-44.736-125.03-53.063C157.987 48.224 120.3 44.113 94.75 22.78c-1.72-1.564-3.48-3.01-5.156-4.686m317.03.312c-3.385.028-6.862.406-10.28.97c-4.558.75-8.992 1.837-12.813 3.093c-3.82 1.254-6.776 2.302-9.717 4.624a7.18 7.18 0 0 0-2.72 6.187l5.032 62.345a7.18 7.18 0 0 0 2.063 4.53l33.656 33.626a7.18 7.18 0 0 0 4.5 2.095l62.344 5.03a7.18 7.18 0 0 0 6.218-2.718c2.335-2.944 3.367-5.895 4.625-9.718c1.26-3.824 2.343-8.255 3.095-12.814c.752-4.56 1.18-9.198.875-13.625c-.305-4.425-1.012-8.99-4.844-12.81L422.78 23.343c-3.822-3.824-8.384-4.54-12.81-4.844a44 44 0 0 0-3.345-.094zm.126 14.375a30 30 0 0 1 2.25.064c2.404.165 3.74.915 3.72.78l65.655 65.657c-.138-.023.616 1.318.78 3.72c.19 2.746-.062 6.526-.686 10.313c-.626 3.786-1.595 7.62-2.595 10.656c-.412 1.25-.524 1.272-.938 2.186l-54.78-4.375l-29.938-29.936l-4.376-54.813c.913-.41.94-.495 2.187-.905c3.037-.998 6.872-1.97 10.658-2.594c2.84-.466 5.662-.728 8.062-.75zm-47.97 120.44l-18.936 31.593l-204.5 204.468l-8.844-.655l-1.188-14.563l201.875-201.906l31.594-18.937z\"/>",
    "desert": "<path fill=\"currentColor\" d=\"m481.5 21.96l-45.6 12.33c2.6 5.3 4.3 11.14 4.9 17.3l45.3-12.25zm-279.3.67L200 40.51l143 17.04V56c0-5.7 1-11.17 2.8-16.26zM392 25c-17.2 0-31 13.77-31 31s13.8 31 31 31s31-13.77 31-31s-13.8-31-31-31m-43.8 52.81l-74.5 54.89l10.6 14.4L359 92.12c-4.5-4.05-8.1-8.9-10.8-14.31m73.9 16.81c-4.8 3.7-10.2 6.58-16.1 8.28l38.9 67.2l15.6-9zm-294.2.58c-.3.01-.5.02-.7.04c-3.3.32-7.7 3.47-11.8 8.76c-2.5 20.1-2.5 42.6.3 62.6l1.7 11.8l-11.9-1.7c-5.1-.7-7.11-.8-12.91-.4l-8.75.6l-.8-8.8c-.8-8.6-3.77-20.7-7.11-29.3c-3.41-2.9-5.73-3.4-7.78-3.2c-1.85.3-4.44 1.5-7.51 4.5c1.81 18.8 3.36 36.9 8.7 54.9c9.63 4.2 23.42 6.4 36.96 5.7l10-.5l-.6 10c-4.3 73.9-6.1 142.6-1 215.8c8.1 3.7 15.8 5.5 21.9 5.5c5.8 0 9.6-1.5 12-3.5c4.5-42.7.6-83.1-1.8-124.8l-.5-9.4l9.4-.1c10.7-.1 19.7-2.3 25.9-5.4c6-2.8 8.8-6.4 9.3-7.8c5.6-38.6 9.4-72.6 7.2-109.3c-.1-2.2-.7-2.9-1.8-3.8c-1-.9-3-1.7-5.2-1.8c-2.2-.2-4.6.3-6.1 1.1s-2 1.5-2.3 2.4c-9.4 31.1-17.3 62-18.6 94.7v.1l-18-.9v-.1c2.7-51 .6-104.7-2.6-156.2c-7.2-9.39-12.2-11.54-15.6-11.5m239.6 3.2l-53.9 142.9l16.8 6.4l54-143.3c-6-.9-11.8-3-16.9-6m66.4 111.7v47.8l-7.6-1.8l-4-28.2l-17.8 2.6l5.8 40.4l23.6 5.5V297h-233c-3.1 3-7.1 5.5-11.4 7.6c-6.8 3.2-15 5.6-24.2 6.6c2.5 39.2 5.8 78.9.9 121.7l-.2 2.4l-1.5 2c-6.4 8.5-17 12.2-27.9 12.2c-11 0-22.9-3.3-34.8-9.7l-4.41-2.3l-.36-4.9C93.6 386.2 93 341.8 94.04 297H25v190h462V297h-35.1v-38.5l23-5.3l4.8-24.8l-17.6-3.4l-2.6 13.2l-7.6 1.7v-29.8z\"/>",
    "diamond-ring": "<path fill=\"currentColor\" d=\"m191.02 25.346l-22.9 34.35h30.714l22.9-34.35zm52.347 0l-22.898 34.35h71.06l-22.897-34.35zm46.9 0l22.9 34.35h30.714l-22.9-34.35zm-117.234 52.35l50.115 50.115l-25.058-50.115zm45.182 0L256 153.265l37.785-75.57h-75.57zm95.695 0l-25.058 50.115l50.115-50.115zm-134.435 31.898C109.163 139.5 59.693 209.29 59.693 290.348c0 108.185 88.122 196.306 196.307 196.306s196.307-88.12 196.307-196.306c0-81.057-49.47-150.848-119.782-180.754l-30.517 30.517c64.397 19.592 111.037 79.292 111.037 150.238c0 86.966-70.08 157.045-157.045 157.045c-86.966 0-157.045-70.08-157.045-157.045c0-70.946 46.64-130.646 111.037-150.237l-30.517-30.516z\"/>",
    "drum": "<path fill=\"currentColor\" d=\"M476.865 25.514L282.941 145.422l19.32 9.215L486.333 40.822l-9.467-15.308zM73.6 65.508l-7.748 16.246l286.595 136.709l1.389 2.715c3.244 6.346 9.677 12.524 17.723 16.373l.003.002l.004.002c8.566 4.084 17.188 5.364 23.63 4.373c6.443-.992 10.352-3.63 12.523-8.18s1.665-8.39-1.725-13.603s-10.122-10.882-18.935-15.086c-8.063-3.843-16.927-4.961-23.91-3.487l-2.983.63zm121.097 97.65c-40.936 2.913-77.435 8.644-106.084 16.283c-21.165 5.644-38.06 12.392-48.953 19.26S25 211.723 25 216s3.767 10.43 14.66 17.299s27.788 13.616 48.953 19.26C130.943 263.847 190.374 271 256 271c49.18 0 94.88-4.017 132.512-10.781c-8.123-.325-16.546-2.53-24.703-6.422l-.002-.002l-.004-.002c-10.2-4.878-18.614-12.38-24.135-21.484l-72.705-34.68l-36.498 22.566c-4.5 9.65-12.051 18.021-21.662 23.977l-.002.002l-.004.002c-10.715 6.625-22.297 10.072-33.281 9.588c-10.985-.484-21.794-5.485-27.856-15.29c-6.062-9.803-5.366-21.696-.515-31.294c4.85-9.598 13.3-17.76 23.785-24.243l.002-.001h.002c9.63-5.951 20.504-8.973 31.16-8.688l6.904-4.27l-14.3-6.82zm127.432.36l-.545.336l41.3 19.7c10.563-1.44 21.702.385 31.92 5.257h.005c11.125 5.306 20.412 12.504 26.275 21.52c5.863 9.014 7.844 20.763 2.88 31.167c-3.08 6.457-8.178 11.27-14.2 14.395c4.699-1.07 9.273-2.174 13.623-3.334c21.165-5.644 38.06-12.392 48.953-19.26S487 220.277 487 216s-3.767-10.43-14.66-17.299s-27.788-13.616-48.953-19.26c-27.516-7.337-62.286-12.91-101.258-15.923m-93.81 15.677l-21.499 13.293l-3.033-.3c-7.102-.708-15.793 1.364-23.39 6.058l-.002.002c-8.305 5.135-14.382 11.502-17.186 17.05c-2.804 5.55-2.89 9.422-.238 13.71c2.651 4.288 6.822 6.486 13.336 6.773c6.513.287 14.949-1.923 23.023-6.916c7.58-4.699 13.305-11.538 15.842-18.199l1.086-2.85l31.383-19.404zM39.642 253.912l26.941 44.9l33.31-24.982a409 409 0 0 1-15.92-3.879c-17.352-4.627-32.253-9.928-44.331-16.039m432.714 0c-12.078 6.11-26.98 11.412-44.332 16.04c-6.926 1.846-14.283 3.565-21.949 5.175l38.926 24.377zM487 264.492l-17.576 29.293a91 91 0 0 0 2.209-.97c5.948-2.72 10.255-5.583 12.627-7.944S487 281.188 487 280zm-462 .002V280c0 1.188.369 2.51 2.74 4.871s6.679 5.224 12.627 7.943q1.07.49 2.207.971zm98.639 14.027l-36.737 27.553c1.874.36 3.74.72 5.674 1.065c21.728 3.862 47.224 6.792 74.612 8.775l-36.143-36.143a574 574 0 0 1-7.406-1.25m233.996 4.538c-23.345 2.877-48.603 4.787-75.155 5.552l37.08 27.809zm27.261.045l-37.195 32.59c26.286-1.979 50.764-4.83 71.723-8.555c1.011-.18 1.972-.373 2.967-.557zm-224.369.697l32.317 32.316l36.676-27.506c-24.226-.698-47.389-2.342-68.993-4.81M256 291.25l-36.322 27.242c12.024.332 24.171.508 36.322.508c12.15 0 24.298-.176 36.322-.508zM25 305.121V440c0 5.5 4.3 11.699 16.09 18.436c3.953 2.259 8.63 4.452 13.91 6.554V317.13c-8.28-2.377-15.693-5.007-22.117-7.943c-2.813-1.287-5.44-2.63-7.883-4.065zm462 0c-2.443 1.435-5.07 2.778-7.883 4.065c-6.424 2.936-13.838 5.566-22.117 7.943V464.99c5.28-2.103 9.957-4.295 13.91-6.554C482.7 451.699 487 445.5 487 440zM73 321.63v149.488c6.196 1.816 12.868 3.523 19.953 5.098c25.716 5.714 56.789 9.79 90.047 12.2V334.978c-34.264-1.945-66.46-5.297-93.576-10.118A430 430 0 0 1 73 321.63m366 0a430 430 0 0 1-16.424 3.232c-27.115 4.82-59.312 8.173-93.576 10.118v153.435c33.258-2.409 64.331-6.485 90.047-12.2c7.085-1.574 13.757-3.281 19.953-5.097zm-238 14.24v153.684a1039 1039 0 0 0 55 1.445c18.483 0 36.972-.485 55-1.445V335.87c-18.053.752-36.52 1.129-55 1.129s-36.947-.377-55-1.129\"/>",
    "elephant": "<path fill=\"currentColor\" d=\"M236.422 98.393c-126.642-1.276-206.07 46.77-212.058 83.93c-2.977 41.18-4.165 83.628-4.016 124.617l4.31 3.796c3.963-15.315 6.47-31.843 14.122-44.085c1.3 27.18 5.068 58.562 11.369 82.067c-2.477 24.988-2.118 47.99-3.436 72.978c21.158 12.726 60.485 10.65 67.541 1.986c2.936-20.695 4.981-42.58 3.973-68.535l7.592-35.355c6.418-14.587 25.29-17.243 23.406-31.799l17.828-2.467c.355 25.196-14.375 27.1-24.713 41.653c12.994 5.357 14.676 3.886 24.059 5.124c23.848 2.742 45.234 3.774 67.802-8.175l-3.101-17.541l17.723-3.135l3.064 17.328c4.22 14.097 11.996 104.392 18.559 108.361c13.411 6.417 53.823 6.417 55.472-5.312c1.647-45.786 3.861-90.1-5.07-133.242c3.702-4.1 7.34-8.112 10.928-12.096c-20.178-10.157-44.214-25.838-57.62-41.797c-9.037-17.21-13.75-38.688-17.304-56.256c-2.546-12.943-4.3-26.074-3.81-37.486c.244-5.706 1.003-11.018 2.982-15.938c19.848-20.186 56.606-35.68 79.58-46.503c-33.273-7.269-71.55 7.386-99.182 17.882m128.934-9.931c-29.757 10.977-72.215 22.174-92.633 45.267c-.807 2.008-1.51 5.563-1.7 9.994c-.38 8.863 1.097 21.093 3.487 33.243s5.644 24.32 8.53 33.642c1.442 4.662 2.797 8.624 3.865 11.44c15.216 22.215 45.646 39.625 67.966 44.959l14.495-28.713c-11.574-15.04-13.779-35.226-4.59-50.352c4.932-6.143 9.727-10.553 16.982-10.416c4.545.109 9.194 1.996 12.856 5.045c25.905 21.572 49.481 48.69 83.37 70.66c-.136-6.626-.26-12.94-.243-18.761c.026-9.03-18.924-97.759-50.614-139.553c-22.918-5.83-40.343-9.14-61.771-6.455m68.883 76.232c4.327-.07 8.421.563 11.857 2.319c.061 4.922-.298 10.035-10.887 16.152c-4.501-4.72-11.239-10.838-17.908-15.627c5.427-1.506 11.374-2.754 16.938-2.844m-54.233 32.838c-2.263 3.593-3.912 11.657-2.703 17.531c1.402 6.812 9.062 16.901 21.55 26.47c12.49 9.567 29.242 18.77 46.753 26.087c15.609 6.522 31.748 11.435 46.058 14.19c-49.78-25.118-79.482-61.19-108.566-85.409c-1.548-1.595-2.387.034-3.092 1.131m58.914 86.797c.526 23.427-2.416 50.265-17.086 59.894c-11.128 7.306-33.235 1.34-38.41-10.925c-3.657-8.667 15.567-15.677 13.408-24.832c-1.718-7.287-11.033-14.374-18.375-12.912c-17.881 3.558-34.905 28.836-29.3 46.185c10.14 31.387 62.177 51.105 91.875 36.75c27.49-13.288 35.058-46.714 36.808-81.19c-12.704-3.13-25.983-7.579-38.92-12.97m-200.681 52.52a129 129 0 0 1-9.993 4.34l-8.67 77.603c1.22 8.802 15.819 12.647 30.385 12.81zm-100.65 4.519c-1.341 10.733-2.367 21.785-3.073 30.953c-1.545 20.225-2.483 41.562-2.496 51.49c18.869 11.927 54.798 4.533 53.105-2.005c-.656-27.278-6.002-49.806-12.58-73.717c-11.983-1.258-23.524-3.864-34.957-6.721z\"/>",
    "farmer": "<path fill=\"currentColor\" d=\"m379.42 24.066l-28.059 87.407l28.268 5.941l-3.098 15.352l-52.25 47.843l-51.5-43.125l-23.404-4.093c8.217-14.33 14.683-32.77 16.404-49.594c10.02-2.28 34.92-5.675 46.094-10.059c-4.997-10.285-30.197-16.906-48.7-16.316c-1.733-20.713-8.88-29.054-34.155-27.902c-25.276 1.151-32.972 6.601-30.16 36.423c-18.866 4.127-38.097 12.616-39.74 27.084c7.87-.307 32.96-2.896 40.724-3.011c.66 14.1 4.4 27.847 9.97 36.375l-35.158-6.125L106 195.922l77.344 55.875l1.625 16.844l-34.19 215.75h38.375l38.315-169.25l47.873 169.25h37.47l-3.564-16.407l17.094 16.407l63.062-322.532c5.01-4.54 9.265-8.481 12.094-11.312c.177-10.537-2.537-18.942-5.094-24.5l.971-4.902l27.238 5.724l8.444-93.117l-22.846 68.781l-10.848-2.256l6.635-72.658l-21.568 69.55l-11.217-2.333zm26.578 3.553l.002-.01h-.002zM182.844 153.39l.344 64.095l-31.5-23.75zm88.031 21.252l50.875 45.937s22.993-19.456 44.875-38.531L309.187 467.61l-42.812-197.529z\"/>",
    "gauntlet": "<path fill=\"currentColor\" d=\"M123.153 24.602c-11.349.764-48.792 83.005-63.545 132.174c-8.046 26.818 2.983 74.734 41.723 106.45c8.813-1.502 16.946-3.047 24.434-4.626c-22.473-24.22-39.048-50.488-47.772-82.059l-1.021-3.699l1.963-3.299c26.135-43.925 37.681-68.548 50.85-112.24l3.849-12.773l10.402 8.351c14.624 11.743 23.72 18.084 32.098 21.809c-14.428-22.99-31.841-41.36-52.46-50.06a2.2 2.2 0 0 0-.52-.028zm19.791 50.203c-11.724 36.176-24.141 62.49-46.508 100.379c9.004 29.978 25.746 54.616 49.733 78.65c18.744-4.857 32.588-9.929 43.383-14.978c16.875-7.894 26.514-15.73 36.92-23.701c-6.532-34.91-18.944-80.14-38.018-118.375c-14.754-2.769-27.196-8.373-45.51-21.975m90.094 158.008c-9.156 7.022-19.796 14.833-35.861 22.347c-17.365 8.123-40.947 15.887-76.29 22.793c35.349 28.759 64.905 62.213 112.643 82.157c2.79-15.613 10.509-29.532 20.61-39.782c9.547-9.688 21.609-16.383 34.252-16.82c2.202-5.202 5.378-10.557 10.593-14.93c6.41-5.374 15.626-8.323 26.932-8.156a35 35 0 0 1 4.807-5.424c-7.384-1.603-16.19-3.168-27.145-5.586zm120.275 50.299c-.04.009-.084.012-.125.021c-11.264 3.729-12.514 6.776-16.947 16.078c-8.484-1.005-19.247-2.081-25.69 3.16c-6.017 6.313-7.279 12.696-9.685 20.715c-14.012-3.276-25.77 1.842-33.904 9.877c-8.032 8.15-14.35 20.016-16.082 32.65c5.926 2.628 12.109 4.214 18.139 5.727c12.69-15.498 32.27-33.513 50.66-36.851c12.995-13.444 28.669-18.08 41.183-19.891a60 60 0 0 1 11.764-8.4c-6.632-11.786-12.405-18.622-19.313-23.086m-232.011 18.882c-1.967 12.934-7.997 24.573-.64 46.305c32.36 70.655 41.042 23.73 93.735 22.953c-38.944-18.938-66.126-45.737-93.095-69.258m267.765 17.102c-4.87.972-9.343 3.536-13.062 6.28c9.197 12.249 16.987 27.313 23.28 43.81c7.916-2.052 14.75-4.612 21.103-7.506c-6.473-26.762-18.951-37.976-31.32-42.584zm-29.935 13.906c-7.676 1.509-15.588 4.36-22.774 10.35c8.367 8.844 20.976 24.773 26.053 43.283c7.632-1.268 15.91-3.698 21.006-8.576c-6.608-17.858-15.058-33.73-24.285-45.057m-38.139 19.668c-14.313 5.357-25.257 14.981-34.674 25.938l19.383 26.324c13.696-1.49 26.639-6.254 39.39-13.299c-4.69-15.098-18.62-32.912-24.447-38.607zm108.848 24.365c-6.679 3.099-13.973 5.985-22.237 8.375c6.323 10.32 11.618 21.138 15.602 32.543c7.703-3.07 14.902-6.372 21.264-10.082c-3.964-11.28-8.68-22.055-14.63-30.836zM164.687 408.39l49.638 43.377c11.274-13.516 27.044-23.94 42.492-33.942l-22.02-25.32c-24.334-8.01-52.756 2.355-70.11 15.885M391.9 394.153c-6.866 5.056-14.143 7.727-21.795 9.377c5.371 9.31 10.375 19.502 14.354 29.755c7.946-2.139 15.451-4.432 22.344-7.775c-3.648-10.897-8.68-21.303-14.903-31.357m-39.88 14.105c-11.759 6.313-24.191 11.162-37.42 13.545l13.316 27.447c14.663-2.177 28.099-3.684 39.666-9.746c-4.195-10.706-9.777-21.706-15.563-31.246zm98.017 17.156c-6.627 3.604-13.647 6.703-20.846 9.534c2.83 7.167 5.28 14.119 7.21 20.757c10.397-1.435 20.263-5.912 18.179-13.869c-1.423-5.296-2.923-10.83-4.543-16.422M268.82 431.54c-16.062 10.564-31.09 20.975-40.728 32.256l1.392 1.217c16.648 14.548 36.256 20.475 44.95 9.13c8.522-11.12 10.536-24.116-5.614-42.603m144.01 10.957c-7.166 3.334-14.4 5.634-21.465 7.58c3.051 6.991 5.842 13.849 8.244 20.48c9.2-.457 17.732-4.025 19.33-10.442c-1.622-5.49-3.688-11.409-6.109-17.618m-38.437 13.69c-12.724 6.396-25.866 8.467-38.184 10.154l6 12.367c10.038 10.705 32.656 11.336 42.21 2.944c-2.654-7.907-6.1-16.516-10.026-25.465\"/>",
    "gem-chain": "<path fill=\"currentColor\" d=\"M144.2 19.03c-10.7 0-20.3 5.36-26.1 13.52c-14.1-1.15-28.27-.24-41.2 3.44c-5.9-6.63-14.5-10.81-24-10.81c-17.6 0-32.1 14.49-32.1 32.12c0 9.8 4.5 18.62 11.5 24.53c-2 10.17-1.9 19.47-.2 27.97c-8.1 5.8-13.3 15.3-13.3 25.9c0 17.6 14.5 32.1 32.1 32.1c8.1 0 15.6-3 21.2-8.1c4.7 3.1 9.4 6 14.3 8.9c-.3 1.5-.4 3.1-.4 4.7c0 17.6 14.5 32.1 32.1 32.1c5.7 0 11.1-1.5 15.7-4.2c3.7 3.5 7 7.2 10 11.1c-5.7 5.8-9.2 13.7-9.2 22.4c0 15.2 10.8 28 25 31.3c-.3 7-1.2 14.6-2.9 22.9c-7.7 7.6-12.5 18.2-12.5 29.8c0 11.4 4.6 21.8 12 29.4l-13.4 113.3l24.7-36.3c3.4-28.2 6.8-57 9.6-81.2c11.9-5.4 21.6-10 32.4-14.8c27.1 11.4 51.2 22.2 75.2 32.3l41.2-2l-97.7-42.1c-.4-12.8-6.7-24.2-16.1-31.6c6.1-12.4 12.5-22.5 19.5-30.7c3.8 1.7 8.1 2.6 12.6 2.6c17.6 0 32.1-14.5 32.1-32.1c0-.9 0-1.8-.1-2.6c7.3-3 14.9-5.6 22.8-8.1c5.7 8.9 15.7 14.8 26.9 14.8c17.7 0 32.1-14.5 32.1-32.2v-.7c7.5-2.7 15.1-5.9 22.8-9.5c5.9 6.9 14.7 11.4 24.4 11.4c17.6 0 32.1-14.5 32.1-32.2c0-4.8-1.1-9.5-3.1-13.7c6.4-5.3 12.9-11.5 17.7-17.6c2.9.9 6 1.3 9.2 1.3c17.6 0 32.1-14.5 32.1-32.1c0-17.1-13.6-31.26-30.5-32.09c-11-16.49-34.3-24.49-49.5-20c-5.9-7.82-15.3-12.91-25.7-12.91c-17.7 0-32.2 14.5-32.2 32.13c0 2.67.4 5.29 1 7.78c-4.6 1.48-9.3 2.69-14.2 3.69c-4.7-11.96-16.4-20.5-29.9-20.5c-14.3 0-26.4 9.4-30.6 22.28c-8.1-.99-16.7-2.39-23.7-3.81c-.6-17.08-14.8-30.88-32.1-30.88c-10.5 0-20 5.2-25.8 13.16c-8.2-3.29-16.1-6.82-23.7-10.56v-1.44c0-17.63-14.5-32.12-32.1-32.12m0 18.67c7.5 0 13.4 5.91 13.4 13.44s-5.9 13.44-13.4 13.44s-13.5-5.91-13.5-13.44s6-13.44 13.5-13.44m-91.3 6.16c7.6 0 13.5 5.91 13.5 13.44s-5.9 13.43-13.5 13.43c-7.5 0-13.4-5.9-13.4-13.43s5.9-13.44 13.4-13.44m59.2 7.09v.19c0 17.63 14.5 32.13 32.1 32.13c10.5 0 19.9-5.12 25.8-13c7.6 3.72 15.6 7.25 23.7 10.53v1.28c0 17.63 14.5 32.12 32.1 32.12c11.5 0 21.6-6.1 27.3-15.25c10.1 1.85 19.1 3.65 28.2 4.55c4 13.3 16.3 23.1 30.9 23.1c15.1 0 27.9-10.7 31.2-24.9c7.9-1.5 15.5-3.5 22.9-6.15c5.7 4.95 13.1 8.05 21.2 8.05c17.6 0 32.1-14.55 32.1-32.18v-1.75c10.2-1.39 18.6 2.07 23.9 7.81c-8.7 5.77-14.6 15.65-14.6 26.82c0 7.8 2.8 14.8 7.5 20.5c-4.7 5.5-9.6 9.7-14.7 14.1c-4.8-2.9-10.5-4.6-16.5-4.6c-17.6 0-32.1 14.5-32.1 32.1c0 1.3.1 2.5.2 3.8c-7.1 3.3-14.2 6.2-21.2 8.8c-5.8-8.3-15.4-13.7-26.2-13.7c-17.4 0-31.8 14.2-32.1 31.6c-8.2 2.5-16.3 5.5-24.3 8.9c-5.9-7.5-15.1-12.4-25.3-12.4c-17.6 0-32.1 14.4-32.1 32.1c0 6.6 2 12.8 5.5 17.9c-8.1 9.4-15.6 20.7-22.4 34.3c-6.1-1.2-12.2-1.4-17.8 0c.5-4.5.8-8.9.8-13c12-4.7 20.6-16.4 20.6-30c0-17.6-14.5-32.1-32.1-32.1q-3.3 0-6.3.6c-4.1-5.7-8.7-10.8-13.6-15.5c2.2-4.4 3.4-9.3 3.4-14.4c0-17.7-14.5-32.1-32.1-32.1c-9.3 0-17.7 4-23.6 10.4c-4.3-2.7-8.5-5.3-12.5-7.9c.7-2.6 1-5.2 1-8c0-17.6-14.5-32.1-32.1-32.1c-.5 0-1 0-1.5.1c-.6-4.35-.4-9.07.5-14.43q1.5.15 3 .15c17.7 0 32.2-14.49 32.2-32.12c0-1.38-.1-2.76-.3-4.09c9.13-2.16 18.4-2.75 27.3-2.26m275.4 7.04c7.5 0 13.4 5.9 13.4 13.43s-5.9 13.44-13.4 13.44c-7.6 0-13.5-5.91-13.5-13.44s5.9-13.43 13.5-13.43M225.8 68.67c7.6 0 13.4 5.88 13.4 13.41s-5.8 13.43-13.4 13.43c-7.5 0-13.4-5.9-13.4-13.43s5.9-13.41 13.4-13.41m86.4 12.41c7.5 0 13.4 5.87 13.4 13.4c0 7.62-5.9 13.52-13.4 13.52c-7.6 0-13.5-5.9-13.5-13.52c0-7.53 5.9-13.4 13.5-13.4m148.9 9.78c7.5 0 13.4 5.91 13.4 13.44c0 7.6-5.9 13.4-13.4 13.4c-7.6 0-13.4-5.8-13.4-13.4c0-7.53 5.8-13.44 13.4-13.44M50.9 122.2c7.5 0 13.5 6 13.5 13.5s-6 13.5-13.5 13.5s-13.4-6-13.4-13.5s5.9-13.5 13.4-13.5M405.2 153c7.5 0 13.5 5.9 13.5 13.4c0 7.6-6 13.5-13.5 13.5s-13.4-5.9-13.4-13.5c0-7.5 5.9-13.4 13.4-13.4m-287.1 6.8c7.5 0 13.5 5.9 13.5 13.5c0 7.5-6 13.4-13.5 13.4s-13.4-5.9-13.4-13.4c0-7.6 5.9-13.5 13.4-13.5M325.9 184c7.6 0 13.4 5.9 13.4 13.4c0 7.6-5.8 13.5-13.4 13.5c-7.5 0-13.4-5.9-13.4-13.5c0-7.5 5.9-13.4 13.4-13.4m-81.7 28.1c7.5 0 13.4 5.8 13.4 13.4c0 7.5-5.9 13.4-13.4 13.4s-13.4-5.9-13.4-13.4c0-7.6 5.9-13.4 13.4-13.4m-77.5 9.1c7.5 0 13.4 6 13.4 13.5s-5.9 13.4-13.4 13.4s-13.4-5.9-13.4-13.4s5.9-13.5 13.4-13.5m19.5 74.2c8.1 1.1 17.1 5.2 20.9 12.9c-20.1 7.4-29.6 10.8-43.5 16.3c-1.8-10.9-.4-20.2 10-25.5c3.9-2 8.3-4.3 12.6-3.7m23.5 54.1l-15.3 7l-7 59.9l52.3 3.2l23.5-47.1zm129.2 28l-58.7 2.9l-24.9 49.9l30.2 54.3zm-155.5 57.4l-34.6 50.8l120 7.3l-30.5-54.8z\"/>",
    "gem-necklace": "<path fill=\"currentColor\" d=\"M26.537 18.69c-5.14 13.737 1.93 32.374 21.42 32.374c1.11 0 2.175-.07 3.205-.185c-14.21 12.198-9.28 41.503 15.158 41.503c3.21 0 6.075-.513 8.612-1.418c-7.113 13.846-.416 34.93 20.31 34.93c5.08 0 9.312-1.273 12.71-3.39c-5.43 13.773 1.582 32.77 21.26 32.77c3.985 0 7.446-.785 10.395-2.142c-2.018 11.57 3.74 24.662 17.375 27.35l-55.47 76.296l169.78 233.525L441.067 256.78L364.97 152.11c13.87-2.34 19.88-15.235 18.147-26.84c1.81.403 3.756.625 5.852.625c20.725 0 27.42-21.084 20.307-34.93c2.537.905 5.403 1.418 8.612 1.418c24.436 0 29.365-29.305 15.157-41.504c1.03.115 2.095.184 3.205.184c19.49 0 26.56-18.637 21.42-32.375h-42.84c-3.445 9.207-1.397 20.607 6.19 27.13a28 28 0 0 0-3.133-.175c-20.563 0-27.425 21.08-20.367 34.925c-2.524-.904-5.373-1.414-8.554-1.414c-17 0-24.62 14.408-22.767 27.225a26.6 26.6 0 0 0-5.832-.628c-10.137 0-16.94 5.126-20.39 11.982L298.366 60.5L271.29 23.256l-7.558 10.394l-81.398 111.96c-3.543-6.543-10.237-11.366-20.068-11.366c-3.973 0-7.43.792-10.38 2.162c2.21-12.973-5.388-27.87-22.673-27.87c-5.053 0-9.275 1.28-12.67 3.405c5.38-13.772-1.77-32.784-21.3-32.784c-3.184 0-6.034.51-8.56 1.416c7.06-13.846.2-34.927-20.363-34.927a28 28 0 0 0-3.134.175c7.588-6.523 9.636-17.923 6.19-27.13zm271.83 73.59l38.38 52.788L326 185.18a45.3 45.3 0 0 0-8.377-.795c-3.85 0-7.593.504-11.203 1.422l-20.498-76.41zm-26.578 36.558l17.48 65.16c-4.572 3.337-8.695 7.403-12.225 12.022c-3.006 3.932-5.625 8.27-7.824 12.927l-44.646-25.168l47.215-64.942zm79.095 35.68l32.416 44.587l-17.308 9.772c-2.192-4.632-4.8-8.947-7.79-12.86c-4.17-5.453-9.16-10.144-14.75-13.76l7.433-27.74zm-33.262 38.554c9.644 0 18.64 5.02 25.73 14.297c7.092 9.277 11.81 22.688 11.81 37.696c0 15.01-4.72 28.42-11.81 37.7c-7.094 9.278-16.086 14.296-25.73 14.296s-18.638-5.018-25.73-14.296c-7.092-9.28-11.813-22.69-11.813-37.7c0-15.007 4.72-28.42 11.813-37.697c7.092-9.28 16.086-14.298 25.73-14.298zm-104.11 5.924l49.716 28.03a88.8 88.8 0 0 0-1.84 18.04c0 7.44.913 14.623 2.606 21.395L213.72 304.85l-34.947-48.07l34.74-47.782zm180.85 15.324l23.598 32.46l-23.73 32.642l-22.982-12.955c1.694-6.774 2.606-13.958 2.606-21.4c0-6.252-.647-12.32-1.854-18.12zm-123.666 69.82c1.87 3.546 3.988 6.888 6.348 9.975c3.883 5.08 8.48 9.495 13.607 13l-18.314 68.36l-47.555-65.41l45.914-25.924zm93.85.003l18.62 10.498l-32.774 45.08l-8.313-30.988c6.148-3.716 11.614-8.72 16.12-14.617a71 71 0 0 0 6.347-9.972zm-56.576 30.55c3.13.682 6.352 1.06 9.653 1.06c2.323 0 4.604-.2 6.846-.542l11.79 43.948l-37.893 52.12l-11.89-16.356z\"/>",
    "gem-pendant": "<path fill=\"currentColor\" d=\"M29.018 18.875c-2.63 10.297.047 21.72 8.044 29.72c10.035 10.034 25.46 11.696 37.29 5a605 605 0 0 0 17.357 15.12a30.6 30.6 0 0 0-.522 5.597c0 17.024 14.008 31 31.03 31c4.917 0 9.576-1.17 13.72-3.24a689 689 0 0 0 17.482 11.48a30.7 30.7 0 0 0-.732 6.635c0 17.024 14.008 31 31.03 31c7.577 0 14.55-2.772 19.964-7.345l13.873 8.125a28 28 0 0 0-.414 4.732v38.904L114.07 255.27v160.064l138.284 80.053l138.283-80.053V255.27L286.59 195.037V156.7c0-.983-.067-1.946-.172-2.897c5.393-3.07 10.655-6.08 15.697-8.994c5.226 3.992 11.736 6.377 18.762 6.377c17.023 0 31-13.976 31-31c0-1.867-.176-3.695-.498-5.476a621 621 0 0 0 17.978-12.298c3.97 1.855 8.38 2.9 13.02 2.9c17.023 0 31.03-13.976 31.03-31a30.7 30.7 0 0 0-.553-5.78a912 912 0 0 0 16.318-14.116c11.6 5.714 26.135 3.778 35.736-5.822c7.998-7.998 10.675-19.42 8.045-29.72H452.54c4.018 4.888 3.736 11.916-.85 16.5c-4.887 4.888-12.55 4.89-17.437 0c-4.585-4.585-4.867-11.614-.85-16.5h-20.414c-1.915 7.5-1 15.592 2.72 22.528a890 890 0 0 1-12.034 10.434c-5.575-5.288-13.083-8.555-21.297-8.555c-17.024 0-31.03 14.01-31.03 31.032c0 5.45 1.438 10.583 3.948 15.05a601 601 0 0 1-12.797 8.673c-5.6-5.48-13.24-8.88-21.62-8.88c-17.025 0-31.032 14.01-31.032 31.032c0 3.166.484 6.225 1.383 9.11c-4.23 2.445-8.744 5.028-13.247 7.605a28 28 0 0 0-3.246-2.716c-6.692-4.768-14.72-6.882-22.714-7.014c-7.996-.132-16.15 1.718-22.97 6.504a26 26 0 0 0-2.337 1.85c-4.367-2.573-8.764-5.164-12.947-7.622c.642-2.47.984-5.056.984-7.716c0-17.024-14.007-31.032-31.03-31.032c-7.977 0-15.29 3.075-20.812 8.094a692 692 0 0 1-13.248-8.596a30.66 30.66 0 0 0 3.56-14.34c0-17.025-13.977-31.033-31-31.033c-8.26 0-15.804 3.304-21.388 8.642a586 586 0 0 1-13.79-12.067c3.063-6.575 3.715-14.03 1.94-20.98H68.568c4.018 4.887 3.736 11.915-.85 16.5c-4.887 4.887-12.55 4.888-17.437 0c-4.584-4.586-4.865-11.615-.848-16.5H29.018zm93.2 43.094c6.924 0 12.313 5.42 12.313 12.343s-5.387 12.312-12.31 12.312c-6.926 0-12.345-5.39-12.345-12.313s5.42-12.343 12.344-12.343zm260.157 0c6.924 0 12.344 5.42 12.344 12.343s-5.42 12.312-12.345 12.312c-6.924 0-12.344-5.39-12.344-12.313s5.42-12.343 12.345-12.343zM183.72 107.843c6.922 0 12.343 5.42 12.343 12.344s-5.42 12.312-12.344 12.312c-6.926 0-12.345-5.39-12.345-12.313s5.42-12.343 12.344-12.343zm137.155 0c6.924 0 12.313 5.42 12.313 12.344s-5.39 12.312-12.313 12.312s-12.344-5.39-12.344-12.313s5.42-12.343 12.345-12.343zm-69.164 38.013c4.695.078 9.355 1.536 12.18 3.55c2.826 2.012 4.01 3.805 4.01 7.292v27.52l-15.546-9l-16.526 9.565V156.7c0-4.09 1.258-5.835 3.953-7.725c2.696-1.89 7.237-3.195 11.93-3.118zm-8.122 56.03v32.728l-74.182 43.21l-28.558-16.462zm18.687.67l102.16 59.138l-28.624 16.502l-73.533-42.83zm-9.988 48.62l72.256 42.085l-.002 84.316l-72.253 42.086l-72.256-42.086l.003-84.314l72.254-42.088zm.465 18.33l-56.883 98.15v.724l56.566 32.977L309 368.38v-66.085zm-119.994 8.764l28.586 16.48v84.027l-28.586 16.48V278.272zm239.19.668l-.003 115.648l-28.715-16.553v-82.54zM333.493 393.99l28.414 16.38l-99.63 57.677v-32.574zm-161.77.375l71.864 41.86v32.494l-100.21-58.013l28.345-16.342z\"/>",
    "grass": "<path fill=\"currentColor\" d=\"m18 494l36.35-330.4c6.728 107.62 4.086 231.82 35.556 295.67c11.205-84.926 15.707-168.18 10.562-249.01c15.225 71.69 35.543 141.68 39.468 217.14c7.395-55.935 12.667-111.52 31.798-169.41c-.76 65.19-17.16 124.9 12.677 157.47c14.433-51.01 28.992-101.9 31.46-164.88c21.27 61.862 18.342 135.82 24.948 205.02c8.417-68.06 15.28-257.84 46.907-318.17c-3.11 124.98-3.862 223.94 27.398 274.23c30.897-38.673 33.566-114.44 34.28-186.34c21.812 61.75 36.457 132.1 37.857 218.34c8.626-71.955 18.667-143.91 43.39-215.86c-5.748 88.29-1.284 156.95 19.525 194.17c13.76-55.55 25.504-111.1 29.12-166.66c18.42 82.78 13 159.59 16.706 238.69z\"/>",
    "hand-saw": "<path fill=\"currentColor\" d=\"m430 34.438l-296.563 238.5l20 20.437l3.844 3.906l-1.718 5.22l-6.718 20.22l42.906 46.374l32.78-34.97l5.75-27.937l26.532-6.468l4.063-24.814l24.188-5.312l1.593-22.156l26.22-7.532l3.03-20.78l22.125-6.064l6.47-21.562l21.75-8.5l6.25-18.28l17.5-7.095l4.22-16.125l17.53-7.063l3.5-15.5l17.28-6.624l3.845-17.188l15.844-3.813l2.5-17.187l14.5-.97l16.874-18zM113.03 277.813L28.938 339c15.382 51.32 48.128 92.382 86.876 130.906l71.656-78.875L132 331.064l-3.594-3.907l1.656-5.062l6.688-20.063l-23.72-24.217zm-17.78 32.093l5.25 5.688l63.78 69.375l5.657 6.124l-5.718 6.094l-37.814 40.53l-13.187 14.094l-2.314-19.156c-4.643-38.057-20.223-65.16-52.875-81.406l-13.81-6.875L57 335.72l31.844-21.5z\"/>",
    "horse-head": "<path fill=\"currentColor\" d=\"M236.156 19.906c-27 .295-52.444 5.788-75.75 15.938L210.22 141.5c9.623-5.683 20.014-10.723 31.186-15.03L258.47 20.843a215 215 0 0 0-22.314-.938zm40.813 3.407l-15.564 96.468c16.898-4.827 35.387-8.166 55.53-9.81l2.377-.19l68.03-41.843c-37.876-23.798-75.08-38.45-110.374-44.624zM143.655 44.156C124.946 54.62 107.858 68.31 92.812 84.97c-8.682 9.613-16.686 20.277-23.937 31.905l85.813 74.28a188.6 188.6 0 0 1 39.78-39.28l-50.812-107.72zm170 84.97c-98.41 9.502-148.772 59.09-172.437 127.718c-23.358 67.732-18.883 154.58-1.814 235.97l232.22-.002c-13.15-51.313-36.813-75.542-55.532-96.53c-10.04-11.257-19.156-21.87-22.75-35.97c-2.973-11.657-1.41-24.738 5.156-40c-11.903-3.81-26.067-3.973-43.125.188l-4.406-18.156c29.26-7.137 55.266-3.473 74.874 11.28c18.24 13.725 30.198 36.15 36.437 65.188c26.094 4.41 55.303 7.784 89.595 9.5c4.537-30.6 15.487-60.877 30.875-90.875c-66.84-50.032-120.642-107.877-169.094-168.312zm-254.25 4.28c-12.305 23.56-21.735 50.528-27.75 80.563l93.28 32.968c5.143-14.15 11.484-27.632 19.19-40.22zm220.938 42.344c13.897 0 25.156 11.26 25.156 25.156c0 13.898-11.26 25.156-25.156 25.156c-13.897 0-25.156-11.258-25.156-25.156s11.26-25.156 25.156-25.156M28.406 232.625c-3.147 21.435-4.62 44.283-4.218 68.438l84.75 16.375c2.073-18.17 5.39-35.827 10.218-52.72zm-3.5 87.594c.968 17.276 2.856 35.174 5.75 53.655l75.688 1.47c-.246-13.2.05-26.307.906-39.19L24.906 320.22zm9 72.405c3.113 16.454 7.015 33.356 11.72 50.656l65.25-6.842c-1.765-14.152-3.054-28.315-3.814-42.407l-73.156-1.405zm79.53 62.344l-62.592 6.56a769 769 0 0 0 9.906 30.69h59.344a757 757 0 0 1-6.656-37.25z\"/>",
    "hourglass": "<path fill=\"currentColor\" d=\"M92.656 19.188v41.5h331.72v-41.5zM119.5 79.374V433.53h22.28V79.376H119.5zm46.594 0c3.212 43.324 13.312 82.022 27.78 110.906c17.685 35.304 40.845 54.75 64.064 54.75s46.346-19.446 64.03-54.75c14.47-28.883 24.57-67.58 27.782-110.905H166.094zm209.156 0V433.53h22.28V79.376h-22.28zm-117.313 185.22c-23.218 0-46.378 19.415-64.062 54.717c-14.835 29.614-25.098 69.562-28.03 114.22H350c-2.933-44.658-13.197-84.606-28.03-114.22c-17.686-35.302-40.814-54.718-64.033-54.718zM92.657 452.218v41.467h331.718V452.22H92.655z\"/>",
    "house": "<path fill=\"currentColor\" d=\"M256 19.27L25.637 249.638L19.27 256L32 268.73l6.363-6.367L256 44.727l217.637 217.636L480 268.73L492.73 256l-6.367-6.363zM96 48v107.273l64-64.002V48zm160 20.727l-192 192V486h64V320h96v166h224V260.727zM288 320h96v80h-96z\"/>",
    "laurel-crown": "<path fill=\"currentColor\" d=\"M134.594 73.375c-17.522 5.65-31.232 11.854-48.125 24.25a221 221 0 0 0-6.44 6.406c.24.566.61 1.265 1.157 2.25c1.016 1.832 2.767 4.023 4.97 6.19a252 252 0 0 0-9.5 16.624c-3.664-3.04-6.952-6.423-9.594-10.22a216.5 216.5 0 0 0-20.438 30.44c.395 1.636 1.557 3.42 3.78 5.81c2.656 2.853 6.805 5.8 11.626 8.314c-2.024 6.117-3.76 12.204-5.186 18.28c-7.44-3.38-14.245-7.768-19.594-13.343a211.6 211.6 0 0 0-13.406 43.656c1.335 2.434 3.714 4.663 7.312 7.032c5.072 3.34 12.36 6.076 20.282 7.657c-.045 6.437.25 12.822.812 19.124c-11.407-1.673-22.405-5.248-31.375-11.156c-.05-.034-.106-.06-.156-.094a214.3 214.3 0 0 0 1.093 45.906c2.31 3.48 6.176 5.957 11.937 7.938c7.406 2.546 17.472 3.344 27.72 2.312c2 6.122 4.275 12.13 6.81 18c-13.97 2.098-28.237 1.622-40.593-2.625c-.337-.116-.665-.252-1-.375a214.7 214.7 0 0 0 16.844 44.406c3.553 2.804 8.35 4.216 14.72 4.656c9.3.644 21.144-1.73 32.438-6.343a231 231 0 0 0 11.75 15.25c-14.57 6.715-30.36 10.675-45.063 9.75a217.3 217.3 0 0 0 34.844 39.75c4.26 1.446 9.3 1.465 15.374.28c9.6-1.873 20.855-7.404 31.03-15c.008.005.026-.005.032 0a230 230 0 0 0 15.906 11.25c-11.976 9.91-25.625 17.696-39.53 21.22a214 214 0 0 0 37.343 20.186c4.937.423 10.29-.96 16.344-3.906c7.672-3.735 15.78-10.252 23.03-18.28c17.036 6.783 34.732 11.22 52.563 12.905l1.78-18.625c-14.268-1.35-28.584-4.77-42.562-9.938c6.883-11.108 11.61-23.173 12.94-33.437c1.178-9.114.083-16.157-3.782-21.438c-8.08-1.58-15.89-3.94-23.375-7c-.172 6.47-1.706 12.987-4.22 19.094c-3.745 9.103-9.52 17.798-16.53 25.72a212 212 0 0 1-15.657-10.625c6.62-7.182 11.923-14.97 14.906-22.22c3.806-9.246 4.173-16.578.625-22.81c-7.748-4.957-15.003-10.737-21.718-17.22c-1.773 4.3-4.187 8.37-7.032 12.094c-5.476 7.165-12.572 13.51-20.563 18.905c-4.12-4.72-8.052-9.603-11.75-14.688c7.152-4.694 13.296-10.1 17.47-15.562c5.038-6.594 7.22-12.41 6.468-18.094a162 162 0 0 1-13.5-21a50 50 0 0 1-7.657 7.283c-6.758 5.175-14.798 9.155-23.406 12.03c-2.595-5.69-4.957-11.498-7-17.437c7.427-2.405 14.13-5.683 19.03-9.437c5.696-4.362 8.802-8.545 9.532-13.25a180 180 0 0 1-7.406-24.908a45 45 0 0 1-5.812 2.813c-7.45 2.947-15.75 4.434-24.28 4.75a177 177 0 0 1-1.033-18.72c6.957-.263 13.464-1.437 18.44-3.405c4.6-1.82 7.595-3.8 9.343-6.25a192 192 0 0 1-.813-29.813c-.65.104-1.29.18-1.938.25c-6.624.725-13.556.15-20.406-1.343c1.37-5.98 3.07-12.01 5.094-18.063c4.87.933 9.538 1.223 13.28.814c2.614-.286 4.532-.756 6-1.406a189 189 0 0 1 5.97-26.032c-4.182-.736-8.284-2.092-12.25-3.875a239 239 0 0 1 9.344-16.405c2.414.963 4.716 1.665 6.687 1.97c1.107.17 2.023.265 2.782.28c1.946-4.64 4.022-9.17 6.282-13.563c5.898-11.802 12.415-24.25 17-37.937zm244.375 0c4.583 13.686 11.1 26.135 17 37.938a191 191 0 0 1 6.31 13.562c.752-.016 1.66-.113 2.75-.28c1.98-.306 4.296-1 6.72-1.97a239 239 0 0 1 9.344 16.406c-3.976 1.786-8.096 3.14-12.28 3.876c2.563 8.39 4.573 17.1 5.967 26.03c1.474.658 3.404 1.12 6.033 1.408c3.742.41 8.41.12 13.28-.813a193 193 0 0 1 5.063 18.095c-6.837 1.487-13.762 2.036-20.375 1.313a41 41 0 0 1-1.967-.25a192 192 0 0 1-.782 29.812c1.75 2.45 4.745 4.43 9.345 6.25c4.967 1.965 11.462 3.14 18.406 3.406a177 177 0 0 1-1.03 18.72c-8.52-.32-16.808-1.808-24.25-4.75a46 46 0 0 1-5.813-2.814a180 180 0 0 1-7.406 24.875c.715 4.72 3.795 8.912 9.5 13.282c4.904 3.753 11.605 7.03 19.033 9.436c-2.044 5.94-4.405 11.747-7 17.438c-8.598-2.875-16.624-6.862-23.375-12.03a50 50 0 0 1-7.688-7.283c-4.01 7.422-8.52 14.444-13.5 21c-.76 5.682 1.43 11.502 6.47 18.095c4.168 5.457 10.313 10.87 17.467 15.563c-3.697 5.085-7.63 9.966-11.75 14.687c-7.99-5.396-15.086-11.74-20.562-18.906c-2.838-3.715-5.234-7.778-7-12.064c-6.71 6.478-13.976 12.236-21.72 17.188c-3.547 6.233-3.18 13.565.626 22.812c2.985 7.25 8.288 15.037 14.908 22.22a212 212 0 0 1-15.688 10.624c-7.003-7.922-12.754-16.617-16.5-25.72c-2.513-6.106-4.047-12.623-4.22-19.092a125.4 125.4 0 0 1-23.405 7c-3.873 5.28-4.96 12.324-3.78 21.437c1.327 10.264 6.08 22.33 12.967 33.438c-13.974 5.168-28.293 8.587-42.562 9.937l1.75 18.625c17.84-1.687 35.546-6.116 52.594-12.906c7.25 8.028 15.358 14.545 23.03 18.28c6.056 2.947 11.408 4.33 16.345 3.906a214 214 0 0 0 37.342-20.187c-13.896-3.52-27.562-11.293-39.53-21.19c5.442-3.504 10.74-7.293 15.906-11.28c10.18 7.604 21.456 13.126 31.062 15c6.056 1.182 11.09 1.185 15.344-.25a217.4 217.4 0 0 0 34.875-39.78c-14.705.925-30.526-3.035-45.095-9.75c4.12-4.913 8.066-9.99 11.78-15.25c11.295 4.61 23.138 6.986 32.44 6.342c6.368-.44 11.166-1.852 14.717-4.656a214.7 214.7 0 0 0 16.844-44.406c-.335.123-.663.26-1 .375c-12.355 4.247-26.623 4.723-40.594 2.625a209 209 0 0 0 6.813-18c10.236 1.027 20.29.23 27.688-2.313c5.765-1.98 9.65-4.455 11.968-7.937a214.4 214.4 0 0 0 1.064-45.906c-.043.028-.082.065-.125.094c-8.97 5.908-19.97 9.483-31.376 11.156c.563-6.302.856-12.687.812-19.125c7.92-1.582 15.21-4.317 20.28-7.657c3.593-2.366 5.946-4.604 7.283-7.032a211.8 211.8 0 0 0-13.408-43.655c-5.347 5.57-12.133 9.96-19.562 13.344a213 213 0 0 0-5.188-18.282c4.805-2.513 8.942-5.464 11.594-8.313c2.212-2.376 3.402-4.15 3.813-5.78a216.5 216.5 0 0 0-20.44-30.47c-2.642 3.796-5.93 7.18-9.592 10.22a253 253 0 0 0-9.5-16.626c2.208-2.166 3.953-4.36 4.968-6.19c.538-.97.92-1.656 1.156-2.218a222 222 0 0 0-6.468-6.437c-16.893-12.396-30.603-18.6-48.125-24.25zM152.81 134.313l24.094 129.718H341l22.906-124.5l-57.937 63.5L261 135.845l-45 67.187l-63.188-68.718zm27.563 148.406l3.563 19.217H334.03l3.533-19.218H180.375z\"/>",
    "log": "<path fill=\"currentColor\" d=\"M391.69 15.94c-16.368.073-31 5.07-41.975 16.044L73.83 307.87a71.5 71.5 0 0 1 21.77.768c13.84 2.63 26.617 8.977 37.984 17.714c27.167-24.11 141.885-119.71 141.885-119.71c-40.545 46.737-88.255 89.892-120.536 140.76c.593.734 1.195 1.46 1.775 2.205c15.83 20.355 26.67 45.27 29.923 69.563c.955 7.135 1.235 14.277.74 21.23l181.06-181.06l-7.742-4.647c-.48.215-.962.43-1.493.647l-45.254 22.627l45.254-45.254c0 .09.02.18.026.27l.072-.12l43.52 26.114c1.272-5.898 3.794-11.413 7.824-16.05c4.662-5.37 11.21-9.078 19-10.74l-26.124-43.542l15.435-9.262l11.04 18.4l42.762-42.762c21.036-21.035 26.396-41.327 23.27-60.39c-1.63-9.942-5.823-19.683-11.913-28.747l-72.876 72.875l63.522-84.697a113 113 0 0 0-11.752-11.03c-8.926-7.268-19.102-13.37-29.695-17.936c.182.177.37.35.55.527L377.29 59.565l21.668-43.337a88 88 0 0 0-3.974-.233a81 81 0 0 0-3.297-.05zm43.593 233.36c-5.373.6-8.696 2.71-11.058 5.43c-2.093 2.41-3.55 5.79-4.127 9.872c4.65-.945 7.952-2.652 10.228-4.928c2.3-2.3 4.02-5.645 4.957-10.375zM81.69 325.282c-15.297-.065-31.403 6.298-48.342 23.08c-14.82 15.01-19.83 34.54-17.672 55.385c2.17 20.985 12 42.9 26.424 59.945c2.267 2.68 4.655 5.22 7.125 7.633c3.784-12.452 22.964-33.344 33.912-49.724c-7.955 21.334-13.49 43.014-12.62 65.61c7.806 4.22 16.034 7.09 24.415 8.25c19.47 2.693 40.22-3.064 61.29-23.92c11.398-11.606 15.307-29.53 12.57-49.983c-2.76-20.61-12.425-43.073-26.292-60.902s-31.744-30.818-50.262-34.338a57.7 57.7 0 0 0-10.547-1.037zm-8.21 19.8a73.833 55.395 45 0 1 60.14 26.034a73.833 55.395 45 0 1 13.038 91.377a73.833 55.395 45 0 1-46.732 11.692a61.463 48 45 0 0 29.154-11.608a61.463 48 45 0 0-9.52-77.4a61.463 48 45 0 0-77.402-9.522a61.463 48 45 0 0-11.62 29.147A73.833 55.395 45 0 1 42.24 358.08a73.833 55.395 45 0 1 31.237-12.998z\"/>",
    "medieval-barracks": "<path fill=\"currentColor\" d=\"m201.3 20.67l20.2 27.27l84.3 54.26l12.7-20.14l-84.4-54.37zm109.3.12l-32.7 7l-5.2 3.34l20.5 13.17zM217.5 66.7l-24 15.44l12.7 20.16l33.3-21.43zm127.3 7.41l-34.9 55.59l17.8 11.5l34.9-55.57zm-177.6.1l-17.8 11.52l34.9 55.57l17.8-11.5zm199.5 38.89L354 133.3l29.5 19l12.7-20.2zm-221.4.1l-29.5 19l12.7 20.2l29.5-19zM38.49 185l-10 30H179.5l-10-30zm304.01 0l-10 30h151l-10-30zM41 233v30h126v-30zm304 0v30h126v-30zM25 281v206h175.1L215 367.6c.3-21.7 20.6-32.6 41-32.6s40.7 10.9 41 32.6L311.9 487H487V281zm272 86.6l-.1-.7l.1 1.1zm-82 0v.4l.1-1.1zm-103-61.4l6.8 7.9c9.9 11.6 19.4 17 26.3 19.7c6.8 2.6 10.2 2.5 10.2 2.5h9v9c0 13.8-5.7 35.1-14.2 55c-4.3 10-9.3 19.3-15.1 26.8c-5.9 7.4-13.1 13.9-23 13.9s-17.12-6.5-22.98-13.9c-5.87-7.5-10.82-16.8-15.08-26.8c-8.52-19.9-14.24-41.2-14.24-55v-9h9s3.39.1 10.24-2.5c6.86-2.7 16.34-8.1 26.26-19.7zm288 0l6.8 7.9c9.9 11.6 19.4 17 26.3 19.7c6.8 2.6 10.2 2.5 10.2 2.5h9v9c0 13.8-5.7 35.1-14.2 55c-4.3 10-9.3 19.3-15.1 26.8c-5.9 7.4-13.1 13.9-23 13.9s-17.1-6.5-23-13.9c-5.8-7.5-10.8-16.8-15.1-26.8c-8.5-19.9-14.2-41.2-14.2-55v-9h9s3.4.1 10.2-2.5c6.9-2.7 16.4-8.1 26.3-19.7zm-288 26.7c-9.6 9.2-18.95 14.7-26.52 17.6c-2.51 1-4.84 1.7-6.96 2.2c1.67 10.4 5.99 26.6 11.96 40.5c3.86 9.1 8.37 17.3 12.62 22.7c4.3 5.5 8 7.1 8.9 7.1s4.6-1.6 8.9-7.1c4.2-5.4 8.8-13.6 12.6-22.7c6-13.9 10.3-30.1 12-40.5c-2.1-.5-4.5-1.2-7-2.2c-7.5-2.9-16.9-8.4-26.5-17.6m288 0c-9.6 9.2-19 14.7-26.5 17.6c-2.5 1-4.9 1.7-7 2.2c1.7 10.4 6 26.6 12 40.5c3.8 9.1 8.4 17.3 12.6 22.7c4.3 5.5 8 7.1 8.9 7.1s4.6-1.6 8.9-7.1c4.2-5.4 8.8-13.6 12.6-22.7c6-13.9 10.3-30.1 12-40.5c-2.1-.5-4.5-1.2-7-2.2c-7.5-2.9-16.9-8.4-26.5-17.6\"/>",
    "metal-bar": "<path fill=\"currentColor\" d=\"M322.248 85.684L61.432 224.717l-41.145 109.94l7.233 3.85l153.673 81.8l308.495-164.215l-37.752-99.903zm119.035 95.187l25.11 66.45l-102.56 54.594L430.39 186.64l10.893-5.77zm-89.576 47.417L284.957 343.9l-41.67 22.182l72.195-118.62l36.225-19.175zM72.38 248.78l28.21 14.933l-54.012 54.012zm210.827 15.767L211.19 382.87l.26.16l-17.208 9.16l5.795-83.618zm-165.334 8.312l16.963 8.98l-60.445 60.445l-16.93-9.012zM181.42 306.9l-6.174 89.07l-54.1-28.798z\"/>",
    "mining": "<path fill=\"currentColor\" d=\"M113.844 17.72c-8.426.04-16.812.833-25.094 2.436C195.65 84.503 275.473 170.516 338.47 270c2.526-53.76-19.07-109.13-53.533-154.25c-14.097 5.298-31.477.742-43.468-11.25c-11.98-11.98-16.558-29.347-11.282-43.438C194.46 34.105 153.68 17.52 113.844 17.72m380.562 20.405L423.47 115.75l30.06 125.563l-55.092 8.78l-19.407 80.626l73.5 39.124l-41.25 55.937l29.658 44.033l-88.782-27.625l16.5-43.844L291.97 364.5l13.124-84.563l-111.375 58.125l-4.22 78.25l-112.22-27.656l-33.25 104.156h450.376zM261.156 58.72c-.388.01-.776.028-1.156.06c-3.644.325-6.882 1.696-9.188 4c-6.147 6.15-5.746 18.88 3.875 28.5c9.622 9.623 22.353 10.024 28.5 3.876c6.148-6.148 5.747-18.878-3.875-28.5c-5.637-5.637-12.335-8.096-18.156-7.937zM196.5 127.593L25.28 298.874c4.273 11.926 11.027 21.05 25.25 25.626L221.97 153c-7.796-8.89-16.308-17.333-25.47-25.406zm158.78 11.625l9.314 84.686l27.437-84.687h-36.75zm-132.03 74.968l-20.156 35.937l92.687 7.375z\"/>",
    "mining-helmet": "<path fill=\"currentColor\" d=\"M235.966 40.457c-7.926-.141-16.31 2.089-26.047 7.838c45.628 37.319 84.604 74.281 99.064 135.908c17.996-1.883 35.981-3.33 51.559-3.37c-18.957-53.372-50.33-98.905-91.332-127.33c-12.263-8.5-22.826-12.86-33.244-13.046m-42.809 17.334c-30.096 3.739-56.135 11.538-77.076 24.576c-30.268 18.845-50.78 48.345-59.037 95.776c-6.361 36.54-1.923 80.413 1.447 119.486c10.813 8.693 23.377 16.695 34.438 23.164c17.888 10.39 39.477 20.978 56.675 26.336c4.947-17.031 10.328-31.971 16.252-47.483c26.32-1.116 51.671.46 75.756 4.854c8.359 18.34 14.133 38.85 16.951 56.15c27.107-.1 51.992-1.257 76.434-4.443c-7.743-3.891-15.521-9.467-21.068-14.938c-14.387.241-25.648-.097-38.795-.89c-16.618-46.674-23.382-98.451-26.973-141.627c14.429-5.107 30.143-9.316 43.092-11.764c-13.905-58.052-50.912-90.982-98.096-129.197M316.12 70.578c28.121 30.098 49.649 68.246 63.733 110.42a694 694 0 0 1 31.884 1.549c-9.414-46.551-61.234-104.65-95.617-111.969m32.977 128.6c-28.668.998-56.841 4.673-81.776 12.338c3.158 37.792 7.103 74.814 20.508 111.437q6.46.279 12.863.328c-10.146-20.957-11.255-50.056-9.705-68.273c5.276-33.539 29.025-50.64 58.11-55.83m-22.022 26.59c-24.67 19.41-23.483 57.1-12.787 84.136c15.54 33.049 50.055 39.288 79.805 42.656c-14.238-15.658-22.975-38.403-22.975-63.107c0-30.457 13.273-57.94 33.777-72.82c-24.306-2.555-57.116-3.381-77.82 9.135m112.885-2.801c-26.915 0-50.842 28.652-50.842 66.486s23.927 66.488 50.842 66.488s50.844-28.654 50.844-66.488s-23.93-66.486-50.844-66.486M36.683 250.715c-16.19 21.251-24.367 57.995-.75 77.25c50.241 40.966 98.127 78.223 168.523 113.814c76.817 38.837 158.348 39.888 224.867 1.9c61.012-34.842 65.701-62.89 54.338-88.826c-30.917 27.084-73.153 19.666-110.213 13.307c-38.023 7.399-76.867 10.731-112.54 10.537c.52 4.997.891 9.383 1.35 14.537c-40.267 8.662-91.068 5.532-119.308-11.523c.57-5.76 1.466-12.043 2.434-17.012c-20.019-5.952-42.49-17.302-61.496-28.342c-12.889-8.121-25.865-15.173-36.78-24.726c-3.08-2.621-5.514-5.898-6.142-8.602c-1.434-17.831-3.293-36.226-4.283-52.314M178.558 317.1c-6.464 17.459-13.307 38.856-16.059 55.319c22.324 11.178 55.301 11.125 80.238 6.613c-2.124-19.546-5.848-39.728-13.699-58.43c-18.443-3.028-33.843-4.157-50.48-3.502\"/>",
    "mountains": "<path fill=\"currentColor\" d=\"M256.22 18.375c-132.32 0-239.783 107.43-239.783 239.75S123.9 497.905 256.22 497.905S496 390.446 496 258.126S388.54 18.375 256.22 18.375m0 17.875c102.773 0 189.092 69.664 214.374 164.406l-79.313-81.47l-6.967-7.155l-6.688 7.47l-77.22 86.438a1913 1913 0 0 0-34.467-30.063l-6.563-5.625l-6.125 6.156a3510 3510 0 0 0-55.438 57.094l-76.437-83.375l-6.875-7.5l-6.875 7.5l-71.188 77.313C51.364 119.34 143.983 36.25 256.22 36.25m102.25 147.28l-3.845 35.376l21.563-32l10.75 16.688l9.968-8.47l27.188 26.814L417 187.344l19.5 5.062l39.188 40.25l.843-.812a224 224 0 0 1 1.564 26.28c0 37.033-9.06 71.917-25.063 102.595c-46.25-53.48-92.512-100.116-138.75-142.283l11-12.312l33.19-22.594zm-220.16 22.75l26.438 18.782l20.22 22.032c-39.47 42.024-78.63 85.836-115.94 130.344c-21.98-34.443-34.718-75.38-34.718-119.313v-.78l16.25-17.658L87.81 219.5l-17.187 54.063l41.813-51.22l27.312 32.72l-1.438-48.782zm141.375 61.657l53.157 60.938l-7.688-54.563L386.312 315a1632 1632 0 0 1 56.75 62.78l.188-.186C403.853 439.216 334.868 480.03 256.22 480.03c-71.76 0-135.483-33.992-176.033-86.75c19.135-22.91 38.775-45.645 58.72-68.06l56.155-33.814l-29.312 76.75l61.53-73.375l6.25 32.19l19.532-36.783l47.844 69.5l-21.22-91.75z\"/>",
    "mounted-knight": "<path fill=\"currentColor\" d=\"M222.776 64.76a16 16 0 0 1 4.22.56c8.45 2.29 13.88 11.15 14.57 22l-25.78 6l21.89 13.86c-4.93 10.47-13.67 17.3-22.34 17.3a16 16 0 0 1-4.22-.56c-11.68-3.16-17.59-18.85-13.2-35c3.87-14.26 14.43-24.16 24.86-24.16m-20.29-9.44a38.8 38.8 0 0 1 9.18-4.65c-5.47-4.23-12.06-8.82-15.9-9.73c-27.8-6.55-28.34 34.41-49.08 15.35c16.77 30.56 35.36-12.18 55.8-.96zm54 115.56c-6.437-14.24-23.208-20.557-37.44-14.1l23.34 51.55c14.246-6.438 20.57-23.21 14.12-37.45zm-69.52 35l-21.72-6.66l-60.94 31l7.16 14.07zm29.88-65.41h-1.53c-2.836.002-5.66-.37-8.4-1.11a32.64 32.64 0 0 1-14.27-8.23l-19.49 53.78l47.69 14.63l-10.68-23.59l-14-2.64l9.69-7l-8.01-17.51s17.52-7.83 19-8.33m-132.65 143c-64.72-46.18 42-97.32-47.05-105.87c59.27 26.57-49.43 44.81-10.25 97.71c7.49 10.11 34.76 24.95 49.64 32.56a78.5 78.5 0 0 1 7.7-24.38zm132.79-63.26l2.31-4.42l-10.29-3.15l-49.91 25.39l68.65 26.47l-48.34 40.09l40.63 26.55l-6.5-23.93l45.41-49zm13.73-82c4.898.003 9.76.82 14.39 2.42l41.79-21.22a184.7 184.7 0 0 0-35.66-3.51c-5.68 11-14.35 19-24.17 22.51c1.21-.09 2.43-.16 3.65-.16zm182 124.37h-4.15c-5.37 0-11.36-.21-17.77-.63l12.66 18l25-7.33s-1.13-4.55-2.74-11.23a83 83 0 0 1-13.04 1.23zm-138.97-46.37c13.84-22.89 46.76-66.73 96-66.73c16.79 0 35.49 5.1 56 17.86l-11 19.83l.21 21.93c-.43 3.25 3.4 21 7.08 36.9c-6.65 1.15-23 1-43.18-1l-5.68-8.1c-16.16-9.55-28.75-15.76-28.75-15.76s.91 7.77 1.22 19.23c-23.06-4.18-46.85-10.67-64.84-20.13a82 82 0 0 1-7.06-4.03m120.1-18.38c0 4.678 5.655 7.02 8.963 3.712c3.306-3.307.964-8.962-3.714-8.962a5.25 5.25 0 0 0-5.25 5.25zm-132.64-47.42a44.2 44.2 0 0 1 9.43 12.91l223.21-123.4v-9.4zm76.17 154.12c5.64-14.72 7.68-32.58 8.2-48a326 326 0 0 1-49-12.25a151.3 151.3 0 0 1-30.12-13.81l13.78 96.66l-129 17.14l-10.39-87.05c-4.26 1.77-8.45 3.64-12.54 5.64c-58.81 28.68-29.46 96.18-29.46 96.18l-25 49.21l30.11 54.35v18.81h33.9l-15.74-22.83l-14.48-52.57l48.87-46.4c27.89 1.26 102.44-11.49 134.52-17l83 4.55l22.88 29.29l-16.85 12.55l29.55 13.9l9.37-18.45l-19.23-49.28zm-51.22-131.12l-11.31 5.72a44 44 0 0 1-.07 7.38c3.46-4.32 7.23-8.75 11.38-13.1m31.69 231.92l-5-45.44l-20.89-1.14c-6.2 1.06-13.11 2.22-20.44 3.43l21.46 47.74l17.68 54.56l-.63 17h31.67l-9.65-17.83zm-140.38 19.45l36.79-53.82c-21.33 2.95-51.31 5.07-51.47 5.07l2.93 7.61l-19.1 41.87l47 44.07v11.75h28.65l-11.35-12.92z\"/>",
    "old-wagon": "<path fill=\"currentColor\" d=\"M425.208 118.428c-9.115.04-17.29 2.663-25.45 5.927c-9.33 3.732-18.268 8.75-27.847 12.13c-6.67 2.356-14.156 3.768-21.694 2.615c-22.832 71.052-27.844 149.083-28.654 219.9h68.322c-1.45-5.723-1.952-12.17-1.916-19.543c.09-18.73 3.936-43.15 10.523-69.63c12.235-49.176 33.65-104.615 60.876-139.776c-11.49-7.335-21.364-10.784-30.19-11.476a48 48 0 0 0-3.968-.146zM330.95 140.39c-12.268 3.536-23.886 8.28-38.29 10.81c-17.517 3.073-38.528 1.747-67.245-9.64V359h78.14c.756-69.366 5.42-146.51 27.395-218.61m-123.535 4.823c-17.95 11.885-33.58 18.606-50.568 18.578c-16.442-.026-33.08-6.19-53.598-17.17c18.834 69.4 24.842 144.742 25.946 212.38h78.22zM84.7 147.055c-11.136 11.845-23.253 18.937-35.195 22.353c-9.05 2.59-17.778 3.007-25.92 2.363c12.242 29.09 21.534 63.203 25.182 96.45c3.63 33.078 1.834 65.296-9.413 90.78h71.834c-1.15-68.14-7.4-143.78-26.488-211.945zM408.823 309c-.05.322-.105.65-.154.97l-2.667 27.608c-.014.66-.032 1.328-.035 1.965c-.04 8.135.928 14.47 2.107 17.578c.41 1.086.744 1.595.953 1.88h40.387v16h18v-34h-44v-32zM33.415 377v46H47.99c2.265-18.264 11.31-34.465 24.538-46zm134.887 0c13.227 11.535 22.273 27.736 24.537 46h47.15c2.265-18.264 11.31-34.465 24.538-46zm192 0c13.227 11.535 22.273 27.736 24.537 46h46.575v-14h57v-18h-57v-14h-71.113zm-248.887.738a54.7 54.7 0 0 0-23.033 9.502l23.033 23.033zm18 0v32.535l23.033-23.033a54.7 54.7 0 0 0-23.033-9.502m174 0a54.7 54.7 0 0 0-23.033 9.502l23.033 23.033zm18 0v32.535l23.033-23.033a54.7 54.7 0 0 0-23.033-9.502m-245.76 22.23A54.7 54.7 0 0 0 66.153 423h32.535l-23.033-23.033zm89.52 0L142.142 423h32.535a54.7 54.7 0 0 0-9.502-23.033zm102.48 0A54.7 54.7 0 0 0 258.153 423h32.535l-23.033-23.033zm89.52 0L334.142 423h32.535a54.7 54.7 0 0 0-9.502-23.033zM66.153 441a54.7 54.7 0 0 0 9.502 23.033L98.688 441zm75.99 0l23.032 23.033A54.7 54.7 0 0 0 174.677 441zm116.01 0a54.7 54.7 0 0 0 9.502 23.033L290.688 441zm75.99 0l23.032 23.033A54.7 54.7 0 0 0 366.677 441zm-222.728 12.727L88.382 476.76a54.7 54.7 0 0 0 23.033 9.502zm18 0v32.535a54.7 54.7 0 0 0 23.033-9.502zm174 0l-23.033 23.033a54.7 54.7 0 0 0 23.033 9.502zm18 0v32.535a54.7 54.7 0 0 0 23.033-9.502z\"/>",
    "ore": "<path fill=\"currentColor\" d=\"m344.578 493.54l-117.214-2.024L118.9 338.536l14.355-51.353l35.264 9.38l40.145 42.033l-17.467-59.874l23.836-35.358l-42.748-104.034l43.165-79.45l72.434 22.468l46.26 80.46l-29.474 5l-38.478-35.017l22.568 48.064l-.672 37.364l-26.09 18.224l34.95 1.284l47.145 23.835l28.75-27.874l38.488 19.057l10.647 37.578l-18.97-13.784l-78.166 39.967l-44.983-15.39l5.86-27.153l-42.766 3.274l23.573 11.913l-9.49 22.943l58.037 31.285l20.34 79.423l-15.45 34.73l29.397-20.36l66.83-9.438l-71.61 65.81zm-158.524-3.538l-53.48-2.296l27.663-64.006l34.38 49.695zm-86.78-37.04l-11.08-34.875l-35.503-10.204l34.858-11.09l10.212-35.5l11.09 34.855l35.502 10.22l-34.857 11.082l-10.22 35.51zm252.983-33.208l-21.565-84.228l72.042-38.99l53.683 59.322l-18.665 52.23zM169.47 280.677l-59.133-15.612l-20.298-69.16l66.064-37.45l36.94 84.126zm172.106-38.972l-38.385-19.66l1.574-38.86l43.607-9.917l26.753 39.296l-33.547 29.14zm58.845-47.23l-14.234-45.425l-46.14-13.46l45.41-14.262l13.46-46.132l14.252 45.41l46.14 13.478l-45.41 14.235l-13.477 46.156zM327.01 124.9l-28.666-56.762l-28.972-7.96l22.645-41.718l29.312 14.278l17.84 59.542l-12.16 32.62z\"/>",
    "pagoda": "<path fill=\"currentColor\" d=\"M255.967 23.386c19.704 15.157 49.792 21.65 82.52 27.105c21.419 3.57 43.864 6.501 65.163 9.832c-7.28 1.686-14.641 3.4-21.609 4.97c-21.25 4.789-41 8.38-45.967 8.321H175.8l-.168.006c-4.61.172-24.44-3.34-45.662-8.181c-7.035-1.605-14.48-3.364-21.842-5.09c21.346-3.342 43.848-6.279 65.32-9.858c32.727-5.454 62.815-11.948 82.52-27.105zm55 67.228v16h-110v-16zm3.394 34a25 25 0 0 0 4.563 4.28c3.799 2.763 8.317 4.922 13.701 7.076c10.768 4.307 24.987 8.332 41.158 12.375c18.612 4.653 39.434 9.269 60.069 13.865l-50.182 8.404H128.71l-50.54-8.424c20.606-4.59 41.396-9.2 59.98-13.845c16.172-4.043 30.39-8.068 41.159-12.375c5.384-2.154 9.902-4.313 13.7-7.076a25 25 0 0 0 4.563-4.28zm28.606 62v30h-46v-30zm-64 0v30h-46v-30zm-64 0v30h-46v-30zm131.123 48c1.246 1.65 2.68 3.113 4.156 4.422c3.592 3.184 8.04 6.026 13.383 8.965c10.686 5.877 24.947 11.954 41.178 18.041c20.082 7.531 43.024 14.894 65.33 21.42l-54.914 9.152H96.263l-54.533-9.133c22.327-6.53 45.294-13.9 65.397-21.439c16.23-6.087 30.492-12.164 41.178-18.041c5.343-2.939 9.79-5.781 13.382-8.965c1.477-1.309 2.91-2.772 4.157-4.422zm28.877 80v30h-238v-30zm3.123 48c1.246 1.65 2.68 3.113 4.156 4.422c3.592 3.184 8.04 6.026 13.383 8.965c10.686 5.877 24.947 11.954 41.178 18.041c20.102 7.539 43.07 14.909 65.396 21.44l-54.533 9.132H64.71l-54.913-9.152c22.305-6.526 45.247-13.889 65.33-21.42c16.23-6.087 30.492-12.164 41.178-18.041c5.343-2.939 9.79-5.781 13.382-8.965c1.477-1.309 2.91-2.772 4.157-4.422zm60.877 80v46h-142v-46zm-160 0v46h-46v-46zm-64 0v46h-142v-46z\"/>",
    "pikeman": "<path fill=\"currentColor\" d=\"m406 27.594l-23.625 76.187l-5.844 28.97l-52.25 47.844l-51.5-43.125l-23.405-4.095c8.217-14.33 14.685-32.77 16.406-49.594c10.02-2.28 20.516-5.426 31.69-9.81l-36.283-16.564c-1.964-7.07-16.546-28.484-31.406-27.28h-.03c-18.2 4.6-25.82 25.298-28.72 40.718L176.5 90.53c7.87-.307 15.58-.415 23.344-.53c.66 14.1 4.4 27.847 9.97 36.375l-35.158-6.125L106 195.906l77.344 55.875l1.625 16.845l-34.19 215.75h38.376l38.313-169.25l47.874 169.25h37.47l-3.564-16.406l17.094 16.405l63.062-322.53c5.01-4.54 9.265-8.483 12.094-11.314c.177-10.537-2.537-18.942-5.094-24.5l1.125-5.686l8.47-92.75zm-223.156 125.78l.344 64.095l-31.5-23.75zm88.03 21.25l50.876 45.94s22.993-19.458 44.875-38.533l-57.438 285.564l-42.812-197.53l4.5-95.44z\"/>",
    "pine-tree": "<path fill=\"currentColor\" d=\"M249.28 19.188v.25c-18.114 38.634-45.065 72.36-77.686 102.937l37.72-3.938l-51.345 65.032l24.81-7.907l-33.624 54.875l16.53 9.843l-65.25 92.157l36.095.188l-51.686 83.594l63.562-8.126l12 32.094l66.438-25.282L215.5 493.28h52.938l-6.532-68.217l38.188 16.406l10.187-24.783l44.283 20.97l56.406-20.75l-37.064-64.094l-12.437-2.282l6.78 17.19l7.844 19.905l-19.938-7.78l-50.906-19.908v35.751l-14.156-8.594l-69.375-42l-21.595 21.25l-18.03 17.75l2.155-25.22l2.125-24.655l18.188 1.56l9.218-9.092l5.19-5.094l6.218 3.75l61.375 37.156v-29.906l12.75 4.97l43.718 17.092l-5.092-12.906l-6.157-15.656l16.533 3.03l45.468 8.345l-34.53-38.94l-23.625 14.033l-6.688 3.968l-5.125-5.874l-14.28-16.437l.218 1.217l-18.406 3.22l-5.97-34.313l-5.75-33.063l22 25.345l31.188 35.875l43.907-26.03c-24.67-19.543-39.507-33.87-49.658-48.814l.813 12.656l1.97 31l-18.75-24.75l-34.47-45.437l-22.25 46.813l-13.844 29.125l-3.843-32.032l-3.5-28.843l16.532-1.968l16.624-34.97l6.594-13.875l9.28 12.22l25 32.936l-.75-11.53l-.906-14.28l13.47 4.936L341.81 188l-26.125-35.156l-55.843-28.875l-8.938 20.218l-9.656 21.937l-7.72-22.688l-7.468-21.875l16.97-5.78l3.718-8.438l4-9.125l8.844 4.593l49.375 25.53l16.467-5.562c-43.42-34.31-64.63-68.886-76.156-103.593z\"/>",
    "rolled-cloth": "<path fill=\"currentColor\" d=\"M165.446 34.793c-23.17.023-45.634 12.97-54.612 36.323l-83.67 326.167c-12.673 94.537 81.04 88.742 137.957 65.396c81.422-33.396 181.723-29.213 263.244-8.26l6.45-17.218c-7.38-2.638-15.334-5.988-22.252-8.039c.473-4.364.955-8.72 1.437-13.074l23.038 4.118l3.234-18.1l-24.221-4.328a4817 4817 0 0 1 1.87-16.189l22.134 3.278l2.693-18.186q-11.323-1.68-22.647-3.355c.456-3.765.91-7.53 1.375-11.29q11.423 1.638 22.847 3.273l2.607-18.2l-23.164-3.316c.46-3.593 1.29-9.988 1.76-13.577l22.781 2.55l2.045-17.57a56813 56813 0 0 1-22.402-2.508c.783-5.767 1.917-11.182 2.728-16.943q11.505 1.681 23.012 3.368l2.31-17.139q-11.524-1.69-23.05-3.374c.792-5.415 1.252-10.129 2.071-15.542q10.611 1.897 21.223 3.79l3.232-18.1l-21.654-3.866c.736-4.676 1.473-9.35 2.23-14.026q10.467 2.51 20.932 5.022L465.276 208l-22.204-5.33a2809 2809 0 0 1 2.132-12.477q10.47 2.375 20.942 4.746l4.064-17.93q-10.907-2.475-21.815-4.946q1.154-6.4 2.342-12.805l20.742 5.151l4.431-17.843l-21.751-5.405q1.113-5.77 2.254-11.548l20.28 5.014l4.413-17.849l-21.057-5.207a2445 2445 0 0 1 2.571-12.374c8.386 2.41 13.13 2.364 21.41 4.99L486 88.456c-83.808-26.776-179.25-33.22-244.192-6.453c-24.337 114.036-37.305 221.4-68.032 338.64c-3.407 13-14.47 21.89-27.342 28.064c-27 11.608-64.033 13.778-84.63-4.91c-10.971-10.34-16.174-27.036-12.467-47.579c2.303-12.762 10.883-21.986 20.834-26.378c19.749-7.074 43.492-4.25 58.893 7.95c12.463 9.302 12.318 38.283-3.882 31.82c-9.639-6.17-1.964-11.851-8.615-17.378c-11.6-7.428-26.42-10.872-38.972-5.57c-5.564 2.455-8.887 5.737-10.166 12.822c-2.94 16.29.685 24.996 6.985 30.933c18.333 13.49 45.279 10.495 64.068 1.712c10.045-4.82 16.277-11.436 17.511-16.147c30.538-116.518 43.443-224.123 68.293-339.964c-11.796-28.344-35.67-41.247-58.84-41.225\"/>",
    "round-potion": "<path fill=\"currentColor\" d=\"m381.7 27l-14.5 20.4l49.5 35.1l14.5-20.3zm-57.4 12.3L310.2 60l111.3 76.2l14.1-20.7zM317 92.7l-69.9 82.8c-10.3-2.1-20.9-3.2-31.8-3.2c-86.8 0-157.25 70.5-157.25 157.3C58.05 416 128.5 487 215.3 487s157.3-71 157.3-157.4c0-37.8-13.4-72.5-35.6-99.6l51.4-86.9zm7.4 39l29.5 19.5l-46.5 78c26.1 23.9 42.5 58.2 42.5 96.4c0 72-58.5 130.4-130.6 130.4c-72 0-130.55-58.4-130.55-130.4c0-72.1 58.55-130.6 130.55-130.6c22.6 0 43.9 5.8 62.5 15.9zm-31.5 180.5c-47.3-.7-126.2 58.3-178.3 13.5c.1 57.7 47 104.3 104.7 104.3c56.1 0 102-44 104.6-99.5c-7-13.2-17.8-18.1-31-18.3m-11.5 23.3c5.1-.1 9.7 1.5 12.7 5c6.9 7.9 3.2 22.4-8.3 32.4c-11.4 10-26.3 11.7-33.2 3.8s-3.2-22.4 8.2-32.4c6.5-5.6 14-8.6 20.6-8.8m-56.5 49.1c1.2 0 2.4.1 3.7.3c9.9 1.5 17.2 8.2 16.2 15.1c-1 7-9.8 11-19.8 10c-9.9-2-17.2-8-16.2-15.3c.9-6 7.7-10.1 16.1-10.1\"/>",
    "scroll-quill": "<path fill=\"currentColor\" d=\"M311.9 47.95c-17.6 0-34.6.7-50.7 2.43L244.6 93.5l-4.9-40.04c-2.5.46-5 .94-7.5 1.47c-9.1 1.94-15.1 7.22-20.3 14.87s-8.9 17.5-12.1 26.6C191 121.5 184 148 178.4 175c6 5.1 12 10.3 17.9 15.4l30.7-17.6l33.8 26.1l51.9-19.7l61 24.5l-6.8 16.7l-54.4-21.8l-54.7 20.7l-32.2-24.9l-14.9 8.5c19.6 17.3 38.6 34.4 56.5 51.2l14-6.4l33.9 16.1l31.2-13.1l24.2 23.3l-12.4 13l-15.8-15.1l-27.6 11.7l-33-15.8c6.9 6.7 13.6 13.2 20.1 19.7l1.7 1.8l19.5 76.3l-7.8-5.7l-53 .4l-38.1-17.8l-42.4 14.6l-5.8-17l49.2-17l41.1 19.2l24.7-.2l-70.7-51.7c-19.7 4.6-39.4 2.8-58.1-3.7c-4.2 44.4-5.9 85.7-7 118.7c-.4 10.7 2.7 23 7.5 32.5c4.9 9.5 11.7 15.4 15 16.1c5.2 1.2 19 3.2 37.7 5.1l12.4-39l19.1 41.7c16.7 1.2 35 2 53.5 2.2c28.2.3 57.1-.9 82-4.7c15.8-2.3 29.6-6 40.7-10.4c-11.8-5.1-21.6-10.6-29.1-16.6c-11.1-8.9-18.2-19.3-17.3-30.9v.2c5.4-96.4 10.8-188.8 30.3-286l.1-.4l.1-.4c5.3-17.9 17.9-39.86 36.1-55.83c-13.9-2.06-28.6-4-43.7-5.66l-22.3 25.3l-2.2-27.7c-19-1.64-38.4-2.71-57.4-2.92h-5.7zm148.5 20.44c-4.7 3.69-9.2 8.03-13.3 12.73c12.1 8.18 21.4 23.38 21.8 36.98c.3 7.8-1.9 14.9-7.7 21.4c-5.8 6.4-15.6 12.4-31.6 15.8l3.8 17.6c18.6-4 32.3-11.5 41.2-21.4c9-9.9 12.7-22.2 12.3-34c-.6-19.3-11.1-37.59-26.5-49.11M25.44 71.91c-.24 1.61-.38 3.43-.38 5.62c.1 7.69 2.03 18.17 5.83 30.17c3.41 10.7 8.27 22.5 14.35 34.8c10.63-5.3 20.59-11 28.41-18.1c-4.42 12.5-10.15 24.7-18.6 36.5c4.14 7.2 8.63 14.4 13.45 21.5c10.64-5.3 20.72-13 29.52-26.1c-3.3 16-8.47 30.6-18.27 41.8c6.53 8.5 13.5 16.8 20.75 24.5c8.7-9.3 15.6-21 20.7-34.9c3.8 18.5 2.6 35.3-5.7 49.4c8 7.2 16.3 13.7 24.8 19.1c6.1-14 8.9-30.6 8.5-49.7c9.2 23.7 11.3 42.9 9.6 59.5c20.2 9.2 40.8 12 61.3 6.1l4.2-1.3l69.3 50.6l-5.9-22.8c-73-72.8-175.4-156.7-261.86-226.69M312.8 123.9l33.2 13.8l31.3-9.9l5.4 17.2l-37.5 11.9l-33.6-14l-28.8 8.1l-4.8-17.4zm107.3 236.2c-.7 0-1.3.1-2 .1c-3.5.1-7.2.5-11.1 1.3l3.4 17.6c12.2-2.3 20-.4 24.5 2.5c4.4 2.9 6.3 6.8 6.4 12.5c.1 9.3-7 23-23.3 32.5c5.4 2.9 11.9 5.9 19.3 8.7c14.4-11.6 22.1-26.8 22-41.4c-.1-10.7-5.2-21.2-14.6-27.4c-6.7-4.3-15-6.5-24.6-6.4\"/>",
    "scroll-unfurled": "<path fill=\"currentColor\" d=\"M103.432 17.844a87 87 0 0 0-3.348.08q-3.822.163-7.604.678c-20.167 2.747-39.158 13.667-52.324 33.67c-24.613 37.4 2.194 98.025 56.625 98.025c.536 0 1.058-.012 1.583-.022v.704h60.565c-10.758 31.994-30.298 66.596-52.448 101.43a283 283 0 0 0-6.29 10.406l34.878 35.733l-56.263 9.423c-32.728 85.966-27.42 182.074 48.277 182.074v-.002l9.31.066c23.83-.57 46.732-4.298 61.325-12.887c4.174-2.458 7.63-5.237 10.467-8.42h-32.446c-20.33 5.95-40.8-6.94-47.396-25.922c-8.956-25.77 7.52-52.36 31.867-60.452a55.6 55.6 0 0 1 17.565-2.834v-.406h178.33c-.57-44.403 16.35-90.125 49.184-126c23.955-26.176 42.03-60.624 51.3-94.846l-41.225-24.932l38.272-6.906l-43.37-25.807h-.005l.002-.002l.002.002l52.127-8.85c-5.232-39.134-28.84-68.113-77.37-68.113C341.14 32.26 222.11 35.29 149.34 28.496c-14.888-6.763-30.547-10.723-45.908-10.652m.464 18.703c13.137.043 27.407 3.804 41.247 10.63l.033-.07c4.667 4.735 8.542 9.737 11.68 14.985H82.92l10.574 14.78c10.608 14.83 19.803 31.99 21.09 42.024c.643 5.017-.11 7.167-1.814 8.836c-1.705 1.67-6.228 3.875-15.99 3.875c-40.587 0-56.878-44.952-41.012-69.06C66.238 46.64 79.582 39.22 95.002 37.12a64 64 0 0 1 8.894-.573M118.5 80.78h46.28c4.275 15.734 3.656 33.07-.544 51.51H131.52c1.9-5.027 2.268-10.574 1.6-15.77c-1.527-11.913-7.405-24.065-14.62-35.74m101.553 317.095c6.44 6.84 11.192 15.31 13.37 24.914c3.797 16.736 3.092 31.208-1.767 43.204c-4.526 11.175-12.576 19.79-22.29 26h237.19c14.448 0 24.887-5.678 32.2-14.318c7.312-8.64 11.2-20.514 10.705-32.352a47.7 47.7 0 0 0-2.407-13.18l-69.91-8.205l42.017-20.528c-8.32-3.442-18.64-5.537-31.375-5.537H220.053zm-42.668.506a37 37 0 0 0-3.457.153a34.8 34.8 0 0 0-7.824 1.63c-15.11 5.02-25.338 21.54-20.11 36.583c3.673 10.57 15.347 17.71 25.654 13.938l1.555-.57h43.354c.946-6.36.754-13.882-1.358-23.192c-3.71-16.358-20.543-28.483-37.815-28.54z\"/>",
    "shop": "<path fill=\"currentColor\" d=\"M256.18 21c-23.242 0-46.577 3.01-63.186 8.54c-8.304 2.763-14.868 6.196-18.808 9.558c-3.94 3.36-5.167 5.956-5.186 8.96L168.943 57H41v14h430V57H342.967l.033-9.033c.01-3.002-1.17-5.55-5.057-8.895s-10.407-6.773-18.677-9.535C302.724 24.014 279.42 21 256.18 21M38.277 89l-10.443 94h80.9l20.243-86.36L122.81 183h81.07l17.114-86.68l-3.096 86.68h75.75l-4.634-86.518L307.694 183h81.497l-6.167-86.36L403.266 183h80.9l-10.443-94zM25.834 201l-.51 4.588C39.822 226.445 52.968 235 64 235c11.32 0 24.852-8.89 39.8-30.96l.714-3.04zm95.687 0l-.32 4.498C135.753 226.495 148.935 235 160 235c11.293 0 24.788-8.85 39.693-30.803l.63-3.197zm95.736 0l-.156 4.352C231.69 226.455 244.908 235 256 235c11.08 0 24.28-8.525 38.85-29.576l-.237-4.424h-77.357zm94.324 0l.674 3.12c15 22.192 28.503 31.044 39.773 31.013c11.03-.03 24.212-8.62 38.772-29.637l-.32-4.496zm95.906 0l.713 3.04C423.147 226.11 436.68 235 448 235c11.032 0 24.178-8.555 38.676-29.412l-.51-4.588h-78.68zM112 223.31C97.313 242.11 81.492 253 64 253c-13.972 0-26.884-6.906-39-19.264V487h318V279h114v208h30V233.736C474.884 246.094 461.972 253 448 253c-17.49 0-33.31-10.888-47.996-29.684c-14.664 18.808-30.432 29.77-47.926 29.817c-17.508.048-33.352-10.87-48.092-29.807C289.303 242.116 273.486 253 256 253c-17.492 0-33.313-10.89-48-29.69c-14.687 18.8-30.508 29.69-48 29.69s-33.313-10.89-48-29.69M55 279h258v178H55zm18 18v142h222V297zm288 0v71.064l78 .573V297zM88 312h128c-108.235 8-116.31 24-128 113.11zm273 74.066v13.998l78 .573v-14.002zm0 32V487h78v-68.365z\"/>",
    "shoulder-armor": "<path fill=\"currentColor\" d=\"m208 56.643l-16 64l-98.568 14.082L256 175.365l162.568-40.64L320 120.643l-16-64l-27.268 18.18l-12.002 48.003h-17.46l-12.002-48.004zm-138.621 90.62L16 200.644l48 64l25.77-25.77l26.619-79.857zm373.242 0l-47.01 11.753l26.62 79.857L448 264.643l48-64zm-308.717 16.132l-20.123 60.369l13.81 55.246L247 345.348V191.67zm244.192 0L265 191.67v153.678l119.408-66.338l13.81-55.246zM144 308.715v56.314l103 30.627v-29.719zm224 0l-103 57.223v29.718l103-30.627zm-224 75.54v56.388l103 14.714V414.88zm224 0L265 414.88v40.478l103-14.714z\"/>",
    "slingshot": "<path fill=\"currentColor\" d=\"M157.54 15.78c-2.838.003-5.676.125-8.5.365c-22.6 1.92-44.724 11.21-61.347 26.587c-16.32 15.096-27.204 36.473-26.69 61.45c3.875-.13 9.014-.284 14.847-.397c1.073-.02 2.088-.027 3.146-.043c-.402-19.627 7.798-35.656 20.92-47.795c13.38-12.377 32-20.283 50.647-21.867c18.517-1.573 36.767 2.965 50.646 14.524a45.3 45.3 0 0 1 16.602-5.51a53 53 0 0 1 3.192-.297a77 77 0 0 0-7.89-7.715c-15.842-13.365-35.714-19.31-55.575-19.3zm68.077 44.282c-2.986.057-5.93.6-8.842 1.477a27 27 0 0 0-3.25.972l.075.12c-3.47 1.38-6.817 3.335-9.692 6.35c-3.5 3.673-6.077 9.9-4.693 15.998l.094.413l.045.144c11.863-10.083 27.67-14.763 42.444-14.64c.3.002.596.024.895.03l-.068-.868l-.592-1.374c-2.704-6.274-8.677-8.048-13.11-8.49a28 28 0 0 0-3.308-.133zM277.66 81.3c-6.248.09-12.4.574-18.474 1.378l-.582.54l4.716 17.102c4.68-.57 9.39-.928 14.133-1.015q2.401-.045 4.817 0c36.413.658 76.09 16.07 122.072 59.433l15.937-9.623c-49.936-48.12-95.313-67.04-137.684-67.806q-2.478-.046-4.936-.01zm-52.29 10.595c-6.7 2.283-12.923 5.844-17.354 10.447l2.01 10.578c4.8-7.386 9.9-14.41 15.345-21.025zm18.597 5.953c-4.65 5.218-9.075 10.81-13.297 16.738c5.564-1.297 11.307-1.985 17.088-2.13c-.102-.656-.203-1.312-.3-1.958l-3.49-12.65zM190.2 105c-10.62 5.178-21.06 10.89-31.368 16.828l14.736 8.645l-.23-.047c.64.353 1.372.707 1.754 1.027c.528.443.905.83 1.213 1.19c5.797-3.22 11.592-6.312 17.392-9.227zM80.692 121.756c-1.61.018-2.815-.007-4.496.025c-8.207.16-14.15.39-16.605.478c-2.228 1.913-6.242 5.488-11.158 11.178c-6.63 7.67-12.168 17.598-12.092 23.324c.095 7.15 3.73 19.28 9.736 30.228s14.408 20.872 21.87 25.426c.002 0 2.58.932 6.513 1.07c3.934.138 9.176-.22 15.04-1.04c11.728-1.64 25.992-5.075 39.117-9.215c8.666-2.735 16.262-5.755 22.9-8.71c-17.423-3.064-34.79-11.906-48.413-23.3c-9.947-8.318-17.986-18.11-21.704-29.304a36 36 0 0 1-.707-20.16zm170.13 8.596c-13.804-.118-26.667 3.534-35.956 11.37c.29 1.234.584 2.44.873 3.696c7.614 33.128 13.767 73.212 9.864 97.246c-5.603 34.496-31.537 84.64-56.23 125.106c-14.89 24.398-29.136 45.285-38.177 58.144c10.07-.018 20.817 2.73 31.086 7.26c11.084 4.89 21.573 11.887 29.23 20.914a51 51 0 0 1 4.06 5.488c1.36-3.347 2.576-6.353 4.36-10.703c5.542-13.528 13.064-31.452 21.98-50.63c17.835-38.352 41.727-81.852 64.653-103.98c25.013-24.14 74.933-49.443 118.108-67.835a1059 1059 0 0 1 18.676-7.735c-4.533-14.565-13.66-26.322-24.893-37.757c-.622.35-1.232.7-1.86 1.052c-35.47 19.846-79.24 38.213-106.96 35.963c-3.385-.274-8.838-3.985-12.028-8.44c-11.913-16.64-21.224-49.812-26.786-79.158zM144.48 134.28c-.125.142-.195.26-.324.406c-3.408 3.85-7.99 8.477-12.875 13.076c-4.585 4.317-9.376 8.534-13.716 11.965c14.612 11.06 34.845 18.494 49.54 17.9c.08-3.49-.12-7.653-.57-11.81c-.688-6.327-1.887-12.74-3.016-17.247a44 44 0 0 0-1.13-3.79l-17.908-10.5zm322.356 5.2c-2.163.02-4.4.502-6.305 1.614l-.428.252l-.4.297s-2.87 2.124-7.9 5.642c14.61 14.434 22.734 32.15 28.22 50.262l4.314-1.457l-.045.012c3.98-1.237 7.185-4.906 8.28-7.91c1.197-3.282 1.194-6.115.98-8.954c-.425-5.676-2.144-11.535-4.497-17.277c-2.354-5.742-5.26-11.186-9.092-15.605c-1.915-2.21-4.043-4.27-7.263-5.73c-1.61-.73-3.7-1.168-5.86-1.146zm-37.348 25.102l-13.875 8.377c5.383 5.814 10.47 12.035 14.83 18.9c1.41-8.554 1.554-17.292-.955-27.278zm19.405 7.455c1.144 12.08-.52 22.994-2.93 33.05l15.717-5.33c-3.235-10.06-7.23-19.383-12.787-27.72M130.95 443.914q-.666.002-1.3.03c-6.752.316-9.117 1.857-10.17 4.693l-2.212 5.965a29.7 29.7 0 0 0 2.834 11.68c3.7 7.818 10.09 14.155 17.732 18.603s16.732 7.043 26.115 5.9c7.178-.874 14.383-4.265 20.183-10.12c.164-4.882-1.947-9.743-6.35-14.935c-5.278-6.223-13.748-12.11-22.765-16.087c-8.454-3.73-17.418-5.75-24.07-5.73z\"/>",
    "spiked-armor": "<path fill=\"currentColor\" d=\"M261.61 17.086c-1.54-.042-3.12.127-4.657.127c-12.09 0-23.35 4.608-32.758 12.512l-47.045-9.737l25.846 40.922a89.5 89.5 0 0 0-3.803 13.52L153.3 93.924l46.333 19.685c2.916 13.003 8.493 24.604 15.83 33.808c-8.44 1.31-16.06 3.917-22.904 7.637l-61.8-34.916l34.474 61.038c-4.273 6.62-7.887 14.01-10.886 22.01l-72.526.675l63.283 37.34c-1.184 8.643-1.897 17.604-2.167 26.77l-65.317 18.16l66.466 18.482a355 355 0 0 0 4.73 34.358h22.69l-1.024-104.38l18.688-.183l1.084 110.492l1.047 15.887l-60.99 22.888l63.272 11.732l2.723 41.305l-55.178 20.707l57.242 10.615l1.646 24.975h45.67v-174.63h18.687v174.63h45.545l1.828-24.55l59.524-11.04l-57.104-21.43l3-40.277l64.922-12.037l-62.283-23.373l1.38-18.545l1.053-107.35l18.69.184l-1.026 104.38h24.744a296 296 0 0 0 5.032-34.103l67.386-18.737l-66.613-18.52c-.43-8.708-1.303-17.198-2.62-25.38l65.03-38.37l-75.772-.707c-2.765-6.676-5.943-12.91-9.54-18.61l36.376-64.407l-64.37 36.368a68.3 68.3 0 0 0-21.995-8.207c7.72-9.313 13.61-21.154 16.66-34.523l46.73-19.853l-46.266-19.653a91 91 0 0 0-3.307-12.217l26.566-42.065l-47.68 9.87c-7.905-6.853-17.15-11.348-27.132-12.645c-.5-.075-1.008-.113-1.52-.127zm-4.87 18.844c10.617 0 20.556 5.69 28.377 16.193c6.196 8.322 10.727 19.572 12.348 32.307h-31.338l.002 18.69h31.554c-1.395 13.514-6.065 25.47-12.567 34.204c-7.82 10.505-17.76 16.194-28.377 16.194s-20.556-5.69-28.377-16.194c-6.502-8.733-11.172-20.69-12.566-34.205h31.642l-.002-18.69h-31.422c1.62-12.735 6.15-23.985 12.347-32.307c7.82-10.504 17.76-16.193 28.377-16.193z\"/>",
    "spy": "<path fill=\"currentColor\" d=\"M218 19c-1 0-2.76.52-5.502 3.107c-2.742 2.589-6.006 7.021-9.191 12.76c-6.37 11.478-12.527 28.033-17.666 45.653c-4.33 14.844-7.91 30.457-10.616 44.601c54.351 24.019 107.599 24.019 161.95 0c-2.706-14.144-6.286-29.757-10.616-44.601c-5.139-17.62-11.295-34.175-17.666-45.653c-3.185-5.739-6.45-10.171-9.191-12.76C296.76 19.52 295 19 294 19c-6.5 0-9.092 1.375-10.822 2.85c-1.73 1.474-3.02 3.81-4.358 7.34s-2.397 8.024-5.55 12.783C270.116 46.73 263.367 51 256 51c-7.433 0-14.24-4.195-17.455-8.988c-3.214-4.794-4.26-9.335-5.576-12.881s-2.575-5.867-4.254-7.315C227.035 20.37 224.5 19 218 19m-46.111 124.334c-1.41 9.278-2.296 17.16-2.57 22.602c6.61 5.087 17.736 10.007 31.742 13.302C217.18 183.031 236.6 185 256 185s38.82-1.969 54.94-5.762c14.005-3.295 25.13-8.215 31.742-13.302c-.275-5.443-1.161-13.324-2.57-22.602c-55.757 23.332-112.467 23.332-168.223 0M151.945 155.1c-19.206 3.36-36.706 7.385-51.918 11.63c-19.879 5.548-35.905 11.489-46.545 16.57c-5.32 2.542-9.312 4.915-11.494 6.57c-.37.28-.247.306-.445.546c.333.677.82 1.456 1.73 2.479c1.973 2.216 5.564 4.992 10.627 7.744c10.127 5.504 25.944 10.958 45.725 15.506C139.187 225.24 194.703 231 256 231s116.813-5.76 156.375-14.855c19.78-4.548 35.598-10.002 45.725-15.506c5.063-2.752 8.653-5.528 10.627-7.744c.91-1.023 1.397-1.802 1.73-2.479c-.198-.24-.075-.266-.445-.547c-2.182-1.654-6.174-4.027-11.494-6.568c-10.64-5.082-26.666-11.023-46.545-16.57c-15.212-4.246-32.712-8.272-51.918-11.631c.608 5.787.945 10.866.945 14.9v3.729l-2.637 2.634c-10.121 10.122-25.422 16.191-43.302 20.399C297.18 200.969 276.6 203 256 203s-41.18-2.031-59.06-6.238s-33.182-10.277-43.303-20.399L151 173.73V170c0-4.034.337-9.113.945-14.9m1.094 88.205C154.558 308.17 200.64 359 256 359s101.442-50.83 102.96-115.695a749 749 0 0 1-19.284 2.013c-1.33 5.252-6.884 25.248-15.676 30.682c-13.61 8.412-34.006 7.756-48 0c-7.986-4.426-14.865-19.196-18.064-27.012c-.648.002-1.287.012-1.936.012c-.65 0-1.288-.01-1.936-.012c-3.2 7.816-10.078 22.586-18.064 27.012c-13.994 7.756-34.39 8.412-48 0c-8.792-5.434-14.346-25.43-15.676-30.682a749 749 0 0 1-19.285-2.013M137.4 267.209c-47.432 13.23-77.243 32.253-113.546 61.082c42.575 4.442 67.486 21.318 101.265 48.719l16.928 13.732l-21.686 2.211c-13.663 1.393-28.446 8.622-39.3 17.3c-5.925 4.738-10.178 10.06-12.957 14.356c44.68 5.864 73.463 10.086 98.011 20.147c18.603 7.624 34.81 18.89 53.737 35.781l5.304-23.576c-1.838-9.734-4.134-19.884-6.879-30.3c-5.12-7.23-9.698-14.866-13.136-22.007C201.612 397.326 199 391 199 384c0-3.283.936-6.396 2.428-9.133a480 480 0 0 0-6.942-16.863c-29.083-19.498-50.217-52.359-57.086-90.795m237.2 0c-6.87 38.436-28.003 71.297-57.086 90.795a481 481 0 0 0-6.942 16.861c1.493 2.737 2.428 5.851 2.428 9.135c0 7-2.612 13.326-6.14 20.654c-3.44 7.142-8.019 14.78-13.14 22.01c-2.778 10.547-5.099 20.82-6.949 30.666l5.14 23.42c19.03-17.01 35.293-28.338 53.974-35.994c24.548-10.06 53.33-14.283 98.011-20.147c-2.78-4.297-7.032-9.618-12.957-14.355c-10.854-8.679-25.637-15.908-39.3-17.3l-21.686-2.212l16.928-13.732c33.779-27.4 58.69-44.277 101.265-48.719c-36.303-28.829-66.114-47.851-113.546-61.082M256 377c-8 0-19.592.098-28.234 1.826c-4.321.864-7.8 2.222-9.393 3.324c-1.592 1.103-1.373.85-1.373 1.85s1.388 6.674 4.36 12.846c2.971 6.172 7.247 13.32 11.964 19.924s9.925 12.699 14.465 16.806c4.075 3.687 7.842 5.121 8.211 5.377c.37-.256 4.136-1.69 8.21-5.377c4.54-4.107 9.749-10.202 14.466-16.806s8.993-13.752 11.965-19.924S295 385 295 384s.22-.747-1.373-1.85c-1.593-1.102-5.072-2.46-9.393-3.324C275.592 377.098 264 377 256 377m0 61.953c-.042.03-.051.047 0 .047s.042-.018 0-.047m-11.648 14.701L235.047 495h41.56l-9.058-41.285C264.162 455.71 260.449 457 256 457c-4.492 0-8.235-1.316-11.648-3.346\"/>",
    "stable": "<path fill=\"currentColor\" d=\"M333.1 62.18L24.41 117.3l-.11 30.6l314.1-56.18zM231 129.2l-30 5.4V295h30zM71 157.8l-30 5.4V295h30zM312.5 186c-8.6 6.1-7 24.1 3.5 40.1c-21.6 7.5-45.6 17.2-67 25.6V295h16v90.9c41.3-20.8 74.4-52.7 106.8-89c4.6 22.8 33.9 25.9 51.1 28.7c0 0 .9 13.3 7 18.6c9.2 7.8 24.1 13.4 34.6 7.4c9.7-5.6 9.2-25.7 9.1-29.3c-.2-7.5-7.3-13.1-13.9-16c-18-35-57.4-90.7-90.8-93.1c-4.6-.3-11.2.7-19 2.5c-13.7-9.2-32.1-23.7-37.4-29.7M183 272.5c-39.6 2.4-69.5 2.6-94 3V295h94zM25 313v46h222v-46zm0 64v46h222v-46zm0 64v46h222v-46z\"/>",
    "stone-pile": "<path fill=\"currentColor\" d=\"m317.727 108.904l-95.192 96.592l-26.93 86.815l17.54 36.723l20.417 9.287l33.182-55.082l11.297-3.61l61.75 26.85l20.26-12.998l4.47-43.7l11.42 53.634l-10.622 14.162l3.772 1.64l5.238 6.5l6.832 34.343l55.977-66.775l13.98.23l22.397 28.575l-9.453-52.244L434.01 166.81l-116.28-57.906zM123.61 120.896L94.08 173l-4.603 27.62l25.98-8.442l11.704 7.377l.084.634l28.295 59.865l13.773-4.543l10.94 4.668l3.922 8.21l19.517-62.917l-1.074-33.336l-40.15-.522l-29.732-23.78l34.06 10.888l42.49-7.727l26.034 15.88l36.282-36.815a333 333 0 0 0-8.58-3.52l-79.58 10.126l-3.528-.25l-56.307-15.52zm249.33 36.422l47.058 66.02l2.107 62.51l-25.283-59.698l-65.322-60.404zm-262.2 55.32l-64.234 20.876l-16.71 78.552l50.794 5.582l.596-7.14l37.662-36.707l-8.108-61.16zm56.688 62.45l-36.44 12.016l-31.644 30.84l22.588 30.867l57.326 1.74l16.5-16.16zm110.666 24.19l-44.307 73.546l-.033 57.14l97.264 12.216l44.242-19.528l-17.666-88.806zM443.8 313.36l-46.843 55.876l.287 1.774l65.147 13.887l25.78-14.926l-44.37-56.613zm-138.382 15.89l39.23 22.842l13.41 50.658l-26.82 23.838l-45.015-2.553l38.562-28.242l2.483-39.23zm-238.37 53.838l-8.77 28.51l13.152 48.498l91.037-11.91l1.32-26.418l-62.582-31.995l-34.156-6.684z\"/>",
    "swamp": "<path fill=\"currentColor\" d=\"M199.188 19.97a9.5 9.5 0 0 0-8.407 4.843a907 907 0 0 0-10.843 19.156c-6.34-1.118-12.595-.258-16.406 3.53c-24.12 23.98-59.702 101.133-45.31 111.688c1.968 1.444 4.086 2.64 6.31 3.656c-16.64 42.836-30.184 86.292-40.124 128.562c-1.928-65.01-14.337-127.164-62.22-162.937c44.087 58.265 48.88 155.865 41.877 236.405c-11.69.81-23.34 1.66-34.97 2.53l1.407 18.94a6142 6142 0 0 1 31.656-2.283c-5.404 47.895-14.473 87.508-20.718 105.47l28.28-7.782l19.844 3.906c3.195-33.745 7.683-68.574 16.47-104.437c104.756-6.35 212.06-8.943 325.124-.814c9.21 20.087 7.668 38.25 2.563 64.156c-.69-30.596-32.682-59.164-127.25-57.718c-37.285.583-99.973 24.92-93.345 61.594c10.04 55.48 93.935 63.74 164.875 37.75l-32.78-43.72l76.467 37.75c7.045-10.18 11.56-21.598 12-32.843c14.556 1.83 29.126 3.61 43.625 5.875c20.6-36.8 25.25-154.36-88-314.47c39.61 88.105 71.88 190.382 63.157 224.22c-2.253-.186-4.504-.385-6.75-.563c-28.424-38.034-94.285-80.812-127.814-97.562C370.742 309.23 401.776 337.56 419 360.53c-38.743-2.512-76.81-3.813-114.313-4.155c-66.03-.6-130.31 1.732-193.5 5.47c14.246-49.464 37.544-100.834 77.75-153.97c-51.342 38.358-77.508 85.502-95.406 134.72c9.764-55.987 26.784-116.065 49.69-174.908c1.743.234 3.47.45 5.186.625c23.065 2.38 49.024-68.143 52.688-105.343c.375-3.812-1.312-7.414-4.188-10.44c3.37-6.11 6.79-12.172 10.28-18.155a9.5 9.5 0 0 0-8-14.406z\"/>",
    "tavern-sign": "<path fill=\"currentColor\" d=\"M105 41v96h30V41zm272 0v98h30V41zM25 57v30h62V57zm128 0v30h206V57zm272 0v30h62V57zM69 137v99l56.8 14.2L69 265.7v126.1c14.39-3.5 29.01-1.7 42.7 3.4c17.9 6.5 34.9 18 51.6 30.1c33.4 24.3 65.9 50.3 92.7 50.3s59.3-26 92.7-50.3c16.7-12.1 33.7-23.6 51.6-30.1c13.7-5.1 28.3-6.9 42.7-3.4v-42.6l-15.4-10.7l-28.2-19.6L443 323V220.4l-45.7-14.5l45.7-9.5V137h-18v20h-66v-20H153v18H87v-18zm184.3 30h.3c14.9.5 22.8 11.9 26.5 15.5c1.9 1.9 1.8 1.6 2.1 1.6c5.5-2.5 6.8-3.7 11.3-7.7h3.4c10 0 18.8 5.3 24.7 12.8s9.2 17.4 9.2 28.1c0 3.9-.4 7.6-1.3 11.2c4.1-1.5 8.1-2.7 12.2-2.9c1.5-.2 2.9-.1 4.3.1c5.9.6 12.7 5.2 14.6 11.7c10.3 34.2 7.7 71.4.1 100.8c-2.7 10.6-10.6 17.6-18.6 20.3c-4.5 1.5-8.9 2.1-13.1 2.4c-.2 2 0 32.6 0 50.1H183c-.1-17.9 0-34.7 0-52c3.5-30.3 8.9-71.6 12.6-104.5c-13.1-6.2-22.3-18.8-22.3-33.7c0-21.2 18.7-37.8 40.6-37.8c4.1 0 8.2.6 12 1.8c6.3-10.5 15.9-17.8 27.4-17.8m-.1 18c-4.7.1-10.7 4.3-14.5 14.4l-3.6 9.7l-9.1-5c-3.6-2-7.9-3.1-12.1-3.1c-13.1 0-22.6 9.2-22.6 19.8s9.5 19.8 22.6 19.8c5.4 0 10.6-1.7 14.5-4.6l7.9-5.9l5.2 8.4c3.8 6.3 8.1 8.5 11.8 8.5c4.7 0 10.8-4.3 14.7-14.6l6.9-18.5l9.4 17.3c3.5 6.3 8.1 9 12.6 9c3.7 0 7.3-1.9 10.5-5.9c3.1-4 5.4-10.1 5.4-17s-2.3-13-5.4-17c-2.4-3-5-4.8-7.8-5.6c-5.6 4.4-10.8 7.1-16.5 7.4c-6.7.3-12.2-3.5-15.5-6.6c-6.4-6.2-8.1-10.2-14.4-10.5m90.4 58.6c-9.9 1.2-19.7 7.5-26.9 13.2l9.6 86.1c3.9-.2 7.5-.6 10-1.5c3.9-1.3 5.6-2.3 7-7.6c6.8-26.5 8.9-60.6.3-90.2m-65.6 7.6c-6.2 8.3-14.7 13.8-24.7 13.8c-8.4 0-16-3.9-21.9-10.2c-5.5 2.5-11.5 3.8-17.5 3.8h-.6L202.1 359h107.8l-11.2-100.9c-.6.1-1.2.1-1.8.1c-7 0-13.5-2.6-18.9-7M201 377v16h110v-16z\"/>",
    "tiger": "<path fill=\"currentColor\" d=\"M234.14 91.863a37 37 0 0 0-5.34.248l.01.09c-.434.052-.863.087-1.285.13h-.002c-13.39 2.16-21.5 11.353-24.646 23.768c-3.146 12.414-.44 27.54 9.547 39.16c9.99 11.62 27.353 20.48 55.79 19.205l12.6-.594l-3.117 12.206c-9.385 5.377-17.616 12.364-24.72 20.324c15.527 5.488 31.878 8.408 45.714 9.717c-2.974-14.808-.99-29.996 6.933-44.303l15.746 8.72c-6.41 11.572-7.487 22.054-4.604 33.997c2.883 11.945 10.233 25.285 21.36 40.01l-13.458 10.173l-.15 16.642c-21.68-.194-51.467-6.878-77.633-23.6c-6.053-3.87-11.9-8.322-17.354-13.376c-11.782 28.37-13.634 57.465-6.003 70.255c11.11-24.634 27.01-29.252 44.993-32.588c-17.13 18.342-28.124 33.785-17.815 51.715c3.96-13.97 38.467-32.305 43.477-25.274c2.426 3.405 5.083 6.54 8.3 9.21c8.34 6.918 18.13 12.053 29.19 15.42l.037-.005l8.34 2.03c-5.805-15.73-8.153-33.626-5.144-53.413l17.797 2.706c-3.344 21.99.81 40.485 9.285 56.04l81.662 19.86c4.41-12.413 9.188-24.877 14.26-37.356a40.6 40.6 0 0 1-15.887 5.053c-22.403 2.292-42.428-14.017-44.72-36.42c-2.292-22.4 14.015-42.426 36.418-44.718c20.553-2.103 39.066 11.456 43.757 31.007c8.772-19.053 18.108-38.04 27.843-56.81l-56.24-21.658c-8.008 8.796-14.95 21.628-21.135 38.007l-16.84-6.356c5.648-14.965 12.06-27.965 20.22-38.488l-16.872-6.498c-6.757 8.568-12.733 20.16-18.13 34.457L379.48 214.2c5.03-13.322 10.668-25.077 17.6-34.925l-5.084-5.002c-2.194-16.02-17.753-27.21-36.896-35.41c-6.882-1.782-13.76-1.697-21.245-.088c-12.01 2.584-25.53 9.6-40.527 20.356l-10.492-14.626c10.924-7.835 21.527-14.21 32.127-18.563c-8.53-2.18-16.54-4.04-23.16-5.696l-2.15-.553l-1.684-1.442c-22.453-19.28-40.65-26.077-53.83-26.385zm123.77 77.6c7.553-.037 13.758 5.46 14.547 13.172c.842 8.23-4.86 15.26-13.088 16.103c-8.228.842-15.264-4.885-16.106-13.115c-.842-8.227 4.89-15.232 13.12-16.074v-.005q.77-.08 1.526-.082zm-116.328 51.912a135 135 0 0 0-3.752 6.13c5.653 5.773 11.992 10.763 18.748 15.08c21.657 13.842 47.678 20.033 65.62 20.7c-7.162-9.676-13.092-19.14-17.376-28.63c-17.95-1.016-41.1-4.503-63.24-13.28m121.797 15.45c10.08 3.908 15.52 13.43 17.007 22.218s.636 17.726.322 26.44c-.315 8.717-.152 17.062 1.897 23.785s5.425 11.945 13.44 16.466l-8.844 15.678c-11.797-6.656-18.7-16.682-21.812-26.894s-3-20.486-2.67-29.682c.332-9.197.82-17.465-.08-22.787c-.903-5.324-1.58-6.818-5.765-8.44zm-155.51 30.68c-6.978 5.368-13.82 10.095-20.54 14.272c-.036 6.428.315 12.146 1.045 17.24c2.548 17.786 9 28.637 20.025 40.776l-13.324 12.102c-12.446-13.705-21.47-29.047-24.52-50.325c-.45-3.152-.768-6.445-.98-9.863c-3.92 1.95-7.795 3.7-11.64 5.313c-1.103 14.91-.797 28.72 1.2 41.394c4.15 26.33 15.117 47.86 36.43 66.328l-11.787 13.604c-24.34-21.09-37.728-47.333-42.425-77.13c-1.882-11.944-2.416-24.457-1.867-37.54c-10.743 3.26-21.227 5.415-31.525 6.844c9.952 57.595 35.397 100.764 73.375 133.67l-11.787 13.605c-41.182-35.683-68.956-83.598-79.503-145.416c-12.627.897-25.03 1.028-37.35 1.15c15.65 47.394 39.204 84.183 62.473 112.69L101.227 437.6C76.184 406.922 50.59 366.644 34.14 314.62v42.817c13.126 50.52 37.506 100.093 65.676 129.643l21.49.002a375 375 0 0 1-8.495-36.29l17.71-3.226a356 356 0 0 0 9.54 39.516c31.29 0 52.604.002 85.35.01c-.666-.393-1.352-.782-1.998-1.18c-20.464-12.617-30.62-27.875-35.625-40.082l16.654-6.826c3.844 9.375 11.098 20.908 28.417 31.586c10.005 6.168 23.49 11.983 41.588 16.517l89.887.028a347 347 0 0 1-7.836-23.086c-18.242 5.263-35.12 8.87-52.215 8c-25.948-1.325-51.095-13.908-78.112-43.933l13.38-12.04c25.086 27.88 44.625 36.922 65.65 37.995c12.102.618 25.142-1.73 39.888-5.648c-31.355-6.03-62.652-20.484-89.363-47.766l12.86-12.594c23.715 24.22 51.593 37.16 79.655 42.63c-2.182-11.116-3.896-22.668-5.107-34.712c-28.958-9.042-57.345-21.712-82.312-36.916c.21 6.438 1.007 12.948 1.032 19.012c-3.372-4.565-6.83-9.075-9.875-13.87c-6.615-11.97-15.55-23.158-18.51-36.772c-1.766 3.254-3.335 10.53-4.826 15.318c-12.35-9.858-21.156-24.316-23.19-40.076c-.67-11.76.18-23.593 2.42-35.172zm78.995 54.466c-7.31 2.355-14.182 6.856-19.824 12.096a26.7 26.7 0 0 0-3.335 5.577c23.016 14.82 50.13 27.303 77.92 36.462c-.433-8.41-.63-17.054-.572-25.96c-20.188-5.014-40.118-12.378-54.188-28.174zm-74.76 42.688c2.62 11.624 5.226 17.557 8.11 21.072s6.75 5.746 14.502 8.95l-6.873 16.636c-8.537-3.527-15.9-7.284-21.547-14.17c-5.647-6.885-8.874-15.767-11.752-28.53zM34.14 415.22v71.915c2.916-.023 23.332-.03 41.626-.04c-16.245-20.01-30.38-44.875-41.625-71.874z\"/>",
    "warehouse": "<path fill=\"currentColor\" d=\"M41 41v62h30V41zm48 0v62h30V41zm48 0v62h30V41zm222 7v71H16v18h343v174H16v18h343v167h18v-39h62v39h18V329h39v-18h-39V137h39v-18h-39V48h-18v71h-62V48zM185 73v30h158V73zm192 64h62v46h-62zm-240 16v142h46V153zm-41 16c-12.81 0-23 10.19-23 23s10.19 23 23 23s23-10.19 23-23s-10.19-23-23-23m105 16v110h110V185zm176 16h62v46h-62zM41 233v62h78v-62zm336 32h62v46h-62zm0 64h62v46h-62zm-137 24c-8.39 0-15 6.61-15 15s6.61 15 15 15s15-6.61 15-15s-6.61-15-15-15m137 40h62v46h-62zm-352 8v94h254v-94zm228.977 14.23l4.046 17.54l-208 48l-4.046-17.54zM297 449v46h46v-46z\"/>",
    "watchtower": "<path fill=\"currentColor\" d=\"m256 32l-96 48h23v71h-32v50h30.945L155.36 440.244l-.653.477l.522.72l-4.175 37.566l-.994 8.945l17.89 1.99l.995-8.946L171.61 457h168.78l2.665 23.994l.994 8.945l17.89-1.99l-.995-8.944l-4.174-37.567l.523-.72l-.654-.476L330.054 201H361v-50h-32V80h23zm-48 64h32v48h-32zm64 0h32v48h-32zm-103 73h14v14h-14zm32 0h14v14h-14zm32 0h14v14h-14zm32 0h14v14h-14zm32 0h14v14h-14zm32 0h14v14h-14zm-113.328 32h80.656L256 236.848zm-16.65 9.283L240.33 247h-45.385l4.08-36.717zm113.955 0l4.08 36.717h-45.385zM192.945 265h31.383l-34.822 30.953l3.44-30.953zm58.477 0h9.156l51.75 46H199.672zm36.25 0h31.383l3.44 30.953L287.67 265zm-83.994 64h104.644L256 367.053zm-18.8 8.586L236.323 375h-55.6l4.157-37.414zm142.243 0L331.278 375h-55.6l51.444-37.414zM178.724 393h41.6l-45.26 32.914zm72.205 0h10.144l63.25 46H187.678l63.25-46zm40.75 0h41.6l3.658 32.914z\"/>",
    "water-splash": "<path fill=\"currentColor\" d=\"M163.53 21.28c-4.262.042-8.402 1.318-11.936 3.782c-14.61 10.188-21.734 41.505 11.03 69.97c-.874 22.855 41.786 26.99 24.845-6.657c15.375-44.718-5.465-67.27-23.94-67.094zm255.25 9.564c-6.193.008-12.997 2.884-16.78 8.625c-23.15 35.122 1.875 53.016 25.875 14.936c9.863-15.65 1.23-23.575-9.094-23.562zm-41.717 63.468c-63.42 56.883-111.03 138.435-247.688 80.938c18.578 53.492-6.768 71.09-31.313 76.28c-8.846-6.104-17.503-14.193-25.374-24.28l-19.282-24.72l2.625 31.25c5.134 61.565 27.576 107.054 64.782 136.376c37.207 29.322 88.146 42.22 149.25 42.22c95.388 0 181.77-60.905 213.563-148l5.344-14.657l-15.408 2.186c-5.34.757-9.54.544-12.812-.28l31.688-60.157c-14.324 6.135-29.355 13.593-43.97 20.25c1.73-13.324 5.75-30.14 12.72-50.282l10.312-29.875L446.594 151c-25.463 19.87-52.84 43.613-79.78 63.25c-8.948-17.862-7.626-54.075 10.248-119.938zM33.188 139.906c-8.878-.007-18.012 11.466-15.688 22.688c6.156 29.728 35.794 21.19 28.844-7.75c-2.593-10.795-7.83-14.934-13.157-14.938zm401.343 44.906c-6.213 24.132-7.675 43.034-3.936 57.844c2.573 10.193 8.258 18.705 16.562 23.5c4.09 2.36 8.58 3.803 13.375 4.47c-29.9 20.703-73.522 6.61-53.53-46.72c-85.188 114.645-173.707 126.336-202.156 39.125c-14.613 86.63-105.328 67.462-125.75-2.342c22.01 18.3 47.298 26.824 70.656 22.25c15.653-3.066 29.977-12.394 40.25-27.438c5.99-8.77 10.622-19.464 13.813-32c13.008 21.732 28.002 35.802 44.812 43.094c22.92 9.942 47.727 6.613 71.688-3.22c39.206-16.086 78.357-49.144 114.218-78.562zm-6 179.688c11.396 7.638 18.095 16.212 18.095 25.125c0 32.772-85.57 59.563-190.375 59.563c-104.804 0-189.813-26.79-189.813-59.563c0-8.645 6.17-17.1 16.938-24.53c-39.8 13.298-64.844 31.22-64.844 50.81c0 41.02 106.547 74.158 237.72 74.158s237.688-33.137 237.688-74.157c0-19.793-24.892-38.038-65.407-51.406z\"/>",
    "wheat": "<path fill=\"currentColor\" d=\"M98.344 16.688C79.692 43.785 68.498 69.01 65.5 89.56l23.938 39.157l28.624-33.47c.868-21.213-5.49-48.677-19.718-78.563zM472.5 19.625C444.04 36.055 423.112 54 411.562 71.25l4.75 45.688L456.563 99c9.89-18.777 15.938-46.29 15.938-79.375zm-91.75 27.28c-10.153 21.036-16.8 40.84-20.156 58.314l18.375 57.686l19.78-34.25l-6.5-62.22h.03a277 277 0 0 0-11.53-19.53zM27.25 80.782c-.125 23.364 2.393 44.102 6.875 61.314L75.5 186.25l3.125-39.406L46 93.47l.03-.032a280 280 0 0 0-18.78-12.657zm132.844 10.532c-8.415 3.504-16.29 7.213-23.594 11.094l-39.25 45.97l-3.094 39.374l50.438-39.094c6.712-15.904 12.09-35.263 15.5-57.344m177.22 21.626c-24.024 58.09-16.16 97.86 7.873 108.5l21.157-36.625l-19.594-61.438a274 274 0 0 0-9.438-10.438zm146.03.218c-4.55-.028-8.97.084-13.28.28L414.935 138l-19.78 34.28l62.343-13.655c12.897-11.47 26.09-26.626 38.656-45.094c-4.358-.216-8.64-.348-12.812-.374zm-226.094 8.72c-23.24 23.238-38.832 46.003-45.53 65.655l16.436 42.907l34.22-27.75c4.695-20.704 3.436-48.856-5.126-80.812M16.406 159.06c3.28 62.77 27.482 95.31 53.75 94.594l3.344-42.22l-44.063-47a279 279 0 0 0-13.03-5.374zm143.22 11.375a272 272 0 0 0-18.5 4.563l-48.97 37.938l-3.312 41.75c26.492 7.51 57.16-20.567 70.78-84.25zm16.06 1.563c-4.36 22.935-5.65 43.762-4.374 61.5l32.688 51l10.22-38.188l-22.407-58.437h.03a277 277 0 0 0-16.155-15.875zm267.408 8.938l-60.563 13.218l-20.936 36.25c20.682 18.195 60.438 6.035 100.125-45.625a275 275 0 0 0-18.626-3.843m-138.688 25.53c-8.912 1.92-17.304 4.16-25.187 6.657l-46.97 38.03l-10.22 38.19l56.69-29.283c9.493-14.424 18.323-32.49 25.686-53.593zm155.125 25.063c-25.85 20.324-44.046 41.06-53.03 59.782l11.22 44.532l37.28-23.47c7.126-19.99 9.236-48.088 4.53-80.843zm-123.342 8.595c-34.435 77.573-59.394 159.06-62.97 253.03h18.72c3.558-90.792 27.573-169.428 61.312-245.436l-17.063-7.595zm-185.375 6.906c-8.173 62.347 9.714 98.713 35.687 102.75l10.97-40.874l-34.814-54.25a279 279 0 0 0-11.844-7.625zm221.75 24.532c-7.053 22.243-10.817 42.77-11.657 60.532l26.406 54.594L402 349.967l-15.28-60.687h.06c-4.3-5.848-9.033-11.76-14.217-17.717zm-302.47 1.532c-8.664 74.584-8.13 147.835 12.188 220.062h19.44c-20.877-70.772-21.764-143.02-13.064-217.906l-18.562-2.156zm219.47 11.094c-6.613.16-12.953.54-19.032 1.125L215.5 313.78l-10.844 40.408c24.69 12.23 59.938-9.82 84.906-70zm206.718 36.937c-9.072.844-17.664 2.052-25.78 3.594l-51.156 32.217l-14.688 36.657l59.75-22.313c11.14-13.193 22.055-30.075 31.875-50.155zm-157.31 22c-15.528 60.938-2.096 99.19 23.217 106.28l15.72-39.28l-28.094-58.03c-3.43-3-7.053-5.985-10.844-8.97zM183.25 368.72c-12.674 41.233-22.26 82.547-26.844 124.436h18.813c4.507-39.722 13.69-79.23 25.905-118.97l-17.875-5.467zm270 26.655l-58 21.688l-15.563 38.875c23.056 15.098 60.673-2.606 92.625-59.407a273 273 0 0 0-19.062-1.155zM356.5 469.03c-1.874 7.713-3.185 15.757-3.656 24.126h18.687c.45-6.686 1.55-13.206 3.126-19.687l-18.156-4.44z\"/>",
  };

  /* 7 种语义色调 [高光, 中间调, 暗部] */
  var TONE = {
    metal: ['#f4f8fc', '#8ea6c0', '#33445c'],
    gold: ['#fff3b8', '#e6ba52', '#8a5f18'],
    wood: ['#e8b87e', '#a4713c', '#503014'],
    stone: ['#e6e2da', '#a8a299', '#54504a'],
    jade: ['#b6f0ce', '#4fae7c', '#125a3c'],
    cloth: ['#f8dfc4', '#c68e5c', '#6e421f'],
    red: ['#ff9d7c', '#c8422a', '#67150c'],
  };
  var TONE_IDS = ['metal', 'gold', 'wood', 'stone', 'jade', 'cloth', 'red'];

  /* 24 阶材料色（6 系 × 4 品阶），tier 越高越亮越饱和 */
  var MAT_TONE = {
    iron: [["hsl(212,21%,47) hsl(212,21%,31%) hsl(212,19%,17%)"], ["hsl(212,23%,55) hsl(212,23%,38%) hsl(212,20%,21%)"], ["hsl(212,24%,63) hsl(212,24%,45%) hsl(212,22%,25%)"], ["hsl(212,28%,73) hsl(212,28%,55%) hsl(212,25%,32%)"]],
    wood: [["hsl(26,38%,47) hsl(26,38%,31%) hsl(26,34%,17%)"], ["hsl(26,41%,55) hsl(26,41%,38%) hsl(26,37%,21%)"], ["hsl(26,45%,63) hsl(26,45%,45%) hsl(26,40%,25%)"], ["hsl(26,51%,73) hsl(26,51%,55%) hsl(26,46%,32%)"]],
    leather: [["hsl(20,36%,47) hsl(20,36%,31%) hsl(20,33%,17%)"], ["hsl(20,39%,55) hsl(20,39%,38%) hsl(20,36%,21%)"], ["hsl(20,43%,63) hsl(20,43%,45%) hsl(20,39%,25%)"], ["hsl(20,49%,73) hsl(20,49%,55%) hsl(20,44%,32%)"]],
    sinew: [["hsl(42,29%,47) hsl(42,29%,31%) hsl(42,26%,17%)"], ["hsl(42,32%,55) hsl(42,32%,38%) hsl(42,29%,21%)"], ["hsl(42,35%,63) hsl(42,35%,45%) hsl(42,31%,25%)"], ["hsl(42,39%,73) hsl(42,39%,55%) hsl(42,35%,32%)"]],
    jade: [["hsl(154,34%,47) hsl(154,34%,31%) hsl(154,31%,17%)"], ["hsl(154,38%,55) hsl(154,38%,38%) hsl(154,34%,21%)"], ["hsl(154,41%,63) hsl(154,41%,45%) hsl(154,37%,25%)"], ["hsl(154,46%,73) hsl(154,46%,55%) hsl(154,42%,32%)"]],
    silk: [["hsl(194,24%,47) hsl(194,24%,31%) hsl(194,22%,17%)"], ["hsl(194,26%,55) hsl(194,26%,38%) hsl(194,24%,21%)"], ["hsl(194,29%,63) hsl(194,29%,45%) hsl(194,26%,25%)"], ["hsl(194,32%,73) hsl(194,32%,55%) hsl(194,29%,32%)"]],
  };

  var MAP = {
    "building": {
      "guanfu": [
        "pagoda",
        "red"
      ],
      "minfang": [
        "house",
        "wood"
      ],
      "shuyuan": [
        "bookshelf",
        "cloth"
      ],
      "junying": [
        "medieval-barracks",
        "metal"
      ],
      "xiaochang": [
        "archery-target",
        "wood"
      ],
      "shichang": [
        "shop",
        "gold"
      ],
      "cangku": [
        "warehouse",
        "wood"
      ],
      "chengqiang": [
        "brick-wall",
        "stone"
      ],
      "yizhan": [
        "old-wagon",
        "wood"
      ],
      "fenghuotai": [
        "watchtower",
        "stone"
      ],
      "majiu": [
        "stable",
        "wood"
      ],
      "kezhan": [
        "tavern-sign",
        "wood"
      ],
      "zhaoxianguan": [
        "laurel-crown",
        "gold"
      ],
      "honglusi": [
        "scroll-quill",
        "cloth"
      ],
      "tiejiangpu": [
        "blacksmith",
        "stone"
      ],
      "gongjiangzuofang": [
        "cog",
        "metal"
      ]
    },
    "ext": {
      "farm": [
        "wheat",
        "gold"
      ],
      "forest": [
        "pine-tree",
        "jade"
      ],
      "quarry": [
        "mining",
        "stone"
      ],
      "mine": [
        "mining-helmet",
        "metal"
      ]
    },
    "res": {
      "grain": [
        "wheat",
        "gold"
      ],
      "wood": [
        "log",
        "wood"
      ],
      "stone": [
        "stone-pile",
        "stone"
      ],
      "iron": [
        "ore",
        "metal"
      ],
      "gold": [
        "coins-pile",
        "gold"
      ],
      "pop": [
        "farmer",
        "cloth"
      ]
    },
    "terrain": {
      "plain": [
        "grass",
        "jade"
      ],
      "caoyuan": [
        "grass",
        "jade"
      ],
      "zhaoze": [
        "swamp",
        "jade"
      ],
      "lake": [
        "water-splash",
        "metal"
      ],
      "forest": [
        "pine-tree",
        "jade"
      ],
      "desert": [
        "desert",
        "gold"
      ],
      "hill": [
        "mountains",
        "stone"
      ],
      "city": [
        "castle",
        "red"
      ]
    },
    "troop": {
      "banche": [
        "farmer",
        "cloth"
      ],
      "fujiche": [
        "cavalry",
        "wood"
      ],
      "zhencha": [
        "spy",
        "cloth"
      ],
      "yunshu": [
        "boat-fishing",
        "wood"
      ],
      "buxingji": [
        "pikeman",
        "metal"
      ],
      "dunwei": [
        "checked-shield",
        "metal"
      ],
      "daodanche": [
        "archer",
        "wood"
      ],
      "wuzhi": [
        "mounted-knight",
        "metal"
      ],
      "zhuzhan": [
        "cavalry",
        "red"
      ],
      "kuanglie": [
        "tiger",
        "red"
      ],
      "dianci": [
        "spiked-armor",
        "jade"
      ],
      "huopao": [
        "slingshot",
        "wood"
      ],
      "wuren": [
        "crossbow",
        "wood"
      ],
      "taitan": [
        "elephant",
        "metal"
      ],
      "paojiban": [
        "archery-target",
        "wood"
      ],
      "zhongjiqiang": [
        "crossbow",
        "iron"
      ],
      "guidaopao": [
        "cog",
        "iron"
      ]
    },
    "mat": {
      "iron": [
        "metal-bar"
      ],
      "wood": [
        "log"
      ],
      "leather": [
        "animal-hide"
      ],
      "sinew": [
        "barbed-coil"
      ],
      "jade": [
        "gem-chain"
      ],
      "silk": [
        "rolled-cloth"
      ]
    },
    "slot": {
      "weapon": [
        "broadsword",
        "metal"
      ],
      "head": [
        "crested-helmet",
        "metal"
      ],
      "chest": [
        "chest-armor",
        "metal"
      ],
      "shoulder": [
        "shoulder-armor",
        "metal"
      ],
      "arm": [
        "gauntlet",
        "metal"
      ],
      "waist": [
        "belt",
        "cloth"
      ],
      "feet": [
        "boots",
        "wood"
      ],
      "back": [
        "cape",
        "cloth"
      ],
      "neck": [
        "gem-necklace",
        "gold"
      ],
      "ring": [
        "diamond-ring",
        "gold"
      ],
      "pendant": [
        "gem-pendant",
        "jade"
      ],
      "mount": [
        "horse-head",
        "wood"
      ]
    },
    "item": {
      "jewel": [
        "gem-chain",
        "jade"
      ],
      "blueprint": [
        "scroll-quill",
        "cloth"
      ],
      "prod_buff": [
        "hand-saw",
        "metal"
      ],
      "military_buff": [
        "drum",
        "red"
      ],
      "boost": [
        "hourglass",
        "gold"
      ],
      "exp": [
        "scroll-unfurled",
        "gold"
      ],
      "stamina": [
        "round-potion",
        "jade"
      ],
      "perm": [
        "gem-pendant",
        "gold"
      ],
      "mount_buff": [
        "horse-head",
        "wood"
      ],
      "attr_buff": [
        "scroll-quill",
        "jade"
      ],
      "build_cost": [
        "book-cover",
        "cloth"
      ]
    }
  };

  /* 页面级渐变 + 光照滤镜定义（只需输出一次） */
  function defsHTML() {
    var s = '<defs>';
    TONE_IDS.forEach(function (t) {
      var c = TONE[t];
      s += '<linearGradient id="giT-' + t + '" x1="0.14" y1="0" x2="0.84" y2="1">'
        + '<stop offset="0" stop-color="' + c[0] + '"/>'
        + '<stop offset=".44" stop-color="' + c[1] + '"/>'
        + '<stop offset="1" stop-color="' + c[2] + '"/></linearGradient>';
    });
    Object.keys(MAT_TONE).forEach(function (s0) {
      MAT_TONE[s0].forEach(function (c, i) {
        var p = c[0].split(' ');
        s += '<linearGradient id="giM-' + s0 + (i + 1) + '" x1="0.14" y1="0" x2="0.84" y2="1">'
          + '<stop offset="0" stop-color="' + p[0] + '"/>'
          + '<stop offset=".44" stop-color="' + p[1] + '"/>'
          + '<stop offset="1" stop-color="' + p[2] + '"/></linearGradient>';
      });
    });
    s += '<filter id="giEmb" x="-22%" y="-22%" width="144%" height="144%">'
      + '<feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="b"/>'
      + '<feSpecularLighting in="b" surfaceScale="7" specularConstant="1.05" specularExponent="15" lighting-color="#fff" result="sp">'
      +   '<feDistantLight azimuth="235" elevation="58"/>'
      + '</feSpecularLighting>'
      + '<feComposite in="sp" in2="SourceAlpha" operator="in" result="spc"/>'
      + '<feComponentTransfer in="spc" result="sp2"><feFuncA type="linear" slope=".8"/></feComponentTransfer>'
      + '<feDropShadow in="SourceGraphic" dx="0" dy="2.5" stdDeviation="2.2" flood-color="#000" flood-opacity=".65" result="bs"/>'
      + '<feMerge><feMergeNode in="bs"/><feMergeNode in="sp2"/></feMerge>'
      + '</filter>';
    s += '</defs>';
    return s;
  }

  /* ⚠ 坐标系：game-icons 原始画布是 512×512，而本项目 wrap() 输出的是
     <svg viewBox="0 0 64 64">。直接把 512 路径塞进去只会显示左上角 1/8（表现为
     "图标全没了"）。必须按 64/512 缩放后再交给 wrap()。 */
  var GI_VB = 512, GI_SCALE = 64 / GI_VB;
  function paint(body, fill) {
    return '<g filter="url(#giEmb)"><g transform="scale(' + GI_SCALE + ')">'
      + body.replace(/fill="currentColor"/g, 'fill="' + fill + '"')
      + '</g></g>';
  }

  /* 取图：group + id → SVG 片段（未命中返回空串，交由上层回退手绘） */
  function draw(group, id) {
    var m = MAP[group]; if (!m) return '';
    var e = m[id]; if (!e) return '';
    var b = D[e[0]]; if (!b) return '';
    if (group === 'mat') return paint(b, 'url(#giM-' + id + '1)');
    var t = TONE[e[1]] ? e[1] : 'metal';
    return paint(b, 'url(#giT-' + t + ')');
  }

  /* 材料专用：按系列 + 品阶取渐变 */
  function matDraw(series, tier) {
    var e = MAP.mat[series]; if (!e) return '';
    var b = D[e[0]]; if (!b) return '';
    var k = 'giM-' + series + (tier >= 1 && tier <= 4 ? tier : 1);
    return paint(b, 'url(#' + k + ')');
  }

  return {
    D: D, TONE: TONE, MAT_TONE: MAT_TONE, MAP: MAP,
    defsHTML: defsHTML, draw: draw, matDraw: matDraw,
    has: function (k) { return !!D[k]; },
    count: 66,
    credit: 'game-icons.net · CC BY 3.0',
  };
})();

/* ============================================================
 * v36 修复：CommonJS 桥接
 * ------------------------------------------------------------
 * 本文件用裸 `var X = ...` 声明 —— 在浏览器（<script>）里这是全局变量，
 * 但 smoke-test.js 用 require() 加载时它是**模块局部**的，
 * icons.js 里的 `typeof GICONS` / `typeof BITMAPS` 永远为 undefined
 * → 素材层在 smoke 里静默失效（v32/v35 期间 smoke 一直看不见它）。
 * 显式挂到 window（smoke 已把 global.window 指向 global）即可两边一致。
 * ============================================================ */
if (typeof window !== 'undefined') window.GICONS = GICONS;

/* 页面加载时自动注入渐变与光照滤镜定义（只注入一次）。
   测试环境的简化 DOM 可能缺 API，静默忽略即可。 */
(function () {
  try {
    if (typeof document === 'undefined' || !document.body) return;
    var host = document.getElementById('giDefs');
    if (!host) {
      host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      host.setAttribute('id', 'giDefs');
      host.setAttribute('width', '0'); host.setAttribute('height', '0');
      host.setAttribute('aria-hidden', 'true');
      host.style.position = 'absolute'; host.style.left = '-9999px';
      document.body.appendChild(host);
    }
    if (!host.firstChild) host.innerHTML = GICONS.defsHTML();
  } catch (e) { /* 测试桩无 DOM 能力时忽略 */ }
})();

/* ---- bitmaps.js ---- */
/* ============================================================
 * js/bitmaps.js — AI 位图素材登记表（v35）
 * ------------------------------------------------------------
 * 素材：AI 生成的废土风图标（余烬纪元），1024×1024 透明 PNG（已抠底）。
 * 生成规格见 docs/AI图标生成清单-废土版.md，落位台账见 docs/图标素材注册表.md。
 * 本文件由 .workbuddy/tools/gen/gen_bitmaps.js 扫描目录自动生成 —— 请勿手改。
 *
 * 用法：BITMAPS.src(group, id) → 相对路径（不存在返回空串，上层走矢量回退）
 * ============================================================ */

var BITMAPS = (function () {
  var DIR = "assets/icons/ui/";
  var F = {};
  F["ai_banche.png"] = 1;
  F["ai_buxingji.png"] = 1;
  F["ai_cangku.png"] = 1;
  F["ai_cangku_t2.png"] = 1;
  F["ai_cangku_t3.png"] = 1;
  F["ai_chengqiang.png"] = 1;
  F["ai_city_capital.png"] = 1;
  F["ai_city_county.png"] = 1;
  F["ai_city_jun.png"] = 1;
  F["ai_city_zhou.png"] = 1;
  F["ai_daodanche.png"] = 1;
  F["ai_dianci.png"] = 1;
  F["ai_dunwei.png"] = 1;
  F["ai_farm.png"] = 1;
  F["ai_fenghuotai.png"] = 1;
  F["ai_fenghuotai_t2.png"] = 1;
  F["ai_fenghuotai_t3.png"] = 1;
  F["ai_forest.png"] = 1;
  F["ai_fort.png"] = 1;
  F["ai_fujiche.png"] = 1;
  F["ai_gold.png"] = 1;
  F["ai_gongjiangzuofang.png"] = 1;
  F["ai_gongjiangzuofang_t2.png"] = 1;
  F["ai_gongjiangzuofang_t3.png"] = 1;
  F["ai_grain.png"] = 1;
  F["ai_guanfu.png"] = 1;
  F["ai_guanfu_t2.png"] = 1;
  F["ai_guanfu_t3.png"] = 1;
  F["ai_honglusi.png"] = 1;
  F["ai_honglusi_t2.png"] = 1;
  F["ai_honglusi_t3.png"] = 1;
  F["ai_huopao.png"] = 1;
  F["ai_iron.png"] = 1;
  F["ai_item_attr_buff.png"] = 1;
  F["ai_item_blueprint.png"] = 1;
  F["ai_item_boost.png"] = 1;
  F["ai_item_build_cost.png"] = 1;
  F["ai_item_exp.png"] = 1;
  F["ai_item_jewel.png"] = 1;
  F["ai_item_military_buff.png"] = 1;
  F["ai_item_mount_buff.png"] = 1;
  F["ai_item_perm.png"] = 1;
  F["ai_item_prod_buff.png"] = 1;
  F["ai_item_stamina.png"] = 1;
  F["ai_junying.png"] = 1;
  F["ai_junying_t2.png"] = 1;
  F["ai_junying_t3.png"] = 1;
  F["ai_kezhan.png"] = 1;
  F["ai_kezhan_t2.png"] = 1;
  F["ai_kezhan_t3.png"] = 1;
  F["ai_kuanglie.png"] = 1;
  F["ai_majiu.png"] = 1;
  F["ai_majiu_t2.png"] = 1;
  F["ai_majiu_t3.png"] = 1;
  F["ai_mat_bintie.png"] = 1;
  F["ai_mat_cuge.png"] = 1;
  F["ai_mat_fatie.png"] = 1;
  F["ai_mat_heshi.png"] = 1;
  F["ai_mat_jianmu.png"] = 1;
  F["ai_mat_jiaoge.png"] = 1;
  F["ai_mat_jiaojin.png"] = 1;
  F["ai_mat_jingtie.png"] = 1;
  F["ai_mat_kunshan.png"] = 1;
  F["ai_mat_longjin.png"] = 1;
  F["ai_mat_mabu.png"] = 1;
  F["ai_mat_nanmu.png"] = 1;
  F["ai_mat_niujin.png"] = 1;
  F["ai_mat_qingyu.png"] = 1;
  F["ai_mat_shoujin.png"] = 1;
  F["ai_mat_shujin.png"] = 1;
  F["ai_mat_songmu.png"] = 1;
  F["ai_mat_tanmu.png"] = 1;
  F["ai_mat_xiaoge.png"] = 1;
  F["ai_mat_xige.png"] = 1;
  F["ai_mat_xijuan.png"] = 1;
  F["ai_mat_yangzhi.png"] = 1;
  F["ai_mat_yunjin.png"] = 1;
  F["ai_mat_yuntie.png"] = 1;
  F["ai_mine.png"] = 1;
  F["ai_minfang.png"] = 1;
  F["ai_minfang_t2.png"] = 1;
  F["ai_minfang_t3.png"] = 1;
  F["ai_pop.png"] = 1;
  F["ai_quarry.png"] = 1;
  F["ai_shichang.png"] = 1;
  F["ai_shichang_t2.png"] = 1;
  F["ai_shichang_t3.png"] = 1;
  F["ai_shuyuan.png"] = 1;
  F["ai_shuyuan_t2.png"] = 1;
  F["ai_shuyuan_t3.png"] = 1;
  F["ai_slot_arm_low_l.png"] = 1;
  F["ai_slot_arm_low_r.png"] = 1;
  F["ai_slot_arm_up_l.png"] = 1;
  F["ai_slot_arm_up_r.png"] = 1;
  F["ai_slot_back.png"] = 1;
  F["ai_slot_chest.png"] = 1;
  F["ai_slot_foot_l.png"] = 1;
  F["ai_slot_foot_r.png"] = 1;
  F["ai_slot_head.png"] = 1;
  F["ai_slot_mount.png"] = 1;
  F["ai_slot_neck.png"] = 1;
  F["ai_slot_pendant.png"] = 1;
  F["ai_slot_ring.png"] = 1;
  F["ai_slot_shin_l.png"] = 1;
  F["ai_slot_shin_r.png"] = 1;
  F["ai_slot_thigh_l.png"] = 1;
  F["ai_slot_thigh_r.png"] = 1;
  F["ai_slot_waist.png"] = 1;
  F["ai_slot_weapon.png"] = 1;
  F["ai_stone.png"] = 1;
  F["ai_taitan.png"] = 1;
  /* v91.99 中程梯队（位图待贴图批出图；先登记以通过位图链检查，缺图回退 icons.js 矢量表） */
  F["ai_paojiban.png"] = 1;
  F["ai_zhongjiqiang.png"] = 1;
  F["ai_guidaopao.png"] = 1;
  F["ai_terrain_caoyuan.png"] = 1;
  F["ai_terrain_desert.png"] = 1;
  F["ai_terrain_forest.png"] = 1;
  F["ai_terrain_hill.png"] = 1;
  F["ai_terrain_lake.png"] = 1;
  F["ai_terrain_plain.png"] = 1;
  F["ai_terrain_zhaoze.png"] = 1;
  F["ai_tiejiangpu.png"] = 1;
  F["ai_tiejiangpu_t2.png"] = 1;
  F["ai_tiejiangpu_t3.png"] = 1;
  F["ai_wood.png"] = 1;
  F["ai_wuren.png"] = 1;
  F["ai_wuzhi.png"] = 1;
  F["ai_xiaochang.png"] = 1;
  F["ai_xiaochang_t2.png"] = 1;
  F["ai_xiaochang_t3.png"] = 1;
  F["ai_yizhan.png"] = 1;
  F["ai_yizhan_t2.png"] = 1;
  F["ai_yizhan_t3.png"] = 1;
  F["ai_yunshu.png"] = 1;
  F["ai_zhaoxianguan.png"] = 1;
  F["ai_zhaoxianguan_t2.png"] = 1;
  F["ai_zhaoxianguan_t3.png"] = 1;
  F["ai_zhencha.png"] = 1;
  F["ai_zhuzhan.png"] = 1;
  F["cape_L.png"] = 1;
  F["cape_R.png"] = 1;
  F["mecha_mount.png"] = 1;
  F["mecha_purge.png"] = 1;
  F["mecha_wpn.png"] = 1;
  var PREFIX = {
    "terrain": "ai_terrain_",
    "city": "ai_city_",
    "mat": "ai_mat_",
    "slot": "ai_slot_",
    "item": "ai_item_",
    "troop": "ai_",
    "building": "ai_",
    "ext": "ai_",
    "res": "ai_"
  };
  function fileOf(group, id) {
    var p = PREFIX[group]; if (!p) return '';
    var f = p + id + '.png';
    return F[f] ? f : '';
  }
  return {
    DIR: DIR, F: F, PREFIX: PREFIX,
    has: function (f) { return !!F[f]; },
    fileOf: fileOf,
    src: function (group, id) { var f = fileOf(group, id); return f ? DIR + f : ''; },
    count: 141,
  };
})();

/* v36：CommonJS 桥接 —— smoke-test.js 用 require 加载，裸 var 是模块局部，
   icons.js 里的 typeof BITMAPS 会恒为 undefined（素材层静默失效）。 */
if (typeof window !== 'undefined') window.BITMAPS = BITMAPS;

/* ---- portraits.js ---- */
/* ============================================================
 * js/portraits.js  英雄肖像（v90 · 通用头像池）
 * ------------------------------------------------------------
 * 头像来源：assets/portraits/pool/{性别}_{风格}_{NN}.webp
 *   三种风格混排（human / beast / mecha），男 66 张 + 女 25 张，由 AI 批量
 *   生成后切分抠底（自己生成，无第三方权利负担）。按英雄名的 seed **稳定取一张**：
 *   同一英雄每次进游戏都是同一张脸（seed 存存档，旧档按名字哈希补算）。
 *
 * 存档只写 `portraitSeed`（一个整数，几字节），不存图片。
 *
 * 池文件清单**内嵌在下方 POOL**——头像是同步渲染的，运行时不能 fetch 目录，
 * 往池里加新图后须把文件名补进对应数组（顺序即分配顺序）。
 * ============================================================ */

(function () {
  var GAME = window.GAME = window.GAME || {};
  var P = GAME.portraits = {};

  P.DIR = 'assets/portraits/';

  /* 通用头像池文件清单（与 assets/portraits/pool/tags.json 同源） */
  P.POOL = {
    /* m · 66 张 */
    m: [
      'm_beast_01.webp', 'm_beast_02.webp', 'm_beast_03.webp', 'm_beast_04.webp',
      'm_beast_05.webp', 'm_beast_06.webp', 'm_beast_07.webp', 'm_beast_08.webp',
      'm_human_01.webp', 'm_human_02.webp', 'm_human_03.webp', 'm_human_04.webp',
      'm_human_05.webp', 'm_human_06.webp', 'm_human_07.webp', 'm_human_08.webp',
      'm_human_09.webp', 'm_human_10.webp', 'm_human_11.webp', 'm_human_12.webp',
      'm_human_13.webp', 'm_human_14.webp', 'm_human_15.webp', 'm_human_16.webp',
      'm_human_17.webp', 'm_human_24.webp', 'm_human_25.webp', 'm_human_26.webp',
      'm_human_27.webp', 'm_human_28.webp', 'm_human_36.webp', 'm_human_37.webp',
      'm_human_38.webp', 'm_human_39.webp', 'm_human_40.webp', 'm_human_41.webp',
      'm_human_42.webp', 'm_human_43.webp', 'm_mecha_01.webp', 'm_mecha_02.webp',
      'm_mecha_03.webp', 'm_mecha_04.webp', 'm_mecha_05.webp', 'm_mecha_06.webp',
      'm_mecha_07.webp', 'm_mecha_08.webp', 'm_mecha_09.webp', 'm_mecha_10.webp',
      'm_mecha_11.webp', 'm_mecha_12.webp', 'm_mecha_13.webp', 'm_mecha_14.webp',
      'm_mecha_15.webp', 'm_mecha_16.webp', 'm_mecha_17.webp', 'm_mecha_18.webp',
      'm_mecha_19.webp', 'm_mecha_20.webp', 'm_mecha_21.webp', 'm_mecha_22.webp',
      'm_mecha_23.webp', 'm_mecha_24.webp', 'm_mecha_25.webp', 'm_mecha_26.webp',
      'm_mecha_27.webp', 'm_mecha_28.webp'
    ],
    /* f · 25 张 */
    f: [
      'f_beast_01.webp', 'f_beast_02.webp', 'f_beast_03.webp', 'f_human_01.webp',
      'f_human_02.webp', 'f_human_03.webp', 'f_human_04.webp', 'f_human_05.webp',
      'f_human_06.webp', 'f_human_07.webp', 'f_human_08.webp', 'f_human_09.webp',
      'f_human_12.webp', 'f_human_13.webp', 'f_human_14.webp', 'f_human_20.webp',
      'f_human_21.webp', 'f_human_22.webp', 'f_mecha_01.webp', 'f_mecha_02.webp',
      'f_mecha_03.webp', 'f_mecha_04.webp', 'f_mecha_05.webp', 'f_mecha_06.webp',
      'f_mecha_07.webp'
    ]
  };

  /* 性别判定：显式 gender 优先，其次是"美人"标记 */
  P.isFemale = function (g) { return !!(g && (g.gender === 'female' || g.beauty)); };

  /* 从英雄对象推出稳定 seed（招募时写入，旧档按名字哈希补算） */
  P.seedOf = function (g) {
    if (g && g.portraitSeed != null) return g.portraitSeed;
    var str = String((g && (g.name || g.id)) || 'x'), s = 2166136261;
    for (var i = 0; i < str.length; i++) {
      s ^= str.charCodeAt(i);
      s = Math.imul(s, 16777619);
    }
    return s >>> 0;
  };

  /* 该英雄在池中的头像路径（池为空时返回空串） */
  P.poolFile = function (g) {
    var pool = P.POOL[P.isFemale(g) ? 'f' : 'm'];
    if (!pool || !pool.length) return '';
    return P.DIR + 'pool/' + pool[P.seedOf(g) % pool.length];
  };

  /* 头像取图统一入口 */
  P.fileOf = function (g) { return P.poolFile(g); };

  /* 招募时调用：给英雄定下肖像（只记 seed） */
  P.assign = function (g) {
    if (!g) return g;
    if (g.portraitSeed == null) g.portraitSeed = P.seedOf(g);
    return g;
  };

  function U_esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  /* ---------- 统一入口：<img> 取池中头像 ---------- */
  P.html = function (g, size, cls) {
    size = size || 96;
    var extra = cls ? ' ' + cls : '';
    var src = P.fileOf(g);
    /* 池不可用时退回 emoji（正常情况不会发生），保证界面不开天窗 */
    if (!src) {
      return '<span style="font-size:' + Math.round(size * 0.7) + 'px;line-height:1;">' +
        U_esc((g && g.avatar) || '🧔') + '</span>';
    }
    return '<span class="portrait-holder' + extra + '" style="width:' + size + 'px;height:' + size + 'px;">' +
      '<img class="portrait-img" src="' + src + '" width="' + size + '" height="' + size +
        '" alt="' + U_esc(g && g.name) + '">' +
      '</span>';
  };

  /* 旧档兼容：给已有英雄补上 seed（不写盘，读档时补齐） */
  P.ensure = function (g) {
    if (g && g.portraitSeed == null) g.portraitSeed = P.seedOf(g);
    return g;
  };
})();
