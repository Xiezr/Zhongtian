# -*- coding: utf-8 -*-
"""v89.120 补丁 D：修 §101 两处断言写法（都是断言自己的问题，代码无 bug）

① 结构断言写错了 main.js 的调用形态：main 里是 `ui.viewReport(Number(el.dataset.rid))`
   （repByRid 在 viewReport 内部调），不是直接 `repByRid(...)`。
② 行为断言持有了**进推演前**的旧对象：`sdSimEnter` 会把 `sd.cur` 换成新对象，
   改设定改的是新对象 —— 断言必须**重绘后 refetch** 再读 stance。
   反面用例也随之修正：verify 只在"replay→sim 自动切换"时拦，
   所以要先 `sdSimExit()` 退回回放态再设 verify=false。

执行：python .workbuddy/tools/patch/patch_v89120d_sec101fix.py
"""
import io
import os
import sys

R = 'E:/Deepseekdb/'


def main():
    P = R + 'smoke-test.js'
    s = io.open(P, encoding='utf-8').read()
    bak = io.open(R + '.workbuddy/backup/v89120/smoke-test.js', encoding='utf-8').read()

    FIX = []

    # ---------------- ① 结构断言：main 的调用形态 ----------------
    FIX.append((
        """        && /data-action="open-sandbox" data-rid=/.test(u)
        && /repByRid\\(Number\\(el\\.dataset\\.rid\\)\\)/.test(m);
    })());""",
        """        && /data-action="open-sandbox" data-rid=/.test(u)
        /* main.js 侧：三个动作都改读 data-rid（repByRid 在 viewReport 内部调） */
        && /ui\\.viewReport\\(Number\\(el\\.dataset\\.rid\\)\\)/.test(m)
        && /ui\\.openSandbox\\(Number\\(el\\.dataset\\.rid\\)\\)/.test(m)
        && /ui\\.toggleRepFav\\(Number\\(el\\.dataset\\.rid\\)\\)/.test(m);
    })());""",
        '① 结构：main 调用形态'))

    # ---------------- ② 行为断言：refetch + 反面用例修正 ----------------
    FIX.append((
        """        var myList = (G.ui.sdOurSide(sd.sb) === 'atk' ? sd.cur.atk : sd.cur.def);
        var u0 = myList[0];
        if (!u0) { dbg = 'no unit'; return { ok: false, dbg: dbg }; }
        var st0 = u0.stance;
        G.ui.sdSetCmd(u0.id, { s: 'hold' });          /* 老板点「驻守」chip 走这里 */
        dbg = 'mode=' + sd.mode + ' cmd=' + JSON.stringify(sd.sim && sd.sim.cmds)
          + ' stance=' + st0 + '→' + u0.stance;
        okAll = sd.mode === 'sim' && !!sd.sim
          && !!sd.sim.cmds[u0.id] && sd.sim.cmds[u0.id].s === 'hold'
          && u0.stance === 'hold';
        /* 反面：校验未过 → 明确拒绝（不假装成功、不写 cmds） */
        sd.sb.verify = false;
        var before = JSON.stringify(sd.sim.cmds);
        G.ui.sdSetCmd(u0.id, { s: 'retreat' });
        denied = sd.mode === 'sim' && JSON.stringify(sd.sim.cmds) === before
          && u0.stance === 'hold';               /* retreat 没写进去 */
        sd.sb.verify = true;
        G.ui.closeAllModals();
        return { ok: okAll && denied, dbg: dbg + ' denied=' + denied };""",
        """        /* ⚠️ `sdSimEnter` 会把 `sd.cur` 换成**新对象** —— 断言必须重绘后 refetch
           （拿进推演前的旧对象去读 stance，永远是旧值 —— 首版就踩了这个） */
        var refetch = function () {
          var list = (G.ui.sdOurSide(sd.sb) === 'atk' ? sd.cur.atk : sd.cur.def);
          for (var i = 0; i < list.length; i++) if (list[i].id === tid0) return list[i];
          return null;
        };
        var list0 = (G.ui.sdOurSide(sd.sb) === 'atk' ? sd.cur.atk : sd.cur.def);
        if (!list0.length) { dbg = 'no unit'; return { ok: false, dbg: dbg }; }
        var tid0 = list0[0].id;
        var st0 = list0[0].stance;
        G.ui.sdSetCmd(tid0, { s: 'hold' });           /* 老板点「驻守」chip 走这里 */
        var uA = refetch(), uB = refetch();
        dbg = 'mode=' + sd.mode + ' cmd=' + JSON.stringify(sd.sim && sd.sim.cmds)
          + ' stance=' + st0 + '→' + (uA ? uA.stance : '?');
        okAll = sd.mode === 'sim' && !!sd.sim
          && !!sd.sim.cmds[tid0] && sd.sim.cmds[tid0].s === 'hold'
          && !!uA && uA.stance === 'hold';
        /* 反面：**退回回放态**再把 verify 打假 → 改设定被明确拒绝
           （verify 只在 replay→sim 的自动切换处拦；已在 sim 态时不再拦 —— 这是设计） */
        G.ui.sdSimExit();
        sd.sb.verify = false;
        var before = sd.sim ? JSON.stringify(sd.sim.cmds) : '{}';
        G.ui.sdSetCmd(tid0, { s: 'retreat' });
        var after = sd.sim ? JSON.stringify(sd.sim.cmds) : '{}';
        denied = sd.mode === 'replay' && after === before;    /* retreat 没写进去 */
        sd.sb.verify = true;
        G.ui.closeAllModals();
        return { ok: okAll && denied, dbg: dbg + ' denied=' + denied };""",
        '② 行为断言 refetch + 反面用例'))

    bad = 0
    for old, new, label in FIX:
        n = s.count(old)
        if n != 1:
            print('!! [%s] 锚点匹配 %d 次 → 中止' % (label, n))
            bad += 1
    if bad:
        return 1
    for old, new, label in FIX:
        s = s.replace(old, new, 1)
        print('  ✓ %s' % label)

    # 清掉片段里可能残留的过渡注释
    junk = '    /* ⚠️ 上面的写法拿不到 dbg —— 换成标准形：先求值、再 check（见下条注释） */\n'
    if junk in s:
        s = s.replace(junk, '')
        print('  ✓ 清掉过渡注释残留')

    d0 = (s.count('{') - s.count('}')) - (bak.count('{') - bak.count('}'))
    print('花括号净变化 %+d' % d0)
    tmp = P + '.tmp120d'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, P)
    print('补丁 D 完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
