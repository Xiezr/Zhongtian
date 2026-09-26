# -*- coding: utf-8 -*-
"""v89.126 补丁 E：smoke 新增 §106（劳作占用：满配 12.5% / 比例 / 可征 / 守卫真调）"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'smoke-test.js')
s = io.open(P, encoding='utf-8').read()

anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1, '结果锚点计数 %d' % s.count(anchor)

block = r'''  /* ═══════════════════════════════════════════════════════════
   * §106（v89.126）劳作占用：非民房建筑占人口（满配 = 上限 × fullPct）
   * ------------------------------------------------------------
   * 老板令：「让除民房以外的建筑（城内，城墙，城外）分别固定占用部分
   * 人口额（劳作），这部分人口不能用于征兵；满配建筑下占 10%-15%」。
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    function mkFull106(type, lv) {
      var cells = [{ build: { id: 'guanfu', lvl: lv } }];
      ['shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku', 'yizhan', 'fenghuotai', 'majiu',
        'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'chengqiang']
        .forEach(function (b) { cells.push({ build: { id: b, lvl: lv } }); });
      for (var i = 0; i < 25; i++) cells.push({ build: { id: 'minfang', lvl: lv } });
      var extGrid = [];
      var n = DATA.EXT_CAP_BY_LV[Math.min(lv - 1, DATA.EXT_CAP_BY_LV.length - 1)];
      for (var j = 0; j < n; j++) extGrid.push({ type: 'farm', lv: lv });
      return { id: 'f106' + type + lv, type: type, cells: cells, extGrid: extGrid };
    }
    /* ① 五类城池满配 → 占比恰 = fullPct（12.5%，老板区间 10%-15% 中值） */
    var pct106 = [];
    [['self', 12], ['county', 12], ['jun', 16], ['zhou', 20], ['capital', 24]].forEach(function (t) {
      var cc = mkFull106(t[0], t[1]);
      var cap = G.maxPopOf(cc);
      pct106.push(cap > 0 ? G.popLaborOf(cc) / cap : -1);
    });
    var fp106 = (DATA.POP_LABOR || {}).fullPct || 0.125;
    check('§106① 满配占比：五类城池全部 = fullPct（' + (fp106 * 100) + '%）',
      pct106.length === 5 && pct106.every(function (p) { return Math.abs(p - fp106) < 1e-3; }),
      pct106.map(function (p) { return (p * 100).toFixed(2) + '%'; }).join(' / '));
    /* ② 未满配按级数比例（城外减半 → 占用约一半） */
    var c2_106 = mkFull106('self', 12);
    c2_106.extGrid = c2_106.extGrid.slice(0, Math.floor(c2_106.extGrid.length / 2));
    var half106 = G.popLaborOf(c2_106);
    var full106 = G.popLaborOf(mkFull106('self', 12));
    check('§106② 未满配按比例：一半级数 → 占用约一半',
      half106 > 0 && Math.abs(half106 / full106 - 0.5) < 0.02,
      half106 + ' / ' + full106 + ' = ' + (half106 / full106 * 100).toFixed(1) + '%');
    /* ③ 可征 = 人口 − 劳作（唯一出口 popFreeOf；人口 < 劳作 → 0 不为负） */
    var keep106 = G.state;
    var st106 = G.newGame({ name: 'v126e', cityName: '许都' });
    G.state = st106;
    var c106 = st106.cities[0];
    var fullCells = mkFull106('self', 12);
    c106.cells = fullCells.cells; c106.extGrid = fullCells.extGrid;
    var labor106 = G.popLaborOf(c106);
    c106.res.pop = labor106 + 500;
    var ok3a = G.popFreeOf(c106) === 500;
    c106.res.pop = Math.max(0, labor106 - 1);
    var ok3b = G.popFreeOf(c106) === 0;
    check('§106③ 可征 = 人口 − 劳作（popFreeOf 唯一出口，下限 0）', ok3a && ok3b,
      'labor=' + labor106);
    /* ④ 守卫真调：可征内 OK / 超可征被拦（msg 含"可征人口不足"与劳作说明） */
    st106.res.grain = 1e9; st106.res.wood = 1e9; st106.res.iron = 1e9;
    st106.res.stone = 1e9; st106.res.gold = 1e9;
    c106.res.pop = labor106 + 300;                    /* 可征 300 */
    var rOK106 = G.train('yibing', 300, c106.id);
    var rNo106 = G.train('yibing', 1, c106.id);       /* 可征已耗尽 → 拦 */
    check('§106④ 真调募兵：可征内 OK / 超可征被拦（含劳作说明）',
      rOK106.ok === true && rNo106.ok === false && /可征人口不足/.test(rNo106.msg || ''),
      'ok=' + rOK106.ok + ' / 拦=' + rNo106.ok + '｜' + String(rNo106.msg).slice(0, 52));
    /* ⑤ 劳作只约束征兵 —— 增长公式不受影响（仍 = 上限 ÷ fillHours） */
    check('§106⑤ 劳作不动增长：popGrowthOf = 上限 ÷ fillHours（不受劳作影响）',
      Math.abs(G.popGrowthOf(c106) - G.maxPopOf(c106) / (DATA.POP_CFG.fillHours || 2)) < 1e-9);
    G.state = keep106;
  })();

'''
s = s.replace(anchor, block + anchor)
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:300]
print('✓ smoke 补丁 E 完成（新增 §106 五条）')
