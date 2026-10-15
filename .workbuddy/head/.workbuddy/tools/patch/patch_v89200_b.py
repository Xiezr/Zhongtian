# -*- coding: utf-8 -*-
# v89.200 批次 B：出征界面三改（围攻行下线 / 预估移左列下方 / 统一行右侧 10 字 + 两块固定 2 行高）
import io

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

U = 'js/ui.js'
H = 'index.html'

# ── B1 ui.js：删「围攻：守备 X%」提示行（下线） ──
B1_OLD = (u"            (pw74.siege ? '<br><span style=\"opacity:.75;\">\U0001f9f1 围攻：守备 ' + Math.round(pw74.siege.hold)\n"
          u"              + '%（守军与城防已按此衰减）</span>' : '')\n")
B1_NEW = (u"            /* \u26d4 v89.200（老板 2）：「\U0001f9f1 围攻：守备 X%（守军与城防已按此衰减）」提示行**整条下线** ——\n"
          u"               围攻（据点/县城的守备衰减）是独立于战法的据点多波机制，结算口径不变\n"
          u"               （expPowerOf 仍按守备值折算守军/城防；战报里的【围攻】记录照旧）；仅此预估提示行退役。 */\n")
rep(U, 'B1 siege 行下线', B1_OLD, B1_NEW, u'提示行**整条下线**')

# ── B2a ui.js：预估移左列下方（道具/辎重之后） ──
B2A_OLD = u"""    if (ui._expOwn) html += ui.expCargoHTML(c);

    /* 右列（独占）：**兵种及数量** + （战斗型任务）预估
       v89.156 老板 2：可用道具整块搬去左列（下拉框形态），右列不再有它；
       老板 3：预估仅"战斗型任务（非己方）"提供，位于派遣兵力**下方** ——
       己方野地 / 己方城池无需预估（本境调运与驻守没有战果可估）。 */"""
B2A_NEW = u"""    if (ui._expOwn) html += ui.expCargoHTML(c);
    /* v89.200（老板 3）：预估**移回左列下方**（v89.156 曾随老板令搬右列，此令再搬回）——
       位置 = 左列最底（可用道具/辎重之后）；渲染条件不变：仅战斗型任务
       （本境调运与驻守没有战果可估，不渲染）。 */
    if (!ui._expOwn && !isOwnWild137) html += ui.expEstBlockHTML();

    /* 右列（独占）：**兵种及数量**（v89.156 老板 2：可用道具整块搬去左列；
       v89.200 老板 3：预估移回左列下方 —— 右列只留兵力表）。 */"""
rep(U, 'B2a 预估移左列', B2A_OLD, B2A_NEW, u'预估**移回左列下方**')

# ── B2b ui.js：右列删预估调用 ──
B2B_OLD = u"""    html += '</div>';
    if (!ui._expOwn && !isOwnWild137) html += ui.expEstBlockHTML();
    html += '</div></div>';  /* /.exp-col-r /.exp-grid */"""
B2B_NEW = u"""    html += '</div>';
    /* v89.200（老板 3）：预估调用已移左列下方（见上）——右列只剩兵力表。 */
    html += '</div></div>';  /* /.exp-col-r /.exp-grid */"""
rep(U, 'B2b 右列删预估', B2B_OLD, B2B_NEW, u'预估调用已移左列下方（见上）')

# ── B3a index.html：.exp-row 加右侧预留 10 字 ──
B3A_OLD = u"""  .exp-row { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-2); }"""
B3A_NEW = u"""  /* v89.200（老板 1）：「下拉框固定长度，给右侧留 10 个字的空间」——
     行内下拉右缘统一停在同一竖线（距行右 10 字 = 10 × --fs-sub，即 120px）；
     「详情/设置/使用」链接改绝对定位、贴行右端（从预留区里出）——
     于是**所有模块的下拉框等宽**（判据：实机量跨模块 select 宽去重 1 值）。
     该规则同时作用于出征面板与「自动出征·详细配置」弹窗（同一行工厂）。 */
  .exp-row { position: relative; display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-2);
    padding-right: calc(var(--fs-sub) * 10); }"""
rep(H, 'B3a 行右侧预留', B3A_OLD, B3A_NEW, u'padding-right: calc(var(--fs-sub) * 10); }')

# ── B3b index.html：行内链接绝对定位（贴行右端） ──
B3B_OLD = u"""  .exp-tac-link { color: var(--gold-light); cursor: pointer; text-decoration: underline; margin-left: var(--sp-2); }"""
B3B_NEW = u"""  /* v89.200（老板 1）：行内链接贴行右端（行右预留区 = 10 字）——从流内改为绝对定位，
     下拉框因此吃满到预留区左缘（各模块等宽）。非行内使用（如标注文案）不受影响。 */
  .exp-row > .exp-tac-link { position: absolute; right: 0; top: 50%; transform: translateY(-50%); margin-left: 0; }
  .exp-tac-link { color: var(--gold-light); cursor: pointer; text-decoration: underline; margin-left: var(--sp-2); }"""
rep(H, 'B3b 链接绝对定位', B3B_OLD, B3B_NEW, u'.exp-row > .exp-tac-link { position: absolute')

# ── B3c index.html：目标/主将两块固定 2 行高 ──
B3C_OLD = u"""  .exp-row > .exp-one { flex: 1 1 auto; min-width: 0; color: var(--text-dim); font-size: var(--fs-sub);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }"""
B3C_NEW = u"""  .exp-row > .exp-one { flex: 1 1 auto; min-width: 0; color: var(--text-dim); font-size: var(--fs-sub);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* v89.200（老板 1）：目标 / 主将两块**固定为 2 行文字的高度**（实机基线 67px：
     下拉行 26 + 信息行（相称建议 / 精力·体力）23 + 块内边距与行距 18）——
     信息行缺内容时也按 2 行占位（两块等高、版面稳定；特殊情况如"驻将说明"
     出现时仍可自然撑高，min-height 只保下限）。 */
  .exp-a-target, .exp-a-gen { min-height: 67px; }"""
rep(H, 'B3c 两块固定 2 行高', B3C_OLD, B3C_NEW, u'.exp-a-target, .exp-a-gen { min-height: 67px; }')

print('批次B 完成')
