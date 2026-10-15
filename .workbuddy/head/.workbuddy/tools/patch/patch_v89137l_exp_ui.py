# -*- coding: utf-8 -*-
"""v89.137 补丁 L：ui.js
  ① openExpModal：己方野地 → 只出「驻守·增援」+ 默认选中 + 已有驻将时不带将提示
  ② openWildGarrison 面板 + wg-* 助手整条退役（墓碑）
  ③ openWilds（附属野地）加"操作"列：派驻 / 采集 / 收获 / 召回
"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'ui.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s.count(old))); sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

# ══════════ ①-a 默认方式：己方野地 → station（离开自动复位） ══════════
rep(
"""    ui._expRes = t;
    ui._expMode = ui._expMode || 'occupy';""",
"""    ui._expRes = t;
    /* ============================================================
     * v89.137（老板 7）：「所有军队操作均以出征界面进行（除非采集/收获/召回这类
     *   默认全军操作）」—— 目标是**己方野地**时：
     *   · 方式默认「驻守 · 增援」（station）——见下面的 modes 过滤；
     *   · 离开己方野地时**自动复位**（防"上次选了驻守、这次打敌方被拒"的粘性）。
     * ============================================================ */
    var isOwnWild137 = !!(target && target.kind === 'wild' && GAME.map.wildAt(target.x, target.y));
    ui._expOwnWild137 = isOwnWild137;         /* 主将段/提交端读（一枚标志，一处判定） */
    ui._expMode = ui._expMode || 'occupy';
    if (isOwnWild137 && ui._expMode !== 'station') ui._expMode = 'station';
    if (!isOwnWild137 && ui._expMode === 'station') ui._expMode = 'occupy';
    /* 己方野地的现役驻将（有 → 纯增援不带将；无 → 首次/补将必选带队将领） */
    var stGen137 = null;
    if (isOwnWild137) {
      var _w137u = GAME.map.wildAt(target.x, target.y);
      if (_w137u.garrison && _w137u.garrison.genId) {
        (s.generals || []).forEach(function (g) { if (g.id === _w137u.garrison.genId) stGen137 = g; });
      }
    }""",
'默认方式')

# ══════════ ①-b modes 过滤 ══════════
rep(
"""      if (ui._expOwn) return m.id === 'transfer';
      return m.panel !== false;
    });""",
"""      if (ui._expOwn) return m.id === 'transfer';
      /* v89.137（老板 7）：目标 = **己方野地** → 只出「驻守 · 增援」（station）。
         打自家地盘没有侦察/掠夺/占领的语义；采集/收获/召回是默认全军操作，不本面板。 */
      if (isOwnWild137) return m.id === 'station';
      return m.panel !== false;
    });""",
'modes 过滤')

# ══════════ ①-c 方式下拉 label（station 专属文案） ══════════
rep(
"""        var label = ui._expOwn
          ? '🚚 调兵 · 辎重（不接战 · 兵力押运）'
          : (m.icon + ' ' + m.name + '（体' + m.stamina + ' 精' + m.energy + '）');""",
"""        var label = ui._expOwn
          ? '🚚 调兵 · 辎重（不接战 · 兵力押运）'
          : ((isOwnWild137 && m.id === 'station')
            ? '🛡️ 驻守 · 增派驻军（不接战 · 抵达即驻 · 不耗体力精力）'
            : (m.icon + ' ' + m.name + '（体' + m.stamina + ' 精' + m.energy + '）'));""",
'label')

# ══════════ ①-d 主将段：已有驻将提示 + 下拉禁用 ══════════
rep(
"""    html += '<div class="exp-sec exp-a-gen"><div class="exp-sec-t">主将 · 可用道具</div>';
    html += '<div class="exp-gen-row"><select id="exp-gen" class="exp-gen-select">';""",
"""    html += '<div class="exp-sec exp-a-gen"><div class="exp-sec-t">主将 · 可用道具</div>';
    /* v89.137（老板 7）：己方野地已有驻将 → 本次是**纯增援**（只并兵、不换驻将）；
       不给选将（选谁都不会被带走），一句话讲清。首次驻军/老档补将仍须选将。 */
    if (stGen137) {
      html += '<div class="exp-info exp-info-l" style="color:var(--gold-light);margin:2px 0 4px;">🛡️ '
        + U.escape(stGen137.name) + ' Lv' + (stGen137.level || 1)
        + ' 驻守中 —— 本次增援<b>不带将</b>（只并兵，不换驻将）</div>';
    }
    html += '<div class="exp-gen-row"><select id="exp-gen" class="exp-gen-select"' + (stGen137 ? ' disabled' : '') + '>';""",
'主将段')

# ══════════ ② openWildGarrison + 9 个助手整条退役（结构定位） ══════════
i0 = s.find("  /* 派驻面板（v23 起叫「派军驻守」")
if i0 < 0:
    print('❌ 找不到派驻面板起点'); sys.exit(1)
j0 = s.find('ui.updateWgTotal = function', i0)
if j0 < 0:
    print('❌ 找不到 updateWgTotal'); sys.exit(1)
k0 = s.find('{', j0)
depth, m = 0, k0
while m < len(s):
    if s[m] == '{':
        depth += 1
    elif s[m] == '}':
        depth -= 1
        if depth == 0:
            break
    m += 1
e0 = s.find(';', m)
assert e0 > 0 and (e0 - m) < 4, '助手尾异常'
print('ui 退役片段 %d 字节（驻军面板 + 9 个助手）' % (e0 + 1 - i0))
tomb = """  /* ============================================================
   * ⛔ v89.137（老板 7）：**派驻面板整条退役** ——
   * 老板：「派驻弹出出征界面（即侦察/掠夺/占领界面）…所有军队操作均以出征界面进行，
   *   除非像采集，收获，召回这种默认全军操作」。
   * 本面板（派兵表格 + 选将 + 确定派驻）与其 9 个界面助手（wgOwn / wgRoom / wgSum /
   * wgSet / wgStep / wgMax / wgFill / wgClear / updateWgTotal）一并删除；
   * 「派驻 / 增派驻军」按钮改走 `ui.openExpModal({kind:'wild'})`（方式 = 驻守·增援），
   * 提交链路 = dispatch → prepare（上限预检 + 无将硬闸）→ 抵达 station 分支 → wildGarrisonAdd。
   * 如需恢复：本段代码见 `backup/v89137/ui.js`（判据：`ui.openWildGarrison = function`）。
   * ============================================================ */"""
s = s[:i0] + tomb + s[e0 + 1:]
ok.append('openWildGarrison 退役')

# ══════════ ③ openWilds：加"操作"列 ══════════
rep(
"""      return '<tr' + ((pgW.from + wi) === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +
        '><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + w.x + ',' + w.y + '</td>' +
        '<td class="ctr">Lv' + w.level + '</td><td class="ctr">' + resStr + '</td>' +
        '<td class="ctr" style="color:' + (ga ? 'var(--gold-light)' : 'var(--green-ok)') + ';">' + addStr + '</td></tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">尚未占领野地（在地图点击野地格派兵占领）</td></tr>';""",
"""      /* ============================================================
       * v89.137（老板 6）：「进入附属野地界面，上边对各野地分别同步增加操作列，
       *   设置派驻，采集，收获，召回按钮」——
       *   · 派驻 → 出征界面（station · 与地块/军务同一条唯一入口）
       *   · 采集 → 原地开工（须驻军**有将**；已在采集中则禁用）
       *   · 收获 → 满 1 小时方可（判据与 gather-finish 同源：gatherYield().ready）
       *   · 召回 → 撤回驻军（将领随军回城）
       * 禁用态一律**写清原因**（悬停），不做"点了才报错"。
       * ============================================================ */
      var _hasGar137 = GAME.wildGarrisonTotal(w.garrison) > 0;
      var _hasGen137 = !!(w.garrison && w.garrison.genId);
      var _gy137 = ga ? GAME.gatherYield(ga) : null;
      var _opsCell = '<td class="ctr" style="white-space:nowrap;">' +
        '<button class="btn xs" data-action="wild-garrison-open" data-x="' + w.x + '" data-y="' + w.y +
          '" title="派驻 / 增派驻军 —— 走出征界面（驻守·增援）">🛡️ 派驻</button> ' +
        ((_hasGen137 && !ga)
          ? '<button class="btn xs gold" data-action="wild-garrison-gather" data-x="' + w.x + '" data-y="' + w.y +
            '" title="驻军原地开工开采（不抽兵）">⛏️ 采集</button>'
          : '<button class="btn xs" disabled title="' +
            (_hasGar137 ? (ga ? '已在采集中' : '驻军须有将领带队（派驻时选一位将领补驻）') : '先派驻军（首次须带将）')
            + '">⛏️ 采集</button>') + ' ' +
        ((_gy137 && _gy137.ready)
          ? '<button class="btn xs gold" data-action="gather-finish" data-id="' + ga.id + '" title="收成入城">📦 收获</button>'
          : '<button class="btn xs" disabled title="满 1 小时方可收获">📦 收获</button>') + ' ' +
        (_hasGar137
          ? '<button class="btn xs red" data-action="wild-withdraw" data-x="' + w.x + '" data-y="' + w.y +
            '" title="撤回驻军（将领随军回城）">🏳️ 召回</button>'
          : '<button class="btn xs" disabled title="该野地没有驻军">🏳️ 召回</button>') +
        '</td>';
      return '<tr' + ((pgW.from + wi) === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +
        '><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + w.x + ',' + w.y + '</td>' +
        '<td class="ctr">Lv' + w.level + '</td><td class="ctr">' + resStr + '</td>' +
        '<td class="ctr" style="color:' + (ga ? 'var(--gold-light)' : 'var(--green-ok)') + ';">' + addStr + '</td>' +
        _opsCell + '</tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">尚未占领野地（在地图点击野地格派兵占领）</td></tr>';""",
'操作列 rows')

rep(
"""      '<table class="tbl"><thead><tr><th>地形</th><th>坐标</th><th>等级</th><th>产出资源</th><th>加成 / 采集</th></tr></thead>' +""",
"""      '<table class="tbl"><thead><tr><th>地形</th><th>坐标</th><th>等级</th><th>产出资源</th><th>加成 / 采集</th><th class="ctr">操作</th></tr></thead>' +""",
'操作列表头')

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
import re as _re
_code = _re.sub(r'/\*[\s\S]*?\*/', '', chk)   # 剥块注释：墓碑里写了判据名，不许命中自身（§48.4）
assert 'ui.openWildGarrison = function' not in _code, '面板残留'
assert 'ui.updateWgTotal = function' not in _code, '助手残留'
assert 'stGen137' in chk and '_opsCell' in chk, '新段未落盘'
assert chk.count('{') == chk.count('}'), '花括号不配平 %d/%d' % (chk.count('{'), chk.count('}'))
print('✅ ui.js 补丁L 完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
