/* probe_terrain_size.js —— 量化「同类型地形团块大小」（v89.46 碎片调参用）
 * 忠实复刻 map.js generate() 的核心：fBm 连续场 + 分位切分。
 * 只换 FIELD_OCT，看团块均值 / 连片度，把同类型地块缩到当前的 1/2~1/3。
 * 直接 node 跑：node tools/probe/probe_terrain_size.js
 */
function nhash(ix, iy, salt) {
  var h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491); h ^= h >>> 13;
  return (h >>> 8) / 16777216;
}
function vnoise(x, y, step, salt) {
  var fx = x / step, fy = y / step, ix = Math.floor(fx), iy = Math.floor(fy);
  var tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  var a = nhash(ix, iy, salt), b = nhash(ix + 1, iy, salt), c = nhash(ix, iy + 1, salt), d = nhash(ix + 1, iy + 1, salt);
  var t0 = a + (b - a) * tx, t1 = c + (d - c) * tx; return t0 + (t1 - t0) * ty;
}
function mkFbm(FIELD_OCT) {
  return function (x, y, salt) {
    var v = 0; for (var i = 0; i < FIELD_OCT.length; i++) v += FIELD_OCT[i][1] * vnoise(x, y, FIELD_OCT[i][0], salt + i * 101);
    return v;
  };
}
function qOf(hist, total, frac) {
  var want = total * frac, acc = 0;
  for (var i = 0; i < hist.length; i++) { acc += hist[i]; if (acc >= want) return (i + 0.5) / hist.length; }
  return 1;
}
var TW = [['plain', 0.18], ['caoyuan', 0.14], ['zhaoze', 0.12], ['lake', 0.10], ['forest', 0.18], ['desert', 0.12], ['hill', 0.16]];
var W = {}; TW.forEach(function (p) { W[p[0]] = p[1]; });
var TYPES = ['plain', 'caoyuan', 'zhaoze', 'lake', 'forest', 'desert', 'hill'];
var TID = {}; TYPES.forEach(function (t, i) { TID[t] = i; });
var MAP_W = 500, MAP_H = 500, ST = 2;

function generate(FIELD_OCT, seed0) {
  var fbm = mkFbm(FIELD_OCT);
  var gw = Math.ceil(MAP_W / ST) + 1, gh = Math.ceil(MAP_H / ST) + 1;
  var fe = new Float32Array(gw * gh), fm = new Float32Array(gw * gh);
  for (var gy2 = 0; gy2 < gh; gy2++) for (var gx2 = 0; gx2 < gw; gx2++) {
    var px = gx2 * ST, py = gy2 * ST, kk = gy2 * gw + gx2;
    fe[kk] = fbm(px, py, seed0 * 7 + 11); fm[kk] = fbm(px, py, seed0 * 7 + 77);
  }
  function sampleF(arr, x, y) {
    var fx = x / ST, fy = y / ST, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
    var x1 = Math.min(gw - 1, ix + 1), y1 = Math.min(gh - 1, iy + 1);
    var a = arr[iy * gw + ix], b = arr[iy * gw + x1], c = arr[y1 * gw + ix], d = arr[y1 * gw + x1];
    var t0 = a + (b - a) * tx, t1 = c + (d - c) * tx; return t0 + (t1 - t0) * ty;
  }
  var elev = new Float32Array(MAP_W * MAP_H), moist = new Float32Array(MAP_W * MAP_H);
  var BINS = 512, eh = new Int32Array(BINS), mh = new Int32Array(BINS);
  for (var yy = 0; yy < MAP_H; yy++) for (var xx = 0; xx < MAP_W; xx++) {
    var id = yy * MAP_W + xx, e = sampleF(fe, xx, yy), m = sampleF(fm, xx, yy);
    elev[id] = e; moist[id] = m; eh[Math.min(BINS - 1, (e * BINS) | 0)]++;
  }
  var total = MAP_W * MAP_H;
  var qLake = qOf(eh, total, W.lake), qWater = qOf(eh, total, W.lake + W.zhaoze), qHill = qOf(eh, total, 1 - W.hill);
  var landN = 0, landFrac = 1 - W.lake - W.zhaoze - W.hill;
  for (var i2 = 0; i2 < total; i2++) if (elev[i2] >= qWater && elev[i2] < qHill) { mh[Math.min(BINS - 1, (moist[i2] * BINS) | 0)]++; landN++; }
  var qDes = qOf(mh, landN, W.desert / landFrac), qFor = qOf(mh, landN, 1 - W.forest / landFrac), qCao = qOf(mh, landN, 1 - (W.forest + W.caoyuan) / landFrac);
  var terr = new Uint8Array(total);
  for (var y = 0; y < MAP_H; y++) for (var x = 0; x < MAP_W; x++) {
    var id3 = y * MAP_W + x, e3 = elev[id3], m3 = moist[id3], t;
    if (e3 < qLake) t = 'lake'; else if (e3 < qWater) t = 'zhaoze'; else if (e3 >= qHill) t = 'hill';
    else if (m3 < qDes) t = 'desert'; else if (m3 >= qFor) t = 'forest'; else if (m3 >= qCao) t = 'caoyuan'; else t = 'plain';
    terr[id3] = TID[t];
  }
  return terr;
}
function metrics(terr) {
  var total = terr.length, cells = new Array(7).fill(0), visited = new Uint8Array(total), patches = new Array(7).fill(0);
  for (var i = 0; i < total; i++) cells[terr[i]]++;
  var stack = [];
  for (var s = 0; s < total; s++) {
    var st = terr[s]; if (visited[s]) continue; patches[st]++; stack.push(s); visited[s] = 1;
    while (stack.length) {
      var c = stack.pop(), cx = c % MAP_W, cy = (c / MAP_W) | 0;
      var nb = []; if (cx + 1 < MAP_W) nb.push(c + 1); if (cx - 1 >= 0) nb.push(c - 1);
      if (cy + 1 < MAP_H) nb.push(c + MAP_W); if (cy - 1 >= 0) nb.push(c - MAP_W);
      for (var k = 0; k < nb.length; k++) { var n = nb[k]; if (!visited[n] && terr[n] === st) { visited[n] = 1; stack.push(n); } }
    }
  }
  var sameN = 0, nCount = 0;
  for (var y = 0; y < MAP_H; y++) for (var x = 0; x < MAP_W; x++) {
    var id = y * MAP_W + x, t = terr[id], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var d = 0; d < 4; d++) {
      var nx = x + dirs[d][0], ny = y + dirs[d][1];
      nCount++; if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && terr[ny * MAP_W + nx] === t) sameN++;
    }
  }
  var lianpian = sameN / nCount, totalPatches = 0;
  for (var tt = 0; tt < 7; tt++) totalPatches += patches[tt];
  var avgAll = total / totalPatches;
  return { cells: cells, patches: patches, avgAll: avgAll, lianpian: lianpian };
}

var SEEDS = [1, 777, 20260919];
var CANDIDATES = [
  { name: '当前[32,16,8]', oct: [[32, 0.55], [16, 0.30], [8, 0.15]] },
  { name: '候选A[24,12,7]', oct: [[24, 0.55], [12, 0.30], [7, 0.15]] },
  { name: '候选B[21,11,6]', oct: [[21, 0.55], [11, 0.30], [6, 0.15]] },
  { name: '候选C[18,9,5]', oct: [[18, 0.55], [9, 0.30], [5, 0.15]] }
];
console.log('FIELD_OCT            连片度   团块均值   占比误差(pp,max)');
CANDIDATES.forEach(function (c) {
  var avgSum = 0, lpSum = 0, errMax = 0;
  SEEDS.forEach(function (sd) {
    var terr = generate(c.oct, sd), m = metrics(terr);
    avgSum += m.avgAll; lpSum += m.lianpian;
    for (var t = 0; t < 7; t++) { var frac = m.cells[t] / m.total; var err = Math.abs(frac - W[TYPES[t]]) * 100; if (err > errMax) errMax = err; }
  });
  console.log(
    c.name.padEnd(20) +
    (lpSum / SEEDS.length).toFixed(3) + '   ' +
    Math.round(avgSum / SEEDS.length).toString().padStart(6) + '     ' +
    errMax.toFixed(2)
  );
});
console.log('（占比如实由分位切分锁定目标权重，与波长无关；误差来自离散分桶，应 ≤0.3pp）');
