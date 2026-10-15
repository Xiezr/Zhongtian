# -*- coding: utf-8 -*-
"""v89.230 批次 E：lifecycle 工具同族修复（4 处）——
① 移民令 pop_fill 口径：maxPopOf → effPopCapOf（v89.185 起产品用有效上限，与 chains 同族）
② 遗物（type=bao）专项化：装配类（不可直用）+ 渠道表补遗物掉落（据点/名城缴获）
③ B1 募兵夹具 50→30（可征幸存者边界 ~49，防假红）
每段 assert count==1 + 幂等跳过。
"""
import io

P = '.workbuddy/tools/play/lifecycle_v89121.js'

def rd():
    return io.open(P, encoding='utf-8', newline='').read()

def wr(s):
    io.open(P, 'w', encoding='utf-8', newline='').write(s)

REPORT = []

def rep(tag, old, new, cnt=1):
    s = rd()
    if new in s and s.count(old) == 0:
        REPORT.append('[skip] %s' % tag)
        return
    c = s.count(old)
    assert c == cnt, '%s count=%d（期望 %d）' % (tag, c, cnt)
    wr(s.replace(old, new))
    REPORT.append('[ok] %s' % tag)

# ① pop_fill 口径
rep('life.pop-note',
"""      /* v89.125：语义 = 每次 +上限×ratio（增量，封顶上限）——
         prep 摆 10%，用后应 = min(上限, 10% + ratio)（旧口径是"补到 ratio"，已废）。 */""",
"""      /* v89.125：语义 = 每次 +上限×ratio（增量，封顶上限）——
         prep 摆 10%，用后应 = min(上限, 10% + ratio)（旧口径是"补到 ratio"，已废）。
         v89.230 工具同步：上限 = **有效上限**（effPopCapOf · 民心折算）—— v89.185 起产品口径，
         原写 maxPopOf（满额上限）→ 民心 <100% 时实测必然对不上（假红）。 */""")
rep('life.pop-prep', "prep: function () { G.res(A).pop = Math.floor(G.maxPopOf(A) * 0.1); },",
    "prep: function () { G.res(A).pop = Math.floor(G.effPopCapOf(A) * 0.1); },")
rep('life.pop-verify', "        var cap = G.maxPopOf(A);\n        var want = Math.min(cap, Math.floor(cap * 0.1) + Math.floor(cap * (it.ratio || 0.25)));",
    "        var cap = G.effPopCapOf(A);\n        var want = Math.min(cap, Math.floor(cap * 0.1) + Math.floor(cap * (it.ratio || 0.25)));")

# ② 遗物专项化 + 渠道表
rep('life.chan-bao', "    rank_up: '种田秘境(灵草作物)', essence: '采集/缴获(精华掉落表)', talis: '游历/逸闻(锦囊)',",
    "    rank_up: '种田秘境(灵草作物)', essence: '采集/缴获(精华掉落表)', talis: '游历/逸闻(锦囊)',\n    bao: '缴获(据点/名城·遗物掉落表)',   /* v89.230：遗物渠道随工具同步 */")
rep('life.bao-branch',
"""      } else {
        useNote = '未知 type';
      }""",
"""      } else if (t === 'bao') {
        hasUse = false;
        useNote = '专项：遗物（装配进遗物槽生效 · 打据点/名城缴获）';
        hasEff = true;  /* v89.230：设计上不可直用（同 talis 族） */
      } else {
        useNote = '未知 type';
      }""")
rep('life.bao-clear', "else if (t === 'seed' || t === 'talis' || t === 'material' || t === 'blueprint' || t === 'essence') hasClear = afterN >= 0;",
    "else if (t === 'seed' || t === 'talis' || t === 'material' || t === 'blueprint' || t === 'essence' || t === 'bao') hasClear = afterN >= 0;")
rep('life.bao-pass', "(hasUse || ['seed', 'talis', 'material', 'blueprint', 'essence'].indexOf(t) >= 0)",
    "(hasUse || ['seed', 'talis', 'material', 'blueprint', 'essence', 'bao'].indexOf(t) >= 0)")

# ③ B1 募兵夹具
rep('life.b1-train', "  var trB = G.train ? G.train('buxingji', 50, AB.id, jyB) : null;",
    "  var trB = G.train ? G.train('buxingji', 30, AB.id, jyB) : null;   /* v89.230：50→30（劳作占用后可征 ~49，50 会拒 → 假红） */")

for line in REPORT:
    print(line)
print('批次 E 完成')
