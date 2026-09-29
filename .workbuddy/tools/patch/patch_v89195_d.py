# -*- coding: utf-8 -*-
"""v89.195 批次D：smoke 旧断言适配新机制（2 处）
D1 §v52 攻防换算：造局加"防补发"标记（v89.195 机制变更所致）
D2 §131⑩ op-zone-eq 计数 5→6（v89.195 前哨面板危险区）"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

D1_OLD = """    var st = G.newGame({ name: '换算' });
    var g = st.generals[0];
    /* 剥掉所有装备，先只验属性那一段 */
    g.equip = {};
    g.yw = 100; g.zm = 40; g.tong = 50;
    g.attack = 0; g.defense = 0;
    var a = G.genAttrs(g);"""
D1_NEW = """    var st = G.newGame({ name: '换算' });
    var g = st.generals[0];
    /* 剥掉所有装备，先只验属性那一段 */
    g.equip = {};
    g.yw = 100; g.zm = 40; g.tong = 50;
    /* v89.195（老板 3）机制适配：本用例要"攻防全零"的确定性口径 —— 关掉
       "攻防欠账补发"（否则 genAttrs→staMax→rankOf 链路会把 attack 从 0 补到
       资质标准线，本用例的被测变量被改）。 */
    g.atkAcc = 0; g.defAcc = 0;
    g.attack = 0; g.defense = 0;
    var a = G.genAttrs(g);"""
rep('smoke-test.js', 'D1 v52 造局防补发', D1_OLD, D1_NEW, 'g.atkAcc = 0; g.defAcc = 0;\n    g.attack = 0; g.defense = 0;', 1)

D2_OLD = """        && (u131s.match(/op-zone-eq/g) || []).length === 5   /* v89.152：+「产出」区 · v89.193：+前哨面板护持区 */"""
D2_NEW = """        && (u131s.match(/op-zone-eq/g) || []).length === 6   /* v89.152：+「产出」区 · v89.193：+前哨护持区 · v89.195：+前哨危险区（放手） */"""
rep('smoke-test.js', 'D2 op-zone-eq 计数', D2_OLD, D2_NEW, 'v89.195：+前哨危险区（放手）', 1)

print('批次D 完成')
