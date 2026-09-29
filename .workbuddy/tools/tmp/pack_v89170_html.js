/* v89.170 打包单页 HTML：两图 + 关键节点表 + 道具族表（自带明暗变量，独立可看） */
var fs = require('fs');
var R = 'E:/Deepseekdb/.workbuddy/';
var s1 = fs.readFileSync(R + 'tmp/w170_curve.svg', 'utf8');
var s2 = fs.readFileSync(R + 'tmp/w170_items.svg', 'utf8');

var NODES = [
  ['Lv1', '41', '1,059', '×25.8'],
  ['Lv30', '490', '74,325', '×151.7'],
  ['Lv60', '1,456', '176,777', '×121.4'],
  ['Lv100', '6,215', '334,762', '×53.9'],
  ['Lv150', '38,152', '555,712', '×14.6'],
  ['Lv200', '234,186', '796,202', '×3.4'],
  ['Lv240（锚点）', '1,000,000', '1,000,000', '不变'],
];
var CUM = [
  ['Lv100', '0.59%', '14.04%'],
  ['Lv150', '3.79%', '34.83%'],
  ['Lv200', '23.40%', '66.41%'],
];
var ITEMS = [
  ['练兵经验', '800 金', 'Lv30', 'Lv5'],
  ['裨将手记（下架）', '1,900 金', 'Lv43', 'Lv8'],
  ['兵法心得（下架）', '3,600 金', 'Lv57', 'Lv11'],
  ['校尉札记（下架）', '1.02 万金', 'Lv83', 'Lv18'],
  ['治军之道', '1.92 万金', 'Lv101', 'Lv25'],
  ['将军战录（下架）', '4.5 万金', 'Lv125', 'Lv37'],
  ['大都督兵法（下架）', '8.4 万金', 'Lv144', 'Lv51'],
  ['名将心传（下架）', '15.6 万金', 'Lv163', 'Lv69'],
  ['兵仙遗篇', '24 万金', 'Lv177', 'Lv86'],
  ['太公兵书（下架）', '33 万金', 'Lv188', 'Lv103'],
  ['千古兵圣', '40 万金', 'Lv196', 'Lv118'],
];
function tr(rows, hiIdx) {
  return rows.map(function (r, i) {
    var mark = (hiIdx >= 0 && i === hiIdx) ? ' class="hi"' : '';
    return '<tr' + mark + '>' + r.map(function (c, j) {
      return '<td' + (j === 0 ? '' : ' class="r"') + '>' + c + '</td>';
    }).join('') + '</tr>';
  }).join('\n');
}
var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>经验曲线 · v89.170 改前改后取证</title><style>\n'
  + ':root{--color-text-primary:#1c1c1c;--color-text-secondary:#555;--color-text-tertiary:#8f8f8f;--color-border-tertiary:rgba(0,0,0,.14);--color-border-secondary:rgba(0,0,0,.3);--bg:#fafaf8;--card:#fff}\n'
  + '@media (prefers-color-scheme: dark){:root{--color-text-primary:#ececec;--color-text-secondary:#b4b4b4;--color-text-tertiary:#828282;--color-border-tertiary:rgba(255,255,255,.16);--color-border-secondary:rgba(255,255,255,.34);--bg:#1b1b1b;--card:#232323}}\n'
  + 'body{margin:0;background:var(--bg);color:var(--color-text-primary);font-family:system-ui,"Microsoft YaHei",sans-serif}\n'
  + '.wrap{max-width:760px;margin:0 auto;padding:28px 24px 48px}\n'
  + 'h1{font-size:17px;font-weight:500;margin:0 0 6px}\n'
  + '.sub{font-size:12px;color:var(--color-text-tertiary);margin:0 0 22px;line-height:1.7}\n'
  + '.card{background:var(--card);border:0.5px solid var(--color-border-tertiary);border-radius:12px;padding:14px 16px;margin-bottom:18px}\n'
  + 'table{border-collapse:collapse;width:100%;font-size:12.5px}\n'
  + 'th,td{padding:6px 8px;text-align:right;border-bottom:0.5px solid var(--color-border-tertiary)}\n'
  + 'th:first-child,td:first-child{text-align:left}\n'
  + 'th{color:var(--color-text-tertiary);font-weight:400}\n'
  + 'tr.hi td{color:#378ADD}\n'
  + 'h2{font-size:13px;font-weight:500;margin:0 0 10px}\n'
  + 'ul{margin:0;padding-left:18px;font-size:12.5px;line-height:1.9;color:var(--color-text-secondary)}\n'
  + '</style></head><body><div class="wrap">\n'
  + '<h1>将领经验曲线 · 改前 vs 改后（单段幂律 · 上抬 · 低于线性）</h1>\n'
  + '<p class="sub">数据源 DATA.EXP_CURVE / GAME.expNeedOf · 240 级逐点实算（旧 = 改前两段式「二次起步 + 每级 ×1.037 指数」）<br>'
  + '新 = 单段幂律 need = 100万 × (lv/240)^1.25 · 锚点 need(240)=100 万保持不变</p>\n'
  + '<div class="card">' + s1 + '</div>\n'
  + '<div class="card">' + s2 + '</div>\n'
  + '<div class="card"><h2>关键节点（单级需求）</h2><table><thead><tr><th>等级</th><th>旧</th><th>新</th><th>倍数</th></tr></thead><tbody>\n'
  + tr(NODES, -1) + '\n</tbody></table></div>\n'
  + '<div class="card"><h2>累计占比（前 N 级占全曲线总经验）</h2><table><thead><tr><th>等级</th><th>旧</th><th>新</th></tr></thead><tbody>\n'
  + tr(CUM, -1) + '\n</tbody></table></div>\n'
  + '<div class="card"><h2>道具族：一份从 Lv1 升到几级</h2><table><thead><tr><th>道具</th><th>售价</th><th>旧</th><th>新</th></tr></thead><tbody>\n'
  + tr(ITEMS, 8) + '\n</tbody></table></div>\n'
  + '<div class="card"><h2>三条口径</h2><ul>\n'
  + '<li>锚点不动：need(240) = 100 万（v89.82 老板拍板）。</li>\n'
  + '<li>全程低于线性：新曲线始终在「Lv1 实需 → Lv240 锚点」直线下方（最高贴合 Lv239 处 99.9%）。</li>\n'
  + '<li>相对口径不动：练功 = 当前需求 ×10%（0.1 级/次）· 战斗封顶 = 当前需求 ×80%（0.8 级/场）——升级节奏与曲线高低无关。</li>\n'
  + '</ul></div>\n'
  + '</div></body></html>';
fs.writeFileSync(R + 'shots/v89170-expcurve.html', html, 'utf8');
console.log('HTML 已出：' + fs.statSync(R + 'shots/v89170-expcurve.html').size + ' 字节');
