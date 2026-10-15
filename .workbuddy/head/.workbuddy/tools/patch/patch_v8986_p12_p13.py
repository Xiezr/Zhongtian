# -*- coding: utf-8 -*-
"""v89.86 整改 · P0 显示缺陷：
   P-12 科技面板按钮「研究(NaN粮)」—— v16 改黄金口径后仍读 cost.grain
   P-13 采集派遣面板「有效兵力上限 undefined」—— v29 采力口径后仍读 G.troopCap
口径：按钮主项黄金短写 + title 全价（GAME.costString 唯一渲染口）；
      采集面板全套改「采力」口径，估算走 gatherYield 真尺子（与结算同函数）。
"""
import io
import os
import sys

P = r'E:\Deepseekdb\js\ui.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


# ① P-12：科技按钮改黄金口径
edit(P, r"""      var btn = full ? '<span style="color:var(--text-dim);">已满级</span>' :
        locked ? '<span style="color:var(--red-light);">需书院Lv' + t.lv + '</span>' :
        '<button class="btn sm" data-action="tech-research" data-tech="' + t.id + '"' + (cur ? ' disabled' : '') + '>研究(' + U.fmt(cost.grain) + '粮)</button>';""",
     r"""      var btn = full ? '<span style="color:var(--text-dim);">已满级</span>' :
        locked ? '<span style="color:var(--red-light);">需书院Lv' + t.lv + '</span>' :
        /* v89.86（整改 P-12）：v16 改黄金口径后 `DATA.techCost` 只返回 {gold,wood,stone}，
           这里仍旧读 `cost.grain` → 每个按钮都印成「研究(NaN粮)」。
           现在：主项黄金短写上屏，完整三项费用进 title 悬停（走 GAME.costString 唯一渲染口）。 */
        '<button class="btn sm" data-action="tech-research" data-tech="' + t.id + '"'
          + ' title="需 ' + GAME.costString(cost) + '"'
          + (cur ? ' disabled' : '') + '>研究(黄金 ' + U.fmt(cost.gold) + ')</button>';""",
     'P-12 · 科技按钮黄金口径')

# ② P-13：有效兵力上限（按采力口径真算）
edit(P, r"""    var maxTroop = 0;
    for (var id in (c.army || {})) maxTroop += c.army[id];
    var suggest = Math.min(G.troopCap, maxTroop);""",
     r"""    var maxTroop = 0;
    for (var id in (c.army || {})) maxTroop += c.army[id];
    /* v89.86（整改 P-13）：v29 采集改「采力」口径（powerCap = 30000）后，
       这里仍读 v29 之前就不存在的 `G.troopCap` → 面板印「有效兵力上限 undefined」。
       且"有效上限"本就取决于**兵种构成**（精锐一兵顶四民夫），不是人头。
       口径：按 `autoPickTroops` 的取兵顺序（弱兵先出），采力到达 powerCap 所需的兵力；
       城内全部兵力都到不了上限时，就等于全部兵力。 */
    var effCap = (function () {
      var avail = [];
      for (var idE in (c.army || {})) {
        if (c.army[idE] > 0 && DATA.TROOPS[idE]) avail.push({ id: idE, n: c.army[idE], atk: DATA.TROOPS[idE].atk });
      }
      avail.sort(function (a, b) { return a.atk - b.atk; });   /* 与 autoPickTroops 同一取兵顺序 */
      var p = 0, used = 0;
      for (var iE = 0; iE < avail.length && p < G.powerCap; iE++) {
        var tE = DATA.TROOPS[avail[iE].id];
        var effE = (tE.gather != null ? tE.gather : G.basePerHour);
        var need = Math.ceil((G.powerCap - p) / effE);
        var take = Math.min(avail[iE].n, Math.max(0, need));
        p += take * effE; used += take;
      }
      return used;
    })();
    var suggest = Math.min(effCap, maxTroop);""",
     'P-13 · 有效兵力上限（采力口径）')

# ③ P-13：估算段（收成公式行 / 每千行 / sample）
edit(P, r"""    var perHour = G.basePerHour * (1 + (w.level || 0) * G.levelBonus);
    var sample = Math.min(G.troopCap, suggest || G.troopCap);
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : '';""",
     r"""    /* v89.86（P-13）：估算走**真尺子** —— 把"建议派兵数"喂给 autoPickTroops 取实际配兵，
       再调 GAME.gatherYield（与结算同一个函数），面板报的 = 打出去真正拿到的。 */
    var sample = suggest;
    var sampleY = GAME.gatherYield({ type: w.type, level: w.level || 0, army: GAME.autoPickTroops(sample), elapsed: G.maxHours * 3600 });
    var samplePower = sampleY ? sampleY.power : 0;
    var sampleYield = sampleY ? sampleY.amount : 0;
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : '';""",
     'P-13 · 估算段（真尺子）')

# ④ P-13：收成公式行 / 每千行（人头口径 → 采力口径）
edit(P, r"""      '<div class="attr"><span class="k">收成公式</span><span class="v">' + G.basePerHour + ' × (1+' +
        Math.round((w.level || 0) * G.levelBonus * 100) + '%) × 兵力 × 时长(时)</span></div>' +
      '<div class="attr"><span class="k">每千兵·每小时</span><span class="v">' +
        U.numText(Math.round(perHour * 1000), 0) + '</span></div>' +""",
     r"""      /* v89.86（P-13）：旧两行是 v29 前的人头口径（"2 × (1+35%) × 兵力"），
         v29 起收成只看**采力**（各兵种兵力 × 采集效率之和），两行一并换口径。 */
      '<div class="attr"><span class="k">收成公式</span><span class="v">采力 × (1+' +
        Math.round((w.level || 0) * G.levelBonus * 100) + '%) × 时长(时)　·　采力 = 兵力 × 兵种采集效率之和</span></div>' +
      '<div class="attr"><span class="k">每千采力·每小时</span><span class="v">' +
        U.numText(Math.round(1000 * (1 + (w.level || 0) * G.levelBonus)), 0) + '</span></div>' +""",
     'P-13 · 收成公式两行换采力口径')

# ⑤ P-13：note 行
edit(P, r"""      '<div class="note">有效兵力上限 <b>' + G.troopCap + '</b>　·　24 小时封顶　·　以 ' + U.numText(sample, 0) +
        ' 兵采满预计可得 <b>' + U.numText(Math.round(perHour * sample * G.maxHours), 0) + '</b> ' + (RES_NAME[res] || res) + '。</div>' +""",
     r"""      '<div class="note">单队采力上限 <b>' + U.numText(G.powerCap, 0) + '</b>　·　24 小时封顶　·　以 ' + U.numText(sample, 0) +
        ' 兵（采力 ' + U.numText(samplePower, 0) + (samplePower >= G.powerCap ? '（已触顶）' : '') +
        '）采满预计可得 <b>' + U.numText(sampleYield, 0) + '</b> ' + (RES_NAME[res] || res) + '。</div>' +""",
     'P-13 · note 行')

src = read(P)
print('v89.86 出现 %d 次' % src.count('v89.86'))
print('残留 troopCap %d 处 / 残留 cost.grain %d 处（本文件）' % (src.count('troopCap'), src.count('cost.grain')))
