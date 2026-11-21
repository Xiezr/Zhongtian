# -*- coding: utf-8 -*-
"""v157.98 · 断言改写：痕迹体系从「必须在岗」改为「必须退役」

规则变更由老板下达：下线「这一带似乎有动静」相关地块色与任务体系。
按项目纪律：**不改判据放水、不删除**，按新口径重写，并在注释里点明规则变更。
"""
import io

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()

start = s.index("  /* ============================================================\n   * §586q（v157.77 · ")
end = s.index("      '六类映射 + 去重后追加');\n  })();\n") + len("      '六类映射 + 去重后追加');\n  })();\n")

NEW = '''  /* ============================================================
   * §586q（v157.77 立 · **v157.98 按老板指令重写**）
   * ------------------------------------------------------------
   * 原规则：整格涂色有 6 类来源，其中「迷雾边缘的动静痕迹」要能被说明。
   * **规则变更**：老板「把"这一带似乎有动静"相关地块色去掉，下线相应任务体系，
   *   我记得我已经让你下线掉前传了」—— 痕迹本来就是前传（v92.6 构想 A2）的遗留，
   *   前传退役后它既无玩法承接，又让地图多出"说不清是什么的色块"。
   * 新规则：**痕迹整条退役**（涂色 / 悬停文案 / 点击 toast / 概率配置），
   *   剩下 5 类来源仍必须齐全、仍必须说得出名字。
   * 断言方向因此反过来：原来验"在岗"，现在验"**不许回填**"。
   * ============================================================ */
  (function () {
    var fs = require('fs'), path = require('path');
    var mp = fs.readFileSync(path.join(__dirname, 'js', 'map3d.js'), 'utf8');
    var dt = fs.readFileSync(path.join(__dirname, 'js', 'data.js'), 'utf8');

    check('§586q 来源面：五类色块来源齐全，且「痕迹」不许回填',
      /var _tk = \\{\\}, _tkOwn = \\{\\};/.test(mp)
      && /_tk\\[ci\\] = 'camp';/.test(mp)
      && /_tk\\[_vci\\] = 'village';/.test(mp)
      && /_tk\\[ci\\] = 'ruin';/.test(mp)
      && /_tk\\[_ok\\] = _tkOwn\\[_ok\\] \\|\\| 'own';/.test(mp)
      && /place\\(\\{ ci: ci \\}, '#9c3b34', 'memorial'\\)/.test(mp)
      /* 下限：至少 4 处 `_tk[` 直接写入（memorial 走 place 传参）*/
      && (mp.match(/_tk\\[/g) || []).length >= 4
      /* 反向证据：痕迹的涂色写入必须 0 处 */
      && !/_tk\\[_ti\\] = 'trace'/.test(mp),
      '五类来源在岗 · trace 涂色 0 处');

    check('§586q 悬停面：未探明统一「还没有记载」· lord 分支在岗 · 不泄露具体',
      /这一带还没有记载/.test(mp)
      /* 反向证据：暖褐色文案与 trace 分支必须都不在 */
      && !/地面泛着暖褐色/.test(mp)
      && !/_tkH === 'trace'/.test(mp)
      /* `_markers` 那层 5 色里，`lord`（亮黄）以前没有分支，会掉到"野地（未占）" */
      && /kind === 'lord' \\? '君主所在（你的主力在此）' : null/.test(mp)
      /* 下限：不泄露"是什么" */
      && !/有动静（是营地）/.test(mp)
      && !/有动静（是遗迹）/.test(mp),
      '统一兜底 + 无痕迹分支 + 不泄露具体');

    check('§586q 点击面：痕迹提示 toast 已退役（不许回填）',
      !/这一带似乎有动静/.test(mp)
      && !/_tkC === 'trace'/.test(mp)
      && /ui\\.openLandModalCi/.test(mp),
      'toast 0 处 · 地块面板仍可达');

    check('§586q 兜底面：任何上了色的格子都说得出来源（TK_DESC 五类齐全 · 无 trace）',
      /var TK_DESC = \\{/.test(mp)
      && /camp: '幸存者营地'/.test(mp)
      && /village: '村社'/.test(mp)
      && /ruin: '旧世界遗迹'/.test(mp)
      && /own: '我方占领'/.test(mp)
      && /memorial: '阵亡纪念地'/.test(mp)
      && !/trace: '迷雾边缘的动静痕迹'/.test(mp)
      && /out\\.facts\\.push\\('地面标记：' \\+ TK_DESC\\[_tkK\\]\\)/.test(mp),
      '五类映射 + 去重后追加');

    check('§586q 数据面：DATA.FOG 不再配置 traceChance（概率开关一并下线）',
      !/traceChance/.test(dt) && !/traceChance/.test(mp)
      && /baseRadius: 4/.test(dt),
      'data 与渲染两侧都 0 处');
  })();
'''

s = s[:start] + NEW + s[end:]
assert s.count('§586q') >= 5
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('assertions rewritten')
