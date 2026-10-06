/* v89.202a 蕴养同款 —— 域层 + 面板形态验证（改前/改后各跑一次做对照）
   ------------------------------------------------------------
   改前预期：⑤a 新形态=false · ⑤b 旧单列=true · ⑥ 接线=false
   改后预期：全部翻转。域层（①②③④⑦）两轮都应通过（改造不动域层）。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}

var st = G.newGame({ name: 'ling202', cityName: '许都' });
G.state = st;
var c0 = st.cities[0]; G.ui._cityId = c0.id;
/* 发 3 件修炼装备（跨品质）+ 精华 */
['lg_weapon_1', 'lg_weapon_4', 'lg_head_2'].forEach(function (id) { try { G.addEquip(id); } catch (e) { } });
st.items.lingsui = 500;

console.log('--- ① 蕴养域层 ---');
var list = G.lingTemperList();
chk('① 蕴养清单（3 件修炼装备）', list.length === 3, 'n=' + list.length);
list.forEach(function (x) {
  console.log('   - ' + G.eqLabel(x) + '　q=' + DATA.EQUIP[G.eqId(x)].q + '　下一级成本=' + G.lingTemperCost(x));
});

console.log('--- ② 蕴养行为（真调） ---');
var t0 = list[0];
var lv0 = G.eqEnhOf(t0), ess0 = st.items.lingsui, cost0 = G.lingTemperCost(t0);
var r = G.lingTemper(t0);
chk('② 真调蕴养：等级 +1 且扣精华（' + lv0 + '→' + G.eqEnhOf(t0) + '，精华 ' + ess0 + '→' + st.items.lingsui + '）',
  r.ok && G.eqEnhOf(t0) === lv0 + 1 && st.items.lingsui === ess0 - cost0, JSON.stringify(r));

console.log('--- ③ 成本曲线（唯一出口） ---');
var c1 = G.lingTemperCost({ id: 'lg_weapon_1', enh: 0 });
var c5 = G.lingTemperCost({ id: 'lg_weapon_1', enh: 5 });
var c9 = G.lingTemperCost({ id: 'lg_weapon_1', enh: 9 });
chk('③ 成本 = essBase + (lv+1)*essPerLv（20 / 70 / 110）', c1 === 20 && c5 === 70 && c9 === 110,
  c1 + '/' + c5 + '/' + c9);

console.log('--- ④ key 出口（两体系共用 · uid ?? id） ---');
var k0 = G.ui.enhKeyOf(t0);
chk('④ enhKeyOf 对修炼件可用', k0 != null && String(k0).length > 0, 'key=' + k0);

console.log('--- ⑤ 面板形态（源码级 · 改前/改后对照） ---');
var src = fs.readFileSync(R + 'js/ui.js', 'utf8');
var fnStart = src.indexOf('ui.openLingTemper = function');
var fnEnd = src.indexOf('\n  };', fnStart);
var fn = src.slice(fnStart, fnEnd);
chk('⑤a 新形态：网格卡 + 筛选 + 分页 + 底键（改前=false）',
  /enh-card/.test(fn) && /ling-filter/.test(fn) && /ui\.LING_PER_PAGE/.test(fn)
    && /ling-pick/.test(fn) && /ui\.modalPage\('ling'/.test(fn), '');
chk('⑤b 旧单列退役（改前=false 表示尚未退役）',
  !/class="enh-row"/.test(fn) && !/class="enh-list"/.test(fn), '');
chk('⑤c xxl 档 + live + reopenKeepScroll', /size: 'xxl'/.test(fn) && /live: function/.test(fn), '');

console.log('--- ⑥ main 接线（改前=false） ---');
var msrc = fs.readFileSync(R + 'js/main.js', 'utf8');
chk('⑥ case ling-pick / ling-filter 在册',
  msrc.indexOf("case 'ling-pick': ui.lingPick(el.dataset.key); break;") >= 0
    && msrc.indexOf("case 'ling-filter': ui.setLingFilter(el.dataset.k); break;") >= 0, '');
chk('⑥b doLingTemper 走 reopenKeepScroll（保留滚动位）',
  /ui\.reopenKeepScroll\(ui\.openLingTemper\)/.test(msrc), '');

console.log('--- ⑦ 君主专属闸（域层） ---');
var lgBk = G.lordGeneralOf();
var dummy = { x: 1, y: 1 };
var rNo = (function () {
  /* 临时让 lordGeneralOf 返回 null */
  var bk = G.lordGeneralOf;
  G.lordGeneralOf = function () { return null; };
  var rr = G.lingTemper(t0);
  G.lordGeneralOf = bk;
  return rr;
})();
chk('⑦ 无君主时蕴养被拒（君主不在）', rNo && !rNo.ok && /君主/.test(rNo.msg || ''), JSON.stringify(rNo));

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
