# -*- coding: utf-8 -*-
"""v77 · 测试补丁：翻转旧守卫（五处）+ 新增 smoke 第 62 节 + e2e 三处更新。"""
import io, sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E = r'E:\Deepseekdb\e2e-test.js'
UI = r'E:\Deepseekdb\js\ui.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    old_c = old.replace('\n', '\r\n'); new_c = new.replace('\n', '\r\n')
    if old in t:
        if t.count(old) != 1:
            print('  ✗ %s：锚点命中 %d 次' % (tag, t.count(old))); sys.exit(1)
        t = t.replace(old, new, 1)
    elif old_c in t:
        if t.count(old_c) != 1:
            print('  ✗ %s：锚点(CRLF)命中 %d 次' % (tag, t.count(old_c))); sys.exit(1)
        t = t.replace(old_c, new_c, 1)
    elif (new in t) or (new_c in t):
        print('  · %s：已改过（跳过）' % tag); return
    else:
        print('  ✗ %s：锚点不匹配' % tag); sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print('  ✓ %s' % tag)


# =====================================================================
# ⓪ ui.js 小修：_wildSig 初值应为 null —— 否则"尚无野地"时首帧不渲染
# =====================================================================
patch(UI,
"""  ui._wildSig = '';
  ui._wildSel = 0;""",
"""  ui._wildSig = null;   /* null 而非 ''：首帧必然渲染（哪怕"暂无野地"） */
  ui._wildSel = 0;""",
'T0 _wildSig 初值')

# =====================================================================
# ① smoke：原版式弹窗清单（资源生产 / 建筑信息退役）
# =====================================================================
patch(SMOKE,
"""  var modals = [
    ['君主信息', UI.openLordInfo], ['资源生产', UI.openProdInfo], ['建筑信息', UI.openBldgInfo],
    ['附属野地', UI.openWilds],
  ];""",
"""  /* v77（老板）：资源生产 / 建筑信息两个入口退役（随城池属性右三按钮）；
     附属野地保留（改由资源区下拉框「进入」触发）。 */
  var modals = [
    ['君主信息', UI.openLordInfo], ['附属野地', UI.openWilds],
  ];""",
'S1 弹窗清单')

patch(SMOKE,
"""  check('原版式弹窗全部可打开', modalOk, failName || '君主/资源生产/建筑/野地');""",
"""  check('原版式弹窗全部可打开', modalOk, failName || '君主/野地');""",
'S1b 弹窗说明')

# =====================================================================
# ② smoke #16：城池切换（v22 chips 退役 → v77 下拉框 + 进入按钮）
# =====================================================================
patch(SMOKE,
"""  check('#16 城池切换为点选按钮组（v22 去下拉框）',
    /city-chips/.test(uS16) && /after: 'city'/.test(uS16) && /after === 'city'/.test(mS16));""",
"""  /* v77（老板）：君主面板改左右分栏（城池列表 + 进入按钮），v22 的 chips 退役；
     城池切换仍是下拉框一处（v45）。 */
  check('v77：城池切换走下拉框 + 君主面板「进入」按钮（v22 chips 退役）',
    /city-select/.test(uS16) && /after: 'city'/.test(uS16) && /after === 'city'/.test(mS16)
    && /lord-city-enter/.test(uS16) && /lord-city-enter/.test(mS16));""",
'S2 #16 翻新')

# =====================================================================
# ③ smoke v35：下拉框计数（1 → 2：城池 + 附属野地）
# =====================================================================
patch(SMOKE,
"""  check('下拉框全站只有一处，且就是「城池切换」', (function () {
    /* v35 的原始要求是"全站已无 <select>"；v45 老板点名要城池下拉框。
       这里把判据换成**计数**：允许且仅允许 1 处，避免"破例变成惯例"。
       计数前先剥注释 —— 源码注释里会提到 <select> 这个词。 */
    var strip = function (s) { return s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/^\\s*\\/\\/.*$/gm, ''); };
    var all = strip(uS35 + hS35 + mS35);
    var n = (all.match(/<select/g) || []).length;
    return n === 1 && /class="city-select" data-action="switch-city"/.test(all);
  })());""",
"""  check('下拉框全站只有两处：城池切换 + 附属野地（v77 老板点名），无第三处', (function () {
    /* v35 要求"全站已无 <select>"；v45 老板点名要城池下拉框（破例一次）；
       v77 老板再点名"附属野地 下拉框"（第二次破例）。
       判据仍是**计数**：允许且仅允许 2 处，且两者都实名在册 —— 防"破例变成惯例"。 */
    var strip = function (s) { return s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/^\\s*\\/\\/.*$/gm, ''); };
    var all = strip(uS35 + hS35 + mS35);
    var n = (all.match(/<select/g) || []).length;
    return n === 2 && /class="city-select" data-action="switch-city"/.test(all)
      && /class="city-select wild-select"/.test(all) && /data-action="wild-pick"/.test(all);
  })());""",
'S3 下拉框计数')

# =====================================================================
# ④ smoke v35：chip-set 覆盖（workrate 退役）
# =====================================================================
patch(SMOKE,
"""  check('chip-set 动作已注册且覆盖四类副作用',
    /case 'chip-set'/.test(mS35) && /after === 'city'/.test(mS35)
    && /after === 'workrate'/.test(mS35) && /after === 'region'/.test(mS35)
    && /after === 'zoom'/.test(mS35));""",
"""  /* v77：开工率调整入口随「资源生产」退役（after='workrate' 分支撤除）。 */
  check('chip-set 动作已注册且覆盖三类副作用（city / region / zoom）',
    /case 'chip-set'/.test(mS35) && /after === 'city'/.test(mS35)
    && /after === 'region'/.test(mS35)
    && /after === 'zoom'/.test(mS35));""",
'S4 chip-set')

# =====================================================================
# ⑤ smoke §38：rankBlock → 新君主面板（同时修崩溃点）
# =====================================================================
patch(SMOKE,
"""  check('爵位并入君主面板（rankBlock）',
    /ui\\.rankBlock = function/.test(uS38) && /ui\\.rankBlock\\(\\)/.test(uS38));
  check('实测：rankBlock 含爵位与晋升', (function () {
    var h = G.ui.rankBlock();
    return h.indexOf('当前爵位') >= 0 && h.indexOf('promote') >= 0;
  })());""",
"""  /* v77（老板）：「君主界面分左右两半……右边两列的信息表（姓名/爵位/声望/人口/将领/状态）」
     —— 爵位区块（rankBlock）并入新面板，整块退役。 */
  check('爵位并入君主面板（v77 右栏信息表：爵位 + 晋升按钮）',
    /ui\\.openLordInfo = function/.test(uS38) && /lord-promote/.test(uS38)
    && /data-action="lord-promote"/.test(uS38));
  check('实测：君主面板含爵位与晋升 + 左右分栏', (function () {
    var root38 = global.document.querySelector('#modal-root');
    root38.innerHTML = '';
    G.ui.openLordInfo();
    var h = root38.innerHTML;
    return h.indexOf('爵位') >= 0 && h.indexOf('lord-promote') >= 0 && h.indexOf('lord-split') >= 0;
  })());""",
'S5 rankBlock 翻新')

# =====================================================================
# ⑥ smoke：新增第 62 节（v77 七条）
# =====================================================================
NEW_SEC = r"""  /* ============================================================
   * 62. v77：月俸体系 / 客栈表格 / 君主面板 / 野地下拉 / 新货 / 强化 / 内功
   * ============================================================ */
  console.log('\n===== 62. v77 老板八条（月俸/表格/君主/野地/新货/强化/内功） =====');
  var uS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var mS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8');
  var dS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'domain.js'), 'utf8');
  var sS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'systems.js'), 'utf8');
  var tS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8');
  var hS77 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var daS77 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'data.js'), 'utf8');

  /* ---- ① 客栈表格 ---- */
  check('① 客栈候选改表格（表头 + 每人一行 + 月俸列）',
    /inn-tbl/.test(uS77) && /月俸/.test(uS77) && /inn-tr/.test(uS77)
    && /genSalaryOf\\(c\\)/.test(uS77));

  /* ---- ② 月俸：定价与 7 游戏日结算 ---- */
  check('② 月俸表与结算同源（GEN_SALARY + 唯一出口）',
    /DATA\\.GEN_SALARY = \\{/.test(daS77) && /GAME\\.genSalaryOf = function/.test(dS77)
    && /GAME\\.settleGenSalary = function/.test(dS77)
    && /GAME\\.settleGenSalary\\(\\)/.test(tS77));
  check('② 月俸定价 =（底俸 + 等级 + 四维）× 资质（良材 Lv1 公式值）', (function () {
    var g77 = { level: 1, rank: 'liang', tong: 46, nz: 46, yw: 46, zm: 46 };
    var C = DATA.GEN_SALARY;
    var expect = Math.round((C.base + 1 * C.perLevel + 184 * C.perAttr) * C.rankMul.liang);
    return G.genSalaryOf(g77) === expect && expect > 0;
  })(), '实测 ' + G.genSalaryOf({ level: 1, rank: 'liang', tong: 46, nz: 46, yw: 46, zm: 46 }));
  check('② 君主不领俸（0）', G.genSalaryOf(G.lordGeneralOf()) === 0);
  check('② 越强越贵（名世 Lv30 ≫ 凡品 Lv1）', (function () {
    var lo = G.genSalaryOf({ level: 1, rank: 'fan', tong: 40, nz: 40, yw: 40, zm: 40 });
    var hi = G.genSalaryOf({ level: 30, rank: 'ming', tong: 100, nz: 100, yw: 100, zm: 100 });
    return hi > lo * 5;
  })());
  check('② 实测：6 游戏日不结、第 7 游戏日结一次（期数与扣款都对）', (function () {
    var S77 = G.state;
    var bkWorld = S77.world, bkAt = S77.salaryAt, bkGold = S77.res.gold;
    try {
      S77.world = { elapsed: 0 };
      S77.salaryAt = 0;
      S77.res.gold = 100000000;
      S77.world.elapsed = 6 * 86400;
      var noPay = G.settleGenSalary();
      var at6 = S77.salaryAt;
      S77.world.elapsed = 7 * 86400;
      var pay = G.settleGenSalary();
      /* 应扣 = 各城"在册将领"月俸之和（与结算同公式；孤儿将领不计） */
      var expect = 0;
      S77.cities.forEach(function (ct) {
        S77.generals.forEach(function (g) { if (g.cityId === ct.id) expect += G.genSalaryOf(g); });
      });
      var delta = 100000000 - S77.res.gold;
      return noPay === null && at6 === 0 && pay && pay.periods === 1 && delta === expect && expect > 0;
    } finally {
      S77.world = bkWorld; S77.salaryAt = bkAt; S77.res.gold = bkGold;
    }
  })());

  /* ---- ③ 野地下拉框 ---- */
  check('③ 资源区附属野地下拉框（宿主 + 渲染 + 进入 → openWilds）',
    /wild-pick-host/.test(hS77) && /renderWildPick = function/.test(uS77)
    && /data-action="wild-pick"/.test(uS77) && /data-action="open-wilds"/.test(uS77)
    && /'wild-pick'/.test(mS77));
  check('③ 资源区「本城 · 城名」表头退役（res-scope 清空）', uS77.indexOf('res-scope') < 0);

  /* ---- ④ 三按钮退役 ---- */
  check('④ 城池属性右三按钮全退役（建筑信息 / 资源生产 / 附属野地按钮）',
    !/open-bldg-info/.test(hS77) && !/open-prod-info/.test(hS77)
    && !/ui\\.openProdInfo = function/.test(uS77) && !/ui\\.openBldgInfo = function/.test(uS77)
    && !/'open-prod-info'/.test(mS77) && !/'open-bldg-info'/.test(mS77));

  /* ---- ⑤ 君主面板 ---- */
  check('⑤ 君主面板：左城池列表（进入按钮）+ 右信息表（姓名/爵位/声望/人口/将领/状态）',
    /lord-split/.test(uS77) && /lord-city-enter/.test(uS77) && /lord-promote/.test(uS77)
    && /open-rename-lord/.test(uS77) && /月俸支出/.test(uS77));
  check('⑤ 君主改名唯一出口（ruler 与君主将领两处同源）',
    /GAME\\.renameLord = function/.test(dS77) && /lg\\.name = name/.test(dS77));
  check('⑤ 晋升按钮悬停带条件（声望/城池/黄金）',
    /晋升「' \\+ next\\.name \\+ '」条件/.test(uS77));

  /* ---- ⑥ 商场新货 ---- */
  check('⑥ 新商品齐备（三级宝箱 / 四部秘籍 / 徭役令）',
    ['chest_tong', 'chest_yin', 'chest_jin', 'book_sunzi', 'book_liutao', 'book_wuqin',
     'book_yuenv', 'corvee'].every(function (id) {
      return (DATA.ITEMS || []).some(function (x) { return x.id === id; });
    }));
  check('⑥ 商城分类齐备（宝箱 / 秘籍 / 政令）',
    G.ui.SHOP_CATS.chest === '宝箱' && G.ui.SHOP_CATS.neigong === '秘籍'
    && G.ui.SHOP_CATS.corvee === '政令');
  check('⑥ 实测：开宝箱（黄金入账、宝箱 -1、有战利品文案）', (function () {
    var S77b = G.state;
    var bkGold = S77b.res.gold, bkItem = S77b.items.chest_tong;
    S77b.res.gold = 1000000;
    S77b.items.chest_tong = (S77b.items.chest_tong || 0) + 1;
    var r = G.systems.useItem('chest_tong');
    var okAll = r.ok && /开启/.test(r.msg) && S77b.res.gold > 1000000
      && (S77b.items.chest_tong || 0) === (bkItem || 0);
    S77b.res.gold = bkGold; S77b.items.chest_tong = bkItem;
    if (S77b.items.chest_tong == null) delete S77b.items.chest_tong;
    return okAll;
  })(), '');
  check('⑥ 实测：徭役令 → 建造队列 +3（24h 内）', (function () {
    var S77d = G.state;
    var bkItem = S77d.items.corvee;
    var base = G.buildSlots(G.currentCity());
    S77d.items.corvee = (S77d.items.corvee || 0) + 1;
    var r = G.systems.useItem('corvee');
    var okAll = r.ok && G.buildSlots(G.currentCity()) === base + 3
      && S77d.buffs.buildQueue && S77d.buffs.buildQueue.add === 3
      && S77d.buffs.buildQueue.until > Date.now();
    S77d.items.corvee = bkItem;
    if (S77d.items.corvee == null) delete S77d.items.corvee;
    return okAll;
  })());

  /* ---- ⑦ 内功 ---- */
  check('⑦ 实测：修习秘籍 → 1 重（加成立刻进 genAttrs：+4）；再修 → 2 重（+8）', (function () {
    var S77c = G.state, g77c = S77c.generals[0];
    var bkNg = g77c.ng, bkItem = S77c.items.book_sunzi;
    S77c.items.book_sunzi = (S77c.items.book_sunzi || 0) + 2;
    var zm0 = G.genAttrs(g77c).zm;
    var r1 = G.systems.useItem('book_sunzi', g77c.id);
    var zm1 = G.genAttrs(g77c).zm;
    var r2 = G.systems.useItem('book_sunzi', g77c.id);
    var zm2 = G.genAttrs(g77c).zm;
    var okAll = r1.ok && r2.ok && g77c.ng && g77c.ng.id === 'sunzi' && g77c.ng.lv === 2
      && zm1 === zm0 + 4 && zm2 === zm0 + 8;
    g77c.ng = bkNg;
    S77c.items.book_sunzi = bkItem;
    if (S77c.items.book_sunzi == null) delete S77c.items.book_sunzi;
    return okAll;
  })(), '');

  /* ---- ⑧ 百炼强化 ---- */
  check('⑧ 实测：强化 +1（成本扣、等级记、装备加成随之放大）', (function () {
    var S77e = G.state;
    var id = 'cr_head_1';
    if (!DATA.EQUIP[id]) id = Object.keys(DATA.EQUIP)[0];
    var bkEnh = S77e.forgeEnh ? S77e.forgeEnh[id] : undefined;
    var bkGold = S77e.res.gold, bkIron = S77e.res.iron, bkStone = S77e.res.stone;
    /* 先确保铁匠铺在位（没有就临时造一座；不拆已有建筑） */
    var c77 = G.currentCity();
    var plantedIdx = -1;
    if (G.forgeLevel() <= 0) {
      c77.cells.forEach(function (x, ix) { if (plantedIdx < 0 && !x.build && !x.official) plantedIdx = ix; });
      if (plantedIdx >= 0) c77.cells[plantedIdx].build = { id: 'tiejiangpu', lvl: 1 };
    }
    S77e.inventory = S77e.inventory || [];
    var owned = S77e.inventory.indexOf(id) >= 0;
    if (!owned) S77e.inventory.push(id);
    S77e.res.gold = 100000000; S77e.res.iron = 100000000; S77e.res.stone = 100000000;
    var it77 = DATA.EQUIP[id];
    var fake = { equip: {} }; fake.equip[it77.slot] = id;
    S77e.forgeEnh = S77e.forgeEnh || {};
    S77e.forgeEnh[id] = 0;
    var b0 = G.systems.genEquipBonus(fake);
    var r = G.enhance(id);
    var b1 = G.systems.genEquipBonus(fake);
    var grewAttr = ['tong', 'nz', 'yw', 'zm', 'sta', 'atk', 'def', 'spd'].some(function (k) {
      return Math.abs((b1[k] || 0) - (b0[k] || 0)) > 1e-9;
    });
    var okAll = r.ok && G.enhOf(id) === 1 && grewAttr && G.enhMax() === 10;
    /* 复原 */
    if (bkEnh == null) delete S77e.forgeEnh[id]; else S77e.forgeEnh[id] = bkEnh;
    S77e.res.gold = bkGold; S77e.res.iron = bkIron; S77e.res.stone = bkStone;
    if (!owned) S77e.inventory.splice(S77e.inventory.indexOf(id), 1);
    if (plantedIdx >= 0) delete c77.cells[plantedIdx].build;
    return okAll;
  })(), '');
  check('⑧ 强化界面与入口（铁匠铺底栏 + 装备详情）',
    /ui\\.openEnhance = function/.test(uS77) && /data-action="open-enhance"/.test(uS77)
    && /data-action="enhance-item"/.test(uS77) && /'enhance-item'/.test(mS77));

  /* ---- 附加：内功档案行 ---- */
  check('附加：将领档案含「内功」行（gp-ng）', /gp-ng/.test(uS77) && /内功 · /.test(uS77));

"""
patch(SMOKE,
"""  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
NEW_SEC + """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
'S6 新增 §62')

# =====================================================================
# ⑦ e2e：弹窗清单
# =====================================================================
patch(E2E,
"""  const modals = [['君主', 'openLordInfo'], ['建筑信息', 'openBldgInfo'], ['资源生产', 'openProdInfo'],
    ['附属野地', 'openWilds'],
    ['客栈', 'openInn'], ['招贤馆', 'openHostel'], ['市集', 'openMarket'], ['仓库', 'openStore'],
    ['铁匠铺', 'openForge']];""",
"""  /* v77（老板）：建筑信息 / 资源生产退役；附属野地保留（资源区下拉框进入）。 */
  const modals = [['君主', 'openLordInfo'], ['附属野地', 'openWilds'],
    ['客栈', 'openInn'], ['招贤馆', 'openHostel'], ['市集', 'openMarket'], ['仓库', 'openStore'],
    ['铁匠铺', 'openForge']];""",
'E1 e2e 弹窗清单')

# =====================================================================
# ⑧ e2e：君主弹窗尺寸（lg → xl）
# =====================================================================
patch(E2E,
"""    check('君主弹窗用 lg 档固定尺寸', !!document.querySelector('#modal-root .modal-lg'));""",
"""    check('君主弹窗用 xl 档固定尺寸（v77 左右分栏）', !!document.querySelector('#modal-root .modal-xl'));""",
'E2 e2e 尺寸档')

# =====================================================================
# ⑨ e2e：v75 客栈块 —— .inn-card → .inn-tr，并追加 v77 检查
# =====================================================================
patch(E2E,
"""    const cards75 = root75.querySelectorAll('.inn-card');""",
"""    const cards75 = root75.querySelectorAll('.inn-tr');   /* v77：候选改表格行 */""",
'E3 e2e 行选择器')

patch(E2E,
"""    check('v75：天授权重口径没动（仍 <1%，只是不再展示）', pct75 < 1, '天授 ' + pct75.toFixed(2) + '%');""",
"""    check('v75：天授权重口径没动（仍 <1%，只是不再展示）', pct75 < 1, '天授 ' + pct75.toFixed(2) + '%');

    /* ---- v77（老板）：客栈表格化 / 君主面板 / 野地下拉框 ---- */
    check('v77：客栈表格化（表头 + 每人一行 + 月俸列）',
      !!root75.querySelector('.inn-tbl thead') && root75.innerHTML.indexOf('月俸') >= 0
      && cards75.length === slots75,
      cards75.length + ' / ' + slots75);
    check('v77：表格列头齐备（将领/等级/资质/专长/六维/月俸/招募）', (function () {
      const ths = Array.prototype.map.call(root75.querySelectorAll('.inn-tbl thead th'), (x) => x.textContent.trim());
      return ['将领', '等级', '资质', '专长', '统率', '内政', '勇武', '智谋', '月俸', '招募']
        .every((t, i) => ths[i] === t);
    })(), Array.prototype.map.call(root75.querySelectorAll('.inn-tbl thead th'), (x) => x.textContent.trim()).join('/'));
    G.ui.closeModal();
    /* 君主面板：左城池列表（进入）/ 右信息表（含月俸支出、晋升悬停） */
    G.ui.openLordInfo();
    await sleep(60);
    check('v77：君主面板左右分栏（城池列表带进入 + 信息表含月俸支出）',
      !!root75.querySelector('.lord-split')
      && !!root75.querySelector('.lord-city [data-action="lord-city-enter"]')
      && root75.innerHTML.indexOf('月俸支出') >= 0, '');
    const pbtn77 = root75.querySelector('[data-action="lord-promote"]');
    check('v77：晋升按钮悬停带条件（声望 / 黄金）',
      !!pbtn77 && /声望/.test(pbtn77.getAttribute('title') || '') && /黄金/.test(pbtn77.getAttribute('title') || ''),
      pbtn77 ? (pbtn77.getAttribute('title') || '').slice(0, 46) : '无按钮');
    /* 改名实走 */
    const oldLord77 = G.state.ruler.name;
    G.ui.openRenameLord();
    await sleep(40);
    const inp77 = document.getElementById('rename-lord-input');
    if (inp77) inp77.value = '测试君主';
    const btnOk77 = document.querySelector('#modal-root [data-action="do-rename-lord"]');
    if (btnOk77) btnOk77.click();
    await sleep(80);
    check('v77：君主改名生效（ruler 与君主将领同源）',
      G.state.ruler.name === '测试君主'
      && (!G.lordGeneralOf() || G.lordGeneralOf().name === '测试君主'), G.state.ruler.name);
    G.renameLord(oldLord77);
    G.ui.closeModal();
    /* 资源区：附属野地下拉框 */
    G.ui._wildSig = null;
    G.ui.renderWildPick(G.currentCity(), G.state);
    check('v77：资源区附属野地下拉框 + 进入按钮', (function () {
      const host = document.getElementById('wild-pick-host');
      return !!host && !!host.querySelector('select.wild-select') && !!host.querySelector('[data-action="open-wilds"]');
    })(), (document.getElementById('wild-pick-host') || { innerHTML: '宿主缺失' }).innerHTML.slice(0, 30));""",
'E4 e2e v77 块')

print('\n测试层 v77 补丁执行完毕。')
