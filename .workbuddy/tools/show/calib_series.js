/* 建筑图标系列配色标定（v2）。
   修正 v1 三处：① printf 用 %3d 非法导致数字错位 ② brightness 上界 1.4 被搜索边界卡住
   ③ 平均色受暗部拖累 → 改**亮度加权**平均（亮部权重更大，更接近视觉感受）。

   目标色按**色相环 + 明度**双维度分配，保证 7 个系列两两可分：
     H:  15(赭红) 35~41(土褐/暖黄/金) 122(竹青) 170(青碧) 210(铁青)
     live 与 store 同处暖色区，靠**明度**区分（L61 亮黄 vs L42 暗褐）。 */
const fs = require('fs');
const { PNG } = require('pngjs');

const DIR = 'E:/Deepseekdb/assets/icons/ui/';
const SER = [
  { key: 'mil', file: 'ai_junying.png', bld: '军营/校场/烽火台', target: '#7C93A8', note: '铁青（提亮，不是压暗的灰）' },
  { key: 'edu', file: 'ai_shuyuan.png', bld: '书院/招贤馆', target: '#6F9070', note: '竹青' },
  { key: 'road', file: 'ai_yizhan.png', bld: '驿站', target: '#6E9E96', note: '青碧（驿亭青瓦）' },
  { key: 'biz', file: 'ai_shichang.png', bld: '市场/铁匠铺/作坊', target: '#B26045', note: '赭红（炉火摊铺）' },
  { key: 'store', file: 'ai_cangku.png', bld: '仓库/马厩', target: '#8F7A50', note: '深土褐' },
  { key: 'live', file: 'ai_minfang.png', bld: '民房/客栈', target: '#C9A96E', note: '暖黄' },
];

function mul(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
function mSepia(a) { return [0.393 + 0.607 * (1 - a), 0.769 - 0.769 * (1 - a), 0.189 - 0.189 * (1 - a), 0.349 - 0.349 * (1 - a), 0.686 + 0.314 * (1 - a), 0.168 - 0.168 * (1 - a), 0.272 - 0.272 * (1 - a), 0.534 - 0.534 * (1 - a), 0.131 + 0.869 * (1 - a)]; }
function mSat(s) { return [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]; }
function mHue(deg) { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
          0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
          0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]; }

function applyChain(px, chain) {
  return chain.reduce((v, f) => {
    if (f[0] === 'sepia') return mul(mSepia(f[1]), v);
    if (f[0] === 'saturate') return mul(mSat(f[1]), v);
    if (f[0] === 'huerotate') return mul(mHue(f[1]), v);
    if (f[0] === 'brightness') return v.map(x => Math.min(1, x * f[1]));
    if (f[0] === 'contrast') return v.map(x => Math.min(1, Math.max(0, (x - 0.5) * f[1] + 0.5)));
    return v;
  }, px.map(x => x / 255));
}

/* 采样不透明像素（步长采样，最多 ~3000 个），返回加权平均色 */
function sample(file, step) {
  const p = PNG.sync.read(fs.readFileSync(DIR + file));
  const out = [];
  const total = (p.width * p.height) / (step * step);
  const s = Math.max(1, Math.floor(step * Math.sqrt(total / 3000)));
  for (let y = 0; y < p.height; y += s) for (let x = 0; x < p.width; x += s) {
    const i = (y * p.width + x) * 4;
    if (p.data[i + 3] < 140) continue;
    out.push([p.data[i] / 255, p.data[i + 1] / 255, p.data[i + 2] / 255]);
  }
  return out;
}
/* 亮度加权平均（亮部权重 0.6 + 1.4·luma，暗部仍有 0.6 底权重） */
function wavg(pixels) {
  let r = 0, g = 0, b = 0, w = 0;
  pixels.forEach(p => {
    const L = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    const k = 0.6 + 1.4 * L;
    r += p[0] * k; g += p[1] * k; b += p[2] * k; w += k;
  });
  return [r / w * 255, g / w * 255, b / w * 255];
}
function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgb2hsl(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let s = 0, h = 0;
  if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; }
  return { h, s: s * 100, l: l * 100 };
}
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
function dist(a, b) { let dh = Math.abs(a.h - b.h); if (dh > 180) dh = 360 - dh; return dh + Math.abs(a.s - b.s) * 0.55 + Math.abs(a.l - b.l) * 0.85; }

console.log('系列    代表建筑            原始平均色(H/S/L)     目标色(H/S/L)        原始色距');
console.log('─'.repeat(100));
const R = [];
SER.forEach(s => {
  const px = sample(s.file, 4);
  const oh = rgb2hsl(wavg(px));
  const th = rgb2hsl(hex2rgb(s.target));
  R.push({ ...s, px, oh, th, d0: dist(oh, th) });
  console.log(s.key.padEnd(7) + s.bld.padEnd(18) + (Math.round(oh.h) + '/' + Math.round(oh.s) + '/' + Math.round(oh.l)).padEnd(22)
    + (Math.round(th.h) + '/' + Math.round(th.s) + '/' + Math.round(th.l)).padEnd(20) + f1(dist(oh, th)));
});

console.log('\n═══ 搜索滤镜参数 ═══');
const out = [];
R.forEach(r => {
  /* 关键优化：sepia / saturate / hue-rotate 都是**线性矩阵**，
     而 brightness / contrast 只是在两端做钳制（平均色不贴边，线性近似成立）。
     因此 applyChain(平均色) ≈ 平均(applyChain(逐像素))，
     只对 1 个"平均像素"做变换即可，组合数 150 万也能秒出。 */
  const base = wavg(r.px);
  let best = null;
  for (let A = 1.0; A <= 3.4; A += 0.2)
    for (let N = -180; N <= 180; N += 3)
      for (let B = 0.7; B <= 1.6; B += 0.1)
        for (let L = 0.85; L <= 1.75; L += 0.05)
          for (let C = 1.0; C <= 1.16; C += 0.04) {
            const cc = +C.toFixed(2);
            const oh = rgb2hsl(applyChain(base, [['saturate', A], ['huerotate', N], ['saturate', B], ['brightness', L], ['contrast', cc]]).map(x => x * 255));
            const d = dist(oh, r.th);
            if (!best || d < best.d) best = { d, A: +A.toFixed(1), N, B: +B.toFixed(1), L: +L.toFixed(2), C: cc, oh };
          }
  console.log('\n' + r.key + '（' + r.bld + '）  目标 ' + r.target + ' = H' + Math.round(r.th.h) + ' S' + Math.round(r.th.s) + ' L' + Math.round(r.th.l));
  console.log('   标定后 H' + Math.round(best.oh.h) + ' S' + Math.round(best.oh.s) + ' L' + Math.round(best.oh.l)
    + '   色距 ' + f1(best.d) + '（原始 ' + f1(r.d0) + '）');
  out.push({ key: r.key, A: best.A, N: best.N, B: best.B, L: best.L, C: best.C });
});

console.log('\n\n═══ 可直接粘进 index.html ═══');
const SHADOW = ' drop-shadow(0 2px 3px rgba(0,0,0,.42))';
out.forEach(o => {
  console.log('.iso-tile.ser-' + o.key.padEnd(6) + ' .tile-art img.ico-img { filter: saturate(' + o.A
    + ') hue-rotate(' + o.N + 'deg) saturate(' + o.B + ') brightness(' + o.L + ') contrast(' + o.C + ')' + SHADOW + '; }');
});
