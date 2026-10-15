# -*- coding: utf-8 -*-
"""v89.218 · 故事系统退役（产品代码）

老板令：「故事全部去除，不再保留史册，故事集」。
本脚本 = 产品侧退役（js/ + index.html + data.js）：
  · state.js：GAME.SG 引擎块 / chronicle·eraHistory 模板字段 / metaOf 纪事字段 /
    recordOffline 调用 / _offline 读写 / onActionDone 调用 ×4 / msgKindOf 词表
  · ui.js：storyHTML / storiesHTML / 阅读器块（SG_KIND..sgClose）/ 徽标 /
    renderView 分支 ×2 / PANEL_TITLE / sgTryTrigger ×2 / 帮助文案
  · main.js：story-* 动作 5 个 / sgTryAct ×8 / sgTryTrigger ×3 / onActionDone /
    Shift 续号收窄为 1~3
  · index.html：84 个 story/vol 脚本标签 / 两个导航页签 / 四段 story 专属 CSS
  · data.js：CHRONICLE_RULES / TITLES 退役 + ENCOUNTERS 文案荒原化
"""
import io, re

R = 'E:/Deepseekdb/'


def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)


def rep(s, old, new, tag, expect=None):
    c = s.count(old)
    if c == 0:
        print('  [MISS] %s' % tag)
        return s
    if expect is not None and c != expect:
        raise SystemExit('❌ %s: count=%d expect=%d' % (tag, c, expect))
    print('  [ok] %s x%d' % (tag, c))
    return s.replace(old, new)


# ════════════════════════════════════════════════════════════
# ① js/state.js
# ════════════════════════════════════════════════════════════
p = R + 'js/state.js'
s = rd(p)

# ①-1 模板字段（chronicle / chronicleDone / eraHistory）
s = rep(s,
        "      /* 叙事层（story.js）：世界历法 / 史书纪事 / 年号纪元 */\n"
        "      world: null,                              // 由 GAME.story.init() 填充\n"
        "      chronicle: [],                            // 史册条目\n"
        "      chronicleDone: {},                        // 已记录过的里程碑 id\n"
        "      eraHistory: [],                           // 已完成的时代之志\n",
        "      /* 叙事层（story.js）：世界历法 / 年号纪元\n"
        "         ⛔ v89.218：chronicle / chronicleDone / eraHistory 三字段随史册退役\n"
        "         （老档残留不再读取，随下次存档自然消失）。 */\n"
        "      world: null,                              // 由 GAME.story.init() 填充\n",
        'state-模板字段')

# ①-2 metaOf：去纪事读取与两字段
s = rep(s,
        "    var we = (DATA.WEATHERS || {})[w.weather || 'clear'] || { name: '晴', icon: '☀' };\n"
        "    var chron = st.chronicle || [];\n"
        "    var last = chron[chron.length - 1];\n"
        "    return {",
        "    var we = (DATA.WEATHERS || {})[w.weather || 'clear'] || { name: '晴', icon: '☀' };\n"
        "    return {",
        'state-metaOf读')
s = rep(s,
        "      savedAt: st.savedAt || U.now(),\n"
        "      lastText: last ? last.text : '',\n"
        "      chronicleCount: chron.length,\n"
        "    };",
        "      savedAt: st.savedAt || U.now(),\n"
        "    };",
        'state-metaOf字段')

# ①-3 离线注释 + _offline 读写 + recordOffline 调用
s = rep(s,
        "   * 记账抑制：补算期间不逐年逐季记账；结束后由 story.recordOffline 统一记一条。\n",
        "   * ⛔ v89.218：史书纪事退役（纪事抑制与归来记账调用一并撤除）。\n",
        'state-离线注释')
s = rep(s,
        "       标签节流）复用本函数的全部推进逻辑（队列/资源/历法/行军），但\n"
        "       **不记编年史、不生成归来报告、不设 _offlineSec** —— 那些是\"读档归来\"\n"
        "       的语义，在线补偿不该打扰（每 60 秒的节流周期都记一条\"离城\"显然不对）。\n"
        "       silent 只静默\"记录类\"；真结算一律保留（settleDailyYield / march.rushAll）。 */",
        "       标签节流）复用本函数的全部推进逻辑（队列/资源/历法/行军），但\n"
        "       **不设 _offlineSec** —— 那是\"读档归来\"的语义（v89.207 起归来报告在\n"
        "       两种模式下都归集、按 via 分流标题；见下方「归集归来报告」）。\n"
        "       silent 只静默\"记录类\"；真结算一律保留（settleDailyYield / march.rushAll）。 */",
        'state-静默注释')
s = rep(s, "    GAME._offline = true;\n", "", 'state-_offline置位', expect=1)
s = rep(s, "    GAME._offline = false;\n", "", 'state-_offline清位', expect=1)
s = rep(s,
        "    if (GAME.story && GAME.story.recordOffline && !_silent193) GAME.story.recordOffline(secReal);\n",
        "", 'state-recordOffline调用')

# ①-4 onActionDone 调用 ×4
s = rep(s, "      if (GAME.onActionDone) GAME.onActionDone('build-done', { id: q.buildId, type: q.type });\n", "", 'state-oAD-1')
s = rep(s, "    if (GAME.onActionDone) GAME.onActionDone('build-done', { id: q.buildId, type: q.type });\n", "", 'state-oAD-2')
s = rep(s, "    if (GAME.onActionDone) GAME.onActionDone('train-done', { troopId: t.troopId, count: t.count });\n", "", 'state-oAD-3')
s = rep(s, "    if (GAME.onActionDone) GAME.onActionDone('tech-done', { techId: tq.techId, cityId: _ct191 ? _ct191.id : null });\n", "", 'state-oAD-4')

# ①-5 msgKindOf 词表（史册退休）
s = rep(s, "(/任务|史册|改元/.test(m) ? 'task' : 'sys')", "(/任务|改元/.test(m) ? 'task' : 'sys')", 'state-msgKind词表')

# ①-6 GAME.SG 引擎块 → 墓碑
i0 = s.index("  /* ============================================================\n"
             "   * 文字游戏 · 故事库引擎（内容层在 story/vol-*.js）")
j = s.rindex('})();')
TOMB = (
    "  /* ============================================================\n"
    "   * ⛔ v89.218（老板）：「故事全部去除，不再保留史册，故事集」——\n"
    "   * 故事库引擎（GAME.SG：清单 / 待阅 / 掷骰 / 动作触发 / 结算）整条退役；\n"
    "   * 内容层 story/（84 卷）已删，阅读器与「史册 / 故事集」两视图在 ui.js 同步移除。\n"
    "   * 老档残留：s.sgPending / s.sgArchived / s.stories 不再被读取（无消费者，\n"
    "   * 随下次存档自然消失）—— 不做迁移。\n"
    "   * ============================================================ */\n"
)
s = s[:i0] + TOMB + s[j:]
wr(p, s)
print('✅ state.js 完成')

# ════════════════════════════════════════════════════════════
# ② js/ui.js
# ════════════════════════════════════════════════════════════
p = R + 'js/ui.js'
s = rd(p)

# ②-1 顶栏徽标块
s = rep(s,
        "    /* v89.86（整改 P-06）：待阅逸闻 —— 顶栏「史册」徽标（触发的逸闻不再全屏弹出） */\n"
        "    var elS = $('#tab-badge-story');\n"
        "    if (elS) {\n"
        "      var ns = (GAME.SG && GAME.SG.pending) ? GAME.SG.pending().length : 0;\n"
        "      elS.textContent = ns > 99 ? '99+' : ns;\n"
        "      elS.classList.toggle('hidden', ns <= 0);\n"
        "    }\n",
        "    /* ⛔ v89.218：待阅逸闻徽标（tab-badge-story）随故事系统退役。 */\n",
        'ui-徽标')

# ②-2 PANEL_TITLE
s = rep(s, "    rank: '🏅 威望', story: '📖 史册', ext: '🌾 城外',",
        "    rank: '🏅 威望', ext: '🌾 城外',", 'ui-PANEL_TITLE')

# ②-3 renderView 分支（弹窗式）
s = rep(s, "    else if (view === 'story') body = ui.storyHTML();\n", "", 'ui-分支-弹窗')
s = rep(s, "       ext（城外施工总览）。纯静态子视图（equip / rank / story）不接，省每秒重建。 */",
        "       ext（城外施工总览）。纯静态子视图（equip / rank）不接，省每秒重建。 */", 'ui-注释-live')

# ②-4 storyHTML + storiesHTML 块
i0 = s.index("  /* ================= 史册（天时 / 年号 / 编年史 / 战力折算） ================= */")
i1 = s.index("  /* ================= 酒馆：招募（v89.188：统一话术） ================= */")
TOMB2 = (
    "  /* ⛔ v89.218（老板）：「不再保留史册，故事集」——\n"
    "     ui.storyHTML（史册：天时/时代之志/实力折算/当前评定 + 待阅逸闻）与\n"
    "     ui.storiesHTML（故事集：收集与回看）两视图整条退役；顶栏页签一并移除。\n"
    "     天时/年号仍在顶栏天时行（story.skyLine）与公文播报中可见。 */\n\n"
)
s = s[:i0] + TOMB2 + s[i1:]

# ②-5 renderView 分支（整页视图）
s = rep(s,
        "    else if (v === 'story') box.innerHTML = ui.storyHTML();\n"
        "    /* v89.104（老板）：故事集独立成页（与史册/待阅逸闻并列） */\n"
        "    else if (v === 'stories') box.innerHTML = ui.storiesHTML();\n",
        "", 'ui-分支-整页')

# ②-6 帮助文案（键盘续号）
s = rep(s,
        "<b>Shift+1-5</b> 续号（史册 / 故事集 / 公文 / 自动 / 设置）",
        "<b>Shift+1-3</b> 续号（公文 / 自动 / 设置）", 'ui-键盘帮助')

# ②-7 阅读器块（SG_KIND ... sgClose）→ 墓碑
i0 = s.index("  /* ============================================================\n"
             "   * Text game reader (content layer: story/vol-*.js; engine: GAME.SG)")
j = s.rindex('})();')
TOMB3 = (
    "  /* ⛔ v89.218（老板）：「故事全部去除」——\n"
    "     文字游戏阅读器（#story-fx / SG_KIND / SG_MURAL / openStory / sgDefer /\n"
    "     sgTryTrigger / sgTryAct / sgPendingHTML / sgReadPending / sgDropPending /\n"
    "     sgRender / sgHTML / sgPick / sgClose）整条退役；内容层 story/ 已删。 */\n"
)
s = s[:i0] + TOMB3 + s[j:]

# ②-8 sgTryTrigger 调用与注释 ×2
s = rep(s,
        "        /* v89.29（入口改版）：逸闻不再挂列表块 —— 开面板时由 ui.sgTryTrigger 掷骰，\n"
        "           命中随机抽一篇完整故事直接在面板之上开卷（见本函数尾部）。 */\n",
        "", 'ui-sg注释-1')
s = rep(s, "      ui.sgTryTrigger('building', b.id);   /* v89.29 · 概率奇遇 */\n", "", 'ui-sg调用-1')
s = rep(s, "        /* v89.29（入口改版）：逸闻不再挂列表块 —— 开面板时由 ui.sgTryTrigger 掷骰（见本函数尾部）。 */\n",
        "", 'ui-sg注释-2')
s = rep(s, "      ui.sgTryTrigger('ext', e.type);   /* v89.29 · 概率奇遇 */\n", "", 'ui-sg调用-2')

wr(p, s)
print('✅ ui.js 完成')

# ════════════════════════════════════════════════════════════
# ③ js/main.js
# ════════════════════════════════════════════════════════════
p = R + 'js/main.js'
s = rd(p)

s = rep(s,
        "      /* 文字游戏（story/）：清单 / 开卷 / 选择 / 收起 */\n"
        "      case 'story-pick': ui.sgPick(Number(el.dataset.i)); break;\n"
        "      /* v89.86（整改 P-06）：待阅逸闻 —— 阅读（移出并开卷）/ 忽略 */\n"
        "      case 'story-read': ui.sgReadPending(el.dataset.sid); break;\n"
        "      /* v89.89（C4）：故事集 → 已读重读（不经待阅） */\n"
        "      case 'story-read-at': ui.openStory(el.dataset.sid, false); break;\n"
        "      case 'story-drop': ui.sgDropPending(el.dataset.sid); break;\n"
        "      case 'story-exit': ui.sgClose(); break;\n",
        "      /* ⛔ v89.218：故事相关动作（story-pick / story-read / story-read-at /\n"
        "         story-drop / story-exit）随故事系统退役。 */\n",
        'main-动作')

s = rep(s, "          ui.openNewCityNotice(r.city);\n          ui.sgTryAct('build-city');\n",
        "          ui.openNewCityNotice(r.city);\n", 'main-act-buildcity')
s = rep(s, "      GAME.refreshAll();\n      ui.sgTryAct('move-city');   /* v89.31 · 动作触发 */\n",
        "      GAME.refreshAll();\n", 'main-act-movecity')
s = rep(s, "    if (r.ok) { ui.openInn(); GAME.refreshAll(); ui.sgTryAct('recruit-hero', { cid: cid }); }   /* v89.31 */",
        "    if (r.ok) { ui.openInn(); GAME.refreshAll(); }", 'main-act-recruit')
s = rep(s, "    if (r.ok) { ui.openMarket(); GAME.refreshAll(); ui.sgTryAct('market-trade'); }\n",
        "    if (r.ok) { ui.openMarket(); GAME.refreshAll(); }\n", 'main-act-market', expect=2)
s = rep(s, "    if (r.ok) ui.sgTryAct('gather-done', { terrain: _rec31 ? _rec31.type : null });\n",
        "", 'main-act-gather')
s = rep(s, "    if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); ui.sgTryAct('promote'); }   /* v89.31 */",
        "    if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); }", 'main-act-promote')
s = rep(s, "    if (k === 'marches') ui.openMarches();\n    ui.sgTryAct('heal-wounded');   /* v89.31 · 动作触发 */\n",
        "    if (k === 'marches') ui.openMarches();\n", 'main-act-heal')

s = rep(s,
        "    /* v89.31 · 战事奇遇：胜 / 败 / 占城 / 据地 之后，从「相关建筑」池里偶遇一篇逸闻。\n"
        "       v89.63：「派遣」到已属我方的野地是**不接战**的（r.peaceful），没有战事，不该触发战事逸闻。 */\n"
        "    if (r.result && r.result.winner && r.result.winner !== 'scout' && !r.peaceful && GAME.SG && ui.sgTryAct) {\n"
        "      var _t31 = r.target || {};\n"
        "      var _m31 = GAME.battle.modeOf(r.mode) || {};\n"
        "      var _win31 = r.result.winner === 'atk';\n"
        "      if (_win31 && _m31.occupy && _t31.kind === 'city') {\n"
        "        ui.sgTryAct('occupy-city', { type: _t31.cityType || 'county' });\n"
        "      } else if (_win31 && _m31.occupy && _t31.kind === 'wild') {\n"
        "        ui.sgTryAct('occupy-wild', { terrain: _t31.terrain || 'hill' });\n"
        "      } else {\n"
        "        ui.sgTryAct(_win31 ? 'battle-win' : 'battle-lose');\n"
        "      }\n"
        "    }\n"
        "    /* 攻占新城 / 战斗结果都在战报里；逸闻触发单独在上一条处理 */\n",
        "    /* ⛔ v89.218：战事逸闻触发随故事系统退役（攻占新城 / 战斗结果都在战报里）。 */\n",
        'main-战事逸闻块')

s = rep(s,
        "  /* v89.31 · 引擎侧动作完成桥（营造 / 训练 / 研习在 tick 内结算）→ 逸闻动作触发 */\n"
        "  GAME.onActionDone = function (key, ctx) {\n"
        "    if (ui.sgTryAct) ui.sgTryAct(key, ctx);\n"
        "  };\n",
        "  /* ⛔ v89.218：引擎侧动作完成桥（onActionDone → 逸闻动作触发）随故事系统退役。 */\n",
        'main-onActionDone')

s = rep(s,
        "          ui.openCityPanel(hit.city);\n"
        "          /* v89.29：概率奇遇 —— 点城池掷骰（命中随机抽一篇，悬于面板之上） */\n"
        "          ui.sgTryTrigger('city', hit.city.type);\n",
        "          ui.openCityPanel(hit.city);\n", 'main-trigger-city')
s = rep(s,
        "          ui.openLandModal(hit.x, hit.y);\n"
        "          /* v89.29：概率奇遇 —— 点地块掷骰（命中随机抽一篇，悬于面板之上） */\n"
        "          var _t89a = G.tile(hit.x, hit.y);\n"
        "          ui.sgTryTrigger('wild', _t89a && _t89a.terrain);\n"
        "        } else {\n"
        "          ui.openLandModal(hit.x, hit.y);\n"
        "          var _t89b = G.tile(hit.x, hit.y);\n"
        "          ui.sgTryTrigger('wild', _t89b && _t89b.terrain);\n"
        "        }\n",
        "          ui.openLandModal(hit.x, hit.y);\n"
        "        } else {\n"
        "          ui.openLandModal(hit.x, hit.y);\n"
        "        }\n",
        'main-trigger-wild')

s = rep(s,
        "      /* v89.210（规划一 · 老板「按建议执行」）：Shift+1~5 → 第 10~14 个页签\n"
        "         （史册 / 故事集 / 公文 / 自动 / 设置）—— 1-9 不动，纯续号、零记忆成本。\n"
        "         判定用 e.code（布局无关）：Shift 下 e.key 会变 !@#$%，不能按字符判。 */\n"
        "      if (e.shiftKey && /^Digit([1-5])$/.test(e.code || '')) {\n"
        "        var _vi210 = ['story', 'stories', 'reports', 'auto', 'settings'];\n",
        "      /* v89.210（规划一 · 老板「按建议执行」）：Shift+1~3 → 第 10~12 个页签\n"
        "         （公文 / 自动 / 设置）—— 1-9 不动，纯续号、零记忆成本。\n"
        "         v89.218：史册 / 故事集退役，续号由 5 收窄为 3。\n"
        "         判定用 e.code（布局无关）：Shift 下 e.key 会变 !@#$%，不能按字符判。 */\n"
        "      if (e.shiftKey && /^Digit([1-3])$/.test(e.code || '')) {\n"
        "        var _vi210 = ['reports', 'auto', 'settings'];\n",
        'main-Shift续号')

wr(p, s)
print('✅ main.js 完成')

# ════════════════════════════════════════════════════════════
# ④ index.html
# ════════════════════════════════════════════════════════════
p = R + 'index.html'
s = rd(p)

# ④-1 story/vol 脚本标签
i0 = s.index('<!-- 文字游戏故事库（story/）：数据追加到 window.STORY_DATA；卷文件按需增补 -->')
locs = re.search(r'<script src="story/vol-84\.js\?v=8989"></script>\n', s)
i1 = locs.end()
s = s[:i0] + '<!-- ⛔ v89.218（老板「故事全部去除」）：84 卷故事库（story/）整目录删除，脚本标签同步撤除。 -->\n' + s[i1:]

# ④-2 导航页签（史册 + 故事集）
s = rep(s,
        '    <div class="tab" data-view="story"><i class="ti" data-nav="story"></i>史册<span class="tab-badge hidden" id="tab-badge-story"></span></div>\n'
        '    <!-- v89.104（老板）：「故事集做成另一个单独界面与待阅逸闻这个界面并列」 -->\n'
        '    <div class="tab" data-view="stories"><i class="ti" data-nav="story"></i>故事集</div>\n',
        '    <!-- ⛔ v89.218（老板「不再保留史册，故事集」）：两个页签整条退役。 -->\n',
        'html-导航页签')

# ④-3 CSS：史册面板块（保留 .story-card / .prog，退役 story-grid / sky-* / goal-line / hint / chron-*）
s = rep(s, "  /* ============ 史册面板 ============ */",
        "  /* ============ 卡片式面板（.story-card / .prog 为多页共用件；史册专属件已于 v89.218 退役） ============ */",
        'css-块注释')
s = rep(s, "  .story-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); margin-bottom: var(--sp-4); }\n", "", 'css-story-grid')
s = rep(s, "  .sky-big { font-size: var(--fs-h1); font-weight: 800; color: var(--gold-light); text-align: center; letter-spacing: 1px; margin: var(--sp-2) 0 var(--sp-1); }\n", "", 'css-sky-big')
s = rep(s, "  .sky-sub { font-size: var(--fs-sub); color: var(--text-dim); text-align: center; line-height: var(--lh-body); }\n", "", 'css-sky-sub')
s = rep(s, "  .sky-boon { font-size: var(--fs-sub); color: var(--green-ok); text-align: center; margin-top: var(--sp-2); padding-top: var(--sp-2); border-top: 1px dashed var(--sep-gold); }\n", "", 'css-sky-boon')
s = rep(s, "  .goal-line { display: flex; justify-content: space-between; align-items: baseline; font-size: var(--fs-lead); margin: var(--sp-2) 0; }\n", "", 'css-goal-line')
s = rep(s, "  .goal-line .good { color: var(--green-ok); font-weight: 700; }\n", "", 'css-goal-good')
s = rep(s, "  .hint { font-size: var(--fs-sub); color: var(--text-dim); margin-top: var(--sp-2); line-height: var(--lh-body); }\n", "", 'css-hint')
i0 = s.index("  .chron-list { max-height: 420px; overflow-y: auto; padding-right: var(--sp-1); }")
i1 = s.index("  /* ============ 酒馆 / 市集 / 仓储 / 招募站 ============ */")
s = s[:i0] + "  /* ⛔ v89.218：纪事条目样式（.chron-list / .chron-item 七行）随史册退役 —— 早在 v89.104 已无消费点。 */\n" + s[i1:]

# ④-4 CSS：待阅逸闻 6×5 网格
i0 = s.index("   * v89.104（老板）：待阅逸闻 4×5 网格 + 军务页签 + 显示比例滑块")
i1 = s.index("  .march-tabs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-4); flex-wrap: wrap; }")
s = s[:i0] + ("   * ⛔ v89.218：待阅逸闻 6×5 网格（.sg-grid / .sg-cell 系列）随史册退役\n"
              "   * ============================================================ */\n") + s[i1:]

# ④-5 CSS：故事集行（.sg-row 系列）
i0 = s.index("  /* v89.89（C4）：故事集（已读回看 + 收集进度） */")
i1 = s.index("  /* v89.89（E3）：募兵面板人口三段条 */")
s = s[:i0] + "  /* ⛔ v89.218：故事集行样式（.sg-row 系列 8 行）随故事集视图退役。 */\n" + s[i1:]

# ④-6 CSS：阅读器块
i0 = s.index("  /* ================= 文字游戏 · 阅读器（story/） =================")
i1 = s.index("  /* ============================================================\n   * 战场界面（v89.87 · 老板需求 4）：实时观战 + 逐回合指挥")
s = s[:i0] + ("  /* ⛔ v89.218（老板「故事全部去除」）：#story-fx 阅读器样式（.sgr-* 全族）退役 ——\n"
              "     阅读器与内容层 story/ 一并删除。 */\n") + s[i1:]

wr(p, s)
print('✅ index.html 完成')

# ════════════════════════════════════════════════════════════
# ⑤ js/data.js（CHRONICLE_RULES / TITLES 退役 + ENCOUNTERS 荒原化）
# ════════════════════════════════════════════════════════════
p = R + 'js/data.js'
s = rd(p)

i0 = s.index('  DATA.CHRONICLE_RULES = [')
i1 = s.index('  ];', i0) + len('  ];\n')
s = s[:i0] + ("  /* ⛔ v89.218（老板「故事全部去除，不再保留史册」）退役：史册纪事规则表（19 条\n"
              "     里程碑 / 逐年快照文案）。写入点（story.js 纪事记账）与读取点（史册页）均已移除。 */\n") + s[i1:]

i0 = s.index('  DATA.TITLES = [')
i1 = s.index('  ];', i0) + len('  ];\n')
s = s[:i0] + ("  /* ⛔ v89.218 退役：称号评定表（evaluateTitle 与「史册 · 当前评定」卡片一并撤除）。 */\n") + s[i1:]

# ENCOUNTERS 荒原化（旧世界残迹口径）
ENC = [
    ("      text: '侦察兵回报：荒野之中有古垒残垣，为前朝屯兵之所，地下或有余粮。',",
     "      text: '侦察兵回报：荒野之中有旧垒残垣，为旧军屯兵之所，地下或有余粮。',"),
    ("      text: '道旁有荒祠，塑像剥落，不知其所祀。案上残香犹温。',",
     "      text: '道旁有旧世神龛，塑像剥落，不知其所供。案上残烛犹温。',"),
    ("{ id: 'tomb_mid', tier: 'tomb', name: '古冢', weight: 30,",
     "{ id: 'tomb_mid', tier: 'tomb', name: '旧堡地窖', weight: 30,"),
    ("      text: '掘得一古冢，砖石皆汉制，墓门刻云气纹。内无棺椁，唯见兵甲图书。',",
     "      text: '掘开一处塌陷的旧世掩体，水泥顶板满是裂纹。内无遗骸，唯见兵甲与旧图册。',"),
    ("{ id: 'tomb_jiang', tier: 'tomb', name: '将军墓', weight: 22,",
     "{ id: 'tomb_jiang', tier: 'tomb', name: '旧军墓', weight: 22,"),
    ("      text: '土人言此地昔为战没将军之葬所。掘之，得断戟一柄，锈迹斑斓，犹可辨认铭文。',",
     "      text: '当地人说，此地埋着旧军一名指挥官。掘开，得断刃一柄，锈迹斑斓，犹可辨认铭文。',"),
    ("{ id: 'tomb_book', tier: 'tomb', name: '故府藏书', weight: 20,",
     "{ id: 'tomb_book', tier: 'tomb', name: '旧馆残档', weight: 20,"),
    ("      text: '有故府倾圮，梁木之下得竹简数束，虽朽蠹过半，尚可辨读。',",
     "      text: '有旧世档案楼倾圮，梁木之下得档案数束，虽朽蠹过半，尚可辨读。',"),
    ("{ id: 'secret_horse', tier: 'secret', name: '龙种', weight: 6,",
     "{ id: 'secret_horse', tier: 'secret', name: '野马王', weight: 6,"),
    ("      text: '深山溪畔，有马独立，色如渥丹，见人不惊。土人云：此龙种也，百年一出。',",
     "      text: '深山溪畔，有一匹野马独立，毛色如焰，见人不惊。当地人称它马王，多年无人驯服。',"),
    ("      text: '林中有草庐，庐中人自云避乱于此二十年。与之语，于兵法政理无所不通。闻我将兴，愿出而佐之。',",
     "      text: '林中有孤屋，屋中人自云避世二十年。与之语，于战理机务无所不通。闻我将兴，愿出而佐之。',"),
    ("      text: '山涧之底，青气冲霄。掘之三尺，得一剑，削铁如泥，铭曰「孟德」。',",
     "      text: '山涧之底，青气冲霄。掘之三尺，得一刃，削铁如泥，铭文犹存。',"),
]
for old, new in ENC:
    s = rep(s, old, new, 'enc:' + old[:34])

wr(p, s)
print('✅ data.js 完成')

print('\n产品侧退役完成。')
