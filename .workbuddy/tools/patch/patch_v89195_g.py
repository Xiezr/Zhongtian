# -*- coding: utf-8 -*-
"""v89.195 补丁G：前哨总览分页 13→8（档位一览表占高，防溢出）
G1 ui.js  modalPage('outposts', …, 13) → 8
G2 ui.js  头注「分页 13 行」→「分页 8 行」"""
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

G1_OLD = "    var pgW = ui.modalPage('outposts', list, 13, function () { ui.openOutposts(); });"
G1_NEW = """    /* v89.195：13 → 8（档位一览表占高 ~170px；实机满页压测溢出 150px，
       每行 ~30px → 减 5 行消除）—— 分页只在前哨 > 8 处时出现。 */
    var pgW = ui.modalPage('outposts', list, 8, function () { ui.openOutposts(); });"""
rep('js/ui.js', 'G1 outposts-page', G1_OLD, G1_NEW, 'v89.195：13 → 8（档位一览表占高')

G2_OLD = "   *   分页 13 行；顶部\"每城上限 5 · 本城 n/5\"；底部各城占用小结）。"
G2_NEW = "   *   分页 8 行（v89.195 起：档位一览表占高）；顶部\"每城上限 5 · 本城 n/5\"；底部各城占用小结）。"
rep('js/ui.js', 'G2 outposts-doc', G2_OLD, G2_NEW, '分页 8 行（v89.195 起：档位一览表占高）')

print('补丁G 完成')
