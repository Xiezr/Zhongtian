# -*- coding: utf-8 -*-
"""v89.210 SKILL 沉淀：§121（键盘流 / 唯一出口重构对照法 / 信息重复自查 / 拨钟等价）"""
import io

P = 'C:/Users/18811/.workbuddy/skills/deepseekdb-iteration-gates/SKILL.md'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
if '## §121.' in s:
    print('[skip] §121 已在册')
else:
    sec = '''
## §121. 「键盘流」改造 / 唯一出口重构的对照法 / 落地后与相邻 UI 的"重复自查"（v89.210）

### 121.1 弹窗键盘流 = 三出口 + 两回填（可抄）
```
ui.modalFocusables()  收集顶层弹窗内可交互元素；div[data-action] 现场补 tabindex=-1（否则 .focus() 无效）
ui.modalFocusInit()   开窗/弹栈/回层给焦点 —— 判据"焦点已在窗内则不动"（防同级刷新抢焦点）
ui.modalKeyNav(e)     Tab 手动循环（末→首回卷）；Enter 只激活 div[data-action]
                      （真 button 交给浏览器默认；输入框 Enter 不劫持；e.isComposing 不触发）
```
两个必配回填（缺一则"键盘流是断的"）：
1. **live 重建焦点回填**：快照记"稳定描述"（id → 否则 tag+data-action+同类序号），重建后重查回焦；
2. **弹栈快照**（顺带修的老短板）：压栈时记 输入值/滚动位/焦点 → 弹栈回填 ——
   从子面板返回，输入框里打的字不再被复原（`.innerHTML` 快照不带 value 属性）。
判据：e2e 真派发 Tab/Enter（`document.activeElement` 断言 + focus 节点"已换过"证明回填）；实机真按键。
桩环境三种自退：无 activeElement / querySelectorAll 恒空 / `_maskEl` 无 isConnected。

### 121.2 「唯一出口重构」的最强验证 = **对照真跑**（不是"看着一样"）
把结算段抽成公共函数（本例 defenseInputsOf —— 结算与"战前推演"共用）时：
先跑**行为对照探针**（关掉随机源：`DATA.DUEL.enabled=false` 原地改+还原）——
"推演的结果"与"真打一场的结果" **winner/losses/rounds 逐项相等** 才算同源。
比"源码阅读"硬、比"感觉一致"可信；重构成败一眼可判。

### 121.3 状态条类"新 UI"的落地后自查：**与相邻既有 UI 对照"信息是否重复"**
本例：环境状态条的「天候 chip」设计稿合理，**落地实机才发现「天时」行本就显示 季节/天候/年号**
（`syncHeader` 实测 `天时建安·元年 春 🌧雨`）——同屏双显违"不重复"原则 → 整条撤（含 CSS 档位）。
规矩：**"新增一块显示"之后，一定要用实机输出对照"它旁边那块已经在说什么"**；
设计稿（纸面）看不出重复，落地输出（`textContent` 实测串）一眼可见。
同理撤项要连 CSS 档位一起退役（不留第二个出口/死样式）。

### 121.4 睡眠/息屏补偿的"拨钟等价"定式（§111.4 的收口版）
```js
/* 装钩子：真定时器不动，只把 Date.now 加偏移 —— 正是"墙上时间跳变（睡眠唤醒）"的等价 */
var real = Date.now;
window.__shift = function (ms) { Date.now = function () { return real.call(Date) + ms; }; };
/* 先正常拍 1.2s（锚点新鲜）→ 拨 8h → 等 2.4s（两拍）→ 断言 */
```
四条断言一次到位：① `world.elapsed` 增量 ≈ 缺口×倍率（**偏差 <12%**，实测 0.0%）；
② 资源真结算（粮增长）；③ 大缺口 → 离线纪要自动弹（含"息屏"字样）；④ 轻提示 toast。
不必等真过夜——拨钟 + 真拍钟已覆盖该机制的全部代码路径。

### 121.5 小坑
- 实机脚本 `p.evaluate` 里 return 的对象要**自带全部对照值**（跨 evaluate 的局部变量不存在）——
  比对本轮踩过：`sim.army` 取自"没 return 的字段" → undefined → 假红（脚本笔误，非产品 bug）。
- 计划"按建议全部执行"时，先出**销项表**（每条旧遗留：做/不做/维持 + 理由）——
  "不做"也要有理由（违用户原意 / 评估口径已够 / 历史决策），否则下轮又长回来。

'''
    s = s.rstrip('\n') + '\n' + sec
    assert s.count('## §121.') == 1
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('[ok] §121 已沉淀')
print('done')
