/* 采集场探针（S4）—— 建厂 → 产量×丰度 → 储量扣减 → 软枯竭，一条链走通
 * 用法：node .workbuddy/tools/probe/plant_probe.js
 */
(function () {
  'use strict';
  var fs = require('fs'), path = require('path');
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  global.document = {
    createElement: function () { return { style: {}, appendChild: function () { }, setAttribute: function () { }, classList: { add: function () { }, remove: function () { } } }; },
    getElementById: function () { return null; }, querySelector: function () { return null; },
    querySelectorAll: function () { return []; }, addEventListener: function () { }, body: { appendChild: function () { } }
  };
  var src = fs.readFileSync(path.join('E:/Deepseekdb', 'js', 'bundle-core.js'), 'utf8');
  try { (0, eval)(src); } catch (e) { console.log('CORE_LOAD_ERR', e.message); process.exit(1); }

  var PASS = 0, FAIL = 0;
  function check(name, cond, extra) {
    if (cond) { PASS++; console.log('  PASS ' + name + (extra ? '  [' + extra + ']' : '')); }
    else { FAIL++; console.log('  FAIL ' + name + '  ' + (extra || '')); }
  }
  var G = GAME, RS = G.resource;
  var st = G.newGame({ name: 'plant测试', cityName: '钢岭', mapSeed: 20261125 });
  var city = st.cities[0];
  var pid = G.curPid();
  var SP = G.sphereOf(pid);

  console.log('== S4 采集场链路 ==');
  console.log('MIGRATE_EXT=' + RS.MIGRATE_EXT + ' RICH_BASE=' + RS.RICH_BASE + ' DEPLETE=' + RS.DEPLETE_MULT);

  /* 找一格森林 */
  var forestCi = -1;
  for (var i = 0; i < SP.cells.length; i++) {
    if (SP.cells[i] && SP.cells[i].type === 'forest') { forestCi = i; break; }
  }
  check('星球上能找到森林格', forestCi >= 0, 'ci=' + forestCi);

  /* 填满资源，保证付得起 */
  ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.city.add(city, k, 5e6); });
  city.res.pop = 1e5;

  /* ① 未勘探不能建 */
  var pre = RS.canBuildPlant(forestCi, 'forest', pid);
  check('未勘探被拒（近地面勘探是前置）', pre.ok === false, pre.msg);

  /* ② 勘探 → 可建 */
  RS.scan(forestCi, pid);
  var okc = RS.canBuildPlant(forestCi, 'forest', pid);
  check('勘探后可建匹配采集场', okc.ok === true, JSON.stringify(okc));

  /* ③ 业务层建厂（走 domain.buildPlant：扣费 + 排队） */
  var before = { grain: city.res.grain, wood: city.res.wood };
  var bp = G.buildPlant(forestCi, 'forest');
  check('buildPlant 开工', bp.ok === true, bp.msg);
  check('建厂扣了资源', city.res.grain < before.grain || city.res.wood < before.wood,
    'grain ' + Math.round(before.grain) + '→' + Math.round(city.res.grain));
  var qb = (st.queues.build || []).filter(function (q) { return q.type === 'plant_build' && q.ci === forestCi; })[0];
  check('建造队列登记 plant_build', !!qb, qb ? ('工期 ' + Math.round(qb.totalTime) + 's') : '无');

  /* ④ 推完工期 → 落成（直接走 applyBuildDone，等价于队列到点） */
  if (qb) { st.queues.build = st.queues.build.filter(function (q) { return q !== qb; }); G.applyBuildDone(qb); }
  var pa = RS.plantAt(forestCi, pid);
  check('落成后 plantAt 有厂', !!pa && pa.plant === 'forest', JSON.stringify(pa));

  /* ⑤ extGridOf 投影（产量链/仓容链共用的唯一取材口） */
  var grid = G.extGridOf(city);
  var proj = grid.filter(function (e) { return e.ci === forestCi; })[0];
  check('extGridOf 投影出该厂（type/lv/richness 齐全）',
    !!proj && proj.type === 'forest' && proj.lv === 1 && proj.richness > 0,
    proj ? ('lv' + proj.lv + ' rich=' + proj.richness.toFixed(2)) : '未投影');

  /* ⑥ 产量 × 丰度
     ⚠️ 不能拿绝对值比：prodBasePerHourOf 末尾还有全局折扣（连通性/气候/污染，
        实测本 seed 是 ×0.906）。所以验**比值**：产量增量 ÷ (基础×丰度) = 折扣系数 k，
        k 必须落在 (0.5, 1.05] —— 若丰度没进产量，这个比值会变成 0.906/0.53≈1.71，必然出界。 */
  var rec = RS.at(forestCi, pid);
  var baseProd = (G.DATA.EXT_BUILDINGS.forest.prod[0] || 0);
  var expectRaw = baseProd * rec.richness;
  var perHourWith = G.prodBasePerHourOf(city).wood;
  RS.set(forestCi, { plant: null, plantLv: 0 }, pid);        /* 临时拆掉（只改数据） */
  var perHourWithout = G.prodBasePerHourOf(city).wood;
  RS.set(forestCi, { plant: 'forest', plantLv: 1 }, pid);     /* 装回去 */
  var delta = perHourWith - perHourWithout;
  var k = expectRaw > 0 ? delta / expectRaw : 0;
  check('产量增量 = 基础 × 丰度 × 全局折扣（k∈(0.5,1.05]）',
    delta > 0 && k > 0.5 && k <= 1.05,
    '增量 ' + delta.toFixed(1) + ' 基础×丰度 ' + expectRaw.toFixed(1) + ' k=' + k.toFixed(3));
  var expect = delta;                      /* 后面按"实际增量"当基准，避开折扣 */

  /* ⑦ 储量扣减
     ⚠️ 两把尺：储量按**理论产出**（基础×丰度）扣，入账产量还要乘环境折扣。
        见 resource.js tickMine 的口径注释 —— 别拿入账量去比储量下降量。 */
  var reserve0 = rec.reserve;
  RS.tickMine(3600);                     /* 1 游戏小时 */
  var reserve1 = RS.at(forestCi, pid).reserve;
  var dropped = reserve0 - reserve1;
  check('储量按理论产出扣减（基础×丰度 · 不乘环境折扣）',
    Math.abs(dropped - expectRaw) < Math.max(1, expectRaw * 0.02),
    '扣 ' + dropped.toFixed(0) + ' 期望 ' + expectRaw.toFixed(0));

  /* ⑧ 软枯竭：储量归零 → 产量折为 25%，不停产 */
  RS.set(forestCi, { reserve: 0 }, pid);
  var perHourDead = G.prodBasePerHourOf(city).wood;
  RS.set(forestCi, { plant: null, plantLv: 0 }, pid);
  var perHourDeadNo = G.prodBasePerHourOf(city).wood;
  RS.set(forestCi, { plant: 'forest', plantLv: 1, reserve: 0 }, pid);
  var deltaDead = perHourDead - perHourDeadNo;
  var ratio = delta > 0 ? deltaDead / delta : 0;
  check('软枯竭：产量折为 25%（不停产、不为 0）',
    deltaDead > 0 && Math.abs(ratio - RS.DEPLETE_MULT) < 0.02,
    '枯竭增量 ' + deltaDead.toFixed(1) + ' / 正常 ' + delta.toFixed(1) + ' = ' + ratio.toFixed(3));
  /* 枯竭的**这一格**不再被扣（tickMine 的总返回值里还有开局预置的其它厂，不能拿它当判据） */
  var _r0 = RS.at(forestCi, pid).reserve;
  RS.tickMine(3600);
  check('枯竭格再挖不再扣（储量保持 0）', RS.at(forestCi, pid).reserve === _r0 && _r0 === 0,
    'reserve=' + RS.at(forestCi, pid).reserve);

  /* ⑨ 老档迁移：extGrid 清零 + 返还（幂等） */
  var fake = {
    cities: [{ id: 'c1', extGrid: [{ id: 'e1', type: 'farm', lv: 3 }, { id: 'e2', type: null, lv: 0 }],
      res: { grain: 0, wood: 0, stone: 0, iron: 0 } }]
  };
  var m1 = RS.migrateExt(fake);
  check('迁移返还已投入资源', !!m1 && m1.ok === true && m1.refund.grain > 0, JSON.stringify(m1 && m1.refund));
  check('迁移后 extGrid 全空', fake.cities[0].extGrid.every(function (e) { return !e.type; }), '');
  check('迁移幂等（二次返回 null）', RS.migrateExt(fake) === null, '');

  /* ⑩ 拆除返还半数 */
  var before2 = city.res.wood;
  var dm = G.dismantlePlant(forestCi);
  check('拆除成功且返还材料', dm.ok === true && city.res.wood > before2, dm.msg);
  check('拆除后地块无厂（储量仍在）',
    !RS.plantAt(forestCi, pid) && RS.at(forestCi, pid).reserveMax > 0, '');

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
