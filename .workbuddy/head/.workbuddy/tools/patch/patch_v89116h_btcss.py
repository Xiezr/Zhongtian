# -*- coding: utf-8 -*-
"""v89.116 补丁 H：战场新布局的 CSS + 退役 btCmdHTML / bt-cmd* 样式

· `.bt-board` = 1fr 2fr 1fr 三列（左我军 / 中战场 / 右敌军），对应老板"左右各四分之一、中间二分之一"；
· 战场令牌 `.bt-unit` 收敛为**一枚图标**（加大到 26px，去名称与数量）；
· `.bt-side / .bt-rrow` = 侧栏兵种行：图标 + **图标下的数量** + 动作/目标下拉；
· `ui.btCmdHTML`（旧"逐兵种指令"块）与 `.bt-cmd*` 样式**整条退役**（不留死代码）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'


def main():
    # ---------- ① CSS：替换战场样式段 ----------
    p = R + 'index.html'
    s = io.open(p, encoding='utf-8').read()
    OLD = """  .bt-unit { position: absolute; transform: translateX(-50%); display: flex; align-items: center;
    gap: var(--sp-1); padding: var(--sp-1) var(--sp-3); border-radius: var(--r-lg); font-size: var(--fs-sub); white-space: nowrap;
    transition: left .55s cubic-bezier(.4, .8, .4, 1); }
  .bt-unit .bt-ico svg, .bt-unit .bt-ico img { width: 20px; height: 20px; vertical-align: middle; }
  .bt-unit .bt-n { color: var(--gold-light); }
  .bt-unit.atk { background: rgba(var(--gold-soft-rgb), .16); border: 1px solid rgba(var(--gold-soft-rgb), .5); }
  .bt-unit.def { background: rgba(var(--foe-rgb),.16); border: 1px solid rgba(var(--foe-rgb),.48); }
  .bt-unit.def .bt-n { color: var(--red-light); }
  .bt-unit.hit { animation: btHit .36s ease; }"""
    NEW = """  /* v89.116（老板需求 8）：战场令牌**只画兵种图标**（名称与数量移到两侧列表） */
  .bt-unit { position: absolute; transform: translateX(-50%); display: flex; align-items: center;
    padding: var(--sp-0) var(--sp-1); border-radius: var(--r-lg); white-space: nowrap;
    transition: left .55s cubic-bezier(.4, .8, .4, 1); }
  .bt-unit .bt-ico svg, .bt-unit .bt-ico img { width: 26px; height: 26px; vertical-align: middle; }
  .bt-unit.atk { background: rgba(var(--gold-soft-rgb), .16); border: 1px solid rgba(var(--gold-soft-rgb), .5); }
  .bt-unit.def { background: rgba(var(--foe-rgb),.16); border: 1px solid rgba(var(--foe-rgb),.48); }
  .bt-unit.hit { animation: btHit .36s ease; }
  /* ---- 上部分三段：左我军（1/4）· 中战场（1/2）· 右敌军（1/4） ---- */
  .bt-board { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: var(--sp-3); align-items: start; }
  .bt-side { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0; }
  .bt-side-h { font-size: var(--fs-cap); color: var(--text-dim); padding: 0 var(--sp-1) var(--sp-0); }
  .bt-rrow { display: flex; align-items: center; gap: var(--sp-1); padding: var(--sp-0) var(--sp-1);
    border-radius: var(--r-md); background: rgba(var(--sh-rgb), .26); border: 1px solid var(--line);
    min-width: 0; }
  .bt-side.mine .bt-rrow { border-color: rgba(var(--gold-soft-rgb), .38); }
  .bt-side.foe .bt-rrow { border-color: rgba(var(--foe-rgb), .34); }
  .bt-rrow.dead { opacity: .38; }
  .bt-ric { display: flex; flex-direction: column; align-items: center; flex: none; width: 40px;
    line-height: 1.1; }
  .bt-ric .bt-ico svg, .bt-ric .bt-ico img { width: 20px; height: 20px; vertical-align: middle; }
  .bt-ric .bt-rn { font-size: var(--fs-cap); color: var(--gold-light); font-variant-numeric: tabular-nums; }
  .bt-side.foe .bt-ric .bt-rn { color: var(--red-light); }
  .bt-ric .bt-rnm { font-size: var(--fs-cap); color: var(--text-dim); font-style: normal;
    max-width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bt-side .bt-sel { flex: 1 1 0; min-width: 0; }
  .bt-side .bt-ro { flex: 1 1 0; min-width: 0; font-size: var(--fs-cap); color: var(--text-dim);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }"""
    if s.count(OLD) != 1:
        print('!! CSS 战场段匹配 %d 次 → 中止' % s.count(OLD))
        return 1
    s = s.replace(OLD, NEW, 1)

    # 退役旧的"逐兵种指令"块样式
    OLD2 = """  .bt-cmd { margin-top: var(--sp-3); }
  .bt-cmd-h { font-size: var(--fs-cap); color: var(--text-dim); margin: var(--sp-0) 0 var(--sp-1); }
  .bt-cmdrow { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-1) 0; flex-wrap: wrap; }
  .bt-cmdrow .bt-ico svg, .bt-cmdrow .bt-ico img { width: 18px; height: 18px; vertical-align: middle; }
  .bt-cmdnm { min-width: 62px; font-size: var(--fs-sub); }
  .bt-cmdst { display: inline-flex; gap: var(--sp-1); }
  .bt-btn { padding: var(--sp-0) var(--sp-4); border-radius: var(--r-md); cursor: pointer; font-size: var(--fs-cap);
    border: 1px solid rgba(var(--gold-soft-rgb), .32); background: rgba(var(--sh-rgb), .42);
    color: var(--text-dim); }
  .bt-btn:hover { color: var(--gold-light); border-color: rgba(var(--gold-soft-rgb), .6); }
  .bt-btn.on { color: var(--ink-on-gold); background: var(--grad-gold);
    border-color: rgb(var(--gold-rgb)); }"""
    NEW2 = """  /* ⛔ v89.116：`.bt-cmd / .bt-cmdrow / .bt-btn` 整段退役 ——
     "逐兵种指令"从**下半页三个并排按钮**搬进了左上/右上的兵种行（下拉框），
     旧样式已无消费点（老板：「前进驻守撤退通过下拉框选择，不要直接列出，节省空间」）。 */"""
    if s.count(OLD2) != 1:
        print('!! 旧指令块样式匹配 %d 次 → 中止' % s.count(OLD2))
        return 1
    s = s.replace(OLD2, NEW2, 1)

    # 播报窗：一回合一行，留 12 行的可视高度
    OLD3 = """  .bt-log { max-height: 118px; overflow-y: auto; background: rgba(var(--sh-rgb), .3);
    border-radius: var(--r-lg); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-sub); line-height: 1.75; }"""
    NEW3 = """  /* v89.116：播报窗 —— **一回合一行**（行动与战果同行），留 12 行的可视高度、
     超出滚动（.bt-ev.round 是新的回合行；旧的逐条事件样式保留给"静默闪烁"路径的兼容）。 */
  .bt-log { max-height: 150px; overflow-y: auto; background: rgba(var(--sh-rgb), .3);
    border-radius: var(--r-lg); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-sub); line-height: 1.7;
    margin-top: var(--sp-3); }
  .bt-ev.round { color: var(--parchment); }
  .bt-ev.round b { color: var(--gold-light); }"""
    if s.count(OLD3) != 1:
        print('!! .bt-log 匹配 %d 次 → 中止' % s.count(OLD3))
        return 1
    s = s.replace(OLD3, NEW3, 1)

    # ---------- ② 退役 ui.btCmdHTML ----------
    p2 = R + 'js/ui.js'
    t = io.open(p2, encoding='utf-8').read()
    i0 = t.find('  /* ---- 指令区（我方每兵种一行：动作三选 + 目标） ---- */')
    i1 = t.find('  ui.battlefieldHTML = function (rec) {')
    if i0 < 0 or i1 < 0 or i1 <= i0:
        print('!! btCmdHTML 定位失败 i0=%d i1=%d → 中止' % (i0, i1))
        return 1
    tomb = """  /* ⛔ v89.116：`ui.btCmdHTML`（旧"逐兵种指令"块：三个并排按钮 + 目标下拉）**整条退役** ——
     动作/目标的设置全部搬进两侧兵种列表（`ui.btSideHTML`，动作改下拉框）。
     老板：「前进驻守撤退通过下拉框选择，不要直接列出，节省空间」。 */

"""
    t = t[:i0] + tomb + t[i1:]

    bak = R + '.workbuddy/backup/v89116/'
    for pp, content in ((p, s), (p2, t)):
        b = io.open(bak + os.path.basename(pp), encoding='utf-8').read()
        d0 = (content.count('{') - content.count('}')) - (b.count('{') - b.count('}'))
        if d0 != 0:
            print('!! %s 花括号净变化 %+d → 中止' % (pp, d0))
            return 1
        tmp = pp + '.tmp116h'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(content)
        os.replace(tmp, pp)
        print('  → 落盘 %s（净 %+d）' % (os.path.basename(pp), d0))
    print('补丁 H 完成')
    return 0


sys.exit(main())
