/* ============================================================
 * test/smoke.js — 用 jsdom 真跑一遍
 * ------------------------------------------------------------
 * 不是「代码能不能执行」，而是「玩家能不能玩」：
 *   派遣 → 遇事件 → 选择 → 阵亡 → 名字进纪念碑 → 时间推进
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'https://local.test/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const W = dom.window;

/* 按 index.html 的顺序注入 */
['js/data.js', 'js/state.js', 'js/engine.js', 'js/ui.js', 'js/main.js'].forEach((f) => {
  W.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
});
W.BOOT();   /* jsdom 里 DOMContentLoaded 还没触发，手动启动 */

let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ✅ ' + name + (extra ? '  — ' + extra : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  — ' + extra : '')); }
}

console.log('\n========== ① 启动 ==========');
const S0 = W.STATE.S();
check('世界已生成', !!S0);
check('地图 225 格', S0.tiles.length === 225, S0.tiles.length + ' 格');
check('城在中心且已点亮', S0.tiles[7 * 15 + 7].site === 'home' && S0.tiles[7 * 15 + 7].lit);
check('初始有 1 支队伍', S0.teams.length === 1, S0.teams[0] && S0.teams[0].name);
check('地图 DOM 渲染 225 格', W.document.querySelectorAll('.cell').length === 225);
check('未点亮格子是 hidden', W.document.querySelectorAll('.cell.hidden').length > 150,
  W.document.querySelectorAll('.cell.hidden').length + ' 格黑');

console.log('\n========== ② 派遣与补给 ==========');
const team = S0.teams[0];
const sup0 = team.supply;
/* 把 (8,7) 改成一个普通荒原，保证不触发事件 */
const t87 = S0.tiles[7 * 15 + 8];
t87.type = 'plain'; t87.site = null; t87.lit = false; t87.hint = '';
const r1 = W.ENGINE.dispatch(team.id, 8, 7);
W.UI.renderAll();
check('派遣成功', r1.ok, r1.msg || '');
check('队伍移动到位', team.x === 8 && team.y === 7, '(' + team.x + ',' + team.y + ')');
check('补给 -1', team.supply === sup0 - 1, sup0 + ' → ' + team.supply);
check('该格被点亮', t87.lit === true);
check('周围出现「痕迹」', S0.tiles[7 * 15 + 9].hint !== '' || S0.tiles[6 * 15 + 8].hint !== '',
  S0.tiles[7 * 15 + 9].hint || S0.tiles[6 * 15 + 8].hint);

console.log('\n========== ③ 事件 ==========');
const t88 = S0.tiles[7 * 15 + 9];
t88.site = 'warehouse'; t88.type = 'plain'; t88.lit = false;
W.ENGINE.dispatch(team.id, 9, 7);
W.UI.renderAll();
W.UI.maybeShowEvent();
check('危险地形触发事件', !!S0.event, S0.event && S0.event.title);
check('事件卡已弹出', W.document.getElementById('eventModal').hidden === false);
check('有三个选项', W.document.querySelectorAll('#evChoices .choice').length === 3);

/* 点「撤回」 */
const backBtn = Array.from(W.document.querySelectorAll('#evChoices .choice'))
  .find((b) => b.textContent.indexOf('撤回') === 0);
backBtn.click();
W.UI.renderAll();
check('撤回后事件清空', S0.event === null);
check('队伍回到城内', team.x === 7 && team.y === 7, '(' + team.x + ',' + team.y + ')');

console.log('\n========== ④ 阵亡与纪念碑 ==========');
const before = S0.memorial.length;
/* 造一个必死局：1 人队，已经站在据点旁边，只走一格就撞上 */
team.army = { buxingji: 1 }; team.men = 1; team.roster = [{ name: '测试甲', vet: false }]; team.vets = 0;
team.supply = 6; team.x = 8; team.y = 7;           /* 贴着目标，避免在路上先死 */
const t97 = S0.tiles[7 * 15 + 9];
t97.site = 'fort'; t97.type = 'plain'; t97.owner = 'rust'; t97.lit = false;
t97.duelDone = true;   /* 这一节测阵亡，不走斗将 */
W.ENGINE.dispatch(team.id, 9, 7);
W.UI.renderAll();
W.UI.maybeShowEvent();
if (S0.event) {
  const ass = Array.from(W.document.querySelectorAll('#evChoices .choice')).find((b) => b.textContent.indexOf('强攻') === 0);
  if (ass) ass.click();
  W.UI.renderAll();
}
check('队伍全灭', team.status === 'dead' || team.men === 0, 'men=' + team.men + ' status=' + team.status);
check('纪念碑新增死者', S0.memorial.length > before, before + ' → ' + S0.memorial.length);
check('死者有最后一句', !!(S0.memorial[0] && S0.memorial[0].last), S0.memorial[0] && S0.memorial[0].last);
check('那片地图留下殉难记号', !!t97.deadHere, t97.deadHere || '（无）');
check('纪念碑 DOM 有卡片', W.document.querySelectorAll('.mem-card').length > 0);

console.log('\n========== ⑤ 时间推进 ==========');
const food0 = S0.city.food;
W.ENGINE.advance(8);
W.UI.renderAll();
check('时间 +8 小时', S0.hour >= 8, 'hour=' + S0.hour);
check('粮食增长（或被盗）', S0.city.food !== food0, food0 + ' → ' + S0.city.food);
check('日志有记录', W.document.querySelectorAll('.log-line').length > 0,
  W.document.querySelectorAll('.log-line').length + ' 条');

console.log('\n========== ⑥ 招募与重新出发 ==========');
S0.city.food = 500; S0.city.iron = 500;
const aliveBefore = S0.teams.filter((t) => t.status !== 'dead').length;
const r2 = W.ENGINE.recruitTeam();
W.UI.renderAll();
const aliveAfter = S0.teams.filter((t) => t.status !== 'dead').length;
check('能招募新队', r2.ok, r2.msg || '');
check('可用队伍 +1', aliveAfter === aliveBefore + 1, aliveBefore + ' → ' + aliveAfter);
const nt = S0.teams[S0.teams.length - 1];
check('新队在城里', nt.x === 7 && nt.y === 7);
check('新队是默认编成（8 步行机）', nt.men === 8 && nt.army.buxingji === 8, nt.men + ' 人 · ' + JSON.stringify(nt.army));

console.log('\n========== ⑦ 势力活动 ==========');
const facCells0 = S0.factions.reduce((a, f) => a + f.cells, 0);
W.ENGINE.advance(40);
W.UI.renderAll();
const facCells1 = S0.factions.reduce((a, f) => a + f.cells, 0);
check('势力在扩张', facCells1 > facCells0, facCells0 + ' → ' + facCells1 + ' 格');

console.log('\n========== ⑧ 存档 ==========');
const saved = W.STATE.save();
check('能存档', saved === true);
check('存档里有纪念碑', JSON.parse(W.localStorage.getItem('new-wasteland-save-v1')).memorial.length > 0);

console.log('\n========== ⑨ 近处有内容可找 ==========');
let seedNear = 0, libNear = 0, campNear = 0;
S0.tiles.forEach((t, i) => {
  const x = i % 15, y = Math.floor(i / 15);
  const d = Math.max(Math.abs(x - 7), Math.abs(y - 7));
  if (d > 6) return;
  if (t.site === 'seed') seedNear++;
  if (t.site === 'warehouse') libNear++;
  if (t.site === 'town' || t.site === 'bigcity') campNear++;
});
check('6 格内有 2 座种子库（过冬有解）', seedNear >= 2, seedNear + ' 座');
check('6 格内有物资站', libNear >= 1, libNear + ' 座');
check('6 格内有聚落（前中期有伴）', campNear >= 1, campNear + ' 个');

console.log('\n========== ⑩ 过冬（挂机等不出来的那条） ==========');
const S1 = S0;
S1.city.seed = 0;
const pop0 = S1.city.pop;
const w0 = S1.winters;
W.ENGINE.advance(S1.nextWinter - S1.hour + 1);
check('冬天到了', S1.winters === w0 + 1, '第 ' + S1.winters + ' 个冬天');
check('没种子 → 人口减半', S1.city.pop < pop0, pop0 + ' → ' + S1.city.pop);

console.log('\n========== ⑪ 纪事（剧情阶梯） ==========');
check('冬天之后出了一页纪事', !!S1.story, S1.story && S1.story.title);
check('纪事是第 1 年', S1.story && S1.story.y === 1);
check('占位符全部替换掉了', S1.story && !/\{\w+\}/.test(S1.story.lines.join('')),
  S1.story && S1.story.lines.join('').slice(0, 40) + '…');
check('纪事写了真实死者', S1.story && S1.story.lines.join('').indexOf('没有回来') >= 0);
S1.story = null;

/* 终局：没图纸不能选「只接温控」——
   注意要设成 5：再过一次冬天会 +1，才等于第 6 年。 */
S1.winters = 5;
S1.city.tech = 0;
W.ENGINE.advance(S1.nextWinter - S1.hour + 1);
check('第 6 年出终局选择', !!(S1.story && S1.story.choices), S1.story && S1.story.title);
check('终局有三个选项', S1.story && S1.story.choices.length === 3);
const rNo = W.ENGINE.resolveStory('partial');
check('没图纸 → 只接温控被拦下', rNo.ok === false, rNo.msg || '');
S1.city.tech = 1;
const rYes = W.ENGINE.resolveStory('partial');
check('有图纸 → 能选只接温控', rYes.ok === true);
check('结局被记下来', S1.ending === 'partial', S1.ending);
check('结局后不再出纪事', S1.story === null);

S1.city.seed = 5;
const pop1 = S1.city.pop;
W.ENGINE.advance(S1.nextWinter - S1.hour + 1);
check('有种子 → 人口增加', S1.city.pop > pop1, pop1 + ' → ' + S1.city.pop);
check('种子被消耗', S1.city.seed === 3, '剩 ' + S1.city.seed);

console.log('\n========== ⑫ 编成 ==========');
const S3 = W.STATE.reset(4242);
const t3 = S3.teams[0];
const capNow = W.STATE.capacityNow();
check('默认编成 8 步行机', t3.men === 8 && t3.army.buxingji === 8, W.ENGINE.composeText(t3.army));
check('四轴可读', (function () {
  const st = W.STATE.armyStats(t3.army);
  return st.fire > 0 && st.armor > 0 && st.men === 8 && st.haul === 0;
})(), JSON.stringify(W.STATE.armyStats(t3.army)));
S3.city.iron = 500;
const rSwap = W.ENGINE.swapUnit(t3.id, 'zhuzhan', 1);
check('能加一个主战', rSwap.ok, rSwap.msg || '');
check('主战占 4 容量', W.STATE.armyPop(t3.army) === 12, W.STATE.armyPop(t3.army) + ' / ' + capNow);
check('火力上升', W.STATE.armyStats(t3.army).fire > 28, W.STATE.armyStats(t3.army).fire);
const rOver = W.ENGINE.swapUnit(t3.id, 'taitan', 1);
check('超编被拦住', rOver.ok === false, rOver.msg || '');
const rMinus = W.ENGINE.swapUnit(t3.id, 'zhuzhan', -1);
check('能减回来', rMinus.ok === true);

console.log('\n========== ⑬ 斗将 ==========');
const S4 = W.STATE.reset(999);
const t4 = S4.teams[0];
const fort = S4.tiles[7 * 15 + 9];
fort.site = 'fort'; fort.type = 'plain'; fort.lit = false; fort.owner = 'rust';
W.ENGINE.dispatch(t4.id, 9, 7);
check('进据点先斗将', !!S4.duel, S4.duel && S4.duel.styleName);
check('斗将不占事件位', S4.event === null);
const duel0 = S4.duel;
check('初始满血', duel0.pHp === 100 && duel0.eHp === 100);
let guard = 0;
while (S4.duel && !S4.duel.over && guard++ < 10) {
  W.ENGINE.duelMove(['thrust', 'guard', 'charge', 'feint'][guard % 4]);
}
check('五回合内结束', S4.duel && S4.duel.over, S4.duel && ('R' + S4.duel.round));
const res = S4.duel.result;
W.ENGINE.finishDuel();
check('斗将结果已定', res === 'win' || res === 'lose', res);
check('斗将后打开事件', !!S4.event, S4.event && S4.event.title);
check('同一块地不再斗将', fort.duelDone === true);

console.log('\n========== ⑭ 势力来使 ==========');
const S5 = W.STATE.reset(555);
S5.city.iron = 100;
S5.winters = 1;
W.ENGINE.advance(1);
check('第 2 年来了来使', !!S5.envoy, S5.envoy && S5.envoy.title);
const beforeIron = S5.city.iron;
const rEnv = W.ENGINE.resolveEnvoy('give');
check('能给图纸', rEnv.ok, S5.envoy === null ? 'ok' : '');
check('铁 +60', S5.city.iron === beforeIron + 60, beforeIron + ' → ' + S5.city.iron);
const rust = S5.factions.filter(function (f) { return f.id === 'rust'; })[0];
check('铁锈会暂停扩张', rust.pausedUntil != null && rust.pausedUntil >= 4, 'pausedUntil=' + rust.pausedUntil);
W.ENGINE.advance(1);
check('第二家还会来', !!S5.envoy, S5.envoy && S5.envoy.title);

console.log('\n========== ⑮ 太平年份（没人死） ==========');
const S2 = W.STATE.reset(777);
W.ENGINE.advance(S2.nextWinter - S2.hour);
const flat = S2.story ? S2.story.lines.join(' ') : '';
check('出了纪事', !!S2.story, S2.story && S2.story.title);
check('不写「最先没回来」', !/最先没回来/.test(flat), flat.slice(0, 46) + '…');
check('明说没有人没回来', /没有人没回来/.test(flat));

console.log('\n================================');
console.log('  通过 ' + pass + ' 项 · 失败 ' + fail + ' 项');
console.log('================================\n');
process.exit(fail ? 1 : 0);
