# -*- coding: utf-8 -*-
"""v89.126 补丁 K：smoke 城墙消费类断言升级
① 守备力/战损：摆 c.wallLv → 摆城墙格（_wallSet）
② bldg-foot 计数 6 → 5（城墙面板并入通用）
③ op-row-between 计数 2 → 1（同上）
④ npcCityShadow：sh.wallLv === bl → 城墙格等级 === bl
"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'smoke-test.js')
s = io.open(P, encoding='utf-8').read()

# ① 守备力/战损
old1 = """    /* ---- ★ 核心一：城防真的被消费（不再是死显示）---- */
    var d0, d12;
    c.wallLv = 0;  d0 = G.defensePowerOf(c);
    c.wallLv = 12; d12 = G.defensePowerOf(c);
    check('★ 城墙 Lv0→12 守备力真的变了（城防被消费，不是只进显示）',
      d12 > d0 * 1.3, d0 + ' → ' + d12);

    /* 快照/还原：invasionResolve 会改 city，连调两次会叠加 */
    var snap = function () {
      return { army: JSON.parse(JSON.stringify(c.army)), wall: c.wallLv,
               res: JSON.parse(JSON.stringify(G.res(c))), rep: st.rep };
    };
    var back = function (s0) {
      c.army = JSON.parse(JSON.stringify(s0.army)); c.wallLv = s0.wall; st.rep = s0.rep;
      var R = G.res(c); for (var k in R) { if (R.hasOwnProperty(k)) delete R[k]; }
      for (var k2 in s0.res) R[k2] = s0.res[k2];
    };
    var s0 = snap();
    c.wallLv = 0;  var r0  = G.invasionResolve(c); back(s0);
    c.wallLv = 12; var r12 = G.invasionResolve(c); back(s0);
    check('★ 同一来袭规模下，城墙等级真的改变战损（不只是显示值）',
      r0.severity !== r12.severity || r0.held !== r12.held,
      'Lv0 sev=' + r0.severity.toFixed(3) + ' / Lv12 sev=' + r12.severity.toFixed(3));

    /* ---- ★ 核心二：兵力越集中，战损越小（收拢 vs 分散）---- */
    c.wallLv = 0;"""
new1 = """    /* ---- ★ 核心一：城防真的被消费（不再是死显示）----
       v89.126：城墙占格 —— 摆"格子里的城墙等级"（原 `c.wallLv` 摆法已退役） */
    var _wallSet = function (cc, lv) {
      var wi = (G.wallCellIdxOf ? G.wallCellIdxOf(cc) : -1);
      if (wi >= 0) cc.cells[wi].build = null;   /* 先清旧城墙格 */
      if (lv > 0) {
        var slot = -1;
        for (var i = 0; i < cc.cells.length; i++) {
          var x = cc.cells[i];
          if (!x.build && !x.official && !x.pending) { slot = i; break; }
        }
        if (slot >= 0) cc.cells[slot].build = { id: 'chengqiang', lvl: lv };
      }
    };
    var d0, d12;
    _wallSet(c, 0);  d0 = G.defensePowerOf(c);
    _wallSet(c, 12); d12 = G.defensePowerOf(c);
    check('★ 城墙 Lv0→12 守备力真的变了（城防被消费，不是只进显示）',
      d12 > d0 * 1.3, d0 + ' → ' + d12);

    /* 快照/还原：invasionResolve 会改 city，连调两次会叠加 */
    var snap = function () {
      return { army: JSON.parse(JSON.stringify(c.army)),
               res: JSON.parse(JSON.stringify(G.res(c))), rep: st.rep };
    };
    var back = function (s0) {
      c.army = JSON.parse(JSON.stringify(s0.army)); st.rep = s0.rep;
      var R = G.res(c); for (var k in R) { if (R.hasOwnProperty(k)) delete R[k]; }
      for (var k2 in s0.res) R[k2] = s0.res[k2];
    };
    var s0 = snap();
    _wallSet(c, 0);  var r0  = G.invasionResolve(c); back(s0);
    _wallSet(c, 12); var r12 = G.invasionResolve(c); back(s0);
    check('★ 同一来袭规模下，城墙等级真的改变战损（不只是显示值）',
      r0.severity !== r12.severity || r0.held !== r12.held,
      'Lv0 sev=' + r0.severity.toFixed(3) + ' / Lv12 sev=' + r12.severity.toFixed(3));

    /* ---- ★ 核心二：兵力越集中，战损越小（收拢 vs 分散）---- */
    _wallSet(c, 0);"""
assert s.count(old1) == 1, '锚点①计数 %d' % s.count(old1)
s = s.replace(old1, new1)

# ② bldg-foot 计数
old2 = """    check('建筑详情弹窗统一用 bldg-foot 底栏（城内×2 / 城外×2 / 城墙×2）',
      (u56.match(/class="bldg-foot"/g) || []).length >= 6,
      (u56.match(/class="bldg-foot"/g) || []).length + ' 处');"""
new2 = """    check('建筑详情弹窗统一用 bldg-foot 底栏（城内×2 / 城外×2；城墙面板已并入通用）',
      (u56.match(/class="bldg-foot"/g) || []).length >= 5,
      (u56.match(/class="bldg-foot"/g) || []).length + ' 处');"""
assert s.count(old2) == 1, '锚点②计数 %d' % s.count(old2)
s = s.replace(old2, new2)

# ③ op-row-between 计数
old3 = """    check('★ 升级行统一：费用与按钮同行（op-row-between 余 2 处：城外/城墙）',
      (u56.match(/op-row op-row-between/g) || []).length >= 2,
      (u56.match(/op-row op-row-between/g) || []).length + ' 处');"""
new3 = """    check('★ 升级行统一：费用与按钮同行（op-row-between ≥1 处：城外；城墙并入通用后不再独有）',
      (u56.match(/op-row op-row-between/g) || []).length >= 1,
      (u56.match(/op-row op-row-between/g) || []).length + ' 处');"""
assert s.count(old3) == 1, '锚点③计数 %d' % s.count(old3)
s = s.replace(old3, new3)

# ④ npcCityShadow 城墙格等级
old4 = """    var badIn = sh.cells.filter(function (c) { return c.build && c.build.lvl !== bl; }).length;
    var badOut = (sh.extGrid || []).filter(function (e) { return e.lv !== bl; }).length;
    return badIn === 0 && badOut === 0 && sh.wallLv === bl;"""
new4 = """    var badIn = sh.cells.filter(function (c) { return c.build && c.build.lvl !== bl; }).length;
    var badOut = (sh.extGrid || []).filter(function (e) { return e.lv !== bl; }).length;
    /* v89.126：城墙占格 —— "城墙同此"改为查格子里的城墙等级 */
    var wCells = sh.cells.filter(function (c) { return c.build && c.build.id === 'chengqiang'; });
    return badIn === 0 && badOut === 0 && wCells.length === 1 && wCells[0].build.lvl === bl;"""
assert s.count(old4) == 1, '锚点④计数 %d' % s.count(old4)
s = s.replace(old4, new4)

tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:400]
print('✓ smoke 补丁 K 完成（4 组断言升级）')
