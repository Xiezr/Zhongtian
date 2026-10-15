# -*- coding: utf-8 -*-
"""v90.80 奇遇系统退役 · 脚本 E：smoke-test.js（§80 十一条 → 零残留守卫七条）
用法：python .workbuddy/tools/patch/patch_v9080e_smoke.py [--apply]
"""
import io, sys

P = 'smoke-test.js'
MARK = '80. v89.6 奇遇 · 见闻录（v90.80 退役记录 · 零残留守卫）'


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


GUARD = r'''/* ============================================================
 * 80. v89.6 奇遇 · 见闻录（v90.80 退役记录 · 零残留守卫）
 * ------------------------------------------------------------
 * ⛔ 老板：「去除奇遇系统」。
 * 本段原为 11 条 v89.6 断言（奇遇册 / 点位 / 探察 / 线索 / 探奇三段 / 见闻录 / 悬星 / 接线）。
 * 现已整条退役，取而代之的是「零残留守卫」——防止任何一处复活成"半套系统"。
 * ============================================================ */
(function () {
  console.log('\n===== 80. 奇遇 · 见闻录退役（v90.80 · 零残留守卫） =====');
  var fs80 = require('fs'), path80 = require('path');
  var rd80 = function (f) { return fs80.readFileSync(path80.join(__dirname, f), 'utf8'); };
  var sc80 = function (s2) {
    return String(s2).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
  };
  var hStrip80 = function (s2) {
    return String(s2).replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  };
  var st80 = sc80(rd80('js/state.js')), u80 = sc80(rd80('js/ui.js'));
  var m80 = sc80(rd80('js/main.js')), mp80 = sc80(rd80('js/map.js'));
  var d80 = sc80(rd80('js/data.js')), hi80 = hStrip80(rd80('index.html'));

  check('§80① 引擎零残留：wonder 出口十三件全清（可执行形态 + 运行期 undefined）', (function () {
    var forms = ['GAME.wonderState = function', 'GAME.wonderTierName = function', 'GAME.wonderBandName = function',
      'GAME.wonderSites = function', 'GAME.wonderSiteOf = function', 'GAME.wonderSurvey = function',
      'GAME.wonderClueRoll = function', 'GAME.wonderClueText = function', 'GAME._jhClueAttach = function',
      'GAME.wonderCheck = function', 'GAME.wonderSpend = function', 'GAME.wonderRoll = function',
      'GAME.wonderStart = function'];
    return forms.every(function (f) { return st80.indexOf(f) < 0; })
      && typeof GAME.wonderState === 'undefined' && typeof GAME.wonderSites === 'undefined'
      && typeof GAME.wonderSiteOf === 'undefined' && typeof GAME.wonderCheck === 'undefined'
      && typeof GAME.wonderStart === 'undefined' && typeof GAME._jhClueAttach === 'undefined';
  })());

  check('§80② 数据层零残留：DATA.WONDER / DATA.WONDERS 全清', (function () {
    return d80.indexOf('DATA.WONDER =') < 0 && d80.indexOf('DATA.WONDERS =') < 0
      && DATA.WONDER === undefined && DATA.WONDERS === undefined;
  })());

  check('§80③ UI 零残留：doWonder / journalHTML / openJournal / 探奇入口全清', (function () {
    return u80.indexOf('ui.doWonder = function') < 0 && u80.indexOf('ui.journalHTML = function') < 0
      && u80.indexOf('ui.openJournal = function') < 0
      && u80.indexOf('do-wonder') < 0 && u80.indexOf('open-journal') < 0 && u80.indexOf('journal-go') < 0
      && u80.indexOf('wnr-line') < 0 && u80.indexOf('--wonder') < 0
      && typeof GAME.ui.doWonder === 'undefined' && typeof GAME.ui.openJournal === 'undefined'
      && typeof GAME.ui.journalHTML === 'undefined';
  })());

  check('§80④ 地图渲染零残留：drawWonderStar 与悬星调用全清（灵机旗保留面在岗）', (function () {
    return mp80.indexOf('drawWonderStar') < 0 && mp80.indexOf('wonderSiteOf') < 0
      && /drawJhPennant\(/.test(mp80);
  })());

  check('§80⑤ 动作与样式零残留：main 三 case / HTML 四族样式全清', (function () {
    return m80.indexOf("case 'do-wonder'") < 0 && m80.indexOf("case 'open-journal'") < 0
      && m80.indexOf("case 'journal-go'") < 0
      && hi80.indexOf('--wonder') < 0 && hi80.indexOf('.wnr-') < 0 && hi80.indexOf('.jnl-') < 0
      && hi80.indexOf('sxf-clue') < 0;
  })());

  check('§80⑥ 保留面在岗：场景机（荒野活动共用）与荒野弹窗不受伤', (function () {
    return typeof GAME.sceneBegin === 'function' && typeof GAME.sceneStart === 'function'
      && typeof GAME.scenePick === 'function' && typeof GAME.jianghuCheck === 'function'
      && typeof GAME.jianghuRoll === 'function'
      && /ui\.doJianghu = function/.test(u80);
  })());

  check('§80⑦ 档案与交付在册（v90.80 · 老板原话逐字）', (function () {
    var a80 = rd80('需求档案.md');
    var doc80 = '';
    try {
      doc80 = rd80('docs/_史料/交付/v9080-奇遇系统退役.md');
    } catch (e) { return false; }
    return a80.indexOf('v90.80') >= 0 && a80.indexOf('去除奇遇系统') >= 0
      && doc80.indexOf('wonderSiteOf') >= 0 && doc80.indexOf('退役') >= 0;
  })());
})();'''

GUARD = GUARD + '\n\n  '


def main():
    apply = '--apply' in sys.argv
    s = rd(P)
    if MARK in s:
        print('[skip] 已落盘')
        return 0
    i0 = s.index(' * 80. v89.6 奇遇 · 见闻录（隐藏点位 / 线索 / 探奇 / 图鉴）')
    i = s.rindex('/* =====', 0, i0)
    j0 = s.index(' * 81. 文字游戏 · 故事库（story/）—— v89.218 退役记录')
    j = s.rindex('/* =====', 0, j0)
    seg = s[i:j]
    assert seg.count('check(') == 11, 'SM1 checks=%d' % seg.count('check(')
    assert 'wonderSites' in seg and '奇遇册齐' in seg and 'drawWonderStar' in seg
    assert '81. 文字游戏' not in seg
    s = s[:i] + GUARD + s[j:]
    assert MARK in s
    if not apply:
        print('[ok] SM1 §80 段（%d 字符 → 守卫）' % len(seg))
        print('DRY-RUN OK（未写盘）。确认后加 --apply。')
        return 0
    wr(P, s)
    print('[ok] SM1 §80 段（%d 字符 → 守卫）' % len(seg))
    print('APPLIED. lines=%d' % (rd(P).count('\n') + 1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
