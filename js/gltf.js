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
    /* 无环境贴图 → 金属会发黑；奇观又常处背光面 → 用**漫反射 + 自发光**（贴图兼作 emissive），
       使天体在阴影里也柔和自发光，更像"奇观天体"。 */
    /* 用 **MeshBasicMaterial**（不受光照）—— 贴图始终满亮显示，天体在任意光照/背光面都清晰。 */
    var mat = new THREE.MeshBasicMaterial({
      side: part.doubleSided ? THREE.DoubleSide : THREE.FrontSide, color: 0xffffff,
    });
    try {
      if (part.map) {
        var u = part.map, bmp = new Image();
        bmp.onload = function () {
          try {
            var tx = new THREE.Texture(bmp); tx.needsUpdate = true;
            if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace;
            mat.map = tx; mat.needsUpdate = true;
          } catch (e) { }
          try { URL.revokeObjectURL(u); } catch (e) { }
          if (onReady) onReady();
        };
        bmp.onerror = function () { try { URL.revokeObjectURL(u); } catch (e) { } };
        bmp.src = u;
      }
      /* MeshBasicMaterial 无 normalMap（r150）→ 不赋（自发光平面化，奇观够用）。 */
      if (part.normalMap) { try { URL.revokeObjectURL(part.normalMap); } catch (e) { } }
    } catch (e) { }
    return mat;
  };

  GAME.gltf = GTF;
  GAME.gltfVersion = 'v91.30';   /* 成员定义锚（供 audit ⑥ 识别 · 见 audit.js 白名单） */
})();
