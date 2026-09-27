# -*- coding: utf-8 -*-
"""v89.137 补丁 G：ui.js + main.js —— 全境营造总览退役（面板函数 / 三个动作 case）"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
ok = []

# ══════════ ① ui.js：删 ui.openBuildOverview（含注释块，括号配平） ══════════
p1 = os.path.join(ROOT, 'js', 'ui.js')
s1 = io.open(p1, 'r', encoding='utf-8', newline='').read()
n1 = len(s1)

defmark = '  ui.openBuildOverview = function () {'
i = s1.find(defmark)
if i < 0:
    print('❌ ui.js 找不到 openBuildOverview'); sys.exit(1)
j = s1.rfind('  /* ====', 0, i)
assert j > 0 and (i - j) < 4000, '注释块起点异常 j=%d i=%d' % (j, i)
k = s1.find('{', i)
depth, m = 0, k
while m < len(s1):
    if s1[m] == '{':
        depth += 1
    elif s1[m] == '}':
        depth -= 1
        if depth == 0:
            break
    m += 1
e = s1.find(';', m)
assert e > 0 and (e - m) < 4, '函数尾异常'
seg1 = s1[j:e + 1]
print('ui 删除片段 %d 字节：%s' % (len(seg1), seg1.split('\n')[1].strip()[:50]))

tomb1 = """  /* ============================================================
   * ⛔ v89.137（老板 4）：「不要全境营造总览，重复」——整条退役。
   * 删净：本面板函数 + 官府入口按钮 + 动作 open-build-ov / rush-ov /
   * rush-ov-all + 数据层 GAME.buildOverview / rushAllBuilds / buildQueueOf
   * （见 domain.js 同款墓碑）。单体提速不受影响（建筑面板「⚡ 提速」）。
   * ============================================================ */"""
s1 = s1[:j] + tomb1 + s1[e + 1:]
assert '\r\n' not in s1, '行尾混入 CRLF'
tmp = p1 + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s1)
os.replace(tmp, p1)
chk1 = io.open(p1, 'r', encoding='utf-8', newline='').read()
assert 'ui.openBuildOverview = function' not in chk1, '函数残留'
assert chk1.count('{') == chk1.count('}'), 'ui 花括号不配平'
ok.append('ui.openBuildOverview 退役')
print('✅ ui.js：%d → %d 字节' % (n1, len(chk1)))

# ══════════ ② main.js：删三个 case（连续段） ══════════
p2 = os.path.join(ROOT, 'js', 'main.js')
s2 = io.open(p2, 'r', encoding='utf-8', newline='').read()
n2 = len(s2)

old2 = """      /* v89.102（测评遗留落地）：全境营造总览 —— 跨城队列 + 逐条/一键提速 */
      case 'open-build-ov': ui.openBuildOverview(); break;
      case 'rush-ov': {
        var _q2 = GAME.buildQueueOf(el.dataset.ci, GAME.slotKey(el.dataset.gi));
        var _r2 = GAME.queueRushPay(_q2, '营造工程');
        ui.toast(_r2.msg);
        GAME.refreshAll();
        ui.openBuildOverview();
        break;
      }
      case 'rush-ov-all': {
        var _r3 = GAME.rushAllBuilds();
        ui.toast(_r3.msg);
        GAME.refreshAll();
        ui.openBuildOverview();
        break;
      }
"""
new2 = """      /* ⛔ v89.137（老板 4）：case open-build-ov / rush-ov / rush-ov-all 整条退役 ——
         全境营造总览已删（见 ui.js 与 domain.js 的同款墓碑）。
         建筑面板的「⚡ 提速」走 rush-build（保留）。 */
"""
if s2.count(old2) != 1:
    if "'open-build-ov':" not in s2 and "'rush-ov':" not in s2:
        print('⏭  main.js 段跳过（三个 case 已退役）')
        s2 = None            # 标记：不写盘
    else:
        print('❌ main.js 锚点命中 %d 次' % s2.count(old2)); sys.exit(1)
else:
    s2 = s2.replace(old2, new2)
if s2 is not None and "'rush-ov':" not in s2 and "'open-build-ov':" not in s2 and '\r\n' not in s2:
    tmp = p2 + '.tmp137'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s2)
    os.replace(tmp, p2)
    chk2 = io.open(p2, 'r', encoding='utf-8', newline='').read()
    assert "'rush-ov':" not in chk2 and "'open-build-ov':" not in chk2, 'case 残留'
    assert chk2.count('{') == chk2.count('}'), 'main 花括号不配平'
    ok.append('main.js 三 case 退役')
    print('✅ main.js：%d → %d 字节' % (n2, len(chk2)))
print('完成：' + ' / '.join(ok))
