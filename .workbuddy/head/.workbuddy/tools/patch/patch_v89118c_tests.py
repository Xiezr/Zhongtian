# -*- coding: utf-8 -*-
"""
patch_v89118c_tests.py — v89.118 测试口径升级（smoke + e2e）

对应本轮四条改动的断言升级 + 新增：
  · 倒挂断言：象兵列入"坦度特化"（血牛：hp/pop 最高，攻低是取舍）
  · 规则块/烽火流水：从军务·烽火 → 自动化·外敌来犯（判据换新落点）
  · 收编人口：改为与 GAME.captivePopOf 同口径
  · 象兵：改为"不设克制（正常攻防）"的正向判据
  · 自动化名单：六项 → 七项（含 invasion）
"""
import io, os, sys

R = 'E:/Deepseekdb/'
files = {}


def load(p):
    if p not in files:
        files[p] = io.open(R + p, encoding='utf-8').read()
    return files[p]


def edit(path, old, new, tag):
    s = load(path)
    n = s.count(old)
    if n != 1:
        print('!! [%s] 锚点匹配 %d 次（应为 1）→ 中止' % (tag, n))
        sys.exit(1)
    files[path] = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


# ================================================================
# 1. smoke：倒挂断言 —— 象兵列入坦度特化
# ================================================================
edit('smoke-test.js',
"""  var specialists = ['gongjian', 'chuangnu', 'toudan', 'daodun', 'chongche',
    'minfu', 'zhouche', 'chihou',
    /* 义兵 = 入门民兵，定位就是"便宜量大"，不参与阶梯判据 */
    'yibing'];""",
"""  var specialists = ['gongjian', 'chuangnu', 'toudan', 'daodun', 'chongche',
    'minfu', 'zhouche', 'chihou',
    /* 义兵 = 入门民兵，定位就是"便宜量大"，不参与阶梯判据 */
    'yibing',
    /* v89.118：南疆象兵 = **坦度特化**（血牛重坦）——hp/pop 骑兵族最高（3000），
       攻低是有意取舍；老板令"不设克制、正常攻防"后按 probe_v89118_elephant 标定。 */
    'nanjiangxiangbing'];""",
'D1 倒挂断言·象兵特化')

# ================================================================
# 2. smoke：规则块新落点（结构断言）
# ================================================================
edit('smoke-test.js',
"""      check('结构：烽火页顶部含「来犯 · 触发与规则」块（字段与 DATA.INVASION 同源）', (function () {
        var i0 = us93.indexOf('ui.marchBeaconHTML = function');
        var seg = us93.slice(i0, i0 + 3200);
        return /来犯 · 触发与规则/.test(seg) && /I\\.sources/.test(seg) && /I\\.unlockCities/.test(seg)
          && /I\\.realMin/.test(seg) && /I\\.ratioMin/.test(seg) && /I\\.warnMin/.test(seg);
      })());""",
"""      /* v89.118（老板需求 3）：规则块从烽火页**迁到「自动化 · 外敌来犯」**（与开关同页）——
         判据改查新落点 ui.invasionRulesHTML（同一件事的新家，字段仍与 DATA.INVASION 同源）。 */
      check('结构：「来犯 · 触发与规则」块在自动化面板（字段与 DATA.INVASION 同源）', (function () {
        var i0 = us93.indexOf('ui.invasionRulesHTML = function');
        var seg = us93.slice(i0, i0 + 3200);
        /* 烽火页只剩预警与布防：正向判据 = 指路行在页里；且该页开头一段不再出现规则字段 */
        var b0 = us93.indexOf('ui.marchBeaconHTML = function');
        var bseg = us93.slice(b0, b0 + 2400);
        return i0 >= 0 && /来犯 · 触发与规则/.test(seg) && /I\\.sources/.test(seg) && /I\\.unlockCities/.test(seg)
          && /I\\.realMin/.test(seg) && /I\\.ratioMin/.test(seg) && /I\\.warnMin/.test(seg)
          && /自动化 · 外敌来犯/.test(bseg) && !/I\\.sources/.test(bseg);
      })());""",
'D2 规则块新落点')

# ================================================================
# 3. smoke §92：⑥ 规则块判据（渲染层）
# ================================================================
edit('smoke-test.js',
"""      /* ⑥ 烽火页（规则块与预警表都改现实时间口径） */
      var pg92 = G.ui.marchBeaconHTML();
      check('⑥ 烽火页：规则块含"每 30 分钟"与"现实时间"',
        pg92.indexOf('来犯 · 触发与规则') >= 0 && pg92.indexOf('每 <b>30 分钟</b>') >= 0
        && pg92.indexOf('现实时间') >= 0);""",
"""      /* ⑥ v89.118（老板需求 3）：规则块迁到「自动化 · 外敌来犯」——判据改查新落点。
         同时验烽火页只剩预警与布防（指路行在、规则字段不在）。 */
      var pg92 = G.ui.invasionRulesHTML();
      var pgB92 = G.ui.marchBeaconHTML();
      check('⑥ 自动化·外敌来犯：规则块含"每 30 分钟"与"现实时间"',
        pg92.indexOf('来犯 · 触发与规则') >= 0 && pg92.indexOf('每 <b>30 分钟</b>') >= 0
        && pg92.indexOf('现实时间') >= 0);
      check('⑥ 烽火页精简为「预警 + 布防」（规则块与流水已迁走，留指路行）',
        pgB92.indexOf('自动化 · 外敌来犯') >= 0
        && pgB92.indexOf('来犯 · 触发与规则') < 0
        && pgB92.indexOf('bb-line beacon') < 0);""",
'D3 §92 规则块判据')

# ================================================================
# 4. smoke：D 实战集成 —— 收编人口新口径
# ================================================================
edit('smoke-test.js',
"""      var cap = r.result.captives;
      /* v89.116：人口不再当场增加 —— 先入俘虏营（逐兵种），收编那一刻才加人口 */
      var campN = GAME.captivesTotalOf();
      var byN = 0;
      for (var _bk in ((cap && cap.byType) || {})) byN += cap.byType[_bk];
      var cons = GAME.doConscriptCaptives(c99.id);
      window.__cap99 = '俘获 ' + (cap ? cap.gain : 0) + ' 人（拆分 ' + byN + '）→ 营 ' + campN
        + ' → 收编后人口 ' + Math.round(Rr.pop);
      return !!cap && cap.gain > 0 && byN === cap.gain && campN === cap.gain
        && cons.ok && Rr.pop === 1000 + cap.gain""",
"""      var cap = r.result.captives;
      /* v89.116：人口不再当场增加 —— 先入俘虏营（逐兵种），收编那一刻才加人口。
         v89.118：人口增量按**兵种 pop 折算**（GAME.captivePopOf 唯一出口）。 */
      var campN = GAME.captivesTotalOf();
      var byN = 0;
      for (var _bk in ((cap && cap.byType) || {})) byN += cap.byType[_bk];
      var wantPop = GAME.captivePopOf();          /* 收编前算：= Σ(兵种数量 × pop) */
      var cons = GAME.doConscriptCaptives(c99.id);
      window.__cap99 = '俘获 ' + (cap ? cap.gain : 0) + ' 人（拆分 ' + byN + '）→ 营 ' + campN
        + ' → 折算人口 ' + wantPop + ' → 收编后人口 ' + Math.round(Rr.pop);
      return !!cap && cap.gain > 0 && byN === cap.gain && campN === cap.gain
        && cons.ok && cons.pop === wantPop && Rr.pop === 1000 + wantPop""",
'D4 收编人口口径')

# ================================================================
# 5. smoke §96：象兵不设克制
# ================================================================
edit('smoke-test.js',
"""    check('⑨ 南疆象兵不再是"无弱点的骑兵"（并入长枪的攻/防两张表）', (function () {
      var A = D96.COUNTER_ATK.changqiang || {}, Df = D96.COUNTER_DEF.changqiang || {};
      return A.nanjiangxiangbing === 3 && Df.nanjiangxiangbing === 5;
    })());""",
"""    /* v89.118（老板令「象兵不设置克制，正常攻防」）：象兵**不进克制表** ——
       它的强弱只由自身 hp/atk/def 决定（数值按 probe_v89118_elephant 标定：
       对步兵赢但损 15~20%，被同人口西凉铁骑全歼）。
       判据（全部正向）：两张表都没有它 + 它仍是**骑兵族 hp/pop 最高**（血牛定位在数值上成立）。 */
    check('⑨ 南疆象兵不设克制（两张相克表都无它；强度靠自身数值 —— 骑兵族 hp/pop 最高）', (function () {
      var A = D96.COUNTER_ATK.changqiang || {}, Df = D96.COUNTER_DEF.changqiang || {};
      var T = D96.TROOPS, xb = T.nanjiangxiangbing;
      var top = true;
      Object.keys(T).forEach(function (id) {
        if (id === 'nanjiangxiangbing') return;
        if ((T[id].cat || '') !== 'cav') return;         /* 只与骑兵族比（冲车等器械不算） */
        if (T[id].hp / T[id].pop > xb.hp / xb.pop) top = false;
      });
      return A.nanjiangxiangbing === undefined && Df.nanjiangxiangbing === undefined && top;
    })());""",
'D5 象兵不设克制')

# ================================================================
# 6. smoke §96：烽火流水新落点
# ================================================================
edit('smoke-test.js',
"""    check('⑥ 烽火流水在军务·烽火里（窗口 24 条，且与 DATA 表同源）', (function () {
      return G.ui.BEACON_FLOW >= 24
        && /GAME\\.msgsOf\\('beacon'\\)\\.slice\\(0, ui\\.BEACON_FLOW\\)/.test(u96);
    })());""",
"""    /* v89.118（老板需求 3）：流水从军务·烽火**迁到「自动化 · 外敌来犯」**（与开关同页） */
    check('⑥ 烽火流水在「自动化 · 外敌来犯」里（窗口 24 条，且与 DATA 表同源）', (function () {
      var i0 = u96.indexOf('ui.autoPaneHTML = function');
      var seg = u96.slice(i0, i0 + 9000);
      return G.ui.BEACON_FLOW >= 24
        && /GAME\\.msgsOf\\('beacon'\\)\\.slice\\(0, ui\\.BEACON_FLOW\\)/.test(u96)
        && u96.indexOf('ui.beaconFlowHTML = function') >= 0
        && seg.indexOf('ui.beaconFlowHTML()') >= 0;      /* pane 里真调用它 */
    })());""",
'D6 流水新落点')

# ================================================================
# 7. e2e：自动化名单六项 → 七项
# ================================================================
edit('e2e-test.js',
"""  check('自动化界面：左名单六项 + 右详情（v89.115 左右分栏）', (function () {
    /* v89.115：整合成「左 1/3 名单 + 右 2/3 详情」，并新增「🏥 自动治疗」。 */
    var items = vc.querySelectorAll('.auto-item');
    return items.length === 6 && !!vc.querySelector('.auto-pane')
      && !!vc.querySelector('[data-action="auto-pick"][data-key="heal"]');
  })());""",
"""  check('自动化界面：左名单七项 + 右详情（v89.115 分栏 · v89.118 加「外敌来犯」）', (function () {
    /* v89.115：整合成「左 1/3 名单 + 右 2/3 详情」，新增「🏥 自动治疗」；
       v89.118：再加「🔥 外敌来犯」（开关 + 介绍 + 烽火流水，从军务·烽火迁来）。 */
    var items = vc.querySelectorAll('.auto-item');
    return items.length === 7 && !!vc.querySelector('.auto-pane')
      && !!vc.querySelector('[data-action="auto-pick"][data-key="heal"]')
      && !!vc.querySelector('[data-action="auto-pick"][data-key="invasion"]');
  })());""",
'D7 e2e 七项')

# ================================================================
# 落盘（原子 + 自检）
# ================================================================
base = {}
for p in files:
    base[p] = io.open(R + '.workbuddy/backup/v89118/' + os.path.basename(p), encoding='utf-8').read()

for p, s in files.items():
    assert '<<<<<<<' not in s, p
    d0 = (s.count('{') - s.count('}')) - (base[p].count('{') - base[p].count('}'))
    if d0 != 0:
        print('!! %s 花括号净变化 %+d → 中止' % (p, d0))
        sys.exit(1)
    tmp = R + p + '.tmp118c'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s（净 %+d）' % (p, d0))
print('补丁 D 完成')
