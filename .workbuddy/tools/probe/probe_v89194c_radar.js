/* v89.194 探针C：前哨雷达圈口径（欧氏判定 + 渲染静态结构 + 重叠最近）
   ① fortAuraAt 欧氏：轴向命中 / 对角线不命中（旧切比雪夫会命中）/ 半对角命中
   ② 半径档位不变（6/8/10/12/14）
   ③ 重叠取最近（欧氏距离平方比较）
   ④ map.js 渲染结构：己方过滤 / 椭圆几何 / 图层位置（在地块后、④野地框前） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '雷达圈', region: '烬环' });
if (!G.state.map.grid) G.map.generate();
var s = G.state, c0 = s.cities[0];

console.log('══════ ① 欧氏判定（R=10 的哨）══════');
s.forts = s.forts || {};
s.forts['100,100'] = { x: 100, y: 100, lv: 6, name: '测试哨', day: 0, cityId: c0.id };
var R10 = G.fortRadiusOf(s.forts['100,100']);
console.log('  R=' + R10 + ' 轴向 (100+R,100) = ' + !!G.fortAuraAt(100 + R10, 100) + '（期望 true）');
console.log('  轴向 (100,100-R) = ' + !!G.fortAuraAt(100, 100 - R10) + '（期望 true）');
console.log('  轴向 (100+R+1,100) = ' + !!G.fortAuraAt(100 + R10 + 1, 100) + '（期望 false）');
console.log('  对角线 (100+R,100+R) = ' + !!G.fortAuraAt(100 + R10, 100 + R10)
  + '（期望 false —— 旧切比雪夫会 true，14.14>10）');
console.log('  半对角 (100+7,100+7) = ' + !!G.fortAuraAt(107, 107) + '（期望 true，9.9<10）');
console.log('  半对角边界 (100+8,100+8) = ' + !!G.fortAuraAt(108, 108) + '（期望 false，11.3>10）');

console.log('\n══════ ② 五档半径（数值未动）══════');
[1, 3, 5, 7, 10].forEach(function (lv) {
  console.log('  Lv' + lv + ' → ' + G.fortEffectOf({ lv: lv }).radius + ' 格');
});

console.log('\n══════ ③ 重叠取最近（欧氏 d²）══════');
delete s.forts['100,100'];
s.forts['200,200'] = { x: 200, y: 200, lv: 2, name: 'A弱', day: 0, cityId: c0.id };   /* R6 */
s.forts['210,200'] = { x: 210, y: 200, lv: 10, name: 'B强', day: 0, cityId: c0.id };  /* R14 */
var atA = G.fortAuraAt(202, 200);    /* 距 A 2、距 B 8 → A */
var atB = G.fortAuraAt(208, 200);    /* 距 A 8（>6 不覆盖 A）、距 B 2 → B */
console.log('  (202,200) → ' + (atA && atA.name) + '（期望 A弱）');
console.log('  (208,200) → ' + (atB && atB.name) + '（期望 B强）');
delete s.forts['200,200']; delete s.forts['210,200'];

console.log('\n══════ ④ 渲染结构（源码级）══════');
var mj = fs.readFileSync(path.join(R, 'js/map.js'), 'utf8');
console.log('  己方过滤（!f194.cityId → continue）: ' + /if \(!f194 \|\| !f194\.cityId\) continue;/.test(mj));
console.log('  椭圆几何（√2·R·HW / HH）: ' + /R194 \* HW \* 1\.4142/.test(mj) && /R194 \* HH \* 1\.4142/.test(mj));
console.log('  淡填充不遮地块（alpha .055）: ' + /rgba\(140,220,170,\.055\)/.test(mj));
console.log('  主圈描边（相位）: ' + /ringA194/.test(mj));
console.log('  图层位置（雷达圈在野地框之前）: '
  + (mj.indexOf('④a 己方前哨：雷达辐射圈') < mj.indexOf('④ 已占野地：金色菱形框')));
console.log('  能力守卫（桩环境）: ' + /if \(!ctx \|\| !ctx\.ellipse\) return;/.test(mj));
console.log('\n完成。');
process.exit(0);
