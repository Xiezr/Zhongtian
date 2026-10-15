# -*- coding: utf-8 -*-
"""v89.224b2：ui/domain/systems/main/state/battle/index 结构补丁（实验室迁移 + 去播种化）。"""
import io, os

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
LOG = []

def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224b2'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)

def rep(f, old, new, cnt=1):
    s = rd(f)
    c = s.count(old)
    assert c == cnt, '[%s] 锚点计数 %d != %d :: %r' % (f, c, cnt, old[:80])
    wr(f, s.replace(old, new))
    LOG.append('%s ×%d :: %s' % (f, cnt, old[:46].replace('\n', '⏎')))

def span(f, start, end, new, must=None):
    s = rd(f)
    i = s.find(start); j = s.find(end, i + 1) if i >= 0 else -1
    assert i >= 0 and j > i, '[%s] span 锚点缺失 start=%r end=%r' % (f, start[:40], end[:40])
    if must: assert must in s[i:j], '[%s] span 体内未见 %r' % (f, must[:40])
    wr(f, s[:i] + new + s[j:])
    LOG.append('%s span :: %s …' % (f, start[:40]))

# ================= ui.js =================
rep('js/ui.js',
    '    /* v89.74（老板：「鸿胪寺已拆除…点击地块时提供可选项」）—— 派系驻地原本是\n'
    '       "无功能面板"的 4 座建筑之一；现在它有了门：点城内派系格 → 派系面板\n'
    '       （入派 / 立派 / 派系任务 / 品阶声望）。 */\n'
    '    honglusi: { label: "⚔️ 派系", act: "open-sect" },',
    '    /* v89.74：派系驻地有了门（入派 / 立派 / 派系任务 / 品阶声望）。\n'
    '       v89.224（老板 1）：本格改为**基因实验室的建筑载体** —— 新增「🧬 基因实验室」\n'
    '       入口（原在政务厅要务段，已撤）；「⚔️ 派系」入口保留。 */\n'
    '    honglusi: [{ label: "🧬 基因实验室", act: "open-lab" },\n'
    '      { label: "⚔️ 派系", act: "open-sect" }],')

rep('js/ui.js',
    '         ③ 规格统一：四个按钮全部 `btn sm`（原先"基因实验室"用 btn gold = 36 高 / 14px 字，\n'
    '            其余 26 高 / 12px —— 老板实测的"图标大小规格不一样"），\n'
    '            图标统一 emoji 族（📝 / 🏛 / 🧬），不再混用 ✎（dingbat）与彩色 emoji。 */',
    '         ③ 规格统一：按钮全部 `btn sm`，图标统一 emoji 族（📝 / 🏛）。\n'
    '         v89.224（老板 1）：「🧬 基因实验室」按钮**整条撤出** —— 实验室改由城内\n'
    '         建筑「基因实验室」（honglusi 格）承载；本段只留改名 / 主城两键。 */')

rep('js/ui.js',
    "          '<button class=\"btn sm gold\" data-action=\"open-farm\"' +\n"
    "            ' title=\"基因实验室：培育菌种与作物，收高阶打造材料与资质药草\">🧬 基因实验室</button>' +\n",
    "")

# 实验室面板：整段重写（openFarm / farmHTML / openFarmProjects）
span('js/ui.js',
     '   * 基因实验室（v73 立 · v89.220 老板拍板改名）：政务厅 → 另一个菜单',
     '  /* ⛔ v89.218（老板）：「故事全部去除」——',
     '''   * 基因实验室（v73 立 · v89.220 改名 · v89.224 迁入建筑 + 去播种化）
   *   ⚠ 命名沿革：种田秘境（v89.216 前）→ 温室农场（v89.216）→ 基因实验室（v89.220）。
   * ------------------------------------------------------------
   * v89.224（老板 1/2）：实验室从「政务厅要务」迁到**城内建筑「基因实验室」**（honglusi 格）；
   *   播种 / 种子整体退役 —— 六座培养舱直接「立项研发」：材料研发 ×6 + 基因调试 ×4，
   *   完成即提取产物。面板只管展示与派发 data-action，逻辑全在 GAME.farm*（域层）。
   * ============================================================ */
  ui.openFarm = function () {
    ui.openModal('<div class="ui-page farm-space">' + ui.farmHTML() + '</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xxl', closeAll: true });
      /* v89.135（老板 8）：「基因实验室关闭后直接会到城池界面」—— closeAll 语义：
         关闭键 = 全关回游戏视图（不弹回进实验室前的那层）。 */
  };
  ui.farmHTML = function () {
    var f = GAME.farmOf();
    var ripeN = 0;
    var cells = f.plots.map(function (p, i) {
      var st = GAME.farmPlotState(i);
      var body, act = '';
      if (st.state === 'empty') {
        body = '<div class="farm-ic">🧫</div><div class="farm-crop">空闲</div>' +
          '<div class="farm-sub">可立项</div>';
        act = '<button class="btn sm gold" data-action="farm-projects" data-idx="' + i + '">立项</button>';
      } else if (st.state === 'growing') {
        body = '<div class="farm-ic">' + st.crop.icon + '</div>' +
          '<div class="farm-crop">' + st.crop.name + '</div>' +
          '<div class="pbar"><i data-farm-bar="' + i + '" style="width:' + st.pct + '%;"></i></div>' +
          '<div class="farm-sub" data-farm-left="' + i + '">完成还需 ' +
            U.durExact(st.left / GAME.timeScale()) + '</div>';
      } else {
        ripeN++;
        body = '<div class="farm-ic">' + st.crop.icon + '</div>' +
          '<div class="farm-crop">' + st.crop.name + '</div>' +
          '<div class="farm-sub" style="color:var(--gold-light);">✨ 可提取</div>';
        act = '<button class="btn sm gold" data-action="farm-extract" data-idx="' + i + '">提取</button>';
      }
      return '<div class="farm-cell' + (st.state === 'ripe' ? ' ripe' : '') + '">' + body + act + '</div>';
    }).join('');
    return '<div class="gold-heading">🧬 基因实验室</div>' +
      '<div class="ui-sub" style="text-align:center;">旧世实验室 · 六座培养舱　立项即开工，研发走游戏时间</div>' +
      '<div class="farm-grid">' + cells + '</div>' +
      (ripeN
        ? '<div class="op-row" style="justify-content:flex-end;">' +
            '<button class="btn gold" data-action="farm-extract-all">一键提取（' + ripeN + '）</button></div>'
        : '') +
      '<div class="op-zone"><div class="op-zone-t">研发与去向</div>' +
        '<div class="attr"><span class="k">材料研发</span><span class="v">3 阶打造主料（钢锭 / 铁木 / 硬甲皮 / 巨兽筋 / 羊脂玉 / 织锦），有机率出 4 阶</span></div>' +
        '<div class="attr"><span class="k">基因调试</span><span class="v">激活 / 蜕变 / 觉醒 / 天启血清 —— 英雄资质逐档提升</span></div>' +
        '<div class="attr"><span class="k">去向</span><span class="v">材料 → 锻造间打造；血清 → 宝物背包 → 选英雄使用</span></div>' +
      '</div>';
  };
  /* 立项弹窗：列出全部研发项目（6 材料 + 4 基因调试）—— 直接立项，不消耗道具 */
  ui.openFarmProjects = function (idx) {
    var rows = (DATA.FARM.crops || []).map(function (c) {
      var yieldTxt;
      if (c.herb) {
        var it = null;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === c.herb) it = x; });
        yieldTxt = '得 ' + ((it && it.name) || c.herb) + ' ×1（英雄资质提升一档）';
      } else {
        var m3 = DATA.MATERIAL_BY_ID[c.mat] || {};
        var m4 = DATA.MATERIAL_BY_ID[c.rare] || {};
        yieldTxt = '得 ' + (m3.name || c.mat) + ' ×' + c.qty[0] + '~' + c.qty[1] +
          '（' + Math.round((c.rareP || 0.15) * 100) + '% 出 ' + (m4.name || c.rare) + '）';
      }
      return '<div class="farm-proj">' +
        '<div class="farm-ic">' + c.icon + '</div>' +
        '<div class="farm-proj-main">' +
          '<div class="farm-crop">' + c.name + '</div>' +
          '<div class="farm-sub">' + U.escape(c.desc) + '</div>' +
          '<div class="farm-sub">⏱ ' + c.hours + ' 游戏小时　' + yieldTxt + '</div>' +
        '</div>' +
        '<button class="btn sm gold" data-action="farm-start" data-idx="' + idx +
          '" data-crop="' + c.id + '">立项</button>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">🧬 第 ' + (idx + 1) + ' 号培养舱 · 立项</div>' +
      '<div class="ui-sub" style="text-align:center;">直接立项，不消耗道具；完成后回实验室提取产物。</div>' +
      rows +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };
''',
     must='openFarmSeeds')

rep('js/ui.js',
    "    /* v73：基因实验室 —— 面板开着时倒计时每秒走、成熟即换出「收获」按钮",
    "    /* v73：基因实验室 —— 面板开着时倒计时每秒走、完成即换出「提取」按钮")
rep('js/ui.js', "        ? '✨ 已成熟'", "        ? '✨ 可提取'")
rep('js/ui.js', "        : ('成熟还需 ' + U.durExact(fs1.left / GAME.timeScale()));",
    "        : ('完成还需 ' + U.durExact(fs1.left / GAME.timeScale()));")
rep('js/ui.js', 'document.querySelectorAll(\'.farm-cell [data-action="farm-harvest"]\')',
    'document.querySelectorAll(\'.farm-cell [data-action="farm-extract"]\')')

rep('js/ui.js', "    seed: { hint: '请到基因实验室播种', act: 'open-farm', btn: '去播种' },\n", "")
rep('js/ui.js', "    seed: '种子（基因实验室）',\n", "")
rep('js/ui.js', "rank_up: '药草（提升资质）',", "rank_up: '血清（提升资质）',")
rep('js/ui.js',
    "    if (it.type === 'seed') {\n"
    "      /* v89.87（老板拍板 · 需求 1）：种子开售（配合\"快购全覆盖\"）——\n"
    "         v78 的\"不售\"已按最新拍板解除；来源标注保留 */\n"
    "      html += '<div class=\"attr\"><span class=\"k\">来源</span><span class=\"v good\">采集归来 · 出征缴获 · 游商可购</span></div>';\n"
    "      if (it.price) html += '<div class=\"attr\"><span class=\"k\">游商价</span><span class=\"v\">' + U.fmt(it.price * 100) + ' 金</span></div>';\n"
    "    } else if (it.price) {",
    "    if (it.price) {")
rep('js/ui.js',
    "      /* v78：种子按品种给图标（与作物同款，一眼对上） */\n"
    "      seed: { seed_fan: '🌾', seed_yunling: '🌱', seed_xisui: '🍄', seed_hualong: '🪷', seed_tianshou: '🍑' },\n", "")
rep('js/ui.js',
    "    if (it.type === 'jewel') return (m.jewel && m.jewel[it.id]) || '💠';\n"
    "    if (it.type === 'seed') return (m.seed && m.seed[it.id]) || '🌰';\n",
    "    if (it.type === 'jewel') return (m.jewel && m.jewel[it.id]) || '💠';\n")
rep('js/ui.js', 'neigong: 508, perm: 509, rank_up: 510, seed: 511, mount_buff: 512,',
    'neigong: 508, perm: 509, rank_up: 510, mount_buff: 512,')

# 资质晋升提示（tip186）
rep('js/ui.js',
    "      var seed = null;\n"
    "      if (crop) (DATA.ITEMS || []).forEach(function (it) { if (it.id === crop.seedItem) seed = it; });\n"
    "      var tip186 = '资质晋升 → ' + nxt.name + '（上限 Lv' + (nxt.lvCap || '?') + '）'\n"
    "        + '\\n需《' + herb.name + '》×1 —— 持有 ' + haveH + ' 株'\n"
    "        + '\\n药草产自「政务厅 → 基因实验室」（种下种子 → 按游戏时间生长 → 收获即得）；种子可游商购买 / 采集·征战缴获'\n"
    "        + (crop ? '\\n种子 ' + GAME.utils.fmt((seed ? (seed.price || 0) * 100 : 0)) + ' 金／遗迹 ' + crop.hours + ' 游戏时' : '')\n"
    "        + '\\n每次晋升另给四维各 +' + (nxt.ascend || 0);",
    "      var tip186 = '资质晋升 → ' + nxt.name + '（上限 Lv' + (nxt.lvCap || '?') + '）'\n"
    "        + '\\n需《' + herb.name + '》×1 —— 持有 ' + haveH + ' 支'\n"
    "        + '\\n血清产自「基因实验室」（立项 → 按游戏时间研发 → 提取即得）'\n"
    "        + (crop ? '\\n研发耗时 ' + crop.hours + ' 游戏时／座' : '')\n"
    "        + '\\n每次晋升另给四维各 +' + (nxt.ascend || 0);")

# 经验道具提示（tip192）
rep('js/ui.js',
    "          ui.help('提升上限只能换更高资质的英雄：凡品 60 · 良材 100 · 英杰 140 · 名世 180 · 天授 240。'\n"
    "            + '\\n⚠️ 酒馆只招得到**英杰及以下**；名世 / 天授要用**药草升档**（基因实验室产出）。'",
    "          ui.help('提升上限只能换更高资质的英雄：凡人 60 · 突变体 100 · 进化体 140 · 觉醒体 180 · 天启体 240。'\n"
    "            + '\\n⚠️ 酒馆只招得到**进化体及以下**；觉醒体 / 天启体要用**血清升档**（基因实验室产出）。'")

# ================= domain.js =================
span('js/domain.js',
     '   * 基因实验室（v73 · 老板需求 3）：个人田庄 —— 种作物，收高阶材料与资质药草',
     '  GAME.farmOf = function () {',
     '''   * 基因实验室（v73 · 老板需求 3；v89.224 去播种化）：旧世实验室 —— 立项研发，收材料与血清
   * ------------------------------------------------------------
   * 链条（v89.224 · 老板 2：「不要播种 / 种子」）：
   *   立项（不消耗道具）→ 游戏时间研发 → 提取产物
   *      ├─ 材料研发 → 3 阶主产（有机率出 4 阶）→ 锻造间高阶打造
   *      └─ 基因调试 → 激活 / 蜕变 / 觉醒 / 天启血清 → 资质逐档提升
   * 数据全在 DATA.FARM（加项目 = 加一行）；研发吃**游戏时间**：
   * 与建造 / 研究同一把尺 —— 在线主循环与离线补算各推一次（tickFarm），
   * 调时间倍率、挂机离线都有效，不需要另起一套计时。
   * 存档：s.farm 懒初始化（旧档缺失即补），不动 SAVE_VERSION。
   * ⚠ 内部函数名沿用 farm*（历史 id 不动，语义 = 研发项目）。
   * ============================================================ */
''',
     must='SAVE_VERSION')

span('js/domain.js',
     '  /* 播种 = 用**种子**落地（v78 · 老板需求 1：「种子只有通过英雄其他活动获得，',
     '  /* 生长推进（在线主循环 / 离线补算共用；secGame = 游戏秒） */',
     '''  /* 立项 = 直接开工（v89.224 · 老板 2：「不要播种 / 种子」）——
     不消耗任何道具；种子 / 掉落 / 货架三条链已整条删除（老档种子由 adoptState 清出）。 */
  GAME.farmPlant = function (idx, cropId) {
    var f = GAME.farmOf();
    var c = GAME.farmCrop(cropId);
    if (!c) return { ok: false, msg: '未知项目' };
    if (idx < 0 || idx >= f.plots.length) return { ok: false, msg: '培养舱不存在' };
    if (f.plots[idx]) return { ok: false, msg: '这座培养舱还占着' };
    f.plots[idx] = { crop: cropId, elapsed: 0, totalTime: Math.round(c.hours * 3600) };
    GAME.log('🧬 立项研发：' + c.name);
    return { ok: true, msg: '已立项 \\u300c' + c.name + '\\u300d' };
  };
''',
     must='播种消耗')

span('js/domain.js',
     '  /* v78（老板需求 1）：种子掉落 —— **唯一出口**（采集归来 / 出征获胜各调一次）。',
     '  /* v89.51（老板「物品的产生和消耗路径打通」）：辐能核心掉落 —— **唯一出口**。',
     '''  /* ⛔ v89.224：GAME.grantSeedDrop 退役（种子体系删除）——
     采集归来 / 出征缴获两条调用点一并撤除；播种改「立项」后不再需要种子。 */
''',
     must='GAME.grantSeedDrop')

rep('js/domain.js', "  /* 收获：成熟才给 —— 材料作物 = 3 阶主产 ×区间 + 4 阶副产（几率）；药草作物 = 1 株 */",
    "  /* 提取：研发完成才给 —— 材料项目 = 3 阶主产 ×区间 + 4 阶副产（几率）；基因项目 = 血清 ×1 */")
rep('js/domain.js', "    if (st.state === 'empty') return { ok: false, msg: '这块地空着' };",
    "    if (st.state === 'empty') return { ok: false, msg: '这座培养舱空着' };")
rep('js/domain.js', "      return { ok: false, msg: st.crop.name + ' 还差 ' + U.durExact(st.left / GAME.timeScale()) + ' 成熟' };",
    "      return { ok: false, msg: st.crop.name + ' 还差 ' + U.durExact(st.left / GAME.timeScale()) + ' 完成' };")
rep('js/domain.js', "    GAME.log('🌾 遗迹收获：' + c.name + ' → ' + txt);", "    GAME.log('🧪 产物提取：' + c.name + ' → ' + txt);")
rep('js/domain.js', "    return { ok: true, msg: '收获 ' + txt };", "    return { ok: true, msg: '提取 ' + txt };")
rep('js/domain.js', "  /* 一键收获：把成熟的全收了（面板里的快捷按钮） */", "  /* 一键提取：把完成的全提了（面板里的快捷按钮） */")
rep('js/domain.js', "    if (!any) return { ok: false, msg: '没有成熟的作物' };", "    if (!any) return { ok: false, msg: '没有可提取的产物' };")
rep('js/domain.js', "      if (r.ok) { any = true; got.push(r.msg.replace(/^收获 /, '')); }",
    "      if (r.ok) { any = true; got.push(r.msg.replace(/^提取 /, '')); }")
rep('js/domain.js', "    return { ok: true, msg: '收获 ' + got.join('、') };", "    return { ok: true, msg: '提取 ' + got.join('、') };")
rep('js/domain.js', "  /* 材料 / 道具名（材料在 MATERIAL_BY_ID、药草在 ITEMS，两表各查一次） */",
    "  /* 材料 / 道具名（材料在 MATERIAL_BY_ID、血清在 ITEMS，两表各查一次） */")
rep('js/domain.js', '       「遗迹药草养成」为主路（见 DATA.FARM）。 */',
    '       「基因实验室血清养成」为主路（见 DATA.FARM）。 */')

# 采集归来：种子掉出行删除 + 精华注释更新
rep('js/domain.js',
    "    /* v78（老板需求 1）：种子 —— 采集归来的另一项收获（种子的主渠道） */\n"
    "    var seedGot = GAME.grantSeedDrop(g.level || 1, 1, '🌱 采集所得种子');\n"
    "    /* v89.51：辐能核心 —— 与种子同为一类\"顺带所得\"（调校改造装备的产出主渠道） */",
    "    /* ⛔ v89.224：种子掉落退役（采集线）—— 播种改「立项」后不再需要种子。 */\n"
    "    /* v89.51：辐能核心 —— \"顺带所得\"（调校基因强化件的产出主渠道） */")

# ================= systems.js =================
rep('js/systems.js',
    "    } else if (item.type === 'seed') {\n"
    "      /* v78（老板需求 1）：种子**不直接使用** —— 播种在基因实验室里（政务厅 → 基因实验室） */\n"
    "      return { ok: false, msg: '种子要到基因实验室播种（政务厅 → 🧬 基因实验室）' };\n",
    "")

# ================= main.js =================
rep('js/main.js',
    "      /* v73（老板需求 3）：基因实验室（政务厅 → 另外一个菜单）。\n"
    "         播种 / 收获后**留在遗迹里刷新** —— 地块状态变化要立刻看得见。 */\n"
    "      case 'open-farm': ui.openFarm(); break;\n"
    "      case 'farm-seeds': ui.openFarmSeeds(Number(el.dataset.idx)); break;\n"
    "      case 'farm-plant': {",
    "      /* v73（老板需求 3）：基因实验室。v89.224：入口迁到城内建筑「基因实验室」格；\n"
    "         立项 / 提取后**留在实验室里刷新** —— 状态变化要立刻看得见。 */\n"
    "      case 'open-lab': ui.openFarm(); break;\n"
    "      case 'farm-projects': ui.openFarmProjects(Number(el.dataset.idx)); break;\n"
    "      case 'farm-start': {")
rep('js/main.js', "      case 'farm-harvest': {", "      case 'farm-extract': {")
rep('js/main.js', "      case 'farm-harvest-all': {", "      case 'farm-extract-all': {")

# ================= state.js =================
rep('js/state.js',
    "  /* 资质药草（v73 · 基因实验室产物）：把英雄的资质**升一档**。\n"
    "     药草与档位**一一对应**（凡→良 活性血清 / 良→英 强化血清 / 英→名 跃迁血清 /\n"
    "     名→天 天选血清，见 DATA.ITEMS 的 rank_up 型）。只改 rank 字段 ——",
    "  /* 资质血清（v73 · 基因实验室产物；v89.224 更名）：把英雄的资质**升一档**。\n"
    "     血清与档位**一一对应**（凡人→突变体 激活血清 / 突变体→进化体 蜕变血清 /\n"
    "     进化体→觉醒体 觉醒血清 / 觉醒体→天启体 天启血清，见 DATA.ITEMS 的 rank_up 型）。只改 rank 字段 ——")
rep('js/state.js', "     获得额外提升」—— 药草淬炼过的根基更实：每次升档，四维各 +新档 ascend。",
    "     获得额外提升」—— 血清调试过的根基更实：每次升档，四维各 +新档 ascend。")
rep('js/state.js', "    if (asc78 > 0) extra.push('四维 +' + asc78 + '（药草淬炼）');",
    "    if (asc78 > 0) extra.push('四维 +' + asc78 + '（血清调试）');")
rep('js/state.js',
    "       · 凡品 / 良材 / 英杰 可以出；名世 / 天授**只能靠药草升档**（GAME.rankUpUse）。",
    "       · 凡人 / 突变体 / 进化体 可以出；觉醒体 / 天启体**只能靠血清升档**（GAME.rankUpUse）。")
rep('js/state.js', "     （遗迹、史实名将等），动表会把它们一起封死；截断只作用于酒馆这条链。",
    "     （基因实验室、史实名将等），动表会把它们一起封死；截断只作用于酒馆这条链。")
rep('js/state.js', "    /* v73：遗迹作物按同一段离线时长推进（挂机回来地里的东西也该熟了） */",
    "    /* v73：实验室研发项目按同一段离线时长推进（挂机回来也该完成了） */")
rep('js/state.js',
    "      var legacyRes = st.res || null;",
    "      /* v89.224：种子体系退役 —— 老档背包里的 5 种种子道具清出（已无处可用）；\n"
    "         掉落 / 播种 / 货架三条链整条删除，见 docs/废土术语映射表.md。 */\n"
    "      if (st.items) {\n"
    "        ['seed_fan', 'seed_yunling', 'seed_xisui', 'seed_hualong', 'seed_tianshou'].forEach(function (k) { delete st.items[k]; });\n"
    "      }\n"
    "      var legacyRes = st.res || null;")

# ================= battle.js =================
rep('js/battle.js',
    "      /* v78（老板需求 1）：种子 —— 出征获胜的缴获之一（种子另一主渠道是采集）。\n"
    "         城档折算见 DATA.SEED_DROP.cityLv；野地按自身等级。 */\n"
    "      var seedLv = (t.kind === 'wild')\n"
    "        ? (t.lv || 1)\n"
    "        : (((DATA.SEED_DROP || {}).cityLv || {})[t.dropType || 'county'] || (t.lv || 3));\n"
    "      var seedGot = GAME.grantSeedDrop(seedLv, DATA.SEED_DROP.battleMult, '缴获种子');\n"
    "      if (seedGot.length) gains.seeds = seedGot;\n"
    "\n"
    "      /* v89.51：辐能核心 —— 缴获线的产出（与种子同源的\"顺带所得\"，\n"
    "         补上调校改造装备在探索剥离之后的产出口） */\n"
    "      var essLoot = GAME.grantEssenceDrop(seedLv, DATA.ESSENCE_DROP.battleMult, '✨ 缴获辐能核心');",
    "      /* v89.224（老板 2）：种子缴获整条退役（播种改「立项」后不再需要种子）。\n"
    "         来源等级口径保留 —— 辐能核心掉落继续用它（城档折算随表迁入 DATA.ESSENCE_DROP.cityLv）。 */\n"
    "      var dropLv = (t.kind === 'wild')\n"
    "        ? (t.lv || 1)\n"
    "        : (((DATA.ESSENCE_DROP || {}).cityLv || {})[t.dropType || 'county'] || (t.lv || 3));\n"
    "\n"
    "      /* v89.51：辐能核心 —— 缴获线的产出（补上调校基因强化件的产出口） */\n"
    "      var essLoot = GAME.grantEssenceDrop(dropLv, DATA.ESSENCE_DROP.battleMult, '✨ 缴获辐能核心');")

# ================= index.html =================
rep('index.html', '     六格灵田；生长中是进度条 + 倒计时（每秒由 ui.updateProgress 刷新）。',
    '     六座培养舱；研发中是进度条 + 倒计时（每秒由 ui.updateProgress 刷新）。')
rep('index.html', '  .farm-seed-main { flex: 1; min-width: 0; }', '  .farm-proj-main { flex: 1; min-width: 0; }')
rep('index.html', '  .farm-seed .farm-ic { font-size: var(--isz-em-md); }', '  .farm-proj .farm-ic { font-size: var(--isz-em-md); }')
rep('index.html', '  .farm-seed {', '  .farm-proj {')
rep('index.html', '    --isz-em-md: 1.6em;     /* em 族：集水场种子位 */',
    '    --isz-em-md: 1.6em;     /* em 族：实验室研发行（.farm-proj .farm-ic） */')

print('[b2] 共 %d 处编辑完成' % len(LOG))
for l in LOG: print('  ' + l)
