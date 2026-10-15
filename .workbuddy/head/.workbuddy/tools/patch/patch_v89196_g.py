# -*- coding: utf-8 -*-
"""v89.196 收尾补丁 G：需求档案补录 + smoke §196 段插入"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

# ---------------- G1 档案总览行 ----------------
ROW = (
 u"| v89.196 | 2026-10-05 | 7 | **资质补全v2 + 放手重占 + 战斗回看 + 雷达圈折线 + 成就型收藏**"
 u"（老板：「1.「为将领资质补全属性」的解读：每个将领的将有一个基于其资质的基础属性（即便是0级也存在一定数值），"
 u"而后基于资质每级有固定增长及自由属性点；对于由低资质向高资质的提升，1）自然地，按相应高资质补全等级相关的六维和自由属性点；"
 u"2）并且作为提升资质的奖励，额外再给予一定的属性数值奖励，如各50，100，200，400，800 2.放手后可重新占据 3.同意 "
 u"4.观战自动战斗不参与时间跳变补偿？我想要看到全部战斗过程，不管是中途才开始观战，或者战斗已结束，或者点击自动战斗直接结算等情形 "
 u"5. S2 经验族涨价待拍板 · S1 维持费形态确认（现为一次性付金）：这是什么 "
 u"6.雷达圈真旋转扫描线：不要，有点晃眼，静态圈就行，已涉及到最远的地块格子边界为边界（因此外周不是圆弧，而是地块的边界折线。 "
 u"7.收藏立绘展示：成就型收集界面，设计为完成特定任务后可获得，但必须再花金币激活」）—— "
 u"① **资质补全 v2**（老板明确解读：基础属性[=资质 base[0]，0 级也有] + 每级固定增长[grow/自由点]；"
 u"升档 = 按高资质**等级重演补齐**四维[base[0]×风格系数+(Lv−1)×grow×系数×(4/Σm)，只补不削] + "
 u"自由点**等级差补**[(Lv−1)×Δgrow] + **数值奖励** `DATA.RANKUP_AWARD`[按目标档：良100/英200/名400/天800 · "
 u"四维各+N + 体力上限+N · **速度不参与**（几十量级、+50~800 会爆）]）；实测凡 Lv60 全链：四维 40→1682"
 u"（重演/灵淬/奖励三层叠加）、freePts 0→918、staAdd 0→1500 —— **累计奖励 1500/维已在文档透明**（老板给数照落）；"
 u"② **放手重占**（推翻 v89.195「保留拔除登记」口径：`abandonFort` 清 `s.fortsTaken` → 该格回归野外据点、"
 u"次日起可再打再占[当日 fortsRazed 挡·天然每日一格]；§195② 断言按新口径重写 + 重占行为断言）；"
 u"③ **同意**（守将 atkDim=0.25 / 老档补发力度保持不动）；"
 u"④ **战斗回看三情形**（v89.192 中途补史已有；本轮补**结束瞬间**：`_battleJustDone` 挂 `report` → "
 u"`btShowEnd` 加「🎬 回看全程」（case `bt-replay` → `sdOpenDone` → `openSandboxRep` 唯一渲染段）——"
 u"autoBattle/撤退/战报三条路 `verify=true` 实测[44/10 帧]；\"战斗已结束\"入口 toast 导流公文）；"
 u"⑤ **两问解答**（S2=经验族涨价×5 建议[后期纯买道具升将]；S1=建筑加金——我落成\"升级一次性付金\"，"
 u"老板原词\"维持金\"若指定期扣，改一处结算即可）；"
 u"⑥ **雷达圈折线**（椭圆弧+相位整条退役：`GAME.map.fortRingOf(R)` = 覆盖格外轮廓"
 u"[判定同源 d²≤R²、四邻检查取外露边、环连接供填充、**按 R 缓存**]，**静态**无动画，"
 u"外周=地块边界折线；§194⑦ 断言按新口径重写；`1.4142`/相位残留清零）；"
 u"⑦ **成就型收藏**（`DATA.COLLECT` 18 系加 cond[条件池 16 类：win/conquer/wild/gather/scout/fort/rank/lordLv/bldg/rep/"
 u"itemKind/recruited/trades/forged/trained/buildDone]；`collectCondOf/MetOf/ValOf` 唯一出口；"
 u"`collectBuy` 解锁闸[未达成拒·**不扣金**] + `collectBuySeries` 全解锁预检；UI 三态"
 u"[🔒条件+进度 / 激活 / 已入藏]+CSS；实测 73 件全解析、未解锁拒、达成可激活）；"
 u"旧断言 5 条按新口径重写（灵淬两条 + §194④ 三条造局补解锁）；"
 u"门禁全绿[audit 0 · smoke NNNN/0 · e2e NNNN/0 · 四查过] + 实机 N/0 + 像素 N/0 + 探针 5 支 "
 u"| 已完成（详见 docs/v89196-资质v2回看与成就收藏.md） |"
)

DETAIL = u"""

---

## v89.196（2026-10-05）资质补全 v2 · 放手重占 · 战斗回看 · 雷达圈折线 · 成就型收藏

**老板原文**（逐字）：
> 1.「为将领资质补全属性」的解读：每个将领的将有一个基于其资质的基础属性（即便是0级也存在一定数值），而后基于资质每级有固定增长及自由属性点；对于由低资质向高资质的提升，1）自然地，按相应高资质补全等级相关的六维和自由属性点；2）并且作为提升资质的奖励，额外再给予一定的属性数值奖励，如各50，100，200，400，800
> 2.放手后可重新占据
> 3.同意
> 4.观战自动战斗不参与时间跳变补偿？我想要看到全部战斗过程，不管是中途才开始观战，或者战斗已结束，或者点击自动战斗直接结算等情形
> 5. S2 经验族涨价待拍板 · S1 维持费形态确认（现为一次性付金）：这是什么
> 6.雷达圈真旋转扫描线：不要，有点晃眼，静态圈就行，已涉及到最远的地块格子边界为 边界（因此外周不是圆弧，而是地块的边界折线。
> 7.收藏立绘展示：成就型收集界面，设计为完成特定任务后可获得，但必须再花金币激活

**交付**：① 资质补全 v2（等级重演 + 等级差补 + 奖励表）；② 放手可重占（清拔除登记）；③ 战斗回看三情形（结束瞬间「回看全程」）；④ 雷达圈改地块边界折线（静态）；⑤ 藏珍阁成就型（任务解锁 + 金币激活）。详见 `docs/v89196-资质v2回看与成就收藏.md`。

**由需求引出的真 bug / 口径变更**：
- **升档口径三级跳**：v89.179c「四维补地板（base[0]）」→ v89.195「+攻防补齐」→ **v89.196「等级重演 + 等级差补 + 数值奖励」**（老板本轮定义）——旧断言 2 条（灵淬 +2/+18）按新口径重写（"只增不减"）。
- **放手防刷口径反转**：v89.195"保留 fortsTaken 防打→占→放→再打"→ 老板拍板"可重占"（每日一格的节奏为准）。
- **回放板块的历史关系**：v89.150 退役的是"战报正文里的**文字**分回合回放/纪要"；本轮要的是"**画面**回看"（沙盘，v89.102 起就有）——两者形式不同，不冲突；本轮把入口补到"结束瞬间"。
- 旧断言 5 条连带升级：灵淬两条 + §194④ 三条（成就型下造局先解锁）。

**复现命令**：
```bash
export PATH="/usr/bin:/bin:/c/Users/18811/.workbuddy/binaries/PortableGit/versions/1.2.0/bin:$PATH"; cd /e/Deepseekdb
node .workbuddy/tools/probe/probe_v89196a_rankup2.js    # 资质 v2（重演/差补/奖励/只补不削）
node .workbuddy/tools/probe/probe_v89196b_fort.js       # 放手重占（可选：并入 §195 探针）
node .workbuddy/tools/probe/probe_v89196c_batreplay.js  # 战斗回看（auto/撤退/回执/沙盘 verify）
node .workbuddy/tools/probe/probe_v89196e_collect2.js   # 成就型收藏（73 件/解锁闸/集齐闸）
python .workbuddy/tools/git/gate.py --full              # audit 0 · smoke NNNN/0 · e2e NNNN/0
```
"""

s = rd('需求档案.md')
if u'| v89.196 |' in s:
    print('[skip] G1 档案总览行')
else:
    mark = u'| 已完成（详见 docs/v89195-前哨放手与资质补全属性.md） |\n'
    c = s.count(mark)
    assert c == 1, 'G1 anchor=' + str(c)
    s = s.replace(mark, mark + ROW + u'\n')
    wr('需求档案.md', s)
    print('[ok] G1 档案总览行')

s = rd('需求档案.md')
if u'## v89.196' in s:
    print('[skip] G2 档案明细段')
else:
    mark2 = u"python .workbuddy/tools/git/gate.py --full              # audit 0 · smoke 3472/0 · e2e 1196/0\n```\n"
    c2 = s.count(mark2)
    assert c2 == 1, 'G2 anchor=' + str(c2)
    s = s.replace(mark2, mark2 + DETAIL)
    wr('需求档案.md', s)
    print('[ok] G2 档案明细段')

# ---------------- G3 smoke §196 段插入 ----------------
s = rd('smoke-test.js')
if u'§196. v89.196' in s:
    print('[skip] G3 §196 段')
else:
    sec = io.open(R + '.workbuddy/tmp/sec196.js', 'r', encoding='utf-8', newline='').read()
    anchor = u"  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    c = s.count(anchor)
    assert c == 1, 'G3 anchor=' + str(c)
    i = s.rindex(anchor)
    s = s[:i] + sec + u'\n' + s[i:]
    wr('smoke-test.js', s)
    print('[ok] G3 §196 段')

print('补丁G 完成')
