# -*- coding: utf-8 -*-
# v89.150：e2e 升级 —— 战报正文三块 + 抵达弹清单（点观战才进战场）
import io, re

P = 'E:/Deepseekdb/e2e-test.js'
s = io.open(P, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    _cands = sorted([l.strip() for l in new.split('\n')
                     if l.strip() and re.search(r'[A-Za-z\u4e00-\u9fff]', l)], key=len, reverse=True)
    mark = None
    for _c in _cands:
        if s.count(_c) == 0 or (s.count(_c) == 1 and old not in s):
            mark = _c; break
    assert mark, '找不到幂等特征 [' + tag + ']'
    if s.count(mark) >= 1 and old not in s:
        print('SKIP(已落) ' + tag); return
    if s.count(mark) >= 1:
        raise AssertionError('重复插入风险 [' + tag + ']')
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    assert '\r\n' not in s, 'CRLF [' + tag + ']'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('OK ' + tag)


# ---------- ① 战报正文三块 ----------
rep("""  check('战报正文：含战斗场景条带', !!rpTxt.querySelector('.bt-scene') && rpTxt.querySelectorAll('.bt-row').length >= 1,
    rpTxt.querySelectorAll('.bt-row').length + ' 帧');
  check('战报正文：含回合纪要', rpTxt.querySelectorAll('.bt-line').length >= 1);
  check('战报正文：条带为等宽字符网格（GRID_COLS 列）', (function () {
    const s0 = rpTxt.querySelector('.bt-strip');
    return !!s0 && s0.textContent.trim().length === G.tactic.GRID_COLS;
  })());""",
    """  /* v89.150（老板 3）：「战报正文里不要分回合回放、回合纪要这 2 个板块。保留/设置：
     战斗总结，战斗收获，兵种损耗」—— 三块 + 两个旧板块整条退役（旧档也不再有条带块）。 */
  check('v89.150 战报正文：三块齐（战斗总结 / 战斗收获 / 兵种损耗）', (function () {
    const txt = rpTxt.textContent || '';
    return txt.indexOf('战斗总结') >= 0 && txt.indexOf('战斗收获') >= 0 && txt.indexOf('兵种损耗') >= 0;
  })());
  check('v89.150 战报正文：回放与纪要已退役（无 .bt-scene / .bt-line / .rp-log / 关键帧）',
    !rpTxt.querySelector('.bt-scene') && !rpTxt.querySelector('.bt-line') && !rpTxt.querySelector('.rp-log')
    && (rpTxt.textContent || '').indexOf('分回合回放') < 0
    && (rpTxt.textContent || '').indexOf('回合纪要') < 0);
  check('v89.150 战报正文：总结**逐行**（.rp-line）+ 收获**两列分类**（.rp-glabel/.rp-gtext）',
    rpTxt.querySelectorAll('.rp-lines .rp-line').length >= 2
    && rpTxt.querySelectorAll('.rp-gain .rp-glabel').length >= 1
    && rpTxt.querySelectorAll('.rp-gain .rp-gtext').length >= 1,
    rpTxt.querySelectorAll('.rp-lines .rp-line').length + ' 行总结 · '
    + rpTxt.querySelectorAll('.rp-gain .rp-glabel').length + ' 行收获');""",
    '① 战报正文三块'),

# ---------- ② 抵达 → 弹清单（点观战才进战场） ----------
rep("""      check('v89.87（战场）：界面自动打开（#bt-field + 我方单位卡）',
        !!document.querySelector('#modal-root #bt-field')
        && !!document.querySelector('#modal-root .bt-unit.atk'));""",
    """      /* v89.150（老板 5）：抵达**不再直接进战场** —— 先弹「战斗待指挥」清单
         （标题 + 目标/战斗类型/是否观战 三列表格），点「观战」才进场。
         v89.150（老板 6）：战场层带 closeAll（关闭一次关净回视图）。 */
      check('v89.150（战场）：抵达弹「战斗待指挥」清单（不直接进战场）', (function () {
        const box = document.querySelector('#modal-root');
        const txt = box ? (box.textContent || '') : '';
        return txt.indexOf('战斗待指挥') >= 0 && !document.querySelector('#modal-root #bt-field');
      })(), (document.querySelector('#modal-root') ? (document.querySelector('#modal-root').textContent || '').slice(0, 30) : '无弹窗'));
      const btOpen90 = document.querySelector('#modal-root [data-action="bt-open"]');
      check('v89.150（战场）：清单三列表格 + 每行「观战」按钮',
        !!btOpen90 && (function () {
          const ths = Array.prototype.map.call(document.querySelectorAll('#modal-root th'), (x) => x.textContent.trim());
          return ths.join('/') === '目标/战斗类型/是否观战';
        })());
      if (btOpen90) { click(btOpen90); await sleep(200); }
      check('v89.150（战场）：点「观战」进场（#bt-field + 我方单位卡）',
        !!document.querySelector('#modal-root #bt-field')
        && !!document.querySelector('#modal-root .bt-unit.atk'));
      check('v89.150（战场）：战场层带 closeAll（关闭 = 一次关净回视图）',
        G.ui._modalCloseAll === true);""",
    '② 抵达弹清单')

print('ALL OK · len=' + str(len(s)))
