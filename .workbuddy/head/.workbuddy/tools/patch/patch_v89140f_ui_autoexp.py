# -*- coding: utf-8 -*-
"""v89.140 批五-b：ui.js 自动出征面板（编成 3 列 + 去单次兵力 + 去播报）+ 附属野地两列"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'ui.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag, exp=1):
    global s
    cnt = s.count(old)
    assert cnt == exp, '%s 锚点命中 %d 次（期望 %d）' % (tag, cnt, exp)
    s = s.replace(old, new)
    ok.append(tag)


# ① 编成表：3 列 + 输入框（含删 order）
rep("""    /* 右栏编成表：复用出征面板的 .exp-tbl（固定列宽，换城不抖） */
    var order = A.troopOrder || [];
    var troopBlock = '<table class="tbl exp-tbl"><colgroup>' +
      '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in"><col class="et-c-act">' +
      '</colgroup><thead><tr><th>兵种</th><th class="num">拥有</th><th class="ctr">自动编入</th>' +
      '<th class="ctr">顺位</th></tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).map(function (id) {
        var tr = DATA.TROOPS[id] || {}, own = (city && city.army && city.army[id]) || 0;
        var idx = order.indexOf(id);
        var ban = !!(tr.craft || tr.nocombat) || idx < 0;
        return '<tr class="et-row' + ((ban || own <= 0) ? ' off' : '') + '">' +
          '<td class="et-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-own num">' + own.toLocaleString() + '</td>' +
          '<td class="et-in ctr">' + (ban ? '— 不编入' : '✅ 可编') + '</td>' +
          '<td class="et-act ctr">' + (ban ? '—' : String(idx + 1)) + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';""",
"""    /* 右栏编成表（v89.140 老板 7'）：「兵种编成这里保留 **3 列**：兵种、拥有（改成**驻军数量**）、
       **自动出征数量**（各兵种提供数量输入框）」——
       输入框直接写 cfg.army[tid]（`army:<tid>` 键，经 doSetAutoMarch）；
       只列"可编入"的兵种（与 autoMarchPickArmy 同口径：器械/斥候/辎重不编入）。
       v89.93 的"自动编入/顺位"只读两列随"单次兵力"一并退役。 */
    var troopBlock = '<table class="tbl exp-tbl"><colgroup>' +
      '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in">' +
      '</colgroup><thead><tr><th>兵种</th><th class="num">驻军数量</th><th class="ctr">自动出征数量</th>' +
      '</tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).filter(function (id) {
        var t = DATA.TROOPS[id];
        return t && !t.nocombat && !t.craft;
      }).map(function (id) {
        var tr = DATA.TROOPS[id] || {}, own = (city && city.army && city.army[id]) || 0;
        var cfgN = (cfg.army && cfg.army[id]) || 0;
        return '<tr class="et-row' + (own <= 0 ? ' off' : '') + '">' +
          '<td class="et-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-own num">' + U.fmt(own) + '</td>' +
          '<td class="et-in"><input type="number" id="am-a-' + id + '" min="0" max="' + own + '" value="' + cfgN + '"' +
            (own > 0 ? '' : ' disabled') + '></td>' +
          '</tr>';
      }).join('') + '</tbody></table>';""",
    '编成表 3 列')

# ② 删 troopOpts（单次兵力专用）
rep("""    var troopOpts = A.troopOptions.map(function (v) {
      return { v: v, on: v === cfg.troops, label: U.fmt(v) + (have >= v ? '' : '（城内不足）') };
    });
""",
"""    /* ⛔ v89.140（老板 7'）：`troopOpts`（单次兵力下拉的选项）随该块退役 */
""",
    '删 troopOpts')

# ③ 右侧：删"单次兵力"块
rep("""        '<div class="exp-col-r">' +
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
            U.fmt(have) + ' 兵；**逐兵种填数量**（0 = 不带），器械／斥候／辎重不编入</div></div>' +
        '</div>' +""",
    '删单次兵力块')

# ④ 删"上次结果"播报
rep("""      '</div>' +
      '<div class="exp-info exp-info-l" style="margin-top:2px;color:var(--text-dim);">上次结果：' +
        U.escape((s.autoMarchInfo && s.autoMarchInfo.msg) || '尚未执行') + '</div>';""",
"""      '</div>';
    /* v89.140（老板 7'）：「不要这种播报：上次结果：杨秀 率 500 兵 侦查 善无」——
       该行整条删除（结果仍在公文/日志里可查，主面板不再常驻一行噪声）。 */""",
    '删上次结果播报')

# ⑤ bind：am-troops 退役 + 兵种输入框接线
rep("""    bind('am-gen', 'genId'); bind('am-target', 'target'); bind('am-level', 'maxLevel');
    bind('am-radius', 'radius'); bind('am-mode', 'mode'); bind('am-scheme', 'scheme');
    bind('am-troops', 'troops'); bind('am-freq', 'everyMin'); bind('am-daily', 'dailyMax');""",
"""    bind('am-gen', 'genId'); bind('am-target', 'target'); bind('am-level', 'maxLevel');
    bind('am-radius', 'radius'); bind('am-mode', 'mode'); bind('am-scheme', 'scheme');
    /* v89.140（老板 7'）：`am-troops`（单次兵力）退役 —— 改为逐兵种输入框（`am-a-<tid>`）。
       写值走 doSetAutoMarch('army:<tid>')，界面不自己拼 cfg（保留"唯一出口"）。 */
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
    'bind 兵种输入框')

# ⑥ 附属野地：加"将领"与"驻军"两列
rep("""      return '<tr' + ((pgW.from + wi) === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +
        '><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + w.x + ',' + w.y + '</td>' +
        '<td class="ctr">Lv' + w.level + '</td><td class="ctr">' + resStr + '</td>' +
        '<td class="ctr" style="color:' + (ga ? 'var(--gold-light)' : 'var(--green-ok)') + ';">' + addStr + '</td>' +
        _opsCell + '</tr>';""",
"""      /* v89.140（老板 8）：「附属野地界面，在**操作列的左边**增加一列将领和一列驻军，
         分别显示将领和军队总数」——驻军将领走 wildGarrisonAt().genId（唯一来源），
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
    '附属野地两列')

assert '\r\n' not in s
assert s.count('{') == s.count('}'), '花括号不配平'
tmp = p + '.tmp140'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
for c in ['驻军数量', 'am-a-', '_genW', '逐兵种填数量']:
    assert c in chk, c
print('✅ ui.js：%d → %d 字节 · %s' % (n0, len(chk), ' / '.join(ok)))
