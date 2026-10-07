/* ============================================================
 * audit_v89229b_troopchain.js — **兵种链体检**（v89.230）
 * ------------------------------------------------------------
 * 老板（v89.229 交付四问之 4）：「贴图将另外处理，先考虑兵种名称和其相关依赖和被引。
 *   确保链路通畅，方便挂载/去除特定兵种，形成可复用流程」。
 *
 * 本工具 = "兵种链"的**唯一实现**（smoke §230② 调用它；不另写第二份判据）。
 * 一个兵种从数据表出发，链到 6 组节点，逐节点验"在不在 / 合法不合法"：
 *   ① 表字段：id/name/ab/grp/七项数值/cost/unlock/desc
 *   ② 形态：troopShapeOf 三态（walk/ride/craft —— craft > ride > walk 优先级）
 *   ③ 图标三链：矢量名册（icons.js TR）· 素材（gicons MAP.troop）· 位图（BITMAPS + 磁盘文件）
 *   ④ 解锁链：建筑门槛（∈ BUILDINGS 且 ≤ maxLevel）· 科技（∈ TECH）· 首府（∈ 五区）
 *   ⑤ 被引表：AUTO_MARCH.troopOrder · WILD_DEFENSE · NPC_CITY_RES.garrisonMix ·
 *      SMART_PLAN.targets(键/值) · CAPTIVE.unknownAs · TROOP_MAP_229(值) · map.fortGarrison
 *   ⑥ 反向：退役 id 在产品侧（剥注释后）零残留 · 名册孤儿键（TR/gicons 脚注）
 *
 * 用法：
 *   node .workbuddy/tools/audit/audit_v89229b_troopchain.js                    # 体检 + 结论（退出码 0/1）
 *   node .workbuddy/tools/audit/audit_v89229b_troopchain.js --refs buxingji    # 某兵种的"被引"清单
 *   node .workbuddy/tools/audit/audit_v89229b_troopchain.js --art              # 贴图链对齐检查
 *
 * --art（v89.235 增）：出图链（wasteland_batches.json W-B3 · wasteland_prompts.py
 *   TROOP_TIERS/BRIEF · docs 清单逐 id 表）与 DATA.TROOPS 的 id 对齐度。
 *   贴图链由**贴图批**维护 —— 本模式供"更新完成后一键验收"，不进 gate 常跑。
 *
 * 挂载/去除流程图见 docs/_史料/交付/v89230-兵种链路与挂载流程.md。
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '..', '..', '..');

/* 18 个退役 id（v89.229 兵种重构 18→14）—— 唯一合法去处 = state.js 的迁移表 */
var RETIRED = ['minfu', 'qingji', 'chihou', 'zhouche', 'yibing', 'changqiang', 'qingzhoubing', 'daodun',
  'gongjian', 'tuqibing', 'tieji', 'xiliangtieqi', 'hubaoqi', 'tengjiabing', 'toudan', 'chongche',
  'chuangnu', 'nanjiangxiangbing'];
var RES_KEYS = ['grain', 'wood', 'stone', 'iron', 'gold'];
var SHAPES = ['walk', 'ride', 'craft'];

function strip(x) {
  return String(x).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function makeReader(root) {
  var cache = {};
  return function (rel) {
    if (!(rel in cache)) {
      try { cache[rel] = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { cache[rel] = ''; }
    }
    return cache[rel];
  };
}

/* ------------------------------------------------------------------
 * 体检主入口：auditTroopChain(G, DATA[, opt]) → { ids, rows, errors, warnings, summary }
 * ------------------------------------------------------------------ */
function auditTroopChain(G, DATA, opt) {
  opt = opt || {};
  var root = opt.root || ROOT;
  var read = makeReader(root);
  var errors = [], warnings = [];

  /* ---- 合法键集合（尽量从既有表/源派生，不另立第二来源） ---- */
  var techIds = {};
  (DATA.TECH || []).forEach(function (t) { if (t && t.id) techIds[t.id] = 1; });
  var bldKeys = DATA.BUILDINGS ? Object.keys(DATA.BUILDINGS) : [];
  var cityKeys = [];
  (function () {
    var m = read('js/domain.js').match(/var STATE_NAME = \{([^}]*)\}/);
    if (m) m[1].replace(/([a-z_0-9]+)\s*:/g, function (_, k) { cityKeys.push(k); return _; });
    if (!cityKeys.length) {
      cityKeys = ['qingzhou', 'yizhou', 'hebei', 'sili', 'liangzhou'];
      warnings.push('unlock.city 合法集未能从 domain.js 解析（用内置表兜底）');
    }
  })();

  /* ---- 矢量名册（icons.js 的 TR 表）键 ---- */
  var trKeys = [];
  (function () {
    var src = read('js/icons.js');
    var i = src.indexOf('var TR = {');
    if (i >= 0) {
      var j = src.indexOf('\n  };', i);
      var seg = src.slice(i, j < 0 ? i + 9000 : j);
      seg.replace(/\n\s*([a-z_0-9]+)\s*:\s*\{/g, function (_, k) { trKeys.push(k); return _; });
    }
  })();

  var GG = (typeof global !== 'undefined' && global.GICONS) || null;
  var BM = (typeof global !== 'undefined' && global.BITMAPS) || null;

  /* ---- 被引表（值域必须 ⊆ DATA.TROOPS） ---- */
  var refTables = [];
  function addTable(name, keys) {
    refTables.push({ name: name, keys: (keys || []).filter(function (k) { return k != null && k !== ''; }) });
  }
  addTable('AUTO_MARCH.troopOrder', (DATA.AUTO_MARCH && DATA.AUTO_MARCH.troopOrder) || []);
  addTable('WILD_DEFENSE', (function () {
    var out = [];
    (DATA.WILD_DEFENSE || []).forEach(function (row) {
      (row || []).forEach(function (e) { if (e && e.id) out.push(e.id); });
    });
    return out;
  })());
  addTable('NPC_CITY_RES.garrisonMix', (function () {
    return ((DATA.NPC_CITY_RES && DATA.NPC_CITY_RES.garrisonMix) || []).map(function (e) { return e && e.id; });
  })());
  addTable('SMART_PLAN.targets(键)', Object.keys((DATA.SMART_PLAN && DATA.SMART_PLAN.targets) || {}));
  addTable('SMART_PLAN.targets(值)', (function () {
    var t = (DATA.SMART_PLAN && DATA.SMART_PLAN.targets) || {};
    return Object.keys(t).map(function (k) { return t[k]; });
  })());
  addTable('CAPTIVE.unknownAs', [(DATA.CAPTIVE && DATA.CAPTIVE.unknownAs)]);
  addTable('TROOP_MAP_229(值)', (function () {
    var m = (G && G.TROOP_MAP_229) || {};
    return Object.keys(m).map(function (k) { return m[k]; });
  })());

  refTables.forEach(function (tb) {
    tb.keys.forEach(function (k) {
      if (!DATA.TROOPS[k]) errors.push('被引表 ' + tb.name + ' 含未知兵种「' + k + '」');
    });
  });

  /* ---- 派生出口：fortGarrison（运行时派生，最容易漏改的一处） ---- */
  if (G && G.map && typeof G.map.fortGarrison === 'function') {
    for (var lv = 1; lv <= 10; lv++) {
      var fg = G.map.fortGarrison(lv), tot = 0, bad = [];
      Object.keys(fg || {}).forEach(function (k) {
        if (!DATA.TROOPS[k]) bad.push(k);
        tot += fg[k] || 0;
      });
      if (bad.length) errors.push('fortGarrison Lv' + lv + ' 含未知兵种: ' + bad.join(','));
      if (!(tot > 0)) errors.push('fortGarrison Lv' + lv + ' 守军为空（整支为 0 是 v89.229 曾犯过的病）');
    }
  } else {
    warnings.push('G.map.fortGarrison 不可达（跳过派生出口体检）');
  }

  /* ---- 逐兵种六组节点 ---- */
  var ids = Object.keys(DATA.TROOPS);
  var abSeen = {};
  var rows = [];
  ids.forEach(function (id) {
    var t = DATA.TROOPS[id] || {};
    var row = { id: id, name: t.name || '?', ab: t.ab || '?', grp: t.grp, shape: '', vec: false, gicon: false, bitmap: '', unlock: 'ok', refs: {}, errs: [], warns: [] };
    function err(m) { row.errs.push(m); errors.push(id + '：' + m); }
    function warn(m) { row.warns.push(m); warnings.push(id + '：' + m); }

    /* ① 表字段 */
    if (t.id !== id) err('表键与 id 字段不一致');
    if (!t.name) err('缺 name');
    if (!t.ab || String(t.ab).length !== 1) err('简称必须为单字');
    if (abSeen[t.ab]) err('简称与「' + abSeen[t.ab] + '」重复'); else abSeen[t.ab] = id;
    if (!(t.grp === 1 || t.grp === 2 || t.grp === 3)) err('grp 非法: ' + t.grp);
    ['hp', 'atk', 'def', 'range', 'spd', 'time', 'pop'].forEach(function (k) {
      if (!(Number(t[k]) > 0)) err('数值非法 ' + k + '=' + t[k]);
    });
    if (!t.desc) warn('缺 desc（卡面/悬停无说明）');
    if (!t.cost || typeof t.cost !== 'object') err('缺 cost');
    else Object.keys(t.cost).forEach(function (k) {
      if (RES_KEYS.indexOf(k) < 0) err('cost 含未知资源键: ' + k);
      else if (!(Number(t.cost[k]) > 0)) err('cost.' + k + ' 非正数');
    });

    /* ② 形态（唯一出口 troopShapeOf） */
    var expShape = t.craft ? 'craft' : (t.ride ? 'ride' : 'walk');
    var gotShape = (G && G.troopShapeOf) ? G.troopShapeOf(id) : expShape;
    row.shape = gotShape;
    if (SHAPES.indexOf(gotShape) < 0) err('形态值域外: ' + gotShape);
    else if (gotShape !== expShape) err('形态判定漂移: troopShapeOf=' + gotShape + ' 期望 ' + expShape);

    /* ③ 解锁链 */
    var u = t.unlock || {};
    if (!Object.keys(u).length) err('缺 unlock');
    Object.keys(u).forEach(function (k) {
      if (k === 'city') {
        if (cityKeys.indexOf(u.city) < 0) err('unlock.city 非法: ' + u.city);
      } else if (k === 'tech') {
        Object.keys(u.tech || {}).forEach(function (tk) {
          if (!techIds[tk]) err('unlock.tech 未知科技: ' + tk);
          else if (!(u.tech[tk] >= 1)) err('unlock.tech.' + tk + ' 级别非法');
        });
      } else {
        if (bldKeys.indexOf(k) < 0) err('unlock 未知建筑: ' + k);
        else if (!(u[k] >= 1)) err('unlock.' + k + ' 级别非法');
        else {
          var mx = DATA.BUILDINGS[k] && DATA.BUILDINGS[k].maxLevel;
          if (mx && u[k] > mx) err('门槛超建筑上限: ' + k + ' Lv' + u[k] + ' > ' + mx);
        }
      }
    });
    if (t.craft && !u.gongjiangzuofang) err('器械兵（craft）缺机工坊门槛');
    if (!t.craft && u.gongjiangzuofang) warn('非器械兵却带机工坊门槛（出现即查）');

    /* ④ 图标三链 */
    if (trKeys.indexOf(id) < 0) err('矢量名册（icons.js TR）缺该兵种 —— 位图缺失时将无回退');
    else row.vec = true;
    if (GG && GG.MAP && GG.MAP.troop) {
      if (!GG.MAP.troop[id]) err('gicons 素材名册缺该兵种');
      else if (GG.draw && !GG.draw('troop', id)) err('gicons.draw 取图为空');
      else row.gicon = true;
    } else warn('gicons 素材层不可达（测试环境才可能）');
    if (BM) {
      var bf = BM.fileOf('troop', id);
      if (bf) {
        if (!fs.existsSync(path.join(root, 'assets', 'icons', 'ui', bf))) err('位图登记了但磁盘文件缺失: assets/icons/ui/' + bf);
        else row.bitmap = bf;
      } else warn('无位图（走矢量回退 —— 贴图另行处理时可后补）');
    } else warn('BITMAPS 不可达');
    if (G && G.icons && G.icons.forTroop && !G.icons.forTroop(id)) err('forTroop 取图为空（矢量+位图双缺）');

    /* ⑤ 被引命中（逐表计数） */
    refTables.forEach(function (tb) {
      tb.keys.forEach(function (k) { if (k === id) row.refs[tb.name] = (row.refs[tb.name] || 0) + 1; });
    });

    rows.push(row);
  });

  /* ⑥ 反向：退役 id 的**产品侧可执行形态零残留**（剥注释；state.js 迁移表是唯一合法去处） */
  var REV_FILES = ['js/data.js', 'js/domain.js', 'js/map.js', 'js/battle.js', 'js/tactic.js', 'js/systems.js',
    'js/ui.js', 'js/questdata.js', 'js/icons.js', 'js/gicons.js', 'js/main.js', 'index.html'];
  REV_FILES.forEach(function (rel) {
    var src = strip(read(rel));
    RETIRED.forEach(function (rid) {
      var reKey = new RegExp('[\\{\\s,][\'"]?' + rid + '[\'"]?\\s*:');
      var reStr = new RegExp('[\'"]' + rid + '[\'"]');
      if (reKey.test(src) || reStr.test(src)) errors.push(rel + ' 残留退役兵种 id: ' + rid);
    });
  });

  /* ⑥ 反向：名册孤儿键（TR / gicons 有、TROOPS 没有） */
  trKeys.forEach(function (k) { if (!DATA.TROOPS[k]) errors.push('icons.js TR 脚注残留: ' + k); });
  if (GG && GG.MAP && GG.MAP.troop) {
    Object.keys(GG.MAP.troop).forEach(function (k) {
      if (!DATA.TROOPS[k]) errors.push('gicons 名册脚注残留: ' + k);
    });
  }

  return {
    ids: ids, rows: rows, errors: errors, warnings: warnings,
    summary: { n: rows.length, errors: errors.length, warnings: warnings.length },
  };
}

/* ------------------------------------------------------------------
 * CLI
 * ------------------------------------------------------------------ */
function printReport(rep) {
  function pad(s, w) { s = String(s); while (s.length < w) s += ' '; return s; }
  console.log('兵种链体检（v89.230）—— ' + rep.rows.length + ' 兵种 × 依赖 / 被引');
  console.log(['id', '名称', '简', '组', '形态', '矢量', '素材', '位图', '解锁'].join(' | '));
  rep.rows.forEach(function (r) {
    console.log([pad(r.id, 10), pad(r.name, 12), r.ab, r.grp, pad(r.shape, 5),
      r.vec ? '✓' : '✗', r.gicon ? '✓' : '✗', r.bitmap || '（回退矢量）', r.unlock].join(' | '));
  });
  console.log('');
  console.log('被引统计（表 → 命中兵种）:');
  var tables = {};
  rep.rows.forEach(function (r) {
    Object.keys(r.refs).forEach(function (k) { (tables[k] = tables[k] || []).push(r.id); });
  });
  Object.keys(tables).forEach(function (k) { console.log('  ' + k + ': ' + tables[k].length + ' 个 → ' + tables[k].join(', ')); });
  console.log('');
  console.log(rep.errors.length ? ('✗ 错误 ' + rep.errors.length + ' 条：') : '✓ 错误 0 条');
  rep.errors.slice(0, 40).forEach(function (e) { console.log('  ✗ ' + e); });
  if (rep.warnings.length) {
    console.log('⚠ 警告 ' + rep.warnings.length + ' 条：');
    rep.warnings.slice(0, 20).forEach(function (w) { console.log('  ⚠ ' + w); });
  }
}

function printRefs(id) {
  var read = makeReader(ROOT);
  var files = ['js/data.js', 'js/state.js', 'js/domain.js', 'js/map.js', 'js/battle.js', 'js/tactic.js',
    'js/systems.js', 'js/ui.js', 'js/questdata.js', 'js/icons.js', 'js/gicons.js', 'js/bitmaps.js',
    'js/main.js', 'index.html', 'smoke-test.js', 'e2e-test.js'];
  var re = new RegExp('\\b' + id + '\\b');
  var n = 0;
  console.log('兵种「' + id + '」的被引清单（word-boundary 全文扫）:');
  files.forEach(function (rel) {
    read(rel).split('\n').forEach(function (line, i) {
      if (re.test(line)) { n++; console.log('  ' + rel + ':' + (i + 1) + '  ' + line.trim().slice(0, 150)); }
    });
  });
  console.log('—— 共 ' + n + ' 处');
}

/* ------------------------------------------------------------------
 * --art：贴图链对齐检查（v89.235）
 *   出图链三文件（batches.json / wasteland_prompts.py / docs 清单）都是"贴图批"
 *   维护的工作集；兵种 18→14 重构后须逐一对齐。本模式把"对齐度"变成可执行检查，
 *   贴图批更新完成后复跑即验收（对齐退 0 / 有滞后退 1）。
 * ------------------------------------------------------------------ */
function printArt() {
  var DATA = global.GAME && global.GAME.DATA;
  var troops = Object.keys((DATA && DATA.TROOPS) || {});
  if (!troops.length) { console.error('✗ 拿不到 DATA.TROOPS'); process.exit(2); }
  var setT = {};
  troops.forEach(function (k) { setT[k] = 1; });
  var read = makeReader(ROOT);
  var allOk = true;

  function diff(name, ids) {
    var uniq = {};
    ids.forEach(function (x) { if (x) uniq[x] = 1; });
    var ks = Object.keys(uniq);
    var missing = troops.filter(function (t) { return !uniq[t]; });
    var stale = ks.filter(function (k) { return !setT[k]; });
    var ok = !missing.length && !stale.length && ks.length === troops.length;
    if (!ok) allOk = false;
    console.log('── ' + name);
    console.log('   命中 ' + ks.length + '/' + troops.length + ' 个 id' + (ok ? '  ✓ 与 DATA.TROOPS 全对齐' : ''));
    if (missing.length) console.log('   缺（未更新）: ' + missing.join(', '));
    if (stale.length) console.log('   非现行 id（旧残留）: ' + stale.join(', '));
    return ok;
  }

  /* ① batches.json · W-B3 兵种批图集 ids */
  var batIds = [];
  try {
    var spec = JSON.parse(read('.workbuddy/tools/asset/wasteland_batches.json'));
    (spec.atlasBatches || []).forEach(function (b) {
      (b.atlases || []).forEach(function (a) {
        if (a.group === 'troop') (a.ids || []).forEach(function (x) { batIds.push(x); });
      });
    });
  } catch (e) { console.log('── wasteland_batches.json 读取失败: ' + e.message); allOk = false; }
  diff('wasteland_batches.json（W-B3 兵种批）', batIds);

  /* ② wasteland_prompts.py · TROOP_TIERS 五阶表 + BRIEF 兵种段 */
  var py = read('.workbuddy/tools/gen/wasteland_prompts.py');
  var tIds = [];
  (function () {
    var i0 = py.indexOf('TROOP_TIERS = [');
    var i1 = py.indexOf('TIER_OF', i0);
    if (i0 >= 0 && i1 > i0) {
      py.slice(i0, i1).replace(/\(\s*"([a-z_0-9]+)"\s*,\s*"/g, function (_, k) { tIds.push(k); return _; });
    }
  })();
  diff('wasteland_prompts.py（TROOP_TIERS 五阶表）', tIds);
  var bIds = [];
  (function () {
    var j0 = py.indexOf('# 兵种');
    var j1 = py.indexOf('# 装备部位', j0);
    if (j0 >= 0 && j1 > j0) {
      py.slice(j0, j1).replace(/\n\s*"([a-z_0-9]+)"\s*:/g, function (_, k) { bIds.push(k); return _; });
    }
  })();
  diff('wasteland_prompts.py（BRIEF 兵种段）', bIds);

  /* ③ docs 清单 · 逐 id 形制表 */
  var md = read('docs/AI图标生成清单-废土版.md');
  var mdIds = [];
  (function () {
    var k0 = md.indexOf('**逐 id 形制**');
    var k1 = md.indexOf('\n## ', k0 + 5);
    if (k0 >= 0) {
      md.slice(k0, k1 < 0 ? md.length : k1).replace(/^\|\s*([a-z_0-9]+)\s*\|/gm,
        function (_, k) { if (k !== 'id') mdIds.push(k); return _; });
    }
  })();
  diff('docs/AI图标生成清单-废土版.md（逐 id 表）', mdIds);

  console.log('');
  console.log(allOk
    ? '✓ 贴图链与 DATA.TROOPS 全对齐（' + troops.length + ' 兵种）'
    : '⚠ 贴图链存在滞后项 —— 由贴图批维护（对照明细见上）；更新完成后复跑本命令即可验收。');
  process.exit(allOk ? 0 : 1);
}

if (require.main === module) {
  try { eval(fs.readFileSync(path.join(ROOT, '.workbuddy', 'tmp', 'smoke_env_head.js'), 'utf8')); } catch (e) { /* 无引导头也能跑 */ }
  ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons',
    'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
    try { require(path.join(ROOT, 'js', f + '.js')); } catch (e) { /* 逐文件容错 */ }
  });
  var G = global.GAME, DATA = G && G.DATA;
  var args = process.argv.slice(2);
  if (args[0] === '--refs' && args[1]) { printRefs(args[1]); process.exit(0); }
  if (args[0] === '--art') { printArt(); }
  if (!DATA || !DATA.TROOPS) { console.error('✗ 拿不到 GAME.DATA.TROOPS'); process.exit(2); }
  var rep = auditTroopChain(G, DATA);
  printReport(rep);
  process.exit(rep.errors.length ? 1 : 0);
}

module.exports = { auditTroopChain: auditTroopChain, RETIRED: RETIRED };
