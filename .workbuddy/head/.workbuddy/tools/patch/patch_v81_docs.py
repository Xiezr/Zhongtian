"""v81 · 文档补丁：设计规范 §22 / AI工作备忘 §二十四 / 需求档案 v81。"""
import io, sys

SPEC = r'E:\Deepseekdb\docs\设计规范.md'
MEMO = r'E:\Deepseekdb\docs\AI工作备忘.md'
ARCH = r'E:\Deepseekdb\需求档案.md'


def append(path, text, eol, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    marker = next((ln for ln in text.split('\n') if ln.strip()), text[:40])
    if marker in t:
        print('  · %s：已追加过（跳过）' % tag)
        return
    io.open(path, 'w', encoding='utf-8', newline='').write(t + eol + text.replace('\n', eol))
    print('  ✓ %s' % tag)


print('== 设计规范 §22 ==')
SPEC22 = """
## 22. v81：君主卡信息表 / 兵营三页制

### 22.1 君主卡（.lord-head）
- 结构：头像（68px，`flex: 0 0 auto`）+ 信息表（`.lord-meta`，`flex: 1 1 0`）。
  信息表首行 = 君主名（`.mrow-name`，金色标题）；后续行 = 声望 / 爵位。
- 站位规矩：**名称行只此一处**——旧头像旁名称列与「官职」行已退役（游戏里没有
  官职体系，界面与文案都不要再出现「官职」）。
- ⚠️ 布局陷阱：原先 `.lord-meta` 用 `width: 100%` 参与 flex，与头像同抢宽度 ——
  名称列被挤成 21px 竖条、头像压到 45px（flex-shrink 默认生效）。改 flex 伸缩后
  头像恒 68×68、名称行 173px（真机实测；颜色 `--gold-light`、16px 粗体）。

### 22.2 兵营招募三页制（ui.troopsHTML）
- 分页：`que 募兵队列（首页） / inf 步兵 / cav 骑兵`；`ui._trainTab` 记当前页，
  初次打开落在「募兵队列」；工匠作坊（器械）维持旧结构（无页签、底部队列）。
- 队列独占队列页：**步兵/骑兵页不再渲染队列块**；队列页无兵种卡、无数量控件。
- 增删页签 = 改三处：`tabsHtml` 按钮、`ids` 过滤（`isQueueTab` 分支）、main.js 白名单。
"""
append(SPEC, SPEC22, '\r\n', '设计规范 §22')

print()
print('== 备忘 §二十四 ==')
MEMO24 = """
## 二十四、v81：默认页变更的连锁反应 & 替换接缝（patch 反噬第五次）

### 24.1 改「默认页」要回扫所有「渲染即断言」的测试
- v81 把募兵面板默认页从步兵换成募兵队列 —— 5 处 smoke 老测试直接
  `G.ui.troopsHTML()` 找兵种卡，全部扑空（页面里根本没有卡）。
- 处置定式：这类检查在渲染前**显式设页并还原**（`var bk = ui._trainTab; ui._trainTab = 'inf'; …; ui._trainTab = bk;`），
  而不是把判据放宽成"两种情况都接受"——后者防护就失效了。
- e2e 同理：进入募兵面板的既有流程先点对应页签（真实路径），再验内容（四处）。

### 24.2 替换锚点横跨"上段收尾 + 下段开头"时，收尾必须原样带回
- 替换 v80 段尾部（`closeModal + }` + `setView('city')`）时，新文本没把
  `closeModal + }` 带回来 —— v80 块括号被吞、`node --check` 报
  `Unexpected end of input`。
- 定式：**大段替换先数一遍旧文本里的闭合括号**，新文本逐一对齐；改完立刻
  `node --check`（语法错误比断言语义错误好抓得多，这一步已惯例化）。
"""
append(MEMO, MEMO24, '\n', '备忘 §二十四')

print()
print('== 需求档案 v81 ==')
ARCH81 = """
### v81 · 2 项（**原文**）

> 1.没有官职，左侧玩家角色这里，官职这行放玩家名称，现在的名称位置去掉
> 2.兵营招募这里，做成3页，第一页为募兵队列，步兵骑兵底下就不要募兵队列了

**落地**：
- ① 君主卡（左栏玩家角色）：头像旁旧名称列与「官职」行退役；君主名并入信息表
  首行（`.mrow-name`，金色标题）。顺带修掉布局陷阱：`.lord-meta` 原先 `width:100%`
  与头像同抢宽度（名称被挤成 21px 竖条、头像压到 45px）—— 改 flex 伸缩后
  头像恒 68×68、名称行 173px（真机实测）。
- ② 兵营招募三页制：`que 募兵队列（首页） / inf 步兵 / cav 骑兵`；
  队列从"页脚"升为独立页，步兵/骑兵页不再带队列（队列页也不带兵种卡与数量控件）；
  `ui._trainTab` 初始 'que'、main.js 三页白名单分发；工匠作坊（器械）维持原结构。
- 测试：smoke **2129/0** · e2e **723/0**（smoke 新增第 66 节 8 条 + 2 处守卫演进 +
  5 处切页修复；e2e 更新 4 处流程 + 新增 v81 段 6 条）。
- 细节：`docs/设计规范.md` §22；`docs/AI工作备忘.md` §二十四。
"""
append(ARCH, ARCH81, '\r\n', '需求档案 v81')

print()
print('文档补丁完成（数字占位 723/0 待 e2e 结果回填）。')
