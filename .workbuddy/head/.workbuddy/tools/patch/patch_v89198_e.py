# -*- coding: utf-8 -*-
"""v89.198 批次E：smoke-test.js —— §94 E1/E2 升级 · §197 升级 · 新增 §198"""

import io

def rd(p):
    return io.open(p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    c = s.count(old)
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

def slice_rep(path, tag, start, end, new, mark):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    i1 = s.find(start)
    assert i1 >= 0, '[FAIL] ' + tag + ' start 未找到'
    i2 = s.find(end, i1)
    assert i2 >= 0, '[FAIL] ' + tag + ' end 未找到'
    i2 += len(end)
    s = s[:i1] + new + s[i2:]
    wr(path, s)
    print('[ok] ' + tag)

S = 'E:/Deepseekdb/smoke-test.js'

# ---- §94 区 ----
rep(S, 'G12a 共用名将注释',
"""    /* 战法/围攻共用同一名将（先建好：战法断言在围攻流程之前跑） */""",
"""    /* 围攻与全撤行为断言共用同一名将（先建好：断言在围攻流程之前跑） */""",
    '围攻与全撤行为断言共用同一名将')

rep(S, 'G12b E2 段头注释',
"""· 战法三选（围困/奇袭）的校验与真实效果""",
"""· 出战校验（v89.198 战法全撤后的默认口径与旧参兼容）""",
    'v89.198 战法全撤后的默认口径与旧参兼容')

rep(S, 'G1 E1 配置表断言升级',
"""    check('E1：配置表齐备（试点范围 / 每日恢复 / 破防上下限 / 衰减保底）', (function () {
      var C = DATA.SIEGE || {};
      return C.scope.join(',') === 'fort,county' && C.repairPerDay > 0
        && C.chipBase > 0 && C.chipMin < C.chipBase && C.chipMax > C.chipBase
        && C.defScale > 0 && C.defScale < 1 && C.defThr > 0 && C.defThr < 1
        && C.encircle && C.encircle.marchMul > 1 && C.encircle.garrisonCut > 0
        && C.surprise && C.surprise.schemeMul > 1;
    })());""",
"""    check('E1：配置表齐备（试点范围 / 每日恢复 / 破防上下限 / 衰减保底）· v89.198 战法系数零残留', (function () {
      var C = DATA.SIEGE || {};
      return C.scope.join(',') === 'fort,county' && C.repairPerDay > 0
        && C.chipBase > 0 && C.chipMin < C.chipBase && C.chipMax > C.chipBase
        && C.defScale > 0 && C.defScale < 1 && C.defThr > 0 && C.defThr < 1
        /* v89.198（老板「清除战法这个玩法」）规则变更所致：encircle/surprise 系数随玩法全撤 */
        && C.encircle === undefined && C.surprise === undefined;
    })());""",
    'v89.198 战法系数零残留')

rep(S, 'G2 E1 破防断言升级',
"""    check('E1：破防 = chipBase×战力比（保底/封顶/围困倍率全按配置）', (function () {
      var C = DATA.SIEGE;
      var ok = G.siegeChipOf(1, 'assault') === Math.max(C.chipMin, Math.min(C.chipMax, C.chipBase))
        && G.siegeChipOf(0.05, 'assault') === C.chipMin
        && G.siegeChipOf(9, 'assault') === C.chipMax
        && G.siegeChipOf(1, 'encircle') === Math.round(C.chipBase * C.encircle.chipMul);
      return ok;
    })(), 'chipBase ' + DATA.SIEGE.chipBase + ' → 1:1 = ' + G.siegeChipOf(1, 'assault')
      + '% · 围困 = ' + G.siegeChipOf(1, 'encircle') + '%');""",
"""    check('E1：破防 = chipBase×战力比（保底/封顶按配置；v89.198 起单参口径）', (function () {
      var C = DATA.SIEGE;
      var ok = G.siegeChipOf(1) === Math.max(C.chipMin, Math.min(C.chipMax, C.chipBase))
        && G.siegeChipOf(0.05) === C.chipMin
        && G.siegeChipOf(9) === C.chipMax
        && G.siegeChipOf.length === 1;
      return ok;
    })(), 'chipBase ' + DATA.SIEGE.chipBase + ' → 1:1 = ' + G.siegeChipOf(1) + '%');""",
    'v89.198 起单参口径')

# E2 整段替换（切片）
slice_rep(S, 'G3 E2 段整体改写（全撤行为）',
"""    console.log('  --- E2 战法三选：校验与真实效果 ---');""",
"""    console.log('  --- E1 围攻：多波次全流程（真实结算到破城） ---');""",
"""    console.log('  --- E2（v89.198 全撤后）：出征默认口径 · 战法零效果 ---');
    check('E2（v89.198 全撤）：dispatch 六参签名 · 旧 ops 参数不再产生任何效果（前向兼容）', (function () {
      if (!f94) return false;
      var gW = G.makeGeneral('全撤甲', 60, 'idle', c94.id, false);
      gW.stamina = 300; gW.energy = 100; S94.generals.push(gW);
      var tgtF = { kind: 'fort', x: f94.x, y: f94.y };
      S94.marches = [];
      c94.army = { gongjian: 9000 };
      var dA = G.march.dispatch(tgtF, 'raid', { gongjian: 1000 }, gW.id, null);
      var tA = dA.ok ? S94.marches[0].totalTime : 0;
      S94.marches = []; c94.army = { gongjian: 9000 };
      gW.stamina = 300; gW.energy = 100; gW.status = 'idle';
      /* 旧式第七参调用：多传的 'encircle' 落进 extra（非对象、无货可载）→ 不拦、不加时长 */
      var dE = G.march.dispatch(tgtF, 'raid', { gongjian: 1000 }, gW.id, null, 'encircle');
      var tE = dE.ok ? S94.marches[0].totalTime : 0;
      var mOps = S94.marches[0] ? S94.marches[0].ops : 'x';
      S94.marches = []; gW.status = 'idle';
      global.__d94e2 = 'sig=' + G.march.dispatch.length + ' tA=' + tA + ' tE=' + tE + ' recOps=' + mOps;
      return G.march.dispatch.length === 6 && dA.ok && dE.ok && tA > 0 && tE === tA && mOps === undefined;
    })(), global.__d94e2 || '');
    check('E2（v89.198 全撤）：真打一场（据点）—— 战报无【战法】行、无「围困/奇袭」字样', (function () {
      if (!f94 || !g94) return false;
      var n0 = S94.reports.length;
      var tF = { kind: 'fort', x: f94.x, y: f94.y };
      if (G.siegeScopeOf(tF)) G.siegeClear(tF);          /* 清守备：与旧口径同起点 */
      g94.stamina = 300; g94.energy = 100; g94.status = 'idle';
      c94.army = { gongjian: 6000 };
      S94.settings.battleWatch = false;
      G.battle.expedition(tF, 'occupy', { gongjian: 3000 }, g94.id);
      var rep = S94.reports[0];
      global.__d94e2b = rep ? ('hasOps=' + (rep.body.indexOf('【战法】') >= 0)
        + ' has围困=' + (rep.body.indexOf('围困') >= 0)) : 'no-report';
      return S94.reports.length === n0 + 1 && !!rep
        && rep.body.indexOf('【战法】') < 0
        && rep.body.indexOf('围困') < 0 && rep.body.indexOf('奇袭') < 0;
    })(), global.__d94e2b || '');
    check('E2（v89.198 全撤）：计略回到基准（妖言逃散 = 15%，不再被奇袭放大）', (function () {
      if (!f94 || !g94) return false;
      var tF = { kind: 'fort', x: f94.x, y: f94.y };
      if (G.siegeScopeOf(tF)) G.siegeClear(tF);
      g94.stamina = 300; g94.energy = 100; g94.status = 'idle';
      c94.army = { gongjian: 6000 };
      G.battle.expedition(tF, 'occupy', { gongjian: 3000 }, g94.id, { scheme: 'yaoyan' });
      var rep = S94.reports[0];
      if (!rep) { global.__d94e2c = 'no-report'; return false; }
      var m = /守军逃散 (\\d+)%/.exec(rep.body);
      global.__d94e2c = m ? ('逃散 ' + m[1] + '%') : 'no-match';
      return !!m && Number(m[1]) === 15;
    })(), global.__d94e2c || '');
""",
    'E2（v89.198 全撤）：出征默认口径 · 战法零效果')

# E3/E1 断言升级
rep(S, 'G4 E3/E1 断言升级',
"""    check('E3/E1：界面与动作齐备（战法块 / 撤退键）· 回放控制**已退役**', (function () {
      /* v89.150（老板 3）：四个 rep-* 动作与四个 replay* 函数随板块一并退役（负向判据防复活）。 */
      var _c94 = stripComment(uS94);
      var _m94 = stripComment(mS94);
      var uiOk = typeof G.ui.expOpsBlockHTML === 'function' && typeof G.ui.setExpOps === 'function'
        && /id="exp-ops"/.test(G.ui.expOpsBlockHTML())
        && typeof G.ui.replaySectionHTML === 'undefined'
        && typeof G.ui.replaySet === 'undefined'
        && typeof G.ui.replayToggle === 'undefined'
        && typeof G.ui.replayJump === 'undefined';
      var one = '';
      var wOk = ['bt-retreat', 'exp-ops']
        .every(function (a) { return _m94.indexOf("case '" + a + "'") >= 0; })""",
"""    check('E3/E1（v89.198 全撤）：战法块退役（expOps* 定义式零残留）· 撤退键齐备 · 回放控制已退役', (function () {
      /* v89.150（老板 3）：四个 rep-* 动作与四个 replay* 函数随板块一并退役（负向判据防复活）。
         v89.198（老板「清除战法这个玩法」）：expOps* / setExpOps / case 'exp-ops' 一并清除。 */
      var _c94 = stripComment(uS94);
      var _m94 = stripComment(mS94);
      var uiOk = typeof G.ui.expOpsBlockHTML === 'undefined' && typeof G.ui.setExpOps === 'undefined'
        && _c94.indexOf('expOpsBlockHTML') < 0 && _c94.indexOf('expOpsChipsHTML') < 0
        && _c94.indexOf('setExpOps') < 0
        && typeof G.ui.replaySectionHTML === 'undefined'
        && typeof G.ui.replaySet === 'undefined'
        && typeof G.ui.replayToggle === 'undefined'
        && typeof G.ui.replayJump === 'undefined';
      var one = '';
      var wOk = _m94.indexOf("case 'bt-retreat'") >= 0
        && _m94.indexOf("case 'exp-ops'") < 0""",
    'expOps* / setExpOps / case')

# ---- §197 区 ----
slice_rep(S, 'G5 §197② 断言改写（只读计略）',
"""    /* ② 战法可见性：expDefModsOf（唯一出口）行为 —— 界面估算 = 实战效果的桥 */""",
"""    })(), global.__d197a || '');""",
"""    /* ②（v89.198 修订）计略可见性：expDefModsOf（唯一出口）行为 —— 估算 = 实战的桥；
       战法分支已随「清除战法这个玩法」全撤退役。 */
    check('§197② expDefModsOf（v89.198）：无计略无修正 / 妖言 0.85 / 火烧城防折 / 不再有奇袭放大', (function () {
      var bkSch = G.ui._expScheme, bkRes = G.ui._expRes, bkCity = G.ui._cityId;
      var bkArmy = G.state.cities[0] ? G.state.cities[0].army : null;
      try {
        G.ui._cityId = G.state.cities[0].id;
        G.ui._expRes = { kind: 'fort', x: 10, y: 10, garrison: { yibing: 1000 }, def: 0 };
        G.ui._expScheme = null;
        var m0 = G.ui.expDefModsOf();
        G.ui._expScheme = 'yaoyan';
        var m1 = G.ui.expDefModsOf();
        G.ui._expScheme = 'huoshao';
        var m2 = G.ui.expDefModsOf();
        /* 估算联动：妖言的守军应低 15%（真调 expPowerOf 对照） */
        G.ui._expScheme = null;
        G.state.cities[0].army = { yibing: 5000 };
        var p0 = G.ui.expPowerOf();
        G.ui._expScheme = 'yaoyan';
        var p1 = G.ui.expPowerOf();
        global.__d197a = 'm0=' + m0.garrisonMul + ' m1=' + m1.garrisonMul.toFixed(3)
          + ' m2wall=' + m2.wallMul.toFixed(3)
          + ' def ' + (p0 && p0.def) + '→' + (p1 && p1.def);
        return m0.garrisonMul === 1 && m0.wallMul === 1 && m0.notes.length === 0
          && Math.abs(m1.garrisonMul - 0.85) < 1e-9 && Math.abs(m1.wallMul - 1) < 1e-9
          && m2.wallMul < 1 && m2.garrisonMul === 1
          && !!p0 && !!p1 && p0.mods && p0.mods.notes.length === 0
          && Math.abs(p1.def / p0.def - 0.85) < 0.01 && p1.mods.notes[0].indexOf('妖言') >= 0;
      } finally {
        G.ui._expScheme = bkSch; G.ui._expRes = bkRes; G.ui._cityId = bkCity;
        if (bkArmy && G.state.cities[0]) G.state.cities[0].army = bkArmy;
      }
    })(), global.__d197a || '');""",
    'expDefModsOf（v89.198）：无计略无修正')

rep(S, 'G6 §197②b 断言改写',
"""    /* ②b 战报【战法】行：源码链（打包/重放/组装四段） */
    check('§197②b 战报【战法】行四段链：result.opsNote + 打包 + 重放读回 + 组装（不漏字段）', (function () {
      return /if \\(opsNote\\) result\\.opsNote = opsNote;/.test(b197)
        && /opsNote: simIn\\.opsNote \\|\\| null/.test(b197)
        && /opsNote = opts\\._sim\\.opsNote \\|\\| null;/.test(b197)
        && /【战法】' \\+ result\\.opsNote/.test(b197);
    })());""",
"""    /* ②b（v89.198 全撤）：战法注脚链清退 —— opsNote / _opsMul 零残留（剥注释） */
    check('§197②b（v89.198 全撤）：opsNote 全链清退（打包/重放/组装零残留）', (function () {
      var _b = stripComment(b197);
      return _b.indexOf('opsNote') < 0 && _b.indexOf('_opsMul') < 0;
    })());""",
    'opsNote 全链清退（打包/重放/组装零残留）')

# ②b2 删除（判据反转，行为已移 §94 E2）
slice_rep(S, 'G7 §197②b2 删除（移 §94）',
"""    /* ②b2 真打一场（即时结算）：战报含【战法】围困行 */""",
"""    })(), global.__d197b || '');""",
"""    /* ②b2（原「真打一场战报含围困行」）：判据反转 —— 行为断言移至 §94 E2（战报无【战法】/围困）。 */
""",
    '行为断言移至 §94 E2（战报无【战法】/围困）')

rep(S, 'G8 §197②c 断言改写',
"""    /* ②c 战法 chips 用标准组件（裸类名 `ch` 零残留 —— 真 bug 修复的守护） */
    check('§197②c 战法 chips 标准组件：.chips/.chip+on/off（旧 class="ch" 零残留）', (function () {
      var seg = codeOf(u197, 'ui.expOpsChipsHTML = function');
      return /'<span class="chips chips-xs">'/.test(seg)
        && /class="chip' \\+ \\(cur === o\\.id \\? ' on' : ''\\)/.test(seg)
        && !/'<span class="ch'/.test(seg);
    })());""",
"""    /* ②c（v89.198 全撤）：战法 chips 退役 —— expOps* 定义式零残留（原「裸类名 ch」守护随之退役） */
    check('§197②c（v89.198 全撤）：expOps* 定义式零残留（chips 已随玩法清除）', (function () {
      var _u = stripComment(u197);
      return _u.indexOf('expOpsChipsHTML') < 0 && _u.indexOf('expOpsNoteHTML') < 0
        && _u.indexOf('expOpsBlockHTML') < 0 && _u.indexOf('setExpOps') < 0;
    })());""",
    'chips 已随玩法清除')

rep(S, 'G9 §197④ 断言升级',
"""    /* ④ 出征统一行：expRowHTML 出口 + 8 模块 + 双写标题退役 */
    check('§197④ 出征统一行：expRowHTML（名称+控件+tip-src）· 7 模块 + 战法 · 双写标题零残留', (function () {
      var seg = codeOf(u197, 'ui.openExpModal = function');
      var rows = (seg.match(/ui\\.expRowHTML\\(/g) || []).length;
      global.__d197c = 'rows=' + rows + '（+战法行在 expOpsBlockHTML）';""",
"""    /* ④ 出征统一行：expRowHTML 出口 + 7 模块 + 双写标题退役（v89.198：战法行已全撤） */
    check('§197④ 出征统一行：expRowHTML（名称+控件+tip-src）· 7 模块 · 双写标题零残留', (function () {
      var seg = codeOf(u197, 'ui.openExpModal = function');
      var rows = (seg.match(/ui\\.expRowHTML\\(/g) || []).length;
      global.__d197c = 'rows=' + rows;""",
    "global.__d197c = 'rows=' + rows;")

rep(S, 'G9b §197④ 返回加战法负判',
"""      return /ui\\.expRowHTML = function \\(lab, ctrl, tipHTML\\)/.test(u197)
        && rows >= 7
        && seg.indexOf('exp-sec-t">目标') < 0""",
"""      return /ui\\.expRowHTML = function \\(lab, ctrl, tipHTML\\)/.test(u197)
        && rows >= 7
        && u197.indexOf("ui.expRowHTML('战法'") < 0
        && seg.indexOf('exp-sec-t">目标') < 0""",
    "ui.expRowHTML('战法'")

slice_rep(S, 'G10 §197④b 断言改写（备注布局）',
"""    /* ④b 备注悬停化：据点/战法/计略/方案进悬停源；限制性信息与主将/道具备注保留 */""",
"""        && seg.indexOf('id="exp-items"') >= 0;
    })());""",
"""    /* ④b（v89.198 修订）备注布局：悬停源（计略/据点/方案）在册；
       相称建议移入目标区、精力/体力行挂主将区、锦囊数量行退役、阵位行退役 */
    check('§197④b 备注布局（v89.198 修订）：悬停源在册 · 相称建议→目标区 · 精力体力→主将区 · 锦囊/阵位行退役', (function () {
      var seg = codeOf(u197, 'ui.openExpModal = function');
      var segFx = codeOf(u197, 'ui.refreshExpItems = function');
      var iTgt = seg.indexOf('exp-a-target'), iRec = seg.indexOf('相称建议'), iGen = seg.indexOf('exp-a-gen');
      return /ui\\.expRowHTML\\('计略', schemeSel, '<span id="exp-scheme-label">'/.test(seg)
        && seg.indexOf('套用方案即按其配好兵力与战术') >= 0
        && seg.indexOf('据点：占领=拔除并收为') >= 0
        && seg.indexOf('id="exp-limits"') >= 0
        && iTgt >= 0 && iRec > iTgt && iRec < iGen
        && seg.indexOf('id="exp-gen-vital"') > iGen
        && seg.indexOf('id="exp-items"') < 0
        && seg.indexOf('exp-tac-sum') < 0
        && segFx.indexOf('exp-gen-vital') >= 0 && segFx.indexOf('锦囊') < 0;
    })());""",
    '备注布局（v89.198 修订）')

# ---- 新增 §198 ----
SEC198 = """  /* ============================================================
   * §198（v89.198）—— 战法玩法全撤 · 管理弹窗统一行 · 出征备注四项
   * 老板原话：「1.管理弹窗 2.（清除战法这个玩法 · 问询回执）3.出征战术无需备注：
   *   阵位 全体前进（默认）逐兵种 4.精力 386 · 体力 294/294 这种备注在选定主将后
   *   出现在主将栏 5.相称建议：宜 英杰 Lv50+ 带队 这个备注出现在目标栏
   *   6.锦囊数量备注无需显示」
   * ============================================================ */
  (function () {
    console.log('  --- §198 战法全撤 · 管理弹窗统一行 · 出征备注四项 ---');
    var fs198 = require('fs'), p198 = require('path');
    var u198 = fs198.readFileSync(p198.join(__dirname, 'js', 'ui.js'), 'utf8');
    var d198 = fs198.readFileSync(p198.join(__dirname, 'js', 'data.js'), 'utf8');
    var g198 = fs198.readFileSync(p198.join(__dirname, 'js', 'domain.js'), 'utf8');
    var b198 = fs198.readFileSync(p198.join(__dirname, 'js', 'battle.js'), 'utf8');
    var m198 = fs198.readFileSync(p198.join(__dirname, 'js', 'main.js'), 'utf8');

    /* ① 战法全撤：五件套连清（剥注释查可执行区） */
    check('§198① 战法全撤：DATA.OPS / 系数 / 出口 / 校验 / 界面零残留（五件套）', (function () {
      var _d = stripComment(d198), _g = stripComment(g198), _u = stripComment(u198), _b = stripComment(b198);
      return _d.indexOf('DATA.OPS =') < 0 && _d.indexOf('encircle:') < 0 && _d.indexOf('surprise:') < 0
        && _g.indexOf('opsIdOf = function') < 0 && _g.indexOf('opsOf = function') < 0
        && _g.indexOf('opsConfigIssueOf = function') < 0
        && _g.indexOf('ops === ') < 0
        && _u.indexOf('expOps') < 0 && _u.indexOf('setExpOps') < 0 && _u.indexOf('_expOps') < 0
        && _b.indexOf('_opsMul') < 0 && _b.indexOf('opsId =') < 0 && _b.indexOf('marchMul') < 0;
    })());
    check('§198①b 战法全撤：dispatch 六参 · 四处墓碑在册（data/domain/ui/main）', (function () {
      return G.march.dispatch.length === 6
        && d198.indexOf('v89.198') >= 0 && g198.indexOf('v89.198') >= 0
        && u198.indexOf('v89.198') >= 0 && m198.indexOf('v89.198') >= 0
        && G.siegeChipOf.length === 1;
    })());

    /* ② 管理弹窗（自动出征·详细配置）统一行 */
    check('§198② 管理弹窗统一行：expRowHTML >= 9 · 9 个名称列 · 双写/旧结构零残留', (function () {
      var seg = codeOf(u198, 'ui.openAutoMarch = function');
      var rows = (seg.match(/ui\\.expRowHTML\\(/g) || []).length;
      var names = ['执行将领', '目标类型', '目标等级', '搜索距离', '出征方式', '计略', '出征战术', '出征频率', '每日上限'];
      var allIn = names.every(function (n) { return seg.indexOf("'" + n + "'") >= 0; });
      global.__d198b = 'rows=' + rows;
      return rows >= 9 && allIn
        && seg.indexOf('exp-sec-t">执行将领') < 0
        && seg.indexOf('exp-sec-t">目标') < 0
        && seg.indexOf('exp-sec-t">出征方式') < 0
        && seg.indexOf('exp-sec-t">计略') < 0
        && seg.indexOf('exp-sec-t">出征战术') < 0
        && seg.indexOf('exp-sec-t">频率') < 0
        && seg.indexOf('class="exp-sel"') < 0;
    })(), global.__d198b || '');

    /* ③ 备注四项（源码级） */
    check('§198③ 备注四项：阵位行退役（双面板）· 精力体力入主将栏 · 相称建议入目标栏 · 锦囊数量退役', (function () {
      var seg = codeOf(u198, 'ui.openExpModal = function');
      var segAm = codeOf(u198, 'ui.openAutoMarch = function');
      var segFx = codeOf(u198, 'ui.refreshExpItems = function');
      var iTgt = seg.indexOf('exp-a-target'), iRec = seg.indexOf('相称建议'), iGen = seg.indexOf('exp-a-gen');
      return seg.indexOf('exp-tac-sum') < 0 && segAm.indexOf('am-tac-sum') < 0
        && segAm.indexOf('data-action="open-tactic-set"') >= 0
        && iTgt >= 0 && iRec > iTgt && iRec < iGen
        && seg.indexOf('id="exp-gen-vital"') > iGen
        && segFx.indexOf('exp-gen-vital') >= 0 && segFx.indexOf('锦囊') < 0
        && u198.indexOf('<b>锦囊</b> ×') < 0 && u198.indexOf('id="exp-items"') < 0;
    })());

    /* ④ 备注四项（真渲染） */
    check('§198④ 真渲染：主将区精力/体力行 · 目标区相称建议 · 无锦囊计数 · 无战法行/阵位行', (function () {
      var bk = G.state, bkCity = G.ui._cityId;
      var html = '';
      try {
        G.state = G.newGame({ name: 'v198', cityName: '许都' });
        if (!G.state.map.grid) G.map.generate();
        var c = G.state.cities[0];
        c.army = { yibing: 500 };
        if (!(G.state.generals || []).length) {
          G.state.generals.push(G.makeGeneral('全撤测', 40, 'idle', c.id, false));
        }
        G.ui._cityId = c.id;
        G.ui.closeAllModals();
        G.ui.openExpModal({ kind: 'wild', x: c.x + 3, y: c.y + 3 });
        html = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
      } catch (e) { html = 'ERR:' + e.message; }
      try { G.ui.closeAllModals(); } catch (e2) {}
      G.state = bk; G.ui._cityId = bkCity;
      var mRec = html.match(/相称建议[\\s\\S]{0,60}?<\\/div>/);
      var mVital = html.match(/id="exp-gen-vital"[\\s\\S]{0,140}?<\\/div>/);
      global.__d198c = (mVital ? mVital[0].replace(/<[^>]+>/g, '').slice(0, 60) : html.slice(0, 60));
      return !!mRec && !!mVital && /精力/.test(mVital[0]) && /体力/.test(mVital[0])
        && html.indexOf('锦囊 ×') < 0 && html.indexOf('id="exp-ops"') < 0
        && html.indexOf('阵位 全体前进') < 0;
    })(), global.__d198c || '');
  })();
"""

s = rd(S)
mark198 = '§198① 战法全撤'
if mark198 in s:
    print('[skip] §198 段（已落盘）')
else:
    anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    c = s.count(anchor)
    assert c >= 1, '[FAIL] §198 anchor count=' + str(c)
    i = s.rindex(anchor)
    s = s[:i] + SEC198 + u'\n' + s[i:]
    wr(S, s)
    print('[ok] §198 段插入')

print('批次E 完成')
