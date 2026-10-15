# -*- coding: utf-8 -*-
"""v89.198 批次C：ui.js —— ① 战法块全清 ② 备注四项（阵位/精力体力/相称建议/锦囊）
③ 管理弹窗（自动出征·详细配置）统一行改造"""

import io

def rd(p):
    return io.open(p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    c = s.count(old)
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

def cut(path, tag, old, new):
    s = rd(path)
    c = s.count(old)
    if c == 0:
        print('[skip] ' + tag + '（已缩减/已落盘）')
        return
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

def slice_rep(path, tag, start, end, new, mark):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    i1 = s.find(start)
    assert i1 >= 0, '[FAIL] ' + tag + ' start 未找到'
    i2 = s.find(end, i1)
    assert i2 >= 0, '[FAIL] ' + tag + ' end 未找到'
    i2 += len(end)
    s = s[:i1] + new + s[i2:]
    wr(path, s)
    print('[ok] ' + tag)

U = 'E:/Deepseekdb/js/ui.js'

# ============ ① 战法块全清 ============
# u1 setExpScheme 里的联动
cut(U, 'U1 setExpScheme 联动退役',
"""    /* v89.94（E2）：计略变 → 战法解锁态跟着变（奇袭须有计略；撤了计略则奇袭置灰） */
    if (ui.setExpOps) ui.setExpOps(ui._expOps);
  };""",
"""    /* \u26d4 v89.198：战法解锁态联动随玩法全撤退役（计略变动不再需要刷新战法按钮）。 */
  };""")

# u2a 块头 + _expOps + expOpsLockOf
slice_rep(U, 'U2a 战法状态/锁定判据退役',
"  /* ============================================================\n   * v89.94（B2 · E2）：战法三选（强攻 / 围困 / 奇袭）—— 出兵前最后一次决断",
"    return GAME.opsConfigIssueOf(id, ui._expRes, ui._expScheme || null);\n  };\n",
"""  /* ============================================================
   * \u26d4 v89.198（老板「清除战法这个玩法」· 2026-10-05）：战法三选（强攻/围困/奇袭）
   *   从出征面板整条退役 —— 状态（_expOps）/ 锁定判据（expOpsLockOf）/ chips / 说明 /
   *   setExpOps 全清；出征一律按无修正口径。沿革与去向见 js/data.js 的 DATA.OPS 墓碑。
   * ============================================================ */
""",
    '从出征面板整条退役')

# u2b chips/note/block/setExpOps
slice_rep(U, 'U2b chips/说明/块/setExpOps 退役',
"  ui.expOpsChipsHTML = function () {",
"    ui.updateExpMarch();          /* 围困改行军时长 → 预估行实时刷新（同一出口） */\n  };\n",
"""  /* \u26d4 v89.198：expOpsChipsHTML / expOpsNoteHTML / expOpsBlockHTML / setExpOps 全清（见上）。 */
""",
    'expOpsNoteHTML / expOpsBlockHTML / setExpOps 全清')

# u3 调运复位
rep(U, 'U3 调运复位去 ops',
"""    if (ui._expOwn) { ui._expMode = 'transfer'; ui._expOps = 'assault'; }""",
"""    if (ui._expOwn) { ui._expMode = 'transfer'; }""",
    "if (ui._expOwn) { ui._expMode = 'transfer'; }")

# u4a/b/c sync 调用清
cut(U, 'U4a expApplyPlan 去 sync 调用',
"""    if (p.tactics) GAME.state.tactics = U.deep(p.tactics);
    ui.syncExpTacticRow();
    ui.updateExpMarch();""",
"""    if (p.tactics) GAME.state.tactics = U.deep(p.tactics);
    ui.updateExpMarch();""")

cut(U, 'U4b expApplyTactic 智能分支去 sync 调用',
"""      if (GAME.battle && GAME.battle.setSmartBattle) GAME.battle.setSmartBattle(true);
      ui.syncExpTacticRow();
      ui.toast('⚡ 智能战斗已开启：接敌自动转防御 · 按克制逐回合指派目标');""",
"""      if (GAME.battle && GAME.battle.setSmartBattle) GAME.battle.setSmartBattle(true);
      ui.toast('⚡ 智能战斗已开启：接敌自动转防御 · 按克制逐回合指派目标');""")

cut(U, 'U4c expApplyTactic 尾部去 sync 调用',
"""      ui.tacticSetsOf().forEach(function (x) { if (x.id === tid) GAME.state.tactics = U.deep(x.tactics || {}); });
    }
    ui.syncExpTacticRow();
  };""",
"""      ui.tacticSetsOf().forEach(function (x) { if (x.id === tid) GAME.state.tactics = U.deep(x.tactics || {}); });
    }
  };""")

rep(U, 'U4d syncExpTacticRow 函数退役',
"""  /* 阵位摘要刷新（设置/套用后调用，不重绘弹窗） */
  ui.syncExpTacticRow = function () {
    var sum = document.getElementById('exp-tac-sum');
    if (!sum) return;
    /* v89.164：智能开启时摘要行直接写"智能战斗"（手动战术表另存着，随时可切回） */
    sum.textContent = (GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf())
      ? '⚡ 智能战斗（接敌转守 · 逐回合自动指挥）'
      : GAME.tacticSummary();
  };""",
"""  /* \u26d4 v89.198（老板 3）：「阵位」摘要行退役 —— syncExpTacticRow 一并删（行已不渲染）。 */""",
    'syncExpTacticRow 一并删')

# ============ ② 备注四项 ============
# u5 阵位行退役
rep(U, 'U5 阵位行退役',
"""      html += '<div class="exp-info exp-info-l" style="margin-bottom:0;">阵位 <b id="exp-tac-sum">' + GAME.tacticSummary() + '</b>' +
        '<span class="exp-tac-link" data-action="open-tactic">逐兵种</span></div>';""",
"""      /* \u26d4 v89.198（老板 3）：「阵位 … 逐兵种」备注行退役 —— 摘要与选择框重复；
         逐兵种编辑器仍可经「设置」→「逐兵种调整」进入（openTacticSets）。 */""",
    '「阵位 … 逐兵种」备注行退役')

# u6 相称建议移入目标区
rep(U, 'U6 相称建议移入目标区',
"""    html += ui.expRowHTML('目标', tgtSel || ('<span class="exp-one">' + U.escape(_tTitle) + '</span>'), null);
    /* v89.156（老板 3）：「目标」的备注**只提示出征限制性信息**（领地满 / 野地满 /""",
"""    html += ui.expRowHTML('目标', tgtSel || ('<span class="exp-one">' + U.escape(_tTitle) + '</span>'), null);
    /* v89.198（老板 5）：「相称建议」由主将区**移入目标区**（它是随目标变化的建议）。
       纯按目标等级给"宜派"的档位（守将实情请侦查；软提示、非门槛）。
       v89.129 建立（原挂主将区）；目标切换时整窗重绘，本行随 t 重建。 */
    var rec129 = GAME.recGenOf(t);
    if (rec129) {
      html += '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin:4px 0 0;">'
        + '相称建议：宜 <b>' + U.escape(rec129.text) + '</b> 带队</div>';
    }
    /* v89.156（老板 3）：「目标」的备注**只提示出征限制性信息**（领地满 / 野地满 /""",
    '「相称建议」由主将区**移入目标区**')

# u7 主将区：换精力/体力行
rep(U, 'U7 主将区精力/体力行',
"""    /* v89.129（老板「根据等级配备相称资质和等级的将领」）：**相称建议**行 ——
       纯按目标等级给"宜派"的档位（守将实情请侦查；软提示、非门槛）。
       目标切换时整窗重绘（目标下拉 change → openExpModal），本行随 t 重建。 */
    var rec129 = GAME.recGenOf(t);
    if (rec129) {
      html += '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin:4px 0 0;">'
        + '相称建议：宜 <b>' + U.escape(rec129.text) + '</b> 带队</div>';
    }""",
"""    /* v89.198（老板 4）：「精力 · 体力」读数移入**主将栏**（选定主将后显示，随选将刷新）——
       原挂「可用道具」信息行（同批：锦囊数量备注退役）。内容由 ui.refreshExpItems 填。 */
    html += '<div class="exp-info exp-info-l" id="exp-gen-vital" style="margin:4px 0 0;"></div>';""",
    "id=\"exp-gen-vital\" style=\"margin:4px 0 0;\"></div>'")

# u8 主将区头注释
rep(U, 'U8 主将区头注释更新',
"""    /* ② 主将（左中）—— 主将缺省已在函数开头定好（v89.57）；
       v89.197（老板 3）：统一行（标题双写退役；备注=驻将说明与相称建议，均在下方照常显示）。 */""",
"""    /* ② 主将（左中）—— 主将缺省已在函数开头定好（v89.57）；
       v89.197（老板 3）：统一行（标题双写退役）；
       v89.198（老板 4/5）：备注=驻将说明 + **精力/体力读数**（相称建议移往目标区）。 */""",
    '备注=驻将说明 + **精力/体力读数**')

# u9 可用道具信息行退役
rep(U, 'U9 可用道具信息行退役',
"""    /* ⑨ 可用道具（v89.156 老板 2：「上方的可用菜单放在左边，做个下拉框不要全列出」）——
       由右列顶部挪入左列 + 收成下拉框（不再全列 chips）；
       信息行（锦囊 · 精力 · 体力）保留 —— 它是出征决策的关键读数。 */
    html += '<div class="exp-sec exp-a-items">';
    html += ui.expRowHTML('可用道具',
      '<select id="exp-item-sel"><option value="">（选择道具）</option></select>' +
      '<span class="exp-tac-link" id="exp-item-use" data-action="exp-use-item-pick" title="使用所选道具（作用于当前主将）">使用</span>',
      null);
    html += '<div class="exp-info exp-info-l" id="exp-items" style="margin-bottom:0;"></div>';
    html += '</div>';""",
"""    /* ⑨ 可用道具（v89.156 老板 2：左列 + 下拉框）；v89.198（老板 6）：信息行退役 ——
       锦囊数量备注不显示；精力/体力读数移入主将栏（#exp-gen-vital）。 */
    html += '<div class="exp-sec exp-a-items">';
    html += ui.expRowHTML('可用道具',
      '<select id="exp-item-sel"><option value="">（选择道具）</option></select>' +
      '<span class="exp-tac-link" id="exp-item-use" data-action="exp-use-item-pick" title="使用所选道具（作用于当前主将）">使用</span>',
      null);
    html += '</div>';""",
    '锦囊数量备注不显示')

# u10 refreshExpItems 改写
rep(U, 'U10 refreshExpItems 改写',
"""  /* v89.52：出征面板的「可用道具」实时条 —— 锦囊存量 + 主将精力/体力 + 背包里的体力丹一键服用。
     只读展示资源；体力丹提供「用」按钮，直接作用于所选主将，且不关闭出征面板。 */
  ui.refreshExpItems = function () {
    /* v89.156（老板 2）：「可用道具」由右列顶部挪入左列，且**收成下拉框**（不再全列 chips）——
       · select：列出可对主将使用的道具（体力丹类）×数量；数量为 0 的不出现；
       · 信息行：锦囊 / 精力 / 体力（出征决策的关键读数，保留）。 */
    var box = document.getElementById('exp-items');
    var sel = document.getElementById('exp-item-sel');
    if (!box && !sel) return;
    var s = GAME.state;
    var genEl = document.getElementById('exp-gen');
    var gid = (genEl && genEl.value) || ui._expGen || '';
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === gid) gen = g; });
    var jinang = (s.items && s.items.jinang) || 0;
    var parts = ['<b>锦囊</b> ×' + jinang];
    if (gen) {
      parts.push('<b>精力</b> ' + Math.round(gen.energy || 0));
      parts.push('<b>体力</b> ' + Math.round(GAME.staNow(gen)) + '/' + Math.round(GAME.staMax(gen)));
    }
    if (box) box.innerHTML = parts.join('　·　');
    if (sel) {""",
"""  /* v89.52：出征面板的「可用道具」实时条；v89.198（老板 4/6）修订 ——
     · 「锦囊 ×N」数量备注**退役**（老板 6）；
     · 「精力 / 体力」读数**移入主将栏**（#exp-gen-vital，选定主将后显示，老板 4）；
     本函数只管两件事：主将读数行 + 可对主将使用的道具下拉。 */
  ui.refreshExpItems = function () {
    var vital = document.getElementById('exp-gen-vital');
    var sel = document.getElementById('exp-item-sel');
    if (!vital && !sel) return;
    var s = GAME.state;
    var genEl = document.getElementById('exp-gen');
    var gid = (genEl && genEl.value) || ui._expGen || '';
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === gid) gen = g; });
    if (vital) {
      vital.innerHTML = gen
        ? ('<b>精力</b> ' + Math.round(gen.energy || 0) + '　·　<b>体力</b> '
          + Math.round(GAME.staNow(gen)) + '/' + Math.round(GAME.staMax(gen)))
        : '';
    }
    if (sel) {""",
    '本函数只管两件事：主将读数行 + 可对主将使用的道具下拉')

# u11 expDefModsOf 改写
rep(U, 'U11 expDefModsOf 改写（只读计略）',
"""  /* ============================================================
   * v89.197（老板 1）：「战法好像没发挥过作用」——军师估算不读战法/计略，
   *   选了围困守军数字纹丝不动（探针实证：实战效果真实，是**估算没接**）。
   * 本出口 = 战法/计略对守军侧的修正（估算用）——**与结算读同一张表**
   *   （battle._settleBattle 的 scArmy/scVal 修正逐项对应）：
   *   · 围困 → DATA.SIEGE.encircle.garrisonCut 对守军与城防各折一次；
   *   · 计略妖言/火烧 按 scheme.eff；奇袭再乘 DATA.SIEGE.surprise.schemeMul。
   * 返回 { garrisonMul, wallMul, notes: [...] }（notes 供界面"已计入"提示）。
   * ⚠ 字段名用 wallMul（城防）不用 defMul —— defMul 是 v89.179 撤除的克制体系旧名，
   *   smoke §179① 的负向断言按它扫（禁复活），本出口避让命名。
   * ============================================================ */
  ui.expDefModsOf = function () {
    var out = { garrisonMul: 1, wallMul: 1, notes: [] };
    var S = DATA.SIEGE || {};
    var ops = GAME.opsIdOf(ui._expOps);
    if (ops === 'encircle' && S.encircle) {
      var cut = (S.encircle.garrisonCut == null ? 0.12 : S.encircle.garrisonCut);
      out.garrisonMul *= (1 - cut);
      out.wallMul *= (1 - cut);
      out.notes.push('围困 −' + Math.round(cut * 100) + '%');
    }
    if (ui._expScheme && GAME.schemeOf) {
      var sc = GAME.schemeOf(ui._expScheme);
      var mul = (ops === 'surprise')
        ? ((S.surprise || {}).schemeMul == null ? 1.5 : S.surprise.schemeMul) : 1;
      if (sc && sc.eff) {
        if (sc.eff.guardPct) {
          out.garrisonMul *= (1 + sc.eff.guardPct * mul);
          out.notes.push(sc.name + ' −' + Math.round(-sc.eff.guardPct * mul * 100) + '%');
        }
        if (sc.eff.defCut) {
          out.wallMul *= (1 - Math.min(0.9, sc.eff.defCut * mul));
          out.notes.push(sc.name + ' 城防 −' + Math.round(Math.min(0.9, sc.eff.defCut * mul) * 100) + '%');
        }
      }
    }
    return out;
  };""",
"""  /* ============================================================
   * v89.197（老板 1）建立；v89.198（老板「清除战法这个玩法」）修订 ——
   * 本出口 = **计略**对守军侧的修正（估算用）——与结算读同一口径
   *   （battle._settleBattle 的 scArmy/scVal 修正逐项对应；战法分支已随玩法全撤退役）。
   * 返回 { garrisonMul, wallMul, notes: [...] }（notes 供界面"已计入"提示）。
   * ⚠ 字段名用 wallMul（城防）不用 defMul —— defMul 是 v89.179 撤除的克制体系旧名，
   *   smoke §179① 的负向断言按它扫（禁复活），本出口避让命名。
   * ============================================================ */
  ui.expDefModsOf = function () {
    var out = { garrisonMul: 1, wallMul: 1, notes: [] };
    if (ui._expScheme && GAME.schemeOf) {
      var sc = GAME.schemeOf(ui._expScheme);
      if (sc && sc.eff) {
        if (sc.eff.guardPct) {
          out.garrisonMul *= (1 + sc.eff.guardPct);
          out.notes.push(sc.name + ' −' + Math.round(-sc.eff.guardPct * 100) + '%');
        }
        if (sc.eff.defCut) {
          out.wallMul *= (1 - Math.min(0.9, sc.eff.defCut));
          out.notes.push(sc.name + ' 城防 −' + Math.round(Math.min(0.9, sc.eff.defCut) * 100) + '%');
        }
      }
    }
    return out;
  };""",
    '本出口 = **计略**对守军侧的修正')

# u17 估算消费点注释同步
rep(U, 'U17 估算消费点注释同步',
"""      /* v89.197（老板 1）：**战法/计略修正计入估算**（与结算同一张表）——
         病根：估算不读战法 → 选围困后守军数字原样不动 → "战法好像没发挥作用"的体感来源。 */
      var _mods197 = ui.expDefModsOf();""",
"""      /* v89.197（老板 1）建立；v89.198（战法全撤）：**计略修正计入估算**（与结算同一口径）。 */
      var _mods197 = ui.expDefModsOf();""",
    '**计略修正计入估算**（与结算同一口径）')

# u12 提示行改文案
rep(U, 'U12 估算提示行改「计略已计入」',
"""            /* v89.197（老板 1）：战法/计略生效提示 —— "估算是把战法算进去的"要说给玩家看 */
            + ((pw74.mods && pw74.mods.notes.length)
              ? '<br><span style="color:var(--green-ok);">⚔️ 战法/计略已计入：'
                + pw74.mods.notes.join(' · ') + '</span>' : '')""",
"""            /* v89.197（老板 1）建立；v89.198（战法全撤）：只提示**计略**计入 */
            + ((pw74.mods && pw74.mods.notes.length)
              ? '<br><span style="color:var(--green-ok);">⚔️ 计略已计入：'
                + pw74.mods.notes.join(' · ') + '</span>' : '')""",
    '⚔️ 计略已计入：')

# ============ ③ 管理弹窗统一行 ============
# u13 sel() 出口改造
rep(U, 'U13 弹窗 sel() 出口改造',
"""    /* 下拉行拼装（唯一出口 —— 每行同形，只这里写一次） */
    var sel = function (id, label, opts) {
      return '<div class="exp-sel"><label>' + label + '</label><select id="' + id + '">' +
        opts.map(function (o) {
          return '<option value="' + o.v + '"' + (o.on ? ' selected' : '') + '>' + o.label + '</option>';
        }).join('') + '</select></div>';
    };""",
"""    /* 下拉拼装（唯一出口 —— 每行同形，只这里写一次）。
       v89.198（老板 1）：改**统一行**（ui.expRowHTML：名称固定列 4.5em + 右边直接下拉框），
       与出征面板同一套规范；说明（desc / 校验口径 / 起点距离规则）一律进悬停。 */
    var sel = function (id, opts) {
      var inner = (typeof opts === 'string') ? opts : opts.map(function (o) {
        return '<option value="' + o.v + '"' + (o.on ? ' selected' : '') + '>' + o.label + '</option>';
      }).join('');
      return '<select id="' + id + '">' + inner + '</select>';
    };""",
    '改**统一行**（ui.expRowHTML：名称固定列 4.5em + 右边直接下拉框）')

# u14 左列统一行重建
rep(U, 'U14 弹窗左列统一行重建',
"""    var html = '<div class="gold-heading">⚔️ 自动出征 · 详细配置' +
      '<span style="font-weight:400;font-size:var(--fs-sub);color:var(--text-dim);">' +
      '（无人值守按下列策略循环出征）</span>' + ui.help(
        '与出征面板同源：兵力取法、出征方式、目标搜索都走同一套出口。\\n' +
        '自动出征特有的：出征频率 / 每日次数上限 / 搜索距离。\\n' +
        '计略在**每次出发时**校验，不通过则本次不用计并写明原因 —— 不会因为没锦囊就不动。') + '</div>' +
      '<div class="exp-grid">' +
        '<div class="exp-col-l">' +
          /* ① 执行将领 */
          /* v89.105：这条规则原占一整行（17px）—— 挂到分区标题的 ? 上 */
          '<div class="exp-sec"><div class="exp-sec-t">执行将领' +
            ui.help('只派空闲将领；出征中／守将／采集中一律跳过（现空闲 ' + idle.length + ' 位）') +
            '</div>' + sel('am-gen', '将领', genOpts) + '</div>' +
          /* ② 目标：类型 · 等级 · 距离 */
          '<div class="exp-sec"><div class="exp-sec-t">目标' +
            ui.help('以「' + (city ? GAME.cityLabel(city) : '—') + '」为起点，' + rad +
              ' 格内取最近目标（' + (cfg.target === 'city' ? '名城不在坐标里找，取最近一座' : '切比雪夫距离') + '）') +
            '</div>' + sel('am-target', '类型', tgtOpts) + sel('am-level', '等级', lvOpts) + sel('am-radius', '距离', radOpts) + '</div>' +
          /* ③ 2×2：出征方式 · 计略 ／ 出征战术 · 频率上限（与出征面板同款 .exp-quad） */
          '<div class="exp-quad">' +
            '<div class="exp-sec"><div class="exp-sec-t">出征方式</div>' + sel('am-mode', '方式', modeOpts) +
              '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
              U.escape(mode.desc || '') + '</div></div>' +
            '<div class="exp-sec"><div class="exp-sec-t">计略</div>' + sel('am-scheme', '计略', schemeOpts) +
              '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
              '出发时校验，不通过则本次不用计</div></div>' +
            /* 出征战术行**直接复用出征面板的选项出口**（expTacticOptionsHTML）——
               两处各写一份选项 = 两个出口，加一种战术就会漏一处。 */
            '<div class="exp-sec"><div class="exp-sec-t">出征战术</div>' +
              '<div class="exp-sel"><label>战术</label><select id="am-tactic">' + ui.expTacticOptionsHTML() + '</select></div>' +
              '<div class="exp-info exp-info-l" style="margin-bottom:0;">阵位 <b id="am-tac-sum">' +
              U.escape(GAME.tacticSummary()) + '</b>' +
              '<span class="exp-tac-link" data-action="open-tactic">逐兵种</span></div></div>' +
            '<div class="exp-sec"><div class="exp-sec-t">频率 · 上限</div>' +
              sel('am-freq', '频率', freqOpts) + sel('am-daily', '上限', dailyOpts) +
              '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">今日已出征 ' +
              (cfg.todayCount || 0) + ' 次' +
              (left === Infinity ? '（不限次数）' : '，尚可 ' + left + ' 次') + '</div></div>' +
          '</div>' +
          /* ④ 预估（与出征面板同源） */
          '<div class="exp-sec"><div class="exp-sec-t">预估</div>' + ui.amEstHTML(pv) + '</div>' +
        '</div>' +""",
"""    var html = '<div class="gold-heading">⚔️ 自动出征 · 详细配置' +
      '<span style="font-weight:400;font-size:var(--fs-sub);color:var(--text-dim);">' +
      '（无人值守按下列策略循环出征）</span>' + ui.help(
        '与出征面板同源：兵力取法、出征方式、目标搜索都走同一套出口。\\n' +
        '自动出征特有的：出征频率 / 每日次数上限 / 搜索距离。\\n' +
        '计略在**每次出发时**校验，不通过则本次不用计并写明原因 —— 不会因为没锦囊就不动。') + '</div>' +
      '<div class="exp-grid">' +
        '<div class="exp-col-l">' +
          /* ① 执行将领（v89.198：统一行 —— 名称列 + 右边直接下拉；规则说明进悬停） */
          '<div class="exp-sec">' +
            ui.expRowHTML('执行将领', sel('am-gen', genOpts),
              '只派空闲将领；出征中／守将／采集中一律跳过（现空闲 ' + idle.length + ' 位）') + '</div>' +
          /* ② 目标：类型 · 等级 · 距离（三行同一名称列宽） */
          '<div class="exp-sec">' +
            ui.expRowHTML('目标类型', sel('am-target', tgtOpts), null) +
            ui.expRowHTML('目标等级', sel('am-level', lvOpts), null) +
            ui.expRowHTML('搜索距离', sel('am-radius', radOpts),
              '以「' + U.escape(city ? GAME.cityLabel(city) : '—') + '」为起点，' + rad +
              ' 格内取最近目标（' + (cfg.target === 'city' ? '名城不在坐标里找，取最近一座' : '切比雪夫距离') + '）') +
          '</div>' +
          /* ③ 出征方式 · 计略 ／ 出征战术 · 频率上限（与出征面板同款 .exp-quad + 统一行） */
          '<div class="exp-quad">' +
            '<div class="exp-sec">' +
              ui.expRowHTML('出征方式', sel('am-mode', modeOpts), U.escape(mode.desc || '')) + '</div>' +
            '<div class="exp-sec">' +
              ui.expRowHTML('计略', sel('am-scheme', schemeOpts), '出发时校验，不通过则本次不用计') + '</div>' +
            /* 出征战术行**直接复用出征面板的选项出口**（expTacticOptionsHTML）——
               两处各写一份选项 = 两个出口，加一种战术就会漏一处。
               v89.198（老板 3）：阵位摘要/逐兵种链退役；补「设置」链与出征面板同构。 */
            '<div class="exp-sec">' +
              ui.expRowHTML('出征战术',
                sel('am-tactic', ui.expTacticOptionsHTML()) +
                '<span class="exp-tac-link" data-action="open-tactic-set">设置</span>', null) + '</div>' +
            '<div class="exp-sec">' +
              ui.expRowHTML('出征频率', sel('am-freq', freqOpts), null) +
              ui.expRowHTML('每日上限', sel('am-daily', dailyOpts), null) +
              '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">今日已出征 ' +
              (cfg.todayCount || 0) + ' 次' +
              (left === Infinity ? '（不限次数）' : '，尚可 ' + left + ' 次') + '</div></div>' +
          '</div>' +
          /* ④ 预估（与出征面板同源） */
          '<div class="exp-sec"><div class="exp-sec-t">预估</div>' + ui.amEstHTML(pv) + '</div>' +
        '</div>' +""",
    "ui.expRowHTML('执行将领', sel('am-gen', genOpts),")

# u15 编成表备注 markdown 修复
rep(U, 'U15 编成表备注 markdown 修复',
"""            U.fmt(have) + ' 兵；**逐兵种填数量**（0 = 不带），器械／斥候／辎重不编入</div></div>' +""",
"""            U.fmt(have) + ' 兵；<b>逐兵种填数量</b>（0 = 不带），器械／斥候／辎重不编入</div></div>' +""",
    '<b>逐兵种填数量</b>')

# u16 弹窗头注释补记
rep(U, 'U16 弹窗头注释补记',
"""       ④ 退役「城内留守」：它与「单次兵力」是同一件事的两种说法。
     「改完即生效」：下拉 change → 写 cfg → **就地重开本弹窗**，于是预估、可派兵、
     今日次数随之刷新（与出征面板同一套做法）。 */""",
"""       ④ 退役「城内留守」：它与「单次兵力」是同一件事的两种说法。
     「改完即生效」：下拉 change → 写 cfg → **就地重开本弹窗**，于是预估、可派兵、
     今日次数随之刷新（与出征面板同一套做法）。
     v89.198（老板 1）：「管理弹窗」统一行改造 —— 名称固定列 + 右边直接下拉框（双写退役）、
     说明进悬停、出征战术行与出征面板同构（含「设置」链）；阵位摘要行随老板 3 退役。 */""",
    'v89.198（老板 1）：「管理弹窗」统一行改造')

print('批次C 完成')
