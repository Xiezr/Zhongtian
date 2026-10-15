# -*- coding: utf-8 -*-
# v89.158 补丁 C：ui.js —— 悬停保护出口 + 9 处接入 + 容量账目三处显示
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

def rep(tag, old, new, guard=None):
    """替换一段并立即落盘（分段落盘 · §57.3）；guard=幂等特征（已落则跳过）。"""
    global s
    if guard and guard in s:
        done.append(tag + ' skip')
        return
    c = s.count(old)
    assert c == 1, tag + ' anchor count=' + str(c)
    s = s.replace(old, new)
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    done.append(tag + ' OK')

# ---------- C1：hoverHold 唯一出口（插在 TIP_ID 之前） ----------
rep('C1 hoverHold',
u"""  ui.TIP_ID = 'tip-layer';""",
u"""  /* ============================================================
   * v89.158（老板 2）：**悬停保护**（唯一出口）——
   *   鼠标悬停在该容器内时，本秒的"周期性重绘"让位（整块跳过），
   *   悬停期间保持"悬停那一刻"的数据呈现（老板口径：无需刷新悬停信息）。
   * ------------------------------------------------------------
   * 病根：主循环每秒用 innerHTML 重建侧栏/公文/弹窗 → 鼠标下的节点被替换 →
   *   ① 原生 title 提示与 #tip-layer 浮层因节点消失而收起
   *      （鼠标不动时浏览器不会再触发 mouseover）→ 视觉"闪烁"（实测复现）；
   *   ② CSS :hover 高亮同秒重置。
   * 口径：只有**周期性重绘**（主循环置 ui._tickPaint）让位；
   *   操作驱动的重绘（点"+"用宝物 → refreshAll）永远放行 ——
   *   否则"操作后的界面刷新"会被悬停挡住（点了 1 秒后才更新）。
   * 桩环境（jsdom 无 :hover 支持）→ 返回 false = 不保护（行为与旧版一致）；
   *   测试用 ui._hoverOf 注入悬停节点。
   * ⚠️ 取 :hover 链的**最深**元素必须用 querySelectorAll 取**最后一个** ——
   *   querySelector(':hover') 返回文档序第一个（html），永远判不中（本函数第一版就这么错）。
   * ============================================================ */
  ui._tickPaint = false;          /* 主循环每秒置 true（窗口内的重绘属"周期性"） */
  ui._hoverOf = null;             /* 测试注入点：返回悬停节点（桩环境用） */
  ui.hoverHold = function (sel) {
    if (!ui._tickPaint) return false;
    var box = null;
    try {
      box = (typeof sel === 'string')
        ? ((document.querySelector && document.querySelector(sel)) || null) : sel;
    } catch (e) { box = null; }
    if (!box || !box.contains) return false;
    var hv = null;
    try {
      if (ui._hoverOf) hv = ui._hoverOf();
      else if (document.querySelectorAll) {
        var all = document.querySelectorAll(':hover');
        hv = (all && all.length) ? all[all.length - 1] : null;
      }
    } catch (e2) { hv = null; }
    return !!(hv && box.contains(hv));
  };

  ui.TIP_ID = 'tip-layer';""",
guard=u'ui.hoverHold = function')

# ---------- C2：renderResBar 保护 ----------
rep('C2 resBar',
u"""  ui.renderResBar = function (c, s) {
    var box = $('#res-bar');
    if (!box) return;""",
u"""  ui.renderResBar = function (c, s) {
    var box = $('#res-bar');
    if (!box) return;
    /* v89.158（老板 2）：悬停保护 —— 鼠标在资源栏内时本秒不重绘
       （否则每秒重建会把悬停的 .amt / .rate-wrap 节点换掉 → 容量悬停闪烁）。 */
    if (ui.hoverHold(box)) return;""",
guard=u"if (ui.hoverHold(box)) return;\n    var prodAll")

# ---------- C3：renderGarrison 保护 ----------
rep('C3 garrison',
u"""  ui.renderGarrison = function (c, s) {
    var el = $('#garrison-bar');
    if (!el || !c) return;""",
u"""  ui.renderGarrison = function (c, s) {
    var el = $('#garrison-bar');
    if (!el || !c) return;
    if (ui.hoverHold(el)) return;      /* v89.158：悬停保护（同资源栏） */""",
guard=u"if (ui.hoverHold(el)) return;      /* v89.158：悬停保护（同资源栏） */")

# ---------- C4：renderCityAttrs 保护 ----------
rep('C4 cityAttrs',
u"""  ui.renderCityAttrs = function (c, s) {
    var box = $('#city-attrs');
    if (!box) return;""",
u"""  ui.renderCityAttrs = function (c, s) {
    var box = $('#city-attrs');
    if (!box) return;
    /* v89.158：悬停保护 —— 城池下拉/🎲📍 按钮/属性行的悬停态不被每秒重绘打断 */
    if (ui.hoverHold(box)) return;""",
guard=u"if (ui.hoverHold(box)) return;\n    var maxPop")

# ---------- C5：renderWildPick 保护 ----------
rep('C5 wildPick',
u"""  ui.renderWildPick = function (c, s) {
    var box = $('#wild-pick-host');
    if (!box) return;""",
u"""  ui.renderWildPick = function (c, s) {
    var box = $('#wild-pick-host');
    if (!box) return;
    if (ui.hoverHold(box)) return;     /* v89.158：悬停保护（下拉展开/悬停期间不重绘） */""",
guard=u"if (ui.hoverHold(box)) return;     /* v89.158：悬停保护（下拉展开/悬停期间不重绘） */")

# ---------- C6：renderLog 保护 ----------
rep('C6 renderLog',
u"""  ui.renderLog = function () {
    var el = $('#doc-body');
    if (!el) return;                     // 仅在公文档可见时刷新""",
u"""  ui.renderLog = function () {
    var el = $('#doc-body');
    if (!el) return;                     // 仅在公文档可见时刷新
    if (ui.hoverHold(el)) return;        /* v89.158：悬停保护（消息行/按钮的悬停不被打断） */""",
guard=u"if (ui.hoverHold(el)) return;        /* v89.158")

# ---------- C7：liveModalTick 保护 ----------
rep('C7 liveTick',
u"""    try {
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) return;
    } catch (e0) { /* 桩环境无 activeElement：继续 */ }""",
u"""    try {
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) return;
    } catch (e0) { /* 桩环境无 activeElement：继续 */ }
    /* v89.158（老板 2）：悬停弹窗内 → 本秒不重绘（保持"悬停那一刻"的数据；
       否则每秒重建会把悬停的物品/按钮节点换掉，浮层与悬停态闪烁）。 */
    if (ui.hoverHold('#modal-root')) return;""",
guard=u"if (ui.hoverHold('#modal-root')) return;")

# ---------- C8：syncHeader 头像守卫 ----------
rep('C8 avatar',
u"""      av.innerHTML = GAME.portraits.html(rulerGen, 68);
    }""",
u"""      /* v89.158：内容不变不重建（每秒重建会让悬停态/子节点被打断） */
      var _avSig = (s.ruler.name || '') + '|' + (s.ruler.gender || '') + '|' + (s.ruler.portraitSeed || '');
      if (av._sig !== _avSig) { av._sig = _avSig; av.innerHTML = GAME.portraits.html(rulerGen, 68); }
    }""",
guard=u"var _avSig = (s.ruler.name")

# ---------- C9：syncHeader 天时守卫 ----------
rep('C9 sky',
u"""      sky.innerHTML = '<span class="ns-k">天时</span>' + U.escape(line || '—');
    }""",
u"""      /* v89.158：内容不变不重建（同头像 —— 内容变（换季/换天候）才重画） */
      if (sky._sig !== (line || '')) {
        sky._sig = (line || '');
        sky.innerHTML = '<span class="ns-k">天时</span>' + U.escape(line || '—');
      }
    }""",
guard=u"if (sky._sig !== (line || ''))")

# ---------- C10：amtTip 重写（分账） ----------
if u'级合计）：' in s and u'基础储量：' in s:
    done.append('C10 skip（已落）')
else:
    _i = s.index(u"      /* v40（需求 1）：存量悬停从「精确值」改为**仓储上限** ——")
    _j = s.index(u"        + '\\n现有 ' + U.numText(val, 0);", _i)
    OLD10 = s[_i:_j + len(u"        + '\\n现有 ' + U.numText(val, 0);")]
    NEW10 = u"""      /* v89.158（老板 1「左侧资源统计的容量显示仍然不对」）：容量悬停改**分账**——
         上限 = 仓库/基础 + 城外堆场，两行相加自洽（唯一出口 GAME.storePartsOf）；
         改前只写"其中城外堆场 +Y"，另外的 200 万基础没有出处（账对不上）。
         已占 ≥100% 显示"已满"（不再出现"已占 123%"这类读数）。
         黄金是货币，不受仓库上限约束（同前口径）。 */
      var sp = GAME.storePartsOf ? GAME.storePartsOf(GAME.currentCity()) : null;
      var cap = (k === 'gold') ? 0 : (sp ? sp.total : (GAME.storeCap ? GAME.storeCap() : 0));
      var _pct = (cap > 0) ? Math.round(val / cap * 100) : 0;
      var amtTip = (k === 'gold')
        ? ('黄金：货币，不受仓储上限约束' + '\\n现有 ' + U.numText(val, 0))
        : ((meta ? meta.name : k) + '　上限 ' + U.amtText(cap)
          + '（' + (_pct >= 100 ? '已满' : '已占 ' + _pct + '%') + '）'
          + '\\n· ' + ((sp && sp.lv > 0)
              ? ('仓库（' + sp.lv + ' 级合计）：' + U.amtText(sp.base))
              : ('基础储量：' + U.amtText(sp ? sp.base : cap)))
          + ((sp && sp.ext > 0) ? ('\\n· 城外堆场：+' + U.amtText(sp.ext) + '（资源建筑按等级所出 · 不吃仓储加成）') : '')
          + '\\n现有 ' + U.numText(val, 0));"""
    c10 = s.count(OLD10)
    assert c10 == 1, 'C10 anchor count=' + str(c10)
    s = s.replace(OLD10, NEW10)
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    done.append('C10 OK')

# ---------- C11：openStore 拆账 + 标题 ----------
rep('C11 store head',
u"""  ui.openStore = function () {
    var s = GAME.state;
    var lv = GAME.buildingLevel(GAME.currentCity(), 'cangku') || 0;
    var cap = GAME.storeCap();
    var near = lv > 0 ? '' : '<div class="note-warn">未建仓库：仅保有基础储量 ' + U.fmt(cap) + '，超出部分将停止增长</div>';""",
u"""  ui.openStore = function () {
    var s = GAME.state;
    /* v89.158（老板 1）：口径统一 —— ① 等级取**等级和**（多仓叠加才是容量口径；
       改前 buildingLevel 只给"最高一座"，2 座 Lv1 显示 Lv1 而容量按 2 级算，两把尺）；
       ② "基础储量"拆账（不再把城外堆场算进"基础"）；③ 标题按有无仓库分形态。 */
    var sp = GAME.storePartsOf(GAME.currentCity());
    var lv = sp.lv;
    var cap = sp.total;
    var near = lv > 0 ? '' : '<div class="note-warn">未建仓库：仅保有基础储量 ' + U.fmt(sp.base)
      + '；城外堆场另计 +' + U.fmt(sp.ext) + '，合计 ' + U.fmt(sp.total) + '（超出部分将停止增长）</div>';""",
guard=u"var sp = GAME.storePartsOf(GAME.currentCity());\n    var lv = sp.lv;")

rep('C11 store title',
u"""      '<div class="gold-heading">🏚️ 仓库 · Lv' + lv + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:8px;">每级 +' + U.fmt(2000000) + ' 储量上限</div>' +""",
u"""      '<div class="gold-heading">🏚️ 仓库 · ' + (lv > 0 ? ('Lv' + lv + '（多仓叠加）') : '未建') + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:8px;">每级 +' + U.fmt(GAME.DATA.BASE_STORE || 2000000) + ' 储量上限</div>' +""",
guard=u"(lv > 0 ? ('Lv' + lv + '（多仓叠加）') : '未建')")

# ---------- C12：cangku 行修公式 ----------
rep('C12 cangku row',
u"""      if (b.id === 'cangku') extra = '<div class="attr"><span class="k">本仓储量</span><span class="v">' + U.fmt(GAME.storeCap() / Math.max(1, GAME.buildingLevelSum(c, 'cangku')) || 0) + '</span></div>'
        + '<div class="attr"><span class="k">全境储量上限</span><span class="v good">' + U.fmt(GAME.storeCap()) + '（多仓叠加）</span></div>';""",
u"""      /* v89.158（老板 1）：① "本仓储量"改**本座**口径 —— 改前把上限总额 ÷ 等级和，
         还把城外堆场摊了进来（无仓库时干脆显示全额），数字对不上；
         ② "全境储量上限"标签错（v60 起仓储**按城**）→ 改"本城储量上限"。 */
      if (b.id === 'cangku') {
        var _sp158 = GAME.storePartsOf(c);
        var _per158 = _sp158.lv > 0 ? (_sp158.base / _sp158.lv) : _sp158.base;
        extra = '<div class="attr"><span class="k">本座储量</span><span class="v">' + U.fmt(Math.round(_per158 * bLv)) + '（Lv' + bLv + '）</span></div>'
          + '<div class="attr"><span class="k">本城储量上限</span><span class="v good">' + U.fmt(_sp158.total) + '（多仓叠加）</span></div>';
      }""",
guard=u"var _sp158 = GAME.storePartsOf(c);")

io.open(P, 'w', encoding='utf-8', newline='').write(s)

# ---------- 自检 ----------
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'ui.hoverHold = function') == 1, 'hoverHold count'
assert chk.count(u'ui.hoverHold(') == 6, 'hoverHold 调用（6 处）: ' + str(chk.count(u'ui.hoverHold('))
assert chk.count(u'GAME.storePartsOf') == 5, 'storePartsOf 出现点（4 调用 + 1 注释）: ' + str(chk.count(u'GAME.storePartsOf'))
# 负向判据一律查"可执行形态"（注释里提到旧名不算残留 —— §48.4 老坑）
assert u"'\\n其中城外堆场 +'" not in chk, '旧文案残留（可执行形态）'
assert u'k">本仓储量<' not in chk, '旧"本仓储量"残留（HTML 形态）'
assert u'k">全境储量上限<' not in chk, '旧"全境储量上限"残留（HTML 形态）'
print('patch C done:', done, 'len', orig, '->', len(chk))
