/* v89.168 曲线图几何生成：从真实 JSON 逐点产出 SVG path 字符串 */
var fs = require('fs');
var J = JSON.parse(fs.readFileSync('E:/Deepseekdb/.workbuddy/tmp/expcurve_v89168.json', 'utf8'));
var rows = J.rows;
function need(lv) { return rows[lv - 1].need; }
function delta(lv) { return rows[lv - 1].delta; }

/* ---- 面板 A：线性（x 64..648 · y 222(0)..36(1e6)） ---- */
var A = { x0: 64, x1: 648, yB: 222, yT: 36, ymax: 1000000 };
function ax(lv) { return A.x0 + (lv - 1) / 239 * (A.x1 - A.x0); }
function ay(v) { return A.yB - (v / A.ymax) * (A.yB - A.yT); }
var pa = rows.map(function (r) { return ax(r.lv).toFixed(1) + ',' + ay(r.need).toFixed(1); }).join(' ');
console.log('PA=' + pa);

/* ---- 面板 B：对数（同一 x 映射 · y 468(log 40)..282(log 1e6)） ---- */
var B = { x0: 64, x1: 648, yB: 468, yT: 282, lmin: Math.log10(41), lmax: 6 };
function by(v) { return B.yB - (Math.log10(v) - B.lmin) / (B.lmax - B.lmin) * (B.yB - B.yT); }
var pb = rows.map(function (r) { return ax(r.lv).toFixed(1) + ',' + by(r.need).toFixed(1); }).join(' ');
console.log('PB=' + pb);
console.log('B 刻度 y：100→' + by(100).toFixed(1) + ' · 1千→' + by(1000).toFixed(1) + ' · 1万→' + by(10000).toFixed(1) + ' · 10万→' + by(100000).toFixed(1) + ' · 100万→' + by(1000000).toFixed(1));
console.log('B 关键点：Lv30(490)→(' + ax(30).toFixed(1) + ',' + by(490).toFixed(1) + ') · Lv31(508)→(' + ax(31).toFixed(1) + ',' + by(508).toFixed(1) + ') · Lv240→(' + ax(240).toFixed(1) + ',' + by(1000000).toFixed(1) + ')');
console.log('A 关键点：Lv200(234186)→(' + ax(200).toFixed(1) + ',' + ay(234186).toFixed(1) + ') · Lv240→(' + ax(240).toFixed(1) + ',' + ay(1000000).toFixed(1) + ')');

/* ---- 面板 C：增量（Lv2..60 · x 64..648 · y 250(0)..40(60)） ---- */
var C = { x0: 64, x1: 648, yB: 250, yT: 40, ymax: 60, lvA: 2, lvB: 60 };
function cx(lv) { return C.x0 + (lv - C.lvA) / (C.lvB - C.lvA) * (C.x1 - C.x0); }
function cy(v) { return C.yB - (v / C.ymax) * (C.yB - C.yT); }
var pc = [];
for (var lv = 2; lv <= 60; lv++) pc.push(cx(lv).toFixed(1) + ',' + cy(delta(lv)).toFixed(1));
console.log('PC=' + pc.join(' '));
console.log('C 关键点：Δ30=' + delta(30) + '→(' + cx(30).toFixed(1) + ',' + cy(delta(30)).toFixed(1) + ') · Δ31=' + delta(31) + '→(' + cx(31).toFixed(1) + ',' + cy(delta(31)).toFixed(1) + ') · Δ60=' + delta(60) + '→(' + cx(60).toFixed(1) + ',' + cy(delta(60)).toFixed(1) + ')');
console.log('C 刻度 y：0→' + cy(0).toFixed(1) + ' · 20→' + cy(20).toFixed(1) + ' · 40→' + cy(40).toFixed(1) + ' · 60→' + cy(60).toFixed(1));

/* ---- 增量序列（供标注） ---- */
var seq = [];
for (var lv2 = 28; lv2 <= 48; lv2++) seq.push('Δ' + lv2 + '=' + delta(lv2));
console.log('增量序列 28..48：' + seq.join(' '));
var first29 = null;
for (var lv3 = 32; lv3 <= 60; lv3++) { if (delta(lv3) >= 29) { first29 = lv3; break; } }
console.log('Δ 回到 ≥29 的第一个等级 = Lv' + first29 + '（Δ=' + delta(first29) + '）· Δ44=' + delta(44) + ' Δ45=' + delta(45));
console.log('总累计=' + J.param.total + '·Lv30累计=' + rows[29].cum + '·Lv100累计=' + rows[99].cum + '·Lv200累计=' + rows[199].cum);
