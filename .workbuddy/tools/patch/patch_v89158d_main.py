# -*- coding: utf-8 -*-
# v89.158 补丁 D：main.js —— 主循环"周期性重绘窗口"(_tickPaint) + 两处视图刷新悬停保护
import io

P = 'E:/Deepseekdb/js/main.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

def rep(tag, old, new, guard=None):
    global s
    if guard and guard in s:
        done.append(tag + ' skip')
        return
    c = s.count(old)
    assert c == 1, tag + ' anchor count=' + str(c)
    s = s.replace(old, new)
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    done.append(tag + ' OK')

# ---------- D1：循环头开窗 ----------
rep('D1 loop head',
u"""      if (!$('#screen-game').classList.contains('hidden')) {
        GAME.tickOnce();""",
u"""      if (!$('#screen-game').classList.contains('hidden')) {
        /* v89.158（老板 2）：本窗口内的所有重绘 = "周期性重绘" ——
           悬停保护（ui.hoverHold）只在此窗口内生效（操作驱动的重绘永远放行）。 */
        ui._tickPaint = true;
        try {
        GAME.tickOnce();""",
guard=u'ui._tickPaint = true;')

# ---------- D2：循环尾关窗 ----------
rep('D2 loop tail',
u"""        if (ui.view === 'map') ui.renderMapCanvas();
      }
    }, 1000);""",
u"""        if (ui.view === 'map') ui.renderMapCanvas();
        } finally { ui._tickPaint = false; }
      }
    }, 1000);""",
guard=u'} finally { ui._tickPaint = false; }')

# ---------- D3：军务总览刷新加悬停保护 ----------
rep('D3 marches',
u"""            var _vc135 = document.getElementById('view-container');
            var _st135 = _vc135 ? _vc135.scrollTop : 0;
            ui.renderView('marches');
            if (_vc135) _vc135.scrollTop = _st135;""",
u"""            var _vc135 = document.getElementById('view-container');
            var _st135 = _vc135 ? _vc135.scrollTop : 0;
            /* v89.158（老板 2）：悬停视图页 → 本秒不重绘（保持悬停那一刻的数据；移开即恢复） */
            if (!ui.hoverHold(_vc135)) {
              ui.renderView('marches');
              if (_vc135) _vc135.scrollTop = _st135;
            }""",
guard=u"if (!ui.hoverHold(_vc135)) {")

# ---------- D4：将领视图刷新加悬停保护 ----------
rep('D4 generals',
u"""            var _vc136 = document.getElementById('view-container');
            var _st136 = _vc136 ? _vc136.scrollTop : 0;
            ui.renderView('generals');
            if (_vc136) _vc136.scrollTop = _st136;""",
u"""            var _vc136 = document.getElementById('view-container');
            var _st136 = _vc136 ? _vc136.scrollTop : 0;
            /* v89.158（老板 2）：悬停保护（同军务总览） */
            if (!ui.hoverHold(_vc136)) {
              ui.renderView('generals');
              if (_vc136) _vc136.scrollTop = _st136;
            }""",
guard=u"if (!ui.hoverHold(_vc136)) {")

io.open(P, 'w', encoding='utf-8', newline='').write(s)

# ---------- 自检 ----------
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'ui._tickPaint = true;') == 1, 'tickPaint true'
assert chk.count(u'} finally { ui._tickPaint = false; }') == 1, 'tickPaint finally'
assert chk.count(u'ui.hoverHold(') == 2, 'hoverHold 调用: ' + str(chk.count(u'ui.hoverHold('))
print('patch D done:', done, 'len', orig, '->', len(chk))
