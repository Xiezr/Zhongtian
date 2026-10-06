# -*- coding: utf-8 -*-
"""v89.221e · 测试面：插入 §221 断言段 + 版本号升级"""
import io, sys

R = 'E:/Deepseekdb/'
def rd(p): return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

bad = []
def rep(path, old, new, expect=1, tag=''):
    s = rd(R + path)
    c = s.count(old)
    if c != expect:
        bad.append('%s [%s] count=%d expect=%s | %s' % (path, tag, c, expect, old[:44]))
        return
    wr(R + path, s.replace(old, new))
    print('  [ok] %s %s' % (path.split('/')[-1], (tag or old[:22])))

# ═══ 版本号 ═══
rep('js/main.js', "GAME.VERSION = 'v89.220';", "GAME.VERSION = 'v89.221';", 1, 'version')
rep('smoke-test.js', "/GAME\\.VERSION = 'v89\\.220'/", "/GAME\\.VERSION = 'v89\\.221'/", 1, 'version-assert')
rep('smoke-test.js', 'v89.220：版本号每轮迭代更新', 'v89.221：版本号每轮迭代更新', 1, 'version-note')

# ═══ §221 段插入 ═══
SEC = u'''  /* ============================================================
   * §221（v89.221）：注释过一遍 + 绰号换代 + 任务页签闪烁
   * 老板原话：「1.注释也过一遍 2.绰号更换，改成末日废土相关的称呼
   *   5.任务有完成的任务不需要加数字显示，参考公文菜单的闪烁」
   * ============================================================ */
  (function () {
    var fs221 = require('fs'), path221 = require('path');
    var rd221 = function (rel) { return fs221.readFileSync(path221.join(__dirname, rel), 'utf8'); };
    var js221 = ['data', 'state', 'domain', 'battle', 'ui', 'main', 'map', 'tactic', 'icons', 'questdata', 'systems', 'story']
      .map(function (f) { return rd221('js/' + f + '.js'); }).join('\\n');
    var html221 = rd221('index.html');

    /* ① 机构词 + 旧城名零残留（产品侧；沿革映射留在需求档案与测试注释里） */
    check('§221① 注释过一遍：机构词 + 旧城名零残留（js/ + index.html）', (function () {
      var OLD = ['洛阳', '司隶', '幽州', '徐州', '荆州', '兖州', '并州', '益州', '冀州', '交州', '扬州',
        '豫州', '凉州', '州城', '州治', '郡城', '郡治', '县城', '都城', '帝都', '宛县'];
      var miss = OLD.filter(function (w) { return js221.indexOf(w) >= 0 || html221.indexOf(w) >= 0; });
      return miss.length === 0;
    })());

    /* ② 创建界面 13 chip 可见文本 = 新区名（v89.217 只改了 data-v，label 漏网 —— 本轮补齐） */
    check('§221② 创建界面 13 chip 标签 = 新区名（v89.217 漏网补齐）', (function () {
      var NAMES = ['烬环', '枯河', '碎垣', '沉陆', '盐岸', '灰野', '霜脊', '黑岭', '风碛', '雾谷', '泽心', '潮湾', '藤林'];
      var ok = NAMES.every(function (n) {
        return new RegExp('data-v="' + n + '"[^>]*>' + n + '<').test(html221);
      });
      return ok && !/>司隶</.test(html221);
    })());

    /* ③ 占野者绰号换代（末日废土 · 旧池零残留） */
    check('§221③ 占野者绰号换代（末日废土 · 旧池零残留）', (function () {
      var T = DATA.WILD_LORD_TITLE || [];
      var OLD = ['渠帅', '贼首', '山君', '寨主', '渠魁', '豪帅'];
      return T.length === 6 && T.join('') === '劫首头狼巢主荒枭掠魁悍匪'
        && OLD.every(function (w) { return js221.indexOf(w) < 0; })
        && js221.indexOf('贼寇') < 0;
    })());

    /* ④ 兵种旧缩写：玩家可见面零泄漏（车库解锁行 / 任务卡 / 天气 / 战术占位） */
    check('§221④ 兵种旧缩写：可见面零泄漏（车库行/任务卡/天气/战术占位）', (function () {
      var uiSrc = rd221('js/ui.js'), qd = rd221('js/questdata.js'), d221 = rd221('js/data.js');
      return uiSrc.indexOf('摩托游骑需1级 · 装甲战车/突击摩托需3级') >= 0
        && uiSrc.indexOf('战术名（如：弩手后退）') >= 0
        && d221.indexOf('弓兵射程') < 0
        && ['长枪', '铁骑', '轻骑', '投石', '刀盾', '藤甲', '青州', '西凉', '虎豹', '突骑', '弓箭', '象兵']
          .every(function (w) { return qd.indexOf(w) < 0; });
    })());

    /* ⑤ 任务页签闪烁的数据源接线（有可领取任务 → .fresh） */
    check('§221⑤ 任务页签：syncBadges 挂 .fresh（可领取 > 0）· 徽标元素已退役', (function () {
      var uiSrc = rd221('js/ui.js');
      var i0 = uiSrc.indexOf('ui.syncBadges = function');
      var blk = uiSrc.slice(i0, uiSrc.indexOf('ui.paintNav = function'));
      return /data-view="tasks"/.test(blk)
        && /questSummary\\(\\)\\.ready > 0/.test(blk)
        && html221.indexOf('tab-badge-task') < 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');'''

anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
s = rd('smoke-test.js')
c = s.count(anchor)
if c != 1:
    print('❌ anchor count=%d' % c)
    sys.exit(1)
if '§221\u2460' in s:
    print('❌ §221 已在（防重）')
    sys.exit(1)
wr('smoke-test.js', s.replace(anchor, SEC))
print('  [ok] smoke-test.js §221 插入')

if bad:
    print('\n❌ 失配 %d：' % len(bad))
    for b in bad: print('   ' + b)
    sys.exit(1)
print('\n✅ v89.221e 全部落盘')
