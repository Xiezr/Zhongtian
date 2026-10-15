# -*- coding: utf-8 -*-
"""v89.128 补丁 G：需求 3+4 —— 建造时间重设计
   ① data.js：新增 DATA.BUILD_TIME_H_MAX + DATA.buildTimeSec（唯一出口）+ costTable 时间列走曲线
   ② data.js：16 个 levelCost 调用点补 bid 参数（括号配平扫描，防插错位）
   ③ domain.js：extBuildCost 时间列同走曲线
   ⚠ newline='' 保持 LF
"""
import io

R = 'E:/Deepseekdb/'
n = 0


def do_file(fname, edits):
    P = R + fname
    s = io.open(P, encoding='utf-8', newline='').read()
    orig = s
    for old, new, tag in edits:
        assert s.count(old) == 1, '[%s] %s 锚点 %d 个' % (fname, tag, s.count(old))
        s = s.replace(old, new)
        print('  ✓ [%s] %s' % (fname, tag))
    assert s != orig

    def bal(x):
        return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))
    assert bal(s) == bal(orig), '[%s] 括号盈亏变化 %s vs %s' % (fname, bal(s), bal(orig))
    io.open(P, 'w', encoding='utf-8', newline='').write(s)


# ════════ data.js ════════
P = R + 'js/data.js'
s = io.open(P, encoding='utf-8', newline='').read()

# ── ① costTable 改造（签名 + 时间列覆盖）──
old1 = """  function costTable(arr) {
    /* [粮,木,石,铁,秒] 数组 -> 升到第 lv+1 级的费用。
       表长不足 MAX_LEVEL_ABS（= 基准 12 + 名城最高加成 12 = 24）时自动外推（见上）。
       v54：这里从 MAX_BLEVEL 改成 MAX_LEVEL_ABS —— 都城的官府/兵营要能盖到 24 级，
       表短了会走到 `if (!r) return null`，表现为"升级按钮忽然消失"。
       v89.104：**Lv12 之后资源封顶**（见上面 DATA.JEWEL_COST 的注释）+ 珠宝需求。 */
    var rows = extRows(arr, DATA.MAX_LEVEL_ABS);
    var freezeAt = (DATA.JEWEL_COST && DATA.JEWEL_COST.fromLevel) || 12;
    return function (lv) {
      var r = (lv >= freezeAt) ? rows[freezeAt - 1] : rows[lv];   /* 封顶：用「12→13」那一档 */
      if (!r) return null;
      var o = { grain: r[0], wood: r[1], stone: r[2], iron: r[3] };
      o.time = r[4];
      var jw = DATA.jewelCostAt(lv);
      if (jw) o.jewel = jw;
      return o;
    };
  }"""
new1 = """  function costTable(arr, bid) {
    /* [粮,木,石,铁,秒] 数组 -> 升到第 lv+1 级的费用。
       表长不足 MAX_LEVEL_ABS（= 基准 12 + 名城最高加成 12 = 24）时自动外推（见上）。
       v54：这里从 MAX_BLEVEL 改成 MAX_LEVEL_ABS —— 都城的官府/兵营要能盖到 24 级，
       表短了会走到 `if (!r) return null`，表现为"升级按钮忽然消失"。
       v89.104：**Lv12 之后资源封顶**（见上面 DATA.JEWEL_COST 的注释）+ 珠宝需求。
       v89.128：**时间列不再用行里的手写值、也不再封顶** —— 一律走 buildTimeSec 曲线
       （12 级循环 + 单次 ≤24h；行数组第 5 列成为历史遗迹，仅作对照参考）。 */
    var rows = extRows(arr, DATA.MAX_LEVEL_ABS);
    var freezeAt = (DATA.JEWEL_COST && DATA.JEWEL_COST.fromLevel) || 12;
    return function (lv) {
      var r = (lv >= freezeAt) ? rows[freezeAt - 1] : rows[lv];   /* 资源封顶：用「12→13」那一档 */
      if (!r) return null;
      var o = { grain: r[0], wood: r[1], stone: r[2], iron: r[3] };
      o.time = buildTimeSec(bid, lv);   /* v89.128：时间列 = 曲线（唯一出口） */
      var jw = DATA.jewelCostAt(lv);
      if (jw) o.jewel = jw;
      return o;
    };
  }"""
assert s.count(old1) == 1, 'costTable 锚点 %d' % s.count(old1)
s = s.replace(old1, new1)
print('  ✓ [data.js] costTable 改造')

# ── ② 插入曲线表与出口（在 costTable 之前）──
anchor2 = '  function costTable(arr, bid) {'
curve = """  /* ============================================================
   * v89.128（老板 需求 3/4）：「建造时间不友好（官府 11-12 要 37 天）…最长不要超过
   *   48h；每 12 级循环使用建造时长（13-24 级分别使用 1-12 级的时长，类推）」
   *   「使单次建造用时不超过 24，且各建筑之间有区分度」——**建造时间曲线**：
   * ------------------------------------------------------------
   * 唯一出口 `buildTimeSec(bid, lv)` = T_max × ((k+1)/12)^1.5，k = lv % 12
   *   · **1 倍速基准**（1 现实秒 = 1 游戏秒；倍速只缩短现实等待，不参与设计）；
   *   · 序号语义：`lv` = 升级前等级（0 = 建造），返回"升到 lv+1 级"的耗时（游戏秒）；
   *   · **12 级循环**：升到 13 级用升到 1 级的时长、…、升到 24 级用升到 12 级的；
   *     25-36 再循环，37-45 用前 9 档 —— 高等级不再"越等越久"；
   *   · 曲线为舒缓递增（1.5 次幂），起点 = T_max/41.6、终点 = T_max；
   *   · **单次上限**：最重建筑（官府 T_max 18h）≤ 24h（老板硬上限）；
   *   · **区分度** = 各建筑自己的 T_max（官府 18h → 校场 5h，见下表）。
   * ⚠ 资源列**不循环**（保持 v89.104 的 12 级后封顶）——"高等级持续高投入"不变。
   * ============================================================ */
  DATA.BUILD_TIME_H_MAX = {
    guanfu: 18, honglusi: 15, shichang: 12, junying: 11, shuyuan: 11,
    chengqiang: 10, zhaoxianguan: 9, gongjiangzuofang: 9,
    cangku: 8, yizhan: 8, fenghuotai: 8,
    tiejiangpu: 7, majiu: 6, kezhan: 6, minfang: 6, xiaochang: 5,
    /* 城外资源地块（4 座同类，同级同价便于对比） */
    farm: 6, forest: 6, quarry: 6, mine: 6,
  };
  function buildTimeSec(bid, lv) {
    var h = DATA.BUILD_TIME_H_MAX[bid] || 6;
    var k = ((lv % 12) + 12) % 12;
    return Math.round(h * 3600 * Math.pow((k + 1) / 12, 1.5));
  }
  DATA.buildTimeSec = buildTimeSec;   /* 城外（domain.extBuildCost）与工具同读此出口 */
"""
assert s.count(anchor2) == 1
s = s.replace(anchor2, curve + anchor2)
print('  ✓ [data.js] 曲线表与出口')

# ── ③ 16 个 levelCost 调用点补 bid（括号配平扫描）──
BIDS = ['guanfu', 'minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku',
        'chengqiang', 'yizhan', 'fenghuotai', 'majiu', 'kezhan', 'zhaoxianguan',
        'honglusi', 'tiejiangpu', 'gongjiangzuofang']
for bid in BIDS:
    i = s.index('    ' + bid + ': {')
    j = s.index('costTable(', i)
    k = j + len('costTable(')
    depth = 1
    while depth > 0:
        ch = s[k]
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        k += 1
    # k 指向匹配 ')' 之后一位 → 在 ')' 前插入
    s = s[:k - 1] + ", '" + bid + "'" + s[k - 1:]
    print('  ✓ [data.js] costTable(…, %s)' % bid)

# 写前自检
def bal(x):
    return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))


assert bal(s) == bal(io.open(P, encoding='utf-8', newline='').read()), '括号盈亏变化'
assert "buildTimeSec(bid, lv)" in s and "DATA.buildTimeSec = buildTimeSec;" in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('  ✓ data.js 写盘完成')

# ════════ domain.js ════════
do_file('js/domain.js', [
    ("""    if (!r) return null;
    return { grain: r[0], wood: r[1], stone: r[2], iron: r[3], time: r[4] };""",
     """    if (!r) return null;
    /* v89.128：时间列走**曲线**（12 级循环 + 单次 ≤24h）——与城内同一出口 */
    return { grain: r[0], wood: r[1], stone: r[2], iron: r[3],
      time: DATA.buildTimeSec ? DATA.buildTimeSec(eid, lv) : r[4] };""",
     'extBuildCost 时间曲线'),
])

print('patch G OK')
