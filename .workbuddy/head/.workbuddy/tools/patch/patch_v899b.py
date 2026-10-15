# -*- coding: utf-8 -*-
"""patch_v899b.py —— v89.9 接线修正：建筑逸闻块脱三元（无功能建筑漏入口）

问题：ui.openBuildModal 里 SG_BLOCK 挂在 `BLDG_FUNC[b.id] ? (...) : ''` 三元内，
      BLDG_FUNC 只有 12 座建筑 —— 民房 / 驿站 / 烽火台 / 鸿胪寺 4 座被漏掉。
修正：逸闻块移出三元、与功能块同级；所有建筑统一渲染（与野地/城池入口同构）。
      smoke 补一条防回归断言。
"""
import io
import os
import sys

R = r'E:\Deepseekdb'


def edit(path, pairs, tag):
    p = os.path.join(R, path)
    raw = io.open(p, 'rb').read()
    crlf = b'\r\n' in raw
    src = io.open(p, encoding='utf-8', newline='').read()

    def M(s):
        return s.replace('\n', '\r\n') if crlf else s

    for i, (old, new) in enumerate(pairs):
        o, n = M(old), M(new)
        c = src.count(o)
        if c != 1:
            print('FAIL [%s #%d] 命中 %d 次' % (tag, i + 1, c))
            sys.exit(1)
        src = src.replace(o, n, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(src)
    back = io.open(p, encoding='utf-8', newline='').read()
    for i, (old, new) in enumerate(pairs):
        if M(new) not in back:
            print('FAIL [%s #%d] 落盘回查失败' % (tag, i + 1))
            sys.exit(1)
    print('OK  ' + tag)


# ---------------------------------------------------------------------------
# 1) js/ui.js —— SG_BLOCK 移出 BLDG_FUNC 三元
# ---------------------------------------------------------------------------
edit('js/ui.js', [(
    """        (function () { var f = BLDG_FUNC[b.id]; return f ? ('<div class="op-zone">' +
            '<div class="op-zone-t">功能</div>' +
            '<div class="op-row"><button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
              (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button>' +
              ui.SG_BLOCK('building', b.id, b.name) + '</div>' +
          '</div>') : ''; })() +""",
    """        (function () { var f = BLDG_FUNC[b.id]; return f ? ('<div class="op-zone">' +
            '<div class="op-zone-t">功能</div>' +
            '<div class="op-row"><button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
              (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button>' +
            '</div>' +
          '</div>') : ''; })() +
        /* v89.9（铺量接线）：逸闻块移出「功能」三元 —— 无功能面板的建筑（民房 / 驿站 /
           烽火台 / 鸿胪寺）此前被整个漏掉；现在所有建筑统一渲染，与野地 / 城池入口同构。 */
        ui.SG_BLOCK('building', b.id, b.name) +"""
)], 'ui.js · 逸闻块脱三元')

# ---------------------------------------------------------------------------
# 2) smoke-test.js —— 防回归断言
# ---------------------------------------------------------------------------
edit('smoke-test.js', [(
    """    return okA && run.phase === 'end' && ranks === 5 && run.path.length === ranks
      && !!(run.got && run.got.got);
  })());
})();""",
    """    return okA && run.phase === 'end' && ranks === 5 && run.path.length === ranks
      && !!(run.got && run.got.got);
  })());

  /* v89.9：建筑逸闻块脱三元 —— 无功能建筑（民房 / 驿站 / 烽火台 / 鸿胪寺）也能出入口 */
  check('故事库：建筑逸闻块脱三元（所有建筑统一渲染 · 无功能建筑有入口）', (function () {
    var src = '' + GAME.ui.openBuildModal;
    var ok1 = src.indexOf("ui.SG_BLOCK('building', b.id, b.name)") >= 0;
    var ok2 = src.indexOf("ui.SG_BLOCK('building', b.id, b.name) + '</div>'") < 0;
    var ok3 = GAME.ui.SG_BLOCK('building', 'minfang', '民房').indexOf('story-list') >= 0;
    return ok1 && ok2 && ok3;
  })());
})();"""
)], 'smoke-test.js · 脱三元防回归断言')

print('ALL OK')
