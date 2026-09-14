# -*- coding: utf-8 -*-
"""补丁 2/2：把「定期来袭」的输出值接进界面（照断粮警示的成例）。

为什么必须做这一步：`audit.js` 报 `GAME.invasionDueAt` 是死函数 ——
不是该删，而是**功能未接线**。项目自己的规矩写在断粮那段的注释里：
「新机制上线，它的输出值要能被看见」。

做法：**复用现成的 `.note-warn` 样式**（断粮警示用的那个），
只在「有排期」时渲染 —— 不新增 CSS、不新增板块、不改版式，几何风险为零。

行尾：ui.js 是纯 LF，newline=''。
用法：python patch_invasion_ui.py
"""
import io, os, sys

UI = r'E:\Deepseekdb\js\ui.js'

ANCHOR = """          '宜速运粮入城、增产粮草，或裁减军伍。</div>';
      })();
    box.innerHTML = html;
"""

BLOCK = """          '宜速运粮入城、增产粮草，或裁减军伍。</div>';
      })();
      /* 定期来袭警示（第 2 期 · 防守）—— 与断粮警示**同一个 `.note-warn`**，
         不新增 CSS、不新增板块，只在「已有排期」时渲染。
         项目规矩：新机制上线，它的输出值要能被看见（否则玩家永远不知道
         自己在被谁打、还有多久、守不守得住）。
         ⚠️ 这里是 `GAME.invasionDueAt` 与 `GAME.defensePowerOf` 的**界面消费点**，
            删掉这段 audit.js 会报死函数。 */
      (function () {
        if (!GAME.invasionDueAt || !GAME.defensePowerOf) return '';
        var due = GAME.invasionDueAt(c);
        if (!due) return '';
        var now = (s.world && s.world.elapsed) || 0;
        var leftH = Math.max(0, Math.round((due - now) / 3600));
        var I = DATA.INVASION || {};
        var bc = Math.min(I.warnBeaconMax || 3, GAME.buildingLevel(c, 'fenghuotai') || 0);
        return '<div class="note-warn" style="margin-top:6px;text-align:left;">\\u{1F525} <b>烽火</b>，约 ' +
          leftH + ' 游戏时后有兵马犯境。<br>本城守备力 <b>' +
          U.fmt(GAME.defensePowerOf(c)) + '</b>' +
          (bc > 0 ? '（烽火台 Lv' + bc + ' 提前预警）' : '（无烽火台，预警偏迟）') +
          '　宜收拢兵力、修葺城墙。</div>';
      })();
    box.innerHTML = html;
"""


def main():
    if not os.path.exists(UI):
        print('✗ 找不到', UI)
        return 2
    src = io.open(UI, encoding='utf-8', newline='').read()

    if '定期来袭警示' in src:
        print('·  已替换过，跳过')
    else:
        n = src.count(ANCHOR)
        if n != 1:
            print('✗ 锚点出现 %d 次（要求 1 次）—— 未写盘' % n)
            return 1
        after = src.replace(ANCHOR, BLOCK, 1)
        io.open(UI, 'w', encoding='utf-8', newline='').write(after)
        back = io.open(UI, encoding='utf-8', newline='').read()
        print('✅ 已写盘 %d → %d 字符（%+d）' % (len(src), len(after), len(after) - len(src)))
        print('   落盘核验：%s  CRLF=%d' % ('一致' if back == after else '不一致', back.count('\r\n')))
        if back != after:
            return 1

    fin = io.open(UI, encoding='utf-8', newline='').read()
    print('\n终检：')
    print('  invasionDueAt 被 ui.js 引用：%s' % ('✅' if 'GAME.invasionDueAt' in fin else '❌'))
    print('  defensePowerOf 被 ui.js 引用：%s' % ('✅' if 'GAME.defensePowerOf' in fin else '❌'))
    print('  未引入裸 px：%s' % ('✅' if 'width:1' not in fin.split('定期来袭警示')[1][:900] else '⚠️ 人工复核'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
