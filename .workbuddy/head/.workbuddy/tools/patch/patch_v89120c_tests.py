# -*- coding: utf-8 -*-
"""v89.120 补丁 C：测试适配 + §101 新断言 + e2e 真 DOM 增补

· 升级两条既有断言（都因本轮改口径而需跟着走）：
  1. v89.89 D4 战报收藏：`dataset.i` → `dataset.rid`（身份 rid 化）
  2. ⑧ 战况播报：`ui.btLogPush('', 'sep')` → `ui.btLogItem('', 'sep')` + 整块置顶
· 插入 §101（四条需求的结构层 + 行为层，含对照实验）
· e2e：三键真位置（.bt-top .bt-acts）+ 回合记录倒叙（真 DOM）

执行：python .workbuddy/tools/patch/patch_v89120c_tests.py
"""
import io
import os
import sys

R = 'E:/Deepseekdb/'
FRAG = R + '.workbuddy/tools/patch/v89120_sec101.js'


def main():
    sm = io.open(R + 'smoke-test.js', encoding='utf-8').read()
    e2 = io.open(R + 'e2e-test.js', encoding='utf-8').read()
    bak_sm = io.open(R + '.workbuddy/backup/v89120/smoke-test.js', encoding='utf-8').read()

    # ---------------- 1. 升级：v89.89 D4 rep-fav 身份 ----------------
    OLD1 = """      if (!/case 'rep-fav': ui\\.toggleRepFav\\(Number\\(el\\.dataset\\.i\\)\\); break;/.test(mS89)) return false;"""
    NEW1 = """      /* v89.120：行内身份改 data-rid（不再用"渲染时刻的数组下标"——位移会错位） */
      if (!/case 'rep-fav': ui\\.toggleRepFav\\(Number\\(el\\.dataset\\.rid\\)\\); break;/.test(mS89)) return false;"""
    assert sm.count(OLD1) == 1, ('D4 rep-fav', sm.count(OLD1))
    sm = sm.replace(OLD1, NEW1, 1)
    print('  ✓ 升级：D4 rep-fav → dataset.rid')

    # ---------------- 2. 升级：⑧ 战况播报（整块置顶） ----------------
    OLD2 = """      var okLog = Array.isArray(ret) && ret.length === 2
        && /\\.bt-ev\\.sep \\{ height: 0; border-top: 1px dashed/.test(h96)
        && /ui\\.btLogPush\\('', 'sep'\\)/.test(src)
        && /'第 ' \\+ \\(\\(r && r\\.r\\) \\|\\| 0\\) \\+ ' 回合/.test(src);"""
    NEW2 = """      var okLog = Array.isArray(ret) && ret.length === 2
        && /\\.bt-ev\\.sep \\{ height: 0; border-top: 1px dashed/.test(h96)
        /* v89.120（老板「回合记录倒叙」）：回合块改**整块置顶** —— 唯一工厂 btLogItem、
           块首虚线、insertBefore(firstChild)。 */
        && /ui\\.btLogItem\\('', 'sep'\\)/.test(src)
        && /'第 ' \\+ \\(\\(r && r\\.r\\) \\|\\| 0\\) \\+ ' 回合/.test(src)
        && /log\\.insertBefore\\(frag, log\\.firstChild\\);/.test(src);"""
    assert sm.count(OLD2) == 1, ('btRoundLine okLog', sm.count(OLD2))
    sm = sm.replace(OLD2, NEW2, 1)
    print('  ✓ 升级：⑧ 战况播报 → 整块置顶判据')

    # ---------------- 3. 插入 §101 ----------------
    ANCHOR = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    assert sm.count(ANCHOR) == 1
    frag = io.open(FRAG, encoding='utf-8').read()
    sm = sm.replace(ANCHOR, frag + "\n" + ANCHOR, 1)
    d0 = (sm.count('{') - sm.count('}')) - (bak_sm.count('{') - bak_sm.count('}'))
    print('  §101 已插入（花括号净变化 %+d —— 片段自平衡应为 0）' % d0)

    # ---------------- 4. e2e 增补（三键位置 + 回合倒叙） ----------------
    OLD3 = """      const doneBtn = document.querySelector('#modal-root [data-action="bt-done"]');
      check('v89.87（战场）：完成回合按钮存在', !!doneBtn);
      if (doneBtn) { click(doneBtn); await sleep(220); }"""
    NEW3 = """      const doneBtn = document.querySelector('#modal-root [data-action="bt-done"]');
      check('v89.87（战场）：完成回合按钮存在', !!doneBtn);
      /* v89.120（老板需求 3）：三键从弹窗底栏移到读秒行（.bt-top .bt-acts）——真 DOM 查位置 */
      check('v89.120（战场）：三键在读秒行内（.bt-top .bt-acts）',
        !!document.querySelector('#modal-root .bt-top .bt-acts [data-action="bt-done"]')
        && !!document.querySelector('#modal-root .bt-top .bt-acts [data-action="bt-auto"]')
        && !!document.querySelector('#modal-root .bt-top .bt-acts [data-action="bt-retreat"]')
        && !document.querySelector('#modal-root .m-foot [data-action="bt-done"]'));
      if (doneBtn) { click(doneBtn); await sleep(220); }
      /* v89.120（老板需求 4）：回合记录倒叙 —— 真 DOM 里喂两个回合块，
         最新块在最上、块内保持"回合头 → 逐兵种行"正序、块首是虚线 */
      {
        const logEl120 = document.querySelector('#bt-log');
        if (!logEl120) {
          check('v89.120（战场）：回合记录倒叙（最新在最上）', false, '#bt-log 缺失');
        } else {
          const snap120 = { field: 1400, atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 10, range: 50 }],
            def: [{ id: 'yibing', name: '义兵', count: 100, adv: 10, range: 20 }], towers: null };
          G.ui.btRoundLine({ r: 91, gap: 900, events: [{ kind: 'move', side: 'atk', id: 'changqiang', name: '长枪兵', step: 5 }] }, snap120);
          G.ui.btRoundLine({ r: 92, gap: 800, events: [{ kind: 'move', side: 'atk', id: 'changqiang', name: '长枪兵', step: 6 }] }, snap120);
          const hdrs120 = logEl120.querySelectorAll('.bt-ev.hdr');
          check('v89.120（战场）：回合记录倒叙（最新在最上）',
            hdrs120.length >= 2 && /第 92 回合/.test(hdrs120[0].textContent),
            hdrs120.length ? hdrs120[0].textContent : '无回合头');
          const kids120 = logEl120.children;
          check('v89.120（战场）：块内正序（回合头在行之前、块首虚线）',
            kids120.length >= 3 && String(kids120[0].className).indexOf('sep') >= 0
            && String(kids120[1].className).indexOf('hdr') >= 0,
            kids120.length ? (kids120[0].className + ' / ' + kids120[1].className) : '空');
        }
      }"""
    assert e2.count(OLD3) == 1, ('e2e doneBtn 段', e2.count(OLD3))
    e2 = e2.replace(OLD3, NEW3, 1)
    print('  ✓ e2e：三键位置 + 回合倒叙断言已插入')

    for p, s in [(R + 'smoke-test.js', sm), (R + 'e2e-test.js', e2)]:
        o = (s.count('{'), s.count('}'))
        tmp = p + '.tmp120c'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（{ } = %d/%d）' % (p.split('/')[-1], o[0], o[1]))
    print('补丁 C 完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
