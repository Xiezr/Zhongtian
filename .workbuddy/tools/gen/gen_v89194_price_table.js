/* v89.194 生成器：道具价格表（docs/v89194-道具价格表.md）
   工序照 §39.3：表由脚本直读 DATA 生成、不手抄；改价后重跑刷新。
   口径：内部价 = ITEMS[].price；商城实售 = 内部价 × 100（唯一显示口径）。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '价格表', region: '烬环' });
var cats = G.ui.SHOP_CATS || {};
var all = (D.ITEMS || []).filter(function (it) { return it.price > 0; });

function catOf(it) { return cats[it.type] || ''; }
function onSale(it) { return !it.noShop && !it.dropOnly && !!cats[it.type]; }

var L = [];
L.push('# v89.194 · 道具价格表（对账产物）');
L.push('');
L.push('> **本表由脚本生成**（`.workbuddy/tools/gen/gen_v89194_price_table.js` 直读 `DATA.ITEMS`）——');
L.push('> 改价后重跑刷新，勿手改。口径：**内部价 = `ITEMS[].price`**；**商城实售 = 内部价 × 100**（全站唯一显示口径，');
L.push('> 商城/背包/快购三处同源）。经验族内部价由 `DATA.EXP_ITEM_SPEC` 覆盖（v89.173 面额表，同文件）。');
L.push('');
L.push('## 汇总');
L.push('');
L.push('| 组 | 件数 |');
L.push('|---|---|');
var onSaleN = all.filter(onSale).length;
var noShopN = all.filter(function (it) { return !!it.noShop; }).length;
var dropN = all.filter(function (it) { return !it.noShop && !!it.dropOnly; }).length;
L.push('| 在售（商城有页签） | ' + onSaleN + ' |');
L.push('| 下架 noShop（绝版 · 仅存量可用） | ' + noShopN + ' |');
L.push('| dropOnly（掉落专供 · 商城不售） | ' + dropN + ' |');
L.push('| 合计（price > 0） | ' + all.length + ' |');
L.push('');
L.push('**口径锚点**：千古兵圣内部价 4,000 → 实售 **40 万金**；兵仙遗篇 2,400 → **24 万金**。');
L.push('');

function table(title, list) {
  L.push('## ' + title + '（' + list.length + ' 件）');
  L.push('');
  L.push('| id | 名称 | 类型 | 页签 | 内部价 | 商城实售 |');
  L.push('|---|---|---|---|---:|---:|');
  list.forEach(function (it) {
    L.push('| `' + it.id + '` | ' + it.name + ' | ' + it.type + ' | ' + (catOf(it) || '—')
      + ' | ' + U.fmt(it.price) + ' | ' + (onSale(it) ? U.fmt(it.price * 100) + ' 金' : '不售') + ' |');
  });
  L.push('');
}

table('在售', all.filter(onSale).sort(function (a, b) { return (b.price || 0) - (a.price || 0); }));
table('下架 noShop（绝版 · 仅存量可用）', all.filter(function (it) { return !!it.noShop; }));
table('dropOnly（掉落专供）', all.filter(function (it) { return !it.noShop && !!it.dropOnly; }));

var out = L.join('\n');
var dst = path.join(R, 'docs/v89194-道具价格表.md');
fs.writeFileSync(dst, out);
/* 写后自检（§39.3） */
var chk = fs.readFileSync(dst, 'utf8');
if (chk.length < 2000 || chk.indexOf('千古兵圣') < 0 || chk.indexOf('商城实售') < 0) {
  console.error('自检失败'); process.exit(1);
}
console.log('✓ 价格表已生成：' + dst + '（' + all.length + ' 件 / ' + chk.length + ' 字符）');
console.log('  在售 ' + onSaleN + ' · 下架 ' + noShopN + ' · dropOnly ' + dropN);
process.exit(0);
