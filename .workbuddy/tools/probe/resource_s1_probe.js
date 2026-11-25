/* 资源地块数据层探针 —— 验证 resource.js 核心逻辑（S1） */
(function () {
  'use strict';
  var fs = require('fs'), path = require('path');
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };

  // 加载 core bundle（resource 在 core 包）
  var coreSrc = fs.readFileSync(path.join('E:/Deepseekdb', 'js', 'bundle-core.js'), 'utf8');
  // 只加载 data + sphere + cities + state + domain + resource 所需的最小集 —— 直接 eval 整个 core
  try {
    (0, eval)(coreSrc);
  } catch (e) {
    console.log('CORE_LOAD_ERR', e.message);
    process.exit(1);
  }

  var PASS = 0, FAIL = 0;
  function check(name, cond, extra) {
    if (cond) { PASS++; console.log('  PASS', name); }
    else { FAIL++; console.log('  FAIL', name, extra || ''); }
  }

  var RS = GAME.resource;
  console.log('RS.ON_MAP =', RS.ON_MAP);
  console.log('RS.RICH_BASE =', RS.RICH_BASE);
  console.log('RS.DEPLETE_MULT =', RS.DEPLETE_MULT);

  // 初始化最小 state（bucket 依赖 GAME.state 和 curPid）
  GAME.state = { activePlanet: 1 };
  var fakeSp = { cells: [], adj: [] };
  function mkCell(ci, type) { fakeSp.cells[ci] = { type: type }; fakeSp.adj[ci] = []; }
  // 造一个 6 格邻域：100 周围 6 个同类型 forest
  mkCell(100, 'forest');
  for (var n = 0; n < 6; n++) { var nc = 1000 + n; mkCell(nc, 'forest'); fakeSp.adj[100].push(nc); }
  mkCell(200, 'forest');
  mkCell(300, 'forest');
  fakeSp.adj[300] = [301, 302, 303];
  mkCell(301, 'forest'); mkCell(302, 'forest'); mkCell(303, 'plain');
  mkCell(400, 'hill');
  GAME.sphereOf = function () { return fakeSp; };

  // 1. 确定性 seed：同格两次 richness 一致
  var r1 = RS.ensure(100).richness, r2 = RS.ensure(100).richness;
  check('同格两次 richness 一致', r1 === r2, 'r1=' + r1 + ' r2=' + r2);

  // 2. richness 范围 0.5~2.0
  var okRange = true;
  for (var i = 0; i < 500; i++) {
    var r = RS.ensure(i * 7 + 3).richness;
    if (r < 0.5 || r > 2.0) { okRange = false; break; }
  }
  check('richness 全部落在 0.5~2.0', okRange);

  // 3. 储量公式：reserveMax = RICH_BASE × richness × (1+相连同类型×0.5)
  // 先验证 reserveMax 与 richness 成正比（同格）
  var rec = RS.ensure(100);
  check('reserveMax 已派生且 > 0', rec.reserveMax > 0, 'reserveMax=' + rec.reserveMax);
  check('初始 reserve = reserveMax', rec.reserve === rec.reserveMax, 'reserve=' + rec.reserve + ' max=' + rec.reserveMax);
  check('richness 与 reserveMax 关系（reserveMax/RICH_BASE >= richness*1.0）',
    rec.reserveMax >= RS.RICH_BASE * rec.richness * 1.0, '');

  // 4. 资源键映射
  check('RES_OF_TYPE.forest = wood', RS.RES_OF_TYPE.forest === 'wood');
  check('RES_OF_TYPE.hill = iron', RS.RES_OF_TYPE.hill === 'iron');
  check('RES_OF_TYPE.desert = stone', RS.RES_OF_TYPE.desert === 'stone');
  check('RES_OF_TYPE.lake = grain', RS.RES_OF_TYPE.lake === 'grain');

  // 5. 勘探：scanned 从 false 到 true
  var rec5 = RS.ensure(200);
  check('初始未勘探', rec5.scanned === false);
  RS.scan(200);
  check('勘探后 scanned=true', RS.at(200).scanned === true);

  // 6. 建厂判定：类型匹配
  // forest 格 300 有 2 个同类型邻居(301,302)，先勘探再测建厂
  var chkUnscanned = RS.canBuildPlant(300, 'forest');
  check('未勘探建厂被拒（300 尚未 scan）', chkUnscanned.ok === false, JSON.stringify(chkUnscanned));
  RS.scan(300);
  var chkOk = RS.canBuildPlant(300, 'forest');
  var chkBad = RS.canBuildPlant(300, 'mine');
  check('forest 格建 forest 采集场通过（勘探后）', chkOk.ok === true, JSON.stringify(chkOk));
  check('forest 格建 mine 被拒（类型不匹配）', chkBad.ok === false, JSON.stringify(chkBad));

  // 7. 软枯竭
  var rec7 = RS.ensure(400);
  RS.set(400, { reserve: 0 });
  check('depleted 判定（reserve=0）', RS.depleted(400) === true);
  check('consumeReserve 归零后不再扣', RS.consumeReserve(400, 100) === 0);

  // 8. 迁移幂等（需先开 MIGRATE_EXT 开关）
  RS.MIGRATE_EXT = true;
  var fakeState = { cities: [{ id: 'c1', extGrid: [{ id: 'e1', type: 'farm', lv: 3 }], res: { grain: 0, wood: 0, stone: 0, iron: 0 } }], resMigrated: false };
  var mig1 = RS.migrateExt(fakeState);
  check('首次迁移返回 refund', mig1 && mig1.ok === true && mig1.refund, JSON.stringify(mig1));
  check('迁移后 extGrid 清空', fakeState.cities[0].extGrid.every(function (e) { return !e.type; }));
  check('迁移后 resMigrated=true', fakeState.resMigrated === true);
  var mig2 = RS.migrateExt(fakeState);
  check('二次迁移幂等（返回 null）', mig2 === null);
  RS.MIGRATE_EXT = false;
  // 关闭开关后不再迁移
  var fakeState2 = { cities: [{ extGrid: [{ type: 'farm', lv: 1 }] }], resMigrated: false };
  var mig3 = RS.migrateExt(fakeState2);
  check('开关关闭时不迁移（返回 null）', mig3 === null);

  console.log('\n==== 结果: ' + PASS + ' 通过 / ' + FAIL + ' 失败 ====');
  process.exit(FAIL ? 1 : 0);
})();
