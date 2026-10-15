# -*- coding: utf-8 -*-
"""v89.197 批次D：出征界面规范（老板 3/4/5）
① ui.js：expRowHTML 统一行出口 + 战法 chips 改标准组件 + 7 个模块重构
   （消除标题双写 · 名称固定宽 · 备注悬停化）
② index.html：.exp-row/.exp-lab CSS + .chip.off 通用化；删旧三条
③ smoke：§94 判据 .exp-ops-row → .exp-row
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(p, tag, old, new, mark, cnt=1):
    s = rd(p)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + ' (expect ' + str(cnt) + ')'
    wr(p, s.replace(old, new))
    print('[ok] ' + tag)

# ══════════ D1：ui.js — 新出口（expRowHTML）+ 战法 chips 组件化 ══════════
rep('js/ui.js', 'D1a expRowHTML + chips 组件化',
    u"""  ui.expOpsChipsHTML = function () {
    var cur = GAME.opsIdOf(ui._expOps);
    return (DATA.OPS || []).map(function (o) {
      var lock = ui.expOpsLockOf(o.id);
      return '<span class="ch' + (cur === o.id ? ' active' : '') + ((lock && o.id !== cur) ? ' off' : '') +
        '" data-action="exp-ops" data-v="' + o.id + '" title="' + U.escape(lock || o.desc) + '">' +
        o.icon + ' ' + o.name + '</span>';
    }).join('');
  };""",
    u"""  /* v89.197（老板 3/4）：**出征模块统一行** ——「名称（固定宽 4.5em）+ 控件（flex:1）」。
     备注（说明性文字）一律收进 .tip-src → 悬停走全站唯一浮层 #tip-layer（规格相同）；
     tipHTML 传 null = 该模块无备注（"底下适合的才给备注"）。 */
  ui.expRowHTML = function (lab, ctrl, tipHTML) {
    return '<div class="exp-row"' + (tipHTML ? ' data-tip-el="1"' : '') + '>' +
      '<span class="exp-lab">' + lab + '</span>' +
      ctrl +
      (tipHTML ? '<span class="tip-src">' + tipHTML + '</span>' : '') +
      '</div>';
  };
  ui.expOpsChipsHTML = function () {
    var cur = GAME.opsIdOf(ui._expOps);
    /* v89.197（老板 3）：改用**全站标准 chips 组件**（.chips/.chip.on/off）——
       病根：旧类名 `ch` 全站只有一条 `.exp-ops-row .ch.off` 规则、**没有任何基础样式**，
       三个战法呈现为"无边框、无选中高亮"的裸文本（选没选中一个样）——
       这正是"战法好像没发挥过作用"的视觉根因之一（探针+源码双重取证）。
       修后：选中态 on 高亮、悬停可辨、不可用 off 置灰（.chips .chip.off 通用规则）。 */
    return '<span class="chips chips-xs">' + (DATA.OPS || []).map(function (o) {
      var lock = ui.expOpsLockOf(o.id);
      return '<span class="chip' + (cur === o.id ? ' on' : '') + ((lock && o.id !== cur) ? ' off' : '') +
        '" data-action="exp-ops" data-v="' + o.id + '" title="' + U.escape(lock || o.desc) + '">' +
        o.icon + ' ' + o.name + '</span>';
    }).join('') + '</span>';
  };""",
    'v89.197（老板 3/4）：**出征模块统一行**')

# ══════════ D1b：expOpsBlockHTML 统一行 ══════════
rep('js/ui.js', 'D1b expOpsBlockHTML',
    u"""  ui.expOpsBlockHTML = function () {
    return '<div class="exp-ops-row"><span class="exp-ops-lab">战法</span>' +
      '<span id="exp-ops">' + ui.expOpsChipsHTML() + '</span></div>' +
      '<div class="exp-info exp-info-l" id="exp-ops-note" style="color:var(--text-dim);margin:2px 0 0;">' +
      ui.expOpsNoteHTML() + '</div>';
  };""",
    u"""  ui.expOpsBlockHTML = function () {
    /* v89.197（老板 3/4）：统一行 —— 名称固定宽 + chips；说明收进 .tip-src 悬停源
       （#exp-ops-note id 保留 —— setExpOps 更新它的内容，悬停实时读到新值）。 */
    return ui.expRowHTML('战法',
      '<span id="exp-ops" class="exp-ops-cell">' + ui.expOpsChipsHTML() + '</span>',
      '<span id="exp-ops-note">' + ui.expOpsNoteHTML() + '</span>');
  };""",
    'D1b 统一行')

# ══════════ D1c：tgtSel / schemeSel 去 label ══════════
rep('js/ui.js', 'D1c tgtSel',
    u"""    var tgtSel = '';
    if (ui._expTargets.length > 1) {
      tgtSel = '<div class="exp-sel"><label>目标</label><select id="exp-target">' +
        ui._expTargets.map(function (tg, i) {
          return '<option value="' + i + '"' + (i === 0 ? ' selected' : '') + '>' +
            U.escape(ui.expTargetLabel(tg)) + (i === 0 ? '　·当前' : '') + '</option>';
        }).join('') + '</select></div>';
    }""",
    u"""    var tgtSel = '';
    if (ui._expTargets.length > 1) {
      /* v89.197（老板 3）：裸 select（label 双写退役——名称统一由 exp-lab 列给） */
      tgtSel = '<select id="exp-target">' +
        ui._expTargets.map(function (tg, i) {
          return '<option value="' + i + '"' + (i === 0 ? ' selected' : '') + '>' +
            U.escape(ui.expTargetLabel(tg)) + (i === 0 ? '　·当前' : '') + '</option>';
        }).join('') + '</select>';
    }""",
    'D1c 裸 select')

rep('js/ui.js', 'D1d schemeSel',
    u"""    var schemeSel = '<div class="exp-sel"><label>计略</label><select id="exp-scheme-sel">' +
      ui.expSchemeOptionsHTML() + '</select><span class="exp-tac-link" data-action="exp-scheme">详情</span></div>';""",
    u"""    /* v89.197（老板 3）：裸 select + 详情链接（label 双写退役） */
    var schemeSel = '<select id="exp-scheme-sel">' +
      ui.expSchemeOptionsHTML() + '</select><span class="exp-tac-link" data-action="exp-scheme">详情</span>';""",
    'D1d 裸 select + 详情链接')

# ══════════ D1e：目标模块 ══════════
rep('js/ui.js', 'D1e 目标模块',
    u"""    html += '<div class="exp-sec exp-a-target"><div class="exp-sec-t">目标</div>';
    html += tgtSel;                              /* v89.57：目标下拉框（当前 + 同县普通城 / 据点 / 己方城） */""",
    u"""    /* v89.197（老板 3）：「一个目标」——标题+label 双写退役；名称固定宽、右边直接是下拉框
       （单目标时给静态文本，名称列照旧对齐）。 */
    html += '<div class="exp-sec exp-a-target">';
    html += ui.expRowHTML('目标', tgtSel || ('<span class="exp-one">' + U.escape(_tTitle) + '</span>'), null);""",
    'D1e 目标模块')

# ══════════ D1f：主将模块 ══════════
rep('js/ui.js', 'D1f 主将模块头',
    u"""    /* ② 主将 + 可用道具（左中）—— 主将缺省已在函数开头定好（v89.57） */
    /* v89.156（老板 3）：标题去掉「· 可用道具」（可用道具已独立成块） */
    html += '<div class="exp-sec exp-a-gen"><div class="exp-sec-t">主将</div>';""",
    u"""    /* ② 主将（左中）—— 主将缺省已在函数开头定好（v89.57）；
       v89.197（老板 3）：统一行（标题双写退役；备注=驻将说明与相称建议，均在下方照常显示）。 */
    html += '<div class="exp-sec exp-a-gen">';""",
    'D1f 主将模块头')

rep('js/ui.js', 'D1f2 主将 select',
    u"""    html += '<div class="exp-gen-row"><select id="exp-gen" class="exp-gen-select"' + (stGen137 ? ' disabled' : '') + '>';
    html += s.generals.map(function (g) {""",
    u"""    var genSelHTML = '<select id="exp-gen" class="exp-gen-select"' + (stGen137 ? ' disabled' : '') + '>';
    genSelHTML += s.generals.map(function (g) {""",
    'D1f2 主将 select')

rep('js/ui.js', 'D1f3 主将 select 收尾',
    u"""        U.escape(g.name) + (blk ? '（' + U.escape(blk) + '）' : '（' + six + '）') + '</option>';
    }).join('');
    html += '</select></div>';""",
    u"""        U.escape(g.name) + (blk ? '（' + U.escape(blk) + '）' : '（' + six + '）') + '</option>';
    }).join('');
    genSelHTML += '</select>';
    html += ui.expRowHTML('主将', genSelHTML, null);""",
    'D1f3 主将 select 收尾')

# ══════════ D1g：计略模块 ══════════
rep('js/ui.js', 'D1g 计略模块',
    u"""      /* ⑤ 计略（2×2 左上）—— v89.59：站位并入「出征战术」菜单，这里只留计略 */
      html += '<div class="exp-sec exp-a-tactic"><div class="exp-sec-t">计略</div>';
      html += schemeSel;                       /* 计略下拉框 + 详情 */
      html += '<div class="exp-info exp-info-l" id="exp-scheme-label" style="color:var(--text-dim);margin-bottom:6px;">' + U.escape(ui.expSchemeLabel()) + '</div>';""",
    u"""      /* ⑤ 计略（2×2 左上）—— v89.59：站位并入「出征战术」菜单，这里只留计略；
         v89.197（老板 4）：计略说明改**悬停**（#exp-scheme-label 挪进 .tip-src） */
      html += '<div class="exp-sec exp-a-tactic">';
      html += ui.expRowHTML('计略', schemeSel, '<span id="exp-scheme-label">' + U.escape(ui.expSchemeLabel()) + '</span>');""",
    'D1g 计略模块')

# ══════════ D1h：出征方式（fortModeNote 悬停化）══════
rep('js/ui.js', 'D1h fortModeNote 悬停',
    u"""    var fortModeNote = (t.kind === 'fort')
      ? '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">据点：占领=拔除并收为「我方前哨」（不转城市、不占城池名额）——辐射 6~14 格（随据点等级）内野地：衰减减半 / 采集增产 / 驻军上限加成 / 情报 / 商税（均随后哨等级）。</div>'
      : '';
    html += '<div class="exp-sec exp-a-modes"><div class="exp-sec-t">出征方式</div>' + modeSelHTML + fortModeNote
      + ui.expOpsBlockHTML() + '</div>';""",
    u"""    /* v89.197（老板 4）：据点说明改**悬停**（挂「出征方式」名称；内容=游戏内实情） */
    var fortModeNote = (t.kind === 'fort')
      ? '据点：占领=拔除并收为「我方前哨」（不转城市、不占城池名额）——辐射 6~14 格（随据点等级）内野地：衰减减半 / 采集增产 / 驻军上限加成 / 情报 / 商税（均随后哨等级）。'
      : null;
    html += '<div class="exp-sec exp-a-modes">' + ui.expRowHTML('出征方式', modeSelHTML, fortModeNote)
      + ui.expOpsBlockHTML() + '</div>';""",
    'D1h 据点说明改**悬停**')

# ══════════ D1i：方案模块 ══════════
rep('js/ui.js', 'D1i 方案模块',
    u"""      html += '<div class="exp-sec exp-a-plan"><div class="exp-sec-t">方案</div>';
      html += '<div class="exp-sel"><label>方案</label><select id="exp-plan">' + ui.expPlanOptionsHTML() + '</select>' +
        '<span class="exp-tac-link" data-action="open-plan">设置</span></div>';
      html += '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">套用方案即按其配好兵力与战术</div>';
      html += '</div>';""",
    u"""      html += '<div class="exp-sec exp-a-plan">';
      html += ui.expRowHTML('方案',
        '<select id="exp-plan">' + ui.expPlanOptionsHTML() + '</select><span class="exp-tac-link" data-action="open-plan">设置</span>',
        '套用方案即按其配好兵力与战术');
      html += '</div>';""",
    'D1i 方案模块')

# ══════════ D1j：出征战术模块 ══════════
rep('js/ui.js', 'D1j 出征战术模块',
    u"""      html += '<div class="exp-sec exp-a-tacmenu"><div class="exp-sec-t">出征战术</div>';
      html += '<div class="exp-sel"><label>战术</label><select id="exp-tactic">' + ui.expTacticOptionsHTML() + '</select>' +
        '<span class="exp-tac-link" data-action="open-tactic-set">设置</span></div>';""",
    u"""      html += '<div class="exp-sec exp-a-tacmenu">';
      html += ui.expRowHTML('出征战术',
        '<select id="exp-tactic">' + ui.expTacticOptionsHTML() + '</select><span class="exp-tac-link" data-action="open-tactic-set">设置</span>',
        null);""",
    'D1j 出征战术模块')

# ══════════ D1k：可用道具模块 ══════════
rep('js/ui.js', 'D1k 可用道具模块',
    u"""    html += '<div class="exp-sec exp-a-items"><div class="exp-sec-t">可用道具</div>';
    html += '<div class="exp-sel"><label>道具</label>' +
      '<select id="exp-item-sel"><option value="">（选择道具）</option></select>' +
      '<span class="exp-tac-link" id="exp-item-use" data-action="exp-use-item-pick" title="使用所选道具（作用于当前主将）">使用</span></div>';""",
    u"""    html += '<div class="exp-sec exp-a-items">';
    html += ui.expRowHTML('可用道具',
      '<select id="exp-item-sel"><option value="">（选择道具）</option></select>' +
      '<span class="exp-tac-link" id="exp-item-use" data-action="exp-use-item-pick" title="使用所选道具（作用于当前主将）">使用</span>',
      null);""",
    'D1k 可用道具模块')

# ══════════ D1l：modeSelHTML 去 label ══════════
rep('js/ui.js', 'D1l modeSelHTML',
    u"""    var modeSelHTML = '<div class="exp-sel"><label>方式</label><select id="exp-mode" class="exp-mode-select">' +""",
    u"""    var modeSelHTML = '<select id="exp-mode" class="exp-mode-select">' +""",
    'D1l modeSelHTML')

rep('js/ui.js', 'D1l2 modeSelHTML 收尾',
    u"""      }).join('') + '</select></div>';
    var cur = GAME.battle.modeOf(ui._expMode);""",
    u"""      }).join('') + '</select>';
    var cur = GAME.battle.modeOf(ui._expMode);""",
    'D1l2 modeSelHTML 收尾')

# ══════════ D2：index.html CSS ══════════
rep('index.html', 'D2a .exp-row CSS',
    u"""  .exp-sel.act-row .act-none { flex: 0 0 auto; }""",
    u"""  .exp-sel.act-row .act-none { flex: 0 0 auto; }
  /* ============================================================
   * v89.197（老板 3/4）：出征模块统一为「名称（固定宽）+ 控件」行 ——
   *   所有模块名称列等宽（4.5em → 控件左缘天然对齐）；右边直接是控件；
   *   说明性备注收进 .tip-src → 悬停走全站唯一浮层 #tip-layer（相同规格）。
   * 判据：实机量各 .exp-row > select 的 x 相等（名称列同宽的硬证据）。
   * ============================================================ */
  .exp-row { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-2); }
  .exp-sec > .exp-row:last-child { margin-bottom: 0; }
  .exp-lab { flex: none; width: 4.5em; color: var(--gold-light); font-weight: 700; font-size: var(--fs-sub); white-space: nowrap; }
  /* 有悬停备注的名称：虚线下划线 + help 光标（"哪里可悬停"要看得出来） */
  .exp-row[data-tip-el] .exp-lab { cursor: help; text-decoration: underline dotted rgba(var(--gold-rgb),.5); text-underline-offset: 3px; }
  .exp-row > select { flex: 1 1 auto; min-width: 0; padding: var(--sp-1) var(--sp-2); background: var(--slab-1);
    border: 1px solid var(--gold-dark); color: var(--text); border-radius: var(--r-sm); font-size: var(--fs-sub); }
  .exp-row > select:disabled { opacity: .55; }
  .exp-row > .exp-one { flex: 1 1 auto; min-width: 0; color: var(--text-dim); font-size: var(--fs-sub);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .exp-row > .exp-ops-cell { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: var(--sp-1); flex-wrap: wrap; }""",
    'v89.197（老板 3/4）：出征模块统一为')

rep('index.html', 'D2b 删 exp-gen-row',
    u"""  .exp-gen-row { margin-bottom: var(--sp-1); }
""",
    u"""  /* v89.197（老板 3）：`.exp-gen-row` 随出征模块统一行退役（主将行并入 .exp-row）。 */
""",
    'D2b 删 exp-gen-row')

rep('index.html', 'D2c exp-ops 旧样式退役 + chip.off',
    u"""  .exp-ops-row { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; margin: var(--sp-1) 0 0; }
  .exp-ops-lab { flex: none; color: var(--gold-light); font-size: var(--fs-sub); }
  .exp-ops-row .ch.off { opacity: .38; cursor: not-allowed; }""",
    u"""  /* v89.197（老板 3/4）：`.exp-ops-row / .exp-ops-lab` 退役 —— 战法行并入统一 .exp-row
     （名称列 .exp-lab）＋标准 chips 组件；禁用态规则通用化为 `.chips .chip.off`（见 chips 段）。 */""",
    'D2c 旧样式退役')

rep('index.html', 'D2d chip.off 通用',
    u"""  .chips-xs .chip { padding: var(--sp-hair) var(--sp-2); font-size: var(--fs-cap); border-radius: var(--r-lg); }""",
    u"""  .chips-xs .chip { padding: var(--sp-hair) var(--sp-2); font-size: var(--fs-cap); border-radius: var(--r-lg); }
  /* v89.197（老板 3）：chip 禁用态通用化（原 `.exp-ops-row .ch.off` —— 战法"不可用"置灰语义） */
  .chips .chip.off { opacity: .38; cursor: not-allowed; }""",
    'D2d chip.off')

# ══════════ D3：smoke 判据升级 ══════════
rep('smoke-test.js', 'D3 §94 判据',
    u"""      var cOk = _h94.indexOf('.rp-lines') >= 0 && _h94.indexOf('.rp-gain') >= 0
        && _h94.indexOf('.exp-ops-row') >= 0 && _h94.indexOf('.rp-range') >= 0""",
    u"""      /* v89.197（老板 3）规则变更所致：`.exp-ops-row` 随出征统一行退役 —— 判据換 `.exp-row`。 */
      var cOk = _h94.indexOf('.rp-lines') >= 0 && _h94.indexOf('.rp-gain') >= 0
        && _h94.indexOf('.exp-row') >= 0 && _h94.indexOf('.rp-range') >= 0""",
    'D3 判据')

print('批次 D 完成')
