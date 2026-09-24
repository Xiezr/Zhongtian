# -*- coding: utf-8 -*-
"""v89.120 补丁 E：e2e D4 收藏用例升级（dataset.i → dataset.rid）

崩溃点：`const fi = Number(favBtn92.dataset.i)` —— 行上已改 `data-rid`，
`dataset.i` 是 undefined → `Number(undefined)=NaN` → `s92.reports[NaN].fav` 崩。
改用唯一出口 `G.repByRid(rid)` 取报告。

执行：python .workbuddy/tools/patch/patch_v89120e_e2e.py
"""
import io
import os
import sys

R = 'E:/Deepseekdb/'


def main():
    P = R + 'e2e-test.js'
    s = io.open(P, encoding='utf-8').read()
    OLD = """    const favBtn92 = document.querySelector('[data-action="rep-fav"]');
    check('v89.89（D4）：行内收藏星标在场', !!favBtn92);
    if (favBtn92) {
      const fi = Number(favBtn92.dataset.i);
      const beforeFav = !!s92.reports[fi].fav;
      click(favBtn92);
      await sleep(70);
      check('v89.89（D4）：点击收藏翻转（随档字段）', !!s92.reports[fi].fav === !beforeFav,
        'fav ' + beforeFav + ' → ' + s92.reports[fi].fav);
      s92.reports[fi].fav = false;
    } else {
      check('v89.89（D4）：点击收藏翻转（随档字段）', false, '星标缺失');
    }"""
    NEW = """    const favBtn92 = document.querySelector('[data-action="rep-fav"]');
    check('v89.89（D4）：行内收藏星标在场', !!favBtn92);
    if (favBtn92) {
      /* v89.120：行内身份改 **data-rid** —— 用唯一出口取报告（不再用数组下标取，
         数组位移会让旧下标指到别的报告 —— 这正是"战报异常跳转"的病根） */
      const frid = Number(favBtn92.dataset.rid);
      const fRep = G.repByRid(frid);
      const beforeFav = !!(fRep && fRep.fav);
      click(favBtn92);
      await sleep(70);
      const fRep2 = G.repByRid(frid);
      check('v89.89（D4）：点击收藏翻转（随档字段）', !!fRep2 && !!fRep2.fav === !beforeFav,
        'fav ' + beforeFav + ' → ' + (fRep2 ? fRep2.fav : 'null'));
      if (fRep2) fRep2.fav = false;
    } else {
      check('v89.89（D4）：点击收藏翻转（随档字段）', false, '星标缺失');
    }"""
    n = s.count(OLD)
    if n != 1:
        print('!! 锚点匹配 %d 次 → 中止' % n)
        return 1
    s = s.replace(OLD, NEW, 1)
    print('  ✓ e2e D4 收藏用例升级（rid）')
    tmp = P + '.tmp120e'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, P)
    print('补丁 E 完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
