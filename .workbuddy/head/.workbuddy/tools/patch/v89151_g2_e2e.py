# -*- coding: utf-8 -*-
"""v89.151 批 G2：e2e 三处断言升级（采集按钮 / 悬停富浮层 / 距离读数）"""
import io

P = 'E:/Deepseekdb/e2e-test.js'
s = io.open(P, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag); return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① 管理面板采集区：设置采集 → 采集 ----------
rep(
    """    check('管理面板采集区 = 设置采集 + 收获（无召回）· 产量加成并入可采行',
      landM.indexOf('data-action="wild-garrison-gather"') >= 0
      && landM.indexOf('data-action="gather-finish"') >= 0
      && landM.indexOf('⚙️ 设置采集') >= 0 && landM.indexOf('📦 收获') >= 0""",
    """    check('管理面板采集区 = 采集 + 收获（无召回）· 产量加成并入可采行（v89.151 改文案）',
      landM.indexOf('data-action="wild-garrison-gather"') >= 0
      && landM.indexOf('data-action="gather-finish"') >= 0
      && landM.indexOf('⛏️ 采集</button>') >= 0 && landM.indexOf('📦 收获') >= 0
      && landM.indexOf('⚙️ 设置采集') < 0""",
    '① 采集按钮')

# ---------- ② 一字简称：title → 富浮层 tip-src ----------
rep(
    """        const nm149 = document.querySelector('#modal-root .bt-card .bt-rnm');
        check('v89.149（战场）：兵种名 = 一字简称（全名仍在悬停 title）',
          !!nm149 && nm149.textContent.length === 1 && (nm149.getAttribute('title') || '').length > 6,
          nm149 ? (nm149.textContent + ' / title 长度 ' + (nm149.getAttribute('title') || '').length) : '无');""",
    """        const nm149 = document.querySelector('#modal-root .bt-card .bt-rnm');
        const nmTip149 = nm149 ? nm149.querySelector('.tip-src') : null;
        check('v89.149/§151（战场）：兵种名 = 一字简称（全名/最终属性在**富浮层**里 · 绿红克制）',
          !!nm149 && nm149.textContent.trim().length === 1 && !!nmTip149
          && (nmTip149.innerHTML || '').length > 60
          && (nmTip149.innerHTML || '').indexOf('全军血量') >= 0
          && !!nm149.getAttribute('data-tip-el'),
          nm149 ? (nm149.textContent.trim() + ' / tip-src 长度 ' + (nmTip149 ? (nmTip149.innerHTML || '').length : 0)
            + ' data-tip-el=' + !!nm149.getAttribute('data-tip-el')) : '无');""",
    '② 一字简称浮层')

# ---------- ③ 距离读数：距离 XX/XX ----------
rep(
    """        check('v89.149（战场）：读数 =「最近距离 X / 全局 D」· 无「左侧设动作/目标」备注',
          !!gap149 && /最近距离/.test(gap149.textContent) && /全局/.test(gap149.textContent)
          && !document.querySelector('#modal-root .bt-hint'),
          gap149 ? gap149.textContent : '无读数');""",
    """        check('v89.149/§151（战场）：读数 =「距离 XX / XX」（一段双数）· 无「左侧设动作/目标」备注',
          !!gap149 && /^距离 /.test(gap149.textContent.replace(/\\s+/g, ' ').trim())
          && /\\d/.test(gap149.textContent) && gap149.textContent.indexOf('最近距离') < 0
          && !document.querySelector('#modal-root .bt-hint'),
          gap149 ? gap149.textContent : '无读数');""",
    '③ 距离读数')

assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('e2e G2 落盘 OK · len=' + str(len(s)))
