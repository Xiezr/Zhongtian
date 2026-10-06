/* v89.211 探针 C：工匠作坊器械提交链（老板 3「明明有作坊却提示本城暂无工匠作坊」）
   ------------------------------------------------------------
   病根假设：面板显示走 ui.trainBarracks()（陈旧 idx 会回落首座 → 显示正常），
   但提交 GAME.doTrain 把**陈旧的 ui._trainBIdx**（上次点的军营格）原样交给
   GAME.train → craftLevel(城, 军营格)=0 → 假报"本城尚无工匠作坊"。
   目标态：入场归一（openTroops）+ 提交读解析后的工位（doTrain）+ 域侧防御回落（train）。
   落盘前跑 → 红；落盘后跑 → 全绿。
   运行：node .workbuddy/tools/probe/probe_v89211c_train.js（输出重定向到文件再读） */
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra == null ? '' : extra) + ']'); }
}

var keep = G.state;
try {
  var st = G.newGame({ name: '器械探针', cityName: '许都', mapSeed: 7 });
  G.state = st;
  var c0 = st.cities[0];
  G.ui._cityId = c0.id;
  /* 与系统城同格：作坊(22) / 军营(18) / 书院(11)；等级过 投石车 unlock 线 */
  c0.cells[22].build = { id: 'gongjiangzuofang', lvl: 7 };
  c0.cells[18].build = { id: 'junying', lvl: 10 };
  c0.cells[11].build = { id: 'shuyuan', lvl: 10 };
  c0.res.pop = 500000;   /* 人口挂在 city.res.pop（popFreeOf 唯一读口） */
  G.goldAdd(9999999);
  c0.res.grain = 9999999; c0.res.wood = 9999999; c0.res.stone = 9999999; c0.res.iron = 9999999;

  /* ---------- ① 前置 ---------- */
  console.log('=== ① 前置 ===');
  chk('①a 作坊格 22 = Lv7 / 军营格 18 = 作坊 Lv0',
    G.craftLevel(c0, 22) === 7 && G.craftLevel(c0, 18) === 0,
    G.craftLevel(c0, 22) + ' / ' + G.craftLevel(c0, 18));
  var ct = G.canTrain('toudan', c0);
  chk('①b 投石车解锁门槛通过（书院10+作坊7）', ct.ok === true, ct.msg);

  /* ---------- ② 正确工位提交（本就应通过） ---------- */
  console.log('=== ② 正确工位 ===');
  var r1 = G.train('toudan', 1, c0.id, 22);
  chk('②a train(idx=作坊) 成功', r1.ok === true, r1.msg);
  chk('②b 队列落在作坊 22（不在 18）',
    G.trainQueuesOf(c0, 22, 'craft').length === 1 && G.trainQueuesOf(c0, 18, 'craft').length === 0,
    '22:' + G.trainQueuesOf(c0, 22, 'craft').length + ' 18:' + G.trainQueuesOf(c0, 18, 'craft').length);

  /* ---------- ③ 陈旧工位提交（病根场景） ---------- */
  console.log('=== ③ 陈旧工位（上次点的是军营格 18）===');
  var r2 = G.train('toudan', 1, c0.id, 18);
  chk('③a train(idx=军营格·陈旧) 不再假报「本城尚无工匠作坊」',
    r2.ok === true, r2.msg);
  if (r2.ok) {
    chk('③b 回落队列落在作坊 22', G.trainQueuesOf(c0, 22, 'craft').length === 2,
      '22:' + G.trainQueuesOf(c0, 22, 'craft').length);
  }

  /* ---------- ④ 真无作坊的城：提示必须准确 ---------- */
  console.log('=== ④ 无作坊城的准确提示 ===');
  var c1 = G.makeCity({ id: 'p2', name: '无作坊城', x: c0.x + 9, y: c0.y + 9 });
  c1.cells[11].build = { id: 'shuyuan', lvl: 10 };
  st.cities.push(c1);
  var r3 = G.train('toudan', 1, c1.id, 18);
  chk('④a 无作坊城 → 拒绝且提示含「工匠作坊」（准确归因）',
    r3.ok === false && r3.msg.indexOf('工匠作坊') >= 0, r3.msg);

  /* ---------- ⑤ UI 归一与提交链（源码） ---------- */
  console.log('=== ⑤ UI 链（源码）===');
  var uS = fs.readFileSync(R + 'js/ui.js', 'utf8');
  var mS = fs.readFileSync(R + 'js/main.js', 'utf8');
  chk('⑤a openTroops 入场归一（_trainBIdx = 解析后工位）',
    /_b211 \? _b211\.idx : null/.test(uS), '');
  chk('⑤b main.js open-siege 用本作坊自己的 idx',
    /case 'open-siege': ui\.openTroops\(el\.dataset\.idx, 'siege'\);/.test(mS));
  chk('⑤c main.js doTrain 读解析后工位（_bar211）',
    /_bar211 \? _bar211\.idx : null/.test(mS));

  /* ---------- ⑥ 行为核验：归一后的 _trainBIdx 真值 ---------- */
  console.log('=== ⑥ 行为：openTroops 归一 ===');
  /* 直接调 openTroops 需要 DOM 全链（面板重绘）——退一步验证 resolver 的归一结果 */
  G.ui._trainBIdx = 18;                      /* 模拟"上次点军营" */
  G.ui._trainFilter = 'siege';
  var bar = G.ui.trainBarracks();
  chk('⑥a resolver：陈旧 18 → 解析为作坊 22', bar && bar.idx === 22, bar && ('idx=' + bar.idx));
} catch (e) {
  console.log('  ✗ 探针异常: ' + (e && e.stack || e));
  FAIL++;
} finally {
  G.state = keep;
  G.ui._cityId = null;
}
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
