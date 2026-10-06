# -*- coding: utf-8 -*-
"""v89.201 批次E：三条红修复（v79 面板判据升级 / §180⑥ 选择器升级 / §201⑦ 前缀撞车修复）"""
import io

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

S = 'E:/Deepseekdb/smoke-test.js'

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    wr(path, s.replace(old, new)); print('[ok] ' + tag)

# ══════════ E1 · v79 段：强化面板判据升级（新形态：网格卡 + 底键） ══════════
rep(S, 'E1 v79 强化面板判据',
    """    check('界面：强化面板按件列（同名各一行、按钮带件号）',
      /按件/.test(uS) && /GAME\\.eqLabel\\(inst\\)/.test(uS) && /data-action="enhance-item" data-item="' \\+ key/.test(uS));""",
    """    check('界面：强化面板按件列（v89.201 起：网格卡 + 底部唯一强化键认选中件）',
      /按件/.test(uS) && /GAME\\.eqLabel\\(inst\\)/.test(uS)
      && /ui\\.enhKeyOf = function/.test(uS) && /data-action="enhance-item"/.test(uS)
      && /U\\.escape\\(ui\\._enhSel \\|\\| ''\\)/.test(uS));""",
    '网格卡 + 底部唯一强化键认选中件')

# ══════════ E2 · §180⑥：选择器清单升级（+.m-body） ══════════
rep(S, 'E2 §180⑥ 选择器升级',
    """    check('§180⑥ live 快照/回填含 .panel-body（滚动位不丢 · 两处同改）', (function () {
      var uS180 = fs180.readFileSync(p180.join(__dirname, 'js', 'ui.js'), 'utf8');
      return (uS180.match(/querySelectorAll\\('\\.inner-panel, \\.panel-body, \\.modal-scroll'\\)/g) || []).length === 2;
    })());""",
    """    check('§180⑥ live 快照/回填含滚动容器清单（两处同改；v89.201 补 .m-body —— 真滚动容器）', (function () {
      var uS180 = fs180.readFileSync(p180.join(__dirname, 'js', 'ui.js'), 'utf8');
      return (uS180.match(/querySelectorAll\\('\\.inner-panel, \\.m-body, \\.panel-body, \\.modal-scroll'\\)/g) || []).length === 2;
    })());""",
    '\\.m-body, \\.panel-body, \\.modal-scroll')

# ══════════ E3 · §201⑦：负向判据修前缀撞车（enh-row vs enh-rows） ══════════
rep(S, 'E3 §201⑦ 前缀撞车修复',
    """        && !/enh-row/.test(fn) && !/enh-list/.test(fn)""",
    """        /* ⚠️ 负向用**完整形态** `class="enh-row"` —— 裸 /enh-row/ 会撞新类名 enh-rows（§64.4 前缀撞车） */
        && !/class="enh-row"/.test(fn) && !/class="enh-list"/.test(fn)""",
    'class="enh-row"')

print('批次E 完成')
