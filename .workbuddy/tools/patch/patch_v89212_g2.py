# -*- coding: utf-8 -*-
# v89.212：测试升级（续）—— §159⑤ ×2 / §160① ×2 改按资源口径
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if mark and s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

SM = 'E:/Deepseekdb/smoke-test.js'

# ---------------- G8a: §159⑤ addResCapped ----------------
rep(SM, 'G8a §159⑤ addResCapped 按资源',
    """        var cap = G.storeCapOf(c);
        st.res.grain = cap + 123456;
        var r1 = G.addResCapped('grain', 1000, c);""",
    """        var cap = G.storeCapOf(c, 'grain');   /* v89.212（老板 1）：入账按资源上限（堆场分账） */
        st.res.grain = cap + 123456;
        var r1 = G.addResCapped('grain', 1000, c);""",
    "v89.212（老板 1）：入账按资源上限（堆场分账）")

# ---------------- G8b: §159⑤ 采集收获 ----------------
rep(SM, 'G8b §159⑤ 采集按资源',
    """        var cap = G.storeCapOf(c);
        st.res.grain = cap + 50000;
        var before = st.res.grain;
        var fin = G.finishGather('smoke159g');""",
    """        var cap = G.storeCapOf(c, 'grain');   /* v89.212（老板 1）：收获按资源上限（堆场分账） */
        st.res.grain = cap + 50000;
        var before = st.res.grain;
        var fin = G.finishGather('smoke159g');""",
    "v89.212（老板 1）：收获按资源上限（堆场分账）")

# ---------------- G9a: §160① 第 1 条 ----------------
rep(SM, 'G9a §160① 逾溢按资源（1 期）',
    """          var cap = G.storeCapOf(c);
          G.res(c).grain = cap + 100000; G.res(c).gold = 9e9;""",
    """          var cap = G.storeCapOf(c, 'grain');   /* v89.212（老板 1）：逾溢按资源上限（堆场分账） */
          G.res(c).grain = cap + 100000; G.res(c).gold = 9e9;""",
    "v89.212（老板 1）：逾溢按资源上限（堆场分账）")

# ---------------- G9b: §160① 第 2 条 ----------------
rep(SM, 'G9b §160① 逾溢按资源（多期）',
    """          var cap = G.storeCapOf(c);
          st.overflowAt = st.world.elapsed;
          G.res(c).grain = cap + 100000;
          st.world.elapsed += 2 * 86400;""",
    """          var cap = G.storeCapOf(c, 'grain');   /* v89.212（老板 1）：逾溢多期同口径 */
          st.overflowAt = st.world.elapsed;
          G.res(c).grain = cap + 100000;
          st.world.elapsed += 2 * 86400;""",
    "v89.212（老板 1）：逾溢多期同口径")

print('--- G8-G9 完成 ---')
