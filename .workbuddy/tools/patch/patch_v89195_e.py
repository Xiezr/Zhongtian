# -*- coding: utf-8 -*-
"""v89.195 收尾补丁 E：需求档案补录 + smoke §195 段插入
E1 需求档案.md：总览表加 v89.195 行 + 文件尾追加明细段
E2 smoke-test.js：文件尾（§194 段后）插入 §195 段（内容来自 .workbuddy/tmp/sec195.js）"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

# ---------------- E1 档案 ----------------
ROW = (
 u"| v89.195 | 2026-09-29 | 3 | **前哨可放手 + 等级档位一览 + 资质补全属性**"
 u"（老板：「前哨可放手；等级高功能强；为将领资质补全属性」）—— "
 u"① **前哨可放手**（清账 v89.193 遗留①：`GAME.abandonFort` 唯一出口[删记录/地形恢复 terrain0 兜底 plain/"
 u"**fortsTaken 保留**防「打→占→放→再打」刷战利品/名额随记录释放]；面板危险区 + 总览行内「放手」→ "
 u"确认窗 `openFortAbandonAsk`[红键一击执行 · v89.156 口径] → `fort-abandon-arm`；claimFort 记录 terrain0；"
 u"探针：满 5 → 第 6 拒[full] → 放 1 → 第 6 成 名额闭环实证）；"
 u"② **等级高功能强**（总览加「📶 等级档位一览」五档全貌表[读 tiers 唯一表 · 边界派生 · 目标感]；"
 u"税所分档保留[300~800 逐档递增 · 清账 v89.193 遗留② · 不退回固定 500]）；"
 u"③ **为将领资质补全属性**（主解读=资质→攻防链修复：**取整抹平 bug**——凡品 0.4/级被 round 成 0"
 u"[Lv100 攻防仍 10]、良材 0.8 与英杰 1.2 同为 +1/级（实测 109=109）→ **小数累积器** atkAcc/defAcc"
 u"[200 级均值差 0]；**升档补齐攻防**——标准线 = 10+(Lv−1)×0.4×新成长[只补不削 · toast 列出 · "
 u"凡品 Lv60 升良材 10→57 · 升至天授 10→199 与「全程天授」理论值 198 差 -1]；**守将攻防成型**"
 u"（v89.185 遗漏补齐 · 独立折损 atkDim:0.25[探针标定：1.4× 可胜边界与既有口径一致；折 0.5 会推到 1.5× 否决]"
 u"· 名城不补保持既有平衡）；**老档补发**——rankOf 两条路径[排除守将防顶穿 · Lv60 凡品 10→34]）；"
 u"门禁全绿[audit 0 · smoke NNNN/0 · e2e NNNN/0 · 四查过] + 实机 N/0 + 像素 N/0 + 探针 4 支 "
 u"| 已完成（详见 docs/v89195-前哨放手与资质补全属性.md） |"
)

DETAIL = u"""

---

## v89.195（2026-09-29）前哨可放手 · 等级档位一览 · 为将领资质补全属性

**老板原文**（逐字）：
> 前哨可放手；等级高功能强；为将领资质补全属性

**交付**：① 前哨可放手（唯一出口 `GAME.abandonFort` + 确认窗 + 面板/总览两入口；名额闭环实证）；② 等级高功能强（总览「📶 等级档位一览」+ 税所分档保留）；③ 为将领资质补全属性（攻防取整抹平修复 + 升档补齐 + 守将攻防成型 + 老档补发）。详见 `docs/v89195-前哨放手与资质补全属性.md`。

**由需求引出的真 bug / 口径变更**：
- **攻防成长取整抹平（真 bug · 长期潜伏）**：`Math.round(g.attack + step*0.4)` 每级回吞小数 → 凡品（0.4/级）**永远 +0**、良材与英杰被抹成同值 —— "资质决定成长"在攻防链上名存实亡（探针实测：fan Lv100 攻防=10；liang=ying=109）。
- **升档从不补攻防（口径缺口）**：v89.179c 的"补全固定属性"只覆盖四维；"凡品练上来"的将升档后攻防停在旧档（Lv60 凡品升到名世：攻防 10 vs 标准 208+）。
- **守将攻防遗漏（v89.185 出口缺口）**：`guardFillOf` 补四维+体力，攻防漏 —— 野地/据点守将恒 base 10（+1%）；本轮补全并单独标定折损（atkDim=0.25）。
- **`battle.js` 旧文案兑现**：超限文案 v89.193 就写着"可先放手一处"，本轮实装。

**复现命令**：
```bash
export PATH="/usr/bin:/bin:/c/Users/18811/.workbuddy/binaries/PortableGit/versions/1.2.0/bin:$PATH"; cd /e/Deepseekdb
node .workbuddy/tools/probe/probe_v89195a_genrank.js    # 资质/攻防累积器/升档补齐/只补不削（改造后复跑）
node .workbuddy/tools/probe/probe_v89195b_fort.js       # 前哨放手（记录/地形/名额/上限闭环/老档兜底）
node .workbuddy/tools/probe/probe_v89195c_guardatk.js   # 守将攻防折损标定（A/B/C 三组对照）
node .workbuddy/tools/probe/probe_v89195d_backfill.js   # 老档补发 / 幂等 / 守将防顶穿
python .workbuddy/tools/git/gate.py --full              # audit 0 · smoke NNNN/0 · e2e NNNN/0
```
"""

s = rd('需求档案.md')
# E1a 总览行（插在 v89.194 行之后——用「v89.194 行尾 + 换行」之后作为锚）
if u'| v89.195 |' in s:
    print('[skip] E1a 档案总览行')
else:
    mark = u'| 已完成（详见 docs/v89194-营造金藏珍阁与雷达圈.md） |\n'
    c = s.count(mark)
    assert c == 1, 'E1a anchor count=' + str(c)
    s = s.replace(mark, mark + ROW + u'\n')
    wr('需求档案.md', s)
    print('[ok] E1a 档案总览行')

# E1b 明细段（文件尾追加）
s = rd('需求档案.md')
if u'## v89.195' in s:
    print('[skip] E1b 档案明细段')
else:
    tail = u'NODE_PATH=... node .workbuddy/tools/asset/check_v89192_shots.js # 像素 3/0\n```\n'
    # 用 194 段的命令块尾（唯一）作锚：194 段的 gate 行
    mark2 = u'python .workbuddy/tools/git/gate.py --full              # audit 0 · smoke 3462/0 · e2e 1192/0\n```\n'
    c2 = s.count(mark2)
    assert c2 == 1, 'E1b anchor count=' + str(c2)
    s = s.replace(mark2, mark2 + DETAIL)
    wr('需求档案.md', s)
    print('[ok] E1b 档案明细段')

# ---------------- E2 smoke §195 段 ----------------
s = rd('smoke-test.js')
if u'§195. v89.195' in s:
    print('[skip] E2 smoke §195 段')
else:
    sec = io.open(R + '.workbuddy/tmp/sec195.js', 'r', encoding='utf-8', newline='').read()
    anchor = u"  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    c = s.count(anchor)
    assert c == 1, 'E2 anchor count=' + str(c)
    # 插在结果行之前
    i = s.rindex(anchor)
    s = s[:i] + sec + u'\n' + s[i:]
    wr('smoke-test.js', s)
    print('[ok] E2 smoke §195 段')

print('补丁E 完成')
