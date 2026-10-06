/* v89.205 探针：将领名称信息下的挂件行退役 + 卸下迁入选择窗
   ------------------------------------------------------------
   老板需求：「将领名称信息下的这行去掉，只保留装备栏的即可：🔮 宝具」。
   验证四件：
     ① genPane 不再渲染挂件行（gp-attach186 零残留）· 装备栏「🔮 宝具」入口在；
     ② 选择窗真渲染：已佩行 = 「卸下」按钮（不再是置灰「已佩」）；
     ③ doDetach 真调：状态清空 + 库存守恒 + 窗重开刷新（当前未佩）；
     ④ 卸下后重开窗内「卸下」按钮消失（回「佩上」形态）。
   运行：node .workbuddy/tools/probe/probe_v89205_attach.js   （输出重定向到文件再读） */
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra == null ? '' : extra) + ']'); }
}

/* ── boot：新局 ── */
var st = G.newGame({ name: 'v205', cityName: '许都', mapSeed: 20261007 });
G.state = st;
var g = st.generals[0];
var bao = null;
(DATA.ITEMS || []).forEach(function (x) { if (!bao && x.type === 'bao') bao = x; });
chk('① 宝具物品在册（type=bao）', !!bao, bao && bao.id);

/* 发一件入包 + 真调装上 */
st.items[bao.id] = (st.items[bao.id] || 0) + 1;
var rEq = G.attachEquip(g, 'bao', bao.id);
chk('② 真调 attachEquip：装上成功', rEq.ok === true, rEq.msg);

/* ③ genPane 渲染：挂件行零残留 + 装备栏入口在 */
var html = G.ui.genPane(g);
chk('③a genPane 不含挂件行（gp-attach186 零残留）', html.indexOf('gp-attach186') < 0);
chk('③b genPane 不含未佩备注文案（"未佩宝具"零残留）', html.indexOf('未佩宝具') < 0);
chk('③c 装备栏「🔮 宝具」入口在（attach-pick / data-slot="bao"）',
  html.indexOf('data-action="attach-pick"') >= 0 && html.indexOf('data-slot="bao"') >= 0);

/* ④ 选择窗真渲染：已佩行 = 卸下按钮 */
G.ui.openAttachPick(g.id, 'bao');
var h4 = global.document.querySelector('#modal-root').innerHTML;
chk('④a 选择窗渲染含「卸下」按钮（当前件行 · attach-off）', h4.indexOf('data-action="attach-off"') >= 0,
  'len=' + h4.length);
chk('④b 「卸下」挂在「当前：」行内（当前：出现位 < 卸下出现位）',
  h4.indexOf('当前：') >= 0 && h4.indexOf('当前：') < h4.indexOf('data-action="attach-off"'),
  'cur=' + h4.indexOf('当前：') + ' off=' + h4.indexOf('data-action="attach-off"'));
chk('④c 单件场景：列表空态（库存归零）+ 已佩回显在（当前未佩 不出现）',
  h4.indexOf('库存中没有可佩') >= 0 && h4.indexOf('当前未佩') < 0);

/* ⑤ doDetach 真调：状态清空 + 库存守恒 + 窗重开刷新 */
var n0 = st.items[bao.id] || 0;
G.doDetach(g.id, 'bao');
var h5 = global.document.querySelector('#modal-root').innerHTML;
var n1 = st.items[bao.id] || 0;
chk('⑤a 卸下真调：attach.bao 清空', !(g.attach && g.attach.bao));
chk('⑤b 库存守恒（卸 +1）', n1 === n0 + 1, 'n=' + n0 + '→' + n1);
chk('⑤c 窗重开刷新：显示「当前未佩」', h5.indexOf('当前未佩') >= 0);
chk('⑤d 重开窗内「卸下」按钮消失（回佩上形态）', h5.indexOf('data-action="attach-off"') < 0);
chk('⑤e 重开窗内「佩上」按钮在（库存未清零）', h5.indexOf('data-action="attach-on"') >= 0);

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
