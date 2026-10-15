# -*- coding: utf-8 -*-
"""v89.149 批 E4：index.html CSS —— ① 战场条填满 board 行（拉到回合记录上方）
② 兵牌按 --rel 纵向铺满（含 dense 紧凑档）③ 侧栏随行同高（撤 330 上限）④ 注释同步"""
import io

P = 'E:/Deepseekdb/index.html'
BAK = 'E:/Deepseekdb/backup/v89149/index.html.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()


def rep(old, new, tag, cnt=1):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag)
        return
    n = s.count(old)
    assert n == cnt, '锚点数不对 [' + tag + '] count=' + str(n) + ' 期望=' + str(cnt)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① board 行拉满 + 侧栏同高 ----------
rep("""  .bt-board { flex: 1 1 auto; min-height: 0; overflow: hidden;
    display: grid; grid-template-columns: 1.1fr 3.8fr 1.1fr; gap: var(--sp-2); align-items: start; }
  /* v89.148（老板 3）：列表不超过示意图高度（330）· 超出内部滚动 —— 布局高度恒定 */
  .bt-side { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0;
    max-height: 330px; overflow-y: auto; }""",
    """  /* v89.149（老板 5）：「中间战场区域的下方**拉到回合记录的上方**（高度拉高）」——
     旧口径 `align-items: start` + 定高 330 → **内容撑多高就多高**：3 队兵时战场条只有 203px，
     而 board 行有 339px，底边离回合记录留 140px 空白（实机）。现在整行拉满：
       `grid-template-rows: minmax(0, 1fr)`（唯一一行 = 容器高，防 auto 行被内容撑破）
       + `align-items: stretch`（三列都长到行高 —— 战场条与两侧列表同高）。 */
  .bt-board { flex: 1 1 auto; min-height: 0; overflow: hidden;
    display: grid; grid-template-columns: 1.1fr 3.8fr 1.1fr; grid-template-rows: minmax(0, 1fr);
    gap: var(--sp-2); align-items: stretch; }
  /* v89.149：列表随行同高（撤 330 上限）· 超出仍在列表内部滚动 —— 布局高度恒定 */
  .bt-side { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0;
    max-height: 100%; overflow-y: auto; }""",
    'board/side')

# ---------- ② 战场条：撤定高（交给 stretch） ----------
rep("""     v89.148（老板 3）：「**战场示意图高度固定**」——`min-height: 120` 改**定高 330**
     （可容 6 队兵牌：6×42 + 21 + 26 ≈ 299 < 330；不再是"内容撑多高就多高"）。 */
  .bt-field { position: relative; height: 330px; margin: var(--sp-0) 0 var(--sp-3); border-radius: var(--r-xl);""",
    """     v89.148（老板 3）：「**战场示意图高度固定**」——`min-height: 120` 改**定高 330**。
     ⛔ v89.149（老板 5）这条被推翻：「下方**拉到回合记录的上方**（高度拉高）」——
     高度不再定值，由 board 行的 `stretch` 决定（= 行高 − 外边距，正好顶到回合记录上沿）。 */
  .bt-field { position: relative; margin: var(--sp-0) 0 var(--sp-3); border-radius: var(--r-xl);""",
    'bt-field 撤定高')

# ---------- ③ 兵牌：纵向铺满（--rel）+ 紧凑档 ----------
rep("""  .bt-unit { position: absolute; transform: translateX(-50%); display: flex; align-items: center;
    padding: var(--sp-0) var(--sp-1); border-radius: var(--r-lg); white-space: nowrap;
    transition: left .55s cubic-bezier(.4, .8, .4, 1); }
  .bt-unit .bt-ico svg, .bt-unit .bt-ico img { width: 26px; height: 26px; vertical-align: middle; }""",
    """  /* v89.149（老板 5）：兵牌**纵向铺满**整个战场条 ——
     `--rel`（0~1 的无单位数，渲染时按 `i / n` 给）决定纵向位置：
       atk 第 i 队 = i/n；def 第 i 队 = (i+0.5)/n（错半行，与 v89.103 同规，不互相遮）。
     牌高写进 CSS（30px）：`top = (100% − 牌高) × --rel` —— 最后一队正好贴底、不越界。 */
  .bt-unit { position: absolute; transform: translateX(-50%); display: flex; align-items: center;
    height: 30px; top: calc((100% - 30px) * var(--rel, 0));
    padding: var(--sp-0) var(--sp-1); border-radius: var(--r-lg); white-space: nowrap;
    transition: left .55s cubic-bezier(.4, .8, .4, 1); }
  .bt-unit .bt-ico svg, .bt-unit .bt-ico img { width: 26px; height: 26px; vertical-align: middle; }
  /* 兵种数 > 8 队时的紧凑档（渲染时挂 .bt-field.dense）：牌 30→24px、图标 26→20px ——
     12 队（极端载荷）也能一屏放下，不再把兵牌叠在一起。 */
  .bt-field.dense .bt-unit { height: 24px; top: calc((100% - 24px) * var(--rel, 0)); }
  .bt-field.dense .bt-unit .bt-ico svg, .bt-field.dense .bt-unit .bt-ico img { width: 20px; height: 20px; }""",
    'bt-unit 铺满 + dense')

# （④ 注释同步那条在 ui.js 里，本批不动）

# 写后哨兵
assert '.bt-field { position: relative; margin:' in s
assert 'align-items: stretch; }' in s
assert '--rel, 0' in s
assert '.bt-field { position: relative; height: 330px' not in s, '战场条定高残留'
assert 'grid-template-rows: minmax(0, 1fr);\n    gap: var(--sp-2); align-items: stretch; }' in s, 'board 行模板未落'
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏不一致'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('index.html 落盘 · len=' + str(len(s)))
