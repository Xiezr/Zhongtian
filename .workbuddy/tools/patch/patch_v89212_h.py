# -*- coding: utf-8 -*-
# v89.212：e2e 里 §158/§160 用例改按资源口径（规则变更连带）
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark=None, cnt=1):
    s = rd(path)
    if mark and s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

E2 = 'E:/Deepseekdb/e2e-test.js'

# ---------------- H1: §158 e2e 按资源 ----------------
rep(E2, 'H1 §158 e2e grain 口径',
    """    const st158 = G.state, c158 = G.currentCity();
    const cap158 = G.storeCapOf(c158);
    const bkG158 = st158.res.grain;""",
    """    const st158 = G.state, c158 = G.currentCity();
    const cap158 = G.storeCapOf(c158, 'grain');   /* v89.212（老板 1）：按资源上限（堆场分账） */
    const bkG158 = st158.res.grain;""",
    "storeCapOf(c158, 'grain')")

# ---------------- H2: §160① 面板造局按资源 ----------------
rep(E2, 'H2 §160 面板 grain 口径',
    """    const c160 = G.currentCity();
    const cap160 = G.storeCapOf(c160);
    const bkG160 = c160.res.grain, bkAt160 = G.state.overflowAt, bkW160 = G.state.world.elapsed;
    c160.res.grain = cap160 + 123456;""",
    """    const c160 = G.currentCity();
    const cap160 = G.storeCapOf(c160, 'grain');   /* v89.212（老板 1）：按资源上限（堆场分账） */
    const bkG160 = c160.res.grain, bkAt160 = G.state.overflowAt, bkW160 = G.state.world.elapsed;
    c160.res.grain = cap160 + 123456;""",
    "storeCapOf(c160, 'grain')")

# ---------------- H3: §160② tick 造局 ----------------
rep(E2, 'H3 §160 tick 造局 grain 口径',
    """    c2.res.grain = G.storeCapOf(c2) + 100000;
    const bkGold160 = c2.res.gold;""",
    """    c2.res.grain = G.storeCapOf(c2, 'grain') + 100000;   /* v89.212（老板 1）：逾溢按资源上限 */
    const bkGold160 = c2.res.gold;""",
    "storeCapOf(c2, 'grain') + 100000")

# ---------------- H4: §160② 断言 grain 口径 ----------------
rep(E2, 'H4 §160 断言 grain 口径',
    """    check('v89.160① 真 tick 后的存量 = 超出部分掉 25%（cap+100000 → cap+75000）',
      Math.abs(c2.res.grain - (G.storeCapOf(c2) + 75000)) < 5000,
      'grain ' + Math.round(c2.res.grain) + ' · cap ' + Math.round(G.storeCapOf(c2)));""",
    """    check('v89.160① 真 tick 后的存量 = 超出部分掉 25%（cap+100000 → cap+75000 · v89.212 按粮口径）',
      Math.abs(c2.res.grain - (G.storeCapOf(c2, 'grain') + 75000)) < 5000,
      'grain ' + Math.round(c2.res.grain) + ' · cap ' + Math.round(G.storeCapOf(c2, 'grain')));""",
    "v89.212 按粮口径")

print('--- H 批完成 ---')
