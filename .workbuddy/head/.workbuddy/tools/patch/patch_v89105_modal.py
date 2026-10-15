# -*- coding: utf-8 -*-
"""
v89.105 弹窗体系整备（基调统一的第二战场）
============================================================
体检结论（真浏览器 44 个面板实测）：8 处不达标 —— 7 处内容装不下、1 处入口参数缺失。
另有两条"同物两名"的重复定义：

  ① 页脚三套类名 `.m-foot / .modal-foot / .panel-foot`，却分两条规则定义，
     且两条都要 `border-top`（一处 .15、一处 .09，靠"后出现"取胜）→
     改一处漏一处，正是"基调不统一"的典型。
  ② 标题两代：旧式 `.gold-heading`（无分隔线、渐变 .28）与新式 `.m-title`
     （有分隔线、渐变 .25）—— 同一个"弹窗标题"，两副面孔。

本补丁做四件事：
  A. 页脚：三套类名合成**一条**规则（边框取 --line-strong，与 .m-head 对称）
  B. 标题：渐变换成同一令牌；旧式弹窗首行标题补上分隔线与相同节奏
  C. 尺寸档位：按"内容实测高度"重新选档（市场/日志/君主/自动出征/出征/装备）
  D. 门派：六派改两列（517px → 约 260px，才装得进窗）
"""
import io, os, re

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
H = os.path.join(R, 'index.html')
U = os.path.join(R, 'js', 'ui.js')
h = io.open(H, encoding='utf-8').read()
u = io.open(U, encoding='utf-8').read()
log = []
def rep(txt, old, new, tag, once=True):
    global h, u
    assert old in (h if tag.startswith('H') else u) or old in txt, '锚点未命中：' + tag
    if tag.startswith('H'):
        h = h.replace(old, new, 1) if once else h.replace(old, new)
    else:
        u = u.replace(old, new, 1) if once else u.replace(old, new)
    log.append('  ✓ ' + tag)

# ══════════════ A. 页脚三套类名合并 ══════════════
rep(h, """  :is(.m-foot, .modal-foot) {
    flex: none; display: flex; justify-content: center; align-items: center;
    gap: var(--sp-3); flex-wrap: wrap;
    padding-top: var(--sp-4); margin-top: var(--sp-4); border-top: 1px solid var(--line-strong);
  }""",
"""  /* ============================================================
     * v89.105（基调统一）：**弹窗操作栏只有一条定义**。
     * ------------------------------------------------------------
     * 改前：`.m-foot` / `.modal-foot` / `.panel-foot` 是同一个东西的三个历史名字，
     * 却分两条规则写（一处 border .15 / 一处 .09），靠"后出现"取胜 ——
     * 调一处、另一处不动，看着一样、改起来漏。
     * 现在三类名共用这一条：边框取 --line-strong，与 .m-head 上下对称。
     * ============================================================ */
  .m-foot, .modal-foot, .panel-foot {
    flex: none; display: flex; justify-content: center; align-items: center;
    gap: var(--sp-3); flex-wrap: wrap;
    padding-top: var(--sp-4); margin-top: var(--sp-4);
    border-top: 1px solid var(--line-strong);
  }""", 'H-A1 页脚：三套类名合并为一条定义')

# 删掉 L2453 那条旧定义（它是"后出现"的胜出者，内容已被上面的合并版覆盖）
rep(h, """  /* ---- 页脚三套合一：.m-foot / .modal-foot / .panel-foot 同规格 ---- */
  .m-foot, .modal-foot, .panel-foot {
    display: flex; justify-content: center; align-items: center; flex-wrap: wrap;
    gap: var(--sp-3); padding-top: var(--sp-4); margin-top: var(--sp-4);
    border-top: 1px solid var(--line);
  }""",
"""  /* ---- 页脚规格已收进上文「弹窗操作栏只有一条定义」（v89.105） ---- */""",
    'H-A2 页脚：删掉重复的第二条定义（那条靠"后出现"覆盖了 .15 边线）')

# ══════════════ B. 标题两代合一 ══════════════
rep(h, """  .m-title { display: block; text-align: center; font-size: var(--fs-h2); font-weight: 800;
    color: var(--gold-light); letter-spacing: 1px;
    padding: var(--sp-1) 0;
    background: linear-gradient(90deg, transparent, rgba(var(--gold-rgb),.25), transparent); }""",
"""  .m-title { display: block; text-align: center;
    padding: var(--sp-1) 0;
    /* v89.105：渐变底色与旧式标题**同一令牌**（改前一处 .28、一处 .25 —— 同物两名） */
    background: linear-gradient(90deg, transparent, var(--sep-gold), transparent); }""",
    'H-B1 新式标题：渐变换回 --sep-gold（与旧式同源）')

rep(h, """  /* v82（老板）：「城市名称居中，字体稍大即可」—— 官府面板的城名行""",
"""  /* ============================================================
     * v89.105：**两代弹窗标题，一副面孔**。
     * ------------------------------------------------------------
     * 旧式弹窗（80 处）用 `.gold-heading` 打头、新式弹窗（38 处）走 `.m-head > .m-title`。
     * 字号/字重/字色/字距早有共享规则，但**差一条分隔线与一段节奏**：
     *   新式：标题 → 4px → 10px → ─── → 10px → 正文（共 25px）
     *   旧式：标题 → 10px → 正文            （共 10px，且没有线）
     * 于是"同样是弹窗标题，一个有线一个没有，正文起步位置差 15px"。
     * 补法：只在**弹窗内、且是第一个子元素**时补线补距（分区标题不受影响）。
     * ============================================================ */
  .modal .inner-panel > .gold-heading:first-child,
  .modal .inner-shell > .gold-heading:first-child {
    padding: var(--sp-1) 0 var(--sp-5);          /* 4 + 10（与 .m-head 的层叠等价） */
    border-bottom: 1px solid var(--line-strong);
    margin-bottom: var(--sp-4);
  }
  /* v82（老板）：「城市名称居中，字体稍大即可」—— 官府面板的城名行""",
    'H-B2 旧式标题：补分隔线与相同节奏（仅弹窗首行）')

# ══════════════ C. 尺寸档位（按实测内容高度重新选档） ══════════════
rep(h, "", "", 'H-C 占位（尺寸改动在 ui.js）')
log.pop()
rep(u, """      '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      'lg'
    );""",
"""      '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.105：内容实测 786px（两段表格纵向叠放）—— lg(600) 装不下、xl(700) 差 90、
         xxl(800) 才容得下。选档依据写在 docs/v89105，改内容时**重新量**再选档。 */
      'xxl'
    );""", 'U-C1 市场：lg → xxl（实测内容 786px）')

rep(u, """  ui.openJournal = function""", """  ui.openJournal = function""", 'U-C2 占位')
log.pop()
# 日志：openModal(ui.journalHTML()) → 加档
rep(u, """    ui.openModal(ui.journalHTML());""",
    """    /* v89.105：见闻/日志三段网格实测 774px —— 默认档(620)装不下，xxl(800) 才够 */
    ui.openModal(ui.journalHTML(), { size: 'xxl' });""", 'U-C2 见闻/日志：默认档 → xxl（实测 774px）')

# 君主：xl → xxl
rep(u, """      size: 'xl',
      body: '<div class="lord-split">' +""", """      size: 'xxl',      /* v89.105：实测 690px —— xl(700) 只差 10px，但正文会冒滚动条；升一档 */
      body: '<div class="lord-split">' +""", 'U-C3 君主：xl → xxl')

# 自动出征配置 + 出征：两处 `ui.openModal(html, { size: 'xl' })` → xxl
#   （按**行内确切文本**定位：两处的字面完全相同，各自所属函数已核实 ——
#    L9814 属 openExpModal、L12009 属 openAutoMarch）
cnt = u.count("ui.openModal(html, { size: 'xl' });")
assert cnt == 2, 'xl 弹出点应为 2 处，实为 %d' % cnt
u = u.replace("ui.openModal(html, { size: 'xl' });",
              "ui.openModal(html, { size: 'xxl' });   /* v89.105：内容实测超 xl（出征 711 / 自动出征 815） */")
log.append('  ✓ U-C4 出征 + 自动出征配置：xl → xxl（两处）')

# 装备（openPanel）：加可选尺寸，装备面板单独降到 xl
rep(u, """  ui.openPanel = function (view, title) {""",
    """  ui.openPanel = function (view, title, size) {""", 'U-C6a openPanel 增加尺寸参数')
rep(u, """    ui.openModal(
      '<div class="gold-heading">' + (title || box[view] || view) + '</div>' +
      '<div class="panel-body">' + body + '</div>' +
      '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    );""",
"""    ui.openModal(
      '<div class="gold-heading">' + (title || box[view] || view) + '</div>' +
      '<div class="panel-body">' + body + '</div>' +
      '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.105：`.panel-body` 有 558px 硬上限，默认档(620→正文 603)里
         34(标题) + 558 + 47(操作栏) = 639 > 603 → 必然冒滚动条。
         加一个可选尺寸参数，让"内容确实高"的面板（装备 12 格 + 说明）走 xl。 */
      size ? { size: size } : null
    );""", 'U-C6b openPanel：按需传入尺寸档')
rep(u, """  ui.openEquipPanel = function () { ui.openPanel('equip'); };""",
    """  ui.openEquipPanel = function () { ui.openPanel('equip', null, 'xl'); };   /* v89.105：实测 675px */""",
    'U-C7 装备面板：走 xl')

# ══════════════ D. 门派：六派两列 ══════════════
rep(u, """      html += '<div class="op-zone"><div class="op-zone-t">江湖六派 · 择一入派</div>';
      S.forEach(function (x) {
        html += '<div class="op-row" style="display:block;">' +""",
"""      /* v89.105（老板「内容紧凑有序」）：六派此前纵向各占一行（实测 517px），
         加上"开山立派"一节共 703px —— 默认档(620)装不下、必冒滚动条。
         改**两列网格**：六派 → 三行，517 → 约 260px，一眼看全，也更好比。 */
      html += '<div class="op-zone"><div class="op-zone-t">江湖六派 · 择一入派</div>' +
        '<div class="sect-grid">';
      S.forEach(function (x) {
        html += '<div class="op-row sect-card">' +""", 'U-D1 门派：六派改两列网格')
rep(u, """          '</div>';
      });
      html += '</div>';
      html += '<div class="op-zone"><div class="op-zone-t">开山立派</div>' +""",
"""          '</div>';
      });
      html += '</div></div>';
      html += '<div class="op-zone"><div class="op-zone-t">开山立派</div>' +""", 'U-D2 门派：网格收口')

# 门派两列的样式 + op-row 在卡片里的排布
rep(h, """  /* ---- 设置项卡片（5 处重复的 inline 写法抽成一处）---- */""",
"""  /* ---- 门派六派：两列卡片（v89.105）----
     卡片内是"名称 + 被动 + 入派键"三段，纵向排；grid 让六派三行铺满。 */
  .sect-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); }
  .sect-grid .sect-card { display: block; padding: var(--sp-3) var(--sp-4); }
  .sect-grid .sect-card .op-hint { margin: var(--sp-1) 0 var(--sp-3); }
  .sect-grid .sect-card .btn { width: 100%; }

  /* ---- 设置项卡片（5 处重复的 inline 写法抽成一处）---- */""",
    'H-D3 门派：两列卡片样式')

io.open(H, 'w', encoding='utf-8', newline='').write(h)
io.open(U, 'w', encoding='utf-8', newline='').write(u)
print('===== v89.105 弹窗体系整备 =====')
print('\n'.join(log))
print('  index.html 花括号 %d/%d' % (h.count('{'), h.count('}')))
