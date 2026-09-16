# -*- coding: utf-8 -*-
"""v89 事件（main.js）：sxf-choice / sxf-escape / sxf-exit 分发 + doScene 包装。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\main.js'
d = io.open(P, encoding='utf-8', newline='').read()

def sub(old, new, tag, probe):
    global d
    if probe in d:
        print('SKIP ' + tag)
        return
    c = d.count(old)
    assert c == 1, tag + ' 锚点命中 %d 次' % c
    d = d.replace(old, new, 1)
    print('OK ' + tag)

sub(r"""      case 'do-jianghu': ui.doJianghu(Number(el.dataset.x), Number(el.dataset.y), el.dataset.act); break;""",
r"""      case 'do-jianghu': ui.doJianghu(Number(el.dataset.x), Number(el.dataset.y), el.dataset.act); break;
      /* v89：全屏江湖剧本（选择 / 中途退出 / 收尾关闭） */
      case 'sxf-choice': GAME.doScenePick(Number(el.dataset.i)); break;
      case 'sxf-escape': GAME.doSceneEscape(); break;
      case 'sxf-exit': ui.closeSceneFx(); break;""",
    'M1 三个案件分发', "case 'sxf-choice':")

sub(r"""  /* v88：蕴养（修炼装备强化；面板原地重开显示新等级与精华余额） */
  GAME.doLingTemper = function (key) {
    var r = GAME.lingTemper(key);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLingTemper(); }
  };""",
r"""  /* v88：蕴养（修炼装备强化；面板原地重开显示新等级与精华余额） */
  GAME.doLingTemper = function (key) {
    var r = GAME.lingTemper(key);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLingTemper(); }
  };
  /* v89：全屏剧本 —— 选择 / 中途退出（结算屏由 ui.renderSceneFx 就地重绘） */
  GAME.doScenePick = function (i) {
    var r = GAME.scenePick(i);
    if (!r.ok) { if (r.msg) ui.toast(r.msg); return; }
    ui.renderSceneFx();
  };
  GAME.doSceneEscape = function () {
    var r = GAME.sceneEscape();
    if (!r.ok) { if (r.msg) ui.toast(r.msg); return; }
    ui.renderSceneFx();
  };""",
    'M2 doScene 包装', 'GAME.doScenePick = function')

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print()
print('全部完成。')
