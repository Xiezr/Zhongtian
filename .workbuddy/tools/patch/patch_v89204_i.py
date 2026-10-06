# -*- coding: utf-8 -*-
"""v89.204 批次 I：index.html —— 需求 2 样式
  I1 .pager 三栏 grid（页码居中）+ pg-side 规则
  I2 .bottombar .pager 右留白（缩略图不重叠）
  I3 .forge-set-note / .fsn-* 整族退役（墓碑）
  I4 共享分区标题选择器去 .fsn-t
  I5 .enh-card .ec-cost 退役（墓碑）
"""
import io

P = 'E:/Deepseekdb/index.html'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, old, new, mark, cnt=1):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(P, s.replace(old, new))
    print('[ok] ' + tag)

# ── I1 .pager 主段 ──
rep('I1 .pager 三栏',
    """  /* ============ 分页条（v14.1：长列表不再无限下拉） ============ */
  .pager {
    display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
    gap: var(--sp-1); margin: var(--sp-mid) 0 var(--sp-1); padding: var(--sp-3) var(--sp-4);
    background: rgba(var(--sh-rgb), .22); border: 1px solid var(--line-strong); border-radius: var(--r-md);
  }
  .pager .btn.sm { min-width: 32px; }
  .pager .btn[disabled] { opacity: .35; cursor: not-allowed; }
  .pager .pg-info { color: var(--text-dim); font-size: var(--fs-sub); margin-left: var(--sp-3); }""",
    """  /* ============ 分页条（v14.1：长列表不再无限下拉） ============ */
  /* v89.204（老板 2）：「其页码固定显示位置为居中，其他菜单按钮位置合理排布」——
     三栏 grid：左 = 前导导航（首页/上页/数字页）· 中 = 页码信息**恒定居中** ·
     右 = 后导导航（下页/末页）。左右 1fr 等宽 ⇒ 中栏永远落在正中央（与按钮多少无关）。
     width:100%：在弹窗 foot / 底栏（均为 flex 容器）里独占满行，"居中"才是整条的中轴。 */
  .pager {
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%;
    gap: var(--sp-1); margin: var(--sp-mid) 0 var(--sp-1); padding: var(--sp-3) var(--sp-4);
    background: rgba(var(--sh-rgb), .22); border: 1px solid var(--line-strong); border-radius: var(--r-md);
  }
  .pager .pg-side { display: flex; align-items: center; gap: var(--sp-1); flex-wrap: wrap; min-width: 0; }
  .pager .pg-side.l { justify-content: flex-start; }
  .pager .pg-side.r { justify-content: flex-end; }
  .pager .btn.sm { min-width: 32px; }
  .pager .btn[disabled] { opacity: .35; cursor: not-allowed; }
  .pager .pg-info { color: var(--text-dim); font-size: var(--fs-sub); text-align: center; white-space: nowrap; }
  /* 单元素态（暂无记录 / 共 N 项）：独立居中（三栏 grid 下默认会落左栏） */
  .pager > .pg-info:only-child { grid-column: 2; }""",
    '页码信息**恒定居中**')

# ── I2 .bottombar .pager ──
rep('I2 底栏留白',
    """  .bottombar .pager {
    margin: 0; padding: var(--sp-1) var(--sp-4); background: transparent; border: none;
  }""",
    """  .bottombar .pager {
    /* v89.204：三栏满行后右缘贴到条尾 —— 留 52px 给绝对定位的缩略图（40px + right 10px） */
    margin: 0 52px 0 0; padding: var(--sp-1) var(--sp-4); background: transparent; border: none;
  }""",
    '留 52px 给绝对定位的缩略图')

# ── I3 fsn 段退役 ──
rep('I3 fsn 墓碑',
    """  .forge-set-note { margin-top: var(--sp-mid); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-lg);
    background: rgba(var(--sh-rgb),.24); border: 1px solid var(--line); }
  .fsn-t { color: var(--gold-light); margin-bottom: var(--sp-2); }   /* v82：字号/字重走分区标题共享 */
  .fsn-row { display: flex; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-1); }
  .fsn-name { font-size: var(--fs-sub); font-weight: 700; color: var(--hero-tag); min-width: 62px; }
  .fsn-n { font-size: var(--fs-cap); color: var(--text-dim); }
  .fsn-tiers { font-size: var(--fs-cap); color: var(--text-dim); line-height: var(--lh-body); }
  .fsn-tiers i { font-style: normal; margin-right: var(--sp-3); }
  .fsn-tiers i::before { content: '\u00b7'; margin-right: var(--sp-1); color: var(--gold-dark); }""",
    """  /* \u26d4 v89.204（老板 2）：「打造界面不要'套装效果一览'」——
     .forge-set-note / .fsn-t / .fsn-row / .fsn-name / .fsn-n / .fsn-tiers 整族随该功能退役
     （函数与按钮同批删除，见 js/ui.js 墓碑；回退点 = v89.203 快照）。 */""",
    '\u26d4 v89.204（老板 2）：「打造界面不要')

# ── I4 共享选择器 ──
rep('I4 共享选择器',
    """  .gp-sec, .fsn-t, .op-zone-t, .seal-h {          /* v89.105：.ledger-sec 随统计页退役（永不匹配） */""",
    """  .gp-sec, .op-zone-t, .seal-h {                  /* v89.105：.ledger-sec 随统计页退役 · v89.204：.fsn-t 随套装一览退役 */""",
    'v89.204：.fsn-t 随套装一览退役')

# ── I5 ec-cost 退役 ──
rep('I5 ec-cost 墓碑',
    """  .enh-card .ec-cost { font-size: var(--fs-sub); color: var(--text-dim); white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }""",
    """  /* \u26d4 v89.204（老板 2）：「强化界面的资源要求请以悬停显示，而不是直接占用位置」——
     .ec-cost（卡面成本行）退役：成本并入 title（百炼/蕴养两处同改，见 js/ui.js）。 */""",
    '成本并入 title（百炼/蕴养两处同改')

print('patch I done')
