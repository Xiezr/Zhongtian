# -*- coding: utf-8 -*-
"""插入 §592：城市/城外/建筑地块"文字不可选"的 5 条断言。

为什么需要门禁：
  这类 CSS 最容易在后续"顺手加个全局重置"时被改掉 ——
  `* { user-select: none }` 一行就能让整个界面不能选字，
  而日志 / 战报 / 编号是排查问题的命根子，必须留得住。
  所以除了"该关的关了"，还要"不该关的没关"。
"""
import io

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='\n').read()

if '§592' in s:
    print('SKIP：已经插过')
    raise SystemExit(0)

BLOCK = '''  /* ===================== §592 城市/城外/建筑地块：文字不可选 =====================
   * 老板 2026-11-02：「城市和城外统计，建筑界面的地块，文字应为不可选，
   *   就是不能左键长按拖动然后会选中文字或组件」
   * ---------------------------------------------------------------------
   * 这几块整块都是"点了就是操作"的棋盘与读数区，浏览器默认会在按下拖动时
   * 顺手选字，松手留一片蓝底高亮，下一次点击还要先清选区（表现为"点一下没反应"）。
   *
   * ⚠️ 但**不能全局关**：日志 / 战报 / 编号 / 坐标是要能选中复制的。
   * 所以这里既验"该关的关了"，也验"不该关的没关"（反平凡解）。
   * ===================================================================== */
  (function () {
    var fsx = require('fs'), pth = require('path');
    var html = '';
    try { html = fsx.readFileSync(pth.join(__dirname, 'index.html'), 'utf8'); } catch (e) { }
    if (!html) { check('§592 读到 index.html', false, '读不到样式表'); return; }

    /* 把 CSS 拆成 {选择器, 声明体} 规则块，再判"某选择器所在的块里有没有 user-select:none"。
       直接对整篇做正则会被"规则 A 的选择器 + 规则 B 的声明"错配（跨块匹配）。 */
    var rules = [];
    var re = /([^{}]+)\\{([^{}]*)\\}/g, m;
    while ((m = re.exec(html)) !== null) {
      rules.push({ sel: m[1], body: m[2] });
    }
    function noSelect(sel) {
      for (var i = 0; i < rules.length; i++) {
        if (!/user-select\\s*:\\s*none/.test(rules[i].body)) continue;
        if (rules[i].sel.indexOf(sel) >= 0) return true;
      }
      return false;
    }

    check('§592① 城内 + 城外棋盘（.city-pure）禁止选字', noSelect('.city-pure'),
      '城内/城外共用同一容器，一条规则覆盖两块');
    check('§592② 地块本体（.iso-tile）禁止选字', noSelect('.iso-tile'),
      '格子里的文字/图标由 isoCell 生成');
    check('§592③ 建筑面板操作区（.bldg-bottom / .bldg-foot / .bldg-acts）禁止选字',
      noSelect('.bldg-bottom') || noSelect('.bldg-foot') || noSelect('.bldg-acts'),
      '这三个类同属建筑弹窗，任一条覆盖即可');
    check('§592④ 左侧三块统计（#city-attrs / #res-bar / #garrison-bar）禁止选字',
      noSelect('#city-attrs') && noSelect('#res-bar') && noSelect('#garrison-bar'),
      '这三块由 ui.renderSide 每秒重绘，选区还会跟着重绘闪一下');

    /* 反平凡解：**不许**出现全局禁止选字（`*` 或 html/body 上的 user-select:none）。
       一旦有人这么写，①②③④ 会全绿，但日志/战报/编号就再也复制不了了 ——
       那才是真正的破坏，而且没人会立刻发现。 */
    var globalBan = false, who = '';
    for (var k = 0; k < rules.length; k++) {
      if (!/user-select\\s*:\\s*none/.test(rules[k].body)) continue;
      var selTxt = rules[k].sel.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').trim();
      if (/^\\*\\s*$/.test(selTxt) || /(^|,)\\s*(html|body|:root)\\s*(,|$)/.test(selTxt)) {
        globalBan = true; who = selTxt.slice(0, 40);
      }
    }
    check('§592⑤ 反平凡解：没有全局禁选（日志/战报/编号必须仍能复制）', !globalBan,
      globalBan ? ('发现全局规则：' + who) : '日志/战报/坐标仍可选中复制');
  })();

'''

anchor = "console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert anchor in s, '汇总行锚点没找到'
s = s.replace(anchor, BLOCK + anchor, 1)

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('✓ smoke 已插入 §592（5 条）')
