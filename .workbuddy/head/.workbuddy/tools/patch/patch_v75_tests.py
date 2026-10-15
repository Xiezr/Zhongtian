# -*- coding: utf-8 -*-
"""v75 · 客栈招募界面 —— 测试补丁（e2e 两处翻转 + smoke 新增第 61 节）

e2e-①  第 20 节客栈块：成长备注改悬停 / 无概率表 / 单行版式
e2e-②  v67 区块内的「客栈概率表」块 → 重做为 v75 版（xxl 档 + 全量渲染 + 无一览）
smoke  新增第 61 节：xxl 档 / 单行版式 / 悬停成长 / 美人标与一览退役
"""
import io, sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E = r'E:\Deepseekdb\e2e-test.js'


def patch(path, old, new, tag):
    # 幂等：new（或其 CRLF 变体）已在文件里 → 跳过
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t or new.replace('\n', '\r\n') in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    cands = []
    if old in t:
        cands.append((old, new))
    else:
        old_c, new_c = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
        if old_c in t:
            cands.append((old_c, new_c))
    if not cands:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    old2, new2 = cands[0]
    c = t.count(old2)
    if c != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, c))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


# ============================================================
# E1 · 第 20 节：客栈块（成长备注改悬停 / 无概率表 / 单行）
# ============================================================
patch(
    E2E,
    """  /* ① 客栈：资质徽章 + 概率表 */
  G.ui.openInn();
  await sleep(70);
  const inn20 = document.querySelector('#modal-root').innerHTML;
  check('客栈面板渲染', inn20.length > 400, inn20.length + ' 字符');
  check('候选显示资质徽章', /class="rank-badge r-/.test(inn20));
  check('候选显示每级成长', inn20.indexOf('成长 +') >= 0);
  check('客栈含资质概率表', inn20.indexOf('rk-box') >= 0);
  check('概率表列出五档资质', ['凡品', '良材', '英杰', '名世', '天授'].every((x) => inn20.indexOf(x) >= 0));
  check('概率表标注成长差异', inn20.indexOf('成长 +8/级') >= 0);
  G.ui.closeModal();""",
    """  /* ① 客栈（v75 改版）：资质徽章 + 悬停成长备注 + 单行候选 + 无概率表（老板） */
  G.ui.openInn();
  await sleep(70);
  const inn20 = document.querySelector('#modal-root').innerHTML;
  check('客栈面板渲染', inn20.length > 400, inn20.length + ' 字符');
  check('候选显示资质徽章', /class="rank-badge r-/.test(inn20));
  check('v75：成长备注不再写行内（收进徽章悬停）',
    inn20.indexOf('｜成长 +') < 0 && /rank-badge r-\\w+" title="[^"]*每级属性成长 \\+/.test(inn20));
  check('v75：不再显示资质一览（四维/成长/概率全撤）',
    inn20.indexOf('rk-box') < 0 && inn20.indexOf('四维 ') < 0);
  check('v75：候选单行版式（动作横排 inn-act）', /class="inn-act"/.test(inn20));
  G.ui.closeModal();""",
    'E1 第20节客栈块',
)

# ============================================================
# E2 · v67 区块：客栈概率表块 → v75 大界面块
# ============================================================
patch(
    E2E,
    """  /* ④ 客栈面板显示的资质概率 = 权重表现算值（天授应显著更稀有） */
  await (async function () {
    G.ui.openInn();
    await sleep(60);
    const box = document.querySelector('#modal-root .rk-box');
    const txt = box ? box.textContent : '';
    const lv = G.buildingLevel(G.currentCity(), 'kezhan') || 1;
    const ws = G.rankWeights(lv);
    let t = 0, v = 0;
    ws.forEach(function (x) { t += x.w; if (x.rank.id === 'tian') v = x.w; });
    const pct = v / t * 100;
    const shown = (pct >= 1 ? pct.toFixed(1) : pct.toFixed(2)) + '%';
    check('客栈面板的天授概率 = 权重表现算值，且已降到 1% 以下',
      txt.indexOf('天授') >= 0 && txt.indexOf(shown) >= 0 && pct < 1,
      '客栈 Lv' + lv + ' 天授 ' + shown);
    check('客栈面板仍列出全部五档资质（低资质没被删掉）',
      ['凡品', '良材', '英杰', '名世', '天授'].every(function (n) { return txt.indexOf(n) >= 0; }));
    G.ui.closeModal();
  })();""",
    """  /* ④ v75（老板）：客栈改大界面 —— 全量渲染 / 无资质一览 / 无美人标 /
        天授权重口径没动（只是不再展示；数值口径由 smoke 兜底） */
  await (async function () {
    const c75 = G.currentCity();
    const put75 = (id, lv) => {
      const ex = c75.cells.find((c) => c.build && c.build.id === id);
      if (ex) { ex.build.lvl = lv; return true; }
      const i = c75.cells.findIndex((c) => !c.build && !c.official);
      if (i < 0) return false;
      c75.cells[i].build = { id: id, lvl: lv };
      return true;
    };
    put75('kezhan', 12);
    G.innRefresh(true);
    G.ui.openInn();
    await sleep(80);
    const root75 = document.querySelector('#modal-root');
    const modal75 = root75.querySelector('.modal');
    const cards75 = root75.querySelectorAll('.inn-card');
    const cls75 = modal75 ? modal75.className : '';
    const slots75 = G.innSlots() || 0;
    check('v75：客栈升为最大尺寸档 xxl（大界面）', cls75.indexOf('modal-xxl') >= 0, cls75);
    check('v75：候选全量渲染（' + slots75 + ' 位），一人一行',
      cards75.length === slots75 && slots75 >= 12, cards75.length + ' / ' + slots75);
    check('v75：不再显示资质一览（无 rk-box / 无「四维 」）',
      root75.innerHTML.indexOf('rk-box') < 0 && root75.innerHTML.indexOf('四维 ') < 0);
    check('v75：不再有美人标；资质悬停含成长备注',
      root75.innerHTML.indexOf('tag-beauty') < 0
        && /rank-badge r-\\w+" title="[^"]*每级属性成长 \\+/.test(root75.innerHTML));
    const lv75 = G.buildingLevel(G.currentCity(), 'kezhan') || 1;
    const ws75 = G.rankWeights(lv75);
    let t75 = 0, v75 = 0;
    ws75.forEach(function (x) { t75 += x.w; if (x.rank.id === 'tian') v75 = x.w; });
    const pct75 = v75 / t75 * 100;
    check('v75：天授权重口径没动（仍 <1%，只是不再展示）', pct75 < 1, '天授 ' + pct75.toFixed(2) + '%');
    G.ui.closeModal();
  })();""",
    'E2 客栈概率表块→v75',
)

# ============================================================
# S1 · smoke 新增第 61 节
# ============================================================
patch(
    SMOKE,
    """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
    """/* ============================================================
 * ===== 61. v75：客栈招募界面（老板）—— 大界面 / 单行 / 悬停 / 无概率表 =====
 * ============================================================ */
console.log('\\n===== 61. v75 客栈招募（大界面 · 单行候选 · 资质悬停 · 无概率表） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uS1 = stripComment(rd('ui'));
  var hS1 = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var inn1 = codeOf(uS1, 'ui.openInn = function');

  /* ---------- ① 大界面（新尺寸档 xxl + 三段式） ---------- */
  check('① 新增 xxl 尺寸档（980×800 固定 px + 极小窗口兜底）', (function () {
    var b = cssBlock(hS1, '.modal-xxl {');
    return /width: 980px; height: 800px/.test(b) && /max-width: calc\\(100vw - 20px\\)/.test(b);
  })(), cssBlock(hS1, '.modal-xxl {').replace(/\\s+/g, ' ').slice(0, 72));
  check('① 客栈走三段式 + xxl 档（标题/按钮固定，只有候选区滚动）',
    /ui\\.openShell\\(\\{/.test(inn1) && /size: 'xxl'/.test(inn1));

  /* ---------- ②③ 单行候选 + 成长备注进悬停 ---------- */
  check('② 候选行单行化：行内不再有「｜成长 +」备注', uS1.indexOf('｜成长 +') < 0);
  check('③ 资质徽章悬停带成长（rankBadge 唯一出口）',
    /每级属性成长 \\+' \\+ rk\\.grow/.test(uS1));
  var rb1 = G.ui.rankBadge({ rank: 'liang' });
  var rb2 = G.ui.rankBadge({ rank: 'tian' });
  check('③ 运行时验证：徽章 title = 资质描述 + 每级属性成长（良材 +2 / 天授 +8）',
    /每级属性成长 \\+2。/.test(rb1) && /每级属性成长 \\+8。/.test(rb2),
    (rb1.match(/title="[^"]*"/) || ['无'])[0]);

  /* ---------- ④ 美人标 / 资质一览退役 ---------- */
  check('④ 美人标退役（tag-beauty 无产出、无样式）',
    uS1.indexOf('tag-beauty') < 0 && !/\\.tag-beauty \\{/.test(hS1));
  check('④ 资质一览退役（rankTable / rk-box 全清）',
    !/ui\\.rankTable/.test(uS1) && !/\\.rk-box \\{/.test(hS1) && inn1.indexOf('rk-box') < 0);

  /* ---------- ⑤ 单行版式（CSS） ---------- */
  check('⑤ 版式：动作横排 + 名字/数值不换行 + 列表不再自带滚动', (function () {
    var act = cssBlock(hS1, '.inn-act {');
    var nm = cssBlock(hS1, '.inn-name {');
    var at = cssBlock(hS1, '.inn-attrs {');
    var ls = cssBlock(hS1, '.inn-list {');
    return /display: flex/.test(act) && /white-space: nowrap/.test(nm)
      && /text-overflow: ellipsis/.test(at) && !/max-height/.test(ls);
  })());
  check('⑤ 头像列 30px（两处规则一致）',
    /width: 30px/.test(cssBlock(hS1, '.inn-avatar {'))
      && /width: 30px/.test(cssBlock(hS1, '.inn-avatar { width: 30px;')));
})();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
    'S1 smoke 第61节',
)

print('\n测试补丁落盘完成。')
