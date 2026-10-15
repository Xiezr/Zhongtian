# -*- coding: utf-8 -*-
"""v87 · UI 层：野地弹窗「地形专属场景」区块（未占/已占两分支）+ 执行 + 分发。"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'
MJ = r'E:\Deepseekdb\js\main.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== X1. 场景区块函数组（挂 openLandModal 之前） ==')
patch(
    UI,
    """  /* 附属野地弹窗（原版「附属野地」） */
  ui.openWilds = function () {""",
    """  /* ============================================================
   * v87（老板「为各类野地设计专属弹窗场景」）：地形专属场景区块
   * ------------------------------------------------------------
   * 在野地弹窗（openLandModal 的未占/已占两分支）内嵌：
   *   场景说明 + 带队将领（genChips）+ 出发按钮 + 结果回显 + 每日一次状态。
   * 逻辑出口 GAME.wildSceneCheck / wildSceneDo（state.js，唯一）。
   * ============================================================ */
  ui._wsGen = null;
  ui._wsResult = null;
  ui.wildSceneHTML = function (x, y) {
    if (!GAME.wildSceneOf) return '';
    var tile = GAME.map.tile(x, y);
    if (!tile) return '';
    var sc = GAME.wildSceneOf(tile.terrain);
    if (!sc) return '';
    var s = GAME.state;
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    var done = (s.wildScenes || {})[x + ',' + y] === day;
    var home = GAME.currentCity();
    var own = (s.generals || []).filter(function (g) { return g.cityId === home.id; });
    if (!ui._wsGen || !own.some(function (g) { return g.id === ui._wsGen; })) {
      ui._wsGen = own[0] ? own[0].id : '';
    }
    var res = (ui._wsResult && ui._wsResult.xy === (x + ',' + y)) ? ui._wsResult : null;
    var h = '<div class="op-zone" style="margin-top:8px;">' +
      '<div class="op-zone-t">' + sc.icon + ' ' + sc.name + '　<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);">地形专属 · 每日每地一次</span></div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">' + U.escape(sc.desc) + '</div>';
    if (res) {
      h += '<div class="note" style="margin:4px 0;color:' + (res.bad ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
        U.escape(res.name + '：' + res.text) + '</div>';
    }
    if (done) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);">今日已探过，明日再来。</div>';
    } else if (!own.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);">本城无将领可供差遣。</div>';
    } else {
      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0;">' +
        '<label style="color:var(--text-dim);">带队将领</label>' +
        '<input type="hidden" id="ws-gen" value="' + ui._wsGen + '">' +
        ui.genChips({ cls: 'gen-chips inline', target: 'ws-gen', value: ui._wsGen, list: own,
          sub: function (g) { return '精' + Math.round(g.energy || 0) + ' 体' + Math.round(GAME.staNow(g)); } }) +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<button class="btn gold" data-action="do-wild-scene" data-x="' + x + '" data-y="' + y + '">' +
          sc.icon + ' ' + sc.name + '（精' + sc.energy + ' · 体' + sc.stam + '）</button>' +
        '</div>';
    }
    h += '</div>';
    return h;
  };
  ui.doWildScene = function (x, y) {
    var gsel = document.getElementById('ws-gen');
    var gid = gsel ? gsel.value : ui._wsGen;
    if (gid) ui._wsGen = gid;
    var r = GAME.wildSceneDo(x, y, gid);
    if (!r.ok) { ui.toast(r.msg); return; }
    ui._wsResult = { xy: x + ',' + y, name: r.name, text: r.text, bad: r.bad };
    ui.toast('🏕️ ' + r.name + (r.text ? '（' + r.text + '）' : ''));
    GAME.refreshAll();
    ui.openLandModal(x, y);       /* 原地重开：显示结果与「今日已探」态 */
  };

  /* 附属野地弹窗（原版「附属野地」） */
  ui.openWilds = function () {""",
    'X1 场景区块函数组',
    probe='ui.wildSceneHTML = function',
)

print()
print('== X2. 未占分支插入区块 ==')
patch(
    UI,
    """        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
          base.toLocaleString() + ' 名</div>' +
        '<div class="note">' + note + '</div>' +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild">出兵（侦查 / 掠夺 / 占领）</button>' +""",
    """        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
          base.toLocaleString() + ' 名</div>' +
        '<div class="note">' + note + '</div>' +
        ui.wildSceneHTML(x, y) +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild">出兵（侦查 / 掠夺 / 占领）</button>' +""",
    'X2 未占分支',
    probe="ui.wildSceneHTML(x, y) +\n        '<div style=\"text-align:center;margin-top:14px;",
)

print()
print('== X3. 已占分支插入区块 ==')
patch(
    UI,
    """    ui.openModal(
      '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '（已占）</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
        base.toLocaleString() + ' 名　·　产量加成 ' + (addStr || '无') + '</div>' +
      '<div class="note">' + note + '</div>' +
      stat + ops +""",
    """    ui.openModal(
      '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '（已占）</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
        base.toLocaleString() + ' 名　·　产量加成 ' + (addStr || '无') + '</div>' +
      '<div class="note">' + note + '</div>' +
      ui.wildSceneHTML(x, y) +
      stat + ops +""",
    'X3 已占分支',
    probe="ui.wildSceneHTML(x, y) +\n      stat + ops +",
)

print()
print('== X4. main.js 分发 ==')
patch(
    MJ,
    """      case 'wild-garrison-open': ui.openWildGarrison(Number(el.dataset.x), Number(el.dataset.y)); break;""",
    """      case 'wild-garrison-open': ui.openWildGarrison(Number(el.dataset.x), Number(el.dataset.y)); break;
      /* v87（老板）：野地地形专属场景 */
      case 'do-wild-scene': ui.doWildScene(Number(el.dataset.x), Number(el.dataset.y)); break;""",
    'X4 分发',
    probe="case 'do-wild-scene':",
)

print()
print('全部完成。')
