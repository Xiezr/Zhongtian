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

    var parts = [];
    (gltf.meshes || []).forEach(function (mesh) {
      (mesh.primitives || []).forEach(function (prim) {
        if ((prim.mode != null) && prim.mode !== 4) return;   /* 只取三角形 */
        var at = prim.attributes || {};
        if (at.POSITION == null) return;
        var pos = accArray(gltf, bin, at.POSITION); if (!pos) return;
        var nor = (at.NORMAL != null) ? accArray(gltf, bin, at.NORMAL) : null;
        var uv = (at.TEXCOORD_0 != null) ? accArray(gltf, bin, at.TEXCOORD_0) : null;
        var idx = (prim.indices != null) ? accArray(gltf, bin, prim.indices) : null;
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
