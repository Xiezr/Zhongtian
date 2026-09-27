# -*- coding: utf-8 -*-
"""v89.149 批 G3：e2e 真 DOM 补断言（每回合可重设 · 一字简称 · 同兵种默认 · 去前缀 ·
战场条铺满 · 读数统一 / 删备注）—— 插在"完成回合"之后、"倒叙"用例之前"""
import io

P = 'E:/Deepseekdb/e2e-test.js'
BAK = 'E:/Deepseekdb/backup/v89149/e2e-test.js.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()

ANCHOR = """      if (doneBtn) { click(doneBtn); await sleep(220); }
"""

NEW = """      if (doneBtn) { click(doneBtn); await sleep(220); }
      /* ============================================================
       * v89.149（老板 1~7）：战场真 DOM 复核 —— **每回合可重设**（改完不跳回去）·
       *   一字简称 · 默认"同兵种"· 无"目标："前缀 · 战场条铺满（--rel）·
       *   读数 = 最近距离/全局 · 无「左侧设动作/目标」备注
       * ============================================================ */
      {
        const sels149 = document.querySelectorAll('#modal-root [data-action="bt-stance"]');
        const tkA149 = sels149[0] ? sels149[0].getAttribute('data-troop') : null;
        const tkB149 = sels149[1] ? sels149[1].getAttribute('data-troop') : null;
        /* ② 每回合可重设：上一段把第 1 支改成"驻守"（且在完成一回合之后仍在） */
        check('v89.149（战场）：每回合可重设 —— 上一回合改的"驻守"仍在（不跳回默认）',
          !!sels149[0] && sels149[0].value === 'hold' && !!tkA149,
          sels149[0] ? (tkA149 + '=' + sels149[0].value) : '无下拉');
        /* ② 再改一次（第 2 回合重设）→ **DOM 不回弹**（病根：旧实现拿上一回合末快照重绘） */
        if (sels149[0]) {
          sels149[0].value = 'retreat';
          sels149[0].dispatchEvent(new window.Event('change', { bubbles: true }));
          await sleep(80);
        }
        const sel149b = document.querySelector('#modal-root [data-action="bt-stance"][data-troop="' + tkA149 + '"]');
        const rec149 = s90.battles[0];
        check('v89.149（战场）：改完**不回弹**（DOM 与命令一致）',
          !!sel149b && sel149b.value === 'retreat'
          && !!rec149 && !!rec149.cmd && !!rec149.cmd[tkA149] && rec149.cmd[tkA149].s === 'retreat',
          sel149b ? ('dom=' + sel149b.value + ' cmd=' + JSON.stringify(rec149 && rec149.cmd)) : '下拉丢失');
        check('v89.149（战场）：没动的那支**原样继承**（不动不改）',
          !tkB149 || !(rec149 && rec149.cmd && rec149.cmd[tkB149]),
          '未动兵种=' + tkB149 + ' cmd=' + JSON.stringify(rec149 && rec149.cmd));
        /* ④ 默认"同兵种" + 无"目标："前缀 */
        const tgt149 = document.querySelector('#modal-root [data-action="bt-target"]');
        const board149 = document.querySelector('#bt-board');
        check('v89.149（战场）：目标下拉首项「同兵种」· 全盘无「目标：」前缀',
          !!tgt149 && tgt149.options.length >= 2 && tgt149.options[0].textContent === '同兵种'
          && !!board149 && (board149.innerHTML || '').indexOf('目标：') < 0,
          tgt149 ? ('首项=' + tgt149.options[0].textContent + ' 项数=' + tgt149.options.length) : '无目标下拉');
        /* ③ 一字简称 */
        const nm149 = document.querySelector('#modal-root .bt-card .bt-rnm');
        check('v89.149（战场）：兵种名 = 一字简称（全名仍在悬停 title）',
          !!nm149 && nm149.textContent.length === 1 && (nm149.getAttribute('title') || '').length > 6,
          nm149 ? (nm149.textContent + ' / title 长度 ' + (nm149.getAttribute('title') || '').length) : '无');
        /* ⑤ 战场条铺满（布局在 jsdom 量不到 —— 验"不内联定高 + 兵牌带 --rel"） */
        const fld149 = document.getElementById('bt-field');
        const u149 = document.querySelector('#bt-field .bt-unit');
        check('v89.149（战场）：战场条不内联定高 · 兵牌带 --rel（纵向铺满）',
          !!fld149 && (fld149.getAttribute('style') || '').indexOf('height') < 0
          && !!u149 && (u149.getAttribute('style') || '').indexOf('--rel') >= 0,
          fld149 ? ('style=' + (fld149.getAttribute('style') || '(空)')) : '无战场条');
        /* ⑦ 读数 + ⑥ 备注 */
        const gap149 = document.getElementById('bt-gap');
        check('v89.149（战场）：读数 =「最近距离 X / 全局 D」· 无「左侧设动作/目标」备注',
          !!gap149 && /最近距离/.test(gap149.textContent) && /全局/.test(gap149.textContent)
          && !document.querySelector('#modal-root .bt-hint'),
          gap149 ? gap149.textContent : '无读数');
      }
"""



if 'v89.149（战场）：每回合可重设' in s:
    print('SKIP(已落) e2e §149')
else:
    assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))
    s = s.replace(ANCHOR, NEW)
    print('OK e2e §149')

import re as _re


def _delta(x):
    return (len(_re.findall(r'(?<![\\^])\{', x)) - len(_re.findall(r'(?<![\\^])\}', x)))


assert _delta(s) == _delta(bak), '花括号盈亏不一致'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('e2e-test.js 落盘 · len=' + str(len(s)))
