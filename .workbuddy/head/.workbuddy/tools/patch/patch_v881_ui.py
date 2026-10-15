# -*- coding: utf-8 -*-
"""v88.1 整合（ui.js + main.js）：删 wildSceneHTML/doWildScene / 接线永删 / scene 置顶 / 分发删除。
   U2/U3 用 chr(10) 拼接换行（避免多层转义事故）。探针幂等。"""
import io

NL = chr(10)

def patch_file(path, ops):
    d = io.open(path, encoding='utf-8', newline='').read()
    dirty = False
    for tag, probe, old, new in ops:
        if probe in d:
            print('SKIP ' + tag)
            continue
        assert d.count(old) == 1, tag + ' 锚点 %d 次' % d.count(old)
        d = d.replace(old, new, 1)
        dirty = True
        print('OK ' + tag)
    if dirty:
        io.open(path, 'w', encoding='utf-8', newline='').write(d)
        print('落盘 ' + path.split(chr(92))[-1])
    else:
        print('跳过 ' + path.split(chr(92))[-1])

# ============ ui.js ============
UI = r'E:\Deepseekdb\js\ui.js'

# U2/U3 负向处理（原 probe 会误判：完成后与未完成态都含 jianghuHTML 行）
_d2 = io.open(UI, encoding='utf-8', newline='').read()
if 'ui.wildSceneHTML(x, y) +' in _d2:
    _d2 = _d2.replace('        ui.wildSceneHTML(x, y) +' + NL, '', 1)
    _d2 = _d2.replace('      ui.wildSceneHTML(x, y) +' + NL, '', 1)
    io.open(UI, 'w', encoding='utf-8', newline='').write(_d2)
    print('OK U2/U3 补删调用行')
else:
    print('SKIP U2/U3 调用行已删')

# U1) 删 wildSceneHTML / doWildScene 整块（含注释头）→ 说明注释
U1_OLD = """  /* ============================================================
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
"""
U1_NEW = """  /* v87「地形专属场景区块」-> v88.1 整合：
     ui.wildSceneHTML / ui.doWildScene / _wsGen / _wsResult 已全部删除 ——
     六地形场景并入下方「江湖游历区块」（ui.jianghuHTML，kind:'scene' 活动）。 */
"""

# U4) jianghuHTML：scene 置顶
U4_OLD = """    var acts = GAME.jianghuActsAt(tile.terrain);
    if (!acts.length) return '';"""
U4_NEW = """    var acts = GAME.jianghuActsAt(tile.terrain);
    if (!acts.length) return '';
    /* v88.1：地形专属（scene）排最前 —— 本地的「招牌」 */
    acts.sort(function (p1, p2) {
      return ((p2.def.kind === 'scene') ? 1 : 0) - ((p1.def.kind === 'scene') ? 1 : 0);
    });"""

# U5) 文案
U5_OLD = """      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">讨伐切磋、采药静修、拜访奇人——所得灵气精华用于蕴养修炼装备。</div>';"""
U5_NEW = """      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">本地特色与江湖诸事都在这里：讨伐切磋、采药静修、拜访奇人——精华用于蕴养修炼装备。</div>';"""

patch_file(UI, [
    ('U1 删 wildScene 区块', '六地形场景并入下方', U1_OLD, U1_NEW),
    ('U4 scene 置顶', '/* v88.1：地形专属（scene）排最前 —— 本地的「招牌」 */', U4_OLD, U4_NEW),
    ('U5 文案', '本地特色与江湖诸事都在这里', U5_OLD, U5_NEW),
])

# ============ main.js ============
M = r'E:\Deepseekdb\js\main.js'
M1_OLD = """      case 'do-wild-scene': ui.doWildScene(Number(el.dataset.x), Number(el.dataset.y)); break;
      /* v88：双轨切换 / 蕴养 / 江湖游历 */"""
M1_NEW = """      /* v88：双轨切换 / 蕴养 / 江湖游历（v88.1：原 do-wild-scene 已并入 do-jianghu） */"""
patch_file(M, [
    ('M1 删 do-wild-scene 分发', 'v88.1：原 do-wild-scene 已并入 do-jianghu', M1_OLD, M1_NEW),
])

print()
print('全部完成。')
