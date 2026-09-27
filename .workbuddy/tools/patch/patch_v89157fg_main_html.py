# -*- coding: utf-8 -*-
# v89.157 补丁 F：main.js —— report-rounds 动作接线  /  补丁 G：index.html —— 进度条缩短 + 消息徽章/复盘样式
import io

# ---------- F：main.js ----------
PM = 'E:/Deepseekdb/js/main.js'
m = io.open(PM, encoding='utf-8', newline='').read()
OLD = u"""      case 'open-sandbox': ui.openSandbox(Number(el.dataset.rid)); break;  /* v89.120：身份 rid */"""
NEW = u"""      case 'open-sandbox': ui.openSandbox(Number(el.dataset.rid)); break;  /* v89.120：身份 rid */
      /* v89.157（老板「逐回合文字复盘」）：战报逐回合文字（独立弹窗 · 分页） */
      case 'report-rounds': ui.openReportRounds(Number(el.dataset.rid)); break;"""
if u"case 'report-rounds'" in m:
    print('F skip（已落盘）')
else:
    assert m.count(OLD) == 1, 'F count=' + str(m.count(OLD))
    io.open(PM, 'w', encoding='utf-8', newline='').write(m.replace(OLD, NEW))
    print('F OK')

# ---------- G：index.html ----------
PH = 'E:/Deepseekdb/index.html'
h = io.open(PH, encoding='utf-8', newline='').read()
done = []

# G1：进度条缩短（132 → 106；三条状态行不再折行 —— 实测列宽 266px）
OLD1 = u"""  .gd-line .gd-bar { flex: none; width: 132px; }"""
NEW1 = u"""  .gd-line .gd-bar { flex: none; width: 106px; }   /* v89.157（老板 2）：132→106 —— 实测列宽 266px，132 时整行超出折成 2 行 */"""
if u'width: 106px; }   /* v89.157（老板 2）' in h:
    done.append('G1 skip')
else:
    assert h.count(OLD1) == 1, 'G1 count=' + str(h.count(OLD1))
    h = h.replace(OLD1, NEW1); done.append('G1 OK')

OLD1b = u"""    进度条等长（132px）；按钮贴右沿用既有 .gd-line .gd-plus（margin-left:auto）。 */"""
NEW1b = u"""    进度条等长（v89.157 起 106px）；按钮贴右沿用既有 .gd-line .gd-plus（margin-left:auto）。 */"""
if h.count(u'进度条等长（v89.157 起 106px）') == 1:
    done.append('G1b skip')
else:
    assert h.count(OLD1b) == 1, 'G1b count=' + str(h.count(OLD1b))
    h = h.replace(OLD1b, NEW1b); done.append('G1b OK')

# G2：消息徽章 + 主题竖条 + 逐回合复盘样式（插在 .bb-line .bl-t 之后）
ANCH2 = u"""  .bb-line .bl-t { color: var(--text-dim); margin-right: var(--sp-2);
    font-variant-numeric: tabular-nums; letter-spacing: 0; }"""
NEW2 = ANCH2 + u"""
  /* v89.157（老板 1）：「各类消息没有有效区分，或区分度不强」——
     系统页消息 = 左侧主题色竖条 + 主题徽章（图标 + 名），颜色由 DATA.MSG_SUBS 注入行内 style；
     这里只写结构与底样（不各写一份颜色）。 */
  .bb-line.bb-sub { border-left: 3px solid transparent; padding-left: var(--sp-2); }
  .bb-line .ml-tag {
    display: inline-block; margin-right: var(--sp-2); padding: 0 var(--sp-1);
    border-radius: var(--r-xs); border: 1px solid; font-size: var(--fs-cap);
    line-height: var(--lh-tight); vertical-align: 1px; white-space: nowrap;
  }
  /* v89.157：逐回合文字复盘（战报 · 独立弹窗；一回合一行，隔行浅底助扫读） */
  .rt-rounds { border-top: 1px dashed var(--line-strong); }
  .rt-round {
    padding: var(--sp-1) var(--sp-2); border-bottom: 1px dashed var(--line-strong);
    font-size: var(--fs-body); line-height: var(--lh-body); word-break: break-all;
  }
  .rt-round:nth-child(odd) { background: rgba(var(--sh-rgb), .18); }"""
if u'.bb-line.bb-sub {' in h:
    done.append('G2 skip')
else:
    assert h.count(ANCH2) == 1, 'G2 count=' + str(h.count(ANCH2))
    h = h.replace(ANCH2, NEW2); done.append('G2 OK')

io.open(PH, 'w', encoding='utf-8', newline='').write(h)
chk = io.open(PH, encoding='utf-8', newline='').read()
assert chk.count(u'.bb-line.bb-sub {') == 1 and chk.count(u'.rt-round {') == 1
assert chk.count(u'width: 106px') >= 1
print('patch G done:', done)
