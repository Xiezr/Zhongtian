# -*- coding: utf-8 -*-
"""v89.140 批五：自动出征（按兵种配置取兵 · 去单次兵力 · 去播报）+ 附属野地（将领/驻军列）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
ok = []


def patch(rel, pairs, checks, braces=True):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for pr in pairs:
        old, new = pr[0], pr[1]
        tag = pr[2] if len(pr) > 2 else old[:30]
        cnt = s.count(old)
        exp = 2 if (tag.endswith('x2')) else 1
        assert cnt == exp, '%s/%s 锚点命中 %d 次（期望 %d）' % (rel, tag, cnt, exp)
        s = s.replace(old, new)
        ok.append(tag)
    assert '\r\n' not in s, rel + ' CRLF'
    if braces:
        assert s.count('{') == s.count('}'), rel + ' 花括号不配平'
    tmp = p + '.tmp140'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    for c in checks:
        assert c in chk, rel + ' 落盘校验失败：' + c[:60]
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))


# ══════ domain.js：按兵种配置取兵 ══════
patch('js/domain.js', [
    ("""  GAME.autoMarchPickArmy = function (city, want) {
    var A = DATA.TROOPS, out = {}, n = 0;
    (DATA.AUTO_MARCH.troopOrder || []).forEach(function (id) {""",
     """  GAME.autoMarchPickArmy = function (city, want, cfgArmy) {
    var A = DATA.TROOPS, out = {}, n = 0;
    /* v89.140（老板 7'）：「兵种编成这里保留 3 列，兵种、拥有（改成驻军数量）、
       自动出征数量（**各兵种提供数量输入框**）」——
       给了 cfgArmy（{ 兵种id: 数量 }）就**逐兵种按配置取**；没有配置才退回顺位口径
       （老档与"未配置任何兵种"时行为与改前一致，不会突然不出征）。 */
    if (cfgArmy) {
      Object.keys(cfgArmy).forEach(function (id) {
        var t = A[id];
        if (!t || t.craft || t.nocombat) return;
        var have = ((city.army) || {})[id] || 0;
        var take = Math.min(have, Math.max(0, Math.floor(cfgArmy[id] || 0)));
        if (take > 0) { out[id] = take; n += take; }
      });
      if (n > 0) return { army: out, total: n };
    }
    (DATA.AUTO_MARCH.troopOrder || []).forEach(function (id) {""",
     'PickArmy 支持配置'),
    ("""  GAME.autoMarchWant = function (cfg, city) {
    var total = (GAME.armyTotal && city) ? GAME.armyTotal(city) : 0;
    var want = Math.min((cfg && cfg.troops) || 0, total);
    return { total: total, avail: total, want: want > 0 ? want : 0 };
  };""",
     """  GAME.autoMarchWant = function (cfg, city) {
    var total = (GAME.armyTotal && city) ? GAME.armyTotal(city) : 0;
    /* v89.140：want = Σ 各兵种自动出征数量（有配置时）；无配置退回 `troops`（单次兵力） */
    var A = cfg && cfg.army, sum = 0;
    if (A) { for (var k in A) sum += Math.max(0, Math.floor(A[k] || 0)); }
    var want = Math.min(sum > 0 ? sum : ((cfg && cfg.troops) || 0), total);
    return { total: total, avail: total, want: want > 0 ? want : 0 };
  };""",
     'Want 支持配置'),
    ("""    var pick = GAME.autoMarchPickArmy(city, w.want);""",
     """    var pick = GAME.autoMarchPickArmy(city, w.want, cfg.army);""",
     '调用点 x2'),
], ['cfg.army', 'Math.floor(A[k] || 0)'])

# ══════ main.js：doSetAutoMarch 支持 army:<tid> ══════
patch('js/main.js', [
    ("""    if (k === 'troops' || k === 'maxLevel' || k === 'everyMin'
      || k === 'radius' || k === 'dailyMax') cfg[k] = Number(v);""",
     """    /* v89.140（老板 7'）：兵种级数量配置 —— 键形如 `army:changqiang`，
       写进 cfg.army[tid]（0 表示不带该兵种）。 */
    if (k.indexOf('army:') === 0) {
      cfg.army = cfg.army || {};
      cfg.army[k.slice(5)] = Math.max(0, Math.floor(Number(v) || 0));
      GAME.refreshView();
      return;
    }
    if (k === 'troops' || k === 'maxLevel' || k === 'everyMin'
      || k === 'radius' || k === 'dailyMax') cfg[k] = Number(v);""",
     'doSetAutoMarch army 键'),
], ["k.indexOf('army:') === 0"])

# ══════ ui.js：自动出征面板 + 附属野地 ══════
patch('js/ui.js', [
    # ① 编成表：3 列 + 输入框
    ("""    var troopBlock = '<table class="tbl exp-tbl"><colgroup>' +
        '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in"><col class="et-c-act">' +
      '</colgroup><thead><tr>' +
        '<th>兵种</th><th class="num">拥有</th><th class="ctr">出征数量</th><th class="ctr">全带</th>' +
      '</tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).map(function (id) {
        var tr = DATA.TROOPS[id] || {};
        var own = (c.army && c.army[id]) || 0;
        var off = own > 0 ? '' : ' off';
        return '<tr class="et-row' + off + '">' +
          '<td class="et-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-own num">' + own.toLocaleString() + '</td>' +
          '<td class="et-in"><input type="number" id="exp-' + id + '" min="0" max="' + own + '" value="0"' +
            (own > 0 ? '' : ' disabled') + '></td>' +
          '<td class="et-act"><button class="btn sm" data-action="exp-max" data-troop="' + id + '"' +
            (own > 0 ? '' : ' disabled') + '>全</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';""",
     """    /* v89.140（老板 7'）：「兵种编成这里保留 **3 列**：兵种、拥有（改成**驻军数量**）、
       **自动出征数量**（各兵种提供数量输入框）」——
       列：兵种 / 驻军数量 / 自动出征数量；输入框写 cfg.army[tid]（`army:<tid>` 键）。
       只列"可编入"的兵种（与 autoMarchPickArmy 同口径：器械/斥候/辎重不编入）。 */
    var troopBlock = '<table class="tbl exp-tbl"><colgroup>' +
        '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in">' +
      '</colgroup><thead><tr>' +
        '<th>兵种</th><th class="num">驻军数量</th><th class="ctr">自动出征数量</th>' +
      '</tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).filter(function (id) {
        var t = DATA.TROOPS[id];
        return t && !t.nocombat && !t.craft;
      }).map(function (id) {
        var tr = DATA.TROOPS[id] || {};
        var own = (c.army && c.army[id]) || 0;
        var cfgN = (cfg.army && cfg.army[id]) || 0;
        var off = own > 0 ? '' : ' off';
        return '<tr class="et-row' + off + '">' +
          '<td class="et-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-own num">' + U.fmt(own) + '</td>' +
          '<td class="et-in"><input type="number" id="am-a-' + id + '" min="0" max="' + own + '" value="' + cfgN + '"' +
            (own > 0 ? '' : ' disabled') + '></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';""",
     '自动出征编成 3 列'),

    # ② 右侧：删"单次兵力"块，编成块保留
    ("""        '<div class="exp-col-r">' +
          '<div class="exp-sec"><div class="exp-sec-t">单次兵力</div>' +
            sel('am-troops', '单次', troopOpts) +
            '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">城内现有 ' +
            U.fmt(have) + ' 兵；每次按此数从城内取，其余自然留守</div></div>' +
          '<div class="exp-sec exp-a-troops"><div class="exp-sec-t">兵种编成（自动）</div>' +
            '<div class="exp-troops exp-body">' + troopBlock + '</div>' +
            '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">按顺位由高到低取够「单次兵力」；' +
            '器械／斥候／辎重不编入</div></div>' +
        '</div>' +""",
     """        '<div class="exp-col-r">' +
          /* v89.140（老板 7'）：「右侧，**单次兵力这个菜单去除**」——整块退役；
             每次带多少改由下方编成表**逐兵种**指定（cfg.army）。 */
          '<div class="exp-sec exp-a-troops"><div class="exp-sec-t">兵种编成（自动）</div>' +
            '<div class="exp-troops exp-body">' + troopBlock + '</div>' +
            '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">城内现有 ' +
            U.fmt(have) + ' 兵；逐兵种填数量，0 = 不带；器械／斥候／辎重不编入</div></div>' +
        '</div>' +""",
     '删单次兵力块'),

    # ③ 删"上次结果"播报
    ("""      '</div>' +
      '<div class="exp-info exp-info-l" style="margin-top:2px;color:var(--text-dim);">上次结果：' +
        U.escape((s.autoMarchInfo && s.autoMarchInfo.msg) || '尚未执行') + '</div>';""",
     """      '</div>';
    /* v89.140（老板 7'）：「不要这种播报：上次结果：杨秀 率 500 兵 侦查 善无」——
       该行整条删除（结果仍在公文/日志里可查，主面板不再常驻一行噪声）。 */""",
     '删上次结果播报'),

    # ④ bind：删 am-troops，加兵种输入框
    ("""    bind('am-gen', 'genId'); bind('am-target', 'target'); bind('am-level', 'maxLevel');
    bind('am-radius', 'radius'); bind('am-mode', 'mode'); bind('am-scheme', 'scheme');
    bind('am-troops', 'troops'); bind('am-freq', 'everyMin'); bind('am-daily', 'dailyMax');""",
     """    bind('am-gen', 'genId'); bind('am-target', 'target'); bind('am-level', 'maxLevel');
    bind('am-radius', 'radius'); bind('am-mode', 'mode'); bind('am-scheme', 'scheme');
    /* v89.140：`am-troops`（单次兵力）退役 —— 改为逐兵种输入框（`am-a-<tid>`）*/
    bind('am-freq', 'everyMin'); bind('am-daily', 'dailyMax');
    (function () {
      var ins = document.querySelectorAll('[id^="am-a-"]');
      for (var ii = 0; ii < ins.length; ii++) {
        (function (el2) {
          el2.addEventListener('change', function () {
            GAME.doSetAutoMarch('army:' + el2.id.slice(5), el2.value);
          });
        })(ins[ii]);
      }
    })();""",
     'bind 兵种输入框'),

    # ⑤ 附属野地：加"将领"与"驻军"两列
    ("""      return '<tr' + ((pgW.from + wi) === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +
        '><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + w.x + ',' + w.y + '</td>' +
        '<td class="ctr">Lv' + w.level + '</td><td class="ctr">' + resStr + '</td>' +
        '<td class="ctr" style="color:' + (ga ? 'var(--gold-light)' : 'var(--green-ok)') + ';">' + addStr + '</td>' +
        _opsCell + '</tr>';""",
     """      /* v89.140（老板 8）：「附属野地界面，在**操作列的左边**增加一列将领和一列驻军，
         分别显示将领和军队总数」——驻军将领走 wildGarrisonAt().genId 唯一来源，
         数量走 wildGarrisonTotal（与地块界面/军务同源）。 */
      var _garW = GAME.wildGarrisonAt(w.x, w.y);
      var _garN = GAME.wildGarrisonTotal(_garW);
      var _genW = null;
      if (_garW && _garW.genId) {
        (s.generals || []).forEach(function (g0) { if (g0.id === _garW.genId) _genW = g0; });
      }
      return '<tr' + ((pgW.from + wi) === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +
        '><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + w.x + ',' + w.y + '</td>' +
        '<td class="ctr">Lv' + w.level + '</td><td class="ctr">' + resStr + '</td>' +
        '<td class="ctr" style="color:' + (ga ? 'var(--gold-light)' : 'var(--green-ok)') + ';">' + addStr + '</td>' +
        '<td class="ctr">' + (_genW ? U.escape(_genW.name) : '<span style="color:var(--text-dim);">—</span>') + '</td>' +
        '<td class="num">' + (_garN > 0 ? U.fmt(_garN) : '<span style="color:var(--text-dim);">—</span>') + '</td>' +
        _opsCell + '</tr>';""",
     '附属野地两列'),
], ['驻军数量', 'cfg.army', 'am-a-', '_genW'])
print('✅ 完成：' + ' / '.join(ok))
