/* ============================================================
 * v91.30 gltf.js — **极简 GLB 加载器**（无外链 · 配合 vendor three r150 UMD）
 * ------------------------------------------------------------
 * three r150 的 GLTFLoader 是 ES module；本项目纯静态零外链（vendor three UMD），
 * 且奇观 .glb 经 gltf-transform 优化为**单一网格 + 少量贴图**的规整结构 →
 * 一个 ~150 行的解析器即可，不引 GLTFLoader（避免 r150/r160 兼容与模块化改造）。
 * 支持：单/多 primitive · POSITION/NORMAL/TEXCOORD_0 · 索引 · baseColor/normal 贴图。
 * ⚠️ 仅覆盖我们自己的素材形态；通用 glTF 特性（蒙皮/动画/KHR_draco）不支持。
 * ============================================================ */
import './core.js';
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

  /* ============================================================
   * v92.00 骨骼动画扩展 —— parseAnimated / loadAnimated
   * ------------------------------------------------------------
   * 在「极简静态解析器」之上新增**骨骼 + 蒙皮 + 动画**能力，不引入 GLTFLoader（维持零外链 UMD）。
   * 适用形态（已用 RobotExpressive / Soldier 验证）：
   *   - 任意节点层级（TRS / matrix）构建为 THREE.Bone（在 skin.joints 中）或 Group（其余）。
   *   - skin：inverseBindMatrices → THREE.Skeleton；含 JOINTS_0/WEIGHTS_0 的 primitive → SkinnedMesh。
   *   - 刚体部件 mesh 直接挂到对应 bone 节点下（动画驱动父骨骼 → 子 mesh 跟随）。
   *   - mesh.targets（POSITION 增量）→ morphAttributes（morphTargetsRelative=true）；动画 `weights` 通道驱动 .morphTargetInfluences。
   *   - 动画 T/R/S/weights 通道 → THREE.AnimationClip[]（轨道名 = 节点/网格对象名，供 AnimationMixer 解析）。
   * 返回 { root, clips, byName, skeletons }；root 默认归一化到 target 高（默认 1）且脚底贴 y=0，方便直接放进场景。
   * ============================================================ */
  var _ACTOR_GLB = {};   /* 镜像 wonders 的 base64 注入：window.__ACTOR_GLB[name] = <base64> */

  function _actorB64Buf(b64) {
    /* base64（可带 data: 前缀）→ ArrayBuffer */
    try {
      var s = String(b64 || '');
      var c = s.indexOf(','); if (c >= 0 && s.slice(0, c).indexOf('base64') >= 0) s = s.slice(c + 1);
      var bin = (typeof atob === 'function') ? atob(s) : Buffer.from(s, 'base64').toString('binary');
      var len = bin.length, ab = new ArrayBuffer(len), u8 = new Uint8Array(ab);
      for (var i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
      return ab;
    } catch (e) { return null; }
  }

  GTF.parseAnimated = function (ab, THREE, opts) {
    opts = opts || {};
    THREE = THREE || (typeof window !== 'undefined' && window.THREE) || (typeof global !== 'undefined' && global.THREE);
    if (!THREE) throw new Error('parseAnimated 需要 THREE');
    var dv = new DataView(ab);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('非法 GLB（magic）');
    var total = dv.getUint32(8, true), off = 12, json = null, bin = null;
    while (off < total) {
      var clen = dv.getUint32(off, true), ctype = dv.getUint32(off + 4, true), dOff = off + 8;
      if (ctype === 0x4E4F534A) json = ab.slice(dOff, dOff + clen);
      else if (ctype === 0x004E4942) bin = ab.slice(dOff, dOff + clen);
      off = dOff + clen;
    }
    if (!json) throw new Error('GLB 缺 JSON chunk');
    var gltf = JSON.parse(new TextDecoder('utf-8').decode(json));
    if (!bin) bin = new ArrayBuffer(0);

    /* 访问器（复用 parse 的语义：处理交错 stride） */
    function accArray(ai) {
      var a = gltf.accessors && gltf.accessors[ai];
      if (!a || a.bufferView == null) return null;
      var bv = gltf.bufferViews && gltf.bufferViews[a.bufferView];
      if (!bv) return null;
      var TA = CITEM[a.componentType]; if (!TA) return null;
      var cn = CNUM[a.type]; if (!cn) return null;
      var n = a.count, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
      var es = TA.BYTES_PER_ELEMENT, stride = bv.byteStride || 0;
      if (stride && stride !== cn * es) {
        var dvv = new DataView(bin), get = CGET[a.componentType], out = new TA(n * cn);
        for (var i = 0; i < n; i++) for (var c = 0; c < cn; c++) out[i * cn + c] = dvv[get](base + i * stride + c * es, true);
        return out;
      }
      return new TA(bin, base, n * cn);
    }
    /* 贴图 blob（解析失败静默返回 null，Node 环境无 URL.createObjectURL 即走此路） */
    function texUrl(ti) {
      if (ti == null) return null;
      var tex = gltf.textures && gltf.textures[ti]; if (!tex) return null;
      var src = (tex.source != null) ? tex.source
        : (tex.extensions && tex.extensions.EXT_texture_webp ? tex.extensions.EXT_texture_webp.source : null);
      var img = gltf.images && gltf.images[src]; if (!img || img.bufferView == null) return null;
      var bv = gltf.bufferViews[img.bufferView]; if (!bv) return null;
      var bytes = new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength);
      try { return URL.createObjectURL(new Blob([bytes], { type: img.mimeType || 'image/png' })); }
      catch (e) { return null; }
    }

    /* ---- 节点对象（joints → Bone；其余 → Group）----
       v156.20：名字**优先用 glTF 里的节点名**（mixamorigHips / Head / Spine…）。
       原来一律叫 `node_N`，于是"按语义找骨骼"（髋在哪、头在哪）根本无从下手 ——
       立姿判定只能靠"哪边跨度最大"这种瞎猜，T 姿模型当场被放平。
       动画轨道用的是同一批对象的 name，所以改名不会断 bind；
       重名则加 `_2/_3` 后缀（three 的 PropertyBinding 按名字找对象，重名会串味）。 */
    var nodes = gltf.nodes || [], nodeObjs = [], jointSet = {}, usedName = {};
    (gltf.skins || []).forEach(function (s) { (s.joints || []).forEach(function (j) { jointSet[j] = true; }); });
    for (var i = 0; i < nodes.length; i++) {
      var o = jointSet[i] ? new THREE.Bone() : new THREE.Group();
      /* ⚠️ 名字必须按 three 的规矩清洗：PropertyBinding 解析轨道名时会**剔除
         `[ ] . : /` 并把空白换成下划线**（sanitizeNodeName）。直接留 `mixamorig:Hips`
         这种名字，轨道就绑不上 → 骨骼动画静默失效（实测：Soldier 的 Walk 驱动位移 = 0，
         §586 当场红）。清洗后 `mixamorig:Hips` → `mixamorigHips`，语义仍在。 */
      var _raw = (nodes[i] && nodes[i].name) ? String(nodes[i].name) : ('node_' + i);
      var _bn = _raw.replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '') || ('node_' + i);
      var _uniq = _bn, _k = 1;
      while (usedName[_uniq]) { _uniq = _bn + '_' + (_k++); }
      usedName[_uniq] = 1;
      o.name = _uniq;
      nodeObjs.push(o);
    }
    /* TRS / matrix → 局部变换 */
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i], o = nodeObjs[i];
      if (n.matrix) { o.matrix.fromArray(n.matrix); o.matrix.decompose(o.position, o.quaternion, o.scale); o.matrixAutoUpdate = false; }
      else {
        if (n.translation) o.position.fromArray(n.translation);
        if (n.rotation) o.quaternion.fromArray(n.rotation);
        if (n.scale) o.scale.fromArray(n.scale);
      }
    }
    for (i = 0; i < nodes.length; i++) { var nd = nodes[i]; (nd.children || []).forEach(function (ci) { if (nodeObjs[ci]) nodeObjs[i].add(nodeObjs[ci]); }); }
    var root = new THREE.Group(); root.name = 'actor_root';
    var scene = (gltf.scenes && gltf.scenes[gltf.scene == null ? 0 : gltf.scene]) || { nodes: [] };
    var roots = (scene && scene.nodes) || nodes.map(function (_, k) { return k; });
    roots.forEach(function (ri) { if (nodeObjs[ri]) root.add(nodeObjs[ri]); });

    /* ---- 几何体（含蒙皮 / 形态目标）---- */
    function buildGeo(prim, isSkin) {
      var at = prim.attributes || {};
      if (at.POSITION == null) return null;
      var pos = accArray(at.POSITION); if (!pos) return null;
      var nor = (at.NORMAL != null) ? accArray(at.NORMAL) : null;
      var uv = (at.TEXCOORD_0 != null) ? accArray(at.TEXCOORD_0) : null;
      var idx = (prim.indices != null) ? accArray(prim.indices) : null;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      if (nor) geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      if (idx) geo.setIndex(new THREE.BufferAttribute(idx, 1));
      if (!nor) geo.computeVertexNormals();
      if (isSkin) {
        var ji = accArray(at.JOINTS_0), wi = accArray(at.WEIGHTS_0);
        if (ji && wi) {
          var JA = (ji instanceof Uint8Array) ? THREE.Uint8BufferAttribute : THREE.Uint16BufferAttribute;
          geo.setAttribute('skinIndex', new JA(ji, 4));
          geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wi, 4));
        }
      }
      if (prim.targets && prim.targets.length) {
        var marr = [];
        for (var t = 0; t < prim.targets.length; t++) {
          var tp = prim.targets[t];
          if (tp.POSITION != null) { var td = accArray(tp.POSITION); if (td) marr.push(new THREE.Float32BufferAttribute(td, 3)); }
        }
        if (marr.length) { geo.morphAttributes = geo.morphAttributes || {}; geo.morphAttributes.position = marr; geo.morphTargetsRelative = true; }
      }
      return geo;
    }
    /* ---- 材质（复用既有 buildMaterial，baseColorFactor 追补）---- */
    function buildMat(mi) {
      var m = (gltf.materials && gltf.materials[mi]) || {};
      var pbr = m.pbrMetallicRoughness || {};
      var part = {
        map: texUrl(pbr.baseColorTexture && pbr.baseColorTexture.index),
        normalMap: texUrl(m.normalTexture && m.normalTexture.index),
        metalness: (pbr.metallicFactor != null ? pbr.metallicFactor : 0),
        roughness: (pbr.roughnessFactor != null ? pbr.roughnessFactor : 0.7),
        doubleSided: !!m.doubleSided,
      };
      var mat = GTF.buildMaterial(THREE, part, null);
      if (pbr.baseColorFactor) mat.color.setRGB(pbr.baseColorFactor[0], pbr.baseColorFactor[1], pbr.baseColorFactor[2]);
      return mat;
    }

    var nodeMeshes = {};   /* nodeIndex → [meshObj,...]（供 weights 轨道定向） */
    /* ---- 骨架 ---- */
    var skeletons = {};
    (gltf.skins || []).forEach(function (skin, si) {
      var joints = skin.joints || [];
      var ibm = accArray(skin.inverseBindMatrices); if (!ibm) return;
      var bones = joints.map(function (j) { return nodeObjs[j]; });
      var inv = [];
      for (var k = 0; k < bones.length; k++) inv.push(new THREE.Matrix4().fromArray(ibm, k * 16));
      skeletons[si] = new THREE.Skeleton(bones, inv);
    });
    /* ---- 网格（蒙皮 / 刚体 / 形态目标）---- */
    for (i = 0; i < nodes.length; i++) {
      var nn = nodes[i]; if (nn.mesh == null) continue;
      var mm = gltf.meshes[nn.mesh]; if (!mm) continue;
      var isSkin = nn.skin != null, sk = isSkin ? skeletons[nn.skin] : null, objs = [];
      (mm.primitives || []).forEach(function (prim, pi) {
        if (prim.mode != null && prim.mode !== 4) return;
        var geo = buildGeo(prim, isSkin); if (!geo) return;
        var mat = buildMat(prim.material != null ? prim.material : 0);
        var mesh = isSkin ? new THREE.SkinnedMesh(geo, mat) : new THREE.Mesh(geo, mat);
        mesh.name = 'mesh_' + nn.mesh + '_' + pi;
        if (geo.morphAttributes && geo.morphAttributes.position)
          mesh.morphTargetInfluences = new Array(geo.morphAttributes.position.length).fill(0);
        mesh._sk = (isSkin && sk) ? sk : null;
        nodeObjs[i].add(mesh); objs.push(mesh);
      });
      if (objs.length) nodeMeshes[i] = objs;
    }
    /* ---- 绑定蒙皮（需先更新世界矩阵，取 mesh.matrixWorld 为 bindMatrix）----
       ⚠️ **全流程只绑这一次**。之后任何"改根节点变换"的动作都会让 bindMatrix 过期；
       实测教训（v156.20）：归一化后再 `bind()` + `skeleton.calculateInverses()`
       看似"修正"，实际把静止姿态弄成非恒等 → 模型直接摊成一团。
       正解不是重绑，而是**别动根节点**：立姿/缩放/贴地全部施加在**外层容器**上
       （见下面 normalize 段），根节点保持载入时的原样，绑定永远有效。 */
    root.updateMatrixWorld(true);
    for (i = 0; i < nodes.length; i++) {
      var nm = nodes[i]; if (nm.mesh == null || nm.skin == null) continue;
      var sk2 = skeletons[nm.skin]; if (!sk2) continue;
      nodeObjs[i].children.forEach(function (ch) { if (ch.isSkinnedMesh) ch.bind(sk2, ch.matrixWorld); });
    }
    /* ---- 动画 ---- */
    var clips = [], byName = {};
    (gltf.animations || []).forEach(function (anim) {
      var tracks = [];
      (anim.channels || []).forEach(function (ch) {
        var s = anim.samplers[ch.sampler]; if (!s) return;
        var input = accArray(s.input), output = accArray(s.output);
        if (!input || !output) return;
        var times = new Float32Array(input), tnode = ch.target.node, path = ch.target.path;
        var nodeObj = nodeObjs[tnode]; if (!nodeObj) return;
        if (path === 'translation') tracks.push(new THREE.VectorKeyframeTrack(nodeObj.name + '.position', times, output));
        else if (path === 'rotation') tracks.push(new THREE.QuaternionKeyframeTrack(nodeObj.name + '.quaternion', times, output));
        else if (path === 'scale') tracks.push(new THREE.VectorKeyframeTrack(nodeObj.name + '.scale', times, output));
        else if (path === 'weights') {
          var meshes = nodeMeshes[tnode] || [];
          meshes.forEach(function (mesh) { tracks.push(new THREE.NumberKeyframeTrack(mesh.name + '.morphTargetInfluences', times, output)); });
        }
      });
      if (tracks.length) { var clip = new THREE.AnimationClip(anim.name, undefined, tracks); clips.push(clip); byName[anim.name] = clip; }
    });
    /* ============================================================
     * 朝向校正 + 归一化（默认开）—— **全部施加在外层容器 wrap 上**
     * ------------------------------------------------------------
     * 为什么是 wrap 而不是 root：蒙皮的 `bindMatrix` 是"绑定时"的根世界矩阵快照，
     *   一旦改根节点（哪怕只是加个 scale），蒙皮就按过期矩阵去算 —— 人当场摊成一团。
     *   （v156.20 实测：先试"重绑 + calculateInverses"，反而把静止姿态弄成非恒等，
     *     模型被放大到只剩一条手臂占屏；而外层容器缩放是干净有效的。）
     * 所以：root 保持载入原样（绑定永远有效），姿态/尺度/贴地记在 wrap 上，
     *   对外统一以 wrap 作为"模型根"返回。
     * 立姿判定见下：看"髋 → 头"是否朝上（T 姿的臂展比身高长，按跨度选会把人放平）。
     * ============================================================ */
    var out = root, meta = null;
    if (opts.normalize !== false) {
      try {
        var THREE2 = THREE;
        var target = opts.target || 1;
        var cands = [[0, 0, 0], [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [0, 0, -Math.PI / 2], [0, 0, Math.PI / 2]];
        var wrap = new THREE2.Group();
        wrap.add(root);
        wrap.updateMatrixWorld(true);
        var bonesAll = [];
        root.traverse(function (o) { if (o.isBone) bonesAll.push(o); });
        var wp = new THREE2.Vector3();
        var hipsB = null, headB = null;
        for (var bk = 0; bk < bonesAll.length; bk++) {
          var nmk = (bonesAll[bk].name || '').toLowerCase();
          if (!hipsB && /(hips|pelvis)/.test(nmk)) hipsB = bonesAll[bk];
          if (!headB && /head/.test(nmk)) headB = bonesAll[bk];
        }
        function upScore() {                       /* 脊椎方向与 +Y 的余弦（1=正立，-1=倒立） */
          if (!hipsB || !headB) return null;
          var a1 = new THREE2.Vector3(), a2 = new THREE2.Vector3();
          hipsB.getWorldPosition(a1); headB.getWorldPosition(a2);
          var d0 = a2.sub(a1);
          if (d0.lengthSq() < 1e-12) return null;
          return d0.normalize().y;
        }
        function spanY() {
          if (!bonesAll.length) return 0;
          var lo = Infinity, hi = -Infinity;
          for (var k = 0; k < bonesAll.length; k++) {
            bonesAll[k].getWorldPosition(wp);
            if (wp.y < lo) lo = wp.y;
            if (wp.y > hi) hi = wp.y;
          }
          return hi - lo;
        }
        var fit0 = (GTF.FIT && GTF.FIT[opts.name]) || null;
        var bestE = null, bestScore = -Infinity;
        if (fit0 && fit0.stand) {              /* 标定表给了立姿就直用（资产内部坐标系不一致时只能实测） */
          bestE = [fit0.stand[0] * Math.PI / 180, fit0.stand[1] * Math.PI / 180, fit0.stand[2] * Math.PI / 180];
          wrap.rotation.set(bestE[0], bestE[1], bestE[2]); wrap.updateMatrixWorld(true);
          bestScore = upScore() || 0;
        }
        for (var ci = 0; ci < cands.length && !(fit0 && fit0.stand); ci++) {
          wrap.rotation.set(cands[ci][0], cands[ci][1], cands[ci][2]);
          wrap.updateMatrixWorld(true);
          var us = upScore();
          var score = (us != null) ? us : (spanY() / 1000);   /* 无脊椎信息 → 退回跨度 */
          if (score > bestScore) { bestScore = score; bestE = cands[ci]; }
        }
        if (!bestE) bestE = cands[0];
        wrap.rotation.set(bestE[0], bestE[1], bestE[2]);
        wrap.updateMatrixWorld(true);
        /* ---- 尺度与贴地：**按标定表**（这两个资产的原生尺寸差 5 个数量级）----
           实测（.workbuddy/tools/show/calib_actor_fit.js，像素法）：
             Soldier          原生高 0.0033 → 缩到 1 需 ×307.4
             RobotExpressive  原生高 178    → 缩到 1 需 ×0.005617
           为什么不用包围盒/骨骼量：这两个模型的"绑定姿态"与"蒙皮结果"不在同一空间
           （骨骼世界跨度 1.55，而蒙皮出来的身体只有 0.0033），任何 CPU 侧包围盒
           （含 SkinnedMesh.computeBoundingBox）量出来都对不上屏幕，试过三种口径全错。
           标定值来自真实渲染的像素占比，误差 <3%。未知资产退回"骨骼跨度"，并留 meta 告警。 */
        var fit = (GTF.FIT && GTF.FIT[opts.name]) || null;
        var sc = 1;
        if (fit && fit.scale) sc = fit.scale;
        else {
          var bmin = Infinity, bmax = -Infinity;
          for (var q = 0; q < bonesAll.length; q++) {
            bonesAll[q].getWorldPosition(wp);
            if (wp.y < bmin) bmin = wp.y;
            if (wp.y > bmax) bmax = wp.y;
          }
          var hs = bmax - bmin;
          sc = (isFinite(hs) && hs > 1e-9) ? (target / hs) : 1;
        }
        wrap.scale.multiplyScalar(sc);
        if (fit && fit.footY) wrap.position.y += fit.footY;
        var h = sc;
        wrap.updateMatrixWorld(true);
        out = wrap;
        meta = { name: opts.name || null, fitted: !!fit, standRot: bestE.slice(), scale: +wrap.scale.x.toFixed(6),
          groundY: +wrap.position.y.toFixed(4), upScore: +bestScore.toFixed(4),
          hips: hipsB ? hipsB.name : null, head: headB ? headB.name : null };
      } catch (e) { out = root; meta = { err: String(e && e.message || e) }; }
    }
    return { root: out, clips: clips, byName: byName, skeletons: skeletons, meta: meta };
  };

  /* 浏览器入口：按 name（如 'Soldier' / 'RobotExpressive'）加载 assets/actors/<name>.glb。
     优先 base64 注入（file:// 无 CORS），否则注入 <script> 取 window.__ACTOR_GLB[name]，再 fallback fetch。 */
  GTF.loadAnimated = function (name, cb, opts) {
    opts = opts || {};
    var THREE = globalThis.THREE || (typeof window !== 'undefined' && window.THREE);
    var o2 = {}; for (var kk in opts) o2[kk] = opts[kk]; o2.name = o2.name || name;   /* v156.20：带名字进去查 FIT */
    function done(ab) { try { var res = GTF.parseAnimated(ab, THREE, o2); cb && cb(res); } catch (e) { cb && cb(null, e); } }
    var gb = (typeof window !== 'undefined' && window.__ACTOR_GLB && window.__ACTOR_GLB[name]);
    if (gb) { var buf = _actorB64Buf(gb); if (buf) return done(buf); }
    if (!document || !document.createElement) { cb && cb(null, new Error('loadAnimated 需要浏览器环境或直传 arrayBuffer')); return; }
    var sc = document.createElement('script');
    var _bv = 0;
    try { var _any = document.querySelector('script[src*="?v="]'); if (_any) { var _m = /[?&]v=(\d+)/.exec(_any.getAttribute('src') || ''); if (_m) _bv = _m[1]; } } catch (e) { }
    sc.src = 'assets/actors/' + name + '.glb.js' + (_bv ? ('?v=' + _bv) : '');
    sc.onload = function () { var b = window.__ACTOR_GLB && window.__ACTOR_GLB[name]; if (b) done(_actorB64Buf(b)); else cb && cb(null, new Error('actor base64 缺失：' + name)); };
    sc.onerror = function () { cb && cb(null, new Error('actor 脚本加载失败：' + name)); };
    (document.head || document.body || document.documentElement).appendChild(sc);
  };

  /* ============================================================
   * v92.00 角色控制器 + 技能→动作映射（"技能设定"锚点）
   * ------------------------------------------------------------
   * GAME.gltf.Actor：封装「加载 → mixer → 按技能名播放对应 clip → 每帧 update」。
   * 场景只需：var a=new GAME.gltf.Actor({name:'Soldier'}); a.load(cb); 渲染循环里 a.update(dt);
   *           状态变化时 a.skill('attack') / a.play('Walk')。
   * CLIP_MAPS：每个角色一套「技能键 → {clip, loop}」，集中管理便于调参（不散落各场景）。
   * ============================================================ */
  /* ============================================================
   * GTF.FIT —— 角色资产的**尺寸标定表**（把原生尺寸缩到"世界高 1 单位"）
   * ------------------------------------------------------------
   * 为什么必须手工标定：这两个资产的原生尺寸差 5 个数量级，而且
   *   "绑定姿态空间"与"蒙皮结果空间"不一致（骨骼世界跨度 1.55，
   *   蒙皮出来的身体只有 0.0033），CPU 侧任何包围盒都量不准屏幕上的大小。
   * 数值来自 .workbuddy/tools/show/calib_actor_fit.js 的真实渲染像素法（误差 <3%）：
   *   node .workbuddy/tools/show/calib_actor_fit.js
   * 新增资产：跑一次标定脚本，把 unitScale 抄进来即可（不标定就退回骨骼跨度，会偏）。
   * footY：贴地微调（脚底比原点低/高多少，标定渲染时量）。
   * ============================================================ */
  GTF.FIT = {
    Soldier: { scale: 69.0, footY: 0, stand: [90, 0, 0] },
    RobotExpressive: { scale: 0.2201, footY: 0, stand: [0, 0, 0] },
  };
  GTF.CLIP_MAPS = {
    RobotExpressive: {
      idle: { clip: 'Idle', loop: true }, walk: { clip: 'Walking', loop: true }, run: { clip: 'Running', loop: true },
      attack: { clip: 'Punch', loop: false }, jump: { clip: 'Jump', loop: false }, guard: { clip: 'Standing', loop: true },
      victory: { clip: 'Wave', loop: false }, defeat: { clip: 'Death', loop: false }, dance: { clip: 'Dance', loop: true },
      yes: { clip: 'Yes', loop: false }, no: { clip: 'No', loop: false }, sit: { clip: 'Sitting', loop: true },
      /* v156.20：斗将 3D 舞台要"受击"这个语义动作。Robot 的 No 是摇头/缩身，做挨打反应正合适 */
      hurt: { clip: 'No', loop: false },
    },
    Soldier: {
      idle: { clip: 'Idle', loop: true }, walk: { clip: 'Walk', loop: true }, run: { clip: 'Run', loop: true },
      attack: { clip: 'Run', loop: false }, jump: { clip: 'Idle', loop: false }, guard: { clip: 'Idle', loop: true },
      victory: { clip: 'Idle', loop: false }, defeat: { clip: 'Idle', loop: false }, dance: { clip: 'Idle', loop: true },
      yes: { clip: 'Idle', loop: false }, no: { clip: 'Idle', loop: false }, sit: { clip: 'TPose', loop: true },
      /* Soldier 只有 4 段（Idle/Run/Walk/TPose）：受击没有专用动作，回 Idle 靠位移补 */
      hurt: { clip: 'Idle', loop: false },
    },
  };
  GTF.Actor = function (opts) {
    opts = opts || {};
    this.name = opts.name;
    this.root = null; this.clips = []; this.byName = {}; this.skeletons = null;
    this.mixer = null; this.current = null; this.currentName = null;
    this.clipMap = opts.clipMap || GTF.CLIP_MAPS[this.name] || {};
    this._THREE = (typeof globalThis !== 'undefined' && globalThis.THREE) || (typeof window !== 'undefined' && window.THREE) || null;
    this.fade = opts.fade != null ? opts.fade : 0.25;
  };
  GTF.Actor.prototype.load = function (cb, opts) {
    var self = this;
    GTF.loadAnimated(this.name, function (res, err) {
      if (err || !res) { cb && cb(null, err); return; }
      self.root = res.root; self.clips = res.clips; self.byName = res.byName; self.skeletons = res.skeletons;
      var THREE = (typeof globalThis !== 'undefined' && globalThis.THREE) || (typeof window !== 'undefined' && window.THREE);
      self._THREE = THREE;
      self.mixer = new THREE.AnimationMixer(res.root);
      cb && cb(self);
    }, opts);
  };
  /* 播放某 clip（带淡入淡出切换）；已在该 clip 且仍运行则跳过。返回是否成功。 */
  GTF.Actor.prototype.play = function (clipName, o) {
    o = o || {};
    var clip = this.byName[clipName]; if (!clip || !this.mixer) return false;
    if (this.currentName === clipName && this.current && this.current.isRunning()) return true;
    var THREE = this._THREE; if (!THREE) return false;
    var action = this.mixer.clipAction(clip);
    action.reset();
    if (o.loop === false) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
    else { action.setLoop(THREE.LoopRepeat, Infinity); }
    action.enabled = true; action.setEffectiveWeight(1); action.play();
    if (this.current && this.current !== action) this.current.fadeOut(this.fade);
    action.fadeIn(this.fade);
    this.current = action; this.currentName = clipName;
    return true;
  };
  /* 技能键 → 对应 clip（CLIP_MAPS）。找不到映射或映射的 clip 不存在则返回 false。 */
  GTF.Actor.prototype.skill = function (key) {
    var e = this.clipMap[key]; if (!e) return false;
    return this.play(e.clip, { loop: e.loop });
  };
  GTF.Actor.prototype.update = function (dt) { if (this.mixer) this.mixer.update(dt); };

  GAME.gltf = GTF;
  GAME.gltfVersion = 'v92.00';   /* 成员定义锚（供 audit ⑥ 识别 · 见 audit.js 白名单） */
})();
