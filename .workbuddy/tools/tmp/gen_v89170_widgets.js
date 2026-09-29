/* v89.170 生成两张对比图 SVG（widget 用）
   图1：三条曲线（旧 / 新 / 线性参照）· 上=对数刻度、下=线性刻度
   图2：经验道具族「从 Lv1 升到几级」旧 vs 新（横向双条）
   输出：.workbuddy/tmp/w170_curve.svg / w170_items.svg */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA;

/* ---- 三条曲线的取数 ---- */
function needNew(lv) { return G.expNeedOf({ level: lv }); }
var C_OLD = { s: 30, base: 40, quad: 0.5, seg2: 490, growth: Math.pow(1000000 / 490, 1 / 210) };
function needOld(lv) {
  return lv <= C_OLD.s ? (C_OLD.base + C_OLD.quad * lv * lv) :
    (C_OLD.seg2 * Math.pow(C_OLD.growth, lv - C_OLD.s));
}
var N1 = needNew(1);
function needLin(lv) { return N1 + (1000000 - N1) * (lv - 1) / 239; }

/* ---- 道具族：从 Lv1 升到几级 ---- */
function lvAfterOld(exp) {
  var l = 1, e = exp;
  while (l < 240) { var nd = needOld(l); if (e < nd) break; e -= nd; l++; }
  return l;
}
function lvAfterNew(exp) {
  var l = 1, e = exp;
  while (l < 240) { var nd = needNew(l); if (e < nd) break; e -= nd; l++; }
  return l;
}
var TOTAL_OLD = 28050274, TOTAL_NEW = DATA.EXP_CURVE.total;
var ITEMS = [];
DATA.EXP_ITEM_SPEC.forEach(function (sp) {
  var it = null;
  (DATA.ITEMS || []).forEach(function (x) { if (x.id === sp.id) it = x; });
  if (!it) return;
  ITEMS.push({
    name: it.name, noShop: !!it.noShop, gold: it.price * 100,
    oldLv: lvAfterOld(Math.round(TOTAL_OLD * sp.pct)),
    newLv: lvAfterNew(Math.round(TOTAL_NEW * sp.pct)),
  });
});

function chunk(str, n) {
  var p = str.split(' '), out = [];
  for (var i = 0; i < p.length; i += n) out.push(p.slice(i, i + n).join(' '));
  return out.join('\n      ');
}

var G1 = '#378ADD';        /* 新曲线 · 蓝 */
var G2 = '#D85A30';        /* 旧曲线 · 橙红 */
var G3 = '#8C8C8C';        /* 线性参照 · 灰 */
var T1 = 'var(--color-text-primary)', T2 = 'var(--color-text-secondary)', T3 = 'var(--color-text-tertiary)';
var GL = 'var(--color-border-tertiary)', GL2 = 'var(--color-border-secondary)';

/* x 轴映射（两面板共用） */
function ax(lv) { return (64 + (lv - 1) / 239 * 584).toFixed(1); }

/* ============ 图 1：三条曲线 ============ */
var s = [];
s.push('<svg viewBox="0 0 680 566" role="img" style="width:100%;height:auto;display:block;font-family:var(--font-sans,system-ui,sans-serif)">');
s.push('<title>经验曲线改前 vs 改后 vs 线性参照</title>');
s.push('<desc>上图为对数刻度：旧曲线前段贴底、Lv30 处有折角；新曲线近似直线、整体上抬；灰色虚线为线性参照，新曲线全程在其下方。下图为线性刻度：新曲线贴着线性参照的下方走，旧曲线长期贴近横轴。</desc>');

/* ---- 面板 A：对数刻度 y36..240（log 100 ~ 1e6） ---- */
/* log 轴下限 = log10(35)：旧曲线起点 40.5 也在面板内（改前下限 100 会让它越界） */
function ay(v) { return (240 - (Math.log10(v) - 1.544) / 4.456 * 204).toFixed(1); }
s.push('<text x="64" y="20" font-size="13" font-weight="500" fill="' + T1 + '">单级升级所需经验（Lv1 → Lv240）· 对数刻度</text>');
[[219, '100'], [173, '1千'], [128, '1万'], [82, '10万'], [36, '100万']].forEach(function (g) {
  s.push('<line x1="64" y1="' + g[0] + '" x2="648" y2="' + g[0] + '" stroke="' + GL + '" stroke-width="1"/>');
  s.push('<text x="58" y="' + (g[0] + 4) + '" font-size="11" text-anchor="end" fill="' + T3 + '">' + g[1] + '</text>');
});
[208.2, 354.8, 501.5].forEach(function (x) {
  s.push('<line x1="' + x + '" y1="36" x2="' + x + '" y2="240" stroke="' + GL + '" stroke-width="1"/>');
});
s.push('<line x1="64" y1="240" x2="648" y2="240" stroke="' + GL2 + '" stroke-width="1"/>');
var ptsOld = [], ptsNew = [], ptsLin = [];
for (var lv = 1; lv <= 240; lv++) {
  ptsOld.push(ax(lv) + ',' + ay(needOld(lv)));
  ptsNew.push(ax(lv) + ',' + ay(needNew(lv)));
  ptsLin.push(ax(lv) + ',' + ay(needLin(lv)));
}
s.push('<polyline points="' + chunk(ptsLin.join(' '), 14) + '" fill="none" stroke="' + G3 + '" stroke-width="1.5" stroke-dasharray="5 4" stroke-linejoin="round"/>');
s.push('<polyline points="' + chunk(ptsOld.join(' '), 14) + '" fill="none" stroke="' + G2 + '" stroke-width="2" stroke-linejoin="round"/>');
s.push('<polyline points="' + chunk(ptsNew.join(' '), 14) + '" fill="none" stroke="' + G1 + '" stroke-width="2.2" stroke-linejoin="round"/>');
/* 折角标记（旧曲线 Lv30 处） */
s.push('<circle cx="' + ax(30) + '" cy="' + ay(needOld(30)) + '" r="3" fill="' + G2 + '"/>');
/* 折角标注放折角点**上方**（旧曲线下方全是它自己爬升的轨迹，会相交） */
s.push('<line x1="' + ax(30) + '" y1="' + (parseFloat(ay(needOld(30))) - 8) + '" x2="' + ax(30) + '" y2="' + (parseFloat(ay(needOld(30))) - 24) + '" stroke="' + G2 + '" stroke-width="1" stroke-dasharray="2 2"/>');
s.push('<text x="' + ax(30) + '" y="' + (parseFloat(ay(needOld(30))) - 28) + '" font-size="11" text-anchor="middle" fill="' + G2 + '">旧：Lv30 折角</text>');
/* 三条线的注（放左侧空白区，避免贴线） */
/* 三段注放**右下空白区**（曲线在左上爬升后，右下全空；改前放左上会与曲线相交 238 处） */
s.push('<text x="280" y="188" font-size="11" fill="' + T2 + '">— 新曲线（现 · 单段幂律）：全程平滑、整体上抬</text>');
s.push('<text x="280" y="206" font-size="11" fill="' + T2 + '">— 旧曲线（改前 · 两段式）：前 30 级贴底 + 折角</text>');
s.push('<text x="280" y="224" font-size="11" fill="' + T3 + '">- - 线性参照（Lv1 实需 → Lv240 的 100 万 连成的直线）</text>');
/* 右侧注（贴近各自终点） */
s.push('<circle cx="648" cy="36" r="2.5" fill="' + G1 + '"/>');
s.push('<circle cx="648" cy="36" r="2.5" fill="' + G2 + '"/>');
[['64', '1', 'start'], ['208.2', '60', 'middle'], ['354.8', '120', 'middle'], ['501.5', '180', 'middle'], ['648', '240', 'end']].forEach(function (t) {
  s.push('<text x="' + t[0] + '" y="256" font-size="11" text-anchor="' + t[2] + '" fill="' + T3 + '">' + t[1] + '</text>');
});

/* ---- 面板 B：线性刻度 y298..500（0 ~ 1e6） ---- */
function by(v) { return (500 - v / 1000000 * 202).toFixed(1); }
s.push('<text x="64" y="290" font-size="13" font-weight="500" fill="' + T1 + '">同一三条曲线 · 线性刻度（看"低于线性"）</text>');
[[500, '0'], [449.5, '25万'], [399, '50万'], [348.5, '75万'], [298, '100万']].forEach(function (g) {
  s.push('<line x1="64" y1="' + g[0] + '" x2="648" y2="' + g[0] + '" stroke="' + GL + '" stroke-width="1"/>');
  s.push('<text x="58" y="' + (g[0] + 4) + '" font-size="11" text-anchor="end" fill="' + T3 + '">' + g[1] + '</text>');
});
[208.2, 354.8, 501.5].forEach(function (x) {
  s.push('<line x1="' + x + '" y1="298" x2="' + x + '" y2="500" stroke="' + GL + '" stroke-width="1"/>');
});
s.push('<line x1="64" y1="500" x2="648" y2="500" stroke="' + GL2 + '" stroke-width="1"/>');
var qOld = [], qNew = [], qLin = [];
for (var lv2 = 1; lv2 <= 240; lv2++) {
  qOld.push(ax(lv2) + ',' + by(needOld(lv2)));
  qNew.push(ax(lv2) + ',' + by(needNew(lv2)));
  qLin.push(ax(lv2) + ',' + by(needLin(lv2)));
}
s.push('<polyline points="' + chunk(qLin.join(' '), 14) + '" fill="none" stroke="' + G3 + '" stroke-width="1.5" stroke-dasharray="5 4" stroke-linejoin="round"/>');
s.push('<polyline points="' + chunk(qNew.join(' '), 14) + '" fill="none" stroke="' + G1 + '" stroke-width="2.2" stroke-linejoin="round"/>');
s.push('<polyline points="' + chunk(qOld.join(' '), 14) + '" fill="none" stroke="' + G2 + '" stroke-width="2" stroke-linejoin="round"/>');
s.push('<circle cx="' + ax(100) + '" cy="' + by(needNew(100)) + '" r="3" fill="' + G1 + '"/>');
/* 标注放点**右下方**（放上方会与线性参照虚线贴身） */
s.push('<text x="' + (parseFloat(ax(100)) + 10) + '" y="' + (parseFloat(by(needNew(100))) + 16) + '" font-size="11" fill="' + G1 + '">Lv100：33.5 万（线性的 81%）</text>');
s.push('<text x="76" y="330" font-size="11" fill="' + T2 + '">新曲线：贴着线性参照的下方走（最高贴合 99.9%）</text>');
s.push('<text x="76" y="348" font-size="11" fill="' + T2 + '">旧曲线（改前）：长期贴底 —— Lv100 处只有线性的 1.5%</text>');
[['64', '1', 'start'], ['208.2', '60', 'middle'], ['354.8', '120', 'middle'], ['501.5', '180', 'middle'], ['648', '240', 'end']].forEach(function (t) {
  s.push('<text x="' + t[0] + '" y="516" font-size="11" text-anchor="' + t[2] + '" fill="' + T3 + '">' + t[1] + '</text>');
});
s.push('<text x="64" y="546" font-size="11" fill="' + T3 + '">x：将领等级 · y：升到下一级所需经验（单级）· 240 级逐点实算（旧=改前两段式 · 新=现单段幂律）</text>');
s.push('</svg>');
fs.writeFileSync(R + '.workbuddy/tmp/w170_curve.svg', s.join('\n'), 'utf8');

/* ============ 图 2：道具族「从 Lv1 升到几级」旧 vs 新 ============ */
var s2 = [];
var ROWH = 38, TOP = 54;
var H = TOP + ITEMS.length * ROWH + 60;   /* 底部两行说明（单行会超宽越界） */
s2.push('<svg viewBox="0 0 680 ' + H + '" role="img" style="width:100%;height:auto;display:block;font-family:var(--font-sans,system-ui,sans-serif)">');
s2.push('<title>经验道具：从 Lv1 一份能升到几级（旧 vs 新）</title>');
s2.push('<desc>横向对比图。每个道具两根横条：橙色为改前（最高兵仙遗篇 177 级），蓝色为改后（最高 118 级）。兵仙遗篇从 177 降到 86。</desc>');
s2.push('<text x="24" y="22" font-size="13" font-weight="500" fill="' + T1 + '">经验道具：一份「从 Lv1 升到几级」· 旧（橙）vs 新（蓝）</text>');
var X0 = 224, X1 = 620, LV0 = 1, LV1 = 200;
function lx(lv) { return (X0 + (lv - LV0) / (LV1 - LV0) * (X1 - X0)).toFixed(1); }
/* 轴刻度（Lv1 起 · 线性映射） */
[1, 50, 100, 150, 200].forEach(function (g) {
  s2.push('<line x1="' + lx(g) + '" y1="' + (TOP - 6) + '" x2="' + lx(g) + '" y2="' + (TOP + ITEMS.length * ROWH - 12) + '" stroke="' + GL + '" stroke-width="1"/>');
  s2.push('<text x="' + lx(g) + '" y="' + (TOP - 12) + '" font-size="11" text-anchor="middle" fill="' + T3 + '">Lv' + g + '</text>');
});
ITEMS.forEach(function (it, i) {
  var y = TOP + i * ROWH;
  var nm = it.name + (it.noShop ? '（下架）' : '');
  s2.push('<text x="24" y="' + (y + 10) + '" font-size="12" fill="' + (it.noShop ? T3 : T1) + '">' + nm + '</text>');
  s2.push('<text x="24" y="' + (y + 25) + '" font-size="10.5" fill="' + T3 + '">'
    + (it.gold >= 10000 ? (it.gold / 10000) + ' 万金' : it.gold + ' 金') + '</text>');
  /* 旧条（上） */
  s2.push('<rect x="' + X0 + '" y="' + (y + 2) + '" width="' + (lx(it.oldLv) - X0).toFixed(1) + '" height="9" rx="3" fill="' + G2 + '" opacity="0.82"/>');
  /* 新条（下） */
  s2.push('<rect x="' + X0 + '" y="' + (y + 15) + '" width="' + (lx(it.newLv) - X0).toFixed(1) + '" height="9" rx="3" fill="' + G1 + '"/>');
  /* 右侧读数 */
  var hit = it.name === '兵仙遗篇';
  s2.push('<text x="628" y="' + (y + 10) + '" font-size="11" fill="' + T3 + '">' + it.oldLv + '</text>');
  s2.push('<text x="628" y="' + (y + 24) + '" font-size="11" font-weight="' + (hit ? '700' : '400') + '" fill="' + (hit ? G1 : T2) + '">' + it.newLv + '</text>');
  if (hit) {
    s2.push('<rect x="16" y="' + (y - 2) + '" width="652" height="' + (ROWH - 3) + '" rx="6" fill="none" stroke="' + G1 + '" stroke-width="1.2" opacity="0.55"/>');
  }
});
s2.push('<text x="24" y="' + (H - 32) + '" font-size="11" fill="' + T3 + '">横轴 = 升到的等级 · 名后灰字 = 已下架档</text>');
s2.push('<text x="24" y="' + (H - 12) + '" font-size="11" fill="' + T3 + '">兵仙遗篇（24 万金）：Lv1 → 86（旧 177）· 千古兵圣（40 万金）：Lv1 → 118（旧 196）</text>');
s2.push('</svg>');
fs.writeFileSync(R + '.workbuddy/tmp/w170_items.svg', s2.join('\n'), 'utf8');

console.log('图1 字节=' + fs.statSync(R + '.workbuddy/tmp/w170_curve.svg').size
  + ' · 图2 字节=' + fs.statSync(R + '.workbuddy/tmp/w170_items.svg').size);
console.log('道具族（旧→新）：' + ITEMS.map(function (x) { return x.name + ' ' + x.oldLv + '→' + x.newLv; }).join(' · '));
process.exit(0);
