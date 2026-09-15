# -*- coding: utf-8 -*-
"""v74 收尾修复：rankOf 补发路径 / 创建界面固定画布 / vh 换算 / 注释校准 / 测试口径收口"""
import io, sys, os

ROOT = r'E:\Deepseekdb'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    total = t.count('\n')
    crlf = t.count('\r\n') > (total - t.count('\r\n'))

    def to_dom(s):
        return s.replace('\n', '\r\n') if crlf else s.replace('\r\n', '\n')

    def to_alt(s):
        return s.replace('\r\n', '\n') if crlf else s.replace('\n', '\r\n')

    pairs = [(to_dom(old), to_dom(new))]
    if to_alt(old) != to_dom(old):
        pairs.append((to_alt(old), to_alt(new)))
    for o2, n2 in pairs:
        if n2 in t:
            print('  · %s：已改过（跳过）' % tag)
            return
    hit = [(o, n) for o, n in pairs if t.count(o) == 1]
    if not hit:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(pairs[0][0])))
        sys.exit(1)
    o2, n2 = hit[0]
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(o2, n2, 1))
    print('  ✓ %s' % tag)


ST = os.path.join(ROOT, 'js', 'state.js')
HTML = os.path.join(ROOT, 'index.html')
SMOKE = os.path.join(ROOT, 'smoke-test.js')
E2E = os.path.join(ROOT, 'e2e-test.js')

print('========== F1：rankOf 补发走到"提前返回"路径（真 bug） ==========')
patch(
    ST,
    """  GAME.rankOf = function (g) {
    if (!g) return DATA.GEN_RANKS[0];
    if (g.rank && DATA.GEN_RANK_BY_ID[g.rank]) return DATA.GEN_RANK_BY_ID[g.rank];""",
    """  GAME.rankOf = function (g) {
    if (!g) return DATA.GEN_RANKS[0];
    if (g.rank && DATA.GEN_RANK_BY_ID[g.rank]) {
      /* v74：自由属性点的懒初始化必须**两条路径都走到** ——
         makeGeneral 一造出来就写好 rank，走的是这条提前返回；
         漏了这里，所有"旧档/已生成"的将领永远拿不到补发。 */
      var rkE = DATA.GEN_RANK_BY_ID[g.rank];
      if (g.freePts == null) {
        g.freePts = Math.max(0, ((g.level || 1) - 1)) * (rkE.grow || 1);
      }
      return rkE;
    }""",
    'F1a rankOf 提前返回补发',
)

print()
print('========== F2：创建界面固定画布 + vh 换算 + 注释校准 ==========')
patch(
    HTML,
    """  .create-screen {
    /* v70：归属选项从 4 枚变 14 枚（十三州）后创建框会变高 ——
       居中改用子元素的 `margin: auto`（`align-items: center` 在内容高过视口时
       会把顶部裁掉），盒子超高时页面可滚动、不裁内容。 */
    min-height: 100vh; display: flex; justify-content: center; padding: 20px;
  }
  .create-box {
    width: 680px; max-width: 96vw; padding: 22px; margin: auto;
  }""",
    """  /* v74（老板需求 2）：创建界面同走**固定像素画布**（窗口怎么推都不动）；
     内容超高时画布内部滚动（不裁、不重排）。
     v70 的 `margin: auto` 居中法保留（内容高过画布时不会裁顶）。 */
  .create-screen {
    width: var(--app-w); height: var(--app-h); margin: 0 auto;
    display: flex; justify-content: center; padding: 20px; overflow: auto;
  }
  .create-box {
    width: 680px; max-width: 100%; padding: 22px; margin: auto;
  }""",
    'F2a 创建界面固定画布',
)
patch(
    HTML,
    """  .inn-list { max-height: 46vh; overflow-y: auto; padding-right: 4px; }""",
    """  /* v74：46vh → 414px（= 900 画布的 46%）—— 内部滚动的上限不再随窗口高度浮动 */
  .inn-list { max-height: 414px; overflow-y: auto; padding-right: 4px; }""",
    'F2b inn-list vh→px',
)
patch(
    HTML,
    """  .panel-body { max-height: 62vh; overflow-y: auto; margin: 0 -4px; }""",
    """  .panel-body { max-height: 558px; overflow-y: auto; margin: 0 -4px; }""",
    'F2c panel-body vh→px',
)
patch(
    HTML,
    """  .exp-body { max-height: 40vh; overflow-y: auto; padding-right: 4px; }""",
    """  .exp-body { max-height: 360px; overflow-y: auto; padding-right: 4px; }""",
    'F2d exp-body vh→px',
)
patch(
    HTML,
    """  .modal-scroll { max-height: 46vh; overflow-y: auto; padding-right: 4px; }""",
    """  .modal-scroll { max-height: 414px; overflow-y: auto; padding-right: 4px; }""",
    'F2e modal-scroll vh→px',
)
patch(
    HTML,
    """     仅保留一道**极小窗口兜底**（100vw/vh − 20px）：窗口比画布还小时不至于被裁到够不着。
     原先的「视口不足自动降档」@media (max-height: 860px) 一并撤除。 */""",
    """     仅保留一道**极小窗口兜底**（100vw/vh − 20px）：窗口比画布还小时不至于被裁到够不着。
     原先的"视口不足自动降档"（h≤860 的媒体查询）一并撤除。 */""",
    'F2f 注释去 860 字面量',
)
patch(
    HTML,
    """  /* v51：**xl 目前只有铁匠铺打造面板在用**（全站唯一），所以它的尺寸可以按打造面板的需要定。
     老板要「稍微放大一点」——它现在装的是"3 列 × 2 行物品行 + 分页条"，
     而卡片实测高 170px：2 行要 340px，加上筛选条(24)、分页条(46)、间隙(24) 共 434px 正文。
     改前它只有 660px 高（矮屏还被降到 78vh = 599），正文只剩 432px —— **差 2px 就装不下两行**。
     现在 700px，并用 `min()` 留出矮屏余量：768 高的屏给 88vh = 676，正文约 509。
     `max-height: 90vh` 保留 ——「不超出视口」是硬约束，不能因为要看更多行就破。 */
  /* v74：xl 也改固定 960×700（画布 1440×900 内稳装）；兜底同 md/lg */""",
    """  /* xl（打造面板等）：960×700 定死 —— 卡片实测高 170px，2 行 340 + 筛选/分页/间隙 434，
     700 高的弹窗正文约 530，两行稳装。
     v51 曾按"矮屏 min(700px, 88vh)"折衷；v74 画布固定后不再随视口缩（兜底同 md/lg）。 */""",
    'F2g xl 注释校准',
)

print()
print('========== F3：smoke 口径收口 ==========')
patch(
    SMOKE,
    """  check('弹窗提到 xl，正文高度固定够放两行卡片（v74：700px 定死）', (function () {
    var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    return /size: 'xl'/.test(fnBody(uS38, 'ui.openForge = function'))
      && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(h)
      && /height: 700px/.test(h)
      /* v74：860 降档已撤 —— 画布固定后矮屏不再改弹窗高度（正文 700−帧高仍是短屏最优解） */
      && !/@media \\(max-height: 860px\\)/.test(h);
  })());""",
    """  check('弹窗提到 xl，正文高度固定够放两行卡片（v74：700px 定死）', (function () {
    /* ⚠️ 剥注释再断（本项目第 N 次被自己的说明注释骗过）：注释里会引用被撤规则的原文 */
    var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8')
      .replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /size: 'xl'/.test(fnBody(uS38, 'ui.openForge = function'))
      && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(h)
      && /height: 700px/.test(h)
      /* v74：860 降档已撤 —— 画布固定后矮屏不再改弹窗高度（正文 700−帧高仍是短屏最优解） */
      && !/@media \\(max-height: 860px\\)/.test(h);
  })());""",
    'F3a 剥注释再断',
)
patch(
    SMOKE,
    """  check('③ 简介两行化：名字在前 + 资质★（悬停 = 上限/成长）+ 类型 + 描述（去上限句）', (function () {
    var i = h74.indexOf('class="gp-name"');
    if (i < 0) return false;
    var seg = h74.slice(i, i + 1200);
    return /class="gp-name">[^<]/.test(seg)
      && /rank-badge r-\\w+" title="等级上限 \\d+，每级属性成长 \\+\\d+"/.test(seg)
      && /class="gp-style">/.test(seg)
      && /class="gp-sub">[^<]*(可|之才|之资)/.test(seg);
  })());
  check('③ 旧行已撤：Lv N / M 行、装备 n/12、每级成长小字（改为悬停）',
    !/Lv\\d+ \\/ \\d+　·/.test(h74) && !/装备 \\d+\\/12/.test(h74)
      && h74.indexOf('　每级成长 <b>') < 0);
  check('③ Lv 挪进经验行', /Lv<b>\\d+<\\/b>　经验/.test(h74));""",
    """  /* ⚠️ 断言只看**档案段**（gen-pane）—— 左清单行的悬停 tip 里仍有"装备 x/12"，
     它是 v45 明令保留的悬停细节，不是简介的一部分。 */
  var hpane74 = h74.slice(h74.indexOf('class="gen-pane"'));
  check('③ 简介两行化：名字在前 + 资质★（悬停 = 上限/成长）+ 类型 + 描述（去上限句）', (function () {
    var i = hpane74.indexOf('class="gp-name"');
    if (i < 0) return false;
    var seg = hpane74.slice(i, i + 1200);
    return /class="gp-name">[^<]/.test(seg)
      && /rank-badge r-\\w+" title="等级上限 \\d+，每级属性成长 \\+\\d+"/.test(seg)
      && /class="gp-style">/.test(seg)
      && /class="gp-sub">[^<]*(可|之才|之资)/.test(seg);
  })());
  check('③ 旧行已撤：Lv N / M 行、装备 n/12、每级成长小字（改为悬停）',
    !/Lv\\d+ \\/ \\d+　·/.test(hpane74) && !/装备 \\d+\\/12/.test(hpane74)
      && hpane74.indexOf('　每级成长 <b>') < 0);
  check('③ Lv 挪进经验行', /Lv<b>\\d+<\\/b>　经验/.test(hpane74));""",
    'F3b ③ 限定档案段',
)

print()
print('========== F4：e2e 六维表口径 ==========')
patch(
    E2E,
    """      check('六维表只有 数值/作用 两列（无「装备/丹」、无「合计」）', (function () {
        const head = document.querySelector('#view-container .gd-dims thead');
        if (!head) return false;
        const ths = Array.prototype.map.call(head.querySelectorAll('th'), (x) => x.textContent.trim());
        /* v65：表头「作用（每点）」→「每点作用」（少两字，给"六维"列腾宽度） */
        return ths.length === 3 && ths[1] === '数值' && ths[2] === '每点作用'
          && head.textContent.indexOf('装备/丹') < 0 && head.textContent.indexOf('合计') < 0;
      })());
      check('第五维是速度、第六维是体力（v29 需求 11）', (function () {
        const rows = document.querySelectorAll('#view-container .gd-dims tbody tr');
        if (rows.length !== 6) return false;
        /* v65：作用文案压成短句（老板说作用列太长把属性名挤折行了） */
        return rows[4].textContent.indexOf('速度') >= 0
          && rows[4].textContent.indexOf('全军速度 +1') >= 0
          && rows[5].textContent.indexOf('体力') >= 0;
      })());""",
    """      check('六维表只有 数值/加点 两列（作用文案已进名称悬停；无「装备/丹」「合计」）', (function () {
        const head = document.querySelector('#view-container .gd-dims thead');
        if (!head) return false;
        const ths = Array.prototype.map.call(head.querySelectorAll('th'), (x) => x.textContent.trim());
        /* v74：作用列 → 加点列（每点作用改为六维名称的悬停备注） */
        return ths.length === 3 && ths[1] === '数值' && ths[2] === '加点'
          && head.textContent.indexOf('装备/丹') < 0 && head.textContent.indexOf('合计') < 0;
      })());
      check('第五维是速度、第六维是体力；末行是自由属性点（v74）', (function () {
        const rows = document.querySelectorAll('#view-container .gd-dims tbody tr');
        if (rows.length !== 7) return false;              /* 六维 + 自由属性点行 */
        return rows[4].textContent.indexOf('速度') >= 0
          && rows[5].textContent.indexOf('体力') >= 0
          && rows[6].textContent.indexOf('自由属性点') >= 0
          && !!rows[4].querySelector('[data-action="gen-stat-plus"]');
      })());""",
    'F4a e2e 六维表（v26 段）',
)
patch(
    E2E,
    """  check('六维表 6 行、3 列（属性/数值/作用）', (function () {
    const rows = gd26.querySelectorAll('.gd-dims tbody tr');
    const ths = gd26.querySelectorAll('.gd-dims thead th');
    return rows.length === 6 && ths.length === 3;
  })());""",
    """  check('六维表 7 行（六维 + 自由属性点）、3 列（属性/数值/加点）', (function () {
    const rows = gd26.querySelectorAll('.gd-dims tbody tr');
    const ths = gd26.querySelectorAll('.gd-dims thead th');
    return rows.length === 7 && ths.length === 3;
  })());""",
    'F4b e2e 六维表（v26 第二处）',
)

print()
print('========== 收尾修复完成 ==========')
