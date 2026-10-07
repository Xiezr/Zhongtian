# -*- coding: utf-8 -*-
"""v89.224b3：smoke / e2e 用例改写（实验室迁移 + 去播种化 · 按新规则重写，不删不放宽）。"""
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
LOG = []
def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224b3'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)
def rep(f, old, new, cnt=1):
    s = rd(f)
    c = s.count(old)
    assert c == cnt, '[%s] 锚点计数 %d != %d :: %r' % (f, c, cnt, old[:90])
    wr(f, s.replace(old, new))
    LOG.append('%s ×%d :: %s' % (f, cnt, old[:44].replace('\n', '⏎')))
def span(f, start, end, new, must=None):
    s = rd(f)
    i = s.find(start); j = s.find(end, i + 1) if i >= 0 else -1
    assert i >= 0 and j > i, '[%s] span 锚点缺失 start=%r end=%r' % (f, start[:50], end[:50])
    if must: assert must in s[i:j], '[%s] span 内未见 %r' % (f, must[:40])
    wr(f, s[:i] + new + s[j:])
    LOG.append('%s span :: %s' % (f, start[:40]))

F = 'smoke-test.js'

# ---- S1 链条段 ----
rep(F, "  var st73 = G.newGame({ name: '遗迹验收', region: '烬环' });", "  var st73 = G.newGame({ name: '实验室验收', region: '烬环' });")
rep(F, "  check('链条①：初始六块空地', G.farmOf().plots.length === 6 && G.farmPlotState(0).state === 'empty');",
    "  check('链条①：初始六座培养舱（空舱待立项）', G.farmOf().plots.length === 6 && G.farmPlotState(0).state === 'empty');")
rep(F,
    "  /* v78：播种改种子制 —— 先发种子；\"即种\"不变，黄金分文不动 */\n"
    "  st73.items['seed_fan'] = 2;\n"
    "  var rp73 = G.farmPlant(0, 'tieying');\n"
    "  check('链条②（v78 改）：种子播种 —— 消耗 ×1、不扣黄金', rp73.ok && st73.items['seed_fan'] === 1 && st73.res.gold === gold73, rp73.msg);",
    "  /* v89.224（老板 2）：播种退役 —— 立项直接开工，不消耗道具、黄金分文不动 */\n"
    "  var rp73 = G.farmPlant(0, 'tieying');\n"
    "  check('链条②（v89.224 改）：立项 —— 不消耗道具、不扣黄金', rp73.ok && !st73.items['seed_fan'] && st73.res.gold === gold73, rp73.msg);")
rep(F, "  check('链条③：生长中不可收获（提示准确剩余）', (function () {", "  check('链条③：研发中不可提取（提示准确剩余）', (function () {")
rep(F, "    return !h.ok && /成熟/.test(h.msg);", "    return !h.ok && /完成/.test(h.msg);")
rep(F, "  check('链条④：推进 6 游戏小时即成熟', G.farmPlotState(0).state === 'ripe');",
    "  check('链条④：推进 6 游戏小时即完成', G.farmPlotState(0).state === 'ripe');")
rep(F, "  check('链条⑤：收获进背包（钢锭 ×2~4；地块清空）',", "  check('链条⑤：提取进背包（钢锭 ×2~4；培养舱清空）',")
rep(F, "  st73.items['seed_yunling'] = 1;\n  G.farmPlant(1, 'yunlingcao');", "  G.farmPlant(1, 'yunlingcao');")
rep(F, "  check('链条⑥：药草可收获（活性血清 ×1）', rh73b.ok && (st73.items['yunlingcao'] || 0) >= 1, rh73b.msg);",
    "  check('链条⑥：血清可提取（激活血清 ×1）', rh73b.ok && (st73.items['yunlingcao'] || 0) >= 1, rh73b.msg);")
rep(F, "  check('链条⑦：药草把 凡品 → 良材（唯一出口 rankUpUse）', use73.ok && g73.rank === 'liang', use73.msg);",
    "  check('链条⑦：血清把 凡人 → 突变体（唯一出口 rankUpUse）', use73.ok && g73.rank === 'liang', use73.msg);")
rep(F, "  check('链条⑦b：已在该档时拒绝（良材再用活性血清 = 不重复生效）', (function () {",
    "  check('链条⑦b：已在该档时拒绝（突变体再用激活血清 = 不重复生效）', (function () {")
rep(F, "  check('链条⑦c：档位不符时拒绝并说明（英杰不能用活性血清）', (function () {",
    "  check('链条⑦c：档位不符时拒绝并说明（进化体不能用激活血清）', (function () {")
rep(F,
    "  check('链条⑧：一键收获（多处成熟一次收）', (function () {\n"
    "    st73.res.gold = 1000000;\n"
    "    st73.items['seed_fan'] = 2;\n"
    "    G.farmPlant(2, 'yusuihua');",
    "  check('链条⑧：一键提取（多处完成一次提）', (function () {\n"
    "    st73.res.gold = 1000000;\n"
    "    G.farmPlant(2, 'yusuihua');")
rep(F,
    "  check('界面：政务厅入口 + 面板/选种/收获动作齐备', (function () {\n"
    "    return /data-action=\"open-farm\"/.test(uS73) && /data-action=\"farm-seeds\"/.test(uS73)\n"
    "      && /data-action=\"farm-plant\"/.test(uS73) && /data-action=\"farm-harvest\"/.test(uS73)\n"
    "      && /ui\\.openFarm = function/.test(uS73) && /ui\\.openFarmSeeds = function/.test(uS73);\n"
    "  })());",
    "  check('界面：建筑格入口 + 面板/立项/提取动作齐备（v89.224 迁入「基因实验室」建筑格）', (function () {\n"
    "    return /data-action=\"open-lab\"/.test(uS73) && /data-action=\"farm-projects\"/.test(uS73)\n"
    "      && /data-action=\"farm-start\"/.test(uS73) && /data-action=\"farm-extract\"/.test(uS73)\n"
    "      && /ui\\.openFarm = function/.test(uS73) && /ui\\.openFarmProjects = function/.test(uS73);\n"
    "  })());")
rep(F, "  check('样式：农场底纹 / 地块 / 成熟高亮（.farm-space / .farm-grid / .farm-cell.ripe）',",
    "  check('样式：实验室底纹 / 培养舱 / 可提取高亮（.farm-space / .farm-grid / .farm-cell.ripe）',")

# ---- S2 §63 全段重写 ----
span(F,
     '   * ===== 63. v78：药草时序 / 种子活动制 / 隐藏「灵淬」（老板三条） =====',
     '    /* ---------- ④ 隐藏设定：灵淬 ---------- */',
     '''   * ===== 63. v78 三条（时间递增 · 立项制 · 隐藏「灵淬」）· v89.224 重写 =====
   * ------------------------------------------------------------
   * v89.224（老板 2）：播种 / 种子体系退役，本段按新规则重写（④ 灵淬不动）：
   *   ① 数据：基因调试 12/24/48/96 递进 · 10 项目无种子字段 · 种子三件套全退役
   *   ② 立项：直接开工（不消耗道具）· 占舱拒绝 · 提取入包
   *   ③ 零残留：播种 / 种子 / 菌种三条链在域层 / 数据 / 界面全删
   * ============================================================ */
  console.log('\\n===== 63. v78 三条（时间递增 · 立项制 · 灵淬隐藏加成）· v89.224 重写 =====');
  (function () {
    var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
    var dS = stripComment(rd('data'));
    var stS = stripComment(rd('state'));
    var domS = stripComment(rd('domain'));
    var batS = stripComment(rd('battle'));
    var uS = stripComment(rd('ui'));
    var sysS = stripComment(rd('systems'));

    /* ---------- ① 项目表 & 时间递进（v89.224：种子数据退役） ---------- */
    console.log('  --- ① 基因调试时间逐级拉长 + 项目表（10 项 · 无种子字段） ---');
    check('数据：基因调试时长逐级翻倍 12/24/48/96', (function () {
      var hs = {};
      (DATA.FARM.crops || []).forEach(function (c) { if (c.herb) hs[c.id] = c.hours; });
      return hs.yunlingcao === 12 && hs.xisuizhi === 24 && hs.hualongshen === 48 && hs.tianshouguo === 96;
    })(), '激活血清 12 / 蜕变血清 24 / 觉醒血清 48 / 天启血清 96');
    check('数据：时长严格递增且增量逐档变大（+12 / +24 / +48）', (function () {
      var arr = ['yunlingcao', 'xisuizhi', 'hualongshen', 'tianshouguo'].map(function (id) {
        var c = DATA.FARM_CROP_BY_ID[id]; return c ? c.hours : 0;
      });
      return arr[1] > arr[0] && arr[2] > arr[1] && arr[3] > arr[2]
        && (arr[1] - arr[0]) < (arr[2] - arr[1]) && (arr[2] - arr[1]) < (arr[3] - arr[2]);
    })());
    check('数据：10 个研发项目（无 seedItem / seed 字段 · v89.224 去播种化）', (function () {
      var cs = DATA.FARM.crops || [];
      return cs.length === 10 && cs.every(function (c) { return c.seedItem === undefined && c.seed === undefined; });
    })());
    check('数据：种子三件套全退役（0 件 seed 道具 / 无 SEED_DROP / 无 grantSeedDrop / 无 seed 页签）', (function () {
      var seeds = (DATA.ITEMS || []).filter(function (x) { return x.type === 'seed'; });
      return seeds.length === 0 && DATA.SEED_DROP === undefined && typeof GAME.grantSeedDrop === 'undefined'
        && GAME.ui.SHOP_CATS.seed === undefined;
    })());
    check('数据：项目与产物换代（铁系熔炼… / 基因调试 I~IV / 激活~天启血清）', (function () {
      var byId = DATA.FARM_CROP_BY_ID;
      return byId.tieying.name === '铁系熔炼' && byId.tianshouguo.name === '基因调试 IV'
        && (DATA.ITEM_BY_ID['yunlingcao'] || {}).name === '激活血清'
        && (DATA.ITEM_BY_ID['tianshouguo'] || {}).name === '天启血清';
    })());

    /* ---------- ② 立项 = 直接开工（不消耗道具） ---------- */
    console.log('  --- ② 立项（域层唯一出口 · v89.224 规则） ---');
    var st78 = G.newGame({ name: 'v224验收', region: '烬环' });
    check('实测：空手可立项（无种子门）—— 道具零变化、黄金分文不动', (function () {
      st78.res.gold = 123456;
      var r = G.farmPlant(0, 'yunlingcao');
      return r.ok && !st78.items['seed_yunling'] && st78.res.gold === 123456
        && G.farmPlotState(0).state === 'growing';
    })());
    check('实测：占舱重复立项被拒（提示占舱）', (function () {
      var r = G.farmPlant(0, 'tieying');
      return !r.ok && r.msg.indexOf('占') >= 0;
    })());
    check('实测：farmPlant 里不再有黄金 / 种子扣减', (function () {
      var body = codeOf(domS, 'GAME.farmPlant = function');
      return body.indexOf('gold') < 0 && body.indexOf('seed') < 0;
    })());
    check('实测：提取产物入包（钢锭 ×2~4）', (function () {
      G.tickFarm(12 * 3600);
      var h = G.farmHarvest(0);
      return h.ok && ((st78.items || {}).bintie || 0) >= 2;
    })());

    /* ---------- ③ 零残留（种子 / 播种 三条链全删） ---------- */
    console.log('  --- ③ 零残留（域层 / 数据 / 界面） ---');
    check('零残留：grantSeedDrop / SEED_DROP / openFarmSeeds / seed 路由全删', (function () {
      return domS.indexOf('grantSeedDrop') < 0 && dS.indexOf('SEED_DROP = ') < 0
        && uS.indexOf('openFarmSeeds') < 0 && uS.indexOf("seed: {") < 0
        && sysS.indexOf("type === 'seed'") < 0;
    })());
    check('界面：面板文案无「播种 / 种子 / 灵田」（立项 / 研发 / 提取口径）', (function () {
      var panel = codeOf(uS, 'ui.farmHTML = function');
      return panel.indexOf('立项') >= 0 && panel.indexOf('提取') >= 0
        && panel.indexOf('播种') < 0 && panel.indexOf('种子') < 0 && panel.indexOf('灵田') < 0;
    })());
    check('界面：立项弹窗列出 10 个项目（farm-start ×10）· 无种子消耗行', (function () {
      var fn = codeOf(uS, 'ui.openFarmProjects = function');
      return uS.indexOf('data-action="farm-start"') >= 0 && uS.indexOf('data-action="farm-projects"') >= 0
        && fn.indexOf('种子') < 0 && fn.indexOf('持有 <b>') < 0;
    })());

''',
     must='grantSeedDrop')

# ---- S3 政务厅简化检查 ----
rep(F,
    "    /* v89.135（老板 10）：政务厅面板退役 —— 功能直进建筑面板（改名/主城/遗迹三键可见） */\n"
    "    check('② 政务厅简化（v89.135）：面板退役，功能直进建筑面板（改名/主城/遗迹）', (function () {\n"
    "      var i = u82.indexOf(\"_gfBid135 === 'guanfu'\");\n"
    "      var seg = i >= 0 ? u82.slice(i, i + 2800) : '';\n"
    "      return !/ui\\.openGuanfu = function/.test(u82)\n"
    "        && /data-action=\"open-rename-city\"/.test(seg)\n"
    "        && /data-action=\"open-farm\"/.test(seg);\n"
    "    })());",
    "    /* v89.135（老板 10）：政务厅面板退役 —— 功能直进建筑面板（改名/主城两键可见）\n"
    "       v89.224（老板 1）：基因实验室按钮撤出本段（迁入城内「基因实验室」建筑格） */\n"
    "    check('② 政务厅简化（v89.135 / v89.224）：面板退役，本段只留改名 / 主城', (function () {\n"
    "      var i = u82.indexOf(\"_gfBid135 === 'guanfu'\");\n"
    "      var seg = i >= 0 ? u82.slice(i, i + 2800) : '';\n"
    "      return !/ui\\.openGuanfu = function/.test(u82)\n"
    "        && /data-action=\"open-rename-city\"/.test(seg)\n"
    "        && !/data-action=\"open-farm\"/.test(seg)\n"
    "        && !/data-action=\"open-lab\"/.test(seg);\n"
    "    })());")

# ---- S4 专属消耗口 ----
rep(F,
    "  /* ② 专属消耗口：talis→计谋 · material/blueprint→锻造间 · seed→遗迹 · essence→调校 */\n"
    "  check('v89.51：专属消耗口（封存匣/材料/图纸/种子/辐能核心）都给出「去哪儿用」', (function () {\n"
    "    var s = GAME.state, bk = s.items, rep = {};\n"
    "    (DATA.ITEMS || []).forEach(function (it) { if (!rep[it.type]) rep[it.type] = it.id; });\n"
    "    var need = { talis: '计略', material: '锻造间', blueprint: '锻造间', seed: '基因实验室', essence: '调校' };",
    "  /* ② 专属消耗口：talis→计谋 · material/blueprint→锻造间 · essence→调校\n"
    "     （v89.224：seed→基因实验室 一行随种子退役删除） */\n"
    "  check('v89.51：专属消耗口（封存匣/材料/图纸/辐能核心）都给出「去哪儿用」', (function () {\n"
    "    var s = GAME.state, bk = s.items, rep = {};\n"
    "    (DATA.ITEMS || []).forEach(function (it) { if (!rep[it.type]) rep[it.type] = it.id; });\n"
    "    var need = { talis: '计略', material: '锻造间', blueprint: '锻造间', essence: '调校' };")

# ---- S5 非卖品 ----
rep(F,
    "  /* ④ 非卖品（种子/药草/辐能核心）不进游商，但各有专属获取口 */\n"
    "  check('v89.87：种子开售（老板拍板\"快购全覆盖\"）；药草/精华仍非卖品但获取口都在', (function () {\n"
    "    var all = GAME.ui.shopItems();\n"
    "    /* v89.87：种子由\"不售\"改为\"开售\"（配合就地快购全覆盖）——判定反转 */\n"
    "    var seedOnSale = all.some(function (it) { return it.type === 'seed'; });\n"
    "    var noSell = ['rank_up', 'essence'].every(function (t) {\n"
    "      return !all.some(function (it) { return it.type === t; });\n"
    "    });\n"
    "    return seedOnSale && noSell && !!DATA.SEED_DROP && !!DATA.ESSENCE_DROP\n"
    "      && typeof GAME.grantSeedDrop === 'function' && typeof GAME.grantEssenceDrop === 'function'\n"
    "      && (DATA.FARM.crops || []).some(function (c) { return !!c.herb; });\n"
    "  })());",
    "  /* ④ 非卖品（血清/辐能核心）不进游商，但各有专属获取口 */\n"
    "  check('v89.224 重写：血清 / 精华仍非卖品但获取口都在（种子已退役）', (function () {\n"
    "    var all = GAME.ui.shopItems();\n"
    "    var noSell = ['rank_up', 'essence'].every(function (t) {\n"
    "      return !all.some(function (it) { return it.type === t; });\n"
    "    });\n"
    "    return noSell && !!DATA.ESSENCE_DROP && typeof GAME.grantEssenceDrop === 'function'\n"
    "      && (DATA.FARM.crops || []).some(function (c) { return !!c.herb; });\n"
    "  })());")

# ---- S6 快购检查 ----
rep(F,
    "    check('v89.87（快购）：弹窗渲染（封存匣）+ 种子开售（页签）', (function () {\n"
    "      S87.res.gold = 999999;\n"
    "      G.ui.openQuickBuy('jinang', 2);\n"
    "      var qh = global.document.querySelector('#modal-root').innerHTML;\n"
    "      var uiOk = qh.indexOf('快购') >= 0 && qh.indexOf('封存匣') >= 0 && qh.indexOf('qb-qty') >= 0;\n"
    "      G.ui.closeModal();\n"
    "      var seedOk = G.ui.shopItems().some(function (it) { return it.type === 'seed'; })\n"
    "        && !!G.ui.SHOP_CATS.seed;\n"
    "      return uiOk && seedOk;\n"
    "    })());",
    "    check('v89.87（快购）：弹窗渲染（封存匣）+ 类目页签在册（v89.224：种子页签退役）', (function () {\n"
    "      S87.res.gold = 999999;\n"
    "      G.ui.openQuickBuy('jinang', 2);\n"
    "      var qh = global.document.querySelector('#modal-root').innerHTML;\n"
    "      var uiOk = qh.indexOf('快购') >= 0 && qh.indexOf('封存匣') >= 0 && qh.indexOf('qb-qty') >= 0;\n"
    "      G.ui.closeModal();\n"
    "      var catOk = !!G.ui.SHOP_CATS.material && G.ui.SHOP_CATS.seed === undefined;\n"
    "      return uiOk && catOk;\n"
    "    })());")

# ---- S7 U4 ----
rep(F, "   *       E11 度支 · E12 新城模板 · E4 音效/通知 · E5 演出层 · U4 种子文案",
    "   *       E11 度支 · E12 新城模板 · E4 音效/通知 · E5 演出层 · U4 血清文案")
rep(F,
    "    console.log('  --- U4 物品来源文案（在售 == 文案一致） ---');\n"
    "    check('U4：五种种子在售且 desc 写明「游商」来源', (function () {\n"
    "      var seeds = (DATA.ITEMS || []).filter(function (x) { return x.type === 'seed'; });\n"
    "      return seeds.length === 5 && seeds.every(function (x) {\n"
    "        return x.price > 0 && x.desc.indexOf('游商') >= 0;\n"
    "      });\n"
    "    })());",
    "    console.log('  --- U4 物品来源文案（v89.224：血清非卖，desc 写明「基因调试」来源） ---');\n"
    "    check('U4（v89.224 重写）：四种血清非卖品且 desc 写明「基因调试」来源', (function () {\n"
    "      var serums = ['yunlingcao', 'xisuizhi', 'hualongshen', 'tianshouguo'].map(function (id) { return DATA.ITEM_BY_ID[id]; });\n"
    "      return serums.every(function (x) {\n"
    "        return x && x.price === 0 && /基因调试/.test(x.desc);\n"
    "      });\n"
    "    })());")

# ---- S8 寄售（seed_fan→songmu） ----
rep(F, "    S100.items.seed_fan = 2;                              /* 可售 */",
    "    S100.items.songmu = 2;                                /* 可售（v89.224：种子退役换松木） */")
rep(F, "    check('C1 清单只含可售且有货（含粗铁/基础菌种，不含药草）',",
    "    check('C1 清单只含可售且有货（含粗铁/松木，不含血清）',")
rep(F, "        && listC.some(function (x) { return x.id === 'seed_fan'; })",
    "        && listC.some(function (x) { return x.id === 'songmu'; })")
rep(F, "    var keepC = G.systems.consignAll({ keep: ['seed_fan'] });", "    var keepC = G.systems.consignAll({ keep: ['songmu'] });")
rep(F,
    "    check('C2 一键寄售（保留 seed_fan）→ 保留项未卖、药草未动、粗铁清空',\n"
    "      keepC.ok === true && S100.items.seed_fan === 2 && S100.items.yunlingcao === 3 && !S100.items.fatie,",
    "    check('C2 一键寄售（保留松木）→ 保留项未卖、血清未动、粗铁清空',\n"
    "      keepC.ok === true && S100.items.songmu === 2 && S100.items.yunlingcao === 3 && !S100.items.fatie,")
rep(F, "    listC.forEach(function (x) { if (x.id !== 'seed_fan') expGoldC += x.total; });",
    "    listC.forEach(function (x) { if (x.id !== 'songmu') expGoldC += x.total; });")
rep(F, "    S100.items.seed_fan = 0;", "    S100.items.songmu = 0;")

# ---- S9 单族类目 ----
rep(F, "    check('⑤ 单族类目（经验/体力/马具/宝箱/种子/徭役）在售 ≤ 4 档', (function () {\n      var S = G.ui.shopItems();\n      var single = ['exp', 'stamina', 'mount_buff', 'chest', 'seed', 'corvee'];",
    "    check('⑤ 单族类目（经验/体力/马具/宝箱/徭役）在售 ≤ 4 档', (function () {\n      var S = G.ui.shopItems();\n      var single = ['exp', 'stamina', 'mount_buff', 'chest', 'corvee'];")

# ---- S10 §220① 重写 ----
rep(F,
    "    /* ① 基因实验室：改名落盘（剥注释零残留）+ 可见文案 */\n"
    "    var name220 = (function () {\n"
    "      var bad = [];\n"
    "      Object.keys(CLEAN220).forEach(function (f) {\n"
    "        if (CLEAN220[f].indexOf('温室农场') >= 0) bad.push(f);\n"
    "      });\n"
    "      return {\n"
    "        bad: bad,\n"
    "        ok: bad.length === 0\n"
    "          && RAW220.ui.indexOf('\\u{1F9EC} 基因实验室') >= 0\n"
    "          && RAW220.systems.indexOf('种子要到基因实验室播种') >= 0\n"
    "          && RAW220.data.indexOf('于基因实验室可培养 6 种材料作物') >= 0\n"
    "          && RAW220.ui.indexOf(\"seed: '种子（基因实验室）'\") >= 0\n"
    "          && RAW220.ui.indexOf(\"hint: '请到基因实验室播种'\") >= 0,\n"
    "      };\n"
    "    })();\n"
    "    check('§220① 改名：剥注释后「温室农场」零残留（js 七文件）· 基因实验室在册（按钮/标题/背包/提示）',\n"
    "      name220.ok === true, '残留=' + name220.bad.join(','));",
    "    /* ① 基因实验室：改名落盘（剥注释零残留）+ 可见文案\n"
    "       v89.224（老板 1/2）重写：实验室入口迁入建筑格；播种/种子断链 —— 判据换新 */\n"
    "    var name220 = (function () {\n"
    "      var bad = [];\n"
    "      Object.keys(CLEAN220).forEach(function (f) {\n"
    "        if (CLEAN220[f].indexOf('温室农场') >= 0) bad.push(f);\n"
    "      });\n"
    "      return {\n"
    "        bad: bad,\n"
    "        ok: bad.length === 0\n"
    "          && RAW220.ui.indexOf('\\u{1F9EC} 基因实验室') >= 0\n"
    "          && RAW220.ui.indexOf('data-action=\"open-lab\"') >= 0\n"
    "          && RAW220.data.indexOf(\"name: '基因实验室'\") >= 0\n"
    "          && CLEAN220.systems.indexOf('播种') < 0\n"
    "          && CLEAN220.domain.indexOf('grantSeedDrop') < 0,\n"
    "      };\n"
    "    })();\n"
    "    check('§220①（v89.224 重写）：温室农场零残留 · 基因实验室在册（建筑格 / 按钮）· 播种链已断',\n"
    "      name220.ok === true, '残留=' + name220.bad.join(','));")

print('[b3] smoke 段完成 %d 处' % len(LOG))
for l in LOG: print('  ' + l)
