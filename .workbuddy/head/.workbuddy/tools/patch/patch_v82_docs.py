# -*- coding: utf-8 -*-
"""v82 · 文档补丁：设计规范 §23 / 备忘 §二十五 / 需求档案 v82。"""
import io

SPEC = r'E:\Deepseekdb\docs\设计规范.md'
MEMO = r'E:\Deepseekdb\docs\AI工作备忘.md'
ARCH = r'E:\Deepseekdb\需求档案.md'


def detect_eol(path):
    t = io.open(path, encoding='utf-8', newline='').read()
    return '\r\n' if t.count('\r\n') and t.count('\r\n') == t.count('\n') else '\n'


def append(path, text, tag):
    eol = detect_eol(path)
    t = io.open(path, encoding='utf-8', newline='').read()
    marker = next((ln for ln in text.split('\n') if ln.strip()), text[:40])
    if marker in t:
        print('  · %s：已追加过（跳过）' % tag)
        return
    io.open(path, 'w', encoding='utf-8', newline='').write(t + eol + text.replace('\n', eol))
    print('  ✓ %s（eol=%s）' % (tag, 'CRLF' if eol == '\r\n' else 'LF'))


SPEC23 = """
## 23. v82：文案外露与字体纪律（老板四条）

### 23.1 城名行（官府面板）
- 「本城」标签行 / 档位括注（自建城）/ 原名标注 / 「附属野地 / 城外空地」行全部退役；
  城名改 `.city-title`（居中 · 16px · 800 · 金）+ `.city-sub`（操作按钮居中一行）。
- 改名弹窗与君主改名弹窗不再回显原名 —— 域层 `origName` 照记（州治判定/战报仍按它对号）。

### 23.2 字重三档纪律（全站）
- **400 正文 / 700 强调（按钮·数值·名字）/ 800 标题**；500 / 600 / 900 已清零。
- 标题族 / 分区标题族 / 备注族各只有**一处共享定义**（index.html 文末两段 + .note 段）：
  - 标题外观：`.gold-heading, .m-title, .q-det-title`（16px / 800 / 金 / 字距 1px）
  - 分区标题：`.q-sec-t, .q-det-sec, .bag-sec, .gd-sec, .forge-q, .m-sec, .side-title, .wb-t,
    .gp-sec, .fsn-t, .op-zone-t, .ledger-sec, .seal-h`（13px / 800 / 金 / 字距 .5px）
  - 备注族：`.note, .ui-sub, .nt-info, .op-hint, .m-sub, .gb-empty, .q-empty, .gd-hint,
    .farm-sub, .auto-note, .create-save-note, .q-det-tip, .ds-empty`（12px / 常规 / 次要色 / 行高 1.65）
- 新增标题类名必须挂进对应共享规则，不在各自块里单写字号/字重（smoke §67 守卫盯着）。

### 23.3 征收退役（v82）
- 官府征收（`GAME.levy / levyPlan / levyReady` + `DATA.LEVY_*` + `city.lastLevy` +
  `do-levy` 分发 + 按钮冷却同步）整段退役；黄金进项收口为三口（税收 / 俸禄 / 岁贡）。
- 特产展示直读 `GAME.specialtyOf / GAME.stateOfCity`（岁贡与州治加成口径不变）。
- 「城外空地」显示与数值副本（老口径函数）双退役 —— 机制唯一出口 `DATA.EXT_CAP_BY_LV + GAME.extCap`。

### 23.4 君主开局资质（v82）
- `DATA.LORD_GEN.rankId = 'fan'`（凡品最低档，lvCap 60）—— 靠种田秘境资质灵草逐档提升
  （凡→良→英→名→天，`GAME.rankUpUse` 唯一出口；升档另有隐藏加成）。
"""
append(SPEC, SPEC23, '设计规范 §23')

MEMO25 = """
## 二十五、v82：检查器的第二次反噬（audit watchFields / 前缀幂等 / 并行编辑）

### 25.1 audit 的 watchFields 是硬编码清单 —— 注释里的字样也算「出现」
- 症状：老口径函数删干净后 audit 仍报「零引用字段 1」—— data.js 的退役注释里写了
  它的标识符，而 watchFields 的正则 `\\b<名字>\\b` 扫的是**未剥注释**的原文。
- 定式：**退役说明里不写标识符**（写「原『城外空地』数值副本」即可）。涉及名单：
  extraLand / wildCap / goldCap / techLv / marches / rep_gain / siegeEra —— 注释一律绕开。
- 附带认知：词条**彻底消失 = 跳过检查**（快照里 `if (!hits.length) return`）——
  所以"退役注释"反而是唯一会把它顶红的写法。

### 25.2 幂等判定的「前缀包含」坑（第三次）
- 去 `['GAME.levy', G.levy]` 时被 `if new in t` 骗过：新文本是旧行的**前缀**、旧行里恰好含它 → 误判已改。
- 定式：**新文本可能是旧文本子串时，幂等判定必须 old 优先**（old 在 → 改；old 不在且 new 在 → 跳过）。

### 25.3 同一文件的两个 Edit 并行会互相覆盖
- 两个 Edit 同时改一个补丁脚本，后写覆盖先写（本次常量定义被吞，NameError 才暴露）。
- 定式：**同一文件的多个编辑串行**；补丁脚本改完先在别处试跑或 `--check` 再信。

### 25.4 两条已固化的验证事实（本轮实测）
- jsdom（e2e）能算 `font-weight` 计算样式（`.gold-heading` → '800'）；
  但 `font-size: var(--fs-sub)` 不解析（原样返回）—— 字体类 e2e 断言用**字重**，别用字号。
- stripComment 对 CSS 块注释同样生效（对 index.html 的断言可放心用剥注释版）。
"""
append(MEMO, MEMO25, '备忘 §二十五')

ARCH82 = """
### v82 · 4 项（**原文**）

> 1.君主初始资质为最差，需要逐步升级
> 2.官府界面及君主界面等不要显示（自建城）这种文字，不需要显示原名 新城池；不需要显示附属野地/城外空地及其数量；不需要显示"本城"，城市名称居中，字体稍大即可
> 3.官府不需要征收物质这个功能去除
> 4.统一各级标题，文字，备注的字体格式，大小，粗细

**落地**：
- ① 君主开局「凡品」（最低档，`DATA.LORD_GEN.rankId='fan'`，lvCap 60）——靠种田秘境
  灵草逐档提升（凡→良→英→名→天，`rankUpUse` 唯一出口，升档另有隐藏加成）。
- ② 官府面板：「本城」标签 / 档位括注（自建城）/ 原名标注 / 「附属野地 / 城外空地」行
  全部退役；城名改 `.city-title` **居中 16px 金色**（操作按钮 `.city-sub` 居中一行）；
  改名弹窗不再回显原名（域层 origName 照记）；君主面板城池列表去档位括注。
- ③ 官府征收整段退役（域 / 界面 / 分发 / 状态 / 数据五处全清）；特产直读 specialtyOf / stateOfCity；
  「城外空地」显示与数值副本双退役（机制唯一出口 EXT_CAP_BY_LV + extCap）。
- ④ 字体三档纪律：字重只留 400/700/800（500/600/900 清零）；标题族（3 处）与分区标题族
  （13 处，收编六处漏网：q-det-sec / gp-sec / fsn-t / op-zone-t / ledger-sec / seal-h）与备注族
  （13 处）各一处共享定义；重复同名规则合并（.inn-avatar / .ia.qN）。
- 顺手：battle.js / ui.js 两处「同段重复语句」收编（v67 基线带来的；战报未读计数修复为 +1）。
- 测试：smoke **2137/0** · e2e **724/0**（smoke 翻转/跟进 8 处 + 新增第 67 节 12 条；
  e2e 重整征收流程 + 新增 v82 段 4 条）。
- 细节：`docs/设计规范.md` §23；`docs/AI工作备忘.md` §二十五。
"""
append(ARCH, ARCH82, '需求档案 v82')

print()
print('完成。')
