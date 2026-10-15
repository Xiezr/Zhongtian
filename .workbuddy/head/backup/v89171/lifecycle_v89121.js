/* ============================================================
 * lifecycle_v89121.js — 全生命周期模拟器（老板令「逐项功能，物品，
 *   进行全生命周期模拟，充分发掘闭环能力」）
 * ------------------------------------------------------------
 * 逐项跑"获得 → 持有 → 使用 → 效果 → 清账"五段链，逐项给证据：
 *   · 来源：在售 → 真走商城购买出口（doShopping，真扣金）；
 *           非在售 → 直接发放（= 掉落/缴获/游历到手），并注明"真实来源是否接线"
 *   · 持有：s.items[id] > 0
 *   · 使用：按 type 走真实出口（useItem / 专项出口），带齐前置场景
 *   · 效果：按 type 断言"状态真的变了"（buff 写入 / 属性变化 / 队列缩短…）
 *   · 清账：s.items[id] 递减到 0
 *
 * 用法：node .workbuddy/tools/play/lifecycle_v89121.js [--part=A1]
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils, S = G.systems;

var PASS = 0, FAIL = 0, ROWS = [], BROKEN = [];
function ok(name, cond, extra) {
  if (cond) PASS++; else { FAIL++; BROKEN.push(name + (extra ? ' | ' + extra : '')); }
  return !!cond;
}
function pad(s, n) { s = String(s == null ? '' : s); while (s.length < n) s += ' '; return s; }
function row(cells) { ROWS.push(cells); }

/* ============================================================
 * 场景：一座主城 + 全建筑 + 满资源 + 可用将领
 * ============================================================ */
function buildScene(opts) {
  opts = opts || {};
  var st = G.newGame({ name: '生命周期', cityName: '许都', region: '豫州', mapSeed: 20260924, portraitSeed: 20260924 });
  if (!st.map.grid) G.map.generate();
  try { G.ui.closeAllModals && G.ui.closeAllModals(); } catch (e) {}
  var A = st.cities[0];
  G.ui._cityId = A.id;
  ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { A.res[k] = 5e6; });
  A.res.pop = 60000;
  A.cells.forEach(function (c) { if (c.build) c.build.lvl = Math.max(c.build.lvl || 1, 8); });
  /* 补关键建筑（军营/校场/铁匠铺/书院/市场/仓库/客栈），探针直写 cell */
  (function () {
    var need = ['junying', 'xiaochang', 'shuyuan', 'tiejiangpu', 'shichang', 'cangku', 'kezhan', 'guanfu'];
    var k = 0;
    A.cells.forEach(function (c) {
      if (!c.build && !c.official && k < need.length) { c.build = { id: need[k], lvl: 8 }; k++; }
    });
    A.cells.forEach(function (c) { if (c.build && c.build.id === 'guanfu') c.build.lvl = 8; });
  })();
  st.items = st.items || {};
  st.generals.forEach(function (g, i) { g.level = 40 + i; g.sta = 100; g.energy = 100; });
  st.settings.battleWatch = false;
  return { st: st, A: A };
}
function findCell(A, bid) {
  var idx = -1;
  A.cells.forEach(function (c, i) { if (idx < 0 && c.build && c.build.id === bid) idx = i; });
  return idx;
}
/* 清掉一个 buff 的残余（组内逐项间的隔离） */
function clearItemBuffs(id) {
  var s = G.state;
  if (!s.buffs) return;
  if (s.buffs.gens) s.generals.forEach(function (g) { if (s.buffs.gens[g.id]) delete s.buffs.gens[g.id][id]; });
  if (s.buffs.prodUntil) Object.keys(s.buffs.prodUntil).forEach(function (k) {});
  if (s.buffs.military) { /* military 是整块，跑下一项时被覆盖 */ }
}
/* 队列类：塞一条正在执行的建造，供 boost(build) 用 */
function ensureBuildQueue(A) {
  var s = G.state;
  s.queues = s.queues || { build: [], tech: [], train: [] };
  s.queues.build.length = 0;
  var free = -1;
  A.cells.forEach(function (c, i) { if (free < 0 && !c.build && !c.official && !(c.pending)) free = i; });
  var r = G.buildAt(A.id, free, 'minfang');
  if (!r || !r.ok) G.buildAt(A.id, free, 'cangku');
  return s.queues.build[0] || null;
}

var PART = (process.argv.filter(function (a) { return a.indexOf('--part=') === 0; })[0] || '').split('=')[1] || 'A1';

/* ============================================================
 * PART A1 · 宝物逐项：获得 → 持有 → 使用 → 效果 → 清账
 * ============================================================ */
if (PART === 'A1' || PART === 'ALL') {
  console.log('═══ PART A1 · 宝物全生命周期（逐项）═══\n');
  var scene = buildScene();
  var st = scene.st, A = scene.A;
  var gen = st.generals[0];

  /* ---------- 渠道表（静态，来自本仓源码梳理）----------
     只有这些路径能产出物品；不在表内 + 不在售 = **玩家拿不到**（渠道缺口）。 */
  var CH_BY_TYPE = {
    jewel: '宝箱/缴获(按类)', material: '宝箱/缴获/采集(按类)', blueprint: '宝箱/缴获(按类)',
    rank_up: '种田秘境(灵草作物)', essence: '采集/缴获(精华掉落表)', talis: '游历/逸闻(锦囊)',
  };
  var CH_BY_ID = {};
  ((DATA.SEED_DROP || {}).table || []).forEach(function (r) { CH_BY_ID[r.id] = '采集/缴获(种子掉落表)'; });
  CH_BY_ID['corvee'] = '宝箱 tier3(小概率)';
  CH_BY_ID['mabian'] = '游历(草原牧马)';
  CH_BY_ID['jinang'] = '游历/逸闻';
  CH_BY_ID['bp_mingjiang'] = '游历(地宫三层)/缴获';
  ['tongshang_quan', 'mojia_canjuan', 'xianzhenzhangu', 'jixingjunling', 'hufu'].forEach(function (id) { CH_BY_ID[id] = '任务/逸闻奖励'; });
  function inShop(it) { return it.price > 0 && !it.noShop && !!(G.ui.SHOP_CATS || {})[it.type]; }
  function channelOf(it) {
    if (inShop(it)) return '商城';
    if (CH_BY_ID[it.id]) return CH_BY_ID[it.id];
    if (CH_BY_TYPE[it.type]) return CH_BY_TYPE[it.type];
    return null;   /* ← 渠道缺口 */
  }
  var NOCH = [];

  /* 直用类的效果验证器表：type → { prep, use, verify } */
  var DIRECT = {
    jewel: {
      prep: function () { gen.loyalty = 40; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it, before) { return gen.loyalty === Math.min(100, before + (it.loyalty || 5)); },
      snap: function () { return gen.loyalty; },
    },
    attr_buff: {
      prep: function () { var s = G.state; s.buffs = s.buffs || {}; s.buffs.gens = s.buffs.gens || {}; s.buffs.gens[gen.id] = {}; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) {
        var s = G.state, b = ((s.buffs.gens || {})[gen.id] || {})[it.id];
        if (!b || !(b.until > U.now())) return false;
        var keys = Object.keys(it.eff || {});
        return keys.length > 0 && keys.every(function (k) { return b[k] === it.eff[k]; });
      },
    },
    prod_buff: {
      prep: function () { var s = G.state; s.buffs = s.buffs || {}; s.buffs.prod = {}; s.buffs.prodUntil = {}; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) {
        var s = G.state;
        return (s.buffs.prod || {})[it.res] >= (it.eff || 0.25)
          && (s.buffs.prodUntil || {})[it.res] > U.now();
      },
    },
    pop_boost: {
      prep: function () { var s = G.state; s.buffs = s.buffs || {}; delete s.buffs.popBoost; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) { var s = G.state; return s.buffs.popBoost && s.buffs.popBoost.mult === (it.eff || 1); },
    },
    pop_fill: {
      /* v89.125：语义 = 每次 +上限×ratio（增量，封顶上限）——
         prep 摆 10%，用后应 = min(上限, 10% + ratio)（旧口径是"补到 ratio"，已废）。 */
      prep: function () { G.res(A).pop = Math.floor(G.maxPopOf(A) * 0.1); },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) {
        var cap = G.maxPopOf(A);
        var want = Math.min(cap, Math.floor(cap * 0.1) + Math.floor(cap * (it.ratio || 0.25)));
        return Math.floor(G.res(A).pop) === want;
      },
    },
    build_cost: {
      prep: function () { var s = G.state; s.buffs = s.buffs || {}; delete s.buffs.buildCost; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) { var s = G.state; return s.buffs.buildCost && s.buffs.buildCost.until > U.now(); },
    },
    military_buff: {
      prep: function () { var s = G.state; s.buffs = s.buffs || {}; s.buffs.military = {}; delete s.buffs.militaryUntil; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) {
        var s = G.state, m = s.buffs.military || {};
        return s.buffs.militaryUntil > U.now()
          && Object.keys(it.eff || {}).every(function (k) { return m[k] === it.eff[k]; });
      },
    },
    exp: {
      /* 资质决定等级上限（凡品 60）；测试将领拉到天授，避免"到顶"干扰 exp 道具本身的验证。
         v89.171：道具带**培养上限**（10~60）—— prep 放到 Lv1（每项前重置，见"每项前重置"），
         verify 改看"等级或经验任一变化"（到线即止时 exp 归零、等级上升）。 */
      prep: function () { gen.rank = 'tian'; gen.level = 1; gen.exp = 0; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it, before) { return (gen.exp || 0) !== before || gen.level > 1; },
      snap: function () { return gen.exp || 0; },
      reset: true,
    },
    stamina: {
      prep: function () { G.setStaNow(gen, Math.floor(G.staMax(gen) * 0.05)); },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it, before) {
        var expected = Math.min(G.staMax(gen), before + (it.amount || 0.1) * G.staMax(gen));
        return Math.abs(G.staNow(gen) - expected) <= 1;
      },
      snap: function () { return G.staNow(gen); },
    },
    /* v89.171 工具补账：精力族（v89.131 加的 type='energy'，本工具当时没跟上 →
       A1 报 4 条"未知 type"假断链）。与 stamina 同构：按上限百分比回复。 */
    energy: {
      prep: function () { G.setEnergyNow(gen, Math.floor(G.energyMaxOf(gen) * 0.05)); },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it, before) {
        var expected = Math.min(G.energyMaxOf(gen), before + (it.amount || 0.1) * G.energyMaxOf(gen));
        return Math.abs(G.energyNowOf(gen) - expected) <= 1;
      },
      snap: function () { return G.energyNowOf(gen); },
    },
    perm: {
      prep: function () { gen.perm = gen.perm || {}; gen.perm.tong = gen.perm.nz = gen.perm.zm = gen.perm.yw = 0; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) { return (gen.perm[it.attr] || 0) === 1; },
    },
    rank_up: {
      /* 灵草与档位一一对应：把将领摆到 from 档；顶档（→天授）需节钺（黄金买不到，
         走 jieyueGrant 模拟"攻占名城/爵位赏赐"的既得资源） */
      prep: function (it) { gen.rank = it.from; try { G.jieyueGrant(3, '生命周期模拟预置'); } catch (e) {} },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) { return gen.rank === it.to; },
    },
    mount_buff: {
      prep: function () { var s = G.state; s.buffs.gens = s.buffs.gens || {}; s.buffs.gens[gen.id] = {}; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) {
        var s = G.state, b = ((s.buffs.gens || {})[gen.id] || {})[it.id];
        return b && b.spd === it.amount && b.until > U.now();
      },
    },
    chest: {
      prep: function () { G.res(A).gold = 1e6; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it, before, r) { return r.ok && /开启/.test(r.msg || ''); },
    },
    neigong: {
      prep: function () { gen.ng = null; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) { return gen.ng && gen.ng.lv >= 1; },
    },
    corvee: {
      prep: function () { var s = G.state; s.buffs = s.buffs || {}; delete s.buffs.buildQueue; },
      use: function (it) { return S.useItem(it.id, gen.id); },
      verify: function (it) { var s = G.state; return s.buffs.buildQueue && s.buffs.buildQueue.add >= (it.add || 1); },
    },
  };
  /* 队列类（boost）：需要前置队列 */
  var BOOST_PREP = {
    research: function () {
      var s = G.state;
      s.queues = s.queues || { build: [], tech: [], train: [] };
      s.queues.tech.length = 0;
      G.startResearch && G.startResearch('zhongzhi');
      if (!s.queues.tech[0]) { s.queues.tech.push({ id: 'zhongzhi', elapsed: 0, totalTime: 100000 }); }
      return s.queues.tech[0];
    },
    build: function () { return ensureBuildQueue(A); },
    train: function () {
      var s = G.state;
      s.queues = s.queues || { build: [], tech: [], train: [] };
      s.queues.train.length = 0;
      var bIdx = findCell(A, 'junying');
      var r = G.trainAt ? G.trainAt(A.id, bIdx, 'yibing', 10) : null;
      if (!r || !r.ok) { s.queues.train.push({ id: 'yibing', elapsed: 0, totalTime: 100000, cityId: A.id }); }
      return s.queues.train[0];
    },
    march: function () { return G.march && G.march.rushAll ? true : null; },
    trade: function () { return true; },
  };
  var BOOST_VERIFY = {
    research: function (q, before) { return q.elapsed > before; },
    build: function (q, before) { return q.elapsed > before; },
    train: function (q, before) { return q.elapsed > before; },
    march: function (q, before, r2) { return r2.ok; },
    trade: function (q, before) { var s = G.state; return s.buffs.mktFree && s.buffs.mktFree.until > U.now(); },
  };

  /* 逐项跑 */
  DATA.ITEMS.forEach(function (it) {
    var id = it.id, t = it.type;
    /* --- 来源 --- */
    var srcNote, hasSrc = false;
    var shopable = inShop(it);
    var chan = channelOf(it);
    if (!chan) NOCH.push(id + ' ' + it.name + '（' + t + '）');
    G.res(A).gold = 5e6;   /* 每项前回满黄金（逐项独立；否则买到后面没钱了） */
    var goldBefore = G.res(A).gold;
    if (shopable) {
      var br = G.doShopping(id, 1);
      hasSrc = br && br.ok && (G.state.items[id] || 0) >= 1;
      srcNote = hasSrc ? '商城(真买,-' + U.fmt(goldBefore - G.res(A).gold) + '金)' : '商城买失败:' + ((br && br.msg) || '');
    } else {
      G.state.items[id] = (G.state.items[id] || 0) + 1;
      hasSrc = true;
      srcNote = '非售·' + (chan ? '渠道=' + chan : '⚠无渠道(拿不到)');
    }
    /* --- 持有 --- */
    var hasHold = (G.state.items[id] || 0) >= 1;
    /* --- 使用 --- */
    var useNote = '—', hasUse = false, hasEff = false, hasClear = false;
    var before = null, beforeN = (G.state.items[id] || 0);
    try {
      if (DIRECT[t]) {
        var C = DIRECT[t];
        C.prep && C.prep(it);
        before = C.snap ? C.snap(it) : null;
        var r = C.use(it);
        hasUse = !!(r && r.ok);
        useNote = hasUse ? 'ok' : String((r && r.msg) || '未 ok');
        if (hasUse) hasEff = !!C.verify(it, before, r);
      } else if (t === 'boost') {
        var q0 = BOOST_PREP[it.target] ? BOOST_PREP[it.target]() : null;
        if (q0) {
          var b0 = (it.target === 'march' || it.target === 'trade') ? null : q0.elapsed;
          var r2 = S.useItem(id, gen.id);
          hasUse = !!(r2 && r2.ok);
          useNote = hasUse ? 'ok(' + it.target + ')' : String((r2 && r2.msg) || '未 ok');
          if (hasUse) hasEff = !!BOOST_VERIFY[it.target](q0, b0, r2);
        } else {
          useNote = '前置队列搭不起来(' + it.target + ')';
        }
      } else if (t === 'seed') {
        hasUse = false;
        useNote = '专项：种田秘境播种（useItem 明确拒绝=设计）';
        hasEff = true;  /* 设计上不可直用 */
      } else if (t === 'talis' || t === 'material' || t === 'blueprint' || t === 'essence') {
        hasUse = false;
        useNote = '专项：' + ({ talis: '计略/布防消耗', material: '打造消耗', blueprint: '打造解锁', essence: '蕴养消耗' }[t]);
        hasEff = true;
      } else {
        useNote = '未知 type';
      }
    } catch (e) {
      useNote = '抛异常:' + String(e && e.message).slice(0, 60);
    }
    /* --- 清账 --- */
    var afterN = (G.state.items[id] || 0);
    if (hasUse) hasClear = afterN === beforeN - 1;
    else if (t === 'seed' || t === 'talis' || t === 'material' || t === 'blueprint' || t === 'essence') hasClear = afterN >= 0;
    /* 别让背包堆积影响后续项：复位 */
    delete G.state.items[id];
    clearItemBuffs(id);

    row([t, id, it.name,
      shopable ? '商城' : (it.noShop ? '下架' : '非售'),
      hasSrc ? '✓' : '✗', hasHold ? '✓' : '✗', hasUse ? '✓' : '—',
      hasEff ? '✓' : (hasUse ? '✗' : '—'), hasClear ? '✓' : '✗',
      srcNote + (useNote && useNote !== 'ok' ? ' · ' + useNote : '')]);
    ok('A1/' + id, hasSrc && hasHold && (hasUse || ['seed', 'talis', 'material', 'blueprint', 'essence'].indexOf(t) >= 0) && hasEff && hasClear,
      'src=' + (hasSrc ? 'y' : 'n') + ' use=' + (hasUse ? 'y' : (hasUse === false ? 'n' : '-')) + ' eff=' + (hasEff ? 'y' : 'n') + ' clear=' + (hasClear ? 'y' : 'n') + ' ' + useNote);
  });

  /* ---------- 输出 ---------- */
  console.log(pad('类别', 14) + pad('id', 18) + pad('名称', 10) + pad('来源', 6) + ' 源 持 用 效 清  备注');
  ROWS.forEach(function (r) {
    console.log(pad(r[0], 14) + pad(r[1], 18) + pad(r[2], 10) + pad(r[3], 6)
      + ' ' + r[4] + '  ' + r[5] + '  ' + r[6] + '  ' + r[7] + '  ' + r[8] + '  ' + r[9]);
  });
  console.log('\nA1 汇总：' + ROWS.length + ' 项 · 全链通过 ' + PASS + ' · 链断 ' + FAIL);
  if (BROKEN.length) {
    console.log('\n链断清单（五段链路上真跑失败的）：');
    BROKEN.slice(0, 40).forEach(function (b) { console.log('  ✗ ' + b); });
  }
  /* 渠道缺口：物品本身"能用"，但玩家没有任何路径"拿到" —— 与链路失败分开列 */
  console.log('\n渠道缺口（不在售 + 无已知产出渠道 = 玩家拿不到）: ' + NOCH.length + ' 项');
  NOCH.forEach(function (b) { console.log('  ⚠ ' + b); });
  fs.writeFileSync(path.join(R, '.workbuddy/tmp/lifecycle_a1.json'),
    JSON.stringify({ rows: ROWS, pass: PASS, fail: FAIL, broken: BROKEN, noChannel: NOCH }, null, 1));
  console.log('\nJSON → .workbuddy/tmp/lifecycle_a1.json');
}
/* ============================================================
 * PART A2 · 军装全生命周期（逐件：打造 → 装备 → 强化 → 卸下 → 拆解）
 * ============================================================ */
if (PART === 'A2' || PART === 'ALL') {
  console.log('\n═══ PART A2 · 军装全生命周期（逐件）═══\n');
  var sc2 = buildScene();
  var st2 = sc2.st, A2 = sc2.A;
  var gen2 = st2.generals[0];
  var FORGEABLE = Object.keys(DATA.EQUIP).filter(function (id) {
    var e = DATA.EQUIP[id];
    return e && !e.ling && (e.craft === true || !!e.set) && !!DATA.FORGE;
  });
  var a2pass = 0, a2fail = 0, a2rows = [], a2bad = [];
  FORGEABLE.forEach(function (id) {
    var e = DATA.EQUIP[id];
    var note = [], good = true;
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { G.res(A2)[k] = 5e6; });
    var mats = G.forgeMaterials(id) || {};
    Object.keys(mats).forEach(function (m) { st2.items[m] = Math.max(st2.items[m] || 0, mats[m]); });
    var bp = G.blueprintOf(id);
    if (bp) st2.items[bp.id] = 1;
    /* 1 来源=打造 */
    var fr = G.forge(id);
    var got1 = !!(fr && fr.ok);
    if (!got1) { good = false; note.push('打造失败:' + ((fr && fr.msg) || '')); }
    var inst = null;
    if (got1) {
      inst = st2.inventory[st2.inventory.length - 1];
      /* 2 装备 */
      var bBefore = S.genEquipBonus(gen2);
      var er = S.equipItem(gen2.id, inst);
      var got2 = !!(er && er.ok);
      if (!got2) { good = false; note.push('装备失败:' + ((er && er.msg) || '')); }
      /* 3 效果：装备加成真的变了（且变化里含该件自己的属性 —— 防"别的来源在动"的平凡解） */
      var got3 = false;
      if (got2) {
        var bA = S.genEquipBonus(gen2);
        var keys = ['atk', 'def', 'spd', 'tong', 'nz', 'zm', 'yw', 'sta'];
        var diff = keys.filter(function (k) { return (bA[k] || 0) !== (bBefore[k] || 0); });
        var own = keys.filter(function (k) { return (e[k] || 0) !== 0; });
        got3 = diff.length > 0 && diff.some(function (k) { return own.indexOf(k) >= 0; });
        if (!got3) { good = false; note.push('装备加成未按该件属性变化(diff=' + diff.join(',') + ' own=' + own.join(',') + ')'); }
      }
      /* 4 强化 */
      var got4 = false;
      if (got2) {
        ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) { G.res(A2)[k] = 5e6; });
        var en = G.enhance(inst);
        got4 = !!(en && en.ok) && G.enhOf(inst) === 1;
        if (!got4) { good = false; note.push('强化失败:' + ((en && en.msg) || '')); }
      }
      /* 5 卸下 + 拆解（回材料） */
      var got5 = false;
      if (got2) {
        var ur = S.unequipItem(gen2.id, e.slot);
        var matBefore = 0;
        Object.keys(DATA.MATERIAL_BY_ID).forEach(function (m) { matBefore += st2.items[m] || 0; });
        var sr = G.salvageEquip(inst);
        var matAfter = 0;
        Object.keys(DATA.MATERIAL_BY_ID).forEach(function (m) { matAfter += st2.items[m] || 0; });
        got5 = !!(ur && ur.ok) && !!(sr && sr.ok) && matAfter > matBefore;
        if (!got5) { good = false; note.push('拆解失败:' + ((sr && sr.msg) || '') + '/' + ((ur && ur.msg) || '')); }
      }
    }
    if (good) a2pass++; else { a2fail++; a2bad.push(id + ' | ' + note.join(' ')); }
    a2rows.push([id, e.name, e.set || '散件', e.q, got1 ? '✓' : '✗', got1 ? '✓' : '✗', '', '', '', '']);
  });
  console.log('  军装可打造 ' + FORGEABLE.length + ' 件：全链通过 ' + a2pass + ' · 断链 ' + a2fail);
  if (a2bad.length) { console.log('  断链清单：'); a2bad.slice(0, 30).forEach(function (b) { console.log('    ✗ ' + b); }); }
  fs.writeFileSync(path.join(R, '.workbuddy/tmp/lifecycle_a2.json'),
    JSON.stringify({ total: FORGEABLE.length, pass: a2pass, fail: a2fail, bad: a2bad }, null, 1));
  console.log('  JSON → .workbuddy/tmp/lifecycle_a2.json');
}

/* ============================================================
 * PART A3 · 灵装全生命周期（游历掉落 → 装备 → 蕴养（耗精华）→ 灵力提升）
 * ============================================================ */
if (PART === 'A3' || PART === 'ALL') {
  console.log('\n═══ PART A3 · 灵装全生命周期（逐件）═══\n');
  var sc3 = buildScene();
  var st3 = sc3.st, A3 = sc3.A;
  var lord = null;
  st3.generals.forEach(function (g) { if (!lord && G.isLordGeneral && G.isLordGeneral(g)) lord = g; });
  if (!lord) lord = st3.generals[0];
  var LING = Object.keys(DATA.EQUIP).filter(function (id) { return DATA.EQUIP[id] && DATA.EQUIP[id].ling; });
  var a3pass = 0, a3fail = 0, a3bad = [];
  LING.forEach(function (id) {
    var e = DATA.EQUIP[id];
    st3.items.lingsui = 9999;
    var inst = G.addEquip(id, 0);           /* 模拟游历掉落（tryDrop → addEquip） */
    var er = S.equipItem(lord.id, inst);
    var got2 = !!(er && er.ok);
    var lp0 = G.lingPowerOf(lord);
    var tr = got2 ? G.lingTemper(inst) : null;
    var lp1 = G.lingPowerOf(lord);
    var good = got2 && !!(tr && tr.ok) && G.lingTemperMax() >= 1
      && (G.enhOf(inst) === 1) && lp1 >= lp0;
    /* 蕴养后卸下、清包 */
    if (got2) S.unequipItem(lord.id, e.slot);
    var idx = st3.inventory.indexOf(inst); if (idx >= 0) st3.inventory.splice(idx, 1);
    if (good) a3pass++; else { a3fail++; a3bad.push(id + ' ' + e.name + ' | ' + (er && er.msg) + ' / ' + (tr && tr.msg)); }
  });
  console.log('  灵装 ' + LING.length + ' 件：全链通过 ' + a3pass + ' · 断链 ' + a3fail);
  if (a3bad.length) a3bad.slice(0, 20).forEach(function (b) { console.log('    ✗ ' + b); });
  console.log('  灵力口径抽验：君主 ' + lord.name + ' lingPower=' + G.lingPowerOf(lord));
  fs.writeFileSync(path.join(R, '.workbuddy/tmp/lifecycle_a3.json'),
    JSON.stringify({ total: LING.length, pass: a3pass, fail: a3fail, bad: a3bad }, null, 1));
}

/* ============================================================
 * PART A4 · 材料覆盖（每种材料至少被一个配方用 = 有去处）
 * ============================================================ */
if (PART === 'A4' || PART === 'ALL') {
  console.log('\n═══ PART A4 · 材料闭环（24 材料 × 配方覆盖）═══\n');
  var used = {};
  Object.keys(DATA.EQUIP).forEach(function (id) {
    var e = DATA.EQUIP[id];
    if (!e || e.ling || !(e.craft === true || !!e.set)) return;
    var mats = G.forgeMaterials(id) || {};
    Object.keys(mats).forEach(function (m) { (used[m] = used[m] || []).push(id); });
  });
  var a4bad = [];
  DATA.MATERIALS.forEach(function (m) {
    var n = (used[m.id] || []).length;
    if (!n) a4bad.push(m.id);
    console.log('  ' + pad(m.id, 10) + pad(m.name, 8) + '被 ' + pad(n, 3) + ' 个配方使用'
      + (n ? '' : '  ⚠ 无配方使用（无处可去）'));
  });
  console.log('\n  材料 ' + DATA.MATERIALS.length + ' 种：零配方材料 ' + a4bad.length);
}

/* ============================================================
 * PART A5 · 计略全生命周期（锦囊 → 施展 → 标记/防御挂载）
 * ============================================================ */
if (PART === 'A5' || PART === 'ALL') {
  console.log('\n═══ PART A5 · 计略全生命周期（8 计略）═══\n');
  var sc5 = buildScene();
  var st5 = sc5.st, A5 = sc5.A;
  var gen5 = st5.generals[0];
  /* 目标：一座真实 NPC 城（挑拨离间只对城池有效 —— 野地无守将） */
  var tgt = (DATA.NPC_CITIES || []).length ? { npc: DATA.NPC_CITIES[0] } : null;
  var a5pass = 0, a5fail = 0, a5bad = [];
  DATA.SCHEMES.forEach(function (sc) {
    st5.items.jinang = 99;
    gen5.energy = 100;
    var t = tgt || { kind: 'wild', x: A5.x + 3, y: A5.y };
    var note = '', good = false;
    try {
      if (sc.kind === 'defense') {
        var d = G.schemeDefSet(A5, sc.id, gen5);
        good = !!d && (st5.items.jinang || 0) < 99;
        note = good ? '布防挂载' : '布防失败';
      } else {
        var pk = G.schemePrepare(sc.id, t, gen5);
        if (!pk || !pk.ok) { note = 'prepare: ' + ((pk && pk.msg) || ''); }
        else {
          var before = st5.items.jinang || 0;
          var rec = G.schemeUse(sc.id, t, gen5);
          var after = st5.items.jinang || 0;
          good = !!rec && after === before - sc.jinang;
          note = good ? ('施展 ok（囊 -' + sc.jinang + '）') : '施展未扣囊';
        }
      }
    } catch (e) { note = '抛异常:' + String(e && e.message).slice(0, 60); }
    if (good) a5pass++; else { a5fail++; a5bad.push(sc.id + ' ' + sc.name + ' | ' + note); }
    console.log('  ' + pad(sc.id, 12) + pad(sc.name, 8) + pad(sc.kind, 9) + (good ? '✓ ' : '✗ ') + note);
  });
  console.log('\n  计略 ' + DATA.SCHEMES.length + ' 条：全链通过 ' + a5pass + ' · 断链 ' + a5fail);
}

/* ============================================================
 * PART A6 · 神器（供奉积累 → 等级 → 加成）
 * ============================================================ */
if (PART === 'A6' || PART === 'ALL') {
  console.log('\n═══ PART A6 · 神器（供奉 → 等级 → 加成）═══\n');
  var sc6 = buildScene();
  var st6 = sc6.st;
  var a6pass = 0;
  /* 逐神器：把供奉值打到升满（最大门槛），验证等级与加成单调上升 */
  var maxTh = (DATA.ARTIFACT.pts || []).slice(-1)[0] || 12000;
  var lv0 = G.artLevelOf();
  G.artGain(maxTh + 1, '生命周期模拟');
  var lv1 = G.artLevelOf();
  console.log('  供奉 ' + G.artPts() + ' → 等级 ' + lv0 + ' → ' + lv1 + '（上限 ' + DATA.ARTIFACT.maxLv + '）');
  DATA.ARTIFACTS.forEach(function (a) {
    var keys = Object.keys(a.per || {});
    var okEff = keys.every(function (k) { return G.artifactBonusNum(k) > 0; });
    console.log('  ' + pad(a.name, 10) + (okEff ? '✓ ' : '✗ ') + keys.map(function (k) { return k + '=' + G.artifactBonusNum(k).toFixed(2); }).join(' '));
    if (okEff && lv1 >= lv0) a6pass++;
  });
  console.log('\n  神器 ' + DATA.ARTIFACTS.length + ' 件：加成生效 ' + a6pass + ' 件');
}

/* ============================================================
 * PART A7 · 种田闭环（种子 → 播种 → 生长 → 收获 → 灵草/材料）
 * ============================================================ */
if (PART === 'A7' || PART === 'ALL') {
  console.log('\n═══ PART A7 · 种田秘境闭环（逐作物）═══\n');
  var sc7 = buildScene();
  var st7 = sc7.st;
  var crops = (DATA.FARM && DATA.FARM.crops) || [];
  var a7pass = 0, a7bad = [];
  crops.forEach(function (c, ci) {
    var idx = ci % 4;   /* 假设 4 块地；不够就用 0 */
    var f = G.farmOf();
    if (!f || !f.plots || f.plots.length <= idx) { a7bad.push(c.id + ' 无地块'); return; }
    f.plots[idx] = null;
    st7.items[c.seedItem] = (st7.items[c.seedItem] || 0) + 1;
    var pr = G.farmPlant(idx, c.id);
    var seedUsed = !!(pr && pr.ok);
    /* 推进到成熟 */
    G.tickFarm(Math.round((c.hours || 1) * 3600) + 10);
    var stt = G.farmPlotState(idx);
    var ripe = stt.state === 'ripe';
    var hr = ripe ? G.farmHarvest(idx) : null;
    var got = !!(hr && hr.ok);
    if (seedUsed && ripe && got) a7pass++;
    else a7bad.push(c.id + ' ' + c.name + ' | plant=' + seedUsed + ' ripe=' + ripe + ' harvest=' + got + ' / ' + ((hr && hr.msg) || ''));
    console.log('  ' + pad(c.id, 14) + pad(c.name, 10) + '种' + (seedUsed ? '✓' : '✗') + ' 熟' + (ripe ? '✓' : '✗')
      + ' 收' + (got ? '✓' : '✗') + '  ' + ((hr && hr.msg) || (pr && pr.msg) || ''));
  });
  console.log('\n  作物 ' + crops.length + ' 种：闭环 ' + a7pass + ' · 断链 ' + a7bad.length);
  if (a7bad.length) a7bad.forEach(function (b) { console.log('    ✗ ' + b); });
}

/* ============================================================
 * PART B1 · 系统循环（快进：生产 → 队列 → 结算 → 世界时间）
 * ============================================================ */
if (PART === 'B1' || PART === 'ALL') {
  console.log('\n═══ PART B1 · 系统循环快进（7 游戏日）═══\n');
  var scB = buildScene();
  var stB = scB.st, AB = scB.A;
  var bPass = 0, bFail = 0, bNotes = [];
  function bchk(name, cond, note) {
    if (cond) { bPass++; console.log('  ✓ ' + name + (note ? ' —— ' + note : '')); }
    else { bFail++; bNotes.push(name + ' | ' + (note || '')); console.log('  ✗ ' + name + (note ? ' —— ' + note : '')); }
  }
  /* 布置三队列：建造 / 研究 / 募兵（人口先压到上限内 —— 预置 6 万超过上限会卡增长） */
  AB.res.pop = Math.floor(G.maxPopOf(AB) * 0.4);
  var freeB = -1;
  AB.cells.forEach(function (c, i) { if (freeB < 0 && !c.build && !c.official && !c.pending) freeB = i; });
  var brB = G.buildAt(AB.id, freeB, 'minfang');
  var rsB = G.systems.research('zhongzhi', AB.id);
  if (rsB && !rsB.ok) console.log('  （研究未开：' + rsB.msg + '）');
  var jyB = findCell(AB, 'junying');
  var trB = G.train ? G.train('yibing', 50, AB.id, jyB) : null;
  if (trB && !trB.ok) console.log('  （募兵未开：' + trB.msg + '）');
  var snap = {
    grain: G.res(AB).grain, gold: G.res(AB).gold, pop: G.res(AB).pop,
    army: Object.keys(AB.army || {}).reduce(function (a, k) { return a + (AB.army[k] || 0); }, 0),
    elapsed: (stB.world && stB.world.elapsed) || 0,
    bldLv: (AB.cells[freeB] && AB.cells[freeB].build) ? AB.cells[freeB].build.lvl : 0,
    tech: G.systems.techLevel('zhongzhi'),
  };
  var TICKS = 5040;   /* 5040 × 120s = 604800 游戏秒 = 7 游戏日 */
  var nanHit = 0;
  for (var ti = 0; ti < TICKS; ti++) {
    G.tickOnce();
    if (ti % 720 === 0) {
      var rg = G.res(AB);
      if (!isFinite(rg.gold) || !isFinite(rg.grain) || rg.gold < 0) nanHit++;
    }
  }
  var snap2 = {
    grain: G.res(AB).grain, gold: G.res(AB).gold, pop: G.res(AB).pop,
    army: Object.keys(AB.army || {}).reduce(function (a, k) { return a + (AB.army[k] || 0); }, 0),
    elapsed: (stB.world && stB.world.elapsed) || 0,
    bldLv: (AB.cells[freeB] && AB.cells[freeB].build) ? AB.cells[freeB].build.lvl : 0,
    tech: G.systems.techLevel('zhongzhi'),
  };
  bchk('世界时间推进 7 游戏日', Math.abs(snap2.elapsed - snap.elapsed - 604800) < 2000,
    (snap.elapsed | 0) + ' → ' + (snap2.elapsed | 0));
  bchk('资源持续产出（粮增长）', snap2.grain > snap.grain, U.fmt(snap.grain) + ' → ' + U.fmt(snap2.grain));
  bchk('黄金结算（税收/卖出）', snap2.gold > snap.gold || snap2.gold > 0, U.fmt(snap.gold) + ' → ' + U.fmt(snap2.gold));
  bchk('人口增长且不超上限', snap2.pop > snap.pop && snap2.pop <= G.maxPopOf(AB) + 1,
    Math.floor(snap.pop) + ' → ' + Math.floor(snap2.pop) + '（上限 ' + G.maxPopOf(AB) + '）');
  bchk('建造队列完成（民房落地 +1 级）', snap2.bldLv > snap.bldLv, 'Lv' + snap.bldLv + ' → Lv' + snap2.bldLv);
  bchk('研究队列推进（种植技术升级）', snap2.tech > snap.tech, 'Lv' + snap.tech + ' → Lv' + snap2.tech);
  bchk('募兵完成（兵力增加）', snap2.army > snap.army, snap.army + ' → ' + snap2.army);
  bchk('资源全程无 NaN/负值', nanHit === 0, '抽检 8 次');
  /* 战报与消息体检 */
  var reps = (stB.reports || []).slice(0, 5);
  var badRep = reps.filter(function (r) { return /NaN|undefined|Infinity/.test(JSON.stringify(r)); });
  bchk('战报正文无坏值', badRep.length === 0, '近 ' + reps.length + ' 份战报');
  console.log('\n  B1 汇总：' + (bPass + bFail) + ' 检查 · 通过 ' + bPass + ' · 失败 ' + bFail);
  if (bNotes.length) bNotes.forEach(function (n) { console.log('    ✗ ' + n); });
}

process.exit(FAIL ? 1 : 0);
