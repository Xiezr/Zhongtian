# -*- coding: utf-8 -*-
"""
v89.113a · 「城主」职位 + 守将职能重分工（老板需求 3）
--------------------------------------------------------
老板令：「添加一个与守将同级的职位，名为城主，城主的**内政和智谋**起当前守将的作用。
后续守将的功能将会更新：1）勇武对征兵速度加成；2）守城战时作为我方将领对阵，对战斗加成。」

本补丁 = 文武分职：
  · 城主（mayor）：nz → 产量/建造；zm → 研究/城防   ← 从守将迁来
  · 守将（guard）：yw → 征兵速度（保留）；战时作为 defGen 对阵（既有，保留）
  · 一人一职（status 单值天然互斥）；同城新旧自动让位
"""
import io, os, shutil

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')

def sub_txt(s, a, b, tag):
    n = s.count(a)
    assert n == 1, '锚点 %s 命中 %d 次：%s' % (tag, n, a[:80])
    return s.replace(a, b, 1)

def rw(p, s, name):
    shutil.copy2(p, os.path.join(BK, name))
    io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
    os.replace(p + '.tmp', p)

# ============================================================
# A. domain.js
# ============================================================
dp = os.path.join(R, 'js', 'domain.js')
d = io.open(dp, encoding='utf-8').read()

# A1/A2：guardBonus 重写（只留 train）+ 新增 mayorBonus；guardGeneralOf 旁加 mayorGeneralOf
a = """  GAME.guardBonus = function (city) {
    var g = GAME.guardGeneralOf(city);
    if (!g) return { name: null, prod: 0, build: 0, train: 0, research: 0, def: 0, faint: 1 };
    var a = GAME.genAttrs(g);
    /* 忠诚低于警戒线 → 该将勤勉不足，加成打折（让忠诚第一次真正影响数值） */
    var faint = (g.loyalty != null && g.loyalty < DATA.LOYALTY.warnAt) ? DATA.LOYALTY.faintMul : 1;
    /* v89.93（整改 W3/U3）：**产量加成封顶 +150%** —— 与建造/征兵/研究（1.5）
       及城防（1.0）同口径。改前它是全游戏**唯一不封顶**的加成项
       （守卫 nz 980 → 产量 ×10.8；宝物流实测推到 nz 6,203 → ×63）。 */
    return {
      name: g.name, gen: g, faint: faint, loyalty: g.loyalty,
      prod: Math.min(1.5, a.nz * 0.01 * faint),     // 内政 1 点 → 产量 +1%（封顶 +150%）
      build: Math.min(1.5, a.nz * 0.01 * faint),    // 内政 1 点 → 建造速度 +1%（封顶 +150%）
      train: a.yw * 0.005 * faint,     // 勇武 1 点 → 征兵速度 +0.5%
      research: a.zm * 0.005 * faint,  // 智谋 1 点 → 研究速度 +0.5%
      def: a.zm * 0.005 * faint,       // 智谋 1 点 → 城防 +0.5%
    };
  };"""
b = """  /* ============================================================
   * v89.113（老板需求 3）：**「城主」与「守将」同级分职**
   * ------------------------------------------------------------
   * 老板令：「添加一个与守将同级的职位，名为城主，城主的**内政和智谋**
   *   起当前守将的作用。后续守将的功能将会更新：1）勇武对征兵速度加成；
   *   2）守城战时作为我方将领对阵，对战斗加成。」
   *
   * 分工（一人一职，status 单值天然互斥）：
   *   · 城主（mayor）—— 文治：内政 nz → 产量 + 建造；智谋 zm → 研究 + 城防
   *   · 守将（guard）—— 武功：勇武 yw → 征兵速度；战时报**对阵将领**（defGen）
   *
   * ⚠️ 迁移口径：老档里 nz/zm 的加成原本由守将提供 —— 本版起**只有城主**提供。
   *    未任命城主 = 内政/智谋加成为零（界面会提示任命），不会静默回落给守将
   *    （那样等于两个出口，正是本项目反复修的病）。
   * ============================================================ */
  GAME.mayorGeneralOf = function (city) {
    var s = GAME.state;
    if (!s || !city) return null;
    for (var i = 0; i < s.generals.length; i++) {
      var g = s.generals[i];
      if (g.cityId === city.id && g.status === 'mayor') return g;
    }
    return null;
  };
  GAME.mayorBonus = function (city) {
    var g = GAME.mayorGeneralOf(city);
    if (!g) return { name: null, prod: 0, build: 0, research: 0, def: 0, faint: 1 };
    var a = GAME.genAttrs(g);
    /* 忠诚低于警戒线 → 该将勤勉不足，加成打折（与守将同一条忠诚规则） */
    var faint = (g.loyalty != null && g.loyalty < DATA.LOYALTY.warnAt) ? DATA.LOYALTY.faintMul : 1;
    /* v89.93（整改 W3/U3）：**产量加成封顶 +150%** —— 与建造/征兵/研究（1.5）
       及城防（1.0）同口径。改前它是全游戏**唯一不封顶**的加成项
       （守卫 nz 980 → 产量 ×10.8；宝物流实测推到 nz 6,203 → ×63）。 */
    return {
      name: g.name, gen: g, faint: faint, loyalty: g.loyalty,
      prod: Math.min(1.5, a.nz * 0.01 * faint),     // 内政 1 点 → 产量 +1%（封顶 +150%）
      build: Math.min(1.5, a.nz * 0.01 * faint),    // 内政 1 点 → 建造速度 +1%（封顶 +150%）
      research: Math.min(1.5, a.zm * 0.005 * faint),// 智谋 1 点 → 研究速度 +0.5%
      def: Math.min(1.0, a.zm * 0.005 * faint),     // 智谋 1 点 → 城防 +0.5%（封顶 +100%）
    };
  };

  /* 守将加成（v89.113 起**只保武功**：征兵 + 战时对阵）。
     内政/智谋的加成已迁往 mayorBonus —— 别在这里再加回来（两个出口必漂移）。 */
  GAME.guardBonus = function (city) {
    var g = GAME.guardGeneralOf(city);
    if (!g) return { name: null, train: 0, faint: 1 };
    var a = GAME.genAttrs(g);
    var faint = (g.loyalty != null && g.loyalty < DATA.LOYALTY.warnAt) ? DATA.LOYALTY.faintMul : 1;
    return {
      name: g.name, gen: g, faint: faint, loyalty: g.loyalty,
      train: a.yw * 0.005 * faint,     // 勇武 1 点 → 征兵速度 +0.5%
    };
  };"""
d = sub_txt(d, a, b, 'A1/A2 guardBonus')

# A3：releaseMayorsOf（挨着 releaseGuardsOf）
a = """  /* 解除某城的守将（keepId 那位除外），返回被解任者名字数组 */
  GAME.releaseGuardsOf = function (cityId, keepId) {
    var out = [];
    (((GAME.state || {}).generals) || []).forEach(function (x) {
      if (x.id === keepId) return;
      if (x.status === 'guard' && x.cityId === cityId) {
        x.status = 'idle'; x.cityId = null; out.push(x.name);
      }
    });
    return out;
  };"""
b = """  /* 解除某城的守将（keepId 那位除外），返回被解任者名字数组 */
  GAME.releaseGuardsOf = function (cityId, keepId) {
    var out = [];
    (((GAME.state || {}).generals) || []).forEach(function (x) {
      if (x.id === keepId) return;
      if (x.status === 'guard' && x.cityId === cityId) {
        x.status = 'idle'; x.cityId = null; out.push(x.name);
      }
    });
    return out;
  };
  /* v89.113：城主的同款释放口（与守将成对 —— 任命即替换，一城一城主） */
  GAME.releaseMayorsOf = function (cityId, keepId) {
    var out = [];
    (((GAME.state || {}).generals) || []).forEach(function (x) {
      if (x.id === keepId) return;
      if (x.status === 'mayor' && x.cityId === cityId) {
        x.status = 'idle'; x.cityId = null; out.push(x.name);
      }
    });
    return out;
  };"""
d = sub_txt(d, a, b, 'A3 releaseMayorsOf')

# A4：assignGeneral 支持 mayor
a = """    var cityArg = cityId || (GAME.currentCity() || {}).id || null;
    if (role !== 'guard') {
      g.status = role; g.cityId = cityArg;
      return { ok: true, msg: '解除任命 ' + g.name };
    }
    /* 任命：同城旧任自动让位（守将也换城时走同一条 —— 一个人不能同时守两座城） */
    var out = GAME.releaseGuardsOf(cityArg, g.id);
    g.status = 'guard'; g.cityId = cityArg;
    var cn = (GAME.cityById(cityArg) || {}).name;
    return { ok: true, msg: '任命 ' + g.name + (cn ? ' 为「' + cn + '」' : ' 为') + '守将' +
      (out.length ? '　（已自动解除 ' + out.join('、') + '）' : '') };
  };"""
b = """    var cityArg = cityId || (GAME.currentCity() || {}).id || null;
    if (role !== 'guard' && role !== 'mayor') {
      g.status = role; g.cityId = cityArg;
      return { ok: true, msg: '解除任命 ' + g.name };
    }
    /* v89.113（老板需求 3）：城主与守将同级分职 —— 两条任命走同构路径：
       同城旧任自动让位；一个人只能一职（status 单值），换职即自动卸旧职。 */
    var _roleName = (role === 'mayor') ? '城主' : '守将';
    var out = (role === 'mayor') ? GAME.releaseMayorsOf(cityArg, g.id) : GAME.releaseGuardsOf(cityArg, g.id);
    g.status = role; g.cityId = cityArg;
    var cn = (GAME.cityById(cityArg) || {}).name;
    return { ok: true, msg: '任命 ' + g.name + (cn ? ' 为「' + cn + '」' : ' 为') + _roleName +
      (out.length ? '　（已自动解除 ' + out.join('、') + '）' : '') };
  };"""
d = sub_txt(d, a, b, 'A4 assignGeneral')

# A5：guardBuildMult → cityBuildMult（名与实对齐：它读的是城主的内政）
a = """  /* 守将建造加速系数（内政 1 点 → 建造速度 +1%，最多加速 60%）——
     **按城取**：传哪座城就只吃哪座城的守将。 */
  GAME.guardBuildMult = function (city) {
    return GAME._rawGuardBuildMult(city) / (1 + techB('build'));   // 建筑技术：耗时 −5%/级
  };
  GAME._rawGuardBuildMult = function (city) {
    var gb = GAME.guardBonus(city);
    return 1 / (1 + Math.min(1.5, gb.build || 0));
  };"""
b = """  /* 城池建造加速系数（**城主**内政 1 点 → 建造速度 +1%，最多加速 60%）——
     **按城取**：传哪座城就只吃哪座城的城主。
     v89.113：原名 guardBuildMult（守将建造）—— 职能迁往城主后**改名对齐**
     （名与实不符的名字就是下一个 bug 的温床；全消费点已同步）。 */
  GAME.cityBuildMult = function (city) {
    return GAME._rawCityBuildMult(city) / (1 + techB('build'));   // 建筑技术：耗时 −5%/级
  };
  GAME._rawCityBuildMult = function (city) {
    var mb = GAME.mayorBonus(city);
    return 1 / (1 + Math.min(1.5, mb.build || 0));
  };"""
d = sub_txt(d, a, b, 'A5 cityBuildMult')

# 消费点改名（7 处）
n_gb = d.count('GAME.guardBuildMult(')
assert n_gb == 7, 'guardBuildMult 消费点 %d 处（应 7）' % n_gb
d = d.replace('GAME.guardBuildMult(', 'GAME.cityBuildMult(')

# 注释里的消费点引用
d = d.replace("""   *   · 建造   → `GAME.guardBuildMult(city)`""",
              """   *   · 建造   → `GAME.cityBuildMult(city)`（v89.113 起读城主内政）""")

# A6：cityDefenseBase 的守将 → 城主
a = """    var gbc = GAME.guardBonus(city);
    if (gbc.name) base = Math.round(base * (1 + Math.min(1.0, gbc.def))); // 守将智谋：城防
    return base;"""
b = """    /* v89.113（老板需求 3）：城防的智谋项迁往**城主**（守将从此只管征兵与对阵） */
    var mbc = GAME.mayorBonus(city);
    if (mbc.name) base = Math.round(base * (1 + Math.min(1.0, mbc.def))); // 城主智谋：城防
    return base;"""
d = sub_txt(d, a, b, 'A6 cityDefenseBase')

rw(dp, d, 'domain.v89112.js')
print('A. domain.js：城主+分工 6 组改动已落盘')

# ============================================================
# B. state.js（prodFactors）
# ============================================================
sp = os.path.join(R, 'js', 'state.js')
s = io.open(sp, encoding='utf-8').read()
a = """    var gbProd = GAME.guardBonus ? GAME.guardBonus(city) : { prod: 0 };
    if (gbProd.prod) list.push({ name: '守将内政', d: gbProd.prod });"""
b = """    /* v89.113（老板需求 3）：产量走**城主**内政（守将的 nz 加成已随分职迁出） */
    var mbProd = GAME.mayorBonus ? GAME.mayorBonus(city) : { prod: 0 };
    if (mbProd.prod) list.push({ name: '城主内政', d: mbProd.prod });"""
s = sub_txt(s, a, b, 'B1 prodFactors')
rw(sp, s, 'state.v89112.js')
print('B. state.js：prodFactors 已切城主')

# ============================================================
# C. systems.js（研究）
# ============================================================
yp = os.path.join(R, 'js', 'systems.js')
y = io.open(yp, encoding='utf-8').read()
a = """    if (GAME.guardBonus) {
      var _gcity = (cityId ? GAME.cityById(cityId) : null) || GAME.currentCity();
      var _gb = GAME.guardBonus(_gcity);
      if (_gb.research) time = Math.round(time / (1 + Math.min(1.5, _gb.research))); // 守将智谋：研究加速
    }"""
b = """    /* v89.113（老板需求 3）：研究加速走**城主**智谋（守将不再管研究） */
    if (GAME.mayorBonus) {
      var _gcity = (cityId ? GAME.cityById(cityId) : null) || GAME.currentCity();
      var _mb = GAME.mayorBonus(_gcity);
      if (_mb.research) time = Math.round(time / (1 + Math.min(1.5, _mb.research))); // 城主智谋：研究加速
    }"""
y = sub_txt(y, a, b, 'C1 research')
rw(yp, y, 'systems.v89112.js')
print('C. systems.js：研究加速已切城主')

# ============================================================
# D. main.js（doAssignMayor + case）
# ============================================================
mp = os.path.join(R, 'js', 'main.js')
m = io.open(mp, encoding='utf-8').read()
a = """  /* --------- 野地采集（v15） --------- */"""
b = """  /* v89.113（老板需求 3）：任命城主（与守将同构 —— 点一下任命/再点解除） */
  GAME.doAssignMayor = function (genId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    var r = GAME.assignGeneral(genId, g && g.status === 'mayor' ? 'idle' : 'mayor', GAME.currentCity().id);
    ui.toast(r.msg);
    GAME.refreshAll();
  };
  /* --------- 野地采集（v15） --------- */"""
m = sub_txt(m, a, b, 'D1 doAssignMayor')

a = """      case 'assign-guard': GAME.doAssignGuard(el.dataset.gen); break;"""
b = """      case 'assign-guard': GAME.doAssignGuard(el.dataset.gen); break;
      case 'assign-mayor': GAME.doAssignMayor(el.dataset.gen); break;   /* v89.113 城主 */"""
m = sub_txt(m, a, b, 'D2 case')
rw(mp, m, 'main.v89112.js')
print('D. main.js：城主动作已接线')

# ============================================================
# E. ui.js
# ============================================================
up = os.path.join(R, 'js', 'ui.js')
u = io.open(up, encoding='utf-8').read()

# E1：GEN_DIMS —— zm/nz 的 guardUse → mayorUse（城主），yw 保留 guardUse（守将）
a = """    { k: 'zm', n: '智谋', color: '#4a9be0',
      use: '全军防御 +0.05%/点（每20点+1%）',
      guardUse: function (gb) {
        var p2 = [];
        if (gb.research) p2.push('研究 +' + Math.round(gb.research * 100) + '%');
        if (gb.def) p2.push('城防 +' + Math.round(gb.def * 100) + '%');
        return p2.length ? '守将加成：' + p2.join(' ') : '';
      } },
    { k: 'nz', n: '内政', color: '#7fa85a', use: '本城产量 +1%',
      guardUse: function (gb) {
        var p2 = [];
        if (gb.prod) p2.push('产量 +' + Math.round(gb.prod * 100) + '%');
        if (gb.build) p2.push('建造 +' + Math.round(gb.build * 100) + '%');
        return p2.length ? '守将加成：' + p2.join(' ') : '';
      } },"""
b = """    { k: 'zm', n: '智谋', color: '#4a9be0',
      use: '全军防御 +0.05%/点（每20点+1%）',
      /* v89.113（老板需求 3）：智谋的经营项归**城主**（研究/城防） */
      mayorUse: function (mb) {
        var p2 = [];
        if (mb.research) p2.push('研究 +' + Math.round(mb.research * 100) + '%');
        if (mb.def) p2.push('城防 +' + Math.round(mb.def * 100) + '%');
        return p2.length ? '城主加成：' + p2.join(' ') : '';
      } },
    { k: 'nz', n: '内政', color: '#7fa85a', use: '本城产量 +1%',
      /* v89.113：内政的经营项归**城主**（产量/建造） */
      mayorUse: function (mb) {
        var p2 = [];
        if (mb.prod) p2.push('产量 +' + Math.round(mb.prod * 100) + '%');
        if (mb.build) p2.push('建造 +' + Math.round(mb.build * 100) + '%');
        return p2.length ? '城主加成：' + p2.join(' ') : '';
      } },"""
u = sub_txt(u, a, b, 'E1 GEN_DIMS')

# E2：gbNow → gbNow + mbNow
a = """    var gbNow = (g.status === 'guard' && GAME.guardBonus)
      ? GAME.guardBonus(GAME.cityById(g.cityId) || GAME.currentCity()) : null;"""
b = """    var gbNow = (g.status === 'guard' && GAME.guardBonus)
      ? GAME.guardBonus(GAME.cityById(g.cityId) || GAME.currentCity()) : null;
    /* v89.113（老板需求 3）：该将现任城主时的**城主加成**（与守将并行、互斥） */
    var mbNow = (g.status === 'mayor' && GAME.mayorBonus)
      ? GAME.mayorBonus(GAME.cityById(g.cityId) || GAME.currentCity()) : null;"""
u = sub_txt(u, a, b, 'E2 mbNow')

# E3：extra 计算（城主优先，其次守将）
a = """          var tip74 = '每点作用：' + d.use;
          var extra = (gbNow && d.guardUse) ? d.guardUse(gbNow) : '';"""
b = """          var tip74 = '每点作用：' + d.use;
          var extra = (mbNow && d.mayorUse) ? d.mayorUse(mbNow)
            : ((gbNow && d.guardUse) ? d.guardUse(gbNow) : '');"""
u = sub_txt(u, a, b, 'E3 extra')

# E4：将领卡加"任命城主"按钮（挨着守将按钮）
a = """        '<span class="gp-ops">' +
          '<button class="btn sm' + (g.status === 'guard' ? ' red' : ' gold') + '" data-action="assign-guard" data-gen="' + genId + '">' +
            (g.status === 'guard' ? '解除守将' : '任命守将') + '</button>' +"""
b = """        '<span class="gp-ops">' +
          '<button class="btn sm' + (g.status === 'guard' ? ' red' : ' gold') + '" data-action="assign-guard" data-gen="' + genId + '">' +
            (g.status === 'guard' ? '解除守将' : '任命守将') + '</button>' +
          /* v89.113（老板需求 3）：城主（与守将同级）—— 一人一职，换职自动卸旧职 */
          '<button class="btn sm' + (g.status === 'mayor' ? ' red' : '') + '" data-action="assign-mayor" data-gen="' + genId + '">' +
            (g.status === 'mayor' ? '解除城主' : '任命城主') + '</button>' +"""
u = sub_txt(u, a, b, 'E4 将领卡按钮')

# E5：状态文案
a = """  ui.genStatusName = function (g) {
    if (!g) return '';
    return g.status === 'guard' ? '守将' : g.status === 'march' ? '出征中'
      : g.status === 'gather' ? '采集中' : '空闲';
  };
  ui.genStatusCls = function (g) {
    if (!g) return '';
    return g.status === 'guard' ? 'st-guard' : g.status === 'idle' ? '' : 'st-busy';
  };"""
b = """  ui.genStatusName = function (g) {
    if (!g) return '';
    return g.status === 'guard' ? '守将' : g.status === 'mayor' ? '城主'
      : g.status === 'march' ? '出征中'
      : g.status === 'gather' ? '采集中' : '空闲';
  };
  ui.genStatusCls = function (g) {
    if (!g) return '';
    return (g.status === 'guard' || g.status === 'mayor') ? 'st-guard'
      : g.status === 'idle' ? '' : 'st-busy';
  };"""
u = sub_txt(u, a, b, 'E5 状态文案')

rw(up, u, 'ui.v89112.js')
print('E. ui.js：5 组改动已落盘（城池面板/烽火页见下一批）')
print('（下一步：门禁 + 城池面板城主行 + 烽火页城主列）')
