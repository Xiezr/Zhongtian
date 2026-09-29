/* 打包单页 HTML：两图 + 关键节点表（自带明暗变量，独立可看） */
var fs = require('fs');
var R = 'E:/Deepseekdb/.workbuddy/';
var s1 = fs.readFileSync(R + 'tmp/widget1_expcurve.svg', 'utf8');
var s2 = fs.readFileSync(R + 'tmp/widget2_expdelta.svg', 'utf8');
var J = JSON.parse(fs.readFileSync(R + 'tmp/expcurve_v89168.json', 'utf8'));
var rows = J.rows;
function need(lv) { return rows[lv - 1].need; }
function d(lv) { return rows[lv - 1].delta; }
function cum(lv) { return rows[lv - 1].cum; }
var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
var lvs = [1, 10, 30, 31, 60, 100, 150, 200, 240];
var trs = lvs.map(function (lv) {
  var mark = lv === 31 ? ' style="color:#D85A30"' : '';
  return '<tr' + mark + '><td>Lv' + lv + '</td><td>' + fmt(need(lv)) + '</td><td>'
    + (lv === 1 ? '—' : (lv === 31 ? '+' + d(31) + ' ←折角' : '+' + fmt(d(lv)))) + '</td><td>' + fmt(cum(lv)) + '</td></tr>';
}).join('\n');
var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>将领经验曲线 · v89.168 取证</title><style>\n'
  + ':root{--color-text-primary:#1c1c1c;--color-text-secondary:#555;--color-text-tertiary:#8f8f8f;--color-border-tertiary:rgba(0,0,0,.14);--color-border-secondary:rgba(0,0,0,.3);--bg:#fafaf8;--card:#fff}\n'
  + '@media (prefers-color-scheme: dark){:root{--color-text-primary:#ececec;--color-text-secondary:#b4b4b4;--color-text-tertiary:#828282;--color-border-tertiary:rgba(255,255,255,.16);--color-border-secondary:rgba(255,255,255,.34);--bg:#1b1b1b;--card:#232323}}\n'
  + 'body{margin:0;background:var(--bg);color:var(--color-text-primary);font-family:system-ui,"Microsoft YaHei",sans-serif}\n'
  + '.wrap{max-width:760px;margin:0 auto;padding:28px 24px 48px}\n'
  + 'h1{font-size:17px;font-weight:500;margin:0 0 6px}\n'
  + '.sub{font-size:12px;color:var(--color-text-tertiary);margin:0 0 22px}\n'
  + '.card{background:var(--card);border:0.5px solid var(--color-border-tertiary);border-radius:12px;padding:14px 16px;margin-bottom:18px}\n'
  + 'table{border-collapse:collapse;width:100%;font-size:12.5px}\n'
  + 'th,td{padding:6px 8px;text-align:right;border-bottom:0.5px solid var(--color-border-tertiary)}\n'
  + 'th:first-child,td:first-child{text-align:left}\n'
  + 'th{color:var(--color-text-tertiary);font-weight:400}\n'
  + 'h2{font-size:13px;font-weight:500;margin:0 0 10px}\n'
  + 'ul{margin:0;padding-left:18px;font-size:12.5px;line-height:1.9;color:var(--color-text-secondary)}\n'
  + '</style></head><body><div class="wrap">\n'
  + '<h1>将领经验曲线 · 逐级取证</h1>\n'
  + '<p class="sub">数据源 DATA.EXP_CURVE / GAME.expNeedOf · 240 级逐点实算 · 只读核查（未改任何数值）</p>\n'
  + '<div class="card">' + s1 + '</div>\n'
  + '<div class="card">' + s2 + '</div>\n'
  + '<div class="card"><h2>关键节点</h2><table><thead><tr><th>等级</th><th>单级需求</th><th>比上一级</th><th>累计</th></tr></thead><tbody>\n'
  + trs + '\n</tbody></table></div>\n'
  + '<div class="card"><h2>取证读出的三点</h2><ul>\n'
  + '<li>结构：Lv1~30 二次起步（41 → 490），Lv31~240 指数段（每级 ×1.037），Lv240 单级锚定 100 万。</li>\n'
  + '<li>折角：Lv30→31 每级增幅由 +29 骤降到 +18，直到 Lv44 才回到 +29（两段接缝的斜率不连续）。</li>\n'
  + '<li>跨度：单级 41 ↔ 100 万（24,390×）；前 100 级累计只占全曲线 0.59%，后 140 级占 99.41%。</li>\n'
  + '</ul></div>\n'
  + '</div></body></html>';
fs.writeFileSync(R + 'shots/v89168-expcurve.html', html, 'utf8');
console.log('HTML 已出：' + fs.statSync(R + 'shots/v89168-expcurve.html').size + ' 字节');
