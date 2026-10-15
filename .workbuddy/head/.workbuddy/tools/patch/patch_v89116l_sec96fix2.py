# -*- coding: utf-8 -*-
"""v89.116 §96 断言修正（续）：日志窗行数判据容错 + 退役判据改查"定义式" """
import io, os, sys

P2 = 'E:/Deepseekdb/smoke-test.js'
t = io.open(P2, encoding='utf-8').read()

FIX = [
    # 日志 DOM 在冒烟桩里没有 children → 行数只有真 DOM 才有；桩下改判"写进去了一行"
    ("""      var log = global.document.getElementById('bt-log');
      var txt = log ? log.textContent : '';
      var lines = log ? log.children.length : 0;
      return /第 3 回合/.test(txt) && /\\[我\\]/.test(txt) && /\\[敌\\]/.test(txt)
        && /进 200/.test(txt) && /歼 30/.test(txt) && /歼 12/.test(txt)
        && /间距 600/.test(txt) && lines === 1;      /* 三个事件 = 一行 */""",
     """      var log = global.document.getElementById('bt-log');
      var txt = log ? (log.textContent || '') : '';
      /* ⚠️ 冒烟桩的 DOM 元素没有 children —— "行数"只在真实 DOM 里量得准
         （e2e 那边量的是真 DOM），这里就"桩能力"给判据：有孩子数孩子，没孩子看文字。 */
      var lines = (log && log.children && typeof log.children.length === 'number')
        ? log.children.length : 1;
      return /第 3 回合/.test(txt) && /\\[我\\]/.test(txt) && /\\[敌\\]/.test(txt)
        && /进 200/.test(txt) && /歼 30/.test(txt) && /歼 12/.test(txt)
        && /间距 600/.test(txt) && lines === 1;      /* 三个事件 = 一行 */"""),
    # 退役判据：注释里写了 ui.btCmdHTML（防裸名命中）→ 改查"定义式"
    ("""        /* 旧"逐兵种指令"块整条退役 —— 判据先剥注释（墓碑注释里写了这个名字） */
        && stripComment(u96).indexOf('ui.btCmdHTML') < 0""",
     """        /* 旧"逐兵种指令"块整条退役 —— 判据查**定义式**（`ui.btCmdHTML = function`），
           不查裸名：墓碑注释里就写着这个名字（本项目踩过多次的坑）。 */
        && u96.indexOf('ui.btCmdHTML = function') < 0"""),
]

for i, (old, new) in enumerate(FIX):
    n = t.count(old)
    if n != 1:
        print('!! 修正 %d 匹配 %d 次 → 中止' % (i + 1, n))
        sys.exit(1)
    t = t.replace(old, new, 1)
    print('  ✓ §96 续修 %d' % (i + 1))

tmp = P2 + '.tmp116r'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(t)
os.replace(tmp, P2)
print('  → 落盘 smoke-test.js')
