# -*- coding: utf-8 -*-
"""v89.194 批次D：将领详情三处 + 月俸 1.5 倍 + 前哨辐射改欧氏圆（显示=判定）"""
import io

R = 'E:/Deepseekdb/'
DATA = R + 'js/data.js'
DOM = R + 'js/domain.js'
UI = R + 'js/ui.js'
HTML = R + 'index.html'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）'); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + '（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    wr(path, s)
    s2 = rd(path)
    assert s2.count(mark) >= 1, tag + ' 写后自检失败'
    print('[ok] ' + tag)

# ─────────────────────────────────────────────
# D1. index.html：按钮左移（130 → 78px = 4 字符）
# ─────────────────────────────────────────────
rep(HTML, 'D1 按钮左移',
'  --gp-ops-shift: 130px;',
'  --gp-ops-shift: 78px;    /* v89.194（老板）：「往左挪一点，相对位置不动」——130→78px（左移 4 字）；两行共用同变量，横位恒定 */',
'--gp-ops-shift: 78px;')

# ─────────────────────────────────────────────
# D2. data.js：GEN_SALARY.dutyMul（城主/守将月俸乘数）
# ─────────────────────────────────────────────
rep(DATA, 'D2 dutyMul',
"""    rankMul: { fan: 1, liang: 1.6, ying: 2.6, ming: 4.2, tian: 7 },
    maxPeriods: 30,      // 离线补结上限（期）：防止长挂后一把扣穿
  };""",
"""    rankMul: { fan: 1, liang: 1.6, ying: 2.6, ming: 4.2, tian: 7 },
    maxPeriods: 30,      // 离线补结上限（期）：防止长挂后一把扣穿
    /* v89.194（老板）：「月俸：XXXX。城主、守将月俸*1.5」——
       在任城主/守将的月俸乘数（唯一出口 GAME.genSalaryOf；结算/合计/详情三处同源）。 */
    dutyMul: 1.5,
  };""",
'dutyMul: 1.5,')

# ─────────────────────────────────────────────
# D3. domain.js：genSalaryOf 加 duty 乘数
# ─────────────────────────────────────────────
rep(DOM, 'D3 genSalaryOf 乘数',
"""    var v = (C.base || 0) + (g.level || 1) * (C.perLevel || 0) + sum * (C.perAttr || 0);
    var mul = (C.rankMul && C.rankMul[g.rank]) || 1;
    return Math.round(v * mul);""",
"""    var v = (C.base || 0) + (g.level || 1) * (C.perLevel || 0) + sum * (C.perAttr || 0);
    var mul = (C.rankMul && C.rankMul[g.rank]) || 1;
    /* v89.194（老板）：「城主、守将月俸*1.5」——在任城主/守将乘数（唯一出口）。 */
    var dutyMul = (g.status === 'mayor' || g.status === 'guard')
      ? (C.dutyMul == null ? 1.5 : C.dutyMul) : 1;
    return Math.round(v * mul * dutyMul);""",
'var dutyMul = (g.status === \'mayor\' || g.status === \'guard\')')

# ─────────────────────────────────────────────
# D4. domain.js：fortAuraAt 判定改欧氏圆（与地图雷达圈"显示=判定"）
# ─────────────────────────────────────────────
rep(DOM, 'D4 fortAuraAt 欧氏',
"""      var d = Math.max(Math.abs((f.x || 0) - x), Math.abs((f.y || 0) - y));
      if (d > GAME.fortRadiusOf(f)) continue;
      if (d < bd || (d === bd && (best === null || k < bestKey))) { bd = d; best = f; bestKey = k; }""",
"""      /* v89.194（老板「渲染一个圆形雷达扫描圈」）：覆盖判定由**切比雪夫（方阵）改欧氏（圆）**——
         与地图雷达圈"显示 = 判定"（圆圈画多大、覆盖就多大；旧方阵的四个角在圈外却有效）。
         ⚠️ 口径变更：同档半径的覆盖面积由 (2r+1)² 缩为 πr²（约 -29%）；半径档位数值未动。
         若要回退：把本段换回 max(|dx|,|dy|) 比较 + map.js 雷达圈改画菱形（见 docs/v89194）。 */
      var _dx194 = (f.x || 0) - x, _dy194 = (f.y || 0) - y;
      var d = _dx194 * _dx194 + _dy194 * _dy194;      /* 距离平方（整数，无浮点误差） */
      var _R194 = GAME.fortRadiusOf(f);
      if (d > _R194 * _R194) continue;
      if (d < bd || (d === bd && (best === null || k < bestKey))) { bd = d; best = f; bestKey = k; }""",
'var _dx194 = (f.x || 0) - x, _dy194 = (f.y || 0) - y;')

# ─────────────────────────────────────────────
# D5. ui.js：statusTag74 —— 城主不再挂标签
# ─────────────────────────────────────────────
rep(UI, 'D5 城主标签退役',
"""    var statusTag74 = (g.status && g.status !== 'idle')
      ? '<span class="gp-stag">' + U.escape(ui.genStatusName(g)) +
        (g.cityId && GAME.cityById(g.cityId) ? '·' + U.escape(GAME.cityById(g.cityId).name) : '') + '</span>'
      : '';""",
"""    /* v89.194（老板）：「在右侧将领详情界面不要城主·XX城这个标签」——
       城主状态不再挂小签（城主身份由下方「解除城主」按钮体现；工资口径另见月俸行 ×1.5）。
       其他状态（守将 / 出征中 / 采集中 / 驻守）保持 v89.113 的"一眼看到"口径。 */
    var statusTag74 = (g.status && g.status !== 'idle' && g.status !== 'mayor')
      ? '<span class="gp-stag">' + U.escape(ui.genStatusName(g)) +
        (g.cityId && GAME.cityById(g.cityId) ? '·' + U.escape(GAME.cityById(g.cityId).name) : '') + '</span>'
      : '';""",
'&& g.status !== \'mayor\')')

# ─────────────────────────────────────────────
# D6. ui.js：attachLines186 未佩分支 —— 备注行退役（来源说明收进按钮悬停）
# ─────────────────────────────────────────────
rep(UI, 'D6 宝具备注行退役',
"""      var pool186 = GAME.attachPoolOf(slot.id);
      return '<span class="gp-sub gp-attach186">' + slot.icon + ' ' + slot.name + ' · <span style="opacity:.65;">'
        + U.escape(slot.empty || '未佩') + '</span>'
        + (pool186.length ? '<button class="btn sm gold" data-action="attach-pick" data-gen="' + genId
          + '" data-slot="' + slot.id + '">佩上（可佩 ' + pool186.length + ' 种）</button>' : '')
        + '</span>';""",
"""      var pool186 = GAME.attachPoolOf(slot.id);
      /* v89.194（老板）：「上方不要这个备注行：宝具 · 未佩宝具（打据点/名城有几率缴获）」
         —— 未佩时的来源说明**备注行整行退役**：无库存时不渲染（行上不再挂长备注）；
         有库存时只留「佩上」按钮，来源说明收进按钮悬停（信息不丢，只是不占行）。 */
      if (!pool186.length) return '';
      return '<span class="gp-sub gp-attach186">' + slot.icon + ' ' + slot.name
        + '<button class="btn sm gold" data-action="attach-pick" data-gen="' + genId
        + '" data-slot="' + slot.id + '" title="' + U.escape(slot.empty || '未佩') + '">佩上（可佩 '
        + pool186.length + ' 种）</button>'
        + '</span>';""",
"if (!pool186.length) return '';")

# ─────────────────────────────────────────────
# D7. ui.js：月俸行（替换"备注行"的位置语义 · 唯一读数 genSalaryOf）
# ─────────────────────────────────────────────
rep(UI, 'D7 月俸行',
"""          ngLine77 +
          attachLines186 +
          '<span class="gp-exprow">' +""",
"""          ngLine77 +
          attachLines186 +
          /* v89.194（老板）：「改一个月俸备注：月俸：XXXX。城主、守将月俸*1.5」——
             读数唯一出口 GAME.genSalaryOf（已含资质倍率与城主/守将 ×1.5）；悬停给构成与结算规则。 */
          '<span class="gp-sub gp-sal194" title="' + U.escape(
            '每 7 游戏日随月俸一并结算（从所在城府库扣；府库不足则欠俸）。\\n'
            + '构成：底俸 ' + ((DATA.GEN_SALARY || {}).base || 0) + ' ＋ 等级×' + ((DATA.GEN_SALARY || {}).perLevel || 0)
            + ' ＋ 四维和×' + ((DATA.GEN_SALARY || {}).perAttr || 0) + '，再乘资质倍率'
            + (g.status === 'mayor' || g.status === 'guard'
              ? '；在任城主/守将另 ×' + ((DATA.GEN_SALARY || {}).dutyMul || 1.5) : '')
            + '。\\n欠俸的城：该城将领忠诚 −10/期（封顶 −20）；忠诚归零则不可出征（赏赐珠宝可安抚）。') + '">'
            + '月俸：' + (GAME.isLordGeneral(g)
              ? '—（君主不领俸）'
              : ('<b>' + U.fmt(GAME.genSalaryOf(g)) + '</b> 金　·　城主、守将 ×'
                + ((DATA.GEN_SALARY || {}).dutyMul || 1.5)))
            + '</span>' +
          '<span class="gp-exprow">' +""",
"'月俸：' + (GAME.isLordGeneral(g)")

print('\n批次 D 全部完成。')
