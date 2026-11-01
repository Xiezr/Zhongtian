'use strict';
var fs = require('fs');
var p = '.workbuddy/tools/show/probe_admin_reveal.js';
var s = fs.readFileSync(p, 'utf8');

/* ① 机位：用省府城所在格定向（省府必在陆地），而不是辖地陆地质心（该省半数是海） */
var oldCam = `    /* 机位：该省陆地质心 */
    var list = G.map.adminCiList('prov', best.admIndex);
    var ax = 0, ay = 0, az = 0, n2 = 0;
    for (var i = 0; i < list.length; i++) {
      var c2 = SP.cells[list[i]];
      if (!c2 || !c2.dir) continue;
      var t = c2.type || '';
      if (t === 'ocean' || t === 'sea' || t === 'lake') continue;
      ax += c2.dir[0]; ay += c2.dir[1]; az += c2.dir[2]; n2++;
    }
    var L = Math.hypot(ax, ay, az) || 1;
    var o = M.camO; M.clearFocus && M.clearFocus(); M.camFree = true;
    o.yaw = Math.atan2(ax / L, az / L);
    o.pitch = Math.asin(ay / L) + 0.55;
    o.dist = M.ZOOM_MIN + 165;`;
var newCam = `    /* 机位：**省府所在格**定向。
       （不用辖地质心：该省一半是海，质心常落洋面 —— 实测第一次就拍到一片纯蓝） */
    var c2 = SP.cells[best.ci] || null;
    var d2 = (c2 && c2.dir) || [0, 1, 0];
    var L = Math.hypot(d2[0], d2[1], d2[2]) || 1;
    var o = M.camO; M.clearFocus && M.clearFocus(); M.camFree = true;
    o.yaw = Math.atan2(d2[0] / L, d2[2] / L);
    o.pitch = Math.asin(d2[1] / L) + 0.42;
    o.dist = M.ZOOM_MIN + 120;`;
if (s.indexOf(oldCam) < 0) { console.error('cam anchor miss'); } else { s = s.replace(oldCam, newCam); console.log('camera → 省府格'); }

/* ② 测试顺序：邻省守卫必须在占市府之前；decay 断言改为"褪色后自动补回" + 反例守卫 */
var oldT = `    /* 市府：占一座，检查该市全明且不越过本省之外 */`;
var newT = `    /* 邻省守卫要**先测**：后面会占一座市府，市府可能恰在邻省境内，
       那样"邻省有全明格"就是正当的（那是它自己的市府），会让这条断言失去意义。 */
    var provs0 = (G.map3d.admCities || []).filter(function (c) { return c.admLevel === 'prov'; });
    var other0 = provs0.filter(function (c) { return c.admIndex !== pick.admIndex; })[0];
    var ol0 = G.map.adminCiList('prov', other0.admIndex), of0 = 0;
    for (var k0 = 0; k0 < ol0.length; k0++) if (F.get(ol0[k0]) >= F.ALL) of0++;
    out.otherProv = { name: other0.name, size: ol0.length, full: of0 };

    /* 市府：占一座，检查该市全明 */`;
if (s.indexOf(oldT) < 0) { console.error('tier anchor miss'); } else { s = s.replace(oldT, newT); console.log('邻省守卫前提'); }

/* 删掉旧的邻省守卫块（后面那份） */
var oldOther = `    /* 邻省守卫 */
    var provs = (G.map3d.admCities || []).filter(function (c) { return c.admLevel === 'prov'; });
    var other = provs.filter(function (c) { return c.admIndex !== pick.admIndex; })[0];
    var ol = G.map.adminCiList('prov', other.admIndex), of = 0;
    for (var k = 0; k < ol.length; k++) if (F.get(ol[k]) >= F.ALL) of++;
    out.otherProv = { name: other.name, size: ol.length, full: of };

`;
if (s.indexOf(oldOther) >= 0) { s = s.replace(oldOther, ''); console.log('重复邻省块已删'); }

/* ③ decay 断言：这是"建制内不褪色"，要正着验它 + 反例（把城撤掉后必须褪） */
var oldD = `    var provList = G.map.adminCiList('prov', pick.admIndex);
    var nDecay = F.decay(true);
    var afterDecay = 0;
    for (var q = 0; q < provList.length; q++) if (F.get(provList[q]) >= F.ALL) afterDecay++;
    out.decayedFull = afterDecay;          /* 应该大幅下降（全明 → 半明） */
    F.revealOwned();
    var afterOwned = 0;
    for (var w = 0; w < provList.length; w++) if (F.get(provList[w]) >= F.ALL) afterOwned++;
    out.restoredFull = afterOwned;         /* 应恢复到 100% */
    out.decayCount = nDecay;`;
var newD = `    var provList = G.map.adminCiList('prov', pick.admIndex);
    /* ① 正着验：decay 把全明褪成半明，但 \`decay()\` 内部会调 revealOwned，
          "建制内"的辖地应当**当场补回**全明（与自家城周围同款待遇）。 */
    var nDecay = F.decay(true);
    var afterDecay = 0;
    for (var q = 0; q < provList.length; q++) if (F.get(provList[q]) >= F.ALL) afterDecay++;
    out.decayedFull = afterDecay;
    out.decayCount = nDecay;
    /* ② 反例守卫：**把带行政身份的城撤掉**再 decay —— 辖地必须真的褪色。
          否则"永远全明"可能来自别的东西（比如整张图早被别处点亮），
          这条断言就变成装饰品。 */
    var removed = (G.state.cities || []).filter(function (c) { return c.admLevel === 'prov' && c.admIndex === pick.admIndex; });
    G.state.cities = (G.state.cities || []).filter(function (c) { return !(c.admLevel === 'prov' && c.admIndex === pick.admIndex); });
    var nDecay2 = F.decay(true);
    var afterDrop = 0;
    for (var w2 = 0; w2 < provList.length; w2++) if (F.get(provList[w2]) >= F.ALL) afterDrop++;
    out.fullWithoutCity = afterDrop;       /* 应远小于 100%，证明全明确实依赖那座城 */
    /* ③ 恢复城 → revealOwned 应把辖地补回全明（读档路径） */
    G.state.cities = (G.state.cities || []).concat(removed);
    F.revealOwned();
    var restored = 0;
    for (var w3 = 0; w3 < provList.length; w3++) if (F.get(provList[w3]) >= F.ALL) restored++;
    out.restoredFull = restored;
    out.decay2Count = nDecay2;`;
if (s.indexOf(oldD) < 0) { console.error('decay anchor miss'); } else { s = s.replace(oldD, newD); console.log('decay 断言重写'); }

fs.writeFileSync(p, s, 'utf8');
console.log('probe patched');
