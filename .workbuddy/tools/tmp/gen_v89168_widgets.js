/* v89.168 生成两张曲线图 SVG（widget 用）
   输出：.workbuddy/tmp/widget1_expcurve.svg / widget2_expdelta.svg */
var fs = require('fs');
var J = JSON.parse(fs.readFileSync('E:/Deepseekdb/.workbuddy/tmp/expcurve_v89168.json', 'utf8'));
var rows = J.rows;
function need(lv) { return rows[lv - 1].need; }
function delta(lv) { return rows[lv - 1].delta; }
function chunk(str, n) {
  var p = str.split(' '), out = [];
  for (var i = 0; i < p.length; i += n) out.push(p.slice(i, i + n).join(' '));
  return out.join('\n      ');
}

/* ---------- 面板 A：线性 x64..648, y222(0)..36(1e6) ---------- */
function ax(lv) { return (64 + (lv - 1) / 239 * 584).toFixed(1); }
function ay(v) { return (222 - (v / 1000000) * 186).toFixed(1); }
var PA = chunk(rows.map(function (r) { return ax(r.lv) + ',' + ay(r.need); }).join(' '), 14);

/* ---------- 面板 B：对数 x同, y468(log41)..282(log1e6) ---------- */
var lmin = Math.log10(41), lmax = 6;
function by(v) { return (468 - (Math.log10(v) - lmin) / (lmax - lmin) * 186).toFixed(1); }
var PB = chunk(rows.map(function (r) { return ax(r.lv) + ',' + by(r.need); }).join(' '), 14);

/* ---------- 面板 C：增量 x64..648(lv2..60), y250(0)..40(60) ---------- */
function cx(lv) { return (64 + (lv - 2) / 58 * 584).toFixed(1); }
function cy(v) { return (250 - (v / 60) * 210).toFixed(1); }
var pcs = [];
for (var lv = 2; lv <= 60; lv++) pcs.push(cx(lv) + ',' + cy(delta(lv)));
var PC = chunk(pcs.join(' '), 14);

var G1 = '#378ADD', G2 = '#D85A30';
var T1 = 'var(--color-text-primary)', T2 = 'var(--color-text-secondary)', T3 = 'var(--color-text-tertiary)';
var GL = 'var(--color-border-tertiary)', GL2 = 'var(--color-border-secondary)';

/* ============ 图 1 ============ */
var s = [];
s.push('<svg viewBox="0 0 680 512" role="img" style="width:100%;height:auto;display:block;font-family:var(--font-sans,system-ui,sans-serif)">');
s.push('<title>将领经验需求曲线：240 级逐点，线性与对数双刻度</title>');
s.push('<desc>上图线性刻度：Lv240 单级需 100 万经验，前 180 级几乎贴底。下图对数刻度：曲线分两段，Lv1 到 30 为二次起步 41 到 490，Lv31 到 240 为指数段每级乘 1.037，Lv30 到 31 处有一个折角。</desc>');
/* 面板 A */
s.push('<text x="64" y="20" font-size="13" font-weight="500" fill="' + T1 + '">单级升级所需经验（Lv1 → Lv240）· 线性刻度</text>');
[[175.5, '25万'], [129, '50万'], [82.5, '75万'], [36, '100万']].forEach(function (g) {
  s.push('<line x1="64" y1="' + g[0] + '" x2="648" y2="' + g[0] + '" stroke="' + GL + '" stroke-width="1"/>');
  s.push('<text x="58" y="' + (g[0] + 4) + '" font-size="11" text-anchor="end" fill="' + T3 + '">' + g[1] + '</text>');
});
s.push('<text x="58" y="226" font-size="11" text-anchor="end" fill="' + T3 + '">0</text>');
[208.2, 354.8, 501.5].forEach(function (x) {
  s.push('<line x1="' + x + '" y1="36" x2="' + x + '" y2="222" stroke="' + GL + '" stroke-width="1"/>');
});
s.push('<line x1="64" y1="222" x2="648" y2="222" stroke="' + GL2 + '" stroke-width="1"/>');
s.push('<polyline points="' + PA + '" fill="none" stroke="' + G1 + '" stroke-width="2" stroke-linejoin="round"/>');
s.push('<circle cx="550.3" cy="178.4" r="2.5" fill="' + G1 + '"/>');
s.push('<circle cx="648" cy="36" r="3" fill="' + G1 + '"/>');
s.push('<text x="546" y="166" font-size="11" text-anchor="end" fill="' + T2 + '">Lv200：单级 23.4 万</text>');
s.push('<text x="630" y="60" font-size="11" text-anchor="end" fill="' + T2 + '">Lv240：单级 100 万</text>');
s.push('<text x="92" y="192" font-size="11" fill="' + T3 + '">Lv1~180 全压在这一带（≤ 11.3 万）</text>');
[['64', '1', 'start'], ['208.2', '60', 'middle'], ['354.8', '120', 'middle'], ['501.5', '180', 'middle'], ['648', '240', 'end']].forEach(function (t) {
  s.push('<text x="' + t[0] + '" y="234" font-size="11" text-anchor="' + t[2] + '" fill="' + T3 + '">' + t[1] + '</text>');
});
/* 面板 B */
s.push('<text x="64" y="268" font-size="13" font-weight="500" fill="' + T1 + '">同一曲线 · 对数刻度（看形状）</text>');
[[451.6, '100'], [409.2, '1千'], [366.8, '1万'], [324.4, '10万'], [282, '100万']].forEach(function (g) {
  s.push('<line x1="64" y1="' + g[0] + '" x2="648" y2="' + g[0] + '" stroke="' + GL + '" stroke-width="1"/>');
  s.push('<text x="58" y="' + (g[0] + 4) + '" font-size="11" text-anchor="end" fill="' + T3 + '">' + g[1] + '</text>');
});
[208.2, 354.8, 501.5].forEach(function (x) {
  s.push('<line x1="' + x + '" y1="282" x2="' + x + '" y2="468" stroke="' + GL + '" stroke-width="1"/>');
});
s.push('<line x1="134.9" y1="282" x2="134.9" y2="468" stroke="' + GL2 + '" stroke-width="1" stroke-dasharray="3 3"/>');
s.push('<line x1="64" y1="468" x2="648" y2="468" stroke="' + GL2 + '" stroke-width="1"/>');
s.push('<polyline points="' + PB + '" fill="none" stroke="' + G1 + '" stroke-width="2" stroke-linejoin="round"/>');
s.push('<circle cx="134.9" cy="422.3" r="3" fill="' + G2 + '"/>');
s.push('<circle cx="648" cy="282" r="2.5" fill="' + G1 + '"/>');
s.push('<text x="78" y="302" font-size="11" fill="' + T2 + '">① 二次起步 Lv1~30：41 → 490</text>');
s.push('<text x="152" y="436" font-size="11" fill="' + G2 + '">折角：每级增幅 +29 → +18</text>');
s.push('<text x="152" y="452" font-size="11" fill="' + G2 + '">（Lv44 才回到 +29）</text>');
s.push('<text x="445" y="442" font-size="11" fill="' + T2 + '">② 指数段 Lv31~240（对数轴上为直线）</text>');
s.push('<text x="445" y="458" font-size="11" fill="' + T2 + '">每级 ×1.037（+3.7%）</text>');
[['64', '1', 'start'], ['208.2', '60', 'middle'], ['354.8', '120', 'middle'], ['501.5', '180', 'middle'], ['648', '240', 'end']].forEach(function (t) {
  s.push('<text x="' + t[0] + '" y="481" font-size="11" text-anchor="' + t[2] + '" fill="' + T3 + '">' + t[1] + '</text>');
});
s.push('<text x="134.9" y="481" font-size="11" text-anchor="middle" fill="' + G2 + '">Lv30</text>');
s.push('<text x="64" y="503" font-size="11" fill="' + T3 + '">x：将领等级 · y：升到下一级所需经验（单级）· DATA.EXP_CURVE 240 级逐点实算</text>');
s.push('</svg>');
fs.writeFileSync('E:/Deepseekdb/.workbuddy/tmp/widget1_expcurve.svg', s.join('\n'), 'utf8');

/* ============ 图 2 ============ */
var s2 = [];
s2.push('<svg viewBox="0 0 680 310" role="img" style="width:100%;height:auto;display:block;font-family:var(--font-sans,system-ui,sans-serif)">');
s2.push('<title>每级需求涨幅曲线：Lv2 到 60 放大，Lv31 处回落</title>');
s2.push('<desc>折线图。每级涨幅从 Lv2 的 1 一路加速到 Lv30 的 29，Lv31 突然回落到 18，直到 Lv44 才回到 29，此后复合增长，Lv60 时已达 52。</desc>');
s2.push('<text x="64" y="20" font-size="13" font-weight="500" fill="' + T1 + '">每级需求的「涨幅 Δ」（Lv2~60 放大 · 线性刻度）</text>');
[[180, '20'], [110, '40'], [40, '60']].forEach(function (g) {
  s2.push('<line x1="64" y1="' + g[0] + '" x2="648" y2="' + g[0] + '" stroke="' + GL + '" stroke-width="1"/>');
  s2.push('<text x="58" y="' + (g[0] + 4) + '" font-size="11" text-anchor="end" fill="' + T3 + '">' + g[1] + '</text>');
});
s2.push('<text x="58" y="254" font-size="11" text-anchor="end" fill="' + T3 + '">0</text>');
[144.6, 245.2, 345.9, 446.6, 547.3].forEach(function (x) {
  s2.push('<line x1="' + x + '" y1="40" x2="' + x + '" y2="250" stroke="' + GL + '" stroke-width="1"/>');
});
s2.push('<line x1="64" y1="148.5" x2="648" y2="148.5" stroke="' + GL2 + '" stroke-width="1" stroke-dasharray="4 4"/>');
s2.push('<line x1="64" y1="250" x2="648" y2="250" stroke="' + GL2 + '" stroke-width="1"/>');
s2.push('<polyline points="' + PC + '" fill="none" stroke="' + G1 + '" stroke-width="2" stroke-linejoin="round"/>');
s2.push('<line x1="345.9" y1="148.5" x2="356" y2="187" stroke="' + G2 + '" stroke-width="1.5" stroke-dasharray="2 2"/>');
s2.push('<circle cx="345.9" cy="148.5" r="3.5" fill="' + G2 + '"/>');
s2.push('<circle cx="356" cy="187" r="3.5" fill="' + G2 + '"/>');
s2.push('<circle cx="486.9" cy="148.5" r="2.5" fill="' + G1 + '"/>');
s2.push('<text x="80" y="62" font-size="11" fill="' + T2 + '">低段逐级加速：+1、+3、+3、+5、+5 …</text>');
s2.push('<text x="80" y="80" font-size="11" fill="' + T2 + '">到 Lv30 每级已要 +29</text>');
s2.push('<text x="68" y="140" font-size="11" fill="' + T3 + '">参考线 Δ=29（Lv30 水平）</text>');
s2.push('<text x="334" y="138" font-size="11" text-anchor="end" fill="' + G2 + '">Lv30：+29</text>');
s2.push('<text x="346" y="205" font-size="11" text-anchor="end" fill="' + G2 + '">Lv31：回落到 +18</text>');
s2.push('<text x="644" y="205" font-size="11" text-anchor="end" fill="' + T2 + '">Lv44 才回到 +29，其后复合加速：</text>');
s2.push('<text x="644" y="223" font-size="11" text-anchor="end" fill="' + T2 + '">Lv60 +52 · Lv100 +221 · Lv240 +3.56 万</text>');
[['64', '2', 'start'], ['144.6', '10', 'middle'], ['245.2', '20', 'middle'], ['345.9', '30', 'middle'], ['446.6', '40', 'middle'], ['547.3', '50', 'middle'], ['648', '60', 'end']].forEach(function (t) {
  s2.push('<text x="' + t[0] + '" y="262" font-size="11" text-anchor="' + t[2] + '" fill="' + T3 + '">' + t[1] + '</text>');
});
s2.push('<text x="64" y="292" font-size="11" fill="' + T3 + '">y：与上一级相比，本级的「需求多涨多少」（Δ = need(Lv) − need(Lv−1)）</text>');
s2.push('</svg>');
fs.writeFileSync('E:/Deepseekdb/.workbuddy/tmp/widget2_expdelta.svg', s2.join('\n'), 'utf8');

console.log('图1 字节=' + fs.statSync('E:/Deepseekdb/.workbuddy/tmp/widget1_expcurve.svg').size
  + ' · 行数=' + fs.readFileSync('E:/Deepseekdb/.workbuddy/tmp/widget1_expcurve.svg', 'utf8').split('\n').length);
console.log('图2 字节=' + fs.statSync('E:/Deepseekdb/.workbuddy/tmp/widget2_expdelta.svg').size
  + ' · 行数=' + fs.readFileSync('E:/Deepseekdb/.workbuddy/tmp/widget2_expdelta.svg', 'utf8').split('\n').length);
