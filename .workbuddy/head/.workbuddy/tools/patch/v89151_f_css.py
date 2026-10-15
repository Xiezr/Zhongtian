# -*- coding: utf-8 -*-
"""v89.151 批 F：index.html —— 底栏按钮 / 侧栏版式 / 操作按钮规格 / 浮层克制色"""
import io

P = 'E:/Deepseekdb/index.html'
s = io.open(P, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag); return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① 底栏左侧：.bb-tools 容器 + 两枚同规格按钮 + 闪烁动画 ----------
rep(
    """  .bb-label-toggle {
    position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    padding: var(--sp-1) var(--sp-4); font-size: var(--fs-sub); font-weight: 800; letter-spacing: 1px;
    color: var(--text-dim); cursor: pointer; border-radius: var(--r-md);
    background: linear-gradient(180deg, var(--btn-face-1), var(--btn-face-2));
    border: 1px solid var(--gold-dark); box-shadow: inset 0 1px 0 rgba(var(--hl-rgb),.1);
  }
  .bb-label-toggle:hover { filter: brightness(1.2); }
  .bb-label-toggle.on { color: var(--gold-light); border-color: var(--gold);
    background: var(--grad-bb-toggle); box-shadow: 0 0 10px rgba(var(--gold-soft-rgb),.3); }""",
    """  /* ============================================================
   * v89.151（老板 3）：底部导航栏左侧统一为 `.bb-tools` 容器 ——
   *   两枚**同级图标按钮**共用一套外观规格（统一图标按钮）：
   *     · 「🏷 隐藏名称 / 显示名称」（文案随状态走，.on = 标注显示中，逻辑同 v89.52/v89.67）
   *     · 「⚔ 指挥战斗」（战斗待指挥清单入口；`state==='live'` 的战斗存在时 `.blink` 闪烁，
   *        由 ui.paintWarBeacon 每秒切 class —— 不重建 DOM，不影响分页/地图导航）
   *   绝对定位从按钮**移到容器**上（原来按钮自己 absolute，两枚并列会重叠）。
   * ============================================================ */
  .bb-tools {
    position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    display: flex; gap: var(--sp-2); align-items: center;
  }
  .bb-label-toggle, .bb-war {
    padding: var(--sp-1) var(--sp-4); font-size: var(--fs-sub); font-weight: 800; letter-spacing: 1px;
    color: var(--text-dim); cursor: pointer; border-radius: var(--r-md);
    background: linear-gradient(180deg, var(--btn-face-1), var(--btn-face-2));
    border: 1px solid var(--gold-dark); box-shadow: inset 0 1px 0 rgba(var(--hl-rgb),.1);
  }
  .bb-label-toggle:hover, .bb-war:hover { filter: brightness(1.2); }
  .bb-label-toggle.on { color: var(--gold-light); border-color: var(--gold);
    background: var(--grad-bb-toggle); box-shadow: 0 0 10px rgba(var(--gold-soft-rgb),.3); }
  /* 「指挥战斗」闪烁态：有战斗待指挥时脉冲（角标级提示，不抢读秒/战斗界面） */
  .bb-war.blink { color: var(--gold-light); border-color: var(--gold);
    animation: bbWarPulse 1s ease-in-out infinite; }
  @keyframes bbWarPulse {
    0%, 100% { box-shadow: 0 0 3px rgba(var(--gold-soft-rgb), .2); }
    50% { box-shadow: 0 0 12px rgba(var(--gold-soft-rgb), .9); }
  }""",
    '① bb-tools + bb-war')

# ---------- ② 侧栏：简称字号放大 + 与数量同宽 48px（两下拉等长居右） ----------
rep(
    """  .bt-l1 .bt-rnm { flex: 0 0 auto; min-width: 0; font-size: var(--fs-cap); color: var(--text-dim);
    font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: help; }
  .bt-l2 .bt-rn { flex: none; min-width: 34px; font-size: var(--fs-cap); }""",
    """  /* v89.151（老板 n）：① 兵种简称字号放大一档（11 → 13px · 加粗 · 居中）；
     ② 简称与数量**同为 48px 定宽** → 两行的下拉框起点对齐、**等长且居右**
        （老板「行动和目标的下拉框长度相同，居于右侧」——左侧标签定宽、右侧下拉吃掉剩余宽）。 */
  .bt-l1 .bt-rnm { flex: 0 0 48px; min-width: 0; font-size: var(--fs-h3); font-weight: 700;
    text-align: center; color: var(--text-dim);
    font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: help; }
  .bt-l2 .bt-rn { flex: 0 0 48px; min-width: 0; font-size: var(--fs-h3); font-weight: 700;
    text-align: center; }""",
    '②a bt-rnm/bt-rn 同宽')

rep(
    """  .bt-card .bt-rnm { max-width: none; flex: 0 0 auto; }""",
    """  /* v89.151：与 .bt-l1 .bt-rnm 对齐（同特异性、后定义者胜 —— 这条曾经把上面覆盖回 auto） */
  .bt-card .bt-rnm { max-width: none; flex: 0 0 48px; }""",
    '②b bt-card .bt-rnm 同步')

# ---------- ③ 我军/敌军表头 + 将领行居中 ----------
rep(
    """  .bt-side-h { font-size: var(--fs-cap); color: var(--text-dim); padding: 0 var(--sp-1) var(--sp-0); }""",
    """  /* v89.151（老板 n）：「我军、敌军以及各自将领的姓名等级，分别居中显示」 */
  .bt-side-h { font-size: var(--fs-cap); color: var(--text-dim); padding: 0 var(--sp-1) var(--sp-0);
    text-align: center; }""",
    '③a bt-side-h 居中')

rep(
    """  .bt-gen { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-1) var(--sp-2);
    margin-bottom: var(--sp-1); font-size: var(--fs-sub); color: var(--parchment);
    border-bottom: 1px dashed rgba(var(--gold-soft-rgb), .28); }""",
    """  .bt-gen { display: flex; align-items: center; justify-content: center; gap: var(--sp-2);
    padding: var(--sp-1) var(--sp-2);   /* v89.151（老板 n）：将领姓名等级行**居中显示** */
    margin-bottom: var(--sp-1); font-size: var(--fs-sub); color: var(--parchment);
    border-bottom: 1px dashed rgba(var(--gold-soft-rgb), .28); }""",
    '③b bt-gen 居中')

# ---------- ④ 功能/菜单按钮统一规格（野地面板 + 建筑弹窗） ----------
rep(
    """  .op-zone.danger .op-zone-t { color: var(--red-light); }""",
    """  .op-zone.danger .op-zone-t { color: var(--red-light); }
  /* ============================================================
   * v89.151（老板 n+1）：功能 / 菜单按钮的**统一规格**（野地面板 · 建筑弹窗共用一套）——
   *   · 大小：同排**等长**（flex:1，与「🛡 增派驻军」同宽）· 高度由 .btn 的 padding 统一；
   *   · 形状 / 字体：沿用 .btn 族（--r-sm 圆角 · --fs-lead / 700）—— bldg-act 的两行式
   *     （主字 + .ba-sub）保持不变，只统一"可用/禁用"的视觉语言；
   *   · 颜色 / 状态：可用 = `.gold` 亮金（既有语义）· 禁用 = 统一灰暗 + not-allowed（下方规则）·
   *     悬停提亮（.btn:hover 既有）。"采集 → 收获"这类**状态切换**（.gold 出现/消失）
   *     两个面板同规：能做的事亮金、做不了的事灰暗并悬停写明原因。
   * ============================================================ */
  .op-zone-eq .op-row > .btn { flex: 1 1 0; min-width: 0; }
  .op-zone-eq .op-row > .btn:disabled,
  .bldg-acts > .btn:disabled,
  .bldg-foot > .btn:disabled { opacity: .55; filter: grayscale(.35); cursor: not-allowed; }""",
    '④ op-zone-eq 规格')

# ---------- ⑤ 浮层：克制（绿）/ 被克（红） ----------
rep(
    """  .tip-layer .tip-a { font-size: var(--fs-sub); color: var(--green-ok); margin-top: var(--sp-1); line-height: var(--lh-body); }""",
    """  .tip-layer .tip-a { font-size: var(--fs-sub); color: var(--green-ok); margin-top: var(--sp-1); line-height: var(--lh-body); }
  /* v89.151（老板 5）：悬停里的相克两行 —— 克制/抗性 = 绿字 · 被克 = 红字（老板点名颜色） */
  .tip-layer .tip-l.cnt-good { color: var(--green-ok); }
  .tip-layer .tip-l.cnt-bad { color: var(--red-light); }""",
    '⑤ 浮层克制色')

assert '\r\n' not in s
assert s.count('.bb-tools {') == 1 and s.count('.bb-war.blink') == 1
assert s.count('.tip-layer .tip-l.cnt-good') == 1
assert s.count('.op-zone-eq .op-row > .btn') == 2   # 定义行 + :disabled 行
assert '.bb-label-toggle {\n    position: absolute' not in s   # 绝对定位已挪到容器
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('index.html F 落盘 OK · len=' + str(len(s)))
